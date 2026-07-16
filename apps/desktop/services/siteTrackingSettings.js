/**
 * Site pages, header/footer HTML snippets, GA4, and search-console verification.
 */
const STORE_KEY = 'org_siteTrackingSettings';
const LEGACY_STORE_KEY = 'siteTrackingSettings';

const DEFAULT_PAGES = [
  { id: 'page_home', path: '/', title: 'Homepage', type: 'marketing', enabled: true },
  { id: 'page_about', path: '/about', title: 'About', type: 'marketing', enabled: true },
  { id: 'page_contact', path: '/contact', title: 'Contact', type: 'marketing', enabled: true },
  { id: 'page_privacy', path: '/privacy', title: 'Privacy Policy', type: 'legal', enabled: true },
  { id: 'page_terms', path: '/terms', title: 'Terms of Service', type: 'legal', enabled: true },
  { id: 'page_download', path: '/download', title: 'Download', type: 'marketing', enabled: true },
  { id: 'page_founder', path: '/founder', title: 'Founder', type: 'marketing', enabled: true },
  { id: 'page_subscribe', path: '/subscribe', title: 'Subscribe', type: 'conversion', enabled: true },
  { id: 'page_login', path: '/login', title: 'Login', type: 'auth', enabled: true },
  { id: 'page_sitemap', path: '/sitemap.html', title: 'Sitemap', type: 'seo', enabled: true },
  { id: 'page_blog', path: '/blog', title: 'Blog', type: 'seo', enabled: true },
  { id: 'page_sitemap_xml', path: '/sitemap.xml', title: 'XML Sitemap', type: 'seo', enabled: true },
  { id: 'page_feed', path: '/feed.xml', title: 'RSS Feed', type: 'seo', enabled: true },
];

function emptySettings() {
  return {
    globalHeaderHtml: '',
    globalFooterHtml: '',
    ga4MeasurementId: '',
    ga4Enabled: false,
    /** Numeric GA4 property id for Data API reports (admin traffic dashboard). Not the G- tag. */
    ga4PropertyId: '',
    /** GSC property URL, e.g. sc-domain:example.com or https://www.example.com/ */
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
    pages: DEFAULT_PAGES.map((p) => ({ ...p, headerHtml: '', footerHtml: '', bodyHtml: '' })),
    updatedAt: null,
  };
}

function loadJson(store, key, fallback) {
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function normalizePath(path) {
  const p = String(path || '/').split('?')[0].split('#')[0];
  if (!p || p === '') return '/';
  const trimmed = p.replace(/\/+$/, '');
  return trimmed || '/';
}

function mergePages(savedPages) {
  const byPath = new Map((savedPages || []).map((p) => [normalizePath(p.path), p]));
  const merged = DEFAULT_PAGES.map((def) => {
    const saved = byPath.get(normalizePath(def.path));
    return {
      ...def,
      headerHtml: saved?.headerHtml || '',
      footerHtml: saved?.footerHtml || '',
      bodyHtml: saved?.bodyHtml || '',
      enabled: saved?.enabled !== false,
      title: saved?.title || def.title,
      type: saved?.type || def.type,
      id: saved?.id || def.id,
    };
  });
  (savedPages || []).forEach((p) => {
    const path = normalizePath(p.path);
    if (!merged.some((m) => normalizePath(m.path) === path)) {
      merged.push({
        id: p.id || `page_${Date.now()}_${path.replace(/\W/g, '_')}`,
        path,
        title: p.title || path,
        type: p.type || 'custom',
        enabled: p.enabled !== false,
        headerHtml: p.headerHtml || '',
        footerHtml: p.footerHtml || '',
        bodyHtml: p.bodyHtml || '',
      });
    }
  });
  return merged;
}

function loadRawSettings(store) {
  const org = loadJson(store, STORE_KEY, null);
  if (org) return org;
  return loadJson(store, LEGACY_STORE_KEY, null);
}

function getSiteTrackingSettings(store) {
  const raw = loadRawSettings(store);
  const base = emptySettings();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    pages: mergePages(raw.pages),
  };
}

