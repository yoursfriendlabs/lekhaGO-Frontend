import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BellRing,
  Columns3,
  Clock,
  List,
  Plus,
  RefreshCw,
  Search,
  ClipboardList,
} from 'lucide-react';
import ActionMenu from '../components/ActionMenu.jsx';
import Notice from '../components/Notice.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Pagination from '../components/Pagination.jsx';
import TaskDetailDialog from '../components/tasks/TaskDetailDialog.jsx';
import TaskFormDialog from '../components/tasks/TaskFormDialog.jsx';
import {
  TaskDueBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskUnreadBadge,
} from '../components/tasks/TaskBadges.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatMaybeDate, formatMaybeDateTime } from '../lib/datetime';
import { useI18n } from '../lib/i18n.jsx';
import { useSnackbar } from '../lib/snackbar.jsx';
import {
  buildTaskMutationPayload,
  canEditTaskContent,
  EMPTY_TASKS_META,
  emitTasksSync,
  getTaskAssigneeNames,
  getTaskDueState,
  hasUnreadTaskActivity,
  humanizeTaskKey,
  isTaskCompleted,
  normalizeTaskDetail,
  subscribeToTasksSync,
} from '../lib/tasks';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function buildEmptyTaskForm(meta) {
  const defaultStatus = meta.statuses.find((status) => !['completed', 'done', 'closed'].includes(status.key))?.key
    || meta.statuses[0]?.key
    || '';
  const defaultPriority = meta.priorities.find((priority) => priority.key === 'medium')?.key
    || meta.priorities[0]?.key
    || '';

  return {
    title: '',
    description: '',
    priority: defaultPriority,
    status: defaultStatus,
    dueDate: '',
    assigneeUserIds: [],
  };
}

function buildTaskFormFromTask(task, meta) {
  const assigneeUserIds = Array.isArray(task?.assignments)
    ? task.assignments.map((assignment) => assignment.userId).filter(Boolean)
    : [];

  return {
    ...buildEmptyTaskForm(meta),
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || '',
    status: task?.status || '',
    dueDate: task?.dueDate ? String(task.dueDate).slice(0, 10) : '',
    assigneeUserIds,
  };
}

function TaskScopeFilter({ value, onChange, t }) {
  const options = [
    { key: '', label: t('tasks.filters.everyone') },
    { key: 'assigned', label: t('tasks.filters.assignedToMe') },
    { key: 'created', label: t('tasks.filters.createdByMe') },
    { key: 'mine', label: t('tasks.filters.myParticipation') },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.key || 'all'}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            value === option.key
              ? 'bg-primary-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function buildTaskPath(searchParams, taskId) {
  const nextParams = new URLSearchParams(searchParams);

  if (taskId) {
    nextParams.set('task', String(taskId));
  } else {
    nextParams.delete('task');
  }

  nextParams.delete('create');

  const query = nextParams.toString();
  return query ? `/app/tasks?${query}` : '/app/tasks';
}

