import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Store,
  UserRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { setPendingEmailVerification } from '../lib/storage';
import { getFallbackBusinessTypes } from '../lib/businessProfile';
import SearchableSelect from '../components/SearchableSelect.jsx';

const inputCls =
  'w-full h-12 rounded-xl border border-gray-300 bg-white px-4 text-gray-900 placeholder-gray-400 ' +
  'transition-colors focus:outline-none focus:border-[#9b6835] focus:ring-1 focus:ring-[#9b6835]';

const btnPrimary =
  'inline-flex w-full h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#9b6835] to-[#af865d] ' +
  'font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.01] hover:from-[#8a5d2f] hover:to-[#9e7751] ' +
  'hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none';

const REGISTRATION_HIDDEN_TYPES = new Set(['jewellery', 'cafe']);

const typeIconMap = {
  retail: Store,
};

function getTypeIcon(type) {
  return typeIconMap[type] || Building2;
}

function getRegistrationBusinessTypes(items) {
  return (Array.isArray(items) ? items : []).filter((item) => {
    const value = String(item?.value || '').toLowerCase();
    return value && !REGISTRATION_HIDDEN_TYPES.has(value);
  });
}

function buildStatusCopy(status, t) {
  if (!status?.message) return null;

  if (/email already in use/i.test(status.message)) {
    return {
      title: t('auth.registerEmailExistsTitle'),
      description: t('auth.registerEmailExistsDescription'),
    };
  }

  if (/register failed/i.test(status.message)) {
    return {
      title: t('auth.registerFailedTitle'),
      description: t('auth.registerFailedDescription'),
    };
  }

  return {
    title: status.message,
    description: '',
  };
}

