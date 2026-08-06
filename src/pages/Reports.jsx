import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
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
  TrendingUp,
  PieChart as PieIcon,
  BarChart2,
  TableProperties,
  ArrowUp,
  ArrowDown,
  Coffee,
  BookOpen,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Notice from "../components/Notice";
import BarGraph from "../components/BarGraph";
import PieChart from "../components/PieChart";
import Pagination from '../components/Pagination';
import PartyFilterSelect from "../components/PartyFilterSelect.jsx";
import RefreshButton from "../components/RefreshButton.jsx";
import { api, invalidateApiCache, API_BASE } from "../lib/api";
import { formatCurrency } from "../lib/currency";
import { useI18n } from "../lib/i18n.jsx";
import { useAuth } from "../lib/auth";
import { useBusinessSettings } from "../lib/businessSettings";
import dayjs, { formatMaybeDate, todayISODate } from "../lib/datetime";
import { normalizeLookupParty, toPartyLookupOption } from '../lib/lookups.js';
import { getPaymentTypeDisplay, hasPaymentTypeData } from '../lib/paymentType';
import { printElement } from '../lib/print';

const EMPTY_METRIC_TOTALS = Object.freeze({
  count: 0,
  total: 0,
  cashReceived: 0,
  cashPaid: 0,
  pending: 0,
});

const EMPTY_SUMMARY = Object.freeze({
  totals: {
    sales: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    directSales: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    services: { ...EMPTY_METRIC_TOTALS, cashReceived: 0 },
    purchases: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    expenses: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    purchasesAndExpenses: { ...EMPTY_METRIC_TOTALS, cashPaid: 0 },
    combined: {
      revenue: 0,
      expenses: 0,
      cashIn: 0,
      cashOut: 0,
      netCash: 0,
      pendingReceivable: 0,
      pendingPayable: 0,
      profitOrLoss: 0,
      profitOrLossStatus: "break_even",
    },
  },
  series: {
    sales: [],
    directSales: [],
    services: [],
    purchases: [],
    expenses: [],
    purchasesAndExpenses: [],
    profitLoss: [],
    timeline: [],
  },
});

const EMPTY_PROFIT_LOSS = Object.freeze({
  summary: {
    profitLoss: {
      revenue: 0,
      purchases: 0,
      expenses: 0,
      totalExpenses: 0,
      amount: 0,
      status: "break_even",
    },
    current: {
      label: "",
      revenue: 0,
      directSales: 0,
      services: 0,
      purchases: 0,
      expenses: 0,
      totalExpenses: 0,
      amount: 0,
      status: "break_even",
    },
  },
  series: {
    profitLoss: [],
  },
});

const EMPTY_POPULAR_ANALYTICS = Object.freeze({
  range: {
    from: null,
    to: null,
    limit: 10,
  },
  items: [],
  total: 0,
});

const EMPTY_EXPENSE_CATEGORY_ANALYTICS = Object.freeze({
  hasCategoryContract: false,
  range: {
    partyId: null,
    supplierId: null,
    categoryKey: null,
  },
  totals: {
    ...EMPTY_METRIC_TOTALS,
    cashPaid: 0,
  },
  summary: {
    totalCategories: 0,
    categorizedCategories: 0,
    uncategorizedCategories: 0,
    categorizedAmount: 0,
    uncategorizedAmount: 0,
    topCategory: null,
  },
  timeline: [],
  breakdown: [],
});

function asNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(source, keys = []) {
  for (const key of keys) {
    const parsed = Number(source?.[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeStringList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function getProfitLossStatus(amount) {
  if (amount > 0) return "profit";
  if (amount < 0) return "loss";
  return "break_even";
}

function formatSeriesLabel(rawLabel, fallbackLabel) {
  const label = rawLabel ? String(rawLabel) : fallbackLabel;
  if (/^\d{4}-\d{2}$/.test(label)) {
    const parsedMonth = dayjs(`${label}-01`);
    return parsedMonth.isValid() ? parsedMonth.format("MMM YYYY") : label;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(label) || label.includes("T")) {
    const parsedDate = dayjs(label);
    return parsedDate.isValid() ? parsedDate.format("D MMM") : label;
  }
  return label;
}

function DatePresetSelect({ fromValue, toValue, onChange }) {
  const today = dayjs();
  
  const getPreset = () => {
    if (!fromValue || !toValue) return "";
    
    const todayStr = today.format("YYYY-MM-DD");
    if (fromValue === todayStr && toValue === todayStr) return "today";
    
    const startOfWeek = today.startOf("week").format("YYYY-MM-DD");
    const endOfWeek = today.endOf("week").format("YYYY-MM-DD");
    if (fromValue === startOfWeek && toValue === endOfWeek) return "week";
    
    const startOfMonth = today.startOf("month").format("YYYY-MM-DD");
    const endOfMonth = today.endOf("month").format("YYYY-MM-DD");
    if (fromValue === startOfMonth && toValue === endOfMonth) return "month";
    
    const startOfYear = today.startOf("year").format("YYYY-MM-DD");
    const endOfYear = today.endOf("year").format("YYYY-MM-DD");
    if (fromValue === startOfYear && toValue === endOfYear) return "year";
    
    const startOfPrevYear = today.subtract(1, "year").startOf("year").format("YYYY-MM-DD");
    const endOfPrevYear = today.subtract(1, "year").endOf("year").format("YYYY-MM-DD");
    if (fromValue === startOfPrevYear && toValue === endOfPrevYear) return "prev_year";
    
    return "custom";
  };

  const handleSelect = (e) => {
    const val = e.target.value;
    let from = "";
    let to = "";
    if (val === "today") {
      from = today.format("YYYY-MM-DD");
      to = today.format("YYYY-MM-DD");
    } else if (val === "week") {
      from = today.startOf("week").format("YYYY-MM-DD");
      to = today.endOf("week").format("YYYY-MM-DD");
    } else if (val === "month") {
      from = today.startOf("month").format("YYYY-MM-DD");
      to = today.endOf("month").format("YYYY-MM-DD");
    } else if (val === "year") {
      from = today.startOf("year").format("YYYY-MM-DD");
      to = today.endOf("year").format("YYYY-MM-DD");
    } else if (val === "prev_year") {
      from = today.subtract(1, "year").startOf("year").format("YYYY-MM-DD");
      to = today.subtract(1, "year").endOf("year").format("YYYY-MM-DD");
    }
    if (from && to) {
      onChange(from, to);
    }
  };

  return (
    <div className="w-full">
      <label className="label">Date Preset</label>
      <select
        className="input mt-1 w-full"
        value={getPreset()}
        onChange={handleSelect}
      >
        <option value="" disabled>Select Range...</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
        <option value="year">This Year</option>
        <option value="prev_year">Previous Year</option>
        <option value="custom" disabled>Custom Range</option>
      </select>
    </div>
  );
}

function getGroupByDateRange(groupBy) {
  const today = dayjs();
  if (groupBy === "day") {
    const value = today.format("YYYY-MM-DD");
    return { fromDate: value, toDate: value };
  }
  if (groupBy === "week") {
    return {
      fromDate: today.startOf("week").format("YYYY-MM-DD"),
      toDate: today.endOf("week").format("YYYY-MM-DD"),
    };
  }
  if (groupBy === "month") {
    return {
      fromDate: today.startOf("month").format("YYYY-MM-DD"),
      toDate: today.endOf("month").format("YYYY-MM-DD"),
    };
  }
  return null;
}

// Stats normalizers
function normalizeMetricTotals(source, cashKey) {
  const base =
    source && typeof source === "object" && !Array.isArray(source)
      ? source
      : {};
  const totalFallback = asNumber(source);
  return {
    count: asNumber(base.count),
    total: firstNumber(base, ["total", "amount"]) ?? totalFallback,
    [cashKey]: firstNumber(base, [cashKey]) ?? 0,
    pending: firstNumber(base, ["pending"]) ?? 0,
  };
}

function combineMetricTotals(primary, secondary, cashKey) {
  return {
    count: asNumber(primary?.count) + asNumber(secondary?.count),
    total: asNumber(primary?.total) + asNumber(secondary?.total),
    [cashKey]: asNumber(primary?.[cashKey]) + asNumber(secondary?.[cashKey]),
    pending: asNumber(primary?.pending) + asNumber(secondary?.pending),
  };
}

function normalizeCombinedTotals(source, revenueTotals, expenseTotals) {
  const base =
    source && typeof source === "object" && !Array.isArray(source)
      ? source
      : {};
  const revenue =
    firstNumber(base, ["revenue", "revenueTotal"]) ??
    asNumber(revenueTotals?.total);
  const expenses =
    firstNumber(base, ["expenses", "expenseTotal", "totalExpenses"]) ??
    asNumber(expenseTotals?.total);
  const cashIn =
    firstNumber(base, ["cashIn", "cashInTotal"]) ??
    asNumber(revenueTotals?.cashReceived);
  const cashOut =
    firstNumber(base, ["cashOut", "cashOutTotal"]) ??
    asNumber(expenseTotals?.cashPaid);
  const profitOrLoss =
    firstNumber(base, ["profitOrLoss"]) ?? revenue - expenses;

  return {
    revenue,
    expenses,
    cashIn,
    cashOut,
    netCash: firstNumber(base, ["netCash"]) ?? cashIn - cashOut,
    pendingReceivable:
      firstNumber(base, ["pendingReceivable"]) ??
      asNumber(revenueTotals?.pending),
    pendingPayable:
      firstNumber(base, ["pendingPayable"]) ?? asNumber(expenseTotals?.pending),
    profitOrLoss,
    profitOrLossStatus:
      base.profitOrLossStatus || getProfitLossStatus(profitOrLoss),
  };
}

function normalizeBreakdownSeries(
  items,
  { totalKeys, cashKeys, pendingKeys, cashField = "received" },
) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const rawLabel =
      item?.label ||
      item?.periodLabel ||
      item?.period ||
      item?.date ||
      item?.bucketStart ||
      item?.key;
    return {
      key: String(
        item?.key || item?.period || item?.date || item?.bucketStart || index,
      ),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      total: firstNumber(item, totalKeys) ?? 0,
      [cashField]: firstNumber(item, cashKeys) ?? 0,
      pending: firstNumber(item, pendingKeys) ?? 0,
    };
  });
}

function normalizeProfitLossSeries(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const rawLabel =
      item?.label ||
      item?.periodLabel ||
      item?.period ||
      item?.date ||
      item?.bucketStart ||
      item?.key;
    const revenue =
      firstNumber(item, ["revenue", "salesAndServicesTotal"]) ?? 0;
    const totalExpenses =
      firstNumber(item, ["totalExpenses", "purchaseAndExpenseTotal"]) ?? 0;
    const profitOrLoss =
      firstNumber(item, ["profitOrLoss", "amount"]) ?? revenue - totalExpenses;
    const salaryExpenses = firstNumber(item, ["salaryExpenses"]) ?? 0;
    const expenses =
      firstNumber(item, ["expenses", "directExpenseTotal", "expenseTotal"]) ??
      0;
    const generalExpenses = Math.max(0, expenses - salaryExpenses);

    return {
      key: String(
        item?.key || item?.period || item?.date || item?.bucketStart || index,
      ),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      revenue,
      directSales: firstNumber(item, ["directSales", "salesTotal"]) ?? 0,
      services: firstNumber(item, ["services", "serviceTotal"]) ?? 0,
      purchases: firstNumber(item, ["purchases", "purchaseTotal"]) ?? 0,
      expenses,
      salaryExpenses,
      generalExpenses,
      totalExpenses,
      profitOrLoss,
      status:
        item?.status ||
        item?.profitOrLossStatus ||
        getProfitLossStatus(profitOrLoss),
    };
  });
}

function normalizeTimelineSeries(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const rawLabel =
      item?.label ||
      item?.periodLabel ||
      item?.period ||
      item?.date ||
      item?.bucketStart ||
      item?.key;
    const directSalesTotal =
      firstNumber(item, [
        "directSalesTotal",
        "salesTotal",
        "directSales",
        "salesAmount",
      ]) ?? 0;
    const directSalesCashReceived =
      firstNumber(item, ["directSalesCashReceived", "salesCashReceived"]) ?? 0;
    const directSalesPending =
      firstNumber(item, ["directSalesPending", "salesPending"]) ?? 0;
    const serviceTotal =
      firstNumber(item, ["serviceTotal", "services", "serviceAmount"]) ?? 0;
    const serviceCashReceived = firstNumber(item, ["serviceCashReceived"]) ?? 0;
    const servicePending = firstNumber(item, ["servicePending"]) ?? 0;
    const salesTotal =
      firstNumber(item, ["salesAndServicesTotal", "revenueTotal"]) ??
      directSalesTotal + serviceTotal;
    const salesCashReceived =
      firstNumber(item, ["salesAndServicesCashReceived", "cashInTotal"]) ??
      directSalesCashReceived + serviceCashReceived;
    const salesPending =
      firstNumber(item, ["salesAndServicesPending"]) ??
      directSalesPending + servicePending;
    const purchaseTotal =
      firstNumber(item, ["purchaseTotal", "purchases", "purchaseAmount"]) ?? 0;
    const purchaseCashPaid = firstNumber(item, ["purchaseCashPaid"]) ?? 0;
    const purchasePending = firstNumber(item, ["purchasePending"]) ?? 0;
    const expenseTotal =
      firstNumber(item, ["directExpenseTotal", "expenseTotal", "expenses"]) ??
      0;
    const salaryExpenses = firstNumber(item, ["salaryExpenses"]) ?? 0;
    const generalExpenses = Math.max(0, expenseTotal - salaryExpenses);
    const expenseCashPaid =
      firstNumber(item, ["directExpenseCashPaid", "expenseCashPaid"]) ?? 0;
    const expensePending =
      firstNumber(item, ["directExpensePending", "expensePending"]) ?? 0;
    const purchasesAndExpensesTotal =
      firstNumber(item, [
        "purchaseAndExpenseTotal",
        "purchasesAndExpensesTotal",
        "totalExpenses",
      ]) ?? purchaseTotal + expenseTotal;
    const purchasesAndExpensesCashPaid =
      firstNumber(item, ["purchaseAndExpenseCashPaid", "cashOutTotal"]) ??
      purchaseCashPaid + expenseCashPaid;
    const purchasesAndExpensesPending =
      firstNumber(item, ["purchaseAndExpensePending"]) ??
      purchasePending + expensePending;
    const profitOrLoss =
      firstNumber(item, ["profitOrLoss", "amount"]) ??
      salesTotal - purchasesAndExpensesTotal;

    return {
      key: String(
        item?.key || item?.period || item?.date || item?.bucketStart || index,
      ),
      label: formatSeriesLabel(rawLabel, `#${index + 1}`),
      salesTotal,
      salesCashReceived,
      salesPending,
      directSalesTotal,
      directSalesCashReceived,
      directSalesPending,
      purchaseTotal,
      purchaseCashPaid,
      purchasePending,
      serviceTotal,
      serviceCashReceived,
      servicePending,
      expenseTotal,
      salaryExpenses,
      generalExpenses,
      expenseCashPaid,
      expensePending,
      purchasesAndExpensesTotal,
      purchasesAndExpensesCashPaid,
      purchasesAndExpensesPending,
      profitOrLoss,
      profitOrLossStatus:
        item?.profitOrLossStatus ||
        item?.status ||
        getProfitLossStatus(profitOrLoss),
    };
  });
}

function normalizeAnalyticsSummary(payload = {}) {
  const summary = payload && typeof payload === "object" ? payload : {};
  const totals = summary?.totals || {};
  const series = summary?.series || {};
  const timeline = normalizeTimelineSeries(series.timeline);
  const hasMergedRevenueContract =
    Boolean(totals?.directSales) || Array.isArray(series?.directSales);

  const directSalesTotals = normalizeMetricTotals(
    hasMergedRevenueContract ? totals.directSales : totals.sales,
    "cashReceived",
  );
  const servicesTotals = normalizeMetricTotals(totals.services, "cashReceived");
  const salesTotals = hasMergedRevenueContract
    ? normalizeMetricTotals(totals.sales, "cashReceived")
    : combineMetricTotals(
        normalizeMetricTotals(totals.sales, "cashReceived"),
        servicesTotals,
        "cashReceived",
      );
  const purchasesTotals = normalizeMetricTotals(totals.purchases, "cashPaid");
  const expensesTotals = normalizeMetricTotals(totals.expenses, "cashPaid");
  const purchasesAndExpensesTotals = totals.purchasesAndExpenses
    ? normalizeMetricTotals(totals.purchasesAndExpenses, "cashPaid")
    : combineMetricTotals(purchasesTotals, expensesTotals, "cashPaid");

  const rawSalesSeries = hasMergedRevenueContract
    ? normalizeBreakdownSeries(series.sales, {
        totalKeys: [
          "total",
          "salesAndServicesTotal",
          "salesTotal",
          "amount",
          "value",
        ],
        cashKeys: [
          "cashReceived",
          "salesAndServicesCashReceived",
          "salesCashReceived",
        ],
        pendingKeys: ["pending", "salesAndServicesPending", "salesPending"],
        cashField: "received",
      })
    : [];
  const rawDirectSalesSeries = normalizeBreakdownSeries(
    hasMergedRevenueContract ? series.directSales : series.sales,
    {
      totalKeys: ["total", "directSalesTotal", "salesTotal", "amount", "value"],
      cashKeys: [
        "cashReceived",
        "directSalesCashReceived",
        "salesCashReceived",
      ],
      pendingKeys: ["pending", "directSalesPending", "salesPending"],
      cashField: "received",
    },
  );
  const rawServicesSeries = normalizeBreakdownSeries(series.services, {
    totalKeys: ["total", "serviceTotal", "amount", "value"],
    cashKeys: ["cashReceived", "serviceCashReceived"],
    pendingKeys: ["pending", "servicePending"],
    cashField: "received",
  });
  const rawPurchasesSeries = normalizeBreakdownSeries(series.purchases, {
    totalKeys: ["total", "purchaseTotal", "amount", "value"],
    cashKeys: ["cashPaid", "purchaseCashPaid"],
    pendingKeys: ["pending", "purchasePending"],
    cashField: "paid",
  });
  const rawExpensesSeries = normalizeBreakdownSeries(series.expenses, {
    totalKeys: [
      "total",
      "expenseTotal",
      "directExpenseTotal",
      "amount",
      "value",
    ],
    cashKeys: ["cashPaid", "expenseCashPaid", "directExpenseCashPaid"],
    pendingKeys: ["pending", "expensePending", "directExpensePending"],
    cashField: "paid",
  });
  const rawOutgoingSeries = normalizeBreakdownSeries(
    series.purchasesAndExpenses,
    {
      totalKeys: [
        "total",
        "purchaseAndExpenseTotal",
        "purchasesAndExpensesTotal",
        "totalExpenses",
        "amount",
        "value",
      ],
      cashKeys: ["cashPaid", "purchaseAndExpenseCashPaid", "cashOutTotal"],
      pendingKeys: ["pending", "purchaseAndExpensePending"],
      cashField: "paid",
    },
  );
  const rawProfitLossSeries = normalizeProfitLossSeries(series.profitLoss);

  const fallbackSales = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.salesTotal,
    received: point.salesCashReceived,
    pending: point.salesPending,
  }));
  const fallbackDirectSales = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.directSalesTotal,
    received: point.directSalesCashReceived,
    pending: point.directSalesPending,
  }));
  const fallbackServices = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.serviceTotal,
    received: point.serviceCashReceived,
    pending: point.servicePending,
  }));
  const fallbackPurchases = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.purchaseTotal,
    paid: point.purchaseCashPaid,
    pending: point.purchasePending,
  }));
  const fallbackExpenses = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.expenseTotal,
    paid: point.expenseCashPaid,
    pending: point.expensePending,
  }));
  const fallbackOutgoing = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    total: point.purchasesAndExpensesTotal,
    paid: point.purchasesAndExpensesCashPaid,
    pending: point.purchasesAndExpensesPending,
  }));
  const fallbackProfitLoss = timeline.map((point) => ({
    key: point.key,
    label: point.label,
    revenue: point.salesTotal,
    directSales: point.directSalesTotal,
    services: point.serviceTotal,
    purchases: point.purchaseTotal,
    expenses: point.expenseTotal,
    salaryExpenses: point.salaryExpenses,
    generalExpenses: point.generalExpenses,
    totalExpenses: point.purchasesAndExpensesTotal,
    profitOrLoss: point.profitOrLoss,
    status: point.profitOrLossStatus,
  }));

  return {
    totals: {
      sales: salesTotals,
      directSales: directSalesTotals,
      services: servicesTotals,
      purchases: purchasesTotals,
      expenses: expensesTotals,
      purchasesAndExpenses: purchasesAndExpensesTotals,
      combined: normalizeCombinedTotals(
        totals.combined,
        salesTotals,
        purchasesAndExpensesTotals,
      ),
    },
    series: {
      sales: rawSalesSeries.length > 0 ? rawSalesSeries : fallbackSales,
      directSales:
        rawDirectSalesSeries.length > 0
          ? rawDirectSalesSeries
          : fallbackDirectSales,
      services:
        rawServicesSeries.length > 0 ? rawServicesSeries : fallbackServices,
      purchases:
        rawPurchasesSeries.length > 0 ? rawPurchasesSeries : fallbackPurchases,
      expenses:
        rawExpensesSeries.length > 0 ? rawExpensesSeries : fallbackExpenses,
      purchasesAndExpenses:
        rawOutgoingSeries.length > 0 ? rawOutgoingSeries : fallbackOutgoing,
      profitLoss:
        rawProfitLossSeries.length > 0
          ? rawProfitLossSeries
          : fallbackProfitLoss,
      timeline,
    },
  };
}

function normalizeProfitLossResponse(payload = {}) {
  const summary = payload && typeof payload === "object" ? payload : {};
  const summarySource = summary?.summary || {};
  const profitLossSource = summarySource?.profitLoss || {};
  const currentSource = summarySource?.current || {};
  const series = normalizeProfitLossSeries(
    summary?.series?.profitLoss || summary?.series?.timeline || [],
  );
  const totalExpenses = firstNumber(profitLossSource, ["totalExpenses"]) ?? 0;
  const totalAmount =
    firstNumber(profitLossSource, ["amount", "profitOrLoss"]) ?? 0;
  const currentAmount =
    firstNumber(currentSource, ["amount", "profitOrLoss"]) ?? 0;

  return {
    summary: {
      profitLoss: {
        revenue: firstNumber(profitLossSource, ["revenue"]) ?? 0,
        purchases: firstNumber(profitLossSource, ["purchases"]) ?? 0,
        expenses: firstNumber(profitLossSource, ["expenses"]) ?? 0,
        totalExpenses,
        amount: totalAmount,
        status: profitLossSource?.status || getProfitLossStatus(totalAmount),
      },
      current: {
        label: currentSource?.label || "",
        revenue: firstNumber(currentSource, ["revenue"]) ?? 0,
        directSales: firstNumber(currentSource, ["directSales"]) ?? 0,
        services: firstNumber(currentSource, ["services"]) ?? 0,
        purchases: firstNumber(currentSource, ["purchases"]) ?? 0,
        expenses: firstNumber(currentSource, ["expenses"]) ?? 0,
        totalExpenses: firstNumber(currentSource, ["totalExpenses"]) ?? 0,
        amount: currentAmount,
        status: currentSource?.status || getProfitLossStatus(currentAmount),
      },
    },
    series: {
      profitLoss: series,
    },
  };
}

function buildProfitLossFallback(summary) {
  const latestPoint =
    summary.series.profitLoss[summary.series.profitLoss.length - 1] || null;

  return {
    summary: {
      profitLoss: {
        revenue: summary.totals.sales.total,
        purchases: summary.totals.purchases.total,
        expenses: summary.totals.expenses.total,
        totalExpenses: summary.totals.purchasesAndExpenses.total,
        amount: summary.totals.combined.profitOrLoss,
        status: summary.totals.combined.profitOrLossStatus,
      },
      current: latestPoint
        ? {
            label: latestPoint.label,
            revenue: latestPoint.revenue,
            directSales: latestPoint.directSales,
            services: latestPoint.services,
            purchases: latestPoint.purchases,
            expenses: latestPoint.expenses,
            totalExpenses: latestPoint.totalExpenses,
            amount: latestPoint.profitOrLoss,
            status: latestPoint.status,
          }
        : {
            label: "",
            revenue: 0,
            directSales: 0,
            services: 0,
            purchases: 0,
            expenses: 0,
            totalExpenses: 0,
            amount: 0,
            status: "break_even",
          },
    },
    series: {
      profitLoss: summary.series.profitLoss,
    },
  };
}

