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

