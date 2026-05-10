import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, Upload, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import AccountSecurityPanel from '../components/account/AccountSecurityPanel.jsx';
import StaffManagement from '../components/StaffManagement';
import BanksSettingsPanel from '../components/settings/BanksSettingsPanel.jsx';
import CategoriesSettingsPanel from '../components/settings/CategoriesSettingsPanel.jsx';
import OrderAttributesSettingsPanel from '../components/settings/OrderAttributesSettingsPanel.jsx';
import ProfileSettingsPanel from '../components/settings/ProfileSettingsPanel.jsx';
import SubscriptionSettingsPanel from '../components/settings/SubscriptionSettingsPanel.jsx';
import UnitsSettingsPanel from '../components/settings/UnitsSettingsPanel.jsx';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import { getSubscriptionGuard } from '../lib/subscription';
import {
  ACCOUNT_SETTINGS_TAB,
  BANKS_SETTINGS_TAB,
  CATEGORIES_SETTINGS_TAB,
  GENERAL_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
  PROFILE_SETTINGS_TAB,
  STAFF_SETTINGS_TAB,
  SUBSCRIPTION_SETTINGS_TAB,
  UNITS_SETTINGS_TAB,
} from '../lib/settingsTabs';

const EMPTY = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  panVat: '',
  logoUrl: '',
};

const PROFILE_TAB_KEYS = [PROFILE_SETTINGS_TAB, SUBSCRIPTION_SETTINGS_TAB, ACCOUNT_SETTINGS_TAB];

