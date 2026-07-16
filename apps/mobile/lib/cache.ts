import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PREFIX = 'si_cache:';
const META_KEY = 'si_cache_meta';
const DEFAULT_TTL_MS = 1000 * 60 * 30; // 30 minutes

export type CacheEnvelope<T> = {
  data: T;
  savedAt: number;
  ttlMs: number;
  key: string;
  offline?: boolean;
};

type Meta = {
  keys: string[];
  lastOnlineAt?: number;
  offline?: boolean;
};

async function rawGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function rawSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

async function rawRemove(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

async function readMeta(): Promise<Meta> {
  const raw = await rawGet(META_KEY);
  if (!raw) return { keys: [] };
  try {
    const parsed = JSON.parse(raw) as Meta;
    return {
      keys: Array.isArray(parsed.keys) ? parsed.keys : [],
      lastOnlineAt: parsed.lastOnlineAt,
      offline: !!parsed.offline,
    };
  } catch {
    return { keys: [] };
  }
}

async function writeMeta(meta: Meta): Promise<void> {
  await rawSet(META_KEY, JSON.stringify(meta));
}

function fullKey(key: string) {
  return `${PREFIX}${key}`;
}

export async function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): Promise<void> {
  if (!key) return;
  const envelope: CacheEnvelope<T> = {
    data,
    savedAt: Date.now(),
    ttlMs,
    key,
  };
  await rawSet(fullKey(key), JSON.stringify(envelope));
  const meta = await readMeta();
  if (!meta.keys.includes(key)) {
    meta.keys = [...meta.keys, key].slice(-80);
  }
  meta.lastOnlineAt = Date.now();
  meta.offline = false;
  await writeMeta(meta);
}

export async function cacheGet<T>(key: string, opts?: { allowStale?: boolean }): Promise<CacheEnvelope<T> | null> {
  const raw = await rawGet(fullKey(key));
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope !== 'object') return null;
    const age = Date.now() - (envelope.savedAt || 0);
    const expired = age > (envelope.ttlMs || DEFAULT_TTL_MS);
    if (expired && !opts?.allowStale) return null;
    return envelope;
  } catch {
    return null;
  }
}

export async function cacheGetStale<T>(key: string): Promise<CacheEnvelope<T> | null> {
  return cacheGet<T>(key, { allowStale: true });
}

export async function cacheClear(prefix?: string): Promise<void> {
  const meta = await readMeta();
  const keys = prefix
    ? meta.keys.filter((k) => k.startsWith(prefix))
    : [...meta.keys];
  await Promise.all(keys.map((k) => rawRemove(fullKey(k))));
  meta.keys = prefix ? meta.keys.filter((k) => !k.startsWith(prefix)) : [];
  await writeMeta(meta);
}

export async function setOfflineFlag(offline: boolean): Promise<void> {
  const meta = await readMeta();
  meta.offline = offline;
  if (!offline) meta.lastOnlineAt = Date.now();
  await writeMeta(meta);
}

export async function getCacheStatus(): Promise<{ offline: boolean; lastOnlineAt?: number; keyCount: number }> {
  const meta = await readMeta();
  return {
    offline: !!meta.offline,
    lastOnlineAt: meta.lastOnlineAt,
    keyCount: meta.keys.length,
  };
}

/** Build project-scoped cache key */
export function projectCacheKey(projectId: string | null | undefined, name: string): string {
  return `${projectId || 'default'}:${name}`;
}
