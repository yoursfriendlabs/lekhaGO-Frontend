import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n.jsx';
import { useAuth } from '../lib/auth.jsx';
import BrandLogo from './BrandLogo.jsx';

const navItems = [
  { to: '/app', key: 'nav.dashboard' },
  { to: '/app/inventory', key: 'nav.items', role: ['owner','staff'] },
    { to: '/app/services', key: 'nav.services', role: ['owner','staff'] },
  { to: '/app/sales', key: 'nav.sales', role: ['owner','staff'] },
  { to: '/app/purchases', key: 'nav.purchases', role: ['owner'] },
  { to: '/app/parties', key: 'nav.parties', role: ['owner']  },
  { to: '/app/ledger', key: 'nav.ledger', role: ['owner','staff'] },
  // { to: '/app/analytics', key: 'nav.analytics', role: ['owner'] },
  { to: '/app/settings', key: 'nav.settings', role: ['owner','staff'] },
];

export default function Sidebar() {
  const { t } = useI18n();
  const { role } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.role || item.role.includes(role));

  return (
    <aside className="hidden h-full w-64 flex-col gap-6 border-r border-slate-200/70 bg-white/80 p-6 dark:border-slate-800/70 dark:bg-slate-950/70 md:fixed md:inset-y-0 md:left-0 md:flex md:overflow-y-auto">
      <div className="space-y-3">
        <BrandLogo className="h-10 w-full" />
      </div>
      <nav className="flex flex-col gap-2">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[#9c5f22] text-white'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
              }`
            }
          >
            {item.label ?? t(item.key)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-400">
        {t('notices.businessRequiredDesc')}
      </div>
    </aside>
  );
}
