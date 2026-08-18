export function isIrdLocked(record) {
  return record?.isLocked === true || record?.isLocked === 'true' || record?.isLocked === 1 || record?.isLocked === '1';
}

export function isIrdCancelled(record) {
  const status = String(record?.status || '').toLowerCase();
  return status === 'cancelled' || status === 'canceled' || status === 'void';
}

export function getIrdReprintLabel(record) {
  if (!isIrdLocked(record)) return '';
  const count = Number(record?.reprintCount || 0);
  return count > 0 ? `Copy of Original – ${count}` : '';
}
