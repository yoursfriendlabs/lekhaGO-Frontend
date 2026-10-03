import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Landmark,
  Loader2,
  Pencil,
  Printer,
  Wallet,
  WalletCards,
} from "lucide-react";
import StatsCard, { STATS_GRID_CLASS } from "../ui/StatsCard.jsx";
import Notice from "../ui/Notice";
import Pagination from "../ui/Pagination";
import RefreshButton from "../ui/RefreshButton.jsx";
import FlexibleDateInput from "../form/FlexibleDateInput.jsx";
import { api, invalidateApiCache } from "../../lib/api";
import { formatCurrency } from "../../lib/money/currency";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../lib/auth";
import { useBusinessSettings } from "../../lib/business/businessSettings";
import { todayISODate, formatMaybeDate } from "../../lib/dates/datetime";
import { printElement } from "../../lib/print/print";

const PAGE_SIZE = 25;

const EMPTY_GROUP = Object.freeze({ opening: 0, in: 0, out: 0, closing: 0, count: 0 });

const EMPTY_REPORT = Object.freeze({
  from: "",
  to: "",
  cashOpeningBalance: 0,
  accounts: [],
  totals: { ...EMPTY_GROUP, cash: EMPTY_GROUP, bank: EMPTY_GROUP, other: EMPTY_GROUP },
  entries: [],
  entriesFiltered: false,
  total: 0,
});

const ACCOUNT_ICONS = { cash: Wallet, bank: Landmark, other: WalletCards };

function shiftIsoDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toCsvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows, filename) {
  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * The day book: a day's money closed off per account, so an owner reads cash in
 * hand and every bank balance from one screen. Balances always cover the whole
 * day — only the entry list honours the search box.
 */
export default function DayBookReport() {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const { settings, saveSettings } = useBusinessSettings();

  const [date, setDate] = useState(() => todayISODate());
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [editingCash, setEditingCash] = useState(false);
  const [cashDraft, setCashDraft] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashNotice, setCashNotice] = useState("");
  const [cashError, setCashError] = useState("");

  const printRef = useRef(null);
  const requestId = useRef(0);
  const canSetOpeningCash = canManageFeature?.("settings") ?? false;

  const load = useCallback(async ({ force = false } = {}) => {
    const currentRequest = ++requestId.current;
    if (!businessId) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const payload = await api.dayBookReport(
        {
          date,
          ...(appliedSearch ? { search: appliedSearch } : {}),
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
        },
        force ? { force: true } : {},
      );
      if (currentRequest === requestId.current) setReport({ ...EMPTY_REPORT, ...(payload || {}) });
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(err?.payload?.message || err?.message || t("dayBook.loadFailed"));
      setReport(EMPTY_REPORT);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [appliedSearch, businessId, date, page, t]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  // A new day or a new search starts at the first page of entries. Paging is
  // reset in the same update as the change, so the day is only fetched once.
  const changeDate = useCallback((next) => {
    setDate(next || todayISODate());
    setPage(1);
  }, []);

  const handleRefresh = () => {
    invalidateApiCache(["day-book", "reports"]);
    load({ force: true });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const accounts = report.accounts || [];
  const totals = report.totals || EMPTY_REPORT.totals;
  const isToday = date === todayISODate();
  const isRange = Boolean(report.from && report.to && report.from !== report.to);

  const dayLabel = useMemo(() => {
    if (!report.from) return formatMaybeDate(date, "D MMM YYYY");
    if (!isRange) return formatMaybeDate(report.from, "D MMM YYYY");
    return t("dayBook.range", {
      from: formatMaybeDate(report.from, "D MMM"),
      to: formatMaybeDate(report.to, "D MMM YYYY"),
    });
  }, [date, isRange, report.from, report.to, t]);

  const startEditingCash = () => {
    setCashDraft(String(report.cashOpeningBalance ?? settings?.cashOpeningBalance ?? 0));
    setCashError("");
    setCashNotice("");
    setEditingCash(true);
  };

  const handleCashSave = async (event) => {
    event.preventDefault();
    const amount = Number(cashDraft);
    if (!Number.isFinite(amount)) {
      setCashError(t("dayBook.saveFailed"));
      return;
    }

    setCashSaving(true);
    setCashError("");
    try {
      await saveSettings({ cashOpeningBalance: amount });
      setEditingCash(false);
      setCashNotice(t("dayBook.openingCashSaved"));
      invalidateApiCache(["day-book", "reports"]);
      await load({ force: true });
    } catch (err) {
      setCashError(err?.payload?.message || err?.message || t("dayBook.saveFailed"));
    } finally {
      setCashSaving(false);
    }
  };

  const handlePrint = () => {
    printElement(printRef.current);
  };

  const handleExport = async () => {
    setExporting(true);
    setError("");
    try {
      const entries = [];
      let exportReport;
      for (let offset = 0; ; ) {
        const next = await api.dayBookReport({ date, search: appliedSearch || undefined, limit: 200, offset }, { force: true });
        if (!exportReport) exportReport = next;
        entries.push(...next.entries);
        if (entries.length >= next.total || !next.entries.length) break;
        offset += next.entries.length;
      }
      const exportAccounts = exportReport.accounts;
      const header = [
        t("dayBook.account"),
        t("dayBook.opening"),
        t("dayBook.moneyIn"),
        t("dayBook.moneyOut"),
        t("dayBook.closing"),
      ];
      const accountRows = exportAccounts.map((account) => [
        account.type === "cash" ? t("dayBook.cashInHand") : account.name,
        account.opening,
        account.in,
        account.out,
        account.closing,
      ]);
      const entryHeader = [
        t("common.date"),
        t("dayBook.source"),
        t("dayBook.account"),
        t("dayBook.party"),
        t("dayBook.reference"),
        t("dayBook.moneyIn"),
        t("dayBook.moneyOut"),
      ];
      const entryRows = entries.map((entry) => [
        entry.date,
        entry.category,
        accountNameFor(entry, exportAccounts, t),
        entry.partyName || "",
        entry.invoiceNo || entry.note || "",
        entry.kind === "in" ? entry.amount : "",
        entry.kind === "out" ? entry.amount : "",
      ]);

      downloadCsv(
        [header, ...accountRows, [], entryHeader, ...entryRows],
        `day-book-${exportReport.from || date}.csv`,
      );
    } catch (err) {
      setError(err?.message || t("dayBook.loadFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Day picker and actions */}
      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px]">
              <label className="label" htmlFor="day-book-date">
                {t("common.date")}
              </label>
              <FlexibleDateInput
                id="day-book-date"
                value={date}
                onChange={(event) => changeDate(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 pb-1">
              <button
                type="button"
                className="btn-ghost min-h-[40px] px-2"
                aria-label={t("dayBook.previousDay")}
                onClick={() => changeDate(shiftIsoDate(date, -1))}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="btn-ghost min-h-[40px] px-2"
                aria-label={t("dayBook.nextDay")}
                onClick={() => changeDate(shiftIsoDate(date, 1))}
              >
                <ChevronRight size={18} />
              </button>
              {!isToday ? (
                <button
                  type="button"
                  className="btn-secondary min-h-[40px] px-3 text-xs"
                  onClick={() => changeDate(todayISODate())}
                >
                  {t("dayBook.today")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RefreshButton refreshing={refreshing} onClick={handleRefresh} className="min-h-[40px]" />
            <button type="button" className="btn-secondary min-h-[40px] gap-2 text-xs" onClick={handlePrint}>
              <Printer size={14} /> {t("dayBook.print")}
            </button>
            <button type="button" className="btn-secondary min-h-[40px] gap-2 text-xs" onClick={handleExport} disabled={exporting || loading}>
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t("dayBook.exportCsv")}
            </button>
          </div>
        </div>

        <form className="flex flex-wrap items-end gap-2" onSubmit={handleSearchSubmit}>
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="day-book-search">
              {t("common.search")}
            </label>
            <input
              id="day-book-search"
              className="input"
              value={search}
              placeholder={t("dayBook.searchPlaceholder")}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary min-h-[40px] px-4 text-sm">
            {t("common.search")}
          </button>
          {appliedSearch ? (
            <button
              type="button"
              className="btn-ghost min-h-[40px] px-3 text-xs"
              onClick={() => {
                setSearch("");
                setAppliedSearch("");
                setPage(1);
              }}
            >
              {t("common.clear")}
            </button>
          ) : null}
        </form>
      </div>

      {error ? <Notice title={error} tone="error" /> : null}
      {report.entriesFiltered ? <Notice title={t("dayBook.entriesFiltered")} tone="info" /> : null}

      <div ref={printRef} className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-ink dark:text-slate-100">{t("dayBook.title")}</h3>
            <p className="text-xs text-secondary-500 dark:text-secondary-400">{dayLabel}</p>
          </div>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {t("dayBook.entryCount", { count: totals.count || 0 })}
          </p>
        </div>

        {/* What the owner actually came for */}
        <div className={STATS_GRID_CLASS}>
          <StatsCard
            title={t("dayBook.totalOnHand")}
            value={formatCurrency(totals.closing)}
            hint={`${t("dayBook.opening")} ${formatCurrency(totals.opening)}`}
            icon={WalletCards}
            tone="info"
            loading={loading}
          />
          <StatsCard
            title={t("dayBook.cashInHand")}
            value={formatCurrency(totals.cash?.closing)}
            hint={`${t("dayBook.opening")} ${formatCurrency(totals.cash?.opening)}`}
            icon={Wallet}
            loading={loading}
          />
          <StatsCard
            title={t("dayBook.moneyIn")}
            value={formatCurrency(totals.in)}
            icon={ArrowDownLeft}
            tone="success"
            loading={loading}
          />
          <StatsCard
            title={t("dayBook.moneyOut")}
            value={formatCurrency(totals.out)}
            icon={ArrowUpRight}
            tone="danger"
            loading={loading}
          />
        </div>

        {/* Opening cash: the one figure the app cannot work out on its own */}
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-slate-100">
                {t("dayBook.openingCash")}: {formatCurrency(report.cashOpeningBalance)}
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">
                {t("dayBook.openingCashHint")}
              </p>
            </div>
            {canSetOpeningCash && !editingCash ? (
              <button type="button" className="btn-secondary min-h-[36px] gap-2 text-xs print:hidden" onClick={startEditingCash}>
                <Pencil size={13} /> {t("dayBook.setOpeningCash")}
              </button>
            ) : null}
          </div>

          {editingCash ? (
            <form className="flex flex-wrap items-end gap-2 print:hidden" onSubmit={handleCashSave}>
              <div className="min-w-[160px]">
                <label className="label" htmlFor="day-book-opening-cash">
                  {t("dayBook.openingCash")}
                </label>
                <input
                  id="day-book-opening-cash"
                  className="input"
                  type="number"
                  step="0.01"
                  value={cashDraft}
                  onChange={(event) => setCashDraft(event.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary min-h-[40px] px-4 text-sm" disabled={cashSaving}>
                {cashSaving ? <Loader2 size={14} className="animate-spin" /> : t("common.save")}
              </button>
              <button
                type="button"
                className="btn-ghost min-h-[40px] px-3 text-xs"
                onClick={() => setEditingCash(false)}
                disabled={cashSaving}
              >
                {t("common.cancel")}
              </button>
            </form>
          ) : null}

          {cashError ? <Notice title={cashError} tone="error" /> : null}
          {cashNotice ? <Notice title={cashNotice} tone="success" /> : null}
        </div>

        {/* Account by account */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
            {t("dayBook.accounts")}
          </h4>

          {loading && !accounts.length ? (
            <div className="card flex items-center gap-2 text-sm text-secondary-500">
              <Loader2 size={16} className="animate-spin" /> {t("common.loading")}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account) => (
                <AccountCard key={`${account.type}-${account.id}`} account={account} isToday={isToday} t={t} />
              ))}
            </div>
          )}
        </div>

        {/* The movements behind the figures */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
            {t("dayBook.entries")}
          </h4>
          {report.total > PAGE_SIZE ? (
            <p className="text-xs text-secondary-500 dark:text-secondary-400">
              {t("pagination.showing", {
                start: (page - 1) * PAGE_SIZE + 1,
                end: Math.min(page * PAGE_SIZE, report.total),
                total: report.total,
              })}
            </p>
          ) : null}

          {!loading && !(report.entries || []).length ? (
            <Notice title={t("dayBook.noEntries")} description={t("dayBook.noEntriesHint")} tone="info" />
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-secondary-50/80 text-left text-xs uppercase tracking-wide text-secondary-500 dark:bg-slate-900/60 dark:text-secondary-400">
                  <tr>
                    <th className="px-3 py-2">{t("common.date")}</th>
                    <th className="px-3 py-2">{t("dayBook.source")}</th>
                    <th className="px-3 py-2">{t("dayBook.account")}</th>
                    <th className="px-3 py-2">{t("dayBook.party")}</th>
                    <th className="px-3 py-2">{t("dayBook.reference")}</th>
                    <th className="px-3 py-2 text-right">{t("dayBook.moneyIn")}</th>
                    <th className="px-3 py-2 text-right">{t("dayBook.moneyOut")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200/70 dark:divide-slate-800/70">
                  {(report.entries || []).map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-secondary-500">
                        {formatMaybeDate(entry.date, "D MMM")}
                      </td>
                      <td className="px-3 py-2">{entry.category}</td>
                      <td className="px-3 py-2 text-xs text-secondary-500">
                        {accountNameFor(entry, accounts, t)}
                      </td>
                      <td className="px-3 py-2">{entry.partyName || "—"}</td>
                      <td className="px-3 py-2 text-xs text-secondary-500">{entry.invoiceNo || entry.note || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.kind === "in" ? formatCurrency(entry.amount) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {entry.kind === "out" ? formatCurrency(entry.amount) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {report.total > PAGE_SIZE ? (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={report.total}
          onPageChange={setPage}
          showPageSize={false}
        />
      ) : null}
    </div>
  );
}

function accountNameFor(entry, accounts, t) {
  if (entry.accountType === "cash") return t("dayBook.cashInHand");
  const match = accounts.find((account) => account.id === entry.accountId);
  if (match) return match.name;
  if (entry.accountType === "cash") return t("dayBook.cashInHand");
  return entry.paymentMethod || "—";
}

function AccountCard({ account, isToday, t }) {
  const Icon = ACCOUNT_ICONS[account.type] || WalletCards;
  // Only meaningful for today: the stored balance is a live figure, not history.
  const hasGap = account.type === "bank"
    && isToday
    && account.recordedBalance !== undefined
    && account.recordedBalance !== null
    && Math.abs(account.closing - account.recordedBalance) > 0.009;

  return (
    <div className="rounded-2xl border border-secondary-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-ink dark:text-slate-100">{account.type === "cash" ? t("dayBook.cashInHand") : account.name}</p>
            {account.accountNumber ? (
              <p className="text-[11px] text-secondary-500 dark:text-secondary-400">{account.accountNumber}</p>
            ) : null}
            {account.type === "other" ? (
              <p className="text-[11px] text-secondary-500 dark:text-secondary-400">{t("dayBook.walletAccount")}</p>
            ) : null}
          </div>
        </div>
        {account.isActive === false ? (
          <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-500 dark:bg-slate-800 dark:text-secondary-400">
            {t("dayBook.inactive")}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-2xl font-bold text-ink dark:text-slate-100">{formatCurrency(account.closing)}</p>
      <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
        {t("dayBook.closing")}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.opening")}</dt>
          <dd className="font-semibold text-ink dark:text-slate-200">{formatCurrency(account.opening)}</dd>
        </div>
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.moneyIn")}</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(account.in)}</dd>
        </div>
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.moneyOut")}</dt>
          <dd className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrency(account.out)}</dd>
        </div>
      </dl>

      {hasGap ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {t("dayBook.reconcileGap")} {t("dayBook.appBalance")}: {formatCurrency(account.recordedBalance)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
