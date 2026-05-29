/* Прокси к ИИ + списание искр */
const router = require('express').Router();
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const { chat } = require('../services/ai-providers');
const { calcSparks, MODELS, estimateSparks } = require('../services/pricing');

// Список доступных моделей
router.get('/models', (req, res) => {
  const list = Object.entries(MODELS).map(([id, m]) => ({
    id, name: m.name, provider: m.provider,
    estimate: estimateSparks(id, 2000)
  }));
  res.json(list);
});

// Основной чат-вызов
router.post('/chat', authRequired, async (req, res) => {
  const { model, messages, chatId, systemPrompt } = req.body || {};
  if (!model || !Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: 'Нужны model и messages' });
  if (!MODELS[model]) return res.status(400).json({ error: 'Неизвестная модель' });

  // Проверка прав по подписке
  const user = req.user;
  const plan = user.subscription_plan || 'free';
  if (plan === 'free' && ['o1-preview', 'engineer-norm-ai'].includes(model))
    return res.status(403).json({ error: 'Эта модель доступна на тарифах Engineer/Company. Оформите подписку.' });

  // Проверка баланса (по приблизительной оценке)
  const estimate = estimateSparks(model, 2000);
  if (user.sparks_balance < estimate)
    return res.status(402).json({ error: `Недостаточно искр. Нужно ≈${estimate} ✦, у вас ${user.sparks_balance} ✦.`, need_topup: true });

  try {
    const result = await chat({ model, messages, systemPrompt });
    const cost = calcSparks(model, result.tokensIn, result.tokensOut);

    // Списываем атомарно
    const tx = db.transaction(() => {
      const current = db.prepare('SELECT sparks_balance FROM users WHERE id = ?').get(user.id);
      if (current.sparks_balance < cost) throw new Error('NOT_ENOUGH');
      const newBalance = current.sparks_balance - cost;
      db.prepare('UPDATE users SET sparks_balance = ? WHERE id = ?').run(newBalance, user.id);
      db.prepare(`INSERT INTO transactions (user_id, type, amount, balance_after, meta)
                  VALUES (?, 'spend', ?, ?, ?)`)
        .run(user.id, -cost, newBalance,
             JSON.stringify({ model, tokens_in: result.tokensIn, tokens_out: result.tokensOut }));

      // сохраняем сообщения
      let cid = chatId;
      if (!cid) {
        const title = (messages[messages.length - 1]?.content || 'Чат').slice(0, 60);
        cid = db.prepare('INSERT INTO chats (user_id, title, model) VALUES (?, ?, ?)')
                .run(user.id, title, model).lastInsertRowid;
      }
      const last = messages[messages.length - 1];
      db.prepare('INSERT INTO chat_messages (chat_id, role, content) VALUES (?, ?, ?)')
        .run(cid, last.role, last.content);
      db.prepare('INSERT INTO chat_messages (chat_id, role, content, sparks_cost) VALUES (?, ?, ?, ?)')
        .run(cid, 'assistant', result.text, cost);

      return { newBalance, cid };
    });
    const { newBalance, cid } = tx();
    res.json({
      ok: true,
      reply: result.text,
      chatId: cid,
      sparks_cost: cost,
      sparks_balance: newBalance,
      tokens: { in: result.tokensIn, out: result.tokensOut }
    });
  } catch (e) {
    if (e.message === 'NOT_ENOUGH') return res.status(402).json({ error: 'Баланс закончился во время запроса', need_topup: true });
    console.error('AI error:', e);
    res.status(500).json({ error: 'Ошибка ИИ: ' + e.message });
  }
});

// История чатов
router.get('/chats', authRequired, (req, res) => {
  const list = db.prepare(
    'SELECT id, title, model, created_at FROM chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(list);
});

router.get('/chats/:id', authRequired, (req, res) => {
  const c = db.prepare('SELECT * FROM chats WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!c) return res.status(404).json({ error: 'Чат не найден' });
  const msgs = db.prepare('SELECT role, content, sparks_cost, created_at FROM chat_messages WHERE chat_id = ? ORDER BY id').all(c.id);
  res.json({ chat: c, messages: msgs });
});

module.exports = router;
