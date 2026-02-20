/**
 * Simple in-memory API response cache with stale-while-revalidate.
 * Cached data is returned instantly; a background refresh updates it silently.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();

/** Default: cache is fresh for 5 minutes */
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Get cached data for a key. Returns null if nothing cached.
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  return entry ? entry.data : null;
}

/**
 * Store data in cache.
 */
export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Check if cached data is still fresh (within maxAge).
 */
export function isFresh(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < maxAgeMs;
}

/**
 * Clear a specific cache key or the entire cache.
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
