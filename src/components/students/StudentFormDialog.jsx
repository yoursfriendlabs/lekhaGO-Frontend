import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice';
import FileUpload from '@/components/form/FileUpload.jsx';
import PartyFilterSelect from '@/components/parties/PartyFilterSelect.jsx';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { asList, compact, todayISO } from '@/lib/students/utils';
import EnrollmentFields, {
  buildEnrollmentPayload,
  emptyEnrollmentForm,
  validateEnrollment,
} from './EnrollmentFields.jsx';
import { useStudentLookups } from './useStudentLookups';
import { useStudentsModule } from './useStudentsModule';

function formFromStudent(student) {
  return {
    source: 'new',
    partyId: '',
    partyOption: null,
    name: student?.name || '',
    phone: student?.phone || '',
    email: student?.email || '',
    address: student?.address || '',
    avatarUrl: student?.avatarUrl || '',
    studentCode: student?.studentCode || '',
    guardianName: student?.guardianName || '',
    guardianPhone: student?.guardianPhone || '',
    dateOfBirth: student?.dateOfBirth ? String(student.dateOfBirth).slice(0, 10) : '',
    joinedAt: student?.joinedAt ? String(student.joinedAt).slice(0, 10) : todayISO(),
    notes: student?.notes || '',
    status: student?.status || 'active',
  };
}

function trimmed(value) {
  return String(value || '').trim();
}

