import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import authService from '../services/authService';

const AuthContext = createContext(undefined);

// How often to check whether the token needs refreshing or the account was deactivated.
// Long enough not to spam the API, short enough to catch role revocations quickly.
const SESSION_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
// Refresh the token when it has fewer than this many days left.
const REFRESH_THRESHOLD_DAYS = 7;

function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Initialize user synchronously from localStorage to avoid flash
const getInitialUser = () => {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getInitialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);
  const sessionCheckIntervalRef = useRef(null);
  // Count consecutive check failures so a single network blip doesn't log out the user.
  const failureCountRef = useRef(0);

  useLayoutEffect(() => {
    const currentUser = authService.getSavedUser();
    if (currentUser) setUser(currentUser);
  }, []);

  // Silently refresh the token when it's close to expiry.
  const refreshTokenIfNeeded = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const exp = getTokenExpiry(token);
    if (!exp) return;
    const thresholdMs = REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    if (exp - Date.now() > thresholdMs) return; // still plenty of time left

    try {
      const res = await axios.post('/api/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.success && res.data.token) {
        localStorage.setItem('auth_token', res.data.token);
      }
    } catch {
      // Refresh failing is not fatal — the token is still valid for REFRESH_THRESHOLD_DAYS more days.
    }
  }, []);

  // Validate the session against the backend. Only force-logout on explicit
  // account deactivation or privilege revocation — never on network errors.
  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    // Attempt token refresh in the same pass if needed.
    await refreshTokenIfNeeded();

    try {
      const res = await axios.get('/api/me/validate-session', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      // Reset failure counter on any successful response.
      failureCountRef.current = 0;

      if (res.data.roleChanged) {
        setSessionMessage(res.data.message || 'Your role has been updated. Please log in again.');
        authService.clearSession();
        setUser(null);
      }
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;

      // Only log out on explicit account-level rejections (401), not on
      // server errors (5xx), timeouts, or network failures.
      if (status === 401) {
        failureCountRef.current += 1;

        if (data?.reason === 'demoted') {
          // Explicit privilege revocation — log out immediately.
          setSessionMessage(data.message || 'Your admin privileges have been revoked. Please log in again.');
          authService.clearSession();
          setUser(null);
          return;
        }

        // For other 401s (e.g. token truly expired), require 3 consecutive
        // failures before logging out, guarding against transient API issues.
        if (failureCountRef.current >= 3) {
          setSessionMessage('Your session has expired. Please log in again.');
          authService.clearSession();
          setUser(null);
        }
      }
      // 5xx, network errors, timeouts → ignore silently.
    }
  }, [refreshTokenIfNeeded]);

  // Run token refresh on app load, then periodically every 15 minutes.
  // Applies to ALL authenticated users, not just admins.
  useEffect(() => {
    if (!user) {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      return;
    }

    // Run immediately so a tab reopen refreshes the token right away.
    validateSession();

    sessionCheckIntervalRef.current = setInterval(validateSession, SESSION_CHECK_INTERVAL_MS);
    return () => {
      if (sessionCheckIntervalRef.current) clearInterval(sessionCheckIntervalRef.current);
    };
  }, [user, validateSession]);

  // Also refresh token when the tab regains visibility (user returns after a long absence).
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTokenIfNeeded();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refreshTokenIfNeeded]);

  const login = async (username, password) => {
    try {
      const result = await authService.loginAdmin(username, password);
      if (result.success) {
        authService.saveSession(result.token, result.user);
        failureCountRef.current = 0;
        setUser(result.user);
        return true;
      }
      return { error: result.error || 'Invalid credentials. Please try again.' };
    } catch (e) {
      return { error: e.response?.data?.error || e.message || 'Login failed' };
    }
  };

  const loginAsEmployee = async (email, password) => {
    try {
      const result = await authService.loginEmployee(email, password);
      if (result.success) {
        authService.saveSession(result.token, result.user);
        failureCountRef.current = 0;
        setUser(result.user);
        return true;
      }
      throw new Error(result.error || 'Login failed');
    } catch (e) {
      throw new Error(e.response?.data?.error || e.message || 'Login failed');
    }
  };

  const register = async (userData) => {
    try {
      const res = await authService.register(userData);
      return res;
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  };

  const resendVerificationEmail = async (email) => {
    try {
      return await authService.sendVerificationCode(email);
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  };

  const sendVerificationCode = async (email) => {
    try {
      return await authService.sendVerificationCode(email);
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  };

  const verifyEmailWithCode = async (email, code) => {
    try {
      return await authService.verifyEmailWithCode(email, code);
    } catch (e) {
      return { success: false, error: e.response?.data?.error || e.message };
    }
  };

  const logout = async () => {
    authService.clearSession();
    setUser(null);
  };

  const resetPassword = async (email) => {
    return { success: false, error: 'Not implemented' };
  };

  const hasPermission = (requiredRole) => {
    if (!user) return false;
    if (!requiredRole) return true;
    if (user.role === 'admin') return true;
    return user.role === requiredRole;
  };

  const clearSessionMessage = useCallback(() => {
    setSessionMessage(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginAsEmployee,
      register,
      resendVerificationEmail,
      sendVerificationCode,
      verifyEmailWithCode,
      resetPassword,
      logout,
      hasPermission,
      sessionMessage,
      clearSessionMessage,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
