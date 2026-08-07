import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, FileText, Package, Plus, Printer, Trash2, TrendingUp, DollarSign, CheckCircle2, Clock, Calendar } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import NoteTextarea from '../components/NoteTextarea.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import MobileFormStepper from '../components/MobileFormStepper.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import QuickPaymentButtons from '../components/QuickPaymentButtons.jsx';
import PartySearchCreateField from '../components/PartySearchCreateField.jsx';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import CreatorFilterSelect from '../components/CreatorFilterSelect.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';
import FileUpload from '../components/FileUpload';
import DynamicAttributes from '../components/DynamicAttributes';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import dayjs, { formatMaybeDate, todayISODate } from '../lib/datetime';
import { useSaleStore } from '../stores/sales';
import { useProductStore } from '../stores/products';
import { getCreatorDisplayName, getCurrentCreatorValue } from '../lib/records';
import StatsCard from '../components/StatsCard.jsx';
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

const TABLE_ROW_OPTIONS = [10, 20, 30, 40, 50];

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
  const { businessId, user, canManageFeature } = useAuth();
  const canManageSales = canManageFeature('sales');
  const { businessProfile } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const createIntentHandledRef = useRef(false);
  const salesFlow = businessProfile?.salesFlow || {};
  const salesTitle = salesFlow.title || t('sales.title');
  const salesSubtitle = salesFlow.attributeSectionHint || t('sales.subtitle');
  const createSaleLabel = salesFlow.createLabel || t('sales.newSale');
  const orderInfoTitle = salesFlow.attributeSectionTitle || t('services.orderInformation');
  const hiddenSaleAttributeKeys = useMemo(
    () => (businessProfile?.type === 'cafe' ? ['order_status'] : []),
    [businessProfile?.type]
  );

  // ── Stores ──
  const { sales: salesList, loading: salesLoading, fetch: fetchSales, invalidate: invalidateSales } = useSaleStore();
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.getSaleStats();
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch sale stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (businessProfile?.id) {
      fetchStats();
    }
  }, [businessProfile?.id, salesList, fetchStats]);
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
    tableId: '',
  });
  const [items, setItems] = useState([]);
  const quantityInputRef = useRef(null);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [itemDraft, setItemDraft] = useState({ ...emptyItem });
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [vacantTables, setVacantTables] = useState([]);

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const [isOpen, setIsOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [deleteSale, setDeleteSale] = useState(null);
  const [deletingSaleId, setDeletingSaleId] = useState('');
  const [savingSale, setSavingSale] = useState(false);
  const [openingSaleForm, setOpeningSaleForm] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mobileStep, setMobileStep] = useState('details');
  const [dateFilter, setDateFilter] = useState('all'); // 'today', 'week', 'month', 'year', 'all'

  const listParams = useMemo(() => ({
    limit: 500,
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
  }, [createdByFilterId, partyFilterId, statusFilter, dateFilter]);

  const resolveCustomerName = (sale) => {
    const direct = getCustomerName(sale);
    if (direct) return direct;

    const id = sale?.partyId || sale?.customerId || sale?.Customer?.id || sale?.Party?.id || null;
    if (id === null || id === undefined || id === '') return t('sales.walkIn');

    return '—';
  };

  const money = (value) => (
    t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(value || 0).toFixed(2) })
  );

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

  const applyQuickReceivedAmount = (nextAmount, { markPaid = false } = {}) => {
    const normalizedAmount = Math.min(Math.max(Number(nextAmount || 0), 0), totals.grandTotal);
    setIsPaid(markPaid && totals.grandTotal > 0);
    setHeader((prev) => ({ ...prev, amountReceived: normalizedAmount.toFixed(2) }));
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

  const getUnitLabel = (product, unitType) => {
    if (!product) return '';
    if (unitType === 'secondary') return product.secondaryUnit || product.primaryUnit || '';
    return product.primaryUnit || product.secondaryUnit || '';
  };

  const syncDraftDefaults = (product) => {
    if (!product) return;
    setItemDraft((prev) => {
      const next = { ...prev };
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
    });
  };

  const handleDraftProductSelection = (option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;

    if (product?.id) {
      cacheProducts([product]);
    }

    setItemDraft((prev) => ({
      ...prev,
      productId: option?.value || '',
      taxRate: String(product?.taxRate || 0),
    }));

    if (product) {
      syncDraftDefaults(product);
      // Auto-focus quantity input after product selection for faster grocery entry
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  };

  const handleDraftChange = (field, value) => {
    if (field === 'unitType') {
      const product = getProductById(itemDraft.productId);
      setItemDraft((prev) => {
        const next = { ...prev, unitType: value };
        if (product) {
          if (value === 'secondary') {
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
          } else if (Number(product.salePrice || 0) > 0) {
            next.unitPrice = String(product.salePrice || 0);
          }
        }
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      });
      return;
    }

    setItemDraft((prev) => {
      const next = { ...prev, [field]: value };
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    });

    if (field === 'productId') {
      const product = getProductById(value);
      if (product) {
        window.setTimeout(() => syncDraftDefaults(product), 0);
      }
    }
  };

  const openItemDialogForCreate = () => {
    setStatus({ type: 'info', message: '' });
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setShowItemDialog(true);
    setMobileStep('items');
  };

  const openItemDialogForEdit = (index) => {
    setStatus({ type: 'info', message: '' });
    setItemDraft({ ...items[index] });
    setEditingItemIdx(index);
    setShowItemDialog(true);
    setMobileStep('items');
  };

  const closeItemDialog = () => {
    setShowItemDialog(false);
    setEditingItemIdx(null);
    setItemDraft({ ...emptyItem });
  };

  const confirmItem = () => {
    if (!itemDraft.productId) {
      setStatus({ type: 'error', message: t('errors.selectProductSale') });
      return;
    }

    if (
      itemDraft.unitType === 'secondary'
      && Number(getProductById(itemDraft.productId)?.conversionRate || 0) <= 0
    ) {
      setStatus({ type: 'error', message: t('errors.conversionRequired') });
      return;
    }

    const draft = {
      ...itemDraft,
      lineTotal: (Number(itemDraft.quantity || 0) * Number(itemDraft.unitPrice || 0)).toFixed(2),
    };

    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((item, index) => (index === editingItemIdx ? draft : item)));
    } else {
      setItems((prev) => [...prev, draft]);
    }

    setStatus({ type: 'info', message: '' });
    closeItemDialog();
  };

  const removeItem = (index) => {
    setItems((prev) => {
      const target = prev[index];
      if (target?.id) setDeletedItemIds((ids) => [...ids, target.id]);
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const filteredSalesByDate = useMemo(() => {
    return salesList.filter((sale) => {
      if (dateFilter === 'all') return true;
      const saleDateStr = sale.saleDate || sale.createdAt;
      if (!saleDateStr) return false;

      const saleDate = dayjs(saleDateStr);
      if (!saleDate.isValid()) return false;

      const now = dayjs();
      if (dateFilter === 'today') {
        return saleDate.isSame(now, 'day');
      }
      if (dateFilter === 'week') {
        return saleDate.isSame(now, 'week');
      }
      if (dateFilter === 'month') {
        return saleDate.isSame(now, 'month');
      }
      if (dateFilter === 'year') {
        return saleDate.isSame(now, 'year');
      }
      return true;
    });
  }, [salesList, dateFilter]);

  // Sales stats are now fetched directly from the backend API stats endpoint

  const exportCsv = () => {
    const rows = [
      [t('common.invoice'), t('common.date'), t('common.status'), t('sales.customer'), t('sales.subTotal'), t('sales.taxTotal'), t('sales.grandTotal'), t('sales.totalReceived'), t('sales.dueLabel')],
      ...filteredSalesByDate.map((s) => [
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
    link.download = `sales-${dateFilter}-${statusFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const totalSales = filteredSalesByDate.length;
  const pagedSales = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSalesByDate.slice(start, start + pageSize);
  }, [page, pageSize, filteredSalesByDate]);

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
      tableId: '',
    });
    setItems([]);
    setDeletedItemIds([]);
    setEditingId(null);
    setFormMode('create');
    setIsPaid(false);
    setSuggestedInvoiceNo('');
    setMobileStep('details');
    setProductDirectory({});
    setSelectedCustomer(null);
    setShowItemDialog(false);
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setStatus({ type: 'info', message: '' });
  };

  const closeDialog = () => {
    setIsOpen(false);
    setMobileStep('details');
    setShowItemDialog(false);
  };

  const loadVacantTables = async (currentTableId = '') => {
    try {
      const data = await api.getTables({ status: 'vacant', isActive: 'true', limit: 100 });
      let items = data?.items || [];
      if (currentTableId && !items.some(t => t.id === currentTableId)) {
        try {
          const currentTable = await api.getTable(currentTableId);
          if (currentTable) {
            items = [currentTable, ...items];
          }
        } catch (e) {
          console.warn('Failed to fetch current table details', e);
        }
      }
      setVacantTables(items);
    } catch (err) {
      console.error('Failed to load vacant tables', err);
    }
  };

  const openCreate = async () => {
    if (!canManageSales) return;
    if (openingSaleForm) return;

    setOpeningSaleForm(true);
    resetForm();
    setMobileStep(isMobile ? 'items' : 'details');
    setIsOpen(true);

    try {
      if (businessId) {
        loadVacantTables();
        try {
          const data = await api.getNextSequences();
          setSuggestedInvoiceNo(data?.nextSaleInvoiceNo || '');
        } catch {
          setSuggestedInvoiceNo('');
        }
      }
    } finally {
      setOpeningSaleForm(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('create') !== '1') {
      createIntentHandledRef.current = false;
      return;
    }

    if (createIntentHandledRef.current) return;
    createIntentHandledRef.current = true;
    openCreate();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('create');
    setSearchParams(nextParams, { replace: true });
  }, [openCreate, searchParams, setSearchParams]);

  const openEdit = async (saleId) => {
    if (!canManageSales) return;
    setStatus({ type: 'info', message: '' });
    try {
      const sale = await api.getSale(saleId);
      const saleItems = sale?.SaleItems || [];
      const party = normalizeLookupParty({
        id: sale.partyId || sale.customerId || sale.Customer?.id || sale.Party?.id,
        partyName: sale.partyName || sale.customerName || sale.Customer?.name || sale.Party?.name,
        phone: sale.partyPhone || sale.Customer?.phone || sale.Party?.phone,
        currentAmount: sale.Party?.currentAmount ?? sale.Customer?.currentAmount ?? null,
        type: 'customer',
      });
      const hydratedProducts = saleItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);
      
      const currentTableId = sale.tableId || sale.Table?.id || sale.table?.id || '';
      loadVacantTables(currentTableId);

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
        tableId: currentTableId,
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
      setItems(mappedItems);
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
    if (!canManageSales) { setStatus({ type: 'error', message: t('staffManagement.permissionError') }); return; }
    if (savingSale) return;
    if (!businessId) { setStatus({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.saleDate) { setStatus({ type: 'error', message: t('errors.saleDateRequired') }); return; }
    if (!items.length) { setStatus({ type: 'error', message: t('sales.addFirstItem') }); return; }
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
      setSavingSale(true);
      const derivedStatus = dueAmount > 0 ? 'due' : 'paid';
      const manualInvoiceNo = String(header.invoiceNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const payload = {
        ...headerFields,
        tableId: header.tableId || null,
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
    } finally {
      setSavingSale(false);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteSale && deletingSaleId === deleteSale.id) return;
    setDeleteSale(null);
  };

  const handleDeleteSale = async () => {
    if (!deleteSale) return;
    if (deletingSaleId === deleteSale.id) return;

    setDeletingSaleId(deleteSale.id);
    setStatus({ type: 'info', message: '' });

    try {
      await api.deleteSale(deleteSale.id);
      setStatus({ type: 'success', message: t('sales.messages.deleted') });
      if (pagedSales.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
      useProductStore.getState().invalidate();
      invalidateSales(listParams);
      await fetchSales(listParams, true);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || t('sales.messages.deleteFailed') });
    } finally {
      setDeletingSaleId('');
      setDeleteSale(null);
    }
  };

  const currentStepIndex = saleSteps.findIndex((step) => step.id === mobileStep);
  const showDetailsStep = !isMobile || mobileStep === 'details';
  const showItemsStep = !isMobile || mobileStep === 'items';
  const showPaymentStep = !isMobile || mobileStep === 'payment';

  // Validation for proceeding to next step
  const canProceedToItems = header.saleDate && (!header.partyId || true); // Customer is optional (walk-in)
  const hasValidItems = items.length > 0 && items.every((item) => item.productId && Number(item.lineTotal || 0) > 0);

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

  const itemDraftProduct = getProductById(itemDraft.productId);
  const itemDraftVatAmount = getVatAmount(itemDraft.lineTotal, itemDraft.taxRate);
  const canSaveDraftItem = Boolean(itemDraft.productId) && Number(itemDraft.lineTotal || 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={salesTitle}
        subtitle={salesSubtitle}
        action={
          canManageSales ? (
            <Link className="btn-primary w-full sm:w-auto" to="/app/pos">
              <Plus size={16} className="mr-1.5 inline" />
              {createSaleLabel}
            </Link>
          ) : null
        }
      />

      {/* ── Period Selector & Analytics Cards ── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white/40 backdrop-blur p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 mr-1.5 whitespace-nowrap shrink-0">
              Period:
            </span>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'year', label: 'This Year' },
              { key: 'all', label: 'All Time' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setDateFilter(item.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                  dateFilter === item.key
                    ? 'bg-[#9c5f22] text-white shadow-sm font-bold'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Showing <strong className="text-slate-900">{stats?.totalCount ?? 0}</strong> order{(stats?.totalCount ?? 0) === 1 ? '' : 's'}
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={t('sales.totalRevenue') || 'Total Revenue'}
            value={money(stats?.totalAmount ?? 0)}
            icon={TrendingUp}
            tone="default"
            loading={statsLoading}
          />
          <StatsCard
            title={t('sales.totalCollected') || 'Total Collected'}
            value={money(stats?.paidAmount ?? 0)}
            icon={DollarSign}
            tone="success"
            loading={statsLoading}
          />
          <StatsCard
            title={t('sales.pendingDue') || 'Pending Due'}
            value={money(stats?.dueAmount ?? 0)}
            icon={Clock}
            tone="danger"
            loading={statsLoading}
          />
          <StatsCard
            title={t('sales.avgOrderValue') || 'Avg Order Value'}
            value={money(stats?.avgOrderValue ?? 0)}
            icon={Package}
            tone="info"
            loading={statsLoading}
          />
        </div>
      </div>

      {/* ── Form Dialog ── */}
      <Dialog
        isOpen={isOpen}
        onClose={closeDialog}
        title={formMode === 'edit' ? t('sales.editSale') : createSaleLabel}
        size="full"
      >
        <div className="md:hidden">
          <MobileFormStepper
            steps={saleSteps}
            currentStep={mobileStep}
            onStepChange={setMobileStep}
            onNext={goToNextMobileStep}
            onBack={goToPrevMobileStep}
            canProceed={mobileStep === 'items' ? hasValidItems : canProceedToItems}
            nextLabel={mobileStep === 'items' ? t('common.continueToPayment') || 'Continue to Payment' : t('common.continue') || 'Continue'}
            backLabel={t('common.back') || 'Back'}
            showNavigation={false}
          />
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {/* {status.message ? <Notice title={status.message} tone={status.type} /> : null} */}

          {showDetailsStep ? (
            <>
              <FormSectionCard>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="label">{t('sales.customer')}</label>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('common.optional')}</span>
                    </div>
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
                  {businessProfile?.settings?.enabledModules?.includes('tables') && (
                    <div>
                      <label className="label">{t('tables.tableName') || 'Table'}</label>
                      <select
                        name="tableId"
                        className="input mt-1"
                        value={header.tableId || ''}
                        onChange={handleHeaderChange}
                      >
                        <option value="">No Table / Takeaway</option>
                        {vacantTables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name} {table.capacity ? `(Cap: ${table.capacity})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </FormSectionCard>

              <FormSectionCard>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="order-2 lg:order-1">
                    <label className="label">{t('sales.notes')}</label>
                    <NoteTextarea
                      className="input mt-1 h-24 resize-none"
                      name="notes"
                      value={header.notes}
                      onChange={handleHeaderChange}
                      placeholder={t('sales.notesPlaceholder')}
                    />
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

              <FormSectionCard title={orderInfoTitle} hint={salesFlow.attributeSectionHint || undefined}>
                <DynamicAttributes
                  entityType="sale"
                  attributes={header.attributes}
                  hiddenKeys={hiddenSaleAttributeKeys}
                  onChange={(attr) => setHeader((prev) => ({ ...prev, attributes: attr }))}
                />
              </FormSectionCard>
            </>
          ) : null}

          {showItemsStep ? (
            <FormSectionCard
              title={t('sales.items')}
              action={(
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-sm font-semibold text-slate-500">{items.length} {t('sales.items')}</span>
                  <button className="btn-ghost w-full sm:w-auto" type="button" onClick={openItemDialogForCreate}>
                    {t('sales.addItem')}
                  </button>
                </div>
              )}
            >
              <div className="space-y-4">
                {items.length ? items.map((item, idx) => {
                  const product = getProductById(item.productId);
                  const itemHeading = product?.name || `${t('sales.product')} ${idx + 1}`;
                  const unitLabel = getUnitLabel(product, item.unitType);

                  return (
                    <div key={`item-${idx}`} className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-3.5 dark:border-slate-800/60 dark:bg-slate-900/40">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                              <Package size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-slate-900 dark:text-white">{itemHeading}</p>
                                {unitLabel ? (
                                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                    {unitLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                  {t('sales.qty')}: {item.quantity}
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                  {t('sales.unitPrice')}: {money(item.unitPrice)}
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                  {t('sales.tax')}: {Number(item.taxRate || 0).toFixed(2)}%
                                </span>
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-primary-900/70">
                                  {t('common.total')}: {money(item.lineTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 xl:pl-4">
                          <button className="btn-ghost flex-1 text-sm xl:flex-none" type="button" onClick={() => openItemDialogForEdit(idx)}>
                            <Pencil size={14} className="mr-1.5 inline" />
                            {t('common.edit')}
                          </button>
                          <button
                            className="btn-ghost flex-1 border-rose-200 text-sm text-rose-600 hover:bg-rose-50 xl:flex-none dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20"
                            type="button"
                            onClick={() => removeItem(idx)}
                          >
                            {t('common.remove')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('sales.addFirstItem')}</p>
                    <button className="btn-primary mt-4 w-full sm:w-auto" type="button" onClick={openItemDialogForCreate}>
                      <Plus size={15} className="mr-1.5 inline" />
                      {t('sales.addItem')}
                    </button>
                  </div>
                )}
              </div>
            </FormSectionCard>
          ) : null}

          <Dialog
            isOpen={showItemDialog}
            onClose={closeItemDialog}
            title={editingItemIdx !== null ? t('sales.editItem') : t('sales.addItem')}
            size="xl"
            footer={(
              <>
                <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeItemDialog}>
                  {t('common.cancel')}
                </button>
                <button className="btn-primary w-full sm:w-auto" type="button" onClick={confirmItem} disabled={!canSaveDraftItem}>
                  {editingItemIdx !== null ? t('common.update') : t('common.add')}
                </button>
              </>
            )}
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-200">
                    {t('sales.itemComposerTitle')}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {t('sales.itemComposerHint')}
                  </p>
                </div>

                <div>
                  <label className="label">{t('sales.product')}</label>
                  <AsyncSearchableSelect
                    className="mt-1"
                    value={itemDraft.productId}
                    selectedOption={itemDraftProduct ? toProductLookupOption(itemDraftProduct) : null}
                    onChange={handleDraftProductSelection}
                    loadOptions={loadProductOptions}
                    placeholder={t('purchases.selectProduct')}
                    searchPlaceholder={t('purchases.selectProduct')}
                    noResultsLabel={t('common.noData')}
                    loadingLabel={t('common.loading')}
                    renderOption={(option) => (
                      <div className="flex items-center gap-2">
                        {option.entity?.imageUrl ? (
                          <img src={option.entity.imageUrl} alt={option.label} className="h-6 w-6 rounded object-cover border border-slate-200 dark:border-slate-800" />
                        ) : (
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-400 dark:bg-slate-800">
                            {option.entity?.name?.charAt(0).toUpperCase() || 'P'}
                          </div>
                        )}
                        <span>{option.label}</span>
                      </div>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('sales.qty')}</label>
                    <input
                      ref={quantityInputRef}
                      className="input mt-1"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={itemDraft.quantity}
                      onChange={(event) => handleDraftChange('quantity', event.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getUnitLabel(itemDraftProduct, itemDraft.unitType)}</p>
                  </div>
                  <div>
                    <label className="label">{t('products.unitType')}</label>
                    <select
                      className="input mt-1"
                      value={itemDraft.unitType}
                      onChange={(event) => handleDraftChange('unitType', event.target.value)}
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
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={itemDraft.unitPrice}
                      onChange={(event) => handleDraftChange('unitPrice', event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">{t('sales.tax')}</label>
                    <input
                      className="input mt-1"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="1"
                      value={itemDraft.taxRate}
                      onChange={(event) => handleDraftChange('taxRate', event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-primary-200 bg-primary-50/60 p-4 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/15">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">{t('common.total')}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{money(itemDraft.lineTotal)}</p>
                <div className="mt-4 flex flex-col gap-3">
                  <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('sales.taxTotal')}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200">{money(itemDraftVatAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('sales.product')}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{itemDraftProduct?.name || '—'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('products.unitType')}</p>
                    <p className="mt-1 text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{getUnitLabel(itemDraftProduct, itemDraft.unitType) || t('products.primaryUnit')}</p>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>

          {showPaymentStep ? (
            <FormSectionCard title={t('payments.summaryTitle')}>
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('sales.subTotal')}</span>
                  <span className="font-semibold text-slate-800">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.subTotal.toFixed(2) })}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">{t('sales.taxTotal')}</span>
                  <span className="font-semibold text-slate-800">{t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.taxTotal.toFixed(2) })}</span>
                </div>
                <div className="flex justify-between gap-3">
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
                      <QuickPaymentButtons
                        disabled={totals.grandTotal <= 0}
                        onNoPayment={() => applyQuickReceivedAmount(0)}
                        onHalfPayment={() => applyQuickReceivedAmount(totals.grandTotal / 2)}
                        onFullPayment={() => applyQuickReceivedAmount(totals.grandTotal, { markPaid: true })}
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
              <button className="btn-primary w-full sm:w-auto" type="submit" disabled={savingSale}>
                {savingSale
                  ? t('common.saving')
                  : formMode === 'edit' ? t('sales.updateSale') : t('sales.saveSale')}
              </button>
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
                      {(sale.Table || sale.table || sale.tableId) && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            Table: {sale.Table?.name || sale.table?.name || sale.tableId}
                          </span>
                        </div>
                      )}
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
                  <div className="mt-3 flex items-center justify-end border-t border-slate-200/50 pt-2.5 dark:border-slate-700/40">
                    <ActionMenu
                      actions={[
                        ...(canManageSales ? [{ label: t('common.edit'), icon: Pencil, onClick: () => openEdit(sale.id) }] : []),
                        { label: 'View Bill', icon: FileText, to: `/app/invoice/sales/${sale.id}` },
                        { label: 'Print Bill', icon: Printer, to: `/app/invoice/sales/${sale.id}?print=1` },
                        { label: 'Print Thermal', icon: Printer, to: `/app/invoice/sales/${sale.id}?thermal=1` },
                        ...(canManageSales
                          ? [{
                            label: t('common.delete'),
                            icon: Trash2,
                            tone: 'danger',
                            disabled: deletingSaleId === sale.id,
                            onClick: () => setDeleteSale(sale),
                          }]
                          : []),
                      ]}
                    />
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
                        {(sale.Table || sale.table || sale.tableId) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              Table: {sale.Table?.name || sale.table?.name || sale.tableId}
                            </span>
                          </div>
                        )}
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
                        <ActionMenu
                          actions={[
                            ...(canManageSales ? [{ label: t('common.edit'), icon: Pencil, onClick: () => openEdit(sale.id) }] : []),
                            { label: 'View Bill', icon: FileText, to: `/app/invoice/sales/${sale.id}` },
                            { label: 'Print Bill', icon: Printer, to: `/app/invoice/sales/${sale.id}?print=1` },
                            { label: 'Print Thermal', icon: Printer, to: `/app/invoice/sales/${sale.id}?thermal=1` },
                            ...(canManageSales
                              ? [{
                                label: t('common.delete'),
                                icon: Trash2,
                                tone: 'danger',
                                disabled: deletingSaleId === sale.id,
                                onClick: () => setDeleteSale(sale),
                              }]
                              : []),
                          ]}
                        />
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
          pageSizeOptions={TABLE_ROW_OPTIONS}
        />
      </div>

      <ConfirmDialog
        isOpen={Boolean(deleteSale)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteSale}
        description={deleteSale ? t('sales.deleteConfirm', { name: deleteSale.invoiceNo || deleteSale.id.slice(0, 8) }) : t('common.confirmDelete')}
        confirming={Boolean(deleteSale) && deletingSaleId === deleteSale.id}
      />
    </div>
  );
}
