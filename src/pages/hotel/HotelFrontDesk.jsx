import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BedDouble,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  RefreshCw,
  Settings2,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import FlexibleDateInput from '@/components/form/FlexibleDateInput.jsx';
import Notice from '@/components/ui/Notice';
import StatsCard, { STATS_GRID_CLASS } from '@/components/ui/StatsCard.jsx';
import HotelBookingDialog from '@/components/hotel/HotelBookingDialog.jsx';
import {
  HousekeepingDot,
  OCCUPANCY_STYLES,
  OccupancyBadge,
  StayStatusBadge,
} from '@/components/hotel/RoomStatus.jsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { todayISODate } from '@/lib/dates/datetime';
import { SSE_EVENTS } from '@/hooks/useSSE';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import {
  OCCUPANCY,
  addDaysISO,
  asItems,
  displayDate,
  errorMessage,
  firstDefined,
  money,
  num,
  roomHousekeeping,
  roomOccupancy,
  roomStay,
  roomStayId,
  roomTypeName,
  stayCheckIn,
  stayCheckOut,
  stayGuestName,
  stayRoomName,
  tx,
} from '@/lib/hotel/hotelUtils';

const TABS = ['rooms', 'arrivals', 'departures'];
const STATUS_FILTERS = ['all', OCCUPANCY.VACANT, OCCUPANCY.OCCUPIED, OCCUPANCY.RESERVED, OCCUPANCY.OUT_OF_ORDER];

function stayRow(stay) {
  return {
    id: stay?.id ? String(stay.id) : '',
    guest: stayGuestName(stay),
    room: stayRoomName(stay),
    checkIn: stayCheckIn(stay),
    checkOut: stayCheckOut(stay),
    status: stay?.status,
    balance: firstDefined(stay?.balanceDue, stay?.balance, stay?.dueAmount),
    adults: num(stay?.adults),
    children: num(stay?.children),
  };
}

