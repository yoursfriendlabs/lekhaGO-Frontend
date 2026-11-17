import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import Avatar from '@/components/ui/Avatar';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useEnrollmentActions } from '@/components/students/useEnrollmentActions.jsx';
import { useStudentLookups } from '@/components/students/useStudentLookups';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { asList, displayDate, toNumber } from '@/lib/students/utils';

/** Everyone who still owes course fees, oldest enrollment first. */
export default function StudentDues() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { canManageStudents, handleError } = useStudentsModule();
  const lookups = useStudentLookups({ includeInactive: true });
  const [courseId, setCourseId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.getStudentDues({
        courseId: courseId || undefined,
        shiftId: shiftId || undefined,
      }, { force: true });
      setData(payload);
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId, courseId, handleError, shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useEnrollmentActions({ onChanged: load });
  const items = useMemo(() => asList(data), [data]);
  const totalDue = data?.totalDue ?? items.reduce((sum, item) => sum + toNumber(item.fees?.due ?? item.due), 0);

  return (
    <div>
      <PageHeader
        title={t('students.dues.title')}
        subtitle={t('students.dues.subtitle')}
        action={(
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 md:w-[480px]">
            <select className="input" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
              <option value="">{t('students.list.allCourses')}</option>
              {lookups.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select className="input" value={shiftId} onChange={(event) => setShiftId(event.target.value)}>
              <option value="">{t('students.list.allShifts')}</option>
              {lookups.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </select>
          </div>
          <div className="rounded-2xl border border-secondary-200 px-4 py-3 text-right">
            <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.dues.totalDue')}</p>
            <p className="text-xl font-semibold tabular-nums text-rose-600">{formatMoney(t, totalDue)}</p>
          </div>
        </div>

        {error ? <Notice tone="error" title={error} /> : null}

        {loading && !data ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.dues.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-secondary-100">
            {items.map((item) => {
              const student = item.student || {};
              const due = toNumber(item.fees?.due ?? item.due);
              const phone = student.phone || item.phone;
              return (
                <li key={item.id || item.enrollmentId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={student.avatarUrl} name={student.name || item.name} size="sm" fallbackClassName="bg-secondary-100 text-secondary-600" />
                    <div className="min-w-0">
                      <Link to={`/app/students/${item.studentId || student.id}`} className="block truncate font-semibold text-ink hover:text-primary">
                        {student.name || item.name}
                      </Link>
                      <p className="truncate text-xs text-secondary-500">
                        {[item.course?.name, `${t('students.dues.started')} ${displayDate(item.startDate)}`, phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="mr-2 font-semibold tabular-nums text-rose-600">{formatMoney(t, due)}</span>
                    {phone ? (
                      <a href={`tel:${phone}`} className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs">
                        <Phone size={14} />
                        {t('students.detail.call')}
                      </a>
                    ) : null}
                    {canManageStudents ? (
                      <button
                        type="button"
                        className="btn-primary px-3 py-1.5 text-xs"
                        onClick={() => actions.onCollect({ ...item, fees: { ...(item.fees || {}), due } })}
                      >
                        {t('students.enrollment.collectFee')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {actions.dialogs}
    </div>
  );
}
