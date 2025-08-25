// assets/js/main.js
import { formatDateTimeIST, el, truncate, safeURL } from './utils.js';

const CACHE_KEY = 'jp-cache-items';
function saveCache(items){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items})) }catch{} }
function readCache(){ try{ const j = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (j&&j.items)||[] }catch{ return [] } }

// --- tiny helpers just for thumbs ---
function hashTitle(s){
  let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return 'h'+Math.abs(h);
}
async function getAIThumb(prompt){
  const key = 'jp-thumb:'+hashTitle(prompt);
  try{
    const cached = localStorage.getItem(key);
    if(cached) return cached;
  }catch{}
  try{
    // Free Unsplash proxy (our function)
    const r = await fetch('/.netlify/functions/ai-image?prompt='+encodeURIComponent(prompt));
    const j = await r.json();
    if(j && j.dataUrl){
      try{ localStorage.setItem(key, j.dataUrl); }catch{}
      return j.dataUrl;
    }
  }catch{}
  return null;
}

function showEmpty(id, msg){
  const elx = document.getElementById(id);
  if(elx && !elx.children.length){
    const p = document.createElement('p'); p.className = 'notice'; p.textContent = msg;
    elx.parentElement.appendChild(p);
  }
}

async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
  document.getElementById('year').textContent = new Date().getFullYear();

  // AdSense head include
  try {
    const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
    const frag = document.createElement('template'); frag.innerHTML = adsHead.trim();
    const hasAdScript = !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    if(!hasAdScript){ document.head.appendChild(frag.content.cloneNode(true)); }
  } catch(e){}

  // Inject ad units
  try {
    for(const ph of document.querySelectorAll('.ad-slot')){
      const variant = ph.dataset.variant || 'display';
      let file = '/components/ads-unit-display.html';
      if(variant==='inarticle') file = '/components/ads-unit-inarticle.html';
      if(variant==='multiplex') file = '/components/ads-unit-multiplex.html';
      const unit = await fetch(file).then(r=>r.text());
      ph.outerHTML = unit;
    }
  } catch(e){}

  // Theme toggle
  const root = document.documentElement;
  document.getElementById('themeToggle').addEventListener('click',()=>{
    const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
    localStorage.setItem('jp-theme', t); root.setAttribute('data-theme', t);
  });

  // Hamburger nav (hover + click + outside/esc)
  const nav = document.getElementById('sideNav');
  const hamburger = document.getElementById('hamburger');
  function openNav(){ nav.classList.add('open'); nav.setAttribute('aria-hidden','false'); }
  function closeNav(){ nav.classList.remove('open'); nav.setAttribute('aria-hidden','true'); }
  hamburger.addEventListener('mouseenter', openNav);
  nav.addEventListener('mouseleave', closeNav);
  hamburger.addEventListener('click', ()=> { nav.classList.contains('open') ? closeNav() : openNav(); });
  document.addEventListener('click', (e)=>{ if(!nav.contains(e.target) && !hamburger.contains(e.target)) closeNav(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNav(); });

  // Date & Time
  const dt = document.getElementById('dateTime');
  const tick = ()=> dt.textContent = '🕒 ' + formatDateTimeIST(); tick(); setInterval(tick, 30000);

  // Visitor Count (our function, then fallback)
  const vc = document.querySelector('#visitorCount span');
  try {
    const r = await fetch('/.netlify/functions/visitors');
    const j = await r.json(); vc.textContent = (j.value ?? 0).toLocaleString('en-IN');
  } catch(e) {
    try{
      const r2 = await fetch('https://api.countapi.xyz/hit/jp-kolkata/site-visits');
      const j2 = await r2.json(); vc.textContent = (j2.value ?? 0).toLocaleString('en-IN');
    } catch { vc.textContent = '—'; }
  }
}

async function getRSS(){
  // live → archive → cache
  try{
    const r = await fetch('/api/rss'); if(!r.ok) throw new Error('RSS API failed');
    const j = await r.json(); const items = j.items || [];
    if(items.length) saveCache(items);
    if(items.length) return items;
  }catch(e){ console.error(e); }
  try{
    const a = await fetch('/.netlify/functions/archive?latest=100');
    if(a.ok){ const j = await a.json(); const items = j.items || j.latest || []; if(items.length) return items; }
  }catch(e){ console.error('Archive fallback failed', e); }
  return readCache();
}

