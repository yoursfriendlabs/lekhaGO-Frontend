import React, { createContext, useContext, useMemo, useState } from 'react';
import { clearSession, getBusinessId, getToken, getUser, setBusinessId, setToken, setUser } from './storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken());
  const [user, setUserState] = useState(getUser());
  const [businessId, setBusinessIdState] = useState(getBusinessId());

  const setSession = (nextToken, nextUser, nextBusinessId) => {
    setToken(nextToken);
    setUser(nextUser);
    setBusinessId(nextBusinessId || '');
    setTokenState(nextToken || '');
    setUserState(nextUser || null);
    setBusinessIdState(nextBusinessId || '');
  };

  const updateBusinessId = (id) => {
    setBusinessId(id);
    setBusinessIdState(id);
  };

  const logout = () => {
    clearSession();
    setTokenState('');
    setUserState(null);
    setBusinessIdState('');
  };

  const value = useMemo(
    () => ({
      token,
      user,
      businessId,
      setSession,
      updateBusinessId,
      logout,
    }),
    [token, user, businessId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
