/**
 * API-edge Sovereign Threat Capture — scan, contain, block before invoke reaches handlers.
 */
const {
  scanRequestSurface,
  captureThreatEvent,
  readContainment,
  PROTECTED_CHANNELS,
  SITE_DOMAIN,
} = require('@si/core/src/sovereignThreatCapture');
const { createPrismaStore } = require('@si/core');

const rateMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

function rateKey(req) {
  return `${req.ip || req.headers['x-forwarded-for'] || 'unknown'}:${req.user?.userId || 'anon'}`;
}

function checkRate(req) {
  const key = rateKey(req);
  const now = Date.now();
  let entry = rateMap.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateMap.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return { exceeded: true, count: entry.count };
  }
  return { exceeded: false, count: entry.count };
}

async function getProjectStore(req) {
  if (!req.user?.orgId) return null;
  const projectId = req.body?.projectId || req.headers['x-project-id'];
  if (!projectId) return null;
  try {
    return await createPrismaStore({ projectId, organizationId: req.user.orgId });
  } catch {
    return null;
  }
}

async function sovereignThreatShield(req, res, next) {
  try {
    const rate = checkRate(req);
    if (rate.exceeded) {
      return res.status(429).json({
        error: 'Rate limit exceeded — request contained by Sovereign Threat Capture',
        code: 'SOVEREIGN_CONTAINED',
        domain: SITE_DOMAIN,
      });
    }

    const hits = scanRequestSurface(req);
    if (hits.length > 0) {
      const worst = hits.sort((a, b) => (a.severity === 'critical' ? -1 : 1))[0];
      const store = await getProjectStore(req);
      if (store) {
        captureThreatEvent(store, {
          source: 'api_edge',
          surface: req.path,
          module: 'API Gateway',
          channel: req.params?.channel,
          severity: worst.severity,
          vector: worst.vector,
          summary: `Blocked ${worst.vector} probe on ${req.path}`,
          requestMeta: { path: req.path, method: req.method, ip: req.ip, userAgent: req.headers['user-agent'] },
          userContext: req.user || {},
          autoContain: worst.severity === 'critical' || worst.severity === 'high',
        });
      }
      return res.status(403).json({
        error: 'Request contained — Sovereign Threat Capture enforced',
        code: 'SOVEREIGN_THREAT_CAPTURED',
        severity: worst.severity,
      });
    }

    if (req.params?.channel) {
      const store = await getProjectStore(req);
      if (store) {
        const containment = readContainment(store);
        if (containment.liveFrozen && PROTECTED_CHANNELS.has(req.params.channel)) {
          return res.status(423).json({
            error: 'Live paths frozen — administrator kinetic verification required before this channel',
            code: 'SOVEREIGN_LIVE_FROZEN',
            adminIdentity: 'THEE_MICHAEL',
          });
        }
        if (containment.blockedChannels?.includes(req.params.channel)) {
          return res.status(423).json({
            error: 'Channel contained — threat isolation active',
            code: 'SOVEREIGN_CHANNEL_BLOCKED',
          });
        }
      }
    }

    next();
  } catch (e) {
    console.error('[sovereignThreatShield]', e.message);
    next();
  }
}

function sovereignAuthFailureCapture(req, reason) {
  const hits = scanRequestSurface(req);
  if (!hits.length && reason !== 'brute_force') return;
  console.warn(`[sovereign] auth failure captured: ${reason} ${req.path}`);
}

module.exports = { sovereignThreatShield, sovereignAuthFailureCapture, checkRate };