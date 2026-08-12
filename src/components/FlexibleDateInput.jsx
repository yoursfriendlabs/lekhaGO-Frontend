import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, X } from 'lucide-react';
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

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

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
    setIsPopoverOpen(false);
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
    return t('dates.alsoNepali', { date: formatBsParts(parts, { withLabel: false, withMonthName: false }) }) || formatBsParts(parts, { withLabel: false, withMonthName: false });
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

  const updateDropdownPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    
    const dropdownWidth = 290;
    const dropdownHeight = 220; 
    const margin = 8;

    let left = rect.left;
    if (left + dropdownWidth > viewportWidth - margin) {
      left = viewportWidth - dropdownWidth - margin;
    }
    if (left < margin) left = margin;

    let top = rect.bottom + 4;
    const belowSpace = viewportHeight - rect.bottom - margin;
    const aboveSpace = rect.top - margin;
    
    if (belowSpace < dropdownHeight && aboveSpace > belowSpace) {
      top = rect.top - dropdownHeight - 4;
    }

    setDropdownStyle({ left, top, width: dropdownWidth });
  }, []);

  // Update position when opened
  useEffect(() => {
    if (!isPopoverOpen) return undefined;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isPopoverOpen, updateDropdownPosition]);

  // Click outside listener
  useEffect(() => {
    if (!isPopoverOpen) return undefined;

    function onMouseDown(e) {
      const clickedTrigger = containerRef.current?.contains(e.target);
      const clickedDropdown = dropdownRef.current?.contains(e.target);

      if (!clickedTrigger && !clickedDropdown) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isPopoverOpen]);

  return (
    <div ref={containerRef} className={wrapperClassName}>
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
          <button
            id={id}
            type="button"
            onClick={() => !disabled && setIsPopoverOpen(!isPopoverOpen)}
            disabled={disabled}
            className={`${inputClassName} text-left flex items-center justify-between gap-2`}
          >
            <span className={`truncate ${value ? 'text-ink' : 'text-secondary-400'}`}>
              {value && bsFromValue ? formatBsParts(bsFromValue, { withLabel: false, withMonthName: false }) : (t('dates.selectBsDate') || (language === 'ne' ? 'नेपाली मिति छान्नुहोस्' : 'Select BS Date'))}
            </span>
            <Calendar className="w-4 h-4 text-secondary-400 shrink-0" />
          </button>
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

      {/* Popover Dropdown via Portal */}
      {isPopoverOpen && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="fixed z-[1000] min-w-0 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-semibold text-secondary-800 dark:text-slate-200">
              {t('dates.nepaliBs') || 'Nepali (BS)'}
            </span>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="text-secondary-400 hover:text-secondary-600 dark:hover:text-slate-200 rounded-lg p-0.5 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Select Dropdowns */}
          <div className="grid grid-cols-[1.1fr_1.3fr_0.9fr] gap-2 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-secondary-500 uppercase tracking-wider pl-0.5">
                {t('dates.year') || 'Year'}
              </label>
              <select
                id={id ? `${id}-bs-year` : undefined}
                className="w-full rounded-lg border border-secondary-200 bg-white px-2 py-1.5 text-sm text-ink focus:border-primary-400 focus:ring-primary-400 dark:bg-slate-850 dark:border-slate-700 dark:text-white"
                value={bsYear}
                onChange={(event) => commitBsParts(
                  event.target.value ? Number(event.target.value) : '',
                  bsMonth,
                  bsDay,
                )}
              >
                <option value="">--</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-secondary-500 uppercase tracking-wider pl-0.5">
                {t('dates.month') || 'Month'}
              </label>
              <select
                id={id ? `${id}-bs-month` : undefined}
                className="w-full rounded-lg border border-secondary-200 bg-white px-2 py-1.5 text-sm text-ink focus:border-primary-400 focus:ring-primary-400 dark:bg-slate-850 dark:border-slate-700 dark:text-white"
                value={bsMonth}
                onChange={(event) => commitBsParts(
                  bsYear,
                  event.target.value ? Number(event.target.value) : '',
                  bsDay,
                )}
              >
                <option value="">--</option>
                {BS_MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {language === 'ne' ? month.np : month.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-secondary-500 uppercase tracking-wider pl-0.5">
                {t('dates.day') || 'Day'}
              </label>
              <select
                id={id ? `${id}-bs-day` : undefined}
                className="w-full rounded-lg border border-secondary-200 bg-white px-2 py-1.5 text-sm text-ink focus:border-primary-400 focus:ring-primary-400 dark:bg-slate-850 dark:border-slate-700 dark:text-white"
                value={bsDay && Number(bsDay) > daysInMonth ? daysInMonth : bsDay}
                onChange={(event) => commitBsParts(
                  bsYear,
                  bsMonth,
                  event.target.value ? Number(event.target.value) : '',
                )}
              >
                <option value="">--</option>
                {dayOptions.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const today = todayBsParts();
                  commitBsParts(today.year, today.month, today.day);
                }}
                className="text-xs px-2.5 py-1 bg-secondary-100 dark:bg-slate-800 text-secondary-700 dark:text-slate-300 rounded-lg hover:bg-secondary-200 dark:hover:bg-slate-700 transition font-medium"
              >
                {t('dates.today') || (language === 'ne' ? 'आज' : 'Today')}
              </button>
              {(!required || value) && (
                <button
                  type="button"
                  onClick={() => commitBsParts('', '', '')}
                  className="text-xs px-2.5 py-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition font-medium"
                >
                  {t('common.clear') || 'Clear'}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsPopoverOpen(false)}
              className="text-xs px-3.5 py-1 bg-primary text-white rounded-lg hover:bg-primary-600 shadow transition font-semibold"
            >
              {t('common.close') || (language === 'ne' ? 'बन्द गर्नुहोस्' : 'Close')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
