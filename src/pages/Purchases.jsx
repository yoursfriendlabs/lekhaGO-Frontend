import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, FileText, Package, Plus, Wallet, Wrench, X, Trash2, Printer } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import RefreshButton from '../components/RefreshButton.jsx';
import PaymentMethodFields from '../components/PaymentMethodFields.jsx';
import NoteTextarea from '../components/NoteTextarea.jsx';
import FormSectionCard from '../components/FormSectionCard.jsx';
import MobileFormStepper from '../components/MobileFormStepper.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import QuickPaymentButtons from '../components/QuickPaymentButtons.jsx';
import PartySearchCreateField from '../components/PartySearchCreateField.jsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import { useI18n } from '../lib/i18n.jsx';
import AsyncSearchableSelect from '../components/AsyncSearchableSelect.jsx';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { usePurchaseStore } from '../stores/purchases';
import { useProductStore } from '../stores/products';
import { buildPaymentPayload, normalizePaymentFields, requiresBankSelection } from '../lib/payments';
import { useIsMobile } from '../hooks/useIsMobile.js';
import {
  mergeLookupEntities,
  normalizeLookupParty,
  normalizeLookupProduct,
  toProductLookupOption,
} from '../lib/lookups.js';
import QuickExpense from '../components/quickExpenses.jsx';



// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    received: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ordered: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    due: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-600'}`}>
      {label}
    </span>
  );
}

function formatDate(d) { return formatMaybeDate(d, 'ddd DD, MMM'); }
function getSupplierName(p) { return p.partyName || p.supplierName || p.Party?.name || p.Supplier?.name || null; }
function getPurchaseEntryType(p) { return String(p?.entryType || p?.type || 'purchase').toLowerCase() === 'expense' ? 'expense' : 'purchase'; }
function getPurchaseDueAmount(p) { return Math.max(Number(p?.grandTotal || 0) - Number(p?.amountReceived || 0), 0); }
function getVatAmount(lineTotal, taxRate) { return (Number(lineTotal || 0) * Number(taxRate || 0)) / 100; }

