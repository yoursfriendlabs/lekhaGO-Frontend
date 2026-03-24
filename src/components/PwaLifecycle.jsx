import { useEffect, useMemo, useState } from 'react';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function FloatingPrompt({ title, description, tone = 'info', primaryAction, secondaryAction }) {
  const tones = {
    info: 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700/50 dark:bg-emerald-950/70 dark:text-emerald-100',
  };

  return (
    <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 md:left-auto md:right-6 md:max-w-sm md:bottom-6">
      <div className={`rounded-3xl border p-4 shadow-xl ${tones[tone] || tones.info}`}>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-inherit/80">{description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {primaryAction ? (
            <button className="btn-primary" type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button className="btn-ghost" type="button" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PwaLifecycle() {
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
      setDismissedInstall(false);
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

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    const initialControllerUrl = navigator.serviceWorker.controller?.scriptURL || '';
    let reloaded = false;

    const refreshRegistration = () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        registration?.update().catch(() => null);
      }).catch(() => null);
    };

    const handleControllerChange = () => {
      const nextControllerUrl = navigator.serviceWorker.controller?.scriptURL || '';
      if (reloaded || !nextControllerUrl || nextControllerUrl === initialControllerUrl) return;

      reloaded = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshRegistration();
      }
    };

    refreshRegistration();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
      setDismissedInstall(true);
    }
  };

  if (canPromptInstall) {
    return (
      <FloatingPrompt
        title="Install ManageMyShop"
        description="Add the app to the home screen for faster launch, full-screen mode, and background updates."
        primaryAction={{ label: 'Install app', onClick: handleInstall }}
        secondaryAction={{ label: 'Not now', onClick: () => setDismissedInstall(true) }}
      />
    );
  }

  return null;
}
