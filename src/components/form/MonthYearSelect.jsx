import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { BS_MONTHS, adISOToBsParts } from '../../lib/dates/nepaliDate';
import { useI18n } from '../../lib/i18n.jsx';

const AD_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const AD_MONTHS_NP = [
  'जनवरी',
  'फेब्रुअरी',
  'मार्च',
  'अप्रिल',
  'मे',
  'जुन',
  'जुलाई',
  'अगस्ट',
  'सेप्टेम्बर',
  'अक्टोबर',
  'नोभेम्बर',
  'डिसेम्बर',
];

const pad2 = (value) => String(value).padStart(2, '0');

function parseMonthYear(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/**
 * Month / Year selector that displays both English (AD) and Nepali (BS)
 * month names. Always emits/saves an AD `YYYY-MM` value via onChange.
 *
 * value  : string `YYYY-MM` (AD)
 * onChange : (e) => {} emits { target: { name, value } }
 */
export default function MonthYearSelect({
  id,
  name,
  value = '',
  onChange,
  className = 'input',
  disabled = false,
  required = false,
}) {
  const { language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  const parsed = useMemo(() => parseMonthYear(value), [value]);
  const selected = parsed || (() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  })();

  const [viewYear, setViewYear] = useState(selected.year);

  useEffect(() => {
    if (parsed) setViewYear(parsed.year);
  }, [parsed?.year]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const adISO = `${viewYear}-${pad2(month)}-15`;
        const bs = adISOToBsParts(adISO);
        const bsMonth = BS_MONTHS.find((m) => m.value === Number(bs?.month));
        return {
          month,
          value: `${viewYear}-${pad2(month)}`,
          adLabel: `${AD_MONTHS[index]} ${viewYear}`,
          npLabel: AD_MONTHS_NP[index],
          bsLabel: bsMonth ? bsMonth.np : null,
          bsEnLabel: bsMonth ? bsMonth.en : null,
        };
      }),
    [viewYear],
  );

  const emit = (next) => {
    if (typeof onChange !== 'function') return;
    onChange({ target: { name, value: next || '', type: 'month' } });
  };

  const updateDropdownPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const dropdownWidth = 300;
    const dropdownHeight = 380;
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

  useEffect(() => {
    if (!isOpen) return undefined;
    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);
    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onMouseDown(e) {
      const inTrigger = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown) setIsOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  const selectedLabel = useMemo(() => {
    const entry = monthOptions.find((o) => o.month === selected.month);
    if (!entry) return '—';
    const en = `${AD_MONTHS[selected.month - 1]} ${selected.year}`;
    const bsText =
      language === 'ne'
        ? entry.bsLabel || entry.bsEnLabel
        : entry.bsEnLabel || entry.bsLabel;
    return bsText ? `${en} · ${bsText}` : en;
  }, [language, monthOptions, selected]);

  const layoutClasses = (className || '').split(' ').filter((c) =>
    c.startsWith('mt-') || c.startsWith('mb-') || c.startsWith('ml-') ||
    c.startsWith('mr-') || c.startsWith('mx-') || c.startsWith('my-') ||
    c.startsWith('p-') || c.startsWith('w-') || c.startsWith('h-') ||
    c.startsWith('col-') || c.startsWith('row-'),
  );
  const inputStyleClasses = (className || '').split(' ').filter((c) => !layoutClasses.includes(c));

  const inputClassName = `${inputStyleClasses.join(' ') || 'input'} w-full min-h-11`;

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${layoutClasses.join(' ')}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((v) => !v)}
        className={`${inputClassName} flex items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox"
      >
        <span className={`truncate ${value ? 'text-ink' : 'text-secondary-400'}`}>
          {value ? selectedLabel : (language === 'ne' ? 'महिना चयन गर्नुहोस्' : 'Select month')}
        </span>
        <Calendar className="h-4 w-4 shrink-0 text-secondary-400" />
      </button>

      {isOpen && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          role="listbox"
          className="fixed z-[1000] min-w-0 rounded-2xl border border-secondary-200 bg-white/95 p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900/95 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-secondary-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100 hover:text-ink dark:hover:bg-slate-800 transition"
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-ink dark:text-white">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100 hover:text-ink dark:hover:bg-slate-800 transition"
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto pr-1">
            {monthOptions.map((option) => {
              const isActive = parsed && parsed.year === viewYear && parsed.month === option.month;
              const isCurrent =
                !parsed && viewYear === selected.year && option.month === selected.month;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={Boolean(isActive || isCurrent)}
                  onClick={() => {
                    emit(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition ${
                    isActive || isCurrent
                      ? 'bg-primary text-white shadow-sm'
                      : 'hover:bg-secondary-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${isActive || isCurrent ? 'text-white' : 'text-ink dark:text-white'}`}>
                      {option.adLabel}
                    </span>
                    <span className={`block text-xs ${isActive || isCurrent ? 'text-white/80' : 'text-secondary-500'}`}>
                      {language === 'ne' ? option.bsLabel || option.npLabel : `${option.npLabel} · ${option.bsEnLabel || ''}`.replace(/·\s*$/, '')}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs font-medium ${isActive || isCurrent ? 'text-white/90' : 'text-secondary-400'}`}>
                    {isActive || isCurrent ? (language === 'ne' ? 'चयनित' : 'Selected') : 'BS ' + (option.bsEnLabel || '')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
