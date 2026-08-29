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
 * Debit, credit, and running balance are trusted from the backend as-is.
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

  return {
    ...row,
    id: row?.id || row?.referenceNo || `${row?.type || 'entry'}-${row?.date || ''}`,
    type: String(row?.type || '').trim(),
    referenceNo: row?.referenceNo || null,
    date: row?.date || '',
    partyId: row?.partyId || null,
    partyName: row?.partyName || null,
    status: row?.status || null,
    debit: toNumber(row?.debit),
    credit: toNumber(row?.credit),
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