export default function HotelFrontDesk() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { businessId, canManageFeature } = useAuth();
  const { showInfo, showSuccess } = useSnackbar();
  const canManage = canManageFeature('frontDesk');
  const L = (key, fallback, vars) => tx(t, key, fallback, vars);

  const [date, setDate] = useState(todayISODate());
  const [tab, setTab] = useState('rooms');
  const [statusFilter, setStatusFilter] = useState('all');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null); // { mode, roomId }
  const requestRef = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!businessId) return;
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      if (!silent) setLoading(true);
      try {
        const payload = await api.getHotelBoard({ date }, { force: true });
        if (requestRef.current !== requestId) return;
        setBoard(payload || {});
        setError('');
      } catch (err) {
        if (requestRef.current !== requestId) return;
        setError(errorMessage(err));
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    },
    [businessId, date],
  );

  useEffect(() => {
    load();
  }, [load]);

  useLiveScreenRefresh({
    enabled: Boolean(businessId),
    eventNames: [SSE_EVENTS.HOTEL_CHANGED],
    refetch: () => load({ silent: true }),
  });

  const rooms = useMemo(() => asItems(board, ['rooms']), [board]);
  const arrivals = useMemo(() => asItems(board?.arrivals).map(stayRow), [board]);
  const departures = useMemo(() => asItems(board?.departures).map(stayRow), [board]);

  const counts = useMemo(() => {
    const result = { total: rooms.length, vacant: 0, occupied: 0, reserved: 0, out_of_order: 0 };
    rooms.forEach((room) => {
      result[roomOccupancy(room)] += 1;
    });
    return result;
  }, [rooms]);

  const filteredRooms = useMemo(
    () => (statusFilter === 'all' ? rooms : rooms.filter((room) => roomOccupancy(room) === statusFilter)),
    [rooms, statusFilter],
  );

  const floors = useMemo(() => {
    const groups = new Map();
    [...filteredRooms]
      .sort((a, b) =>
        String(a.floor ?? '').localeCompare(String(b.floor ?? ''), undefined, { numeric: true })
        || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }),
      )
      .forEach((room) => {
        const key = room.floor === undefined || room.floor === null || room.floor === '' ? '' : String(room.floor);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(room);
      });
    return [...groups.entries()];
  }, [filteredRooms]);

  const openStay = (stayId) => {
    if (stayId) navigate(`/app/hotel/stays/${stayId}`);
  };

  const handleRoomClick = (room) => {
    const status = roomOccupancy(room);
    const stayId = roomStayId(room);
    if ((status === OCCUPANCY.OCCUPIED || status === OCCUPANCY.RESERVED) && stayId) {
      openStay(stayId);
      return;
    }
    if (status === OCCUPANCY.VACANT && canManage) {
      setBooking({ mode: date === todayISODate() ? 'walkin' : 'booking', roomId: String(room.id) });
      return;
    }
    if (status === OCCUPANCY.OUT_OF_ORDER) {
      showInfo(L('hotel.board.outOfOrderInfo', 'This room is out of order. Change it from Housekeeping.'));
    }
  };

  const handleCreated = (result) => {
    const stay = result?.stay || result;
    setBooking(null);
    showSuccess(L('hotel.board.stayCreated', 'Stay saved.'));
    load({ silent: true });
    if (stay?.id) openStay(stay.id);
  };

  const shiftDate = (days) => setDate((current) => addDaysISO(current, days));

  const tabLabel = {
    rooms: L('hotel.board.tabRooms', 'Rooms'),
    arrivals: `${L('hotel.board.tabArrivals', 'Arrivals')} (${arrivals.length})`,
    departures: `${L('hotel.board.tabDepartures', 'Departures')} (${departures.length})`,
  };

  const renderStayList = (rows, emptyText) => (
    rows.length === 0 ? (
      <div className="card border border-dashed border-secondary-200 bg-white p-10 text-center text-sm text-secondary-500">
        {emptyText}
      </div>
    ) : (
      <div className="card divide-y divide-secondary-100 overflow-hidden bg-white p-0">
        {rows.map((row) => (
          <button
            key={row.id || `${row.guest}-${row.room}`}
            type="button"
            onClick={() => openStay(row.id)}
            className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-mist"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{row.guest || '—'}</p>
              <p className="text-xs text-secondary-500">
                {L('hotel.board.room', 'Room')} {row.room || '—'}
                {' · '}
                {displayDate(row.checkIn)} → {displayDate(row.checkOut)}
                {row.adults ? ` · ${row.adults} ${L('hotel.board.guests', 'guests')}${row.children ? ` + ${row.children}` : ''}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {row.balance !== undefined && num(row.balance) > 0 ? (
                <span className="text-xs font-semibold tabular-nums text-rose-600">
                  {L('hotel.board.due', 'Due')} {money(t, row.balance)}
                </span>
              ) : null}
              <StayStatusBadge status={row.status} />
              <ChevronRight size={16} className="text-secondary-400" />
            </div>
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={L('hotel.board.title', 'Front desk')}
        subtitle={L('hotel.board.subtitle', 'Room board, arrivals and departures.')}
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => load()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
            {canManage ? (
              <>
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-2"
                  onClick={() => setBooking({ mode: 'booking', roomId: '' })}
                >
                  <CalendarPlus size={16} />
                  {L('hotel.board.book', 'Book')}
                </button>
                <button
                  type="button"
                  className="btn-primary flex items-center gap-2"
                  onClick={() => setBooking({ mode: 'walkin', roomId: '' })}
                >
                  <UserPlus size={16} />
                  {L('hotel.board.walkIn', 'Walk-in')}
                </button>
              </>
            ) : null}
          </div>
        )}
      />

      {error ? <Notice tone="error" title={error} /> : null}

      {/* Date + shortcuts */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <label className="label">{L('hotel.board.date', 'Board date')}</label>
          <FlexibleDateInput value={date} onChange={(value) => value && setDate(value)} />
        </div>
        <div className="flex gap-1.5 pb-0.5">
          <button type="button" className="btn-secondary px-3" onClick={() => shiftDate(-1)} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => setDate(todayISODate())}>
            {L('hotel.board.today', 'Today')}
          </button>
          <button type="button" className="btn-secondary px-3" onClick={() => shiftDate(1)} aria-label="Next day">
            <ChevronRight size={16} />
          </button>
        </div>
        {canManage ? (
          <button
            type="button"
            className="btn-ghost ml-auto flex items-center gap-2 pb-0.5 text-sm"
            onClick={() => navigate('/app/hotel/rooms')}
          >
            <Settings2 size={16} />
            {L('hotel.board.manageRooms', 'Manage rooms')}
          </button>
        ) : null}
      </div>

      <div className={STATS_GRID_CLASS}>
        <StatsCard title={L('hotel.board.statVacant', 'Vacant')} value={counts.vacant} icon={BedDouble} tone="success" />
        <StatsCard title={L('hotel.board.statOccupied', 'Occupied')} value={counts.occupied} icon={LogIn} tone="warning" />
        <StatsCard title={L('hotel.board.statReserved', 'Reserved')} value={counts.reserved} icon={CalendarPlus} tone="info" />
        <StatsCard
          title={L('hotel.board.statOutOfOrder', 'Out of order')}
          value={counts.out_of_order}
          icon={Sparkles}
          tone="danger"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-secondary-200 bg-white p-1">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === key ? 'bg-primary text-white shadow-sm' : 'text-secondary-600 hover:bg-mist'
            }`}
          >
            {key === 'departures' ? <LogOut size={15} /> : key === 'arrivals' ? <LogIn size={15} /> : <BedDouble size={15} />}
            {tabLabel[key]}
          </button>
        ))}
      </div>

      {loading && !board ? (
        <div className="card flex h-48 items-center justify-center bg-white text-sm text-secondary-500">
          {t('common.loading')}
        </div>
      ) : tab === 'rooms' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((key) => {
              const label = key === 'all'
                ? L('hotel.board.filterAll', 'All')
                : L(OCCUPANCY_STYLES[key].key, OCCUPANCY_STYLES[key].label);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === key
                      ? 'border-primary bg-primary text-white'
                      : 'border-secondary-200 bg-white text-secondary-700 hover:bg-mist'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {floors.length === 0 ? (
            <div className="card border border-dashed border-secondary-200 bg-white p-10 text-center text-sm text-secondary-500">
              {rooms.length === 0
                ? L('hotel.board.noRooms', 'No rooms yet. Add rooms to start taking bookings.')
                : L('hotel.board.noMatch', 'No rooms match this filter.')}
              {rooms.length === 0 && canManage ? (
                <div className="mt-3">
                  <button type="button" className="btn-primary" onClick={() => navigate('/app/hotel/rooms')}>
                    {L('hotel.board.manageRooms', 'Manage rooms')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            floors.map(([floor, floorRooms]) => (
              <section key={floor || 'none'} className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wide text-secondary-400">
                  {floor ? `${L('hotel.rooms.floor', 'Floor')} ${floor}` : L('hotel.board.noFloor', 'Rooms')}
                </h4>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {floorRooms.map((room) => {
                    const status = roomOccupancy(room);
                    const stay = roomStay(room);
                    const style = OCCUPANCY_STYLES[status];
                    const clickable = status !== OCCUPANCY.VACANT || canManage;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => handleRoomClick(room)}
                        disabled={!clickable}
                        className={`flex min-h-[116px] flex-col justify-between rounded-2xl border p-3 text-left shadow-sm transition ${style.tile} ${
                          clickable ? '' : 'cursor-default'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-serif text-lg font-bold leading-tight text-ink">{room.name}</p>
                            <p className="truncate text-[11px] text-secondary-500">{roomTypeName(room) || '—'}</p>
                          </div>
                          <HousekeepingDot status={roomHousekeeping(room)} />
                        </div>
                        <div className="mt-2 space-y-1">
                          {stay && status !== OCCUPANCY.VACANT ? (
                            <p className="truncate text-xs font-semibold text-ink">{stayGuestName(stay) || '—'}</p>
                          ) : null}
                          {stay && stayCheckOut(stay) && status !== OCCUPANCY.VACANT ? (
                            <p className="truncate text-[11px] text-secondary-500">
                              {L('hotel.board.until', 'until')} {displayDate(stayCheckOut(stay))}
                            </p>
                          ) : null}
                          <OccupancyBadge status={status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      ) : tab === 'arrivals' ? (
        renderStayList(arrivals, L('hotel.board.noArrivals', 'No arrivals for this date.'))
      ) : (
        renderStayList(departures, L('hotel.board.noDepartures', 'No departures for this date.'))
      )}

      {booking ? (
        <HotelBookingDialog
          key={`${booking.mode}-${booking.roomId}`}
          mode={booking.mode}
          defaultRoomId={booking.roomId}
          defaultDate={date}
          onClose={() => setBooking(null)}
          onCreated={handleCreated}
          onOpenStay={(stayId) => {
            setBooking(null);
            openStay(stayId);
          }}
        />
      ) : null}
    </div>
  );
}
