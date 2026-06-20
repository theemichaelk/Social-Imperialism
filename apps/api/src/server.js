require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { prisma } = require('@si/db');
const { invoke, listChannels, syncProjectToStore, createPrismaStore } = require('@si/core');
const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/orgs');
const { requireAuth } = require('./middleware/auth');

// Load desktop .env for API keys
require('dotenv').config({ path: path.join(__dirname, '../../desktop/.env') });

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(cors({ origin: process.env.WEB_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '25mb' }));

app.get('/health', (req, res) => res.json({ ok: true, service: 'social-imperialism-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/orgs', requireAuth, orgRoutes);

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

app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl?.startsWith('data:')) return res.status(400).json({ error: 'Invalid data URL' });
    res.json({ success: true, dataUrl, filename });
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

app.listen(PORT, () => {
  console.log(`Social Imperialism API → http://localhost:${PORT}`);
});

module.exports = app;