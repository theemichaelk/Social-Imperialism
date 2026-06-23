const { prisma } = require('@si/db');
const { invoke } = require('@si/core');

const rateBuckets = new Map();

function checkRateLimit(projectId, limit = 1000) {
  const hourKey = `${projectId}:${Math.floor(Date.now() / 3600000)}`;
  const count = (rateBuckets.get(hourKey) || 0) + 1;
  rateBuckets.set(hourKey, count);
  if (rateBuckets.size > 5000) {
    const cutoff = Math.floor(Date.now() / 3600000) - 2;
    for (const k of rateBuckets.keys()) {
      if (k.endsWith(`:${cutoff}`) || k.endsWith(`:${cutoff - 1}`)) rateBuckets.delete(k);
    }
  }
  return { allowed: count <= limit, count, limit };
}

async function resolvePartnerKey(apiKey) {
  if (!apiKey?.startsWith('si_live_')) return null;
  const settings = await prisma.projectSetting.findMany({
    where: { key: 'partnerApiKey' },
    include: { project: { include: { organization: true } } },
  });
  for (const s of settings) {
    if (s.value === apiKey) {
      return {
        projectId: s.projectId,
        organizationId: s.project.organizationId,
        project: s.project,
      };
    }
  }
  return null;
}

async function syncPartnerKeyToPrisma(projectId, organizationId, apiKey) {
  if (!apiKey) return;
  await prisma.projectSetting.upsert({
    where: { projectId_key: { projectId, key: 'partnerApiKey' } },
    create: { projectId, key: 'partnerApiKey', value: apiKey },
    update: { value: apiKey },
  });
}

function requirePartnerAuth(req, res, next) {
  const apiKey = req.headers['x-si-api-key'] || req.query.api_key;
  if (!apiKey) return res.status(401).json({ error: 'Missing X-SI-API-Key header' });
  resolvePartnerKey(apiKey)
    .then(async (ctx) => {
      if (!ctx) return res.status(403).json({ error: 'Invalid partner API key' });

      let limit = 1000;
      try {
        const cfg = await invoke({
          projectId: ctx.projectId,
          organizationId: ctx.organizationId,
          channel: 'get-partner-integration-config',
          args: [],
        });
        if (cfg?.rateLimitPerHour) limit = cfg.rateLimitPerHour;
      } catch (e) { /* use default */ }

      const { allowed, count } = checkRateLimit(ctx.projectId, limit);
      if (!allowed) {
        return res.status(429).json({
          error: 'Partner API rate limit exceeded',
          limit,
          count,
          retryAfter: 3600,
        });
      }

      req.partner = ctx;
      req.user = { orgId: ctx.organizationId, projectId: ctx.projectId };
      invoke({
        projectId: ctx.projectId,
        organizationId: ctx.organizationId,
        channel: 'verify-partner-api-key',
        args: [apiKey],
      }).catch(() => {});
      next();
    })
    .catch((e) => res.status(500).json({ error: e.message }));
}

module.exports = { requirePartnerAuth, resolvePartnerKey, syncPartnerKeyToPrisma, checkRateLimit };