/**
 * Gate for the students & courses add-on.
 *
 * A platform admin switches it on per business. Shops without it must never
 * see a students screen or call /api/students.
 */
import { getBusinessAddons } from '@/lib/business/hospitality';

export const STUDENTS_ADDON = 'students';
export const STUDENTS_NAV_ITEM = Object.freeze({
  key: 'students',
  label: 'Students',
  route: '/app/students',
});

export function hasStudentsAddon(profile) {
  if (!profile) return false;
  if (getBusinessAddons(profile).includes(STUDENTS_ADDON)) return true;
  return profile.modules?.students === true;
}

/**
 * Add the Students nav item just before Settings when the add-on is on,
 * and drop any stale one when it is off.
 */
export function withStudentsNavItem(navigation = [], profile) {
  const list = Array.isArray(navigation) ? navigation.filter(Boolean) : [];
  const enabled = hasStudentsAddon(profile);
  const withoutStudents = list.filter((item) => item?.key !== STUDENTS_NAV_ITEM.key);
  if (!enabled) return withoutStudents;

  const existing = list.find((item) => item?.key === STUDENTS_NAV_ITEM.key);
  const item = { ...STUDENTS_NAV_ITEM, ...(existing || {}) };
  const settingsIndex = withoutStudents.findIndex((entry) => entry?.key === 'settings');
  if (settingsIndex < 0) return [...withoutStudents, item];
  return [
    ...withoutStudents.slice(0, settingsIndex),
    item,
    ...withoutStudents.slice(settingsIndex),
  ];
}

/**
 * What the signed-in person may do in the students module.
 * `canView` / `canManage` come from useAuth().
 */
export function getStudentAccess(canView, canManage) {
  const view = Boolean(canView?.('students'));
  const manage = Boolean(canManage?.('students'));
  const attendanceView = Boolean(canView?.('studentAttendance'));
  const attendanceManage = Boolean(canManage?.('studentAttendance'));
  return {
    canViewStudents: view,
    canManageStudents: manage,
    canViewAttendance: view || attendanceView,
    canMarkAttendance: attendanceManage,
    /** Tutor-style access: attendance only, never fees. */
    attendanceOnly: !view && attendanceView,
  };
}

export function isAddonRequiredError(error) {
  return error?.status === 403 && error?.payload?.code === 'ADDON_REQUIRED';
}
