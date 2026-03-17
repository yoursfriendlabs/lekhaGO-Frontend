import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';

const emptyPurchaseItem = {
  productId: '',
  batchId: '',
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
  batchId: '',
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
  const [products, setProducts] = useState([]);
  const [batchesByProduct, setBatchesByProduct] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseList, setPurchaseList] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [header, setHeader] = useState({
    entryType: 'purchase',
    supplierId: '',
    supplierName: '',
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

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => null);
    api.listParties({ type: 'supplier' }).then(setSuppliers).catch(() => null);
  }, []);

  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 25 };
    if (statusFilter !== 'all') params.status = statusFilter;
    api.listPurchases(params).then(setPurchaseList).catch(() => null);
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
      supplierId: value === 'expense' ? '' : prev.supplierId,
      supplierName: value === 'expense' ? prev.supplierName : '',
    }));
    setItems([getEmptyItem(value)]);
    setDeletedItemIds([]);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'productId') next.batchId = '';
        if (field === 'itemType' && value !== 'part') {
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
      const quantity = Number(next.quantity || 0);
      const unitPrice = Number(next.unitPrice || 0);
      next.lineTotal = (quantity * unitPrice).toFixed(2);
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, getEmptyItem(header.entryType)]);
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
        t('purchases.entryType'),
        t('purchases.supplier'),
        t('purchases.subTotal'),
        t('purchases.taxTotal'),
        t('purchases.grandTotal'),
        t('purchases.totalPaid'),
        t('purchases.dueLabel'),
      ],
      ...purchaseList.map((p) => [
        p.invoiceNo || p.id,
        p.purchaseDate || '',
        p.status || '',
        p.entryType || p.type || 'purchase',
        p.Supplier?.name || p.supplierName || p.supplierId || '',
        Number(p.subTotal || 0).toFixed(2),
        Number(p.taxTotal || 0).toFixed(2),
        Number(p.grandTotal || 0).toFixed(2),
        Number(p.amountReceived || 0).toFixed(2),
        Number(p.dueAmount || 0).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/\"/g, '""')}"`).join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchases-${statusFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalPurchases = purchaseList.length;
  const pagedPurchases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return purchaseList.slice(start, start + pageSize);
  }, [page, pageSize, purchaseList]);

  const resetForm = () => {
    setHeader({
      entryType: 'purchase',
      supplierId: '',
      supplierName: '',
      invoiceNo: '',
      purchaseDate: new Date().toISOString().slice(0, 10),
      status: 'received',
      notes: '',
      amountReceived: '0',
    });
    setItems([getEmptyItem('purchase')]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
  };

  const openCreate = () => {
    resetForm();
    setIsOpen(true);
  };

  const openEdit = async (purchaseId) => {
    try {
      const purchase = await api.getPurchase(purchaseId);
      const purchaseItems = purchase?.PurchaseItems || [];
      purchaseItems.forEach((item) => {
        if (item.productId) ensureBatches(item.productId);
      });
      const entryType = purchase.entryType || purchase.type || 'purchase';
      setHeader({
        entryType,
        supplierId: purchase.supplierId || '',
        supplierName: purchase.supplierName || '',
        invoiceNo: purchase.invoiceNo || '',
        purchaseDate: purchase.purchaseDate || '',
        status: purchase.status || 'received',
        notes: purchase.notes || '',
        amountReceived: String(purchase.amountReceived ?? 0),
      });
      const mappedItems = purchaseItems.map((item) => ({
        id: item.id,
        productId: item.productId || '',
        batchId: item.batchId || '',
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
    if (!businessId) {
      setStatus({ type: 'error', message: t('errors.businessIdRequired') });
      return;
    }
    if (!header.purchaseDate) {
      setStatus({ type: 'error', message: t('errors.purchaseDateRequired') });
      return;
    }
    if (header.entryType === 'expense') {
      const payee = header.supplierId || header.supplierName?.trim();
      if (!payee) {
        setStatus({ type: 'error', message: t('errors.payeeRequired') });
        return;
      }
      const validItem = items.find((item) => Number(item.lineTotal || 0) > 0);
      if (!validItem) {
        setStatus({ type: 'error', message: t('errors.expenseLineRequired') });
        return;
      }
      const invalidPart = items.find((item) => item.itemType === 'part' && !item.productId);
      if (invalidPart) {
        setStatus({ type: 'error', message: t('errors.selectProductPart') });
        return;
      }
    } else {
      const invalidItem = items.find((item) => !item.productId);
      if (invalidItem) {
        setStatus({ type: 'error', message: t('errors.selectProductPurchase') });
        return;
      }
    }
    const invalidConversion = items.find((item) => {
      if (!item.productId) return false;
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
        supplierId: header.supplierId || null,
        supplierName: header.entryType === 'expense' ? header.supplierName || null : null,
        amountReceived: totalPaid,
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
      const params = { limit: 25 };
      if (statusFilter !== 'all') params.status = statusFilter;
      api.listPurchases(params).then(setPurchaseList).catch(() => null);
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
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={formMode === 'edit' ? t('purchases.editPurchase') : t('purchases.newPurchase')}
        size="full"
      >
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
              <select className="input mt-1" name="supplierId" value={header.supplierId} onChange={handleHeaderChange}>
                <option value="">{t('purchases.selectSupplier')}</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
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
              <input
                type="date"
                className="input mt-1"
                name="purchaseDate"
                value={header.purchaseDate}
                onChange={handleHeaderChange}
              />
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
              <label className="label">{t('purchases.notes')}</label>
              <input className="input mt-1" name="notes" value={header.notes} onChange={handleHeaderChange} />
            </div>
            {isExpense ? (
              <div className="md:col-span-2">
                <label className="label">{t('purchases.supplier')}</label>
                <input
                  className="input mt-1"
                  name="supplierName"
                  value={header.supplierName}
                  onChange={handleHeaderChange}
                  placeholder={t('purchases.payeeHint')}
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t('purchases.items')}</h4>
            <button className="btn-ghost" type="button" onClick={addItem}>
              {isExpense ? t('purchases.addExpenseLine') : t('common.addItem')}
            </button>
          </div>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                {isExpense ? (
                  <div className="grid gap-3 md:grid-cols-6">
                    <div>
                      <label className="label">{t('purchases.expenseCategory')}</label>
                      <select
                        className="input mt-1"
                        value={item.itemType}
                        onChange={(event) => handleItemChange(idx, 'itemType', event.target.value)}
                      >
                        <option value="expense">{t('purchases.normalExpense')}</option>
                        <option value="labor">{t('purchases.labor')}</option>
                        <option value="part">{t('purchases.part')}</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.expenseDescription')}</label>
                      <input
                        className="input mt-1"
                        value={item.description}
                        onChange={(event) => handleItemChange(idx, 'description', event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.product')}</label>
                      <select
                        className="input mt-1"
                        value={item.productId}
                        onChange={(event) => {
                          handleItemChange(idx, 'productId', event.target.value);
                          syncItemDefaults(idx, getProductById(event.target.value));
                        }}
                        disabled={item.itemType !== 'part'}
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
                      <label className="label">{t('purchases.qty')}</label>
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
                        disabled={item.itemType !== 'part'}
                      >
                        <option value="primary">{t('products.primaryUnit')}</option>
                        <option value="secondary">{t('products.secondaryUnit')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">{t('purchases.unitPrice')}</label>
                      <input
                        className="input mt-1"
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">{t('purchases.batch')}</label>
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
                ) : (
                  <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className="label">{t('purchases.product')}</label>
                      <select
                        className="input mt-1"
                        value={item.productId}
                        onChange={(event) => {
                          handleItemChange(idx, 'productId', event.target.value);
                          syncItemDefaults(idx, getProductById(event.target.value));
                        }}
                        required={!isExpense}
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
                      <label className="label">{t('purchases.batch')}</label>
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
                      <label className="label">{t('purchases.qty')}</label>
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
                      <label className="label">{t('purchases.unitPrice')}</label>
                      <input
                        className="input mt-1"
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => handleItemChange(idx, 'unitPrice', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">{t('purchases.tax')}</label>
                      <input
                        className="input mt-1"
                        type="number"
                        step="0.01"
                        value={item.taxRate}
                        onChange={(event) => handleItemChange(idx, 'taxRate', event.target.value)}
                      />
                    </div>
                  </div>
                )}
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
              <p className="font-semibold text-rose-600 dark:text-rose-300">
                {t('purchases.dueLabel')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: dueAmount.toFixed(2) })}
              </p>
            </div>
            <div className="flex gap-2 w-full justify-end md:w-auto">
              <button className="btn-secondary" type="button" onClick={() => setIsOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn-primary" type="submit">
                {formMode === 'edit' ? t('purchases.updatePurchase') : t('purchases.savePurchase')}
              </button>
            </div>
          </div>
        </form>
      </Dialog>


      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('purchases.recentPurchases')}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('purchases.allStatuses')}</option>
              <option value="received">{t('purchases.received')}</option>
              <option value="ordered">{t('purchases.ordered')}</option>
              <option value="due">{t('purchases.due')}</option>
            </select>
            <button className="btn-ghost" type="button" onClick={exportCsv}>{t('purchases.exportCsv')}</button>
          </div>
        </div>
        {/* Card list on small screens */}
        <div className="mt-4 md:hidden">
          <div className="space-y-3">
            {pagedPurchases.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{p.invoiceNo || p.id}</p>
                    <p className="text-xs text-slate-500">{p.purchaseDate || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t('purchases.supplier')}: {p.Supplier?.name || p.supplierName || p.supplierId || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      p.status === 'received' ? 'bg-emerald-100 text-emerald-700' : p.status === 'ordered' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    }`}>{p.status}</span>
                    <p className="mt-2 font-semibold">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(p.grandTotal || 0).toFixed(2) })}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Link className="btn-ghost" to={`/app/invoice/purchases/${p.id}`}>{t('common.invoice')}</Link>
                  <button className="btn-ghost" type="button" onClick={() => openEdit(p.id)}>{t('common.edit')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Table on md+ */}
        <div className="mt-4 overflow-x-auto hidden md:block">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('common.invoice')}</th>
                <th className="py-2 text-left">{t('common.date')}</th>
                <th className="py-2 text-left">{t('common.status')}</th>
                <th className="py-2 text-left">{t('purchases.supplier')}</th>
                <th className="py-2 text-right">{t('common.total')}</th>
                <th className="py-2 text-right">{t('purchases.totalPaid')}</th>
                <th className="py-2 text-right">{t('purchases.dueLabel')}</th>
                <th className="py-2 text-right">{t('common.invoice')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedPurchases.length === 0 ? (
                <tr><td colSpan={8} className="py-3 text-slate-500">{t('purchases.noPurchases')}</td></tr>
              ) : (
                pagedPurchases.map((purchase) => (
                  <tr key={purchase.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{purchase.invoiceNo || purchase.id.slice(0, 6)}</td>
                    <td className="py-2">{purchase.purchaseDate}</td>
                    <td className="py-2 capitalize">{purchase.status}</td>
                    <td className="py-2">{purchase.Supplier?.name || purchase.supplierName || purchase.supplierId || '—'}</td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(purchase.grandTotal || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(purchase.amountReceived || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-300">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(purchase.dueAmount || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button className="text-slate-600 hover:text-slate-900" type="button" onClick={() => openEdit(purchase.id)}>
                          {t('common.edit')}
                        </button>
                        <Link className="text-emerald-600 hover:text-emerald-500 dark:text-ocean dark:hover:text-teal-300" to={`/app/invoice/purchases/${purchase.id}`}>
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
          total={totalPurchases}
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
