import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BellRing,
  Columns3,
  Check,
  Clock,
  List,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ClipboardList,
  X,
} from "lucide-react";
import StatsCard from "../components/StatsCard.jsx";
import ActionMenu from "../components/ActionMenu.jsx";
import Notice from "../components/Notice.jsx";
import PageHeader from "../components/PageHeader.jsx";
import Pagination from "../components/Pagination.jsx";
import TaskDetailDialog from "../components/tasks/TaskDetailDialog.jsx";
import TaskFormDialog from "../components/tasks/TaskFormDialog.jsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import {
  TaskDueBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskUnreadBadge,
} from "../components/tasks/TaskBadges.jsx";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatMaybeDate, formatMaybeDateTime } from "../lib/datetime";
import { useI18n } from "../lib/i18n.jsx";
import { useSnackbar } from "../lib/snackbar.jsx";
import {
  buildTaskMutationPayload,
  canEditTaskContent,
  EMPTY_TASKS_META,
  emitTasksSync,
  getTaskAssigneeNames,
  getTaskDueState,
  getTaskStatusLabel,
  hasUnreadTaskActivity,
  humanizeTaskKey,
  isTaskCompleted,
  normalizeTaskDetail,
  normalizeTaskKey,
  subscribeToTasksSync,
} from "../lib/tasks";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function buildEmptyTaskForm(meta) {
  const defaultStatus =
    meta.statuses.find(
      (status) => !["completed", "done", "closed"].includes(status.key),
    )?.key ||
    meta.statuses[0]?.key ||
    "";
  const defaultPriority =
    meta.priorities.find((priority) => priority.key === "medium")?.key ||
    meta.priorities[0]?.key ||
    "";

  return {
    title: "",
    description: "",
    priority: defaultPriority,
    status: defaultStatus,
    dueDate: "",
    assigneeUserIds: [],
  };
}

function buildTaskFormFromTask(task, meta) {
  const assigneeUserIds = Array.isArray(task?.assignments)
    ? task.assignments.map((assignment) => assignment.userId).filter(Boolean)
    : [];

  return {
    ...buildEmptyTaskForm(meta),
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "",
    status: task?.status || "",
    dueDate: task?.dueDate ? String(task.dueDate).slice(0, 10) : "",
    assigneeUserIds,
  };
}

function TaskScopeFilter({ value, onChange, t }) {
  const options = [
    { key: "", label: t("tasks.filters.everyone") },
    { key: "assigned", label: t("tasks.filters.assignedToMe") },
    { key: "created", label: t("tasks.filters.createdByMe") },
    { key: "mine", label: t("tasks.filters.myParticipation") },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.key || "all"}
          type="button"
          onClick={() => onChange(option.key)}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            value === option.key
              ? "bg-primary-600 text-white"
              : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-slate-900/60 dark:text-secondary-300 dark:hover:bg-slate-800"
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
    nextParams.set("task", String(taskId));
  } else {
    nextParams.delete("task");
  }

  nextParams.delete("create");

  const query = nextParams.toString();
  return query ? `/app/tasks?${query}` : "/app/tasks";
}

