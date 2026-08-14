import { useCallback, useEffect, useState } from 'react';
import { Dialog } from './ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import DateDisplay from './DateDisplay.jsx';
import { formatDateBoth } from '../lib/nepaliDate.js';
import { History, Layers, Package, Pencil, Plus } from 'lucide-react';

function toDateInputValue(value) {
  if (!value) return '';
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function formatQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

function getExpiryDateColorClass(expiryDateStr) {
  if (!expiryDateStr) return 'text-slate-500';
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();
  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 10) return 'text-rose-600 dark:text-rose-400 font-semibold';
  if (diffDays <= 20) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-emerald-600 dark:text-emerald-400 font-semibold';
}

function getExpiryRemainingDaysText(expiryDateStr, t) {
  if (!expiryDateStr) return '';
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();
  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return t('inventory.expired') || 'Expired';
  if (diffDays === 0) return t('inventory.expiresToday') || 'Expires today';
  return t('inventory.daysRemaining', { count: diffDays }) || `${diffDays} days remaining`;
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div className="min-w-0 text-right text-sm font-medium text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  );
}

const TABS = [
  { id: 'overview', icon: Package },
  { id: 'lots', icon: Layers },
  { id: 'history', icon: History },
];

export default function ProductDetailDialog({
  isOpen,
  onClose,
  productId,
  productHint = null,
  initialTab = 'overview',
  canManageInventory = false,
  showJewelleryFields = false,
  onEdit,
  onRestock,
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState(initialTab);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyPageSize = 10;

  const display = product || productHint || {};
  const unitLabel = display.primaryUnit || display.unit?.name || display.unit || '';
  const batches = Array.isArray(product?.batches) ? product.batches : [];
  const stock = Number(display.stockOnHand ?? display.quantity ?? display.openingStock ?? 0);
  const salePrice = Number(display.salePrice ?? 0);
  const purchasePrice = Number(display.purchasePrice ?? 0);
  const nearestExpiry = toDateInputValue(display.expiryDate);

  const loadHistory = useCallback(async (id, pageNum = 1) => {
    if (!id) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.stockLedgerReport({
        productId: id,
        limit: historyPageSize,
        offset: (pageNum - 1) * historyPageSize,
      });
      setHistoryItems(response.items || []);
      setHistoryTotal(response.total || 0);
    } catch (err) {
      setHistoryError(err.message || t('inventory.detail.historyLoadError') || 'Failed to load stock history');
      setHistoryItems([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab || 'overview');
    setHistoryPage(1);
    setHistoryItems([]);
    setHistoryError('');
    setError('');
    setProduct(null);

    if (!productId) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const detail = await api.getProduct(productId);
        if (!cancelled) setProduct(detail);
      } catch (err) {
        if (!cancelled) setError(err.message || t('inventory.detail.loadError') || 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, productId, initialTab, t]);

  useEffect(() => {
    if (!isOpen || tab !== 'history' || !productId) return;
    loadHistory(productId, historyPage);
  }, [isOpen, tab, productId, historyPage, loadHistory]);

  const tabLabels = {
    overview: t('inventory.detail.overview') || 'Details',
    lots: t('inventory.detail.lots') || 'Stock lots',
    history: t('inventory.detail.history') || 'History',
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={display.name || t('inventory.detail.title') || 'Product details'}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50 sm:p-4">
          {display.imageUrl ? (
            <img
              src={display.imageUrl}
              alt={display.name || ''}
              className="h-14 w-14 shrink-0 rounded-xl object-cover border border-slate-200 dark:border-slate-800 sm:h-16 sm:w-16"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 sm:h-16 sm:w-16">
              {(display.name || 'P').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-slate-900 dark:text-white sm:text-lg">
              {display.name || '—'}
            </p>
            <p className="mt-0.5 break-words text-xs text-slate-500">
              {[
                display.companyName || display.brand,
                display.categoryName || (typeof display.category === 'object' ? display.category?.name : display.category),
                unitLabel,
              ].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                stock <= 0
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                  : stock <= 5
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}>
                {formatQuantity(stock)}{unitLabel ? ` ${unitLabel}` : ''}
              </span>
              {batches.length > 1 ? (
                <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {batches.length} {t('inventory.lots') || 'lots'}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900/80">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
                tab === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="truncate">{tabLabels[id]}</span>
            </button>
          ))}
        </div>

        {loading && !product ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('common.loading')}</p>
        ) : error && !product ? (
          <p className="py-8 text-center text-sm text-rose-600">{error}</p>
        ) : null}

        {tab === 'overview' ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-950/40 sm:px-4">
            <DetailRow label={t('inventory.itemCode')}>{display.sku || display.itemCode || '—'}</DetailRow>
            <DetailRow label={t('inventory.brand')}>{display.companyName || display.brand || '—'}</DetailRow>
            <DetailRow label={t('inventory.itemCategory')}>
              {display.categoryName || (typeof display.category === 'object' ? display.category?.name : display.category) || '—'}
            </DetailRow>
            {showJewelleryFields ? (
              <>
                <DetailRow label={t('inventory.metalType') || 'Metal'}>{display.metalType || '—'}</DetailRow>
                <DetailRow label={t('inventory.purity') || 'Purity'}>{display.purity || '—'}</DetailRow>
              </>
            ) : null}
            <DetailRow label={t('products.salePrice')}>
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: salePrice.toFixed(2) })}
            </DetailRow>
            <DetailRow label={t('products.purchasePrice')}>
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: purchasePrice.toFixed(2) })}
            </DetailRow>
            <DetailRow label={t('inventory.quantity')}>
              {formatQuantity(stock)}{unitLabel ? ` ${unitLabel}` : ''}
            </DetailRow>
            <DetailRow label={t('inventory.nearestExpiry') || 'Nearest expiry'}>
              {nearestExpiry ? (
                <div className={getExpiryDateColorClass(nearestExpiry)}>
                  <div>{formatDateBoth(nearestExpiry)}</div>
                  <div className="text-xs">{getExpiryRemainingDaysText(nearestExpiry, t)}</div>
                </div>
              ) : (t('inventory.noExpiry') || 'No expiry')}
            </DetailRow>
          </div>
        ) : null}

        {tab === 'lots' ? (
          <div className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('common.loading')}</p>
            ) : batches.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t('inventory.noBatches') || 'No open lots yet.'}
              </p>
            ) : (
              batches.map((batch, index) => {
                const expiry = toDateInputValue(batch.expiryDate);
                return (
                  <div
                    key={batch.id || `lot-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {batch.batchNumber
                          ? `${t('inventory.batchNumber') || 'Batch'}: ${batch.batchNumber}`
                          : (t('inventory.noBatchNumber') || 'No batch no.')}
                      </p>
                      <p className={`text-xs ${expiry ? getExpiryDateColorClass(expiry) : 'text-slate-500'}`}>
                        {expiry ? (
                          <>
                            <DateDisplay date={expiry} />
                            <span className="ml-1.5">{getExpiryRemainingDaysText(expiry, t)}</span>
                          </>
                        ) : (t('inventory.noExpiry') || 'No expiry')}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {formatQuantity(batch.quantityOnHand || 0)}
                      {unitLabel ? ` ${unitLabel}` : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        {tab === 'history' ? (
          <div className="space-y-3">
            {historyLoading ? (
              <p className="py-8 text-center text-sm text-slate-500">{t('common.loading')}</p>
            ) : historyError ? (
              <p className="py-8 text-center text-sm text-rose-600">{historyError}</p>
            ) : historyItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {t('inventory.detail.noHistory') || 'No stock history for this product.'}
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
                        className="rounded-xl border border-slate-200/80 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium capitalize text-slate-800 dark:text-slate-200">
                              {String(log.refType || '').replace(/_/g, ' ') || '—'}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                            </p>
                          </div>
                          <span className={`shrink-0 font-semibold ${isAddition ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isAddition ? '+' : ''}{qty.toFixed(2)}
                          </span>
                        </div>
                        {log.note ? (
                          <p className="mt-2 break-words text-xs text-slate-500">{log.note}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop history table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="py-2 text-left font-medium">{t('common.date') || 'Date'}</th>
                        <th className="py-2 text-left font-medium">{t('inventory.detail.action') || 'Action'}</th>
                        <th className="py-2 text-right font-medium">{t('inventory.detail.qtyChange') || 'Qty change'}</th>
                        <th className="py-2 pl-4 text-left font-medium">{t('inventory.detail.note') || 'Note'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((log) => {
                        const qty = Number(log.quantityChange || 0);
                        const isAddition = qty > 0;
                        return (
                          <tr key={log.id} className="border-b border-slate-100/75 dark:border-slate-800">
                            <td className="py-3 text-xs text-slate-500">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                            </td>
                            <td className="py-3 capitalize font-medium text-slate-700 dark:text-slate-300">
                              {String(log.refType || '').replace(/_/g, ' ')}
                            </td>
                            <td className={`py-3 text-right font-semibold ${isAddition ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isAddition ? '+' : ''}{qty.toFixed(2)}
                            </td>
                            <td className="max-w-xs truncate py-3 pl-4 text-xs text-slate-500" title={log.note}>
                              {log.note || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={historyPage === 1 || historyLoading}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {t('common.previous') || 'Previous'}
                  </button>
                  <span className="text-center text-xs text-slate-500">
                    {t('inventory.detail.pageOf', {
                      page: historyPage,
                      pages: Math.max(1, Math.ceil(historyTotal / historyPageSize)),
                      total: historyTotal,
                    }) || `Page ${historyPage} · ${historyTotal}`}
                  </span>
                  <button
                    type="button"
                    disabled={historyPage >= Math.ceil(historyTotal / historyPageSize) || historyLoading}
                    onClick={() => setHistoryPage((p) => p + 1)}
                    className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {t('common.next') || 'Next'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button className="btn-secondary w-full sm:w-auto" type="button" onClick={onClose}>
            {t('common.close')}
          </button>
          {canManageInventory && onRestock ? (
            <button
              className="btn-secondary w-full justify-center gap-1.5 sm:w-auto"
              type="button"
              onClick={onRestock}
            >
              <Plus size={16} />
              {t('inventory.restock')}
            </button>
          ) : null}
          {canManageInventory && onEdit ? (
            <button
              className="btn-primary w-full justify-center gap-1.5 sm:w-auto"
              type="button"
              onClick={onEdit}
            >
              <Pencil size={16} />
              {t('common.edit')}
            </button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
