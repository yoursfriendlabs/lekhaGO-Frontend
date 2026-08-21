import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { BarChart3, BellRing, Boxes, Clock, ClipboardList, Package, ShoppingCart, TrendingUp, UserCheck, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { useTaskNotifications } from '../hooks/useTaskNotifications';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import StatsCard from '../components/StatsCard.jsx';
import { formatCurrency } from '../lib/currency';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { formatMaybeDate } from '../lib/datetime';

const EMPTY_SUMMARY = Object.freeze({
  cashReceived: 0,
  cashPaid: 0,
  pendingAmount: 0,
  pendingReceivable: 0,
  pendingPayable: 0,
  salesTotal: 0,
  directSalesTotal: 0,
  purchaseTotal: 0,
  serviceTotal: 0,
  expenseTotal: 0,
  profitOrLoss: 0,
  profitOrLossStatus: 'break_even',
  productCount: 0,
  lowStockCount: 0,
  nearExpiryCount: 0,
  lowStockItems: [],
  recentSales: [],
  recentPurchases: [],
  upcomingServiceDeliveries: [],
  breakdown: {
    revenue: {
      sales: 0,
      directSales: 0,
      services: 0,
    },
    cashPaid: {
      purchases: 0,
      expenses: 0,
      total: 0,
    },
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(source, keys = []) {
  for (const key of keys) {
    const parsed = Number(source?.[key]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function normalizeDashboardSummary(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const lowStockItems = asArray(summary.lowStockItems);
  const directSalesTotal = firstNumber(summary, ['directSalesTotal']) ?? firstNumber(summary?.breakdown?.revenue, ['directSales']);
  const serviceTotal = firstNumber(summary, ['serviceTotal']) ?? firstNumber(summary?.breakdown?.revenue, ['services']) ?? 0;
  const salesTotal = firstNumber(summary?.breakdown?.revenue, ['sales'])
    ?? (
      directSalesTotal !== null
        ? (firstNumber(summary, ['salesTotal']) ?? (directSalesTotal + serviceTotal))
        : (asNumber(summary.salesTotal) + serviceTotal)
    );
  const purchaseTotal = firstNumber(summary, ['purchaseTotal']) ?? 0;
  const expenseTotal = firstNumber(summary, ['expenseTotal']) ?? 0;
  const salaryExpenseTotal = firstNumber(summary, ['salaryExpenseTotal']) ?? 0;
  const cashPaid = firstNumber(summary, ['cashPaid'])
    ?? firstNumber(summary?.breakdown?.cashPaid, ['total'])
    ?? (
      (firstNumber(summary?.breakdown?.cashPaid, ['purchases']) ?? 0)
      + (firstNumber(summary?.breakdown?.cashPaid, ['expenses']) ?? 0)
    );
  const profitOrLoss = firstNumber(summary, ['profitOrLoss']) ?? (salesTotal - purchaseTotal - expenseTotal);

  return {
    cashReceived: asNumber(summary.cashReceived),
    cashPaid,
    pendingAmount: asNumber(summary.pendingAmount),
    pendingReceivable: asNumber(summary.pendingReceivable),
    pendingPayable: asNumber(summary.pendingPayable),
    salesTotal,
    directSalesTotal: directSalesTotal ?? asNumber(summary.salesTotal),
    purchaseTotal,
    serviceTotal,
    expenseTotal,
    salaryExpenseTotal,
    profitOrLoss,
    profitOrLossStatus: summary.profitOrLossStatus || (profitOrLoss > 0 ? 'profit' : profitOrLoss < 0 ? 'loss' : 'break_even'),
    productCount: asNumber(summary.productCount),
    lowStockCount: asNumber(summary.lowStockCount ?? lowStockItems.length),
    nearExpiryCount: asNumber(summary.nearExpiryCount),
    lowStockItems,
    recentSales: asArray(summary.recentSales),
    recentPurchases: asArray(summary.recentPurchases),
    upcomingServiceDeliveries: asArray(summary.upcomingServiceDeliveries).filter(
      (order) => !['closed', 'cancelled', 'canceled', 'void'].includes(String(order?.status || '').toLowerCase()),
    ),
    breakdown: {
      revenue: {
        sales: firstNumber(summary?.breakdown?.revenue, ['sales']) ?? salesTotal,
        directSales: firstNumber(summary?.breakdown?.revenue, ['directSales']) ?? (directSalesTotal ?? asNumber(summary.salesTotal)),
        services: firstNumber(summary?.breakdown?.revenue, ['services']) ?? serviceTotal,
      },
      cashPaid: {
        purchases: firstNumber(summary?.breakdown?.cashPaid, ['purchases']) ?? 0,
        expenses: firstNumber(summary?.breakdown?.cashPaid, ['expenses']) ?? 0,
        salaryExpenses: firstNumber(summary?.breakdown?.cashPaid, ['salaryExpenses']) ?? 0,
        total: firstNumber(summary?.breakdown?.cashPaid, ['total']) ?? cashPaid,
      },
    },
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
  if (!date) return <span className="text-xs text-secondary-400">-</span>;

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

  return <span className="text-xs text-secondary-500">{label}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return formatMaybeDate(dateStr, 'D MMM YYYY');
}

function compactMoney(value) {
  return formatCurrency(value, { compact: true });
}

function CashFlowChart({
  title,
  caption,
  formatMoney,
  mixData,
  trendData,
  loading,
  emptyLabel,
  incomingLabel,
  outgoingLabel,
}) {
  const showTrend = !loading && trendData.length > 1;
  const chartData = showTrend ? trendData : mixData;
  const hasValues = chartData.some((row) => asNumber(row.incoming ?? row.value) > 0 || asNumber(row.outgoing) > 0);
  const tickInterval = showTrend ? Math.max(0, Math.ceil(chartData.length / 6) - 1) : 0;

  return (
    <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{title}</p>
          {caption ? <p className="mt-1 text-xs text-secondary-500">{caption}</p> : null}
        </div>
        <BarChart3 size={18} className="shrink-0 text-secondary-400" />
      </div>

      {showTrend ? (
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-medium text-secondary-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {incomingLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {outgoingLabel}
          </span>
        </div>
      ) : null}

      <div className="mt-4 h-56">
        {loading ? (
          <div className="h-full animate-pulse rounded-2xl bg-mist dark:bg-slate-800/60" />
        ) : !hasValues ? (
          <p className="flex h-full items-center text-sm text-secondary-500">{emptyLabel}</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: showTrend ? 8 : 4 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-secondary-200))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'rgb(var(--color-secondary-500))' }}
                axisLine={{ stroke: 'rgb(var(--color-secondary-200))' }}
                tickLine={false}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'rgb(var(--color-secondary-500))' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={compactMoney}
              />
              <Tooltip
                formatter={(value, name, item) => [
                  formatMoney(value),
                  showTrend ? name : (item?.payload?.label || name),
                ]}
                contentStyle={{
                  backgroundColor: 'rgb(var(--color-surface))',
                  border: '1px solid rgb(var(--color-secondary-200))',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              {showTrend ? (
                <>
                  <Bar dataKey="incoming" name={incomingLabel} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="outgoing" name={outgoingLabel} fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </>
              ) : (
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                  {chartData.map((row) => (
                    <Cell key={row.label} fill={row.color} />
                  ))}
                </Bar>
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
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
  const { canViewFeature, canManageFeature, accessControl } = useAuth();
  const { businessProfile } = useBusinessSettings();

  /* ── Redirect general staff to their salary profile (or staff list if membershipId missing) ── */
  if (accessControl?.staffCategory === 'general_staff') {
    if (accessControl?.membershipId) {
      return <Navigate to="/app/profile" replace />;
    }

    return <Navigate to="/app/staff" replace />;
  }
  const [summary, setSummary] = useState(() => EMPTY_SUMMARY);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendData, setTrendData] = useState([]);
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

    // The dashboard summary's lowStockCount only covers items with
    // 0 < stock <= threshold. Items with stock 0 (out of stock) are even more
    // critical, so also fetch the low and out-of-stock product lists and
    // include both in the low-stock count and list.
    Promise.all([
      api.getDashboardSummary({
        from: rangeStart.format('YYYY-MM-DD'),
        to: rangeEnd.format('YYYY-MM-DD'),
      }),
      api.listProducts({ limit: 5, stock: 'low' }).catch(() => null),
      api.listProducts({ limit: 5, stock: 'out' }).catch(() => null),
    ])
      .then(([data, lowRes, outRes]) => {
        if (!isActive) return;
        const normalized = normalizeDashboardSummary(data);
        setSummary({
          ...normalized,
          lowStockCount: Number(lowRes?.total ?? 0) + Number(outRes?.total ?? 0),
          lowStockItems: [...(lowRes?.items ?? []), ...(outRes?.items ?? [])],
        });
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

  const canViewReports = canViewFeature('reports');

  useEffect(() => {
    if (!canViewReports) {
      setTrendData([]);
      setTrendLoading(false);
      return undefined;
    }

    let isActive = true;
    setTrendLoading(true);

    api.getAnalyticsSummary({
      from: rangeStart.format('YYYY-MM-DD'),
      to: rangeEnd.format('YYYY-MM-DD'),
      groupBy: dateRange === 'year' ? 'month' : 'day',
    })
      .then((data) => {
        if (!isActive) return;
        const rows = Array.isArray(data?.series?.timeline) ? data.series.timeline : [];
        setTrendData(rows.map((row) => ({
          label: row.label,
          incoming: asNumber(row.salesAndServicesTotal),
          outgoing: asNumber(row.purchaseTotal) + asNumber(row.directExpenseTotal),
        })));
      })
      .catch(() => {
        if (!isActive) return;
        setTrendData([]);
      })
      .finally(() => {
        if (!isActive) return;
        setTrendLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [canViewReports, dateRange, rangeEnd, rangeStart]);

  const selectedRangeLabel = rangeOptions.find((option) => option.key === dateRange)?.label ?? '';
  const mixData = useMemo(() => ([
    {
      label: t('dashboard.salesAndServices'),
      value: summary.salesTotal,
      color: '#10b981',
    },
    {
      label: t('dashboard.purchaseSpend'),
      value: summary.purchaseTotal,
      color: '#f59e0b',
    },
    {
      label: t('dashboard.expenses'),
      value: summary.expenseTotal,
      color: '#0ea5e9',
    },
  ]), [summary.expenseTotal, summary.purchaseTotal, summary.salesTotal, t]);
  const recentSales = summary.recentSales.slice(0, 5);
  const recentPurchases = summary.recentPurchases.slice(0, 5);
  const upcomingDeliveries = summary.upcomingServiceDeliveries.slice(0, 6);
  const lowStockItems = summary.lowStockItems.slice(0, 5);
  const servicesEnabled = businessProfile?.modules?.services === true;
  const tasksEnabled = canViewFeature('tasks');
  const canManageTasks = canManageFeature('tasks');
  const { summary: taskSummary } = useTaskNotifications({ enabled: tasksEnabled });

  return (
    <div className="min-w-0 space-y-6 pb-28 md:pb-0">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs uppercase tracking-[0.2em] text-secondary-400">{t('dashboard.filters.label')}</span>
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
                      ? 'bg-slate-900 text-white shadow-sm dark:bg-white/90 dark:text-ink'
                      : 'bg-white/80 text-secondary-700 ring-1 ring-slate-200/70 hover:bg-mist/60 dark:text-secondary-300 dark:ring-slate-700/60',
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
        <div className="min-w-0 space-y-3">
          <StatsCard
            id="amount-pending"
            title={t('dashboard.amountPending')}
            value={formatMoney(summary.pendingAmount)}
            icon={Clock}
            tone="warning"
            loading={loading}
          />
          <StatsCard
            id="sales-services"
            title={t('dashboard.salesAndServices')}
            value={formatMoney(summary.salesTotal)}
            icon={TrendingUp}
            tone="success"
            loading={loading}
          >
            <div className="mt-2 space-y-1 text-xs text-secondary-500">
              <p className="flex items-center justify-between gap-2">
                <span>{t('analytics.directSales')}</span>
                <span className="font-medium tabular-nums">{formatMoney(summary.directSalesTotal)}</span>
              </p>
              <p className="flex items-center justify-between gap-2">
                <span>{t('nav.services')}</span>
                <span className="font-medium tabular-nums">{formatMoney(summary.serviceTotal)}</span>
              </p>
            </div>
          </StatsCard>
          <StatsCard
            id="purchase-spend"
            title={t('dashboard.purchaseSpend')}
            value={formatMoney(summary.purchaseTotal)}
            icon={ShoppingCart}
            tone="default"
            loading={loading}
          />
          <StatsCard
            id="expenses"
            title={t('dashboard.expenses')}
            value={formatMoney(summary.expenseTotal)}
            icon={Wallet}
            tone="info"
            loading={loading}
            hint={summary.salaryExpenseTotal > 0 ? `${t('dashboard.includesSalary')}: ${formatMoney(summary.salaryExpenseTotal)}` : undefined}
          />
          <StatsCard
            id="profit-loss"
            title={t('dashboard.profitLoss')}
            value={formatMoney(summary.profitOrLoss)}
            icon={BarChart3}
            tone={summary.profitOrLoss < 0 ? 'danger' : summary.profitOrLoss > 0 ? 'success' : 'default'}
            loading={loading}
            hint={`${t('analytics.totalOutgoing')}: ${formatMoney(summary.purchaseTotal + summary.expenseTotal)}`}
          />
          <CashFlowChart
            title={t('dashboard.cashFlow')}
            caption={loading || trendLoading ? t('common.loading') : t('dashboard.filters.showing', { range: selectedRangeLabel })}
            formatMoney={formatMoney}
            mixData={mixData}
            trendData={trendData}
            loading={loading || trendLoading}
            emptyLabel={t('dashboard.noChartData')}
            incomingLabel={t('dashboard.incoming')}
            outgoingLabel={t('dashboard.outgoing')}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div id="quick-stats" className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{t('dashboard.quickStats')}</p>
              <BarChart3 size={18} className="text-secondary-400" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatsCard
                title={t('dashboard.products')}
                value={summary.productCount}
                icon={Boxes}
                tone="default"
              />
              <StatsCard
                title={t('dashboard.lowStockAlerts')}
                value={summary.lowStockCount}
                icon={Package}
                tone={summary.lowStockCount > 0 ? 'danger' : 'default'}
              />
              <StatsCard
                title={t('inventory.nearExpiryItems') || 'Near Expiry'}
                value={summary.nearExpiryCount || 0}
                icon={Clock}
                tone={summary.nearExpiryCount > 0 ? 'warning' : 'default'}
              />
              <StatsCard
                title={t('dashboard.pendingReceivable')}
                value={formatMoney(summary.pendingReceivable)}
                icon={UserCheck}
                tone="success"
              />
              <StatsCard
                title={t('dashboard.pendingPayable')}
                value={formatMoney(summary.pendingPayable)}
                icon={ShoppingCart}
                tone="warning"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{t('dashboard.quickActions')}</p>
              <Package size={18} className="text-secondary-400" />
            </div>
            <div id="quick-actions" className="mt-4 grid gap-2 sm:grid-cols-2">
              {canViewFeature('quickPos') || canViewFeature('sales') ? (
                <Link id='quick-sale' className="btn-primary w-full justify-center" to={canViewFeature('quickPos') ? (businessProfile?.salesFlow?.route || '/app/pos') : '/app/sales'}>{t('dashboard.quickSale')}</Link>
              ) : null}
              {canViewFeature('purchases') ? (
                <Link id='new-purchase' className="btn-ghost w-full justify-center" to="/app/purchases?create=1&entry=expense">{t('dashboard.newPurchase')}</Link>
              ) : null}
              {tasksEnabled ? (
                <Link className="btn-ghost w-full justify-center" to={canManageTasks ? '/app/tasks?create=1' : '/app/tasks'}>
                  {canManageTasks ? t('tasks.actions.newTask') : t('tasks.notifications.viewAll')}
                </Link>
              ) : null}
              {canViewFeature('banks') ? (
                <Link id='manage-banks' className="btn-ghost w-full justify-center" to="/app/banks">{t('dashboard.manageBanks')}</Link>
              ) : null}
            </div>
          </div>

          {tasksEnabled ? (
            <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{t('tasks.dashboard.title')}</p>
                  <p className="mt-1 text-xs text-secondary-500">{t('tasks.dashboard.subtitle')}</p>
                </div>
                <BellRing size={18} className="text-secondary-400" />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <StatsCard
                  title={t('tasks.notifications.assignedOpen')}
                  value={taskSummary?.counters?.assignedToMeOpen || 0}
                  icon={ClipboardList}
                  tone="default"
                />
                <StatsCard
                  title={t('tasks.notifications.assignedOverdue')}
                  value={taskSummary?.counters?.assignedToMeOverdue || 0}
                  icon={Clock}
                  tone="danger"
                />
                <StatsCard
                  title={t('tasks.notifications.createdOpen')}
                  value={taskSummary?.counters?.createdByMeOpen || 0}
                  icon={UserCheck}
                  tone="info"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">{t('tasks.notifications.recentActivity')}</p>
                  <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/tasks">{t('dashboard.viewAll')}</Link>
                </div>
                {taskSummary?.recentActivities?.length ? (
                  <div className="mt-3 space-y-2">
                    {taskSummary.recentActivities.slice(0, 2).map((activity) => (
                      <Link
                        key={activity.id || `${activity.taskId}-${activity.createdAt}`}
                        className="block rounded-2xl border border-secondary-200/70 bg-mist/80 p-3 transition hover:border-primary-200 hover:bg-primary-50/60 dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10"
                        to={activity.task?.id || activity.taskId ? `/app/tasks?task=${activity.task?.id || activity.taskId}` : '/app/tasks'}
                      >
                        <p className="text-sm font-semibold text-ink">{activity.task?.title || t('tasks.detail.title')}</p>
                        <p className="mt-1 text-xs text-secondary-500">
                          {(activity.actor?.name || t('tasks.detail.unknownUser'))} · {formatMaybeDate(activity.createdAt, 'D MMM')}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-secondary-500">{t('tasks.notifications.empty')}</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {servicesEnabled ? (
        <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">{t('dashboard.upcomingDeliveries')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/services">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-2">
            {upcomingDeliveries.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('dashboard.noUpcomingDeliveries')}</p>
            ) : (
              upcomingDeliveries.map((order) => {
                const days = getDeliveryDaysLeft(order.deliveryDate);
                const customerName = order.customerName || order.partyName || order.party?.name;
                const isUrgent = days !== null && days < 3;
                const isWarning = days !== null && days >= 3 && days < 8;
                const rowClass = isUrgent
                  ? 'border border-red-200/70 bg-red-50/60 dark:border-red-800/40 dark:bg-red-900/15'
                  : isWarning
                  ? 'border border-amber-200/70 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/15'
                  : 'border border-secondary-200/70 bg-white/70 dark:border-slate-700/60 dark:bg-slate-900/60';

                return (
                  <div key={order.id || order.orderNo} className={`flex items-center justify-between rounded-2xl p-3 ${rowClass}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{customerName || String(order.id ?? '').slice(0, 6) || '-'}</p>
                        {order.vehicleId ? (
                          <span className="rounded bg-secondary-100 px-1.5 py-0.5 text-xs text-secondary-500 dark:bg-slate-800 dark:text-secondary-400">{order.vehicleId}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {order.orderNo ? (
                          <span className="text-xs text-secondary-500">{order.orderNo}</span>
                        ) : null}
                        <DeliveryTag date={order.deliveryDate} />
                      </div>
                    </div>
                    <div className="ml-3 text-right">
                      <p className="text-sm font-semibold text-ink-light">{formatMoney(order.grandTotal)}</p>
                      <span className={`text-xs font-medium capitalize ${order.status === 'in_progress' ? 'text-amber-600 dark:text-amber-400' : order.status === 'open' ? 'text-blue-600 dark:text-blue-400' : 'text-secondary-500'}`}>
                        {order.status === 'in_progress' ? t('services.inProgress') : order.status === 'open' ? t('services.open') : order.status === 'closed' ? t('services.closed') : order.status || '-'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        ) : null}

        <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">{t('dashboard.recentPurchases')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/purchases">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentPurchases.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('dashboard.noPurchases')}</p>
            ) : (
              recentPurchases.map((purchase) => (
                <div key={purchase.id || purchase.invoiceNo} className="flex items-center justify-between rounded-2xl border border-secondary-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{purchase.invoiceNo || String(purchase.id ?? '').slice(0, 6) || '-'}</p>
                    <p className="text-xs text-secondary-500">{formatDate(purchase.purchaseDate)} - {purchase.status || t('nav.purchases')}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-300">{formatMoney(purchase.grandTotal)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">{t('dashboard.recentSales')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/services">{t('dashboard.viewAll')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('dashboard.noSales')}</p>
            ) : (
              recentSales.map((sale) => (
                <div key={sale.id || sale.invoiceNo} className="flex items-center justify-between rounded-2xl border border-secondary-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{sale.customerName || String(sale.id ?? '').slice(0, 6) || '-'}</p>
                    <p className="text-xs text-secondary-500">{formatDate(sale.saleDate)} - {sale.status || t('nav.sales')}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatMoney(sale.grandTotal)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-secondary-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">{t('dashboard.lowStockAlerts')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/inventory">{t('dashboard.viewInventory')}</Link>
          </div>
          <div className="mt-4 space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-sm text-secondary-500">{t('dashboard.noLowStock')}</p>
            ) : (
              lowStockItems.map((item, index) => (
                <div
                  key={item.productId || item.id || `${item.name || 'low-stock'}-${index}`}
                  className="flex items-center justify-between rounded-2xl border border-rose-200/60 bg-rose-50/60 p-3 dark:border-rose-700/40 dark:bg-rose-900/20"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{item.name || '-'}</p>
                    <p className="text-xs text-secondary-500">{item.sku || 'n/a'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-rose-600 dark:text-rose-300">{asNumber(item.quantityOnHand ?? item.stockOnHand).toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
