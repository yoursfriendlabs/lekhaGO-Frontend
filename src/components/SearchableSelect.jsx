import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);
  const safeOptions = ensureArray(options);

  const selected = safeOptions.find((o) => o.value === value && o.value !== '');

  const filtered = query.trim()
    ? safeOptions.filter((o) => o.label.toLowerCase().includes(query.toLowerCase().trim()))
    : safeOptions;

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Auto-focus search when opened
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

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
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={`cursor-pointer px-3 py-2 text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    opt.value === value
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
        </div>
      )}
    </div>
  );
}
