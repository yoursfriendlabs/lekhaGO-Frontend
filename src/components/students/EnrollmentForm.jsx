import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { ENROLLMENT_STATUSES, enrollmentPayload, validateEnrollment } from '@/lib/students';
import Notice from '@/components/ui/Notice';
import EnrollmentFields, { emptyEnrollment, ShiftPicker } from './EnrollmentFields';
import { Field, FormActions, StudentDialog } from './StudentUi';

export default function EnrollmentForm({ studentId, enrollment, courses, shifts, onClose, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => enrollment ? {
    status: enrollment.status, startDate: enrollment.startDate, endDate: enrollment.endDate || '',
    notes: enrollment.notes || '', shiftIds: (enrollment.shifts || []).filter((shift) => shifts.some((item) => item.id === shift.id && item.isActive !== false)).map((shift) => shift.id),
  } : emptyEnrollment());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const invalid = enrollment ? (form.endDate && form.endDate < enrollment.startDate ? 'students.validation.endDate' : '') : validateEnrollment(form);
    if (invalid) { setError(t(invalid)); return; }
    setBusy(true); setError('');
    try {
      const result = enrollment
        ? await api.updateEnrollment(enrollment.id, { status: form.status, endDate: form.endDate || null, shiftIds: form.shiftIds, notes: form.notes })
        : await api.createEnrollment({ ...enrollmentPayload(form), studentId });
      onSaved(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <StudentDialog title={t(enrollment ? 'students.enrollment.edit' : 'students.enrollment.add')} onClose={onClose} busy={busy}>
    <form className="space-y-5" onSubmit={save}>
      {error && <div role="alert"><Notice title={error} tone="error" /></div>}
      <fieldset disabled={busy} className="space-y-4">
        {enrollment ? <>
          <Notice title={enrollment.course?.name} description={t('students.enrollment.fixedFee')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.status')}><select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>{ENROLLMENT_STATUSES.map((status) => <option key={status} value={status}>{t('students.status.' + status)}</option>)}</select></Field>
            <Field label={t('students.enrollment.endDate')}><input className="input" type="date" min={enrollment.startDate} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} /></Field>
          </div>
          <ShiftPicker shifts={shifts.filter((shift) => shift.isActive !== false)} value={form.shiftIds} onChange={(value) => update('shiftIds', value)} />
          {enrollment.shifts?.some((shift) => !shifts.some((item) => item.id === shift.id && item.isActive !== false)) && <Notice tone="warn" title={t('students.shifts.inactiveRemoved')} />}
          <Field label={t('students.enrollment.notes')}><textarea className="input" rows={2} maxLength={2000} value={form.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
        </> : <EnrollmentFields form={form} setForm={setForm} courses={courses.filter((course) => course.isActive !== false)} shifts={shifts} />}
      </fieldset>
      <FormActions busy={busy} onClose={onClose} />
    </form>
  </StudentDialog>;
}
