/**
 * THEE_MICHAEL — Campaign Mastery A→Z guide
 * Tracks per-campaign progress across every Mission Control module.
 */

const MASTERY_PHASES = [
  'A — Foundation',
  'B — Mission Control',
  'C — Create & Publish',
  'D — Discovery & Replies',
  'E — Growth Labs',
  'F — Automation',
  'G — Accounts',
  'H — System & Go-Live',
];

const MASTERY_STEPS = [
  {
    id: 'setup-brand',
    phase: 'A — Foundation',
    section: 'Create & Publish',
    label: 'Setup Wizard · Brand Profile',
    href: '/onboarding?step=1',
    navId: 'onboarding',
    instructions: [
      'Enter brand name, domain, description, tone, and audience.',
      'Click **Research My Brand** so Imperialism Brain auto-fills from your live site.',
      'Save the campaign — this wires Brand, Keywords, and Prompt Vault.',
    ],
    checkKey: 'hasProject',
  },
  {
    id: 'integrations-keys',
    phase: 'A — Foundation',
    section: 'System',
    label: 'Integrations · API Keys',
    href: '/integrations?tab=connections',
    navId: 'integrations',
    tab: 'connections',
    instructions: [
      'Open Integrations → Connections.',
      'Add SerpAPI, Gemini/OpenRouter, and at least one social OAuth (LinkedIn, X, Meta).',
      'Run **Live Probes** until 5+ APIs show Connected.',
    ],
    checkKey: 'apisConnected5',
  },
  {
    id: 'keywords-platforms',
    phase: 'A — Foundation',
    section: 'Discovery & Replies',
    label: 'Keywords & Platforms',
    href: '/onboarding?step=3',
    navId: 'onboarding',
    instructions: [
      'In Setup Wizard step 3, add 5+ keywords tied to your offer.',
      'Select target platforms (Twitter, LinkedIn, Reddit, etc.).',
      'Save — this powers Browse Posts, Auto-Rules, and SEO Tools.',
    ],
    checkKey: 'hasKeywords',
  },
  {
    id: 'account-hub',
    phase: 'A — Foundation',
    section: 'Accounts',
    label: 'Accounts · Connect Platforms',
    href: '/account-hub',
    navId: 'account-hub',
    instructions: [
      'Link at least one publishing account per priority platform.',
      'Confirm health badges are green before scheduling posts.',
    ],
    checkKey: 'hasLinkedAccounts',
  },
  {
    id: 'wizard-complete',
    phase: 'A — Foundation',
    section: 'Create & Publish',
    label: 'Setup Wizard · Go Live',
    href: '/onboarding?step=4',
    navId: 'onboarding',
    instructions: [
      'Preview the live feed in Setup Wizard step 4.',
      'Enable worker + Be-First monitors in step 5.',
      'Mark onboarding complete — unlocks full Mission Control pulse.',
    ],
    checkKey: 'onboardingComplete',
  },
  {
    id: 'dashboard-pulse',
    phase: 'B — Mission Control',
    section: 'Mission Control',
    label: 'Dashboard · Pulse & Act Now',
    href: '/dashboard',
    navId: 'dashboard',
    instructions: [
      'Review drafts, leads, engagement queue, and worker status.',
      'Run **Full Scan** to refresh live feed and trending topics.',
      'Use **Act Now** on high-intent posts from the feed tab.',
    ],
    checkKey: 'hasFeedActivity',
  },
  {
    id: 'browse-posts',
    phase: 'B — Mission Control',
    section: 'Mission Control',
    label: 'Browse Posts · Find Conversations',
    href: '/browse-posts',
    navId: 'browse-posts',
    instructions: [
      'Filter by platform, engagement, and keyword match.',
      'Draft a reply on one high-fit post — sends to AI Replies queue.',
    ],
    checkKey: 'hasKeywords',
  },
  {
    id: 'brand-voice',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Brand · Voice & Rules',
    href: '/brand',
    navId: 'brand',
    instructions: [
      'Set affiliate links, disallowed topics, and sample messages.',
      'Save brand guidelines — all AI drafts inherit this voice.',
    ],
    checkKey: 'hasBrandGuidelines',
  },
  {
    id: 'prompt-vault',
    phase: 'D — Discovery & Replies',
    section: 'Discovery & Replies',
    label: 'Prompt Vault · Saved Prompts',
    href: '/prompt-vault',
    navId: 'prompt-vault',
    instructions: [
      'Seed Grok, SEO, and reply prompts for your campaign keywords.',
      'Load a vault prompt into Content Hub or AI Replies when drafting.',
    ],
    checkKey: 'hasPromptVault',
  },
  {
    id: 'seo-tools',
    phase: 'D — Discovery & Replies',
    section: 'Discovery & Replies',
    label: 'SEO Tools · Research Wins',
    href: '/seo-tools',
    navId: 'seo-tools',
    instructions: [
      'Run KGR or keyword grouping on your top offer term.',
      'Export JSON and push winners to Keywords.',
    ],
    checkKey: 'hasSerpOrSeo',
  },
  {
    id: 'content-hub',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Create · Draft & Publish',
    href: '/content-hub?tab=studio',
    navId: 'content-hub',
    tab: 'studio',
    instructions: [
      'Generate one post with campaign keywords in the studio tab.',
      'Queue or schedule via Compose — test publish to a linked account.',
    ],
    checkKey: 'hasContentActivity',
  },
  {
    id: 'design-studio',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Design Studio · Visual Posts',
    href: '/design-studio',
    navId: 'design-studio',
    instructions: [
      'Pick a template, apply brand colors, export an image.',
      'Send asset to Content Hub or Library for reuse.',
    ],
    checkKey: 'hasContentActivity',
  },
  {
    id: 'content-library',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Library · Reuse Assets',
    href: '/content-library',
    navId: 'content-library',
    instructions: [
      'Confirm generated posts and images appear in the library.',
      'Tag assets by campaign keyword for fast reuse.',
    ],
    checkKey: 'hasContentActivity',
  },
  {
    id: 'calendar',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Calendar · Schedule Runway',
    href: '/calendar',
    navId: 'calendar',
    instructions: [
      'Schedule at least one post for the next 7 days.',
      'Drag posts to balance platforms across the week.',
    ],
    checkKey: 'hasScheduledPosts',
  },
  {
    id: 'scheduler',
    phase: 'C — Create & Publish',
    section: 'Create & Publish',
    label: 'Scheduler · Background Runs',
    href: '/scheduler',
    navId: 'scheduler',
    instructions: [
      'Review due background runs and worker tasks.',
      'Enable auto-search frequency if not already on.',
    ],
    checkKey: 'workerEnabled',
  },
  {
    id: 'engagement',
    phase: 'D — Discovery & Replies',
    section: 'Discovery & Replies',
    label: 'Engagement · Warm Profiles',
    href: '/engagement',
    navId: 'engagement',
    instructions: [
      'Queue likes, follows, or comments on matched profiles.',
      'Keep human-like pacing — review queue before send.',
    ],
    checkKey: 'hasEngagementQueue',
  },
  {
    id: 'ai-replies',
    phase: 'D — Discovery & Replies',
    section: 'Discovery & Replies',
    label: 'AI Replies · Approve Drafts',
    href: '/history?tab=pending',
    navId: 'history',
    tab: 'pending',
    instructions: [
      'Open pending drafts from Browse Posts or auto-search.',
      'Edit tone, approve, then schedule or post where allowed.',
    ],
    checkKey: 'hasAiReplies',
  },
  {
    id: 'growth-lab',
    phase: 'E — Growth Labs',
    section: 'Growth Labs',
    label: 'Growth Lab · Reddit Modules',
    href: '/reddit-ai',
    navId: 'reddit-ai',
    instructions: [
      'Configure subreddit targets aligned with your keywords.',
      'Run a prospector scan and save leads to Mission Control.',
    ],
    checkKey: 'hasMonitors',
  },
  {
    id: 'quora-ops',
    phase: 'E — Growth Labs',
    section: 'Growth Labs',
    label: 'Quora Ops · Answer & Traffic',
    href: '/quora-traffic',
    navId: 'quora-traffic',
    instructions: [
      'Connect Quora account or draft answers from SEO research.',
      'Publish helpful answers with soft CTA to your domain.',
    ],
    checkKey: 'hasMonitors',
  },
  {
    id: 'automations',
    phase: 'F — Automation',
    section: 'Automation',
    label: 'Automations · Visual Flows',
    href: '/automations',
    navId: 'automations',
    instructions: [
      'Build one flow: keyword match → draft reply → approval queue.',
      'Test in sandbox before enabling live triggers.',
    ],
    checkKey: 'hasAutoRules',
  },
  {
    id: 'auto-rules',
    phase: 'F — Automation',
    section: 'Automation',
    label: 'Auto-Rules · Keyword Triggers',
    href: '/rules',
    navId: 'rules',
    instructions: [
      'Create Be-First monitors for top 3 keywords.',
      'Set frequency (10m–daily) and platform filters.',
    ],
    checkKey: 'hasMonitors',
  },
  {
    id: 'account-creator',
    phase: 'G — Accounts',
    section: 'Accounts',
    label: 'Acct Creator · New Profiles',
    href: '/account-creator',
    navId: 'account-creator',
    instructions: [
      'Optional: create profile kits for new platform accounts.',
      'Use proxy + native browser settings for automation-ready profiles.',
    ],
    checkKey: 'hasLinkedAccounts',
  },
  {
    id: 'campaign-command',
    phase: 'H — System & Go-Live',
    section: 'System',
    label: 'Campaign Command · Verified Nodes',
    href: '/campaign-manager',
    navId: 'campaign-manager',
    instructions: [
      'Review campaign schedules and verified node graph.',
      'Wire RSS, email, and publish nodes for full pipeline.',
    ],
    checkKey: 'onboardingComplete',
  },
  {
    id: 'settings-grok',
    phase: 'H — System & Go-Live',
    section: 'System',
    label: 'Settings · Grok & Native Browser',
    href: '/settings?tab=connect',
    navId: 'settings',
    tab: 'connect',
    instructions: [
      'Save x.ai credentials → **Connect & Authorize** (Windows/desktop or localhost).',
      'Pick Chrome or Edge in Native Browser — powers Imagine/Video in Create.',
    ],
    checkKey: 'optionalGrok',
  },
  {
    id: 'dns',
    phase: 'H — System & Go-Live',
    section: 'System',
    label: 'DNS · Domain Routing',
    href: '/dns',
    navId: 'dns',
    instructions: [
      'Add your marketing domain and verify A/CNAME records.',
      'Link tracking domains for UTM and affiliate links.',
    ],
    checkKey: 'optionalDns',
  },
  {
    id: 'mastery-complete',
    phase: 'H — System & Go-Live',
    section: 'System',
    label: 'Campaign Mastery · Certified',
    href: '/dashboard',
    navId: 'dashboard',
    instructions: [
      'All core modules wired — monitor Dashboard pulse daily.',
      'Ask Imperialism Brain: "what should I improve today?" for ongoing optimization.',
    ],
    checkKey: 'masteryComplete',
  },
];

