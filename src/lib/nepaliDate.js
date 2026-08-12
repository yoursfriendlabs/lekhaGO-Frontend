import NepaliDateModule from 'nepali-date-converter';

const NepaliDate = NepaliDateModule.default || NepaliDateModule;
const dateConfigMap = NepaliDateModule.dateConfigMap || {};

export const DATE_CALENDAR_STORAGE_KEY = 'mms.dateCalendar';

export const BS_MONTHS = [
  { value: 1, en: 'Baisakh', np: 'बैशाख' },
  { value: 2, en: 'Jestha', np: 'जेष्ठ' },
  { value: 3, en: 'Asar', np: 'असार' },
  { value: 4, en: 'Shrawan', np: 'श्रावण' },
  { value: 5, en: 'Bhadra', np: 'भदौ' },
  { value: 6, en: 'Aswin', np: 'असोज' },
  { value: 7, en: 'Kartik', np: 'कात्तिक' },
  { value: 8, en: 'Mangsir', np: 'मंसिर' },
  { value: 9, en: 'Poush', np: 'पुष' },
  { value: 10, en: 'Magh', np: 'माघ' },
  { value: 11, en: 'Falgun', np: 'फाल्गुण' },
  { value: 12, en: 'Chaitra', np: 'चैत' },
];

const BS_MONTH_KEYS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Aswin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
];

const pad2 = (value) => String(value).padStart(2, '0');

export function getPreferredDateCalendar() {
  try {
    const stored = localStorage.getItem(DATE_CALENDAR_STORAGE_KEY);
    return stored === 'bs' ? 'bs' : 'ad';
  } catch {
    return 'ad';
  }
}

export function setPreferredDateCalendar(calendar) {
  const next = calendar === 'bs' ? 'bs' : 'ad';
  try {
    localStorage.setItem(DATE_CALENDAR_STORAGE_KEY, next);
  } catch {
    // ignore storage failures
  }
  return next;
}

export function isValidAdISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  );
}

export function getBsYearOptions({ past = 30, future = 20 } = {}) {
  const current = new NepaliDate();
  const year = current.getYear();
  const start = Math.max(2000, year - past);
  const end = Math.min(2090, year + future);
  const years = [];
  for (let y = end; y >= start; y -= 1) years.push(y);
  return years;
}

export function getBsDaysInMonth(year, month1Based) {
  const yearConfig = dateConfigMap[String(year)];
  if (!yearConfig) return 30;
  const key = BS_MONTH_KEYS[month1Based - 1];
  return Number(yearConfig[key] || 30);
}

export function adISOToBsParts(adISO) {
  if (!isValidAdISODate(adISO)) return null;
  const [year, month, day] = adISO.split('-').map(Number);
  try {
    const nepali = NepaliDate.fromAD(new Date(year, month - 1, day));
    const bs = nepali.getBS();
    return {
      year: bs.year,
      month: bs.month + 1,
      day: bs.date,
    };
  } catch {
    return null;
  }
}

export function bsPartsToAdISO(year, month1Based, day) {
  const y = Number(year);
  const m = Number(month1Based);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1) return null;

  const maxDay = getBsDaysInMonth(y, m);
  if (d > maxDay) return null;

  try {
    const nepali = new NepaliDate(y, m - 1, d);
    const ad = nepali.getAD();
    return `${ad.year}-${pad2(ad.month + 1)}-${pad2(ad.date)}`;
  } catch {
    return null;
  }
}

export function formatBsParts(parts, { withLabel = false, withMonthName = false } = {}) {
  if (!parts) return '';
  const month = BS_MONTHS.find((entry) => entry.value === Number(parts.month));
  const monthLabel = month ? month.en : pad2(parts.month);
  const date = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  const withName = withMonthName ? `${date} (${monthLabel})` : date;
  return withLabel ? `BS ${withName}` : withName;
}

export function formatDateWithCalendar(adISO, calendar = getPreferredDateCalendar()) {
  if (!adISO) return '';
  if (!isValidAdISODate(adISO)) return String(adISO);
  if (calendar !== 'bs') return adISO;
  const bs = adISOToBsParts(adISO);
  return bs ? formatBsParts(bs, { withLabel: false, withMonthName: false }) : adISO;
}

export function formatDateBoth(adISO) {
  if (!adISO) return '';
  if (!isValidAdISODate(adISO)) return String(adISO);
  const bs = adISOToBsParts(adISO);
  if (!bs) return adISO;
  return `${adISO} · ${formatBsParts(bs, { withLabel: false, withMonthName: false })}`;
}


export function todayAdISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function todayBsParts() {
  const nepali = new NepaliDate();
  const bs = nepali.getBS();
  return {
    year: bs.year,
    month: bs.month + 1,
    day: bs.date,
  };
}
