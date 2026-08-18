import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, Users, ShoppingCart, Briefcase, Settings2, ClipboardList, Clock, Receipt, Coffee } from 'lucide-react';
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
  tasks: ['owner', 'staff', 'admin', 'super_admin'],
  tables: ['owner', 'staff', 'admin', 'super_admin'],
  billing: ['owner', 'staff', 'admin', 'super_admin'],
  attendance: ['staff'],
  staff: ['owner', 'staff', 'admin', 'super_admin'],
  reports: ['owner', 'staff', 'admin', 'super_admin'],
  settings: ['owner', 'staff', 'admin', 'super_admin'],
};

const ICON_MAP = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  inventory: Boxes,
  sales: Briefcase,
  services: Briefcase,
  purchases: ShoppingCart,
  parties: Users,
  tasks: ClipboardList,
  tables: Coffee,
  billing: Receipt,
  attendance: Clock,
  staff: Users,
  'staff-salary': Users,
  reports: ClipboardList,
  settings: Settings2,
};

export default function MobileNav() {
  const t = useI18n().t;
  const { role, hasFeatureAccess, accessControl } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const isGeneralStaff = accessControl?.staffCategory === 'general_staff';
  const rawNavigation = getNavigationForBusinessType(
    Array.isArray(businessProfile?.navigation) && businessProfile.navigation.length
      ? businessProfile.navigation
      : [
          { key: 'dashboard', label: t('nav.home'), route: '/app' },
          { key: 'inventory', label: t('nav.items'), route: '/app/inventory' },
          { key: 'sales', label: t('nav.sales'), route: '/app/sales' },
          { key: 'purchases', label: t('nav.expenses'), route: '/app/purchases' },
          { key: 'tasks', label: t('nav.tasks'), route: '/app/tasks' },
          { key: 'parties', label: t('nav.parties'), route: '/app/parties' },
          { key: 'attendance', label: t('nav.attendance'), route: '/app/attendance' },
          { key: 'staff', label: t('nav.staff'), route: '/app/staff' },
          { key: 'reports', label: t('nav.reports') || 'Reports', route: '/app/reports' },
          { key: 'settings', label: t('nav.settings'), route: '/app/settings' },
        ],
    businessProfile,
  );

  let hasReports = false;
  const processedNavigation = [];
  rawNavigation.forEach((item) => {
    if (item.key === 'analytics' || item.key === 'ledger' || item.key === 'reports') {
      if (!hasReports) {
        processedNavigation.push({
          key: 'reports',
          label: t('nav.reports') || 'Reports',
          route: '/app/reports',
        });
        hasReports = true;
      }
    } else {
      processedNavigation.push(item);
    }
  });

  const navigation = processedNavigation.map((item) => {
    if (item?.key === 'purchases') return { ...item, label: t('nav.expenses') };
    if (item?.key === 'attendance') return { ...item, label: t('nav.attendance') };
    if (item?.key === 'staff') return { ...item, label: t('nav.staff') };
    return item;
  });

  const membershipId = accessControl?.membershipId;
  let visibleNavItems;
  if (isGeneralStaff) {
    const salaryRoute = membershipId ? `/app/staff-salary/${encodeURIComponent(membershipId)}` : '/app/staff';
    visibleNavItems = [
      { key: 'staff-salary', label: t('nav.staff'), route: salaryRoute },
      { key: 'attendance', label: t('nav.attendance'), route: '/app/attendance' },
      { key: 'settings', label: t('nav.settings'), route: '/app/settings' },
    ];
  } else {
    visibleNavItems = navigation
      .filter((item) => (NAV_ROLE_MAP[item.key] || ['owner', 'staff']).includes(role))
      .filter((item) => hasFeatureAccess(item.key));
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-secondary-200/70 bg-surface/95 px-2 py-2 shadow-lg backdrop-blur md:hidden">
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
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-secondary-500 hover:bg-primary/10'
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
