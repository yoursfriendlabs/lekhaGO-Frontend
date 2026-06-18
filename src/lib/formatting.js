/**
 * Format a number as currency using i18n.
 * @param {Function} t - i18n translate function
 * @param {number|string} amount
 * @returns {string}
 */
export function formatMoney(t, amount) {
  const n = Number(amount || 0);
  return t("currency.formatted", {
    symbol: t("currency.symbol"),
    amount: n.toFixed(2),
  });
}

/**
 * Parse a date string into YYYY-MM format.
 * @param {string} str
 * @returns {string}
 */
export function parseMonthYear(str) {
  if (!str) return "";
  const s = String(str);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 7);
  return "";
}

/**
 * Derive initials from a full name.
 * @param {string} name
 * @returns {string}
 */
export function toInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "S")
    .slice(0, 1)
    .toUpperCase();
}
