import { useCallback, useMemo, useState } from 'react';
import { CalendarHeart, CheckCircle2, Clock3, Plus, XCircle } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { directoryService } from '../api/directoryService';
import { leaveService } from '../api/leaveService';
import { LeaveRequestDetail, LeaveRequestDialog } from '../components/StaffDialogs';
import { DataTable, DetailDrawer, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { LeaveRequest } from '../types/staff';
import { formatDate, formatDateTime, leaveStatusLabel } from '../utils/staffFormatters';

export default function LeavePage() {
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<LeaveRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const requestsLoader = useCallback(() => leaveService.listLeaveRequests(), []);
  const balancesLoader = useCallback(() => leaveService.listLeaveBalances(), []);
  const staffLoader = useCallback(() => directoryService.listStaffDirectory({
    search: '',
    status: 'active',
    department: '',
    designation: '',
    salaryType: 'all',
    page: 1,
    pageSize: 50,
  }), []);

  const requestsResource = useAsyncResource({
    loader: requestsLoader,
    initialData: [],
    deps: [requestsLoader],
  });
  const balancesResource = useAsyncResource({
    loader: balancesLoader,
    initialData: [],
    deps: [balancesLoader],
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

  const summary = useMemo(() => ({
    pending: requestsResource.data.filter((item) => item.status === 'pending').length,
    approved: requestsResource.data.filter((item) => item.status === 'approved').length,
    rejected: requestsResource.data.filter((item) => item.status === 'rejected').length,
  }), [requestsResource.data]);

  const staffOptions = useMemo(
    () => staffResource.data.records.items.map((item) => ({ id: item.id, label: item.fullName })),
    [staffResource.data.records.items],
  );

  const handleStatusChange = async (requestId: string, status: LeaveRequest['status']) => {
    try {
      await leaveService.updateLeaveRequestStatus(requestId, status);
      setNotice({
        tone: 'success',
        message: status === 'approved' ? 'Leave request approved.' : 'Leave request rejected.',
      });
      setDetail((current) => (
        current && current.id === requestId
          ? {
              ...current,
              status,
              approverName: status === 'approved' ? 'Current Manager' : current.approverName,
            }
          : current
      ));
      await requestsResource.reload();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to update leave request.' });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave requests"
        subtitle="Track balances, open pending decisions quickly, and keep request details in a focused side drawer."
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
            Create request
          </button>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={requestsResource.source} message="Leave requests are currently fixture-backed while the leave API contract is being completed." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryMetricCard label="Pending" value={summary.pending} hint="Needs manager review" icon={<Clock3 size={18} />} />
        <SummaryMetricCard label="Approved" value={summary.approved} hint="Confirmed leave plans" icon={<CheckCircle2 size={18} />} />
        <SummaryMetricCard label="Rejected" value={summary.rejected} hint="Closed without approval" icon={<XCircle size={18} />} />
      </div>

      <SectionCard title="Leave balances" subtitle="Quick view of the currently available leave pool by type.">
        <div className="grid gap-4 md:grid-cols-4">
          {balancesResource.data.map((balance) => (
            <SummaryMetricCard
              key={balance.leaveType}
              label={balance.leaveType}
              value={balance.remaining}
              hint={`${balance.used} used of ${balance.total}`}
              icon={<CalendarHeart size={18} />}
            />
          ))}
        </div>
      </SectionCard>

      {requestsResource.error ? (
        <ErrorBanner title="Could not load leave requests." description={requestsResource.error} onRetry={() => void requestsResource.reload()} />
      ) : null}

      <SectionCard title="Request list" subtitle="Open a request for details, then approve or reject from the list or drawer.">
        <DataTable
          columns={[
            {
              key: 'staff',
              header: 'Staff',
              render: (row) => (
                <button type="button" className="text-left" onClick={() => setDetail(row)}>
                  <p className="font-semibold text-slate-900 hover:text-primary dark:text-white">{row.staffName}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{row.department}</p>
                </button>
              ),
            },
            { key: 'leaveType', header: 'Leave type', render: (row) => row.leaveType },
            { key: 'period', header: 'Period', render: (row) => `${formatDate(row.startDate)} → ${formatDate(row.endDate)}` },
            { key: 'days', header: 'Days', render: (row) => row.days },
            { key: 'requestedAt', header: 'Requested', render: (row) => formatDateTime(row.requestedAt) },
            { key: 'status', header: 'Status', render: (row) => <StatusChip label={leaveStatusLabel(row.status)} tone={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'} /> },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost px-3 py-2" onClick={() => setDetail(row)}>Details</button>
                  <button type="button" className="btn-ghost px-3 py-2 text-emerald-700" onClick={() => void handleStatusChange(row.id, 'approved')}>Approve</button>
                  <button type="button" className="btn-ghost px-3 py-2 text-rose-700" onClick={() => void handleStatusChange(row.id, 'rejected')}>Reject</button>
                </div>
              ),
            },
          ]}
          rows={requestsResource.data}
          getRowKey={(row) => row.id}
          loading={requestsResource.loading}
          emptyTitle="No leave requests"
          emptyDescription="Submit the first leave request to start the approval flow."
        />
      </SectionCard>

      <LeaveRequestDialog
        isOpen={dialogOpen}
        saving={saving}
        serverError={formError}
        staffOptions={staffOptions}
        onClose={() => {
          setDialogOpen(false);
          setFormError('');
        }}
        onSubmit={async (values) => {
          setSaving(true);
          setFormError('');

          try {
            await leaveService.createLeaveRequest(values);
            setDialogOpen(false);
            setNotice({ tone: 'success', message: 'Leave request created successfully.' });
            await requestsResource.reload();
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to create leave request.');
          } finally {
            setSaving(false);
          }
        }}
      />

      <DetailDrawer isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.staffName || 'Leave request'}>
        {detail ? (
          <div className="space-y-5">
            <LeaveRequestDetail request={detail} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => void handleStatusChange(detail.id, 'approved')}>
                Approve request
              </button>
              <button type="button" className="btn-ghost text-rose-700" onClick={() => void handleStatusChange(detail.id, 'rejected')}>
                Reject request
              </button>
            </div>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
