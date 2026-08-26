export function getEffectivePaymentMethod(paymentMethod, bankId) {
  const normalizedMethod = String(paymentMethod || '').trim().toLowerCase();
  if (normalizedMethod === 'cash') return 'cash';
  if (normalizedMethod === 'bank') return 'bank';
  return String(bankId || '').trim() ? 'bank' : 'cash';
}

export function normalizePaymentFields(source = {}) {
  const explicitMethod = getEffectivePaymentMethod(source.paymentMethod, source.bankId);
  const bankId = explicitMethod === 'bank' ? String(source.bankId || '').trim() : '';

  return {
    paymentMethod: explicitMethod,
    bankId,
    paymentNote: String(source.paymentNote || '').trim(),
  };
}

export function buildPaymentPayload(source = {}, options = {}) {
  const {
    includeEmptyBankId = false,
    noteKey = 'paymentNote',
  } = options;

  const payment = normalizePaymentFields(source);
  const payload = {
    paymentMethod: payment.paymentMethod,
  };

  if (payment.bankId) {
    payload.bankId = payment.bankId;
  } else if (includeEmptyBankId) {
    payload.bankId = null;
  }

  if (payment.paymentNote) {
    payload[noteKey] = payment.paymentNote;
  }

  return payload;
}

export function requiresBankSelection(source = {}, amount = 0) {
  const numericAmount = Number(amount || 0);
  if (numericAmount <= 0) return false;

  const payment = normalizePaymentFields(source);
  return payment.paymentMethod === 'bank' && !payment.bankId;
}
