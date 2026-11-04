import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, clearApiCache } from "./api";
import { setBusinessId, setToken } from "./storage";

function jsonResponse(body, status = 200) {
  return {
    ok: true,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
  };
}

describe("detail cache after an update", () => {
  beforeEach(() => {
    clearApiCache();
    localStorage.clear();
    setToken("t");
    setBusinessId("b");
  });

  it("reads a service again once it has been edited", async () => {
    let notes = "before";
    let getCalls = 0;
    globalThis.fetch = vi.fn(async (url, options = {}) => {
      const method = (options.method || "GET").toUpperCase();
      if (method === "PATCH") {
        notes = JSON.parse(options.body).notes;
        return jsonResponse({ id: "s1", notes });
      }
      getCalls += 1;
      return jsonResponse({ id: "s1", notes });
    });

    expect((await api.getService("s1")).notes).toBe("before");
    await api.updateService("s1", { notes: "after" });

    expect((await api.getService("s1")).notes).toBe("after");
    expect(getCalls).toBe(2);
  });
});
