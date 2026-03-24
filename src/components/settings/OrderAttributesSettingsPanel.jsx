import { useEffect, useMemo, useState } from 'react';
import Notice from '../Notice';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n.jsx';

const emptyForm = {
  name: '',
  key: '',
  type: 'text',
  entityType: 'all',
};

function sanitizeAttributeKey(value = '') {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function getAttributeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

export default function OrderAttributesSettingsPanel() {
  const { t } = useI18n();
  const [attributes, setAttributes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const derivedKey = useMemo(() => sanitizeAttributeKey(form.name), [form.name]);

  const loadAttributes = async () => {
    setLoadingList(true);

    try {
      const data = await api.listOrderAttributes();
      setAttributes(getAttributeItems(data));
      setStatus((previous) => (previous.type === 'error' ? { type: 'info', message: '' } : previous));
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  useEffect(() => {
    if (editingId) return;

    setForm((previous) => {
      const nextKey = sanitizeAttributeKey(previous.name);
      if (previous.key === nextKey) return previous;
      return { ...previous, key: nextKey };
    });
  }, [editingId, form.name]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: name === 'key' ? sanitizeAttributeKey(value) : value,
    }));
  };

  const handleEdit = (attribute) => {
    setEditingId(attribute.id);
    setForm({
      name: attribute.name || '',
      key: attribute.key || '',
      type: attribute.type || 'text',
      entityType: attribute.entityType || 'all',
    });
    setStatus({ type: 'info', message: '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm(emptyForm);
    setStatus({ type: 'info', message: '' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete') || 'Are you sure?')) return;

    try {
      await api.deleteOrderAttribute(id);
      await loadAttributes();
      setStatus({ type: 'success', message: t('orderAttributes.messages.deleted') });
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      name: form.name.trim(),
      key: editingId ? form.key : sanitizeAttributeKey(form.name),
    };

    setSubmitting(true);
    setStatus({ type: 'info', message: '' });

    try {
      if (editingId) {
        await api.updateOrderAttribute(editingId, payload);
        setStatus({ type: 'success', message: t('orderAttributes.messages.updated') });
      } else {
        await api.createOrderAttribute(payload);
        setStatus({ type: 'success', message: t('orderAttributes.messages.created') });
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadAttributes();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-6 xl:grid-cols-[minmax(300px,360px)_1fr]">
        <div className="card space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="space-y-1">
            <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('orderAttributes.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('orderAttributes.subtitle')}</p>
          </div>

          {status.message ? <Notice title={status.message} tone={status.type} /> : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('orderAttributes.name')}</label>
              <input
                required
                name="name"
                className="input mt-1"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Chest Size"
              />
            </div>

            <div className="rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                {t('orderAttributes.key')}
              </p>
              <p className="mt-1 font-mono text-sm text-slate-700 dark:text-slate-200">
                {editingId ? form.key || 'attribute_key' : derivedKey || 'attribute_key'}
              </p>
            </div>

            <div>
              <label className="label">{t('orderAttributes.type')}</label>
              <select
                name="type"
                className="input mt-1"
                value={form.type}
                onChange={handleChange}
              >
                <option value="text">{t('orderAttributes.types.text')}</option>
                <option value="number">{t('orderAttributes.types.number')}</option>
                <option value="date">{t('orderAttributes.types.date')}</option>
              </select>
            </div>

            <div>
              <label className="label">{t('orderAttributes.entityType')}</label>
              <select
                name="entityType"
                className="input mt-1"
                value={form.entityType}
                onChange={handleChange}
              >
                <option value="all">{t('orderAttributes.entities.all')}</option>
                <option value="sale">{t('orderAttributes.entities.sale')}</option>
                <option value="service">{t('orderAttributes.entities.service')}</option>
              </select>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <button disabled={submitting} type="submit" className="btn-primary flex-1">
                {submitting
                  ? t('common.loading')
                  : editingId
                    ? t('orderAttributes.editAttribute')
                    : t('orderAttributes.addAttribute')}
              </button>
              {editingId ? (
                <button onClick={handleCancel} type="button" className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="card space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-serif text-lg text-slate-900 dark:text-white">
                {t('orderAttributes.title')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('common.total')}: {attributes.length}
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {loadingList ? (
              <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
            ) : attributes.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">{t('common.noData') || 'No attributes found.'}</p>
            ) : (
              attributes.map((attribute) => (
                <div
                  key={attribute.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60"
                >
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{attribute.name}</p>
                      <p className="font-mono text-xs text-slate-500">{attribute.key}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
                        {t(`orderAttributes.types.${attribute.type}`)}
                      </span>
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {t(`orderAttributes.entities.${attribute.entityType}`)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => handleEdit(attribute)} className="btn-ghost" type="button">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => handleDelete(attribute.id)} className="btn-ghost" type="button">
                      {t('common.remove')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-3">{t('orderAttributes.name')}</th>
                  <th className="py-3">{t('orderAttributes.key')}</th>
                  <th className="py-3">{t('orderAttributes.type')}</th>
                  <th className="py-3">{t('orderAttributes.entityType')}</th>
                  <th className="py-3 text-right">{t('products.action')}</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : attributes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-slate-500">
                      {t('common.noData') || 'No attributes found.'}
                    </td>
                  </tr>
                ) : (
                  attributes.map((attribute) => (
                    <tr key={attribute.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                      <td className="py-3 font-medium text-slate-900 dark:text-white">{attribute.name}</td>
                      <td className="py-3 font-mono text-xs text-slate-500">{attribute.key}</td>
                      <td className="py-3">
                        <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-200">
                          {t(`orderAttributes.types.${attribute.type}`)}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-200">
                          {t(`orderAttributes.entities.${attribute.entityType}`)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(attribute)} className="btn-ghost" type="button">
                            {t('common.edit')}
                          </button>
                          <button onClick={() => handleDelete(attribute.id)} className="btn-ghost" type="button">
                            {t('common.remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
