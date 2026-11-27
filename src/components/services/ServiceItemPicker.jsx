import { useEffect, useMemo, useRef, useState } from "react";
import { Package, Plus, Search, Wrench, X } from "lucide-react";
import { api } from "@/lib/api";
import { normalizeLookupProduct } from "@/lib/lookups.js";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toAvailableUnitQuantity } from "@/lib/inventory/stockAvailability.js";

const PAGE_SIZE = 24;
const ALL = "__all__";

function getCategoryName(raw = {}) {
  if (raw?.category && typeof raw.category === "object") {
    return String(raw.category.name || "").trim();
  }
  return String(raw?.categoryName || raw?.category || "").trim();
}

// The lookup normaliser drops tax and category, which the picker needs.
export function toPickerProduct(raw = {}) {
  return {
    ...normalizeLookupProduct(raw),
    taxRate: Number(raw?.taxRate ?? raw?.Product?.taxRate ?? 0) || 0,
    categoryName: getCategoryName(raw),
  };
}

function TabButton({ active, icon: Icon, label, count, onClick, id, controls }) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={controls}
      onClick={onClick}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
        active
          ? "bg-white text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100"
          : "text-secondary-500 hover:text-ink dark:text-secondary-400 dark:hover:text-slate-200"
      }`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
      {count > 0 ? (
        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary-700 dark:bg-primary-900/50 dark:text-primary-200">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ProductTile({ product, qtyInBill, disabled, onAdd, money, t }) {
  const available = toAvailableUnitQuantity(product, "primary", product);
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available <= 5;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={disabled}
      aria-label={t("services.addProductAria", { name: product.name })}
      className={`group relative flex min-h-[132px] flex-col rounded-2xl border p-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 motion-safe:active:scale-[0.97] ${
        qtyInBill > 0
          ? "border-primary-300 bg-primary-50/70 dark:border-primary-700/60 dark:bg-primary-900/20"
          : "border-secondary-200 bg-white hover:border-primary-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-600"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {qtyInBill > 0 ? (
        <span className="absolute right-2 top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary-600 px-1.5 text-xs font-bold tabular-nums text-white">
          {Number(qtyInBill)}
        </span>
      ) : null}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          className="h-10 w-10 rounded-xl border border-secondary-200 object-cover dark:border-slate-700"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        >
          {product.name?.charAt(0).toUpperCase() || "P"}
        </span>
      )}
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink dark:text-slate-100">
        {product.name}
      </p>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <span className="text-sm font-bold tabular-nums text-ink dark:text-slate-100">
          {money(product.salePrice)}
        </span>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            outOfStock
              ? "text-rose-600 dark:text-rose-300"
              : lowStock
                ? "text-amber-600 dark:text-amber-300"
                : "text-secondary-400"
          }`}
        >
          {outOfStock
            ? t("services.outOfStock")
            : t("services.inStock", {
                count: Number(available.toFixed(2)),
              })}
        </span>
      </div>
    </button>
  );
}

export default function ServiceItemPicker({
  t,
  money,
  items,
  skipStockCheck,
  onAddProduct,
  onAddService,
}) {
  const [tab, setTab] = useState("products");

  // ── Products ──
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [category, setCategory] = useState(ALL);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    api
      .listCategories({ type: "product", limit: 50, offset: 0 })
      .then((response) => {
        if (!active) return;
        const names = (response?.items || [])
          .map((entry) => String(entry?.name || "").trim())
          .filter(Boolean);
        setCategories([...new Set(names)].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => active && setCategories([]));
    return () => {
      active = false;
    };
  }, []);

  const loadProducts = async (offset = 0) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.listProducts({
        limit: PAGE_SIZE,
        offset,
        sort: "name",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(category !== ALL ? { category } : {}),
      });
      if (requestId !== requestIdRef.current) return;
      const next = (response?.items || [])
        .map(toPickerProduct)
        .filter((product) => product.id);
      setProducts((prev) => (offset === 0 ? next : [...prev, ...next]));
      const total = Number(response?.total);
      setHasMore(
        Number.isFinite(total)
          ? offset + next.length < total
          : next.length === PAGE_SIZE,
      );
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(err?.message || t("services.productsLoadFailed"));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category]);

  const qtyByProduct = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      if (item.itemType !== "part" || !item.productId) return;
      const key = String(item.productId);
      map[key] = (map[key] || 0) + Number(item.quantity || 0);
    });
    return map;
  }, [items]);

  const serviceCount = items.filter((item) => item.itemType === "labor").length;
  const productCount = items.filter((item) => item.itemType === "part").length;

  // ── Services ──
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const serviceNameRef = useRef(null);
  const servicePriceRef = useRef(null);
  const canAddService =
    Boolean(serviceName.trim()) || Number(servicePrice || 0) > 0;

  const recentServices = useMemo(() => {
    const seen = new Set();
    return items
      .filter((item) => item.itemType === "labor")
      .map((item) => String(item.description || "").trim())
      .filter((name) => name && !seen.has(name) && seen.add(name));
  }, [items]);

  const submitService = () => {
    if (!canAddService) {
      serviceNameRef.current?.focus();
      return;
    }
    onAddService({
      description: serviceName.trim(),
      unitPrice: servicePrice === "" ? "0" : servicePrice,
    });
    setServiceName("");
    setServicePrice("");
    serviceNameRef.current?.focus();
  };

  useEffect(() => {
    if (tab === "services") {
      const frame = window.requestAnimationFrame(() =>
        serviceNameRef.current?.focus(),
      );
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [tab]);

  const chipClass = (active) =>
    `shrink-0 min-h-[36px] rounded-full border px-3.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
      active
        ? "border-primary-600 bg-primary-600 text-white"
        : "border-secondary-200 bg-white text-secondary-700 hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900 dark:text-secondary-300"
    }`;

  return (
    <div className="flex min-w-0 flex-col">
      <div
        role="tablist"
        aria-label={t("services.pickerTitle")}
        className="flex gap-1 rounded-2xl bg-secondary-100 p-1 dark:bg-slate-900"
      >
        <TabButton
          id="service-picker-tab-products"
          controls="service-picker-panel-products"
          active={tab === "products"}
          icon={Package}
          label={t("services.tabProducts")}
          count={productCount}
          onClick={() => setTab("products")}
        />
        <TabButton
          id="service-picker-tab-services"
          controls="service-picker-panel-services"
          active={tab === "services"}
          icon={Wrench}
          label={t("services.tabServices")}
          count={serviceCount}
          onClick={() => setTab("services")}
        />
      </div>

      {tab === "products" ? (
        <div
          role="tabpanel"
          id="service-picker-panel-products"
          aria-labelledby="service-picker-tab-products"
          className="mt-4 space-y-3"
        >
          <div className="flex min-h-[44px] items-center gap-2 rounded-xl border border-secondary-200 bg-white px-3 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:ring-primary-900/40">
            <Search size={16} className="shrink-0 text-secondary-400" aria-hidden="true" />
            <input
              type="search"
              className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-base outline-none placeholder:text-secondary-400 focus:ring-0 dark:text-slate-100 sm:text-sm"
              placeholder={t("services.searchProducts")}
              aria-label={t("services.searchProducts")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label={t("common.clear")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-100 hover:text-ink dark:hover:bg-slate-800"
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
              aria-label={t("services.categories")}
            >
              <button
                type="button"
                className={chipClass(category === ALL)}
                aria-pressed={category === ALL}
                onClick={() => setCategory(ALL)}
              >
                {t("services.allCategories")}
              </button>
              {categories.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={chipClass(category === name)}
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
              {loadError}
              <button
                type="button"
                className="ml-2 font-semibold underline"
                onClick={() => loadProducts(0)}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const available = toAvailableUnitQuantity(
                  product,
                  "primary",
                  product,
                );
                const inBill = qtyByProduct[String(product.id)] || 0;
                return (
                  <ProductTile
                    key={product.id}
                    product={product}
                    qtyInBill={inBill}
                    disabled={!skipStockCheck && available <= inBill}
                    onAdd={onAddProduct}
                    money={money}
                    t={t}
                  />
                );
              })}
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-[132px] rounded-2xl bg-secondary-100 motion-safe:animate-pulse dark:bg-slate-800/70"
                />
              ))}
            </div>
          ) : !loadError ? (
            <div className="rounded-2xl border border-dashed border-secondary-300 px-4 py-10 text-center dark:border-slate-700">
              <Package size={22} className="mx-auto text-secondary-300" aria-hidden="true" />
              <p className="mt-2 text-sm text-secondary-500">
                {t("services.noProductsFound")}
              </p>
            </div>
          ) : null}

          {hasMore && products.length > 0 ? (
            <button
              type="button"
              className="btn-ghost min-h-[44px] w-full"
              onClick={() => loadProducts(products.length)}
              disabled={loading}
            >
              {loading ? t("common.loading") : t("services.loadMore")}
            </button>
          ) : null}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="service-picker-panel-services"
          aria-labelledby="service-picker-tab-services"
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <label className="label" htmlFor="service-picker-name">
                {t("services.serviceName")}
              </label>
              <input
                id="service-picker-name"
                ref={serviceNameRef}
                className="input mt-1 min-h-[44px] text-base sm:text-sm"
                placeholder={t("services.placeholderService")}
                value={serviceName}
                autoComplete="off"
                onChange={(event) => setServiceName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    servicePriceRef.current?.focus();
                    servicePriceRef.current?.select();
                  }
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="service-picker-price">
                {t("services.unitPrice")}
              </label>
              <input
                id="service-picker-price"
                ref={servicePriceRef}
                className="input mt-1 min-h-[44px] text-base tabular-nums sm:text-sm"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={servicePrice}
                onChange={(event) => setServicePrice(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitService();
                  }
                }}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-primary min-h-[44px] w-full"
            onClick={submitService}
            disabled={!canAddService}
          >
            <Plus size={16} className="mr-1.5 inline" aria-hidden="true" />
            {t("services.addService")}
          </button>
          <p className="text-xs text-secondary-500">{t("services.serviceAddHint")}</p>

          {recentServices.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-secondary-400">
                {t("services.reuseService")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recentServices.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={chipClass(false)}
                    onClick={() => {
                      setServiceName(name);
                      servicePriceRef.current?.focus();
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
