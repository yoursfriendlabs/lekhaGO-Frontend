import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { Dialog } from '../components/ui/Dialog.tsx';
import Pagination from '../components/Pagination';

const makeEmptyProduct = () => ({
  name: '',
  companyName: '',
  sku: '',
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
  lowStockAlert: false,
  taxRate: '0',
});

const HEADER_MAP = {
  name: ['name', 'product', 'productname'],
  companyName: ['company', 'companyname', 'brand', 'manufacturer'],
  sku: ['sku', 'barcode', 'code'],
  itemType: ['type', 'itemtype', 'category'],
  openingStock: ['openingstock', 'openingqty', 'openingquantity'],
  primaryUnit: ['primaryunit', 'unit', 'uom', 'baseunit'],
  secondaryUnit: ['secondaryunit', 'subunit', 'altunit', 'unit2'],
  conversionRate: ['conversionrate', 'conversion', 'ratio', 'rate', 'secondaryperprimary'],
  secondarySalePrice: ['secondarysaleprice', 'secondaryprice', 'secondaryunitprice', 'price2', 'unitprice2'],
  purchasePrice: ['purchaseprice', 'buyprice', 'cost', 'costprice'],
  salePrice: ['saleprice', 'sellingprice', 'price'],
  mrpPrice: ['mrp', 'mrpprice', 'retailprice', 'listprice'],
  wholesalePrice: ['wholesale', 'wholesaleprice'],
  minWholesaleQuantity: ['minwholesaleqty', 'minwholesalequantity', 'minwholesale'],
  lowStockAlert: ['lowstock', 'lowstockalert'],
  taxRate: ['taxrate', 'tax', 'vat'],
};

const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const splitDelimitedLine = (line, delimiter) => {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
};

const parseItemType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['service', 'svc'].includes(normalized)) return 'service';
  if (['part', 'spare', 'component'].includes(normalized)) return 'part';
  if (['goods', 'good', 'item', 'product'].includes(normalized)) return 'goods';
  return 'goods';
};

const parseBoolean = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
};