function TaskCard({
  task,
  meta,
  currentUserId,
  taskHref,
  onEdit,
  onStatusClick,
  canEdit,
  t,
}) {
  const dueState = getTaskDueState(task);
  const assigneeNames = getTaskAssigneeNames(task);
  const showUnread = hasUnreadTaskActivity(task, currentUserId);
  const actionItems = [
    { label: t("common.view"), to: taskHref },
    ...(canEdit ? [{ label: t("common.edit"), onClick: onEdit }] : []),
  ];

  return (
    <div
      className={`rounded-3xl border bg-white/90 p-5 shadow-sm transition hover:shadow-md dark:bg-slate-950/60 ${
        showUnread
          ? "border-sky-200 dark:border-sky-600/40"
          : dueState === "overdue"
            ? "border-rose-200 dark:border-rose-600/30"
            : "border-secondary-200/70"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link to={taskHref} className="min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-serif text-lg text-ink">
              {task.title || t("tasks.detail.title")}
            </h3>
            {showUnread ? (
              <TaskUnreadBadge task={task} userId={currentUserId} t={t} />
            ) : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-secondary-500">
            {task.description || t("tasks.empty.noDescription")}
          </p>
        </Link>

        <ActionMenu actions={actionItems} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <TaskStatusBadge
          task={task}
          meta={meta}
          onClick={onStatusClick}
          title={onStatusClick ? t("tasks.detail.updateStatus") : undefined}
          ariaLabel={onStatusClick ? t("tasks.detail.updateStatus") : undefined}
        />
        <TaskPriorityBadge task={task} meta={meta} />
        <TaskDueBadge task={task} t={t} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-secondary-500 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
            {t("tasks.card.assignees")}
          </p>
          <p className="mt-1 text-sm text-ink-light">
            {assigneeNames.length
              ? assigneeNames.join(", ")
              : t("tasks.empty.noAssignees")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
            {t("tasks.card.activity")}
          </p>
          <p className="mt-1 text-sm text-ink-light">
            {task.lastActivityAt
              ? `${formatMaybeDateTime(task.lastActivityAt, "D MMM, HH:mm")} · ${task.lastActivityBy?.name || humanizeTaskKey(task.lastActivityType)}`
              : t("tasks.empty.noActivity")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
            {t("tasks.card.creator")}
          </p>
          <p className="mt-1 text-sm text-ink-light">
            {task.creator?.name || t("tasks.detail.unknownUser")}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary-400">
            {t("tasks.card.dueDate")}
          </p>
          <p className="mt-1 text-sm text-ink-light">
            {task.dueDate
              ? formatMaybeDate(task.dueDate, "D MMM YYYY")
              : t("tasks.empty.noDueDate")}
          </p>
        </div>
      </div>
    </div>
  );
}

function TaskBoard({
  tasks,
  meta,
  currentUserId,
  taskHrefFor,
  onEditTask,
  onStatusClick,
  canEditTask,
  t,
}) {
  const columns = meta.statuses.length
    ? meta.statuses
    : EMPTY_TASKS_META.statuses;
  const grouped = new Map(columns.map((status) => [status.key, []]));

  tasks.forEach((task) => {
    const key = grouped.has(task.status) ? task.status : columns[0]?.key;
    grouped.get(key)?.push(task);
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section
          key={column.key}
          className="min-w-[18rem] flex-1 rounded-3xl border border-secondary-200/70 bg-mist/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg text-ink">{column.label}</h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-secondary-500 shadow-sm dark:bg-slate-950/80 dark:text-secondary-300">
              {grouped.get(column.key)?.length || 0}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {(grouped.get(column.key) || []).length ? (
              grouped
                .get(column.key)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    meta={meta}
                    currentUserId={currentUserId}
                    taskHref={taskHrefFor(task.id)}
                    onEdit={() => onEditTask(task)}
                    onStatusClick={() => onStatusClick?.(task)}
                    canEdit={canEditTask(task)}
                    t={t}
                  />
                ))
            ) : (
              <div className="rounded-2xl border border-dashed border-secondary-200/80 px-4 py-8 text-center text-sm text-secondary-500 dark:border-slate-800/70 dark:text-secondary-400">
                {t("tasks.empty.boardColumn")}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function getTaskStatusPalette(statusKey) {
  const key = normalizeTaskKey(statusKey);

  if (["todo", "open", "pending"].includes(key)) {
    return {
      selectedClass: "border-sky-400 bg-sky-50 dark:bg-sky-900/20",
      dotClass: "bg-sky-500",
      checkClass: "text-sky-600",
    };
  }

  if (["in_progress", "progress", "active", "working"].includes(key)) {
    return {
      selectedClass: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
      dotClass: "bg-amber-500",
      checkClass: "text-amber-600",
    };
  }

  if (["completed", "done", "closed", "resolved"].includes(key)) {
    return {
      selectedClass: "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
      dotClass: "bg-emerald-500",
      checkClass: "text-emerald-600",
    };
  }

  return {
    selectedClass: "border-primary-400 bg-primary-50 dark:bg-primary-900/20",
    dotClass: "bg-primary-500",
    checkClass: "text-primary-600",
  };
}

const DUE_FILTER_KEYS = ["overdue", "today", "upcoming"];

export default function Tasks() {
  const { t } = useI18n();
  const { showError, showSuccess } = useSnackbar();
  const { user, role, businessId, canViewFeature, canManageFeature } =
    useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState(EMPTY_TASKS_META);
  const [metaError, setMetaError] = useState("");
  const [tasksData, setTasksData] = useState({
    items: [],
    total: 0,
    limit: 20,
    offset: 0,
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [staffMembers, setStaffMembers] = useState([]);
  const [detailTask, setDetailTask] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [formMode, setFormMode] = useState("");
  const [formTaskId, setFormTaskId] = useState("");
  const [formValues, setFormValues] = useState(() =>
    buildEmptyTaskForm(EMPTY_TASKS_META),
  );
  const [formError, setFormError] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [statusDialog, setStatusDialog] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusError, setStatusError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [queryInput, setQueryInput] = useState(
    () => searchParams.get("q") || "",
  );
  const debouncedQuery = useDebouncedValue(queryInput, 300);
  const canViewTasks = canViewFeature("tasks");
  const canManageTasks = canManageFeature("tasks");
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get("limit")))
    ? Number(searchParams.get("limit"))
    : 20;
  const statusFilter = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const dueFilter = searchParams.get("due") || "";
  const scopeFilter =
    searchParams.get("scope") || (role === "staff" ? "mine" : "");
  const viewMode = searchParams.get("view") === "board" ? "board" : "list";
  const selectedTaskId = searchParams.get("task") || "";
  const currentUserId = user?.id || "";

  const currentTaskIds = tasksData.items.map((task) => task.id);
  const hasNextPage =
    tasksData.offset + tasksData.items.length < tasksData.total;
  const viewReadOnlyNotice = canViewTasks && !canManageTasks;
  const activeTaskFromList = currentTaskIds.includes(formTaskId)
    ? tasksData.items.find((task) => task.id === formTaskId)
    : null;
  const statusOptions = useMemo(() => {
    const statuses = meta.statuses.length
      ? meta.statuses
      : EMPTY_TASKS_META.statuses;
    return statuses.map((status) => ({
      value: status.key,
      label: status.label || humanizeTaskKey(status.key),
      description: status.description || "",
      ...getTaskStatusPalette(status.key),
    }));
  }, [meta.statuses]);

  const dueFilterLabels = useMemo(
    () => ({
      overdue: t("tasks.badges.overdue"),
      today: t("tasks.badges.today"),
      upcoming: t("tasks.badges.upcoming"),
    }),
    [t],
  );

  // Chips describing every active filter (besides scope/view), each removable on its own.
  const activeFilterChips = useMemo(() => {
    const chips = [];

    if (statusFilter) {
      const match = meta.statuses.find((status) => status.key === statusFilter);
      chips.push({
        key: "status",
        label: match?.label || humanizeTaskKey(statusFilter),
        onClear: () => handleFilterChange("status", ""),
      });
    }

    if (priorityFilter) {
      const match = meta.priorities.find(
        (priority) => priority.key === priorityFilter,
      );
      chips.push({
        key: "priority",
        label: match?.label || humanizeTaskKey(priorityFilter),
        onClear: () => handleFilterChange("priority", ""),
      });
    }

    if (dueFilter) {
      chips.push({
        key: "due",
        label: dueFilterLabels[dueFilter] || humanizeTaskKey(dueFilter),
        onClear: () => handleFilterChange("due", ""),
      });
    }

    if (debouncedQuery.trim()) {
      chips.push({
        key: "query",
        label: `“${debouncedQuery.trim()}”`,
        onClear: () => setQueryInput(""),
      });
    }

    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    statusFilter,
    priorityFilter,
    dueFilter,
    debouncedQuery,
    meta,
    dueFilterLabels,
  ]);

  const clearAllFilters = () => {
    setQueryInput("");
    updateParams(
      { status: null, priority: null, due: null, q: null },
      { resetPage: true },
    );
  };

  const updateParams = (updates = {}, { resetPage = false } = {}) => {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, String(value));
    });

    if (resetPage) {
      nextParams.delete("page");
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

    if (scopeFilter === "assigned") params.assignedTo = "me";
    if (scopeFilter === "created") params.createdBy = "me";
    if (scopeFilter === "mine") params.participation = "mine";

    return params;
  }, [
    debouncedQuery,
    dueFilter,
    page,
    pageSize,
    priorityFilter,
    scopeFilter,
    statusFilter,
  ]);

  const loadMeta = async () => {
    try {
      const payload = await api.getTaskMeta({ force: true });
      setMeta(payload || EMPTY_TASKS_META);
      setMetaError("");
      return payload || EMPTY_TASKS_META;
    } catch (error) {
      setMeta(EMPTY_TASKS_META);
      setMetaError(error.message || "");
      return EMPTY_TASKS_META;
    }
  };

  const loadTasks = async ({ silent = false } = {}) => {
    if (!canViewTasks || !businessId) {
      setTasksData({ items: [], total: 0, limit: pageSize, offset: 0 });
      setLoadError("");
      return;
    }

    if (!silent) setLoading(true);
    setLoadError("");

    try {
      const payload = await api.listTasks(taskQueryParams, { force: true });
      setTasksData(payload);
    } catch (error) {
      setTasksData({ items: [], total: 0, limit: pageSize, offset: 0 });
      setLoadError(error.message || t("auth.errors.generic"));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadDetail = async (taskId) => {
    if (!taskId) {
      setDetailTask(null);
      setDetailError("");
      setDetailLoading(false);
      return null;
    }

    setDetailLoading(true);
    setDetailError("");

    try {
      const payload = await api.getTask(taskId);
      const normalized = normalizeTaskDetail(payload);
      setDetailTask(normalized);
      emitTasksSync({ type: "task-opened", taskId });
      return normalized;
    } catch (error) {
      setDetailTask(null);
      setDetailError(error.message || t("auth.errors.generic"));
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

  // One-direction sync: debounced input value → URL search param
  useEffect(() => {
    if (searchParams.get("q") === debouncedQuery) return;
    updateParams({ q: debouncedQuery || null }, { resetPage: true });
  }, [debouncedQuery]);

  useEffect(() => {
    loadMeta().catch(() => {});
  }, []);

  useEffect(() => {
    loadTasks().catch(() => {});
  }, [businessId, canViewTasks, taskQueryParams]);

  useEffect(
    () =>
      subscribeToTasksSync(() => {
        loadTasks({ silent: true }).catch(() => {});
      }),
    [businessId, canViewTasks, taskQueryParams],
  );

  useEffect(() => {
    if (!selectedTaskId) {
      setDetailTask(null);
      setDetailError("");
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
    if (searchParams.get("create") !== "1" || !canManageTasks) return;
    setFormMode("create");
    setFormTaskId("");
    setFormValues(buildEmptyTaskForm(meta));
    setFormError("");
  }, [canManageTasks, meta, searchParams]);

  const closeDetail = () => updateParams({ task: null });

  const closeForm = () => {
    setFormMode("");
    setFormTaskId("");
    setFormError("");
    updateParams({ create: null });
  };

  const openCreateForm = () => {
    setFormMode("create");
    setFormTaskId("");
    setFormValues(buildEmptyTaskForm(meta));
    setFormError("");
    updateParams({ create: 1, task: null });
  };

  const openEditForm = (task) => {
    const source = task || detailTask || activeTaskFromList;
    if (!source) return;
    setFormMode("edit");
    setFormTaskId(source.id);
    setFormValues(buildTaskFormFromTask(source, meta));
    setFormError("");
  };

  const taskHrefFor = (taskId) => buildTaskPath(searchParams, taskId);

  const handleFilterChange = (key, value) =>
    updateParams({ [key]: value || null }, { resetPage: true });

  const handleFormFieldChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const payload = buildTaskMutationPayload(formValues);

    setFormSaving(true);
    setFormError("");

    try {
      const response =
        formMode === "edit" && formTaskId
          ? await api.updateTask(formTaskId, payload)
          : await api.createTask(payload);
      const savedTask = normalizeTaskDetail(response);

      emitTasksSync({
        type: formMode === "edit" ? "task-updated" : "task-created",
        taskId: savedTask.id,
      });
      showSuccess(
        formMode === "edit"
          ? t("tasks.feedback.updated")
          : t("tasks.feedback.created"),
      );
      closeForm();
      updateParams({ task: savedTask.id, create: null });
      await loadTasks({ silent: true });
      await loadDetail(savedTask.id);
    } catch (error) {
      setFormError(error.message || t("auth.errors.generic"));
    } finally {
      setFormSaving(false);
    }
  };

  const openStatusDialog = (task) => {
    const source = task || detailTask;
    if (!source || !canManageTasks) return;

    setStatusDialog(source);
    setNewStatus(
      source.status ||
        meta.statuses[0]?.key ||
        EMPTY_TASKS_META.statuses[0]?.key ||
        "",
    );
    setStatusError("");
  };

  const closeStatusDialog = () => {
    setStatusDialog(null);
    setStatusError("");
  };

  const handleStatusSubmit = async () => {
    if (!statusDialog?.id || newStatus === statusDialog.status) return;

    setStatusSaving(true);
    setStatusError("");

    try {
      const response = await api.updateTask(statusDialog.id, {
        status: newStatus,
      });
      const nextTask = normalizeTaskDetail(response);
      setDetailTask((current) =>
        current?.id === nextTask.id ? nextTask : current,
      );
      emitTasksSync({ type: "task-status-updated", taskId: nextTask.id });
      showSuccess(t("tasks.feedback.statusUpdated"));
      closeStatusDialog();
      await loadTasks({ silent: true });
    } catch (error) {
      setStatusError(error.message || t("auth.errors.generic"));
      showError(error.message || t("auth.errors.generic"));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    const content = String(commentValue || "").trim();
    if (!detailTask?.id || !content) return;

    setCommentSaving(true);
    setDetailError("");

    try {
      await api.createTaskComment(detailTask.id, { content });
      setCommentValue("");
      emitTasksSync({ type: "task-comment-added", taskId: detailTask.id });
      showSuccess(t("tasks.feedback.commentAdded"));
      await loadDetail(detailTask.id);
      await loadTasks({ silent: true });
    } catch (error) {
      setDetailError(error.message || t("auth.errors.generic"));
      showError(error.message || t("auth.errors.generic"));
    } finally {
      setCommentSaving(false);
    }
  };

  const canEditSpecificTask = (task) =>
    canManageTasks && canEditTaskContent(task, user, role);
  const completedCount = tasksData.items.filter((task) =>
    isTaskCompleted(task),
  ).length;
  const unreadCount = tasksData.items.filter((task) =>
    hasUnreadTaskActivity(task, currentUserId),
  ).length;
  const overdueCount = tasksData.items.filter(
    (task) => getTaskDueState(task) === "overdue",
  ).length;

  if (!canViewTasks) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("tasks.pageTitle")}
          subtitle={t("tasks.pageSubtitle")}
        />
        <Notice
          title={t("tasks.notAvailable.title")}
          description={t("tasks.notAvailable.description")}
          tone="warn"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28 md:pb-0">
      <PageHeader
        title={t("tasks.pageTitle")}
        subtitle={t("tasks.pageSubtitle")}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex overflow-hidden rounded-full border border-secondary-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => handleFilterChange("view", "list")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "list"
                    ? "bg-primary-600 text-white"
                    : "text-secondary-700"
                }`}
              >
                <List size={15} />
                {t("tasks.view.list")}
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange("view", "board")}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                  viewMode === "board"
                    ? "bg-primary-600 text-white"
                    : "text-secondary-700"
                }`}
              >
                <Columns3 size={15} />
                {t("tasks.view.board")}
              </button>
            </div>

            {canManageTasks ? (
              <button
                type="button"
                className="btn-primary gap-2 justify-center"
                onClick={openCreateForm}
              >
                <Plus size={16} />
                {t("tasks.actions.newTask")}
              </button>
            ) : null}
          </div>
        }
      />

      {viewReadOnlyNotice ? (
        <Notice
          title={t("tasks.readOnly.title")}
          description={t("tasks.readOnly.description")}
          tone="info"
        />
      ) : null}

      {metaError ? <Notice title={metaError} tone="warn" /> : null}
      {loadError ? <Notice title={loadError} tone="error" /> : null}

      {/* Task Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <StatsCard
          title={t("tasks.summary.openTasks")}
          value={Math.max(tasksData.total - completedCount, 0)}
          icon={ClipboardList}
          tone="default"
        />
        <StatsCard
          title={t("tasks.summary.overdue")}
          value={overdueCount}
          icon={Clock}
          tone="danger"
        />
        <StatsCard
          title={t("tasks.summary.unread")}
          value={unreadCount}
          icon={BellRing}
          tone="info"
        />
      </div>

      {/* Task Filters */}
      <div className="card space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-secondary-400" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-400">
                {t("tasks.filters.title")}
              </p>
              {activeFilterChips.length ? (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-100 px-1.5 text-[11px] font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  {activeFilterChips.length}
                </span>
              ) : null}
            </div>
            <TaskScopeFilter
              value={scopeFilter}
              onChange={(value) => handleFilterChange("scope", value)}
              t={t}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <label className="relative block w-full sm:w-72">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400"
              />

              <input
                type="text"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder={t("tasks.filters.searchPlaceholder")}
                className="h-11 w-full rounded-xl border border-secondary-200 bg-white pl-10 pr-9 text-sm shadow-sm transition-all duration-200 placeholder:text-secondary-400 focus:border-slate-300 focus:outline-none focus:ring-4 focus:ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:border-slate-600 dark:focus:ring-slate-800"
              />

              {queryInput ? (
                <button
                  type="button"
                  onClick={() => setQueryInput("")}
                  aria-label={t("common.clear")}
                  className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-secondary-400 transition hover:bg-secondary-100 hover:text-secondary-600 dark:hover:bg-slate-800"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>

            <button
              type="button"
              className="btn-ghost gap-2 justify-center"
              onClick={() => loadTasks()}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {t("tasks.actions.refresh")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label" htmlFor="tasks-status-filter">
              {t("common.status")}
            </label>
            <select
              id="tasks-status-filter"
              className="input mt-1"
              value={statusFilter}
              onChange={(event) =>
                handleFilterChange("status", event.target.value)
              }
            >
              <option value="">{t("tasks.filters.allStatuses")}</option>
              {meta.statuses.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tasks-priority-filter">
              {t("tasks.form.priority")}
            </label>
            <select
              id="tasks-priority-filter"
              className="input mt-1"
              value={priorityFilter}
              onChange={(event) =>
                handleFilterChange("priority", event.target.value)
              }
            >
              <option value="">{t("tasks.filters.allPriorities")}</option>
              {meta.priorities.map((priority) => (
                <option key={priority.key} value={priority.key}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tasks-due-filter">
              {t("tasks.filters.due")}
            </label>
            <select
              id="tasks-due-filter"
              className="input mt-1"
              value={dueFilter}
              onChange={(event) =>
                handleFilterChange("due", event.target.value)
              }
            >
              <option value="">{t("tasks.filters.allDueStates")}</option>
              {DUE_FILTER_KEYS.map((key) => (
                <option key={key} value={key}>
                  {dueFilterLabels[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeFilterChips.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-secondary-200/70 pt-4 dark:border-slate-800/70">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary-400">
              {t("tasks.filters.active")}
            </span>

            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onClear}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
              >
                {chip.label}
                <X size={12} />
              </button>
            ))}

            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto text-xs font-semibold text-secondary-500 underline-offset-2 transition hover:text-primary-600 hover:underline dark:text-secondary-400"
            >
              {t("tasks.filters.clearAll")}
            </button>
          </div>
        ) : null}
      </div>

      {!businessId ? (
        <Notice
          title={t("tasks.businessRequired.title")}
          description={t("tasks.businessRequired.description")}
          tone="warn"
        />
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-secondary-200/70 bg-mist/80 px-4 py-10 text-center text-sm text-secondary-500 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-secondary-400">
          {t("tasks.loading.list")}
        </div>
      ) : tasksData.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-secondary-200/80 bg-white/80 px-4 py-12 text-center dark:border-slate-800/70 dark:bg-slate-950/50">
          <h3 className="font-serif text-xl text-ink">
            {t("tasks.empty.title")}
          </h3>
          <p className="mt-2 text-sm text-secondary-500">
            {t("tasks.empty.description")}
          </p>
          {canManageTasks ? (
            <div className="mt-5">
              <button
                type="button"
                className="btn-primary gap-2"
                onClick={openCreateForm}
              >
                <Plus size={16} />
                {t("tasks.actions.newTask")}
              </button>
            </div>
          ) : null}
        </div>
      ) : viewMode === "board" ? (
        <TaskBoard
          tasks={tasksData.items}
          meta={meta}
          currentUserId={currentUserId}
          taskHrefFor={taskHrefFor}
          onEditTask={openEditForm}
          onStatusClick={openStatusDialog}
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
              onStatusClick={() => openStatusDialog(task)}
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
        onPageSizeChange={(size) =>
          updateParams({ limit: size }, { resetPage: true })
        }
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
        onOpenStatusDialog={() => openStatusDialog(detailTask)}
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

      <Dialog
        isOpen={Boolean(statusDialog)}
        onClose={closeStatusDialog}
        title={t("tasks.detail.updateStatus")}
        size="sm"
        footer={
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="btn-ghost w-full sm:w-auto sm:flex-1"
              onClick={closeStatusDialog}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary w-full justify-center sm:w-auto sm:flex-1"
              onClick={handleStatusSubmit}
              disabled={
                statusSaving ||
                !statusDialog ||
                newStatus === statusDialog.status
              }
            >
              {statusSaving
                ? t("common.saving")
                : t("tasks.detail.updateStatus")}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {statusError ? <Notice title={statusError} tone="error" /> : null}

          {statusDialog ? (
            <div className="rounded-2xl bg-mist px-4 py-3 text-sm dark:bg-slate-900/60">
              <p className="font-semibold text-ink dark:text-slate-200">
                {statusDialog.title || t("tasks.detail.title")}
              </p>
              <p className="mt-1 text-secondary-500">
                {getTaskStatusLabel(statusDialog.status, meta)}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            {statusOptions.map((option) => {
              const isSelected = newStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNewStatus(option.value)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                    isSelected
                      ? option.selectedClass
                      : "border-secondary-200 bg-white hover:border-secondary-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                  }`}
                >
                  <span
                    className={`h-3 w-3 shrink-0 rounded-full ${option.dotClass}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink dark:text-slate-200">
                      {option.label}
                    </p>
                    {option.description ? (
                      <p className="text-xs text-secondary-500">
                        {option.description}
                      </p>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <Check size={16} className={option.checkClass} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </Dialog>

      {canViewTasks ? (
        <div className="rounded-3xl border border-secondary-200/70 bg-white/80 px-4 py-3 text-sm text-secondary-500 dark:border-slate-800/70 dark:bg-slate-950/50 dark:text-secondary-400">
          <span>{t("tasks.footerHint")}</span>
          <Link
            className="ml-2 font-semibold text-primary-600 dark:text-primary-300"
            to={scopeFilter === "mine" ? "/app/tasks" : "/app/tasks?scope=mine"}
          >
            {t("tasks.footerLink")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
