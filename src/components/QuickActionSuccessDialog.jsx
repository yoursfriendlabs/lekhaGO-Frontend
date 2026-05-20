import { Check, X } from 'lucide-react';
import { Dialog } from './ui/Dialog.tsx';

export default function QuickActionSuccessDialog({
  isOpen,
  onClose,
  title,
  description,
  closeLabel = 'Close',
  primaryAction = null,
  secondaryAction = null,
}) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      showCloseButton={false}
      closeOnOverlayClick={false}
    >
      <div className="relative space-y-6 px-2 py-2 text-center">
        <button
          type="button"
          className="absolute right-0 top-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={20} />
        </button>

        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-emerald-100/70 shadow-inner ring-8 ring-emerald-50">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
            <Check size={40} strokeWidth={3} />
          </div>
        </div>

        <div>
          <h3 className="font-serif text-2xl text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {primaryAction ? primaryAction : null}
          {secondaryAction ? secondaryAction : null}
        </div>
      </div>
    </Dialog>
  );
}
