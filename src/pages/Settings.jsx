import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, Package2, ShieldCheck, Upload, Users, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import AccountSecurityPanel from '../components/account/AccountSecurityPanel.jsx';
import BanksSettingsPanel from '../components/settings/BanksSettingsPanel.jsx';
import CategoriesSettingsPanel from '../components/settings/CategoriesSettingsPanel.jsx';
import ExpensesCategoriesSettingsPanel from '../components/settings/ExpensesCategoriesSettingsPanel.jsx';
import OrderAttributesSettingsPanel from '../components/settings/OrderAttributesSettingsPanel.jsx';
import AppearanceSettingsPanel from '../components/settings/AppearanceSettingsPanel.jsx';
import ProfileSettingsPanel from '../components/settings/ProfileSettingsPanel.jsx';
import SubscriptionSettingsPanel from '../components/settings/SubscriptionSettingsPanel.jsx';
import UnitsSettingsPanel from '../components/settings/UnitsSettingsPanel.jsx';
import TablesFloorsSettingsPanel from '../components/settings/TablesFloorsSettingsPanel.jsx';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import { EMPTY_STAFF_SUMMARY } from '../lib/staff';
import { getSubscriptionGuard, getSubscriptionStatusState, humanizeKey } from '../lib/subscription';
import {
  ACCOUNT_SETTINGS_TAB,
  APPEARANCE_SETTINGS_TAB,
  BANKS_SETTINGS_TAB,
  CATEGORIES_SETTINGS_TAB,
  EXPENSE_CATEGORIES_SETTINGS_TAB,
  GENERAL_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
  PROFILE_SETTINGS_TAB,
  SUBSCRIPTION_SETTINGS_TAB,
  UNITS_SETTINGS_TAB,
  TABLES_FLOORS_SETTINGS_TAB,
} from '../lib/settingsTabs';

const EMPTY = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  panVat: '',
  logoUrl: '',
  irdModeEnabled: false,
  cbmsSyncEnabled: false,
  cbmsUsername: '',
  cbmsPassword: '',
  cbmsPasswordSet: false,
};

const PROFILE_TAB_KEYS = [PROFILE_SETTINGS_TAB, APPEARANCE_SETTINGS_TAB, SUBSCRIPTION_SETTINGS_TAB, ACCOUNT_SETTINGS_TAB];

