import { useState, useCallback } from "react";

/**
 * @typedef {'meta'|'records'|'attendance'|'submit'|'delete'} LoadingKey
 */

/**
 * @typedef {Object} LoadingState
 * @property {boolean} meta
 * @property {boolean} records
 * @property {boolean} attendance
 * @property {boolean} submit
 * @property {boolean} delete
 */

/**
 * Consolidated loading state hook for the Staff Salary Profile page.
 *
 * @param {Partial<LoadingState>} [initial]
 * @returns {LoadingState & { setLoading: (key: LoadingKey, value: boolean) => void, isAnyLoading: boolean, isLoading: (keys: LoadingKey[]) => boolean }}
 */
export function useLoadingState(initial = {}) {
  const [state, setState] = useState({
    meta: initial.meta ?? false,
    records: initial.records ?? false,
    attendance: initial.attendance ?? false,
    submit: initial.submit ?? false,
    delete: initial.delete ?? false,
  });

  const setLoading = useCallback((key, value) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isAnyLoading = Object.values(state).some(Boolean);
  const isLoading = useCallback((keys) => keys.some((k) => state[k]), [state]);

  return { ...state, setLoading, isAnyLoading, isLoading };
}
