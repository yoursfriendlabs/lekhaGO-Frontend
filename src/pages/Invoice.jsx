import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, API_BASE } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import Notice from '../components/Notice';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function Invoice() {
  const { type, id } = useParams();
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('');
  const { settings: biz } = useBusinessSettings();
  const printRef = useRef(null);

  useEffect(() => {
    const loader = type === 'sales' ? api.getSale : api.getPurchase;
    loader(id)
      .then(setRecord)
      .catch((err) => setStatus(err.message));
  }, [type, id]);

  const handlePrint = () => {
    const source = printRef.current;
    if (!source) { window.print(); return; }
    const clone = source.cloneNode(true);
    clone.classList.add('print-clone');
    document.body.appendChild(clone);
    const cleanup = () => {
      if (document.body.contains(clone)) document.body.removeChild(clone);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const isSale = type === 'sales';
  const label = isSale ? 'Sale' : 'Purchase';
  const dateValue = isSale ? record?.saleDate : record?.purchaseDate;
  const items = record?.PurchaseItems || record?.SaleItems || [];
  const totalReceived = isSale
    ? Number(record?.amountReceived ?? (record?.status === 'paid' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const totalPaid = !isSale
    ? Number(record?.amountReceived ?? (record?.status === 'received' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const dueAmount = Number(
    record?.dueAmount ??
      Math.max(Number(record?.grandTotal || 0) - (isSale ? totalReceived : totalPaid), 0)
  );

  const logoSrc = biz.logoUrl
    ? biz.logoUrl.startsWith('http') ? biz.logoUrl : `${API_BASE}${biz.logoUrl}`
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="btn-ghost" to={type === 'sales' ? '/app/sales' : '/app/purchases'}>
          ← Back
        </Link>
        <button className="btn-primary" type="button" onClick={handlePrint}>
          Download PDF
        </button>
      </div>
      {status ? <Notice title={status} tone="error" /> : null}
      {record ? (
        <div ref={printRef} className="print-area card space-y-6 print:shadow-none print:border-none">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200/70 pb-6 dark:border-slate-800/70">
            {/* Company info */}
            <div className="flex items-start gap-4">
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt="Logo"
                  className="h-14 w-14 rounded-xl object-contain border border-slate-200 bg-white p-0.5"
                />
              )}
              <div>
                <h1 className="font-serif text-2xl text-slate-900 dark:text-white">
                  {biz.companyName || 'ManageMyShop'}
                </h1>
                {biz.address && (
                  <p className="mt-0.5 text-xs text-slate-500 whitespace-pre-wrap">{biz.address}</p>
                )}
                {(biz.phone || biz.email) && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[biz.phone, biz.email].filter(Boolean).join(' · ')}
                  </p>
                )}
                {biz.panVat && (
                  <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                    PAN/VAT: {biz.panVat}
                  </p>
                )}
              </div>
            </div>
            {/* Invoice meta */}
            <div className="text-right shrink-0">
              <p className="text-xs uppercase text-slate-400">{label} Invoice</p>
              <p className="font-bold text-slate-900 dark:text-white">#{record.invoiceNo || record.id.slice(0, 8)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDate(dateValue)}</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                record.status === 'paid' || record.status === 'received'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>{record.status}</span>
            </div>
          </div>

          {/* Customer / Supplier + Notes */}
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">{isSale ? 'Customer' : 'Supplier'}</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {isSale
                  ? record.partyName || record.customerName || record.Customer?.name || 'Walk-in'
                  : record.partyName || record.supplierName || record.Party?.name || '—'}
              </p>
            </div>
            {record.notes && (
              <div>
                <p className="text-xs uppercase text-slate-400">Notes</p>
                <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{record.notes}</p>
              </div>
            )}
          </div>

          {/* Line items */}
          <div>
            <p className="mb-2 text-xs uppercase text-slate-400">Line Items</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70 dark:border-slate-800/70">
              <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 px-4 text-left">Product</th>
                    <th className="py-2 px-4 text-right">Qty</th>
                    <th className="py-2 px-4 text-right">Unit Price</th>
                    <th className="py-2 px-4 text-right">Tax %</th>
                    <th className="py-2 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={5} className="py-3 px-4 text-slate-500">No line items.</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                        <td className="py-2.5 px-4">{item.Product?.name || item.description || '—'}</td>
                        <td className="py-2.5 px-4 text-right">{Number(item.quantity || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right">Rs {Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right">{Number(item.taxRate || 0).toFixed(2)}%</td>
                        <td className="py-2.5 px-4 text-right font-semibold">Rs {Number(item.lineTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 dark:border-slate-800/60 dark:bg-slate-900/40">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>Rs {Number(record.subTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Tax</span>
                <span>Rs {Number(record.taxTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/70 pt-2 font-bold text-slate-900 dark:border-slate-700/60 dark:text-white">
                <span>Grand Total</span>
                <span className="text-lg">Rs {Number(record.grandTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                <span>{isSale ? 'Amount Received' : 'Amount Paid'}</span>
                <span className="font-semibold">
                  Rs {isSale ? totalReceived.toFixed(2) : totalPaid.toFixed(2)}
                </span>
              </div>
              {dueAmount > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                  <span className="font-semibold">Due Amount</span>
                  <span className="font-bold">Rs {dueAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200/70 pt-4 text-center text-xs text-slate-400 dark:border-slate-800/70">
            <p>Thank you for your business!</p>
            <p className="mt-1">Printed on {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
