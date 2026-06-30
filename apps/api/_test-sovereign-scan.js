/**
 * Verify Sovereign scan allows legitimate login/OAuth/credential IPC payloads.
 * Usage: node apps/api/_test-sovereign-scan.js
 */
const assert = require('assert');
const {
  scanRequestSurface,
  redactSensitiveFields,
  TRUSTED_CREDENTIAL_CHANNELS,
} = require('../../packages/core/src/sovereignThreatCapture');

function mockReq({ channel, body, path = `/api/invoke/${channel}` }) {
  return {
    path,
    originalUrl: path,
    params: { channel },
    body,
    query: {},
    headers: { 'user-agent': 'SocialImperialism-QA/1.0' },
  };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed += 1;
  }
}

console.log('SOVEREIGN SCAN — false positive checks\n');

test('connect-platform with password in args is allowed', () => {
  const req = mockReq({
    channel: 'connect-platform',
    body: {
      args: [{
        platform: 'LinkedIn',
        method: 'credentials',
        email: 'michaelk@tsbrenterprises.com',
        password: 'TestPass123!example',
      }],
    },
  });
  const hits = scanRequestSurface(req);
  assert.strictEqual(hits.length, 0, `unexpected hits: ${JSON.stringify(hits)}`);
});

test('save-global-keys with secrets in args is allowed', () => {
  const req = mockReq({
    channel: 'save-global-keys',
    body: {
      args: [{ twSecret: 'abc', linkedinAccessToken: 'token123', fbSecret: 'xyz' }],
    },
  });
  const hits = scanRequestSurface(req);
  assert.strictEqual(hits.length, 0, `unexpected hits: ${JSON.stringify(hits)}`);
});

test('begin-platform-oauth with email is allowed', () => {
  const req = mockReq({
    channel: 'begin-platform-oauth',
    body: { args: [{ platform: 'LinkedIn', email: 'michaelk@tsbrenterprises.com' }] },
  });
  const hits = scanRequestSurface(req);
  assert.strictEqual(hits.length, 0);
});

test('SQLi probe in query is still blocked', () => {
  const req = mockReq({
    channel: 'get-dashboard-stats',
    body: { args: [] },
  });
  req.query = { q: "' OR 1=1 --" };
  const hits = scanRequestSurface(req);
  assert.ok(hits.some((h) => h.id === 'sqli_probe'), 'expected sqli hit');
});

test('redactSensitiveFields strips password values', () => {
  const out = redactSensitiveFields({ email: 'a@b.com', password: 'secret123' });
  assert.strictEqual(out.password, '[REDACTED]');
  assert.strictEqual(out.email, 'a@b.com');
});

test('TRUSTED_CREDENTIAL_CHANNELS includes connect-platform', () => {
  assert.ok(TRUSTED_CREDENTIAL_CHANNELS.has('connect-platform'));
});

test('THEE_MICHAEL approve/deny/undo workflow', () => {
  const {
    captureThreatEvent,
    theeMichaelDecideThreat,
    theeMichaelUndoAction,
    getActionHistoryRedacted,
    readContainment,
    ADMIN_IDENTITY,
  } = require('../../packages/core/src/sovereignThreatCapture');

  const store = {
    projectId: 'test',
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
  };

  const ev = captureThreatEvent(store, {
    source: 'test',
    module: 'Test',
    channel: 'test-channel',
    severity: 'high',
    summary: 'Test threat for THEE_MICHAEL review',
    autoContain: true,
  });
  assert.strictEqual(ev.adminDecision, 'pending');

  process.env.SEED_EMAIL = 'admin@test.com';
  const deny = theeMichaelDecideThreat(store, { eventId: ev.eventId, decision: 'deny', email: 'admin@test.com' });
  assert.strictEqual(deny.success, true);
  assert.strictEqual(deny.adminDecision, 'denied');

  const undo = theeMichaelUndoAction(store, { actionId: deny.action.actionId, email: 'admin@test.com' });
  assert.strictEqual(undo.success, true);

  const approve = theeMichaelDecideThreat(store, { eventId: ev.eventId, decision: 'approve', email: 'admin@test.com' });
  assert.strictEqual(approve.success, true);
  assert.strictEqual(approve.adminDecision, 'approved');
  assert.strictEqual(readContainment(store).liveFrozen, false);

  const history = getActionHistoryRedacted(store);
  assert.ok(history.length >= 2);
  assert.strictEqual(ADMIN_IDENTITY, 'THEE_MICHAEL');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);