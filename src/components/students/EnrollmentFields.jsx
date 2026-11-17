import { useI18n } from '@/lib/i18n.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { buildPaymentPayload, requiresBankSelection } from '@/lib/money/payments';
import PaymentMethodFields from '@/components/form/PaymentMethodFields.jsx';
import { compact, displayDate, previewEndDate, todayISO, toNumber } from '@/lib/students/utils';
import ShiftChecklist from './ShiftChecklist.jsx';

export function emptyEnrollmentForm() {
  return {
    courseId: '',
    startDate: todayISO(),
    endDate: '',
    endDateTouched: false,
    fee: '',
    discount: '',
    shiftIds: [],
    amountPaid: '',
    paymentMethod: 'cash',
    bankId: '',
    notes: '',
  };
}

function courseOf(courses, id) {
  return courses.find((course) => String(course.id) === String(id)) || null;
}

export function enrollmentTotal(form) {
  return Math.max(toNumber(form.fee) - toNumber(form.discount), 0);
}

export function validateEnrollment(form, t) {
  if (!form.courseId) return t('students.enroll.courseRequired');
  if (toNumber(form.discount) > toNumber(form.fee)) return t('students.enroll.discountTooHigh');
  if (form.endDateTouched && form.endDate && form.startDate && form.endDate < form.startDate) {
    return t('students.enroll.endBeforeStart');
  }
  if (toNumber(form.amountPaid) > enrollmentTotal(form)) return t('students.enroll.paidTooHigh');
  if (requiresBankSelection(form, form.amountPaid)) return t('payments.bankRequired');
  return '';
}

export function buildEnrollmentPayload(form) {
  const paid = toNumber(form.amountPaid);
  return compact({
    courseId: form.courseId,
    startDate: form.startDate || undefined,
    // Only send an end date when the user changed it; the server works it out otherwise.
    endDate: form.endDateTouched && form.endDate ? form.endDate : undefined,
    fee: toNumber(form.fee),
    discount: toNumber(form.discount),
    shiftIds: form.shiftIds,
    notes: String(form.notes || '').trim() || undefined,
    ...(paid > 0
      ? { amountPaid: paid, ...buildPaymentPayload({ paymentMethod: form.paymentMethod, bankId: form.bankId }) }
      : {}),
  });
}

/**
 * Course, dates, fee, shifts and first payment. Used by Register and Enroll.
 * `activeCourseIds` greys out courses the student is already active in.
 */
