<<<<<<< Updated upstream
import { useEffect, useMemo, useRef, useState } from 'react';
=======
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
>>>>>>> Stashed changes
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { API_BASE, api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
<<<<<<< Updated upstream
import dayjs, { formatMaybeDate, todayISODate } from '../lib/datetime';
import { Download, Printer } from 'lucide-react';

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}
=======
import {
  getPartyBalanceMeta,
  getStatementTypeLabel,
  normalizePartyReportRows,
  normalizePartyStatementResponse,
  toAmount,
} from '../lib/partyBalances.js';
import { Download, Printer, Search } from 'lucide-react';

const STATEMENT_PAGE_SIZE = 20;
const statementTypes = ['all', 'sale', 'service', 'purchase', 'payment_in', 'payment_out', 'transaction'];
>>>>>>> Stashed changes

function formatStatementDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'MMMM,D');
}

function formatRangeDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM YYYY');
}

<<<<<<< Updated upstream
function buildRange(period) {
  const now = dayjs();
  if (period === 'month') {
    return { from: now.startOf('month'), to: now };
  }
  if (period === 'year') {
    return { from: now.startOf('year'), to: now };
  }
  return { from: null, to: null };
=======
function getStatementBadgeClass(type) {
  const classes = {
    sale: 'bg-emerald-100 text-emerald-700',
    service: 'bg-sky-100 text-sky-700',
    purchase: 'bg-amber-100 text-amber-700',
    payment_in: 'bg-teal-100 text-teal-700',
    payment_out: 'bg-indigo-100 text-indigo-700',
  };

  return classes[type] || 'bg-slate-100 text-slate-600';
}

function getStatementReference(row) {
  return row.referenceNo || row.id?.slice(0, 8) || '-';
>>>>>>> Stashed changes
}

export default function Ledger() {
  const { t } = useI18n();
<<<<<<< Updated upstream
  const { settings: biz } = useBusinessSettings();
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [services, setServices] = useState([]);
  const [parties, setParties] = useState([]);
  const [status, setStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');
  const [period, setPeriod] = useState('month');
  const printRef = useRef(null);
=======
  const [searchParams] = useSearchParams();

  const initialPartyId = searchParams.get('partyId') || '';
  const [reportQuery, setReportQuery] = useState(searchParams.get('partyName') || '');
  const [partyTypeFilter, setPartyTypeFilter] = useState('all');
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId);
  const [statementType, setStatementType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [statementData, setStatementData] = useState(() => normalizePartyStatementResponse());
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState('');
>>>>>>> Stashed changes

  useEffect(() => {
    let isActive = true;

<<<<<<< Updated upstream
  const partyNameById = useMemo(() => {
    const map = new Map();
    parties.forEach((party) => {
      const partyId = normalizeId(party?.id);
      if (!partyId) return;
      map.set(partyId, party?.name || '—');
    });
    return map;
  }, [parties]);

  const transactions = useMemo(() => {
    const normalizedSales = sales.map((sale) => {
      const grandTotal = Number(sale.grandTotal || 0);
      const totalReceived = Number(
        sale.amountReceived ?? (sale.status === 'paid' ? grandTotal : 0) ?? 0
      );
      const dueAmount = Number(sale.dueAmount ?? Math.max(grandTotal - totalReceived, 0));
      const partyId = normalizeId(sale.partyId || sale.customerId || sale.Customer?.id || null);
      const partyNameFromId = partyId ? partyNameById.get(partyId) : null;
      return {
        id: sale.id,
        type: 'sale',
        invoiceNo: sale.invoiceNo || sale.id.slice(0, 6),
        date: sale.saleDate,
        status: sale.status || 'paid',
        party: sale.partyName
          || sale.customerName
          || sale.Customer?.name
          || partyNameFromId
          || (partyId ? '—' : t('sales.walkIn')),
        partyId,
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
      const partyId = normalizeId(purchase.partyId || purchase.supplierId || purchase.Supplier?.id || null);
      const partyNameFromId = partyId ? partyNameById.get(partyId) : null;
      return {
        id: purchase.id,
        type: 'purchase',
        invoiceNo: purchase.invoiceNo || purchase.id.slice(0, 6),
        date: purchase.purchaseDate,
        status: purchase.status || 'received',
        party: purchase.partyName
          || purchase.supplierName
          || purchase.Party?.name
          || partyNameFromId
          || '—',
        partyId,
        grandTotal,
        cashAmount: totalPaid,
        dueAmount,
      };
    });
    const normalizedServices = services.map((service) => {
      const grandTotal = Number(service.grandTotal || 0);
      const receivedTotal = Number(service.receivedTotal || 0);
      const dueAmount = Math.max(grandTotal - receivedTotal, 0);
      const partyId = normalizeId(service.partyId || service.Party?.id || null);
      const partyNameFromId = partyId ? partyNameById.get(partyId) : null;
      return {
        id: service.id,
        type: 'service',
        invoiceNo: service.orderNo || service.id.slice(0, 6),
        date: service.createdAt,
        status: service.status || 'open',
        party: service.partyName
          || service.Party?.name
          || partyNameFromId
          || '—',
        partyId,
        grandTotal,
        cashAmount: receivedTotal,
        dueAmount,
      };
    });
    return [...normalizedSales, ...normalizedPurchases, ...normalizedServices];
  }, [partyNameById, purchases, sales, services, t]);
=======
    async function loadPartyReport() {
      setReportLoading(true);
      setReportError('');
>>>>>>> Stashed changes

      try {
        const data = await api.partyReport({
          ...(reportQuery.trim() ? { partyName: reportQuery.trim() } : {}),
          ...(partyTypeFilter !== 'all' ? { type: partyTypeFilter } : {}),
        });

<<<<<<< Updated upstream
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (selectedPartyId === 'all') return true;
        const txPartyId = normalizeId(tx.partyId);
        return txPartyId ? txPartyId === String(selectedPartyId) : false;
      })
      .filter((tx) => {
        if (!from && !to) return true;
        const txDate = dayjs(tx.date);
        if (!txDate.isValid()) return false;
        if (from && txDate.isBefore(from, 'day')) return false;
        if (to) {
          const dayEnd = dayjs(to).endOf('day');
          if (txDate.isAfter(dayEnd)) return false;
        }
        return true;
      })
      .sort((a, b) => dayjs(a.date || 0).valueOf() - dayjs(b.date || 0).valueOf());
  }, [transactions, selectedPartyId, from, to]);

  const summary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    filteredTransactions.forEach((tx) => {
      if (tx.type === 'purchase') {
        totalDebit += tx.grandTotal;
      } else {
        // sales and services are both credit (income)
        totalCredit += tx.grandTotal;
=======
        if (!isActive) return;
        setReportRows(normalizePartyReportRows(data));
      } catch (err) {
        if (!isActive) return;
        setReportError(err.message);
        setReportRows([]);
      } finally {
        if (isActive) setReportLoading(false);
>>>>>>> Stashed changes
      }
    }

    loadPartyReport();
    return () => {
      isActive = false;
    };
  }, [partyTypeFilter, reportQuery]);

  useEffect(() => {
    if (!reportRows.length) return;

    if (initialPartyId && reportRows.find((party) => party.id === initialPartyId)) {
      setSelectedPartyId(initialPartyId);
      return;
    }

    if (!selectedPartyId || !reportRows.find((party) => party.id === selectedPartyId)) {
      setSelectedPartyId(reportRows[0].id);
    }
  }, [initialPartyId, reportRows, selectedPartyId]);

  useEffect(() => {
    setPage(1);
  }, [selectedPartyId, statementType, from, to]);

  useEffect(() => {
    if (!selectedPartyId) {
      setStatementData(normalizePartyStatementResponse());
      setStatementError('');
      return;
    }

    let isActive = true;
    setStatementLoading(true);
    setStatementError('');
    setStatementData(normalizePartyStatementResponse());

    async function loadStatement() {
      try {
        const data = await api.partyStatement({
          partyId: selectedPartyId,
          ...(statementType !== 'all' ? { type: statementType } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          limit: STATEMENT_PAGE_SIZE,
          offset: (page - 1) * STATEMENT_PAGE_SIZE,
        });

        if (!isActive) return;
        setStatementData(normalizePartyStatementResponse(data));
      } catch (err) {
        if (!isActive) return;
        setStatementError(err.message);
      } finally {
        if (isActive) setStatementLoading(false);
      }
    }

    loadStatement();
    return () => {
      isActive = false;
    };
  }, [from, page, selectedPartyId, statementType, to]);

  const selectedParty = useMemo(() => {
    const reportParty = reportRows.find((party) => party.id === selectedPartyId) || null;
    if (!reportParty && !statementData.party) return null;
    return { ...(reportParty || {}), ...(statementData.party || {}) };
  }, [reportRows, selectedPartyId, statementData.party]);

  const selectedBalanceMeta = getPartyBalanceMeta(selectedParty?.currentAmount ?? statementData.summary.currentAmount, t);
  const totalPages = Math.max(1, Math.ceil(statementData.summary.totalRows / STATEMENT_PAGE_SIZE));

  const summaryCards = [
    { label: t('ledger.currentBalance'), value: selectedBalanceMeta.absoluteAmount, tone: selectedBalanceMeta.textClass },
    { label: t('ledger.totalSales'), value: statementData.summary.totalSales, tone: 'text-emerald-600' },
    { label: t('ledger.totalServices'), value: statementData.summary.totalServices, tone: 'text-sky-600' },
    { label: t('ledger.totalPurchases'), value: statementData.summary.totalPurchases, tone: 'text-amber-600' },
    { label: t('ledger.totalPaymentIn'), value: statementData.summary.totalPaymentIn, tone: 'text-teal-600' },
    { label: t('ledger.totalPaymentOut'), value: statementData.summary.totalPaymentOut, tone: 'text-indigo-600' },
  ];

  const selectedParty = useMemo(() => {
    if (selectedPartyId === 'all') return null;
    return parties.find((party) => String(party.id) === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const timeSpanLabel = useMemo(() => {
    if (!from && !to) return t('ledger.allTime');
    return `${t('ledger.from')}: ${formatRangeDate(from)}  ·  ${t('ledger.to')}: ${formatRangeDate(to)}`;
  }, [from, to, t]);

  const selectedPartyLabel = useMemo(() => (
    selectedPartyId === 'all' ? t('ledger.allParties') : (selectedParty?.name || t('ledger.party'))
  ), [selectedPartyId, selectedParty, t]);

  const logoSrc = useMemo(() => {
    if (!biz?.logoUrl) return null;
    return biz.logoUrl.startsWith('http') ? biz.logoUrl : `${API_BASE}${biz.logoUrl}`;
  }, [biz?.logoUrl]);

  const renderTypeBadge = (type) => {
    const map = {
      sale: { label: t('ledger.sales'), className: 'bg-emerald-100 text-emerald-700' },
      purchase: { label: t('ledger.purchases'), className: 'bg-rose-100 text-rose-700' },
      service: { label: t('services.title'), className: 'bg-blue-100 text-blue-700' },
    };
    const cfg = map[type] || { label: String(type || '—'), className: 'bg-slate-100 text-slate-600' };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  const handlePrint = () => {
    const source = printRef.current;
    if (!source) {
      window.print();
      return;
    }

    const clone = source.cloneNode(true);
    clone.classList.add('print-clone');
    // Ensure inline styles don't hide it on screen before print fires
    clone.style.cssText = '';

    const now = dayjs();
    clone.querySelectorAll('[data-printed-at]').forEach((node) => {
      node.textContent = now.format('D MMM YYYY, HH:mm');
    });
    clone.querySelectorAll('[data-printed-date]').forEach((node) => {
      node.textContent = now.format('D MMM YYYY');
    });

    document.body.appendChild(clone);

    const cleanup = () => {
      if (document.body.contains(clone)) document.body.removeChild(clone);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const handleDownloadExcel = () => {
    const rows = [
      [
        t('common.date'),
        ...(selectedPartyId === 'all' ? [t('ledger.party')] : []),
        t('ledger.transaction'),
        t('ledger.debit'),
        t('ledger.credit'),
        t('ledger.runningBalance'),
      ],
      ...statementRows.map((row) => ([
        formatStatementDate(row.date),
        ...(selectedPartyId === 'all' ? [row.party || '—'] : []),
        row.label,
        row.debit > 0 ? row.debit.toFixed(2) : '',
        row.credit > 0 ? row.credit.toFixed(2) : '',
        row.runningBalance.toFixed(2),
      ])),
    ];

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const partySlug = selectedPartyId === 'all'
      ? 'all'
      : String(selectedParty?.name || selectedPartyId).replace(/\s+/g, '-').toLowerCase();
    link.download = `ledger-${partySlug}-${period}-${todayISODate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('ledger.statementTitle')}
        subtitle={t('ledger.statementSubtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" type="button" onClick={handlePrint}>
              <Printer size={16} /> {t('ledger.printPdf')}
            </button>
            <button className="btn-primary" type="button" onClick={handleDownloadExcel}>
              <Download size={16} /> {t('ledger.downloadExcel')}
            </button>
          </div>
        )}
      />

      {reportError ? <Notice title={reportError} tone="error" /> : null}
      {statementError ? <Notice title={statementError} tone="error" /> : null}

<<<<<<< Updated upstream
      <div ref={printRef} className="space-y-6">
        {/* Print-only PDF layout (professional) */}
        <div className="hidden print:block">
          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
            {/* ── Header ── */}
            <div className="overflow-hidden rounded-t-2xl">
              <div className="h-1.5 w-full bg-primary" />
              <div className="flex items-start justify-between gap-6 px-8 pt-6 pb-6 border-b border-slate-200/70">
                <div className="flex items-start gap-4 min-w-0">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt="Logo"
                      className="h-16 w-16 shrink-0 rounded-xl border border-slate-200/70 bg-white object-contain p-1 shadow-sm"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <h1 className={`font-serif font-bold text-slate-900 leading-tight ${logoSrc ? 'text-2xl' : 'text-3xl'}`}>
                      {biz?.companyName || 'ManageMyShop'}
                    </h1>
                    {(biz?.address || biz?.phone || biz?.email || biz?.panVat) ? (
                      <div className="mt-1.5 space-y-0.5">
                        {biz?.address ? (
                          <p className="whitespace-pre-wrap text-xs leading-snug text-slate-500">
                            {biz.address}
                          </p>
                        ) : null}
                        {(biz?.phone || biz?.email) ? (
                          <p className="text-xs text-slate-500">
                            {[biz.phone, biz.email].filter(Boolean).join('  ·  ')}
                          </p>
                        ) : null}
                        {biz?.panVat ? (
                          <p className="text-xs font-semibold text-slate-600">
                            PAN / VAT No: {biz.panVat}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-600">
                    {t('ledger.statementTitle')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPartyLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">{timeSpanLabel}</p>
                  <p className="mt-2 text-xs text-slate-400" data-printed-at>{dayjs().format('D MMM YYYY, HH:mm')}</p>
                </div>
              </div>
            </div>

            {/* ── Summary ── */}
            <div className="border-b border-slate-200/70 bg-slate-50/60 px-8 py-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.netBalance')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.netBalance.toFixed(2) })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalDebit')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalDebit.toFixed(2) })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalCredit')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalCredit.toFixed(2) })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalEntries')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{summary.entries}</p>
                </div>
              </div>
            </div>

            {/* ── Table ── */}
            <div className="px-8 py-6">
              <table className="w-full text-sm text-slate-700">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th colSpan={selectedPartyId === 'all' ? 6 : 5} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="uppercase tracking-wider">
                    <th className="pb-3 text-left">{t('common.date')}</th>
                    {selectedPartyId === 'all' ? <th className="pb-3 text-left">{t('ledger.party')}</th> : null}
                    <th className="pb-3 text-left">{t('ledger.transaction')}</th>
                    <th className="pb-3 text-right">{t('ledger.debit')}</th>
                    <th className="pb-3 text-right">{t('ledger.credit')}</th>
                    <th className="pb-3 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId === 'all' ? 6 : 5} className="py-4 text-slate-400">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={`print-${row.type}-${row.id}`}>
                        <td className="py-3">{formatStatementDate(row.date)}</td>
                        {selectedPartyId === 'all' ? <td className="py-3">{row.party || '—'}</td> : null}
                        <td className="py-3">{row.label}</td>
                        <td className="py-3 text-right">
                          {row.debit > 0
                            ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) })
                            : '—'}
                        </td>
                        <td className="py-3 text-right">
                          {row.credit > 0
                            ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) })
                            : '—'}
                        </td>
                        <td className="py-3 text-right">
                          {t('currency.formatted', { symbol: t('currency.symbol'), amount: row.runningBalance.toFixed(2) })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/60 px-8 py-4">
              <p className="text-xs text-slate-400">{t('ledger.totalEntries')}: {summary.entries}</p>
              <p className="text-xs text-slate-400">
                Printed on <span data-printed-date>{dayjs().format('D MMM YYYY')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Screen layout */}
        <div className="space-y-6 print:hidden">
          <div className="card space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="input-compact w-full sm:w-auto min-w-[160px]"
                value={selectedPartyId}
                onChange={(event) => setSelectedPartyId(event.target.value)}
              >
                <option value="all">{t('ledger.allParties')}</option>
                {parties.map((party) => (
                  <option key={party.id} value={String(party.id)}>{party.name}</option>
                ))}
              </select>
              <select
                className="input-compact w-full sm:w-auto min-w-[140px]"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              >
                <option value="month">{t('ledger.thisMonth')}</option>
                <option value="year">{t('ledger.thisYear')}</option>
                <option value="all">{t('ledger.allTime')}</option>
              </select>
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
            {/* Mobile header */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 md:hidden">
              <span className="rounded-full bg-secondary-100 px-3 py-1">{selectedPartyLabel}</span>
              <span className="rounded-full bg-secondary-100 px-3 py-1">{timeSpanLabel}</span>
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {statementRows.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t('ledger.noTransactions')}</p>
              ) : (
                statementRows.map((row) => {
                  const tone =
                    row.type === 'purchase'
                      ? 'border-rose-200/70 bg-rose-50/40'
                      : row.type === 'service'
                      ? 'border-blue-200/70 bg-blue-50/40'
                      : 'border-emerald-200/70 bg-emerald-50/40';
                  return (
                    <div key={`${row.type}-${row.id}`} className={`rounded-2xl border p-4 text-sm ${tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {renderTypeBadge(row.type)}
                            <p className="text-xs text-slate-500">{formatStatementDate(row.date)}</p>
                          </div>
                          <p className="mt-1 font-semibold text-slate-800 truncate">{row.label}</p>
                          {selectedPartyId === 'all' && row.party && row.party !== '—' && (
                            <p className="text-xs text-slate-500 truncate">{row.party}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          {row.debit > 0 ? (
                            <p className="font-semibold text-rose-700">
                              -{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) })}
                            </p>
                          ) : (
                            <p className="font-semibold text-emerald-700">
                              +{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) })}
                            </p>
                          )}
                          <p className={`text-xs font-medium mt-0.5 ${row.runningBalance < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            Bal: {t('currency.formatted', { symbol: t('currency.symbol'), amount: row.runningBalance.toFixed(2) })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th colSpan={selectedPartyId === 'all' ? 6 : 5} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th className="py-2.5 pr-4 text-left">{t('common.date')}</th>
                    {selectedPartyId === 'all' ? <th className="py-2.5 pr-4 text-left">{t('ledger.party')}</th> : null}
                    <th className="py-2.5 pr-4 text-left">{t('ledger.transaction')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.debit')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.credit')}</th>
                    <th className="py-2.5 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId === 'all' ? 6 : 5} className="py-3 text-slate-500">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => {
                      const rowClass =
                        row.type === 'purchase'
                          ? 'border-t border-rose-200/60 bg-rose-50/40'
                          : row.type === 'service'
                          ? 'border-t border-blue-200/60 bg-blue-50/40'
                          : 'border-t border-emerald-200/60 bg-emerald-50/30';
                      return (
                        <tr key={`${row.type}-${row.id}`} className={rowClass}>
                          <td className="py-2.5 pr-4 font-medium text-slate-800">{formatStatementDate(row.date)}</td>
                          {selectedPartyId === 'all' ? <td className="py-2.5 pr-4 text-slate-700">{row.party || '—'}</td> : null}
                          <td className="py-2.5 pr-4 text-slate-700">
                            <div className="flex items-center gap-2">
                              {renderTypeBadge(row.type)}
                              <span className="truncate">{row.label}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-rose-700">
                            {row.debit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) }) : '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-emerald-700">
                            {row.credit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) }) : '—'}
                          </td>
                          <td className={`py-2.5 text-right font-semibold ${row.runningBalance < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: row.runningBalance.toFixed(2) })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
=======
      <div className="card space-y-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.6fr_0.6fr]">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 dark:border-slate-700/60 dark:bg-slate-900/60">
            <Search size={16} className="text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder={t('ledger.searchPlaceholder')}
              value={reportQuery}
              onChange={(event) => setReportQuery(event.target.value)}
            />
          </div>
          <select
            className="input"
            value={partyTypeFilter}
            onChange={(event) => setPartyTypeFilter(event.target.value)}
          >
            <option value="all">{t('parties.types.all')}</option>
            <option value="customer">{t('parties.types.customer')}</option>
            <option value="supplier">{t('parties.types.supplier')}</option>
          </select>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <input
            type="date"
            className="input"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {statementTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setStatementType(type)}
              className={
                statementType === type
                  ? 'rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900'
                  : 'rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }
            >
              {getStatementTypeLabel(type, t)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
              {t('parties.listTitle', { count: reportRows.length })}
            </h3>
            {reportLoading ? <span className="text-sm text-slate-400">{t('common.loading')}</span> : null}
          </div>

          <div className="space-y-2">
            {reportLoading && reportRows.length === 0 ? (
              <p className="text-sm text-slate-500">{t('common.loading')}</p>
            ) : reportRows.length === 0 ? (
              <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
            ) : (
              reportRows.map((party) => {
                const balanceMeta = getPartyBalanceMeta(party.currentAmount, t);

                return (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => setSelectedPartyId(party.id)}
                    className={
                      selectedPartyId === party.id
                        ? 'w-full rounded-2xl border border-slate-900 bg-slate-50 p-3 text-left dark:border-slate-300 dark:bg-slate-900/70'
                        : 'w-full rounded-2xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-950'
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
                        {party.name?.slice(0, 2).toUpperCase() || 'P'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{party.name}</p>
                        <p className="text-xs text-slate-500">{party.phone || t(`parties.types.${party.type || 'customer'}`)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${balanceMeta.textClass}`}>
                          {t('currency.formatted', {
                            symbol: t('currency.symbol'),
                            amount: balanceMeta.absoluteAmount.toFixed(2),
                          })}
                        </p>
                        <p className="text-xs text-slate-500">{balanceMeta.label}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card space-y-5">
            {selectedParty ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900 dark:text-white">{selectedParty.name}</p>
                    <p className="text-sm text-slate-500">
                      {[selectedParty.phone, selectedParty.email].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase text-slate-400">{selectedBalanceMeta.label}</p>
                    <p className={`text-3xl font-semibold ${selectedBalanceMeta.textClass}`}>
                      {t('currency.formatted', {
                        symbol: t('currency.symbol'),
                        amount: selectedBalanceMeta.absoluteAmount.toFixed(2),
                      })}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {summaryCards.map((card) => (
                    <div key={card.label} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/60 dark:bg-slate-900/60">
                      <p className="text-xs uppercase text-slate-400">{card.label}</p>
                      <p className={`mt-2 text-lg font-semibold ${card.tone}`}>
                        {t('currency.formatted', {
                          symbol: t('currency.symbol'),
                          amount: toAmount(card.value).toFixed(2),
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">{t('parties.noParties')}</p>
            )}
          </div>

          <div className="card">
            {statementLoading ? (
              <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
            ) : statementData.rows.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">{t('ledger.noTransactions')}</p>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {statementData.rows.map((row) => (
                    <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatementBadgeClass(row.type)}`}>
                              {getStatementTypeLabel(row.type, t)}
                            </span>
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">
                              {getStatementReference(row)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(row.date || row.createdAt)}</p>
                          {row.note ? <p className="mt-1 text-xs text-slate-500">{row.note}</p> : null}
                        </div>
                        <div className="text-right text-xs">
                          {(row.type === 'payment_in' || row.type === 'payment_out') ? (
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.amount).toFixed(2) })}
                            </p>
                          ) : (
                            <>
                              <p className="font-semibold text-slate-900 dark:text-slate-100">
                                {t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.totalAmount).toFixed(2) })}
                              </p>
                              <p className="text-slate-500">
                                {t('common.paid')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.paidAmount).toFixed(2) })}
                              </p>
                              <p className="text-rose-500">
                                {t('common.due')}: {t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.dueAmount).toFixed(2) })}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm text-slate-600">
                    <thead className="text-xs uppercase text-slate-400">
                      <tr>
                        <th className="py-2 text-left">{t('common.date')}</th>
                        <th className="py-2 text-left">{t('ledger.type')}</th>
                        <th className="py-2 text-left">{t('ledger.reference')}</th>
                        <th className="py-2 text-right">{t('common.total')}</th>
                        <th className="py-2 text-right">{t('ledger.totalReceived')}</th>
                        <th className="py-2 text-right">{t('common.due')}</th>
                        <th className="py-2 text-right">{t('ledger.amount')}</th>
                        <th className="py-2 text-left">{t('common.notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementData.rows.map((row) => (
                        <tr key={`${row.type}-${row.id}`} className="border-t border-slate-200/70 dark:border-slate-800/60">
                          <td className="py-3">{formatDate(row.date || row.createdAt)}</td>
                          <td className="py-3">
                            <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold capitalize ${getStatementBadgeClass(row.type)}`}>
                              {getStatementTypeLabel(row.type, t)}
                            </span>
                          </td>
                          <td className="py-3">{getStatementReference(row)}</td>
                          <td className="py-3 text-right">
                            {(row.type === 'payment_in' || row.type === 'payment_out')
                              ? '--'
                              : t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.totalAmount).toFixed(2) })}
                          </td>
                          <td className="py-3 text-right">
                            {(row.type === 'payment_in' || row.type === 'payment_out')
                              ? '--'
                              : t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.paidAmount).toFixed(2) })}
                          </td>
                          <td className="py-3 text-right">
                            {(row.type === 'payment_in' || row.type === 'payment_out')
                              ? '--'
                              : t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.dueAmount).toFixed(2) })}
                          </td>
                          <td className="py-3 text-right">
                            {(row.type === 'payment_in' || row.type === 'payment_out')
                              ? t('currency.formatted', { symbol: t('currency.symbol'), amount: toAmount(row.amount).toFixed(2) })
                              : '--'}
                          </td>
                          <td className="py-3">{row.note || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between pt-2 text-sm text-slate-500">
                    <span>
                      {statementData.summary.totalRows} transactions · page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => prev - 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={page === totalPages}
                        onClick={() => setPage((prev) => prev + 1)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
>>>>>>> Stashed changes
          </div>
        </div>
      </div>
    </div>
  );
}
