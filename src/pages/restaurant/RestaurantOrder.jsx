import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  ChefHat,
  GitMerge,
  Minus,
  Percent,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import Notice from '@/components/ui/Notice.jsx';
import ProductTile from '@/components/restaurant/ProductTile.jsx';
import ItemOptionsDialog from '@/components/restaurant/ItemOptionsDialog.jsx';
import VoidItemDialog from '@/components/restaurant/VoidItemDialog.jsx';
import StatusChip from '@/components/restaurant/StatusChip.jsx';
import {
  CancelOrderDialog,
  DiscountDialog,
  MergeOrderDialog,
  MoveOrderDialog,
} from '@/components/restaurant/OrderActionDialogs.jsx';
import { useThermalPrintQueue } from '@/components/restaurant/useThermalPrintQueue.jsx';
import SettleDialog from '@/pages/restaurant/SettleDialog.jsx';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBusinessSettings } from '@/lib/business/businessSettings.jsx';
import { pickBackendMessage } from '@/lib/business/hospitality';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { SSE_EVENTS } from '@/hooks/useSSE.js';
import { useLiveScreenRefresh } from '@/hooks/useLiveScreenRefresh.js';
import {
  ITEM_STATUS,
  formatClock,
  formatDateTime,
  formatMoney,
  groupItemsByKot,
  isClosedStatus,
  isTakeawayChannel,
  minutesSince,
  extractBill,
  normalizeBill,
  normalizeOrder,
  toNumber,
} from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

const LIVE_EVENTS = [SSE_EVENTS.RESTAURANT_ORDERS_CHANGED, SSE_EVENTS.KITCHEN_CHANGED];

/* ------------------------------------------------------------------ */
/* Menu helpers                                                        */
/* ------------------------------------------------------------------ */

function productCategoryName(product = {}) {
  if (typeof product.categoryName === 'string' && product.categoryName.trim()) return product.categoryName.trim();
  if (product.category && typeof product.category === 'object' && product.category.name) {
    return String(product.category.name).trim();
  }
  if (typeof product.category === 'string') return product.category.trim();
  return '';
}

function normalizeMenuProduct(raw = {}) {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: String(raw.name || 'Item'),
    price: toNumber(raw.salePrice ?? raw.sellingPrice ?? raw.price),
    imageUrl: raw.imageUrl || raw.image || '',
    category: productCategoryName(raw),
  };
}

function isMenuProduct(raw = {}) {
  if (raw.isActive === false || raw.active === false) return false;
  if (String(raw.status || '').toLowerCase() === 'inactive') return false;
  if (String(raw.itemType || '').toLowerCase() === 'ingredient') return false;
  return Boolean(raw.id ?? raw._id);
}

/* ------------------------------------------------------------------ */
/* Print job builders                                                  */
/* ------------------------------------------------------------------ */

function buildKotJob(order, kotNo, items, { reprint = false, time } = {}) {
  return {
    type: 'kot',
    props: {
      tableName: order.tableName,
      orderNo: order.orderNo,
      kotNo,
      time: time || formatClock(),
      waiter: order.waiterName,
      channel: order.channel,
      guests: order.guests,
      reprint,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        note: item.note,
        extras: item.extras,
      })),
    },
  };
}

