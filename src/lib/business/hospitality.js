/**
 * Feature gates for restaurant add-on and hotel business type.
 * Standard / retail shops must never see or call these APIs.
 */

const HOTEL_TYPE_ALIASES = new Set([
  'hotel',
  'resort',
  'lodge',
  'guesthouse',
  'guest_house',
  'homestay',
  'motel',
  'inn',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function resolveCanonicalBusinessType(type) {
  const normalized = normalizeType(type);
  if (!normalized) return 'retail';
  if (HOTEL_TYPE_ALIASES.has(normalized)) return 'hotel';
  return normalized;
}

export function isHotelBusinessType(type) {
  return resolveCanonicalBusinessType(type) === 'hotel';
}

export function isHotelBusiness(profile) {
  if (!profile) return false;
  if (profile.modules?.hotel === true) return true;
  return isHotelBusinessType(profile.type || profile.business?.type);
}

export function getBusinessAddons(profile) {
  const raw = profile?.addons ?? profile?.business?.addons ?? profile?.settings?.addons;
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => String(key || '').trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

/**
 * Restaurant orders / kitchen / recipes. Platform admin switches this on;
 * Standard shops never get it.
 */
export function hasRestaurantAddon(profile) {
  if (!profile) return false;
  const addons = getBusinessAddons(profile);
  if (addons.includes('restaurant')) return true;
  // Backend may only flip modules when the add-on is active.
  return (
    profile.modules?.kitchen === true
    || profile.modules?.recipes === true
  );
}

export function canUseRestaurantApis(profile) {
  return hasRestaurantAddon(profile);
}

export function canUseHotelApis(profile) {
  return isHotelBusiness(profile);
}

export function showServiceChargeSettings(profile) {
  if (!profile) return false;
  if (isHotelBusiness(profile)) return true;
  const type = normalizeType(profile.type || profile.business?.type);
  return type === 'cafe' || type === 'hospitality' || hasRestaurantAddon(profile);
}

export function listHotelTypeAliases() {
  return [...HOTEL_TYPE_ALIASES];
}

export function hasAddon(profile, addonKey) {
  const key = String(addonKey || '').trim().toLowerCase();
  if (!key) return false;
  return getBusinessAddons(profile).includes(key);
}

export function pickBackendMessage(error, fallback = 'Request failed') {
  const message = error?.payload?.message || error?.message || fallback;
  return String(message || fallback);
}

export function extractConflictIds(error) {
  const payload = error?.payload && typeof error.payload === 'object' ? error.payload : {};
  return {
    orderId: payload.orderId || null,
    stayId: payload.stayId || null,
    code: payload.code || null,
    message: pickBackendMessage(error),
  };
}

export function normalizeStockWarnings(payload) {
  const warnings = payload?.stockWarnings || payload?.warnings;
  return asArray(warnings).filter(Boolean);
}
