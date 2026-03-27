export function getWhatsAppLink(phoneNumber, message = '') {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (!digits) return '';

  const text = String(message || '').trim();
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}