const emptyPurchaseItem = { productId: '', quantity: '1', unitType: 'primary', unitPrice: '0', taxRate: '0', lineTotal: '0', itemType: 'part', description: '' };
const emptyExpenseItem = { productId: '', quantity: '1', unitType: 'primary', unitPrice: '0', taxRate: '0', lineTotal: '0', itemType: 'expense', description: '' };
const TABLE_ROW_OPTIONS = [10, 20, 30, 40, 50];
const getEmptyItem = (t) => (t === 'expense' ? { ...emptyExpenseItem } : { ...emptyPurchaseItem });

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function Purchases() {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const canManagePurchases = canManageFeature('purchases');
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const createIntentHandledRef = useRef(false);

  const {
    purchases: purchaseList, loading: purchasesLoading,
    total: purchaseTotal, totalKnown: purchaseTotalKnown,
    fetch: fetchPurchases, invalidate: invalidatePurchases,
  } = usePurchaseStore();

  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState('');
  const [productDirectory, setProductDirectory] = useState({});
  const [selectedSupplier, setSelectedSupplier] = useState(null);



  // ── Main form ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [entryTypeFilter, setEntryTypeFilter] = useState('all');
  const [isPaid, setIsPaid] = useState(false);
  const [header, setHeader] = useState({ entryType: 'expense', partyId: '', partyName: '', invoiceNo: '', purchaseDate: todayISODate(), status: 'received', notes: '', amountReceived: '0', paymentMethod: 'cash', bankId: '', paymentNote: '' });
  const [items, setItems] = useState([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [itemDraft, setItemDraft] = useState(getEmptyItem('purchase'));
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [itemStatus, setItemStatus] = useState({ type: 'info', message: '' });
  const [isOpen, setIsOpen] = useState(false);
  const [payDialog, setPayDialog] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payPaymentMethod, setPayPaymentMethod] = useState('cash');
  const [payBankId, setPayBankId] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [formMode, setFormMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const quantityInputRef = useRef(null);
  const [deletePurchase, setDeletePurchase] = useState(null);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState('');
  const [savingPurchase, setSavingPurchase] = useState(false);
  const [recordingPaymentId, setRecordingPaymentId] = useState('');
  const [openingPurchaseForm, setOpeningPurchaseForm] = useState(false);
  const [page, setPage] = useState(1);
  const [refreshingPurchases, setRefreshingPurchases] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [mobileStep, setMobileStep] = useState('details');
  const manualStatusRef = useRef(false);
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);

  const isExpense = header.entryType === 'expense';
  const money = (v) => t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(v || 0).toFixed(2) });

  const listParams = useMemo(() => ({
    limit: pageSize, offset: (page - 1) * pageSize,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(entryTypeFilter !== 'all' ? { entryType: entryTypeFilter } : {}),
  }), [entryTypeFilter, page, pageSize, statusFilter]);

  useEffect(() => { if (!businessId) return; fetchPurchases(listParams); }, [businessId, fetchPurchases, listParams]);
  useEffect(() => { setPage(1); }, [entryTypeFilter, statusFilter]);

  const refreshPurchases = async () => {
    if (refreshingPurchases) return;
    setRefreshingPurchases(true);
    try { invalidatePurchases(listParams); await fetchPurchases(listParams, true); }
    catch (err) { setStatus({ type: 'error', message: err.message }); }
    finally { setRefreshingPurchases(false); }
  };

  const totals = useMemo(() => {
    const subTotal = items.reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const taxTotal = items.reduce((s, i) => s + getVatAmount(i.lineTotal, i.taxRate), 0);
    return { subTotal, taxTotal, grandTotal: subTotal + taxTotal };
  }, [items]);

  const expenseTotals = useMemo(() => items.reduce((acc, item) => {
    const amt = Number(item.lineTotal || 0) + getVatAmount(item.lineTotal, item.taxRate);
    if (item.itemType === 'labor') acc.labor += amt;
    else if (item.itemType === 'part') acc.part += amt;
    else acc.expense += amt;
    return acc;
  }, { expense: 0, labor: 0, part: 0 }), [items]);

  const paidAmount = useMemo(() => (isPaid ? totals.grandTotal : Math.min(Number(header.amountReceived || 0), totals.grandTotal)), [header.amountReceived, isPaid, totals.grandTotal]);
  const dueAmount = Math.max(totals.grandTotal - paidAmount, 0);

  const purchaseSteps = useMemo(() => ([
    { id: 'details', label: t('common.details') },
    { id: 'items', label: t('purchases.items') },
    { id: 'payment', label: t('common.payment') },
  ]), [t]);

  useEffect(() => {
    if (!isPaid) return;
    setHeader((p) => ({ ...p, amountReceived: totals.grandTotal.toFixed(2), status: p.status === 'due' ? 'received' : p.status }));
  }, [isPaid, totals.grandTotal]);

  useEffect(() => {
    if (isPaid || manualStatusRef.current || header.status === 'ordered') return;
    if (dueAmount > 0 && header.status === 'received') setHeader((p) => ({ ...p, status: 'due' }));
    else if (dueAmount === 0 && header.status === 'due') setHeader((p) => ({ ...p, status: 'received' }));
  }, [dueAmount, header.status, isPaid]);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    if (name === 'status') {
      manualStatusRef.current = true;
      if (value === 'due' || value === 'ordered') setIsPaid(false);
      if (value === 'received') setIsPaid(true);
    }
    setHeader((p) => ({ ...p, [name]: value }));
  };

  const applyQuickPaidAmount = (next, { markPaid = false } = {}) => {
    manualStatusRef.current = false;
    setIsPaid(markPaid && totals.grandTotal > 0);
    setHeader((p) => ({ ...p, amountReceived: Math.min(Math.max(Number(next || 0), 0), totals.grandTotal).toFixed(2) }));
  };

  const handleEntryTypeChange = (val) => {
    const value = typeof val === 'string' ? val : val.target.value;
    setStatus({ type: 'info', message: '' }); setItemStatus({ type: 'info', message: '' });
    setHeader((p) => ({ ...p, entryType: value, partyName: value === 'expense' ? p.partyName || selectedSupplier?.name || '' : p.partyName }));
    setItems([]); setDeletedItemIds([]); setShowItemDialog(false); setItemDraft(getEmptyItem(value)); setEditingItemIdx(null);
  };

  const getProductById = (id) => { if (!id && id !== 0) return null; return productDirectory[String(id)] || null; };
  const cacheProducts = (entries) => setProductDirectory((p) => mergeLookupEntities(p, entries));
  const loadProductOptions = async (search) => {
    const data = await api.lookupProducts({ search, limit: 10 });
    const normalized = (data?.items || []).map(normalizeLookupProduct);
    cacheProducts(normalized);
    return normalized.map(toProductLookupOption);
  };

  const handleSupplierSelect = (party) => {
    setSelectedSupplier(party || null);
    setHeader((p) => ({ ...p, partyId: party?.id || '', partyName: party?.name || p.partyName }));
  };

  const getUnitLabel = (product, unitType) => {
    if (!product) return '';
    return unitType === 'secondary' ? product.secondaryUnit || product.primaryUnit || '' : product.primaryUnit || product.secondaryUnit || '';
  };

  const syncDraftDefaults = (product) => {
    if (!product) return;
    setItemDraft((prev) => {
      const next = { ...prev };
      if (!next.unitType) next.unitType = 'primary';
      if (next.unitType === 'secondary') {
        const exp = Number(product.secondarySalePrice || 0);
        if (exp > 0) { next.unitPrice = String(exp); }
        else {
          const cr = Number(product.conversionRate || 0), pp = Number(product.purchasePrice || 0);
          if (cr > 0 && pp > 0) next.unitPrice = String((pp / cr).toFixed(4));
        }
      } else if (next.unitType === 'primary' && Number(product.purchasePrice || 0) > 0) {
        next.unitPrice = String(product.purchasePrice);
      }
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    });
  };

  const handleDraftProductSelection = (option) => {
    const product = option?.entity ? normalizeLookupProduct(option.entity) : null;
    if (product?.id) cacheProducts([product]);
    setItemDraft((p) => ({ ...p, productId: option?.value || '', taxRate: String(product?.taxRate || 0) }));
    if (product) { syncDraftDefaults(product); setTimeout(() => { quantityInputRef.current?.focus(); quantityInputRef.current?.select(); }, 100); }
  };

  const handleDraftChange = (field, value) => {
    if (field === 'unitType') {
      const product = getProductById(itemDraft.productId);
      setItemDraft((prev) => {
        const next = { ...prev, unitType: value };
        if (product) {
          if (value === 'secondary') {
            const exp = Number(product.secondarySalePrice || 0);
            if (exp > 0) { next.unitPrice = String(exp); }
            else { const cr = Number(product.conversionRate || 0), pp = Number(product.purchasePrice || 0); if (cr > 0 && pp > 0) next.unitPrice = String((pp / cr).toFixed(4)); }
          } else if (Number(product.purchasePrice || 0) > 0) { next.unitPrice = String(product.purchasePrice); }
        }
        next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
        return next;
      });
      return;
    }
    setItemDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'itemType' && value !== 'part') { next.productId = ''; next.unitType = 'primary'; }
      next.lineTotal = (Number(next.quantity || 0) * Number(next.unitPrice || 0)).toFixed(2);
      return next;
    });
    if (field === 'productId') { const p = getProductById(value); if (p) window.setTimeout(() => syncDraftDefaults(p), 0); }
  };

  const openItemDialogForCreate = () => { setStatus({ type: 'info', message: '' }); setItemStatus({ type: 'info', message: '' }); setItemDraft(getEmptyItem(header.entryType)); setEditingItemIdx(null); setShowItemDialog(true); setMobileStep('items'); };
  const openItemDialogForEdit = (idx) => { setStatus({ type: 'info', message: '' }); setItemStatus({ type: 'info', message: '' }); setItemDraft({ ...items[idx] }); setEditingItemIdx(idx); setShowItemDialog(true); setMobileStep('items'); };
  const closeItemDialog = () => { setShowItemDialog(false); setEditingItemIdx(null); setItemDraft(getEmptyItem(header.entryType)); setItemStatus({ type: 'info', message: '' }); };

  const confirmItem = () => {
    if (header.entryType === 'expense') {
      if (itemDraft.itemType === 'part' && !itemDraft.productId) { setItemStatus({ type: 'error', message: t('errors.selectProductPart') }); return; }
      if (Number(itemDraft.lineTotal || 0) <= 0) { setItemStatus({ type: 'error', message: t('errors.expenseLineRequired') }); return; }
    } else if (!itemDraft.productId) { setItemStatus({ type: 'error', message: t('errors.selectProductPurchase') }); return; }
    if (itemDraft.productId && itemDraft.unitType === 'secondary' && Number(getProductById(itemDraft.productId)?.conversionRate || 0) <= 0) {
      setItemStatus({ type: 'error', message: t('errors.conversionRequired') }); return;
    }
    const draft = { ...itemDraft, lineTotal: (Number(itemDraft.quantity || 0) * Number(itemDraft.unitPrice || 0)).toFixed(2) };
    if (editingItemIdx !== null) setItems((p) => p.map((item, i) => (i === editingItemIdx ? draft : item)));
    else setItems((p) => [...p, draft]);
    setStatus({ type: 'info', message: '' }); setItemStatus({ type: 'info', message: '' }); closeItemDialog();
  };

  const removeItem = (idx) => setItems((p) => {
    const target = p[idx];
    if (target?.id) setDeletedItemIds((ids) => [...ids, target.id]);
    return p.filter((_, i) => i !== idx);
  });

  const filteredPurchases = useMemo(() => purchaseList.filter((purchase) => {
    const et = getPurchaseEntryType(purchase);
    if (entryTypeFilter !== 'all' && et !== entryTypeFilter) return false;
    if (statusFilter !== 'all' && String(purchase.status || '').toLowerCase() !== statusFilter) return false;
    return true;
  }), [entryTypeFilter, purchaseList, statusFilter]);

  const totalPurchases = purchaseTotalKnown ? purchaseTotal : filteredPurchases.length;
  const pagedPurchases = filteredPurchases;

  const resetForm = (entryType = 'expense') => {
    manualStatusRef.current = false;
    setHeader({ entryType, partyId: '', partyName: '', invoiceNo: '', purchaseDate: todayISODate(), status: 'received', notes: '', amountReceived: '0', paymentMethod: 'cash', bankId: '', paymentNote: '' });
    setItems([]); setDeletedItemIds([]); setEditingId(null); setFormMode('create'); setIsPaid(false);
    setSuggestedInvoiceNo(''); setMobileStep('details'); setProductDirectory({}); setSelectedSupplier(null);
    setShowItemDialog(false); setEditingItemIdx(null); setItemDraft(getEmptyItem(entryType)); setItemStatus({ type: 'info', message: '' });
  };

  const closeDialog = () => { setIsOpen(false); setMobileStep('details'); };

  const openCreate = async ({ entryType = 'expense' } = {}) => {
    if (!canManagePurchases || openingPurchaseForm) return;
    setOpeningPurchaseForm(true); resetForm(entryType); setMobileStep('details');
    setStatus({ type: 'info', message: '' }); setPayDialog(null); setIsOpen(true);
    try { if (businessId) { try { const data = await api.getNextSequences(); setSuggestedInvoiceNo(data?.nextPurchaseInvoiceNo || ''); } catch { setSuggestedInvoiceNo(''); } } }
    finally { setOpeningPurchaseForm(false); }
  };

  useEffect(() => {
    if (searchParams.get('create') !== '1') { createIntentHandledRef.current = false; return; }
    if (createIntentHandledRef.current) return;
    createIntentHandledRef.current = true;
    openCreate({ entryType: searchParams.get('entry') === 'purchase' ? 'purchase' : 'expense' });
    const np = new URLSearchParams(searchParams); np.delete('create'); np.delete('entry');
    setSearchParams(np, { replace: true });
  }, [openCreate, searchParams, setSearchParams]);

  const openEdit = async (purchaseId) => {
    if (!canManagePurchases) return;
    try {
      manualStatusRef.current = false; setStatus({ type: 'info', message: '' }); setPayDialog(null);
      const purchase = await api.getPurchase(purchaseId);
      const purchaseItems = purchase?.PurchaseItems || [];
      const entryType = purchase.entryType || purchase.type || 'purchase';
      const party = normalizeLookupParty({ id: purchase.partyId || purchase.supplierId || purchase.Party?.id || purchase.Supplier?.id, partyName: purchase.partyName || purchase.supplierName || purchase.Party?.name || purchase.Supplier?.name, phone: purchase.partyPhone || purchase.Party?.phone || purchase.Supplier?.phone, currentAmount: purchase.Party?.currentAmount ?? purchase.Supplier?.currentAmount ?? null, type: 'supplier' });
      cacheProducts(purchaseItems.map(normalizeLookupProduct).filter((p) => p.id));
      setHeader({ entryType, partyId: purchase.partyId || purchase.supplierId || '', partyName: purchase.partyName || purchase.supplierName || '', invoiceNo: purchase.invoiceNo || '', purchaseDate: purchase.purchaseDate || '', status: purchase.status || 'received', notes: purchase.notes || '', amountReceived: String(purchase.amountReceived ?? 0), ...normalizePaymentFields(purchase) });
      setSelectedSupplier(party.id ? party : null);
      setItems(purchaseItems.map((item) => ({ id: item.id, productId: item.productId || '', quantity: String(item.quantity ?? '1'), unitType: item.unitType || 'primary', unitPrice: String(item.unitPrice ?? '0'), taxRate: String(item.taxRate ?? '0'), lineTotal: String(item.lineTotal ?? '0'), itemType: item.itemType || (entryType === 'expense' ? 'expense' : 'part'), description: item.description || '' })));
      setDeletedItemIds([]); setEditingId(purchaseId); setFormMode('edit'); setSuggestedInvoiceNo(purchase.invoiceNo || '');
      setIsPaid(getPurchaseDueAmount(purchase) <= 0 && String(purchase.status || '').toLowerCase() !== 'ordered');
      setMobileStep('details'); setShowItemDialog(false); setEditingItemIdx(null); setItemDraft(getEmptyItem(entryType)); setItemStatus({ type: 'info', message: '' }); setIsOpen(true);
    } catch (err) { setStatus({ type: 'error', message: err.message }); }
  };

  const currentStepIndex = purchaseSteps.findIndex((s) => s.id === mobileStep);
  const showDetailsStep = !isMobile || mobileStep === 'details';
  const showItemsStep = !isMobile || mobileStep === 'items';
  const showPaymentStep = !isMobile || mobileStep === 'payment';

  const goToNextMobileStep = () => {
    if (!isMobile) return;
    if (mobileStep === 'details' && !header.purchaseDate) { setStatus({ type: 'error', message: t('errors.purchaseDateRequired') }); return; }
    if (mobileStep === 'items' && items.length === 0) { setStatus({ type: 'error', message: isExpense ? t('errors.expenseLineRequired') : t('purchases.addFirstItem') }); return; }
    const next = purchaseSteps[currentStepIndex + 1]; if (next) setMobileStep(next.id);
  };
  const goToPrevMobileStep = () => { if (!isMobile) return; const prev = purchaseSteps[currentStepIndex - 1]; if (prev) setMobileStep(prev.id); };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManagePurchases) { setStatus({ type: 'error', message: t('staffManagement.permissionError') }); return; }
    if (savingPurchase) return;
    if (!businessId) { setStatus({ type: 'error', message: t('errors.businessIdRequired') }); return; }
    if (!header.purchaseDate) { setStatus({ type: 'error', message: t('errors.purchaseDateRequired') }); return; }
    if (header.entryType === 'expense') {
      if (!(header.partyId || header.partyName?.trim())) { setStatus({ type: 'error', message: t('errors.payeeRequired') }); return; }
      if (!items.find((i) => Number(i.lineTotal || 0) > 0)) { setStatus({ type: 'error', message: t('errors.expenseLineRequired') }); return; }
      if (items.find((i) => i.itemType === 'part' && !i.productId)) { setStatus({ type: 'error', message: t('errors.selectProductPart') }); return; }
    } else {
      if (!items.length) { setStatus({ type: 'error', message: t('purchases.addFirstItem') }); return; }
      if (items.find((i) => !i.productId)) { setStatus({ type: 'error', message: t('errors.selectProductPurchase') }); return; }
    }
    if (items.find((i) => i.productId && i.unitType === 'secondary' && Number(getProductById(i.productId)?.conversionRate || 0) <= 0)) {
      setStatus({ type: 'error', message: t('errors.conversionRequired') }); return;
    }
    if (requiresBankSelection(header, paidAmount)) { setStatus({ type: 'error', message: t('payments.bankRequired') }); return; }
    try {
      setSavingPurchase(true);
      const manualInvoiceNo = String(header.invoiceNo || '').trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const payload = { ...headerFields, partyId: header.partyId || null, partyName: header.entryType === 'expense' ? header.partyName || null : null, amountReceived: paidAmount, ...(Number(paidAmount || 0) > 0 ? buildPaymentPayload({ paymentMethod, bankId, paymentNote }) : { paymentMethod: 'cash' }), ...totals, items: [...items.map((item) => ({ ...item, quantity: Number(item.quantity), unitType: item.unitType || 'primary', conversionRate: Number(getProductById(item.productId)?.conversionRate || 0), unitPrice: Number(item.unitPrice), taxRate: Number(item.taxRate), lineTotal: Number(item.lineTotal), itemType: item.itemType || (header.entryType === 'expense' ? 'expense' : 'part'), description: item.description || '' })), ...deletedItemIds.map((id) => ({ id, _delete: true }))] };
      if (manualInvoiceNo) payload.invoiceNo = manualInvoiceNo; else delete payload.invoiceNo;
      if (formMode === 'edit' && editingId) { await api.updatePurchase(editingId, payload); setStatus({ type: 'success', message: t('purchases.messages.updated') }); }
      else { await api.createPurchase(payload); setStatus({ type: 'success', message: t('purchases.messages.created') }); }
      resetForm(); setIsOpen(false); useProductStore.getState().invalidate(); invalidatePurchases(); fetchPurchases(listParams, true);
    } catch (err) { setStatus({ type: 'error', message: err.message }); }
    finally { setSavingPurchase(false); }
  };





  const closeDeleteDialog = () => { if (deletePurchase && deletingPurchaseId === deletePurchase.id) return; setDeletePurchase(null); };
  const handleDeletePurchase = async () => {
    if (!canManagePurchases || !deletePurchase || deletingPurchaseId === deletePurchase.id) return;
    setDeletingPurchaseId(deletePurchase.id); setStatus({ type: 'info', message: '' });
    try {
      await api.deletePurchase(deletePurchase.id); useProductStore.getState().invalidate(); invalidatePurchases();
      setStatus({ type: 'success', message: t('purchases.messages.deleted') });
      if (pagedPurchases.length === 1 && page > 1) setPage((c) => Math.max(1, c - 1));
      await fetchPurchases(listParams, true);
    } catch (err) { setStatus({ type: 'error', message: err.message || t('purchases.messages.deleteFailed') }); }
    finally { setDeletingPurchaseId(''); setDeletePurchase(null); }
  };

  const openPayDialog = (purchase) => { if (!canManagePurchases) return; setPayDialog(purchase); setPayAmount(''); setPayPaymentMethod('cash'); setPayBankId(''); setPayNotes(''); setPayError(''); };
  const closePayDialog = () => { setPayDialog(null); setPayError(''); };
  const closeQuickExpense = () => setQuickExpenseOpen(false);
  const handleQuickExpenseSaved = async () => {
    invalidatePurchases(listParams);
    await fetchPurchases(listParams, true);
  };

  const handleRecordPayment = async (event) => {
    event.preventDefault();
    if (!canManagePurchases) { setPayError(t('staffManagement.permissionError')); return; }
    if (!payDialog || recordingPaymentId === payDialog.id) return;
    const amount = Number(payAmount || 0);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount.'); return; }
    if (requiresBankSelection({ paymentMethod: payPaymentMethod, bankId: payBankId }, amount)) { setPayError(t('payments.bankRequired')); return; }
    const currentDue = getPurchaseDueAmount(payDialog);
    if (amount > currentDue) { setPayError(`Amount cannot exceed due of ${money(currentDue)}.`); return; }
    try {
      setRecordingPaymentId(payDialog.id);
      const nextReceived = Number(payDialog.amountReceived || 0) + amount;
      const nextDue = Math.max(currentDue - amount, 0);
      const cs = String(payDialog.status || '').toLowerCase();
      await api.updatePurchase(payDialog.id, { amountReceived: nextReceived, status: cs === 'ordered' ? 'ordered' : nextDue > 0 ? 'due' : 'received', ...buildPaymentPayload({ paymentMethod: payPaymentMethod, bankId: payBankId, paymentNote: payNotes }) });
      closePayDialog(); await fetchPurchases(listParams, true);
    } catch (err) { setPayError(err.message); }
    finally { setRecordingPaymentId(''); }
  };

  const itemDraftProduct = getProductById(itemDraft.productId);
  const itemDraftVatAmount = getVatAmount(itemDraft.lineTotal, itemDraft.taxRate);
  const canSaveDraftItem = (() => {
    if (Number(itemDraft.lineTotal || 0) <= 0) return false;
    if (header.entryType === 'expense') {
      if (itemDraft.itemType === 'part' && !itemDraft.productId) return false;
      if (itemDraft.itemType === 'part' && itemDraft.unitType === 'secondary' && Number(itemDraftProduct?.conversionRate || 0) <= 0) return false;
      return true;
    }
    if (!itemDraft.productId) return false;
    if (itemDraft.unitType === 'secondary' && Number(itemDraftProduct?.conversionRate || 0) <= 0) return false;
    return true;
  })();

  const getTransactionMeta = (et) => (et === 'expense'
    ? { label: t('purchases.expense'), icon: Wallet, badgeClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', panelClassName: 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/30', iconWrapClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
    : { label: t('purchases.purchase'), icon: Package, badgeClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', panelClassName: 'border-amber-200/70 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/30', iconWrapClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
  );

  const getLineMeta = (item, et = header.entryType) => {
    if (et !== 'expense') return { label: t('purchases.purchaseLine'), icon: Package, badgeClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', iconWrapClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
    if (item.itemType === 'labor') return { label: t('purchases.labor'), icon: Wrench, badgeClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', iconWrapClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' };
    if (item.itemType === 'part') return { label: t('purchases.part'), icon: Package, badgeClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', iconWrapClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };
    return { label: t('purchases.expenseLine'), icon: Wallet, badgeClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', iconWrapClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
  };

  const transactionMeta = getTransactionMeta(header.entryType);
  const TransactionIcon = transactionMeta.icon;
  const draftLineMeta = getLineMeta(itemDraft);
  const DraftLineIcon = draftLineMeta.icon;

  const statusFilterOptions = [{ value: 'all', label: t('purchases.allStatuses') }, { value: 'received', label: t('purchases.received') }, { value: 'ordered', label: t('purchases.ordered') }, { value: 'due', label: t('purchases.due') }];
  const entryTypeFilterOptions = [{ value: 'all', label: t('purchases.allEntries') }, { value: 'purchase', label: t('purchases.purchaseEntries') }, { value: 'expense', label: t('purchases.expenseEntries') }];

  // all categories including "Add New" sentinel


  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* PAGE HEADER */}
      <PageHeader
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
        action={
          canManagePurchases ? (
            <div className="flex flex-col gap-2 sm:flex-row">

              <button
                className="btn-secondary w-full sm:w-auto"
                type="button"
                onClick={() => setQuickExpenseOpen(true)}
                disabled={openingPurchaseForm}
              >
                <Wallet
                  size={15}
                  className="mr-1.5 inline"
                />
                {t('purchases.quickExpense')}
              </button>

              <button
                className="btn-primary w-full sm:w-auto"
                type="button"
                onClick={openCreate}
                disabled={openingPurchaseForm}
              >
                {openingPurchaseForm
                  ? t('common.loading')
                  : t('purchases.newPurchase')}
              </button>

            </div>
          ) : null
        }
      />

      <Dialog
        isOpen={quickExpenseOpen}
        onClose={closeQuickExpense}
        title={t('purchases.quickExpense')}
        size="lg"
      >
        <QuickExpense
          listParams={listParams}
          onClose={closeQuickExpense}
          onSaved={handleQuickExpenseSaved}
        />
      </Dialog>



      {/* ══════════════════════════════════════════
          FULL PURCHASE / EXPENSE DIALOG
      ══════════════════════════════════════════ */}
      <Dialog isOpen={isOpen} onClose={closeDialog} title={formMode === 'edit' ? t('purchases.editPurchase') : t('purchases.newPurchase')} size="full">
        <div className="md:hidden">
          <MobileFormStepper steps={purchaseSteps} currentStep={mobileStep} onStepChange={setMobileStep} onNext={goToNextMobileStep} onBack={goToPrevMobileStep} showNavigation={false} />
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {['purchase', 'expense'].map((et) => {
                const om = getTransactionMeta(et); const OI = om.icon; const isActive = header.entryType === et;
                return (
                  <button key={et} type="button" aria-pressed={isActive}
                    className={`rounded-[22px] border px-4 py-4 text-left transition ${isActive ? om.panelClassName : 'border-slate-200/80 bg-white/90 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-950/40 dark:hover:border-slate-600 dark:hover:bg-slate-900/40'}`}
                    onClick={() => handleEntryTypeChange(et)}>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${om.iconWrapClassName}`}><OI size={18} /></div>
                      <div><p className="font-semibold text-slate-900 dark:text-white">{om.label}</p><p className="text-xs text-slate-500 dark:text-slate-400">{t('purchases.items')}</p></div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {showDetailsStep && (
            <>
              <FormSectionCard title={t('common.details')} hint={t('purchases.supplierOptional')} className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40">
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <div className="flex items-center justify-between"><label className="label">{t('purchases.supplier')}</label><span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('common.optional')}</span></div>
                    <div className="mt-1"><PartySearchCreateField type="supplier" selectedParty={selectedSupplier} onSelect={handleSupplierSelect} placeholder={t('purchases.selectSupplier')} searchPlaceholder={t('purchases.selectSupplier')} entityLabel={t('purchases.supplier')} /></div>
                  </div>
                  {isExpense && <div><label className="label">{t('purchases.payeeName')}</label><input className="input mt-1" name="partyName" value={header.partyName} onChange={handleHeaderChange} placeholder={t('purchases.payeeHint')} /></div>}
                  <div><label className="label">{t('purchases.invoiceNo')}</label><input className="input mt-1" name="invoiceNo" value={header.invoiceNo} onChange={handleHeaderChange} placeholder={formMode === 'create' ? suggestedInvoiceNo : ''} /></div>
                  <div><label className="label">{t('purchases.purchaseDate')}</label><input type="date" className="input mt-1" name="purchaseDate" value={header.purchaseDate} onChange={handleHeaderChange} /></div>
                  <div><label className="label">{t('purchases.status')}</label><select className="input mt-1" name="status" value={header.status} onChange={handleHeaderChange}><option value="received">{t('purchases.received')}</option><option value="ordered">{t('purchases.ordered')}</option><option value="due">{t('purchases.due')}</option></select></div>
                </div>
              </FormSectionCard>
              <FormSectionCard title={t('purchases.notes')} className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40">
                <NoteTextarea className="input h-28 resize-none" name="notes" value={header.notes} onChange={handleHeaderChange} />
              </FormSectionCard>
            </>
          )}

          {showItemsStep && (
            <FormSectionCard
              title={t('purchases.items')} hint={t('purchases.itemComposerHint')}
              action={<div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-sm font-semibold text-slate-500">{items.length} {t('purchases.items')}</span><button className="btn-ghost w-full sm:w-auto" type="button" onClick={openItemDialogForCreate}><Plus size={15} className="mr-1.5 inline" />{isExpense ? t('purchases.addExpenseLine') : t('common.addItem')}</button></div>}
              className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40"
            >
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const product = getProductById(item.productId); const ivat = getVatAmount(item.lineTotal, item.taxRate);
                    const lm = getLineMeta(item); const LI = lm.icon; const ul = getUnitLabel(product, item.unitType);
                    const dn = header.entryType === 'expense' ? (item.itemType === 'part' ? product?.name || item.description || t('purchases.part') : item.description || lm.label) : product?.name || item.description || `${t('purchases.product')} ${idx + 1}`;
                    return (
                      <div key={item.id || `pi-${idx}`} className="rounded-[24px] border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-slate-800/60 dark:bg-slate-900/40">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3">
                              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${lm.iconWrapClassName}`}><LI size={18} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${lm.badgeClassName}`}>{lm.label}</span><p className="truncate font-semibold text-slate-900 dark:text-white">{dn}</p></div>
                                {item.description && product?.name && item.description !== product.name && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.description}</p>}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">{t('purchases.qty')}: {item.quantity}{ul ? ` ${ul}` : ''}</span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">{t('purchases.unitPrice')}: {money(item.unitPrice)}</span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">{t('purchases.tax')}: {Number(item.taxRate || 0).toFixed(2)}%</span>
                                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:text-slate-300 dark:ring-slate-700/70">{t('purchases.taxTotal')}: {money(ivat)}</span>
                                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white dark:bg-primary-900/70">{t('common.total')}: {money(Number(item.lineTotal || 0) + ivat)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 xl:pl-4">
                            <button type="button" className="btn-ghost flex-1 text-sm xl:flex-none" onClick={() => openItemDialogForEdit(idx)}><Pencil size={14} className="mr-1.5 inline" />{t('common.edit')}</button>
                            <button type="button" className="btn-ghost flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 xl:flex-none dark:border-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/20" onClick={() => removeItem(idx)}><X size={14} className="mr-1.5 inline" />{t('common.remove')}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/30">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('purchases.addFirstItem')}</p>
                  <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={openItemDialogForCreate}><Plus size={15} className="mr-1.5 inline" />{isExpense ? t('purchases.addExpenseLine') : t('common.addItem')}</button>
                </div>
              )}
            </FormSectionCard>
          )}

          <Dialog isOpen={showItemDialog} onClose={closeItemDialog} title={editingItemIdx !== null ? t('common.edit') : (isExpense ? t('purchases.addExpenseLine') : t('common.addItem'))} size="xl"
            footer={<><button type="button" className="btn-secondary w-full sm:w-auto" onClick={closeItemDialog}>{t('common.cancel')}</button><button type="button" className="btn-primary w-full sm:w-auto" onClick={confirmItem} disabled={!canSaveDraftItem}>{editingItemIdx !== null ? t('common.update') : t('common.add')}</button></>}>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700 dark:text-primary-200">{t('purchases.itemComposerTitle')}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('purchases.itemComposerHint')}</p></div>
                {itemStatus.message && <Notice title={itemStatus.message} tone={itemStatus.type} />}
                <div className="grid gap-4 sm:grid-cols-2">
                  {isExpense ? (
                    <div><label className="label">{t('purchases.lineType')}</label><select className="input mt-1" value={itemDraft.itemType} onChange={(e) => handleDraftChange('itemType', e.target.value)}><option value="expense">{t('purchases.normalExpense')}</option><option value="labor">{t('purchases.labor')}</option><option value="part">{t('purchases.part')}</option></select></div>
                  ) : (
                    <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-900/30"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('purchases.lineType')}</p><p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{t('purchases.purchaseLine')}</p></div>
                  )}
                  <div><label className="label">{t('purchases.expenseDescription')}</label><input className="input mt-1" value={itemDraft.description} onChange={(e) => handleDraftChange('description', e.target.value)} placeholder={t('purchases.expenseDescription')} /></div>
                  {(!isExpense || itemDraft.itemType === 'part') && <div className="sm:col-span-2"><label className="label">{t('purchases.product')}</label><AsyncSearchableSelect className="mt-1" value={itemDraft.productId} selectedOption={itemDraftProduct ? toProductLookupOption(itemDraftProduct) : null} onChange={handleDraftProductSelection} loadOptions={loadProductOptions} placeholder={t('purchases.selectProduct')} searchPlaceholder={t('purchases.selectProduct')} noResultsLabel={t('common.noData')} loadingLabel={t('common.loading')} /></div>}
                  {itemDraft.itemType === 'part' && <div><label className="label">{t('purchases.qty')}</label><input ref={quantityInputRef} className="input mt-1" type="number" inputMode="decimal" min="0" step="0.01" value={itemDraft.quantity} onChange={(e) => handleDraftChange('quantity', e.target.value)} />{itemDraftProduct && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{getUnitLabel(itemDraftProduct, itemDraft.unitType)}</p>}</div>}
                  {itemDraft.itemType === 'part' && <div><label className="label">{t('products.unitType')}</label><select className="input mt-1" value={itemDraft.unitType} onChange={(e) => handleDraftChange('unitType', e.target.value)}><option value="primary">{t('products.primaryUnit')}</option><option value="secondary">{t('products.secondaryUnit')}</option></select></div>}
                  <div><label className="label">{t('purchases.unitPrice')}</label><input className="input mt-1" type="number" inputMode="decimal" step="0.01" min="0" value={itemDraft.unitPrice} onChange={(e) => handleDraftChange('unitPrice', e.target.value)} /></div>
                  <div><label className="label">{t('purchases.tax')}</label><input className="input mt-1" type="number" inputMode="decimal" step="0.01" min="0" value={itemDraft.taxRate} onChange={(e) => handleDraftChange('taxRate', e.target.value)} /></div>
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/40">
                <div className="flex items-center gap-3"><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${draftLineMeta.iconWrapClassName}`}><DraftLineIcon size={18} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('purchases.transactionType')}</p><p className="font-semibold text-slate-900 dark:text-white">{draftLineMeta.label}</p></div></div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-[20px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-950/50 dark:ring-slate-700/70"><p className="truncate font-semibold text-slate-900 dark:text-white">{itemDraftProduct?.name || itemDraft.description || draftLineMeta.label}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('purchases.qty')}: {Number(itemDraft.quantity || 0).toFixed(2)}</p></div>
                  <div className="space-y-2 rounded-[20px] bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-950/50 dark:ring-slate-700/70">
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">{t('purchases.unitPrice')}</span><span className="font-semibold text-slate-900 dark:text-white">{money(itemDraft.unitPrice)}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-slate-500 dark:text-slate-400">{t('purchases.taxTotal')}</span><span className="font-semibold text-slate-900 dark:text-white">{money(itemDraftVatAmount)}</span></div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-700"><span className="font-medium text-slate-600 dark:text-slate-300">{t('common.total')}</span><span className="text-lg font-bold text-slate-900 dark:text-white">{money(Number(itemDraft.lineTotal || 0) + itemDraftVatAmount)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>

          {showPaymentStep && (
            <FormSectionCard title={t('payments.summaryTitle')} className="rounded-[28px] border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40">
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                {isExpense ? (
                  <>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.normalExpense')}</span><p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{money(expenseTotals.expense)}</p></div>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.labor')}</span><p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{money(expenseTotals.labor)}</p></div>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.part')}</span><p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{money(expenseTotals.part)}</p></div>
                  </>
                ) : (
                  <>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.subTotal')}</span><p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{money(totals.subTotal)}</p></div>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.taxTotal')}</span><p className="mt-2 font-semibold text-slate-800 dark:text-slate-200">{money(totals.taxTotal)}</p></div>
                    <div className="rounded-[22px] bg-slate-50/90 p-4 dark:bg-slate-900/40"><span className="text-slate-500">{t('purchases.grandTotal')}</span><p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{money(totals.grandTotal)}</p></div>
                  </>
                )}
              </div>
              {isExpense && <div className="mt-3 flex justify-between border-t border-slate-200/70 pt-3 text-sm dark:border-slate-700/60"><span className="font-medium text-slate-500">{t('purchases.grandTotal')}</span><span className="text-lg font-bold text-slate-900 dark:text-slate-100">{money(totals.grandTotal)}</span></div>}
              <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="label">{t('purchases.totalPaid')}</label>
                    <input className="input mt-1" type="number" inputMode="decimal" step="0.01" min="0" value={isPaid ? totals.grandTotal.toFixed(2) : header.amountReceived} disabled={isPaid} onChange={(e) => setHeader((p) => ({ ...p, amountReceived: e.target.value }))} />
                    <QuickPaymentButtons disabled={totals.grandTotal <= 0} onNoPayment={() => applyQuickPaidAmount(0)} onHalfPayment={() => applyQuickPaidAmount(totals.grandTotal / 2)} onFullPayment={() => applyQuickPaidAmount(totals.grandTotal, { markPaid: true })} />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200/70 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700/60 dark:text-slate-300 dark:hover:bg-slate-800/40">
                    <input type="checkbox" className="h-4 w-4 rounded accent-primary-600" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
                    {t('services.fullyPaid')}
                  </label>
                </div>
                {dueAmount > 0 && <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/70 bg-rose-50/60 px-3 py-2.5 text-sm dark:border-rose-800/40 dark:bg-rose-900/20"><span className="text-rose-500 dark:text-rose-400">{t('services.dueAmount')}:</span><span className="font-bold text-rose-700 dark:text-rose-300">{money(dueAmount)}</span></div>}
                <div className="mt-4 border-t border-slate-200/70 pt-4 dark:border-slate-700/60"><PaymentMethodFields value={header} onChange={(patch) => setHeader((p) => ({ ...p, ...patch }))} /></div>
              </div>
            </FormSectionCard>
          )}

          {status.message && <Notice title={status.message} tone={status.type} />}

          <div className={`${isMobile ? 'mobile-sticky-actions' : ''} flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`}>
            {isMobile && mobileStep !== 'details' ? (
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={goToPrevMobileStep}>{t('common.back')}</button>
            ) : (
              <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>{t('common.cancel')}</button>
            )}
            {isMobile && mobileStep !== 'payment' ? (
              <button className="btn-primary w-full sm:w-auto" type="button" onClick={goToNextMobileStep}>{t('common.continue')}</button>
            ) : (
              <button className="btn-primary w-full sm:w-auto" type="submit" disabled={savingPurchase}>
                {savingPurchase ? t('common.saving') : formMode === 'edit' ? t('purchases.updatePurchase') : t('purchases.savePurchase')}
              </button>
            )}
          </div>
        </form>
      </Dialog>

      {/* ══════════════════════════════════════════
          RECORD PAYMENT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog isOpen={Boolean(payDialog)} onClose={closePayDialog} title={t('RecordPayment')} size="sm">
        {payDialog && (
          <form className="space-y-4" onSubmit={handleRecordPayment}>
            {payError && <Notice title={payError} tone="error" />}
            <div className="rounded-[22px] bg-slate-50 p-4 text-sm dark:bg-slate-900/60">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{payDialog.invoiceNo || payDialog.id.slice(0, 8)}</p>
              {getSupplierName(payDialog) && <p className="text-slate-500 dark:text-slate-400">{getSupplierName(payDialog)}</p>}
              <div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className="text-slate-500 dark:text-slate-400">{t('common.total')}: {money(payDialog.grandTotal)}</span><span className="font-semibold text-rose-600 dark:text-rose-400">{t('purchases.dueLabel')}: {money(getPurchaseDueAmount(payDialog))}</span></div>
            </div>
            <div><label className="label">{t('Amount')}</label><input className="input mt-1" type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" autoFocus /></div>
            <PaymentMethodFields value={{ paymentMethod: payPaymentMethod, bankId: payBankId, paymentNote: payNotes }} onChange={(patch) => { setPayPaymentMethod(patch.paymentMethod); setPayBankId(patch.bankId); setPayNotes(patch.paymentNote); }} noteLabel={t('payments.paymentNote')} />
            <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
              <button type="button" className="btn-ghost flex-1" onClick={closePayDialog} disabled={recordingPaymentId === payDialog.id}>{t('common.cancel')}</button>
              <button type="submit" className="btn-primary flex-1" disabled={recordingPaymentId === payDialog.id}>{recordingPaymentId === payDialog.id ? t('common.loading') : t('Record Payment')}</button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ══════════════════════════════════════════
          PURCHASES LIST
      ══════════════════════════════════════════ */}
      <div className="card">
        <div className="grid gap-3 sm:grid-cols-2 xl:max-w-3xl xl:grid-cols-[1fr_1fr_auto] xl:items-end">
          <div><label className="label">{t('inventory.itemType')}</label><select className="input mt-1" value={entryTypeFilter} onChange={(e) => setEntryTypeFilter(e.target.value)}>{entryTypeFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className="label">{t('common.status')}</label><select className="input mt-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{statusFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <RefreshButton className="min-h-[44px] xl:self-end" refreshing={refreshingPurchases} onClick={refreshPurchases} />
        </div>

        {/* Mobile */}
        <div className="mt-4 space-y-3 md:hidden">
          {purchasesLoading && filteredPurchases.length === 0 ? <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
            : pagedPurchases.length === 0 ? <p className="py-3 text-sm text-slate-500">{t('purchases.noPurchases')}</p>
              : pagedPurchases.map((purchase) => {
                const sn = getSupplierName(purchase); const due = getPurchaseDueAmount(purchase);
                const pm = getTransactionMeta(getPurchaseEntryType(purchase)); const PI = pm.icon;
                return (
                  <div key={purchase.id} className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${pm.badgeClassName}`}><PI size={12} />{pm.label}</span><StatusBadge status={purchase.status} /></div>
                        <p className="mt-2 truncate font-semibold text-slate-800 dark:text-slate-100">{purchase.invoiceNo || purchase.id.slice(0, 8)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDate(purchase.purchaseDate)}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{sn || '—'}</p>
                        <PaymentTypeSummary source={purchase} className="mt-2" labelClassName="text-xs font-medium" metaClassName="text-[11px]" />
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{money(purchase.grandTotal)}</p>
                        {due > 0 ? <button type="button" className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60" onClick={() => openPayDialog(purchase)}>{money(due)} {t('common.due')}</button>
                          : <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('common.paid')}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-end border-t border-slate-200/50 pt-2.5 dark:border-slate-700/40">
                      <ActionMenu actions={[...(canManagePurchases ? [{ label: t('common.edit'), icon: Pencil, onClick: () => openEdit(purchase.id) }] : []), { label: 'View Bill', icon: FileText, to: `/app/invoice/purchases/${purchase.id}` }, { label: 'Print Bill', icon: Printer, to: `/app/invoice/purchases/${purchase.id}?print=1` }, ...(canManagePurchases ? [{ label: t('common.delete'), icon: Trash2, tone: 'danger', disabled: deletingPurchaseId === purchase.id, onClick: () => setDeletePurchase(purchase) }] : [])]} />
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Desktop */}
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-4 text-left">{t('common.invoice')}</th>
                <th className="py-2 pr-4 text-left">{t('purchases.transactionType')}</th>
                <th className="py-2 pr-4 text-left">{t('common.date')}</th>
                <th className="py-2 pr-4 text-left">{t('common.status')}</th>
                <th className="py-2 pr-4 text-left">{t('purchases.supplier')}</th>
                <th className="py-2 pr-4 text-left">{t('common.payment')}</th>
                <th className="py-2 pr-4 text-right">{t('common.total')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.totalPaid')}</th>
                <th className="py-2 pr-4 text-right">{t('purchases.dueLabel')}</th>
                <th className="py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {purchasesLoading && filteredPurchases.length === 0 ? <tr><td colSpan={10} className="py-3 text-slate-500">{t('common.loading')}</td></tr>
                : pagedPurchases.length === 0 ? <tr><td colSpan={10} className="py-3 text-slate-500">{t('purchases.noPurchases')}</td></tr>
                  : pagedPurchases.map((purchase) => {
                    const sn = getSupplierName(purchase); const due = getPurchaseDueAmount(purchase);
                    const pm = getTransactionMeta(getPurchaseEntryType(purchase)); const PI = pm.icon;
                    return (
                      <tr key={purchase.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                        <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">{purchase.invoiceNo || purchase.id.slice(0, 8)}</td>
                        <td className="py-2.5 pr-4"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${pm.badgeClassName}`}><PI size={12} />{pm.label}</span></td>
                        <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{formatDate(purchase.purchaseDate)}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={purchase.status} /></td>
                        <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{sn || <span className="text-slate-400">—</span>}</td>
                        <td className="py-2.5 pr-4"><PaymentTypeSummary source={purchase} /></td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-slate-800 dark:text-slate-200">{money(purchase.grandTotal)}</td>
                        <td className="py-2.5 pr-4 text-right text-emerald-700 dark:text-emerald-400">{money(purchase.amountReceived)}</td>
                        <td className="py-2.5 pr-4 text-right">
                          {due > 0 ? <button type="button" className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60" onClick={() => openPayDialog(purchase)}>{money(due)} {t('common.due')}</button>
                            : <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{t('common.paid')}</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          <ActionMenu actions={[...(canManagePurchases ? [{ label: t('common.edit'), icon: Pencil, onClick: () => openEdit(purchase.id) }] : []), { label: 'View Bill', icon: FileText, to: `/app/invoice/purchases/${purchase.id}` }, { label: 'Print Bill', icon: Printer, to: `/app/invoice/purchases/${purchase.id}?print=1` }, ...(canManagePurchases ? [{ label: t('common.delete'), icon: Trash2, tone: 'danger', disabled: deletingPurchaseId === purchase.id, onClick: () => setDeletePurchase(purchase) }] : [])]} />
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={pageSize} total={purchaseTotalKnown ? totalPurchases : null} hasNext={pagedPurchases.length >= pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} pageSizeOptions={TABLE_ROW_OPTIONS} />
      </div>

      <ConfirmDialog
        isOpen={Boolean(deletePurchase)} onClose={closeDeleteDialog} onConfirm={handleDeletePurchase}
        description={deletePurchase ? t('purchases.deleteConfirm', { name: deletePurchase.invoiceNo || deletePurchase.id.slice(0, 8) }) : t('common.confirmDelete')}
        confirming={Boolean(deletePurchase) && deletingPurchaseId === deletePurchase.id}
      />
    </div>
  );
}
