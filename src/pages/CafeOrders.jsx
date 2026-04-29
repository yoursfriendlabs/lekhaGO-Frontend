import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, FileText, Pencil, Plus, ShoppingCart, Store, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import FormSectionCard from '../components/FormSectionCard.jsx';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { getCurrentCreatorValue } from '../lib/records';
import { mergeLookupEntities, normalizeLookupProduct, toProductLookupOption } from '../lib/lookups.js';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { useProductStore } from '../stores/products';
import {
  buildCafeOrderAttributes,
  buildCafeTableMap,
  CAFE_ORDER_STATUSES,
  getCafeOrderAttributes,
  getCafeOrderStatusMeta,
  getCafeOrderTypeLabel,
  getCafePaymentMeta,
  getDefaultCafeTables,
  getNextCafeOrderStatus,
} from '../lib/cafeOrders.js';

const emptyItem = Object.freeze({
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0',
});

function getVatAmount(lineTotal, taxRate) {
  return (Number(lineTotal || 0) * Number(taxRate || 0)) / 100;
}

function filterCafeProducts(products = []) {
  return products.filter((product) => product.itemType !== 'ingredient');
}

function formatRelativeDate(value) {
  if (!value) return 'No time';
  return formatMaybeDate(value, 'D MMM, h:mm A');
}

function getProductUnitLabel(product, unitType) {
  if (!product) return '';
  if (unitType === 'secondary') return product.secondaryUnit || product.primaryUnit || '';
  return product.primaryUnit || product.secondaryUnit || '';
}

function deriveUnitPrice(product, unitType = 'primary') {
  if (!product) return '0';
  if (unitType === 'secondary') {
    const explicitSecondary = Number(product.secondarySalePrice || 0);
    if (explicitSecondary > 0) return String(explicitSecondary);
    const conversionRate = Number(product.conversionRate || 0);
    const primaryPrice = Number(product.salePrice || 0);
    if (conversionRate > 0 && primaryPrice > 0) {
      return String((primaryPrice / conversionRate).toFixed(4));
    }
  }
  return String(product.salePrice || 0);
}

