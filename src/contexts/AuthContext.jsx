import React, { createContext, useContext, useState, useEffect } from 'react';
import parseService from '../services/parseService';

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session from Parse
    const currentUser = parseService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (username, password) => {
    const result = await parseService.login(username, password);
    if (result.success) {
      setUser(result.user);
      return true;
    }
    return { error: result.error || 'Invalid credentials. Please try again.' };
  };

  const loginAsEmployee = async (email, password) => {
    const result = await parseService.loginWithEmail(email, password);
    if (result.success) {
      setUser(result.user);
      return true;
    }
    throw new Error(result.error || 'Login failed');
  };

  const register = async (userData) => {
    return await parseService.register(userData);
  };

  const resendVerificationEmail = async (email) => {
    return await parseService.resendVerificationEmail(email);
  };
  
  const sendVerificationCode = async (email) => {
    return await parseService.sendVerificationCode(email);
  };
  
  const verifyEmailWithCode = async (email, code) => {
    return await parseService.verifyEmailWithCode(email, code);
  };

  const logout = async () => {
    await parseService.logout();
    setUser(null);
  };

  const resetPassword = async (email) => {
    return await parseService.requestPasswordReset(email);
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
    }}>
      {children}
    </AuthContext.Provider>
  );
};