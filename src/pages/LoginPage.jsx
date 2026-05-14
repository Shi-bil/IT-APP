import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, User, Eye, EyeOff, Shield, Users, Mail, ArrowLeft, CheckCircle, Building, Send, Clock, Laptop, KeyRound, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const RegistrationSystem = () => {
  const navigate = useNavigate();
  const { login, loginAsEmployee, register, resendVerificationEmail, sendVerificationCode, verifyEmailWithCode, sessionMessage, clearSessionMessage } = useAuth();
  const [currentPage, setCurrentPage] = useState('login');
  
  // Login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState('employee');

  // Registration state
  const [regForm, setRegForm] = useState({
    fullname: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    phone: '',
  });

  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  // Verification state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyCodeLoading, setVerifyCodeLoading] = useState(false);
  const [verifyCodeError, setVerifyCodeError] = useState('');
  const [verifyCodeSuccess, setVerifyCodeSuccess] = useState('');
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [timerActive, setTimerActive] = useState(false);

  // Forgot Password state
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState('');
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState('');
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  
  // Reset Password Code Verification state
  const [resetCode, setResetCode] = useState('');
  const [resetCodeLoading, setResetCodeLoading] = useState(false);
  const [resetCodeError, setResetCodeError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetTimeRemaining, setResetTimeRemaining] = useState(900); // 15 minutes
  const [resetTimerActive, setResetTimerActive] = useState(false);
  
  // New Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  // Timer effect for code expiration
  useEffect(() => {
    let timer;
    if (timerActive && timeRemaining > 0) {
      timer = setTimeout(() => {
        setTimeRemaining(prevTime => prevTime - 1);
      }, 1000);
    } else if (timerActive && timeRemaining === 0) {
      setShowCodeForm(false);
      setVerifyCodeError('');
      setVerifyCodeSuccess('');
      setResendMessage('Verification code has expired. Please request a new code.');
      setTimerActive(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [timerActive, timeRemaining]);

  // Timer effect for password reset code expiration
  useEffect(() => {
    let timer;
    if (resetTimerActive && resetTimeRemaining > 0) {
      timer = setTimeout(() => {
        setResetTimeRemaining(prevTime => prevTime - 1);
      }, 1000);
    } else if (resetTimerActive && resetTimeRemaining === 0) {
      setResetCodeError('Reset code has expired. Please request a new one.');
      setResetTimerActive(false);
      setCurrentPage('forgotPassword');
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resetTimerActive, resetTimeRemaining]);

  const departments = [
    { value: 'Business_Development', label: 'Business Development' },
    { value: 'Accounting', label: 'Accounting' },
    { value: 'Others', label: 'Others' }
  ];

  // State input handlers
  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e) => {
    setPassword(e.target.value);
  }, []);

  const handleEmployeeEmailChange = useCallback((e) => {
    setEmployeeEmail(e.target.value);
  }, []);

  const handleEmployeePasswordChange = useCallback((e) => {
    setEmployeePassword(e.target.value);
  }, []);

  const handleRegFormChange = useCallback((field, value) => {
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setRegForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Login handlers
  const handleAdminLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await login(username, password);
      if (result === true) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await loginAsEmployee(employeeEmail, employeePassword);
      if (result) {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchLoginType = (type) => {
    setLoginType(type);
    setError('');
  };

  // Registration handlers
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError('');
    if (regForm.password !== regForm.confirmPassword) {
      setRegError('Passwords do not match');
      return;
    }
    if (regForm.password.length < 6) {
      setRegError('Password must be at least 6 characters');
      return;
    }
    setRegLoading(true);
    try {
      const result = await register(regForm);
      if (result.success) {
        setVerificationEmail(regForm.email);
        // Send code via Vite dev API route
        await axios.post('/api/send-code', { email: regForm.email });
        setShowCodeForm(true);
        setTimeRemaining(120); // 120 seconds expiry
        setTimerActive(true);
        setCurrentPage('verification');
      } else {
        setRegError(result.error);
      }
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');
    setVerifyCodeError('');
    setVerifyCodeSuccess('');
    setVerificationCode('');
    try {
      const email = verificationEmail || regForm.email;
      await axios.post('/api/send-code', { email });
      setResendMessage('Verification code sent successfully. Please check your inbox.');
      setShowCodeForm(true);
      setTimeRemaining(120);
      setTimerActive(true);
    } catch (err) {
      setResendMessage(`Error: ${err.message}`);
    } finally {
      setResendLoading(false);
    }
  };
  
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setVerifyCodeLoading(true);
    setVerifyCodeError('');
    setVerifyCodeSuccess('');
    try {
      const email = verificationEmail || regForm.email;
      // Verify code via Vite dev API route
      const response = await axios.post('/api/verify-code', { email, code: verificationCode });
      if (response.data.success) {
        setVerifyCodeSuccess('Email verified successfully!');
        setVerificationCode('');
        setTimerActive(false);
        setTimeout(() => {
          setCurrentPage('success');
        }, 1500);
      } else {
        setVerifyCodeError(response.data.error || 'Failed to verify email');
      }
    } catch (err) {
      setVerifyCodeError(err.response?.data?.error || err.message);
    } finally {
      setVerifyCodeLoading(false);
    }
  };

  // Forgot Password handlers
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordError('');
    setForgotPasswordSuccess('');
    try {
      const response = await axios.post('/api/auth/forgot-password', { 
        identifier: forgotPasswordIdentifier 
      });
      if (response.data.success) {
        setForgotPasswordSuccess(response.data.message);
        setForgotPasswordEmail(response.data.email || '');
        setResetTimeRemaining(900); // 15 minutes
        setResetTimerActive(true);
        setCurrentPage('resetCode');
      } else {
        setForgotPasswordError(response.data.error || 'Failed to send reset code');
      }
    } catch (err) {
      setForgotPasswordError(err.response?.data?.error || err.message || 'Failed to send reset code');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleVerifyResetCode = async (e) => {
    e.preventDefault();
    setResetCodeLoading(true);
    setResetCodeError('');
    try {
      const response = await axios.post('/api/auth/verify-reset-token', {
        identifier: forgotPasswordIdentifier,
        code: resetCode
      });
      if (response.data.success) {
        setResetToken(response.data.resetToken);
        setCurrentPage('newPassword');
      } else {
        setResetCodeError(response.data.error || 'Invalid verification code');
      }
    } catch (err) {
      setResetCodeError(err.response?.data?.error || err.message || 'Failed to verify code');
    } finally {
      setResetCodeLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetPasswordError('');
    
    // Validation
    if (newPassword !== confirmNewPassword) {
      setResetPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setResetPasswordError('Password must be at least 8 characters long');
      return;
    }
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setResetPasswordError('Password must contain at least one uppercase letter, one lowercase letter, and one number');
      return;
    }

    setResetPasswordLoading(true);
    try {
      const response = await axios.post('/api/auth/reset-password', {
        resetToken,
        newPassword,
        confirmPassword: confirmNewPassword
      });
      if (response.data.success) {
        // Reset all forgot password state
        setForgotPasswordIdentifier('');
        setResetCode('');
        setResetToken('');
        setNewPassword('');
        setConfirmNewPassword('');
        setResetTimerActive(false);
        setCurrentPage('resetSuccess');
      } else {
        setResetPasswordError(response.data.error || 'Failed to reset password');
      }
    } catch (err) {
      setResetPasswordError(err.response?.data?.error || err.message || 'Failed to reset password');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    setForgotPasswordLoading(true);
    setForgotPasswordError('');
    try {
      const response = await axios.post('/api/auth/forgot-password', { 
        identifier: forgotPasswordIdentifier 
      });
      if (response.data.success) {
        setResetCodeError('');
        setResetTimeRemaining(900);
        setResetTimerActive(true);
        setForgotPasswordSuccess('A new reset code has been sent to your email.');
      }
    } catch (err) {
      setForgotPasswordError(err.response?.data?.error || 'Failed to resend code');
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Format time for display (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Main render
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Space Background Elements - Fixed position */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Nebula clouds */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-radial from-cyan-500/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-radial from-blue-500/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-gradient-radial from-cyan-400/10 via-transparent to-transparent rounded-full blur-2xl animate-pulse delay-500"></div>
        </div>

        {/* Floating space particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400/60 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>

        {/* Cosmic rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-96 h-96 border border-cyan-500/20 rounded-full animate-spin-slow"></div>
          <div className="absolute w-80 h-80 border border-blue-500/15 rounded-full animate-spin-slow-reverse"></div>
          <div className="absolute w-64 h-64 border border-cyan-400/10 rounded-full animate-spin-slow"></div>
        </div>

        {/* Shooting stars */}
        <div className="absolute inset-0">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-cyan-300 rounded-full animate-shooting-star"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden z-10">
        <div className="min-h-full flex items-center justify-center p-2 sm:p-4">

      {/* Login Page */}
      {currentPage === 'login' && (
        <div className="w-full h-full flex flex-col lg:flex-row items-center justify-center lg:justify-between max-w-7xl mx-auto gap-4">
          {/* Left side - Space content (hidden on mobile, visible on lg+) */}
          <div className="hidden lg:flex flex-1 flex-col justify-center px-4 sm:px-8 lg:px-16">
            <div className="space-y-8">
              {/* Cosmic logo and title */}
              <div className="space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-2xl animate-pulse relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/30 to-blue-500/30 blur-xl"></div>
                  <span className="relative w-12 h-12 flex items-center justify-center">
                    <Laptop className="w-12 h-12 text-black/80 absolute left-0 top-0 z-10" />
                    <User className="w-7 h-7 text-cyan-300 absolute left-2.5 top-4 z-20" />
                  </span>
                </div>
                <h1 className="text-7xl font-bold text-white mb-4">
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent animate-pulse">
                    ZAINLEE
                  </span>
                </h1>
              </div>

              {/* Animated subtitle */}
              <div className="space-y-4">
                <h2 className="text-3xl font-semibold text-cyan-300">
                  <span className="inline-block overflow-hidden">
                    <span className="animate-[typing_3s_steps(40,end)_forwards] whitespace-nowrap">
                      IT Management System
                    </span>
                  </span>
                </h2>
                <p className="text-xl text-slate-300 max-w-md leading-relaxed">
                  Navigate the digital cosmos with our advanced IT management platform. 
                  Secure, efficient, and designed for the future.
                </p>
              </div>

              {/* Feature highlights with space theme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-8 md:mt-12">
                <div className="flex items-center space-x-3 text-cyan-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span>Ticket System</span>
                </div>
                <div className="flex items-center space-x-3 text-blue-300">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-300"></div>
                  <span> Asset Management</span>
                </div>
                <div className="flex items-center space-x-3 text-cyan-300">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-600"></div>
                  <span>Real-time Analytics </span>
                </div>
                <div className="flex items-center space-x-3 text-blue-300">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-900"></div>
                  <span>User Management</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Glass login card */}
          <div className="flex-1 flex justify-center lg:justify-end">
            <div className="w-full max-w-sm">
              {/* Mobile-only compact branding */}
              <div className="lg:hidden text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-xl animate-pulse relative mb-3">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/30 to-blue-500/30 blur-lg"></div>
                  <span className="relative w-8 h-8 flex items-center justify-center">
                    <Laptop className="w-8 h-8 text-black/80 absolute left-0 top-0 z-10" />
                    <User className="w-5 h-5 text-cyan-300 absolute left-1.5 top-2.5 z-20" />
                  </span>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent">
                  ZAINLEE
                </h1>
                <p className="text-sm text-cyan-300/80 mt-1">IT Management System</p>
              </div>

              {/* Cosmic glass morphism login card */}
              <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                {/* Optional: faint gradient overlay for depth */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="text-center mb-6 lg:mb-8">
                    <h2 className="text-xl lg:text-2xl font-bold text-white mb-1 lg:mb-2">Welcome Back</h2>
                    <p className="text-cyan-300 text-sm lg:text-base">Sign in to your account</p>
                  </div>

                  <div className="flex bg-slate-800/40 backdrop-blur-sm rounded-xl p-1 mb-6 border border-cyan-500/20">
                    <button
                      onClick={() => switchLoginType('employee')}
                      className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                        loginType === 'employee'
                          ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-lg backdrop-blur-sm border border-cyan-400/30'
                          : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Employee</span>
                    </button>
                    <button
                      onClick={() => switchLoginType('admin')}
                      className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
                        loginType === 'admin'
                          ? 'bg-gradient-to-r from-cyan-500/80 to-blue-600/80 text-white shadow-lg backdrop-blur-sm border border-cyan-400/30'
                          : 'text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      <span>Admin</span>
                    </button>
                  </div>

                  {/* Session invalidation message (shown when admin is demoted) */}
                  {sessionMessage && (
                    <div className="bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 text-orange-300 px-4 py-3 rounded-xl text-sm mb-6 relative">
                      <button
                        onClick={clearSessionMessage}
                        className="absolute top-2 right-2 text-orange-300 hover:text-orange-100 transition-colors"
                      >
                        ×
                      </button>
                      <p className="font-medium flex items-center">
                        <Shield className="w-4 h-4 mr-2" />
                        Session Ended
                      </p>
                      <p className="text-xs mt-1">{sessionMessage}</p>
                    </div>
                  )}

                  {loginType === 'employee' && (
                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleEmployeeLogin(); }}>
                      <div>
                        <label className="block text-sm font-medium text-cyan-300 mb-2">Employee Email</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                          <input
                            type="email"
                            value={employeeEmail}
                            onChange={handleEmployeeEmailChange}
                            className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                            placeholder="Enter your employee email"
                            autoComplete="email"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-cyan-300 mb-2">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                          <input
                            type={showEmployeePassword ? 'text' : 'password'}
                            value={employeePassword}
                            onChange={handleEmployeePasswordChange}
                            className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            {showEmployeePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-xl text-sm">
                        <p className="font-medium flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          Limited Access
                        </p>
                        {/* <p className="text-xs mt-1">Employee will have Only Ticket Management features</p> */}
                      </div>

                      {error && (
                        <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                          <p>{error}</p>
                          {error.includes('Email not verified') && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerificationEmail(employeeEmail);
                                setCurrentPage('verification');
                              }}
                              className="mt-2 text-cyan-400 hover:text-cyan-300 underline text-sm font-medium"
                            >
                              Click here to verify your email
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || !employeeEmail || !employeePassword}
                        className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Signing in...</span>
                          </div>
                        ) : (
                          <>
                            <Users className="inline w-5 h-5 mr-2" />
                            Continue as Employee
                          </>
                        )}
                      </button>

                      <div className="text-center space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotPasswordIdentifier(employeeEmail);
                            setCurrentPage('forgotPassword');
                          }}
                          className="text-slate-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline"
                        >
                          Forgot Password?
                        </button>
                        <div>
                          <button
                            type="button"
                            onClick={() => setCurrentPage('register')}
                            className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline"
                          >
                            First time? Register here
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {loginType === 'admin' && (
                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleAdminLogin(); }}>
                      <div>
                        <label className="block text-sm font-medium text-cyan-300 mb-2">Username</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                          <input
                            type="text"
                            value={username}
                            onChange={handleUsernameChange}
                            className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                            placeholder="Enter your username"
                            autoComplete="username"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-cyan-300 mb-2">Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={handlePasswordChange}
                            className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {error && (
                        <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                          <p>{error}</p>
                          {error.includes('Email not verified') && (
                            <button
                              type="button"
                              onClick={() => {
                                setVerificationEmail(username);
                                setCurrentPage('verification');
                              }}
                              className="mt-2 text-cyan-400 hover:text-cyan-300 underline text-sm font-medium"
                            >
                              Click here to verify your email
                            </button>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || !username || !password}
                        className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Signing in...</span>
                          </div>
                        ) : (
                          <>
                            <Shield className="inline w-5 h-5 mr-2" />
                            Sign In as Admin
                          </>
                        )}
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotPasswordIdentifier(username);
                            setCurrentPage('forgotPassword');
                          }}
                          className="text-slate-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-xs text-slate-500">
                  © 2025 IT PORTAL FOR ZAINLEE. Secure IT Management System.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration Page */}
      {currentPage === 'register' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 mb-4">
              <Users className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">JOIN IT ZYZTEM</h1>
            <p className="text-cyan-300">Create your account</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setCurrentPage('login')}
                  className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </button>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={regForm.fullname}
                    onChange={(e) => handleRegFormChange('fullname', e.target.value)}
                    className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                    placeholder="John"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type="email"
                      value={regForm.email}
                      onChange={(e) => handleRegFormChange('email', e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="john.doe@company.com"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Department</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <select
                      value={regForm.department}
                      onChange={(e) => handleRegFormChange('department', e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept.value} value={dept.value} className="bg-slate-800">
                          {dept.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Phone Number <span className="text-xs text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={regForm.phone}
                    onChange={(e) => handleRegFormChange('phone', e.target.value)}
                    className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                    placeholder="05xxxxxxxx"
                    maxLength={10}
                    pattern="05[0-9]{8}"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regForm.password}
                      onChange={(e) => handleRegFormChange('password', e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={regForm.confirmPassword}
                      onChange={(e) => handleRegFormChange('confirmPassword', e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-12 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {regError && (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                    {regError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={regLoading || !regForm.fullname || !regForm.email || !regForm.password || !regForm.confirmPassword || !regForm.department}
                  className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
                >
                  {regLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    <>
                      <Users className="inline w-5 h-5 mr-2" />
                      Create Account
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Email Verification Page */}
      {currentPage === 'verification' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Verify Your Email</h1>
            <p className="text-cyan-300">We've sent you a verification code</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="text-center mb-6">
                <p className="text-slate-300 mb-2">
                  We've sent a verification code to:
                </p>
                <p className="text-cyan-400 font-semibold">{verificationEmail || regForm.email}</p>
              </div>

              {showCodeForm ? (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  {timerActive && (
                    <div className="flex items-center justify-center mb-4">
                      <div className={`flex items-center justify-center px-4 py-2 rounded-xl ${
                        timeRemaining <= 10 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        <Clock className="w-4 h-4 mr-2" />
                        <span className="font-mono font-medium">
                          Time remaining: {timeRemaining}s
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-cyan-300 mb-2">Verification Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 text-center tracking-widest text-lg"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      required
                    />
                  </div>
                  
                  {verifyCodeError && (
                    <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                      {verifyCodeError}
                    </div>
                  )}
                  
                  {verifyCodeSuccess && (
                    <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm">
                      {verifyCodeSuccess}
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={verifyCodeLoading || !verificationCode || verificationCode.length !== 6 || !timerActive}
                    className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
                  >
                    {verifyCodeLoading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Verifying...</span>
                      </div>
                    ) : (
                      <>
                        <CheckCircle className="inline w-5 h-5 mr-2" />
                        Verify Email
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="bg-yellow-500/20 backdrop-blur-sm border border-yellow-500/30 text-yellow-300 px-4 py-3 rounded-xl text-sm">
                  <p className="font-medium flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Code Expired or Not Requested
                  </p>
                  <p className="text-xs mt-1">
                    The verification code is valid for only 120 seconds. Please request a new code below.
                  </p>
                </div>
              )}

              {resendMessage && (
                <div className={`mt-4 ${
                  resendMessage.includes('Error') 
                    ? 'bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300' 
                    : 'bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300'
                } px-4 py-3 rounded-xl text-sm`}>
                  {resendMessage}
                </div>
              )}

              <div className="text-center mt-6">
                <button
                  onClick={() => setCurrentPage('login')}
                  className="flex items-center justify-center mx-auto text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline mb-4"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Return to Login
                </button>
                
                <p className="text-slate-400 text-sm mb-2">
                  {!showCodeForm ? "Request a verification code:" : "Didn't receive the code?"}
                </p>
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline disabled:opacity-50"
                >
                  {resendLoading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent mr-2"></div>
                      Sending...
                    </span>
                  ) : (
                    <>
                      <Send className="inline w-4 h-4 mr-1" />
                      {!showCodeForm ? "Send Verification Code" : "Resend Verification Code"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Page */}
      {currentPage === 'success' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome!</h1>
            <p className="text-cyan-300">Your account has been created successfully</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden text-center">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-4 py-3 rounded-xl mb-6">
                <p className="font-medium">Account Verified Successfully!</p>
                <p className="text-sm mt-1">You can now access the system with your credentials</p>
              </div>

              <div className="space-y-4">
                <div className="text-left">
                  <p className="text-slate-300 text-sm mb-1">Name:</p>
                  <p className="text-white font-medium">{regForm.fullname}</p>
                </div>
                <div className="text-left">
                  <p className="text-slate-300 text-sm mb-1">Email:</p>
                  <p className="text-cyan-400 font-medium">{regForm.email}</p>
                </div>
                <div className="text-left">
                  <p className="text-slate-300 text-sm mb-1">Department:</p>
                  <p className="text-white font-medium">
                    {departments.find(d => d.value === regForm.department)?.label || regForm.department}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCurrentPage('login')}
                className="w-full mt-6 bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
              >
                <Users className="inline w-5 h-5 mr-2" />
                Continue to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Page - Step 1: Enter Email/Username */}
      {currentPage === 'forgotPassword' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 mb-4">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Forgot Password?</h1>
            <p className="text-cyan-300">Enter your email or username to reset</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-400/10 via-transparent to-red-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => {
                    setForgotPasswordError('');
                    setForgotPasswordSuccess('');
                    setCurrentPage('login');
                  }}
                  className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Email or Username</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type="text"
                      value={forgotPasswordIdentifier}
                      onChange={(e) => setForgotPasswordIdentifier(e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Enter your email or username"
                      required
                    />
                  </div>
                </div>

                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 text-blue-300 px-4 py-3 rounded-xl text-sm">
                  <p className="font-medium flex items-center">
                    <Mail className="w-4 h-4 mr-2" />
                    Password Reset Instructions
                  </p>
                  <p className="text-xs mt-1">We'll send a 6-digit verification code to your registered email address.</p>
                </div>

                {forgotPasswordError && (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                    {forgotPasswordError}
                  </div>
                )}

                {forgotPasswordSuccess && (
                  <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm">
                    {forgotPasswordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={forgotPasswordLoading || !forgotPasswordIdentifier}
                  className="w-full bg-gradient-to-r from-orange-500/80 to-red-600/80 hover:from-orange-600/90 hover:to-red-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-orange-400/30"
                >
                  {forgotPasswordLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    <>
                      <Send className="inline w-5 h-5 mr-2" />
                      Send Reset Code
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Code Verification Page - Step 2: Enter Code */}
      {currentPage === 'resetCode' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 mb-4">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Enter Reset Code</h1>
            <p className="text-cyan-300">Check your email for the verification code</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-400/10 via-transparent to-red-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="text-center mb-6">
                <p className="text-slate-300 mb-2">
                  We've sent a verification code to:
                </p>
                <p className="text-cyan-400 font-semibold">{forgotPasswordEmail || forgotPasswordIdentifier}</p>
              </div>

              {resetTimerActive && (
                <div className="flex items-center justify-center mb-4">
                  <div className={`flex items-center justify-center px-4 py-2 rounded-xl ${
                    resetTimeRemaining <= 60 ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'
                  }`}>
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="font-mono font-medium">
                      Code expires in: {formatTime(resetTimeRemaining)}
                    </span>
                  </div>
                </div>
              )}

              <form onSubmit={handleVerifyResetCode} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Verification Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300 text-center tracking-widest text-2xl font-mono"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>

                {resetCodeError && (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                    {resetCodeError}
                  </div>
                )}

                {forgotPasswordSuccess && (
                  <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-4 py-3 rounded-xl text-sm">
                    {forgotPasswordSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetCodeLoading || resetCode.length !== 6 || !resetTimerActive}
                  className="w-full bg-gradient-to-r from-orange-500/80 to-red-600/80 hover:from-orange-600/90 hover:to-red-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-orange-400/30"
                >
                  {resetCodeLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Verifying...</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle className="inline w-5 h-5 mr-2" />
                      Verify Code
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-6 space-y-3">
                <button
                  onClick={() => {
                    setResetCodeError('');
                    setForgotPasswordSuccess('');
                    setCurrentPage('forgotPassword');
                  }}
                  className="flex items-center justify-center mx-auto text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Change Email/Username
                </button>
                
                <p className="text-slate-400 text-sm">Didn't receive the code?</p>
                <button
                  onClick={handleResendResetCode}
                  disabled={forgotPasswordLoading}
                  className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline disabled:opacity-50"
                >
                  {forgotPasswordLoading ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent mr-2"></div>
                      Sending...
                    </span>
                  ) : (
                    <>
                      <RefreshCw className="inline w-4 h-4 mr-1" />
                      Resend Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Password Page - Step 3: Set New Password */}
      {currentPage === 'newPassword' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-teal-600 mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Set New Password</h1>
            <p className="text-cyan-300">Create a strong password for your account</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-400/10 via-transparent to-teal-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-cyan-300 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-cyan-400 w-5 h-5" />
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full bg-slate-800/40 backdrop-blur-sm border border-cyan-500/30 rounded-xl pl-12 pr-12 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all duration-300"
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Password requirements */}
                <div className="bg-slate-800/40 backdrop-blur-sm border border-cyan-500/20 rounded-xl p-4">
                  <p className="text-cyan-300 text-sm font-medium mb-2">Password Requirements:</p>
                  <ul className="text-xs space-y-1">
                    <li className={`flex items-center ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${newPassword.length >= 8 ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                      At least 8 characters
                    </li>
                    <li className={`flex items-center ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${/[A-Z]/.test(newPassword) ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                      One uppercase letter
                    </li>
                    <li className={`flex items-center ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${/[a-z]/.test(newPassword) ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                      One lowercase letter
                    </li>
                    <li className={`flex items-center ${/[0-9]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${/[0-9]/.test(newPassword) ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                      One number
                    </li>
                    <li className={`flex items-center ${newPassword && confirmNewPassword && newPassword === confirmNewPassword ? 'text-green-400' : 'text-slate-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-2 ${newPassword && confirmNewPassword && newPassword === confirmNewPassword ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                      Passwords match
                    </li>
                  </ul>
                </div>

                {resetPasswordError && (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                    {resetPasswordError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetPasswordLoading || !newPassword || !confirmNewPassword}
                  className="w-full bg-gradient-to-r from-green-500/80 to-teal-600/80 hover:from-green-600/90 hover:to-teal-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-green-400/30"
                >
                  {resetPasswordLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Resetting Password...</span>
                    </div>
                  ) : (
                    <>
                      <KeyRound className="inline w-5 h-5 mr-2" />
                      Reset Password
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Success Page */}
      {currentPage === 'resetSuccess' && (
        <div className="w-full max-w-md py-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-green-500 to-teal-600 mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Password Reset!</h1>
            <p className="text-cyan-300">Your password has been successfully changed</p>
          </div>

          <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden text-center">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-green-400/10 via-transparent to-teal-500/10 pointer-events-none"></div>
            <div className="relative z-10">
              <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 px-4 py-3 rounded-xl mb-6">
                <p className="font-medium flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Password Changed Successfully!
                </p>
                <p className="text-sm mt-2">You can now log in with your new password. All existing sessions have been logged out for security.</p>
              </div>

              <button
                onClick={() => setCurrentPage('login')}
                className="w-full bg-gradient-to-r from-cyan-500/80 to-blue-600/80 hover:from-cyan-600/90 hover:to-blue-700/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 backdrop-blur-sm shadow-lg border border-cyan-400/30"
              >
                <Lock className="inline w-5 h-5 mr-2" />
                Continue to Login
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); opacity: 0.6; }
          50% { transform: translateY(-20px); opacity: 1; }
        }
        
        @keyframes shooting-star {
          0% { transform: translateX(0) translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(100px) translateY(-100px); opacity: 0; }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-slow-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-shooting-star {
          animation: shooting-star 3s linear infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        
        .animate-spin-slow-reverse {
          animation: spin-slow-reverse 25s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default RegistrationSystem;