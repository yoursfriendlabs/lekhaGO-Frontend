import { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Plus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { normalizeLookupParty } from '../lib/lookups.js';
import { getPartyBalanceMeta } from '../lib/partyBalances.js';

function getInitials(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'NA';
  return trimmed.slice(0, 2).toUpperCase();
}

function normalizeSelectedParty(party) {
  if (!party || typeof party !== 'object') return null;
  const normalized = normalizeLookupParty(party);
  return normalized.id || normalized.name ? normalized : null;
}

export default function PartySearchCreateField({
  type = 'customer',
  selectedParty = null,
  onSelect,
  placeholder = '',
  searchPlaceholder = '',
  entityLabel = '',
  className = '',
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const selected = normalizeSelectedParty(selectedParty);
  const debouncedQuery = useDebouncedValue(query, 250);
  const visibleResults = useMemo(() => results.slice(0, 6), [results]);
  const balanceMeta = getPartyBalanceMeta(selected?.currentAmount, t);

  const resetLocalState = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setShowCreate(false);
    setNewPartyPhone('');
    setMessage('');
  };

  useEffect(() => {
    if (!selected) return;
    resetLocalState();
  }, [selected?.id]);

  useEffect(() => {
    function handleMouseDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setShowCreate(false);
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

    api.lookupParties({ search, type, limit: 10 })
      .then((response) => {
        if (!isActive) return;
        setResults((response?.items || []).map(normalizeLookupParty));
      })
      .catch(() => {
        if (!isActive) return;
        setResults([]);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedQuery, selected, type]);

  const handleSelect = (party) => {
    onSelect?.(party || null);
    resetLocalState();
  };

  const handleClear = () => {
    onSelect?.(null);
    resetLocalState();
  };

  const handleCreate = async () => {
    const name = query.trim().replace(/\s*\(.*\)\s*$/, '').trim();
    if (!name) return;

    const phoneDigits = newPartyPhone.trim().replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setMessage(t('errors.phoneMinDigits'));
      return;
    }

    setCreating(true);
    setMessage('');

    try {
      const createdParty = await api.createParty({
        name,
        phone: newPartyPhone.trim(),
        type,
      });
      handleSelect(normalizeLookupParty(createdParty));
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selected ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white">
            {getInitials(selected.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{selected.name || placeholder || '—'}</p>
            {selected.phone ? <p className="text-xs text-slate-500">{selected.phone}</p> : null}
            {selected.currentAmount !== undefined && selected.currentAmount !== null ? (
              <p className={`text-xs ${balanceMeta.textClass}`}>
                {balanceMeta.label}:{' '}
                {t('currency.formatted', {
                  symbol: t('currency.symbol'),
                  amount: balanceMeta.absoluteAmount.toFixed(2),
                })}
              </p>
            ) : null}
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
              placeholder={searchPlaceholder || placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setShowCreate(false);
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
                  setShowCreate(false);
                  setMessage('');
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label={t('common.clear')}
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {open && query.trim() ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {visibleResults.length > 0 ? (
                visibleResults.map((party) => (
                  <button
                    key={party.id || party.name}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-slate-100/80 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/60 last:border-b-0"
                    onClick={() => handleSelect(party)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {getInitials(party.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{party.name}</p>
                      {party.phone ? <p className="text-xs text-slate-500">{party.phone}</p> : null}
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-4 py-3 text-sm text-slate-500">{t('common.noData')}</p>
              )}

              {!showCreate ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-b-2xl px-4 py-3 text-sm text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                  onClick={() => {
                    setShowCreate(true);
                    setMessage('');
                  }}
                >
                  <Plus size={14} />
                  {t('common.add')} &ldquo;{query.trim()}&rdquo;{entityLabel ? ` ${entityLabel.toLowerCase()}` : ''}
                </button>
              ) : (
                <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                    <Phone size={13} className="shrink-0 text-slate-400" />
                    <input
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                      type="tel"
                      inputMode="numeric"
                      placeholder={t('parties.phonePlaceholder')}
                      value={newPartyPhone}
                      onChange={(event) => setNewPartyPhone(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleCreate();
                        }
                      }}
                    />
                  </div>
                  {message ? <p className="mt-2 text-xs text-rose-600">{message}</p> : null}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <button type="button" className="btn-ghost text-xs" onClick={() => setShowCreate(false)}>
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="btn-primary text-xs" onClick={handleCreate} disabled={creating}>
                      {creating ? t('common.loading') : t('common.create')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
