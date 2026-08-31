export const ALL_STOCK_EXPIRED_CODE = 'ALL_STOCK_EXPIRED';
export const INSUFFICIENT_SELLABLE_STOCK_CODE = 'INSUFFICIENT_SELLABLE_STOCK';

export function todayYmd(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isExpiryDateExpired(expiryDate, asOf = todayYmd()) {
  const match = String(expiryDate || '').match(/^\d{4}-\d{2}-\d{2}/);
  if (!match) return false;
  return match[0] < asOf;
}

export function getTotalStockQuantity(product = {}) {
  return Number(
    product?.stockOnHand ??
      product?.openingStock ??
      product?.quantityOnHand ??
      0,
  );
}

export function getSellableQuantity(product = {}) {
  if (product?.sellableQuantity != null && product.sellableQuantity !== '') {
    const sellable = Number(product.sellableQuantity);
    return Number.isFinite(sellable) ? Math.max(0, sellable) : 0;
  }

  const total = getTotalStockQuantity(product);
  if (product?.expiredQuantity != null && product.expiredQuantity !== '') {
    return Math.max(0, total - Number(product.expiredQuantity || 0));
  }

  if (isExpiryDateExpired(product?.expiryDate) && Number(product?.batchCount || 0) <= 1) {
    return 0;
  }

  return Math.max(0, total);
}

export function isAllStockExpired(product = {}) {
  const total = getTotalStockQuantity(product);
  if (total <= 0) return false;
  if (product?.hasExpiredStock && getSellableQuantity(product) <= 0) return true;
  return getSellableQuantity(product) <= 0 && (
    Number(product?.expiredQuantity || 0) > 0 || isExpiryDateExpired(product?.expiryDate)
  );
}

export function toAvailableUnitQuantity(product = {}, unitType = 'primary', fallback = {}) {
  const source = product?.id ? product : fallback;
  const sellable = getSellableQuantity(source) || getSellableQuantity(fallback);
  const conversionRate = Number(source?.conversionRate || fallback?.conversionRate || 0);
  const secondaryUnit = source?.secondaryUnit || fallback?.secondaryUnit || '';

  if (unitType === 'secondary' && secondaryUnit && conversionRate > 0) {
    return sellable * conversionRate;
  }

  return sellable;
}

export function getStockAvailabilityMessage(error, t, productName = '') {
  const payload = error?.payload || {};
  const code = payload.code || error?.code;
  const name = productName || payload.productName || '';
  const message = String(error?.message || payload.message || '');

  if (code === ALL_STOCK_EXPIRED_CODE || /all stock is expired/i.test(message)) {
    return name
      ? (t('sales.allStockExpiredNamed', { name }) || `All stock of ${name} is expired`)
      : (t('sales.allStockExpired') || 'All stock is expired');
  }

  if (code === INSUFFICIENT_SELLABLE_STOCK_CODE || /insufficient sellable stock/i.test(message)) {
    return name
      ? (t('sales.insufficientSellableStockNamed', { name }) || `Not enough sellable stock for ${name}`)
      : (t('sales.insufficientSellableStock') || 'Not enough sellable stock. Some lots are expired.');
  }

  return message || t('sales.insufficientStock');
}
