import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, Users, ShoppingCart, Briefcase, Settings2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

const navItems = [
  { to: '/app', key: 'nav.home', icon: LayoutDashboard , role: ['owner','staff'] },
  { to: '/app/inventory', key: 'nav.items', icon: Boxes , role: ['owner','staff']},
  { to: '/app/services', key: 'nav.service', icon: Briefcase ,  role: ['owner','staff']},
  { to: '/app/purchases', key: 'nav.buy', icon: ShoppingCart , role: ['owner']},
  { to: '/app/parties', key: 'nav.parties', icon: Users  , role: ['owner']},
  { to: '/app/settings', key: 'nav.settings', icon: Settings2 , role: ['owner','staff'] }
];

export default function MobileNav() {
  const { t } = useI18n();
  const { role } = useAuth();
  const visibleNavItems = navItems.filter((item) => !item.role || item.role.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/70 bg-white/95 px-2 py-3 shadow-lg backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/90 md:hidden">
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              `flex min-w-[70px] flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-center transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-700 shadow-sm dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <item.icon size={20} strokeWidth={2} />
            <span className="text-[10px] font-medium leading-tight">{item.label ?? t(item.key)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
