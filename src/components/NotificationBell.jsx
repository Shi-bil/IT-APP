import React, { useRef, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import usePushNotifications from '../hooks/usePushNotifications';
import notificationService from '../services/notificationService';

const NotificationBell = () => {
  const { user } = useAuth();
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const {
    supported,
    permission,
    isOn,
    loading,
    error,
    turnOn,
    turnOff,
  } = usePushNotifications({ enabled: !!user });

  const isSecure = typeof window !== 'undefined'
    ? (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    : true;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (
        buttonRef.current
        && !buttonRef.current.contains(e.target)
        && !document.getElementById('notif-bell-portal')?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleToggle = async () => {
    if (!supported) {
      toast.error('Push notifications are not supported on this device.');
      return;
    }
    if (!isSecure) {
      toast.error('Push notifications require HTTPS. Open the app via HTTPS or localhost.');
      return;
    }
    if (notificationService.isIOS() && !notificationService.isStandalone()) {
      toast(
        'On iOS: tap Share → "Add to Home Screen", then open the app from there to enable notifications.',
        { duration: 6000, icon: 'ℹ️' }
      );
      return;
    }
    if (permission === 'denied') {
      toast.error('Notifications are blocked in browser settings. Allow them and try again.');
      return;
    }
    if (isOn) {
      const r = await turnOff();
      if (r.ok) toast.success('Notifications turned off');
      else toast.error(r.error || 'Failed to turn off');
    } else {
      const r = await turnOn();
      if (r.ok) toast.success('Notifications turned on');
      else toast.error(r.error || 'Failed to turn on');
    }
  };

  const openPanel = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, left: rect.right - 280 });
    }
    setOpen((v) => !v);
  };

  const Icon = isOn ? Bell : BellOff;
  const iconColor = isOn ? 'text-cyan-300' : 'text-slate-400';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPanel}
        className={`relative p-2 rounded-lg glass-morphism-hover ${iconColor} hover:text-cyan-300 hover:bg-cyan-500/10 transition-all duration-200`}
        aria-label="Notifications"
        title={isOn ? 'Notifications on' : 'Notifications off'}
      >
        <Icon className="w-5 h-5 md:w-6 md:h-6" />
        {isOn ? (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400" />
        ) : null}
      </button>
      {open && ReactDOM.createPortal(
        <div
          id="notif-bell-portal"
          className="fixed w-72 glass-morphism rounded-xl border border-cyan-400/30 z-[1000] p-3 shadow-2xl"
          style={{ top: pos.top, left: Math.max(8, pos.left) }}
        >
          <p className="text-xs uppercase tracking-wider text-slate-400">Payment reminders</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Daily reminder for payments due tomorrow.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 border border-slate-700/60 p-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200">Notifications</p>
              <p className="text-[11px] text-slate-400">
                {isOn ? 'On for this device' : 'Off'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={loading}
              role="switch"
              aria-checked={isOn}
              className={`relative shrink-0 inline-flex items-center w-11 h-6 min-w-[2.75rem] min-h-[1.5rem] rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                isOn
                  ? 'bg-emerald-500 hover:bg-emerald-400'
                  : 'bg-slate-600 hover:bg-slate-500'
              } ${loading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.45)] ring-0 transition-transform duration-200 ease-out transform ${
                  isOn ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          {!supported ? (
            <p className="text-[11px] text-amber-300 mt-2">Push not supported on this browser.</p>
          ) : null}
          {!isSecure ? (
            <p className="text-[11px] text-rose-300 mt-2">
              This page is not secure. Push requires HTTPS — open the app via HTTPS (or localhost) and try again.
            </p>
          ) : null}
          {notificationService.isIOS() && !notificationService.isStandalone() ? (
            <p className="text-[11px] text-amber-300 mt-2">
              On iOS, install the app to your Home Screen first (Share → Add to Home Screen) and open it from there.
            </p>
          ) : null}
          {permission === 'denied' ? (
            <p className="text-[11px] text-rose-300 mt-2">
              Notifications are blocked. Enable them in your browser/device settings.
            </p>
          ) : null}
          {error ? (
            <p className="text-[11px] text-rose-300 mt-2 break-words">{error}</p>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
};

export default NotificationBell;
