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

  const tablesEnabled = businessProfile?.settings?.enabledModules?.includes("tables") || businessProfile?.type === "cafe";
  if (tablesEnabled) {
    if (!normalized.some((item) => item?.key === 'orders')) {
      const salesIndex = normalized.findIndex((item) => item?.key === 'sales');
      const insertIndex = salesIndex >= 0 ? salesIndex : 1;
      normalized = [
        ...normalized.slice(0, insertIndex),
        { key: 'orders', label: 'Cafe Orders', route: '/app/orders' },
        ...normalized.slice(insertIndex),
      ];
    }
    if (!normalized.some((item) => item?.key === 'billing')) {
      const salesIndex = normalized.findIndex((item) => item?.key === 'sales' || item?.key === 'orders');
      const insertIndex = salesIndex >= 0 ? salesIndex + 1 : 1;
      normalized = [
        ...normalized.slice(0, insertIndex),
        { key: 'billing', label: 'Billing Counter', route: '/app/billing' },
        ...normalized.slice(insertIndex),
      ];
    }
    if (!normalized.some((item) => item?.key === 'tables')) {
      const billingIndex = normalized.findIndex((item) => item?.key === 'billing');
      const insertIndex = billingIndex >= 0 ? billingIndex + 1 : 1;
      normalized = [
        ...normalized.slice(0, insertIndex),
        { key: 'tables', label: 'Tables', route: '/app/tables' },
        ...normalized.slice(insertIndex),
      ];
    }
  }

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

  if (!normalized.some((item) => item?.key === 'attendance')) {
    const tasksIndex = normalized.findIndex((item) => item?.key === 'tasks');
    const insertIndex = tasksIndex >= 0 ? tasksIndex + 1 : Math.max(normalized.length - 2, 1);

    normalized = [
      ...normalized.slice(0, insertIndex),
      { key: 'attendance', label: 'Attendance', route: '/app/attendance' },
      ...normalized.slice(insertIndex),
    ];
  }

  if (!normalized.some((item) => item?.key === 'staff')) {
    const attendanceIndex = normalized.findIndex((item) => item?.key === 'attendance');
    const insertIndex = attendanceIndex >= 0 ? attendanceIndex + 1 : Math.max(normalized.length - 2, 1);

    normalized = [
      ...normalized.slice(0, insertIndex),
      { key: 'staff', label: 'Staff', route: '/app/staff' },
      ...normalized.slice(insertIndex),
    ];
  }

  return normalized;
}
