export function formatCurrency(value, { symbol = 'Rs', locale = 'en-IN', compact = false } = {}) {
  const numeric = Number(value || 0);
  const amount = (Number.isFinite(numeric) ? numeric : 0).toLocaleString(locale, {
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 2,
    ...(compact ? { notation: 'compact' } : {}),
  });

  return `${symbol} ${amount}`;
}
