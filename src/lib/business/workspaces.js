export const EXTRA_BUSINESS_TYPES = Object.freeze(['retail', 'cafe']);
export const PERSONAL_WORKSPACE_TYPE = 'personal';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

export function normalizeWorkspace(item) {
  const source = asObject(item);
  if (!source) return null;

  const id = pickString(source.id, source.businessId);
  if (!id) return null;

  const type = pickString(source.type).toLowerCase();
  const role = pickString(source.role) || 'staff';
  const isPersonal = source.isPersonal === true || type === PERSONAL_WORKSPACE_TYPE || type === 'household';

  return {
    id,
    businessId: pickString(source.businessId) || id,
    membershipId: pickString(source.membershipId) || null,
    name: pickString(source.name) || 'Workspace',
    type: type || 'retail',
    label: pickString(source.label) || (isPersonal ? 'Personal' : type),
    role,
    isOwner: source.isOwner === true || role === 'owner',
    isPersonal,
    isActive: source.isActive !== false,
  };
}

export function sortWorkspaces(items = []) {
  return [...items].sort((left, right) => {
    if (left.isPersonal !== right.isPersonal) return left.isPersonal ? -1 : 1;
    if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
    return String(left.name || '').localeCompare(String(right.name || ''));
  });
}

export function normalizeWorkspaceList(value) {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.businesses)
        ? value.businesses
        : [];

  return sortWorkspaces(raw.map(normalizeWorkspace).filter(Boolean));
}

export function resolveWorkspaceCreationOptions(items = []) {
  const owned = items.filter((item) => item.isOwner);
  const hasPersonal = owned.some((item) => item.isPersonal);
  const hasBusiness = owned.some((item) => !item.isPersonal);

  if (hasPersonal && hasBusiness) {
    return {
      canCreateWorkspace: false,
      canCreateBusiness: false,
      canCreatePersonal: false,
      creatableWorkspaceTypes: [],
      extraBusinessTypes: [],
    };
  }

  if (hasBusiness && !hasPersonal) {
    return {
      canCreateWorkspace: true,
      canCreateBusiness: false,
      canCreatePersonal: true,
      creatableWorkspaceTypes: [PERSONAL_WORKSPACE_TYPE],
      extraBusinessTypes: [],
    };
  }

  if (hasPersonal && !hasBusiness) {
    return {
      canCreateWorkspace: true,
      canCreateBusiness: true,
      canCreatePersonal: false,
      creatableWorkspaceTypes: [...EXTRA_BUSINESS_TYPES],
      extraBusinessTypes: [...EXTRA_BUSINESS_TYPES],
    };
  }

  return {
    canCreateWorkspace: false,
    canCreateBusiness: false,
    canCreatePersonal: false,
    creatableWorkspaceTypes: [],
    extraBusinessTypes: [],
  };
}

export function normalizeWorkspacePayload(payload = {}) {
  const source = asObject(payload) || {};
  const items = normalizeWorkspaceList(source.items || source.businesses || source);
  const computed = resolveWorkspaceCreationOptions(items);
  const creatableWorkspaceTypes = Array.isArray(source.creatableWorkspaceTypes)
    ? source.creatableWorkspaceTypes.map((type) => String(type || '').trim()).filter(Boolean)
    : computed.creatableWorkspaceTypes;
  const extraBusinessTypes = Array.isArray(source.extraBusinessTypes) && source.extraBusinessTypes.length
    ? source.extraBusinessTypes.map((type) => String(type || '').trim()).filter(Boolean)
    : creatableWorkspaceTypes.filter((type) => type !== PERSONAL_WORKSPACE_TYPE);

  return {
    items,
    canCreateWorkspace: toBoolean(source.canCreateWorkspace, computed.canCreateWorkspace),
    canCreateBusiness: toBoolean(source.canCreateBusiness, computed.canCreateBusiness),
    canCreatePersonal: toBoolean(source.canCreatePersonal, computed.canCreatePersonal),
    creatableWorkspaceTypes,
    extraBusinessTypes,
  };
}

export function pickWorkspaceFields(payload) {
  const source = asObject(payload);
  if (!source) return null;
  if (
    !('items' in source)
    && !('businesses' in source)
    && !('canCreateBusiness' in source)
    && !('canCreateWorkspace' in source)
    && !('creatableWorkspaceTypes' in source)
  ) {
    return null;
  }
  return normalizeWorkspacePayload(source);
}

export function findWorkspace(items, businessId) {
  const id = pickString(businessId);
  if (!id) return null;
  return (items || []).find((item) => item.id === id || item.businessId === id) || null;
}

export function getDefaultCreatableWorkspaceType(creatableWorkspaceTypes = []) {
  return creatableWorkspaceTypes[0] || EXTRA_BUSINESS_TYPES[0];
}

export function isPersonalWorkspaceType(type) {
  return String(type || '').toLowerCase() === PERSONAL_WORKSPACE_TYPE;
}
