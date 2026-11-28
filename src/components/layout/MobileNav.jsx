import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Check, ChevronRight, Grid2X2, Languages, LogOut, Palette, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth.jsx';
import { useI18n } from '@/lib/i18n.jsx';
import { useTheme } from '@/lib/theme.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { checkForAppUpdate } from '@/lib/pwa.js';
import BottomSheet from '../ui/BottomSheet.jsx';
import Avatar from '../ui/Avatar.jsx';
import { getNavIcon } from './navConfig.js';
import { useAppNavigation } from './useAppNavigation.js';
import { pickPrimaryTabs, isRouteActive } from './mobileTabs.js';
import { useKeyboardOpen } from './useKeyboardOpen.js';

const NAV_OFFSET = '68px';

export default function MobileNav() {
  const { t } = useI18n();
  const location = useLocation();
  const { visibleNavItems, navGroups } = useAppNavigation();
  const [moreOpen, setMoreOpen] = useState(false);
  const keyboardOpen = useKeyboardOpen();

  const primaryTabs = useMemo(() => pickPrimaryTabs(visibleNavItems), [visibleNavItems]);
  const primaryActive = primaryTabs.some((item) => isRouteActive(location.pathname, item.route));

  // Snackbars and floating prompts read this to sit above the tab bar.
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      root.style.setProperty('--mobile-nav-offset', media.matches && !keyboardOpen ? NAV_OFFSET : '0px');
    };
    apply();
    media.addEventListener?.('change', apply);
    return () => {
      media.removeEventListener?.('change', apply);
      root.style.setProperty('--mobile-nav-offset', '0px');
    };
  }, [keyboardOpen]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <nav
        aria-label={t('mobileMenu.title')}
        className={`mobile-tabbar fixed inset-x-0 bottom-0 z-40 border-t border-secondary-200/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)] backdrop-blur-xl transition-transform duration-200 md:hidden ${keyboardOpen ? 'translate-y-full' : ''}`}
      >
        <div className="mx-auto flex h-[64px] max-w-xl items-stretch px-1">
          {primaryTabs.map((item) => {
            const Icon = getNavIcon(item.key, item.route);
            return (
              <NavLink
                key={item.route}
                to={item.route}
                end={item.route === '/app'}
                className="group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-secondary-500 aria-[current=page]:text-primary-700"
              >
                <span className="flex h-8 w-14 items-center justify-center rounded-full transition-colors group-aria-[current=page]:bg-primary/15">
                  <Icon size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">{item.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={`group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 ${!primaryActive || moreOpen ? 'text-primary-700' : 'text-secondary-500'}`}
          >
            <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${!primaryActive || moreOpen ? 'bg-primary/15' : ''}`}>
              <Grid2X2 size={22} strokeWidth={2} aria-hidden />
            </span>
            <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">{t('mobileMenu.more')}</span>
          </button>
        </div>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} navGroups={navGroups} pathname={location.pathname} />
    </>
  );
}

function MoreSheet({ open, onClose, navGroups, pathname }) {
  const { t, locale, setLocale } = useI18n();
  const { user, business, logout } = useAuth();
  const { themes, themeId, setThemeId } = useTheme();
  const { showSnackbar } = useSnackbar();
  const [checking, setChecking] = useState(false);
  // Settings sits in the Account list below rather than as a lone tile.
  const featureGroups = navGroups.filter((group) => group.id !== 'account');
  const accountItems = navGroups.find((group) => group.id === 'account')?.items || [];

  const handleCheckUpdates = async () => {
    setChecking(true);
    const result = await checkForAppUpdate();
    setChecking(false);
    if (result === 'none') {
      showSnackbar({ id: 'pwa-check', tone: 'success', title: t('pwa.refreshed'), duration: 2500 });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('mobileMenu.title')} closeLabel={t('mobileMenu.close')}>
      <Link
        to="/app/profile"
        className="flex items-center gap-3 rounded-2xl border border-secondary-200/80 bg-mist/60 p-3 transition active:scale-[0.99]"
      >
        <Avatar src={user?.avatarUrl} name={user?.name} size="md" className="rounded-xl" fallbackClassName="bg-primary-100 text-primary-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{user?.name || t('nav.profile')}</p>
          <p className="truncate text-sm text-secondary-500">{business?.name || user?.email || ''}</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-secondary-400" aria-hidden />
      </Link>

      {featureGroups.map((group) => (
        <section key={group.id} className="mt-5">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-secondary-500">{t(group.labelKey)}</h3>
          <div className="grid grid-cols-4 gap-x-2 gap-y-3">
            {group.items.map((item) => {
              const Icon = getNavIcon(item.key, item.route);
              const active = isRouteActive(pathname, item.route);
              return (
                <Link
                  key={item.route}
                  to={item.route}
                  aria-current={active ? 'page' : undefined}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl py-1 text-center transition active:scale-95"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                      active ? 'bg-primary text-white shadow-sm' : 'bg-primary/10 text-primary-700'
                    }`}
                  >
                    <Icon size={24} strokeWidth={2} aria-hidden />
                  </span>
                  <span className={`line-clamp-2 w-full text-xs leading-tight ${active ? 'font-semibold text-ink' : 'font-medium text-ink-light'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mt-6">
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-secondary-500">{t('mobileMenu.account')}</h3>
        <div className="divide-y divide-secondary-200/70 overflow-hidden rounded-2xl border border-secondary-200/80 bg-surface">
          {accountItems.map((item) => {
            const Icon = getNavIcon(item.key, item.route);
            return (
              <Link
                key={item.route}
                to={item.route}
                aria-current={isRouteActive(pathname, item.route) ? 'page' : undefined}
                className="flex min-h-[52px] items-center gap-3 px-4 py-3 active:bg-secondary-50"
              >
                <Icon className="h-5 w-5 shrink-0 text-secondary-500" aria-hidden />
                <span className="flex-1 text-sm font-medium text-ink">{item.label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-secondary-400" aria-hidden />
              </Link>
            );
          })}
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 shrink-0 text-secondary-500" aria-hidden />
              <span className="flex-1 text-sm font-medium text-ink">{t('mobileMenu.appearance')}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 pl-8" role="radiogroup" aria-label={t('theme.pickerLabel')}>
              {themes.map((theme) => {
                const selected = theme.id === themeId;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t(theme.labelKey)}
                    onClick={() => setThemeId(theme.id)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${selected ? 'border-ink' : 'border-white shadow-sm'}`}
                      style={{ backgroundColor: theme.swatch }}
                    >
                      {selected ? <Check className="h-3.5 w-3.5 text-white" aria-hidden /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'ne' : 'en')}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary-50"
          >
            <Languages className="h-5 w-5 shrink-0 text-secondary-500" aria-hidden />
            <span className="flex-1 text-sm font-medium text-ink">{t('mobileMenu.language')}</span>
            <span className="text-sm text-secondary-500">{t('mobileMenu.switchLanguage')}</span>
          </button>
          <button
            type="button"
            onClick={handleCheckUpdates}
            disabled={checking}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 shrink-0 text-secondary-500 ${checking ? 'animate-spin' : ''}`} aria-hidden />
            <span className="flex-1 text-sm font-medium text-ink">{t('mobileMenu.checkUpdates')}</span>
            <span className="text-xs text-secondary-400">{t('mobileMenu.version')} {__APP_VERSION__}</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left text-rose-600 active:bg-rose-50"
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1 text-sm font-semibold">{t('mobileMenu.logout')}</span>
          </button>
        </div>
      </section>
    </BottomSheet>
  );
}
