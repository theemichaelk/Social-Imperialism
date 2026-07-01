/**
 * QA: Lead capture validation, rate limit middleware, API endpoint.
 * Run: node apps/api/_test-lead-capture.js
 * Optional: API_URL=https://api.socialimperialism.com node apps/api/_test-lead-capture.js
 */
const { leadRateLimit } = require('./src/middleware/leadRateLimit');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

(async () => {
  console.log('\n=== Test 1: leadRateLimit middleware ===');
  {
    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    let statusCode = 200;
    let body = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(payload) { body = payload; return this; },
    };
    const next = () => { /* ok */ };

    for (let i = 0; i < 8; i += 1) {
      leadRateLimit(req, res, next);
    }
    assert('allows 8 requests per window', statusCode === 200);

    leadRateLimit(req, res, next);
    assert('blocks 9th request with 429', statusCode === 429);
    assert('429 returns error message', body?.error?.includes('Too many'));
  }

  console.log('\n=== Test 2: captureLead validation (no DB) ===');
  {
    const { captureLead } = require('./src/services/leadCaptureService');
    let threw = false;
    try {
      await captureLead({ email: 'not-valid' });
    } catch (e) {
      threw = true;
    }
    assert('rejects invalid email', threw);
  }

  console.log('\n=== Test 3: Production API endpoint (optional) ===');
  const apiUrl = (process.env.API_URL || 'https://api.socialimperialism.com').replace(/\/$/, '');
  try {
    const testEmail = `qa-lead-${Date.now()}@audit.socialimperialism.test`;
    const res = await fetch(`${apiUrl}/api/leads/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, name: 'QA Audit', source: 'qa-test' }),
    });
    const data = await res.json();
    assert('POST /api/leads/capture returns 200', res.status === 200);
    assert('response has success', data.success === true);
    assert('response has enrolled', data.enrolled === true);
  } catch (e) {
    console.log(`  ⚠ API test skipped: ${e.message}`);
  }

  console.log('\n════════════════════════════════════════');
  console.log(`Lead capture QA: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});