const API = 'https://api.socialimperialism.com';
const EMAIL = 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD;

async function invoke(token, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ args }),
  });
  const json = await res.json();
  return json.data ?? json;
}

(async () => {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  if (!login.token) throw new Error('Login failed');

  const sync = await invoke(login.token, 'sync-dns-sites');
  console.log('sync', sync.count, 'sites');

  const sites = await invoke(login.token, 'get-dns-sites');
  console.log('sites', sites.isAdmin ? 'ADMIN' : 'client', (sites.sites || []).map((s) => `${s.domain} [${s.scope}/${s.source}]`));

  const cfg = await invoke(login.token, 'get-dns-config');
  console.log('config', { route53: cfg.route53Configured, types: cfg.recordTypes?.length });

  const first = sites.sites?.[0];
  if (first) {
    const recs = await invoke(login.token, 'get-dns-records', first.id);
    console.log('records for', first.domain, (recs.records || []).length);
  }
})();