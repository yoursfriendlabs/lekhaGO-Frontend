import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n.jsx';

export default function Topbar() {
  const { user, businessId, updateBusinessId, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-slate-200/70 bg-white/85 px-4 py-4 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('topbar.workspace')}</p>
          <h2 className="font-serif text-xl text-slate-900 dark:text-white">{user?.name || t('topbar.welcome')}</h2>
        </div>
        <div className="flex gap-2 md:hidden">
          <button
            className="rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            type="button"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="rounded-full bg-slate-100 p-2 text-rose-500 dark:bg-slate-800" onClick={logout} type="button">
            🚪
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
        <div className="w-full md:min-w-[140px]">
          <label className="text-[10px] uppercase tracking-wider text-slate-500">{t('topbar.language')}</label>
          <select
            className="input mt-1"
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          >
            <option value="en">{t('languages.en')}</option>
            <option value="ne">{t('languages.ne')}</option>
          </select>
        </div>
        <div className="w-full md:min-w-[220px]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-slate-500">{t('topbar.businessId')}</label>
            {!businessId ? (
              <span className="text-[10px] font-bold text-rose-500 animate-pulse">{t('topbar.actionRequired')}</span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-500">{t('topbar.active')}</span>
            )}
          </div>
          <input
            className="input mt-1"
            placeholder={t('topbar.businessPlaceholder')}
            value={businessId}
            onChange={(event) => updateBusinessId(event.target.value)}
          />
        </div>
        <div className="hidden gap-2 md:flex">
          <button
            className="btn-ghost"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            type="button"
          >
            {theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
          </button>
          <button className="btn-ghost" onClick={logout} type="button">
            {t('topbar.logout')}
          </button>
        </div>
      </div>
    </header>
  );
}
