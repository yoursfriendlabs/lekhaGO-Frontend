const RETAIL_BUSINESS_TYPE = 'retail';
const RETAIL_SALES_LABEL = 'Quick POS';
const RETAIL_SALES_ROUTE = '/app/pos';
const RETAIL_SERVICES_LABEL = 'Services';
const TASKS_NAV_ITEM = { key: 'tasks', label: 'Tasks', route: '/app/tasks' };

export function isRetailBusinessType(businessProfile) {
  return businessProfile?.type === RETAIL_BUSINESS_TYPE;
}

export function getServicesDisplayLabel(businessProfile, fallbackLabel = 'Services') {
  return isRetailBusinessType(businessProfile) ? RETAIL_SERVICES_LABEL : fallbackLabel;
}

export function getNavigationForBusinessType(navigation = [], businessProfile) {
  if (!Array.isArray(navigation)) {
    return navigation;
  }

  let normalized = navigation.map((item) => (
    item?.key === 'sales'
      ? { ...item, label: RETAIL_SALES_LABEL, route: RETAIL_SALES_ROUTE }
      : item?.key === 'services'
        ? { ...item, label: getServicesDisplayLabel(businessProfile, item.label) }
        : item
  ));

  if (isRetailBusinessType(businessProfile) && !normalized.some((item) => item?.key === 'sales')) {
    const servicesIndex = normalized.findIndex((item) => item?.key === 'services');
    const inventoryIndex = normalized.findIndex((item) => item?.key === 'inventory');
    const insertIndex = servicesIndex >= 0 ? servicesIndex : inventoryIndex >= 0 ? inventoryIndex + 1 : 1;
    const salesItem = { key: 'sales', label: RETAIL_SALES_LABEL, route: RETAIL_SALES_ROUTE };

    normalized = [
      ...normalized.slice(0, insertIndex),
      salesItem,
      ...normalized.slice(insertIndex),
    ];
  }

  if (!normalized.some((item) => item?.key === 'tasks')) {
    const partiesIndex = normalized.findIndex((item) => item?.key === 'parties');
    const purchasesIndex = normalized.findIndex((item) => item?.key === 'purchases');
    const insertIndex = partiesIndex >= 0 ? partiesIndex : purchasesIndex >= 0 ? purchasesIndex + 1 : Math.max(normalized.length - 2, 1);

    normalized = [
      ...normalized.slice(0, insertIndex),
      TASKS_NAV_ITEM,
      ...normalized.slice(insertIndex),
    ];
  }

  return normalized;
}
