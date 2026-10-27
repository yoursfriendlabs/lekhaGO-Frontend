import { useI18n } from '@/lib/i18n.jsx';
import {
  HOUSEKEEPING,
  OCCUPANCY,
  STAY_STATUS_LABELS,
  STAY_STATUS_TONES,
  tx,
} from '@/lib/hotel/hotelUtils';

export const OCCUPANCY_STYLES = {
  [OCCUPANCY.OCCUPIED]: {
    tile: 'border-amber-300 bg-amber-50/70 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    key: 'hotel.occupancy.occupied',
    label: 'Occupied',
  },
  [OCCUPANCY.RESERVED]: {
    tile: 'border-sky-300 bg-sky-50/70 hover:border-sky-400',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    key: 'hotel.occupancy.reserved',
    label: 'Reserved',
  },
  [OCCUPANCY.VACANT]: {
    tile: 'border-emerald-200 bg-white hover:border-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    key: 'hotel.occupancy.vacant',
    label: 'Vacant',
  },
  [OCCUPANCY.OUT_OF_ORDER]: {
    tile: 'border-rose-200 bg-rose-50/50 opacity-80',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    key: 'hotel.occupancy.outOfOrder',
    label: 'Out of order',
  },
};

export const HOUSEKEEPING_STYLES = {
  [HOUSEKEEPING.CLEAN]: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    key: 'hotel.housekeeping.clean',
    label: 'Clean',
  },
  [HOUSEKEEPING.DIRTY]: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    key: 'hotel.housekeeping.dirty',
    label: 'Dirty',
  },
  [HOUSEKEEPING.INSPECTED]: {
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    key: 'hotel.housekeeping.inspected',
    label: 'Inspected',
  },
  [HOUSEKEEPING.OUT_OF_ORDER]: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    key: 'hotel.housekeeping.outOfOrder',
    label: 'Out of order',
  },
};

export function OccupancyBadge({ status }) {
  const { t } = useI18n();
  const style = OCCUPANCY_STYLES[status] || OCCUPANCY_STYLES[OCCUPANCY.VACANT];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.badge}`}
    >
      {tx(t, style.key, style.label)}
    </span>
  );
}

export function HousekeepingDot({ status, withLabel = false }) {
  const { t } = useI18n();
  const style = HOUSEKEEPING_STYLES[status] || HOUSEKEEPING_STYLES[HOUSEKEEPING.CLEAN];
  const label = tx(t, style.key, style.label);
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-secondary-600" title={label}>
      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {withLabel ? label : <span className="sr-only">{label}</span>}
    </span>
  );
}

export function StayStatusBadge({ status }) {
  const { t } = useI18n();
  const key = String(status || '').toLowerCase();
  const [labelKey, fallback] = STAY_STATUS_LABELS[key] || ['', status || '—'];
  const tone = STAY_STATUS_TONES[key] || 'bg-secondary-100 text-secondary-600 border-secondary-200';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tone}`}
    >
      {labelKey ? tx(t, labelKey, fallback) : fallback}
    </span>
  );
}
