import {
  BarChart3,
  Boxes,
  ClipboardList,
  Clock,
  Coffee,
  ContactRound,
  FileText,
  LayoutDashboard,
  ListTodo,
  Receipt,
  Settings2,
  ShoppingCart,
  UserRound,
  Users,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

export const NAV_ROLE_MAP = {
  dashboard: ["owner", "staff", "admin", "super_admin"],
  orders: ["owner", "staff", "admin", "super_admin"],
  inventory: ["owner", "staff", "admin", "super_admin"],
  quickPos: ["owner", "staff", "admin", "super_admin"],
  sales: ["owner", "staff", "admin", "super_admin"],
  services: ["owner", "staff", "admin", "super_admin"],
  purchases: ["owner", "staff", "admin", "super_admin"],
  parties: ["owner", "staff", "admin", "super_admin"],
  tasks: ["owner", "staff", "admin", "super_admin"],
  tables: ["owner", "staff", "admin", "super_admin"],
  billing: ["owner", "staff", "admin", "super_admin"],
  attendance: ["staff"],
  staff: ["owner", "staff", "admin", "super_admin"],
  reports: ["owner", "staff", "admin", "super_admin"],
  settings: ["owner", "staff", "admin", "super_admin"],
};

export const NAV_ICON_MAP = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  inventory: Boxes,
  sales: FileText,
  quickPos: Receipt,
  services: Wrench,
  purchases: ShoppingCart,
  parties: Users,
  tasks: ListTodo,
  tables: Coffee,
  billing: UtensilsCrossed,
  attendance: Clock,
  staff: ContactRound,
  "staff-salary": ContactRound,
  profile: UserRound,
  reports: BarChart3,
  settings: Settings2,
};

export const NAV_GROUPS = [
  {
    id: "overview",
    labelKey: "nav.groups.overview",
    keys: ["dashboard"],
  },
  {
    id: "operations",
    labelKey: "nav.groups.operations",
    keys: [
      "inventory",
      "quickPos",
      "sales",
      "orders",
      "billing",
      "services",
      "tables",
      "purchases",
    ],
  },
  {
    id: "people",
    labelKey: "nav.groups.people",
    keys: ["parties", "tasks", "staff", "attendance", "profile", "staff-salary"],
  },
  {
    id: "insights",
    labelKey: "nav.groups.insights",
    keys: ["reports"],
  },
  {
    id: "account",
    labelKey: "nav.groups.account",
    keys: ["settings"],
  },
];

export function getNavIcon(key) {
  return NAV_ICON_MAP[key] || LayoutDashboard;
}

export function groupNavItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  const used = new Set();

  const groups = NAV_GROUPS.map((group) => {
    const groupedItems = group.keys
      .map((key) => list.find((item) => item?.key === key))
      .filter(Boolean);
    groupedItems.forEach((item) => used.add(item.key));
    return { id: group.id, labelKey: group.labelKey, items: groupedItems };
  }).filter((group) => group.items.length > 0);

  const leftover = list.filter((item) => item?.key && !used.has(item.key));
  if (leftover.length) {
    groups.push({
      id: "more",
      labelKey: "nav.groups.more",
      items: leftover,
    });
  }

  return groups;
}
