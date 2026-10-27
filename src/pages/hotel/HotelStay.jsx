import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  CalendarClock,
  CreditCard,
  FileText,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  ShoppingBag,
  UserX,
} from 'lucide-react';
import Notice from '@/components/ui/Notice';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { Dialog } from '@/components/ui/Dialog.tsx';
import CheckOutDialog from '@/components/hotel/CheckOutDialog.jsx';
import GuestStatementSheet from '@/components/hotel/GuestStatementSheet.jsx';
import { StayStatusBadge } from '@/components/hotel/RoomStatus.jsx';
import {
  CancelStayDialog,
  ChargeDialog,
  CheckInDialog,
  DatesDialog,
  MoveRoomDialog,
  PaymentDialog,
} from '@/components/hotel/StayDialogs.jsx';
import PartyServiceBillModal from '@/pages/parties/PartyServiceBillModal.jsx';
import { SSE_EVENTS } from '@/hooks/useSSE';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh';
import { api, invalidateApiCache } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { printElement } from '@/lib/print/print.js';
import { useSnackbar } from '@/lib/snackbar.jsx';
import {
  chargeAmount,
  chargeLabel,
  displayDate,
  errorMessage,
  firstDefined,
  ID_TYPES,
  money,
  nightsBetween,
  normalizeFolio,
  num,
  stayCheckIn,
  stayCheckOut,
  stayGuestName,
  stayRoomName,
  stayStatusKey,
  tx,
} from '@/lib/hotel/hotelUtils';

