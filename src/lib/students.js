/**
 * Helpers for the Students & Courses add-on. The backend decides which
 * businesses have it (businessProfile.addons) and gates every /api/students
 * route; these helpers only shape what the screens show.
 */

export const STUDENTS_ADDON_KEY = 'students';
export const STUDENT_PERMISSION_KEYS = ['students', 'studentAttendance'];

export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'];
export const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped'];
export const DURATION_UNITS = ['day', 'week', 'month'];
export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function hasStudentsAddon(businessProfile) {
  const addons = businessProfile?.addons;
  if (Array.isArray(addons)) return addons.includes(STUDENTS_ADDON_KEY);
  return businessProfile?.modules?.students === true;
}

/** Tabs a user may open: tutors with attendance-only access just see Attendance. */
export function getStudentTabs({ canViewStudents, canViewAttendance, canManageStudents }) {
  const tabs = [];
  if (canViewStudents) tabs.push('students');
  if (canViewAttendance || canViewStudents) tabs.push('attendance');
  if (canViewStudents) tabs.push('dues');
  if (canManageStudents) tabs.push('setup');
  return tabs;
}

export function pickStudentTab(requested, tabs) {
  return tabs.includes(requested) ? requested : tabs[0] || null;
}

export function toAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

/** What is left to pay at enrollment once the discount is taken off. */
export function computeEnrollmentTotal({ fee, discount }) {
  return Math.max(toAmount(fee) - toAmount(discount), 0);
}

export function attendanceTone(status) {
  if (status === 'present') return 'success';
  if (status === 'late') return 'warning';
  if (status === 'absent') return 'error';
  if (status === 'excused') return 'default';
  return 'pending';
}

export function enrollmentTone(status) {
  if (status === 'active') return 'active';
  if (status === 'completed') return 'success';
  return 'inactive';
}

/** "07:00–09:00 · Sun, Tue" style label for a shift. */
export function describeShift(shift, t) {
  if (!shift) return '';
  const time = [shift.startTime, shift.endTime].filter(Boolean).join('–');
  const days = Array.isArray(shift.days) && shift.days.length
    ? shift.days.map((day) => t(`students.weekdays.${day}`)).join(', ')
    : t('students.shifts.everyDay');
  return [time, days].filter(Boolean).join(' · ');
}

/** Build the entries body for PUT /api/students/attendance from a roster and edits. */
export function buildAttendanceEntries(rosterItems = [], marks = {}) {
  return rosterItems
    .filter((item) => Object.prototype.hasOwnProperty.call(marks, item.enrollmentId))
    .filter((item) => (marks[item.enrollmentId]?.status ?? null) !== (item.status ?? null)
      || (marks[item.enrollmentId]?.note ?? '') !== (item.note ?? ''))
    .map((item) => ({
      enrollmentId: item.enrollmentId,
      status: marks[item.enrollmentId]?.status ?? null,
      note: marks[item.enrollmentId]?.note || undefined,
    }));
}

/** Mark every unmarked student in the roster with the given status. */
export function markAllUnmarked(rosterItems = [], marks = {}, status = 'present') {
  const next = { ...marks };
  rosterItems.forEach((item) => {
    const current = next[item.enrollmentId]?.status ?? item.status ?? null;
    if (!current) next[item.enrollmentId] = { ...(next[item.enrollmentId] || {}), status };
  });
  return next;
}

/** Preview follows the API's inclusive course dates, including month ends. */
export function courseEndDate(startDate, durationValue, durationUnit) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) return '';
  const date = new Date(startDate + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate) return '';
  const amount = Number(durationValue);
  if (!Number.isInteger(amount) || amount < 1 || !DURATION_UNITS.includes(durationUnit)) return '';
  if (durationUnit === 'month') {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(date.getUTCDate() > lastDay ? lastDay : date.getUTCDate() - 1);
    return target.toISOString().slice(0, 10);
  }
  date.setUTCDate(date.getUTCDate() + amount * (durationUnit === 'week' ? 7 : 1) - 1);
  return date.toISOString().slice(0, 10);
}

export function validateEnrollment(form) {
  if (!form.courseId) return 'students.validation.course';
  if (!form.startDate) return 'students.validation.startDate';
  if (form.endDate && form.endDate < form.startDate) return 'students.validation.endDate';
  if (['fee', 'discount', 'amountPaid'].some((key) => !Number.isFinite(Number(form[key])) || Number(form[key]) < 0)) return 'students.validation.amount';
  if (toAmount(form.discount) > toAmount(form.fee)) return 'students.validation.discount';
  if (toAmount(form.amountPaid) > computeEnrollmentTotal(form)) return 'students.validation.paid';
  if (toAmount(form.amountPaid) > 0 && form.paymentMethod === 'bank' && !form.bankId) return 'payments.bankRequired';
  return '';
}

export function enrollmentPayload(form) {
  return {
    courseId: form.courseId,
    startDate: form.startDate,
    ...(form.endDate ? { endDate: form.endDate } : {}),
    fee: toAmount(form.fee),
    discount: toAmount(form.discount),
    amountPaid: toAmount(form.amountPaid),
    shiftIds: form.shiftIds || [],
    paymentMethod: toAmount(form.amountPaid) > 0 ? form.paymentMethod : 'cash',
    bankId: toAmount(form.amountPaid) > 0 && form.paymentMethod === 'bank' ? form.bankId : null,
    paymentNote: form.paymentNote || '',
    notes: form.notes || '',
  };
}
