// assets/js/main.js
import { formatDateTimeIST, el, truncate, safeURL } from './utils.js';

// === CACHE HELPERS ===
const CACHE_KEY = 'jp-cache-items';
function saveCache(items){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items})) }catch{} }
function readCache(){ try{ const j = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (j&&j.items)||[] }catch{ return [] } }

// === INITIAL THEME ===
(function autoThemeBoot(){
  try{
    const pref = localStorage.getItem('jp-theme');
    if(!pref){
      const now = new Date();
      const hrs = Number(new Intl.DateTimeFormat('en-IN',{hour:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}).format(now));
      const mode = (hrs>=6 && hrs<18)?'light':'dark';
      document.documentElement.setAttribute('data-theme', mode);
    }
  }catch{}
})();

// === HELPER FUNCTIONS ===
function hashTitle(s){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return 'h'+Math.abs(h); }
async function getAIThumb(prompt){
  const key = 'jp-thumb:'+hashTitle(prompt);
  try{ const cached = localStorage.getItem(key); if(cached) return cached; }catch{}
  try{
    const r = await fetch('/api/ai-image?prompt='+encodeURIComponent(prompt));
    const j = await r.json();
    if(j && j.dataUrl){ try{ localStorage.setItem(key, j.dataUrl); }catch{} return j.dataUrl; }
  }catch{}
  return null;
}

function showToast(html, ms=4000){
  const host = document.getElementById('toast'); if(!host) return;
  host.innerHTML = html;
  host.classList.add('show');
  setTimeout(()=> host.classList.remove('show'), ms);
}

function enableAutoScrollX(el, speed=0.35){
  if(!el) return;
  let paused=false, raf;
  const step = ()=>{
    if(!paused && el.scrollWidth > el.clientWidth){
      el.scrollLeft += speed;
      if(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1){ el.scrollLeft = 0; }
    }
    raf = requestAnimationFrame(step);
  };
  el.addEventListener('mouseenter', ()=> paused = true);
  el.addEventListener('mouseleave', ()=> paused = false);
  step();
}

// === HEADER/FOOTER INJECTION ===
async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);

  const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();

  // Theme toggle
  const root = document.documentElement;
  const tbtn = document.getElementById('themeToggle');
  if(tbtn){
    tbtn.addEventListener('click',()=>{
      const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
      localStorage.setItem('jp-theme', t); root.setAttribute('data-theme', t);
    });
  }

  // Date/time clock
  const dt = document.getElementById('dateTime');
  const tick = ()=> { if(dt) dt.textContent = '🕒 ' + formatDateTimeIST(); };
  tick(); setInterval(tick, 30000);
}

// === FETCH RSS ===
async function getRSS(){
  try{
    let r = await fetch('/api/rss');
    if(!r.ok) throw new Error('RSS API failed');
    const j = await r.json(); const items = j.items || [];
    if(items.length) saveCache(items);
    if(items.length) return items;
  }catch{ }
  return readCache();
}

// === BUILD SECTIONS ===
function cardForPost(p){
  const c = el('article','card');
  const date = p.pubDate ? new Date(p.pubDate) : null;
  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy" /></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description||'')}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description||'',180)}</p>
  `;
  const prompt = `West Bengal jobs news: ${p.title}`;
  c.querySelector('.thumb').dataset.prompt = prompt;
  return c;
}

function renderSections(all){
  const top=document.getElementById('top-scroll');
  const trending=document.getElementById('trending');
  const notices=document.getElementById('notices');
  for(const cont of [top,trending,notices]) if(cont) cont.innerHTML='';

  const base = all;
  base.slice(0,12).forEach(p=> top.appendChild(cardForPost(p)));
  base.slice(12,24).forEach(p=> trending.appendChild(cardForPost(p)));
  base.slice(0,12).forEach(p=> notices.appendChild(cardForPost(p)));

  loadAIThumbs(top,8); loadAIThumbs(notices,6); loadAIThumbs(trending,8);

  enableAutoScrollX(top, 0.35);
  enableAutoScrollX(trending, 0.35);
}

// === LIVE TICKER ===
function buildTicker(items){
  const wrap = document.getElementById('notify-ticker');
  if(!wrap) return;
  const subset = (items && items.length ? items : []).slice(0,18);
  if(!subset.length){ wrap.textContent = 'No updates yet.'; return; }
  const track = document.createElement('div'); track.className = 'ticker-track';
  const makeRun = () => {
    const span = document.createElement('span'); span.className = 'ticker';
    subset.forEach(p=>{
      const a=document.createElement('a');
      a.href=`/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}`;
      a.textContent=p.title;
      span.appendChild(a);
    });
    return span;
  };
  track.appendChild(makeRun()); track.appendChild(makeRun());
  wrap.innerHTML=''; wrap.appendChild(track);
}

// === LOAD AI THUMBS ===
async function loadAIThumbs(container, limit=6){
  const imgs = Array.from(container.querySelectorAll('img.thumb')).slice(0, limit);
  for(const img of imgs){
    if(img.dataset.loaded) continue;
    const prompt = img.dataset.prompt || 'job,kolkata';
    const dataUrl = await getAIThumb(prompt);
    if(dataUrl){ img.src = dataUrl; img.alt = prompt; img.dataset.loaded = '1'; }
  }
}

// === HOME PAGE ===
async function mountHome(){
  const items = await getRSS();
  buildTicker(items);
  renderSections(items);
}

// === DOM READY ===
document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){ try{await mountHome();}catch(e){console.error(e);} }
});
