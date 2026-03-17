import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n.jsx';
import { Download, Printer } from 'lucide-react';

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

function buildRange(period) {
  const now = new Date();
  if (period === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
  if (period === 'year') {
    return { from: new Date(now.getFullYear(), 0, 1), to: now };
  }
  return { from: null, to: null };
}

export default function Ledger() {
  const { t } = useI18n();
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [parties, setParties] = useState([]);
  const [status, setStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');
  const [period, setPeriod] = useState('month');
  const [pdfWithItem, setPdfWithItem] = useState(false);

  useEffect(() => {
    Promise.all([
      api.listSales({ limit: 200 }),
      api.listPurchases({ limit: 200 }),
      api.listParties(),
    ])
      .then(([salesData, purchaseData, partyData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
        setParties(partyData || []);
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
        partyId: sale.customerId || sale.Customer?.id || null,
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
        partyId: purchase.supplierId || purchase.Supplier?.id || null,
        grandTotal,
        cashAmount: totalPaid,
        dueAmount,
      };
    });
    return [...normalizedSales, ...normalizedPurchases];
  }, [sales, purchases, t]);

  const { from, to } = useMemo(() => buildRange(period), [period]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => (selectedPartyId === 'all' ? true : tx.partyId === selectedPartyId))
      .filter((tx) => {
        if (!from && !to) return true;
        const txDate = toDateValue(tx.date);
        if (!txDate) return false;
        if (from && txDate < from) return false;
        if (to) {
          const dayEnd = new Date(to);
          dayEnd.setHours(23, 59, 59, 999);
          if (txDate > dayEnd) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [transactions, selectedPartyId, from, to]);

  const summary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'purchase') {
        totalDebit += tx.grandTotal;
      } else {
        totalCredit += tx.grandTotal;
      }
    });
    const netBalance = totalCredit - totalDebit;
    return { totalDebit, totalCredit, netBalance, entries: filteredTransactions.length };
  }, [filteredTransactions]);

  const statementRows = useMemo(() => {
    let runningBalance = 0;
    return filteredTransactions.map((tx) => {
      const debit = tx.type === 'purchase' ? tx.grandTotal : 0;
      const credit = tx.type === 'sale' ? tx.grandTotal : 0;
      runningBalance += credit - debit;
      return {
        ...tx,
        debit,
        credit,
        runningBalance,
        label: tx.type === 'sale'
          ? `${t('ledger.salesInvoice')} ${tx.invoiceNo}`
          : `${t('ledger.purchaseInvoice')} ${tx.invoiceNo}`,
      };
    });
  }, [filteredTransactions, t]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('ledger.statementTitle')}
        subtitle={t('ledger.statementSubtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button">
              <Printer size={16} /> {t('ledger.printPdf')}
            </button>
            <button className="btn-primary" type="button">
              <Download size={16} /> {t('ledger.downloadExcel')}
            </button>
          </div>
        )}
      />
      {status ? <Notice title={status} tone="error" /> : null}

      <div className="card space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input min-w-[200px]"
            value={selectedPartyId}
            onChange={(event) => setSelectedPartyId(event.target.value)}
          >
            <option value="all">{t('ledger.allParties')}</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>{party.name}</option>
            ))}
          </select>
          <select
            className="input min-w-[160px]"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="month">{t('ledger.thisMonth')}</option>
            <option value="year">{t('ledger.thisYear')}</option>
            <option value="all">{t('ledger.allTime')}</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={pdfWithItem}
              onChange={(event) => setPdfWithItem(event.target.checked)}
            />
            {t('ledger.pdfWithItem')}
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs uppercase text-slate-400">{t('ledger.netBalance')}</p>
            <p className="mt-2 text-lg font-semibold text-emerald-600">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.netBalance.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs uppercase text-slate-400">{t('ledger.totalDebit')}</p>
            <p className="mt-2 text-lg font-semibold">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalDebit.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs uppercase text-slate-400">{t('ledger.totalCredit')}</p>
            <p className="mt-2 text-lg font-semibold">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalCredit.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs uppercase text-slate-400">{t('ledger.totalEntries')}</p>
            <p className="mt-2 text-lg font-semibold">{summary.entries}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 text-left">{t('common.date')}</th>
                <th className="py-2 text-left">{t('ledger.transaction')}</th>
                <th className="py-2 text-right">{t('ledger.debit')}</th>
                <th className="py-2 text-right">{t('ledger.credit')}</th>
                <th className="py-2 text-right">{t('ledger.runningBalance')}</th>
              </tr>
            </thead>
            <tbody>
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-slate-500">{t('ledger.noTransactions')}</td>
                </tr>
              ) : (
                statementRows.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="border-t border-slate-200/70">
                    <td className="py-2">{formatDate(row.date)}</td>
                    <td className="py-2">{row.label}</td>
                    <td className="py-2 text-right">
                      {row.debit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) }) : '--'}
                    </td>
                    <td className="py-2 text-right">
                      {row.credit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) }) : '--'}
                    </td>
                    <td className={`py-2 text-right ${row.runningBalance < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {t('currency.formatted', { symbol: t('currency.symbol'), amount: row.runningBalance.toFixed(2) })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
