import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, Users, Eye, Edit, Trash2, DollarSign } from 'lucide-react';
import Notice from './Notice';
import ActionMenu from './ActionMenu';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import { Dialog } from './ui/Dialog.tsx';
import TeamSeatUsagePanel from './subscription/TeamSeatUsagePanel.jsx';
import { api, invalidateApiCache } from '../lib/api';
import { getPermissionKeyForFeature, normalizePermissionMap } from '../lib/accessControl';
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

function getInitials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    salary: '',
    hasLogin: true,
    totalReceived: '',
    isActive: true,
    permissions: getCategoryPermissions(meta, defaultCategory),
    permissionsDirty: false,
  };
}

function normalizeErrorMessage(error, fallback) {
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
            className={`min-h-[2.9rem] px-3 py-2.5 text-[13px] font-semibold transition sm:text-sm ${
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
  wasNonLogin,
  onClose,
  onSubmit,
  onFieldChange,
  onPermissionChange,
  onApplyPreset,
  t,
}) {
  const [activeTab, setActiveTab] = useState('general');
  const isCreate = mode === 'create';
  const readOnly = mode === 'view';
  const levels = meta.accessLevels;
  const selectedCategory = meta.categories.find((category) => category.key === form.staffCategory) || null;
  const categoryDefaults = getCategoryPermissions(meta, form.staffCategory);
  const permissionsCustomized = JSON.stringify(categoryDefaults) !== JSON.stringify(form.permissions);

  useEffect(() => {
    if (mode) {
      setActiveTab('general');
    }
  }, [mode]);

  return (
    <Dialog
      isOpen={Boolean(mode)}
      onClose={onClose}
      title={mode === 'create'
        ? t('staffManagement.createTitle')
        : mode === 'edit'
          ? t('staffManagement.editTitle')
          : t('staffManagement.viewTitle')}
      size="wide"
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
        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'general'
                ? 'bg-[#9c5f22] text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('staffManagement.tabs.profileInfo')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === 'permissions'
                ? 'bg-[#9c5f22] text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t('staffManagement.tabs.accessPermissions')}
          </button>
        </div>

        {activeTab === 'general' ? (
          <div className="space-y-6">
            {/* Section 1: Personal & Job Details */}
            <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 md:p-6 dark:border-slate-800/70 dark:bg-slate-900/60">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                <div>
                  <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('staffManagement.detailsTitle')}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('staffManagement.detailsSubtitle')}</p>
                </div>
                {readOnly ? (
                  <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t('staffManagement.viewOnly')}
                  </span>
                ) : null}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                <div className="md:col-span-2 xl:col-span-2">
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
              </div>

              {!isCreate ? (
                <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/50 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => onFieldChange('isActive', event.target.checked)}
                    disabled={readOnly}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  {t('staffManagement.activeAccount')}
                </label>
              ) : null}
            </section>

            {/* Section 2: Compensation & Salary */}
            <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 md:p-6 dark:border-slate-800/70 dark:bg-slate-900/60">
              <div className="border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('staffManagement.salary')}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Manage payment and salary tracking parameters for this staff member.</p>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="staff-salary">{t('staffManagement.salary')}</label>
                  <input
                    id="staff-salary"
                    className="input mt-1"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.salary}
                    onChange={(event) => onFieldChange('salary', event.target.value)}
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
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 3: Login & Account Access */}
            <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 md:p-6 dark:border-slate-800/70 dark:bg-slate-900/60">
              <div className="border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('staffManagement.loginAccess')}</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Control if this staff member can log in to perform transactions or view workspace features.</p>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('staffManagement.hasLogin')}</p>
                    <p className="text-xs text-slate-500 mt-1">If enabled, credentials are required to sign in.</p>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onFieldChange('hasLogin', !form.hasLogin)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                      form.hasLogin ? 'bg-[#9c5f22]' : 'bg-slate-200 dark:bg-slate-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        form.hasLogin ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {form.hasLogin && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {(isCreate || wasNonLogin) ? (
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
                        <p className="mt-2 break-words text-sm font-medium text-slate-800 dark:text-slate-100">{form.email || '-'}</p>
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
                        required={isCreate || wasNonLogin}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Section 4: Permissions */}
            <section className="rounded-3xl border border-slate-200/70 bg-slate-50/80 p-5 md:p-6 dark:border-slate-800/70 dark:bg-slate-900/60">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="font-serif text-xl text-slate-900 dark:text-white">{t('staffManagement.permissionsTitle')}</h3>
                  <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">{t('staffManagement.permissionsSubtitle')}</p>
                </div>
                {!readOnly ? (
                  <button type="button" className="btn-secondary w-full justify-center sm:w-auto" onClick={onApplyPreset}>
                    {t('staffManagement.resetToPreset')}
                  </button>
                ) : null}
              </div>

              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
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

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {meta.features.map((feature) => {
                  const permissionKey = getPermissionKeyForFeature(feature.key) || feature.key;

                  return (
                    <div key={feature.key} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                      <div className="flex h-full flex-col gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">{feature.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {feature.description || t('staffManagement.permissionDescriptionFallback')}
                          </p>
                        </div>
                        <div className="w-full">
                          <PermissionSelector
                            value={form.permissions[permissionKey] || 'none'}
                            levels={levels}
                            disabled={readOnly}
                            onChange={(value) => onPermissionChange(permissionKey, value)}
                            t={t}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </form>
    </Dialog>
  );
}

export default function StaffManagement({ businessId }) {
  const { t } = useI18n();
  const { canManageFeature, canViewFeature, subscription } = useAuth();
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
  const [salaryMember, setSalaryMember] = useState(null);
  const [salaryOpen, setSalaryOpen] = useState(false);

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

  const handleRefresh = () => {
    invalidateApiCache(['staff']);
    reloadStaff();
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
      salary: member.salary ?? member.compensation ?? '',
      hasLogin: member.hasLogin !== false,
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
      salary: member.salary ?? member.compensation ?? '',
      hasLogin: member.hasLogin !== false,
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
      salary: form.salary === '' ? null : Number(form.salary),
      compensation: form.salary === '' ? null : Number(form.salary),
      hasLogin: Boolean(form.hasLogin),
      totalReceived: form.totalReceived === '' ? null : Number(form.totalReceived),
      permissions: normalizePermissionMap(form.permissions),
    };

    if (dialogMode === 'create') {
      if (form.hasLogin) {
        payload.email = form.email.trim();
        payload.password = form.password;
      }
    } else {
      payload.isActive = Boolean(form.isActive);
      const originalMember = members.find((m) => m.membershipId === form.membershipId);
      const wasNonLogin = originalMember ? originalMember.hasLogin === false : false;

      if (form.hasLogin) {
        if (wasNonLogin || form.email.trim() !== (originalMember?.user?.email || '')) {
          payload.email = form.email.trim();
        }
        if (form.password.trim()) {
          payload.password = form.password;
        }
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
    return null;
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
            <button type="button" className="btn-secondary justify-center" onClick={handleRefresh} disabled={loading}>
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

        <TeamSeatUsagePanel
          summary={summary}
          staffing={subscription?.staffing}
          loading={loading}
          t={t}
        />

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
                    <th className="py-3 pr-4">{t('staffManagement.employee', 'Employee')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.contact', 'Contact')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.roleJoined', 'Role & Joined')}</th>
                    <th className="py-3 pr-4">{t('staffManagement.salary')}</th>
                    <th className="py-3 pr-4">{t('common.status')}</th>
                    <th className="py-3 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => {
                    const isOwner = member.role === 'owner';
                    const menuActions = [
                      {
                        label: t('common.view'),
                        icon: Eye,
                        onClick: () => openView(member),
                      },
                      !isOwner && {
                        label: t('staffManagement.salary', 'Salary'),
                        icon: DollarSign,
                        onClick: () => {
                          setSalaryMember(member);
                          setSalaryOpen(true);
                        },
                      },
                      canManageStaff && !isOwner && {
                        label: t('common.edit'),
                        icon: Edit,
                        onClick: () => openEdit(member),
                      },
                      canManageStaff && !isOwner && {
                        label: t('common.delete'),
                        icon: Trash2,
                        tone: 'danger',
                        onClick: () => setDeleteMember(member),
                      },
                    ].filter(Boolean);

                    return (
                      <tr key={member.membershipId} className="border-t border-slate-200/70 hover:bg-slate-50/30 dark:border-slate-800/70 dark:hover:bg-slate-900/10 transition">
                        <td className="py-4 pr-4 font-medium text-slate-900 dark:text-white">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#9c5f22]/10 text-sm font-semibold text-[#9c5f22] dark:bg-[#9c5f22]/20 dark:text-[#dca060]">
                              {getInitials(member.user?.name || member.name || '-')}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-white truncate">
                                {member.user?.name || member.name || '-'}
                              </p>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  {member.category?.label || '-'} {member.jobTitle ? `• ${member.jobTitle}` : ''}
                                </span>
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  member.hasLogin
                                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                } whitespace-nowrap`}>
                                  {member.hasLogin ? t('staffManagement.loginAccess') : t('staffManagement.nonLoginStaff')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            {member.hasLogin ? (
                              <>
                                <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                  {member.user?.email || member.email || '-'}
                                </p>
                                <EmailVerificationBadge emailVerified={member.user?.emailVerified} t={t} />
                              </>
                            ) : (
                              <p className="text-slate-400 font-normal italic">{t('staffManagement.noLoginPlaceholder')}</p>
                            )}
                            {member.user?.phone || member.phone ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {member.user?.phone || member.phone}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                              {t(`staffManagement.roles.${member.role || 'staff'}`)}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t('staffManagement.joined', 'Joined')}: {formatDate(member.joinedAt || member.joinedDate)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4 font-semibold text-slate-900 dark:text-white">
                          {t('currency.formatted', {
                            symbol: t('currency.symbol'),
                            amount: Number(member.salary || 0).toFixed(2),
                          })}
                        </td>
                        <td className="py-4 pr-4">
                          <StatusBadge active={member.user?.isActive !== false} t={t} />
                        </td>
                        <td className="py-4 text-right whitespace-nowrap">
                          <ActionMenu actions={menuActions} label={t('common.actions')} />
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
                const menuActions = [
                  {
                    label: t('common.view'),
                    icon: Eye,
                    onClick: () => openView(member),
                  },
                  !isOwner && {
                    label: t('staffManagement.salary', 'Salary'),
                    icon: DollarSign,
                    onClick: () => {
                      setSalaryMember(member);
                      setSalaryOpen(true);
                    },
                  },
                  canManageStaff && !isOwner && {
                    label: t('common.edit'),
                    icon: Edit,
                    onClick: () => openEdit(member),
                  },
                  canManageStaff && !isOwner && {
                    label: t('common.delete'),
                    icon: Trash2,
                    tone: 'danger',
                    onClick: () => setDeleteMember(member),
                  },
                ].filter(Boolean);

                return (
                  <article key={member.membershipId} className="rounded-3xl border border-slate-200/70 bg-white/85 p-5 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/60 relative">
                    <div className="absolute right-4 top-4">
                      <ActionMenu actions={menuActions} label={t('common.actions')} />
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#9c5f22]/10 text-sm font-semibold text-[#9c5f22] dark:bg-[#9c5f22]/20 dark:text-[#dca060]">
                        {getInitials(member.user?.name || member.name || '-')}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white pr-8 truncate">
                          {member.user?.name || member.name || '-'}
                        </h3>
                        <div className="mt-1 flex flex-col gap-1">
                          <span className={`inline-flex self-start rounded-full px-2 py-0.5 text-2xs font-semibold ${
                            member.hasLogin
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {member.hasLogin ? t('staffManagement.loginAccess') : t('staffManagement.nonLoginStaff')}
                          </span>
                          {member.hasLogin && member.user?.email && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.user.email}</p>
                          )}
                        </div>
                      </div>
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
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('staffManagement.salary')}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                          {t('currency.formatted', {
                            symbol: t('currency.symbol'),
                            amount: Number(member.salary || 0).toFixed(2),
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{t('common.status')}</p>
                        <div className="mt-1">
                          <StatusBadge active={member.user?.isActive !== false} t={t} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {member.hasLogin && (
                        <EmailVerificationBadge emailVerified={member.user?.emailVerified} t={t} />
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('staffManagement.joinedAt')}: {formatDate(member.joinedAt)}
                      </span>
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
        wasNonLogin={form.membershipId ? (members.find((m) => m.membershipId === form.membershipId)?.hasLogin === false) : false}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        onFieldChange={handleFieldChange}
        onPermissionChange={handlePermissionChange}
        onApplyPreset={applyPresetPermissions}
        t={t}
      />

      <SalaryAdvanceDialog
        isOpen={salaryOpen}
        member={salaryMember}
        t={t}
        onClose={() => {
          setSalaryOpen(false);
          setSalaryMember(null);
        }}
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

function SalaryAdvanceDialog({
  isOpen,
  member,
  t,
  onClose,
}) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('advance'); // 'advance' or 'salary'
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRecords = async () => {
    if (!member?.membershipId) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.getStaffSalaryRecords(member.membershipId);
      setRecords(response?.records || []);
    } catch (err) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && member) {
      loadRecords();
      setAmount('');
      setType('advance');
      setDate(new Date().toISOString().slice(0, 10));
      setMonthYear(new Date().toISOString().slice(0, 7));
      setNote('');
      setAdding(false);
    }
  }, [isOpen, member]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    setError('');
    try {
      await api.addStaffSalaryRecord(member.membershipId, {
        amount: Number(amount),
        type,
        date,
        monthYear,
        note,
      });
      setAmount('');
      setNote('');
      setAdding(false);
      await loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.deleteStaffSalaryRecord(member.membershipId, recordId);
      await loadRecords();
    } catch (err) {
      setError(err.message || 'Failed to delete record');
    }
  };

  const currentMonthYear = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => {
    const monthlySalary = Number(member?.salary || member?.compensation || 0);
    let totalPaidThisMonth = 0;
    let totalAdvanceThisMonth = 0;

    records.forEach((r) => {
      if (r.monthYear === currentMonthYear) {
        if (r.type === 'salary') {
          totalPaidThisMonth += Number(r.amount || 0);
        } else if (r.type === 'advance') {
          totalAdvanceThisMonth += Number(r.amount || 0);
        }
      }
    });

    const netRemaining = monthlySalary - totalAdvanceThisMonth - totalPaidThisMonth;

    return {
      monthlySalary,
      totalPaidThisMonth,
      totalAdvanceThisMonth,
      netRemaining,
    };
  }, [records, member, currentMonthYear]);

  if (!isOpen || !member) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('staffManagement.salaryRecords.title', { name: member.user?.name || member.user?.email })}
      size="wide"
      footer={
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
          {t('common.close')}
        </button>
      }
    >
      <div className="space-y-6">
        {error ? <Notice title={error} tone="error" /> : null}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-4 dark:border-slate-800/60 dark:bg-slate-900/40">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              {t('staffManagement.salaryRecords.totalSalary')}
            </p>
            <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.monthlySalary.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/20 p-4 dark:border-amber-800/40 dark:bg-amber-950/10">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-amber-600/80">
              {t('staffManagement.salaryRecords.totalAdvance')}
            </p>
            <p className="mt-2 text-xl font-bold text-amber-700 dark:text-amber-300">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.totalAdvanceThisMonth.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/20 p-4 dark:border-emerald-800/40 dark:bg-emerald-950/10">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-emerald-600/80">
              {t('staffManagement.salaryRecords.totalPaid')}
            </p>
            <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.totalPaidThisMonth.toFixed(2) })}
            </p>
          </div>
          <div className="rounded-2xl border border-sky-200/70 bg-sky-50/20 p-4 dark:border-sky-800/40 dark:bg-sky-950/10">
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-sky-600/80">
              {t('staffManagement.salaryRecords.netBalance')}
            </p>
            <p className={`mt-2 text-xl font-bold ${stats.netRemaining < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-sky-700 dark:text-sky-300'}`}>
              {t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.netRemaining.toFixed(2) })}
            </p>
          </div>
        </div>

        {/* Toggle Adding Button */}
        {!adding ? (
          <button
            type="button"
            className="btn-primary gap-2"
            onClick={() => setAdding(true)}
          >
            + {t('staffManagement.salaryRecords.addRecord')}
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200/70 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/40 space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="record-amount">{t('staffManagement.salaryRecords.amount')}</label>
                <input
                  id="record-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  className="input mt-1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="record-type">{t('staffManagement.salaryRecords.type')}</label>
                <select
                  id="record-type"
                  className="input mt-1"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="advance">{t('staffManagement.salaryRecords.salaryAdvance')}</option>
                  <option value="salary">{t('staffManagement.salaryRecords.salaryPayment')}</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="record-date">{t('staffManagement.salaryRecords.date')}</label>
                <input
                  id="record-date"
                  type="date"
                  className="input mt-1"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="record-month">{t('staffManagement.salaryRecords.monthYear')}</label>
                <input
                  id="record-month"
                  type="month"
                  className="input mt-1"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="record-note">{t('staffManagement.salaryRecords.note')}</label>
              <input
                id="record-note"
                type="text"
                className="input mt-1"
                placeholder="E.g. Festival advance, June Salary part 1..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAdding(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={saving}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        {/* History Log Table */}
        <div className="space-y-3">
          <h4 className="font-serif text-base text-slate-800 dark:text-white">
            {t('staffManagement.salaryRecords.history')}
          </h4>
          {loading ? (
            <p className="text-center py-6 text-sm text-slate-400">{t('common.loading')}</p>
          ) : records.length === 0 ? (
            <p className="text-center py-6 text-sm text-slate-400 italic">
              {t('staffManagement.salaryRecords.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                <thead className="text-left bg-slate-50 dark:bg-slate-900/40 text-2xs uppercase tracking-[0.14em] text-slate-400 border-b border-slate-200/60 dark:border-slate-800/60">
                  <tr>
                    <th className="p-3">{t('staffManagement.salaryRecords.date')}</th>
                    <th className="p-3">{t('staffManagement.salaryRecords.monthYear')}</th>
                    <th className="p-3">{t('staffManagement.salaryRecords.type')}</th>
                    <th className="p-3">{t('staffManagement.salaryRecords.amount')}</th>
                    <th className="p-3">{t('staffManagement.salaryRecords.note')}</th>
                    <th className="p-3 text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/10">
                      <td className="p-3 whitespace-nowrap">{r.date}</td>
                      <td className="p-3 whitespace-nowrap">{r.monthYear}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.type === 'salary'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {r.type === 'salary'
                            ? t('staffManagement.salaryRecords.salaryPayment')
                            : t('staffManagement.salaryRecords.salaryAdvance')}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(r.amount || 0).toFixed(2) })}
                      </td>
                      <td className="p-3 max-w-[200px] truncate" title={r.note}>{r.note || '-'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="text-rose-600 hover:text-rose-500 font-semibold"
                        >
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
