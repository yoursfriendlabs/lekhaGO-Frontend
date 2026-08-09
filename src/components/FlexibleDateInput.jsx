import { useEffect, useMemo, useState } from 'react';
import {
  BS_MONTHS,
  adISOToBsParts,
  bsPartsToAdISO,
  formatBsParts,
  getBsDaysInMonth,
  getBsYearOptions,
  getPreferredDateCalendar,
  isValidAdISODate,
  setPreferredDateCalendar,
  todayBsParts,
} from '../lib/nepaliDate';
import { useI18n } from '../lib/i18n.jsx';

/**
 * Dual calendar date input.
 * Always emits English (AD) ISO date `YYYY-MM-DD` via onChange(adISO).
 */
export default function FlexibleDateInput({
  id,
  name,
  value = '',
  onChange,
  className = 'input',
  disabled = false,
  required = false,
  rememberPreference = true,
  showConvertedHint = true,
}) {
  const { t } = useI18n();
  const [calendar, setCalendar] = useState(() => (
    rememberPreference ? getPreferredDateCalendar() : 'ad'
  ));

  const bsFromValue = useMemo(() => (value ? adISOToBsParts(value) : null), [value]);
  const fallbackBs = todayBsParts();

  const [bsYear, setBsYear] = useState(bsFromValue?.year || '');
  const [bsMonth, setBsMonth] = useState(bsFromValue?.month || '');
  const [bsDay, setBsDay] = useState(bsFromValue?.day || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bsFromValue) {
      if (!value) {
        setBsYear('');
        setBsMonth('');
        setBsDay('');
      }
      return;
    }
    setBsYear(bsFromValue.year);
    setBsMonth(bsFromValue.month);
    setBsDay(bsFromValue.day);
    setError('');
  }, [value, bsFromValue?.year, bsFromValue?.month, bsFromValue?.day]);

  const yearOptions = useMemo(() => getBsYearOptions(), []);
  const selectedYear = Number(bsYear) || fallbackBs.year;
  const selectedMonth = Number(bsMonth) || fallbackBs.month;
  const daysInMonth = getBsDaysInMonth(selectedYear, selectedMonth);
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth }, (_, index) => index + 1),
    [daysInMonth],
  );

  const emitAd = (adISO) => {
    if (typeof onChange !== 'function') return;
    onChange({
      target: {
        name,
        value: adISO || '',
        type: 'date',
      },
    });
  };

  const handleCalendarChange = (nextCalendar) => {
    setCalendar(nextCalendar);
    setError('');
    if (rememberPreference) setPreferredDateCalendar(nextCalendar);

    if (nextCalendar === 'bs' && value && isValidAdISODate(value)) {
      const parts = adISOToBsParts(value);
      if (parts) {
        setBsYear(parts.year);
        setBsMonth(parts.month);
        setBsDay(parts.day);
      }
    }
  };

  const commitBsParts = (nextYear, nextMonth, nextDay) => {
    setBsYear(nextYear);
    setBsMonth(nextMonth);
    setBsDay(nextDay);

    if (!nextYear || !nextMonth || !nextDay) {
      setError('');
      emitAd('');
      return;
    }

    const converted = bsPartsToAdISO(nextYear, nextMonth, nextDay);
    if (!converted) {
      setError(t('dates.invalidBsDate'));
      return;
    }

    setError('');
    emitAd(converted);
  };

  const convertedHint = useMemo(() => {
    if (!showConvertedHint || !value || !isValidAdISODate(value)) return '';
    if (calendar === 'bs') {
      return t('dates.savedAsEnglish', { date: value });
    }
    const parts = adISOToBsParts(value);
    if (!parts) return '';
    return t('dates.alsoNepali', { date: formatBsParts(parts, { withLabel: false }) });
  }, [calendar, showConvertedHint, t, value]);

  const selectClassName = `${className} w-full min-w-0`;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            disabled={disabled}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              calendar === 'ad'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
            onClick={() => handleCalendarChange('ad')}
          >
            {t('dates.englishAd')}
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              calendar === 'bs'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
            onClick={() => handleCalendarChange('bs')}
          >
            {t('dates.nepaliBs')}
          </button>
        </div>
        {convertedHint && !error ? (
          <p className="max-w-full truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {convertedHint}
          </p>
        ) : null}
      </div>

      {calendar === 'ad' ? (
        <input
          id={id}
          className={`${className} w-full`}
          name={name}
          type="date"
          value={value || ''}
          onChange={onChange}
          disabled={disabled}
          required={required}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[7.5rem_minmax(0,1fr)_5.5rem]">
          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('dates.year')}
            </span>
            <select
              id={id ? `${id}-bs-year` : undefined}
              className={selectClassName}
              value={bsYear}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                event.target.value ? Number(event.target.value) : '',
                bsMonth,
                bsDay,
              )}
            >
              <option value="">{t('dates.year')}</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('dates.month')}
            </span>
            <select
              id={id ? `${id}-bs-month` : undefined}
              className={selectClassName}
              value={bsMonth}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                bsYear,
                event.target.value ? Number(event.target.value) : '',
                bsDay,
              )}
            >
              <option value="">{t('dates.month')}</option>
              {BS_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.en}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t('dates.day')}
            </span>
            <select
              id={id ? `${id}-bs-day` : undefined}
              className={selectClassName}
              value={bsDay && Number(bsDay) > daysInMonth ? daysInMonth : bsDay}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                bsYear,
                bsMonth,
                event.target.value ? Number(event.target.value) : '',
              )}
            >
              <option value="">{t('dates.day')}</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : !value ? (
        <p className="text-xs text-slate-500">{t('dates.helpShort')}</p>
      ) : null}
    </div>
  );
}
