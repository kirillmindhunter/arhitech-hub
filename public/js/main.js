/* ===== AI Architect Hub v4 — main.js =====
   Интерактив: кастомный курсор, magnetic-кнопки, spotlight,
   scroll progress, counter-up, scramble-text, tilt,
   command bar (Cmd/Ctrl+K), parallax, particles canvas. */
(function(){
'use strict';

const isTouch = matchMedia('(hover:none)').matches;

/* 1. КАСТОМНЫЙ КУРСОР */
function initCursor(){
  if (isTouch) return;
  if (document.documentElement.getAttribute('data-cursor') === 'default') return;
  if (document.querySelector('.cursor-dot')) return;
  const dot = document.createElement('div'); dot.className='cursor-dot';
  const ring = document.createElement('div'); ring.className='cursor-ring';
  document.body.append(dot, ring);
  let mx=innerWidth/2, my=innerHeight/2, rx=mx, ry=my;
  addEventListener('mousemove', e => { mx=e.clientX; my=e.clientY; dot.style.transform=`translate(${mx}px,${my}px) translate(-50%,-50%)`; });
  (function loop(){
    rx += (mx-rx)*.18; ry += (my-ry)*.18;
    ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
    requestAnimationFrame(loop);
  })();
  addEventListener('mousedown', ()=> ring.classList.add('click'));
  addEventListener('mouseup',   ()=> ring.classList.remove('click'));
  const hoverable = 'a,button,.cat-card,.ai-card,.plan,.feat,textarea,input,select,.cmd-item,.aside-card,.pack,.hdr-btn,.user-avatar';
  document.addEventListener('mouseover', e => { if(e.target.closest(hoverable)) ring.classList.add('hover'); });
  document.addEventListener('mouseout',  e => { if(e.target.closest(hoverable)) ring.classList.remove('hover'); });
}
initCursor();
// Реинициализация при переключении пользователем
new MutationObserver(() => {
  if (document.documentElement.getAttribute('data-cursor') !== 'default') initCursor();
}).observe(document.documentElement, { attributes:true, attributeFilter:['data-cursor'] });

/* 2. PROGRESS BAR */
const progress = document.createElement('div'); progress.className='scroll-progress'; document.body.appendChild(progress);
const updProg = () => {
  const h = document.documentElement;
  const p = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
  progress.style.width = (p||0) + '%';
};
addEventListener('scroll', updProg, {passive:true}); updProg();

/* 3. HEADER SCROLLED */
const header = document.querySelector('.main-header');
const onScroll = () => { if(!header) return; header.classList.toggle('scrolled', scrollY > 30); };
addEventListener('scroll', onScroll, {passive:true}); onScroll();

/* 4. REVEAL */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
}, {threshold:.08, rootMargin:'0px 0px -50px 0px'});
document.querySelectorAll('.reveal,.reveal-left').forEach(el => io.observe(el));

/* 5. SPOTLIGHT */
document.querySelectorAll('.cat-card,.ai-card,.plan').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX-r.left)/r.width*100)+'%');
    card.style.setProperty('--my', ((e.clientY-r.top)/r.height*100)+'%');
  });
});

/* 6. TILT */
if(!isTouch){
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX-r.left)/r.width - .5;
      const y = (e.clientY-r.top)/r.height - .5;
      card.style.transform = `translateY(-6px) perspective(900px) rotateY(${x*5}deg) rotateX(${-y*5}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform=''; });
  });
}

/* 7. MAGNETIC */
if(!isTouch){
  document.querySelectorAll('.btn-primary,.nav-cta').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2;
      const y = e.clientY - r.top - r.height/2;
      btn.style.transform = `translate(${x*.18}px,${y*.25}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform=''; });
  });
}

/* 8. COUNTER */
const animateCount = el => {
  const target = el.dataset.count;
  const suffix = el.dataset.suffix || '';
  const num = parseFloat(target);
  if(isNaN(num)){ el.textContent = target + suffix; return; }
  const dur = 1400; const start = performance.now();
  (function tick(t){
    const p = Math.min(1, (t-start)/dur);
    const eased = 1 - Math.pow(1-p, 3);
    const val = num * eased;
    el.textContent = (num % 1 === 0 ? Math.round(val) : val.toFixed(1)) + suffix;
    if(p < 1) requestAnimationFrame(tick);
    else el.textContent = target + suffix;
  })(start);
};
const countObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting){ animateCount(e.target); countObs.unobserve(e.target); } });
}, {threshold:.4});
document.querySelectorAll('[data-count]').forEach(el => countObs.observe(el));

