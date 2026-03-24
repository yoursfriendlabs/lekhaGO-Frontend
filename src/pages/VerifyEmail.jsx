import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, MailCheck, RefreshCcw, ShieldCheck } from 'lucide-react';
import Notice from '../components/Notice';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import {
  clearPendingEmailVerification,
  getPendingEmailVerification,
  setPendingEmailVerification,
} from '../lib/storage';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_DIGIT_MAP = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

function normalizeContext(value) {
  if (!value?.email) return null;

  return {
    email: String(value.email).trim(),
    token: value.token || '',
    user: value.user || null,
    businessId: value.businessId || '',
    role: value.role || '',
    source: value.source || 'login',
    requestOtpOnOpen: Boolean(value.requestOtpOnOpen ?? value.autoSend),
    resendAvailableAt: Number(value.resendAvailableAt || 0),
  };
}

function getInitialContext(locationState) {
  return normalizeContext(locationState) || normalizeContext(getPendingEmailVerification());
}

function getRemainingSeconds(resendAvailableAt) {
  if (!resendAvailableAt) return 0;
  const remainingMs = resendAvailableAt - Date.now();
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 1000);
}

function normalizeOtpDigits(rawValue) {
  return Array.from(String(rawValue || ''))
    .map((char) => OTP_DIGIT_MAP[char] || '')
    .join('');
}

