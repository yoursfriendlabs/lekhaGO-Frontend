import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import SearchableSelect from '../components/SearchableSelect';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import InvoiceHeader from '../components/InvoiceHeader';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import FileUpload from '../components/FileUpload';
import DynamicAttributes from '../components/DynamicAttributes';
import { X, Plus, Clock, Check, Search, Pencil, FileText, ChevronDown, Phone } from 'lucide-react';
import { usePartyStore } from '../stores/parties';
import { useServiceStore } from '../stores/services';
import { getCreatorDisplayName, getCurrentCreatorValue } from '../lib/records';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
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
  attributes: {},
});

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
  const { settings: bizSettings } = useBusinessSettings();

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
  const safeServiceList = Array.isArray(serviceList) ? serviceList : [];
  const safeAttributeDefs = Array.isArray(attributeDefs) ? attributeDefs : [];

  // ── Form data ──
  const [partyQuery, setPartyQuery] = useState('');
  const debouncedPartyQuery = useDebouncedValue(partyQuery, 250);
  const [partySearchResults, setPartySearchResults] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [header, setHeader] = useState(() => makeEmptyHeader());
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [amountReceived, setAmountReceived] = useState('0');
  const [isPaid, setIsPaid] = useState(false);

  // ── Items inline form ──
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemDraft, setItemDraft] = useState({ ...emptyItem });
  const [editingItemIdx, setEditingItemIdx] = useState(null);

  // ── Load services list ──
  const loadServices = () => {
    const params = { limit: 50 };
    if (statusFilter !== 'all') params.status = statusFilter;
    invalidateServices(params);
    fetchServices(params, true).catch((err) => setListError(err.message));
  };

  useEffect(() => {
    if (!businessId) return;
    const params = { limit: 50 };
    if (statusFilter !== 'all') params.status = statusFilter;
    fetchServices(params).catch((err) => setListError(err.message));
  }, [businessId, fetchServices, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, partyFilterId]);

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

  // ── Totals ──
  const totals = useMemo(() => {
    const laborTotal = items
      .filter((i) => i.itemType === 'labor')
      .reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const partsTotal = items
      .filter((i) => i.itemType === 'part')
      .reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const grandTotal = laborTotal + partsTotal;
    const received = isPaid ? grandTotal : Math.min(Number(amountReceived || 0), grandTotal);
    const due = Math.max(grandTotal - received, 0);
    return { laborTotal, partsTotal, grandTotal, received, due };
  }, [items, amountReceived, isPaid]);

  useEffect(() => {
    if (isPaid) setAmountReceived(totals.grandTotal.toFixed(2));
  }, [isPaid, totals.grandTotal]);

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
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setShowItemForm(true);
  };

  const startEditItem = (idx) => {
    setItemDraft({ ...items[idx] });
    setEditingItemIdx(idx);
    setShowItemForm(true);
  };

  const cancelItemForm = () => {
    setShowItemForm(false);
    setEditingItemIdx(null);
  };

  const confirmItem = () => {
    const draft = {
      ...itemDraft,
      lineTotal: (Number(itemDraft.quantity || 0) * Number(itemDraft.unitPrice || 0)).toFixed(2),
    };
    if (editingItemIdx !== null) {
      setItems((prev) => prev.map((item, idx) => (idx === editingItemIdx ? draft : item)));
    } else {
      setItems((prev) => [...prev, draft]);
    }
    setShowItemForm(false);
    setEditingItemIdx(null);
  };

  // ── Party helpers ──
  const filteredParties = useMemo(() => {
    return partySearchResults.slice(0, 6);
  }, [partySearchResults]);
  const selectedPartyBalanceMeta = getPartyBalanceMeta(selectedParty?.currentAmount, t);

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
    try {
      const createdParty = await api.createParty({ name, phone: newPartyPhone.trim(), type: 'customer' });
      const party = normalizeLookupParty(createdParty);
      upsertParty(party);
      selectParty(party);
      setFormNotice({ type: 'success', message: t('parties.messages.created') });
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    }
  };

  // ── Reset & open/close dialog ──
  const resetForm = () => {
    setHeader({ ...makeEmptyHeader(), orderNo: '' });
    setItems([{ ...emptyItem }]);
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
      const full = await api.getService(order.id);
      const rawItems = full.ServiceItems || full.items || [];
      const hydratedProducts = rawItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);
      
      // Build party object from all possible sources
      const partyData = {
        id: full.partyId || '',
        partyName: full.partyName || full.Customer?.name || '',
        phone: full.partyPhone || full.Customer?.phone || '',
        currentAmount: full.Party?.currentAmount || full.Customer?.currentAmount,
        type: 'customer',
      };
      
      setHeader({
        partyId: full.partyId || '',
        orderNo: full.orderNo || '',
        status: full.status || 'open',
        notes: full.notes || '',
        deliveryDate: toDateInputValue(full.deliveryDate) || todayISODate(),
        ...normalizePaymentFields(full),
        attachment: full.attachment || '',
        attributes: full.attributes || {},
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
        lineTotal: String(i.lineTotal ?? '0'),
      })) : [{ ...emptyItem }]);
      
      // Set selected party if we have party data
      if (partyData.id && partyData.partyName) {
        const party = normalizeLookupParty(partyData);
        setSelectedParty(party);
        setPartyQuery(`${partyData.partyName}${partyData.phone ? ` (${partyData.phone})` : ''}`);
      }
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    } finally {
      setEditLoading(false);
    }
  };
  const closeDialog = () => { setDialogOpen(false); resetForm(); };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessId) { setFormNotice({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.partyId) { setFormNotice({ type: 'error', message: t('errors.customerRequired') }); return; }
    const invalidPart = items.find((i) => i.itemType === 'part' && !i.productId);
    if (invalidPart) { setFormNotice({ type: 'error', message: t('errors.selectProductPart') }); return; }
    const invalidConversion = items.find((i) => {
      if (i.itemType !== 'part' || i.unitType !== 'secondary') return false;
      return Number(getProductById(i.productId)?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) { setFormNotice({ type: 'error', message: t('errors.conversionRequired') }); return; }
    if (requiresBankSelection(header, totals.received)) {
      setFormNotice({ type: 'error', message: t('payments.bankRequired') });
      return;
    }
    try {
      const manualOrderNo = String(header.orderNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const payload = {
        ...headerFields,
        laborTotal: totals.laborTotal,
        partsTotal: totals.partsTotal,
        grandTotal: totals.grandTotal,
        receivedTotal: totals.received,
        ...(Number(totals.received || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }),
        items: items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitType: item.unitType || 'primary',
          conversionRate: Number(getProductById(item.productId)?.conversionRate || 0),
          unitPrice: Number(item.unitPrice),
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
      closeDialog();
      loadServices();
    } catch (err) {
      setFormNotice({ type: 'error', message: err.message });
    }
  };

  // ── Unique parties from service list (for filter dropdown) ──
  const serviceParties = useMemo(() => {
    const seen = new Set();
    const result = [];
    safeServiceList.forEach((order) => {
      const id = order.partyId;
      if (!id || seen.has(id)) return;
      seen.add(id);
      result.push({ id, name: order.partyName || order.Party?.name || id });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [safeServiceList]);

  // ── Filtered + paged service list ──
  const filteredServiceList = useMemo(() => {
    if (!partyFilterId) return safeServiceList;
    return safeServiceList.filter((order) => order.partyId === partyFilterId);
  }, [safeServiceList, partyFilterId]);

  const pagedServices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredServiceList.slice(start, start + pageSize);
  }, [filteredServiceList, page, pageSize]);

  // ── Status dialog ──
  const openStatusDialog = (order) => {
    setStatusDialog(order);
    setNewStatus(order.status || 'open');
    setStatusError('');
  };
  const closeStatusDialog = () => setStatusDialog(null);

  const openInvoiceModal = async (order) => {
    setInvoiceOrder(order);
    setInvoiceLoading(true);
    try {
      const full = await api.getService(order.id);
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
    t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(val || 0).toFixed(2) });

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

  // ── Render ──
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('services.title')}
        subtitle={t('services.subtitle')}
        action={
          <button className="btn-primary w-full sm:w-auto" type="button" onClick={openDialog}>
            <Plus size={16} className="mr-1.5 inline" />
            {t('services.newOrder')}
          </button>
        }
      />

      {listError ? <Notice title={listError} tone="error" /> : null}

      {/* ── Orders Table ── */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('services.recentOrders')}</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? "bg-blue-50 border  border-blue-500 text-blue-500 px-2 rounded" : "border rounded px-2 border-gray-300"}>
                All
              </button>
              <button onClick={() => setStatusFilter('open')} className={statusFilter === 'open' ? "bg-blue-50 border px-2 border-blue-500 text-blue-500 rounded" : "border rounded px-2 border-gray-300"}>
                Open
              </button>
              <button onClick={() => setStatusFilter('in_progress')} className={statusFilter === 'in_progress' ? "bg-yellow-50 border px-2 border-yellow-500 text-yellow-500 rounded" : "border rounded px-2 border-gray-300"}>
                In Progress
              </button>
              <button onClick={() => setStatusFilter('closed')} className={statusFilter === 'closed' ? "bg-green-50 border px-2 border-green-500 text-green-500 rounded" : "border rounded px-2 border-gray-300"}>
                Closed
              </button>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <SearchableSelect
              className="w-full sm:min-w-[180px]"
              options={[
                { value: '', label: t('services.filterByParty') },
                ...serviceParties.map((p) => ({ value: p.id, label: p.name })),
              ]}
              value={partyFilterId}
              onChange={setPartyFilterId}
              placeholder={t('services.filterByParty')}
            />
          </div>
        </div>

        {/* Mobile card view */}
        <div className="mt-4 md:hidden space-y-3">
          {listLoading && safeServiceList.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">{t('common.loading')}</p>
          ) : pagedServices.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">{t('services.noOrders')}</p>
          ) : (
            pagedServices.map((order) => {
              const due = Math.max(Number(order.grandTotal || 0) - Number(order.receivedTotal || 0), 0);
              const days = getDeliveryDaysLeft(order.deliveryDate);
              const isUrgent = order.status !== 'closed' && days !== null && days < 3;
              return (
                <div
                  key={order.id}
                  className={`rounded-2xl border p-4 text-sm ${
                    isUrgent
                      ? 'border-red-200/70 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10'
                      : 'border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {order.orderNo || order.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{order.Party?.name || order.partyName || '—'}</p>
                      <PaymentTypeSummary
                        source={order}
                        className="mt-1"
                        labelClassName="text-xs font-medium"
                        metaClassName="text-[11px]"
                      />
                      <p className="mt-1 text-xs text-slate-400">Created By: {getCreatorDisplayName(order)}</p>
                      <div className="mt-1">
                        <DeliveryBadge date={order.deliveryDate} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={order.status} />
                      <p className="mt-1.5 font-semibold text-slate-800 dark:text-slate-200">{money(order.grandTotal)}</p>
                      {due > 0 ? (
                        <button
                          type="button"
                          className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
                          onClick={() => openPayDialog(order)}
                        >
                          {money(due)} due
                        </button>
                      ) : (
                        <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/50 pt-2.5 dark:border-slate-700/40">
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => openStatusDialog(order)}
                    >
                      <ChevronDown size={12} /> Status
                    </button>
                    <div className="flex items-center gap-1">
                      {order.attachment && (
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setLightboxUrl(order.attachment.startsWith('http') ? order.attachment : `${API_BASE}${order.attachment}`)}
                        >
                          <FileText size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800"
                        onClick={() => openInvoiceModal(order)}
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        onClick={() => openEditDialog(order)}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop table */}
        <div className="mt-4 overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4 text-left">{t('services.orderNo')}</th>
                <th className="py-2 pr-4 text-left">{t('services.customer')}</th>
                <th className="py-2 pr-4 text-left">{t('services.deliveryDate')}</th>
                <th className="py-2 pr-4 text-left">{t('services.status')}</th>
                <th className="py-2 pr-4 text-left">{t('common.payment')}</th>
                <th className="py-2 pr-2 text-left text-xs">Attach.</th>
                <th className="py-2 pr-4 text-right">{t('services.grandTotal')}</th>
                <th className="py-2 pr-4 text-right">{t('services.amountReceived')}</th>
                <th className="py-2 pr-4 text-right">{t('services.due')}</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && safeServiceList.length === 0 ? (
                <tr><td colSpan={10} className="py-4 text-slate-500">{t('common.loading')}</td></tr>
              ) : pagedServices.length === 0 ? (
                <tr><td colSpan={10} className="py-4 text-slate-500">{t('services.noOrders')}</td></tr>
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
                  return (
                    <tr key={order.id} className={rowClass}>
                      <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">
                        {order.orderNo || order.id.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                        <div>{order.Party?.name || order.partyName || <span className="text-slate-400">—</span>}</div>
                        <div className="text-xs text-slate-400">Created By: {getCreatorDisplayName(order)}</div>
                      </td>
                      <td className="py-2.5 pr-4"><DeliveryBadge date={order.deliveryDate} /></td>
                      <td className="py-2.5 pr-4">
                        <button type="button" className="transition hover:opacity-75" onClick={() => openStatusDialog(order)}>
                          <StatusBadge status={order.status} />
                        </button>
                      </td>
                      <td className="py-2.5 pr-4">
                        <PaymentTypeSummary source={order} />
                      </td>
                      <td className="py-2.5 pr-2">
                        {order.attachment ? (
                          <button type="button" onClick={() => setLightboxUrl(`${API_BASE}${order.attachment}`)}>
                            <img
                              src={order.attachment.startsWith('http') ? order.attachment : `${API_BASE}${order.attachment}`}
                              alt="attach"
                              className="h-8 w-8 rounded object-cover border border-slate-200 hover:opacity-80 transition"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-slate-800 dark:text-slate-200">{money(order.grandTotal)}</td>
                      <td className="py-2.5 pr-4 text-right text-emerald-700 dark:text-emerald-400">{money(order.receivedTotal)}</td>
                      <td className="py-2.5 pr-4 text-right">
                        {due > 0 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                            onClick={() => openPayDialog(order)}
                          >
                            {money(due)} · Pay
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Paid</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" title="Edit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" onClick={() => openEditDialog(order)}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" title="View Invoice" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-primary-700 dark:hover:bg-slate-800" onClick={() => openInvoiceModal(order)}>
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
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredServiceList.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          pageSizeOptions={[10, 20, 50]}
        />
      </div>

      {/* ── New / Edit Order Dialog ── */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 backdrop-blur-sm md:items-center md:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeDialog(); }}
        >
          <div className="relative flex max-h-[100dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 md:max-h-[90vh] md:rounded-3xl">
            {/* Dialog header */}
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-4 dark:border-slate-800/70 md:px-5">
              <h2 className="font-serif text-xl text-slate-900 dark:text-white">
                {editingId ? 'Edit Service Order' : t('services.newOrder')}
              </h2>
              <button type="button" onClick={closeDialog} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="max-h-[calc(100dvh-8rem)] space-y-5 overflow-y-auto px-4 py-4 md:max-h-[80vh] md:px-5 md:py-5">
                {formNotice.message ? (
                  <Notice title={formNotice.message} tone={formNotice.type} />
                ) : null}

                {editLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                  </div>
                )}

                {/* ── Customer Autocomplete ── */}
                <FormSectionCard hint={t('services.customerRequired')}>
                  <label className="label">
                    {t('services.customer')} <span className="ml-1 text-rose-500">*</span>
                  </label>
                  <div className="relative mt-1">
                    {selectedParty ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-sm font-bold text-white">
                          {selectedParty.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{selectedParty.name}</p>
                          {selectedParty.phone && <p className="text-xs text-slate-500">{selectedParty.phone}</p>}
                          {selectedParty.currentAmount !== undefined && selectedParty.currentAmount !== null && (
                            <p className={`text-xs ${selectedPartyBalanceMeta.textClass}`}>
                              {selectedPartyBalanceMeta.label}:{' '}
                              {t('currency.formatted', {
                                symbol: t('currency.symbol'),
                                amount: selectedPartyBalanceMeta.absoluteAmount.toFixed(2),
                              })}
                            </p>
                          )}
                        </div>
                        <button type="button" onClick={clearParty} className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/60 focus-within:border-primary-300">
                          <Search size={16} className="shrink-0 text-slate-400" />
                          <input
                            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400 dark:text-slate-200"
                            placeholder={t('services.customerSearch')}
                            value={partyQuery}
                            onChange={handlePartySearch}
                            onFocus={() => setPartyDropdownOpen(true)}
                          />
                          {partyQuery && (
                            <button type="button" onClick={clearParty} className="text-slate-400 hover:text-slate-600">
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        {/* Dropdown */}
                        {partyDropdownOpen && partyQuery.trim() && (
                          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {filteredParties.length > 0 && filteredParties.map((party) => (
                              <button
                                key={party.id}
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-100/80 dark:border-slate-800/50 last:border-b-0"
                                onClick={() => selectParty(party)}
                              >
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {party.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800 dark:text-slate-200">{party.name}</p>
                                  {party.phone && <p className="text-xs text-slate-500">{party.phone}</p>}
                                </div>
                              </button>
                            ))}

                            {/* Add new inline */}
                            {!showAddNew ? (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-4 py-3 text-sm text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 rounded-b-2xl"
                                onClick={() => setShowAddNew(true)}
                              >
                                <Plus size={14} />
                                Add &ldquo;{partyQuery.trim()}&rdquo; as customer
                              </button>
                            ) : (
                              <div className="rounded-b-2xl border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">New: <span className="text-primary-700">{partyQuery.trim()}</span></p>
                                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                                  <Phone size={13} className="text-slate-400 shrink-0" />
                                  <input
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                                    type="tel"
                                    inputMode="numeric"
                                    placeholder={t('parties.phonePlaceholder')}
                                    value={newPartyPhone}
                                    onChange={(e) => setNewPartyPhone(e.target.value)}
                                  />
                                </div>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                  <button type="button" className="btn-ghost text-xs" onClick={() => setShowAddNew(false)}>Cancel</button>
                                  <button type="button" className="btn-primary text-xs" onClick={createAndSelectParty}>Create & Select</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </FormSectionCard>

                {/* ── Meta fields ── */}
                <FormSectionCard>
                  <div className="grid gap-3 sm:grid-cols-3">
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

                {/* ── Notes + Attachment ── */}
                <FormSectionCard>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">{t('services.notes')}</label>
                      <textarea
                        className="input mt-1 h-20 resize-none"
                        name="notes"
                        value={header.notes}
                        onChange={handleHeaderChange}
                        placeholder={t('services.notesPlaceholder')}
                      />
                    </div>
                    <FileUpload
                      label={t('services.attachment')}
                      initialUrl={header.attachment}
                      onUpload={(url) => setHeader((prev) => ({ ...prev, attachment: url }))}
                    />
                  </div>
                </FormSectionCard>

                {/* ── Dynamic Attributes ── */}
                <FormSectionCard title={t('services.orderInformation')} className="bg-slate-50/50 dark:bg-slate-900/30">
                  <DynamicAttributes
                    entityType="service"
                    attributes={header.attributes}
                    onChange={(attr) => setHeader((prev) => ({ ...prev, attributes: attr }))}
                  />
                </FormSectionCard>

                {/* ── Items Section ── */}
                <FormSectionCard
                  title={t('services.items')}
                  action={<span className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</span>}
                >
                  {/* Existing items as compact rows */}
                  {items.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {items.map((item, idx) => {
                        const product = getProductById(item.productId);
                        const displayName = item.description || (product ? product.name : '') || '—';
                        return editingItemIdx === idx && showItemForm ? null : (
                          <div
                            key={`item-row-${idx}`}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-3 text-sm dark:border-slate-800/60 dark:bg-slate-900/60 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.itemType === 'labor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}>
                                {item.itemType === 'labor' ? 'Service' : 'Product'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate text-slate-700 dark:text-slate-300">{displayName}</span>
                                <span className="mt-1 block text-xs text-slate-400">{item.quantity} {item.actualUnit} × {money(item.unitPrice)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                              <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-200">{money(item.lineTotal)}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                                  onClick={() => startEditItem(idx)}
                                >
                                  <Pencil size={13} />
                                </button>
                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
                                    onClick={() => removeItem(idx)}
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Inline Add / Edit Item Form */}
                  {showItemForm && (
                    <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/40 p-4 dark:border-primary-800/40 dark:bg-primary-900/10 mb-3">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-400">
                        {editingItemIdx !== null ? 'Edit Item' : 'Add Item'}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="label">{t('services.type')}</label>
                          <select
                            className="input mt-1"
                            value={itemDraft.itemType}
                            onChange={(e) => handleDraftChange('itemType', e.target.value)}
                          >
                            <option value="labor">{'Service'}</option>
                            <option value="part">{'Product'}</option>
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
                        {itemDraft.itemType === 'part' && (
                          <div className="sm:col-span-2">
                            <label className="label">{t('services.productParts')}</label>
                            <AsyncSearchableSelect
                              className="mt-1"
                              value={itemDraft.productId}
                              selectedOption={getProductById(itemDraft.productId) ? toProductLookupOption(getProductById(itemDraft.productId)) : null}
                              onChange={handleDraftProductSelection}
                              loadOptions={loadProductOptions}
                              placeholder={t('purchases.selectProduct')}
                              searchPlaceholder={t('purchases.selectProduct')}
                              noResultsLabel={t('common.noData')}
                              loadingLabel={t('common.loading')}
                            />
                          </div>
                        )}
                        {/* Unit type selector — only when product has a secondary unit */}
                        {itemDraft.itemType === 'part' && (() => {
                          const prod = getProductById(itemDraft.productId);
                          return prod?.secondaryUnit ? (
                            <div className="sm:col-span-2">
                              <label className="label">{t('products.unitType')}</label>
                              <div className="mt-1 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDraftChange('unitType', 'primary', prod.primaryUnit)}
                                  className={itemDraft.unitType === 'primary' ? 'btn-primary flex-1 text-sm' : 'btn-ghost flex-1 text-sm'}
                                >
                                  {prod.primaryUnit || t('products.primaryUnit')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDraftChange('unitType', 'secondary', prod.secondaryUnit)}
                                  className={itemDraft.unitType === 'secondary' ? 'btn-primary flex-1 text-sm' : 'btn-ghost flex-1 text-sm'}
                                >
                                  {prod.secondaryUnit} <span className="opacity-60 text-xs ml-1">({t('products.secondaryUnit')})</span>
                                </button>
                              </div>
                              {prod.conversionRate > 0 && (
                                <p className="mt-1 text-xs text-slate-500">
                                  1 {prod.primaryUnit} = {prod.conversionRate} {prod.secondaryUnit}
                                </p>
                              )}
                            </div>
                          ) : null;
                        })()}
                        <div>
                          <label className="label">{t('services.qty')}</label>
                          <input
                            className="input mt-1"
                            type="number"
                            step="0.001"
                            value={itemDraft.quantity}
                            onChange={(e) => handleDraftChange('quantity', e.target.value)}
                          />
                          {itemDraft.itemType === 'part' && (
                            <p className="mt-1 text-xs text-slate-500">{getUnitLabel(getProductById(itemDraft.productId), itemDraft.unitType)}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">{t('services.unitPrice')}</label>
                          <input
                            className="input mt-1"
                            type="number"
                            step="0.01"
                            value={itemDraft.unitPrice}
                            onChange={(e) => handleDraftChange('unitPrice', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Total: <strong className="text-slate-800 dark:text-slate-200">{money(itemDraft.lineTotal)}</strong>
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button type="button" className="btn-ghost text-sm" onClick={cancelItemForm}>
                            Cancel
                          </button>
                          <button type="button" className="btn-primary text-sm" onClick={confirmItem}>
                            {editingItemIdx !== null ? 'Update' : 'Add'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!showItemForm && (
                    <button
                      type="button"
                      className="btn-ghost w-full border-2 border-dashed border-slate-200 text-slate-500 hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:hover:border-primary-600"
                      onClick={startAddItem}
                    >
                      <Plus size={15} className="mr-1.5 inline" />
                      {t('services.addLine')}
                    </button>
                  )}
                </FormSectionCard>

                {/* ── Totals + Payment ── */}
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-slate-800/60 dark:bg-slate-900/40">
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('services.laborTotal')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{money(totals.laborTotal)}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('services.partsTotal')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{money(totals.partsTotal)}</span>
                    </div>
                    <div className="flex justify-between sm:flex-col sm:gap-0.5">
                      <span className="text-slate-500">{t('services.grandTotal')}</span>
                      <span className="text-lg font-bold text-slate-900 dark:text-white">{money(totals.grandTotal)}</span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[140px]">
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

                    {totals.due > 0 && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 text-sm dark:border-rose-800/40 dark:bg-rose-900/20">
                        <span className="text-rose-500 dark:text-rose-400">{t('services.dueAmount')}:</span>
                        <span className="font-bold text-rose-700 dark:text-rose-300">{money(totals.due)}</span>
                      </div>
                    )}

                    <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                      <PaymentMethodFields
                        value={header}
                        onChange={(patch) => setHeader((prev) => ({ ...prev, ...patch }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dialog footer */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-200/70 px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-slate-800/70 md:flex-row md:justify-end md:px-5 md:pb-4">
                <button type="button" className="btn-ghost w-full sm:w-auto" onClick={closeDialog}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={editLoading}>
                  {editingId ? t('common.update') : t('services.saveOrder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Attachment Lightbox ── */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setLightboxUrl(null)}>
            <X size={20} />
          </button>
          {lightboxUrl.toLowerCase().endsWith('.pdf') ? (
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
                  {invoiceOrder.attributes && Object.keys(invoiceOrder.attributes).length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
                      {Object.entries(invoiceOrder.attributes).map(([key, val]) => {
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
                        <th className="pb-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(invoiceOrder.ServiceItems || invoiceOrder.items || []).map((item, idx) => (
                        <tr key={idx}>
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
                      <span>Labor Total</span><span>{money(invoiceOrder.laborTotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Parts Total</span><span>{money(invoiceOrder.partsTotal)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/70 pt-3 font-bold text-slate-900 dark:border-slate-700 dark:text-white">
                      <span className="text-base">Grand Total</span>
                      <span className="text-lg">{money(invoiceOrder.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Amount Received</span>
                      <span className="font-semibold">{money(invoiceOrder.receivedTotal)}</span>
                    </div>
                    {Math.max(Number(invoiceOrder.grandTotal || 0) - Number(invoiceOrder.receivedTotal || 0), 0) > 0 && (
                      <div className="flex justify-between rounded-xl bg-rose-50 px-4 py-2.5 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                        <span className="font-semibold">Due Amount</span>
                        <span className="font-bold">{money(Math.max(Number(invoiceOrder.grandTotal || 0) - Number(invoiceOrder.receivedTotal || 0), 0))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Attachment ── */}
                {invoiceOrder.attachment && (
                  <div className="border-t border-slate-200/70 px-8 py-5 dark:border-slate-800/70">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Attachment</p>
                    {invoiceOrder.attachment.toLowerCase().endsWith('.pdf') ? (
                      <a href={invoiceOrder.attachment} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary-700 hover:underline">
                        <FileText size={16} /> View attached PDF
                      </a>
                    ) : (
                      <img
                        src={`${API_BASE}${invoiceOrder.attachment}`}
                        alt="Attachment"
                        className="max-h-56 rounded-xl border border-slate-200 object-contain dark:border-slate-800"
                      />
                    )}
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
