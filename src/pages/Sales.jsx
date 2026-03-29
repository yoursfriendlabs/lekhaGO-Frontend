import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, FileText, Plus } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import MobileFormStepper from '../components/MobileFormStepper.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import PartySearchCreateField from '../components/PartySearchCreateField.jsx';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import CreatorFilterSelect from '../components/CreatorFilterSelect.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';
import FileUpload from '../components/FileUpload';
import DynamicAttributes from '../components/DynamicAttributes';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { useSaleStore } from '../stores/sales';
import { useProductStore } from '../stores/products';
import { getCreatorDisplayName, getCurrentCreatorValue } from '../lib/records';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  mergeLookupEntities,
  normalizeLookupParty,
  normalizeLookupProduct,
  toProductLookupOption,
} from '../lib/lookups.js';

const emptyItem = {
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0'
};

function getVatAmount(lineTotal, taxRate) {
  return (Number(lineTotal || 0) * Number(taxRate || 0)) / 100;
}

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
  const isMobile = useIsMobile();

  // ── Stores ──
  const { sales: salesList, loading: salesLoading, fetch: fetchSales, invalidate: invalidateSales } = useSaleStore();
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');
  const [productDirectory, setProductDirectory] = useState({});
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [partyFilterId, setPartyFilterId] = useState('');
  const [selectedPartyFilterOption, setSelectedPartyFilterOption] = useState(null);
  const [createdByFilterId, setCreatedByFilterId] = useState('');

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
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
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
  const [mobileStep, setMobileStep] = useState('details');
  const listParams = useMemo(() => ({
    limit: 50,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(partyFilterId ? { partyId: partyFilterId } : {}),
    ...(createdByFilterId ? { createdBy: createdByFilterId } : {}),
  }), [createdByFilterId, partyFilterId, statusFilter]);

  // ── Load sales list ──
  useEffect(() => {
    if (!businessId) return;
    fetchSales(listParams);
  }, [businessId, fetchSales, listParams]);

  useEffect(() => {
    setPage(1);
  }, [createdByFilterId, partyFilterId, statusFilter]);

  const resolveCustomerName = (sale) => {
    const direct = getCustomerName(sale);
    if (direct) return direct;

    const id = sale?.partyId || sale?.customerId || sale?.Customer?.id || sale?.Party?.id || null;
    if (id === null || id === undefined || id === '') return t('sales.walkIn');

    return '—';
  };

  // ── Totals ──
  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const taxTotal = items.reduce(
      (sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate),
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
  const saleSteps = useMemo(() => ([
    { id: 'details', label: t('common.details') },
    { id: 'items', label: t('sales.items') },
    { id: 'payment', label: t('common.payment') },
  ]), [t]);

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

  const getProductById = (id) => {
    if (id === null || id === undefined || id === '') return null;
    return productDirectory[String(id)] || null;
  };

  const cacheProducts = (entries) => {
    setProductDirectory((previous) => mergeLookupEntities(previous, entries));
  };

  const loadProductOptions = async (search) => {
    const data = await api.lookupProducts({ search, limit: 10 });
    const normalized = (data?.items || []).map(normalizeLookupProduct);
    cacheProducts(normalized);
    return normalized.map(toProductLookupOption);
  };

  const handleCustomerSelect = (party) => {
    setSelectedCustomer(party || null);
    setHeader((previous) => ({ ...previous, partyId: party?.id || '' }));
  };

  const handlePartyFilterChange = (option) => {
    setPartyFilterId(option?.value || '');
    setSelectedPartyFilterOption(option || null);
  };

  const handleProductSelection = (index, option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;

    if (product?.id) {
      cacheProducts([product]);
      setItems((prev) => prev.map((item, idx) => (
        idx === index ? { ...item, taxRate: String(product.taxRate || 0) } : item
      )));
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
        resolveCustomerName(s) || '',
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
    setHeader({
      partyId: '',
      invoiceNo: '',
      saleDate: todayISODate(),
      status: 'paid',
      notes: '',
      amountReceived: '0',
      paymentMethod: 'cash',
      bankId: '',
      paymentNote: '',
      attachment: '',
      attributes: {},
    });
    setItems([{ ...emptyItem }]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
    setIsPaid(false);
    setSuggestedInvoiceNo('');
    setMobileStep('details');
    setProductDirectory({});
    setSelectedCustomer(null);
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
        setSuggestedInvoiceNo(data?.nextSaleInvoiceNo || '');
      } catch {
        setSuggestedInvoiceNo('');
      }
    }
  };

  const openEdit = async (saleId) => {
    try {
      const sale = await api.getSale(saleId);
      const saleItems = sale?.SaleItems || [];
      const party = normalizeLookupParty({
        id: sale.partyId || sale.customerId || sale.Customer?.id || sale.Party?.id,
        partyName: sale.partyName || sale.customerName || sale.Customer?.name || sale.Party?.name,
        phone: sale.partyPhone || sale.Customer?.phone || sale.Party?.phone,
        currentAmount: sale.Party?.currentAmount || sale.Customer?.currentAmount,
        type: 'customer',
      });
      const hydratedProducts = saleItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);
      setHeader({
        partyId: sale.partyId || sale.customerId || '',
        invoiceNo: sale.invoiceNo || '',
        saleDate: sale.saleDate || '',
        status: sale.status || 'paid',
        notes: sale.notes || '',
        amountReceived: String(sale.amountReceived ?? 0),
        ...normalizePaymentFields(sale),
        attachment: sale.attachment || '',
        attributes: sale.attributes || {},
      });
      cacheProducts(hydratedProducts);
      setSelectedCustomer(party.id ? party : null);
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
      setSuggestedInvoiceNo(sale.invoiceNo || '');
      const computedDue = Number(sale.dueAmount ?? Math.max(Number(sale.grandTotal || 0) - Number(sale.amountReceived || 0), 0));
      setIsPaid((sale.status || '').toLowerCase() === 'paid' || computedDue <= 0);
      setMobileStep('details');
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
    if (requiresBankSelection(header, receivedAmount)) {
      setStatus({ type: 'error', message: t('payments.bankRequired') });
      return;
    }

    try {
      const derivedStatus = dueAmount > 0 ? 'due' : 'paid';
      const manualInvoiceNo = String(header.invoiceNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const payload = {
        ...headerFields,
        status: derivedStatus,
        partyId: header.partyId || null,
        amountReceived: receivedAmount,
        ...(Number(receivedAmount || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }),
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
      if (manualInvoiceNo) {
        payload.invoiceNo = manualInvoiceNo;
      } else {
        delete payload.invoiceNo;
      }
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
      useProductStore.getState().invalidate();
      invalidateSales(listParams);
      fetchSales(listParams, true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const currentStepIndex = saleSteps.findIndex((step) => step.id === mobileStep);
  const showDetailsStep = !isMobile || mobileStep === 'details';
  const showItemsStep = !isMobile || mobileStep === 'items';
  const showPaymentStep = !isMobile || mobileStep === 'payment';

  // Validation for proceeding to next step
  const canProceedToItems = header.saleDate && (!header.partyId || true); // Customer is optional (walk-in)
  const hasValidItems = items.length > 0 && items.every((item) => item.productId && Number(item.lineTotal || 0) > 0);
  const canProceedToPayment = mobileStep === 'details' ? canProceedToItems : true;

  const goToNextMobileStep = () => {
    if (!isMobile) return;
    // Validate before proceeding
    if (mobileStep === 'items' && !hasValidItems) {
      setStatus({ type: 'error', message: t('errors.selectProductSale') });
      return;
    }
    const nextStep = saleSteps[currentStepIndex + 1];
    if (nextStep) setMobileStep(nextStep.id);
  };

  const goToPrevMobileStep = () => {
    if (!isMobile) return;
    const previousStep = saleSteps[currentStepIndex - 1];
    if (previousStep) setMobileStep(previousStep.id);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('sales.title')}
        subtitle={t('sales.subtitle')}
        action={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('sales.newSale')}
          </button>
        }
      />

      {/* ── Form Dialog ── */}
      <Dialog isOpen={isOpen} onClose={closeDialog} title={formMode === 'edit' ? t('sales.editSale') : t('sales.newSale')} size="full">
        <form className="space-y-5" onSubmit={handleSubmit}>
          {status.message ? <Notice title={status.message} tone={status.type} /> : null}
          {isMobile ? (
            <MobileFormStepper
              steps={saleSteps}
              currentStep={mobileStep}
              onStepChange={setMobileStep}
              onNext={goToNextMobileStep}
              onBack={goToPrevMobileStep}
              canProceed={mobileStep === 'items' ? hasValidItems : canProceedToItems}
              nextLabel={mobileStep === 'items' ? t('common.continueToPayment') || 'Continue to Payment' : t('common.continue') || 'Continue'}
              backLabel={t('common.back') || 'Back'}
            />
          ) : null}

          {showDetailsStep ? (
            <>
              <FormSectionCard hint={t('sales.customerOptional')}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="label">{t('sales.customer')}</label>
                    <div className="mt-1">
                      <PartySearchCreateField
                        type="customer"
                        selectedParty={selectedCustomer}
                        onSelect={handleCustomerSelect}
                        placeholder={t('sales.walkIn')}
                        searchPlaceholder={t('services.customerSearch')}
                        entityLabel={t('sales.customer')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('sales.invoiceNo')}</label>
                    <input
                      className="input mt-1"
                      name="invoiceNo"
                      value={header.invoiceNo}
                      onChange={handleHeaderChange}
                      placeholder={formMode === 'create' ? suggestedInvoiceNo : ''}
                    />
                  </div>
                  <div>
                    <label className="label">{t('sales.saleDate')}</label>
                    <input type="date" className="input mt-1" name="saleDate" value={header.saleDate} onChange={handleHeaderChange} />
                  </div>
                </div>
              </FormSectionCard>

              <FormSectionCard>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <label className="label">{t('sales.notes')}</label>
                    <textarea className="input mt-1 h-24 resize-none" name="notes" value={header.notes} onChange={handleHeaderChange} placeholder={t('sales.notesPlaceholder')} />
                  </div>
                  <div className="order-1 lg:order-2">
                    <FileUpload
                      label={t('sales.attachment')}
                      initialUrl={header.attachment}
                      onUpload={(url) => setHeader((prev) => ({ ...prev, attachment: url }))}
                    />
                  </div>
                </div>
              </FormSectionCard>

              <FormSectionCard title={t('services.orderInformation')}>
                <DynamicAttributes entityType="sale" attributes={header.attributes} onChange={(attr) => setHeader((prev) => ({ ...prev, attributes: attr }))} />
              </FormSectionCard>
            </>
          ) : null}

          {showItemsStep ? (
            <FormSectionCard
              title={t('sales.items')}
              action={<button className="btn-ghost w-full sm:w-auto" type="button" onClick={addItem}>{t('sales.addItem')}</button>}
            >
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const product = getProductById(item.productId);
                  const itemHeading = product?.name || `${t('sales.product')} ${idx + 1}`;
                  const itemVatAmount = getVatAmount(item.lineTotal, item.taxRate);

                  return (
                    <div key={`item-${idx}`} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/60 dark:bg-slate-900/40">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{itemHeading}</p>
                          <p className="mt-1 text-sm text-slate-500">{t('sales.lineTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.lineTotal })}</p>
                          <p className="mt-1 text-xs text-slate-500">{t('sales.taxTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: itemVatAmount.toFixed(2) })}</p>
                        </div>
                        {items.length > 1 ? (
                          <button className="btn-ghost w-full justify-center sm:w-auto" type="button" onClick={() => removeItem(idx)}>
                            {t('common.remove')}
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                        <div className="sm:col-span-2 xl:col-span-2">
                          <label className="label">{t('sales.product')}</label>
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
                          <label className="label">{t('sales.qty')}</label>
                          <input className="input mt-1" type="number" step="1" min={0} value={item.quantity} onChange={(event) => handleItemChange(idx, 'quantity', event.target.value)} />
                          <p className="mt-1 text-xs text-slate-500">{getUnitLabel(product, item.unitType)}</p>
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
                          <input className="input mt-1" type="number" step="1" min={0} value={item.taxRate} onChange={(event) => handleItemChange(idx, 'taxRate', event.target.value)} />
                          <p className="mt-1 text-xs text-slate-500">
                            {t('sales.taxTotal')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: itemVatAmount.toFixed(2) })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FormSectionCard>
          ) : null}

          {showPaymentStep ? (
            <FormSectionCard title={t('payments.summaryTitle')}>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
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
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 sm:mb-0.5">
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

                <div className="mt-4 border-t border-slate-200/70 pt-4">
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
              <button className="btn-primary w-full sm:w-auto" type="submit">{formMode === 'edit' ? t('sales.updateSale') : t('sales.saveSale')}</button>
            )}
          </div>
        </form>
      </Dialog>

      {/* ── Sales Table Card ── */}
      <div className="card">

        {/* Header: title + filters on left, export on right */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('sales.recentSales')}</h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <label className="label">{t('services.filterByParty')}</label>
                <PartyFilterSelect
                  className="mt-1"
                  type="customer"
                  value={partyFilterId}
                  selectedOption={selectedPartyFilterOption}
                  onChange={handlePartyFilterChange}
                  placeholder={t('services.allParties')}
                  searchPlaceholder={t('parties.searchPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('filters.createdBy')}</label>
                <CreatorFilterSelect
                  className="mt-1"
                  value={createdByFilterId}
                  onChange={setCreatedByFilterId}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
          <button className="btn-ghost shrink-0" type="button" onClick={exportCsv}>{t('sales.exportCsv')}</button>
        </div>

        {/* ── Mobile card view ── */}
        <div className="mt-4 md:hidden space-y-3">
          {salesLoading && salesList.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : pagedSales.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('sales.noSales')}</p>
          ) : (
            pagedSales.map((sale) => {
              const customerName = resolveCustomerName(sale);
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
                      <PaymentTypeSummary
                        source={sale}
                        className="mt-1"
                        labelClassName="text-xs font-medium"
                        metaClassName="text-[11px]"
                      />
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
                <th className="py-2 pr-4 text-left">{t('common.payment')}</th>
                <th className="py-2 pr-4 text-right">{t('common.total')}</th>
                <th className="py-2 pr-4 text-right">{t('sales.totalReceived')}</th>
                <th className="py-2 pr-4 text-right">{t('sales.due')}</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salesLoading && salesList.length === 0 ? (
                <tr><td colSpan={9} className="py-3 text-slate-500">{t('common.loading')}</td></tr>
              ) : pagedSales.length === 0 ? (
                <tr><td colSpan={9} className="py-3 text-slate-500">{t('sales.noSales')}</td></tr>
              ) : (
                pagedSales.map((sale) => {
                  const customerName = resolveCustomerName(sale);
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

                      <td className="py-2.5 pr-4">
                        <PaymentTypeSummary source={sale} />
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
