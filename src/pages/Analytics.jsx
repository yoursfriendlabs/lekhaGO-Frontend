import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import BarGraph from '../components/BarGraph';
import PieChart from '../components/PieChart';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import CreatorFilterSelect from '../components/CreatorFilterSelect.jsx';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { todayISODate } from '../lib/datetime';

const EMPTY_METRIC_TOTALS = Object.freeze({
  count: 0,
  total: 0,
  cashReceived: 0,
  cashPaid: 0,
  pending: 0,
});

const EMPTY_SUMMARY = Object.freeze({
  totals: {
    sales: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    directSales: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    services: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    purchases: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    expenses: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    purchasesAndExpenses: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    combined: {
      revenue: 0,
      expenses: 0,
      cashIn: 0,
      cashOut: 0,
      netCash: 0,
      pendingReceivable: 0,
      pendingPayable: 0,
      profitOrLoss: 0,
      profitOrLossStatus: 'break_even',
    },
  },
  series: {
    sales: [],
    directSales: [],
    services: [],
    purchases: [],
    expenses: [],
    purchasesAndExpenses: [],
    profitLoss: [],
    timeline: [],
  },
});

const EMPTY_PROFIT_LOSS = Object.freeze({
  summary: {
    profitLoss: {
      revenue: 0,
      purchases: 0,
      expenses: 0,
      totalExpenses: 0,
      amount: 0,
      status: 'break_even',
    },
    current: {
      label: '',
      revenue: 0,
      directSales: 0,
      services: 0,
      purchases: 0,
      expenses: 0,
      totalExpenses: 0,
      amount: 0,
      status: 'break_even',
    },
  },
  series: {
    profitLoss: [],
  },
});

const EMPTY_POPULAR_ANALYTICS = Object.freeze({
  range: {
    from: null,
    to: null,
    limit: 10,
  },
  items: [],
  total: 0,
});

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

function getProfitLossStatus(amount) {
  if (amount > 0) return 'profit';
  if (amount < 0) return 'loss';
  return 'break_even';
}

function formatSeriesLabel(rawLabel, fallbackLabel) {
  const label = rawLabel ? String(rawLabel) : fallbackLabel;

  if (/^\d{4}-\d{2}$/.test(label)) {
    const parsedMonth = dayjs(`${label}-01`);
    return parsedMonth.isValid() ? parsedMonth.format('MMM YYYY') : label;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(label) || label.includes('T')) {
    const parsedDate = dayjs(label);
    return parsedDate.isValid() ? parsedDate.format('D MMM') : label;
  }

  return label;
}

function normalizeMetricTotals(source, cashKey) {
  const base = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const totalFallback = asNumber(source);

  return {
    count: asNumber(base.count),
    total: firstNumber(base, ['total', 'amount']) ?? totalFallback,
    [cashKey]: firstNumber(base, [cashKey]) ?? 0,
    pending: firstNumber(base, ['pending']) ?? 0,
  };
}

function combineMetricTotals(primary, secondary, cashKey) {
  return {
    count: asNumber(primary?.count) + asNumber(secondary?.count),
    total: asNumber(primary?.total) + asNumber(secondary?.total),
    [cashKey]: asNumber(primary?.[cashKey]) + asNumber(secondary?.[cashKey]),
    pending: asNumber(primary?.pending) + asNumber(secondary?.pending),
  };
}

function normalizeCombinedTotals(source, revenueTotals, expenseTotals) {
  const base = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const revenue = firstNumber(base, ['revenue', 'revenueTotal']) ?? asNumber(revenueTotals?.total);
  const expenses = firstNumber(base, ['expenses', 'expenseTotal', 'totalExpenses']) ?? asNumber(expenseTotals?.total);
  const cashIn = firstNumber(base, ['cashIn', 'cashInTotal']) ?? asNumber(revenueTotals?.cashReceived);
  const cashOut = firstNumber(base, ['cashOut', 'cashOutTotal']) ?? asNumber(expenseTotals?.cashPaid);
  const profitOrLoss = firstNumber(base, ['profitOrLoss']) ?? (revenue - expenses);

  return {
    revenue,
    expenses,
    cashIn,
    cashOut,
    netCash: firstNumber(base, ['netCash']) ?? (cashIn - cashOut),
    pendingReceivable: firstNumber(base, ['pendingReceivable']) ?? asNumber(revenueTotals?.pending),
    pendingPayable: firstNumber(base, ['pendingPayable']) ?? asNumber(expenseTotals?.pending),
    profitOrLoss,
    profitOrLossStatus: base.profitOrLossStatus || getProfitLossStatus(profitOrLoss),
  };
}

