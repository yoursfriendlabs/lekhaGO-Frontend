import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { getNavigationForBusinessType } from '../lib/businessTypeConfig.js';
import BrandLogo from './BrandLogo.jsx';

const NAV_ROLE_MAP = {
  dashboard: ['owner', 'staff'],
  orders: ['owner', 'staff'],
  inventory: ['owner', 'staff'],
  sales: ['owner', 'staff'],
  services: ['owner', 'staff'],
  purchases: ['owner'],
  parties: ['owner'],
  ledger: ['owner', 'staff'],
  analytics: ['owner'],
  settings: ['owner', 'staff'],
  admin: ['owner'],
};

export default function Sidebar() {
  const { t } = useI18n();
  const { role } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const navigation = getNavigationForBusinessType(
    Array.isArray(businessProfile?.navigation) && businessProfile.navigation.length
      ? businessProfile.navigation
    : [
        { key: 'dashboard', label: t('nav.dashboard'), route: '/app' },
        { key: 'inventory', label: t('nav.items'), route: '/app/inventory' },
        { key: 'sales', label: t('nav.sales'), route: '/app/sales' },
        { key: 'purchases', label: t('nav.purchases'), route: '/app/purchases' },
        { key: 'parties', label: t('nav.parties'), route: '/app/parties' },
        { key: 'ledger', label: t('nav.ledger'), route: '/app/ledger' },
        { key: 'analytics', label: t('nav.analytics'), route: '/app/analytics' },
        { key: 'settings', label: t('nav.settings'), route: '/app/settings' },
      ],
    businessProfile,
  );

  const visibleNavItems = navigation
    .filter((item) => (NAV_ROLE_MAP[item.key] || ['owner', 'staff']).includes(role))
    .concat(role === 'owner' ? [{ key: 'admin', label: t('nav.admin'), route: '/app/admin' }] : []);

  return (
    <aside className="hidden h-full w-64 flex-col gap-6 border-r border-slate-200/70 bg-white/80 p-6 dark:border-slate-800/70 dark:bg-slate-950/70 md:fixed md:inset-y-0 md:left-0 md:flex md:overflow-y-auto">
      <div className="space-y-3">
        <BrandLogo className="h-10 w-full" />
      </div>
      <nav className="flex flex-col gap-2">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            end={item.route === '/app'}
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[#9c5f22] text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-400">
        {t('notices.businessRequiredDesc')}
      </div>
    </aside>
  );
}
