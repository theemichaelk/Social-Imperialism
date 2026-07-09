import { fetchPublicSiteTracking } from '@/lib/fetchPublicSiteTracking';
import { getRequestPathname } from '@/lib/getRequestPathname';
import { hasTrackingPayload, TrackingHeadTags } from '@/lib/siteTrackingRender';

/** Server-rendered tracking tags — visible in View Source for Google/Bing verification. */
export async function SiteTrackingHead() {
  const pathname = getRequestPathname('/');
  const tracking = await fetchPublicSiteTracking(pathname);
  if (!hasTrackingPayload(tracking)) return null;
  return <TrackingHeadTags tracking={tracking!} />;
}