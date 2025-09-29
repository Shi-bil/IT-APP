import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import AssetsPage from './pages/AssetsPage';
import AssetForm from './pages/AssetForm';
import TicketsPage from './pages/TicketsPage';
import CredentialsPage from './pages/CredentialsPage';
import SettingsPage from './pages/SettingsPage';
import Parse from './config/parseConfig';

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // If a specific role is required and user doesn't have it
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to dashboard with a message that they don't have access
    return <Navigate to="/dashboard" replace state={{ 
      accessDenied: true, 
      message: `You need ${requiredRole} privileges to access this page` 
    }} />;
  }
  
  return children;
};

// Email Verification Component
const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = React.useState('verifying');
  const [message, setMessage] = React.useState('');
  
  // Get the base URL from environment variable or default to '/'
  const baseUrl = import.meta.env.VITE_FRONTEND_URL ? 
    new URL(import.meta.env.VITE_FRONTEND_URL).pathname : '/';
  
  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const token = searchParams.get('token');
        const email = searchParams.get('email');
        
        if (!token || !email) {
          setStatus('error');
          setMessage('Invalid verification link. Missing token or email.');
          return;
        }
        
        const result = await Parse.Cloud.run('verifyEmailWithToken', { email, token });
        
        if (result.success) {
          setStatus('success');
          setMessage('Your email has been successfully verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(result.error || 'Failed to verify email. Please try again.');
        }
      } catch (error) {
        setStatus('error');
        setMessage(error.message || 'Failed to verify email. Please try again.');
      }
    };
    
    verifyEmail();
  }, [searchParams]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {status === 'verifying' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
              {status === 'success' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
              {status === 'error' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Email Verification</h1>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl">
          {status === 'verifying' && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg text-white">Verifying your email address...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-center py-4">
              <div className="bg-green-500/20 border border-green-500/30 text-green-300 px-4 py-3 rounded-lg mb-6">
                <p className="font-medium text-lg">{message}</p>
              </div>
              <a 
                href={`${baseUrl}login`}
                className="bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 inline-block"
              >
                Go to Login
              </a>
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-center py-4">
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6">
                <p className="font-medium text-lg">{message}</p>
              </div>
              <a 
                href={`${baseUrl}login`}
                className="bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 inline-block"
              >
                Return to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<EmailVerificationPage />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      
      {/* Routes available to both admin and employees */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/tickets" 
        element={
          <ProtectedRoute>
            <Layout>
              <TicketsPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      {/* Admin-only routes */}
      <Route 
        path="/users" 
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <UsersPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/assets" 
        element={
          <ProtectedRoute>
            <Layout>
              <AssetsPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/assets/new" 
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <AssetForm />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/assets/edit/:assetId" 
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <AssetForm />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/credentials" 
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <CredentialsPage />
            </Layout>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

export default App;