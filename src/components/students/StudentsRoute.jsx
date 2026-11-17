import { Navigate } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { useStudentsModule } from './useStudentsModule';

/**
 * Guard for /app/students/*.
 * need="students"   → students: view (owner, supervisor)
 * need="attendance" → students: view or studentAttendance: view (also tutors)
 */
export default function StudentsRoute({ need = 'students', children }) {
  const { t } = useI18n();
  const { enabled, canViewStudents, canViewAttendance } = useStudentsModule();

  if (!enabled) return <Navigate to="/app" replace />;

  const allowed = need === 'attendance' ? canViewAttendance : canViewStudents;
  if (allowed) return children;

  if (canViewAttendance) return <Navigate to="/app/students/attendance" replace />;

  return (
    <Navigate
      to="/app"
      replace
      state={{
        notice: {
          title: t('appAccess.permissionRedirectTitle'),
          description: t('appAccess.permissionRedirectDescription', { feature: t('students.title') }),
          tone: 'warn',
        },
      }}
    />
  );
}
