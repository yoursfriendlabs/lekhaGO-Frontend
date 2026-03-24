import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { todayISODate } from '../lib/datetime';
import {
  getPartyBalanceMeta,
  getStatementTypeLabel,
  normalizePartyStatementResponse,
  toAmount,
} from '../lib/partyBalances.js';
import { usePartyStore } from '../stores/parties';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Plus, Bell, Search, Filter, ChevronDown } from 'lucide-react';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'customer',
  openingBalance: '',
  asOfDate: '',
  balanceType: 'receive',
};

const makeEmptyTx = () => ({
  partyId: '',
  direction: 'give',
  amount: '',
  txDate: todayISODate(),
  note: '',
  paymentMethod: 'cash',
  bankId: '',
  serviceId: '',
});

const TX_PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function getStatementBadgeClass(type) {
  const classes = {
    sale: 'bg-emerald-100 text-emerald-700',
    service: 'bg-sky-100 text-sky-700',
    purchase: 'bg-amber-100 text-amber-700',
    payment_in: 'bg-teal-100 text-teal-700',
    payment_out: 'bg-indigo-100 text-indigo-700',
  };

  return classes[type] || 'bg-slate-100 text-slate-600';
}

function getStatementRowTitle(row, t) {
  const reference = row.referenceNo || row.id?.slice(0, 8) || '-';

  switch (row.type) {
    case 'sale':
      return `${t('parties.salesInvoice')} ${reference}`;
    case 'service':
      return `${t('parties.serviceOrder')} ${reference}`;
    case 'purchase':
      return `${t('parties.purchaseBill')} ${reference}`;
    case 'payment_in':
      return `${t('parties.paymentIn')} ${reference}`;
    case 'payment_out':
      return `${t('parties.paymentOut')} ${reference}`;
    default:
      return reference;
  }
}

function getStatementAmountFields(row, t) {
  if (row.type === 'payment_in' || row.type === 'payment_out') {
    return {
      primaryLabel: t('ledger.amount'),
      primaryValue: toAmount(row.amount),
      secondaryLabel: null,
      secondaryValue: null,
      tertiaryLabel: null,
      tertiaryValue: null,
    };
  }

  return {
    primaryLabel: t('common.total'),
    primaryValue: toAmount(row.totalAmount),
    secondaryLabel: t('common.paid'),
    secondaryValue: toAmount(row.paidAmount),
    tertiaryLabel: t('common.due'),
    tertiaryValue: toAmount(row.dueAmount),
  };
}

