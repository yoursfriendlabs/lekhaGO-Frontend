import { useCallback, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, FilePlus2, Landmark, Pencil, Wallet } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { directoryService } from '../api/directoryService';
import { attendanceService } from '../api/attendanceService';
import { leaveService } from '../api/leaveService';
import { overtimeService } from '../api/overtimeService';
import { payrollService } from '../api/payrollService';
import { rosterService } from '../api/rosterService';
import { LedgerEntryDialog, StaffRecordDialog } from '../components/StaffDialogs';
import { DataTable, EmptyState, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard, cn } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { LedgerEntry, StaffRecord } from '../types/staff';
import { approvalStatusLabel, attendanceStatusLabel, entryTypeLabel, formatDate, formatDateTime, formatHours, formatMinutes, formatMoney, leaveStatusLabel, payrollStatusLabel, salaryTypeLabel } from '../utils/staffFormatters';

const TAB_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'shift', label: 'Shift assignment' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'overtime', label: 'Overtime' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'ledger', label: 'Ledger' },
] as const;

type StaffProfileTab = typeof TAB_OPTIONS[number]['key'];

function useTabState(): [StaffProfileTab, (nextValue: StaffProfileTab) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = searchParams.get('tab');
  const tab = TAB_OPTIONS.some((item) => item.key === current) ? (current as StaffProfileTab) : 'overview';

  return [
    tab,
    (nextValue: StaffProfileTab) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextValue === 'overview') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', nextValue);
      }
      setSearchParams(nextParams);
    },
  ];
}

