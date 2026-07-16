import { useEffect, useState } from 'react';
import { setOfflineFlag } from '@/lib/cache';

export function isNetworkError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return /network error|failed to fetch|network request failed|offline|ECONNREFUSED|ETIMEDOUT|fetch failed/i.test(msg);
}

/** Lightweight online probe + React hook */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = (next: boolean) => {
      setOnline(next);
      setOfflineFlag(!next).catch(() => undefined);
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      update(typeof navigator !== 'undefined' ? navigator.onLine !== false : true);
      const on = () => update(true);
      const off = () => update(false);
      window.addEventListener('online', on);
      window.addEventListener('offline', off);
      return () => {
        window.removeEventListener('online', on);
        window.removeEventListener('offline', off);
      };
    }
    return undefined;
  }, []);

  return online;
}
