import { normalizeAccessLevel, normalizePermissionMap } from './accessControl';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

export const EMPTY_STAFF_SUMMARY = Object.freeze({
  maxUsers: 0,
  totalUsers: 0,
  availableSlots: 0,
});

export function normalizeStaffSummary(summary) {
  const source = asObject(summary) || {};
  return {
    maxUsers: Number(source.maxUsers || 0),
    totalUsers: Number(source.totalUsers || 0),
    availableSlots: Number(source.availableSlots || 0),
  };
}

export function normalizeStaffMeta(meta) {
  const source = asObject(meta) || {};
  const accessLevels = Array.isArray(source.accessLevels)
    ? source.accessLevels.map((level) => ({
      key: normalizeAccessLevel(level?.key),
    }))
    : [];
  const features = Array.isArray(source.features)
    ? source.features
      .filter((feature) => feature?.key)
      .map((feature) => ({
        key: String(feature.key),
        label: pickString(feature.label, feature.key),
        description: pickString(feature.description),
      }))
    : [];
  const categories = Array.isArray(source.categories)
    ? source.categories
      .filter((category) => category?.key)
      .map((category) => ({
        key: String(category.key),
        label: pickString(category.label, category.key),
        description: pickString(category.description),
        defaultPermissions: normalizePermissionMap(category.defaultPermissions),
      }))
    : [];
  const defaults = asObject(source.defaults) || {};

  return {
    accessLevels: accessLevels.length ? accessLevels : [{ key: 'none' }, { key: 'view' }, { key: 'manage' }],
    features,
    categories,
    defaults: {
      ownerPermissions: normalizePermissionMap(defaults.ownerPermissions),
      legacyStaffPermissions: normalizePermissionMap(defaults.legacyStaffPermissions),
    },
  };
}

export function getCategoryPermissions(meta, categoryKey) {
  const categories = Array.isArray(meta?.categories) ? meta.categories : [];
  const matchedCategory = categories.find((category) => category.key === categoryKey);
  return normalizePermissionMap(matchedCategory?.defaultPermissions);
}

export function normalizeStaffMember(member, meta) {
  const source = asObject(member) || {};
  const user = asObject(source.user) || {};
  const normalizedMeta = normalizeStaffMeta(meta);
  const categoryKey = pickString(source.staffCategory, source.category?.key);
  const category = normalizedMeta.categories.find((item) => item.key === categoryKey);

  return {
    membershipId: pickString(source.membershipId, source.id),
    businessId: pickString(source.businessId),
    role: pickString(source.role, user.role),
    joinedAt: pickString(source.joinedAt) || null,
    updatedAt: pickString(source.updatedAt) || null,
    staffCategory: categoryKey || null,
    category: {
      key: category?.key || categoryKey || null,
      label: pickString(source.category?.label, category?.label, categoryKey) || null,
      description: pickString(source.category?.description, category?.description) || null,
    },
    jobTitle: pickString(source.jobTitle) || null,
    joinedDate: pickString(source.joinedDate, source.joinedAt) || null,
    shift: pickString(source.shift) || null,
    address: pickString(source.address, user.address) || null,
    compensation: pickNumber(source.compensation, source.salary),
    totalReceived: pickNumber(source.totalReceived),
    permissions: normalizePermissionMap(source.permissions),
    user: {
      id: pickString(user.id),
      name: pickString(user.name),
      email: pickString(user.email),
      role: pickString(user.role, source.role),
      phone: pickString(user.phone) || null,
      isActive: user.isActive !== false,
      emailVerified: user.emailVerified === true,
    },
  };
}

export function normalizeStaffCollection(payload) {
  const source = asObject(payload) || {};
  const meta = normalizeStaffMeta(source.meta);

  return {
    summary: normalizeStaffSummary(source.summary),
    meta,
    members: Array.isArray(source.members)
      ? source.members.map((member) => normalizeStaffMember(member, meta))
      : [],
  };
}
