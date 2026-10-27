import { useBusinessSettings } from '@/lib/business/businessSettings.jsx';
import { useI18n } from '@/lib/i18n.jsx';
import {
  chargeAmount,
  chargeLabel,
  displayDate,
  firstDefined,
  money,
  nightsBetween,
  num,
  stayCheckIn,
  stayCheckOut,
  stayGuestName,
  stayRoomName,
  tx,
} from '@/lib/hotel/hotelUtils';

/**
 * Printable guest statement (A4). Pass the DOM ref to `printElement`.
 * `folio` must already be run through `normalizeFolio`.
 */
export default function GuestStatementSheet({ stay, folio, sheetRef }) {
  const { t } = useI18n();
  const { settings } = useBusinessSettings();
  const L = (key, fallback) => tx(t, key, fallback);
  const checkIn = stayCheckIn(stay);
  const checkOut = stayCheckOut(stay);
  const nights = nightsBetween(checkIn, checkOut);
  const businessName = firstDefined(settings?.companyName, settings?.businessName, settings?.name) || '';
  const contact = [settings?.address, settings?.phone].filter(Boolean).join(' · ');

  return (
    <div
      ref={sheetRef}
      className="party-statement-sheet mx-auto w-full max-w-[794px] bg-white p-6 text-[13px] text-black"
    >
      <div className="flex items-start justify-between gap-4 border-b border-black pb-3">
        <div>
          <h2 className="text-xl font-bold">{businessName}</h2>
          {contact ? <p className="text-xs">{contact}</p> : null}
        </div>
        <div className="text-right">
          <h3 className="text-lg font-bold uppercase tracking-wide">
            {L('hotel.statement.title', 'Guest statement')}
          </h3>
          <p className="text-xs">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-3 text-xs">
        <p><strong>{L('hotel.booking.guestName', 'Guest name')}:</strong> {stayGuestName(stay) || '—'}</p>
        <p><strong>{L('hotel.board.room', 'Room')}:</strong> {stayRoomName(stay) || '—'}</p>
        <p><strong>{L('hotel.booking.checkIn', 'Check-in')}:</strong> {displayDate(checkIn)}</p>
        <p><strong>{L('hotel.booking.checkOut', 'Check-out')}:</strong> {displayDate(checkOut)}</p>
        <p><strong>{L('hotel.booking.nights', 'Nights')}:</strong> {nights}</p>
        {stay?.guestPhone || stay?.party?.phone ? (
          <p><strong>{L('hotel.booking.guestPhone', 'Phone')}:</strong> {stay.guestPhone || stay.party.phone}</p>
        ) : null}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1.5 text-left">{L('hotel.statement.item', 'Item')}</th>
            <th className="py-1.5 text-left">{t('common.date')}</th>
            <th className="py-1.5 text-right">{L('hotel.statement.qty', 'Qty')}</th>
            <th className="py-1.5 text-right">{L('hotel.statement.rate', 'Rate')}</th>
            <th className="py-1.5 text-right">{L('hotel.statement.amount', 'Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {folio.charges.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-3 text-center">—</td>
            </tr>
          ) : (
            folio.charges.map((line, index) => (
              <tr key={line.id || index} className="border-b border-gray-300">
                <td className="py-1.5">{chargeLabel(line)}</td>
                <td className="py-1.5">{displayDate(firstDefined(line.date, line.createdAt, line.chargeDate))}</td>
                <td className="py-1.5 text-right">{num(line.quantity, 1)}</td>
                <td className="py-1.5 text-right">{money(t, firstDefined(line.unitPrice, line.rate, 0))}</td>
                <td className="py-1.5 text-right">{money(t, chargeAmount(line))}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="ml-auto mt-3 w-64 space-y-1 text-xs">
        <Row label={L('hotel.stay.subtotal', 'Subtotal')} value={money(t, folio.subTotal)} />
        {folio.discount > 0 ? (
          <Row label={L('hotel.checkout.discount', 'Discount')} value={`-${money(t, folio.discount)}`} />
        ) : null}
        {folio.serviceChargeTotal > 0 ? (
          <Row label={L('hotel.stay.serviceCharge', 'Service charge')} value={money(t, folio.serviceChargeTotal)} />
        ) : null}
        {folio.taxTotal > 0 ? <Row label={L('hotel.stay.tax', 'Tax')} value={money(t, folio.taxTotal)} /> : null}
        <Row label={L('hotel.stay.grandTotal', 'Grand total')} value={money(t, folio.grandTotal)} bold />
        <Row label={L('hotel.stay.paidSoFar', 'Paid')} value={money(t, folio.paid)} />
        <Row label={L('hotel.stay.balanceDue', 'Balance due')} value={money(t, Math.max(folio.balanceDue, 0))} bold />
      </div>

      {folio.payments.length > 0 ? (
        <div className="mt-4 text-xs">
          <p className="mb-1 font-bold">{L('hotel.stay.payments', 'Payments')}</p>
          {folio.payments.map((payment, index) => (
            <div key={payment.id || index} className="flex justify-between border-b border-gray-200 py-1">
              <span>
                {displayDate(firstDefined(payment.date, payment.paidAt, payment.createdAt))}
                {' · '}
                {String(firstDefined(payment.paymentMethod, payment.method, payment.kind, '') || '')}
                {payment.note || payment.paymentNote ? ` · ${payment.note || payment.paymentNote}` : ''}
              </span>
              <span>{money(t, payment.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs">{L('hotel.statement.thanks', 'Thank you for staying with us.')}</p>
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-black pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
