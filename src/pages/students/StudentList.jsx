import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Badge } from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';
import Notice from '@/components/ui/Notice';
import StudentForm from '@/components/students/StudentForm';
import { Field, ResourceState, useStudentFormat, useStudentResource } from '@/components/students/StudentUi';
import StudentProfile from './StudentProfile';

export default function StudentList({ canManage }) {
  const [params, setParams] = useSearchParams();
  const studentId = params.get('student');
  const openStudent = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('student', id); else next.delete('student');
    setParams(next);
  };
  return studentId
    ? <StudentProfile key={studentId} studentId={studentId} canManage={canManage} onBack={() => openStudent(null)} />
    : <StudentDirectory canManage={canManage} onOpen={openStudent} />;
}

function StudentDirectory({ canManage, onOpen }) {
  const { t } = useI18n();
  const money = useStudentFormat();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', courseId: '', shiftId: '', hasDue: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState('');
  const query = useDebouncedValue(search.trim());
  const load = useCallback(async () => {
    const [students, courses, shifts] = await Promise.all([
      api.listStudents({ search: query, ...filters, limit: pageSize, offset: (page - 1) * pageSize }, { force: true }),
      api.listStudentCourses(), api.listStudentShifts(),
    ]);
    return { students, courses: courses.items || [], shifts: shifts.items || [] };
  }, [query, filters, pageSize, page]);
  const resource = useStudentResource(load);
  const data = resource.data;
  const items = data?.students?.items || [];
  const filter = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-semibold text-ink">{t('students.directory')}</h3>
      {canManage && <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={resource.loading || !!resource.error} onClick={() => setRegistering(true)}><Plus size={17} aria-hidden="true" />{t('students.register')}</button>}
    </div>
    {success && <div role="status"><Notice tone="success" title={success} /></div>}
    <div className="card space-y-4 p-4">
      <Field label={t('common.search')}>
        <div className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-3 text-secondary-400" aria-hidden="true" />
          <input type="search" className="input pl-10" placeholder={t('students.searchHint')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={t('common.status')}><select className="input" value={filters.status} onChange={(event) => filter('status', event.target.value)}><option value="">{t('common.all')}</option>{['active', 'inactive'].map((status) => <option key={status} value={status}>{t('students.status.' + status)}</option>)}</select></Field>
        <Field label={t('students.courses.course')}><select className="input" value={filters.courseId} onChange={(event) => filter('courseId', event.target.value)}><option value="">{t('common.all')}</option>{data?.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>
        <Field label={t('students.shifts.shift')}><select className="input" value={filters.shiftId} onChange={(event) => filter('shiftId', event.target.value)}><option value="">{t('common.all')}</option>{data?.shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select></Field>
        <Field label={t('students.fees.title')}><select className="input" value={filters.hasDue} onChange={(event) => filter('hasDue', event.target.value)}><option value="">{t('common.all')}</option><option value="true">{t('students.fees.withDue')}</option><option value="false">{t('students.fees.noDue')}</option></select></Field>
      </div>
    </div>
    <div className="card p-4">
      <ResourceState resource={resource} empty={!items.length} emptyTitle={t('students.empty')} emptyDescription={t('students.emptyHint')}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head"><tr>{['student', 'courses', 'status', 'due', 'actions'].map((key) => <th key={key} className="px-3 py-3">{t('students.columns.' + key)}</th>)}</tr></thead>
            <tbody className="divide-y divide-secondary-100">
              {items.map((student) => <tr key={student.id} className="hover:bg-secondary-50/60">
                <td className="px-3 py-3"><button type="button" className="min-h-11 text-left font-semibold text-primary hover:underline" onClick={() => onOpen(student.id)}>{student.name}</button><p className="text-xs text-secondary-500">{[student.studentCode, student.phone].filter(Boolean).join(' · ') || '—'}</p></td>
                <td className="px-3 py-3 text-secondary-600">{student.activeCourses?.join(', ') || t('students.enrollment.none')}</td>
                <td className="px-3 py-3"><Badge variant={student.status === 'active' ? 'active' : 'inactive'}>{t('students.status.' + student.status)}</Badge></td>
                <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums">{money(student.courseFeeDue)}</td>
                <td className="px-3 py-3"><button type="button" className="btn-ghost min-h-11" onClick={() => onOpen(student.id)}>{t('students.openProfile')}</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={data?.students.total ?? 0} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </ResourceState>
    </div>
    {registering && <StudentForm courses={data?.courses} shifts={data?.shifts} onClose={() => setRegistering(false)} onSaved={(student) => { setRegistering(false); setSuccess(t('students.saved')); onOpen(student.id); }} />}
  </div>;
}
