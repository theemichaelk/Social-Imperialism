import { fetchPublicSiteTracking } from '@/lib/fetchPublicSiteTracking';
import { getRequestPathname } from '@/lib/getRequestPathname';
import { hasTrackingPayload, TrackingBodyTags } from '@/lib/siteTrackingRender';

export async function SiteTrackingBody() {
  const pathname = getRequestPathname('/');
  const tracking = await fetchPublicSiteTracking(pathname);
  if (!hasTrackingPayload(tracking)) return null;
  return <TrackingBodyTags tracking={tracking!} />;
}