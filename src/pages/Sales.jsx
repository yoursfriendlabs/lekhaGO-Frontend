import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, FileText, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';
import FileUpload from '../components/FileUpload';
import DynamicAttributes from '../components/DynamicAttributes';
import SearchableSelect from '../components/SearchableSelect';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { useProductStore } from '../stores/products';
import { usePartyStore } from '../stores/parties';
import { useSaleStore } from '../stores/sales';
import { getCreatorDisplayName, getCurrentCreatorValue } from '../lib/records';

const emptyItem = {
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0'
};

// ── Matches Services StatusBadge exactly ──
function StatusBadge({ status }) {
  const map = {
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    due:  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

// ── Format date like Services: "22 Mar" ──
function formatDate(dateStr) {
  return formatMaybeDate(dateStr, 'D MMM');
}

// ── Resolve customer name from sale object ──
function getCustomerName(sale) {
  return (
    sale.partyName ||
    sale.customerName ||
    sale.Party?.name ||
    sale.Customer?.name ||
    null
  );
}

export default function Sales() {
  const { t } = useI18n();
  const { businessId, user } = useAuth();

  // ── Stores ──
  const { products, fetch: fetchProducts } = useProductStore();
  const { parties, fetch: fetchParties } = usePartyStore();
  const { sales: salesList, loading: salesLoading, fetch: fetchSales, invalidate: invalidateSales } = useSaleStore();

  // ── UI state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPaid, setIsPaid] = useState(false);
  const [header, setHeader] = useState({
    partyId: '',
    invoiceNo: '',
    saleDate: todayISODate(),
    status: 'paid',
    notes: '',
    amountReceived: '0',
    attachment: '',
    attributes: {},
  });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Load shared data ──
  useEffect(() => {
    fetchProducts();
    fetchParties();
  }, []);

  // ── Load sales list ──
  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 50 };
    if (statusFilter !== 'all') params.status = statusFilter;
    fetchSales(params, true);
  }, [businessId, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const customerOptions = useMemo(
    () =>
      parties
        .filter((p) => p.type === 'customer')
        .map((p) => ({
          value: p.id,
          label: `${p.name || '—'}${p.phone ? ` (${p.phone})` : ''}`,
        })),
    [parties]
  );

  // ── Totals ──
  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const taxTotal = items.reduce(
      (sum, item) => sum + (Number(item.lineTotal || 0) * Number(item.taxRate || 0)) / 100,
      0
    );
    return { subTotal, taxTotal, grandTotal: subTotal + taxTotal };
  }, [items]);

  const receivedAmount = useMemo(() => (
    isPaid
      ? totals.grandTotal
      : Math.min(Number(header.amountReceived || 0), totals.grandTotal)
  ), [header.amountReceived, isPaid, totals.grandTotal]);
  const dueAmount = Math.max(totals.grandTotal - receivedAmount, 0);

  useEffect(() => {
    if (!isPaid) return;
    setHeader((prev) => ({ ...prev, amountReceived: totals.grandTotal.toFixed(2), status: 'paid' }));
  }, [isPaid, totals.grandTotal]);

  useEffect(() => {
    if (isPaid) return;
    const derived = dueAmount > 0 ? 'due' : 'paid';
    setHeader((prev) => (prev.status === derived ? prev : { ...prev, status: derived }));
  }, [dueAmount, isPaid]);

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      })
    );
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
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, { ...emptyItem }]);

  const removeItem = (index) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.id) setDeletedItemIds((ids) => [...ids, target.id]);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const exportCsv = () => {
    const rows = [
      [t('common.invoice'), t('common.date'), t('common.status'), t('sales.customer'), t('sales.subTotal'), t('sales.taxTotal'), t('sales.grandTotal'), t('sales.totalReceived'), t('sales.dueLabel')],
      ...salesList.map((s) => [
        s.invoiceNo || s.id,
        s.saleDate || '',
        s.status || '',
        getCustomerName(s) || '',
        Number(s.subTotal || 0).toFixed(2),
        Number(s.taxTotal || 0).toFixed(2),
        Number(s.grandTotal || 0).toFixed(2),
        Number(s.amountReceived || 0).toFixed(2),
        Number(s.dueAmount || 0).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
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
    setHeader({ partyId: '', invoiceNo: '', saleDate: todayISODate(), status: 'paid', notes: '', amountReceived: '0', attachment: '', attributes: {} });
    setItems([{ ...emptyItem }]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
    setIsPaid(false);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };

  const openEdit = async (saleId) => {
    try {
      const sale = await api.getSale(saleId);
      const saleItems = sale?.SaleItems || [];
      setHeader({
        partyId: sale.partyId || sale.customerId || '',
        invoiceNo: sale.invoiceNo || '',
        saleDate: sale.saleDate || '',
        status: sale.status || 'paid',
        notes: sale.notes || '',
        amountReceived: String(sale.amountReceived ?? 0),
        attachment: sale.attachment || '',
        attributes: sale.attributes || {},
      });
      const mappedItems = saleItems.map((item) => ({
        id: item.id,
        productId: item.productId || '',
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
      const computedDue = Number(sale.dueAmount ?? Math.max(Number(sale.grandTotal || 0) - Number(sale.amountReceived || 0), 0));
      setIsPaid((sale.status || '').toLowerCase() === 'paid' || computedDue <= 0);
      setIsOpen(true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!businessId) { setStatus({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.saleDate) { setStatus({ type: 'error', message: t('errors.saleDateRequired') }); return; }
    const invalidItem = items.find((item) => !item.productId);
    if (invalidItem) { setStatus({ type: 'error', message: t('errors.selectProductSale') }); return; }
    const invalidConversion = items.find((item) => {
      if (item.unitType !== 'secondary') return false;
      return Number(getProductById(item.productId)?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) { setStatus({ type: 'error', message: t('errors.conversionRequired') }); return; }

    try {
      const derivedStatus = dueAmount > 0 ? 'due' : 'paid';
      const payload = {
        ...header,
        status: derivedStatus,
        partyId: header.partyId || null,
        amountReceived: receivedAmount,
        ...totals,
        items: [
          ...items.map((item) => ({
            ...item,
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
      const creatorValue = getCurrentCreatorValue(user);
      const createPayload = creatorValue
        ? { ...payload, createdBy: creatorValue }
        : payload;
      if (formMode === 'edit' && editingId) {
        await api.updateSale(editingId, payload);
        setStatus({ type: 'success', message: t('sales.messages.updated') });
      } else {
        await api.createSale(createPayload);
        setStatus({ type: 'success', message: t('sales.messages.created') });
      }
      resetForm();
      setIsOpen(false);
      invalidateSales();
      const params = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      fetchSales(params, true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        action={
          <button className="btn-primary" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('sales.newSale')}
          </button>
        }
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}

      {/* ── Form Dialog ── */}
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title={formMode === 'edit' ? t('sales.editSale') : t('sales.newSale')} size="full">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">{t('sales.customer')}</label>
              <div className="mt-1">
                <SearchableSelect
                  options={customerOptions}
                  value={header.partyId}
                  onChange={(newValue) => setHeader((prev) => ({ ...prev, partyId: newValue }))}
                  placeholder={t('sales.walkIn')}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">{t('sales.customerOptional')}</p>
            </div>
            <div>
              <label className="label">{t('sales.invoiceNo')}</label>
              <input className="input mt-1" name="invoiceNo" value={header.invoiceNo} onChange={handleHeaderChange} />
            </div>
            <div>
              <label className="label">{t('sales.saleDate')}</label>
              <input type="date" className="input mt-1" name="saleDate" value={header.saleDate} onChange={handleHeaderChange} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FileUpload
              label={t('sales.attachment')}
              initialUrl={header.attachment}
              onUpload={(url) => setHeader((prev) => ({ ...prev, attachment: url }))}
            />
            <div className="md:col-span-1">
              <label className="label">{t('sales.notes')}</label>
              <textarea className="input mt-1 h-20 resize-none" name="notes" value={header.notes} onChange={handleHeaderChange} placeholder={t('sales.notesPlaceholder')} />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <h3 className="mb-4 text-sm font-medium text-slate-700">{t('services.orderInformation') || 'Order Information'}</h3>
            <DynamicAttributes entityType="sale" attributes={header.attributes} onChange={(attr) => setHeader((prev) => ({ ...prev, attributes: attr }))} />
          </div>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('sales.items')}</h4>
            <button className="btn-ghost" type="button" onClick={addItem}>{t('sales.addItem')}</button>
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
                          {product.name}{product.companyName ? ` · ${product.companyName}` : ''}{product.primaryUnit ? ` · ${product.primaryUnit}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('sales.qty')}</label>
                    <input className="input mt-1" type="number" step="1" min={0} value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                    <p className="mt-1 text-xs text-slate-500">{getUnitLabel(getProductById(item.productId), item.unitType)}</p>
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
                    <input className="input mt-1" type="number" step="0.01" value={item.unitPrice} onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)} />
                  </div>
                  <div>
                    <label className="label">{t('sales.tax')}</label>
                    <input className="input mt-1" type="number" step="0.01" value={item.taxRate} onChange={(event) => handleItemChange(idx, 'taxRate', event.target.value)} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{t('sales.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}</span>
                  {items.length > 1 ? (
                    <button className="btn-ghost" type="button" onClick={() => removeItem(idx)}>{t('common.remove')}</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4">
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-slate-500">{t('sales.subTotal')}</span>
                <span className="font-semibold text-slate-800">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.subTotal.toFixed(2) })}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-slate-500">{t('sales.taxTotal')}</span>
                <span className="font-semibold text-slate-800">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.taxTotal.toFixed(2) })}</span>
              </div>
              <div className="flex justify-between sm:flex-col sm:gap-0.5">
                <span className="text-slate-500">{t('sales.grandTotal')}</span>
                <span className="text-lg font-bold text-slate-900">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</span>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-200/70 pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="label">{t('services.amountReceived')}</label>
                  <input
                    className="input mt-1"
                    type="number"
                    step="0.01"
                    min="0"
                    value={isPaid ? totals.grandTotal.toFixed(2) : header.amountReceived}
                    disabled={isPaid}
                    onChange={(e) => setHeader((prev) => ({ ...prev, amountReceived: e.target.value }))}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary-600"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                  />
                  {t('services.fullyPaid')}
                </label>
              </div>

              {dueAmount > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 text-sm">
                  <span className="text-rose-500">{t('services.dueAmount')}:</span>
                  <span className="font-bold text-rose-700">
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: dueAmount.toFixed(2) })}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={() => setIsOpen(false)}>{t('common.cancel')}</button>
            <button className="btn-primary" type="submit">{formMode === 'edit' ? t('sales.updateSale') : t('sales.saveSale')}</button>
          </div>
        </form>
      </Dialog>

      {/* ── Sales Table Card ── */}
      <div className="card">

        {/* Header: title + pill filters on left, export on right */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('sales.recentSales')}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all'
                  ? 'bg-blue-50 border border-blue-500 text-blue-500 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('sales.allStatuses')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('paid')}
                className={statusFilter === 'paid'
                  ? 'bg-emerald-50 border border-emerald-500 text-emerald-600 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('sales.paid')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('due')}
                className={statusFilter === 'due'
                  ? 'bg-rose-50 border border-rose-500 text-rose-600 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('sales.due')}
              </button>
            </div>
          </div>
          <button className="btn-ghost" type="button" onClick={exportCsv}>{t('sales.exportCsv')}</button>
        </div>

        {/* ── Mobile card view ── */}
        <div className="mt-4 md:hidden space-y-3">
          {salesLoading && salesList.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : pagedSales.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('sales.noSales')}</p>
          ) : (
            pagedSales.map((sale) => {
              const customerName = getCustomerName(sale);
              const due = Number(sale.dueAmount || 0);
              return (
                <div key={sale.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {sale.invoiceNo || sale.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(sale.saleDate)}</p>
                      <p className="mt-1 text-xs text-slate-500 truncate">{customerName || '—'}</p>
                      <p className="mt-1 text-xs text-slate-400 truncate">Created By: {getCreatorDisplayName(sale)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={sale.status} />
                      <p className="mt-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.grandTotal || 0).toFixed(2) })}
                      </p>
                      {due > 0 ? (
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          {t('currency.formatted', { symbol: t('currency.symbol'), amount: due.toFixed(2) })} due
                        </span>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-200/50 pt-2.5 dark:border-slate-700/40">
                    <button
                      type="button"
                      title={t('common.edit')}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      onClick={() => openEdit(sale.id)}
                    >
                      <Pencil size={14} />
                    </button>
                    <Link
                      title={t('common.view')}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800"
                      to={`/app/invoice/sales/${sale.id}`}
                    >
                      <FileText size={14} />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop table ── */}
        <div className="mt-4 overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4 text-left">{t('common.invoice')}</th>
                <th className="py-2 pr-4 text-left">{t('common.date')}</th>
                <th className="py-2 pr-4 text-left">{t('common.status')}</th>
                <th className="py-2 pr-4 text-left">{t('sales.customer')}</th>
                <th className="py-2 pr-4 text-right">{t('common.total')}</th>
                <th className="py-2 pr-4 text-right">{t('sales.totalReceived')}</th>
                <th className="py-2 pr-4 text-right">{t('sales.due')}</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesLoading && salesList.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('common.loading')}</td></tr>
              ) : pagedSales.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('sales.noSales')}</td></tr>
              ) : (
                pagedSales.map((sale) => {
                  const customerName = getCustomerName(sale);
                  const due = Number(sale.dueAmount || 0);
                  return (
                    <tr key={sale.id} className="border-t border-slate-200/70 dark:border-slate-800/70">

                      {/* Invoice No */}
                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                        {sale.invoiceNo || sale.id.slice(0, 8)}
                      </td>

                      {/* Date — formatted like Services "22 Mar" */}
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        {formatDate(sale.saleDate)}
                      </td>

                      {/* Status — colored badge */}
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={sale.status} />
                      </td>

                      {/* Customer — resolved through full fallback chain */}
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        <div>{customerName || <span className="text-slate-400">—</span>}</div>
                        <div className="text-xs text-slate-400">Created By: {getCreatorDisplayName(sale)}</div>
                      </td>

                      {/* Grand total */}
                      <td className="py-2.5 pr-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.grandTotal || 0).toFixed(2) })}
                      </td>

                      {/* Amount received */}
                      <td className="py-2.5 pr-4 text-right text-emerald-700 dark:text-emerald-400">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(sale.amountReceived || 0).toFixed(2) })}
                      </td>

                      {/* Due — rose pill or green "Paid" exactly like Services */}
                      <td className="py-2.5 pr-4 text-right">
                        {due > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: due.toFixed(2) })} due
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
                        )}
                      </td>

                      {/* Actions — icon buttons matching Services exactly */}
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title={t('common.edit')}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                            onClick={() => openEdit(sale.id)}
                          >
                            <Pencil size={14} />
                          </button>
                          <Link
                            title={t('common.view')}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800"
                            to={`/app/invoice/sales/${sale.id}`}
                          >
                            <FileText size={14} />
                          </Link>
                        </div>
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
          total={totalSales}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}
