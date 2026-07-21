import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Layers } from 'lucide-react';
import ActionMenu from '../ActionMenu.jsx';
import Notice from '../Notice';
import Pagination from '../Pagination';
import { Dialog } from '../ui/Dialog.tsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

const emptyForm = {
  name: '',
};

function normalizeCategoryForm(category = {}) {
  return {
    name: category.name || '',
  };
}

function resolveErrorMessage(error, t, mode = 'save') {
  if (error?.status === 409) return t('categories.messages.exists') || 'Floor category already exists.';
  return error?.message || 'Request failed';
}

export default function TablesFloorsSettingsPanel() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [status, setStatus] = useState({ type: 'info', message: '' });

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteCategory, setDeleteCategory] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const params = useMemo(
    () => ({
      type: 'table',
      ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [debouncedQuery, page, pageSize]
  );

  const loadTables = async () => {
    try {
      const data = await api.getTables({ limit: 100 });
      const items = Array.isArray(data) ? data : data?.items || data?.rows || [];
      setTables(items);
    } catch (error) {
      console.error('Failed to load tables for mapping count', error);
    }
  };

  const loadCategories = async () => {
    setListLoading(true);
    try {
      const response = await api.listCategories(params);
      setCategories(response.items || []);
      setTotal(Number(response.total || 0));
      setListError('');
    } catch (error) {
      setCategories([]);
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
    loadCategories();
    loadTables();
  }, [debouncedQuery, page, pageSize]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
    setDialogOpen(true);
  };

  const openEdit = async (category) => {
    setEditingId(category.id);
    setDialogOpen(true);
    setLoadingDetail(true);
    setStatus({ type: 'info', message: '' });

    try {
      const detail = await api.getCategory(category.id);
      setForm(normalizeCategoryForm(detail));
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      setForm(normalizeCategoryForm(category));
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
    const { value } = event.target;
    setForm({ name: value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    if (!name) {
      setStatus({ type: 'error', message: t('categories.validation.nameRequired') || 'Name is required' });
      return;
    }

    if (name.length > 50) {
      setStatus({ type: 'error', message: 'Floor Name cannot exceed 50 characters.' });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = { name, type: 'table' };

      if (editingId) {
        await api.updateCategory(editingId, payload);
      } else {
        await api.createCategory(payload);
      }

      await loadCategories();
      setStatus({
        type: 'success',
        message: editingId
          ? t('categories.messages.updated') || 'Floor updated successfully.'
          : t('categories.messages.created') || 'Floor created successfully.',
      });
      closeDialog();
    } catch (error) {
      setStatus({ type: 'error', message: resolveErrorMessage(error, t) });
    } finally {
      setSubmitting(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteSubmitting) return;
    setDeleteCategory(null);
  };

  const handleDelete = async () => {
    if (!deleteCategory) return;

    setDeleteSubmitting(true);
    try {
      await api.deleteCategory(deleteCategory.id);
      await loadCategories();
      await loadTables();
      setStatus({ type: 'success', message: t('categories.messages.deleted') || 'Floor deleted successfully.' });
    } catch (error) {
      setStatus({ type: 'error', message: resolveErrorMessage(error, t, 'delete') });
    } finally {
      setDeleteSubmitting(false);
      setDeleteCategory(null);
    }
  };

  const getTableCountForFloor = (floorId) => {
    return tables.filter(
      (t) => String(t.categoryId) === String(floorId) || String(t.category?.id) === String(floorId)
    ).length;
  };

  return (
    <section className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-slate-900 dark:text-white">
              {t('settingsPage.tabs.tablesFloors') || 'Tables & Floors'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('settingsPage.descriptions.tablesFloors') || 'Manage dining floors and seating area categories.'}
            </p>
          </div>
          <button className="btn-primary w-full md:w-auto" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('common.add') || 'Add Floor'}
          </button>
        </div>

        {status.message ? <Notice title={status.message} tone={status.type} /> : null}
        {listError ? <Notice title={listError} tone="error" /> : null}

        <div>
          <label className="label">{t('common.search') || 'Search'}</label>
          <input
            className="input mt-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search floors by name..."
          />
        </div>

        {/* Mobile View */}
        <div className="space-y-3 md:hidden">
          {listLoading && categories.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : categories.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.noData') || 'No Floors found.'}</p>
          ) : (
            categories.map((category) => {
              const tableCount = getTableCountForFloor(category.id);
              return (
                <div
                  key={category.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-white">{category.name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 dark:bg-slate-800/30 dark:border-slate-800">
                        <Layers size={11} className="text-[#9b6835]" />
                        <span>{tableCount} {tableCount === 1 ? 'table' : 'tables'} assigned</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="btn-ghost" type="button" onClick={() => openEdit(category)}>
                      <Pencil size={14} className="mr-1 inline" />
                      {t('common.edit') || 'Edit'}
                    </button>
                    <button className="btn-ghost" type="button" onClick={() => setDeleteCategory(category)}>
                      <Trash2 size={14} className="mr-1 inline text-rose-500" />
                      {t('common.delete') || 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('categories.name') || 'Floor Name'}</th>
                <th className="py-2 text-left">Tables Count</th>
                <th className="py-2 text-right">{t('products.action') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('common.loading')}</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('common.noData') || 'No Floor categories defined.'}</td>
                </tr>
              ) : (
                categories.map((category) => {
                  const tableCount = getTableCountForFloor(category.id);
                  return (
                    <tr key={category.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                      <td className="py-3 font-semibold text-slate-900 dark:text-white">{category.name}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          tableCount > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 border border-slate-200/40 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          <Layers size={12} />
                          {tableCount} {tableCount === 1 ? 'Table' : 'Tables'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <ActionMenu
                          actions={[
                            { label: t('common.edit') || 'Edit', icon: Pencil, onClick: () => openEdit(category) },
                            {
                              label: t('common.delete') || 'Delete',
                              icon: Trash2,
                              tone: 'danger',
                              onClick: () => setDeleteCategory(category),
                            },
                          ]}
                          label={t('products.action') || 'Actions'}
                        />
                      </td>
                    </tr>
                  );
                })
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

      {/* Add / Edit Dialog */}
      <Dialog
        isOpen={dialogOpen}
        onClose={closeDialog}
        title={editingId ? 'Edit Floor' : 'Add Floor'}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {loadingDetail ? <Notice title={t('common.loading')} tone="info" /> : null}

          <div>
            <label className="label">Floor Name</label>
            <input
              className="input mt-1"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Ground Floor, Rooftop, VIP Room"
              required
              maxLength={50}
            />
          </div>

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
        isOpen={Boolean(deleteCategory)}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        description={
          deleteCategory
            ? `Are you sure you want to delete the floor "${deleteCategory.name}"? Tables assigned to this floor will be unassigned.`
            : t('common.confirmDelete')
        }
        confirming={deleteSubmitting}
      />
    </section>
  );
}
