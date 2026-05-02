import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../../../components/ui/Dialog.tsx';
import { ledgerEntrySchema, leaveRequestSchema, payrollRunSchema, shiftAssignmentSchema, shiftTemplateSchema, staffRecordSchema, attendanceCorrectionSchema, toValidationErrors } from '../schemas/staffSchemas';
import type {
  AttendanceCorrectionValues,
  AttendanceRecord,
  LeaveRequest,
  LeaveRequestFormValues,
  LinkedAccount,
  LedgerEntry,
  LedgerEntryFormValues,
  PayrollRunFormValues,
  ShiftAssignmentFormValues,
  ShiftTemplate,
  ShiftTemplateFormValues,
  StaffFormValues,
  StaffRecord,
} from '../types/staff';
import { cn, SectionCard } from './StaffPrimitives';

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const salaryTypeOptions: Array<{ value: StaffFormValues['salaryType']; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'commission', label: 'Commission' },
  { value: 'contract', label: 'Contract' },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{message}</p>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const { label, error, className, ...inputProps } = props;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input {...inputProps} className={cn('input mt-1', className)} />
      <FieldError message={error} />
    </label>
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  const { label, error, className, ...textareaProps } = props;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea {...textareaProps} className={cn('input mt-1 min-h-28 resize-y', className)} />
      <FieldError message={error} />
    </label>
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; children: React.ReactNode }) {
  const { label, error, className, children, ...selectProps } = props;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select {...selectProps} className={cn('input mt-1', className)}>
        {children}
      </select>
      <FieldError message={error} />
    </label>
  );
}

function SwitchInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 dark:border-slate-800/70 dark:bg-slate-950/30">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  );
}

function WeekdayCheckboxes({
  label,
  values,
  onChange,
  error,
}: {
  label: string;
  values: number[];
  onChange: (nextValue: number[]) => void;
  error?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {WEEKDAY_OPTIONS.map((day) => {
          const checked = values.includes(day.value);

          return (
            <label
              key={day.value}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                checked
                  ? 'border-primary bg-primary text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-200',
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? values.filter((value) => value !== day.value)
                      : [...values, day.value].sort((left, right) => left - right),
                  )
                }
              />
              {day.label}
            </label>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function parseAndCollect<T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ path: Array<string | number>; message: string }> } } }, values: unknown) {
  const result = schema.safeParse(values);

  if (result.success) {
    return { values: result.data, errors: {} };
  }

  return {
    values: null,
    errors: toValidationErrors(result.error as never),
  };
}

function StaffPreview({ values, linkedAccounts }: { values: StaffFormValues; linkedAccounts: LinkedAccount[] }) {
  const linkedAccount = linkedAccounts.find((account) => account.membershipId === values.linkedMembershipId);

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Directory preview</p>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{values.fullName || 'New staff member'}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{[values.designation, values.department].filter(Boolean).join(' · ') || 'Designation and department pending'}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-900 dark:text-white">{values.salaryAmount || 0}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{values.salaryType}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-200">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Linked account</p>
          <p className="mt-1 font-medium">{linkedAccount?.name || 'Not linked'}</p>
        </div>
        <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-200">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Active status</p>
          <p className="mt-1 font-medium">{values.isActive ? 'Active' : 'Inactive'}</p>
        </div>
      </div>
    </div>
  );
}

const EMPTY_STAFF_VALUES: StaffFormValues = {
  staffCode: '',
  fullName: '',
  email: '',
  phone: '',
  designation: '',
  department: '',
  joinedOn: '',
  salaryType: 'monthly',
  salaryAmount: 0,
  openingAdvanceBalance: 0,
  linkedMembershipId: '',
  isActive: true,
  notes: '',
};

