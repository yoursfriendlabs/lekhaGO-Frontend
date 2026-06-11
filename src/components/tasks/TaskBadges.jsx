import {
  getTaskDueState,
  getTaskPriorityLabel,
  getTaskPriorityTone,
  getTaskRelativeDueLabel,
  getTaskStatusLabel,
  getTaskStatusTone,
  hasUnreadTaskActivity,
  isTaskCompleted,
} from '../../lib/tasks';

function badgeClass(tone = 'slate') {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'amber':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'rose':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    case 'sky':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    default:
      return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function TaskStatusBadge({ task, meta, className = '' }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(getTaskStatusTone(task))} ${className}`.trim()}>
      {getTaskStatusLabel(task?.status, meta)}
    </span>
  );
}

export function TaskPriorityBadge({ task, meta, className = '' }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(getTaskPriorityTone(task?.priority))} ${className}`.trim()}>
      {getTaskPriorityLabel(task?.priority, meta)}
    </span>
  );
}

export function TaskDueBadge({ task, t, className = '' }) {
  const dueState = getTaskDueState(task);

  if (isTaskCompleted(task)) {
    return (
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass('emerald')} ${className}`.trim()}>
        {t('tasks.badges.completed')}
      </span>
    );
  }

  if (dueState === 'none') return null;

  const tone = dueState === 'overdue' ? 'rose' : dueState === 'today' ? 'amber' : 'sky';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass(tone)} ${className}`.trim()}>
      {dueState === 'overdue'
        ? t('tasks.badges.overdue')
        : dueState === 'today'
          ? t('tasks.badges.today')
          : t('tasks.badges.upcoming')}
    </span>
  );
}

export function TaskUnreadBadge({ task, userId, t, className = '' }) {
  if (!hasUnreadTaskActivity(task, userId)) return null;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass('sky')} ${className}`.trim()}>
      {t('tasks.badges.unread')}
    </span>
  );
}

export function TaskDueText({ task, t }) {
  if (!task?.dueDate) {
    return <span>{t('tasks.empty.noDueDate')}</span>;
  }

  return <span>{getTaskRelativeDueLabel(task)}</span>;
}
