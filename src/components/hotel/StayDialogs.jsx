import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import FlexibleDateInput from '@/components/form/FlexibleDateInput.jsx';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import Notice from '@/components/ui/Notice';
import { Dialog } from '@/components/ui/Dialog.tsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { todayISODate } from '@/lib/dates/datetime';
import { normalizeStockWarnings } from '@/lib/business/hospitality';
import { useI18n } from '@/lib/i18n.jsx';
import { normalizeLookupProduct } from '@/lib/lookups.js';
import { requiresBankSelection } from '@/lib/money/payments';
import {
  ID_TYPES,
  addDaysISO,
  asItems,
  buildPaymentBody,
  errorMessage,
  isoDate,
  money,
  nightsBetween,
  num,
  roomOptionLabel,
  stayCheckIn,
  stayCheckOut,
  tx,
} from '@/lib/hotel/hotelUtils';

/** Shared dialog chrome: error notice + cancel/submit footer. */
function FormDialog({ title, formId, size = 'md', submitLabel, submitting, onClose, error, children, onSubmit, disabled }) {
  const { t } = useI18n();
  return (
    <Dialog
      isOpen
      onClose={() => !submitting && onClose()}
      title={title}
      size={size}
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={submitting || disabled}>
            {submitting ? t('common.loading') : submitLabel}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        {error ? <Notice tone="error" title={error} /> : null}
        {children}
      </form>
    </Dialog>
  );
}

function useSubmit(action, onDone) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const run = async (event) => {
    event?.preventDefault?.();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await action();
      await onDone?.(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, setError, run };
}

/* ------------------------------------------------------------------ */
/* Check in                                                           */
/* ------------------------------------------------------------------ */

