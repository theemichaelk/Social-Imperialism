/**
 * Site pages, header/footer HTML snippets, GA4, and search-console verification.
 */
const STORE_KEY = 'siteTrackingSettings';

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
];

function emptySettings() {
  return {
    globalHeaderHtml: '',
    globalFooterHtml: '',
    ga4MeasurementId: '',
    ga4Enabled: false,
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

function getSiteTrackingSettings(store) {
  const raw = loadJson(store, STORE_KEY, null);
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
  const next = {
    ...current,
    ...payload,
    pages: mergePages(payload?.pages || current.pages),
    updatedAt: new Date().toISOString(),
  };
  store.setItem(STORE_KEY, JSON.stringify(next));
  return { success: true, settings: next };
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
    ga4MeasurementId: settings.ga4Enabled && settings.ga4MeasurementId ? settings.ga4MeasurementId : '',
    gtmContainerId: settings.gtmEnabled && settings.gtmContainerId ? settings.gtmContainerId : '',
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

module.exports = {
  STORE_KEY,
  DEFAULT_PAGES,
  emptySettings,
  getSiteTrackingSettings,
  saveSiteTrackingSettings,
  getPublicSiteTrackingPayload,
  getSitePagesCatalog,
  normalizePath,
};