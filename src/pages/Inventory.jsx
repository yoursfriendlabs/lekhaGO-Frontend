import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';

export default function Inventory() {
  const { t } = useI18n();
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [locationForm, setLocationForm] = useState({ name: '', type: 'store' });
  const [batchForm, setBatchForm] = useState({
    productId: '',
    locationId: '',
    batchNumber: '',
    mfgDate: '',
    expiryDate: '',
    quantityOnHand: '0',
  });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => null);
    api.listLocations().then(setLocations).catch(() => null);
    api.inventorySummary().then(setInventoryRows).catch(() => null);
  }, []);

  const handleLocationSubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await api.createLocation(locationForm);
      setLocations((prev) => [data, ...prev]);
      setStatus({ type: 'success', message: t('inventory.messages.locationCreated', { id: data.id }) });
      setLocationForm({ name: '', type: 'store' });
      api.listLocations().then(setLocations).catch(() => null);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleBatchSubmit = async (event) => {
    event.preventDefault();
    try {
      await api.createBatch({
        ...batchForm,
        quantityOnHand: Number(batchForm.quantityOnHand),
      });
      setStatus({ type: 'success', message: t('inventory.messages.batchCreated') });
      setBatchForm({
        productId: '',
        locationId: '',
        batchNumber: '',
        mfgDate: '',
        expiryDate: '',
        quantityOnHand: '0',
      });
      api.inventorySummary().then(setInventoryRows).catch(() => null);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  };

  const handleLocationChange = (event) => {
    const { name, value } = event.target;
    setLocationForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBatchChange = (event) => {
    const { name, value } = event.target;
    setBatchForm((prev) => ({ ...prev, [name]: value }));
  };

  const totalRows = inventoryRows.length;
  const pagedRows = inventoryRows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
      />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('inventory.help')}
      </p>
      {status.message ? <Notice title={status.message} tone={status.type} /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card space-y-4" onSubmit={handleLocationSubmit}>
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('inventory.addLocation')}</h3>
          <div>
            <label className="label">{t('inventory.locationName')}</label>
            <input className="input mt-1" name="name" value={locationForm.name} onChange={handleLocationChange} required />
            <p className="mt-1 text-xs text-slate-500">{t('inventory.locationExample')}</p>
          </div>
          <div>
            <label className="label">{t('inventory.locationType')}</label>
            <select className="input mt-1" name="type" value={locationForm.type} onChange={handleLocationChange}>
              <option value="store">{t('inventory.typeStore')}</option>
              <option value="warehouse">{t('inventory.typeWarehouse')}</option>
              <option value="vehicle">{t('inventory.typeVehicle')}</option>
            </select>
          </div>
          <button className="btn-primary" type="submit">{t('inventory.createLocation')}</button>
          {locations.length > 0 ? (
            <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('inventory.locations')}: {locations.slice(0, 3).map((loc) => loc.name).join(', ')}
            </div>
          ) : null}
        </form>
        <form className="card space-y-4" onSubmit={handleBatchSubmit}>
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('inventory.addBatch')}</h3>
          <div>
            <label className="label">{t('inventory.selectProduct')}</label>
            <select className="input mt-1" name="productId" value={batchForm.productId} onChange={handleBatchChange} required>
              <option value="">{t('inventory.selectProduct')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.primaryUnit ? ` · ${product.primaryUnit}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('inventory.location')}</label>
            <select className="input mt-1" name="locationId" value={batchForm.locationId} onChange={handleBatchChange}>
              <option value="">{t('inventory.location')}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} ({location.type})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('inventory.batchNumber')}</label>
              <input className="input mt-1" name="batchNumber" value={batchForm.batchNumber} onChange={handleBatchChange} />
            </div>
            <div>
              <label className="label">{t('inventory.quantityOnHand')}</label>
              <input
                className="input mt-1"
                name="quantityOnHand"
                type="number"
                step="0.001"
                value={batchForm.quantityOnHand}
                onChange={handleBatchChange}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('inventory.mfgDate')}</label>
              <input className="input mt-1" name="mfgDate" type="date" value={batchForm.mfgDate} onChange={handleBatchChange} />
            </div>
            <div>
              <label className="label">{t('inventory.expiryDate')}</label>
              <input
                className="input mt-1"
                name="expiryDate"
                type="date"
                value={batchForm.expiryDate}
                onChange={handleBatchChange}
              />
            </div>
          </div>
          <button className="btn-primary" type="submit">{t('inventory.addBatch')}</button>
        </form>
      </div>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('inventory.inventorySummary')}</h3>
          <button className="btn-ghost" type="button" onClick={() => api.inventorySummary().then(setInventoryRows)}>
            {t('inventory.refresh')}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('products.name')}</th>
                <th className="py-2 text-left">{t('products.sku')}</th>
                <th className="py-2 text-left">{t('products.type')}</th>
                <th className="py-2 text-left">{t('products.primaryUnit')}</th>
                <th className="py-2 text-right">{t('inventory.quantity')}</th>
                <th className="py-2 text-right">{t('products.purchasePrice')}</th>
                <th className="py-2 text-right">{t('products.salePrice')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr><td colSpan={7} className="py-3 text-slate-500">{t('inventory.noInventory')}</td></tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.productId} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.sku || 'n/a'}</td>
                    <td className="py-2 capitalize">
                      {row.itemType === 'service'
                        ? t('products.service')
                        : row.itemType === 'part'
                          ? t('products.part')
                          : t('products.goods')}
                    </td>
                    <td className="py-2">{row.primaryUnit || '—'}</td>
                    <td className="py-2 text-right">{Number(row.quantityOnHand || 0).toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(row.purchasePrice || 0).toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(row.salePrice || 0).toFixed(2) })}
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
          total={totalRows}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
