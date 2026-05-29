/* ============================================================
   app.js — общий скрипт для всех страниц
   - Тема (light/dark) + персистенс
   - Переключатель курсора
   - Загрузка профиля и баланса в шапку
   - Меню пользователя
   ============================================================ */
(function(){
'use strict';

// ===== ТЕМА =====
const root = document.documentElement;
const savedTheme = localStorage.getItem('theme');
if (savedTheme) root.setAttribute('data-theme', savedTheme);
else if (matchMedia('(prefers-color-scheme: light)').matches) root.setAttribute('data-theme', 'light');

function toggleTheme(){
  const cur = root.getAttribute('data-theme') || 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  if (next === 'dark') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', 'light');
  localStorage.setItem('theme', next);
  updateThemeBtn();
}
function updateThemeBtn(){
  const btn = document.getElementById('themeBtn');
  if (!btn) return;
  const isLight = root.getAttribute('data-theme') === 'light';
  btn.innerHTML = isLight ? '☀' : '☾';
  btn.title = isLight ? 'Светлая тема — нажмите для тёмной' : 'Тёмная тема — нажмите для светлой';
}

// ===== КУРСОР =====
const savedCursor = localStorage.getItem('cursor');
if (savedCursor === 'default') root.setAttribute('data-cursor', 'default');

function toggleCursor(){
  const cur = root.getAttribute('data-cursor');
  if (cur === 'default') {
    root.removeAttribute('data-cursor');
    localStorage.setItem('cursor', 'custom');
  } else {
    root.setAttribute('data-cursor', 'default');
    localStorage.setItem('cursor', 'default');
  }
  updateCursorBtn();
}
function updateCursorBtn(){
  const btn = document.getElementById('cursorBtn');
  if (!btn) return;
  const isDefault = root.getAttribute('data-cursor') === 'default';
  btn.innerHTML = isDefault ? '↖' : '✦';
  btn.title = isDefault ? 'Обычный курсор — нажмите для анимированного' : 'Анимированный курсор — нажмите для обычного';
}

// ===== ВСТАВКА ПЕРЕКЛЮЧАТЕЛЕЙ И ЮЗЕР-БЛОКА В ХЕДЕР =====
function injectHeaderControls(){
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const navLinks = nav.querySelector('.nav-links');
  if (!navLinks) return;

  // Убираем старую CTA «Pro» из навигации — заменим на динамический блок
  const oldCta = navLinks.querySelector('.nav-cta');
  if (oldCta) oldCta.parentElement.remove();

  // Контейнер справа
  const right = document.createElement('div');
  right.className = 'hdr-toggles';
  right.innerHTML = `
    <span id="hdrBalance" class="hdr-balance" style="display:none">
      <span class="spark">✦</span> <span id="hdrBalanceVal">0</span>
    </span>
    <button class="hdr-btn" id="cursorBtn" aria-label="Переключить курсор">✦</button>
    <button class="hdr-btn" id="themeBtn" aria-label="Переключить тему">☾</button>
    <div id="hdrAuth"></div>
  `;
  nav.appendChild(right);

  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('cursorBtn').addEventListener('click', toggleCursor);
  updateThemeBtn();
  updateCursorBtn();
}

// ===== ЗАГРУЗКА ПРОФИЛЯ =====
async function loadUser(){
  try {
    const r = await fetch('/api/user/me', { credentials: 'include' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function renderAuthBlock(user){
  const slot = document.getElementById('hdrAuth');
  if (!slot) return;
  if (!user) {
    slot.innerHTML = `<a href="/login.html" class="nav-cta" style="margin-left:8px;padding:9px 18px;background:var(--accent);color:#0a0a0a;border-radius:8px;font-weight:700;font-size:13px">Войти</a>`;
    return;
  }
  // показываем баланс
  const bal = document.getElementById('hdrBalance');
  const balVal = document.getElementById('hdrBalanceVal');
  if (bal) { bal.style.display = ''; balVal.textContent = user.sparks_balance; }

  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  slot.innerHTML = `
    <div class="user-menu">
      <div class="user-avatar" id="userAvatar">${initial}</div>
      <div class="user-dropdown" id="userDropdown">
        <div class="ud-head">
          <strong>${escapeHtml(user.name || 'Пользователь')}</strong>
          <span class="em">${escapeHtml(user.email || '')}</span>
        </div>
        <a href="/cabinet.html">⊟ Личный кабинет</a>
        <a href="/cabinet.html#billing">✦ Кошелёк и тарифы</a>
        <a href="/cabinet.html#history">⌘ История чатов</a>
        <a href="#" id="logoutBtn" class="danger">⏻ Выйти</a>
      </div>
    </div>
  `;
  const av = document.getElementById('userAvatar');
  const dd = document.getElementById('userDropdown');
  av.addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('open'); });
  document.addEventListener('click', e => {
    if (!e.target.closest('.user-menu')) dd.classList.remove('open');
  });
  document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    location.href = '/';
  });
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ===== ЭКСПОРТ ДЛЯ ДРУГИХ СКРИПТОВ =====
window.AHub = {
  loadUser,
  escapeHtml,
  async refreshBalance() {
    const u = await loadUser();
    if (u) {
      const v = document.getElementById('hdrBalanceVal');
      if (v) v.textContent = u.sparks_balance;
    }
    return u;
  }
};

// ===== СТАРТ =====
document.addEventListener('DOMContentLoaded', async () => {
  injectHeaderControls();
  const user = await loadUser();
  renderAuthBlock(user);
});
})();
