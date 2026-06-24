/**
 * Settings IPC — billing, tutorials, campaign status.
 * Registered at app startup so handlers are always available (reload HTML does not reload main).
 */

const PLAN_CATALOG = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 49,
    priceLabel: '$49/mo',
    accounts: 3,
    aiGenerations: 500,
    crisisMonitoring: false,
    features: ['3 Social Accounts', 'Basic AI Replies', '500 AI Generations/mo', 'Content Calendar', 'Keyword Tracking'],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 149,
    priceLabel: '$149/mo',
    accounts: 15,
    aiGenerations: 5000,
    crisisMonitoring: false,
    features: ['15 Social Accounts', 'Spam & Bot Filtering', 'Advanced Analytics', 'Reddit Prospector', 'Visual Automations', 'Auto-Rules Engine'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    priceLabel: 'Custom',
    accounts: 999,
    aiGenerations: 999999,
    crisisMonitoring: true,
    features: ['Unlimited Accounts', '24/7 Crisis Monitoring', 'Dedicated Account Manager', 'Custom Industry Routing', 'SLA & Priority Support'],
  },
};

const SETUP_TUTORIALS = [
  { id: 'tut_01', category: 'getting-started', title: 'Create Your First Campaign', duration: '5 min', icon: 'fa-layer-group', color: '#38bdf8', page: 'settings.html', steps: ['Click + New Campaign in Settings', 'Enter brand name, domain, and tone of voice', 'Save — the campaign becomes your active brand profile', 'Switch campaigns anytime from the sidebar dropdown'] },
  { id: 'tut_02', category: 'getting-started', title: 'Connect Global API Keys', duration: '8 min', icon: 'fa-key', color: '#f59e0b', page: 'settings.html', steps: ['Open Settings → Global API Integrations', 'Paste keys from your .env or developer portals', 'Click Test Connections to verify live status', 'Save API Integrations — Dashboard and Content Hub use these keys'] },
  { id: 'tut_03', category: 'apis', title: 'OAuth 2.0 — Twitter / X', duration: '12 min', icon: 'fab fa-twitter', color: '#1d9bf0', page: 'account-hub.html', steps: ['Create an app at developer.x.com', 'Set callback URI: social-imperialism://oauth-callback', 'Copy Client ID and Secret into Global API Integrations', 'Link your account in Linked Accounts'] },
  { id: 'tut_04', category: 'apis', title: 'OAuth 2.0 — LinkedIn', duration: '10 min', icon: 'fab fa-linkedin', color: '#0A66C2', page: 'account-hub.html', steps: ['Create app at developer.linkedin.com', 'Request Sign In + Share on LinkedIn products', 'Add redirect URL: social-imperialism://oauth-callback', 'Connect via Linked Accounts hub'] },
  { id: 'tut_05', category: 'apis', title: 'Meta (Facebook & Instagram)', duration: '15 min', icon: 'fab fa-facebook', color: '#1877F2', page: 'account-hub.html', steps: ['Create Business app at developers.facebook.com', 'Add Facebook Login + Instagram Graph API products', 'Configure OAuth redirect URIs', 'Link pages and IG accounts in Account Hub'] },
  { id: 'tut_06', category: 'content', title: 'Content Hub — Publish Posts', duration: '7 min', icon: 'fa-edit', color: '#34d399', page: 'content-hub.html', steps: ['Select a linked account', 'Write or generate AI copy', 'Attach media from upload or stock search', 'Publish now or schedule for later'] },
  { id: 'tut_07', category: 'content', title: 'Content Calendar Scheduling', duration: '6 min', icon: 'fa-calendar-alt', color: '#a78bfa', page: 'calendar.html', steps: ['Open Content Calendar', 'Drag posts to preferred dates/times', 'Use Suggest Best Times for AI recommendations', 'Due posts auto-publish via the background worker'] },
  { id: 'tut_08', category: 'automation', title: 'Visual Automations Builder', duration: '12 min', icon: 'fa-project-diagram', color: '#a855f7', page: 'automations.html', steps: ['Open Visual Builder', 'Add trigger nodes (keyword match, schedule, webhook)', 'Connect action nodes (reply, like, publish)', 'Save flow and set status to Active'] },
  { id: 'tut_09', category: 'automation', title: 'Spam Filtering & Escalation', duration: '8 min', icon: 'fa-shield-alt', color: '#10b981', page: 'rules.html', steps: ['Open Auto-Rules', 'Enable spam, offensive, and crisis moderation', 'Set auto-reply mode (mentions vs all)', 'Configure industry routing and notification webhooks'] },
  { id: 'tut_10', category: 'automation', title: 'Reddit Prospector Workflows', duration: '15 min', icon: 'fab fa-reddit-alien', color: '#f97316', page: 'keywords.html', steps: ['Add high-intent keywords in Keywords page', 'Run keyword research for live Reddit/Twitter signals', 'Enable auto-rules for Reddit platform', 'Review AI drafts in AI Replies before publishing'] },
  { id: 'tut_11', category: 'engagement', title: 'AI Replies & Approval Queue', duration: '5 min', icon: 'fa-robot', color: '#38bdf8', page: 'history.html', steps: ['Worker scans keywords and generates draft replies', 'Review pending replies in AI Replies', 'Approve to publish or edit before sending', 'Track engagement in post history'] },
  { id: 'tut_12', category: 'engagement', title: 'Engagement Lists & Outreach', duration: '9 min', icon: 'fa-users', color: '#f472b6', page: 'engagement.html', steps: ['Build prospect lists from keyword matches', 'Filter by platform and intent score', 'Generate personalized outreach copy', 'Post directly to LinkedIn or export leads'] },
  { id: 'tut_13', category: 'campaigns', title: 'Multi-Brand Agency Setup', duration: '10 min', icon: 'fa-building', color: '#38bdf8', page: 'settings.html', steps: ['Create a campaign per client brand', 'Set active campaign before working on that client', 'Each campaign has isolated keywords and linked accounts', 'Use sidebar switcher to jump between brands'] },
  { id: 'tut_14', category: 'campaigns', title: 'UTM Tracking & Conversion Links', duration: '4 min', icon: 'fa-link', color: '#10b981', page: 'settings.html', steps: ['Edit campaign → Brand Details', 'Set UTM Source and UTM Medium', 'Add primary conversion link', 'AI replies append tracking params automatically'] },
  { id: 'tut_15', category: 'getting-started', title: 'Dashboard Command Center', duration: '5 min', icon: 'fa-home', color: '#38bdf8', page: 'dashboard.html', steps: ['View live API status and worker state', 'Monitor trending topics from real feeds', 'Check domain metrics for active campaign', 'Export data snapshot from dashboard tools'] },
  { id: 'tut_grok', category: 'content', title: 'Grok Imagine + Edge Browser Setup', duration: '10 min', icon: 'fa-wand-magic-sparkles', color: '#a78bfa', page: 'settings.html', steps: ['Settings → Native Browser Automation: select Microsoft Edge + dedicated profile', 'Settings → Grok Engine: credentials pre-filled (theesaintmichael@gmail.com) — Save', 'Click Connect & Authorize Grok — complete CAPTCHA in Edge if prompted', 'Content Hub → Grok Imagine — images save to grok-assets folder', 'See brain/GROK.md and brain/skills/grok-imagine/SKILL.md for full workflow'] },
];

