import { NavLink } from "react-router-dom";
import { getNavIcon } from "./navConfig.js";
import { useAppNavigation } from "./useAppNavigation.js";

export default function MobileNav() {
  const { visibleNavItems } = useAppNavigation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-secondary-200/70 bg-surface/95 px-2 py-2 shadow-lg backdrop-blur md:hidden">
      <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-[max(env(safe-area-inset-bottom),0px)]">
        {visibleNavItems.map((item) => {
          const Icon = getNavIcon(item.key);

          return (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.route === "/app"}
              className={({ isActive }) =>
                `flex min-w-[82px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 text-center transition-all ${
                  isActive
                    ? "bg-primary-50 text-primary-700 shadow-sm"
                    : "text-secondary-500 hover:bg-primary/10"
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
