import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { usePartyStore } from '../stores/parties';
import { Plus, Bell, Search, Filter, ChevronDown } from 'lucide-react';

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
  txDate: new Date().toISOString().slice(0, 10),
  note: '',
  serviceId: '',
});

const computeDue = (total, paid) => Math.max(Number(total || 0) - Number(paid || 0), 0);

export default function Parties() {
  const { t } = useI18n();

  // ── Party store (cached) ──
  const { parties, fetch: fetchParties, upsert: upsertParty, remove: removeParty } = usePartyStore();

  // ── Balance-calculation data (loaded once here, not cached globally since limit:200) ──
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [services, setServices] = useState([]);
  const [manualTx, setManualTx] = useState([]);

  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credit');
  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState(makeEmptyTx());
  const [txStatus, setTxStatus] = useState({ type: 'info', message: '' });
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 10;

  // ── Load parties (cached) + transaction data ──
  useEffect(() => {
    fetchParties();
    Promise.all([
      api.listSales({ limit: 200 }),
      api.listPurchases({ limit: 200 }),
      api.listServices({ limit: 200 }),
      api.listPartyTransactions(),
    ])
      .then(([salesData, purchaseData, serviceData, txData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
        setServices(serviceData || []);
        setManualTx(txData || []);
      })
      .catch(() => null);
  }, []);

  const filteredParties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return parties.filter((party) => {
      if (filterType !== 'all' && party.type !== filterType) return false;
      if (!normalizedQuery) return true;
      return [party.name, party.phone, party.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedQuery));
    });
  }, [parties, filterType, query]);

  useEffect(() => {
    if (!filteredParties.length) { setSelectedId(null); return; }
    if (!selectedId || !filteredParties.find((party) => party.id === selectedId)) {
      setSelectedId(filteredParties[0].id);
    }
  }, [filteredParties, selectedId]);

  useEffect(() => { setTxPage(1); }, [selectedId]);

  const balanceByParty = useMemo(() => {
    // Convention: negative = party owes us (we will receive)
    //             positive = we owe party (they have credit / purchase due)
    const map = new Map();
    parties.forEach((party) => {
      const opening = Number(party.openingBalance || 0);
      // balanceType 'receive' = they owe us → negative
      // balanceType 'give'    = we owe them  → positive
      const signed = party.balanceType === 'give' ? Math.abs(opening) : -Math.abs(opening);
      map.set(party.id, signed);
    });
    sales.forEach((sale) => {
      const id = sale.partyId || sale.customerId || sale.Customer?.id;
      if (!id) return;
      const total = Number(sale.grandTotal || 0);
      const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? total : 0) ?? 0);
      const due = Number(sale.dueAmount ?? computeDue(total, received));
      // Sale due: party owes us → subtract (move toward negative)
      map.set(id, (map.get(id) || 0) - due);
    });
    purchases.forEach((purchase) => {
      const id = purchase.partyId || purchase.supplierId || purchase.Supplier?.id;
      if (!id) return;
      const total = Number(purchase.grandTotal || 0);
      const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? total : 0) ?? 0);
      const due = Number(purchase.dueAmount ?? computeDue(total, paid));
      // Purchase due: we owe them → add (move toward positive)
      map.set(id, (map.get(id) || 0) + due);
    });
    services.forEach((service) => {
      const id = service.partyId;
      if (!id) return;
      const due = Math.max(Number(service.grandTotal || 0) - Number(service.receivedTotal || 0), 0);
      // Service due: party owes us → subtract (move toward negative)
      map.set(id, (map.get(id) || 0) - due);
    });
    manualTx.forEach((tx) => {
      const id = tx.partyId;
      if (!id) return;
      const amount = Number(tx.amount || 0);
      // receive: party pays us → move toward positive (reduces their debt)
      // give: we pay them → move toward negative (reduces our debt)
      const signed = tx.direction === 'give' ? -Math.abs(amount) : Math.abs(amount);
      map.set(id, (map.get(id) || 0) + signed);
    });
    return map;
  }, [sales, purchases, services, parties, manualTx]);


  const totalsummary = useMemo(() => {
    let totalReceive = 0;
    let totalGive = 0;
    balanceByParty.forEach((bal) => {
      // negative = they owe us (we will receive)
      // positive = we owe them (we will give)
      if (bal < 0) totalReceive += Math.abs(bal);
      else if (bal > 0) totalGive += bal;
    });
    return { totalReceive, totalGive };
  }, [balanceByParty]);

  const selectedParty = filteredParties.find((party) => party.id === selectedId) || null;
  const selectedBalance = selectedParty ? balanceByParty.get(selectedParty.id) || 0 : 0;
  // negative = they owe us → "To Receive" (rose)
  // positive = we owe them → "To Give" (blue)
  const balanceLabel = selectedBalance < 0 ? t('parties.toReceive') : selectedBalance > 0 ? t('parties.toGive') : 'Settled';
  const balanceColor = selectedBalance < 0 ? 'text-rose-500' : selectedBalance > 0 ? 'text-blue-600' : 'text-slate-400';

  const partyTransactions = useMemo(() => {
    if (!selectedParty) return [];
    const id = selectedParty.id;
    const salesTx = sales
      .filter((sale) => (sale.partyId || sale.customerId || sale.Customer?.id) === id)
      .map((sale) => ({
        id: sale.id, type: 'sale', date: sale.saleDate, total: Number(sale.grandTotal || 0),
        status: sale.status || 'paid', balance: Number(sale.dueAmount ?? 0), remarks: sale.notes || '-',
        label: `${t('parties.salesInvoice')} ${sale.invoiceNo || sale.id.slice(0, 6)}`,
      }));
    const purchaseTx = purchases
      .filter((purchase) => (purchase.partyId || purchase.supplierId || purchase.Supplier?.id) === id)
      .map((purchase) => ({
        id: purchase.id, type: 'purchase', date: purchase.purchaseDate, total: Number(purchase.grandTotal || 0),
        status: purchase.status || 'received', balance: Number(purchase.dueAmount ?? 0), remarks: purchase.notes || '-',
        label: `${t('parties.purchaseBill')} ${purchase.invoiceNo || purchase.id.slice(0, 6)}`,
      }));
    const serviceTx = services
      .filter((service) => service.partyId === id)
      .map((service) => {
        const due = Math.max(Number(service.grandTotal || 0) - Number(service.receivedTotal || 0), 0);
        return {
          id: service.id, type: 'service', date: service.deliveryDate || service.createdAt,
          total: Number(service.grandTotal || 0), status: due > 0 ? 'unpaid' : 'paid', balance: due,
          remarks: service.notes || '-',
          label: `${t('parties.serviceOrder')} ${service.orderNo || service.id.slice(0, 6)}`,
        };
      });
    const adjustments = manualTx
      .filter((tx) => tx.partyId === id)
      .map((tx) => ({
        id: tx.id, type: 'adjustment', date: tx.txDate, total: Number(tx.amount || 0),
        status: tx.direction, balance: 0, remarks: tx.note || '-',
        label: tx.direction === 'give' ? t('parties.giveAdjustment') : t('parties.receiveAdjustment'),
      }));
    return [...salesTx, ...purchaseTx, ...serviceTx, ...adjustments]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [selectedParty, sales, purchases, services, manualTx, t]);

  const pagedTransactions = useMemo(() => {
    const start = (txPage - 1) * TX_PAGE_SIZE;
    return partyTransactions.slice(start, start + TX_PAGE_SIZE);
  }, [partyTransactions, txPage]);

  const totalTxPages = Math.ceil(partyTransactions.length / TX_PAGE_SIZE);

  // Pending service orders for the selected party (unpaid, linkable in payment form)
  const pendingServices = useMemo(() => {
    if (!selectedParty) return [];
    return services.filter((svc) => {
      if (svc.partyId !== selectedParty.id) return false;
      const due = Number(svc.grandTotal || 0) - Number(svc.receivedTotal || 0);
      return due > 0;
    });
  }, [services, selectedParty]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setActiveTab('credit'); setIsOpen(true); };

  const openEdit = (party) => {
    setEditingId(party.id);
    setForm({ name: party.name || '', phone: party.phone || '', email: party.email || '', address: party.address || '', type: party.type || 'customer', openingBalance: party.openingBalance || '', asOfDate: party.asOfDate || '', balanceType: party.balanceType || 'receive' });
    setActiveTab('credit');
    setIsOpen(true);
  };

  const closeDialog = () => { setIsOpen(false); setEditingId(null); setForm(emptyForm); };

  const openTxDialog = () => {
    if (!selectedParty) return;
    setTxForm({ ...makeEmptyTx(), partyId: selectedParty.id });
    setTxStatus({ type: 'info', message: '' });
    setTxOpen(true);
  };

  const closeTxDialog = () => { setTxOpen(false); setTxStatus({ type: 'info', message: '' }); setTxForm(makeEmptyTx()); };

  const handleTxChange = (event) => {
    const { name, value } = event.target;
    setTxForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('parties.confirmDelete'))) return;
    try {
      await api.deleteParty(id);
      removeParty(id);
      setStatus({ type: 'success', message: t('parties.messages.deleted') });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const submitParty = async (keepOpen = false) => {
    setLoading(true);
    setStatus({ type: 'info', message: '' });
    try {
      if (editingId) {
        const updated = await api.updateParty(editingId, form);
        upsertParty(updated || { ...form, id: editingId });
        setStatus({ type: 'success', message: t('parties.messages.updated') });
      } else {
        const created = await api.createParty(form);
        upsertParty(created);
        setStatus({ type: 'success', message: t('parties.messages.created') });
      }
      if (keepOpen) { setForm(emptyForm); } else { closeDialog(); }
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
      const amount = Number(txForm.amount || 0);
      const payload = { partyId: txForm.partyId, direction: txForm.direction, amount, txDate: txForm.txDate, note: txForm.note };
      const created = await api.createPartyTransaction(payload);
      setManualTx((prev) => [created, ...prev]);

      // If a service is linked, apply the payment to its receivedTotal
      if (txForm.serviceId) {
        const svc = services.find((s) => s.id === txForm.serviceId);
        if (svc) {
          const newReceived = Math.min(Number(svc.grandTotal || 0), Number(svc.receivedTotal || 0) + amount);
          const updated = await api.updateService(txForm.serviceId, { receivedTotal: newReceived });
          setServices((prev) => prev.map((s) => s.id === txForm.serviceId ? { ...s, ...(updated || { receivedTotal: newReceived }) } : s));
        }
      }

      setTxStatus({ type: 'success', message: t('parties.messages.transactionSaved') });
      closeTxDialog();
    } catch (err) {
      setTxStatus({ type: 'error', message: err.message });
    } finally {
      setTxLoading(false);
    }
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

      {/* ── Summary Bar ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-5 py-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
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
              {t('parties.listTitle', { count: filteredParties.length })}
            </h3>
            <button className="btn-ghost" type="button" onClick={openCreate}>
              <ChevronDown size={16} /> {t('parties.addParty')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950">
              <Search size={16} className="text-slate-400" />
              <input className="w-full bg-transparent outline-none" placeholder={t('parties.searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <button className="btn-ghost" type="button"><Filter size={16} /></button>
          </div>

          <div className="flex flex-wrap gap-2">
            {['customer', 'supplier', 'all'].map((type) => (
              <button key={type} type="button" onClick={() => setFilterType(type)}
                className={filterType === type ? 'rounded-xl bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700' : 'rounded-xl bg-slate-100 px-3 py-1 text-sm text-slate-600'}
              >
                {t(`parties.types.${type}`)}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredParties.length === 0 ? (
              <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
            ) : (
              filteredParties.map((party) => {
                const balance = balanceByParty.get(party.id) || 0;
                const isReceive = balance >= 0;
                return (
                  <button key={party.id} type="button" onClick={() => setSelectedId(party.id)}
                    className={selectedId === party.id ? 'w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left' : 'w-full rounded-2xl border border-slate-200 bg-white p-3 text-left'}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white">
                        {party.name?.slice(0, 2).toUpperCase() || 'P'}
                      </div>
                      <div className="flex-1">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                          {party.name}
                          {party.currentAmount < 0 && (
                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">Due</span>
                          )}
                          {party.currentAmount > 0 && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">Credit</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{party.phone || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className={balance < 0 ? 'font-semibold text-rose-500' : balance > 0 ? 'font-semibold text-blue-600' : 'font-semibold text-slate-400'}>
                          {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(party?.currentAmount).toFixed(2) })}
                        </p>
                        <p className="text-xs text-slate-500">
                          {balance < 0 ? t('parties.toReceive') : balance > 0 ? t('parties.toGive') : 'Settled'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="card space-y-4">
          {selectedParty ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-lg font-semibold text-emerald-700">
                    {selectedParty.name?.slice(0, 1).toUpperCase() || 'P'}
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-slate-900">{selectedParty.name}</p>
                    <p className="text-sm text-slate-500">{selectedParty.phone || '-'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase text-slate-400">{balanceLabel}</p>
                  <p className={`text-2xl font-semibold ${balanceColor}`}>
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(selectedBalance).toFixed(2) })}
                  </p>
                  {selectedBalance > 0 && (
                    <p className="mt-0.5 text-xs text-blue-500">Party has advance credit</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(selectedParty)}>{t('parties.manageParty')}</button>
                  <button className="btn-ghost" type="button">{t('parties.statement')}</button>
                </div>
                <button className="btn-secondary" type="button"><Bell size={16} /> {t('parties.sendReminder')}</button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <h4 className="text-lg font-semibold text-slate-900">{t('parties.transactions', { count: partyTransactions.length })}</h4>
                <button className="btn-primary" type="button" onClick={openTxDialog}><Plus size={16} /> {t('parties.addTransaction')}</button>
              </div>

              <div className="space-y-2">
                {partyTransactions.length === 0 ? (
                  <p className="py-3 text-sm text-slate-500">{t('parties.noTransactions')}</p>
                ) : (
                  pagedTransactions.map((tx) => {
                    const typeColors = {
                      sale: 'bg-emerald-100 text-emerald-700',
                      purchase: 'bg-amber-100 text-amber-700',
                      service: 'bg-blue-100 text-blue-700',
                      adjustment: 'bg-slate-100 text-slate-600',
                    };
                    // A transaction-level due is "covered" when the party's net balance
                    // is positive (we owe them / they have overpaid), meaning their
                    // individual outstanding dues are absorbed by that credit.
                    const coveredByCredit = tx.balance > 0 && selectedBalance > 0;
                    return (
                      <div key={tx.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${typeColors[tx.type] || typeColors.adjustment}`}>
                              {tx.type}
                            </span>
                            <span className="truncate text-sm font-medium text-slate-800">{tx.label}</span>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.total.toFixed(2) })}
                            </p>
                            {tx.balance > 0 && !coveredByCredit && (
                              <p className="text-xs font-medium text-rose-500">
                                {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.balance.toFixed(2) })} due
                              </p>
                            )}
                            {coveredByCredit && (
                              <p className="text-xs font-medium text-blue-500">covered by credit</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-xs text-slate-400">{tx.date || '-'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            coveredByCredit
                              ? 'bg-blue-50 text-blue-600'
                              : tx.balance > 0
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {coveredByCredit ? 'covered' : tx.balance > 0 ? t('parties.unpaid') : t('parties.paid')}
                          </span>
                          {tx.remarks && tx.remarks !== '-' && (
                            <span className="text-xs text-slate-400 italic">{tx.remarks}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalTxPages > 1 && (
                <div className="flex items-center justify-between pt-2 text-sm text-slate-500">
                  <span>{partyTransactions.length} transactions · page {txPage} of {totalTxPages}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={txPage === 1}
                      onClick={() => setTxPage((p) => p - 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={txPage === totalTxPages}
                      onClick={() => setTxPage((p) => p + 1)}
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
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('parties.partyName')}</label>
              <input className="input mt-1" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">{t('parties.phone')}</label>
              <input className="input mt-1" name="phone" value={form.phone} onChange={handleChange} />
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
                { value: 'give', label: t('parties.paymentIn') },
                { value: 'receive', label: t('parties.paymentOut') },
              ].map((opt) => (
                <button key={opt.value} type="button" onClick={() => setTxForm((prev) => ({ ...prev, direction: opt.value }))}
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
          {pendingServices.length > 0 && (
            <div>
              <label className="label">Apply to service order <span className="text-slate-400">(optional)</span></label>
              <select className="input mt-1" name="serviceId" value={txForm.serviceId} onChange={handleTxChange}>
                <option value="">— none —</option>
                {pendingServices.map((svc) => {
                  const due = Number(svc.grandTotal || 0) - Number(svc.receivedTotal || 0);
                  return (
                    <option key={svc.id} value={svc.id}>
                      {svc.orderNo || svc.id.slice(0, 8)} — Rs {due.toFixed(2)} due
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <div>
            <label className="label">{t('parties.transactionNote')}</label>
            <input className="input mt-1" name="note" value={txForm.note} onChange={handleTxChange} />
          </div>
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
