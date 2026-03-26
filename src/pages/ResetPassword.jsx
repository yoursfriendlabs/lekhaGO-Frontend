import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import AuthFlowShell from '../components/auth/AuthFlowShell.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import SpinnerIcon from '../components/auth/SpinnerIcon.jsx';
import Notice from '../components/Notice.jsx';
import { api } from '../lib/api';
import { getPasswordMatchMessage, getPasswordValidationMessage, normalizeEmail, resolveResetPasswordErrorMessage } from '../lib/authFlow';
import { useI18n } from '../lib/i18n.jsx';
import { clearPasswordResetFlow, getPasswordResetFlow } from '../lib/storage';

function getResetContext(locationState) {
  const stored = getPasswordResetFlow();
  const email = normalizeEmail(locationState?.email || stored?.email);
  const code = String(locationState?.code || stored?.code || '').trim();

  if (!email || !code) return null;
  return { email, code };
}

export default function ResetPassword() {
  const location = useLocation();
  const { t } = useI18n();
  const [context] = useState(() => getResetContext(location.state));
  const [form, setForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [status, setStatus] = useState(() => location.state?.notice || { type: 'info', message: '' });
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const newPasswordError = useMemo(
    () => getPasswordValidationMessage(form.newPassword, t),
    [form.newPassword, t]
  );
  const confirmPasswordError = useMemo(
    () => getPasswordMatchMessage(form.newPassword, form.confirmPassword, t),
    [form.confirmPassword, form.newPassword, t]
  );
  const canSubmit = Boolean(form.newPassword) && Boolean(form.confirmPassword) && !newPasswordError && !confirmPasswordError;

  if (!context) {
    return (
      <Navigate
        to="/forgot-password"
        replace
        state={{
          notice: {
            type: 'warn',
            message: t('auth.passwordResetContextMissing'),
          },
        }}
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setStatus((previous) => (previous.message ? { type: 'info', message: '' } : previous));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setStatus({ type: 'error', message: newPasswordError || confirmPasswordError || t('auth.errors.generic') });
      return;
    }

    setSaving(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.resetPassword({
        email: context.email,
        code: context.code,
        newPassword: form.newPassword,
      });
      clearPasswordResetFlow();
      setCompleted(true);
      setStatus({ type: 'success', message: t('auth.passwordResetSuccess') });
    } catch (error) {
      setStatus({ type: 'error', message: resolveResetPasswordErrorMessage(error, t) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthFlowShell
      icon={LockKeyhole}
      eyebrow={t('auth.resetPasswordEyebrow')}
      title={completed ? t('auth.passwordResetSuccessTitle') : t('auth.resetPasswordTitle')}
      subtitle={completed ? t('auth.passwordResetSuccessSubtitle') : t('auth.resetPasswordSubtitle', { email: context.email })}
      badge={completed ? t('auth.passwordUpdatedBadge') : context.email}
      backTo="/forgot-password/otp"
      backLabel={t('auth.backToOtp')}
      asideTitle={t('auth.resetPasswordAsideTitle')}
      asideDescription={t('auth.resetPasswordAsideDescription')}
      tips={[
        t('auth.passwordTipLength'),
        t('auth.passwordTipMix'),
        t('auth.passwordTipUnique'),
      ]}
      footer={completed ? (
        <div className="space-y-3">
          <Link className="btn-primary w-full justify-center" to="/login">
            {t('auth.returnToLogin')}
          </Link>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {t('auth.passwordResetSuccessFooter')}
          </p>
        </div>
      ) : null}
    >
      {status.message ? <Notice title={status.message} tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : status.type === 'warn' ? 'warn' : 'info'} /> : null}

      {completed ? null : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <PasswordField
            id="reset-new-password"
            name="newPassword"
            label={t('auth.newPassword')}
            value={form.newPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={saving}
            required
            error={newPasswordError}
            hint={t('auth.passwordStrengthHint')}
          />
          <PasswordField
            id="reset-confirm-password"
            name="confirmPassword"
            label={t('auth.confirmNewPassword')}
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
            disabled={saving}
            required
            error={confirmPasswordError}
          />
          <button className="btn-primary w-full justify-center" type="submit" disabled={saving || !canSubmit}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <SpinnerIcon className="h-4 w-4" />
                {t('auth.resettingPassword')}
              </span>
            ) : (
              t('auth.saveNewPassword')
            )}
          </button>
        </form>
      )}
    </AuthFlowShell>
  );
}
