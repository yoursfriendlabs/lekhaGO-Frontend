import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Notice from '../components/Notice';
import { useI18n } from '../lib/i18n.jsx';

export default function Register() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    businessName: '',
    businessType: '',
  });
  const [step, setStep] = useState('form');
  const [pending, setPending] = useState({ email: '', token: '', user: null, businessId: '' });
  const [otpCode, setOtpCode] = useState('');
  const [otpStatus, setOtpStatus] = useState({ type: 'info', message: '' });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      const data = await api.register(form);
      const businessId = data.business?.id || '';
      if (data.user?.emailVerified && data.token) {
        setSession(data.token, data.user, businessId);
        navigate('/app');
        return;
      }
      const email = data.user?.email || form.email;
      setPending({ email, token: data.token || '', user: data.user, businessId });
      setStep('verify');
      if (!data.otpSent) {
        try {
          await api.requestEmailOtp({ email });
          setOtpStatus({ type: 'success', message: t('auth.sendCode') });
        } catch (otpErr) {
          setOtpStatus({ type: 'error', message: otpErr.message });
        }
      } else {
        setOtpStatus({ type: 'success', message: t('auth.sendCode') });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
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
      const response = await api.verifyEmailOtp({ email: pending.email, code: otpCode.trim() });
      const token = response?.token || pending.token;
      const nextUser = response?.user || (pending.user ? { ...pending.user, emailVerified: true } : null);
      const businessId = response?.business?.id || pending.businessId;
      if (token) {
        setSession(token, nextUser, businessId);
        navigate('/app');
      } else {
        setOtpStatus({ type: 'success', message: t('auth.verifiedLogin') });
      }
    } catch (err) {
      setOtpStatus({ type: 'error', message: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  const resendOtp = async () => {
    if (!pending.email) return;
    setOtpLoading(true);
    setOtpStatus({ type: 'info', message: '' });
    try {
      await api.requestEmailOtp({ email: pending.email });
      setOtpStatus({ type: 'success', message: t('auth.resendCode') });
    } catch (err) {
      setOtpStatus({ type: 'error', message: err.message });
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl card">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-ink">
            {step === 'verify' ? t('auth.verifyTitle') : t('auth.registerTitle')}
          </h1>
        </div>
        <p className="text-secondary-500">
          {step === 'verify'
            ? t('auth.verifySubtitle', { email: pending.email || form.email })
            : t('auth.registerSubtitle')}
        </p>
        {step === 'verify' ? (
          <form className="mt-6 grid gap-4" onSubmit={handleVerify}>
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
            <Link className="text-sm text-primary hover:text-primary-600" to="/login">
              {t('auth.backToLogin')}
            </Link>
          </form>
        ) : (
          <>
            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="md:col-span-2">
                <label className="label">{t('auth.ownerName')}</label>
                <input
                  className="input mt-1"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
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
              <div>
                <label className="label">{t('auth.businessName')}</label>
                <input
                  className="input mt-1"
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="label">{t('auth.businessType')}</label>
                <input
                  className="input mt-1"
                  name="businessType"
                  value={form.businessType}
                  onChange={handleChange}
                  placeholder="Retail, Auto, Service"
                  required
                />
              </div>
              {status.message ? (
                <div className="md:col-span-2">
                  <Notice title={status.message} tone={status.type} />
                </div>
              ) : null}
              <div className="md:col-span-2">
                <button className="btn-primary w-full" type="submit" disabled={loading}>
                  {loading ? t('auth.creating') : t('auth.createAccount')}
                </button>
              </div>
            </form>
            <p className="mt-6 text-sm text-secondary-500">
              {t('auth.haveAccount')}{' '}
              <Link className="text-primary hover:text-primary-600" to="/login">
                {t('auth.signIn')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
