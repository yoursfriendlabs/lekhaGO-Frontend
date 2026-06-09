import { useEffect, useMemo, useState } from 'react';
import { Search, UserRound, Wallet } from 'lucide-react';
import { Dialog } from './ui/Dialog.tsx';
import Notice from './Notice.jsx';
import { api } from '../lib/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useI18n } from '../lib/i18n.jsx';
import { getPartyBalanceMeta } from '../lib/partyBalances.js';
import { normalizeLookupParty } from '../lib/lookups.js';

function getInitials(name = '') {
  const trimmed = String(name || '').trim();
  if (!trimmed) return 'NA';

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0] || '')
    .join('')
    .toUpperCase();
}

export default function QuickPartySelector({
  isOpen,
  onClose,
  onSelect,
  selectedParty = null,
  type = 'customer',
  title,
  includeWalkIn = false,
  walkInLabel = '',
  walkInDescription = '',
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setParties([]);
      setLoading(false);
      setError('');
      return;
    }

    let isActive = true;
    const search = debouncedQuery.trim();
    const loadParties = async () => {
      setLoading(true);
      setError('');

      try {
        const response = search
          ? await api.lookupParties({ search, type, limit: 20 })
          : await api.listParties({ type, limit: 20, offset: 0 });

        if (!isActive) return;
        setParties((response?.items || []).map(normalizeLookupParty));
      } catch (nextError) {
        if (!isActive) return;
        setParties([]);
        setError(nextError.message);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadParties();

    return () => {
      isActive = false;
    };
  }, [debouncedQuery, isOpen, type]);

  const selectedIdentity = String(selectedParty?.id || '');
  const visibleParties = useMemo(
    () => parties.filter((party) => party?.id),
    [parties],
  );

  const money = (value) => (
    typeof value === 'number'
      ? t('currency.formatted', { symbol: t('currency.symbol'), amount: value.toFixed(2) })
      : value
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || t('quickEntry.selectPartyTitle')}
      size="lg"
    >
      <div className="space-y-4">
        {includeWalkIn ? (
          <div className="space-y-2">
            <p className="px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t('quickActions') || 'Quick Actions'}
            </p>
            {/* <button
              type="button"
              onClick={() => {
                onSelect?.(null);
                onClose?.();
              }}
              className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition ${
                !selectedIdentity
                  ? 'border-primary-300 bg-primary-50 shadow-sm'
                  : 'border-slate-100 bg-white hover:border-primary-100 hover:bg-primary-50/40'
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                <Wallet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-900">
                  {walkInLabel || t('quickPos.walkInCustomer')}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {walkInDescription || t('quickPos.walkInHint')}
                </p>
              </div>
            </button> */}
          </div>
        ) : null}

       <label className="relative block">
  <Search
    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
    size={18}
  />

  <input
    className="input h-11 w-full rounded-[18px] bg-slate-50 pl-12 pr-4 text-sm focus:bg-white"
    style={{ paddingLeft: '2.75rem', paddingRight: '1rem' }}
    value={query}
    autoFocus
    onChange={(event) => setQuery(event.target.value)}
    placeholder={t('quickEntry.searchPartyPlaceholder')}
  />
</label>

        {error ? <Notice title={error} tone="error" /> : null}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('common.loading')}
            </div>
          ) : visibleParties.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('parties.noParties')}
            </div>
          ) : (
            visibleParties.map((party) => {
              const balanceMeta = getPartyBalanceMeta(party.currentAmount, t);
              const isSelected = String(party.id || '') === selectedIdentity;

              return (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => {
                      onSelect?.(party);
                      onClose?.();
                    }}
                    className={`flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-primary-300 bg-primary-50 shadow-sm'
                        : 'border-slate-100 bg-white hover:border-primary-100 hover:bg-primary-50/40'
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-100 text-sm font-semibold text-secondary-800">
                      {getInitials(party.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-slate-900">{party.name || '—'}</p>
                      <p className="truncate text-xs text-slate-500">{party.phone || t('common.notAvailable')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold ${balanceMeta.textClass}`}>
                        {money(balanceMeta.absoluteAmount)}
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{balanceMeta.label}</p>
                    </div>
                  </button>
              );
            })
          )}
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <UserRound size={14} className="text-primary-500" />
            <span>{t('quickEntry.partySelectorHint')}</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
