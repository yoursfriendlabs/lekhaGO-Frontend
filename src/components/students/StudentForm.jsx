import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { todayISODate } from '@/lib/dates/datetime';
import { enrollmentPayload, validateEnrollment } from '@/lib/students';
import Notice from '@/components/ui/Notice';
import EnrollmentFields, { emptyEnrollment } from './EnrollmentFields';
import { Field, FormActions, StudentDialog } from './StudentUi';

export default function StudentForm({ student, courses = [], shifts = [], onClose, onSaved }) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    name: student?.name || '', phone: student?.phone || '', email: student?.email || '',
    address: student?.address || '', studentCode: student?.studentCode || '',
    guardianName: student?.guardianName || '', guardianPhone: student?.guardianPhone || '',
    dateOfBirth: student?.dateOfBirth || '', joinedAt: student?.joinedAt || todayISODate(),
    status: student?.status || 'active', notes: student?.notes || '',
  }));
  const [enroll, setEnroll] = useState(false);
  const [enrollment, setEnrollment] = useState(emptyEnrollment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.name.trim()) { setError(t('students.validation.name')); return; }
    const invalid = enroll ? validateEnrollment(enrollment) : '';
    if (invalid) { setError(t(invalid)); return; }
    setError(''); setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), dateOfBirth: form.dateOfBirth || null, joinedAt: form.joinedAt || null };
      if (enroll && !student) body.enrollment = enrollmentPayload(enrollment);
      const result = student ? await api.updateStudent(student.id, body) : await api.createStudent(body);
      onSaved(result);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <StudentDialog title={t(student ? 'students.editStudent' : 'students.register')} onClose={onClose} busy={busy}>
    <form onSubmit={save} className="space-y-5">
      {error && <div role="alert"><Notice tone="error" title={error} /></div>}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <Field label={t('students.fields.name')}><input className="input" required maxLength={255} value={form.name} onChange={(event) => update('name', event.target.value)} /></Field>
        <Field label={t('students.fields.studentCode')}><input className="input" maxLength={50} value={form.studentCode} onChange={(event) => update('studentCode', event.target.value)} /></Field>
        <Field label={t('students.fields.phone')}><input className="input" type="tel" maxLength={50} value={form.phone} onChange={(event) => update('phone', event.target.value)} /></Field>
        <Field label={t('students.fields.email')}><input className="input" type="email" maxLength={255} value={form.email} onChange={(event) => update('email', event.target.value)} /></Field>
        <Field label={t('students.fields.dateOfBirth')}><input className="input" type="date" max={todayISODate()} value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} /></Field>
        <Field label={t('students.fields.joinedAt')}><input className="input" type="date" value={form.joinedAt} onChange={(event) => update('joinedAt', event.target.value)} /></Field>
        <Field label={t('students.fields.guardianName')}><input className="input" maxLength={255} value={form.guardianName} onChange={(event) => update('guardianName', event.target.value)} /></Field>
        <Field label={t('students.fields.guardianPhone')}><input className="input" type="tel" maxLength={50} value={form.guardianPhone} onChange={(event) => update('guardianPhone', event.target.value)} /></Field>
        <Field label={t('students.fields.address')} className="sm:col-span-2"><input className="input" maxLength={255} value={form.address} onChange={(event) => update('address', event.target.value)} /></Field>
        {student && <Field label={t('common.status')}>
          <select className="input" value={form.status} onChange={(event) => update('status', event.target.value)}>
            {['active', 'inactive'].map((status) => <option key={status} value={status}>{t('students.status.' + status)}</option>)}
          </select>
        </Field>}
        <Field label={t('common.notes')} className="sm:col-span-2"><textarea className="input" rows={2} maxLength={2000} value={form.notes} onChange={(event) => update('notes', event.target.value)} /></Field>
      </fieldset>
      {!student && <fieldset disabled={busy} className="space-y-4 border-t border-secondary-200 pt-4">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
          <input type="checkbox" className="rounded" disabled={!courses.some((course) => course.isActive !== false)} checked={enroll} onChange={(event) => setEnroll(event.target.checked)} />
          {t('students.enrollment.enrollNow')}
        </label>
        {!courses.some((course) => course.isActive !== false) && <p className="text-xs text-secondary-500">{t('students.courses.setupFirst')}</p>}
        {enroll && <EnrollmentFields form={enrollment} setForm={setEnrollment} courses={courses.filter((course) => course.isActive !== false)} shifts={shifts} />}
      </fieldset>}
      <FormActions busy={busy} onClose={onClose} label={t(student ? 'common.save' : 'students.register')} />
    </form>
  </StudentDialog>;
}
