/**
 * The tax % a bill should print beside its tax total. A rate set on the bill
 * itself (the cafe billing counter) wins; otherwise every taxed line has to
 * share one rate, because a single % beside mixed rates would be wrong.
 */
export function getBillTaxRate(record, items) {
  const billRate = Number(record?.taxRate || 0);
  if (billRate > 0) return billRate;

  const lines = items || record?.SaleItems || record?.PurchaseItems || record?.items || [];
  const rates = new Set(
    lines
      .map((item) => Number(item?.taxRate || 0))
      .filter((rate) => rate > 0),
  );
  return rates.size === 1 ? [...rates][0] : 0;
}

/** "Tax" or "Tax (13%)". */
export function formatTaxLabel(rate, label = 'Tax') {
  const value = Number(rate || 0);
  return value > 0 ? `${label} (${Number(value.toFixed(2))}%)` : label;
}
