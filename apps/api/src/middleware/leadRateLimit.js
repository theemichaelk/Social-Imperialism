/**
 * Simple in-memory rate limit for public lead capture (per IP).
 */
const hits = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 8;

function leadRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (entry.count > MAX_PER_WINDOW) {
    return res.status(429).json({ success: false, error: 'Too many requests — try again later' });
  }
  return next();
}

module.exports = { leadRateLimit };