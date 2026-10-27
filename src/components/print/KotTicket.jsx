const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function channelLabel(channel) {
  const value = String(channel || '').toLowerCase();
  if (value === 'takeaway' || value === 'take_away' || value === 'pickup') return 'TAKEAWAY';
  if (value === 'delivery') return 'DELIVERY';
  return '';
}

/**
 * Kitchen order ticket for 80mm thermal printers. Never shows prices.
 * items: [{ name, quantity, note, extras: [{ name }] }]
 */
export default function KotTicket({
  tableName = '',
  orderNo = '',
  kotNo = '',
  time = '',
  waiter = '',
  channel = '',
  guests = null,
  items = [],
  reprint = false,
}) {
  const channelText = channelLabel(channel);
  const heading = tableName || channelText || 'ORDER';

  return (
    <div
      className="w-full bg-white p-1 text-left text-black select-none"
      style={{ fontFamily: MONO, fontSize: '13px', lineHeight: '1.4' }}
    >
      <div className="text-center text-sm font-bold uppercase tracking-widest">
        Kitchen Order{reprint ? ' (Reprint)' : ''}
      </div>
      <div className="my-1 text-center text-2xl font-black uppercase">{heading}</div>
      {tableName && channelText ? (
        <div className="text-center text-xs font-bold">{channelText}</div>
      ) : null}

      <div className="my-2 border-t border-dashed border-black" />

      <div className="space-y-0.5 text-[12px]">
        <div className="flex justify-between font-bold">
          <span>KOT #{kotNo || '-'}</span>
          <span>{time}</span>
        </div>
        {orderNo ? <div>Order: #{orderNo}</div> : null}
        {waiter ? <div>Waiter: {waiter}</div> : null}
        {guests ? <div>Guests: {guests}</div> : null}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={item.id || index}>
            <div className="flex items-start gap-2 text-[15px] font-bold">
              <span className="shrink-0">{Number(item.quantity || 0)}&times;</span>
              <span className="min-w-0 break-words">{item.name}</span>
            </div>
            {(item.extras || []).map((extra, extraIndex) => (
              <div key={extraIndex} className="pl-6 text-[12px]">
                + {extra.name || extra}
              </div>
            ))}
            {item.note ? (
              <div className="pl-6 text-[12px] font-semibold italic">** {item.note}</div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center text-[11px]">- - - end of ticket - - -</div>
    </div>
  );
}
