import React from 'react';
import { usePWA } from '../hooks/usePWA';

/**
 * PWA Update and Install Prompt Component
 * Shows toast-style notifications for PWA updates and offline status
 */
export function PWAPrompt() {
  const {
    needRefresh,
    offlineReady,
    canInstall,
    isOnline,
    installApp,
    updateApp,
    dismissUpdate,
    dismissOfflineReady,
    dismissInstall
  } = usePWA();

  // Don't render anything if there's nothing to show
  if (!needRefresh && !offlineReady && !canInstall) {
    return null;
  }

  return (
    <>
      {/* Update Available Toast */}
      {needRefresh && (
        <div className="pwa-toast pwa-toast-update">
          <div className="pwa-toast-content">
            <div className="pwa-toast-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </div>
            <div className="pwa-toast-text">
              <strong>Update Available</strong>
              <span>A new version is ready to install</span>
            </div>
          </div>
          <div className="pwa-toast-actions">
            <button onClick={dismissUpdate} className="pwa-btn-secondary">
              Later
            </button>
            <button onClick={updateApp} className="pwa-btn-primary">
              Update Now
            </button>
          </div>
        </div>
      )}

      {/* Offline Ready Toast */}
      {offlineReady && !needRefresh && (
        <div className="pwa-toast pwa-toast-offline">
          <div className="pwa-toast-content">
            <div className="pwa-toast-icon pwa-icon-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div className="pwa-toast-text">
              <strong>Ready for Offline</strong>
              <span>App cached for offline use</span>
            </div>
          </div>
          <button onClick={dismissOfflineReady} className="pwa-btn-dismiss">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Install Prompt */}
      {canInstall && !needRefresh && !offlineReady && (
        <div className="pwa-toast pwa-toast-install">
          <button onClick={dismissInstall} className="pwa-btn-close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="pwa-toast-content">
            <div className="pwa-toast-icon pwa-icon-install">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="pwa-toast-text">
              <strong>Install App</strong>
              <span>Add to home screen for quick access</span>
            </div>
          </div>
          <button onClick={installApp} className="pwa-btn-primary">
            Install
          </button>
        </div>
      )}

      {/* Offline Status Bar */}
      {!isOnline && (
        <div className="pwa-offline-bar">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>You're offline</span>
        </div>
      )}

      <style>{`
        .pwa-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 2px 10px rgba(0, 0, 0, 0.1);
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          z-index: 10000;
          max-width: calc(100vw - 48px);
          animation: pwa-slide-up 0.3s ease-out;
        }
        
        .pwa-btn-close {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px;
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pwa-btn-close:hover {
          background: #f3f4f6;
          color: #6b7280;
        }
        
        .pwa-toast-install {
          padding-top: 28px;
        }
        
        @keyframes pwa-slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .pwa-toast-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        
        .pwa-toast-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .pwa-toast-icon.pwa-icon-success {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        }
        
        .pwa-toast-icon.pwa-icon-install {
          background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
        }
        
        .pwa-toast-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .pwa-toast-text strong {
          font-size: 15px;
          font-weight: 600;
          color: #1f2937;
        }
        
        .pwa-toast-text span {
          font-size: 13px;
          color: #6b7280;
        }
        
        .pwa-toast-actions {
          display: flex;
          gap: 8px;
        }
        
        .pwa-btn-primary {
          padding: 10px 20px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .pwa-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
        }
        
        .pwa-btn-secondary {
          padding: 10px 20px;
          background: #f3f4f6;
          color: #4b5563;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }
        
        .pwa-btn-secondary:hover {
          background: #e5e7eb;
        }
        
        .pwa-btn-dismiss {
          padding: 8px;
          background: transparent;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pwa-btn-dismiss:hover {
          background: #f3f4f6;
          color: #6b7280;
        }
        
        .pwa-offline-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 500;
          z-index: 10001;
          animation: pwa-slide-down 0.3s ease-out;
        }
        
        @keyframes pwa-slide-down {
          from {
            opacity: 0;
            transform: translateY(-100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @media (max-width: 640px) {
          .pwa-toast {
            bottom: 16px;
            right: 16px;
            left: auto;
            max-width: calc(100vw - 32px);
          }
          
          .pwa-toast-actions {
            justify-content: stretch;
          }
          
          .pwa-toast-actions button {
            flex: 1;
          }
        }
        
        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .pwa-toast {
            background: #1f2937;
          }
          
          .pwa-toast-text strong {
            color: #f9fafb;
          }
          
          .pwa-toast-text span {
            color: #9ca3af;
          }
          
          .pwa-btn-secondary {
            background: #374151;
            color: #d1d5db;
          }
          
          .pwa-btn-secondary:hover {
            background: #4b5563;
          }
          
          .pwa-btn-dismiss:hover {
            background: #374151;
          }
          
          .pwa-btn-close:hover {
            background: #374151;
            color: #d1d5db;
          }
        }
      `}</style>
    </>
  );
}

export default PWAPrompt;