function metricToneClasses(tone, value) {
  if (tone === "success") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "danger") return "text-rose-600 dark:text-rose-400";
  if (tone === "info") return "text-sky-600 dark:text-sky-400";
  if (tone === "warning") return "text-amber-600 dark:text-amber-400";
  if (tone === "net") {
    return asNumber(value) < 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400";
  }
  return "text-slate-500 dark:text-slate-400";
}

function formatQuantityValue(value) {
  return asNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function normalizeShareRatio(value) {
  const parsed = asNumber(value);
  if (parsed <= 0) return 0;
  if (parsed <= 1) return parsed;
  if (parsed <= 100) return parsed / 100;
  return 0;
}

function formatPercentValue(value) {
  const normalized = normalizeShareRatio(value);
  return normalized.toLocaleString(undefined, {
    style: "percent",
    minimumFractionDigits: normalized > 0 && normalized < 0.1 ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function normalizeExpenseCategoryRow(item, index = 0) {
  const total = firstNumber(item, ["total", "amount"]) ?? 0;
  const cashPaid = firstNumber(item, ["cashPaid"]) ?? 0;

  return {
    rank: asNumber(item?.rank) || index + 1,
    categoryKey: String(item?.categoryKey || item?.key || `category-${index + 1}`),
    categoryName: String(item?.categoryName || item?.name || "").trim(),
    expenseCount: asNumber(item?.expenseCount),
    lineCount: asNumber(item?.lineCount),
    lineDescriptions: normalizeStringList(item?.lineDescriptions),
    supplierNames: normalizeStringList(item?.supplierNames),
    total,
    cashPaid,
    pending: firstNumber(item, ["pending"]) ?? Math.max(total - cashPaid, 0),
    averageExpenseTotal:
      firstNumber(item, ["averageExpenseTotal", "averageTotal"]) ?? 0,
    shareOfTotal: normalizeShareRatio(
      firstNumber(item, ["shareOfTotal", "share"]) ?? 0,
    ),
    lastExpenseDate: item?.lastExpenseDate || item?.lastDate || null,
  };
}

function normalizeExpenseAnalyticsResponse(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const categories =
    source?.categories && typeof source.categories === "object"
      ? source.categories
      : null;

  if (!categories) {
    return EMPTY_EXPENSE_CATEGORY_ANALYTICS;
  }

  const summarySource =
    categories.summary && typeof categories.summary === "object"
      ? categories.summary
      : {};
  const rangeSource =
    source?.range && typeof source.range === "object" ? source.range : {};
  const breakdown = (
    Array.isArray(categories.breakdown) ? categories.breakdown : []
  )
    .map((item, index) => normalizeExpenseCategoryRow(item, index))
    .sort((left, right) => right.total - left.total || left.rank - right.rank);
  const expensesTotals = normalizeMetricTotals(source?.totals?.expenses, "cashPaid");
  const breakdownTotal = breakdown.reduce((sum, row) => sum + row.total, 0);
  const categorizedAmount =
    firstNumber(summarySource, ["categorizedAmount"]) ?? breakdownTotal;
  const uncategorizedAmount =
    firstNumber(summarySource, ["uncategorizedAmount"]) ?? 0;
  const topCategory =
    summarySource.topCategory && typeof summarySource.topCategory === "object"
      ? normalizeExpenseCategoryRow(summarySource.topCategory, 0)
      : breakdown[0] || null;
  const categorizedCategories = Math.max(
    asNumber(summarySource.categorizedCategories),
    breakdown.length,
  );
  const uncategorizedCategories = Math.max(
    asNumber(summarySource.uncategorizedCategories),
    uncategorizedAmount > 0 ? 1 : 0,
  );
  const totalCategories = Math.max(
    asNumber(summarySource.totalCategories),
    categorizedCategories + uncategorizedCategories,
  );

  return {
    hasCategoryContract: true,
    range: {
      partyId: String(rangeSource.partyId || "") || null,
      supplierId: String(rangeSource.supplierId || "") || null,
      categoryKey: String(rangeSource.categoryKey || "") || null,
    },
    totals: expensesTotals,
    summary: {
      totalCategories,
      categorizedCategories,
      uncategorizedCategories,
      categorizedAmount,
      uncategorizedAmount,
      topCategory:
        topCategory && (topCategory.total > 0 || topCategory.categoryName)
          ? topCategory
          : null,
    },
    timeline: normalizeBreakdownSeries(source?.series?.timeline, {
      totalKeys: ["total", "expenseTotal", "expenses", "amount", "value"],
      cashKeys: ["cashPaid", "expenseCashPaid", "paid"],
      pendingKeys: ["pending", "expensePending"],
      cashField: "cashPaid",
    }),
    breakdown,
  };
}

function applyExpenseCategorySelection(analytics, categoryKey) {
  if (!categoryKey) return analytics;

  const selectedKey = String(categoryKey);
  const selectedRow = analytics.breakdown.find(
    (row) => String(row.categoryKey) === selectedKey,
  );
  const backendRangeKey = String(analytics?.range?.categoryKey || "");
  const emptyTotals = {
    ...EMPTY_METRIC_TOTALS,
    cashPaid: 0,
  };

  if (!selectedRow) {
    return {
      ...analytics,
      totals: emptyTotals,
      summary: {
        ...analytics.summary,
        totalCategories: 0,
        categorizedCategories: 0,
        uncategorizedCategories: 0,
        categorizedAmount: 0,
        uncategorizedAmount: 0,
        topCategory: null,
      },
      timeline: backendRangeKey === selectedKey ? analytics.timeline : [],
      breakdown: [],
    };
  }

  return {
    ...analytics,
    totals: {
      count: selectedRow.expenseCount,
      total: selectedRow.total,
      cashPaid: selectedRow.cashPaid,
      pending: selectedRow.pending,
    },
    summary: {
      ...analytics.summary,
      totalCategories: 1,
      categorizedCategories: 1,
      uncategorizedCategories: 0,
      categorizedAmount: selectedRow.total,
      uncategorizedAmount: 0,
      topCategory: selectedRow,
    },
    timeline: backendRangeKey === selectedKey ? analytics.timeline : [],
    breakdown: [selectedRow],
  };
}

function resolveExpenseCategoryName(row, t) {
  const key = String(row?.categoryKey || "").trim();
  if (key === "staff-salary") {
    return t("staffManagement.salary", "Staff Salary");
  }
  const label = String(row?.categoryName || "").trim();
  if (label) return label;
  return t("analytics.uncategorizedCategory");
}

function normalizeCategoryFilterOption(item = {}, t) {
  const value = String(
    item?.categoryKey || item?.key || item?.category?.key || "",
  ).trim();
  let label = String(
    item?.categoryName || item?.name || item?.label || value,
  ).trim();

  if (value === "staff-salary") {
    label = t ? t("staffManagement.salary", "Staff Salary") : "Staff Salary";
  }
  if (!value) return null;
  return {
    value,
    label: label || value,
  };
}

function mergeFilterOptions(...groups) {
  const seen = new Set();
  const merged = [];
  groups.flat().forEach((item) => {
    if (!item?.value || seen.has(item.value)) return;
    seen.add(item.value);
    merged.push(item);
  });
  return merged.sort((left, right) => left.label.localeCompare(right.label));
}

function CompactValueList({ items = [], maxVisible = 4 }) {
  if (!items.length) return null;
  const visibleItems = items.slice(0, maxVisible);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {visibleItems.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-800"
        >
          {item}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function PopularRankingCard({
  title,
  subtitle,
  rows,
  loading,
  error,
  emptyLabel,
  typeLabel,
  t,
  formatMoney,
}) {
  return (
    <div className="card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-xl text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Top 10
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">{t("common.loading")}</p>
      ) : error ? (
        <Notice title={error} tone="error" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm text-slate-600 dark:text-slate-300">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <th className="py-2 text-left">{t("analytics.rank")}</th>
                <th className="py-2 text-left">{typeLabel}</th>
                <th className="py-2 text-right">{t("analytics.quantity")}</th>
                <th className="py-2 text-right">{t("analytics.orderCount")}</th>
                <th className="py-2 text-right">{t("analytics.revenue")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.rank}-${row.productId || row.categoryId || row.name || row.categoryName}`}
                  className="border-t border-slate-200/70 dark:border-slate-800/70"
                >
                  <td className="py-3 font-semibold text-slate-900 dark:text-white">
                    #{row.rank}
                  </td>
                  <td className="py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {row.name || row.categoryName || "-"}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {row.sku ? (
                          <span>
                            {t("analytics.sku")}: {row.sku}
                          </span>
                        ) : null}
                        {row.categoryName && row.name ? (
                          <span>
                            {t("analytics.categoryName")}: {row.categoryName}
                          </span>
                        ) : null}
                        {row.lineCount > 0 ? (
                          <span>
                            {t("analytics.lineCount")}: {formatQuantityValue(row.lineCount)}
                          </span>
                        ) : null}
                      </div>
                      {row.productNames?.length ? (
                        <CompactValueList items={row.productNames} />
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium text-slate-900 dark:text-white">
                    {formatQuantityValue(row.totalQuantity)}
                  </td>
                  <td className="py-3 text-right">
                    {formatQuantityValue(row.orderCount)}
                  </td>
                  <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">
                    {formatMoney(row.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ExpenseCategoryAnalyticsSection({
  analytics,
  loading,
  error,
  onRetry,
  t,
  formatMoney,
  formatCompactMoney,
  caption,
  filters,
  onFilterChange,
  categoryOptions,
}) {
  const rows = analytics.breakdown;
  const hasRows = rows.length > 0;
  const hasUncategorizedAmount = analytics.summary.uncategorizedAmount > 0;
  const topCategory = analytics.summary.topCategory;
  const chartData = rows
    .filter((row) => row.total > 0)
    .slice(0, 5)
    .map((row) => ({
      name: resolveExpenseCategoryName(row, t),
      value: row.total,
    }));
  const showEmpty =
    !loading &&
    !error &&
    !hasRows &&
    analytics.summary.categorizedAmount <= 0 &&
    analytics.summary.uncategorizedAmount <= 0;

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <DatePresetSelect
              fromValue={filters.fromDate}
              toValue={filters.toDate}
              onChange={(from, to) => {
                onFilterChange({ target: { name: 'fromDate', value: from } });
                onFilterChange({ target: { name: 'toDate', value: to } });
              }}
            />
          </div>
          <div>
            <label className="label">{t("common.from")}</label>
            <input
              type="date"
              className="input mt-1"
              name="fromDate"
              value={filters.fromDate}
              onChange={onFilterChange}
            />
          </div>
          <div>
            <label className="label">{t("common.to")}</label>
            <input
              type="date"
              className="input mt-1"
              name="toDate"
              value={filters.toDate}
              onChange={onFilterChange}
            />
          </div>
          <div>
            <label className="label">{t("analytics.categoryName")}</label>
            <select
              className="input mt-1"
              name="categoryKey"
              value={filters.categoryKey}
              onChange={onFilterChange}
            >
              <option value="">{`${t("All")} ${t("analytics.categoryName")}`}</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {loading ? t("common.loading") : caption}
        </p>
      </div>

      {loading ? (
        <div className="card">
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        </div>
      ) : error ? (
        <div className="card space-y-4">
          <Notice title={error} tone="error" />
          <div>
            <button className="btn-secondary" type="button" onClick={onRetry}>
              {t("common.retry")}
            </button>
          </div>
        </div>
      ) : showEmpty ? (
        <div className="card">
          <p className="text-sm text-slate-500">
            {t("analytics.noExpenseCategories")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card">
              <p className="text-xs uppercase text-slate-400">
                {t("analytics.expenses")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatMoney(analytics.totals.total)}
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.expenseCount")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatQuantityValue(analytics.totals.count)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.paid")}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatMoney(analytics.totals.cashPaid)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.pending")}</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">
                    {formatMoney(analytics.totals.pending)}
                  </span>
                </p>
              </div>
            </div>

            <div className="card">
              <p className="text-xs uppercase text-slate-400">
                {t("analytics.totalCategories")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatQuantityValue(analytics.summary.totalCategories)}
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.categorizedCategories")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatQuantityValue(analytics.summary.categorizedCategories)}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.uncategorizedCategories")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {formatQuantityValue(analytics.summary.uncategorizedCategories)}
                  </span>
                </p>
              </div>
            </div>

            <div className="card">
              <p className="text-xs uppercase text-slate-400">
                {t("analytics.categorizedAmount")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatMoney(analytics.summary.categorizedAmount)}
              </p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t("analytics.shareOfTotal")}:{" "}
                {formatPercentValue(
                  analytics.summary.categorizedAmount > 0 &&
                    analytics.summary.categorizedAmount +
                      analytics.summary.uncategorizedAmount >
                      0
                    ? analytics.summary.categorizedAmount /
                        (analytics.summary.categorizedAmount +
                          analytics.summary.uncategorizedAmount)
                    : 0,
                )}
              </p>
            </div>

            <div className="card">
              <p className="text-xs uppercase text-slate-400">
                {t("analytics.topCategory")}
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                {topCategory
                  ? resolveExpenseCategoryName(topCategory, t)
                  : t("common.notAvailable")}
              </p>
              <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                <p className="flex items-center justify-between gap-3">
                  <span>{t("common.total")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {topCategory ? formatMoney(topCategory.total) : "—"}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span>{t("analytics.shareOfTotal")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {topCategory ? formatPercentValue(topCategory.shareOfTotal) : "—"}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {hasUncategorizedAmount ? (
            <Notice
              title={t("analytics.uncategorizedHintTitle")}
              description={t("analytics.uncategorizedHintDescription")}
              tone="warn"
            />
          ) : null}

          {analytics.timeline.length > 0 ? (
            <BarGraph
              title={t("analytics.timelineSummary")}
              caption={caption}
              data={analytics.timeline}
              nameKey="label"
              bars={[
                {
                  dataKey: "cashPaid",
                  label: t("analytics.paid"),
                  color: "#d97706",
                },
                {
                  dataKey: "pending",
                  label: t("analytics.pending"),
                  color: "#f97316",
                },
              ]}
              valueFormatter={formatMoney}
              axisFormatter={formatCompactMoney}
            />
          ) : null}

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="card xl:col-span-1">
              <h4 className="font-serif text-xl text-slate-900 dark:text-white">
                {t("analytics.expenseCategoryChart")}
              </h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t("analytics.expenseCategoryChartSubtitle")}
              </p>

              {chartData.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  {t("analytics.noExpenseCategories")}
                </p>
              ) : (
                <div className="mt-4 h-[320px]">
                  <PieChart
                    data={chartData}
                    height={320}
                    valueFormatter={formatMoney}
                  />
                </div>
              )}
            </div>

            <div className="card xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-serif text-xl text-slate-900 dark:text-white">
                    {t("analytics.expenseCategoryRanking")}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("analytics.expenseCategoryRankingSubtitle")}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {formatQuantityValue(rows.length)} {t("analytics.points")}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {rows.map((row) => (
                  <div
                    key={`${row.categoryKey}-${row.rank}`}
                    className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                            #{row.rank}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                              {resolveExpenseCategoryName(row, t)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {t("analytics.shareOfTotal")}:{" "}
                              {formatPercentValue(row.shareOfTotal)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-lg font-semibold text-slate-900 dark:text-white">
                          {formatMoney(row.total)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {t("analytics.averageExpenseTotal")}:{" "}
                          {formatMoney(row.averageExpenseTotal)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width: `${Math.min(
                            Math.max(row.shareOfTotal * 100, 0),
                            100,
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-4 grid gap-3 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="uppercase tracking-[0.14em]">{t("analytics.paid")}</p>
                        <p className="mt-1 font-medium text-emerald-600 dark:text-emerald-400">
                          {formatMoney(row.cashPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.14em]">{t("analytics.pending")}</p>
                        <p className="mt-1 font-medium text-rose-600 dark:text-rose-400">
                          {formatMoney(row.pending)}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.14em]">{t("analytics.expenseCount")}</p>
                        <p className="mt-1 font-medium text-slate-900 dark:text-white">
                          {formatQuantityValue(row.expenseCount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helpers for Party Statements (ledger)
function formatStatementDate(value) {
  if (!value) return '-';
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  const dateStr = match ? match[0] : value;
  const parsed = dayjs(dateStr);
  return parsed.isValid() ? parsed.format('DD/MM/YYYY') : value;
}

function formatLedgerText(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}

function formatStatusText(value) {
  const text = formatLedgerText(value);
  return text === '-' ? text : text.replace(/_/g, ' ');
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
  if (amount > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (amount < 0) return 'text-rose-700 dark:text-rose-300';
  return 'text-slate-700 dark:text-slate-300';
}

function getBalanceLabel(value, t) {
  if (!Number.isFinite(Number(value))) return t('ledger.currentBalance');
  const amount = Number(value);
  if (amount > 0) return t('parties.toReceive');
  if (amount < 0) return t('parties.toGive');
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

// MAIN PAGE EXPORT
export default function Reports() {
  const { t } = useI18n();
  const { role, canViewFeature, businessId } = useAuth();
  const { settings: biz, businessProfile } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  // Unified Tab Resolution based on permissions
  const availableTabs = useMemo(() => {
    const list = [];
    if (canViewFeature('analytics')) {
      if (businessProfile?.type === 'cafe') {
        list.push({ key: 'cafe-insights', label: t('analytics.cafeInsights') || 'Cafe Sales Book', icon: Coffee });
      }
      list.push({ key: 'overview', label: t('analytics.overallMix') || 'Overview', icon: PieIcon });
      list.push({ key: 'expense', label: t('analytics.expenses') || 'Expense Analytics', icon: BarChart2 });
    }
    if (canViewFeature('ledger')) {
      list.push({ key: 'party', label: t('ledger.statementTitle') || 'Party Statements', icon: ScrollText });
    }
    if (canViewFeature('analytics')) {
      list.push({ key: 'timeline', label: t('analytics.timelineSummary') || 'Timeline', icon: TableProperties });
    }
    return list;
  }, [canViewFeature, t, businessProfile]);

  const activeTab = useMemo(() => {
    const requested = searchParams.get('tab');
    if (availableTabs.some((tabObj) => tabObj.key === requested)) {
      return requested;
    }
    return availableTabs[0]?.key || 'overview';
  }, [searchParams, availableTabs]);

  const handleTabChange = (key) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', key);
    setSearchParams(nextParams);
  };

  // State 1: Analytics Data (Overview, Expense, Timeline)
  const [summary, setSummary] = useState(() => EMPTY_SUMMARY);
  const [profitLoss, setProfitLoss] = useState(() => EMPTY_PROFIT_LOSS);
  const [expenseCategoryAnalytics, setExpenseCategoryAnalytics] = useState(() => EMPTY_EXPENSE_CATEGORY_ANALYTICS);
  const [popularItems, setPopularItems] = useState(() => EMPTY_POPULAR_ANALYTICS);
  const [popularCategories, setPopularCategories] = useState(() => EMPTY_POPULAR_ANALYTICS);
  const [popularItemsError, setPopularItemsError] = useState("");
  const [popularCategoriesError, setPopularCategoriesError] = useState("");
  const [expenseCategoryError, setExpenseCategoryError] = useState("");
  const [analyticsStatus, setAnalyticsStatus] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Filters for Analytics
  const [filters, setFilters] = useState({
    fromDate: dayjs().startOf("month").format("YYYY-MM-DD"),
    toDate: todayISODate(),
    groupBy: "auto",
    partyId: "",
    supplierId: "",
    createdBy: "",
  });
  const [expenseFilters, setExpenseFilters] = useState({
    fromDate: dayjs().startOf("month").format("YYYY-MM-DD"),
    toDate: todayISODate(),
    categoryKey: "",
  });

  const [selectedPartyFilterOption, setSelectedPartyFilterOption] = useState(null);
  const [selectedSupplierFilterOption, setSelectedSupplierFilterOption] = useState(null);
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useState([]);
  const refreshModeRef = useRef(false);

  // State 2: Ledger Data (Party Statements)
  const defaultFrom = useMemo(() => dayjs().startOf('month').format('YYYY-MM-DD'), []);
  const defaultTo = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const initialPartyId = searchParams.get('partyId') || '';
  const initialFrom = searchParams.get('from') || defaultFrom;
  const initialTo = searchParams.get('to') || defaultTo;
  const initialOrder = searchParams.get('order') || 'desc';

  const [ledger, setLedger] = useState({ items: [], total: 0, limit: 25, offset: 0 });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerRefreshing, setLedgerRefreshing] = useState(false);
  const [ledgerStatus, setLedgerStatus] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState(initialPartyId);
  const [selectedPartyOption, setSelectedPartyOption] = useState(null);
  const [ledgerFilters, setLedgerFilters] = useState(() => ({ from: initialFrom, to: initialTo }));
  const [ledgerSortOrder, setLedgerSortOrder] = useState(initialOrder);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const printRef = useRef(null);
  const requestIdRef = useRef(0);

  // State 3: Cafe Seating & Detailed Order Book Data
  const [cafeSalesList, setCafeSalesList] = useState([]);
  const [cafeSalesLoading, setCafeSalesLoading] = useState(false);
  const [cafeSalesError, setCafeSalesError] = useState("");
  const [cafeSearchTerm, setCafeSearchTerm] = useState("");
  const [cafeStatusFilter, setCafeStatusFilter] = useState("all");
  const [cafeTypeFilter, setCafeTypeFilter] = useState("all");

  useEffect(() => {
    if (!canViewFeature("analytics") || activeTab !== "cafe-insights" || !businessId) return;

    let isActive = true;
    setCafeSalesLoading(true);
    setCafeSalesError("");

    api.listSales({
      limit: 150,
      includeItems: "true",
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
    })
      .then((res) => {
        if (!isActive) return;
        const items = res?.items || res || [];
        setCafeSalesList(Array.isArray(items) ? items : []);
      })
      .catch((err) => {
        if (!isActive) return;
        setCafeSalesError(err.message || "Failed to load detailed sales.");
      })
      .finally(() => {
        if (!isActive) return;
        setCafeSalesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [canViewFeature, activeTab, businessId, filters.fromDate, filters.toDate]);

  const cafeStats = useMemo(() => {
    if (!cafeSalesList || cafeSalesList.length === 0) {
      return {
        totalSales: 0,
        orderCount: 0,
        avgOrderValue: 0,
        paidSales: 0,
        dueSales: 0,
        paidCount: 0,
        dueCount: 0,
        totalDiscount: 0,
        tableRevenue: {},
        orderTypeStats: {
          dine_in: { total: 0, count: 0 },
          takeaway: { total: 0, count: 0 },
          delivery: { total: 0, count: 0 },
        },
      };
    }

    let totalSales = 0;
    let paidSales = 0;
    let dueSales = 0;
    let paidCount = 0;
    let dueCount = 0;
    let totalDiscount = 0;
    const tableRevenue = {};
    const orderTypeStats = {
      dine_in: { total: 0, count: 0 },
      takeaway: { total: 0, count: 0 },
      delivery: { total: 0, count: 0 },
    };

    cafeSalesList.forEach((sale) => {
      const total = Number(sale.grandTotal || 0);
      totalSales += total;
      totalDiscount += Number(sale.discountTotal || sale.discount || 0);
      if (sale.status === "paid") {
        paidSales += total;
        paidCount += 1;
      } else {
        dueSales += total;
        dueCount += 1;
      }

      // Seating/Table performance
      const tableLabel =
        sale.Table?.name ||
        sale.table?.name ||
        sale.attributes?.table_no ||
        "Walk-in/Unknown";
      tableRevenue[tableLabel] = (tableRevenue[tableLabel] || 0) + total;

      // Order type performance
      const type = sale.attributes?.order_type || "dine_in";
      const typeKey = ["dine_in", "takeaway", "delivery"].includes(type) ? type : "dine_in";
      orderTypeStats[typeKey].total += total;
      orderTypeStats[typeKey].count += 1;
    });

    return {
      totalSales,
      orderCount: cafeSalesList.length,
      avgOrderValue: cafeSalesList.length > 0 ? totalSales / cafeSalesList.length : 0,
      paidSales,
      dueSales,
      paidCount,
      dueCount,
      totalDiscount,
      tableRevenue,
      orderTypeStats,
    };
  }, [cafeSalesList]);

  const filteredCafeOrders = useMemo(() => {
    return cafeSalesList.filter((sale) => {
      // 1. Search term match
      if (cafeSearchTerm.trim()) {
        const query = cafeSearchTerm.toLowerCase();
        const table = (
          sale.Table?.name ||
          sale.table?.name ||
          sale.attributes?.table_no ||
          ""
        ).toLowerCase();
        const waiter = (sale.attributes?.waiter_name || "").toLowerCase();
        const invoice = (sale.invoiceNo || sale.id || "").toLowerCase();
        if (
          !table.includes(query) &&
          !waiter.includes(query) &&
          !invoice.includes(query)
        ) {
          return false;
        }
      }

      // 2. Status filter
      if (cafeStatusFilter !== "all" && sale.status !== cafeStatusFilter) {
        return false;
      }

      // 3. Order type filter
      if (cafeTypeFilter !== "all") {
        const type = sale.attributes?.order_type || "dine_in";
        if (type !== cafeTypeFilter) return false;
      }

      return true;
    });
  }, [cafeSalesList, cafeSearchTerm, cafeStatusFilter, cafeTypeFilter]);

  const renderOrderItemsSummary = (saleItems) => {
    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) return "—";
    return (
      <div className="flex flex-wrap gap-1 max-w-xs">
        {saleItems.map((item, idx) => {
          const name = item.productName || item.Product?.name || "Unknown Item";
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200/50"
            >
              {name} <span className="text-[#9b6835] font-black">x{item.quantity}</span>
            </span>
          );
        })}
      </div>
    );
  };

  // FETCH: Categories (on mount if analytics view is allowed)
  useEffect(() => {
    if (!canViewFeature('analytics')) return;
    let isActive = true;
    api.listCategories({ type: "expense", limit: 100, offset: 0 })
      .then((response) => {
        if (!isActive) return;
        const options = (Array.isArray(response?.items) ? response.items : [])
          .map((item) => normalizeCategoryFilterOption(item))
          .filter(Boolean);
        setExpenseCategoryOptions(options);
      })
      .catch(() => {
        if (isActive) setExpenseCategoryOptions([]);
      });

    return () => {
      isActive = false;
    };
  }, [canViewFeature]);

  // FETCH: Analytics Data
  useEffect(() => {
    if (!canViewFeature('analytics') || activeTab === 'party') return;

    let isActive = true;
    const isRefreshRequest = refreshModeRef.current;

    if (isRefreshRequest) {
      setAnalyticsRefreshing(true);
    } else {
      setAnalyticsLoading(true);
    }
    setAnalyticsStatus("");
    setExpenseCategoryError("");

    const sharedParams = {
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      groupBy: filters.groupBy || "auto",
      partyId: filters.partyId || undefined,
    };
    const analyticsParams = {
      ...sharedParams,
      createdBy: filters.createdBy || undefined,
    };
    const expenseAnalyticsParams = {
      ...analyticsParams,
      from: expenseFilters.fromDate || undefined,
      to: expenseFilters.toDate || undefined,
      supplierId: filters.supplierId || undefined,
      categoryKey: expenseFilters.categoryKey || undefined,
    };
    const rankingParams = {
      from: filters.fromDate || undefined,
      to: filters.toDate || undefined,
      partyId: filters.partyId || undefined,
      createdBy: filters.createdBy || undefined,
      limit: 10,
    };

    Promise.allSettled([
      api.getAnalyticsSummary(analyticsParams),
      api.getAnalyticsProfitLoss(analyticsParams),
      api.getAnalyticsExpenses(expenseAnalyticsParams),
      api.getPopularItemsAnalytics(rankingParams),
      api.getPopularCategoriesAnalytics(rankingParams),
    ])
      .then(
        ([
          summaryResult,
          profitLossResult,
          expenseAnalyticsResult,
          popularItemsResult,
          popularCategoriesResult,
        ]) => {
          if (!isActive) return;

          if (summaryResult.status !== "fulfilled") {
            setSummary(EMPTY_SUMMARY);
            setProfitLoss(EMPTY_PROFIT_LOSS);
            setExpenseCategoryAnalytics(EMPTY_EXPENSE_CATEGORY_ANALYTICS);
            setExpenseCategoryError("");
            setPopularItems(EMPTY_POPULAR_ANALYTICS);
            setPopularCategories(EMPTY_POPULAR_ANALYTICS);
            setAnalyticsStatus(
              summaryResult.reason?.message || t("auth.errors.generic"),
            );
            return;
          }

          const nextSummary = normalizeAnalyticsSummary(summaryResult.value);
          setSummary(nextSummary);

          if (profitLossResult.status === "fulfilled") {
            setProfitLoss(normalizeProfitLossResponse(profitLossResult.value));
          } else {
            setProfitLoss(buildProfitLossFallback(nextSummary));
          }

          if (expenseAnalyticsResult.status === "fulfilled") {
            setExpenseCategoryAnalytics(
              normalizeExpenseAnalyticsResponse(expenseAnalyticsResult.value),
            );
            setExpenseCategoryError("");
          } else {
            setExpenseCategoryAnalytics(EMPTY_EXPENSE_CATEGORY_ANALYTICS);
            setExpenseCategoryError(
              expenseAnalyticsResult.reason?.message ||
                t("auth.errors.generic"),
            );
          }

          if (popularItemsResult.status === "fulfilled") {
            setPopularItems(
              popularItemsResult.value || EMPTY_POPULAR_ANALYTICS,
            );
            setPopularItemsError("");
          } else {
            setPopularItems(EMPTY_POPULAR_ANALYTICS);
            setPopularItemsError(
              popularItemsResult.reason?.message || t("auth.errors.generic"),
            );
          }

          if (popularCategoriesResult.status === "fulfilled") {
            setPopularCategories(
              popularCategoriesResult.value || EMPTY_POPULAR_ANALYTICS,
            );
            setPopularCategoriesError("");
          } else {
            setPopularCategories(EMPTY_POPULAR_ANALYTICS);
            setPopularCategoriesError(
              popularCategoriesResult.reason?.message ||
                t("auth.errors.generic"),
            );
          }
        },
      )
      .catch((error) => {
        if (!isActive) return;
        setSummary(EMPTY_SUMMARY);
        setProfitLoss(EMPTY_PROFIT_LOSS);
        setExpenseCategoryAnalytics(EMPTY_EXPENSE_CATEGORY_ANALYTICS);
        setExpenseCategoryError("");
        setPopularItems(EMPTY_POPULAR_ANALYTICS);
        setPopularCategories(EMPTY_POPULAR_ANALYTICS);
        setAnalyticsStatus(error.message || t("auth.errors.generic"));
      })
      .finally(() => {
        if (!isActive) return;
        setAnalyticsLoading(false);
        setAnalyticsRefreshing(false);
        refreshModeRef.current = false;
      });

    return () => {
      isActive = false;
    };
  }, [
    canViewFeature,
    activeTab,
    filters.createdBy,
    filters.fromDate,
    filters.groupBy,
    filters.partyId,
    filters.supplierId,
    filters.toDate,
    expenseFilters.categoryKey,
    expenseFilters.fromDate,
    expenseFilters.toDate,
    refreshTick,
    t,
  ]);

  // FETCH: Ledger data (Party Statements)
  const fetchLedger = useCallback(async ({ refresh = false, force = false } = {}) => {
    if (!canViewFeature('ledger') || activeTab !== 'party') return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (refresh) setLedgerRefreshing(true);
    else setLedgerLoading(true);
    setLedgerStatus('');

    try {
      const response = await api.ledgerReport({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        ...(selectedPartyId ? { partyId: selectedPartyId } : {}),
        ...(ledgerFilters.from ? { from: ledgerFilters.from } : {}),
        ...(ledgerFilters.to ? { to: ledgerFilters.to } : {}),
        order: ledgerSortOrder,
      }, { force });

      if (requestId !== requestIdRef.current) return;
      setLedger(response);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setLedgerStatus(error?.message || t('common.noData'));

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
      setLedgerLoading(false);
      setLedgerRefreshing(false);
    }
  }, [canViewFeature, activeTab, ledgerFilters.from, ledgerFilters.to, page, pageSize, selectedPartyId, ledgerSortOrder, t]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Sync Party parameters
  useEffect(() => {
    if (activeTab !== 'party') return;
    setSelectedPartyId(initialPartyId);
    setLedgerSortOrder(searchParams.get('order') || 'desc');
    setSelectedPartyOption((current) => (
      initialPartyId && String(current?.value || '') === String(initialPartyId)
        ? current
        : null
    ));
  }, [initialPartyId, activeTab, searchParams]);

  useEffect(() => {
    if (activeTab !== 'party' || !selectedPartyId) {
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
  }, [ledger.items, selectedPartyId, selectedPartyOption, activeTab]);

  const updateSearchState = useCallback((nextValues) => {
    const nextParams = new URLSearchParams(searchParams);
    const nextPartyId = String(nextValues.partyId || '').trim();
    const nextFrom = String(nextValues.from || '').trim();
    const nextTo = String(nextValues.to || '').trim();
    const nextOrder = String(nextValues.order || '').trim();

    if (nextPartyId) nextParams.set('partyId', nextPartyId);
    else nextParams.delete('partyId');

    if (nextFrom) nextParams.set('from', nextFrom);
    else nextParams.delete('from');

    if (nextTo) nextParams.set('to', nextTo);
    else nextParams.delete('to');

    if (nextOrder) nextParams.set('order', nextOrder);
    else nextParams.delete('order');

    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const formatCompactMoney = (value) => {
    return formatCurrency(asNumber(value), {
      symbol: t("currency.symbol"),
      compact: true,
    });
  };

  const formatMoney = (value) => {
    const amount = asNumber(value);
    const formatted = amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return t("currency.formatted", {
      symbol: t("currency.symbol"),
      amount: formatted,
    });
  };

  // Calculations for Ledger UI
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
          formatMoney: (amount) => formatMoney(amount),
        })
      : { label: '-', balanceText: '' },
  })), [ledger.items, t]);

  const ledgerSummary = useMemo(() => {
    const totalDebit = statementRows.reduce((sum, row) => sum + Number(row.debit || 0), 0);
    const totalCredit = statementRows.reduce((sum, row) => sum + Number(row.credit || 0), 0);
    const currentBalance = statementRows.length
      ? (ledgerSortOrder === 'asc'
          ? statementRows[statementRows.length - 1].runningBalance
          : statementRows[0].runningBalance)
      : null;

    return {
      totalDebit,
      totalCredit,
      currentBalance,
      entries: ledger.total || statementRows.length,
    };
  }, [ledger.total, statementRows, ledgerSortOrder]);

  const selectedPartyLabel = selectedPartyId
    ? selectedPartyOption?.entity?.name || selectedPartyOption?.label || t('ledger.party')
    : t('ledger.allParties');
  const hasActivePartyFilter = Boolean(selectedPartyId);
  const hasCustomDateFilter = ledgerFilters.from !== defaultFrom || ledgerFilters.to !== defaultTo;
  const hasAnyFilter = hasActivePartyFilter || hasCustomDateFilter;
  const timeSpanLabel = ledgerFilters.from || ledgerFilters.to
    ? `${t('ledger.from')}: ${formatStatementDate(ledgerFilters.from)}  ·  ${t('ledger.to')}: ${formatStatementDate(ledgerFilters.to)}`
    : t('ledger.allTime');
  const logoSrc = useMemo(() => {
    if (!biz?.logoUrl) return null;
    return biz.logoUrl.startsWith('http') ? biz.logoUrl : `${API_BASE}${biz.logoUrl}`;
  }, [biz?.logoUrl]);
  const balanceToneClass = getBalanceToneClass(ledgerSummary.currentBalance);
  const balanceLabel = getBalanceLabel(ledgerSummary.currentBalance, t);

  const summaryCards = [
    {
      key: 'balance',
      label: balanceLabel,
      value: formatCurrency(Math.abs(ledgerSummary.currentBalance), { symbol: t('currency.symbol') }),
      icon: WalletCards,
      valueClassName: balanceToneClass,
      accentClassName: 'bg-white/80 text-primary-700 ring-1 ring-primary-100',
    },
    {
      key: 'debit',
      label: t('ledger.totalDebit'),
      value: formatCurrency(ledgerSummary.totalDebit, { symbol: t('currency.symbol') }),
      icon: ArrowDownLeft,
      valueClassName: 'text-rose-700 dark:text-rose-300',
      accentClassName: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40',
    },
    {
      key: 'credit',
      label: t('ledger.totalCredit'),
      value: formatCurrency(ledgerSummary.totalCredit, { symbol: t('currency.symbol') }),
      icon: ArrowUpRight,
      valueClassName: 'text-emerald-700 dark:text-emerald-300',
      accentClassName: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40',
    },
    {
      key: 'entries',
      label: t('ledger.totalEntries'),
      value: String(ledgerSummary.entries),
      icon: ScrollText,
      valueClassName: 'text-slate-900 dark:text-slate-100',
      accentClassName: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
    },
  ];

  const handleLedgerPartyChange = (option) => {
    const partyId = option?.value || '';
    setSelectedPartyId(partyId);
    setSelectedPartyOption(option || null);
    setPage(1);
    updateSearchState({
      partyId,
      from: ledgerFilters.from,
      to: ledgerFilters.to,
      order: ledgerSortOrder,
    });
  };

  const handleLedgerDateChange = (field, value) => {
    const nextFilters = {
      ...ledgerFilters,
      [field]: value,
    };
    setLedgerFilters(nextFilters);
    setPage(1);
    updateSearchState({
      partyId: selectedPartyId,
      from: nextFilters.from,
      to: nextFilters.to,
      order: ledgerSortOrder,
    });
  };

  const handleResetFilters = () => {
    const nextFilters = { from: defaultFrom, to: defaultTo };
    setSelectedPartyId('');
    setSelectedPartyOption(null);
    setLedgerFilters(nextFilters);
    setPage(1);
    setLedgerSortOrder('desc');
    updateSearchState({
      partyId: '',
      from: nextFilters.from,
      to: nextFilters.to,
      order: 'desc',
    });
  };

  const handleDownloadExcel = () => {
    const rows = [
      [t('ledger.statementTitle')],
      [t('ledger.party'), selectedPartyLabel],
      [t('common.date'), timeSpanLabel],
      ['Exported', dayjs().format('D MMM YYYY, HH:mm')],
      [],
      [balanceLabel, formatCurrency(Math.abs(ledgerSummary.currentBalance), { symbol: t('currency.symbol') })],
      [t('ledger.totalDebit'), formatCurrency(ledgerSummary.totalDebit, { symbol: t('currency.symbol') })],
      [t('ledger.totalCredit'), formatCurrency(ledgerSummary.totalCredit, { symbol: t('currency.symbol') })],
      [t('ledger.totalEntries'), ledgerSummary.entries],
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
        row.debit > 0 ? formatCurrency(row.debit, { symbol: t('currency.symbol') }) : '',
        row.credit > 0 ? formatCurrency(row.credit, { symbol: t('currency.symbol') }) : '',
        formatCurrency(row.runningBalance, { symbol: t('currency.symbol') }),
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

  // Shared Action Handlers
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    if (name === "groupBy") {
      const nextRange = getGroupByDateRange(value);
      setFilters((prev) => ({
        ...prev,
        groupBy: value,
        ...(nextRange || {}),
      }));
      return;
    }
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleExpenseFilterChange = (event) => {
    const { name, value } = event.target;
    setExpenseFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handlePartyFilterChange = (option) => {
    setSelectedPartyFilterOption(option || null);
    setFilters((prev) => ({ ...prev, partyId: option?.value || "" }));
  };

  const handleSupplierFilterChange = (option) => {
    setSelectedSupplierFilterOption(option || null);
    setFilters((prev) => ({ ...prev, supplierId: option?.value || "" }));
  };

  const handleRefresh = () => {
    if (activeTab === 'party') {
      fetchLedger({ refresh: true, force: true });
    } else {
      if (analyticsLoading || analyticsRefreshing) return;
      invalidateApiCache(["analytics"]);
      refreshModeRef.current = true;
      setRefreshTick((prev) => prev + 1);
    }
  };

  const renderSummaryLines = (items) => (
    <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
      {items.map((item) => (
        <p
          key={item.label}
          className={`flex items-center justify-between gap-3 ${metricToneClasses(item.tone, item.value)}`}
        >
          <span>{item.label}</span>
          <span className="font-medium">{formatMoney(item.value)}</span>
        </p>
      ))}
    </div>
  );

  const renderTimelineCell = (primary, items, emphasize = false) => (
    <td className="py-2 text-right">
      <div className="flex min-w-[10rem] flex-col items-end gap-1">
        <span
          className={
            emphasize
              ? `font-semibold ${metricToneClasses("net", primary)}`
              : "font-medium text-slate-900 dark:text-white"
          }
        >
          {formatMoney(primary)}
        </span>
        {items.map((item) => (
          <span
            key={item.label}
            className={`text-xs ${metricToneClasses(item.tone, item.value)}`}
          >
            {item.label}: {formatMoney(item.value)}
          </span>
        ))}
      </div>
    </td>
  );

  const pieData = useMemo(
    () => [
      {
        name: t("analytics.salesAndServices"),
        value: summary.totals.sales.total,
      },
      { name: t("nav.purchases"), value: summary.totals.purchases.total },
      { name: t("analytics.expenses"), value: summary.totals.expenses.total },
    ],
    [
      summary.totals.expenses.total,
      summary.totals.purchases.total,
      summary.totals.sales.total,
      t,
    ],
  );

  const visibleExpenseCategoryAnalytics = useMemo(
    () =>
      applyExpenseCategorySelection(
        expenseCategoryAnalytics,
        expenseFilters.categoryKey,
      ),
    [expenseCategoryAnalytics, expenseFilters.categoryKey],
  );

  const seriesCaption = useMemo(() => {
    const labelMap = {
      auto: t("analytics.filters.auto"),
      day: t("analytics.filters.day"),
      week: t("analytics.filters.week"),
      month: t("analytics.filters.month"),
    };
    return `${labelMap[filters.groupBy] || labelMap.auto} | ${filters.fromDate || "-"} to ${filters.toDate || "-"}`;
  }, [filters.fromDate, filters.groupBy, filters.toDate, t]);

  const expenseSeriesCaption = useMemo(() => {
    const labelMap = {
      auto: t("analytics.filters.auto"),
      day: t("analytics.filters.day"),
      week: t("analytics.filters.week"),
      month: t("analytics.filters.month"),
    };
    return `${labelMap[filters.groupBy] || labelMap.auto} | ${expenseFilters.fromDate || "-"} to ${expenseFilters.toDate || "-"}`;
  }, [
    expenseFilters.fromDate,
    expenseFilters.toDate,
    filters.groupBy,
    t,
  ]);

  const availableExpenseCategoryOptions = useMemo(
    () =>
      mergeFilterOptions(
        expenseCategoryOptions,
        expenseCategoryAnalytics.breakdown.map((row) =>
          normalizeCategoryFilterOption(row, t),
        ),
        expenseCategoryAnalytics.summary.topCategory
          ? [
              normalizeCategoryFilterOption(
                expenseCategoryAnalytics.summary.topCategory,
                t,
              ),
            ]
          : [],
        expenseFilters.categoryKey
          ? [
              normalizeCategoryFilterOption({
                categoryKey: expenseFilters.categoryKey,
                categoryName:
                  expenseCategoryAnalytics.breakdown.find(
                    (row) => row.categoryKey === expenseFilters.categoryKey,
                  )?.categoryName || expenseFilters.categoryKey,
              }, t),
            ]
          : [],
      ),
    [
      expenseCategoryAnalytics.breakdown,
      expenseCategoryAnalytics.summary.topCategory,
      expenseCategoryOptions,
      expenseFilters.categoryKey,
      t,
    ],
  );

  const profitLossValueClass = metricToneClasses(
    "net",
    profitLoss.summary.profitLoss.amount,
  );
  const isBusy = analyticsLoading || analyticsRefreshing;
  const isLedgerBusy = ledgerLoading || ledgerRefreshing;

  return (
    <div className="space-y-8 min-w-0 max-w-full">
      <PageHeader
        title={t("nav.reports") || "Reports"}
        subtitle={t("analytics.subtitle")}
        action={
          activeTab === 'party' ? (
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              <button className="btn-secondary min-h-[44px]" type="button" onClick={handlePrint}>
                <Printer size={16} /> {t('ledger.printPdf')}
              </button>
              <button
                className="btn-ghost inline-flex min-h-[44px] items-center justify-center gap-2"
                type="button"
                onClick={handleRefresh}
                disabled={isLedgerBusy}
                aria-busy={isLedgerBusy}
              >
                <RefreshCw size={16} className={isLedgerBusy ? 'animate-spin' : ''} />
                {isLedgerBusy ? t('common.loading') : t('topbar.refresh')}
              </button>
              <button
                className="btn-primary inline-flex min-h-[44px] items-center justify-center gap-2"
                type="button"
                onClick={handleDownloadExcel}
                disabled={ledgerLoading}
              >
                <Download size={16} /> {t('ledger.downloadExcel')}
              </button>
            </div>
          ) : (
            <RefreshButton
              className="min-h-[44px] w-full xl:w-auto"
              refreshing={analyticsRefreshing}
              onClick={handleRefresh}
            />
          )
        }
      />

      {analyticsStatus ? <Notice title={analyticsStatus} tone="error" /> : null}

      {/* Tabs Switch */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-[1px] dark:border-slate-800">
        {availableTabs.map((tabObj) => {
          const isActive = activeTab === tabObj.key;
          const TabIcon = tabObj.icon;

          return (
            <button
              key={tabObj.key}
              type="button"
              onClick={() => handleTabChange(tabObj.key)}
              className={`relative pb-3 px-2 text-sm font-semibold flex items-center gap-2 transition-colors after:absolute after:left-0 after:-bottom-[1px] after:h-0.5 after:w-full after:origin-left after:rounded-full after:transition-transform after:duration-200 after:content-[''] ${
                isActive
                  ? 'text-primary-600 after:scale-x-100 after:bg-primary-600 dark:text-primary-300 dark:after:bg-primary-300 font-bold'
                  : 'text-slate-500 after:scale-x-0 after:bg-transparent hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <TabIcon size={16} />
              {tabObj.label}
            </button>
          );
        })}
      </div>

      {/* RENDER VIEW: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Overview Filter box */}
          <div className="card">
            <div className="grid gap-4 md:grid-cols-3 max-w-3xl">
              <div>
                <DatePresetSelect
                  fromValue={filters.fromDate}
                  toValue={filters.toDate}
                  onChange={(from, to) => {
                    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
                  }}
                />
              </div>
              <div>
                <label className="label">{t("common.from")}</label>
                <input
                  type="date"
                  className="input mt-1"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <label className="label">{t("common.to")}</label>
                <input
                  type="date"
                  className="input mt-1"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {isBusy ? t("common.loading") : seriesCaption}
            </p>
          </div>

          {/* Core Stat Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card border border-primary-50 bg-gradient-to-br from-white to-primary-50/10">
              <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                {t("analytics.salesAndServices")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatMoney(summary.totals.sales.total)}
              </p>
              {renderSummaryLines([
                {
                  label: t("analytics.directSales"),
                  value: summary.totals.directSales.total,
                  tone: "info",
                },
                {
                  label: t("nav.services"),
                  value: summary.totals.services.total,
                  tone: "info",
                },
              ])}
            </div>
            <div className="card">
              <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                {t("analytics.purchaseSpend")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatMoney(summary.totals.purchases.total)}
              </p>
              {renderSummaryLines([
                {
                  label: t("analytics.paid"),
                  value: summary.totals.purchases.cashPaid,
                  tone: "success",
                },
                {
                  label: t("analytics.pending"),
                  value: summary.totals.purchases.pending,
                  tone: "danger",
                },
              ])}
            </div>
            <div className="card">
              <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                {t("analytics.expenses")}
              </p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                {formatMoney(summary.totals.expenses.total)}
              </p>
              {renderSummaryLines([
                {
                  label: t("analytics.paid"),
                  value: summary.totals.expenses.cashPaid,
                  tone: "warning",
                },
                {
                  label: t("analytics.pending"),
                  value: summary.totals.expenses.pending,
                  tone: "danger",
                },
              ])}
            </div>
            <div className="card">
              <p className="text-xs uppercase text-slate-400 font-semibold tracking-wider">
                {t("analytics.profitLoss")}
              </p>
              <p className={`mt-2 text-2xl font-semibold ${profitLossValueClass}`}>
                {formatMoney(profitLoss.summary.profitLoss.amount)}
              </p>
              {renderSummaryLines([
                {
                  label: t("analytics.salesAndServices"),
                  value: profitLoss.summary.profitLoss.revenue,
                  tone: "success",
                },
                {
                  label: t("analytics.totalOutgoing"),
                  value: profitLoss.summary.profitLoss.totalExpenses,
                  tone: "warning",
                },
              ])}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarGraph
              title={t("analytics.profitLossTrend")}
              caption={seriesCaption}
              data={profitLoss.series.profitLoss}
              nameKey="label"
              bars={[
                {
                  dataKey: "revenue",
                  label: t("analytics.salesAndServices"),
                  color: "#10b981",
                },
                {
                  dataKey: "purchases",
                  label: t("nav.purchases"),
                  color: "#f59e0b",
                  stackId: "outflows",
                },
                {
                  dataKey: "generalExpenses",
                  label: t("analytics.generalExpenses"),
                  color: "#d97706",
                  stackId: "outflows",
                },
                {
                  dataKey: "salaryExpenses",
                  label: t("staffManagement.salary"),
                  color: "#9b6835",
                  stackId: "outflows",
                },
                {
                  dataKey: "profitOrLoss",
                  label: t("analytics.profitLoss"),
                  color: "#0f172a",
                },
              ]}
              valueFormatter={formatMoney}
              axisFormatter={formatCompactMoney}
            />
            <div className="card">
              <h3 className="mb-4 font-serif text-xl text-slate-900 dark:text-white font-medium">
                {t("analytics.overallMix")}
              </h3>
              <div className="h-[350px]">
                <PieChart data={pieData} height={350} valueFormatter={formatMoney} />
              </div>
            </div>
          </div>

          {/* Rankings Table */}
          <div className="grid gap-6 xl:grid-cols-2">
            <PopularRankingCard
              title={t("analytics.popularItems")}
              subtitle={t("analytics.popularSubtitle")}
              rows={popularItems.items}
              loading={isBusy}
              error={popularItemsError}
              emptyLabel={t("analytics.noPopularItems")}
              typeLabel={t("nav.items")}
              t={t}
              formatMoney={formatMoney}
            />
            <PopularRankingCard
              title={t("analytics.popularCategories")}
              subtitle={t("analytics.popularSubtitle")}
              rows={popularCategories.items}
              loading={isBusy}
              error={popularCategoriesError}
              emptyLabel={t("analytics.noPopularCategories")}
              typeLabel={t("analytics.categoryName")}
              t={t}
              formatMoney={formatMoney}
            />
          </div>
        </div>
      )}

      {/* RENDER VIEW: EXPENSE ANALYTICS */}
      {activeTab === 'expense' && (
        <div className="animate-fadeIn">
          <ExpenseCategoryAnalyticsSection
            analytics={visibleExpenseCategoryAnalytics}
            loading={isBusy}
            error={expenseCategoryError}
            onRetry={handleRefresh}
            t={t}
            formatMoney={formatMoney}
            formatCompactMoney={formatCompactMoney}
            caption={expenseSeriesCaption}
            filters={expenseFilters}
            onFilterChange={handleExpenseFilterChange}
            categoryOptions={availableExpenseCategoryOptions}
          />
        </div>
      )}

      {/* RENDER VIEW: PARTY STATEMENTS */}
      {activeTab === 'party' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Printable Statement Block */}
          <div ref={printRef} className="space-y-6">
            <div className="hidden print:block">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                <div className="h-1.5 w-full bg-primary" />
                <div className="flex items-start justify-between gap-6 border-b border-slate-200 px-8 pb-6 pt-6">
                  <div className="flex min-w-0 items-start gap-4">
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt="Logo"
                        className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm"
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
                <div className="border-b border-slate-200 bg-slate-50 px-8 py-6">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{balanceLabel}</p>
                      <p className={`mt-1.5 text-sm font-semibold ${balanceToneClass}`}>
                        {formatMoney(Math.abs(ledgerSummary.currentBalance))}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalDebit')}</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900">
                        {formatMoney(ledgerSummary.totalDebit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalCredit')}</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900">
                        {formatMoney(ledgerSummary.totalCredit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t('ledger.totalEntries')}</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-900">{ledgerSummary.entries}</p>
                    </div>
                  </div>
                </div>
                <div className="px-8 py-6">
                  <table className="w-full text-sm text-slate-700">
                    <thead className="text-xs text-slate-400 uppercase">
                      <tr className="tracking-wider border-b pb-2">
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
                          <td colSpan={9} className="py-4 text-slate-400 text-center">{t('ledger.noTransactions')}</td>
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
                              {row.debit > 0 ? formatMoney(row.debit) : '-'}
                            </td>
                            <td className="py-3 text-right text-emerald-700">
                              {row.credit > 0 ? formatMoney(row.credit) : '-'}
                            </td>
                            <td className={`py-3 text-right ${getBalanceToneClass(row.runningBalance)}`}>
                              {formatMoney(row.runningBalance)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-4">
                  <p className="text-xs text-slate-400">{t('ledger.totalEntries')}: {ledgerSummary.entries}</p>
                  <p className="text-xs text-slate-400">Printed on <span data-printed-date>{dayjs().format('D MMM YYYY')}</span></p>
                </div>
              </div>
            </div>

            {/* Screen UI Block */}
            <div className="space-y-6 print:hidden">
              {/* Header Box / Filter Bar */}
              <div className="card bg-[radial-gradient(circle_at_top_left,_rgba(155,104,53,0.08),_transparent_40%)]">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h2 className="font-serif text-2xl font-semibold text-slate-900 dark:text-slate-50">
                      {selectedPartyLabel}
                    </h2>
                    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {timeSpanLabel}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="label">{t('ledger.party')}</label>
                      <PartyFilterSelect
                        className="mt-1"
                        value={selectedPartyId}
                        selectedOption={selectedPartyOption}
                        onChange={handleLedgerPartyChange}
                        placeholder={t('ledger.allParties')}
                        searchPlaceholder={t('ledger.searchPlaceholder')}
                        showPhone={false}
                      />
                    </div>
                    <div>
                      <DatePresetSelect
                        fromValue={ledgerFilters.from}
                        toValue={ledgerFilters.to}
                        onChange={(from, to) => {
                          handleLedgerDateChange('from', from);
                          handleLedgerDateChange('to', to);
                        }}
                      />
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      <div>
                        <label className="label" htmlFor="ledger-from">{t('ledger.from')}</label>
                        <input
                          id="ledger-from"
                          className="input mt-1"
                          type="date"
                          value={ledgerFilters.from}
                          onChange={(e) => handleLedgerDateChange('from', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="ledger-to">{t('ledger.to')}</label>
                        <input
                          id="ledger-to"
                          className="input mt-1"
                          type="date"
                          value={ledgerFilters.to}
                          onChange={(e) => handleLedgerDateChange('to', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  {hasAnyFilter ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 transition hover:text-primary-600 dark:text-primary-300 dark:hover:text-primary-200"
                      onClick={handleResetFilters}
                    >
                      <FilterX size={13} />
                      {t('common.clear')}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Stats summary cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.key}
                      className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/50"
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

              {/* Transactions Table */}
              <div className="card space-y-4">
                {ledgerStatus ? (
                  <Notice title={ledgerStatus} tone="error" />
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead className="text-xs uppercase text-slate-400">
                          <tr>
                            <th className="py-2.5 pr-4 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextOrder = ledgerSortOrder === 'desc' ? 'asc' : 'desc';
                                  setLedgerSortOrder(nextOrder);
                                  setPage(1);
                                  updateSearchState({
                                    partyId: selectedPartyId,
                                    from: ledgerFilters.from,
                                    to: ledgerFilters.to,
                                    order: nextOrder,
                                  });
                                }}
                                className="inline-flex items-center gap-1 font-semibold hover:text-slate-600 dark:hover:text-slate-300"
                              >
                                {t('common.date')}
                                {ledgerSortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                              </button>
                            </th>
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
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {isLedgerBusy && statementRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-4 text-slate-400 text-center">{t('common.loading')}</td>
                            </tr>
                          ) : statementRows.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-4 text-slate-400 text-center">{t('ledger.noTransactions')}</td>
                            </tr>
                          ) : (
                            statementRows.map((row) => (
                              <tr key={`${row.type}-${row.id}`} className="align-top hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
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
                                  {row.debit > 0 ? formatMoney(row.debit) : '-'}
                                </td>
                                <td className="py-3 pr-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                                  {row.credit > 0 ? formatMoney(row.credit) : '-'}
                                </td>
                                <td className={`py-3 text-right font-semibold ${getBalanceToneClass(row.runningBalance)}`}>
                                  {formatMoney(row.runningBalance)}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER VIEW: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filters for Timeline */}
          <div className="card">
            <div className="grid gap-4 md:grid-cols-3 max-w-3xl">
              <div>
                <DatePresetSelect
                  fromValue={filters.fromDate}
                  toValue={filters.toDate}
                  onChange={(from, to) => {
                    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
                  }}
                />
              </div>
              <div>
                <label className="label">{t("common.from")}</label>
                <input
                  type="date"
                  className="input mt-1"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <label className="label">{t("common.to")}</label>
                <input
                  type="date"
                  className="input mt-1"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {isBusy ? t("common.loading") : seriesCaption}
            </p>
          </div>

          {/* Timeline trend graphs */}
          <div className="grid gap-6 md:grid-cols-2">
            <BarGraph
              title={t("analytics.salesTrend")}
              caption={seriesCaption}
              data={summary.series.sales}
              nameKey="label"
              bars={[
                {
                  dataKey: "received",
                  label: t("analytics.received"),
                  color: "#10b981",
                },
                {
                  dataKey: "pending",
                  label: t("analytics.pending"),
                  color: "#facc15",
                },
              ]}
              valueFormatter={formatMoney}
              axisFormatter={formatCompactMoney}
            />
            <BarGraph
              title={t("analytics.outgoingTrend")}
              caption={seriesCaption}
              data={summary.series.purchasesAndExpenses}
              nameKey="label"
              bars={[
                { dataKey: "paid", label: t("analytics.paid"), color: "#d97706" },
                {
                  dataKey: "pending",
                  label: t("analytics.pending"),
                  color: "#f97316",
                },
              ]}
              valueFormatter={formatMoney}
              axisFormatter={formatCompactMoney}
            />
          </div>

          {/* Timeline detailed table */}
          <div className="card">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800">
              <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
                {t("analytics.timelineSummary")}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {summary.series.timeline.length} {t("analytics.points")}
              </span>
            </div>

            {summary.series.timeline.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {t("analytics.noSeries")}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-slate-600 dark:text-slate-300">
                  <thead className="text-xs uppercase text-slate-400 tracking-wider">
                    <tr className="border-b pb-2">
                      <th className="py-2.5 text-left">{t("analytics.period")}</th>
                      <th className="py-2.5 text-right">
                        {t("analytics.salesAndServices")}
                      </th>
                      <th className="py-2.5 text-right">{t("nav.purchases")}</th>
                      <th className="py-2.5 text-right">{t("analytics.expenses")}</th>
                      <th className="py-2.5 text-right">
                        {t("analytics.profitLoss")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.series.timeline.map((row) => (
                      <tr
                        key={row.key}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/15 transition-colors align-top"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-200">{row.label}</td>
                        {renderTimelineCell(row.salesTotal, [
                          {
                            label: t("analytics.directSales"),
                            value: row.directSalesTotal,
                            tone: "info",
                          },
                          {
                            label: t("nav.services"),
                            value: row.serviceTotal,
                            tone: "info",
                          },
                        ])}
                        {renderTimelineCell(row.purchaseTotal, [
                          {
                            label: t("analytics.paid"),
                            value: row.purchaseCashPaid,
                            tone: "success",
                          },
                          {
                            label: t("analytics.pending"),
                            value: row.purchasePending,
                            tone: "danger",
                          },
                        ])}
                        {renderTimelineCell(row.expenseTotal, [
                          {
                            label: t("analytics.paid"),
                            value: row.expenseCashPaid,
                            tone: "warning",
                          },
                          {
                            label: t("analytics.pending"),
                            value: row.expensePending,
                            tone: "danger",
                          },
                        ])}
                        {renderTimelineCell(
                          row.profitOrLoss,
                          [
                            {
                              label: t("analytics.totalOutgoing"),
                              value: row.purchasesAndExpensesTotal,
                              tone: "warning",
                            },
                            {
                              label: t("analytics.salesAndServices"),
                              value: row.salesTotal,
                              tone: "success",
                            },
                          ],
                          true,
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER VIEW: CAFE/RESTAURANT SALES BOOK & INSIGHTS */}
      {activeTab === 'cafe-insights' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Cafe Filter Box */}
          <div className="card bg-white p-5 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="grid gap-4 sm:grid-cols-3 flex-1 max-w-3xl">
              <div>
                <DatePresetSelect
                  fromValue={filters.fromDate}
                  toValue={filters.toDate}
                  onChange={(from, to) => {
                    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
                  }}
                />
              </div>
              <div>
                <label className="label text-slate-500 font-bold uppercase text-[10px] tracking-wider">{t("common.from") || "From Date"}</label>
                <input
                  type="date"
                  className="input h-10 mt-1"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <label className="label text-slate-500 font-bold uppercase text-[10px] tracking-wider">{t("common.to") || "To Date"}</label>
                <input
                  type="date"
                  className="input h-10 mt-1"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={cafeSalesLoading || isBusy}
              className="btn-secondary h-10 px-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 hover:border-[#9b6835] hover:bg-[#9b6835]/5 font-semibold text-slate-700"
            >
              <RefreshCw size={14} className={cafeSalesLoading || isBusy ? "animate-spin" : ""} />
              {t("common.refresh") || "Refresh"}
            </button>
          </div>

          {/* Cafe KPI Metrics Row */}
          {cafeSalesLoading ? (
            <div className="grid gap-4 md:grid-cols-5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="card h-28 bg-slate-50 animate-pulse border border-slate-100" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              <div className="card bg-gradient-to-br from-white to-primary-50/5 p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow transition">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  {t("analytics.totalSalesRevenue") || "Total Sales Revenue"}
                </p>
                <p className="mt-2 text-2xl font-black text-[#9b6835]">
                  {formatMoney(cafeStats.totalSales)}
                </p>
                <div className="absolute right-4 bottom-4 h-8 w-8 rounded-full bg-primary-50/20 text-[#9b6835] flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
              </div>

              <div className="card bg-white p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow transition">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  {t("analytics.totalOrders") || "Total Orders"}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-800">
                  {cafeStats.orderCount}
                </p>
                <div className="absolute right-4 bottom-4 h-8 w-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center">
                  <Users size={16} />
                </div>
              </div>

              <div className="card bg-white p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow transition">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  {t("analytics.avgTicketSize") || "Average Ticket Size"}
                </p>
                <p className="mt-2 text-2xl font-black text-slate-800">
                  {formatMoney(cafeStats.avgOrderValue)}
                </p>
                <div className="absolute right-4 bottom-4 h-8 w-8 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center">
                  <WalletCards size={16} />
                </div>
              </div>

              <div className="card bg-white p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow transition">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  {t("analytics.openBills") || "Open Bills (Unpaid)"}
                </p>
                <p className="mt-2 text-2xl font-black text-rose-600">
                  {formatMoney(cafeStats.dueSales)}
                </p>
                <div className="absolute right-4 bottom-4 h-8 w-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xs font-bold">
                  {cafeStats.dueCount}
                </div>
              </div>

              <div className="card bg-white p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow transition">
                <p className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                  {t("analytics.totalDiscount") || "Total Discount"}
                </p>
                <p className="mt-2 text-2xl font-black text-rose-600">
                  {formatMoney(cafeStats.totalDiscount)}
                </p>
                <div className="absolute right-4 bottom-4 h-8 w-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <TrendingUp size={16} className="rotate-180" />
                </div>
              </div>
            </div>
          )}

          {/* Cafe Visual Insights Grid */}
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Column 1: Best Sellers (Popular dishes/items) */}
            <PopularRankingCard
              title={t("analytics.topSellingDishes") || "Top Selling Dishes"}
              subtitle={t("analytics.topSellingDishesSubtitle") || "Most popular items by quantity and revenue for the selected period."}
              rows={popularItems.items}
              loading={isBusy}
              error={popularItemsError}
              emptyLabel={t("analytics.noPopularItems") || "No popular items found for this date range."}
              typeLabel={t("nav.items") || "Dish Name"}
              t={t}
              formatMoney={formatMoney}
            />

            {/* Column 2: Seating & Seating Type Performance */}
            <div className="card bg-white p-5 border border-slate-100 shadow-sm space-y-6">
              <div>
                <h3 className="font-serif text-xl font-medium text-slate-900">
                  {t("analytics.orderTypesPerf") || "Order Types Performance"}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {t("analytics.orderTypesPerfSubtitle") || "Revenue breakdown by Dine In, Takeaway, and Delivery."}
                </p>
              </div>

              {cafeSalesLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-10 bg-slate-50 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(cafeStats.orderTypeStats).map(([type, data]) => {
                    const pct = cafeStats.totalSales > 0 ? (data.total / cafeStats.totalSales) * 100 : 0;
                    const labels = {
                      dine_in: t("analytics.dineIn") || "Dine In",
                      takeaway: t("analytics.takeaway") || "Takeaway",
                      delivery: t("analytics.delivery") || "Delivery",
                    };
                    const tones = {
                      dine_in: "bg-[#9b6835]",
                      takeaway: "bg-amber-500",
                      delivery: "bg-emerald-500",
                    };
                    return (
                      <div key={type} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>{labels[type]} ({data.count} {t("analytics.orderCount") || "orders"})</span>
                          <span>{formatMoney(data.total)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tones[type] || "bg-slate-400"} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Seating / Table Performance */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <h4 className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                  {t("analytics.seatingPerformance") || "Seating Section & Table Performance"}
                </h4>
                {cafeSalesLoading ? (
                  <div className="h-28 bg-slate-50 rounded-xl animate-pulse" />
                ) : Object.keys(cafeStats.tableRevenue).length === 0 ? (
                  <p className="text-sm text-slate-500">{t("analytics.noTableSales") || "No table sales recorded."}</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
                    {Object.entries(cafeStats.tableRevenue)
                      .sort((a, b) => b[1] - a[1])
                      .map(([table, rev], idx) => (
                        <div key={table} className="p-3 flex justify-between items-center text-xs font-semibold hover:bg-slate-50">
                          <span className="flex items-center gap-2">
                            <span className="h-5 w-5 bg-slate-100 rounded-md flex items-center justify-center text-[10px] text-slate-500">
                              #{idx + 1}
                            </span>
                            {table}
                          </span>
                          <span className="font-bold text-slate-800">{formatMoney(rev)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cafe Detailed Orders log (The Order Book) */}
          <div className="card bg-white p-5 border border-slate-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <h3 className="font-serif text-xl font-medium text-slate-900 flex items-center gap-2">
                  <BookOpen size={18} className="text-[#9b6835]" />
                  {t("analytics.cafeDetailedOrdersBook") || "Cafe Detailed Orders Book"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {t("analytics.cafeDetailedOrdersSubtitle") || "Full list of guest orders with their waiter names, table numbers, and exact dishes ordered."}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-xl shrink-0">
                {filteredCafeOrders.length} {t("analytics.orderCount") || "orders"}
              </span>
            </div>

            {/* Controls */}
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <div>
                <input
                  type="text"
                  placeholder="Search table, waiter, invoice..."
                  className="input h-10 w-full"
                  value={cafeSearchTerm}
                  onChange={(e) => setCafeSearchTerm(e.target.value)}
                />
              </div>
              <div>
                <select
                  className="input h-10 w-full"
                  value={cafeTypeFilter}
                  onChange={(e) => setCafeTypeFilter(e.target.value)}
                >
                  <option value="all">{t("analytics.allOrderTypes") || "All Order Types"}</option>
                  <option value="dine_in">{t("analytics.dineIn") || "Dine In"}</option>
                  <option value="takeaway">{t("analytics.takeaway") || "Takeaway"}</option>
                  <option value="delivery">{t("analytics.delivery") || "Delivery"}</option>
                </select>
              </div>
              <div>
                <select
                  className="input h-10 w-full"
                  value={cafeStatusFilter}
                  onChange={(e) => setCafeStatusFilter(e.target.value)}
                >
                  <option value="all">{t("analytics.allPaymentStatuses") || "All Payment Statuses"}</option>
                  <option value="paid">{t("analytics.paid") || "Paid"}</option>
                  <option value="due">{t("analytics.openBillsDue") || "Open Bills (Due)"}</option>
                </select>
              </div>
            </div>

            {/* Log Table */}
            {cafeSalesLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                <span className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-semibold">{t("common.loading") || "Loading..."}</p>
              </div>
            ) : filteredCafeOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{t("analytics.noSeries") || "No orders found."}</p>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-slate-50/20">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-3 text-left">{t("analytics.invoiceDate") || "Invoice / Date"}</th>
                      <th className="p-3 text-left">{t("analytics.tableWaiter") || "Table / Waiter"}</th>
                      <th className="p-3 text-left">{t("analytics.groupBy") || "Type"}</th>
                      <th className="p-3 text-left">{t("analytics.dishesDrinksOrdered") || "Dishes & Drinks Ordered"}</th>
                      <th className="p-3 text-right">{t("analytics.discount") || "Discount"}</th>
                      <th className="p-3 text-right">{t("analytics.revenue") || "Total"}</th>
                      <th className="p-3 text-center">{t("common.status") || "Status"}</th>
                      <th className="p-3 text-center">{t("common.actions") || "Action"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCafeOrders.map((sale) => {
                      const table = sale.Table?.name || sale.table?.name || sale.attributes?.table_no || "Walk-in";
                      const waiter = sale.attributes?.waiter_name || "—";
                      const dateText = new Date(sale.createdAt || sale.saleDate).toLocaleDateString([], {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const orderType = sale.attributes?.order_type || "dine_in";
                      const typeLabels = {
                        dine_in: t("analytics.dineIn") || "Dine In",
                        takeaway: t("analytics.takeaway") || "Takeaway",
                        delivery: t("analytics.delivery") || "Delivery",
                      };
                      
                      return (
                        <tr key={sale.id} className="hover:bg-slate-50/50 transition align-middle">
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">
                              {sale.invoiceNo || sale.id?.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-slate-400">{dateText}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{table}</span>
                            <span className="text-[10px] text-slate-400">{t("staff.waiter") || "Waiter"}: {waiter}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${
                              orderType === "dine_in"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : orderType === "takeaway"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}>
                              {typeLabels[orderType] || "Dine In"}
                            </span>
                          </td>
                          <td className="p-3">
                            {renderOrderItemsSummary(sale.SaleItems || sale.items)}
                          </td>
                          <td className="p-3 text-right text-rose-600 font-medium">
                            {Number(sale.discountTotal || sale.discount || 0) > 0 ? `-${formatMoney(sale.discountTotal || sale.discount)}` : "—"}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {formatMoney(sale.grandTotal)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              sale.status === "paid"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}>
                              {sale.status === "paid" ? t("analytics.paid") || "Paid" : t("analytics.openBill") || "Open Bill"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <Link
                              to={`/app/invoice/sales/${sale.id}?print=1`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#9b6835] hover:border-[#9b6835] hover:bg-[#9b6835]/5 transition"
                              title="Print Receipt"
                            >
                              <Printer size={12} />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
