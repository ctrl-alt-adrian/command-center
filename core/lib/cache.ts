/**
 * Tiny TTL memoizer for expensive read-only fs scans.
 *
 * Single-flight: concurrent callers within the TTL share the same in-flight
 * promise. Write paths must call `bust()` to invalidate.
 */
export interface TtlCache<T> {
  get(): Promise<T>;
  bust(): void;
}

export function ttlCache<T>(fn: () => Promise<T>, ttlMs: number): TtlCache<T> {
  let cached: { promise: Promise<T>; expiresAt: number } | null = null;

  return {
    get() {
      const now = Date.now();
      if (cached && cached.expiresAt > now) return cached.promise;
      const promise = fn().catch((err) => {
        if (cached?.promise === promise) cached = null;
        throw err;
      });
      cached = { promise, expiresAt: now + ttlMs };
      return promise;
    },
    bust() {
      cached = null;
    },
  };
}
