import { useEffect, useRef, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice';
import { useI18n } from '@/lib/i18n.jsx';

// Callers memoize load with the current workspace and filters. Late responses
// cannot replace data after a filter change, workspace switch, or unmount.
export function useStudentResource(load) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ data: null, loading: true, error: '' });
    Promise.resolve().then(load).then(
      (data) => { if (active) setState({ data, loading: false, error: '' }); },
      (error) => { if (active) setState({ data: null, loading: false, error: error.message }); },
    );
    return () => { active = false; };
  }, [load, revision]);
  return { ...state, reload: () => setRevision((value) => value + 1) };
}

export function useStudentFormat() {
  const { t } = useI18n();
  return (amount) => t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(amount || 0).toFixed(2) });
}

export function Field({ label, children, hint, className = '' }) {
  return <div className={'min-w-0 space-y-1.5 ' + className}>
    <label className="block text-sm font-medium text-secondary-700">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
    {hint && <p className="text-xs leading-5 text-secondary-500">{hint}</p>}
  </div>;
}

export function ResourceState({ resource, empty, emptyTitle, emptyDescription, children }) {
  const { t } = useI18n();
  if (resource.loading) return <p role="status" className="py-12 text-center text-sm text-secondary-500">{t('common.loading')}</p>;
  if (resource.error) return <div className="space-y-3 py-4">
    <Notice tone="error" title={resource.error} />
    <button type="button" className="btn-secondary" onClick={resource.reload}>{t('common.retry')}</button>
  </div>;
  if (empty) return <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
    <GraduationCap size={32} className="text-secondary-400" aria-hidden="true" />
    <p className="font-medium text-ink">{emptyTitle || t('common.noData')}</p>
    {emptyDescription && <p className="max-w-md text-sm text-secondary-500">{emptyDescription}</p>}
  </div>;
  return children;
}

export function StudentDialog({ title, onClose, busy = false, children, size = 'xl' }) {
  const root = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    // Include the shared dialog's header close button in the focus loop.
    const panel = root.current?.parentElement?.parentElement;
    const selectors = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]';
    panel?.querySelector('input, select, textarea, button')?.focus();
    const trap = (event) => {
      if (event.key !== 'Tab' || !panel) return;
      const controls = [...panel.querySelectorAll(selectors)].filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previousFocus?.focus?.(); };
  }, []);
  return <Dialog isOpen title={title} onClose={() => { if (!busy) onClose(); }} size={size} showCloseButton={!busy} closeOnOverlayClick={!busy}>
    <div ref={root} role="dialog" aria-modal="true" aria-label={title}>{children}</div>
  </Dialog>;
}

export function FormActions({ busy, onClose, label }) {
  const { t } = useI18n();
  return <div className="flex flex-wrap justify-end gap-2 border-t border-secondary-200 pt-4">
    <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>{t('common.cancel')}</button>
    <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('common.saving') : label || t('common.save')}</button>
  </div>;
}
