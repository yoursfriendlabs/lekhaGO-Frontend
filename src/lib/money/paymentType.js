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
    || source?.paymentMethod
    || raw.bankId
    || source?.bankId
    || raw.bankName
    || raw.bank?.id
    || raw.bank?.name
    || source?.Bank?.id
    || source?.Bank?.name
    || raw.Bank?.id
    || raw.Bank?.name
  );
}

export function normalizePaymentType(source) {
  const raw = source?.paymentType && typeof source.paymentType === 'object'
    ? source.paymentType
    : source && typeof source === 'object'
      ? source
      : {};
  const bank = (raw?.bank && typeof raw.bank === 'object' ? raw.bank : null)
    || (raw?.Bank && typeof raw.Bank === 'object' ? raw.Bank : null)
    || (source?.Bank && typeof source.Bank === 'object' ? source.Bank : null)
    || (source?.bank && typeof source.bank === 'object' ? source.bank : {});

  const explicitMethod = String(
    source?.paymentMethod
    || raw.method
    || raw.paymentMethod
    || ''
  ).trim().toLowerCase();

  const method = explicitMethod === 'cash'
    ? 'cash'
    : explicitMethod === 'bank'
      ? 'bank'
      : (raw.bankId || source?.bankId || bank.id ? 'bank' : 'cash');

  if (method === 'cash') {
    const rawLabel = String(raw.label || '').trim();
    const isGenericOrBankLabel = !rawLabel
      || ['cash', 'bank'].includes(rawLabel.toLowerCase())
      || rawLabel === (raw.bankName || bank.name);

    return {
      method: 'cash',
      label: isGenericOrBankLabel ? '' : rawLabel,
      bankId: '',
      bankName: '',
      bankCurrentAmount: null,
      bankCurrentBalance: null,
      bank: {},
    };
  }

  const bankId = String(raw.bankId || source?.bankId || bank.id || '').trim();
  const bankName = String(
    raw.bankName
    || raw.Bank?.name
    || source?.Bank?.name
    || bank.name
    || ''
  ).trim();
  const bankCurrentAmount = toFiniteAmount(
    raw.bankCurrentAmount
    ?? raw.bankCurrentBalance
    ?? bank.currentBalance
    ?? bank.currentAmount
  );
  const rawLabel = String(raw.label || '').trim();
  const isGenericLabel = !rawLabel || ['cash', 'bank'].includes(rawLabel.toLowerCase());
  const label = isGenericLabel ? (bankName || '') : rawLabel;

  return {
    method: 'bank',
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
  const resolvedLabel = paymentType.method === 'bank'
    ? (paymentType.label || paymentType.bankName || bankLabel)
    : (paymentType.label || cashLabel);

  const balanceText = paymentType.method === 'bank' && paymentType.bankCurrentAmount !== null
    ? `${balancePrefix}: ${formatMoney(paymentType.bankCurrentAmount)}`
    : '';

  return {
    ...paymentType,
    label: resolvedLabel || (paymentType.method === 'bank' ? bankLabel : cashLabel),
    balanceText,
  };
}