function normalizeBreakdownSeries(items, {
  totalKeys,
  cashKeys,
  pendingKeys,
  cashField = 'received',
}) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.bucketStart || item?.key;

    return {
      key: String(item?.key || item?.period || item?.date || item?.bucketStart || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      total: firstNumber(item, totalKeys) ?? 0,
      [cashField]: firstNumber(item, cashKeys) ?? 0,
      pending: firstNumber(item, pendingKeys) ?? 0,
    };
  });
}

function normalizeProfitLossSeries(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.bucketStart || item?.key;
    const revenue = firstNumber(item, ['revenue', 'salesAndServicesTotal']) ?? 0;
    const totalExpenses = firstNumber(item, ['totalExpenses', 'purchaseAndExpenseTotal']) ?? 0;
    const profitOrLoss = firstNumber(item, ['profitOrLoss', 'amount']) ?? (revenue - totalExpenses);

    return {
      key: String(item?.key || item?.period || item?.date || item?.bucketStart || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      revenue,
      directSales: firstNumber(item, ['directSales', 'salesTotal']) ?? 0,
      services: firstNumber(item, ['services', 'serviceTotal']) ?? 0,
      purchases: firstNumber(item, ['purchases', 'purchaseTotal']) ?? 0,
      expenses: firstNumber(item, ['expenses', 'directExpenseTotal', 'expenseTotal']) ?? 0,
      totalExpenses,
      profitOrLoss,
      status: item?.status || item?.profitOrLossStatus || getProfitLossStatus(profitOrLoss),
    };
  });
}

function normalizeTimelineSeries(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.bucketStart || item?.key;
    const directSalesTotal = firstNumber(item, ['directSalesTotal', 'salesTotal', 'directSales', 'salesAmount']) ?? 0;
    const directSalesCashReceived = firstNumber(item, ['directSalesCashReceived', 'salesCashReceived']) ?? 0;
    const directSalesPending = firstNumber(item, ['directSalesPending', 'salesPending']) ?? 0;
    const serviceTotal = firstNumber(item, ['serviceTotal', 'services', 'serviceAmount']) ?? 0;
    const serviceCashReceived = firstNumber(item, ['serviceCashReceived']) ?? 0;
    const servicePending = firstNumber(item, ['servicePending']) ?? 0;
    const salesTotal = firstNumber(item, ['salesAndServicesTotal', 'revenueTotal'])
      ?? (directSalesTotal + serviceTotal);
    const salesCashReceived = firstNumber(item, ['salesAndServicesCashReceived', 'cashInTotal'])
      ?? (directSalesCashReceived + serviceCashReceived);
    const salesPending = firstNumber(item, ['salesAndServicesPending'])
      ?? (directSalesPending + servicePending);
    const purchaseTotal = firstNumber(item, ['purchaseTotal', 'purchases', 'purchaseAmount']) ?? 0;
    const purchaseCashPaid = firstNumber(item, ['purchaseCashPaid']) ?? 0;
    const purchasePending = firstNumber(item, ['purchasePending']) ?? 0;
    const expenseTotal = firstNumber(item, ['directExpenseTotal', 'expenseTotal', 'expenses']) ?? 0;
    const expenseCashPaid = firstNumber(item, ['directExpenseCashPaid', 'expenseCashPaid']) ?? 0;
    const expensePending = firstNumber(item, ['directExpensePending', 'expensePending']) ?? 0;
    const purchasesAndExpensesTotal = firstNumber(item, ['purchaseAndExpenseTotal', 'purchasesAndExpensesTotal', 'totalExpenses'])
      ?? (purchaseTotal + expenseTotal);
    const purchasesAndExpensesCashPaid = firstNumber(item, ['purchaseAndExpenseCashPaid', 'cashOutTotal'])
      ?? (purchaseCashPaid + expenseCashPaid);
    const purchasesAndExpensesPending = firstNumber(item, ['purchaseAndExpensePending'])
      ?? (purchasePending + expensePending);
    const profitOrLoss = firstNumber(item, ['profitOrLoss', 'amount']) ?? (salesTotal - purchasesAndExpensesTotal);

    return {
      key: String(item?.key || item?.period || item?.date || item?.bucketStart || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      salesTotal,
      salesCashReceived,
      salesPending,
      directSalesTotal,
      directSalesCashReceived,
      directSalesPending,
      purchaseTotal,
      purchaseCashPaid,
      purchasePending,
      serviceTotal,
      serviceCashReceived,
      servicePending,
      expenseTotal,
      expenseCashPaid,
      expensePending,
      purchasesAndExpensesTotal,
      purchasesAndExpensesCashPaid,
      purchasesAndExpensesPending,
      profitOrLoss,
      profitOrLossStatus: item?.profitOrLossStatus || item?.status || getProfitLossStatus(profitOrLoss),
    };
  });
}

