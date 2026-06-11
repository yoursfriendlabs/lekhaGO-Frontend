import { MessageSquarePlus, RefreshCw, Users } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';
import { formatMaybeDate } from '../../lib/datetime';
import {
  formatTaskTimestamp,
  getTaskActivityLabel,
  getTaskStatusLabel,
  getTaskAssigneeNames,
} from '../../lib/tasks';
import {
  TaskDueBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from './TaskBadges.jsx';

function MetaItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{value}</div>
    </div>
  );
}

function TaskActivityRow({ activity, meta }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-800/70 dark:bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {(activity?.actor?.name || 'Someone')} · {getTaskActivityLabel(activity?.type, meta)}
        </p>
        <span className="text-xs text-slate-400">{formatTaskTimestamp(activity?.createdAt)}</span>
      </div>
      {activity?.content ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{activity.content}</p>
      ) : null}
    </div>
  );
}

export default function TaskDetailDialog({
  isOpen,
  task,
  meta,
  loading,
  error,
  commentValue,
  onCommentChange,
  onCommentSubmit,
  commentSaving,
  statusValue,
  onStatusValueChange,
  onStatusSubmit,
  statusSaving,
  onEdit,
  onRefresh,
  onClose,
  canManageTasks,
  canEditContent,
  t,
}) {
  const assigneeNames = getTaskAssigneeNames(task);

  const footer = (
    <>
      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
        {t('common.close')}
      </button>
      {canEditContent ? (
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={onEdit}>
          {t('common.edit')}
        </button>
      ) : null}
    </>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={task?.title || t('tasks.detail.title')}
      size="wide"
      footer={footer}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge task={task} meta={meta} />
            <TaskPriorityBadge task={task} meta={meta} />
            <TaskDueBadge task={task} t={t} />
          </div>

          <button type="button" className="btn-ghost gap-2" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {t('tasks.detail.refresh')}
          </button>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
            {t('tasks.loading.detail')}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {!loading && task ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-5 dark:border-slate-800/70 dark:bg-slate-950/60">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.detail.description')}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {task.description || t('tasks.empty.noDescription')}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <MetaItem label={t('tasks.detail.creator')} value={task.creator?.name || t('tasks.detail.unknownUser')} />
                  <MetaItem
                    label={t('tasks.detail.lastActivity')}
                    value={task.lastActivityAt
                      ? `${formatTaskTimestamp(task.lastActivityAt)}${task.lastActivityBy?.name ? ` · ${task.lastActivityBy.name}` : ''}`
                      : t('tasks.empty.noActivity')}
                  />
                  <MetaItem
                    label={t('tasks.detail.completedBy')}
                    value={task.completedBy?.name || t('tasks.empty.notCompleted')}
                  />
                  <MetaItem
                    label={t('tasks.detail.dueDate')}
                    value={task.dueDate ? formatMaybeDate(task.dueDate, 'D MMM YYYY') : t('tasks.empty.noDueDate')}
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.detail.assignees')}</p>
                  {assigneeNames.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t('tasks.empty.noAssignees')}</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {assigneeNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-950/80 dark:text-slate-200"
                        >
                          <Users size={12} />
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canManageTasks ? (
                  <div className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 dark:border-slate-800/70 dark:bg-slate-950/60">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.detail.statusAction')}</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <select
                        className="input"
                        value={statusValue}
                        onChange={(event) => onStatusValueChange(event.target.value)}
                      >
                        {meta.statuses.map((status) => (
                          <option key={status.key} value={status.key}>{status.label}</option>
                        ))}
                      </select>
                      <button type="button" className="btn-primary justify-center" onClick={onStatusSubmit} disabled={statusSaving || statusValue === task.status}>
                        {statusSaving ? t('common.saving') : t('tasks.detail.updateStatus')}
                      </button>
                    </div>
                    {!canEditContent ? (
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                        {t('tasks.detail.statusActionHint', { status: getTaskStatusLabel(task.status, meta) })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-5 dark:border-slate-800/70 dark:bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus size={16} className="text-slate-400" />
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('tasks.detail.commentTitle')}</h3>
                </div>

                {canManageTasks ? (
                  <form className="space-y-3" onSubmit={onCommentSubmit}>
                    <textarea
                      className="input min-h-28 resize-y"
                      value={commentValue}
                      onChange={(event) => onCommentChange(event.target.value)}
                      placeholder={t('tasks.detail.commentPlaceholder')}
                    />
                    <button type="submit" className="btn-primary justify-center" disabled={commentSaving || !String(commentValue || '').trim()}>
                      {commentSaving ? t('common.saving') : t('tasks.detail.addComment')}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('tasks.detail.readOnlyComments')}</p>
                )}
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('tasks.detail.timeline')}</h3>
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-400">{task.activities?.length || 0}</span>
                </div>

                {task.activities?.length ? (
                  <div className="space-y-3">
                    {task.activities.map((activity) => (
                      <TaskActivityRow key={activity.id || `${activity.type}-${activity.createdAt}`} activity={activity} meta={meta} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('tasks.empty.noActivity')}</p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
