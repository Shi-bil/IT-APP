import { useState, useEffect, useCallback } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * Custom hook for PWA functionality
 * Handles service worker registration, updates, and install prompts
 */
export function usePWA() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateServiceWorker, setUpdateServiceWorker] = useState(() => () => {});

  useEffect(() => {
    // Register the service worker
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
      onRegistered(registration) {
        console.log('PWA: Service Worker registered', registration);
      },
      onRegisterError(error) {
        console.error('PWA: Service Worker registration error', error);
      }
    });

    setUpdateServiceWorker(() => updateSW);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setCanInstall(true);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      window.deferredPrompt = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if there's an existing deferred prompt
    if (window.deferredPrompt) {
      setCanInstall(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = useCallback(async () => {
    const deferredPrompt = window.deferredPrompt;
    if (!deferredPrompt) {
      console.log('PWA: No installation prompt available');
      return false;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
      
      if (outcome === 'accepted') {
        window.deferredPrompt = null;
        setCanInstall(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('PWA: Error during install prompt', error);
      return false;
    }
  }, []);

  const updateApp = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false);
  }, []);

  const dismissInstall = useCallback(() => {
    setCanInstall(false);
  }, []);

  return {
    // States
    needRefresh,
    offlineReady,
    canInstall,
    isInstalled,
    isOnline,
    
    // Actions
    installApp,
    updateApp,
    dismissUpdate,
    dismissOfflineReady,
    dismissInstall
  };
}

export default usePWA;

