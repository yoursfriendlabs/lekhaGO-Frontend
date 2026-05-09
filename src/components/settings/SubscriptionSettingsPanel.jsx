import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, RefreshCw, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react';
import Notice from '../Notice.jsx';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { todayISODate } from '../../lib/datetime';
import { useI18n } from '../../lib/i18n.jsx';
import {
  getPreferredBillingCycle,
  getSubscriptionGuard,
  humanizeKey,
  normalizeSubscriptionPayload,
  sortAvailablePlans,
} from '../../lib/subscription';

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

function MetricCard({ label, value, description, icon: Icon, tone = 'slate' }) {
  const tones = {
    emerald: 'border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-950/20',
    amber: 'border-amber-200/70 bg-amber-50/70 dark:border-amber-800/40 dark:bg-amber-950/20',
    blue: 'border-sky-200/70 bg-sky-50/70 dark:border-sky-800/40 dark:bg-sky-950/20',
    rose: 'border-rose-200/70 bg-rose-50/70 dark:border-rose-800/40 dark:bg-rose-950/20',
    slate: 'border-slate-200/70 bg-slate-50/70 dark:border-slate-800/60 dark:bg-slate-900/50',
  };

  return (
    <div className={`rounded-3xl border p-5 ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-3 break-words text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="rounded-2xl bg-white/90 p-3 shadow-sm dark:bg-slate-950/70">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionSettingsPanel({ isOwner = false }) {
  const { t } = useI18n();
  const { businessId, subscription, updateSubscription } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(() => normalizeSubscriptionPayload(subscription));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState({ type: 'info', message: '' });
  const [planSelections, setPlanSelections] = useState({});
  const [activePlanKey, setActivePlanKey] = useState('');

  const syncSubscription = useCallback((payload) => {
    const normalized = normalizeSubscriptionPayload(payload);
    setSubscriptionData(normalized);
    updateSubscription(normalized);
    return normalized;
  }, [updateSubscription]);

  const loadSubscriptionSettings = useCallback(async ({ showSpinner = true } = {}) => {
    if (!businessId) {
      setSubscriptionData(null);
      setError('');
      return;
    }

    if (showSpinner) setLoading(true);
    setError('');

    try {
      const subscriptionResponse = await api.getSubscription();
      syncSubscription(subscriptionResponse);
    } catch (loadError) {
      setError(loadError.message || t('auth.errors.generic'));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [businessId, syncSubscription, t]);

  useEffect(() => {
    setSubscriptionData(normalizeSubscriptionPayload(subscription));
  }, [subscription]);

  useEffect(() => {
    loadSubscriptionSettings();
  }, [loadSubscriptionSettings]);

  useEffect(() => {
    const plans = subscriptionData?.availablePlans || [];
    if (!plans.length) return;

    setPlanSelections((currentSelections) => {
      const nextSelections = { ...currentSelections };
      let changed = false;

      sortAvailablePlans(plans).forEach((plan) => {
        const preferredCycle = getPreferredBillingCycle(
          plan,
          subscriptionData?.currentPlan,
          subscriptionData?.pendingChange
        );
        const availableCycles = Array.isArray(plan.billingOptions)
          ? plan.billingOptions.map((option) => option.cycle).filter(Boolean)
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

  const access = subscriptionData?.access || null;
  const currentPlan = subscriptionData?.currentPlan || null;
  const pendingChange = subscriptionData?.pendingChange || null;
  const orderedPlans = useMemo(
    () => sortAvailablePlans(subscriptionData?.availablePlans || []),
    [subscriptionData?.availablePlans]
  );
  const guard = useMemo(() => getSubscriptionGuard(subscriptionData || access), [access, subscriptionData]);
  const checkoutUrl = guard.checkoutUrl || '';

  const handleRefresh = async () => {
    setNotice({ type: 'info', message: '' });
    await loadSubscriptionSettings();
  };

  const handlePlanChange = async (plan) => {
    if (!businessId || !isOwner) return;

    const selectedCycle = planSelections[plan.key] || getPreferredBillingCycle(plan, currentPlan, pendingChange);
    const selectedOption = Array.isArray(plan.billingOptions)
      ? plan.billingOptions.find((option) => option.cycle === selectedCycle) || null
      : null;
    const payload = plan.key === 'freemium'
      ? { plan: 'freemium', subscriptionStartDate: todayISODate() }
      : {
        plan: plan.key,
        billingCycle: selectedCycle || (plan.key === 'custom' ? 'custom' : 'monthly'),
        ...(selectedOption?.amountConfigured && selectedOption?.amount !== null
          ? { billingAmount: selectedOption.amount }
          : {}),
      };

    setActivePlanKey(plan.key);
    setNotice({ type: 'info', message: '' });

    try {
      const response = await api.updateSubscription(payload);
      syncSubscription(response);
      setNotice({
        type: 'success',
        message: response?.message || t('settingsPage.subscription.planSaved'),
      });
      await loadSubscriptionSettings({ showSpinner: false });
    } catch (saveError) {
      setNotice({
        type: 'error',
        message: saveError.message || t('auth.errors.generic'),
      });
    } finally {
      setActivePlanKey('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t('settingsPage.subscription.eyebrow')}
            </p>
            <h2 className="mt-2 font-serif text-xl text-slate-900 dark:text-white">
              {t('settingsPage.tabs.subscription')}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('settingsPage.subscription.subtitle')}
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost gap-2"
            onClick={handleRefresh}
            disabled={loading || Boolean(activePlanKey)}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('adminPage.plan.refreshCta')}
          </button>
        </div>

        {!businessId ? <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" /> : null}
        {notice.message ? (
          <Notice
            title={notice.message}
            tone={notice.type === 'error' ? 'error' : notice.type === 'success' ? 'success' : 'info'}
          />
        ) : null}
        {error ? <Notice title={error} tone="error" /> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            label={t('adminPage.plan.metrics.currentPackage')}
            value={currentPlan?.label || (access?.planKey ? humanizeKey(access.planKey) : t('adminPage.fallback.na'))}
            description={currentPlan?.description || t('adminPage.plan.subscriptionSubtitle')}
            icon={WalletCards}
            tone={getStatusTone(access?.subscriptionStatus || currentPlan?.subscriptionStatus)}
          />
          <MetricCard
            label={t('adminPage.plan.metrics.subscriptionStatus')}
            value={resolveSubscriptionLabel(t, 'subscriptionStatusLabels', access?.subscriptionStatus || currentPlan?.subscriptionStatus)}
            description={access?.canUseApplication ? t('settingsPage.subscription.accessReady') : t('settingsPage.subscription.accessLocked')}
            icon={access?.canUseApplication ? ShieldCheck : ShieldAlert}
            tone={access?.canUseApplication ? 'emerald' : 'amber'}
          />
          <MetricCard
            label={t('adminPage.plan.metrics.pendingChange')}
            value={access?.hasPendingChange ? t('common.yes') : t('common.no')}
            description={pendingChange?.label || t('adminPage.plan.pendingClearCaption')}
            icon={CalendarClock}
            tone={access?.hasPendingChange ? 'amber' : 'slate'}
          />
        </div>
      </div>

      {guard.description ? (
        <Notice
          title={guard.title || t('settingsPage.subscription.guardTitle')}
          description={guard.description}
          tone={access?.canUseApplication ? 'info' : 'warn'}
        />
      ) : null}

      <div className="card space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">
              {t('settingsPage.subscription.currentPlanTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('adminPage.plan.subscriptionSubtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill
              label={resolveSubscriptionLabel(t, 'subscriptionStatusLabels', access?.subscriptionStatus || currentPlan?.subscriptionStatus)}
              tone={getStatusTone(access?.subscriptionStatus || currentPlan?.subscriptionStatus)}
            />
            {access?.hasPendingChange ? (
              <StatusPill label={t('adminPage.plan.badges.pending')} tone="amber" />
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t('adminPage.plan.currentPlanFields.package')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {currentPlan?.label || (access?.planKey ? humanizeKey(access.planKey) : t('adminPage.fallback.na'))}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {t('adminPage.plan.currentPlanFields.billingCycle')}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              {resolveSubscriptionLabel(t, 'billingCycleLabels', currentPlan?.billingCycle)}
            </p>
          </div>
        </div>

        {checkoutUrl ? (
          <div className="flex justify-start">
            <a
              className="btn-primary inline-flex justify-center"
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t('settingsPage.subscription.checkoutCta')}
            </a>
          </div>
        ) : null}
      </div>

      <div className="card space-y-5">
        <div>
          <h3 className="font-serif text-lg text-slate-900 dark:text-white">
            {t('adminPage.plan.availablePlansTitle')}
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('adminPage.plan.availablePlansSubtitle')}
          </p>
        </div>

        {!orderedPlans.length ? (
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
              const isSubmitting = activePlanKey === plan.key;
              const planCheckoutUrl = plan.checkoutUrl || billingOption?.checkoutUrl || checkoutUrl || '';

              return (
                <div
                  id={`subscription-plan-${plan.key}`}
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
                      <h4 className="text-xl font-semibold text-slate-900 dark:text-white">{plan.label}</h4>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {plan.description || t('adminPage.fallback.na')}
                      </p>
                    </div>
                    {isPendingPlan ? <ShieldAlert className="shrink-0 text-amber-600 dark:text-amber-300" size={20} /> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isCurrentPlan ? <StatusPill label={t('adminPage.plan.badges.current')} tone="emerald" /> : null}
                    {isPendingPlan ? <StatusPill label={t('adminPage.plan.badges.pending')} tone="amber" /> : null}
                    {plan.isPaid ? <StatusPill label={t('adminPage.plan.badges.paid')} tone="blue" /> : <StatusPill label={t('adminPage.plan.badges.free')} tone="emerald" />}
                  </div>

                  <div className="mt-6">
                    <p className="text-3xl font-semibold text-slate-900 dark:text-white">
                      {plan.key === 'freemium'
                        ? t('adminPage.plan.priceLabels.freeForever')
                        : billingOption?.amountConfigured && billingOption?.amount !== null
                          ? formatMoney(billingOption.amount, t)
                          : t('adminPage.plan.priceLabels.onRequest')}
                    </p>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {resolveSubscriptionLabel(t, 'billingCycleLabels', selectedCycle)}
                    </p>
                  </div>

                  {(plan.billingOptions || []).length ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {t('adminPage.plan.chooseBillingLabel')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(plan.billingOptions || []).map((option) => (
                          <button
                            key={`${plan.key}-${option.cycle}`}
                            type="button"
                            onClick={() => setPlanSelections((currentSelections) => ({
                              ...currentSelections,
                              [plan.key]: option.cycle,
                            }))}
                            disabled={!isOwner || Boolean(activePlanKey)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                              selectedCycle === option.cycle
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                            } ${!isOwner || activePlanKey ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {resolveSubscriptionLabel(t, 'billingCycleLabels', option.cycle)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 grid gap-3">
                    <button
                      type="button"
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        isSubmitting || isCurrentPlan || !isOwner
                          ? 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          : 'bg-primary text-white shadow-sm hover:bg-primary/90'
                      }`}
                      disabled={isSubmitting || isCurrentPlan || !isOwner}
                      onClick={() => handlePlanChange(plan)}
                    >
                      {isSubmitting ? t('adminPage.plan.savingCta') : isCurrentPlan ? t('adminPage.plan.currentPlanCta') : t('settingsPage.subscription.requestPlanCta')}
                    </button>

                    {planCheckoutUrl ? (
                      <a
                        className="btn-secondary justify-center"
                        href={planCheckoutUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('settingsPage.subscription.checkoutCta')}
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isOwner ? (
          <Notice title={t('settingsPage.subscription.ownerOnlyNotice')} tone="info" />
        ) : null}
      </div>
    </div>
  );
}
