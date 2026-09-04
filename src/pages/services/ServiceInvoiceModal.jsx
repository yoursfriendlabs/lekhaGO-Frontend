import DateDisplay from "@/components/form/DateDisplay.jsx";
import InvoiceHeader from "@/components/layout/InvoiceHeader";
import ThermalReceipt from "@/components/print/ThermalReceipt";
import { getCreatorDisplayName } from "@/lib/records";
import dayjs from "@/lib/dates/datetime";
import { AttachmentStrip } from "./ServiceOrderAttachments.jsx";

export default function ServiceInvoiceModal({
  bizSettings,
  handlePrint,
  handlePrintThermal,
  invoiceAttachmentUrls,
  invoiceExtraAttributes,
  invoiceItems,
  invoiceJewellery,
  invoiceLoading,
  invoiceOrder,
  invoicePrintRef,
  invoiceReprintLabel,
  invoiceTotals,
  isGym,
  isThermalInvoice,
  money,
  openLightbox,
  safeAttributeDefs,
  setInvoiceOrder,
  setIsThermalInvoice,
  showGoldJewelleryDetails,
  t,
  thermalInvoicePrintRef
}) {
  if (!invoiceOrder) return null;

  return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pb-10 backdrop-blur-sm print:relative print:inset-auto print:overflow-visible print:bg-transparent print:p-0">
          <div className="relative mt-4 w-full max-w-3xl md:mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setInvoiceOrder(null)}
                >
                  ← Close
                </button>
                <button
                  type="button"
                  className={`btn ${!isThermalInvoice ? 'btn-primary bg-primary text-white hover:bg-primary-600' : 'btn-secondary'}`}
                  onClick={() => setIsThermalInvoice(false)}
                >
                  Standard Service Bill
                </button>
                <button
                  type="button"
                  className={`btn ${isThermalInvoice ? 'btn-primary bg-primary text-white hover:bg-primary-600' : 'btn-secondary'}`}
                  onClick={() => setIsThermalInvoice(true)}
                >
                  Thermal Print
                </button>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={isThermalInvoice ? handlePrintThermal : handlePrint}
              >
                {isThermalInvoice ? "Print Thermal" : "Download PDF"}
              </button>
            </div>
            {invoiceLoading ? (
              <div className="card flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : isThermalInvoice ? (
              <div className="mx-auto max-w-[340px] overflow-hidden rounded-2xl border border-secondary-200 bg-white p-6 text-black shadow-sm">
                <div ref={thermalInvoicePrintRef}>
                  <ThermalReceipt
                    biz={bizSettings}
                    receiptType="Service Receipt"
                    invoiceNo={invoiceOrder.orderNo || invoiceOrder.id?.slice(0, 8)}
                    date={
                      invoiceOrder.status !== "closed" && invoiceOrder.deliveryDate ? (
                        <span className="inline-flex items-center gap-1">
                          {isGym ? "Expiry Date: " : ""}
                          <DateDisplay date={invoiceOrder.deliveryDate} format="MMMM D, YYYY" mode="inline" />
                        </span>
                      ) : (
                        <DateDisplay date={invoiceOrder.createdAt} format="MMMM D, YYYY" mode="inline" />
                      )
                    }
                    partyName={invoiceOrder.Party?.name || invoiceOrder.partyName || "—"}
                    creatorName={getCreatorDisplayName(invoiceOrder)}
                    items={invoiceItems.map(item => ({
                      description: item.description || item.productName || "—",
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      lineTotal: item.lineTotal,
                    }))}
                    totals={{
                      subTotal: invoiceTotals.subTotal,
                      taxTotal: invoiceTotals.taxTotal,
                      discountTotal: invoiceTotals.discountTotal,
                      grandTotal: invoiceTotals.grandTotal,
                      amountReceived: invoiceOrder.receivedTotal,
                      dueAmount: Math.max(Number(invoiceTotals.grandTotal || 0) - Number(invoiceOrder.receivedTotal || 0), 0),
                    }}
                    notes={invoiceOrder.notes}
                    extraFields={[
                      ...(invoiceJewellery.metalType ? [{ label: "Metal", value: invoiceJewellery.metalType }] : []),
                      ...(invoiceJewellery.metalPurity ? [{ label: "Purity", value: invoiceJewellery.metalPurity }] : []),
                      ...(invoiceJewellery.actualWeight ? [{ label: "Actual weight", value: invoiceJewellery.actualWeight }] : []),
                      ...(invoiceJewellery.totalWeight ? [{ label: "Total weight", value: invoiceJewellery.totalWeight }] : []),
                      ...(invoiceJewellery.diamondType ? [{ label: "Diamond", value: invoiceJewellery.diamondType }] : []),
                      ...invoiceExtraAttributes.map(([key, val]) => {
                        const def = safeAttributeDefs.find((d) => d.key === key);
                        const attrLabel = def?.name || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        return { label: attrLabel, value: String(val || "—") };
                      }),
                    ]}
                    reprintLabel={invoiceReprintLabel}
                  />
                </div>
              </div>
            ) : (
              <div
                ref={invoicePrintRef}
                className="print-area overflow-hidden rounded-3xl border border-secondary-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950"
              >
                {/* ── Header ── */}
                <div className="px-4 pt-0 sm:px-8">
                  <InvoiceHeader
                    biz={bizSettings}
                    invoiceType="Service Invoice"
                    invoiceNo={
                      invoiceOrder.orderNo || invoiceOrder.id?.slice(0, 8)
                    }
                    date={
                      invoiceOrder.status !== "closed" && invoiceOrder.deliveryDate ? (
                        <span className="inline-flex items-center gap-1">
                          {isGym ? "Expiry Date: " : ""}
                          <DateDisplay date={invoiceOrder.deliveryDate} format="MMMM D, YYYY" mode="inline" />
                        </span>
                      ) : (
                        <DateDisplay date={invoiceOrder.createdAt} format="MMMM D, YYYY" mode="inline" />
                      )
                    }
                    // status={invoiceOrder.status}
                    statusColor={
                      invoiceOrder.status === "closed"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : invoiceOrder.status === "in_progress"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    }
                    reprintLabel={invoiceReprintLabel}
                  />
                </div>

                {/* ── Customer + Attributes ── */}
                <div className="border-b border-secondary-200/70 bg-mist/60 px-4 py-5 dark:border-slate-800/70 dark:bg-slate-900/30 sm:px-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink">
                        Bill To
                      </p>
                      <p className="font-semibold text-ink">
                        {invoiceOrder.Party?.name ||
                          invoiceOrder.partyName ||
                          "—"}
                      </p>
                      {invoiceOrder.Party?.phone && (
                        <p className="mt-0.5 text-sm text-ink">
                          {invoiceOrder.Party?.phone}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-ink">
                        Created By:{" "}
                        <span className="font-medium text-ink">
                          {getCreatorDisplayName(invoiceOrder)}
                        </span>
                      </p>
                    </div>
                  </div>
                  {showGoldJewelleryDetails &&
                    (invoiceJewellery.metalType ||
                      invoiceJewellery.metalPurity ||
                      invoiceJewellery.actualWeight ||
                      invoiceJewellery.wastagePercent ||
                      invoiceJewellery.totalWeight ||
                      invoiceJewellery.diamondType ||
                      invoiceJewellery.diamondWeight ||
                      invoiceJewellery.diamondCarat ||
                      invoiceJewellery.diamondCharge) && (
                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                        {invoiceJewellery.metalType ? (
                          <div className="text-sm">
                            <span className="text-black">Metal: </span>
                            <span className="font-medium text-black">
                              {invoiceJewellery.metalType}
                            </span>
                          </div>
                        ) : null}
                        {invoiceJewellery.metalPurity ? (
                          <div className="text-sm">
                            <span className="text-black">Purity: </span>
                            <span className="font-medium text-black">
                              {invoiceJewellery.metalPurity}
                            </span>
                          </div>
                        ) : null}
                        {invoiceJewellery.actualWeight ? (
                          <div className="text-sm">
                            <span className="text-black">Actual weight: </span>
                            <span className="font-medium text-black">
                              {invoiceJewellery.actualWeight}
                            </span>
                          </div>
                        ) : null}
                        {invoiceJewellery.wastagePercent ? (
                          <div className="text-sm">
                            <span className="text-ink">Wastage: </span>
                            <span className="font-medium text-black">
                              {invoiceJewellery.wastagePercent}% (
                              {invoiceJewellery.wastageWeight || "0"})
                            </span>
                          </div>
                        ) : null}
                        {invoiceJewellery.totalWeight ? (
                          <div className="text-sm">
                            <span className="text-ink">
                              Total weight:{" "}
                            </span>
                            <span className="font-medium text-black">
                              {invoiceJewellery.totalWeight}
                            </span>
                          </div>
                        ) : null}
                        {invoiceJewellery.diamondType ? (
                          <div className="text-sm">
                            <span className="text-ink">Diamond: </span>
                            <span className="font-medium text-black">
                              {[
                                invoiceJewellery.diamondType,
                                invoiceJewellery.diamondWeight &&
                                  `${invoiceJewellery.diamondWeight} wt`,
                                invoiceJewellery.diamondCarat &&
                                  `${invoiceJewellery.diamondCarat} ct`,
                                invoiceJewellery.diamondPurity,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  {invoiceExtraAttributes.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                      {invoiceExtraAttributes.map(([key, val]) => {
                        const def = safeAttributeDefs.find(
                          (d) => d.key === key,
                        );
                        const attrLabel =
                          def?.name ||
                          key
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <div key={key} className="text-sm">
                            <span className="text-ink">
                              {attrLabel}:{" "}
                            </span>
                            <span className="font-mediblack">
                              {String(val || "—")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Line Items ── */}
                <div className="overflow-x-auto px-4 py-6 sm:px-8">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead>
                      <tr className="border-b-2 border-secondary-200/70 dark:border-slate-700/70">
                        <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-black">
                          Item
                        </th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-black">
                          Qty
                        </th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-black">
                          Rate
                        </th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-black">
                          {t("services.tax")}
                        </th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-black">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {invoiceItems.map((item, idx) => (
                        <tr
                          key={`${item.productId || item.description || "service"}-${idx}`}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.itemType === "labor" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"}`}
                              >
                                {item.itemType === "labor"
                                  ? "Service"
                                  : "Product"}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-black">
                                  {item.description || item.productName || "—"}
                                </p>
                                {item.productName &&
                                  item.description &&
                                  item.description !== item.productName && (
                                    <p className="truncate text-xs text-secondary-500">
                                      {item.productName}
                                    </p>
                                  )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-right text-ink">
                            {Number(item.quantity || 0).toFixed(
                              item.quantity % 1 ? 3 : 0,
                            )}
                          </td>
                          <td className="py-3 text-right text-black">
                            {money(item.unitPrice)}
                          </td>
                          <td className="py-3 text-right text-black">
                            {Number(item.taxRate || 0).toFixed(2)}%
                          </td>
                          <td className="py-3 text-right font-semibold text-black">
                            {money(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Totals ── */}
                <div className="border-t border-secondary-200/70 px-4 py-6 sm:px-8">
                  <div className="ml-auto max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between text-black">
                      <span>{t("services.subTotal")}</span>
                      <span>{money(invoiceTotals.subTotal)}</span>
                    </div>
                    <div className="flex justify-between text-black">
                      <span>Service Total</span>
                      <span>{money(invoiceTotals.laborTotal)}</span>
                    </div>
                    <div className="flex justify-between text-black">
                      <span>Product Total</span>
                      <span>{money(invoiceTotals.partsTotal)}</span>
                    </div>
                    {showGoldJewelleryDetails &&
                    invoiceJewellery.diamondChargeNumber > 0 ? (
                      <div className="flex justify-between text-black">
                        <span>Diamond Charge</span>
                        <span>
                          {money(invoiceJewellery.diamondChargeNumber)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-black">
                      <span>{t("services.taxTotal")}</span>
                      <span>{money(invoiceTotals.taxTotal)}</span>
                    </div>
                    {showGoldJewelleryDetails &&
                    invoiceJewellery.additionalTaxNumber > 0 ? (
                      <div className="flex justify-between text-black">
                        <span>Additional Tax</span>
                        <span>
                          {money(invoiceJewellery.additionalTaxNumber)}
                        </span>
                      </div>
                    ) : null}
                    {Number(invoiceTotals.discountTotal || 0) > 0 ? (
                      <div className="flex justify-between text-rose-600 dark:text-rose-300">
                        <span>{t("services.discount")}</span>
                        <span>-{money(invoiceTotals.discountTotal)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-secondary-200/70 pt-3 font-bold text-black dark:border-slate-700 dark:text-white">
                      <span className="text-base">
                        {t("services.grandTotal")}
                      </span>
                      <span className="text-lg">
                        {money(invoiceTotals.grandTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>{t("services.amountReceived")}</span>
                      <span className="font-semibold">
                        {money(invoiceOrder.receivedTotal)}
                      </span>
                    </div>
                    {Math.max(
                      Number(invoiceTotals.grandTotal || 0) -
                        Number(invoiceOrder.receivedTotal || 0),
                      0,
                    ) > 0 && (
                      <div className="flex justify-between rounded-xl bg-rose-50 px-4 py-2.5 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                        <span className="font-semibold">
                          {t("services.dueAmount")}
                        </span>
                        <span className="font-bold">
                          {money(
                            Math.max(
                              Number(invoiceTotals.grandTotal || 0) -
                                Number(invoiceOrder.receivedTotal || 0),
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Attachment ── */}
                {invoiceAttachmentUrls.length > 0 && (
                  <div className="border-t border-secondary-200/70 px-4 py-5 dark:border-slate-800/70 sm:px-8">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-black">
                      Attachment
                    </p>
                    <AttachmentStrip
                      urls={invoiceAttachmentUrls}
                      onOpen={openLightbox}
                      maxVisible={4}
                      size="lg"
                    />
                  </div>
                )}

                {/* ── Footer ── */}
                <div className="flex items-center justify-between border-t border-secondary-200/70 bg-mist/60 px-4 py-4 dark:border-slate-800/70 dark:bg-slate-900/30 sm:px-8">
                  <p className="text-xs text-black">
                    Thank you for your business!
                  </p>
                  <p className="text-xs text-black">
                    Printed {dayjs().format("D MMM YYYY")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
  );
}