export function CheckInDialog({ stay, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const [form, setForm] = useState({
    guestName: stay?.guestName || stay?.party?.name || '',
    idType: stay?.idType || '',
    idNumber: stay?.idNumber || '',
  });
  const { submitting, error, setError, run } = useSubmit(
    () => api.checkInHotelStay(stay.id, {
      guestName: form.guestName.trim(),
      idType: form.idType,
      idNumber: form.idNumber.trim(),
    }),
    onDone,
  );

  const submit = (event) => {
    event.preventDefault();
    if (!form.guestName.trim() || !form.idType || !form.idNumber.trim()) {
      setError(L('hotel.stay.checkInRequired', 'Guest name, ID type and ID number are required to check in.'));
      return;
    }
    run(event);
  };

  return (
    <FormDialog
      title={L('hotel.stay.checkIn', 'Check in')}
      formId="hotel-checkin-form"
      submitLabel={L('hotel.stay.checkIn', 'Check in')}
      submitting={submitting}
      onClose={onClose}
      error={error}
      onSubmit={submit}
    >
      <div>
        <label className="label">{L('hotel.booking.guestName', 'Guest name')}</label>
        <input
          className="input"
          value={form.guestName}
          onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">{L('hotel.booking.idType', 'ID type')}</label>
        <select
          className="input"
          value={form.idType}
          onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value }))}
        >
          <option value="">{L('hotel.booking.selectIdType', 'Select ID type')}</option>
          {ID_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{L(type.key, type.label)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{L('hotel.booking.idNumber', 'ID number')}</label>
        <input
          className="input"
          value={form.idNumber}
          onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
        />
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Add payment                                                        */
/* ------------------------------------------------------------------ */

export function PaymentDialog({ stay, suggestedAmount = 0, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const [form, setForm] = useState({
    amount: suggestedAmount > 0 ? String(suggestedAmount) : '',
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
  });
  const { submitting, error, setError, run } = useSubmit(
    () => api.addHotelStayPayment(stay.id, buildPaymentBody(form)),
    onDone,
  );

  const submit = (event) => {
    event.preventDefault();
    if (num(form.amount) <= 0) {
      setError(L('hotel.stay.amountRequired', 'Enter an amount greater than zero.'));
      return;
    }
    if (requiresBankSelection(form, num(form.amount))) {
      setError(L('hotel.booking.bankRequired', 'Select a bank account for this payment.'));
      return;
    }
    run(event);
  };

  return (
    <FormDialog
      title={L('hotel.stay.addPayment', 'Add payment')}
      formId="hotel-payment-form"
      submitLabel={L('hotel.stay.savePayment', 'Save payment')}
      submitting={submitting}
      onClose={onClose}
      error={error}
      onSubmit={submit}
    >
      <div>
        <label className="label">{L('common.amount', 'Amount')}</label>
        <input
          type="number"
          min="0"
          step="any"
          className="input"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          autoFocus
        />
      </div>
      <PaymentMethodFields value={form} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} showPaymentNote />
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Charge to room                                                     */
/* ------------------------------------------------------------------ */

function warningText(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.message || entry?.warning || entry?.productName || JSON.stringify(entry);
}

export function ChargeDialog({ stay, onClose, onDone, onWarnings }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query, 250);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lines, setLines] = useState([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    const search = debounced.trim();
    if (!search) {
      setResults([]);
      return undefined;
    }
    let active = true;
    setSearching(true);
    api
      .lookupProducts({ search, limit: 12 })
      .then((payload) => {
        if (active) setResults(asItems(payload).map(normalizeLookupProduct).filter((p) => p.id));
      })
      .catch(() => {
        if (active) setResults([]);
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => {
      active = false;
    };
  }, [debounced]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + num(line.quantity) * num(line.unitPrice), 0),
    [lines],
  );

  const addProduct = (product) => {
    setLines((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) =>
          line.productId === product.id ? { ...line, quantity: num(line.quantity) + 1 } : line,
        );
      }
      return [...prev, { productId: product.id, name: product.name, quantity: 1, unitPrice: String(product.salePrice || 0) }];
    });
    setQuery('');
    setResults([]);
  };

  const updateLine = (productId, changes) =>
    setLines((prev) => prev.map((line) => (line.productId === productId ? { ...line, ...changes } : line)));

  const { submitting, error, setError, run } = useSubmit(
    () => api.addHotelStayCharges(stay.id, {
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: num(line.quantity, 1),
        unitPrice: num(line.unitPrice),
      })),
      note: note.trim() || undefined,
    }),
    async (result) => {
      const warnings = normalizeStockWarnings(result).map(warningText);
      if (warnings.length) onWarnings?.(warnings);
      await onDone?.(result);
    },
  );

  const submit = (event) => {
    event.preventDefault();
    if (lines.length === 0) {
      setError(L('hotel.stay.chargeItemsRequired', 'Add at least one item.'));
      return;
    }
    if (lines.some((line) => num(line.quantity) <= 0)) {
      setError(L('hotel.stay.chargeQtyInvalid', 'Quantity must be greater than zero.'));
      return;
    }
    run(event);
  };

  return (
    <FormDialog
      title={L('hotel.stay.chargeToRoom', 'Charge to room')}
      formId="hotel-charge-form"
      size="xl"
      submitLabel={L('hotel.stay.addCharges', 'Add charges')}
      submitting={submitting}
      onClose={onClose}
      error={error}
      onSubmit={submit}
    >
      <div className="relative">
        <div className="flex items-center gap-2 rounded-2xl border border-secondary-200 bg-white px-3 py-2.5 focus-within:border-primary-300">
          <Search size={16} className="shrink-0 text-secondary-400" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-secondary-400"
            placeholder={L('hotel.stay.searchProducts', 'Search products (minibar, food, laundry…)')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query.trim() ? (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-secondary-200 bg-white">
            {searching && results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-secondary-500">{t('common.loading')}</p>
            ) : results.length === 0 ? (
              <p className="px-4 py-3 text-sm text-secondary-500">{t('common.noData')}</p>
            ) : (
              results.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center justify-between gap-3 border-b border-secondary-100 px-4 py-2.5 text-left text-sm last:border-0 hover:bg-mist"
                >
                  <span className="min-w-0 truncate font-semibold text-ink">{product.name}</span>
                  <span className="shrink-0 tabular-nums text-secondary-600">{money(t, product.salePrice)}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-secondary-200 py-6 text-center text-sm text-secondary-500">
          {L('hotel.stay.noChargeLines', 'Search and tap a product to add it.')}
        </p>
      ) : (
        <div className="divide-y divide-secondary-100 rounded-2xl border border-secondary-200">
          {lines.map((line) => (
            <div key={line.productId} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <p className="min-w-0 flex-1 basis-40 truncate text-sm font-semibold text-ink">{line.name}</p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg border border-secondary-200 p-1.5 text-secondary-600 hover:bg-mist"
                  onClick={() => updateLine(line.productId, { quantity: Math.max(num(line.quantity) - 1, 0) })}
                  aria-label="Decrease"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="input h-9 w-16 text-center"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.productId, { quantity: e.target.value })}
                />
                <button
                  type="button"
                  className="rounded-lg border border-secondary-200 p-1.5 text-secondary-600 hover:bg-mist"
                  onClick={() => updateLine(line.productId, { quantity: num(line.quantity) + 1 })}
                  aria-label="Increase"
                >
                  <Plus size={14} />
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="any"
                className="input h-9 w-24"
                value={line.unitPrice}
                onChange={(e) => updateLine(line.productId, { unitPrice: e.target.value })}
                aria-label={L('hotel.stay.unitPrice', 'Unit price')}
              />
              <span className="w-24 text-right text-sm font-semibold tabular-nums text-ink">
                {money(t, num(line.quantity) * num(line.unitPrice))}
              </span>
              <button
                type="button"
                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                onClick={() => setLines((prev) => prev.filter((l) => l.productId !== line.productId))}
                aria-label={t('common.delete')}
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <div className="flex justify-between bg-mist/60 px-3 py-2.5 text-sm font-bold text-ink">
            <span>{L('hotel.stay.total', 'Total')}</span>
            <span className="tabular-nums">{money(t, total)}</span>
          </div>
        </div>
      )}

      <div>
        <label className="label">{L('hotel.booking.notes', 'Notes')}</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Move room                                                          */
/* ------------------------------------------------------------------ */

export function MoveRoomDialog({ stay, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');

  const currentRoomId = String(stay?.roomId || stay?.room?.id || '');
  const today = todayISODate();
  const from = (() => {
    const checkIn = isoDate(stayCheckIn(stay)) || today;
    return String(stay?.status).toLowerCase() === 'checked_in' && checkIn < today ? today : checkIn;
  })();
  const to = isoDate(stayCheckOut(stay)) || addDaysISO(from, 1);

  useEffect(() => {
    let active = true;
    api
      .getHotelAvailability({ from, to })
      .then((payload) => {
        if (!active) return;
        setRooms(
          asItems(payload, ['rooms', 'available', 'availableRooms']).filter(
            (room) =>
              room.available !== false
              && room.isAvailable !== false
              && String(room.id) !== currentRoomId,
          ),
        );
      })
      .catch((err) => active && setLoadError(errorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to, currentRoomId]);

  const { submitting, error, setError, run } = useSubmit(
    () => api.moveHotelStay(stay.id, { roomId, reason: reason.trim() || undefined }),
    onDone,
  );

  const submit = (event) => {
    event.preventDefault();
    if (!roomId) {
      setError(L('hotel.booking.roomRequired', 'Choose a room.'));
      return;
    }
    run(event);
  };

  return (
    <FormDialog
      title={L('hotel.stay.moveRoom', 'Move room')}
      formId="hotel-move-form"
      submitLabel={L('hotel.stay.moveRoom', 'Move room')}
      submitting={submitting}
      onClose={onClose}
      error={error || loadError}
      onSubmit={submit}
    >
      <div>
        <label className="label">{L('hotel.stay.newRoom', 'New room')}</label>
        <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={loading}>
          <option value="">
            {loading
              ? t('common.loading')
              : rooms.length === 0
                ? L('hotel.booking.noRooms', 'No rooms available for these dates')
                : L('hotel.booking.selectRoom', 'Select a room')}
          </option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{roomOptionLabel(t, room)}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{L('hotel.stay.reason', 'Reason (optional)')}</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Extend / shorten                                                   */
/* ------------------------------------------------------------------ */

export function DatesDialog({ stay, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const reserved = String(stay?.status).toLowerCase() === 'reserved';
  const [checkInDate, setCheckInDate] = useState(isoDate(stayCheckIn(stay)));
  const [checkOutDate, setCheckOutDate] = useState(isoDate(stayCheckOut(stay)));
  const nights = nightsBetween(checkInDate, checkOutDate);

  const { submitting, error, setError, run } = useSubmit(
    () => api.updateHotelStay(stay.id, {
      ...(reserved ? { checkInDate } : {}),
      checkOutDate,
    }),
    onDone,
  );

  const submit = (event) => {
    event.preventDefault();
    if (!checkOutDate || nights < 1) {
      setError(L('hotel.booking.datesInvalid', 'Check-out must be after check-in.'));
      return;
    }
    run(event);
  };

  return (
    <FormDialog
      title={L('hotel.stay.changeDates', 'Extend / shorten stay')}
      formId="hotel-dates-form"
      submitLabel={t('common.save')}
      submitting={submitting}
      onClose={onClose}
      error={error}
      onSubmit={submit}
    >
      <div>
        <label className="label">{L('hotel.booking.checkIn', 'Check-in')}</label>
        <FlexibleDateInput value={checkInDate} onChange={setCheckInDate} disabled={!reserved} />
      </div>
      <div>
        <label className="label">{L('hotel.booking.checkOut', 'Check-out')}</label>
        <FlexibleDateInput value={checkOutDate} onChange={setCheckOutDate} required />
      </div>
      <p className="text-xs text-secondary-500">
        {nights} {nights === 1 ? L('hotel.booking.night', 'night') : L('hotel.booking.nights', 'nights')}
      </p>
    </FormDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel                                                             */
/* ------------------------------------------------------------------ */

export function CancelStayDialog({ stay, onClose, onDone }) {
  const { t } = useI18n();
  const L = (key, fallback) => tx(t, key, fallback);
  const [reason, setReason] = useState('');
  const { submitting, error, run } = useSubmit(
    () => api.cancelHotelStay(stay.id, { reason: reason.trim() || undefined }),
    onDone,
  );

  return (
    <FormDialog
      title={L('hotel.stay.cancelStay', 'Cancel booking')}
      formId="hotel-cancel-form"
      submitLabel={L('hotel.stay.confirmCancel', 'Cancel booking')}
      submitting={submitting}
      onClose={onClose}
      error={error}
      onSubmit={run}
    >
      <Notice
        tone="warn"
        title={L(
          'hotel.stay.cancelAdvanceNote',
          'Any advance payment is kept as credit on the guest account.',
        )}
      />
      <div>
        <label className="label">{L('hotel.stay.reason', 'Reason (optional)')}</label>
        <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </div>
    </FormDialog>
  );
}
