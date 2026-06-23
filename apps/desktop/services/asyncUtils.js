/**
 * Promise helpers for SaaS handlers — avoid ALB/CloudFront 504s on slow upstream calls.
 */
function withTimeout(promise, ms, fallback = null) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { withTimeout };