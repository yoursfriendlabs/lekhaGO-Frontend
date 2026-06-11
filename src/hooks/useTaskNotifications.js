import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import {
  EMPTY_TASKS_NOTIFICATION_SUMMARY,
  emitTasksSync,
  subscribeToTasksSync,
} from '../lib/tasks';

export function useTaskNotifications({ enabled = true } = {}) {
  const { businessId, canViewFeature } = useAuth();
  const [summary, setSummary] = useState(EMPTY_TASKS_NOTIFICATION_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canViewTasks = canViewFeature('tasks');
  const isEnabled = enabled && Boolean(businessId) && canViewTasks;

  const refresh = useCallback(async ({ silent = false, force = true } = {}) => {
    if (!isEnabled) {
      setSummary(EMPTY_TASKS_NOTIFICATION_SUMMARY);
      setError('');
      setLoading(false);
      return EMPTY_TASKS_NOTIFICATION_SUMMARY;
    }

    if (!silent) setLoading(true);
    setError('');

    try {
      const payload = await api.getTaskNotificationSummary({ force });
      setSummary(payload || EMPTY_TASKS_NOTIFICATION_SUMMARY);
      return payload;
    } catch (loadError) {
      setSummary(EMPTY_TASKS_NOTIFICATION_SUMMARY);
      setError(loadError?.message || 'Request failed');
      throw loadError;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isEnabled]);

  const markAllRead = useCallback(async () => {
    if (!isEnabled) return null;

    await api.markTaskNotificationsRead();
    const payload = await refresh({ silent: true, force: true });
    emitTasksSync({ type: 'notifications-read' });
    return payload;
  }, [isEnabled, refresh]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => subscribeToTasksSync(() => {
    refresh({ silent: true, force: true }).catch(() => {});
  }), [refresh]);

  return {
    summary,
    loading,
    error,
    refresh,
    markAllRead,
    canViewTasks: isEnabled,
  };
}
