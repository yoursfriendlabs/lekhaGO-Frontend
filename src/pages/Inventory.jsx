import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import FormSectionCard from '../components/FormSectionCard.jsx';
import CategorySearchCreateField from '../components/CategorySearchCreateField.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { getPurityOptionsForMetal, METAL_TYPE_OPTIONS } from '../lib/jewellery.js';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { buildSettingsTabPath, UNITS_SETTINGS_TAB } from '../lib/settingsTabs.js';
import { useShallow } from 'zustand/react/shallow';
import { useProductStore } from '../stores/products';
import { Pencil, Plus, History, AlertTriangle, Clock, TrendingUp, TrendingDown, Trash2, Eye, Layers } from 'lucide-react';
import ImageCropperModal from '../components/ImageCropperModal.jsx';
import StatsCard from '../components/StatsCard.jsx';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';
import ActionMenu from '../components/ActionMenu.jsx';
import FlexibleDateInput from '../components/FlexibleDateInput.jsx';
import DateDisplay from '../components/DateDisplay.jsx';
import ProductDetailDialog from '../components/ProductDetailDialog.jsx';
import { formatDateBoth } from '../lib/nepaliDate.js';

const makeEmptyItem = () => ({

  name: '',
  companyName: '',
  categoryId: '',
  unitId: '',
  itemCode: '',
  itemType: 'goods',
  metalType: '',
  purity: '',
  openingStock: '',
  primaryUnit: '',
  secondaryUnit: '',
  conversionRate: '0',
  salePrice: '0',
  purchasePrice: '0',
  secondarySalePrice: '0',
  mrpPrice: '0',
  wholesalePrice: '0',
  minWholesaleQuantity: '',
  lowStockAlert: true,
  imageUrl: '',
  expiryDate: '',
  batchNumber: '',
});

const parseNumber = (value) => {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const buildProductPayload = (form) => ({
  name: form.name,
  companyName: String(form.companyName || '').trim() || null,
  sku: form.itemCode.trim(),
  itemType: form.itemType,
  metalType: form.metalType,
  purity: form.purity,
  ...(form.categoryId ? { categoryId: form.categoryId } : {}),
  unitId: form.unitId || null,
  primaryUnit: form.primaryUnit,
  secondaryUnit: form.secondaryUnit,
  conversionRate: parseNumber(form.conversionRate),
  salePrice: parseNumber(form.salePrice),
  purchasePrice: parseNumber(form.purchasePrice),
  secondarySalePrice: parseNumber(form.secondarySalePrice),
  mrpPrice: parseNumber(form.mrpPrice),
  wholesalePrice: parseNumber(form.wholesalePrice),
  minWholesaleQuantity: parseNumber(form.minWholesaleQuantity),
  openingStock: parseNumber(form.openingStock),
  lowStockAlert: form.lowStockAlert,
  imageUrl: form.imageUrl || null,
  expiryDate: form.expiryDate || null,
  ...(form.batchNumber ? { batchNumber: String(form.batchNumber).trim() } : {}),
});

function getProductCategoryName(product = {}) {
  if (typeof product.categoryName === 'string' && product.categoryName.trim()) return product.categoryName.trim();
  if (product.category && typeof product.category === 'object' && typeof product.category.name === 'string' && product.category.name.trim()) {
    return product.category.name.trim();
  }
  if (typeof product.category === 'string' && product.category.trim()) return product.category.trim();
  return '';
}

function getProductBrandName(product = {}) {
  if (typeof product.companyName === 'string' && product.companyName.trim()) return product.companyName.trim();
  if (typeof product.brand === 'string' && product.brand.trim()) return product.brand.trim();
  return '';
}

function productToForm(product = {}) {
  return {
    name: product.name || '',
    companyName: getProductBrandName(product),
    categoryId: String(product.categoryId ?? product.category?.id ?? ''),
    unitId: String(product.unitId ?? product.unit?.id ?? ''),
    itemCode: product.sku || '',
    itemType: product.itemType || 'goods',
    metalType: product.metalType || '',
    purity: product.purity || '',
    openingStock: String(product.openingStock ?? product.stockOnHand ?? ''),
    primaryUnit: product.primaryUnit || '',
    secondaryUnit: product.secondaryUnit || '',
    conversionRate: String(product.conversionRate ?? '0'),
    salePrice: String(product.salePrice ?? '0'),
    purchasePrice: String(product.purchasePrice ?? '0'),
    secondarySalePrice: String(product.secondarySalePrice ?? '0'),
    mrpPrice: String(product.mrpPrice ?? '0'),
    wholesalePrice: String(product.wholesalePrice ?? '0'),
    minWholesaleQuantity: String(product.minWholesaleQuantity ?? ''),
    lowStockAlert: Boolean(product.lowStockAlert),
    imageUrl: product.imageUrl || '',
    expiryDate: toDateInputValue(product.expiryDate),
    batchNumber: product.batchNumber || '',
  };
}

function getCurrentStock(product = {}) {
  return Number(product.stockOnHand ?? product.openingStock ?? 0);
}

function getUnitText(unit = {}) {
  if (typeof unit === 'string' || typeof unit === 'number') {
    return cleanUnitLabel(unit);
  }
  if (!unit || typeof unit !== 'object') return '';
  return cleanUnitLabel(unit.name || unit.symbol || unit.displayName || '');
}

function cleanUnitLabel(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(.+?)\s*\([^)]*\)\s*$/);
  return (match ? match[1] : text).trim();
}

function getUnitOptionLabel(unit = {}) {
  const name = String(unit?.name || '').trim();
  const symbol = String(unit?.symbol || '').trim();
  if (name && symbol && name.toLowerCase() !== symbol.toLowerCase()) {
    return `${name} (${symbol})`;
  }
  return name || symbol;
}

function getExpiryDateColorClass(expiryDateStr) {
  if (!expiryDateStr) return '';
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();

  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 10) {
    return 'text-rose-600 dark:text-rose-400 font-semibold';
  } else if (diffDays <= 20) {
    return 'text-amber-600 dark:text-amber-400 font-semibold';
  } else {
    return 'text-emerald-600 dark:text-emerald-400 font-semibold';
  }
}

function getExpiryRemainingDaysText(expiryDateStr, t) {
  if (!expiryDateStr) return '';
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();

  expiryDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return t('inventory.expired') || 'Expired';
  } else if (diffDays === 0) {
    return t('inventory.expiresToday') || 'Expires today';
  } else {
    return t('inventory.daysRemaining', { count: diffDays }) || `${diffDays} days remaining`;
  }
}