const parseNumber = (value) => {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBlankRow = (row) => {
  const numericDefaults = [
    'purchasePrice',
    'salePrice',
    'taxRate',
    'conversionRate',
    'secondarySalePrice',
    'openingStock',
    'mrpPrice',
    'wholesalePrice',
    'minWholesaleQuantity',
  ].every((key) => parseNumber(row[key]) === 0);
  return (
    !String(row.name || '').trim() &&
    !String(row.companyName || '').trim() &&
    !String(row.sku || '').trim() &&
    !String(row.primaryUnit || '').trim() &&
    !String(row.secondaryUnit || '').trim() &&
    !row.lowStockAlert &&
    row.itemType === 'goods' &&
    numericDefaults
  );
};

export default function Products() {
  const { t } = useI18n();
  const unitOptions = useMemo(() => ([
    t('products.units.piece'),
    t('products.units.pieces'),
    t('products.units.pcs'),
    t('products.units.box'),
    t('products.units.pack'),
    t('products.units.packet'),
    t('products.units.pouch'),
    t('products.units.set'),
    t('products.units.pair'),
    t('products.units.dozen'),
    t('products.units.bundle'),
    t('products.units.bottle'),
    t('products.units.can'),
    t('products.units.jar'),
    t('products.units.tube'),
    t('products.units.carton'),
    t('products.units.crate'),
    t('products.units.pallet'),
    t('products.units.tray'),
    t('products.units.bag'),
    t('products.units.sack'),
    t('products.units.drum'),
    t('products.units.barrel'),
    t('products.units.bucket'),
    t('products.units.capsule'),
    t('products.units.tablet'),
    t('products.units.strip'),
    t('products.units.vial'),
    t('products.units.ampoule'),
    t('products.units.kg'),
    t('products.units.g'),
    t('products.units.mg'),
    t('products.units.tonne'),
    t('products.units.lb'),
    t('products.units.oz'),
    t('products.units.litre'),
    t('products.units.ml'),
    t('products.units.cc'),
    t('products.units.gallon'),
    t('products.units.quart'),
    t('products.units.pint'),
    t('products.units.cup'),
    t('products.units.meter'),
    t('products.units.cm'),
    t('products.units.mm'),
    t('products.units.inch'),
    t('products.units.foot'),
    t('products.units.yard'),
    t('products.units.kilometer'),
    t('products.units.sqMeter'),
    t('products.units.sqFoot'),
    t('products.units.sqInch'),
    t('products.units.roll'),
    t('products.units.sheet'),
    t('products.units.unit'),
    t('products.units.minute'),
    t('products.units.hour'),
    t('products.units.day'),
    t('products.units.week'),
    t('products.units.month'),
    t('products.units.year'),
  ]), [t]);
  const unitListId = 'product-unit-options';
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(makeEmptyProduct());
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [listStatus, setListStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [bulkRows, setBulkRows] = useState([makeEmptyProduct()]);
  const [bulkStatus, setBulkStatus] = useState({ type: 'info', message: '' });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('single');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadProducts = async () => {
    try {
      const data = await api.listProducts();
      setProducts(data?.items || []);
      setListStatus({ type: 'info', message: '' });
    } catch (err) {
      setListStatus({ type: 'error', message: err.message });
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.createProduct({
        ...form,
        purchasePrice: parseNumber(form.purchasePrice),
        salePrice: parseNumber(form.salePrice),
        taxRate: parseNumber(form.taxRate),
        conversionRate: parseNumber(form.conversionRate),
        secondarySalePrice: parseNumber(form.secondarySalePrice),
        openingStock: parseNumber(form.openingStock),
        mrpPrice: parseNumber(form.mrpPrice),
        wholesalePrice: parseNumber(form.wholesalePrice),
        minWholesaleQuantity: parseNumber(form.minWholesaleQuantity),
      });
      setForm(makeEmptyProduct());
      await loadProducts();
      setStatus({ type: 'success', message: t('products.messages.productCreated') });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (mode) => {
    setDialogMode(mode);
    setStatus({ type: 'info', message: '' });
    setBulkStatus({ type: 'info', message: '' });
    setIsOpen(true);
  };

  const closeDialog = () => setIsOpen(false);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      if (typeFilter !== 'all' && product.itemType !== typeFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      return [product.name, product.companyName, product.sku, product.primaryUnit, product.secondaryUnit]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(normalizedQuery));
    });
  }, [products, query, typeFilter]);

  const totalProducts = filteredProducts.length;
  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const handleBulkChange = (index, event) => {
    const { name, value, type, checked } = event.target;
    setBulkRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [name]: type === 'checkbox' ? checked : value } : row))
    );
  };

  const addBulkRow = () => setBulkRows((prev) => [...prev, makeEmptyProduct()]);
  const removeBulkRow = (index) => {
    setBulkRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const importBulkRows = () => {
    const source = bulkText.trim();
    if (!source) {
      setBulkStatus({ type: 'error', message: t('products.messages.pasteRowsFirst') });
      return;
    }
    const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
      setBulkStatus({ type: 'error', message: t('products.messages.pasteRowsFirst') });
      return;
    }
    const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
    const parsed = lines.map((line) => splitDelimitedLine(line, delimiter));
    const headerIndex = {};
    let headerMatches = 0;
    parsed[0].forEach((cell, idx) => {
      const normalized = normalizeHeader(cell);
      Object.entries(HEADER_MAP).forEach(([field, aliases]) => {
        if (aliases.includes(normalized) && headerIndex[field] === undefined) {
          headerIndex[field] = idx;
          headerMatches += 1;
        }
      });
    });
    const hasHeader = headerMatches >= 2;
    const fieldsInOrder = [
      'name',
      'companyName',
      'sku',
      'itemType',
      'openingStock',
      'primaryUnit',
      'secondaryUnit',
      'conversionRate',
      'salePrice',
      'purchasePrice',
      'secondarySalePrice',
      'mrpPrice',
      'wholesalePrice',
      'minWholesaleQuantity',
      'lowStockAlert',
      'taxRate',
    ];
    const rows = parsed.slice(hasHeader ? 1 : 0).map((cells) => {
      const row = makeEmptyProduct();
      const assignField = (field, rawValue) => {
        const value = String(rawValue ?? '').trim();
        if (field === 'lowStockAlert') {
          row.lowStockAlert = parseBoolean(value);
        } else if (field === 'itemType') {
          row.itemType = parseItemType(value || row.itemType);
        } else if ([
          'purchasePrice',
          'salePrice',
          'taxRate',
          'conversionRate',
          'secondarySalePrice',
          'openingStock',
          'mrpPrice',
          'wholesalePrice',
          'minWholesaleQuantity',
        ].includes(field)) {
          row[field] = value || '0';
        } else {
          row[field] = value;
        }
      };
      if (hasHeader) {
        Object.entries(headerIndex).forEach(([field, idx]) => assignField(field, cells[idx]));
      } else {
        fieldsInOrder.forEach((field, idx) => assignField(field, cells[idx]));
      }
      return row;
    });
    if (!rows.length) {
      setBulkStatus({ type: 'error', message: t('products.messages.noProductRows') });
      return;
    }
    setBulkRows(rows);
    setBulkStatus({ type: 'success', message: t('products.messages.importedRows', { count: rows.length }) });
  };

  const handleBulkSubmit = async (event) => {
    event.preventDefault();
    setBulkLoading(true);
    setBulkStatus({ type: 'info', message: '' });

    const rowsToCreate = bulkRows
      .map((row, index) => ({ row, index }))
      .filter((item) => !isBlankRow(item.row));

    if (!rowsToCreate.length) {
      setBulkStatus({ type: 'error', message: t('products.messages.addAtLeastOne') });
      setBulkLoading(false);
      return;
    }

    const missingName = rowsToCreate.find((item) => !String(item.row.name || '').trim());
    if (missingName) {
      setBulkStatus({
        type: 'error',
        message: t('products.messages.rowMissingName', { row: missingName.index + 1 }),
      });
      setBulkLoading(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        rowsToCreate.map((item) =>
          api.createProduct({
            ...item.row,
            purchasePrice: parseNumber(item.row.purchasePrice),
            salePrice: parseNumber(item.row.salePrice),
            taxRate: parseNumber(item.row.taxRate),
            conversionRate: parseNumber(item.row.conversionRate),
            secondarySalePrice: parseNumber(item.row.secondarySalePrice),
            openingStock: parseNumber(item.row.openingStock),
            mrpPrice: parseNumber(item.row.mrpPrice),
            wholesalePrice: parseNumber(item.row.wholesalePrice),
            minWholesaleQuantity: parseNumber(item.row.minWholesaleQuantity),
          })
        )
      );
      const failed = results
        .map((result, idx) => {
          if (result.status === 'rejected') {
            return {
              index: rowsToCreate[idx].index,
              message: result.reason?.message || 'Failed to create product.',
            };
          }
          return null;
        })
        .filter(Boolean);
      const successCount = results.length - failed.length;

      await loadProducts();

      if (failed.length) {
        const preview = failed
          .slice(0, 3)
          .map((item) => `Row ${item.index + 1}: ${item.message}`)
          .join(' | ');
        const suffix = failed.length > 3 ? ` (+${failed.length - 3} more)` : '';
        setBulkStatus({
          type: 'error',
          message: t('products.messages.createdSome', {
            success: successCount,
            failed: failed.length,
            details: `${preview}${suffix}`,
          }),
        });
      } else {
        setBulkRows([makeEmptyProduct()]);
        setBulkText('');
        setBulkStatus({ type: 'success', message: t('products.messages.createdAll', { count: successCount }) });
      }
    } catch (err) {
      setBulkStatus({ type: 'error', message: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
      />
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('products.catalog')}</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={() => openDialog('bulk')}>
              {t('products.addMultiple')}
            </button>
            <button className="btn-primary" type="button" onClick={() => openDialog('single')}>
              {t('products.addProduct')}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className="input max-w-[260px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('products.searchPlaceholder')}
          />
          <select
            className="input max-w-[180px]"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">{t('products.allTypes')}</option>
            <option value="goods">{t('products.goods')}</option>
            <option value="service">{t('products.service')}</option>
            <option value="part">{t('products.part')}</option>
          </select>
        </div>
        {listStatus.message ? <Notice title={listStatus.message} tone={listStatus.type} /> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('products.name')}</th>
                <th className="py-2 text-left">{t('products.company')}</th>
                <th className="py-2 text-left">{t('products.sku')}</th>
                <th className="py-2 text-left">{t('products.type')}</th>
                <th className="py-2 text-left">{t('products.primaryUnit')}</th>
                <th className="py-2 text-left">{t('products.secondaryUnit')}</th>
                <th className="py-2 text-left">{t('products.conversionRate')}</th>
                <th className="py-2 text-right">{t('inventory.openingStock')}</th>
                <th className="py-2 text-right">{t('products.purchasePrice')}</th>
                <th className="py-2 text-right">{t('products.salePrice')}</th>
                <th className="py-2 text-right">{t('products.secondaryPrice')}</th>
                <th className="py-2 text-right">{t('inventory.mrpPrice')}</th>
                <th className="py-2 text-right">{t('inventory.wholesalePrice')}</th>
                <th className="py-2 text-right">{t('inventory.minWholesaleQty')}</th>
                <th className="py-2 text-left">{t('inventory.lowStockAlert')}</th>
                <th className="py-2 text-right">{t('products.taxRate')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedProducts.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-3 text-slate-500">
                    {t('products.noProducts')}
                  </td>
                </tr>
              ) : (
                pagedProducts.map((product) => (
                  <tr key={product.id} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2 font-medium text-slate-900 dark:text-white">{product.name}</td>
                    <td className="py-2">{product.companyName || '—'}</td>
                    <td className="py-2">{product.sku || '—'}</td>
                    <td className="py-2 capitalize">
                      {product.itemType === 'service'
                        ? t('products.service')
                        : product.itemType === 'part'
                          ? t('products.part')
                          : t('products.goods')}
                    </td>
                    <td className="py-2">{product.primaryUnit || '—'}</td>
                    <td className="py-2">{product.secondaryUnit || '—'}</td>
                    <td className="py-2">
                      {product.primaryUnit && product.secondaryUnit && Number(product.conversionRate || 0) > 0
                        ? `1 ${product.primaryUnit} = ${Number(product.conversionRate).toFixed(2)} ${product.secondaryUnit}`
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {Number(product.openingStock || 0).toFixed(2)} {product.primaryUnit || ''}
                    </td>
                    <td className="py-2 text-right">{t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(product.purchasePrice || 0).toFixed(2) })}</td>
                    <td className="py-2 text-right">{t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(product.salePrice || 0).toFixed(2) })}</td>
                    <td className="py-2 text-right">
                      {Number(product.secondarySalePrice || 0) > 0
                        ? t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(product.secondarySalePrice || 0).toFixed(2) })
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {Number(product.mrpPrice || 0) > 0
                        ? t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(product.mrpPrice || 0).toFixed(2) })
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {Number(product.wholesalePrice || 0) > 0
                        ? t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(product.wholesalePrice || 0).toFixed(2) })
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      {Number(product.minWholesaleQuantity || 0) > 0
                        ? Number(product.minWholesaleQuantity || 0).toFixed(2)
                        : '—'}
                    </td>
                    <td className="py-2">{product.lowStockAlert ? t('common.yes') : t('common.no')}</td>
                    <td className="py-2 text-right">{Number(product.taxRate || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={totalProducts}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>

      <Dialog isOpen={isOpen} onClose={closeDialog} title={t('products.dialogTitle')} size="xl">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            className={dialogMode === 'single' ? 'btn-primary' : 'btn-ghost'}
            type="button"
            onClick={() => setDialogMode('single')}
          >
            {t('common.create')}
          </button>
          <button
            className={dialogMode === 'bulk' ? 'btn-primary' : 'btn-ghost'}
            type="button"
            onClick={() => setDialogMode('bulk')}
          >
            {t('products.addMultiple')}
          </button>
        </div>
        <datalist id={unitListId}>
          {unitOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>

        {dialogMode === 'single' ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="label">{t('products.name')}</label>
              <input className="input mt-1" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="label">{t('products.company')}</label>
              <input className="input mt-1" name="companyName" value={form.companyName} onChange={handleChange} />
              <p className="mt-1 text-xs text-slate-500">{t('products.useBrand')}</p>
            </div>
            <div>
              <label className="label">{t('products.sku')}</label>
              <input className="input mt-1" name="sku" value={form.sku} onChange={handleChange} />
              <p className="mt-1 text-xs text-slate-500">{t('products.barcodeHint')}</p>
            </div>
            <div>
              <label className="label">{t('products.type')}</label>
              <select className="input mt-1" name="itemType" value={form.itemType} onChange={handleChange}>
                <option value="goods">{t('products.goods')}</option>
                <option value="service">{t('products.service')}</option>
                <option value="part">{t('products.part')}</option>
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('products.primaryUnit')}</label>
                <input
                  className="input mt-1"
                  name="primaryUnit"
                  list={unitListId}
                  value={form.primaryUnit}
                  onChange={handleChange}
                  placeholder={t('products.unitPlaceholder')}
                />
              </div>
              <div>
                <label className="label">{t('products.secondaryUnit')}</label>
                <input
                  className="input mt-1"
                  name="secondaryUnit"
                  list={unitListId}
                  value={form.secondaryUnit}
                  onChange={handleChange}
                  placeholder={t('products.unitPlaceholder')}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('products.conversionRate')}</label>
                <input
                  className="input mt-1"
                  name="conversionRate"
                  type="number"
                  step="0.0001"
                  value={form.conversionRate}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-slate-500">{t('products.conversionHint')}</p>
              </div>
              <div>
                <label className="label">{t('products.secondaryPrice')}</label>
                <input
                  className="input mt-1"
                  name="secondarySalePrice"
                  type="number"
                  step="0.01"
                  value={form.secondarySalePrice}
                  onChange={handleChange}
                />
                <p className="mt-1 text-xs text-slate-500">{t('products.secondaryPriceHint')}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('inventory.openingStock')}</label>
                <input
                  className="input mt-1"
                  name="openingStock"
                  type="number"
                  step="0.01"
                  value={form.openingStock}
                  onChange={handleChange}
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <input
                  id="lowStockAlert"
                  type="checkbox"
                  name="lowStockAlert"
                  checked={form.lowStockAlert}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                <label htmlFor="lowStockAlert" className="text-sm text-slate-600 dark:text-slate-300">
                  {t('inventory.lowStockAlert')}
                </label>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('products.purchasePrice')}</label>
                <input
                  className="input mt-1"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={handleChange}
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
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('inventory.mrpPrice')}</label>
                <input
                  className="input mt-1"
                  name="mrpPrice"
                  type="number"
                  step="0.01"
                  value={form.mrpPrice}
                  onChange={handleChange}
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
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="label">{t('inventory.minWholesaleQty')}</label>
                <input
                  className="input mt-1"
                  name="minWholesaleQuantity"
                  type="number"
                  step="0.01"
                  value={form.minWholesaleQuantity}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="label">{t('products.taxRate')}</label>
                <input
                  className="input mt-1"
                  name="taxRate"
                  type="number"
                  step="0.01"
                  value={form.taxRate}
                  onChange={handleChange}
                />
              </div>
            </div>
            {status.message ? <Notice title={status.message} tone={status.type} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={closeDialog}>
                {t('common.close')}
              </button>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? t('products.saving') : t('products.saveProduct')}
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleBulkSubmit}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {t('products.rowsHint')}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" type="button" onClick={addBulkRow}>
                  {t('products.addRow')}
                </button>
                <button className="btn-secondary" type="button" onClick={() => setBulkRows([makeEmptyProduct()])}>
                  {t('products.resetRows')}
                </button>
              </div>
            </div>
            <div>
              <label className="label">{t('products.pasteRows')}</label>
              <textarea
                className="input mt-1 min-h-[120px]"
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder="name,companyName,sku,goods,10,box,piece,3,100,80,0,120,90,5,true,13"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn-secondary" type="button" onClick={importBulkRows}>
                  {t('products.importRows')}
                </button>
                <button className="btn-ghost" type="button" onClick={() => setBulkText('')}>
                  {t('products.clearPaste')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 text-left">#</th>
                    <th className="py-2 text-left">{t('products.name')}</th>
                    <th className="py-2 text-left">{t('products.company')}</th>
                    <th className="py-2 text-left">{t('products.sku')}</th>
                    <th className="py-2 text-left">{t('products.type')}</th>
                    <th className="py-2 text-right">{t('inventory.openingStock')}</th>
                    <th className="py-2 text-left">{t('products.primaryUnit')}</th>
                    <th className="py-2 text-left">{t('products.secondaryUnit')}</th>
                    <th className="py-2 text-left">{t('products.conversionRate')}</th>
                    <th className="py-2 text-right">{t('products.purchasePrice')}</th>
                    <th className="py-2 text-right">{t('products.salePrice')}</th>
                    <th className="py-2 text-right">{t('products.secondaryPrice')}</th>
                    <th className="py-2 text-right">{t('inventory.mrpPrice')}</th>
                    <th className="py-2 text-right">{t('inventory.wholesalePrice')}</th>
                    <th className="py-2 text-right">{t('inventory.minWholesaleQty')}</th>
                    <th className="py-2 text-left">{t('inventory.lowStockAlert')}</th>
                    <th className="py-2 text-right">{t('products.taxRate')}</th>
                    <th className="py-2 text-right">{t('products.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="py-3 text-slate-500">
                        {t('products.noRows')}
                      </td>
                    </tr>
                  ) : (
                    bulkRows.map((row, idx) => (
                      <tr key={`bulk-row-${idx}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                        <td className="py-2 pr-2 text-xs text-slate-400">{idx + 1}</td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[160px]"
                            name="name"
                            value={row.name}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[140px]"
                            name="companyName"
                            value={row.companyName}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[120px]"
                            name="sku"
                            value={row.sku}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            className="input min-w-[120px]"
                            name="itemType"
                            value={row.itemType}
                            onChange={(event) => handleBulkChange(idx, event)}
                          >
                            <option value="goods">{t('products.goods')}</option>
                            <option value="service">{t('products.service')}</option>
                            <option value="part">{t('products.part')}</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[110px] text-right"
                            name="openingStock"
                            type="number"
                            step="0.01"
                            value={row.openingStock}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[120px]"
                            name="primaryUnit"
                            list={unitListId}
                            value={row.primaryUnit}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[120px]"
                            name="secondaryUnit"
                            list={unitListId}
                            value={row.secondaryUnit}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[110px] text-right"
                            name="conversionRate"
                            type="number"
                            step="0.0001"
                            value={row.conversionRate}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[110px] text-right"
                            name="purchasePrice"
                            type="number"
                            step="0.01"
                            value={row.purchasePrice}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[110px] text-right"
                            name="salePrice"
                            type="number"
                            step="0.01"
                            value={row.salePrice}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[110px] text-right"
                            name="secondarySalePrice"
                            type="number"
                            step="0.01"
                            value={row.secondarySalePrice}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[90px] text-right"
                            name="mrpPrice"
                            type="number"
                            step="0.01"
                            value={row.mrpPrice}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[90px] text-right"
                            name="wholesalePrice"
                            type="number"
                            step="0.01"
                            value={row.wholesalePrice}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[90px] text-right"
                            name="minWholesaleQuantity"
                            type="number"
                            step="0.01"
                            value={row.minWholesaleQuantity}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                            type="checkbox"
                            name="lowStockAlert"
                            checked={row.lowStockAlert}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            className="input min-w-[90px] text-right"
                            name="taxRate"
                            type="number"
                            step="0.01"
                            value={row.taxRate}
                            onChange={(event) => handleBulkChange(idx, event)}
                          />
                        </td>
                        <td className="py-2 text-right">
                          {bulkRows.length > 1 ? (
                            <button className="btn-ghost" type="button" onClick={() => removeBulkRow(idx)}>
                              {t('common.remove')}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {bulkStatus.message ? <Notice title={bulkStatus.message} tone={bulkStatus.type} /> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-secondary" type="button" onClick={closeDialog}>
                {t('common.close')}
              </button>
              <button className="btn-primary" type="submit" disabled={bulkLoading}>
                {bulkLoading ? t('products.saving') : t('products.saveAll')}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
