import { NavLink } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { useStudentsModule } from './useStudentsModule';

const TABS = [
  { key: 'students', to: '/app/students', end: true, need: 'students' },
  { key: 'attendance', to: '/app/students/attendance', need: 'attendance' },
  { key: 'dues', to: '/app/students/dues', need: 'students' },
  { key: 'enrollments', to: '/app/students/enrollments', need: 'students' },
  { key: 'courses', to: '/app/students/courses', need: 'students' },
  { key: 'shifts', to: '/app/students/shifts', need: 'attendance' },
];

/** Sub navigation shared by every students screen. */
export default function StudentsTabs() {
  const { t } = useI18n();
  const { canViewStudents, canViewAttendance } = useStudentsModule();
  const visible = TABS.filter((tab) => (tab.need === 'attendance' ? canViewAttendance : canViewStudents));

  if (visible.length < 2) return null;

  return (
    <nav className="no-scrollbar -mx-1 mb-5 flex gap-1 overflow-x-auto px-1" aria-label={t('students.title')}>
      {visible.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `shrink-0 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
            isActive
              ? 'bg-primary text-white shadow-sm'
              : 'text-secondary-600 hover:bg-primary/10'
          }`}
        >
          {t(`students.tabs.${tab.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