function normalizeAnalyticsSummary(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const totals = summary?.totals || {};
  const series = summary?.series || {};
  const timeline = normalizeTimelineSeries(series.timeline);
  const hasMergedRevenueContract = Boolean(totals?.directSales) || Array.isArray(series?.directSales);

  const directSalesTotals = normalizeMetricTotals(
    hasMergedRevenueContract ? totals.directSales : totals.sales,
    'cashReceived'
  );
  const servicesTotals = normalizeMetricTotals(totals.services, 'cashReceived');
  const salesTotals = hasMergedRevenueContract
    ? normalizeMetricTotals(totals.sales, 'cashReceived')
    : combineMetricTotals(normalizeMetricTotals(totals.sales, 'cashReceived'), servicesTotals, 'cashReceived');
  const purchasesTotals = normalizeMetricTotals(totals.purchases, 'cashPaid');
  const expensesTotals = normalizeMetricTotals(totals.expenses, 'cashPaid');
  const purchasesAndExpensesTotals = totals.purchasesAndExpenses
    ? normalizeMetricTotals(totals.purchasesAndExpenses, 'cashPaid')
    : combineMetricTotals(purchasesTotals, expensesTotals, 'cashPaid');

  const rawSalesSeries = hasMergedRevenueContract
    ? normalizeBreakdownSeries(series.sales, {
      totalKeys: ['total', 'salesAndServicesTotal', 'salesTotal', 'amount', 'value'],
      cashKeys: ['cashReceived', 'salesAndServicesCashReceived', 'salesCashReceived'],
      pendingKeys: ['pending', 'salesAndServicesPending', 'salesPending'],
      cashField: 'received',
    })
    : [];
  const rawDirectSalesSeries = normalizeBreakdownSeries(
    hasMergedRevenueContract ? series.directSales : series.sales,
    {
      totalKeys: ['total', 'directSalesTotal', 'salesTotal', 'amount', 'value'],
      cashKeys: ['cashReceived', 'directSalesCashReceived', 'salesCashReceived'],
      pendingKeys: ['pending', 'directSalesPending', 'salesPending'],
      cashField: 'received',
    }
  );
  const rawServicesSeries = normalizeBreakdownSeries(series.services, {
    totalKeys: ['total', 'serviceTotal', 'amount', 'value'],
    cashKeys: ['cashReceived', 'serviceCashReceived'],
    pendingKeys: ['pending', 'servicePending'],
    cashField: 'received',
  });
  const rawPurchasesSeries = normalizeBreakdownSeries(series.purchases, {
    totalKeys: ['total', 'purchaseTotal', 'amount', 'value'],
    cashKeys: ['cashPaid', 'purchaseCashPaid'],
    pendingKeys: ['pending', 'purchasePending'],
    cashField: 'paid',
  });
  const rawExpensesSeries = normalizeBreakdownSeries(series.expenses, {
    totalKeys: ['total', 'expenseTotal', 'directExpenseTotal', 'amount', 'value'],
    cashKeys: ['cashPaid', 'expenseCashPaid', 'directExpenseCashPaid'],
    pendingKeys: ['pending', 'expensePending', 'directExpensePending'],
    cashField: 'paid',
  });
  const rawOutgoingSeries = normalizeBreakdownSeries(series.purchasesAndExpenses, {
    totalKeys: ['total', 'purchaseAndExpenseTotal', 'purchasesAndExpensesTotal', 'totalExpenses', 'amount', 'value'],
    cashKeys: ['cashPaid', 'purchaseAndExpenseCashPaid', 'cashOutTotal'],
    pendingKeys: ['pending', 'purchaseAndExpensePending'],
    cashField: 'paid',
  });
  const rawProfitLossSeries = normalizeProfitLossSeries(series.profitLoss);

  const fallbackSales = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.salesTotal,
    received: point.salesCashReceived,
    pending: point.salesPending,
  }));
  const fallbackDirectSales = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.directSalesTotal,
    received: point.directSalesCashReceived,
    pending: point.directSalesPending,
  }));
  const fallbackServices = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.serviceTotal,
    received: point.serviceCashReceived,
    pending: point.servicePending,
  }));
  const fallbackPurchases = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.purchaseTotal,
    paid: point.purchaseCashPaid,
    pending: point.purchasePending,
  }));
  const fallbackExpenses = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.expenseTotal,
    paid: point.expenseCashPaid,
    pending: point.expensePending,
  }));
  const fallbackOutgoing = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.purchasesAndExpensesTotal,
    paid: point.purchasesAndExpensesCashPaid,
    pending: point.purchasesAndExpensesPending,
  }));
  const fallbackProfitLoss = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    revenue: point.salesTotal,
    directSales: point.directSalesTotal,
    services: point.serviceTotal,
    purchases: point.purchaseTotal,
    expenses: point.expenseTotal,
    totalExpenses: point.purchasesAndExpensesTotal,
    profitOrLoss: point.profitOrLoss,
    status: point.profitOrLossStatus,
  }));

  return {
    totals: {
      sales: salesTotals,
      directSales: directSalesTotals,
      services: servicesTotals,
      purchases: purchasesTotals,
      expenses: expensesTotals,
      purchasesAndExpenses: purchasesAndExpensesTotals,
      combined: normalizeCombinedTotals(totals.combined, salesTotals, purchasesAndExpensesTotals),
    },
    series: {
      sales: rawSalesSeries.length > 0 ? rawSalesSeries : fallbackSales,
      directSales: rawDirectSalesSeries.length > 0 ? rawDirectSalesSeries : fallbackDirectSales,
      services: rawServicesSeries.length > 0 ? rawServicesSeries : fallbackServices,
      purchases: rawPurchasesSeries.length > 0 ? rawPurchasesSeries : fallbackPurchases,
      expenses: rawExpensesSeries.length > 0 ? rawExpensesSeries : fallbackExpenses,
      purchasesAndExpenses: rawOutgoingSeries.length > 0 ? rawOutgoingSeries : fallbackOutgoing,
      profitLoss: rawProfitLossSeries.length > 0 ? rawProfitLossSeries : fallbackProfitLoss,
      timeline,
    },
  };
}

