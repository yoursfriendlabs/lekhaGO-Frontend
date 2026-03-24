import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

const emptyForm = {
  name: '',
  key: '',
  type: 'text',
  entityType: 'all',
};

function getAttributeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

export default function OrderAttributes() {
  const { t } = useI18n();
  const [attributes, setAttributes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const loadAttributes = async () => {
    try {
      const data = await api.listOrderAttributes();
      setAttributes(getAttributeItems(data));
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  useEffect(() => {
    form.key = form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }, [form.name])

  const handleChange = (event) => {
    const { name, value } = event.target;
    let finalValue = value;
    if (name === 'key') {
      finalValue = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }
    setForm((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleEdit = (attr) => {
    setEditingId(attr.id);
    setForm({
      name: attr.name || '',
      key: attr.key || '',
      type: attr.type || 'text',
      entityType: attr.entityType || 'all',
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
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      if (editingId) {
        await api.updateOrderAttribute(editingId, form);
        setStatus({ type: 'success', message: t('orderAttributes.messages.updated') });
      } else {
        await api.createOrderAttribute(form);
        setStatus({ type: 'success', message: t('orderAttributes.messages.created') });
      }
      setForm(emptyForm);
      setEditingId(null);
      await loadAttributes();
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('orderAttributes.title')}
        subtitle={t('orderAttributes.subtitle')}
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="card sticky top-24 space-y-4 p-6">
            <h3 className="text-lg font-bold text-slate-900">
              {editingId ? t('orderAttributes.editAttribute') : t('orderAttributes.addAttribute')}
            </h3>

            {status.message && <Notice type={status.type} message={status.message} />}

            <div className="space-y-4">
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

              {/*<div>*/}
              {/*  <label className="label">{t('orderAttributes.key')}</label>*/}
              {/*  <input*/}
              {/*    required*/}
              {/*    disabled*/}
              {/*    name="key"*/}
              {/*    className="input mt-1"*/}
              {/*    value={form.key}*/}
              {/*    onChange={handleChange}*/}
              {/*    placeholder="e.g. chest_size"*/}
              {/*  />*/}
              {/*</div>*/}

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
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={loading}
                type="submit"
                className="flex-1 rounded-xl bg-ocean py-2.5 text-sm font-bold text-white transition hover:bg-ocean/90 disabled:opacity-50"
              >
                {loading ? t('common.saving') : t('common.save')}
              </button>
              {editingId && (
                <button
                  onClick={handleCancel}
                  type="button"
                  className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
                >
                  {t('common.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">{t('orderAttributes.name')}</th>
                  <th className="px-6 py-4">{t('orderAttributes.type')}</th>
                  <th className="px-6 py-4">{t('orderAttributes.entityType')}</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attributes.map((attr) => (
                  <tr key={attr.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium text-slate-900">{attr.name}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                        {t(`orderAttributes.types.${attr.type}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
                        {t(`orderAttributes.entities.${attr.entityType}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(attr)}
                          className="text-ocean hover:text-ocean/80"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => handleDelete(attr.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          {t('common.remove')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {attributes.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      {t('common.noData') || 'No attributes found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
