import dayjs, { formatMaybeDate, formatMaybeDateTime, toDateInputValue } from './datetime';

const FALLBACK_STATUSES = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

const FALLBACK_PRIORITIES = [
  { key: 'low', label: 'Low' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'High' },
  { key: 'urgent', label: 'Urgent' },
];

const FALLBACK_ACTIVITY_TYPES = [
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'commented', label: 'Commented' },
  { key: 'status_changed', label: 'Status changed' },
  { key: 'assignment_changed', label: 'Assignments updated' },
  { key: 'completed', label: 'Completed' },
];

export const EMPTY_TASKS_META = Object.freeze({
  statuses: FALLBACK_STATUSES,
  priorities: FALLBACK_PRIORITIES,
  activityTypes: FALLBACK_ACTIVITY_TYPES,
});

export const EMPTY_TASKS_NOTIFICATION_SUMMARY = Object.freeze({
  lastSeenAt: null,
  unreadActivityCount: 0,
  counters: {
    assignedToMeOpen: 0,
    assignedToMeOverdue: 0,
    createdByMeOpen: 0,
  },
  recentActivities: [],
});

export const TASKS_SYNC_EVENT = 'mms:tasks-sync';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return '';
}

function pickBoolean(...values) {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
  }

  return undefined;
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

export function normalizeTaskKey(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function humanizeTaskKey(value = '') {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function normalizeTaskOption(option) {
  if (typeof option === 'string') {
    const key = normalizeTaskKey(option);
    return key ? { key, label: humanizeTaskKey(option) } : null;
  }

  const source = asObject(option);
  if (!source) return null;

  const key = normalizeTaskKey(source.key ?? source.value ?? source.id ?? source.name ?? source.slug);
  if (!key) return null;

  return {
    key,
    label: pickString(source.label, source.name, source.title) || humanizeTaskKey(key),
    description: pickString(source.description) || '',
  };
}

function normalizeTaskOptions(options, fallback = []) {
  const normalized = asArray(options)
    .map((option) => normalizeTaskOption(option))
    .filter(Boolean);

  return normalized.length ? normalized : fallback;
}

export function normalizeTaskMeta(payload) {
  const source = asObject(payload) || {};

  return {
    statuses: normalizeTaskOptions(source.statuses, FALLBACK_STATUSES),
    priorities: normalizeTaskOptions(source.priorities, FALLBACK_PRIORITIES),
    activityTypes: normalizeTaskOptions(source.activityTypes, FALLBACK_ACTIVITY_TYPES),
  };
}

export function normalizeTaskUser(user) {
  const source = asObject(user) || {};
  const nestedUser = asObject(source.user) || null;
  const resolved = nestedUser || source;

  return {
    id: pickString(
      resolved.id,
      resolved.userId,
      source.userId,
      source.membershipId,
      source.staffUserId,
    ) || null,
    name: pickString(
      resolved.name,
      resolved.fullName,
      resolved.displayName,
      source.name,
      source.label,
    ) || null,
    email: pickString(resolved.email, source.email) || null,
    role: pickString(resolved.role, source.role) || null,
    jobTitle: pickString(resolved.jobTitle, source.jobTitle) || null,
  };
}

export function normalizeTaskAssignment(assignment) {
  const source = asObject(assignment) || {};
  const user = normalizeTaskUser(source.assignee ?? source.user ?? source.member ?? source.staff ?? source.actor ?? source);
  const unreadActivityCount = pickNumber(source.unreadActivityCount, source.unreadCount, source.pendingActivityCount) ?? 0;
  const readAt = pickString(source.readAt, source.lastReadAt, source.seenAt) || null;
  const isRead = pickBoolean(source.isRead, source.read) ?? (readAt ? true : unreadActivityCount === 0);

  return {
    id: pickString(source.id, source.assignmentId, source.membershipId) || null,
    userId: pickString(source.userId, source.assigneeUserId, user.id) || user.id,
    user,
    assignedAt: pickString(source.assignedAt, source.createdAt) || null,
    readAt,
    unreadActivityCount,
    hasUnread: unreadActivityCount > 0 || isRead === false,
  };
}

export function normalizeTaskActivity(activity) {
  const source = asObject(activity) || {};
  const actor = normalizeTaskUser(source.actor ?? source.user ?? source.by ?? source.createdBy ?? source.lastActivityBy);

  return {
    id: pickString(source.id, source.activityId) || null,
    taskId: pickString(source.taskId, source.task?.id) || null,
    type: normalizeTaskKey(source.type || source.activityType || source.kind),
    label: pickString(source.label, source.title) || '',
    content: pickString(source.content, source.message, source.comment, source.description, source.text) || '',
    createdAt: pickString(source.createdAt, source.updatedAt, source.timestamp) || null,
    actor,
    task: asObject(source.task)
      ? {
        id: pickString(source.task.id) || null,
        title: pickString(source.task.title) || '',
      }
      : null,
    metadata: asObject(source.metadata) || null,
  };
}

function normalizeTaskBase(task) {
  const source = asObject(task) || {};

  return {
    id: pickString(source.id) || null,
    businessId: pickString(source.businessId) || null,
    title: pickString(source.title, source.name) || '',
    description: pickString(source.description, source.details, source.summary) || '',
    status: normalizeTaskKey(source.status),
    priority: normalizeTaskKey(source.priority),
    dueDate: pickString(source.dueDate, source.due_on, source.dueAt) || null,
    createdAt: pickString(source.createdAt) || null,
    updatedAt: pickString(source.updatedAt) || null,
    completedAt: pickString(source.completedAt) || null,
    lastActivityAt: pickString(source.lastActivityAt, source.updatedAt) || null,
    lastActivityType: normalizeTaskKey(source.lastActivityType || source.activityType),
    assigneeCount: pickNumber(source.assigneeCount) ?? asArray(source.assignments).length,
    creator: normalizeTaskUser(source.creator ?? source.createdBy),
    completedBy: normalizeTaskUser(source.completedBy),
    lastActivityBy: normalizeTaskUser(source.lastActivityBy),
    assignments: asArray(source.assignments).map((assignment) => normalizeTaskAssignment(assignment)),
  };
}

export function normalizeTaskListItem(task) {
  return normalizeTaskBase(task);
}

export function normalizeTaskDetail(payload) {
  const source = asObject(payload) || {};
  const task = normalizeTaskBase(source.task ?? payload);

  return {
    ...task,
    activities: asArray(source.task?.activities ?? source.activities).map((activity) => normalizeTaskActivity(activity)),
  };
}

export function normalizeTaskNotificationSummary(payload) {
  const source = asObject(payload) || {};

  return {
    lastSeenAt: pickString(source.lastSeenAt) || null,
    unreadActivityCount: pickNumber(source.unreadActivityCount) ?? 0,
    counters: {
      assignedToMeOpen: pickNumber(source.counters?.assignedToMeOpen) ?? 0,
      assignedToMeOverdue: pickNumber(source.counters?.assignedToMeOverdue) ?? 0,
      createdByMeOpen: pickNumber(source.counters?.createdByMeOpen) ?? 0,
    },
    recentActivities: asArray(source.recentActivities).map((activity) => normalizeTaskActivity(activity)),
  };
}

export function isTaskCompleted(task) {
  const status = normalizeTaskKey(task?.status);
  return Boolean(task?.completedAt) || ['completed', 'done', 'closed', 'resolved'].includes(status);
}

export function getTaskDueState(task) {
  if (!task?.dueDate || isTaskCompleted(task)) return 'none';

  const dueDate = dayjs(task.dueDate);
  if (!dueDate.isValid()) return 'none';

  const today = dayjs().startOf('day');
  const dueDay = dueDate.startOf('day');

  if (dueDay.isBefore(today)) return 'overdue';
  if (dueDay.isSame(today)) return 'today';
  return 'upcoming';
}

export function getTaskPriorityTone(priority) {
  switch (normalizeTaskKey(priority)) {
    case 'urgent':
      return 'rose';
    case 'high':
      return 'amber';
    case 'medium':
      return 'sky';
    case 'low':
      return 'slate';
    default:
      return 'slate';
  }
}

export function getTaskStatusTone(task) {
  if (isTaskCompleted(task)) return 'emerald';
  if (getTaskDueState(task) === 'overdue') return 'rose';
  if (normalizeTaskKey(task?.status) === 'in_progress') return 'amber';
  return 'slate';
}

export function getTaskAssignmentForUser(task, userId) {
  if (!userId) return null;
  return asArray(task?.assignments).find((assignment) => assignment.userId === userId) || null;
}

export function hasUnreadTaskActivity(task, userId) {
  const assignment = getTaskAssignmentForUser(task, userId);
  if (!assignment) return false;

  if (assignment.hasUnread) return true;

  const lastReadAt = assignment.readAt ? dayjs(assignment.readAt) : null;
  const lastActivityAt = task?.lastActivityAt ? dayjs(task.lastActivityAt) : null;

  return Boolean(lastReadAt?.isValid() && lastActivityAt?.isValid() && lastActivityAt.isAfter(lastReadAt));
}

export function getTaskAssigneeNames(task) {
  return asArray(task?.assignments)
    .map((assignment) => assignment?.user?.name)
    .filter(Boolean);
}

export function getTaskRelativeDueLabel(task) {
  const dueDate = task?.dueDate;
  if (!dueDate) return '';

  const dueState = getTaskDueState(task);
  const formattedDate = formatMaybeDate(dueDate, 'D MMM YYYY');

  if (dueState === 'overdue') return `Overdue since ${formattedDate}`;
  if (dueState === 'today') return `Due today`;
  if (dueState === 'upcoming') return `Due ${formattedDate}`;
  return formattedDate;
}

export function getTaskActivityLabel(activityType, meta = EMPTY_TASKS_META) {
  const normalizedKey = normalizeTaskKey(activityType);
  const match = asArray(meta?.activityTypes).find((option) => option.key === normalizedKey);
  return match?.label || humanizeTaskKey(normalizedKey);
}

export function getTaskStatusLabel(status, meta = EMPTY_TASKS_META) {
  const normalizedKey = normalizeTaskKey(status);
  const match = asArray(meta?.statuses).find((option) => option.key === normalizedKey);
  return match?.label || humanizeTaskKey(normalizedKey);
}

export function getTaskPriorityLabel(priority, meta = EMPTY_TASKS_META) {
  const normalizedKey = normalizeTaskKey(priority);
  const match = asArray(meta?.priorities).find((option) => option.key === normalizedKey);
  return match?.label || humanizeTaskKey(normalizedKey);
}

export function canEditTaskContent(task, user, role) {
  const elevatedRole = ['owner', 'admin', 'super_admin'].includes(String(role || '').toLowerCase());
  return elevatedRole || (task?.creator?.id && task.creator.id === user?.id);
}

export function buildTaskMutationPayload(form) {
  const assigneeUserIds = Array.isArray(form?.assigneeUserIds)
    ? form.assigneeUserIds.filter(Boolean)
    : [];

  return {
    title: String(form?.title || '').trim(),
    description: String(form?.description || '').trim(),
    priority: normalizeTaskKey(form?.priority),
    status: normalizeTaskKey(form?.status),
    dueDate: toDateInputValue(form?.dueDate),
    assigneeUserIds,
  };
}

export function emitTasksSync(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TASKS_SYNC_EVENT, { detail: { ...detail, timestamp: Date.now() } }));
}

export function subscribeToTasksSync(listener) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(TASKS_SYNC_EVENT, listener);
  return () => window.removeEventListener(TASKS_SYNC_EVENT, listener);
}

export function describeTaskActivity(activity, meta = EMPTY_TASKS_META) {
  const actorName = activity?.actor?.name || 'Someone';
  const activityLabel = getTaskActivityLabel(activity?.type, meta);
  const content = String(activity?.content || '').trim();

  if (content) {
    return `${actorName} ${activityLabel.toLowerCase()}: ${content}`;
  }

  return `${actorName} ${activityLabel.toLowerCase()}`;
}

export function formatTaskTimestamp(value) {
  return formatMaybeDateTime(value, 'D MMM YYYY, HH:mm');
}
