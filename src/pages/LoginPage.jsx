import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, User, Eye, EyeOff, Shield, Users, Mail, ArrowLeft, CheckCircle, Building, Send, Clock, Laptop } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Parse from '../config/parseConfig';
import axios from 'axios';

const RegistrationSystem = () => {
  const navigate = useNavigate();
  const { login, loginAsEmployee, register, resendVerificationEmail, sendVerificationCode, verifyEmailWithCode } = useAuth();
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

  // Main render
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-2 sm:p-4 relative overflow-hidden">
      {/* Space Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
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

      {/* Login Page */}
      {currentPage === 'login' && (
        <div className="w-full h-full flex flex-col lg:flex-row items-center justify-between max-w-7xl mx-auto gap-4">
          {/* Left side - Space content */}
          <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-16">
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
              {/* Cosmic glass morphism login card */}
              <div className="backdrop-blur-3xl bg-black/40 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                {/* Optional: faint gradient overlay for depth */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/10 via-transparent to-blue-500/10 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                    <p className="text-cyan-300">Sign in to your account</p>
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

                  {loginType === 'employee' && (
                    <div className="space-y-6">
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
                          {error}
                        </div>
                      )}

                      <button
                        onClick={handleEmployeeLogin}
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

                      <div className="text-center">
                        <button
                          onClick={() => setCurrentPage('register')}
                          className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors duration-200 hover:underline"
                        >
                          First time? Register here
                        </button>
                      </div>
                    </div>
                  )}

                  {loginType === 'admin' && (
                    <div className="space-y-6">
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
                          {error}
                        </div>
                      )}

                      <button
                        onClick={handleAdminLogin}
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
                    </div>
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
        <div className="w-full max-w-md">
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
        <div className="w-full max-w-md">
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
        <div className="w-full max-w-md">
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

      {/* Custom CSS for animations */}
      <style jsx>{`
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