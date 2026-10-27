import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import { formatMoney, toNumber } from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

/**
 * Note + extras + quantity for one menu item before it is added to the order.
 * onSubmit({ quantity, note, extras: [{ name, price }] })
 */
export default function ItemOptionsDialog({ isOpen, product, onClose, onSubmit, submitting = false }) {
  const tr = useTr();
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [extras, setExtras] = useState([]);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setQuantity(1);
    setNote('');
    setExtras([]);
    setExtraName('');
    setExtraPrice('');
  }, [isOpen, product?.id]);

  const addExtra = () => {
    const name = extraName.trim();
    if (!name) return;
    setExtras((previous) => [...previous, { name, price: toNumber(extraPrice) }]);
    setExtraName('');
    setExtraPrice('');
  };

  const extrasTotal = extras.reduce((sum, extra) => sum + extra.price, 0);
  const lineTotal = (toNumber(product?.price) + extrasTotal) * quantity;

  const handleSubmit = (event) => {
    event?.preventDefault();
    if (!product || submitting) return;
    // Fold a half-typed extra in so it is not silently lost.
    const pendingExtra = extraName.trim()
      ? [...extras, { name: extraName.trim(), price: toNumber(extraPrice) }]
      : extras;
    onSubmit?.({ quantity, note: note.trim(), extras: pendingExtra });
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={product?.name || tr('restaurant.order.itemOptions', 'Item options')}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            {tr('common.cancel', 'Cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting || !product}>
            {tr('restaurant.order.addToOrder', 'Add to order')} · {formatMoney(lineTotal)}
          </button>
        </>
      )}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <p className="label">{tr('restaurant.order.quantity', 'Quantity')}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-secondary h-12 w-12 justify-center"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              aria-label="-"
            >
              <Minus size={18} />
            </button>
            <span className="min-w-10 text-center text-2xl font-bold">{quantity}</span>
            <button
              type="button"
              className="btn-secondary h-12 w-12 justify-center"
              onClick={() => setQuantity((value) => value + 1)}
              aria-label="+"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="restaurant-item-note">
            {tr('restaurant.order.note', 'Note for kitchen')}
          </label>
          <textarea
            id="restaurant-item-note"
            className="input min-h-[80px]"
            value={note}
            maxLength={200}
            placeholder={tr('restaurant.order.notePlaceholder', 'e.g. no onion, extra spicy')}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div>
          <p className="label">{tr('restaurant.order.extras', 'Extras')}</p>
          {extras.length > 0 ? (
            <ul className="mb-2 space-y-1">
              {extras.map((extra, index) => (
                <li
                  key={`${extra.name}-${index}`}
                  className="flex items-center justify-between rounded-xl bg-secondary-50 px-3 py-2 text-sm"
                >
                  <span>
                    + {extra.name}
                    {extra.price ? <span className="ml-2 text-secondary-500">{formatMoney(extra.price)}</span> : null}
                  </span>
                  <button
                    type="button"
                    className="text-rose-600"
                    onClick={() => setExtras((previous) => previous.filter((_, i) => i !== index))}
                    aria-label={tr('common.delete', 'Delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              className="input min-w-0 flex-1"
              value={extraName}
              placeholder={tr('restaurant.order.extraName', 'Extra (e.g. cheese)')}
              onChange={(event) => setExtraName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addExtra();
                }
              }}
            />
            <input
              className="input w-24"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={extraPrice}
              placeholder="0"
              onChange={(event) => setExtraPrice(event.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={addExtra}>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