function saveSiteTrackingSettings(store, payload) {
  const current = getSiteTrackingSettings(store);
  const merged = { ...current, ...payload };
  if (merged.ga4MeasurementId?.trim()) merged.ga4Enabled = true;
  if (merged.gtmContainerId?.trim()) merged.gtmEnabled = true;
  const next = {
    ...merged,
    pages: mergePages(payload?.pages || current.pages),
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(next);
  store.setItem(STORE_KEY, serialized);
  store.setItem(LEGACY_STORE_KEY, serialized);
  return { success: true, settings: next };
}

function resolveGa4Id(settings) {
  const id = String(
    settings.ga4MeasurementId
    || process.env.PLATFORM_GA4_MEASUREMENT_ID
    || process.env.GA4_MEASUREMENT_ID
    || '',
  ).trim();
  if (!id) return '';
  if (settings.ga4Enabled === false) return '';
  return id;
}

function resolveGtmId(settings) {
  const id = String(
    settings.gtmContainerId
    || process.env.PLATFORM_GTM_CONTAINER_ID
    || process.env.GTM_CONTAINER_ID
    || '',
  ).trim();
  if (!id) return '';
  if (settings.gtmEnabled === false) return '';
  return id;
}

function findPageForPath(settings, pathname) {
  const path = normalizePath(pathname);
  const pages = (settings.pages || []).filter((p) => p.enabled !== false);
  const exact = pages.find((p) => normalizePath(p.path) === path);
  if (exact) return exact;
  return pages.find((p) => path.startsWith(normalizePath(p.path)) && normalizePath(p.path) !== '/')
    || pages.find((p) => normalizePath(p.path) === '/')
    || null;
}

/** Public-safe payload for unauthenticated site injection (no API secrets). */
function getPublicSiteTrackingPayload(settings, pathname = '/') {
  const page = findPageForPath(settings, pathname);
  return {
    path: normalizePath(pathname),
    page: page ? {
      path: page.path,
      title: page.title,
      headerHtml: page.headerHtml || '',
      footerHtml: page.footerHtml || '',
      bodyHtml: page.bodyHtml || '',
    } : null,
    globalHeaderHtml: settings.globalHeaderHtml || '',
    globalFooterHtml: settings.globalFooterHtml || '',
    ga4MeasurementId: resolveGa4Id(settings),
    gtmContainerId: resolveGtmId(settings),
    googleSearchConsoleVerification: settings.googleSearchConsoleVerification || '',
    bingWebmasterVerification: settings.bingWebmasterVerification || '',
    yahooSiteVerification: settings.yahooSiteVerification || '',
    facebookPixelId: settings.facebookPixelId || '',
    microsoftClarityId: settings.microsoftClarityId || '',
    hotjarSiteId: settings.hotjarSiteId || '',
    customHeadHtml: settings.customHeadHtml || '',
    customBodyHtml: settings.customBodyHtml || '',
    updatedAt: settings.updatedAt || null,
  };
}

function getSitePagesCatalog() {
  return DEFAULT_PAGES;
}

function summarizeTrackingPayload(payload) {
  if (!payload) return { active: false, fields: [] };
  const fields = [];
  if (payload.ga4MeasurementId) fields.push('ga4');
  if (payload.gtmContainerId) fields.push('gtm');
  if (payload.googleSearchConsoleVerification) fields.push('googleSearchConsole');
  if (payload.bingWebmasterVerification) fields.push('bing');
  if (payload.yahooSiteVerification) fields.push('yahoo');
  if (payload.facebookPixelId) fields.push('facebookPixel');
  if (payload.microsoftClarityId) fields.push('clarity');
  if (payload.hotjarSiteId) fields.push('hotjar');
  if (payload.customHeadHtml?.trim()) fields.push('customHeadHtml');
  if (payload.customBodyHtml?.trim()) fields.push('customBodyHtml');
  if (payload.globalHeaderHtml?.trim()) fields.push('globalHeaderHtml');
  if (payload.globalFooterHtml?.trim()) fields.push('globalFooterHtml');
  if (payload.page?.headerHtml?.trim()) fields.push('pageHeaderHtml');
  if (payload.page?.bodyHtml?.trim()) fields.push('pageBodyHtml');
  if (payload.page?.footerHtml?.trim()) fields.push('pageFooterHtml');
  return { active: fields.length > 0, fields, updatedAt: payload.updatedAt || null, path: payload.path };
}

module.exports = {
  STORE_KEY,
  LEGACY_STORE_KEY,
  DEFAULT_PAGES,
  emptySettings,
  getSiteTrackingSettings,
  saveSiteTrackingSettings,
  getPublicSiteTrackingPayload,
  getSitePagesCatalog,
  normalizePath,
  summarizeTrackingPayload,
};