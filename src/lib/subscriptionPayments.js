export const PAYMENT_PROVIDER_OPTIONS = [
  { value: 'esewa', label: 'eSewa' },
  { value: 'khalti', label: 'Khalti' },
];

export function getPaymentProviderLabel(provider) {
  return PAYMENT_PROVIDER_OPTIONS.find((option) => option.value === provider)?.label || 'Payment';
}

function readQueryValue(searchParams, keys = []) {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) return value;
  }

  return '';
}

export function buildEsewaVerifyPayload(searchParams) {
  const data = readQueryValue(searchParams, ['data']);
  if (data) {
    return {
      provider: 'esewa',
      data,
    };
  }

  const transactionUuid = readQueryValue(searchParams, [
    'transaction_uuid',
    'transactionUuid',
    'txn_uuid',
  ]);
  const totalAmount = readQueryValue(searchParams, [
    'total_amount',
    'totalAmount',
    'amount',
  ]);

  if (!transactionUuid || !totalAmount) return null;

  return {
    provider: 'esewa',
    transactionUuid,
    totalAmount,
  };
}

export function buildKhaltiVerifyPayload(searchParams) {
  const pidx = readQueryValue(searchParams, ['pidx']);
  if (!pidx) return null;

  return {
    provider: 'khalti',
    pidx,
  };
}

export function submitProviderCheckout(provider, response) {
  const actionUrl = String(response?.actionUrl || '').trim();
  if (!actionUrl) {
    throw new Error('Checkout redirect URL is missing.');
  }

  if (provider === 'khalti') {
    window.location.href = actionUrl;
    return;
  }

  const formFields = response?.formFields && typeof response.formFields === 'object'
    ? response.formFields
    : null;

  if (!formFields) {
    throw new Error('eSewa checkout form data is missing.');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  form.style.display = 'none';

  Object.entries(formFields).forEach(([name, value]) => {
    if (value === undefined || value === null) return;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