export default function Register() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    businessName: '',
    businessType: '',
  });
  const [status, setStatus] = useState({ type: 'info', message: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [businessTypes, setBusinessTypes] = useState(() => getRegistrationBusinessTypes(getFallbackBusinessTypes()));

  useEffect(() => {
    let active = true;

    api.getBusinessTypes()
      .then((data) => {
        if (!active) return;
        const remoteItems = getRegistrationBusinessTypes(data?.items);
        const items = remoteItems.length ? remoteItems : getRegistrationBusinessTypes(getFallbackBusinessTypes());
        setBusinessTypes(items);
      })
      .catch(() => {
        if (!active) return;
        setBusinessTypes(getRegistrationBusinessTypes(getFallbackBusinessTypes()));
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!businessTypes.length) return;
    if (businessTypes.some((entry) => entry.value === form.businessType)) return;
    setForm((prev) => ({
      ...prev,
      businessType: businessTypes[0].value,
    }));
  }, [businessTypes, form.businessType]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const businessTypeOptions = useMemo(
    () => businessTypes.map((type) => ({ value: type.value, label: type.label })),
    [businessTypes]
  );

  const selectedBusinessType = useMemo(
    () => businessTypes.find((entry) => entry.value === form.businessType) || businessTypes[0] || null,
    [businessTypes, form.businessType]
  );

  const selectedHighlights = useMemo(() => {
    if (!selectedBusinessType) return [];

    const highlights = [
      selectedBusinessType.inventory?.title,
      selectedBusinessType.salesFlow?.createLabel,
      selectedBusinessType.servicesFlow?.enabled ? selectedBusinessType.servicesFlow?.navLabel : null,
      selectedBusinessType.modules?.purchases ? 'Purchases' : null,
      selectedBusinessType.modules?.analytics ? 'Analytics' : null,
    ].filter(Boolean);

    return [...new Set(highlights)].slice(0, 4);
  }, [selectedBusinessType]);

  const statusCopy = useMemo(() => buildStatusCopy(status, t), [status, t]);
  const phoneDigits = useMemo(() => String(form.phone || '').replace(/\D/g, ''), [form.phone]);
  const showBusinessTypePicker = businessTypeOptions.length > 1;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (phoneDigits.length < 10) {
      setStatus({ type: 'error', message: t('errors.phoneMinDigits') });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: '' });

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        businessName: form.businessName.trim(),
        businessType: form.businessType,
      };
      const data = await api.register(payload);
      const businessId = data.business?.id || '';
      if (data.user?.emailVerified && data.token) {
        setSession(
          data.token,
          data.user,
          businessId,
          data.role || 'owner',
          data.subscription || null,
          data.business || null,
          data.businessProfile || null
        );
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
        subscription: data.subscription || null,
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
      setStatus({ type: 'error', message: err.message || t('auth.registerFailedTitle') });
    } finally {
      setLoading(false);
    }
  };

  const SelectedTypeIcon = getTypeIcon(selectedBusinessType?.value);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-2xl space-y-6">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center rounded-full border border-[#9b6835]/20 bg-[#9b6835]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6835]">
              {t('auth.register')}
            </span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900">{t('auth.registerTitle')}</h1>
            <p className="mt-3 text-lg text-gray-600">{t('auth.registerSubtitle')}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-[2rem] border border-[#9b6835]/10 bg-white/95 p-6 shadow-[0_24px_80px_-40px_rgba(155,104,53,0.45)] backdrop-blur sm:p-8"
          >
            {statusCopy ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold">{statusCopy.title}</p>
                {statusCopy.description ? (
                  <p className="mt-1 text-rose-600/90">{statusCopy.description}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="owner-name" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <UserRound className="h-4 w-4" aria-hidden />
                  {t('auth.ownerName')}
                </label>
                <input
                  id="owner-name"
                  className={inputCls}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoComplete="name"
                  placeholder={t('auth.registerNamePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="register-phone" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Phone className="h-4 w-4" aria-hidden />
                  {t('auth.phone')}
                </label>
                <input
                  id="register-phone"
                  className={inputCls}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  autoComplete="tel"
                  placeholder={t('auth.phonePlaceholder')}
                />
                {form.phone && phoneDigits.length < 10 ? (
                  <p className="text-xs font-medium text-rose-600">{t('errors.phoneMinDigits')}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="register-email" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Mail className="h-4 w-4" aria-hidden />
                  {t('auth.email')}
                </label>
                <input
                  id="register-email"
                  className={inputCls}
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="register-password" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Lock className="h-4 w-4" aria-hidden />
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <input
                    id="register-password"
                    className={`${inputCls} pr-12`}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    placeholder={t('auth.registerPasswordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#8a5d2f]"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="business-name" className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Building2 className="h-4 w-4" aria-hidden />
                  {t('auth.businessName')}
                </label>
                <input
                  id="business-name"
                  className={inputCls}
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  required
                  autoComplete="organization"
                  placeholder={t('auth.registerBusinessNamePlaceholder')}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <SelectedTypeIcon className="h-4 w-4" aria-hidden />
                  {t('auth.businessType')}
                </label>
                {showBusinessTypePicker ? (
                  <SearchableSelect
                    options={businessTypeOptions}
                    value={form.businessType}
                    onChange={(value) => setForm((prev) => ({ ...prev, businessType: value }))}
                    placeholder={t('auth.registerBusinessTypePlaceholder')}
                  />
                ) : selectedBusinessType ? (
                  <div className="rounded-2xl border border-[#9b6835]/15 bg-[#9b6835]/6 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#9b6835]/10 text-[#9b6835]">
                        <SelectedTypeIcon className="h-5 w-5" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{selectedBusinessType.label}</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{selectedBusinessType.description}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {selectedBusinessType ? (
              <div className="rounded-2xl border border-[#9b6835]/15 bg-[#fcfaf7] p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#9b6835]/10 text-[#9b6835]">
                    <SelectedTypeIcon className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">{t('auth.registerSetupTitle')}</h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-600">{t('auth.registerWorkflowDescription')}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedHighlights.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <button className={btnPrimary} type="submit" disabled={loading || !form.businessType}>
              {loading ? (
                <span>{t('auth.creating')}</span>
              ) : (
                <span className="flex items-center gap-2">
                  {t('auth.createAccount')}
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-gray-600 lg:text-left">
            {t('auth.haveAccount')}{' '}
            <Link
              className="font-medium text-[#9b6835] transition-colors hover:text-[#8a5d2f] hover:underline"
              to="/login"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#9b6835] via-[#af865d] to-[#9b6835] lg:flex lg:items-center lg:justify-center lg:p-12">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute left-20 top-20 h-72 w-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-16 h-96 w-96 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10 max-w-lg space-y-8 text-white">
          <div>
            <h2 className="text-5xl font-bold leading-tight">{t('auth.registerWorkflowTitle')}</h2>
            <p className="mt-4 text-lg leading-8 text-white/90">
              {t('auth.registerWorkflowDescription')}
            </p>
          </div>

          {selectedBusinessType ? (
            <div className="rounded-3xl border border-white/30 bg-white/12 p-6 backdrop-blur-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                  <SelectedTypeIcon className="h-7 w-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">
                    {t('auth.registerSetupTitle')}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">{selectedBusinessType.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/85">{selectedBusinessType.description}</p>
                </div>
              </div>

              {selectedHighlights.length ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {selectedHighlights.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white/95"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-white" aria-hidden />
                        <span>{item}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
