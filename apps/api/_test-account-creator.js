/**
 * Account Creator — focused QA (all IPC channels).
 */
const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

const CHANNELS = [
  { name: 'Creator status', channel: 'get-account-creator-status', validate: (d) => d && typeof d === 'object' && Array.isArray(d.platforms) },
  { name: 'Proxy pool', channel: 'get-proxy-pool', validate: (d) => Array.isArray(d) },
  { name: 'Profile kits', channel: 'get-profile-kits', validate: (d) => Array.isArray(d) },
  { name: 'Linked accounts for kit', channel: 'get-linked-accounts-for-kit', args: [{ platforms: ['LinkedIn', 'Twitter'] }], validate: (d) => Array.isArray(d) },
  { name: 'Browser batch status', channel: 'get-browser-batch-status', validate: (d) => typeof d === 'object' && Array.isArray(d.jobs) && typeof d.queued === 'number' },
  { name: 'Save proxy', channel: 'save-proxy', args: [{ label: 'QA-Test', host: '127.0.0.1', port: 8888, protocol: 'http' }], validate: (d) => d?.success && d?.proxy?.id },
  { name: 'Import proxies bulk', channel: 'import-proxies-bulk', args: [{ text: 'QA-Bulk|10.0.0.50:3128\n10.0.0.51:3129', protocol: 'http' }], validate: (d) => d?.success && d?.count >= 1 },
  { name: 'Test proxy', channel: 'test-proxy', args: [], dynamicProxy: true, validate: (d) => typeof d === 'object' },
  { name: 'Generate kit', channel: 'generate-profile-kit', args: [{ personaName: 'QA Persona', platforms: ['LinkedIn'], generateAssets: false, scheduleWeeks: 1, postsPerWeek: 1 }], validate: (d) => d && (d.id || d.kit?.id) && !d.error, slow: true },
  { name: 'Export kit', channel: 'export-profile-kit', args: [], dynamicKit: true, validate: (d) => d?.success || d?.filePath },
  { name: 'Push calendar', channel: 'push-kit-schedule-to-calendar', args: [], dynamicKit: true, validate: (d) => typeof d === 'object' },
  { name: 'Save account map', channel: 'save-kit-account-map', args: [], dynamicKit: true, validate: (d) => d?.success !== false },
  { name: 'Schedule batch', channel: 'schedule-browser-batch', args: [], dynamicKit: true, scheduleBatch: true, validate: (d) => d?.success && d?.job?.id },
  { name: 'Bulk generate', channel: 'generate-bulk-profile-kits', args: [{ count: 1, generateAssets: false }], validate: (d) => d?.kits || d?.count, slow: true },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'login failed');
  return { token: json.token, projectId: json.project?.id };
}

async function invoke(token, projectId, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': projectId,
    },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return { ok: res.ok, data: json.data ?? json, error: json.error };
}

async function run() {
  console.log('\n=== ACCOUNT CREATOR QA ===\n');
  const { token, projectId } = await login();
  let proxyId = null;
  let kitId = null;
  const results = [];

  for (const ch of CHANNELS) {
    try {
      let args = [...(ch.args || [])];
      if (ch.dynamicProxy && proxyId) args = [proxyId];
      if (ch.dynamicKit && kitId) {
        if (ch.channel === 'export-profile-kit' || ch.channel === 'push-kit-schedule-to-calendar' || ch.channel === 'save-kit-account-map') {
          args = [{ kitId }];
        }
        if (ch.scheduleBatch) {
          args = [{ kitIds: [kitId], mode: 'edit', alsoUploadApi: true, alsoPushCalendar: false }];
        }
      }
      if (ch.dynamicProxy && !proxyId && ch.channel === 'test-proxy') {
        results.push({ name: ch.name, status: 'SKIP', note: 'no proxy' });
        continue;
      }
      if (ch.dynamicKit && !kitId && ['export-profile-kit', 'push-kit-schedule-to-calendar', 'save-kit-account-map', 'schedule-browser-batch'].includes(ch.channel)) {
        results.push({ name: ch.name, status: 'SKIP', note: 'no kit' });
        continue;
      }

      const { ok, data, error } = await invoke(token, projectId, ch.channel, args);
      if (!ok) throw new Error(error || 'invoke failed');
      if (!ch.validate(data)) throw new Error(`validation failed: ${JSON.stringify(data).slice(0, 120)}`);

      if (ch.channel === 'save-proxy' && data?.proxy?.id) proxyId = data.proxy.id;
      if (ch.channel === 'generate-profile-kit') kitId = data?.id || data?.kit?.id;
      if (ch.channel === 'schedule-browser-batch' && data?.job?.id) {
        try { await invoke(token, projectId, 'cancel-browser-batch', [data.job.id]); } catch { /* ignore */ }
      }

      results.push({ name: ch.name, status: 'PASS' });
      console.log(`  ✓ ${ch.name}`);
    } catch (e) {
      results.push({ name: ch.name, status: 'FAIL', note: e.message });
      console.log(`  ✗ ${ch.name}: ${e.message}`);
    }
  }

  if (proxyId) {
    try {
      await invoke(token, projectId, 'delete-proxy', [proxyId]);
      console.log('  ✓ Cleanup proxy');
    } catch { /* ignore */ }
  }

  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL');
  console.log(`\n=== ${pass}/${results.length} PASS ===`);
  if (fail.length) {
    console.log('\nFailures:');
    fail.forEach((f) => console.log(`  - ${f.name}: ${f.note}`));
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });