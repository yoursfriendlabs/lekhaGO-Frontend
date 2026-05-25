const PERMISSION_KEYS = [
  'dashboard',
  'inventory',
  'sales',
  'services',
  'purchases',
  'parties',
  'reports',
  'analytics',
  'settings',
  'staff',
  'banking',
];

const ACCESS_LEVELS = ['none', 'view', 'manage'];

const FEATURE_PERMISSION_MAP = {
  dashboard: 'dashboard',
  orders: 'sales',
  inventory: 'inventory',
  sales: 'sales',
  services: 'services',
  purchases: 'purchases',
  parties: 'parties',
  ledger: 'reports',
  analytics: 'analytics',
  settings: 'settings',
  'general-settings': 'settings',
  categories: 'settings',
  units: 'settings',
  'order-attributes': 'settings',
  profile: 'settings',
  subscription: 'settings',
  account: 'settings',
  staff: 'staff',
  banks: 'banking',
};

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

export function isElevatedAccessRole(role = '') {
  return role === 'admin' || role === 'super_admin';
}

export function normalizeAccessLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ACCESS_LEVELS.includes(normalized) ? normalized : 'none';
}

export function normalizePermissionMap(permissions) {
  const source = asObject(permissions) || {};

  return PERMISSION_KEYS.reduce((accumulator, key) => {
    accumulator[key] = normalizeAccessLevel(source[key]);
    return accumulator;
  }, {});
}

export function normalizeAccessControl(accessControl, fallback = {}) {
  const source = asObject(accessControl);
  const fallbackSource = asObject(fallback);

  if (!source && !fallbackSource) return null;

  const categorySource = asObject(source?.category) || asObject(fallbackSource?.category);

  return {
    membershipId: pickString(source?.membershipId, fallbackSource?.membershipId) || null,
    businessId: pickString(source?.businessId, fallbackSource?.businessId) || null,
    role: pickString(source?.role, fallbackSource?.role) || null,
    joinedAt: pickString(source?.joinedAt, fallbackSource?.joinedAt) || null,
    updatedAt: pickString(source?.updatedAt, fallbackSource?.updatedAt) || null,
    staffCategory: pickString(source?.staffCategory, fallbackSource?.staffCategory) || null,
    category: categorySource
      ? {
        key: pickString(categorySource.key) || null,
        label: pickString(categorySource.label) || null,
        description: pickString(categorySource.description) || null,
      }
      : null,
    jobTitle: pickString(source?.jobTitle, fallbackSource?.jobTitle) || null,
    permissions: normalizePermissionMap(source?.permissions ?? fallbackSource?.permissions ?? null),
  };
}

export function getPermissionKeyForFeature(featureKey = '') {
  return FEATURE_PERMISSION_MAP[featureKey] || null;
}

export function getFeatureAccessLevel(accessControl, featureKey, fallbackRole = '') {
  if (isElevatedAccessRole(fallbackRole) || isElevatedAccessRole(accessControl?.role)) {
    return 'manage';
  }

  const permissionKey = getPermissionKeyForFeature(featureKey);
  if (!permissionKey) return null;

  const permissions = accessControl?.permissions;
  if (!permissions || typeof permissions !== 'object') return null;

  return normalizeAccessLevel(permissions[permissionKey]);
}

export function canViewFeature(accessControl, featureKey, fallbackRole = '') {
  const level = getFeatureAccessLevel(accessControl, featureKey, fallbackRole);
  return level === null ? null : level !== 'none';
}

export function canManageFeature(accessControl, featureKey, fallbackRole = '') {
  const level = getFeatureAccessLevel(accessControl, featureKey, fallbackRole);
  return level === null ? null : level === 'manage';
}

export function getManagedFeatureKeys() {
  return [...PERMISSION_KEYS];
}
