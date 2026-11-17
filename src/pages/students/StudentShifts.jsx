import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, History, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog.tsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { asList, shiftDaysLabel, shiftTimeLabel, shortTime, WEEK_DAYS } from '@/lib/students/utils';

const EMPTY_SHIFT = {
  name: '',
  startTime: '',
  endTime: '',
  days: [],
  tutorMembershipId: '',
  isActive: true,
};

function shiftToForm(shift) {
  return {
    name: shift.name || '',
    startTime: shortTime(shift.startTime),
    endTime: shortTime(shift.endTime),
    days: Array.isArray(shift.days) ? shift.days : [],
    tutorMembershipId: String(shift.tutor?.membershipId || shift.tutorMembershipId || ''),
    isActive: shift.isActive !== false,
  };
}

export default function StudentShifts() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const { canManageStudents, canViewStudents, handleError } = useStudentsModule();

  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staff, setStaff] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [inactiveOffer, setInactiveOffer] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      // Tutors see only their own shifts by default.
      const payload = await api.listStudentShifts({ ...(canViewStudents ? {} : { mine: true }), limit: 200 }, { force: true });
      setShifts(asList(payload));
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId, canViewStudents, handleError]);

  useEffect(() => {
    load();
  }, [load]);

  const loadStaff = async () => {
    if (staff) return;
    try {
      const payload = await api.listStaff();
      setStaff((payload?.members || []).filter((member) => member.membershipId));
    } catch {
      setStaff([]);
    }
  };

  const openDialog = (shift = null) => {
    setFormError('');
    setDialog({ id: shift?.id || null, form: shift ? shiftToForm(shift) : { ...EMPTY_SHIFT }, tutor: shift?.tutor || null });
    loadStaff();
  };

  const updateForm = (patch) => setDialog((current) => ({ ...current, form: { ...current.form, ...patch } }));

  const toggleDay = (day) => {
    const days = new Set(dialog.form.days);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    updateForm({ days: WEEK_DAYS.filter((item) => days.has(item)) });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!dialog || saving) return;
    const { form, id } = dialog;
    if (!form.name.trim()) {
      setFormError(t('students.shifts.nameRequired'));
      return;
    }
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      setFormError(t('students.shifts.timeOrder'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const body = {
        name: form.name.trim(),
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        days: form.days,
        tutorMembershipId: form.tutorMembershipId || null,
        isActive: Boolean(form.isActive),
      };
      if (id) await api.updateStudentShift(id, body);
      else await api.createStudentShift(body);
      showSuccess(t('students.shifts.saved'));
      setDialog(null);
      load();
    } catch (err) {
      const message = handleError(err);
      if (message) setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await api.deleteStudentShift(deleteTarget.id);
      showSuccess(t('students.shifts.deleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      if (err?.status === 409) {
        setInactiveOffer(deleteTarget);
        setDeleteTarget(null);
      } else {
        const message = handleError(err);
        if (message) showError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const markInactive = async () => {
    if (!inactiveOffer || busy) return;
    setBusy(true);
    try {
      await api.updateStudentShift(inactiveOffer.id, { isActive: false });
      showSuccess(t('students.shifts.saved'));
      setInactiveOffer(null);
      load();
    } catch (err) {
      const message = handleError(err);
      if (message) showError(message);
    } finally {
      setBusy(false);
    }
  };

  // Keep the current tutor in the list even if the staff list could not load.
  const tutorOptions = [...(staff || [])];
  if (dialog?.tutor?.membershipId && !tutorOptions.some((m) => String(m.membershipId) === String(dialog.tutor.membershipId))) {
    tutorOptions.unshift({ membershipId: dialog.tutor.membershipId, user: { name: dialog.tutor.name } });
  }

  return (
    <div>
      <PageHeader
        title={t('students.shifts.title')}
        subtitle={t('students.shifts.subtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
            {canManageStudents ? (
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => openDialog()}>
                <Plus size={16} />
                {t('students.shifts.add')}
              </button>
            ) : null}
          </div>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        {error ? <Notice tone="error" title={error} /> : null}
        {loading && shifts.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : shifts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.shifts.empty')}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shifts.map((shift) => (
              <article key={shift.id} className="flex flex-col rounded-2xl border border-secondary-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink">{shift.name}</h3>
                    <p className="text-sm tabular-nums text-secondary-600">{shiftTimeLabel(shift) || '—'}</p>
                  </div>
                  {shift.isActive === false ? <Badge size="sm" variant="inactive">{t('students.status.inactive')}</Badge> : null}
                </div>
                <p className="mt-2 text-xs text-secondary-500">{shiftDaysLabel(shift, t)}</p>
                <p className="mt-1 text-xs text-secondary-500">
                  {t('students.shifts.tutor')}: {shift.tutor?.name || t('students.shifts.noTutor')}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-3">
                  <Link to={`/app/students/attendance?shiftId=${shift.id}`} className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <CalendarCheck size={14} />
                    {t('students.shifts.roster')}
                  </Link>
                  <Link to={`/app/students/attendance/history?shiftId=${shift.id}`} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs">
                    <History size={14} />
                    {t('students.shifts.history')}
                  </Link>
                  {canManageStudents ? (
                    <>
                      <button type="button" className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100" title={t('students.shifts.edit')} onClick={() => openDialog(shift)}>
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" title={t('common.delete')} onClick={() => setDeleteTarget(shift)}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Dialog
        isOpen={Boolean(dialog)}
        onClose={saving ? () => {} : () => setDialog(null)}
        title={dialog?.id ? t('students.shifts.edit') : t('students.shifts.add')}
        size="md"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)} disabled={saving}>{t('common.cancel')}</button>
            <button type="submit" form="shift-form" className="btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        )}
      >
        {dialog ? (
          <form id="shift-form" className="space-y-4" onSubmit={save}>
            {formError ? <Notice tone="error" title={formError} /> : null}
            <div>
              <label className="label" htmlFor="shift-name">{t('students.shifts.name')}</label>
              <input id="shift-name" className="input" maxLength={255} value={dialog.form.name} onChange={(event) => updateForm({ name: event.target.value })} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="shift-start">{t('students.shifts.startTime')}</label>
                <input id="shift-start" type="time" className="input" value={dialog.form.startTime} onChange={(event) => updateForm({ startTime: event.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="shift-end">{t('students.shifts.endTime')}</label>
                <input id="shift-end" type="time" className="input" value={dialog.form.endTime} onChange={(event) => updateForm({ endTime: event.target.value })} />
              </div>
            </div>
            <div>
              <p className="label">{t('students.shifts.days')}</p>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((day) => {
                  const on = dialog.form.days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={on}
                      className={`h-10 w-12 rounded-xl border text-sm font-semibold transition ${
                        on ? 'border-primary bg-primary text-white' : 'border-secondary-200 text-secondary-600 hover:bg-primary/10'
                      }`}
                      onClick={() => toggleDay(day)}
                    >
                      {t(`students.days.${day}`)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-secondary-500">{t('students.shifts.daysHint')}</p>
            </div>
            <div>
              <label className="label" htmlFor="shift-tutor">{t('students.shifts.tutor')}</label>
              <select id="shift-tutor" className="input" value={dialog.form.tutorMembershipId} onChange={(event) => updateForm({ tutorMembershipId: event.target.value })}>
                <option value="">{t('students.shifts.noTutor')}</option>
                {tutorOptions.map((member) => (
                  <option key={member.membershipId} value={member.membershipId}>
                    {member.user?.name || member.name || member.membershipId}
                    {member.jobTitle ? ` · ${member.jobTitle}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-secondary-700">
              <input type="checkbox" checked={dialog.form.isActive} onChange={(event) => updateForm({ isActive: event.target.checked })} />
              {t('students.shifts.isActive')}
            </label>
          </form>
        ) : null}
      </Dialog>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        confirming={busy}
        title={t('students.shifts.deleteTitle')}
        description={t('students.shifts.deleteDescription')}
      />
      <ConfirmDialog
        isOpen={Boolean(inactiveOffer)}
        onClose={() => setInactiveOffer(null)}
        onConfirm={markInactive}
        confirming={busy}
        variant="primary"
        title={t('students.shifts.markInactive')}
        description={t('students.shifts.deleteBlocked')}
        confirmLabel={t('students.shifts.markInactive')}
      />
    </div>
  );
}
