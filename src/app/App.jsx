import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import { I18nProvider } from '../lib/i18n.jsx';
import { BusinessSettingsProvider } from '../lib/business/businessSettings';
import { SnackbarProvider } from '../lib/snackbar.jsx';
import RouteFallback from '../components/layout/RouteFallback';
import PwaLifecycle from '../components/layout/PwaLifecycle';
import AppShell from './AppShell';
import {
  ProtectedRoute,
  PublicOnlyRoute,
  ScopedRouteBoundary,
} from './guards';
import {
  ForgotPassword,
  ForgotPasswordOtp,
  Landing,
  Login,
  PaymentCallback,
  Register,
  ResetPassword,
  VerifyEmail,
} from './pages';

function IndexRoute() {
  const { token } = useAuth();
  return token ? <Navigate to="/app" replace /> : <Landing />;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <BusinessSettingsProvider>
            <SnackbarProvider>
              <Suspense
                fallback={(
                  <RouteFallback
                    title="Loading PasalManager"
                    description="Booting the production shell and restoring your session."
                  />
                )}
              >
                <ScopedRouteBoundary>
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
                      path="/payment/:provider/:status"
                      element={(
                        <ProtectedRoute>
                          <PaymentCallback />
                        </ProtectedRoute>
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
                </ScopedRouteBoundary>
              </Suspense>
              <PwaLifecycle />
            </SnackbarProvider>
          </BusinessSettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
