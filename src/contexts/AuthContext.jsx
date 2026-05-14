import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import authService from '../services/authService';

const AuthContext = createContext(undefined);

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
  // Initialize with user from localStorage immediately (no loading state needed)
  const [user, setUser] = useState(getInitialUser);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);
  const sessionCheckIntervalRef = useRef(null);

  // Verify session is still valid (optional background check)
  useLayoutEffect(() => {
    const currentUser = authService.getSavedUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  // Function to validate session with backend
  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const res = await axios.get('/api/me/validate-session', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.roleChanged) {
        // Role changed, force logout with message
        setSessionMessage(res.data.message || 'Your role has been updated. Please log in again.');
        authService.clearSession();
        setUser(null);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        const data = error.response.data;
        if (data.reason === 'demoted') {
          // User was demoted, force logout with message
          setSessionMessage(data.message || 'Your admin privileges have been revoked. Please log in again.');
        } else {
          setSessionMessage('Your session has expired. Please log in again.');
        }
        authService.clearSession();
        setUser(null);
      }
    }
  }, []);

  // Set up periodic session validation (every 5 seconds for quick detection)
  useEffect(() => {
    if (user && user.role === 'admin') {
      // Validate immediately on mount
      validateSession();
      
      // Set up interval for periodic validation
      sessionCheckIntervalRef.current = setInterval(validateSession, 5000);
      
      return () => {
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }
      };
    }
  }, [user, validateSession]);

  const login = async (username, password) => {
    try {
      const result = await authService.loginAdmin(username, password);
    if (result.success) {
        authService.saveSession(result.token, result.user);
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
      // same as send code
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
    // Not implemented yet on new API
    return { success: false, error: 'Not implemented' };
  };

  // Check if user has permission for a specific action or resource
  const hasPermission = (requiredRole) => {
    if (!user) return false;
    
    // If no specific role is required, any authenticated user has access
    if (!requiredRole) return true;
    
    // Admin has access to everything
    if (user.role === 'admin') return true;
    
    // Otherwise, check if user's role matches the required role
    return user.role === requiredRole;
  };

  // Function to clear session message
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