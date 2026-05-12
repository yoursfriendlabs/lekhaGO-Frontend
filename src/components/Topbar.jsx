import { CalendarDays, Clock3, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { getSubscriptionStatusState } from '../lib/subscription.js';
import { formatSubscriptionDaysRemainingLabel, formatSubscriptionStatusDate } from './subscription/SubscriptionStatusBanner.jsx';
import UpgradeSubscriptionCta from './subscription/UpgradeSubscriptionCta.jsx';

export default function Topbar() {
  const { user, logout, subscription } = useAuth();
  const { businessProfile } = useBusinessSettings();

  const { locale, setLocale, t } = useI18n();
  const subscriptionAccess = subscription?.access || null;
  const subscriptionStatus = getSubscriptionStatusState(subscription);
  const isActiveTrial = subscriptionStatus.kind === 'trial' || subscriptionStatus.kind === 'trial-expiring';
  const trialEndDate = formatSubscriptionStatusDate(subscriptionStatus.trial?.endsAt, locale);
  const trialDaysRemainingLabel = formatSubscriptionDaysRemainingLabel(subscriptionStatus.trial?.daysRemaining, t);
  const planStatus = String(subscriptionAccess?.subscriptionStatus || subscription?.currentPlan?.subscriptionStatus || '').toLowerCase();
  const planLabel = subscription?.currentPlan?.label || (subscriptionAccess?.planKey ? `${humanizePlanKey(subscriptionAccess.planKey)}` : '');
  const planBadgeClass = isActiveTrial
    ? subscriptionStatus.kind === 'trial-expiring'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      : 'border-primary/20 bg-primary/10 text-primary-700 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200'
    : planStatus === 'expired'
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
    : planStatus === 'expiring-soon'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      : subscriptionAccess?.requiresPaymentSetup || subscriptionAccess?.requiresManualReview
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
      : 'border-primary/20 bg-primary/10 text-primary-700 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200';
  const refreshWorkspace = () => {
    if (typeof window === 'undefined') return;
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-secondary-200 bg-white/85 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
          <h2 className="truncate font-serif text-lg text-ink sm:text-xl">{user?.name || t('topbar.welcome')}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {businessProfile?.label ? (
              <p className="truncate text-xs font-medium text-secondary-500">{businessProfile.label}</p>
            ) : null}
            {planLabel ? (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${planBadgeClass}`}>
                {planLabel}
                {subscriptionAccess?.hasPendingChange ? ` · ${t('topbar.pendingPlan')}` : ''}
              </span>
            ) : null}
          </div>
          {isActiveTrial ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  subscriptionStatus.kind === 'trial-expiring'
                    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'border-primary/20 bg-primary/10 text-primary-700 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200'
                }`}
              >
                {subscriptionStatus.kind === 'trial-expiring' ? <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
                {subscriptionStatus.kind === 'trial-expiring' ? t('appAccess.trialExpiringEyebrow') : t('appAccess.trialEyebrow')}
              </span>
              {trialDaysRemainingLabel ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  {trialDaysRemainingLabel}
                </span>
              ) : null}
              {subscriptionStatus.trial?.endsAt ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {t('appAccess.trialEndsShort', { date: trialEndDate })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2 md:hidden">
          <button
            className="rounded-xl border border-secondary-200 bg-white p-2 text-secondary-700 active:scale-95 transition-transform"
            onClick={refreshWorkspace}
            type="button"
            aria-label={t('topbar.refresh')}
            title={t('topbar.refresh')}
          >
            <RefreshCw size={18} />
          </button>
          <div className="">
            <button 
              onClick={() => setLocale(locale === 'en' ? 'ne' : 'en')} 
              className="bg-amber-50 border rounded-xl px-3 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center border-amber-400 active:scale-95 transition-transform"
              aria-label="Toggle language"
            >
              { locale === 'en' ? '🇳🇵' : '🇬🇧' }
            </button>
          </div>
          <button 
            className="rounded-full bg-secondary-100 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-rose-500 active:scale-95 transition-transform" 
            onClick={logout} 
            type="button"
            aria-label="Logout"
          >
            🚪
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
        <UpgradeSubscriptionCta className={`${isActiveTrial ? 'btn-secondary' : 'btn-primary'} w-full justify-center md:w-auto`} />
        <div className="hidden gap-2 md:flex md:items-center">
          <button className="btn-ghost gap-2" onClick={refreshWorkspace} type="button" title={t('topbar.refresh')}>
            <RefreshCw size={16} />
            {t('topbar.refresh')}
          </button>
          <button onClick={() => setLocale(locale === 'en' ? 'ne' : 'en')} className="bg-amber-50 border rounded-xl px-2 border-amber-400">
            { locale === 'en' ? '🇳🇵' : '🇬🇧' }
          </button>
        </div>
        <div className="hidden gap-2 md:flex">
          <button className="btn-ghost" onClick={logout} type="button">
            {t('topbar.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}

function humanizePlanKey(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .trim();
}
