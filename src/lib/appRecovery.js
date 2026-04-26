const AUTO_RECOVERY_ATTEMPT_KEY = 'mms_auto_recovery_attempted_at';
const AUTO_RECOVERY_COOLDOWN_MS = 60 * 1000;

const chunkErrorPatterns = [
  'failed to fetch dynamically imported module',
  'loading chunk',
  'importing a module script failed',
  'a.filter is not a function',
];

let recoveryInProgress = false;
let preloadRecoveryInstalled = false;

function getSessionStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function rememberRecoveryAttempt(now = Date.now()) {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    storage.setItem(AUTO_RECOVERY_ATTEMPT_KEY, String(now));
  } catch {
    // Ignore storage write failures and continue with recovery.
  }
}

function hasRecentRecoveryAttempt(now = Date.now()) {
  const storage = getSessionStorage();
  if (!storage) return false;

  try {
    const lastAttempt = Number(storage.getItem(AUTO_RECOVERY_ATTEMPT_KEY) || 0);
    return Number.isFinite(lastAttempt) && lastAttempt > 0 && now - lastAttempt < AUTO_RECOVERY_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function isChunkOrCacheError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return chunkErrorPatterns.some((pattern) => message.includes(pattern));
}

export function canAutoRecoverChunkError(now = Date.now()) {
  if (typeof window === 'undefined') return false;
  return !recoveryInProgress && !hasRecentRecoveryAttempt(now);
}

export async function clearAppRuntime() {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
    }
  } catch (error) {
    console.error('App recovery reset failed', error);
  }
}

export function reloadApp() {
  if (typeof window === 'undefined') return;
  window.location.reload();
}

export async function recoverFromChunkError() {
  if (typeof window === 'undefined' || recoveryInProgress) return false;

  recoveryInProgress = true;
  rememberRecoveryAttempt();

  try {
    await clearAppRuntime();
  } finally {
    reloadApp();
    recoveryInProgress = false;
  }

  return true;
}

export function installChunkLoadRecovery() {
  if (typeof window === 'undefined' || preloadRecoveryInstalled) return;

  preloadRecoveryInstalled = true;

  const attemptChunkRecovery = (payload, event) => {
    if (!isChunkOrCacheError(payload) || !canAutoRecoverChunkError()) return;

    event?.preventDefault?.();
    void recoverFromChunkError();
  };

  window.addEventListener('vite:preloadError', (event) => {
    attemptChunkRecovery(event?.payload, event);
  });

  window.addEventListener('error', (event) => {
    attemptChunkRecovery(event?.error || event?.message, event);
  });

  window.addEventListener('unhandledrejection', (event) => {
    attemptChunkRecovery(event?.reason, event);
  });
}

export { AUTO_RECOVERY_ATTEMPT_KEY, AUTO_RECOVERY_COOLDOWN_MS };
