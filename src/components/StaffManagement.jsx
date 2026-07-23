import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Plus,
  X,
  Check,
  Phone,
} from 'lucide-react';
import Notice from './Notice';
import ActionMenu from './ActionMenu';
import RefreshButton from './RefreshButton.jsx';
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
const STAFF_FORM_CATEGORY_KEYS = new Set([
  'general_staff',
  'custom',
  'cashier',
  'inventory_manager',
  'service_manager',
  'accountant',
  'supervisor',
  'waiter',
  'chef',
]);

/* ── General staff permission restrictions ── */
const GENERAL_STAFF_ALLOWED_FEATURE_KEYS = new Set(['attendance', 'tasks', 'staff']);
// const GENERAL_STAFF_DASHBOARD_LEVEL = 'view';

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

function toTimeInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 5);
}

function getStaffFormCategoryKey(categoryKey) {
  if (categoryKey === 'owner') return 'owner';
  return STAFF_FORM_CATEGORY_KEYS.has(categoryKey) ? categoryKey : 'custom';
}

function getStaffFormCategories(meta, role) {
  return meta.categories.filter((category) => (
    STAFF_FORM_CATEGORY_KEYS.has(category.key) || (role === 'owner' && category.key === 'owner')
  ));
}

function buildEmptyForm(meta, role = 'staff') {
  const defaultCategory = meta.categories.find((category) => category.key === 'general_staff')?.key
    || meta.categories.find((category) => category.key === 'custom')?.key
    || meta.categories.find((category) => category.key !== 'owner')?.key
    || meta.categories[0]?.key
    || '';
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
    shiftStarted: '',
    shiftEnded: '',
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

/* ── Shared visual primitives, mirrored from the Services page ── */

function OverviewMetric({ icon: Icon, label, value, tone = 'slate' }) {
  const styles = {
    slate: {
      wrapper: 'border-slate-200/70 bg-white/80 dark:border-slate-800/60 dark:bg-slate-950/40',
      icon: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    },
    blue: {
      wrapper: 'border-blue-200/70 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-900/20',
      icon: 'bg-blue-600 text-white',
    },
    amber: {
      wrapper: 'border-amber-200/70 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-900/20',
      icon: 'bg-amber-500 text-white',
    },
    rose: {
      wrapper: 'border-rose-200/70 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-900/20',
      icon: 'bg-rose-500 text-white',
    },
    emerald: {
      wrapper: 'border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-900/20',
      icon: 'bg-emerald-500 text-white',
    },
  };

  const palette = styles[tone] || styles.slate;

  return (
    <div className={`rounded-2xl border px-3 py-2.5 shadow-sm shadow-slate-200/20 ${palette.wrapper}`}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-1 whitespace-nowrap text-base font-semibold leading-tight text-slate-900 dark:text-white">
            {value}
          </p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
          <Icon size={15} />
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-w-0 items-center justify-center rounded-full border px-2.5 py-1.5 text-xs font-semibold leading-tight transition sm:px-4 sm:py-2 sm:text-sm ${
        active
          ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700/70 dark:bg-primary-900/30 dark:text-primary-200'
          : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ active, t }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {active ? t('staffManagement.status.active') : t('staffManagement.status.inactive')}
    </span>
  );
}

function LoginBadge({ hasLogin, t }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
        hasLogin
          ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      }`}
    >
      {hasLogin ? t('staffManagement.loginAccess') : t('staffManagement.nonLoginStaff')}
    </span>
  );
}

function EmailVerificationBadge({ emailVerified, t }) {
  if (emailVerified === false) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        {t('auth.emailVerificationPending')}
      </span>
    );
  }

  if (emailVerified === true) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {t('auth.emailVerified')}
      </span>
    );
  }

  return null;
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

/* ── Staff create / edit / view dialog ── */

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
  const formCategories = getStaffFormCategories(meta, form.role);
  const categoryDefaults = getCategoryPermissions(meta, form.staffCategory);
  const permissionsCustomized = JSON.stringify(categoryDefaults) !== JSON.stringify(form.permissions);
  const isGeneralStaff = form.staffCategory === 'general_staff';

  /* ── Filter features for general_staff: only attendance, tasks, staff (salary) ── */
  const visibleFeatures = useMemo(() => {
    if (!isGeneralStaff) return meta.features;
    return meta.features.filter((feature) => GENERAL_STAFF_ALLOWED_FEATURE_KEYS.has(feature.key));
  }, [isGeneralStaff, meta.features]);

  useEffect(() => {
    if (mode) setActiveTab('general');
  }, [mode]);

  if (!mode) return null;

  const dialogTitle = mode === 'create'
    ? t('staffManagement.createTitle')
    : mode === 'edit'
      ? t('staffManagement.editTitle')
      : t('staffManagement.viewTitle');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex h-full items-end justify-center md:items-center md:p-5 xl:p-6">
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#fcfaf6] shadow-2xl dark:bg-slate-950 md:h-[calc(100dvh-2.5rem)] md:max-h-[calc(100dvh-2.5rem)] md:max-w-[1100px] md:rounded-[32px] md:border md:border-slate-200/70 md:dark:border-slate-800/70">
          <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80 md:px-8">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary-700 dark:text-primary-200">
                {t('staffManagement.title')}
              </p>
              <h2 className="mt-1 truncate font-serif text-xl text-slate-900 dark:text-white md:text-2xl">
                {dialogTitle}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>

          <form id="staff-management-form" className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
              <div className="mx-auto w-full max-w-[920px] space-y-4">
                <div className="flex gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('general')}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      activeTab === 'general'
                        ? 'bg-primary-600 text-white'
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
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('staffManagement.tabs.accessPermissions')}
                  </button>
                </div>

                {activeTab === 'general' ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40 md:p-6">
                      <div className="flex flex-col gap-3 border-b border-slate-200/50 pb-4 lg:flex-row lg:items-start lg:justify-between dark:border-slate-800/50">
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

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                            {formCategories.map((category) => (
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
                          <label className="label" htmlFor="staff-shift-started">{t('staffManagement.shiftStarted')}</label>
                          <input
                            id="staff-shift-started"
                            className="input mt-1"
                            type="time"
                            value={form.shiftStarted}
                            onChange={(event) => onFieldChange('shiftStarted', event.target.value)}
                            disabled={readOnly}
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor="staff-shift-ended">{t('staffManagement.shiftEnded')}</label>
                          <input
                            id="staff-shift-ended"
                            className="input mt-1"
                            type="time"
                            value={form.shiftEnded}
                            onChange={(event) => onFieldChange('shiftEnded', event.target.value)}
                            disabled={readOnly}
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
                    </div>

                    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40 md:p-6">
                      <div className="border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                        <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('staffManagement.salary')}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Manage payment and salary tracking parameters for this staff member.
                        </p>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40 md:p-6">
                      <div className="border-b border-slate-200/50 pb-4 dark:border-slate-800/50">
                        <h3 className="font-serif text-lg text-slate-900 dark:text-white">{t('staffManagement.loginAccess')}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Control if this staff member can log in to perform transactions or view workspace features.
                        </p>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-950/50">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('staffManagement.hasLogin')}</p>
                            <p className="mt-1 text-xs text-slate-500">If enabled, credentials are required to sign in.</p>
                          </div>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => onFieldChange('hasLogin', !form.hasLogin)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                              form.hasLogin ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-800'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
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
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('auth.emailAddress')}</p>
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
                    </div>

                    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/20 dark:border-slate-800/70 dark:bg-slate-950/40 md:p-6">
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
                        {visibleFeatures.map((feature) => {
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200/70 bg-white/90 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85 md:px-8">
              <div className="mx-auto flex w-full max-w-[920px] flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {readOnly ? (
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
                    {t('common.close')}
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn-ghost w-full sm:w-auto" onClick={onClose} disabled={saving}>
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                      {saving
                        ? t('common.saving')
                        : isCreate
                          ? t('staffManagement.createAction')
                          : t('staffManagement.saveAction')}
                      <Check size={14} className="ml-1.5 inline" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */

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

  useEffect(() => {
    if (notice.type !== 'success' && notice.type !== 'error') return;
    const timer = setTimeout(() => setNotice({ type: '', message: '' }), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

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
          member.shiftStarted,
          member.shiftEnded,
          member.address,
          member.category?.label,
        ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? member.user?.isActive : !member.user?.isActive);
      const matchesCategory = categoryFilter === 'all' || member.staffCategory === categoryFilter;

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, members, query, statusFilter]);

  const staffOverview = useMemo(() => {
    const activeCount = members.filter((member) => member.user?.isActive !== false).length;
    const inactiveCount = members.length - activeCount;
    const loginCount = members.filter((member) => member.hasLogin !== false).length;

    return {
      totalUsers: summary.totalUsers ?? members.length,
      activeCount,
      inactiveCount,
      loginCount,
      availableSlots: summary.availableSlots ?? 0,
    };
  }, [members, summary]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: t('staffManagement.statusFilters.all') },
      { value: 'active', label: t('staffManagement.statusFilters.active') },
      { value: 'inactive', label: t('staffManagement.statusFilters.inactive') },
    ],
    [t],
  );

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

  const [refreshingStaff, setRefreshingStaff] = useState(false);

  const handleRefresh = async () => {
    setRefreshingStaff(true);
    try {
      invalidateApiCache(['staff']);
      await reloadStaff();
    } finally {
      setRefreshingStaff(false);
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

  const buildFormFromMember = (member) => ({
    membershipId: member.membershipId,
    name: member.user?.name || '',
    email: member.user?.email || '',
    phone: member.user?.phone || '',
    password: '',
    role: member.role || 'staff',
    staffCategory: getStaffFormCategoryKey(member.staffCategory || ''),
    jobTitle: member.jobTitle || '',
    joinedDate: toDateInputValue(member.joinedDate || member.joinedAt),
    shift: member.shift || '',
    shiftStarted: toTimeInputValue(member.shiftStarted),
    shiftEnded: toTimeInputValue(member.shiftEnded),
    address: member.address || '',
    compensation: member.compensation ?? '',
    salary: member.salary ?? member.compensation ?? '',
    hasLogin: member.hasLogin !== false,
    totalReceived: member.totalReceived ?? '',
    isActive: member.user?.isActive !== false,
    permissions: { ...member.permissions },
    permissionsDirty: false,
  });

  const openView = (member) => {
    setForm(buildFormFromMember(member));
    setDialogMode('view');
  };

  const openEdit = (member) => {
    if (!canManageStaff || member.role === 'owner') return;
    setForm(buildFormFromMember(member));
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

    const isGeneralStaffPayload = form.staffCategory === 'general_staff';

    /* ── Enforce dashboard = 'view' for general_staff ── */
    let finalPermissions = normalizePermissionMap(form.permissions);
    if (isGeneralStaffPayload) {
      finalPermissions = { ...finalPermissions, dashboard: 'view' };
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      staffCategory: form.staffCategory,
      jobTitle: form.jobTitle.trim(),
      joinedDate: form.joinedDate || null,
      joinedAt: form.joinedDate || null,
      shift: form.shift.trim(),
      shiftStarted: form.shiftStarted || null,
      shiftEnded: form.shiftEnded || null,
      address: form.address.trim(),
      salary: form.salary === '' ? null : Number(form.salary),
      compensation: form.salary === '' ? null : Number(form.salary),
      hasLogin: Boolean(form.hasLogin),
      totalReceived: form.totalReceived === '' ? null : Number(form.totalReceived),
      permissions: finalPermissions,
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

  const money = (value) =>
    t('currency.formatted', {
      symbol: t('currency.symbol'),
      amount: Number(value || 0).toFixed(2),
    });

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="overflow-hidden rounded-[32px] border border-primary-100/80 bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.22),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(249,245,239,0.96))] shadow-sm shadow-primary-950/10 dark:border-primary-900/40 dark:bg-[radial-gradient(circle_at_top_left,rgba(155,104,53,0.18),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))]">
        <div className="p-5 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h1 className="mt-0 font-serif text-3xl text-slate-900 dark:text-white md:text-3xl">
                {t('staffManagement.title')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 md:text-base">
                {t('staffManagement.subtitle')}
              </p>
            </div>

            {canManageStaff ? (
              <button
                className="btn-primary w-full sm:w-auto"
                type="button"
                onClick={openCreate}
                disabled={!businessId || summary.availableSlots <= 0}
              >
                <Plus size={16} className="mr-1.5 inline" />
                {t('staffManagement.addStaff')}
              </button>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <OverviewMetric
              icon={Users}
              label={t('staffManagement.summary.totalUsers')}
              value={staffOverview.totalUsers}
            />
            <OverviewMetric
              icon={UserCheck}
              label={t('staffManagement.status.active')}
              value={staffOverview.activeCount}
              tone="emerald"
            />
            <OverviewMetric
              icon={UserX}
              label={t('staffManagement.status.inactive')}
              value={staffOverview.inactiveCount}
              tone="amber"
            />
            <OverviewMetric
              icon={ShieldCheck}
              label={t('staffManagement.summary.availableSlots')}
              value={staffOverview.availableSlots}
              tone="rose"
            />
          </div>
        </div>
      </section>

      {notice.message ? <Notice title={notice.message} tone={notice.type || 'info'} /> : null}
      {loadError ? <Notice title={loadError} tone="error" /> : null}
      {!businessId ? <Notice title={t('staffManagement.businessRequired')} tone="warn" /> : null}
      {!canManageStaff ? <Notice title={t('staffManagement.viewOnlyNotice')} tone="info" /> : null}

      <TeamSeatUsagePanel
        summary={summary}
        staffing={subscription?.staffing}
        loading={loading}
        t={t}
      />

      {/* ── Staff table card ── */}
      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-slate-200/70 px-4 py-4 dark:border-slate-800/70 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            {/* <div className="max-w-2xl">
              <h3 className="font-serif text-2xl text-slate-900 dark:text-white">
                {t('staffManagement.title')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t('staffManagement.subtitle')}
              </p>
            </div> */}

            <div className="grid w-full gap-3 xl:max-w-3xl xl:grid-cols-[1.2fr_1fr_auto] xl:items-end">
              <div>
                <label className="label">{t('common.search')}</label>
                <div className="relative mt-1">
                  <input
                    className="input w-full pl-8"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('staffManagement.searchPlaceholder')}
                  />
                </div>
              </div>
              <div>
                <label className="label">{t('staffManagement.categoryLabel')}</label>
                <select
                  className="input mt-1"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="all">{t('staffManagement.allCategories')}</option>
                  {meta.categories.filter((category) => (
                    STAFF_FORM_CATEGORY_KEYS.has(category.key)
                  )).map((category) => (
                    <option key={category.key} value={category.key}>{category.label}</option>
                  ))}
                </select>
              </div>
              <RefreshButton
                className="min-h-[44px] xl:self-end"
                refreshing={refreshingStaff}
                onClick={handleRefresh}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
            {statusFilterOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={statusFilter === option.value}
                onClick={() => setStatusFilter(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6">
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
              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredMembers.map((member) => {
                  const isOwner = member.role === 'owner';
                  const menuActions = [
                    isOwner && { label: t('common.view'), icon: Eye, onClick: () => openView(member) },
                    !isOwner && {
                      label: t('staffManagement.salary', 'Staff Salary'),
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
                    <div
                      key={member.membershipId}
                      className="rounded-[26px] border border-slate-200/70 bg-white/90 p-4 text-sm shadow-sm dark:border-slate-800/60 dark:bg-slate-900/70"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-sm font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                            {getInitials(member.user?.name || member.name || '-')}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900 dark:text-white">
                              {member.user?.name || member.name || '-'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {member.category?.label || '-'}{member.jobTitle ? ` • ${member.jobTitle}` : ''}
                              </span>
                              <LoginBadge hasLogin={member.hasLogin} t={t} />
                            </div>
                          </div>
                        </div>

                        <div className="min-w-[88px] rounded-[20px] border border-slate-200/70 bg-slate-50/80 p-2.5 text-right dark:border-slate-800/70 dark:bg-slate-950/40">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                            {t('staffManagement.salary')}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {money(member.salary)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge active={member.user?.isActive !== false} t={t} />
                        {member.hasLogin && member.user?.email ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{member.user.email}</span>
                        ) : null}
                        {member.shiftStarted || member.shiftEnded ? (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {t('staffManagement.shift')}: {toTimeInputValue(member.shiftStarted) || '-'} - {toTimeInputValue(member.shiftEnded) || '-'}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 dark:border-slate-800/70">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t('staffManagement.joined', 'Joined')}: {formatDate(member.joinedAt || member.joinedDate)}
                        </span>
                        <ActionMenu actions={menuActions} label={t('common.actions')} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">{t('staffManagement.employee', 'Employee')}</th>
                      <th className="py-2 pr-4">{t('staffManagement.contact', 'Contact')}</th>
                      <th className="py-2 pr-4">{t('staffManagement.roleJoined', 'Role & Joined')}</th>
                      <th className="py-2 pr-4 text-right">{t('staffManagement.salary')}</th>
                      <th className="py-2 pr-4">{t('common.status')}</th>
                      <th className="py-2 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const isOwner = member.role === 'owner';
                      const menuActions = [
                        isOwner && { label: t('common.view'), icon: Eye, onClick: () => openView(member) },
                        !isOwner && {
                          label: t('staffManagement.salary', 'Staff Salary'),
                          icon: DollarSign,
                          onClick: () => {
                            setSalaryMember(member);
                            setSalaryOpen(true);
                          },
                        },
                        !isOwner && {
                          label: t('SalaryProfile', 'Salary Details'),
                          icon: Eye,
                          onClick: () => {
                            window.location.href = `/app/staff-salary/${encodeURIComponent(member.membershipId)}`;
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
                        <tr
                          key={member.membershipId}
                          className="border-t border-slate-200/70 transition hover:bg-slate-50/30 dark:border-slate-800/70 dark:hover:bg-slate-900/10"
                        >
                          <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-sm font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                                {getInitials(member.user?.name || member.name || '-')}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900 dark:text-white">
                                  {member.user?.name || member.name || '-'}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                                    {member.category?.label || '-'} {member.jobTitle ? `• ${member.jobTitle}` : ''}
                                  </span>
                                  <LoginBadge hasLogin={member.hasLogin} t={t} />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="space-y-1">
                              {member.hasLogin ? (
                                <>
                                  <p className="truncate font-medium text-slate-800 dark:text-slate-200">
                                    {member.user?.email || member.email || '-'}
                                  </p>
                                  <EmailVerificationBadge emailVerified={member.user?.emailVerified} t={t} />
                                </>
                              ) : (
                                <p className="italic text-slate-400">{t('staffManagement.noLoginPlaceholder')}</p>
                              )}
                              {member.user?.phone || member.phone ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {member.user?.phone || member.phone}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="space-y-1">
                              <p className="font-medium capitalize text-slate-800 dark:text-slate-200">
                                {t(`staffManagement.roles.${member.role || 'staff'}`)}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {t('staffManagement.joined', 'Joined')}: {formatDate(member.joinedAt || member.joinedDate)}
                              </p>
                              {member.shiftStarted || member.shiftEnded ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {t('staffManagement.shift')}: {toTimeInputValue(member.shiftStarted) || '-'} - {toTimeInputValue(member.shiftEnded) || '-'}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-slate-900 dark:text-white">
                            {money(member.salary)}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge active={member.user?.isActive !== false} t={t} />
                          </td>
                          <td className="py-3 text-right">
                            <ActionMenu actions={menuActions} label={t('common.actions')} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
    </div>
  );
}

/* ── Salary advance / payment history dialog ── */

function SalaryAdvanceDialog({ isOpen, member, t, onClose }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState('advance');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthYear, setMonthYear] = useState(() => new Date().toISOString().slice(0, 7));
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

  const handleSubmit = async (event) => {
    event.preventDefault();
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
        if (r.type === 'salary') totalPaidThisMonth += Number(r.amount || 0);
        else if (r.type === 'advance') totalAdvanceThisMonth += Number(r.amount || 0);
      }
    });

    const netRemaining = monthlySalary - totalAdvanceThisMonth - totalPaidThisMonth;

    return { monthlySalary, totalPaidThisMonth, totalAdvanceThisMonth, netRemaining };
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewMetric
            icon={DollarSign}
            label={t('staffManagement.salaryRecords.totalSalary')}
            value={t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.monthlySalary.toFixed(2) })}
          />
          <OverviewMetric
            icon={DollarSign}
            label={t('staffManagement.salaryRecords.totalAdvance')}
            value={t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.totalAdvanceThisMonth.toFixed(2) })}
            tone="amber"
          />
          <OverviewMetric
            icon={Check}
            label={t('staffManagement.salaryRecords.totalPaid')}
            value={t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.totalPaidThisMonth.toFixed(2) })}
            tone="emerald"
          />
          <OverviewMetric
            icon={ShieldCheck}
            label={t('staffManagement.salaryRecords.netBalance')}
            value={t('currency.formatted', { symbol: t('currency.symbol'), amount: stats.netRemaining.toFixed(2) })}
            tone={stats.netRemaining < 0 ? 'rose' : 'blue'}
          />
        </div>

        {!adding ? (
          <button type="button" className="btn-primary gap-2" onClick={() => setAdding(true)}>
            <Plus size={15} className="mr-1 inline" />
            {t('staffManagement.salaryRecords.addRecord')}
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-[24px] border border-slate-200/70 bg-slate-50/70 p-5 dark:border-slate-800/60 dark:bg-slate-900/40"
          >
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
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="record-type">{t('staffManagement.salaryRecords.type')}</label>
                <select
                  id="record-type"
                  className="input mt-1"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
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
                  onChange={(event) => setDate(event.target.value)}
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
                  onChange={(event) => setMonthYear(event.target.value)}
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
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          <h4 className="font-serif text-base text-slate-800 dark:text-white">
            {t('staffManagement.salaryRecords.history')}
          </h4>
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-400">{t('common.loading')}</p>
          ) : records.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-slate-400">
              {t('staffManagement.salaryRecords.empty')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
              <table className="w-full text-sm text-slate-600 dark:text-slate-300">
                <thead className="border-b border-slate-200/60 bg-slate-50 text-left text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800/60 dark:bg-slate-900/40">
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
                      <td className="whitespace-nowrap p-3">{r.date}</td>
                      <td className="whitespace-nowrap p-3">{r.monthYear}</td>
                      <td className="whitespace-nowrap p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.type === 'salary'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}
                        >
                          {r.type === 'salary'
                            ? t('staffManagement.salaryRecords.salaryPayment')
                            : t('staffManagement.salaryRecords.salaryAdvance')}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {t('currency.formatted', { symbol: t('currency.symbol'), amount: Number(r.amount || 0).toFixed(2) })}
                      </td>
                      <td className="max-w-[200px] truncate p-3" title={r.note}>{r.note || '-'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="font-semibold text-rose-600 hover:text-rose-500"
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
