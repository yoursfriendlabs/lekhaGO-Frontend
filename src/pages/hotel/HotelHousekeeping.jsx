import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, Brush, CheckCheck, RefreshCw, Sparkles } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import StatsCard, { STATS_GRID_CLASS } from '@/components/ui/StatsCard.jsx';
import { HOUSEKEEPING_STYLES, HousekeepingDot } from '@/components/hotel/RoomStatus.jsx';
import { SSE_EVENTS } from '@/hooks/useSSE';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import {
  HOUSEKEEPING,
  asItems,
  errorMessage,
  firstDefined,
  roomHousekeeping,
  roomTypeName,
  tx,
} from '@/lib/hotel/hotelUtils';

const FILTERS = ['all', 'dirty', 'checkoutToday', 'outOfOrder'];

const ACTIONS = [
  { status: HOUSEKEEPING.CLEAN, icon: Sparkles },
  { status: HOUSEKEEPING.INSPECTED, icon: CheckCheck },
  { status: HOUSEKEEPING.DIRTY, icon: Brush },
  { status: HOUSEKEEPING.OUT_OF_ORDER, icon: Ban },
];

function isCheckoutToday(room) {
  return Boolean(
    firstDefined(
      room.checkoutToday,
      room.checkOutToday,
      room.departureToday,
      room.departingToday,
      room.dueOutToday,
    ),
  );
}

/**
 * Housekeeping screen. Intentionally shows no guest names or money.
 */
export default function HotelHousekeeping() {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const { showError } = useSnackbar();
  const canManage = canManageFeature('housekeeping');
  const L = (key, fallback) => tx(t, key, fallback);

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState({}); // roomId -> true
  const requestRef = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!businessId) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!silent) setLoading(true);
      try {
        const payload = await api.getHotelHousekeeping({}, { force: true });
        if (requestRef.current !== requestId) return;
        setRooms(asItems(payload, ['rooms']));
        setError('');
      } catch (err) {
        if (requestRef.current !== requestId) return;
        setError(errorMessage(err));
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [businessId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useLiveScreenRefresh({
    enabled: Boolean(businessId),
    eventNames: [SSE_EVENTS.HOTEL_CHANGED],
    refetch: () => load({ silent: true }),
  });

  const counts = useMemo(() => {
    const result = { dirty: 0, checkoutToday: 0, outOfOrder: 0, clean: 0 };
    rooms.forEach((room) => {
      const status = roomHousekeeping(room);
      if (status === HOUSEKEEPING.DIRTY) result.dirty += 1;
      else if (status === HOUSEKEEPING.OUT_OF_ORDER) result.outOfOrder += 1;
      else result.clean += 1;
      if (isCheckoutToday(room)) result.checkoutToday += 1;
    });
    return result;
  }, [rooms]);

  const visible = useMemo(() => {
    const list = rooms.filter((room) => {
      const status = roomHousekeeping(room);
      if (filter === 'dirty') return status === HOUSEKEEPING.DIRTY;
      if (filter === 'checkoutToday') return isCheckoutToday(room);
      if (filter === 'outOfOrder') return status === HOUSEKEEPING.OUT_OF_ORDER;
      return true;
    });
    return list.sort((a, b) =>
      String(a.floor ?? '').localeCompare(String(b.floor ?? ''), undefined, { numeric: true })
      || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }),
    );
  }, [rooms, filter]);

  const setStatus = async (room, status) => {
    if (pending[room.id] || roomHousekeeping(room) === status) return;
    const previous = rooms;
    setPending((prev) => ({ ...prev, [room.id]: true }));
    // Optimistic update
    setRooms((list) =>
      list.map((item) => (item.id === room.id ? { ...item, housekeepingStatus: status } : item)),
    );
    try {
      await api.updateHotelRoomHousekeeping(room.id, { status });
      await load({ silent: true });
    } catch (err) {
      setRooms(previous);
      showError(errorMessage(err));
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[room.id];
        return next;
      });
    }
  };

  const filterLabels = {
    all: L('hotel.housekeeping.filterAll', 'All rooms'),
    dirty: L('hotel.housekeeping.filterDirty', 'Dirty'),
    checkoutToday: L('hotel.housekeeping.filterCheckout', 'Checkout today'),
    outOfOrder: L('hotel.housekeeping.filterOutOfOrder', 'Out of order'),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={L('hotel.housekeeping.title', 'Housekeeping')}
        subtitle={L('hotel.housekeeping.subtitle', 'Update room cleaning status with one tap.')}
        action={(
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />

      {error ? <Notice tone="error" title={error} /> : null}
      {!canManage ? (
        <Notice tone="info" title={L('hotel.housekeeping.readOnly', 'You have view-only access to housekeeping.')} />
      ) : null}

      <div className={STATS_GRID_CLASS}>
        <StatsCard title={L('hotel.housekeeping.filterDirty', 'Dirty')} value={counts.dirty} icon={Brush} tone="warning" />
        <StatsCard
          title={L('hotel.housekeeping.filterCheckout', 'Checkout today')}
          value={counts.checkoutToday}
          icon={CheckCheck}
          tone="info"
        />
        <StatsCard
          title={L('hotel.housekeeping.filterOutOfOrder', 'Out of order')}
          value={counts.outOfOrder}
          icon={Ban}
          tone="danger"
        />
        <StatsCard title={L('hotel.housekeeping.ready', 'Ready')} value={counts.clean} icon={Sparkles} tone="success" />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? 'border-primary bg-primary text-white'
                : 'border-secondary-200 bg-white text-secondary-700 hover:bg-mist'
            }`}
          >
            {filterLabels[key]}
          </button>
        ))}
      </div>

      {loading && rooms.length === 0 ? (
        <div className="card flex h-40 items-center justify-center bg-white text-sm text-secondary-500">
          {t('common.loading')}
        </div>
      ) : visible.length === 0 ? (
        <div className="card border border-dashed border-secondary-200 bg-white p-10 text-center text-sm text-secondary-500">
          {L('hotel.housekeeping.empty', 'No rooms in this view.')}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((room) => {
            const current = roomHousekeeping(room);
            const busy = Boolean(pending[room.id]);
            return (
              <div key={room.id} className="card space-y-3 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg font-bold text-ink">{room.name}</p>
                    <p className="truncate text-xs text-secondary-500">
                      {roomTypeName(room) || '—'}
                      {room.floor !== undefined && room.floor !== null && room.floor !== ''
                        ? ` · ${L('hotel.rooms.floor', 'Floor')} ${room.floor}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <HousekeepingDot status={current} withLabel />
                    {isCheckoutToday(room) ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                        {L('hotel.housekeeping.filterCheckout', 'Checkout today')}
                      </span>
                    ) : null}
                  </div>
                </div>

                {canManage ? (
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIONS.map(({ status, icon: Icon }) => {
                      const style = HOUSEKEEPING_STYLES[status];
                      const active = current === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          disabled={busy || active}
                          onClick={() => setStatus(room, status)}
                          className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition disabled:cursor-default ${
                            active
                              ? `${style.chip} ring-2 ring-offset-1 ring-secondary-300`
                              : 'border-secondary-200 bg-white text-secondary-700 hover:bg-mist disabled:opacity-60'
                          }`}
                        >
                          <Icon size={14} />
                          {L(style.key, style.label)}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
