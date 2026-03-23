import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import { API_BASE, api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { formatMaybeDate, todayISODate } from '../lib/datetime';
import { Download, Printer } from 'lucide-react';

function normalizeId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function formatStatementDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'MMMM,D');
}

function formatRangeDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM YYYY');
}

function buildRange(period) {
  const now = dayjs();
  if (period === 'month') {
    return { from: now.startOf('month'), to: now };
  }
  if (period === 'year') {
    return { from: now.startOf('year'), to: now };
  }
  return { from: null, to: null };
}

export default function Ledger() {
  const { t } = useI18n();
  const { settings: biz } = useBusinessSettings();
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [services, setServices] = useState([]);
  const [parties, setParties] = useState([]);
  const [status, setStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');
  const [period, setPeriod] = useState('month');
  const printRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.listSales({ limit: 200 }),
      api.listPurchases({ limit: 200 }),
      api.listServices({ limit: 200 }),
      api.listParties(),
    ])
      .then(([salesData, purchaseData, serviceData, partyData]) => {
        setSales(salesData || []);
        setPurchases(purchaseData || []);
        setServices(serviceData || []);
        setParties(partyData || []);
      })
      .catch((err) => setStatus(err.message));
  }, []);

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

  const { from, to } = useMemo(() => buildRange(period), [period]);

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
      }
    });
    const netBalance = totalCredit - totalDebit;
    return { totalDebit, totalCredit, netBalance, entries: filteredTransactions.length };
  }, [filteredTransactions]);

  const statementRows = useMemo(() => {
    let runningBalance = 0;
    return filteredTransactions.map((tx) => {
      const debit = tx.type === 'purchase' ? tx.grandTotal : 0;
      const credit = tx.type !== 'purchase' ? tx.grandTotal : 0;
      runningBalance += credit - debit;
      return {
        ...tx,
        debit,
        credit,
        runningBalance,
        label: tx.type === 'sale'
          ? `${t('ledger.salesInvoice')} ${tx.invoiceNo}`
          : tx.type === 'purchase'
          ? `${t('ledger.purchaseInvoice')} ${tx.invoiceNo}`
          : `${t('parties.serviceOrder')} ${tx.invoiceNo}`,
      };
    });
  }, [filteredTransactions, t]);

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
      {status ? <Notice title={status} tone="error" /> : null}

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
                statementRows.map((row) => (
                  <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{row.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{formatStatementDate(row.date)}</p>
                        {selectedPartyId === 'all' && row.party && row.party !== '—' && (
                          <p className="text-xs text-slate-500 truncate">{row.party}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {row.debit > 0 ? (
                          <p className="font-semibold text-rose-600 dark:text-rose-400">
                            -{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) })}
                          </p>
                        ) : (
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            +{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) })}
                          </p>
                        )}
                        <p className={`text-xs font-medium mt-0.5 ${row.runningBalance < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                          Bal: {t('currency.formatted', { symbol: t('currency.symbol'), amount: row.runningBalance.toFixed(2) })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-slate-600">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th colSpan={selectedPartyId === 'all' ? 6 : 5} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="uppercase">
                    <th className="py-2 text-left">{t('common.date')}</th>
                    {selectedPartyId === 'all' ? <th className="py-2 text-left">{t('ledger.party')}</th> : null}
                    <th className="py-2 text-left">{t('ledger.transaction')}</th>
                    <th className="py-2 text-right">{t('ledger.debit')}</th>
                    <th className="py-2 text-right">{t('ledger.credit')}</th>
                    <th className="py-2 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId === 'all' ? 6 : 5} className="py-3 text-slate-500">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="border-t border-slate-200/70">
                        <td className="py-2">{formatStatementDate(row.date)}</td>
                        {selectedPartyId === 'all' ? <td className="py-2">{row.party || '—'}</td> : null}
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
      </div>
    </div>
  );
}
