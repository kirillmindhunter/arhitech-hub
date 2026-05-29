/* Профиль пользователя, баланс, история транзакций */
const router = require('express').Router();
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');

router.get('/me', authRequired, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    sparks_balance: req.user.sparks_balance,
    subscription_plan: req.user.subscription_plan,
    subscription_until: req.user.subscription_until
  });
});

router.get('/transactions', authRequired, (req, res) => {
  const list = db.prepare(`
    SELECT id, type, amount, balance_after, meta, created_at
    FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 100
  `).all(req.user.id);
  res.json(list.map(t => ({ ...t, meta: t.meta ? JSON.parse(t.meta) : null })));
});

router.get('/payments', authRequired, (req, res) => {
  const list = db.prepare(`
    SELECT id, provider, amount_rub, sparks_to_add, plan, status, created_at, completed_at
    FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 50
  `).all(req.user.id);
  res.json(list);
});

module.exports = router;