/** Register a student (optionally enrolling them) or edit one. */
export default function StudentFormDialog({ isOpen, student = null, onClose, onSaved }) {
  const { t } = useI18n();
  const { handleError } = useStudentsModule();
  const isEdit = Boolean(student?.id);
  const [form, setForm] = useState(() => formFromStudent(student));
  const [enrollNow, setEnrollNow] = useState(false);
  const [enrollment, setEnrollment] = useState(emptyEnrollmentForm);
  const [codeWarning, setCodeWarning] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const lookups = useStudentLookups({ courses: !isEdit, shifts: !isEdit });

  useEffect(() => {
    if (!isOpen) return;
    setForm(formFromStudent(student));
    setEnrollNow(false);
    setEnrollment(emptyEnrollmentForm());
    setCodeWarning('');
    setError('');
  }, [isOpen, student]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const usingExisting = !isEdit && form.source === 'existing';

  const checkCode = async () => {
    const code = trimmed(form.studentCode);
    if (!code) {
      setCodeWarning('');
      return;
    }
    try {
      const payload = await api.listStudents({ search: code, limit: 10 });
      const clash = asList(payload).some(
        (item) => trimmed(item.studentCode).toLowerCase() === code.toLowerCase()
          && String(item.id) !== String(student?.id || ''),
      );
      setCodeWarning(clash ? t('students.form.duplicateCode') : '');
    } catch {
      setCodeWarning('');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setError('');

    if (usingExisting && !form.partyId) {
      setError(t('students.form.customerRequired'));
      return;
    }
    if (!usingExisting && !trimmed(form.name)) {
      setError(t('students.form.nameRequired'));
      return;
    }
    if (!isEdit && enrollNow) {
      const enrollError = validateEnrollment(enrollment, t);
      if (enrollError) {
        setError(enrollError);
        return;
      }
    }

    const studentFields = {
      studentCode: trimmed(form.studentCode),
      guardianName: trimmed(form.guardianName),
      guardianPhone: trimmed(form.guardianPhone),
      dateOfBirth: form.dateOfBirth,
      joinedAt: form.joinedAt,
      notes: trimmed(form.notes),
    };
    const partyFields = {
      name: trimmed(form.name),
      phone: trimmed(form.phone),
      email: trimmed(form.email),
      address: trimmed(form.address),
      avatarUrl: trimmed(form.avatarUrl),
    };

    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const body = { ...partyFields, ...studentFields, status: form.status };
        // A cleared birth date is sent as null; an empty date string is not a valid date.
        body.dateOfBirth = form.dateOfBirth || null;
        if (!body.joinedAt) delete body.joinedAt;
        saved = await api.updateStudent(student.id, body);
      } else {
        const body = compact({
          ...(usingExisting ? { partyId: form.partyId } : partyFields),
          ...studentFields,
        });
        if (enrollNow) body.enrollment = buildEnrollmentPayload(enrollment);
        saved = await api.createStudent(body);
      }
      onSaved?.(saved?.student || saved);
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </button>
      <button type="submit" form="student-form" className="btn-primary" disabled={saving}>
        {saving ? t('common.saving') : isEdit ? t('students.form.save') : t('students.form.register')}
      </button>
    </div>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? t('students.form.editTitle') : t('students.form.registerTitle')}
      size="lg"
      footer={footer}
    >
      <form id="student-form" className="space-y-5" onSubmit={submit}>
        {error ? <Notice tone="error" title={error} /> : null}

        {!isEdit ? (
          <div>
            <p className="label">{t('students.form.existingOrNew')}</p>
            <div className="inline-flex rounded-xl border border-secondary-200 p-1">
              {['new', 'existing'].map((source) => (
                <button
                  key={source}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    form.source === source ? 'bg-primary text-white' : 'text-secondary-600 hover:bg-primary/10'
                  }`}
                  onClick={() => update({ source })}
                >
                  {source === 'new' ? t('students.form.newPerson') : t('students.form.existingCustomer')}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {usingExisting ? (
          <div>
            <label className="label">{t('students.form.pickCustomer')}</label>
            <PartyFilterSelect
              type="customer"
              value={form.partyId}
              selectedOption={form.partyOption}
              placeholder={t('students.form.pickCustomer')}
              onChange={(option) => update({ partyId: option?.value || '', partyOption: option || null })}
            />
            <p className="mt-1 text-xs text-secondary-500">{t('students.form.pickCustomerHint')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="student-name">{t('students.form.name')}</label>
                <input
                  id="student-name"
                  className="input"
                  maxLength={255}
                  value={form.name}
                  onChange={(event) => update({ name: event.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="student-phone">{t('students.form.phone')}</label>
                <input
                  id="student-phone"
                  className="input"
                  type="tel"
                  maxLength={255}
                  value={form.phone}
                  onChange={(event) => update({ phone: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="student-email">{t('students.form.email')}</label>
                <input
                  id="student-email"
                  className="input"
                  type="email"
                  maxLength={255}
                  value={form.email}
                  onChange={(event) => update({ email: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="student-address">{t('students.form.address')}</label>
                <input
                  id="student-address"
                  className="input"
                  maxLength={255}
                  value={form.address}
                  onChange={(event) => update({ address: event.target.value })}
                />
              </div>
            </div>
            <FileUpload
              key={student?.id || 'new'}
              label={t('students.form.photo')}
              initialUrl={form.avatarUrl}
              onUpload={(url) => update({ avatarUrl: url || '' })}
            />
            {isEdit ? <p className="text-xs text-secondary-500">{t('students.form.sharedFieldsHint')}</p> : null}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="student-code">{t('students.form.studentCode')}</label>
            <input
              id="student-code"
              className="input"
              maxLength={50}
              value={form.studentCode}
              onChange={(event) => update({ studentCode: event.target.value })}
              onBlur={checkCode}
            />
            <p className={`mt-1 text-xs ${codeWarning ? 'text-amber-700' : 'text-secondary-500'}`}>
              {codeWarning || t('students.form.studentCodeHint')}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="student-joined">{t('students.form.joinedAt')}</label>
            <input
              id="student-joined"
              type="date"
              className="input"
              value={form.joinedAt}
              onChange={(event) => update({ joinedAt: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="student-guardian">{t('students.form.guardianName')}</label>
            <input
              id="student-guardian"
              className="input"
              maxLength={255}
              value={form.guardianName}
              onChange={(event) => update({ guardianName: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="student-guardian-phone">{t('students.form.guardianPhone')}</label>
            <input
              id="student-guardian-phone"
              className="input"
              type="tel"
              maxLength={255}
              value={form.guardianPhone}
              onChange={(event) => update({ guardianPhone: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="student-dob">{t('students.form.dateOfBirth')}</label>
            <input
              id="student-dob"
              type="date"
              className="input"
              value={form.dateOfBirth}
              onChange={(event) => update({ dateOfBirth: event.target.value })}
            />
          </div>
          {isEdit ? (
            <div>
              <label className="label" htmlFor="student-status">{t('students.form.status')}</label>
              <select
                id="student-status"
                className="input"
                value={form.status}
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="active">{t('students.status.active')}</option>
                <option value="inactive">{t('students.status.inactive')}</option>
              </select>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="student-notes">{t('students.form.notes')}</label>
            <textarea
              id="student-notes"
              rows={2}
              maxLength={2000}
              className="input"
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
            />
          </div>
        </div>

        {!isEdit ? (
          <div className="rounded-2xl border border-secondary-200 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={enrollNow}
                onChange={(event) => setEnrollNow(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold text-ink">{t('students.form.enrollNow')}</span>
                <span className="block text-xs text-secondary-500">{t('students.form.enrollNowHint')}</span>
              </span>
            </label>
            {enrollNow ? (
              <div className="mt-4">
                <EnrollmentFields
                  value={enrollment}
                  onChange={setEnrollment}
                  courses={lookups.courses}
                  shifts={lookups.shifts}
                  disabled={saving}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
