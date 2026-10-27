/**
 * Shared helpers for the Hotel / Lodge screens.
 *
 * Everything that guesses at the backend payload shape lives here so a
 * contract change only needs a fix in one file.
 */
import dayjs from '@/lib/dates/datetime';
import { buildPaymentPayload } from '@/lib/money/payments';
import { formatMoney } from '@/lib/money/formatting';
import { pickBackendMessage } from '@/lib/business/hospitality';

/* ------------------------------------------------------------------ */
/* i18n + formatting                                                  */
/* ------------------------------------------------------------------ */

/** `t(key)` with an English fallback when the key has no translation yet. */
export function tx(t, key, fallback, vars) {
  const value = t(key, vars);
  if (!value || value === key) {
    if (!vars) return fallback;
    return String(fallback).replace(/\{\{?\s*(\w+)\s*\}?\}/g, (_, name) => String(vars[name] ?? ''));
  }
  return value;
}

export function money(t, amount) {
  return formatMoney(t, amount);
}

export function errorMessage(error, fallback = 'Request failed') {
  return pickBackendMessage(error, fallback);
}

export function asItems(payload, extraKeys = []) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const keys = [...extraKeys, 'items', 'rows', 'data', 'results'];
  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

export function num(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function firstDefined(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Dates                                                              */
/* ------------------------------------------------------------------ */

export function isoDate(value) {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD') : '';
}

export function addDaysISO(value, days) {
  const base = value ? dayjs(value) : dayjs();
  return base.add(days, 'day').format('YYYY-MM-DD');
}

export function nightsBetween(from, to) {
  const a = dayjs(from);
  const b = dayjs(to);
  if (!a.isValid() || !b.isValid()) return 0;
  return Math.max(b.startOf('day').diff(a.startOf('day'), 'day'), 0);
}

export function displayDate(value) {
  if (!value) return 'â€”';
  const d = dayjs(value);
  return d.isValid() ? d.format('D MMM YYYY') : String(value);
}

export function stayCheckIn(stay) {
  return firstDefined(
    stay?.checkInDate,
    stay?.checkIn,
    stay?.checkInAt,
    stay?.arrivalDate,
    stay?.from,
    stay?.startDate,
  );
}

export function stayCheckOut(stay) {
  return firstDefined(
    stay?.checkOutDate,
    stay?.checkOut,
    stay?.checkOutAt,
    stay?.departureDate,
    stay?.to,
    stay?.endDate,
  );
}

/* ------------------------------------------------------------------ */
/* Room / stay normalisation                                          */
/* ------------------------------------------------------------------ */

export const OCCUPANCY = {
  OCCUPIED: 'occupied',
  RESERVED: 'reserved',
  VACANT: 'vacant',
  OUT_OF_ORDER: 'out_of_order',
};

export const HOUSEKEEPING = {
  CLEAN: 'clean',
  DIRTY: 'dirty',
  INSPECTED: 'inspected',
  OUT_OF_ORDER: 'out_of_order',
};

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function roomOccupancy(room) {
  const raw = normalizeKey(
    firstDefined(room?.occupancyStatus, room?.occupancy, room?.status, room?.state),
  );
  if (raw === 'checked_in' || raw === 'in_house' || raw === 'occupied') return OCCUPANCY.OCCUPIED;
  if (raw === 'reserved' || raw === 'booked' || raw === 'arriving') return OCCUPANCY.RESERVED;
  if (raw === 'out_of_order' || raw === 'out_of_service' || raw === 'blocked') {
    return OCCUPANCY.OUT_OF_ORDER;
  }
  if (normalizeKey(room?.housekeepingStatus) === 'out_of_order') return OCCUPANCY.OUT_OF_ORDER;
  if (raw === 'vacant' || raw === 'available' || raw === 'free') return OCCUPANCY.VACANT;
  if (roomStay(room)) {
    const stayStatus = normalizeKey(roomStay(room)?.status);
    return stayStatus === 'reserved' ? OCCUPANCY.RESERVED : OCCUPANCY.OCCUPIED;
  }
  return OCCUPANCY.VACANT;
}

export function roomStay(room) {
  if (!room) return null;
  const nested = firstDefined(room.stay, room.currentStay, room.activeStay, room.reservation);
  if (nested && typeof nested === 'object') return nested;
  const stayId = firstDefined(room.stayId, room.currentStayId);
  return stayId ? { id: stayId, guestName: room.guestName, status: room.stayStatus } : null;
}

export function roomStayId(room) {
  const stay = roomStay(room);
  return stay?.id ? String(stay.id) : '';
}

export function roomHousekeeping(room) {
  const raw = normalizeKey(
    firstDefined(room?.housekeepingStatus, room?.housekeeping, room?.cleaningStatus),
  );
  if (raw === 'clean' || raw === 'dirty' || raw === 'inspected' || raw === 'out_of_order') return raw;
  return HOUSEKEEPING.CLEAN;
}

export function roomTypeName(room) {
  return String(
    firstDefined(room?.roomTypeName, room?.roomType?.name, room?.type?.name, room?.typeName) || '',
  );
}

export function roomRate(room) {
  return num(
    firstDefined(
      room?.rate,
      room?.effectiveRate,
      room?.baseRate,
      room?.roomType?.baseRate,
      room?.roomTypeBaseRate,
    ),
  );
}

export function roomOptionLabel(t, room) {
  const typeName = room?.roomTypeName || room?.roomType?.name || '';
  return [room?.name, typeName, money(t, roomRate(room))].filter(Boolean).join(' · ');
}

export function stayRoomName(stay) {
  return String(
    firstDefined(stay?.roomName, stay?.room?.name, stay?.roomNumber, stay?.room?.number) || '',
  );
}

export function stayGuestName(stay) {
  return String(
    firstDefined(stay?.guestName, stay?.party?.name, stay?.partyName, stay?.guest?.name) || '',
  );
}

export function stayStatusKey(stay) {
  return normalizeKey(stay?.status);
}

export const STAY_STATUS_LABELS = {
  reserved: ['hotel.status.reserved', 'Reserved'],
  checked_in: ['hotel.status.checkedIn', 'Checked in'],
  checked_out: ['hotel.status.checkedOut', 'Checked out'],
  cancelled: ['hotel.status.cancelled', 'Cancelled'],
  canceled: ['hotel.status.cancelled', 'Cancelled'],
  no_show: ['hotel.status.noShow', 'No-show'],
};

export const STAY_STATUS_TONES = {
  reserved: 'bg-sky-50 text-sky-700 border-sky-200',
  checked_in: 'bg-amber-50 text-amber-700 border-amber-200',
  checked_out: 'bg-secondary-100 text-secondary-600 border-secondary-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  canceled: 'bg-rose-50 text-rose-700 border-rose-200',
  no_show: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const ID_TYPES = [
  { value: 'citizenship', key: 'hotel.idType.citizenship', label: 'Citizenship' },
  { value: 'national_id', key: 'hotel.idType.nationalId', label: 'National ID' },
  { value: 'passport', key: 'hotel.idType.passport', label: 'Passport' },
  { value: 'driving_license', key: 'hotel.idType.drivingLicense', label: 'Driving licence' },
  { value: 'voter_id', key: 'hotel.idType.voterId', label: 'Voter ID' },
  { value: 'other', key: 'hotel.idType.other', label: 'Other' },
];

/* ------------------------------------------------------------------ */
/* Payload builders (single place to adjust the backend contract)     */
/* ------------------------------------------------------------------ */

function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export function buildStayPayload(form) {
  const advance = num(form.advanceAmount);
  return cleanObject({
    roomId: form.roomId,
    partyId: form.partyId || undefined,
    guestName: String(form.guestName || '').trim(),
    guestPhone: String(form.guestPhone || '').trim() || undefined,
    idType: form.idType || undefined,
    idNumber: String(form.idNumber || '').trim() || undefined,
    adults: num(form.adults, 1),
    children: num(form.children, 0),
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    rate: form.rate === '' || form.rate == null ? undefined : num(form.rate),
    notes: String(form.notes || '').trim() || undefined,
    checkInNow: Boolean(form.checkInNow),
    ...(advance > 0
      ? {
          advanceAmount: advance,
          ...buildPaymentPayload(form),
        }
      : {}),
  });
}

export function buildPaymentBody(form) {
  return cleanObject({
    amount: num(form.amount),
    ...buildPaymentPayload(form),
  });
}

/** Read a stay-folio into one tolerant shape for display. */
export function normalizeFolio(folio) {
  const f = folio && typeof folio === 'object' ? folio : {};
  const charges = asItems(firstDefined(f.charges, f.lines, f.items), ['charges', 'lines', 'items']);
  const payments = asItems(f.payments, ['payments']);
  const totals = f.totals && typeof f.totals === 'object' ? f.totals : f;
  const grandTotal = num(firstDefined(totals.grandTotal, totals.total, totals.totalCharges));
  const paid = num(firstDefined(totals.paidTotal, totals.totalPaid, totals.paid, totals.amountPaid));
  const balanceDue = num(
    firstDefined(totals.balanceDue, totals.balance, totals.dueAmount, grandTotal - paid),
  );
  return {
    raw: f,
    charges,
    payments,
    subTotal: num(firstDefined(totals.subTotal, totals.subtotal, grandTotal)),
    discount: num(firstDefined(totals.discount, totals.discountTotal)),
    taxTotal: num(firstDefined(totals.taxTotal, totals.tax, totals.taxAmount)),
    serviceChargeTotal: num(firstDefined(totals.serviceChargeTotal, totals.serviceCharge)),
    grandTotal,
    paid,
    advance: num(firstDefined(totals.advancePaid, totals.advance)),
    balanceDue,
    roomBill: f.roomBill || null,
    serviceOrderId: firstDefined(f.serviceOrderId, f.serviceOrder?.id) || null,
  };
}

export function chargeLabel(line, fallback = 'Charge') {
  return String(
    firstDefined(line?.description, line?.name, line?.productName, line?.label, line?.type) || fallback,
  );
}

export function chargeAmount(line) {
  const explicit = firstDefined(line?.amount, line?.lineTotal, line?.total);
  if (explicit !== undefined) return num(explicit);
  return num(line?.quantity, 1) * num(firstDefined(line?.unitPrice, line?.rate));
}

/* ------------------------------------------------------------------ */
/* CSV                                                                */
/* ------------------------------------------------------------------ */

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, header, rows) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(','));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Add an A4 landscape @page rule to a print clone. */
export function landscapePrintPrepare(clone) {
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 landscape; margin: 1cm; }';
  clone.prepend(style);
}
