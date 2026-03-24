import React, { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
const Landing = lazy(() => import('./pages/Landing'));
const Invoice = lazy(() => import('./pages/Invoice'));

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function AppShell() {
  const { businessId } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen gradient-bg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex-1 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+88px)] md:px-6 md:py-8 md:pb-8">
            {!businessId ? (
              <div className="mb-6">
                <Notice
                  title={t('notices.businessRequiredTitle')}
                  description={t('notices.businessRequiredDesc')}
                  tone="warn"
                />
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
                <Route path="/" element={<Dashboard />} />
                <Route path="products" element={<Navigate to="/app/inventory" replace />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="purchases" element={<Purchases />} />
                <Route path="sales" element={<Sales />} />
                <Route path="services" element={<Services />} />
                <Route path="parties" element={<Parties />} />
                <Route path="banks" element={<Navigate to={buildSettingsTabPath(BANKS_SETTINGS_TAB)} replace />} />
                <Route path="ledger" element={<Ledger />} />
                <Route path="analytics" element={<Analytics />} />
                <Route
                  path="order-attributes"
                  element={<Navigate to={buildSettingsTabPath(ORDER_ATTRIBUTES_SETTINGS_TAB)} replace />}
                />
                <Route path="settings" element={<Settings />} />
                <Route path="invoice/:type/:id" element={<Invoice />} />
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
                  title="Loading ManageMyShop"
                  description="Booting the production shell and restoring your session."
                />
              )}
            >
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
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
