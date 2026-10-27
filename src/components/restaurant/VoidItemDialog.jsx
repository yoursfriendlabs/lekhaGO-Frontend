import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice.jsx';
import { ITEM_STATUS, VOID_REASONS } from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

/**
 * Void a sent item. onConfirm({ reason, reasonCode, note, wasPrepared }) must
 * return a promise; a rejected promise keeps the dialog open and shows
 * the backend message as-is.
 */
export default function VoidItemDialog({ isOpen, item, onClose, onConfirm }) {
  const tr = useTr();
  const [reasonCode, setReasonCode] = useState('');
  const [otherText, setOtherText] = useState('');
  const [wasPrepared, setWasPrepared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setReasonCode('');
    setOtherText('');
    setError('');
    setBusy(false);
    setWasPrepared([ITEM_STATUS.PREPARING, ITEM_STATUS.READY, ITEM_STATUS.SERVED].includes(item?.status));
  }, [isOpen, item?.id, item?.status]);

  const reasonLabel = (reason) => tr(`restaurant.void.reason.${reason.code}`, reason.fallback);
  const selected = VOID_REASONS.find((reason) => reason.code === reasonCode);
  const otherMissing = reasonCode === 'other' && !otherText.trim();
  const canSubmit = Boolean(selected) && !otherMissing && !busy;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      await onConfirm({
        reasonCode,
        reason: reasonCode === 'other' ? otherText.trim() : reasonLabel(selected),
        note: reasonCode === 'other' ? otherText.trim() : '',
        wasPrepared,
      });
    } catch (err) {
      setError(err?.payload?.message || err?.message || tr('common.error', 'Something went wrong'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={tr('restaurant.void.title', 'Void item')}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {tr('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleConfirm}
            disabled={!canSubmit}
          >
            {busy ? tr('common.loading', 'Loading...') : tr('restaurant.void.confirm', 'Void item')}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {item ? (
          <p className="text-sm font-semibold text-ink">
            {Number(item.quantity)}&times; {item.name}
          </p>
        ) : null}
        {error ? <Notice tone="error" title={error} /> : null}

        <fieldset className="space-y-2">
          <legend className="label">{tr('restaurant.void.reason', 'Reason')}</legend>
          {VOID_REASONS.map((reason) => (
            <label
              key={reason.code}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border px-4 text-sm font-medium transition ${
                reasonCode === reason.code
                  ? 'border-primary bg-primary/10 text-ink'
                  : 'border-secondary-200 bg-white text-ink-light hover:border-primary/40'
              }`}
            >
              <input
                type="radio"
                name="void-reason"
                value={reason.code}
                checked={reasonCode === reason.code}
                onChange={() => setReasonCode(reason.code)}
              />
              {reasonLabel(reason)}
            </label>
          ))}
        </fieldset>

        {reasonCode === 'other' ? (
          <input
            className="input"
            value={otherText}
            maxLength={200}
            autoFocus
            placeholder={tr('restaurant.void.otherPlaceholder', 'Describe the reason')}
            onChange={(event) => setOtherText(event.target.value)}
          />
        ) : null}

        <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-2xl border border-secondary-200 bg-white px-4 text-sm font-medium">
          <span>
            {tr('restaurant.void.wasPrepared', 'Food was already prepared')}
            <span className="block text-xs font-normal text-secondary-500">
              {tr('restaurant.void.wasPreparedHint', 'Counts as waste and deducts stock.')}
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={wasPrepared}
            onChange={(event) => setWasPrepared(event.target.checked)}
          />
        </label>
      </div>
    </Dialog>
  );
}
