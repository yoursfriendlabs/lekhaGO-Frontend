import { NavLink } from 'react-router-dom';
import { useI18n } from '../lib/i18n.jsx';

const navItems = [
  { to: '/app', key: 'nav.dashboard' },
  { to: '/app/products', key: 'nav.products' },
  { to: '/app/inventory', key: 'nav.inventory' },
  { to: '/app/parties', key: 'nav.parties' },
  { to: '/app/purchases', key: 'nav.purchases' },
  { to: '/app/sales', key: 'nav.sales' },
  { to: '/app/services', key: 'nav.services' },
  { to: '/app/ledger', key: 'nav.ledger' },
  { to: '/app/analytics', key: 'nav.analytics' },
  { to: '/app/order-attributes', key: 'nav.orderAttributes' },
];

export default function Sidebar() {
  const { t } = useI18n();

  return (
    <aside className="hidden h-full w-64 flex-col gap-6 border-r border-slate-200/70 bg-white/80 p-6 dark:border-slate-800/70 dark:bg-slate-950/70 md:flex">
      <div>
        <h1 className="font-serif text-2xl text-slate-900 dark:text-white">ManageMyShop</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('app.tagline')}</p>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-emerald-300 text-slate-950 dark:bg-ocean'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70'
              }`
            }
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-400">
        {t('notices.businessRequiredDesc')}
      </div>
    </aside>
  );
}
