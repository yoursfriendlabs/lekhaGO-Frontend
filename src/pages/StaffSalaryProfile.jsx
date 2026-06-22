import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Download,
  DollarSign,
  FileText,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n.jsx";
import { formatMaybeDate, formatMaybeDateTime } from "../lib/datetime";
import { formatMoney, parseMonthYear, toInitials } from "../lib/formatting";
import { calculateDuration, calculateDurationDecimal } from "../lib/datetime-calc";
import { extractCoordinates, googleMapsUrl } from "../lib/geo";
import dayjs from "../lib/datetime";

import Notice from "../components/Notice";
import ActionMenu from "../components/ActionMenu";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import { useSnackbar } from "../lib/snackbar.jsx";
import { Badge } from "../components/Badge";
import { useLoadingState } from "../hooks/useLoadingState";


function Skeleton({ className = "", lines = 1 }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded-md bg-slate-200 dark:bg-slate-700 ${
            className || (i === lines - 1 ? "w-3/4" : "w-full")
          }`}
        />
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}


function HoursBadge({ duration }) {
  if (!duration) {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }
  return (
    <Badge variant="success" size="sm" icon={<Timer size={11} />}>
      {duration}
    </Badge>
  );
}

function StatusBadge({ active }) {
  return (
    <Badge variant={active ? "active" : "inactive"} size="md" dot>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function TypePill({ type }) {
  const variant = type === "salary" ? "success" : "warning";
  const label = type === "salary" ? "Salary" : "Advance";
  return <Badge variant={variant}>{label}</Badge>;
}

function AttendancePill({ status }) {
  const variant = status === "present" ? "success" : "error";
  const label = status === "present" ? "Present" : "Absent";
  return <Badge variant={variant}>{label}</Badge>;
}

function MetricCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 ${
        accent
          ? "bg-gradient-to-br from-[#9c5f22] to-[#b87a3a] shadow-lg shadow-amber-900/10"
          : "border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      }`}
    >
      {accent && (
        <div className="pointer-events-none absolute -inset-20 bg-gradient-to-tr from-white/5 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[11px] font-semibold uppercase tracking-widest ${
              accent
                ? "text-amber-200/80"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-2.5 text-2xl font-bold tabular-nums tracking-tight ${
              accent ? "text-white" : "text-slate-900 dark:text-white"
            }`}
          >
            {value}
          </p>
          {sub && (
            <p
              className={`mt-1 text-xs ${
                accent
                  ? "text-amber-200/70"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {sub}
            </p>
          )}
        </div>
        <div
          className={`shrink-0 rounded-xl p-2.5 transition-all duration-200 group-hover:scale-110 ${
            accent
              ? "bg-white/15"
              : "bg-slate-50 dark:bg-slate-800 group-hover:bg-slate-100 dark:group-hover:bg-slate-700"
          }`}
        >
          <Icon
            size={16}
            className={
              accent
                ? "text-white"
                : "text-slate-400 dark:text-slate-500"
            }
          />
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, description, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {description}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

function Field({ label, value, icon: Icon, full = false }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        {Icon && <Icon size={12} className="shrink-0 text-slate-400" />}
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-100 dark:border-slate-800" />;
}

function Empty({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center transition-all duration-200 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700">
      {title && (
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {title}
        </p>
      )}
      {description && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {description}
        </p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-primary mt-4 flex items-center gap-1.5 text-xs"
          aria-label={action.label}
        >
          {action.icon && <action.icon size={13} />}
          {action.label}
        </button>
      )}
    </div>
  );
}

