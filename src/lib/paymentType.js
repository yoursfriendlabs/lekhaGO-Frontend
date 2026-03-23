function toFiniteAmount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function hasPaymentTypeData(source) {
  const raw = source?.paymentType && typeof source.paymentType === 'object'
    ? source.paymentType
    : source && typeof source === 'object'
      ? source
      : null;

  if (!raw) return false;

  return Boolean(
    raw.label
    || raw.method
    || raw.paymentMethod
    || raw.bankId
    || raw.bankName
    || raw.bank?.id
    || raw.bank?.name
  );
}

export function normalizePaymentType(source) {
  const raw = source?.paymentType && typeof source.paymentType === 'object'
    ? source.paymentType
    : source && typeof source === 'object'
      ? source
      : {};
  const bank = raw?.bank && typeof raw.bank === 'object' ? raw.bank : {};
  const explicitMethod = String(raw.method || raw.paymentMethod || '').trim().toLowerCase();
  const method = explicitMethod || (raw.bankId || bank.id ? 'bank' : 'cash');

  const bankId = String(raw.bankId || bank.id || '').trim();
  const bankName = String(raw.bankName || bank.name || '').trim();
  const bankCurrentAmount = toFiniteAmount(
    raw.bankCurrentAmount
    ?? raw.bankCurrentBalance
    ?? bank.currentBalance
    ?? bank.currentAmount
  );
  const label = String(
    raw.label
    || (method === 'bank' ? bankName : '')
    || (method === 'bank' ? 'bank' : 'cash')
  ).trim();

  return {
    method,
    label,
    bankId,
    bankName,
    bankCurrentAmount,
    bankCurrentBalance: bankCurrentAmount,
    bank,
  };
}

export function getPaymentTypeDisplay(source, options = {}) {
  const {
    cashLabel = 'Cash',
    bankLabel = 'Bank',
    balancePrefix = 'Balance',
    formatMoney = (value) => String(value ?? 0),
  } = options;

  const paymentType = normalizePaymentType(source);
  const resolvedLabel = paymentType.label || (paymentType.method === 'bank' ? paymentType.bankName || bankLabel : cashLabel);
  const balanceText = paymentType.method === 'bank' && paymentType.bankCurrentAmount !== null
    ? `${balancePrefix}: ${formatMoney(paymentType.bankCurrentAmount)}`
    : '';

  return {
    ...paymentType,
    label: resolvedLabel || cashLabel,
    balanceText,
  };
}
