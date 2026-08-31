import { normalizeJewelleryAttributes, getJewelleryBreakdown } from "@/lib/business/jewellery.js";
import dayjs, { todayISODate } from "@/lib/dates/datetime";

export const emptyItem = {
  itemType: "labor",
  description: "",
  productId: "",
  quantity: "1",
  unitType: "primary",
  unitPrice: "0",
  taxRate: "0",
  lineTotal: "0",
};

export const TABLE_ROW_OPTIONS = [10, 20, 30, 40, 50];

export const makeEmptyHeader = () => ({
  partyId: "",
  orderNo: "",
  status: "in_progress",
  notes: "",
  deliveryDate: todayISODate(),
  paymentMethod: "cash",
  bankId: "",
  paymentNote: "",
  attachment: "",
  attachments: [],
  attributes: {},
  tableId: "",
});

export function normalizeAttachmentUrls(...values) {
  const next = [];
  const seen = new Set();

  const addValue = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }

    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    next.push(normalized);
  };

  values.forEach(addValue);
  return next;
}

export function getServiceAttachmentUrls(record) {
  return normalizeAttachmentUrls(record?.attachments, record?.attachment);
}

export function isPdfAttachment(url) {
  return /\.pdf(?:$|[?#])/i.test(String(url || ""));
}

export function getDeliveryDaysLeft(deliveryDate) {
  if (!deliveryDate) return null;
  const today = dayjs().startOf("day");
  const d = dayjs(deliveryDate).startOf("day");
  if (!d.isValid()) return null;
  return d.diff(today, "day");
}

export function getVatAmount(lineTotal, taxRate) {
  return (Number(lineTotal || 0) * Number(taxRate || 0)) / 100;
}

export function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeServiceItem(item) {
  const quantity = toFiniteNumber(item?.quantity, 0);
  const unitPrice = toFiniteNumber(item?.unitPrice, 0);
  const lineTotal = toFiniteNumber(item?.lineTotal, quantity * unitPrice);

  return {
    ...item,
    itemType: item?.itemType || "labor",
    description: item?.description || "",
    productId: item?.productId || "",
    quantity,
    unitType: item?.unitType || "primary",
    unitPrice,
    taxRate: toFiniteNumber(item?.taxRate, 0),
    lineTotal,
  };
}

export function getServiceItems(record) {
  if (Array.isArray(record)) return record.map(normalizeServiceItem);
  if (!record || typeof record !== "object") return [];
  if (Array.isArray(record.items))
    return record.items.map(normalizeServiceItem);
  if (Array.isArray(record.ServiceItems))
    return record.ServiceItems.map(normalizeServiceItem);
  return [];
}

export function getComputedServiceTotals(items, attributes = {}) {
  const jewellery = getJewelleryBreakdown(attributes);
  const laborTotal =
    items
      .filter((item) => item.itemType === "labor")
      .reduce((sum, item) => sum + toFiniteNumber(item.lineTotal, 0), 0) +
    jewellery.diamondChargeNumber;
  const partsTotal = items
    .filter((item) => item.itemType === "part")
    .reduce((sum, item) => sum + toFiniteNumber(item.lineTotal, 0), 0);
  const subTotal = laborTotal + partsTotal;
  const taxTotal =
    items.reduce(
      (sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate),
      0,
    ) + jewellery.additionalTaxNumber;
  const discountTotal = Math.min(
    Math.max(
      toFiniteNumber(attributes?.discountTotal ?? attributes?.discount, 0),
      0,
    ),
    subTotal + taxTotal,
  );
  const grandTotal = Math.max(subTotal + taxTotal - discountTotal, 0);

  return {
    laborTotal,
    partsTotal,
    subTotal,
    taxTotal,
    discountTotal,
    grandTotal,
  };
}

export function getServiceOrderTotals(record) {
  const items = getServiceItems(record);
  const computed = getComputedServiceTotals(items, record?.attributes || {});
  const laborTotal = toFiniteNumber(record?.laborTotal, computed.laborTotal);
  const partsTotal = toFiniteNumber(record?.partsTotal, computed.partsTotal);
  const subTotal = toFiniteNumber(record?.subTotal, laborTotal + partsTotal);
  const taxTotal = toFiniteNumber(record?.taxTotal, computed.taxTotal);
  const discountTotal = Math.min(
    Math.max(
      toFiniteNumber(
        record?.discountTotal ?? record?.discount,
        computed.discountTotal,
      ),
      0,
    ),
    subTotal + taxTotal,
  );
  const grandTotal = toFiniteNumber(
    record?.grandTotal,
    Math.max(subTotal + taxTotal - discountTotal, 0),
  );

  return {
    laborTotal,
    partsTotal,
    subTotal,
    taxTotal,
    discountTotal,
    grandTotal,
  };
}

export function normalizeServiceOrder(record) {
  if (!record || typeof record !== "object" || Array.isArray(record))
    return record;

  const items = getServiceItems(record);
  const normalizedAttributes = normalizeJewelleryAttributes(
    record.attributes || {},
  );
  const totals = getServiceOrderTotals({
    ...record,
    items,
    attributes: normalizedAttributes,
  });

  const rawPaymentMethod = String(
    record.paymentMethod || record.method || "",
  ).toLowerCase();
  const paymentMethod =
    rawPaymentMethod === "bank"
      ? "bank"
      : rawPaymentMethod === "cash"
        ? "cash"
        : record.bankId || record.Bank?.id || record.bank?.id
          ? "bank"
          : "cash";

  const isBank = paymentMethod === "bank";
  const bankId = isBank
    ? String(record.bankId || record.Bank?.id || record.bank?.id || "").trim()
    : null;
  const Bank = isBank ? record.Bank || record.bank || null : null;
  const bank = isBank ? record.bank || record.Bank || null : null;

  return {
    ...record,
    paymentMethod,
    bankId,
    Bank,
    bank,
    attributes: normalizedAttributes,
    items,
    ServiceItems: Array.isArray(record.ServiceItems)
      ? record.ServiceItems
      : items,
    ...totals,
    receivedTotal: toFiniteNumber(record.receivedTotal, 0),
  };
}

export function isPlaceholderItem(item) {
  if (!item) return true;
  return (
    !String(item.description || "").trim() &&
    !String(item.productId || "").trim() &&
    Number(item.unitPrice || 0) === 0 &&
    Number(item.lineTotal || 0) === 0 &&
    Number(item.quantity || 1) === 1
  );
}
