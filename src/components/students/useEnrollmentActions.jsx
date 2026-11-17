import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import { useSnackbar } from '@/lib/snackbar.jsx';
import CollectFeeDialog from './CollectFeeDialog.jsx';
import EnrollmentEditDialog from './EnrollmentEditDialog.jsx';
import { useStudentsModule } from './useStudentsModule';

/**
 * Collect fee, change shifts / end date, complete and drop — shared by the
 * student detail, dues and enrollments screens.
 * `onChanged(enrollment?)` runs after any change so the screen can refresh.
 */
export function useEnrollmentActions({ onChanged, studentName } = {}) {
  const { t } = useI18n();
  const { showError, showSuccess } = useSnackbar();
  const { handleError } = useStudentsModule();
  const [collect, setCollect] = useState(null);
  const [edit, setEdit] = useState(null); // { mode, enrollment }
  const [statusChange, setStatusChange] = useState(null); // { status, enrollment }
  const [busy, setBusy] = useState(false);

  const applyStatus = async () => {
    if (!statusChange || busy) return;
    setBusy(true);
    try {
      const saved = await api.updateStudentEnrollment(statusChange.enrollment.id, { status: statusChange.status });
      showSuccess?.(t('students.enrollment.statusChanged'));
      setStatusChange(null);
      onChanged?.(saved);
    } catch (err) {
      const text = handleError(err);
      if (text) showError?.(text);
    } finally {
      setBusy(false);
    }
  };

  const courseName = statusChange?.enrollment?.course?.name || '';

  const dialogs = (
    <>
      <CollectFeeDialog
        isOpen={Boolean(collect)}
        enrollment={collect}
        studentName={studentName || collect?.student?.name}
        onClose={() => setCollect(null)}
        onPaid={(response) => onChanged?.(response?.enrollment)}
      />
      <EnrollmentEditDialog
        isOpen={Boolean(edit)}
        mode={edit?.mode}
        enrollment={edit?.enrollment}
        onClose={() => setEdit(null)}
        onSaved={(saved) => {
          setEdit(null);
          showSuccess?.(t('students.enrollment.statusChanged'));
          onChanged?.(saved);
        }}
      />
      <ConfirmDialog
        isOpen={Boolean(statusChange)}
        onClose={() => setStatusChange(null)}
        onConfirm={applyStatus}
        confirming={busy}
        variant={statusChange?.status === 'dropped' ? 'danger' : 'primary'}
        title={statusChange?.status === 'dropped' ? t('students.enrollment.dropTitle') : t('students.enrollment.completeTitle')}
        description={statusChange?.status === 'dropped'
          ? t('students.enrollment.dropDescription', { course: courseName })
          : t('students.enrollment.completeDescription', { course: courseName })}
        confirmLabel={statusChange?.status === 'dropped' ? t('students.enrollment.drop') : t('students.enrollment.complete')}
      />
    </>
  );

  return {
    onCollect: setCollect,
    onChangeShifts: (enrollment) => setEdit({ mode: 'shifts', enrollment }),
    onChangeEndDate: (enrollment) => setEdit({ mode: 'endDate', enrollment }),
    onComplete: (enrollment) => setStatusChange({ status: 'completed', enrollment }),
    onDrop: (enrollment) => setStatusChange({ status: 'dropped', enrollment }),
    dialogs,
  };
}