function InfoList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-slate-50/80 px-4 py-3 dark:bg-slate-950/40">
          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{item.label}</dt>
          <dd className="mt-2 text-sm text-slate-700 dark:text-slate-200">{item.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ProfilePage() {
  const { staffId = '' } = useParams();
  const [activeTab, setActiveTab] = useTabState();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [editingLedger, setEditingLedger] = useState<LedgerEntry | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [ledgerError, setLedgerError] = useState('');

  const staffLoader = useCallback(() => directoryService.getStaffRecord(staffId), [staffId]);
  const linkedAccountsLoader = useCallback(() => directoryService.listLinkedAccounts(), []);
  const ledgerLoader = useCallback(() => directoryService.listLedgerEntries(staffId), [staffId]);
  const assignmentsLoader = useCallback(() => rosterService.listShiftAssignments(), []);
  const attendanceLoader = useCallback(() => attendanceService.listAttendance({
    search: '',
    staffId,
    department: '',
    status: 'all',
    startDate: '',
    endDate: '',
  }), [staffId]);
  const overtimeLoader = useCallback(() => overtimeService.listSummary({
    staffId,
    department: '',
    startDate: '',
    endDate: '',
    approvalStatus: 'all',
  }), [staffId]);
  const leaveLoader = useCallback(() => leaveService.listLeaveRequests(), []);
  const payrollLoader = useCallback(() => payrollService.listPayrollRuns({
    status: 'all',
    startDate: '',
    endDate: '',
  }), []);

  const staffResource = useAsyncResource({
    loader: staffLoader,
    initialData: null as StaffRecord | null,
    deps: [staffLoader],
  });
  const linkedAccountsResource = useAsyncResource({
    loader: linkedAccountsLoader,
    initialData: [],
    deps: [linkedAccountsLoader],
  });
  const ledgerResource = useAsyncResource({
    loader: ledgerLoader,
    initialData: [],
    deps: [ledgerLoader],
  });
  const assignmentsResource = useAsyncResource({
    loader: assignmentsLoader,
    initialData: [],
    deps: [assignmentsLoader],
  });
  const attendanceResource = useAsyncResource({
    loader: attendanceLoader,
    initialData: [],
    deps: [attendanceLoader],
  });
  const overtimeResource = useAsyncResource({
    loader: overtimeLoader,
    initialData: [],
    deps: [overtimeLoader],
  });
  const leaveResource = useAsyncResource({
    loader: leaveLoader,
    initialData: [],
    deps: [leaveLoader],
  });
  const payrollResource = useAsyncResource({
    loader: payrollLoader,
    initialData: [],
    deps: [payrollLoader],
  });

  const record = staffResource.data;
  const assignments = useMemo(
    () => assignmentsResource.data.filter((item) => item.staffId === staffId),
    [assignmentsResource.data, staffId],
  );
  const leaveRequests = useMemo(
    () => leaveResource.data.filter((item) => item.staffId === staffId),
    [leaveResource.data, staffId],
  );
  const payrollRuns = useMemo(
    () => payrollResource.data.filter((run) => run.items.some((item) => item.staffId === staffId)),
    [payrollResource.data, staffId],
  );
  const anyMock = [
    staffResource.source,
    ledgerResource.source,
    assignmentsResource.source,
    attendanceResource.source,
    overtimeResource.source,
    leaveResource.source,
    payrollResource.source,
  ].includes('mock');

  if (staffResource.error && !record) {
    return (
      <div className="space-y-6">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff">
          <ArrowLeft size={16} />
          Back to directory
        </Link>
        <ErrorBanner
          title="Could not load the staff profile."
          description={staffResource.error}
          onRetry={() => void staffResource.reload()}
        />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-4">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff">
          <ArrowLeft size={16} />
          Back to directory
        </Link>
        <SectionCard title="Loading staff profile" subtitle="Syncing profile details, finance summary, and related records.">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  const overviewFields = [
    { label: 'Staff code', value: record.staffCode },
    { label: 'Full name', value: record.fullName },
    { label: 'Phone', value: record.phone || '—' },
    { label: 'Email', value: record.email || '—' },
    { label: 'Department', value: record.department },
    { label: 'Designation', value: record.designation },
    { label: 'Join date', value: formatDate(record.joinedOn) },
    { label: 'Salary type', value: salaryTypeLabel(record.salaryType) },
    { label: 'Salary amount', value: formatMoney(record.salaryAmount) },
    { label: 'Linked account', value: record.linkedAccount?.email || 'Not linked' },
    { label: 'Status', value: record.isActive ? 'Active' : 'Inactive' },
    { label: 'Notes', value: record.notes || '—' },
  ];

  const renderActiveTab = () => {
    if (activeTab === 'overview') {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-5">
            <SummaryMetricCard label="Base salary" value={formatMoney(record.salaryAmount)} hint={salaryTypeLabel(record.salaryType)} icon={<Wallet size={18} />} />
            <SummaryMetricCard label="Opening advance" value={formatMoney(record.financeSummary.openingAdvanceBalance)} hint="Opening carried balance" icon={<Landmark size={18} />} />
            <SummaryMetricCard label="Salary paid" value={formatMoney(record.financeSummary.totalSalaryPaid)} hint="Total settled salary" icon={<Wallet size={18} />} />
            <SummaryMetricCard label="Advance given" value={formatMoney(record.financeSummary.totalAdvanceGiven)} hint="All advances recorded" icon={<FilePlus2 size={18} />} />
            <SummaryMetricCard label="Advance due" value={formatMoney(record.financeSummary.outstandingAdvanceBalance)} hint="Outstanding balance" icon={<CalendarClock size={18} />} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SectionCard title="Overview" subtitle="Personal, employment, and salary setup for this staff member.">
              <InfoList items={overviewFields} />
            </SectionCard>
            <SectionCard title="Recent transactions" subtitle="Most recent salary and advance movements.">
              {ledgerResource.loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                  ))}
                </div>
              ) : ledgerResource.data.length === 0 ? (
                <EmptyState title="No recent transactions" description="Ledger activity will appear here after salary or advance entries are recorded." />
              ) : (
                <div className="space-y-3">
                  {ledgerResource.data.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-950/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{entryTypeLabel(entry.entryType)}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{formatDate(entry.entryDate)}{entry.referenceMonth ? ` · ${entry.referenceMonth}` : ''}</p>
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">{formatMoney(entry.amount)}</p>
                      </div>
                      {entry.note ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{entry.note}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      );
    }

    if (activeTab === 'shift') {
      return (
        <SectionCard title="Shift assignments" subtitle="Active and upcoming shift allocations for this staff member.">
          <DataTable
            columns={[
              { key: 'shift', header: 'Shift', render: (row) => row.shiftName },
              { key: 'dateFrom', header: 'From', render: (row) => formatDate(row.dateFrom) },
              { key: 'dateTo', header: 'To', render: (row) => formatDate(row.dateTo) },
              { key: 'weeklyOff', header: 'Weekly off', render: (row) => row.weeklyOffDays.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ') || '—' },
              { key: 'note', header: 'Note', render: (row) => row.note || '—' },
            ]}
            rows={assignments}
            getRowKey={(row) => row.id}
            loading={assignmentsResource.loading}
            emptyTitle="No shifts assigned"
            emptyDescription="Assign a shift from the directory or roster screen to start tracking this profile."
          />
        </SectionCard>
      );
    }

    if (activeTab === 'attendance') {
      return (
        <SectionCard title="Attendance history" subtitle="Latest attendance rows and approval outcomes.">
          <DataTable
            columns={[
              { key: 'date', header: 'Date', render: (row) => formatDate(row.attendanceDate) },
              { key: 'shift', header: 'Shift', render: (row) => row.shiftName },
              { key: 'clock', header: 'Clock in / out', render: (row) => `${row.clockIn ? formatDateTime(row.clockIn) : '—'} / ${row.clockOut ? formatDateTime(row.clockOut) : '—'}` },
              { key: 'worked', header: 'Worked', render: (row) => formatHours(row.workedHours) },
              { key: 'late', header: 'Late', render: (row) => formatMinutes(row.lateMinutes) },
              { key: 'status', header: 'Status', render: (row) => <StatusChip label={attendanceStatusLabel(row.status)} tone={row.status === 'present' ? 'success' : row.status === 'late' ? 'warning' : 'neutral'} /> },
              { key: 'approval', header: 'Approval', render: (row) => <StatusChip label={approvalStatusLabel(row.approvalStatus)} tone={row.approvalStatus === 'approved' ? 'success' : row.approvalStatus === 'rejected' ? 'danger' : 'warning'} /> },
            ]}
            rows={attendanceResource.data}
            getRowKey={(row) => row.id}
            loading={attendanceResource.loading}
            emptyTitle="No attendance records"
            emptyDescription="Attendance history will show up here once the register starts tracking this staff member."
          />
        </SectionCard>
      );
    }

    if (activeTab === 'overtime') {
      const overtime = overtimeResource.data[0];

      return (
        <div className="space-y-6">
          {overtime ? (
            <div className="grid gap-4 md:grid-cols-4">
              <SummaryMetricCard label="Scheduled hours" value={formatHours(overtime.scheduledHours)} hint="For the filtered period" />
              <SummaryMetricCard label="Worked hours" value={formatHours(overtime.workedHours)} hint="Captured from attendance" />
              <SummaryMetricCard label="Approved overtime" value={formatHours(overtime.approvedOvertimeHours)} hint={approvalStatusLabel(overtime.approvalStatus)} />
              <SummaryMetricCard label="Overtime amount" value={formatMoney(overtime.overtimeAmount)} hint="Server-sourced total" />
            </div>
          ) : null}

          <SectionCard title="Overtime detail" subtitle="Use server totals as the source of truth for payout calculations.">
            <DataTable
              columns={[
                { key: 'scheduled', header: 'Scheduled', render: (row) => formatHours(row.scheduledHours) },
                { key: 'worked', header: 'Worked', render: (row) => formatHours(row.workedHours) },
                { key: 'ot', header: 'Overtime', render: (row) => formatHours(row.overtimeHours) },
                { key: 'approved', header: 'Approved OT', render: (row) => formatHours(row.approvedOvertimeHours) },
                { key: 'amount', header: 'OT amount', render: (row) => formatMoney(row.overtimeAmount) },
                { key: 'status', header: 'Approval', render: (row) => <StatusChip label={approvalStatusLabel(row.approvalStatus)} tone={row.approvalStatus === 'approved' ? 'success' : 'warning'} /> },
              ]}
              rows={overtimeResource.data}
              getRowKey={(row) => `${row.staffId}-${row.department}`}
              loading={overtimeResource.loading}
              emptyTitle="No overtime summary"
              emptyDescription="Overtime totals will show here when approved time exists for this staff member."
            />
          </SectionCard>
        </div>
      );
    }

    if (activeTab === 'leave') {
      return (
        <SectionCard title="Leave history" subtitle="Current and past leave requests connected to this profile.">
          <DataTable
            columns={[
              { key: 'type', header: 'Leave type', render: (row) => row.leaveType },
              { key: 'period', header: 'Period', render: (row) => `${formatDate(row.startDate)} → ${formatDate(row.endDate)}` },
              { key: 'days', header: 'Days', render: (row) => row.days },
              { key: 'status', header: 'Status', render: (row) => <StatusChip label={leaveStatusLabel(row.status)} tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'} /> },
              { key: 'reason', header: 'Reason', render: (row) => row.reason },
            ]}
            rows={leaveRequests}
            getRowKey={(row) => row.id}
            loading={leaveResource.loading}
            emptyTitle="No leave requests"
            emptyDescription="This staff member has no linked leave requests yet."
          />
        </SectionCard>
      );
    }

    if (activeTab === 'payroll') {
      return (
        <SectionCard title="Payroll involvement" subtitle="Runs where this staff member appears as a payable line item.">
          <DataTable
            columns={[
              { key: 'runCode', header: 'Run', render: (row) => <Link className="font-semibold text-primary" to={`/app/staff/payroll/${row.id}`}>{row.runCode}</Link> },
              { key: 'period', header: 'Period', render: (row) => `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}` },
              { key: 'payout', header: 'Payout', render: (row) => formatDate(row.payoutDate) },
              { key: 'status', header: 'Status', render: (row) => <StatusChip label={payrollStatusLabel(row.status)} tone={row.status === 'paid' ? 'success' : row.status === 'approved' ? 'info' : 'warning'} /> },
              {
                key: 'net',
                header: 'Net payable',
                render: (row) => {
                  const item = row.items.find((entry) => entry.staffId === staffId);
                  return formatMoney(item?.netPayable || 0);
                },
              },
            ]}
            rows={payrollRuns}
            getRowKey={(row) => row.id}
            loading={payrollResource.loading}
            emptyTitle="No payroll runs"
            emptyDescription="Payroll runs involving this staff member will appear here."
          />
        </SectionCard>
      );
    }

    return (
      <SectionCard
        title="Ledger"
        subtitle="Track salary payments, advances, and recoveries linked to this profile."
        action={(
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditingLedger(null);
              setLedgerError('');
              setLedgerDialogOpen(true);
            }}
          >
            Add entry
          </button>
        )}
      >
        {ledgerResource.error ? (
          <ErrorBanner
            title="Could not load ledger entries."
            description={ledgerResource.error}
            onRetry={() => void ledgerResource.reload()}
          />
        ) : null}
        <DataTable
          columns={[
            { key: 'entryType', header: 'Entry type', render: (row) => entryTypeLabel(row.entryType) },
            { key: 'date', header: 'Date', render: (row) => formatDate(row.entryDate) },
            { key: 'reference', header: 'Reference month', render: (row) => row.referenceMonth || '—' },
            { key: 'method', header: 'Payment method', render: (row) => row.paymentMethod || '—' },
            { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.amount) },
            { key: 'note', header: 'Note', render: (row) => row.note || '—' },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    onClick={() => {
                      setEditingLedger(row);
                      setLedgerError('');
                      setLedgerDialogOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2 text-rose-700"
                    onClick={async () => {
                      const confirmed = window.confirm('Delete this ledger entry?');
                      if (!confirmed) return;

                      try {
                        await directoryService.deleteLedgerEntry(staffId, row.id);
                        setNotice({ tone: 'success', message: 'Ledger entry deleted successfully.' });
                        await Promise.all([ledgerResource.reload(), staffResource.reload()]);
                      } catch (error) {
                        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to delete ledger entry.' });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={ledgerResource.data}
          getRowKey={(row) => row.id}
          loading={ledgerResource.loading}
          emptyTitle="No ledger entries"
          emptyDescription="Add salary and advance movements to build the financial trail for this staff member."
        />
      </SectionCard>
    );
  };

  return (
    <div className="space-y-6">
      <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff">
        <ArrowLeft size={16} />
        Back to directory
      </Link>

      <PageHeader
        title={record.fullName}
        subtitle={`${record.staffCode} · ${record.designation} · ${record.department}`}
        action={(
          <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
            <Pencil size={16} className="mr-2" />
            Edit profile
          </button>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      {anyMock ? (
        <SourceBanner
          source="mock"
          message="One or more profile sub-sections are running on fixture-backed data until every staff endpoint is available."
        />
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200/70 bg-white/80 p-2 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/50">
        {TAB_OPTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              activeTab === item.key
                ? 'bg-primary text-white shadow-soft'
                : 'text-slate-600 hover:bg-secondary-100 dark:text-slate-200 dark:hover:bg-slate-800/70',
            )}
            onClick={() => setActiveTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {renderActiveTab()}

      <StaffRecordDialog
        isOpen={editOpen}
        title="Edit staff profile"
        saving={profileSaving}
        serverError={profileError}
        linkedAccounts={linkedAccountsResource.data}
        initialValues={record}
        onClose={() => {
          setEditOpen(false);
          setProfileError('');
        }}
        onSubmit={async (values) => {
          setProfileSaving(true);
          setProfileError('');

          try {
            await directoryService.updateStaffRecord(staffId, values);
            setEditOpen(false);
            setNotice({ tone: 'success', message: 'Staff profile updated successfully.' });
            await staffResource.reload();
          } catch (error) {
            setProfileError(error instanceof Error ? error.message : 'Unable to save staff profile.');
          } finally {
            setProfileSaving(false);
          }
        }}
      />

      <LedgerEntryDialog
        isOpen={ledgerDialogOpen}
        saving={ledgerSaving}
        serverError={ledgerError}
        initialValues={editingLedger}
        onClose={() => {
          setLedgerDialogOpen(false);
          setEditingLedger(null);
          setLedgerError('');
        }}
        onSubmit={async (values) => {
          setLedgerSaving(true);
          setLedgerError('');

          try {
            if (editingLedger) {
              await directoryService.updateLedgerEntry(staffId, editingLedger.id, values);
              setNotice({ tone: 'success', message: 'Ledger entry updated successfully.' });
            } else {
              await directoryService.createLedgerEntry(staffId, values);
              setNotice({ tone: 'success', message: 'Ledger entry created successfully.' });
            }

            setLedgerDialogOpen(false);
            setEditingLedger(null);
            await Promise.all([ledgerResource.reload(), staffResource.reload()]);
          } catch (error) {
            setLedgerError(error instanceof Error ? error.message : 'Unable to save ledger entry.');
          } finally {
            setLedgerSaving(false);
          }
        }}
      />
    </div>
  );
}
