import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, FileText, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import MobileFormStepper from '../components/MobileFormStepper.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { usePurchaseStore } from '../stores/purchases';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  mergeLookupEntities,
  normalizeLookupParty,
  normalizeLookupProduct,
  toPartyLookupOption,
  toProductLookupOption,
} from '../lib/lookups.js';

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
  return formatMaybeDate(dateStr, 'D MMM');
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
  const isMobile = useIsMobile();

  // ── Stores ──
  const { purchases: purchaseList, loading: purchasesLoading, fetch: fetchPurchases, invalidate: invalidatePurchases } = usePurchaseStore();
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');
  const [productDirectory, setProductDirectory] = useState({});
  const [supplierOption, setSupplierOption] = useState(null);

  // ── UI state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [isPaid, setIsPaid] = useState(false);
  const [header, setHeader] = useState({
    entryType: 'purchase',
    partyId: '',
    partyName: '',
    invoiceNo: '',
    purchaseDate: todayISODate(),
    status: 'received',
    notes: '',
    amountReceived: '0',
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
  });
  const [items, setItems] = useState([getEmptyItem('purchase')]);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mobileStep, setMobileStep] = useState('details');

  const isExpense = header.entryType === 'expense';

  // ── Load purchases list (page-specific) ──
  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 50 };
    if (statusFilter !== 'all') params.status = statusFilter;
    fetchPurchases(params);
  }, [businessId, fetchPurchases, statusFilter]);

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

  const paidAmount = useMemo(() => (
    isPaid
      ? totals.grandTotal
      : Math.min(Number(header.amountReceived || 0), totals.grandTotal)
  ), [header.amountReceived, isPaid, totals.grandTotal]);
  const dueAmount = Math.max(totals.grandTotal - paidAmount, 0);
  const purchaseSteps = useMemo(() => ([
    { id: 'details', label: t('common.details') },
    { id: 'items', label: t('purchases.items') },
    { id: 'payment', label: t('common.payment') },
  ]), [t]);

  useEffect(() => {
    if (!isPaid) return;
    setHeader((prev) => ({
      ...prev,
      amountReceived: totals.grandTotal.toFixed(2),
      status: prev.status === 'due' ? 'received' : prev.status,
    }));
  }, [isPaid, totals.grandTotal]);

  useEffect(() => {
    if (isPaid) return;
    if (header.status === 'ordered') return;
    if (dueAmount > 0 && header.status === 'received') {
      setHeader((prev) => ({ ...prev, status: 'due' }));
    } else if (dueAmount === 0 && header.status === 'due') {
      setHeader((prev) => ({ ...prev, status: 'received' }));
    }
  }, [dueAmount, header.status, isPaid]);

  const handleHeaderChange = (event) => {
    const { name, value } = event.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleEntryTypeChange = (event) => {
    const value = event.target.value;
    if (value === 'expense') {
      setSupplierOption(null);
    }
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

  const getProductById = (id) => {
    if (id === null || id === undefined || id === '') return null;
    return productDirectory[String(id)] || null;
  };

  const cacheProducts = (entries) => {
    setProductDirectory((previous) => mergeLookupEntities(previous, entries));
  };

  const loadSupplierOptions = async (search) => {
    const data = await api.lookupParties({ search, type: 'supplier', limit: 10 });
    return (data?.items || []).map(toPartyLookupOption);
  };

  const loadProductOptions = async (search) => {
    const data = await api.lookupProducts({ search, limit: 10 });
    const normalized = (data?.items || []).map(normalizeLookupProduct);
    cacheProducts(normalized);
    return normalized.map(toProductLookupOption);
  };

  const handleSupplierChange = (option) => {
    setSupplierOption(option || null);
    setHeader((previous) => ({ ...previous, partyId: option?.value || '' }));
  };

  const handleProductSelection = (index, option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;

    if (product?.id) {
      cacheProducts([product]);
    }

    handleItemChange(index, 'productId', option?.value || '');

    if (product) {
      syncItemDefaults(index, product);
    }
  };

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
    setHeader({
      entryType: 'purchase',
      partyId: '',
      partyName: '',
      invoiceNo: '',
      purchaseDate: todayISODate(),
      status: 'received',
      notes: '',
      amountReceived: '0',
      paymentMethod: 'cash',
      bankId: '',
      paymentNote: '',
    });
    setItems([getEmptyItem('purchase')]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
    setIsPaid(false);
    setSuggestedInvoiceNo('');
    setMobileStep('details');
    setProductDirectory({});
    setSupplierOption(null);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setMobileStep('details');
  };

  const openCreate = async () => {
    resetForm();
    setIsOpen(true);

    if (businessId) {
      try {
        const data = await api.getNextSequences();
        setSuggestedInvoiceNo(data?.nextPurchaseInvoiceNo || '');
      } catch {
        setSuggestedInvoiceNo('');
      }
    }
  };

  const openEdit = async (purchaseId) => {
    try {
      const purchase = await api.getPurchase(purchaseId);
      const purchaseItems = purchase?.PurchaseItems || [];
      const entryType = purchase.entryType || purchase.type || 'purchase';
      const party = normalizeLookupParty({
        id: purchase.partyId || purchase.supplierId || purchase.Party?.id || purchase.Supplier?.id,
        partyName: purchase.partyName || purchase.supplierName || purchase.Party?.name || purchase.Supplier?.name,
        phone: purchase.partyPhone || purchase.Party?.phone || purchase.Supplier?.phone,
        currentAmount: purchase.Party?.currentAmount || purchase.Supplier?.currentAmount,
        type: 'supplier',
      });
      const hydratedProducts = purchaseItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);
      setHeader({
        entryType,
        partyId: purchase.partyId || purchase.supplierId || '',
        partyName: purchase.partyName || purchase.supplierName || '',
        invoiceNo: purchase.invoiceNo || '',
        purchaseDate: purchase.purchaseDate || '',
        status: purchase.status || 'received',
        notes: purchase.notes || '',
        amountReceived: String(purchase.amountReceived ?? 0),
        ...normalizePaymentFields(purchase),
      });
      cacheProducts(hydratedProducts);
      setSupplierOption(party.id ? toPartyLookupOption(party) : null);
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
      setSuggestedInvoiceNo(purchase.invoiceNo || '');
      const computedDue = Number(purchase.dueAmount ?? Math.max(Number(purchase.grandTotal || 0) - Number(purchase.amountReceived || 0), 0));
      setIsPaid(computedDue <= 0 && String(purchase.status || '').toLowerCase() !== 'ordered');
      setMobileStep('details');
      setIsOpen(true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const currentStepIndex = purchaseSteps.findIndex((step) => step.id === mobileStep);
  const showDetailsStep = !isMobile || mobileStep === 'details';
  const showItemsStep = !isMobile || mobileStep === 'items';
  const showPaymentStep = !isMobile || mobileStep === 'payment';

  const goToNextMobileStep = () => {
    if (!isMobile) return;
    const nextStep = purchaseSteps[currentStepIndex + 1];
    if (nextStep) setMobileStep(nextStep.id);
  };

  const goToPrevMobileStep = () => {
    if (!isMobile) return;
    const previousStep = purchaseSteps[currentStepIndex - 1];
    if (previousStep) setMobileStep(previousStep.id);
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
    if (requiresBankSelection(header, paidAmount)) {
      setStatus({ type: 'error', message: t('payments.bankRequired') });
      return;
    }

    try {
      const manualInvoiceNo = String(header.invoiceNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const payload = {
        ...headerFields,
        partyId: header.partyId || null,
        partyName: header.entryType === 'expense' ? header.partyName || null : null,
        amountReceived: paidAmount,
        ...(Number(paidAmount || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }),
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
      if (manualInvoiceNo) {
        payload.invoiceNo = manualInvoiceNo;
      } else {
        delete payload.invoiceNo;
      }
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
        action={<button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>{t('purchases.newPurchase')}</button>}
      />
      <Dialog isOpen={isOpen} onClose={closeDialog} title={formMode === 'edit' ? t('purchases.editPurchase') : t('purchases.newPurchase')} size="full">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {status.message ? <Notice title={status.message} tone={status.type} /> : null}
          {isMobile ? (
            <MobileFormStepper
              steps={purchaseSteps}
              currentStep={mobileStep}
              onStepChange={setMobileStep}
            />
          ) : null}

          {showDetailsStep ? (
            <FormSectionCard hint={t('purchases.supplierOptional')}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="label">{t('purchases.entryType')}</label>
                  <select className="input mt-1" name="entryType" value={header.entryType} onChange={handleEntryTypeChange}>
                    <option value="purchase">{t('purchases.purchase')}</option>
                    <option value="expense">{t('purchases.expense')}</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="label">{t('purchases.supplier')}</label>
                  <div className="mt-1">
                    <AsyncSearchableSelect
                      value={header.partyId}
                      selectedOption={supplierOption}
                      onChange={handleSupplierChange}
                      loadOptions={loadSupplierOptions}
                      placeholder={t('purchases.selectSupplier')}
                      searchPlaceholder={t('purchases.selectSupplier')}
                      noResultsLabel={t('common.noData')}
                      loadingLabel={t('common.loading')}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">{t('purchases.invoiceNo')}</label>
                  <input
                    className="input mt-1"
                    name="invoiceNo"
                    value={header.invoiceNo}
                    onChange={handleHeaderChange}
                    placeholder={formMode === 'create' ? suggestedInvoiceNo : ''}
                  />
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
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="label">{t('purchases.notes')}</label>
                  <input className="input mt-1" name="notes" value={header.notes} onChange={handleHeaderChange} />
                </div>
                {isExpense ? (
                  <div className="sm:col-span-2 lg:col-span-2">
                    <label className="label">{t('purchases.supplier')}</label>
                    <input className="input mt-1" name="partyName" value={header.partyName} onChange={handleHeaderChange} placeholder={t('purchases.payeeHint')} />
                  </div>
                ) : null}
              </div>
            </FormSectionCard>
          ) : null}

          {showItemsStep ? (
            <FormSectionCard
              title={t('purchases.items')}
              action={<button className="btn-ghost w-full sm:w-auto" type="button" onClick={addItem}>{isExpense ? t('purchases.addExpenseLine') : t('common.addItem')}</button>}
            >
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const product = getProductById(item.productId);
                  const itemHeading = isExpense
                    ? item.description || `${t('purchases.expenseDescription')} ${idx + 1}`
                    : product?.name || `${t('purchases.product')} ${idx + 1}`;

                  return (
                    <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/40">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{itemHeading}</p>
                          <p className="mt-1 text-sm text-slate-500">{t('common.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}</p>
                        </div>
                        {items.length > 1 ? (
                          <button className="btn-ghost w-full justify-center sm:w-auto" type="button" onClick={() => removeItem(idx)}>{t('common.remove')}</button>
                        ) : null}
                      </div>

                      {isExpense ? (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                          <div>
                            <label className="label">{t('purchases.expenseCategory')}</label>
                            <select className="input mt-1" value={item.itemType} onChange={(event) => handleItemChange(idx, 'itemType', event.target.value)}>
                              <option value="expense">{t('purchases.normalExpense')}</option>
                              <option value="labor">{t('purchases.labor')}</option>
                              <option value="part">{t('purchases.part')}</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2 xl:col-span-2">
                            <label className="label">{t('purchases.expenseDescription')}</label>
                            <input className="input mt-1" value={item.description} onChange={(event) => handleItemChange(idx, 'description', event.target.value)} />
                          </div>
                          <div className="sm:col-span-2 xl:col-span-2">
                            <label className="label">{t('purchases.product')}</label>
                            <AsyncSearchableSelect
                              className="mt-1"
                              value={item.productId}
                              selectedOption={product ? toProductLookupOption(product) : null}
                              onChange={(option) => handleProductSelection(idx, option)}
                              loadOptions={loadProductOptions}
                              placeholder={t('purchases.selectProduct')}
                              searchPlaceholder={t('purchases.selectProduct')}
                              noResultsLabel={t('common.noData')}
                              loadingLabel={t('common.loading')}
                              disabled={item.itemType !== 'part'}
                            />
                          </div>
                          <div>
                            <label className="label">{t('purchases.qty')}</label>
                            <input className="input mt-1" type="number" step="1" min="0" value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                            <p className="mt-1 text-xs text-slate-500">{getUnitLabel(product, item.unitType)}</p>
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
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                          <div className="sm:col-span-2 xl:col-span-2">
                            <label className="label">{t('purchases.product')}</label>
                            <AsyncSearchableSelect
                              className="mt-1"
                              value={item.productId}
                              selectedOption={product ? toProductLookupOption(product) : null}
                              onChange={(option) => handleProductSelection(idx, option)}
                              loadOptions={loadProductOptions}
                              placeholder={t('purchases.selectProduct')}
                              searchPlaceholder={t('purchases.selectProduct')}
                              noResultsLabel={t('common.noData')}
                              loadingLabel={t('common.loading')}
                            />
                          </div>
                          <div>
                            <label className="label">{t('purchases.qty')}</label>
                            <input className="input mt-1" type="number" step="1" min="0" value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                            <p className="mt-1 text-xs text-slate-500">{getUnitLabel(product, item.unitType)}</p>
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
                    </div>
                  );
                })}
              </div>
            </FormSectionCard>
          ) : null}

          {showPaymentStep ? (
            <FormSectionCard title={t('payments.summaryTitle')}>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                {isExpense ? (
                  <>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.normalExpense')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.expense.toFixed(2) })}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.labor')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.labor.toFixed(2) })}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.part')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t('currency.formatted', { symbol: t('currency.symbol'), amount: expenseTotals.part.toFixed(2) })}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.subTotal')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.subTotal.toFixed(2) })}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.taxTotal')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.taxTotal.toFixed(2) })}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('purchases.grandTotal')}</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</span>
                    </div>
                  </>
                )}
              </div>

              {isExpense ? (
                <div className="mt-3 flex justify-between border-t border-slate-200/70 pt-3 text-sm dark:border-slate-700/60">
                  <span className="font-medium text-slate-500">{t('purchases.grandTotal')}</span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.grandTotal.toFixed(2) })}</span>
                </div>
              ) : null}

              <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="label">{t('purchases.totalPaid')}</label>
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
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/40">
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
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 text-sm dark:border-rose-800/40 dark:bg-rose-900/20">
                    <span className="text-rose-500 dark:text-rose-400">{t('services.dueAmount')}:</span>
                    <span className="font-bold text-rose-700 dark:text-rose-300">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: dueAmount.toFixed(2) })}
                    </span>
                  </div>
                )}

                <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                  <PaymentMethodFields
                    value={header}
                    onChange={(patch) => setHeader((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              </div>
            </FormSectionCard>
          ) : null}

          <div className={`${isMobile ? 'mobile-sticky-actions' : ''} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}>
            {isMobile && mobileStep !== 'details' ? (
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={goToPrevMobileStep}>
                {t('common.back')}
              </button>
            ) : (
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>{t('common.cancel')}</button>
            )}

            {isMobile && mobileStep !== 'payment' ? (
              <button className="btn-primary w-full sm:w-auto" type="button" onClick={goToNextMobileStep}>
                {t('common.continue')}
              </button>
            ) : (
              <button className="btn-primary w-full sm:w-auto" type="submit">{formMode === 'edit' ? t('purchases.updatePurchase') : t('purchases.savePurchase')}</button>
            )}
          </div>
        </form>
      </Dialog>

      <div className="card">

        {/* Header: title + pill filters on left */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('purchases.recentPurchases')}</h3>
            <div className="flex flex-wrap gap-2">
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
                      <PaymentTypeSummary
                        source={p}
                        className="mt-1"
                        labelClassName="text-xs font-medium"
                        metaClassName="text-[11px]"
                      />
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
                <th className="py-2 pr-4 text-left">{t('common.payment')}</th>
                <th className="py-2 pr-4 text-right">{t('common.total')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.totalPaid')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.dueLabel')}</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading && purchaseList.length === 0 ? (
                <tr><td colSpan={9} className="py-3 text-slate-500">{t('common.loading')}</td></tr>
              ) : pagedPurchases.length === 0 ? (
                <tr><td colSpan={9} className="py-3 text-slate-500">{t('purchases.noPurchases')}</td></tr>
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

                      <td className="py-2.5 pr-4">
                        <PaymentTypeSummary source={purchase} />
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