/* 9. SCRAMBLE */
const scrambleEl = document.querySelector('[data-scramble]');
if(scrambleEl){
  const words = (scrambleEl.dataset.scramble || '').split('|');
  const chars = '!<>-_\\/[]{}—=+*^?#________';
  let idx = 0;
  const setText = newText => {
    const old = scrambleEl.textContent || '';
    const len = Math.max(old.length, newText.length);
    const queue = [];
    for(let i=0;i<len;i++){
      const from = old[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random()*40);
      const end = start + Math.floor(Math.random()*40);
      queue.push({from,to,start,end,char:''});
    }
    let frame = 0;
    return new Promise(res => {
      (function upd(){
        let output = ''; let complete = 0;
        queue.forEach(q => {
          if(frame >= q.end){ complete++; output += q.to; }
          else if(frame >= q.start){
            if(!q.char || Math.random()<.28) q.char = chars[Math.floor(Math.random()*chars.length)];
            output += `<span style="color:var(--accent-3);opacity:.7">${q.char}</span>`;
          } else { output += q.from; }
        });
        scrambleEl.innerHTML = output;
        if(complete === queue.length) res();
        else { frame++; requestAnimationFrame(upd); }
      })();
    });
  };
  (async function loop(){
    while(true){
      await setText('> ' + words[idx]);
      await new Promise(r => setTimeout(r, 2400));
      idx = (idx+1) % words.length;
    }
  })();
}

/* 10. PROMO CLOSE */
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const id = btn.getAttribute('data-close');
    const el = document.getElementById(id);
    if(el){
      el.style.transition='opacity .25s,transform .25s,max-height .3s,margin .3s,padding .3s';
      el.style.opacity='0'; el.style.transform='translateY(-6px)';
      setTimeout(()=>{ el.style.display='none'; }, 280);
      try{ localStorage.setItem('promo_closed_'+id,'1'); }catch(e){}
    }
  });
});
document.querySelectorAll('[id^="promo"]').forEach(el => {
  try{ if(localStorage.getItem('promo_closed_'+el.id)==='1') el.style.display='none'; }catch(e){}
});

/* 11. SMOOTH ANCHOR */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if(href.length > 1){
      const t = document.querySelector(href);
      if(t){ e.preventDefault(); t.scrollIntoView({behavior:'smooth',block:'start'}); }
    }
  });
});

/* 12. PARALLAX */
if(!isTouch){
  const hv = document.querySelector('.hero-visual');
  if(hv){
    hv.addEventListener('mousemove', e => {
      const r = hv.getBoundingClientRect();
      const x = (e.clientX-r.left)/r.width - .5;
      const y = (e.clientY-r.top)/r.height - .5;
      hv.querySelectorAll('.hv-card').forEach((c,i) => {
        const k = (i+1)*8;
        c.style.transform = `translate(${x*k}px,${y*k}px)`;
      });
    });
    hv.addEventListener('mouseleave', () => {
      hv.querySelectorAll('.hv-card').forEach(c => c.style.transform='');
    });
  }
}

/* 13. CANVAS PARTICLES */
const canvas = document.getElementById('heroCanvas');
if(canvas){
  const ctx = canvas.getContext('2d');
  let w, h, particles=[];
  const resize = () => {
    const dpr = devicePixelRatio || 1;
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w*dpr; canvas.height = h*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  const initP = () => {
    const N = Math.min(60, Math.floor(w*h/14000));
    particles = Array.from({length:N}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35,
      r: Math.random()*1.6+.6
    }));
  };
  let mouseX=-9999, mouseY=-9999;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX-r.left; mouseY = e.clientY-r.top;
  });
  canvas.addEventListener('mouseleave', ()=>{ mouseX=mouseY=-9999; });
  resize(); initP(); addEventListener('resize', ()=>{ resize(); initP(); });
  (function tick(){
    ctx.clearRect(0,0,w,h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if(p.x<0||p.x>w) p.vx*=-1;
      if(p.y<0||p.y>h) p.vy*=-1;
      const dx = mouseX-p.x, dy = mouseY-p.y, d2 = dx*dx+dy*dy;
      if(d2 < 14000){ const f = .0006; p.vx += dx*f; p.vy += dy*f; }
      p.vx*=.985; p.vy*=.985;
      ctx.fillStyle='rgba(200,255,58,.85)';
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });
    for(let i=0;i<particles.length;i++){
      for(let j=i+1;j<particles.length;j++){
        const a=particles[i], b=particles[j];
        const dx=a.x-b.x, dy=a.y-b.y, d=Math.sqrt(dx*dx+dy*dy);
        if(d<90){
          ctx.strokeStyle=`rgba(200,255,58,${(1-d/90)*.25})`;
          ctx.lineWidth=.6;
          ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        }
      }
    }
    requestAnimationFrame(tick);
  })();
}

