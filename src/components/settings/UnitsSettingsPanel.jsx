import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Notice from '../Notice';
import Pagination from '../Pagination';
import { Dialog } from '../ui/Dialog.tsx';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const emptyForm = {
  name: '',
  symbol: '',
};

function normalizeUnitForm(unit = {}) {
  return {
    name: unit.name || '',
    symbol: unit.symbol || '',
  };
}

function resolveUnitErrorMessage(error, t, mode = 'save') {
  if (error?.status === 409) return t('unitsManagement.messages.exists');
  if (mode === 'delete' && error?.status === 400) return t('unitsManagement.messages.inUse');
  return error?.message || 'Request failed';
}

export default function UnitsSettingsPanel() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [units, setUnits] = useState([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const params = useMemo(
    () => ({
      ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [debouncedQuery, page, pageSize],
  );

  const loadUnits = async () => {
    setListLoading(true);

    try {
      const response = await api.listUnits(params);
      setUnits(response.items || []);
      setTotal(Number(response.total || 0));
      setListError('');
    } catch (error) {
      setUnits([]);
      setTotal(0);
      setListError(error.message);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    loadUnits();
  }, [debouncedQuery, page, pageSize]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
    setDialogOpen(true);
  };

  const openEdit = async (unit) => {
    setEditingId(unit.id);
    setDialogOpen(true);
    setLoadingDetail(true);
    setStatus({ type: 'info', message: '' });

    try {
      const detail = await api.getUnit(unit.id);
      setForm(normalizeUnitForm(detail));
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      setForm(normalizeUnitForm(unit));
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setLoadingDetail(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setStatus({ type: 'error', message: t('unitsManagement.validation.nameRequired') });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = {
        name,
        symbol: form.symbol.trim(),
      };

      if (editingId) {
        await api.updateUnit(editingId, payload);
      } else {
        await api.createUnit(payload);
      }

      await loadUnits();
      setStatus({
        type: 'success',
        message: editingId ? t('unitsManagement.messages.updated') : t('unitsManagement.messages.created'),
      });
      closeDialog();
    } catch (error) {
      setStatus({ type: 'error', message: resolveUnitErrorMessage(error, t) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (unit) => {
    if (!window.confirm(t('unitsManagement.deleteConfirm', { name: unit.name }))) {
      return;
    }

    try {
      await api.deleteUnit(unit.id);
      await loadUnits();
      setStatus({ type: 'success', message: t('unitsManagement.messages.deleted') });
    } catch (error) {
      setStatus({ type: 'error', message: resolveUnitErrorMessage(error, t, 'delete') });
    }
  };

  return (
    <section className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('unitsManagement.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('unitsManagement.subtitle')}</p>
          </div>
          <button className="btn-primary w-full md:w-auto" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('unitsManagement.addUnit')}
          </button>
        </div>

        {status.message ? <Notice title={status.message} tone={status.type} /> : null}
        {listError ? <Notice title={listError} tone="error" /> : null}

        <div>
          <label className="label">{t('common.search')}</label>
          <input
            className="input mt-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('unitsManagement.searchPlaceholder')}
          />
        </div>

        <div className="space-y-3 md:hidden">
          {listLoading && units.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : units.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('unitsManagement.noUnits')}</p>
          ) : (
            units.map((unit) => (
              <div
                key={unit.id}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{unit.name}</p>
                  <p className="text-xs text-slate-500">{unit.symbol || '—'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(unit)}>
                    <Pencil size={14} className="mr-1 inline" />
                    {t('common.edit')}
                  </button>
                  <button className="btn-ghost" type="button" onClick={() => handleDelete(unit)}>
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
                <th className="py-2 text-left">{t('unitsManagement.name')}</th>
                <th className="py-2 text-left">{t('unitsManagement.symbol')}</th>
                <th className="py-2 text-right">{t('products.action')}</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && units.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('common.loading')}</td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('unitsManagement.noUnits')}</td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{unit.name}</td>
                    <td className="py-3">{unit.symbol || '—'}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost" type="button" onClick={() => openEdit(unit)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost" type="button" onClick={() => handleDelete(unit)}>
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

      <Dialog
        isOpen={dialogOpen}
        onClose={closeDialog}
        title={editingId ? t('unitsManagement.editUnit') : t('unitsManagement.addUnit')}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {status.message && dialogOpen ? <Notice title={status.message} tone={status.type} /> : null}

          <div className="space-y-1">
            <label className="label" htmlFor="unit-name">{t('unitsManagement.name')}</label>
            <input
              id="unit-name"
              className="input"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder={t('unitsManagement.name')}
              disabled={loadingDetail}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label className="label" htmlFor="unit-symbol">{t('unitsManagement.symbol')}</label>
            <input
              id="unit-symbol"
              className="input"
              name="symbol"
              value={form.symbol}
              onChange={handleChange}
              placeholder={t('unitsManagement.symbolPlaceholder')}
              disabled={loadingDetail}
            />
          </div>

          <div className="mobile-sticky-actions flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>
              {t('common.close')}
            </button>
            <button className="btn-primary w-full sm:w-auto" type="submit" disabled={submitting || loadingDetail}>
              {submitting ? t('common.loading') : editingId ? t('common.update') : t('common.save')}
            </button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}
