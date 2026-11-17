import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCheck, RefreshCw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import Pagination from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import { useEnrollmentActions } from '@/components/students/useEnrollmentActions.jsx';
import { useStudentLookups } from '@/components/students/useStudentLookups';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { displayDate, ENROLLMENT_STATUSES, errorText, STATUS_BADGE, toNumber } from '@/lib/students/utils';

/** Class lists by course or shift, and finishing a batch at once. */
export default function StudentEnrollments() {
  const { t } = useI18n();
  const { businessId } = useAuth();
  const { showError, showSuccess } = useSnackbar();
  const { canManageStudents, handleError } = useStudentsModule();
  const lookups = useStudentLookups({ includeInactive: true });
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    studentId: searchParams.get('studentId') || '',
    courseId: searchParams.get('courseId') || '',
    shiftId: searchParams.get('shiftId') || '',
    status: searchParams.get('status') || '',
    hasDue: searchParams.get('hasDue') === 'true',
  };
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const filterKey = searchParams.toString();

  const setFilter = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, String(value));
      else next.delete(key);
    });
    setSearchParams(next, { replace: true });
    setPage(1);
  };

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams(filterKey);
      const payload = await api.listStudentEnrollments({
        studentId: params.get('studentId') || undefined,
        courseId: params.get('courseId') || undefined,
        shiftId: params.get('shiftId') || undefined,
        status: params.get('status') || undefined,
        hasDue: params.get('hasDue') === 'true' ? true : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }, { force: true });
      setData({ items: Array.isArray(payload?.items) ? payload.items : [], total: toNumber(payload?.total) });
      setSelected(new Set());
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId, filterKey, handleError, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const actions = useEnrollmentActions({ onChanged: load });

  const activeOnPage = useMemo(() => data.items.filter((item) => item.status === 'active'), [data.items]);
  const allSelected = activeOnPage.length > 0 && activeOnPage.every((item) => selected.has(item.id));

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(activeOnPage.map((item) => item.id)));

  const completeSelected = async () => {
    if (bulkBusy || !selected.size) return;
    setBulkBusy(true);
    const ids = [...selected];
    const results = await Promise.allSettled(
      ids.map((id) => api.updateStudentEnrollment(id, { status: 'completed' })),
    );
    const failed = results.filter((result) => result.status === 'rejected');
    const done = results.length - failed.length;
    if (done) showSuccess(t('students.enrollments.completedCount', { count: done }));
    if (failed.length) {
      const message = handleError(failed[0].reason) || errorText(failed[0].reason);
      showError(t('students.enrollments.someFailed', { count: failed.length, message }));
    }
    setBulkBusy(false);
    setBulkOpen(false);
    load();
  };

  return (
    <div>
      <PageHeader
        title={t('students.enrollments.title')}
        subtitle={t('students.enrollments.subtitle')}
        action={(
          <button type="button" className="btn-secondary flex items-center gap-2" onClick={load} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <select className="input" value={filters.courseId} onChange={(event) => setFilter({ courseId: event.target.value })}>
            <option value="">{t('students.list.allCourses')}</option>
            {lookups.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
          </select>
          <select className="input" value={filters.shiftId} onChange={(event) => setFilter({ shiftId: event.target.value })}>
            <option value="">{t('students.list.allShifts')}</option>
            {lookups.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(event) => setFilter({ status: event.target.value })}>
            <option value="">{t('students.enrollments.allStatuses')}</option>
            {ENROLLMENT_STATUSES.map((status) => <option key={status} value={status}>{t(`students.status.${status}`)}</option>)}
          </select>
          <label className="flex min-h-[44px] items-center gap-2 whitespace-nowrap text-sm font-semibold text-secondary-700">
            <input type="checkbox" checked={filters.hasDue} onChange={(event) => setFilter({ hasDue: event.target.checked ? 'true' : '' })} />
            {t('students.enrollments.hasDue')}
          </label>
        </div>

        {filters.studentId ? (
          <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setFilter({ studentId: '' })}>
            {t('common.clear')} · {t('students.list.student')}
          </button>
        ) : null}

        {error ? <Notice tone="error" title={error} /> : null}

        {canManageStudents && activeOnPage.length ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <label className="flex items-center gap-2 font-semibold text-secondary-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {selected.size ? t('students.enrollments.selected', { count: selected.size }) : t('students.enrollments.selectAll')}
            </label>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 px-3 py-1.5 text-xs"
              disabled={!selected.size}
              onClick={() => setBulkOpen(true)}
            >
              <CheckCheck size={14} />
              {t('students.enrollments.completeSelected')}
            </button>
          </div>
        ) : null}

        {loading && data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : data.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-secondary-200 py-10 text-center text-sm text-secondary-500">
            {t('students.enrollments.empty')}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-secondary-100">
              {data.items.map((item) => {
                const due = toNumber(item.fees?.due);
                const isActive = item.status === 'active';
                return (
                  <li key={item.id} className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      {canManageStudents ? (
                        <input
                          type="checkbox"
                          className="mt-1.5"
                          disabled={!isActive}
                          checked={selected.has(item.id)}
                          onChange={() => toggle(item.id)}
                          aria-label={item.student?.name}
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/app/students/${item.studentId || item.student?.id}`} className="truncate font-semibold text-ink hover:text-primary">
                            {item.student?.name || '—'}
                          </Link>
                          {item.student?.studentCode ? <span className="text-xs text-secondary-500">{item.student.studentCode}</span> : null}
                          <Badge size="sm" variant={STATUS_BADGE[item.status] || 'default'}>{t(`students.status.${item.status || 'active'}`)}</Badge>
                        </div>
                        <p className="text-xs text-secondary-500">
                          {[
                            item.course?.name,
                            `${displayDate(item.startDate)} – ${displayDate(item.endDate)}`,
                            (item.shifts || []).map((shift) => shift.name).join(', '),
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                      <span className={`mr-1 text-sm font-semibold tabular-nums ${due > 0 ? 'text-rose-600' : 'text-secondary-500'}`}>
                        {t('students.enrollment.due')}: {formatMoney(t, due)}
                      </span>
                      {canManageStudents && due > 0 ? (
                        <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => actions.onCollect(item)}>
                          {t('students.enrollment.collectFee')}
                        </button>
                      ) : null}
                      {canManageStudents && isActive ? (
                        <>
                          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => actions.onChangeShifts(item)}>
                            {t('students.enrollment.changeShifts')}
                          </button>
                          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => actions.onComplete(item)}>
                            {t('students.enrollment.complete')}
                          </button>
                          <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-rose-600" onClick={() => actions.onDrop(item)}>
                            {t('students.enrollment.drop')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[20, 50, 100, 200]}
            />
          </>
        )}
      </section>

      <ConfirmDialog
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onConfirm={completeSelected}
        confirming={bulkBusy}
        variant="primary"
        title={t('students.enrollments.completeSelectedTitle', { count: selected.size })}
        description={t('students.enrollments.completeSelectedDescription')}
        confirmLabel={t('students.enrollment.complete')}
      />
      {actions.dialogs}
    </div>
  );
}
