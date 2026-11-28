import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const CLOSE_DRAG_DISTANCE = 96;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openSheetCount = 0;

function lockBodyScroll() {
  openSheetCount += 1;
  if (openSheetCount === 1) document.body.classList.add('sheet-open');
}

function unlockBodyScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) document.body.classList.remove('sheet-open');
}

/**
 * Phone-style sheet that slides up from the bottom. Close it by tapping the
 * backdrop, pressing Escape, the close button, or dragging the handle down.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  description,
  closeLabel = 'Close',
  headerAction = null,
  children,
  className = '',
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dragStartRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBodyScroll();
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true });
    }, 30);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      setDragOffset(0);
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const handleDragStart = (event) => {
    dragStartRef.current = event.touches[0].clientY;
  };
  const handleDragMove = (event) => {
    if (dragStartRef.current === null) return;
    setDragOffset(Math.max(0, event.touches[0].clientY - dragStartRef.current));
  };
  const handleDragEnd = () => {
    const shouldClose = dragOffset > CLOSE_DRAG_DISTANCE;
    dragStartRef.current = null;
    setDragOffset(0);
    if (shouldClose) onCloseRef.current?.();
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        className="sheet-backdrop absolute inset-0 h-full w-full cursor-default bg-slate-950/45"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={() => onCloseRef.current?.()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`sheet-panel relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-2xl outline-none md:max-h-[80vh] md:max-w-lg md:rounded-3xl ${className}`}
        style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined}
      >
        <div
          className="shrink-0 touch-none px-5 pt-2"
          onTouchStart={handleDragStart}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
          onTouchCancel={handleDragEnd}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-secondary-300 md:hidden" aria-hidden />
          {title ? (
            <div className="flex items-start justify-between gap-3 pb-3">
              <div className="min-w-0 pt-1">
                <h2 id={titleId} className="font-serif text-lg font-semibold text-ink">{title}</h2>
                {description ? <p className="mt-0.5 text-sm text-secondary-500">{description}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {headerAction}
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-secondary-500 transition hover:bg-secondary-100 active:scale-95"
                  onClick={() => onCloseRef.current?.()}
                  aria-label={closeLabel}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
