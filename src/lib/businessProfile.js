const DEFAULT_BUSINESS_TYPES = [
  {
    value: 'retail',
    label: 'Retail',
    description: 'General shop flow with inventory, purchasing, and direct sales.',
    navigation: [
      { key: 'dashboard', label: 'Dashboard', route: '/app' },
      { key: 'inventory', label: 'Inventory', route: '/app/inventory' },
      { key: 'sales', label: 'Sales', route: '/app/sales' },
      { key: 'services', label: 'Services', route: '/app/services' },
      { key: 'purchases', label: 'Purchases', route: '/app/purchases' },
      { key: 'parties', label: 'Parties', route: '/app/parties' },
      { key: 'ledger', label: 'Ledger', route: '/app/ledger' },
      { key: 'analytics', label: 'Analytics', route: '/app/analytics' },
      { key: 'settings', label: 'Settings', route: '/app/settings' },
    ],
    modules: {
      inventory: true,
      sales: true,
      orders: false,
      purchases: true,
      parties: true,
      ledger: true,
      analytics: true,
      services: true,
      cafePos: false,
      jewelleryService: false,
    },
    inventory: {
      title: 'Inventory',
      subtitle: 'Manage stock, pricing, and units for retail products.',
      showJewelleryFields: false,
      showCafeFields: false,
      itemTypes: [
        { value: 'goods', label: 'Stock Item', description: 'Physical product tracked in inventory.' },
        { value: 'service', label: 'Service', description: 'Non-stock work or fee item.' },
      ],
    },
    salesFlow: {
      mode: 'retail',
      title: 'Sales',
      navLabel: 'Sales',
      createLabel: 'New Sale',
      route: '/app/sales',
      attributeSectionTitle: 'Order Information',
      attributeSectionHint: 'Optional invoice or customer-specific fields.',
    },
    servicesFlow: {
      enabled: true,
      title: 'Services',
      navLabel: 'Services',
      route: '/app/services',
    },
    dashboard: {
      salesLabel: 'Sales',
      servicesLabel: 'Services',
    },
    settings: {
      enabledModules: ['dashboard', 'inventory', 'sales', 'services', 'purchases', 'parties', 'ledger', 'analytics', 'settings'],
      defaultOrderFlow: 'direct_sale',
      defaultOrderChannel: 'counter',
      serviceChargeRate: '0',
      defaultTaxRate: '0',
      uiPreferences: {
        inventoryMode: 'standard',
        salesExperience: 'retail',
        showJewelleryPanels: false,
        showCafePanels: false,
      },
    },
    dynamicFields: {
      sale: [],
      service: [],
    },
  },
  {
    value: 'jewellery',
    label: 'Jewellery',
    description: 'Jewellery inventory plus repair and service flow.',
    navigation: [
      { key: 'dashboard', label: 'Dashboard', route: '/app' },
      { key: 'inventory', label: 'Inventory', route: '/app/inventory' },
      { key: 'sales', label: 'Sales', route: '/app/sales' },
      { key: 'services', label: 'Repair Orders', route: '/app/services' },
      { key: 'purchases', label: 'Purchases', route: '/app/purchases' },
      { key: 'parties', label: 'Parties', route: '/app/parties' },
      { key: 'ledger', label: 'Ledger', route: '/app/ledger' },
      { key: 'analytics', label: 'Analytics', route: '/app/analytics' },
      { key: 'settings', label: 'Settings', route: '/app/settings' },
    ],
    modules: {
      inventory: true,
      sales: true,
      orders: false,
      purchases: true,
      parties: true,
      ledger: true,
      analytics: true,
      services: true,
      cafePos: false,
      jewelleryService: true,
    },
    inventory: {
      title: 'Jewellery Inventory',
      subtitle: 'Track metal type, purity, pricing, and stock.',
      showJewelleryFields: true,
      showCafeFields: false,
      itemTypes: [
        { value: 'goods', label: 'Jewellery Item', description: 'Saleable jewellery inventory item.' },
        { value: 'service', label: 'Service', description: 'Repair or other non-stock service line.' },
      ],
    },
    salesFlow: {
      mode: 'jewellery',
      title: 'Jewellery Sales',
      navLabel: 'Sales',
      createLabel: 'New Jewellery Sale',
      route: '/app/sales',
      attributeSectionTitle: 'Order Information',
      attributeSectionHint: 'Capture optional sizing or design references.',
    },
    servicesFlow: {
      enabled: true,
      title: 'Repair Orders',
      navLabel: 'Repair Orders',
      route: '/app/services',
      attributeSectionHint: 'Track repair notes, weights, wastage, and material details.',
    },
    dashboard: {
      salesLabel: 'Jewellery Sales',
      servicesLabel: 'Repair Revenue',
    },
    settings: {
      enabledModules: ['dashboard', 'inventory', 'sales', 'services', 'purchases', 'parties', 'ledger', 'analytics', 'settings'],
      defaultOrderFlow: 'jewellery_sales_and_repair',
      defaultOrderChannel: 'showroom',
      serviceChargeRate: '0',
      defaultTaxRate: '0',
      uiPreferences: {
        inventoryMode: 'jewellery',
        salesExperience: 'jewellery',
        showJewelleryPanels: true,
        showCafePanels: false,
      },
    },
    dynamicFields: {
      sale: [
        { key: 'design_reference', name: 'Design Reference', type: 'text' },
        { key: 'size', name: 'Size', type: 'text' },
      ],
      service: [
        { key: 'customer_request', name: 'Customer Request', type: 'text' },
      ],
    },
  },
  {
    value: 'cafe',
    label: 'Cafe',
    description: 'POS-style cafe flow with menu, ingredients, and quick order capture.',
    navigation: [
      { key: 'dashboard', label: 'Dashboard', route: '/app' },
      { key: 'orders', label: 'Orders', route: '/app/orders' },
      { key: 'inventory', label: 'Menu & Stock', route: '/app/inventory' },
      { key: 'sales', label: 'POS', route: '/app/pos' },
      { key: 'purchases', label: 'Purchases', route: '/app/purchases' },
      { key: 'parties', label: 'Suppliers', route: '/app/parties' },
      { key: 'ledger', label: 'Ledger', route: '/app/ledger' },
      { key: 'analytics', label: 'Analytics', route: '/app/analytics' },
      { key: 'settings', label: 'Settings', route: '/app/settings' },
    ],
    modules: {
      inventory: true,
      sales: true,
      orders: true,
      purchases: true,
      parties: true,
      ledger: true,
      analytics: true,
      services: false,
      cafePos: true,
      jewelleryService: false,
    },
    inventory: {
      title: 'Menu & Stock',
      subtitle: 'Manage menu items, ingredients, packaged products, and pricing.',
      showJewelleryFields: false,
      showCafeFields: true,
      itemTypes: [
        { value: 'menu_item', label: 'Menu Item', description: 'Prepared drink or food item sold to customers.' },
        { value: 'ingredient', label: 'Ingredient', description: 'Raw material used in recipes.' },
        { value: 'retail_item', label: 'Retail Item', description: 'Packaged product sold directly as-is.' },
        { value: 'service', label: 'Charge', description: 'Delivery or other non-stock service line.' },
      ],
    },
    salesFlow: {
      mode: 'cafe',
      title: 'Cafe POS',
      navLabel: 'POS',
      createLabel: 'New Order',
      route: '/app/pos',
      attributeSectionTitle: 'Order & Table Information',
      attributeSectionHint: 'Capture order type, table number, waiter, and guest count.',
    },
    servicesFlow: {
      enabled: false,
      title: 'Services',
      navLabel: 'Services',
      route: '/app/services',
    },
    dashboard: {
      salesLabel: 'POS Sales',
      servicesLabel: 'Service Revenue',
    },
    settings: {
      enabledModules: ['dashboard', 'orders', 'inventory', 'sales', 'purchases', 'parties', 'ledger', 'analytics', 'settings'],
      defaultOrderFlow: 'cafe_pos',
      defaultOrderChannel: 'takeaway',
      serviceChargeRate: '0',
      defaultTaxRate: '0',
      uiPreferences: {
        inventoryMode: 'cafe',
        salesExperience: 'cafe_pos',
        showJewelleryPanels: false,
        showCafePanels: true,
      },
    },
    dynamicFields: {
      sale: [
        { key: 'order_status', name: 'Order Status', type: 'text' },
        { key: 'order_type', name: 'Order Type', type: 'text' },
        { key: 'table_no', name: 'Table No', type: 'text' },
        { key: 'waiter_name', name: 'Waiter Name', type: 'text' },
        { key: 'guest_count', name: 'Guest Count', type: 'number' },
      ],
      service: [],
    },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getFallbackBusinessTypes() {
  return clone(DEFAULT_BUSINESS_TYPES);
}

export function getDefaultBusinessProfile(type = 'retail') {
  const match = DEFAULT_BUSINESS_TYPES.find((entry) => entry.value === type) || DEFAULT_BUSINESS_TYPES[0];
  const profile = clone(match);
  return {
    business: null,
    type: profile.value,
    ...profile,
  };
}

export function normalizeBusinessProfile(profile) {
  const requestedType = profile?.type || profile?.business?.type || 'retail';
  const base = getDefaultBusinessProfile(requestedType);

  return {
    ...base,
    ...(profile || {}),
    business: {
      ...(base.business || {}),
      ...(profile?.business || {}),
    },
    modules: {
      ...(base.modules || {}),
      ...(profile?.modules || {}),
    },
    inventory: {
      ...(base.inventory || {}),
      ...(profile?.inventory || {}),
    },
    salesFlow: {
      ...(base.salesFlow || {}),
      ...(profile?.salesFlow || {}),
    },
    servicesFlow: {
      ...(base.servicesFlow || {}),
      ...(profile?.servicesFlow || {}),
    },
    dashboard: {
      ...(base.dashboard || {}),
      ...(profile?.dashboard || {}),
    },
    settings: {
      ...(base.settings || {}),
      ...(profile?.settings || {}),
      uiPreferences: {
        ...(base.settings?.uiPreferences || {}),
        ...(profile?.settings?.uiPreferences || {}),
      },
    },
    dynamicFields: {
      sale: Array.isArray(profile?.dynamicFields?.sale) ? profile.dynamicFields.sale : base.dynamicFields.sale,
      service: Array.isArray(profile?.dynamicFields?.service) ? profile.dynamicFields.service : base.dynamicFields.service,
    },
    navigation: Array.isArray(profile?.navigation) && profile.navigation.length ? profile.navigation : base.navigation,
  };
}

export function getBusinessTypeOption(value) {
  return getFallbackBusinessTypes().find((entry) => entry.value === value) || null;
}

export function isModuleEnabled(profile, moduleKey) {
  return Boolean(normalizeBusinessProfile(profile).modules?.[moduleKey]);
}
