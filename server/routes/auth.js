/* Регистрация / вход / выход / refresh */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { db } = require('../db');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
};

const registerSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Пароль минимум 8 символов'),
  name: z.string().min(1).max(80).optional()
});

router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(data.email);
    if (exists) return res.status(400).json({ error: 'Email уже зарегистрирован' });

    const hash = await bcrypt.hash(data.password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name, sparks_balance)
      VALUES (?, ?, ?, 50)
    `).run(data.email, hash, data.name || data.email.split('@')[0]);

    const userId = result.lastInsertRowid;
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_after, meta)
      VALUES (?, 'bonus', 50, 50, ?)
    `).run(userId, JSON.stringify({ reason: 'Стартовые искры за регистрацию' }));

    const access = signAccessToken(userId);
    const refresh = signRefreshToken(userId);
    res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60_000 });
    res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 30 * 86400_000 });
    res.json({ ok: true, user: { id: userId, email: data.email, name: data.name, sparks_balance: 50 } });
  } catch (e) {
    if (e.errors) return res.status(400).json({ error: e.errors[0].message });
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.password_hash) return res.status(400).json({ error: 'Неверный email или пароль' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Неверный email или пароль' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);
  res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60_000 });
  res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 30 * 86400_000 });
  res.json({
    ok: true,
    user: {
      id: user.id, email: user.email, name: user.name,
      sparks_balance: user.sparks_balance,
      subscription_plan: user.subscription_plan
    }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.json({ ok: true });
});

router.post('/refresh', (req, res) => {
  const jwt = require('jsonwebtoken');
  const token = req.cookies.refresh_token;
  if (!token) return res.status(401).json({ error: 'Нет refresh-токена' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const access = signAccessToken(payload.uid);
    res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60_000 });
    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: 'Сессия истекла' });
  }
});

module.exports = router;