function cardForPost(p){
  const c = el('article','card');
  const date = p.pubDate ? new Date(p.pubDate) : null;
  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy" /></div>
    <div class="meta"><span class="badge">${date? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(date):'New'}</span>
    <span class="badge">WB Only</span></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description)}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description, 160)}</p>
    <a class="badge" href="${safeURL(p.link)}" target="_blank" rel="noopener">Source ↗</a>
  `;
  const prompt = `Wide banner, dark theme, West Bengal jobs news: ${p.title}. Minimal, newsy, high-contrast, subtle Kolkata silhouette`;
  c.querySelector('.thumb').dataset.prompt = prompt;
  return c;
}

const WB_FILTER = new RegExp("\\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\\b","i");
function isWestBengalItem(item) {
  const fields = [item.title, item.description, item.link].filter(Boolean).join(" ");
  return WB_FILTER.test(fields);
}

// Compact live ticker (slower + pause on hover via CSS)
function buildTicker(items){
  const wrap = document.getElementById('notify-ticker');
  if(!wrap) return;
  const filtered = items.filter(isWestBengalItem);
  if(!filtered.length){ wrap.outerHTML = '<div class="notice">No new West Bengal updates yet.</div>'; return; }

  const subset = filtered.slice(0,18);
  const track = document.createElement('div'); track.className = 'ticker-track';

  const makeRun = () => {
    const span = document.createElement('span'); span.className = 'ticker';
    subset.forEach(p=>{
      const bullet = el('span','bullet','');
      const a=document.createElement('a');
      a.href=`/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description)}&date=${encodeURIComponent(p.pubDate||'')}`;
      a.textContent=p.title;
      span.appendChild(bullet); span.appendChild(a);
    });
    return span;
  };
  track.appendChild(makeRun()); track.appendChild(makeRun());
  wrap.innerHTML=''; wrap.appendChild(track);
}

// Lazy-generate AI thumbs (via free Unsplash proxy) for first N cards
async function loadAIThumbs(container, limit=6){
  const imgs = Array.from(container.querySelectorAll('img.thumb')).slice(0, limit);
  for(const img of imgs){
    if(img.dataset.loaded) continue;
    const prompt = img.dataset.prompt || 'abstract news banner';
    const dataUrl = await getAIThumb(prompt);
    if(dataUrl){ img.src = dataUrl; img.alt = prompt; img.dataset.loaded = '1'; }
  }
}

// Widgets: Quote of the day (free)
async function mountQuote(){
  const box = document.getElementById('quoteBox'); if(!box) return;
  try{
    const r = await fetch('https://api.quotable.io/random?tags=inspirational|success');
    const j = await r.json();
    const q = j.content || 'Stay positive. Work hard. Make it happen.';
    const a = j.author ? `— ${j.author}` : '';
    box.querySelector('.w-body').innerHTML = `<p style="font-size:16px"><strong>${q}</strong></p><p class="w-small">${a}</p>`;
  }catch{
    box.querySelector('.w-body').innerHTML = `<p><strong>Keep going — good things take time.</strong></p>`;
  }
}

// Widgets: Weather (Kolkata; free Open-Meteo)
function wCodeToText(code){
  const map = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Fog',48:'Depositing rime fog',
    51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',
    61:'Light rain',63:'Rain',65:'Heavy rain',
    71:'Light snow',73:'Snow',75:'Heavy snow',
    80:'Rain showers',81:'Rain showers',82:'Violent rain showers',
    95:'Thunderstorm',96:'Thunderstorm w/ hail',99:'Thunderstorm w/ heavy hail'
  };
  return map[code] || 'Weather';
}
async function mountWeather(){
  const box = document.getElementById('weatherBox'); if(!box) return;
  try{
    // Kolkata coordinates
    const lat = 22.5726, lon = 88.3639;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata`;
    const r = await fetch(url);
    const j = await r.json();
    const t = Math.round(j.current?.temperature_2m ?? NaN);
    const code = j.current?.weather_code ?? 0;
    const tmax = Math.round(j.daily?.temperature_2m_max?.[0] ?? NaN);
    const tmin = Math.round(j.daily?.temperature_2m_min?.[0] ?? NaN);

    box.querySelector('#wt').textContent = isFinite(t) ? t : '—';
    box.querySelector('#wd').textContent = wCodeToText(code);
    box.querySelector('#wr').textContent = `${isFinite(tmin)?tmin:'—'} / ${isFinite(tmax)?tmax:'—'} °C`;
  }catch{
    box.querySelector('#wd').textContent = 'Weather unavailable';
  }
}

async function loadCategories(){
  try{
    const res = await fetch('/data/feeds.json'); const cfg = await res.json();
    const feeds = Array.isArray(cfg)?cfg:(cfg.sources||[]);
    const cats=[...new Set(feeds.map(f=>f.category||'news'))];
    const wrap=document.getElementById('categories'); if(!wrap) return;
    cats.forEach(c=>{ const chip=el('a','badge',c.charAt(0).toUpperCase()+c.slice(1)); chip.href='/pages/category.html?name='+encodeURIComponent(c); wrap.appendChild(chip); });
  }catch{}
}

async function mountHome(){
  const top=document.getElementById('top-scroll');
  const notices=document.getElementById('notices');
  const trending=document.getElementById('trending');
  const items=await getRSS();

  // Widgets
  mountQuote();
  mountWeather();

  buildTicker(items);

  items.slice(0,10).forEach(p=> top.appendChild(cardForPost(p)));
  if(!top.children.length) showEmpty('top-scroll','No West Bengal posts found yet.');

  const notif=items.filter(p=>/admit|call letter|result/i.test(p.title+p.description)).slice(0,8);
  notif.forEach(p=> notices.appendChild(cardForPost(p)));
  if(!notif.length) showEmpty('notices','No notifications right now.');

  const byHost={}; for(const it of items){ try{const h=new URL(it.link).host.replace('www.',''); byHost[h]=(byHost[h]||0)+1;}catch{} }
  const popularHosts=Object.entries(byHost).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).slice(0,3);
  const trend=items.filter(p=>{try{return popularHosts.includes(new URL(p.link).host.replace('www.',''))}catch{return false}}).slice(0,12);
  trend.forEach(p=> trending.appendChild(cardForPost(p)));
  if(!trend.length) showEmpty('trending','No trending sources yet.');

  await loadCategories();

  // kick off free thumbs (Unsplash proxy)
  loadAIThumbs(top, 6);
  loadAIThumbs(notices, 4);
  loadAIThumbs(trending, 6);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){ try{await mountHome();}catch(e){console.error(e);} }
});
