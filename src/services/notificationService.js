import axios from 'axios';

const authHeader = () => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const notificationService = {
  isSupported() {
    return (
      typeof window !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window
    );
  },

  // iOS only allows web push when launched from the Home Screen as a PWA.
  isIOS() {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  isStandalone() {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    );
  },

  async getVapidPublicKey() {
    const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (fromEnv) return fromEnv;
    const res = await axios.get('/api/notifications/vapid-public-key', { headers: authHeader() });
    return res.data?.publicKey || '';
  },

  async getPreferences() {
    const res = await axios.get('/api/notifications/preferences', { headers: authHeader() });
    return res.data;
  },

  async setPreference(notificationsEnabled) {
    const res = await axios.put(
      '/api/notifications/preferences',
      { notificationsEnabled },
      { headers: authHeader() }
    );
    return res.data;
  },

  async getRegistration() {
    if (!this.isSupported()) return null;
    return navigator.serviceWorker.ready;
  },

  async getCurrentSubscription() {
    const reg = await this.getRegistration();
    if (!reg) return null;
    return reg.pushManager.getSubscription();
  },

  async subscribeDevice() {
    if (!this.isSupported()) throw new Error('Push notifications not supported on this device.');
    if (typeof window !== 'undefined' && !window.isSecureContext
        && window.location.hostname !== 'localhost'
        && window.location.hostname !== '127.0.0.1') {
      throw new Error('Push requires HTTPS. Open the app over HTTPS and try again.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission denied.');
    const publicKey = await this.getVapidPublicKey();
    if (!publicKey) throw new Error('VAPID public key not configured on server. Set VAPID_PUBLIC_KEY in .env and restart.');
    const reg = await this.getRegistration();
    if (!reg) throw new Error('Service worker not ready. Reload the page and try again.');
    const appKey = urlBase64ToUint8Array(publicKey);
    let sub = await reg.pushManager.getSubscription();
    // If a previous subscription used a different VAPID key, drop it first —
    // pushManager.subscribe() throws InvalidStateError otherwise.
    if (sub) {
      const existingKey = sub.options?.applicationServerKey;
      const keysMatch = existingKey
        && new Uint8Array(existingKey).every((b, i) => b === appKey[i])
        && existingKey.byteLength === appKey.byteLength;
      if (!keysMatch) {
        try { await sub.unsubscribe(); } catch { /* noop */ }
        sub = null;
      }
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey,
      });
    }
    await axios.post(
      '/api/notifications/subscribe',
      { subscription: sub.toJSON(), userAgent: navigator.userAgent },
      { headers: authHeader() }
    );
    return sub;
  },

  async unsubscribeDevice() {
    const sub = await this.getCurrentSubscription();
    if (!sub) return;
    try {
      await axios.post(
        '/api/notifications/unsubscribe',
        { endpoint: sub.endpoint },
        { headers: authHeader() }
      );
    } catch {
      // Ignore — still unsubscribe locally so the device stops receiving.
    }
    await sub.unsubscribe();
  },

  async sendTest() {
    const res = await axios.post('/api/notifications/test', {}, { headers: authHeader() });
    return res.data;
  },
};

export default notificationService;
