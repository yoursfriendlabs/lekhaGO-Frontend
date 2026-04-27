import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import FormSectionCard from '../components/FormSectionCard.jsx';
import CategorySearchCreateField from '../components/CategorySearchCreateField.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { getPurityOptionsForMetal, METAL_TYPE_OPTIONS } from '../lib/jewellery.js';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { buildSettingsTabPath, UNITS_SETTINGS_TAB } from '../lib/settingsTabs.js';
import { useProductStore } from '../stores/products';
import { ArrowUpDown, Pencil, Plus } from 'lucide-react';

const makeEmptyItem = () => ({
  name: '',
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

const buildProductPayload = (form) => ({
  name: form.name,
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
});

function getProductCategoryName(product = {}) {
  if (typeof product.categoryName === 'string' && product.categoryName.trim()) return product.categoryName.trim();
  if (product.category && typeof product.category === 'object' && typeof product.category.name === 'string' && product.category.name.trim()) {
    return product.category.name.trim();
  }
  if (typeof product.category === 'string' && product.category.trim()) return product.category.trim();
  if (typeof product.companyName === 'string' && product.companyName.trim()) return product.companyName.trim();
  return '';
}

function productToForm(product = {}) {
  return {
    name: product.name || '',
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
  };
}

function getCurrentStock(product = {}) {
  return Number(product.stockOnHand ?? product.openingStock ?? 0);
}

function getUnitText(unit = {}) {
  return String(unit?.symbol || unit?.name || '').trim();
}

function getUnitOptionLabel(unit = {}) {
  const name = String(unit?.name || '').trim();
  const symbol = String(unit?.symbol || '').trim();
  if (name && symbol && name.toLowerCase() !== symbol.toLowerCase()) {
    return `${name} (${symbol})`;
  }
  return name || symbol;
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

function getItemTypeLabel(itemType, itemTypeOptions, t) {
  const match = itemTypeOptions.find((option) => option.value === itemType);
  if (match?.label) return match.label;
  if (itemType === 'service') return t('products.service');
  if (itemType === 'part') return t('products.part');
  return t('products.goods');
}

export default function Inventory() {
  const { t } = useI18n();
  const { businessProfile } = useBusinessSettings();
  const {
    products,
    loading: productsLoading,
    error: productsError,
    fetch: fetchProducts,
    addProduct,
    patchProduct,
  } = useProductStore();
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
  const [toast, setToast] = useState({ type: '', message: '' });
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('stock');
  const [form, setForm] = useState(makeEmptyItem());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockSaving, setRestockSaving] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

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
      itemType: product.itemType || 'goods',
      metalType: product.metalType || '',
      purity: product.purity || '',
      category: getProductCategoryName(product) || '-',
      itemCode: product.sku || '-',
      salePrice: Number(product.salePrice ?? 0),
      purchasePrice: Number(product.purchasePrice ?? 0),
      quantity: Number(product.stockOnHand ?? product.openingStock ?? 0),
      unit: product.primaryUnit || getUnitText(product.unit) || '',
    }));
  }, [products]);

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

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (typeFilter !== 'all' && item.itemType !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (stockFilter === 'in' && item.quantity <= 0) return false;
      if (stockFilter === 'out' && item.quantity > 0) return false;
      if (stockFilter === 'low' && item.quantity > 5) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.itemCode, item.category, item.metalType, item.purity]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedQuery));
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortKey === 'quantity') return b.quantity - a.quantity;
      if (sortKey === 'salePrice') return b.salePrice - a.salePrice;
      if (sortKey === 'purchasePrice') return b.purchasePrice - a.purchasePrice;
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [items, query, categoryFilter, stockFilter, typeFilter, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, stockFilter, typeFilter, sortKey]);

  const totalItems = filteredItems.length;
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize]);

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

  const handlePrimaryUnitChange = (event) => {
    const { value } = event.target;

    if (!value) {
      setForm((previous) => ({
        ...previous,
        unitId: '',
        primaryUnit: '',
      }));
      return;
    }

    if (value.startsWith('id:')) {
      const unit = unitOptionsById.get(value.slice(3));
      setForm((previous) => ({
        ...previous,
        unitId: unit?.id ? String(unit.id) : '',
        primaryUnit: getUnitText(unit),
      }));
      return;
    }

    setForm((previous) => ({
      ...previous,
      unitId: '',
      primaryUnit: value.slice('legacy:'.length),
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

  const openEditDialog = (itemId) => {
    const product = products.find((entry) => String(entry.id) === String(itemId));
    if (!product) {
      setStatus({ type: 'error', message: t('common.noData') });
      return;
    }

    setEditingId(product.id);
    setForm(productToForm(product));
    setActiveTab('stock');
    setIsOpen(true);
  };

  const openRestockDialog = (itemId) => {
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
    setIsRestockOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setForm(makeEmptyItem());
    setActiveTab('stock');
    setEditingId(null);
  };

  const closeRestockDialog = () => {
    setIsRestockOpen(false);
    setRestockProduct(null);
    setRestockQuantity('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        setStatus({ type: 'success', message: t('inventory.messages.itemUpdated') });
      } else {
        const product = await api.createProduct(payload);
        addProduct(product || optimisticProduct);
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

    if (!restockProduct) return;

    const quantityToAdd = parseNumber(restockQuantity);
    if (quantityToAdd <= 0) {
      setStatus({ type: 'error', message: t('inventory.messages.restockQuantityRequired') });
      return;
    }

    setRestockSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      const response = await api.restockProduct(restockProduct.id, { quantity: quantityToAdd });
      const updatedProduct = response?.product || response;
      const fallbackStock = getCurrentStock(restockProduct) + quantityToAdd;

      patchProduct(restockProduct.id, updatedProduct || {
        ...restockProduct,
        stockOnHand: fallbackStock,
      });

      const quantityLabel = `${formatQuantity(quantityToAdd)}${restockProduct.primaryUnit ? ` ${restockProduct.primaryUnit}` : ''}`;
      closeRestockDialog();
      setToast({
        type: 'success',
        message: response?.message || t('inventory.messages.itemRestocked', {
          name: restockProduct.name,
          quantity: quantityLabel,
        }),
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
  const nextRestockStock = currentRestockStock + parseNumber(restockQuantity);
  const restockUnitSuffix = restockProduct?.primaryUnit ? ` ${restockProduct.primaryUnit}` : '';

  return (
    <div className="space-y-8">
      {toast.message ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-4 right-4 z-[80] md:left-auto md:right-6 md:w-full md:max-w-sm">
          <Notice title={toast.message} tone={toast.type || 'success'} />
        </div>
      ) : null}

      <PageHeader
        title={inventoryTitle}
        subtitle={inventorySubtitle}
        action={(
          <div className="flex flex-wrap gap-2">
            {/*<button className="btn-secondary w-full sm:w-auto" type="button">*/}
            {/*  <Upload size={16} /> {t('inventory.importItems')}*/}
            {/*</button>*/}
            <button className="btn-primary w-full sm:w-auto" type="button" onClick={openCreateDialog}>
              <Plus size={16} /> {t('inventory.addNewItem')}
            </button>
          </div>
        )}
      />

      {status.message ? <Notice title={status.message} tone={status.type} /> : null}

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white ">
            {t('inventory.itemsList', { count: totalItems })}
          </h3>

        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))]">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white  text-sm text-slate-600 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2 xl:col-span-1">
            <span className="text-slate-400">🔍</span>
            <input
              className="w-full bg-transparent focus:border-none focus:ring-0 border-none"
              placeholder={t('inventory.searchItems')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="input border-none min-w-[150px]"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">{t('inventory.allCategories')}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            className="input min-w-[140px]"
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
          >
            <option value="all">{t('inventory.allStock')}</option>
            <option value="in">{t('inventory.inStock')}</option>
            <option value="low">{t('inventory.lowStock')}</option>
            <option value="out">{t('inventory.outStock')}</option>
          </select>
          <select
            className="input min-w-[140px]"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">{t('inventory.allItems')}</option>
            {itemTypeOptions.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <button
            className="btn-ghost w-full justify-center xl:w-auto"
            type="button"
            onClick={() => setSortKey((prev) => (prev === 'name' ? 'quantity' : 'name'))}
          >
            <ArrowUpDown size={16} /> {t('inventory.sortBy')}
          </button>
        </div>

        {/* Mobile card view */}
        <div className="mt-4 md:hidden space-y-3">
          {productsLoading && products.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
          ) : pagedItems.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">{t('inventory.noItems')}</p>
          ) : (
            pagedItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {item.name?.slice(0, 1) || 'I'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {[item.category, showJewelleryFields ? (item.metalType && item.purity ? `${item.metalType} ${item.purity}` : item.metalType || item.purity) : null, item.unit || t('inventory.noUnit')]
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
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <span>{t('products.salePrice')}: <strong className="text-slate-700 dark:text-slate-300">{t('currency.formatted', { symbol: t('currency.symbol'), amount: item.salePrice.toFixed(2) })}</strong></span>
                  <span>{t('products.purchasePrice')}: <strong className="text-slate-700 dark:text-slate-300">{t('currency.formatted', { symbol: t('currency.symbol'), amount: item.purchasePrice.toFixed(2) })}</strong></span>
                </div>
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  {isRestockableProduct(item) ? (
                    <button
                      className="btn-secondary flex-1 justify-center sm:w-auto"
                      type="button"
                      onClick={() => openRestockDialog(item.id)}
                    >
                      <Plus size={16} /> {t('inventory.restock')}
                    </button>
                  ) : null}
                  <button
                    className={`${isRestockableProduct(item) ? 'btn-ghost flex-1' : 'btn-ghost w-full'} justify-center sm:w-auto`}
                    type="button"
                    onClick={() => openEditDialog(item.id)}
                  >
                    <Pencil size={16} /> {t('common.edit')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {/* Desktop table */}
        <div className="mt-4 overflow-x-auto hidden md:block">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('inventory.itemName')}</th>
                <th className="py-2 text-left">{t('inventory.itemType')}</th>
                <th className="py-2 text-left">{t('inventory.itemCategory')}</th>
                <th className="py-2 text-left">{t('inventory.itemCode')}</th>
                <th className="py-2 text-right">{t('products.salePrice')}</th>
                <th className="py-2 text-right">{t('products.purchasePrice')}</th>
                <th className="py-2 text-right">{t('inventory.quantity')}</th>
                <th className="py-2 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {productsLoading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-3 text-slate-500">{t('common.loading')}</td>
                </tr>
              ) : pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-3 text-slate-500">{t('inventory.noItems')}</td>
                </tr>
              ) : (
                pagedItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                          {item.name?.slice(0, 1) || 'I'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {[showJewelleryFields ? (item.metalType && item.purity ? `${item.metalType} ${item.purity}` : item.metalType || item.purity) : null, item.unit || t('inventory.noUnit')]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 capitalize">
                      {getItemTypeLabel(item.itemType, itemTypeOptions, t)}
                    </td>
                    <td className="py-3">{item.category}</td>
                    <td className="py-3">{item.itemCode}</td>
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
                        {isRestockableProduct(item) ? (
                          <button
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                            type="button"
                            onClick={() => openRestockDialog(item.id)}
                          >
                            <Plus size={14} /> {t('inventory.restock')}
                          </button>
                        ) : null}
                        <button
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          type="button"
                          onClick={() => openEditDialog(item.id)}
                        >
                          <Pencil size={14} /> {t('common.edit')}
                        </button>
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
          total={totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <Dialog
        isOpen={isRestockOpen}
        onClose={closeRestockDialog}
        title={t('inventory.restockItem')}
        size="md"
      >
        <form className="space-y-5" onSubmit={handleRestockSubmit}>
          <FormSectionCard hint={t('inventory.restockHelp')}>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t('inventory.itemName')}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{restockProduct?.name || '-'}</p>
                <p className="text-sm text-slate-500">{restockProduct?.primaryUnit || t('inventory.noUnit')}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">{t('inventory.quantityOnHand')}</label>
                  <div className="mt-1 rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/50 dark:text-slate-200">
                    {formatQuantity(currentRestockStock)}{restockUnitSuffix}
                  </div>
                </div>
                <div>
                  <label className="label">{t('inventory.restockQuantity')}</label>
                  <input
                    className="input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={restockQuantity}
                    onChange={(event) => setRestockQuantity(event.target.value)}
                    placeholder="0"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">{t('inventory.newStockLevel')}</p>
                <p className="mt-1 text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                  {formatQuantity(nextRestockStock)}{restockUnitSuffix}
                </p>
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{t('inventory.restockEditHint')}</p>
              </div>
            </div>
          </FormSectionCard>

          <div className="mobile-sticky-actions flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeRestockDialog}>
              {t('common.close')}
            </button>
            <button className="btn-primary w-full sm:w-auto" type="submit" disabled={restockSaving}>
              {restockSaving ? t('common.loading') : t('inventory.restock')}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={isOpen}
        onClose={closeDialog}
        title={editingId ? `${t('common.edit')} ${t('inventory.itemName').toLowerCase()}` : t('inventory.addNewItem')}
        size="xl"
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <FormSectionCard hint={t('inventory.help')}>
            <div className="space-y-4">
              <div>
                <label className="label">{t('inventory.itemName')}</label>
                <input
                  className="input mt-1"
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder={t('inventory.itemNamePlaceholder')}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="label">{t('inventory.itemCategory')}</label>
                  <div className="mt-1">
                    <CategorySearchCreateField
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
                    <p className="mt-2 text-xs text-slate-500">{t('common.loading')}</p>
                  ) : selectedCategory?.name ? (
                    <p className="mt-2 text-xs text-slate-500">{selectedCategory.name}</p>
                  ) : null}
                </div>
                <div>
                  <label className="label">
                    {t('inventory.itemCode')}
                    <span className="ml-1 text-[10px] text-slate-400 font-normal">(barcode ready)</span>
                  </label>
                  <input
                    className="input mt-1"
                    name="itemCode"
                    value={form.itemCode}
                    onChange={handleFormChange}
                    placeholder={t('inventory.itemCodePlaceholder')}
                  />
                </div>
                <div>
                  <label className="label">{t('inventory.itemType')}</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {itemTypeOptions.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, itemType: type.value }))}
                        className={`h-10 rounded-2xl border px-3 text-center text-xs font-semibold transition ${
                          form.itemType === type.value
                            ? 'border-primary bg-primary text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-primary-200 hover:bg-primary-50/40 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-primary-700 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`}
                        title={type.description || type.label}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
                {showJewelleryFields ? (
                  <div>
                    <label className="label">Metal type</label>
                    <select
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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === 'stock'
                  ? 'border-primary-300 bg-primary-500 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {t('inventory.stockDetails')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                activeTab === 'other'
                  ? 'border-primary-300 bg-primary-500 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              {t('inventory.otherDetails')}
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
                  <input className="input mt-1" name="openingStock" type="number" min="0" step="0.1" value={form.openingStock} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('inventory.measuringUnit')}</label>
                  <select
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
                  {!unitsError && unitsLoading ? <p className="mt-2 text-xs text-slate-500">{t('common.loading')}</p> : null}
                  {!unitsError && !unitsLoading && unitOptions.length === 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{t('unitsManagement.manageHint')}</span>
                      <Link className="font-semibold text-emerald-600 hover:text-emerald-700" to={buildSettingsTabPath(UNITS_SETTINGS_TAB)}>
                        {t('unitsManagement.manageCta')}
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="label">{t('products.salePrice')}</label>
                  <input className="input mt-1" name="salePrice" type="number" step="0.1" value={form.salePrice} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('products.purchasePrice')}</label>
                  <input className="input mt-1" name="purchasePrice" type="number" step="0.1" value={form.purchasePrice} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('inventory.mrpPrice')}</label>
                  <input className="input mt-1" name="mrpPrice" type="number" step="0.1" value={form.mrpPrice} onChange={handleFormChange} />
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
                    className="input mt-1"
                    value={secondaryUnitSelectValue}
                    onChange={handleSecondaryUnitChange}
                  >
                    <option value="">{t('unitsManagement.selectSecondary')}</option>
                    {secondaryUnitChoices.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{t('products.conversionRate')}</label>
                  <input className="input mt-1" name="conversionRate" type="number" step="0.0001" value={form.conversionRate} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('products.secondaryPrice')}</label>
                  <input className="input mt-1" name="secondarySalePrice" type="number" step="0.01" value={form.secondarySalePrice} onChange={handleFormChange} />
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 px-4 py-3">
                  <input
                    id="lowStockAlert"
                    className="h-4 w-4 rounded border-slate-300"
                    type="checkbox"
                    name="lowStockAlert"
                    checked={form.lowStockAlert}
                    onChange={handleFormChange}
                  />
                  <label htmlFor="lowStockAlert" className="text-sm text-slate-600">
                    {t('inventory.lowStockAlert')}
                  </label>
                </div>
              </div>
            )}
          </FormSectionCard>

          <div className="mobile-sticky-actions flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button className="btn-secondary w-full sm:w-auto" type="button" onClick={closeDialog}>
              {t('common.close')}
            </button>
            <button className="btn-primary w-full sm:w-auto" type="submit" disabled={saving}>
              {saving ? t('common.loading') : editingId ? t('common.update') : t('inventory.addItem')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
