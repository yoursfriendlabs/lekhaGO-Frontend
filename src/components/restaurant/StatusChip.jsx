import { ITEM_STATUS } from '@/lib/restaurant/model';
import { useTr } from '@/lib/restaurant/useTr';

const STYLES = {
  [ITEM_STATUS.PENDING]: 'bg-secondary-100 text-secondary-700',
  [ITEM_STATUS.SENT]: 'bg-sky-100 text-sky-700',
  [ITEM_STATUS.PREPARING]: 'bg-amber-100 text-amber-700',
  [ITEM_STATUS.READY]: 'bg-emerald-100 text-emerald-700',
  [ITEM_STATUS.SERVED]: 'bg-slate-200 text-slate-600',
  [ITEM_STATUS.VOID]: 'bg-rose-100 text-rose-700',
};

const LABELS = {
  [ITEM_STATUS.PENDING]: 'Not sent',
  [ITEM_STATUS.SENT]: 'Sent',
  [ITEM_STATUS.PREPARING]: 'Preparing',
  [ITEM_STATUS.READY]: 'Ready',
  [ITEM_STATUS.SERVED]: 'Served',
  [ITEM_STATUS.VOID]: 'Void',
};

export default function StatusChip({ status, className = '' }) {
  const tr = useTr();
  const key = STYLES[status] ? status : ITEM_STATUS.PENDING;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLES[key]} ${className}`}
    >
      {tr(`restaurant.status.${key}`, LABELS[key])}
    </span>
  );
}
