import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog.tsx';
import Notice from '@/components/ui/Notice';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n.jsx';
import ShiftChecklist from './ShiftChecklist.jsx';
import { useStudentLookups } from './useStudentLookups';
import { useStudentsModule } from './useStudentsModule';

/** Change an enrollment's shifts or end date. The fee cannot change here. */
export default function EnrollmentEditDialog({ isOpen, mode = 'shifts', enrollment, onClose, onSaved }) {
  const { t } = useI18n();
  const { handleError } = useStudentsModule();
  const lookups = useStudentLookups({ courses: false });
  const [shiftIds, setShiftIds] = useState([]);
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !enrollment) return;
    setShiftIds((enrollment.shifts || []).map((shift) => String(shift.id)));
    setEndDate(enrollment.endDate ? String(enrollment.endDate).slice(0, 10) : '');
    setError('');
  }, [enrollment, isOpen]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const startDate = enrollment?.startDate ? String(enrollment.startDate).slice(0, 10) : '';
    if (mode === 'endDate' && endDate && startDate && endDate < startDate) {
      setError(t('students.enroll.endBeforeStart'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = mode === 'shifts' ? { shiftIds } : { endDate: endDate || null };
      const saved = await api.updateStudentEnrollment(enrollment.id, body);
      onSaved?.(saved);
    } catch (err) {
      const text = handleError(err);
      if (text) setError(text);
    } finally {
      setSaving(false);
    }
  };

  // Keep shifts the enrollment already has, even if they were later made inactive.
  const shiftOptions = [
    ...lookups.shifts,
    ...(enrollment?.shifts || []).filter(
      (shift) => !lookups.shifts.some((item) => String(item.id) === String(shift.id)),
    ),
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={mode === 'shifts' ? t('students.editEnrollment.shiftsTitle') : t('students.editEnrollment.endDateTitle')}
      size="md"
      footer={(
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button type="submit" form="enrollment-edit-form" className="btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('students.editEnrollment.save')}
          </button>
        </div>
      )}
    >
      <form id="enrollment-edit-form" className="space-y-4" onSubmit={submit}>
        <p className="text-sm font-semibold text-ink">{enrollment?.course?.name}</p>
        {error ? <Notice tone="error" title={error} /> : null}
        {mode === 'shifts' ? (
          lookups.loading ? (
            <p className="py-4 text-center text-sm text-secondary-500">{t('common.loading')}</p>
          ) : (
            <ShiftChecklist shifts={shiftOptions} value={shiftIds} onChange={setShiftIds} disabled={saving} />
          )
        ) : (
          <div>
            <label className="label" htmlFor="enrollment-end">{t('students.enroll.endDate')}</label>
            <input
              id="enrollment-end"
              type="date"
              className="input"
              min={enrollment?.startDate ? String(enrollment.startDate).slice(0, 10) : undefined}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        )}
      </form>
    </Dialog>
  );
}
