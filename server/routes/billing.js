/* ============================================================
   БИЛЛИНГ: создание платежей в ЮKassa / Robokassa
   и подписки.
   ============================================================ */

const router = require('express').Router();
const fetch = require('node-fetch');
const crypto = require('crypto');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const { PLANS, SPARK_PACKS } = require('../services/pricing');

router.get('/plans', (req, res) => res.json(PLANS));
router.get('/packs', (req, res) => res.json(SPARK_PACKS));

// ===== Создание разового платежа (пополнение искр) или подписки =====
router.post('/create-payment', authRequired, async (req, res) => {
  const { method, target, targetId } = req.body || {};
  // method: 'yookassa' | 'robokassa'
  // target: 'pack' (пакет искр)  | 'plan' (подписка)

  let amount = 0, sparks = 0, plan = null, description = '';

  if (target === 'pack') {
    const pack = SPARK_PACKS.find(p => p.id === targetId);
    if (!pack) return res.status(400).json({ error: 'Пакет не найден' });
    amount = pack.rub;
    sparks = pack.sparks + (pack.bonus || 0);
    description = `Пополнение: ${pack.label}`;
  } else if (target === 'plan') {
    const p = PLANS[targetId];
    if (!p || targetId === 'free') return res.status(400).json({ error: 'Тариф не найден' });
    amount = p.price_rub;
    sparks = p.sparks_per_month;
    plan = targetId;
    description = `Подписка «${p.name}» на месяц`;
  } else {
    return res.status(400).json({ error: 'Неверный target' });
  }

  // Создаём запись о платеже
  const paymentRow = db.prepare(`
    INSERT INTO payments (user_id, provider, amount_rub, sparks_to_add, plan, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(req.user.id, method, amount, sparks, plan);
  const paymentId = paymentRow.lastInsertRowid;

  try {
    let redirectUrl;
    if (method === 'yookassa') {
      redirectUrl = await createYooKassaPayment({ paymentId, amount, description, userEmail: req.user.email });
    } else if (method === 'robokassa') {
      redirectUrl = createRobokassaPayment({ paymentId, amount, description });
    } else {
      return res.status(400).json({ error: 'Метод оплаты не поддерживается' });
    }
    res.json({ ok: true, redirectUrl, paymentId });
  } catch (e) {
    db.prepare('UPDATE payments SET status = ? WHERE id = ?').run('failed', paymentId);
    res.status(500).json({ error: e.message });
  }
});

// ===== ЮKassa =====
async function createYooKassaPayment({ paymentId, amount, description, userEmail }) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) throw new Error('ЮKassa не настроена (укажите ключи в .env)');

  const idempotenceKey = crypto.randomUUID();
  const r = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey,
      'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64')
    },
    body: JSON.stringify({
      amount: { value: amount.toFixed(2), currency: 'RUB' },
      capture: true,
      description,
      metadata: { internal_payment_id: paymentId },
      confirmation: {
        type: 'redirect',
        return_url: (process.env.SITE_URL || 'http://localhost:3000') + '/cabinet.html?payment=success'
      },
      receipt: userEmail ? {
        customer: { email: userEmail },
        items: [{
          description: description.slice(0, 128),
          quantity: '1.00',
          amount: { value: amount.toFixed(2), currency: 'RUB' },
          vat_code: 1,
          payment_subject: 'service',
          payment_mode: 'full_payment'
        }]
      } : undefined
    })
  });
  if (!r.ok) throw new Error('ЮKassa: ' + (await r.text()));
  const data = await r.json();
  db.prepare('UPDATE payments SET external_id = ? WHERE id = ?').run(data.id, paymentId);
  return data.confirmation.confirmation_url;
}

// ===== Robokassa (формирование URL с подписью) =====
function createRobokassaPayment({ paymentId, amount, description }) {
  const login = process.env.ROBOKASSA_LOGIN;
  const pass1 = process.env.ROBOKASSA_PASSWORD_1;
  if (!login || !pass1) throw new Error('Robokassa не настроена (укажите ключи в .env)');

  const outSum = amount.toFixed(2);
  const invId  = paymentId;
  // подпись: MerchantLogin:OutSum:InvId:Password1
  const signature = crypto.createHash('md5')
    .update(`${login}:${outSum}:${invId}:${pass1}`)
    .digest('hex');
  const params = new URLSearchParams({
    MerchantLogin: login,
    OutSum: outSum,
    InvId: String(invId),
    Description: description.slice(0, 100),
    SignatureValue: signature,
    IsTest: process.env.ROBOKASSA_TEST_MODE === '1' ? '1' : '0',
    Culture: 'ru'
  });
  return 'https://auth.robokassa.ru/Merchant/Index.aspx?' + params.toString();
}

module.exports = router;
