import { useCallback, useState } from 'react';
import { ArrowLeft, BadgeDollarSign, Download, FileSpreadsheet, HandCoins, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { payrollService } from '../api/payrollService';
import { DataTable, EmptyState, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { PayrollItem, PayrollRun } from '../types/staff';
import { formatDate, formatMoney, paymentStatusLabel, payrollStatusLabel } from '../utils/staffFormatters';
import { downloadTextFile } from '../utils/exporters';

function buildPayslip(run: PayrollRun, item: PayrollItem) {
  return [
    `Payslip: ${item.staffName}`,
    `Payroll run: ${run.runCode}`,
    `Period: ${formatDate(run.periodStart)} - ${formatDate(run.periodEnd)}`,
    `Payout date: ${formatDate(run.payoutDate)}`,
    '',
    `Base salary: ${formatMoney(item.baseSalary)}`,
    `Overtime: ${formatMoney(item.overtime)}`,
    `Bonus: ${formatMoney(item.bonus)}`,
    `Deductions: ${formatMoney(item.deductions)}`,
    `Advance recovery: ${formatMoney(item.advanceRecovery)}`,
    `Net payable: ${formatMoney(item.netPayable)}`,
    `Payment status: ${paymentStatusLabel(item.paymentStatus)}`,
  ].join('\n');
}

export default function PayrollRunDetailPage() {
  const { runId = '' } = useParams();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);

  const loader = useCallback(() => payrollService.getPayrollRun(runId), [runId]);
  const payrollResource = useAsyncResource({
    loader,
    initialData: null as PayrollRun | null,
    deps: [loader],
  });

  const updateRun = async (nextRun: Partial<PayrollRun>, message: string) => {
    if (!payrollResource.data) return;

    try {
      await payrollService.updatePayrollRun(payrollResource.data.id, {
        ...payrollResource.data,
        ...nextRun,
      });
      setNotice({ tone: 'success', message });
      await payrollResource.reload();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update payroll run.' });
    }
  };

  if (payrollResource.error && !payrollResource.data) {
    return (
      <div className="space-y-6">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff/payroll">
          <ArrowLeft size={16} />
          Back to payroll runs
        </Link>
        <ErrorBanner title="Could not load payroll details." description={payrollResource.error} onRetry={() => void payrollResource.reload()} />
      </div>
    );
  }

  if (!payrollResource.data) {
    return (
      <div className="space-y-6">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff/payroll">
          <ArrowLeft size={16} />
          Back to payroll runs
        </Link>
        <SectionCard title="Loading payroll detail" subtitle="Preparing the run summary and staff payout lines.">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  const run = payrollResource.data;

  return (
    <div className="space-y-6">
      <Link className="btn-ghost inline-flex items-center gap-2" to="/app/staff/payroll">
        <ArrowLeft size={16} />
        Back to payroll runs
      </Link>

      <PageHeader
        title={run.runCode}
        subtitle={`${run.title} · ${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)}`}
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void updateRun({ status: 'calculated' }, 'Payroll run calculated.')}
            >
              Calculate
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => void updateRun({ status: 'approved' }, 'Payroll run approved.')}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void updateRun({
                status: 'paid',
                items: run.items.map((item) => ({ ...item, paymentStatus: 'paid' })),
              }, 'Payroll run marked as paid.')}
            >
              Mark paid
            </button>
          </div>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={payrollResource.source} message="Payroll detail is using fixtures if the detail endpoint is not available yet." />

      <div className="grid gap-4 lg:grid-cols-5">
        <SummaryMetricCard label="Status" value={payrollStatusLabel(run.status)} hint="Current approval state" icon={<ShieldCheck size={18} />} />
        <SummaryMetricCard label="Staff count" value={run.totals.staffCount} hint="Rows in this run" icon={<FileSpreadsheet size={18} />} />
        <SummaryMetricCard label="Gross amount" value={formatMoney(run.totals.grossAmount)} hint="Base plus overtime and bonus" icon={<BadgeDollarSign size={18} />} />
        <SummaryMetricCard label="Deductions" value={formatMoney(run.totals.totalDeductions)} hint="Deductions and recoveries" icon={<HandCoins size={18} />} />
        <SummaryMetricCard label="Net payable" value={formatMoney(run.totals.netPayable)} hint={`Payout date ${formatDate(run.payoutDate)}`} icon={<BadgeDollarSign size={18} />} />
      </div>

      <SectionCard title="Per-staff payout rows" subtitle="Server data should own the totals here so the numbers match final payroll output.">
        {run.items.length === 0 ? (
          <EmptyState title="No payroll items" description="Calculate the payroll run to populate staff rows and payout actions." />
        ) : (
          <DataTable
            columns={[
              {
                key: 'staff',
                header: 'Staff',
                render: (row) => (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{row.staffName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{row.designation}</p>
                  </div>
                ),
              },
              { key: 'base', header: 'Base salary', render: (row) => formatMoney(row.baseSalary) },
              { key: 'overtime', header: 'Overtime', render: (row) => formatMoney(row.overtime) },
              { key: 'bonus', header: 'Bonus', render: (row) => formatMoney(row.bonus) },
              { key: 'deductions', header: 'Deductions', render: (row) => formatMoney(row.deductions) },
              { key: 'advance', header: 'Advance recovery', render: (row) => formatMoney(row.advanceRecovery) },
              { key: 'net', header: 'Net payable', render: (row) => formatMoney(row.netPayable) },
              { key: 'paymentStatus', header: 'Payment', render: (row) => <StatusChip label={paymentStatusLabel(row.paymentStatus)} tone={row.paymentStatus === 'paid' ? 'success' : row.paymentStatus === 'processing' ? 'info' : 'warning'} /> },
              {
                key: 'actions',
                header: 'Actions',
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost px-3 py-2"
                      onClick={() => downloadTextFile(`${run.runCode}-${row.staffName.replace(/\s+/g, '-').toLowerCase()}-payslip.txt`, buildPayslip(run, row))}
                    >
                      <Download size={14} className="mr-2" />
                      Export payslip
                    </button>
                  </div>
                ),
              },
            ]}
            rows={run.items}
            getRowKey={(row) => row.id}
            loading={payrollResource.loading}
            emptyTitle="No payroll rows"
            emptyDescription="Calculate the run to populate payout lines."
          />
        )}
      </SectionCard>
    </div>
  );
}
