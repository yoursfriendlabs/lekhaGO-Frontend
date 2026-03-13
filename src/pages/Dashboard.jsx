import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import { ShoppingCart, UserCheck, Briefcase, Boxes, Package, BarChart3 } from 'lucide-react';
import { useI18n } from '../lib/i18n.jsx';


function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString();
}

function buildSeries(items, dateKey) {
  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: 0 };
  });
  const map = Object.fromEntries(days.map((d) => [d.key, d]));
  items.forEach((item) => {
    const raw = item[dateKey] || item.createdAt;
    if (!raw) return;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (map[key]) map[key].value += Number(item.grandTotal || 0);
  });
  return days;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRangeStart(range) {
  const now = new Date();
  if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    return start;
  }
  if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  return new Date(now.getFullYear(), 0, 1);
}

function isWithinRange(value, rangeStart, rangeEnd) {
  const date = parseDate(value);
  if (!date) return false;
  return date >= rangeStart && date <= rangeEnd;
}

function BarChart({ title, series, formatMoney, last7Label }) {
  const { t } = useI18n();
  const max = Math.max(...series.map((d) => d.value), 1);
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-500">{last7Label}</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2 items-end">
        {series.map((point) => (
          <div key={point.key} className="flex flex-col items-center gap-2">
            <div className="h-20 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-end">
              <div
                className="w-full rounded-full bg-emerald-300 dark:bg-ocean"
                style={{ height: `${(point.value / max) * 100}%` }}
                title={formatMoney(point.value)}
              />
            </div>
            <span className="text-[10px] text-slate-500">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const rangeOptions = [
    { key: 'today', label: t('dashboard.filters.today') },
    { key: 'week', label: t('dashboard.filters.week') },
    { key: 'month', label: t('dashboard.filters.month') },
    { key: 'year', label: t('dashboard.filters.year') },
  ];
  const [dateRange, setDateRange] = useState('month');
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [services, setServices] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('');
  const formatMoney = (value) => {
    const amount = Number(value || 0);
    const formatted = amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return t('currency.formatted', { symbol: t('currency.symbol'), amount: formatted });
  };
  const rangeStart = useMemo(() => getRangeStart(dateRange), [dateRange]);
  const rangeEnd = useMemo(() => new Date(), [dateRange]);
  const filterByRange = useCallback(
    (items, dateKey) =>
      items.filter((item) => {
        const raw = item?.[dateKey] || item?.createdAt || item?.updatedAt;
        return isWithinRange(raw, rangeStart, rangeEnd);
      }),
    [rangeStart, rangeEnd],
  );

  useEffect(() => {
    Promise.all([
      api.listSales({ limit: 50 }),
      api.listPurchases({ limit: 50 }),
      api.listServices({ limit: 20 }),
      api.lowStock({ threshold: 5 }),
      api.listProducts(),
    ])
      .then(([salesData, purchaseData, serviceData, lowStockData, productData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
        setServices(serviceData || []);
        setLowStock(lowStockData || []);
        setProducts(productData || []);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  const filteredSales = useMemo(() => filterByRange(sales, 'saleDate'), [sales, filterByRange]);
  const filteredPurchases = useMemo(() => filterByRange(purchases, 'purchaseDate'), [purchases, filterByRange]);
  const filteredServices = useMemo(() => filterByRange(services, 'createdAt'), [services, filterByRange]);
  const salesSeries = useMemo(() => buildSeries(filteredSales, 'saleDate'), [filteredSales]);
  const purchaseSeries = useMemo(() => buildSeries(filteredPurchases, 'purchaseDate'), [filteredPurchases]);
  const summary = useMemo(() => {
    const received = filteredSales.reduce((sum, sale) => sum + Number(sale.amountReceived || 0), 0);
    const pending = filteredSales.reduce((sum, sale) => {
      if (sale.dueAmount !== undefined && sale.dueAmount !== null) {
        return sum + Number(sale.dueAmount || 0);
      }
      const total = Number(sale.grandTotal || 0);
      const paid = Number(sale.amountReceived || 0);
      return sum + Math.max(total - paid, 0);
    }, 0);
    const salesTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);
    const purchaseTotal = filteredPurchases.reduce((sum, purchase) => sum + Number(purchase.grandTotal || 0), 0);
    return { received, pending, salesTotal, purchaseTotal };
  }, [filteredSales, filteredPurchases]);

  const recentSales = useMemo(() => filteredSales.slice(0, 5), [filteredSales]);
  const recentPurchases = useMemo(() => filteredPurchases.slice(0, 5), [filteredPurchases]);
  const selectedRangeLabel = rangeOptions.find((option) => option.key === dateRange)?.label ?? '';

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
      {status ? <Notice title={status} tone="error" /> : null}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-6 shadow-sm dark:border-emerald-800/50 dark:from-emerald-950/60 dark:via-slate-950/80 dark:to-slate-900/60">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600/80">{t('dashboard.cashOverview')}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary.received)}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('dashboard.totalReceived')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-200">
              <UserCheck size={22} />
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-4 dark:border-amber-700/40 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-amber-500/80">{t('dashboard.amountPending')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary?.pending)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.salesTotal')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary?.salesTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.purchaseSpend')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{formatMoney(summary?.purchaseTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/50">
              <p className="text-xs uppercase text-slate-500">{t('dashboard.products')}</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{products.length}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500">{t('dashboard.filters.showing', { range: selectedRangeLabel })}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.quickStats')}</p>
              <BarChart3 size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                  <UserCheck size={14} /> {t('nav.sales')}
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{filteredSales.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                  <ShoppingCart size={14} /> {t('nav.purchases')}
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{filteredPurchases.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                  <Briefcase size={14} /> {t('nav.services')}
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{filteredServices.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 p-3 dark:border-slate-700/60">
                <div className="flex items-center gap-2 text-xs uppercase text-slate-500">
                  <Boxes size={14} /> {t('dashboard.lowStockAlerts')}
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{lowStock.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('dashboard.quickActions')}</p>
              <Package size={18} className="text-slate-400" />
            </div>
            <div className="mt-4 grid gap-2">
              <Link className="btn-primary w-full justify-center" to="/app/sales">
                {t('dashboard.newSale')}
              </Link>
              <Link className="btn-secondary w-full justify-center" to="/app/purchases">
                {t('dashboard.newPurchase')}
              </Link>
              <Link className="btn-ghost w-full justify-center" to="/app/products">
                {t('dashboard.addProduct')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/*<BarChart title={t('dashboard.salesTrend')} series={salesSeries} formatMoney={formatMoney} last7Label={t('dashboard.last7Days')} />*/}
        {/*<BarChart title={t('dashboard.purchaseTrend')} series={purchaseSeries} formatMoney={formatMoney} last7Label={t('dashboard.last7Days')} />*/}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.recentSales')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/sales">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noSales')}</p>
            ) : (
              recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {sale.invoiceNo || sale.id.slice(0, 6)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(sale.saleDate)} · {sale.status || t('nav.sales')}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatMoney(sale.grandTotal)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.recentPurchases')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/purchases">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recentPurchases.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noPurchases')}</p>
            ) : (
              recentPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {purchase.invoiceNo || purchase.id.slice(0, 6)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(purchase.purchaseDate)} · {purchase.status || t('nav.purchases')}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">
                    {formatMoney(purchase.grandTotal)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.serviceOrders')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/services">
              {t('dashboard.viewAll')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {filteredServices.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noService')}</p>
            ) : (
              filteredServices.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/60"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {order.orderNo || order.id.slice(0, 6)}
                    </p>
                    <p className="text-xs text-slate-500">{order.status || t('nav.services')}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {formatMoney(order.grandTotal)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.lowStockAlerts')}</h3>
            <Link className="text-xs text-emerald-600 dark:text-emerald-300" to="/app/inventory">
              {t('dashboard.viewInventory')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.noLowStock')}</p>
            ) : (
              lowStock.slice(0, 5).map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between rounded-2xl border border-rose-200/60 bg-rose-50/60 p-3 dark:border-rose-700/40 dark:bg-rose-900/20"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.sku || 'n/a'}</p>
                  </div>
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-300">
                    {Number(item.quantityOnHand || 0).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
        <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('dashboard.quickStart')}</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>1. {t('dashboard.quickStartSteps.step1')}</li>
          <li>2. {t('dashboard.quickStartSteps.step2')}</li>
          <li>3. {t('dashboard.quickStartSteps.step3')}</li>
          <li>4. {t('dashboard.quickStartSteps.step4')}</li>
          <li>5. {t('dashboard.quickStartSteps.step5')}</li>
        </ul>
      </div>

      <div className="fixed bottom-24 left-0 right-0 z-20 px-4 md:static md:px-0">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/70 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/90 md:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Link className="btn-primary w-full justify-center" to="/app/sales">
              <span className="flex items-center gap-2">
                <UserCheck size={16} />
                {t('dashboard.newSale')}
              </span>
            </Link>
            <Link className="btn-secondary w-full justify-center" to="/app/purchases">
              <span className="flex items-center gap-2">
                <ShoppingCart size={16} />
                {t('dashboard.newPurchase')}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
