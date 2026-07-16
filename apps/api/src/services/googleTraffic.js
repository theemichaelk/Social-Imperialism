/**
 * Platform GSC + GA4 traffic for administrators.
 * Uses a Google Cloud service account (JWT) — no googleapis package required.
 *
 * Env (preferred for platform site socialimperialism.com):
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full JSON string or path to .json key file
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  — client_email (if not using full JSON)
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY — PEM with \n escapes
 *   GSC_SITE_URL                  — e.g. sc-domain:socialimperialism.com or https://www.socialimperialism.com/
 *   GA4_PROPERTY_ID               — numeric property id (not G-XXXXXXXX)
 *   GA4_MEASUREMENT_ID            — optional G- id for display
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/analytics.readonly',
];

let tokenCache = { accessToken: null, exp: 0 };
let reportCache = { key: '', at: 0, payload: null };
const REPORT_TTL_MS = 10 * 60 * 1000;

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input));
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function normalizePrivateKey(raw) {
  if (!raw) return '';
  let key = String(raw).trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function loadServiceAccount() {
  const jsonEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonEnv) {
    try {
      const trimmed = jsonEnv.trim();
      if (trimmed.startsWith('{')) {
        const sa = JSON.parse(trimmed);
        return {
          clientEmail: sa.client_email,
          privateKey: normalizePrivateKey(sa.private_key),
          projectId: sa.project_id || null,
        };
      }
      // Path to key file
      const filePath = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
      if (fs.existsSync(filePath)) {
        const sa = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
          clientEmail: sa.client_email,
          privateKey: normalizePrivateKey(sa.private_key),
          projectId: sa.project_id || null,
        };
      }
    } catch (e) {
      console.warn('[googleTraffic] GOOGLE_SERVICE_ACCOUNT_JSON parse:', e.message);
    }
  }

  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credsPath && fs.existsSync(credsPath)) {
    try {
      const sa = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
      return {
        clientEmail: sa.client_email,
        privateKey: normalizePrivateKey(sa.private_key),
        projectId: sa.project_id || null,
      };
    } catch (e) {
      console.warn('[googleTraffic] GOOGLE_APPLICATION_CREDENTIALS:', e.message);
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GSC_CLIENT_EMAIL || '';
  const privateKey = normalizePrivateKey(
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY || '',
  );
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey, projectId: process.env.GOOGLE_CLOUD_PROJECT || null };
  }
  return null;
}

function httpsJson(method, url, { headers = {}, body = null, timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { raw: text };
          }
          if (res.statusCode >= 400) {
            const err = new Error(json.error?.message || json.error_description || json.error || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.body = json;
            return reject(err);
          }
          resolve(json);
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function createJwt(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'RS256', typ: 'JWT' });
  const claim = b64url({
    iss: clientEmail,
    scope: SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  });
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

async function getAccessToken(force = false) {
  if (!force && tokenCache.accessToken && Date.now() < tokenCache.exp - 60_000) {
    return tokenCache.accessToken;
  }
  const sa = loadServiceAccount();
  if (!sa?.clientEmail || !sa?.privateKey) {
    const err = new Error('Google service account not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (or EMAIL + PRIVATE_KEY).');
    err.code = 'MISSING_CREDENTIALS';
    throw err;
  }
  const assertion = createJwt(sa.clientEmail, sa.privateKey);
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();

  const tokenJson = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(form),
        },
        timeout: 20000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (res.statusCode >= 400) {
              reject(new Error(json.error_description || json.error || `Token HTTP ${res.statusCode}`));
            } else resolve(json);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(form);
    req.end();
  });

  tokenCache = {
    accessToken: tokenJson.access_token,
    exp: Date.now() + (Number(tokenJson.expires_in || 3600) * 1000),
  };
  return tokenCache.accessToken;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultDateRange(days = 28) {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  // GSC data is delayed ~2 days — end yesterday for reliability
  end.setUTCDate(end.getUTCDate() - 1);
  return { startDate: isoDate(start), endDate: isoDate(end), days };
}

function resolveConfig(overrides = {}) {
  const siteUrl = String(
    overrides.gscSiteUrl
    || process.env.GSC_SITE_URL
    || process.env.GOOGLE_SEARCH_CONSOLE_SITE
    || 'sc-domain:socialimperialism.com',
  ).trim();
  const propertyId = String(
    overrides.ga4PropertyId
    || process.env.GA4_PROPERTY_ID
    || process.env.GOOGLE_ANALYTICS_PROPERTY_ID
    || '',
  ).replace(/^properties\//, '').trim();
  const measurementId = String(
    overrides.ga4MeasurementId
    || process.env.GA4_MEASUREMENT_ID
    || process.env.NEXT_PUBLIC_GA4_ID
    || '',
  ).trim();
  const sa = loadServiceAccount();
  return {
    gscSiteUrl: siteUrl,
    ga4PropertyId: propertyId,
    ga4MeasurementId: measurementId,
    hasServiceAccount: !!(sa?.clientEmail && sa?.privateKey),
    serviceAccountEmail: sa?.clientEmail || null,
    projectId: sa?.projectId || null,
  };
}

function getConfigStatus(overrides = {}) {
  const cfg = resolveConfig(overrides);
  const issues = [];
  if (!cfg.hasServiceAccount) {
    issues.push('Missing Google service account (GOOGLE_SERVICE_ACCOUNT_JSON or EMAIL + PRIVATE_KEY).');
  }
  if (!cfg.gscSiteUrl) issues.push('Missing GSC_SITE_URL (e.g. sc-domain:socialimperialism.com).');
  if (!cfg.ga4PropertyId) {
    issues.push('Missing GA4_PROPERTY_ID (numeric property id from GA4 Admin → Property Settings — not the G- measurement id).');
  }
  return {
    configured: cfg.hasServiceAccount && !!(cfg.gscSiteUrl || cfg.ga4PropertyId),
    ready: cfg.hasServiceAccount && !!(cfg.gscSiteUrl && cfg.ga4PropertyId),
    issues,
    gscSiteUrl: cfg.gscSiteUrl || null,
    ga4PropertyId: cfg.ga4PropertyId ? `properties/${cfg.ga4PropertyId}` : null,
    ga4MeasurementId: cfg.ga4MeasurementId || null,
    serviceAccountEmail: cfg.serviceAccountEmail,
    scopes: SCOPES,
    tips: [
      'Share the GSC property with the service account email as a Full user.',
      'Add the service account as a Viewer on the GA4 property.',
      'Use the numeric GA4 property ID, not the G-XXXXXXXX measurement ID.',
    ],
  };
}

async function fetchGscSearchAnalytics(accessToken, siteUrl, { startDate, endDate, rowLimit = 25 } = {}) {
  const encoded = encodeURIComponent(siteUrl);
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`;

  const [byQuery, byPage, byDate, byCountry] = await Promise.all([
    httpsJson('POST', base, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        startDate, endDate, dimensions: ['query'], rowLimit, startRow: 0,
      },
    }).catch((e) => ({ error: e.message, rows: [] })),
    httpsJson('POST', base, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        startDate, endDate, dimensions: ['page'], rowLimit, startRow: 0,
      },
    }).catch((e) => ({ error: e.message, rows: [] })),
    httpsJson('POST', base, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        startDate, endDate, dimensions: ['date'], rowLimit: 90, startRow: 0,
      },
    }).catch((e) => ({ error: e.message, rows: [] })),
    httpsJson('POST', base, {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        startDate, endDate, dimensions: ['country'], rowLimit: 15, startRow: 0,
      },
    }).catch((e) => ({ error: e.message, rows: [] })),
  ]);

  const mapRows = (res, dim) => {
    if (res.error && !res.rows) return { error: res.error, rows: [] };
    return {
      error: null,
      rows: (res.rows || []).map((r) => ({
        [dim]: r.keys?.[0] || '',
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      })),
    };
  };

  const queries = mapRows(byQuery, 'query');
  const pages = mapRows(byPage, 'page');
  const dates = mapRows(byDate, 'date');
  const countries = mapRows(byCountry, 'country');

  const totals = (queries.rows || []).reduce(
    (acc, r) => {
      acc.clicks += r.clicks || 0;
      acc.impressions += r.impressions || 0;
      return acc;
    },
    { clicks: 0, impressions: 0 },
  );
  // Prefer date series totals when available
  if (dates.rows?.length) {
    totals.clicks = dates.rows.reduce((a, r) => a + (r.clicks || 0), 0);
    totals.impressions = dates.rows.reduce((a, r) => a + (r.impressions || 0), 0);
  }

  const errors = [queries, pages, dates, countries]
    .map((x) => x.error)
    .filter(Boolean);

  return {
    success: !errors.length || (queries.rows?.length || pages.rows?.length || dates.rows?.length),
    siteUrl,
    startDate,
    endDate,
    totals: {
      clicks: Math.round(totals.clicks),
      impressions: Math.round(totals.impressions),
      ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    },
    topQueries: queries.rows.slice(0, rowLimit),
    topPages: pages.rows.slice(0, rowLimit),
    byDate: dates.rows.sort((a, b) => String(a.date).localeCompare(String(b.date))),
    topCountries: countries.rows.slice(0, 10),
    errors: errors.length ? errors : undefined,
  };
}

async function fetchGa4Report(accessToken, propertyId, { startDate, endDate } = {}) {
  const prop = String(propertyId).replace(/^properties\//, '');
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${prop}:runReport`;
  const auth = { Authorization: `Bearer ${accessToken}` };

  const [overview, byDate, bySource, byPage, byDevice] = await Promise.all([
    httpsJson('POST', url, {
      headers: auth,
      body: {
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      },
    }).catch((e) => ({ error: e.message })),
    httpsJson('POST', url, {
      headers: auth,
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
        limit: 90,
      },
    }).catch((e) => ({ error: e.message })),
    httpsJson('POST', url, {
      headers: auth,
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 12,
      },
    }).catch((e) => ({ error: e.message })),
    httpsJson('POST', url, {
      headers: auth,
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 15,
      },
    }).catch((e) => ({ error: e.message })),
    httpsJson('POST', url, {
      headers: auth,
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 6,
      },
    }).catch((e) => ({ error: e.message })),
  ]);

  const metricMap = (report) => {
    if (report?.error) return { error: report.error };
    const names = (report.metricHeaders || []).map((h) => h.name);
    const values = report.rows?.[0]?.metricValues || [];
    const out = {};
    names.forEach((n, i) => {
      out[n] = Number(values[i]?.value || 0);
    });
    return out;
  };

  const dimRows = (report, dimKey, metrics) => {
    if (report?.error) return { error: report.error, rows: [] };
    const metricNames = (report.metricHeaders || []).map((h) => h.name);
    return {
      rows: (report.rows || []).map((r) => {
        const row = { [dimKey]: r.dimensionValues?.[0]?.value || '' };
        metrics.forEach((m, i) => {
          const idx = metricNames.indexOf(m);
          row[m] = Number(r.metricValues?.[idx >= 0 ? idx : i]?.value || 0);
        });
        return row;
      }),
    };
  };

  const totals = metricMap(overview);
  const series = dimRows(byDate, 'date', ['activeUsers', 'sessions', 'screenPageViews']);
  // GA4 returns date as YYYYMMDD
  series.rows = (series.rows || []).map((r) => ({
    ...r,
    date: r.date && r.date.length === 8
      ? `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`
      : r.date,
  })).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const sources = dimRows(bySource, 'channel', ['sessions', 'activeUsers']);
  const pages = dimRows(byPage, 'pagePath', ['screenPageViews', 'activeUsers']);
  const devices = dimRows(byDevice, 'device', ['sessions', 'activeUsers']);

  const errors = [overview, byDate, bySource, byPage, byDevice]
    .map((x) => x?.error)
    .filter(Boolean);

  return {
    success: !totals.error,
    propertyId: `properties/${prop}`,
    startDate,
    endDate,
    totals: {
      activeUsers: totals.activeUsers || 0,
      sessions: totals.sessions || 0,
      pageViews: totals.screenPageViews || 0,
      engagementRate: totals.engagementRate || 0,
      avgSessionDuration: totals.averageSessionDuration || 0,
      bounceRate: totals.bounceRate || 0,
    },
    byDate: series.rows || [],
    channels: sources.rows || [],
    topPages: pages.rows || [],
    devices: devices.rows || [],
    errors: errors.length ? errors : undefined,
  };
}

/**
 * Full admin traffic snapshot (GSC + GA4).
 * @param {{ days?: number, forceRefresh?: boolean, gscSiteUrl?: string, ga4PropertyId?: string }} opts
 */
