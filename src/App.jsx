import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import { I18nProvider } from './lib/i18n.jsx';
import { BusinessSettingsProvider } from './lib/businessSettings';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MobileNav from './components/MobileNav';
import Notice from './components/Notice';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Purchases from './pages/Purchases';
import Sales from './pages/Sales';
import Services from './pages/Services';
import Parties from './pages/Parties';
import Ledger from './pages/Ledger';
import Analytics from './pages/Analytics';
import OrderAttributes from './pages/OrderAttributes';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Invoice from './pages/Invoice';
import { useI18n } from './lib/i18n.jsx';

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
          <main className="flex-1 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-8 md:px-6 md:py-8">
            {!businessId ? (
              <div className="mb-6">
                <Notice
                  title={t('notices.businessRequiredTitle')}
                  description={t('notices.businessRequiredDesc')}
                  tone="warn"
                />
              </div>
            ) : null}
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="products" element={<Navigate to="/app/inventory" replace />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="sales" element={<Sales />} />
              <Route path="services" element={<Services />} />
              <Route path="parties" element={<Parties />} />
              <Route path="ledger" element={<Ledger />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="order-attributes" element={<OrderAttributes />} />
              <Route path="settings" element={<Settings />} />
              <Route path="invoice/:type/:id" element={<Invoice />} />
            </Routes>
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
          <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/app/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
      </Routes>
          </BusinessSettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
