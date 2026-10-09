import { useCallback, useState } from 'react';
import { BookOpen, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { DURATION_UNITS, WEEKDAYS, describeShift } from '@/lib/students';
import { Badge } from '@/components/ui/Badge';
import Notice from '@/components/ui/Notice';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Field, FormActions, ResourceState, StudentDialog, useStudentFormat, useStudentResource } from '@/components/students/StudentUi';

export default function StudentSetup() {
  const { t } = useI18n();
  const money = useStudentFormat();
  const { canViewFeature } = useAuth();
  const canViewStaff = canViewFeature('staff');
  const [dialog, setDialog] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const load = useCallback(async () => {
    const [courses, shifts, staff] = await Promise.all([
      api.listStudentCourses({}, { force: true }), api.listStudentShifts({}, { force: true }),
      canViewStaff ? api.listStaff() : Promise.resolve({ members: [] }),
    ]);
    return { courses: courses.items || [], shifts: shifts.items || [], staff: staff.members || [] };
  }, [canViewStaff]);
  const resource = useStudentResource(load);
  const data = resource.data;
  const remove = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      if (removing.type === 'course') await api.deleteStudentCourse(removing.record.id);
      else await api.deleteStudentShift(removing.record.id);
      setRemoving(null); setNotice({ tone: 'success', title: t('students.setup.deleted') }); resource.reload();
    } catch (err) { setRemoving(null); setNotice({ tone: 'error', title: err.message }); } finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <Notice title={t('students.setup.title')} description={t('students.setup.hint')} />
    {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'}><Notice {...notice} /></div>}
    <ResourceState resource={resource}>
      <div className="grid gap-5 xl:grid-cols-2">
        {['course', 'shift'].map((type) => {
          const records = (type === 'course' ? data?.courses : data?.shifts) || [];
          const Icon = type === 'course' ? BookOpen : Clock;
          return <section key={type} className="card min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="inline-flex items-center gap-2 text-base font-semibold text-ink"><Icon size={18} aria-hidden="true" />{t(type === 'course' ? 'students.courses.title' : 'students.shifts.title')}</h3><button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => setDialog({ type })}><Plus size={16} aria-hidden="true" />{t('students.setup.add.' + type)}</button></div>
            {!records.length && <p className="py-8 text-center text-sm text-secondary-500">{t('students.setup.empty.' + type)}</p>}
            <div className="divide-y divide-secondary-100">
              {records.map((record) => <article key={record.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="min-w-0 break-words font-semibold text-ink">{record.name}</h4><Badge variant={record.isActive === false ? 'inactive' : 'active'}>{t(record.isActive === false ? 'students.status.inactive' : 'students.status.active')}</Badge></div>
                <p className="text-sm text-secondary-500">{type === 'course' ? t('students.courses.durationLabel', { value: record.durationValue, unit: t('students.durationUnits.' + record.durationUnit) }) + ' · ' + money(record.fee) : describeShift(record, t)}</p>
                {type === 'course' && record.description && <p className="text-sm text-secondary-600">{record.description}</p>}
                {type === 'shift' && record.tutor?.name && <p className="text-xs text-secondary-500">{t('students.shifts.tutor') + ': ' + record.tutor.name}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-2" aria-label={t('students.setup.editLabel', { name: record.name })} onClick={() => setDialog({ type, record })}><Pencil size={15} aria-hidden="true" />{t('common.edit')}</button>
                  <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-2 text-rose-600" aria-label={t('students.setup.deleteLabel', { name: record.name })} onClick={() => setRemoving({ type, record })}><Trash2 size={15} aria-hidden="true" />{t('common.delete')}</button>
                </div>
              </article>)}
            </div>
          </section>;
        })}
      </div>
    </ResourceState>
    {dialog && <SetupForm type={dialog.type} record={dialog.record} staff={data?.staff || []} canAssignTutor={canViewStaff} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); setNotice({ tone: 'success', title: t('students.saved') }); resource.reload(); }} />}
    <ConfirmDialog isOpen={!!removing} onClose={() => setRemoving(null)} confirming={busy} onConfirm={remove} title={t('students.setup.deleteTitle', { name: removing?.record.name || '' })} description={t('students.setup.deleteHint')} />
  </div>;
}

