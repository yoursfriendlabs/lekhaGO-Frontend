import { useEffect, useMemo, useRef, useState } from 'react';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import InvoiceHeader from '../components/InvoiceHeader';
import MobileFormStepper from '../components/MobileFormStepper.jsx';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import CreatorFilterSelect from '../components/CreatorFilterSelect.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { getServicesDisplayLabel } from '../lib/businessTypeConfig.js';
import { useI18n } from '../lib/i18n.jsx';
import FileUpload from '../components/FileUpload';
import DynamicAttributes from '../components/DynamicAttributes';
import {
  getJewelleryBreakdown,
  getPurityOptionsForMetal,
  JEWELLERY_ATTRIBUTE_KEYS,
  METAL_TYPE_OPTIONS,
  normalizeJewelleryAttributes,
} from '../lib/jewellery.js';
import {
  X,
  Plus,
  Clock,
  Check,
  Search,
  Pencil,
  FileText,
  ChevronDown,
  Phone,
  ArrowRight,
  CalendarDays,
  LayoutList,
  Package,
  Sparkles,
  UserRound,
  Wallet,
  Wrench,
  MessageCircle,
} from 'lucide-react';
import { usePartyStore } from '../stores/parties';
import { useServiceStore } from '../stores/services';
import { useProductStore } from '../stores/products';
import { getCreatorDisplayName, getCurrentCreatorValue } from '../lib/records';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useIsMobile } from '../hooks/useIsMobile.js';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { getDueWhatsAppMessage, getWhatsAppLink } from '../lib/whatsapp.js';
import {
  mergeLookupEntities,
  normalizeLookupParty,
  normalizeLookupProduct,
  toProductLookupOption,
} from '../lib/lookups.js';

import dayjs, { formatMaybeDate, todayISODate, toDateInputValue } from '../lib/datetime';
import { getPartyBalanceMeta } from '../lib/partyBalances.js';


const emptyItem = {
  itemType: 'labor',
  description: '',
  productId: '',
  quantity: '1',
  unitType: 'primary',
  unitPrice: '0',
  taxRate: '0',
  lineTotal: '0',
};

const makeEmptyHeader = () => ({
  partyId: '',
  orderNo: '',
  status: 'open',
  notes: '',
  deliveryDate: todayISODate(),
  paymentMethod: 'cash',
  bankId: '',
  paymentNote: '',
  attachment: '',
  attachments: [],
  attributes: {},
});

function normalizeAttachmentUrls(...values) {
  const next = [];
  const seen = new Set();

  const addValue = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }

    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    next.push(normalized);
  };

  values.forEach(addValue);
  return next;
}

function getServiceAttachmentUrls(record) {
  return normalizeAttachmentUrls(record?.attachments, record?.attachment);
}

function isPdfAttachment(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url || ''));
}

