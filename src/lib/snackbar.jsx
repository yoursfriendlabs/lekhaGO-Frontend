import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, RefreshCw, WifiOff, X } from 'lucide-react';

const SnackbarContext = createContext(null);
const DEFAULT_DURATION = 4000;

const baseContainer = 'border-secondary-200/80 bg-white/95 text-ink shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100';

const toneStyles = {
  info: { container: baseContainer, icon: 'text-sky-600 dark:text-sky-300', Icon: Info },
  success: { container: baseContainer, icon: 'text-emerald-600 dark:text-emerald-300', Icon: CheckCircle2 },
  error: { container: baseContainer, icon: 'text-rose-600 dark:text-rose-300', Icon: AlertCircle },
  update: { container: baseContainer, icon: 'text-primary-600 dark:text-primary-300', Icon: RefreshCw },
  offline: { container: baseContainer, icon: 'text-amber-600 dark:text-amber-300', Icon: WifiOff },
};

function normalizeSnackbar(input, fallbackTone = 'info') {
  if (typeof input === 'string') {
    return { title: input, tone: fallbackTone };
  }

  return {
    id: input?.id,
    title: input?.title || input?.message || '',
    description: input?.description || '',
    tone: input?.tone || input?.type || fallbackTone,
    duration: input?.duration,
    action: input?.action && typeof input.action.onClick === 'function' ? input.action : null,
    dismissible: input?.dismissible !== false,
    onDismiss: typeof input?.onDismiss === 'function' ? input.onDismiss : null,
  };
}

export function SnackbarProvider({ children }) {
  const [snackbars, setSnackbars] = useState([]);
  const timersRef = useRef(new Map());

  const clearTimer = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissSnackbar = useCallback((id) => {
    clearTimer(id);
    setSnackbars((previous) => previous.filter((snackbar) => snackbar.id !== id));
  }, [clearTimer]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const showSnackbar = useCallback((input, fallbackTone = 'info') => {
    const normalized = normalizeSnackbar(input, fallbackTone);
    if (!normalized.title) return null;

    // A fixed id replaces the earlier snackbar with the same id, so repeated
    // signals (update ready, offline) never stack up.
    const id = normalized.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const snackbar = {
      id,
      tone: toneStyles[normalized.tone] ? normalized.tone : 'info',
      title: normalized.title,
      description: normalized.description,
      action: normalized.action,
      dismissible: normalized.dismissible,
      onDismiss: normalized.onDismiss,
    };

    clearTimer(id);
    setSnackbars((previous) => [...previous.filter((item) => item.id !== id).slice(-2), snackbar]);

    const duration = normalized.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      timersRef.current.set(id, window.setTimeout(() => dismissSnackbar(id), duration));
    }

    return id;
  }, [clearTimer, dismissSnackbar]);

  const value = useMemo(() => ({
    dismissSnackbar,
    showSnackbar,
    showInfo: (input) => showSnackbar(input, 'info'),
    showSuccess: (input) => showSnackbar(input, 'success'),
    showError: (input) => showSnackbar(input, 'error'),
  }), [dismissSnackbar, showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div
        className="snackbar-region pointer-events-none fixed inset-x-3 z-[100] flex flex-col items-stretch gap-2 md:inset-x-auto md:right-4 md:top-4 md:w-full md:max-w-sm md:items-end"
        aria-live="polite"
      >
        {snackbars.map((snackbar) => {
          const styles = toneStyles[snackbar.tone] || toneStyles.info;
          const Icon = styles.Icon;

          return (
            <div
              key={snackbar.id}
              className={`snackbar-enter pointer-events-auto flex w-full items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${styles.container}`}
              role={snackbar.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon className={`h-5 w-5 shrink-0 ${styles.icon}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{snackbar.title}</p>
                {snackbar.description ? (
                  <p className="mt-0.5 text-xs leading-5 text-secondary-500 dark:text-secondary-300">{snackbar.description}</p>
                ) : null}
              </div>
              {snackbar.action ? (
                <button
                  type="button"
                  className="min-h-[40px] shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition active:scale-95"
                  onClick={() => {
                    dismissSnackbar(snackbar.id);
                    snackbar.action.onClick();
                  }}
                >
                  {snackbar.action.label}
                </button>
              ) : null}
              {snackbar.dismissible ? (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-secondary-400 transition hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  onClick={() => {
                    dismissSnackbar(snackbar.id);
                    snackbar.onDismiss?.();
                  }}
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }

  return context;
}