function buildKotJobsFromItems(order, items, result, options = {}) {
  const fallbackKot = result?.kotNo ?? result?.kot?.kotNo ?? '';
  const groups = new Map();
  items.forEach((item) => {
    const key = String(item.kotNo ?? fallbackKot);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return [...groups.entries()].map(([kotNo, list]) =>
    buildKotJob(order, kotNo, list, { ...options, time: formatClock(list[0]?.sentAt || result?.kot?.sentAt) }),
  );
}

function localBill(items) {
  const subTotal = items
    .filter((item) => item.status !== ITEM_STATUS.VOID)
    .reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
  return normalizeBill({ subTotal, grandTotal: subTotal });
}

function settleClosedOrder(result, splitMode) {
  if (typeof result?.closed === 'boolean') return result.closed;
  const status = String(result?.order?.status ?? result?.status ?? '').toLowerCase();
  if (isClosedStatus(status)) return true;
  if (status === 'open' || status === 'partial' || status === 'partially_paid') return false;
  return splitMode !== 'items';
}

/* ------------------------------------------------------------------ */

export default function RestaurantOrder() {
  const tr = useTr();
  const navigate = useNavigate();
  const { orderId } = useParams();
  const { businessId, canManageFeature } = useAuth();
  const { settings, businessProfile } = useBusinessSettings();
  const { showError, showSuccess } = useSnackbar();
  const { enqueuePrint, printHost } = useThermalPrintQueue();

  const canManage = canManageFeature('orders');
  const canSettleOrder = canManage || canManageFeature('billing');
  const autoPrintKot = (settings?.uiPreferences?.autoPrintKot
    ?? businessProfile?.settings?.uiPreferences?.autoPrintKot) === true;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const orderRef = useRef(null);
  orderRef.current = order;

  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [mobileView, setMobileView] = useState('menu');
  const [now, setNow] = useState(() => Date.now());

  const [optionsProduct, setOptionsProduct] = useState(null);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [voidItem, setVoidItem] = useState(null);
  const [dialog, setDialog] = useState(''); // move | merge | discount | cancel | settle
  const [busy, setBusy] = useState('');

  /* ---- data ---------------------------------------------------------- */
  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!orderId || !businessId) {
      setLoading(false);
      return null;
    }
    try {
      const payload = await api.getRestaurantOrder(orderId, { force: true });
      const next = normalizeOrder(payload);
      setOrder(next);
      setLoadError('');
      return next;
    } catch (error) {
      if (!silent || !orderRef.current) setLoadError(pickBackendMessage(error, 'Unable to load this order.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, orderId]);

  useEffect(() => {
    setLoading(true);
    setOrder(null);
    loadOrder();
  }, [loadOrder]);

  useLiveScreenRefresh({
    enabled: Boolean(orderId && businessId),
    eventNames: LIVE_EVENTS,
    refetch: () => loadOrder({ silent: true }),
  });

  useEffect(() => {
    if (!businessId) return undefined;
    let active = true;
    api
      .listProducts({ limit: 1000 })
      .then((response) => {
        if (!active) return;
        setProducts(
          (response?.items || []).filter(isMenuProduct).map(normalizeMenuProduct).filter((product) => product.id),
        );
        setProductsError('');
      })
      .catch((error) => {
        if (active) setProductsError(pickBackendMessage(error, 'Unable to load the menu.'));
      });
    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  /* ---- derived ------------------------------------------------------- */
  const closed = order ? isClosedStatus(order.status) : false;
  const canEdit = canManage && !closed;
  const grouped = useMemo(() => groupItemsByKot(order?.items || []), [order?.items]);
  const bill = useMemo(
    () => (order?.hasBill ? order.bill : localBill(order?.items || [])),
    [order],
  );
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products],
  );
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== 'all' && product.category !== category) return false;
      return !query || product.name.toLowerCase().includes(query);
    });
  }, [category, products, search]);

  const title = order
    ? order.tableName
      || (isTakeawayChannel(order.channel)
        ? tr(`restaurant.channel.${order.channel}`, order.channel === 'delivery' ? 'Delivery' : 'Takeaway')
        : tr('restaurant.order.order', 'Order'))
    : tr('restaurant.order.order', 'Order');

  /* ---- actions ------------------------------------------------------- */
  const runAction = async (key, action) => {
    setBusy(key);
    try {
      return await action();
    } catch (error) {
      showError(pickBackendMessage(error));
      return undefined;
    } finally {
      setBusy('');
    }
  };

  const addItem = async (product, { quantity = 1, note = '', extras = [] } = {}) => {
    if (!canEdit) return false;
    const item = { productId: product.id, quantity };
    if (note) item.note = note;
    if (extras.length > 0) item.extras = extras;
    try {
      await api.addRestaurantOrderItems(orderId, { items: [item] });
      await loadOrder({ silent: true });
      return true;
    } catch (error) {
      showError(pickBackendMessage(error));
      return false;
    }
  };

  const submitOptions = async (options) => {
    if (!optionsProduct) return;
    setOptionsBusy(true);
    const ok = await addItem(optionsProduct, options);
    setOptionsBusy(false);
    if (ok) setOptionsProduct(null);
  };

  const changeQuantity = (item, delta) => {
    const next = item.quantity + delta;
    runAction(`qty:${item.id}`, async () => {
      if (next <= 0) await api.deleteRestaurantOrderItem(orderId, item.id);
      else await api.updateRestaurantOrderItem(orderId, item.id, { quantity: next });
      await loadOrder({ silent: true });
    });
  };

  const removePending = (item) => {
    runAction(`rm:${item.id}`, async () => {
      await api.deleteRestaurantOrderItem(orderId, item.id);
      await loadOrder({ silent: true });
    });
  };

  const sendKot = () => {
    if (grouped.pending.length === 0) return;
    const pendingIds = new Set(grouped.pending.map((item) => item.id));
    runAction('kot', async () => {
      const result = await api.sendRestaurantKot(orderId);
      const fresh = await loadOrder({ silent: true });
      showSuccess(tr('restaurant.order.kotSent', 'Sent to kitchen'));
      const sentItems = (fresh?.items || []).filter((item) => pendingIds.has(item.id));
      if (autoPrintKot && fresh && sentItems.length > 0) {
        enqueuePrint(buildKotJobsFromItems(fresh, sentItems, result));
      }
    });
  };

  const reprintKot = (group) => {
    if (!order) return;
    enqueuePrint(buildKotJob(order, group.kotNo, group.items, { reprint: true, time: formatClock(group.sentAt) }));
  };

  const reprintAllKots = () => {
    if (!order || grouped.kots.length === 0) return;
    const ordered = [...grouped.kots].sort((a, b) => toNumber(a.kotNo) - toNumber(b.kotNo));
    enqueuePrint(ordered.map((group) => (
      buildKotJob(order, group.kotNo, group.items, { reprint: true, time: formatClock(group.sentAt) })
    )));
  };

  const printCheck = () => {
    if (!order) return;
    runAction('check', async () => {
      const response = await api.previewRestaurantBill(orderId, {});
      const checkBill = normalizeBill(extractBill(response));
      const lines = order.items.filter((item) => item.status !== ITEM_STATUS.VOID);
      enqueuePrint({
        type: 'check',
        props: {
          biz: settings || {},
          tableName: order.tableName,
          orderNo: order.orderNo,
          date: formatDateTime(),
          waiter: order.waiterName,
          guests: order.guests,
          items: lines.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            extras: item.extras,
          })),
          bill: checkBill,
        },
      });
    });
  };

  const confirmVoid = async ({ reason, reasonCode, note, wasPrepared }) => {
    const item = voidItem;
    await api.voidRestaurantOrderItem(orderId, item.id, {
      reason,
      reasonCode,
      wasPrepared,
      ...(note ? { note } : {}),
    });
    setVoidItem(null);
    showSuccess(tr('restaurant.void.done', 'Item voided'));
    await loadOrder({ silent: true });
  };

  const afterAction = (message) => async () => {
    setDialog('');
    if (message) showSuccess(message);
    await loadOrder({ silent: true });
  };

  const afterCancel = async () => {
    setDialog('');
    showSuccess(tr('restaurant.order.cancelled', 'Order cancelled'));
    navigate('/app/orders');
  };

  const handleSettled = async (result, { splitMode }) => {
    setDialog('');
    if (!settleClosedOrder(result, splitMode)) {
      showSuccess(tr('restaurant.settle.partialDone', 'Selected items settled. The order is still open.'));
      await loadOrder({ silent: true });
      return;
    }
    showSuccess(tr('restaurant.settle.done', 'Order settled'));
    // Settle returns `{ ...order, sales: [sale, ...], stockWarnings }`. Invoice.jsx only
    // treats type "sales" as a sale (anything else loads a purchase), so the route is
    // /app/invoice/sales/:id even though the response key is `sales`.
    const firstSale = Array.isArray(result?.sales) ? result.sales[0] : null;
    const saleId = (firstSale && typeof firstSale === 'object' ? firstSale.id : firstSale)
      ?? result?.saleId ?? result?.sale?.id ?? null;
    if (saleId) navigate(`/app/invoice/sales/${saleId}?thermal=1`);
    else navigate('/app/orders');
  };

  /* ---- render helpers ------------------------------------------------ */
  const renderExtrasAndNote = (item) => (
    <>
      {item.extras.map((extra, index) => (
        <span key={index} className="block text-xs text-secondary-600">+ {extra.name}</span>
      ))}
      {item.note ? <span className="block text-xs font-medium italic text-amber-700">** {item.note}</span> : null}
    </>
  );

  const actionButton = 'btn-secondary min-h-10 px-3 text-xs disabled:opacity-50';

  if (loading && !order) {
    return <p className="text-sm text-secondary-500">{tr('common.loading', 'Loading...')}</p>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Notice tone="error" title={loadError || tr('restaurant.order.notFound', 'Order not found.')} />
        <button type="button" className="btn-secondary" onClick={() => navigate('/app/orders')}>
          <ArrowLeft size={16} />
          {tr('restaurant.order.backToFloor', 'Back to floor')}
        </button>
      </div>
    );
  }

  const openedMinutes = minutesSince(order.openedAt, now);
  const hasPending = grouped.pending.length > 0;
  const hasSettleableItems = grouped.pending.length + grouped.kots.length > 0;

  const menuPanel = (
    <section className={`${mobileView === 'menu' ? 'block' : 'hidden'} min-w-0 space-y-3 lg:block`}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400" />
        <input
          className="input pl-9"
          value={search}
          placeholder={tr('restaurant.order.searchMenu', 'Search menu')}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', ...categories].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCategory(name)}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
              category === name
                ? 'border-primary bg-primary text-white'
                : 'border-secondary-200 bg-white text-ink-light hover:border-primary/40'
            }`}
          >
            {name === 'all' ? tr('common.all', 'All') : name}
          </button>
        ))}
      </div>

      {productsError ? <Notice tone="error" title={productsError} /> : null}
      {!productsError && visibleProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-secondary-500">
          {tr('restaurant.order.noMenu', 'No menu items found.')}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {visibleProducts.map((product) => (
          <ProductTile
            key={product.id}
            product={product}
            disabled={!canEdit}
            optionsLabel={tr('restaurant.order.itemOptions', 'Item options')}
            onQuickAdd={(selected) => addItem(selected)}
            onOptions={setOptionsProduct}
          />
        ))}
      </div>
    </section>
  );

  const orderPanel = (
    <section className={`${mobileView === 'order' ? 'block' : 'hidden'} min-w-0 lg:block`}>
      <div className="card flex flex-col gap-4 p-4 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-8rem)] lg:overflow-hidden">
        {closed ? (
          <Notice
            tone="warn"
            title={tr('restaurant.order.closed', 'This order is {status}.', { status: order.status })}
          />
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {order.channel === 'dine_in' || order.tableId ? (
              <button type="button" className={actionButton} onClick={() => setDialog('move')}>
                <ArrowRightLeft size={14} />
                {tr('restaurant.order.moveShort', 'Move')}
              </button>
            ) : null}
            <button type="button" className={actionButton} onClick={() => setDialog('merge')}>
              <GitMerge size={14} />
              {tr('restaurant.order.mergeShort', 'Merge')}
            </button>
            <button type="button" className={actionButton} onClick={() => setDialog('discount')}>
              <Percent size={14} />
              {tr('restaurant.order.discount', 'Discount')}
            </button>
            <button
              type="button"
              className={actionButton}
              onClick={reprintAllKots}
              disabled={grouped.kots.length === 0}
            >
              <Printer size={14} />
              {tr('restaurant.order.reprintKots', 'Reprint KOTs')}
            </button>
            <button
              type="button"
              className="min-h-10 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              onClick={() => setDialog('cancel')}
            >
              <Ban size={14} className="mr-1 inline" />
              {tr('restaurant.order.cancelShort', 'Cancel')}
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Pending (unsent) group */}
          {hasPending ? (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  {tr('restaurant.order.newItems', 'New items')} ({grouped.pending.length})
                </h3>
                <StatusChip status={ITEM_STATUS.PENDING} />
              </div>
              <ul className="divide-y divide-primary/10">
                {grouped.pending.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 py-2">
                    <div className="flex shrink-0 items-center gap-1">
                      {canEdit ? (
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-secondary-200 bg-white"
                          disabled={busy === `qty:${item.id}`}
                          onClick={() => changeQuantity(item, -1)}
                          aria-label="-"
                        >
                          <Minus size={14} />
                        </button>
                      ) : null}
                      <span className="min-w-6 text-center text-sm font-bold">{item.quantity}</span>
                      {canEdit ? (
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-secondary-200 bg-white"
                          disabled={busy === `qty:${item.id}`}
                          onClick={() => changeQuantity(item, 1)}
                          aria-label="+"
                        >
                          <Plus size={14} />
                        </button>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-ink">{item.name}</span>
                      {renderExtrasAndNote(item)}
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatMoney(item.lineTotal)}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="rounded-xl p-2 text-rose-600 hover:bg-rose-50"
                        disabled={busy === `rm:${item.id}`}
                        onClick={() => removePending(item)}
                        aria-label={tr('common.delete', 'Delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              {canEdit ? (
                <button
                  type="button"
                  className="btn-primary mt-3 min-h-14 w-full justify-center text-base disabled:opacity-60"
                  disabled={busy === 'kot'}
                  onClick={sendKot}
                >
                  <ChefHat size={20} />
                  {busy === 'kot'
                    ? tr('common.loading', 'Loading...')
                    : tr('restaurant.order.sendKot', 'Send to kitchen')}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Sent KOT groups */}
          {grouped.kots.map((group) => (
            <div key={group.kotNo} className="rounded-2xl border border-secondary-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">
                  KOT #{group.kotNo}
                  {group.sentAt ? (
                    <span className="ml-2 text-xs font-normal text-secondary-500">{formatClock(group.sentAt)}</span>
                  ) : null}
                </h3>
                <button
                  type="button"
                  className="rounded-xl p-2 text-secondary-600 hover:bg-secondary-100"
                  onClick={() => reprintKot(group)}
                  aria-label={tr('restaurant.order.reprintKot', 'Reprint KOT')}
                  title={tr('restaurant.order.reprintKot', 'Reprint KOT')}
                >
                  <Printer size={16} />
                </button>
              </div>
              <ul className="divide-y divide-secondary-100">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 py-2">
                    <span className="min-w-6 text-sm font-bold">{item.quantity}&times;</span>
                    <div className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-ink">{item.name}</span>
                      {renderExtrasAndNote(item)}
                      <StatusChip status={item.status} className="mt-1" />
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatMoney(item.lineTotal)}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        className="rounded-xl p-2 text-rose-600 hover:bg-rose-50"
                        onClick={() => setVoidItem(item)}
                        aria-label={tr('restaurant.void.title', 'Void item')}
                        title={tr('restaurant.void.title', 'Void item')}
                      >
                        <Ban size={16} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {!hasPending && grouped.kots.length === 0 ? (
            <p className="py-8 text-center text-sm text-secondary-500">
              {tr('restaurant.order.empty', 'No items yet. Tap a menu item to add it.')}
            </p>
          ) : null}

          {grouped.voided.length > 0 ? (
            <details className="rounded-2xl border border-secondary-200 p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-secondary-600">
                {tr('restaurant.order.voided', 'Voided items')} ({grouped.voided.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {grouped.voided.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 text-secondary-500 line-through">
                    <span>{item.quantity}&times; {item.name}</span>
                    {item.voidReason ? <span className="no-underline">{String(item.voidReason)}</span> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        {/* Running bill */}
        <div className="space-y-1 border-t border-secondary-200 pt-3 text-sm">
          <div className="flex justify-between text-secondary-700">
            <span>{tr('restaurant.bill.subtotal', 'Subtotal')}</span>
            <span>{formatMoney(bill.subTotal)}</span>
          </div>
          {bill.discountTotal > 0 ? (
            <div className="flex justify-between text-secondary-700">
              <span>{tr('restaurant.bill.discount', 'Discount')}</span>
              <span>-{formatMoney(bill.discountTotal)}</span>
            </div>
          ) : null}
          {bill.serviceCharge > 0 ? (
            <div className="flex justify-between text-secondary-700">
              <span>{tr('restaurant.bill.service', 'Service charge')}</span>
              <span>{formatMoney(bill.serviceCharge)}</span>
            </div>
          ) : null}
          {bill.packagingCharge > 0 ? (
            <div className="flex justify-between text-secondary-700">
              <span>{tr('restaurant.bill.packaging', 'Packaging')}</span>
              <span>{formatMoney(bill.packagingCharge)}</span>
            </div>
          ) : null}
          {bill.taxTotal > 0 ? (
            <div className="flex justify-between text-secondary-700">
              <span>{tr('restaurant.bill.tax', 'Tax')}</span>
              <span>{formatMoney(bill.taxTotal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-lg font-bold text-ink">
            <span>{tr('restaurant.bill.total', 'Total')}</span>
            <span>{formatMoney(bill.grandTotal)}</span>
          </div>
        </div>

        {!closed ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary min-h-12 justify-center disabled:opacity-60"
              disabled={!hasSettleableItems || busy === 'check'}
              onClick={printCheck}
            >
              <Receipt size={16} />
              {tr('restaurant.order.check', 'Check')}
            </button>
            <button
              type="button"
              className="btn-primary min-h-12 justify-center disabled:opacity-60"
              disabled={!canSettleOrder || !hasSettleableItems}
              onClick={() => setDialog('settle')}
            >
              {tr('restaurant.order.settle', 'Settle')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary h-11 w-11 justify-center p-0"
          onClick={() => navigate('/app/orders')}
          aria-label={tr('restaurant.order.backToFloor', 'Back to floor')}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="page-title truncate">
            {title} <span className="text-secondary-500">#{order.orderNo || order.id.slice(-4)}</span>
          </h2>
          <p className="page-subtitle flex flex-wrap items-center gap-x-3 gap-y-1">
            {order.guests ? (
              <span className="inline-flex items-center gap-1"><Users size={13} />{order.guests}</span>
            ) : null}
            {order.waiterName ? <span>{order.waiterName}</span> : null}
            {openedMinutes !== null ? (
              <span>{tr('restaurant.floor.minutes', '{n} min', { n: openedMinutes })}</span>
            ) : null}
          </p>
        </div>
      </div>

      {loadError ? <Notice tone="error" title={loadError} /> : null}

      <div className="flex gap-2 lg:hidden">
        {['menu', 'order'].map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setMobileView(view)}
            className={`min-h-11 flex-1 rounded-2xl border px-3 text-sm font-semibold transition ${
              mobileView === view
                ? 'border-primary bg-primary text-white'
                : 'border-secondary-200 bg-white text-ink-light'
            }`}
          >
            {view === 'menu'
              ? tr('restaurant.order.menu', 'Menu')
              : `${tr('restaurant.order.items', 'Order')} · ${formatMoney(bill.grandTotal)}`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        {menuPanel}
        {orderPanel}
      </div>

      <ItemOptionsDialog
        isOpen={Boolean(optionsProduct)}
        product={optionsProduct}
        submitting={optionsBusy}
        onClose={() => setOptionsProduct(null)}
        onSubmit={submitOptions}
      />

      <VoidItemDialog
        isOpen={Boolean(voidItem)}
        item={voidItem}
        onClose={() => setVoidItem(null)}
        onConfirm={confirmVoid}
      />

      <MoveOrderDialog
        isOpen={dialog === 'move'}
        order={order}
        onClose={() => setDialog('')}
        onDone={afterAction(tr('restaurant.order.moved', 'Order moved'))}
      />
      <MergeOrderDialog
        isOpen={dialog === 'merge'}
        order={order}
        onClose={() => setDialog('')}
        onDone={afterAction(tr('restaurant.order.merged', 'Orders merged'))}
      />
      <DiscountDialog
        isOpen={dialog === 'discount'}
        order={order}
        onClose={() => setDialog('')}
        onDone={afterAction(tr('restaurant.order.discountSaved', 'Discount saved'))}
      />
      <CancelOrderDialog
        isOpen={dialog === 'cancel'}
        order={order}
        onClose={() => setDialog('')}
        onDone={afterCancel}
      />
      <SettleDialog
        isOpen={dialog === 'settle'}
        order={order}
        onClose={() => setDialog('')}
        onSettled={handleSettled}
      />

      {printHost}
    </div>
  );
}