function normalizeProfitLossResponse(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const summarySource = summary?.summary || {};
  const profitLossSource = summarySource?.profitLoss || {};
  const currentSource = summarySource?.current || {};
  const series = normalizeProfitLossSeries(summary?.series?.profitLoss || summary?.series?.timeline || []);
  const totalExpenses = firstNumber(profitLossSource, ['totalExpenses']) ?? 0;
  const totalAmount = firstNumber(profitLossSource, ['amount', 'profitOrLoss']) ?? 0;
  const currentAmount = firstNumber(currentSource, ['amount', 'profitOrLoss']) ?? 0;

  return {
    summary: {
      profitLoss: {
        revenue: firstNumber(profitLossSource, ['revenue']) ?? 0,
        purchases: firstNumber(profitLossSource, ['purchases']) ?? 0,
        expenses: firstNumber(profitLossSource, ['expenses']) ?? 0,
        totalExpenses,
        amount: totalAmount,
        status: profitLossSource?.status || getProfitLossStatus(totalAmount),
      },
      current: {
        label: currentSource?.label || '',
        revenue: firstNumber(currentSource, ['revenue']) ?? 0,
        directSales: firstNumber(currentSource, ['directSales']) ?? 0,
        services: firstNumber(currentSource, ['services']) ?? 0,
        purchases: firstNumber(currentSource, ['purchases']) ?? 0,
        expenses: firstNumber(currentSource, ['expenses']) ?? 0,
        totalExpenses: firstNumber(currentSource, ['totalExpenses']) ?? 0,
        amount: currentAmount,
        status: currentSource?.status || getProfitLossStatus(currentAmount),
      },
    },
    series: {
      profitLoss: series,
    },
  };
}

