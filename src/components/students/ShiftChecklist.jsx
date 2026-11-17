import { useI18n } from '@/lib/i18n.jsx';
import { shiftDaysLabel, shiftTimeLabel } from '@/lib/students/utils';

/** Pick any number of shifts. */
export default function ShiftChecklist({ shifts = [], value = [], onChange, disabled = false }) {
  const { t } = useI18n();
  const selected = new Set((value || []).map(String));

  if (!shifts.length) {
    return <p className="text-xs text-secondary-500">{t('students.enroll.noShiftsSetUp')}</p>;
  }

  const toggle = (id) => {
    const key = String(id);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.([...next]);
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {shifts.map((shift) => {
        const checked = selected.has(String(shift.id));
        return (
          <label
            key={shift.id}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
              checked ? 'border-primary bg-primary/5' : 'border-secondary-200 hover:bg-secondary-50'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              type="checkbox"
              className="mt-0.5"
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(shift.id)}
            />
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{shift.name}</span>
              <span className="block text-xs text-secondary-500">
                {[shiftTimeLabel(shift), shiftDaysLabel(shift, t)].filter(Boolean).join(' · ')}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
