/* ============================================================
   ЕДИНЫЙ ИНТЕРФЕЙС К ИИ-ПРОВАЙДЕРАМ
   Все запросы идут с серверных ключей — пользователь не видит их.
   ============================================================ */

const fetch = require('node-fetch');

const SYSTEM_PROMPT_DEFAULT = `Ты — экспертный ассистент в области архитектуры, проектирования и строительства.
Помогаешь составлять ТЗ, спецификации, пояснительные записки, делать инженерные расчёты,
подбирать материалы, описывать узлы и решения. Отвечай структурированно, по-русски,
с заголовками и списками. Ссылайся на действующие СП, СНиПы и ГОСТы где это уместно.`;

const SYSTEM_PROMPT_NORMS = `Ты — специализированный ИИ-помощник по российским строительным нормам.
База: СП, СНиП, ГОСТ, ФЗ 384, ФЗ 261. ВНИМАНИЕ: эта функция в режиме beta —
указывай номер документа, но обязательно предупреждай пользователя, что
точные формулировки нужно сверять с официальной версией на minstroyrf.gov.ru
или в системах «Техэксперт»/«Гарант».`;

// ---------- OpenAI ----------
async function callOpenAI(model, messages, opts = {}) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
    },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 2000 })
  });
  if (!r.ok) throw new Error('OpenAI: ' + (await r.text()));
  const data = await r.json();
  return {
    text: data.choices[0].message.content,
    tokensIn: data.usage.prompt_tokens,
    tokensOut: data.usage.completion_tokens
  };
}

// ---------- Anthropic Claude ----------
async function callAnthropic(model, messages, opts = {}) {
  const sys = messages.find(m => m.role === 'system')?.content || SYSTEM_PROMPT_DEFAULT;
  const userMsgs = messages.filter(m => m.role !== 'system');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model === 'claude-3-5-sonnet' ? 'claude-3-5-sonnet-20241022'
            : model === 'claude-3-5-haiku' ? 'claude-3-5-haiku-20241022' : model,
      max_tokens: opts.maxTokens ?? 2000,
      system: sys,
      messages: userMsgs
    })
  });
  if (!r.ok) throw new Error('Anthropic: ' + (await r.text()));
  const data = await r.json();
  return {
    text: data.content[0].text,
    tokensIn: data.usage.input_tokens,
    tokensOut: data.usage.output_tokens
  };
}

// ---------- DeepSeek (OpenAI-совместимый) ----------
async function callDeepSeek(model, messages, opts = {}) {
  const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 2000 })
  });
  if (!r.ok) throw new Error('DeepSeek: ' + (await r.text()));
  const data = await r.json();
  return {
    text: data.choices[0].message.content,
    tokensIn: data.usage.prompt_tokens,
    tokensOut: data.usage.completion_tokens
  };
}

// ---------- Qwen (Alibaba DashScope) ----------
async function callQwen(model, messages, opts = {}) {
  const r = await fetch('https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + process.env.QWEN_API_KEY },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 2000 })
  });
  if (!r.ok) throw new Error('Qwen: ' + (await r.text()));
  const data = await r.json();
  return {
    text: data.choices[0].message.content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0
  };
}

// ---------- GigaChat (Сбер) ----------
let gigaToken = null;
let gigaTokenExp = 0;
async function getGigaToken() {
  if (gigaToken && Date.now() < gigaTokenExp) return gigaToken;
  const r = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + process.env.GIGACHAT_AUTH_KEY,
      'RqUID': require('crypto').randomUUID(),
      'Accept': 'application/json'
    },
    body: 'scope=GIGACHAT_API_PERS'
  });
  if (!r.ok) throw new Error('GigaChat auth: ' + (await r.text()));
  const data = await r.json();
  gigaToken = data.access_token;
  gigaTokenExp = data.expires_at - 60_000;
  return gigaToken;
}
async function callGigaChat(model, messages, opts = {}) {
  const token = await getGigaToken();
  const r = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      model: model === 'gigachat-pro' ? 'GigaChat-Pro' : 'GigaChat',
      messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 2000
    })
  });
  if (!r.ok) throw new Error('GigaChat: ' + (await r.text()));
  const data = await r.json();
  return {
    text: data.choices[0].message.content,
    tokensIn: data.usage?.prompt_tokens || 0,
    tokensOut: data.usage?.completion_tokens || 0
  };
}

// ---------- YandexGPT ----------
async function callYandexGPT(model, messages, opts = {}) {
  const folderId = process.env.YANDEX_FOLDER_ID;
  const modelUri = `gpt://${folderId}/yandexgpt/latest`;
  const r = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Api-Key ' + process.env.YANDEX_GPT_API_KEY },
    body: JSON.stringify({
      modelUri,
      completionOptions: { temperature: opts.temperature ?? 0.6, maxTokens: opts.maxTokens ?? 2000 },
      messages: messages.map(m => ({ role: m.role, text: m.content }))
    })
  });
  if (!r.ok) throw new Error('YandexGPT: ' + (await r.text()));
  const data = await r.json();
  const out = data.result.alternatives[0].message.text;
  return {
    text: out,
    tokensIn: parseInt(data.result.usage.inputTextTokens || 0),
    tokensOut: parseInt(data.result.usage.completionTokens || 0)
  };
}

// ---------- Главный маршрутизатор ----------
async function chat({ model, messages, systemPrompt }) {
  // подставляем системный промпт, если его нет
  if (!messages.find(m => m.role === 'system')) {
    const sys = model === 'engineer-norm-ai' ? SYSTEM_PROMPT_NORMS : (systemPrompt || SYSTEM_PROMPT_DEFAULT);
    messages = [{ role: 'system', content: sys }, ...messages];
  }

  // Спец-модель «нормативка» — пока крутим под Claude
  if (model === 'engineer-norm-ai') {
    return callAnthropic('claude-3-5-sonnet', messages);
  }

  if (model.startsWith('gpt-') || model.startsWith('o1')) return callOpenAI(model, messages);
  if (model.startsWith('claude-'))                         return callAnthropic(model, messages);
  if (model.startsWith('deepseek-'))                       return callDeepSeek(model, messages);
  if (model.startsWith('qwen-'))                           return callQwen(model, messages);
  if (model.startsWith('gigachat-'))                       return callGigaChat(model, messages);
  if (model.startsWith('yandexgpt-'))                      return callYandexGPT(model, messages);

  throw new Error('Неизвестная модель: ' + model);
}

module.exports = { chat, SYSTEM_PROMPT_DEFAULT };
