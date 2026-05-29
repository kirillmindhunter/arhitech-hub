/* JWT-аутентификация */
const jwt = require('jsonwebtoken');
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function signAccessToken(userId) {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(userId) {
  return jwt.sign({ uid: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
}

function authRequired(req, res, next) {
  const token = req.cookies.access_token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, sparks_balance, subscription_plan, subscription_until FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function authOptional(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, sparks_balance, subscription_plan FROM users WHERE id = ?').get(payload.uid);
    if (user) req.user = user;
  } catch {}
  next();
}

module.exports = { signAccessToken, signRefreshToken, authRequired, authOptional, JWT_SECRET };