export default function Settings() {
  const { t } = useI18n();
  const { businessId, role } = useAuth();
  const { settings, loading: settingsLoading, saveSettings, reloadSettings } = useBusinessSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({ ...EMPTY, ...settings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef(null);
  const isOwner = role === 'owner';
  const subscriptionAccess = subscription?.access || null;
  const subscriptionGuard = getSubscriptionGuard(subscription);
  const generalLocked = isOwner && !hasFeatureAccess('general-settings');

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
        key: SUBSCRIPTION_SETTINGS_TAB,
        label: t('settingsPage.tabs.subscription'),
        description: t('settingsPage.descriptions.subscription'),
      },
      {
        key: ACCOUNT_SETTINGS_TAB,
        label: t('settingsPage.tabs.account'),
        description: t('settingsPage.descriptions.account'),
      }
    );

    if (isOwner && hasFeatureAccess('staff')) {
      nextTabs.push({
        key: STAFF_SETTINGS_TAB,
        label: t('settingsPage.tabs.staff'),
        description: t('settingsPage.descriptions.staff'),
      });
    }

    if (hasFeatureAccess('categories')) {
      nextTabs.push({
        key: CATEGORIES_SETTINGS_TAB,
        label: t('settingsPage.tabs.categories'),
        description: t('settingsPage.descriptions.categories'),
      });
    }

    if (hasFeatureAccess('units')) {
      nextTabs.push({
        key: UNITS_SETTINGS_TAB,
        label: t('settingsPage.tabs.units'),
        description: t('settingsPage.descriptions.units'),
      });
    }

    if (hasFeatureAccess('banks')) {
      nextTabs.push({
        key: BANKS_SETTINGS_TAB,
        label: t('settingsPage.tabs.banks'),
        description: t('settingsPage.descriptions.banks'),
      });
    }

    if (hasFeatureAccess('order-attributes')) {
      nextTabs.push({
        key: ORDER_ATTRIBUTES_SETTINGS_TAB,
        label: t('settingsPage.tabs.orderAttributes'),
        description: t('settingsPage.descriptions.orderAttributes'),
      });
    }

    return nextTabs;
  }, [generalLocked, hasFeatureAccess, isOwner, t]);

  const companyTabs = useMemo(
    () => tabs.filter((tab) => !PROFILE_TAB_KEYS.includes(tab.key)),
    [tabs]
  );
  const profileTabs = useMemo(
    () => tabs.filter((tab) => PROFILE_TAB_KEYS.includes(tab.key)),
    [tabs]
  );
  const defaultCompanyTab = companyTabs[0]?.key || GENERAL_SETTINGS_TAB;
  const defaultProfileTab = PROFILE_SETTINGS_TAB;

  const requestedTab = searchParams.get('tab');
  const defaultTab = tabs[0]?.key || defaultProfileTab;
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : defaultTab;
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const isProfileSection = PROFILE_TAB_KEYS.includes(activeTab);

  useEffect(() => {
    reloadSettings(businessId);
  }, [businessId, reloadSettings]);

  useEffect(() => {
    setForm({ ...EMPTY, ...settings });
  }, [settings]);

  const handleChange = (field, value) => {
    if (generalLocked) return;
    setSaved(false);
    setForm((previous) => ({ ...previous, [field]: value }));
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

    setSaving(true);
    setSaved(false);
    setError('');

    try {
      await saveSettings(form, businessId);
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

  return (
    <div className="min-w-0 max-w-6xl space-y-6 overflow-x-hidden">
      <PageHeader title={t('settingsPage.title')} subtitle={activeTabMeta?.description || t('settingsPage.subtitle')} />

      <div className="grid gap-4 grid-cols-5">
        <button
          type="button"
          onClick={handleCompanySettingClick}
          aria-pressed={!isProfileSection}
          className={`group flex w-full flex-col items-start gap-1.5 px-1 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            !isProfileSection
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span
            className={`inline-block border-b-2 pb-1 text-xl font-bold leading-tight transition-colors ${
              !isProfileSection
                ? 'border-primary text-primary-700 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-slate-700 group-hover:border-slate-300 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:border-slate-600 dark:group-hover:text-white'
            }`}
          >
            Company Setting
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Company details and business configuration.
          </p>
        </button>
        <button
          type="button"
          onClick={handleProfileSettingClick}
          aria-pressed={isProfileSection}
          className={`group flex w-full flex-col items-start gap-1.5 px-1 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            isProfileSection
              ? 'text-primary-700 dark:text-primary-300'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span
            className={`inline-block border-b-2 pb-1 text-xl font-bold leading-tight transition-colors ${
              isProfileSection
                ? 'border-primary text-primary-700 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-slate-700 group-hover:border-slate-300 group-hover:text-slate-900 dark:text-slate-300 dark:group-hover:border-slate-600 dark:group-hover:text-white'
            }`}
          >
            Profile Setting
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Security, profile details, and subscription access.
          </p>
        </button>
      </div>

      <div className="card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t('settingsPage.title')}
          </p>
          <h2 className="break-words font-serif text-xl text-slate-900 dark:text-white">{activeTabMeta?.label}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <div className="contents lg:flex lg:flex-wrap lg:gap-2">
            {(isProfileSection ? profileTabs : companyTabs).map((tab) => {
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-semibold leading-tight transition lg:w-auto lg:px-4 lg:py-2.5 lg:text-left ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
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

      {routeNotice?.title ? (
        <Notice title={routeNotice.title} description={routeNotice.description} tone={routeNotice.tone || 'warn'} />
      ) : null}

      {activeTab === GENERAL_SETTINGS_TAB ? (
        <>
          {error ? <Notice title={error} tone="error" /> : null}

          {settingsLoading && !form.companyName ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              {t('settingsPage.general.loading')}
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <fieldset className="space-y-6" disabled={generalLocked || saving || logoUploading}>
                <div className="card space-y-4">
                  <h2 className="font-serif text-lg text-slate-900 dark:text-white">{t('settingsPage.general.logoTitle')}</h2>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
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
                            className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-slate-500 shadow-sm hover:text-rose-600"
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
                        <Building2 size={28} className="text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
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
                  <h2 className="font-serif text-lg text-slate-900 dark:text-white">{t('settingsPage.general.detailsTitle')}</h2>

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
                </div>

                <div className="card space-y-5">
                  <h2 className="font-serif text-lg text-slate-900 dark:text-white">{t('settingsPage.general.taxTitle')}</h2>
                  <div className="space-y-1">
                    <label className="label" htmlFor="panVat">{t('settingsPage.general.panVat')}</label>
                    <input
                      id="panVat"
                      className="input"
                      placeholder={t('settingsPage.general.panVatPlaceholder')}
                      value={form.panVat}
                      onChange={(event) => handleChange('panVat', event.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      {t('settingsPage.general.panVatHint')}
                    </p>
                  </div>
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
      {activeTab === SUBSCRIPTION_SETTINGS_TAB ? <SubscriptionSettingsPanel isOwner={isOwner} /> : null}
      {activeTab === ACCOUNT_SETTINGS_TAB ? <AccountSecurityPanel /> : null}
      {activeTab === STAFF_SETTINGS_TAB ? <StaffManagement businessId={businessId} /> : null}
      {activeTab === CATEGORIES_SETTINGS_TAB ? <CategoriesSettingsPanel /> : null}
      {activeTab === UNITS_SETTINGS_TAB ? <UnitsSettingsPanel /> : null}
      {activeTab === BANKS_SETTINGS_TAB ? <BanksSettingsPanel /> : null}
      {activeTab === ORDER_ATTRIBUTES_SETTINGS_TAB ? <OrderAttributesSettingsPanel /> : null}
    </div>
  );
}
