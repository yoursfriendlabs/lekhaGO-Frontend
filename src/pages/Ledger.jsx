import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarRange,
  Download,
  FilterX,
  Printer,
  RefreshCw,
  ScrollText,
  Users,
  WalletCards,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import Pagination from '../components/Pagination';
import PartyFilterSelect from '../components/PartyFilterSelect.jsx';
import { API_BASE, api } from '../lib/api';
import { useBusinessSettings } from '../lib/businessSettings';
import dayjs, { formatMaybeDate } from '../lib/datetime';
import { useI18n } from '../lib/i18n.jsx';
import { normalizeLookupParty, toPartyLookupOption } from '../lib/lookups.js';
import { getPaymentTypeDisplay, hasPaymentTypeData } from '../lib/paymentType';
import { printElement } from '../lib/print';

function formatStatementDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM YYYY');
}

function formatRangeDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'D MMM YYYY');
}

function formatLedgerText(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatStatusText(value) {
  const text = formatLedgerText(value);
  return text === '-' ? text : text.replace(/_/g, ' ');
}

function formatMoney(value, t) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return '-';
  }

  return t('currency.formatted', {
    symbol: t('currency.symbol'),
    amount: Number(value).toFixed(2),
  }).replace(/\u00a0/g, ' ');
}

function toCsvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getLedgerTypeMeta(type, t) {
  const map = {
    sale: { label: t('ledger.sale'), className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    purchase: { label: t('ledger.purchase'), className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
    expense: { label: t('purchases.expense'), className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
    service: { label: t('ledger.service'), className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    payment_in: { label: t('parties.paymentIn'), className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' },
    payment_out: { label: t('parties.paymentOut'), className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  };

  return map[type] || {
    label: formatLedgerText(type),
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
}

function getStatusToneClass(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (['paid', 'completed', 'received', 'settled', 'success', 'active'].includes(normalized)) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  }

  if (['pending', 'draft', 'open', 'in_progress', 'processing'].includes(normalized)) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }

  if (['cancelled', 'void', 'failed', 'inactive'].includes(normalized)) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
  }

  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

function getBalanceToneClass(value) {
  if (!Number.isFinite(Number(value))) return 'text-slate-700 dark:text-slate-300';

  const amount = Number(value);
  if (amount > 0) return 'text-rose-700 dark:text-rose-300';
  if (amount < 0) return 'text-emerald-700 dark:text-emerald-300';
  return 'text-slate-700 dark:text-slate-300';
}

function getBalanceLabel(value, t) {
  if (!Number.isFinite(Number(value))) return t('ledger.currentBalance');

  const amount = Number(value);
  if (amount > 0) return t('parties.toGive');
  if (amount < 0) return t('parties.toReceive');
  return t('parties.settled');
}

function toResolvedPartyOption(raw) {
  const party = normalizeLookupParty(raw);
  if (!party.id) return null;
  return toPartyLookupOption(party);
}

function PaymentMethodCell({ paymentDisplay, align = 'left' }) {
  const alignClass = align === 'right' ? 'text-right' : '';

  return (
    <div className={`min-w-0 ${alignClass}`}>
      <p className={`truncate text-sm font-medium text-slate-700 dark:text-slate-300 ${alignClass}`}>
        {paymentDisplay.label}
      </p>
      {paymentDisplay.balanceText ? (
        <p className={`truncate text-xs text-slate-500 dark:text-slate-400 ${alignClass}`}>
          {paymentDisplay.balanceText}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status }) {
  const label = formatStatusText(status);

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusToneClass(status)}`}>
      {label}
    </span>
  );
}

export default function Ledger() {
  const { t } = useI18n();
  const { settings: biz } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultFrom = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), []);
  const defaultTo = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const initialPartyId = searchParams.get('partyId') || '';
  const initialFrom = searchParams.get('from') || defaultFrom;
  const initialTo = searchParams.get('to') || defaultTo;

  const [ledger, setLedger] = useState({ items: [], total: 0, limit: 25, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId);
  const [selectedPartyOption, setSelectedPartyOption] = useState(null);
  const [filters, setFilters] = useState(() => ({ from: initialFrom, to: initialTo }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pullDistance, setPullDistance] = useState(0);
  const printRef = useRef(null);
  const requestIdRef = useRef(0);
  const pullStartYRef = useRef(null);
  const pullActiveRef = useRef(false);

  useEffect(() => {
    setSelectedPartyId(initialPartyId);
    setSelectedPartyOption((current) => (
      initialPartyId && String(current?.value || '') === String(initialPartyId)
        ? current
        : null
    ));
  }, [initialPartyId]);

  useEffect(() => {
    if (!selectedPartyId) {
      setSelectedPartyOption(null);
      return undefined;
    }

    if (String(selectedPartyOption?.value || '') === String(selectedPartyId)) {
      return undefined;
    }

    const matchedParty = ledger.items.find((row) => String(row.partyId || '') === String(selectedPartyId));
    const matchedOption = matchedParty ? toResolvedPartyOption({ ...matchedParty, id: selectedPartyId }) : null;

    if (matchedOption) {
      setSelectedPartyOption(matchedOption);
      return undefined;
    }

    let isActive = true;

    api.getParty(selectedPartyId)
      .then((party) => {
        if (!isActive) return;
        const option = toResolvedPartyOption(party);
        if (option) setSelectedPartyOption(option);
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, [ledger.items, selectedPartyId, selectedPartyOption]);

  const updateSearchState = useCallback((nextValues) => {
    const nextParams = new URLSearchParams(searchParams);
    const nextPartyId = String(nextValues.partyId || '').trim();
    const nextFrom = String(nextValues.from || '').trim();
    const nextTo = String(nextValues.to || '').trim();

    if (nextPartyId) nextParams.set('partyId', nextPartyId);
    else nextParams.delete('partyId');

    if (nextFrom) nextParams.set('from', nextFrom);
    else nextParams.delete('from');

    if (nextTo) nextParams.set('to', nextTo);
    else nextParams.delete('to');

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const fetchLedger = useCallback(async ({ refresh = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (refresh) setRefreshing(true);
    else setLoading(true);
    setStatus('');

    try {
      const response = await api.ledgerReport({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(selectedPartyId ? { partyId: selectedPartyId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
      });

      if (requestId !== requestIdRef.current) return;
      setLedger(response);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setStatus(error?.message || t('common.noData'));

      if (!refresh) {
        setLedger({
          items: [],
          total: 0,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });
      }
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters.from, filters.to, page, pageSize, selectedPartyId, t]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const statementRows = useMemo(() => ledger.items.map((row) => ({
    ...row,
    referenceDisplay: formatLedgerText(row.referenceNo),
    partyDisplay: formatLedgerText(row.partyName),
    statusDisplay: formatStatusText(row.status),
    typeMeta: getLedgerTypeMeta(row.type, t),
    paymentDisplay: hasPaymentTypeData(row)
      ? getPaymentTypeDisplay(row, {
          cashLabel: t('payments.cash'),
          bankLabel: t('payments.bank'),
          balancePrefix: t('payments.balancePrefix'),
          formatMoney: (amount) => formatMoney(amount, t),
        })
      : { label: '-', balanceText: '' },
  })), [ledger.items, t]);

  const summary = useMemo(() => {
    const totalDebit = statementRows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const totalCredit = statementRows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const currentBalance = statementRows.length
      ? statementRows[statementRows.length - 1].runningBalance
      : null;

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
  const hasActivePartyFilter = Boolean(selectedPartyId);
  const hasCustomDateFilter = filters.from !== defaultFrom || filters.to !== defaultTo;
  const hasAnyFilter = hasActivePartyFilter || hasCustomDateFilter;
  const timeSpanLabel = filters.from || filters.to
    ? `${t('ledger.from')}: ${formatRangeDate(filters.from)}  ·  ${t('ledger.to')}: ${formatRangeDate(filters.to)}`
    : t('ledger.allTime');
  const logoSrc = useMemo(() => {
    if (!biz?.logoUrl) return null;
    return biz.logoUrl.startsWith('http') ? biz.logoUrl : `${API_BASE}${biz.logoUrl}`;
  }, [biz?.logoUrl]);
  const balanceToneClass = getBalanceToneClass(summary.currentBalance);
  const balanceLabel = getBalanceLabel(summary.currentBalance, t);
  const pullReady = pullDistance >= 72;
  const summaryCards = [
    {
      key: 'balance',
      label: balanceLabel,
      value: formatMoney(summary.currentBalance, t),
      icon: WalletCards,
      valueClassName: balanceToneClass,
      accentClassName: 'bg-white/80 text-primary-700 ring-1 ring-primary-100',
    },
    {
      key: 'debit',
      label: t('ledger.totalDebit'),
      value: formatMoney(summary.totalDebit, t),
      icon: ArrowDownLeft,
      valueClassName: 'text-rose-700 dark:text-rose-300',
      accentClassName: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40',
    },
    {
      key: 'credit',
      label: t('ledger.totalCredit'),
      value: formatMoney(summary.totalCredit, t),
      icon: ArrowUpRight,
      valueClassName: 'text-emerald-700 dark:text-emerald-300',
      accentClassName: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40',
    },
    {
      key: 'entries',
      label: t('ledger.totalEntries'),
      value: String(summary.entries),
      icon: ScrollText,
      valueClassName: 'text-slate-900 dark:text-slate-100',
      accentClassName: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
    },
  ];

  const handlePartyFilterChange = (option) => {
    const partyId = option?.value || '';
    setSelectedPartyId(partyId);
    setSelectedPartyOption(option || null);
    setPage(1);
    updateSearchState({
      partyId,
      from: filters.from,
      to: filters.to,
    });
  };

  const handleDateChange = (field, value) => {
    const nextFilters = {
      ...filters,
      [field]: value,
    };

    setFilters(nextFilters);
    setPage(1);
    updateSearchState({
      partyId: selectedPartyId,
      from: nextFilters.from,
      to: nextFilters.to,
    });
  };

  const handleResetFilters = () => {
    const nextFilters = { from: defaultFrom, to: defaultTo };
    setSelectedPartyId('');
    setSelectedPartyOption(null);
    setFilters(nextFilters);
    setPage(1);
    updateSearchState({
      partyId: '',
      from: nextFilters.from,
      to: nextFilters.to,
    });
  };

  const handleDownloadExcel = () => {
    const rows = [
      [t('ledger.statementTitle')],
      [t('ledger.party'), selectedPartyLabel],
      [t('common.date'), timeSpanLabel],
      ['Exported', dayjs().format('D MMM YYYY, HH:mm')],
      [],
      [balanceLabel, formatMoney(summary.currentBalance, t)],
      [t('ledger.totalDebit'), formatMoney(summary.totalDebit, t)],
      [t('ledger.totalCredit'), formatMoney(summary.totalCredit, t)],
      [t('ledger.totalEntries'), summary.entries],
      [],
      [
        t('common.date'),
        t('ledger.referenceNo'),
        t('ledger.party'),
        t('ledger.type'),
        t('common.status'),
        t('payments.paymentMethod'),
        t('ledger.debit'),
        t('ledger.credit'),
        t('ledger.runningBalance'),
      ],
      ...statementRows.map((row) => [
        formatStatementDate(row.date),
        row.referenceDisplay,
        row.partyDisplay,
        row.typeMeta.label,
        row.statusDisplay,
        [row.paymentDisplay.label, row.paymentDisplay.balanceText].filter(Boolean).join(' - '),
        row.debit > 0 ? formatMoney(row.debit, t) : '',
        row.credit > 0 ? formatMoney(row.credit, t) : '',
        formatMoney(row.runningBalance, t),
      ]),
    ];

    downloadCsv(`ledger-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`, rows);
  };

  const handlePrint = () => {
    const now = dayjs();
    printElement(printRef.current, {
      prepareClone: (clone) => {
        clone.querySelectorAll('[data-printed-at]').forEach((node) => {
          node.textContent = now.format('D MMM YYYY, HH:mm');
        });
        clone.querySelectorAll('[data-printed-date]').forEach((node) => {
          node.textContent = now.format('D MMM YYYY');
        });
      },
    });
  };

  const handleRefresh = () => {
    fetchLedger({ refresh: true });
  };

  const resetPullState = () => {
    pullStartYRef.current = null;
    pullActiveRef.current = false;
    setPullDistance(0);
  };

  const handleTouchStart = (event) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768 || window.scrollY > 0 || loading || refreshing) {
      pullActiveRef.current = false;
      pullStartYRef.current = null;
      return;
    }

    pullActiveRef.current = true;
    pullStartYRef.current = event.touches?.[0]?.clientY ?? null;
  };

  const handleTouchMove = (event) => {
    if (!pullActiveRef.current || pullStartYRef.current === null) return;

    const currentY = event.touches?.[0]?.clientY ?? pullStartYRef.current;
    const nextDistance = Math.max(currentY - pullStartYRef.current, 0);
    setPullDistance(Math.min(nextDistance, 96));
  };

  const handleTouchEnd = () => {
    const shouldRefresh = pullReady;
    resetPullState();
    if (shouldRefresh) handleRefresh();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('ledger.statementTitle')}
        subtitle={t('ledger.statementSubtitle')}
        action={(
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" type="button" onClick={handlePrint}>
                <Printer size={16} /> {t('ledger.printPdf')}
              </button>
              <button
                className="btn-ghost inline-flex items-center justify-center gap-2"
                type="button"
                onClick={handleRefresh}
                disabled={loading || refreshing}
                aria-busy={loading || refreshing}
              >
                <RefreshCw size={16} className={loading || refreshing ? 'animate-spin' : ''} />
                {loading || refreshing ? t('common.loading') : t('topbar.refresh')}
              </button>
              <button
                className="btn-primary inline-flex items-center justify-center gap-2"
                type="button"
                onClick={handleDownloadExcel}
                disabled={loading}
              >
                <Download size={16} /> {t('ledger.downloadExcel')}
              </button>
            </div>
          </div>
        )}
      />

      {status ? (
        <div className="space-y-3">
          <Notice title={status} tone="error" />
          <button className="btn-secondary" type="button" onClick={() => fetchLedger({ refresh: Boolean(statementRows.length) })}>
            {t('common.retry')}
          </button>
        </div>
      ) : null}

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
                    {formatMoney(summary.currentBalance, t)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalDebit')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {formatMoney(summary.totalDebit, t)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalCredit')}</p>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">
                    {formatMoney(summary.totalCredit, t)}
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
                    <th colSpan={9} className="pb-3 normal-case text-slate-500">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-600">{selectedPartyLabel}</span>
                        <span>{timeSpanLabel}</span>
                      </div>
                    </th>
                  </tr>
                  <tr className="uppercase tracking-wider">
                    <th className="pb-3 text-left">{t('common.date')}</th>
                    <th className="pb-3 text-left">{t('ledger.referenceNo')}</th>
                    <th className="pb-3 text-left">{t('ledger.party')}</th>
                    <th className="pb-3 text-left">{t('ledger.type')}</th>
                    <th className="pb-3 text-left">{t('common.status')}</th>
                    <th className="pb-3 text-left">{t('payments.paymentMethod')}</th>
                    <th className="pb-3 text-right">{t('ledger.debit')}</th>
                    <th className="pb-3 text-right">{t('ledger.credit')}</th>
                    <th className="pb-3 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-4 text-slate-400">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={`print-${row.type}-${row.id}`}>
                        <td className="py-3">{formatStatementDate(row.date)}</td>
                        <td className="py-3">{row.referenceDisplay}</td>
                        <td className="py-3">{row.partyDisplay}</td>
                        <td className="py-3">{row.typeMeta.label}</td>
                        <td className="py-3">{row.statusDisplay}</td>
                        <td className="py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-700">{row.paymentDisplay.label}</p>
                            {row.paymentDisplay.balanceText ? <p className="truncate text-xs text-slate-500">{row.paymentDisplay.balanceText}</p> : null}
                          </div>
                        </td>
                        <td className="py-3 text-right text-rose-700">
                          {row.debit > 0 ? formatMoney(row.debit, t) : '-'}
                        </td>
                        <td className="py-3 text-right text-emerald-700">
                          {row.credit > 0 ? formatMoney(row.credit, t) : '-'}
                        </td>
                        <td className={`py-3 text-right ${getBalanceToneClass(row.runningBalance)}`}>
                          {formatMoney(row.runningBalance, t)}
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
          <div className="overflow-hidden rounded-[28px] border border-primary-100/80 bg-[radial-gradient(circle_at_top_left,_rgba(155,104,53,0.18),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(248,244,237,0.98))] shadow-sm dark:border-primary-900/40 dark:bg-[radial-gradient(circle_at_top_left,_rgba(155,104,53,0.16),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(30,41,59,0.96))]">
            <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)] lg:p-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary-700 shadow-sm ring-1 ring-primary-100 dark:bg-slate-900/85 dark:text-primary-300 dark:ring-primary-900/40">
                  <ScrollText size={14} />
                  {t('ledger.statementTitle')}
                </div>

                <div className="space-y-2">
                  <h2 className="font-serif text-2xl font-semibold text-slate-900 dark:text-slate-50 sm:text-[2rem]">
                    {selectedPartyLabel}
                  </h2>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {timeSpanLabel}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700/80">
                    <Users size={13} className="text-primary-600 dark:text-primary-400" />
                    {hasActivePartyFilter ? `${t('ledger.party')}: ${selectedPartyLabel}` : t('ledger.allParties')}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700/80">
                    <CalendarRange size={13} className="text-primary-600 dark:text-primary-400" />
                    {timeSpanLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:text-slate-200 dark:ring-slate-700/80">
                    <ScrollText size={13} className="text-primary-600 dark:text-primary-400" />
                    {t('ledger.totalEntries')}: {summary.entries}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/45">
                  <label className="label">{t('ledger.party')}</label>
                  <PartyFilterSelect
                    className="mt-1"
                    value={selectedPartyId}
                    selectedOption={selectedPartyOption}
                    onChange={handlePartyFilterChange}
                    placeholder={t('ledger.allParties')}
                    searchPlaceholder={t('ledger.searchPlaceholder')}
                    showPhone={false}
                  />
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {hasActivePartyFilter ? `${t('ledger.party')}: ${selectedPartyLabel}` : t('ledger.allParties')}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/45">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="ledger-from-date">{t('ledger.from')}</label>
                      <input
                        id="ledger-from-date"
                        className="input mt-1"
                        type="date"
                        value={filters.from}
                        onChange={(event) => handleDateChange('from', event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="ledger-to-date">{t('ledger.to')}</label>
                      <input
                        id="ledger-to-date"
                        className="input mt-1"
                        type="date"
                        value={filters.to}
                        onChange={(event) => handleDateChange('to', event.target.value)}
                      />
                    </div>
                  </div>

                  {hasAnyFilter ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 transition hover:text-primary-600 dark:text-primary-300 dark:hover:text-primary-200"
                      onClick={handleResetFilters}
                    >
                      <FilterX size={13} />
                      {t('common.clear')}
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      {timeSpanLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
              {summaryCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.key}
                    className="rounded-2xl border border-white/75 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                          {card.label}
                        </p>
                        <p className={`mt-3 text-lg font-semibold ${card.valueClassName}`}>
                          {card.value}
                        </p>
                      </div>
                      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${card.accentClassName}`}>
                        <Icon size={18} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 pb-4 dark:border-slate-800/70">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {t('ledger.transaction')}
                </p>
                <h3 className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPartyLabel}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-secondary-100 px-3 py-1 dark:bg-slate-800">
                  {timeSpanLabel}
                </span>
                <span className="rounded-full bg-secondary-100 px-3 py-1 dark:bg-slate-800">
                  {t('ledger.totalEntries')}: {summary.entries}
                </span>
              </div>
            </div>

            <div
              className="space-y-3 md:hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
            >
              <div
                className="overflow-hidden transition-all duration-150"
                style={{ maxHeight: pullDistance || refreshing ? 56 : 0, opacity: pullDistance || refreshing ? 1 : 0 }}
              >
                <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/70 px-4 py-3 text-center text-xs font-medium text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/20 dark:text-primary-300">
                  {refreshing ? t('common.loading') : pullReady ? t('topbar.refresh') : t('ledger.pullToRefresh')}
                </div>
              </div>

              {loading && statementRows.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">{t('common.loading')}</p>
              ) : statementRows.length === 0 ? (
                <Notice title={t('ledger.noTransactions')} tone="info" />
              ) : (
                statementRows.map((row) => (
                  <div key={`${row.type}-${row.id}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm dark:border-slate-800/60 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.typeMeta.className}`}>
                        {row.typeMeta.label}
                      </span>
                      <StatusPill status={row.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('common.date')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatStatementDate(row.date)}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('ledger.referenceNo')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{row.referenceDisplay}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('ledger.party')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{row.partyDisplay}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('common.status')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{row.statusDisplay}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('payments.paymentMethod')}</p>
                        <div className="mt-1">
                          <PaymentMethodCell paymentDisplay={row.paymentDisplay} />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('ledger.debit')}</p>
                        <p className="mt-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
                          {row.debit > 0 ? formatMoney(row.debit, t) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('ledger.credit')}</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          {row.credit > 0 ? formatMoney(row.credit, t) : '-'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="font-semibold uppercase tracking-wide text-slate-400">{t('ledger.runningBalance')}</p>
                        <p className={`mt-1 text-sm font-semibold ${getBalanceToneClass(row.runningBalance)}`}>
                          {formatMoney(row.runningBalance, t)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2.5 pr-4 text-left">{t('common.date')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('ledger.referenceNo')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('ledger.party')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('ledger.type')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('common.status')}</th>
                    <th className="py-2.5 pr-4 text-left">{t('payments.paymentMethod')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.debit')}</th>
                    <th className="py-2.5 pr-4 text-right">{t('ledger.credit')}</th>
                    <th className="py-2.5 text-right">{t('ledger.runningBalance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-3 text-slate-500">{t('common.loading')}</td>
                    </tr>
                  ) : statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-3 text-slate-500">{t('ledger.noTransactions')}</td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="border-t border-slate-200/70 align-top dark:border-slate-800/70">
                        <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">{formatStatementDate(row.date)}</td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{row.referenceDisplay}</td>
                        <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{row.partyDisplay}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.typeMeta.className}`}>
                            {row.typeMeta.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="py-3 pr-4">
                          <PaymentMethodCell paymentDisplay={row.paymentDisplay} />
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-rose-700 dark:text-rose-300">
                          {row.debit > 0 ? formatMoney(row.debit, t) : '-'}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                          {row.credit > 0 ? formatMoney(row.credit, t) : '-'}
                        </td>
                        <td className={`py-3 text-right font-semibold ${getBalanceToneClass(row.runningBalance)}`}>
                          {formatMoney(row.runningBalance, t)}
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
