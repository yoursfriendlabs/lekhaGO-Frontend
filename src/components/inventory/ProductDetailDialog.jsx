import { useCallback, useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog.tsx";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../lib/auth";
import DateDisplay from "../form/DateDisplay.jsx";
import { formatDateBoth } from "../../lib/dates/nepaliDate.js";
import {
  History,
  Layers,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import FlexibleDateInput from "../form/FlexibleDateInput.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import Notice from "../ui/Notice.jsx";
import ActionMenu from "../ui/ActionMenu.jsx";
import { isExpiryDateExpired } from "../../lib/inventory/stockAvailability.js";

function toDateInputValue(value) {
  if (!value) return "";
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function formatQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function getExpiryDateColorClass(expiryDateStr) {
  if (!expiryDateStr) return "text-secondary-500";
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();
  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 10) return "text-rose-600 dark:text-rose-400 font-semibold";
  if (diffDays <= 20) return "text-amber-600 dark:text-amber-400 font-semibold";
  return "text-emerald-600 dark:text-emerald-400 font-semibold";
}

function getExpiryRemainingDaysText(expiryDateStr, t) {
  if (!expiryDateStr) return "";
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();
  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) return t("inventory.expired") || "Expired";
  if (diffDays === 0) return t("inventory.expiresToday") || "Expires today";
  return (
    t("inventory.daysRemaining", { count: diffDays }) ||
    `${diffDays} days remaining`
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-secondary-100 py-2.5 last:border-0 dark:border-slate-800">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-secondary-400">
        {label}
      </span>
      <div className="min-w-0 text-right text-sm font-medium text-ink dark:text-slate-200">
        {children}
      </div>
    </div>
  );
}

const TABS = [
  { id: "overview", icon: Package },
  { id: "lots", icon: Layers },
  { id: "history", icon: History },
];

export default function ProductDetailDialog({
  isOpen,
  onClose,
  productId,
  productHint = null,
  initialTab = "overview",
  canManageInventory = false,
  showJewelleryFields = false,
  onEdit,
  onRestock,
  onProductUpdated,
}) {
  const { t } = useI18n();
  const { canViewFeature } = useAuth();
  const canViewPurchasePrice = canViewFeature("purchasePrice");
  const [tab, setTab] = useState(initialTab);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyPageSize = 10;
  const [exchangeLot, setExchangeLot] = useState(null);
  const [destroyLot, setDestroyLot] = useState(null);
  const [editLot, setEditLot] = useState(null);
  const [exchangeForm, setExchangeForm] = useState({
    batchNumber: "",
    expiryDate: "",
  });
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSaving, setActionSaving] = useState(false);

  const display = product || productHint || {};
  const unitLabel =
    display.primaryUnit || display.unit?.name || display.unit || "";
  const batches = Array.isArray(product?.batches) ? product.batches : [];
  const stock = Number(
    display.stockOnHand ?? display.quantity ?? display.openingStock ?? 0,
  );
  const salePrice = Number(display.salePrice ?? 0);
  const purchasePrice = Number(display.purchasePrice ?? 0);
  const nearestExpiry = toDateInputValue(display.expiryDate);
  const expiredQuantity = Number(display.expiredQuantity || 0);
  const sellableQuantity =
    display.sellableQuantity != null ? Number(display.sellableQuantity) : stock;

  const applyUpdatedProduct = (updated) => {
    if (!updated) return;
    setProduct(updated);
    onProductUpdated?.(updated);
  };

  const loadHistory = useCallback(
    async (id, pageNum = 1) => {
      if (!id) return;
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const response = await api.stockLedgerReport({
          productId: id,
          limit: historyPageSize,
          offset: (pageNum - 1) * historyPageSize,
        });
        setHistoryItems(response.items || []);
        setHistoryTotal(response.total || 0);
      } catch (err) {
        setHistoryError(
          err.message ||
            t("inventory.detail.historyLoadError") ||
            "Failed to load stock history",
        );
        setHistoryItems([]);
        setHistoryTotal(0);
      } finally {
        setHistoryLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab || "overview");
    setHistoryPage(1);
    setHistoryItems([]);
    setHistoryError("");
    setError("");
    setProduct(null);
    setExchangeLot(null);
    setDestroyLot(null);
    setEditLot(null);
    setActionError("");
    setExchangeForm({ batchNumber: "", expiryDate: "" });
    setEditExpiryDate("");

    if (!productId) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await api.getProduct(productId);
        if (!cancelled) setProduct(detail);
      } catch (err) {
        if (!cancelled)
          setError(
            err.message ||
              t("inventory.detail.loadError") ||
              "Failed to load product",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId, initialTab, t]);

  useEffect(() => {
    if (!isOpen || tab !== "history" || !productId) return;
    loadHistory(productId, historyPage);
  }, [isOpen, tab, productId, historyPage, loadHistory]);

  const tabLabels = {
    overview: t("inventory.detail.overview") || "Details",
    lots: t("inventory.detail.lots") || "Stock lots",
    history: t("inventory.detail.history") || "History",
  };

  const openExchange = (batch) => {
    setActionError("");
    setDestroyLot(null);
    setEditLot(null);
    setExchangeLot(batch);
    setExchangeForm({ batchNumber: "", expiryDate: "" });
  };

  const openEditLot = (batch) => {
    setActionError("");
    setExchangeLot(null);
    setDestroyLot(null);
    setEditLot(batch);
    setEditExpiryDate(toDateInputValue(batch?.expiryDate));
  };

  const handleEditLotSubmit = async (event) => {
    event.preventDefault();
    if (!productId || !editLot?.id || actionSaving) return;
    try {
      setActionSaving(true);
      setActionError("");
      const response = await api.updateProductBatch(productId, editLot.id, {
        expiryDate: toDateInputValue(editExpiryDate) || null,
      });
      applyUpdatedProduct(response?.product || response);
      setEditLot(null);
      setHistoryPage(1);
      if (tab === "history") loadHistory(productId, 1);
    } catch (err) {
      setActionError(err.message || t("inventory.editLotTitle"));
    } finally {
      setActionSaving(false);
    }
  };

  const handleExchangeSubmit = async (event) => {
    event.preventDefault();
    if (!productId || !exchangeLot?.id || actionSaving) return;
    const batchNumber = String(exchangeForm.batchNumber || "").trim();
    const expiryDate = toDateInputValue(exchangeForm.expiryDate);
    if (!batchNumber || !expiryDate || isExpiryDateExpired(expiryDate)) {
      setActionError(
        t("inventory.exchangeRequired") ||
          "Enter a new batch number and a future expiry date.",
      );
      return;
    }
    try {
      setActionSaving(true);
      setActionError("");
      const response = await api.exchangeProductBatch(
        productId,
        exchangeLot.id,
        {
          batchNumber,
          expiryDate,
        },
      );
      applyUpdatedProduct(response?.product || response);
      setExchangeLot(null);
      setHistoryPage(1);
      if (tab === "history") loadHistory(productId, 1);
    } catch (err) {
      setActionError(err.message || t("inventory.exchangeRequired"));
    } finally {
      setActionSaving(false);
    }
  };

  const handleDestroyConfirm = async () => {
    if (!productId || !destroyLot?.id || actionSaving) return;
    try {
      setActionSaving(true);
      setActionError("");
      const response = await api.destroyProductBatch(productId, destroyLot.id);
      applyUpdatedProduct(response?.product || response);
      setDestroyLot(null);
      setHistoryPage(1);
      if (tab === "history") loadHistory(productId, 1);
    } catch (err) {
      setActionError(err.message || t("inventory.destroyLotTitle"));
    } finally {
      setActionSaving(false);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={display.name || t("inventory.detail.title") || "Product details"}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-secondary-200/70 bg-mist/80 p-3 dark:border-slate-800 dark:bg-slate-900/50 sm:p-4">
            {display.imageUrl ? (
              <img
                src={display.imageUrl}
                alt={display.name || ""}
                className="h-14 w-14 shrink-0 rounded-xl object-cover border border-secondary-200 dark:border-slate-800 sm:h-16 sm:w-16"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 sm:h-16 sm:w-16">
                {(display.name || "P").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink sm:text-lg">
                {display.name || "—"}
              </p>
              <p className="mt-0.5 break-words text-xs text-secondary-500">
                {[
                  display.companyName || display.brand,
                  display.categoryName ||
                    (typeof display.category === "object"
                      ? display.category?.name
                      : display.category),
                  unitLabel,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    stock <= 0
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      : stock <= 5
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}
                >
                  {formatQuantity(stock)}
                  {unitLabel ? ` ${unitLabel}` : ""}
                </span>
                {batches.length > 1 ? (
                  <span className="rounded-full bg-secondary-200/80 px-2 py-0.5 text-xs font-semibold text-secondary-700 dark:bg-slate-800 dark:text-secondary-300">
                    {batches.length} {t("inventory.lots") || "lots"}
                  </span>
                ) : null}
                {expiredQuantity > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    {t("inventory.expiredLot") || "Expired lot"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-1 overflow-x-auto rounded-xl bg-secondary-100/80 p-1 dark:bg-slate-900/80">
            {TABS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                  tab === id
                    ? "bg-white text-ink shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-secondary-500 hover:text-ink-light dark:text-secondary-400"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="truncate">{tabLabels[id]}</span>
              </button>
            ))}
          </div>

          {loading && !product ? (
            <p className="py-8 text-center text-sm text-secondary-500">
              {t("common.loading")}
            </p>
          ) : error && !product ? (
            <p className="py-8 text-center text-sm text-rose-600">{error}</p>
          ) : null}

          {tab === "overview" ? (
            <div className="rounded-2xl border border-secondary-200/70 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-950/40 sm:px-4">
              <DetailRow label={t("inventory.itemCode")}>
                {display.sku || display.itemCode || "—"}
              </DetailRow>
              <DetailRow label={t("inventory.brand")}>
                {display.companyName || display.brand || "—"}
              </DetailRow>
              <DetailRow label={t("inventory.itemCategory")}>
                {display.categoryName ||
                  (typeof display.category === "object"
                    ? display.category?.name
                    : display.category) ||
                  "—"}
              </DetailRow>
              {showJewelleryFields ? (
                <>
                  <DetailRow label={t("inventory.metalType") || "Metal"}>
                    {display.metalType || "—"}
                  </DetailRow>
                  <DetailRow label={t("inventory.purity") || "Purity"}>
                    {display.purity || "—"}
                  </DetailRow>
                </>
              ) : null}
              <DetailRow label={t("products.salePrice")}>
                {t("currency.formatted", {
                  symbol: t("currency.symbol"),
                  amount: salePrice.toFixed(2),
                })}
              </DetailRow>
              {canViewPurchasePrice ? (
                <DetailRow label={t("products.purchasePrice")}>
                  {t("currency.formatted", {
                    symbol: t("currency.symbol"),
                    amount: purchasePrice.toFixed(2),
                  })}
                </DetailRow>
              ) : null}
              <DetailRow label={t("inventory.quantity")}>
                {formatQuantity(stock)}
                {unitLabel ? ` ${unitLabel}` : ""}
              </DetailRow>
              {expiredQuantity > 0 ? (
                <DetailRow label={t("inventory.sellableStock") || "Sellable"}>
                  {formatQuantity(sellableQuantity)}
                  {unitLabel ? ` ${unitLabel}` : ""}
                </DetailRow>
              ) : null}
              <DetailRow
                label={t("inventory.nearestExpiry") || "Nearest expiry"}
              >
                {nearestExpiry ? (
                  <div className={getExpiryDateColorClass(nearestExpiry)}>
                    <div>{formatDateBoth(nearestExpiry)}</div>
                    <div className="text-xs">
                      {getExpiryRemainingDaysText(nearestExpiry, t)}
                    </div>
                  </div>
                ) : (
                  t("inventory.noExpiry") || "No expiry"
                )}
              </DetailRow>
            </div>
          ) : null}

          {tab === "lots" ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary-600">
                {t("inventory.stockLotsTabHint") ||
                  "Edit expiry on any lot. Exchange and destroy are only for expired lots."}
              </p>
              {actionError ? <Notice title={actionError} tone="error" /> : null}
              {loading ? (
                <p className="py-8 text-center text-sm text-secondary-500">
                  {t("common.loading")}
                </p>
              ) : batches.length === 0 ? (
                <p className="py-8 text-center text-sm text-secondary-500">
                  {t("inventory.noBatches") || "No open lots yet."}
                </p>
              ) : (
                batches.map((batch, index) => {
                  const expiry = toDateInputValue(batch.expiryDate);
                  const expired =
                    batch.isExpired === true || isExpiryDateExpired(expiry);
                  return (
                    <div
                      key={batch.id || `lot-${index}`}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                        expired
                          ? "border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/20"
                          : "border-secondary-200/80 bg-white dark:border-slate-800 dark:bg-slate-950/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink dark:text-slate-200">
                          {batch.batchNumber
                            ? `${t("inventory.batchNumber") || "Batch"}: ${batch.batchNumber}`
                            : t("inventory.noBatchNumber") || "No batch no."}
                        </p>
                        <p
                          className={`text-xs ${expiry ? getExpiryDateColorClass(expiry) : "text-secondary-500"}`}
                        >
                          {expiry ? (
                            <>
                              <DateDisplay date={expiry} />
                              <span className="ml-1.5">
                                {getExpiryRemainingDaysText(expiry, t)}
                              </span>
                            </>
                          ) : (
                            t("inventory.noExpiry") || "No expiry"
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-ink dark:text-slate-200">
                          {formatQuantity(batch.quantityOnHand || 0)}
                          {unitLabel ? ` ${unitLabel}` : ""}
                        </span>
                        {canManageInventory ? (
                          expired ? (
                            <ActionMenu
                              label={t("common.actions")}
                              actions={[
                                {
                                  label:
                                    t("inventory.editLot") || "Edit expiry",
                                  icon: Pencil,
                                  onClick: () => openEditLot(batch),
                                },
                                {
                                  label:
                                    t("inventory.exchangeLot") || "Exchange",
                                  icon: RefreshCw,
                                  onClick: () => openExchange(batch),
                                },
                                {
                                  label: t("inventory.destroyLot") || "Destroy",
                                  icon: Trash2,
                                  tone: "danger",
                                  onClick: () => {
                                    setActionError("");
                                    setExchangeLot(null);
                                    setEditLot(null);
                                    setDestroyLot(batch);
                                  },
                                },
                              ]}
                            />
                          ) : (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-secondary-500 transition hover:bg-secondary-100 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              title={t("inventory.editLot") || "Edit expiry"}
                              aria-label={
                                t("inventory.editLot") || "Edit expiry"
                              }
                              onClick={() => openEditLot(batch)}
                            >
                              <Pencil size={14} />
                            </button>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : null}

          {tab === "history" ? (
            <div className="space-y-3">
              {historyLoading ? (
                <p className="py-8 text-center text-sm text-secondary-500">
                  {t("common.loading")}
                </p>
              ) : historyError ? (
                <p className="py-8 text-center text-sm text-rose-600">
                  {historyError}
                </p>
              ) : historyItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-secondary-500">
                  {t("inventory.detail.noHistory") ||
                    "No stock history for this product."}
                </p>
              ) : (
                <>
                  {/* Mobile history cards */}
                  <div className="space-y-2 md:hidden">
                    {historyItems.map((log) => {
                      const qty = Number(log.quantityChange || 0);
                      const isAddition = qty > 0;
                      return (
                        <div
                          key={log.id}
                          className="rounded-xl border border-secondary-200/80 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium capitalize text-ink dark:text-slate-200">
                                {String(log.refType || "").replace(/_/g, " ") ||
                                  "—"}
                              </p>
                              <p className="mt-0.5 text-xs text-secondary-500">
                                {log.createdAt
                                  ? new Date(log.createdAt).toLocaleString()
                                  : "—"}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 font-semibold ${isAddition ? "text-emerald-600" : "text-rose-600"}`}
                            >
                              {isAddition ? "+" : ""}
                              {qty.toFixed(2)}
                            </span>
                          </div>
                          {log.note ? (
                            <p className="mt-2 break-words text-xs text-secondary-500">
                              {log.note}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop history table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full text-sm text-secondary-700">
                      <thead className="text-xs uppercase text-ink">
                        <tr className="border-b border-secondary-100 dark:border-slate-800">
                          <th className="py-2 text-left font-medium">
                            {t("common.date") || "Date"}
                          </th>
                          <th className="py-2 text-left font-medium">
                            {t("inventory.detail.action") || "Action"}
                          </th>
                          <th className="py-2 text-right font-medium">
                            {t("inventory.detail.qtyChange") || "Qty change"}
                          </th>
                          <th className="py-2 pl-4 text-left font-medium">
                            {t("inventory.detail.note") || "Note"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyItems.map((log) => {
                          const qty = Number(log.quantityChange || 0);
                          const isAddition = qty > 0;
                          return (
                            <tr
                              key={log.id}
                              className="border-b border-secondary-100/75 dark:border-slate-800"
                            >
                              <td className="py-3 text-xs text-secondary-500">
                                {log.createdAt
                                  ? new Date(log.createdAt).toLocaleString()
                                  : "—"}
                              </td>
                              <td className="py-3 capitalize font-medium text-ink-light dark:text-secondary-300">
                                {String(log.refType || "").replace(/_/g, " ")}
                              </td>
                              <td
                                className={`py-3 text-right font-semibold ${isAddition ? "text-emerald-600" : "text-rose-600"}`}
                              >
                                {isAddition ? "+" : ""}
                                {qty.toFixed(2)}
                              </td>
                              <td
                                className="max-w-xs truncate py-3 pl-4 text-xs text-secondary-500"
                                title={log.note}
                              >
                                {log.note || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-secondary-100 pt-3 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={historyPage === 1 || historyLoading}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {t("previous") || "Previous"}
                    </button>
                    <span className="text-center text-xs text-secondary-500">
                      {t("inventory.detail.pageOf", {
                        page: historyPage,
                        pages: Math.max(
                          1,
                          Math.ceil(historyTotal / historyPageSize),
                        ),
                        total: historyTotal,
                      }) || `Page ${historyPage} · ${historyTotal}`}
                    </span>
                    <button
                      type="button"
                      disabled={
                        historyPage >=
                          Math.ceil(historyTotal / historyPageSize) ||
                        historyLoading
                      }
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {t("next") || "Next"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-secondary-100 pt-3 dark:border-slate-800 sm:flex-row sm:justify-end">
            <button
              className="btn-secondary w-full sm:w-auto"
              type="button"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
            {canManageInventory && onRestock ? (
              <button
                className="btn-secondary w-full justify-center gap-1.5 sm:w-auto"
                type="button"
                onClick={onRestock}
              >
                <Plus size={16} />
                {t("inventory.restock")}
              </button>
            ) : null}
            {canManageInventory && onEdit ? (
              <button
                className="btn-primary w-full justify-center gap-1.5 sm:w-auto"
                type="button"
                onClick={onEdit}
              >
                <Pencil size={16} />
                {t("common.edit")}
              </button>
            ) : null}
          </div>
        </div>
      </Dialog>
      <Dialog
        isOpen={Boolean(editLot)}
        onClose={() => {
          if (actionSaving) return;
          setEditLot(null);
          setActionError("");
        }}
        title={t("inventory.editLotTitle") || "Edit lot expiry"}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleEditLotSubmit}>
          <p className="text-sm text-secondary-600">
            {t("inventory.editExpiryHelp")}
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-400">
              {t("inventory.stockLots")}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {editLot?.batchNumber
                ? `${t("inventory.batchNumber")}: ${editLot.batchNumber}`
                : t("inventory.noBatchNumber") || "No batch no."}
            </p>
            <p className="text-xs text-secondary-500">
              {formatQuantity(editLot?.quantityOnHand || 0)}
              {unitLabel ? ` ${unitLabel}` : ""}
            </p>
          </div>
          <div>
            <label className="label">{t("inventory.expiryDateOptional")}</label>
            <div className="mt-1">
              <FlexibleDateInput
                id="inventory-edit-lot-expiry-date"
                name="editLotExpiryDate"
                value={editExpiryDate}
                onChange={(event) =>
                  setEditExpiryDate(event.target.value || "")
                }
                className="input w-full"
              />
            </div>
            {editExpiryDate ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-secondary-500 hover:text-ink"
                onClick={() => setEditExpiryDate("")}
              >
                {t("inventory.clearExpiry") || "Remove expiry date"}
              </button>
            ) : null}
          </div>
          {actionError ? <Notice title={actionError} tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => setEditLot(null)}
              disabled={actionSaving}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={actionSaving}
            >
              {actionSaving ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </form>
      </Dialog>
      <Dialog
        isOpen={Boolean(exchangeLot)}
        onClose={() => {
          if (actionSaving) return;
          setExchangeLot(null);
          setActionError("");
        }}
        title={t("inventory.exchangeLotTitle") || "Exchange expired lot"}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleExchangeSubmit}>
          <p className="text-sm text-secondary-600">
            {t("inventory.exchangeHelp")}
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-secondary-400">
              {t("inventory.expiredLot")}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {exchangeLot?.batchNumber
                ? `${t("inventory.batchNumber")}: ${exchangeLot.batchNumber}`
                : t("inventory.noBatchNumber") || "No batch no."}
            </p>
            <p className="text-xs text-rose-600">
              {exchangeLot?.expiryDate ? (
                <DateDisplay date={exchangeLot.expiryDate} />
              ) : null}
              {" · "}
              {formatQuantity(exchangeLot?.quantityOnHand || 0)}
              {unitLabel ? ` ${unitLabel}` : ""}
            </p>
          </div>
          <div>
            <label className="label">{t("inventory.newBatchNumber")}</label>
            <input
              className="input mt-1"
              value={exchangeForm.batchNumber}
              onChange={(event) =>
                setExchangeForm((prev) => ({
                  ...prev,
                  batchNumber: event.target.value,
                }))
              }
              placeholder={
                t("inventory.batchNumberPlaceholder") || "Eg. LOT-A12"
              }
              required
            />
          </div>
          <div>
            <label className="label">{t("inventory.newExpiryDate")}</label>
            <div className="mt-1">
              <FlexibleDateInput
                id="inventory-exchange-expiry-date"
                name="exchangeExpiryDate"
                value={exchangeForm.expiryDate}
                onChange={(event) =>
                  setExchangeForm((prev) => ({
                    ...prev,
                    expiryDate: event.target.value || "",
                  }))
                }
                className="input w-full"
              />
            </div>
          </div>
          {actionError ? <Notice title={actionError} tone="error" /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => setExchangeLot(null)}
              disabled={actionSaving}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto"
              disabled={actionSaving}
            >
              {actionSaving
                ? t("common.loading")
                : t("inventory.exchangeLot") || "Exchange"}
            </button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        isOpen={Boolean(destroyLot)}
        onClose={() => {
          if (actionSaving) return;
          setDestroyLot(null);
        }}
        onConfirm={handleDestroyConfirm}
        title={t("inventory.destroyLotTitle") || "Destroy expired stock"}
        description={t("inventory.destroyLotConfirm")}
        confirmLabel={t("inventory.destroyLot") || "Destroy"}
        confirming={actionSaving}
      />
    </>
  );
}
