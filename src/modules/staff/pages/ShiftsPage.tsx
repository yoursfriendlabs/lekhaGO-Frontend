import { useCallback, useMemo, useState } from 'react';
import { Clock3, MoonStar, Plus, SunMedium } from 'lucide-react';
import Notice from '../../../components/Notice';
import PageHeader from '../../../components/PageHeader.jsx';
import { shiftsService } from '../api/shiftsService';
import { ShiftTemplateDialog } from '../components/StaffDialogs';
import { DataTable, ErrorBanner, SectionCard, SourceBanner, StatusChip, SummaryMetricCard } from '../components/StaffPrimitives';
import { useAsyncResource } from '../hooks/useAsyncResource';
import type { ShiftTemplate } from '../types/staff';

export default function ShiftsPage() {
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warn' | 'info'; message: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loader = useCallback(() => shiftsService.listShiftTemplates(), []);
  const shiftResource = useAsyncResource({
    loader,
    initialData: [],
    deps: [loader],
  });

  const summary = useMemo(() => {
    const total = shiftResource.data.length;
    const active = shiftResource.data.filter((item) => item.isActive).length;
    const crossMidnight = shiftResource.data.filter((item) => item.crossMidnight).length;

    return { total, active, crossMidnight };
  }, [shiftResource.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift templates"
        subtitle="Standardize working windows, grace rules, and overtime policy mapping before assigning staff."
        action={(
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setEditingShift(null);
              setFormError('');
              setDialogOpen(true);
            }}
          >
            <Plus size={16} className="mr-2" />
            New shift template
          </button>
        )}
      />

      {notice ? <Notice title={notice.message} tone={notice.tone} /> : null}
      <SourceBanner source={shiftResource.source} message="Shift templates are using local fixtures because the shift endpoint is not fully available yet." />

      <div className="grid gap-4 lg:grid-cols-3">
        <SummaryMetricCard label="Templates" value={summary.total} hint="Configured shift definitions" icon={<Clock3 size={18} />} />
        <SummaryMetricCard label="Active" value={summary.active} hint="Available for assignment" icon={<SunMedium size={18} />} />
        <SummaryMetricCard label="Cross midnight" value={summary.crossMidnight} hint="Night or overnight shifts" icon={<MoonStar size={18} />} />
      </div>

      {shiftResource.error ? (
        <ErrorBanner title="Could not load shift templates." description={shiftResource.error} onRetry={() => void shiftResource.reload()} />
      ) : null}

      <SectionCard title="Template library" subtitle="Use reusable shift codes so the roster, attendance, and overtime modules stay aligned.">
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Shift',
              render: (row) => (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                    <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{row.shiftCode}</p>
                </div>
              ),
            },
            { key: 'time', header: 'Time', render: (row) => `${row.startTime} → ${row.endTime}` },
            { key: 'break', header: 'Break', render: (row) => `${row.breakMinutes} min` },
            { key: 'grace', header: 'Grace', render: (row) => `${row.graceMinutes} min` },
            { key: 'threshold', header: 'OT threshold', render: (row) => `${row.overtimeThresholdMinutes} min` },
            { key: 'multiplier', header: 'OT multiplier', render: (row) => `${row.overtimeMultiplier}x` },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <StatusChip label={row.isActive ? 'Active' : 'Inactive'} tone={row.isActive ? 'success' : 'neutral'} />
                  {row.crossMidnight ? <StatusChip label="Cross midnight" tone="info" /> : null}
                </div>
              ),
            },
            {
              key: 'days',
              header: 'Working days',
              render: (row) => row.workingDays.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', '),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2"
                    onClick={() => {
                      setEditingShift(row);
                      setFormError('');
                      setDialogOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-2 text-rose-700"
                    onClick={async () => {
                      const confirmed = window.confirm(`Delete ${row.name}?`);
                      if (!confirmed) return;

                      try {
                        await shiftsService.deleteShiftTemplate(row.id);
                        setNotice({ tone: 'success', message: 'Shift template deleted successfully.' });
                        await shiftResource.reload();
                      } catch (error) {
                        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Unable to delete shift template.' });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          rows={shiftResource.data}
          getRowKey={(row) => row.id}
          loading={shiftResource.loading}
          emptyTitle="No shift templates"
          emptyDescription="Create the first shift template to power roster assignments and attendance expectations."
        />
      </SectionCard>

      <ShiftTemplateDialog
        isOpen={dialogOpen}
        saving={saving}
        serverError={formError}
        initialValues={editingShift}
        onClose={() => {
          setDialogOpen(false);
          setEditingShift(null);
          setFormError('');
        }}
        onSubmit={async (values) => {
          setSaving(true);
          setFormError('');

          try {
            if (editingShift) {
              await shiftsService.updateShiftTemplate(editingShift.id, values);
              setNotice({ tone: 'success', message: 'Shift template updated successfully.' });
            } else {
              await shiftsService.createShiftTemplate(values);
              setNotice({ tone: 'success', message: 'Shift template created successfully.' });
            }

            setDialogOpen(false);
            setEditingShift(null);
            await shiftResource.reload();
          } catch (error) {
            setFormError(error instanceof Error ? error.message : 'Unable to save shift template.');
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}
