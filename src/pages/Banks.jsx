import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Power, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import { Dialog } from '../components/ui/Dialog.tsx';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api';
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

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
    setDialogOpen(true);
  };

  const openEdit = async (bank) => {
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

  const handleDelete = async (bank) => {
    if (!window.confirm(t('banks.deleteConfirm', { name: bank.name || t('banks.unnamed') }))) return;

    try {
      await api.deleteBank(bank.id);
      await reloadBanks();
      setStatus({ type: 'success', message: t('banks.messages.deleted') });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleToggleActive = async (bank) => {
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('banks.title')}
        subtitle={t('banks.subtitle')}
        action={(
          <button className="btn-primary" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('banks.addBank')}
          </button>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      {listError ? <Notice title={listError} tone="error" /> : null}

      <div className="card space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="label">{t('common.search')}</label>
            <input
              className="input mt-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('banks.searchPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select
              className="input mt-1 min-w-[180px]"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">{t('banks.filters.all')}</option>
              <option value="active">{t('banks.filters.active')}</option>
              <option value="inactive">{t('banks.filters.inactive')}</option>
            </select>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {listLoading && banks.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : banks.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('banks.noBanks')}</p>
          ) : (
            banks.map((bank) => (
              <div key={bank.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{bank.name || t('banks.unnamed')}</p>
                    <p className="text-xs text-slate-500">{bank.accountNumber || bank.accountName || '-'}</p>
                    <p className="mt-2 text-xs text-slate-500">{t('banks.currentBalance')}: {formatMoney(bank.currentBalance)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${bank.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {bank.isActive ? t('banks.filters.active') : t('banks.filters.inactive')}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(bank)}>
                    <Pencil size={14} className="mr-1 inline" />
                    {t('common.edit')}
                  </button>
                  <button className="btn-ghost" type="button" onClick={() => handleToggleActive(bank)}>
                    <Power size={14} className="mr-1 inline" />
                    {bank.isActive ? t('banks.deactivate') : t('banks.activate')}
                  </button>
                  <button className="btn-ghost" type="button" onClick={() => handleDelete(bank)}>
                    <Trash2 size={14} className="mr-1 inline" />
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))
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
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost" type="button" onClick={() => openEdit(bank)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost" type="button" onClick={() => handleToggleActive(bank)}>
                          <Power size={14} />
                        </button>
                        <button className="btn-ghost" type="button" onClick={() => handleDelete(bank)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
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
            <textarea className="input mt-1 h-24 resize-none" name="notes" value={form.notes} onChange={handleChange} />
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
    </div>
  );
}
