import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice.jsx';
import { api } from '@/lib/api';
import { extractConflictIds } from '@/lib/business/hospitality';
import { useTr } from '@/lib/restaurant/useTr';

const OFF_FLOOR_CHANNELS = ['takeaway', 'delivery'];

/**
 * Opens a new restaurant order. With a `table` it is a dine-in order for that
 * table; without one the staff picks takeaway or delivery.
 * onCreated(order) and onOpenExisting(orderId) are provided by the floor page.
 */
export default function OpenOrderDialog({ isOpen, table = null, onClose, onCreated, onOpenExisting }) {
  const tr = useTr();
  const [guests, setGuests] = useState('2');
  const [channel, setChannel] = useState('takeaway');
  const [waiterName, setWaiterName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflictOrderId, setConflictOrderId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setGuests('2');
    setChannel('takeaway');
    setWaiterName('');
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setBusy(false);
    setError('');
    setConflictOrderId('');
  }, [isOpen, table?.id]);

  const isDineIn = Boolean(table);
  const effectiveChannel = isDineIn ? 'dine_in' : channel;

  const handleSubmit = async (event) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setConflictOrderId('');

    const payload = { channel: effectiveChannel };
    if (isDineIn) payload.tableId = table.id;
    const guestCount = Number(guests);
    if (isDineIn && Number.isFinite(guestCount) && guestCount > 0) payload.guests = Math.floor(guestCount);
    if (waiterName.trim()) payload.waiterName = waiterName.trim();
    if (!isDineIn) {
      if (customerName.trim()) payload.customerName = customerName.trim();
      if (customerPhone.trim()) payload.customerPhone = customerPhone.trim();
      if (channel === 'delivery' && deliveryAddress.trim()) payload.deliveryAddress = deliveryAddress.trim();
    }

    try {
      const created = await api.createRestaurantOrder(payload);
      onCreated?.(created);
    } catch (err) {
      const conflict = extractConflictIds(err);
      setError(conflict.message);
      const payloadBody = err?.payload && typeof err.payload === 'object' ? err.payload : {};
      const existingId = conflict.orderId
        ?? payloadBody.existingOrderId
        ?? payloadBody.order?.id
        ?? payloadBody.details?.orderId
        ?? payloadBody.data?.orderId
        ?? null;
      if (err?.status === 409 && existingId) setConflictOrderId(String(existingId));
      setBusy(false);
    }
  };

  const title = isDineIn
    ? tr('restaurant.floor.openTable', 'Open {table}', { table: table.name })
    : tr('restaurant.floor.newOffFloor', 'New takeaway / delivery');

  return (
    <Dialog
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            {tr('common.cancel', 'Cancel')}
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? tr('common.loading', 'Loading...') : tr('restaurant.floor.openOrder', 'Open order')}
          </button>
        </>
      )}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="space-y-2">
            <Notice tone="error" title={error} />
            {conflictOrderId ? (
              <button
                type="button"
                className="btn-primary w-full justify-center"
                onClick={() => onOpenExisting?.(conflictOrderId)}
              >
                {tr('restaurant.floor.openExisting', 'Open that order')}
              </button>
            ) : null}
          </div>
        ) : null}

        {!isDineIn ? (
          <div>
            <p className="label">{tr('restaurant.floor.channel', 'Order type')}</p>
            <div className="grid grid-cols-2 gap-2">
              {OFF_FLOOR_CHANNELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChannel(value)}
                  className={`min-h-12 rounded-2xl border px-3 text-sm font-bold transition ${
                    channel === value
                      ? 'border-primary bg-primary text-white'
                      : 'border-secondary-200 bg-white text-ink-light hover:border-primary/40'
                  }`}
                >
                  {value === 'takeaway'
                    ? tr('restaurant.channel.takeaway', 'Takeaway')
                    : tr('restaurant.channel.delivery', 'Delivery')}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="restaurant-guests">{tr('restaurant.floor.guests', 'Guests')}</label>
              <input
                id="restaurant-guests"
                className="input"
                type="number"
                min="1"
                inputMode="numeric"
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
              />
            </div>
            <div>
              <p className="label">{tr('restaurant.floor.channel', 'Order type')}</p>
              <div className="input flex items-center bg-secondary-50 font-semibold">
                {tr('restaurant.channel.dine_in', 'Dine in')}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="restaurant-waiter">
            {tr('restaurant.floor.waiter', 'Waiter (optional)')}
          </label>
          <input
            id="restaurant-waiter"
            className="input"
            value={waiterName}
            onChange={(event) => setWaiterName(event.target.value)}
          />
        </div>

        {!isDineIn ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="restaurant-customer">
                  {tr('restaurant.floor.customerName', 'Customer name (optional)')}
                </label>
                <input
                  id="restaurant-customer"
                  className="input"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="restaurant-phone">
                  {tr('restaurant.floor.customerPhone', 'Phone (optional)')}
                </label>
                <input
                  id="restaurant-phone"
                  className="input"
                  type="tel"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                />
              </div>
            </div>
            {channel === 'delivery' ? (
              <div>
                <label className="label" htmlFor="restaurant-address">
                  {tr('restaurant.floor.deliveryAddress', 'Delivery address')}
                </label>
                <input
                  id="restaurant-address"
                  className="input"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </form>
    </Dialog>
  );
}
