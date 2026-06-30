const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('@si/db');

const JWT_SECRET = process.env.JWT_SECRET || 'si-dev-secret-change-in-production';
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS || '7', 10);

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

async function createSession(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
    },
  });
}

async function revokeSession(token) {
  const hashed = hashToken(token);
  await prisma.session.deleteMany({ where: { token: hashed } });
}

async function sessionIsActive(token) {
  const hashed = hashToken(token);
  const row = await prisma.session.findUnique({ where: { token: hashed } });
  if (!row) return false;
  if (row.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }
  return true;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const active = await sessionIsActive(token);
    if (!active) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.user = payload;
    req.authToken = token;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  signToken,
  requireAuth,
  JWT_SECRET,
  createSession,
  revokeSession,
  sessionIsActive,
  hashToken,
};