export default function Parties() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { upsert: upsertParty, remove: removeParty, invalidate: invalidateParties } = usePartyStore();

  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [listError, setListError] = useState('');
  const [partyReloadKey, setPartyReloadKey] = useState(0);

  const [statementData, setStatementData] = useState(() => normalizePartyStatementResponse());
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
  const [statementReloadKey, setStatementReloadKey] = useState(0);

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selectedId, setSelectedId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credit');
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(makeEmptyTx());
  const [txStatus, setTxStatus] = useState({ type: 'info', message: '' });
  const [txLoading, setTxLoading] = useState(false);
  const [pendingServices, setPendingServices] = useState([]);
  const [pendingServicesLoading, setPendingServicesLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);

  useEffect(() => {
    let isActive = true;

    async function loadParties() {
      setLoadingParties(true);
      setListError('');

      try {
        const data = await api.listParties({
          ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
          ...(filterType !== 'all' ? { type: filterType } : {}),
        });

        if (!isActive) return;
        setParties(data?.items || []);
      } catch (err) {
        if (!isActive) return;
        setListError(err.message);
        setParties([]);
      } finally {
        if (isActive) setLoadingParties(false);
      }
    }

    loadParties();
    return () => {
      isActive = false;
    };
  }, [debouncedQuery, filterType, partyReloadKey]);

  useEffect(() => {
    if (!parties.length) {
      setSelectedId(null);
      return;
    }

    // Only auto-select first party if no party is currently selected
    // or if the currently selected party is not in the list
    if (!selectedId) {
      setSelectedId(parties[0].id);
    } else if (!parties.find((party) => party.id === selectedId)) {
      // If selected party is not in list, keep the selectedId but don't auto-change
      // This allows the statement to load for that party even if not in filtered list
    }
  }, [parties]);

  useEffect(() => {
    setTxPage(1);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setStatementData(normalizePartyStatementResponse());
      setStatementError('');
      return;
    }

    let isActive = true;

    async function loadStatement() {
      setStatementData(normalizePartyStatementResponse());
      setStatementLoading(true);
      setStatementError('');

      try {
        const data = await api.partyStatement({
          partyId: selectedId,
          limit: TX_PAGE_SIZE,
          offset: (txPage - 1) * TX_PAGE_SIZE,
        });
        const normalized = normalizePartyStatementResponse(data);

        if (!isActive) return;
        setStatementData(normalized);

        if (normalized.party?.id) {
          upsertParty(normalized.party);
          setParties((prev) =>
            prev.map((party) => (
              party.id === normalized.party.id
                ? { ...party, ...normalized.party }
                : party
            ))
          );
        }
      } catch (err) {
        if (!isActive) return;
        setStatementError(err.message);
        setStatementData(normalizePartyStatementResponse());
      } finally {
        if (isActive) setStatementLoading(false);
      }
    }

    loadStatement();
    return () => {
      isActive = false;
    };
  }, [selectedId, statementReloadKey, txPage, upsertParty]);

  const totalsummary = useMemo(() => {
    return parties.reduce(
      (totals, party) => {
        const amount = toAmount(party.currentAmount);
        if (amount < 0) totals.totalReceive += Math.abs(amount);
        else if (amount > 0) totals.totalGive += amount;
        return totals;
      },
      { totalReceive: 0, totalGive: 0 }
    );
  }, [parties]);

  const selectedParty = useMemo(
    () => parties.find((party) => party.id === selectedId) || null,
    [parties, selectedId]
  );
  const selectedPartyView = selectedParty || statementData.party
    ? { ...(selectedParty || {}), ...(statementData.party || {}) }
    : null;
  const selectedBalanceMeta = getPartyBalanceMeta(selectedPartyView?.currentAmount, t);
  const totalTxPages = Math.max(1, Math.ceil(statementData.summary.totalRows / TX_PAGE_SIZE));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setActiveTab('credit');
    setIsOpen(true);
  };

  const openEdit = (party) => {
    setEditingId(party.id);
    setForm({
      name: party.name || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      type: party.type || 'customer',
      openingBalance: party.openingBalance || '',
      asOfDate: party.asOfDate || '',
      balanceType: party.balanceType || 'receive',
    });
    setActiveTab('credit');
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openTxDialog = async () => {
    if (!selectedParty) return;

    setTxForm({ ...makeEmptyTx(), partyId: selectedParty.id });
    setTxStatus({ type: 'info', message: '' });
    setPendingServices([]);
    setPendingServicesLoading(true);
    setTxOpen(true);

    try {
      const data = await api.partyStatement({
        partyId: selectedParty.id,
        type: 'service',
        limit: 100,
        offset: 0,
      });
      const normalized = normalizePartyStatementResponse(data);
      setPendingServices(
        normalized.rows.filter((row) => row.type === 'service' && toAmount(row.dueAmount) > 0)
      );
    } catch (err) {
      setTxStatus({ type: 'error', message: err.message });
    } finally {
      setPendingServicesLoading(false);
    }
  };

  const closeTxDialog = () => {
    setTxOpen(false);
    setTxStatus({ type: 'info', message: '' });
    setTxForm(makeEmptyTx());
    setPendingServices([]);
    setPendingServicesLoading(false);
  };

  const handleTxChange = (event) => {
    const { name, value } = event.target;
    setTxForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('parties.confirmDelete'))) return;

    try {
      await api.deleteParty(id);
      removeParty(id);
      invalidateParties();
      setStatus({ type: 'success', message: t('parties.messages.deleted') });
      setPartyReloadKey((prev) => prev + 1);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const submitParty = async (keepOpen = false) => {
    const phoneDigits = String(form.phone || '').replace(/\D/g, '');
    if (!editingId) {
      if (phoneDigits.length < 10) {
        setStatus({ type: 'error', message: t('errors.phoneMinDigits') });
        return;
      }
    } else if (form.phone && phoneDigits.length < 10) {
      setStatus({ type: 'error', message: t('errors.phoneMinDigits') });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      const saved = editingId
        ? await api.updateParty(editingId, form)
        : await api.createParty(form);

      if (saved?.id) {
        upsertParty(saved);
        setSelectedId(saved.id);
      }

      invalidateParties();
      setPartyReloadKey((prev) => prev + 1);
      setStatus({
        type: 'success',
        message: editingId ? t('parties.messages.updated') : t('parties.messages.created'),
      });

      if (keepOpen) {
        setForm(emptyForm);
      } else {
        closeDialog();
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    if (!txForm.partyId) return;

    setTxLoading(true);
    setTxStatus({ type: 'info', message: '' });

    try {
      const amount = toAmount(txForm.amount);
      if (requiresBankSelection(txForm, amount)) {
        setTxStatus({ type: 'error', message: t('payments.bankRequired') });
        return;
      }
      const payload = {
        partyId: txForm.partyId,
        direction: txForm.direction,
        amount,
        txDate: txForm.txDate,
        ...buildPaymentPayload(
          {
            paymentMethod: txForm.paymentMethod,
            bankId: txForm.bankId,
            paymentNote: txForm.note,
          },
          { noteKey: 'note' }
        ),
      };

      await api.createPartyTransaction(payload);

      if (txForm.serviceId) {
        const selectedService = pendingServices.find((service) => service.id === txForm.serviceId);
        if (selectedService) {
          const nextPaidAmount = Math.min(
            toAmount(selectedService.totalAmount),
            toAmount(selectedService.paidAmount) + amount
          );
          await api.updateService(txForm.serviceId, { receivedTotal: nextPaidAmount });
        }
      }

      invalidateParties();
      setPartyReloadKey((prev) => prev + 1);
      setStatementReloadKey((prev) => prev + 1);
      setStatus({ type: 'success', message: t('parties.messages.transactionSaved') });
      closeTxDialog();
    } catch (err) {
      setTxStatus({ type: 'error', message: err.message });
    } finally {
      setTxLoading(false);
    }
  };

  const goToStatement = () => {
    if (!selectedParty) return;
    navigate(`/app/ledger?partyId=${selectedParty.id}`);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('parties.title')}
        subtitle={t('parties.subtitle')}
        action={(
          <button className="btn-primary" type="button" onClick={openCreate}>
            <Plus size={16} /> {t('parties.addParty')}
          </button>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      {listError ? <Notice title={listError} tone="error" /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-5 py-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div>
            <p className="text-xs uppercase text-emerald-600 dark:text-emerald-400">{t('parties.totalToReceive')}</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: totalsummary.totalReceive.toFixed(2) })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-rose-200/70 bg-rose-50/60 px-5 py-4 dark:border-rose-800/40 dark:bg-rose-900/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/40">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
          </div>
          <div>
            <p className="text-xs uppercase text-rose-600 dark:text-rose-400">{t('parties.totalToGive')}</p>
            <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: totalsummary.totalGive.toFixed(2) })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
              {t('parties.listTitle', { count: parties.length })}
            </h3>
            <button className="btn-ghost" type="button" onClick={openCreate}>
              <ChevronDown size={16} /> {t('parties.addParty')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950">
              <Search size={16} className="text-slate-400" />
              <input
                className="w-full bg-transparent outline-none"
                placeholder={t('parties.searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="btn-ghost" type="button">
              <Filter size={16} />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['customer', 'supplier', 'all'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={
                  filterType === type
                    ? 'rounded-xl bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700'
                    : 'rounded-xl bg-slate-100 px-3 py-1 text-sm text-slate-600'
                }
              >
                {t(`parties.types.${type}`)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {loadingParties && parties.length === 0 ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : parties.length === 0 ? (
              <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
            ) : (
              parties.map((party) => {
                const balanceMeta = getPartyBalanceMeta(party.currentAmount, t);
                const isSelected = selectedId === party.id;

                return (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => setSelectedId(party.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-emerald-300 bg-emerald-50 shadow-sm ring-1 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/20 dark:ring-emerald-800'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white transition-colors ${
                        isSelected ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}>
                        {party.name?.slice(0, 2).toUpperCase() || 'P'}
                      </div>
                      <div className="flex-1">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                          {party.name}
                          {balanceMeta.tone !== 'settled' && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${balanceMeta.badgeClass}`}>
                              {balanceMeta.label}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{party.phone || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${balanceMeta.textClass}`}>
                          {t('currency.formatted', {
                            symbol: t('currency.symbol'),
                            amount: balanceMeta.absoluteAmount.toFixed(2),
                          })}
                        </p>
                        <p className="text-xs text-slate-500">{balanceMeta.label}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card space-y-4">
          {selectedPartyView ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-semibold text-emerald-700">
                    {selectedPartyView.name?.slice(0, 1).toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{selectedPartyView.name}</p>
                    <p className="text-sm text-slate-500">{selectedPartyView.phone || '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-slate-400">{selectedBalanceMeta.label}</p>
                  <p className={`text-2xl font-semibold ${selectedBalanceMeta.textClass}`}>
                    {t('currency.formatted', {
                      symbol: t('currency.symbol'),
                      amount: selectedBalanceMeta.absoluteAmount.toFixed(2),
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(selectedPartyView)}>
                    {t('parties.manageParty')}
                  </button>
                  <button className="btn-ghost" type="button" onClick={goToStatement}>
                    {t('parties.statement')}
                  </button>
                </div>
                <div className="flex gap-2">

                  <button className="btn-ghost text-rose-600" type="button" onClick={() => handleDelete(selectedPartyView.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <h4 className="text-lg font-semibold text-slate-900">
                  {t('parties.transactions', { count: statementData.summary.totalRows })}
                </h4>
                <button className="btn-primary" type="button" onClick={openTxDialog}>
                  <Plus size={16} /> {t('parties.addTransaction')}
                </button>
              </div>

              {statementError ? <Notice title={statementError} tone="error" /> : null}

              <div className="space-y-2">
                {statementLoading ? (
                  <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
                ) : statementData.rows.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">{t('parties.noTransactions')}</p>
                ) : (
                  statementData.rows.map((row) => {
                    const amountFields = getStatementAmountFields(row, t);

                    return (
                      <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatementBadgeClass(row.type)}`}>
                                {getStatementTypeLabel(row.type, t)}
                              </span>
                              <span className="truncate text-sm font-medium text-slate-800">
                                {getStatementRowTitle(row, t)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>{formatDate(row.date || row.createdAt)}</span>
                              {row.status ? <span>{row.status}</span> : null}
                              {row.direction ? <span>{row.direction}</span> : null}
                              {row.note ? <span className="italic">{row.note}</span> : null}
                            </div>
                            <PaymentTypeSummary
                              source={row}
                              className="mt-2"
                              labelClassName="text-xs font-medium"
                              metaClassName="text-[11px]"
                            />
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-semibold text-slate-900">
                              {amountFields.primaryLabel}:{' '}
                              {t('currency.formatted', {
                                symbol: t('currency.symbol'),
                                amount: amountFields.primaryValue.toFixed(2),
                              })}
                            </p>
                            {amountFields.secondaryLabel ? (
                              <p className="text-slate-500">
                                {amountFields.secondaryLabel}:{' '}
                                {t('currency.formatted', {
                                  symbol: t('currency.symbol'),
                                  amount: amountFields.secondaryValue.toFixed(2),
                                })}
                              </p>
                            ) : null}
                            {amountFields.tertiaryLabel ? (
                              <p className="text-rose-500">
                                {amountFields.tertiaryLabel}:{' '}
                                {t('currency.formatted', {
                                  symbol: t('currency.symbol'),
                                  amount: amountFields.tertiaryValue.toFixed(2),
                                })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalTxPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
                  <span>
                    {statementData.summary.totalRows} transactions · page {txPage} of {totalTxPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={txPage === 1}
                      onClick={() => setTxPage((prev) => prev - 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={txPage === totalTxPages}
                      onClick={() => setTxPage((prev) => prev + 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
          )}
        </div>
      </div>

      <Dialog isOpen={isOpen} onClose={closeDialog} title={editingId ? t('parties.editParty') : t('parties.addParty')} size="lg">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submitParty(false); }}>
          {status.message ? <Notice title={status.message} tone={status.type} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('parties.partyName')}</label>
              <input className="input mt-1" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">{t('parties.phone')}</label>
              <input className="input mt-1" type="tel" inputMode="numeric" name="phone" value={form.phone} onChange={handleChange} placeholder={t('parties.phonePlaceholder')} required={!editingId} />
            </div>
          </div>
          <div>
            <label className="label">{t('parties.partyType')}</label>
            <div className="mt-1 flex gap-2">
              {['customer', 'supplier'].map((type) => (
                <button key={type} type="button" onClick={() => setForm((prev) => ({ ...prev, type }))} className={form.type === type ? 'btn-primary' : 'btn-ghost'}>
                  {t(`parties.types.${type}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-slate-200 pb-2 text-sm text-slate-500">
            <button type="button" onClick={() => setActiveTab('credit')} className={activeTab === 'credit' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}>{t('parties.creditInfo')}</button>
            <button type="button" onClick={() => setActiveTab('additional')} className={activeTab === 'additional' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}>{t('parties.additionalInfo')}</button>
          </div>

          {activeTab === 'credit' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('parties.openingBalance')}</label>
                <input className="input mt-1" name="openingBalance" type="number" step="0.01" value={form.openingBalance} onChange={handleChange} />
              </div>
              <div>
                <label className="label">{t('parties.asOfDate')}</label>
                <input className="input mt-1" name="asOfDate" type="date" value={form.asOfDate} onChange={handleChange} />
              </div>
              <div className="flex gap-2">
                {['receive', 'give'].map((type) => (
                  <button key={type} type="button" onClick={() => setForm((prev) => ({ ...prev, balanceType: type }))} className={form.balanceType === type ? 'btn-primary' : 'btn-ghost'}>
                    {type === 'receive' ? t('parties.toReceive') : t('parties.toGive')}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('parties.email')}</label>
                <input className="input mt-1" name="email" value={form.email} onChange={handleChange} />
              </div>
              <div>
                <label className="label">{t('parties.address')}</label>
                <input className="input mt-1" name="address" value={form.address} onChange={handleChange} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={closeDialog}>{t('common.close')}</button>
            {!editingId ? (
              <button className="btn-ghost" type="button" onClick={() => submitParty(true)} disabled={loading}>{t('parties.saveAndNew')}</button>
            ) : null}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? t('common.loading') : editingId ? t('common.update') : t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={txOpen} onClose={closeTxDialog} title={t('parties.addTransaction')} size="md">
        <form className="space-y-4" onSubmit={submitTransaction}>
          <div>
            <label className="label">{t('parties.transactionType')}</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { value: 'receive', label: t('parties.paymentIn') },
                { value: 'give', label: t('parties.paymentOut') },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTxForm((prev) => ({ ...prev, direction: opt.value }))}
                  className={
                    txForm.direction === opt.value
                      ? opt.value === 'give'
                        ? 'rounded-xl border-2 border-emerald-400 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'rounded-xl border-2 border-rose-400 bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
                      : 'rounded-xl border-2 border-slate-200 bg-white py-2.5 text-sm text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">{t('parties.transactionAmount')}</label>
            <input className="input mt-1" name="amount" type="number" step="0.01" value={txForm.amount} onChange={handleTxChange} required />
          </div>
          <div>
            <label className="label">{t('parties.transactionDate')}</label>
            <input className="input mt-1" name="txDate" type="date" value={txForm.txDate} onChange={handleTxChange} />
          </div>
          {pendingServicesLoading ? (
            <p className="text-xs text-slate-500">{t('common.loading')}</p>
          ) : pendingServices.length > 0 ? (
            <div>
              <label className="label">Apply to service order <span className="text-slate-400">(optional)</span></label>
              <select className="input mt-1" name="serviceId" value={txForm.serviceId} onChange={handleTxChange}>
                <option value="">— none —</option>
                {pendingServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {(service.referenceNo || service.id.slice(0, 8))} — Rs {toAmount(service.dueAmount).toFixed(2)} due
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <PaymentMethodFields
            value={{
              paymentMethod: txForm.paymentMethod,
              bankId: txForm.bankId,
              paymentNote: txForm.note,
            }}
            onChange={(patch) => setTxForm((prev) => ({
              ...prev,
              paymentMethod: patch.paymentMethod,
              bankId: patch.bankId,
              note: patch.paymentNote,
            }))}
            noteLabel={t('parties.transactionNote')}
          />
          {txStatus.message ? <Notice title={txStatus.message} tone={txStatus.type} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={closeTxDialog}>{t('common.close')}</button>
            <button className="btn-primary" type="submit" disabled={txLoading}>
              {txLoading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
