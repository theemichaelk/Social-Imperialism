const express = require('express');
const { prisma } = require('@si/db');

const router = express.Router();
const SETTING_KEY = 'mobileDeviceTokens';

async function loadTokens(orgId) {
  const row = await prisma.orgSetting.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: SETTING_KEY } },
  });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveTokens(orgId, tokens) {
  const trimmed = tokens.slice(0, 50);
  await prisma.orgSetting.upsert({
    where: { organizationId_key: { organizationId: orgId, key: SETTING_KEY } },
    update: { value: JSON.stringify(trimmed) },
    create: { organizationId: orgId, key: SETTING_KEY, value: JSON.stringify(trimmed) },
  });
  return trimmed;
}

/** POST /api/mobile/device-token — register Expo push token */
router.post('/device-token', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token || token.length < 10) {
      return res.status(400).json({ error: 'Valid push token required.' });
    }
    const platform = String(req.body?.platform || 'unknown').slice(0, 32);
    const appVersion = String(req.body?.appVersion || '').slice(0, 32);
    const list = await loadTokens(req.user.orgId);
    const next = list.filter((t) => t.token !== token);
    next.unshift({
      token,
      platform,
      appVersion,
      userId: req.user.userId,
      updatedAt: new Date().toISOString(),
    });
    await saveTokens(req.user.orgId, next);
    res.json({ success: true, count: next.length });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to register device token' });
  }
});

/** DELETE /api/mobile/device-token — unregister */
router.delete('/device-token', async (req, res) => {
  try {
    const token = String(req.body?.token || req.query?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    const list = await loadTokens(req.user.orgId);
    const next = list.filter((t) => t.token !== token);
    await saveTokens(req.user.orgId, next);
    res.json({ success: true, count: next.length });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to unregister device token' });
  }
});

/** GET /api/mobile/device-tokens — list for org (self) */
router.get('/device-tokens', async (req, res) => {
  try {
    const list = await loadTokens(req.user.orgId);
    const mine = list.filter((t) => t.userId === req.user.userId);
    res.json({
      tokens: mine.map((t) => ({
        platform: t.platform,
        appVersion: t.appVersion,
        updatedAt: t.updatedAt,
        // never echo full token in list responses for safety
        tokenHint: t.token ? `${t.token.slice(0, 12)}…` : null,
      })),
      count: mine.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/mobile/notify — send Expo push to org devices (best-effort)
 * Body: { title, body, data?, tokens? }
 */
router.post('/notify', async (req, res) => {
  try {
    const title = String(req.body?.title || 'Social Imperialism').slice(0, 120);
    const body = String(req.body?.body || '').slice(0, 400);
    if (!body) return res.status(400).json({ error: 'body required' });

    let tokens = Array.isArray(req.body?.tokens) ? req.body.tokens.filter(Boolean) : null;
    if (!tokens) {
      const list = await loadTokens(req.user.orgId);
      tokens = list.map((t) => t.token).filter(Boolean);
    }
    if (!tokens.length) {
      return res.json({ success: true, sent: 0, message: 'No device tokens registered' });
    }

    const messages = tokens.slice(0, 50).map((to) => ({
      to,
      sound: 'default',
      title,
      body,
      data: req.body?.data && typeof req.body.data === 'object' ? req.body.data : {},
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const json = await expoRes.json().catch(() => ({}));
    res.json({
      success: expoRes.ok,
      sent: messages.length,
      expo: json,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Notify failed' });
  }
});

module.exports = router;
