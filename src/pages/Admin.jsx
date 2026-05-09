import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  CreditCard,
  KeyRound,
  Package2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Notice from '../components/Notice';
import PageHeader from '../components/PageHeader';
import { formatMaybeDate, formatMaybeDateTime, todayISODate } from '../lib/datetime';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import { api } from '../lib/api';
import { normalizeSubscriptionPayload } from '../lib/subscription';
import { ACCOUNT_SETTINGS_TAB, STAFF_SETTINGS_TAB, buildSettingsTabPath } from '../lib/settingsTabs';

const EMPTY_SUMMARY = Object.freeze({
  maxUsers: 0,
  totalUsers: 0,
  availableSlots: 0,
});

const PLAN_DISPLAY_ORDER = ['freemium', 'growth', 'custom'];

function humanizeKey(value = '') {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function getUserInitials(user) {
  const source = user?.name || user?.email || '';
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase() || 'U';
}

function formatFieldValue(value, t) {
  if (value === null || value === undefined || value === '') {
    return t('adminPage.fallback.na');
  }

  if (typeof value === 'boolean') {
    return value ? t('common.yes') : t('common.no');
  }

  if (Array.isArray(value)) {
    const printableValues = value
      .map((item) => {
        if (item === null || item === undefined || item === '') return null;
        if (typeof item === 'object') return JSON.stringify(item);
        return String(item);
      })
      .filter(Boolean);

    return printableValues.length ? printableValues.join(', ') : t('adminPage.fallback.na');
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return t('adminPage.fallback.unknown');
    }
  }

  return String(value);
}

function resolveTranslatedValue(t, key, fallback) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

function resolveSubscriptionLabel(t, group, value) {
  if (value === null || value === undefined || value === '') {
    return t('adminPage.fallback.na');
  }

  return resolveTranslatedValue(t, `adminPage.plan.${group}.${value}`, humanizeKey(value));
}

function formatMoney(value, t) {
  if (value === null || value === undefined || value === '') {
    return t('adminPage.fallback.na');
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);

  return t('currency.formatted', {
    symbol: t('currency.symbol'),
    amount: numeric.toFixed(2),
  });
}

function formatDaysRemaining(value, t) {
  if (value === null || value === undefined || value === '') {
    return t('adminPage.fallback.na');
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (numeric < 0) return t('adminPage.plan.daysRemainingExpired', { count: Math.abs(numeric) });
  if (numeric === 0) return t('adminPage.plan.daysRemainingToday');
  return t('adminPage.plan.daysRemainingValue', { count: numeric });
}

function getStatusTone(status = '') {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'paid':
      return 'emerald';
    case 'free':
      return 'blue';
    case 'expiring-soon':
    case 'pending':
    case 'pending_setup':
      return 'amber';
    case 'expired':
    case 'overdue':
      return 'rose';
    case 'upcoming':
    case 'quote_required':
      return 'blue';
    default:
      return 'slate';
  }
}

