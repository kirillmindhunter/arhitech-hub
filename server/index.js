/* ============================================================
   AI Architect Hub — главный серверный файл
   Express + SQLite + JWT + прокси к ИИ + биллинг
   ============================================================ */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/oauth');
const billingRoutes = require('./routes/billing');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Базовые middleware =====
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 86400000 }
}));

// ===== Защита от перебора =====
const apiLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

// ===== Роуты =====
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/billing', apiLimiter, billingRoutes);
app.use('/api/ai', apiLimiter, aiRoutes);
app.use('/api/user', apiLimiter, userRoutes);
app.use('/api/webhooks', webhookRoutes); // без лимитера — приходит от платёжек

// ===== Статика =====
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA-fallback на index.html для красивых URL
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ===== Обработка ошибок =====
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ error: err.message || 'Внутренняя ошибка сервера' });
});

// ===== Старт =====
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✦ AI Architect Hub запущен`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  Режим: ${process.env.NODE_ENV || 'development'}\n`);
  });
});
