const RETAIL_BUSINESS_TYPE = 'retail';
const RETAIL_SALES_LABEL = 'Quick POS';
const RETAIL_SALES_ROUTE = '/app/pos';
const RETAIL_SERVICES_LABEL = 'Services';

export function isRetailBusinessType(businessProfile) {
  return businessProfile?.type === RETAIL_BUSINESS_TYPE;
}

export function getServicesDisplayLabel(businessProfile, fallbackLabel = 'Services') {
  return isRetailBusinessType(businessProfile) ? RETAIL_SERVICES_LABEL : fallbackLabel;
}

export function getNavigationForBusinessType(navigation = [], businessProfile) {
  if (!Array.isArray(navigation) || !isRetailBusinessType(businessProfile)) {
    return navigation;
  }

  const normalized = navigation.map((item) => (
    item?.key === 'sales'
      ? { ...item, label: RETAIL_SALES_LABEL, route: RETAIL_SALES_ROUTE }
      : item?.key === 'services'
        ? { ...item, label: getServicesDisplayLabel(businessProfile, item.label) }
        : item
  ));

  if (normalized.some((item) => item?.key === 'sales')) {
    return normalized;
  }

  const servicesIndex = normalized.findIndex((item) => item?.key === 'services');
  const inventoryIndex = normalized.findIndex((item) => item?.key === 'inventory');
  const insertIndex = servicesIndex >= 0 ? servicesIndex : inventoryIndex >= 0 ? inventoryIndex + 1 : 1;
  const salesItem = { key: 'sales', label: RETAIL_SALES_LABEL, route: RETAIL_SALES_ROUTE };

  return [
    ...normalized.slice(0, insertIndex),
    salesItem,
    ...normalized.slice(insertIndex),
  ];
}
