import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';

const emptyForm = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  openingBalance: '0',
};

export default function Suppliers() {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);

  const loadSuppliers = async () => {
    try {
      const data = await api.listSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.createSupplier({
        ...form,
        openingBalance: Number(form.openingBalance || 0),
      });
      setForm(emptyForm);
      await loadSuppliers();
      setStatus({ type: 'success', message: t('suppliers.messages.created') });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
      />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('suppliers.directory')}</h3>
          <div className="mt-4 grid gap-3">
            {suppliers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('suppliers.noSuppliers')}</p>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{supplier.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {supplier.contactName || t('suppliers.contactNotSet')}
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {supplier.phone || t('suppliers.phoneNA')} {supplier.email ? `· ${supplier.email}` : ''}
                      </p>
                      {supplier.address ? (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{supplier.address}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      <p>{t('suppliers.openingBalance')}</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(supplier.openingBalance || 0).toFixed(2) })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <form className="card space-y-4" onSubmit={handleSubmit}>
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('suppliers.addSupplier')}</h3>
          <div>
            <label className="label">{t('suppliers.supplierName')}</label>
            <input className="input mt-1" name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div>
            <label className="label">{t('suppliers.contactPerson')}</label>
            <input className="input mt-1" name="contactName" value={form.contactName} onChange={handleChange} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('suppliers.phone')}</label>
              <input className="input mt-1" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="label">{t('suppliers.email')}</label>
              <input className="input mt-1" type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
          </div>
          <div>
            <label className="label">{t('suppliers.address')}</label>
            <input className="input mt-1" name="address" value={form.address} onChange={handleChange} />
          </div>
          <div>
            <label className="label">{t('suppliers.openingBalance')}</label>
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              name="openingBalance"
              value={form.openingBalance}
              onChange={handleChange}
            />
            <p className="mt-1 text-xs text-slate-500">{t('suppliers.openingHint')}</p>
          </div>
          {status.message ? <Notice title={status.message} tone={status.type} /> : null}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? t('common.loading') : t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
