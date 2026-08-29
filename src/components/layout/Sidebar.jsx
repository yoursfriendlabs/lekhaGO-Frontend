import { NavLink } from "react-router-dom";
import { useI18n } from "@/lib/i18n.jsx";
import BrandLogo from "./BrandLogo.jsx";
import UpgradeSubscriptionCta from "../subscription/UpgradeSubscriptionCta.jsx";
import { getNavIcon } from "./navConfig.js";
import { useAppNavigation } from "./useAppNavigation.js";

export default function Sidebar() {
  const t = useI18n().t;
  const { navGroups } = useAppNavigation();

  return (
    <aside className="group/sidebar hidden h-full w-16 flex-col overflow-hidden border-r border-secondary-200/70 bg-surface/95 shadow-none transition-[width,box-shadow] duration-200 ease-out hover:w-60 hover:shadow-[8px_0_32px_rgba(28,25,23,0.08)] focus-within:w-60 focus-within:shadow-[8px_0_32px_rgba(28,25,23,0.08)] md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex">
      <NavLink
        to="/app"
        end
        title="PasalManager"
        className="flex h-16 shrink-0 items-center px-4"
      >
        <BrandLogo
          variant="mark"
          className="h-8 w-8 shrink-0 group-hover/sidebar:hidden group-focus-within/sidebar:hidden"
        />
        <BrandLogo className="hidden h-8 w-auto max-w-[176px] group-hover/sidebar:inline-flex group-focus-within/sidebar:inline-flex" />
      </NavLink>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-1">
        {navGroups.map((group, groupIndex) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            {groupIndex > 0 ? (
              <div
                className="mx-2 my-1.5 h-px bg-secondary-200/80 group-hover/sidebar:hidden group-focus-within/sidebar:hidden"
                aria-hidden
              />
            ) : null}
            <p className="hidden px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary-400 group-hover/sidebar:block group-focus-within/sidebar:block">
              {t(group.labelKey)}
            </p>
            {group.items.map((item) => {
              const Icon = getNavIcon(item.key);
              return (
                <NavLink
                  key={item.route}
                  to={item.route}
                  end={item.route === "/app"}
                  title={item.label}
                  className={({ isActive }) =>
                    `flex h-10 items-center gap-3 rounded-xl px-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-primary text-white"
                        : "text-ink-light hover:bg-primary/10"
                    }`
                  }
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
                    <Icon size={18} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="min-w-0 truncate whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto hidden shrink-0 border-t border-secondary-200/60 px-2 py-3 group-hover/sidebar:block group-focus-within/sidebar:block">
        <UpgradeSubscriptionCta variant="sidebar" />
      </div>
    </aside>
  );
}