function loadBillingState(store) {
  const defaults = {
    plan: 'starter',
    status: 'active',
    billingEmail: '',
    startedAt: new Date().toISOString(),
    nextBillingDate: null,
    history: [],
  };
  try {
    const parsed = JSON.parse(store.getItem('billingPlan') || '{}');
    return { ...defaults, ...parsed, plan: parsed.plan || 'starter' };
  } catch (e) {
    return defaults;
  }
}

function buildBillingResponse(state) {
  const catalog = PLAN_CATALOG[state.plan] || PLAN_CATALOG.starter;
  return {
    ...state,
    catalog,
    allPlans: PLAN_CATALOG,
    planName: catalog.name,
    price: catalog.price,
    priceLabel: catalog.priceLabel,
    limits: {
      accounts: catalog.accounts,
      aiGenerations: catalog.aiGenerations,
      crisisMonitoring: catalog.crisisMonitoring,
    },
  };
}

function registerSettingsHandlers({ ipcMain, store }) {
  ipcMain.handle('get-billing-plan', () => buildBillingResponse(loadBillingState(store)));

  ipcMain.handle('save-billing-plan', (event, input) => {
    const planId = typeof input === 'string' ? input : (input?.plan || 'starter');
    const catalog = PLAN_CATALOG[planId] || PLAN_CATALOG.starter;
    const existing = loadBillingState(store);
    const now = new Date().toISOString();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const payload = {
      ...existing,
      plan: planId,
      planName: catalog.name,
      price: catalog.price,
      priceLabel: catalog.priceLabel,
      status: planId === 'enterprise' ? 'pending_sales' : 'active',
      updatedAt: now,
      startedAt: existing.startedAt || now,
      nextBillingDate: planId === 'enterprise' ? null : nextMonth.toISOString(),
      billingEmail: (typeof input === 'object' && input?.billingEmail) ? input.billingEmail : existing.billingEmail,
      limits: {
        accounts: catalog.accounts,
        aiGenerations: catalog.aiGenerations,
        crisisMonitoring: catalog.crisisMonitoring,
      },
      history: Array.isArray(existing.history) ? [...existing.history] : [],
    };

    payload.history.unshift({
      id: 'bill_' + Date.now(),
      date: now,
      action: 'plan_selected',
      plan: planId,
      planName: catalog.name,
      amount: catalog.price,
      priceLabel: catalog.priceLabel,
      note: planId === 'enterprise' ? 'Enterprise inquiry — sales will contact you' : `Subscribed to ${catalog.name}`,
    });
    payload.history = payload.history.slice(0, 25);

    store.setItem('billingPlan', JSON.stringify(payload));
    return { success: true, ...buildBillingResponse(payload) };
  });

  ipcMain.handle('save-billing-email', (event, email) => {
    const existing = loadBillingState(store);
    existing.billingEmail = String(email || '').trim();
    existing.updatedAt = new Date().toISOString();
    store.setItem('billingPlan', JSON.stringify(existing));
    return { success: true, ...buildBillingResponse(existing) };
  });

  ipcMain.handle('get-setup-tutorials', () => {
    let completed = [];
    try { completed = JSON.parse(store.getItem('completedTutorials') || '[]'); } catch (e) {}
    const tutorials = SETUP_TUTORIALS.map((t) => ({
      ...t,
      thumbnail: t.thumbnail || `assets/tutorials/${t.id}.jpg`,
    }));
    return { tutorials, completed };
  });

  ipcMain.handle('mark-tutorial-complete', (event, tutorialId) => {
    let completed = [];
    try { completed = JSON.parse(store.getItem('completedTutorials') || '[]'); } catch (e) {}
    if (tutorialId && !completed.includes(tutorialId)) completed.push(tutorialId);
    store.setItem('completedTutorials', JSON.stringify(completed));
    return { success: true, completed };
  });

  ipcMain.handle('get-site-playbook-config', () => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const key = `sitePlaybookConfig_${activeId}`;
    try {
      return JSON.parse(store.getItem(key) || '{}');
    } catch (e) {
      return {};
    }
  });

  ipcMain.handle('save-site-playbook-config', (event, config) => {
    const activeId = store.getItem('activeCampaignId') || 'default';
    const key = `sitePlaybookConfig_${activeId}`;
    const payload = {
      keywords: String(config?.keywords || '').trim(),
      description: String(config?.description || '').trim(),
      expandedPlaybooks: config?.expandedPlaybooks || {},
      updatedAt: new Date().toISOString(),
    };
    store.setItem(key, JSON.stringify(payload));
    return { success: true, ...payload };
  });

  console.log('[settingsIpc] Registered: billing, tutorials, site-playbook-config');
}

module.exports = { registerSettingsHandlers, PLAN_CATALOG, SETUP_TUTORIALS, buildBillingResponse };