export default function CafeOrders() {
  const { businessId, user } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const { t } = useI18n();
  const isCompactLayout = useIsMobile('(max-width: 1180px)');
  const { invalidate: invalidateProducts } = useProductStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedTableFilter, setSelectedTableFilter] = useState('');
  const [productDirectory, setProductDirectory] = useState({});
  const [isPaid, setIsPaid] = useState(false);
  const [attributeSnapshot, setAttributeSnapshot] = useState({});
  const [activeDialogStep, setActiveDialogStep] = useState('details');
  const [orderFields, setOrderFields] = useState({
    saleDate: todayISODate(),
    notes: '',
    amountReceived: '0',
    paymentMethod: 'cash',
    bankId: '',
    paymentNote: '',
    invoiceNo: '',
    orderStatus: 'new',
    orderType: 'dine_in',
    tableNo: '',
    waiterName: '',
    guestCount: '2',
  });
  const [items, setItems] = useState([{ ...emptyItem }]);

  const salesRoute = businessProfile?.salesFlow?.route || '/app/pos';
  const cafeTables = useMemo(() => getDefaultCafeTables(12), []);

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: formatted,
    });
  };

  const loadOrders = async () => {
    if (!businessId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await api.listSales({ limit: 120 });
      setOrders(data.items || []);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to load cafe orders.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [businessId]);

  useEffect(() => {
    if (!dialogOpen) return;
    setActiveDialogStep('details');
  }, [dialogOpen]);

  const totals = useMemo(() => {
    const subTotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
    const taxTotal = items.reduce((sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate), 0);
    return {
      subTotal,
      taxTotal,
      grandTotal: subTotal + taxTotal,
    };
  }, [items]);

  const receivedAmount = useMemo(() => (
    isPaid
      ? totals.grandTotal
      : Math.min(Number(orderFields.amountReceived || 0), totals.grandTotal)
  ), [isPaid, orderFields.amountReceived, totals.grandTotal]);
  const dueAmount = Math.max(totals.grandTotal - receivedAmount, 0);

  const cacheProducts = (entries) => {
    setProductDirectory((previous) => mergeLookupEntities(previous, entries));
  };

  const getProductById = (id) => {
    if (!id) return null;
    return productDirectory[String(id)] || null;
  };

  const loadProductOptions = async (search) => {
    const data = await api.lookupProducts({ search, limit: 20 });
    const normalized = filterCafeProducts((data?.items || []).map(normalizeLookupProduct));
    cacheProducts(normalized);
    return normalized.map(toProductLookupOption);
  };

  const syncItemDefaults = (index, product, requestedUnitType) => {
    if (!product) return;

    setItems((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const unitType = requestedUnitType || item.unitType || 'primary';
      const unitPrice = deriveUnitPrice(product, unitType);
      const quantity = Number(item.quantity || 0);

      return {
        ...item,
        unitType,
        unitPrice,
        taxRate: String(product.taxRate || item.taxRate || 0),
        lineTotal: (quantity * Number(unitPrice || 0)).toFixed(2),
      };
    }));
  };

  const handleItemChange = (index, field, value) => {
    setItems((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [field]: value };
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    }));
  };

  const handleProductSelection = (index, option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;
    if (!product?.id) {
      handleItemChange(index, 'productId', '');
      return;
    }

    cacheProducts([product]);
    setItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index
        ? {
            ...item,
            productId: option.value,
            taxRate: String(product.taxRate || 0),
          }
        : item
    )));
    syncItemDefaults(index, product);
  };

  const resetForm = (prefill = {}) => {
    setOrderFields({
      saleDate: todayISODate(),
      notes: '',
      amountReceived: '0',
      paymentMethod: 'cash',
      bankId: '',
      paymentNote: '',
      invoiceNo: '',
      orderStatus: 'new',
      orderType: 'dine_in',
      tableNo: '',
      waiterName: '',
      guestCount: '2',
      ...prefill,
    });
    setItems([{ ...emptyItem }]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
    setSuggestedInvoiceNo('');
    setProductDirectory({});
    setIsPaid(false);
    setAttributeSnapshot({});
  };

  const openCreate = async (tableNo = '') => {
    resetForm({ tableNo });
    setDialogOpen(true);

    if (!businessId) return;
    try {
      const data = await api.getNextSequences();
      setSuggestedInvoiceNo(data?.nextSaleInvoiceNo || '');
    } catch {
      setSuggestedInvoiceNo('');
    }
  };

  const openEdit = async (orderId) => {
    try {
      const order = await api.getSale(orderId);
      const meta = getCafeOrderAttributes(order);
      const orderItems = (order?.SaleItems || []).map((item) => ({
        id: item.id,
        productId: item.productId || '',
        quantity: String(item.quantity ?? '1'),
        unitType: item.unitType || 'primary',
        unitPrice: String(item.unitPrice ?? '0'),
        taxRate: String(item.taxRate ?? '0'),
        lineTotal: String(item.lineTotal ?? '0'),
      }));
      const hydratedProducts = (order?.SaleItems || [])
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);

      cacheProducts(hydratedProducts);
      setAttributeSnapshot(order.attributes || {});
      setOrderFields({
        saleDate: order.saleDate || todayISODate(),
        notes: order.notes || '',
        amountReceived: String(order.amountReceived ?? 0),
        ...normalizePaymentFields(order),
        invoiceNo: order.invoiceNo || '',
        orderStatus: meta.orderStatus,
        orderType: meta.orderType,
        tableNo: meta.tableNo,
        waiterName: meta.waiterName,
        guestCount: meta.guestCount || '2',
      });
      setItems(orderItems.length ? orderItems : [{ ...emptyItem }]);
      setDeletedItemIds([]);
      setEditingId(orderId);
      setFormMode('edit');
      setSuggestedInvoiceNo(order.invoiceNo || '');
      setIsPaid(Number(order.dueAmount || 0) <= 0);
      setDialogOpen(true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to open the order.' });
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  const saveOrder = async (event) => {
    event.preventDefault();

    if (!businessId) {
      setStatus({ type: 'error', message: 'Business context is missing.' });
      return;
    }

    if (!orderFields.saleDate) {
      setStatus({ type: 'error', message: 'Order date is required.' });
      return;
    }

    if (!items.length || items.some((item) => !item.productId)) {
      setStatus({ type: 'error', message: 'Add at least one menu item before saving the order.' });
      return;
    }

    if (orderFields.orderType === 'dine_in' && !orderFields.tableNo) {
      setStatus({ type: 'error', message: 'Choose a table number for dine-in orders.' });
      return;
    }

    if (requiresBankSelection(orderFields, receivedAmount)) {
      setStatus({ type: 'error', message: 'Select a bank account before saving this payment.' });
      return;
    }

    try {
      const manualInvoiceNo = String(orderFields.invoiceNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = orderFields;
      const attributes = buildCafeOrderAttributes(attributeSnapshot, {
        orderStatus: orderFields.orderStatus,
        orderType: orderFields.orderType,
        tableNo: orderFields.orderType === 'dine_in' ? orderFields.tableNo : '',
        waiterName: orderFields.waiterName,
        guestCount: orderFields.guestCount,
      });

      const payload = {
        ...headerFields,
        partyId: null,
        amountReceived: receivedAmount,
        attributes,
        ...(Number(receivedAmount || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }),
        ...totals,
        items: [
          ...items.map((item) => ({
            ...item,
            quantity: Number(item.quantity || 0),
            unitType: item.unitType || 'primary',
            conversionRate: Number(getProductById(item.productId)?.conversionRate || 0),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            lineTotal: Number(item.lineTotal || 0),
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
        await api.updateSale(editingId, payload);
        setStatus({ type: 'success', message: 'Order updated successfully.' });
      } else {
        const creatorValue = getCurrentCreatorValue(user);
        const createPayload = creatorValue ? { ...payload, createdBy: creatorValue } : payload;
        await api.createSale(createPayload);
        setStatus({ type: 'success', message: 'Order created successfully.' });
      }

      invalidateProducts();
      setDialogOpen(false);
      resetForm();
      await loadOrders();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to save the order.' });
    }
  };

  const moveOrderToNextStage = async (order) => {
    const currentMeta = getCafeOrderAttributes(order);
    const nextStatus = getNextCafeOrderStatus(currentMeta.orderStatus);

    if (!nextStatus) return;

    try {
      await api.updateSale(order.id, {
        attributes: buildCafeOrderAttributes(order.attributes || {}, {
          ...currentMeta,
          orderStatus: nextStatus.value,
        }),
      });
      setOrders((previous) => previous.map((entry) => (
        entry.id === order.id
          ? {
              ...entry,
              attributes: buildCafeOrderAttributes(entry.attributes || {}, {
                ...currentMeta,
                orderStatus: nextStatus.value,
              }),
            }
          : entry
      )));
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to update order status.' });
    }
  };

  const activeOrders = useMemo(() => orders.filter((order) => getCafeOrderAttributes(order).orderStatus !== 'completed'), [orders]);
  const tableMap = useMemo(() => buildCafeTableMap(activeOrders, cafeTables), [activeOrders, cafeTables]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const meta = getCafeOrderAttributes(order);
    if (selectedStatusFilter !== 'all' && meta.orderStatus !== selectedStatusFilter) return false;
    if (!selectedTableFilter) return true;
    return meta.tableNo === selectedTableFilter || meta.tableNo === `T${selectedTableFilter}`;
  }), [orders, selectedStatusFilter, selectedTableFilter]);

  const groupedOrders = useMemo(() => CAFE_ORDER_STATUSES.map((column) => ({
    ...column,
    items: filteredOrders.filter((order) => getCafeOrderAttributes(order).orderStatus === column.value),
  })), [filteredOrders]);

  const orderCounts = useMemo(() => CAFE_ORDER_STATUSES.reduce((acc, column) => {
    acc[column.value] = orders.filter((order) => getCafeOrderAttributes(order).orderStatus === column.value).length;
    return acc;
  }, {}), [orders]);

  const completedCount = orderCounts.completed || 0;
  const openCount = activeOrders.length;
  const readyCount = orderCounts.ready || 0;
  const visibleBoardColumns = selectedStatusFilter === 'all'
    ? groupedOrders
    : groupedOrders.filter((column) => column.value === selectedStatusFilter);
  const dialogSteps = useMemo(() => ([
    { id: 'details', label: 'Details' },
    { id: 'items', label: 'Items' },
    { id: 'payment', label: 'Payment' },
  ]), []);
  const activeDialogStepIndex = dialogSteps.findIndex((step) => step.id === activeDialogStep);
  const nextDialogStep = activeDialogStepIndex >= 0 ? dialogSteps[activeDialogStepIndex + 1] : null;
  const canGoBackStep = activeDialogStepIndex > 0;
  const canGoForwardStep = activeDialogStepIndex >= 0 && activeDialogStepIndex < dialogSteps.length - 1;
  const showDetailsStep = !isCompactLayout || activeDialogStep === 'details';
  const showItemsStep = !isCompactLayout || activeDialogStep === 'items';
  const showPaymentStep = !isCompactLayout || activeDialogStep === 'payment';
  const dialogOrderLabel = String(orderFields.invoiceNo || suggestedInvoiceNo || (editingId ? editingId.slice(0, 8) : 'Draft order')).trim();
  const dialogSecondaryLabel = orderFields.orderType === 'dine_in'
    ? (orderFields.tableNo ? `Table ${orderFields.tableNo}` : 'No table selected')
    : getCafeOrderTypeLabel(orderFields.orderType);
  const dialogPrimaryActionLabel = canGoForwardStep
    ? `Continue to ${nextDialogStep?.label || 'Next'}`
    : (formMode === 'edit' ? 'Update Order' : 'Save Order');
  const handleGoToNextDialogStep = () => {
    if (!canGoForwardStep || !nextDialogStep) return;
    setActiveDialogStep(nextDialogStep.id);
  };
  const handleGoToPreviousDialogStep = () => {
    if (!canGoBackStep) return;
    setActiveDialogStep(dialogSteps[activeDialogStepIndex - 1].id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cafe Orders"
        subtitle="Manage dine-in, takeaway, and ready-to-serve orders from one live board."
        action={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link className="btn-ghost w-full justify-center sm:w-auto" to={salesRoute}>
              Open POS
            </Link>
            <button className="btn-primary w-full sm:w-auto" type="button" onClick={() => openCreate()}>
              <Plus size={16} className="mr-1.5 inline" />
              New Order
            </button>
          </div>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6835]">Floor View</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">Tables</h2>
              <p className="mt-1 text-sm text-slate-500">Tap a table to focus the active orders for that seating area.</p>
            </div>
            {selectedTableFilter ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedTableFilter('')}
              >
                Clear table filter
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tableMap.map((table) => {
              const isActive = selectedTableFilter === table.id;
              const statusMeta = table.statusMeta;

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedTableFilter((current) => (current === table.id ? '' : table.id))}
                  className={`rounded-3xl border p-3.5 text-left transition sm:p-4 ${
                    isActive
                      ? 'border-[#9b6835] bg-[#9b6835]/8 shadow-sm'
                      : table.occupied
                        ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        : 'border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">{table.label}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta?.accent || 'bg-slate-300'}`} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {table.occupied ? statusMeta?.label : 'Available'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {table.orderMeta?.waiterName || (table.occupied ? 'Occupied' : 'Open for seating')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-[#fff8f1] via-white to-slate-50 p-4 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-1">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Open Orders</p>
                <ShoppingCart size={18} className="text-[#9b6835]" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{openCount}</p>
              <p className="mt-1 text-sm text-slate-500">Orders still moving through the cafe workflow.</p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Ready for Pickup</p>
                <Store size={18} className="text-emerald-600" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{readyCount}</p>
              <p className="mt-1 text-sm text-slate-500">Orders that can be served, packed, or handed to the customer.</p>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Completed Today</p>
                <Clock size={18} className="text-slate-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{completedCount}</p>
              <p className="mt-1 text-sm text-slate-500">Completed orders remain visible here for quick review.</p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200/70 bg-white/80 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Board Filters</p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedStatusFilter === 'all' ? 'Showing all kitchen stages.' : `Focused on ${CAFE_ORDER_STATUSES.find((column) => column.value === selectedStatusFilter)?.label || 'selected'} orders.`}
                </p>
              </div>
              {selectedTableFilter ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Table {selectedTableFilter}
                </span>
              ) : null}
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('all')}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  selectedStatusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              {CAFE_ORDER_STATUSES.map((column) => (
                <button
                  key={column.value}
                  type="button"
                  onClick={() => setSelectedStatusFilter(column.value)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selectedStatusFilter === column.value
                      ? `${column.tone} shadow-sm`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {column.label} {orderCounts[column.value] ? `(${orderCounts[column.value]})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {visibleBoardColumns.map((column) => (
            <section
              key={column.value}
              className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{column.label}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {column.items.length}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {loading ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading orders...
                  </div>
                ) : column.items.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No orders in this column.
                  </div>
                ) : (
                  column.items.map((order) => {
                    const meta = getCafeOrderAttributes(order);
                    const paymentMeta = getCafePaymentMeta(order);
                    const nextStatus = getNextCafeOrderStatus(meta.orderStatus);

                    return (
                      <article
                        key={order.id}
                        className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {order.invoiceNo || order.id.slice(0, 8)}
                            </p>
                            <h4 className="mt-2 text-lg font-semibold text-slate-900">
                              {meta.tableNo ? `Table ${meta.tableNo}` : getCafeOrderTypeLabel(meta.orderType)}
                            </h4>
                            <p className="mt-1 text-sm text-slate-500">{getCafeOrderTypeLabel(meta.orderType)}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentMeta.tone}`}>
                            {paymentMeta.label}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-slate-400" />
                            <span>{meta.guestCount || '1'} guests</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-slate-400" />
                            <span>{formatRelativeDate(order.createdAt || order.saleDate)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Store size={14} className="text-slate-400" />
                            <span>{meta.waiterName || 'No waiter assigned'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingCart size={14} className="text-slate-400" />
                            <span>{Array.isArray(order.SaleItems) ? `${order.SaleItems.length} items` : 'Items loading from invoice'}</span>
                          </div>
                        </div>

                        {order.notes ? (
                          <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{order.notes}</p>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Total</p>
                            <p className="text-lg font-semibold text-slate-900">{formatMoney(order.grandTotal)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Edit order"
                              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => openEdit(order.id)}
                            >
                              <Pencil size={15} />
                            </button>
                            <Link
                              title="Open invoice"
                              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              to={`/app/invoice/sales/${order.id}`}
                            >
                              <FileText size={15} />
                            </Link>
                          </div>
                        </div>

                        {nextStatus ? (
                          <button
                            type="button"
                            className="btn-primary mt-4 w-full justify-center"
                            onClick={() => moveOrderToNextStage(order)}
                          >
                            Move to {nextStatus.label}
                            <ArrowRight size={14} className="ml-1.5" />
                          </button>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}
      </div>

      <Dialog
        isOpen={dialogOpen}
        onClose={closeDialog}
        title={formMode === 'edit' ? 'Edit Cafe Order' : 'New Cafe Order'}
        size="full"
      >
        <form className="space-y-5" onSubmit={saveOrder}>
          {isCompactLayout ? (
            <>
              <div className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-[#fff8f1] via-white to-slate-50 p-4 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6835]">Order Draft</p>
                    <h3 className="mt-2 truncate text-xl font-semibold text-slate-900">{dialogOrderLabel}</h3>
                    <p className="mt-1 text-sm text-slate-500">{dialogSecondaryLabel}</p>
                  </div>
                  <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-semibold ${getCafePaymentMeta({ dueAmount, grandTotal: totals.grandTotal }).tone}`}>
                    {getCafePaymentMeta({ dueAmount, grandTotal: totals.grandTotal }).label}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white/85 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Items</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{items.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/85 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Guests</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{orderFields.guestCount || '1'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/85 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatMoney(totals.grandTotal)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/85 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Due</p>
                    <p className={`mt-1 text-base font-semibold ${dueAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {formatMoney(dueAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {dialogSteps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveDialogStep(step.id)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeDialogStep === step.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {showDetailsStep ? (
            <FormSectionCard hint="Keep the kitchen team and counter synced with order type, table, and waiter details.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="label">Order No</label>
                  <input
                    className="input mt-1"
                    name="invoiceNo"
                    value={orderFields.invoiceNo}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, invoiceNo: event.target.value }))}
                    placeholder={formMode === 'create' ? suggestedInvoiceNo : ''}
                  />
                </div>
                <div>
                  <label className="label">Date</label>
                  <input
                    className="input mt-1"
                    type="date"
                    value={orderFields.saleDate}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, saleDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select
                    className="input mt-1"
                    value={orderFields.orderStatus}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, orderStatus: event.target.value }))}
                  >
                    {CAFE_ORDER_STATUSES.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>{statusOption.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Guest Count</label>
                  <input
                    className="input mt-1"
                    type="number"
                    min="1"
                    value={orderFields.guestCount}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, guestCount: event.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2 xl:col-span-2">
                  <label className="label">Order Type</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { value: 'dine_in', label: 'Dine In' },
                      { value: 'takeaway', label: 'Takeaway' },
                      { value: 'delivery', label: 'Delivery' },
                    ].map((typeOption) => (
                      <button
                        key={typeOption.value}
                        type="button"
                        onClick={() => setOrderFields((prev) => ({
                          ...prev,
                          orderType: typeOption.value,
                          tableNo: typeOption.value === 'dine_in' ? prev.tableNo : '',
                        }))}
                        className={`${orderFields.orderType === typeOption.value ? 'btn-primary' : 'btn-ghost'} w-full justify-center`}
                      >
                        {typeOption.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2 xl:col-span-2">
                  <label className="label">Waiter</label>
                  <input
                    className="input mt-1"
                    value={orderFields.waiterName}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, waiterName: event.target.value }))}
                    placeholder="Staff name"
                  />
                </div>

                <div className="sm:col-span-2 xl:col-span-4">
                  <label className="label">Notes</label>
                  <textarea
                    className="input mt-1 h-24 resize-none"
                    value={orderFields.notes}
                    maxLength={10000}
                    onChange={(event) => setOrderFields((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Special instructions"
                  />
                </div>
              </div>

              {orderFields.orderType === 'dine_in' ? (
                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="label">Table Selection</p>
                      <p className="mt-1 text-xs text-slate-500">Choose the table for this order.</p>
                    </div>
                    {orderFields.tableNo ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setOrderFields((prev) => ({ ...prev, tableNo: '' }))}
                      >
                        Clear table
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {tableMap.map((table) => {
                      const selected = orderFields.tableNo === table.id || orderFields.tableNo === table.label;
                      const occupiedByOther = table.occupied && !selected;

                      return (
                        <button
                          key={`dialog-table-${table.id}`}
                          type="button"
                          onClick={() => setOrderFields((prev) => ({ ...prev, tableNo: table.id }))}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            selected
                              ? 'border-[#9b6835] bg-[#9b6835]/10 shadow-sm'
                              : occupiedByOther
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{table.label}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${table.statusMeta?.accent || 'bg-slate-300'}`} />
                          </div>
                          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {selected ? 'Selected' : occupiedByOther ? (table.statusMeta?.label || 'Occupied') : 'Available'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {getCafeOrderTypeLabel(orderFields.orderType)} orders do not need a table assignment.
                </div>
              )}
            </FormSectionCard>
          ) : null}

          {showItemsStep ? (
            <FormSectionCard
              title="Items"
              action={<button className="btn-ghost w-full sm:w-auto" type="button" onClick={() => setItems((prev) => [...prev, { ...emptyItem }])}>Add Item</button>}
            >
              <div className="space-y-4">
                {items.map((item, index) => {
                  const product = getProductById(item.productId);
                  const vatAmount = getVatAmount(item.lineTotal, item.taxRate);

                  return (
                    <div key={`cafe-item-${index}`} className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {product?.name || `Menu Item ${index + 1}`}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatMoney(item.lineTotal)} total · {formatMoney(vatAmount)} tax
                          </p>
                        </div>
                        {items.length > 1 ? (
                          <button
                            className="btn-ghost"
                            type="button"
                            onClick={() => {
                              setItems((previous) => {
                                const target = previous[index];
                                if (target?.id) {
                                  setDeletedItemIds((current) => [...current, target.id]);
                                }
                                return previous.filter((_, itemIndex) => itemIndex !== index);
                              });
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="sm:col-span-2 xl:col-span-2">
                          <label className="label">Menu Item</label>
                          <AsyncSearchableSelect
                            className="mt-1"
                            value={item.productId}
                            selectedOption={product ? toProductLookupOption(product) : null}
                            onChange={(option) => handleProductSelection(index, option)}
                            loadOptions={loadProductOptions}
                            placeholder="Search menu items"
                            searchPlaceholder="Search menu items"
                            noResultsLabel="No menu items found"
                            loadingLabel="Loading menu items..."
                          />
                        </div>
                        <div>
                          <label className="label">Qty</label>
                          <input
                            className="input mt-1"
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={(event) => handleItemChange(index, 'quantity', event.target.value)}
                          />
                          <p className="mt-1 text-xs text-slate-500">{getProductUnitLabel(product, item.unitType)}</p>
                        </div>
                        <div>
                          <label className="label">Unit Type</label>
                          <select
                            className="input mt-1"
                            value={item.unitType}
                            onChange={(event) => {
                              handleItemChange(index, 'unitType', event.target.value);
                              syncItemDefaults(index, getProductById(item.productId), event.target.value);
                            }}
                          >
                            <option value="primary">Primary</option>
                            <option value="secondary">Secondary</option>
                          </select>
                        </div>
                        <div>
                          <label className="label">Unit Price</label>
                          <input
                            className="input mt-1"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) => handleItemChange(index, 'unitPrice', event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FormSectionCard>
          ) : null}

          {showPaymentStep ? (
            <FormSectionCard title="Payment">
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Subtotal</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totals.subTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Tax</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totals.taxTotal)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Grand Total</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(totals.grandTotal)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label className="label">Amount Received</label>
                      <input
                        className="input mt-1"
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={isPaid}
                        value={isPaid ? totals.grandTotal.toFixed(2) : orderFields.amountReceived}
                        onChange={(event) => setOrderFields((prev) => ({ ...prev, amountReceived: event.target.value }))}
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-primary-600"
                        checked={isPaid}
                        onChange={(event) => setIsPaid(event.target.checked)}
                      />
                      Fully paid
                    </label>
                  </div>

                  <div className={`mt-4 rounded-2xl px-3 py-2 text-sm ${dueAmount > 0 ? 'border border-amber-200 bg-amber-50 text-amber-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {dueAmount > 0 ? (
                      <>Remaining due: <span className="font-semibold">{formatMoney(dueAmount)}</span></>
                    ) : (
                      <>This order is fully paid.</>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4">
                  <PaymentMethodFields
                    value={orderFields}
                    onChange={(patch) => setOrderFields((prev) => ({ ...prev, ...patch }))}
                  />
                </div>
              </div>
            </FormSectionCard>
          ) : null}

          {isCompactLayout ? (
            <div className="mobile-sticky-actions space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100/90 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {dialogSteps[activeDialogStepIndex]?.label || 'Details'}
                  </p>
                  <p className="mt-1 truncate font-semibold text-slate-700">{dialogOrderLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {dueAmount > 0 ? 'Due' : 'Total'}
                  </p>
                  <p className={`mt-1 font-semibold ${dueAmount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatMoney(dueAmount > 0 ? dueAmount : totals.grandTotal)}
                  </p>
                </div>
              </div>

              <div className={`grid gap-2 ${canGoBackStep ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {canGoBackStep ? (
                  <button className="btn-ghost w-full" type="button" onClick={handleGoToPreviousDialogStep}>
                    Back
                  </button>
                ) : null}

                {canGoForwardStep ? (
                  <button className="btn-primary w-full" type="button" onClick={handleGoToNextDialogStep}>
                    {dialogPrimaryActionLabel}
                    <ArrowRight size={14} className="ml-1.5" />
                  </button>
                ) : (
                  <button className="btn-primary w-full" type="submit">
                    {dialogPrimaryActionLabel}
                  </button>
                )}
              </div>

              <button className="btn-secondary w-full" type="button" onClick={closeDialog}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>
                Cancel
              </button>
              <button className="btn-primary w-full sm:w-auto" type="submit">
                {formMode === 'edit' ? 'Update Order' : 'Save Order'}
              </button>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}
