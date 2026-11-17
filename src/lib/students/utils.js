/**
 * Small helpers shared by the students screens.
 */
import dayjs from '@/lib/dates/datetime';
import { pickBackendMessage } from '@/lib/business/hospitality';

export const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DURATION_UNITS = ['day', 'week', 'month'];
export const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

export function todayISO() {
  return dayjs().format('YYYY-MM-DD');
}

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function errorText(error, fallback = 'Request failed') {
  return pickBackendMessage(error, fallback);
}

export function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

/**
 * The end date the server will work out: start + length, minus one day.
 * A 3-month course starting 2026-10-09 ends 2027-01-08.
 */
export function previewEndDate(startDate, durationValue, durationUnit) {
  const start = dayjs(startDate);
  const amount = Math.floor(toNumber(durationValue));
  if (!start.isValid() || amount <= 0 || !DURATION_UNITS.includes(durationUnit)) return '';
  return start.add(amount, durationUnit).subtract(1, 'day').format('YYYY-MM-DD');
}

export function displayDate(value) {
  if (!value) return '—';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('D MMM YYYY') : String(value);
}

export function displayDateTime(value) {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('D MMM YYYY, HH:mm') : String(value);
}

export function shortTime(value) {
  return value ? String(value).slice(0, 5) : '';
}

export function shiftTimeLabel(shift) {
  if (!shift) return '';
  const start = shortTime(shift.startTime);
  const end = shortTime(shift.endTime);
  if (start && end) return `${start}–${end}`;
  return start || end || '';
}

/** "Sun, Mon, Tue" or the every-day label when no days are picked. */
export function shiftDaysLabel(shift, t) {
  const days = Array.isArray(shift?.days) ? shift.days : [];
  if (!days.length || days.length === 7) return t('students.shifts.everyDay');
  return WEEK_DAYS.filter((day) => days.includes(day))
    .map((day) => t(`students.days.${day}`))
    .join(', ');
}

export function isFutureDate(value) {
  return Boolean(value) && dayjs(value).startOf('day').isAfter(dayjs().startOf('day'));
}

/** Drop empty strings so optional fields are left out of the request. */
export function compact(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export function attendanceRateLabel(rate) {
  if (rate === null || rate === undefined || rate === '') return '—';
  const value = toNumber(rate, NaN);
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 10) / 10}%`;
}

export const STATUS_BADGE = {
  active: 'active',
  inactive: 'inactive',
  completed: 'success',
  dropped: 'error',
};

export const ATTENDANCE_TONES = {
  present: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-500/15 dark:text-emerald-200',
  absent: 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/60 dark:bg-rose-500/15 dark:text-rose-200',
  late: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-500/15 dark:text-amber-200',
  excused: 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700/60 dark:bg-sky-500/15 dark:text-sky-200',
};
