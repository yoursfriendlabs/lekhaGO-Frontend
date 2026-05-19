import { useEffect, useMemo, useState } from 'react';
import { Landmark, Pencil, Plus, Power, Trash2, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import { Dialog } from '../components/ui/Dialog.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { useBankStore } from '../stores/banks';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const emptyForm = {
  name: '',
  accountName: '',
  accountNumber: '',
  branchName: '',
  openingBalance: '0',
  currentBalance: '0',
  isActive: true,
  notes: '',
};

function normalizeBankForm(bank = {}) {
  return {
    name: bank.name || '',
    accountName: bank.accountName || '',
    accountNumber: bank.accountNumber || '',
    branchName: bank.branchName || '',
    openingBalance: String(bank.openingBalance ?? '0'),
    currentBalance: String(bank.currentBalance ?? bank.openingBalance ?? '0'),
    isActive: bank.isActive !== false,
    notes: bank.notes || '',
  };
}

export default function Banks() {
  const { t } = useI18n();
  const { canManageFeature } = useAuth();
  const canManageBanks = canManageFeature('banks');
  const {
    banks,
    total,
    loading: listLoading,
    fetch: fetchBanks,
    invalidate: invalidateBanks,
  } = useBankStore();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [listError, setListError] = useState('');
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteBank, setDeleteBank] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');

  const params = useMemo(() => ({
    ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
    ...(statusFilter === 'active' ? { isActive: true } : {}),
    ...(statusFilter === 'inactive' ? { isActive: false } : {}),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  }), [debouncedQuery, page, pageSize, statusFilter]);

  const formatMoney = (value) =>
    t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: Number(value || 0).toFixed(2),
    });

  const reloadBanks = async () => {
    invalidateBanks(params);

    try {
      await fetchBanks(params, true);
      setListError('');
    } catch (error) {
      setListError(error.message);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    fetchBanks(params).then(() => {
      setListError('');
    }).catch((error) => {
      setListError(error.message);
    });
  }, [fetchBanks, params]);

  useEffect(() => {
    if (!banks.length) {
      setSelectedBankId('');
      return;
    }

    if (banks.some((bank) => bank.id === selectedBankId)) return;
    setSelectedBankId(banks[0].id || '');
  }, [banks, selectedBankId]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openCreate = () => {
    if (!canManageBanks) return;
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
    setDialogOpen(true);
  };

  const openEdit = async (bank) => {
    if (!canManageBanks) return;
    setEditingId(bank.id);
    setDialogOpen(true);
    setLoadingDetail(true);
    setStatus({ type: 'info', message: '' });

    try {
      const full = await api.getBank(bank.id);
      setForm(normalizeBankForm(full));
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      setForm(normalizeBankForm(bank));
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (!canManageBanks) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }

    if (!form.name.trim()) {
      setStatus({ type: 'error', message: t('banks.validation.nameRequired') });
      return;
    }

    const payload = {
      name: form.name.trim(),
      accountName: form.accountName.trim(),
      accountNumber: form.accountNumber.trim(),
      branchName: form.branchName.trim(),
      openingBalance: Number(form.openingBalance || 0),
      currentBalance: Number(editingId ? form.currentBalance : form.openingBalance || 0),
      isActive: Boolean(form.isActive),
      notes: form.notes.trim(),
    };

    setSubmitting(true);
    setStatus({ type: 'info', message: '' });

    try {
      if (editingId) {
        await api.updateBank(editingId, payload);
      } else {
        await api.createBank(payload);
      }

      await reloadBanks();
      setStatus({
        type: 'success',
        message: editingId ? t('banks.messages.updated') : t('banks.messages.created'),
      });
      closeDialog();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteSubmitting) return;
    setDeleteBank(null);
  };

  const handleDelete = async () => {
    if (!canManageBanks) return;
    if (!deleteBank) return;

    setDeleteSubmitting(true);
    try {
      await api.deleteBank(deleteBank.id);
      await reloadBanks();
      setStatus({ type: 'success', message: t('banks.messages.deleted') });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setDeleteSubmitting(false);
      setDeleteBank(null);
    }
  };

  const handleToggleActive = async (bank) => {
    if (!canManageBanks) return;
    try {
      await api.patchBank(bank.id, { isActive: !bank.isActive });
      await reloadBanks();
      setStatus({
        type: 'success',
        message: !bank.isActive ? t('banks.messages.activated') : t('banks.messages.deactivated'),
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const overallBalance = useMemo(
    () => banks.reduce((sum, bank) => sum + Number(bank.currentBalance || 0), 0),
    [banks],
  );
  const activeCount = useMemo(
    () => banks.filter((bank) => bank.isActive).length,
    [banks],
  );
  const selectedBank = banks.find((bank) => bank.id === selectedBankId) || banks[0] || null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('banks.title')}
        subtitle={t('banks.subtitle')}
        action={(
          canManageBanks ? (
            <button className="btn-primary" type="button" onClick={openCreate}>
              <Plus size={16} className="mr-1.5 inline" />
              {t('banks.addBank')}
            </button>
          ) : null
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      {listError ? <Notice title={listError} tone="error" /> : null}

      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
          <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[28px] border border-primary-100 bg-primary-50/80 p-5">
                <p className="text-sm font-medium text-secondary-700">{t('banks.overallBalance')}</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-primary-800">{formatMoney(overallBalance)}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-secondary-700">
                  <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                    {t('banks.accountsCount', { count: total || banks.length })}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
                    {t('banks.activeAccounts', { count: activeCount })}
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-sm">
                      <WalletCards size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('common.selected')}</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedBank?.name || t('banks.unnamed')}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">{selectedBank?.accountNumber || selectedBank?.accountName || '—'}</p>
                  <p className="mt-2 text-xl font-semibold text-primary-700">{formatMoney(selectedBank?.currentBalance)}</p>
                </div>
                {canManageBanks ? (
                  <button
                    className="btn-primary h-14 justify-center rounded-[24px]"
                    type="button"
                    onClick={() => (selectedBank ? openEdit(selectedBank) : openCreate())}
                  >
                    {t('banks.adjustBalance')}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-secondary-200/70 bg-white/90 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('common.filters')}</p>
            <div className="mt-4 grid gap-3">
              <div>
                <label className="label">{t('common.search')}</label>
                <input
                  className="input mt-1 h-12 rounded-[18px]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('banks.searchPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('common.status')}</label>
                <select
                  className="input mt-1 h-12 rounded-[18px]"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">{t('banks.filters.all')}</option>
                  <option value="active">{t('banks.filters.active')}</option>
                  <option value="inactive">{t('banks.filters.inactive')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="hidden items-center justify-between md:flex">
            <div>
              <p className="text-lg font-semibold text-slate-900">{t('banks.allAccounts')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('banks.subtitle')}</p>
            </div>
            {canManageBanks ? (
              <button className="btn-secondary" type="button" onClick={openCreate}>
                <Plus size={16} className="mr-1.5 inline" />
                {t('banks.newAccount')}
              </button>
            ) : null}
          </div>

          <div className="space-y-3 md:hidden">
            {listLoading && banks.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
            ) : banks.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">{t('banks.noBanks')}</p>
            ) : (
              banks.map((bank) => {
                const isSelected = bank.id === selectedBank?.id;

                return (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setSelectedBankId(bank.id)}
                    className={`w-full rounded-[28px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-primary-300 bg-primary-50 shadow-sm'
                        : 'border-slate-200/70 bg-white/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${bank.isActive ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-500'}`}>
                          <Landmark size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-slate-900">{bank.name || t('banks.unnamed')}</p>
                          <p className="mt-1 text-sm text-slate-500">{bank.accountNumber || bank.accountName || '-'}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${bank.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {bank.isActive ? t('banks.filters.active') : t('banks.filters.inactive')}
                      </span>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('banks.currentBalance')}</p>
                        <p className="mt-1 text-2xl font-semibold text-primary-800">{formatMoney(bank.currentBalance)}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{bank.branchName || '—'}</p>
                        <p className="mt-1">{t('banks.openingBalance')}: {formatMoney(bank.openingBalance)}</p>
                      </div>
                    </div>

                    {isSelected && canManageBanks ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button className="btn-ghost" type="button" onClick={(event) => { event.stopPropagation(); openEdit(bank); }}>
                          <Pencil size={14} className="mr-1 inline" />
                          {t('common.edit')}
                        </button>
                        <button className="btn-ghost" type="button" onClick={(event) => { event.stopPropagation(); handleToggleActive(bank); }}>
                          <Power size={14} className="mr-1 inline" />
                          {bank.isActive ? t('banks.deactivate') : t('banks.activate')}
                        </button>
                        <button className="btn-ghost" type="button" onClick={(event) => { event.stopPropagation(); setDeleteBank(bank); }}>
                          <Trash2 size={14} className="mr-1 inline" />
                          {t('common.delete')}
                        </button>
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 text-left">{t('banks.name')}</th>
                  <th className="py-2 text-left">{t('banks.accountNumber')}</th>
                  <th className="py-2 text-left">{t('banks.branchName')}</th>
                  <th className="py-2 text-right">{t('banks.openingBalance')}</th>
                  <th className="py-2 text-right">{t('banks.currentBalance')}</th>
                  <th className="py-2 text-left">{t('common.status')}</th>
                  <th className="py-2 text-right">{t('products.action')}</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && banks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-3 text-slate-500">{t('common.loading')}</td>
                  </tr>
                ) : banks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-3 text-slate-500">{t('banks.noBanks')}</td>
                  </tr>
                ) : (
                  banks.map((bank) => (
                    <tr key={bank.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                      <td className="py-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{bank.name || t('banks.unnamed')}</div>
                        <div className="text-xs text-slate-500">{bank.accountName || '-'}</div>
                      </td>
                      <td className="py-2">{bank.accountNumber || '-'}</td>
                      <td className="py-2">{bank.branchName || '-'}</td>
                      <td className="py-2 text-right">{formatMoney(bank.openingBalance)}</td>
                      <td className="py-2 text-right font-semibold text-slate-900 dark:text-white">{formatMoney(bank.currentBalance)}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${bank.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {bank.isActive ? t('banks.filters.active') : t('banks.filters.inactive')}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {canManageBanks ? (
                          <div className="flex justify-end gap-2">
                            <button className="btn-ghost" type="button" onClick={() => openEdit(bank)}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn-ghost" type="button" onClick={() => handleToggleActive(bank)}>
                              <Power size={14} />
                            </button>
                            <button className="btn-ghost" type="button" onClick={() => setDeleteBank(bank)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">{t('common.view')}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>

        {selectedBank && canManageBanks ? (
          <div className="mobile-sticky-actions md:hidden">
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary w-full justify-center rounded-[22px]" type="button" onClick={openCreate}>
                {t('banks.newAccount')}
              </button>
              <button className="btn-primary w-full justify-center rounded-[22px]" type="button" onClick={() => openEdit(selectedBank)}>
                {t('banks.adjustBalance')}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog isOpen={dialogOpen} onClose={closeDialog} title={editingId ? t('banks.editBank') : t('banks.addBank')} size="md">
        <form className="space-y-4" onSubmit={submitForm}>
          {loadingDetail ? <Notice title={t('common.loading')} tone="info" /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('banks.name')}</label>
              <input className="input mt-1" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">{t('banks.accountName')}</label>
              <input className="input mt-1" name="accountName" value={form.accountName} onChange={handleChange} />
            </div>
            <div>
              <label className="label">{t('banks.accountNumber')}</label>
              <input className="input mt-1" name="accountNumber" value={form.accountNumber} onChange={handleChange} />
            </div>
            <div>
              <label className="label">{t('banks.branchName')}</label>
              <input className="input mt-1" name="branchName" value={form.branchName} onChange={handleChange} />
            </div>
            <div>
              <label className="label">{t('banks.openingBalance')}</label>
              <input className="input mt-1" name="openingBalance" type="number" step="0.01" value={form.openingBalance} onChange={handleChange} />
            </div>
            <div>
              <label className="label">{t('banks.currentBalance')}</label>
              <input className="input mt-1" value={editingId ? form.currentBalance : form.openingBalance} readOnly disabled />
            </div>
          </div>

          <div>
            <label className="label">{t('common.notes')}</label>
            <textarea className="input mt-1 h-24 resize-none" name="notes" value={form.notes}
            maxLength={10000}
             onChange={handleChange} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/40">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-primary-600"
              name="isActive"
              checked={Boolean(form.isActive)}
              onChange={handleChange}
            />
            {t('banks.isActive')}
          </label>

          <div className="flex justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={closeDialog}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="submit" disabled={submitting || loadingDetail}>
              {submitting ? t('common.loading') : editingId ? t('common.update') : t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(deleteBank)}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        description={deleteBank ? t('banks.deleteConfirm', { name: deleteBank.name || t('banks.unnamed') }) : t('common.confirmDelete')}
        confirming={deleteSubmitting}
      />
    </div>
  );
}
