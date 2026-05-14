import { useEffect, useRef } from 'react';

// Calls `callback()` whenever the tab regains visibility/focus, plus on a
// throttled interval. Used by data pages to stay in sync without a manual
// reload — switch back to the app and the data is already refreshing.
export function useTabRefresh(callback, { enabled = true, intervalMs = 0 } = {}) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;
    let lastRun = 0;
    // Throttle: ignore triggers that fire within 2s of each other so a user
    // toggling between tabs rapidly doesn't hammer the API.
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
    let intervalId;
    if (intervalMs > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') run();
      }, intervalMs);
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', run);
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);
}

export default useTabRefresh;
