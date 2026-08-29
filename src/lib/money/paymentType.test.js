import { describe, expect, it } from "vitest";
import {
  getPaymentTypeDisplay,
  hasPaymentTypeData,
  normalizePaymentType,
} from "./paymentType.js";

describe("normalizePaymentType and getPaymentTypeDisplay", () => {
  it("correctly handles bank payment on due service orders", () => {
    const dueOrder = {
      paymentMethod: "bank",
      bankId: "bank-1",
      Bank: { id: "bank-1", name: "Nabil Bank", currentBalance: 5000 },
      receivedTotal: 0,
      grandTotal: 1000,
    };
    expect(normalizePaymentType(dueOrder)).toEqual({
      method: "bank",
      label: "Nabil Bank",
      bankId: "bank-1",
      bankName: "Nabil Bank",
      bankCurrentAmount: 5000,
      bankCurrentBalance: 5000,
      bank: { id: "bank-1", name: "Nabil Bank", currentBalance: 5000 },
    });

    const display = getPaymentTypeDisplay(dueOrder, {
      cashLabel: "Cash",
      bankLabel: "Bank",
    });
    expect(display.label).toBe("Nabil Bank");
    expect(display.method).toBe("bank");
  });

  it("correctly handles cash payment on due orders", () => {
    const dueOrder = {
      paymentMethod: "cash",
      receivedTotal: 0,
      grandTotal: 1000,
    };
    expect(normalizePaymentType(dueOrder)).toEqual({
      method: "cash",
      label: "",
      bankId: "",
      bankName: "",
      bankCurrentAmount: null,
      bankCurrentBalance: null,
      bank: {},
    });

    const display = getPaymentTypeDisplay(dueOrder, {
      cashLabel: "Cash",
      bankLabel: "Bank",
    });
    expect(display.label).toBe("Cash");
    expect(display.method).toBe("cash");
  });
});
