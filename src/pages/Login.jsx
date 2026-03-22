import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Notice from '../components/Notice';
import { useI18n } from '../lib/i18n.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({ email: '', password: '', businessId: '' });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [step, setStep] = useState('login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpStatus, setOtpStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const completeLogin = async () => {
    const data = await api.login({ email: form.email, password: form.password });
    const resolvedBusinessId = form.businessId || data.business?.id || '';
    setSession(data.token, data.user, resolvedBusinessId);
    navigate('/app');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      await completeLogin();
    } catch (err) {
      const verificationRequired =
        err?.status === 403 || /verification required/i.test(String(err?.message || ''));
      if (verificationRequired) {
        const email = form.email;
        setPendingEmail(email);
        setStep('verify');
        setOtpCode('');
        setOtpStatus({ type: 'info', message: '' });
        try {
          await api.requestEmailOtp({ email });
          setOtpStatus({ type: 'success', message: t('auth.sendCode') });
        } catch (otpErr) {
          setOtpStatus({ type: 'error', message: otpErr.message });
        }
      } else {
        setStatus({ type: 'error', message: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!otpCode.trim()) {
      setOtpStatus({ type: 'error', message: t('auth.otpCode') });
      return;
    }
    setOtpLoading(true);
    setOtpStatus({ type: 'info', message: '' });
    try {
      const email = pendingEmail || form.email;
      await api.verifyEmailOtp({ email, code: otpCode.trim() });
      await completeLogin();
    } catch (err) {
      setOtpStatus({ type: 'error', message: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    const email = pendingEmail || form.email;
    if (!email) return;
    setOtpLoading(true);
    setOtpStatus({ type: 'info', message: '' });
    try {
      await api.requestEmailOtp({ email });
      setOtpStatus({ type: 'success', message: t('auth.resendCode') });
    } catch (err) {
      setOtpStatus({ type: 'error', message: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg card">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-ink">
            {step === 'verify' ? t('auth.verifyTitle') : t('auth.loginTitle')}
          </h1>
        </div>
        <p className="text-secondary-500">
          {step === 'verify'
            ? t('auth.verifySubtitle', { email: pendingEmail || form.email })
            : t('auth.loginSubtitle')}
        </p>
        {step === 'verify' ? (
          <form className="mt-6 space-y-4" onSubmit={handleVerify}>
            <div>
              <label className="label">{t('auth.otpCode')}</label>
              <input
                className="input mt-1"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="123456"
                inputMode="numeric"
              />
            </div>
            {otpStatus.message ? <Notice title={otpStatus.message} tone={otpStatus.type} /> : null}
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary flex-1" type="submit" disabled={otpLoading}>
                {otpLoading ? t('common.loading') : t('auth.verifyCode')}
              </button>
              <button className="btn-secondary flex-1" type="button" onClick={resendOtp} disabled={otpLoading}>
                {t('auth.resendCode')}
              </button>
            </div>
            <button
              className="text-sm text-primary hover:text-primary-600"
              type="button"
              onClick={() => {
                setStep('login');
                setOtpCode('');
                setOtpStatus({ type: 'info', message: '' });
              }}
            >
              {t('auth.backToLogin')}
            </button>
          </form>
        ) : (
          <>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="label">{t('auth.email')}</label>
                <input
                  className="input mt-1"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">{t('auth.password')}</label>
                <input
                  className="input mt-1"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>
              {/* Bussiness id not required yet */}
              {/* <div>
                <label className="label">{t('topbar.businessId')}</label>
                <input
                  className="input mt-1"
                  name="businessId"
                  value={form.businessId}
                  onChange={handleChange}
                  placeholder={t('topbar.businessPlaceholder')}
                />
                <p className="mt-1 text-xs text-secondary-500">{t('notices.businessRequiredDesc')}</p>
              </div> */}
              {status.message ? <Notice title={status.message} tone={status.type} /> : null}
              <button className="btn-primary w-full" type="submit" disabled={loading}>
                {loading ? t('common.loading') : t('auth.login')}
              </button>
            </form>
            <p className="mt-6 text-sm text-secondary-500">
              {t('auth.noAccount')}{' '}
              <Link className="text-primary hover:text-primary-600" to="/register">
                {t('auth.signUp')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
