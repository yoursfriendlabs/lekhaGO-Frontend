import { useEffect, useMemo, useState } from 'react';
import FlexibleDateInput from '@/components/form/FlexibleDateInput.jsx';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import PartySearchCreateField from '@/components/parties/PartySearchCreateField.jsx';
import Notice from '@/components/ui/Notice';
import { Dialog } from '@/components/ui/Dialog.tsx';
import { api } from '@/lib/api';
import { todayISODate } from '@/lib/dates/datetime';
import { extractConflictIds } from '@/lib/business/hospitality';
import { useI18n } from '@/lib/i18n.jsx';
import { requiresBankSelection } from '@/lib/money/payments';
import {
  ID_TYPES,
  addDaysISO,
  asItems,
  buildStayPayload,
  errorMessage,
  money,
  nightsBetween,
  num,
  roomOptionLabel,
  roomRate,
  tx,
} from '@/lib/hotel/hotelUtils';

/**
 * Book / walk-in form. Mount it only while open so each open starts from a
 * fresh form.
 */
export default function HotelBookingDialog({
  mode = 'booking',
  defaultRoomId = '',
  defaultDate = '',
  onClose,
  onCreated,
  onOpenStay,
}) {
  const { t } = useI18n();
  const L = (key, fallback, vars) => tx(t, key, fallback, vars);
  const today = todayISODate();
  const isWalkIn = mode === 'walkin';
  const startDate = isWalkIn ? today : (defaultDate && defaultDate >= today ? defaultDate : today);

  const [form, setForm] = useState({
    roomId: defaultRoomId ? String(defaultRoomId) : '',
    partyId: '',
    guestName: '',
    guestPhone: '',
    idType: '',
    idNumber: '',
    adults: '1',
    children: '0',
    checkInDate: startDate,
    checkOutDate: addDaysISO(startDate, 1),
    rate: '',
    rateTouched: false,
    notes: '',
    advanceAmount: '',
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
    checkInNow: isWalkIn,
  });
  const [party, setParty] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [availabilityError, setAvailabilityError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null);

  const patch = (changes) => setForm((prev) => ({ ...prev, ...changes }));
  const nights = nightsBetween(form.checkInDate, form.checkOutDate);
  const canCheckInNow = form.checkInDate === today;

  /* Availability for the chosen dates */
  useEffect(() => {
    if (!form.checkInDate || !form.checkOutDate || nights < 1) {
      setRooms([]);
      setLoadingRooms(false);
      return undefined;
    }
    let active = true;
    setLoadingRooms(true);
    setAvailabilityError('');
    api
      .getHotelAvailability({ from: form.checkInDate, to: form.checkOutDate })
      .then((payload) => {
        if (!active) return;
        const items = asItems(payload, ['rooms', 'available', 'availableRooms']).filter(
          (room) => room.available !== false && room.isAvailable !== false,
        );
        setRooms(items);
      })
      .catch((err) => {
        if (!active) return;
        setRooms([]);
        setAvailabilityError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoadingRooms(false);
      });
    return () => {
      active = false;
    };
  }, [form.checkInDate, form.checkOutDate, nights]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => String(room.id) === String(form.roomId)) || null,
    [rooms, form.roomId],
  );

  /* Drop a selected room that is no longer available; follow its rate */
  useEffect(() => {
    if (loadingRooms || !form.roomId) return;
    if (!rooms.some((room) => String(room.id) === String(form.roomId))) {
      setForm((prev) => ({ ...prev, roomId: '' }));
    }
  }, [loadingRooms, rooms, form.roomId]);

  useEffect(() => {
    if (selectedRoom && !form.rateTouched) {
      setForm((prev) => ({ ...prev, rate: String(roomRate(selectedRoom)) }));
    }
  }, [selectedRoom, form.rateTouched]);

  useEffect(() => {
    if (!canCheckInNow && form.checkInNow) patch({ checkInNow: false });
  }, [canCheckInNow, form.checkInNow]);

  const handleCheckInChange = (value) => {
    if (!value) return patch({ checkInDate: '' });
    const next = { checkInDate: value };
    if (!form.checkOutDate || form.checkOutDate <= value) next.checkOutDate = addDaysISO(value, 1);
    return patch(next);
  };

  const handleParty = (selected) => {
    setParty(selected);
    if (selected) {
      patch({
        partyId: selected.id || '',
        guestName: selected.name || form.guestName,
        guestPhone: selected.phone || form.guestPhone,
      });
    } else {
      patch({ partyId: '' });
    }
  };

  const total = nights * num(form.rate);

  const validate = () => {
    if (!form.roomId) return L('hotel.booking.roomRequired', 'Choose a room.');
    if (nights < 1) return L('hotel.booking.datesInvalid', 'Check-out must be after check-in.');
    if (!form.guestName.trim()) return L('hotel.booking.guestRequired', 'Guest name is required.');
    if (form.checkInNow && (!form.idType || !form.idNumber.trim())) {
      return L('hotel.booking.idRequired', 'ID type and ID number are required to check in.');
    }
    if (num(form.advanceAmount) > 0 && requiresBankSelection(form, num(form.advanceAmount))) {
      return L('hotel.booking.bankRequired', 'Select a bank account for the advance payment.');
    }
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError('');
    setConflict(null);
    try {
      const result = await api.createHotelStay(buildStayPayload(form));
      onCreated?.(result);
    } catch (err) {
      if (err?.status === 409) {
        const ids = extractConflictIds(err);
        setConflict({ message: ids.message, stayId: ids.stayId });
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = isWalkIn
    ? L('hotel.booking.walkInTitle', 'Walk-in check-in')
    : L('hotel.booking.bookTitle', 'New booking');

  return (
    <Dialog
      isOpen
      onClose={() => !submitting && onClose?.()}
      title={title}
      size="full"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="hotel-booking-form" className="btn-primary" disabled={submitting}>
            {submitting
              ? t('common.loading')
              : form.checkInNow
                ? L('hotel.booking.submitCheckIn', 'Book & check in')
                : L('hotel.booking.submit', 'Create booking')}
          </button>
        </>
      )}
    >
      <form id="hotel-booking-form" onSubmit={submit} className="space-y-5">
        {error ? <Notice tone="error" title={error} /> : null}
        {conflict ? (
          <div className="space-y-2 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">{conflict.message}</p>
            {conflict.stayId ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => onOpenStay?.(conflict.stayId)}
              >
                {L('hotel.booking.openStay', 'Open stay')}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Dates + room */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
            {L('hotel.booking.stayHeading', 'Stay')}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">{L('hotel.booking.checkIn', 'Check-in')}</label>
              <FlexibleDateInput value={form.checkInDate} onChange={handleCheckInChange} required />
            </div>
            <div>
              <label className="label">{L('hotel.booking.checkOut', 'Check-out')}</label>
              <FlexibleDateInput
                value={form.checkOutDate}
                onChange={(value) => patch({ checkOutDate: value })}
                required
              />
            </div>
            <div>
              <label className="label">{L('hotel.booking.adults', 'Adults')}</label>
              <input
                type="number"
                min="1"
                className="input"
                value={form.adults}
                onChange={(e) => patch({ adults: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{L('hotel.booking.children', 'Children')}</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.children}
                onChange={(e) => patch({ children: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{L('hotel.booking.room', 'Room')}</label>
              <select
                className="input"
                value={form.roomId}
                onChange={(e) => patch({ roomId: e.target.value, rateTouched: false })}
                disabled={loadingRooms}
              >
                <option value="">
                  {loadingRooms
                    ? t('common.loading')
                    : rooms.length === 0
                      ? L('hotel.booking.noRooms', 'No rooms available for these dates')
                      : L('hotel.booking.selectRoom', 'Select a room')}
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomOptionLabel(t, room)}
                  </option>
                ))}
              </select>
              {availabilityError ? <p className="mt-1 text-xs text-rose-600">{availabilityError}</p> : null}
            </div>
            <div>
              <label className="label">{L('hotel.booking.rate', 'Rate / night')}</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                value={form.rate}
                onChange={(e) => patch({ rate: e.target.value, rateTouched: true })}
              />
              {nights > 0 && form.rate !== '' ? (
                <p className="mt-1 text-xs text-secondary-500">
                  {nights} {nights === 1 ? L('hotel.booking.night', 'night') : L('hotel.booking.nights', 'nights')}
                  {' × '}
                  {money(t, form.rate)} = <span className="font-semibold text-ink">{money(t, total)}</span>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Guest */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
            {L('hotel.booking.guestHeading', 'Guest')}
          </h4>
          <PartySearchCreateField
            type="customer"
            selectedParty={party}
            onSelect={handleParty}
            searchPlaceholder={L('hotel.booking.guestSearch', 'Search or add guest by name / phone')}
            entityLabel={L('hotel.booking.guestEntity', 'guest')}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{L('hotel.booking.guestName', 'Guest name')}</label>
              <input
                className="input"
                value={form.guestName}
                onChange={(e) => patch({ guestName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{L('hotel.booking.guestPhone', 'Phone')}</label>
              <input
                type="tel"
                className="input"
                value={form.guestPhone}
                onChange={(e) => patch({ guestPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{L('hotel.booking.idType', 'ID type')}</label>
              <select className="input" value={form.idType} onChange={(e) => patch({ idType: e.target.value })}>
                <option value="">{L('hotel.booking.selectIdType', 'Select ID type')}</option>
                {ID_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {L(type.key, type.label)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{L('hotel.booking.idNumber', 'ID number')}</label>
              <input
                className="input"
                value={form.idNumber}
                onChange={(e) => patch({ idNumber: e.target.value })}
              />
            </div>
          </div>
        </section>

        {/* Advance */}
        <section className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
            {L('hotel.booking.advanceHeading', 'Advance payment (optional)')}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">{L('hotel.booking.advanceAmount', 'Advance amount')}</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                value={form.advanceAmount}
                onChange={(e) => patch({ advanceAmount: e.target.value })}
              />
            </div>
          </div>
          {num(form.advanceAmount) > 0 ? (
            <PaymentMethodFields
              value={form}
              onChange={(changes) => patch(changes)}
              showPaymentNote
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <div>
            <label className="label">{L('hotel.booking.notes', 'Notes')}</label>
            <textarea
              className="input min-h-[64px]"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
          <label
            className={`flex items-center gap-2 text-sm font-medium ${canCheckInNow ? 'text-ink' : 'text-secondary-400'}`}
          >
            <input
              type="checkbox"
              checked={form.checkInNow}
              disabled={!canCheckInNow}
              onChange={(e) => patch({ checkInNow: e.target.checked })}
            />
            {L('hotel.booking.checkInNow', 'Check in now')}
            {!canCheckInNow ? (
              <span className="text-xs font-normal">
                ({L('hotel.booking.checkInNowHint', 'only for arrivals today')})
              </span>
            ) : null}
          </label>
        </section>
      </form>
    </Dialog>
  );
}
