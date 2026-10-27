import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Clock, Plus, RefreshCw, ShoppingBag, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice.jsx';
import OpenOrderDialog from '@/components/restaurant/OpenOrderDialog.jsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickBackendMessage } from '@/lib/business/hospitality';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { SSE_EVENTS } from '@/hooks/useSSE.js';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh.js';
import { formatMoney, minutesSince, normalizeFloor } from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

const LIVE_EVENTS = [SSE_EVENTS.RESTAURANT_ORDERS_CHANGED, SSE_EVENTS.KITCHEN_CHANGED];

function formatElapsed(minutes, tr) {
  if (minutes === null) return '';
  if (minutes < 60) return tr('restaurant.floor.minutes', '{n} min', { n: minutes });
  const hours = Math.floor(minutes / 60);
  return tr('restaurant.floor.hoursMinutes', '{h}h {m}m', { h: hours, m: minutes % 60 });
}

function ReadyBadge({ count, tr }) {
  if (!(count > 0)) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
      {tr('restaurant.floor.readyBadge', '{n} ready', { n: count })}
    </span>
  );
}

export default function RestaurantFloor() {
  const tr = useTr();
  const navigate = useNavigate();
  const { businessId, canManageFeature, canViewFeature } = useAuth();
  const { showSuccess } = useSnackbar();

  const [floor, setFloor] = useState({ tables: [], takeaway: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dialog, setDialog] = useState({ open: false, table: null });
  const loadedOnceRef = useRef(false);

  const canManage = canManageFeature('orders');
  const canOpenOrders = canViewFeature('orders') || canViewFeature('billing') || canViewFeature('sales');

  const loadFloor = useCallback(async ({ silent = false } = {}) => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    if (!silent && !loadedOnceRef.current) setLoading(true);
    try {
      const payload = await api.getRestaurantFloor({}, { force: silent || loadedOnceRef.current });
      setFloor(normalizeFloor(payload));
      setLoadError('');
      loadedOnceRef.current = true;
    } catch (error) {
      // Keep the last good floor on screen during background refreshes.
      if (!silent || !loadedOnceRef.current) setLoadError(pickBackendMessage(error, 'Unable to load the floor.'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadedOnceRef.current = false;
    loadFloor();
  }, [loadFloor]);

  useLiveScreenRefresh({
    enabled: Boolean(businessId),
    eventNames: LIVE_EVENTS,
    refetch: () => loadFloor({ silent: true }),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const fallback = tr('restaurant.floor.defaultCategory', 'Tables');
    const map = new Map();
    floor.tables.forEach((table) => {
      const key = table.category || fallback;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(table);
    });
    return [...map.entries()].map(([name, tables]) => ({ name, tables }));
  }, [floor.tables, tr]);

  const openOrder = (orderId) => {
    if (!orderId) return;
    navigate(`/app/orders/${orderId}`);
  };

  const handleTableClick = (table) => {
    if (table.order) {
      if (canOpenOrders) openOrder(table.order.id);
      return;
    }
    if (!canManage) return;
    setDialog({ open: true, table });
  };

  const handleCreated = (created) => {
    const orderId = created?.id ?? created?.order?.id ?? created?.orderId;
    setDialog({ open: false, table: null });
    if (orderId) {
      showSuccess(tr('restaurant.floor.orderOpened', 'Order opened'));
      openOrder(orderId);
    } else {
      loadFloor({ silent: true });
    }
  };

  const handleOpenExisting = (orderId) => {
    setDialog({ open: false, table: null });
    openOrder(orderId);
  };

  const refresh = () => loadFloor();

  const occupiedCount = floor.tables.filter((table) => table.order).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={tr('restaurant.floor.title', 'Floor')}
        subtitle={tr('restaurant.floor.subtitle', '{occupied} of {total} tables occupied', {
          occupied: occupiedCount,
          total: floor.tables.length,
        })}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={refresh}>
              <RefreshCw size={16} />
              {tr('common.refresh', 'Refresh')}
            </button>
            {canManage ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setDialog({ open: true, table: null })}
              >
                <Plus size={16} />
                {tr('restaurant.floor.newOffFloor', 'New takeaway / delivery')}
              </button>
            ) : null}
          </div>
        )}
      />

      {loadError ? <Notice tone="error" title={loadError} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {loading && floor.tables.length === 0 ? (
            <p className="text-sm text-secondary-500">{tr('common.loading', 'Loading...')}</p>
          ) : null}

          {!loading && floor.tables.length === 0 && !loadError ? (
            <Notice
              tone="info"
              title={tr('restaurant.floor.noTables', 'No tables yet')}
              description={tr('restaurant.floor.noTablesHint', 'Add tables in Settings to start taking dine-in orders.')}
            />
          ) : null}

          {groups.map((group) => (
            <section key={group.name}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-secondary-500">
                {group.name}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {group.tables.map((table) => {
                  const order = table.order;
                  const minutes = order ? minutesSince(order.openedAt, now) : null;
                  const hasReady = order?.counts.ready > 0;
                  const disabled = order ? !canOpenOrders : !canManage;

                  return (
                    <button
                      key={table.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleTableClick(table)}
                      className={`card flex min-h-[116px] flex-col items-start justify-between gap-2 p-3 text-left transition active:scale-[0.98] disabled:cursor-default ${
                        order
                          ? hasReady
                            ? 'border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-300'
                            : 'border-primary/40 bg-primary/5'
                          : 'enabled:hover:border-primary/40'
                      }`}
                    >
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-lg font-bold text-ink">{table.name}</span>
                        {order ? <ReadyBadge count={order.counts.ready} tr={tr} /> : null}
                      </div>

                      {order ? (
                        <div className="w-full space-y-1 text-xs text-secondary-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">#{order.orderNo || order.id.slice(-4)}</span>
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {order.guests ?? '-'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-secondary-500">
                            <Clock size={12} />
                            {formatElapsed(minutes, tr)}
                          </div>
                          <div className="text-sm font-bold text-ink">{formatMoney(order.runningTotal)}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-secondary-400">
                          <Users size={12} />
                          {table.capacity ?? '-'}
                          <span className="ml-1">{tr('restaurant.floor.vacant', 'Vacant')}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="card h-fit p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            {tr('restaurant.floor.offFloor', 'Takeaway & delivery')}
          </h3>
          {floor.takeaway.length === 0 ? (
            <p className="text-sm text-secondary-500">
              {tr('restaurant.floor.noOffFloor', 'No open takeaway or delivery orders.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {floor.takeaway.map((order) => {
                const isDelivery = order.channel === 'delivery';
                const Icon = isDelivery ? Bike : ShoppingBag;
                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      disabled={!canOpenOrders}
                      onClick={() => openOrder(order.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition enabled:hover:border-primary/40 ${
                        order.counts.ready > 0 ? 'border-emerald-400 bg-emerald-50/70' : 'border-secondary-200 bg-white'
                      }`}
                    >
                      <Icon size={18} className="shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          #{order.orderNo || order.id.slice(-4)}
                          {order.customerName ? ` · ${order.customerName}` : ''}
                        </p>
                        <p className="text-xs text-secondary-500">
                          {isDelivery
                            ? tr('restaurant.channel.delivery', 'Delivery')
                            : tr('restaurant.channel.takeaway', 'Takeaway')}
                          {' · '}
                          {formatElapsed(minutesSince(order.openedAt, now), tr)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-ink">{formatMoney(order.runningTotal)}</span>
                        <ReadyBadge count={order.counts.ready} tr={tr} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <OpenOrderDialog
        isOpen={dialog.open}
        table={dialog.table}
        onClose={() => setDialog({ open: false, table: null })}
        onCreated={handleCreated}
        onOpenExisting={handleOpenExisting}
      />
    </div>
  );
}
