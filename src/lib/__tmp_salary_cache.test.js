import { describe, it, expect, beforeEach, vi } from "vitest";
import { api, clearApiCache } from "./api";
import { setToken, setBusinessId } from "./storage";

describe("salary records cache", () => {
  beforeEach(() => {
    clearApiCache();
    localStorage.clear();
    setToken("t");
    setBusinessId("b");
  });

  it("refetches after add", async () => {
    let getCalls = 0;
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const method = (options.method || "GET").toUpperCase();
      if (method === "GET") {
        getCalls++;
        return {
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({
            records:
              getCalls === 1
                ? []
                : [
                    {
                      id: 1,
                      amount: 100,
                      type: "salary",
                      monthYear: "2026-07",
                      date: "2026-07-01",
                    },
                  ],
          }),
        };
      }
      return {
        ok: true,
        status: 201,
        headers: { get: () => "application/json" },
        json: async () => ({ success: true, record: { id: 1 } }),
      };
    });

    const first = await api.getStaffSalaryRecords("m1");
    expect(first.records.length).toBe(0);

    await api.addStaffSalaryRecord("m1", {
      amount: 100,
      type: "salary",
      date: "2026-07-01",
      monthYear: "2026-07",
      note: "",
    });

    const after = await api.getStaffSalaryRecords("m1");
    expect(getCalls).toBe(2);
    expect(after.records.length).toBe(1);
  });
});
