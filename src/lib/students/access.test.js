import { describe, expect, it } from 'vitest';
import {
  getStudentAccess,
  hasStudentsAddon,
  isAddonRequiredError,
  withStudentsNavItem,
} from './access';
import { getNavigationForBusinessType } from '../business/businessTypeConfig';
import {
  getStaffPermissionUiFeatures,
  normalizePermissionMap,
  omitStudentPermissions,
} from '../accessControl';
import { previewEndDate } from './utils';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', route: '/app' },
  { key: 'parties', label: 'Parties', route: '/app/parties' },
  { key: 'settings', label: 'Settings', route: '/app/settings' },
];

describe('students add-on gate', () => {
  it('is off for a Standard shop without the add-on', () => {
    expect(hasStudentsAddon({ type: 'retail', addons: [] })).toBe(false);
    expect(hasStudentsAddon(null)).toBe(false);
  });

  it('is on from addons or modules', () => {
    expect(hasStudentsAddon({ type: 'retail', addons: ['students'] })).toBe(true);
    expect(hasStudentsAddon({ type: 'cafe', modules: { students: true } })).toBe(true);
  });

  it('leaves Standard navigation unchanged and drops a stale item', () => {
    const profile = { type: 'retail', addons: [] };
    expect(withStudentsNavItem(NAV, profile)).toEqual(NAV);
    expect(withStudentsNavItem([...NAV, { key: 'students', route: '/app/students' }], profile)).toEqual(NAV);
  });

  it('puts Students just before Settings when on', () => {
    const keys = withStudentsNavItem(NAV, { addons: ['students'] }).map((item) => item.key);
    expect(keys).toEqual(['dashboard', 'parties', 'students', 'settings']);
  });

  it('keeps the business-type navigation free of Students without the add-on', () => {
    const items = getNavigationForBusinessType(NAV, { type: 'retail', addons: [] });
    expect(items.some((item) => item.key === 'students')).toBe(false);
  });

  it('gives tutors attendance only', () => {
    const levels = { students: 'none', studentAttendance: 'manage' };
    const access = getStudentAccess(
      (key) => levels[key] !== 'none',
      (key) => levels[key] === 'manage',
    );
    expect(access).toMatchObject({
      canViewStudents: false,
      canManageStudents: false,
      canViewAttendance: true,
      canMarkAttendance: true,
      attendanceOnly: true,
    });
  });

  it('spots the add-on-required error', () => {
    expect(isAddonRequiredError({ status: 403, payload: { code: 'ADDON_REQUIRED' } })).toBe(true);
    expect(isAddonRequiredError({ status: 403, payload: { feature: 'students' } })).toBe(false);
  });
});

describe('student permissions', () => {
  const catalog = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'students', label: 'Students' },
    { key: 'studentAttendance', label: 'Student attendance' },
  ];

  it('hides the student rows unless the add-on is on', () => {
    expect(getStaffPermissionUiFeatures(catalog).map((f) => f.key)).toEqual(['dashboard']);
    expect(
      getStaffPermissionUiFeatures(catalog, { includeStudentModules: true }).map((f) => f.key),
    ).toEqual(['dashboard', 'students', 'studentAttendance']);
  });

  it('starts other staff with no student access', () => {
    const map = normalizePermissionMap({ sales: 'manage' });
    expect(map.students).toBe('none');
    expect(map.studentAttendance).toBe('none');
  });

  it('can strip student keys from a save payload', () => {
    const stripped = omitStudentPermissions(normalizePermissionMap({ students: 'view' }));
    expect(stripped).not.toHaveProperty('students');
    expect(stripped).not.toHaveProperty('studentAttendance');
  });
});

describe('previewEndDate', () => {
  it('matches the server rule: a 3-month course from 9 Oct ends 8 Jan', () => {
    expect(previewEndDate('2026-10-09', 3, 'month')).toBe('2027-01-08');
  });

  it('handles days and weeks', () => {
    expect(previewEndDate('2026-11-01', 10, 'day')).toBe('2026-11-10');
    expect(previewEndDate('2026-11-01', 2, 'week')).toBe('2026-11-14');
  });

  it('returns nothing for a bad length', () => {
    expect(previewEndDate('2026-11-01', 0, 'month')).toBe('');
    expect(previewEndDate('', 3, 'month')).toBe('');
  });
});
