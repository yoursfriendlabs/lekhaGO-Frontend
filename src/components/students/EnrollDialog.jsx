import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import EnrollmentFields, {
  buildEnrollmentPayload,
  emptyEnrollmentForm,
  validateEnrollment,
} from './EnrollmentFields.jsx';
import { useStudentLookups } from './useStudentLookups';
import { useStudentsModule } from './useStudentsModule';

/** Enroll an existing student in a course (POST /api/students/enrollments). */
export default function EnrollDialog({ isOpen, student, onClose, onSaved }) {
  const { t } = useI18n();
  const { handleError } = useStudentsModule();
  const lookups = useStudentLookups();
  const [form, setForm] = useState(emptyEnrollmentForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(emptyEnrollmentForm());
    setError('');
  }, [isOpen]);

  const activeCourseIds = (student?.enrollments || [])
    .filter((enrollment) => enrollment.status === 'active')
    .map((enrollment) => enrollment.courseId || enrollment.course?.id)
    .filter(Boolean);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const message = validateEnrollment(form, t);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await api.createStudentEnrollment({ studentId: student.id, ...buildEnrollmentPayload(form) });
      onSaved?.(saved);
    } catch (err) {
      const text = handleError(err);
      if (text) setError(text);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={t('students.enroll.title')}
      size="lg"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button type="submit" form="enroll-form" className="btn-primary" disabled={saving || !lookups.courses.length}>
            {saving ? t('common.saving') : t('students.enroll.submit')}
          </button>
        </div>
      )}
    >
      <form id="enroll-form" className="space-y-4" onSubmit={submit}>
        {student?.name ? <p className="text-sm font-semibold text-ink">{student.name}</p> : null}
        {error ? <Notice tone="error" title={error} /> : null}
        {lookups.loading ? (
          <p className="py-6 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : (
          <EnrollmentFields
            value={form}
            onChange={setForm}
            courses={lookups.courses}
            shifts={lookups.shifts}
            activeCourseIds={activeCourseIds}
            disabled={saving}
          />
        )}
      </form>
    </Dialog>
  );
}
