import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const SnackbarContext = createContext(null);
const DEFAULT_DURATION = 4000;

const toneStyles = {
  info: {
    container: 'border-sky-200 bg-white text-slate-800 shadow-sky-100/60 dark:border-sky-400/30 dark:bg-slate-900 dark:text-slate-100',
    icon: 'text-sky-600 dark:text-sky-300',
    Icon: Info,
  },
  success: {
    container: 'border-emerald-200 bg-white text-slate-800 shadow-emerald-100/60 dark:border-emerald-400/30 dark:bg-slate-900 dark:text-slate-100',
    icon: 'text-emerald-600 dark:text-emerald-300',
    Icon: CheckCircle2,
  },
  error: {
    container: 'border-rose-200 bg-white text-slate-800 shadow-rose-100/60 dark:border-rose-400/30 dark:bg-slate-900 dark:text-slate-100',
    icon: 'text-rose-600 dark:text-rose-300',
    Icon: AlertCircle,
  },
};

function normalizeSnackbar(input, fallbackTone = 'info') {
  if (typeof input === 'string') {
    return { title: input, tone: fallbackTone };
  }

  return {
    title: input?.title || input?.message || '',
    description: input?.description || '',
    tone: input?.tone || input?.type || fallbackTone,
    duration: input?.duration,
  };
}

export function SnackbarProvider({ children }) {
  const [snackbars, setSnackbars] = useState([]);

  const dismissSnackbar = useCallback((id) => {
    setSnackbars((previous) => previous.filter((snackbar) => snackbar.id !== id));
  }, []);

  const showSnackbar = useCallback((input, fallbackTone = 'info') => {
    const normalized = normalizeSnackbar(input, fallbackTone);
    if (!normalized.title) return null;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const snackbar = {
      id,
      tone: toneStyles[normalized.tone] ? normalized.tone : 'info',
      title: normalized.title,
      description: normalized.description,
    };

    setSnackbars((previous) => [...previous.slice(-2), snackbar]);

    const duration = normalized.duration ?? DEFAULT_DURATION;
    if (duration > 0) {
      window.setTimeout(() => dismissSnackbar(id), duration);
    }

    return id;
  }, [dismissSnackbar]);

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
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {snackbars.map((snackbar) => {
          const styles = toneStyles[snackbar.tone] || toneStyles.info;
          const Icon = styles.Icon;

          return (
            <div
              key={snackbar.id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${styles.container}`}
              role={snackbar.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-5">{snackbar.title}</p>
                {snackbar.description ? (
                  <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-300">{snackbar.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => dismissSnackbar(snackbar.id)}
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
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
