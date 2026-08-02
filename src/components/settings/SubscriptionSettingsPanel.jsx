import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, RefreshCw, ShieldAlert, WalletCards } from 'lucide-react';
import Notice from '../Notice.jsx';
import ConfirmDialog from '../ui/ConfirmDialog.jsx';
import TeamSeatUsagePanel from '../subscription/TeamSeatUsagePanel.jsx';
import { formatSubscriptionStatusDate } from '../subscription/SubscriptionStatusBanner.jsx';
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
    case 'cancelling':
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

function getDisplayBillingStatus(currentPlan, cancellation) {
  if (cancellation?.cancelAtPeriodEnd || currentPlan?.cancelAtPeriodEnd) {
    return 'cancelling';
  }
  return currentPlan?.billingStatus || currentPlan?.subscriptionStatus || '';
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
  const { locale, t } = useI18n();
  const { businessId, subscription, updateSubscription, refreshSession } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState(() => normalizeSubscriptionPayload(subscription));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState({ type: 'info', message: '' });
  const [planSelections, setPlanSelections] = useState({});
  const [activePlanKey, setActivePlanKey] = useState('');
  const [staffSummary, setStaffSummary] = useState({ maxUsers: 0, totalUsers: 0, availableSlots: 0 });
  const [confirmAction, setConfirmAction] = useState(null); // 'cancel' | 'reactivate' | 'clearPending'
  const [actionLoading, setActionLoading] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(null);

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

  const refreshAfterMutation = useCallback(async (response) => {
    if (response) syncSubscription(response);
    try {
      await refreshSession?.();
    } catch {
      // Auth/me refresh is best-effort; subscription GET below is source of truth.
    }
    await loadSubscriptionSettings({ showSpinner: false });
  }, [loadSubscriptionSettings, refreshSession, syncSubscription]);

  useEffect(() => {
    setSubscriptionData(normalizeSubscriptionPayload(subscription));
  }, [subscription]);

  useEffect(() => {
    loadSubscriptionSettings();
  }, [loadSubscriptionSettings]);

  useEffect(() => {
    if (!businessId) {
      setStaffSummary({ maxUsers: 0, totalUsers: 0, availableSlots: 0 });
      return;
    }

    api.listStaff()
      .then((payload) => {
        setStaffSummary(payload?.summary || { maxUsers: 0, totalUsers: 0, availableSlots: 0 });
      })
      .catch(() => {
        setStaffSummary({ maxUsers: 0, totalUsers: 0, availableSlots: 0 });
      });
  }, [businessId, notice.message]);

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

        const defaultToYearly = availableCycles.includes('yearly') && plan.key !== 'custom';
        const targetCycle = defaultToYearly ? 'yearly' : (preferredCycle || availableCycles[0]);
        if (nextSelections[plan.key] !== targetCycle) {
          nextSelections[plan.key] = targetCycle;
          changed = true;
        }
      });

      return changed ? nextSelections : currentSelections;
    });
  }, [subscriptionData]);

  const access = subscriptionData?.access || null;
  const currentPlan = subscriptionData?.currentPlan || null;
  const pendingChange = subscriptionData?.pendingChange || null;
  const cancellation = subscriptionData?.cancellation || null;
  const orderedPlans = useMemo(
    () => sortAvailablePlans(subscriptionData?.availablePlans || []).filter(plan => plan.key !== 'freemium'),
    [subscriptionData?.availablePlans]
  );
  const guard = useMemo(() => getSubscriptionGuard(subscriptionData || access), [access, subscriptionData]);
  const checkoutUrl = guard.checkoutUrl || '';
  const displayBillingStatus = getDisplayBillingStatus(currentPlan, cancellation);
  const effectiveUntilDate = formatSubscriptionStatusDate(
    cancellation?.effectiveUntil || currentPlan?.subscriptionEndDate,
    locale
  );
  const canCancelSubscription = Boolean(isOwner && (access?.canCancel || cancellation?.canCancel));
  const canReactivateSubscription = Boolean(
    isOwner
    && (cancellation?.cancelAtPeriodEnd || access?.cancelAtPeriodEnd)
    && (access?.canReactivate || cancellation?.canReactivate)
  );
  const showCancelledBanner = Boolean(
    (cancellation?.cancelAtPeriodEnd || access?.cancelAtPeriodEnd)
    && access?.canUseApplication !== false
  );
  const showExpiredRenewHint = Boolean(
    isOwner
    && access?.canUseApplication === false
    && (access?.guard === 'subscription_expired' || currentPlan?.subscriptionStatus === 'expired')
    && !canReactivateSubscription
  );
  const mutationBusy = Boolean(actionLoading || activePlanKey || paymentLoading);

  const handleRefresh = async () => {
    setNotice({ type: 'info', message: '' });
    await loadSubscriptionSettings();
  };

  const handleClearPendingChange = async () => {
    if (!businessId || !isOwner) return;
    setActionLoading('clearPending');
    setNotice({ type: 'info', message: '' });
    try {
      const response = await api.updateSubscription({ clearPendingChange: true });
      setConfirmAction(null);
      setNotice({
        type: 'success',
        message: response?.message || t('adminPage.plan.pendingCancelled'),
      });
      await refreshAfterMutation(response);
    } catch (clearError) {
      setNotice({
        type: 'error',
        message: clearError?.payload?.message || clearError.message || t('auth.errors.generic'),
      });
    } finally {
      setActionLoading('');
    }
  };

  const handleCancelSubscription = async () => {
    if (!businessId || !isOwner) return;
    setActionLoading('cancel');
    setNotice({ type: 'info', message: '' });
    try {
      const response = await api.cancelSubscription();
      setConfirmAction(null);
      setNotice({
        type: 'success',
        message: response?.message || t('adminPage.plan.cancelledBannerTitle'),
      });
      await refreshAfterMutation(response);
    } catch (cancelError) {
      setNotice({
        type: 'error',
        message: cancelError?.payload?.message || cancelError.message || t('auth.errors.generic'),
      });
    } finally {
      setActionLoading('');
    }
  };

  const handleReactivateSubscription = async () => {
    if (!businessId || !isOwner) return;
    setActionLoading('reactivate');
    setNotice({ type: 'info', message: '' });
    try {
      const response = await api.reactivateSubscription();
      setConfirmAction(null);
      setNotice({
        type: 'success',
        message: response?.message || t('adminPage.plan.changeSaved'),
      });
      await refreshAfterMutation(response);
    } catch (reactivateError) {
      setNotice({
        type: 'error',
        message: reactivateError?.payload?.message || reactivateError.message || t('auth.errors.generic'),
      });
    } finally {
      setActionLoading('');
    }
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

  const handleInitiatePayment = async (provider, targetPlan = null) => {
    if (!businessId || !isOwner) return;

    setPaymentLoading(provider);
    setNotice({ type: 'info', message: '' });

    try {
      // ALWAYS request/refresh the plan change first to ensure we close old requests and generate a new UUID
      const activePlan = targetPlan || pendingChange;
      if (activePlan) {
        const selectedCycle = planSelections[activePlan.key] || getPreferredBillingCycle(activePlan, currentPlan, pendingChange);
        const selectedOption = Array.isArray(activePlan.billingOptions)
          ? activePlan.billingOptions.find((option) => option.cycle === selectedCycle) || null
          : null;
        
        const payload = {
          plan: activePlan.key,
          billingCycle: selectedCycle || 'monthly',
          ...(selectedOption?.amountConfigured && selectedOption?.amount !== null
            ? { billingAmount: selectedOption.amount }
            : {}),
        };
        
        const changeResponse = await api.updateSubscription(payload);
        syncSubscription(changeResponse);
      }

      // 2. Fetch gateway checkout parameters
      const response = await api.getSubscriptionPaymentParams({ provider });
      if (provider === 'esewa') {
        if (response.actionUrl && response.params) {
          submitEsewaForm(response.actionUrl, response.params);
        } else {
          throw new Error('Invalid eSewa response received from server.');
        }
      } else if (provider === 'khalti') {
        if (response.paymentUrl) {
          window.location.href = response.paymentUrl;
        } else {
          throw new Error('Khalti payment URL not received from server.');
        }
      }
    } catch (paymentError) {
      setNotice({
        type: 'error',
        message: paymentError.message || t('auth.errors.generic'),
      });
      setPaymentLoading(null);
    }
  };

  const submitEsewaForm = (actionUrl, params) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = actionUrl;

    Object.entries(params).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Subscription
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-450">
            Billing overview and subscription plan upgrades.
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost gap-2 btn-sm"
          onClick={handleRefresh}
          disabled={loading || mutationBusy}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('adminPage.plan.refreshCta')}
        </button>
      </div>

      {/* Errors / Notices */}
      {!businessId ? <Notice title={t('adminPage.plan.noBusinessNotice')} tone="warn" /> : null}
      {notice.message ? (
        <Notice
          title={notice.message}
          tone={notice.type === 'error' ? 'error' : notice.type === 'success' ? 'success' : 'info'}
        />
      ) : null}
      {error ? <Notice title={error} tone="error" /> : null}

      {/* Active Subscription Billing Card */}
      <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Current Plan</span>
            <h3 className="text-xl font-extrabold text-slate-950 dark:text-white mt-0.5">
              {currentPlan?.label || humanizeKey(access?.planKey) || 'Freemium'}
            </h3>
            <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
              {currentPlan?.key === 'freemium' ? 'Starter plan for getting a business up and running.' : currentPlan?.description}
            </p>
          </div>
          <div className="self-start sm:self-center">
            <StatusPill
              label={resolveSubscriptionLabel(
                t,
                displayBillingStatus === 'cancelling' ? 'billingStatusLabels' : 'subscriptionStatusLabels',
                displayBillingStatus || access?.subscriptionStatus || currentPlan?.subscriptionStatus
              )}
              tone={getStatusTone(displayBillingStatus || access?.subscriptionStatus || currentPlan?.subscriptionStatus)}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 dark:border-slate-800 sm:grid-cols-3 text-xs">
          <div>
            <span className="text-[11px] text-slate-400 dark:text-slate-505 uppercase tracking-wider font-semibold">
              {t('adminPage.plan.currentPlanFields.billingCycle')}
            </span>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {resolveSubscriptionLabel(t, 'billingCycleLabels', currentPlan?.billingCycle) || 'Free'}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 dark:text-slate-505 uppercase tracking-wider font-semibold">
              {t('adminPage.plan.currentPlanFields.billingAmount')}
            </span>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
              {currentPlan?.key === 'freemium' ? 'Free' : formatMoney(currentPlan?.billingAmount, t)}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 dark:text-slate-555 uppercase tracking-wider font-semibold">
              {showCancelledBanner
                ? t('adminPage.plan.currentPlanFields.endDate')
                : t('adminPage.plan.currentPlanFields.nextBillingDate')}
            </span>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
              {formatSubscriptionStatusDate(
                cancellation?.effectiveUntil || currentPlan?.nextBillingDate || currentPlan?.subscriptionEndDate,
                locale
              )}
            </p>
          </div>
        </div>
      </div>

      {showCancelledBanner ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-900/40 dark:bg-amber-950/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                <CalendarClock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {t('adminPage.plan.cancelledBannerTitle')}
                </h4>
                <p className="mt-1 text-xs leading-5 text-amber-800/85 dark:text-amber-300/85">
                  {t('adminPage.plan.cancelledBannerDescription', { date: effectiveUntilDate })}
                </p>
              </div>
            </div>
            {canReactivateSubscription ? (
              <button
                type="button"
                className="btn-primary whitespace-nowrap"
                disabled={mutationBusy}
                onClick={() => setConfirmAction('reactivate')}
              >
                {actionLoading === 'reactivate'
                  ? t('adminPage.plan.reactivatingCta')
                  : t('adminPage.plan.reactivateSubscriptionCta')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showExpiredRenewHint ? (
        <Notice title={t('adminPage.plan.expiredRenewHint')} tone="warn" />
      ) : null}

      {pendingChange && isOwner ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-6 dark:border-sky-900/40 dark:bg-sky-950/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-bold text-sky-900 dark:text-sky-200">
                {t('adminPage.plan.pendingTitle')}
              </h4>
              <p className="mt-1 text-xs text-sky-800/80 dark:text-sky-300/85">
                {t('adminPage.plan.pendingDescription', {
                  plan: pendingChange.label || humanizeKey(pendingChange.key),
                  date: formatSubscriptionStatusDate(pendingChange.requestedAt || pendingChange.createdAt, locale),
                })}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary whitespace-nowrap"
              disabled={mutationBusy}
              onClick={() => setConfirmAction('clearPending')}
            >
              {actionLoading === 'clearPending'
                ? t('adminPage.plan.cancellingCta')
                : t('adminPage.plan.cancelPendingCta')}
            </button>
          </div>
        </div>
      ) : null}

      {canCancelSubscription ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('adminPage.plan.cancellationTitle')}
                </h4>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {t('adminPage.plan.cancellationSubtitle')}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
              disabled={mutationBusy}
              onClick={() => setConfirmAction('cancel')}
            >
              {actionLoading === 'cancel'
                ? t('adminPage.plan.cancellingCta')
                : t('adminPage.plan.cancelSubscriptionCta')}
            </button>
          </div>
        </div>
      ) : null}

      {/* Action Required: Payment Banner */}
      {access?.requiresPaymentSetup && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 dark:border-amber-900/40 dark:bg-amber-950/10 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              <WalletCards size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">Complete Upgrading to Growth Plan</h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-400/85 mt-0.5">
                Your request is pending payment setup. Choose a provider below to securely finalize your upgrade.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-amber-200/50 pt-4 dark:border-amber-900/30">
            <div className="text-sm">
              <span className="text-xs text-slate-450 dark:text-slate-500 block">Amount Due</span>
              <strong className="text-base text-slate-850 dark:text-slate-200">
                {pendingChange?.billingAmount !== undefined
                  ? formatMoney(pendingChange.billingAmount, t)
                  : 'Rs. 12,000.00'}
              </strong>
              <span className="text-xs text-slate-450 capitalize ml-1">({pendingChange?.billingCycle || 'yearly'})</span>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handleInitiatePayment('esewa')}
                disabled={Boolean(paymentLoading)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
              >
                {paymentLoading === 'esewa' ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-white text-[9px] font-bold text-emerald-600 font-serif">e</span>
                )}
                Pay with eSewa
              </button>
              <button
                type="button"
                onClick={() => handleInitiatePayment('khalti')}
                disabled={Boolean(paymentLoading)}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:opacity-50"
              >
                {paymentLoading === 'khalti' ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-white text-[9px] font-bold text-violet-600 font-serif">K</span>
                )}
                Pay with Khalti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Plans Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Available Packages
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select the right tier to fuel your business growth.
          </p>
        </div>

        {!orderedPlans.length ? (
          <Notice title={t('adminPage.plan.noPlans')} tone="info" />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {orderedPlans.map((plan) => {
              const selectedCycle = planSelections[plan.key] || getPreferredBillingCycle(plan, currentPlan, pendingChange);
              const billingOption = Array.isArray(plan.billingOptions)
                ? plan.billingOptions.find((option) => option.cycle === selectedCycle) || plan.billingOptions[0] || null
                : null;
              const isCurrentPlan = currentPlan?.key === plan.key;
              const isPendingPlan = pendingChange?.key === plan.key;
              const isSubmitting = activePlanKey === plan.key;

              // Growth plan accent styles
              const isGrowth = plan.key === 'growth';

              return (
                <div
                  id={`subscription-plan-${plan.key}`}
                  key={plan.key}
                  className={`relative flex flex-col justify-between rounded-2xl border p-6 shadow-sm transition ${
                    isGrowth
                      ? 'border-indigo-500/80 bg-indigo-50/20 dark:border-indigo-500/50 dark:bg-indigo-950/15 ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white dark:border-slate-800/80 dark:bg-slate-900/40'
                  }`}
                >
                  {isGrowth && (
                    <span className="absolute -top-3 right-6 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                      Recommended
                    </span>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">{plan.label}</h4>
                      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[36px]">
                        {plan.description || t('adminPage.fallback.na')}
                      </p>
                    </div>

                    <div className="py-2">
                      <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {plan.key === 'freemium'
                          ? 'Free'
                          : billingOption?.amountConfigured && billingOption?.amount !== null
                            ? formatMoney(billingOption.amount, t)
                            : 'Quote'}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-1">
                        {plan.key === 'freemium' ? 'Forever' : plan.key === 'custom' ? 'Custom terms' : `per ${selectedCycle}`}
                      </p>
                    </div>

                    {/* Cycle Toggle Selector */}
                    {plan.key !== 'custom' && plan.billingOptions && plan.billingOptions.length > 1 && (
                      <div className="flex bg-slate-100/80 dark:bg-slate-800/60 p-0.5 rounded-lg text-[10px]">
                        {plan.billingOptions.map((option) => (
                          <button
                            key={option.cycle}
                            type="button"
                            onClick={() => setPlanSelections((current) => ({
                              ...current,
                              [plan.key]: option.cycle,
                            }))}
                            className={`flex-1 text-center py-1.5 rounded-md font-semibold transition ${
                              selectedCycle === option.cycle
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                            }`}
                          >
                            {option.cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-8">
                    {isCurrentPlan ? (
                      <button
                        type="button"
                        disabled
                        className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      >
                        Active Plan
                      </button>
                    ) : plan.key === 'custom' ? (
                      <a
                        href="mailto:support@lekhago.com?subject=LekhaGO%20Custom%20Plan%20Inquiry"
                        className="w-full text-center inline-flex items-center justify-center rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
                      >
                        Contact Us
                      </a>
                    ) : (plan.isPaid || plan.key === 'growth') ? (
                      <div className="space-y-2">
                        {/* We offer eSewa/Khalti direct checkout selectors */}
                        <button
                          type="button"
                          onClick={() => handleInitiatePayment('esewa', plan)}
                          disabled={Boolean(paymentLoading)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 py-2.5 text-xs font-bold text-emerald-850 transition hover:bg-emerald-100/50 disabled:opacity-60"
                        >
                          {paymentLoading === 'esewa' ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-850 border-t-transparent" />
                          ) : (
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-600 text-[8px] font-bold text-white font-serif">e</span>
                          )}
                          Pay with eSewa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInitiatePayment('khalti', plan)}
                          disabled={Boolean(paymentLoading)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50/50 py-2.5 text-xs font-bold text-violet-850 transition hover:bg-violet-100/50 disabled:opacity-60"
                        >
                          {paymentLoading === 'khalti' ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-850 border-t-transparent" />
                          ) : (
                            <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-650 text-[8px] font-bold text-white font-serif">K</span>
                          )}
                          Pay with Khalti
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handlePlanChange(plan)}
                        disabled={isSubmitting || !isOwner}
                        className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                      >
                        {isSubmitting ? 'Saving...' : 'Switch Plan'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Staff Capacity Panel */}
      {isOwner ? (
        <div className="border-t border-slate-100 pt-6 dark:border-slate-800">
          <TeamSeatUsagePanel
            summary={staffSummary}
            staffing={subscriptionData?.staffing || subscription?.staffing}
            loading={loading}
            t={t}
          />
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={confirmAction === 'cancel'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleCancelSubscription}
        confirming={actionLoading === 'cancel'}
        title={t('adminPage.plan.cancelSubscriptionConfirmTitle')}
        confirmLabel={t('adminPage.plan.cancelSubscriptionCta')}
        description={(
          <div className="space-y-2">
            <p>{t('adminPage.plan.cancelSubscriptionConfirmLead')}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t('adminPage.plan.cancelSubscriptionNoRefund')}</li>
              <li>{t('adminPage.plan.cancelSubscriptionAccessUntil', { date: effectiveUntilDate })}</li>
              <li>{t('adminPage.plan.cancelSubscriptionStopsRenewal')}</li>
            </ul>
          </div>
        )}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'reactivate'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleReactivateSubscription}
        confirming={actionLoading === 'reactivate'}
        variant="primary"
        title={t('adminPage.plan.reactivateConfirmTitle')}
        confirmLabel={t('adminPage.plan.reactivateSubscriptionCta')}
        description={t('adminPage.plan.reactivateConfirmDescription')}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'clearPending'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleClearPendingChange}
        confirming={actionLoading === 'clearPending'}
        title={t('adminPage.plan.cancelPendingConfirmTitle')}
        confirmLabel={t('adminPage.plan.cancelPendingCta')}
        description={t('adminPage.plan.cancelPendingConfirmDescription')}
      />
    </div>
  );
}


