import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { RefreshCcw, ShieldCheck } from 'lucide-react';
import AuthFlowShell from '../components/auth/AuthFlowShell.jsx';
import OtpInput from '../components/auth/OtpInput.jsx';
import SpinnerIcon from '../components/auth/SpinnerIcon.jsx';
import Notice from '../components/Notice.jsx';
import { api } from '../lib/api';
import { getRemainingSeconds, normalizeEmail, OTP_LENGTH, RESEND_COOLDOWN_SECONDS, resolveAuthErrorMessage, resolveOtpErrorMessage } from '../lib/authFlow';
import { useI18n } from '../lib/i18n.jsx';
import { getPasswordResetFlow, setPasswordResetFlow } from '../lib/storage';

function getInitialFlow(locationState) {
  const stored = getPasswordResetFlow();
  const email = normalizeEmail(locationState?.email || stored?.email);
  if (!email) return null;

  return {
    email,
    code: stored?.code || '',
    verified: Boolean(locationState?.verified ?? stored?.verified),
    resendAvailableAt: Number(locationState?.resendAvailableAt || stored?.resendAvailableAt || 0),
  };
}

export default function ForgotPasswordOtp() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [flow, setFlow] = useState(() => getInitialFlow(location.state));
  const [digits, setDigits] = useState(() => Array.from({ length: OTP_LENGTH }, () => ''));
  const [status, setStatus] = useState(() => location.state?.notice || { type: 'info', message: '' });
  const [verifying, setVerifying] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(() => getRemainingSeconds(getInitialFlow(location.state)?.resendAvailableAt));

  const email = flow?.email || '';
  const otpCode = digits.join('');

  useEffect(() => {
    if (!flow?.email) return;
    setPasswordResetFlow(flow);
  }, [flow]);

  useEffect(() => {
    setResendCountdown(getRemainingSeconds(flow?.resendAvailableAt));
  }, [flow?.resendAvailableAt]);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timeout = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [resendCountdown]);

  const subtitle = useMemo(
    () => t('auth.passwordResetOtpSubtitle', { email }),
    [email, t]
  );

  if (!email) {
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

  const handleVerify = async (event) => {
    event.preventDefault();

    if (otpCode.length !== OTP_LENGTH) {
      setStatus({ type: 'error', message: t('auth.otpIncomplete') });
      return;
    }

    setVerifying(true);
    setStatus({ type: 'info', message: '' });

    try {
      const verification = await api.verifyPasswordResetOtp({ email, code: otpCode });
      setPasswordResetFlow({
        email,
        code: otpCode,
        verified: verification?.verified ?? true,
        resendAvailableAt: flow?.resendAvailableAt || 0,
      });
      navigate('/forgot-password/reset', {
        replace: true,
        state: {
          email,
          code: otpCode,
          verified: verification?.verified ?? true,
          notice: {
            type: 'success',
            message: t('auth.passwordResetOtpVerified'),
          },
        },
      });
    } catch (error) {
      setStatus({ type: 'error', message: resolveOtpErrorMessage(error, t) });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (sendingCode || resendCountdown > 0) return;

    setSendingCode(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.requestPasswordReset({ email });
      const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setFlow((previous) => (previous ? { ...previous, resendAvailableAt, code: '', verified: false } : previous));
      setDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      setStatus({ type: 'success', message: t('auth.passwordResetResent') });
    } catch (error) {
      setStatus({ type: 'error', message: resolveAuthErrorMessage(error, t) });
    } finally {
      setSendingCode(false);
    }
  };

  return (
    <AuthFlowShell
      icon={ShieldCheck}
      eyebrow={t('auth.passwordResetOtpEyebrow')}
      title={t('auth.passwordResetOtpTitle')}
      subtitle={subtitle}
      badge={email}
      backTo="/forgot-password"
      backLabel={t('auth.backToForgotPassword')}
      asideTitle={t('auth.passwordResetOtpAsideTitle')}
      asideDescription={t('auth.passwordResetOtpAsideDescription')}
      tips={[
        t('auth.verificationTipInbox'),
        t('auth.verificationTipSpam'),
        t('auth.verificationTipSingleUse'),
      ]}
      footer={(
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t('auth.needDifferentEmail')}{' '}
          <Link className="font-medium text-primary hover:text-primary/80" to="/forgot-password">
            {t('auth.tryAnotherEmail')}
          </Link>
        </p>
      )}
    >
      <form className="space-y-6" onSubmit={handleVerify}>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="label !text-slate-700 dark:!text-slate-200">{t('auth.otpCode')}</label>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              {OTP_LENGTH} {t('auth.digitsLabel')}
            </span>
          </div>
          <div className="mt-3">
            <OtpInput digits={digits} onChange={setDigits} disabled={verifying} ariaLabelPrefix={t('auth.otpDigitAria')} />
          </div>
        </div>

        {status.message ? <Notice title={status.message} tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : status.type === 'warn' ? 'warn' : 'info'} /> : null}

        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          {sendingCode
            ? t('auth.sendingResetCode')
            : resendCountdown > 0
              ? t('auth.resendCountdown', { seconds: resendCountdown })
              : t('auth.resendReady')}
        </div>

        <div className="space-y-3">
          <button
            className="btn-primary w-full justify-center rounded-2xl py-3 text-base"
            type="submit"
            disabled={verifying || otpCode.length !== OTP_LENGTH}
          >
            {verifying ? (
              <span className="inline-flex items-center gap-2">
                <SpinnerIcon className="h-4 w-4" />
                {t('auth.verifyingCode')}
              </span>
            ) : (
              t('auth.verifyCode')
            )}
          </button>
          <button
            className="btn-secondary w-full justify-center rounded-2xl py-3 text-base"
            type="button"
            onClick={handleResend}
            disabled={sendingCode || verifying || resendCountdown > 0}
          >
            <span className="inline-flex items-center gap-2">
              {sendingCode ? <SpinnerIcon className="h-4 w-4" /> : <RefreshCcw size={16} />}
              {t('auth.resendCode')}
            </span>
          </button>
        </div>
      </form>
    </AuthFlowShell>
  );
}
