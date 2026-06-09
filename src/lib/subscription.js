/**
 * Shared subscription and plan-gating helpers.
 */

const PLAN_DISPLAY_ORDER = ['freemium', 'growth', 'custom'];
const RECOVERY_FEATURES = new Set(['settings', 'subscription', 'profile', 'account']);
const ALL_FEATURES = [
  'dashboard',
  'orders',
  'inventory',
  'sales',
  'services',
  'purchases',
  'parties',
  'ledger',
  'analytics',
  'settings',
  'admin',
  'general-settings',
  'profile',
  'subscription',
  'account',
  'staff',
  'categories',
  'units',
  'banks',
  'order-attributes',
];

const DEFAULT_PLAN_FEATURES = {
  freemium: new Set([
    'dashboard',
    'orders',
    'inventory',
    'sales',
    'services',
    'settings',
    'profile',
    'subscription',
    'account',
  ]),
  growth: new Set(ALL_FEATURES),
  custom: new Set(ALL_FEATURES),
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function normalizeFeatureKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function flattenStringList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenStringList(entry));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value === 'object') {
    const label = pickString(value.title, value.label, value.description, value.message, value.value);
    return label ? [label] : [];
  }

  return [];
}

function normalizeFeatureMap(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

  const mappedEntries = Object.entries(candidate)
    .filter(([, value]) => typeof value === 'boolean')
    .map(([key, value]) => [normalizeFeatureKey(key), value]);

  if (!mappedEntries.length) return null;
  return Object.fromEntries(mappedEntries);
}

function resolveGuardFeatureState(guard, featureKey) {
  const normalizedFeature = normalizeFeatureKey(featureKey);
  const normalizedGuard = asObject(guard);
  const mapCandidates = [
    normalizedGuard.features,
    normalizedGuard.featureAccess,
    normalizedGuard.permissions,
    normalizedGuard.modules,
  ];

  for (const candidate of mapCandidates) {
    const featureMap = normalizeFeatureMap(candidate);
    if (featureMap && Object.prototype.hasOwnProperty.call(featureMap, normalizedFeature)) {
      return featureMap[normalizedFeature];
    }
  }

  const allowList = new Set(
    [
      normalizedGuard.allowedFeatures,
      normalizedGuard.allowFeatures,
      normalizedGuard.availableFeatures,
      normalizedGuard.visibleFeatures,
      normalizedGuard.enabledFeatures,
    ]
      .flatMap((candidate) => flattenStringList(candidate))
      .map(normalizeFeatureKey)
  );

  if (allowList.has(normalizedFeature)) return true;

  const blockList = new Set(
    [
      normalizedGuard.blockedFeatures,
      normalizedGuard.restrictedFeatures,
      normalizedGuard.disabledFeatures,
      normalizedGuard.hiddenFeatures,
      normalizedGuard.lockedFeatures,
    ]
      .flatMap((candidate) => flattenStringList(candidate))
      .map(normalizeFeatureKey)
  );

  if (blockList.has(normalizedFeature)) return false;
  return null;
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;

  return {
    ...plan,
    isTrial: Boolean(plan.isTrial),
    trial: normalizeTrial(plan.trial),
    subscriptionStatus: pickString(plan.subscriptionStatus, plan.billingStatus),
    daysUntilSubscriptionEnd: pickNumber(plan.daysUntilSubscriptionEnd),
    billingOptions: Array.isArray(plan.billingOptions) ? plan.billingOptions : [],
  };
}

function normalizeTrial(trial) {
  if (!trial || typeof trial !== 'object') return null;

  return {
    ...trial,
    durationMonths: pickNumber(trial.durationMonths),
    startsAt: pickString(trial.startsAt),
    endsAt: pickString(trial.endsAt),
    status: pickString(trial.status),
    daysRemaining: pickNumber(trial.daysRemaining),
    hasEnded: pickBoolean(trial.hasEnded, pickString(trial.status).toLowerCase() === 'expired') ?? false,
  };
}

