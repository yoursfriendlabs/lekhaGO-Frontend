import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BriefcaseBusiness, CircleDollarSign, FileDown, Plus, UserCheck2, Users } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n.jsx';
import { directoryService } from '../api/directoryService';
import { rosterService } from '../api/rosterService';
import { shiftsService } from '../api/shiftsService';
import { ShiftAssignmentDialog, StaffRecordDialog } from '../components/StaffDialogs';
import { DataTable, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { ShiftTemplate, StaffDirectoryFilters, StaffRecord } from '../types/staff';
import { salaryTypeLabel, formatDate, formatMoney } from '../utils/staffFormatters';
import { downloadCsv } from '../utils/exporters';

const INITIAL_FILTERS: StaffDirectoryFilters = {
  search: '',
  status: 'all',
  department: '',
  designation: '',
  salaryType: 'all',
  page: 1,
  pageSize: 8,
};

export default function DirectoryPage() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<StaffDirectoryFilters>(INITIAL_FILTERS);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'info' | 'warn'; message: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [staffDialogOpen, setStaffDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StaffRecord | null>(null);
  const [assignmentDefaults, setAssignmentDefaults] = useState<string[]>([]);
  const [staffSaving, setStaffSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [staffFormError, setStaffFormError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');

  const directoryLoader = useCallback(() => directoryService.listStaffDirectory(filters), [filters]);
  const linkedAccountsLoader = useCallback(() => directoryService.listLinkedAccounts(), []);
  const shiftLoader = useCallback(() => shiftsService.listShiftTemplates(), []);

  const directoryResource = useAsyncResource({
    loader: directoryLoader,
    initialData: {
      records: { items: [], total: 0, limit: filters.pageSize, offset: 0 },
      summary: {
        totalStaff: 0,
        activeStaff: 0,
        salaryCommitment: 0,
        outstandingAdvanceBalance: 0,
      },
    },
    deps: [directoryLoader],
  });

  const linkedAccountsResource = useAsyncResource({
    loader: linkedAccountsLoader,
    initialData: [],
    deps: [linkedAccountsLoader],
  });

  const shiftsResource = useAsyncResource({
    loader: shiftLoader,
    initialData: [],
    deps: [shiftLoader],
  });

  const departments = useMemo(
    () => [...new Set(directoryResource.data.records.items.map((item) => item.department).filter(Boolean))],
    [directoryResource.data.records.items],
  );
  const designations = useMemo(
    () => [...new Set(directoryResource.data.records.items.map((item) => item.designation).filter(Boolean))],
    [directoryResource.data.records.items],
  );

  const allSelected = directoryResource.data.records.items.length > 0
    && directoryResource.data.records.items.every((item) => selectedIds.includes(item.id));

  const shiftOptions = useMemo(
    () => shiftsResource.data.map((item: ShiftTemplate) => ({ id: item.id, label: `${item.shiftCode} · ${item.name}` })),
    [shiftsResource.data],
  );

  const tableColumns = useMemo(() => [
    {
      key: 'select',
      header: 'Select',
      className: 'w-14',
      render: (row: StaffRecord) => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          checked={selectedIds.includes(row.id)}
          onChange={() =>
            setSelectedIds((current) =>
              current.includes(row.id)
                ? current.filter((item) => item !== row.id)
                : [...current, row.id],
            )
          }
          aria-label={`Select ${row.fullName}`}
        />
      ),
    },
    {
      key: 'staff',
      header: 'Staff member',
      render: (row: StaffRecord) => (
        <div className="space-y-1">
          <button
            type="button"
            className="text-left font-semibold text-slate-900 transition hover:text-primary dark:text-white"
            onClick={() => navigate(`/app/staff/profile/${row.id}`)}
          >
            {row.fullName}
          </button>
          <div className="flex flex-wrap gap-2">
            <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'success' : 'neutral'} />
            <StatusChip label={row.staffCode} tone="info" />
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Department and role',
      render: (row: StaffRecord) => (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-900 dark:text-white">{row.designation}</p>
          <p className="text-slate-500 dark:text-slate-400">{row.department}</p>
          <p className="text-slate-500 dark:text-slate-400">Joined {formatDate(row.joinedOn)}</p>
        </div>
      ),
    },
    {
      key: 'salary',
      header: 'Salary setup',
      render: (row: StaffRecord) => (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-900 dark:text-white">{formatMoney(row.salaryAmount)}</p>
          <p className="text-slate-500 dark:text-slate-400">{salaryTypeLabel(row.salaryType)}</p>
        </div>
      ),
    },
    {
      key: 'finance',
      header: 'Finance summary',
      render: (row: StaffRecord) => (
        <div className="space-y-1 text-sm">
          <p>Salary paid: <span className="font-medium text-slate-900 dark:text-white">{formatMoney(row.financeSummary.totalSalaryPaid)}</span></p>
          <p>Advance due: <span className="font-medium text-slate-900 dark:text-white">{formatMoney(row.financeSummary.outstandingAdvanceBalance)}</span></p>
        </div>
      ),
    },
    {
      key: 'access',
      header: 'Linked account',
      render: (row: StaffRecord) => (
        row.linkedAccount ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-slate-900 dark:text-white">{row.linkedAccount.name}</p>
            <p className="text-slate-500 dark:text-slate-400">{row.linkedAccount.email}</p>
          </div>
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">HR only</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'w-56',
      render: (row: StaffRecord) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost px-3 py-2" onClick={() => navigate(`/app/staff/profile/${row.id}`)}>
            View
          </button>
          <button
            type="button"
            className="btn-secondary px-3 py-2"
            onClick={() => {
              setEditingRecord(row);
              setStaffFormError('');
              setStaffDialogOpen(true);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-2"
            onClick={() => {
              setAssignmentDefaults([row.id]);
              setAssignmentError('');
              setAssignmentDialogOpen(true);
            }}
          >
            Assign shift
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-2 text-amber-700 hover:bg-amber-50"
            onClick={async () => {
              const confirmed = window.confirm(
                row.isActive ? `Deactivate ${row.fullName}?` : `Reactivate ${row.fullName}?`,
              );
              if (!confirmed) return;

              try {
                await directoryService.deactivateStaffRecord(row.id, !row.isActive);
                setNotice({
                  tone: 'success',
                  message: row.isActive ? 'Staff record deactivated.' : 'Staff record reactivated.',
                });
                void directoryResource.reload();
              } catch (error) {
                setNotice({
                  tone: 'error',
                  message: error instanceof Error ? error.message : 'Status update failed.',
                });
              }
            }}
          >
            {row.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ),
    },
  ], [directoryResource, navigate, selectedIds]);

  const currentPageStart = directoryResource.data.records.offset + 1;
  const currentPageEnd = directoryResource.data.records.offset + directoryResource.data.records.items.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffManagement.directoryHeading')}
        subtitle="Run staff operations from one workspace with live payroll context, assignment controls, and mock-safe fallbacks for unfinished APIs."
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              className="btn-secondary justify-center"
              onClick={() => {
                setEditingRecord(null);
                setStaffFormError('');
                setStaffDialogOpen(true);
              }}
            >
              <Plus size={16} className="mr-2" />
              Add staff
            </button>
            <Link className="btn-ghost justify-center" to="/app/settings?tab=staff">
              Manage access
            </Link>
          </div>
        )}
      />

      {!businessId ? (
        <Notice
          title={t('staffManagement.businessRequired')}
          description="Live requests need a business context. Mock fallback still keeps the UI usable while new endpoints are being finished."
          tone="warn"
        />
      ) : null}

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}

      <SourceBanner
        source={directoryResource.source}
        message="Directory data is coming from local fixtures because the target endpoint returned an unavailable response."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <SummaryMetricCard label="Total staff" value={directoryResource.data.summary.totalStaff} hint="Filtered roster size" icon={<Users size={18} />} />
        <SummaryMetricCard label="Active staff" value={directoryResource.data.summary.activeStaff} hint="Currently active records" icon={<UserCheck2 size={18} />} />
        <SummaryMetricCard label="Salary commitment" value={formatMoney(directoryResource.data.summary.salaryCommitment)} hint="Current filtered payroll load" icon={<CircleDollarSign size={18} />} />
        <SummaryMetricCard label="Advance balance" value={formatMoney(directoryResource.data.summary.outstandingAdvanceBalance)} hint="Outstanding staff advances" icon={<BriefcaseBusiness size={18} />} />
      </div>

      <SectionCard title="Filters" subtitle="Search by staff identity or narrow by employment setup.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <label className="block">
            <span className="label">Search</span>
            <input
              className="input mt-1"
              value={filters.search}
              placeholder="Name, staff code, phone, department"
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value, page: 1 }))}
            />
          </label>
          <label className="block">
            <span className="label">Status</span>
            <select className="input mt-1" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as StaffDirectoryFilters['status'], page: 1 }))}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Department</span>
            <select className="input mt-1" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value, page: 1 }))}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Designation</span>
            <select className="input mt-1" value={filters.designation} onChange={(event) => setFilters((current) => ({ ...current, designation: event.target.value, page: 1 }))}>
              <option value="">All designations</option>
              {designations.map((designation) => (
                <option key={designation} value={designation}>{designation}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Salary type</span>
            <select className="input mt-1" value={filters.salaryType} onChange={(event) => setFilters((current) => ({ ...current, salaryType: event.target.value as StaffDirectoryFilters['salaryType'], page: 1 }))}>
              <option value="all">All salary types</option>
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="hourly">Hourly</option>
              <option value="commission">Commission</option>
              <option value="contract">Contract</option>
            </select>
          </label>
        </div>
      </SectionCard>

      {directoryResource.error ? (
        <ErrorBanner
          title="Could not load the staff directory."
          description={directoryResource.error}
          onRetry={() => void directoryResource.reload()}
        />
      ) : null}

      <SectionCard
        title="Staff directory"
        subtitle={`Showing ${directoryResource.loading ? '...' : `${currentPageStart}-${currentPageEnd}`} of ${directoryResource.data.records.total} staff records.`}
        action={(
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                downloadCsv(
                  'staff-directory.csv',
                  ['Staff Code', 'Full Name', 'Department', 'Designation', 'Salary Type', 'Salary Amount', 'Advance Balance', 'Active'],
                  directoryResource.data.records.items.map((record) => [
                    record.staffCode,
                    record.fullName,
                    record.department,
                    record.designation,
                    record.salaryType,
                    record.salaryAmount,
                    record.financeSummary.outstandingAdvanceBalance,
                    record.isActive ? 'Yes' : 'No',
                  ]),
                )
              }
            >
              <FileDown size={16} className="mr-2" />
              Export
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={selectedIds.length === 0}
              onClick={() => {
                setAssignmentDefaults(selectedIds);
                setAssignmentError('');
                setAssignmentDialogOpen(true);
              }}
            >
              Assign shift ({selectedIds.length})
            </button>
          </div>
        )}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              checked={allSelected}
              onChange={() =>
                setSelectedIds(
                  allSelected ? [] : directoryResource.data.records.items.map((item) => item.id),
                )
              }
            />
            Select current page
          </label>
          <div className="flex items-center gap-3">
            <span>{selectedIds.length} selected</span>
            <label className="inline-flex items-center gap-2">
              Rows
              <select
                className="input-compact"
                value={filters.pageSize}
                onChange={(event) => setFilters((current) => ({ ...current, page: 1, pageSize: Number(event.target.value) }))}
              >
                {[8, 12, 16].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <DataTable
          columns={tableColumns}
          rows={directoryResource.data.records.items}
          getRowKey={(row) => row.id}
          loading={directoryResource.loading}
          emptyTitle="No staff records found"
          emptyDescription="Adjust the filters or add the first staff profile to start building the roster."
        />

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-200/70 pt-4 text-sm text-slate-500 dark:border-slate-800/70 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>Page {filters.page} of {Math.max(Math.ceil(directoryResource.data.records.total / filters.pageSize), 1)}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-ghost px-3 py-2"
              disabled={filters.page === 1}
              onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-ghost px-3 py-2"
              disabled={currentPageEnd >= directoryResource.data.records.total}
              onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </SectionCard>

      <StaffRecordDialog
        isOpen={staffDialogOpen}
        title={editingRecord ? 'Edit staff profile' : 'Create staff profile'}
        saving={staffSaving}
        serverError={staffFormError}
        linkedAccounts={linkedAccountsResource.data}
        initialValues={editingRecord}
        onClose={() => {
          setStaffDialogOpen(false);
          setEditingRecord(null);
          setStaffFormError('');
        }}
        onSubmit={async (values) => {
          setStaffSaving(true);
          setStaffFormError('');

          try {
            if (editingRecord) {
              await directoryService.updateStaffRecord(editingRecord.id, values);
              setNotice({ tone: 'success', message: 'Staff profile updated successfully.' });
            } else {
              await directoryService.createStaffRecord(values);
              setNotice({ tone: 'success', message: 'Staff profile created successfully.' });
            }

            setStaffDialogOpen(false);
            setEditingRecord(null);
            setSelectedIds([]);
            await directoryResource.reload();
          } catch (error) {
            setStaffFormError(error instanceof Error ? error.message : 'Unable to save staff profile.');
          } finally {
            setStaffSaving(false);
          }
        }}
      />

      <ShiftAssignmentDialog
        isOpen={assignmentDialogOpen}
        saving={assignmentSaving}
        serverError={assignmentError}
        initialStaffIds={assignmentDefaults}
        staffOptions={directoryResource.data.records.items.map((item) => ({
          id: item.id,
          label: item.fullName,
          detail: `${item.department} · ${item.designation}`,
        }))}
        shiftOptions={shiftOptions}
        onClose={() => {
          setAssignmentDialogOpen(false);
          setAssignmentDefaults([]);
          setAssignmentError('');
        }}
        onSubmit={async (values) => {
          setAssignmentSaving(true);
          setAssignmentError('');

          try {
            await rosterService.createShiftAssignments(values);
            setNotice({ tone: 'success', message: 'Shift assignment saved successfully.' });
            setAssignmentDialogOpen(false);
            setAssignmentDefaults([]);
          } catch (error) {
            setAssignmentError(error instanceof Error ? error.message : 'Unable to assign shifts.');
          } finally {
            setAssignmentSaving(false);
          }
        }}
      />
    </div>
  );
}
