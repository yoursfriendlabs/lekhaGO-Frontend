import { createContext, useContext, useMemo, useState } from 'react';
import { clearPendingEmailVerification, clearSession, getBusinessId, getRole, getToken, getUser, setBusinessId, setRole, setToken, setUser } from './storage';
import { clearApiCache } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [user, setUserState] = useState(getUser());
  const [businessId, setBusinessIdState] = useState(getBusinessId());
  const [role, setRoleState] = useState(getRole());

  const setSession = (nextToken, nextUser, nextBusinessId, nextRole) => {
    clearApiCache();
    clearPendingEmailVerification();
    const resolvedRole = nextRole || nextUser?.role || '';
    const resolvedUser = nextUser ? { ...nextUser, role: resolvedRole || nextUser.role } : null;
    setToken(nextToken);
    setUser(resolvedUser);
    setBusinessId(nextBusinessId || '');
    setRole(resolvedRole);
    setTokenState(nextToken || '');
    setUserState(resolvedUser || null);
    setBusinessIdState(nextBusinessId || '');
    setRoleState(resolvedRole);
  };

  const updateBusinessId = (id) => {
    clearApiCache();
    setBusinessId(id);
    setBusinessIdState(id);
  };

  const updateUser = (updater) => {
    setUserState((currentUser) => {
      const nextUser = typeof updater === 'function' ? updater(currentUser) : updater;
      const resolvedUser = nextUser ? { ...currentUser, ...nextUser } : null;
      setUser(resolvedUser);
      if (resolvedUser?.role) {
        setRole(resolvedUser.role);
        setRoleState(resolvedUser.role);
      }
      return resolvedUser;
    });
  };

  const logout = () => {
    clearApiCache();
    clearSession();
    setTokenState('');
    setUserState(null);
    setBusinessIdState('');
    setRoleState('');
  };

  const value = useMemo(
    () => ({
      token,
      user,
      businessId,
      role,
      setSession,
      updateBusinessId,
      updateUser,
      logout,
    }),
    [token, user, businessId, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
