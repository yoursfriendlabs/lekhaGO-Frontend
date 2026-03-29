import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import BarGraph from '../components/BarGraph';
import PieChart from '../components/PieChart';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import CreatorFilterSelect from '../components/CreatorFilterSelect.jsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { todayISODate } from '../lib/datetime';

const EMPTY_SUMMARY = Object.freeze({
  totals: {
    sales: { count: 0, total: 0, cashReceived: 0, pending: 0 },
    purchases: { count: 0, total: 0, cashPaid: 0, pending: 0 },
    services: { count: 0, total: 0, cashReceived: 0, pending: 0 },
    combined: {
      revenue: 0,
      expenses: 0,
      cashIn: 0,
      cashOut: 0,
      netCash: 0,
      pendingReceivable: 0,
      pendingPayable: 0,
    },
  },
  series: {
    sales: [],
    purchases: [],
    services: [],
    timeline: [],
  },
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

function normalizeMetricTotals(source, receivedKey) {
  const base = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const totalFallback = asNumber(source);

  return {
    count: asNumber(base.count),
    total: firstNumber(base, ['total', 'amount']) ?? totalFallback,
    [receivedKey]: firstNumber(base, [receivedKey]) ?? 0,
    pending: asNumber(base.pending),
  };
}

function normalizeCombinedTotals(source) {
  const base = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const revenue = firstNumber(base, ['revenue', 'revenueTotal', 'total']) ?? asNumber(source);
  const expenses = firstNumber(base, ['expenses', 'expenseTotal']) ?? 0;
  const cashIn = firstNumber(base, ['cashIn', 'cashInTotal']) ?? 0;
  const cashOut = firstNumber(base, ['cashOut', 'cashOutTotal']) ?? 0;

  return {
    revenue,
    expenses,
    cashIn,
    cashOut,
    netCash: firstNumber(base, ['netCash']) ?? (cashIn - cashOut),
    pendingReceivable: firstNumber(base, ['pendingReceivable']) ?? 0,
    pendingPayable: firstNumber(base, ['pendingPayable']) ?? 0,
  };
}

function normalizeBreakdownSeries(items, { totalKeys, receivedKeys, pendingKeys, receivedField = 'received' }) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.bucketStart || item?.key;

    return {
      key: String(item?.key || item?.period || item?.date || item?.bucketStart || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      total: firstNumber(item, totalKeys) ?? 0,
      [receivedField]: firstNumber(item, receivedKeys) ?? 0,
      pending: firstNumber(item, pendingKeys) ?? 0,
    };
  });
}

function normalizeTimelineSeries(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.bucketStart || item?.key;

    return {
      key: String(item?.key || item?.period || item?.date || item?.bucketStart || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      salesTotal: firstNumber(item, ['salesTotal', 'sales', 'salesAmount']) ?? 0,
      salesCashReceived: firstNumber(item, ['salesCashReceived']) ?? 0,
      salesPending: firstNumber(item, ['salesPending']) ?? 0,
      purchaseTotal: firstNumber(item, ['purchaseTotal', 'purchases', 'purchaseAmount']) ?? 0,
      purchaseCashPaid: firstNumber(item, ['purchaseCashPaid']) ?? 0,
      purchasePending: firstNumber(item, ['purchasePending']) ?? 0,
      serviceTotal: firstNumber(item, ['serviceTotal', 'services', 'serviceAmount']) ?? 0,
      serviceCashReceived: firstNumber(item, ['serviceCashReceived']) ?? 0,
      servicePending: firstNumber(item, ['servicePending']) ?? 0,
      revenueTotal: firstNumber(item, ['revenueTotal', 'combined', 'combinedTotal', 'total']) ?? 0,
      expenseTotal: firstNumber(item, ['expenseTotal']) ?? 0,
      cashInTotal: firstNumber(item, ['cashInTotal']) ?? 0,
      cashOutTotal: firstNumber(item, ['cashOutTotal']) ?? 0,
      netCash: firstNumber(item, ['netCash']) ?? 0,
    };
  });
}

function normalizeAnalyticsSummary(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const totals = summary?.totals || {};
  const series = summary?.series || {};
  const timeline = normalizeTimelineSeries(series.timeline);
  const salesSeries = normalizeBreakdownSeries(series.sales, {
    totalKeys: ['total', 'salesTotal', 'amount', 'value'],
    receivedKeys: ['cashReceived', 'salesCashReceived'],
    pendingKeys: ['pending', 'salesPending'],
    receivedField: 'received',
  });
  const purchaseSeries = normalizeBreakdownSeries(series.purchases, {
    totalKeys: ['total', 'purchaseTotal', 'amount', 'value'],
    receivedKeys: ['cashPaid', 'purchaseCashPaid'],
    pendingKeys: ['pending', 'purchasePending'],
    receivedField: 'paid',
  });
  const serviceSeries = normalizeBreakdownSeries(series.services, {
    totalKeys: ['total', 'serviceTotal', 'amount', 'value'],
    receivedKeys: ['cashReceived', 'serviceCashReceived'],
    pendingKeys: ['pending', 'servicePending'],
    receivedField: 'received',
  });

  const fallbackSales = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.salesTotal,
    received: point.salesCashReceived,
    pending: point.salesPending,
  }));
  const fallbackPurchases = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.purchaseTotal,
    paid: point.purchaseCashPaid,
    pending: point.purchasePending,
  }));
  const fallbackServices = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.serviceTotal,
    received: point.serviceCashReceived,
    pending: point.servicePending,
  }));

  return {
    totals: {
      sales: normalizeMetricTotals(totals.sales, 'cashReceived'),
      purchases: normalizeMetricTotals(totals.purchases, 'cashPaid'),
      services: normalizeMetricTotals(totals.services, 'cashReceived'),
      combined: normalizeCombinedTotals(totals.combined),
    },
    series: {
      sales: salesSeries.length > 0 ? salesSeries : fallbackSales,
      purchases: purchaseSeries.length > 0 ? purchaseSeries : fallbackPurchases,
      services: serviceSeries.length > 0 ? serviceSeries : fallbackServices,
      timeline,
    },
  };
}

