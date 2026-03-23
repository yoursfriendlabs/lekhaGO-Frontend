export function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

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
    badgeClass: 'bg-slate-100 text-slate-500',
    textClass: 'text-slate-400',
  };
}

export function normalizePartyStatementResponse(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.rows)
    ? payload.rows
    : [];

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
      salesDue: toAmount(payload?.summary?.salesDue),
      servicesDue: toAmount(payload?.summary?.servicesDue),
      purchasesDue: toAmount(payload?.summary?.purchasesDue),
      totalPaymentIn: toAmount(payload?.summary?.totalPaymentIn),
      totalPaymentOut: toAmount(payload?.summary?.totalPaymentOut),
      currentAmount: toAmount(payload?.summary?.currentAmount),
    },
    rows: items,
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