function buildProfitLossFallback(summary) {
  const latestPoint = summary.series.profitLoss[summary.series.profitLoss.length - 1] || null;

  return {
    summary: {
      profitLoss: {
        revenue: summary.totals.sales.total,
        purchases: summary.totals.purchases.total,
        expenses: summary.totals.expenses.total,
        totalExpenses: summary.totals.purchasesAndExpenses.total,
        amount: summary.totals.combined.profitOrLoss,
        status: summary.totals.combined.profitOrLossStatus,
      },
      current: latestPoint
        ? {
          label: latestPoint.label,
          revenue: latestPoint.revenue,
          directSales: latestPoint.directSales,
          services: latestPoint.services,
          purchases: latestPoint.purchases,
          expenses: latestPoint.expenses,
          totalExpenses: latestPoint.totalExpenses,
          amount: latestPoint.profitOrLoss,
          status: latestPoint.status,
        }
        : { ...EMPTY_PROFIT_LOSS.summary.current },
    },
    series: {
      profitLoss: summary.series.profitLoss,
    },
  };
}

function metricToneClasses(tone, value) {
  if (tone === 'success') return 'text-emerald-600 dark:text-emerald-400';
  if (tone === 'danger') return 'text-rose-600 dark:text-rose-400';
  if (tone === 'info') return 'text-sky-600 dark:text-sky-400';
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  if (tone === 'net') {
    return asNumber(value) < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-emerald-600 dark:text-emerald-400';
  }

  return 'text-slate-500 dark:text-slate-400';
}

