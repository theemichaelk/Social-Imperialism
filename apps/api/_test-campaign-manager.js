/**
 * Campaign Manager — details, pause/resume, update, delete, schedule.
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const API = process.env.API_URL || 'http://localhost:4000';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'login failed');
  return { token: body.token, projectId: body.project?.id };
}

async function invoke(token, projectId, channel, args = []) {
  const argList = Array.isArray(args) ? args : [args];
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-project-id': projectId,
    },
    body: JSON.stringify({ args: argList }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${channel}: ${body.error || res.status}`);
  return body.data;
}

async function main() {
  console.log(`Testing Campaign Manager against ${API}`);
  const { token, projectId } = await login();
  if (!projectId) throw new Error('login missing project id');

  const status = await invoke(token, projectId, 'get-settings-status');
  const campaigns = status.campaigns || [];
  if (!campaigns.length) throw new Error('No campaigns to test');
  const id = status.activeCampaignId || campaigns[0].id;

  const detail = await invoke(token, projectId, 'get-campaign-details', id);
  if (!detail.success) throw new Error('get-campaign-details failed');
  console.log(`  details: ${detail.campaign.brandName} keywords=${detail.stats.keywords} scheduled=${detail.stats.scheduledPosts}`);

  const paused = await invoke(token, projectId, 'pause-campaign', id);
  if (!paused.success) throw new Error('pause-campaign failed');
  console.log('  pause: OK');

  const afterPause = await invoke(token, projectId, 'get-campaign-details', id);
  if (!afterPause.isPaused) throw new Error('expected isPaused after pause');

  const resumed = await invoke(token, projectId, 'resume-campaign', id);
  if (!resumed.success) throw new Error('resume-campaign failed');
  console.log('  resume: OK');

  const sched = await invoke(token, projectId, 'schedule-post', [{
    campaignId: id,
    content: `[CM-TEST] ${Date.now()}`,
    platform: 'Twitter',
    scheduleTime: new Date(Date.now() + 86400000).toISOString(),
  }]);
  if (!sched.success) throw new Error('schedule-post failed');
  console.log('  schedule: OK');

  const posts = await invoke(token, projectId, 'get-scheduled-posts', id);
  const testPost = (posts || []).find((p) => (p.content || '').includes('[CM-TEST]'));
  if (!testPost) throw new Error('scheduled post not found');

  await invoke(token, projectId, 'delete-scheduled-post', testPost.id);

  const tree = await invoke(token, projectId, 'get-verified-node-tree');
  if (!Array.isArray(tree?.nodes)) throw new Error('get-verified-node-tree failed');
  console.log('  verified nodes: OK');
  console.log('  delete scheduled post: OK');

  console.log('\n✓ Campaign Manager handlers OK');
}

main().catch((e) => {
  console.error('\n✗', e.message);
  process.exit(1);
});