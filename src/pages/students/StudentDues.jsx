import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMaybeDate } from '@/lib/dates/datetime';
import StatsCard from '@/components/ui/StatsCard';
import Notice from '@/components/ui/Notice';
import FeePaymentForm from '@/components/students/FeePaymentForm';
import { Field, ResourceState, useStudentFormat, useStudentResource } from '@/components/students/StudentUi';

export default function StudentDues({ canManage }) {
  const { t } = useI18n();
  const money = useStudentFormat();
  const [params, setParams] = useSearchParams();
  const [courseId, setCourseId] = useState('');
  const [payment, setPayment] = useState(null);
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    const [dues, courses] = await Promise.all([api.listStudentDues({ courseId }, { force: true }), api.listStudentCourses()]);
    return { dues, courses: courses.items || [] };
  }, [courseId]);
  const resource = useStudentResource(load);
  const data = resource.data;
  return <div className="space-y-4">
    {success && <div role="status"><Notice title={success} tone="success" /></div>}
    <div className="grid items-end gap-4 sm:grid-cols-2">
      <StatsCard title={t('students.fees.totalDue')} value={money(data?.dues.totalDue)} icon={Wallet} tone="warning" loading={resource.loading} />
      <Field label={t('students.courses.course')}><select className="input" value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">{t('common.all')}</option>{data?.courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></Field>
    </div>
    <div className="card p-4">
      <ResourceState resource={resource} empty={!data?.dues.items?.length} emptyTitle={t('students.fees.noDues')} emptyDescription={t('students.fees.noDuesHint')}>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="table-head"><tr>{['student', 'course', 'startDate', 'billed', 'paid', 'due', 'actions'].map((key) => <th key={key} className="px-3 py-3">{t('students.fees.' + key)}</th>)}</tr></thead>
          <tbody className="divide-y divide-secondary-100">{data?.dues.items.map((enrollment) => <tr key={enrollment.id}>
            <td className="px-3 py-3"><button type="button" className="min-h-11 text-left font-semibold text-primary hover:underline" onClick={() => { const next = new URLSearchParams(params); next.set('tab', 'students'); next.set('student', enrollment.studentId); setParams(next); }}>{enrollment.student?.name}</button><p className="text-xs text-secondary-500">{enrollment.student?.phone || '—'}</p></td>
            <td className="px-3 py-3">{enrollment.course?.name}</td><td className="whitespace-nowrap px-3 py-3">{formatMaybeDate(enrollment.startDate, 'D MMM YYYY')}</td>
            {['billed', 'paid', 'due'].map((key) => <td key={key} className="whitespace-nowrap px-3 py-3 tabular-nums">{money(enrollment.fees?.[key])}</td>)}
            <td className="px-3 py-3">{canManage ? <button type="button" className="btn-secondary whitespace-nowrap" onClick={() => setPayment(enrollment)}>{t('students.fees.collect')}</button> : '—'}</td>
          </tr>)}</tbody>
        </table></div>
      </ResourceState>
    </div>
    {payment && <FeePaymentForm enrollment={payment} onClose={() => setPayment(null)} onSaved={() => { setPayment(null); setSuccess(t('students.fees.recorded')); resource.reload(); }} />}
  </div>;
}
