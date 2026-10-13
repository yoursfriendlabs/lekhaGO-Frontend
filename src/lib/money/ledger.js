function toNumber(value, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function pickLedgerItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

/**
 * @typedef {Object} LedgerPaymentBank
 * @property {string | null} id
 * @property {string | null} name
 * @property {number} currentAmount
 * @property {number} currentBalance
 */

/**
 * @typedef {Object} LedgerPaymentType
 * @property {string} method
 * @property {string} label
 * @property {string | null} bankId
 * @property {string | null} bankName
 * @property {number | null} bankCurrentAmount
 * @property {number | null} bankCurrentBalance
 * @property {LedgerPaymentBank} bank
 */

/**
 * @typedef {Object} LedgerRow
 * @property {string} id
 * @property {string} type
 * @property {string | null} referenceNo
 * @property {string} date
 * @property {string | null} partyId
 * @property {string | null} partyName
 * @property {string | null} status
 * @property {string} note
 * @property {number} totalAmount
 * @property {number} paidAmount
 * @property {number} amount
 * @property {number} debit
 * @property {number} credit
 * @property {number | null} runningBalance
 * @property {LedgerPaymentType} paymentType
 */

/**
 * @typedef {Object} LedgerReportResponse
 * @property {LedgerRow[]} items
 * @property {number} total
 * @property {number} limit
 * @property {number} offset
 */

/**
 * Normalize a single backend ledger row without changing accounting direction.
 * Running balance is trusted from the backend as-is. Debit/credit only carry
 * the still-unpaid remainder from the backend, so a fully paid bill would
 * arrive with both sides 0 and render as an amount-less row. Show the full
 * transaction amount (totalAmount) on its natural side instead.
 *
 * @param {Partial<LedgerRow> & { paymentType?: Partial<LedgerPaymentType> }} row
 * @returns {LedgerRow}
 */
export function normalizeLedgerRow(row = {}) {
  const paymentTypeRaw = row?.paymentType && typeof row.paymentType === 'object'
    ? row.paymentType
    : {};
  const bankRaw = paymentTypeRaw?.bank && typeof paymentTypeRaw.bank === 'object'
    ? paymentTypeRaw.bank
    : {};

  const entryType = String(row?.type || '').trim();
  const totalAmount = toNumber(row?.totalAmount ?? row?.total_amount);
  const rowAmount = toNumber(row?.amount);
  const fullAmount = totalAmount > 0 ? totalAmount : rowAmount;
  let debit = toNumber(row?.debit);
  let credit = toNumber(row?.credit);
  if (fullAmount > 0) {
    if (entryType === 'sale' || entryType === 'service' || entryType === 'payment_out') {
      debit = fullAmount;
    } else if (entryType === 'purchase' || entryType === 'expense' || entryType === 'payment_in') {
      credit = fullAmount;
    }
  }

  return {
    ...row,
    id: row?.id || row?.referenceNo || `${row?.type || 'entry'}-${row?.date || ''}`,
    type: entryType,
    referenceNo: row?.referenceNo || null,
    date: row?.date || '',
    partyId: row?.partyId || null,
    partyName: row?.partyName || null,
    status: row?.status || null,
    note: String(row?.note || row?.notes || '').trim(),
    totalAmount,
    paidAmount: toNumber(row?.paidAmount ?? row?.paid_amount),
    amount: rowAmount,
    debit,
    credit,
    runningBalance: toNullableNumber(row?.runningBalance),
    paymentType: {
      method: String(paymentTypeRaw?.method || paymentTypeRaw?.paymentMethod || '').trim().toLowerCase(),
      label: String(paymentTypeRaw?.label || '').trim(),
      bankId: paymentTypeRaw?.bankId || bankRaw?.id || null,
      bankName: paymentTypeRaw?.bankName || bankRaw?.name || null,
      bankCurrentAmount: toNullableNumber(
        paymentTypeRaw?.bankCurrentAmount
        ?? paymentTypeRaw?.bankCurrentBalance
        ?? bankRaw?.currentAmount
        ?? bankRaw?.currentBalance
      ),
      bankCurrentBalance: toNullableNumber(
        paymentTypeRaw?.bankCurrentBalance
        ?? paymentTypeRaw?.bankCurrentAmount
        ?? bankRaw?.currentBalance
        ?? bankRaw?.currentAmount
      ),
      bank: {
        id: bankRaw?.id || null,
        name: bankRaw?.name || null,
        currentAmount: toNumber(bankRaw?.currentAmount),
        currentBalance: toNumber(bankRaw?.currentBalance),
      },
    },
  };
}

/**
 * Format a ledger statement note for display.
 * Opening-balance system notes are localized when a translator is provided.
 *
 * @param {string | null | undefined} note
 * @param {(key: string) => string} [t]
 * @returns {string}
 */
export function formatLedgerNote(note, t) {
  const raw = String(note || '').trim();
  if (!raw) return '';
  if (raw === 'Opening Balance') {
    return typeof t === 'function' ? t('parties.openingBalanceNote') : raw;
  }
  return raw;
}

/**
 * Normalize the ledger report payload returned by `/api/reports/ledger`.
 *
 * @param {unknown} payload
 * @returns {LedgerReportResponse}
 */
export function normalizeLedgerReportResponse(payload) {
  const objectPayload = payload && typeof payload === 'object' ? payload : {};
  const items = pickLedgerItems(objectPayload).map((row) => normalizeLedgerRow(row));

  return {
    ...objectPayload,
    items,
    total: toNumber(objectPayload?.total, items.length),
    limit: toNumber(objectPayload?.limit, items.length || 25),
    offset: toNumber(objectPayload?.offset, 0),
  };
}
