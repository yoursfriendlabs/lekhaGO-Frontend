import { useEffect, useMemo, useState } from 'react';
import FormSectionCard from '../FormSectionCard.jsx';
import Notice from '../Notice';
import SearchableSelect from '../SearchableSelect';
import { Dialog } from '../ui/Dialog.tsx';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n.jsx';
import { toDateInputValue } from '../../lib/datetime';
import {
  getStaffMemberOption,
  STAFF_SALARY_TYPE_OPTIONS,
} from '../../lib/staff';

const EMPTY_FORM = {
  linkedMembershipId: '',
  staffCode: '',
  fullName: '',
  phone: '',
  email: '',
  designation: '',
  department: '',
  joinedOn: '',
  salaryType: 'monthly',
  salaryAmount: '',
  openingAdvanceBalance: '0',
  isActive: true,
  notes: '',
};

function buildFormState(record = {}) {
  const safeRecord = record && typeof record === 'object' ? record : {};

  return {
    linkedMembershipId: String(safeRecord.linkedMembershipId || '').trim(),
    staffCode: String(safeRecord.staffCode || '').trim(),
    fullName: String(safeRecord.fullName || '').trim(),
    phone: String(safeRecord.phone || '').trim(),
    email: String(safeRecord.email || '').trim(),
    designation: String(safeRecord.designation || '').trim(),
    department: String(safeRecord.department || '').trim(),
    joinedOn: toDateInputValue(safeRecord.joinedOn),
    salaryType: String(safeRecord.salaryType || 'monthly').trim() || 'monthly',
    salaryAmount:
      safeRecord.salaryAmount === 0 || safeRecord.salaryAmount
        ? String(safeRecord.salaryAmount)
        : '',
    openingAdvanceBalance:
      safeRecord.openingAdvanceBalance === 0 || safeRecord.openingAdvanceBalance
        ? String(safeRecord.openingAdvanceBalance)
        : '0',
    isActive: safeRecord.isActive !== false,
    notes: String(safeRecord.notes || ''),
  };
}

function upsertOption(options, option) {
  if (!option?.value) return options;
  if (options.some((item) => item.value === option.value)) return options;
  return [option, ...options];
}

function PreviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50/90 px-3 py-3 dark:bg-slate-900/70">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="text-right text-sm font-medium text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export default function StaffRecordFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  saving = false,
  loading = false,
  errorMessage = '',
}) {
  const { t } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [localError, setLocalError] = useState('');
  const [memberOptions, setMemberOptions] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    setForm(buildFormState(initialValues));
    setLocalError('');
  }, [initialValues, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    let active = true;
    setMembersLoading(true);
    setMembersError('');

    api.listStaffMembers()
      .then((response) => {
        if (!active) return;
        const options = (Array.isArray(response?.members) ? response.members : [])
          .map(getStaffMemberOption)
          .filter(Boolean)
          .sort((left, right) => left.label.localeCompare(right.label));
        setMemberOptions(options);
      })
      .catch((error) => {
        if (!active) return;
        setMemberOptions([]);
        setMembersError(error.message);
      })
      .finally(() => {
        if (!active) return;
        setMembersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const normalizedMemberOptions = useMemo(() => {
    const currentOption = getStaffMemberOption(initialValues?.linkedMember || {
      membershipId: form.linkedMembershipId,
      user: {
        name: form.fullName,
        email: form.email,
        phone: form.phone,
      },
    });

    return upsertOption(memberOptions, currentOption).sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }, [form.email, form.fullName, form.linkedMembershipId, form.phone, initialValues?.linkedMember, memberOptions]);

  const selectedMemberOption = useMemo(
    () => normalizedMemberOptions.find((option) => option.value === form.linkedMembershipId) || null,
    [form.linkedMembershipId, normalizedMemberOptions]
  );

  const salaryTypeOptions = useMemo(() => {
    const options = [...STAFF_SALARY_TYPE_OPTIONS];

    if (form.salaryType && !options.includes(form.salaryType)) {
      options.unshift(form.salaryType);
    }

    return options;
  }, [form.salaryType]);

  const getSalaryTypeOptionLabel = (option) =>
    STAFF_SALARY_TYPE_OPTIONS.includes(option)
      ? t(`staffManagement.salaryTypes.${option}`)
      : option;

  const formatMoney = (value) =>
    t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: Number(value || 0).toFixed(2),
    });

  const previewName = form.fullName.trim() || selectedMemberOption?.member?.user?.name || t('staffManagement.form.previewNameFallback');
  const previewAccess = form.linkedMembershipId
    ? selectedMemberOption?.label || t('staffManagement.form.summaryAccessLinked')
    : t('staffManagement.form.summaryAccessUnlinked');
  const previewRole = [form.designation.trim(), form.department.trim()].filter(Boolean).join(' · ') || t('staffManagement.form.previewRoleFallback');

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setLocalError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const staffCode = form.staffCode.trim();
    const fullName = form.fullName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const linkedMembershipId = form.linkedMembershipId.trim();
    const salaryAmount = Number(form.salaryAmount || 0);
    const openingAdvanceBalance = Number(form.openingAdvanceBalance || 0);

    if (!staffCode) {
      setLocalError(t('staffManagement.validation.staffCodeRequired'));
      return;
    }

    if (!linkedMembershipId && !fullName) {
      setLocalError(t('staffManagement.validation.fullNameRequired'));
      return;
    }

    if (!Number.isFinite(salaryAmount) || salaryAmount < 0) {
      setLocalError(t('staffManagement.validation.salaryAmountInvalid'));
      return;
    }

    if (!Number.isFinite(openingAdvanceBalance)) {
      setLocalError(t('staffManagement.validation.openingAdvanceInvalid'));
      return;
    }

    const payload = {
      linkedMembershipId: linkedMembershipId || undefined,
      staffCode,
      designation: form.designation.trim(),
      department: form.department.trim(),
      joinedOn: form.joinedOn || undefined,
      salaryType: form.salaryType,
      salaryAmount,
      openingAdvanceBalance,
      isActive: Boolean(form.isActive),
      notes: form.notes.trim(),
    };

    if (fullName || !linkedMembershipId) {
      payload.fullName = fullName;
    }

    if (phone || !linkedMembershipId) {
      payload.phone = phone;
    }

    if (email || !linkedMembershipId) {
      payload.email = email;
    }

    await onSubmit(payload);
  };

  const footer = (
    <>
      <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        form="staff-record-form"
        className="btn-primary"
        disabled={saving || loading}
      >
        {saving
          ? t('staffManagement.form.saving')
          : initialValues?.id
            ? t('common.update')
            : t('common.create')}
      </button>
    </>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialValues?.id
          ? t('staffManagement.form.editTitle')
          : t('staffManagement.form.addTitle')
      }
      size="full"
      footer={footer}
    >
      <form id="staff-record-form" className="space-y-5" onSubmit={handleSubmit}>
        {localError ? <Notice title={localError} tone="error" /> : null}
        {errorMessage ? <Notice title={errorMessage} tone="error" /> : null}

        <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] px-4 py-4 dark:border-primary/20 dark:bg-primary/[0.08]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            {t('staffManagement.form.setupLabel')}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t('staffManagement.form.setupDescription')}
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
          <div className="space-y-5">
            <FormSectionCard
              title={t('staffManagement.form.identityTitle')}
              hint={t('staffManagement.form.identityHint')}
            >
              <div className="space-y-4">
                <div>
                  <label className="label">{t('staffManagement.fields.linkedMembershipId')}</label>
                  <div className="mt-1">
                    <SearchableSelect
                      options={normalizedMemberOptions}
                      value={form.linkedMembershipId}
                      onChange={(value) => {
                        setForm((previous) => ({
                          ...previous,
                          linkedMembershipId: value,
                        }));
                        setLocalError('');
                      }}
                      placeholder={
                        membersLoading
                          ? t('common.loading')
                          : t('staffManagement.form.linkedMembershipPlaceholder')
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('staffManagement.form.linkedMembershipHint')}
                  </p>
                  {membersError ? (
                    <p className="mt-1 text-xs text-rose-600">{membersError}</p>
                  ) : null}
                </div>

                {form.linkedMembershipId ? (
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-500/10">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {t('staffManagement.form.membershipDefaultsTitle')}
                    </p>
                    <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-200/90">
                      {t('staffManagement.form.membershipDefaultsDescription')}
                    </p>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="staff-code">
                      {t('staffManagement.fields.staffCode')}
                    </label>
                    <input
                      id="staff-code"
                      name="staffCode"
                      className="input mt-1"
                      value={form.staffCode}
                      onChange={handleChange}
                      placeholder={t('staffManagement.form.staffCodePlaceholder')}
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t('staffManagement.form.staffCodeHint')}
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="staff-full-name">
                      {t('staffManagement.fields.fullName')}
                    </label>
                    <input
                      id="staff-full-name"
                      name="fullName"
                      className="input mt-1"
                      value={form.fullName}
                      onChange={handleChange}
                      placeholder={t('staffManagement.form.fullNamePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="staff-phone">
                      {t('staffManagement.fields.phone')}
                    </label>
                    <input
                      id="staff-phone"
                      name="phone"
                      className="input mt-1"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder={t('staffManagement.form.phonePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="staff-email">
                      {t('staffManagement.fields.email')}
                    </label>
                    <input
                      id="staff-email"
                      name="email"
                      type="email"
                      className="input mt-1"
                      value={form.email}
                      onChange={handleChange}
                      placeholder={t('staffManagement.form.emailPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            </FormSectionCard>

            <FormSectionCard
              title={t('staffManagement.form.workTitle')}
              hint={t('staffManagement.form.workHint')}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="staff-designation">
                    {t('staffManagement.fields.designation')}
                  </label>
                  <input
                    id="staff-designation"
                    name="designation"
                    className="input mt-1"
                    value={form.designation}
                    onChange={handleChange}
                    placeholder={t('staffManagement.form.designationPlaceholder')}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="staff-department">
                    {t('staffManagement.fields.department')}
                  </label>
                  <input
                    id="staff-department"
                    name="department"
                    className="input mt-1"
                    value={form.department}
                    onChange={handleChange}
                    placeholder={t('staffManagement.form.departmentPlaceholder')}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="staff-joined-on">
                    {t('staffManagement.fields.joinedOn')}
                  </label>
                  <input
                    id="staff-joined-on"
                    name="joinedOn"
                    type="date"
                    className="input mt-1"
                    value={form.joinedOn}
                    onChange={handleChange}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('staffManagement.form.joinedOnHint')}
                  </p>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={handleChange}
                  />
                  {t('staffManagement.fields.isActive')}
                </label>
              </div>
            </FormSectionCard>
          </div>

          <div className="space-y-5">
            <FormSectionCard
              title={t('staffManagement.form.payrollTitle')}
              hint={t('staffManagement.form.payrollHint')}
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <div>
                  <label className="label" htmlFor="staff-salary-type">
                    {t('staffManagement.fields.salaryType')}
                  </label>
                  <select
                    id="staff-salary-type"
                    name="salaryType"
                    className="input mt-1"
                    value={form.salaryType}
                    onChange={handleChange}
                  >
                    {salaryTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {getSalaryTypeOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="staff-salary-amount">
                    {t('staffManagement.fields.salaryAmount')}
                  </label>
                  <input
                    id="staff-salary-amount"
                    name="salaryAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input mt-1"
                    value={form.salaryAmount}
                    onChange={handleChange}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('staffManagement.form.salaryHint')}
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="staff-opening-advance">
                    {t('staffManagement.fields.openingAdvanceBalance')}
                  </label>
                  <input
                    id="staff-opening-advance"
                    name="openingAdvanceBalance"
                    type="number"
                    step="0.01"
                    className="input mt-1"
                    value={form.openingAdvanceBalance}
                    onChange={handleChange}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {t('staffManagement.form.advanceHint')}
                  </p>
                </div>
              </div>
            </FormSectionCard>

            <FormSectionCard
              title={t('staffManagement.form.previewTitle')}
              hint={t('staffManagement.form.previewHint')}
            >
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-4 dark:border-slate-800/70 dark:bg-slate-900/60">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {t('staffManagement.form.previewLabel')}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl text-slate-900 dark:text-white">
                    {previewName}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {previewRole}
                  </p>
                </div>

                <PreviewRow
                  label={t('staffManagement.fields.salaryAmount')}
                  value={formatMoney(form.salaryAmount || 0)}
                />
                <PreviewRow
                  label={t('staffManagement.fields.salaryType')}
                  value={getSalaryTypeOptionLabel(form.salaryType)}
                />
                <PreviewRow
                  label={t('staffManagement.fields.linkedMembershipId')}
                  value={previewAccess}
                />
              </div>
            </FormSectionCard>

            <FormSectionCard
              title={t('staffManagement.form.notesTitle')}
              hint={t('staffManagement.form.notesHint')}
            >
              <label className="label" htmlFor="staff-notes">
                {t('staffManagement.fields.notes')}
              </label>
              <textarea
                id="staff-notes"
                name="notes"
                className="input mt-1 min-h-[180px]"
                value={form.notes}
                onChange={handleChange}
                placeholder={t('staffManagement.form.notesPlaceholder')}
              />
            </FormSectionCard>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-500 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            {t('staffManagement.messages.loadingStaff')}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
