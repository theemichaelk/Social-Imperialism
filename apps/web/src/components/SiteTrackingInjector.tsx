'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getApiBase } from '@/lib/api';
import type { PublicSiteTrackingPayload } from '@/lib/siteTracking';

const INJECT_ATTR = 'data-si-tracking';

function injectMeta(name: string, content: string, marker: string) {
  if (!content.trim()) return;
  const existing = document.querySelector(`meta[${INJECT_ATTR}="${marker}"]`);
  if (existing) {
    existing.setAttribute('content', content);
    return;
  }
  const meta = document.createElement('meta');
  meta.setAttribute(INJECT_ATTR, marker);
  if (name === 'google-site-verification') meta.name = name;
  else if (name === 'msvalidate.01') meta.name = name;
  else if (name === 'y_key') meta.name = name;
  else meta.setAttribute('name', name);
  meta.content = content;
  document.head.appendChild(meta);
}

function injectHtmlBlock(html: string, target: 'head' | 'body-start' | 'body-end', marker: string) {
  if (!html.trim()) return;
  const id = `si-track-${marker}`;
  const existing = document.getElementById(id);
  if (existing) {
    existing.innerHTML = html;
    return;
  }
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.setAttribute(INJECT_ATTR, marker);
  wrap.style.display = 'contents';
  wrap.innerHTML = html;
  if (target === 'head') document.head.appendChild(wrap);
  else if (target === 'body-start') document.body.prepend(wrap);
  else document.body.appendChild(wrap);
}

function injectGa4(measurementId: string) {
  if (!measurementId.trim()) return;
  const scriptId = 'si-ga4-loader';
  if (!document.getElementById(scriptId)) {
    const s = document.createElement('script');
    s.id = scriptId;
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(s);
  }
  if (!document.getElementById('si-ga4-config')) {
    const cfg = document.createElement('script');
    cfg.id = 'si-ga4-config';
    cfg.setAttribute(INJECT_ATTR, 'ga4');
    cfg.text = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId.replace(/'/g, '')}');
    `;
    document.head.appendChild(cfg);
  }
}

function injectGtm(containerId: string) {
  if (!containerId.trim()) return;
  const noscriptId = 'si-gtm-noscript';
  if (!document.getElementById('si-gtm-loader')) {
    const s = document.createElement('script');
    s.id = 'si-gtm-loader';
    s.setAttribute(INJECT_ATTR, 'gtm');
    s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${containerId.replace(/'/g, '')}');`;
    document.head.appendChild(s);
  }
  if (!document.getElementById(noscriptId)) {
    const ns = document.createElement('noscript');
    ns.id = noscriptId;
    ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.prepend(ns);
  }
}

function applyPayload(payload: PublicSiteTrackingPayload) {
  injectMeta('google-site-verification', payload.googleSearchConsoleVerification, 'gsc');
  injectMeta('msvalidate.01', payload.bingWebmasterVerification, 'bing');
  injectMeta('y_key', payload.yahooSiteVerification, 'yahoo');

  if (payload.ga4MeasurementId) injectGa4(payload.ga4MeasurementId);
  if (payload.gtmContainerId) injectGtm(payload.gtmContainerId);

  if (payload.facebookPixelId && !document.getElementById('si-fb-pixel')) {
    const s = document.createElement('script');
    s.id = 'si-fb-pixel';
    s.setAttribute(INJECT_ATTR, 'fb-pixel');
    s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${payload.facebookPixelId.replace(/'/g, '')}');fbq('track','PageView');`;
    document.head.appendChild(s);
  }

  if (payload.microsoftClarityId && !document.getElementById('si-clarity')) {
    const s = document.createElement('script');
    s.id = 'si-clarity';
    s.setAttribute(INJECT_ATTR, 'clarity');
    s.text = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${payload.microsoftClarityId.replace(/'/g, '')}");`;
    document.head.appendChild(s);
  }

  if (payload.hotjarSiteId && !document.getElementById('si-hotjar')) {
    const s = document.createElement('script');
    s.id = 'si-hotjar';
    s.setAttribute(INJECT_ATTR, 'hotjar');
    s.text = `(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${payload.hotjarSiteId.replace(/\D/g, '')},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`;
    document.head.appendChild(s);
  }

  injectHtmlBlock(payload.customHeadHtml, 'head', 'custom-head');
  injectHtmlBlock(payload.globalHeaderHtml, 'head', 'global-header');
  if (payload.page?.headerHtml) injectHtmlBlock(payload.page.headerHtml, 'head', 'page-header');

  injectHtmlBlock(payload.customBodyHtml, 'body-end', 'custom-body');
  injectHtmlBlock(payload.globalFooterHtml, 'body-end', 'global-footer');
  if (payload.page?.bodyHtml) injectHtmlBlock(payload.page.bodyHtml, 'body-end', 'page-body');
  if (payload.page?.footerHtml) injectHtmlBlock(payload.page.footerHtml, 'body-end', 'page-footer');
}

export function SiteTrackingInjector() {
  const pathname = usePathname();
  const cacheRef = useRef<string>('');

  useEffect(() => {
    const path = pathname || '/';
    const cacheKey = `${path}`;
    if (cacheRef.current === cacheKey) return;

    fetch(`${getApiBase()}/api/public/site-tracking?path=${encodeURIComponent(path)}`)
      .then((r) => r.json())
      .then((res) => {
        if (res?.data) {
          applyPayload(res.data as PublicSiteTrackingPayload);
          cacheRef.current = cacheKey;
        }
      })
      .catch(() => { /* SSR head/body already injected when configured */ });
  }, [pathname]);

  return null;
}