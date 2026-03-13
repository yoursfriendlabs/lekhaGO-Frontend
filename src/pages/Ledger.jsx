import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import Pagination from '../components/Pagination';
import { useI18n } from '../lib/i18n.jsx';

function toDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function buildMonthRange(monthValue) {
  if (!monthValue) return { from: '', to: '' };
  const [year, month] = monthValue.split('-').map(Number);
  if (!year || !month) return { from: '', to: '' };
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function Ledger() {
  const { t } = useI18n();
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    fromDate: '',
    toDate: '',
    month: '',
    search: '',
    minAmount: '',
    maxAmount: '',
  });
  const [openingBalance, setOpeningBalance] = useState('0');
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

  const transactions = useMemo(() => {
    const normalizedSales = sales.map((sale) => {
      const grandTotal = Number(sale.grandTotal || 0);
      const totalReceived = Number(
        sale.amountReceived ?? (sale.status === 'paid' ? grandTotal : 0) ?? 0
      );
      const dueAmount = Number(sale.dueAmount ?? Math.max(grandTotal - totalReceived, 0));
      return {
        id: sale.id,
        type: 'sale',
        invoiceNo: sale.invoiceNo || sale.id.slice(0, 6),
        date: sale.saleDate,
        status: sale.status || 'paid',
        party: sale.Customer?.name || sale.customerName || sale.customerId || t('sales.walkIn'),
        grandTotal,
        cashAmount: totalReceived,
        dueAmount,
      };
    });
    const normalizedPurchases = purchases.map((purchase) => {
      const grandTotal = Number(purchase.grandTotal || 0);
      const totalPaid = Number(
        purchase.amountReceived ?? (purchase.status === 'received' ? grandTotal : 0) ?? 0
      );
      const dueAmount = Number(purchase.dueAmount ?? Math.max(grandTotal - totalPaid, 0));
      return {
        id: purchase.id,
        type: 'purchase',
        invoiceNo: purchase.invoiceNo || purchase.id.slice(0, 6),
        date: purchase.purchaseDate,
        status: purchase.status || 'received',
        party: purchase.Supplier?.name || purchase.supplierName || purchase.supplierId || '—',
        grandTotal,
        cashAmount: totalPaid,
        dueAmount,
      };
    });
    return [...normalizedSales, ...normalizedPurchases];
  }, [sales, purchases, t]);

  const filteredTransactions = useMemo(() => {
    const fromDate = toDateValue(filters.fromDate);
    const toDate = toDateValue(filters.toDate);
    const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
    const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;
    const search = filters.search.trim().toLowerCase();

    return transactions
      .filter((tx) => (filters.type === 'all' ? true : tx.type === filters.type))
      .filter((tx) => (filters.status === 'all' ? true : tx.status === filters.status))
      .filter((tx) => {
        if (!fromDate && !toDate) return true;
        const txDate = toDateValue(tx.date);
        if (!txDate) return false;
        if (fromDate && txDate < fromDate) return false;
        if (toDate) {
          const dayEnd = new Date(toDate);
          dayEnd.setHours(23, 59, 59, 999);
          if (txDate > dayEnd) return false;
        }
        return true;
      })
      .filter((tx) => (minAmount === null ? true : tx.grandTotal >= minAmount))
      .filter((tx) => (maxAmount === null ? true : tx.grandTotal <= maxAmount))
      .filter((tx) => {
        if (!search) return true;
        return (
          tx.invoiceNo.toLowerCase().includes(search) ||
          tx.party.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [filters, transactions]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const totals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'sale') {
          acc.salesTotal += tx.grandTotal;
          acc.receivedTotal += tx.cashAmount;
          acc.salesDue += tx.dueAmount;
        } else {
          acc.purchasesTotal += tx.grandTotal;
          acc.paidTotal += tx.cashAmount;
          acc.purchaseDue += tx.dueAmount;
        }
        return acc;
      },
      { salesTotal: 0, purchasesTotal: 0, receivedTotal: 0, paidTotal: 0, salesDue: 0, purchaseDue: 0 }
    );
  }, [filteredTransactions]);

  const opening = Number(openingBalance || 0);
  const closing = opening + totals.receivedTotal - totals.paidTotal;

  const totalRows = filteredTransactions.length;
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, page, pageSize]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleMonthChange = (event) => {
    const value = event.target.value;
    const range = buildMonthRange(value);
    setFilters((prev) => ({ ...prev, month: value, fromDate: range.from, toDate: range.to }));
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('ledger.title')}
        subtitle={t('ledger.subtitle')}
      />
      {status ? <Notice title={status} tone="error" /> : null}
      <div className="card space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">{t('ledger.month')}</label>
            <input
              className="input mt-1"
              type="month"
              name="month"
              value={filters.month}
              onChange={handleMonthChange}
            />
          </div>
          <div>
            <label className="label">{t('ledger.from')}</label>
            <input
              className="input mt-1"
              type="date"
              name="fromDate"
              value={filters.fromDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('ledger.to')}</label>
            <input
              className="input mt-1"
              type="date"
              name="toDate"
              value={filters.toDate}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('ledger.type')}</label>
            <select className="input mt-1" name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="all">{t('ledger.all')}</option>
              <option value="sale">{t('ledger.sales')}</option>
              <option value="purchase">{t('ledger.purchases')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('ledger.status')}</label>
            <select className="input mt-1" name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="all">{t('ledger.all')}</option>
              <option value="paid">{t('sales.paid')}</option>
              <option value="unpaid">{t('sales.due')}</option>
              <option value="received">{t('purchases.received')}</option>
              <option value="ordered">{t('purchases.ordered')}</option>
            </select>
          </div>
          <div>
            <label className="label">{t('ledger.search')}</label>
            <input
              className="input mt-1"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              placeholder={t('ledger.search')}
            />
          </div>
          <div>
            <label className="label">{t('ledger.minAmount')}</label>
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              name="minAmount"
              value={filters.minAmount}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('ledger.maxAmount')}</label>
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              name="maxAmount"
              value={filters.maxAmount}
              onChange={handleFilterChange}
            />
          </div>
          <div>
            <label className="label">{t('ledger.openingBalance')}</label>
            <input
              className="input mt-1"
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="text-xs uppercase text-slate-400">{t('dashboard.cashOverview')}</p>
            <p className="mt-2">
              {t('ledger.totalReceived')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.receivedTotal.toFixed(2) })}
            </p>
            <p>
              {t('ledger.totalPaid')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.paidTotal.toFixed(2) })}
            </p>
            <p className="mt-2 font-semibold">
              {t('ledger.closingBalance')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: closing.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="text-xs uppercase text-slate-400">{t('ledger.sales')}</p>
            <p className="mt-2">
              {t('ledger.totalSales')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.salesTotal.toFixed(2) })}
            </p>
            <p>
              {t('ledger.salesDue')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.salesDue.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-300">
            <p className="text-xs uppercase text-slate-400">{t('ledger.purchases')}</p>
            <p className="mt-2">
              {t('ledger.totalPurchases')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.purchasesTotal.toFixed(2) })}
            </p>
            <p>
              {t('ledger.purchaseDue')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: totals.purchaseDue.toFixed(2) })}
            </p>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-2xl text-slate-900 dark:text-white">{t('ledger.title')}</h3>
          <span className="text-xs text-slate-500">
            {filters.fromDate || filters.toDate
              ? `${filters.fromDate || t('ledger.all')} → ${filters.toDate || t('ledger.all')}`
              : t('ledger.all')}
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('common.date')}</th>
                <th className="py-2 text-left">{t('ledger.type')}</th>
                <th className="py-2 text-left">{t('common.invoice')}</th>
                <th className="py-2 text-left">{t('ledger.party')}</th>
                <th className="py-2 text-right">{t('common.total')}</th>
                <th className="py-2 text-right">{t('ledger.totalReceived')}</th>
                <th className="py-2 text-right">{t('ledger.salesDue')}</th>
                <th className="py-2 text-left">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-3 text-slate-500">
                    {t('ledger.noTransactions')}
                  </td>
                </tr>
              ) : (
                pagedRows.map((tx) => (
                  <tr key={`${tx.type}-${tx.id}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                    <td className="py-2">{formatDate(tx.date)}</td>
                    <td className="py-2 capitalize">{tx.type === 'sale' ? t('ledger.sales') : t('ledger.purchases')}</td>
                    <td className="py-2">{tx.invoiceNo}</td>
                    <td className="py-2">{tx.party}</td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.grandTotal.toFixed(2) })}
                    </td>
                    <td className="py-2 text-right">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.cashAmount.toFixed(2) })}
                    </td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-300">
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: tx.dueAmount.toFixed(2) })}
                    </td>
                    <td className="py-2 capitalize">{tx.status}</td>
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
