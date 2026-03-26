import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import AuthFlowShell from '../components/auth/AuthFlowShell.jsx';
import Notice from '../components/Notice.jsx';
import SpinnerIcon from '../components/auth/SpinnerIcon.jsx';
import { api } from '../lib/api';
import { normalizeEmail, RESEND_COOLDOWN_SECONDS, resolveAuthErrorMessage } from '../lib/authFlow';
import { useI18n } from '../lib/i18n.jsx';
import { setPasswordResetFlow } from '../lib/storage';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [email, setEmail] = useState(location.state?.email || '');
  const [status, setStatus] = useState(location.state?.notice || { type: 'info', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = normalizeEmail(email);
    if (!trimmedEmail) return;

    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.requestPasswordReset({ email: trimmedEmail });
      const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setPasswordResetFlow({
        email: trimmedEmail,
        code: '',
        resendAvailableAt,
      });
      navigate('/forgot-password/otp', {
        replace: true,
        state: {
          email: trimmedEmail,
          resendAvailableAt,
          notice: {
            type: 'success',
            message: t('auth.passwordResetCodeSent'),
          },
        },
      });
    } catch (error) {
      setStatus({ type: 'error', message: resolveAuthErrorMessage(error, t) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthFlowShell
      icon={KeyRound}
      eyebrow={t('auth.forgotPasswordEyebrow')}
      title={t('auth.forgotPasswordTitle')}
      subtitle={t('auth.forgotPasswordSubtitle')}
      backTo="/login"
      backLabel={t('auth.backToLogin')}
      asideTitle={t('auth.forgotPasswordAsideTitle')}
      asideDescription={t('auth.forgotPasswordAsideDescription')}
      tips={[
        t('auth.forgotPasswordTipInbox'),
        t('auth.forgotPasswordTipSpam'),
        t('auth.forgotPasswordTipSingleUse'),
      ]}
      footer={(
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t('auth.rememberPassword')}{' '}
          <Link className="font-medium text-primary hover:text-primary/80" to="/login">
            {t('auth.signIn')}
          </Link>
        </p>
      )}
    >
      {status.message ? <Notice title={status.message} tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'} /> : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="reset-email">{t('auth.emailAddress')}</label>
          <input
            id="reset-email"
            className="input mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            disabled={loading}
          />
          <p className="mt-1 text-xs text-slate-500">{t('auth.forgotPasswordHint')}</p>
        </div>

        <button className="btn-primary w-full justify-center" type="submit" disabled={loading || !normalizeEmail(email)}>
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <SpinnerIcon className="h-4 w-4" />
              {t('auth.sendingResetCode')}
            </span>
          ) : (
            t('auth.sendResetCode')
          )}
        </button>
      </form>
    </AuthFlowShell>
  );
}
