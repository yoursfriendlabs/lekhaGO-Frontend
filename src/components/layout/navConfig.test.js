import { describe, expect, it } from "vitest";
import { groupNavItems } from "./navConfig.js";

describe("groupNavItems", () => {
  it("groups visible items into categories and keeps leftover keys", () => {
    const groups = groupNavItems([
      { key: "settings", label: "Settings", route: "/app/settings" },
      { key: "dashboard", label: "Dashboard", route: "/app" },
      { key: "inventory", label: "Inventory", route: "/app/inventory" },
      { key: "parties", label: "Parties", route: "/app/parties" },
      { key: "custom", label: "Custom", route: "/app/custom" },
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      "overview",
      "operations",
      "people",
      "account",
      "more",
    ]);
    expect(groups[0].items.map((item) => item.key)).toEqual(["dashboard"]);
    expect(groups[1].items.map((item) => item.key)).toEqual(["inventory"]);
    expect(groups[2].items.map((item) => item.key)).toEqual(["parties"]);
    expect(groups[3].items.map((item) => item.key)).toEqual(["settings"]);
    expect(groups[4].items.map((item) => item.key)).toEqual(["custom"]);
  });

  it("omits empty categories", () => {
    const groups = groupNavItems([
      { key: "dashboard", label: "Dashboard", route: "/app" },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("overview");
  });
});
