import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import FormSectionCard from '../components/FormSectionCard.jsx';
import CategorySearchCreateField from '../components/CategorySearchCreateField.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { useProductStore } from '../stores/products';
import { ArrowUpDown, Pencil, Plus } from 'lucide-react';

const makeEmptyItem = () => ({
  name: '',
  categoryId: '',
  itemCode: '',
  itemType: 'goods',
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
  ...(form.categoryId ? { categoryId: form.categoryId } : {}),
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
    itemCode: product.sku || '',
    itemType: product.itemType || 'goods',
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

export default function Inventory() {
  const { t } = useI18n();
  const {
    products,
    loading: productsLoading,
    error: productsError,
    fetch: fetchProducts,
    addProduct,
    patchProduct,
  } = useProductStore();

  const unitOptions = useMemo(() => ([
    t('products.units.piece'),
    t('products.units.box'),
    t('products.units.pack'),
    t('products.units.set'),
    t('products.units.pair'),
    t('products.units.dozen'),
    t('products.units.bundle'),
    t('products.units.bottle'),
    t('products.units.carton'),
    t('products.units.tray'),
    t('products.units.bag'),
    t('products.units.sack'),
    t('products.units.kg'),
    t('products.units.g'),
    t('products.units.litre'),
    t('products.units.ml'),
    t('products.units.meter'),
    t('products.units.cm'),
    t('products.units.mm'),
    t('products.units.inch'),
    t('products.units.foot'),
    t('products.units.yard'),
    t('products.units.roll'),
    t('products.units.sheet'),
    t('products.units.unit'),
    t('products.units.hour'),
    t('products.units.day'),
    t('products.units.month'),
  ]), [t]);
  const unitListId = 'inventory-unit-options';

  const [status, setStatus] = useState({ type: 'info', message: '' });
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
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState('');

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

  useEffect(() => {
    if (productsError) setStatus({ type: 'error', message: productsError });
  }, [productsError]);

  const items = useMemo(() => {
    return products.map((product) => ({
      id: product.id,
      name: product.name,
      itemType: product.itemType || 'goods',
      category: getProductCategoryName(product) || '-',
      itemCode: product.sku || '-',
      salePrice: Number(product.salePrice ?? 0),
      purchasePrice: Number(product.purchasePrice ?? 0),
      quantity: Number(product.stockOnHand ?? product.openingStock ?? 0),
      unit: product.primaryUnit || '',
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

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (typeFilter !== 'all' && item.itemType !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (stockFilter === 'in' && item.quantity <= 0) return false;
      if (stockFilter === 'out' && item.quantity > 0) return false;
      if (stockFilter === 'low' && item.quantity > 5) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.itemCode, item.category]
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
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(makeEmptyItem());
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

  const closeDialog = () => {
    setIsOpen(false);
    setForm(makeEmptyItem());
    setActiveTab('stock');
    setEditingId(null);
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('inventory.itemsTitle')}
        subtitle={t('inventory.itemsSubtitle')}
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
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
            {t('inventory.itemsList', { count: totalItems })}
          </h3>

        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))]">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950 sm:col-span-2 xl:col-span-1">
            <span className="text-slate-400">🔍</span>
            <input
              className="w-full bg-transparent focus:border-none focus:ring-0 border-none"
              placeholder={t('inventory.searchItems')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="input border-none min-w-[160px]"
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
            <option value="goods">{t('products.goods')}</option>
            <option value="service">{t('products.service')}</option>
            <option value="part">{t('products.part')}</option>
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
                    <p className="text-xs text-slate-500">{item.category} · {item.unit || t('inventory.noUnit')}</p>
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
                <div className="mt-3 flex justify-end border-t border-slate-100 pt-2.5 dark:border-slate-800">
                  <button
                    className="btn-ghost w-full justify-center sm:w-auto"
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
                <th className="py-2 text-right">{t('common.edit')}</th>
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
                          <p className="text-xs text-slate-500">{item.unit || t('inventory.noUnit')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 capitalize">
                      {item.itemType === 'service'
                        ? t('products.service')
                        : item.itemType === 'part'
                          ? t('products.part')
                          : t('products.goods')}
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
                      <button
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        type="button"
                        onClick={() => openEditDialog(item.id)}
                      >
                        <Pencil size={14} /> {t('common.edit')}
                      </button>
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
        isOpen={isOpen}
        onClose={closeDialog}
        title={editingId ? `${t('common.edit')} ${t('inventory.itemName').toLowerCase()}` : t('inventory.addNewItem')}
        size="xl"
      >
        <datalist id={unitListId}>
          {unitOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
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
                  <label className="label">{t('inventory.itemCode')}</label>
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
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {['goods', 'service',].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, itemType: type }))}
                        className={`${form.itemType === type ? 'btn-primary' : 'btn-ghost'} w-full justify-center`}
                      >
                        {type === 'goods'
                          ? t('products.goods')
                          : type === 'service'
                            ? t('products.service')
                            : t('products.part')}
                      </button>
                    ))}
                  </div>
                </div>
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
                <div>
                  <label className="label">{t('inventory.openingStock')}</label>
                  <input className="input mt-1" name="openingStock" type="number" step="0.1" value={form.openingStock} onChange={handleFormChange} />
                </div>
                <div>
                  <label className="label">{t('inventory.measuringUnit')}</label>
                  <input className="input mt-1" name="primaryUnit" list={unitListId} value={form.primaryUnit} onChange={handleFormChange} />
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
                  <input className="input mt-1" name="secondaryUnit" list={unitListId} value={form.secondaryUnit} onChange={handleFormChange} />
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
