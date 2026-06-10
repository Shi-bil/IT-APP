import { useEffect, useRef } from 'react';

// Calls `callback()` whenever:
//  1. The tab regains visibility/focus
//  2. Another tab on the same browser mutates data (BroadcastChannel)
//  3. The polling interval fires (cross-device real-time, default 5s)
export function useTabRefresh(callback, { enabled = true, intervalMs = 5000 } = {}) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;
    let lastRun = 0;
    // Throttle: ignore triggers within 2s to avoid hammering the API.
    const run = () => {
      const now = Date.now();
      if (now - lastRun < 2000) return;
      lastRun = now;
      cbRef.current?.();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', run);

    // Polling interval — fires only when tab is visible (battery friendly).
    // Default 5s keeps cross-device state fresh without hammering the API.
    let intervalId;
    if (intervalMs > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') run();
      }, intervalMs);
    }

    // BroadcastChannel: instant refresh when another tab on this browser
    // mutates data (invalidatePrefix posts a message on this channel).
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('itinventory-sync');
      bc.onmessage = (e) => {
        if (e.data?.type === 'invalidate') run();
      };
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', run);
      if (intervalId) clearInterval(intervalId);
      bc?.close();
    };
  }, [enabled, intervalMs]);
}

export default useTabRefresh;
