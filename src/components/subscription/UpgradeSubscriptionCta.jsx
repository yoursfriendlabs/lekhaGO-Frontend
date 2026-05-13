import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CalendarDays, Clock3, ReceiptText, ShoppingCart, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n.jsx';
import { getSubscriptionStatusState } from '../../lib/subscription.js';
import { buildSettingsTabPath, SUBSCRIPTION_SETTINGS_TAB } from '../../lib/settingsTabs';
import { formatSubscriptionDaysRemainingLabel, formatSubscriptionStatusDate } from './SubscriptionStatusBanner.jsx';

const PAID_PLAN_KEYS = new Set(['growth', 'custom']);

export function shouldShowUpgradeCta(subscription, role) {
  if (role !== 'owner') return false;

  const currentPlanKey = String(subscription?.currentPlan?.key || subscription?.access?.planKey || '')
    .trim()
    .toLowerCase();

  return !PAID_PLAN_KEYS.has(currentPlanKey);
}

export default function UpgradeSubscriptionCta({ variant = 'button', className = '' }) {
  const navigate = useNavigate();
  const { role, subscription } = useAuth();
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);

  const showUpgrade = shouldShowUpgradeCta(subscription, role);
  const subscriptionStatus = getSubscriptionStatusState(subscription);
  const isActiveTrial = subscriptionStatus.kind === 'trial' || subscriptionStatus.kind === 'trial-expiring';
  const trialEndDate = formatSubscriptionStatusDate(subscriptionStatus.trial?.endsAt, locale);
  const trialDaysRemainingLabel = formatSubscriptionDaysRemainingLabel(subscriptionStatus.trial?.daysRemaining, t);
  const benefits = useMemo(
    () => [
      {
        key: 'expenses',
        icon: ShoppingCart,
        title: t('upgradePrompt.benefits.expensesTitle'),
        description: t('upgradePrompt.benefits.expensesDescription'),
      },
      {
        key: 'parties',
        icon: Users,
        title: t('upgradePrompt.benefits.partiesTitle'),
        description: t('upgradePrompt.benefits.partiesDescription'),
      },
      {
        key: 'brand',
        icon: Building2,
        title: t('upgradePrompt.benefits.brandTitle'),
        description: t('upgradePrompt.benefits.brandDescription'),
      },
      {
        key: 'controls',
        icon: ReceiptText,
        title: t('upgradePrompt.benefits.controlsTitle'),
        description: t('upgradePrompt.benefits.controlsDescription'),
      },
    ],
    [t]
  );

  if (!showUpgrade) return null;

  const openPlans = () => {
    setOpen(false);
    navigate(buildSettingsTabPath(SUBSCRIPTION_SETTINGS_TAB));
  };

  const handlePrimaryAction = () => {
    if (isActiveTrial) {
      openPlans();
      return;
    }

    setOpen(true);
  };

  const buttonLabel = t('upgradePrompt.button');
  const buttonClasses = className || 'btn-primary justify-center';

  return (
    <>
      {variant === 'sidebar' ? (
        isActiveTrial ? (
          <div
            className={`rounded-3xl border p-4 shadow-sm ${
              subscriptionStatus.kind === 'trial-expiring'
                ? 'border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-white'
                : 'border-primary/20 bg-gradient-to-br from-primary/10 via-white to-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                  subscriptionStatus.kind === 'trial-expiring'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-primary/15 text-primary-700'
                }`}
              >
                {subscriptionStatus.kind === 'trial-expiring' ? <TriangleAlert className="h-5 w-5" aria-hidden /> : <Sparkles className="h-5 w-5" aria-hidden />}
              </div>
              <div className="min-w-0">
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                    subscriptionStatus.kind === 'trial-expiring' ? 'text-amber-700' : 'text-primary-700'
                  }`}
                >
                  {subscriptionStatus.kind === 'trial-expiring' ? t('appAccess.trialExpiringEyebrow') : t('appAccess.trialEyebrow')}
                </p>
                <h3 className="mt-1 text-base font-semibold text-slate-900">
                  {subscriptionStatus.kind === 'trial-expiring' ? t('appAccess.trialExpiringTitle') : t('appAccess.trialTitle')}
                </h3>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {subscriptionStatus.trial?.endsAt ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-medium text-slate-700">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  {t('appAccess.trialEndsShort', { date: trialEndDate })}
                </span>
              ) : null}
              {trialDaysRemainingLabel ? (
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
                    subscriptionStatus.kind === 'trial-expiring'
                      ? 'border-amber-200/80 bg-amber-50/90 text-amber-800'
                      : 'border-slate-200/80 bg-white/90 text-slate-700'
                  }`}
                >
                  <Clock3 className="h-4 w-4" aria-hidden />
                  {trialDaysRemainingLabel}
                </span>
              ) : null}
            </div>
            <button type="button" className={`${buttonClasses} mt-4 w-full`} onClick={openPlans}>
              <span className="flex items-center justify-center gap-2">
                {t('appAccess.upgradePlanCta')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-[#9b6835]/20 bg-gradient-to-br from-[#fff7ed] via-white to-[#f8efe4] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6835]">
              {t('upgradePrompt.sidebarEyebrow')}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900">{t('upgradePrompt.sidebarTitle')}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('upgradePrompt.sidebarDescription')}</p>
            <button type="button" className={`${buttonClasses} mt-4 w-full`} onClick={handlePrimaryAction}>
              <span className="flex items-center justify-center gap-2">
                {buttonLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </button>
          </div>
        )
      ) : (
        <button type="button" className={buttonClasses} onClick={handlePrimaryAction}>
          <span className="flex items-center justify-center gap-2">
            {isActiveTrial ? t('appAccess.upgradePlanCta') : buttonLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </button>
      )}

      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('upgradePrompt.title')}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              {t('common.close')}
            </button>
            <button type="button" className="btn-primary" onClick={openPlans}>
              {t('upgradePrompt.openPlans')}
            </button>
          </>
        )}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-900">
            <p className="font-semibold">{t('upgradePrompt.description')}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;

              return (
                <div
                  key={benefit.key}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9b6835]/10 text-[#9b6835]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-slate-900">{benefit.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.description}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{t('upgradePrompt.noteTitle')}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{t('upgradePrompt.noteDescription')}</p>
          </div>
        </div>
      </Dialog>
    </>
  );
}
