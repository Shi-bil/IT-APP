import React from 'react';

const SplashScreen = ({ message = 'Loading...' }) => {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <h1 className="splash-title">IT MGMT</h1>
        <div className="splash-spinner"></div>
        <p className="splash-message">{message}</p>
      </div>
      
      <style>{`
        .splash-screen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          z-index: 9999;
        }
        
        .splash-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        
        .splash-title {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: 3px;
          margin: 0;
        }
        
        .splash-spinner {
          width: 44px;
          height: 44px;
          border: 3px solid rgba(6, 182, 212, 0.15);
          border-top-color: #06b6d4;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.2);
        }
        
        .splash-message {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          margin: 0;
          font-family: system-ui, -apple-system, sans-serif;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;

