import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing, RefreshCw } from 'lucide-react';
import { useTaskNotifications } from '../../hooks/useTaskNotifications';
import { formatMaybeDateTime } from '../../lib/datetime';

function CounterPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-slate-800/70 dark:bg-slate-900/70">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function TaskNotificationsButton({ t }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { summary, loading, error, refresh, markAllRead, canViewTasks } = useTaskNotifications();
  const unreadCount = Number(summary?.unreadActivityCount || 0);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || unreadCount <= 0) return;
    markAllRead().catch(() => {});
  }, [markAllRead, open, unreadCount]);

  if (!canViewTasks) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="relative inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-2xl border border-secondary-200 bg-white px-3 py-2 text-slate-700 transition-transform active:scale-95"
        aria-label={t('tasks.notifications.open')}
        title={t('tasks.notifications.open')}
        onClick={() => setOpen((current) => !current)}
      >
        {unreadCount > 0 ? <BellRing className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(92vw,25rem)] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800/70 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/70 px-4 py-4 dark:border-slate-800/70">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{t('tasks.notifications.eyebrow')}</p>
              <h3 className="mt-1 font-serif text-lg text-slate-900 dark:text-white">{t('tasks.notifications.title')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {summary?.lastSeenAt
                  ? t('tasks.notifications.lastSeen', { date: formatMaybeDateTime(summary.lastSeenAt, 'D MMM, HH:mm') })
                  : t('tasks.notifications.lastSeenEmpty')}
              </p>
            </div>
            <button type="button" className="btn-ghost gap-2 px-3 py-2 text-xs" onClick={() => refresh({ force: true })} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {t('common.refresh')}
            </button>
          </div>

          <div className="grid gap-2 px-4 py-4 sm:grid-cols-3">
            <CounterPill label={t('tasks.notifications.assignedOpen')} value={summary?.counters?.assignedToMeOpen || 0} />
            <CounterPill label={t('tasks.notifications.assignedOverdue')} value={summary?.counters?.assignedToMeOverdue || 0} />
            <CounterPill label={t('tasks.notifications.createdOpen')} value={summary?.counters?.createdByMeOpen || 0} />
          </div>

          <div className="border-t border-slate-200/70 px-4 py-4 dark:border-slate-800/70">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('tasks.notifications.recentActivity')}</p>
              <Link className="text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300" to="/app/tasks" onClick={() => setOpen(false)}>
                {t('tasks.notifications.viewAll')}
              </Link>
            </div>

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </div>
            ) : null}

            {summary?.recentActivities?.length ? (
              <div className="mt-3 space-y-3">
                {summary.recentActivities.slice(0, 5).map((activity) => (
                  <Link
                    key={activity.id || `${activity.taskId}-${activity.createdAt}`}
                    to={activity.task?.id || activity.taskId ? `/app/tasks?task=${activity.task?.id || activity.taskId}` : '/app/tasks'}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 transition hover:border-primary-200 hover:bg-primary-50/50 dark:border-slate-800/70 dark:bg-slate-900/70 dark:hover:border-primary-500/30 dark:hover:bg-primary-500/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {activity.task?.title || t('tasks.detail.title')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {activity.actor?.name || t('tasks.detail.unknownUser')} · {formatMaybeDateTime(activity.createdAt, 'D MMM, HH:mm')}
                        </p>
                      </div>
                    </div>
                    {activity.content ? (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{activity.content}</p>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('tasks.notifications.empty')}</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
