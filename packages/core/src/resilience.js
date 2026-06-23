/**
 * Error taxonomy + circuit breaker for external API stability.
 */
const circuits = new Map();

const RETRYABLE_PATTERNS = [
  /timeout/i, /ECONNRESET/i, /ECONNREFUSED/i, /ETIMEDOUT/i,
  /503/, /502/, /429/, /rate limit/i, /temporarily unavailable/i,
];

function classifyError(err) {
  const msg = err?.message || String(err);
  const code = err?.code || err?.response?.status;
  const retryable = RETRYABLE_PATTERNS.some((p) => p.test(msg) || (code && p.test(String(code))));
  return {
    message: msg,
    code: err?.code || (retryable ? 'RETRYABLE' : 'FATAL'),
    retryable,
    statusCode: err?.response?.status,
  };
}

function wrapInvokeError(err) {
  const info = classifyError(err);
  const wrapped = new Error(info.message);
  wrapped.code = err?.code || info.code;
  wrapped.retryable = info.retryable;
  wrapped.statusCode = info.statusCode;
  return wrapped;
}

function getCircuit(name) {
  if (!circuits.has(name)) {
    circuits.set(name, { failures: 0, openUntil: 0, threshold: 5, cooldownMs: 60000 });
  }
  return circuits.get(name);
}

function circuitAllows(name) {
  const c = getCircuit(name);
  return Date.now() >= c.openUntil;
}

function circuitSuccess(name) {
  const c = getCircuit(name);
  c.failures = 0;
  c.openUntil = 0;
}

function circuitFailure(name) {
  const c = getCircuit(name);
  c.failures += 1;
  if (c.failures >= c.threshold) {
    c.openUntil = Date.now() + c.cooldownMs;
    console.warn(`[circuit] ${name} open for ${c.cooldownMs / 1000}s`);
  }
}

async function withRetry(fn, { maxAttempts = 3, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const info = classifyError(e);
      if (!info.retryable || i === maxAttempts - 1) throw wrapInvokeError(e);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw wrapInvokeError(lastErr);
}

function getCircuitStatus() {
  const out = {};
  for (const [name, c] of circuits) {
    out[name] = {
      failures: c.failures,
      open: Date.now() < c.openUntil,
      openUntil: c.openUntil || null,
    };
  }
  return out;
}

module.exports = {
  classifyError,
  wrapInvokeError,
  circuitAllows,
  circuitSuccess,
  circuitFailure,
  withRetry,
  getCircuitStatus,
};