function TabBar({ value, onChange, tabs }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 shadow-inner dark:bg-slate-800/60">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-all duration-200 ${
            value === tab.key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
          role="tab"
          aria-selected={value === tab.key}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LocationDisplay({ record }) {
  const inLoc =
    extractCoordinates(record, "punchIn") ||
    extractCoordinates(record, "") ||
    (record.punchInLocation
      ? {
          lat: Number(record.punchInLocation.latitude),
          lng: Number(record.punchInLocation.longitude),
        }
      : null);

  const outLoc =
    extractCoordinates(record, "punchOut") ||
    (record.punchOutLocation
      ? {
          lat: Number(record.punchOutLocation.latitude),
          lng: Number(record.punchOutLocation.longitude),
        }
      : null);

  if (!inLoc && !outLoc) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="space-y-1">
      {inLoc && (
        <a
          href={googleMapsUrl(inLoc.lat, inLoc.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors"
          title={`Punch-in: ${inLoc.lat.toFixed(4)}, ${inLoc.lng.toFixed(4)}`}
          aria-label="View punch-in location on Google Maps"
        >
          <Navigation size={10} className="shrink-0" />
          <span className="tabular-nums">
            {inLoc.lat.toFixed(4)}, {inLoc.lng.toFixed(4)}
          </span>
        </a>
      )}
      {outLoc && (
        <a
          href={googleMapsUrl(outLoc.lat, outLoc.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
          title={`Punch-out: ${outLoc.lat.toFixed(4)}, ${outLoc.lng.toFixed(4)}`}
          aria-label="View punch-out location on Google Maps"
        >
          <MapPin size={10} className="shrink-0" />
          <span className="tabular-nums">
            {outLoc.lat.toFixed(4)}, {outLoc.lng.toFixed(4)}
          </span>
        </a>
      )}
    </div>
  );
}



function StaffProfileCard({ meta, loading }) {
  const ini = toInitials(meta.name);

  return (
    <Card>
      {/* Avatar + name */}
      <div className="flex items-center gap-4 px-6 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#9c5f22]/10 text-lg font-bold text-[#9c5f22] dark:bg-[#9c5f22]/20 dark:text-[#dca060]">
          {loading ? <Skeleton className="h-8 w-8 rounded-lg" /> : ini}
        </div>
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ) : (
            <>
              <p className="truncate text-base font-bold text-slate-900 dark:text-white">
                {meta.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {meta.jobTitle !== "—" ? meta.jobTitle : "No title set"}
              </p>
              <div className="mt-2">
                <StatusBadge active={meta.status === "active"} />
              </div>
            </>
          )}
        </div>
      </div>

      <Divider />

      {/* Contact */}
      <div className="px-6 py-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Contact
        </p>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
        ) : (
          <div className="space-y-3">
            {meta.email && (
              <a
                href={`mailto:${meta.email}`}
                className="flex items-start gap-2 text-sm text-slate-700 hover:text-primary-600 dark:text-slate-300"
                aria-label={`Email ${meta.email}`}
              >
                <span aria-hidden="true">✉</span>
                {meta.email}
              </a>
            )}
            {meta.phone && (
              <a
                href={`tel:${meta.phone}`}
                className="flex items-start gap-2 text-sm text-slate-700 hover:text-primary-600 dark:text-slate-300"
                aria-label={`Call ${meta.phone}`}
              >
                <span aria-hidden="true">☎</span>
                {meta.phone}
              </a>
            )}
            {meta.address && (
              <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span aria-hidden="true">📍</span>
                {meta.address}
              </div>
            )}
          </div>
        )}
      </div>

      <Divider />

      {/* Employment */}
      <div className="px-6 py-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Employment
        </p>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-400"># Employee ID</span>
              <span className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                {meta.employeeId || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-400">Department</span>
              <span className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                {meta.category || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-400">Shift</span>
              <span className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                {meta.shift || "—"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-xs text-slate-400">Joined</span>
              <span className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                {formatMaybeDate(meta.joinedAt) || "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}


function InlineSalaryEditor({ value, onSave, membershipId }) {
  const { showSuccess, showError } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value || 0));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = async () => {
    const numeric = Number(editValue);
    if (!Number.isFinite(numeric) || numeric < 0) {
      showError("Enter a valid positive amount.");
      return;
    }
    setSaving(true);
    try {
      await api.updateStaff(membershipId, { baseSalary: numeric });
      onSave(numeric);
      setEditing(false);
      showSuccess("Base salary updated.");
    } catch (e) {
      showError(e?.message || "Failed to update salary.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(String(value || 0));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-slate-400">
            $
          </span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="input w-28 pl-5 text-sm tabular-nums"
            disabled={saving}
            aria-label="Base salary amount"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          aria-label="Confirm salary update"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Cancel salary edit"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
        ${Number(value || 0).toFixed(2)}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-lg p-1 text-slate-300 opacity-0 transition hover:text-primary-600 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-primary-400"
        aria-label="Edit base salary"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PAYROLL ENTRY PANEL
// ─────────────────────────────────────────────────────────

function PayrollEntryPanel({
  t,
  membershipId,
  currentMonthYear,
  onSaved,
  adding: addingProp,
  onAddingChange,
}) {
  const [adding, setAdding] = useState(Boolean(addingProp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState("advance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [monthYear, setMonthYear] = useState(currentMonthYear);
  const [note, setNote] = useState("");
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    setAdding(Boolean(addingProp));
  }, [addingProp]);

  useEffect(() => {
    setMonthYear(currentMonthYear);
  }, [currentMonthYear]);

  const open = (val) => {
    setAdding(val);
    onAddingChange?.(val);
  };

  const close = () => open(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!membershipId) return;

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await api.addStaffSalaryRecord(membershipId, {
        amount: numericAmount,
        type,
        date,
        monthYear,
        note,
      });

      close();
      setAmount("");
      setNote("");

      showSuccess(
        type === "salary"
          ? "Salary payment recorded."
          : "Advance recorded.",
      );

      if (result?.records) {
        await onSaved(result.records);
      } else {
        const localKey = `mms_mock_salary_${membershipId}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
        await onSaved(existing.length > 0 ? existing : [result?.record]);
      }
    } catch (err) {
      showError(err?.message || "Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Add entry"
        description="Record a salary payment or advance."
        right={
          !adding && (
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={() => open(true)}
              aria-label="Add new payroll entry"
            >
              + New entry
            </button>
          )
        }
      />

      {!adding ? (
        <div className="p-6">
          <Empty description='Click "New entry" to record a salary payment or advance.' />
        </div>
      ) : (
        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <Notice title={error} tone="error" />}

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                htmlFor="sal-type"
              >
                Type
              </label>
              <select
                id="sal-type"
                className="input mt-1 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="advance">Salary advance</option>
                <option value="salary">Salary payment</option>
              </select>
            </div>

            <div>
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                htmlFor="sal-amount"
              >
                Amount
              </label>
              <input
                id="sal-amount"
                className="input mt-1 text-sm"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                aria-label="Entry amount"
              />
            </div>

            <div>
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                htmlFor="sal-date"
              >
                Date
              </label>
              <input
                id="sal-date"
                className="input mt-1 text-sm"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                aria-label="Entry date"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                htmlFor="sal-month"
              >
                Applies to month
              </label>
              <input
                id="sal-month"
                className="input mt-1 text-sm"
                type="month"
                value={monthYear}
                onChange={(e) => setMonthYear(e.target.value)}
                required
                aria-label="Applies to month"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label
                className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                htmlFor="sal-note"
              >
                Note <span className="normal-case font-normal text-slate-300">(optional)</span>
              </label>
              <input
                id="sal-note"
                className="input mt-1 text-sm"
                type="text"
                value={note}
                placeholder="e.g. Festival advance, partial June payment…"
                onChange={(e) => setNote(e.target.value)}
                aria-label="Entry note"
              />
            </div>
          </div>

          <Divider />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={saving}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-sm"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}



export default function StaffSalaryProfile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { membershipId } = useParams();
  const { canViewFeature, canManageFeature } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const canView = canViewFeature("staff") || canViewFeature("attendance") || canViewFeature("ledger");
  const canManage = canManageFeature("staff");

  // Loading state
  const loading = useLoadingState({ meta: true });

  // Employee data
  const [employeeMeta, setEmployeeMeta] = useState({
    name: "",
    jobTitle: "",
    category: "",
    shift: "",
    status: "active",
    joinedAt: null,
    address: "",
    phone: "",
    email: "",
    employeeId: "",
    baseSalary: 0,
  });

  // Payroll records
  const [records, setRecords] = useState([]);
  const [error, setError] = useState("");

  // Attendance
  const [attendance, setAttendance] = useState([]);
  const [attendanceDateFrom, setAttendanceDateFrom] = useState(() =>
    dayjs().subtract(30, "day").format("YYYY-MM-DD"),
  );
  const [attendanceDateTo, setAttendanceDateTo] = useState(() =>
    dayjs().format("YYYY-MM-DD"),
  );

  // UI
  const [activeTab, setActiveTab] = useState("overview");
  const [payrollAdding, setPayrollAdding] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    recordId: null,
    saving: false,
  });

  const currentMonthYear = useMemo(
    () => new Date().toISOString().slice(0, 7),
    [],
  );

  // ── Loaders ──
  const loadEmployeeMeta = useCallback(async () => {
    if (!membershipId) return;
    loading.setLoading("meta", true);
    try {
      const m = await api.getStaffMember(membershipId);
      if (m) {
        setEmployeeMeta({
          name: m.user?.name || m.user?.email || "",
          email: m.user?.email || m.email || "",
          phone: m.phone || m.user?.phone || "",
          jobTitle: m.jobTitle || "",
          category: m.category?.label || m.category || "",
          shift: m.shift || "",
          status: m.status || "active",
          joinedAt: m.joinedAt || m.createdAt || null,
          address: m.address || "",
          employeeId: m.employeeId || m.membershipId || String(membershipId),
          baseSalary: Number(m.baseSalary || m.salary || 0),
        });
      }
    } catch (e) {
      console.error("Failed to load employee profile", e);
      setError("Could not load employee profile");
    } finally {
      loading.setLoading("meta", false);
    }
  }, [membershipId, loading]);

  const loadSalaryRecords = useCallback(async () => {
    if (!membershipId) return;
    loading.setLoading("records", true);
    setError("");
    try {
      const res = await api.getStaffSalaryRecords(membershipId);
      if (!res?.records || res.records.length === 0) {
        const localKey = `mms_mock_salary_${membershipId}`;
        const localRecords = JSON.parse(localStorage.getItem(localKey) || "[]");
        if (localRecords.length > 0) {
          setRecords(localRecords);
          loading.setLoading("records", false);
          return;
        }
      }
      setRecords(res?.records || []);
    } catch (e) {
      setError(e?.message || "Unable to load payroll records. Check your permissions.");
      setRecords([]);
    } finally {
      loading.setLoading("records", false);
    }
  }, [membershipId, loading]);

  const loadAttendance = useCallback(async () => {
    if (!membershipId) return;
    loading.setLoading("attendance", true);
    try {
      const res = await api.getStaffAttendance(membershipId, {
        from: attendanceDateFrom,
        to: attendanceDateTo,
      });
      setAttendance(res?.history || []);
    } catch (e) {
      console.error("Failed to load attendance", e);
      setAttendance([]);
    } finally {
      loading.setLoading("attendance", false);
    }
  }, [membershipId, attendanceDateFrom, attendanceDateTo, loading]);

  // Load on mount
  useEffect(() => {
    loadEmployeeMeta();
    loadSalaryRecords();
    loadAttendance();
  }, [membershipId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reload attendance when dates change
  useEffect(() => {
    loadAttendance();
  }, [attendanceDateFrom, attendanceDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──
  const stats = useMemo(() => {
    const monthlySalary = Number(employeeMeta.baseSalary || 0);
    let totalPaidThisMonth = 0;
    let totalAdvanceThisMonth = 0;

    records.forEach((r) => {
      const recordMonthYear = r.monthYear || parseMonthYear(r.date);
      if (recordMonthYear === currentMonthYear) {
        if (r.type === "salary") totalPaidThisMonth += Number(r.amount || 0);
        if (r.type === "advance") totalAdvanceThisMonth += Number(r.amount || 0);
      }
    });

    return {
      monthlySalary,
      totalPaidThisMonth,
      totalAdvanceThisMonth,
      netRemaining: monthlySalary - totalAdvanceThisMonth - totalPaidThisMonth,
    };
  }, [currentMonthYear, employeeMeta.baseSalary, records]);

  const attendanceSummary = useMemo(() => {
    const presentRecords = attendance.filter((r) => r.status === "present");
    const totalHoursDecimal = presentRecords.reduce(
      (sum, r) => sum + calculateDurationDecimal(r.punchInTime, r.punchOutTime),
      0,
    );
    const totalH = Math.floor(totalHoursDecimal);
    const totalM = Math.round((totalHoursDecimal - totalH) * 60);
    const totalHoursStr =
      totalHoursDecimal > 0 ? `${totalH}h ${totalM}m` : "0h 0m";

    return {
      present: presentRecords.length,
      absent: attendance.filter((r) => r.status !== "present").length,
      late: attendance.filter((r) => r.isLate).length,
      totalHours: totalHoursStr,
    };
  }, [attendance]);

  // ── Actions ──
  const handleDeleteRecord = async () => {
    if (!deleteDialog.recordId || !membershipId) return;

    setDeleteDialog((d) => ({ ...d, saving: true }));
    loading.setLoading("delete", true);

    try {
      await api.deleteStaffSalaryRecord(membershipId, deleteDialog.recordId);
      setDeleteDialog({ open: false, recordId: null, saving: false });
      showSuccess("Payroll record deleted.");
      await loadSalaryRecords();
    } catch (e) {
      showError(e?.message || "Failed to delete record. Try again.");
      setDeleteDialog((d) => ({ ...d, saving: false }));
    } finally {
      loading.setLoading("delete", false);
    }
  };

  const handleSalarySave = (newAmount) => {
    setEmployeeMeta((prev) => ({ ...prev, baseSalary: newAmount }));
  };

  const menuActions = useMemo(
    () =>
      [
        canManage && membershipId && {
          label: "Add payroll entry",
          icon: Sparkles,
          onClick: () => {
            setActiveTab("history");
            setPayrollAdding(true);
          },
        },
        {
          label: "Export records",
          icon: Download,
          onClick: () => showError("Export is not wired to backend in this build."),
        },
      ].filter(Boolean),
    [canManage, membershipId, showError],
  );

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "attendance", label: "Attendance" },
    { key: "history", label: "Payroll" },
  ];

  if (!canView) return null;

  return (
    <div className="space-y-5">
      {/* ── Page top bar ── */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Go back to staff list"
        >
          <ArrowLeft size={13} />
          Back to staff
        </button>
        <ActionMenu actions={menuActions} label="Actions" />
      </div>

      {error && (
        <Notice title={error} tone="error" onDismiss={() => setError("")} />
      )}

      {/* ── Two-column layout: sidebar profile + main content ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Left: staff profile card (sticky on desktop) ── */}
        <div className="w-full lg:sticky lg:top-6 lg:w-72 lg:shrink-0">
          <StaffProfileCard meta={employeeMeta} loading={loading.meta} />
        </div>

        {/* ── Right: tabs + content ── */}
        <div className="min-w-0 flex-1 space-y-4">
          <TabBar value={activeTab} onChange={setActiveTab} tabs={tabs} />

          {/* ════════════════════════════════════════════════════════════════
              OVERVIEW
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Salary metrics */}
              <div className="grid gap-3 sm:grid-cols-2">
                {loading.meta ? (
                  <>
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                  </>
                ) : (
                  <>
                    <MetricCard
                      label="Monthly salary"
                      value={formatMoney(t, stats.monthlySalary)}
                      sub="Base pay"
                      icon={DollarSign}
                      accent
                    />
                    <MetricCard
                      label="Balance due"
                      value={formatMoney(t, stats.netRemaining)}
                      sub="Remaining this month"
                      icon={Clock}
                    />
                    <MetricCard
                      label="Advances taken"
                      value={formatMoney(t, stats.totalAdvanceThisMonth)}
                      sub={currentMonthYear}
                      icon={FileText}
                    />
                    <MetricCard
                      label="Salary paid"
                      value={formatMoney(t, stats.totalPaidThisMonth)}
                      sub={currentMonthYear}
                      icon={ShieldCheck}
                    />
                  </>
                )}
              </div>

              {/* Pay structure — with inline edit for base salary */}
              <Card>
                <CardHeader
                  title="Pay structure"
                  description="Compensation configuration for this employee."
                />
                {loading.meta ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-2/5" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Base salary
                      </p>
                      {canManage ? (
                        <InlineSalaryEditor
                          value={employeeMeta.baseSalary}
                          onSave={handleSalarySave}
                          membershipId={membershipId}
                        />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                          {formatMoney(t, stats.monthlySalary)}
                        </p>
                      )}
                    </div>
                    <Field label="Schedule" value="Monthly" />
                    <Field label="Shift" value={employeeMeta.shift || "—"} />
                    <Field label="Settlement" value="Advances + partials" />
                  </div>
                )}
              </Card>

              {/* Attendance snapshot */}
              <Card>
                <CardHeader
                  title="Attendance snapshot"
                  description="Last 30 days."
                />
                {loading.meta ? (
                  <div className="grid grid-cols-4 gap-4 p-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="text-center">
                        <Skeleton className="mx-auto h-6 w-12" />
                        <Skeleton className="mx-auto mt-1 h-3 w-14" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-800">
                    {[
                      {
                        label: "Present",
                        value: attendanceSummary.present,
                        color: "text-emerald-600 dark:text-emerald-400",
                      },
                      {
                        label: "Late",
                        value: attendanceSummary.late,
                        color: "text-amber-600 dark:text-amber-400",
                      },
                      {
                        label: "Absent",
                        value: attendanceSummary.absent,
                        color: "text-rose-600 dark:text-rose-400",
                      },
                      {
                        label: "Hours",
                        value: attendanceSummary.totalHours,
                        color: "text-indigo-600 dark:text-indigo-400",
                      },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="py-5 text-center">
                        <p className={`text-2xl font-bold tabular-nums ${color}`}>
                          {value}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ATTENDANCE
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Present"
                  value={attendanceSummary.present}
                  sub={`${attendanceDateFrom} → ${attendanceDateTo}`}
                  icon={Users}
                />
                <MetricCard
                  label="Late arrivals"
                  value={attendanceSummary.late}
                  sub="In selected range"
                  icon={Clock}
                />
                <MetricCard
                  label="Absent"
                  value={attendanceSummary.absent}
                  sub="In selected range"
                  icon={Calendar}
                />
                <MetricCard
                  label="Total hours"
                  value={attendanceSummary.totalHours}
                  sub="In selected range"
                  icon={Timer}
                  accent
                />
              </div>

              {/* Filter bar */}
              <Card className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-wrap gap-3 flex-1">
                    <div>
                      <label
                        className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                        htmlFor="att-from"
                      >
                        From
                      </label>
                      <input
                        id="att-from"
                        type="date"
                        className="input mt-1 block text-sm"
                        value={attendanceDateFrom}
                        onChange={(e) => setAttendanceDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        className="text-[10px] font-semibold uppercase tracking-widest text-slate-400"
                        htmlFor="att-to"
                      >
                        To
                      </label>
                      <input
                        id="att-to"
                        type="date"
                        className="input mt-1 block text-sm"
                        value={attendanceDateTo}
                        onChange={(e) => setAttendanceDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary flex items-center gap-2 text-sm"
                    onClick={loadAttendance}
                    disabled={loading.attendance}
                    aria-label="Refresh attendance records"
                  >
                    <RefreshCw
                      size={13}
                      className={loading.attendance ? "animate-spin" : ""}
                    />
                    Refresh
                  </button>
                </div>
              </Card>

              {/* Table */}
              {loading.attendance ? (
                <Card className="overflow-hidden">
                  <TableSkeleton rows={5} />
                </Card>
              ) : attendance.length === 0 ? (
                <Card>
                  <div className="p-6">
                    <Empty
                      title="No records found"
                      description="Adjust the date range above and refresh."
                    />
                  </div>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                          {["Date", "Punch in", "Punch out", "Hours", "Location", "Status"].map(
                            (h) => (
                              <th
                                key={h}
                                className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {attendance.map((record) => (
                          <tr
                            key={record.id}
                            className="bg-white transition hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-slate-800/30"
                          >
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                              {formatMaybeDate(record.date, "YYYY-MM-DD")}
                            </td>
                            <td className="p-3 tabular-nums text-slate-500 dark:text-slate-400">
                              {formatMaybeDateTime(record.punchInTime, "hh:mm A") || "—"}
                            </td>
                            <td className="p-3 tabular-nums text-slate-500 dark:text-slate-400">
                              {formatMaybeDateTime(record.punchOutTime, "hh:mm A") || "—"}
                            </td>
                            <td className="p-3">
                              <HoursBadge
                                duration={
                                  record.status === "present"
                                    ? calculateDuration(
                                        record.punchInTime,
                                        record.punchOutTime,
                                      )?.formatted || null
                                    : null
                                }
                              />
                            </td>
                            <td className="p-3">
                              <LocationDisplay record={record} />
                            </td>
                            <td className="p-3">
                              <AttendancePill status={record.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              PAYROLL HISTORY
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Payroll records
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    All salary payments and advances for this employee.
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {records.length} records
                </span>
              </div>

              {loading.records ? (
                <Card className="overflow-hidden">
                  <TableSkeleton rows={4} />
                </Card>
              ) : records.length === 0 ? (
                <Empty
                  title="No payroll records yet"
                  description="Add the first entry using the form below."
                  action={
                    canManage
                      ? {
                          label: "Add payroll entry",
                          icon: Sparkles,
                          onClick: () => setPayrollAdding(true),
                        }
                      : undefined
                  }
                />
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Date
                          </th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Period
                          </th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Type
                          </th>
                          <th className="p-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Amount
                          </th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            Note
                          </th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {records.map((r) => (
                          <tr
                            key={r.id}
                            className="bg-white transition hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-slate-800/30"
                          >
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {formatMaybeDate(r.date) || "—"}
                            </td>
                            <td className="p-3 tabular-nums text-slate-600 dark:text-slate-400">
                              {r.monthYear || parseMonthYear(r.date) || "—"}
                            </td>
                            <td className="p-3">
                              <TypePill type={r.type} />
                            </td>
                            <td className="p-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                              {formatMoney(t, r.amount)}
                            </td>
                            <td
                              className="max-w-[160px] truncate p-3 text-slate-400 dark:text-slate-500"
                              title={r.note}
                            >
                              {r.note || "—"}
                            </td>
                            <td className="p-3 text-right">
                              {canManage && (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                                  onClick={() =>
                                    setDeleteDialog({
                                      open: true,
                                      recordId: r.id,
                                      saving: false,
                                    })
                                  }
                                  aria-label={`Delete record ${r.id}`}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {canManage && (
                <PayrollEntryPanel
                  t={t}
                  membershipId={membershipId}
                  currentMonthYear={currentMonthYear}
                  onSaved={loadSalaryRecords}
                  adding={payrollAdding}
                  onAddingChange={setPayrollAdding}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() =>
          !deleteDialog.saving &&
          setDeleteDialog({ open: false, recordId: null, saving: false })
        }
        onConfirm={handleDeleteRecord}
        title="Delete this record?"
        description="This cannot be undone. The entry will be permanently removed from payroll history."
        confirming={deleteDialog.saving}
      />
    </div>
  );
}
