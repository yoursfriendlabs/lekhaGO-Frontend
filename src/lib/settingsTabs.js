export const GENERAL_SETTINGS_TAB = 'general';
export const PROFILE_SETTINGS_TAB = 'profile';
export const APPEARANCE_SETTINGS_TAB = 'appearance';
export const SUBSCRIPTION_SETTINGS_TAB = 'subscription';
export const ACCOUNT_SETTINGS_TAB = 'account';
export const CATEGORIES_SETTINGS_TAB = 'categories';
export const EXPENSE_CATEGORIES_SETTINGS_TAB = 'expense-categories';
export const UNITS_SETTINGS_TAB = 'units';
export const BANKS_SETTINGS_TAB = 'banks';
export const ORDER_ATTRIBUTES_SETTINGS_TAB = 'order-attributes';
export const TABLES_FLOORS_SETTINGS_TAB = 'tables-floors';

export const SETTINGS_TABS = [
  GENERAL_SETTINGS_TAB,
  PROFILE_SETTINGS_TAB,
  APPEARANCE_SETTINGS_TAB,
  SUBSCRIPTION_SETTINGS_TAB,
  ACCOUNT_SETTINGS_TAB,
  CATEGORIES_SETTINGS_TAB,
  EXPENSE_CATEGORIES_SETTINGS_TAB,
  UNITS_SETTINGS_TAB,
  BANKS_SETTINGS_TAB,
  ORDER_ATTRIBUTES_SETTINGS_TAB,
  TABLES_FLOORS_SETTINGS_TAB,
];

export function buildSettingsTabPath(tab = GENERAL_SETTINGS_TAB) {
  if (!tab || tab === GENERAL_SETTINGS_TAB) {
    return '/app/settings';
  }

  return `/app/settings?tab=${encodeURIComponent(tab)}`;
}
