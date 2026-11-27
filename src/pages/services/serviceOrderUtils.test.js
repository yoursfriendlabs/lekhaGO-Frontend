import { describe, expect, it } from "vitest";
import {
  computeLineTotal,
  getLineDiscount,
  getComputedServiceTotals,
  getServiceAttachmentUrls,
  getServiceItems,
  isPdfAttachment,
  isPlaceholderItem,
  normalizeAttachmentUrls,
  normalizeServiceOrder,
  toFiniteNumber,
} from "./serviceOrderUtils.js";

describe("toFiniteNumber", () => {
  it("parses numeric strings and falls back for invalid values", () => {
    expect(toFiniteNumber("12.5")).toBe(12.5);
    expect(toFiniteNumber("nope", 3)).toBe(3);
    expect(toFiniteNumber(undefined, 0)).toBe(0);
  });
});

describe("attachments", () => {
  it("dedupes attachment urls from mixed shapes", () => {
    expect(
      normalizeAttachmentUrls(
        ["https://a.test/1.jpg", "https://a.test/1.jpg"],
        "https://a.test/2.jpg",
        "",
      ),
    ).toEqual(["https://a.test/1.jpg", "https://a.test/2.jpg"]);
  });

  it("reads both attachments and legacy attachment fields", () => {
    expect(
      getServiceAttachmentUrls({
        attachment: "https://a.test/old.pdf",
        attachments: ["https://a.test/new.jpg"],
      }),
    ).toEqual(["https://a.test/new.jpg", "https://a.test/old.pdf"]);
  });

  it("detects pdf urls with query strings", () => {
    expect(isPdfAttachment("https://a.test/file.PDF?x=1")).toBe(true);
    expect(isPdfAttachment("https://a.test/file.jpg")).toBe(false);
  });
});

describe("service items and totals", () => {
  it("normalizes nested ServiceItems onto items", () => {
    const order = normalizeServiceOrder({
      id: "1",
      paymentMethod: "cash",
      receivedTotal: "10",
      ServiceItems: [
        { itemType: "labor", description: "Fix", quantity: "1", unitPrice: "100", lineTotal: "100", taxRate: "13" },
        { itemType: "part", description: "Bolt", quantity: "2", unitPrice: "5", lineTotal: "10" },
      ],
    });

    expect(getServiceItems(order)).toHaveLength(2);
    expect(order.laborTotal).toBe(100);
    expect(order.partsTotal).toBe(10);
    expect(order.taxTotal).toBe(13);
    expect(order.grandTotal).toBe(123);
    expect(order.receivedTotal).toBe(10);
    expect(order.paymentMethod).toBe("cash");
  });

  it("infers bank payment when a bank id is present", () => {
    const order = normalizeServiceOrder({
      bankId: "bank-1",
      items: [{ itemType: "labor", quantity: 1, unitPrice: 50, lineTotal: 50 }],
    });
    expect(order.paymentMethod).toBe("bank");
    expect(order.bankId).toBe("bank-1");
  });

  it("caps discount at subtotal plus tax", () => {
    const totals = getComputedServiceTotals(
      [{ itemType: "labor", lineTotal: 100, taxRate: 0 }],
      { discount: 999 },
    );
    expect(totals.discountTotal).toBe(100);
    expect(totals.grandTotal).toBe(0);
  });
});

describe("isPlaceholderItem", () => {
  it("treats a blank default labor row as a placeholder", () => {
    expect(
      isPlaceholderItem({
        itemType: "labor",
        description: "",
        productId: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      }),
    ).toBe(true);
    expect(
      isPlaceholderItem({
        itemType: "labor",
        description: "Repair",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      }),
    ).toBe(false);
  });
});

describe("computeLineTotal", () => {
  it("subtracts the line discount from quantity × price", () => {
    expect(computeLineTotal({ quantity: "2", unitPrice: "150", discount: "50" })).toBe(250);
  });

  it("never goes below zero and ignores negative discounts", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 100, discount: 500 })).toBe(0);
    expect(computeLineTotal({ quantity: 1, unitPrice: 100, discount: -20 })).toBe(100);
  });
});

describe("getLineDiscount", () => {
  it("uses an explicit discount when present", () => {
    expect(getLineDiscount({ quantity: 1, unitPrice: 100, lineTotal: 100, discount: "10" })).toBe(10);
  });

  it("recovers the discount from a saved line total", () => {
    expect(getLineDiscount({ quantity: 2, unitPrice: 100, lineTotal: 170 })).toBe(30);
    expect(getLineDiscount({ quantity: 2, unitPrice: 100, lineTotal: 200 })).toBe(0);
  });
});
