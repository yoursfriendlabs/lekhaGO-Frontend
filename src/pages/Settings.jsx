import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle, Upload, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Notice from '../components/Notice';
import StaffManagement from '../components/StaffManagement';
import BanksSettingsPanel from '../components/settings/BanksSettingsPanel.jsx';
import CategoriesSettingsPanel from '../components/settings/CategoriesSettingsPanel.jsx';
import OrderAttributesSettingsPanel from '../components/settings/OrderAttributesSettingsPanel.jsx';
import { api, API_BASE } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useBusinessSettings } from '../lib/businessSettings';
import { useI18n } from '../lib/i18n.jsx';
import {
  BANKS_SETTINGS_TAB,
  CATEGORIES_SETTINGS_TAB,
  GENERAL_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
  STAFF_SETTINGS_TAB,
} from '../lib/settingsTabs';

const EMPTY = {
  companyName: '',
  address: '',
  phone: '',
  email: '',
  panVat: '',
  logoUrl: '',
};

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

  const tabs = useMemo(() => {
    const nextTabs = [
      {
        key: GENERAL_SETTINGS_TAB,
        label: t('settingsPage.tabs.general'),
        description: t('settingsPage.descriptions.general'),
      },
    ];

    if (isOwner) {
      nextTabs.push({
        key: STAFF_SETTINGS_TAB,
        label: t('settingsPage.tabs.staff'),
        description: t('settingsPage.descriptions.staff'),
      });
    }

    nextTabs.push(
      {
        key: CATEGORIES_SETTINGS_TAB,
        label: t('settingsPage.tabs.categories'),
        description: t('settingsPage.descriptions.categories'),
      },
      {
        key: BANKS_SETTINGS_TAB,
        label: t('settingsPage.tabs.banks'),
        description: t('settingsPage.descriptions.banks'),
      },
      {
        key: ORDER_ATTRIBUTES_SETTINGS_TAB,
        label: t('settingsPage.tabs.orderAttributes'),
        description: t('settingsPage.descriptions.orderAttributes'),
      }
    );

    return nextTabs;
  }, [isOwner, t]);

  const requestedTab = searchParams.get('tab');
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : GENERAL_SETTINGS_TAB;
  const activeTabMeta = tabs.find((tab) => tab.key === activeTab) || tabs[0];

  useEffect(() => {
    reloadSettings(businessId);
  }, [businessId, reloadSettings]);

  useEffect(() => {
    setForm({ ...EMPTY, ...settings });
  }, [settings]);

  const handleChange = (field, value) => {
    setSaved(false);
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP).');
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

    if (!tab || tab === GENERAL_SETTINGS_TAB) {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }

    setSearchParams(nextParams);
  };

  const logoSrc = form.logoUrl
    ? form.logoUrl.startsWith('http')
      ? form.logoUrl
      : `${API_BASE}${form.logoUrl}`
    : null;

  return (
    <div className="min-w-0 max-w-6xl space-y-6 overflow-x-hidden">
      <PageHeader title={t('settingsPage.title')} subtitle={activeTabMeta?.description || t('settingsPage.subtitle')} />

      <div className="card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
            {t('settingsPage.title')}
          </p>
          <h2 className="break-words font-serif text-xl text-slate-900 dark:text-white">{activeTabMeta.label}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
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

      {activeTab === GENERAL_SETTINGS_TAB ? (
        <>
          {error ? <Notice title={error} tone="error" /> : null}

          {settingsLoading && !form.companyName ? (
            <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              Loading settings...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="card space-y-4">
                <h2 className="font-serif text-lg text-slate-900 dark:text-white">Company Logo</h2>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
                    {logoUploading ? (
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                    ) : logoSrc ? (
                      <>
                        <img
                          src={logoSrc}
                          alt="Company logo"
                          className="h-full w-full object-contain p-1"
                        />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-white/80 p-0.5 text-slate-500 shadow-sm hover:text-rose-600"
                          onClick={() => {
                            handleChange('logoUrl', '');
                            if (fileRef.current) fileRef.current.value = '';
                          }}
                          title="Remove logo"
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
                      Upload your company logo. Recommended: square image, PNG or JPG, at least 200x200 px.
                    </p>
                    <button
                      type="button"
                      className="btn-secondary gap-2"
                      onClick={() => fileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      <Upload size={15} />
                      {logoUploading ? 'Uploading...' : logoSrc ? 'Replace Logo' : 'Upload Logo'}
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
                <h2 className="font-serif text-lg text-slate-900 dark:text-white">Company Details</h2>

                <div className="space-y-1">
                  <label className="label" htmlFor="companyName">Company / Shop Name</label>
                  <input
                    id="companyName"
                    className="input"
                    placeholder="e.g. Sharma Electronics"
                    value={form.companyName}
                    onChange={(event) => handleChange('companyName', event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="label" htmlFor="address">Address</label>
                  <textarea
                    id="address"
                    className="input resize-none"
                    rows={3}
                    placeholder="Street, City, State / Province"
                    value={form.address}
                    onChange={(event) => handleChange('address', event.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="label" htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      className="input"
                      type="tel"
                      placeholder="+977 98XXXXXXXX"
                      value={form.phone}
                      onChange={(event) => handleChange('phone', event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="label" htmlFor="email">Email</label>
                    <input
                      id="email"
                      className="input"
                      type="email"
                      placeholder="shop@example.com"
                      value={form.email}
                      onChange={(event) => handleChange('email', event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="card space-y-5">
                <h2 className="font-serif text-lg text-slate-900 dark:text-white">Tax Information</h2>
                <div className="space-y-1">
                  <label className="label" htmlFor="panVat">PAN / VAT Number</label>
                  <input
                    id="panVat"
                    className="input"
                    placeholder="e.g. 123456789"
                    value={form.panVat}
                    onChange={(event) => handleChange('panVat', event.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    This number will appear on all printed invoices.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="submit" className="btn-primary px-8" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                {saved ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <CheckCircle size={16} /> Saved
                  </span>
                ) : null}
              </div>
            </form>
          )}
        </>
      ) : null}

      {activeTab === STAFF_SETTINGS_TAB ? <StaffManagement businessId={businessId} /> : null}
      {activeTab === CATEGORIES_SETTINGS_TAB ? <CategoriesSettingsPanel /> : null}
      {activeTab === BANKS_SETTINGS_TAB ? <BanksSettingsPanel /> : null}
      {activeTab === ORDER_ATTRIBUTES_SETTINGS_TAB ? <OrderAttributesSettingsPanel /> : null}
    </div>
  );
}
