import { useCallback, useEffect, useState } from 'react';
import notificationService from '../services/notificationService';

// Manages push-notification opt-in for the current user. Combines two pieces
// of state: the user's saved preference (server) and the device's current
// browser subscription. Both must be true for notifications to actually fire.
export function usePushNotifications({ enabled }) {
  const [supported] = useState(() => notificationService.isSupported());
  const [permission, setPermission] = useState(() => (
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  ));
  const [preference, setPreference] = useState(false);
  const [hasDeviceSubscription, setHasDeviceSubscription] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled || !supported) return;
    try {
      const [prefs, sub] = await Promise.all([
        notificationService.getPreferences().catch(() => ({ notificationsEnabled: false })),
        notificationService.getCurrentSubscription().catch(() => null),
      ]);
      setPreference(Boolean(prefs?.notificationsEnabled));
      setHasDeviceSubscription(Boolean(sub));
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    } catch (err) {
      setError(err?.message || 'Failed to load notification state');
    }
  }, [enabled, supported]);

  useEffect(() => { refresh(); }, [refresh]);

  const turnOn = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await notificationService.subscribeDevice();
      await notificationService.setPreference(true);
      setPreference(true);
      setHasDeviceSubscription(true);
      if (typeof Notification !== 'undefined') setPermission(Notification.permission);
      return { ok: true };
    } catch (err) {
      setError(err?.message || 'Failed to enable notifications');
      return { ok: false, error: err?.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const turnOff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await notificationService.unsubscribeDevice();
      await notificationService.setPreference(false);
      setPreference(false);
      setHasDeviceSubscription(false);
      return { ok: true };
    } catch (err) {
      setError(err?.message || 'Failed to disable notifications');
      return { ok: false, error: err?.message };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    supported,
    permission,
    preference,
    hasDeviceSubscription,
    isOn: preference && hasDeviceSubscription && permission === 'granted',
    loading,
    error,
    turnOn,
    turnOff,
    refresh,
  };
}

export default usePushNotifications;
