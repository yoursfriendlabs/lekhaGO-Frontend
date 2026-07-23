import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, FileText, LayoutGrid, MapPin, Package2, Pencil, Phone, Plus, Search, ShoppingBag, ShoppingCart, Store, Table, Trash2, UserRound, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import FormSectionCard from '../components/FormSectionCard.jsx';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import NoteTextarea from '../components/NoteTextarea.jsx';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import QuickPartySelector from '../components/QuickPartySelector.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { getCurrentCreatorValue } from '../lib/records';
import { mergeLookupEntities, normalizeLookupParty, normalizeLookupProduct, toProductLookupOption } from '../lib/lookups.js';
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
  checkNewAndReadyOrders,
  playNotificationSound,
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
  const navigate = useNavigate();
  const { businessId, user } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const { t } = useI18n();
  const isCompactLayout = useIsMobile('(max-width: 1180px)');
  const { invalidate: invalidateProducts } = useProductStore();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: 'info', message: '' });

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedParty, setSelectedParty] = useState(null);
  const [partySelectorOpen, setPartySelectorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');
  const [selectedOrderTypeFilter, setSelectedOrderTypeFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTableFilter, setSelectedTableFilter] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban', 'table', 'floor'
  const [visibleCount, setVisibleCount] = useState(15);
  const [dialogFloorFilter, setDialogFloorFilter] = useState('all');
  const [dialogStatusFilter, setDialogStatusFilter] = useState('all');
  const [productDirectory, setProductDirectory] = useState({});
  const [isPaid, setIsPaid] = useState(false);
  const [attributeSnapshot, setAttributeSnapshot] = useState({});
  const [activeDialogStep, setActiveDialogStep] = useState('details');
  const [deletingOrderId, setDeletingOrderId] = useState('');
  const [deleteOrder, setDeleteOrder] = useState(null);
  const [selectedOrderForItemsDialog, setSelectedOrderForItemsDialog] = useState(null);
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
  const [backendTables, setBackendTables] = useState([]);
  const [selectedFloorTab, setSelectedFloorTab] = useState('all');
  const [floors, setFloors] = useState([]);

  const cafeTables = useMemo(() => {
    if (backendTables.length > 0) {
      return backendTables.map((t) => ({
        id: String(t.id),
        label: t.name,
        capacity: t.capacity,
        categoryId: t.categoryId,
        category: t.category,
        status: t.status,
      }));
    }
    return getDefaultCafeTables(12);
  }, [backendTables]);

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

  const loadFloors = async () => {
    if (!businessId) {
      setFloors([]);
      return;
    }
    try {
      const data = await api.listCategories({ type: 'table', limit: 100 });
      setFloors(data?.items || []);
    } catch (err) {
      console.error('Failed to load floors', err);
    }
  };

  const loadBackendTables = async () => {
    if (!businessId) {
      setBackendTables([]);
      return;
    }
    try {
      const params = { isActive: 'true', limit: 100 };
      if (selectedFloorTab !== 'all' && selectedFloorTab !== 'unassigned') {
        params.categoryId = selectedFloorTab;
      }
      const data = await api.getTables(params);
      let items = data?.items || [];
      if (selectedFloorTab === 'unassigned') {
        items = items.filter((t) => !t.categoryId);
      }
      setBackendTables(items);
    } catch (err) {
      console.error('Failed to load tables', err);
    }
  };

  useEffect(() => {
    loadOrders();
    loadFloors();

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(async () => {
      if (!businessId) return;
      try {
        const data = await api.listSales({ limit: 120 });
        const items = data.items || [];
        setOrders(items);
        checkNewAndReadyOrders(items);
      } catch (err) {
        console.error("Failed to poll cafe orders:", err);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [businessId]);

  useEffect(() => {
    loadBackendTables();
  }, [businessId, selectedFloorTab]);

  useEffect(() => {
    if (!dialogOpen) return;
    setActiveDialogStep('details');
  }, [dialogOpen]);



  const cacheProducts = (productList = []) => {
    if (!Array.isArray(productList) || !productList.length) return;
    setProductDirectory((previous) => mergeLookupEntities(previous, productList));
  };

  const getProductById = (productId) => productDirectory[productId] || null;

  const subTotalNumber = useMemo(() => items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0), [items]);
  const taxTotalNumber = useMemo(() => items.reduce((sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate), 0), [items]);
  const grandTotalNumber = subTotalNumber + taxTotalNumber;
  const receivedAmount = isPaid ? grandTotalNumber.toFixed(2) : String(orderFields.amountReceived ?? 0);
  const dueAmountNumber = Math.max(0, grandTotalNumber - Number(receivedAmount || 0));

  const totals = useMemo(() => ({
    subTotal: subTotalNumber.toFixed(2),
    taxTotal: taxTotalNumber.toFixed(2),
    grandTotal: grandTotalNumber.toFixed(2),
    dueAmount: dueAmountNumber.toFixed(2),
  }), [subTotalNumber, taxTotalNumber, grandTotalNumber, dueAmountNumber]);

  const dueAmount = Number(totals.dueAmount || 0);

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
    setSelectedParty(null);
    setPartySelectorOpen(false);
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

      const partyObj = order.Party || order.Customer || (order.partyId ? { id: order.partyId, name: meta.partyName, phone: meta.partyPhone, address: meta.partyAddress } : null);
      setSelectedParty(partyObj ? normalizeLookupParty(partyObj) : null);

      setOrderFields({
        saleDate: order.saleDate || todayISODate(),
        notes: order.notes || '',
        amountReceived: String(order.amountReceived ?? 0),
        ...normalizePaymentFields(order),
        invoiceNo: order.invoiceNo || '',
        orderStatus: meta.orderStatus,
        orderType: meta.orderType,
        tableNo: order.tableId || meta.tableNo,
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
      
      const matchedTable = backendTables.find(t => String(t.id) === String(orderFields.tableNo) || String(t.name) === String(orderFields.tableNo));
      const resolvedTableNo = orderFields.orderType === 'dine_in' ? (matchedTable ? matchedTable.name : orderFields.tableNo) : '';

      const attributes = buildCafeOrderAttributes(attributeSnapshot, {
        orderStatus: orderFields.orderStatus,
        orderType: orderFields.orderType,
        tableNo: resolvedTableNo,
        waiterName: orderFields.waiterName,
        guestCount: orderFields.guestCount,
        customer_name: selectedParty?.name || '',
        customer_phone: selectedParty?.phone || '',
        customer_address: selectedParty?.address || '',
      });

      const payload = {
        ...headerFields,
        tableId: orderFields.orderType === 'dine_in' && matchedTable ? matchedTable.id : null,
        partyId: selectedParty?.id || null,
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
      const nextAttributes = buildCafeOrderAttributes(order.attributes || {}, {
        ...currentMeta,
        orderStatus: nextStatus.value,
      });

      const updatePayload = {
        attributes: nextAttributes,
      };

      if (nextStatus.value === 'completed' && Number(order.dueAmount || order.grandTotal || 0) > 0) {
        updatePayload.status = 'paid';
        updatePayload.amountReceived = order.grandTotal;
        updatePayload.paymentMethod = order.paymentMethod || 'cash';
      }

      await api.updateSale(order.id, updatePayload);
      await loadOrders();
      setStatus({ type: 'success', message: `Order moved to ${nextStatus.label}.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Unable to update order status.' });
    }
  };

  const handleCollectCashAndComplete = async (order) => {
    const currentMeta = getCafeOrderAttributes(order);
    try {
      const updatePayload = {
        status: 'paid',
        amountReceived: order.grandTotal,
        paymentMethod: order.paymentMethod || 'cash',
        attributes: buildCafeOrderAttributes(order.attributes || {}, {
          ...currentMeta,
          orderStatus: 'completed',
        }),
      };
      await api.updateSale(order.id, updatePayload);
      await loadOrders();
      setStatus({ type: 'success', message: 'Cash collected and order marked as completed!' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to complete order.' });
    }
  };

  const closeDeleteDialog = () => {
    if (deleteOrder && deletingOrderId === deleteOrder.id) return;
    setDeleteOrder(null);
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrder) return;

    setDeletingOrderId(deleteOrder.id);

    try {
      await api.deleteSale(deleteOrder.id);
      invalidateProducts();
      setStatus({ type: 'success', message: t('sales.messages.deleted') });
      await loadOrders();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || t('sales.messages.deleteFailed') });
    } finally {
      setDeletingOrderId('');
      setDeleteOrder(null);
    }
  };

  const activeOrders = useMemo(() => orders.filter((order) => getCafeOrderAttributes(order).orderStatus !== 'completed'), [orders]);

  const kitchenItems = useMemo(() => {
    const itemsList = [];
    orders.forEach((order) => {
      const meta = getCafeOrderAttributes(order);
      if (meta.orderStatus === 'completed' || meta.orderStatus === 'ready') return;
      if (selectedOrderTypeFilter !== 'all' && meta.orderType !== selectedOrderTypeFilter) return;

      if (Array.isArray(order.SaleItems)) {
        order.SaleItems.forEach((si) => {
          itemsList.push({
            id: `${order.id}-${si.id}`,
            orderId: order.id,
            productName: si.Product?.name || si.name || 'Unnamed Item',
            quantity: si.quantity,
            note: order.notes,
            createdAt: order.createdAt,
            tableNo: meta.tableNo,
            orderType: meta.orderType,
            orderStatus: meta.orderStatus,
            orderRaw: order
          });
        });
      }
    });

    return itemsList.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [orders, selectedOrderTypeFilter]);

  useEffect(() => {
    if (viewMode !== 'kitchen') return;
    const sentinel = document.getElementById('kitchen-sentinel');
    if (!sentinel) return;

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setVisibleCount((prev) => prev + 15);
      }
    }, {
      rootMargin: '120px',
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, kitchenItems.length]);

  useEffect(() => {
    setVisibleCount(15);
  }, [viewMode, selectedOrderTypeFilter]);
  const tableMap = useMemo(() => buildCafeTableMap(activeOrders, cafeTables), [activeOrders, cafeTables]);

  const typeCounts = useMemo(() => {
    const counts = { all: orders.length, dine_in: 0, takeaway: 0, delivery: 0 };
    orders.forEach((order) => {
      const meta = getCafeOrderAttributes(order);
      if (meta.orderType && counts[meta.orderType] !== undefined) {
        counts[meta.orderType] += 1;
      }
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const meta = getCafeOrderAttributes(order);
    if (selectedOrderTypeFilter !== 'all' && selectedOrderTypeFilter !== 'seating_map' && meta.orderType !== selectedOrderTypeFilter) {
      return false;
    }
    if (selectedStatusFilter !== 'all' && meta.orderStatus !== selectedStatusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = meta.partyName?.toLowerCase().includes(q);
      const phoneMatch = meta.partyPhone?.toLowerCase().includes(q);
      const addressMatch = meta.partyAddress?.toLowerCase().includes(q);
      const invoiceMatch = order.invoiceNo?.toLowerCase().includes(q);
      const tableMatch = meta.tableNo?.toLowerCase().includes(q);
      if (!nameMatch && !phoneMatch && !addressMatch && !invoiceMatch && !tableMatch) {
        return false;
      }
    }
    if (!selectedTableFilter) return true;
    return meta.tableNo === selectedTableFilter || meta.tableNo === `T${selectedTableFilter}`;
  }), [orders, selectedOrderTypeFilter, selectedStatusFilter, searchQuery, selectedTableFilter]);

  const groupedOrders = useMemo(() => CAFE_ORDER_STATUSES.map((column) => ({
    ...column,
    items: filteredOrders.filter((order) => getCafeOrderAttributes(order).orderStatus === column.value),
  })), [filteredOrders]);

  const orderCounts = useMemo(() => CAFE_ORDER_STATUSES.reduce((acc, column) => {
    acc[column.value] = filteredOrders.filter((order) => getCafeOrderAttributes(order).orderStatus === column.value).length;
    return acc;
  }, {}), [filteredOrders]);

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
            <button className="btn-primary w-full sm:w-auto" type="button" onClick={() => navigate('/app/pos?ref=orders')}>
              <Plus size={16} className="mr-1.5 inline" />
              New Order
            </button>
          </div>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}



      {/* Order Type & View Switcher Bar */}
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          {/* Order Type Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            <button
              type="button"
              onClick={() => { setSelectedOrderTypeFilter('all'); if (viewMode === 'floor') setViewMode('kanban'); }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                selectedOrderTypeFilter === 'all' && viewMode !== 'floor'
                  ? 'bg-[#9c5f22] text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              📋 All Orders
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedOrderTypeFilter === 'all' && viewMode !== 'floor' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {typeCounts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedOrderTypeFilter('dine_in'); if (viewMode === 'floor') setViewMode('kanban'); }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                selectedOrderTypeFilter === 'dine_in' && viewMode !== 'floor'
                  ? 'bg-[#9c5f22] text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              🍽️ Table / Dine In
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedOrderTypeFilter === 'dine_in' && viewMode !== 'floor' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {typeCounts.dine_in}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedOrderTypeFilter('takeaway'); if (viewMode === 'floor') setViewMode('kanban'); }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                selectedOrderTypeFilter === 'takeaway' && viewMode !== 'floor'
                  ? 'bg-[#9c5f22] text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              🛍️ Takeaway / Walk-in
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedOrderTypeFilter === 'takeaway' && viewMode !== 'floor' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {typeCounts.takeaway}
              </span>
            </button>

            <button
              type="button"
              onClick={() => { setSelectedOrderTypeFilter('delivery'); if (viewMode === 'floor') setViewMode('kanban'); }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                selectedOrderTypeFilter === 'delivery' && viewMode !== 'floor'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              🚚 Home Delivery
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                selectedOrderTypeFilter === 'delivery' && viewMode !== 'floor' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
              }`}>
                {typeCounts.delivery}
              </span>
            </button>
          </div>

          {/* View Mode Toggle Controls */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/60 shrink-0 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#9c5f22] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={15} />
              Kanban Board
            </button>

            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'table'
                  ? 'bg-white text-[#9c5f22] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table size={15} />
              Table View
            </button>

            <button
              type="button"
              onClick={() => setViewMode('kitchen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'kitchen'
                  ? 'bg-white text-[#9c5f22] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart size={15} />
              Kitchen Items
            </button>

            <button
              type="button"
              onClick={() => setViewMode('floor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'floor'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗺️ Seating Map
            </button>
          </div>
        </div>

        {/* Stage Status Filters & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {viewMode !== 'floor' && viewMode !== 'kitchen' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 whitespace-nowrap">Stage:</span>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                  selectedStatusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Stages ({filteredOrders.length})
              </button>
              {CAFE_ORDER_STATUSES.map((column) => (
                <button
                  key={column.value}
                  type="button"
                  onClick={() => setSelectedStatusFilter(column.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition whitespace-nowrap ${
                    selectedStatusFilter === column.value
                      ? `${column.tone} shadow-sm`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {column.label} ({orderCounts[column.value] || 0})
                </button>
              ))}
            </div>
          ) : <div />}

          <div className="relative flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search party name, phone, address, invoice..."
              className="w-full rounded-2xl border border-slate-200/80 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 focus:border-[#9c5f22] focus:outline-none"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* View 1: Seating Map / Floor Plan */}
      {viewMode === 'floor' ? (
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6835]">Floor Map</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">Seating Tables</h2>
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

          <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedFloorTab('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all border ${
                selectedFloorTab === 'all'
                  ? 'bg-[#9b6835] text-white border-[#9b6835] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Tables
            </button>
            {floors.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => setSelectedFloorTab(floor.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all border ${
                  selectedFloorTab === floor.id
                    ? 'bg-[#9b6835] text-white border-[#9b6835] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {floor.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tableMap.map((table) => {
              const isOccupied = table.occupied || table.status === 'occupied';

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => navigate(`/app/pos?tableId=${table.id}&ref=orders`)}
                  className={`group relative rounded-3xl border p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between h-36 ${
                    isOccupied
                      ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                      : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                  }`}
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-serif text-lg sm:text-xl font-bold text-slate-800">
                        {table.label}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isOccupied
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      }`}>
                        {isOccupied ? 'Occupied' : 'Vacant'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <Users size={12} className="text-slate-400" />
                      <span>{table.capacity ? `${table.capacity} Seats` : 'No limit'}</span>
                    </div>
                  </div>

                  <div className="w-full pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {table.category?.name || 'No Floor'}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate max-w-[90px]">
                      {table.orderMeta?.waiterName || (isOccupied ? 'Dining' : 'Open')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* View 2: Data Table View */
        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-4 sm:p-6 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-3">Order / Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Customer / Party</th>
                <th className="p-3">Items</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Stage</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No orders match your search or filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const meta = getCafeOrderAttributes(order);
                  const paymentMeta = getCafePaymentMeta(order);
                  const nextStatus = getNextCafeOrderStatus(meta.orderStatus);
                  const statusMeta = getCafeOrderStatusMeta(meta.orderStatus);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-semibold text-slate-800">
                        <div>#{order.invoiceNo || order.id.slice(0, 8)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatRelativeDate(order.createdAt || order.saleDate)}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {meta.orderType === 'delivery' ? (
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            🚚 Home Delivery
                          </span>
                        ) : meta.orderType === 'takeaway' ? (
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            🛍️ Takeaway
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            🍽️ Dine-in {meta.tableNo ? `(T${meta.tableNo})` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {meta.partyName ? (
                          <div>
                            <div className="font-bold text-slate-800">{meta.partyName}</div>
                            {meta.partyPhone && (
                              <a href={`tel:${meta.partyPhone}`} className="text-amber-800 text-[11px] hover:underline flex items-center gap-1">
                                <Phone size={10} /> {meta.partyPhone}
                              </a>
                            )}
                            {meta.partyAddress && (
                              <div className="text-slate-500 text-[10px] truncate max-w-[160px]">{meta.partyAddress}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="p-3 max-w-[220px]">
                        {Array.isArray(order.SaleItems) && order.SaleItems.length > 0 ? (
                          <span className="truncate block font-medium" title={order.SaleItems.map(i => `${i.quantity}x ${i.Product?.name || i.name}`).join(', ')}>
                            {order.SaleItems.slice(0, 2).map(i => `${i.quantity}x ${i.Product?.name || i.name}`).join(', ')}
                            {order.SaleItems.length > 2 ? ` +${order.SaleItems.length - 2} more` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">No items</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${paymentMeta.tone}`}>
                          {paymentMeta.label}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${statusMeta?.tone || 'bg-slate-100 text-slate-700'}`}>
                          {statusMeta?.label || meta.orderStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatMoney(order.grandTotal)}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {nextStatus && (
                            <button
                              type="button"
                              className="btn-primary py-1 px-2.5 text-[11px] font-bold"
                              onClick={() => moveOrderToNextStage(order)}
                            >
                              → {nextStatus.label}
                            </button>
                          )}
                          {meta.orderStatus !== 'completed' && Number(order.dueAmount || order.grandTotal || 0) > 0 && (
                            <button
                              type="button"
                              className="py-1 px-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100"
                              onClick={() => handleCollectCashAndComplete(order)}
                              title="Collect Cash & Complete"
                            >
                              💵 Cash
                            </button>
                          )}
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            onClick={() => navigate(`/app/pos?tableId=${order.tableId || ''}&ref=orders`)}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <Link
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            to={`/app/invoice/sales/${order.id}`}
                            title="Invoice"
                          >
                            <FileText size={14} />
                          </Link>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                            onClick={() => setDeleteOrder(order)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : viewMode === 'kitchen' ? (
        /* View 4: Kitchen Items View (Infinite Scroll) */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Preparation Queue ({kitchenItems.length} items)
            </h3>
            <span className="text-xs text-slate-500">
              Showing {Math.min(visibleCount, kitchenItems.length)} of {kitchenItems.length}
            </span>
          </div>
          
          {kitchenItems.length === 0 ? (
            <div className="rounded-[28px] border border-slate-200 border-dashed bg-white p-12 text-center">
              <ShoppingBag className="mx-auto text-slate-300 mb-3" size={32} />
              <p className="text-sm font-semibold text-slate-700">No active kitchen items</p>
              <p className="text-xs text-slate-400 mt-1">New items will appear here when orders are placed.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {kitchenItems.slice(0, visibleCount).map((item) => {
                const isNew = item.orderStatus === 'new';
                const isCooking = item.orderStatus === 'to_cook';
                
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border bg-white p-4 shadow-xs space-y-3 flex flex-col justify-between transition ${
                      isNew ? 'border-blue-100 bg-blue-50/20' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          item.orderType === 'dine_in' ? 'bg-amber-100 text-amber-800' :
                          item.orderType === 'delivery' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {item.orderType === 'dine_in' ? `Table ${item.tableNo || '?'}` : 
                           item.orderType === 'delivery' ? 'Delivery' : 'Takeaway'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatRelativeDate(item.createdAt)}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-bold text-slate-900 mt-2 flex items-baseline gap-2">
                        <span className="text-xl text-[#9c5f22] font-extrabold">{item.quantity}x</span>
                        <span className="truncate">{item.productName}</span>
                      </h4>
                      
                      {item.note && (
                        <div className="mt-2.5 rounded-lg bg-amber-50 border border-amber-200/50 p-2 text-xs text-amber-900 font-medium flex items-start gap-1.5">
                          <span className="mt-0.5">📝</span>
                          <span className="italic">{item.note}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isNew ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isNew ? 'New Order' : 'Preparing'}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        {isNew && (
                          <button
                            type="button"
                            onClick={() => moveOrderToNextStage(item.orderRaw)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition active:scale-95"
                          >
                            Cook Item
                          </button>
                        )}
                        {isCooking && (
                          <button
                            type="button"
                            onClick={() => moveOrderToNextStage(item.orderRaw)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition active:scale-95"
                          >
                            Mark Ready
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {visibleCount < kitchenItems.length && (
            <div id="kitchen-sentinel" className="py-6 text-center text-sm text-slate-400 font-medium animate-pulse">
              Loading more items...
            </div>
          )}
        </div>
      ) : (
        /* View 3: Single Row Horizontal Kanban Order Board */
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin items-start">
          {visibleBoardColumns.map((column) => (
            <section
              key={column.value}
              className="w-80 sm:w-84 shrink-0 min-h-[550px] flex flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.accent}`} />
                  <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-700">{column.label}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-700">
                  {column.items.length}
                </span>
              </div>

              <div className="mt-4 space-y-3 flex-1 overflow-y-auto pr-1">
                {loading ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 text-center">
                    Loading orders...
                  </div>
                ) : column.items.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-400 text-center flex flex-col items-center justify-center gap-2">
                    <Package2 size={24} className="text-slate-300" />
                    <span>No orders in this column.</span>
                  </div>
                ) : (
                  column.items.map((order) => {
                    const meta = getCafeOrderAttributes(order);
                    const paymentMeta = getCafePaymentMeta(order);
                    const nextStatus = getNextCafeOrderStatus(meta.orderStatus);

                    return (
                      <article
                        key={order.id}
                        className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {meta.orderType === 'delivery' ? (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                🚚 Home Delivery
                              </span>
                            ) : meta.orderType === 'takeaway' ? (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                🛍️ Takeaway
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                                🍽️ Dine-in {meta.tableNo ? `(T${meta.tableNo})` : ''}
                              </span>
                            )}

                            <span className="text-[11px] font-semibold text-slate-400">
                              #{order.invoiceNo || order.id.slice(0, 8)}
                            </span>
                          </div>

                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${paymentMeta.tone}`}>
                            {paymentMeta.label}
                          </span>
                        </div>

                        {/* Customer / Party Box */}
                        {meta.partyName || meta.partyPhone || meta.partyAddress ? (
                          <div className="flex items-start gap-2.5 rounded-2xl bg-amber-50/90 p-3 text-xs text-amber-900 border border-amber-200/80 shadow-2xs">
                            <UserRound size={16} className="text-amber-600 mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1 space-y-1">
                              {meta.partyName && (
                                <p className="font-bold text-sm text-slate-800 truncate">{meta.partyName}</p>
                              )}
                              {meta.partyPhone && (
                                <a href={`tel:${meta.partyPhone}`} className="text-amber-800 font-semibold hover:underline flex items-center gap-1.5">
                                  <Phone size={12} className="text-amber-600" /> {meta.partyPhone}
                                </a>
                              )}
                              {meta.partyAddress && (
                                <p className="text-slate-600 flex items-center gap-1.5 text-xs">
                                  <MapPin size={12} className="text-rose-500 shrink-0" />
                                  <span className="truncate">{meta.partyAddress}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* Items Preview */}
                        {Array.isArray(order.SaleItems) && order.SaleItems.length > 0 ? (
                          <div className="rounded-2xl bg-slate-50 p-2.5 text-xs text-slate-700 space-y-1 border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items ({order.SaleItems.length})</p>
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForItemsDialog(order)}
                                className="text-[10px] font-bold text-[#9c5f22] hover:underline"
                              >
                                View All
                              </button>
                            </div>
                            {order.SaleItems.slice(0, 4).map((si) => (
                              <div key={si.id || si.productId} className="flex justify-between font-medium">
                                <span className="truncate pr-2">{si.quantity}x {si.Product?.name || si.name || 'Item'}</span>
                                <span className="text-slate-500 shrink-0">{formatMoney(si.lineTotal)}</span>
                              </div>
                            ))}
                            {order.SaleItems.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setSelectedOrderForItemsDialog(order)}
                                className="w-full text-center text-[10px] font-bold text-[#9c5f22] hover:underline pt-1 border-t border-slate-200/50 mt-1 block"
                              >
                                + {order.SaleItems.length - 4} more items
                              </button>
                            )}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-slate-400" />
                            <span>{formatRelativeDate(order.createdAt || order.saleDate)}</span>
                          </div>
                          {meta.waiterName && (
                            <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                              {meta.waiterName}
                            </span>
                          )}
                        </div>

                        {order.notes ? (
                          <p className="rounded-2xl bg-amber-50/50 p-2.5 text-xs text-slate-600 border border-amber-100">{order.notes}</p>
                        ) : null}

                        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Total</p>
                            <p className="text-base font-bold text-slate-900">{formatMoney(order.grandTotal)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              title="Edit order"
                              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              onClick={() => navigate(`/app/pos?tableId=${order.tableId || ''}&ref=orders`)}
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
                            <button
                              type="button"
                              title={t('common.delete')}
                              className="rounded-xl p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => setDeleteOrder(order)}
                              disabled={deletingOrderId === order.id}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {nextStatus ? (
                          <button
                            type="button"
                            className="btn-primary w-full justify-center text-xs py-2.5 font-bold"
                            onClick={() => moveOrderToNextStage(order)}
                          >
                            Move to {nextStatus.label}
                            <ArrowRight size={14} className="ml-1.5" />
                          </button>
                        ) : null}

                        {meta.orderStatus !== 'completed' && Number(order.dueAmount || order.grandTotal || 0) > 0 && (
                          <button
                            type="button"
                            className="flex w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 py-2.5 px-3 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition"
                            onClick={() => handleCollectCashAndComplete(order)}
                          >
                            💵 Collect Cash & Complete
                          </button>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      )}

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

                <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <label className="label text-slate-900 font-bold">Customer / Party (Phone Orders)</label>
                      <p className="mt-0.5 text-xs text-slate-500">Record customer name, phone number, and delivery address.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPartySelectorOpen(true)}
                      className="btn-secondary text-xs shrink-0"
                    >
                      {selectedParty ? 'Change Customer' : '+ Select / Add Customer'}
                    </button>
                  </div>
                  {selectedParty ? (
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm">{selectedParty.name}</p>
                        <p className="text-xs text-slate-600">
                          {selectedParty.phone || 'No phone'} {selectedParty.address ? ` · ${selectedParty.address}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedParty(null)}
                        className="text-xs text-rose-600 hover:underline font-semibold"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs italic text-slate-400">No customer party attached (Walk-in Customer).</p>
                  )}
                </div>

                <div className="sm:col-span-2 xl:col-span-4">
                  <label className="label">Notes</label>
                  <NoteTextarea
                    className="input mt-1 h-24 resize-none"
                    value={orderFields.notes}
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

                  <div className="mt-3 flex flex-col gap-4 border-b border-slate-100 pb-3 dark:border-slate-800">
                    {/* Floor Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap">Floor:</span>
                      <button
                        type="button"
                        onClick={() => setDialogFloorFilter('all')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                          dialogFloorFilter === 'all'
                            ? 'bg-[#9b6835] text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        All Floors
                      </button>
                      {floors.map((floor) => (
                        <button
                          key={floor.id}
                          type="button"
                          onClick={() => setDialogFloorFilter(floor.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                            dialogFloorFilter === floor.id
                              ? 'bg-[#9b6835] text-white shadow-sm'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {floor.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDialogFloorFilter('unassigned')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                          dialogFloorFilter === 'unassigned'
                            ? 'bg-[#9b6835] text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        Unassigned
                      </button>
                    </div>

                    {/* Status Filter Chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap">Status:</span>
                      <button
                        type="button"
                        onClick={() => setDialogStatusFilter('all')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                          dialogStatusFilter === 'all'
                            ? 'bg-[#9b6835] text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogStatusFilter('vacant')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                          dialogStatusFilter === 'vacant'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        Vacant
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogStatusFilter('occupied')}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                          dialogStatusFilter === 'occupied'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        Occupied
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {tableMap
                      .filter((table) => {
                        const isOccupied = table.occupied || table.status === 'occupied';
                        // Floor filter
                        if (dialogFloorFilter !== 'all') {
                          if (dialogFloorFilter === 'unassigned') {
                            if (table.categoryId || table.category?.id) return false;
                          } else {
                            const catId = table.categoryId || table.category?.id;
                            if (String(catId) !== String(dialogFloorFilter)) return false;
                          }
                        }
                        // Status filter
                        if (dialogStatusFilter !== 'all') {
                          if (dialogStatusFilter === 'vacant' && isOccupied) return false;
                          if (dialogStatusFilter === 'occupied' && !isOccupied) return false;
                        }
                        return true;
                      })
                      .map((table) => {
                        const selected = orderFields.tableNo === table.id || orderFields.tableNo === table.label;
                        const occupiedByOther = table.occupied && !selected;

                         const isOccupied = table.occupied || table.status === 'occupied';

                         return (
                          <button
                            key={`dialog-table-${table.id}`}
                            type="button"
                            onClick={() => setOrderFields((prev) => ({ ...prev, tableNo: table.id }))}
                            className={`group relative rounded-2xl border p-4 text-left transition duration-200 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between h-28 ${
                              selected
                                ? 'border-[#9b6835] bg-[#9b6835]/10 shadow-sm'
                                : occupiedByOther
                                  ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-800'
                                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span className="text-sm font-bold text-slate-900 truncate max-w-[80px]">{table.label}</span>
                              <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${isOccupied ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                                {isOccupied ? "Occupied" : "Vacant"}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between gap-1 w-full pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-2">
                              <span className="text-[10px] text-slate-400">{table.capacity ? `${table.capacity} seats` : "No limit"}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium border border-slate-200/50 truncate max-w-[70px]">
                                {table.category?.name || "No Floor"}
                              </span>
                            </div>
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

      <ConfirmDialog
        isOpen={Boolean(deleteOrder)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteOrder}
        description={deleteOrder ? t('sales.deleteConfirm', { name: deleteOrder.invoiceNo || deleteOrder.id.slice(0, 8) }) : t('common.confirmDelete')}
        confirming={Boolean(deleteOrder) && deletingOrderId === deleteOrder.id}
      />

      <QuickPartySelector
        isOpen={partySelectorOpen}
        onClose={() => setPartySelectorOpen(false)}
        onSelect={(party) => setSelectedParty(party)}
        selectedParty={selectedParty}
        type="customer"
        title="Select or Add Customer Party"
      />

      {/* Dialog for displaying all items of a selected order */}
      <Dialog
        isOpen={Boolean(selectedOrderForItemsDialog)}
        onClose={() => setSelectedOrderForItemsDialog(null)}
        title={`Order Items - #${selectedOrderForItemsDialog?.invoiceNo || selectedOrderForItemsDialog?.id?.slice(0, 8) || ''}`}
        size="md"
      >
        {selectedOrderForItemsDialog && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <span className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${
                getCafeOrderAttributes(selectedOrderForItemsDialog).orderType === 'delivery' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                getCafeOrderAttributes(selectedOrderForItemsDialog).orderType === 'takeaway' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-purple-100 text-purple-800 border-purple-200'
              }`}>
                {getCafeOrderAttributes(selectedOrderForItemsDialog).orderType === 'delivery' ? '🚚 Home Delivery' :
                 getCafeOrderAttributes(selectedOrderForItemsDialog).orderType === 'takeaway' ? '🛍️ Takeaway' :
                 `🍽️ Dine-in Table ${getCafeOrderAttributes(selectedOrderForItemsDialog).tableNo || '?'}`}
              </span>
              <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                getCafeOrderStatusMeta(getCafeOrderAttributes(selectedOrderForItemsDialog).orderStatus).tone
              }`}>
                {getCafeOrderStatusMeta(getCafeOrderAttributes(selectedOrderForItemsDialog).orderStatus).label}
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
              {Array.isArray(selectedOrderForItemsDialog.SaleItems) && selectedOrderForItemsDialog.SaleItems.map((si) => (
                <div key={si.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="text-[#9c5f22] font-extrabold text-base">{si.quantity}x</span>
                      <span>{si.Product?.name || si.name || 'Unnamed Item'}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">{formatMoney(si.lineTotal)}</p>
                    <p className="text-[10px] text-slate-400">@ {formatMoney(si.unitPrice)}</p>
                  </div>
                </div>
              ))}
            </div>

            {selectedOrderForItemsDialog.notes && (
              <div className="rounded-2xl bg-amber-50/90 border border-amber-200/50 p-3 text-xs text-amber-900 font-medium">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Notes / Instructions:</p>
                <p className="italic">{selectedOrderForItemsDialog.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#f1f5f9] dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedOrderForItemsDialog(null)}
                className="btn-secondary rounded-xl py-2 px-4 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
