require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { prisma } = require('@si/db');
const { invoke, listChannels, syncProjectToStore, createPrismaStore, clearHandlerCache, eventBus } = require('@si/core');
const { getCircuitStatus } = require('@si/core/src/resilience');
const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/orgs');
const partnerRoutes = require('./routes/partner');
const { requireAuth } = require('./middleware/auth');
const s3 = require('./s3');

// Load desktop .env for API keys (local dev only — production uses App Runner env vars)
const desktopEnvPath = path.join(__dirname, '../../desktop/.env');
if (require('fs').existsSync(desktopEnvPath)) {
  require('dotenv').config({ path: desktopEnvPath });
}

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 4000;

function getAllowedOrigins() {
  const defaults = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const fromEnv = [
    process.env.WEB_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  ];
  return [...new Set([...defaults, ...fromEnv].filter(Boolean))];
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = getAllowedOrigins();
    if (allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));

app.get('/', (req, res) => res.json({ ok: true, service: 'social-imperialism-api', health: '/health', api: '/api' }));
app.get('/health', async (req, res) => {
  let db = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'ok';
  } catch (e) {
    db = 'error';
  }
  res.json({
    ok: db === 'ok',
    service: 'social-imperialism-api',
    db,
    s3: s3.getS3Status(),
    circuits: getCircuitStatus(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/oauth/setup', (req, res) => {
  try {
    const oauth = require(path.join(__dirname, '../../desktop/services/oauth'));
    const setup = require(path.join(__dirname, 'oauth-console-setup.json'));
    res.json({
      redirectUris: oauth.getOAuthRedirectUris(),
      primaryRedirect: oauth.getWebOAuthRedirect(),
      websiteUrl: process.env.WEB_URL || 'https://www.socialimperialism.com',
      platforms: setup.platforms,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/oauth/callback', async (req, res) => {
  try {
    const oauth = require(path.join(__dirname, '../../desktop/services/oauth'));
    const oauthFlowStore = require(path.join(__dirname, '../../desktop/services/oauthFlowStore'));
    const { resolveKeys } = require(path.join(__dirname, '../../desktop/services/keys'));
    const webBase = (process.env.WEB_URL || 'https://www.socialimperialism.com').replace(/\/$/, '');
    const qs = new URLSearchParams(req.query).toString();
    const callbackUrl = `${webBase}/oauth/callback${qs ? `?${qs}` : ''}`;
    const result = oauth.handleOAuthCallback(callbackUrl);

    if (result?.error) {
      if (result.state) await oauthFlowStore.markError(result.state, result.error);
      return res.status(400).type('html').send(oauth.oauthErrorHtml(result.error));
    }

    if (result?.state && result?.code) {
      const flow = await oauthFlowStore.getFlow(result.state);
      if (flow) {
        try {
          const project = await prisma.project.findUnique({
            where: { id: flow.projectId },
            include: { organization: true },
          });
          if (project) {
            const store = await createPrismaStore({ projectId: project.id, organizationId: project.organizationId });
            await syncProjectToStore(store, project.id);
            const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
            const tokens = await oauth.exchangeToken(
              flow.platform,
              result.code,
              keys,
              flow.pkceVerifier,
              flow.redirectUri,
            );
            await oauthFlowStore.markComplete(result.state, tokens);
          }
        } catch (e) {
          console.error('OAuth token exchange:', e.message);
          await oauthFlowStore.markError(result.state, e.message);
          return res.status(400).type('html').send(oauth.oauthErrorHtml(e.message));
        }
      }
    }

    const stateQs = result?.state ? `&state=${encodeURIComponent(result.state)}` : '';
    return res.redirect(302, `${webBase}/account-hub?oauth=success${stateQs}`);
  } catch (e) {
    console.error('OAuth callback:', e.message);
    res.status(500).type('text/plain').send('OAuth callback failed');
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/orgs', requireAuth, orgRoutes);
app.use('/api/v1', partnerRoutes);

app.get('/api/channels', requireAuth, async (req, res) => {
  try {
    const project = await getActiveProject(req.user.orgId, req.query.projectId);
    const channels = listChannels(project.id, req.user.orgId);
    res.json({ channels, count: channels.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/invoke/:channel', requireAuth, async (req, res) => {
  try {
    const project = await getActiveProject(req.user.orgId, req.body?.projectId || req.headers['x-project-id']);
    const args = Array.isArray(req.body?.args) ? req.body.args : (req.body?.arg != null ? [req.body.arg] : []);
    const result = await invoke({
      projectId: project.id,
      organizationId: req.user.orgId,
      channel: req.params.channel,
      args,
      userContext: {
        userId: req.user.userId,
        email: req.user.email,
        orgId: req.user.orgId,
      },
    });
    let data = result;
    let pendingOAuthUrl = null;
    if (data && typeof data === 'object' && data.pendingOAuthUrl) {
      pendingOAuthUrl = data.pendingOAuthUrl;
      const { pendingOAuthUrl: _po, ...rest } = data;
      data = rest;
    }
    res.json({ success: true, data: data ?? null, pendingOAuthUrl });
  } catch (e) {
    if (e.code === 'UNKNOWN_CHANNEL') return res.status(404).json({ error: e.message, code: e.code });
    const status = e.retryable ? 503 : 500;
    console.error(`invoke/${req.params.channel}:`, e.message);
    res.status(status).json({
      error: e.message,
      code: e.code || (e.retryable ? 'RETRYABLE' : 'FATAL'),
      retryable: !!e.retryable,
    });
  }
});

const sseClients = new Map();

eventBus.on('*', (event) => {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const [id, client] of sseClients) {
    if (client.orgId && event.organizationId && client.orgId !== event.organizationId) continue;
    if (client.projectId && event.projectId && client.projectId !== event.projectId) continue;
    try { client.res.write(payload); } catch (e) { sseClients.delete(id); }
  }
});

app.get('/api/events/stream', requireAuth, async (req, res) => {
  const project = await getActiveProject(req.user.orgId, req.headers['x-project-id']);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const id = `${req.user.orgId}:${project.id}:${Date.now()}`;
  sseClients.set(id, { res, orgId: req.user.orgId, projectId: project.id });
  res.write(`data: ${JSON.stringify({ type: 'connected', projectId: project.id, at: new Date().toISOString() })}\n\n`);

  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (e) { clearInterval(ping); sseClients.delete(id); }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    sseClients.delete(id);
  });
});

app.get('/api/s3/status', requireAuth, (req, res) => {
  res.json(s3.getS3Status());
});

app.get('/api/s3/uploads', requireAuth, async (req, res) => {
  try {
    const data = await s3.listUploads({
      prefix: req.query.prefix,
      limit: parseInt(req.query.limit, 10) || 100,
    });
    res.json({ success: true, ...data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { dataUrl, filename, folder, useS3 = true } = req.body;
    if (!dataUrl?.startsWith('data:')) return res.status(400).json({ error: 'Invalid data URL' });

    if (useS3 && s3.getS3Status().configured) {
      const uploaded = await s3.uploadDataUrl(dataUrl, filename, folder || 'media');
      return res.json({
        success: true,
        filename,
        dataUrl,
        s3: uploaded,
        url: uploaded.url,
        imageUrl: uploaded.url,
      });
    }

    res.json({ success: true, dataUrl, filename, s3: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function getActiveProject(orgId, projectId) {
  if (projectId) {
    const p = await prisma.project.findFirst({ where: { id: projectId, organizationId: orgId } });
    if (p) return p;
    console.warn(`Stale project id ${projectId} for org ${orgId} — using active project`);
  }
  let project = await prisma.project.findFirst({ where: { organizationId: orgId, isActive: true } });
  if (!project) project = await prisma.project.findFirst({ where: { organizationId: orgId } });
  if (!project) throw new Error('No project — create one in Settings');
  return project;
}

const { startScheduler } = require('./scheduler');
const { startJobRunner } = require('@si/core/src/jobRunner');

app.listen(PORT, () => {
  console.log(`Social Imperialism API → http://localhost:${PORT}`);
  startScheduler();
  startJobRunner();
});

module.exports = app;