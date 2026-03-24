import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Tag, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function normalizeCategory(category) {
  if (!category || typeof category !== 'object') return null;

  const id = category.id ?? category.value ?? null;
  const name = category.name ?? category.label ?? '';
  if (!id && !name) return null;

  return {
    id,
    name: String(name).trim(),
    type: category.type || 'product',
  };
}

function dedupeCategories(categories = []) {
  const seen = new Set();

  return categories.filter((category) => {
    const normalized = normalizeCategory(category);
    if (!normalized) return false;

    const key = normalized.id ? `id:${normalized.id}` : `name:${normalized.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(normalizeCategory);
}

export default function CategorySearchCreateField({
  selectedCategory = null,
  options = [],
  onSelect,
  onCreated,
  placeholder = '',
  searchPlaceholder = '',
  className = '',
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const selected = normalizeCategory(selectedCategory);
  const debouncedQuery = useDebouncedValue(query, 250);
  const suggestedOptions = useMemo(() => dedupeCategories(options).slice(0, 8), [options]);
  const visibleResults = useMemo(() => {
    if (!query.trim()) return suggestedOptions;
    return dedupeCategories(results).slice(0, 8);
  }, [query, results, suggestedOptions]);

  const canCreate = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) return false;

    return !visibleResults.some((category) => category?.name?.trim().toLowerCase() === trimmedQuery);
  }, [query, visibleResults]);

  const resetLocalState = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setMessage('');
  };

  useEffect(() => {
    if (!selected) return;
    resetLocalState();
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    function handleMouseDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    const search = debouncedQuery.trim();

    if (!search || selected) {
      setResults([]);
      return;
    }

    let isActive = true;

    api.listCategories({ type: 'product', search, limit: 10, offset: 0 })
      .then((response) => {
        if (!isActive) return;
        setResults(response?.items || []);
      })
      .catch(() => {
        if (!isActive) return;
        setResults([]);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedQuery, selected]);

  const handleSelect = (category) => {
    onSelect?.(normalizeCategory(category));
    resetLocalState();
  };

  const handleClear = () => {
    onSelect?.(null);
    resetLocalState();
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;

    setCreating(true);
    setMessage('');

    try {
      const createdCategory = await api.createCategory({
        name,
        type: 'product',
      });

      const normalized = normalizeCategory(createdCategory) || {
        id: createdCategory?.id,
        name,
        type: 'product',
      };

      onCreated?.(normalized);
      onSelect?.(normalized);
      resetLocalState();
    } catch (error) {
      setMessage(error?.status === 409 ? t('categories.messages.exists') : error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Tag size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{selected.name || placeholder || '—'}</p>
            <p className="text-xs text-slate-500">{t('inventory.itemCategory')}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800"
            aria-label={t('common.clear')}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/60 focus-within:border-primary-300">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200"
              placeholder={searchPlaceholder || placeholder || t('categories.selectCategory')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setMessage('');
              }}
              onFocus={() => setOpen(true)}
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setMessage('');
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label={t('common.clear')}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {open ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {visibleResults.length > 0 ? (
                visibleResults.map((category) => (
                  <button
                    key={category.id || category.name}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-slate-100/80 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/60 last:border-b-0"
                    onClick={() => handleSelect(category)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <Tag size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{category.name}</p>
                      <p className="text-xs text-slate-500">{category.type || 'product'}</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">{t('categories.noCategories')}</p>
              )}

              {canCreate ? (
                <div className="border-t border-slate-100/80 px-4 py-3 dark:border-slate-800/50">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    <Plus size={14} />
                    {creating ? t('common.loading') : `${t('common.add')} "${query.trim()}"`}
                  </button>
                  {message ? <p className="mt-2 text-xs text-rose-600">{message}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
