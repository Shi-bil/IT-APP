import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext'
import { EventEmitter } from 'events'

// Fix for "Emitter is not a constructor" error
if (typeof window !== 'undefined') {
  window.EventEmitter = EventEmitter;
}

// Initialize the app with error handling
const renderApp = () => {
  try {
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </React.StrictMode>,
    )
  } catch (error) {
    console.error('Error rendering the application:', error);
    document.getElementById('root').innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Error loading application</h2>
        <p style="color: red;">${error.message}</p>
        <button onclick="location.reload()">Reload</button>
      </div>
    `;
  }
}

renderApp();