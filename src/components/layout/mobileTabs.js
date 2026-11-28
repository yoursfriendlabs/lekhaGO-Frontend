// Items that always live in the More sheet rather than the bottom tab bar.
const MORE_ONLY_KEYS = new Set(['settings', 'profile', 'staff-salary']);
export const MAX_PRIMARY_TABS = 4;

/** First four nav items in the business's own order, leaving settings and profile for More. */
export function pickPrimaryTabs(items = []) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item?.route && !MORE_ONLY_KEYS.has(item.key))
    .slice(0, MAX_PRIMARY_TABS);
}

export function isRouteActive(pathname = '', route = '') {
  const target = String(route).split('?')[0].replace(/\/$/, '');
  const current = String(pathname).replace(/\/$/, '');
  if (!target) return false;
  if (target === '/app') return current === '/app';
  return current === target || current.startsWith(`${target}/`);
}
