import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import BarGraph from '../components/BarGraph';
import PieChart from '../components/PieChart';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { todayISODate } from '../lib/datetime';

const EMPTY_SUMMARY = Object.freeze({
  totals: {
    sales: 0,
    purchases: 0,
    services: 0,
    combined: 0,
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

function normalizeMetricSeries(items, valueKeys) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.key;
    const value = firstNumber(item, valueKeys) ?? 0;

    return {
      key: String(item?.key || item?.period || item?.date || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      value,
    };
  });
}

function normalizeTimelineSeries(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const sales = firstNumber(item, ['sales', 'salesTotal', 'salesAmount']) ?? 0;
    const purchases = firstNumber(item, ['purchases', 'purchaseTotal', 'purchaseAmount']) ?? 0;
    const services = firstNumber(item, ['services', 'serviceTotal', 'serviceAmount']) ?? 0;
    const combined = firstNumber(item, ['combined', 'combinedTotal', 'total']) ?? (sales + purchases + services);
    const rawLabel = item?.label || item?.periodLabel || item?.period || item?.date || item?.key;

    return {
      key: String(item?.key || item?.period || item?.date || index),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      sales,
      purchases,
      services,
      combined,
    };
  });
}

function normalizeAnalyticsSummary(payload = {}) {
  const summary = payload && typeof payload === 'object' ? payload : {};
  const totals = summary?.totals || {};
  const series = summary?.series || {};
  const timeline = normalizeTimelineSeries(series.timeline);
  const salesSeries = normalizeMetricSeries(series.sales, ['value', 'sales', 'total', 'amount']);
  const purchaseSeries = normalizeMetricSeries(series.purchases, ['value', 'purchases', 'total', 'amount']);
  const serviceSeries = normalizeMetricSeries(series.services, ['value', 'services', 'total', 'amount']);

  const fallbackSales = timeline.map((point) => ({ key: point.key, label: point.label, value: point.sales }));
  const fallbackPurchases = timeline.map((point) => ({ key: point.key, label: point.label, value: point.purchases }));
  const fallbackServices = timeline.map((point) => ({ key: point.key, label: point.label, value: point.services }));

  return {
    totals: {
      sales: asNumber(totals.sales),
      purchases: asNumber(totals.purchases),
      services: asNumber(totals.services),
      combined: asNumber(totals.combined ?? (asNumber(totals.sales) + asNumber(totals.purchases) + asNumber(totals.services))),
    },
    series: {
      sales: salesSeries.length > 0 ? salesSeries : fallbackSales,
      purchases: purchaseSeries.length > 0 ? purchaseSeries : fallbackPurchases,
      services: serviceSeries.length > 0 ? serviceSeries : fallbackServices,
      timeline,
    },
  };
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
  });

  useEffect(() => {
    let isActive = true;

    setLoading(true);
    setStatus('');

    api.getAnalyticsSummary({
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      groupBy: filters.groupBy || 'auto',
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
  }, [filters.fromDate, filters.groupBy, filters.toDate]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
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

  const pieData = useMemo(() => ([
    { name: t('nav.sales'), value: summary.totals.sales },
    { name: t('nav.services'), value: summary.totals.services },
    { name: t('nav.purchases'), value: summary.totals.purchases },
  ]), [summary.totals.purchases, summary.totals.sales, summary.totals.services, t]);

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
        <div className="grid gap-4 md:grid-cols-3">
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
        </div>
        <p className="text-xs text-slate-500">{loading ? t('common.loading') : seriesCaption}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.salesRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.sales)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.servicesRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.services)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.purchaseSpend')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.purchases)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">{t('analytics.combinedRevenue')}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.totals.combined)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title={t('analytics.salesTrend')}
          caption={seriesCaption}
          data={summary.series.sales}
          dataKey="value"
          nameKey="label"
          color="#10b981"
        />
        <BarGraph
          title={t('analytics.servicesTrend')}
          caption={seriesCaption}
          data={summary.series.services}
          dataKey="value"
          nameKey="label"
          color="#3b82f6"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title={t('analytics.purchaseTrend')}
          caption={seriesCaption}
          data={summary.series.purchases}
          dataKey="value"
          nameKey="label"
          color="#f59e0b"
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
                    <td className="py-2 text-right">{formatMoney(row.sales)}</td>
                    <td className="py-2 text-right">{formatMoney(row.purchases)}</td>
                    <td className="py-2 text-right">{formatMoney(row.services)}</td>
                    <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">{formatMoney(row.combined)}</td>
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
