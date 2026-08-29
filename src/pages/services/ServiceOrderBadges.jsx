import DateDisplay from "@/components/form/DateDisplay.jsx";
import { useI18n } from "@/lib/i18n.jsx";
import { getDeliveryDaysLeft } from "./serviceOrderUtils.js";

export function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center rounded-full border px-2.5 py-1.5 text-xs font-semibold leading-tight transition sm:px-4 sm:py-2 sm:text-sm ${
        active
          ? "border-primary-300 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700/70 dark:bg-primary-900/30 dark:text-primary-200"
          : "border-secondary-200/80 bg-white/80 text-secondary-700 hover:border-secondary-300 hover:bg-mist dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-secondary-300 dark:hover:border-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

export function DeliveryBadge({ date, isGym, isClosed, createdAt }) {
  const { t } = useI18n();

  if (isClosed) {
    return (
      <div className="leading-snug text-emerald-600 dark:text-emerald-400 font-semibold text-xs md:text-sm">
        {date ? (
          <DateDisplay date={date} format="D MMM YYYY" />
        ) : createdAt ? (
          <DateDisplay date={createdAt} format="D MMM YYYY" />
        ) : (
          <span className="text-secondary-400">—</span>
        )}
        <div className="text-[10px] md:text-xs font-bold mt-0.5 text-emerald-600/80 dark:text-emerald-400/80">
          {isGym ? "Completed / Inactive" : t("services.closed") || "Completed"}
        </div>
      </div>
    );
  }

  if (!date) {
    if (createdAt) {
      return (
        <div className="leading-snug text-secondary-500 text-xs md:text-sm">
          <DateDisplay date={createdAt} format="D MMM YYYY" />
          <div className="text-[10px] md:text-xs font-bold mt-0.5 text-secondary-400">
            {t("services.created") || "Created"}
          </div>
        </div>
      );
    }
    return <span className="text-secondary-400">—</span>;
  }

  const days = getDeliveryDaysLeft(date);
  const label = <DateDisplay date={date} format="D MMM YYYY" />;

  if (days === null) {
    return (
      <div className="leading-snug text-secondary-500 text-xs md:text-sm">
        {label}
      </div>
    );
  }

  let colorClass = "text-emerald-600 dark:text-emerald-400 font-semibold text-xs md:text-sm";
  let remainingText = `${days}d left`;

  if (days < 3) {
    colorClass = "text-rose-600 dark:text-rose-400 font-semibold text-xs md:text-sm";
  } else if (days < 8) {
    colorClass = "text-amber-600 dark:text-amber-400 font-semibold text-xs md:text-sm";
  }

  if (days < 0) {
    remainingText = isGym ? "Expired" : "Overdue";
  } else if (days === 0) {
    remainingText = isGym ? "Expires today" : "Due today";
  }

  return (
    <div className="leading-snug">
      <div className={colorClass}>{label}</div>
      <div className="text-[10px] md:text-xs font-bold mt-0.5 text-secondary-500">{remainingText}</div>
    </div>
  );
}

export function StatusBadge({ status, locked = false }) {
  const { t } = useI18n();
  const normalized = String(status || "").toLowerCase();
  const map = {
    open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    in_progress:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    closed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    cancelled: "bg-secondary-200 text-ink-light dark:bg-slate-700/60 dark:text-slate-200",
    canceled: "bg-secondary-200 text-ink-light dark:bg-slate-700/60 dark:text-slate-200",
    void: "bg-secondary-200 text-ink-light dark:bg-slate-700/60 dark:text-slate-200",
  };
  const label =
    status === "in_progress"
      ? t("services.inProgress")
      : status === "closed"
        ? t("services.closed")
        : ["cancelled", "canceled", "void"].includes(normalized)
          ? t("services.cancelled")
          : "—";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${map[normalized] || "bg-secondary-100 text-secondary-700"}`}
      >
        {label}
      </span>
      {locked && !["cancelled", "canceled", "void"].includes(normalized) ? (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {t("common.locked")}
        </span>
      ) : null}
    </span>
  );
}
