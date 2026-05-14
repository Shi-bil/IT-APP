// Lightweight per-user SWR cache for list endpoints. Returns cached data
// immediately on revisit while a background fetch refreshes the cache.
// Writes call invalidate() to drop stale entries.

const VERSION = 'v1';

function userId() {
  try {
    const raw = localStorage.getItem('auth_user');
    if (!raw) return 'anon';
    const u = JSON.parse(raw);
    return u?.id || u?._id || u?.email || 'anon';
  } catch {
    return 'anon';
  }
}

function fullKey(key) {
  return `swr:${VERSION}:${userId()}:${key}`;
}

export function readCache(key) {
  try {
    const raw = localStorage.getItem(fullKey(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(data));
  } catch {
    // localStorage may be full; ignore.
  }
}

export function invalidate(key) {
  try {
    localStorage.removeItem(fullKey(key));
  } catch {
    // ignore
  }
}

export function invalidatePrefix(prefix) {
  try {
    const full = `swr:${VERSION}:${userId()}:${prefix}`;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(full)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

// Returns cached data immediately (synchronously) plus a promise resolving
// to the freshest data from the network. Pages can use the immediate value
// to render without a spinner, then optionally swap in the fresh data when
// the promise resolves.
//
// Usage:
//   const { cached, fresh } = swr('assets:all', () => http.get(...));
//   if (cached) setAssets(cached);          // instant paint
//   const r = await fresh; setAssets(r);    // background refresh
export function swr(key, fetcher) {
  const cached = readCache(key);
  const fresh = Promise.resolve().then(async () => {
    const data = await fetcher();
    if (data && data.success !== false) writeCache(key, data);
    return data;
  });
  return { cached, fresh };
}
