import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

const emptyItem = {
  itemType: 'labor',
  description: '',
  productId: '',
  batchId: '',
  quantity: '1',
  unitPrice: '0',
  lineTotal: '0',
};

export default function Services() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const [products, setProducts] = useState([]);
  const [batchesByProduct, setBatchesByProduct] = useState({});
  const [customers, setCustomers] = useState([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [customerNameTouched, setCustomerNameTouched] = useState(false);
  const [serviceList, setServiceList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [header, setHeader] = useState({
    customerId: '',
    vehicleId: '',
    orderNo: '',
    status: 'open',
    notes: '',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [status, setStatus] = useState({ type: 'info', message: '' });

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => null);
    api.listCustomers().then(setCustomers).catch(() => null);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 25 };
    if (statusFilter !== 'all') params.status = statusFilter;
    api.listServices(params).then(setServiceList).catch(() => null);
  }, [businessId, statusFilter]);

  const ensureBatches = async (productId) => {
    if (!productId || batchesByProduct[productId]) return;
    try {
      const data = await api.listBatches({ productId });
      setBatchesByProduct((prev) => ({ ...prev, [productId]: data || [] }));
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const totals = useMemo(() => {
    const laborTotal = items
      .filter((item) => item.itemType === 'labor')
      .reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const partsTotal = items
      .filter((item) => item.itemType === 'part')
      .reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    return {
      laborTotal,
      partsTotal,
      grandTotal: laborTotal + partsTotal,
    };
  }, [items]);

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (customerNameTouched) return;
    if (customerQuery) {
      setNewCustomer((prev) => ({ ...prev, name: customerQuery }));
    } else {
      setNewCustomer((prev) => ({ ...prev, name: '' }));
    }
  }, [customerQuery, customerNameTouched]);

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'productId') next.batchId = '';
        if (field === 'itemType' && value === 'labor') {
          next.productId = '';
          next.batchId = '';
        }
        const quantity = Number(next.quantity || 0);
        const unitPrice = Number(next.unitPrice || 0);
        next.lineTotal = (quantity * unitPrice).toFixed(2);
        return next;
      })
    );
    if (field === 'productId') ensureBatches(value);
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index) => setItems((prev) => prev.filter((_, idx) => idx !== index));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!businessId) {
      setStatus({ type: 'error', message: t('errors.businessIdRequired') });
      return;
    }
    if (!header.customerId) {
      setStatus({ type: 'error', message: t('errors.customerRequired') });
      return;
    }
    const invalidPart = items.find((item) => item.itemType === 'part' && !item.productId);
    if (invalidPart) {
      setStatus({ type: 'error', message: t('errors.selectProductPart') });
      return;
    }
    try {
      await api.createService({
        ...header,
        ...totals,
        items: items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      });
      setStatus({ type: 'success', message: t('services.messages.created') });
      setHeader({ customerId: '', vehicleId: '', orderNo: '', status: 'open', notes: '' });
      setItems([{ ...emptyItem }]);
      setCustomerQuery('');
      setSelectedCustomer(null);
      setNewCustomer({ name: '', phone: '' });
      setCustomerNameTouched(false);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return [];
    return customers
      .filter((customer) => {
        return (
          String(customer.name || '').toLowerCase().includes(query) ||
          String(customer.phone || '').toLowerCase().includes(query)
        );
      })
      .slice(0, 6);
  }, [customerQuery, customers]);

  const showSuggestions = customerQuery.trim().length > 0 && !selectedCustomer;

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setHeader((prev) => ({ ...prev, customerId: customer.id }));
    setCustomerQuery(`${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`);
    setNewCustomer({ name: '', phone: '' });
    setCustomerNameTouched(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setHeader((prev) => ({ ...prev, customerId: '' }));
    setCustomerQuery('');
    setNewCustomer({ name: '', phone: '' });
    setCustomerNameTouched(false);
  };

  const handleCustomerSearch = (event) => {
    const value = event.target.value;
    setCustomerQuery(value);
    if (selectedCustomer) {
      setSelectedCustomer(null);
      setHeader((prev) => ({ ...prev, customerId: '' }));
    }
  };

  const handleNewCustomerChange = (event) => {
    const { name, value } = event.target;
    setNewCustomer((prev) => ({ ...prev, [name]: value }));
    if (name === 'name') setCustomerNameTouched(true);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      setStatus({ type: 'error', message: 'Enter a name to add a payee.' });
      return;
    }
    try {
      const customer = await api.createCustomer({
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
      });
      setCustomers((prev) => [customer, ...prev]);
      selectCustomer(customer);
      setStatus({ type: 'success', message: 'Payee added.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        action={<button className="btn-ghost" type="button" onClick={addItem}>{t('services.addLine')}</button>}
      />
      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      <form className="card space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="label">{t('services.customer')}</label>
            <div className="mt-1 rounded-2xl border border-slate-200/70 bg-white/80 p-3 dark:border-slate-700/60 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder={t('services.customerSearch')}
                  value={customerQuery}
                  onChange={handleCustomerSearch}
                />
                {selectedCustomer ? (
                  <button className="btn-ghost" type="button" onClick={clearCustomer}>
                    {t('common.change')}
                  </button>
                ) : null}
              </div>
              {showSuggestions ? (
                <div className="mt-3 grid gap-2">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs text-slate-500">{t('services.noCustomerMatch')}</p>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="rounded-xl border border-slate-200/70 bg-white/90 px-3 py-2 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-emerald-800/60 dark:hover:bg-emerald-900/20"
                        onClick={() => selectCustomer(customer)}
                      >
                          <div className="font-semibold">{customer.name}</div>
                          <div className="text-xs text-slate-500">{customer.phone || t('suppliers.phoneNA')}</div>
                        </button>
                    ))
                  )}
                </div>
              ) : null}
              <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/60">
                <p className="text-xs uppercase text-slate-400">{t('services.addCustomer')}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    className="input"
                    name="name"
                    placeholder={t('services.addCustomer')}
                    value={newCustomer.name}
                    onChange={handleNewCustomerChange}
                  />
                  <input
                    className="input"
                    name="phone"
                    placeholder={t('services.phoneOptional')}
                    value={newCustomer.phone}
                    onChange={handleNewCustomerChange}
                  />
                </div>
                <button className="btn-secondary mt-2" type="button" onClick={handleCreateCustomer}>
                  {t('services.addSelect')}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{t('services.customerRequired')}</p>
          </div>
          <div>
            <label className="label">{t('services.vehicleId')}</label>
            <input className="input mt-1" name="vehicleId" value={header.vehicleId} onChange={handleHeaderChange} />
          </div>
          <div>
            <label className="label">{t('services.orderNo')}</label>
            <input className="input mt-1" name="orderNo" value={header.orderNo} onChange={handleHeaderChange} />
          </div>
          <div>
            <label className="label">{t('services.status')}</label>
            <select className="input mt-1" name="status" value={header.status} onChange={handleHeaderChange}>
              <option value="open">{t('services.open')}</option>
              <option value="in_progress">{t('services.inProgress')}</option>
              <option value="closed">{t('services.closed')}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">{t('services.notes')}</label>
            <input className="input mt-1" name="notes" value={header.notes} onChange={handleHeaderChange} />
          </div>
        </div>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
              <div className="grid gap-3 md:grid-cols-6">
                <div>
                  <label className="label">{t('services.type')}</label>
                  <select
                    className="input mt-1"
                    value={item.itemType}
                    onChange={(event) => handleItemChange(idx, 'itemType', event.target.value)}
                  >
                    <option value="labor">{t('services.labor')}</option>
                    <option value="part">{t('services.part')}</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">{t('services.description')}</label>
                  <input
                    className="input mt-1"
                    value={item.description}
                    onChange={(event) => handleItemChange(idx, 'description', event.target.value)}
                    placeholder={t('services.placeholderService')}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label">{t('services.productParts')}</label>
                  <select
                    className="input mt-1"
                    value={item.productId}
                    onChange={(event) => handleItemChange(idx, 'productId', event.target.value)}
                    disabled={item.itemType !== 'part'}
                  >
                    <option value="">{t('purchases.selectProduct')}</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}{product.primaryUnit ? ` · ${product.primaryUnit}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('services.qty')}</label>
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.001"
                    value={item.quantity}
                    onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{t('services.unitPrice')}</label>
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)}
                  />
                </div>
                <div>
                  <label className="label">{t('services.batch')}</label>
                  <select
                    className="input mt-1"
                    value={item.batchId}
                    onChange={(event) => handleItemChange(idx, 'batchId', event.target.value)}
                    disabled={item.itemType !== 'part'}
                  >
                    <option value="">{t('purchases.autoNone')}</option>
                    {(batchesByProduct[item.productId] || []).map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batchNumber || batch.id.slice(0, 6)} · {batch.quantityOnHand}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>
                  {t('common.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}
                </span>
                {items.length > 1 ? (
                  <button className="btn-ghost" type="button" onClick={() => removeItem(idx)}>
                    {t('common.remove')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            <p>{t('services.laborTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.laborTotal.toFixed(2) })}</p>
            <p>{t('services.partsTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.partsTotal.toFixed(2) })}</p>
            <p className="font-semibold">
              {t('services.grandTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}
            </p>
          </div>
          <button className="btn-primary" type="submit">
            {t('services.saveOrder')}
          </button>
        </div>
      </form>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('services.recentOrders')}</h3>
          <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">{t('sales.allStatuses')}</option>
            <option value="open">{t('services.open')}</option>
            <option value="in_progress">{t('services.inProgress')}</option>
            <option value="closed">{t('services.closed')}</option>
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('services.orderNo')}</th>
                <th className="py-2 text-left">{t('services.status')}</th>
                <th className="py-2 text-right">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {serviceList.length === 0 ? (
                <tr><td colSpan={3} className="py-3 text-slate-500">{t('services.noOrders')}</td></tr>
              ) : (
                serviceList.map((order) => (
                  <tr key={order.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{order.orderNo || order.id.slice(0, 6)}</td>
                    <td className="py-2 capitalize">{order.status}</td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(order.grandTotal || 0).toFixed(2) })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
