import { useCallback, useMemo, useState } from 'react';
import { BadgeDollarSign, Clock3, ShieldCheck, TimerReset } from 'lucide-react';
import PageHeader from '../../../components/PageHeader.jsx';
import { directoryService } from '../api/directoryService';
import { overtimeService } from '../api/overtimeService';
import { DataTable, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { approvalStatusLabel, formatHours, formatMoney } from '../utils/staffFormatters';

export default function OvertimePage() {
  const [filters, setFilters] = useState({
    staffId: '',
    department: '',
    startDate: '',
    endDate: '',
    approvalStatus: 'all',
  });

  const summaryLoader = useCallback(() => overtimeService.listSummary(filters), [filters]);
  const policyLoader = useCallback(() => overtimeService.listPolicies(), []);
  const staffLoader = useCallback(() => directoryService.listStaffDirectory({
    search: '',
    status: 'active',
    department: '',
    designation: '',
    salaryType: 'all',
    page: 1,
    pageSize: 50,
  }), []);

  const summaryResource = useAsyncResource({
    loader: summaryLoader,
    initialData: [],
    deps: [summaryLoader],
  });
  const policyResource = useAsyncResource({
    loader: policyLoader,
    initialData: [],
    deps: [policyLoader],
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
  const cards = useMemo(() => ({
    scheduledHours: summaryResource.data.reduce((total, item) => total + item.scheduledHours, 0),
    workedHours: summaryResource.data.reduce((total, item) => total + item.workedHours, 0),
    approvedHours: summaryResource.data.reduce((total, item) => total + item.approvedOvertimeHours, 0),
    overtimeAmount: summaryResource.data.reduce((total, item) => total + item.overtimeAmount, 0),
  }), [summaryResource.data]);
  const activePolicy = policyResource.data.find((item) => item.isActive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overtime summary"
        subtitle="Rely on server-side overtime totals for payroll accuracy while still keeping review filters responsive."
      />

      <SourceBanner source={summaryResource.source} message="Overtime figures are currently coming from fixtures because the overtime summary endpoint is still being finalized." />

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryMetricCard label="Scheduled hours" value={formatHours(cards.scheduledHours)} hint="Filtered period total" icon={<Clock3 size={18} />} />
        <SummaryMetricCard label="Worked hours" value={formatHours(cards.workedHours)} hint="Attendance-derived total" icon={<TimerReset size={18} />} />
        <SummaryMetricCard label="Approved OT" value={formatHours(cards.approvedHours)} hint={activePolicy ? `${activePolicy.name} active` : 'No active policy'} icon={<ShieldCheck size={18} />} />
        <SummaryMetricCard label="Overtime amount" value={formatMoney(cards.overtimeAmount)} hint="Server-sourced payable total" icon={<BadgeDollarSign size={18} />} />
      </div>

      <SectionCard title="Filters" subtitle="Narrow the overtime workload by person, team, date range, or approval state.">
        <div className="grid gap-4 xl:grid-cols-5">
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
            <span className="label">From</span>
            <input className="input mt-1" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input className="input mt-1" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} />
          </label>
          <label className="block">
            <span className="label">Approval</span>
            <select className="input mt-1" value={filters.approvalStatus} onChange={(event) => setFilters((current) => ({ ...current, approvalStatus: event.target.value }))}>
              <option value="all">All statuses</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
      </SectionCard>

      {summaryResource.error ? (
        <ErrorBanner title="Could not load overtime totals." description={summaryResource.error} onRetry={() => void summaryResource.reload()} />
      ) : null}

      <SectionCard title="Summary table" subtitle="These values should flow from the backend so payroll uses the same numbers.">
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
            { key: 'scheduled', header: 'Scheduled', render: (row) => formatHours(row.scheduledHours) },
            { key: 'worked', header: 'Worked', render: (row) => formatHours(row.workedHours) },
            { key: 'ot', header: 'Overtime', render: (row) => formatHours(row.overtimeHours) },
            { key: 'approved', header: 'Approved OT', render: (row) => formatHours(row.approvedOvertimeHours) },
            { key: 'amount', header: 'Amount', render: (row) => formatMoney(row.overtimeAmount) },
            { key: 'approval', header: 'Approval', render: (row) => <StatusChip label={approvalStatusLabel(row.approvalStatus)} tone={row.approvalStatus === 'approved' ? 'success' : row.approvalStatus === 'rejected' ? 'danger' : 'warning'} /> },
          ]}
          rows={summaryResource.data}
          getRowKey={(row) => `${row.staffId}-${row.department}`}
          loading={summaryResource.loading}
          emptyTitle="No overtime rows"
          emptyDescription="The summary table will populate when approved or pending overtime exists for the filtered period."
        />
      </SectionCard>

      {activePolicy ? (
        <SectionCard title="Active policy" subtitle="The currently active policy defines how thresholds and multipliers should be interpreted.">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Policy</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{activePolicy.name}</p>
            </div>
            <div className="rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Threshold</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{activePolicy.thresholdMinutes} min</p>
            </div>
            <div className="rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rounding</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{activePolicy.rounding}</p>
            </div>
            <div className="rounded-2xl bg-slate-50/80 px-4 py-4 dark:bg-slate-950/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Multiplier</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">{activePolicy.multiplier}x</p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