function TaskCard({ task, meta, currentUserId, taskHref, onEdit, canEdit, t }) {
  const dueState = getTaskDueState(task);
  const assigneeNames = getTaskAssigneeNames(task);
  const showUnread = hasUnreadTaskActivity(task, currentUserId);
  const actionItems = [
    { label: t('common.view'), to: taskHref },
    ...(canEdit ? [{ label: t('common.edit'), onClick: onEdit }] : []),
  ];

  return (
    <div className={`rounded-3xl border bg-white/90 p-5 shadow-sm transition hover:shadow-md dark:bg-slate-950/60 ${
      showUnread
        ? 'border-sky-200 dark:border-sky-600/40'
        : dueState === 'overdue'
          ? 'border-rose-200 dark:border-rose-600/30'
          : 'border-slate-200/70 dark:border-slate-800/70'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <Link to={taskHref} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-serif text-lg text-slate-900 dark:text-white">{task.title || t('tasks.detail.title')}</h3>
            {showUnread ? <TaskUnreadBadge task={task} userId={currentUserId} t={t} /> : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {task.description || t('tasks.empty.noDescription')}
          </p>
        </Link>

        <ActionMenu actions={actionItems} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <TaskStatusBadge task={task} meta={meta} />
        <TaskPriorityBadge task={task} meta={meta} />
        <TaskDueBadge task={task} t={t} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.card.assignees')}</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {assigneeNames.length ? assigneeNames.join(', ') : t('tasks.empty.noAssignees')}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.card.activity')}</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {task.lastActivityAt
              ? `${formatMaybeDateTime(task.lastActivityAt, 'D MMM, HH:mm')} · ${task.lastActivityBy?.name || humanizeTaskKey(task.lastActivityType)}`
              : t('tasks.empty.noActivity')}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.card.creator')}</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{task.creator?.name || t('tasks.detail.unknownUser')}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.card.dueDate')}</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {task.dueDate ? formatMaybeDate(task.dueDate, 'D MMM YYYY') : t('tasks.empty.noDueDate')}
          </p>
        </div>
      </div>
    </div>
  );
}

function TaskBoard({ tasks, meta, currentUserId, taskHrefFor, onEditTask, canEditTask, t }) {
  const columns = meta.statuses.length ? meta.statuses : EMPTY_TASKS_META.statuses;
  const grouped = new Map(columns.map((status) => [status.key, []]));

  tasks.forEach((task) => {
    const key = grouped.has(task.status) ? task.status : columns[0]?.key;
    grouped.get(key)?.push(task);
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section key={column.key} className="min-w-[18rem] flex-1 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg text-slate-900 dark:text-white">{column.label}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm dark:bg-slate-950/80 dark:text-slate-300">
              {grouped.get(column.key)?.length || 0}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {(grouped.get(column.key) || []).length ? (
              grouped.get(column.key).map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  meta={meta}
                  currentUserId={currentUserId}
                  taskHref={taskHrefFor(task.id)}
                  onEdit={() => onEditTask(task)}
                  canEdit={canEditTask(task)}
                  t={t}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                {t('tasks.empty.boardColumn')}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function Tasks() {
  const { t } = useI18n();
  const { showError, showSuccess } = useSnackbar();
  const { user, role, businessId, canViewFeature, canManageFeature } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState(EMPTY_TASKS_META);
  const [metaError, setMetaError] = useState('');
  const [tasksData, setTasksData] = useState({ items: [], total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [staffMembers, setStaffMembers] = useState([]);
  const [detailTask, setDetailTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [formMode, setFormMode] = useState('');
  const [formTaskId, setFormTaskId] = useState('');
  const [formValues, setFormValues] = useState(() => buildEmptyTaskForm(EMPTY_TASKS_META));
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [commentValue, setCommentValue] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [queryInput, setQueryInput] = useState(() => searchParams.get('q') || '');
  const debouncedQuery = useDebouncedValue(queryInput, 300);
  const canViewTasks = canViewFeature('tasks');
  const canManageTasks = canManageFeature('tasks');
  const page = Math.max(Number(searchParams.get('page') || 1), 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get('limit')))
    ? Number(searchParams.get('limit'))
    : 20;
  const statusFilter = searchParams.get('status') || '';
  const priorityFilter = searchParams.get('priority') || '';
  const dueFilter = searchParams.get('due') || '';
  const scopeFilter = searchParams.get('scope') || (role === 'staff' ? 'mine' : '');
  const viewMode = searchParams.get('view') === 'board' ? 'board' : 'list';
  const selectedTaskId = searchParams.get('task') || '';
  const currentUserId = user?.id || '';

  const currentTaskIds = tasksData.items.map((task) => task.id);
  const hasNextPage = tasksData.offset + tasksData.items.length < tasksData.total;
  const viewReadOnlyNotice = canViewTasks && !canManageTasks;
  const activeTaskFromList = currentTaskIds.includes(formTaskId)
    ? tasksData.items.find((task) => task.id === formTaskId)
    : null;

  const updateParams = (updates = {}, { resetPage = false } = {}) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, String(value));
    });

    if (resetPage) {
      nextParams.delete('page');
    }

    setSearchParams(nextParams);
  };

  const taskQueryParams = useMemo(() => {
    const params = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };

    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (dueFilter) params.due = dueFilter;
    if (debouncedQuery.trim()) params.q = debouncedQuery.trim();

    if (scopeFilter === 'assigned') params.assignedTo = 'me';
    if (scopeFilter === 'created') params.createdBy = 'me';
    if (scopeFilter === 'mine') params.participation = 'mine';

    return params;
  }, [debouncedQuery, dueFilter, page, pageSize, priorityFilter, scopeFilter, statusFilter]);

  const loadMeta = async () => {
    try {
      const payload = await api.getTaskMeta({ force: true });
      setMeta(payload || EMPTY_TASKS_META);
      setMetaError('');
      return payload || EMPTY_TASKS_META;
    } catch (error) {
      setMeta(EMPTY_TASKS_META);
      setMetaError(error.message || '');
      return EMPTY_TASKS_META;
    }
  };

  const loadTasks = async ({ silent = false } = {}) => {
    if (!canViewTasks || !businessId) {
      setTasksData({ items: [], total: 0, limit: pageSize, offset: 0 });
      setLoadError('');
      return;
    }

    if (!silent) setLoading(true);
    setLoadError('');

    try {
      const payload = await api.listTasks(taskQueryParams, { force: true });
      setTasksData(payload);
    } catch (error) {
      setTasksData({ items: [], total: 0, limit: pageSize, offset: 0 });
      setLoadError(error.message || t('auth.errors.generic'));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetail = async (taskId) => {
    if (!taskId) {
      setDetailTask(null);
      setDetailError('');
      setDetailLoading(false);
      return null;
    }

    setDetailLoading(true);
    setDetailError('');

    try {
      const payload = await api.getTask(taskId);
      const normalized = normalizeTaskDetail(payload);
      setDetailTask(normalized);
      setStatusValue(normalized.status || meta.statuses[0]?.key || '');
      emitTasksSync({ type: 'task-opened', taskId });
      return normalized;
    } catch (error) {
      setDetailTask(null);
      setDetailError(error.message || t('auth.errors.generic'));
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const loadStaffMembers = async () => {
    if (!canManageTasks || !businessId) {
      setStaffMembers([]);
      return [];
    }

    try {
      const payload = await api.listStaff();
      const members = Array.isArray(payload?.members) ? payload.members : [];
      setStaffMembers(members.filter((member) => member?.user?.id));
      return members;
    } catch {
      setStaffMembers([]);
      return [];
    }
  };

  useEffect(() => {
    if (searchParams.get('q') === debouncedQuery) return;
    updateParams({ q: debouncedQuery || null }, { resetPage: true });
  }, [debouncedQuery]);

  useEffect(() => {
    const nextQuery = searchParams.get('q') || '';
    setQueryInput((current) => (current === nextQuery ? current : nextQuery));
  }, [searchParams]);

  useEffect(() => {
    loadMeta().catch(() => {});
  }, []);

  useEffect(() => {
    loadTasks().catch(() => {});
  }, [businessId, canViewTasks, taskQueryParams]);

  useEffect(() => subscribeToTasksSync(() => {
    loadTasks({ silent: true }).catch(() => {});
  }), [businessId, canViewTasks, taskQueryParams]);

  useEffect(() => {
    if (!selectedTaskId) {
      setDetailTask(null);
      setDetailError('');
      return;
    }

    loadDetail(selectedTaskId)
      .then(() => loadTasks({ silent: true }))
      .catch(() => {});
  }, [selectedTaskId]);

  useEffect(() => {
    if (!canManageTasks) return;
    loadStaffMembers().catch(() => {});
  }, [businessId, canManageTasks]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || !canManageTasks) return;
    setFormMode('create');
    setFormTaskId('');
    setFormValues(buildEmptyTaskForm(meta));
    setFormError('');
  }, [canManageTasks, meta, searchParams]);

  const closeDetail = () => updateParams({ task: null });

  const closeForm = () => {
    setFormMode('');
    setFormTaskId('');
    setFormError('');
    updateParams({ create: null });
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormTaskId('');
    setFormValues(buildEmptyTaskForm(meta));
    setFormError('');
    updateParams({ create: 1, task: null });
  };

  const openEditForm = (task) => {
    const source = task || detailTask || activeTaskFromList;
    if (!source) return;
    setFormMode('edit');
    setFormTaskId(source.id);
    setFormValues(buildTaskFormFromTask(source, meta));
    setFormError('');
  };

  const taskHrefFor = (taskId) => buildTaskPath(searchParams, taskId);

  const handleFilterChange = (key, value) => updateParams({ [key]: value || null }, { resetPage: true });

  const handleFormFieldChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const payload = buildTaskMutationPayload(formValues);

    setFormSaving(true);
    setFormError('');

    try {
      const response = formMode === 'edit' && formTaskId
        ? await api.updateTask(formTaskId, payload)
        : await api.createTask(payload);
      const savedTask = normalizeTaskDetail(response);

      emitTasksSync({ type: formMode === 'edit' ? 'task-updated' : 'task-created', taskId: savedTask.id });
      showSuccess(formMode === 'edit' ? t('tasks.feedback.updated') : t('tasks.feedback.created'));
      closeForm();
      updateParams({ task: savedTask.id, create: null });
      await loadTasks({ silent: true });
      await loadDetail(savedTask.id);
    } catch (error) {
      setFormError(error.message || t('auth.errors.generic'));
    } finally {
      setFormSaving(false);
    }
  };

  const handleStatusSubmit = async () => {
    if (!detailTask?.id || statusValue === detailTask.status) return;

    setStatusSaving(true);
    setDetailError('');

    try {
      const response = await api.updateTask(detailTask.id, { status: statusValue });
      const nextTask = normalizeTaskDetail(response);
      setDetailTask(nextTask);
      setStatusValue(nextTask.status);
      emitTasksSync({ type: 'task-status-updated', taskId: nextTask.id });
      showSuccess(t('tasks.feedback.statusUpdated'));
      await loadTasks({ silent: true });
    } catch (error) {
      setDetailError(error.message || t('auth.errors.generic'));
      showError(error.message || t('auth.errors.generic'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const content = String(commentValue || '').trim();
    if (!detailTask?.id || !content) return;

    setCommentSaving(true);
    setDetailError('');

    try {
      await api.createTaskComment(detailTask.id, { content });
      setCommentValue('');
      emitTasksSync({ type: 'task-comment-added', taskId: detailTask.id });
      showSuccess(t('tasks.feedback.commentAdded'));
      await loadDetail(detailTask.id);
      await loadTasks({ silent: true });
    } catch (error) {
      setDetailError(error.message || t('auth.errors.generic'));
      showError(error.message || t('auth.errors.generic'));
    } finally {
      setCommentSaving(false);
    }
  };

  const canEditSpecificTask = (task) => canManageTasks && canEditTaskContent(task, user, role);
  const completedCount = tasksData.items.filter((task) => isTaskCompleted(task)).length;
  const unreadCount = tasksData.items.filter((task) => hasUnreadTaskActivity(task, currentUserId)).length;
  const overdueCount = tasksData.items.filter((task) => getTaskDueState(task) === 'overdue').length;

  if (!canViewTasks) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('tasks.pageTitle')} subtitle={t('tasks.pageSubtitle')} />
        <Notice title={t('tasks.notAvailable.title')} description={t('tasks.notAvailable.description')} tone="warn" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <PageHeader
        title={t('tasks.pageTitle')}
        subtitle={t('tasks.pageSubtitle')}
        action={(
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => handleFilterChange('view', 'list')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                  viewMode === 'list' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <List size={15} />
                {t('tasks.view.list')}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('view', 'board')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                  viewMode === 'board' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Columns3 size={15} />
                {t('tasks.view.board')}
              </button>
            </div>

            {canManageTasks ? (
              <button type="button" className="btn-primary gap-2 justify-center" onClick={openCreateForm}>
                <Plus size={16} />
                {t('tasks.actions.newTask')}
              </button>
            ) : null}
          </div>
        )}
      />

      {viewReadOnlyNotice ? (
        <Notice title={t('tasks.readOnly.title')} description={t('tasks.readOnly.description')} tone="info" />
      ) : null}

      {metaError ? <Notice title={metaError} tone="warn" /> : null}
      {loadError ? <Notice title={loadError} tone="error" /> : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('tasks.filters.title')}</p>
              <TaskScopeFilter value={scopeFilter} onChange={(value) => handleFilterChange('scope', value)} t={t} />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="relative block min-w-[16rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-10"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder={t('tasks.filters.searchPlaceholder')}
                />
              </label>

              <button type="button" className="btn-ghost gap-2 justify-center" onClick={() => loadTasks()} disabled={loading}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                {t('tasks.actions.refresh')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="tasks-status-filter">{t('common.status')}</label>
              <select
                id="tasks-status-filter"
                className="input mt-1"
                value={statusFilter}
                onChange={(event) => handleFilterChange('status', event.target.value)}
              >
                <option value="">{t('tasks.filters.allStatuses')}</option>
                {meta.statuses.map((status) => (
                  <option key={status.key} value={status.key}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="tasks-priority-filter">{t('tasks.form.priority')}</label>
              <select
                id="tasks-priority-filter"
                className="input mt-1"
                value={priorityFilter}
                onChange={(event) => handleFilterChange('priority', event.target.value)}
              >
                <option value="">{t('tasks.filters.allPriorities')}</option>
                {meta.priorities.map((priority) => (
                  <option key={priority.key} value={priority.key}>{priority.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="tasks-due-filter">{t('tasks.filters.due')}</label>
              <select
                id="tasks-due-filter"
                className="input mt-1"
                value={dueFilter}
                onChange={(event) => handleFilterChange('due', event.target.value)}
              >
                <option value="">{t('tasks.filters.allDueStates')}</option>
                <option value="overdue">{t('tasks.badges.overdue')}</option>
                <option value="today">{t('tasks.badges.today')}</option>
                <option value="upcoming">{t('tasks.badges.upcoming')}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/60">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary-600 dark:text-primary-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('tasks.summary.openTasks')}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{Math.max(tasksData.total - completedCount, 0)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-rose-200/70 bg-rose-50/70 p-5 shadow-sm dark:border-rose-700/30 dark:bg-rose-900/20">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-rose-600 dark:text-rose-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-500/80">{t('tasks.summary.overdue')}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{overdueCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-sky-200/70 bg-sky-50/70 p-5 shadow-sm dark:border-sky-700/30 dark:bg-sky-900/20">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-sky-600 dark:text-sky-300" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-500/80">{t('tasks.summary.unread')}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{unreadCount}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!businessId ? (
        <Notice title={t('tasks.businessRequired.title')} description={t('tasks.businessRequired.description')} tone="warn" />
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200/70 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400">
          {t('tasks.loading.list')}
        </div>
      ) : tasksData.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200/80 bg-white/80 px-4 py-12 text-center dark:border-slate-800/70 dark:bg-slate-950/50">
          <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('tasks.empty.title')}</h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('tasks.empty.description')}</p>
          {canManageTasks ? (
            <div className="mt-5">
              <button type="button" className="btn-primary gap-2" onClick={openCreateForm}>
                <Plus size={16} />
                {t('tasks.actions.newTask')}
              </button>
            </div>
          ) : null}
        </div>
      ) : viewMode === 'board' ? (
        <TaskBoard
          tasks={tasksData.items}
          meta={meta}
          currentUserId={currentUserId}
          taskHrefFor={taskHrefFor}
          onEditTask={openEditForm}
          canEditTask={canEditSpecificTask}
          t={t}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {tasksData.items.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              meta={meta}
              currentUserId={currentUserId}
              taskHref={taskHrefFor(task.id)}
              onEdit={() => openEditForm(task)}
              canEdit={canEditSpecificTask(task)}
              t={t}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={tasksData.total}
        hasNext={hasNextPage}
        onPageChange={(nextPage) => updateParams({ page: nextPage })}
        onPageSizeChange={(size) => updateParams({ limit: size }, { resetPage: true })}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      <TaskDetailDialog
        isOpen={Boolean(selectedTaskId)}
        task={detailTask}
        meta={meta}
        loading={detailLoading}
        error={detailError}
        commentValue={commentValue}
        onCommentChange={setCommentValue}
        onCommentSubmit={handleCommentSubmit}
        commentSaving={commentSaving}
        statusValue={statusValue}
        onStatusValueChange={setStatusValue}
        onStatusSubmit={handleStatusSubmit}
        statusSaving={statusSaving}
        onEdit={() => openEditForm(detailTask)}
        onRefresh={() => loadDetail(selectedTaskId)}
        onClose={closeDetail}
        canManageTasks={canManageTasks}
        canEditContent={canEditSpecificTask(detailTask)}
        t={t}
      />

      <TaskFormDialog
        isOpen={Boolean(formMode)}
        mode={formMode}
        form={formValues}
        meta={meta}
        staffMembers={staffMembers}
        saving={formSaving}
        error={formError}
        onClose={closeForm}
        onSubmit={handleFormSubmit}
        onFieldChange={handleFormFieldChange}
        t={t}
      />

      {canViewTasks ? (
        <div className="rounded-3xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-slate-500 dark:border-slate-800/70 dark:bg-slate-950/50 dark:text-slate-400">
          <span>{t('tasks.footerHint')}</span>
          <Link className="ml-2 font-semibold text-primary-600 dark:text-primary-300" to={scopeFilter === 'mine' ? '/app/tasks' : '/app/tasks?scope=mine'}>
            {t('tasks.footerLink')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