function AttachmentPreview({ url, onOpen, size = 'sm' }) {
  const sizeClass = size === 'lg' ? 'h-24 w-24' : size === 'md' ? 'h-14 w-14' : 'h-9 w-9';
  const { businessProfile } = useBusinessSettings();
  const servicesFlow = businessProfile?.servicesFlow || {};
  const servicesEnabled = servicesFlow.enabled !== false;

  if (!servicesEnabled) {
    return (
      <div className="space-y-6">
        <Notice
          title="This business type does not use the service workflow."
          description="Switch to the sales/POS flow for billing, or change the business type if this workspace should track repairs."
          tone="warn"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:opacity-80 dark:border-slate-800 dark:bg-slate-900 ${sizeClass}`}
      onClick={() => onOpen(url)}
    >
      {isPdfAttachment(url) ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-900/90 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-slate-100 dark:text-slate-900">
          <FileText size={14} />
          PDF
        </div>
      ) : (
        <img src={url} alt="Attachment" className="h-full w-full object-cover" />
      )}
    </button>
  );
}

function AttachmentStrip({ urls = [], onOpen, maxVisible = 3, size = 'sm' }) {
  if (!urls.length) return null;

  const visibleUrls = urls.slice(0, maxVisible);
  const hiddenCount = urls.length - visibleUrls.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visibleUrls.map((url) => (
        <AttachmentPreview key={url} url={url} onOpen={onOpen} size={size} />
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-2xl bg-slate-100 px-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function getDeliveryDaysLeft(deliveryDate) {
  if (!deliveryDate) return null;
  const today = dayjs().startOf('day');
  const d = dayjs(deliveryDate).startOf('day');
  if (!d.isValid()) return null;
  return d.diff(today, 'day');
}

function DeliveryBadge({ date }) {
  if (!date) return <span className="text-slate-400">—</span>;
  const days = getDeliveryDaysLeft(date);
  const label = formatMaybeDate(date, 'D MMM');
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold';
  if (days < 0) {
    return (
      <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
        <Clock size={10} /> {label} · Overdue
      </span>
    );
  }
  if (days < 3) {
    return (
      <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300`}>
        <Clock size={10} /> {label} · {days}d left
      </span>
    );
  }
  if (days < 8) {
    return (
      <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`}>
        <Clock size={10} /> {label} · {days}d left
      </span>
    );
  }
  return <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>;
}

function getVatAmount(lineTotal, taxRate) {
  return (Number(lineTotal || 0) * Number(taxRate || 0)) / 100;
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeServiceItem(item) {
  const quantity = toFiniteNumber(item?.quantity, 0);
  const unitPrice = toFiniteNumber(item?.unitPrice, 0);
  const lineTotal = toFiniteNumber(item?.lineTotal, quantity * unitPrice);

  return {
    ...item,
    itemType: item?.itemType || 'labor',
    description: item?.description || '',
    productId: item?.productId || '',
    quantity,
    unitType: item?.unitType || 'primary',
    unitPrice,
    taxRate: toFiniteNumber(item?.taxRate, 0),
    lineTotal,
  };
}

function getServiceItems(record) {
  if (Array.isArray(record)) return record.map(normalizeServiceItem);
  if (!record || typeof record !== 'object') return [];
  if (Array.isArray(record.items)) return record.items.map(normalizeServiceItem);
  if (Array.isArray(record.ServiceItems)) return record.ServiceItems.map(normalizeServiceItem);
  return [];
}

function getComputedServiceTotals(items, attributes = {}) {
  const jewellery = getJewelleryBreakdown(attributes);
  const laborTotal = items
    .filter((item) => item.itemType === 'labor')
    .reduce((sum, item) => sum + toFiniteNumber(item.lineTotal, 0), 0)
    + jewellery.diamondChargeNumber;
  const partsTotal = items
    .filter((item) => item.itemType === 'part')
    .reduce((sum, item) => sum + toFiniteNumber(item.lineTotal, 0), 0);
  const subTotal = laborTotal + partsTotal;
  const taxTotal = items.reduce((sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate), 0)
    + jewellery.additionalTaxNumber;
  const grandTotal = subTotal + taxTotal;

  return {
    laborTotal,
    partsTotal,
    subTotal,
    taxTotal,
    grandTotal,
  };
}

function getServiceOrderTotals(record) {
  const items = getServiceItems(record);
  const computed = getComputedServiceTotals(items, record?.attributes || {});
  const laborTotal = toFiniteNumber(record?.laborTotal, computed.laborTotal);
  const partsTotal = toFiniteNumber(record?.partsTotal, computed.partsTotal);
  const subTotal = toFiniteNumber(record?.subTotal, laborTotal + partsTotal);
  const taxTotal = toFiniteNumber(record?.taxTotal, computed.taxTotal);
  const grandTotal = toFiniteNumber(record?.grandTotal, subTotal + taxTotal);

  return {
    laborTotal,
    partsTotal,
    subTotal,
    taxTotal,
    grandTotal,
  };
}

function normalizeServiceOrder(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;

  const items = getServiceItems(record);
  const normalizedAttributes = normalizeJewelleryAttributes(record.attributes || {});
  const totals = getServiceOrderTotals({ ...record, items, attributes: normalizedAttributes });

  return {
    ...record,
    attributes: normalizedAttributes,
    items,
    ServiceItems: Array.isArray(record.ServiceItems) ? record.ServiceItems : items,
    ...totals,
    receivedTotal: toFiniteNumber(record.receivedTotal, 0),
  };
}

function OverviewMetric({ icon: Icon, label, value, tone = 'slate' }) {
  const styles = {
    slate: {
      wrapper: 'border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40',
      icon: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    },
    blue: {
      wrapper: 'border-blue-200/70 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-900/20',
      icon: 'bg-blue-600 text-white',
    },
    amber: {
      wrapper: 'border-amber-200/70 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-900/20',
      icon: 'bg-amber-500 text-white',
    },
    rose: {
      wrapper: 'border-rose-200/70 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-900/20',
      icon: 'bg-rose-500 text-white',
    },
  };

  const palette = styles[tone] || styles.slate;

  return (
    <div className={`rounded-[24px] border p-4 shadow-sm shadow-slate-200/20 ${palette.wrapper}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 whitespace-nowrap text-lg font-semibold leading-tight text-slate-900 dark:text-white sm:text-xl xl:text-xl">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${palette.icon}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700/70 dark:bg-primary-900/30 dark:text-primary-200'
          : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function SummaryPill({ icon: Icon, label, value, valueClassName = '' }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm shadow-primary-950/5 backdrop-blur dark:border-slate-800/60 dark:bg-slate-950/50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-primary-50 p-2 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className={`mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white ${valueClassName}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function isPlaceholderItem(item) {
  if (!item) return true;
  return !String(item.description || '').trim()
    && !String(item.productId || '').trim()
    && Number(item.unitPrice || 0) === 0
    && Number(item.lineTotal || 0) === 0
    && Number(item.quantity || 1) === 1;
}

function StatusBadge({ status }) {
  const map = {
    open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };
  const label =
    status === 'in_progress' ? 'In progress'
    : status ? status.charAt(0).toUpperCase() + status.slice(1)
    : '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

const STATUS_STEPS = [
  {
    value: 'open',
    label: 'Open',
    desc: 'Awaiting work to begin',
    selectedClass: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    dotClass: 'bg-blue-500',
    checkClass: 'text-blue-600',
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    desc: 'Currently being worked on',
    selectedClass: 'border-amber-400 bg-amber-50 dark:bg-amber-900/20',
    dotClass: 'bg-amber-500',
    checkClass: 'text-amber-600',
  },
  {
    value: 'closed',
    label: 'Closed',
    desc: 'Work completed',
    selectedClass: 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    dotClass: 'bg-emerald-500',
    checkClass: 'text-emerald-600',
  },
];

export default function Services() {
  const { t } = useI18n();
  const { businessId, user } = useAuth();
  const isMobile = useIsMobile();
  const { settings: bizSettings, businessProfile } = useBusinessSettings();
  const businessType = String(businessProfile?.type || '').toLowerCase();
  const showGoldJewelleryDetails = businessType === 'gold';
  const servicesFlow = businessProfile?.servicesFlow || {};
  const servicesEnabled = servicesFlow.enabled !== false;
  const servicesTitle = getServicesDisplayLabel(businessProfile, servicesFlow.title || t('services.title'));
  const servicesSubtitle = servicesFlow.attributeSectionHint || t('services.subtitle');
  const newOrderLabel = businessType === 'jewellery' || businessType === 'gold'
    ? 'New Repair Order'
    : t('services.newOrder');

  const { upsert: upsertParty } = usePartyStore();
  const { services: serviceList, loading: listLoading, fetch: fetchServices, invalidate: invalidateServices } = useServiceStore();
  const [suggestedOrderNo, setSuggestedOrderNo] = useState('');
  const [productDirectory, setProductDirectory] = useState({});

  // ── List state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [listError, setListError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // ── New order dialog ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formNotice, setFormNotice] = useState({ type: '', message: '' });

  // ── Payment dialog ──
  const [payDialog, setPayDialog] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payPaymentMethod, setPayPaymentMethod] = useState('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payError, setPayError] = useState('');

  // ── Status dialog ──
  const [statusDialog, setStatusDialog] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusError, setStatusError] = useState('');

  // ── Party filter ──
  const [partyFilterId, setPartyFilterId] = useState('');
  const [selectedPartyFilterOption, setSelectedPartyFilterOption] = useState(null);
  const [createdByFilterId, setCreatedByFilterId] = useState('');

  // ── Edit state ──
  const [editingId, setEditingId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Lightbox ──
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // ── Invoice modal ──
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // ── Attribute definitions for invoice display ──
  const [attributeDefs, setAttributeDefs] = useState([]);
  const safeServiceList = useMemo(
    () => (Array.isArray(serviceList) ? serviceList.map(normalizeServiceOrder) : []),
    [serviceList]
  );
  const safeAttributeDefs = Array.isArray(attributeDefs) ? attributeDefs : [];

  // ── Form data ──
  const [partyQuery, setPartyQuery] = useState('');
  const debouncedPartyQuery = useDebouncedValue(partyQuery, 250);
  const [partySearchResults, setPartySearchResults] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [header, setHeader] = useState(() => makeEmptyHeader());
  const [items, setItems] = useState([]);
  const [amountReceived, setAmountReceived] = useState('0');
  const [isPaid, setIsPaid] = useState(false);

  // ── Items inline form ──
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemDraft, setItemDraft] = useState({ ...emptyItem });
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [mobileStep, setMobileStep] = useState('details');
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState(false);
  const jewelleryAttributes = useMemo(() => normalizeJewelleryAttributes(header.attributes), [header.attributes]);
  const jewelleryDetails = useMemo(() => getJewelleryBreakdown(jewelleryAttributes), [jewelleryAttributes]);
  const activeJewelleryDetails = useMemo(
    () => (showGoldJewelleryDetails ? jewelleryDetails : getJewelleryBreakdown({})),
    [jewelleryDetails, showGoldJewelleryDetails]
  );
  const jewelleryPurityOptions = useMemo(
    () => getPurityOptionsForMetal(jewelleryAttributes.metalType),
    [jewelleryAttributes.metalType]
  );
  const listParams = useMemo(() => ({
    limit: 50,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(partyFilterId ? { partyId: partyFilterId } : {}),
    ...(createdByFilterId ? { createdBy: createdByFilterId } : {}),
  }), [createdByFilterId, partyFilterId, statusFilter]);

  // ── Load services list ──
  const loadServices = () => {
    invalidateServices(listParams);
    fetchServices(listParams, true).catch((err) => setListError(err.message));
  };

  useEffect(() => {
    if (!businessId) return;
    fetchServices(listParams).catch((err) => setListError(err.message));
  }, [businessId, fetchServices, listParams]);

  useEffect(() => {
    setPage(1);
  }, [createdByFilterId, partyFilterId, statusFilter]);

  useEffect(() => {
    const search = debouncedPartyQuery.trim();

    if (!search || selectedParty) {
      setPartySearchResults([]);
      return;
    }

    let isActive = true;

    api.lookupParties({ search, type: 'customer', limit: 10 })
      .then((results) => {
        if (!isActive) return;
        setPartySearchResults((results?.items || []).map(normalizeLookupParty));
      })
      .catch(() => {
        if (!isActive) return;
        setPartySearchResults([]);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedPartyQuery, selectedParty]);

  useEffect(() => {
    api.listOrderAttributes({ entityType: 'service' })
      .then((response) => {
        const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
        setAttributeDefs(items);
      })
      .catch(() => null);
  }, []);

  const chargeableItems = useMemo(() => items.filter((item) => !isPlaceholderItem(item)), [items]);

  // ── Totals ──
  const totals = useMemo(() => {
    const laborTotal = chargeableItems
      .filter((i) => i.itemType === 'labor')
      .reduce((s, i) => s + Number(i.lineTotal || 0), 0)
      + activeJewelleryDetails.diamondChargeNumber;
    const partsTotal = chargeableItems
      .filter((i) => i.itemType === 'part')
      .reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const subTotal = laborTotal + partsTotal;
    const taxTotal = chargeableItems.reduce((sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate), 0)
      + activeJewelleryDetails.additionalTaxNumber;
    const grandTotal = subTotal + taxTotal;
    const received = isPaid ? grandTotal : Math.min(Number(amountReceived || 0), grandTotal);
    const due = Math.max(grandTotal - received, 0);
    return {
      laborTotal,
      partsTotal,
      subTotal,
      taxTotal,
      grandTotal,
      received,
      due,
      diamondCharge: activeJewelleryDetails.diamondChargeNumber,
      additionalTax: activeJewelleryDetails.additionalTaxNumber,
    };
  }, [activeJewelleryDetails.additionalTaxNumber, activeJewelleryDetails.diamondChargeNumber, amountReceived, chargeableItems, isPaid]);

  const visibleItems = useMemo(() => items.filter((item) => !isPlaceholderItem(item)), [items]);

  const formSteps = useMemo(() => ([
    { id: 'details', label: t('services.detailStep') },
    { id: 'items', label: t('services.itemsStep') },
    { id: 'payment', label: t('services.paymentStep') },
  ]), [t]);

  const mobileStepIndex = formSteps.findIndex((step) => step.id === mobileStep);
  const canGoBackStep = mobileStepIndex > 0;
  const canGoForwardStep = mobileStepIndex >= 0 && mobileStepIndex < formSteps.length - 1;

  useEffect(() => {
    if (isPaid) setAmountReceived(totals.grandTotal.toFixed(2));
  }, [isPaid, totals.grandTotal]);

  useEffect(() => {
    if (!dialogOpen || !isMobile) return undefined;
    setMobileSummaryExpanded(false);
    const node = formScrollRef.current;
    if (!node) return undefined;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTo({ top: 0, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogOpen, isMobile, mobileStep]);

  // ── Product helpers ──
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

  const getUnitLabel = (product, unitType) => {
    if (!product) return '';
    return unitType === 'secondary'
      ? product.secondaryUnit || product.primaryUnit || ''
      : product.primaryUnit || product.secondaryUnit || '';
  };

  const syncItemDefaults = (index, product, draft = false) => {
    if (!product) return;
    if (draft) {
      setItemDraft((prev) => {
        const next = { ...prev };
        if (!next.unitType) next.unitType = 'primary';
        if (next.unitType === 'secondary') {
          const explicit = Number(product.secondarySalePrice || 0);
          if (explicit > 0) {
            next.unitPrice = String(explicit);
          } else {
            const rate = Number(product.conversionRate || 0);
            const primary = Number(product.salePrice || 0);
            if (rate > 0 && primary > 0) next.unitPrice = String((primary / rate).toFixed(4));
          }
        } else if (next.unitType === 'primary' && Number(product.salePrice || 0) > 0) {
          next.unitPrice = String(product.salePrice);
        }
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      });
      return;
    }
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item };

        if (!next.unitType) next.unitType = 'primary';
        if (next.unitType === 'secondary') {
          const explicit = Number(product.secondarySalePrice || 0);
          if (explicit > 0) {
            next.unitPrice = String(explicit);
          } else {
            const rate = Number(product.conversionRate || 0);
            const primary = Number(product.salePrice || 0);
            if (rate > 0 && primary > 0) next.unitPrice = String((primary / rate).toFixed(4));
          }
        } else if (next.unitType === 'primary' && Number(product.salePrice || 0) > 0) {
          next.unitPrice = String(product.salePrice);
        }
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      })
    );
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const updateJewelleryAttribute = (key, value) => {
    setHeader((prev) => {
      const nextAttributes = {
        ...(prev.attributes || {}),
        [key]: value,
      };

      if (key === 'metalType') {
        const nextPurityOptions = getPurityOptionsForMetal(value);
        if (nextPurityOptions.length > 0 && !nextPurityOptions.includes(nextAttributes.metalPurity)) {
          nextAttributes.metalPurity = '';
        }
      }

      return {
        ...prev,
        attributes: normalizeJewelleryAttributes(nextAttributes),
      };
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === 'itemType' && value === 'labor') {
          next.productId = '';
          next.unitType = 'primary';
        }
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      })
    );
    if (field === 'productId' || field === 'unitType') {
      const productId = field === 'productId' ? value : items[index]?.productId;
      const product = getProductById(productId);
      if (product) syncItemDefaults(index, product);
    }
  };

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleDraftProductSelection = (option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;

    if (product?.id) {
      cacheProducts([product]);
    }

    setItemDraft((previous) => ({
      ...previous,
      productId: option?.value || '',
      taxRate: String(product?.taxRate || 0),
      actualUnit: '',
    }));

    if (product) {
      syncItemDefaults(null, product, true);
    }
  };

  // ── Item draft helpers ──
  const handleDraftChange = (field, value, actualUnit) => {
    // unitType change needs to re-price from product immediately
    if (field === 'unitType') {
      const product = getProductById(itemDraft.productId);
      setItemDraft((prev) => {
        const next = { ...prev, unitType: value };
        if (product) {
          if (value === 'secondary') {
            const explicit = Number(product.secondarySalePrice || 0);
            if (explicit > 0) {
              next.unitPrice = String(explicit);
            } else {
              const rate = Number(product.conversionRate || 0);
              const primary = Number(product.salePrice || 0);
              if (rate > 0 && primary > 0) next.unitPrice = String((primary / rate).toFixed(4));
            }
          } else if (value === 'primary' && Number(product.salePrice || 0) > 0) {
            next.unitPrice = String(product.salePrice);
          }
        }
        next.actualUnit = actualUnit;
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      });
      return;
    }

    setItemDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'itemType' && value === 'labor') {
        next.productId = '';
        next.unitType = 'primary';
      }
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    });
    if (field === 'productId') {
      const product = getProductById(value);
      if (product) setTimeout(() => syncItemDefaults(null, product, true), 0);
    }
  };

  const startAddItem = () => {
    setFormNotice({ type: '', message: '' });
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setShowItemForm(true);
    setMobileStep('items');
  };

  const startEditItem = (idx) => {
    setFormNotice({ type: '', message: '' });
    setItemDraft({ ...items[idx] });
    setEditingItemIdx(idx);
    setShowItemForm(true);
    setMobileStep('items');
  };

  const cancelItemForm = () => {
    setShowItemForm(false);
    setEditingItemIdx(null);
    setItemDraft({ ...emptyItem });
  };

  const confirmItem = () => {
    if (itemDraft.itemType === 'part' && !itemDraft.productId) {
      setFormNotice({ type: 'error', message: t('errors.selectProductPart') });
      return;
    }

    if (
      itemDraft.itemType === 'part'
      && itemDraft.unitType === 'secondary'
      && Number(getProductById(itemDraft.productId)?.conversionRate || 0) <= 0
    ) {
      setFormNotice({ type: 'error', message: t('errors.conversionRequired') });
      return;
    }

    const draft = {
      ...itemDraft,
      lineTotal: (Number(itemDraft.quantity || 0) * Number(itemDraft.unitPrice || 0)).toFixed(2),
    };
    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((item, idx) => (idx === editingItemIdx ? draft : item)));
    } else {
      setItems((prev) => [...prev, draft]);
    }
    setFormNotice({ type: '', message: '' });
    setShowItemForm(false);
    setEditingItemIdx(null);
    setItemDraft({ ...emptyItem });
  };

  // ── Party helpers ──
  const filteredParties = useMemo(() => {
    return partySearchResults.slice(0, 6);
  }, [partySearchResults]);
  const selectedPartyBalanceMeta = getPartyBalanceMeta(selectedParty?.currentAmount, t);
  const selectedPartyHasBalance = selectedParty?.currentAmount !== undefined && selectedParty?.currentAmount !== null;
  const selectedPartyHasDue = selectedPartyHasBalance && selectedPartyBalanceMeta.absoluteAmount > 0;
  const selectedPartyWhatsAppMessage = getDueWhatsAppMessage(
    selectedParty?.name,
    selectedPartyHasDue
      ? t('currency.formatted', {
          symbol: t('currency.symbol'),
          amount: selectedPartyBalanceMeta.absoluteAmount.toFixed(2),
        })
      : '',
  );
  const selectedPartyWhatsAppLink = getWhatsAppLink(selectedParty?.phone, selectedPartyWhatsAppMessage);
  const createPartyRequestRef = useRef(false);

  const selectParty = (party) => {
    setSelectedParty(party);
    setHeader((prev) => ({ ...prev, partyId: party.id }));
    setPartyQuery(`${party.name}${party.phone ? ` (${party.phone})` : ''}`);
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone('');
    setPartySearchResults([]);
  };

  const clearParty = () => {
    setSelectedParty(null);
    setHeader((prev) => ({ ...prev, partyId: '' }));
    setPartyQuery('');
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone('');
    setPartySearchResults([]);
  };

  const handlePartySearch = (e) => {
    setPartyQuery(e.target.value);
    setPartyDropdownOpen(true);
    setShowAddNew(false);
    if (selectedParty) {
      setSelectedParty(null);
      setHeader((prev) => ({ ...prev, partyId: '' }));
    }
  };

  const createAndSelectParty = async () => {
    if (createPartyRequestRef.current) return;

    const name = partyQuery.trim().replace(/\s*\(.*\)\s*$/, '').trim();
    if (!name) {
      setFormNotice({ type: 'error', message: t('errors.customerRequired') });
      return;
    }
    const phoneDigits = newPartyPhone.trim().replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setFormNotice({ type: 'error', message: t('errors.phoneMinDigits') });
      return;
    }

    createPartyRequestRef.current = true;
    setCreatingParty(true);
    setFormNotice({ type: '', message: '' });

    try {
      const createdParty = await api.createParty({ name, phone: newPartyPhone.trim(), type: 'customer' });
      const party = normalizeLookupParty(createdParty);
      upsertParty(party);
      selectParty(party);
      setFormNotice({ type: 'success', message: t('parties.messages.created') });
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    } finally {
      createPartyRequestRef.current = false;
      setCreatingParty(false);
    }
  };

  // ── Reset & open/close dialog ──
  const resetForm = () => {
    setHeader({ ...makeEmptyHeader(), orderNo: '' });
    setItems([]);
    setPartyQuery('');
    setSelectedParty(null);
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone('');
    setAmountReceived('0');
    setIsPaid(false);
    setFormNotice({ type: '', message: '' });
    setEditingId(null);
    setShowItemForm(false);
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setSuggestedOrderNo('');
    setProductDirectory({});
    setMobileStep('details');
    setMobileSummaryExpanded(false);
  };

  const openDialog = async () => {
    resetForm();
    setDialogOpen(true);

    if (businessId) {
      try {
        const data = await api.getNextSequences();
        setSuggestedOrderNo(data?.nextServiceOrderNo || '');
      } catch {
        setSuggestedOrderNo('');
      }
    }
  };
  const openEditDialog = async (order) => {
    resetForm();
    setEditingId(order.id);
    setDialogOpen(true);
    setEditLoading(true);
    try {
      const full = normalizeServiceOrder(await api.getService(order.id));
      const rawItems = full.items || [];
      const hydratedProducts = rawItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);

      // Build party object from all possible sources
      const partyData = {
        partyId: full.partyId || full.Party?.id || full.Customer?.id || '',
        partyName: full.partyName || full.Party?.name || full.Customer?.name || '',
        partyPhone: full.partyPhone || full.Party?.phone || full.Customer?.phone || '',
        currentAmount: full.Party?.currentAmount ?? full.Customer?.currentAmount ?? null,
        type: 'customer',
      };

      setHeader({
        partyId: full.partyId || '',
        orderNo: full.orderNo || '',
        status: full.status || 'open',
        notes: full.notes || '',
        deliveryDate: toDateInputValue(full.deliveryDate) || todayISODate(),
        ...normalizePaymentFields(full),
        attachment: normalizeAttachmentUrls(full.attachments, full.attachment)[0] || '',
        attachments: normalizeAttachmentUrls(full.attachments, full.attachment),
        attributes: normalizeJewelleryAttributes(full.attributes || {}),
      });
      cacheProducts(hydratedProducts);
      setSuggestedOrderNo(full.orderNo || '');
      setAmountReceived(String(full.receivedTotal ?? 0));
      const computedIsPaid = Math.max(Number(full.grandTotal || 0) - Number(full.receivedTotal || 0), 0) <= 0;
      setIsPaid(computedIsPaid);
      setItems(rawItems.length > 0 ? rawItems.map((i) => ({
        itemType: i.itemType || 'labor',
        description: i.description || '',
        productId: i.productId || '',
        quantity: String(i.quantity ?? '1'),
        unitType: i.unitType || 'primary',
        unitPrice: String(i.unitPrice ?? '0'),
        taxRate: String(i.taxRate ?? '0'),
        lineTotal: String(i.lineTotal ?? '0'),
      })) : []);

      // Set selected party if we have party data
      if (partyData.partyId && partyData.partyName) {
        const party = normalizeLookupParty(partyData);
        setSelectedParty(party);
        setPartyQuery(`${party.name}${party.phone ? ` (${party.phone})` : ''}`);
      }
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    } finally {
      setEditLoading(false);
    }
  };
  const closeDialog = () => { setDialogOpen(false); resetForm(); };

  const goToNextMobileStep = () => {
    if (!canGoForwardStep) return;
    setMobileStep(formSteps[mobileStepIndex + 1].id);
  };

  const goToPreviousMobileStep = () => {
    if (!canGoBackStep) return;
    setMobileStep(formSteps[mobileStepIndex - 1].id);
  };

  const handlePartyFilterChange = (option) => {
    setPartyFilterId(option?.value || '');
    setSelectedPartyFilterOption(option || null);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessId) { setFormNotice({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.partyId) { setFormNotice({ type: 'error', message: t('errors.customerRequired') }); return; }
    const invalidPart = chargeableItems.find((i) => i.itemType === 'part' && !i.productId);
    if (invalidPart) { setFormNotice({ type: 'error', message: t('errors.selectProductPart') }); return; }
    const invalidConversion = chargeableItems.find((i) => {
      if (i.itemType !== 'part' || i.unitType !== 'secondary') return false;
      return Number(getProductById(i.productId)?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) { setFormNotice({ type: 'error', message: t('errors.conversionRequired') }); return; }
    if (!chargeableItems.length) { setFormNotice({ type: 'error', message: t('services.addFirstItem') }); return; }
    const normalizedAttributes = showGoldJewelleryDetails
      ? normalizeJewelleryAttributes(header.attributes)
      : Object.fromEntries(
          Object.entries(header.attributes || {}).filter(([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key))
        );
    const wastagePercent = Number(normalizedAttributes.wastagePercent || 0);
    if (showGoldJewelleryDetails && normalizedAttributes.wastagePercent && (wastagePercent < 5 || wastagePercent > 15)) {
      setFormNotice({ type: 'error', message: 'Wastage percent must be between 5 and 15.' });
      return;
    }
    if (requiresBankSelection(header, totals.received)) {
      setFormNotice({ type: 'error', message: t('payments.bankRequired') });
      return;
    }
    try {
      const manualOrderNo = String(header.orderNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const attachmentUrls = normalizeAttachmentUrls(header.attachments, header.attachment);
      const payload = {
        ...headerFields,
        attributes: normalizedAttributes,
        attachments: attachmentUrls,
        ...(attachmentUrls[0] ? { attachment: attachmentUrls[0] } : {}),
        laborTotal: totals.laborTotal,
        partsTotal: totals.partsTotal,
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        receivedTotal: totals.received,
        ...(Number(totals.received || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }),
        items: chargeableItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitType: item.unitType || 'primary',
          conversionRate: Number(getProductById(item.productId)?.conversionRate || 0),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal),
        })),
      };
      if (manualOrderNo) {
        payload.orderNo = manualOrderNo;
      } else {
        delete payload.orderNo;
      }
      if (editingId) {
        await api.updateService(editingId, payload);
      } else {
        const creatorValue = getCurrentCreatorValue(user);
        const created = await api.createService({
          ...payload,
          ...(creatorValue ? { createdBy: creatorValue } : {}),
        });
        setSuggestedOrderNo(created?.orderNo || '');
      }
      useProductStore.getState().invalidate();
      closeDialog();
      loadServices();
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    }
  };

  // ── Paged service list ──
  const filteredServiceList = safeServiceList;

  const pagedServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServiceList.slice(start, start + pageSize);
  }, [filteredServiceList, page, pageSize]);

  const serviceOverview = useMemo(() => {
    const openCount = safeServiceList.filter((order) => order.status === 'open').length;
    const inProgressCount = safeServiceList.filter((order) => order.status === 'in_progress').length;
    const pendingCollection = safeServiceList.reduce(
      (sum, order) => sum + Math.max(Number(order.grandTotal || 0) - Number(order.receivedTotal || 0), 0),
      0
    );

    return {
      totalOrders: safeServiceList.length,
      openCount,
      inProgressCount,
      pendingCollection,
    };
  }, [safeServiceList]);

  const statusFilterOptions = useMemo(() => ([
    { value: 'all', label: t('services.allStatuses') },
    { value: 'open', label: t('services.open') },
    { value: 'in_progress', label: t('services.inProgress') },
    { value: 'closed', label: t('services.closed') },
  ]), [t]);

  // ── Status dialog ──
  const openStatusDialog = (order) => {
    setStatusDialog(order);
    setNewStatus(order.status || 'open');
    setStatusError('');
  };
  const closeStatusDialog = () => setStatusDialog(null);

  const openInvoiceModal = async (order) => {
    setInvoiceOrder(normalizeServiceOrder(order));
    setInvoiceLoading(true);
    try {
      const full = normalizeServiceOrder(await api.getService(order.id));
      setInvoiceOrder(full);
    } catch (_) {
      // use list data if full fetch fails
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusDialog) return;
    try {
      await api.updateService(statusDialog.id, { status: newStatus });
      closeStatusDialog();
      loadServices();
    } catch (err) {
      setStatusError(err.message);
    }
  };

  // ── Record payment ──
  const openPayDialog = (order) => {
    setPayDialog(order);
    setPayAmount('');
    setPayNotes('');
    setPayPaymentMethod('cash');
    setPayBankId('');
    setPayError('');
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount || 0);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount.'); return; }
    if (requiresBankSelection({ paymentMethod: payPaymentMethod, bankId: payBankId }, amount)) {
      setPayError(t('payments.bankRequired'));
      return;
    }
    const currentDue = Math.max(Number(payDialog.grandTotal || 0) - Number(payDialog.receivedTotal || 0), 0);
    if (amount > currentDue) { setPayError(`Amount cannot exceed due of ${currentDue.toFixed(2)}.`); return; }
    try {
      const newReceived = Number(payDialog.receivedTotal || 0) + amount;
      await api.updateService(payDialog.id, { receivedTotal: newReceived });
      if (payDialog.partyId) {
        await api.createPartyTransaction({
          partyId: payDialog.partyId,
          direction: 'receive',
          amount,
          txDate: todayISODate(),
          ...buildPaymentPayload(
            {
              paymentMethod: payPaymentMethod,
              bankId: payBankId,
              paymentNote: `${t('services.servicePaymentNote')} - ${payDialog.orderNo || payDialog.id.slice(0, 8)}${payNotes ? ` · ${payNotes}` : ''}`,
            },
            { noteKey: 'note' }
          ),
        });
      }
      setPayDialog(null);
      loadServices();
    } catch (err) {
      setPayError(err.message);
    }
  };

  const money = (val) =>
    t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(val || 0).toFixed(2) }).replace(' ', '\u00a0');

  const formScrollRef = useRef(null);
  const invoicePrintRef = useRef(null);

  const handlePrint = () => {
    const source = invoicePrintRef.current;
    if (!source) { window.print(); return; }
    const clone = source.cloneNode(true);
    clone.classList.add('print-clone');
    // Ensure inline styles don't hide it on screen before print fires
    clone.style.cssText = '';
    document.body.appendChild(clone);
    const cleanup = () => {
      if (document.body.contains(clone)) document.body.removeChild(clone);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const showDetailsStep = !isMobile || mobileStep === 'details';
  const showItemsStep = !isMobile || mobileStep === 'items';
  const showPaymentStep = !isMobile || mobileStep === 'payment';
  const itemDraftProduct = getProductById(itemDraft.productId);
  const itemDraftVatAmount = getVatAmount(itemDraft.lineTotal, itemDraft.taxRate);
  const canSaveDraftItem = itemDraft.itemType === 'part'
    ? Boolean(itemDraft.productId) && Number(itemDraft.lineTotal || 0) > 0
    : Number(itemDraft.lineTotal || 0) > 0 || Boolean(String(itemDraft.description || '').trim());
  const dialogTitle = editingId ? t('services.editOrder') : newOrderLabel;
  const summaryOrderNo = header.orderNo || suggestedOrderNo || '—';
  const summaryDeliveryDate = header.deliveryDate ? formatMaybeDate(header.deliveryDate, 'D MMM YYYY') : '—';
  const invoiceAttachmentUrls = invoiceOrder ? getServiceAttachmentUrls(invoiceOrder) : [];
  const invoiceItems = invoiceOrder ? getServiceItems(invoiceOrder) : [];
  const invoiceJewellery = invoiceOrder ? getJewelleryBreakdown(invoiceOrder.attributes || {}) : getJewelleryBreakdown({});
  const invoiceExtraAttributes = invoiceOrder?.attributes
    ? Object.entries(invoiceOrder.attributes).filter(([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key))
    : [];
  const invoiceTotals = invoiceOrder
    ? getServiceOrderTotals(invoiceOrder)
    : { laborTotal: 0, partsTotal: 0, subTotal: 0, taxTotal: 0, grandTotal: 0 };
  const mobilePrimaryActionLabel = canGoForwardStep
    ? t('common.continue')
    : editingId ? t('common.update') : t('services.saveOrder');

  // ── Render ──
  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-primary-100/80 bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(249,245,239,0.96))] shadow-sm shadow-primary-950/10 dark:border-primary-900/40 dark:bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.18),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
        <div className="p-5 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="mt-4 font-serif text-3xl text-slate-900 dark:text-white md:text-4xl">{servicesTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                {servicesSubtitle}
              </p>
            </div>

            <button className="btn-primary w-full sm:w-auto" type="button" onClick={openDialog}>
              <Plus size={16} className="mr-1.5 inline" />
              {newOrderLabel}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric icon={LayoutList} label={t('services.totalOrders')} value={serviceOverview.totalOrders} />
            <OverviewMetric icon={Wrench} label={t('services.open')} value={serviceOverview.openCount} tone="blue" />
            <OverviewMetric icon={CalendarDays} label={t('services.activeJobs')} value={serviceOverview.inProgressCount} tone="amber" />
            <OverviewMetric icon={Wallet} label={t('services.pendingCollection')} value={money(serviceOverview.pendingCollection)} tone="rose" />
          </div>
        </div>
      </section>

      {listError ? <Notice title={listError} tone="error" /> : null}

      {/* ── Orders Table ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-800/70 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('services.recentOrders')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('services.browseOrdersHint')}</p>
            </div>

            <div className="grid w-full gap-3 xl:max-w-2xl xl:grid-cols-2">
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
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
            {statusFilterOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={statusFilter === option.value}
                onClick={() => setStatusFilter(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6">
          <div className="space-y-3 md:hidden">
            {listLoading && safeServiceList.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t('common.loading')}</p>
            ) : pagedServices.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">{t('services.noOrders')}</p>
            ) : (
              pagedServices.map((order) => {
                const due = Math.max(Number(order.grandTotal || 0) - Number(order.receivedTotal || 0), 0);
                const days = getDeliveryDaysLeft(order.deliveryDate);
                const isUrgent = order.status !== 'closed' && days !== null && days < 3;
                const attachmentUrls = getServiceAttachmentUrls(order);

                return (
                  <div
                    key={order.id}
                    className={`rounded-[26px] border p-4 text-sm shadow-sm ${
                      isUrgent
                        ? 'border-red-200/70 bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/10'
                        : 'border-slate-200/70 bg-white/90 dark:border-slate-800/60 dark:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                            {order.orderNo || order.id.slice(0, 8)}
                          </p>
                          <StatusBadge status={order.status} />
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                            <UserRound size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800 dark:text-slate-100">{order.Party?.name || order.partyName || '—'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Created by {getCreatorDisplayName(order)}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <DeliveryBadge date={order.deliveryDate} />
                          <PaymentTypeSummary
                            source={order}
                            className="rounded-full bg-slate-100/80 px-2.5 py-1 dark:bg-slate-800/80"
                            labelClassName="text-[11px] font-semibold"
                            metaClassName="text-[11px]"
                          />
                        </div>
                      </div>

                      <div className="min-w-[96px] rounded-[22px] border border-slate-200/70 bg-slate-50/80 p-3 text-right dark:border-slate-800/70 dark:bg-slate-950/40">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('services.summaryTotal')}</p>
                        <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{money(order.grandTotal)}</p>
                        {due > 0 ? (
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            onClick={() => openPayDialog(order)}
                          >
                            {money(due)}
                          </button>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('common.paid')}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-200/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60"
                        onClick={() => openStatusDialog(order)}
                      >
                        <ChevronDown size={12} />
                        {t('services.status')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-200/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60"
                        onClick={() => openInvoiceModal(order)}
                      >
                        <FileText size={12} />
                        {t('common.view')}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-2xl border border-slate-200/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60"
                        onClick={() => openEditDialog(order)}
                      >
                        <Pencil size={12} />
                        {t('common.edit')}
                      </button>
                    </div>

                    {attachmentUrls.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {t('services.attachment')}
                        </p>
                        <AttachmentStrip urls={attachmentUrls} onOpen={setLightboxUrl} size="md" />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="py-2 pr-4 text-left">{t('services.orderNo')}</th>
                  <th className="py-2 pr-4 text-left">{t('services.customer')}</th>
                  <th className="py-2 pr-4 text-left">{t('services.deliveryDate')}</th>
                  <th className="py-2 pr-4 text-left">{t('services.status')}</th>
                  <th className="py-2 pr-4 text-left">{t('common.payment')}</th>
                  <th className="py-2 pr-2 text-left">{t('services.attachment')}</th>
                  <th className="py-2 pr-4 text-right">{t('services.grandTotal')}</th>
                  <th className="py-2 pr-4 text-right">{t('services.amountReceived')}</th>
                  <th className="py-2 pr-4 text-right">{t('services.due')}</th>
                  <th className="py-2 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && safeServiceList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-4 text-slate-500">{t('common.loading')}</td>
                  </tr>
                ) : pagedServices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-4 text-slate-500">{t('services.noOrders')}</td>
                  </tr>
                ) : (
                  pagedServices.map((order) => {
                    const days = getDeliveryDaysLeft(order.deliveryDate);
                    const isUrgent = order.status !== 'closed' && days !== null && days < 3;
                    const isWarning = order.status !== 'closed' && days !== null && days >= 3 && days < 8;
                    const rowClass = isUrgent
                      ? 'border-t border-red-200/60 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10'
                      : isWarning
                        ? 'border-t border-amber-200/60 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/10'
                        : 'border-t border-slate-200/70 dark:border-slate-800/70';
                    const due = Math.max(Number(order.grandTotal || 0) - Number(order.receivedTotal || 0), 0);
                    const attachmentUrls = getServiceAttachmentUrls(order);

                    return (
                      <tr key={order.id} className={rowClass}>
                        <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">
                          {order.orderNo || order.id.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                          <div>{order.Party?.name || order.partyName || <span className="text-slate-400">—</span>}</div>
                          <div className="text-xs text-slate-400">Created by {getCreatorDisplayName(order)}</div>
                        </td>
                        <td className="py-3 pr-4"><DeliveryBadge date={order.deliveryDate} /></td>
                        <td className="py-3 pr-4">
                          <button type="button" className="transition hover:opacity-75" onClick={() => openStatusDialog(order)}>
                            <StatusBadge status={order.status} />
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <PaymentTypeSummary source={order} />
                        </td>
                        <td className="py-3 pr-2">
                          {attachmentUrls.length > 0 ? (
                            <AttachmentStrip urls={attachmentUrls} onOpen={setLightboxUrl} maxVisible={2} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-slate-800 dark:text-slate-200">{money(order.grandTotal)}</td>
                        <td className="py-3 pr-4 text-right text-emerald-700 dark:text-emerald-400">{money(order.receivedTotal)}</td>
                        <td className="py-3 pr-4 text-right">
                          {due > 0 ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                              onClick={() => openPayDialog(order)}
                            >
                              {money(due)}
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('common.paid')}</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button type="button" title={t('common.edit')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" onClick={() => openEditDialog(order)}>
                              <Pencil size={14} />
                            </button>
                            <button type="button" title={t('common.view')} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800" onClick={() => openInvoiceModal(order)}>
                              <FileText size={14} />
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

          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredServiceList.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      </div>

      {/* ── New / Edit Order Dialog ── */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="flex h-full items-end justify-center md:items-center md:p-5 xl:p-6">
            <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fcfaf6] shadow-2xl dark:bg-slate-950 md:h-[calc(100dvh-2.5rem)] md:max-h-[calc(100dvh-2.5rem)] md:max-w-[1440px] md:rounded-[32px] md:border md:border-slate-200/70 md:dark:border-slate-800/70">
              <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 md:px-8">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700 dark:text-primary-200">{t('services.workspaceLabel')}</p>
                  <h2 className="mt-1 truncate font-serif text-2xl text-slate-900 dark:text-white">{dialogTitle}</h2>
                </div>
                <button type="button" onClick={closeDialog} className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div ref={formScrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
                  <div className="mx-auto w-full max-w-[1320px] space-y-4">
                    {formNotice.message ? (
                      <Notice title={formNotice.message} tone={formNotice.type} />
                    ) : null}

                    {editLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      </div>
                    ) : null}

                    {isMobile ? (
                      <div className="rounded-[28px] border border-primary-100/80 bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.16),transparent_48%),linear-gradient(140deg,rgba(255,255,255,0.98),rgba(249,245,239,0.95))] p-4 shadow-sm shadow-primary-950/10 dark:border-primary-900/40 dark:bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.14),transparent_48%),linear-gradient(140deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))]">
                        <button
                          type="button"
                          onClick={() => setMobileSummaryExpanded((prev) => !prev)}
                          aria-expanded={mobileSummaryExpanded}
                          className="w-full text-left"
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-slate-800/60 dark:bg-slate-950/50 dark:text-primary-200">
                                  <Sparkles size={12} />
                                  {t('services.summaryCard')}
                                </div>
                                <StatusBadge status={header.status} />
                              </div>
                              <p className="mt-3 truncate text-base font-semibold text-slate-900 dark:text-white">
                                {selectedParty?.name || summaryOrderNo}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {summaryOrderNo} · {summaryDeliveryDate}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {t('services.summaryDue')}
                              </p>
                              <p className={`mt-1 text-base font-semibold ${totals.due > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                                {money(totals.due)}
                              </p>
                              <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 dark:text-primary-200">
                                {visibleItems.length} {t('services.summaryItems')}
                                <ChevronDown
                                  size={14}
                                  className={`transition ${mobileSummaryExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        </button>

                        {mobileSummaryExpanded ? (
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <SummaryPill icon={UserRound} label={t('services.summaryCustomer')} value={selectedParty?.name || '—'} />
                            <SummaryPill icon={CalendarDays} label={t('services.summaryDelivery')} value={summaryDeliveryDate} />
                            <SummaryPill icon={Package} label={t('services.summaryItems')} value={visibleItems.length || 0} />
                            <SummaryPill
                              icon={Wallet}
                              label={t('services.summaryDue')}
                              value={money(totals.due)}
                              valueClassName={totals.due > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}
                            />
                          </div>
                        ) : (
                          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/55 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/35 dark:text-slate-300">
                            <CalendarDays size={13} className="text-primary-700 dark:text-primary-200" />
                            <span>{t('services.summaryDelivery')}: {summaryDeliveryDate}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-[30px] border border-primary-100/80 bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.18),transparent_45%),linear-gradient(140deg,rgba(255,255,255,0.98),rgba(249,245,239,0.95))] p-4 shadow-sm shadow-primary-950/10 dark:border-primary-900/40 dark:bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.16),transparent_45%),linear-gradient(140deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] md:p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 dark:border-slate-800/60 dark:bg-slate-950/50 dark:text-primary-200">
                              <Sparkles size={12} />
                              {dialogTitle}
                            </div>
                            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                              {summaryOrderNo} · {summaryDeliveryDate}
                            </p>
                          </div>
                          <StatusBadge status={header.status} />
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <SummaryPill icon={UserRound} label={t('services.summaryCustomer')} value={selectedParty?.name || '—'} />
                          <SummaryPill icon={CalendarDays} label={t('services.summaryDelivery')} value={summaryDeliveryDate} />
                          <SummaryPill icon={Package} label={t('services.summaryItems')} value={visibleItems.length || 0} />
                          <SummaryPill
                            icon={Wallet}
                            label={t('services.summaryDue')}
                            value={money(totals.due)}
                            valueClassName={totals.due > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}
                          />
                        </div>
                      </div>
                    )}

                    {isMobile ? (
                      <MobileFormStepper
                        steps={formSteps}
                        currentStep={mobileStep}
                        onStepChange={setMobileStep}
                        onNext={goToNextMobileStep}
                        onBack={goToPreviousMobileStep}
                        canProceed={!editLoading}
                        backLabel={t('common.back')}
                        nextLabel={mobileStep === 'items' ? t('services.paymentStep') : t('common.continue')}
                        showNavigation={false}
                      />
                    ) : null}

                    {showDetailsStep ? (
                      <>
                        <FormSectionCard
                          title={t('services.detailsSectionTitle')}
                          hint={t('services.detailsSectionHint')}
                          className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <label className="label">
                            {t('services.customer')} <span className="ml-1 text-rose-500">*</span>
                          </label>
                          <div className="relative mt-2">
                            {selectedParty ? (
                              <div className="flex items-center gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-bold text-white">
                                  {selectedParty.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{selectedParty.name}</p>
                                  {selectedParty.phone ? (
                                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                      <p className="text-xs text-slate-500">{selectedParty.phone}</p>
                                      {!selectedPartyHasDue && selectedPartyWhatsAppLink ? (
                                        <a
                                          href={selectedPartyWhatsAppLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                                          aria-label={`Open WhatsApp chat for ${selectedParty.phone}`}
                                        >
                                          <MessageCircle size={12} />
                                          WhatsApp
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  {selectedPartyHasBalance ? (
                                    <div className="mt-0.5">
                                      <p className={`text-xs ${selectedPartyBalanceMeta.textClass}`}>
                                        {selectedPartyBalanceMeta.label}:{' '}
                                        {t('currency.formatted', {
                                          symbol: t('currency.symbol'),
                                          amount: selectedPartyBalanceMeta.absoluteAmount.toFixed(2),
                                        })}
                                      </p>
                                      {selectedPartyHasDue && selectedPartyWhatsAppLink ? (
                                        <a
                                          href={selectedPartyWhatsAppLink}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-800"
                                          aria-label={`Open WhatsApp chat for ${selectedParty.phone}`}
                                        >
                                          <MessageCircle size={12} />
                                          WhatsApp
                                        </a>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                                <button type="button" onClick={clearParty} className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700 dark:hover:bg-slate-800">
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 rounded-[24px] border border-slate-200/70 bg-white px-3 py-3 shadow-sm shadow-slate-200/10 dark:border-slate-700/60 dark:bg-slate-900/60 focus-within:border-primary-300">
                                  <Search size={16} className="shrink-0 text-slate-400" />
                                  <input
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-slate-200"
                                    placeholder={t('services.customerSearch')}
                                    value={partyQuery}
                                    onChange={handlePartySearch}
                                    onFocus={() => setPartyDropdownOpen(true)}
                                  />
                                  {partyQuery ? (
                                    <button type="button" onClick={clearParty} className="text-slate-400 transition hover:text-slate-600">
                                      <X size={14} />
                                    </button>
                                  ) : null}
                                </div>

                                {partyDropdownOpen && partyQuery.trim() ? (
                                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                                    {filteredParties.length > 0 ? filteredParties.map((party) => (
                                      <button
                                        key={party.id}
                                        type="button"
                                        className="flex w-full items-center gap-3 border-b border-slate-100/80 px-4 py-3 text-left text-sm transition hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/60 last:border-b-0"
                                        onClick={() => selectParty(party)}
                                      >
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                          {party.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-slate-800 dark:text-slate-200">{party.name}</p>
                                          {party.phone ? <p className="text-xs text-slate-500">{party.phone}</p> : null}
                                        </div>
                                      </button>
                                    )) : null}

                                    {!showAddNew ? (
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-primary-700 transition hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/20"
                                        onClick={() => setShowAddNew(true)}
                                      >
                                        <Plus size={14} />
                                        Add &ldquo;{partyQuery.trim()}&rdquo; as customer
                                      </button>
                                    ) : (
                                      <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                        <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">New: <span className="text-primary-700">{partyQuery.trim()}</span></p>
                                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                          <Phone size={13} className="shrink-0 text-slate-400" />
                                          <input
                                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                            type="tel"
                                            inputMode="numeric"
                                            placeholder={t('parties.phonePlaceholder')}
                                            value={newPartyPhone}
                                            disabled={creatingParty}
                                            onChange={(e) => setNewPartyPhone(e.target.value)}
                                          />
                                        </div>
                                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                          <button type="button" className="btn-ghost text-xs" onClick={() => setShowAddNew(false)} disabled={creatingParty}>{t('common.cancel')}</button>
                                          <button type="button" className="btn-primary text-xs" onClick={createAndSelectParty} disabled={creatingParty}>
                                            {creatingParty ? t('common.loading') : t('services.addSelect')}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div>
                              <label className="label">{t('services.orderNo')}</label>
                              <input
                                className="input mt-1"
                                name="orderNo"
                                value={header.orderNo}
                                onChange={handleHeaderChange}
                                placeholder={!editingId ? suggestedOrderNo : ''}
                              />
                            </div>
                            <div>
                              <label className="label">{t('services.status')}</label>
                              <select className="input mt-1" name="status" value={header.status} onChange={handleHeaderChange}>
                                <option value="open">{t('services.open')}</option>
                                <option value="in_progress">{t('services.inProgress')}</option>
                                <option value="closed">{t('services.closed')}</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">{t('services.deliveryDate')}</label>
                              <input type="date" className="input mt-1" name="deliveryDate" value={header.deliveryDate} onChange={handleHeaderChange} />
                            </div>
                          </div>
                        </FormSectionCard>

                        <FormSectionCard
                          title={t('services.notesSectionTitle')}
                          hint={t('services.notesSectionHint')}
                          className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                            <div>
                              <label className="label">{t('services.notes')}</label>
                              <textarea
                                className="input mt-1 h-32 resize-none"
                                name="notes"
                                value={header.notes}
                                onChange={handleHeaderChange}
                                placeholder={t('services.notesPlaceholder')}
                              />
                            </div>
                            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                              <FileUpload
                                label={t('services.attachment')}
                                multiple
                                initialUrls={header.attachments}
                                onUpload={(urls) => setHeader((prev) => ({
                                  ...prev,
                                  attachments: Array.isArray(urls) ? urls : normalizeAttachmentUrls(urls),
                                  attachment: Array.isArray(urls) ? (urls[0] || '') : String(urls || ''),
                                }))}
                              />
                            </div>
                          </div>
                        </FormSectionCard>

                        {/* <FormSectionCard
                          title="Jewellery details"
                          hint="Track metal purity, wastage, total weight, and simple diamond charges for jewellery orders."
                          className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <div>
                              <label className="label">Metal type</label>
                              <select
                                className="input mt-1"
                                value={jewelleryAttributes.metalType}
                                onChange={(event) => updateJewelleryAttribute('metalType', event.target.value)}
                              >
                                <option value="">Select metal</option>
                                {METAL_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="label">Purity</label>
                              {jewelleryPurityOptions.length > 0 ? (
                                <select
                                  className="input mt-1"
                                  value={jewelleryAttributes.metalPurity}
                                  onChange={(event) => updateJewelleryAttribute('metalPurity', event.target.value)}
                                >
                                  <option value="">Select purity</option>
                                  {jewelleryPurityOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className="input mt-1"
                                  value={jewelleryAttributes.metalPurity}
                                  onChange={(event) => updateJewelleryAttribute('metalPurity', event.target.value)}
                                  placeholder="e.g. 22K or 925"
                                />
                              )}
                            </div>
                            <div>
                              <label className="label">Actual weight</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.001"
                                value={jewelleryAttributes.actualWeight}
                                onChange={(event) => updateJewelleryAttribute('actualWeight', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Wastage %</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="5"
                                max="15"
                                step="0.01"
                                value={jewelleryAttributes.wastagePercent}
                                onChange={(event) => updateJewelleryAttribute('wastagePercent', event.target.value)}
                                placeholder="5 - 15"
                              />
                            </div>
                            <div>
                              <label className="label">Wastage weight</label>
                              <input
                                className="input mt-1 bg-slate-50"
                                value={jewelleryAttributes.wastageWeight}
                                placeholder="Auto calculated"
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="label">Total weight</label>
                              <input
                                className="input mt-1 bg-slate-50"
                                value={jewelleryAttributes.totalWeight}
                                placeholder="Actual + wastage"
                                readOnly
                              />
                            </div>
                            <div>
                              <label className="label">Diamond type</label>
                              <input
                                className="input mt-1"
                                value={jewelleryAttributes.diamondType}
                                onChange={(event) => updateJewelleryAttribute('diamondType', event.target.value)}
                                placeholder="e.g. VVS, round"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond weight</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.001"
                                value={jewelleryAttributes.diamondWeight}
                                onChange={(event) => updateJewelleryAttribute('diamondWeight', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond carat</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.diamondCarat}
                                onChange={(event) => updateJewelleryAttribute('diamondCarat', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond purity / grade</label>
                              <input
                                className="input mt-1"
                                value={jewelleryAttributes.diamondPurity}
                                onChange={(event) => updateJewelleryAttribute('diamondPurity', event.target.value)}
                                placeholder="Optional"
                              />
                            </div>
                            <div>
                              <label className="label">Diamond charge</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.diamondCharge}
                                onChange={(event) => updateJewelleryAttribute('diamondCharge', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="label">Additional tax</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.01"
                                value={jewelleryAttributes.additionalTax}
                                onChange={(event) => updateJewelleryAttribute('additionalTax', event.target.value)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </FormSectionCard> */}

                        <FormSectionCard
                          title={t('services.orderInformation')}
                          className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                        >
                          <DynamicAttributes
                            entityType="service"
                            attributes={header.attributes}
                            hiddenKeys={JEWELLERY_ATTRIBUTE_KEYS}
                            onChange={(attr) => setHeader((prev) => ({ ...prev, attributes: attr }))}
                          />
                        </FormSectionCard>
                      </>
                    ) : null}

                    {showItemsStep ? (
                      <FormSectionCard
                        title={t('services.items')}
                        hint={t('services.itemsSectionHint')}
                        action={(
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <span className="text-sm font-semibold text-slate-500">{visibleItems.length} {t('services.items')}</span>
                            <button className="btn-ghost w-full sm:w-auto" type="button" onClick={startAddItem}>
                              {t('services.addLine')}
                            </button>
                          </div>
                        )}
                        className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                      >
                        {visibleItems.length > 0 ? (
                          <div className="mb-4 space-y-3">
                            {visibleItems.map((item, idx) => {
                              const product = getProductById(item.productId);
                              const displayName = item.itemType === 'part'
                                ? product?.name || item.description || t('services.productLine')
                                : item.description || t('services.serviceLine');
                              const unitLabel = item.itemType === 'part' ? getUnitLabel(product, item.unitType) : '';

                              return (
                                <div
                                  key={`item-row-${idx}`}
                                  className="rounded-[24px] border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800/60 dark:bg-slate-900/40"
                                >
                                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start gap-3">
                                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.itemType === 'labor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                          {item.itemType === 'labor' ? <Wrench size={18} /> : <Package size={18} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.itemType === 'labor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                              {item.itemType === 'labor' ? t('services.serviceLine') : t('services.productLine')}
                                            </span>
                                            <p className="truncate font-semibold text-slate-900 dark:text-white">{displayName}</p>
                                          </div>
                                          {item.itemType === 'part' && item.description && product?.name && item.description !== product.name ? (
                                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>
                                          ) : null}
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                              {t('services.qty')}: {item.quantity}{unitLabel ? ` ${unitLabel}` : ''}
                                            </span>
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                              {t('services.unitPrice')}: {money(item.unitPrice)}
                                            </span>
                                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">
                                              {t('services.tax')}: {Number(item.taxRate || 0).toFixed(2)}%
                                            </span>
                                            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-primary-900/70">
                                              {t('common.total')}: {money(item.lineTotal)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 xl:pl-4">
                                      <button
                                        type="button"
                                        className="btn-ghost flex-1 text-sm xl:flex-none"
                                        onClick={() => startEditItem(idx)}
                                      >
                                        <Pencil size={14} className="mr-1.5 inline" />
                                        {t('common.edit')}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 xl:flex-none dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                        onClick={() => removeItem(idx)}
                                      >
                                        <X size={14} className="mr-1.5 inline" />
                                        {t('common.remove')}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mb-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('services.addFirstItem')}</p>
                            <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={startAddItem}>
                              <Plus size={15} className="mr-1.5 inline" />
                              {t('services.addLine')}
                            </button>
                          </div>
                        )}
                      </FormSectionCard>
                    ) : null}

                    <Dialog
                      isOpen={showItemForm}
                      onClose={cancelItemForm}
                      title={editingItemIdx !== null ? t('services.editLine') : t('services.addLine')}
                      size="xl"
                      footer={(
                        <>
                          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={cancelItemForm}>
                            {t('common.cancel')}
                          </button>
                          <button type="button" className="btn-primary w-full sm:w-auto" onClick={confirmItem} disabled={!canSaveDraftItem}>
                            {editingItemIdx !== null ? t('common.update') : t('common.add')}
                          </button>
                        </>
                      )}
                    >
                      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-200">{t('services.itemComposerTitle')}</p>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('services.itemComposerHint')}</p>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="label">{t('services.type')}</label>
                              <select
                                className="input mt-1"
                                value={itemDraft.itemType}
                                onChange={(e) => handleDraftChange('itemType', e.target.value)}
                              >
                                <option value="labor">{t('services.serviceLine')}</option>
                                <option value="part">{t('services.productLine')}</option>
                              </select>
                            </div>
                            <div>
                              <label className="label">{t('services.description')}</label>
                              <input
                                className="input mt-1"
                                value={itemDraft.description}
                                onChange={(e) => handleDraftChange('description', e.target.value)}
                                placeholder={t('services.placeholderService')}
                              />
                            </div>

                            {itemDraft.itemType === 'part' ? (
                              <div className="sm:col-span-2">
                                <label className="label">{t('services.productParts')}</label>
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
                                />
                              </div>
                            ) : null}

                            {itemDraft.itemType === 'part' && itemDraftProduct?.secondaryUnit ? (
                              <div className="sm:col-span-2">
                                <label className="label">{t('products.unitType')}</label>
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDraftChange('unitType', 'primary', itemDraftProduct.primaryUnit)}
                                    className={itemDraft.unitType === 'primary' ? 'btn-primary w-full text-sm' : 'btn-ghost w-full text-sm'}
                                  >
                                    {itemDraftProduct.primaryUnit || t('products.primaryUnit')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDraftChange('unitType', 'secondary', itemDraftProduct.secondaryUnit)}
                                    className={itemDraft.unitType === 'secondary' ? 'btn-primary w-full text-sm' : 'btn-ghost w-full text-sm'}
                                  >
                                    {itemDraftProduct.secondaryUnit} <span className="ml-1 text-xs opacity-70">({t('products.secondaryUnit')})</span>
                                  </button>
                                </div>
                                {itemDraftProduct.conversionRate > 0 ? (
                                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    1 {itemDraftProduct.primaryUnit} = {itemDraftProduct.conversionRate} {itemDraftProduct.secondaryUnit}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            <div>
                              <label className="label">{t('services.qty')}</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.1"
                                value={itemDraft.quantity}
                                onChange={(e) => handleDraftChange('quantity', e.target.value)}
                              />
                              {itemDraft.itemType === 'part' ? (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getUnitLabel(itemDraftProduct, itemDraft.unitType)}</p>
                              ) : null}
                            </div>
                            <div>
                              <label className="label">{t('services.unitPrice')}</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="0.1"
                                value={itemDraft.unitPrice}
                                onChange={(e) => handleDraftChange('unitPrice', e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="label">{t('services.tax')}</label>
                              <input
                                className="input mt-1"
                                type="number"
                                min="0"
                                step="1"
                                value={itemDraft.taxRate}
                                onChange={(e) => handleDraftChange('taxRate', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-primary-200 bg-primary-50/60 p-4 shadow-sm dark:border-primary-900/40 dark:bg-primary-900/15">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-200">{t('common.total')}</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{money(itemDraft.lineTotal)}</p>
                          <div className="mt-4 space-y-3">
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.taxTotal')}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{money(itemDraftVatAmount)}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.type')}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{itemDraft.itemType === 'labor' ? t('services.serviceLine') : t('services.productLine')}</p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.description')}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                {itemDraft.itemType === 'part' ? itemDraftProduct?.name || itemDraft.description || '—' : itemDraft.description || '—'}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('products.unitType')}</p>
                              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{getUnitLabel(itemDraftProduct, itemDraft.unitType) || t('products.primaryUnit')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Dialog>

                    {showPaymentStep ? (
                      <FormSectionCard
                        title={t('services.paymentSectionTitle')}
                        hint={t('services.paymentSectionHint')}
                        className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
                      >
                        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.subTotal')}</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.subTotal)}</p>
                              </div>
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Service Total</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.laborTotal)}</p>
                              </div>
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Product Total</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.partsTotal)}</p>
                              </div>
                              {showGoldJewelleryDetails ? (
                                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Diamond Charge</p>
                                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.diamondCharge)}</p>
                                </div>
                              ) : null}
                              <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.taxTotal')}</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.taxTotal)}</p>
                              </div>
                              {showGoldJewelleryDetails ? (
                                <div className="rounded-2xl bg-white/80 px-4 py-3 dark:bg-slate-950/50">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Additional Tax</p>
                                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{money(totals.additionalTax)}</p>
                                </div>
                              ) : null}
                              <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white dark:bg-primary-900/70">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">{t('services.grandTotal')}</p>
                                <p className="mt-1 text-xl font-semibold">{money(totals.grandTotal)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                              <div>
                                <label className="label">{t('services.amountReceived')}</label>
                                <input
                                  className="input mt-1"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={isPaid ? totals.grandTotal.toFixed(2) : amountReceived}
                                  disabled={isPaid}
                                  onChange={(e) => setAmountReceived(e.target.value)}
                                />
                              </div>
                              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:bg-slate-800/60">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded accent-primary-600"
                                  checked={isPaid}
                                  onChange={(e) => setIsPaid(e.target.checked)}
                                />
                                {t('services.fullyPaid')}
                              </label>
                            </div>

                            {totals.due > 0 ? (
                              <div className="rounded-[24px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/20">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500 dark:text-rose-300">{t('services.dueAmount')}</p>
                                <p className="mt-1 text-lg font-semibold text-rose-700 dark:text-rose-200">{money(totals.due)}</p>
                              </div>
                            ) : (
                              <div className="rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">{t('services.fullyPaid')}</p>
                              </div>
                            )}

                            <div className="rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40">
                              <PaymentMethodFields
                                value={header}
                                onChange={(patch) => setHeader((prev) => ({ ...prev, ...patch }))}
                              />
                            </div>
                          </div>
                        </div>
                      </FormSectionCard>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-slate-200/70 bg-white/90 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85 md:px-8">
                  <div className="mx-auto w-full max-w-[1320px]">
                  {isMobile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100/90 px-4 py-3 text-sm dark:bg-slate-900/70">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {formSteps[mobileStepIndex]?.label || t('services.detailStep')}
                          </p>
                          <p className="mt-1 truncate font-semibold text-slate-700 dark:text-slate-200">
                            {summaryOrderNo}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {t('services.summaryDue')}
                          </p>
                          <p className={`mt-1 font-semibold ${totals.due > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            {money(totals.due)}
                          </p>
                        </div>
                      </div>

                      <div className={`grid gap-3 ${canGoBackStep ? 'grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
                        {canGoBackStep ? (
                          <button type="button" className="btn-ghost w-full" onClick={goToPreviousMobileStep} disabled={editLoading}>
                            {t('common.back')}
                          </button>
                        ) : null}

                        {canGoForwardStep ? (
                          <button type="button" className="btn-primary w-full" onClick={goToNextMobileStep} disabled={editLoading}>
                            {mobilePrimaryActionLabel}
                            <ArrowRight size={14} className="ml-1.5 inline" />
                          </button>
                        ) : (
                          <button type="submit" className="btn-primary w-full" disabled={editLoading}>
                            {mobilePrimaryActionLabel}
                            <Check size={14} className="ml-1.5 inline" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="rounded-2xl bg-slate-100/90 px-4 py-3 text-sm dark:bg-slate-900/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('services.summaryDue')}</p>
                        <p className={`mt-1 font-semibold ${totals.due > 0 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {money(totals.due)}
                        </p>
                      </div>

                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <button type="button" className="btn-ghost w-full sm:w-auto" onClick={closeDialog}>
                          {t('common.cancel')}
                        </button>
                        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={editLoading}>
                          {editingId ? t('common.update') : t('services.saveOrder')}
                          <ArrowRight size={14} className="ml-1.5 inline" />
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Attachment Lightbox ── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setLightboxUrl(null)}>
            <X size={20} />
          </button>
          {isPdfAttachment(lightboxUrl) ? (
            <a href={lightboxUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white px-6 py-4 text-slate-800 font-semibold" onClick={(e) => e.stopPropagation()}>
              Open PDF in new tab
            </a>
          ) : (
            <img src={lightboxUrl} alt="Attachment" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* ── Service Invoice Modal ── */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pb-10 backdrop-blur-sm print:relative print:inset-auto print:overflow-visible print:bg-transparent print:p-0">
          <div className="relative mt-4 w-full max-w-3xl md:mt-8">
            <div className="mb-4 flex items-center justify-between print:hidden">
              <button type="button" className="btn-ghost" onClick={() => setInvoiceOrder(null)}>← Close</button>
              <button type="button" className="btn-primary" onClick={handlePrint}>Download PDF</button>
            </div>
            {invoiceLoading ? (
              <div className="card flex items-center justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : (
              <div ref={invoicePrintRef} className="print-area overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950">
                {/* ── Header ── */}
                <div className="px-8 pt-0">
                    <InvoiceHeader
                      biz={bizSettings}
                      invoiceType="Service Invoice"
                      invoiceNo={invoiceOrder.orderNo || invoiceOrder.id?.slice(0, 8)}
                      date={invoiceOrder.deliveryDate ? formatMaybeDate(invoiceOrder.deliveryDate, 'MMMM D, YYYY') : null}
                      status={invoiceOrder.status}
                      statusColor={
                        invoiceOrder.status === 'closed'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : invoiceOrder.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }
                  />
                </div>

                {/* ── Customer + Notes + Attributes ── */}
                <div className="border-b border-slate-200/70 bg-slate-50/60 px-8 py-5 dark:border-slate-800/70 dark:bg-slate-900/30">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Bill To</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{invoiceOrder.Party?.name || invoiceOrder.partyName || '—'}</p>
                      {invoiceOrder.Party?.phone && <p className="mt-0.5 text-sm text-slate-500">{invoiceOrder.Party?.phone}</p>}
                      <p className="mt-2 text-sm text-slate-500">
                        Created By:{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">{getCreatorDisplayName(invoiceOrder)}</span>
                      </p>
                    </div>
                    {invoiceOrder.notes && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{invoiceOrder.notes}</p>
                      </div>
                    )}
                  </div>
                  {showGoldJewelleryDetails && (invoiceJewellery.metalType || invoiceJewellery.metalPurity || invoiceJewellery.actualWeight || invoiceJewellery.wastagePercent || invoiceJewellery.totalWeight || invoiceJewellery.diamondType || invoiceJewellery.diamondWeight || invoiceJewellery.diamondCarat || invoiceJewellery.diamondCharge) && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                      {invoiceJewellery.metalType ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Metal: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{invoiceJewellery.metalType}</span>
                        </div>
                      ) : null}
                      {invoiceJewellery.metalPurity ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Purity: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{invoiceJewellery.metalPurity}</span>
                        </div>
                      ) : null}
                      {invoiceJewellery.actualWeight ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Actual weight: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{invoiceJewellery.actualWeight}</span>
                        </div>
                      ) : null}
                      {invoiceJewellery.wastagePercent ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Wastage: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {invoiceJewellery.wastagePercent}% ({invoiceJewellery.wastageWeight || '0'})
                          </span>
                        </div>
                      ) : null}
                      {invoiceJewellery.totalWeight ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Total weight: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{invoiceJewellery.totalWeight}</span>
                        </div>
                      ) : null}
                      {invoiceJewellery.diamondType ? (
                        <div className="text-sm">
                          <span className="text-slate-400">Diamond: </span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {[invoiceJewellery.diamondType, invoiceJewellery.diamondWeight && `${invoiceJewellery.diamondWeight} wt`, invoiceJewellery.diamondCarat && `${invoiceJewellery.diamondCarat} ct`, invoiceJewellery.diamondPurity]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {invoiceExtraAttributes.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                      {invoiceExtraAttributes.map(([key, val]) => {
                        const def = safeAttributeDefs.find((d) => d.key === key);
                        const attrLabel = def?.name || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <div key={key} className="text-sm">
                            <span className="text-slate-400">{attrLabel}: </span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{String(val || '—')}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── Line Items ── */}
                <div className="px-8 py-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200/70 dark:border-slate-700/70">
                        <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-8"></th>
                        <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</th>
                        <th className="pb-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Product Name</th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit Price</th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('services.tax')}</th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('services.taxTotal')}</th>
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {invoiceItems.map((item, idx) => (
                        <tr key={`${item.productId || item.description || 'service'}-${idx}`}>
                          <td className="py-3 pr-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.itemType === 'labor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                              {item.itemType === 'labor' ? 'Service' : 'Product'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">
                            {item.description || item.productName || '—'}
                          </td>
                          <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">
                            { item.productName || '—'}
                          </td>
                          <td className="py-3 text-right text-slate-500">
                            {Number(item.quantity || 0).toFixed(item.quantity % 1 ? 3 : 0)}
                          </td>
                          <td className="py-3 text-right text-slate-500">{money(item.unitPrice)}</td>
                          <td className="py-3 text-right text-slate-500">{Number(item.taxRate || 0).toFixed(2)}%</td>
                          <td className="py-3 text-right text-slate-500">{money(getVatAmount(item.lineTotal, item.taxRate))}</td>
                          <td className="py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{money(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Totals ── */}
                <div className="border-t border-slate-200/70 dark:border-slate-800/70 px-8 py-6">
                  <div className="ml-auto max-w-xs space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>{t('services.subTotal')}</span><span>{money(invoiceTotals.subTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Service Total</span><span>{money(invoiceTotals.laborTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Product Total</span><span>{money(invoiceTotals.partsTotal)}</span>
                    </div>
                    {showGoldJewelleryDetails && invoiceJewellery.diamondChargeNumber > 0 ? (
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Diamond Charge</span><span>{money(invoiceJewellery.diamondChargeNumber)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>{t('services.taxTotal')}</span><span>{money(invoiceTotals.taxTotal)}</span>
                    </div>
                    {showGoldJewelleryDetails && invoiceJewellery.additionalTaxNumber > 0 ? (
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Additional Tax</span><span>{money(invoiceJewellery.additionalTaxNumber)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-slate-200/70 pt-3 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                      <span className="text-base">{t('services.grandTotal')}</span>
                      <span className="text-lg">{money(invoiceTotals.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>{t('services.amountReceived')}</span>
                      <span className="font-semibold">{money(invoiceOrder.receivedTotal)}</span>
                    </div>
                    {Math.max(Number(invoiceTotals.grandTotal || 0) - Number(invoiceOrder.receivedTotal || 0), 0) > 0 && (
                      <div className="flex justify-between rounded-xl bg-rose-50 px-4 py-2.5 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                        <span className="font-semibold">{t('services.dueAmount')}</span>
                        <span className="font-bold">{money(Math.max(Number(invoiceTotals.grandTotal || 0) - Number(invoiceOrder.receivedTotal || 0), 0))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Attachment ── */}
                {invoiceAttachmentUrls.length > 0 && (
                  <div className="border-t border-slate-200/70 px-8 py-5 dark:border-slate-800/70">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Attachment</p>
                    <AttachmentStrip urls={invoiceAttachmentUrls} onOpen={setLightboxUrl} maxVisible={4} size="lg" />
                  </div>
                )}

                {/* ── Footer ── */}
                <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/60 px-8 py-4 dark:border-slate-800/70 dark:bg-slate-900/30">
                  <p className="text-xs text-slate-400">Thank you for your business!</p>
                  <p className="text-xs text-slate-400">
                    Printed {dayjs().format('D MMM YYYY')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Status Update Modal ── */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) closeStatusDialog(); }}>
          <div className="w-full max-w-sm rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
              <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('services.updateStatus')}</h2>
              <button type="button" onClick={closeStatusDialog} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
              <div className="space-y-4 p-6">
              {statusError ? <Notice title={statusError} tone="error" /> : null}
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900/60">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{statusDialog.orderNo || statusDialog.id.slice(0, 8)}</p>
                {statusDialog.Party?.name ? <p className="text-slate-500">{statusDialog.partyName}</p> : null}
              </div>
              <div className="space-y-2">
                {STATUS_STEPS.map((step) => {
                  const isSelected = newStatus === step.value;
                  return (
                    <button
                      key={step.value}
                      type="button"
                      onClick={() => setNewStatus(step.value)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${isSelected ? step.selectedClass : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'}`}
                    >
                      <span className={`h-3 w-3 shrink-0 rounded-full ${step.dotClass}`} />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{step.label}</p>
                        <p className="text-xs text-slate-500">{step.desc}</p>
                      </div>
                      {isSelected && <Check size={16} className={step.checkClass} />}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
                <button type="button" className="btn-ghost flex-1" onClick={closeStatusDialog}>{t('common.cancel')}</button>
                <button type="button" className="btn-primary flex-1" onClick={handleUpdateStatus} disabled={newStatus === statusDialog.status}>{t('services.updateStatus')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Dialog ── */}
      {payDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setPayDialog(null); }}>
          <div className="w-full max-w-sm rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-6 py-4 dark:border-slate-800/70">
              <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('services.recordPayment')}</h2>
              <button type="button" onClick={() => setPayDialog(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4 p-6">
              {payError ? <Notice title={payError} tone="error" /> : null}
              <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/60">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{payDialog.orderNo || payDialog.id.slice(0, 8)}</p>
                {payDialog.partyName ? <p className="text-slate-500">{payDialog.partyName}</p> : null}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total: {money(payDialog.grandTotal)}</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {t('services.dueAmount')}: {money(Math.max(Number(payDialog.grandTotal || 0) - Number(payDialog.receivedTotal || 0), 0))}
                  </span>
                </div>
              </div>
              <div>
                <label className="label">{t('services.amountReceived')}</label>
                <input
                  className="input mt-1"
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <PaymentMethodFields
                  value={{
                    paymentMethod: payPaymentMethod,
                    bankId: payBankId,
                    paymentNote: payNotes,
                  }}
                  onChange={(patch) => {
                    setPayPaymentMethod(patch.paymentMethod);
                    setPayBankId(patch.bankId);
                    setPayNotes(patch.paymentNote);
                  }}
                  noteLabel={t('payments.paymentNote')}
                />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
                <button type="button" className="btn-ghost flex-1" onClick={() => setPayDialog(null)}>{t('common.cancel')}</button>
                <button type="submit" className="btn-primary flex-1">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
