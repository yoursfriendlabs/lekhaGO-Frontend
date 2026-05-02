import { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet, HandCoins, Plus, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { payrollService } from '../api/payrollService';
import { PayrollRunDialog } from '../components/StaffDialogs';
import { DataTable, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { PayrollRun } from '../types/staff';
import { formatDate, formatMoney, payrollStatusLabel } from '../utils/staffFormatters';

function nextRunState(run: PayrollRun, target: PayrollRun['status']): PayrollRun {
  if (target === 'calculated' && run.items.length === 0) {
    return {
      ...run,
      status: 'calculated',
    };
  }

  if (target === 'paid') {
    return {
      ...run,
      status: 'paid',
      items: run.items.map((item) => ({ ...item, paymentStatus: 'paid' })),
    };
  }

  return {
    ...run,
    status: target,
  };
}

export default function PayrollRunsPage() {
  const [filters, setFilters] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
  });
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loader = useCallback(() => payrollService.listPayrollRuns(filters), [filters]);
  const payrollResource = useAsyncResource({
    loader,
    initialData: [],
    deps: [loader],
  });

  const summary = useMemo(() => ({
    draft: payrollResource.data.filter((item) => item.status === 'draft').length,
    approved: payrollResource.data.filter((item) => item.status === 'approved').length,
    netPayable: payrollResource.data.reduce((total, item) => total + item.totals.netPayable, 0),
  }), [payrollResource.data]);

  const updateRunStatus = async (run: PayrollRun, status: PayrollRun['status']) => {
    try {
      await payrollService.updatePayrollRun(run.id, nextRunState(run, status));
      setNotice({ tone: 'success', message: `Payroll run moved to ${payrollStatusLabel(status).toLowerCase()}.` });
      await payrollResource.reload();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update payroll run.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll runs"
        subtitle="Create and advance payroll runs while keeping status, totals, and export actions visible to finance operators."
        action={(
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFormError('');
              setDialogOpen(true);
            }}
          >
            <Plus size={16} className="mr-2" />
            Create payroll run
          </button>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={payrollResource.source} message="Payroll runs are currently using fixture-backed data whenever the payroll endpoint is unavailable." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryMetricCard label="Draft runs" value={summary.draft} hint="Not finalized yet" icon={<FileSpreadsheet size={18} />} />
        <SummaryMetricCard label="Approved runs" value={summary.approved} hint="Ready for payout" icon={<ShieldCheck size={18} />} />
        <SummaryMetricCard label="Net payable" value={formatMoney(summary.netPayable)} hint="Filtered payroll liability" icon={<HandCoins size={18} />} />
      </div>

      <SectionCard title="Filters" subtitle="Focus on a status or date range when finance closes multiple payroll periods.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="label">Status</span>
            <select className="input mt-1" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="calculated">Calculated</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
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

      {payrollResource.error ? (
        <ErrorBanner title="Could not load payroll runs." description={payrollResource.error} onRetry={() => void payrollResource.reload()} />
      ) : null}

      <SectionCard title="Run list" subtitle="Advance runs through calculate, approve, and mark-paid steps without leaving the module.">
        <DataTable
          columns={[
            {
              key: 'runCode',
              header: 'Run',
              render: (row) => (
                <div className="space-y-1">
                  <Link className="font-semibold text-primary" to={`/app/staff/payroll/${row.id}`}>{row.runCode}</Link>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{row.title}</p>
                </div>
              ),
            },
            { key: 'period', header: 'Period', render: (row) => `${formatDate(row.periodStart)} → ${formatDate(row.periodEnd)}` },
            { key: 'payout', header: 'Payout', render: (row) => formatDate(row.payoutDate) },
            { key: 'staffCount', header: 'Staff', render: (row) => row.totals.staffCount },
            { key: 'net', header: 'Net payable', render: (row) => formatMoney(row.totals.netPayable) },
            { key: 'status', header: 'Status', render: (row) => <StatusChip label={payrollStatusLabel(row.status)} tone={row.status === 'paid' ? 'success' : row.status === 'approved' ? 'info' : 'warning'} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-ghost px-3 py-2" to={`/app/staff/payroll/${row.id}`}>Open</Link>
                  <button type="button" className="btn-ghost px-3 py-2" onClick={() => void updateRunStatus(row, 'calculated')}>Calculate</button>
                  <button type="button" className="btn-ghost px-3 py-2 text-blue-700" onClick={() => void updateRunStatus(row, 'approved')}>Approve</button>
                  <button type="button" className="btn-ghost px-3 py-2 text-emerald-700" onClick={() => void updateRunStatus(row, 'paid')}>Mark paid</button>
                </div>
              ),
            },
          ]}
          rows={payrollResource.data}
          getRowKey={(row) => row.id}
          loading={payrollResource.loading}
          emptyTitle="No payroll runs"
          emptyDescription="Create a payroll run to review staff payouts, overtime, and deductions."
        />
      </SectionCard>

      <PayrollRunDialog
        isOpen={dialogOpen}
        saving={saving}
        serverError={formError}
        onClose={() => {
          setDialogOpen(false);
          setFormError('');
        }}
        onSubmit={async (values) => {
          setSaving(true);
          setFormError('');

          try {
            await payrollService.createPayrollRun(values);
            setDialogOpen(false);
            setNotice({ tone: 'success', message: 'Payroll run created successfully.' });
            await payrollResource.reload();
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to create payroll run.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
