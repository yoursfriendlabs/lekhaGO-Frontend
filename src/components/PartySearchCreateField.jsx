import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, Phone, Plus, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { normalizeLookupParty } from '../lib/lookups.js';
import { getPartyBalanceMeta } from '../lib/partyBalances.js';
import { getDueWhatsAppMessage, getWhatsAppLink } from '../lib/whatsapp.js';

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
  const dropdownRef = useRef(null);
  const [query, setQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const createRequestRef = useRef(false);
  const selected = normalizeSelectedParty(selectedParty);
  const debouncedQuery = useDebouncedValue(query, 250);
  const visibleResults = useMemo(() => results.slice(0, 6), [results]);
  const balanceMeta = getPartyBalanceMeta(selected?.currentAmount, t);
  const hasBalance = selected?.currentAmount !== undefined && selected?.currentAmount !== null;
  const hasDue = hasBalance && balanceMeta.absoluteAmount > 0;
  const whatsappMessage = getDueWhatsAppMessage(
    selected?.name,
    hasDue
      ? t('currency.formatted', {
          symbol: t('currency.symbol'),
          amount: balanceMeta.absoluteAmount.toFixed(2),
        })
      : '',
  );
  const whatsappLink = getWhatsAppLink(selected?.phone, whatsappMessage);

  const resetLocalState = () => {
    setQuery('');
    setResults([]);
    setOpen(false);
    setShowCreate(false);
    setNewPartyPhone('');
    setMessage('');
  };

  const updateDropdownPosition = useCallback(() => {
    const trigger = containerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const margin = 8;
    const width = Math.min(viewportWidth - margin * 2, Math.max(rect.width, 340));
    const left = Math.min(Math.max(rect.left, margin), Math.max(margin, viewportWidth - width - margin));
    const dropdownMaxHeight = 360;
    const minHeight = 180;
    const belowSpace = viewportHeight - rect.bottom - margin - 4;
    const aboveSpace = rect.top - margin - 4;
    const opensAbove = belowSpace < minHeight && aboveSpace > belowSpace;
    const availableHeight = opensAbove ? aboveSpace : belowSpace;
    const maxHeight = Math.max(minHeight, Math.min(dropdownMaxHeight, availableHeight));
    const top = opensAbove ? Math.max(margin, rect.top - maxHeight - 4) : rect.bottom + 4;

    setDropdownStyle({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!selected) return;
    resetLocalState();
  }, [selected?.id]);

  useEffect(() => {
    function handleMouseDown(event) {
      const clickedTrigger = containerRef.current?.contains(event.target);
      const clickedDropdown = dropdownRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedDropdown) {
        setOpen(false);
        setShowCreate(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    if (!open || !query.trim() || selected) return undefined;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, query, selected, updateDropdownPosition]);

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
    if (createRequestRef.current) return;

    const name = query.trim().replace(/\s*\(.*\)\s*$/, '').trim();
    if (!name) return;

    const phoneDigits = newPartyPhone.trim().replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setMessage(t('errors.phoneMinDigits'));
      return;
    }

    createRequestRef.current = true;
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
      createRequestRef.current = false;
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
            {selected.phone ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <p className="text-xs text-slate-500">{selected.phone}</p>
                {!hasDue && whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                    aria-label={`Open WhatsApp chat for ${selected.phone}`}
                  >
                    <MessageCircle size={12} />
                    WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
            {hasBalance ? (
              <div className="mt-0.5">
                <p className={`text-xs ${balanceMeta.textClass}`}>
                  {balanceMeta.label}:{' '}
                  {t('currency.formatted', {
                    symbol: t('currency.symbol'),
                    amount: balanceMeta.absoluteAmount.toFixed(2),
                  })}
                </p>
                {hasDue && whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-800"
                    aria-label={`Open WhatsApp chat for ${selected.phone}`}
                  >
                    <MessageCircle size={12} />
                    WhatsApp
                  </a>
                ) : null}
              </div>
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

          {open && query.trim() && dropdownStyle ? createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[1000] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
              style={dropdownStyle}
            >
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
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{party.name}</p>
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
                      disabled={creating}
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
                    <button type="button" className="btn-ghost text-xs" onClick={() => setShowCreate(false)} disabled={creating}>
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="btn-primary text-xs" onClick={handleCreate} disabled={creating}>
                      {creating ? t('common.loading') : t('common.create')}
                    </button>
                  </div>
                </div>
              )}
            </div>,
            document.body
          ) : null}
        </div>
      )}
    </div>
  );
}