function scrollToGrowthPlan() {
  if (typeof document === 'undefined') return;
  window.setTimeout(() => {
    document.getElementById('subscription-plan-growth')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, 0);
}

function SettingsStatCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-secondary-200/70 bg-surface/85 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">{label}</p>
          <p className="mt-3 break-words text-2xl font-semibold text-ink">{value}</p>
          <p className="mt-2 text-sm text-secondary-600">{hint}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const location = useLocation();
  const {
    accessControl,
    business,
    businessId,
    role,
    subscription,
    subscriptionAccess,
    canManageFeature,
    canViewFeature,
  } = useAuth();
  const { settings, businessProfile, loading: settingsLoading, saveSettings, reloadSettings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({ ...EMPTY, ...settings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);
  
  const [logoUploading, setLogoUploading] = useState(false);
  const [staffSummary, setStaffSummary] = useState(EMPTY_STAFF_SUMMARY);
  const [staffSummaryLoading, setStaffSummaryLoading] = useState(false);
  const fileRef = useRef(null);
  const isOwner = role === 'owner';
  const subscriptionGuard = getSubscriptionGuard(subscription);
  const subscriptionState = getSubscriptionStatusState(subscription);
  const generalLocked = isOwner && !canManageFeature('general-settings');

  const tabs = useMemo(() => {
    const nextTabs = [];

    if (isOwner) {
      nextTabs.push({
        key: GENERAL_SETTINGS_TAB,
        label: t('settingsPage.tabs.general'),
        description: generalLocked ? t('settingsPage.descriptions.generalLocked') : t('settingsPage.descriptions.general'),
      });
    }

    nextTabs.push(
      {
        key: PROFILE_SETTINGS_TAB,
        label: t('settingsPage.tabs.profile'),
        description: t('settingsPage.descriptions.profile'),
      },
      {
        key: APPEARANCE_SETTINGS_TAB,
        label: t('settingsPage.tabs.appearance'),
        description: t('settingsPage.descriptions.appearance'),
      },
      {
        key: ACCOUNT_SETTINGS_TAB,
        label: t('settingsPage.tabs.account'),
        description: t('settingsPage.descriptions.account'),
      }
    );

    // Fixed syntax missing closing brace block here
    if (canViewFeature('staff')) {
      // Intended staff context check boundary
    }

    if (canManageFeature('categories')) {
      nextTabs.push(
        {
          key: CATEGORIES_SETTINGS_TAB,
          label: t('settingsPage.tabs.categories'),
          description: t('settingsPage.descriptions.categories'),
        },
        {
          key: EXPENSE_CATEGORIES_SETTINGS_TAB,
          label: t('settingsPage.tabs.expenseCategories'),
          description: t('settingsPage.descriptions.expenseCategories'),
        }
      );

      const tablesEnabled = businessProfile?.settings?.enabledModules?.includes("tables") || businessProfile?.type === "cafe";
      if (tablesEnabled) {
        nextTabs.push({
          key: TABLES_FLOORS_SETTINGS_TAB,
          label: t('settingsPage.tabs.tablesFloors'),
          description: t('settingsPage.descriptions.tablesFloors'),
        });
      }
    }

    if (canManageFeature('units')) {
      nextTabs.push({
        key: UNITS_SETTINGS_TAB,
        label: t('settingsPage.tabs.units'),
        description: t('settingsPage.descriptions.units'),
      });
    }

    if (canManageFeature('banks')) {
      nextTabs.push({
        key: BANKS_SETTINGS_TAB,
        label: t('settingsPage.tabs.banks'),
        description: t('settingsPage.descriptions.banks'),
      });
    }

    if (canManageFeature('order-attributes')) {
      nextTabs.push({
        key: ORDER_ATTRIBUTES_SETTINGS_TAB,
        label: t('settingsPage.tabs.orderAttributes'),
        description: t('settingsPage.descriptions.orderAttributes'),
      });
    }
    
    if (canManageFeature('subscription')) {
      nextTabs.push({
        key: SUBSCRIPTION_SETTINGS_TAB,
        label: t('settingsPage.tabs.subscription'),
        description: t('settingsPage.descriptions.subscription'),
      });
    }

    return nextTabs;
  }, [canManageFeature, canViewFeature, generalLocked, isOwner, t]);

  const requestedTab = searchParams.get('tab');
  const companyTabs = useMemo(
    () => tabs.filter((tab) => !PROFILE_TAB_KEYS.includes(tab.key)),
    [tabs]
  );
  const profileTabs = useMemo(
    () => tabs.filter((tab) => PROFILE_TAB_KEYS.includes(tab.key)),
    [tabs]
  );
  const defaultCompanyTab = companyTabs[0]?.key || '';
  const defaultProfileTab = PROFILE_SETTINGS_TAB;
  const defaultTab = defaultCompanyTab || defaultProfileTab;
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : defaultTab;
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const routeNotice = location.state?.notice;
  const isProfileSection = PROFILE_TAB_KEYS.includes(activeTab);
  const visibleTabs = isProfileSection ? profileTabs : companyTabs;

  useEffect(() => {
    reloadSettings(businessId);
  }, [businessId, reloadSettings]);

  useEffect(() => {
    if (!businessId || !canViewFeature('staff')) {
      setStaffSummary(EMPTY_STAFF_SUMMARY);
      setStaffSummaryLoading(false);
      return undefined;
    }

    let active = true;
    setStaffSummaryLoading(true);

    api.listStaff()
      .then((payload) => {
        if (!active) return;
        setStaffSummary(payload?.summary || EMPTY_STAFF_SUMMARY);
      })
      .catch(() => {
        if (!active) return;
        setStaffSummary(EMPTY_STAFF_SUMMARY);
      })
      .finally(() => {
        if (!active) return;
        setStaffSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [businessId, canViewFeature]);

  useEffect(() => {
    setForm({
      ...EMPTY,
      ...settings,
      cbmsPassword: '',
      cbmsPasswordSet: Boolean(settings?.cbmsPasswordSet),
    });
  }, [settings]);

  const handleChange = (field, value) => {
    if (generalLocked) return;
    setSaved(false);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleUiPreferenceChange = (key, value) => {
    if (generalLocked) return;
    setSaved(false);
    setForm((previous) => ({
      ...previous,
      uiPreferences: {
        ...(previous.uiPreferences || {}),
        [key]: value,
      },
    }));
  };

  const openGrowthPlan = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', SUBSCRIPTION_SETTINGS_TAB);
    setSearchParams(nextParams);
    scrollToGrowthPlan();
  };

  const handleLogoChange = async (event) => {
    if (generalLocked) {
      openGrowthPlan();
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('settingsPage.general.logoFileError'));
      return;
    }

    setLogoUploading(true);
    setError('');

    try {
      const result = await api.uploadAttachment(file);
      const url = result?.url || result?.path || result?.filePath || '';
      handleChange('logoUrl', url);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (generalLocked) {
      setError(t('settingsPage.general.lockedError'));
      openGrowthPlan();
      return;
    }

    const email = (form.email || '').trim();
    if (email && !email.includes('@')) {
      setError(t('settingsPage.general.invalidEmail'));
      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const payload = {
        ...form,
        irdModeEnabled: Boolean(form.irdModeEnabled),
        cbmsSyncEnabled: Boolean(form.cbmsSyncEnabled),
        cbmsUsername: form.cbmsUsername || '',
      };
      delete payload.cbmsPasswordSet;
      if (String(form.cbmsPassword || '').trim()) {
        payload.cbmsPassword = form.cbmsPassword;
      } else {
        delete payload.cbmsPassword;
      }
      await saveSettings(payload, businessId);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTabChange = (tab) => {
    const nextParams = new URLSearchParams(searchParams);

    if (!tab || tab === defaultTab) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }

    setSearchParams(nextParams);
  };

  const handleCompanySettingClick = () => {
    handleTabChange(defaultCompanyTab);
  };

  const handleProfileSettingClick = () => {
    handleTabChange(defaultProfileTab);
  };

  const logoSrc = form.logoUrl
    ? form.logoUrl.startsWith('http')
      ? form.logoUrl
      : `${API_BASE}${form.logoUrl}`
    : null;
  const planLabel = subscription?.currentPlan?.label
    || (subscription?.access?.planKey ? humanizeKey(subscription.access.planKey) : t('settingsPage.overview.noPlan'));
  const planHint = subscriptionState.isTrialActive && typeof subscriptionState.trial?.daysRemaining === 'number'
    ? t('settingsPage.overview.planTrialHint', { count: subscriptionState.trial.daysRemaining })
    : subscriptionState.isExpired
      ? t('settingsPage.overview.planExpiredHint')
      : subscriptionAccess?.requiresPaymentSetup
        ? t('settingsPage.overview.planPaymentSetupHint')
        : subscriptionAccess?.requiresManualReview || subscriptionAccess?.hasPendingChange
          ? t('settingsPage.overview.planPendingHint')
          : t('settingsPage.overview.planActiveHint');
  const accessLabel = accessControl?.category?.label
    || (role ? humanizeKey(role) : t('settingsPage.overview.noAccessLabel'));
  const accessHint = accessControl?.jobTitle || t('settingsPage.overview.accessHint');
  const seatUsageValue = !businessId
    ? '-'
    : staffSummaryLoading
      ? '...'
      : staffSummary.maxUsers > 0
        ? `${staffSummary.totalUsers} / ${staffSummary.maxUsers}`
        : String(staffSummary.totalUsers || 0);
  const seatUsageHint = !businessId
    ? t('settingsPage.overview.businessMissingHint')
    : staffSummary.maxUsers > 0
      ? t('settingsPage.overview.teamSeatsHint', {
        used: staffSummary.totalUsers,
        total: staffSummary.maxUsers,
      })
      : t('staffManagement.summary.totalUsersHint');
  const openSlotsValue = !businessId
    ? '-'
    : staffSummaryLoading
      ? '...'
      : String(staffSummary.availableSlots || 0);
  const businessName = form.companyName?.trim()
    || settings?.companyName?.trim()
    || business?.name
    || business?.businessName
    || '';
  const overviewCards = [
    {
      key: 'plan',
      label: t('settingsPage.overview.currentPlan'),
      value: planLabel,
      hint: planHint,
      icon: Package2,
    },
    {
      key: 'access',
      label: t('settingsPage.overview.yourAccess'),
      value: accessLabel,
      hint: businessName
        ? t('settingsPage.overview.accessBusinessHint', { business: businessName })
        : accessHint,
      icon: ShieldCheck,
    },
    ...(canViewFeature('staff')
      ? [
        {
          key: 'seats',
          label: t('settingsPage.overview.teamSeats'),
          value: seatUsageValue,
          hint: seatUsageHint,
          icon: Users,
        },
        {
          key: 'open-slots',
          label: t('settingsPage.overview.openSlots'),
          value: openSlotsValue,
          hint: !businessId
            ? t('settingsPage.overview.businessMissingHint')
            : t('staffManagement.summary.availableSlotsHint'),
          icon: Users,
        },
      ]
      : []),
  ];

  return (
    <div className="min-w-0 max-w-6xl space-y-6 overflow-x-hidden">
      <PageHeader title={t('settingsPage.title')} subtitle={activeTabMeta?.description || t('settingsPage.subtitle')} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <SettingsStatCard
            key={card.key}
            label={card.label}
            value={card.value}
            hint={card.hint}
            icon={card.icon}
          />
        ))}
      </section>

      <div className="flex flex-wrap items-end gap-8 border-b border-secondary-200/80 pb-1">
        <button
          type="button"
          onClick={handleCompanySettingClick}
          aria-pressed={!isProfileSection}
          className={`relative pb-3 text-lg font-semibold transition-colors after:absolute after:left-0 after:-bottom-[1px] after:h-0.5 after:w-full after:origin-left after:rounded-full after:transition-transform after:duration-200 after:content-[''] ${
            !isProfileSection
              ? 'text-primary-600 after:scale-x-100 after:bg-primary-600'
              : 'text-secondary-500 after:scale-x-0 after:bg-transparent hover:text-ink-light'
          }`}
        >
          {t('settingsPage.sections.company')}
        </button>
        <button
          type="button"
          onClick={handleProfileSettingClick}
          aria-pressed={isProfileSection}
          className={`relative pb-3 text-lg font-semibold transition-colors after:absolute after:left-0 after:-bottom-[1px] after:h-0.5 after:w-full after:origin-left after:rounded-full after:transition-transform after:duration-200 after:content-[''] ${
            isProfileSection
              ? 'text-primary-600 after:scale-x-100 after:bg-primary-600'
              : 'text-secondary-500 after:scale-x-0 after:bg-transparent hover:text-ink-light'
          }`}
        >
          {t('settingsPage.sections.profile')}
        </button>
      </div>

      <div className="card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-400">
            {t('settingsPage.title')}
          </p>
          <h2 className="break-words font-serif text-xl text-ink">{activeTabMeta?.label}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <div className="contents lg:flex lg:flex-wrap lg:gap-2">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-semibold leading-tight transition lg:w-auto lg:px-4 lg:py-2.5 lg:text-left ${
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {routeNotice?.title ? (
        <Notice title={routeNotice.title} description={routeNotice.description} tone={routeNotice.tone || 'warn'} />
      ) : null}

      {activeTab === GENERAL_SETTINGS_TAB ? (
        <>
          {generalLocked ? (
            <div className="card space-y-4 border-amber-200/80 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                  {t('settingsPage.general.lockedEyebrow')}
                </p>
                <h3 className="font-serif text-xl text-ink">
                  {t('settingsPage.general.lockedTitle')}
                </h3>
                <p className="text-sm text-secondary-700">
                  {subscriptionGuard.description || t('settingsPage.general.lockedDescription')}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" className="btn-primary justify-center" onClick={openGrowthPlan}>
                  {t('settingsPage.general.unlockCta')}
                </button>
                {subscriptionAccess?.requiresPaymentSetup ? (
                  <span className="text-sm text-amber-800 dark:text-amber-100">
                    {t('settingsPage.general.checkoutHint')}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? <Notice title={error} tone="error" /> : null}

          {settingsLoading && !form.companyName ? (
            <div className="flex items-center gap-3 py-8 text-sm text-secondary-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              {t('settingsPage.general.loading')}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <fieldset className="space-y-6" disabled={generalLocked || saving || logoUploading}>
                <div className="card space-y-4">
                  <h2 className="font-serif text-lg text-ink">{t('settingsPage.general.logoTitle')}</h2>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-secondary-200 bg-mist dark:border-slate-700 dark:bg-slate-900/40">
                      {logoUploading ? (
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      ) : logoSrc ? (
                        <>
                          <img
                            src={logoSrc}
                            alt={t('settingsPage.general.logoAlt')}
                            className="h-full w-full object-contain p-1"
                          />
                          <button
                            type="button"
                            className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-secondary-500 shadow-sm hover:text-rose-600"
                            onClick={() => {
                              handleChange('logoUrl', '');
                              if (fileRef.current) fileRef.current.value = '';
                            }}
                            title={t('settingsPage.general.removeLogo')}
                          >
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <Building2 size={28} className="text-secondary-300 dark:text-secondary-700" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-secondary-700 dark:text-secondary-400">
                        {t('settingsPage.general.logoHelp')}
                      </p>
                      <button
                        type="button"
                        className="btn-secondary gap-2"
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload size={15} />
                        {logoUploading
                          ? t('settingsPage.general.uploading')
                          : logoSrc
                            ? t('settingsPage.general.replaceLogo')
                            : t('settingsPage.general.uploadLogo')}
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleLogoChange}
                      />
                    </div>
                  </div>
                </div>

                <div className="card space-y-5">
                  <h2 className="font-serif text-lg text-ink">{t('settingsPage.general.detailsTitle')}</h2>

                  <div className="space-y-1">
                    <label className="label" htmlFor="companyName">{t('settingsPage.general.companyName')}</label>
                    <input
                      id="companyName"
                      className="input"
                      placeholder={t('settingsPage.general.companyPlaceholder')}
                      value={form.companyName}
                      onChange={(event) => handleChange('companyName', event.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="label" htmlFor="address">{t('settingsPage.general.address')}</label>
                    <textarea
                      id="address"
                      className="input resize-none"
                      rows={3}
                      placeholder={t('settingsPage.general.addressPlaceholder')}
                      value={form.address}
                      onChange={(event) => handleChange('address', event.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="label" htmlFor="phone">{t('settingsPage.general.phone')}</label>
                      <input
                        id="phone"
                        className="input"
                        type="tel"
                        placeholder={t('settingsPage.general.phonePlaceholder')}
                        value={form.phone}
                        onChange={(event) => handleChange('phone', event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="label" htmlFor="email">{t('settingsPage.general.email')}</label>
                      <input
                        id="email"
                        className="input"
                        type="email"
                        placeholder={t('settingsPage.general.emailPlaceholder')}
                        value={form.email}
                        onChange={(event) => handleChange('email', event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="label" htmlFor="default-calendar">{t('settingsPage.general.defaultCalendar') || 'Default Date Calendar'}</label>
                    <select
                      id="default-calendar"
                      className="input"
                      value={form.uiPreferences?.defaultCalendar || 'ad'}
                      onChange={(event) => handleUiPreferenceChange('defaultCalendar', event.target.value)}
                    >
                      <option value="ad">{t('settingsPage.general.calendarAd') || 'English (AD)'}</option>
                      <option value="bs">{t('settingsPage.general.calendarBs') || 'Nepali (BS)'}</option>
                    </select>
                    <p className="text-xs text-secondary-400">
                      {t('settingsPage.general.defaultCalendarHint') || 'Choose whether dates are displayed in English (AD) or Nepali (BS) by default across the dashboard.'}
                    </p>
                  </div>
                </div>

                <div className="card space-y-5">
                  <h2 className="font-serif text-lg text-ink">{t('settingsPage.general.taxTitle')}</h2>
                  <div className="space-y-1">
                    <label className="label" htmlFor="panVat">{t('settingsPage.general.panVat')}</label>
                    <input
                      id="panVat"
                      className="input"
                      placeholder={t('settingsPage.general.panVatPlaceholder')}
                      value={form.panVat}
                      onChange={(event) => handleChange('panVat', event.target.value)}
                    />
                    <p className="mt-1 text-xs text-secondary-400">
                      {t('settingsPage.general.panVatHint')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-secondary-200/80 p-4 dark:border-slate-700/80">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <label className="label" htmlFor="irdModeEnabled">
                          {t('settingsPage.general.irdModeTitle')}
                        </label>
                        <p className="mt-1 text-sm text-secondary-500">
                          {t('settingsPage.general.irdModeHint')}
                        </p>
                      </div>
                      <button
                        id="irdModeEnabled"
                        type="button"
                        role="switch"
                        aria-checked={Boolean(form.irdModeEnabled)}
                        disabled={generalLocked}
                        onClick={() => handleChange('irdModeEnabled', !form.irdModeEnabled)}
                        className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                          form.irdModeEnabled
                            ? 'bg-emerald-600'
                            : 'bg-slate-300 dark:bg-slate-600'
                        } ${generalLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            form.irdModeEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {form.irdModeEnabled ? (
                      <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                        {t('settingsPage.general.irdModeWarning')}
                      </p>
                    ) : null}
                  </div>

                  {form.irdModeEnabled ? (
                    <div className="rounded-2xl border border-secondary-200/80 p-4 space-y-4 dark:border-slate-700/80">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <label className="label" htmlFor="cbmsSyncEnabled">
                            {t('settingsPage.general.cbmsSyncTitle')}
                          </label>
                          <p className="mt-1 text-sm text-secondary-500">
                            {t('settingsPage.general.cbmsSyncHint')}
                          </p>
                        </div>
                        <button
                          id="cbmsSyncEnabled"
                          type="button"
                          role="switch"
                          aria-checked={Boolean(form.cbmsSyncEnabled)}
                          disabled={generalLocked}
                          onClick={() => handleChange('cbmsSyncEnabled', !form.cbmsSyncEnabled)}
                          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${
                            form.cbmsSyncEnabled
                              ? 'bg-emerald-600'
                              : 'bg-slate-300 dark:bg-slate-600'
                          } ${generalLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              form.cbmsSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="label" htmlFor="cbmsUsername">
                            {t('settingsPage.general.cbmsUsername')}
                          </label>
                          <input
                            id="cbmsUsername"
                            className="input"
                            autoComplete="off"
                            placeholder={t('settingsPage.general.cbmsUsernamePlaceholder')}
                            value={form.cbmsUsername || ''}
                            onChange={(event) => handleChange('cbmsUsername', event.target.value)}
                            disabled={generalLocked || !form.cbmsSyncEnabled}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="label" htmlFor="cbmsPassword">
                            {t('settingsPage.general.cbmsPassword')}
                          </label>
                          <input
                            id="cbmsPassword"
                            className="input"
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                              form.cbmsPasswordSet
                                ? t('settingsPage.general.cbmsPasswordSetPlaceholder')
                                : t('settingsPage.general.cbmsPasswordPlaceholder')
                            }
                            value={form.cbmsPassword || ''}
                            onChange={(event) => handleChange('cbmsPassword', event.target.value)}
                            disabled={generalLocked || !form.cbmsSyncEnabled}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-secondary-400">
                        {t('settingsPage.general.cbmsSyncWarning')}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="submit" className="btn-primary px-8">
                    {saving ? t('settingsPage.general.saving') : t('settingsPage.general.saveCta')}
                  </button>
                  {saved ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle size={16} /> {t('settingsPage.general.saved')}
                    </span>
                  ) : null}
                </div>
              </fieldset>
            </form>
          )}
        </>
      ) : null}

      {activeTab === PROFILE_SETTINGS_TAB ? <ProfileSettingsPanel isOwner={isOwner} /> : null}
      {activeTab === APPEARANCE_SETTINGS_TAB ? <AppearanceSettingsPanel /> : null}
      {activeTab === SUBSCRIPTION_SETTINGS_TAB ? <SubscriptionSettingsPanel isOwner={isOwner} /> : null}
      {activeTab === ACCOUNT_SETTINGS_TAB ? <AccountSecurityPanel /> : null}
      {activeTab === CATEGORIES_SETTINGS_TAB ? <CategoriesSettingsPanel /> : null}
      {activeTab === EXPENSE_CATEGORIES_SETTINGS_TAB ? <ExpensesCategoriesSettingsPanel /> : null}
      {activeTab === UNITS_SETTINGS_TAB ? <UnitsSettingsPanel /> : null}
      {activeTab === BANKS_SETTINGS_TAB ? <BanksSettingsPanel /> : null}
      {activeTab === ORDER_ATTRIBUTES_SETTINGS_TAB ? <OrderAttributesSettingsPanel /> : null}
      {activeTab === TABLES_FLOORS_SETTINGS_TAB ? <TablesFloorsSettingsPanel /> : null}
    </div>
  );
}