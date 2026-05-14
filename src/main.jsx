import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { TicketProvider } from './contexts/TicketContext'
import { PaymentsProvider } from './contexts/PaymentsContext'

// Render app immediately - no waiting
const root = document.getElementById('root');

ReactDOM.createRoot(root).render(
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}
  >
    <AuthProvider>
      <TicketProvider>
        <PaymentsProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid rgba(34,211,238,0.3)' },
              success: { iconTheme: { primary: '#22d3ee', secondary: '#0f172a' } },
              error: { iconTheme: { primary: '#f43f5e', secondary: '#0f172a' } },
            }}
          />
        </PaymentsProvider>
      </TicketProvider>
    </AuthProvider>
  </BrowserRouter>
);