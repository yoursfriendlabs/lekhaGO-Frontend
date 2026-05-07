import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../lib/i18n.jsx';
import { Dialog } from './Dialog.tsx';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirming = false,
}) {
  const { t } = useI18n();

  const handleClose = () => {
    if (confirming) return;
    onClose();
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (confirming) return;
    await onConfirm?.();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={title || t('common.delete')}
      size="sm"
      showCloseButton={!confirming}
      closeOnOverlayClick={!confirming}
      footer={(
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={handleClose} disabled={confirming}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            type="button"
            className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? t('common.loading') : confirmLabel || t('common.delete')}
          </button>
        </>
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
          <AlertTriangle size={18} />
        </div>
        <p className="pt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {description || t('common.confirmDelete')}
        </p>
      </div>
    </Dialog>
  );
}
