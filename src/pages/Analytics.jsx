import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';
import BarGraph from '../components/BarGraph';
import PieChart from '../components/PieChart';

function toDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildSeries(items, dateKey, days = 14) {
  const points = Array.from({ length: days }).map((_, idx) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - idx));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: 0,
    };
  });
  const map = Object.fromEntries(points.map((point) => [point.key, point]));
  items.forEach((item) => {
    const raw = item[dateKey] || item.createdAt;
    if (!raw) return;
    const key = new Date(raw).toISOString().slice(0, 10);
    if (map[key]) map[key].value += Number(item.grandTotal || 0);
  });
  return points;
}



export default function Analytics() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [services, setServices] = useState([]);
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    search: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    Promise.all([api.listSales({ limit: 200 }), api.listPurchases({ limit: 200 }), api.listServices({ limit: 200 })])
      .then(([salesData, purchaseData, serviceData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
        setServices(serviceData || []);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const filterByCommon = (records, type) => {
    const fromDate = toDateValue(filters.fromDate);
    const toDate = toDateValue(filters.toDate);
    const search = filters.search.trim().toLowerCase();

    return records
      .filter((record) => (filters.type === 'all' ? true : filters.type === type))
      .filter((record) => (filters.status === 'all' ? true : record.status === filters.status))
      .filter((record) => {
        if (!fromDate && !toDate) return true;
        const rawDate = type === 'sale' ? record.saleDate
          : type === 'purchase' ? record.purchaseDate
          : (record.createdAt || record.deliveryDate);
        const recordDate = toDateValue(rawDate);
        if (!recordDate) return false;
        if (fromDate && recordDate < fromDate) return false;
        if (toDate) {
          const dayEnd = new Date(toDate);
          dayEnd.setHours(23, 59, 59, 999);
          if (recordDate > dayEnd) return false;
        }
        return true;
      })
      .filter((record) => {
        if (!search) return true;
        const invoice = (record.invoiceNo || record.orderNo || record.id || '').toLowerCase();
        const party = type === 'sale'
          ? (record.partyName || record.customerName || record.Customer?.name || record.partyId || record.customerId || 'walk-in')
          : type === 'purchase'
          ? (record.partyName || record.supplierName || record.Party?.name || record.partyId || record.supplierId || '')
          : (record.partyName || record.Party?.name || record.partyId || '');
        return invoice.includes(search) || party.toLowerCase().includes(search);
      });
  };

  const filteredSales = useMemo(() => filterByCommon(sales, 'sale'), [sales, filters]);
  const filteredPurchases = useMemo(() => filterByCommon(purchases, 'purchase'), [purchases, filters]);
  const filteredServices = useMemo(() => filterByCommon(services, 'service'), [services, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totals = useMemo(() => {
    const salesTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0);
    const servicesTotal = filteredServices.reduce((sum, svc) => sum + Number(svc.grandTotal || 0), 0);
    const purchasesTotal = filteredPurchases.reduce((sum, purchase) => sum + Number(purchase.grandTotal || 0), 0);
    const receivedTotal = filteredSales.reduce((sum, sale) => {
      const grand = Number(sale.grandTotal || 0);
      const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? grand : 0) ?? 0);
      return sum + received;
    }, 0);
    const serviceReceivedTotal = filteredServices.reduce((sum, svc) => sum + Number(svc.receivedTotal || 0), 0);
    const paidTotal = filteredPurchases.reduce((sum, purchase) => {
      const grand = Number(purchase.grandTotal || 0);
      const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? grand : 0) ?? 0);
      return sum + paid;
    }, 0);
    const salesDue = filteredSales.reduce((sum, sale) => {
      const grand = Number(sale.grandTotal || 0);
      const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? grand : 0) ?? 0);
      const due = Number(sale.dueAmount ?? Math.max(grand - received, 0));
      return sum + due;
    }, 0);
    const serviceDue = filteredServices.reduce((sum, svc) => {
      return sum + Math.max(Number(svc.grandTotal || 0) - Number(svc.receivedTotal || 0), 0);
    }, 0);
    const purchaseDue = filteredPurchases.reduce((sum, purchase) => {
      const grand = Number(purchase.grandTotal || 0);
      const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? grand : 0) ?? 0);
      const due = Number(purchase.dueAmount ?? Math.max(grand - paid, 0));
      return sum + due;
    }, 0);
    return { salesTotal, servicesTotal, purchasesTotal, receivedTotal, serviceReceivedTotal, paidTotal, salesDue, serviceDue, purchaseDue };
  }, [filteredSales, filteredPurchases, filteredServices]);

  const salesSeries = useMemo(() => buildSeries(filteredSales, 'saleDate', 14), [filteredSales]);
  const purchaseSeries = useMemo(() => buildSeries(filteredPurchases, 'purchaseDate', 14), [filteredPurchases]);
  const servicesSeries = useMemo(() => buildSeries(filteredServices, 'createdAt', 14), [filteredServices]);
  const tableRows = useMemo(() => {
    return [
      ...filteredSales.map((sale) => ({
        key: `sale-${sale.id}`,
        type: 'Sale',
        invoice: sale.invoiceNo || sale.id.slice(0, 6),
        date: sale.saleDate,
        party: sale.partyName || sale.customerName || sale.Customer?.name || sale.partyId || sale.customerId || 'Walk-in',
        total: Number(sale.grandTotal || 0),
        paid: Number(sale.amountReceived ?? (sale.status === 'paid' ? sale.grandTotal : 0) ?? 0),
        due: Number(
          sale.dueAmount ?? Math.max(Number(sale.grandTotal || 0) - Number(sale.amountReceived || 0), 0)
        ),
      })),
      ...filteredPurchases.map((purchase) => ({
        key: `purchase-${purchase.id}`,
        type: 'Purchase',
        invoice: purchase.invoiceNo || purchase.id.slice(0, 6),
        date: purchase.purchaseDate,
        party: purchase.partyName || purchase.supplierName || purchase.Party?.name || purchase.partyId || purchase.supplierId || '—',
        total: Number(purchase.grandTotal || 0),
        paid: Number(purchase.amountReceived ?? (purchase.status === 'received' ? purchase.grandTotal : 0) ?? 0),
        due: Number(
          purchase.dueAmount ?? Math.max(Number(purchase.grandTotal || 0) - Number(purchase.amountReceived || 0), 0)
        ),
      })),
      ...filteredServices.map((svc) => ({
        key: `service-${svc.id}`,
        type: 'Service',
        invoice: svc.orderNo || svc.id.slice(0, 6),
        date: svc.createdAt,
        party: svc.partyName || svc.Party?.name || svc.partyId || '—',
        total: Number(svc.grandTotal || 0),
        paid: Number(svc.receivedTotal || 0),
        due: Math.max(Number(svc.grandTotal || 0) - Number(svc.receivedTotal || 0), 0),
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [filteredSales, filteredPurchases, filteredServices]);
  const totalRows = tableRows.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return tableRows.slice(start, start + pageSize);
  }, [page, pageSize, tableRows]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Filter sales and purchases to understand cash flow, due amounts, and trends."
      />
      {status ? <Notice title={status} tone="error" /> : null}
      <div className="card space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input mt-1"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input mt-1"
              name="toDate"
              value={filters.toDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input mt-1" name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="all">All</option>
              <option value="sale">Sales</option>
              <option value="purchase">Purchases</option>
              <option value="service">Services</option>
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input mt-1" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="all">All</option>
              <option value="paid">Paid (sales)</option>
              <option value="unpaid">Unpaid (sales)</option>
              <option value="received">Received (purchases)</option>
              <option value="ordered">Ordered (purchases)</option>
              <option value="open">Open (services)</option>
              <option value="in_progress">In Progress (services)</option>
              <option value="closed">Closed (services)</option>
            </select>
          </div>
          <div className="md:col-span-4">
            <label className="label">Search</label>
            <input
              className="input mt-1"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder="Invoice number, customer, or supplier"
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Sales Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Rs {totals.salesTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-500">Received: Rs {totals.receivedTotal.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Due: Rs {totals.salesDue.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Services Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Rs {totals.servicesTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-500">Received: Rs {totals.serviceReceivedTotal.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Due: Rs {totals.serviceDue.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Purchases</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Rs {totals.purchasesTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-500">Paid: Rs {totals.paidTotal.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Due: Rs {totals.purchaseDue.toFixed(2)}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Net</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            Rs {(totals.salesTotal + totals.servicesTotal - totals.purchasesTotal).toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-slate-500">Cash flow: Rs {(totals.receivedTotal + totals.serviceReceivedTotal - totals.paidTotal).toFixed(2)}</p>
        </div>
      </div>
      {/* Row 1: Sales & Services trends */}
      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title="Sales trend"
          data={salesSeries}
          dataKey="value"
          nameKey="label"
          color="#10b981"
        />
        <BarGraph
          title="Services trend"
          data={servicesSeries}
          dataKey="value"
          nameKey="label"
          color="#3b82f6"
        />
      </div>

      {/* Row 2: Purchase trend & Overall trend pie chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <BarGraph
          title="Purchase trend"
          data={purchaseSeries}
          dataKey="value"
          nameKey="label"
          color="#f59e0b"
        />
        <div className="card">
          <h3 className="font-serif text-xl text-slate-900 dark:text-white mb-4">Overall trend</h3>
          <div className="h-[350px]">
            <PieChart
              data={[
                { name: 'Sales', value: totals.salesTotal },
                { name: 'Services', value: totals.servicesTotal },
                { name: 'Purchases', value: totals.purchasesTotal },
              ]}
              height={350}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-serif text-2xl text-slate-900 dark:text-white">Filtered transactions</h3>
        {/* Mobile card view */}
        <div className="mt-4 md:hidden space-y-3">
          {pagedRows.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No transactions found.</p>
          ) : (
            pagedRows.map((row) => (
              <div key={row.key} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        row.type === 'sale' ? 'bg-emerald-100 text-emerald-700' :
                        row.type === 'purchase' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{row.type}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.invoice}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{row.date}</p>
                    {row.party && <p className="text-xs text-slate-500 truncate">{row.party}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Rs {row.total.toFixed(2)}</p>
                    {row.due > 0 && <p className="text-xs text-rose-600 dark:text-rose-300">Rs {row.due.toFixed(2)} due</p>}
                  </div>
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
                <th className="py-2 text-left">Type</th>
                <th className="py-2 text-left">Invoice</th>
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Party</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Paid/Received</th>
                <th className="py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-3 text-slate-500">No transactions found.</td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.key} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{row.type}</td>
                    <td className="py-2">{row.invoice}</td>
                    <td className="py-2">{row.date}</td>
                    <td className="py-2">{row.party}</td>
                    <td className="py-2 text-right">Rs {row.total.toFixed(2)}</td>
                    <td className="py-2 text-right">Rs {row.paid.toFixed(2)}</td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-300">Rs {row.due.toFixed(2)}</td>
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
