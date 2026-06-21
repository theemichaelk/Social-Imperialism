require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { prisma } = require('@si/db');
const { invoke, listChannels, syncProjectToStore, createPrismaStore } = require('@si/core');
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

app.get('/health', (req, res) => res.json({ ok: true, service: 'social-imperialism-api', s3: s3.getS3Status() }));

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
    });
    res.json({ success: true, data: result });
  } catch (e) {
    if (e.code === 'UNKNOWN_CHANNEL') return res.status(404).json({ error: e.message });
    console.error(`invoke/${req.params.channel}:`, e.message);
    res.status(500).json({ error: e.message });
  }
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
    if (!p) throw new Error('Project not found');
    return p;
  }
  let project = await prisma.project.findFirst({ where: { organizationId: orgId, isActive: true } });
  if (!project) project = await prisma.project.findFirst({ where: { organizationId: orgId } });
  if (!project) throw new Error('No project — create one in Settings');
  return project;
}

const { startScheduler } = require('./scheduler');

app.listen(PORT, () => {
  console.log(`Social Imperialism API → http://localhost:${PORT}`);
  startScheduler();
});

module.exports = app;