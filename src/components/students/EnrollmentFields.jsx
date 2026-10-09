import PaymentMethodFields from '@/components/form/PaymentMethodFields';
import { useI18n } from '@/lib/i18n.jsx';
import { useAuth } from '@/lib/auth';
import { todayISODate } from '@/lib/dates/datetime';
import { computeEnrollmentTotal, courseEndDate, describeShift } from '@/lib/students';
import { Field, useStudentFormat } from './StudentUi';

export const emptyEnrollment = () => ({
  courseId: '', startDate: todayISODate(), endDate: '', fee: '', discount: '0',
  amountPaid: '0', shiftIds: [], paymentMethod: 'cash', bankId: '', paymentNote: '', notes: '',
});

export function ShiftPicker({ shifts, value = [], onChange }) {
  const { t } = useI18n();
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium text-secondary-700">{t('students.shifts.title')}</legend>
    <p className="text-xs text-secondary-500">{t('students.shifts.multipleHint')}</p>
    {shifts.length === 0 && <p className="text-sm text-secondary-500">{t('students.shifts.noActive')}</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      {shifts.map((shift) => <label key={shift.id} className={'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 ' + (value.includes(shift.id) ? 'border-primary/50 bg-primary/5' : 'border-secondary-200')}>
        <input type="checkbox" className="mt-1 rounded" checked={value.includes(shift.id)} onChange={(event) => onChange(event.target.checked ? [...value, shift.id] : value.filter((id) => id !== shift.id))} />
        <span className="min-w-0 text-sm"><span className="block font-medium text-ink">{shift.name}</span><span className="text-xs text-secondary-500">{describeShift(shift, t)}</span></span>
      </label>)}
    </div>
  </fieldset>;
}

export default function EnrollmentFields({ form, setForm, courses, shifts }) {
  const { t } = useI18n();
  const { canViewFeature } = useAuth();
  const money = useStudentFormat();
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectedCourse = courses.find((course) => course.id === form.courseId);
  const total = computeEnrollmentTotal(form);
  const endDate = form.endDate || courseEndDate(form.startDate, selectedCourse?.durationValue, selectedCourse?.durationUnit);
  return <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('students.courses.course')} className="sm:col-span-2">
        <select className="input" required value={form.courseId} onChange={(event) => {
          const course = courses.find((item) => item.id === event.target.value);
          setForm((current) => ({ ...current, courseId: event.target.value, fee: course?.fee ?? '', endDate: '' }));
        }}>
          <option value="">{t('students.courses.select')}</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.name + ' · ' + t('students.courses.durationLabel', { value: course.durationValue, unit: t('students.durationUnits.' + course.durationUnit) })}</option>)}
        </select>
      </Field>
      <Field label={t('students.enrollment.startDate')}>
        <input className="input" type="date" required value={form.startDate} onChange={(event) => update('startDate', event.target.value)} />
      </Field>
      <Field label={t('students.enrollment.endDate')} hint={t('students.enrollment.autoEnd', { date: endDate || '—' })}>
        <input className="input" type="date" min={form.startDate} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} />
      </Field>
    </div>
    <ShiftPicker shifts={shifts.filter((shift) => shift.isActive !== false)} value={form.shiftIds} onChange={(value) => update('shiftIds', value)} />
    <div className="grid gap-4 sm:grid-cols-3">
      {['fee', 'discount', 'amountPaid'].map((key) => <Field key={key} label={t('students.enrollment.' + key)}>
        <input className="input" type="number" min="0" step="0.01" required value={form[key]} max={key === 'discount' ? form.fee : key === 'amountPaid' ? total : undefined} onChange={(event) => update(key, event.target.value)} />
      </Field>)}
    </div>
    <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm">
      <span>{t('students.enrollment.total')}: <strong className="text-ink">{money(total)}</strong></span>
      <span>{t('students.enrollment.remaining')}: <strong className="text-ink">{money(Math.max(total - Number(form.amountPaid || 0), 0))}</strong></span>
    </div>
    {Number(form.amountPaid) > 0 && <PaymentMethodFields value={form} onChange={(payment) => setForm((current) => ({ ...current, ...payment }))} showPaymentNote allowBankPayments={canViewFeature('banks')} />}
    <Field label={t('students.enrollment.notes')}>
      <textarea className="input" rows={2} maxLength={2000} value={form.notes} onChange={(event) => update('notes', event.target.value)} />
    </Field>
  </div>;
}
