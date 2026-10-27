import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { pickBackendMessage } from '@/lib/business/hospitality';
import { formatCurrency } from '@/lib/money/currency';
import Notice from '@/components/ui/Notice';
import FlexibleDateInput from '@/components/form/FlexibleDateInput';

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function monthStartYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Restaurant add-on reports. Only mount when the add-on is on.
 */
export default function RestaurantReportsPanel({ from: fromProp, to: toProp } = {}) {
  const { t } = useI18n();
  const { canViewFeature } = useAuth();
  const [from, setFrom] = useState(fromProp || monthStartYmd());
  const [to, setTo] = useState(toProp || todayYmd());
  const [tab, setTab] = useState('voids');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voids, setVoids] = useState(null);
  const [foodCost, setFoodCost] = useState(null);
  const [waiters, setWaiters] = useState(null);
  const canViewCost = canViewFeature('purchasePrice');

  useEffect(() => {
    if (fromProp) setFrom(fromProp);
  }, [fromProp]);
  useEffect(() => {
    if (toProp) setTo(toProp);
  }, [toProp]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = { from, to };
    const load = async () => {
      try {
        if (tab === 'voids') {
          const payload = await api.getRestaurantVoidsReport(params);
          if (active) setVoids(payload);
        } else if (tab === 'food-cost') {
          const payload = await api.getRestaurantFoodCostReport(params);
          if (active) setFoodCost(payload);
        } else {
          const payload = await api.getRestaurantWaitersReport(params);
          if (active) setWaiters(payload);
        }
      } catch (err) {
        if (active) setError(pickBackendMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [from, to, tab]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">{t('common.from') || 'From'}</label>
          <FlexibleDateInput value={from} onChange={setFrom} />
        </div>
        <div>
          <label className="label">{t('common.to') || 'To'}</label>
          <FlexibleDateInput value={to} onChange={setTo} />
        </div>
        <div className="flex gap-1">
          {[
            { key: 'voids', label: t('restaurant.reports.voids') || 'Cancelled items & wastage' },
            { key: 'food-cost', label: t('restaurant.reports.foodCost') || 'Food cost' },
            { key: 'waiters', label: t('restaurant.reports.waiters') || 'Waiters' },
          ].map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={tab === entry.key ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <Notice tone="error" title={error} /> : null}
      {loading ? <p className="text-sm text-secondary-500">{t('common.loading') || 'Loading…'}</p> : null}

      {!loading && tab === 'voids' && voids ? (
        <div className="card space-y-3 overflow-x-auto">
          <p className="text-sm text-secondary-600">
            {voids.summary?.count ?? 0} items · {formatCurrency(voids.summary?.value)} · prepared {voids.summary?.preparedCount ?? 0}
            {canViewCost && voids.summary?.wastageCost != null
              ? ` · wastage ${formatCurrency(voids.summary.wastageCost)}`
              : ''}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-secondary-500">
              <tr>
                <th className="py-2">Order</th>
                <th className="py-2">Table</th>
                <th className="py-2">Item</th>
                <th className="py-2">Reason</th>
                <th className="py-2">By</th>
              </tr>
            </thead>
            <tbody>
              {(voids.items || []).map((row, index) => (
                <tr key={`${row.orderNo}-${index}`} className="border-t border-secondary-100">
                  <td className="py-2">{row.orderNo}</td>
                  <td className="py-2">{row.tableName || '—'}</td>
                  <td className="py-2">{row.quantity}× {row.name}</td>
                  <td className="py-2">{row.reason}</td>
                  <td className="py-2">{row.voidedBy?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'food-cost' && foodCost ? (
        <div className="card space-y-3 overflow-x-auto">
          {canViewCost ? (
            <p className="text-sm text-secondary-600">
              Revenue {formatCurrency(foodCost.summary?.revenue)} · Cost {formatCurrency(foodCost.summary?.costOfSales)} · Food cost {foodCost.summary?.foodCostPercent ?? '—'}%
            </p>
          ) : (
            <p className="text-sm text-secondary-600">
              Revenue {formatCurrency(foodCost.summary?.revenue)} · {foodCost.summary?.dishes ?? 0} dishes
            </p>
          )}
          <p className="text-xs text-secondary-400">
            {foodCost.costBasis || 'Based on current recipes and purchase prices'}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-secondary-500">
              <tr>
                <th className="py-2">Dish</th>
                <th className="py-2">Sold</th>
                <th className="py-2">Revenue</th>
                {canViewCost ? <th className="py-2">Margin %</th> : null}
              </tr>
            </thead>
            <tbody>
              {(foodCost.items || []).map((row) => (
                <tr key={row.productId || row.name} className="border-t border-secondary-100">
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.quantitySold}</td>
                  <td className="py-2">{formatCurrency(row.revenue)}</td>
                  {canViewCost ? <td className="py-2">{row.marginPercent ?? '—'}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'waiters' && waiters ? (
        <div className="card space-y-3 overflow-x-auto">
          <p className="text-sm text-secondary-600">
            {waiters.summary?.orders ?? 0} orders · {waiters.summary?.guests ?? 0} guests · {formatCurrency(waiters.summary?.sales)}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-secondary-500">
              <tr>
                <th className="py-2">Waiter</th>
                <th className="py-2">Orders</th>
                <th className="py-2">Sales</th>
                <th className="py-2">Avg</th>
                <th className="py-2">Voids</th>
              </tr>
            </thead>
            <tbody>
              {(waiters.waiters || []).map((row) => (
                <tr key={row.waiter?.id || row.waiter?.name} className="border-t border-secondary-100">
                  <td className="py-2">{row.waiter?.name || '—'}</td>
                  <td className="py-2">{row.orders}</td>
                  <td className="py-2">{formatCurrency(row.sales)}</td>
                  <td className="py-2">{formatCurrency(row.averagePerOrder)}</td>
                  <td className="py-2">{row.voids ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
