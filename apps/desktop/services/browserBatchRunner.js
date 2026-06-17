/**
 * Overnight / scheduled headless browser batch runner for profile kits.
 */
const STORAGE_KEY = 'browserBatchQueue';
const RUNNING_KEY = 'browserBatchRunning';

function getQueue(store) {
  try {
    return JSON.parse(store.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(store, queue) {
  store.setItem(STORAGE_KEY, JSON.stringify(queue));
}

function makeBatchId() {
  return `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isRunning(store) {
  return store.getItem(RUNNING_KEY) === 'true';
}

function setRunning(store, value) {
  if (value) store.setItem(RUNNING_KEY, 'true');
  else store.removeItem(RUNNING_KEY);
}

function parseRunAt(runAt, overnightHour = 2) {
  if (runAt) {
    const d = new Date(runAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const next = new Date();
  next.setHours(overnightHour, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

function enqueueBatch(store, payload = {}) {
  const campaignId = payload.campaignId || store.getItem('activeCampaignId') || 'default';
  const job = {
    id: makeBatchId(),
    campaignId,
    kitIds: Array.isArray(payload.kitIds) ? payload.kitIds : [],
    platforms: payload.platforms || null,
    mode: payload.mode || 'edit',
    headless: payload.headless !== false,
    runAt: parseRunAt(payload.runAt, payload.overnightHour),
    status: 'queued',
    alsoUploadApi: !!payload.alsoUploadApi,
    alsoPushCalendar: !!payload.alsoPushCalendar,
    delayBetweenKitsMs: Math.max(30000, parseInt(payload.delayBetweenKitsMs, 10) || 120000),
    delayBetweenPlatformsMs: Math.max(5000, parseInt(payload.delayBetweenPlatformsMs, 10) || 30000),
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    currentKitId: null,
    results: [],
    error: null,
    label: payload.label || `Batch ${new Date().toLocaleString()}`,
  };

  if (!job.kitIds.length) throw new Error('Select at least one profile kit for the batch.');

  const queue = getQueue(store);
  queue.push(job);
  saveQueue(store, queue);
  return job;
}

function cancelBatch(store, batchId) {
  const queue = getQueue(store);
  const job = queue.find((j) => j.id === batchId);
  if (!job) return { success: false, error: 'Batch job not found.' };
  if (job.status === 'running') return { success: false, error: 'Cannot cancel a running batch.' };
  job.status = 'cancelled';
  job.completedAt = new Date().toISOString();
  saveQueue(store, queue);
  return { success: true, job };
}

function getDueJob(store) {
  const now = Date.now();
  return getQueue(store).find((j) => j.status === 'queued' && new Date(j.runAt).getTime() <= now) || null;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveAccountMapForKit(kit, linkedAccounts) {
  const map = kit.accountMap || {};
  const resolved = {};
  Object.entries(map).forEach(([platform, accountId]) => {
    if (!accountId) return;
    const acc = linkedAccounts.find((a) => a.id === accountId);
    if (acc) resolved[platform] = acc;
  });
  return resolved;
}

async function processBrowserBatchQueue(store, deps, onProgress) {
  if (isRunning(store)) return { skipped: true, reason: 'batch_already_running' };

  const job = getDueJob(store);
  if (!job) return { processed: 0 };

  const {
    applyKitViaBrowser,
    uploadKitToLinkedAccounts,
    accountCreator,
    resolveKeys,
    pushKitSchedule,
  } = deps;

  setRunning(store, true);
  const queue = getQueue(store);
  const idx = queue.findIndex((j) => j.id === job.id);
  if (idx < 0) {
    setRunning(store, false);
    return { processed: 0 };
  }

  queue[idx].status = 'running';
  queue[idx].startedAt = new Date().toISOString();
  saveQueue(store, queue);

  const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
  const linkedAccounts = JSON.parse(store.getItem(`linkedAccounts_${job.campaignId}`) || '[]');

  try {
    for (let i = 0; i < job.kitIds.length; i++) {
      const kitId = job.kitIds[i];
      const kit = accountCreator.getKitById(store, job.campaignId, kitId);
      if (!kit) {
        queue[idx].results.push({ kitId, success: false, error: 'Kit not found.' });
        continue;
      }

      queue[idx].currentKitId = kitId;
      saveQueue(store, queue);
      onProgress?.({ batchId: job.id, kitId, kitName: kit.name, index: i + 1, total: job.kitIds.length, step: 'browser' });

      const browserResult = await applyKitViaBrowser(store, kit, {
        platforms: job.platforms || kit.platforms,
        mode: job.mode,
        headless: job.headless,
        keepBrowserOpen: false,
        delayBetweenPlatformsMs: job.delayBetweenPlatformsMs,
      });

      kit.browserAppliedAt = new Date().toISOString();
      kit.browserResults = browserResult.results;
      kit.lastBatchId = job.id;
      accountCreator.saveKit(store, kit);

      const entry = { kitId, kitName: kit.name, browser: browserResult };

      if (job.alsoUploadApi) {
        onProgress?.({ batchId: job.id, kitId, kitName: kit.name, index: i + 1, total: job.kitIds.length, step: 'api_upload' });
        const accountMap = resolveAccountMapForKit(kit, linkedAccounts);
        entry.apiUpload = await uploadKitToLinkedAccounts(store, kit, keys, {
          platforms: kit.platforms,
          accountMap,
        });
        kit.apiUploadedAt = new Date().toISOString();
        kit.apiUploadResults = entry.apiUpload;
        accountCreator.saveKit(store, kit);
      }

      if (job.alsoPushCalendar && pushKitSchedule) {
        onProgress?.({ batchId: job.id, kitId, kitName: kit.name, index: i + 1, total: job.kitIds.length, step: 'calendar' });
        entry.calendar = pushKitSchedule(kit, job.campaignId);
      }

      queue[idx].results.push(entry);

      if (i < job.kitIds.length - 1) {
        await delay(job.delayBetweenKitsMs);
      }
    }

    queue[idx].status = 'completed';
    queue[idx].completedAt = new Date().toISOString();
    queue[idx].currentKitId = null;
  } catch (err) {
    queue[idx].status = 'failed';
    queue[idx].error = err.message;
    queue[idx].completedAt = new Date().toISOString();
    queue[idx].currentKitId = null;
  } finally {
    saveQueue(store, queue);
    setRunning(store, false);
  }

  return { processed: 1, batchId: job.id, status: queue[idx].status };
}

function runBatchNow(store, batchId) {
  const queue = getQueue(store);
  const job = queue.find((j) => j.id === batchId);
  if (!job) return { success: false, error: 'Batch not found.' };
  if (job.status === 'running') return { success: false, error: 'Batch is already running.' };
  job.runAt = new Date().toISOString();
  job.status = 'queued';
  saveQueue(store, queue);
  return { success: true, job };
}

function getBatchStatus(store) {
  const queue = getQueue(store);
  return {
    running: isRunning(store),
    queued: queue.filter((j) => j.status === 'queued').length,
    completed: queue.filter((j) => j.status === 'completed').length,
    failed: queue.filter((j) => j.status === 'failed').length,
    jobs: queue.slice(-20).reverse(),
  };
}

module.exports = {
  STORAGE_KEY,
  getQueue,
  enqueueBatch,
  cancelBatch,
  runBatchNow,
  processBrowserBatchQueue,
  getBatchStatus,
  parseRunAt,
};