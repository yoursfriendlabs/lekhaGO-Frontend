import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import InvoiceHeader from '../components/InvoiceHeader';
import Notice from '../components/Notice';
import { formatCurrency } from '../lib/currency';
import { getCreatorDisplayName } from '../lib/records';
import dayjs, { formatMaybeDate } from '../lib/datetime';

function fmt(dateStr) {
  return formatMaybeDate(dateStr, 'MMMM D, YYYY');
}

function money(val) {
  return formatCurrency(val);
}

export default function Invoice() {
  const { type, id } = useParams();
  const [searchParams] = useSearchParams();
  const [record, setRecord] = useState(null);
  const [status, setStatus] = useState('');
  const { settings: biz } = useBusinessSettings();
  const printRef = useRef(null);

  useEffect(() => {
    const loader = type === 'sales' ? api.getSale : api.getPurchase;
    loader(id).then(setRecord).catch((err) => setStatus(err.message));
  }, [type, id]);

  const handlePrint = () => {
    const source = printRef.current;
    if (!source) { window.print(); return; }
    const clone = source.cloneNode(true);
    clone.classList.add('print-clone');
    clone.style.cssText = '';
    document.body.appendChild(clone);
    const cleanup = () => {
      if (document.body.contains(clone)) document.body.removeChild(clone);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const isSale = type === 'sales';
  const isPrintBillView = searchParams.get('print') === '1';
  const dateValue = isSale ? record?.saleDate : record?.purchaseDate;
  const items = record?.PurchaseItems || record?.SaleItems || [];

  const totalReceived = isSale
    ? Number(record?.amountReceived ?? (record?.status === 'paid' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const totalPaid = !isSale
    ? Number(record?.amountReceived ?? (record?.status === 'received' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const dueAmount = Number(
    record?.dueAmount ?? Math.max(Number(record?.grandTotal || 0) - (isSale ? totalReceived : totalPaid), 0)
  );

  const isPaidOrReceived = record?.status === 'paid' || record?.status === 'received';
  const statusColor = isPaidOrReceived
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

  const partyName = isSale
    ? record?.partyName || record?.customerName || record?.Customer?.name || 'Walk-in Customer'
    : record?.partyName || record?.supplierName || record?.Party?.name || '—';
  const creatorName = getCreatorDisplayName(record);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Toolbar — hidden on print */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link className="btn-ghost" to={isSale ? '/app/sales' : '/app/purchases'}>
          ← Back
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            className="btn-secondary"
            to={`/app/invoice/${type}/${id}${isPrintBillView ? '' : '?print=1'}`}
          >
            {isPrintBillView ? 'View Bill' : 'Print Preview'}
          </Link>
          <button className="btn-primary" type="button" onClick={handlePrint}>
            Print Bill
          </button>
        </div>
      </div>

      {status ? <Notice title={status} tone="error" /> : null}

      {record ? (
        <>
        <div className={`${isPrintBillView ? 'hidden' : ''} overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950`}>
          {/* ── Header ── */}
          <div className="px-8 pt-0">
            <InvoiceHeader
              biz={biz}
              invoiceType={isSale ? 'Sales Invoice' : 'Purchase Invoice'}
              invoiceNo={record.invoiceNo || record.id.slice(0, 8)}
              date={fmt(dateValue)}
              status={record.status}
              statusColor={statusColor}
            />
          </div>

          {/* ── Bill To / From + Notes ── */}
          <div className="grid gap-6 px-8 py-6 sm:grid-cols-2 bg-slate-50/60 dark:bg-slate-900/30 border-b border-slate-200/70 dark:border-slate-800/70">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {isSale ? 'Bill To' : 'Supplier'}
              </p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{partyName}</p>
              {record.partyPhone && <p className="mt-0.5 text-sm text-slate-500">{record.partyPhone}</p>}
              <p className="mt-2 text-sm text-slate-500">
                Created By:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">{creatorName}</span>
              </p>
            </div>
            {record.notes && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{record.notes}</p>
              </div>
            )}
          </div>

          {/* ── Line Items ── */}
          <div className="px-8 py-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200/70 dark:border-slate-700/70">
                  <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Product</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit Price</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Tax</th>
                  <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-400">No line items.</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">
                        {item.Product?.name || item.description || '—'}
                        {item.Product?.companyName && (
                          <span className="ml-2 text-xs text-slate-400">{item.Product.companyName}</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                        {Number(item.quantity || 0).toFixed(2)}
                      </td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">
                        {money(item.unitPrice)}
                      </td>
                      <td className="py-3 text-right text-slate-500">
                        {Number(item.taxRate || 0) > 0 ? `${Number(item.taxRate).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {money(item.lineTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-8 py-6">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              {Number(record.subTotal || 0) > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>{money(record.subTotal)}</span>
                </div>
              )}
              {Number(record.taxTotal || 0) > 0 && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Tax</span>
                  <span>{money(record.taxTotal)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200/70 pt-3 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                <span className="text-base">Grand Total</span>
                <span className="text-lg">{money(record.grandTotal)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{isSale ? 'Amount Received' : 'Amount Paid'}</span>
                <span className="font-semibold">{money(isSale ? totalReceived : totalPaid)}</span>
              </div>
              {dueAmount > 0 && (
                <div className="flex justify-between rounded-xl bg-rose-50 px-4 py-2.5 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                  <span className="font-semibold">Due Amount</span>
                  <span className="font-bold">{money(dueAmount)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/60 px-8 py-4 dark:border-slate-800/70 dark:bg-slate-900/30">
            <p className="text-xs text-slate-400">Thank you for your business!</p>
            <p className="text-xs text-slate-400">
              Printed {dayjs().format('D MMM YYYY')}
            </p>
          </div>
        </div>

        <div
          ref={printRef}
          className={`${isPrintBillView ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-black shadow-sm sm:p-8' : 'print-template bg-white p-6 text-black sm:p-8'}`}
        >
          {/* <div className="border-b-2 border-black pb-4">
            <InvoiceHeader
              biz={biz}
              invoiceType={isSale ? 'Sales Bill' : 'Purchase Bill'}
              invoiceNo={record.invoiceNo || record.id.slice(0, 8)}
              date={fmt(dateValue)}
              // status={record.status}
              // statusColor="border border-black text-black"
            />
          </div> */}

          <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4 text-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {isSale ? 'Bill To' : 'Supplier'}
              </p>
              <p className="mt-1 font-semibold">{partyName}</p>
              {record.partyPhone ? <p className="mt-0.5">{record.partyPhone}</p> : null}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Details</p>
              <p className="mt-1">Created By: {creatorName}</p>
              {record.notes ? <p className="mt-1 whitespace-pre-wrap">Notes: {record.notes}</p> : null}
            </div>
          </div>

          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="py-2 text-left text-[10px] font-bold uppercase">Product</th>
                <th className="py-2 text-right text-[10px] font-bold uppercase">Qty</th>
                <th className="py-2 text-right text-[10px] font-bold uppercase">Unit Price</th>
                <th className="py-2 text-right text-[10px] font-bold uppercase">Tax</th>
                <th className="py-2 text-right text-[10px] font-bold uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">No line items.</td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-slate-200">
                    <td className="py-2 pr-4 font-medium">
                      {item.Product?.name || item.description || '—'}
                      {item.Product?.companyName ? <span className="ml-2 text-xs">({item.Product.companyName})</span> : null}
                    </td>
                    <td className="py-2 text-right">{Number(item.quantity || 0).toFixed(2)}</td>
                    <td className="py-2 text-right">{money(item.unitPrice)}</td>
                    <td className="py-2 text-right">{Number(item.taxRate || 0) > 0 ? `${Number(item.taxRate).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 text-right font-semibold">{money(item.lineTotal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
            {Number(record.subTotal || 0) > 0 ? (
              <div className="flex justify-between"><span>Subtotal</span><span>{money(record.subTotal)}</span></div>
            ) : null}
            {Number(record.taxTotal || 0) > 0 ? (
              <div className="flex justify-between"><span>Tax</span><span>{money(record.taxTotal)}</span></div>
            ) : null}
            <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
              <span>Grand Total</span><span>{money(record.grandTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>{isSale ? 'Amount Received' : 'Amount Paid'}</span>
              <span>{money(isSale ? totalReceived : totalPaid)}</span>
            </div>
            {dueAmount > 0 ? (
              <div className="flex justify-between font-bold">
                <span>Due Amount</span><span>{money(dueAmount)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-slate-300 pt-3 text-xs">
            <span>Thank you for your business!</span>
            <span>Printed {dayjs().format('D MMM YYYY')}</span>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
