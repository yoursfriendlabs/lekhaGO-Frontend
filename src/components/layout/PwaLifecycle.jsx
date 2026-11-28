import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import { isStandaloneMode } from '@/lib/pwa.js';

const UPDATE_SNACKBAR_ID = 'pwa-update';
const OFFLINE_SNACKBAR_ID = 'pwa-offline';
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
// An update found this soon after launch is applied straight away: nothing has
// been typed yet, so a reload costs the user nothing.
const SILENT_UPDATE_WINDOW_MS = 8000;

export default function PwaLifecycle() {
  const { t } = useI18n();
  const { showSnackbar, dismissSnackbar } = useSnackbar();
  const bootedAtRef = useRef(Date.now());
  const registrationRef = useRef(null);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration || null;
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed', error);
    },
  });

  const applyUpdate = useCallback(() => {
    setNeedRefresh(false);
    // updateServiceWorker posts SKIP_WAITING and reloads once the new worker
    // takes control. The timeout covers browsers that never fire that event.
    updateServiceWorker(true).catch(() => null);
    window.setTimeout(() => window.location.reload(), 3000);
  }, [setNeedRefresh, updateServiceWorker]);

  // Ask the server for a new version when the app comes back to the
  // foreground, when the network returns, and every 15 minutes while open.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    const checkForUpdate = () => {
      if (!navigator.onLine) return;
      const registration = registrationRef.current;
      if (registration && !registration.installing) {
        registration.update().catch(() => null);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };

    const timer = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', checkForUpdate);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);

  useEffect(() => {
    if (!needRefresh) {
      dismissSnackbar(UPDATE_SNACKBAR_ID);
      return;
    }

    if (Date.now() - bootedAtRef.current < SILENT_UPDATE_WINDOW_MS) {
      applyUpdate();
      return;
    }

    showSnackbar({
      id: UPDATE_SNACKBAR_ID,
      tone: 'update',
      title: t('pwa.updateTitle'),
      description: t('pwa.updateDescription'),
      duration: 0,
      action: { label: t('pwa.reload'), onClick: applyUpdate },
    });
  }, [applyUpdate, dismissSnackbar, needRefresh, showSnackbar, t]);

  useEffect(() => {
    const handleOffline = () => {
      showSnackbar({
        id: OFFLINE_SNACKBAR_ID,
        tone: 'offline',
        title: t('pwa.offlineTitle'),
        description: t('pwa.offlineDescription'),
        duration: 0,
      });
    };
    const handleOnline = () => {
      dismissSnackbar(OFFLINE_SNACKBAR_ID);
      showSnackbar({ id: OFFLINE_SNACKBAR_ID, tone: 'success', title: t('pwa.onlineTitle'), duration: 2500 });
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) handleOffline();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [dismissSnackbar, showSnackbar, t]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };
    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setDismissedInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const canPromptInstall = useMemo(
    () => Boolean(installPromptEvent) && !dismissedInstall && !isStandaloneMode(),
    [dismissedInstall, installPromptEvent]
  );

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') {
      setInstallPromptEvent(null);
    }
    setDismissedInstall(true);
  };

  if (!canPromptInstall) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+var(--mobile-nav-offset,0px)+12px)] z-[90] md:left-auto md:right-6 md:bottom-6 md:max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-secondary-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t('pwa.installTitle')}</p>
          <p className="text-xs text-secondary-500">{t('pwa.installDescription')}</p>
        </div>
        <button type="button" className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white active:scale-95" onClick={handleInstall}>
          <Download className="h-4 w-4" aria-hidden />
          {t('pwa.install')}
        </button>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-secondary-400 hover:bg-secondary-100"
          onClick={() => setDismissedInstall(true)}
          aria-label={t('pwa.notNow')}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