function sortAvailablePlans(plans = []) {
  return [...plans].sort((left, right) => {
    const leftIndex = PLAN_DISPLAY_ORDER.indexOf(left?.key);
    const rightIndex = PLAN_DISPLAY_ORDER.indexOf(right?.key);

    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
}

function getPreferredBillingCycle(plan, currentPlan, pendingChange) {
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

function getPlanSupportNote(plan, paymentIntegration, t) {
  if (plan?.key === 'freemium') return t('adminPage.plan.planNotes.freemium');
  if (plan?.key === 'growth') {
    return paymentIntegration?.message || t('adminPage.plan.planNotes.growth');
  }
  return t('adminPage.plan.planNotes.custom');
}

function getPlanActionLabel(plan, { isCurrentPlan, isPendingPlan, t }) {
  if (isCurrentPlan) return t('adminPage.plan.currentPlanCta');
  if (isPendingPlan) return t('adminPage.plan.pendingPlanCta');
  if (plan?.key === 'freemium') return t('adminPage.plan.activateFreemium');
  if (plan?.key === 'growth') return t('adminPage.plan.requestGrowth');
  return t('adminPage.plan.requestCustom');
}

function getPlanPriceLabel(plan, billingOption, t) {
  if (plan?.key === 'freemium') return t('adminPage.plan.priceLabels.freeForever');

  if (billingOption?.amountConfigured && billingOption?.amount !== null && billingOption?.amount !== undefined) {
    return formatMoney(billingOption.amount, t);
  }

  return t('adminPage.plan.priceLabels.onRequest');
}

function StatusPill({ label, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
    blue: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>
      {label}
    </span>
  );
}

function StatCard({ eyebrow, value, caption, icon: Icon, tone = 'slate' }) {
  const toneClasses = {
    emerald: 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200',
    amber: 'border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200',
    blue: 'border-sky-200/70 bg-sky-50/80 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-200',
    rose: 'border-rose-200/70 bg-rose-50/80 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-200',
    slate: 'border-slate-200/70 bg-white/80 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClasses[tone] || toneClasses.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">{eyebrow}</p>
          <p className="mt-3 break-words text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{caption}</p>
        </div>
        <div className="rounded-2xl bg-white/80 p-3 shadow-sm dark:bg-slate-950/70">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function DetailCard({ title, subtitle, children, action }) {
  return (
    <div className="card space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-xl text-slate-900 dark:text-white">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ fields }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <div
          key={field.label}
          className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{field.label}</p>
          <p className="mt-2 break-words text-sm font-medium text-slate-700 dark:text-slate-200">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const { businessId, role, subscription, updateSubscription, user } = useAuth();
  const { settings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [subscriptionData, setSubscriptionData] = useState(() => normalizeSubscriptionPayload(subscription));
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionNotice, setSubscriptionNotice] = useState({ type: 'info', message: '' });
  const [subscriptionActionKey, setSubscriptionActionKey] = useState('');
  const [planSelections, setPlanSelections] = useState({});

  const tabs = useMemo(() => ([
    {
      key: 'overview',
      label: t('adminPage.tabs.overview'),
      description: t('adminPage.descriptions.overview'),
    },
    {
      key: 'plan',
      label: t('adminPage.tabs.plan'),
      description: t('adminPage.descriptions.plan'),
    },
    {
      key: 'current-user',
      label: t('adminPage.tabs.currentUser'),
      description: t('adminPage.descriptions.currentUser'),
    },
  ]), [t]);

  const syncSubscription = useCallback((payload) => {
    const nextSubscription = normalizeSubscriptionPayload(payload);
    setSubscriptionData(nextSubscription);
    updateSubscription(nextSubscription);
    return nextSubscription;
  }, [updateSubscription]);

  const loadStaffSnapshot = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      setSummary(EMPTY_SUMMARY);
      setMembers([]);
      setLoadError('');
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const data = await api.listStaff();
      setSummary(data?.summary || EMPTY_SUMMARY);
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (error) {
      setSummary(EMPTY_SUMMARY);
      setMembers([]);
      setLoadError(error.message || t('auth.errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  const loadSubscription = useCallback(async ({ showSpinner = true } = {}) => {
    if (!businessId) {
      setSubscriptionLoading(false);
      syncSubscription(null);
      setSubscriptionError('');
      return null;
    }

    if (showSpinner) {
      setSubscriptionLoading(true);
    }
    setSubscriptionError('');

    try {
      const data = await api.getSubscription();
      return syncSubscription(data);
    } catch (error) {
      setSubscriptionError(error.message || t('auth.errors.generic'));
      return null;
    } finally {
      if (showSpinner) {
        setSubscriptionLoading(false);
      }
    }
  }, [businessId, syncSubscription, t]);

  useEffect(() => {
    const nextSubscription = normalizeSubscriptionPayload(subscription);
    if (nextSubscription && (!businessId || nextSubscription.businessId === businessId)) {
      setSubscriptionData(nextSubscription);
    }
  }, [businessId, subscription]);

  useEffect(() => {
    if (!businessId) {
      setSubscriptionNotice({ type: 'info', message: '' });
      return;
    }

    loadStaffSnapshot();
    loadSubscription();
  }, [businessId, loadStaffSnapshot, loadSubscription]);

  useEffect(() => {
    const availablePlans = subscriptionData?.availablePlans;
    if (!Array.isArray(availablePlans) || availablePlans.length === 0) return;

    setPlanSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };
      let changed = false;

      sortAvailablePlans(availablePlans).forEach((plan) => {
        const preferredCycle = getPreferredBillingCycle(
          plan,
          subscriptionData?.currentPlan,
          subscriptionData?.pendingChange
        );
        const availableCycles = Array.isArray(plan.billingOptions)
          ? plan.billingOptions.map((option) => option.cycle)
          : [];

        if (!availableCycles.length) return;

        if (!nextSelections[plan.key] || !availableCycles.includes(nextSelections[plan.key])) {
          nextSelections[plan.key] = preferredCycle || availableCycles[0];
          changed = true;
        }
      });

      return changed ? nextSelections : currentSelections;
    });
  }, [subscriptionData]);

  const requestedTab = searchParams.get('tab');
  const defaultTab = tabs[0]?.key || 'overview';
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : defaultTab;
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  const currentPlan = subscriptionData?.currentPlan || null;
  const pendingChange = subscriptionData?.pendingChange || null;
  const paymentIntegration = subscriptionData?.paymentIntegration || null;
  const orderedPlans = useMemo(
    () => sortAvailablePlans(subscriptionData?.availablePlans || []),
    [subscriptionData?.availablePlans]
  );
  const hasPendingChange = Boolean(pendingChange);

  const seatUsagePercent = summary.maxUsers > 0
    ? Math.min(100, Math.round((summary.totalUsers / summary.maxUsers) * 100))
    : 0;

  const businessName = settings?.companyName || user?.businessName || t('adminPage.plan.noBusinessName');
  const isEmailVerified = user?.emailVerified === true;
  const isEmailPending = user?.emailVerified === false;
  const sessionRole = user?.role || role || t('adminPage.fallback.unknown');
  const accountStatus = user?.isActive === false ? t('adminPage.status.inactive') : t('adminPage.status.active');
  const accountHealth = isEmailPending ? t('adminPage.overview.attention') : t('adminPage.overview.healthy');

  const standardUserFields = useMemo(() => ([
    { label: t('auth.name'), value: formatFieldValue(user?.name, t) },
    { label: t('auth.emailAddress'), value: formatFieldValue(user?.email, t) },
    { label: t('adminPage.currentUser.role'), value: formatFieldValue(sessionRole, t) },
    { label: t('adminPage.currentUser.businessId'), value: formatFieldValue(businessId, t) },
    { label: t('adminPage.currentUser.userId'), value: formatFieldValue(user?.userId || user?.id, t) },
    { label: t('adminPage.currentUser.phone'), value: formatFieldValue(user?.phone, t) },
    {
      label: t('adminPage.currentUser.emailVerification'),
      value: isEmailVerified
        ? t('auth.emailVerified')
        : isEmailPending
          ? t('auth.emailVerificationPending')
          : t('adminPage.fallback.unknown'),
    },
    { label: t('adminPage.currentUser.accountStatus'), value: accountStatus },
    {
      label: t('adminPage.currentUser.createdAt'),
      value: user?.createdAt ? formatMaybeDateTime(user.createdAt) : t('adminPage.fallback.na'),
    },
    {
      label: t('adminPage.currentUser.updatedAt'),
      value: user?.updatedAt ? formatMaybeDateTime(user.updatedAt) : t('adminPage.fallback.na'),
    },
  ]), [accountStatus, businessId, isEmailPending, isEmailVerified, sessionRole, t, user]);

  const extraUserFields = useMemo(() => {
    const hiddenKeys = new Set([
      'name',
      'email',
      'role',
      'userId',
      'id',
      'phone',
      'emailVerified',
      'isActive',
      'createdAt',
      'updatedAt',
      'businessId',
      'businessName',
    ]);

    return Object.entries(user || {})
      .filter(([key, value]) => !hiddenKeys.has(key) && value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        label: humanizeKey(key),
        value: formatFieldValue(value, t),
      }));
  }, [t, user]);

  const planStatusValue = currentPlan?.label || (businessId ? t('adminPage.fallback.na') : t('adminPage.plan.statusNeedsBusiness'));
  const planStatusCaption = currentPlan
    ? [
        resolveSubscriptionLabel(t, 'subscriptionStatusLabels', currentPlan.subscriptionStatus),
        resolveSubscriptionLabel(t, 'billingStatusLabels', currentPlan.billingStatus),
      ].join(' · ')
    : t('adminPage.overview.syncDesc');

  const currentPlanFields = currentPlan ? [
    { label: t('adminPage.plan.currentPlanFields.package'), value: currentPlan.label || t('adminPage.fallback.na') },
    {
      label: t('adminPage.plan.currentPlanFields.billingCycle'),
      value: resolveSubscriptionLabel(t, 'billingCycleLabels', currentPlan.billingCycle),
    },
    {
      label: t('adminPage.plan.currentPlanFields.billingAmount'),
      value: formatMoney(currentPlan.billingAmount, t),
    },
    {
      label: t('adminPage.plan.currentPlanFields.billingStatus'),
      value: resolveSubscriptionLabel(t, 'billingStatusLabels', currentPlan.billingStatus),
    },
    {
      label: t('adminPage.plan.currentPlanFields.subscriptionStatus'),
      value: resolveSubscriptionLabel(t, 'subscriptionStatusLabels', currentPlan.subscriptionStatus),
    },
    {
      label: t('adminPage.plan.currentPlanFields.startDate'),
      value: currentPlan.subscriptionStartDate
        ? formatMaybeDate(currentPlan.subscriptionStartDate, 'D MMM YYYY')
        : t('adminPage.fallback.na'),
    },
    {
      label: t('adminPage.plan.currentPlanFields.endDate'),
      value: currentPlan.subscriptionEndDate
        ? formatMaybeDate(currentPlan.subscriptionEndDate, 'D MMM YYYY')
        : t('adminPage.plan.noEndDate'),
    },
    {
      label: t('adminPage.plan.currentPlanFields.daysRemaining'),
      value: currentPlan.daysUntilSubscriptionEnd === null
        ? t('adminPage.fallback.na')
        : formatDaysRemaining(currentPlan.daysUntilSubscriptionEnd, t),
    },
  ] : [];

  const handleTabChange = (tab) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!tab || tab === defaultTab) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }

    setSearchParams(nextParams);
  };

  const handleRefreshSubscription = async () => {
    setSubscriptionNotice({ type: 'info', message: '' });
    await loadSubscription();
  };

  const handleCancelPendingChange = async () => {
    setSubscriptionActionKey('cancel');
    setSubscriptionNotice({ type: 'info', message: '' });

    try {
      const response = await api.updateSubscription({ clearPendingChange: true });
      syncSubscription(response);
      setSubscriptionNotice({
        type: 'success',
        message: response?.message || t('adminPage.plan.pendingCancelled'),
      });
    } catch (error) {
      setSubscriptionNotice({
        type: 'error',
        message: error.message || t('auth.errors.generic'),
      });
    } finally {
      setSubscriptionActionKey('');
    }
  };

  const handlePlanChange = async (plan) => {
    if (!businessId) {
      setSubscriptionNotice({ type: 'error', message: t('adminPage.plan.noBusinessNotice') });
      return;
    }

    const selectedCycle = planSelections[plan.key] || getPreferredBillingCycle(plan, currentPlan, pendingChange);
    const selectedOption = Array.isArray(plan.billingOptions)
      ? plan.billingOptions.find((option) => option.cycle === selectedCycle) || null
      : null;
    const payload = plan.key === 'freemium'
      ? {
          plan: 'freemium',
          subscriptionStartDate: todayISODate(),
        }
      : {
          plan: plan.key,
          billingCycle: selectedCycle || (plan.key === 'custom' ? 'custom' : 'monthly'),
          ...(selectedOption?.amountConfigured && selectedOption?.amount !== null
            ? { billingAmount: selectedOption.amount }
            : {}),
        };

    setSubscriptionActionKey(plan.key);
    setSubscriptionNotice({ type: 'info', message: '' });

    try {
      const response = await api.updateSubscription(payload);
      syncSubscription(response);
      setSubscriptionNotice({
        type: 'success',
        message: response?.message || t('adminPage.plan.changeSaved'),
      });
    } catch (error) {
      setSubscriptionNotice({
        type: 'error',
        message: error.message || t('auth.errors.generic'),
      });
    } finally {
      setSubscriptionActionKey('');
    }
  };

  const pendingDescription = pendingChange
    ? t('adminPage.plan.pendingDescription', {
        plan: pendingChange.label || humanizeKey(pendingChange.key),
        date: pendingChange.requestedAt
          ? formatMaybeDate(pendingChange.requestedAt, 'D MMM YYYY')
          : t('adminPage.fallback.na'),
      })
    : '';

  const pendingSupportMessage = pendingChange
    ? paymentIntegration?.message
      || (pendingChange.paymentProviderStatus === 'quote_required'
        ? t('adminPage.plan.pendingMessages.quoteRequired')
        : t('adminPage.plan.pendingMessages.pendingSetup'))
    : '';

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <PageHeader title={t('adminPage.title')} subtitle={activeTabMeta?.description || t('adminPage.subtitle')} />

      <div className="card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t('adminPage.title')}
          </p>
          <h2 className="break-words font-serif text-xl text-slate-900 dark:text-white">{activeTabMeta.label}</h2>
        </div>

        <div className="grid grid-cols-3 gap-2 lg:flex lg:flex-wrap">
          <div className="contents lg:flex lg:flex-wrap lg:gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-semibold leading-tight transition lg:w-auto lg:px-4 lg:py-2.5 lg:text-left ${
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loadError && activeTab !== 'current-user' ? <Notice title={loadError} tone="error" /> : null}

      {activeTab === 'overview' ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              eyebrow={t('adminPage.overview.planStatus')}
              value={planStatusValue}
              caption={planStatusCaption}
              icon={Package2}
              tone={currentPlan ? getStatusTone(currentPlan.subscriptionStatus) : businessId ? 'slate' : 'amber'}
            />
            <StatCard
              eyebrow={t('adminPage.overview.seatsUsed')}
              value={summary.maxUsers ? `${summary.totalUsers} / ${summary.maxUsers}` : t('adminPage.fallback.na')}
              caption={t('adminPage.plan.seatProgress', { percent: seatUsagePercent })}
              icon={Users}
              tone="blue"
            />
            <StatCard
              eyebrow={t('adminPage.overview.currentRole')}
              value={formatFieldValue(sessionRole, t)}
              caption={t('adminPage.currentUser.subtitle')}
              icon={KeyRound}
              tone="slate"
            />
            <StatCard
              eyebrow={t('adminPage.overview.accountHealth')}
              value={accountHealth}
              caption={t('adminPage.overview.businessContextLabel', { business: businessName })}
              icon={isEmailPending ? ShieldAlert : ShieldCheck}
              tone={isEmailPending ? 'amber' : 'emerald'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <DetailCard title={t('adminPage.overview.quickActions')} subtitle={t('adminPage.subtitle')}>
              <div className="grid gap-3">
                <Link className="btn-secondary justify-center" to="/app/admin?tab=plan">
                  {t('adminPage.overview.openPlan')}
                </Link>
                <Link className="btn-secondary justify-center" to="/app/admin?tab=current-user">
                  {t('adminPage.overview.openCurrentUser')}
                </Link>
                <Link className="btn-primary justify-center" to={buildSettingsTabPath(STAFF_SETTINGS_TAB)}>
                  {t('adminPage.overview.manageStaff')}
                </Link>
              </div>
            </DetailCard>

            <div className="lg:col-span-2">
              <DetailCard
                title={t('adminPage.currentUser.title')}
                subtitle={t('adminPage.currentUser.subtitle')}
                action={(
                  <Link className="btn-ghost" to="/app/admin?tab=current-user">
                    {t('common.view')}
                  </Link>
                )}
              >
                <FieldGrid fields={standardUserFields.slice(0, 6)} />
              </DetailCard>
            </div>
          </div>

          <DetailCard
            title={t('adminPage.plan.currentPlanTitle')}
            subtitle={t('adminPage.plan.subscriptionSubtitle')}
            action={(
              <Link className="btn-ghost" to="/app/admin?tab=plan">
                {t('common.view')}
              </Link>
            )}
          >
            {!businessId ? (
              <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" />
            ) : subscriptionLoading && !currentPlan ? (
              <Notice title={t('common.loading')} tone="info" />
            ) : currentPlan ? (
              <FieldGrid fields={currentPlanFields.slice(0, 4)} />
            ) : (
              <Notice
                title={subscriptionError || t('adminPage.plan.subscriptionUnavailable')}
                tone={subscriptionError ? 'error' : 'warn'}
              />
            )}
          </DetailCard>
        </div>
      ) : null}

      {activeTab === 'plan' ? (
        <div className="space-y-6">
          {!businessId ? (
            <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              eyebrow={t('adminPage.plan.metrics.currentPackage')}
              value={currentPlan?.label || t('adminPage.fallback.na')}
              caption={currentPlan?.description || t('adminPage.plan.subscriptionSubtitle')}
              icon={Package2}
              tone={currentPlan ? getStatusTone(currentPlan.subscriptionStatus) : 'slate'}
            />
            <StatCard
              eyebrow={t('adminPage.plan.metrics.billingStatus')}
              value={currentPlan ? resolveSubscriptionLabel(t, 'billingStatusLabels', currentPlan.billingStatus) : t('adminPage.fallback.na')}
              caption={currentPlan ? resolveSubscriptionLabel(t, 'billingCycleLabels', currentPlan.billingCycle) : t('adminPage.plan.subscriptionSubtitle')}
              icon={CreditCard}
              tone={currentPlan ? getStatusTone(currentPlan.billingStatus) : 'slate'}
            />
            <StatCard
              eyebrow={t('adminPage.plan.metrics.subscriptionStatus')}
              value={currentPlan ? resolveSubscriptionLabel(t, 'subscriptionStatusLabels', currentPlan.subscriptionStatus) : t('adminPage.fallback.na')}
              caption={currentPlan?.subscriptionEndDate ? formatMaybeDate(currentPlan.subscriptionEndDate, 'D MMM YYYY') : t('adminPage.plan.noEndDate')}
              icon={CalendarClock}
              tone={currentPlan ? getStatusTone(currentPlan.subscriptionStatus) : 'slate'}
            />
            <StatCard
              eyebrow={t('adminPage.plan.metrics.pendingChange')}
              value={pendingChange?.label || t('adminPage.plan.noneLabel')}
              caption={pendingChange
                ? resolveSubscriptionLabel(t, 'paymentStatusLabels', pendingChange.paymentProviderStatus)
                : t('adminPage.plan.pendingClearCaption')}
              icon={pendingChange ? ShieldAlert : ShieldCheck}
              tone={pendingChange ? 'amber' : 'emerald'}
            />
          </div>

          {subscriptionNotice.message ? (
            <Notice
              title={subscriptionNotice.message}
              tone={subscriptionNotice.type === 'error' ? 'error' : subscriptionNotice.type === 'success' ? 'success' : 'info'}
            />
          ) : null}

          {subscriptionError ? <Notice title={subscriptionError} tone="error" /> : null}

          {pendingChange ? (
            <div className="rounded-3xl border border-amber-200/80 bg-amber-50/90 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                    {t('adminPage.plan.pendingTitle')}
                  </p>
                  <h3 className="mt-2 break-words font-serif text-2xl text-slate-900 dark:text-white">
                    {pendingChange.label || humanizeKey(pendingChange.key)}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{pendingDescription}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill
                      label={resolveSubscriptionLabel(t, 'paymentStatusLabels', pendingChange.paymentProviderStatus)}
                      tone={getStatusTone(pendingChange.paymentProviderStatus)}
                    />
                    <StatusPill
                      label={resolveSubscriptionLabel(t, 'billingCycleLabels', pendingChange.billingCycle)}
                      tone="slate"
                    />
                    {pendingChange.billingAmount !== null ? (
                      <StatusPill label={formatMoney(pendingChange.billingAmount, t)} tone="blue" />
                    ) : null}
                  </div>
                  {pendingSupportMessage ? (
                    <p className="mt-4 text-sm text-amber-900/80 dark:text-amber-100/80">{pendingSupportMessage}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-secondary justify-center whitespace-nowrap"
                  onClick={handleCancelPendingChange}
                  disabled={subscriptionActionKey === 'cancel'}
                >
                  {subscriptionActionKey === 'cancel' ? t('adminPage.plan.cancellingCta') : t('adminPage.plan.cancelPendingCta')}
                </button>
              </div>
            </div>
          ) : null}

          {!pendingChange && paymentIntegration?.message ? (
            <Notice
              title={t('adminPage.plan.paymentIntegrationTitle')}
              description={paymentIntegration.message}
              tone="info"
            />
          ) : null}

          <DetailCard
            title={t('adminPage.plan.currentPlanTitle')}
            subtitle={t('adminPage.plan.subscriptionSubtitle')}
            action={(
              <button
                type="button"
                className="btn-ghost gap-2"
                onClick={handleRefreshSubscription}
                disabled={subscriptionLoading || Boolean(subscriptionActionKey)}
              >
                <RefreshCw size={16} className={subscriptionLoading ? 'animate-spin' : ''} />
                {t('adminPage.plan.refreshCta')}
              </button>
            )}
          >
            {!businessId ? (
              <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" />
            ) : subscriptionLoading && !currentPlan ? (
              <Notice title={t('common.loading')} tone="info" />
            ) : currentPlan ? (
              <div className={`rounded-3xl border p-5 ${
                getStatusTone(currentPlan.subscriptionStatus) === 'rose'
                  ? 'border-rose-200/80 bg-rose-50/80 dark:border-rose-500/30 dark:bg-rose-500/10'
                  : getStatusTone(currentPlan.subscriptionStatus) === 'amber'
                    ? 'border-amber-200/80 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10'
                    : 'border-slate-200/70 bg-slate-50/80 dark:border-slate-800/70 dark:bg-slate-900/60'
              }`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {t('adminPage.plan.currentPlanEyebrow')}
                    </p>
                    <h3 className="mt-2 break-words font-serif text-2xl text-slate-900 dark:text-white">
                      {currentPlan.label || t('adminPage.fallback.na')}
                    </h3>
                    {currentPlan.description ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{currentPlan.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={resolveSubscriptionLabel(t, 'subscriptionStatusLabels', currentPlan.subscriptionStatus)}
                      tone={getStatusTone(currentPlan.subscriptionStatus)}
                    />
                    <StatusPill
                      label={resolveSubscriptionLabel(t, 'billingStatusLabels', currentPlan.billingStatus)}
                      tone={getStatusTone(currentPlan.billingStatus)}
                    />
                  </div>
                </div>
                <div className="mt-5">
                  <FieldGrid fields={currentPlanFields} />
                </div>
              </div>
            ) : (
              <Notice
                title={subscriptionError || t('adminPage.plan.subscriptionUnavailable')}
                tone={subscriptionError ? 'error' : 'warn'}
              />
            )}
          </DetailCard>

          <DetailCard
            title={t('adminPage.plan.availablePlansTitle')}
            subtitle={t('adminPage.plan.availablePlansSubtitle')}
          >
            {!businessId ? (
              <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" />
            ) : orderedPlans.length === 0 ? (
              <Notice title={t('adminPage.plan.noPlans')} tone="info" />
            ) : (
              <div className="grid gap-4 xl:grid-cols-3">
                {orderedPlans.map((plan) => {
                  const selectedCycle = planSelections[plan.key] || getPreferredBillingCycle(plan, currentPlan, pendingChange);
                  const billingOption = Array.isArray(plan.billingOptions)
                    ? plan.billingOptions.find((option) => option.cycle === selectedCycle) || plan.billingOptions[0] || null
                    : null;
                  const isCurrentPlan = currentPlan?.key === plan.key;
                  const isPendingPlan = pendingChange?.key === plan.key;
                  const isSubmitting = subscriptionActionKey === plan.key;
                  const disableBillingSelection = Boolean(subscriptionActionKey) || (hasPendingChange && !isPendingPlan);
                  const disableAction = isSubmitting
                    || isCurrentPlan
                    || Boolean(subscriptionActionKey && !isSubmitting)
                    || (hasPendingChange && !isPendingPlan);

                  return (
                    <div
                      key={plan.key}
                      className={`rounded-3xl border p-5 shadow-sm ${
                        isPendingPlan
                          ? 'border-amber-200/80 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10'
                          : isCurrentPlan
                            ? 'border-primary/30 bg-primary/5 dark:border-primary/40 dark:bg-primary/10'
                            : 'border-slate-200/70 bg-white/80 dark:border-slate-800/70 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{plan.label}</h3>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {plan.description || t('adminPage.fallback.na')}
                          </p>
                        </div>
                        {isPendingPlan ? <ShieldAlert className="shrink-0 text-amber-600 dark:text-amber-300" size={20} /> : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {isCurrentPlan ? <StatusPill label={t('adminPage.plan.badges.current')} tone="emerald" /> : null}
                        {isPendingPlan ? <StatusPill label={t('adminPage.plan.badges.pending')} tone="amber" /> : null}
                        <StatusPill
                          label={plan.isPaid ? t('adminPage.plan.badges.paid') : t('adminPage.plan.badges.free')}
                          tone={plan.isPaid ? 'blue' : 'emerald'}
                        />
                        {plan.isCustom ? <StatusPill label={t('adminPage.plan.badges.custom')} tone="slate" /> : null}
                        {plan.requiresApproval ? <StatusPill label={t('adminPage.plan.badges.approval')} tone="amber" /> : null}
                        {plan.supportsEsewa ? <StatusPill label={t('adminPage.plan.badges.esewa')} tone="blue" /> : null}
                      </div>

                      <div className="mt-6">
                        <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                          {getPlanPriceLabel(plan, billingOption, t)}
                        </p>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {resolveSubscriptionLabel(t, 'billingCycleLabels', selectedCycle)}
                        </p>
                      </div>

                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {t('adminPage.plan.chooseBillingLabel')}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(plan.billingOptions || []).map((option) => {
                            const isSelected = selectedCycle === option.cycle;
                            return (
                              <button
                                key={`${plan.key}-${option.cycle}`}
                                type="button"
                                onClick={() => setPlanSelections((currentSelections) => ({
                                  ...currentSelections,
                                  [plan.key]: option.cycle,
                                }))}
                                disabled={disableBillingSelection}
                                className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                } ${disableBillingSelection ? 'cursor-not-allowed opacity-60' : ''}`}
                              >
                                {resolveSubscriptionLabel(t, 'billingCycleLabels', option.cycle)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
                        {getPlanSupportNote(plan, paymentIntegration, t)}
                      </p>

                      <button
                        type="button"
                        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                          disableAction
                            ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-primary text-white shadow-sm hover:bg-primary/90'
                        }`}
                        disabled={disableAction}
                        onClick={() => handlePlanChange(plan)}
                      >
                        {isSubmitting ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                            {t('adminPage.plan.savingCta')}
                          </>
                        ) : (
                          getPlanActionLabel(plan, { isCurrentPlan, isPendingPlan, t })
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailCard>

          <DetailCard title={t('adminPage.plan.utilization')} subtitle={t('adminPage.plan.workspaceSubtitle')}>
            {!businessId ? (
              <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" />
            ) : (
              <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {t('adminPage.plan.businessName')}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{businessName}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {t('adminPage.plan.seatProgress', { percent: seatUsagePercent })}
                  </p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all"
                    style={{ width: `${seatUsagePercent}%` }}
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t('adminPage.plan.metrics.totalSeats')}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.maxUsers || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t('adminPage.plan.metrics.usedSeats')}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.totalUsers || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t('adminPage.plan.metrics.availableSeats')}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{summary.availableSlots || 0}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  {t('adminPage.plan.utilizationHint', {
                    used: summary.totalUsers || 0,
                    total: summary.maxUsers || 0,
                  })}
                </p>
              </div>
            )}
          </DetailCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailCard
              title={t('adminPage.plan.includedTitle')}
              subtitle={t('adminPage.plan.syncNote')}
            >
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                  {t('adminPage.plan.includedOwner')}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                  {t('adminPage.plan.includedStaff')}
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                  {t('adminPage.plan.includedSecurity')}
                </div>
              </div>
            </DetailCard>

            <DetailCard
              title={t('adminPage.plan.actionsTitle')}
              subtitle={t('adminPage.currentUser.accountActions')}
            >
              <div className="grid gap-3">
                <Link className="btn-primary justify-center" to={buildSettingsTabPath(STAFF_SETTINGS_TAB)}>
                  {t('adminPage.plan.manageStaffCta')}
                </Link>
                <Link className="btn-secondary justify-center" to={buildSettingsTabPath(ACCOUNT_SETTINGS_TAB)}>
                  {t('adminPage.plan.manageAccountCta')}
                </Link>
              </div>
            </DetailCard>
          </div>

          <DetailCard title={t('adminPage.plan.teamAccess')} subtitle={t('adminPage.plan.syncNote')}>
            {loading ? (
              <div className="flex items-center gap-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t('common.loading')}
              </div>
            ) : members.length === 0 ? (
              <Notice title={t('adminPage.plan.noMembers')} tone="info" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {members.map((member) => (
                  <div
                    key={member.membershipId || member.user?.id || member.user?.email}
                    className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {member.user?.name || member.user?.email || t('adminPage.fallback.na')}
                        </p>
                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                          {member.user?.email || t('adminPage.fallback.na')}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {member.role || t('adminPage.fallback.unknown')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        member.user?.isActive === false
                          ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}>
                        {member.user?.isActive === false ? t('adminPage.status.inactive') : t('adminPage.status.active')}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        member.user?.emailVerified === false
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                      }`}>
                        {member.user?.emailVerified === false ? t('adminPage.status.pending') : t('adminPage.status.verified')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DetailCard>
        </div>
      ) : null}

      {activeTab === 'current-user' ? (
        <div className="space-y-6">
          <DetailCard
            title={t('adminPage.currentUser.title')}
            subtitle={t('adminPage.currentUser.subtitle')}
            action={(
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                isEmailPending
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
              }`}>
                {isEmailPending ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                {isEmailPending ? t('auth.emailVerificationPending') : t('auth.emailVerified')}
              </div>
            )}
          >
            <div className="flex flex-col gap-5 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-primary-50/60 via-white to-amber-50 p-6 dark:border-slate-800/70 dark:from-primary-950/20 dark:via-slate-950 dark:to-slate-900 md:flex-row md:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-2xl font-semibold text-white shadow-lg shadow-primary/20">
                {getUserInitials(user)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                  {t('adminPage.currentUser.signedInAs')}
                </p>
                <h3 className="mt-2 break-words font-serif text-2xl text-slate-900 dark:text-white">
                  {user?.name || user?.email || t('adminPage.fallback.na')}
                </h3>
                <p className="mt-2 break-all text-sm text-slate-500 dark:text-slate-400">
                  {user?.email || t('adminPage.fallback.na')}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t('adminPage.currentUser.sessionRole')}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{sessionRole}</p>
              </div>
            </div>
          </DetailCard>

          <DetailCard title={t('adminPage.currentUser.fieldsTitle')} subtitle={t('adminPage.currentUser.subtitle')}>
            <FieldGrid fields={standardUserFields} />
          </DetailCard>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <DetailCard title={t('adminPage.currentUser.extraTitle')} subtitle={t('adminPage.currentUser.subtitle')}>
              {extraUserFields.length ? (
                <FieldGrid fields={extraUserFields} />
              ) : (
                <Notice title={t('adminPage.currentUser.extraEmpty')} tone="info" />
              )}
            </DetailCard>

            <DetailCard title={t('adminPage.currentUser.accountActions')} subtitle={t('settingsPage.descriptions.account')}>
              <div className="grid gap-3">
                <Link className="btn-primary justify-center" to={buildSettingsTabPath(ACCOUNT_SETTINGS_TAB)}>
                  {t('adminPage.currentUser.accountSettings')}
                </Link>
                {isEmailPending ? (
                  <Link className="btn-secondary justify-center" to="/app/activate-account">
                    {t('adminPage.currentUser.verifyEmail')}
                  </Link>
                ) : null}
              </div>
            </DetailCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}
