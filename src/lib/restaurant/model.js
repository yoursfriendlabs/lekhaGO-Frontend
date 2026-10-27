/**
 * Defensive normalizers + small helpers for the restaurant add-on screens.
 * The backend may name a few fields differently (id vs orderId, items vs
 * orderItems...), so every screen reads data through these helpers.
 */
import { formatCurrency } from '@/lib/money/currency';

export const asArray = (value) => (Array.isArray(value) ? value : []);

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value) {
  return formatCurrency(value);
}

function pickDefined(obj, keys) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function pickNumber(obj, keys, fallback = 0) {
  const value = pickDefined(obj, keys);
  return value === undefined ? fallback : toNumber(value, fallback);
}

export function minutesSince(value, now = Date.now()) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((now - ts) / 60000));
}

export function formatClock(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString()} ${formatClock(date)}`;
}

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export const ITEM_STATUS = Object.freeze({
  PENDING: 'pending',
  SENT: 'sent',
  PREPARING: 'preparing',
  READY: 'ready',
  SERVED: 'served',
  VOID: 'void',
});

const NEXT_ITEM_STATUS = {
  sent: 'preparing',
  preparing: 'ready',
  ready: 'served',
};

export function nextItemStatus(status) {
  return NEXT_ITEM_STATUS[status] || null;
}

export function normalizeItemStatus(raw, kotNo) {
  const value = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['void', 'voided', 'cancelled', 'canceled', 'removed'].includes(value)) return ITEM_STATUS.VOID;
  if (['sent', 'queued', 'placed', 'in_kitchen'].includes(value)) return ITEM_STATUS.SENT;
  if (['preparing', 'cooking', 'in_progress', 'started'].includes(value)) return ITEM_STATUS.PREPARING;
  if (value === 'ready') return ITEM_STATUS.READY;
  if (['served', 'delivered', 'done', 'completed'].includes(value)) return ITEM_STATUS.SERVED;
  // '', pending, draft, open, new: unsent unless it already carries a KOT number.
  return kotNo ? ITEM_STATUS.SENT : ITEM_STATUS.PENDING;
}

const CLOSED_ORDER_STATUSES = new Set(['settled', 'paid', 'closed', 'completed', 'cancelled', 'canceled', 'void', 'voided']);

export function isClosedStatus(status) {
  return CLOSED_ORDER_STATUSES.has(String(status || '').trim().toLowerCase());
}

export const VOID_REASONS = Object.freeze([
  { code: 'spilled', fallback: 'Spilled' },
  { code: 'customer_changed_mind', fallback: 'Customer changed mind' },
  { code: 'wrong_order', fallback: 'Wrong order' },
  { code: 'other', fallback: 'Other' },
]);

/* ------------------------------------------------------------------ */
/* Items / extras                                                      */
/* ------------------------------------------------------------------ */

export function normalizeExtras(raw) {
  return asArray(raw)
    .map((entry) => {
      if (typeof entry === 'string') return { name: entry.trim(), price: 0 };
      if (!entry || typeof entry !== 'object') return null;
      return {
        name: String(entry.name || entry.label || entry.title || '').trim(),
        price: toNumber(entry.price ?? entry.amount),
      };
    })
    .filter((entry) => entry && entry.name);
}

export function normalizeItem(raw = {}) {
  const kotNo = pickDefined(raw, ['kotNo', 'kotNumber']) ?? raw.kot?.kotNo ?? raw.kot?.number ?? null;
  const quantity = toNumber(raw.quantity ?? raw.qty, 1);
  const unitPrice = toNumber(raw.unitPrice ?? raw.price ?? raw.salePrice);
  const extras = normalizeExtras(raw.extras ?? raw.modifiers ?? raw.addons);
  const extrasTotal = extras.reduce((sum, entry) => sum + entry.price, 0);
  const voided = raw.isVoid === true || raw.voided === true || Boolean(raw.voidedAt);
  const status = voided ? ITEM_STATUS.VOID : normalizeItemStatus(raw.status, kotNo);
  return {
    id: String(raw.id ?? raw.itemId ?? raw._id ?? ''),
    productId: raw.productId ?? raw.product?.id ?? '',
    name: String(raw.name || raw.productName || raw.product?.name || raw.description || 'Item'),
    quantity,
    unitPrice,
    lineTotal: toNumber(raw.lineTotal ?? raw.total, (unitPrice + extrasTotal) * quantity),
    status,
    kotNo: kotNo === null || kotNo === '' ? null : kotNo,
    sentAt: raw.sentAt || raw.kot?.sentAt || null,
    note: String(raw.note || raw.notes || '').trim(),
    extras,
    voidReason: raw.voidReason || raw.reason || '',
    raw,
  };
}

export function groupItemsByKot(items = []) {
  const pending = [];
  const voided = [];
  const kotMap = new Map();

  items.forEach((item) => {
    if (item.status === ITEM_STATUS.VOID) {
      voided.push(item);
      return;
    }
    if (item.status === ITEM_STATUS.PENDING || item.kotNo === null) {
      pending.push(item);
      return;
    }
    const key = String(item.kotNo);
    if (!kotMap.has(key)) kotMap.set(key, { kotNo: item.kotNo, sentAt: item.sentAt, items: [] });
    const group = kotMap.get(key);
    group.items.push(item);
    if (!group.sentAt && item.sentAt) group.sentAt = item.sentAt;
  });

  const kots = [...kotMap.values()].sort((a, b) => toNumber(b.kotNo) - toNumber(a.kotNo));
  return { pending, kots, voided };
}

/* ------------------------------------------------------------------ */
/* Bill                                                                */
/* ------------------------------------------------------------------ */

/**
 * Bill-preview / order payloads carry the bill as `bill`, as `bills: [bill]`
 * (first entry wins), or as top-level fields. Returns the object to normalize.
 */
export function extractBill(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.bill && typeof payload.bill === 'object') return payload.bill;
  const first = Array.isArray(payload.bills) ? payload.bills[0] : null;
  if (first && typeof first === 'object') return first;
  return payload;
}

export function normalizeBill(raw) {
  const bill = raw && typeof raw === 'object' ? raw : {};
  const subTotal = pickNumber(bill, ['subTotal', 'subtotal', 'itemsTotal']);
  const discountTotal = pickNumber(bill, ['discountTotal', 'discountAmount', 'discount']);
  const serviceChargeRate = pickDefined(bill, ['serviceChargeRate']);
  const serviceCharge = pickNumber(bill, ['serviceChargeTotal', 'serviceCharge', 'serviceChargeAmount']);
  const packagingCharge = pickNumber(bill, [
    'packagingChargeTotal',
    'packagingCharge',
    'packagingChargeAmount',
    'packaging',
  ]);
  const taxTotal = pickNumber(bill, ['taxTotal', 'taxAmount', 'tax', 'vat']);
  const explicitGrand = pickDefined(bill, ['grandTotal', 'total', 'payable', 'amountDue']);
  const grandTotal = explicitGrand !== undefined
    ? toNumber(explicitGrand)
    : roundMoney(subTotal - discountTotal + serviceCharge + packagingCharge + taxTotal);

  return {
    subTotal,
    discountTotal,
    serviceChargeRate: serviceChargeRate === undefined ? null : toNumber(serviceChargeRate, null),
    serviceCharge,
    packagingCharge,
    taxTotal,
    grandTotal,
    lines: asArray(bill.lines ?? bill.items).map(normalizeItem),
    raw: bill,
  };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export function normalizeOrder(payload) {
  const root = payload?.order && typeof payload.order === 'object' ? payload.order : payload || {};
  const itemsRaw = root.items ?? root.orderItems ?? root.OrderItems ?? payload?.items ?? [];
  const items = asArray(itemsRaw).map(normalizeItem);
  const billRaw = root.bill ?? payload?.bill ?? root.bills?.[0] ?? payload?.bills?.[0];
  const table = root.table && typeof root.table === 'object' ? root.table : null;

  return {
    id: String(root.id ?? root.orderId ?? payload?.orderId ?? ''),
    orderNo: root.orderNo ?? root.orderNumber ?? root.number ?? '',
    status: String(root.status || 'open').toLowerCase(),
    channel: String(root.channel || root.orderType || (table || root.tableId ? 'dine_in' : 'takeaway')).toLowerCase(),
    tableId: root.tableId ?? table?.id ?? null,
    tableName: root.tableName || table?.name || table?.label || root.tableLabel || '',
    guests: root.guests ?? root.guestCount ?? null,
    waiterName: root.waiterName || root.waiter?.name || (typeof root.waiter === 'string' ? root.waiter : ''),
    openedAt: root.openedAt || root.createdAt || null,
    hotelStayId: root.hotelStayId || root.stayId || null,
    party: root.party || (root.partyId ? { id: root.partyId, name: root.partyName } : null),
    saleId: root.saleId || null,
    discountAmount: toNumber(root.discountTotal ?? root.discountAmount ?? root.discount),
    discountPercent: toNumber(root.discountPercent),
    serviceChargeRate: pickDefined(root, ['serviceChargeRate']) === undefined
      ? null
      : toNumber(root.serviceChargeRate, null),
    packagingCharge: toNumber(root.packagingCharge ?? root.packagingChargeTotal),
    customerName: root.customerName || '',
    items,
    bill: normalizeBill(billRaw ?? {}),
    hasBill: Boolean(billRaw),
    raw: root,
  };
}

export function isTakeawayChannel(channel) {
  return ['takeaway', 'take_away', 'delivery', 'pickup'].includes(String(channel || '').toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Floor                                                               */
/* ------------------------------------------------------------------ */

function normalizeFloorOrder(raw = {}, fallbackTable = null) {
  const counts = raw.counts && typeof raw.counts === 'object' ? raw.counts : {};
  return {
    id: String(raw.id ?? raw.orderId ?? ''),
    orderNo: raw.orderNo ?? raw.orderNumber ?? raw.number ?? '',
    guests: raw.guests ?? raw.guestCount ?? null,
    openedAt: raw.openedAt || raw.createdAt || null,
    runningTotal: toNumber(raw.runningTotal ?? raw.total ?? raw.bill?.grandTotal),
    channel: String(raw.channel || raw.orderType || (fallbackTable ? 'dine_in' : 'takeaway')).toLowerCase(),
    tableId: raw.tableId ?? fallbackTable?.id ?? null,
    tableName: raw.tableName || fallbackTable?.name || '',
    customerName: raw.customerName || '',
    waiterName: raw.waiterName || raw.waiter?.name || '',
    counts: {
      ready: toNumber(counts.ready),
      sent: toNumber(counts.sent),
      preparing: toNumber(counts.preparing),
      pending: toNumber(counts.pending),
    },
  };
}

function categoryNameOf(table) {
  const category = table?.category;
  if (typeof category === 'string') return category.trim();
  return String(category?.name || table?.categoryName || '').trim();
}

export function normalizeFloor(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  let tablesRaw = [];
  if (Array.isArray(root)) {
    tablesRaw = root;
  } else if (Array.isArray(root.tables)) {
    tablesRaw = root.tables;
  } else if (Array.isArray(root.categories)) {
    tablesRaw = root.categories.flatMap((category) =>
      asArray(category.tables).map((table) => ({ ...table, category: table.category ?? category.name })),
    );
  } else if (Array.isArray(root.items)) {
    tablesRaw = root.items;
  }

  const allOrders = asArray(root.orders ?? root.openOrders).map((order) => normalizeFloorOrder(order));
  const ordersByTable = new Map();
  allOrders.forEach((order) => {
    if (order.tableId !== null && order.tableId !== undefined && order.tableId !== '') {
      ordersByTable.set(String(order.tableId), order);
    }
  });

  const embeddedIds = new Set();
  const tables = tablesRaw.map((table) => {
    const base = { id: String(table.id ?? table.tableId ?? ''), name: table.name || table.label || table.tableNo || '' };
    const embedded = table.order || table.activeOrder || table.currentOrder || null;
    let order = null;
    if (embedded && typeof embedded === 'object') {
      order = normalizeFloorOrder(embedded, base);
    } else if (table.orderId) {
      order = normalizeFloorOrder({ ...table, id: table.orderId }, base);
    } else if (ordersByTable.has(base.id)) {
      order = ordersByTable.get(base.id);
    }
    if (order?.id) embeddedIds.add(order.id);
    return {
      ...base,
      capacity: table.capacity ?? null,
      category: categoryNameOf(table),
      order: order && order.id ? order : null,
    };
  });

  const takeaway = allOrders.filter((order) => {
    const hasTable = order.tableId !== null && order.tableId !== undefined && order.tableId !== '';
    return !hasTable && !embeddedIds.has(order.id);
  });

  return { tables, takeaway, orders: allOrders };
}

/* ------------------------------------------------------------------ */
/* Kitchen                                                             */
/* ------------------------------------------------------------------ */

export const KITCHEN_COLUMNS = Object.freeze([
  { status: ITEM_STATUS.SENT, key: 'new', fallback: 'New' },
  { status: ITEM_STATUS.PREPARING, key: 'preparing', fallback: 'Preparing' },
  { status: ITEM_STATUS.READY, key: 'ready', fallback: 'Ready' },
]);

/**
 * Returns kitchen "cards": one per (order, KOT, status). Items inside a card
 * share the same status, so a card sits in exactly one column.
 */
export function normalizeKitchen(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const flat = [];

  const pushEntry = (entry, defaultStatus) => {
    if (!entry || typeof entry !== 'object') return;
    const orderId = String(entry.orderId ?? entry.order?.id ?? (entry.items ? entry.id : '') ?? '');
    const context = {
      orderId,
      orderNo: entry.orderNo ?? entry.order?.orderNo ?? '',
      tableName: entry.tableName || entry.table?.name || entry.order?.tableName || '',
      channel: String(entry.channel || entry.order?.channel || '').toLowerCase(),
      kotNo: entry.kotNo ?? entry.kotNumber ?? null,
      sentAt: entry.sentAt || null,
    };

    if (Array.isArray(entry.items)) {
      entry.items.forEach((item) => {
        const normalized = normalizeItem({ ...item, status: item.status ?? defaultStatus });
        flat.push({
          ...normalized,
          orderId: String(item.orderId ?? context.orderId),
          orderNo: item.orderNo ?? context.orderNo,
          tableName: item.tableName || context.tableName,
          channel: context.channel,
          kotNo: normalized.kotNo ?? context.kotNo,
          sentAt: normalized.sentAt || context.sentAt,
        });
      });
      return;
    }

    const normalized = normalizeItem({ ...entry, status: entry.status ?? defaultStatus });
    flat.push({
      ...normalized,
      orderId: context.orderId,
      orderNo: context.orderNo,
      tableName: context.tableName,
      channel: context.channel,
      kotNo: normalized.kotNo ?? context.kotNo,
      sentAt: normalized.sentAt || context.sentAt,
    });
  };

  const columns = root.columns && typeof root.columns === 'object' ? root.columns : root;
  const columnLists = [
    [ITEM_STATUS.SENT, columns.new ?? columns.sent],
    [ITEM_STATUS.PREPARING, columns.preparing],
    [ITEM_STATUS.READY, columns.ready],
  ].filter(([, list]) => Array.isArray(list));

  if (columnLists.length > 0) {
    columnLists.forEach(([status, list]) => list.forEach((entry) => pushEntry(entry, status)));
  } else {
    const list = Array.isArray(payload)
      ? payload
      : root.tickets ?? root.kots ?? root.orders ?? root.items ?? [];
    asArray(list).forEach((entry) => pushEntry(entry));
  }

  const kotSizes = new Map();
  flat.forEach((item) => {
    const key = `${item.orderId}|${item.kotNo ?? ''}`;
    kotSizes.set(key, (kotSizes.get(key) || 0) + 1);
  });

  const cardMap = new Map();
  flat
    .filter((item) => [ITEM_STATUS.SENT, ITEM_STATUS.PREPARING, ITEM_STATUS.READY].includes(item.status))
    .forEach((item) => {
      const kotKey = `${item.orderId}|${item.kotNo ?? ''}`;
      const key = `${kotKey}|${item.status}`;
      if (!cardMap.has(key)) {
        cardMap.set(key, {
          key,
          status: item.status,
          orderId: item.orderId,
          orderNo: item.orderNo,
          tableName: item.tableName,
          channel: item.channel,
          kotNo: item.kotNo,
          sentAt: item.sentAt,
          kotSize: kotSizes.get(kotKey) || 0,
          items: [],
        });
      }
      const card = cardMap.get(key);
      card.items.push(item);
      if (item.sentAt && (!card.sentAt || new Date(item.sentAt) < new Date(card.sentAt))) {
        card.sentAt = item.sentAt;
      }
    });

  const cards = [...cardMap.values()].map((card) => ({
    ...card,
    coversWholeKot: card.kotNo !== null && card.items.length === card.kotSize,
  }));

  cards.sort((a, b) => {
    const at = a.sentAt ? new Date(a.sentAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bt = b.sentAt ? new Date(b.sentAt).getTime() : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });

  return cards;
}
