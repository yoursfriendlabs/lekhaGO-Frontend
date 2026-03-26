import React, { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { I18nProvider, useI18n } from './lib/i18n.jsx';
import { BusinessSettingsProvider } from './lib/businessSettings';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MobileNav from './components/MobileNav';
import Notice from './components/Notice';
import RouteFallback from './components/RouteFallback';
import PwaLifecycle from './components/PwaLifecycle';
import { hasUnverifiedEmail, isStaffActivationRequired } from './lib/authFlow';
import { BANKS_SETTINGS_TAB, buildSettingsTabPath, ORDER_ATTRIBUTES_SETTINGS_TAB } from './lib/settingsTabs';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Sales = lazy(() => import('./pages/Sales'));
const Services = lazy(() => import('./pages/Services'));
const Parties = lazy(() => import('./pages/Parties'));
const Ledger = lazy(() => import('./pages/Ledger'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ForgotPasswordOtp = lazy(() => import('./pages/ForgotPasswordOtp'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const ActivateAccount = lazy(() => import('./pages/ActivateAccount'));
const Landing = lazy(() => import('./pages/Landing'));
const Invoice = lazy(() => import('./pages/Invoice'));

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnlyRoute({ children }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/app" replace />;
  return children;
}

function IndexRoute() {
  const { token } = useAuth();
  return token ? <Navigate to="/app" replace /> : <Landing />;
}

function EmailActivationRequiredRoute({ children }) {
  const location = useLocation();
  const { role, user } = useAuth();

  if (isStaffActivationRequired(user, role)) {
    return <Navigate to="/app/activate-account" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

function ActivationOnlyRoute({ children }) {
  const { user } = useAuth();

  if (!hasUnverifiedEmail(user)) return <Navigate to="/app" replace />;
  return children;
}

function AppShell() {
  const { businessId, role, user } = useAuth();
  const { t } = useI18n();
  const showVerificationBanner = hasUnverifiedEmail(user);
  const requiresActivation = isStaffActivationRequired(user, role);

  return (
    <div className="min-h-screen gradient-bg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 md:h-screen md:overflow-hidden">
      <div className="flex min-h-screen md:h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col md:ml-64 md:min-h-0 md:h-screen md:overflow-hidden">
          <Topbar />
          <main className="flex-1 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+88px)] md:min-h-0 md:overflow-y-auto md:px-6 md:py-8 md:pb-8">
            {!businessId ? (
              <div className="mb-6">
                <Notice
                  title={t('notices.businessRequiredTitle')}
                  description={t('notices.businessRequiredDesc')}
                  tone="warn"
                />
              </div>
            ) : null}
            {showVerificationBanner ? (
              <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/10">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
                      {t('auth.emailVerificationBannerEyebrow')}
                    </p>
                    <h2 className="mt-2 font-serif text-xl text-slate-900 dark:text-white">
                      {requiresActivation ? t('auth.activationBannerStaffTitle') : t('auth.activationBannerTitle')}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {requiresActivation ? t('auth.activationBannerStaffDescription') : t('auth.activationBannerDescription')}
                    </p>
                  </div>
                  <Link className="btn-secondary justify-center whitespace-nowrap" to="/app/activate-account">
                    {t('auth.verifyEmailCta')}
                  </Link>
                </div>
              </div>
            ) : null}
            <Suspense
              fallback={(
                <RouteFallback
                  title="Loading workspace"
                  description="Preparing the next dashboard view and reusing cached business data."
                />
              )}
            >
              <Routes>
                <Route path="/" element={<EmailActivationRequiredRoute><Dashboard /></EmailActivationRequiredRoute>} />
                <Route path="products" element={<EmailActivationRequiredRoute><Navigate to="/app/inventory" replace /></EmailActivationRequiredRoute>} />
                <Route path="inventory" element={<EmailActivationRequiredRoute><Inventory /></EmailActivationRequiredRoute>} />
                <Route path="purchases" element={<EmailActivationRequiredRoute><Purchases /></EmailActivationRequiredRoute>} />
                <Route path="sales" element={<EmailActivationRequiredRoute><Sales /></EmailActivationRequiredRoute>} />
                <Route path="services" element={<EmailActivationRequiredRoute><Services /></EmailActivationRequiredRoute>} />
                <Route path="parties" element={<EmailActivationRequiredRoute><Parties /></EmailActivationRequiredRoute>} />
                <Route path="banks" element={<EmailActivationRequiredRoute><Navigate to={buildSettingsTabPath(BANKS_SETTINGS_TAB)} replace /></EmailActivationRequiredRoute>} />
                <Route path="ledger" element={<EmailActivationRequiredRoute><Ledger /></EmailActivationRequiredRoute>} />
                <Route path="analytics" element={<EmailActivationRequiredRoute><Analytics /></EmailActivationRequiredRoute>} />
                <Route
                  path="order-attributes"
                  element={<EmailActivationRequiredRoute><Navigate to={buildSettingsTabPath(ORDER_ATTRIBUTES_SETTINGS_TAB)} replace /></EmailActivationRequiredRoute>}
                />
                <Route path="settings" element={<EmailActivationRequiredRoute><Settings /></EmailActivationRequiredRoute>} />
                <Route path="invoice/:type/:id" element={<EmailActivationRequiredRoute><Invoice /></EmailActivationRequiredRoute>} />
                <Route path="activate-account" element={<ActivationOnlyRoute><ActivateAccount /></ActivationOnlyRoute>} />
              </Routes>
            </Suspense>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <BusinessSettingsProvider>
            <Suspense
              fallback={(
                <RouteFallback
                  title="Loading PasalManager"
                  description="Booting the production shell and restoring your session."
                />
              )}
            >
              <Routes>
                <Route path="/" element={<IndexRoute />} />
                <Route
                  path="/login"
                  element={(
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/register"
                  element={(
                    <PublicOnlyRoute>
                      <Register />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/verify-email"
                  element={(
                    <PublicOnlyRoute>
                      <VerifyEmail />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/forgot-password"
                  element={(
                    <PublicOnlyRoute>
                      <ForgotPassword />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/forgot-password/otp"
                  element={(
                    <PublicOnlyRoute>
                      <ForgotPasswordOtp />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/forgot-password/reset"
                  element={(
                    <PublicOnlyRoute>
                      <ResetPassword />
                    </PublicOnlyRoute>
                  )}
                />
                <Route
                  path="/app/*"
                  element={(
                    <ProtectedRoute>
                      <AppShell />
                    </ProtectedRoute>
                  )}
                />
              </Routes>
            </Suspense>
            <PwaLifecycle />
          </BusinessSettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
