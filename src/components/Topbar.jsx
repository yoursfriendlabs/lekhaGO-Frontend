import { RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';

export default function Topbar() {
  const { user, logout } = useAuth();
  const { businessProfile } = useBusinessSettings();

  const { locale, setLocale, t } = useI18n();
  const refreshWorkspace = () => {
    if (typeof window === 'undefined') return;
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-secondary-200 bg-white/85 px-4 py-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
          <h2 className="font-serif text-xl text-ink">{user?.name || t('topbar.welcome')}</h2>
          {businessProfile?.label ? (
            <p className="mt-1 text-xs font-medium text-secondary-500">{businessProfile.label}</p>
          ) : null}
        </div>
        <div className="flex gap-2 items-center md:hidden">
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
