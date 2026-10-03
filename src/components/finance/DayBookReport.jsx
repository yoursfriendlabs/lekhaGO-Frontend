import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Landmark,
  Loader2,
  Pencil,
  Printer,
  Scale,
  Search,
  Wallet,
  WalletCards,
  X,
} from "lucide-react";
import StatsCard, { STATS_GRID_CLASS } from "../ui/StatsCard.jsx";
import Notice from "../ui/Notice";
import Pagination from "../ui/Pagination";
import RefreshButton from "../ui/RefreshButton.jsx";
import DayBookDateFilter, { describeRange } from "./DayBookDateFilter.jsx";
import { MoneyFlowChart, MoneyOnHandChart } from "./DayBookCharts.jsx";
import { api, invalidateApiCache } from "../../lib/api";
import { formatCurrency } from "../../lib/money/currency";
import { useI18n } from "../../lib/i18n.jsx";
import { useAuth } from "../../lib/auth";
import { useBusinessSettings } from "../../lib/business/businessSettings";
import { todayISODate, formatMaybeDate } from "../../lib/dates/datetime";
import { printElement } from "../../lib/print/print";

const PAGE_SIZE = 25;

const EMPTY_GROUP = Object.freeze({ opening: 0, in: 0, out: 0, closing: 0, count: 0, inCount: 0, outCount: 0 });

const EMPTY_REPORT = Object.freeze({
  from: "",
  to: "",
  cashOpeningBalance: 0,
  accounts: [],
  totals: { ...EMPTY_GROUP, cash: EMPTY_GROUP, bank: EMPTY_GROUP, other: EMPTY_GROUP },
  series: [],
  entries: [],
  entriesFiltered: false,
  total: 0,
});

const ACCOUNT_ICONS = { cash: Wallet, bank: Landmark, other: WalletCards };

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
 * The day book: money closed off per account over a chosen span, so an owner
 * reads cash in hand and every bank balance from one screen.
 *
 * Two rules hold throughout. Balances and charts always cover the whole span,
 * because a balance that honoured a search box would not be a balance. The
 * entry list underneath is the only thing the filters touch — which is why the
 * money in and money out figures double as the direction filter, and the
 * account cards double as the account filter.
 */
