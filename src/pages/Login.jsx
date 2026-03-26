import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api } from '../lib/api';
import { hasUnverifiedEmail } from '../lib/authFlow';
import { useAuth } from '../lib/auth';
import { getVerificationEmail, isEmailVerificationRequiredError } from '../lib/emailVerification';
import { useI18n } from '../lib/i18n.jsx';
import { consumeSessionNotice, setPendingEmailVerification } from '../lib/storage';

function SpinIcon() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

const inputCls =
  'w-full h-12 rounded-lg border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 ' +
  'transition-colors focus:outline-none focus:border-[#9b6835] focus:ring-1 focus:ring-[#9b6835]';

const btnPrimary =
  'inline-flex w-full h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#9b6835] to-[#af865d] ' +
  'font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-[#8a5d2f] hover:to-[#9e7751] ' +
  'hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none';

const BRAND_STATS = [
  { value: '5+', key: 'statUsers' },
  { value: '500+', key: 'statProducts' },
  { value: '99.9%', key: 'statUptime' },
  { value: '24/7', key: 'statSupport' },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({ email: '', password: '', businessId: '' });
  const [status, setStatus] = useState(() => {
    const routedNotice = location.state?.notice;
    if (routedNotice?.message) return routedNotice;
    const message = consumeSessionNotice();
    return { type: message ? 'error' : 'info', message };
  });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: 'info', message: '' });
    try {
      const data = await api.login({ email: form.email, password: form.password });
      const resolvedBusinessId = form.businessId || data.business?.id || '';
      const resolvedRole = data.role || data.user?.role || '';
      setSession(data.token, data.user, resolvedBusinessId, resolvedRole);
      if (hasUnverifiedEmail(data.user)) {
        setPendingEmailVerification({
          email: data.user?.email || form.email,
          source: 'login',
          requestOtpOnOpen: true,
          resendAvailableAt: 0,
        });
        if (resolvedRole === 'staff') {
          navigate('/app/activate-account');
          return;
        }
      }
      navigate('/app');
    } catch (err) {
      if (isEmailVerificationRequiredError(err)) {
        const email = getVerificationEmail(err, form.email);
        setPendingEmailVerification({
          email,
          source: 'login',
          requestOtpOnOpen: true,
          resendAvailableAt: 0,
        });
        navigate('/verify-email', {
          state: {
            email,
            source: 'login',
            requestOtpOnOpen: true,
            resendAvailableAt: 0,
          },
        });
        return;
      }
      setStatus({ type: 'error', message: err.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="flex w-full items-center justify-center p-8 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center login-animate-fade-down">

            <h1 className="text-4xl font-bold tracking-tight text-gray-900">{t('auth.loginTitle')}</h1>
            <p className="mt-3 text-lg text-gray-600">{t('auth.loginHeroSubtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="login-animate-fade-up space-y-6">
            {status.message ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {status.message}
              </div>
            ) : null}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <Mail className="h-4 w-4" aria-hidden />
                {t('auth.emailAddress')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className={inputCls}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <Lock className="h-4 w-4" aria-hidden />
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="group flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="cursor-pointer rounded border-gray-300 text-[#9b6835] focus:ring-[#9b6835]"
                />
                <span className="text-sm text-gray-600 transition-colors group-hover:text-gray-900">
                  {t('auth.rememberMe')}
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-[#9b6835] transition-colors hover:text-[#8a5d2f] hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>

            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <SpinIcon />
                  {t('auth.signingIn')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.signIn')}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </span>
              )}
            </button>
          </form>

          <p className="login-animate-fade-in-delay text-center text-gray-600">
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              className="font-medium text-[#9b6835] transition-colors hover:text-[#8a5d2f] hover:underline"
            >
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </div>

      <div className="login-animate-panel relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#9b6835] via-[#af865d] to-[#9b6835] lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-20 top-20 h-72 w-72 animate-pulse rounded-full bg-white blur-3xl" />
          <div
            className="absolute bottom-20 right-20 h-96 w-96 animate-pulse rounded-full bg-white blur-3xl"
            style={{ animationDelay: '1s' }}
          />
        </div>

        <div className="relative z-10 max-w-md space-y-8 text-white">
          <div className="login-animate-brand-copy">
            <h2 className="mb-6 text-5xl font-bold leading-tight">{t('auth.brandHeadline')}</h2>
            <p className="text-xl leading-relaxed opacity-95">{t('auth.brandSub')}</p>
          </div>

          <div className="login-animate-brand-stats grid grid-cols-2 gap-6 pt-8">
            {BRAND_STATS.map((s) => (
              <div
                key={s.key}
                className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm"
              >
                <div className="mb-2 text-4xl font-bold">{s.value}</div>
                <div className="text-sm opacity-90">{t(`auth.${s.key}`)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
