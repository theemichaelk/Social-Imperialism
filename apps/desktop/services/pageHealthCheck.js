/**
 * Per-sidebar-section health audit — verifies HTML, IPC wiring, and data/API readiness.
 */
const fs = require('fs');
const path = require('path');

const NAV_SECTIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    html: 'dashboard.html',
    hash: null,
    requiredKeys: ['gemini', 'openrouter'],
    optionalKeys: ['newsApiKey', 'serpApiKey', 'twitterBearer'],
    dataChecks: ['activeCampaign', 'keywords'],
  },
  {
    id: 'browse-posts',
    label: 'Browse Posts',
    html: 'dashboard.html',
    hash: '#browse-posts',
    requiredKeys: [],
    optionalKeys: ['twitterBearer', 'redditClientId'],
    dataChecks: ['activeCampaign', 'keywords'],
  },
  {
    id: 'onboarding',
    label: 'Setup Wizard',
    html: 'onboarding.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'openrouter'],
    dataChecks: ['campaigns'],
  },
  {
    id: 'content-hub',
    label: 'Create',
    html: 'content-hub.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'falKey', 'unsplashAccessKey', 'grokEmail'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'content-library',
    label: 'Library',
    html: 'content-library.html',
    requiredKeys: [],
    optionalKeys: ['gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'design-studio',
    label: 'Design Studio',
    html: 'design-studio.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'falKey'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'brand',
    label: 'Brand',
    html: 'brand.html',
    requiredKeys: [],
    optionalKeys: ['gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    html: 'calendar.html',
    hash: '#scheduler',
    requiredKeys: [],
    optionalKeys: ['metaAccess', 'linkedinAccessToken'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'engagement',
    label: 'Engagement Lists',
    html: 'engagement.html',
    requiredKeys: [],
    optionalKeys: ['linkedinAccessToken', 'gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'history',
    label: 'AI Replies',
    html: 'history.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'openrouter'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'keywords',
    label: 'Keywords',
    html: 'keywords.html',
    requiredKeys: [],
    optionalKeys: ['serpApiKey', 'gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'seo-tools',
    label: 'SEO Research Tools',
    html: 'seo-tools.html',
    requiredKeys: [],
    optionalKeys: ['serpApiKey', 'gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'reddit-ai',
    label: 'AI Growth Lab',
    html: 'reddit-ai-suite.html',
    requiredKeys: [],
    optionalKeys: ['redditClientId', 'gemini'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'quora-traffic',
    label: 'Quora',
    html: 'quora-traffic-ops.html',
    requiredKeys: [],
    optionalKeys: ['serpApiKey', 'openrouter', 'gemini'],
    dataChecks: ['activeCampaign', 'linkedAccounts'],
  },
  {
    id: 'automations',
    label: 'Visual Builder',
    html: 'automations.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'falKey'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'rules',
    label: 'Auto-Rules',
    html: 'rules.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'twitterBearer', 'linkedinAccessToken'],
    dataChecks: ['activeCampaign', 'linkedAccounts'],
  },
  {
    id: 'account-hub',
    label: 'Linked Accounts',
    html: 'account-hub.html',
    requiredKeys: [],
    optionalKeys: ['metaAccess', 'linkedinAccessToken', 'twitterBearer'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'account-creator',
    label: 'Account Creator',
    html: 'account-creator.html',
    requiredKeys: [],
    optionalKeys: ['gemini', 'falKey'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'calendar',
    label: 'Content Calendar',
    html: 'calendar.html',
    requiredKeys: [],
    optionalKeys: ['metaAccess', 'linkedinAccessToken'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'dns',
    label: 'DNS',
    html: 'dns.html',
    requiredKeys: [],
    optionalKeys: ['awsAccessKeyId', 'awsSecretAccessKey'],
    dataChecks: ['activeCampaign'],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    html: 'integrations.html',
    requiredKeys: [],
    optionalKeys: ['vboutApiKey', 'smtpUser', 'acumbamailUser'],
    dataChecks: ['campaigns'],
  },
  {
    id: 'settings',
    label: 'Campaign Manager',
    html: 'settings.html',
    requiredKeys: [],
    optionalKeys: [],
    dataChecks: ['campaigns'],
  },
];

function getRegisteredIpcChannels(ipcMain) {
  if (ipcMain?._invokeHandlers instanceof Map) {
    return Array.from(ipcMain._invokeHandlers.keys());
  }
  return [];
}

function extractInvokeChannels(htmlContent) {
  const channels = new Set();
  const re = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(htmlContent)) !== null) {
    channels.add(m[1]);
  }
  return Array.from(channels);
}

function checkDataReadiness(store, checks, activeCampaignId) {
  const results = {};
  checks.forEach((check) => {
    switch (check) {
      case 'campaigns': {
        try {
          const camps = JSON.parse(store.getItem('campaigns') || '[]');
          results.campaigns = { ok: camps.length > 0, count: camps.length };
        } catch (e) {
          results.campaigns = { ok: false, error: e.message };
        }
        break;
      }
      case 'activeCampaign': {
        const id = activeCampaignId || store.getItem('activeCampaignId');
        let campaign = null;
        try {
          const camps = JSON.parse(store.getItem('campaigns') || '[]');
          campaign = camps.find((c) => c.id === id) || null;
        } catch (e) { /* ignore */ }
        results.activeCampaign = { ok: !!campaign, id: id || null, brandName: campaign?.brandName || null };
        break;
      }
      case 'keywords': {
        try {
          const all = JSON.parse(store.getItem('keywords') || '[]');
          const count = all.filter((k) => k.campaignId === activeCampaignId).length;
          results.keywords = { ok: count > 0, count };
        } catch (e) {
          results.keywords = { ok: false, count: 0 };
        }
        break;
      }
      case 'linkedAccounts': {
        try {
          const accs = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
          results.linkedAccounts = { ok: accs.length > 0, count: accs.length };
        } catch (e) {
          results.linkedAccounts = { ok: false, count: 0 };
        }
        break;
      }
      default:
        break;
    }
  });
  return results;
}

function resolveKeyPresence(keys, keyNames) {
  const present = [];
  const missing = [];
  keyNames.forEach((name) => {
    if (keys[name]) present.push(name);
    else missing.push(name);
  });
  return { present, missing };
}

function scoreSection(sectionResult) {
  if (!sectionResult.htmlExists) return 'broken';
  if (sectionResult.missingChannels?.length > 0) return 'broken';
  if (sectionResult.status === 'warn') return 'warn';
  if (sectionResult.status === 'ok') return 'ok';
  return 'warn';
}

function runPageHealthCheck({ ipcMain, store, resolveKeys, appRoot }) {
  const root = appRoot || path.join(__dirname, '..');
  const registered = new Set(getRegisteredIpcChannels(ipcMain));
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));

  const hasAi = !!(globalKeys.gemini || globalKeys.openrouter || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY_1);

  const sections = NAV_SECTIONS.map((section) => {
    const htmlPath = path.join(root, section.html);
    const htmlExists = fs.existsSync(htmlPath);
    let invokeChannels = [];
    let missingChannels = [];

    if (htmlExists) {
      try {
        invokeChannels = extractInvokeChannels(fs.readFileSync(htmlPath, 'utf8'));
        missingChannels = invokeChannels.filter((ch) => !registered.has(ch));
      } catch (e) {
        missingChannels = ['__read_error__'];
      }
    }

    const data = htmlExists ? checkDataReadiness(store, section.dataChecks || [], activeCampaignId) : {};
    const reqKeys = resolveKeyPresence(globalKeys, section.requiredKeys || []);
    const optKeys = resolveKeyPresence(globalKeys, section.optionalKeys || []);

    const issues = [];
    const hints = [];

    if (!htmlExists) issues.push(`Missing page file: ${section.html}`);
    if (missingChannels.length) issues.push(`Unregistered IPC: ${missingChannels.join(', ')}`);

    if (section.dataChecks?.includes('activeCampaign') && data.activeCampaign && !data.activeCampaign.ok) {
      issues.push('No active campaign — create one in Settings or Setup Wizard');
    }
    if (section.dataChecks?.includes('keywords') && data.keywords && !data.keywords.ok) {
      hints.push('Add keywords in Keywords page or Setup Wizard for live feed results');
    }
    if (section.dataChecks?.includes('linkedAccounts') && data.linkedAccounts && !data.linkedAccounts.ok) {
      hints.push('Link accounts in Linked Accounts for auto-rules publishing');
    }

    if (section.id !== 'settings' && !hasAi) {
      hints.push('Configure Gemini or OpenRouter in Settings for AI features');
    }

    reqKeys.missing.forEach((k) => issues.push(`Required API key missing: ${k}`));
    if (optKeys.present.length === 0 && (section.optionalKeys || []).length > 0) {
      hints.push(`Optional keys for richer data: ${section.optionalKeys.slice(0, 3).join(', ')}`);
    }

    let status = 'ok';
    if (!htmlExists || missingChannels.length > 0 || reqKeys.missing.length > 0) {
      status = 'broken';
    } else if (issues.length > 0 || hints.length > 0) {
      status = hints.length > 0 && issues.length === 0 ? 'warn' : 'warn';
    }

    return {
      id: section.id,
      label: section.label,
      html: section.html,
      hash: section.hash || null,
      status,
      score: scoreSection({ htmlExists, missingChannels, status }),
      htmlExists,
      invokeChannelCount: invokeChannels.length,
      missingChannels,
      data,
      apiKeys: {
        configured: optKeys.present.length + reqKeys.present.length,
        optionalPresent: optKeys.present,
        optionalMissing: optKeys.missing,
        requiredMissing: reqKeys.missing,
      },
      issues,
      hints,
    };
  });

  const summary = {
    total: sections.length,
    ok: sections.filter((s) => s.status === 'ok').length,
    warn: sections.filter((s) => s.status === 'warn').length,
    broken: sections.filter((s) => s.status === 'broken').length,
    registeredIpcCount: registered.size,
    activeCampaignId,
    hasAi,
    timestamp: new Date().toISOString(),
  };

  return { summary, sections };
}

function registerPageHealthHandlers({ ipcMain, store, resolveKeys, appRoot }) {
  try { ipcMain.removeHandler('get-page-health'); } catch (e) { /* noop */ }

  ipcMain.handle('get-page-health', () => runPageHealthCheck({
    ipcMain,
    store,
    resolveKeys,
    appRoot,
  }));

  console.log('[pageHealthCheck] Registered: get-page-health');
}

module.exports = {
  NAV_SECTIONS,
  runPageHealthCheck,
  registerPageHealthHandlers,
  extractInvokeChannels,
  getRegisteredIpcChannels,
};