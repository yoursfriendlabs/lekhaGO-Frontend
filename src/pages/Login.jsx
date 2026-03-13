import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import Notice from '../components/Notice';
import { useI18n } from '../lib/i18n.jsx';

export default function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [form, setForm] = useState({ email: '', password: '', businessId: '' });
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
      const data = await api.login({ email: form.email, password: form.password });
      const resolvedBusinessId = form.businessId || data.business?.id || '';
      setSession(data.token, data.user, resolvedBusinessId);
      navigate('/app');
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg card">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-slate-900 dark:text-white">{t('auth.loginTitle')}</h1>
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? t('topbar.lightMode') : t('topbar.darkMode')}
          </button>
        </div>
        <p className="text-slate-500 dark:text-slate-400">{t('auth.loginSubtitle')}</p>
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
          <div>
            <label className="label">{t('topbar.businessId')}</label>
            <input
              className="input mt-1"
              name="businessId"
              value={form.businessId}
              onChange={handleChange}
              placeholder={t('topbar.businessPlaceholder')}
            />
            <p className="mt-1 text-xs text-slate-500">{t('notices.businessRequiredDesc')}</p>
          </div>
          {status.message ? <Notice title={status.message} tone={status.type} /> : null}
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          {t('auth.noAccount')}{' '}
          <Link className="text-emerald-600 hover:text-emerald-500 dark:text-ocean dark:hover:text-teal-300" to="/register">
            {t('auth.signUp')}
          </Link>
        </p>
      </div>
    </div>
  );
}
