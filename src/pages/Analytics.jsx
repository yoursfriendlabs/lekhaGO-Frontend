import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';

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

function BarChart({ title, series, tone }) {
  const max = Math.max(...series.map((point) => point.value), 1);
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-500">Last {series.length} days</span>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-2 items-end">
        {series.map((point) => (
          <div key={point.key} className="flex flex-col items-center gap-2">
            <div className="h-24 w-full rounded-full bg-slate-200 dark:bg-slate-800 flex items-end">
              <div
                className={`w-full rounded-full ${tone}`}
                style={{ height: `${(point.value / max) * 100}%` }}
                title={`Rs ${point.value.toFixed(2)}`}
              />
            </div>
            <span className="text-[10px] text-slate-500">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
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
    Promise.all([api.listSales({ limit: 200 }), api.listPurchases({ limit: 200 })])
      .then(([salesData, purchaseData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
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
        const rawDate = type === 'sale' ? record.saleDate : record.purchaseDate;
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
        const invoice = (record.invoiceNo || record.id || '').toLowerCase();
        const party = type === 'sale'
          ? (record.Customer?.name || record.customerName || record.customerId || 'walk-in')
          : (record.Supplier?.name || record.supplierName || record.supplierId || '');
        return invoice.includes(search) || party.toLowerCase().includes(search);
      });
  };

  const filteredSales = useMemo(() => filterByCommon(sales, 'sale'), [sales, filters]);
  const filteredPurchases = useMemo(() => filterByCommon(purchases, 'purchase'), [purchases, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totals = useMemo(() => {
    return {
      salesTotal: filteredSales.reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0),
      purchasesTotal: filteredPurchases.reduce((sum, purchase) => sum + Number(purchase.grandTotal || 0), 0),
      receivedTotal: filteredSales.reduce((sum, sale) => {
        const grand = Number(sale.grandTotal || 0);
        const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? grand : 0) ?? 0);
        return sum + received;
      }, 0),
      paidTotal: filteredPurchases.reduce((sum, purchase) => {
        const grand = Number(purchase.grandTotal || 0);
        const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? grand : 0) ?? 0);
        return sum + paid;
      }, 0),
      salesDue: filteredSales.reduce((sum, sale) => {
        const grand = Number(sale.grandTotal || 0);
        const received = Number(sale.amountReceived ?? (sale.status === 'paid' ? grand : 0) ?? 0);
        const due = Number(sale.dueAmount ?? Math.max(grand - received, 0));
        return sum + due;
      }, 0),
      purchaseDue: filteredPurchases.reduce((sum, purchase) => {
        const grand = Number(purchase.grandTotal || 0);
        const paid = Number(purchase.amountReceived ?? (purchase.status === 'received' ? grand : 0) ?? 0);
        const due = Number(purchase.dueAmount ?? Math.max(grand - paid, 0));
        return sum + due;
      }, 0),
    };
  }, [filteredSales, filteredPurchases]);

  const salesSeries = useMemo(() => buildSeries(filteredSales, 'saleDate', 14), [filteredSales]);
  const purchaseSeries = useMemo(() => buildSeries(filteredPurchases, 'purchaseDate', 14), [filteredPurchases]);
  const tableRows = useMemo(() => {
    return [
      ...filteredSales.map((sale) => ({
        key: `sale-${sale.id}`,
        type: 'Sale',
        invoice: sale.invoiceNo || sale.id.slice(0, 6),
        date: sale.saleDate,
        party: sale.Customer?.name || sale.customerName || sale.customerId || 'Walk-in',
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
        party: purchase.Supplier?.name || purchase.supplierName || purchase.supplierId || '—',
        total: Number(purchase.grandTotal || 0),
        paid: Number(purchase.amountReceived ?? (purchase.status === 'received' ? purchase.grandTotal : 0) ?? 0),
        due: Number(
          purchase.dueAmount ?? Math.max(Number(purchase.grandTotal || 0) - Number(purchase.amountReceived || 0), 0)
        ),
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [filteredSales, filteredPurchases]);
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase text-slate-400">Revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Rs {totals.salesTotal.toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-500">Received: Rs {totals.receivedTotal.toFixed(2)}</p>
          <p className="text-sm text-slate-500">Due: Rs {totals.salesDue.toFixed(2)}</p>
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
            Rs {(totals.salesTotal - totals.purchasesTotal).toFixed(2)}
          </p>
          <p className="mt-2 text-sm text-slate-500">Cash flow: Rs {(totals.receivedTotal - totals.paidTotal).toFixed(2)}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart title="Sales trend" series={salesSeries} tone="bg-emerald-300 dark:bg-ocean" />
        <BarChart title="Purchase trend" series={purchaseSeries} tone="bg-amber-300 dark:bg-amber-400" />
      </div>
      <div className="card">
        <h3 className="font-serif text-2xl text-slate-900 dark:text-white">Filtered transactions</h3>
        <div className="mt-4 overflow-x-auto">
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
