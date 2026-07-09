import { headers } from 'next/headers';

export function getRequestPathname(fallback = '/') {
  try {
    const list = headers();
    const raw = list.get('x-pathname') || list.get('x-invoke-path') || fallback;
    const path = raw.split('?')[0].split('#')[0] || '/';
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return fallback;
  }
}