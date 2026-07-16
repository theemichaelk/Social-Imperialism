import { useCallback, useRef, useState } from 'react';
import { getProjectId, invoke } from '@/lib/api';
import {
  cacheGet,
  cacheGetStale,
  cacheSet,
  projectCacheKey,
  setOfflineFlag,
} from '@/lib/cache';
import { isNetworkError } from '@/lib/network';

export type CachedResult<T> = {
  data: T | null;
  fromCache: boolean;
  offline: boolean;
  stale: boolean;
  error: string | null;
  loading: boolean;
  refresh: (force?: boolean) => Promise<T | null>;
};

/**
 * Invoke an IPC channel with offline-first cache.
 * On network failure, serves last good payload (even if stale).
 */
export function useCachedInvoke<T>(
  channel: string,
  args: unknown[] = [],
  opts?: { ttlMs?: number; cacheName?: string; enabled?: boolean },
): CachedResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [offline, setOffline] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const argsRef = useRef(args);
  argsRef.current = args;

  const refresh = useCallback(async (force = false) => {
    if (opts?.enabled === false) return null;
    setLoading(true);
    setError(null);

    const projectId = await getProjectId();
    const cacheName = opts?.cacheName || channel;
    const key = projectCacheKey(projectId, cacheName);

    if (!force) {
      const hit = await cacheGet<T>(key);
      if (hit) {
        setData(hit.data);
        setFromCache(true);
        setStale(false);
        setOffline(false);
      }
    }

    try {
      const live = await invoke<T>(channel, ...argsRef.current);
      await cacheSet(key, live, opts?.ttlMs);
      await setOfflineFlag(false);
      setData(live);
      setFromCache(false);
      setOffline(false);
      setStale(false);
      setLoading(false);
      return live;
    } catch (e) {
      const net = isNetworkError(e);
      const staleHit = await cacheGetStale<T>(key);
      if (staleHit) {
        setData(staleHit.data);
        setFromCache(true);
        setStale(true);
        setOffline(net);
        await setOfflineFlag(net);
        setError(net ? 'Offline — showing cached data' : (e as Error).message);
        setLoading(false);
        return staleHit.data;
      }
      setOffline(net);
      setError((e as Error).message || 'Request failed');
      setLoading(false);
      return null;
    }
  }, [channel, opts?.cacheName, opts?.enabled, opts?.ttlMs]);

  return { data, fromCache, offline, stale, error, loading, refresh };
}

/** One-shot cached invoke for non-hook use */
export async function invokeWithCache<T>(
  channel: string,
  args: unknown[] = [],
  opts?: { ttlMs?: number; cacheName?: string },
): Promise<{ data: T | null; fromCache: boolean; offline: boolean; error?: string }> {
  const projectId = await getProjectId();
  const key = projectCacheKey(projectId, opts?.cacheName || channel);

  try {
    const live = await invoke<T>(channel, ...args);
    await cacheSet(key, live, opts?.ttlMs);
    await setOfflineFlag(false);
    return { data: live, fromCache: false, offline: false };
  } catch (e) {
    const net = isNetworkError(e);
    const staleHit = await cacheGetStale<T>(key);
    if (staleHit) {
      await setOfflineFlag(net);
      return {
        data: staleHit.data,
        fromCache: true,
        offline: net,
        error: net ? 'Offline — showing cached data' : (e as Error).message,
      };
    }
    return {
      data: null,
      fromCache: false,
      offline: net,
      error: (e as Error).message,
    };
  }
}
