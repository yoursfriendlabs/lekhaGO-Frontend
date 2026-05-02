import { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays, CalendarRange, AlertTriangle, Plus } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { directoryService } from '../api/directoryService';
import { rosterService } from '../api/rosterService';
import { shiftsService } from '../api/shiftsService';
import { ShiftAssignmentDialog } from '../components/StaffDialogs';
import { ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { StaffDirectoryFilters, ShiftTemplate } from '../types/staff';

const DIRECTORY_FILTERS: StaffDirectoryFilters = {
  search: '',
  status: 'active',
  department: '',
  designation: '',
  salaryType: 'all',
  page: 1,
  pageSize: 50,
};

export default function RosterPage() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [focusDate, setFocusDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const rosterLoader = useCallback(() => rosterService.getRosterSnapshot(focusDate, viewMode), [focusDate, viewMode]);
  const shiftsLoader = useCallback(() => shiftsService.listShiftTemplates(), []);
  const staffLoader = useCallback(() => directoryService.listStaffDirectory(DIRECTORY_FILTERS), []);

  const rosterResource = useAsyncResource({
    loader: rosterLoader,
    initialData: {
      viewMode,
      focusDate,
      days: [],
      rows: [],
      conflicts: [],
    },
    deps: [rosterLoader],
  });

  const shiftsResource = useAsyncResource({
    loader: shiftsLoader,
    initialData: [],
    deps: [shiftsLoader],
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

  const shiftOptions = useMemo(
    () => shiftsResource.data.map((item: ShiftTemplate) => ({ id: item.id, label: `${item.shiftCode} · ${item.name}` })),
    [shiftsResource.data],
  );

  const lastDay = rosterResource.data.days[rosterResource.data.days.length - 1];
  const dateLabel = viewMode === 'week'
    ? `${dayjs(rosterResource.data.days[0]?.date).format('MMM D')} - ${dayjs(lastDay?.date).format('MMM D, YYYY')}`
    : dayjs(focusDate).format('MMMM YYYY');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift assignment and roster"
        subtitle="Plan week and month coverage, surface conflicts early, and bulk-assign staff to reusable shifts."
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
            Bulk assign shift
          </button>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={rosterResource.source} message="Roster data is running from a fixture-backed engine until the dedicated roster endpoint is ready." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryMetricCard label="Rostered staff" value={rosterResource.data.rows.length} hint="Visible in the current view" icon={<CalendarDays size={18} />} />
        <SummaryMetricCard label="Calendar span" value={rosterResource.data.days.length} hint={viewMode === 'week' ? 'Days in week view' : 'Days in month grid'} icon={<CalendarRange size={18} />} />
        <SummaryMetricCard label="Conflicts" value={rosterResource.data.conflicts.length} hint="Overlaps and weekly-off clashes" icon={<AlertTriangle size={18} />} />
      </div>

      {rosterResource.error ? (
        <ErrorBanner title="Could not load the roster." description={rosterResource.error} onRetry={() => void rosterResource.reload()} />
      ) : null}

      {rosterResource.data.conflicts.length > 0 ? (
        <SectionCard title="Conflicts" subtitle="Resolve these overlaps before finalizing the schedule.">
          <div className="space-y-3">
            {rosterResource.data.conflicts.map((conflict, index) => (
              <div key={`${conflict}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                {conflict}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={viewMode === 'week' ? 'Weekly roster' : 'Monthly roster'}
        subtitle={dateLabel}
        action={(
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={viewMode === 'week' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setViewMode('week')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={viewMode === 'month' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setViewMode('month')}
            >
              Monthly
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setFocusDate(dayjs(focusDate).subtract(1, viewMode).format('YYYY-MM-DD'))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setFocusDate(dayjs(focusDate).add(1, viewMode).format('YYYY-MM-DD'))}
            >
              Next
            </button>
          </div>
        )}
      >
        <div className="overflow-x-auto rounded-3xl border border-slate-200/70 dark:border-slate-800/70">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm dark:divide-slate-800/70">
            <thead className="bg-slate-50/90 text-left text-xs uppercase tracking-[0.16em] text-slate-400 dark:bg-slate-900/70">
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50/90 px-4 py-3 dark:bg-slate-900/70">Staff</th>
                {rosterResource.data.days.map((day) => (
                  <th
                    key={day.date}
                    className={`min-w-[118px] px-3 py-3 ${day.weekend ? 'text-amber-700 dark:text-amber-200' : ''}`}
                  >
                    <div>{day.label}</div>
                    <div className="mt-1 text-[10px] normal-case tracking-normal text-slate-400">{dayjs(day.date).format('ddd')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 bg-white/90 dark:divide-slate-800/70 dark:bg-slate-950/50">
              {rosterResource.loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={rosterResource.data.days.length + 1} className="px-4 py-4">
                      <div className="h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
                    </td>
                  </tr>
                ))
              ) : (
                rosterResource.data.rows.map((row) => (
                  <tr key={row.staffId} className="align-top">
                    <td className="sticky left-0 z-10 min-w-[220px] bg-white/95 px-4 py-4 dark:bg-slate-950/95">
                      <p className="font-semibold text-slate-900 dark:text-white">{row.staffName}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{row.department} · {row.designation}</p>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={`${row.staffId}-${cell.date}`} className="px-3 py-3">
                        <div
                          className={`rounded-2xl border px-3 py-3 ${
                            cell.isWeekOff
                              ? 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300'
                              : cell.hasConflict
                                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100'
                                : 'border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {cell.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cell.color }} /> : null}
                            <p className="font-medium">{cell.shiftName || 'Unassigned'}</p>
                          </div>
                          {cell.shiftTime ? <p className="mt-2 text-xs text-current/80">{cell.shiftTime}</p> : null}
                          {cell.hasConflict ? <p className="mt-2 text-xs font-semibold">Conflict</p> : null}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ShiftAssignmentDialog
        isOpen={dialogOpen}
        saving={saving}
        serverError={formError}
        staffOptions={staffResource.data.records.items.map((item) => ({
          id: item.id,
          label: item.fullName,
          detail: `${item.department} · ${item.designation}`,
        }))}
        shiftOptions={shiftOptions}
        onClose={() => {
          setDialogOpen(false);
          setFormError('');
        }}
        onSubmit={async (values) => {
          setSaving(true);
          setFormError('');

          try {
            await rosterService.createShiftAssignments(values);
            setNotice({ tone: 'success', message: 'Shift assignment saved successfully.' });
            setDialogOpen(false);
            await rosterResource.reload();
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to save roster assignment.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
