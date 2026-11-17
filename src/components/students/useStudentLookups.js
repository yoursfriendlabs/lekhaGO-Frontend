import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { asList } from '@/lib/students/utils';

/**
 * Active courses and shifts for pickers. Inactive ones are hidden because
 * the server rejects them.
 */
export function useStudentLookups({ courses = true, shifts = true, includeInactive = false, mine = false } = {}) {
  const [state, setState] = useState({ courses: [], shifts: [], loading: true, error: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const activeFilter = includeInactive ? {} : { active: true };
      const [coursePayload, shiftPayload] = await Promise.all([
        courses ? api.listStudentCourses({ ...activeFilter, limit: 200 }) : null,
        shifts ? api.listStudentShifts({ ...activeFilter, ...(mine ? { mine: true } : {}), limit: 200 }) : null,
      ]);
      const keep = (item) => includeInactive || item?.isActive !== false;
      setState({
        courses: asList(coursePayload).filter(keep),
        shifts: asList(shiftPayload).filter(keep),
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, [courses, includeInactive, mine, shifts]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
