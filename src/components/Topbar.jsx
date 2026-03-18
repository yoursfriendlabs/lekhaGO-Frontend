import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { useI18n } from '../lib/i18n.jsx';

export default function Topbar() {
  const { user, businessId, updateBusinessId, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  return (
    <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-secondary-200 bg-white/85 px-4 pt-4 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-secondary-500">{t('topbar.workspace')}</p>
          <h2 className="font-serif text-xl text-ink">{user?.name || t('topbar.welcome')}</h2>
        </div>
        <div className="flex gap-2 items-center md:hidden">
          <div className="">
            <button onClick={() => setLocale(locale === 'en' ? 'ne' : 'en')} className="bg-amber-50 border rounded-xl px-2 border-amber-400">
              { locale === 'en' ? '🇳🇵' : '🇬🇧' }
            </button>
          </div>
          <button className="rounded-full bg-secondary-100 p-2 text-rose-500" onClick={logout} type="button">
            🚪
          </button>
        </div>
      </div>
      <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
        <div className="hidden md:flex">
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
