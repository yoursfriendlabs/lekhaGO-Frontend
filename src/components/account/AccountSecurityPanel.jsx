import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import Notice from '../Notice.jsx';
import PasswordField from '../auth/PasswordField.jsx';
import SpinnerIcon from '../auth/SpinnerIcon.jsx';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  getPasswordDifferenceMessage,
  getPasswordMatchMessage,
  getPasswordValidationMessage,
  hasUnverifiedEmail,
  resolvePasswordErrorMessage,
} from '../../lib/authFlow';
import { useI18n } from '../../lib/i18n.jsx';

export default function AccountSecurityPanel() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [saving, setSaving] = useState(false);

  const newPasswordError = useMemo(
    () => getPasswordValidationMessage(form.newPassword, t),
    [form.newPassword, t]
  );
  const confirmPasswordError = useMemo(
    () => getPasswordMatchMessage(form.newPassword, form.confirmPassword, t),
    [form.confirmPassword, form.newPassword, t]
  );
  const samePasswordError = useMemo(
    () => getPasswordDifferenceMessage(form.currentPassword, form.newPassword, t),
    [form.currentPassword, form.newPassword, t]
  );
  const canSubmit =
    Boolean(form.currentPassword)
    && Boolean(form.newPassword)
    && Boolean(form.confirmPassword)
    && !newPasswordError
    && !samePasswordError
    && !confirmPasswordError;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setStatus((previous) => (previous.message ? { type: 'info', message: '' } : previous));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setStatus({ type: 'error', message: newPasswordError || samePasswordError || confirmPasswordError || t('auth.errors.generic') });
      return;
    }

    setSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setStatus({ type: 'success', message: t('auth.changePasswordSuccess') });
    } catch (error) {
      setStatus({ type: 'error', message: resolvePasswordErrorMessage(error, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t('auth.accountSecurityEyebrow')}
            </p>
            <h2 className="mt-2 font-serif text-xl text-slate-900 dark:text-white">
              {t('auth.accountSecurityTitle')}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t('auth.accountSecuritySubtitle')}
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            hasUnverifiedEmail(user)
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
          }`}>
            {hasUnverifiedEmail(user) ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
            {hasUnverifiedEmail(user) ? t('auth.emailVerificationPending') : t('auth.emailVerified')}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t('auth.emailAddress')}
          </p>
          <p className="mt-2 break-all text-sm font-medium text-slate-700 dark:text-slate-200">
            {user?.email || t('auth.emailUnavailable')}
          </p>
          {hasUnverifiedEmail(user) ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('auth.verifyEmailPrompt')}
              </p>
              <Link className="btn-secondary justify-center" to="/app/activate-account">
                {t('auth.verifyEmailCta')}
              </Link>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 size={16} />
              {t('auth.emailVerifiedStatus')}
            </div>
          )}
        </div>
      </div>

      <div className="card space-y-5">
        <div>
          <h2 className="font-serif text-xl text-slate-900 dark:text-white">{t('auth.changePasswordTitle')}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('auth.changePasswordSubtitle')}
          </p>
        </div>

        {status.message ? <Notice title={status.message} tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'} /> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            id="current-password"
            name="currentPassword"
            label={t('auth.currentPassword')}
            value={form.currentPassword}
            onChange={handleChange}
            autoComplete="current-password"
            disabled={saving}
            required
          />
          <PasswordField
            id="new-password"
            name="newPassword"
            label={t('auth.newPassword')}
            value={form.newPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={saving}
            required
            error={newPasswordError || samePasswordError}
            hint={t('auth.passwordStrengthHint')}
          />
          <PasswordField
            id="confirm-new-password"
            name="confirmPassword"
            label={t('auth.confirmNewPassword')}
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={saving}
            required
            error={confirmPasswordError}
          />
          <button className="btn-primary w-full justify-center sm:w-auto" type="submit" disabled={saving || !canSubmit}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <SpinnerIcon className="h-4 w-4" />
                {t('auth.changingPassword')}
              </span>
            ) : (
              t('auth.changePasswordAction')
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