function hasActiveTrialAccess(currentPlan, access) {
  return Boolean(
    currentPlan?.isTrial
    && currentPlan?.trial
    && currentPlan.trial.hasEnded === false
    && access?.canUseApplication !== false
  );
}

export function humanizeKey(value = '') {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

export function normalizeSubscriptionAccess(access, subscription = null) {
  const source = asObject(access);
  const currentPlan = subscription?.currentPlan || null;
  const pendingChange = subscription?.pendingChange || null;
  const guardDetails = asObject(source.guardDetails) || asObject(source.guard);
  const guard = pickString(source.guard, source.guardKey, guardDetails?.key, guardDetails?.code, guardDetails?.type);
  const planKey = pickString(source.planKey, currentPlan?.key, pendingChange?.key);
  const subscriptionStatus = pickString(
    source.subscriptionStatus,
    currentPlan?.subscriptionStatus,
    currentPlan?.billingStatus,
    pendingChange?.paymentProviderStatus
  );

  return {
    canUseApplication: pickBoolean(source.canUseApplication, subscriptionStatus ? subscriptionStatus !== 'expired' : true) ?? true,
    hasPendingChange: pickBoolean(source.hasPendingChange, Boolean(pendingChange)) ?? Boolean(pendingChange),
    requiresPaymentSetup:
      pickBoolean(source.requiresPaymentSetup, pendingChange?.paymentProviderStatus === 'pending_setup') ?? false,
    requiresManualReview:
      pickBoolean(source.requiresManualReview, pendingChange?.paymentProviderStatus === 'quote_required') ?? false,
    planKey,
    subscriptionStatus,
    guard,
    guardDetails,
  };
}

function normalizeSubscriptionInput(subscriptionOrAccess) {
  const source = asObject(subscriptionOrAccess);
  if (!source) return null;

  const looksLikeSubscriptionPayload =
    Object.prototype.hasOwnProperty.call(source, 'access')
    || Object.prototype.hasOwnProperty.call(source, 'currentPlan')
    || Object.prototype.hasOwnProperty.call(source, 'availablePlans')
    || Object.prototype.hasOwnProperty.call(source, 'pendingChange')
    || Object.prototype.hasOwnProperty.call(source, 'paymentIntegration')
    || Object.prototype.hasOwnProperty.call(source, 'businessId');

  if (looksLikeSubscriptionPayload) {
    return normalizeSubscriptionPayload(source);
  }

  return {
    access: normalizeSubscriptionAccess(source),
    currentPlan: null,
    pendingChange: null,
    availablePlans: [],
    paymentIntegration: null,
    businessId: '',
  };
}

export function normalizeSubscriptionPayload(payload, context = {}) {
  if (!payload || typeof payload !== 'object') return null;

  const source = asObject(payload);
  const business = asObject(context.business);
  const currentPlan = normalizePlan(source.currentPlan);
  const pendingChange = normalizePlan(source.pendingChange);
  const paymentIntegration = source.paymentIntegration && typeof source.paymentIntegration === 'object'
    ? source.paymentIntegration
    : null;

  const normalized = {
    ...source,
    businessId: pickString(source.businessId, context.businessId, business.id),
    currentPlan,
    pendingChange,
    paymentIntegration,
    availablePlans: Array.isArray(source.availablePlans)
      ? source.availablePlans.map((plan) => normalizePlan(plan)).filter(Boolean)
      : [],
  };

  const access = normalizeSubscriptionAccess(source.access, normalized);
  const recoveredBusinessContext = access.guard === 'business_missing' && Boolean(normalized.businessId);

  return {
    ...normalized,
    access: recoveredBusinessContext
      ? {
        ...access,
        canUseApplication: true,
      }
      : access,
  };
}

export function normalizePaymentSetupPayload(payload) {
  const source = asObject(payload);

  return {
    ...source,
    configuration: {
      ...asObject(source.configuration),
      configured: Boolean(source?.configuration?.configured),
    },
    missingEnvKeys: flattenStringList(source.missingEnvKeys),
    currentStatus: pickString(source.currentStatus, source.status),
    nextSteps: flattenStringList(source.nextSteps),
    checkoutUrl: pickString(source.checkoutUrl, source?.configuration?.checkoutUrl),
  };
}

export function sortAvailablePlans(plans = []) {
  return [...plans].sort((left, right) => {
    const leftIndex = PLAN_DISPLAY_ORDER.indexOf(normalizeFeatureKey(left?.key));
    const rightIndex = PLAN_DISPLAY_ORDER.indexOf(normalizeFeatureKey(right?.key));

    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
}

export function getPreferredBillingCycle(plan, currentPlan, pendingChange) {
  const availableCycles = Array.isArray(plan?.billingOptions)
    ? plan.billingOptions.map((option) => option.cycle).filter(Boolean)
    : [];

  const preferredCycle = pendingChange?.key === plan?.key
    ? pendingChange?.billingCycle
    : currentPlan?.key === plan?.key
      ? currentPlan?.billingCycle
      : availableCycles[0];

  if (preferredCycle && availableCycles.includes(preferredCycle)) {
    return preferredCycle;
  }

  return availableCycles[0] || '';
}

export function getSubscriptionGuard(subscriptionOrAccess) {
  const normalized = normalizeSubscriptionInput(subscriptionOrAccess);
  const access = normalized?.access || normalizeSubscriptionAccess(subscriptionOrAccess);
  const guard = asObject(access.guardDetails);

  return {
    ...guard,
    key: access.guard,
    title: pickString(guard.title),
    description: pickString(guard.description, guard.message, guard.reason),
    actionLabel: pickString(guard.actionLabel, guard.ctaLabel),
    checkoutUrl: pickString(guard.checkoutUrl, guard.paymentUrl, guard.url),
    recommendedPlanKey: pickString(guard.planKey, guard.recommendedPlan, access.planKey === 'freemium' ? 'growth' : ''),
  };
}

export function canAccessFeature(subscriptionOrAccess, featureKey) {
  const normalizedFeature = normalizeFeatureKey(featureKey);
  if (!normalizedFeature) return true;

  const normalized = normalizeSubscriptionInput(subscriptionOrAccess);
  const access = normalized?.access || normalizeSubscriptionAccess(subscriptionOrAccess);
  const currentPlan = normalized?.currentPlan || null;

  if (hasActiveTrialAccess(currentPlan, access)) {
    return true;
  }

  if (access.canUseApplication === false && !RECOVERY_FEATURES.has(normalizedFeature)) {
    return false;
  }

  const guardDecision = resolveGuardFeatureState(access.guardDetails, normalizedFeature);
  if (typeof guardDecision === 'boolean') return guardDecision;

  const featureSet = DEFAULT_PLAN_FEATURES[normalizeFeatureKey(access.planKey)];
  if (featureSet) return featureSet.has(normalizedFeature);

  return true;
}

export function getSubscriptionStatusState(subscriptionOrAccess) {
  const normalized = normalizeSubscriptionInput(subscriptionOrAccess);
  const access = normalized?.access || normalizeSubscriptionAccess(subscriptionOrAccess);
  const currentPlan = normalized?.currentPlan || null;
  const trial = currentPlan?.isTrial ? normalizeTrial(currentPlan?.trial) : null;
  const isTrialActive = hasActiveTrialAccess(
    currentPlan ? { ...currentPlan, trial } : currentPlan,
    access
  );
  const isTrialExpiringSoon = isTrialActive && typeof trial?.daysRemaining === 'number' && trial.daysRemaining <= 7;
  const isExpired = access.canUseApplication === false && access.guard === 'subscription_expired';

  return {
    access,
    currentPlan,
    trial,
    isTrialActive,
    isTrialExpiringSoon,
    isExpired,
    kind: isExpired
      ? 'expired'
      : isTrialExpiringSoon
        ? 'trial-expiring'
        : isTrialActive
          ? 'trial'
          : 'none',
  };
}