function formatQuantityValue(value) {
  return asNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function PopularRankingCard({
  title,
  subtitle,
  rows,
  loading,
  error,
  emptyLabel,
  typeLabel,
  t,
  formatMoney,
}) {
  return (
    <div className="card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Top 10
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
      ) : error ? (
        <Notice title={error} tone="error" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('analytics.rank')}</th>
                <th className="py-2 text-left">{typeLabel}</th>
                <th className="py-2 text-right">{t('analytics.quantity')}</th>
                <th className="py-2 text-right">{t('analytics.orderCount')}</th>
                <th className="py-2 text-right">{t('analytics.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.rank}-${row.productId || row.categoryId || row.name || row.categoryName}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                  <td className="py-3 font-semibold text-slate-900 dark:text-white">#{row.rank}</td>
                  <td className="py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{row.name || row.categoryName || '-'}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.sku ? <span>{t('analytics.sku')}: {row.sku}</span> : null}
                        {row.categoryName && row.name ? <span>{t('analytics.categoryName')}: {row.categoryName}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium text-slate-900 dark:text-white">{formatQuantityValue(row.totalQuantity)}</td>
                  <td className="py-3 text-right">{formatQuantityValue(row.orderCount)}</td>
                  <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">{formatMoney(row.totalRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(() => EMPTY_SUMMARY);
  const [profitLoss, setProfitLoss] = useState(() => EMPTY_PROFIT_LOSS);
  const [popularItems, setPopularItems] = useState(() => EMPTY_POPULAR_ANALYTICS);
  const [popularCategories, setPopularCategories] = useState(() => EMPTY_POPULAR_ANALYTICS);
  const [popularItemsError, setPopularItemsError] = useState('');
  const [popularCategoriesError, setPopularCategoriesError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    fromDate: dayjs().startOf('month').format('YYYY-MM-DD'),
    toDate: todayISODate(),
    groupBy: 'auto',
    partyId: '',
    createdBy: '',
  });
  const [selectedPartyFilterOption, setSelectedPartyFilterOption] = useState(null);

  useEffect(() => {
    let isActive = true;

    setLoading(true);
    setStatus('');

    const params = {
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      groupBy: filters.groupBy || 'auto',
      partyId: filters.partyId || undefined,
      createdBy: filters.createdBy || undefined,
    };

    Promise.allSettled([
      api.getAnalyticsSummary(params),
      api.getAnalyticsProfitLoss(params),
      api.getPopularItemsAnalytics({
        from: filters.fromDate || undefined,
        to: filters.toDate || undefined,
        limit: 10,
      }),
      api.getPopularCategoriesAnalytics({
        from: filters.fromDate || undefined,
        to: filters.toDate || undefined,
        limit: 10,
      }),
    ])
      .then(([summaryResult, profitLossResult, popularItemsResult, popularCategoriesResult]) => {
        if (!isActive) return;

        if (summaryResult.status !== 'fulfilled') {
          setSummary(EMPTY_SUMMARY);
          setProfitLoss(EMPTY_PROFIT_LOSS);
          setPopularItems(EMPTY_POPULAR_ANALYTICS);
          setPopularCategories(EMPTY_POPULAR_ANALYTICS);
          setStatus(summaryResult.reason?.message || t('auth.errors.generic'));
          return;
        }

        const nextSummary = normalizeAnalyticsSummary(summaryResult.value);
        setSummary(nextSummary);

        if (profitLossResult.status === 'fulfilled') {
          setProfitLoss(normalizeProfitLossResponse(profitLossResult.value));
        } else {
          setProfitLoss(buildProfitLossFallback(nextSummary));
        }

        if (popularItemsResult.status === 'fulfilled') {
          setPopularItems(popularItemsResult.value || EMPTY_POPULAR_ANALYTICS);
          setPopularItemsError('');
        } else {
          setPopularItems(EMPTY_POPULAR_ANALYTICS);
          setPopularItemsError(popularItemsResult.reason?.message || t('auth.errors.generic'));
        }

        if (popularCategoriesResult.status === 'fulfilled') {
          setPopularCategories(popularCategoriesResult.value || EMPTY_POPULAR_ANALYTICS);
          setPopularCategoriesError('');
        } else {
          setPopularCategories(EMPTY_POPULAR_ANALYTICS);
          setPopularCategoriesError(popularCategoriesResult.reason?.message || t('auth.errors.generic'));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setSummary(EMPTY_SUMMARY);
        setProfitLoss(EMPTY_PROFIT_LOSS);
        setPopularItems(EMPTY_POPULAR_ANALYTICS);
        setPopularCategories(EMPTY_POPULAR_ANALYTICS);
        setStatus(error.message || t('auth.errors.generic'));
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filters.createdBy, filters.fromDate, filters.groupBy, filters.partyId, filters.toDate, t]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handlePartyFilterChange = (option) => {
    setSelectedPartyFilterOption(option || null);
    setFilters((prev) => ({ ...prev, partyId: option?.value || '' }));
  };

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

  const formatCompactMoney = (value) => {
    return formatCurrency(asNumber(value), { symbol: t('currency.symbol'), compact: true });
  };

  const renderSummaryLines = (items) => (
    <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
      {items.map((item) => (
        <p key={item.label} className={`flex items-center justify-between gap-3 ${metricToneClasses(item.tone, item.value)}`}>
          <span>{item.label}</span>
          <span className="font-medium">{formatMoney(item.value)}</span>
        </p>
      ))}
    </div>
  );

  const renderTimelineCell = (primary, items, emphasize = false) => (
    <td className="py-2 text-right">
      <div className="flex min-w-[10rem] flex-col items-end gap-1">
        <span className={emphasize ? `font-semibold ${metricToneClasses('net', primary)}` : 'font-medium text-slate-900 dark:text-white'}>
          {formatMoney(primary)}
        </span>
        {items.map((item) => (
          <span key={item.label} className={`text-xs ${metricToneClasses(item.tone, item.value)}`}>
            {item.label}: {formatMoney(item.value)}
          </span>
        ))}
      </div>
    </td>
  );

  const pieData = useMemo(() => ([
    { name: t('analytics.salesAndServices'), value: summary.totals.sales.total },
    { name: t('nav.purchases'), value: summary.totals.purchases.total },
    { name: t('analytics.expenses'), value: summary.totals.expenses.total },
  ]), [summary.totals.expenses.total, summary.totals.purchases.total, summary.totals.sales.total, t]);

  const seriesCaption = useMemo(() => {
    const labelMap = {
      auto: t('analytics.filters.auto'),
      day: t('analytics.filters.day'),
      week: t('analytics.filters.week'),
      month: t('analytics.filters.month'),
    };

    return `${labelMap[filters.groupBy] || labelMap.auto} | ${filters.fromDate || '-'} to ${filters.toDate || '-'}`;
  }, [filters.fromDate, filters.groupBy, filters.toDate, t]);

  const profitLossValueClass = metricToneClasses('net', profitLoss.summary.profitLoss.amount);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.subtitle')}
      />

      {status ? <Notice title={status} tone="error" /> : null}

      <div className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="label">{t('common.from')}</label>
            <input
              type="date"
              className="input mt-1"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('common.to')}</label>
            <input
              type="date"
              className="input mt-1"
              name="toDate"
              value={filters.toDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('analytics.filters.groupBy')}</label>
            <select className="input mt-1" name="groupBy" value={filters.groupBy} onChange={handleFilterChange}>
              <option value="auto">{t('analytics.filters.auto')}</option>
              <option value="day">{t('analytics.filters.day')}</option>
              <option value="week">{t('analytics.filters.week')}</option>
              <option value="month">{t('analytics.filters.month')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('services.filterByParty')}</label>
            <PartyFilterSelect
              className="mt-1"
              type="customer"
              value={filters.partyId}
              selectedOption={selectedPartyFilterOption}
              onChange={handlePartyFilterChange}
              placeholder={t('services.allParties')}
              searchPlaceholder={t('parties.searchPlaceholder')}
              showPhone={false}
            />
          </div>
          <div>
            <label className="label">{t('filters.createdBy')}</label>
            <CreatorFilterSelect
              className="mt-1"
              value={filters.createdBy}
              onChange={(value) => setFilters((prev) => ({ ...prev, createdBy: value }))}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">{loading ? t('common.loading') : seriesCaption}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.salesAndServices')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.sales.total)}</p>
          {renderSummaryLines([
            { label: t('analytics.directSales'), value: summary.totals.directSales.total, tone: 'info' },
            { label: t('nav.services'), value: summary.totals.services.total, tone: 'info' },
          ])}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.purchaseSpend')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.purchases.total)}</p>
          {renderSummaryLines([
            { label: t('analytics.paid'), value: summary.totals.purchases.cashPaid, tone: 'success' },
            { label: t('analytics.pending'), value: summary.totals.purchases.pending, tone: 'danger' },
          ])}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.expenses')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.expenses.total)}</p>
          {renderSummaryLines([
            { label: t('analytics.paid'), value: summary.totals.expenses.cashPaid, tone: 'warning' },
            { label: t('analytics.pending'), value: summary.totals.expenses.pending, tone: 'danger' },
          ])}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.profitLoss')}</p>
          <p className={`mt-2 text-2xl font-semibold ${profitLossValueClass}`}>{formatMoney(profitLoss.summary.profitLoss.amount)}</p>
          {renderSummaryLines([
            { label: t('analytics.salesAndServices'), value: profitLoss.summary.profitLoss.revenue, tone: 'success' },
            { label: t('analytics.totalOutgoing'), value: profitLoss.summary.profitLoss.totalExpenses, tone: 'warning' },
          ])}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title={t('analytics.salesTrend')}
          caption={seriesCaption}
          data={summary.series.sales}
          nameKey="label"
          bars={[
            { dataKey: 'received', label: t('analytics.received'), color: '#10b981' },
            { dataKey: 'pending', label: t('analytics.pending'), color: '#facc15' },
          ]}
          valueFormatter={formatMoney}
          axisFormatter={formatCompactMoney}
        />
        <BarGraph
          title={t('analytics.outgoingTrend')}
          caption={seriesCaption}
          data={summary.series.purchasesAndExpenses}
          nameKey="label"
          bars={[
            { dataKey: 'paid', label: t('analytics.paid'), color: '#d97706' },
            { dataKey: 'pending', label: t('analytics.pending'), color: '#f97316' },
          ]}
          valueFormatter={formatMoney}
          axisFormatter={formatCompactMoney}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title={t('analytics.profitLossTrend')}
          caption={seriesCaption}
          data={profitLoss.series.profitLoss}
          nameKey="label"
          bars={[
            { dataKey: 'revenue', label: t('analytics.salesAndServices'), color: '#10b981' },
            { dataKey: 'totalExpenses', label: t('analytics.totalOutgoing'), color: '#f59e0b' },
            { dataKey: 'profitOrLoss', label: t('analytics.profitLoss'), color: '#0f172a' },
          ]}
          valueFormatter={formatMoney}
          axisFormatter={formatCompactMoney}
        />
        <div className="card">
          <h3 className="mb-4 font-serif text-xl text-slate-900 dark:text-white">{t('analytics.overallMix')}</h3>
          <div className="h-[350px]">
            <PieChart data={pieData} height={350} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PopularRankingCard
          title={t('analytics.popularItems')}
          subtitle={t('analytics.popularSubtitle')}
          rows={popularItems.items}
          loading={loading}
          error={popularItemsError}
          emptyLabel={t('analytics.noPopularItems')}
          typeLabel={t('nav.items')}
          t={t}
          formatMoney={formatMoney}
        />
        <PopularRankingCard
          title={t('analytics.popularCategories')}
          subtitle={t('analytics.popularSubtitle')}
          rows={popularCategories.items}
          loading={loading}
          error={popularCategoriesError}
          emptyLabel={t('analytics.noPopularCategories')}
          typeLabel={t('analytics.categoryName')}
          t={t}
          formatMoney={formatMoney}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('analytics.timelineSummary')}</h3>
          <span className="text-xs text-slate-500">{summary.series.timeline.length} {t('analytics.points')}</span>
        </div>

        {summary.series.timeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t('analytics.noSeries')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 text-left">{t('analytics.period')}</th>
                  <th className="py-2 text-right">{t('analytics.salesAndServices')}</th>
                  <th className="py-2 text-right">{t('nav.purchases')}</th>
                  <th className="py-2 text-right">{t('analytics.expenses')}</th>
                  <th className="py-2 text-right">{t('analytics.profitLoss')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.series.timeline.map((row) => (
                  <tr key={row.key} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{row.label}</td>
                    {renderTimelineCell(row.salesTotal, [
                      { label: t('analytics.directSales'), value: row.directSalesTotal, tone: 'info' },
                      { label: t('nav.services'), value: row.serviceTotal, tone: 'info' },
                    ])}
                    {renderTimelineCell(row.purchaseTotal, [
                      { label: t('analytics.paid'), value: row.purchaseCashPaid, tone: 'success' },
                      { label: t('analytics.pending'), value: row.purchasePending, tone: 'danger' },
                    ])}
                    {renderTimelineCell(row.expenseTotal, [
                      { label: t('analytics.paid'), value: row.expenseCashPaid, tone: 'warning' },
                      { label: t('analytics.pending'), value: row.expensePending, tone: 'danger' },
                    ])}
                    {renderTimelineCell(row.profitOrLoss, [
                      { label: t('analytics.totalOutgoing'), value: row.purchasesAndExpensesTotal, tone: 'warning' },
                      { label: t('analytics.salesAndServices'), value: row.salesTotal, tone: 'success' },
                    ], true)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
