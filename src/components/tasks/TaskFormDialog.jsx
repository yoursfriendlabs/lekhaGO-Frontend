import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '../ui/Dialog.tsx';

function sortStaff(members = []) {
  return [...members].sort((left, right) => {
    const leftName = String(left?.user?.name || '').trim();
    const rightName = String(right?.user?.name || '').trim();
    return leftName.localeCompare(rightName);
  });
}

export default function TaskFormDialog({
  isOpen,
  mode = 'create',
  form,
  meta,
  staffMembers,
  saving,
  error,
  onClose,
  onSubmit,
  onFieldChange,
  t,
}) {
  const [query, setQuery] = useState('');
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  const filteredStaff = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sortStaff(staffMembers).filter((member) => {
      if (!normalizedQuery) return true;

      return [
        member?.user?.name,
        member?.user?.email,
        member?.jobTitle,
        member?.category?.label,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    });
  }, [query, staffMembers]);

  const footer = (
    <>
      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </button>
      <button type="submit" form="task-form-dialog" className="btn-primary w-full sm:w-auto" disabled={saving}>
        {saving
          ? t('common.saving')
          : isEdit
            ? t('tasks.form.saveChanges')
            : t('tasks.form.createTask')}
      </button>
    </>
  );

  const handleAssigneeToggle = (userId) => {
    const currentIds = Array.isArray(form?.assigneeUserIds) ? form.assigneeUserIds : [];
    const exists = currentIds.includes(userId);
    onFieldChange(
      'assigneeUserIds',
      exists ? currentIds.filter((id) => id !== userId) : [...currentIds, userId],
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('tasks.form.editTitle') : t('tasks.form.createTitle')}
      size="wide"
      footer={footer}
    >
      <form id="task-form-dialog" className="space-y-6" onSubmit={onSubmit}>
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
            <div>
              <label className="label" htmlFor="task-title">{t('tasks.form.title')}</label>
              <input
                id="task-title"
                className="input mt-1"
                value={form?.title || ''}
                onChange={(event) => onFieldChange('title', event.target.value)}
                placeholder={t('tasks.form.titlePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="task-description">{t('tasks.form.description')}</label>
              <textarea
                id="task-description"
                className="input mt-1 min-h-36 resize-y"
                value={form?.description || ''}
                onChange={(event) => onFieldChange('description', event.target.value)}
                placeholder={t('tasks.form.descriptionPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-5 dark:border-slate-800/70 dark:bg-slate-950/60">
            <div>
              <label className="label" htmlFor="task-priority">{t('tasks.form.priority')}</label>
              <select
                id="task-priority"
                className="input mt-1"
                value={form?.priority || ''}
                onChange={(event) => onFieldChange('priority', event.target.value)}
              >
                <option value="">{t('tasks.filters.allPriorities')}</option>
                {meta.priorities.map((priority) => (
                  <option key={priority.key} value={priority.key}>{priority.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="task-status">{t('tasks.form.status')}</label>
              <select
                id="task-status"
                className="input mt-1"
                value={form?.status || ''}
                onChange={(event) => onFieldChange('status', event.target.value)}
              >
                <option value="">{t('tasks.filters.allStatuses')}</option>
                {meta.statuses.map((status) => (
                  <option key={status.key} value={status.key}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="task-due-date">{t('tasks.form.dueDate')}</label>
              <input
                id="task-due-date"
                className="input mt-1"
                type="date"
                value={form?.dueDate || ''}
                onChange={(event) => onFieldChange('dueDate', event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200/70 bg-white/90 p-5 dark:border-slate-800/70 dark:bg-slate-950/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('tasks.form.assignees')}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('tasks.form.assigneesHint')}</p>
            </div>

            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('tasks.form.searchStaff')}
              />
            </label>
          </div>

          {filteredStaff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
              {staffMembers.length === 0 ? t('tasks.form.noStaff') : t('tasks.form.noStaffMatches')}
            </div>
          ) : (
            <div className="grid max-h-80 gap-3 overflow-y-auto md:grid-cols-2">
              {filteredStaff.map((member) => {
                const userId = member?.user?.id;
                const checked = Array.isArray(form?.assigneeUserIds) && form.assigneeUserIds.includes(userId);

                return (
                  <label
                    key={userId || member?.membershipId}
                    className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                      checked
                        ? 'border-primary-300 bg-primary-50/70 dark:border-primary-500/40 dark:bg-primary-500/10'
                        : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800/70 dark:bg-slate-900/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={() => handleAssigneeToggle(userId)}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{member?.user?.name || t('tasks.detail.unknownUser')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{member?.jobTitle || member?.category?.label || t('tasks.detail.staffMember')}</p>
                      {member?.user?.email ? (
                        <p className="mt-1 break-all text-xs text-slate-400 dark:text-slate-500">{member.user.email}</p>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </section>
      </form>
    </Dialog>
  );
}
