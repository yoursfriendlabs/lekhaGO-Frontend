import { ArrowRight, CalendarDays, Clock3, Sparkles, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatMaybeDate } from '../../lib/datetime';
import { useI18n } from '../../lib/i18n.jsx';
import { getSubscriptionStatusState } from '../../lib/subscription';
import { buildSettingsTabPath, SUBSCRIPTION_SETTINGS_TAB } from '../../lib/settingsTabs';

export function formatSubscriptionStatusDate(value, locale) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return formatMaybeDate(value, 'D MMM YYYY');
  }

  return new Intl.DateTimeFormat(locale === 'ne' ? 'ne-NP' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function formatSubscriptionDaysRemainingLabel(daysRemaining, t) {
  if (typeof daysRemaining !== 'number') return '';
  if (daysRemaining < 0) return t('adminPage.plan.daysRemainingExpired', { count: Math.abs(daysRemaining) });
  if (daysRemaining === 0) return t('adminPage.plan.daysRemainingToday');
  return t('adminPage.plan.daysRemainingValue', { count: daysRemaining });
}

function MetaPill({ icon: Icon, label, tone = 'default' }) {
  const tones = {
    default: 'border-white/70 bg-white/80 text-slate-700 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-200',
    warn: 'border-amber-200/80 bg-amber-50/90 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100',
    danger: 'border-rose-200/80 bg-rose-50/90 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100',
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium ${tones[tone] || tones.default}`}>
      <Icon size={16} aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function SubscriptionStatusBannerSkeleton() {
  return (
    <div
      aria-hidden
      className="mb-6 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70"
    >
      <div className="animate-pulse space-y-4">
        <div className="h-3 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
        <div className="h-8 w-3/4 rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-4 w-full rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-wrap gap-3">
          <div className="h-10 w-44 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-36 rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionStatusBanner({ subscription }) {
  const { locale, t } = useI18n();
  const status = getSubscriptionStatusState(subscription);

  if (status.kind === 'none') return null;

  const hasTrialEndDate = Boolean(status.trial?.endsAt);
  const trialEndDate = formatSubscriptionStatusDate(status.trial?.endsAt, locale);
  const daysRemainingLabel = formatSubscriptionDaysRemainingLabel(status.trial?.daysRemaining, t);
  const ctaLabel = status.kind === 'expired'
    ? t('appAccess.upgradePlanCta')
    : t('settingsPage.subscription.reviewPlansCta');
  const tone = status.kind === 'expired'
    ? {
      container: 'border-rose-200/80 bg-gradient-to-r from-rose-50 to-white dark:border-rose-400/30 dark:from-rose-500/10 dark:to-slate-950',
      eyebrow: 'text-rose-700 dark:text-rose-100',
      title: 'text-rose-950 dark:text-white',
      body: 'text-rose-900/80 dark:text-rose-100/90',
      pill: 'danger',
      iconBg: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-100',
    }
    : status.kind === 'trial-expiring'
      ? {
        container: 'border-amber-200/80 bg-gradient-to-r from-amber-50 to-white dark:border-amber-400/30 dark:from-amber-500/10 dark:to-slate-950',
        eyebrow: 'text-amber-700 dark:text-amber-100',
        title: 'text-amber-950 dark:text-white',
        body: 'text-amber-900/80 dark:text-amber-100/90',
        pill: 'warn',
        iconBg: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100',
      }
      : {
        container: 'border-primary/20 bg-gradient-to-r from-primary/10 via-white to-white dark:border-primary/30 dark:from-primary/15 dark:via-slate-950 dark:to-slate-950',
        eyebrow: 'text-primary-700 dark:text-primary-100',
        title: 'text-slate-950 dark:text-white',
        body: 'text-slate-700 dark:text-slate-200',
        pill: 'default',
        iconBg: 'bg-primary/15 text-primary-700 dark:bg-primary/20 dark:text-primary-100',
      };
  const title = status.kind === 'expired'
    ? t('appAccess.expiredTitle')
    : status.kind === 'trial-expiring'
      ? t('appAccess.trialExpiringTitle')
      : t('appAccess.trialTitle');
  const description = status.kind === 'expired'
    ? t('appAccess.expiredDescription')
    : status.kind === 'trial-expiring'
      ? t('appAccess.trialExpiringDescription', { date: trialEndDate })
      : t('appAccess.trialDescription', { date: trialEndDate });
  const Icon = status.kind === 'expired' || status.kind === 'trial-expiring' ? TriangleAlert : Sparkles;
  const iconLabel = status.kind === 'expired'
    ? t('appAccess.expiredEyebrow')
    : status.kind === 'trial-expiring'
      ? t('appAccess.trialExpiringEyebrow')
      : t('appAccess.trialEyebrow');

  return (
    <section
      aria-live="polite"
      role={status.kind === 'expired' ? 'alert' : 'status'}
      className={`mb-6 overflow-hidden rounded-3xl border p-5 shadow-sm transition-colors sm:p-6 ${tone.container}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.iconBg}`}>
              <Icon size={20} aria-hidden />
            </div>
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${tone.eyebrow}`}>
              {iconLabel}
            </p>
          </div>
          <h2 className={`mt-4 font-serif text-xl sm:text-2xl ${tone.title}`}>
            {title}
          </h2>
          <p className={`mt-2 max-w-3xl text-sm leading-6 ${tone.body}`}>
            {description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {hasTrialEndDate ? (
              <MetaPill
                icon={CalendarDays}
                label={t('appAccess.trialEndsOn', { date: trialEndDate })}
                tone={tone.pill}
              />
            ) : null}
            {daysRemainingLabel ? (
              <MetaPill
                icon={Clock3}
                label={daysRemainingLabel}
                tone={status.kind === 'expired' ? 'danger' : status.kind === 'trial-expiring' ? 'warn' : 'default'}
              />
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <Link
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 ${
              status.kind === 'expired'
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : status.kind === 'trial-expiring'
                  ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                  : 'bg-primary text-white hover:bg-primary/90'
            }`}
            to={buildSettingsTabPath(SUBSCRIPTION_SETTINGS_TAB)}
          >
            {ctaLabel}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
