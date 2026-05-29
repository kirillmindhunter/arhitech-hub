/* ============================================================
   ai-api.js — клиент чата (через серверный прокси)
   Ключи API больше НЕ хранятся в браузере.
   Все запросы идут через /api/ai/chat с JWT-cookie.
   ============================================================ */
(function(){
const chatForm = document.getElementById('chatForm');
if (!chatForm) return;

let MODELS = [];
let currentChatId = null;
let history = []; // {role, content}[]
let currentModel = 'gpt-4o-mini';

const providerSel = document.getElementById('provider');
const status = document.getElementById('chatStatus');
const messagesBox = document.getElementById('chatMessages');

// Загружаем список моделей с сервера
async function loadModels(){
  try {
    const r = await fetch('/api/ai/models');
    MODELS = await r.json();
  } catch { MODELS = []; }
  // подменяем селектор
  if (providerSel) {
    providerSel.innerHTML = MODELS.map(m =>
      `<option value="${m.id}">${m.name} · ≈${m.estimate} ✦</option>`
    ).join('');
    providerSel.value = currentModel;
    providerSel.addEventListener('change', () => {
      currentModel = providerSel.value;
      updateStatus();
    });
  }
  updateStatus();
}

function updateStatus(){
  if (!status) return;
  const m = MODELS.find(x => x.id === currentModel);
  status.textContent = m ? `Готов · ${m.name}` : 'Готов';
}

async function sendMessage(text){
  // блокируем форму
  const submitBtn = chatForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  // отрисовка
  appendMessage('user', text);
  const loadingDiv = appendMessage('assistant', '<span class="loader"></span> думает...');
  history.push({ role: 'user', content: text });

  try {
    const r = await fetch('/api/ai/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentModel,
        messages: history,
        chatId: currentChatId
      })
    });
    const data = await r.json();

    if (r.status === 401) {
      loadingDiv.innerHTML = '<strong>ИИ-Ассистент</strong>🔒 Нужна авторизация. <a href="/login.html" style="color:var(--accent)">Войти →</a>';
      return;
    }
    if (r.status === 402) {
      loadingDiv.innerHTML = `<strong>ИИ-Ассистент</strong>⚡ ${data.error}<br><br><a href="/cabinet.html#billing" class="btn btn-primary" style="display:inline-block;margin-top:8px">Пополнить искры →</a>`;
      return;
    }
    if (!r.ok) {
      loadingDiv.innerHTML = '<strong>ИИ-Ассистент</strong>❌ ' + (data.error || 'Ошибка');
      return;
    }

    currentChatId = data.chatId;
    history.push({ role: 'assistant', content: data.reply });
    loadingDiv.innerHTML = `<strong>ИИ-Ассистент</strong>${formatMessage(data.reply)}
      <div style="margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--text-mute)">
        ✦ ${data.sparks_cost} списано · баланс ${data.sparks_balance} ✦
      </div>`;
    // обновим счётчик в шапке
    if (window.AHub) window.AHub.refreshBalance();
  } catch (e) {
    loadingDiv.innerHTML = '<strong>ИИ-Ассистент</strong>❌ Сеть: ' + e.message;
  } finally {
    submitBtn.disabled = false;
  }
}

function appendMessage(role, htmlContent){
  const div = document.createElement('div');
  div.className = 'message ' + (role === 'user' ? 'user-message' : 'ai-message');
  div.innerHTML = role === 'user'
    ? `<strong>Вы</strong>${escapeHtml(htmlContent)}`
    : `<strong>ИИ-Ассистент</strong>${htmlContent}`;
  messagesBox.appendChild(div);
  messagesBox.scrollTop = messagesBox.scrollHeight;
  return div;
}

function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function formatMessage(t){
  return escapeHtml(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await sendMessage(text);
});

loadModels();
})();
