/* ============================================================
   ВЕБХУКИ ОТ ПЛАТЁЖНЫХ СИСТЕМ
   ЮKassa POST → /api/webhooks/yookassa
   Robokassa POST → /api/webhooks/robokassa (Result URL)
   ============================================================ */

const router = require('express').Router();
const crypto = require('crypto');
const { db } = require('../db');
const { PLANS } = require('../services/pricing');

function applyPayment(payment) {
  const tx = db.transaction(() => {
    const u = db.prepare('SELECT sparks_balance FROM users WHERE id = ?').get(payment.user_id);
    const newBalance = u.sparks_balance + payment.sparks_to_add;
    db.prepare('UPDATE users SET sparks_balance = ? WHERE id = ?').run(newBalance, payment.user_id);

    if (payment.plan) {
      const monthLater = new Date(Date.now() + 30 * 86400_000).toISOString();
      db.prepare('UPDATE users SET subscription_plan = ?, subscription_until = ? WHERE id = ?')
        .run(payment.plan, monthLater, payment.user_id);
    }

    db.prepare(`INSERT INTO transactions (user_id, type, amount, balance_after, meta)
                VALUES (?, ?, ?, ?, ?)`)
      .run(payment.user_id,
           payment.plan ? 'subscription' : 'topup',
           payment.sparks_to_add,
           newBalance,
           JSON.stringify({ payment_id: payment.id, provider: payment.provider, rub: payment.amount_rub, plan: payment.plan }));

    db.prepare('UPDATE payments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('succeeded', payment.id);
  });
  tx();
}

// ===== ЮKassa =====
router.post('/yookassa', async (req, res) => {
  // ЮKassa шлёт JSON, тело уже распаршено express.json()
  const event = req.body;
  if (!event || !event.object) return res.json({});

  if (event.event === 'payment.succeeded') {
    const externalId = event.object.id;
    const meta = event.object.metadata || {};
    const internalId = parseInt(meta.internal_payment_id);
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(internalId);
    if (payment && payment.status !== 'succeeded') {
      db.prepare('UPDATE payments SET external_id = ? WHERE id = ?').run(externalId, payment.id);
      applyPayment(payment);
      console.log(`[ЮKassa] Платёж #${payment.id} проведён: +${payment.sparks_to_add} ✦ пользователю ${payment.user_id}`);
    }
  }
  res.json({ ok: true });
});

// ===== Robokassa Result URL =====
router.post('/robokassa', (req, res) => {
  const { OutSum, InvId, SignatureValue } = req.body;
  const pass2 = process.env.ROBOKASSA_PASSWORD_2;
  const expected = crypto.createHash('md5')
    .update(`${OutSum}:${InvId}:${pass2}`).digest('hex').toUpperCase();
  if (expected !== (SignatureValue || '').toUpperCase()) {
    return res.status(400).send('bad sign');
  }
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(InvId);
  if (payment && payment.status !== 'succeeded') {
    applyPayment(payment);
    console.log(`[Robokassa] Платёж #${payment.id} проведён: +${payment.sparks_to_add} ✦`);
  }
  res.send(`OK${InvId}`);
});

module.exports = router;