function OtpInput({ digits, onChange, disabled }) {
  const inputRefs = useRef([]);

  const focusIndex = (index) => {
    const target = inputRefs.current[index];
    if (!target) return;
    target.focus();
    target.select();
  };

  const applyDigits = (startIndex, rawValue) => {
    const clean = normalizeOtpDigits(rawValue);
    if (!clean) return;

    const nextDigits = [...digits];
    clean
      .slice(0, OTP_LENGTH - startIndex)
      .split('')
      .forEach((digit, offset) => {
        nextDigits[startIndex + offset] = digit;
      });

    onChange(nextDigits);

    const nextFocusIndex = Math.min(startIndex + clean.length, OTP_LENGTH - 1);
    window.requestAnimationFrame(() => focusIndex(nextFocusIndex));
  };

  const handleChange = (index, value) => {
    if (!value) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      onChange(nextDigits);
      return;
    }

    applyDigits(index, value);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        const nextDigits = [...digits];
        nextDigits[index] = '';
        onChange(nextDigits);
        return;
      }

      if (index > 0) {
        const nextDigits = [...digits];
        nextDigits[index - 1] = '';
        onChange(nextDigits);
        window.requestAnimationFrame(() => focusIndex(index - 1));
      }
      return;
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          className="h-14 rounded-2xl border border-slate-200 bg-white px-0 text-center text-3xl font-semibold leading-none text-slate-900 shadow-sm outline-none transition [font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation_Mono,Courier_New,monospace] [font-variant-numeric:lining-nums_tabular-nums] focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          inputMode="numeric"
          pattern="[0-9]*"
          lang="en"
          dir="ltr"
          spellCheck={false}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LENGTH}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            applyDigits(index, event.clipboardData.getData('text'));
          }}
          disabled={disabled}
          aria-label={`OTP digit ${index + 1}`}
        />
      ))}
    </div>
  );
}

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [context, setContext] = useState(() => getInitialContext(location.state));
  const [digits, setDigits] = useState(() => Array.from({ length: OTP_LENGTH }, () => ''));
  const [status, setStatus] = useState(() => ({
    type: location.state?.noticeType || 'info',
    message: location.state?.noticeMessage || '',
  }));
  const [verifying, setVerifying] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(() =>
    getRemainingSeconds(getInitialContext(location.state)?.resendAvailableAt)
  );

  const email = context?.email || '';
  const canVerify = Boolean(email);
  const otpCode = digits.join('');

  useEffect(() => {
    if (!context) return;
    setPendingEmailVerification(context);
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
    if (!context?.email || !context?.requestOtpOnOpen) return undefined;

    let active = true;
    const emailToVerify = context.email;
    const nextContext = { ...context, requestOtpOnOpen: false };

    setPendingEmailVerification(nextContext);
    setContext(nextContext);
    setSendingCode(true);
    setStatus({ type: 'info', message: '' });

    api.requestEmailOtp({ email: emailToVerify })
      .then(() => {
        if (!active) return;
        const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
        setContext((previous) => (
          previous && previous.email === emailToVerify
            ? { ...previous, resendAvailableAt }
            : previous
        ));
        setStatus({ type: 'success', message: t('auth.sendCode') });
      })
      .catch((error) => {
        if (!active) return;
        setStatus({ type: 'error', message: error.message });
      })
      .finally(() => {
        if (!active) return;
        setSendingCode(false);
      });

    return () => {
      active = false;
    };
  }, [context?.email, context?.requestOtpOnOpen, t]);

  const subtitle = useMemo(() => {
    if (!email) return t('auth.verifySubtitleGeneric');
    return t('auth.verifySubtitle', { email });
  }, [email, t]);

  const handleVerify = async (event) => {
    event.preventDefault();

    if (otpCode.length !== OTP_LENGTH) {
      setStatus({ type: 'error', message: t('auth.otpIncomplete') });
      return;
    }

    if (!canVerify) {
      setStatus({ type: 'error', message: t('auth.verificationContextMissing') });
      return;
    }

    setVerifying(true);
    setStatus({ type: 'info', message: '' });

    try {
      const response = await api.verifyEmailOtp({ email, code: otpCode });
      const token = response?.token || context?.token || '';
      const user = response?.user || (context?.user ? { ...context.user, emailVerified: true } : null);
      const businessId = response?.business?.id || context?.businessId || '';
      const role = response?.role || context?.role || '';

      clearPendingEmailVerification();

      if (token) {
        setSession(token, user, businessId, role);
        navigate('/app');
        return;
      }

      navigate('/login', {
        replace: true,
        state: {
          notice: {
            type: 'success',
            message: t('auth.verifiedLogin'),
          },
        },
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canVerify) {
      setStatus({ type: 'error', message: t('auth.verificationContextMissing') });
      return;
    }

    if (sendingCode || resendCountdown > 0) return;

    setSendingCode(true);
    setStatus({ type: 'info', message: '' });

    try {
      await api.requestEmailOtp({ email });
      const resendAvailableAt = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      setContext((previous) => (previous ? { ...previous, resendAvailableAt } : previous));
      setStatus({ type: 'success', message: t('auth.resendCodeSuccess') });
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSendingCode(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/85">
        <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="bg-gradient-to-br from-primary/10 via-amber-50 to-white p-8 dark:from-primary/15 dark:via-slate-900 dark:to-slate-950">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
              <ShieldCheck size={28} />
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
              {t('auth.verifyTitle')}
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight text-slate-900 dark:text-white">
              Secure your sign in.
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
                {t('auth.verificationTipsTitle')}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li>{t('auth.verificationTipInbox')}</li>
                <li>{t('auth.verificationTipSpam')}</li>
                <li>{t('auth.verificationTipSingleUse')}</li>
              </ul>
            </div>
          </div>

          <div className="p-8 md:p-10">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <ArrowLeft size={16} />
              <Link className="hover:text-primary" to="/login">
                {t('auth.backToLogin')}
              </Link>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleVerify}>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="label !text-slate-700 dark:!text-slate-200">{t('auth.otpCode')}</label>
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                    {OTP_LENGTH} digits
                  </span>
                </div>
                <div className="mt-3">
                  <OtpInput digits={digits} onChange={setDigits} disabled={!canVerify || verifying} />
                </div>
              </div>

              {status.message ? <Notice title={status.message} tone={status.type} /> : null}

              {!canVerify ? (
                <Notice title={t('auth.verificationContextMissing')} tone="warn" />
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
                  className="btn-primary w-full rounded-2xl py-3 text-base"
                  type="submit"
                  disabled={verifying || !canVerify || otpCode.length !== OTP_LENGTH}
                >
                  {verifying ? t('common.loading') : t('auth.verifyCode')}
                </button>
                <button
                  className="btn-secondary w-full rounded-2xl py-3 text-base"
                  type="button"
                  onClick={handleResend}
                  disabled={sendingCode || verifying || resendCountdown > 0 || !canVerify}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw size={16} />
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
