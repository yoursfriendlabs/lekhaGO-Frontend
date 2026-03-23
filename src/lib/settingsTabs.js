export const GENERAL_SETTINGS_TAB = 'general';
export const STAFF_SETTINGS_TAB = 'staff';
export const BANKS_SETTINGS_TAB = 'banks';
export const ORDER_ATTRIBUTES_SETTINGS_TAB = 'order-attributes';

export const SETTINGS_TABS = [
  GENERAL_SETTINGS_TAB,
  STAFF_SETTINGS_TAB,
  BANKS_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
];

export function buildSettingsTabPath(tab = GENERAL_SETTINGS_TAB) {
  if (!tab || tab === GENERAL_SETTINGS_TAB) {
    return '/app/settings';
  }

  return `/app/settings?tab=${encodeURIComponent(tab)}`;
}
