const API = 'https://api.socialimperialism.com';
const EMAIL = 'theesaintmichael@gmail.com';
const PASS = 'Kingme05$';

async function invoke(token, channel, args = []) {
  const res = await fetch(`${API}/api/invoke/${channel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ args }),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch (e) { throw new Error(`${channel} non-JSON: ${text.slice(0, 120)}`); }
}

(async () => {
  const health = await fetch(`${API}/health`);
  console.log('health', health.status, await health.text());

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const login = await loginRes.json();
  if (!login.token) throw new Error(login.error || 'Login failed');
  const token = login.token;

  const unwrap = (r) => r?.data ?? r;

  const conn = unwrap(await invoke(token, 'test-email-connections'));
  console.log('connections', JSON.stringify({
    acumbamail: conn.acumbamail?.ok,
    acumbamailError: conn.acumbamail?.error,
    vbout: conn.vbout?.ok,
    mailchimp: conn.mailchimp?.ok,
    ses: conn.ses?.ok,
    metrics: conn.apiMetrics,
  }));

  const camps = unwrap(await invoke(token, 'get-email-campaigns'));
  console.log('campaigns', (camps.campaigns || []).map((c) => `${c.name} [${c.trigger}]`));

  const tiny = unwrap(await invoke(token, 'shorten-url', ['https://acmegrowth.com/email-live']));
  console.log('tinyurl', tiny.shortUrl);

  const send = unwrap(await invoke(token, 'send-email', [{
    to: EMAIL,
    subject: 'SI Production Live Test',
    html: '<p>Production email integrations are live.</p>',
    shortenLinks: false,
  }]));
  console.log('send', send.success, send.provider, send.messageId || send.error);

  const auto = unwrap(await invoke(token, 'run-email-auto-reply', [{
    trigger: 'reply.generated',
    data: { platform: 'Twitter', preview: 'Test reply', author: 'test_user' },
  }]));
  console.log('auto-reply', auto.success, (auto.results || []).map((r) => `${r.name}:${r.success ? 'ok' : r.error}`));
})();