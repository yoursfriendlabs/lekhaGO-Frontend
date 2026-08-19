import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import { getIrdReprintLabel, isIrdLocked } from '../lib/ird';
import InvoiceHeader from '../components/InvoiceHeader';
import Notice from '../components/Notice';
import { formatCurrency } from '../lib/currency';
import { getCreatorDisplayName } from '../lib/records';
import { printElement, printThermalReceipt } from '../lib/print';
import dayjs, { formatMaybeDate } from '../lib/datetime';
import ThermalReceipt from '../components/ThermalReceipt';
import DateDisplay from '../components/DateDisplay.jsx';

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
  const thermalPrintRef = useRef(null);

  useEffect(() => {
    const loader = type === 'sales' ? api.getSale : api.getPurchase;
    loader(id).then(setRecord).catch((err) => setStatus(err.message));
  }, [type, id]);

  const isSale = type === 'sales';
  const isPrintBillView = searchParams.get('print') === '1';
  const isThermalView = searchParams.get('thermal') === '1';
  const dateValue = isSale ? record?.saleDate : record?.purchaseDate;
  const items = record?.PurchaseItems || record?.SaleItems || [];
  const isLockedInvoice = isIrdLocked(record);
  // First print of a locked invoice stays unlabeled (original). Later prints show Copy of Original – N.
  const reprintLabel = getIrdReprintLabel(record);

  const trackReprintAfterPrint = async () => {
    if (!id || !isLockedInvoice) return;
    try {
      const updated = isSale
        ? await api.recordSaleReprint(id)
        : await api.recordPurchaseReprint(id);
      setRecord(updated);
    } catch {
      // Printing already happened; tracking failure should not block the user.
    }
  };

  const handlePrint = async () => {
    printElement(printRef.current, {
      prepareClone: (clone) => {
        clone.style.minWidth = 'initial';
        clone.style.width = '100%';
        clone.classList.remove('min-w-[650px]');
      }
    });
    await trackReprintAfterPrint();
  };

  const handlePrintThermal = async () => {
    printThermalReceipt(thermalPrintRef.current);
    await trackReprintAfterPrint();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${isSale ? 'Sales' : 'Purchase'} Invoice ${record?.invoiceNo || record?.id?.slice(0, 8)}`,
          text: `Invoice for ${partyName}. Grand Total: ${money(record?.grandTotal)}`,
          url: window.location.href,
        });
      } catch (err) {
        // user cancelled or share failed, ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('Invoice link copied to clipboard!');
      } catch (err) {
        console.error('Clipboard copy error:', err);
      }
    }
  };

  const totalReceived = isSale
    ? Number(record?.amountReceived ?? (record?.status === 'paid' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const totalPaid = !isSale
    ? Number(record?.amountReceived ?? (record?.status === 'received' ? record?.grandTotal : 0) ?? 0)
    : 0;
  const dueAmount = Number(
    record?.dueAmount ?? Math.max(Number(record?.grandTotal || 0) - (isSale ? totalReceived : totalPaid), 0)
  );

  const normalizedStatus = String(record?.status || '').toLowerCase();
  const isPaidOrReceived = normalizedStatus === 'paid' || normalizedStatus === 'received';
  const isCancelledStatus = ['cancelled', 'canceled', 'void'].includes(normalizedStatus);
  const statusColor = isCancelledStatus
    ? 'bg-secondary-200 text-ink-light dark:bg-slate-700/60 dark:text-slate-200'
    : isPaidOrReceived
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';

const partyName = isSale
    ? record?.partyName ||
      record?.customerName ||
      record?.Customer?.name ||
      record?.attributes?.customer_name ||
      'Walk-in Customer'
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
          {!isPrintBillView && !isThermalView && (
            <>
              <Link className="btn-secondary" to={`/app/invoice/${type}/${id}?print=1`}>
                Print Preview
              </Link>
              <Link className="btn-secondary" to={`/app/invoice/${type}/${id}?thermal=1`}>
                Thermal Preview
              </Link>
            </>
          )}
          {(isPrintBillView || isThermalView) && (
            <Link className="btn-secondary" to={`/app/invoice/${type}/${id}`}>
              View Bill
            </Link>
          )}
          <button className="btn-secondary flex items-center gap-1.5" type="button" onClick={handleShare}>
            <Share2 size={15} className="shrink-0" />
            Share
          </button>
          {isThermalView ? (
            <button className="btn-primary" type="button" onClick={handlePrintThermal}>
              Print Thermal
            </button>
          ) : (
            <button className="btn-primary" type="button" onClick={handlePrint}>
              Print Bill
            </button>
          )}
        </div>
      </div>

      {status ? <Notice title={status} tone="error" /> : null}

      {record ? (
        <>
        <div className={`${(isPrintBillView || isThermalView) ? 'hidden' : ''} overflow-hidden rounded-3xl border border-secondary-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950`}>
          {/* ── Header ── */}
          <div className="px-8 pt-0">
            <InvoiceHeader
              biz={biz}
              invoiceType={isSale ? 'Sales Invoice' : 'Purchase Invoice'}
              invoiceNo={record.invoiceNo || record.id.slice(0, 8)}
              date={<DateDisplay date={dateValue} format="MMMM D, YYYY" mode="inline" />}
              status={record.status}
              statusColor={statusColor}
              reprintLabel={reprintLabel}
            />
          </div>

          {/* ── Bill To / From + Notes ── */}
          <div className="grid gap-6 px-8 py-6 sm:grid-cols-2 bg-mist/60 dark:bg-slate-900/30 border-b border-secondary-200/70">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-secondary-400">
                {isSale ? 'Bill To' : 'Supplier'}
              </p>
<p className="font-semibold text-ink dark:text-slate-200">{partyName}</p>
              {(record.partyPhone || record.attributes?.customer_phone) && (
                <p className="mt-0.5 text-sm text-secondary-500">
                  {record.partyPhone || record.attributes?.customer_phone}
                </p>
              )}
              <p className="mt-2 text-sm text-secondary-500">
                Created By:{' '}
                <span className="font-medium text-ink-light dark:text-secondary-300">{creatorName}</span>
              </p>
              {(record.Table || record.table || record.tableId || record.attributes?.table_no) && (
                <p className="mt-1 text-sm text-secondary-500">
                  Table:{' '}
                  <span className="font-semibold text-ink-light dark:text-secondary-300">
                    {record.Table?.name || record.table?.name || record.attributes?.table_no}
                  </span>
                </p>
              )}
            </div>
            {record.notes && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-secondary-400">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-secondary-700 dark:text-secondary-400">{record.notes}</p>
              </div>
            )}
          </div>

          {/* ── Line Items ── */}
          <div className="px-4 py-6 sm:px-8">
            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-sm min-w-[550px] sm:min-w-0">
                <thead>
                  <tr className="border-b-2 border-secondary-200/70 dark:border-slate-700/70">
                    <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-ink">Product</th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-ink">Qty</th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-ink">Unit Price</th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-ink">Tax</th>
                    <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-ink">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-secondary-400">No line items.</td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="py-3 pr-4 font-medium text-ink dark:text-slate-200">
                          {item.Product?.name || item.description || '—'}
                          {item.Product?.companyName && (
                            <span className="ml-2 text-xs text-secondary-400">{item.Product.companyName}</span>
                          )}
                        </td>
                        <td className="py-3 text-right text-secondary-700 dark:text-secondary-400">
                          {Number(item.quantity || 0).toFixed(2)}
                        </td>
                        <td className="py-3 text-right text-secondary-700 dark:text-secondary-400">
                          {money(item.unitPrice)}
                        </td>
                        <td className="py-3 text-right text-secondary-500">
                          {Number(item.taxRate || 0) > 0 ? `${Number(item.taxRate).toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-3 text-right font-semibold text-ink dark:text-slate-200">
                          {money(item.lineTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="border-t border-secondary-200/70 px-8 py-6">
            <div className="ml-auto max-w-xs space-y-2 text-sm">
              {Number(record.subTotal || 0) > 0 && (
                <div className="flex justify-between text-secondary-500">
                  <span>Subtotal</span>
                  <span>{money(record.subTotal)}</span>
                </div>
              )}
              {Number(record.taxTotal || 0) > 0 && (
                <div className="flex justify-between text-secondary-500">
                  <span>Tax</span>
                  <span>{money(record.taxTotal)}</span>
                </div>
              )}
              {Number(record.discountTotal || record.discount || 0) > 0 && (
                <div className="flex justify-between text-rose-600 dark:text-rose-400 font-medium">
                  <span>Discount</span>
                  <span>-{money(record.discountTotal || record.discount)}</span>
                </div>
              )}
<<<<<<< HEAD
<<<<<<< HEAD
              <div className="flex justify-between border-t border-slate-200/70 pt-3 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
=======
              <div className="flex justify-between border-t border-secondary-200/70 pt-3 font-bold text-ink dark:border-slate-700 dark:text-white">
>>>>>>> 8eae9c5815bd9dac96a1dad460647a583bfa9292
=======
              <div className="flex justify-between border-t border-secondary-200/70 pt-3 font-bold text-ink dark:border-slate-700 dark:text-white">
>>>>>>> 3c6dca05518ed734fae71c25319a5f64b2dc19d5
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
          <div className="flex items-center justify-between border-t border-secondary-200/70 bg-mist/60 px-8 py-4 dark:border-slate-800/70 dark:bg-slate-900/30">
            <p className="text-xs text-secondary-400">Thank you for your business!</p>
            <p className="text-xs text-secondary-400">
              Printed {dayjs().format('D MMM YYYY')}
            </p>
          </div>
        </div>

        {isThermalView ? (
          <div className="mx-auto max-w-[340px] overflow-hidden rounded-2xl border border-secondary-200 bg-white p-6 text-black shadow-sm">
            <div ref={thermalPrintRef}>
              <ThermalReceipt
                biz={biz}
                receiptType={isSale ? 'Sales Receipt' : 'Purchase Receipt'}
                invoiceNo={record.invoiceNo || record.id.slice(0, 8)}
                date={<DateDisplay date={dateValue} format="MMMM D, YYYY" mode="inline" />}
                partyName={partyName}
                creatorName={creatorName}
                tableName={record.Table?.name || record.table?.name || record.attributes?.table_no}
                items={items.map((item) => ({
                  description: item.Product?.name || item.description || '—',
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                }))}
                totals={{
                  subTotal: record.subTotal,
                  taxTotal: record.taxTotal,
                  discountTotal: record.discountTotal,
                  grandTotal: record.grandTotal,
                  amountReceived: totalReceived,
                  dueAmount: dueAmount,
                }}
                notes={record.notes}
                reprintLabel={reprintLabel}
              />
            </div>
          </div>
        ) : (
          <div className={isPrintBillView ? "w-full overflow-x-auto rounded-3xl border border-secondary-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950 p-2 sm:p-4" : ""}>
            <div
              ref={printRef}
              className={`${isPrintBillView ? 'min-w-[650px] bg-white p-6 text-black sm:p-8' : 'print-template bg-white p-6 text-black sm:p-8'}`}
            >
              <div className="border-b-2 border-black pb-4">
                <InvoiceHeader
                  biz={biz}
                  invoiceType={isSale ? 'Sales Bill' : 'Purchase Bill'}
                  invoiceNo={record.invoiceNo || record.id.slice(0, 8)}
                  date={<DateDisplay date={dateValue} format="MMMM D, YYYY" mode="inline" />}
                  reprintLabel={reprintLabel}
                  // status={record.status}
                  // statusColor="border border-black text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-700">
                    {isSale ? 'Bill To' : 'Supplier'}
                  </p>
                  <p className="mt-1 font-semibold">{partyName}</p>
                  {record.partyPhone ? <p className="mt-0.5">{record.partyPhone}</p> : null}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-700">Details</p>
                  <p className="mt-1">Created By: {creatorName}</p>
                  {(record.Table || record.table || record.tableId || record.attributes?.table_no) && (
                    <p className="mt-1">
                      Table: {record.Table?.name || record.table?.name || record.attributes?.table_no}
                    </p>
                  )}
                  {/* {record.notes ? <p className="mt-1 whitespace-pre-wrap">Notes: {record.notes}</p> : null} */}
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
                      <td colSpan={5} className="py-4 text-secondary-500">No line items.</td>
                    </tr>
                  ) : (
                    items.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-secondary-200">
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
                {Number(record.discountTotal || record.discount || 0) > 0 ? (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Discount</span>
                    <span>-{money(record.discountTotal || record.discount)}</span>
                  </div>
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
          </div>
        )}
        </>
      ) : null}
    </div>
  );
}
