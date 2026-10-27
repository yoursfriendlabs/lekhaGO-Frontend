import { formatCurrency } from '../../lib/money/currency';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function money(value) {
  return formatCurrency(value);
}

function Row({ label, value, bold = false }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-dashed border-black pt-1 font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Pre-settlement "check" for the guest. Explicitly NOT a tax invoice.
 * items: [{ name, quantity, unitPrice, lineTotal, note, extras }]
 * bill: { subTotal, discountTotal, serviceCharge, packagingCharge, taxTotal, grandTotal }
 */
export default function BillCheck({
  biz = {},
  tableName = '',
  orderNo = '',
  date = '',
  waiter = '',
  guests = null,
  items = [],
  bill = {},
}) {
  return (
    <div
      className="w-full bg-white p-1 text-left text-black select-none"
      style={{ fontFamily: MONO, fontSize: '12px', lineHeight: '1.4' }}
    >
      <div className="mb-1 text-center text-base font-bold uppercase tracking-wide">
        {biz.companyName || 'PasalManager'}
      </div>
      {(biz.address || biz.phone) ? (
        <div className="mb-1 space-y-0.5 text-center text-[10px]">
          {biz.address ? <div className="whitespace-pre-line">{biz.address}</div> : null}
          {biz.phone ? <div>Tel: {biz.phone}</div> : null}
        </div>
      ) : null}

      <div className="my-2 border-2 border-black py-1 text-center text-sm font-black uppercase tracking-wider">
        NOT A TAX INVOICE
      </div>

      <div className="space-y-0.5 text-[11px]">
        {tableName ? <div className="font-bold">Table: {tableName}</div> : null}
        <div className="flex justify-between">
          <span>Order: #{orderNo || '-'}</span>
          <span>{date}</span>
        </div>
        {waiter ? <div>Waiter: {waiter}</div> : null}
        {guests ? <div>Guests: {guests}</div> : null}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="pb-1 text-left font-bold" style={{ width: '55%' }}>Item</th>
            <th className="pb-1 text-right font-bold" style={{ width: '15%' }}>Qty</th>
            <th className="pb-1 text-right font-bold" style={{ width: '30%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id || index} className="align-top">
              <td className="break-words py-1 pr-1">
                {item.name}
                {item.unitPrice !== undefined ? (
                  <span className="block text-[10px]">@{money(item.unitPrice)}</span>
                ) : null}
                {(item.extras || []).map((extra, extraIndex) => (
                  <span key={extraIndex} className="block text-[10px]">+ {extra.name || extra}</span>
                ))}
              </td>
              <td className="whitespace-nowrap py-1 text-right">{Number(item.quantity || 0)}</td>
              <td className="whitespace-nowrap py-1 text-right font-medium">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="ml-auto max-w-[90%] space-y-1 text-[11px]">
        <Row label="Subtotal:" value={money(bill.subTotal)} />
        {Number(bill.discountTotal) > 0 ? <Row label="Discount:" value={`-${money(bill.discountTotal)}`} /> : null}
        {Number(bill.serviceCharge) > 0 ? <Row label="Service charge:" value={money(bill.serviceCharge)} /> : null}
        {Number(bill.packagingCharge) > 0 ? <Row label="Packaging:" value={money(bill.packagingCharge)} /> : null}
        {Number(bill.taxTotal) > 0 ? <Row label="Tax:" value={money(bill.taxTotal)} /> : null}
        <Row label="Total:" value={money(bill.grandTotal)} bold />
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      <div className="space-y-1 text-center text-[10px]">
        <div className="font-bold">This is a check only. Not a tax invoice.</div>
        <div>A tax invoice is issued after payment.</div>
      </div>
    </div>
  );
}
