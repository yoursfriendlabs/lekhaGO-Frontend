import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import Notice from './Notice';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import { Dialog } from './ui/Dialog.tsx';
import { api } from '../lib/api';
import { formatMaybeDate, todayISODate } from '../lib/datetime';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import {
  EMPTY_STAFF_SUMMARY,
  getCategoryPermissions,
  normalizeStaffMeta,
} from '../lib/staff';

const EMPTY_META = normalizeStaffMeta({});
const STATUS_FILTERS = ['all', 'active', 'inactive'];

function formatDate(value) {
  if (!value) return '-';
  return formatMaybeDate(value, 'MMM D, YYYY');
}

function toDateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function buildEmptyForm(meta, role = 'staff') {
  const defaultCategory = meta.categories.find((category) => category.key !== 'owner')?.key || meta.categories[0]?.key || '';
  return {
    membershipId: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role,
    staffCategory: defaultCategory,
    jobTitle: '',
    joinedDate: todayISODate(),
    shift: '',
    address: '',
    compensation: '',
    totalReceived: '',
    isActive: true,
    permissions: getCategoryPermissions(meta, defaultCategory),
    permissionsDirty: false,
  };
}

function normalizeErrorMessage(error, fallback) {
  if (error?.status === 403) {
    return fallback;
  }

  return error?.message || fallback;
}

function StatusBadge({ active, t }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {active ? t('staffManagement.status.active') : t('staffManagement.status.inactive')}
    </span>
  );
}

function EmailVerificationBadge({ emailVerified, t }) {
  if (emailVerified === false) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        {t('auth.emailVerificationPending')}
      </span>
    );
  }

  if (emailVerified === true) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {t('auth.emailVerified')}
      </span>
    );
  }

  return null;
}

