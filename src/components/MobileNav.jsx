import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, Users, ShoppingCart, UserCheck, Briefcase, FileText, BarChart3, Settings2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';

const navItems = [
  { to: '/app', key: 'nav.home', icon: LayoutDashboard , role: ['owner','staff'] },
  { to: '/app/inventory', key: 'nav.items', icon: Boxes , role: ['owner','staff']},
  { to: '/app/services', key: 'nav.service', icon: Briefcase ,  role: ['owner','staff']},
  { to: '/app/sales', key: 'nav.sell', icon: UserCheck, role: ['owner','staff'] },
  { to: '/app/purchases', key: 'nav.buy', icon: ShoppingCart , role: ['owner']},
  { to: '/app/parties', key: 'nav.parties', icon: Users  , role: ['owner']},
  // { to: '/app/ledger', key: 'nav.ledger', icon: FileText },
  // { to: '/app/analytics', key: 'nav.stats', icon: BarChart3 },
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
              `flex flex-col items-center gap-1 min-w-[60px] rounded-xl px-2 py-1.5 transition-all ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
              }`
            }
          >
            <item.icon size={20} strokeWidth={2} />
            <span className="text-[10px] font-medium leading-none">{item.label ?? t(item.key)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
