const express = require('express');
const { invoke } = require('@si/core');
const { requirePartnerAuth } = require('../middleware/partnerAuth');
const { prisma } = require('@si/db');

const router = express.Router();

const ALLOWED_CHANNELS = new Set([
  'check-api-status', 'get-live-news', 'get-trending-topics', 'search-stock-photo',
  'serp-search', 'get-domain-metrics', 'research-keyword', 'shorten-url',
  'deepl-translate', 'get-youtube-channels', 'get-settings-status',
  'get-active-campaign', 'get-engagement-queue', 'get-automation-status',
  'get-partner-api-catalog', 'test-all-connections', 'run-live-connection-audit',
  'test-email-connections', 'test-payment-connections',
]);

router.get('/docs', (req, res) => {
  res.json({
    name: 'Social Imperialism Partner API',
    version: '1.0',
    auth: { header: 'X-SI-API-Key', format: 'si_live_<hex>' },
    endpoints: [
      { method: 'GET', path: '/api/v1/status', auth: true },
      { method: 'GET', path: '/api/v1/docs', auth: false },
      { method: 'POST', path: '/api/v1/invoke/:channel', auth: true, body: { args: 'array' } },
      { method: 'POST', path: '/api/v1/hooks/:webhookId', auth: false, body: { event: 'string', data: 'object' } },
    ],
    channels: [...ALLOWED_CHANNELS],
  });
});

router.get('/status', requirePartnerAuth, async (req, res) => {
  try {
    const [status, settingsStatus] = await Promise.all([
      invoke({ projectId: req.partner.projectId, organizationId: req.partner.organizationId, channel: 'check-api-status', args: [] }),
      invoke({ projectId: req.partner.projectId, organizationId: req.partner.organizationId, channel: 'get-settings-status', args: [] }),
    ]);
    const connected = Object.values(status || {}).filter((v) => v === 'Connected').length;
    res.json({
      ok: true,
      connected,
      total: Object.keys(status || {}).length,
      apiMetrics: status,
      campaignCount: settingsStatus?.campaignCount,
      activeCampaignId: settingsStatus?.activeCampaignId,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/invoke/:channel', requirePartnerAuth, async (req, res) => {
  const channel = req.params.channel;
  if (!ALLOWED_CHANNELS.has(channel)) {
    return res.status(403).json({ error: `Channel not allowed: ${channel}` });
  }
  try {
    const args = Array.isArray(req.body?.args) ? req.body.args : [];
    const data = await invoke({
      projectId: req.partner.projectId,
      organizationId: req.partner.organizationId,
      channel,
      args,
    });
    res.json({ success: true, data });
  } catch (e) {
    if (e.code === 'UNKNOWN_CHANNEL') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

router.post('/hooks/:webhookId', async (req, res) => {
  const { webhookId } = req.params;
  const secret = req.headers['x-si-webhook-secret'] || req.body?.secret;
  try {
    const mappings = await prisma.projectSetting.findMany({
      where: { key: 'inboundWebhookId', value: webhookId },
      include: { project: { include: { organization: true } } },
    });
    if (!mappings.length) return res.status(404).json({ error: 'Webhook not found' });

    const mapping = mappings[0];
    const secretSetting = await prisma.projectSetting.findUnique({
      where: { projectId_key: { projectId: mapping.projectId, key: 'inboundWebhookSecret' } },
    });
    if (process.env.NODE_ENV === 'production' && !secretSetting?.value) {
      return res.status(401).json({ error: 'Webhook secret required in production' });
    }
    if (secretSetting?.value && secret !== secretSetting.value) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const payload = {
      event: req.body?.event || 'webhook.inbound',
      source: req.body?.source || req.headers['user-agent'] || 'external',
      data: req.body?.data || req.body,
      headers: { 'content-type': req.headers['content-type'] },
    };

    const result = await invoke({
      projectId: mapping.projectId,
      organizationId: mapping.project.organizationId,
      channel: 'receive-partner-webhook',
      args: [payload],
    });

    res.json({ success: true, received: true, eventId: result?.eventId });
  } catch (e) {
    console.error('inbound webhook:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;