export default function EnrollmentFields({
  value,
  onChange,
  courses = [],
  shifts = [],
  activeCourseIds = [],
  disabled = false,
}) {
  const { t } = useI18n();
  const form = value;
  const activeSet = new Set(activeCourseIds.map(String));
  const selectedCourse = courseOf(courses, form.courseId);
  const preview = selectedCourse
    ? previewEndDate(form.startDate, selectedCourse.durationValue, selectedCourse.durationUnit)
    : '';
  const total = enrollmentTotal(form);
  const paid = toNumber(form.amountPaid);

  const update = (patch) => onChange({ ...form, ...patch });

  const pickCourse = (courseId) => {
    const course = courseOf(courses, courseId);
    update({
      courseId,
      fee: course ? String(toNumber(course.fee)) : '',
      discount: '',
      endDate: course ? previewEndDate(form.startDate, course.durationValue, course.durationUnit) : '',
      endDateTouched: false,
    });
  };

  const changeStart = (startDate) => {
    const patch = { startDate };
    if (!form.endDateTouched && selectedCourse) {
      patch.endDate = previewEndDate(startDate, selectedCourse.durationValue, selectedCourse.durationUnit);
    }
    update(patch);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="enroll-course">{t('students.enroll.course')}</label>
        {courses.length === 0 ? (
          <p className="text-sm text-secondary-500">{t('students.enroll.noCourses')}</p>
        ) : (
          <select
            id="enroll-course"
            className="input"
            value={form.courseId}
            disabled={disabled}
            onChange={(event) => pickCourse(event.target.value)}
          >
            <option value="">{t('students.enroll.pickCourse')}</option>
            {courses.map((course) => {
              const taken = activeSet.has(String(course.id));
              return (
                <option key={course.id} value={course.id} disabled={taken}>
                  {course.name}
                  {course.durationLabel ? ` · ${course.durationLabel}` : ''}
                  {` · ${formatMoney(t, course.fee)}`}
                  {taken ? ` (${t('students.enroll.alreadyActive')})` : ''}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="enroll-start">{t('students.enroll.startDate')}</label>
          <input
            id="enroll-start"
            type="date"
            className="input"
            value={form.startDate}
            disabled={disabled}
            onChange={(event) => changeStart(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="enroll-end">{t('students.enroll.endDate')}</label>
          <input
            id="enroll-end"
            type="date"
            className="input"
            value={form.endDate}
            min={form.startDate || undefined}
            disabled={disabled || !selectedCourse}
            onChange={(event) => update({ endDate: event.target.value, endDateTouched: true })}
          />
          {preview ? (
            <p className="mt-1 text-xs text-secondary-500">
              {t('students.enroll.endDatePreview', { date: displayDate(preview) })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="enroll-fee">{t('students.enroll.fee')}</label>
          <input
            id="enroll-fee"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            className="input"
            value={form.fee}
            disabled={disabled}
            onChange={(event) => update({ fee: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="enroll-discount">{t('students.enroll.discount')}</label>
          <input
            id="enroll-discount"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            className="input"
            value={form.discount}
            disabled={disabled}
            onChange={(event) => update({ discount: event.target.value })}
          />
        </div>
      </div>
      <div className="rounded-xl bg-secondary-50 px-3 py-2.5 text-sm dark:bg-slate-800/60">
        <div className="flex items-center justify-between gap-3">
          <span className="text-secondary-600">{t('students.enroll.total')}</span>
          <span className="font-semibold tabular-nums text-ink">{formatMoney(t, total)}</span>
        </div>
        <p className="mt-1 text-xs text-secondary-500">{t('students.enrollment.feeLocked')}</p>
      </div>

      <div>
        <p className="label">{t('students.enroll.shifts')}</p>
        <ShiftChecklist
          shifts={shifts}
          value={form.shiftIds}
          disabled={disabled}
          onChange={(shiftIds) => update({ shiftIds })}
        />
      </div>

      <div>
        <label className="label" htmlFor="enroll-paid">{t('students.enroll.paidNow')}</label>
        <input
          id="enroll-paid"
          type="number"
          min="0"
          max={total || undefined}
          step="any"
          inputMode="decimal"
          className="input"
          value={form.amountPaid}
          disabled={disabled}
          onChange={(event) => update({ amountPaid: event.target.value })}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-secondary-200 px-3 py-1.5 text-xs font-semibold text-ink-light hover:bg-mist"
            disabled={disabled}
            onClick={() => update({ amountPaid: '' })}
          >
            {t('payments.noPayment')}
          </button>
          <button
            type="button"
            className="rounded-full border border-secondary-200 px-3 py-1.5 text-xs font-semibold text-ink-light hover:bg-mist"
            disabled={disabled || total <= 0}
            onClick={() => update({ amountPaid: String(total) })}
          >
            {t('payments.fullAmount')}
          </button>
        </div>
      </div>

      {paid > 0 ? (
        <PaymentMethodFields
          value={{ paymentMethod: form.paymentMethod, bankId: form.bankId }}
          onChange={(next) => update({ paymentMethod: next.paymentMethod, bankId: next.bankId || '' })}
        />
      ) : null}

      <div>
        <label className="label" htmlFor="enroll-notes">{t('students.enroll.notes')}</label>
        <textarea
          id="enroll-notes"
          rows={2}
          maxLength={2000}
          className="input"
          value={form.notes}
          disabled={disabled}
          onChange={(event) => update({ notes: event.target.value })}
        />
      </div>
    </div>
  );
}
