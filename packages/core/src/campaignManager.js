/**
 * Brand campaign operations — details, pause/resume, update, cascade delete.
 */

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getCampaigns(store) {
  return parseJson(store.getItem('campaigns'), []);
}

function saveCampaigns(store, campaigns) {
  store.setItem('campaigns', JSON.stringify(campaigns));
}

function getScheduledPosts(store) {
  return parseJson(store.getItem('scheduled_posts'), []);
}

function saveScheduledPosts(store, posts) {
  store.setItem('scheduled_posts', JSON.stringify(posts));
}

function getCampaignStats(store, campaignId) {
  let linkedAccounts = 0;
  let keywords = 0;
  try {
    const accData = store.getItem(`linkedAccounts_${campaignId}`);
    if (accData) linkedAccounts = JSON.parse(accData).length;
  } catch { /* ignore */ }
  try {
    const kwData = store.getItem('keywords');
    if (kwData) keywords = JSON.parse(kwData).filter((k) => k.campaignId === campaignId).length;
  } catch { /* ignore */ }
  return { linkedAccounts, keywords };
}

function filterPostsForCampaign(posts, campaignId) {
  return posts.filter((p) => !p.campaignId || p.campaignId === campaignId);
}

function getCampaignDetails(store, campaignId) {
  const id = campaignId || store.getItem('activeCampaignId');
  const campaigns = getCampaigns(store);
  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign) {
    return { success: false, error: 'Campaign not found' };
  }

  const activeCampaignId = store.getItem('activeCampaignId') || null;
  const isActive = campaign.id === activeCampaignId;
  const workerRunning = store.getItem('workerRunningFlag') === 'true';
  const status = campaign.status || (isActive ? 'Running' : 'Draft');
  const isPaused = status === 'Paused';
  const isRunning = isActive && !isPaused && (status === 'Running' || status === 'Active') && workerRunning;

  const allPosts = getScheduledPosts(store);
  const scheduledPosts = filterPostsForCampaign(allPosts, campaign.id);
  const now = Date.now();
  const duePosts = scheduledPosts.filter((p) => new Date(p.timestamp || p.scheduleTime).getTime() <= now).length;
  const upcomingPosts = scheduledPosts.filter((p) => new Date(p.timestamp || p.scheduleTime).getTime() > now).length;

  const keywords = parseJson(store.getItem('keywords'), []).filter((k) => k.campaignId === campaign.id);
  const linkedAccounts = parseJson(store.getItem(`linkedAccounts_${campaign.id}`), []);
  const brandGuidelines = parseJson(store.getItem(`brandGuidelines_${campaign.id}`), null);

  let aiReplies = 0;
  try {
    aiReplies = parseJson(store.getItem('aiRepliesHistory'), [])
      .filter((r) => !r.campaignId || r.campaignId === campaign.id).length;
  } catch { /* ignore */ }

  let leads = 0;
  try {
    leads = parseJson(store.getItem('leads'), [])
      .filter((l) => !l.campaignId || l.campaignId === campaign.id).length;
  } catch { /* ignore */ }

  const stats = {
    ...getCampaignStats(store, campaign.id),
    scheduledPosts: scheduledPosts.length,
    duePosts,
    upcomingPosts,
    aiReplies,
    leads,
  };

  return {
    success: true,
    campaign: { ...campaign, status },
    isActive,
    isPaused,
    isRunning,
    workerRunning: isActive && workerRunning,
    activeCampaignId,
    stats,
    scheduledPosts: scheduledPosts.sort(
      (a, b) => new Date(a.timestamp || a.scheduleTime).getTime() - new Date(b.timestamp || b.scheduleTime).getTime(),
    ),
    keywords,
    linkedAccounts,
    brandGuidelines,
    rules: campaign.rules || null,
  };
}

function updateCampaign(store, campaignId, updates = {}) {
  const campaigns = getCampaigns(store);
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx < 0) return { success: false, error: 'Campaign not found' };

  const allowed = [
    'brandName', 'domain', 'description', 'tone', 'audience', 'status',
    'utmSource', 'utmMedium', 'primaryLink', 'affiliateLinks', 'disallowedTopics',
    'examplePosts', 'rules',
  ];
  const next = { ...campaigns[idx] };
  for (const key of allowed) {
    if (updates[key] !== undefined) next[key] = updates[key];
  }
  campaigns[idx] = next;
  saveCampaigns(store, campaigns);
  return { success: true, campaign: next, campaigns };
}

function pauseCampaign(store, campaignId) {
  const campaigns = getCampaigns(store);
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx < 0) return { success: false, error: 'Campaign not found' };

  campaigns[idx] = { ...campaigns[idx], status: 'Paused', pausedAt: new Date().toISOString() };
  saveCampaigns(store, campaigns);

  const activeId = store.getItem('activeCampaignId');
  if (activeId === campaignId) {
    store.setItem('workerRunningFlag', 'false');
  }

  return { success: true, campaign: campaigns[idx], campaigns, workerStopped: activeId === campaignId };
}

