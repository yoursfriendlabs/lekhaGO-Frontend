import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Download,
  DollarSign,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Building2,
  Hash,
  Navigation,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { formatMaybeDate, formatMaybeDateTime } from '../lib/datetime';
import dayjs from '../lib/datetime';
import Notice from '../components/Notice';
import ActionMenu from '../components/ActionMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(t, amount) {
  const n = Number(amount || 0);
  return t('currency.formatted', { symbol: t('currency.symbol'), amount: n.toFixed(2) });
}

function toMonthYear(str) {
  if (!str) return '';
  const s = String(str);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  return '';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || 'S').slice(0, 1).toUpperCase();
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
      active
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800'
        : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function MetricCard({ label, value, sub, icon: Icon, accent = false }) {
  return (
    <div className={`rounded-2xl p-5 ${
      accent
        ? 'bg-[#9c5f22]'
        : 'border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold uppercase tracking-widest ${
            accent ? 'text-amber-200/80' : 'text-slate-400 dark:text-slate-500'
          }`}>{label}</p>
          <p className={`mt-2.5 text-2xl font-bold tabular-nums tracking-tight ${
            accent ? 'text-white' : 'text-slate-900 dark:text-white'
          }`}>{value}</p>
          {sub && (
            <p className={`mt-1 text-xs ${accent ? 'text-amber-200/70' : 'text-slate-400 dark:text-slate-500'}`}>
              {sub}
            </p>
          )}
        </div>
        <div className={`shrink-0 rounded-xl p-2.5 ${accent ? 'bg-white/15' : 'bg-slate-50 dark:bg-slate-800'}`}>
          <Icon size={16} className={accent ? 'text-white' : 'text-slate-400 dark:text-slate-500'} />
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, description, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
      </div>
      {right}
    </div>
  );
}

function Field({ label, value, icon: Icon, full = false }) {
  return (
    <div className={full ? 'col-span-full' : ''}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {Icon && <Icon size={12} className="shrink-0 text-slate-400" />}
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value || '—'}</p>
      </div>
    </div>
  );
}

function Divider() {
  return <hr className="border-slate-100 dark:border-slate-800" />;
}

function Empty({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
      {title && <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</p>}
      {description && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
  );
}

function TabBar({ value, onChange, tabs }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            value === tab.key
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function TypePill({ type }) {
  const isSalary = type === 'salary';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
      isSalary
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    }`}>
      {isSalary ? 'Salary' : 'Advance'}
    </span>
  );
}

function AttendancePill({ status }) {
  const present = status === 'present';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
      present
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
    }`}>
      {present ? 'Present' : 'Absent'}
    </span>
  );
}

/** Resolves lat/lng from a record using various possible field name patterns. */
function resolveCoord(record, prefix) {
  const patterns = [
    [`${prefix}Latitude`, `${prefix}Longitude`],
    [`${prefix}Lat`, `${prefix}Lng`],
    [`${prefix}_latitude`, `${prefix}_longitude`],
    [`${prefix}_lat`, `${prefix}_long`],
  ];
  for (const [latKey, lngKey] of patterns) {
    const lat = record[latKey];
    const lng = record[lngKey];
    if (lat != null && lng != null) return { lat: Number(lat), lng: Number(lng) };
  }
  return null;
}

