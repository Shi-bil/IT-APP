import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import SplashScreen from './components/SplashScreen';
import PWAPrompt from './components/PWAPrompt';
import axios from 'axios';

// Lazy load heavy components for faster initial render
const Layout = lazy(() => import('./components/Layout/Layout'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const AssetsPage = lazy(() => import('./pages/AssetsPage'));
const AssetForm = lazy(() => import('./pages/AssetForm'));
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const CredentialsPage = lazy(() => import('./pages/CredentialsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SubscriptionsPage = lazy(() => import('./pages/SubscriptionsPage'));
const VpsPage = lazy(() => import('./pages/VpsPage'));
const ObjectStoragePage = lazy(() => import('./pages/ObjectStoragePage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const AiCreditsPage = lazy(() => import('./pages/AiCreditsPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));

// Protected Route Component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated } = useAuth();
  
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
        const code = searchParams.get('code');
        const email = searchParams.get('email');
        
        if (!code || !email) {
          setStatus('error');
          setMessage('Invalid verification link. Missing code or email.');
          return;
        }
        
        const response = await axios.post('/api/verify-code', { email, code });
        
        if (response.data?.success) {
          setStatus('success');
          setMessage('Your email has been successfully verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(response.data?.error || 'Failed to verify email. Please try again.');
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
    <>
      <PWAPrompt />
      <Suspense fallback={<SplashScreen message="Loading app..." />}>
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

      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <SubscriptionsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/vps"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <VpsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/object-storage"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <ObjectStoragePage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <PaymentsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <Layout>
              <ProjectsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-credits"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout>
              <AiCreditsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
      </Suspense>
    </>
  );
}

export default App;