import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { tokenStorage, setSessionExpiredHandler } from '../services/apiClient.js';
import * as authService from '../services/authService.js';

const AuthContext = createContext(null);

// 'loading' | 'authenticated' | 'unauthenticated'
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  // FET-04 — set to 'expired' when the session ends because the
  // refresh token itself turned out to be invalid/expired/revoked
  // (as opposed to the user clicking "Sign out"), so a component
  // higher in the tree can show a one-time "your session expired"
  // toast instead of silently dropping the user back on /login.
  const [sessionEvent, setSessionEvent] = useState(null);

  const clearSession = useCallback((reason = null) => {
    tokenStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
    if (reason) setSessionEvent(reason);
  }, []);

  const acknowledgeSessionEvent = useCallback(() => {
    setSessionEvent(null);
  }, []);

  // On first load, if we have a persisted token, validate it against
  // GET /auth/me rather than trusting it blindly.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const hasToken = Boolean(tokenStorage.getAccessToken());
      if (!hasToken) {
        if (!cancelled) setStatus('unauthenticated');
        return;
      }
      try {
        const currentUser = await authService.fetchCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) clearSession();
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Wire the axios interceptor's "refresh token is dead" callback to
  // our own logout, so an expired session is reflected in the UI
  // immediately instead of silently failing subsequent requests.
  useEffect(() => {
    setSessionExpiredHandler(() => clearSession('expired'));
  }, [clearSession]);

  const login = useCallback(async ({ identifier, password }) => {
    const loggedInUser = await authService.login({ identifier, password });
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // FET-04 — "log out from all devices". Distinct from `logout()`:
  // this revokes every session for the account (server/src/auth/
  // auth.service.js's `logoutAll`), current device included, so the
  // local state must be cleared here too rather than left for the
  // next 401 to discover.
  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshCurrentUser = useCallback(async () => {
    const currentUser = await authService.fetchCurrentUser();
    setUser(currentUser);
    return currentUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
      logoutAll,
      refreshCurrentUser,
      sessionEvent,
      acknowledgeSessionEvent,
    }),
    [user, status, login, logout, logoutAll, refreshCurrentUser, sessionEvent, acknowledgeSessionEvent],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
