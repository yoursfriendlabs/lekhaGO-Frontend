import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Boxes, Clock, Package, ShoppingCart, UserCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { formatMaybeDate } from '../lib/datetime';

const EMPTY_SUMMARY = Object.freeze({
  cashReceived: 0,
  pendingAmount: 0,
  pendingReceivable: 0,
  pendingPayable: 0,
  salesTotal: 0,
  purchaseTotal: 0,
  serviceTotal: 0,
  productCount: 0,
  lowStockCount: 0,
  lowStockItems: [],
  recentSales: [],
  recentPurchases: [],
  upcomingServiceDeliveries: [],
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDashboardSummary(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const lowStockItems = asArray(summary.lowStockItems);

  return {
    cashReceived: asNumber(summary.cashReceived),
    pendingAmount: asNumber(summary.pendingAmount),
    pendingReceivable: asNumber(summary.pendingReceivable),
    pendingPayable: asNumber(summary.pendingPayable),
    salesTotal: asNumber(summary.salesTotal),
    purchaseTotal: asNumber(summary.purchaseTotal),
    serviceTotal: asNumber(summary.serviceTotal),
    productCount: asNumber(summary.productCount),
    lowStockCount: asNumber(summary.lowStockCount ?? lowStockItems.length),
    lowStockItems,
    recentSales: asArray(summary.recentSales),
    recentPurchases: asArray(summary.recentPurchases),
    upcomingServiceDeliveries: asArray(summary.upcomingServiceDeliveries),
  };
}

function getDeliveryDaysLeft(deliveryDate) {
  if (!deliveryDate) return null;

  const today = dayjs().startOf('day');
  const delivery = dayjs(deliveryDate).startOf('day');

  if (!delivery.isValid()) return null;
  return delivery.diff(today, 'day');
}

function DeliveryTag({ date }) {
  if (!date) return <span className="text-xs text-slate-400">-</span>;

  const days = getDeliveryDaysLeft(date);
  const label = formatMaybeDate(date, 'D MMM');

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <Clock size={10} /> {label} - Overdue
      </span>
    );
  }

  if (days < 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        <Clock size={10} /> {label} - {days}d
      </span>
    );
  }

  if (days < 8) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        <Clock size={10} /> {label} - {days}d
      </span>
    );
  }

  return <span className="text-xs text-slate-500">{label}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return formatMaybeDate(dateStr, 'D MMM YYYY');
}

function getRangeStart(range) {
  const now = dayjs();
  if (range === 'today') return now.startOf('day');
  if (range === 'week') return now.startOf('week');
  if (range === 'month') return now.startOf('month');
  return now.startOf('year');
}

