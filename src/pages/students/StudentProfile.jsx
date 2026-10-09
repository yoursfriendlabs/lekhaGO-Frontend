import { useCallback, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMaybeDate } from '@/lib/dates/datetime';
import { attendanceTone, enrollmentTone } from '@/lib/students';
import { Badge } from '@/components/ui/Badge';
import Notice from '@/components/ui/Notice';
import StatsCard from '@/components/ui/StatsCard';
import StudentForm from '@/components/students/StudentForm';
import EnrollmentForm from '@/components/students/EnrollmentForm';
import FeePaymentForm from '@/components/students/FeePaymentForm';
import { ResourceState, useStudentResource, useStudentFormat } from '@/components/students/StudentUi';

export default function StudentProfile({ studentId, canManage, onBack }) {
  const { t } = useI18n();
  const money = useStudentFormat();
  const [dialog, setDialog] = useState(null);
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    const [student, history, courses, shifts] = await Promise.all([
      api.getStudent(studentId), api.listStudentAttendance({ studentId }),
      canManage ? api.listStudentCourses() : Promise.resolve({ items: [] }),
      canManage ? api.listStudentShifts() : Promise.resolve({ items: [] }),
    ]);
    return { student, history, courses: courses.items || [], shifts: shifts.items || [] };
  }, [studentId, canManage]);
  const resource = useStudentResource(load);
  const data = resource.data;
  const student = data?.student;
  const saved = (message = 'students.saved') => { setDialog(null); setSuccess(t(message)); resource.reload(); };
  return <div className="space-y-4">
    <button type="button" className="btn-ghost inline-flex min-h-11 items-center gap-2" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />{t('students.back')}</button>
    {success && <div role="status"><Notice tone="success" title={success} /></div>}
    <ResourceState resource={resource}>
      {student && <>
        <div className="card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-semibold text-ink">{student.name}</h3><p className="mt-1 text-sm text-secondary-500">{[student.studentCode, student.phone, student.email].filter(Boolean).join(' · ') || '—'}</p></div>
            <div className="flex items-center gap-3"><Badge variant={student.status === 'active' ? 'active' : 'inactive'}>{t('students.status.' + student.status)}</Badge>{canManage && <button type="button" className="btn-secondary" onClick={() => setDialog({ type: 'student' })}>{t('students.editStudent')}</button>}</div>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[['guardianName', [student.guardianName, student.guardianPhone].filter(Boolean).join(' · ')], ['address', student.address], ['joinedAt', formatMaybeDate(student.joinedAt, 'D MMM YYYY')], ['dateOfBirth', formatMaybeDate(student.dateOfBirth, 'D MMM YYYY')]].map(([key, value]) => <div key={key}><dt className="text-xs text-secondary-500">{t('students.fields.' + key)}</dt><dd className="mt-1 text-ink">{value || '—'}</dd></div>)}
          </dl>
          {student.notes && <p className="whitespace-pre-wrap text-sm text-secondary-600">{student.notes}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatsCard title={t('students.fees.due')} value={money(student.courseFeeDue)} tone={student.courseFeeDue > 0 ? 'warning' : 'success'} />
          <StatsCard title={t('students.enrollment.active')} value={student.activeEnrollmentCount} />
          <StatsCard title={t('students.attendance.rate')} value={student.attendance?.attendanceRate == null ? '—' : student.attendance.attendanceRate + '%'} hint={t('students.attendance.rateHint')} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">{t('students.enrollment.title')}</h3>
          {canManage && <button type="button" className="btn-primary inline-flex items-center gap-2" disabled={!data.courses.some((course) => course.isActive !== false)} onClick={() => setDialog({ type: 'enrollment' })}><Plus size={17} aria-hidden="true" />{t('students.enrollment.add')}</button>}
        </div>
        {!student.enrollments?.length && <Notice title={t('students.enrollment.none')} description={canManage ? t('students.courses.setupFirst') : undefined} />}
        {student.enrollments?.map((enrollment) => <article key={enrollment.id} className="card space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-ink">{enrollment.course?.name}</h4><p className="mt-1 text-sm text-secondary-500">{formatMaybeDate(enrollment.startDate, 'D MMM YYYY') + ' – ' + formatMaybeDate(enrollment.endDate, 'D MMM YYYY')}</p></div><Badge variant={enrollmentTone(enrollment.status)}>{t('students.status.' + enrollment.status)}</Badge></div>
          <p className="text-sm text-secondary-600">{t('students.shifts.title') + ': ' + (enrollment.shifts?.map((shift) => shift.name).join(', ') || t('students.shifts.unassigned'))}</p>
          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-secondary-50 p-3 text-sm">
            {['billed', 'paid', 'due'].map((key) => <div key={key}><dt className="text-xs text-secondary-500">{t('students.fees.' + key)}</dt><dd className="mt-1 font-semibold tabular-nums text-ink">{money(enrollment.fees?.[key])}</dd></div>)}
          </dl>
          {enrollment.fees?.bills?.length > 0 && <details className="text-sm text-secondary-600"><summary className="cursor-pointer">{t('students.fees.bills')}</summary><ul className="mt-2 space-y-1">{enrollment.fees.bills.map((bill) => <li key={bill.id}>{(bill.orderNo || bill.id) + ' · ' + money(bill.grandTotal) + (bill.isCancelled ? ' · ' + t('students.fees.cancelled') : '')}</li>)}</ul></details>}
          {enrollment.notes && <p className="whitespace-pre-wrap text-sm text-secondary-600">{enrollment.notes}</p>}
          {canManage && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setDialog({ type: 'enrollment', enrollment })}>{t('students.enrollment.edit')}</button>{enrollment.fees?.due > 0 && <button type="button" className="btn-primary" onClick={() => setDialog({ type: 'payment', enrollment: { ...enrollment, student: { id: student.id, name: student.name } } })}>{t('students.fees.collect')}</button>}</div>}
        </article>)}
        <div className="card p-5">
          <h3 className="mb-4 text-base font-semibold text-ink">{t('students.attendance.history')}</h3>
          {!data.history.items?.length ? <p className="text-sm text-secondary-500">{t('students.attendance.noHistory')}</p> : <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm">
            <thead className="table-head"><tr>{['date', 'shift', 'status', 'markedBy', 'note'].map((key) => <th key={key} className="px-3 py-2">{t('students.attendance.' + key)}</th>)}</tr></thead>
            <tbody className="divide-y divide-secondary-100">{data.history.items.map((mark) => <tr key={mark.id}><td className="whitespace-nowrap px-3 py-3">{formatMaybeDate(mark.date, 'D MMM YYYY')}</td><td className="px-3 py-3">{mark.shift?.name}</td><td className="px-3 py-3"><Badge variant={attendanceTone(mark.status)}>{t('students.attendance.statuses.' + mark.status)}</Badge></td><td className="px-3 py-3">{mark.markedBy?.name || '—'}</td><td className="px-3 py-3">{mark.note || '—'}</td></tr>)}</tbody>
          </table></div>}
        </div>
      </>}
    </ResourceState>
    {student && dialog?.type === 'student' && <StudentForm student={student} onClose={() => setDialog(null)} onSaved={() => saved()} />}
    {student && dialog?.type === 'enrollment' && <EnrollmentForm studentId={studentId} enrollment={dialog.enrollment} courses={data.courses} shifts={data.shifts} onClose={() => setDialog(null)} onSaved={() => saved()} />}
    {dialog?.type === 'payment' && <FeePaymentForm enrollment={dialog.enrollment} onClose={() => setDialog(null)} onSaved={() => saved('students.fees.recorded')} />}
  </div>;
}
