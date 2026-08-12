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
  const { t, language } = useI18n();
  const [calendar, setCalendar] = useState(() => (
    rememberPreference ? getPreferredDateCalendar() : 'ad'
  ));

  const bsFromValue = useMemo(() => (value ? adISOToBsParts(value) : null), [value]);
  const fallbackBs = todayBsParts();

  const [bsYear, setBsYear] = useState(bsFromValue?.year || '');
  const [bsMonth, setBsMonth] = useState(bsFromValue?.month || '');
  const [bsDay, setBsDay] = useState(bsFromValue?.day || '');
  const [error, setError] = useState('');

  // Handle outside value updates
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
      setError(t('dates.invalidBsDate') || 'Invalid Nepali date selected.');
      return;
    }

    setError('');
    emitAd(converted);
  };

  const convertedHint = useMemo(() => {
    if (!showConvertedHint || !value || !isValidAdISODate(value)) return '';
    if (calendar === 'bs') {
      return t('dates.savedAsEnglish', { date: value }) || `Saved as English: ${value}`;
    }
    const parts = adISOToBsParts(value);
    if (!parts) return '';
    return t('dates.alsoNepali', { date: formatBsParts(parts, { withLabel: false }) }) || `BS ${formatBsParts(parts, { withLabel: false })}`;
  }, [calendar, showConvertedHint, t, value]);

  // Separate layout/spacing classes from the input design classes
  const classes = className ? className.split(' ') : [];
  const layoutClasses = classes.filter(c => 
    c.startsWith('mt-') || c.startsWith('mb-') || c.startsWith('ml-') || c.startsWith('mr-') || 
    c.startsWith('mx-') || c.startsWith('my-') || c.startsWith('p-') || c.startsWith('w-') || 
    c.startsWith('flex-') || c.startsWith('h-') || c.startsWith('col-') || c.startsWith('row-')
  );
  const inputStyleClasses = classes.filter(c => !layoutClasses.includes(c));

  const wrapperClassName = `relative w-full ${layoutClasses.join(' ')}`;
  const inputClassName = `${inputStyleClasses.join(' ')} w-full min-w-0`;

  // Detect compact mode to adjust toggle button layout/padding
  const isCompact = className?.includes('input-compact') || className?.includes('h-8') || className?.includes('h-9');

  return (
    <div className={wrapperClassName}>
      <div className="flex items-stretch gap-1.5 w-full">
        {calendar === 'ad' ? (
          <input
            id={id}
            className={inputClassName}
            name={name}
            type="date"
            value={value || ''}
            onChange={onChange}
            disabled={disabled}
            required={required}
          />
        ) : (
          <div className="grid grid-cols-[1.1fr_1.3fr_0.9fr] gap-1 flex-1 min-w-0">
            <select
              id={id ? `${id}-bs-year` : undefined}
              className={inputClassName}
              value={bsYear}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                event.target.value ? Number(event.target.value) : '',
                bsMonth,
                bsDay,
              )}
            >
              <option value="">{t('dates.year') || 'Year'}</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <select
              id={id ? `${id}-bs-month` : undefined}
              className={inputClassName}
              value={bsMonth}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                bsYear,
                event.target.value ? Number(event.target.value) : '',
                bsDay,
              )}
            >
              <option value="">{t('dates.month') || 'Month'}</option>
              {BS_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {language === 'ne' ? month.np : month.en}
                </option>
              ))}
            </select>

            <select
              id={id ? `${id}-bs-day` : undefined}
              className={inputClassName}
              value={bsDay && Number(bsDay) > daysInMonth ? daysInMonth : bsDay}
              disabled={disabled}
              required={required}
              onChange={(event) => commitBsParts(
                bsYear,
                bsMonth,
                event.target.value ? Number(event.target.value) : '',
              )}
            >
              <option value="">{t('dates.day') || 'Day'}</option>
              {dayOptions.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
        )}

        {/* Small AD/BS Switcher Pill */}
        <div className="flex shrink-0 rounded-xl border border-secondary-200 bg-secondary-50/50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleCalendarChange('ad')}
            className={`rounded-lg transition font-bold uppercase ${
              isCompact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
            } ${
              calendar === 'ad'
                ? 'bg-primary text-white shadow-sm hover:bg-primary-600'
                : 'text-secondary-600 hover:text-secondary-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            AD
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleCalendarChange('bs')}
            className={`rounded-lg transition font-bold uppercase ${
              isCompact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
            } ${
              calendar === 'bs'
                ? 'bg-primary text-white shadow-sm hover:bg-primary-600'
                : 'text-secondary-600 hover:text-secondary-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            BS
          </button>
        </div>
      </div>

      {/* Sub-text: Converted Hint or Error */}
      {error ? (
        <p className="text-[10px] font-medium text-rose-600 mt-1 pl-1 leading-none">{error}</p>
      ) : convertedHint ? (
        <p className="text-[10px] font-medium text-secondary-500 dark:text-slate-400 mt-1 pl-1 leading-none">
          {convertedHint}
        </p>
      ) : null}
    </div>
  );
}
