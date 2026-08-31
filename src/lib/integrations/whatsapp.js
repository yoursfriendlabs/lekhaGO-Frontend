export function getWhatsAppLink(phoneNumber, message = '') {
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (!digits) return '';

  const text = String(message || '').trim();
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}

export function getDueWhatsAppMessage(name, dueAmount, fallbackMessage = 'Hello, Welcome to Rose Boutique and Creation') {
  if (!dueAmount) return fallbackMessage;
  return `Dear ${String(name || '').trim() || 'Customer'},\nYour due amount in Rose boutique is ${dueAmount}\nThank you for choosing Rose Boutique`;
}
