export type SitePageConfig = {
  id: string;
  path: string;
  title: string;
  type: string;
  enabled: boolean;
  headerHtml?: string;
  footerHtml?: string;
  bodyHtml?: string;
};

export type SiteTrackingSettings = {
  globalHeaderHtml: string;
  globalFooterHtml: string;
  ga4MeasurementId: string;
  ga4Enabled: boolean;
  /** Numeric GA4 property id for Data API (admin traffic) — not G-XXXXXXXX */
  ga4PropertyId: string;
  /** GSC property: sc-domain:example.com or https://www.example.com/ */
  gscSiteUrl: string;
  gtmContainerId: string;
  gtmEnabled: boolean;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification: string;
  yahooSiteVerification: string;
  facebookPixelId: string;
  microsoftClarityId: string;
  hotjarSiteId: string;
  customHeadHtml: string;
  customBodyHtml: string;
  pages: SitePageConfig[];
  updatedAt?: string | null;
};

export type PublicSiteTrackingPayload = {
  path: string;
  page: {
    path: string;
    title: string;
    headerHtml: string;
    footerHtml: string;
    bodyHtml: string;
  } | null;
  globalHeaderHtml: string;
  globalFooterHtml: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  googleSearchConsoleVerification: string;
  bingWebmasterVerification: string;
  yahooSiteVerification: string;
  facebookPixelId: string;
  microsoftClarityId: string;
  hotjarSiteId: string;
  customHeadHtml: string;
  customBodyHtml: string;
  updatedAt?: string | null;
};

export const EMPTY_SITE_TRACKING: SiteTrackingSettings = {
  globalHeaderHtml: '',
  globalFooterHtml: '',
  ga4MeasurementId: '',
  ga4Enabled: false,
  ga4PropertyId: '',
  gscSiteUrl: '',
  gtmContainerId: '',
  gtmEnabled: false,
  googleSearchConsoleVerification: '',
  bingWebmasterVerification: '',
  yahooSiteVerification: '',
  facebookPixelId: '',
  microsoftClarityId: '',
  hotjarSiteId: '',
  customHeadHtml: '',
  customBodyHtml: '',
  pages: [],
};

export const SEARCH_CONSOLE_LINKS = {
  google: 'https://search.google.com/search-console',
  bing: 'https://www.bing.com/webmasters',
  yahoo: 'https://search.yahoo.com/',
} as const;