function metricToneClasses(tone, value) {
  if (tone === 'success') return 'text-emerald-600 dark:text-emerald-400';
  if (tone === 'danger') return 'text-rose-600 dark:text-rose-400';
  if (tone === 'net') {
    return asNumber(value) < 0
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-emerald-600 dark:text-emerald-400';
  }

  return 'text-slate-500 dark:text-slate-400';
}

export default function Analytics() {
  const { t } = useI18n();
  const [summary, setSummary] = useState(() => EMPTY_SUMMARY);
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

    api.getAnalyticsSummary({
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      groupBy: filters.groupBy || 'auto',
      partyId: filters.partyId || undefined,
      createdBy: filters.createdBy || undefined,
    })
      .then((data) => {
        if (!isActive) return;
        setSummary(normalizeAnalyticsSummary(data));
      })
      .catch((err) => {
        if (!isActive) return;
        setSummary(EMPTY_SUMMARY);
        setStatus(err.message);
      })
      .finally(() => {
        if (!isActive) return;
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [filters.createdBy, filters.fromDate, filters.groupBy, filters.partyId, filters.toDate]);

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
    const amount = asNumber(value);
    return `${t('currency.symbol')} ${amount.toLocaleString(undefined, {
      notation: 'compact',
      maximumFractionDigits: 1,
    })}`;
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
      <div className="flex min-w-[9rem] flex-col items-end gap-1">
        <span className={emphasize ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-900 dark:text-white'}>
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
    { name: t('nav.sales'), value: summary.totals.sales.total },
    { name: t('nav.services'), value: summary.totals.services.total },
    { name: t('nav.purchases'), value: summary.totals.purchases.total },
  ]), [summary.totals.purchases.total, summary.totals.sales.total, summary.totals.services.total, t]);

  const seriesCaption = useMemo(() => {
    const labelMap = {
      auto: t('analytics.filters.auto'),
      day: t('analytics.filters.day'),
      week: t('analytics.filters.week'),
      month: t('analytics.filters.month'),
    };

    return `${labelMap[filters.groupBy] || labelMap.auto} | ${filters.fromDate || '-'} to ${filters.toDate || '-'}`;
  }, [filters.fromDate, filters.groupBy, filters.toDate, t]);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.salesRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.sales.total)}</p>
          {renderSummaryLines([
            { label: t('analytics.received'), value: summary.totals.sales.cashReceived, tone: 'success' },
            { label: t('analytics.pending'), value: summary.totals.sales.pending, tone: 'danger' },
          ])}
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.servicesRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.services.total)}</p>
          {renderSummaryLines([
            { label: t('analytics.received'), value: summary.totals.services.cashReceived, tone: 'success' },
            { label: t('analytics.pending'), value: summary.totals.services.pending, tone: 'danger' },
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
          <p className="text-xs uppercase text-slate-400">{t('analytics.combinedRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.combined.revenue)}</p>
          {renderSummaryLines([
            { label: t('analytics.cashIn'), value: summary.totals.combined.cashIn, tone: 'success' },
            { label: t('analytics.pendingReceivable'), value: summary.totals.combined.pendingReceivable, tone: 'danger' },
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
          title={t('analytics.servicesTrend')}
          caption={seriesCaption}
          data={summary.series.services}
          nameKey="label"
          bars={[
            { dataKey: 'received', label: t('analytics.received'), color: '#3b82f6' },
            { dataKey: 'pending', label: t('analytics.pending'), color: '#facc15' },
          ]}
          valueFormatter={formatMoney}
          axisFormatter={formatCompactMoney}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title={t('analytics.purchaseTrend')}
          caption={seriesCaption}
          data={summary.series.purchases}
          nameKey="label"
          bars={[
            { dataKey: 'paid', label: t('analytics.paid'), color: '#d97706' },
            { dataKey: 'pending', label: t('analytics.pending'), color: '#facc15' },
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
                  <th className="py-2 text-right">{t('nav.sales')}</th>
                  <th className="py-2 text-right">{t('nav.purchases')}</th>
                  <th className="py-2 text-right">{t('nav.services')}</th>
                  <th className="py-2 text-right">{t('analytics.combined')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.series.timeline.map((row) => (
                  <tr key={row.key} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{row.label}</td>
                    {renderTimelineCell(row.salesTotal, [
                      { label: t('analytics.received'), value: row.salesCashReceived, tone: 'success' },
                      { label: t('analytics.pending'), value: row.salesPending, tone: 'danger' },
                    ])}
                    {renderTimelineCell(row.purchaseTotal, [
                      { label: t('analytics.paid'), value: row.purchaseCashPaid, tone: 'success' },
                      { label: t('analytics.pending'), value: row.purchasePending, tone: 'danger' },
                    ])}
                    {renderTimelineCell(row.serviceTotal, [
                      { label: t('analytics.received'), value: row.serviceCashReceived, tone: 'success' },
                      { label: t('analytics.pending'), value: row.servicePending, tone: 'danger' },
                    ])}
                    {renderTimelineCell(row.revenueTotal, [
                      { label: t('analytics.cashIn'), value: row.cashInTotal, tone: 'success' },
                      { label: t('analytics.netCash'), value: row.netCash, tone: 'net' },
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
