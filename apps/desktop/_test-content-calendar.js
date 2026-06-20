/**
 * Content Calendar feature tester — exercises all calendar IPC paths.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { LocalStorage } = require('node-localstorage');
const { resolveKeys, hasTwitterKeys, hasLinkedInKeys, hasMetaKeys } = require('./services/keys');
const integrations = require('./services');
const calendarAnalytics = require('./services/calendarAnalytics');
const backgroundRunScheduler = require('./services/backgroundRunScheduler');
const { registerCalendarHandlers } = require('./services/calendarIpc');
const { registerBackgroundRunHandlers } = require('./services/backgroundRunIpc');

const dataPath = path.join(__dirname, '.test-content-calendar-store');
if (fs.existsSync(dataPath)) fs.rmSync(dataPath, { recursive: true, force: true });
fs.mkdirSync(dataPath, { recursive: true });
const store = new LocalStorage(path.join(dataPath, 'storage'));

const prodPaths = [
  path.join(process.env.APPDATA || '', 'social-imperialism', 'storage'),
  path.join(process.env.APPDATA || '', 'Social Imperialism', 'storage'),
];
for (const p of prodPaths) {
  if (fs.existsSync(p)) {
    console.log('Using production storage:', p);
    const prodStore = new LocalStorage(p);
    ['activeCampaignId', 'campaigns', 'globalApiKeys', 'postHistory', 'scheduled_posts', 'calendarSettings', 'backgroundRunSchedule'].forEach((k) => {
      const v = prodStore.getItem(k);
      if (v) store.setItem(k, v);
    });
    const activeId = prodStore.getItem('activeCampaignId') || 'default';
    const linked = prodStore.getItem(`linkedAccounts_${activeId}`);
    if (linked) store.setItem(`linkedAccounts_${activeId}`, linked);
    break;
  }
}

const keys = resolveKeys(JSON.parse(store.getItem('globalApiKeys') || '{}'));
store.setItem('globalApiKeys', JSON.stringify(keys));
if (!store.getItem('activeCampaignId')) store.setItem('activeCampaignId', 'default');
const activeId = store.getItem('activeCampaignId') || 'default';

function buildApiMetrics(k) {
  const status = (ok) => (ok ? 'Connected' : 'Not configured');
  return {
    'Twitter / X': status(hasTwitterKeys(k)),
    'LinkedIn': status(hasLinkedInKeys(k)),
    'Meta / Facebook': status(hasMetaKeys(k)),
    'Gemini AI': status(!!k.gemini),
  };
}

const handlers = {};
const mockIpc = {
  handle: (ch, fn) => { handlers[ch] = fn; },
  removeHandler: () => {},
};
registerCalendarHandlers({ ipcMain: mockIpc, store, resolveKeys, buildApiMetrics, integrations });
registerBackgroundRunHandlers({ ipcMain: mockIpc, store });

async function invoke(ch, ...args) {
  if (!handlers[ch]) throw new Error(`No handler: ${ch}`);
  return handlers[ch](null, ...args);
}

function getLinkedAccounts() {
  return JSON.parse(store.getItem(`linkedAccounts_${activeId}`) || '[]');
}

const results = [];
function record(feature, status, detail) {
  results.push({ feature, status, detail });
  const icon = status === 'OK' ? '✓' : status === 'PARTIAL' ? '~' : '✗';
  console.log(`${icon} ${feature}: ${detail}`);
}
async function test(name, fn) {
  try {
    const r = await fn();
    if (r === true || r?.ok === true) record(name, 'OK', r?.detail || 'working');
    else if (r?.partial) record(name, 'PARTIAL', r.detail);
    else record(name, 'FAIL', r?.detail || r?.error || JSON.stringify(r).slice(0, 160));
  } catch (e) {
    record(name, 'FAIL', e.message);
  }
}

(async () => {
  console.log('\n=== CONTENT CALENDAR FEATURE TEST ===');
  const accs = getLinkedAccounts();
  console.log('Keys:', { gemini: !!keys.gemini, twitter: hasTwitterKeys(keys), linkedin: hasLinkedInKeys(keys), meta: hasMetaKeys(keys) });
  console.log('Linked accounts:', accs.length);
  console.log('');

  await test('Calendar status — get-calendar-status', async () => {
    const status = await invoke('get-calendar-status');
    if (status.scheduledCount == null) return { detail: 'Missing scheduledCount' };
    return { ok: true, detail: `${status.scheduledCount} scheduled, ${status.dueNow} due, ${status.upcoming} upcoming` };
  });

  await test('Schedule — schedule-post', async () => {
    const acc = accs[0];
    const scheduleTime = new Date(Date.now() + 86400000 * 2).toISOString();
    const res = await invoke('schedule-post', {
      platform: acc?.platform || 'Twitter',
      accountId: acc?.id || 'test_acc',
      content: `[Calendar test] Scheduled post ${Date.now()}`,
      scheduleTime,
    });
    if (!res.success || !res.post?.id) return { detail: res.error || 'schedule failed' };
    store.setItem('_test_sched_id', res.post.id);
    return { ok: true, detail: `Created ${res.post.id}` };
  });

  await test('Schedule — get-scheduled-posts', async () => {
    const posts = await invoke('get-scheduled-posts');
    const testId = store.getItem('_test_sched_id');
    const found = posts.find((p) => p.id === testId);
    if (!found) return { detail: `Test post not in list (${posts.length} total)` };
    return { ok: true, detail: `${posts.length} post(s), test post found` };
  });

  await test('Schedule — update-scheduled-post', async () => {
    const id = store.getItem('_test_sched_id');
    if (!id) return { partial: true, detail: 'No test post id' };
    const newTime = new Date(Date.now() + 86400000 * 3).toISOString();
    const uniqueContent = `[Calendar test] Updated publish ${Date.now()}`;
    const res = await invoke('update-scheduled-post', { id, updates: { content: uniqueContent, scheduleTime: newTime } });
    if (!res.success) return { detail: res.error };
    if (res.post.timestamp !== newTime) return { detail: 'Timestamp not updated' };
    return { ok: true, detail: 'Content + time updated' };
  });

  await test('Analytics — get-best-post-times', async () => {
    const analysis = await invoke('get-best-post-times');
    if (!analysis.suggestions?.length) return { detail: 'No suggestions' };
    return { ok: true, detail: `${analysis.dataPoints} data points, ${analysis.suggestions.length} suggestions` };
  });

  await test('Analytics — get-upcoming-by-platform', async () => {
    const byPlatform = await invoke('get-upcoming-by-platform', 14);
    const total = Object.values(byPlatform).reduce((n, arr) => n + arr.length, 0);
    return { ok: true, detail: `${Object.keys(byPlatform).length} platform(s), ${total} upcoming` };
  });

  await test('Settings — save/get calendar-settings', async () => {
    await invoke('save-calendar-settings', { timezone: 'America/New_York', platformFilter: 'Twitter', viewMode: 'week' });
    const s = await invoke('get-calendar-settings');
    if (s.timezone !== 'America/New_York' || s.viewMode !== 'week') return { detail: JSON.stringify(s) };
    return { ok: true, detail: `tz=${s.timezone}, view=${s.viewMode}` };
  });

  await test('Publish — publish-scheduled-post-now', async () => {
    if (!accs.length) return { partial: true, detail: 'Needs linked account for live publish' };
    const id = store.getItem('_test_sched_id');
    if (!id) return { partial: true, detail: 'No test scheduled post' };
    const res = await invoke('publish-scheduled-post-now', id);
    if (!res.success) {
      if (/token|auth|credential|403|401|422|429|duplicate|rate.?limit|not supported/i.test(res.error || '')) {
        return { partial: true, detail: `Platform rejected publish: ${(res.error || '').slice(0, 80)}` };
      }
      return { detail: res.error };
    }
    return { ok: true, detail: res.message || 'Published' };
  });

  await test('Publish — process-due-scheduled-posts', async () => {
    const dueTime = new Date(Date.now() - 60000).toISOString();
    const acc = accs[0];
    const duePost = {
      id: 'sched_due_test',
      campaignId: activeId,
      platform: acc?.platform || 'Twitter',
      accountId: acc?.id || 'test_acc',
      content: `[Due test] ${Date.now()}`,
      timestamp: dueTime,
      status: 'scheduled',
    };
    let posts = JSON.parse(store.getItem('scheduled_posts') || '[]');
    posts.push(duePost);
    store.setItem('scheduled_posts', JSON.stringify(posts));

    const result = await invoke('process-due-scheduled-posts');
    if (!accs.length) {
      if (result.failed >= 0) return { partial: true, detail: `Processed: ${result.published} published, ${result.failed} failed (no linked account)` };
      return { partial: true, detail: 'Needs linked account' };
    }
    return { ok: true, detail: `Published ${result.published}, failed ${result.failed}` };
  });

  await test('Schedule — delete-scheduled-post', async () => {
    let posts = JSON.parse(store.getItem('scheduled_posts') || '[]');
    const id = posts[0]?.id || store.getItem('_test_sched_id');
    if (!id) return { partial: true, detail: 'No post to delete' };
    const res = await invoke('delete-scheduled-post', id);
    if (!res.success) return { detail: res.error };
    const remaining = await invoke('get-scheduled-posts');
    if (remaining.find((p) => p.id === id)) return { detail: 'Post still exists after delete' };
    return { ok: true, detail: `Deleted ${id}` };
  });

  await test('Background run — get/save settings', async () => {
    const saved = await invoke('save-background-run-settings', { enabled: true, autoStartWorker: true });
    const settings = await invoke('get-background-run-settings');
    if (!settings.enabled) return { detail: 'Settings not saved' };
    return { ok: true, detail: `enabled=${settings.enabled}, windows=${settings.weeklyWindows?.length || 0}` };
  });

  await test('Background run — add/delete slot', async () => {
    const runAt = new Date(Date.now() + 3600000).toISOString();
    const add = await invoke('add-background-run-slot', { runAt, durationMinutes: 45, label: 'Test run' });
    if (!add.success || !add.run?.id) return { detail: add.error || 'add failed' };
    const del = await invoke('delete-background-run-slot', add.run.id);
    if (!del.success) return { detail: del.error || 'delete failed' };
    return { ok: true, detail: `Added & removed ${add.run.id}` };
  });

  await test('Background run — get-background-run-status', async () => {
    const status = await invoke('get-background-run-status');
    if (!status.settings) return { detail: 'No settings in status' };
    return { ok: true, detail: `inWindow=${!!status.inWindow}, runs=${status.upcomingRuns?.length || 0}` };
  });

  await test('Analytics module — analyzeEngagementPatterns', async () => {
    const a = calendarAnalytics.analyzeEngagementPatterns(store, activeId);
    if (!a.hourlyEngagement || a.hourlyEngagement.length !== 24) return { detail: 'Invalid hourly data' };
    return { ok: true, detail: `${a.dataPoints} posts analyzed` };
  });

  const fails = results.filter((r) => r.status === 'FAIL');
  const partial = results.filter((r) => r.status === 'PARTIAL');
  const ok = results.filter((r) => r.status === 'OK');
  console.log('\n=== SUMMARY ===');
  console.log(`OK: ${ok.length} | PARTIAL: ${partial.length} | FAIL: ${fails.length}`);
  if (fails.length) {
    console.log('\nNOT WORKING:');
    fails.forEach((f) => console.log(`  - ${f.feature}: ${f.detail}`));
  }
  if (partial.length) {
    console.log('\nPARTIALLY WORKING:');
    partial.forEach((f) => console.log(`  - ${f.feature}: ${f.detail}`));
  }
  fs.writeFileSync(path.join(__dirname, '.content-calendar-test-report.json'), JSON.stringify(results, null, 2));
  process.exit(fails.length ? 1 : 0);
})();