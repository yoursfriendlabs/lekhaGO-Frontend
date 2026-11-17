import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Plus, RefreshCw, Search } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Notice from '@/components/ui/Notice';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import StudentsTabs from '@/components/students/StudentsTabs.jsx';
import StudentFormDialog from '@/components/students/StudentFormDialog.jsx';
import { useStudentLookups } from '@/components/students/useStudentLookups';
import { useStudentsModule } from '@/components/students/useStudentsModule';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { STATUS_BADGE, toNumber } from '@/lib/students/utils';

const EMPTY_FILTERS = { status: '', courseId: '', shiftId: '', hasDue: false };

export default function Students() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { businessId } = useAuth();
  const { canManageStudents, handleError } = useStudentsModule();
  const lookups = useStudentLookups({ includeInactive: true });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);

  const hasFilters = Boolean(debouncedSearch.trim() || filters.status || filters.courseId || filters.shiftId || filters.hasDue);

  const load = useCallback(async ({ force = false } = {}) => {
    if (!businessId) return;
    setLoading(true);
    setError('');
    try {
      const payload = await api.listStudents({
        search: debouncedSearch.trim() || undefined,
        status: filters.status || undefined,
        courseId: filters.courseId || undefined,
        shiftId: filters.shiftId || undefined,
        hasDue: filters.hasDue ? true : undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }, { force });
      setData({
        items: Array.isArray(payload?.items) ? payload.items : [],
        total: toNumber(payload?.total),
      });
    } catch (err) {
      const message = handleError(err);
      if (message) setError(message);
    } finally {
      setLoading(false);
    }
  }, [businessId, debouncedSearch, filters, handleError, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize]);

  const setFilter = (patch) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <div>
      <PageHeader
        title={t('students.title')}
        subtitle={t('students.subtitle')}
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => load({ force: true })} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
            {canManageStudents ? (
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setRegisterOpen(true)}>
                <Plus size={16} />
                {t('students.list.register')}
              </button>
            ) : null}
          </div>
        )}
      />
      <StudentsTabs />

      <section className="card space-y-4 p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
            <input
              className="input pl-9"
              type="search"
              value={search}
              placeholder={t('students.list.searchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select className="input" value={filters.status} onChange={(event) => setFilter({ status: event.target.value })}>
            <option value="">{t('students.list.allStatuses')}</option>
            <option value="active">{t('students.status.active')}</option>
            <option value="inactive">{t('students.status.inactive')}</option>
          </select>
          <select className="input" value={filters.courseId} onChange={(event) => setFilter({ courseId: event.target.value })}>
            <option value="">{t('students.list.allCourses')}</option>
            {lookups.courses.map((course) => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
          <select className="input" value={filters.shiftId} onChange={(event) => setFilter({ shiftId: event.target.value })}>
            <option value="">{t('students.list.allShifts')}</option>
            {lookups.shifts.map((shift) => (
              <option key={shift.id} value={shift.id}>{shift.name}</option>
            ))}
          </select>
          <label className="flex min-h-[44px] items-center gap-2 whitespace-nowrap text-sm font-semibold text-secondary-700">
            <input type="checkbox" checked={filters.hasDue} onChange={(event) => setFilter({ hasDue: event.target.checked })} />
            {t('students.list.owesFees')}
          </label>
        </div>

        {error ? <Notice tone="error" title={error} /> : null}

        {loading && data.items.length === 0 ? (
          <p className="py-10 text-center text-sm text-secondary-500">{t('common.loading')}</p>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-secondary-200 py-12 text-center">
            <GraduationCap size={28} className="text-secondary-400" />
            <p className="text-sm text-secondary-500">
              {hasFilters ? t('students.list.emptyFiltered') : t('students.list.empty')}
            </p>
            {!hasFilters && canManageStudents ? (
              <button type="button" className="btn-primary flex items-center gap-2" onClick={() => setRegisterOpen(true)}>
                <Plus size={16} />
                {t('students.list.register')}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-secondary-100 md:hidden">
              {data.items.map((student) => (
                <li key={student.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left"
                    onClick={() => navigate(`/app/students/${student.id}`)}
                  >
                    <Avatar src={student.avatarUrl} name={student.name} size="md" fallbackClassName="bg-secondary-100 text-secondary-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{student.name}</span>
                      <span className="block truncate text-xs text-secondary-500">
                        {[student.studentCode, student.phone].filter(Boolean).join(' · ')}
                      </span>
                      <span className="block truncate text-xs text-secondary-500">
                        {(student.activeCourses || []).map((course) => course?.name || course).join(', ') || t('students.list.noCourse')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {toNumber(student.courseFeeDue) > 0 ? (
                        <span className="block text-sm font-semibold tabular-nums text-rose-600">{formatMoney(t, student.courseFeeDue)}</span>
                      ) : null}
                      <Badge size="sm" variant={STATUS_BADGE[student.status] || 'default'}>{t(`students.status.${student.status || 'active'}`)}</Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-secondary-100 text-[11px] uppercase tracking-wide text-secondary-400">
                    <th className="py-2 pr-3 font-semibold">{t('students.list.student')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('students.list.code')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('students.list.phone')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('students.list.courses')}</th>
                    <th className="py-2 pr-3 text-right font-semibold">{t('students.list.feeDue')}</th>
                    <th className="py-2 font-semibold">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((student) => (
                    <tr
                      key={student.id}
                      className="cursor-pointer border-b border-secondary-50 last:border-0 hover:bg-secondary-50/60"
                      onClick={() => navigate(`/app/students/${student.id}`)}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={student.avatarUrl} name={student.name} size="sm" fallbackClassName="bg-secondary-100 text-secondary-600" />
                          <span className="font-semibold text-ink">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-secondary-600">{student.studentCode || '—'}</td>
                      <td className="py-3 pr-3 text-secondary-600">{student.phone || '—'}</td>
                      <td className="max-w-[240px] truncate py-3 pr-3 text-secondary-600">
                        {(student.activeCourses || []).map((course) => course?.name || course).join(', ') || '—'}
                      </td>
                      <td className={`py-3 pr-3 text-right font-semibold tabular-nums ${toNumber(student.courseFeeDue) > 0 ? 'text-rose-600' : 'text-secondary-500'}`}>
                        {formatMoney(t, student.courseFeeDue)}
                      </td>
                      <td className="py-3">
                        <Badge size="sm" variant={STATUS_BADGE[student.status] || 'default'}>{t(`students.status.${student.status || 'active'}`)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[20, 50, 100, 200]}
            />
          </>
        )}
      </section>

      <StudentFormDialog
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSaved={(student) => {
          setRegisterOpen(false);
          if (student?.id) navigate(`/app/students/${student.id}`);
          else load({ force: true });
        }}
      />
    </div>
  );
}