export default function HotelStay() {
  const { stayId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const { showError, showInfo, showSuccess } = useSnackbar();
  const canManage = canManageFeature('frontDesk');
  const L = (key, fallback, vars) => tx(t, key, fallback, vars);

  const [stay, setStay] = useState(null);
  const [folio, setFolio] = useState(() => normalizeFolio(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // checkIn|payment|charge|move|dates|cancel|noShow|checkOut|statement
  const [billOrderId, setBillOrderId] = useState('');
  const [acting, setActing] = useState(false);
  const statementRef = useRef(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!businessId || !stayId) return;
      if (!silent) setLoading(true);
      invalidateApiCache([`hotel-folio:${stayId}`, `hotel-stay:${stayId}`]);
      try {
        const [stayPayload, folioPayload] = await Promise.all([
          api.getHotelStay(stayId, { force: true }),
          api.getHotelStayFolio(stayId).catch(() => null),
        ]);
        const nextStay = stayPayload?.stay || stayPayload;
        setStay(nextStay);
        setFolio(normalizeFolio(folioPayload?.folio || folioPayload || stayPayload?.folio));
        setError('');
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [businessId, stayId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useLiveScreenRefresh({
    enabled: Boolean(businessId && stayId),
    eventNames: [SSE_EVENTS.HOTEL_CHANGED],
    refetch: () => load({ silent: true }),
  });

  const status = stayStatusKey(stay);
  const isReserved = status === 'reserved';
  const isCheckedIn = status === 'checked_in';
  const isOpen = isReserved || isCheckedIn;
  const checkIn = stayCheckIn(stay);
  const checkOut = stayCheckOut(stay);
  const nights = nightsBetween(checkIn, checkOut);
  const existingOrderId = firstDefined(stay?.serviceOrderId, folio.serviceOrderId);

  const done = (message) => async () => {
    setDialog(null);
    if (message) showSuccess(message);
    await load({ silent: true });
  };

  const runAction = async (action, successMessage) => {
    if (acting) return;
    setActing(true);
    try {
      await action();
      setDialog(null);
      if (successMessage) showSuccess(successMessage);
      await load({ silent: true });
    } catch (err) {
      setDialog(null);
      showError(errorMessage(err));
    } finally {
      setActing(false);
    }
  };

  const handleCheckedOut = async (result) => {
    setDialog(null);
    showSuccess(L('hotel.stay.checkedOutDone', 'Guest checked out.'));
    await load({ silent: true });
    const orderId = firstDefined(
      result?.serviceOrderId,
      result?.stay?.serviceOrderId,
      result?.folio?.serviceOrderId,
      result?.serviceOrder?.id,
    );
    const roomBill = firstDefined(result?.folio?.roomBill, result?.roomBill);
    if (orderId) {
      setBillOrderId(String(orderId));
    } else if (roomBill) {
      setDialog('statement');
    }
  };

  const handleWarnings = (warnings) => {
    showInfo({
      title: L('hotel.stay.stockWarnings', 'Stock warning'),
      description: warnings.join(' · '),
      duration: 8000,
    });
  };

  const printStatement = () => printElement(statementRef.current);

  const idTypeMatch = ID_TYPES.find((type) => type.value === stay?.idType);
  const idTypeLabel = idTypeMatch ? L(idTypeMatch.key, idTypeMatch.label) : stay?.idType || '';

  if (loading && !stay) {
    return (
      <div className="card flex h-64 items-center justify-center bg-white text-sm text-secondary-500">
        {t('common.loading')}
      </div>
    );
  }

  if (!stay) {
    return (
      <div className="space-y-4">
        <Link to="/app/hotel" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft size={16} />
          {L('hotel.stay.backToBoard', 'Back to front desk')}
        </Link>
        <Notice tone="error" title={error || L('hotel.stay.notFound', 'Stay not found.')} />
      </div>
    );
  }

  const actionBtn = 'btn-secondary flex w-full items-center justify-center gap-2';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <button
            type="button"
            onClick={() => navigate('/app/hotel')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <ArrowLeft size={16} />
            {L('hotel.stay.backToBoard', 'Back to front desk')}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="page-title">{stayGuestName(stay) || L('hotel.stay.guest', 'Guest')}</h2>
            <StayStatusBadge status={stay.status} />
          </div>
          <p className="page-subtitle">
            {L('hotel.board.room', 'Room')} {stayRoomName(stay) || '—'}
            {' · '}
            {displayDate(checkIn)} → {displayDate(checkOut)}
            {' · '}
            {nights} {nights === 1 ? L('hotel.booking.night', 'night') : L('hotel.booking.nights', 'nights')}
          </p>
        </div>
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      {error ? <Notice tone="error" title={error} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5 min-w-0">
          {/* Guest + stay details */}
          <section className="card space-y-3 bg-white p-4 md:p-5">
            <h3 className="font-serif text-lg font-semibold text-ink">{L('hotel.stay.details', 'Stay details')}</h3>
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label={L('hotel.booking.guestName', 'Guest name')} value={stayGuestName(stay)} />
              <Detail label={L('hotel.booking.guestPhone', 'Phone')} value={stay.guestPhone || stay.party?.phone} />
              <Detail
                label={L('hotel.booking.idType', 'ID type')}
                value={idTypeLabel}
              />
              <Detail label={L('hotel.booking.idNumber', 'ID number')} value={stay.idNumber} />
              <Detail
                label={L('hotel.stay.guestsCount', 'Guests')}
                value={`${num(stay.adults, 1)} ${L('hotel.rooms.adultsShort', 'adults')}${
                  num(stay.children) ? ` + ${num(stay.children)} ${L('hotel.rooms.childrenShort', 'children')}` : ''
                }`}
              />
              <Detail
                label={L('hotel.booking.rate', 'Rate / night')}
                value={firstDefined(stay.rate, stay.nightlyRate) !== undefined ? money(t, firstDefined(stay.rate, stay.nightlyRate)) : ''}
              />
              {stay.notes ? (
                <div className="sm:col-span-2">
                  <Detail label={L('hotel.booking.notes', 'Notes')} value={stay.notes} />
                </div>
              ) : null}
            </dl>
          </section>

          {/* Folio */}
          <section className="card space-y-3 bg-white p-4 md:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold text-ink">{L('hotel.stay.folio', 'Folio')}</h3>
              <button
                type="button"
                className="btn-ghost flex items-center gap-2 text-sm"
                onClick={() => setDialog('statement')}
              >
                <FileText size={16} />
                {L('hotel.stay.statement', 'Guest statement')}
              </button>
            </div>
            {folio.charges.length === 0 ? (
              <p className="py-4 text-center text-sm text-secondary-500">
                {L('hotel.stay.noCharges', 'No charges yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-secondary-100 text-[11px] uppercase tracking-wide text-secondary-400">
                      <th className="py-2 pr-3 font-semibold">{L('hotel.statement.item', 'Item')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('common.date')}</th>
                      <th className="py-2 pr-3 text-right font-semibold">{L('hotel.statement.qty', 'Qty')}</th>
                      <th className="py-2 text-right font-semibold">{L('hotel.statement.amount', 'Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folio.charges.map((line, index) => (
                      <tr key={line.id || index} className="border-b border-secondary-50 last:border-0">
                        <td className="py-2 pr-3 font-medium text-ink">{chargeLabel(line)}</td>
                        <td className="py-2 pr-3 text-secondary-500">
                          {displayDate(firstDefined(line.date, line.createdAt, line.chargeDate))}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-secondary-600">{num(line.quantity, 1)}</td>
                        <td className="py-2 text-right font-semibold tabular-nums">{money(t, chargeAmount(line))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {folio.payments.length > 0 ? (
              <div className="space-y-1.5 border-t border-secondary-100 pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-secondary-400">
                  {L('hotel.stay.payments', 'Payments')}
                </p>
                {folio.payments.map((payment, index) => (
                  <div key={payment.id || index} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-secondary-600">
                      {displayDate(firstDefined(payment.date, payment.paidAt, payment.createdAt))}
                      {' · '}
                      {String(firstDefined(payment.paymentMethod, payment.method, payment.kind, '') || '')}
                      {payment.note || payment.paymentNote ? ` · ${payment.note || payment.paymentNote}` : ''}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700">
                      {money(t, payment.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        {/* Totals + actions */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="card space-y-1.5 bg-white p-4 text-sm">
            <Total label={L('hotel.stay.subtotal', 'Subtotal')} value={money(t, folio.subTotal)} />
            {folio.discount > 0 ? (
              <Total label={L('hotel.checkout.discount', 'Discount')} value={`-${money(t, folio.discount)}`} />
            ) : null}
            {folio.serviceChargeTotal > 0 ? (
              <Total label={L('hotel.stay.serviceCharge', 'Service charge')} value={money(t, folio.serviceChargeTotal)} />
            ) : null}
            {folio.taxTotal > 0 ? <Total label={L('hotel.stay.tax', 'Tax')} value={money(t, folio.taxTotal)} /> : null}
            <Total label={L('hotel.stay.grandTotal', 'Grand total')} value={money(t, folio.grandTotal)} strong />
            <Total label={L('hotel.stay.paidSoFar', 'Paid so far')} value={money(t, folio.paid)} />
            <Total
              label={L('hotel.stay.balanceDue', 'Balance due')}
              value={money(t, Math.max(folio.balanceDue, 0))}
              strong
              danger={folio.balanceDue > 0}
            />
          </section>

          {canManage ? (
            <section className="card space-y-2 bg-white p-4">
              {isReserved ? (
                <button type="button" className="btn-primary flex w-full items-center justify-center gap-2" onClick={() => setDialog('checkIn')}>
                  <LogIn size={16} />
                  {L('hotel.stay.checkIn', 'Check in')}
                </button>
              ) : null}
              {isCheckedIn ? (
                <button type="button" className="btn-primary flex w-full items-center justify-center gap-2" onClick={() => setDialog('checkOut')}>
                  <LogOut size={16} />
                  {L('hotel.checkout.title', 'Check out')}
                </button>
              ) : null}
              {isOpen ? (
                <>
                  <button type="button" className={actionBtn} onClick={() => setDialog('payment')}>
                    <CreditCard size={16} />
                    {L('hotel.stay.addPayment', 'Add payment')}
                  </button>
                  {isCheckedIn ? (
                    <button type="button" className={actionBtn} onClick={() => setDialog('charge')}>
                      <ShoppingBag size={16} />
                      {L('hotel.stay.chargeToRoom', 'Charge to room')}
                    </button>
                  ) : null}
                  <button type="button" className={actionBtn} onClick={() => setDialog('move')}>
                    <ArrowRightLeft size={16} />
                    {L('hotel.stay.moveRoom', 'Move room')}
                  </button>
                  <button type="button" className={actionBtn} onClick={() => setDialog('dates')}>
                    <CalendarClock size={16} />
                    {L('hotel.stay.changeDates', 'Extend / shorten stay')}
                  </button>
                </>
              ) : null}
              {isReserved ? (
                <div className="grid grid-cols-2 gap-2 border-t border-secondary-100 pt-2">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    onClick={() => setDialog('cancel')}
                  >
                    <Ban size={14} />
                    {L('hotel.stay.cancelStay', 'Cancel booking')}
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    onClick={() => setDialog('noShow')}
                  >
                    <UserX size={14} />
                    {L('hotel.stay.noShow', 'No-show')}
                  </button>
                </div>
              ) : null}
              {!isOpen ? (
                <p className="text-center text-xs text-secondary-500">
                  {L('hotel.stay.closedHint', 'This stay is closed. No further changes are possible.')}
                </p>
              ) : null}
            </section>
          ) : null}

          {existingOrderId && !isOpen ? (
            <button type="button" className={actionBtn} onClick={() => setBillOrderId(String(existingOrderId))}>
              <Printer size={16} />
              {L('hotel.stay.viewBill', 'View / print bill')}
            </button>
          ) : null}
        </aside>
      </div>

      {/* Dialogs */}
      {dialog === 'checkIn' ? (
        <CheckInDialog
          stay={stay}
          onClose={() => setDialog(null)}
          onDone={done(L('hotel.stay.checkedInDone', 'Guest checked in.'))}
        />
      ) : null}
      {dialog === 'payment' ? (
        <PaymentDialog
          stay={stay}
          suggestedAmount={Math.max(folio.balanceDue, 0)}
          onClose={() => setDialog(null)}
          onDone={done(L('hotel.stay.paymentSaved', 'Payment saved.'))}
        />
      ) : null}
      {dialog === 'charge' ? (
        <ChargeDialog
          stay={stay}
          onClose={() => setDialog(null)}
          onWarnings={handleWarnings}
          onDone={done(L('hotel.stay.chargesAdded', 'Charges added to the room.'))}
        />
      ) : null}
      {dialog === 'move' ? (
        <MoveRoomDialog
          stay={stay}
          onClose={() => setDialog(null)}
          onDone={done(L('hotel.stay.moved', 'Room changed.'))}
        />
      ) : null}
      {dialog === 'dates' ? (
        <DatesDialog
          stay={stay}
          onClose={() => setDialog(null)}
          onDone={done(L('hotel.stay.datesUpdated', 'Stay dates updated.'))}
        />
      ) : null}
      {dialog === 'cancel' ? (
        <CancelStayDialog
          stay={stay}
          onClose={() => setDialog(null)}
          onDone={done(L('hotel.stay.cancelled', 'Booking cancelled.'))}
        />
      ) : null}
      <ConfirmDialog
        isOpen={dialog === 'noShow'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          runAction(() => api.noShowHotelStay(stay.id, {}), L('hotel.stay.noShowDone', 'Marked as no-show.'))
        }
        confirming={acting}
        title={L('hotel.stay.noShow', 'No-show')}
        description={L(
          'hotel.stay.noShowConfirm',
          'Mark this booking as a no-show? The room will be released.',
        )}
        confirmLabel={L('hotel.stay.noShow', 'No-show')}
      />
      {dialog === 'checkOut' ? (
        <CheckOutDialog
          stay={stay}
          initialFolio={folio.raw}
          onClose={() => setDialog(null)}
          onDone={handleCheckedOut}
        />
      ) : null}

      <Dialog
        isOpen={dialog === 'statement'}
        onClose={() => setDialog(null)}
        title={L('hotel.stay.statement', 'Guest statement')}
        size="full"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              {t('common.close')}
            </button>
            <button type="button" className="btn-primary flex items-center gap-2" onClick={printStatement}>
              <Printer size={16} />
              {t('common.print')}
            </button>
          </>
        )}
      >
        <div className="overflow-x-auto rounded-2xl border border-secondary-200 bg-white">
          <GuestStatementSheet stay={stay} folio={folio} sheetRef={statementRef} />
        </div>
      </Dialog>

      {billOrderId ? (
        <PartyServiceBillModal
          record={{ id: billOrderId }}
          onClose={() => setBillOrderId('')}
        />
      ) : null}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-secondary-400">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-ink">{value || '—'}</dd>
    </div>
  );
}

function Total({ label, value, strong = false, danger = false }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? 'border-t border-secondary-100 pt-1.5 font-bold text-ink' : 'text-secondary-600'}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${danger ? 'text-rose-600' : ''}`}>{value}</span>
    </div>
  );
}
