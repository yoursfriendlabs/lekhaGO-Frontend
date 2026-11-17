import { Link } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { formatMoney } from '@/lib/money/formatting';
import { Badge } from '@/components/ui/Badge';
import { displayDate, shiftTimeLabel, STATUS_BADGE, toNumber } from '@/lib/students/utils';

/** One enrollment: course, dates, shifts, fees and the actions on it. */
export default function EnrollmentCard({
  enrollment,
  canManage = false,
  onCollect,
  onChangeShifts,
  onChangeEndDate,
  onComplete,
  onDrop,
}) {
  const { t } = useI18n();
  const fees = enrollment?.fees || {};
  const due = toNumber(fees.due);
  const isActive = enrollment?.status === 'active';
  const shifts = Array.isArray(enrollment?.shifts) ? enrollment.shifts : [];
  const bills = Array.isArray(fees.bills) ? fees.bills : [];

  return (
    <article className="rounded-2xl border border-secondary-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-ink">{enrollment?.course?.name || '—'}</h4>
          <p className="text-xs text-secondary-500">
            {[enrollment?.course?.code, enrollment?.course?.durationLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Badge size="sm" variant={STATUS_BADGE[enrollment?.status] || 'default'}>
          {t(`students.status.${enrollment?.status || 'active'}`)}
        </Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.enrollment.dates')}</dt>
          <dd className="text-secondary-700">{displayDate(enrollment?.startDate)} – {displayDate(enrollment?.endDate)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.enrollment.shifts')}</dt>
          <dd className="text-secondary-700">
            {shifts.length
              ? shifts.map((shift) => [shift.name, shiftTimeLabel(shift)].filter(Boolean).join(' ')).join(', ')
              : t('students.enrollment.noShifts')}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-secondary-50 p-3 text-center dark:bg-slate-800/60">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.enrollment.billed')}</p>
          <p className="font-semibold tabular-nums text-ink">{formatMoney(t, fees.billed)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.enrollment.paid')}</p>
          <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatMoney(t, fees.paid)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-secondary-400">{t('students.enrollment.due')}</p>
          <p className={`font-semibold tabular-nums ${due > 0 ? 'text-rose-600' : 'text-secondary-500'}`}>{formatMoney(t, due)}</p>
        </div>
      </div>

      {bills.length ? (
        <p className="mt-2 text-xs text-secondary-500">
          {t('students.enrollment.viewBill')}:{' '}
          {bills.map((bill, index) => (
            <span key={bill.id}>
              {index > 0 ? ', ' : ''}
              <Link
                className="font-semibold text-primary hover:underline"
                to="/app/services?courseFees=only"
              >
                {bill.orderNo || bill.id}
              </Link>
              {bill.isCancelled ? ` (${t('students.status.dropped')})` : ''}
            </span>
          ))}
        </p>
      ) : null}

      {enrollment?.notes ? <p className="mt-2 text-xs text-secondary-500">{enrollment.notes}</p> : null}

      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {due > 0 ? (
            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => onCollect?.(enrollment)}>
              {t('students.enrollment.collectFee')}
            </button>
          ) : null}
          {isActive ? (
            <>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onChangeShifts?.(enrollment)}>
                {t('students.enrollment.changeShifts')}
              </button>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => onChangeEndDate?.(enrollment)}>
                {t('students.enrollment.changeEndDate')}
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => onComplete?.(enrollment)}>
                {t('students.enrollment.complete')}
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-rose-600" onClick={() => onDrop?.(enrollment)}>
                {t('students.enrollment.drop')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
