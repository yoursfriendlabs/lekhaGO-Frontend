import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import PaymentTypeSummary from '../components/PaymentTypeSummary.jsx';
import { API_BASE, api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import dayjs, { formatMaybeDate, todayISODate } from '../lib/datetime';
import { normalizeLookupParty, toPartyLookupOption } from '../lib/lookups.js';

function formatStatementDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM');
}

function formatRangeDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM YYYY');
}

function buildRange(period) {
  const now = dayjs();

  if (period === 'month') {
    return { from: now.startOf('month').format('YYYY-MM-DD'), to: now.format('YYYY-MM-DD') };
  }

  if (period === 'year') {
    return { from: now.startOf('year').format('YYYY-MM-DD'), to: now.format('YYYY-MM-DD') };
  }

  return { from: '', to: '' };
}

function getLedgerTypeMeta(type, t) {
  const map = {
    sale: { label: t('ledger.sale'), className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    purchase: { label: t('ledger.purchase'), className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
    service: { label: t('ledger.service'), className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    payment_in: { label: t('parties.paymentIn'), className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
    payment_out: { label: t('parties.paymentOut'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  };

  return map[type] || { label: type || t('ledger.transaction'), className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

function getBalanceToneClass(value) {
  const amount = Number(value || 0);

  if (amount > 0) return 'text-rose-700 dark:text-rose-300';
  if (amount < 0) return 'text-emerald-700 dark:text-emerald-300';
  return 'text-slate-700 dark:text-slate-300';
}

function getBalanceLabel(value, t) {
  const amount = Number(value || 0);

  if (amount > 0) return t('parties.toGive');
  if (amount < 0) return t('parties.toReceive');
  return t('parties.settled');
}

function buildLedgerLabel(row, t) {
  const reference = row.referenceNo ? ` ${row.referenceNo}` : '';

  if (row.type === 'sale') return `${t('ledger.salesInvoice')}${reference}`;
  if (row.type === 'purchase') return `${t('ledger.purchaseInvoice')}${reference}`;
  if (row.type === 'service') return `${t('parties.serviceOrder')}${reference}`;
  if (row.type === 'payment_in') return `${t('parties.paymentIn')}${reference}`;
  if (row.type === 'payment_out') return `${t('parties.paymentOut')}${reference}`;

  return row.referenceNo || t('ledger.transaction');
}

function normalizeLedgerRow(row, t) {
  return {
    ...row,
    id: row.id || row.referenceNo || `${row.type}-${row.date}`,
    partyName: row.partyName || '—',
    debit: Number(row.debit || 0),
    credit: Number(row.credit || 0),
    runningBalance: Number(row.runningBalance || 0),
    label: buildLedgerLabel(row, t),
  };
}

export default function Ledger() {
  const { t } = useI18n();
  const { settings: biz } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPartyId = searchParams.get('partyId') || '';

  const [ledger, setLedger] = useState({ items: [], total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId);
  const [selectedPartyOption, setSelectedPartyOption] = useState(null);
  const [period, setPeriod] = useState('month');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const printRef = useRef(null);

  const { from, to } = useMemo(() => buildRange(period), [period]);

  useEffect(() => {
    setSelectedPartyId(initialPartyId);
    if (!initialPartyId) {
      setSelectedPartyOption(null);
    }
  }, [initialPartyId]);

  useEffect(() => {
    setPage(1);
  }, [period, selectedPartyId]);

  useEffect(() => {
    const params = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(selectedPartyId ? { partyId: selectedPartyId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };

    let isActive = true;
    setLoading(true);
    setStatus('');

    api.ledgerReport(params)
      .then((data) => {
        if (!isActive) return;
        setLedger({
          items: Array.isArray(data?.items) ? data.items : [],
          total: Number(data?.total || 0),
          limit: Number(data?.limit || pageSize),
          offset: Number(data?.offset || 0),
        });

        const matchedPartyRow = (Array.isArray(data?.items) ? data.items : []).find(
          (row) => String(row.partyId || '') === String(selectedPartyId)
        ) || data?.items?.[0];

        if (selectedPartyId && !selectedPartyOption && matchedPartyRow?.partyName) {
          const party = normalizeLookupParty({
            id: matchedPartyRow.partyId || selectedPartyId,
            partyName: matchedPartyRow.partyName,
          });
          setSelectedPartyOption(toPartyLookupOption(party));
        }
      })
      .catch((error) => {
        if (!isActive) return;
        setStatus(error.message);
        setLedger({ items: [], total: 0, limit: pageSize, offset: 0 });
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [from, page, pageSize, selectedPartyId, selectedPartyOption, to]);

  const statementRows = useMemo(
    () => ledger.items.map((row) => normalizeLedgerRow(row, t)),
    [ledger.items, t]
  );

  const summary = useMemo(() => {
    const totalDebit = statementRows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = statementRows.reduce((sum, row) => sum + row.credit, 0);
    const currentBalance = statementRows.length
      ? statementRows[statementRows.length - 1].runningBalance
      : 0;

    return {
      totalDebit,
      totalCredit,
      currentBalance,
      entries: ledger.total || statementRows.length,
    };
  }, [ledger.total, statementRows]);

  const selectedPartyLabel = selectedPartyId
    ? selectedPartyOption?.entity?.name || selectedPartyOption?.label || t('ledger.party')
    : t('ledger.allParties');
  const timeSpanLabel = from || to
    ? `${t('ledger.from')}: ${formatRangeDate(from)}  ·  ${t('ledger.to')}: ${formatRangeDate(to)}`
    : t('ledger.allTime');
  const logoSrc = useMemo(() => {
    if (!biz?.logoUrl) return null;
    return biz.logoUrl.startsWith('http') ? biz.logoUrl : `${API_BASE}${biz.logoUrl}`;
  }, [biz?.logoUrl]);
  const balanceToneClass = getBalanceToneClass(summary.currentBalance);
  const balanceLabel = getBalanceLabel(summary.currentBalance, t);

  const handlePartyFilterChange = (option) => {
    const partyId = option?.value || '';
    setSelectedPartyId(partyId);
    setSelectedPartyOption(option || null);

    const nextParams = new URLSearchParams(searchParams);
    if (partyId) nextParams.set('partyId', partyId);
    else nextParams.delete('partyId');
    setSearchParams(nextParams);
  };

  const handlePrint = () => {
    const source = printRef.current;
    if (!source) {
      window.print();
      return;
    }

    const clone = source.cloneNode(true);
    clone.classList.add('print-clone');
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
        ...(selectedPartyId ? [] : [t('ledger.party')]),
        t('ledger.transaction'),
        t('common.payment'),
        t('ledger.debit'),
        t('ledger.credit'),
        t('ledger.runningBalance'),
      ],
      ...statementRows.map((row) => ([
        formatStatementDate(row.date),
        ...(selectedPartyId ? [] : [row.partyName || '—']),
        row.label,
        row.paymentType?.label || '',
        row.debit > 0 ? row.debit.toFixed(2) : '',
        row.credit > 0 ? row.credit.toFixed(2) : '',
        row.runningBalance.toFixed(2),
      ])),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const partySlug = selectedPartyId
      ? String(selectedPartyLabel).replace(/\s+/g, '-').toLowerCase()
      : 'all';
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
        <div className="hidden print:block">
          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
            <div className="h-1.5 w-full bg-primary" />
            <div className="flex items-start justify-between gap-6 border-b border-slate-200/70 px-8 pb-6 pt-6">
              <div className="flex min-w-0 items-start gap-4">
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt="Logo"
                    className="h-16 w-16 shrink-0 rounded-xl border border-slate-200/70 bg-white object-contain p-1 shadow-sm"
                  />
                ) : null}
                <div className="min-w-0">
                  <h1 className={`font-serif font-bold leading-tight text-slate-900 ${logoSrc ? 'text-2xl' : 'text-3xl'}`}>
                    {biz?.companyName || 'PasalManager'}
                  </h1>
                  {(biz?.address || biz?.phone || biz?.email || biz?.panVat) ? (
                    <div className="mt-1.5 space-y-0.5">
                      {biz?.address ? <p className="whitespace-pre-wrap text-xs leading-snug text-slate-500">{biz.address}</p> : null}
                      {(biz?.phone || biz?.email) ? <p className="text-xs text-slate-500">{[biz.phone, biz.email].filter(Boolean).join('  ·  ')}</p> : null}
                      {biz?.panVat ? <p className="text-xs font-semibold text-slate-600">PAN / VAT No: {biz.panVat}</p> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs font-bold uppercase tracking-widest text-primary-600">{t('ledger.statementTitle')}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{selectedPartyLabel}</p>
                <p className="mt-1 text-xs text-slate-500">{timeSpanLabel}</p>
                <p className="mt-2 text-xs text-slate-400" data-printed-at>{dayjs().format('D MMM YYYY, HH:mm')}</p>
              </div>
            </div>

            <div className="border-b border-slate-200/70 bg-slate-50/60 px-8 py-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{balanceLabel}</p>
                  <p className={`mt-1.5 text-sm font-semibold ${balanceToneClass}`}>
                    {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(summary.currentBalance).toFixed(2) })}
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

            <div className="px-8 py-6">
              <table className="w-full text-sm text-slate-700">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th colSpan={selectedPartyId ? 6 : 7} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="uppercase tracking-wider">
                    <th className="pb-3 text-left">{t('common.date')}</th>
                    {selectedPartyId ? null : <th className="pb-3 text-left">{t('ledger.party')}</th>}
                    <th className="pb-3 text-left">{t('ledger.transaction')}</th>
                    <th className="pb-3 text-left">{t('common.payment')}</th>
                    <th className="pb-3 text-right">{t('ledger.debit')}</th>
                    <th className="pb-3 text-right">{t('ledger.credit')}</th>
                    <th className="pb-3 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId ? 6 : 7} className="py-4 text-slate-400">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={`print-${row.type}-${row.id}`}>
                        <td className="py-3">{formatStatementDate(row.date)}</td>
                        {selectedPartyId ? null : <td className="py-3">{row.partyName || '—'}</td>}
                        <td className="py-3">{row.label}</td>
                        <td className="py-3">
                          <PaymentTypeSummary source={row} />
                        </td>
                        <td className="py-3 text-right">
                          {row.debit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) }) : '—'}
                        </td>
                        <td className="py-3 text-right">
                          {row.credit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) }) : '—'}
                        </td>
                        <td className={`py-3 text-right ${getBalanceToneClass(row.runningBalance)}`}>
                          {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(row.runningBalance).toFixed(2) })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200/70 bg-slate-50/60 px-8 py-4">
              <p className="text-xs text-slate-400">{t('ledger.totalEntries')}: {summary.entries}</p>
              <p className="text-xs text-slate-400">Printed on <span data-printed-date>{dayjs().format('D MMM YYYY')}</span></p>
            </div>
          </div>
        </div>

        <div className="space-y-6 print:hidden">
          <div className="card space-y-5">
            <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px]">
              <div>
                <label className="label">{t('ledger.party')}</label>
                <PartyFilterSelect
                  className="mt-1"
                  value={selectedPartyId}
                  selectedOption={selectedPartyOption}
                  onChange={handlePartyFilterChange}
                  placeholder={t('ledger.allParties')}
                  searchPlaceholder={t('ledger.searchPlaceholder')}
                />
                {selectedPartyId ? (
                  <button type="button" className="mt-2 text-xs font-medium text-primary-700 hover:text-primary-600" onClick={() => handlePartyFilterChange(null)}>
                    {t('common.clear')}
                  </button>
                ) : null}
              </div>

              <div>
                <label className="label">{t('analytics.period')}</label>
                <select className="input mt-1" value={period} onChange={(event) => setPeriod(event.target.value)}>
                  <option value="month">{t('ledger.thisMonth')}</option>
                  <option value="year">{t('ledger.thisYear')}</option>
                  <option value="all">{t('ledger.allTime')}</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/50">
                <p className="text-xs uppercase text-slate-400">{balanceLabel}</p>
                <p className={`mt-2 text-lg font-semibold ${balanceToneClass}`}>
                  {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(summary.currentBalance).toFixed(2) })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/50">
                <p className="text-xs uppercase text-slate-400">{t('ledger.totalDebit')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalDebit.toFixed(2) })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/50">
                <p className="text-xs uppercase text-slate-400">{t('ledger.totalCredit')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t('currency.formatted', { symbol: t('currency.symbol'), amount: summary.totalCredit.toFixed(2) })}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/50">
                <p className="text-xs uppercase text-slate-400">{t('ledger.totalEntries')}</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{summary.entries}</p>
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 md:hidden">
              <span className="rounded-full bg-secondary-100 px-3 py-1">{selectedPartyLabel}</span>
              <span className="rounded-full bg-secondary-100 px-3 py-1">{timeSpanLabel}</span>
            </div>

            <div className="space-y-3 md:hidden">
              {loading && statementRows.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
              ) : statementRows.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t('ledger.noTransactions')}</p>
              ) : (
                statementRows.map((row) => {
                  const typeMeta = getLedgerTypeMeta(row.type, t);
                  return (
                    <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${typeMeta.className}`}>
                              {typeMeta.label}
                            </span>
                            <p className="text-xs text-slate-500">{formatStatementDate(row.date)}</p>
                          </div>
                          <p className="mt-1 truncate font-semibold text-slate-800 dark:text-slate-100">{row.label}</p>
                          {selectedPartyId ? null : <p className="truncate text-xs text-slate-500">{row.partyName || '—'}</p>}
                          <PaymentTypeSummary source={row} className="mt-2" />
                        </div>
                        <div className="shrink-0 text-right">
                          {row.debit > 0 ? (
                            <p className="font-semibold text-rose-700 dark:text-rose-300">
                              -{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) })}
                            </p>
                          ) : (
                            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                              +{t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) })}
                            </p>
                          )}
                          <p className={`mt-0.5 text-xs font-medium ${getBalanceToneClass(row.runningBalance)}`}>
                            {getBalanceLabel(row.runningBalance, t)}:{' '}
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(row.runningBalance).toFixed(2) })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th colSpan={selectedPartyId ? 6 : 7} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr>
                    <th className="py-2.5 pr-4 text-left">{t('common.date')}</th>
                    {selectedPartyId ? null : <th className="py-2.5 pr-4 text-left">{t('ledger.party')}</th>}
                    <th className="py-2.5 pr-4 text-left">{t('ledger.transaction')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('common.payment')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.debit')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.credit')}</th>
                    <th className="py-2.5 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId ? 6 : 7} className="py-3 text-slate-500">{t('common.loading')}</td>
                    </tr>
                  ) : statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={selectedPartyId ? 6 : 7} className="py-3 text-slate-500">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => {
                      const typeMeta = getLedgerTypeMeta(row.type, t);

                      return (
                        <tr key={`${row.type}-${row.id}`} className="border-t border-slate-200/70 dark:border-slate-800/70">
                          <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-200">{formatStatementDate(row.date)}</td>
                          {selectedPartyId ? null : <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">{row.partyName || '—'}</td>}
                          <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${typeMeta.className}`}>
                                {typeMeta.label}
                              </span>
                              <span className="truncate">{row.label}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4">
                            <PaymentTypeSummary source={row} />
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-rose-700 dark:text-rose-300">
                            {row.debit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.debit.toFixed(2) }) : '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                            {row.credit > 0 ? t('currency.formatted', { symbol: t('currency.symbol'), amount: row.credit.toFixed(2) }) : '—'}
                          </td>
                          <td className={`py-2.5 text-right font-semibold ${getBalanceToneClass(row.runningBalance)}`}>
                            {t('currency.formatted', { symbol: t('currency.symbol'), amount: Math.abs(row.runningBalance).toFixed(2) })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={ledger.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
