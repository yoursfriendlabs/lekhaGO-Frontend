import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import {
  ATTENDANCE_TONES,
  asList,
  attendanceRateLabel,
  displayDate,
  displayDateTime,
  toNumber,
} from '@/lib/students/utils';

function personName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.name || value.user?.name || '';
}

export default function StudentAttendanceHistory() {
  const { t } = useI18n();
  const { canViewStudents, handleError } = useStudentsModule();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentId = searchParams.get('studentId') || '';
  const enrollmentId = searchParams.get('enrollmentId') || '';
  const shiftId = searchParams.get('shiftId') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const hasTarget = Boolean(studentId || enrollmentId || shiftId);
  const rangeInvalid = Boolean(from && to && from > to);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setParam = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
  };

  const load = useCallback(async () => {
    if (!hasTarget || rangeInvalid) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.listStudentAttendance({
        studentId: studentId || undefined,
        enrollmentId: enrollmentId || undefined,
        shiftId: shiftId || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setData(payload);
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId, from, handleError, hasTarget, rangeInvalid, shiftId, studentId, to]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(
    () => [...asList(data)].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [data],
  );
  const summary = data?.summary || {};
  const showStudent = !studentId && !enrollmentId;

  const backLink = studentId && canViewStudents
    ? `/app/students/${studentId}`
    : shiftId
      ? `/app/students/attendance?shiftId=${shiftId}`
      : '/app/students';

  return (
    <div>
      <Link to={backLink} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-600 hover:text-primary">
        <ArrowLeft size={16} />
        {t('common.back')}
      </Link>
      <PageHeader
        title={t('students.history.title')}
        subtitle={t('students.history.rateHint')}
        action={(
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading || !hasTarget}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        {!hasTarget ? <Notice tone="info" title={t('students.history.needTarget')} /> : null}

        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <div>
            <label className="label" htmlFor="history-from">{t('students.history.from')}</label>
            <input id="history-from" type="date" className="input" value={from} onChange={(event) => setParam({ from: event.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="history-to">{t('students.history.to')}</label>
            <input id="history-to" type="date" className="input" value={to} onChange={(event) => setParam({ to: event.target.value })} />
          </div>
        </div>
        {rangeInvalid ? <Notice tone="error" title={t('students.history.rangeInvalid')} /> : null}
        {error ? <Notice tone="error" title={error} /> : null}

        {data ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              ['present', toNumber(summary.present), 'text-emerald-700 dark:text-emerald-300'],
              ['absent', toNumber(summary.absent), 'text-rose-600'],
              ['late', toNumber(summary.late), 'text-amber-700 dark:text-amber-300'],
              ['excused', toNumber(summary.excused), 'text-sky-700 dark:text-sky-300'],
              ['rate', attendanceRateLabel(summary.attendanceRate), 'text-ink'],
            ].map(([key, value, tone]) => (
              <div key={key} className="rounded-xl border border-secondary-200 px-2 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-secondary-400">{t(`students.attendance.${key}`)}</p>
                <p className={`text-base font-semibold tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {loading && !data ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : data && items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.history.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-secondary-100">
            {items.map((item, index) => {
              const markedBy = personName(item.markedBy);
              const studentName = item.name || item.student?.name || item.enrollment?.student?.name;
              return (
                <li key={item.id || `${item.date}-${item.enrollmentId}-${index}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{displayDate(item.date)}</p>
                    <p className="text-xs text-secondary-500">
                      {[showStudent ? studentName : null, item.shift?.name || item.shiftName].filter(Boolean).join(' · ')}
                    </p>
                    {item.note ? <p className="mt-1 text-xs text-secondary-600">{item.note}</p> : null}
                    {markedBy ? (
                      <p className="text-[11px] text-secondary-400">
                        {t('students.attendance.markedBy', { name: markedBy, time: displayDateTime(item.markedAt) })}
                      </p>
                    ) : null}
                  </div>
                  {item.status ? (
                    <span className={`rounded-xl border px-3 py-1 text-xs font-semibold ${ATTENDANCE_TONES[item.status] || ''}`}>
                      {t(`students.attendance.${item.status}`)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
