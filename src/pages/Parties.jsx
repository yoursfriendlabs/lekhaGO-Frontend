import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
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

const computeDue = (total, paid) => Math.max(Number(total || 0) - Number(paid || 0), 0);

export default function Parties() {
  const { t } = useI18n();
  const [parties, setParties] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('credit');

  const loadParties = async () => {
    try {
      const params = filterType !== 'all' ? { type: filterType } : {};
      const data = await api.listParties(params);
      setParties(data || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadParties();
  }, [filterType]);

  useEffect(() => {
    Promise.all([api.listSales({ limit: 200 }), api.listPurchases({ limit: 200 })])
      .then(([salesData, purchaseData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
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
    if (!filteredParties.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredParties.find((party) => party.id === selectedId)) {
      setSelectedId(filteredParties[0].id);
    }
  }, [filteredParties, selectedId]);

  const balanceByParty = useMemo(() => {
    const map = new Map();
    sales.forEach((sale) => {
      const id = sale.customerId || sale.Customer?.id;
      if (!id) return;
      const total = Number(sale.grandTotal || 0);
      const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? total : 0) ?? 0);
      const due = Number(sale.dueAmount ?? computeDue(total, received));
      map.set(id, (map.get(id) || 0) + due);
    });
    purchases.forEach((purchase) => {
      const id = purchase.supplierId || purchase.Supplier?.id;
      if (!id) return;
      const total = Number(purchase.grandTotal || 0);
      const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? total : 0) ?? 0);
      const due = Number(purchase.dueAmount ?? computeDue(total, paid));
      map.set(id, (map.get(id) || 0) - due);
    });
    return map;
  }, [sales, purchases]);

  const selectedParty = filteredParties.find((party) => party.id === selectedId) || null;
  const selectedBalance = selectedParty ? balanceByParty.get(selectedParty.id) || 0 : 0;
  const balanceLabel = selectedBalance >= 0 ? t('parties.toReceive') : t('parties.toGive');

  const partyTransactions = useMemo(() => {
    if (!selectedParty) return [];
    const id = selectedParty.id;
    const salesTx = sales
      .filter((sale) => (sale.customerId || sale.Customer?.id) === id)
      .map((sale) => ({
        id: sale.id,
        type: 'sale',
        date: sale.saleDate,
        total: Number(sale.grandTotal || 0),
        status: sale.status || 'paid',
        balance: Number(sale.dueAmount ?? 0),
        remarks: sale.notes || '-',
        label: `${t('parties.salesInvoice')} ${sale.invoiceNo || sale.id.slice(0, 6)}`,
      }));
    const purchaseTx = purchases
      .filter((purchase) => (purchase.supplierId || purchase.Supplier?.id) === id)
      .map((purchase) => ({
        id: purchase.id,
        type: 'purchase',
        date: purchase.purchaseDate,
        total: Number(purchase.grandTotal || 0),
        status: purchase.status || 'received',
        balance: Number(purchase.dueAmount ?? 0),
        remarks: purchase.notes || '-',
        label: `${t('parties.purchaseBill')} ${purchase.invoiceNo || purchase.id.slice(0, 6)}`,
      }));
    return [...salesTx, ...purchaseTx].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [selectedParty, sales, purchases, t]);

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

  const handleDelete = async (id) => {
    if (!window.confirm(t('parties.confirmDelete'))) return;
    try {
      await api.deleteParty(id);
      await loadParties();
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
        await api.updateParty(editingId, form);
        setStatus({ type: 'success', message: t('parties.messages.updated') });
      } else {
        await api.createParty(form);
        setStatus({ type: 'success', message: t('parties.messages.created') });
      }
      await loadParties();
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

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
              {t('parties.listTitle', { count: filteredParties.length })}
            </h3>
            <button className="btn-ghost" type="button">
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
            {filteredParties.length === 0 ? (
              <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
            ) : (
              filteredParties.map((party) => {
                const balance = balanceByParty.get(party.id) || 0;
                const isReceive = balance >= 0;
                return (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => setSelectedId(party.id)}
                    className={
                      selectedId === party.id
                        ? 'w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-left'
                        : 'w-full rounded-2xl border border-slate-200 bg-white p-3 text-left'
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-white">
                        {party.name?.slice(0, 2).toUpperCase() || 'P'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{party.name}</p>
                        <p className="text-xs text-slate-500">{party.phone || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className={isReceive ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>
                          {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(balance).toFixed(2) })}
                        </p>
                        <p className="text-xs text-slate-500">{isReceive ? t('parties.toReceive') : t('parties.toGive')}</p>
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
                  <p className={`text-2xl font-semibold ${selectedBalance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(selectedBalance).toFixed(2) })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(selectedParty)}>
                    {t('parties.manageParty')}
                  </button>
                  <button className="btn-ghost" type="button">
                    {t('parties.statement')}
                  </button>
                </div>
                <button className="btn-secondary" type="button">
                  <Bell size={16} /> {t('parties.sendReminder')}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <h4 className="text-lg font-semibold text-slate-900">{t('parties.transactions', { count: partyTransactions.length })}</h4>
                <button className="btn-primary" type="button">
                  <Plus size={16} /> {t('parties.addTransaction')}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-600">
                  <thead className="text-xs uppercase text-slate-400">
                    <tr>
                      <th className="py-2 text-left">{t('parties.txType')}</th>
                      <th className="py-2 text-left">{t('common.date')}</th>
                      <th className="py-2 text-right">{t('common.total')}</th>
                      <th className="py-2 text-left">{t('common.status')}</th>
                      <th className="py-2 text-right">{t('parties.balance')}</th>
                      <th className="py-2 text-left">{t('common.notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partyTransactions.length === 0 ? (
                      <tr><td colSpan={6} className="py-3 text-slate-500">{t('parties.noTransactions')}</td></tr>
                    ) : (
                      partyTransactions.map((tx) => (
                        <tr key={tx.id} className="border-t border-slate-200/70">
                          <td className="py-2">{tx.label}</td>
                          <td className="py-2">{tx.date || '-'}</td>
                          <td className="py-2 text-right">
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.total.toFixed(2) })}
                          </td>
                          <td className="py-2">
                            <span className={tx.balance > 0 ? 'rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-600' : 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600'}>
                              {tx.balance > 0 ? t('parties.unpaid') : t('parties.paid')}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.balance.toFixed(2) })}
                          </td>
                          <td className="py-2">{tx.remarks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type }))}
                  className={form.type === type ? 'btn-primary' : 'btn-ghost'}
                >
                  {t(`parties.types.${type}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-slate-200 pb-2 text-sm text-slate-500">
            <button
              type="button"
              onClick={() => setActiveTab('credit')}
              className={activeTab === 'credit' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}
            >
              {t('parties.creditInfo')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('additional')}
              className={activeTab === 'additional' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}
            >
              {t('parties.additionalInfo')}
            </button>
          </div>

          {activeTab === 'credit' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('parties.openingBalance')}</label>
                <input
                  className="input mt-1"
                  name="openingBalance"
                  type="number"
                  step="0.01"
                  value={form.openingBalance}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">{t('parties.asOfDate')}</label>
                <input className="input mt-1" name="asOfDate" type="date" value={form.asOfDate} onChange={handleChange} />
              </div>
              <div className="flex gap-2">
                {['receive', 'give'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, balanceType: type }))}
                    className={form.balanceType === type ? 'btn-primary' : 'btn-ghost'}
                  >
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
            <button className="btn-secondary" type="button" onClick={closeDialog}>
              {t('common.close')}
            </button>
            {!editingId ? (
              <button
                className="btn-ghost"
                type="button"
                onClick={() => submitParty(true)}
                disabled={loading}
              >
                {t('parties.saveAndNew')}
              </button>
            ) : null}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? t('common.loading') : editingId ? t('common.update') : t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