/* 14. COMMAND BAR */
const cmdData = [
  {label:'Визуализация и рендер',  tag:'CAT', url:'/pages/visualization.html'},
  {label:'Текст, ТЗ и расчёты',    tag:'CAT', url:'/pages/text-ai.html'},
  {label:'BIM и САПР-помощники',   tag:'CAT', url:'/pages/bim-ai.html'},
  {label:'Анализ и расчёты',       tag:'CAT', url:'/pages/analysis.html'},
  {label:'Планировки и генплан',   tag:'CAT', url:'/pages/planning.html'},
  {label:'Стройплощадка и контроль',tag:'CAT',url:'/pages/construction.html'},
  {label:'Рабочая зона (чат)',     tag:'GO',  url:'/#workspace'},
  {label:'Тарифы',                 tag:'GO',  url:'/#pricing'},
  {label:'Личный кабинет',         tag:'GO',  url:'/cabinet.html'},
  {label:'Вход / Регистрация',     tag:'GO',  url:'/login.html'},
  {label:'Midjourney',             tag:'AI',  url:'https://midjourney.com', ext:true},
  {label:'ChatGPT (GPT-4o)',       tag:'AI',  url:'https://chat.openai.com', ext:true},
  {label:'Claude 3.5',             tag:'AI',  url:'https://claude.ai', ext:true},
  {label:'DeepSeek',               tag:'AI',  url:'https://deepseek.com', ext:true},
  {label:'GigaChat',               tag:'AI',  url:'https://giga.chat', ext:true},
  {label:'YandexGPT',              tag:'AI',  url:'https://ya.ru/gpt', ext:true}
];

const fab = document.createElement('a');
fab.className='cmd-fab'; fab.href='#';
fab.innerHTML='<span>⌘ Быстрый поиск</span><kbd>Ctrl K</kbd>';
document.body.appendChild(fab);

const overlay = document.createElement('div');
overlay.className='cmd-overlay';
overlay.innerHTML = `
  <div class="cmd-modal">
    <input type="text" id="cmdInput" placeholder="Поиск по платформе… (нейросети, разделы, тарифы)" autofocus>
    <div class="cmd-list" id="cmdList"></div>
  </div>`;
document.body.appendChild(overlay);
const cmdInput = overlay.querySelector('#cmdInput');
const cmdList  = overlay.querySelector('#cmdList');
let cmdIdx = 0;

function renderCmd(filter=''){
  const f = filter.trim().toLowerCase();
  const items = cmdData.filter(d => !f || d.label.toLowerCase().includes(f));
  cmdList.innerHTML = items.map((d,i) =>
    `<a class="cmd-item${i===cmdIdx?' active':''}" href="${d.url}" ${d.ext?'target="_blank" rel="noopener"':''} data-i="${i}">
      <span>${d.label}</span><span class="tag">${d.tag}</span>
    </a>`).join('') || '<div class="cmd-item" style="opacity:.6">Ничего не найдено</div>';
}
function openCmd(){ overlay.classList.add('open'); cmdInput.value=''; cmdIdx=0; renderCmd(); setTimeout(()=>cmdInput.focus(),50); }
function closeCmd(){ overlay.classList.remove('open'); }
fab.addEventListener('click', e => { e.preventDefault(); openCmd(); });
overlay.addEventListener('click', e => { if(e.target===overlay) closeCmd(); });
addEventListener('keydown', e => {
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); overlay.classList.contains('open')?closeCmd():openCmd(); }
  if(e.key==='Escape' && overlay.classList.contains('open')) closeCmd();
  if(overlay.classList.contains('open') && (e.key==='ArrowDown'||e.key==='ArrowUp')){
    e.preventDefault();
    const items = cmdList.querySelectorAll('.cmd-item[data-i]');
    if(!items.length) return;
    cmdIdx = (cmdIdx + (e.key==='ArrowDown'?1:-1) + items.length) % items.length;
    items.forEach((it,i)=> it.classList.toggle('active', i===cmdIdx));
    items[cmdIdx].scrollIntoView({block:'nearest'});
  }
  if(overlay.classList.contains('open') && e.key==='Enter'){
    const items = cmdList.querySelectorAll('.cmd-item[data-i]');
    if(items[cmdIdx]) items[cmdIdx].click();
  }
});
cmdInput.addEventListener('input', e => { cmdIdx=0; renderCmd(e.target.value); });

})();