function resumeCampaign(store, campaignId) {
  const campaigns = getCampaigns(store);
  const idx = campaigns.findIndex((c) => c.id === campaignId);
  if (idx < 0) return { success: false, error: 'Campaign not found' };

  campaigns[idx] = {
    ...campaigns[idx],
    status: 'Running',
    resumedAt: new Date().toISOString(),
    pausedAt: undefined,
  };
  saveCampaigns(store, campaigns);

  const activeId = store.getItem('activeCampaignId');
  let workerStarted = false;
  if (activeId === campaignId) {
    store.setItem('workerRunningFlag', 'true');
    workerStarted = true;
  }

  return { success: true, campaign: campaigns[idx], campaigns, workerStarted };
}

function isQaCampaign(c) {
  const name = String(c?.brandName || '').trim();
  const domain = String(c?.domain || '').trim().toLowerCase();
  const id = String(c?.id || '');
  if (/wizard\s*qa|qa\s*brand|^qa\b/i.test(name)) return true;
  if (/\.test$|wizardqa\.com/i.test(domain)) return true;
  if (/^wiz_qa|^camp_qa|^mon_wiz/i.test(id)) return true;
  return false;
}

function clearQaCampaigns(store) {
  const campaigns = getCampaigns(store);
  const qa = campaigns.filter(isQaCampaign);
  if (!qa.length) return { success: true, removed: 0, campaigns };

  let next = campaigns.filter((c) => !isQaCampaign(c));
  saveCampaigns(store, next);

  const activeId = store.getItem('activeCampaignId');
  if (qa.some((c) => c.id === activeId)) {
    if (next.length) store.setItem('activeCampaignId', next[0].id);
    else store.removeItem('activeCampaignId');
    store.setItem('workerRunningFlag', 'false');
  }

  for (const c of qa) {
    const posts = getScheduledPosts(store).filter((p) => p.campaignId !== c.id);
    saveScheduledPosts(store, posts);
    const keywords = parseJson(store.getItem('keywords'), []).filter((k) => k.campaignId !== c.id);
    store.setItem('keywords', JSON.stringify(keywords));
    for (const key of [`linkedAccounts_${c.id}`, `brandGuidelines_${c.id}`, `fetchProfiles_${c.id}`]) {
      try { store.removeItem(key); } catch { /* ignore */ }
    }
  }

  return { success: true, removed: qa.length, campaigns: next };
}

function clearFailedScheduledPosts(store, campaignId) {
  const all = getScheduledPosts(store);
  const before = all.length;
  const next = all.filter((p) => {
    if (p.status !== 'failed') return true;
    if (campaignId && p.campaignId !== campaignId) return true;
    return false;
  });
  saveScheduledPosts(store, next);
  return { success: true, removed: before - next.length, remaining: next.length };
}

function deleteCampaignWithCleanup(store, campaignId) {
  let campaigns = getCampaigns(store);
  const target = campaigns.find((c) => c.id === campaignId);
  if (!target) return { success: false, error: 'Campaign not found' };

  campaigns = campaigns.filter((c) => c.id !== campaignId);
  saveCampaigns(store, campaigns);

  const activeId = store.getItem('activeCampaignId');
  if (activeId === campaignId) {
    if (campaigns.length) store.setItem('activeCampaignId', campaigns[0].id);
    else store.removeItem('activeCampaignId');
    store.setItem('workerRunningFlag', 'false');
  }

  // Remove scheduled posts for this campaign
  const posts = getScheduledPosts(store).filter((p) => p.campaignId !== campaignId);
  saveScheduledPosts(store, posts);

  // Remove keywords for this campaign
  const keywords = parseJson(store.getItem('keywords'), []).filter((k) => k.campaignId !== campaignId);
  store.setItem('keywords', JSON.stringify(keywords));

  // Remove campaign-scoped store keys
  const scopedKeys = [
    `linkedAccounts_${campaignId}`,
    `brandGuidelines_${campaignId}`,
    `fetchProfiles_${campaignId}`,
  ];
  for (const key of scopedKeys) {
    try { store.removeItem(key); } catch { /* ignore */ }
  }

  return { success: true, campaigns, deleted: target.brandName || campaignId };
}

function registerCampaignManagerHandlers(ipcMain, store) {
  ipcMain.handle('get-campaign-details', (event, campaignId) => getCampaignDetails(store, campaignId));
  ipcMain.handle('update-campaign', (event, payload) => {
    const { campaignId, updates } = payload || {};
    if (!campaignId) return { success: false, error: 'campaignId required' };
    return updateCampaign(store, campaignId, updates || {});
  });
  ipcMain.handle('pause-campaign', (event, campaignId) => {
    if (!campaignId) return { success: false, error: 'campaignId required' };
    return pauseCampaign(store, campaignId);
  });
  ipcMain.handle('resume-campaign', (event, campaignId) => {
    if (!campaignId) return { success: false, error: 'campaignId required' };
    return resumeCampaign(store, campaignId);
  });
  ipcMain.handle('clear-qa-campaigns', () => clearQaCampaigns(store));
  ipcMain.handle('clear-failed-scheduled-posts', (event, campaignId) => clearFailedScheduledPosts(store, campaignId));
}

module.exports = {
  getCampaignDetails,
  updateCampaign,
  pauseCampaign,
  resumeCampaign,
  deleteCampaignWithCleanup,
  clearQaCampaigns,
  clearFailedScheduledPosts,
  isQaCampaign,
  registerCampaignManagerHandlers,
};