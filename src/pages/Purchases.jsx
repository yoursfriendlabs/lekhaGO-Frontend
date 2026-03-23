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
import { useProductStore } from '../stores/products';
import { usePartyStore } from '../stores/parties';
import { usePurchaseStore } from '../stores/purchases';

// ── Status badge matching Sales/Services design ──
function StatusBadge({ status }) {
  const map = {
    received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ordered:  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    due:      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

// ── Format date like Sales: "22 Mar" ──
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── Resolve supplier name from purchase object ──
function getSupplierName(purchase) {
  return (
    purchase.partyName ||
    purchase.supplierName ||
    purchase.Party?.name ||
    purchase.Supplier?.name ||
    null
  );
}

const emptyPurchaseItem = {
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0',
  itemType: 'part',
  description: '',
};

const emptyExpenseItem = {
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0',
  itemType: 'expense',
  description: '',
};

const getEmptyItem = (entryType) => (entryType === 'expense' ? { ...emptyExpenseItem } : { ...emptyPurchaseItem });

export default function Purchases() {
  const { t } = useI18n();
  const { businessId } = useAuth();

  // ── Stores ──
  const { products, fetch: fetchProducts } = useProductStore();
  const { parties, fetch: fetchParties } = usePartyStore();
  const { purchases: purchaseList, loading: purchasesLoading, fetch: fetchPurchases, invalidate: invalidatePurchases } = usePurchaseStore();

  // ── Derived: suppliers ──
  const suppliers = useMemo(() => parties.filter((p) => p.type === 'supplier'), [parties]);

  // ── UI state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [header, setHeader] = useState({
    entryType: 'purchase',
    partyId: '',
    partyName: '',
    invoiceNo: '',
    purchaseDate: new Date().toISOString().slice(0, 10),
    status: 'received',
    notes: '',
    amountReceived: '0',
  });
  const [items, setItems] = useState([getEmptyItem('purchase')]);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isExpense = header.entryType === 'expense';

  // ── Load shared data (cached) ──
  useEffect(() => {
    fetchProducts();
    fetchParties();
  }, []);

  // ── Load purchases list (page-specific) ──
  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 50 };
    if (statusFilter !== 'all') params.status = statusFilter;
    fetchPurchases(params, true);
  }, [businessId, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const taxTotal = items.reduce(
      (sum, item) => sum + (Number(item.lineTotal || 0) * Number(item.taxRate || 0)) / 100,
      0
    );
    return { subTotal, taxTotal, grandTotal: subTotal + taxTotal };
  }, [items]);

  const expenseTotals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const amount = Number(item.lineTotal || 0);
        if (item.itemType === 'labor') acc.labor += amount;
        else if (item.itemType === 'part') acc.part += amount;
        else acc.expense += amount;
        return acc;
      },
      { expense: 0, labor: 0, part: 0 }
    );
  }, [items]);

  const totalPaid = Number(header.amountReceived || 0);
  const dueAmount = Math.max(totals.grandTotal - totalPaid, 0);

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleEntryTypeChange = (event) => {
    const value = event.target.value;
    setHeader((prev) => ({
      ...prev,
      entryType: value,
      partyId: value === 'expense' ? '' : prev.partyId,
      partyName: value === 'expense' ? prev.partyName : '',
    }));
    setItems([getEmptyItem(value)]);
    setDeletedItemIds([]);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'itemType' && value !== 'part') next.productId = '';
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
          const primaryPrice = Number(product.purchasePrice || 0);
          if (conversionRate > 0 && primaryPrice > 0) {
            next.unitPrice = String((primaryPrice / conversionRate).toFixed(4));
          }
        }
      } else if (next.unitType === 'primary' && Number(product.purchasePrice || 0) > 0) {
        next.unitPrice = String(product.purchasePrice || 0);
      }
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, getEmptyItem(header.entryType)]);
  const removeItem = (index) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.id) setDeletedItemIds((ids) => [...ids, target.id]);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const totalPurchases = purchaseList.length;
  const pagedPurchases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return purchaseList.slice(start, start + pageSize);
  }, [page, pageSize, purchaseList]);

  const resetForm = () => {
    setHeader({ entryType: 'purchase', partyId: '', partyName: '', invoiceNo: '', purchaseDate: new Date().toISOString().slice(0, 10), status: 'received', notes: '', amountReceived: '0' });
    setItems([getEmptyItem('purchase')]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };

  const openEdit = async (purchaseId) => {
    try {
      const purchase = await api.getPurchase(purchaseId);
      const purchaseItems = purchase?.PurchaseItems || [];
      const entryType = purchase.entryType || purchase.type || 'purchase';
      setHeader({
        entryType,
        partyId: purchase.partyId || purchase.supplierId || '',
        partyName: purchase.partyName || purchase.supplierName || '',
        invoiceNo: purchase.invoiceNo || '',
        purchaseDate: purchase.purchaseDate || '',
        status: purchase.status || 'received',
        notes: purchase.notes || '',
        amountReceived: String(purchase.amountReceived ?? 0),
      });
      const mappedItems = purchaseItems.map((item) => ({
        id: item.id,
        productId: item.productId || '',
        quantity: String(item.quantity ?? '1'),
        unitType: item.unitType || 'primary',
        unitPrice: String(item.unitPrice ?? '0'),
        taxRate: String(item.taxRate ?? '0'),
        lineTotal: String(item.lineTotal ?? '0'),
        itemType: item.itemType || (entryType === 'expense' ? 'expense' : 'part'),
        description: item.description || '',
      }));
      setItems(mappedItems.length ? mappedItems : [getEmptyItem(entryType)]);
      setDeletedItemIds([]);
      setEditingId(purchaseId);
      setFormMode('edit');
      setIsOpen(true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!businessId) { setStatus({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.purchaseDate) { setStatus({ type: 'error', message: t('errors.purchaseDateRequired') }); return; }
    if (header.entryType === 'expense') {
      const payee = header.partyId || header.partyName?.trim();
      if (!payee) { setStatus({ type: 'error', message: t('errors.payeeRequired') }); return; }
      const validItem = items.find((item) => Number(item.lineTotal || 0) > 0);
      if (!validItem) { setStatus({ type: 'error', message: t('errors.expenseLineRequired') }); return; }
      const invalidPart = items.find((item) => item.itemType === 'part' && !item.productId);
      if (invalidPart) { setStatus({ type: 'error', message: t('errors.selectProductPart') }); return; }
    } else {
      const invalidItem = items.find((item) => !item.productId);
      if (invalidItem) { setStatus({ type: 'error', message: t('errors.selectProductPurchase') }); return; }
    }
    const invalidConversion = items.find((item) => {
      if (!item.productId || item.unitType !== 'secondary') return false;
      return Number(getProductById(item.productId)?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) { setStatus({ type: 'error', message: t('errors.conversionRequired') }); return; }

    try {
      const payload = {
        ...header,
        partyId: header.partyId || null,
        partyName: header.entryType === 'expense' ? header.partyName || null : null,
        amountReceived: totalPaid,
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
            itemType: item.itemType || (header.entryType === 'expense' ? 'expense' : 'part'),
            description: item.description || '',
          })),
          ...deletedItemIds.map((id) => ({ id, _delete: true })),
        ],
      };
      if (formMode === 'edit' && editingId) {
        await api.updatePurchase(editingId, payload);
        setStatus({ type: 'success', message: t('purchases.messages.updated') });
      } else {
        await api.createPurchase(payload);
        setStatus({ type: 'success', message: t('purchases.messages.created') });
      }
      resetForm();
      setIsOpen(false);
      invalidatePurchases();
      const params = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      fetchPurchases(params, true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        action={<button className="btn-primary" type="button" onClick={openCreate}>{t('purchases.newPurchase')}</button>}
      />
      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      <Dialog isOpen={isOpen} onClose={() => setIsOpen(false)} title={formMode === 'edit' ? t('purchases.editPurchase') : t('purchases.newPurchase')} size="full">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">{t('purchases.entryType')}</label>
              <select className="input mt-1" name="entryType" value={header.entryType} onChange={handleEntryTypeChange}>
                <option value="purchase">{t('purchases.purchase')}</option>
                <option value="expense">{t('purchases.expense')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('purchases.supplier')}</label>
              <select className="input mt-1" name="partyId" value={header.partyId} onChange={handleHeaderChange}>
                <option value="">{t('purchases.selectSupplier')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">{t('purchases.supplierOptional')}</p>
            </div>
            <div>
              <label className="label">{t('purchases.invoiceNo')}</label>
              <input className="input mt-1" name="invoiceNo" value={header.invoiceNo} onChange={handleHeaderChange} />
            </div>
            <div>
              <label className="label">{t('purchases.purchaseDate')}</label>
              <input type="date" className="input mt-1" name="purchaseDate" value={header.purchaseDate} onChange={handleHeaderChange} />
            </div>
            <div>
              <label className="label">{t('purchases.status')}</label>
              <select className="input mt-1" name="status" value={header.status} onChange={handleHeaderChange}>
                <option value="received">{t('purchases.received')}</option>
                <option value="ordered">{t('purchases.ordered')}</option>
                <option value="due">{t('purchases.due')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('purchases.totalPaid')}</label>
              <input className="input mt-1" type="number" step="1" min="0" name="amountReceived" value={header.amountReceived} onChange={handleHeaderChange} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('purchases.notes')}</label>
              <input className="input mt-1" name="notes" value={header.notes} onChange={handleHeaderChange} />
            </div>
            {isExpense ? (
              <div className="md:col-span-2">
                <label className="label">{t('purchases.supplier')}</label>
                <input className="input mt-1" name="partyName" value={header.partyName} onChange={handleHeaderChange} placeholder={t('purchases.payeeHint')} />
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('purchases.items')}</h4>
            <button className="btn-ghost" type="button" onClick={addItem}>{isExpense ? t('purchases.addExpenseLine') : t('common.addItem')}</button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                {isExpense ? (
                  <div className="grid gap-3 md:grid-cols-6">
                    <div>
                      <label className="label">{t('purchases.expenseCategory')}</label>
                      <select className="input mt-1" value={item.itemType} onChange={(event) => handleItemChange(idx, 'itemType', event.target.value)}>
                        <option value="expense">{t('purchases.normalExpense')}</option>
                        <option value="labor">{t('purchases.labor')}</option>
                        <option value="part">{t('purchases.part')}</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.expenseDescription')}</label>
                      <input className="input mt-1" value={item.description} onChange={(event) => handleItemChange(idx, 'description', event.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.product')}</label>
                      <select className="input mt-1" value={item.productId} onChange={(event) => { handleItemChange(idx, 'productId', event.target.value); syncItemDefaults(idx, getProductById(event.target.value)); }} disabled={item.itemType !== 'part'}>
                        <option value="">{t('purchases.selectProduct')}</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}{product.companyName ? ` · ${product.companyName}` : ''}{product.primaryUnit ? ` · ${product.primaryUnit}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('purchases.qty')}</label>
                      <input className="input mt-1" type="number" step="1" min="0" value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                      <p className="mt-1 text-xs text-slate-500">{getUnitLabel(getProductById(item.productId), item.unitType)}</p>
                    </div>
                    <div>
                      <label className="label">{t('products.unitType')}</label>
                      <select className="input mt-1" value={item.unitType} onChange={(event) => { handleItemChange(idx, 'unitType', event.target.value); syncItemDefaults(idx, getProductById(item.productId)); }} disabled={item.itemType !== 'part'}>
                        <option value="primary">{t('products.primaryUnit')}</option>
                        <option value="secondary">{t('products.secondaryUnit')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('purchases.unitPrice')}</label>
                      <input className="input mt-1" type="number" step="0.01" value={item.unitPrice} onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.product')}</label>
                      <select className="input mt-1" value={item.productId} onChange={(event) => { handleItemChange(idx, 'productId', event.target.value); syncItemDefaults(idx, getProductById(event.target.value)); }} required={!isExpense}>
                        <option value="">{t('purchases.selectProduct')}</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}{product.companyName ? ` · ${product.companyName}` : ''}{product.primaryUnit ? ` · ${product.primaryUnit}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('purchases.qty')}</label>
                      <input className="input mt-1" type="number" step="1" min="0" value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                      <p className="mt-1 text-xs text-slate-500">{getUnitLabel(getProductById(item.productId), item.unitType)}</p>
                    </div>
                    <div>
                      <label className="label">{t('products.unitType')}</label>
                      <select className="input mt-1" value={item.unitType} onChange={(event) => { handleItemChange(idx, 'unitType', event.target.value); syncItemDefaults(idx, getProductById(item.productId)); }}>
                        <option value="primary">{t('products.primaryUnit')}</option>
                        <option value="secondary">{t('products.secondaryUnit')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('purchases.unitPrice')}</label>
                      <input className="input mt-1" type="number" step="0.01" value={item.unitPrice} onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)} />
                    </div>
                    <div>
                      <label className="label">{t('purchases.tax')}</label>
                      <input className="input mt-1" type="number" step="0.01" value={item.taxRate} onChange={(event) => handleItemChange(idx, 'taxRate', event.target.value)} />
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{t('common.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}</span>
                  {items.length > 1 ? (
                    <button className="btn-ghost" type="button" onClick={() => removeItem(idx)}>{t('common.remove')}</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="md:static sticky -mx-4 bottom-0 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/70 bg-white/95 p-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85 md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {isExpense ? (
                <>
                  <p>{t('purchases.normalExpense')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.expense.toFixed(2) })}</p>
                  <p>{t('purchases.labor')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.labor.toFixed(2) })}</p>
                  <p>{t('purchases.part')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.part.toFixed(2) })}</p>
                  <p className="font-semibold">{t('purchases.grandTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</p>
                </>
              ) : (
                <>
                  <p>{t('purchases.subTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.subTotal.toFixed(2) })}</p>
                  <p>{t('purchases.taxTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.taxTotal.toFixed(2) })}</p>
                  <p className="font-semibold">{t('purchases.grandTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</p>
                </>
              )}
              <p>{t('purchases.totalPaidLabel')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totalPaid.toFixed(2) })}</p>
              <p className="font-semibold text-rose-600 dark:text-rose-300">{t('purchases.dueLabel')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: dueAmount.toFixed(2) })}</p>
            </div>
            <div className="flex gap-2 w-full justify-end md:w-auto">
              <button className="btn-secondary" type="button" onClick={() => setIsOpen(false)}>{t('common.cancel')}</button>
              <button className="btn-primary" type="submit">{formMode === 'edit' ? t('purchases.updatePurchase') : t('purchases.savePurchase')}</button>
            </div>
          </div>
        </form>
      </Dialog>

      <div className="card">

        {/* Header: title + pill filters on left */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('purchases.recentPurchases')}</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all'
                  ? 'bg-blue-50 border border-blue-500 text-blue-500 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('purchases.allStatuses')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('received')}
                className={statusFilter === 'received'
                  ? 'bg-emerald-50 border border-emerald-500 text-emerald-600 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('purchases.received')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ordered')}
                className={statusFilter === 'ordered'
                  ? 'bg-amber-50 border border-amber-500 text-amber-600 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('purchases.ordered')}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('due')}
                className={statusFilter === 'due'
                  ? 'bg-rose-50 border border-rose-500 text-rose-600 px-2 py-0.5 rounded text-sm'
                  : 'border border-gray-300 rounded px-2 py-0.5 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400'}
              >
                {t('purchases.due')}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile card view ── */}
        <div className="mt-4 md:hidden space-y-3">
          {purchasesLoading && purchaseList.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : pagedPurchases.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('purchases.noPurchases')}</p>
          ) : (
            pagedPurchases.map((p) => {
              const supplierName = getSupplierName(p);
              const due = Number(p.dueAmount || 0);
              return (
                <div key={p.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {p.invoiceNo || p.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(p.purchaseDate)}</p>
                      <p className="mt-1 text-xs text-slate-500 truncate">{supplierName || '—'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={p.status} />
                      <p className="mt-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(p.grandTotal || 0).toFixed(2) })}
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
                      onClick={() => openEdit(p.id)}
                    >
                      <Pencil size={14} />
                    </button>
                    <Link
                      title={t('common.view')}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800"
                      to={`/app/invoice/purchases/${p.id}`}
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
                <th className="py-2 pr-4 text-left">{t('purchases.supplier')}</th>
                <th className="py-2 pr-4 text-right">{t('common.total')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.totalPaid')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.dueLabel')}</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading && purchaseList.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('common.loading')}</td></tr>
              ) : pagedPurchases.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('purchases.noPurchases')}</td></tr>
              ) : (
                pagedPurchases.map((purchase) => {
                  const supplierName = getSupplierName(purchase);
                  const due = Number(purchase.dueAmount || 0);
                  return (
                    <tr key={purchase.id} className="border-t border-slate-200/70 dark:border-slate-800/70">

                      {/* Invoice No */}
                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                        {purchase.invoiceNo || purchase.id.slice(0, 8)}
                      </td>

                      {/* Date — formatted like Sales "22 Mar" */}
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        {formatDate(purchase.purchaseDate)}
                      </td>

                      {/* Status — colored badge */}
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={purchase.status} />
                      </td>

                      {/* Supplier */}
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        {supplierName || <span className="text-slate-400">—</span>}
                      </td>

                      {/* Grand total */}
                      <td className="py-2.5 pr-4 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(purchase.grandTotal || 0).toFixed(2) })}
                      </td>

                      {/* Amount received */}
                      <td className="py-2.5 pr-4 text-right text-emerald-700 dark:text-emerald-400">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(purchase.amountReceived || 0).toFixed(2) })}
                      </td>

                      {/* Due — rose pill or green "Paid" exactly like Sales */}
                      <td className="py-2.5 pr-4 text-right">
                        {due > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: due.toFixed(2) })} due
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
                        )}
                      </td>

                      {/* Actions — icon buttons matching Sales exactly */}
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title={t('common.edit')}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                            onClick={() => openEdit(purchase.id)}
                          >
                            <Pencil size={14} />
                          </button>
                          <Link
                            title={t('common.view')}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800"
                            to={`/app/invoice/purchases/${purchase.id}`}
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
          total={totalPurchases}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </div>
  );
}