export default function DayBookReport() {
  const { t } = useI18n();
  const { businessId, canManageFeature } = useAuth();
  const { settings, saveSettings } = useBusinessSettings();

  const [range, setRange] = useState(() => ({ from: todayISODate(), to: todayISODate() }));
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [direction, setDirection] = useState("");
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
  const symbol = t("currency.symbol");
  const money = useCallback((value) => formatCurrency(value, { symbol }), [symbol]);

  const entryQuery = useMemo(() => ({
    from: range.from,
    to: range.to,
    ...(appliedSearch ? { search: appliedSearch } : {}),
    ...(accountId ? { accountId } : {}),
    ...(direction ? { direction } : {}),
  }), [accountId, appliedSearch, direction, range.from, range.to]);

  const load = useCallback(async ({ force = false } = {}) => {
    const currentRequest = ++requestId.current;
    if (!businessId) return;
    if (force) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const payload = await api.dayBookReport(
        { ...entryQuery, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
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
  }, [businessId, entryQuery, page, t]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  // Every filter change starts at the first page of entries. Paging is reset in
  // the same update as the change, so the span is only fetched once.
  const changeRange = useCallback((next) => {
    setRange(next);
    setPage(1);
  }, []);

  const toggleDirection = (next) => {
    setDirection((current) => (current === next ? "" : next));
    setPage(1);
  };

  const toggleAccount = (next) => {
    setAccountId((current) => (current === next ? "" : next || ""));
    setPage(1);
  };

  const handleRefresh = () => {
    invalidateApiCache(["day-book", "reports"]);
    load({ force: true });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const clearEntryFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setAccountId("");
    setDirection("");
    setPage(1);
  };

  const accounts = report.accounts || [];
  const totals = report.totals || EMPTY_REPORT.totals;
  const entries = report.entries || [];
  const isRange = Boolean(report.from && report.to && report.from !== report.to);
  // A bank's stored balance is a live figure, so it only lines up with a
  // closing balance when the span ends today.
  const endsToday = (report.to || range.to) === todayISODate();
  const netMovement = (totals.in || 0) - (totals.out || 0);

  const rangeLabel = useMemo(
    () => describeRange(report.from || range.from, report.to || range.to, t),
    [range.from, range.to, report.from, report.to, t],
  );

  const accountLabel = useCallback((id) => {
    if (!id) return "";
    if (id === "cash") return t("dayBook.cashInHand");
    const match = accounts.find((account) => account.id === id);
    return match ? match.name : id;
  }, [accounts, t]);

  const activeFilters = useMemo(() => {
    const list = [];
    if (direction) {
      list.push({
        key: "direction",
        label: direction === "in" ? t("dayBook.moneyIn") : t("dayBook.moneyOut"),
        clear: () => { setDirection(""); setPage(1); },
      });
    }
    if (accountId) {
      list.push({
        key: "account",
        label: accountLabel(accountId),
        clear: () => { setAccountId(""); setPage(1); },
      });
    }
    if (appliedSearch) {
      list.push({
        key: "search",
        label: `“${appliedSearch}”`,
        clear: () => { setSearch(""); setAppliedSearch(""); setPage(1); },
      });
    }
    return list;
  }, [accountId, accountLabel, appliedSearch, direction, t]);

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
      const exportEntries = [];
      let exportReport;
      for (let offset = 0; ;) {
        const next = await api.dayBookReport({ ...entryQuery, limit: 200, offset }, { force: true });
        if (!exportReport) exportReport = next;
        exportEntries.push(...next.entries);
        if (exportEntries.length >= next.total || !next.entries.length) break;
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
      const entryRows = exportEntries.map((entry) => [
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
        `day-book-${exportReport.from || range.from}-${exportReport.to || range.to}.csv`,
      );
    } catch (err) {
      setError(err?.message || t("dayBook.loadFailed"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Span, scope and actions */}
      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <DayBookDateFilter
              from={range.from}
              to={range.to}
              disabled={loading && !report.from}
              onChange={changeRange}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:pt-1">
            <RefreshButton refreshing={refreshing} onClick={handleRefresh} className="min-h-[40px]" />
            <button type="button" className="btn-secondary min-h-[40px] gap-2 text-xs" onClick={handlePrint}>
              <Printer size={14} /> {t("dayBook.print")}
            </button>
            <button
              type="button"
              className="btn-secondary min-h-[40px] gap-2 text-xs"
              onClick={handleExport}
              disabled={exporting || loading}
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {t("dayBook.exportCsv")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t border-secondary-200/70 pt-4 sm:grid-cols-[minmax(0,14rem)_1fr] dark:border-slate-800/60">
          <div className="min-w-0">
            <label className="label" htmlFor="day-book-account">{t("dayBook.account")}</label>
            <select
              id="day-book-account"
              className="input mt-1"
              value={accountId}
              onChange={(event) => toggleAccount(event.target.value)}
            >
              <option value="">{t("dayBook.allAccounts")}</option>
              {accounts.map((account) => (
                <option key={`${account.type}-${account.id}`} value={account.id}>
                  {account.type === "cash" ? t("dayBook.cashInHand") : account.name}
                </option>
              ))}
            </select>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={handleSearchSubmit}>
            <div className="min-w-[180px] flex-1">
              <label className="label" htmlFor="day-book-search">{t("common.search")}</label>
              <input
                id="day-book-search"
                className="input mt-1"
                value={search}
                placeholder={t("dayBook.searchPlaceholder")}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary min-h-[40px] gap-2 px-4 text-sm">
              <Search size={14} /> {t("common.search")}
            </button>
          </form>
        </div>
      </div>

      {error ? <Notice title={error} tone="error" /> : null}

      <div ref={printRef} className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-ink dark:text-slate-100">{t("dayBook.title")}</h3>
            <p className="text-xs text-secondary-500 dark:text-secondary-400">{rangeLabel}</p>
          </div>
          <p className="text-xs text-secondary-500 dark:text-secondary-400">
            {t("dayBook.entryCount", { count: totals.count || 0 })}
          </p>
        </div>

        {/* What the owner actually came for. The last two are also the direction filter. */}
        <div className={STATS_GRID_CLASS}>
          <StatsCard
            title={t("dayBook.totalOnHand")}
            value={money(totals.closing)}
            hint={`${t("dayBook.opening")} ${money(totals.opening)}`}
            icon={WalletCards}
            tone="info"
            loading={loading}
          />
          <StatsCard
            title={t("dayBook.netMovement")}
            value={`${netMovement > 0 ? "+" : netMovement < 0 ? "−" : ""}${money(Math.abs(netMovement))}`}
            hint={t("dayBook.netMovementHint")}
            icon={Scale}
            tone={netMovement > 0 ? "success" : netMovement < 0 ? "danger" : "default"}
            loading={loading}
          />
          <StatsCard
            id="day-book-money-in"
            title={t("dayBook.moneyIn")}
            value={money(totals.in)}
            hint={totals.inCount
              ? t("dayBook.movementCount", { count: totals.inCount })
              : t("dayBook.nothingCameIn")}
            icon={ArrowDownLeft}
            tone="success"
            loading={loading}
            isActive={direction === "in"}
            onClick={totals.inCount || direction === "in" ? () => toggleDirection("in") : undefined}
          />
          <StatsCard
            id="day-book-money-out"
            title={t("dayBook.moneyOut")}
            value={money(totals.out)}
            hint={totals.outCount
              ? t("dayBook.movementCount", { count: totals.outCount })
              : t("dayBook.nothingWentOut")}
            icon={ArrowUpRight}
            tone="danger"
            loading={loading}
            isActive={direction === "out"}
            onClick={totals.outCount || direction === "out" ? () => toggleDirection("out") : undefined}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <MoneyFlowChart
            series={report.series}
            accounts={accounts}
            byAccount={!isRange}
            loading={loading}
            symbol={symbol}
            t={t}
          />
          <MoneyOnHandChart
            accounts={accounts}
            loading={loading}
            symbol={symbol}
            activeAccountId={accountId}
            onSelectAccount={toggleAccount}
            t={t}
          />
        </div>

        {/* Account by account. Each card scopes the entry list to that account. */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-bold uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
              {t("dayBook.accounts")}
            </h4>
            <p className="text-xs text-secondary-500 dark:text-secondary-400 print:hidden">
              {t("dayBook.accountCardHint")}
            </p>
          </div>

          {loading && !accounts.length ? (
            <div className="card flex items-center gap-2 text-sm text-secondary-500">
              <Loader2 size={16} className="animate-spin" /> {t("common.loading")}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {accounts.map((account) => (
                <AccountCard
                  key={`${account.type}-${account.id}`}
                  account={account}
                  canReconcile={!isRange && endsToday}
                  isActive={accountId === account.id}
                  onSelect={() => toggleAccount(account.id)}
                  money={money}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* Opening cash: the one figure the app cannot work out on its own */}
        <div className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink dark:text-slate-100">
                {t("dayBook.openingCash")}: {money(report.cashOpeningBalance)}
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-400">
                {t("dayBook.openingCashHint")}
              </p>
            </div>
            {canSetOpeningCash && !editingCash ? (
              <button
                type="button"
                className="btn-secondary min-h-[36px] gap-2 text-xs print:hidden"
                onClick={startEditingCash}
              >
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

        {/* The movements behind the figures */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
          </div>

          {activeFilters.length ? (
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <span className="text-xs text-secondary-500 dark:text-secondary-400">
                {t("dayBook.showingOnly")}
              </span>
              {activeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-xs font-semibold text-primary-700 transition hover:bg-primary/20 dark:text-primary-200"
                >
                  {filter.label}
                  <X size={12} />
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-secondary-600 underline-offset-2 hover:underline dark:text-secondary-400"
                onClick={clearEntryFilters}
              >
                {t("common.clear")}
              </button>
            </div>
          ) : null}

          {report.entriesFiltered ? (
            <p className="text-xs text-secondary-500 dark:text-secondary-400">{t("dayBook.entriesFiltered")}</p>
          ) : null}

          {!loading && !entries.length ? (
            <Notice
              title={activeFilters.length ? t("dayBook.noMatchingEntries") : t("dayBook.noEntries")}
              description={activeFilters.length ? t("dayBook.noMatchingEntriesHint") : t("dayBook.noEntriesHint")}
              tone="info"
            />
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
                  {entries.map((entry) => (
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
                        {entry.kind === "in" ? money(entry.amount) : ""}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-rose-600 dark:text-rose-400">
                        {entry.kind === "out" ? money(entry.amount) : ""}
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
  return entry.paymentMethod || "—";
}

function AccountCard({ account, canReconcile, isActive, onSelect, money, t }) {
  const Icon = ACCOUNT_ICONS[account.type] || WalletCards;
  // Comparing a computed closing balance against the one stored on the bank row
  // only reconciles on today; on any earlier day the stored figure has moved on.
  const hasGap = account.type === "bank"
    && canReconcile
    && account.recordedBalance !== undefined
    && account.recordedBalance !== null
    && Math.abs(account.closing - account.recordedBalance) > 0.009;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-2xl border bg-white/90 p-4 shadow-sm transition hover:shadow dark:bg-slate-900/70 ${
        isActive
          ? "border-primary ring-1 ring-primary/40"
          : "border-secondary-200/70 hover:border-primary/40 dark:border-slate-800/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-primary/10 p-2 text-primary">
            <Icon size={16} />
          </span>
          <div>
            <p className="text-sm font-bold text-ink dark:text-slate-100">
              {account.type === "cash" ? t("dayBook.cashInHand") : account.name}
            </p>
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

      <p className="mt-3 text-2xl font-bold text-ink dark:text-slate-100">{money(account.closing)}</p>
      <p className="text-[11px] uppercase tracking-wide text-secondary-500 dark:text-secondary-400">
        {t("dayBook.closing")}
      </p>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.opening")}</dt>
          <dd className="font-semibold text-ink dark:text-slate-200">{money(account.opening)}</dd>
        </div>
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.moneyIn")}</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">{money(account.in)}</dd>
        </div>
        <div>
          <dt className="text-secondary-500 dark:text-secondary-400">{t("dayBook.moneyOut")}</dt>
          <dd className="font-semibold text-rose-600 dark:text-rose-400">{money(account.out)}</dd>
        </div>
      </dl>

      {hasGap ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {t("dayBook.reconcileGap")} {t("dayBook.appBalance")}: {money(account.recordedBalance)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
