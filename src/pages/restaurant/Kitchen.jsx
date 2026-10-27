import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, RefreshCw, Sun } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice.jsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickBackendMessage } from '@/lib/business/hospitality';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { SSE_EVENTS } from '@/hooks/useSSE.js';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh.js';
import {
  ITEM_STATUS,
  KITCHEN_COLUMNS,
  isTakeawayChannel,
  minutesSince,
  nextItemStatus,
  normalizeKitchen,
} from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

const LIVE_EVENTS = [SSE_EVENTS.KITCHEN_CHANGED, SSE_EVENTS.RESTAURANT_ORDERS_CHANGED];
const DARK_KEY = 'mms_kitchen_dark';
const WARN_MINUTES = 10;
const LATE_MINUTES = 20;

function ageTone(minutes, dark) {
  if (minutes === null) return dark ? 'text-slate-300' : 'text-secondary-500';
  if (minutes > LATE_MINUTES) return 'bg-rose-600 text-white';
  if (minutes > WARN_MINUTES) return 'bg-amber-500 text-white';
  return dark ? 'bg-slate-700 text-slate-100' : 'bg-secondary-100 text-secondary-700';
}

function readDarkPreference() {
  try {
    return localStorage.getItem(DARK_KEY) === '1';
  } catch {
    return false;
  }
}

