/**
 * Email integration smoke test — VBout, MailChimp, SES SMTP, TinyURL, campaigns.
 * Usage: node _test-email-integrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../desktop/.env') });

const path = require('path');
const { LocalStorage } = require('node-localstorage');
const emailService = require(path.join(__dirname, '../desktop/services/emailService'));
const { resolveKeys } = require(path.join(__dirname, '../desktop/services/keys'));

const API = process.env.API_URL || 'https://api.socialimperialism.com';
const EMAIL = process.env.SEED_EMAIL || 'theesaintmichael@gmail.com';
const PASS = process.env.SEED_PASSWORD || 'Kingme05$';

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(data.error || 'Login failed');
  return data.token;
}

async function invoke(token, channel, args = []) {
  const res = await fetch(`${API}/api/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, args }),
  });
  return res.json();
}

async function runLocalTests() {
  const keys = resolveKeys({});
  console.log('\n=== Local provider tests ===');
  const conn = await emailService.testAllConnections(keys);
  console.log('VBout:', conn.vbout?.ok ? 'PASS' : `FAIL — ${conn.vbout?.error}`);
  console.log('MailChimp:', conn.mailchimp?.ok ? 'PASS' : `FAIL — ${conn.mailchimp?.error}`);
  console.log('SES SMTP:', conn.ses?.ok ? 'PASS' : `FAIL — ${conn.ses?.error}`);
  console.log('TinyURL key:', conn.configured?.tinyurl ? 'configured' : 'missing');

  const store = new LocalStorage(path.join(__dirname, '.email-test-store'));
  store.clear();
  const seeded = emailService.ensureEmailCampaigns(store, { brandName: 'Acme Growth Labs', domain: 'acmegrowth.com' });
  console.log(`Email campaigns seeded: ${seeded.campaigns?.length || 0}`);

  if (conn.ses?.ok) {
    const sent = await emailService.sendEmail(keys, {
      to: EMAIL,
      subject: 'Social Imperialism — SES Live Test',
      html: '<p>Amazon SES SMTP is live. <a href="https://acmegrowth.com">Visit site</a></p>',
      provider: 'ses',
      shortenLinks: true,
    });
    console.log('SES send:', sent.success ? `PASS (${sent.messageId})` : 'FAIL');
  }

  return conn;
}

async function runApiTests(token) {
  console.log('\n=== Production API tests ===');
  const tests = [
    { name: 'test-email-connections', channel: 'test-email-connections' },
    { name: 'get-email-campaigns', channel: 'get-email-campaigns' },
    { name: 'shorten-url', channel: 'shorten-url', args: ['https://acmegrowth.com/email-test'] },
    {
      name: 'send-email',
      channel: 'send-email',
      args: [{
        to: EMAIL,
        subject: 'Social Imperialism — Production Email Test',
        html: '<p>All email providers configured and live.</p>',
        shortenLinks: false,
      }],
    },
    {
      name: 'run-email-auto-reply',
      channel: 'run-email-auto-reply',
      args: [{
        trigger: 'reply.generated',
        data: { platform: 'Twitter', preview: 'Test auto-reply preview', author: 'test_user' },
      }],
    },
  ];

  for (const t of tests) {
    try {
      const data = await invoke(token, t.channel, t.args || []);
      const ok = data.success !== false && !data.error;
      console.log(`${t.name}:`, ok ? 'PASS' : `WARN — ${data.error || JSON.stringify(data).slice(0, 120)}`);
      if (t.channel === 'get-email-campaigns' && data.campaigns) {
        data.campaigns.forEach((c) => console.log(`  · ${c.name} [${c.trigger}]`));
      }
      if (t.channel === 'shorten-url' && data.shortUrl) console.log(`  shortUrl: ${data.shortUrl}`);
    } catch (e) {
      console.log(`${t.name}: FAIL — ${e.message}`);
    }
  }
}

(async () => {
  try {
    await runLocalTests();
    const token = await login();
    await runApiTests(token);
    console.log('\nDone.');
  } catch (e) {
    console.error('Test run failed:', e.message);
    process.exit(1);
  }
})();