function progressStorageKey(campaignId) {
  return `campaignMasteryProgress_${campaignId || 'default'}`;
}

function readManualProgress(store, campaignId) {
  try {
    return JSON.parse(store.getItem(progressStorageKey(campaignId)) || '{}');
  } catch {
    return {};
  }
}

function buildMasteryContext(store, resolveKeys, buildApiMetrics) {
  const activeCampaignId = store.getItem('activeCampaignId') || 'default';
  const campaigns = JSON.parse(store.getItem('campaigns') || '[]');
  const campaign = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
  const hasProject = !!(campaign?.brandName?.trim() && campaign?.domain?.trim());
  const keywords = JSON.parse(store.getItem('keywords') || '[]')
    .filter((k) => k.campaignId === (campaign?.id || activeCampaignId));
  const onboardingComplete = store.getItem('onboardingComplete') === 'true';
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${activeCampaignId}`) || '[]');
  const globalKeys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const apiMetrics = buildApiMetrics(globalKeys);
  const apisConnected = Object.values(apiMetrics).filter((v) => v === 'Connected').length;
  const monitors = JSON.parse(store.getItem('watchedMonitors') || '[]');
  let scheduledPosts = [];
  try { scheduledPosts = JSON.parse(store.getItem('scheduled_posts') || '[]'); } catch { /* ignore */ }
  let contentQueue = [];
  try { contentQueue = JSON.parse(store.getItem('contentQueue') || '[]'); } catch { /* ignore */ }
  let contentLibrary = { count: 0 };
  try {
    const lib = JSON.parse(store.getItem('contentLibrary') || '{}');
    contentLibrary = { count: lib?.assets?.length || lib?.count || 0 };
  } catch { /* ignore */ }
  let aiReplies = [];
  try { aiReplies = JSON.parse(store.getItem('aiReplies') || '[]'); } catch { /* ignore */ }
  let engagementQueue = [];
  try { engagementQueue = JSON.parse(store.getItem('engagementQueue') || '[]'); } catch { /* ignore */ }
  let autoRules = {};
  try { autoRules = JSON.parse(store.getItem('autoRules') || '{}'); } catch { /* ignore */ }
  const workerSettings = JSON.parse(store.getItem('workerSettings') || '{}');
  const brandGuidelines = JSON.parse(store.getItem('brandGuidelines') || '{}');
  let promptVault = [];
  try { promptVault = JSON.parse(store.getItem('promptVault') || '[]'); } catch { /* ignore */ }
  let dnsSites = [];
  try { dnsSites = JSON.parse(store.getItem('dnsSites') || '[]'); } catch { /* ignore */ }

  const checks = {
    hasProject,
    apisConnected5: apisConnected >= 5,
    hasKeywords: keywords.length > 0,
    hasLinkedAccounts: linkedAccounts.length > 0,
    onboardingComplete,
    hasFeedActivity: keywords.length > 0 && onboardingComplete,
    hasBrandGuidelines: !!(brandGuidelines?.affiliateLinks || brandGuidelines?.tone || campaign?.tone),
    hasPromptVault: promptVault.length > 0,
    hasSerpOrSeo: !!(
      globalKeys.serpApiKey
      || globalKeys.siSerpBaseUrl
      || globalKeys.siSerpApiKey
      || globalKeys.openSerpBaseUrl
      || globalKeys.openSerpApiKey
      || globalKeys.domDetailer
    ),
    hasContentActivity: contentQueue.length > 0 || contentLibrary.count > 0 || scheduledPosts.length > 0,
    hasScheduledPosts: scheduledPosts.length > 0,
    workerEnabled: workerSettings.enabled !== false,
    hasEngagementQueue: engagementQueue.length > 0,
    hasAiReplies: aiReplies.length > 0,
    hasMonitors: monitors.length > 0,
    hasAutoRules: !!(autoRules?.rules?.length || autoRules?.enabled),
    optionalGrok: true,
    optionalDns: dnsSites.length > 0,
    masteryComplete: false,
  };

  return {
    activeCampaignId,
    campaign,
    checks,
    apisConnected,
    keywordCount: keywords.length,
    linkedAccountsCount: linkedAccounts.length,
  };
}

function evaluateSteps(ctx, manual) {
  const steps = MASTERY_STEPS.map((step, index) => {
    const autoDone = !!ctx.checks[step.checkKey];
    const manualDone = manual[step.id] === true;
    const done = step.checkKey === 'optionalGrok' || step.checkKey === 'optionalDns'
      ? (manualDone || autoDone)
      : (autoDone || manualDone);
    return {
      ...step,
      order: index + 1,
      done,
      autoDone,
      manualDone,
      status: done ? 'complete' : 'pending',
    };
  });

  const required = steps.filter((s) => s.checkKey !== 'optionalGrok' && s.checkKey !== 'optionalDns' && s.id !== 'mastery-complete');
  const requiredDone = required.filter((s) => s.done).length;
  const allRequiredDone = requiredDone >= required.length - 1;
  const masteryStep = steps.find((s) => s.id === 'mastery-complete');
  if (masteryStep && allRequiredDone) {
    masteryStep.done = true;
    masteryStep.status = 'complete';
    masteryStep.autoDone = true;
    ctx.checks.masteryComplete = true;
  }

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const current = steps.find((s) => !s.done) || steps[steps.length - 1];
  const currentIndex = steps.findIndex((s) => s.id === current.id);

  return {
    steps,
    doneCount,
    totalSteps: steps.length,
    percent,
    currentStep: current,
    currentIndex,
    phases: MASTERY_PHASES,
    complete: steps.every((s) => s.done),
    requiredDone,
    requiredTotal: required.length,
  };
}

function registerCampaignMasteryHandlers({ ipcMain, store, resolveKeys, buildApiMetrics }) {
  ipcMain.handle('get-campaign-mastery-status', () => {
    const ctx = buildMasteryContext(store, resolveKeys, buildApiMetrics);
    const manual = readManualProgress(store, ctx.activeCampaignId);
    const progress = evaluateSteps(ctx, manual);
    return {
      success: true,
      campaignId: ctx.activeCampaignId,
      campaignName: ctx.campaign?.brandName || 'Campaign',
      ...progress,
      signals: {
        apisConnected: ctx.apisConnected,
        keywordCount: ctx.keywordCount,
        linkedAccountsCount: ctx.linkedAccountsCount,
      },
    };
  });

  ipcMain.handle('mark-campaign-mastery-step', (event, payload) => {
    const stepId = typeof payload === 'string' ? payload : payload?.stepId;
    const done = typeof payload === 'object' ? payload?.done !== false : true;
    if (!stepId) return { success: false, error: 'stepId required' };
    const ctx = buildMasteryContext(store, resolveKeys, buildApiMetrics);
    const manual = readManualProgress(store, ctx.activeCampaignId);
    if (done) manual[stepId] = true;
    else delete manual[stepId];
    store.setItem(progressStorageKey(ctx.activeCampaignId), JSON.stringify(manual));
    const progress = evaluateSteps(ctx, manual);
    return { success: true, ...progress };
  });

  ipcMain.handle('reset-campaign-mastery-progress', (event, campaignId) => {
    const id = campaignId || store.getItem('activeCampaignId') || 'default';
    store.setItem(progressStorageKey(id), JSON.stringify({}));
    const ctx = buildMasteryContext(store, resolveKeys, buildApiMetrics);
    return { success: true, ...evaluateSteps(ctx, {}) };
  });

  console.log('[campaignMasteryGuide] Registered THEE_MICHAEL A→Z mastery handlers');
}

module.exports = {
  MASTERY_STEPS,
  MASTERY_PHASES,
  registerCampaignMasteryHandlers,
  buildMasteryContext,
  evaluateSteps,
};