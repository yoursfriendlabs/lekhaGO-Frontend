import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, ReceiptText, ShoppingCart, Users } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n.jsx';
import { buildSettingsTabPath, SUBSCRIPTION_SETTINGS_TAB } from '../../lib/settingsTabs';

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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const showUpgrade = shouldShowUpgradeCta(subscription, role);
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

  const buttonLabel = t('upgradePrompt.button');
  const buttonClasses = className || 'btn-primary justify-center';

  return (
    <>
      {variant === 'sidebar' ? (
        <div className="rounded-3xl border border-[#9b6835]/20 bg-gradient-to-br from-[#fff7ed] via-white to-[#f8efe4] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6835]">
            {t('upgradePrompt.sidebarEyebrow')}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{t('upgradePrompt.sidebarTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{t('upgradePrompt.sidebarDescription')}</p>
          <button type="button" className={`${buttonClasses} mt-4 w-full`} onClick={() => setOpen(true)}>
            <span className="flex items-center justify-center gap-2">
              {buttonLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </button>
        </div>
      ) : (
        <button type="button" className={buttonClasses} onClick={() => setOpen(true)}>
          <span className="flex items-center justify-center gap-2">
            {buttonLabel}
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