async function getAdminTrafficSnapshot(opts = {}) {
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 28, 7), 90);
  const range = defaultDateRange(days);
  const cfg = resolveConfig(opts);
  const cacheKey = `${cfg.gscSiteUrl}|${cfg.ga4PropertyId}|${range.startDate}|${range.endDate}`;

  if (!opts.forceRefresh && reportCache.payload && reportCache.key === cacheKey && Date.now() - reportCache.at < REPORT_TTL_MS) {
    return { ...reportCache.payload, fromCache: true };
  }

  const status = getConfigStatus(opts);
  if (!status.configured) {
    return {
      success: false,
      configured: false,
      status,
      range,
      gsc: null,
      ga4: null,
      generatedAt: new Date().toISOString(),
      error: status.issues.join(' '),
    };
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(!!opts.forceRefresh);
  } catch (e) {
    return {
      success: false,
      configured: true,
      status,
      range,
      gsc: null,
      ga4: null,
      generatedAt: new Date().toISOString(),
      error: e.message,
      code: e.code || 'AUTH_FAILED',
    };
  }

  const [gsc, ga4] = await Promise.all([
    cfg.gscSiteUrl
      ? fetchGscSearchAnalytics(accessToken, cfg.gscSiteUrl, range).catch((e) => ({
        success: false,
        error: e.message,
        siteUrl: cfg.gscSiteUrl,
      }))
      : Promise.resolve({ success: false, error: 'GSC site URL not set', siteUrl: null }),
    cfg.ga4PropertyId
      ? fetchGa4Report(accessToken, cfg.ga4PropertyId, range).catch((e) => ({
        success: false,
        error: e.message,
        propertyId: cfg.ga4PropertyId,
      }))
      : Promise.resolve({ success: false, error: 'GA4 property id not set', propertyId: null }),
  ]);

  const payload = {
    success: !!(gsc?.success || ga4?.success),
    configured: true,
    fromCache: false,
    status,
    range: { ...range, days },
    measurementId: cfg.ga4MeasurementId || null,
    gsc,
    ga4,
    generatedAt: new Date().toISOString(),
  };

  if (payload.success) {
    reportCache = { key: cacheKey, at: Date.now(), payload };
  }
  return payload;
}

function clearTrafficCache() {
  reportCache = { key: '', at: 0, payload: null };
  tokenCache = { accessToken: null, exp: 0 };
}

module.exports = {
  getAdminTrafficSnapshot,
  getConfigStatus,
  resolveConfig,
  clearTrafficCache,
  loadServiceAccount,
};
