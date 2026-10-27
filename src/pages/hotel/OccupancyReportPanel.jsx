import { useCallback, useEffect, useMemo, useState } from 'react';
import { BedDouble, Download, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import FlexibleDateInput from '@/components/form/FlexibleDateInput.jsx';
import Notice from '@/components/ui/Notice';
import StatsCard, { STATS_GRID_CLASS } from '@/components/ui/StatsCard.jsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { todayISODate } from '@/lib/dates/datetime';
import { useI18n } from '@/lib/i18n.jsx';
import {
  addDaysISO,
  asItems,
  displayDate,
  downloadCsv,
  errorMessage,
  firstDefined,
  money,
  num,
  tx,
} from '@/lib/hotel/hotelUtils';

function toPercent(value) {
  const n = num(value);
  // Backends commonly send either 0-100 or a 0-1 fraction.
  return n > 0 && n <= 1 && !Number.isInteger(n) ? n * 100 : n;
}

function normalizeReport(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const s = root.summary || root.totals || root;
  const sold = num(firstDefined(s.roomNightsSold, s.nightsSold, s.occupiedRoomNights, s.soldNights));
  const available = num(firstDefined(s.roomNightsAvailable, s.availableRoomNights, s.availableNights));
  const revenue = num(firstDefined(s.roomRevenue, s.revenue, s.totalRoomRevenue));
  const occupancy = available > 0
    ? (sold / available) * 100
    : toPercent(firstDefined(s.occupancyRate, s.occupancyPercent, s.occupancy));
  const adr = firstDefined(s.adr, s.averageDailyRate, s.averageRoomRate);
  const revpar = firstDefined(s.revpar, s.revPar, s.revenuePerAvailableRoom);

  const daily = asItems(firstDefined(root.daily, root.days, root.series, root.byDay, s.daily), [
    'daily',
    'days',
    'series',
  ]).map((day) => {
    const daySold = num(firstDefined(day.roomsSold, day.occupied, day.occupiedRooms, day.sold));
    const dayAvailable = num(firstDefined(day.roomsAvailable, day.available, day.totalRooms));
    const rate = dayAvailable > 0
      ? (daySold / dayAvailable) * 100
      : toPercent(firstDefined(day.occupancyRate, day.occupancyPercent, day.occupancy));
    return {
      date: firstDefined(day.date, day.day),
      sold: daySold,
      available: dayAvailable,
      rate,
      revenue: num(firstDefined(day.revenue, day.roomRevenue)),
    };
  });

  return {
    occupancy,
    sold,
    available,
    revenue,
    adr: adr !== undefined ? num(adr) : sold > 0 ? revenue / sold : 0,
    revpar: revpar !== undefined ? num(revpar) : available > 0 ? revenue / available : 0,
    daily,
  };
}

/**
 * Occupancy KPIs + simple CSS bar chart. Importable from Reports.
 * Pass `from` / `to` to control the range from outside and hide the pickers.
 * Only mount where the hotel module is enabled (it calls /api/hotel/*).
 */
export default function OccupancyReportPanel({ from: fromProp, to: toProp, className = '' }) {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const L = (key, fallback) => tx(t, key, fallback);
  const controlled = Boolean(fromProp && toProp);

  const [from, setFrom] = useState(() => fromProp || addDaysISO(todayISODate(), -29));
  const [to, setTo] = useState(() => toProp || todayISODate());
  const [report, setReport] = useState(() => normalizeReport(null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const rangeFrom = controlled ? fromProp : from;
  const rangeTo = controlled ? toProp : to;

  const load = useCallback(async () => {
    if (!businessId || !rangeFrom || !rangeTo) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.getHotelOccupancyReport({ from: rangeFrom, to: rangeTo });
      setReport(normalizeReport(payload));
    } catch (err) {
      setReport(normalizeReport(null));
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId, rangeFrom, rangeTo]);

  useEffect(() => {
    load();
  }, [load]);

  const maxRate = useMemo(
    () => Math.max(100, ...report.daily.map((day) => day.rate)),
    [report.daily],
  );

  const exportCsv = () => {
    downloadCsv(
      `occupancy-${rangeFrom}_${rangeTo}.csv`,
      [
        L('hotel.occupancy.date', 'Date'),
        L('hotel.occupancy.roomsSold', 'Rooms sold'),
        L('hotel.occupancy.roomsAvailable', 'Rooms available'),
        L('hotel.occupancy.rate', 'Occupancy %'),
        L('hotel.occupancy.revenue', 'Room revenue'),
      ],
      report.daily.map((day) => [
        day.date,
        day.sold,
        day.available,
        day.rate.toFixed(1),
        day.revenue.toFixed(2),
      ]),
    );
  };

  return (
    <section className={`card space-y-4 bg-white p-4 md:p-5 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-semibold text-ink">
            {L('hotel.occupancy.title', 'Occupancy report')}
          </h3>
          <p className="text-xs text-secondary-500">
            {displayDate(rangeFrom)} – {displayDate(rangeTo)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!controlled ? (
            <>
              <div className="w-44">
                <label className="label">{t('common.from')}</label>
                <FlexibleDateInput value={from} onChange={(value) => value && setFrom(value)} />
              </div>
              <div className="w-44">
                <label className="label">{t('common.to')}</label>
                <FlexibleDateInput value={to} onChange={(value) => value && setTo(value)} />
              </div>
            </>
          ) : null}
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
          <button
            type="button"
            className="btn-secondary flex items-center gap-2"
            onClick={exportCsv}
            disabled={report.daily.length === 0}
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {error ? <Notice tone="error" title={error} /> : null}

      <div className={STATS_GRID_CLASS}>
        <StatsCard
          title={L('hotel.occupancy.occupancy', 'Occupancy')}
          value={`${report.occupancy.toFixed(1)}%`}
          hint={`${report.sold} / ${report.available} ${L('hotel.occupancy.roomNights', 'room nights')}`}
          icon={BedDouble}
          tone="info"
          loading={loading}
        />
        <StatsCard
          title={L('hotel.occupancy.revenue', 'Room revenue')}
          value={money(t, report.revenue)}
          icon={Wallet}
          tone="success"
          loading={loading}
        />
        <StatsCard
          title={L('hotel.occupancy.adr', 'Average room rate')}
          value={money(t, report.adr)}
          hint={L('hotel.occupancy.adrHint', 'Room revenue per room night sold')}
          icon={TrendingUp}
          loading={loading}
        />
        <StatsCard
          title={L('hotel.occupancy.revpar', 'Revenue per available room')}
          value={money(t, report.revpar)}
          hint={L('hotel.occupancy.revparHint', 'Room revenue per room night available')}
          icon={TrendingUp}
          tone="warning"
          loading={loading}
        />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-secondary-400">
          {L('hotel.occupancy.daily', 'Daily occupancy')}
        </h4>
        {report.daily.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-8 text-center text-sm text-secondary-500">
            {loading ? t('common.loading') : t('common.noData')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="flex h-48 items-end gap-1 border-b border-secondary-200 pb-0.5"
              style={{ minWidth: `${Math.max(report.daily.length * 22, 280)}px` }}
              role="img"
              aria-label={L('hotel.occupancy.daily', 'Daily occupancy')}
            >
              {report.daily.map((day, index) => {
                const height = Math.max((day.rate / maxRate) * 100, day.rate > 0 ? 2 : 0);
                return (
                  <div
                    key={`${day.date}-${index}`}
                    className="group flex h-full min-w-[14px] flex-1 flex-col justify-end"
                    title={`${displayDate(day.date)} — ${day.rate.toFixed(0)}% (${day.sold}/${day.available}) · ${money(t, day.revenue)}`}
                  >
                    <div
                      className="w-full rounded-t-md bg-primary/70 transition group-hover:bg-primary"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="mt-1 flex justify-between text-[10px] text-secondary-500"
              style={{ minWidth: `${Math.max(report.daily.length * 22, 280)}px` }}
            >
              <span>{displayDate(report.daily[0].date)}</span>
              <span>{displayDate(report.daily[report.daily.length - 1].date)}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
