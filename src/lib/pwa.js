export function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: fullscreen)').matches
      || window.navigator.standalone === true
  );
}

/** Fired on window to ask the open screen to reload its data. */
export const APP_REFRESH_EVENT = 'mms:app-refresh';

export function requestAppRefresh(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_REFRESH_EVENT, { detail }));
}

/**
 * Ask the server for a newer app version. Resolves 'waiting' when one is ready
 * (PwaLifecycle then shows the reload snackbar), 'none' when already current,
 * or 'unsupported'.
 */
export async function checkForAppUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'unsupported';
    await registration.update();
    if (registration.waiting || registration.installing) return 'waiting';
    return 'none';
  } catch {
    return 'none';
  }
}
