import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n.jsx';
import { getFeatureAccessLevel as getPermissionAccessLevel } from '../lib/accessControl';
import { hasUnverifiedEmail, isStaffActivationRequired } from '../lib/authFlow';
import { getSubscriptionStatusState, humanizeKey } from '../lib/subscription';
import { buildSettingsTabPath, SUBSCRIPTION_SETTINGS_TAB } from '../lib/business/settingsTabs';
import AppErrorBoundary from '../components/layout/AppErrorBoundary.jsx';

export const OWNER_AND_STAFF_ROLES = ['owner', 'staff'];

export function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export function RoleGuard({ children, allowedRoles = OWNER_AND_STAFF_ROLES, redirectTo = '/app' }) {
  const { role } = useAuth();

  if (role === 'admin' || role === 'super_admin') {
    return children;
  }

  if (role && !allowedRoles.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export function SubscriptionFeatureRoute({
  children,
  featureKey,
  featureKeys,
  redirectTo = buildSettingsTabPath(SUBSCRIPTION_SETTINGS_TAB),
}) {
  const location = useLocation();
  const {
    accessControl,
    canViewFeature,
    hasSubscriptionFeatureAccess,
    role,
    subscription,
  } = useAuth();
  const { t } = useI18n();
  const keys = featureKeys || (featureKey ? [featureKey] : []);

  if (keys.some((key) => canViewFeature(key))) {
    return children;
  }

  const blockedByPermission = keys.some((key) => {
    const permissionLevel = getPermissionAccessLevel(accessControl, key, role);
    return permissionLevel === 'none' && hasSubscriptionFeatureAccess(key);
  });

  if (blockedByPermission) {
    return (
      <Navigate
        to="/app"
        replace
        state={{
          notice: {
            title: t('appAccess.permissionRedirectTitle'),
            description: t('appAccess.permissionRedirectDescription', { feature: humanizeKey(keys[0]) }),
            tone: 'warn',
            from: `${location.pathname}${location.search}`,
          },
        }}
      />
    );
  }

  const subscriptionState = getSubscriptionStatusState(subscription);
  const notice = subscriptionState.isExpired
    ? {
      title: t('appAccess.expiredRedirectTitle'),
      description: t('appAccess.expiredRedirectDescription'),
      tone: 'warn',
      from: `${location.pathname}${location.search}`,
    }
    : {
      title: t('settingsPage.subscription.redirectTitle'),
      description: t('settingsPage.subscription.redirectDescription', { feature: humanizeKey(keys[0]) }),
      tone: 'warn',
      from: `${location.pathname}${location.search}`,
    };

  return (
    <Navigate
      to={redirectTo}
      replace
      state={{
        notice,
      }}
    />
  );
}

export function PublicOnlyRoute({ children }) {
  const { token } = useAuth();
  if (token) return <Navigate to="/app" replace />;
  return children;
}

export function EmailActivationRequiredRoute({ children }) {
  const location = useLocation();
  const { role, user } = useAuth();

  if (isStaffActivationRequired(user, role)) {
    return <Navigate to="/app/activate-account" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

export function ActivationOnlyRoute({ children }) {
  const { user } = useAuth();

  if (!hasUnverifiedEmail(user)) return <Navigate to="/app" replace />;
  return children;
}

export function InvoiceAccessRoute({ children }) {
  const { type } = useParams();
  const featureKeys = type === 'purchases' ? ['purchases'] : ['sales', 'quickPos'];

  return (
    <RoleGuard allowedRoles={OWNER_AND_STAFF_ROLES}>
      <SubscriptionFeatureRoute featureKeys={featureKeys}>
        {children}
      </SubscriptionFeatureRoute>
    </RoleGuard>
  );
}

export function ScopedRouteBoundary({ children, scope = 'page' }) {
  const location = useLocation();

  return (
    <AppErrorBoundary scope={scope} resetKeys={[location.pathname, location.search]}>
      {children}
    </AppErrorBoundary>
  );
}
