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
};

function normalizeCategoryForm(category = {}) {
  return {
    name: category.name || '',
  };
}

function resolveCategoryErrorMessage(error, t, mode = 'save') {
  if (error?.status === 409) return t('categories.messages.exists');
  if (mode === 'delete' && error?.status === 400) return t('categories.messages.inUse');
  return error?.message || 'Request failed';
}

export default function CategoriesSettingsPanel() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [categories, setCategories] = useState([]);
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
      type: 'product',
      ...(debouncedQuery.trim() ? { search: debouncedQuery.trim() } : {}),
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [debouncedQuery, page, pageSize]
  );

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
      setStatus({ type: 'error', message: t('categories.validation.nameRequired') });
      return;
    }

    setSubmitting(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = { name, type: 'product' };

      if (editingId) {
        await api.updateCategory(editingId, payload);
      } else {
        await api.createCategory(payload);
      }

      await loadCategories();
      setStatus({
        type: 'success',
        message: editingId ? t('categories.messages.updated') : t('categories.messages.created'),
      });
      closeDialog();
    } catch (error) {
      setStatus({ type: 'error', message: resolveCategoryErrorMessage(error, t) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (category) => {
    if (!window.confirm(t('categories.deleteConfirm', { name: category.name }))) {
      return;
    }

    try {
      await api.deleteCategory(category.id);
      await loadCategories();
      setStatus({ type: 'success', message: t('categories.messages.deleted') });
    } catch (error) {
      setStatus({ type: 'error', message: resolveCategoryErrorMessage(error, t, 'delete') });
    }
  };

  return (
    <section className="space-y-4">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('categories.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('categories.subtitle')}</p>
          </div>
          <button className="btn-primary w-full md:w-auto" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('categories.addCategory')}
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
            placeholder={t('categories.searchPlaceholder')}
          />
        </div>

        <div className="space-y-3 md:hidden">
          {listLoading && categories.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : categories.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('categories.noCategories')}</p>
          ) : (
            categories.map((category) => (
              <div
                key={category.id}
                className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60"
              >
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{category.name}</p>
                  <p className="text-xs text-slate-500">{category.type || 'product'}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-ghost" type="button" onClick={() => openEdit(category)}>
                    <Pencil size={14} className="mr-1 inline" />
                    {t('common.edit')}
                  </button>
                  <button className="btn-ghost" type="button" onClick={() => handleDelete(category)}>
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
                <th className="py-2 text-left">{t('categories.name')}</th>
                <th className="py-2 text-left">{t('inventory.itemType')}</th>
                <th className="py-2 text-right">{t('products.action')}</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('common.loading')}</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 text-slate-500">{t('categories.noCategories')}</td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{category.name}</td>
                    <td className="py-3 capitalize">{category.type || 'product'}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost" type="button" onClick={() => openEdit(category)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-ghost" type="button" onClick={() => handleDelete(category)}>
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
        title={editingId ? t('categories.editCategory') : t('categories.addCategory')}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {loadingDetail ? <Notice title={t('common.loading')} tone="info" /> : null}

          <div>
            <label className="label">{t('categories.name')}</label>
            <input
              className="input mt-1"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
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
    </section>
  );
}
