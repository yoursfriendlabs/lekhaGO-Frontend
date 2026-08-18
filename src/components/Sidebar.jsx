import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useBusinessSettings } from '../lib/businessSettings.jsx';
import { getNavigationForBusinessType } from '../lib/businessTypeConfig.js';
import BrandLogo from './BrandLogo.jsx';
import UpgradeSubscriptionCta from './subscription/UpgradeSubscriptionCta.jsx';

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

export default function Sidebar() {
  const t = useI18n().t;
  const { role, hasFeatureAccess, accessControl } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const isGeneralStaff = accessControl?.staffCategory === 'general_staff';
  const rawNavigation = getNavigationForBusinessType(
    Array.isArray(businessProfile?.navigation) && businessProfile.navigation.length
      ? businessProfile.navigation
      : [
          { key: 'dashboard', label: t('nav.dashboard'), route: '/app' },
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
    <aside className="hidden h-full w-64 flex-col gap-6 border-r border-secondary-200/70 bg-surface/80 p-6 md:fixed md:inset-y-0 md:left-0 md:flex md:overflow-y-auto">
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
                  ? 'bg-primary text-white'
                  : 'text-ink-light hover:bg-primary/10'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <UpgradeSubscriptionCta variant="sidebar" />
        <div className="rounded-2xl border border-secondary-200/70 bg-surface/70 p-4 text-xs text-secondary-500">
          {/* {t('notices.businessRequiredDesc')} */}
        </div>
      </div>
    </aside>
  );
}
