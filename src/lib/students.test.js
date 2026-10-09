import { describe, expect, it } from 'vitest';
import { canAccessFeature } from './subscription';
import { getFeatureAccessLevel, getStaffPermissionUiFeatures } from './accessControl';
import {
  buildAttendanceEntries, computeEnrollmentTotal, courseEndDate, enrollmentPayload,
  getStudentTabs, hasStudentsAddon, markAllUnmarked, pickStudentTab, validateEnrollment,
} from './students';

const enrollment = { courseId: 'course-1', startDate: '2026-10-09', fee: '30000', discount: '1000', amountPaid: '5000', shiftIds: ['morning', 'evening'], paymentMethod: 'cash' };

describe('student access', () => {
  it('honors an explicit disabled add-on over a stale module flag', () => {
    expect(hasStudentsAddon({ addons: [], modules: { students: true } })).toBe(false);
    expect(hasStudentsAddon({ addons: ['students'] })).toBe(true);
  });
  it('keeps a tutor in attendance even on a dues deep link', () => {
    const tabs = getStudentTabs({ canViewStudents: false, canViewAttendance: true, canManageStudents: false });
    expect(tabs).toEqual(['attendance']);
    expect(pickStudentTab('dues', tabs)).toBe('attendance');
  });
  it('lets read-only student staff view fees and rosters without setup', () => {
    expect(getStudentTabs({ canViewStudents: true, canViewAttendance: false, canManageStudents: false })).toEqual(['students', 'attendance', 'dues']);
    const staff = { role: 'staff', permissions: { students: 'view', studentAttendance: 'none' } };
    expect(getFeatureAccessLevel(staff, 'students', 'staff')).toBe('view');
    expect(getFeatureAccessLevel(staff, 'studentAttendance', 'staff')).toBe('none');
  });
  it('shows student permission rows only for businesses with the add-on', () => {
    const features = [{ key: 'students' }, { key: 'studentAttendance' }];
    expect(getStaffPermissionUiFeatures(features)).toEqual([]);
    expect(getStaffPermissionUiFeatures(features, { includeStudentModules: true }).map((item) => item.key)).toEqual(['students', 'studentAttendance']);
  });
  it('does not require another plan upgrade for a purchased add-on', () => {
    const subscription = { access: { canUseApplication: true, planKey: 'freemium' } };
    expect(canAccessFeature(subscription, 'students')).toBe(true);
    expect(canAccessFeature(subscription, 'studentAttendance')).toBe(true);
    expect(canAccessFeature({ access: { canUseApplication: false, planKey: 'growth' } }, 'studentAttendance')).toBe(false);
  });
});

describe('enrollment dates and payments', () => {
  it.each([
    ['2026-10-09', 3, 'month', '2027-01-08'],
    ['2026-01-31', 1, 'month', '2026-02-28'],
    ['2028-01-31', 1, 'month', '2028-02-29'],
    ['2026-10-09', 2, 'week', '2026-10-22'],
    ['2026-10-09', 1, 'day', '2026-10-09'],
    ['2026-02-30', 1, 'month', ''],
  ])('previews inclusive course dates for %s', (date, count, unit, expected) => {
    expect(courseEndDate(date, count, unit)).toBe(expected);
  });
  it('calculates the discounted fee and keeps every selected shift', () => {
    expect(computeEnrollmentTotal(enrollment)).toBe(29000);
    const payload = enrollmentPayload(enrollment);
    expect(payload).toMatchObject({ fee: 30000, discount: 1000, amountPaid: 5000, shiftIds: ['morning', 'evening'], bankId: null });
    expect(payload).not.toHaveProperty('endDate');
    expect(validateEnrollment(enrollment)).toBe('');
  });
  it.each([
    [{ discount: 30001 }, 'students.validation.discount'],
    [{ amountPaid: 29001 }, 'students.validation.paid'],
    [{ fee: -1 }, 'students.validation.amount'],
    [{ fee: 'NaN' }, 'students.validation.amount'],
    [{ endDate: '2026-10-08' }, 'students.validation.endDate'],
    [{ paymentMethod: 'bank', bankId: '' }, 'payments.bankRequired'],
  ])('rejects invalid fees and dates', (patch, error) => {
    expect(validateEnrollment({ ...enrollment, ...patch })).toBe(error);
  });
  it('allows enrollment with no payment and no bank account', () => {
    const form = { ...enrollment, amountPaid: 0, paymentMethod: 'bank', bankId: '' };
    expect(validateEnrollment(form)).toBe('');
    expect(enrollmentPayload(form)).toMatchObject({ amountPaid: 0, paymentMethod: 'cash', bankId: null });
  });
});

describe('attendance batches', () => {
  const roster = [
    { enrollmentId: 'e1', status: 'late', note: 'Traffic' },
    { enrollmentId: 'e2', status: null, note: null },
  ];
  it('marks only unmarked students and preserves existing marks and notes', () => {
    const marks = markAllUnmarked(roster, {});
    expect(marks).toEqual({ e2: { status: 'present' } });
    expect(buildAttendanceEntries(roster, marks)).toEqual([{ enrollmentId: 'e2', status: 'present', note: undefined }]);
  });
  it('sends edited notes and null marks while leaving unchanged students out', () => {
    expect(buildAttendanceEntries(roster, { e1: { status: 'late', note: 'Traffic' } })).toEqual([]);
    expect(buildAttendanceEntries(roster, { e1: { status: null, note: '' } })).toEqual([{ enrollmentId: 'e1', status: null, note: undefined }]);
    expect(buildAttendanceEntries(roster, { e1: { status: 'late', note: 'Bus delayed' } })).toEqual([{ enrollmentId: 'e1', status: 'late', note: 'Bus delayed' }]);
  });
});
