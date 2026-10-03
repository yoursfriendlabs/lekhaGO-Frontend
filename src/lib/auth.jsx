import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getAccessControl,
  clearPendingEmailVerification,
  clearSession,
  getBusiness,
  getBusinessId,
  getBusinessProfile,
  getRole,
  getSubscription,
  getToken,
  getUser,
  setBusiness,
  setBusinessId,
  setBusinessProfile,
  setAccessControl,
  setRole,
  setSubscription,
  setToken,
  setUser,
} from './storage';
import { api, clearApiCache } from './api';
import {
  getFeatureAccessLevel as getFeatureAccessLevelFromAccessControl,
  getSubscriptionFeatureKey,
  normalizeAccessControl,
} from './accessControl';
import { normalizeSessionPayload } from './session';
import { canAccessFeature, normalizeSubscriptionPayload } from './subscription';
import { pickWorkspaceFields } from './business/workspaces';

const AuthContext = createContext(null);
const SHOULD_BOOTSTRAP_AUTH = import.meta.env.MODE !== 'test';

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => getToken());
  const [user, setUserState] = useState(() => getUser());
  const [businessId, setBusinessIdState] = useState(() => getBusinessId());
  const [business, setBusinessState] = useState(() => getBusiness());
  const [businessProfile, setBusinessProfileState] = useState(() => getBusinessProfile());
  const [role, setRoleState] = useState(() => getRole());
  const [accessControl, setAccessControlState] = useState(() => normalizeAccessControl(getAccessControl()));
  const [subscription, setSubscriptionState] = useState(() => normalizeSubscriptionPayload(getSubscription()));
  const [workspaces, setWorkspacesState] = useState([]);
  const [canCreateWorkspace, setCanCreateWorkspaceState] = useState(false);
  const [canCreateBusiness, setCanCreateBusinessState] = useState(false);
  const [canCreatePersonal, setCanCreatePersonalState] = useState(false);
  const [creatableWorkspaceTypes, setCreatableWorkspaceTypesState] = useState([]);
  const [extraBusinessTypes, setExtraBusinessTypesState] = useState(['retail', 'cafe']);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(() => {
    const storedToken = getToken();
    const storedSubscription = normalizeSubscriptionPayload(getSubscription());

    return SHOULD_BOOTSTRAP_AUTH
      && Boolean(storedToken)
      && typeof api.getCurrentUser === 'function'
      && !storedSubscription;
  });

  const applySessionSnapshot = useCallback((snapshot) => {
    const nextToken = snapshot?.token || '';
    const nextUser = snapshot?.user || null;
    const nextBusinessId = snapshot?.businessId || '';
    const nextBusiness = snapshot?.business || null;
    const nextBusinessProfile = snapshot?.businessProfile || null;
    const nextRole = snapshot?.role || nextUser?.role || '';
    const nextAccessControl = normalizeAccessControl(snapshot?.accessControl, {
      role: nextRole,
      businessId: nextBusinessId,
    });
    const nextSubscription = normalizeSubscriptionPayload(snapshot?.subscription, {
      businessId: nextBusinessId,
      business: nextBusiness,
    });

    setToken(nextToken);
    setUser(nextUser);
    setBusinessId(nextBusinessId);
    setBusiness(nextBusiness);
    setBusinessProfile(nextBusinessProfile);
    setRole(nextRole);
    setAccessControl(nextAccessControl);
    setSubscription(nextSubscription);

    setTokenState(nextToken);
    setUserState(nextUser);
    setBusinessIdState(nextBusinessId);
    setBusinessState(nextBusiness);
    setBusinessProfileState(nextBusinessProfile);
    setRoleState(nextRole);
    setAccessControlState(nextAccessControl);
    setSubscriptionState(nextSubscription);

    const nextWorkspaces = pickWorkspaceFields(snapshot);
    if (nextWorkspaces) {
      setWorkspacesState(nextWorkspaces.items);
      setCanCreateWorkspaceState(nextWorkspaces.canCreateWorkspace);
      setCanCreateBusinessState(nextWorkspaces.canCreateBusiness);
      setCanCreatePersonalState(nextWorkspaces.canCreatePersonal);
      setCreatableWorkspaceTypesState(nextWorkspaces.creatableWorkspaceTypes);
      setExtraBusinessTypesState(nextWorkspaces.extraBusinessTypes);
    }

    return {
      token: nextToken,
      user: nextUser,
      businessId: nextBusinessId,
      business: nextBusiness,
      businessProfile: nextBusinessProfile,
      role: nextRole,
      accessControl: nextAccessControl,
      subscription: nextSubscription,
      workspaces: nextWorkspaces?.items,
      canCreateWorkspace: nextWorkspaces?.canCreateWorkspace,
      canCreateBusiness: nextWorkspaces?.canCreateBusiness,
      canCreatePersonal: nextWorkspaces?.canCreatePersonal,
      creatableWorkspaceTypes: nextWorkspaces?.creatableWorkspaceTypes,
      extraBusinessTypes: nextWorkspaces?.extraBusinessTypes,
    };
  }, []);

  const syncSession = useCallback((payload, overrides = {}) => {
    const snapshot = normalizeSessionPayload(payload, {
      token: overrides.token ?? token,
      user: overrides.user ?? user,
      role: overrides.role ?? role,
      businessId: overrides.businessId ?? businessId,
      business: overrides.business ?? business,
      businessProfile: overrides.businessProfile ?? businessProfile,
      accessControl: overrides.accessControl ?? accessControl,
      subscription: overrides.subscription ?? subscription,
    });

    if ((overrides.businessId ?? businessId) !== snapshot.businessId) {
      clearApiCache();
    }

    return applySessionSnapshot({
      ...snapshot,
      ...pickWorkspaceFields(payload),
      token: overrides.token ?? token,
    });
  }, [accessControl, applySessionSnapshot, token, user, role, businessId, business, businessProfile, subscription]);

  const setSession = useCallback((nextToken, nextUser, nextBusinessId, nextRole, nextSubscription = null, nextBusiness = null, nextBusinessProfile = null, nextAccessControl = null, workspaceSource = null) => {
    clearApiCache();
    clearPendingEmailVerification();

    applySessionSnapshot({
      ...normalizeSessionPayload(
        {
          token: nextToken,
          user: nextUser,
          role: nextRole,
          businessId: nextBusinessId,
          business: nextBusiness,
          businessProfile: nextBusinessProfile,
          accessControl: nextAccessControl,
          subscription: nextSubscription,
        },
        {
          token: nextToken,
        }
      ),
      ...pickWorkspaceFields(workspaceSource),
    });
  }, [applySessionSnapshot]);

  const refreshSession = useCallback(async () => {
    if (!SHOULD_BOOTSTRAP_AUTH || !token || typeof api.getCurrentUser !== 'function') return null;

    setSessionLoading(true);

    try {
      const payload = await api.getCurrentUser();
      return syncSession(payload, { token });
    } finally {
      setSessionLoading(false);
    }
  }, [syncSession, token]);

  const updateBusinessId = useCallback((id) => {
    clearApiCache();
    setBusinessId(id);
    setBusinessIdState(id);
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    if (!token || typeof api.listWorkspaces !== 'function') return [];
    const payload = await api.listWorkspaces();
    const next = pickWorkspaceFields(payload) || pickWorkspaceFields({
      items: Array.isArray(payload) ? payload : payload?.items,
    });
    if (!next) return [];
    setWorkspacesState(next.items);
    setCanCreateWorkspaceState(next.canCreateWorkspace);
    setCanCreateBusinessState(next.canCreateBusiness);
    setCanCreatePersonalState(next.canCreatePersonal);
    setCreatableWorkspaceTypesState(next.creatableWorkspaceTypes);
    setExtraBusinessTypesState(next.extraBusinessTypes);
    return next.items;
  }, [token]);

  const switchWorkspace = useCallback(async (nextBusinessId) => {
    const targetId = String(nextBusinessId || '').trim();
    if (!targetId) return null;
    if (targetId === businessId) return { businessId };

    setWorkspaceBusy(true);
    try {
      setBusinessId(targetId);
      setBusinessIdState(targetId);
      clearApiCache();
      const payload = await api.getCurrentUser();
      return syncSession(payload, { token, businessId: targetId });
    } catch (error) {
      setBusinessId(businessId);
      setBusinessIdState(businessId);
      throw error;
    } finally {
      setWorkspaceBusy(false);
    }
  }, [businessId, syncSession, token]);

  const createWorkspace = useCallback(async ({ name, type }) => {
    setWorkspaceBusy(true);
    try {
      const payload = await api.createWorkspace({ name, type });
      if (payload?.token) {
        setToken(payload.token);
        setTokenState(payload.token);
      }
      const nextBusinessId = payload?.business?.id || payload?.businessId || '';
      if (nextBusinessId) {
        setBusinessId(nextBusinessId);
        setBusinessIdState(nextBusinessId);
      }
      clearApiCache();
      return applySessionSnapshot({
        ...normalizeSessionPayload(payload, { token: payload?.token || token }),
        ...pickWorkspaceFields(payload),
        token: payload?.token || token,
      });
    } finally {
      setWorkspaceBusy(false);
    }
  }, [applySessionSnapshot, token]);

  const updateBusiness = useCallback((updater) => {
    setBusinessState((currentBusiness) => {
      const nextBusiness = typeof updater === 'function' ? updater(currentBusiness) : updater;
      setBusiness(nextBusiness || null);
      return nextBusiness || null;
    });
  }, []);

  const updateBusinessProfile = useCallback((updater) => {
    setBusinessProfileState((currentProfile) => {
      const nextProfile = typeof updater === 'function' ? updater(currentProfile) : updater;
      setBusinessProfile(nextProfile || null);
      return nextProfile || null;
    });
  }, []);

  const updateUser = useCallback((updater) => {
    setUserState((currentUser) => {
      const nextUser = typeof updater === 'function' ? updater(currentUser) : updater;
      const resolvedUser = nextUser ? { ...(currentUser || {}), ...nextUser } : null;
      setUser(resolvedUser);
      if (resolvedUser?.role) {
        setRole(resolvedUser.role);
        setRoleState(resolvedUser.role);
      }
      return resolvedUser;
    });
  }, []);

  const logout = useCallback(() => {
    clearApiCache();
    clearSession();
    setTokenState('');
    setUserState(null);
    setBusinessIdState('');
    setBusinessState(null);
    setBusinessProfileState(null);
    setRoleState('');
    setAccessControlState(null);
    setSubscriptionState(null);
    setWorkspacesState([]);
    setCanCreateWorkspaceState(false);
    setCanCreateBusinessState(false);
    setCanCreatePersonalState(false);
    setCreatableWorkspaceTypesState([]);
    setExtraBusinessTypesState(['retail', 'cafe']);
    setWorkspaceBusy(false);
    setSessionLoading(false);
  }, []);

  const updateSubscription = useCallback((nextSubscription) => {
    const normalized = normalizeSubscriptionPayload(nextSubscription, { businessId, business });
    setSubscriptionState(normalized);
    setSubscription(normalized);
  }, [businessId, business]);

  const shouldBypassBusinessMissingGuard = role === 'owner' && subscription?.access?.guard === 'business_missing';

  const hasSubscriptionFeatureAccess = useCallback(
    (featureKey) => shouldBypassBusinessMissingGuard || canAccessFeature(subscription, featureKey),
    [shouldBypassBusinessMissingGuard, subscription]
  );

  const getFeatureAccessLevel = useCallback((featureKey) => {
    const accessLevel = getFeatureAccessLevelFromAccessControl(accessControl, featureKey, role);
    const subscriptionKey = getSubscriptionFeatureKey(featureKey);
    if (accessLevel) {
      if (!hasSubscriptionFeatureAccess(subscriptionKey)) {
        return 'none';
      }

      return accessLevel;
    }

    // Staff management must stay hidden for staff users unless the backend
    // explicitly grants access through accessControl.permissions.staff.
    if (featureKey === 'staff' && role === 'staff') {
      return 'none';
    }

    return hasSubscriptionFeatureAccess(subscriptionKey) ? 'manage' : 'none';
  }, [accessControl, hasSubscriptionFeatureAccess, role]);

  const canViewFeature = useCallback(
    (featureKey) => getFeatureAccessLevel(featureKey) !== 'none',
    [getFeatureAccessLevel]
  );

  const canManageFeature = useCallback(
    (featureKey) => getFeatureAccessLevel(featureKey) === 'manage',
    [getFeatureAccessLevel]
  );

  const hasFeatureAccess = canViewFeature;

  useEffect(() => {
    if (!SHOULD_BOOTSTRAP_AUTH || !token || typeof api.getCurrentUser !== 'function') {
      setSessionLoading(false);
      return undefined;
    }

    let active = true;
    setSessionLoading(true);

    api.getCurrentUser()
      .then((payload) => {
        if (!active) return;
        syncSession(payload, { token });
      })
      .catch(() => {
        if (!active) return;
      })
      .finally(() => {
        if (!active) return;
        setSessionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!SHOULD_BOOTSTRAP_AUTH || !token || !businessId || typeof api.getSubscription !== 'function') {
      return undefined;
    }

    let active = true;

    api.getSubscription()
      .then((payload) => {
        if (!active) return;
        updateSubscription(payload);
      })
      .catch((err) => {
        console.warn('Failed to fetch active subscription on session load/update', err);
      });

    return () => {
      active = false;
    };
  }, [token, businessId, updateSubscription]);

  const subscriptionAccess = useMemo(
    () => subscription?.access || null,
    [subscription]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      businessId,
      business,
      businessProfile,
      role,
      accessControl,
      subscription,
      subscriptionAccess,
      workspaces,
      canCreateWorkspace,
      canCreateBusiness,
      canCreatePersonal,
      creatableWorkspaceTypes,
      extraBusinessTypes,
      workspaceBusy,
      sessionLoading,
      setSession,
      syncSession,
      refreshSession,
      refreshWorkspaces,
      switchWorkspace,
      createWorkspace,
      updateBusinessId,
      updateBusiness,
      updateBusinessProfile,
      updateSubscription,
      updateUser,
      getFeatureAccessLevel,
      canViewFeature,
      canManageFeature,
      hasSubscriptionFeatureAccess,
      hasFeatureAccess,
      logout,
    }),
    [
      token,
      user,
      businessId,
      business,
      businessProfile,
      role,
      accessControl,
      subscription,
      subscriptionAccess,
      workspaces,
      canCreateWorkspace,
      canCreateBusiness,
      canCreatePersonal,
      creatableWorkspaceTypes,
      extraBusinessTypes,
      workspaceBusy,
      sessionLoading,
      setSession,
      syncSession,
      refreshSession,
      refreshWorkspaces,
      switchWorkspace,
      createWorkspace,
      updateBusinessId,
      updateBusiness,
      updateBusinessProfile,
      updateSubscription,
      updateUser,
      getFeatureAccessLevel,
      canViewFeature,
      canManageFeature,
      hasSubscriptionFeatureAccess,
      hasFeatureAccess,
      logout,
    ]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
