export function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toNullableAmount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Party To Pay / To Receive comes from `party.currentAmount` only.
 * The backend is the source of truth and counts remaining dues:
 * unpaid sales and services make it negative (they owe us, To Receive),
 * unpaid purchases and expenses make it positive (we owe them, To Pay).
 * Do not recompute this from the transaction list on the client.
 */
export function getPartyBalanceMeta(currentAmount, t) {
  const amount = toAmount(currentAmount);

  if (amount < 0) {
    return {
      amount,
      absoluteAmount: Math.abs(amount),
      tone: 'receive',
      label: t('parties.toReceive'),
      badgeClass: 'bg-rose-100 text-rose-600',
      textClass: 'text-rose-500',
    };
  }

  if (amount > 0) {
    return {
      amount,
      absoluteAmount: amount,
      tone: 'pay',
      label: t('parties.toGive'),
      badgeClass: 'bg-blue-100 text-blue-600',
      textClass: 'text-blue-600',
    };
  }

  return {
    amount: 0,
    absoluteAmount: 0,
    tone: 'settled',
    label: t('parties.settled'),
    badgeClass: 'bg-secondary-100 text-secondary-500',
    textClass: 'text-secondary-400',
  };
}

export function getStatementRunningBalanceMeta(row, t) {
  const runningBalance = toNullableAmount(row?.runningBalance ?? row?.running_balance);
  if (runningBalance === null) return null;
  return getPartyBalanceMeta(runningBalance, t);
}

export function normalizePartyStatementResponse(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.rows)
    ? payload.rows
    : [];

  const rows = items.map((row) => ({
    ...row,
    runningBalance: toNullableAmount(row?.runningBalance ?? row?.running_balance),
  }));

  return {
    party: payload?.party || null,
    filters: {
      partyId: payload?.filters?.partyId ?? null,
      partyName: payload?.filters?.partyName ?? null,
      type: payload?.filters?.type || 'all',
      from: payload?.filters?.from ?? null,
      to: payload?.filters?.to ?? null,
    },
    summary: {
      totalRows: Number(payload?.summary?.totalRows ?? payload?.total ?? items.length ?? 0),
      totalSales: toAmount(payload?.summary?.totalSales),
      totalServices: toAmount(payload?.summary?.totalServices),
      totalPurchases: toAmount(payload?.summary?.totalPurchases),
      totalExpenses: toAmount(payload?.summary?.totalExpenses),
      salesDue: toAmount(payload?.summary?.salesDue),
      servicesDue: toAmount(payload?.summary?.servicesDue),
      purchasesDue: toAmount(payload?.summary?.purchasesDue),
      expensesDue: toAmount(payload?.summary?.totalExpensesDue ?? payload?.summary?.expensesDue),
      totalPaymentIn: toAmount(payload?.summary?.totalPaymentIn),
      totalPaymentOut: toAmount(payload?.summary?.totalPaymentOut),
      currentAmount: toAmount(payload?.summary?.currentAmount),
      runningBalance: toNullableAmount(
        payload?.summary?.runningBalance ?? payload?.summary?.running_balance
      ),
    },
    rows,
    expenses: Array.isArray(payload?.expenses) ? payload.expenses : [],
    pagination: {
      limit: Number(payload?.limit ?? payload?.pagination?.limit ?? 100),
      offset: Number(payload?.offset ?? payload?.pagination?.offset ?? 0),
    },
  };
}

export function normalizePartyReportRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.parties)
    ? payload.parties
    : Array.isArray(payload?.data)
    ? payload.data
    : [];

  return rows.map((row) => {
    const party = row?.party && typeof row.party === 'object' ? row.party : null;
    return {
      ...row,
      ...(party || {}),
      id: row?.id || party?.id || '',
      name: row?.name || party?.name || '',
      currentAmount: row?.currentAmount ?? party?.currentAmount ?? 0,
      type: row?.type || party?.type || 'customer',
    };
  });
}

export function getStatementTypeLabel(type, t) {
  switch (type) {
    case 'sale':
      return t('ledger.sale');
    case 'service':
      return t('ledger.service');
    case 'purchase':
      return t('ledger.purchase');
    case 'expense':
      return t('purchases.expense');
    case 'payment_in':
      return t('parties.paymentIn');
    case 'payment_out':
      return t('parties.paymentOut');
    case 'transaction':
      return t('ledger.transactionFilter');
    default:
      return type || t('ledger.all');
  }
}