export function StaffRecordDialog({
  isOpen,
  title,
  saving,
  serverError,
  linkedAccounts,
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  title: string;
  saving: boolean;
  serverError?: string;
  linkedAccounts: LinkedAccount[];
  initialValues?: StaffRecord | null;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<StaffFormValues>(EMPTY_STAFF_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;

    setValues(initialValues ? {
      staffCode: initialValues.staffCode,
      fullName: initialValues.fullName,
      email: initialValues.email,
      phone: initialValues.phone,
      designation: initialValues.designation,
      department: initialValues.department,
      joinedOn: initialValues.joinedOn,
      salaryType: initialValues.salaryType,
      salaryAmount: initialValues.salaryAmount,
      openingAdvanceBalance: initialValues.financeSummary.openingAdvanceBalance,
      linkedMembershipId: initialValues.linkedMembershipId || '',
      isActive: initialValues.isActive,
      notes: initialValues.notes,
    } : EMPTY_STAFF_VALUES);
    setErrors({});
  }, [initialValues, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="full"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(staffRecordSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Saving...' : 'Save staff profile'}
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_320px]">
          <div className="space-y-5">
            <SectionCard title="Identity and access" subtitle="Keep the HR profile and the linked workspace account aligned.">
              <div className="grid gap-4 md:grid-cols-2">
                <SelectInput
                  label="Linked account"
                  value={values.linkedMembershipId || ''}
                  onChange={(event) => setValues((current) => ({ ...current, linkedMembershipId: event.target.value }))}
                  error={errors.linkedMembershipId}
                >
                  <option value="">Not linked</option>
                  {linkedAccounts.map((account) => (
                    <option key={account.membershipId} value={account.membershipId}>
                      {account.name} · {account.email}
                    </option>
                  ))}
                </SelectInput>
                <TextInput
                  label="Staff code"
                  value={values.staffCode}
                  onChange={(event) => setValues((current) => ({ ...current, staffCode: event.target.value }))}
                  error={errors.staffCode}
                />
                <TextInput
                  label="Full name"
                  value={values.fullName}
                  onChange={(event) => setValues((current) => ({ ...current, fullName: event.target.value }))}
                  error={errors.fullName}
                />
                <TextInput
                  label="Phone"
                  value={values.phone}
                  onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
                  error={errors.phone}
                />
                <TextInput
                  label="Email"
                  type="email"
                  value={values.email}
                  onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                  error={errors.email}
                />
                <TextInput
                  label="Join date"
                  type="date"
                  value={values.joinedOn}
                  onChange={(event) => setValues((current) => ({ ...current, joinedOn: event.target.value }))}
                  error={errors.joinedOn}
                />
              </div>
            </SectionCard>

            <SectionCard title="Employment profile" subtitle="These fields drive filtering, rostering, and payroll review.">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Designation"
                  value={values.designation}
                  onChange={(event) => setValues((current) => ({ ...current, designation: event.target.value }))}
                  error={errors.designation}
                />
                <TextInput
                  label="Department"
                  value={values.department}
                  onChange={(event) => setValues((current) => ({ ...current, department: event.target.value }))}
                  error={errors.department}
                />
                <SelectInput
                  label="Salary type"
                  value={values.salaryType}
                  onChange={(event) => setValues((current) => ({ ...current, salaryType: event.target.value as StaffFormValues['salaryType'] }))}
                  error={errors.salaryType}
                >
                  {salaryTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectInput>
                <TextInput
                  label="Salary amount"
                  type="number"
                  min={0}
                  value={String(values.salaryAmount)}
                  onChange={(event) => setValues((current) => ({ ...current, salaryAmount: Number(event.target.value) }))}
                  error={errors.salaryAmount}
                />
                <TextInput
                  label="Opening advance balance"
                  type="number"
                  min={0}
                  value={String(values.openingAdvanceBalance)}
                  onChange={(event) => setValues((current) => ({ ...current, openingAdvanceBalance: Number(event.target.value) }))}
                  error={errors.openingAdvanceBalance}
                />
              </div>
              <div className="mt-4">
                <SwitchInput
                  label="Active staff record"
                  checked={values.isActive}
                  onChange={(nextValue) => setValues((current) => ({ ...current, isActive: nextValue }))}
                />
              </div>
            </SectionCard>

            <SectionCard title="Notes" subtitle="Add context that should stay with the staff profile.">
              <TextArea
                label="Notes"
                value={values.notes}
                onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
                error={errors.notes}
              />
            </SectionCard>
          </div>

          <div className="space-y-5">
            <StaffPreview values={values} linkedAccounts={linkedAccounts} />
          </div>
        </div>
      </div>
    </Dialog>
  );
}

const EMPTY_SHIFT_TEMPLATE: ShiftTemplateFormValues = {
  shiftCode: '',
  name: '',
  startTime: '09:00',
  endTime: '17:00',
  crossMidnight: false,
  breakMinutes: 30,
  graceMinutes: 10,
  overtimeThresholdMinutes: 30,
  overtimeRounding: 'nearest_30',
  overtimeMultiplier: 1.5,
  isActive: true,
  workingDays: [1, 2, 3, 4, 5],
  color: '#9b6835',
};

export function ShiftTemplateDialog({
  isOpen,
  saving,
  serverError,
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  initialValues?: ShiftTemplate | null;
  onClose: () => void;
  onSubmit: (values: ShiftTemplateFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<ShiftTemplateFormValues>(EMPTY_SHIFT_TEMPLATE);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ? {
      shiftCode: initialValues.shiftCode,
      name: initialValues.name,
      startTime: initialValues.startTime,
      endTime: initialValues.endTime,
      crossMidnight: initialValues.crossMidnight,
      breakMinutes: initialValues.breakMinutes,
      graceMinutes: initialValues.graceMinutes,
      overtimeThresholdMinutes: initialValues.overtimeThresholdMinutes,
      overtimeRounding: initialValues.overtimeRounding,
      overtimeMultiplier: initialValues.overtimeMultiplier,
      isActive: initialValues.isActive,
      workingDays: initialValues.workingDays,
      color: initialValues.color,
    } : EMPTY_SHIFT_TEMPLATE);
    setErrors({});
  }, [initialValues, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialValues ? 'Edit shift template' : 'Create shift template'}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(shiftTemplateSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Saving...' : 'Save shift'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Shift code" value={values.shiftCode} onChange={(event) => setValues((current) => ({ ...current, shiftCode: event.target.value }))} error={errors.shiftCode} />
          <TextInput label="Shift name" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} error={errors.name} />
          <TextInput label="Start time" type="time" value={values.startTime} onChange={(event) => setValues((current) => ({ ...current, startTime: event.target.value }))} error={errors.startTime} />
          <TextInput label="End time" type="time" value={values.endTime} onChange={(event) => setValues((current) => ({ ...current, endTime: event.target.value }))} error={errors.endTime} />
          <TextInput label="Break minutes" type="number" min={0} value={String(values.breakMinutes)} onChange={(event) => setValues((current) => ({ ...current, breakMinutes: Number(event.target.value) }))} error={errors.breakMinutes} />
          <TextInput label="Grace minutes" type="number" min={0} value={String(values.graceMinutes)} onChange={(event) => setValues((current) => ({ ...current, graceMinutes: Number(event.target.value) }))} error={errors.graceMinutes} />
          <TextInput label="OT threshold (minutes)" type="number" min={0} value={String(values.overtimeThresholdMinutes)} onChange={(event) => setValues((current) => ({ ...current, overtimeThresholdMinutes: Number(event.target.value) }))} error={errors.overtimeThresholdMinutes} />
          <TextInput label="OT multiplier" type="number" min={1} step="0.25" value={String(values.overtimeMultiplier)} onChange={(event) => setValues((current) => ({ ...current, overtimeMultiplier: Number(event.target.value) }))} error={errors.overtimeMultiplier} />
          <SelectInput label="OT rounding" value={values.overtimeRounding} onChange={(event) => setValues((current) => ({ ...current, overtimeRounding: event.target.value as ShiftTemplateFormValues['overtimeRounding'] }))} error={errors.overtimeRounding}>
            <option value="none">None</option>
            <option value="nearest_15">Nearest 15 minutes</option>
            <option value="nearest_30">Nearest 30 minutes</option>
            <option value="nearest_60">Nearest 60 minutes</option>
          </SelectInput>
          <TextInput label="Shift color" type="color" value={values.color} onChange={(event) => setValues((current) => ({ ...current, color: event.target.value }))} error={errors.color} className="h-12" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SwitchInput label="Cross midnight" checked={values.crossMidnight} onChange={(nextValue) => setValues((current) => ({ ...current, crossMidnight: nextValue }))} />
          <SwitchInput label="Active template" checked={values.isActive} onChange={(nextValue) => setValues((current) => ({ ...current, isActive: nextValue }))} />
        </div>
        <WeekdayCheckboxes label="Working days" values={values.workingDays} onChange={(nextValue) => setValues((current) => ({ ...current, workingDays: nextValue }))} error={errors.workingDays} />
      </div>
    </Dialog>
  );
}

const EMPTY_ASSIGNMENT: ShiftAssignmentFormValues = {
  staffIds: [],
  shiftTemplateId: '',
  dateFrom: '',
  dateTo: '',
  weeklyOffDays: [6],
  note: '',
};

export function ShiftAssignmentDialog({
  isOpen,
  saving,
  serverError,
  staffOptions,
  shiftOptions,
  initialStaffIds,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  staffOptions: Array<{ id: string; label: string; detail: string }>;
  shiftOptions: Array<{ id: string; label: string }>;
  initialStaffIds?: string[];
  onClose: () => void;
  onSubmit: (values: ShiftAssignmentFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<ShiftAssignmentFormValues>(EMPTY_ASSIGNMENT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues({
      ...EMPTY_ASSIGNMENT,
      staffIds: initialStaffIds || [],
    });
    setErrors({});
  }, [initialStaffIds, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk shift assignment"
      size="lg"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(shiftAssignmentSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Assigning...' : 'Assign shift'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <SelectInput
          label="Shift template"
          value={values.shiftTemplateId}
          onChange={(event) => setValues((current) => ({ ...current, shiftTemplateId: event.target.value }))}
          error={errors.shiftTemplateId}
        >
          <option value="">Choose a template</option>
          {shiftOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </SelectInput>
        <div>
          <p className="label">Staff members</p>
          <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto rounded-2xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-slate-800/70 dark:bg-slate-950/30">
            {staffOptions.map((staff) => {
              const checked = values.staffIds.includes(staff.id);
              return (
                <label key={staff.id} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/90 px-3 py-3 shadow-sm dark:bg-slate-950/60">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={checked}
                    onChange={() =>
                      setValues((current) => ({
                        ...current,
                        staffIds: checked
                          ? current.staffIds.filter((item) => item !== staff.id)
                          : [...current.staffIds, staff.id],
                      }))
                    }
                  />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{staff.label}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{staff.detail}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <FieldError message={errors.staffIds} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="From" type="date" value={values.dateFrom} onChange={(event) => setValues((current) => ({ ...current, dateFrom: event.target.value }))} error={errors.dateFrom} />
          <TextInput label="To" type="date" value={values.dateTo} onChange={(event) => setValues((current) => ({ ...current, dateTo: event.target.value }))} error={errors.dateTo} />
        </div>
        <WeekdayCheckboxes label="Weekly off days" values={values.weeklyOffDays} onChange={(nextValue) => setValues((current) => ({ ...current, weeklyOffDays: nextValue }))} error={errors.weeklyOffDays} />
        <TextArea label="Roster note" value={values.note || ''} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} />
      </div>
    </Dialog>
  );
}

const EMPTY_CORRECTION: AttendanceCorrectionValues = {
  status: 'present',
  clockIn: '',
  clockOut: '',
  approvalStatus: 'pending',
  correctionReason: '',
};

export function AttendanceCorrectionDialog({
  isOpen,
  saving,
  serverError,
  attendance,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  attendance?: AttendanceRecord | null;
  onClose: () => void;
  onSubmit: (values: AttendanceCorrectionValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<AttendanceCorrectionValues>(EMPTY_CORRECTION);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(attendance ? {
      status: attendance.status,
      clockIn: attendance.clockIn?.slice(11, 16) || '',
      clockOut: attendance.clockOut?.slice(11, 16) || '',
      approvalStatus: attendance.approvalStatus,
      correctionReason: attendance.correctionReason || '',
    } : EMPTY_CORRECTION);
    setErrors({});
  }, [attendance, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Manual attendance correction"
      size="md"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(attendanceCorrectionSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Saving...' : 'Save correction'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <SelectInput label="Attendance status" value={values.status} onChange={(event) => setValues((current) => ({ ...current, status: event.target.value as AttendanceCorrectionValues['status'] }))} error={errors.status}>
          <option value="present">Present</option>
          <option value="late">Late</option>
          <option value="half_day">Half day</option>
          <option value="leave">Leave</option>
          <option value="absent">Absent</option>
          <option value="on_duty">On duty</option>
        </SelectInput>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Clock in" type="time" value={values.clockIn || ''} onChange={(event) => setValues((current) => ({ ...current, clockIn: event.target.value }))} error={errors.clockIn} />
          <TextInput label="Clock out" type="time" value={values.clockOut || ''} onChange={(event) => setValues((current) => ({ ...current, clockOut: event.target.value }))} error={errors.clockOut} />
        </div>
        <SelectInput label="Approval" value={values.approvalStatus} onChange={(event) => setValues((current) => ({ ...current, approvalStatus: event.target.value as AttendanceCorrectionValues['approvalStatus'] }))} error={errors.approvalStatus}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </SelectInput>
        <TextArea label="Reason" value={values.correctionReason} onChange={(event) => setValues((current) => ({ ...current, correctionReason: event.target.value }))} error={errors.correctionReason} />
      </div>
    </Dialog>
  );
}

const EMPTY_LEAVE_REQUEST: LeaveRequestFormValues = {
  staffId: '',
  leaveType: 'casual',
  startDate: '',
  endDate: '',
  reason: '',
  note: '',
};

export function LeaveRequestDialog({
  isOpen,
  saving,
  serverError,
  staffOptions,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  staffOptions: Array<{ id: string; label: string }>;
  onClose: () => void;
  onSubmit: (values: LeaveRequestFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<LeaveRequestFormValues>(EMPTY_LEAVE_REQUEST);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(EMPTY_LEAVE_REQUEST);
    setErrors({});
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create leave request"
      size="md"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(leaveRequestSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Saving...' : 'Submit request'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <SelectInput label="Staff member" value={values.staffId} onChange={(event) => setValues((current) => ({ ...current, staffId: event.target.value }))} error={errors.staffId}>
          <option value="">Choose staff</option>
          {staffOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </SelectInput>
        <SelectInput label="Leave type" value={values.leaveType} onChange={(event) => setValues((current) => ({ ...current, leaveType: event.target.value as LeaveRequestFormValues['leaveType'] }))} error={errors.leaveType}>
          <option value="casual">Casual</option>
          <option value="sick">Sick</option>
          <option value="annual">Annual</option>
          <option value="unpaid">Unpaid</option>
          <option value="emergency">Emergency</option>
        </SelectInput>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Start date" type="date" value={values.startDate} onChange={(event) => setValues((current) => ({ ...current, startDate: event.target.value }))} error={errors.startDate} />
          <TextInput label="End date" type="date" value={values.endDate} onChange={(event) => setValues((current) => ({ ...current, endDate: event.target.value }))} error={errors.endDate} />
        </div>
        <TextArea label="Reason" value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} error={errors.reason} />
        <TextArea label="Manager note" value={values.note || ''} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} />
      </div>
    </Dialog>
  );
}

const EMPTY_PAYROLL_RUN: PayrollRunFormValues = {
  title: '',
  periodStart: '',
  periodEnd: '',
  payoutDate: '',
};

export function PayrollRunDialog({
  isOpen,
  saving,
  serverError,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  onClose: () => void;
  onSubmit: (values: PayrollRunFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<PayrollRunFormValues>(EMPTY_PAYROLL_RUN);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(EMPTY_PAYROLL_RUN);
    setErrors({});
  }, [isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create payroll run"
      size="md"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(payrollRunSchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Creating...' : 'Create payroll'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <TextInput label="Run title" value={values.title} onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))} error={errors.title} />
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Period start" type="date" value={values.periodStart} onChange={(event) => setValues((current) => ({ ...current, periodStart: event.target.value }))} error={errors.periodStart} />
          <TextInput label="Period end" type="date" value={values.periodEnd} onChange={(event) => setValues((current) => ({ ...current, periodEnd: event.target.value }))} error={errors.periodEnd} />
        </div>
        <TextInput label="Payout date" type="date" value={values.payoutDate} onChange={(event) => setValues((current) => ({ ...current, payoutDate: event.target.value }))} error={errors.payoutDate} />
      </div>
    </Dialog>
  );
}

const EMPTY_LEDGER_ENTRY: LedgerEntryFormValues = {
  entryType: 'salary_payment',
  amount: 0,
  entryDate: '',
  referenceMonth: '',
  paymentMethod: '',
  bankName: '',
  note: '',
};

export function LedgerEntryDialog({
  isOpen,
  saving,
  serverError,
  initialValues,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  saving: boolean;
  serverError?: string;
  initialValues?: LedgerEntry | null;
  onClose: () => void;
  onSubmit: (values: LedgerEntryFormValues) => Promise<void> | void;
}) {
  const [values, setValues] = useState<LedgerEntryFormValues>(EMPTY_LEDGER_ENTRY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ? {
      entryType: initialValues.entryType,
      amount: initialValues.amount,
      entryDate: initialValues.entryDate,
      referenceMonth: initialValues.referenceMonth || '',
      paymentMethod: initialValues.paymentMethod || '',
      bankName: initialValues.bankName || '',
      note: initialValues.note || '',
    } : EMPTY_LEDGER_ENTRY);
    setErrors({});
  }, [initialValues, isOpen]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={initialValues ? 'Edit ledger entry' : 'Add ledger entry'}
      size="md"
      footer={(
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              const parsed = parseAndCollect(ledgerEntrySchema, values);
              if (!parsed.values) {
                setErrors(parsed.errors);
                return;
              }
              setErrors({});
              await onSubmit(parsed.values);
            }}
          >
            {saving ? 'Saving...' : 'Save entry'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        {serverError ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{serverError}</p> : null}
        <SelectInput label="Entry type" value={values.entryType} onChange={(event) => setValues((current) => ({ ...current, entryType: event.target.value as LedgerEntryFormValues['entryType'] }))} error={errors.entryType}>
          <option value="salary_payment">Salary payment</option>
          <option value="advance">Advance</option>
          <option value="advance_repayment">Advance repayment</option>
        </SelectInput>
        <TextInput label="Amount" type="number" min={0} value={String(values.amount)} onChange={(event) => setValues((current) => ({ ...current, amount: Number(event.target.value) }))} error={errors.amount} />
        <TextInput label="Entry date" type="date" value={values.entryDate} onChange={(event) => setValues((current) => ({ ...current, entryDate: event.target.value }))} error={errors.entryDate} />
        <TextInput label="Reference month" type="month" value={values.referenceMonth || ''} onChange={(event) => setValues((current) => ({ ...current, referenceMonth: event.target.value }))} error={errors.referenceMonth} />
        <TextInput label="Payment method" value={values.paymentMethod || ''} onChange={(event) => setValues((current) => ({ ...current, paymentMethod: event.target.value }))} error={errors.paymentMethod} />
        <TextInput label="Bank / account" value={values.bankName || ''} onChange={(event) => setValues((current) => ({ ...current, bankName: event.target.value }))} error={errors.bankName} />
        <TextArea label="Note" value={values.note || ''} onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))} error={errors.note} />
      </div>
    </Dialog>
  );
}

export function LeaveRequestDetail({ request }: { request: LeaveRequest }) {
  const fields = useMemo(
    () => [
      { label: 'Staff member', value: request.staffName },
      { label: 'Department', value: request.department },
      { label: 'Leave type', value: request.leaveType },
      { label: 'Period', value: `${request.startDate} → ${request.endDate}` },
      { label: 'Days', value: String(request.days) },
      { label: 'Status', value: request.status },
      { label: 'Requested at', value: request.requestedAt },
      { label: 'Approver', value: request.approverName || 'Pending' },
    ],
    [request],
  );

  return (
    <div className="space-y-5">
      <SectionCard title="Leave request" subtitle="Review the request details before taking action.">
        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="rounded-2xl bg-slate-50/80 px-4 py-3 dark:bg-slate-900/50">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{field.label}</dt>
              <dd className="mt-2 text-sm text-slate-700 dark:text-slate-200">{field.value}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
      <SectionCard title="Reason" subtitle="Submitted message from the staff member.">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{request.reason}</p>
        {request.note ? (
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">Manager note</p>
            <p className="mt-1">{request.note}</p>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
