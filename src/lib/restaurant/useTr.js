import { useCallback } from 'react';
import { useI18n } from '@/lib/i18n.jsx';

function interpolate(text, vars) {
  if (!vars) return text;
  return String(text).replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? String(vars[key]) : match));
}

/**
 * Translation helper with English fallbacks: restaurant keys may not exist in
 * the dictionaries yet, and `t()` returns the key when missing.
 */
export function useTr() {
  const { t } = useI18n();
  return useCallback(
    (key, fallback, vars) => {
      const value = t(key, vars);
      if (value === key || value === undefined || value === null) return interpolate(fallback, vars);
      return value;
    },
    [t],
  );
}
