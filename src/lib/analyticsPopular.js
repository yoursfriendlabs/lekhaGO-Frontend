function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizePopularAnalyticsResponse(payload) {
  const source = asObject(payload) || {};
  const range = asObject(source.range) || {};

  return {
    range: {
      from: pickString(range.from) || null,
      to: pickString(range.to) || null,
      limit: toNumber(range.limit || 10) || 10,
    },
    items: Array.isArray(source.items)
      ? source.items.map((item, index) => ({
        rank: toNumber(item?.rank || index + 1) || index + 1,
        productId: pickString(item?.productId) || null,
        categoryId: pickString(item?.categoryId) || null,
        name: pickString(item?.name) || null,
        sku: pickString(item?.sku) || null,
        categoryName: pickString(item?.categoryName) || null,
        lineCount: toNumber(item?.lineCount),
        orderCount: toNumber(item?.orderCount),
        saleQuantity: toNumber(item?.saleQuantity),
        serviceQuantity: toNumber(item?.serviceQuantity),
        totalQuantity: toNumber(item?.totalQuantity),
        salesRevenue: toNumber(item?.salesRevenue),
        serviceRevenue: toNumber(item?.serviceRevenue),
        totalRevenue: toNumber(item?.totalRevenue),
      }))
      : [],
    total: toNumber(source.total),
  };
}
