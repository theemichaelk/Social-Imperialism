/**
 * SaaS in-app + webhook notifications (Be First, Q&A, worker alerts).
 */
const axios = require('axios');

function loadNotifications(store) {
  try { return JSON.parse(store.getItem('appNotifications') || '[]'); } catch (e) { return []; }
}

function getNotificationSettings(store) {
  let settings = {
    email: '', slackWebhook: '', discordWebhook: '',
    qaFreq: 'daily', beFirstFreq: 'hourly', minViews: 500,
    enabled: true,
  };
  try { settings = { ...settings, ...JSON.parse(store.getItem('notificationSettings') || '{}') }; } catch (e) { /* ignore */ }
  return settings;
}

function saveNotificationSettings(store, settings) {
  store.setItem('notificationSettings', JSON.stringify(settings || {}));
  return { success: true };
}

async function dispatchWebhooks(settings, payload, store) {
  const body = { text: payload.title, ...payload };
  const hooks = [settings.slackWebhook, settings.discordWebhook, settings.emailWebhook].filter(Boolean);
  for (const url of hooks) {
    try {
      await axios.post(url, settings.discordWebhook === url
        ? { content: `**${payload.title}**\n${payload.body || ''}` }
        : body, { timeout: 8000 });
    } catch (e) {
      console.warn('Webhook notification failed:', e.message);
    }
  }
  const email = (settings.email || '').trim();
  if (email && email.includes('@') && !email.startsWith('http')) {
    const emailHook = settings.emailWebhook || process.env.ALERT_EMAIL_WEBHOOK;
    if (emailHook) {
      try {
        await axios.post(emailHook, {
          to: email,
          subject: payload.title,
          body: payload.body || '',
          ...payload,
        }, { timeout: 8000 });
      } catch (e) {
        console.warn('Email webhook notification failed:', e.message);
      }
    } else if (store) {
      try {
        const { resolveKeys } = require('./keys');
        const emailService = require('./emailService');
        const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
        await emailService.sendEmail(keys, {
          to: email,
          subject: payload.title,
          html: `<p>${(payload.body || '').replace(/\n/g, '<br>')}</p>`,
          text: payload.body || '',
          shortenLinks: false,
        });
      } catch (e) {
        console.warn('Native email notification failed:', e.message);
      }
    }
  }
}

function sendNotification(store, payload = {}) {
  const settings = getNotificationSettings(store);
  if (settings.enabled === false) return { queued: false };

  const entry = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: payload.type || 'info',
    title: payload.title || 'Social Imperialism',
    body: payload.body || '',
    link: payload.link || null,
    at: new Date().toISOString(),
    read: false,
  };

  const list = loadNotifications(store);
  list.unshift(entry);
  store.setItem('appNotifications', JSON.stringify(list.slice(0, 200)));

  dispatchWebhooks(settings, entry, store).catch(() => {});

  return { queued: true, id: entry.id };
}

function getNotifications(store, limit = 50) {
  return loadNotifications(store).slice(0, limit);
}

function markNotificationRead(store, id) {
  const list = loadNotifications(store).map((n) => (n.id === id ? { ...n, read: true } : n));
  store.setItem('appNotifications', JSON.stringify(list));
  return { success: true };
}

module.exports = {
  sendNotification,
  getNotifications,
  getNotificationSettings,
  saveNotificationSettings,
  markNotificationRead,
};