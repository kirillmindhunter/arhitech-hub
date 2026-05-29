/* ============================================================
   ЭКОНОМИКА «ИСКР» (✦)
   1 ✦ = 1 ₽ внутреннего баланса.
   Стоимость моделей считается через коэффициент наценки
   и реальную цену API (USD → RUB).
   ============================================================ */

const USD_RUB = 100;          // курс пересчёта (можно автоматизировать позже)
const MARGIN = 1.7;           // наценка ×1.7 над себестоимостью

// Цены поставщиков (USD за 1M токенов) — обновляйте при изменении тарифов
const MODELS = {
  // OpenAI
  'gpt-4o':           { provider: 'openai',    in: 5.00, out: 15.00, name: 'GPT-4o' },
  'gpt-4o-mini':      { provider: 'openai',    in: 0.15, out: 0.60,  name: 'GPT-4o mini' },
  'o1-preview':       { provider: 'openai',    in: 15.0, out: 60.0,  name: 'OpenAI o1' },

  // Anthropic
  'claude-3-5-sonnet':{ provider: 'anthropic', in: 3.00, out: 15.00, name: 'Claude 3.5 Sonnet' },
  'claude-3-5-haiku': { provider: 'anthropic', in: 0.80, out: 4.00,  name: 'Claude 3.5 Haiku' },

  // DeepSeek
  'deepseek-chat':    { provider: 'deepseek',  in: 0.14, out: 0.28,  name: 'DeepSeek V3' },
  'deepseek-reasoner':{ provider: 'deepseek',  in: 0.55, out: 2.19,  name: 'DeepSeek R1' },

  // Alibaba Qwen
  'qwen-max':         { provider: 'qwen',      in: 1.60, out: 6.40,  name: 'Qwen Max' },

  // Российские (цены условные в RUB — пересчитайте под Yandex Cloud / SberCloud)
  'gigachat-pro':     { provider: 'gigachat',  in_rub: 1.50, out_rub: 1.50, name: 'GigaChat Pro' },
  'yandexgpt-pro':    { provider: 'yandex',    in_rub: 1.20, out_rub: 1.20, name: 'YandexGPT Pro' },

  // Спец-ассистент (используем под капотом claude / gpt + RAG-промпт)
  'engineer-norm-ai': { provider: 'internal',  in: 3.00, out: 15.00, name: 'СНиП/ГОСТ-ассистент (beta)' }
};

/**
 * Сколько искр спишется за реальный вызов
 * @param {string} model - ключ из MODELS
 * @param {number} tokensIn
 * @param {number} tokensOut
 * @returns {number} количество искр (округлено вверх, минимум 1)
 */
function calcSparks(model, tokensIn, tokensOut) {
  const m = MODELS[model];
  if (!m) return 1;
  let rub;
  if (m.in_rub != null) {
    rub = (tokensIn * m.in_rub + tokensOut * m.out_rub) / 1000; // цена за 1k токенов
  } else {
    const usd = (tokensIn * m.in + tokensOut * m.out) / 1_000_000;
    rub = usd * USD_RUB;
  }
  return Math.max(1, Math.ceil(rub * MARGIN));
}

/**
 * Примерная цена в искрах до отправки (для UI «стоит ≈ N ✦»)
 */
function estimateSparks(model, approxTokens = 2000) {
  // считаем как 30% input / 70% output
  return calcSparks(model, Math.round(approxTokens * 0.3), Math.round(approxTokens * 0.7));
}

// ===== Тарифные планы =====
const PLANS = {
  free: {
    name: 'Free',
    price_rub: 0,
    sparks_per_month: 0,
    features: ['Стартовые 50 ✦ при регистрации', 'Доступ к каталогу', 'Базовые модели']
  },
  eco: {
    name: 'ECO',
    price_rub: 490,
    sparks_per_month: 700,
    features: [
      '700 ✦ ежемесячно',
      'Все модели GPT-4o mini, Claude Haiku, DeepSeek',
      'История чатов 30 дней',
      'Без рекламы'
    ]
  },
  engineer: {
    name: 'Engineer',
    price_rub: 1490,
    sparks_per_month: 2500,
    features: [
      '2 500 ✦ ежемесячно',
      'Все модели + GPT-4o, Claude 3.5 Sonnet',
      'СНиП/ГОСТ-ассистент (beta)',
      'Шаблоны ТЗ и промптов',
      'Экспорт в PDF / DOCX',
      'Приоритетная поддержка'
    ]
  },
  company: {
    name: 'Company',
    price_rub: 5900,
    sparks_per_month: 12000,
    features: [
      '12 000 ✦ ежемесячно',
      'До 10 пользователей',
      'Все модели включая OpenAI o1',
      'Общая база промптов команды',
      'White-label',
      'Поддержка SLA 24ч'
    ]
  }
};

// Разовые пакеты «искр»
const SPARK_PACKS = [
  { id: 'pack_300',  rub: 290,  sparks: 300,  bonus: 0,   label: '300 ✦' },
  { id: 'pack_1000', rub: 890,  sparks: 1000, bonus: 100, label: '1 000 ✦ +100 бонус' },
  { id: 'pack_3000', rub: 2490, sparks: 3000, bonus: 500, label: '3 000 ✦ +500 бонус' },
  { id: 'pack_10000',rub: 7900, sparks: 10000,bonus: 2000,label: '10 000 ✦ +2 000 бонус' }
];

module.exports = { MODELS, PLANS, SPARK_PACKS, calcSparks, estimateSparks };