function SetupForm({ type, record, staff, canAssignTutor, onClose, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => type === 'course' ? {
    name: record?.name || '', code: record?.code || '', description: record?.description || '',
    durationValue: record?.durationValue ?? 1, durationUnit: record?.durationUnit || 'month',
    fee: record?.fee ?? 0, isActive: record?.isActive !== false,
  } : {
    name: record?.name || '', startTime: record?.startTime || '', endTime: record?.endTime || '',
    days: record?.days || [], tutorMembershipId: record?.tutorMembershipId || '', isActive: record?.isActive !== false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim()) { setError(t('students.validation.name')); return; }
    setBusy(true); setError('');
    try {
      const body = type === 'course' ? { ...form, name: form.name.trim(), fee: Number(form.fee), durationValue: Number(form.durationValue) } : { ...form, name: form.name.trim(), startTime: form.startTime || null, endTime: form.endTime || null, tutorMembershipId: form.tutorMembershipId || null };
      if (type === 'course') {
        if (record) await api.updateStudentCourse(record.id, body); else await api.createStudentCourse(body);
      } else {
        if (record) await api.updateStudentShift(record.id, body); else await api.createStudentShift(body);
      }
      onSaved();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const title = t('students.setup.' + (record ? 'edit' : 'add') + '.' + type);
  return <StudentDialog title={title} onClose={onClose} busy={busy}>
    <form className="space-y-5" onSubmit={save}>
      {error && <div role="alert"><Notice title={error} tone="error" /></div>}
      <fieldset className="space-y-4" disabled={busy}>
        <Field label={t('students.fields.name')}><input className="input" required maxLength={255} value={form.name} onChange={(event) => update('name', event.target.value)} /></Field>
        {type === 'course' ? <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('students.courses.duration')}><input className="input" type="number" min="1" step="1" required value={form.durationValue} onChange={(event) => update('durationValue', event.target.value)} /></Field>
            <Field label={t('students.courses.unit')}><select className="input" value={form.durationUnit} onChange={(event) => update('durationUnit', event.target.value)}>{DURATION_UNITS.map((unit) => <option key={unit} value={unit}>{t('students.durationUnits.' + unit)}</option>)}</select></Field>
            <Field label={t('students.enrollment.fee')}><input className="input" type="number" min="0" step="0.01" required value={form.fee} onChange={(event) => update('fee', event.target.value)} /></Field>
            <Field label={t('students.courses.code')}><input className="input" maxLength={50} value={form.code} onChange={(event) => update('code', event.target.value)} /></Field>
          </div>
          <Field label={t('students.courses.description')}><textarea className="input" rows={3} maxLength={2000} value={form.description} onChange={(event) => update('description', event.target.value)} /></Field>
          {record && <Notice title={t('students.enrollment.fixedFee')} description={t('students.courses.changeHint')} />}
        </> : <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('students.shifts.startTime')}><input className="input" type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} /></Field>
            <Field label={t('students.shifts.endTime')}><input className="input" type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} /></Field>
          </div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium text-secondary-700">{t('students.shifts.days')}</legend><p className="text-xs text-secondary-500">{t('students.shifts.daysHint')}</p>
            <div className="flex flex-wrap gap-2">{WEEKDAYS.map((day) => <label key={day} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-secondary-200 px-3 text-sm"><input type="checkbox" className="rounded" checked={form.days.includes(day)} onChange={(event) => update('days', event.target.checked ? [...form.days, day] : form.days.filter((item) => item !== day))} />{t('students.weekdays.' + day)}</label>)}</div>
          </fieldset>
          {canAssignTutor && <Field label={t('students.shifts.tutor')} hint={t('students.shifts.tutorHint')}><select className="input" value={form.tutorMembershipId} onChange={(event) => update('tutorMembershipId', event.target.value)}><option value="">{t('students.shifts.unassigned')}</option>{staff.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.user?.name || member.name || member.membershipId}</option>)}</select></Field>}
        </>}
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-secondary-700"><input type="checkbox" className="rounded" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} />{t('students.status.active')}</label>
      </fieldset>
      <FormActions busy={busy} onClose={onClose} />
    </form>
  </StudentDialog>;
}
