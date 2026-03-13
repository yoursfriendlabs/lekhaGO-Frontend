import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';

const emptyItem = {
  productId: '',
  batchId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0'
};

export default function Sales() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const [products, setProducts] = useState([]);
  const [batchesByProduct, setBatchesByProduct] = useState({});
  const [customers, setCustomers] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [header, setHeader] = useState({
    customerId: '',
    invoiceNo: '',
    saleDate: '',
    status: 'paid',
    notes: '',
    amountReceived: '0',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => null);
    api.listCustomers().then(setCustomers).catch(() => null);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 25 };
    if (statusFilter !== 'all') params.status = statusFilter;
    api.listSales(params).then(setSalesList).catch(() => null);
  }, [businessId, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

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
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const taxTotal = items.reduce(
      (sum, item) => sum + (Number(item.lineTotal || 0) * Number(item.taxRate || 0)) / 100,
      0
    );
    return {
      subTotal,
      taxTotal,
      grandTotal: subTotal + taxTotal,
    };
  }, [items]);

  const totalReceived = Number(header.amountReceived || 0);
  const dueAmount = Math.max(totals.grandTotal - totalReceived, 0);

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'productId') next.batchId = '';
        const quantity = Number(next.quantity || 0);
        const unitPrice = Number(next.unitPrice || 0);
        next.lineTotal = (quantity * unitPrice).toFixed(2);
        return next;
      })
    );
    if (field === 'productId') ensureBatches(value);
  };

  const getProductById = (id) => products.find((p) => p.id === id);
  const getUnitLabel = (product, unitType) => {
    if (!product) return '';
    if (unitType === 'secondary') return product.secondaryUnit || product.primaryUnit || '';
    return product.primaryUnit || product.secondaryUnit || '';
  };

  const syncItemDefaults = (index, product) => {
    if (!product) return;
    setItems((prev) => prev.map((item, idx) => {
      if (idx !== index) return item;
      const next = { ...item };
      if (!next.unitType) next.unitType = 'primary';
      if (next.unitType === 'secondary') {
        const explicitSecondary = Number(product.secondarySalePrice || 0);
        if (explicitSecondary > 0) {
          next.unitPrice = String(explicitSecondary);
        } else {
          const conversionRate = Number(product.conversionRate || 0);
          const primaryPrice = Number(product.salePrice || 0);
          if (conversionRate > 0 && primaryPrice > 0) {
            next.unitPrice = String((primaryPrice / conversionRate).toFixed(4));
          }
        }
      } else if (next.unitType === 'primary' && Number(product.salePrice || 0) > 0) {
        next.unitPrice = String(product.salePrice || 0);
      }
      const quantity = Number(next.quantity || 0);
      const unitPrice = Number(next.unitPrice || 0);
      next.lineTotal = (quantity * unitPrice).toFixed(2);
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.id) {
        setDeletedItemIds((ids) => [...ids, target.id]);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const exportCsv = () => {
    const rows = [
      [
        t('common.invoice'),
        t('common.date'),
        t('common.status'),
        t('sales.customer'),
        t('sales.subTotal'),
        t('sales.taxTotal'),
        t('sales.grandTotal'),
        t('sales.totalReceived'),
        t('sales.dueLabel'),
      ],
      ...salesList.map((s) => [
        s.invoiceNo || s.id,
        s.saleDate || '',
        s.status || '',
        s.Customer?.name || s.customerName || s.customerId || '',
        Number(s.subTotal || 0).toFixed(2),
        Number(s.taxTotal || 0).toFixed(2),
        Number(s.grandTotal || 0).toFixed(2),
        Number(s.amountReceived || 0).toFixed(2),
        Number(s.dueAmount || 0).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/\"/g, '""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-${statusFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalSales = salesList.length;
  const pagedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return salesList.slice(start, start + pageSize);
  }, [page, pageSize, salesList]);

  const resetForm = () => {
    setHeader({ customerId: '', invoiceNo: '', saleDate: '', status: 'paid', notes: '', amountReceived: '0' });
    setItems([{ ...emptyItem }]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = async (saleId) => {
    try {
      const sale = await api.getSale(saleId);
      const saleItems = sale?.SaleItems || [];
      saleItems.forEach((item) => {
        if (item.productId) ensureBatches(item.productId);
      });
      setHeader({
        customerId: sale.customerId || '',
        invoiceNo: sale.invoiceNo || '',
        saleDate: sale.saleDate || '',
        status: sale.status || 'paid',
        notes: sale.notes || '',
        amountReceived: String(sale.amountReceived ?? 0),
      });
      const mappedItems = saleItems.map((item) => ({
        id: item.id,
        productId: item.productId || '',
        batchId: item.batchId || '',
        quantity: String(item.quantity ?? '1'),
        unitType: item.unitType || 'primary',
        unitPrice: String(item.unitPrice ?? '0'),
        taxRate: String(item.taxRate ?? '0'),
        lineTotal: String(item.lineTotal ?? '0'),
      }));
      setItems(mappedItems.length ? mappedItems : [{ ...emptyItem }]);
      setDeletedItemIds([]);
      setEditingId(saleId);
      setFormMode('edit');
      setIsOpen(true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!businessId) {
      setStatus({ type: 'error', message: t('errors.businessIdRequired') });
      return;
    }
    if (!header.saleDate) {
      setStatus({ type: 'error', message: t('errors.saleDateRequired') });
      return;
    }
    const invalidItem = items.find((item) => !item.productId);
    if (invalidItem) {
      setStatus({ type: 'error', message: t('errors.selectProductSale') });
      return;
    }
    const invalidConversion = items.find((item) => {
      if (item.unitType !== 'secondary') return false;
      const product = getProductById(item.productId);
      return Number(product?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) {
      setStatus({ type: 'error', message: t('errors.conversionRequired') });
      return;
    }
    try {
      const payload = {
        ...header,
        customerId: header.customerId || null,
        amountReceived: totalReceived,
        ...totals,
        items: [
          ...items.map((item) => ({
            ...item,
            batchId: item.batchId || null,
            quantity: Number(item.quantity),
            unitType: item.unitType || 'primary',
            conversionRate: Number(getProductById(item.productId)?.conversionRate || 0),
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
            lineTotal: Number(item.lineTotal),
          })),
          ...deletedItemIds.map((id) => ({ id, _delete: true })),
        ],
      };
      if (formMode === 'edit' && editingId) {
        await api.updateSale(editingId, payload);
        setStatus({ type: 'success', message: t('sales.messages.updated') });
      } else {
        await api.createSale(payload);
        setStatus({ type: 'success', message: t('sales.messages.created') });
      }
      resetForm();
      setIsOpen(false);
      const params = { limit: 25 };
      if (statusFilter !== 'all') params.status = statusFilter;
      api.listSales(params).then(setSalesList).catch(() => null);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        action={<button className="btn-primary" type="button" onClick={openCreate}>{t('sales.newSale')}</button>}
      />
      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title={formMode === 'edit' ? t('sales.editSale') : t('sales.newSale')} size="full">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">{t('sales.customer')}</label>
              <select className="input mt-1" name="customerId" value={header.customerId} onChange={handleHeaderChange}>
                <option value="">{t('sales.walkIn')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">{t('sales.customerOptional')}</p>
            </div>
            <div>
              <label className="label">{t('sales.invoiceNo')}</label>
              <input className="input mt-1" name="invoiceNo" value={header.invoiceNo} onChange={handleHeaderChange} />
            </div>
            <div>
              <label className="label">{t('sales.saleDate')}</label>
              <input className="input mt-1" type="date" name="saleDate" value={header.saleDate} onChange={handleHeaderChange} required />
            </div>
            <div>
              <label className="label">{t('sales.status')}</label>
              <select className="input mt-1" name="status" value={header.status} onChange={handleHeaderChange}>
                <option value="paid">{t('sales.paid')}</option>
                <option value="due">{t('sales.due')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('sales.totalReceived')}</label>
              <input
                className="input mt-1"
                type="number"
                step="0.01"
                name="amountReceived"
                value={header.amountReceived}
                onChange={handleHeaderChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('sales.notes')}</label>
              <input className="input mt-1" name="notes" value={header.notes} onChange={handleHeaderChange} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('sales.items')}</h4>
            <button className="btn-ghost" type="button" onClick={addItem}>
              {t('sales.addItem')}
            </button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="label">{t('sales.product')}</label>
                    <select
                      className="input mt-1"
                      value={item.productId}
                      onChange={(event) => {
                        handleItemChange(idx, 'productId', event.target.value);
                        syncItemDefaults(idx, getProductById(event.target.value));
                      }}
                      required
                    >
                      <option value="">{t('purchases.selectProduct')}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.companyName ? ` · ${product.companyName}` : ''}
                          {product.primaryUnit ? ` · ${product.primaryUnit}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('sales.batch')}</label>
                    <select
                      className="input mt-1"
                      value={item.batchId}
                      onChange={(event) => handleItemChange(idx, 'batchId', event.target.value)}
                    >
                      <option value="">{t('purchases.autoNone')}</option>
                      {(batchesByProduct[item.productId] || []).map((batch) => (
                        <option key={batch.id} value={batch.id}>
                          {batch.batchNumber || batch.id.slice(0, 6)} · {batch.quantityOnHand}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('sales.qty')}</label>
                    <input
                      className="input mt-1"
                      type="number"
                      step="0.001"
                      value={item.quantity}
                      onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {getUnitLabel(getProductById(item.productId), item.unitType)}
                    </p>
                  </div>
                  <div>
                    <label className="label">{t('products.unitType')}</label>
                    <select
                      className="input mt-1"
                      value={item.unitType}
                      onChange={(event) => {
                        handleItemChange(idx, 'unitType', event.target.value);
                        syncItemDefaults(idx, getProductById(item.productId));
                      }}
                    >
                      <option value="primary">{t('products.primaryUnit')}</option>
                      <option value="secondary">{t('products.secondaryUnit')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('sales.unitPrice')}</label>
                    <input
                      className="input mt-1"
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">{t('sales.tax')}</label>
                    <input
                      className="input mt-1"
                      type="number"
                      step="0.01"
                      value={item.taxRate}
                      onChange={(event) => handleItemChange(idx, 'taxRate', event.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>
                    {t('sales.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}
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
              <p>{t('sales.subTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.subTotal.toFixed(2) })}</p>
              <p>{t('sales.taxTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.taxTotal.toFixed(2) })}</p>
              <p className="font-semibold">{t('sales.grandTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</p>
              <p>{t('sales.totalReceived')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totalReceived.toFixed(2) })}</p>
              <p className="font-semibold text-rose-600 dark:text-rose-300">
                {t('sales.dueLabel')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: dueAmount.toFixed(2) })}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" type="button" onClick={() => setIsOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn-primary" type="submit">
                {formMode === 'edit' ? t('sales.updateSale') : t('sales.saveSale')}
              </button>
            </div>
          </div>
        </form>
      </Dialog>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('sales.recentSales')}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('sales.allStatuses')}</option>
              <option value="paid">{t('sales.paid')}</option>
              <option value="due">{t('sales.due')}</option>
            </select>
            <button className="btn-ghost" type="button" onClick={exportCsv}>{t('sales.exportCsv')}</button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('common.invoice')}</th>
                <th className="py-2 text-left">{t('common.date')}</th>
                <th className="py-2 text-left">{t('common.status')}</th>
                <th className="py-2 text-left">{t('sales.customer')}</th>
                <th className="py-2 text-right">{t('common.total')}</th>
                <th className="py-2 text-right">{t('sales.totalReceived')}</th>
                <th className="py-2 text-right">{t('sales.due')}</th>
                <th className="py-2 text-right">{t('common.invoice')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedSales.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('sales.noSales')}</td></tr>
              ) : (
                pagedSales.map((sale) => (
                  <tr key={sale.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{sale.invoiceNo || sale.id.slice(0, 6)}</td>
                    <td className="py-2">{sale.saleDate}</td>
                    <td className="py-2 capitalize">{sale.status}</td>
                    <td className="py-2">{sale.Customer?.name || sale.customerName || sale.customerId || '—'}</td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.grandTotal || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.amountReceived || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-300">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.dueAmount || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="text-slate-600 hover:text-slate-900" type="button" onClick={() => openEdit(sale.id)}>
                          {t('common.edit')}
                        </button>
                        <Link className="text-emerald-600 hover:text-emerald-500 dark:text-ocean dark:hover:text-teal-300" to={`/app/invoice/sales/${sale.id}`}>
                          {t('common.view')}
                        </Link>
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
          total={totalSales}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
