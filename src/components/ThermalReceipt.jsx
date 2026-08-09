import { formatCurrency } from '../lib/currency';

function money(val) {
  return formatCurrency(val);
}

export default function ThermalReceipt({
  biz = {},
  receiptType = 'Receipt',
  invoiceNo = '',
  date = '',
  partyName = '',
  creatorName = '',
  tableName = '',
  items = [],
  totals = {},
  notes = '',
  extraFields = [],
  reprintLabel = '',
}) {
  const finalPartyName = partyName || 'Walk-in Customer';

  return (
    <div className="w-full bg-white text-black p-1 select-none text-left" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '12px', lineHeight: '1.4' }}>
      {/* Business Name */}
      <div className="text-center font-bold text-base tracking-wide uppercase mb-1">
        {biz.companyName || 'PasalManager'}
      </div>
      {reprintLabel ? (
        <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-wide">
          {reprintLabel}
        </div>
      ) : null}
      
      {/* Business Details */}
      {(biz.address || biz.phone || biz.email || biz.panVat) && (
        <div className="text-center text-[10px] text-slate-700 space-y-0.5 mb-2">
          {biz.address && <div className="whitespace-pre-line">{biz.address}</div>}
          {biz.phone && <div>Tel: {biz.phone}</div>}
          {biz.email && <div>{biz.email}</div>}
          {biz.panVat && <div className="font-semibold">PAN/VAT: {biz.panVat}</div>}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Receipt Type & Meta */}
      <div className="text-center font-bold uppercase tracking-wider text-[11px] mb-2">
        *** {receiptType} ***
      </div>
      
      <div className="text-[11px] space-y-1">
        <div className="flex justify-between">
          <span>Bill No: #{invoiceNo}</span>
          <span>Date: {date}</span>
        </div>
        {creatorName && (
          <div>Cashier: {creatorName}</div>
        )}
        {tableName && (
          <div className="font-bold">Table: {tableName}</div>
        )}
        <div>Customer: {finalPartyName}</div>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Line Items Table */}
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-dashed border-black">
            <th className="pb-1 text-left font-bold" style={{ width: '55%' }}>Item</th>
            <th className="pb-1 text-right font-bold" style={{ width: '15%' }}>Qty</th>
            <th className="pb-1 text-right font-bold" style={{ width: '30%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-1 pr-1 break-words">
                {item.description || '—'}
                {item.unitPrice !== undefined && (
                  <span className="block text-[10px] text-slate-600">
                    @{money(item.unitPrice)}
                  </span>
                )}
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {Number(item.quantity || 0).toFixed(0)}
              </td>
              <td className="py-1 text-right whitespace-nowrap font-medium">
                {money(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Totals */}
      <div className="text-[11px] space-y-1 ml-auto max-w-[85%]">
        {totals.subTotal !== undefined && Number(totals.subTotal) > 0 && (
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{money(totals.subTotal)}</span>
          </div>
        )}
        {totals.taxTotal !== undefined && Number(totals.taxTotal) > 0 && (
          <div className="flex justify-between">
            <span>Tax:</span>
            <span>{money(totals.taxTotal)}</span>
          </div>
        )}
        {totals.discountTotal !== undefined && Number(totals.discountTotal) > 0 && (
          <div className="flex justify-between text-slate-800">
            <span>Discount:</span>
            <span>-{money(totals.discountTotal)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold border-t border-dashed border-black pt-1">
          <span>Total:</span>
          <span>{money(totals.grandTotal)}</span>
        </div>
        {totals.amountReceived !== undefined && (
          <div className="flex justify-between">
            <span>Received:</span>
            <span>{money(totals.amountReceived)}</span>
          </div>
        )}
        {totals.dueAmount !== undefined && Number(totals.dueAmount) > 0 && (
          <div className="flex justify-between font-bold">
            <span>Due:</span>
            <span>{money(totals.dueAmount)}</span>
          </div>
        )}
      </div>

      {/* Extra Fields (e.g. jewelry metal, purity, gym details, extra order attributes) */}
      {extraFields.length > 0 && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="text-[10px] space-y-0.5">
            {extraFields.map((field, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="font-medium">{field.label}:</span>
                <span className="text-slate-700">{field.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Notes */}
      {notes && (
        <>
          <div className="border-t border-dashed border-black my-2" />
          <div className="text-[10px] text-slate-700 italic whitespace-pre-wrap">
            Note: {notes}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-dashed border-black my-2" />

      {/* Footer message */}
      <div className="text-center text-[10px] text-slate-700 space-y-1">
        <div>Thank you for your visit!</div>
        <div>Please visit again.</div>
      </div>
    </div>
  );
}