export default function Kitchen() {
  const tr = useTr();
  const { businessId, canManageFeature } = useAuth();
  const { showError } = useSnackbar();
  const canMove = canManageFeature('kitchen');

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [busyKey, setBusyKey] = useState('');
  const [dark, setDark] = useState(readDarkPreference);
  const loadedOnceRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    if (!silent && !loadedOnceRef.current) setLoading(true);
    try {
      const payload = await api.getRestaurantKitchen({}, { force: true });
      setCards(normalizeKitchen(payload));
      setLoadError('');
      loadedOnceRef.current = true;
    } catch (error) {
      if (!silent || !loadedOnceRef.current) setLoadError(pickBackendMessage(error, 'Unable to load the kitchen.'));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadedOnceRef.current = false;
    load();
  }, [load]);

  useLiveScreenRefresh({
    enabled: Boolean(businessId),
    eventNames: LIVE_EVENTS,
    refetch: () => load({ silent: true }),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleDark = () => {
    setDark((previous) => {
      const next = !previous;
      try {
        localStorage.setItem(DARK_KEY, next ? '1' : '0');
      } catch {
        // Preference is cosmetic only.
      }
      return next;
    });
  };

  const columns = useMemo(
    () => KITCHEN_COLUMNS.map((column) => ({
      ...column,
      cards: cards.filter((card) => card.status === column.status),
    })),
    [cards],
  );

  const runUpdate = async (key, action) => {
    if (!canMove || busyKey) return;
    setBusyKey(key);
    try {
      await action();
      await load({ silent: true });
    } catch (error) {
      showError(pickBackendMessage(error));
      load({ silent: true });
    } finally {
      setBusyKey('');
    }
  };

  const advanceItem = (card, item) => {
    const next = nextItemStatus(item.status);
    if (!next) return;
    runUpdate(`item:${item.id}`, () => api.updateRestaurantOrderItemStatus(card.orderId, item.id, { status: next }));
  };

  const advanceTicket = (card) => {
    const next = nextItemStatus(card.status);
    if (!next) return;
    runUpdate(`card:${card.key}`, async () => {
      if (card.coversWholeKot) {
        await api.updateRestaurantKotStatus(card.orderId, card.kotNo, { status: next });
        return;
      }
      for (const item of card.items) {
        await api.updateRestaurantOrderItemStatus(card.orderId, item.id, { status: next });
      }
    });
  };

  const ticketActionLabel = (status) => {
    if (status === ITEM_STATUS.SENT) return tr('restaurant.kitchen.startAll', 'Start all');
    if (status === ITEM_STATUS.PREPARING) return tr('restaurant.kitchen.readyAll', 'All ready');
    return tr('restaurant.kitchen.servedAll', 'All served');
  };

  const shell = dark
    ? 'rounded-3xl bg-slate-900 p-4 text-slate-100 [&_.page-subtitle]:text-slate-300 [&_.page-title]:text-white'
    : '';
  const columnShell = dark ? 'bg-slate-800/70 border-slate-700' : 'bg-secondary-50 border-secondary-200';

  return (
    <div className={`kitchen-screen space-y-4 ${shell}`}>
      <PageHeader
        title={tr('restaurant.kitchen.title', 'Kitchen')}
        subtitle={canMove
          ? tr('restaurant.kitchen.subtitle', 'Tap an item to move it forward, or use the ticket button.')
          : tr('restaurant.kitchen.viewOnly', 'View only')}
        action={(
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => load()}>
              <RefreshCw size={16} />
              {tr('common.refresh', 'Refresh')}
            </button>
            <button type="button" className="btn-secondary" onClick={toggleDark} aria-pressed={dark}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? tr('restaurant.kitchen.light', 'Light') : tr('restaurant.kitchen.dark', 'Dark')}
            </button>
          </div>
        )}
      />

      {loadError ? <Notice tone="error" title={loadError} /> : null}
      {loading && cards.length === 0 ? (
        <p className="text-sm opacity-70">{tr('common.loading', 'Loading...')}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((column) => (
          <section key={column.status} className={`rounded-3xl border p-3 ${columnShell}`}>
            <header className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-lg font-bold">
                {tr(`restaurant.kitchen.column.${column.key}`, column.fallback)}
              </h3>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${dark ? 'bg-slate-700' : 'bg-white'}`}>
                {column.cards.length}
              </span>
            </header>

            <div className="space-y-3">
              {column.cards.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm opacity-60">
                  {tr('restaurant.kitchen.empty', 'Nothing here')}
                </p>
              ) : null}

              {column.cards.map((card) => {
                const minutes = minutesSince(card.sentAt, now);
                const label = card.tableName
                  || (isTakeawayChannel(card.channel)
                    ? tr(`restaurant.channel.${card.channel}`, card.channel === 'delivery' ? 'Delivery' : 'Takeaway')
                    : tr('restaurant.kitchen.order', 'Order'));
                const ticketBusy = busyKey === `card:${card.key}`;
                const next = nextItemStatus(card.status);

                return (
                  <article
                    key={card.key}
                    className={`overflow-hidden rounded-3xl border shadow-sm ${
                      dark ? 'border-slate-700 bg-slate-900' : 'border-secondary-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-inherit px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xl font-black">{label}</p>
                        <p className="text-xs opacity-70">
                          #{card.orderNo || card.orderId.slice(-4)}
                          {card.kotNo ? ` · KOT ${card.kotNo}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${ageTone(minutes, dark)}`}
                      >
                        {minutes === null ? '--' : tr('restaurant.kitchen.minutes', '{n} min', { n: minutes })}
                      </span>
                    </div>

                    <ul className="divide-y divide-inherit">
                      {card.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            disabled={!canMove || !next || Boolean(busyKey)}
                            onClick={() => advanceItem(card, item)}
                            className={`flex min-h-[64px] w-full items-start gap-3 px-4 py-3 text-left transition disabled:cursor-default ${
                              dark ? 'enabled:hover:bg-slate-800' : 'enabled:hover:bg-secondary-50'
                            } ${busyKey === `item:${item.id}` ? 'opacity-50' : ''}`}
                          >
                            <span className="text-2xl font-black leading-none">{item.quantity}&times;</span>
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-lg font-semibold leading-tight">{item.name}</span>
                              {item.extras.map((extra, index) => (
                                <span key={index} className="block text-sm opacity-80">+ {extra.name}</span>
                              ))}
                              {item.note ? (
                                <span className="mt-0.5 block text-sm font-semibold text-amber-600">
                                  ** {item.note}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>

                    {canMove && next ? (
                      <div className="p-3">
                        <button
                          type="button"
                          disabled={Boolean(busyKey)}
                          onClick={() => advanceTicket(card)}
                          className="btn-primary min-h-14 w-full justify-center text-base disabled:opacity-60"
                        >
                          {ticketBusy ? tr('common.loading', 'Loading...') : ticketActionLabel(card.status)}
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
