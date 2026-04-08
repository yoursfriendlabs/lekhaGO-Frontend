export const GENERAL_SETTINGS_TAB = 'general';
export const ACCOUNT_SETTINGS_TAB = 'account';
export const STAFF_SETTINGS_TAB = 'staff';
export const CATEGORIES_SETTINGS_TAB = 'categories';
export const UNITS_SETTINGS_TAB = 'units';
export const BANKS_SETTINGS_TAB = 'banks';
export const ORDER_ATTRIBUTES_SETTINGS_TAB = 'order-attributes';

export const SETTINGS_TABS = [
  GENERAL_SETTINGS_TAB,
  ACCOUNT_SETTINGS_TAB,
  STAFF_SETTINGS_TAB,
  CATEGORIES_SETTINGS_TAB,
  UNITS_SETTINGS_TAB,
  BANKS_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
];

export function buildSettingsTabPath(tab = GENERAL_SETTINGS_TAB) {
  if (!tab || tab === GENERAL_SETTINGS_TAB) {
    return '/app/settings';
  }

  return `/app/settings?tab=${encodeURIComponent(tab)}`;
}
