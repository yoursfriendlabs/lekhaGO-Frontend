import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, ChevronDown } from 'lucide-react';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

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

/**
 * SearchableSelect - a filterable dropdown select.
 *
 * Props:
 *   options       — array of { value: string, label: string }
 *   value         — currently selected value ('' = nothing selected)
 *   onChange      — (newValue: string) => void
 *   placeholder   — text shown when nothing is selected
 *   className     — extra classes on the outer wrapper div
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  className = '',
  dropdownMinWidth = 0,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const safeOptions = ensureArray(options).map(normalizeOption).filter(Boolean);

  const selected = safeOptions.find((o) => o.value === String(value) && o.value !== '');

  const filtered = query.trim()
    ? safeOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase().trim()))
    : safeOptions;

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

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e) {
      const clickedTrigger = containerRef.current?.contains(e.target);
      const clickedDropdown = dropdownRef.current?.contains(e.target);

      if (!clickedTrigger && !clickedDropdown) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Auto-focus search when opened
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

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={`flex-1 truncate ${selected ? 'text-ink' : 'text-secondary-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {value ? (
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

      {/* Dropdown */}
      {open && dropdownStyle && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[1000] min-w-0 max-w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={dropdownStyle}
        >
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <Search size={13} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                className="flex-1 bg-transparent text-sm focus:border-0 focus:outline-0 focus:ring-0 border-0 text-ink outline-none ring-0 placeholder:text-slate-400"
                placeholder="Search…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                  if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0]);
                }}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <X size={12} className="text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul className="overflow-y-auto py-1" style={{ maxHeight: Math.max(96, dropdownStyle.maxHeight - 57) }}>
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={`cursor-pointer px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    opt.value === String(value)
                      ? 'font-semibold text-primary-700 dark:text-primary-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