function isRestockableProduct(product = {}) {
  return String(product.itemType || '').toLowerCase() !== 'service';
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const getInventoryItemRowId = (itemId) => `inventory-item-row-${itemId}`;
const getInventoryItemCardId = (itemId) => `inventory-item-card-${itemId}`;
const getInventoryItemActionId = (action, itemId) => `inventory-item-${action}-${itemId}`;

function getItemTypeLabel(itemType, itemTypeOptions, t) {
  const match = itemTypeOptions.find((option) => option.value === itemType);
  if (match?.label) return match.label;
  if (itemType === 'service') return t('products.service');
  if (itemType === 'part') return t('products.part');
  return t('products.goods');
}

export default function Inventory() {
  const { t } = useI18n();
  const { canManageFeature, businessId } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const canManageInventory = canManageFeature('inventory');
  // Selecting only what this page renders. Subscribing to the whole store also
  // subscribed to its internal `lists` cache, so every fetch for any query
  // re-rendered the entire page.
  const {
    products,
    total: productsTotal,
    loading: productsLoading,
    error: productsError,
    fetch: fetchProducts,
    invalidate: invalidateProducts,
    patchProduct,
  } = useProductStore(
    useShallow((state) => ({
      products: state.products,
      total: state.total,
      loading: state.loading,
      error: state.error,
      fetch: state.fetch,
      invalidate: state.invalidate,
      patchProduct: state.patchProduct,
    })),
  );
  const inventoryProfile = businessProfile?.inventory || {};
  const itemTypeOptions = Array.isArray(inventoryProfile.itemTypes) && inventoryProfile.itemTypes.length
    ? inventoryProfile.itemTypes
    : [
        { value: 'goods', label: t('products.goods') },
        { value: 'service', label: t('products.service') },
      ];
  const showJewelleryFields = inventoryProfile.showJewelleryFields === true;
  const inventoryTitle = inventoryProfile.title || t('inventory.itemsTitle');
  const inventorySubtitle = inventoryProfile.subtitle || t('inventory.itemsSubtitle');

  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const [toast, setToast] = useState({ type: '', message: '' });
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const listParams = useMemo(() => ({
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sort: sortKey,
    ...(debouncedQuery ? { search: debouncedQuery } : {}),
    ...(typeFilter !== 'all' ? { itemType: typeFilter } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(stockFilter !== 'all' ? { stock: stockFilter } : {}),
  }), [page, pageSize, sortKey, debouncedQuery, typeFilter, categoryFilter, stockFilter]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [form, setForm] = useState(makeEmptyItem());
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState(null);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!businessId) return;
    try {
      setStatsLoading(true);
      // /api/products/stats applies the same in-stock threshold and 20-day
      // expiry window as the `stock=low` and `stock=nearexpiry` list filters,
      // so the cards still match what you see after clicking through. Counting
      // via the list endpoint as well would just ask the same two questions
      // a second time.
      const statsRes = await api.getProductStats();
      setStats({
        lowStockCount: Number(statsRes?.lowStockCount || 0),
        nearExpiryCount: Number(statsRes?.nearExpiryCount || 0),
        popularCount: Number(statsRes?.popularCount || 0),
        leastPopularCount: Number(statsRes?.leastPopularCount || 0),
      });
    } catch (err) {
      console.error('Failed to fetch product stats', err);
      setStats({
        lowStockCount: 0,
        nearExpiryCount: 0,
        popularCount: 0,
        leastPopularCount: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [businessId]);

  // Depending on `products` here refetched the stats on every list load,
  // because the store returns a new array identity each time. The mutation
  // handlers below refresh the stats themselves, which is the only time the
  // numbers can actually change.
  useEffect(() => {
    if (businessId) {
      fetchStats();
    }
  }, [businessId, fetchStats]);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteProduct, setDeleteProduct] = useState(null);
  const [deletingProductId, setDeletingProductId] = useState('');
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockExpiryDate, setRestockExpiryDate] = useState('');
  const [restockBatchNumber, setRestockBatchNumber] = useState('');
  const [restockAction, setRestockAction] = useState('add'); // 'add' | 'remove'
  const [restockSaving, setRestockSaving] = useState(false);
  const [editBatches, setEditBatches] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState('');
  const [detailProductHint, setDetailProductHint] = useState(null);
  const [detailInitialTab, setDetailInitialTab] = useState('overview');
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');

  const closeDeleteDialog = () => {
    if (deleteProduct && deletingProductId === deleteProduct.id) return;
    setDeleteProduct(null);
  };

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;
    if (deletingProductId === deleteProduct.id) return;

    setDeletingProductId(deleteProduct.id);
    setStatus({ type: 'info', message: '' });

    try {
      await api.deleteProduct(deleteProduct.id);
      setStatus({ type: 'success', message: t('inventory.messages.deleted') || 'Product deleted successfully' });
      invalidateProducts(listParams);
      await fetchProducts(listParams, true);
      fetchStats();
    } catch (err) {
      setStatus({ type: 'error', message: err.message || t('inventory.messages.deleteFailed') || 'Failed to delete product' });
    } finally {
      setDeletingProductId('');
      setDeleteProduct(null);
    }
  };

  useEffect(() => {
    fetchProducts(listParams).catch(() => {});
  }, [fetchProducts, listParams]);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);

    try {
      const response = await api.listCategories({
        type: 'product',
        limit: 50,
        offset: 0,
      });

      const nextCategories = (response.items || [])
        .filter((category) => category?.id && category?.name)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      setCategoryOptions(nextCategories);
      setCategoriesError('');
    } catch (error) {
      setCategoryOptions([]);
      setCategoriesError(error.message);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const loadUnits = useCallback(async () => {
    setUnitsLoading(true);

    try {
      const response = await api.listUnits({
        limit: 200,
        offset: 0,
      });

      const nextUnits = (response.items || [])
        .filter((unit) => unit?.id && unit?.name)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

      setUnitOptions(nextUnits);
      setUnitsError('');
    } catch (error) {
      setUnitOptions([]);
      setUnitsError(error.message);
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    if (!itemTypeOptions.some((option) => option.value === form.itemType)) {
      setForm((previous) => ({
        ...previous,
        itemType: itemTypeOptions[0]?.value || 'goods',
      }));
    }
  }, [form.itemType, itemTypeOptions]);

  useEffect(() => {
    if (productsError) setStatus({ type: 'error', message: productsError });
  }, [productsError]);

  useEffect(() => {
    if (!toast.message) return undefined;
    const timeoutId = window.setTimeout(() => setToast({ type: '', message: '' }), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast.message]);

  const items = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      brand: getProductBrandName(product),
      companyName: getProductBrandName(product),
      imageUrl: product.imageUrl || '',
      itemType: product.itemType || 'goods',
      metalType: product.metalType || '',
      purity: product.purity || '',
      category: getProductCategoryName(product) || '-',
      itemCode: product.sku || '-',
      salePrice: Number(product.salePrice ?? 0),
      purchasePrice: Number(product.purchasePrice ?? 0),
      quantity: Number(product.stockOnHand ?? product.openingStock ?? 0),
      unit: cleanUnitLabel(product.primaryUnit || getUnitText(product.unit) || ''),
      batchCount: Number(product.batchCount || product.batches?.length || 0),
      expiryDate: toDateInputValue(product.expiryDate),
    }));
  }, [products]);

  // Stats are now fetched directly from the backend API (stats.lowStockCount, stats.nearExpiryCount, etc.)

  const categories = useMemo(() => {
    const unique = new Set([
      ...categoryOptions.map((category) => category.name).filter(Boolean),
      ...items.map((item) => item.category).filter((value) => value && value !== '-'),
    ]);
    return Array.from(unique).sort();
  }, [categoryOptions, items]);

  const selectedCategory = useMemo(
    () => categoryOptions.find((category) => String(category.id) === String(form.categoryId)),
    [categoryOptions, form.categoryId]
  );
  const unitOptionsById = useMemo(
    () => new Map(unitOptions.map((unit) => [String(unit.id), unit])),
    [unitOptions],
  );
  const purityOptions = useMemo(() => getPurityOptionsForMetal(form.metalType), [form.metalType]);
  const primaryUnitChoices = useMemo(() => {
    const choices = unitOptions.map((unit) => ({
      value: `id:${unit.id}`,
      label: getUnitOptionLabel(unit),
      text: getUnitText(unit),
    }));
    const current = String(form.primaryUnit || '').trim();
    const hasManagedSelection = form.unitId && unitOptionsById.has(String(form.unitId));
    const matchesExisting = current
      ? unitOptions.some((unit) => getUnitText(unit).toLowerCase() === current.toLowerCase())
      : true;

    if (current && !hasManagedSelection && !matchesExisting) {
      choices.unshift({
        value: `legacy:${current}`,
        label: `${current} (${t('unitsManagement.legacyValue')})`,
        text: current,
      });
    }

    return choices;
  }, [form.primaryUnit, form.unitId, t, unitOptions, unitOptionsById]);
  const secondaryUnitChoices = useMemo(() => {
    const choices = unitOptions.map((unit) => ({
      value: `id:${unit.id}`,
      label: getUnitOptionLabel(unit),
      text: getUnitText(unit),
    }));
    const current = String(form.secondaryUnit || '').trim();
    const matchesExisting = current
      ? unitOptions.some((unit) => getUnitText(unit).toLowerCase() === current.toLowerCase())
      : true;

    if (current && !matchesExisting) {
      choices.unshift({
        value: `legacy:${current}`,
        label: `${current} (${t('unitsManagement.legacyValue')})`,
        text: current,
      });
    }

    return choices;
  }, [form.secondaryUnit, t, unitOptions]);
  const primaryUnitSelectValue = useMemo(() => {
    if (form.unitId && unitOptionsById.has(String(form.unitId))) {
      return `id:${form.unitId}`;
    }

    const current = String(form.primaryUnit || '').trim();
    return current ? `legacy:${current}` : '';
  }, [form.primaryUnit, form.unitId, unitOptionsById]);
  const secondaryUnitSelectValue = useMemo(() => {
    const current = String(form.secondaryUnit || '').trim();
    if (!current) return '';

    const match = unitOptions.find((unit) => getUnitText(unit).toLowerCase() === current.toLowerCase());
    return match ? `id:${match.id}` : `legacy:${current}`;
  }, [form.secondaryUnit, unitOptions]);
  const hasPrimaryUnitSelected = Boolean(String(form.primaryUnit || '').trim() || form.unitId);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, categoryFilter, stockFilter, typeFilter, sortKey]);

  // Server already filters/sorts/paginates; items is the current page.
  const totalItems = Number(productsTotal || 0);
  const pagedItems = items;

  useEffect(() => {
    const totalPages = Math.max(Math.ceil(totalItems / pageSize) || 1, 1);
    if (page > totalPages) setPage(totalPages);
  }, [totalItems, pageSize, page]);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      const nextValue = type === 'checkbox' ? checked : value;
      if (name !== 'metalType') {
        return { ...prev, [name]: nextValue };
      }

      const nextPurityOptions = getPurityOptionsForMetal(nextValue);
      return {
        ...prev,
        metalType: nextValue,
        purity: nextPurityOptions.length > 0 && !nextPurityOptions.includes(prev.purity) ? '' : prev.purity,
      };
    });
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', message: 'Only image files are allowed.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'Image size must be less than 10MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropperImageSrc(reader.result);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);

    // Clear input value to allow uploading the same file again
    event.target.value = '';
  };

  const handleCropComplete = async (croppedFile) => {
    setIsCropperOpen(false);
    setImageUploading(true);
    setStatus({ type: 'info', message: '' });
    try {
      const response = await api.uploadAttachment(croppedFile);
      if (response && response.url) {
        setForm((prev) => ({ ...prev, imageUrl: response.url }));
        setStatus({ type: 'success', message: 'Image uploaded successfully.' });
      } else {
        throw new Error('No URL returned from server.');
      }
    } catch (err) {
      console.error('Failed to upload image', err);
      setStatus({ type: 'error', message: err.message || 'Failed to upload image.' });
    } finally {
      setImageUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const handlePrimaryUnitChange = (event) => {
    const { value } = event.target;

    if (!value) {
      setForm((previous) => ({
        ...previous,
        unitId: '',
        primaryUnit: '',
        secondaryUnit: '',
      }));
      return;
    }

    if (value.startsWith('id:')) {
      const unit = unitOptionsById.get(value.slice(3));
      setForm((previous) => ({
        ...previous,
        unitId: unit?.id ? String(unit.id) : '',
        primaryUnit: cleanUnitLabel(unit?.name || unit?.symbol || ''),
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      unitId: '',
      primaryUnit: cleanUnitLabel(value.slice('legacy:'.length)),
    }));
  };

  const handleSecondaryUnitChange = (event) => {
    const { value } = event.target;

    if (!value) {
      setForm((previous) => ({
        ...previous,
        secondaryUnit: '',
      }));
      return;
    }

    if (value.startsWith('id:')) {
      const unit = unitOptionsById.get(value.slice(3));
      setForm((previous) => ({
        ...previous,
        secondaryUnit: getUnitText(unit),
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      secondaryUnit: value.slice('legacy:'.length),
    }));
  };

  const openCreateDialog = () => {
    if (!canManageInventory) return;
    // Generate a unique item code (SKU)
    // We check existing products to find the highest numeric suffix if they follow a pattern like ITEM-001
    // Otherwise, we can use a timestamp or a simple increment.
    const generateItemCode = () => {
      const prefix = 'ITEM-';
      const existingCodes = products
        .map((p) => p.sku || '')
        .filter((sku) => sku.startsWith(prefix));

      if (existingCodes.length === 0) {
        return `${prefix}001`;
      }

      const numbers = existingCodes
        .map((sku) => parseInt(sku.replace(prefix, ''), 10))
        .filter((num) => !isNaN(num));

      if (numbers.length === 0) {
        return `${prefix}${String(existingCodes.length + 1).padStart(3, '0')}`;
      }

      const nextNumber = Math.max(...numbers) + 1;
      return `${prefix}${String(nextNumber).padStart(3, '0')}`;
    };

    setEditingId(null);
    setForm({
      ...makeEmptyItem(),
      itemCode: generateItemCode(),
      itemType: itemTypeOptions[0]?.value || 'goods',
    });
    setActiveTab('stock');
    setIsOpen(true);
  };

  const openEditDialog = async (itemId) => {
    if (!canManageInventory) return;
    const product = products.find((entry) => String(entry.id) === String(itemId));

    if (!product) {
      setStatus({ type: 'error', message: t('common.noData') });
      return;
    }

    setEditingId(product.id);
    setForm(productToForm(product));
    setEditBatches(Array.isArray(product.batches) ? product.batches : []);
    setActiveTab('stock');
    setIsOpen(true);

    try {
      const detail = await api.getProduct(product.id);
      if (detail) {
        setForm(productToForm(detail));
        setEditBatches(Array.isArray(detail.batches) ? detail.batches : []);
        patchProduct(product.id, detail);
      }
    } catch {
      // List data is enough if detail fetch fails.
    }
  };

  const openRestockDialog = (itemId) => {
    if (!canManageInventory) return;
    const product = products.find((entry) => String(entry.id) === String(itemId));
    if (!product) {
      setStatus({ type: 'error', message: t('common.noData') });
      return;
    }

    if (!isRestockableProduct(product)) {
      setStatus({ type: 'error', message: t('inventory.messages.serviceNoRestock') });
      return;
    }

    setRestockProduct(product);
    setRestockQuantity('');
    setRestockExpiryDate('');
    setRestockBatchNumber('');
    setRestockAction('add');
    setIsRestockOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setForm(makeEmptyItem());
    setActiveTab('stock');
    setEditingId(null);
    setEditBatches([]);
  };

  const closeRestockDialog = () => {
    setIsRestockOpen(false);
    setRestockProduct(null);
    setRestockQuantity('');
    setRestockExpiryDate('');
    setRestockBatchNumber('');
    setRestockAction('add');
  };

  const openDetailDialog = (itemId, tab = 'overview') => {
    const product = products.find((entry) => String(entry.id) === String(itemId));
    if (!itemId) {
      setStatus({ type: 'error', message: t('common.noData') });
      return;
    }
    setDetailProductId(String(itemId));
    setDetailProductHint(product || null);
    setDetailInitialTab(tab);
    setIsDetailOpen(true);
  };

  const closeDetailDialog = () => {
    setIsDetailOpen(false);
    setDetailProductId('');
    setDetailProductHint(null);
    setDetailInitialTab('overview');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canManageInventory) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }
    setSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = buildProductPayload(form);
      const optimisticCategory = selectedCategory
        ? {
          id: selectedCategory.id,
          name: selectedCategory.name,
          type: selectedCategory.type || 'product',
        }
        : null;
      const optimisticProduct = {
        id: editingId,
        ...payload,
        categoryId: payload.categoryId || null,
        category: optimisticCategory,
        categoryName: optimisticCategory?.name || '',
      };

      if (editingId) {
        const updatedProduct = await api.updateProduct(editingId, payload);
        patchProduct(editingId, updatedProduct || optimisticProduct);
        fetchStats();
        setStatus({ type: 'success', message: t('inventory.messages.itemUpdated') });
      } else {
        await api.createProduct(payload);
        invalidateProducts(listParams);
        await fetchProducts(listParams, true);
        fetchStats();
        setStatus({ type: 'success', message: t('inventory.messages.itemCreated') });
      }

      closeDialog();
    } catch (err) {
      const categoryMissing = err?.status === 404 && /categor/i.test(err?.message || err?.payload?.message || '');
      if (categoryMissing) {
        await loadCategories();
        setForm((previous) => ({ ...previous, categoryId: '' }));
        setStatus({ type: 'error', message: t('categories.messages.reselect') });
      } else {
        setStatus({ type: 'error', message: err.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRestockSubmit = async (event) => {
    event.preventDefault();
    if (!canManageInventory) {
      setStatus({ type: 'error', message: t('staffManagement.permissionError') });
      return;
    }

    if (!restockProduct) return;

    const quantityValue = parseNumber(restockQuantity);
    if (quantityValue <= 0) {
      setStatus({ type: 'error', message: t('inventory.messages.restockQuantityRequired') });
      return;
    }

    const isRemove = restockAction === 'remove';
    const currentStock = getCurrentStock(restockProduct);
    if (isRemove && quantityValue > currentStock) {
      setStatus({
        type: 'error',
        message: t('inventory.messages.restockExceedsStock', {
          stock: `${formatQuantity(currentStock)}${restockProduct.primaryUnit ? ` ${restockProduct.primaryUnit}` : ''}`,
        }),
      });
      return;
    }

    const quantityChange = isRemove ? -quantityValue : quantityValue;

    setRestockSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      const response = await api.restockProduct(restockProduct.id, {
        quantity: quantityValue,
        action: isRemove ? 'remove' : 'add',
        ...(isRemove || !restockExpiryDate ? {} : { expiryDate: restockExpiryDate }),
        ...(isRemove || !restockBatchNumber.trim()
          ? {}
          : { batchNumber: restockBatchNumber.trim() }),
      });
      const updatedProduct = response?.product || response;
      const fallbackStock = currentStock + quantityChange;

      patchProduct(restockProduct.id, updatedProduct || {
        ...restockProduct,
        stockOnHand: fallbackStock,
      });
      // Stock moved, so the low-stock and near-expiry cards need recounting.
      fetchStats();

      const quantityLabel = `${formatQuantity(quantityValue)}${restockProduct.primaryUnit ? ` ${restockProduct.primaryUnit}` : ''}`;
      closeRestockDialog();
      setToast({
        type: 'success',
        message: response?.message || t(
          isRemove ? 'inventory.messages.itemStockReduced' : 'inventory.messages.itemRestocked',
          {
            name: restockProduct.name,
            quantity: quantityLabel,
          },
        ),
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setRestockSaving(false);
    }
  };

  const handleCategorySelect = useCallback((category) => {
    setForm((previous) => ({
      ...previous,
      categoryId: category?.id ? String(category.id) : '',
    }));
  }, []);

  const handleCategoryCreated = useCallback((category) => {
    if (!category?.id) return;

    setCategoryOptions((previous) => {
      const next = previous.filter((entry) => String(entry.id) !== String(category.id));
      next.push(category);
      next.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return next;
    });

    setForm((previous) => ({ ...previous, categoryId: String(category.id) }));
  }, []);

  const currentRestockStock = restockProduct ? getCurrentStock(restockProduct) : 0;
  const restockQuantityValue = parseNumber(restockQuantity);
  const restockSignedDelta = restockAction === 'remove' ? -restockQuantityValue : restockQuantityValue;
  const nextRestockStock = currentRestockStock + restockSignedDelta;
  const restockUnitSuffix = restockProduct?.primaryUnit ? ` ${restockProduct.primaryUnit}` : '';
  const isRestockRemove = restockAction === 'remove';
  useEffect(() => {
    if (status.type !== 'success' && status.type !== 'error') return;
    const timer = setTimeout(() => setStatus({ type: 'info', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div id="inventory-page" className="space-y-8">
      {toast.message ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-4 right-4 z-[80] md:left-auto md:right-6 md:w-full md:max-w-sm">
          <Notice title={toast.message} tone={toast.type || 'success'} />
        </div>
      ) : null}

      <PageHeader id="inventory-page-header"
        title={inventoryTitle}
        subtitle={inventorySubtitle}
        action={(
          <div className="flex flex-wrap gap-2">
            {/*<button className="btn-secondary w-full sm:w-auto" type="button">*/}
            {/*  <Upload size={16} /> {t('inventory.importItems')}*/}
            {/*</button>*/}
            {canManageInventory ? (
              <button id="inventory-add-new-item" className="btn-primary w-full sm:w-auto" type="button" onClick={openCreateDialog}>
                <Plus size={16} /> {t('inventory.addNewItem')}
              </button>
            ) : null}
          </div>
        )}
      />

      {/* Inventory Stats Cards */}
      <div id="inventory-stats-grid" className="grid gap-2.5 grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <StatsCard
          title={t('inventory.lowStockItems') || 'Low Stock Items'}
          value={stats?.lowStockCount ?? 0}
          icon={AlertTriangle}
          tone="danger"
          loading={statsLoading}
          size="sm"
          onClick={() => {
            setStockFilter('low');
            setPage(1);
          }}
          isActive={stockFilter === 'low'}
        />
        <StatsCard
          title={t('inventory.nearExpiryItems') || 'Near Expiry'}
          value={stats?.nearExpiryCount ?? 0}
          icon={Clock}
          tone="warning"
          loading={statsLoading}
          size="sm"
          onClick={() => {
            setStockFilter('nearexpiry');
            setSortKey('expiryDate');
            setPage(1);
          }}
          isActive={stockFilter === 'nearexpiry'}
        />
        <StatsCard
          title={t('inventory.allItems') || 'All Items'}
          value={stats?.allCount ?? 0}
          icon={Layers}
          tone="info"
          loading={statsLoading}
          size="sm"
          onClick={() => {
            setStockFilter('all');
            setSortKey('');
            setPage(1);
          }}
          isActive={stockFilter === 'all'}
        />
        <StatsCard
          title={t('inventory.leastPopularItems') || 'Least Popular (Unsold)'}
          value={stats?.leastPopularCount ?? 0}
          icon={TrendingDown}
          tone="default"
          loading={statsLoading}
          size="sm"
        />
      </div>

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}

      <div id="inventory-items-card" className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-xl text-ink sm:text-2xl animate-fade-in" key={stockFilter}>
            {stockFilter === 'low'
              ? t('inventory.lowStockItems') || 'Low Stock Items'
              : stockFilter === 'nearexpiry'
                ? t('inventory.nearExpiryItems') || 'Near Expiry'
                : t('inventory.allItems') || 'All items'}{' '}
            ({totalItems})
          </h3>

        </div>

        <div className="mt-4 grid gap-2.5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))] sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-secondary-200 bg-white text-sm text-secondary-700 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2 xl:col-span-1">
            <span className="pl-3 text-secondary-400">🔍</span>
            <input
              id="inventory-search-input"
              className="w-full bg-transparent focus:border-none focus:ring-0 border-none"
              placeholder={t('inventory.searchItems')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            id="inventory-category-filter"
            className="input border-none w-full"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">{t('inventory.allCategories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            id="inventory-stock-filter"
            className="input w-full"
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
          >
            <option value="all">{t('inventory.allStock')}</option>
            <option value="in">{t('inventory.inStock')}</option>
            <option value="low">{t('inventory.lowStock')}</option>
            <option value="out">{t('inventory.outStock')}</option>
            <option value="nearexpiry">{t('inventory.nearExpiryItems') || 'Near Expiry'}</option>
          </select>

          <select
            id="inventory-sort-filter"
            className="input w-full"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
          >
            <option value="name">{t('inventory.sortByName') || 'Sort by Name'}</option>
            <option value="quantity">{t('inventory.sortByQuantity') || 'Sort by Stock'}</option>
            <option value="salePrice">{t('inventory.sortBySalePrice') || 'Sort by Sale Price'}</option>
            <option value="purchasePrice">{t('inventory.sortByPurchasePrice') || 'Sort by Purchase Price'}</option>
            <option value="expiryDate">{t('inventory.sortByExpiryDate') || 'Sort by Expiry Date'}</option>
          </select>
        </div>

        {/* Mobile card view */}
        <div id="inventory-mobile-list" className="mt-4 md:hidden space-y-3">
          {productsLoading && products.length === 0 ? (
            <p className="py-3 text-sm text-secondary-500">{t('common.loading')}</p>
          ) : pagedItems.length === 0 ? (
            <p className="py-3 text-sm text-secondary-500">{t('inventory.noItems')}</p>
          ) : (
            pagedItems.map((item) => (
              <div
                key={item.id}
                id={getInventoryItemCardId(item.id)}
                className="rounded-2xl border border-secondary-200/70 bg-white/80 p-3.5 text-sm dark:border-slate-800/60 dark:bg-slate-900/60"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer items-center gap-3 text-left"
                  onClick={() => openDetailDialog(item.id, 'overview')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDetailDialog(item.id, 'overview');
                    }
                  }}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-11 w-11 shrink-0 rounded-xl object-cover border border-secondary-200 dark:border-slate-800"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPreviewImage(item.imageUrl);
                      }}
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {item.name?.slice(0, 1) || 'I'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink truncate">{item.name}</p>
                    <p className="text-xs text-secondary-500 truncate">
                      {[
                        item.brand,
                        item.category !== '-' ? item.category : null,
                        showJewelleryFields
                          ? (item.metalType && item.purity
                            ? `${item.metalType} ${item.purity}`
                            : item.metalType || item.purity)
                          : null,
                        item.unit || t('inventory.noUnit'),
                        item.batchCount > 1
                          ? `${item.batchCount} ${t('inventory.lots') || 'lots'}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold rounded-full px-2 py-0.5 ${item.quantity <= 0 ? 'bg-rose-100 text-rose-700' : item.quantity <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.quantity.toFixed(2)} {item.unit || ''}
                    </p>
                  </div>
                </div>
                {item.expiryDate && (
                  <div className="mt-2 text-xs text-secondary-500 px-0.5">
                    <span>{t('inventory.expiryDate') || 'Expiry Date'}:</span>
                    <div className={`mt-0.5 text-sm font-extrabold tracking-wide ${getExpiryDateColorClass(item.expiryDate)}`}>
                      <DateDisplay date={item.expiryDate} />
                    </div>
                    <div className="text-xs font-bold mt-0.5">{getExpiryRemainingDaysText(item.expiryDate, t)}</div>
                  </div>
                )}
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-secondary-500 border-t border-secondary-100 pt-2.5 dark:border-slate-800">
                  <span className="min-w-0 truncate">{t('products.salePrice')}: <strong className="text-ink-light dark:text-secondary-300">{t('currency.formatted', { symbol: t('currency.symbol'), amount: item.salePrice.toFixed(2) })}</strong></span>
                  <span className="min-w-0 truncate text-right">{t('products.purchasePrice')}: <strong className="text-ink-light dark:text-secondary-300">{t('currency.formatted', { symbol: t('currency.symbol'), amount: item.purchasePrice.toFixed(2) })}</strong></span>
                </div>
                <div className="mt-2.5 flex items-center gap-2 border-t border-secondary-100 pt-2.5 dark:border-slate-800">
                  <button
                    id={getInventoryItemActionId('view', item.id)}
                    className="btn-secondary min-h-10 min-w-0 flex-1 justify-center gap-1.5 px-2.5 text-center text-xs leading-tight"
                    type="button"
                    onClick={() => openDetailDialog(item.id, 'overview')}
                  >
                    <Eye size={15} className="shrink-0" />
                    <span className="truncate">{t('inventory.viewDetails') || 'View'}</span>
                  </button>
                  {canManageInventory && isRestockableProduct(item) ? (
                    <button
                      id={getInventoryItemActionId('restock', item.id)}
                      className="btn-ghost min-h-10 min-w-0 flex-1 justify-center gap-1.5 px-2.5 text-center text-xs leading-tight"
                      type="button"
                      onClick={() => openRestockDialog(item.id)}
                    >
                      <Plus size={15} className="shrink-0" />
                      <span className="truncate">{t('inventory.restock')}</span>
                    </button>
                  ) : null}
                  <ActionMenu
                    actions={[
                      ...(canManageInventory
                        ? [
                            {
                              label: t('common.edit'),
                              icon: Pencil,
                              onClick: () => openEditDialog(item.id),
                            },
                          ]
                        : []),
                      {
                        label: t('inventory.detail.history') || 'History',
                        icon: History,
                        onClick: () => openDetailDialog(item.id, 'history'),
                      },
                      {
                        label: t('inventory.detail.lots') || 'Stock lots',
                        icon: Layers,
                        onClick: () => openDetailDialog(item.id, 'lots'),
                      },
                      ...(canManageInventory
                        ? [
                            {
                              label: t('common.delete'),
                              icon: Trash2,
                              tone: 'danger',
                              disabled: deletingProductId === item.id,
                              onClick: () => setDeleteProduct(item),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop table */}
        <div id="inventory-desktop-table" className="mt-4 overflow-x-auto hidden md:block">
          <table className="w-full text-sm text-secondary-700">
            <thead className="text-xs uppercase text-secondary-400">
              <tr>
                <th className="py-2 text-left">{t('inventory.itemName')}</th>
                <th className="py-2 text-left">{t('inventory.brand')}</th>
                <th className="py-2 text-left">{t('inventory.itemCategory')}</th>
                <th className="py-2 text-left">{t('inventory.itemCode')}</th>
                <th className="py-2 text-left">{t('inventory.expiryDate') || 'Expiry Date'}</th>
                <th className="py-2 text-right">{t('products.salePrice')}</th>
                <th className="py-2 text-right">{t('products.purchasePrice')}</th>
                <th className="py-2 text-right">{t('inventory.quantity')}</th>
                <th className="py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-3 text-secondary-500">{t('common.loading')}</td>
                </tr>
              ) : pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-3 text-secondary-500">{t('inventory.noItems')}</td>
                </tr>
              ) : (
                pagedItems.map((item) => (
                  <tr key={item.id} id={getInventoryItemRowId(item.id)} className="border-t border-secondary-200/70">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="h-10 w-10 shrink-0 rounded-xl object-cover border border-secondary-200 dark:border-slate-800 cursor-zoom-in" onClick={() => setPreviewImage(item.imageUrl)} />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            {item.name?.slice(0, 1) || 'I'}
                          </div>
                        )}
                        <div>
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => openDetailDialog(item.id, 'overview')}
                          >
                            <p className="font-semibold text-ink hover:text-primary dark:text-white">{item.name}</p>
                          </button>
                          <p className="text-xs text-secondary-500">
                            {[
                              showJewelleryFields
                                ? (item.metalType && item.purity
                                  ? `${item.metalType} ${item.purity}`
                                  : item.metalType || item.purity)
                                : null,
                              item.unit || t('inventory.noUnit'),
                              item.batchCount > 1
                                ? `${item.batchCount} ${t('inventory.lots') || 'lots'}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">{item.brand || '—'}</td>
                    <td className="py-3">{item.category}</td>
                    <td className="py-3">{item.itemCode}</td>
                    <td className="py-3 text-left">
                      {item.expiryDate ? (
                        <div className={`leading-snug ${getExpiryDateColorClass(item.expiryDate) || 'text-secondary-500'}`}>
                          <div className="text-sm font-extrabold tracking-wide">
                            <DateDisplay date={item.expiryDate} />
                          </div>
                          <div className="text-xs font-bold mt-0.5">{getExpiryRemainingDaysText(item.expiryDate, t)}</div>
                        </div>
                      ) : (
                        <span className="text-secondary-400">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.salePrice.toFixed(2) })}
                    </td>
                    <td className="py-3 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.purchasePrice.toFixed(2) })}
                    </td>
                    <td className="py-3 text-right">
                      {item.quantity.toFixed(2)} {item.unit || ''}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <ActionMenu
                          actions={[
                            {
                              label: t('inventory.viewDetails') || 'View details',
                              icon: Eye,
                              onClick: () => openDetailDialog(item.id, 'overview'),
                            },
                            {
                              label: t('inventory.detail.lots') || 'Stock lots',
                              icon: Layers,
                              onClick: () => openDetailDialog(item.id, 'lots'),
                            },
                            {
                              label: t('inventory.detail.history') || 'History',
                              icon: History,
                              onClick: () => openDetailDialog(item.id, 'history'),
                            },
                            ...(canManageInventory && isRestockableProduct(item)
                              ? [
                                  {
                                    label: t('inventory.restock'),
                                    icon: Plus,
                                    onClick: () => openRestockDialog(item.id),
                                  },
                                ]
                              : []),
                            ...(canManageInventory
                              ? [
                                  {
                                    label: t('common.edit'),
                                    icon: Pencil,
                                    onClick: () => openEditDialog(item.id),
                                  },
                                ]
                              : []),
                            ...(canManageInventory
                              ? [
                                  {
                                    label: t('common.delete'),
                                    icon: Trash2,
                                    tone: 'danger',
                                    disabled: deletingProductId === item.id,
                                    onClick: () => setDeleteProduct(item),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div id="inventory-pagination">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={totalItems}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Dialog
        isOpen={isRestockOpen}
        onClose={closeRestockDialog}
        title={t('inventory.restockItem')}
        size="lg"
      >
        <form id="inventory-restock-form" className="space-y-4 sm:space-y-6" onSubmit={handleRestockSubmit}>
          <FormSectionCard hint={t('inventory.restockHelp')} className="p-3 sm:p-4">
            <div className="space-y-3 sm:space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-secondary-400">{t('inventory.itemName')}</p>
                <p id="inventory-restock-item-name" className="mt-1 break-words text-base font-semibold text-ink sm:text-lg">{restockProduct?.name || '-'}</p>
                <p id="inventory-restock-item-unit" className="text-sm text-secondary-500">{restockProduct?.primaryUnit || t('inventory.noUnit')}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="inventory-restock-action-add"
                  type="button"
                  className={`min-h-11 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-semibold leading-tight whitespace-normal transition sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-sm ${
                    !isRestockRemove
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200'
                      : 'border-secondary-200 bg-white text-secondary-700 hover:bg-mist dark:border-slate-800 dark:bg-slate-950 dark:text-secondary-300'
                  }`}
                  onClick={() => setRestockAction('add')}
                >
                  <span className="block min-w-0 break-words">{t('inventory.restockAdd')}</span>
                </button>
                <button
                  id="inventory-restock-action-remove"
                  type="button"
                  className={`min-h-11 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-semibold leading-tight whitespace-normal transition sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-sm ${
                    isRestockRemove
                      ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200'
                      : 'border-secondary-200 bg-white text-secondary-700 hover:bg-mist dark:border-slate-800 dark:bg-slate-950 dark:text-secondary-300'
                  }`}
                  onClick={() => setRestockAction('remove')}
                >
                  <span className="block min-w-0 break-words">{t('inventory.restockRemove')}</span>
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <label className="label">{t('inventory.quantityOnHand')}</label>
                  <div id="inventory-restock-current-stock" className="mt-1 rounded-xl border border-secondary-200/70 bg-mist px-3 py-2.5 text-sm font-medium text-ink-light dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-200 sm:rounded-2xl sm:px-4 sm:py-3">
                    {formatQuantity(currentRestockStock)}{restockUnitSuffix}
                  </div>
                </div>
                <div>
                  <label className="label">
                    {isRestockRemove ? t('inventory.restockQuantityRemove') : t('inventory.restockQuantityAdd')}
                  </label>
                  <input
                    id="inventory-restock-quantity"
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    max={isRestockRemove ? currentRestockStock : undefined}
                    value={restockQuantity}
                    onChange={(event) => setRestockQuantity(event.target.value)}
                    placeholder="0"
                    autoFocus
                    required
                  />
                </div>
              </div>

              {!isRestockRemove ? (
                <div className="space-y-3 rounded-xl border border-secondary-200/70 bg-mist/70 p-3 dark:border-slate-800/70 dark:bg-slate-900/40 sm:rounded-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
                    {t('inventory.stockLots') || 'Stock lot'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr] sm:items-end sm:gap-4">
                    <div>
                      <label className="label block">{t('inventory.expiryDateOptional') || 'Expiry Date (Optional)'}</label>
                      <div className="mt-1">
                        <FlexibleDateInput
                          id="inventory-restock-expiry-date"
                          name="restockExpiryDate"
                          value={restockExpiryDate}
                          onChange={(event) => setRestockExpiryDate(event.target.value || '')}
                          className="input-compact w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label block">{t('inventory.batchNumberOptional') || 'Batch No. (Optional)'}</label>
                      <input
                        id="inventory-restock-batch-number"
                        className="input-compact mt-1 h-11 w-full"
                        value={restockBatchNumber}
                        onChange={(event) => setRestockBatchNumber(event.target.value)}
                        placeholder={t('inventory.batchNumberPlaceholder') || 'Eg. LOT-A12'}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-secondary-500">
                    {t('inventory.restockExpiryHelp') || 'If this stock has a new expiry/batch, add it here. Older stock keeps its own lot.'}
                  </p>
                </div>
              ) : null}

              <div className={`rounded-xl border px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3 ${
                isRestockRemove
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              }`}>
                <p className={`text-xs uppercase tracking-[0.2em] ${
                  isRestockRemove
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}>{t('inventory.newStockLevel')}</p>
                <p id="inventory-restock-new-stock" className={`mt-1 text-lg font-semibold ${
                  isRestockRemove
                    ? 'text-rose-900 dark:text-rose-200'
                    : 'text-emerald-900 dark:text-emerald-200'
                }`}>
                  {formatQuantity(Math.max(nextRestockStock, 0))}{restockUnitSuffix}
                </p>
                <p className={`mt-2 text-xs ${
                  isRestockRemove
                    ? 'text-rose-700 dark:text-rose-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}>{t('inventory.restockEditHint')}</p>
              </div>

              {status.message ? <Notice title={status.message} tone={status.type} /> : null}
            </div>
          </FormSectionCard>

          <div className="mobile-sticky-actions sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-2 border-t border-secondary-200/70 bg-white/95 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button id="inventory-restock-close" className="btn-secondary w-full whitespace-normal text-center leading-tight sm:w-auto" type="button" onClick={closeRestockDialog}>
              <span className="min-w-0 break-words">{t('common.close')}</span>
            </button>
            <button id="inventory-restock-submit" className="btn-primary w-full whitespace-normal text-center leading-tight sm:w-auto" type="submit" disabled={restockSaving}>
              <span className="min-w-0 break-words">
                {restockSaving
                  ? t('common.loading')
                  : (isRestockRemove ? t('inventory.restockRemove') : t('inventory.restockAdd'))}
              </span>
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={previewImage !== null} onClose={() => setPreviewImage(null)} title={t('common.preview') || 'Image Preview'} size="lg">
        <div className="flex justify-center items-center p-2 bg-mist rounded-2xl overflow-hidden">
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[70vh] rounded-xl object-contain" />
        </div>
      </Dialog>

      <Dialog
        isOpen={isOpen}
        onClose={closeDialog}
        title={editingId ? `${t('common.edit')} ${t('inventory.itemName').toLowerCase()}` : t('inventory.addNewItem')}
        size="wide"
      >
        <form id="inventory-item-form" className="space-y-5" onSubmit={handleSubmit}>
          <FormSectionCard hint={t('inventory.help')}>
            <div className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                {/* Image Upload Zone */}
                <div className="w-full md:w-1/3">
                  <label className="label mb-1.5 block">Product Image</label>
                  {form.imageUrl ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-secondary-200 dark:border-slate-800 aspect-square w-full bg-mist flex items-center justify-center">
                      <img src={form.imageUrl} alt="Product" className="object-cover w-full h-full cursor-zoom-in" onClick={() => setPreviewImage(form.imageUrl)} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          className="bg-white/90 hover:bg-white text-ink hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm transition"
                          onClick={() => document.getElementById('inventory-image-input').click()}
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          className="bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm transition"
                          onClick={handleRemoveImage}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary-500 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer aspect-square bg-mist/50 hover:bg-mist/20 dark:hover:bg-slate-900/40 transition group"
                      onClick={() => document.getElementById('inventory-image-input').click()}
                    >
                      {imageUploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-secondary-500">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-secondary-100 dark:border-slate-700 group-hover:scale-105 transition-transform">
                            <Plus className="w-5 h-5 text-secondary-500" />
                          </div>
                          <span className="text-xs font-semibold text-ink-light dark:text-secondary-300">Upload image</span>
                          <span className="text-[10px] text-secondary-400">JPG, PNG, WEBP (Max 5MB)</span>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    id="inventory-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={imageUploading}
                  />
                </div>

                {/* Name and other primary fields */}
                <div className="flex-1 space-y-4 min-w-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="label">{t('inventory.itemName')}</label>
                      <input
                        id="inventory-item-name"
                        className="input mt-1"
                        name="name"
                        value={form.name}
                        onChange={handleFormChange}
                        placeholder={t('inventory.itemNamePlaceholder')}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">{t('inventory.brand')}</label>
                      <input
                        id="inventory-item-brand"
                        className="input mt-1"
                        name="companyName"
                        value={form.companyName}
                        onChange={handleFormChange}
                        placeholder={t('inventory.brandPlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="label">
                        {t('inventory.itemCode')}
                        <span className="ml-1 text-[10px] text-secondary-400 font-normal">(barcode)</span>
                      </label>
                      <input
                        id="inventory-item-code"
                        className="input mt-1"
                        name="itemCode"
                        value={form.itemCode}
                        onChange={handleFormChange}
                        placeholder={t('inventory.itemCodePlaceholder')}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="label">{t('inventory.itemCategory')}</label>
                      <div className="mt-1">
                        <CategorySearchCreateField
                          id="inventory-item-category"
                          inputId="inventory-item-category-search"
                          clearButtonId="inventory-item-category-clear"
                          searchClearButtonId="inventory-item-category-search-clear"
                          createButtonId="inventory-item-category-create"
                          selectedCategory={selectedCategory}
                          options={categoryOptions}
                          onSelect={handleCategorySelect}
                          onCreated={handleCategoryCreated}
                          placeholder={t('categories.selectCategory')}
                          searchPlaceholder={t('categories.searchPlaceholder')}
                        />
                      </div>
                      {categoriesError ? (
                        <p className="mt-2 text-xs text-rose-600">{categoriesError}</p>
                      ) : categoriesLoading && !selectedCategory ? (
                        <p className="mt-2 text-xs text-secondary-500">{t('common.loading')}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-secondary-200/70 bg-mist/60 p-3 dark:border-slate-800/70 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
                      {t('inventory.stockLots') || 'Stock lots'}
                    </p>
                    <p className="mt-1 text-sm text-secondary-700">
                      {editingId
                        ? (t('inventory.stockLotsEditHint') || 'Product details stay the same. Stock is tracked in lots below.')
                        : (t('inventory.stockLotsCreateHint') || 'Optional opening lot. Later restock/purchase can add more lots.')}
                    </p>
                  </div>
                  {editingId ? (
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => {
                        const productId = editingId;
                        closeDialog();
                        openRestockDialog(productId);
                      }}
                    >
                      <Plus size={14} className="mr-1.5 inline" />
                      {t('inventory.restockAdd') || 'Add stock'}
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">{t('inventory.expiryDateOptional') || 'Expiry Date (Optional)'}</label>
                    <div className="mt-1">
                      <FlexibleDateInput
                        id="inventory-expiry-date"
                        name="expiryDate"
                        value={form.expiryDate}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">{t('inventory.batchNumberOptional') || 'Batch No. (Optional)'}</label>
                    <input
                      id="inventory-opening-batch-number"
                      className="input mt-1"
                      name="batchNumber"
                      value={form.batchNumber}
                      onChange={handleFormChange}
                      placeholder={t('inventory.batchNumberPlaceholder') || 'Eg. LOT-A12'}
                    />
                  </div>
                </div>

                {editingId && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
                      {t('inventory.existingLots') || 'Existing open lots'}
                    </p>
                    {editBatches.length > 0 ? (
                      editBatches.map((batch, batchIndex) => {
                        const batchExpiry = toDateInputValue(batch.expiryDate) || '';
                        return (
                          <div
                            key={batch.id || `batch-${batchIndex}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary-200/80 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/50"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-ink-light">
                                {batch.batchNumber
                                  ? `${t('inventory.batchNumber') || 'Batch'}: ${batch.batchNumber}`
                                  : (t('inventory.noBatchNumber') || 'No batch no.')}
                              </div>
                              <div className={batchExpiry ? getExpiryDateColorClass(batchExpiry) : 'text-secondary-500'}>
                                {batchExpiry
                                  ? formatDateBoth(batchExpiry)
                                  : (t('inventory.noExpiry') || 'No expiry')}
                              </div>
                            </div>
                            <span className="font-semibold text-ink-light">
                              {formatQuantity(batch.quantityOnHand || 0)}
                              {form.primaryUnit ? ` ${form.primaryUnit}` : ''}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-secondary-500">{t('inventory.noBatches') || 'No open lots yet.'}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Item Type & Metal Type Fields */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {showJewelleryFields ? (
                  <div>
                    <label className="label">Metal type</label>
                    <select
                      id="inventory-metal-type"
                      className="input mt-1"
                      name="metalType"
                      value={form.metalType}
                      onChange={handleFormChange}
                    >
                      <option value="">Select metal</option>
                      {METAL_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            </div>
          </FormSectionCard>

          <div className="flex border-b border-secondary-200 dark:border-slate-800 gap-6 px-1">
            <button
              id="inventory-stock-tab"
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'stock'
                  ? 'text-primary'
                  : 'text-secondary-500 hover:text-ink dark:text-secondary-400 dark:hover:text-white'
              }`}
            >
              {t('inventory.stockDetails')}
              {activeTab === 'stock' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
            <button
              id="inventory-other-tab"
              type="button"
              onClick={() => setActiveTab('other')}
              className={`pb-3 text-sm font-semibold transition-all relative ${
                activeTab === 'other'
                  ? 'text-primary'
                  : 'text-secondary-500 hover:text-ink dark:text-secondary-400 dark:hover:text-white'
              }`}
            >
              {t('inventory.otherDetails')}
              {activeTab === 'other' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </div>

          <FormSectionCard title={activeTab === 'stock' ? t('inventory.stockDetails') : t('inventory.otherDetails')}>
            {activeTab === 'stock' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {showJewelleryFields ? (
                  <div>
                    <label className="label">Purity</label>
                    {purityOptions.length > 0 ? (
                      <select
                        id="inventory-purity"
                        className="input mt-1"
                        name="purity"
                        value={form.purity}
                        onChange={handleFormChange}
                      >
                        <option value="">Select purity</option>
                        {purityOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="inventory-purity"
                        className="input mt-1"
                        name="purity"
                        value={form.purity}
                        onChange={handleFormChange}
                        placeholder="e.g. 22K or 925"
                      />
                    )}
                  </div>
                ) : null}
                <div>
                  <label className="label">{t('inventory.openingStock')}</label>
                  <input id="inventory-opening-stock" className="input mt-1" name="openingStock" type="number" min="0" step="0.1" value={form.openingStock} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('inventory.measuringUnit')}</label>
                  <select
                    id="inventory-measuring-unit"
                    className="input mt-1"
                    value={primaryUnitSelectValue}
                    onChange={handlePrimaryUnitChange}
                  >
                    <option value="">{t('unitsManagement.selectPrimary')}</option>
                    {primaryUnitChoices.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {unitsError ? <p className="mt-2 text-xs text-rose-600">{unitsError}</p> : null}
                  {!unitsError && unitsLoading ? <p className="mt-2 text-xs text-secondary-500">{t('common.loading')}</p> : null}
                  {!unitsError && !unitsLoading && unitOptions.length === 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-secondary-500">
                      <span>{t('unitsManagement.manageHint')}</span>
                      <Link className="font-semibold text-emerald-600 hover:text-emerald-700" to={buildSettingsTabPath(UNITS_SETTINGS_TAB)}>
                        {t('unitsManagement.manageCta')}
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="label">{t('products.salePrice')}</label>
                  <input id="inventory-sale-price" className="input mt-1" name="salePrice" type="number" step="0.1" value={form.salePrice} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('products.purchasePrice')}</label>
                  <input id="inventory-purchase-price" className="input mt-1" name="purchasePrice" type="number" step="0.1" value={form.purchasePrice} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('inventory.mrpPrice')}</label>
                  <input id="inventory-mrp-price" className="input mt-1" name="mrpPrice" type="number" step="0.1" value={form.mrpPrice} onChange={handleFormChange} />
                </div>
                {/* <div>
                  <label className="label">{t('inventory.wholesalePrice')}</label>
                  <input className="input mt-1" name="wholesalePrice" type="number" step="0.01" value={form.wholesalePrice} onChange={handleFormChange} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">{t('inventory.minWholesaleQty')}</label>
                  <input className="input mt-1" name="minWholesaleQuantity" type="number" step="0.01" value={form.minWholesaleQuantity} onChange={handleFormChange} />
                </div> */}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">{t('products.secondaryUnit')}</label>
                  <select
                    id="inventory-secondary-unit"
                    className="input mt-1"
                    value={secondaryUnitSelectValue}
                    onChange={handleSecondaryUnitChange}
                    disabled={!hasPrimaryUnitSelected}
                  >
                    <option value="">{t('unitsManagement.selectSecondary')}</option>
                    {secondaryUnitChoices.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {!hasPrimaryUnitSelected ? (
                    <p className="mt-2 text-xs text-secondary-500">Add a primary unit first.</p>
                  ) : null}
                </div>
                <div>
                  <label className="label">{t('products.conversionRate')}</label>
                  <input id="inventory-conversion-rate" className="input mt-1" name="conversionRate" type="number" step="1" value={form.conversionRate} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('products.secondaryPrice')}</label>
                  <input id="inventory-secondary-sale-price" className="input mt-1" name="secondarySalePrice" type="number" step="0.01" value={form.secondarySalePrice} onChange={handleFormChange} />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between rounded-xl border border-secondary-200 bg-secondary-50/20 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-900/50">
                    <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">
                      {t('inventory.lowStockAlert')}
                    </span>
                    <label className="relative inline-flex cursor-pointer items-center text-xs">
                      <input
                        id="inventory-low-stock-alert"
                        type="checkbox"
                        className="peer sr-only"
                        name="lowStockAlert"
                        checked={form.lowStockAlert}
                        onChange={handleFormChange}
                      />
                      <div className="peer h-6 w-11 rounded-full bg-secondary-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-secondary-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-slate-700"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </FormSectionCard>

          <div className="mobile-sticky-actions flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button id="inventory-item-close" className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>
              {t('common.close')}
            </button>
            <button id="inventory-item-save" className="btn-primary w-full sm:w-auto" type="submit" disabled={saving}>
              {saving ? t('common.loading') : editingId ? t('common.update') : t('inventory.addItem')}
            </button>
          </div>
        </form>
      </Dialog>

      <ProductDetailDialog
        isOpen={isDetailOpen}
        onClose={closeDetailDialog}
        productId={detailProductId}
        productHint={detailProductHint}
        initialTab={detailInitialTab}
        canManageInventory={canManageInventory}
        showJewelleryFields={showJewelleryFields}
        onEdit={canManageInventory ? () => {
          const id = detailProductId;
          closeDetailDialog();
          openEditDialog(id);
        } : undefined}
        onRestock={canManageInventory ? () => {
          const id = detailProductId;
          closeDetailDialog();
          openRestockDialog(id);
        } : undefined}
      />

      <ImageCropperModal
        isOpen={isCropperOpen}
        imageSrc={cropperImageSrc}
        onClose={() => setIsCropperOpen(false)}
        onCrop={handleCropComplete}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteProduct)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteProduct}
        description={deleteProduct ? `Are you sure you want to delete "${deleteProduct.name}"?` : t('common.confirmDelete')}
        confirming={Boolean(deleteProduct) && deletingProductId === deleteProduct.id}
      />
    </div>
  );
}
