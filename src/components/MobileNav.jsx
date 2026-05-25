import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, Users, ShoppingCart, Briefcase, Settings2, ShieldCheck, ClipboardList } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { getNavigationForBusinessType } from '../lib/businessTypeConfig.js';

const NAV_ROLE_MAP = {
  dashboard: ['owner', 'staff', 'admin', 'super_admin'],
  orders: ['owner', 'staff', 'admin', 'super_admin'],
  inventory: ['owner', 'staff', 'admin', 'super_admin'],
  sales: ['owner', 'staff', 'admin', 'super_admin'],
  services: ['owner', 'staff', 'admin', 'super_admin'],
  purchases: ['owner', 'staff', 'admin', 'super_admin'],
  parties: ['owner', 'staff', 'admin', 'super_admin'],
  settings: ['owner', 'staff', 'admin', 'super_admin'],
  admin: ['owner'],
};

const ICON_MAP = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  inventory: Boxes,
  sales: Briefcase,
  services: Briefcase,
  purchases: ShoppingCart,
  parties: Users,
  settings: Settings2,
  admin: ShieldCheck,
};

export default function MobileNav() {
  const { t } = useI18n();
  const { role, hasFeatureAccess } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const navigation = getNavigationForBusinessType(
    Array.isArray(businessProfile?.navigation) && businessProfile.navigation.length
      ? businessProfile.navigation
    : [
        { key: 'dashboard', label: t('nav.home'), route: '/app' },
        { key: 'inventory', label: t('nav.items'), route: '/app/inventory' },
        { key: 'sales', label: t('nav.sales'), route: '/app/sales' },
        { key: 'purchases', label: t('nav.expenses'), route: '/app/purchases' },
        { key: 'parties', label: t('nav.parties'), route: '/app/parties' },
        { key: 'settings', label: t('nav.settings'), route: '/app/settings' },
      ],
    businessProfile,
  ).map((item) => (item?.key === 'purchases'
    ? { ...item, label: t('nav.expenses') }
    : item));
  const visibleNavItems = navigation
    .filter((item) => (NAV_ROLE_MAP[item.key] || ['owner', 'staff']).includes(role))
    .filter((item) => hasFeatureAccess(item.key))
    .concat((role === 'owner' || role === 'admin' || role === 'super_admin') && hasFeatureAccess('admin')
      ? [{ key: 'admin', label: t('nav.admin'), route: '/app/admin' }]
      : []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/70 bg-white/95 px-2 py-2 shadow-lg backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/90 md:hidden">
      <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-[max(env(safe-area-inset-bottom),0px)]">
        {visibleNavItems.map((item) => {
          const Icon = ICON_MAP[item.key] || Briefcase;

          return (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.route === '/app'}
              className={({ isActive }) =>
                `flex min-w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 text-center transition-all ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 shadow-sm dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                }`
              }
            >
              <Icon size={20} strokeWidth={2} />
              <span className="text-[11px] font-medium leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
