import { useMemo } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs, { todayISODate } from '../../lib/dates/datetime';
import FlexibleDateInput from '../form/FlexibleDateInput.jsx';
import { useI18n } from '../../lib/i18n.jsx';

const ISO = 'YYYY-MM-DD';

/**
 * A day book never reports on a day that has not happened, so every preset and
 * every step stops at today instead of opening an empty range the owner then
 * has to back out of.
 */
function clampToToday(iso) {
  const today = todayISODate();
  return iso > today ? today : iso;
}

/** The ranges an owner actually asks for, in the order they ask for them. */
export function getDayBookPresets() {
  const today = dayjs();
  return [
    {
      key: 'today',
      labelKey: 'dayBook.presets.today',
      from: today.format(ISO),
      to: today.format(ISO),
    },
    {
      key: 'yesterday',
      labelKey: 'dayBook.presets.yesterday',
      from: today.subtract(1, 'day').format(ISO),
      to: today.subtract(1, 'day').format(ISO),
    },
    {
      key: 'last7',
      labelKey: 'dayBook.presets.last7',
      from: today.subtract(6, 'day').format(ISO),
      to: today.format(ISO),
    },
    {
      key: 'thisMonth',
      labelKey: 'dayBook.presets.thisMonth',
      from: today.startOf('month').format(ISO),
      // Not the end of the month: the rest of it has not happened yet.
      to: today.format(ISO),
    },
    {
      key: 'lastMonth',
      labelKey: 'dayBook.presets.lastMonth',
      from: today.subtract(1, 'month').startOf('month').format(ISO),
      to: today.subtract(1, 'month').endOf('month').format(ISO),
    },
  ];
}

/**
 * Describes the selected range the way the owner would say it out loud: one
 * date for a single day, and a span with its length for anything wider.
 */
export function describeRange(from, to, t) {
  if (!from || !to) return '';
  const start = dayjs(from);
  const end = dayjs(to);
  if (!start.isValid() || !end.isValid()) return '';
  if (from === to) return start.format('ddd, D MMM YYYY');

  const days = end.diff(start, 'day') + 1;
  const sameYear = start.year() === end.year();
  const span = `${start.format(sameYear ? 'D MMM' : 'D MMM YYYY')} – ${end.format('D MMM YYYY')}`;
  return `${span} · ${t('dayBook.dayCount', { count: days })}`;
}

export default function DayBookDateFilter({
  from,
  to,
  onChange,
  disabled = false,
}) {
  const { t } = useI18n();
  const today = todayISODate();
  const presets = useMemo(() => getDayBookPresets(), []);
  const activePreset = presets.find((preset) => preset.from === from && preset.to === to);

  // Stepping moves by the length of what is on screen, so a month view pages a
  // month at a time rather than crawling a day at a time.
  const lengthInDays = useMemo(() => {
    const start = dayjs(from);
    const end = dayjs(to);
    if (!start.isValid() || !end.isValid()) return 1;
    return Math.max(end.diff(start, 'day') + 1, 1);
  }, [from, to]);

  const step = (direction) => {
    const nextFrom = dayjs(from).add(direction * lengthInDays, 'day').format(ISO);
    const nextTo = dayjs(to).add(direction * lengthInDays, 'day').format(ISO);
    if (direction > 0 && nextFrom > today) return;
    onChange({ from: nextFrom, to: clampToToday(nextTo) });
  };

  // A range already touching today has nowhere forward to go.
  const canStepForward = to < today;

  const handleFrom = (value) => {
    const nextFrom = clampToToday(value || today);
    onChange({ from: nextFrom, to: nextFrom > to ? nextFrom : to });
  };

  const handleTo = (value) => {
    const nextTo = clampToToday(value || today);
    onChange({ from: nextTo < from ? nextTo : from, to: nextTo });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('dayBook.rangeLabel')}>
          {presets.map((preset) => {
            const isActive = activePreset?.key === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => onChange({ from: preset.from, to: preset.to })}
                className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50 ${
                  isActive
                    ? 'border-primary bg-primary text-white shadow-sm'
                    : 'border-secondary-200 bg-white text-secondary-700 hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {t(preset.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn-ghost min-h-[36px] px-2"
            aria-label={t('dayBook.previousRange')}
            disabled={disabled}
            onClick={() => step(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn-ghost min-h-[36px] px-2"
            aria-label={t('dayBook.nextRange')}
            disabled={disabled || !canStepForward}
            onClick={() => step(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="min-w-0">
          <label className="label" htmlFor="day-book-from">{t('dayBook.from')}</label>
          <div className="mt-1">
            <FlexibleDateInput
              id="day-book-from"
              value={from}
              disabled={disabled}
              onChange={(event) => handleFrom(event.target.value)}
            />
          </div>
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor="day-book-to">{t('dayBook.to')}</label>
          <div className="mt-1">
            <FlexibleDateInput
              id="day-book-to"
              value={to}
              disabled={disabled}
              onChange={(event) => handleTo(event.target.value)}
            />
          </div>
        </div>
        <p className="flex items-center gap-1.5 pb-2 text-xs font-semibold text-secondary-600 dark:text-secondary-400">
          <CalendarRange size={14} className="shrink-0 text-primary" />
          <span className="truncate">{describeRange(from, to, t)}</span>
        </p>
      </div>
    </div>
  );
}
