import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n.jsx';
import { useBusinessSettings } from '@/lib/business/businessSettings';
import { getStudentAccess, hasStudentsAddon, isAddonRequiredError } from '@/lib/students/access';
import { errorText } from '@/lib/students/utils';

/**
 * Access flags for the students screens plus one error handler.
 * A 403 ADDON_REQUIRED means the add-on was switched off: refresh the
 * business profile (which hides the tab) and leave the module.
 */
export function useStudentsModule() {
  const { canViewFeature, canManageFeature } = useAuth();
  const { businessProfile, reloadSettings } = useBusinessSettings();
  const { t } = useI18n();
  const navigate = useNavigate();

  const access = useMemo(
    () => getStudentAccess(canViewFeature, canManageFeature),
    [canManageFeature, canViewFeature],
  );

  const handleError = useCallback((error, fallback) => {
    if (isAddonRequiredError(error)) {
      reloadSettings?.();
      navigate('/app', {
        replace: true,
        state: { notice: { title: t('students.addonGone'), tone: 'warn' } },
      });
      return '';
    }
    return errorText(error, fallback);
  }, [navigate, reloadSettings, t]);

  return {
    ...access,
    enabled: hasStudentsAddon(businessProfile),
    handleError,
  };
}
