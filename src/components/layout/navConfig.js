import {
  BarChart3,
  BadgeDollarSign,
  BedDouble,
  Boxes,
  ClipboardList,
  Clock,
  Coffee,
  ContactRound,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  Receipt,
  Settings2,
  ShoppingCart,
  Sparkles,
  UserRound,
  Users,
  Utensils,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

export const NAV_ROLE_MAP = {
  dashboard: ["owner", "staff", "admin", "super_admin"],
  orders: ["owner", "staff", "admin", "super_admin"],
  kitchen: ["owner", "staff", "admin", "super_admin"],
  inventory: ["owner", "staff", "admin", "super_admin"],
  quickPos: ["owner", "staff", "admin", "super_admin"],
  sales: ["owner", "staff", "admin", "super_admin"],
  services: ["owner", "staff", "admin", "super_admin"],
  purchases: ["owner", "staff", "admin", "super_admin"],
  budgets: ["owner", "staff", "admin", "super_admin"],
  parties: ["owner", "staff", "admin", "super_admin"],
  tasks: ["owner", "staff", "admin", "super_admin"],
  tables: ["owner", "staff", "admin", "super_admin"],
  billing: ["owner", "staff", "admin", "super_admin"],
  frontDesk: ["owner", "staff", "admin", "super_admin"],
  rooms: ["owner", "staff", "admin", "super_admin"],
  housekeeping: ["owner", "staff", "admin", "super_admin"],
  students: ["owner", "staff", "admin", "super_admin"],
  attendance: ["staff"],
  staff: ["owner", "staff", "admin", "super_admin"],
  reports: ["owner", "staff", "admin", "super_admin"],
  settings: ["owner", "staff", "admin", "super_admin"],
};

export const NAV_ICON_MAP = {
  dashboard: LayoutDashboard,
  orders: ClipboardList,
  kitchen: Utensils,
  inventory: Boxes,
  sales: FileText,
  quickPos: Receipt,
  services: Wrench,
  purchases: ShoppingCart,
  budgets: BadgeDollarSign,
  parties: Users,
  tasks: ListTodo,
  tables: Coffee,
  billing: UtensilsCrossed,
  frontDesk: BedDouble,
  rooms: BedDouble,
  housekeeping: Sparkles,
  students: GraduationCap,
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
      "kitchen",
      "billing",
      "frontDesk",
      "rooms",
      "housekeeping",
      "services",
      "tables",
      "purchases",
      "budgets",
    ],
  },
  {
    id: "people",
    labelKey: "nav.groups.people",
    keys: ["students", "parties", "tasks", "staff", "attendance", "profile", "staff-salary"],
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

export function getNavIcon(key, route = "") {
  // Some business types file Quick POS under the "sales" key; give it the
  // POS icon so it does not look the same as Sales invoices.
  if (String(route).includes("/pos")) return NAV_ICON_MAP.quickPos;
  return NAV_ICON_MAP[key] || LayoutDashboard;
}

export function groupNavItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  const used = new Set();

  // Several items can share a key (Quick POS and Sales invoices are both
  // "sales" for some business types), so keep every match, not just the first.
  const groups = NAV_GROUPS.map((group) => {
    const groupedItems = group.keys.flatMap((key) =>
      list.filter((item) => item?.key === key && !used.has(item)),
    );
    groupedItems.forEach((item) => used.add(item));
    return { id: group.id, labelKey: group.labelKey, items: groupedItems };
  }).filter((group) => group.items.length > 0);

  const leftover = list.filter((item) => item?.key && !used.has(item));
  if (leftover.length) {
    groups.push({
      id: "more",
      labelKey: "nav.groups.more",
      items: leftover,
    });
  }

  return groups;
}