/** Renders punch location coordinates from an attendance record. */
function LocationDisplay({ record }) {
  const inLoc =
    resolveCoord(record, 'punchIn') ||
    resolveCoord(record, '') ||
    (record.punchInLocation?.latitude != null && record.punchInLocation?.longitude != null
      ? { lat: Number(record.punchInLocation.latitude), lng: Number(record.punchInLocation.longitude) }
      : null);

  const outLoc =
    resolveCoord(record, 'punchOut') ||
    (record.punchOutLocation?.latitude != null && record.punchOutLocation?.longitude != null
      ? { lat: Number(record.punchOutLocation.latitude), lng: Number(record.punchOutLocation.longitude) }
      : null);

  if (!inLoc && !outLoc) return <span className="text-slate-400">—</span>;

  const mapsUrl = (lat, lng) =>
    `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="space-y-1">
      {inLoc && (
        <a
          href={mapsUrl(inLoc.lat, inLoc.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 transition-colors"
          title={`Punch-in location: ${inLoc.lat}, ${inLoc.lng}`}
        >
          <Navigation size={10} className="shrink-0" />
          <span className="tabular-nums">
            {inLoc.lat.toFixed(4)},{' '}
            {inLoc.lng.toFixed(4)}
          </span>
        </a>
      )}
      {outLoc && (
        <a
          href={mapsUrl(outLoc.lat, outLoc.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-primary-600 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
          title={`Punch-out location: ${outLoc.lat}, ${outLoc.lng}`}
        >
          <MapPin size={10} className="shrink-0" />
          <span className="tabular-nums">
            {outLoc.lat.toFixed(4)},{' '}
            {outLoc.lng.toFixed(4)}
          </span>
        </a>
      )}
    </div>
  );
}

// ─── Staff Profile Card ───────────────────────────────────────────────────────

function StaffProfileCard({ meta, loading }) {
  const ini = initials(meta.name);
  return (
    <Card>

      {/* Avatar + name band */}
      <div className="flex items-center gap-4 px-6 py-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#9c5f22]/10 text-lg font-bold text-[#9c5f22] dark:bg-[#9c5f22]/20 dark:text-[#dca060]">
          {loading ? '…' : ini}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-900 dark:text-white">
            {loading ? 'Loading…' : meta.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {meta.jobTitle !== '—' ? meta.jobTitle : 'No title set'}
          </p>
          <div className="mt-2">
            <StatusBadge active={meta.status === 'active'} />
          </div>
        </div>
      </div>

      <Divider />

        {/* Contact details */}
        <div className="px-6 py-5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Contact
          </p>
          <div className="space-y-3">
            {[
              { key: 'email', icon: Mail,  value: meta.email   },
              { key: 'phone', icon: Phone, value: meta.phone   },
              ...(meta.address ? [{ key: 'address', icon: MapPin, value: meta.address }] : []),
            ].map(({ key, icon: Icon, value }) => (
              <div key={key} className="flex items-start gap-2.5">
                <Icon size={13} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-700 dark:text-slate-300">{value}</span>
              </div>
            ))}
          </div>
        </div>

      <Divider />

      {/* Employment details */}
      <div className="px-6 py-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Employment
        </p>
        <div className="space-y-3">
          {[
            { icon: Hash,      label: 'Employee ID',  value: meta.employeeId  || '—' },
            { icon: Building2, label: 'Department',   value: meta.category    || '—' },
            { icon: Briefcase, label: 'Shift',        value: meta.shift       || '—' },
            { icon: Calendar,  label: 'Joined',       value: formatMaybeDate(meta.joinedAt) || '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Icon size={13} className="shrink-0" />
                <span className="text-xs">{label}</span>
              </div>
              <span className="text-right text-xs font-semibold text-slate-800 dark:text-slate-200">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StaffSalaryProfile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { membershipId } = useParams();
  const { canViewFeature, canManageFeature } = useAuth();

  const canView   = canViewFeature('staff') || canViewFeature('attendance') || canViewFeature('ledger');
  const canManage = canManageFeature('staff');

  // ── State ──
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [records, setRecords]             = useState([]);
  const [activeTab, setActiveTab]         = useState('overview');
  const [payrollAdding, setPayrollAdding] = useState(false);
  const [deleteDialog, setDeleteDialog]   = useState({ open: false, recordId: null, saving: false });

  const [employeeMeta, setEmployeeMeta] = useState({
    name: '', jobTitle: '', category: '', shift: '',
    status: 'active', joinedAt: null, address: '',
    phone: '', email: '', employeeId: '', department: '',
    baseSalary: 0,
  });
  const [metaLoading, setMetaLoading] = useState(true);

  const [attendance, setAttendance]               = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDateFrom, setAttendanceDateFrom] = useState(
    () => dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
  );
  const [attendanceDateTo, setAttendanceDateTo] = useState(
    () => dayjs().format('YYYY-MM-DD'),
  );

  const currentMonthYear = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // ── Loaders ──
  const loadEmployeeMeta = async () => {
    if (!membershipId) return;
    setMetaLoading(true);
    try {
      const m = await api.getStaffMember(membershipId);
      if (m) {
        setEmployeeMeta({
          name:       m.user?.name  || m.user?.email  || '',
          email:      m.user?.email || m.email        || '',
          phone:      m.phone       || m.user?.phone  || '',
          jobTitle:   m.jobTitle    || '',
          category:   m.category?.label || m.category || '',
          department: m.department  || m.category?.label || m.category || '',
          shift:      m.shift       || '',
          status:     m.status      || 'active',
          joinedAt:   m.joinedAt    || m.createdAt    || null,
          address:    m.address     || '',
          employeeId: m.employeeId  || m.membershipId || String(membershipId),
          baseSalary: Number(m.baseSalary || m.salary || 0),
        });
      }
    } catch (e) {
      console.error('Failed to load employee profile', e);
    } finally {
      setMetaLoading(false);
    }
  };

  const loadSalaryRecords = async (preloadedRecords = null) => {
    if (!membershipId) return;
    if (preloadedRecords) {
      setRecords(preloadedRecords);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.getStaffSalaryRecords(membershipId);
      // If backend returns empty but we have local data, prefer localStorage
      if ((!res?.records || res.records.length === 0)) {
        const localKey = `mms_mock_salary_${membershipId}`;
        const localRecords = JSON.parse(localStorage.getItem(localKey) || "[]");
        if (localRecords.length > 0) {
          setRecords(localRecords);
          setLoading(false);
          return;
        }
      }
      setRecords(res?.records || []);
    } catch (e) {
      setError(e?.message || 'Unable to load payroll records. Check your permissions.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    if (!membershipId) return;
    setAttendanceLoading(true);
    try {
      const res = await api.getStaffAttendance(membershipId, {
        from: attendanceDateFrom,
        to:   attendanceDateTo,
      });
      setAttendance(res?.history || []);
    } catch (e) {
      console.error('Failed to load attendance', e);
      setAttendance([]);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeMeta();
    loadSalaryRecords();
    loadAttendance();
  }, [membershipId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadAttendance();
  }, [attendanceDateFrom, attendanceDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const stats = useMemo(() => {
    const monthlySalary = Number(employeeMeta.baseSalary || 0);
    let totalPaidThisMonth = 0;
    let totalAdvanceThisMonth = 0;
    records.forEach((r) => {
      const recordMonthYear = r.monthYear || toMonthYear(r.date);
      if (recordMonthYear === currentMonthYear) {
        if (r.type === 'salary')  totalPaidThisMonth    += Number(r.amount || 0);
        if (r.type === 'advance') totalAdvanceThisMonth += Number(r.amount || 0);
      }
    });
    return {
      monthlySalary,
      totalPaidThisMonth,
      totalAdvanceThisMonth,
      netRemaining: monthlySalary - totalAdvanceThisMonth - totalPaidThisMonth,
    };
  }, [currentMonthYear, employeeMeta.baseSalary, records]);

  const attendanceSummary = useMemo(() => ({
    present: attendance.filter((r) => r.status === 'present').length,
    absent:  attendance.filter((r) => r.status !== 'present').length,
    late:    attendance.filter((r) => r.isLate).length,
  }), [attendance]);

  // ── Actions ──
  const handleDeleteRecord = async () => {
    if (!deleteDialog.recordId || !membershipId) return;
    setDeleteDialog((d) => ({ ...d, saving: true }));
    try {
      await api.deleteStaffSalaryRecord(membershipId, deleteDialog.recordId);
      setDeleteDialog({ open: false, recordId: null, saving: false });
      await loadSalaryRecords();
    } catch (e) {
      setError(e?.message || 'Failed to delete record. Try again.');
      setDeleteDialog((d) => ({ ...d, saving: false }));
    }
  };

  const menuActions = useMemo(() => [
    canManage && membershipId && {
      label: 'Add payroll entry',
      icon: Sparkles,
      onClick: () => { setActiveTab('history'); setPayrollAdding(true); },
    },
    {
      label: 'Export records',
      icon: Download,
      onClick: () => alert('Export is not wired to backend in this build.'),
    },
  ].filter(Boolean), [canManage, membershipId]);

  const tabs = [
    { key: 'overview',   label: 'Overview'   },
    { key: 'attendance', label: 'Attendance' },
    { key: 'history',    label: 'Payroll'    },
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
        >
          <ArrowLeft size={13} />
          Back to staff
        </button>
        <ActionMenu actions={menuActions} label="Actions" />
      </div>

      {error && <Notice title={error} tone="error" />}

      {/* ── Two-column layout: sidebar profile + main content ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

        {/* ── Left: staff profile card (sticky on desktop) ── */}
        <div className="w-full lg:sticky lg:top-6 lg:w-72 lg:shrink-0">
          <StaffProfileCard meta={employeeMeta} loading={metaLoading} />
        </div>

        {/* ── Right: tabs + content ── */}
        <div className="min-w-0 flex-1 space-y-4">
          <TabBar value={activeTab} onChange={setActiveTab} tabs={tabs} />

          {/* ════════════════════════════════════════════════════════════════
              OVERVIEW
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Salary metrics */}
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Monthly salary"
                  value={money(t, stats.monthlySalary)}
                  sub="Base pay"
                  icon={DollarSign}
                  accent
                />
                <MetricCard
                  label="Balance due"
                  value={money(t, stats.netRemaining)}
                  sub="Remaining this month"
                  icon={Clock}
                />
                <MetricCard
                  label="Advances taken"
                  value={money(t, stats.totalAdvanceThisMonth)}
                  sub={currentMonthYear}
                  icon={FileText}
                />
                <MetricCard
                  label="Salary paid"
                  value={money(t, stats.totalPaidThisMonth)}
                  sub={currentMonthYear}
                  icon={ShieldCheck}
                />
              </div>

              {/* Pay structure */}
              <Card>
                <CardHeader
                  title="Pay structure"
                  description="Compensation configuration for this employee."
                />
                <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-6 py-5">
                  <Field label="Base salary"  value={money(t, stats.monthlySalary)} />
                  <Field label="Schedule"     value="Monthly" />
                  <Field label="Shift"        value={employeeMeta.shift || '—'} />
                  <Field label="Settlement"   value="Advances + partials" />
                </div>
              </Card>

              {/* Attendance snapshot */}
              <Card>
                <CardHeader
                  title="Attendance snapshot"
                  description="Last 30 days."
                />
                <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
                  {[
                    { label: 'Present', value: attendanceSummary.present, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Late',    value: attendanceSummary.late,    color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Absent',  value: attendanceSummary.absent,  color: 'text-rose-600 dark:text-rose-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="py-5 text-center">
                      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ATTENDANCE
          ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Present"       value={attendanceSummary.present} sub={`${attendanceDateFrom} → ${attendanceDateTo}`} icon={Users} />
                <MetricCard label="Late arrivals" value={attendanceSummary.late}    sub="In selected range" icon={Clock} />
                <MetricCard label="Absent"        value={attendanceSummary.absent}  sub="In selected range" icon={Calendar} />
              </div>

              {/* Filter bar */}
              <Card className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-wrap gap-3 flex-1">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="att-from">From</label>
                      <input
                        id="att-from" type="date" className="input mt-1 block text-sm"
                        value={attendanceDateFrom}
                        onChange={(e) => setAttendanceDateFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="att-to">To</label>
                      <input
                        id="att-to" type="date" className="input mt-1 block text-sm"
                        value={attendanceDateTo}
                        onChange={(e) => setAttendanceDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary flex items-center gap-2 text-sm"
                    onClick={loadAttendance}
                    disabled={attendanceLoading}
                  >
                    <RefreshCw size={13} className={attendanceLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </Card>

              {/* Table */}
              {attendanceLoading ? (
                <Empty description="Loading records…" />
              ) : attendance.length === 0 ? (
                <Empty
                  title="No records found"
                  description="Adjust the date range above and refresh."
                />
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                          {['Date', 'Punch in', 'Punch out', 'Location', 'Status'].map((h) => (
                            <th key={h} className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {attendance.map((record) => (
                          <tr key={record.id} className="bg-white transition hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                              {formatMaybeDate(record.date, 'YYYY-MM-DD')}
                            </td>
                            <td className="p-3 tabular-nums text-slate-500 dark:text-slate-400">
                              {formatMaybeDateTime(record.punchInTime,  'hh:mm A') || '—'}
                            </td>
                            <td className="p-3 tabular-nums text-slate-500 dark:text-slate-400">
                              {formatMaybeDateTime(record.punchOutTime, 'hh:mm A') || '—'}
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
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Payroll records</h2>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    All salary payments and advances for this employee.
                  </p>
                </div>
                <span className="text-xs text-slate-400">{records.length} records</span>
              </div>

              {loading ? (
                <Empty description="Loading payroll records…" />
              ) : records.length === 0 ? (
                <Empty
                  title="No payroll records yet"
                  description="Add the first entry using the form below."
                />
              ) : (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Date</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Period</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Type</th>
                          <th className="p-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Amount</th>
                          <th className="p-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Note</th>
                          <th className="p-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                        {records.map((r) => (
                          <tr key={r.id} className="bg-white transition hover:bg-slate-50/60 dark:bg-slate-900 dark:hover:bg-slate-800/30">
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {formatMaybeDate(r.date) || '—'}
                            </td>
                            <td className="p-3 tabular-nums text-slate-600 dark:text-slate-400">
                              {r.monthYear || toMonthYear(r.date) || '—'}
                            </td>
                            <td className="p-3">
                              <TypePill type={r.type} />
                            </td>
                            <td className="p-3 text-right font-semibold tabular-nums text-slate-900 dark:text-white">
                              {money(t, r.amount)}
                            </td>
                            <td className="max-w-[160px] truncate p-3 text-slate-400 dark:text-slate-500" title={r.note}>
                              {r.note || '—'}
                            </td>
                            <td className="p-3 text-right">
                              {canManage && (
                                <button
                                  type="button"
                                  className="text-xs font-medium text-slate-300 transition hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400"
                                  onClick={() => setDeleteDialog({ open: true, recordId: r.id, saving: false })}
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
        onClose={() => !deleteDialog.saving && setDeleteDialog({ open: false, recordId: null, saving: false })}
        onConfirm={handleDeleteRecord}
        title="Delete this record?"
        description="This cannot be undone. The entry will be permanently removed from payroll history."
        confirming={deleteDialog.saving}
      />
    </div>
  );
}

// ─── Payroll Entry Panel ──────────────────────────────────────────────────────

function PayrollEntryPanel({ t, membershipId, currentMonthYear, onSaved, adding: addingProp, onAddingChange }) {
  const [adding, setAdding]       = useState(Boolean(addingProp));
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [type, setType]           = useState('advance');
  const [amount, setAmount]       = useState('');
  const [date, setDate]           = useState(() => new Date().toISOString().slice(0, 10));
  const [monthYear, setMonthYear] = useState(currentMonthYear);
  const [note, setNote]           = useState('');

  useEffect(() => { setAdding(Boolean(addingProp)); }, [addingProp]);
  useEffect(() => { setMonthYear(currentMonthYear); }, [currentMonthYear]);

  const open  = (val) => { setAdding(val); onAddingChange?.(val); };
  const close = () => open(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!membershipId) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api.addStaffSalaryRecord(membershipId, { amount: numericAmount, type, date, monthYear, note });
      close();
      setAmount('');
      setNote('');
      // Build the new record and prepend it to existing records for immediate UI update
      const newRecord = result?.record || {
        id: Math.random().toString(36).substr(2, 9),
        date,
        amount: numericAmount,
        type,
        monthYear,
        note,
        createdAt: new Date().toISOString(),
      };
      // Directly update parent state via onSaved with a synthetic records array
      if (result?.records) {
        await onSaved(result.records);
      } else {
        const localKey = `mms_mock_salary_${membershipId}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || "[]");
        await onSaved(existing.length > 0 ? existing : [newRecord]);
      }
    } catch (err) {
      setError(err?.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Add entry"
        description="Record a salary payment or advance against any month."
        right={
          !adding && (
            <button type="button" className="btn-primary text-xs" onClick={() => open(true)}>
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
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="sal-type">Type</label>
              <select id="sal-type" className="input mt-1 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="advance">Salary advance</option>
                <option value="salary">Salary payment</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="sal-amount">Amount</label>
              <input
                id="sal-amount" className="input mt-1 text-sm"
                type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)} required
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="sal-date">Date</label>
              <input
                id="sal-date" className="input mt-1 text-sm"
                type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="sal-month">
                Applies to month
              </label>
              <input
                id="sal-month" className="input mt-1 text-sm"
                type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} required
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400" htmlFor="sal-note">
                Note <span className="normal-case font-normal text-slate-300">(optional)</span>
              </label>
              <input
                id="sal-note" className="input mt-1 text-sm"
                type="text" value={note}
                placeholder="e.g. Festival advance, partial June payment…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>

          <Divider />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={close}>
              Cancel
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
