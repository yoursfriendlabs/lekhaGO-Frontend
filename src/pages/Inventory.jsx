import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import { Dialog } from '../components/ui/Dialog.tsx';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { Plus, Upload, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

const makeEmptyItem = () => ({
  name: '',
  category: '',
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
  minWholesaleQty: '',
  lowStockAlert: false,
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

export default function Inventory() {
  const { t } = useI18n();
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
  const [products, setProducts] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
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

  const loadData = async () => {
    try {
      const [productData, summaryData] = await Promise.all([
        api.listProducts(),
        api.inventorySummary(),
      ]);
      setProducts(productData || []);
      setInventoryRows(summaryData || []);
      setStatus({ type: 'info', message: '' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const items = useMemo(() => {
    const summaryMap = new Map(inventoryRows.map((row) => [row.productId, row]));
    const merged = products.map((product) => {
      const summary = summaryMap.get(product.id) || {};
      return {
        id: product.id,
        name: product.name,
        itemType: product.itemType || 'goods',
        category: product.category || product.companyName || '-',
        sku: product.sku || summary.sku || '-',
        salePrice: Number(product.salePrice ?? summary.salePrice ?? 0),
        purchasePrice: Number(product.purchasePrice ?? summary.purchasePrice ?? 0),
        quantity: Number(summary.quantityOnHand ?? 0),
        unit: product.primaryUnit || summary.primaryUnit || '',
      };
    });
    const extra = inventoryRows
      .filter((row) => !products.find((product) => product.id === row.productId))
      .map((row) => ({
        id: row.productId,
        name: row.name,
        itemType: row.itemType || 'goods',
        category: row.category || '-',
        sku: row.sku || '-',
        salePrice: Number(row.salePrice ?? 0),
        purchasePrice: Number(row.purchasePrice ?? 0),
        quantity: Number(row.quantityOnHand ?? 0),
        unit: row.primaryUnit || '',
      }));
    return [...merged, ...extra];
  }, [products, inventoryRows]);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category).filter(Boolean));
    return Array.from(unique).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (typeFilter !== 'all' && item.itemType !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (stockFilter === 'in' && item.quantity <= 0) return false;
      if (stockFilter === 'out' && item.quantity > 0) return false;
      if (stockFilter === 'low' && item.quantity > 5) return false;
      if (!normalizedQuery) return true;
      return [item.name, item.sku, item.category]
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

  const closeDialog = () => {
    setIsOpen(false);
    setForm(makeEmptyItem());
    setActiveTab('stock');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.createProduct({
        name: form.name,
        companyName: form.category,
        itemType: form.itemType,
        primaryUnit: form.primaryUnit,
        secondaryUnit: form.secondaryUnit,
        conversionRate: parseNumber(form.conversionRate),
        salePrice: parseNumber(form.salePrice),
        purchasePrice: parseNumber(form.purchasePrice),
        secondarySalePrice: parseNumber(form.secondarySalePrice),
        mrpPrice: parseNumber(form.mrpPrice),
        wholesalePrice: parseNumber(form.wholesalePrice),
        minWholesaleQty: parseNumber(form.minWholesaleQty),
        openingStock: parseNumber(form.openingStock),
        lowStockAlert: form.lowStockAlert,
      });
      await loadData();
      closeDialog();
      setStatus({ type: 'success', message: t('inventory.messages.itemCreated') });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('inventory.itemsTitle')}
        subtitle={t('inventory.itemsSubtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button">
              <Upload size={16} /> {t('inventory.importItems')}
            </button>
            <button className="btn-primary" type="button" onClick={() => setIsOpen(true)}>
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
          <button className="btn-ghost" type="button">
            <SlidersHorizontal size={16} /> {t('inventory.settings')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm focus-within:border-emerald-300 dark:border-slate-800 dark:bg-slate-950">
            <span className="text-slate-400">🔍</span>
            <input
              className="w-full bg-transparent outline-none"
              placeholder={t('inventory.searchItems')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="input min-w-[160px]"
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
            className="btn-ghost min-w-[120px]"
            type="button"
            onClick={() => setSortKey((prev) => (prev === 'name' ? 'quantity' : 'name'))}
          >
            <ArrowUpDown size={16} /> {t('inventory.sortBy')}
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
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
              </tr>
            </thead>
            <tbody>
              {pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500">{t('inventory.noItems')}</td>
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
                    <td className="py-3">{item.sku}</td>
                    <td className="py-3 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.salePrice.toFixed(2) })}
                    </td>
                    <td className="py-3 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: item.purchasePrice.toFixed(2) })}
                    </td>
                    <td className="py-3 text-right">
                      {item.quantity.toFixed(2)} {item.unit || ''}
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

      <Dialog isOpen={isOpen} onClose={closeDialog} title={t('inventory.addNewItem')} size="xl">
        <datalist id={unitListId}>
          {unitOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <form className="space-y-5" onSubmit={handleSubmit}>
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
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('inventory.itemCategory')}</label>
              <input
                className="input mt-1"
                name="category"
                value={form.category}
                onChange={handleFormChange}
                placeholder={t('inventory.itemCategoryPlaceholder')}
              />
            </div>
            <div>
              <label className="label">{t('inventory.itemType')}</label>
              <div className="mt-1 flex gap-2">
                {['goods', 'service'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, itemType: type }))}
                    className={
                      form.itemType === type
                        ? 'btn-primary'
                        : 'btn-ghost'
                    }
                  >
                    {type === 'goods' ? t('products.goods') : t('products.service')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-slate-200 pb-2 text-sm text-slate-500">
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={activeTab === 'stock' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}
            >
              {t('inventory.stockDetails')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('other')}
              className={activeTab === 'other' ? 'border-b-2 border-emerald-500 pb-1 font-semibold text-emerald-600' : ''}
            >
              {t('inventory.otherDetails')}
            </button>
          </div>

          {activeTab === 'stock' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">{t('inventory.openingStock')}</label>
                <input
                  className="input mt-1"
                  name="openingStock"
                  type="number"
                  step="0.01"
                  value={form.openingStock}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('inventory.measuringUnit')}</label>
                <input
                  className="input mt-1"
                  name="primaryUnit"
                  list={unitListId}
                  value={form.primaryUnit}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('products.salePrice')}</label>
                <input
                  className="input mt-1"
                  name="salePrice"
                  type="number"
                  step="0.01"
                  value={form.salePrice}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('products.purchasePrice')}</label>
                <input
                  className="input mt-1"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('inventory.mrpPrice')}</label>
                <input
                  className="input mt-1"
                  name="mrpPrice"
                  type="number"
                  step="0.01"
                  value={form.mrpPrice}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('inventory.wholesalePrice')}</label>
                <input
                  className="input mt-1"
                  name="wholesalePrice"
                  type="number"
                  step="0.01"
                  value={form.wholesalePrice}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('inventory.minWholesaleQty')}</label>
                <input
                  className="input mt-1"
                  name="minWholesaleQty"
                  type="number"
                  step="0.01"
                  value={form.minWholesaleQty}
                  onChange={handleFormChange}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">{t('products.secondaryUnit')}</label>
                <input
                  className="input mt-1"
                  name="secondaryUnit"
                  list={unitListId}
                  value={form.secondaryUnit}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('products.conversionRate')}</label>
                <input
                  className="input mt-1"
                  name="conversionRate"
                  type="number"
                  step="0.0001"
                  value={form.conversionRate}
                  onChange={handleFormChange}
                />
              </div>
              <div>
                <label className="label">{t('products.secondaryPrice')}</label>
                <input
                  className="input mt-1"
                  name="secondarySalePrice"
                  type="number"
                  step="0.01"
                  value={form.secondarySalePrice}
                  onChange={handleFormChange}
                />
              </div>
              <div className="flex items-center gap-3 pt-7">
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

          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-secondary" type="button" onClick={closeDialog}>
              {t('common.close')}
            </button>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? t('common.loading') : t('inventory.addItem')}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
