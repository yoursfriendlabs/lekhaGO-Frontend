import { useState } from "react";
import {
  ChevronDown,
  Minus,
  Package,
  Plus,
  ReceiptText,
  Trash2,
  Wrench,
} from "lucide-react";
import { getVatAmount } from "@/pages/services/serviceOrderUtils.js";

function NumberField({ id, label, value, onChange, step = "0.01", suffix }) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-400"
      >
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          className="input min-h-[44px] w-full text-base tabular-nums sm:text-sm"
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-secondary-400">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BillLine({
  item,
  t,
  money,
  product,
  unitLabel,
  highlighted,
  onUpdate,
  onRemove,
}) {
  const isService = item.itemType === "labor";
  const taxRate = Number(item.taxRate || 0);
  const discount = Number(item.discount || 0);
  const hasExtras = taxRate > 0 || discount > 0;
  const [open, setOpen] = useState(hasExtras);
  const quantity = Number(item.quantity || 0);
  const vat = getVatAmount(item.lineTotal, item.taxRate);
  const name = isService
    ? item.description
    : product?.name || item.description || t("services.productLine");
  const idBase = `bill-line-${item._key}`;

  return (
    <li
      className={`rounded-2xl border bg-white p-3 transition-shadow duration-300 dark:bg-slate-900/60 ${
        highlighted
          ? "border-primary-400 shadow-[0_0_0_3px] shadow-primary-200/80 dark:border-primary-500 dark:shadow-primary-900/60"
          : "border-secondary-200/80 dark:border-slate-800"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            isService
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {isService ? <Wrench size={16} /> : <Package size={16} />}
        </span>

        <div className="min-w-0 flex-1">
          {isService ? (
            <input
              aria-label={t("services.serviceName")}
              className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 -ml-1.5 text-sm font-semibold text-ink outline-none hover:border-secondary-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:ring-primary-900/40"
              placeholder={t("services.serviceName")}
              value={item.description}
              onChange={(event) =>
                onUpdate(item._key, { description: event.target.value })
              }
            />
          ) : (
            <p className="truncate py-1 text-sm font-semibold text-ink dark:text-slate-100">
              {name}
            </p>
          )}
          <p className="text-xs text-secondary-500">
            {isService ? t("services.serviceLine") : t("services.productLine")}
            {!isService && unitLabel ? ` · ${unitLabel}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-ink dark:text-slate-100">
            {money(Number(item.lineTotal || 0) + vat)}
          </p>
          {vat > 0 ? (
            <p className="text-[11px] tabular-nums text-secondary-400">
              {t("services.inclVat", { amount: money(vat) })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        {!isService ? (
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-400">
              {t("services.qty")}
            </span>
            <div className="mt-1 flex h-11 items-center rounded-xl border border-secondary-200 dark:border-slate-700">
              <button
                type="button"
                aria-label={t("services.decreaseQty")}
                disabled={quantity <= 1}
                onClick={() =>
                  onUpdate(item._key, { quantity: String(Math.max(quantity - 1, 1)) })
                }
                className="flex h-11 w-11 items-center justify-center rounded-l-xl text-secondary-600 hover:bg-secondary-100 disabled:opacity-40 dark:text-secondary-300 dark:hover:bg-slate-800"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <input
                aria-label={t("services.qty")}
                className="h-full w-14 border-0 bg-transparent text-center text-base font-semibold tabular-nums outline-none focus:ring-0 dark:border-slate-700 dark:text-slate-100 sm:text-sm"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={item.quantity}
                onChange={(event) =>
                  onUpdate(item._key, { quantity: event.target.value })
                }
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                aria-label={t("services.increaseQty")}
                onClick={() =>
                  onUpdate(item._key, { quantity: String(quantity + 1) })
                }
                className="flex h-11 w-11 items-center justify-center rounded-r-xl text-secondary-600 hover:bg-secondary-100 dark:text-secondary-300 dark:hover:bg-slate-800"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        <div className="w-32 min-w-0 flex-1 sm:flex-none">
          <NumberField
            id={`${idBase}-price`}
            label={isService ? t("services.price") : t("services.unitPriceShort")}
            value={item.unitPrice}
            onChange={(value) => onUpdate(item._key, { unitPrice: value })}
          />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={`${idBase}-extras`}
            className={`flex min-h-[44px] items-center gap-1 rounded-xl px-3 text-xs font-semibold transition-colors ${
              hasExtras
                ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200"
                : "text-secondary-500 hover:bg-secondary-100 dark:hover:bg-slate-800"
            }`}
          >
            {t("services.taxAndDiscount")}
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item._key)}
            aria-label={t("services.removeItemAria", { name: name || "" })}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/20"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open ? (
        <div
          id={`${idBase}-extras`}
          className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-mist/80 p-2.5 dark:bg-slate-950/50"
        >
          <NumberField
            id={`${idBase}-tax`}
            label={t("services.tax")}
            value={item.taxRate}
            step="1"
            suffix="%"
            onChange={(value) => onUpdate(item._key, { taxRate: value })}
          />
          <NumberField
            id={`${idBase}-discount`}
            label={t("services.lineDiscount")}
            value={item.discount ?? "0"}
            onChange={(value) => onUpdate(item._key, { discount: value })}
          />
          {!isService && product?.secondaryUnit ? (
            <div className="col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary-400">
                {t("products.unitType")}
              </span>
              <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-secondary-100 p-1 dark:bg-slate-900">
                {[
                  ["primary", product.primaryUnit || t("products.primaryUnit")],
                  ["secondary", product.secondaryUnit],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={(item.unitType || "primary") === value}
                    onClick={() =>
                      onUpdate(item._key, { unitType: value, actualUnit: label })
                    }
                    className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                      (item.unitType || "primary") === value
                        ? "bg-white text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100"
                        : "text-secondary-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function ServiceBillLines({
  t,
  money,
  items,
  totals,
  getProductById,
  getUnitLabel,
  highlightKey,
  onUpdateLine,
  onRemoveLine,
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-ink dark:text-slate-100">
          {t("services.billItems")}
        </h4>
        <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-secondary-600 dark:bg-slate-800 dark:text-secondary-300">
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {items.map((item) => {
            const product = getProductById(item.productId);
            return (
              <BillLine
                key={item._key}
                item={item}
                t={t}
                money={money}
                product={product}
                unitLabel={
                  item.itemType === "part" ? getUnitLabel(product, item.unitType) : ""
                }
                highlighted={highlightKey === item._key}
                onUpdate={onUpdateLine}
                onRemove={onRemoveLine}
              />
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-secondary-300 px-4 py-10 text-center dark:border-slate-700">
          <ReceiptText size={22} className="mx-auto text-secondary-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-secondary-500">{t("services.billEmpty")}</p>
        </div>
      )}

      {items.length > 0 ? (
        <dl className="mt-3 space-y-1.5 rounded-2xl bg-mist/80 px-4 py-3 text-sm dark:bg-slate-950/50">
          <div className="flex justify-between text-secondary-500">
            <dt>{t("services.subTotal")}</dt>
            <dd className="tabular-nums">{money(totals.subTotal)}</dd>
          </div>
          {totals.taxTotal > 0 ? (
            <div className="flex justify-between text-secondary-500">
              <dt>{t("services.taxTotal")}</dt>
              <dd className="tabular-nums">{money(totals.taxTotal)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-secondary-200/70 pt-1.5 font-semibold text-ink dark:border-slate-800 dark:text-slate-100">
            <dt>{t("common.total")}</dt>
            <dd className="tabular-nums">{money(totals.subTotal + totals.taxTotal)}</dd>
          </div>
          <p className="pt-1 text-xs text-secondary-400">{t("services.orderDiscountHint")}</p>
        </dl>
      ) : null}
    </div>
  );
}
