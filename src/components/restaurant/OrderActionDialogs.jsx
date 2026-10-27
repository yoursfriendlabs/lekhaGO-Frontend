import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice.jsx';
import { api } from '@/lib/api';
import { pickBackendMessage } from '@/lib/business/hospitality';
import { formatMoney, normalizeFloor, toNumber } from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

/** Shared footer + error handling for the small order action dialogs. */
function useActionState(isOpen) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isOpen) {
      setBusy(false);
      setError('');
    }
  }, [isOpen]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(pickBackendMessage(err));
      setBusy(false);
    }
  };

  return { busy, error, run };
}

function useFloorSnapshot(isOpen) {
  const [floor, setFloor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    api
      .getRestaurantFloor({}, { force: true })
      .then((payload) => {
        if (active) setFloor(normalizeFloor(payload));
      })
      .catch((err) => {
        if (active) setError(pickBackendMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  return { floor, loading, error };
}

function Footer({ onClose, onConfirm, busy, disabled, confirmLabel, tone = 'primary' }) {
  const tr = useTr();
  return (
    <>
      <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
        {tr('common.cancel', 'Cancel')}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || disabled}
        className={
          tone === 'danger'
            ? 'rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60'
            : 'btn-primary disabled:opacity-60'
        }
      >
        {busy ? tr('common.loading', 'Loading...') : confirmLabel}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function MoveOrderDialog({ isOpen, order, onClose, onDone }) {
  const tr = useTr();
  const { floor, loading, error: loadError } = useFloorSnapshot(isOpen);
  const { busy, error, run } = useActionState(isOpen);
  const [tableId, setTableId] = useState('');

  useEffect(() => {
    if (isOpen) setTableId('');
  }, [isOpen]);

  const vacant = (floor?.tables || []).filter((table) => !table.order);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={tr('restaurant.order.move', 'Move to another table')}
      size="md"
      footer={(
        <Footer
          onClose={onClose}
          busy={busy}
          disabled={!tableId}
          confirmLabel={tr('restaurant.order.moveConfirm', 'Move')}
          onConfirm={() => run(async () => {
            await api.moveRestaurantOrder(order.id, { tableId });
            await onDone?.();
          })}
        />
      )}
    >
      <div className="space-y-3">
        {error || loadError ? <Notice tone="error" title={error || loadError} /> : null}
        {loading ? <p className="text-sm text-secondary-500">{tr('common.loading', 'Loading...')}</p> : null}
        {!loading && vacant.length === 0 && !loadError ? (
          <p className="text-sm text-secondary-500">{tr('restaurant.order.noVacant', 'No vacant tables.')}</p>
        ) : null}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {vacant.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setTableId(table.id)}
              className={`min-h-14 rounded-2xl border px-2 text-sm font-bold transition ${
                tableId === table.id
                  ? 'border-primary bg-primary text-white'
                  : 'border-secondary-200 bg-white text-ink hover:border-primary/40'
              }`}
            >
              {table.name}
              {table.category ? <span className="block text-[10px] font-normal opacity-70">{table.category}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function MergeOrderDialog({ isOpen, order, onClose, onDone }) {
  const tr = useTr();
  const { floor, loading, error: loadError } = useFloorSnapshot(isOpen);
  const { busy, error, run } = useActionState(isOpen);
  const [sourceId, setSourceId] = useState('');

  useEffect(() => {
    if (isOpen) setSourceId('');
  }, [isOpen]);

  const candidates = (floor?.orders || []).filter((candidate) => candidate.id && candidate.id !== order?.id);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={tr('restaurant.order.merge', 'Merge another order into this one')}
      size="md"
      footer={(
        <Footer
          onClose={onClose}
          busy={busy}
          disabled={!sourceId}
          confirmLabel={tr('restaurant.order.mergeConfirm', 'Merge')}
          onConfirm={() => run(async () => {
            await api.mergeRestaurantOrders(order.id, { sourceOrderId: sourceId });
            await onDone?.();
          })}
        />
      )}
    >
      <div className="space-y-3">
        {error || loadError ? <Notice tone="error" title={error || loadError} /> : null}
        {loading ? <p className="text-sm text-secondary-500">{tr('common.loading', 'Loading...')}</p> : null}
        {!loading && candidates.length === 0 && !loadError ? (
          <p className="text-sm text-secondary-500">
            {tr('restaurant.order.noMergeCandidates', 'There are no other open orders.')}
          </p>
        ) : null}
        <ul className="space-y-2">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                onClick={() => setSourceId(candidate.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  sourceId === candidate.id
                    ? 'border-primary bg-primary/10'
                    : 'border-secondary-200 bg-white hover:border-primary/40'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {candidate.tableName || tr(`restaurant.channel.${candidate.channel}`, candidate.channel)}
                    {' · #'}
                    {candidate.orderNo || candidate.id.slice(-4)}
                  </span>
                  {candidate.customerName ? (
                    <span className="block truncate text-xs text-secondary-500">{candidate.customerName}</span>
                  ) : null}
                </span>
                <span className="text-sm font-bold">{formatMoney(candidate.runningTotal)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function DiscountDialog({ isOpen, order, onClose, onDone }) {
  const tr = useTr();
  const { busy, error, run } = useActionState(isOpen);
  const [mode, setMode] = useState('amount');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!isOpen || !order) return;
    const usePercent = order.discountPercent > 0 && !(order.discountAmount > 0);
    setMode(usePercent ? 'percent' : 'amount');
    setValue(usePercent ? String(order.discountPercent) : order.discountAmount > 0 ? String(order.discountAmount) : '');
  }, [isOpen, order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = Math.max(0, toNumber(value));
  const invalid = mode === 'percent' && amount > 100;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={tr('restaurant.order.discount', 'Discount')}
      size="sm"
      footer={(
        <Footer
          onClose={onClose}
          busy={busy}
          disabled={invalid}
          confirmLabel={tr('common.save', 'Save')}
          onConfirm={() => run(async () => {
            await api.updateRestaurantOrder(order.id, mode === 'percent'
              ? { discountPercent: amount }
              : { discount: amount });
            await onDone?.();
          })}
        />
      )}
    >
      <div className="space-y-3">
        {error ? <Notice tone="error" title={error} /> : null}
        <div className="grid grid-cols-2 gap-2">
          {['amount', 'percent'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`min-h-11 rounded-2xl border px-3 text-sm font-semibold transition ${
                mode === option
                  ? 'border-primary bg-primary text-white'
                  : 'border-secondary-200 bg-white text-ink-light hover:border-primary/40'
              }`}
            >
              {option === 'amount' ? tr('restaurant.order.discountAmount', 'Amount') : tr('restaurant.order.discountPercent', 'Percent')}
            </button>
          ))}
        </div>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          autoFocus
          value={value}
          placeholder="0"
          onChange={(event) => setValue(event.target.value)}
        />
        {invalid ? (
          <p className="text-xs font-semibold text-rose-600">
            {tr('restaurant.order.discountMax', 'Percent cannot exceed 100.')}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function CancelOrderDialog({ isOpen, order, onClose, onDone }) {
  const tr = useTr();
  const { busy, error, run } = useActionState(isOpen);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) setReason('');
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={tr('restaurant.order.cancel', 'Cancel order')}
      size="sm"
      footer={(
        <Footer
          onClose={onClose}
          busy={busy}
          tone="danger"
          confirmLabel={tr('restaurant.order.cancelConfirm', 'Cancel order')}
          onConfirm={() => run(async () => {
            await api.cancelRestaurantOrder(order.id, reason.trim() ? { reason: reason.trim() } : {});
            await onDone?.();
          })}
        />
      )}
    >
      <div className="space-y-3">
        {error ? <Notice tone="error" title={error} /> : null}
        <p className="text-sm text-secondary-700">
          {tr('restaurant.order.cancelHint', 'This closes the order without creating a sale and frees the table.')}
        </p>
        <label className="label" htmlFor="restaurant-cancel-reason">
          {tr('restaurant.order.cancelReason', 'Reason (optional)')}
        </label>
        <input
          id="restaurant-cancel-reason"
          className="input"
          value={reason}
          maxLength={200}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </Dialog>
  );
}
