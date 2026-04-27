import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function normalizeOption(option) {
  if (!option || typeof option !== 'object') return null;

  const value = option.value;
  if (value === null || value === undefined || value === '') return null;

  return {
    ...option,
    value: String(value),
    label: String(option.label ?? value),
  };
}

function mergeOptions(selectedOption, options = []) {
  const seen = new Set();
  const merged = [];

  [selectedOption, ...options].forEach((option) => {
    const normalized = normalizeOption(option);
    if (!normalized?.value || seen.has(normalized.value)) return;
    seen.add(normalized.value);
    merged.push(normalized);
  });

  return merged;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function AsyncSearchableSelect({
  value = '',
  selectedOption = null,
  onChange,
  loadOptions,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className = '',
  disabled = false,
  clearable = true,
  noResultsLabel = 'No results',
  loadingLabel = 'Loading...',
  minQueryLength = 0,
  renderOption,
  dropdownMinWidth = 0,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const debouncedQuery = useDebouncedValue(query, 250);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const loadOptionsRef = useRef(loadOptions);

  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);

  const safeOptions = ensureArray(options).map(normalizeOption).filter(Boolean);

  const selected = useMemo(() => {
    if (selectedOption && String(selectedOption.value) === String(value) && value !== '') {
      return selectedOption;
    }

    return safeOptions.find((option) => String(option.value) === String(value) && option.value !== '') || selectedOption;
  }, [safeOptions, selectedOption, value]);

  useEffect(() => {
    if (!selected) return;
    setOptions((previous) => mergeOptions(selected, previous));
  }, [selected]);

  const updateDropdownPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 8;
    const width = Math.min(
      viewportWidth - margin * 2,
      Math.max(rect.width, Number(dropdownMinWidth) || 0)
    );
    const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - width - margin));
    const dropdownMaxHeight = 320;
    const minHeight = 160;
    const belowSpace = viewportHeight - rect.bottom - margin - 4;
    const aboveSpace = rect.top - margin - 4;
    const opensAbove = belowSpace < minHeight && aboveSpace > belowSpace;
    const availableHeight = opensAbove ? aboveSpace : belowSpace;
    const maxHeight = Math.max(minHeight, Math.min(dropdownMaxHeight, availableHeight));
    const top = opensAbove ? Math.max(margin, rect.top - maxHeight - 4) : rect.bottom + 4;

    setDropdownStyle({ left, top, width, maxHeight });
  }, [dropdownMinWidth]);

  useEffect(() => {
    function onMouseDown(event) {
      const clickedTrigger = containerRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedDropdown) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (open && dropdownStyle && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open, dropdownStyle]);

  useEffect(() => {
    if (!open) return undefined;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open || typeof loadOptionsRef.current !== 'function') return undefined;

    const search = debouncedQuery.trim();
    
    // Load options when opened, even with empty query (for browsing all options)
    if (search.length < minQueryLength && minQueryLength > 0) {
      setOptions((previous) => {
        const safePrevious = ensureArray(previous);
        return mergeOptions(
          selected,
          safePrevious.filter((option) => String(option.value) === String(selected?.value))
        );
      });
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    Promise.resolve(loadOptionsRef.current(search))
      .then((results) => {
        if (cancelled) return;
        setOptions(mergeOptions(selected, Array.isArray(results) ? results : []));
      })
      .catch(() => {
        if (cancelled) return;
        setOptions(mergeOptions(selected, []));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minQueryLength, open, selected]);

  const handleSelect = (option) => {
    setOptions((previous) => mergeOptions(option, ensureArray(previous)));
    onChange?.(option);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onChange?.(null);
    setQuery('');
    setOpen(false);
  };

  const showPrompt = minQueryLength > 0 && query.trim().length < minQueryLength;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => {
          if (disabled) return;
          setOpen((previous) => !previous);
        }}
        disabled={disabled}
      >
        <span className={`flex-1 truncate ${selected ? 'text-ink' : 'text-secondary-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {value && clearable ? (
          <X
            size={14}
            className="shrink-0 text-slate-400 hover:text-slate-700"
            onClick={handleClear}
          />
        ) : (
          <ChevronDown
            size={14}
            className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {open && dropdownStyle ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[1000] min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={dropdownStyle}
        >
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                className="flex-1 border-0 bg-transparent text-sm text-ink outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-0 focus:ring-0"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setOpen(false);
                    setQuery('');
                  }
                }}
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')}>
                  <X size={12} className="text-slate-400" />
                </button>
              ) : null}
            </div>
          </div>

          <ul className="overflow-y-auto py-1" style={{ maxHeight: Math.max(96, dropdownStyle.maxHeight - 57) }}>
            {loading ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">{loadingLabel}</li>
            ) : showPrompt ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">{searchPlaceholder}</li>
            ) : safeOptions.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">{noResultsLabel}</li>
            ) : (
              safeOptions.map((option) => (
                <li
                  key={option.value}
                  className={`min-w-0 cursor-pointer px-3 py-3 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    String(option.value) === String(value)
                      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  {renderOption ? renderOption(option) : option.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
