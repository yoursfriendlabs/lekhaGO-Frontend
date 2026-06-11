import { Clock3, LogOut, Sparkles, TriangleAlert } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { getSubscriptionStatusState } from '../lib/subscription.js';
import TaskNotificationsButton from './tasks/TaskNotificationsButton.jsx';
import { formatSubscriptionDaysRemainingLabel, formatSubscriptionStatusDate } from './subscription/SubscriptionStatusBanner.jsx';
import UpgradeSubscriptionCta, { shouldShowUpgradeCta } from './subscription/UpgradeSubscriptionCta.jsx';

export default function Topbar() {
  const { user, logout, role, subscription } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const { locale, setLocale, t } = useI18n();

  const subscriptionAccess = subscription?.access || null;
  const subscriptionStatus = getSubscriptionStatusState(subscription);
  const isActiveTrial = subscriptionStatus.kind === 'trial' || subscriptionStatus.kind === 'trial-expiring';
  const trialEndDate = formatSubscriptionStatusDate(subscriptionStatus.trial?.endsAt, locale);
  const trialDaysRemainingLabel = formatSubscriptionDaysRemainingLabel(subscriptionStatus.trial?.daysRemaining, t);
  const trialStatusLabel = trialDaysRemainingLabel || (subscriptionStatus.trial?.endsAt
    ? t('appAccess.trialEndsShort', { date: trialEndDate })
    : '');
  const planLabel = subscription?.currentPlan?.label || (subscriptionAccess?.planKey ? humanizePlanKey(subscriptionAccess.planKey) : '');
  const showUpgradeAction = shouldShowUpgradeCta(subscription, role) && !isActiveTrial;
  const businessLabel = String(businessProfile?.label || '').trim();
  const userLabel = String(user?.name || '').trim();
  const title = businessLabel || userLabel || t('topbar.welcome');
  const supportingText = [
    businessLabel && userLabel && businessLabel !== userLabel ? userLabel : '',
    !isActiveTrial && planLabel ? planLabel : '',
    subscriptionAccess?.hasPendingChange ? t('topbar.pendingPlan') : '',
  ].filter(Boolean).join(' · ');
  const trialBadgeClass = subscriptionStatus.kind === 'trial-expiring'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
    : 'border-primary/20 bg-primary/10 text-primary-700 dark:border-primary/30 dark:bg-primary/15 dark:text-primary-200';

  return (
    <header className="sticky top-0 z-20 border-b border-secondary-200/80 bg-white/92 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur md:px-6 md:py-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
          <h2 className="truncate font-serif text-base text-ink sm:text-lg">{title}</h2>
          {supportingText ? (
            <p className="mt-1 truncate text-xs font-medium text-secondary-500">{supportingText}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <TaskNotificationsButton t={t} />

          {isActiveTrial && trialStatusLabel ? (
            <span className={`inline-flex max-w-[8.75rem] items-center gap-1.5 rounded-full border px-2.5 py-2 text-[11px] font-semibold sm:max-w-none sm:px-3 ${trialBadgeClass}`}>
              {subscriptionStatus.kind === 'trial-expiring'
                ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                : <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              <Clock3 className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden />
              <span className="truncate">{trialStatusLabel}</span>
            </span>
          ) : null}

          {showUpgradeAction ? (
            <UpgradeSubscriptionCta className="btn-primary min-h-[42px] px-3 py-2 text-xs md:px-4 md:text-sm" />
          ) : null}

          <button
            onClick={() => setLocale(locale === 'en' ? 'ne' : 'en')}
            className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-base transition-transform active:scale-95"
            aria-label={t('topbar.language')}
            title={t('topbar.language')}
            type="button"
          >
            {locale === 'en' ? '🇳🇵' : '🇬🇧'}
          </button>

          <button
            className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border border-secondary-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 transition-transform active:scale-95"
            onClick={logout}
            type="button"
            aria-label={t('topbar.logout')}
            title={t('topbar.logout')}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden md:inline">{t('topbar.logout')}</span>
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
