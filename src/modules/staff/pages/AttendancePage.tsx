import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Pencil, XCircle } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { attendanceService } from '../api/attendanceService';
import { directoryService } from '../api/directoryService';
import { AttendanceCorrectionDialog } from '../components/StaffDialogs';
import { DataTable, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { AttendanceRecord } from '../types/staff';
import { approvalStatusLabel, attendanceStatusLabel, formatDate, formatHours, formatMinutes } from '../utils/staffFormatters';

export default function AttendancePage() {
  const [filters, setFilters] = useState({
    search: '',
    staffId: '',
    department: '',
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const attendanceLoader = useCallback(() => attendanceService.listAttendance(filters), [filters]);
  const staffLoader = useCallback(() => directoryService.listStaffDirectory({
    search: '',
    status: 'active',
    department: '',
    designation: '',
    salaryType: 'all',
    page: 1,
    pageSize: 50,
  }), []);

  const attendanceResource = useAsyncResource({
    loader: attendanceLoader,
    initialData: [],
    deps: [attendanceLoader],
  });
  const staffResource = useAsyncResource({
    loader: staffLoader,
    initialData: {
      records: { items: [], total: 0, limit: 50, offset: 0 },
      summary: {
        totalStaff: 0,
        activeStaff: 0,
        salaryCommitment: 0,
        outstandingAdvanceBalance: 0,
      },
    },
    deps: [staffLoader],
  });

  const departments = useMemo(
    () => [...new Set(staffResource.data.records.items.map((item) => item.department).filter(Boolean))],
    [staffResource.data.records.items],
  );
  const summary = useMemo(() => ({
    total: attendanceResource.data.length,
    present: attendanceResource.data.filter((item) => item.status === 'present' || item.status === 'late').length,
    pending: attendanceResource.data.filter((item) => item.approvalStatus === 'pending').length,
    overtimeMinutes: attendanceResource.data.reduce((total, item) => total + item.overtimeMinutes, 0),
  }), [attendanceResource.data]);

  const handleApproval = async (record: AttendanceRecord, approvalStatus: AttendanceRecord['approvalStatus']) => {
    try {
      await attendanceService.correctAttendance(record.id, {
        status: record.status,
        clockIn: record.clockIn?.slice(11, 16) || '',
        clockOut: record.clockOut?.slice(11, 16) || '',
        approvalStatus,
        correctionReason: approvalStatus === 'approved'
          ? (record.correctionReason || 'Approved manually.')
          : 'Rejected manually after review.',
      });

      setNotice({
        tone: 'success',
        message: approvalStatus === 'approved' ? 'Attendance correction approved.' : 'Attendance correction rejected.',
      });
      await attendanceResource.reload();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update attendance approval.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance register"
        subtitle="Review date-wise attendance, process manual corrections, and keep approvals keyboard-friendly."
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={attendanceResource.source} message="Attendance is currently backed by fixtures because the dedicated endpoint is not fully available yet." />

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryMetricCard label="Rows" value={summary.total} hint="Filtered attendance entries" icon={<Clock3 size={18} />} />
        <SummaryMetricCard label="Present / late" value={summary.present} hint="Attendance statuses marked workable" icon={<CheckCircle2 size={18} />} />
        <SummaryMetricCard label="Pending approval" value={summary.pending} hint="Manual review queue" icon={<Pencil size={18} />} />
        <SummaryMetricCard label="Overtime" value={formatMinutes(summary.overtimeMinutes)} hint="Captured overtime minutes" icon={<Clock3 size={18} />} />
      </div>

      <SectionCard title="Filters" subtitle="Narrow the register by staff member, team, date range, or attendance status.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
          <label className="block">
            <span className="label">Search</span>
            <input className="input mt-1" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Staff, shift, department" />
          </label>
          <label className="block">
            <span className="label">Staff</span>
            <select className="input mt-1" value={filters.staffId} onChange={(event) => setFilters((current) => ({ ...current, staffId: event.target.value }))}>
              <option value="">All staff</option>
              {staffResource.data.records.items.map((item) => (
                <option key={item.id} value={item.id}>{item.fullName}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Department</span>
            <select className="input mt-1" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Status</span>
            <select className="input mt-1" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">All statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half day</option>
              <option value="leave">Leave</option>
              <option value="absent">Absent</option>
            </select>
          </label>
          <label className="block">
            <span className="label">From</span>
            <input className="input mt-1" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input className="input mt-1" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
        </div>
      </SectionCard>

      {attendanceResource.error ? (
        <ErrorBanner title="Could not load attendance records." description={attendanceResource.error} onRetry={() => void attendanceResource.reload()} />
      ) : null}

      <SectionCard title="Attendance register" subtitle="Manual corrections and approvals stay directly in the list so the workflow is fast.">
        <DataTable
          columns={[
            {
              key: 'staff',
              header: 'Staff',
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">{row.staffName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{row.department}</p>
                </div>
              ),
            },
            { key: 'date', header: 'Date', render: (row) => formatDate(row.attendanceDate) },
            { key: 'shift', header: 'Shift', render: (row) => row.shiftName },
            { key: 'clockIn', header: 'Clock in', render: (row) => row.clockIn ? row.clockIn.slice(11, 16) : '—' },
            { key: 'clockOut', header: 'Clock out', render: (row) => row.clockOut ? row.clockOut.slice(11, 16) : '—' },
            { key: 'worked', header: 'Worked', render: (row) => formatHours(row.workedHours) },
            { key: 'late', header: 'Late', render: (row) => formatMinutes(row.lateMinutes) },
            { key: 'overtime', header: 'Overtime', render: (row) => formatMinutes(row.overtimeMinutes) },
            { key: 'status', header: 'Status', render: (row) => <StatusChip label={attendanceStatusLabel(row.status)} tone={row.status === 'present' ? 'success' : row.status === 'late' ? 'warning' : 'neutral'} /> },
            { key: 'approval', header: 'Approval', render: (row) => <StatusChip label={approvalStatusLabel(row.approvalStatus)} tone={row.approvalStatus === 'approved' ? 'success' : row.approvalStatus === 'rejected' ? 'danger' : 'warning'} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    onClick={() => {
                      setEditingRecord(row);
                      setFormError('');
                      setDialogOpen(true);
                    }}
                  >
                    Correct
                  </button>
                  <button type="button" className="btn-ghost px-3 py-2 text-emerald-700" onClick={() => void handleApproval(row, 'approved')}>
                    Approve
                  </button>
                  <button type="button" className="btn-ghost px-3 py-2 text-rose-700" onClick={() => void handleApproval(row, 'rejected')}>
                    Reject
                  </button>
                </div>
              ),
            },
          ]}
          rows={attendanceResource.data}
          getRowKey={(row) => row.id}
          loading={attendanceResource.loading}
          emptyTitle="No attendance rows"
          emptyDescription="Attendance entries matching the current filters will show here."
        />
      </SectionCard>

      <AttendanceCorrectionDialog
        isOpen={dialogOpen}
        saving={saving}
        serverError={formError}
        attendance={editingRecord}
        onClose={() => {
          setDialogOpen(false);
          setEditingRecord(null);
          setFormError('');
        }}
        onSubmit={async (values) => {
          if (!editingRecord) return;
          setSaving(true);
          setFormError('');

          try {
            await attendanceService.correctAttendance(editingRecord.id, values);
            setDialogOpen(false);
            setEditingRecord(null);
            setNotice({ tone: 'success', message: 'Attendance correction saved successfully.' });
            await attendanceResource.reload();
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to save attendance correction.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
