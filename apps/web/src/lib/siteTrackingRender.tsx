import type { PublicSiteTrackingPayload } from '@/lib/siteTracking';

export function escAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function escJsString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function RawHtmlBlock({ html, id }: { html?: string; id: string }) {
  const trimmed = html?.trim();
  if (!trimmed) return null;
  return (
    <div
      id={id}
      data-si-tracking={id}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}

export function TrackingHeadTags({ tracking }: { tracking: PublicSiteTrackingPayload }) {
  const ga4 = tracking.ga4MeasurementId?.trim();
  const gtm = tracking.gtmContainerId?.trim();
  const gsc = tracking.googleSearchConsoleVerification?.trim();
  const bing = tracking.bingWebmasterVerification?.trim();
  const yahoo = tracking.yahooSiteVerification?.trim();
  const fb = tracking.facebookPixelId?.trim();
  const clarity = tracking.microsoftClarityId?.trim();
  const hotjar = tracking.hotjarSiteId?.replace(/\D/g, '');

  return (
    <>
      {gsc ? <meta name="google-site-verification" content={escAttr(gsc)} data-si-tracking="gsc" /> : null}
      {bing ? <meta name="msvalidate.01" content={escAttr(bing)} data-si-tracking="bing" /> : null}
      {yahoo ? <meta name="y_key" content={escAttr(yahoo)} data-si-tracking="yahoo" /> : null}
      <RawHtmlBlock html={tracking.customHeadHtml} id="si-track-custom-head" />
      <RawHtmlBlock html={tracking.globalHeaderHtml} id="si-track-global-header" />
      <RawHtmlBlock html={tracking.page?.headerHtml} id="si-track-page-header" />
      {ga4 ? (
        <>
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`} data-si-tracking="ga4-loader" />
          <script
            data-si-tracking="ga4-config"
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
          data-si-tracking="gtm"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${escJsString(gtm)}');`,
          }}
        />
      ) : null}
      {fb ? (
        <script
          id="si-fb-pixel"
          data-si-tracking="fb-pixel"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${escJsString(fb)}');fbq('track','PageView');`,
          }}
        />
      ) : null}
      {clarity ? (
        <script
          id="si-clarity"
          data-si-tracking="clarity"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${escJsString(clarity)}");`,
          }}
        />
      ) : null}
      {hotjar ? (
        <script
          id="si-hotjar"
          data-si-tracking="hotjar"
          dangerouslySetInnerHTML={{
            __html: `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${hotjar},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
          }}
        />
      ) : null}
    </>
  );
}

export function TrackingBodyTags({ tracking }: { tracking: PublicSiteTrackingPayload }) {
  const gtm = tracking.gtmContainerId?.trim();
  return (
    <>
      {gtm ? (
        <noscript data-si-tracking="gtm-noscript">
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtm)}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
            title="Google Tag Manager"
          />
        </noscript>
      ) : null}
      <RawHtmlBlock html={tracking.customBodyHtml} id="si-track-custom-body" />
      <RawHtmlBlock html={tracking.page?.bodyHtml} id="si-track-page-body" />
      <RawHtmlBlock html={tracking.globalFooterHtml} id="si-track-global-footer" />
      <RawHtmlBlock html={tracking.page?.footerHtml} id="si-track-page-footer" />
    </>
  );
}

export function hasTrackingPayload(tracking: PublicSiteTrackingPayload | null) {
  if (!tracking) return false;
  return !!(
    tracking.ga4MeasurementId
    || tracking.gtmContainerId
    || tracking.googleSearchConsoleVerification
    || tracking.bingWebmasterVerification
    || tracking.yahooSiteVerification
    || tracking.facebookPixelId
    || tracking.microsoftClarityId
    || tracking.hotjarSiteId
    || tracking.customHeadHtml?.trim()
    || tracking.customBodyHtml?.trim()
    || tracking.globalHeaderHtml?.trim()
    || tracking.globalFooterHtml?.trim()
    || tracking.page?.headerHtml?.trim()
    || tracking.page?.bodyHtml?.trim()
    || tracking.page?.footerHtml?.trim()
  );
}