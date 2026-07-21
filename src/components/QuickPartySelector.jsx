import { useEffect, useMemo, useState } from 'react';
import { MapPin, Phone, Plus, Search, User, UserRound, Wallet, X } from 'lucide-react';
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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setParties([]);
      setLoading(false);
      setError('');
      setShowCreateForm(false);
      setNewPartyName('');
      setNewPartyPhone('');
      setNewPartyAddress('');
      setCreateError('');
      setCreating(false);
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

  const handleCreateParty = async (event) => {
    event?.preventDefault();
    if (!newPartyName.trim()) {
      setCreateError('Customer name is required.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const created = await api.createParty({
        name: newPartyName.trim(),
        phone: newPartyPhone.trim(),
        address: newPartyAddress.trim(),
        type,
      });

      const normalized = normalizeLookupParty(created);
      onSelect?.(normalized);
      onClose?.();
    } catch (err) {
      setCreateError(err.message || 'Failed to create customer party.');
    } finally {
      setCreating(false);
    }
  };

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
        {showCreateForm ? (
          <form onSubmit={handleCreateParty} className="space-y-3 rounded-2xl border border-primary-200 bg-primary-50/50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Add New Customer Party</h4>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            {createError ? <Notice title={createError} tone="error" /> : null}

            <div>
              <label className="label text-xs">Customer Name *</label>
              <div className="relative mt-1">
                <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input h-10 w-full pl-9 text-sm"
                  placeholder="Enter customer full name"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label text-xs">Phone Number</label>
              <div className="relative mt-1">
                <Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input h-10 w-full pl-9 text-sm"
                  type="tel"
                  placeholder="e.g. 9801234567"
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label text-xs">Delivery Address</label>
              <div className="relative mt-1">
                <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input h-10 w-full pl-9 text-sm"
                  placeholder="Delivery address / location details"
                  value={newPartyAddress}
                  onChange={(e) => setNewPartyAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setShowCreateForm(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary text-xs"
                disabled={creating}
              >
                {creating ? 'Saving...' : 'Save & Select Customer'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                {!query && (
                  <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                )}
                <input
                  className={`input h-11 w-full rounded-[18px] bg-slate-50 text-sm focus:bg-white transition ${
                    query ? "px-3.5 pr-9" : "pl-10 pr-4"
                  }`}
                  value={query}
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('quickEntry.searchPartyPlaceholder')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setNewPartyName(query.trim());
                  setShowCreateForm(true);
                }}
                className="btn-secondary h-11 shrink-0 rounded-[18px] px-3.5 text-xs font-bold text-primary-700 hover:bg-primary-50"
              >
                <Plus size={14} className="mr-1 inline" />
                New Customer
              </button>
            </div>

            {error ? <Notice title={error} tone="error" /> : null}

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  {t('common.loading')}
                </div>
              ) : visibleParties.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 space-y-2">
                  <p>{t('parties.noParties')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPartyName(query.trim());
                      setShowCreateForm(true);
                    }}
                    className="btn-primary text-xs mx-auto"
                  >
                    <Plus size={14} className="mr-1 inline" /> Add New Customer Party
                  </button>
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
                        <p className="truncate text-xs text-slate-500">
                          {party.phone || t('common.notAvailable')}
                          {party.address ? ` · ${party.address}` : ''}
                        </p>
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
          </>
        )}

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

