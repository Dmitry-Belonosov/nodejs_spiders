/**
 * Password login with a signed cookie session.
 *
 * Uploading a spider means uploading executable code, so the UI must never be
 * open. If ADMIN_PASSWORD is unset the platform only accepts connections from
 * localhost and says so loudly at startup.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'sp_session';
const SESSION_DAYS = 7;

function isEnabled() {
  return !!process.env.ADMIN_PASSWORD;
}

function secret() {
  const value = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
  if (!value) throw new Error('SESSION_SECRET/ADMIN_PASSWORD are not configured');
  return value;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

function createToken() {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > Date.now();
  } catch (e) {
    return false;
  }
}

function checkPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) return false;
  const a = crypto.createHash('sha256').update(String(candidate)).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

function isLoopback(req) {
  const ip = req.ip || req.connection.remoteAddress || '';
  return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
}

function requireAuth(req, res, next) {
  if (!isEnabled()) {
    if (isLoopback(req)) return next();
    return res.status(403).json({
      error: 'ADMIN_PASSWORD is not set, so only localhost access is allowed',
    });
  }
  if (verifyToken(req.cookies && req.cookies[COOKIE_NAME])) return next();

  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'authentication required' });
  return res.redirect('/login');
}

module.exports = {
  COOKIE_NAME,
  isEnabled,
  createToken,
  verifyToken,
  checkPassword,
  cookieOptions,
  requireAuth,
  isLoopback,
};
