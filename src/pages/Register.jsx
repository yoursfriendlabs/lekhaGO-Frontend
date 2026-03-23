import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import Notice from '../components/Notice';
import { useI18n } from '../lib/i18n.jsx';
import { setPendingEmailVerification } from '../lib/storage';

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
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);

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
        setSession(data.token, data.user, businessId, data.role || 'owner');
        navigate('/app');
        return;
      }
      const email = data.user?.email || form.email;
      const verificationContext = {
        email,
        token: data.token || '',
        user: data.user || null,
        businessId,
        role: data.role || 'owner',
        source: 'register',
        requestOtpOnOpen: !data.otpSent,
        resendAvailableAt: data.otpSent ? Date.now() + 30_000 : 0,
      };
      setPendingEmailVerification(verificationContext);
      navigate('/verify-email', {
        state: {
          ...verificationContext,
          noticeType: data.otpSent ? 'success' : 'info',
          noticeMessage: data.otpSent ? t('auth.sendCode') : '',
        },
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl card">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-ink">{t('auth.registerTitle')}</h1>
        </div>
        <p className="text-secondary-500">{t('auth.registerSubtitle')}</p>
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
      </div>
    </div>
  );
}
