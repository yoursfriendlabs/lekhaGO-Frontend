import { useMemo } from "react";
import { useAuth } from "@/lib/auth.jsx";
import { useI18n } from "@/lib/i18n.jsx";
import { useBusinessSettings } from "@/lib/business/businessSettings.jsx";
import { getNavigationForBusinessType } from "@/lib/business/businessTypeConfig.js";
import {
  expandNavigationForPermissions,
  getNavItemPermissionKey,
  withOwnProfileNavItem,
} from "@/lib/accessControl";
import { NAV_ROLE_MAP, groupNavItems } from "./navConfig.js";

export function useAppNavigation() {
  const t = useI18n().t;
  const { role, hasFeatureAccess, accessControl } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const isGeneralStaff = accessControl?.staffCategory === "general_staff";

  const visibleNavItems = useMemo(() => {
    const rawNavigation = getNavigationForBusinessType(
      Array.isArray(businessProfile?.navigation) &&
        businessProfile.navigation.length
        ? businessProfile.navigation
        : [
            { key: "dashboard", label: t("nav.dashboard"), route: "/app" },
            { key: "inventory", label: t("nav.items"), route: "/app/inventory" },
            { key: "sales", label: t("nav.sales"), route: "/app/sales" },
            { key: "purchases", label: t("nav.expenses"), route: "/app/purchases" },
            { key: "tasks", label: t("nav.tasks"), route: "/app/tasks" },
            { key: "parties", label: t("nav.parties"), route: "/app/parties" },
            { key: "attendance", label: t("nav.attendance"), route: "/app/attendance" },
            { key: "staff", label: t("nav.staff"), route: "/app/staff" },
            { key: "reports", label: t("nav.reports") || "Reports", route: "/app/reports" },
            { key: "settings", label: t("nav.settings"), route: "/app/settings" },
          ],
      businessProfile,
    );

    let hasReports = false;
    const processedNavigation = [];
    rawNavigation.forEach((item) => {
      if (item.key === "analytics" || item.key === "ledger" || item.key === "reports") {
        if (!hasReports) {
          processedNavigation.push({
            key: "reports",
            label: t("nav.reports") || "Reports",
            route: "/app/reports",
          });
          hasReports = true;
        }
      } else {
        processedNavigation.push(item);
      }
    });

    const navigation = processedNavigation.map((item) => {
      if (item?.key === "purchases") return { ...item, label: t("nav.expenses") };
      if (item?.key === "attendance") return { ...item, label: t("nav.attendance") };
      if (item?.key === "staff") return { ...item, label: t("nav.staff") };
      if (item?.key === "quickPos") return { ...item, label: t("nav.quickPos") || item.label };
      if (item?.key === "sales" && String(item?.route || "").includes("/sales")) {
        return { ...item, label: t("nav.salesInvoices") };
      }
      return item;
    });

    const membershipId = accessControl?.membershipId;
    let nextItems;
    if (isGeneralStaff) {
      nextItems = [
        { key: "attendance", label: t("nav.attendance"), route: "/app/attendance" },
        { key: "settings", label: t("nav.settings"), route: "/app/settings" },
      ];
    } else {
      nextItems = expandNavigationForPermissions(navigation, hasFeatureAccess)
        .filter((item) => {
          const permissionKey = getNavItemPermissionKey(item);
          return (
            NAV_ROLE_MAP[permissionKey] ||
            NAV_ROLE_MAP[item.key] ||
            ["owner", "staff"]
          ).includes(role);
        })
        .filter((item) => hasFeatureAccess(getNavItemPermissionKey(item)));
    }

    return withOwnProfileNavItem(nextItems, {
      role,
      membershipId,
      label: t("nav.profile"),
    });
  }, [accessControl, businessProfile, hasFeatureAccess, isGeneralStaff, role, t]);

  const navGroups = useMemo(() => groupNavItems(visibleNavItems), [visibleNavItems]);

  return { visibleNavItems, navGroups };
}