export default function Dashboard() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(() => EMPTY_SUMMARY);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');

  const rangeOptions = [
    { key: 'today', label: t('dashboard.filters.today') },
    { key: 'week', label: t('dashboard.filters.week') },
    { key: 'month', label: t('dashboard.filters.month') },
    { key: 'year', label: t('dashboard.filters.year') },
  ];

  const rangeStart = useMemo(() => getRangeStart(dateRange), [dateRange]);
  const rangeEnd = useMemo(() => dayjs().endOf('day'), [dateRange]);

  const formatMoney = (value) => {
    const amount = asNumber(value);
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: formatted,
    });
  };

  useEffect(() => {
    let isActive = true;

    setLoading(true);
    setLoadError('');

    api.getDashboardSummary({
      from: rangeStart.format('YYYY-MM-DD'),
      to: rangeEnd.format('YYYY-MM-DD'),
    })
      .then((data) => {
        if (!isActive) return;
        setSummary(normalizeDashboardSummary(data));
      })
      .catch((err) => {
        if (!isActive) return;
        setSummary(EMPTY_SUMMARY);
        setLoadError(err.message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [rangeEnd, rangeStart]);

  const selectedRangeLabel = rangeOptions.find((option) => option.key === dateRange)?.label ?? '';
  const recentSales = summary.recentSales.slice(0, 5);
  const recentPurchases = summary.recentPurchases.slice(0, 5);
  const upcomingDeliveries = summary.upcomingServiceDeliveries.slice(0, 6);
  const lowStockItems = summary.lowStockItems.slice(0, 5);

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('dashboard.filters.label')}</span>
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDateRange(option.key)}
                  aria-pressed={dateRange === option.key}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    dateRange === option.key
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-white/90 dark:text-slate-900'
                      : 'bg-white/80 text-slate-600 ring-1 ring-slate-200/70 hover:bg-slate-50 dark:bg-slate-900/60 dark:text-slate-300 dark:ring-slate-700/60',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      />

      {loadError ? <Notice title={loadError} tone="error" /> : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/60 dark:via-slate-950/80 dark:to-slate-900/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600/80">{t('dashboard.cashOverview')}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.cashReceived)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('dashboard.totalReceived')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-200">
              <UserCheck size={22} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-4 dark:border-amber-700/40 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-amber-500/80">{t('dashboard.amountPending')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.pendingAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.salesTotal')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.salesTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.purchaseSpend')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.purchaseTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.serviceRevenue')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.serviceTotal)}</p>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {loading ? t('common.loading') : t('dashboard.filters.showing', { range: selectedRangeLabel })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.quickStats')}</p>
              <BarChart3 size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><Boxes size={14} /> {t('dashboard.products')}</div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.productCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><Package size={14} /> {t('dashboard.lowStockAlerts')}</div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.lowStockCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><UserCheck size={14} /> {t('dashboard.pendingReceivable')}</div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatMoney(summary.pendingReceivable)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500"><ShoppingCart size={14} /> {t('dashboard.pendingPayable')}</div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{formatMoney(summary.pendingPayable)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.quickActions')}</p>
              <Package size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 grid gap-2">
              <Link className="btn-primary w-full justify-center" to="/app/services">{t('dashboard.newSale')}</Link>
              <Link className="btn-secondary w-full justify-center" to="/app/purchases">{t('dashboard.newPurchase')}</Link>
              <Link className="btn-ghost w-full justify-center" to="/app/inventory">{t('dashboard.addProduct')}</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.upcomingDeliveries')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/services">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-2">
            {upcomingDeliveries.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noUpcomingDeliveries')}</p>
            ) : (
              upcomingDeliveries.map((order) => {
                const days = getDeliveryDaysLeft(order.deliveryDate);
                const isUrgent = days !== null && days < 3;
                const isWarning = days !== null && days >= 3 && days < 8;
                const rowClass = isUrgent
                  ? 'border border-red-200/70 bg-red-50/60 dark:border-red-800/40 dark:bg-red-900/15'
                  : isWarning
                  ? 'border border-amber-200/70 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/15'
                  : 'border border-slate-200/70 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/60';

                return (
                  <div key={order.id || order.orderNo} className={`flex items-center justify-between rounded-2xl p-3 ${rowClass}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{order.orderNo || String(order.id ?? '').slice(0, 6) || '-'}</p>
                        {order.vehicleId ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">{order.vehicleId}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {order.partyName || order.customerName ? (
                          <span className="text-xs text-slate-500">{order.partyName || order.customerName}</span>
                        ) : null}
                        <DeliveryTag date={order.deliveryDate} />
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatMoney(order.grandTotal)}</p>
                      <span className={`text-xs font-medium capitalize ${order.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' : order.status === 'open' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                        {order.status === 'in_progress' ? 'In progress' : order.status || '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.recentPurchases')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/purchases">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentPurchases.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noPurchases')}</p>
            ) : (
              recentPurchases.map((purchase) => (
                <div key={purchase.id || purchase.invoiceNo} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{purchase.invoiceNo || String(purchase.id ?? '').slice(0, 6) || '-'}</p>
                    <p className="text-xs text-slate-500">{formatDate(purchase.purchaseDate)} - {purchase.status || t('nav.purchases')}</p>
                  </div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">{formatMoney(purchase.grandTotal)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.recentSales')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/services">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noSales')}</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id || sale.invoiceNo} className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{sale.invoiceNo || String(sale.id ?? '').slice(0, 6) || '-'}</p>
                    <p className="text-xs text-slate-500">{formatDate(sale.saleDate)} - {sale.status || t('nav.sales')}</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatMoney(sale.grandTotal)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.lowStockAlerts')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/inventory">{t('dashboard.viewInventory')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noLowStock')}</p>
            ) : (
              lowStockItems.map((item, index) => (
                <div
                  key={item.productId || item.id || `${item.name || 'low-stock'}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-rose-200/60 bg-rose-50/60 p-3 dark:border-rose-700/40 dark:bg-rose-900/20"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name || '-'}</p>
                    <p className="text-xs text-slate-500">{item.sku || 'n/a'}</p>
                  </div>
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">{asNumber(item.quantityOnHand).toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
