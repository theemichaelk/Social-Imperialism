import { fetchPublicSiteTracking } from '@/lib/fetchPublicSiteTracking';

export async function SiteTrackingBody() {
  const tracking = await fetchPublicSiteTracking('/');
  const gtm = tracking?.gtmContainerId?.trim();
  if (!gtm) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtm)}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}