function SummaryCard({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function PermissionSelector({ value, levels, disabled, onChange, t }) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/80 dark:border-slate-800/70 dark:bg-slate-900/70">
      {levels.map((level) => {
        const active = value === level.key;
        return (
          <button
            key={level.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level.key)}
            className={`px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-primary-600 text-white'
                : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {t(`staffManagement.permissionLevels.${level.key}`)}
          </button>
        );
      })}
    </div>
  );
}

function StaffFormDialog({
  mode,
  form,
  meta,
  saving,
  onClose,
  onSubmit,
  onFieldChange,
  onPermissionChange,
  onApplyPreset,
  t,
}) {
  const isCreate = mode === 'create';
  const readOnly = mode === 'view';
  const levels = meta.accessLevels;
  const selectedCategory = meta.categories.find((category) => category.key === form.staffCategory) || null;
  const categoryDefaults = getCategoryPermissions(meta, form.staffCategory);
  const permissionsCustomized = JSON.stringify(categoryDefaults) !== JSON.stringify(form.permissions);

  return (
    <Dialog
      isOpen={Boolean(mode)}
      onClose={onClose}
      title={mode === 'create'
        ? t('staffManagement.createTitle')
        : mode === 'edit'
          ? t('staffManagement.editTitle')
          : t('staffManagement.viewTitle')}
      size="full"
      footer={readOnly ? (
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
          {t('common.close')}
        </button>
      ) : (
        <>
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="staff-management-form" className="btn-primary w-full sm:w-auto" disabled={saving}>
            {saving
              ? t('common.saving')
              : isCreate
                ? t('staffManagement.createAction')
                : t('staffManagement.saveAction')}
          </button>
        </>
      )}
    >
      <form id="staff-management-form" className="space-y-6" onSubmit={onSubmit}>
        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('staffManagement.detailsTitle')}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('staffManagement.detailsSubtitle')}</p>
                </div>
                {readOnly ? (
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t('staffManagement.viewOnly')}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="staff-name">{t('auth.name')}</label>
                  <input
                    id="staff-name"
                    className="input mt-1"
                    value={form.name}
                    onChange={(event) => onFieldChange('name', event.target.value)}
                    disabled={readOnly}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-phone">{t('auth.phone')}</label>
                  <input
                    id="staff-phone"
                    className="input mt-1"
                    value={form.phone}
                    onChange={(event) => onFieldChange('phone', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('auth.phonePlaceholder')}
                  />
                </div>
                {isCreate ? (
                  <div>
                    <label className="label" htmlFor="staff-email">{t('auth.emailAddress')}</label>
                    <input
                      id="staff-email"
                      className="input mt-1"
                      type="email"
                      value={form.email}
                      onChange={(event) => onFieldChange('email', event.target.value)}
                      disabled={readOnly}
                      required
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('auth.emailAddress')}</p>
                    <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">{form.email || '-'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('staffManagement.emailImmutable')}</p>
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="staff-password">
                    {isCreate ? t('auth.password') : t('staffManagement.newPassword')}
                  </label>
                  <input
                    id="staff-password"
                    className="input mt-1"
                    type="password"
                    value={form.password}
                    onChange={(event) => onFieldChange('password', event.target.value)}
                    disabled={readOnly}
                    placeholder={isCreate ? t('staffManagement.passwordCreateHint') : t('staffManagement.passwordEditHint')}
                    required={isCreate}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-role">{t('staffManagement.roleLabel')}</label>
                  <select
                    id="staff-role"
                    className="input mt-1"
                    value={form.role}
                    onChange={(event) => onFieldChange('role', event.target.value)}
                    disabled={readOnly || !isCreate}
                  >
                    <option value="staff">{t('staffManagement.roles.staff')}</option>
                    {form.role === 'owner' ? <option value="owner">{t('staffManagement.roles.owner')}</option> : null}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('staffManagement.roleHelper')}</p>
                </div>
                <div>
                  <label className="label" htmlFor="staff-category">{t('staffManagement.categoryLabel')}</label>
                  <select
                    id="staff-category"
                    className="input mt-1"
                    value={form.staffCategory}
                    onChange={(event) => onFieldChange('staffCategory', event.target.value)}
                    disabled={readOnly}
                  >
                    {meta.categories
                      .filter((category) => category.key !== 'owner' || form.role === 'owner')
                      .map((category) => (
                        <option key={category.key} value={category.key}>{category.label}</option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {selectedCategory?.description || t('staffManagement.categoryHelper')}
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="staff-job-title">{t('staffManagement.jobTitle')}</label>
                  <input
                    id="staff-job-title"
                    className="input mt-1"
                    value={form.jobTitle}
                    onChange={(event) => onFieldChange('jobTitle', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('staffManagement.jobTitlePlaceholder')}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-joined-date">{t('staffManagement.joinedDate')}</label>
                  <input
                    id="staff-joined-date"
                    className="input mt-1"
                    type="date"
                    value={form.joinedDate}
                    onChange={(event) => onFieldChange('joinedDate', event.target.value)}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-shift">{t('staffManagement.shift')}</label>
                  <input
                    id="staff-shift"
                    className="input mt-1"
                    value={form.shift}
                    onChange={(event) => onFieldChange('shift', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('staffManagement.shiftPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-address">{t('staffManagement.address')}</label>
                  <input
                    id="staff-address"
                    className="input mt-1"
                    value={form.address}
                    onChange={(event) => onFieldChange('address', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('staffManagement.addressPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-compensation">{t('staffManagement.compensation')}</label>
                  <input
                    id="staff-compensation"
                    className="input mt-1"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.compensation}
                    onChange={(event) => onFieldChange('compensation', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('staffManagement.compensationPlaceholder')}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="staff-total-received">{t('staffManagement.totalReceived')}</label>
                  <input
                    id="staff-total-received"
                    className="input mt-1"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.totalReceived}
                    onChange={(event) => onFieldChange('totalReceived', event.target.value)}
                    disabled={readOnly}
                    placeholder={t('staffManagement.totalReceivedPlaceholder')}
                  />
                </div>
              </div>

              {!isCreate ? (
                <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/50 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => onFieldChange('isActive', event.target.checked)}
                    disabled={readOnly}
                  />
                  {t('staffManagement.activeAccount')}
                </label>
              ) : null}
            </section>
          </div>

          <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-slate-800/70 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('staffManagement.permissionsTitle')}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('staffManagement.permissionsSubtitle')}</p>
              </div>
              {!readOnly ? (
                <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={onApplyPreset}>
                  {t('staffManagement.resetToPreset')}
                </button>
              ) : null}
            </div>

            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              permissionsCustomized
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
            >
              <p className="font-semibold">
                {permissionsCustomized
                  ? t('staffManagement.permissionPresetCustomized')
                  : t('staffManagement.permissionPresetApplied', { category: selectedCategory?.label || '-' })}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {permissionsCustomized
                  ? t('staffManagement.permissionPresetCustomizedHint')
                  : t('staffManagement.permissionPresetAppliedHint')}
              </p>
            </div>

            <div className="mt-5 space-y-4">
              {meta.features.map((feature) => (
                <div key={feature.key} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{feature.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {feature.description || t('staffManagement.permissionDescriptionFallback')}
                      </p>
                    </div>
                    <div className="w-full lg:w-[19rem]">
                      <PermissionSelector
                        value={form.permissions[feature.key] || 'none'}
                        levels={levels}
                        disabled={readOnly}
                        onChange={(value) => onPermissionChange(feature.key, value)}
                        t={t}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </form>
    </Dialog>
  );
}

export default function StaffManagement({ businessId }) {
  const { t } = useI18n();
  const { canManageFeature, canViewFeature } = useAuth();
  const canManageStaff = canManageFeature('staff');
  const canViewStaff = canViewFeature('staff');

  const [summary, setSummary] = useState(EMPTY_STAFF_SUMMARY);
  const [meta, setMeta] = useState(EMPTY_META);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState({ type: '', message: '' });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogMode, setDialogMode] = useState('');
  const [form, setForm] = useState(() => buildEmptyForm(EMPTY_META));
  const [saving, setSaving] = useState(false);
  const [deleteMember, setDeleteMember] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return members.filter((member) => {
      const matchesQuery = !normalizedQuery
        || [
          member.user?.name,
          member.user?.email,
          member.user?.phone,
          member.jobTitle,
          member.shift,
          member.address,
          member.category?.label,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? member.user?.isActive : !member.user?.isActive);
      const matchesCategory = categoryFilter === 'all' || member.staffCategory === categoryFilter;

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, members, query, statusFilter]);

  const reloadStaff = async () => {
    if (!businessId) {
      setSummary(EMPTY_STAFF_SUMMARY);
      setMeta(EMPTY_META);
      setMembers([]);
      setLoadError('');
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const payload = await api.listStaff();
      const nextMeta = payload?.meta?.features?.length
        ? payload.meta
        : await api.getStaffMeta().catch(() => EMPTY_META);
      setSummary(payload?.summary || EMPTY_STAFF_SUMMARY);
      setMeta(nextMeta || EMPTY_META);
      setMembers(Array.isArray(payload?.members) ? payload.members : []);
    } catch (error) {
      setSummary(EMPTY_STAFF_SUMMARY);
      setMeta(EMPTY_META);
      setMembers([]);
      setLoadError(normalizeErrorMessage(error, t('staffManagement.permissionError')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotice({ type: '', message: '' });
    reloadStaff();
  }, [businessId]);

  const openCreate = () => {
    if (!canManageStaff) return;
    setForm(buildEmptyForm(meta));
    setDialogMode('create');
  };

  const openView = (member) => {
    setForm({
      membershipId: member.membershipId,
      name: member.user?.name || '',
      email: member.user?.email || '',
      phone: member.user?.phone || '',
      password: '',
      role: member.role || 'staff',
      staffCategory: member.staffCategory || '',
      jobTitle: member.jobTitle || '',
      joinedDate: toDateInputValue(member.joinedDate || member.joinedAt),
      shift: member.shift || '',
      address: member.address || '',
      compensation: member.compensation ?? '',
      totalReceived: member.totalReceived ?? '',
      isActive: member.user?.isActive !== false,
      permissions: { ...member.permissions },
      permissionsDirty: false,
    });
    setDialogMode('view');
  };

  const openEdit = (member) => {
    if (!canManageStaff || member.role === 'owner') return;
    setForm({
      membershipId: member.membershipId,
      name: member.user?.name || '',
      email: member.user?.email || '',
      phone: member.user?.phone || '',
      password: '',
      role: member.role || 'staff',
      staffCategory: member.staffCategory || '',
      jobTitle: member.jobTitle || '',
      joinedDate: toDateInputValue(member.joinedDate || member.joinedAt),
      shift: member.shift || '',
      address: member.address || '',
      compensation: member.compensation ?? '',
      totalReceived: member.totalReceived ?? '',
      isActive: member.user?.isActive !== false,
      permissions: { ...member.permissions },
      permissionsDirty: false,
    });
    setDialogMode('edit');
  };

  const closeDialog = () => {
    if (saving) return;
    setDialogMode('');
    setForm(buildEmptyForm(meta));
  };

  const handleFieldChange = (field, value) => {
    setForm((current) => {
      if (field === 'staffCategory') {
        if (current.permissionsDirty) {
          return { ...current, staffCategory: value };
        }

        return {
          ...current,
          staffCategory: value,
          permissions: getCategoryPermissions(meta, value),
        };
      }

      return { ...current, [field]: value };
    });
  };

  const handlePermissionChange = (featureKey, level) => {
    setForm((current) => ({
      ...current,
      permissionsDirty: true,
      permissions: {
        ...current.permissions,
        [featureKey]: level,
      },
    }));
  };

  const applyPresetPermissions = () => {
    setForm((current) => ({
      ...current,
      permissionsDirty: false,
      permissions: getCategoryPermissions(meta, current.staffCategory),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canManageStaff) return;

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      staffCategory: form.staffCategory,
      jobTitle: form.jobTitle.trim(),
      joinedDate: form.joinedDate || null,
      joinedAt: form.joinedDate || null,
      shift: form.shift.trim(),
      address: form.address.trim(),
      compensation: form.compensation === '' ? null : Number(form.compensation),
      totalReceived: form.totalReceived === '' ? null : Number(form.totalReceived),
      permissions: form.permissions,
    };

    if (dialogMode === 'create') {
      payload.email = form.email.trim();
      payload.password = form.password;
    } else {
      payload.isActive = Boolean(form.isActive);
      if (form.password.trim()) {
        payload.password = form.password;
      }
    }

    setSaving(true);
    setNotice({ type: '', message: '' });

    try {
      if (dialogMode === 'edit' && form.membershipId) {
        await api.updateStaff(form.membershipId, payload);
        setNotice({ type: 'success', message: t('staffManagement.messages.updated') });
      } else {
        await api.createStaff(payload);
        setNotice({ type: 'success', message: t('staffManagement.messages.created') });
      }

      closeDialog();
      await reloadStaff();
    } catch (error) {
      setNotice({ type: 'error', message: normalizeErrorMessage(error, t('staffManagement.permissionError')) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteMember) return;

    setDeleteSaving(true);

    try {
      await api.deleteStaff(deleteMember.membershipId);
      setNotice({ type: 'success', message: t('staffManagement.messages.deleted') });
      await reloadStaff();
    } catch (error) {
      setNotice({ type: 'error', message: normalizeErrorMessage(error, t('staffManagement.permissionError')) });
    } finally {
      setDeleteSaving(false);
      setDeleteMember(null);
    }
  };

  if (!canViewStaff) {
    return <Notice title={t('staffManagement.permissionError')} tone="warn" />;
  }

  return (
    <>
      <div className="card space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl text-slate-900 dark:text-white">{t('staffManagement.title')}</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('staffManagement.subtitle')}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <button type="button" className="btn-secondary justify-center" onClick={reloadStaff} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {t('staffManagement.refresh')}
            </button>
            {canManageStaff ? (
              <button
                type="button"
                className="btn-primary justify-center"
                onClick={openCreate}
                disabled={!businessId || summary.availableSlots <= 0}
              >
                {t('staffManagement.addStaff')}
              </button>
            ) : null}
          </div>
        </div>

        {notice.message ? <Notice title={notice.message} tone={notice.type || 'info'} /> : null}
        {loadError ? <Notice title={loadError} tone="error" /> : null}
        {!businessId ? <Notice title={t('staffManagement.businessRequired')} tone="warn" /> : null}
        {!canManageStaff ? <Notice title={t('staffManagement.viewOnlyNotice')} tone="info" /> : null}

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label={t('staffManagement.summary.totalUsers')}
            value={summary.totalUsers}
            hint={t('staffManagement.summary.totalUsersHint')}
            icon={Users}
          />
          <SummaryCard
            label={t('staffManagement.summary.maxUsers')}
            value={summary.maxUsers}
            hint={t('staffManagement.summary.maxUsersHint')}
            icon={ShieldCheck}
          />
          <SummaryCard
            label={t('staffManagement.summary.availableSlots')}
            value={summary.availableSlots}
            hint={t('staffManagement.summary.availableSlotsHint')}
            icon={RefreshCw}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr,0.85fr,0.8fr]">
          <div>
            <label className="label">{t('common.search')}</label>
            <div className="relative mt-1">
              <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('staffManagement.searchPlaceholder')}
              />
            </div>
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select className="input mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {STATUS_FILTERS.map((filterKey) => (
                <option key={filterKey} value={filterKey}>
                  {t(`staffManagement.statusFilters.${filterKey}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('staffManagement.categoryLabel')}</label>
            <select className="input mt-1" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{t('staffManagement.allCategories')}</option>
              {meta.categories.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/80 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            {t('common.loading')}
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300/80 bg-slate-50/80 p-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
            <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('staffManagement.emptyTitle')}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('staffManagement.emptyDescription')}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-sm text-slate-600 dark:text-slate-300">
                <thead className="text-left text-xs uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="py-3 pr-4">{t('auth.name')}</th>
                    <th className="py-3 pr-4">{t('auth.emailAddress')}</th>
                    <th className="py-3 pr-4">{t('auth.phone')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.roleLabel')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.categoryLabel')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.jobTitle')}</th>
                    <th className="py-3 pr-4">{t('common.status')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.joinedAt')}</th>
                    <th className="py-3 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isOwner = member.role === 'owner';
                    return (
                      <tr key={member.membershipId} className="border-t border-slate-200/70 dark:border-slate-800/70">
                        <td className="py-4 pr-4 font-medium text-slate-900 dark:text-white">{member.user?.name || '-'}</td>
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p>{member.user?.email || '-'}</p>
                            <EmailVerificationBadge emailVerified={member.user?.emailVerified} t={t} />
                          </div>
                        </td>
                        <td className="py-4 pr-4">{member.user?.phone || '-'}</td>
                        <td className="py-4 pr-4 capitalize">{t(`staffManagement.roles.${member.role || 'staff'}`)}</td>
                        <td className="py-4 pr-4">{member.category?.label || '-'}</td>
                        <td className="py-4 pr-4">{member.jobTitle || '-'}</td>
                        <td className="py-4 pr-4"><StatusBadge active={member.user?.isActive !== false} t={t} /></td>
                        <td className="py-4 pr-4">{formatDate(member.joinedAt)}</td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button type="button" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={() => openView(member)}>
                              {t('common.view')}
                            </button>
                            {canManageStaff && !isOwner ? (
                              <>
                                <button type="button" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" onClick={() => openEdit(member)}>
                                  {t('common.edit')}
                                </button>
                                <button type="button" className="text-rose-600 hover:text-rose-500" onClick={() => setDeleteMember(member)}>
                                  {t('common.delete')}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 lg:hidden">
              {filteredMembers.map((member) => {
                const isOwner = member.role === 'owner';
                return (
                  <article key={member.membershipId} className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{member.user?.name || '-'}</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{member.user?.email || '-'}</p>
                      </div>
                      <StatusBadge active={member.user?.isActive !== false} t={t} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('auth.phone')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{member.user?.phone || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('staffManagement.roleLabel')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{t(`staffManagement.roles.${member.role || 'staff'}`)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('staffManagement.categoryLabel')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{member.category?.label || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('staffManagement.jobTitle')}</p>
                        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{member.jobTitle || '-'}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <EmailVerificationBadge emailVerified={member.user?.emailVerified} t={t} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('staffManagement.joinedAt')}: {formatDate(member.joinedAt)}
                      </span>
                    </div>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={() => openView(member)}>
                        {t('common.view')}
                      </button>
                      {canManageStaff && !isOwner ? (
                        <>
                          <button type="button" className="btn-primary w-full justify-center sm:w-auto" onClick={() => openEdit(member)}>
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800/50 dark:bg-rose-950/30 dark:text-rose-200 sm:w-auto"
                            onClick={() => setDeleteMember(member)}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      <StaffFormDialog
        mode={dialogMode}
        form={form}
        meta={meta}
        saving={saving}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
        onPermissionChange={handlePermissionChange}
        onApplyPreset={applyPresetPermissions}
        t={t}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteMember)}
        onClose={() => (deleteSaving ? undefined : setDeleteMember(null))}
        onConfirm={handleDelete}
        title={t('staffManagement.deleteTitle')}
        description={deleteMember
          ? t('staffManagement.deleteDescription', { name: deleteMember.user?.name || deleteMember.user?.email || '-' })
          : t('common.confirmDelete')}
        confirming={deleteSaving}
      />
    </>
  );
}
