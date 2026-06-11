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

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300">
            <Users size={16} />
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">{t('tasks.seats.eyebrow')}</p>
          </div>
          <h3 className="mt-2 font-serif text-xl text-slate-900 dark:text-white">{t('tasks.seats.title')}</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('tasks.seats.subtitle')}</p>
        </div>

        {(isNearCapacity || pricingModel) ? (
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${
            isFull
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }`}>
            <TriangleAlert size={14} />
            {isFull
              ? t('tasks.seats.noSeatsLeft')
              : pricingModel
                ? t('tasks.seats.pricingModel', { model: pricingModel })
                : t('tasks.seats.nearCapacity')}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatTile
          label={t('tasks.seats.used')}
          value={loading ? '...' : seatLimit > 0 ? `${usedSeats} / ${seatLimit}` : String(usedSeats)}
          hint={t('tasks.seats.usedHint')}
        />
        <StatTile
          label={t('tasks.seats.available')}
          value={loading ? '...' : String(availableSeats)}
          hint={t('tasks.seats.availableHint')}
        />
        <StatTile
          label={t('tasks.seats.limit')}
          value={loading ? '...' : seatLimit > 0 ? String(seatLimit) : t('tasks.seats.flexible')}
          hint={pricingModel
            ? t('tasks.seats.limitHintWithModel', { model: pricingModel })
            : t('tasks.seats.limitHint')}
        />
      </div>

      {isNearCapacity ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-200">
          {isFull ? t('tasks.seats.fullHint') : t('tasks.seats.upgradeHint')}
        </p>
      ) : null}
    </section>
  );
}
