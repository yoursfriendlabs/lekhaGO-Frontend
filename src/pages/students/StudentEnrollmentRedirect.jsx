import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import Notice from '@/components/ui/Notice';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';

/** A course-fee bill only knows its enrollment; find the student and open them. */
export default function StudentEnrollmentRedirect() {
  const { enrollmentId } = useParams();
  const { t } = useI18n();
  const { handleError } = useStudentsModule();
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getStudentEnrollment(enrollmentId)
      .then((payload) => {
        if (!active) return;
        const enrollment = payload?.enrollment || payload;
        const studentId = enrollment?.studentId || enrollment?.student?.id;
        if (studentId) setTarget(`/app/students/${studentId}`);
        else setError(t('students.detail.notFound'));
      })
      .catch((err) => {
        if (!active) return;
        const message = handleError(err, t('students.detail.notFound'));
        if (message) setError(message);
      });
    return () => {
      active = false;
    };
  }, [enrollmentId, handleError, t]);

  if (target) return <Navigate to={target} replace />;
  if (error) return <Notice tone="error" title={error} />;
  return <p className="py-16 text-center text-sm text-secondary-500">{t('common.loading')}</p>;
}
