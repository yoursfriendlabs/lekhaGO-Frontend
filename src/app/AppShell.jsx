import { Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { useBusinessSettings } from '../lib/business/businessSettings';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import MobileNav from '../components/layout/MobileNav';
import Notice from '../components/ui/Notice';
import RouteFallback from '../components/layout/RouteFallback';
import SubscriptionStatusBanner, { formatSubscriptionStatusDate } from '../components/subscription/SubscriptionStatusBanner.jsx';
import { isOwnStaffMembership } from '../lib/accessControl';
import { hasUnverifiedEmail, isStaffActivationRequired } from '../lib/authFlow';
import { getSubscriptionGuard, getSubscriptionStatusState } from '../lib/subscription';
import { buildSettingsTabPath, ORDER_ATTRIBUTES_SETTINGS_TAB, SUBSCRIPTION_SETTINGS_TAB } from '../lib/business/settingsTabs';
import { useSSE } from '../hooks/useSSE';
import {
  ActivationOnlyRoute,
  EmailActivationRequiredRoute,
  InvoiceAccessRoute,
  OWNER_AND_STAFF_ROLES,
  RoleGuard,
  ScopedRouteBoundary,
  SubscriptionFeatureRoute,
} from './guards';
import {
  ActivateAccount,
  Attendance,
  Banks,
  CafeOrders,
  CashierBilling,
  Dashboard,
  Inventory,
  Invoice,
  Parties,
  Profile,
  Purchases,
  QuickPos,
  Reports,
  Sales,
  Services,
  Settings,
  Staff,
  StaffSalaryProfile,
  Tables,
  Tasks,
} from './pages';

function StaffOrPersonalProfileRoute() {
  const { role, accessControl } = useAuth();
  if (role === 'staff' && accessControl?.membershipId) {
    return <StaffSalaryProfile />;
  }
  return <Profile />;
}

function OwnOrManagedStaffSalaryRoute() {
  const { membershipId } = useParams();
  const { accessControl, canViewFeature } = useAuth();
  if (isOwnStaffMembership(accessControl, membershipId) || canViewFeature('staff')) {
    return <StaffSalaryProfile />;
  }
  return (
    <SubscriptionFeatureRoute featureKey="staff">
      <StaffSalaryProfile />
    </SubscriptionFeatureRoute>
  );
}

function LedgerRedirect() {
  const [searchParams] = useSearchParams();
  const partyId = searchParams.get('partyId');
  const target = partyId ? `/app/reports?tab=party&partyId=${partyId}` : `/app/reports?tab=party`;
  return <Navigate to={target} replace />;
}

export default function AppShell() {
  const { businessId, role, user, subscription, subscriptionAccess } = useAuth();
  useSSE();
  const { locale, t } = useI18n();
  const { businessProfile } = useBusinessSettings();
  const location = useLocation();
  const showVerificationBanner = hasUnverifiedEmail(user);
  const requiresActivation = isStaffActivationRequired(user, role);
  const servicesEnabled = businessProfile?.modules?.services !== false;
  const cafeOrdersEnabled = businessProfile?.modules?.orders === true || businessProfile?.type === 'cafe' || businessProfile?.settings?.enabledModules?.includes('tables');
  const salesRoute = businessProfile?.salesFlow?.route || '/app/pos';
  const posPageElement = <QuickPos />;
  const subscriptionGuard = getSubscriptionGuard(subscription);
  const subscriptionStatusState = getSubscriptionStatusState(subscription);
  const hasRecoverableBusinessMismatch = role === 'owner' && subscriptionAccess?.guard === 'business_missing';
  const cancelAtPeriodEndActive = Boolean(
    (subscriptionAccess?.cancelAtPeriodEnd || subscription?.cancellation?.cancelAtPeriodEnd)
    && subscriptionAccess?.canUseApplication !== false
    && !subscriptionStatusState.isExpired
  );
  const cancelEffectiveUntilLabel = formatSubscriptionStatusDate(
    subscription?.cancellation?.effectiveUntil
      || subscription?.currentPlan?.subscriptionEndDate
      || subscription?.currentPlan?.nextBillingDate,
    locale
  );
  const subscriptionNotice = subscriptionStatusState.isExpired
    ? null
    : hasRecoverableBusinessMismatch
    ? null
    : subscriptionAccess?.canUseApplication === false
    ? {
      title: subscriptionGuard.title || t('appAccess.lockedTitle'),
      description: subscriptionGuard.description || t('appAccess.lockedDescription'),
      tone: 'warn',
    }
    : cancelAtPeriodEndActive
      ? {
        title: t('appAccess.cancelAtPeriodEndTitle'),
        description: t('appAccess.cancelAtPeriodEndDescription', { date: cancelEffectiveUntilLabel }),
        tone: 'warn',
        ctaLabel: subscriptionAccess?.canReactivate || subscription?.cancellation?.canReactivate
          ? t('appAccess.reactivateCta')
          : t('appAccess.manageSubscriptionCta'),
      }
    : (subscriptionAccess?.requiresPaymentSetup && !subscriptionStatusState.isTrialActive)
      ? {
        title: t('appAccess.paymentSetupTitle'),
        description: subscriptionGuard.description || t('appAccess.paymentSetupDescription'),
        tone: 'warn',
      }
      : subscriptionAccess?.requiresManualReview
        ? {
          title: t('appAccess.manualReviewTitle'),
          description: subscriptionGuard.description || t('appAccess.manualReviewDescription'),
          tone: 'info',
        }
        : subscriptionAccess?.hasPendingChange
          ? {
            title: t('appAccess.pendingChangeTitle'),
            description: subscriptionGuard.description || t('appAccess.pendingChangeDescription'),
            tone: 'info',
          }
          : null;
  const routeNotice = location.state?.notice || null;

  return (
    <div className="gradient-bg min-h-[100dvh] overflow-x-hidden bg-mist text-ink md:h-screen md:overflow-hidden">
      <div className="flex min-h-[100dvh] max-w-full md:h-screen">
        <Sidebar />
        <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-x-hidden md:ml-64 md:min-h-0 md:h-screen md:overflow-hidden">
          <Topbar />
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:min-h-0 md:overflow-y-auto md:px-6 md:py-8 md:pb-8">
            {!businessId ? (
              <div className="mb-6">
                <Notice
                  title={t('notices.businessRequiredTitle')}
                  description={t('notices.businessRequiredDesc')}
                  tone="warn"
                />
              </div>
            ) : null}
            {routeNotice ? (
              <div className="mb-6">
                <Notice
                  title={routeNotice.title}
                  description={routeNotice.description}
                  tone={routeNotice.tone}
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
                    <h2 className="mt-2 font-serif text-xl text-ink">
                      {requiresActivation ? t('auth.activationBannerStaffTitle') : t('auth.activationBannerTitle')}
                    </h2>
                    <p className="mt-2 text-sm text-secondary-600">
                      {requiresActivation ? t('auth.activationBannerStaffDescription') : t('auth.activationBannerDescription')}
                    </p>
                  </div>
                  <Link className="btn-secondary justify-center whitespace-nowrap" to="/app/activate-account">
                    {t('auth.verifyEmailCta')}
                  </Link>
                </div>
              </div>
            ) : null}
            {subscriptionStatusState.isExpired ? (
              <SubscriptionStatusBanner subscription={subscription} />
            ) : null}
            {subscriptionNotice ? (
              <div className="mb-6">
                <Notice
                  title={subscriptionNotice.title}
                  description={subscriptionNotice.description}
                  tone={subscriptionNotice.tone}
                />
                <div className="mt-3">
                  <Link className="btn-secondary justify-center" to={buildSettingsTabPath(SUBSCRIPTION_SETTINGS_TAB)}>
                    {subscriptionNotice.ctaLabel || t('appAccess.manageSubscriptionCta')}
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
              <ScopedRouteBoundary>
                <Routes>
                  <Route path="/" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="dashboard"><Dashboard /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="products" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="inventory"><Navigate to="/app/inventory" replace /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="inventory" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="inventory"><Inventory /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="purchases" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="purchases"><Purchases /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route
                    path="orders"
                    element={(
                      <EmailActivationRequiredRoute>
                        <RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}>
                          <SubscriptionFeatureRoute featureKey="orders">
                            {cafeOrdersEnabled ? <CafeOrders /> : <Navigate to={salesRoute} replace />}
                          </SubscriptionFeatureRoute>
                        </RoleGuard>
                      </EmailActivationRequiredRoute>
                    )}
                  />
                  <Route path="sales" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="sales"><Sales /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="pos" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="quickPos">{posPageElement}</SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route
                    path="services"
                    element={(
                      <EmailActivationRequiredRoute>
                        <RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}>
                          <SubscriptionFeatureRoute featureKey="services">
                            {servicesEnabled ? <Services /> : <Navigate to={salesRoute} replace />}
                          </SubscriptionFeatureRoute>
                        </RoleGuard>
                      </EmailActivationRequiredRoute>
                    )}
                  />
                  <Route path="parties" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="parties"><Parties /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="tables" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="tables"><Tables /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="billing" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKeys={['billing', 'sales', 'quickPos']}><CashierBilling /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route
                    path="tasks"
                    element={(
                      <EmailActivationRequiredRoute>
                        <RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}>
                          <SubscriptionFeatureRoute featureKey="tasks">
                            <Tasks />
                          </SubscriptionFeatureRoute>
                        </RoleGuard>
                      </EmailActivationRequiredRoute>
                    )}
                  />
                  <Route path="banks" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="banks"><Banks /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="ledger" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="reports"><LedgerRedirect /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="analytics" element={<Navigate to="/app/reports?tab=overview" replace />} />
                  <Route path="reports" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="reports"><Reports /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="attendance" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={['staff']}><SubscriptionFeatureRoute featureKey="attendance"><Attendance /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="staff" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="staff"><Staff /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route
                    path="staff-salary/:membershipId"
                    element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><OwnOrManagedStaffSalaryRoute /></RoleGuard></EmailActivationRequiredRoute>}
                  />
                  <Route path="admin" element={<Navigate to="/app/settings" replace />} />
                  <Route
                    path="order-attributes"
                    element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><SubscriptionFeatureRoute featureKey="order-attributes"><Navigate to={buildSettingsTabPath(ORDER_ATTRIBUTES_SETTINGS_TAB)} replace /></SubscriptionFeatureRoute></RoleGuard></EmailActivationRequiredRoute>}
                  />
                  <Route path="settings" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><Settings /></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="profile" element={<EmailActivationRequiredRoute><RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}><StaffOrPersonalProfileRoute /></RoleGuard></EmailActivationRequiredRoute>} />
                  <Route path="invoice/:type/:id" element={<EmailActivationRequiredRoute><InvoiceAccessRoute><Invoice /></InvoiceAccessRoute></EmailActivationRequiredRoute>} />
                  <Route path="activate-account" element={<ActivationOnlyRoute><ActivateAccount /></ActivationOnlyRoute>} />
                </Routes>
              </ScopedRouteBoundary>
            </Suspense>
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
