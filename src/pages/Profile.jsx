import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ProfileSettingsPanel from '../components/settings/ProfileSettingsPanel.jsx';
import AccountSecurityPanel from '../components/account/AccountSecurityPanel.jsx';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

export default function Profile() {
  const { t } = useI18n();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'security'
  const isOwner = role === 'owner';

  return (
    <div className="min-w-0 max-w-6xl space-y-6 overflow-x-hidden">
      <PageHeader 
        title={t('settingsPage.tabs.profile')} 
        subtitle={t('settingsPage.profile.subtitle') || "View and update your personal information and settings."} 
      />

      {/* Tabs navigation */}
      <div className="card space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-secondary-400">
            {t('settingsPage.title')}
          </p>
          <h2 className="break-words font-serif text-xl text-ink">
            {activeTab === 'details' ? t('settingsPage.tabs.profile') : t('settingsPage.tabs.account')}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          <div className="contents lg:flex lg:flex-wrap lg:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-semibold leading-tight transition lg:w-auto lg:px-4 lg:py-2.5 lg:text-left ${
                activeTab === 'details'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-slate-900/60 dark:text-secondary-300 dark:hover:bg-slate-800'
              }`}
            >
              {t('settingsPage.tabs.profile')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`min-w-0 rounded-2xl px-3 py-3 text-center text-sm font-semibold leading-tight transition lg:w-auto lg:px-4 lg:py-2.5 lg:text-left ${
                activeTab === 'security'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-slate-900/60 dark:text-secondary-300 dark:hover:bg-slate-800'
              }`}
            >
              {t('settingsPage.tabs.account') || 'Security'}
            </button>
          </div>
        </div>
      </div>

      {/* Render selected tab panel */}
      <div className="animate-fadeIn">
        {activeTab === 'details' ? (
          <ProfileSettingsPanel isOwner={isOwner} />
        ) : (
          <AccountSecurityPanel />
        )}
      </div>
    </div>
  );
}
