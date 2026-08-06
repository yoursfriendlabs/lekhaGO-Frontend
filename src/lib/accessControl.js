const PERMISSION_KEYS = [
  'dashboard',
  'inventory',
  'sales',
  'services',
  'purchases',
  'quickExpenses',
  'parties',
  'tasks',
  'reports',
  'analytics',
  'settings',
  'staff',
  'banking',
  'tables',
  'orders',
  'billing',
];

const ACCESS_LEVELS = ['none', 'view', 'manage'];
const ACCESS_LEVEL_RANK = { none: 0, view: 1, manage: 2 };

/**
 * Modules that need at least inventory:view to function (POS uses `sales`).
 * Granting any of these auto-grants inventory view; clearing inventory clears these.
 */
const INVENTORY_DEPENDENT_PERMISSION_KEYS = [
  'sales',
  'services',
  'purchases',
  'orders',
  'billing',
];

/** Permission keys hidden from the staff permission editor (not used in standard shops). */
const STAFF_PERMISSION_UI_HIDDEN_KEYS = new Set([
  'analytics',
  'tables',
  'orders',
  'billing',
]);

/** Preferred display order for the staff permission editor. */
const STAFF_PERMISSION_UI_ORDER = [
  'dashboard',
  'inventory',
  'sales',
  'services',
  'purchases',
  'quickExpenses',
  'parties',
  'tasks',
  'reports',
  'banking',
  'staff',
  'settings',
];

const FEATURE_PERMISSION_MAP = {
  dashboard: 'dashboard',
  orders: 'orders',
  inventory: 'inventory',
  sales: 'sales',
  services: 'services',
  purchases: 'purchases',
  quickExpenses: 'quickExpenses',
  parties: 'parties',
  tasks: 'tasks',
  ledger: 'reports',
  reports: 'reports',
  analytics: 'reports',
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
  billing: 'billing',
  tables: 'tables',
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
  return role === 'owner' || role === 'admin' || role === 'super_admin';
}

export function normalizeAccessLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ACCESS_LEVELS.includes(normalized) ? normalized : 'none';
}

function accessLevelRank(level) {
  return ACCESS_LEVEL_RANK[normalizeAccessLevel(level)] ?? 0;
}

export function maxAccessLevel(...levels) {
  return levels.reduce((highest, level) => (
    accessLevelRank(level) > accessLevelRank(highest) ? normalizeAccessLevel(level) : highest
  ), 'none');
}

export function getInventoryDependentPermissionKeys() {
  return [...INVENTORY_DEPENDENT_PERMISSION_KEYS];
}

export function hasInventoryDependentAccess(permissions) {
  const source = normalizePermissionMap(permissions);
  return INVENTORY_DEPENDENT_PERMISSION_KEYS.some(
    (key) => normalizeAccessLevel(source[key]) !== 'none'
  );
}

/**
 * Standard staff permission rows: reports (not analytics), no tables/cafe-only modules.
 */
export function getStaffPermissionUiFeatures(features = []) {
  const byKey = new Map();

  (Array.isArray(features) ? features : []).forEach((feature) => {
    const rawKey = String(feature?.key || '').trim();
    if (!rawKey) return;

    let permissionKey = getPermissionKeyForFeature(rawKey) || rawKey;
    if (permissionKey === 'analytics' || rawKey === 'analytics') {
      permissionKey = 'reports';
    }
    if (rawKey === 'ledger') {
      permissionKey = 'reports';
    }

    if (
      STAFF_PERMISSION_UI_HIDDEN_KEYS.has(permissionKey)
      || STAFF_PERMISSION_UI_HIDDEN_KEYS.has(rawKey)
    ) {
      return;
    }

    if (byKey.has(permissionKey)) return;

    byKey.set(permissionKey, {
      key: permissionKey,
      label: permissionKey === 'reports'
        ? (pickString(feature.label).toLowerCase().includes('report')
          ? pickString(feature.label, 'Reports')
          : 'Reports')
        : pickString(feature.label, permissionKey),
      description: pickString(feature.description),
    });
  });

  const ordered = STAFF_PERMISSION_UI_ORDER
    .map((key) => byKey.get(key))
    .filter(Boolean);

  const extras = [...byKey.keys()]
    .filter((key) => !STAFF_PERMISSION_UI_ORDER.includes(key))
    .map((key) => byKey.get(key))
    .filter(Boolean);

  return [...ordered, ...extras];
}

/**
 * Keep permission maps consistent with inventory dependencies.
 * Any sales/POS/services/purchases/orders/billing access ⇒ inventory at least view.
 */
export function enforcePermissionDependencies(permissions) {
  const next = normalizePermissionMap(permissions);

  if (hasInventoryDependentAccess(next) && normalizeAccessLevel(next.inventory) === 'none') {
    next.inventory = 'view';
  }

  return next;
}

/**
 * Apply a single permission change, then re-enforce inventory dependencies.
 * Clearing inventory explicitly also clears dependent modules.
 */
export function applyPermissionChange(permissions, permissionKey, level) {
  const key = String(permissionKey || '').trim();
  const next = {
    ...normalizePermissionMap(permissions),
  };

  if (!PERMISSION_KEYS.includes(key)) {
    return enforcePermissionDependencies(next);
  }

  next[key] = normalizeAccessLevel(level);

  if (key === 'inventory' && next.inventory === 'none') {
    INVENTORY_DEPENDENT_PERMISSION_KEYS.forEach((dependentKey) => {
      next[dependentKey] = 'none';
    });
    return next;
  }

  return enforcePermissionDependencies(next);
}

export function normalizePermissionMap(permissions) {
  const source = asObject(permissions) || {};

  const normalized = PERMISSION_KEYS.reduce((accumulator, key) => {
    accumulator[key] = normalizeAccessLevel(source[key]);
    return accumulator;
  }, {});

  // Legacy analytics grants now count as reports access.
  normalized.reports = maxAccessLevel(normalized.reports, source.analytics);
  return normalized;
}

export function buildEmptyPermissionMap() {
  return normalizePermissionMap({});
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
    permissions: enforcePermissionDependencies(
      source?.permissions ?? fallbackSource?.permissions ?? null
    ),
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

  const level = normalizeAccessLevel(permissions[permissionKey]);

  // Sales/POS/services (and related) cannot work without inventory view.
  if (
    level !== 'none'
    && INVENTORY_DEPENDENT_PERMISSION_KEYS.includes(permissionKey)
    && normalizeAccessLevel(permissions.inventory) === 'none'
  ) {
    return 'none';
  }

  return level;
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
