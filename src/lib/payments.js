export function getEffectivePaymentMethod(paymentMethod, bankId) {
  return String(bankId || '').trim() ? 'bank' : paymentMethod === 'bank' ? 'bank' : 'cash';
}

export function normalizePaymentFields(source = {}) {
  const bankId = String(source.bankId || '').trim();

  return {
    paymentMethod: getEffectivePaymentMethod(source.paymentMethod, bankId),
    bankId,
    paymentNote: String(source.paymentNote || '').trim(),
  };
}

export function buildPaymentPayload(source = {}, options = {}) {
  const {
    noteKey = 'paymentNote',
  } = options;

  const payment = normalizePaymentFields(source);
  const payload = {
    paymentMethod: payment.paymentMethod,
  };

  if (payment.bankId) {
    payload.bankId = payment.bankId;
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
