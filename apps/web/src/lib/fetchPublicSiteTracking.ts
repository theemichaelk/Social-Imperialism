import type { PublicSiteTrackingPayload } from '@/lib/siteTracking';

const API_BASE =
  process.env.API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://api.socialimperialism.com';

export async function fetchPublicSiteTracking(pathname = '/'): Promise<PublicSiteTrackingPayload | null> {
  const path = pathname.split('?')[0] || '/';
  try {
    const res = await fetch(
      `${API_BASE}/api/public/site-tracking?path=${encodeURIComponent(path)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = await res.json() as { data?: PublicSiteTrackingPayload };
    return json.data ?? null;
  } catch {
    return null;
  }
}