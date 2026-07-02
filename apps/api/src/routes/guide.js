const express = require('express');
const { prisma } = require('@si/db');
const { isAdminEmail } = require('../subscriptionAccess');
const { planGuideActions, planFromViewId, GUIDE_VIEWS } = require('../guide/guide_actions');

const router = express.Router();

/** email → { id, actions, reply, pushedAt, pushedBy } */
const remoteQueue = new Map();
const QUEUE_TTL_MS = 10 * 60 * 1000;

function purgeStale() {
  const now = Date.now();
  for (const [email, entry] of remoteQueue) {
    if (now - entry.pushedAt > QUEUE_TTL_MS) remoteQueue.delete(email);
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

router.post('/actions/plan', (req, res) => {
  try {
    const { query, pathname } = req.body || {};
    const planned = planGuideActions(String(query || ''), { pathname });
    res.json({
      success: true,
      query,
      actions: planned.actions,
      reply: planned.reply,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/views', (_req, res) => {
  res.json({
    views: GUIDE_VIEWS.map((v) => ({ id: v.id, label: v.label, href: v.href })),
  });
});

router.get('/remote/poll', (req, res) => {
  purgeStale();
  const email = normalizeEmail(req.user?.email);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  const entry = remoteQueue.get(email);
  if (!entry) {
    return res.json({ success: true, pending: false, actions: [], reply: null });
  }

  remoteQueue.delete(email);
  res.json({
    success: true,
    pending: true,
    id: entry.id,
    actions: entry.actions,
    reply: entry.reply,
    pushedAt: entry.pushedAt,
    pushedBy: entry.pushedBy,
  });
});

function requirePlatformAdmin(req, res, next) {
  if (!isAdminEmail(req.user?.email)) {
    return res.status(403).json({ error: 'Platform administrator access required.' });
  }
  next();
}

router.post('/remote/push', requirePlatformAdmin, async (req, res) => {
  try {
    purgeStale();
    const { email, query, viewId, href } = req.body || {};
    const targetEmail = normalizeEmail(email);
    if (!targetEmail) return res.status(400).json({ error: 'email is required' });

    const user = await prisma.user.findFirst({
      where: { email: { equals: targetEmail, mode: 'insensitive' } },
      select: { id: true, email: true },
    });
    if (!user) return res.status(404).json({ error: `No user found for ${targetEmail}` });

    let planned;
    if (viewId) {
      planned = planFromViewId(viewId);
    } else if (href) {
      planned = {
        actions: [
          { type: 'navigate', href: String(href), label: 'Admin redirect', autoExecute: true },
          { type: 'flash_screen' },
        ],
        reply: `Admin pushed redirect to ${href}`,
      };
    } else if (query) {
      planned = planGuideActions(String(query), {});
    } else {
      return res.status(400).json({ error: 'Provide viewId, href, or query' });
    }

    const entry = {
      id: `gr_${Date.now()}`,
      actions: planned.actions,
      reply: planned.reply,
      pushedAt: Date.now(),
      pushedBy: req.user.email,
    };
    remoteQueue.set(user.email.toLowerCase(), entry);

    res.json({
      success: true,
      targetEmail: user.email,
      id: entry.id,
      actionCount: entry.actions.length,
      reply: entry.reply,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;