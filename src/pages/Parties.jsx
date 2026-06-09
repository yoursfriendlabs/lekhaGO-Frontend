import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import RefreshButton from '../components/RefreshButton.jsx';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
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
import { Plus, Bell, Search, Filter, ChevronDown, MessageCircle } from 'lucide-react';
import { buildPaymentPayload, requiresBankSelection } from '../lib/payments';
import { getDueWhatsAppMessage, getWhatsAppLink } from '../lib/whatsapp.js';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'customer',
  openingBalance: 0,
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
const PARTY_PAGE_SIZE = 20;
const SUCCESS_NOTICE_TIMEOUT_MS = 3000;

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
    expense: 'bg-rose-100 text-rose-700',
    payment_in: 'bg-teal-100 text-teal-700',
    payment_out: 'bg-red-500 text-white',
  };

  return classes[type] || 'bg-slate-100 text-slate-600';
}

function getStatementRowTitle(row, t) {
  const reference = row.referenceNo || row.id?.slice(0, 8) || '-';

  switch (row.type) {
    case 'sale':
      return `${t('parties.salesInvoice')} `;
    case 'service':
      return `${t('parties.serviceOrder')} `;
    case 'purchase':
      return `${t('parties.purchaseBill')} `;
    case 'expense':
      return `${t('purchases.expense')} `;
    case 'payment_in':
      return `Received`;
    case 'payment_out':
      return `Given `;
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

function mergeUniqueParties(existing = [], incoming = []) {
  const seen = new Set();
  const merged = [];

  [...existing, ...incoming].forEach((party) => {
    if (!party?.id || seen.has(party.id)) return;
    seen.add(party.id);
    merged.push(party);
  });

  return merged;
}

export default function Parties() {
  const { canManageFeature } = useAuth();
  const { t } = useI18n();
  const canManageParties = canManageFeature('parties');
  const navigate = useNavigate();
  const { upsert: upsertParty, remove: removeParty, invalidate: invalidateParties } = usePartyStore();

  const [parties, setParties] = useState([]);
  const [loadingParties, setLoadingParties] = useState(false);
  const [listError, setListError] = useState('');
  const [partyReloadKey, setPartyReloadKey] = useState(0);
  const [refreshingParties, setRefreshingParties] = useState(false);

  const [statementData, setStatementData] = useState(() => normalizePartyStatementResponse());
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
  const [statementReloadKey, setStatementReloadKey] = useState(0);

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

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
  const [deleteParty, setDeleteParty] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [partyTotal, setPartyTotal] = useState(0);
  const [loadingMoreParties, setLoadingMoreParties] = useState(false);
  const [partyHasMore, setPartyHasMore] = useState(false);
  const partyListScrollRef = useRef(null);
  const partyListSentinelRef = useRef(null);
  const partyListSessionRef = useRef(0);
  const submitPartyRequestRef = useRef(false);
  const supportsIntersectionObserver = typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    if (status.type !== 'success' || !status.message) return undefined;

    const timerId = window.setTimeout(() => {
      setStatus((current) =>
        current.type === 'success' && current.message === status.message
          ? { type: 'info', message: '' }
          : current
      );
    }, SUCCESS_NOTICE_TIMEOUT_MS);

    return () => window.clearTimeout(timerId);
  }, [status.message, status.type]);

  const loadPartyPage = useCallback(
    async ({ offset = 0, append = false, session = partyListSessionRef.current, force = false } = {}) => {
      const search = debouncedQuery.trim();
      const requestParams = {
        limit: PARTY_PAGE_SIZE,
        offset,
        ...(search ? { search } : {}),
        ...(filterType !== 'all' ? { type: filterType } : {}),
      };

      if (append) {
        setLoadingMoreParties(true);
      } else {
        setLoadingParties(true);
        setListError('');
      }

      try {
        const data = await api.listParties(requestParams, { force });

        if (session !== partyListSessionRef.current) return;

        const nextItems = data?.items || [];
        const total = Number(data?.total ?? nextItems.length);
        const pageFilled = nextItems.length === PARTY_PAGE_SIZE;

        setListError('');
        setParties((previous) => (append ? mergeUniqueParties(previous, nextItems) : nextItems));
        setPartyTotal(total);
        setPartyHasMore(nextItems.length > 0 && (offset + nextItems.length < total || pageFilled));

        if (!append && nextItems[0]?.id) {
          setSelectedId((currentSelectedId) => currentSelectedId || nextItems[0].id);
        }
      } catch (err) {
        if (session !== partyListSessionRef.current) return;

        setListError(err.message);
        setPartyHasMore(false);

        if (!append) {
          setParties([]);
          setPartyTotal(0);
        }
      } finally {
        if (session !== partyListSessionRef.current) return;

        if (append) {
          setLoadingMoreParties(false);
        } else {
          setLoadingParties(false);
        }
      }
    },
    [debouncedQuery, filterType]
  );

  const refreshParties = async () => {
    if (refreshingParties) return;

    const session = partyListSessionRef.current + 1;
    partyListSessionRef.current = session;

    setRefreshingParties(true);
    if (partyListScrollRef.current) {
      partyListScrollRef.current.scrollTop = 0;
    }

    setParties([]);
    setPartyTotal(0);
    setPartyHasMore(false);
    setLoadingMoreParties(false);

    try {
      await loadPartyPage({ offset: 0, append: false, session, force: true });
    } finally {
      if (session === partyListSessionRef.current) {
        setRefreshingParties(false);
      }
    }
  };

  useEffect(() => {
    const session = partyListSessionRef.current + 1;
    partyListSessionRef.current = session;
    if (partyListScrollRef.current) {
      partyListScrollRef.current.scrollTop = 0;
    }
    setParties([]);
    setPartyTotal(0);
    setPartyHasMore(false);
    setLoadingMoreParties(false);
    loadPartyPage({ offset: 0, append: false, session });
  }, [debouncedQuery, filterType, partyReloadKey, loadPartyPage]);

  useEffect(() => {
    const root = partyListScrollRef.current;
    const sentinel = partyListSentinelRef.current;

    if (
      !supportsIntersectionObserver ||
      !root ||
      !sentinel ||
      !partyHasMore ||
      loadingParties ||
      loadingMoreParties
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        loadPartyPage({
          offset: parties.length,
          append: true,
          session: partyListSessionRef.current,
        });
      },
      {
        root,
        rootMargin: '160px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPartyPage, loadingMoreParties, loadingParties, partyHasMore, parties.length, supportsIntersectionObserver]);

  useEffect(() => {
    if (loadingParties && parties.length === 0) {
      return;
    }

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
  }, [loadingParties, parties, selectedId]);

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
  const selectedPartyHasDue = selectedBalanceMeta.absoluteAmount > 0;
  const selectedPartyWhatsAppMessage = getDueWhatsAppMessage(
    selectedPartyView?.name,
    selectedPartyHasDue
      ? t('currency.formatted', {
          symbol: t('currency.symbol'),
          amount: selectedBalanceMeta.absoluteAmount.toFixed(2),
        })
      : '',
  );
  const selectedPartyWhatsAppLink = getWhatsAppLink(selectedPartyView?.phone, selectedPartyWhatsAppMessage);
  const totalTxPages = Math.max(1, Math.ceil(statementData.summary.totalRows / TX_PAGE_SIZE));
  const partySummaryCards = [
    {
      key: 'sales-and-services',
      label: t('dashboard.salesAndServices'),
      total: statementData.summary.totalSales + statementData.summary.totalServices,
      due: statementData.summary.salesDue + statementData.summary.servicesDue,
    },
    {
      key: 'purchases',
      label: t('ledger.purchase'),
      total: statementData.summary.totalPurchases,
      due: statementData.summary.purchasesDue,
    },
    {
      key: 'expenses',
      label: t('purchases.expense'),
      total: statementData.summary.totalExpenses,
      due: statementData.summary.expensesDue,
    },
  ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => {
    if (!canManageParties) return;
    setEditingId(null);
    setForm(emptyForm);
    setActiveTab('credit');
    setIsOpen(true);
  };

  const openEdit = (party) => {
    if (!canManageParties) return;
    setEditingId(party.id);
    setForm({
      name: party.name || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      type: party.type || 'customer',
      openingBalance: party.openingBalance || 0,
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
    if (!canManageParties) return;
    if (pendingServicesLoading) return;
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

  const closeDeleteDialog = () => {
    if (deleteSubmitting) return;
    setDeleteParty(null);
  };

  const handleDelete = async () => {
    if (!canManageParties) return;
    if (!deleteParty) return;
    if (deleteSubmitting) return;

    setDeleteSubmitting(true);
    try {
      await api.deleteParty(deleteParty.id);
      removeParty(deleteParty.id);
      invalidateParties();
      setStatus({ type: 'success', message: t('parties.messages.deleted') });
      if (selectedId === deleteParty.id) {
        setSelectedId(null);
      }
      setPartyReloadKey((prev) => prev + 1);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setDeleteSubmitting(false);
      setDeleteParty(null);
    }
  };

  const submitParty = async (keepOpen = false) => {
    if (!canManageParties) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }
    if (submitPartyRequestRef.current) return;

    const phoneDigits = String(form.phone || '').replace(/\D/g, '');
    if (form.phone && phoneDigits.length < 10) {
      setStatus({ type: 'error', message: t('errors.phoneMinDigits') });
      return;
    }

    submitPartyRequestRef.current = true;
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
      submitPartyRequestRef.current = false;
      setLoading(false);
    }
  };

  const submitTransaction = async (event) => {
    event.preventDefault();
    if (!canManageParties) {
      setTxStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }
    if (txLoading) return;
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

      // if (txForm.serviceId) {
      //   const selectedService = pendingServices.find((service) => service.id === txForm.serviceId);
      //   if (selectedService) {
      //     const nextPaidAmount = Math.min(
      //       toAmount(selectedService.totalAmount),
      //       toAmount(selectedService.paidAmount) + amount
      //     );
      //     await api.updateService(txForm.serviceId, { receivedTotal: nextPaidAmount });
      //   }
      // }

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
          canManageParties ? (
            <button className="btn-primary" type="button" onClick={openCreate}>
              <Plus size={16} /> {t('parties.addParty')}
            </button>
          ) : null
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
        <div className="card flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
              {t('parties.listTitle', { count: partyTotal || parties.length })}
            </h3>
            <div className="flex flex-wrap gap-2">
              <RefreshButton refreshing={refreshingParties} onClick={refreshParties} />
              {canManageParties ? (
                <button className="btn-ghost" type="button" onClick={openCreate}>
                  <ChevronDown size={16} /> {t('parties.addParty')}
                </button>
              ) : null}
            </div>
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

          <div
            ref={partyListScrollRef}
            className="min-h-[360px] max-h-[60vh] space-y-2 overflow-y-auto pr-1 no-scrollbar lg:max-h-[calc(100vh-22rem)]"
          >
            {loadingParties && parties.length === 0 ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : parties.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
                {listError ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-rose-600 transition hover:text-rose-700"
                    onClick={() =>
                      loadPartyPage({
                        offset: 0,
                        append: false,
                        session: partyListSessionRef.current,
                      })
                    }
                  >
                    Retry
                  </button>
                ) : null}
              </div>
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

            <div ref={partyListSentinelRef} className="h-4" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-500 dark:border-slate-700/60">
            <span>{t('pagination.showing', { start: parties.length ? 1 : 0, end: parties.length, total: partyTotal || parties.length })}</span>
            {loadingMoreParties ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-500" />
                {t('common.loading')}
              </span>
            ) : listError ? (
              <button
                type="button"
                className="font-semibold text-rose-600 transition hover:text-rose-700"
                onClick={() =>
                  loadPartyPage({
                    offset: parties.length,
                    append: true,
                    session: partyListSessionRef.current,
                  })
                }
              >
                Retry load more
              </button>
            ) : partyHasMore ? (
              supportsIntersectionObserver ? (
                <span>Scroll to load more</span>
              ) : (
                <button
                  type="button"
                  className="font-semibold text-emerald-600 transition hover:text-emerald-700"
                  onClick={() =>
                    loadPartyPage({
                      offset: parties.length,
                      append: true,
                      session: partyListSessionRef.current,
                    })
                  }
                >
                  Load more
                </button>
              )
            ) : (
              <span>All parties loaded</span>
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
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-slate-500">{selectedPartyView.phone || '-'}</p>
                      {!selectedPartyHasDue && selectedPartyWhatsAppLink ? (
                        <a
                          href={selectedPartyWhatsAppLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200"
                          aria-label={`Open WhatsApp chat for ${selectedPartyView.phone}`}
                        >
                          <MessageCircle size={12} />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
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
                  {selectedPartyHasDue && selectedPartyWhatsAppLink ? (
                    <a
                      href={selectedPartyWhatsAppLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50"
                      aria-label={`Open WhatsApp chat for ${selectedPartyView.phone}`}
                    >
                      <MessageCircle size={12} />
                      WhatsApp
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {canManageParties ? (
                    <button className="btn-ghost" type="button" onClick={() => openEdit(selectedPartyView)}>
                      {t('parties.manageParty')}
                    </button>
                  ) : null}
                  <button className="btn-ghost" type="button" onClick={goToStatement}>
                    {t('parties.statement')}
                  </button>
                </div>
                {canManageParties ? (
                  <div className="flex gap-2">
                    <button className="btn-ghost text-rose-600" type="button" onClick={() => setDeleteParty(selectedPartyView)}>
                      {t('common.delete')}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {partySummaryCards.map((card) => (
                  <div
                    key={card.key}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3 dark:border-slate-800/60 dark:bg-slate-900/30"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {card.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {t('common.total')}: {t('currency.formatted', {
                        symbol: t('currency.symbol'),
                        amount: card.total.toFixed(2),
                      })}
                    </p>
                    <p className="mt-1 text-xs text-rose-500 dark:text-rose-300">
                      {t('common.due')}: {t('currency.formatted', {
                        symbol: t('currency.symbol'),
                        amount: card.due.toFixed(2),
                      })}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <h4 className="text-lg font-semibold text-slate-900">
                  {t('parties.transactions', { count: statementData.summary.totalRows })}
                </h4>
                {canManageParties ? (
                  <button className="btn-primary" type="button" onClick={openTxDialog} disabled={pendingServicesLoading}>
                    <Plus size={16} /> {pendingServicesLoading ? t('common.loading') : t('parties.addTransaction')}
                  </button>
                ) : null}
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
                            <div className="mt-2 flex flex-wrap text-black font-medium items-center gap-x-3 gap-y-1 text-xs ">
                              <span>{dayjs(row.date || row.createdAt).format('dddd MMM, YY')}</span>
                              {row.status ? <span>{row.status}</span> : null}
                              {row.note ? <span className="italic">Note: {row.note}</span> : null}
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
              <input className="input mt-1" type="tel" inputMode="numeric" name="phone" value={form.phone} onChange={handleChange} placeholder={t('parties.phonePlaceholder')} />
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

                <input className="input mt-1" name="openingBalance" type="number"  step="1" defaultValue={0} min={0} value={form.openingBalance} onChange={handleChange} />

              </div>

              <div>
                <label className="label">{t('parties.asOfDate')}</label>
                <input
  className="input mt-1"
  name="asOfDate"
  type="date"
  value={form.asOfDate || new Date().toISOString().split("T")[0]}
  onChange={handleChange}
/>
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
            <button className="btn-secondary" type="button" onClick={closeDialog} disabled={loading}>{t('common.close')}</button>
            {!editingId ? (
              <button className="btn-ghost" type="button" onClick={() => submitParty(true)} disabled={loading}>
                {loading ? t('common.loading') : t('parties.saveAndNew')}
              </button>
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
          {/*{pendingServicesLoading ? (*/}
          {/*  <p className="text-xs text-slate-500">{t('common.loading')}</p>*/}
          {/*) : pendingServices.length > 0 ? (*/}
          {/*  <div>*/}
          {/*    <label className="label">Apply to service order <span className="text-slate-400">(optional)</span></label>*/}
          {/*    <select className="input mt-1" name="serviceId" value={txForm.serviceId} onChange={handleTxChange}>*/}
          {/*      <option value="">— none —</option>*/}
          {/*      {pendingServices.map((service) => (*/}
          {/*        <option key={service.id} value={service.id}>*/}
          {/*          {(service.referenceNo || service.id.slice(0, 8))} — {t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(service.dueAmount).toFixed(2) })} due*/}
          {/*        </option>*/}
          {/*      ))}*/}
          {/*    </select>*/}
          {/*  </div>*/}
          {/*) : null}*/}
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

      <ConfirmDialog
        isOpen={Boolean(deleteParty)}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        description={t('parties.confirmDelete')}
        confirming={deleteSubmitting}
      />
    </div>
  );
}
