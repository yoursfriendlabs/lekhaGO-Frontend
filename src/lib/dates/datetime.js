import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

export const ISO_DATE_FORMAT = 'YYYY-MM-DD';

export function todayISODate() {
  return dayjs().format(ISO_DATE_FORMAT);
}

export function formatMaybeDate(value, format = 'D MMM') {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : String(value);
}

export function formatMaybeDateTime(value, format = 'D MMM YYYY, HH:mm') {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : String(value);
}

export function toDateInputValue(value) {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.format(ISO_DATE_FORMAT) : '';
}

export const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function weekdayKeyFromDate(value) {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? WEEKDAY_KEYS[d.day()] : null;
}

export function toClockMinutes(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime12Hour(value) {
  if (!value) return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;
  let hours = Number(match[1]) % 24;
  const minutes = match[2];
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${suffix}`;
}

export function startOfDayISOString(value) {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.startOf('day').toISOString() : '';
}

export function endOfDayISOString(value) {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.endOf('day').toISOString() : '';
}

export default dayjs;

