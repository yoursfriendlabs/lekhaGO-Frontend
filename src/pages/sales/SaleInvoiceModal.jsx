import { useRef, useState } from 'react';
import InvoiceHeader from "@/components/layout/InvoiceHeader";
import ThermalReceipt from "@/components/print/ThermalReceipt";
import DateDisplay from "@/components/form/DateDisplay.jsx";
import { getCreatorDisplayName } from "@/lib/records";
import { printElement, printThermalReceipt } from "@/lib/print/print";
import { getIrdReprintLabel } from "@/lib/compliance/ird";
import dayjs from "@/lib/dates/datetime";

export default function SaleInvoiceModal({
  sale,
  bizSettings,
  onClose,
  onReprinted,
  t,
  money,
  initialThermal = false,
}) {
  const [isThermal, setIsThermal] = useState(initialThermal);
  const printRef = useRef(null);
  const thermalPrintRef = useRef(null);

  if (!sale) return null;

  const isIrdLocked = sale.irdStatus === "locked" || sale.ird?.locked;
  const reprintLabel = getIrdReprintLabel(sale);

  const trackReprint = async () => {
    if (!sale?.id || !isIrdLocked) return;
    try {
      const updated = await apiRecordSaleReprint(sale.id);
      onReprinted?.(updated);
    } catch {
      // Printing already happened; tracking failure should not block the user.
    }
  };

  const handlePrint = async () => {
    printElement(printRef.current, {
      prepareClone: (clone) => {
        clone.style.minWidth = "initial";
        clone.style.width = "100%";
        clone.classList.remove("min-w-[650px]");
      },
    });
    await trackReprint();
  };

  const handlePrintThermal = async () => {
    printThermalReceipt(thermalPrintRef.current);
    await trackReprint();
  };

  const totalReceived =
    Number(sale.amountReceived ?? (sale.status === "paid" ? sale.grandTotal : 0) ?? 0) || 0;
  const dueAmount = Number(
    sale.dueAmount ??
      Math.max(Number(sale.grandTotal || 0) - totalReceived, 0),
  );

  const items = sale.SaleItems || [];
  const partyName =
    sale.partyName ||
    sale.customerName ||
    sale.Customer?.name ||
    sale.attributes?.customer_name ||
    "Walk-in Customer";
  const creatorName = getCreatorDisplayName(sale);
  const dateValue = sale.saleDate;

  const normalizedStatus = String(sale.status || "").toLowerCase();
  const isPaid = normalizedStatus === "paid" || normalizedStatus === "received";
  const isCancelled = ["cancelled", "canceled", "void"].includes(normalizedStatus);
  const statusColor = isCancelled
    ? "bg-secondary-200 text-ink-light dark:bg-slate-700/60 dark:text-slate-200"
    : isPaid
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pb-10 backdrop-blur-sm print:relative print:inset-auto print:overflow-visible print:bg-transparent print:p-0">
      <div className="relative mt-4 w-full max-w-3xl md:mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              ← Close
            </button>
            <button
              type="button"
              className={`btn ${!isThermal ? "btn-primary bg-primary text-white hover:bg-primary-600" : "btn-secondary"}`}
              onClick={() => setIsThermal(false)}
            >
              Standard Service Bill
            </button>
            <button
              type="button"
              className={`btn ${isThermal ? "btn-primary bg-primary text-white hover:bg-primary-600" : "btn-secondary"}`}
              onClick={() => setIsThermal(true)}
            >
              Thermal Print
            </button>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={isThermal ? handlePrintThermal : handlePrint}
          >
            {isThermal ? "Print Thermal" : "Download PDF"}
          </button>
        </div>

        {isThermal ? (
          <div className="mx-auto max-w-[340px] overflow-hidden rounded-2xl border border-secondary-200 bg-white p-6 text-black shadow-sm">
            <div ref={thermalPrintRef}>
              <ThermalReceipt
                biz={bizSettings}
                receiptType="Sales Receipt"
                invoiceNo={sale.invoiceNo || sale.id?.slice(0, 8)}
                date={<DateDisplay date={dateValue} format="MMMM D, YYYY" mode="inline" />}
                partyName={partyName}
                creatorName={creatorName}
                tableName={sale.Table?.name || sale.table?.name || sale.attributes?.table_no}
                items={items.map((item) => ({
                  description: item.Product?.name || item.description || "—",
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  lineTotal: item.lineTotal,
                }))}
                totals={{
                  subTotal: sale.subTotal,
                  taxTotal: sale.taxTotal,
                  discountTotal: sale.discountTotal,
                  grandTotal: sale.grandTotal,
                  amountReceived: totalReceived,
                  dueAmount: dueAmount,
                }}
                notes={sale.notes}
                reprintLabel={reprintLabel}
              />
            </div>
          </div>
        ) : (
          <div className="print-area max-h-[78vh] overflow-y-auto rounded-3xl border border-secondary-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950">
            <div
              ref={printRef}
              className="bg-white p-6 text-black sm:p-8"
            >
              <div className="border-b-2 border-black pb-4">
                <InvoiceHeader
                  biz={bizSettings}
                  invoiceType="Sales Bill"
                  invoiceNo={sale.invoiceNo || sale.id?.slice(0, 8)}
                  date={<DateDisplay date={dateValue} format="MMMM D, YYYY" mode="inline" />}
                  status={sale.status}
                  statusColor={statusColor}
                  reprintLabel={reprintLabel}
                />
              </div>

              <div className="grid grid-cols-2 gap-6 border-b border-slate-300 py-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-700">Bill To</p>
                  <p className="mt-1 font-semibold">{partyName}</p>
                  {sale.partyPhone ? <p className="mt-0.5">{sale.partyPhone}</p> : null}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-secondary-700">Details</p>
                  <p className="mt-1">Created By: {creatorName}</p>
                  {(sale.Table || sale.table || sale.tableId || sale.attributes?.table_no) && (
                    <p className="mt-1">
                      Table: {sale.Table?.name || sale.table?.name || sale.attributes?.table_no}
                    </p>
                  )}
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
                          {item.Product?.name || item.description || "—"}
                          {item.Product?.companyName ? <span className="ml-2 text-xs">({item.Product.companyName})</span> : null}
                        </td>
                        <td className="py-2 text-right">{Number(item.quantity || 0).toFixed(2)}</td>
                        <td className="py-2 text-right">{money(item.unitPrice)}</td>
                        <td className="py-2 text-right">{Number(item.taxRate || 0) > 0 ? `${Number(item.taxRate).toFixed(1)}%` : "—"}</td>
                        <td className="py-2 text-right font-semibold">{money(item.lineTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
                {Number(sale.subTotal || 0) > 0 ? (
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subTotal)}</span></div>
                ) : null}
                {Number(sale.taxTotal || 0) > 0 ? (
                  <div className="flex justify-between"><span>Tax</span><span>{money(sale.taxTotal)}</span></div>
                ) : null}
                {Number(sale.discountTotal || sale.discount || 0) > 0 ? (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Discount</span>
                    <span>-{money(sale.discountTotal || sale.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-black pt-2 text-base font-bold">
                  <span>Grand Total</span><span>{money(sale.grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Received</span>
                  <span>{money(totalReceived)}</span>
                </div>
                {dueAmount > 0 ? (
                  <div className="flex justify-between font-bold">
                    <span>Due Amount</span><span>{money(dueAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-slate-300 pt-3 text-xs">
                <span>Thank you for your business!</span>
                <span>Printed {dayjs().format("D MMM YYYY")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function apiRecordSaleReprint(id) {
  // lazy import to avoid circular dependency at module load
  return import("@/lib/api").then(({ api }) => api.recordSaleReprint(id));
}
