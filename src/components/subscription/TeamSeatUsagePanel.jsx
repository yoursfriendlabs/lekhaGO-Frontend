import { TriangleAlert, Users } from 'lucide-react';
import { humanizeKey } from '../../lib/subscription';

function StatTile({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/60">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

export default function TeamSeatUsagePanel({
  summary,
  staffing,
  loading = false,
  t,
}) {
  const seatLimit = staffing?.seatLimit ?? summary?.maxUsers ?? 0;
  const pricingModel = staffing?.pricingModel ? humanizeKey(staffing.pricingModel) : '';
  const usedSeats = summary?.totalUsers ?? 0;
  const availableSeats = summary?.availableSlots ?? 0;
  const isNearCapacity = !loading && usedSeats > 0 && availableSeats <= 1;
  const isFull = !loading && seatLimit > 0 && availableSeats === 0;

  return <h1></h1>;
}
