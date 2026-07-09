import { fetchPublicSiteTracking } from '@/lib/fetchPublicSiteTracking';

function escAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escJsString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Server-rendered GA4/GTM/verification tags so Google Tag Assistant sees them in page source. */
export async function SiteTrackingHead() {
  const tracking = await fetchPublicSiteTracking('/');
  if (!tracking) return null;

  const ga4 = tracking.ga4MeasurementId?.trim();
  const gtm = tracking.gtmContainerId?.trim();
  const gsc = tracking.googleSearchConsoleVerification?.trim();
  const bing = tracking.bingWebmasterVerification?.trim();
  const yahoo = tracking.yahooSiteVerification?.trim();

  if (!ga4 && !gtm && !gsc && !bing && !yahoo) return null;

  return (
    <>
      {gsc ? <meta name="google-site-verification" content={escAttr(gsc)} /> : null}
      {bing ? <meta name="msvalidate.01" content={escAttr(bing)} /> : null}
      {yahoo ? <meta name="y_key" content={escAttr(yahoo)} /> : null}
      {ga4 ? (
        <>
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${escJsString(ga4)}');
              `.trim(),
            }}
          />
        </>
      ) : null}
      {gtm ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escJsString(gtm)}');`,
          }}
        />
      ) : null}
    </>
  );
}