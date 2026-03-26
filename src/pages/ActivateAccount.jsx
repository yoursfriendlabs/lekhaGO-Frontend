import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, RefreshCcw, ShieldCheck } from 'lucide-react';
import Notice from '../components/Notice.jsx';
import OtpInput from '../components/auth/OtpInput.jsx';
import SpinnerIcon from '../components/auth/SpinnerIcon.jsx';
import { api } from '../lib/api';
import { getRemainingSeconds, hasUnverifiedEmail, OTP_LENGTH, RESEND_COOLDOWN_SECONDS, resolveAuthErrorMessage, resolveOtpErrorMessage } from '../lib/authFlow';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
  setPendingEmailVerification,
} from '../lib/storage';

function getActivationContext(user, storedContext) {
  const email = storedContext?.email || user?.email || '';
  if (!email) return null;

  return {
    email,
    requestOtpOnOpen: Boolean(storedContext?.requestOtpOnOpen ?? true),
    resendAvailableAt: Number(storedContext?.resendAvailableAt || 0),
  };
}

export default function ActivateAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user, businessId, role, setSession, updateUser } = useAuth();
  const { t } = useI18n();
  const [context, setContext] = useState(() => getActivationContext(user, getPendingEmailVerification()));
  const [digits, setDigits] = useState(() => Array.from({ length: OTP_LENGTH }, () => ''));
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [verifying, setVerifying] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(() => getRemainingSeconds(getActivationContext(user, getPendingEmailVerification())?.resendAvailableAt));

  const email = context?.email || user?.email || '';
  const otpCode = digits.join('');
  const activationRequired = hasUnverifiedEmail(user);
  const destination = location.state?.from || '/app';

  useEffect(() => {
    const nextContext = getActivationContext(user, getPendingEmailVerification());
    setContext((current) => current || nextContext);
  }, [user]);

  useEffect(() => {
    if (!context) return;
    setPendingEmailVerification({
      ...context,
      requestOtpOnOpen: false,
    });
  }, [context]);

  useEffect(() => {
    setResendCountdown(getRemainingSeconds(context?.resendAvailableAt));
  }, [context?.resendAvailableAt]);

  useEffect(() => {
    if (resendCountdown <= 0) return undefined;

    const timeout = window.setTimeout(() => {
      setResendCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [resendCountdown]);

  useEffect(() => {
    if (!activationRequired || !context?.email || !context?.requestOtpOnOpen) return undefined;

    let active = true;
    setSendingCode(true);
    setStatus({ type: 'info', message: '' });

    api.requestEmailOtp({ email: context.email })
      .then(() => {
        if (!active) return;
        const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setContext((previous) => (previous ? { ...previous, requestOtpOnOpen: false, resendAvailableAt } : previous));
        setStatus({ type: 'success', message: t('auth.sendCode') });
      })
      .catch((error) => {
        if (!active) return;
        setStatus({ type: 'error', message: resolveAuthErrorMessage(error, t) });
      })
      .finally(() => {
        if (!active) return;
        setSendingCode(false);
      });

    return () => {
      active = false;
    };
  }, [activationRequired, context?.email, context?.requestOtpOnOpen, t]);

  const subtitle = useMemo(() => {
    if (!email) return t('auth.activationSubtitleGeneric');
    return t('auth.activationSubtitle', { email });
  }, [email, t]);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (otpCode.length !== OTP_LENGTH) {
      setStatus({ type: 'error', message: t('auth.otpIncomplete') });
      return;
    }

    setVerifying(true);
    setStatus({ type: 'info', message: '' });

    try {
      const response = await api.verifyEmailOtp({ email, code: otpCode });
      const nextUser = response?.user || { ...user, emailVerified: true };
      const nextToken = response?.token || token;
      const nextBusinessId = response?.business?.id || businessId;
      const nextRole = response?.role || role;

      clearPendingEmailVerification();

      if (response?.token || response?.user || response?.business?.id || response?.role) {
        setSession(nextToken, nextUser, nextBusinessId, nextRole);
      } else {
        updateUser({ emailVerified: true });
      }

      navigate(destination, { replace: true });
    } catch (error) {
      setStatus({ type: 'error', message: resolveOtpErrorMessage(error, t) });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || sendingCode || resendCountdown > 0) return;

    setSendingCode(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.requestEmailOtp({ email });
      const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setContext((previous) => (previous ? { ...previous, resendAvailableAt, requestOtpOnOpen: false } : previous));
      setStatus({ type: 'success', message: t('auth.resendCodeSuccess') });
    } catch (error) {
      setStatus({ type: 'error', message: resolveAuthErrorMessage(error, t) });
    } finally {
      setSendingCode(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-primary/10 via-amber-50 to-white p-8 dark:from-primary/15 dark:via-slate-900 dark:to-slate-950">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
              <ShieldCheck size={28} />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
              {t('auth.activationEyebrow')}
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-slate-900 dark:text-white">
              {t('auth.activationTitle')}
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {subtitle}
            </p>
            {email ? (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-primary/30 dark:bg-slate-900/70 dark:text-slate-200">
                <MailCheck size={16} className="text-primary" />
                {email}
              </div>
            ) : null}
            <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white/75 p-5 dark:border-slate-800/70 dark:bg-slate-900/70">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('auth.activationAsideTitle')}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>{t('auth.activationTipAccess')}</li>
                <li>{t('auth.verificationTipInbox')}</li>
                <li>{t('auth.verificationTipSingleUse')}</li>
              </ul>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <form className="space-y-6" onSubmit={handleVerify}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="label !text-slate-700 dark:!text-slate-200">{t('auth.otpCode')}</label>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {OTP_LENGTH} {t('auth.digitsLabel')}
                  </span>
                </div>
                <div className="mt-3">
                  <OtpInput digits={digits} onChange={setDigits} disabled={!email || verifying} ariaLabelPrefix={t('auth.otpDigitAria')} />
                </div>
              </div>

              {status.message ? <Notice title={status.message} tone={status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'info'} /> : null}

              {!email ? (
                <Notice title={t('auth.emailUnavailable')} description={t('auth.activationEmailMissing')} tone="warn" />
              ) : null}

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                {sendingCode
                  ? t('auth.sendingCode')
                  : resendCountdown > 0
                    ? t('auth.resendCountdown', { seconds: resendCountdown })
                    : t('auth.resendReady')}
              </div>

              <div className="space-y-3">
                <button
                  className="btn-primary w-full justify-center rounded-2xl py-3 text-base"
                  type="submit"
                  disabled={verifying || !email || otpCode.length !== OTP_LENGTH}
                >
                  {verifying ? (
                    <span className="inline-flex items-center gap-2">
                      <SpinnerIcon className="h-4 w-4" />
                      {t('auth.verifyingCode')}
                    </span>
                  ) : (
                    t('auth.verifyAndContinue')
                  )}
                </button>
                <button
                  className="btn-secondary w-full justify-center rounded-2xl py-3 text-base"
                  type="button"
                  onClick={handleResend}
                  disabled={sendingCode || verifying || resendCountdown > 0 || !email}
                >
                  <span className="inline-flex items-center gap-2">
                    {sendingCode ? <SpinnerIcon className="h-4 w-4" /> : <RefreshCcw size={16} />}
                    {t('auth.resendCode')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
