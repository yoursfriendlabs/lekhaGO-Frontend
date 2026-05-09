import { normalizeBusinessProfile } from './businessProfile';
import { normalizeSubscriptionPayload } from './subscription';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * Normalizes backend auth payloads so login/register bootstrap and /auth/me
 * responses can all hydrate the same auth store safely.
 */
export function normalizeSessionPayload(payload = {}, fallback = {}) {
  const source = asObject(payload) || {};
  const fallbackSource = asObject(fallback) || {};
  const business = asObject(source.business) || asObject(fallbackSource.business);
  const businessId = pickString(source.businessId, business?.id, fallbackSource.businessId, fallbackSource.business?.id);
  const businessProfileSource =
    source.businessProfile
    ?? business?.profile
    ?? fallbackSource.businessProfile
    ?? fallbackSource.business?.profile
    ?? null;
  const normalizedProfileSource = asObject(businessProfileSource);
  const role = pickString(source.role, source.user?.role, fallbackSource.role, fallbackSource.user?.role);
  const userSource = asObject(source.user) || asObject(fallbackSource.user);
  const user = userSource ? { ...userSource, ...(role ? { role } : {}) } : null;
  const businessProfile = normalizedProfileSource
    ? normalizeBusinessProfile({
      ...normalizedProfileSource,
      business: business || normalizedProfileSource?.business || null,
    })
    : null;

  return {
    token: pickString(source.token, fallbackSource.token),
    user,
    role,
    businessId,
    business: business || null,
    businessProfile,
    subscription: normalizeSubscriptionPayload(source.subscription ?? fallbackSource.subscription ?? null, {
      businessId,
      business,
    }),
  };
}
