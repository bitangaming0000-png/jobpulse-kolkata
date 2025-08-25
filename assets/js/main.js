// assets/js/main.js
import { formatDateTimeIST, el, truncate, safeURL } from './utils.js';

const CACHE_KEY = 'jp-cache-items';
function saveCache(items){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items})) }catch{} }
function readCache(){ try{ const j = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (j&&j.items)||[] }catch{ return [] } }

// ---------- Auto theme (IST) ----------
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

// --- Helpers for thumbnails (Unsplash via function) ---
function hashTitle(s){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return 'h'+Math.abs(h); }
async function getAIThumb(prompt){
  const key = 'jp-thumb:'+hashTitle(prompt);
  try{ const cached = localStorage.getItem(key); if(cached) return cached; }catch{}
  try{
    const r = await fetch('/.netlify/functions/ai-image?prompt='+encodeURIComponent(prompt));
    const j = await r.json();
    if(j && j.dataUrl){ try{ localStorage.setItem(key, j.dataUrl); }catch{} return j.dataUrl; }
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

// --- Toast ---
function showToast(html, ms=4000){
  const host = document.getElementById('toast'); if(!host) return;
  host.innerHTML = html;
  host.classList.add('show');
  setTimeout(()=> host.classList.remove('show'), ms);
}

// --- Auto horizontal scroller (Top News / Trending) ---
function startAutoScrollX(containerId, step=1, interval=35){
  const el = document.getElementById(containerId);
  if(!el) return;
  let timer;
  function tick(){
    if(el.scrollWidth <= el.clientWidth) return; // nothing to scroll
    el.scrollLeft += step;
    if(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2){
      el.scrollLeft = 0; // loop
    }
  }
  const start = ()=> { stop(); timer = setInterval(tick, interval); };
  const stop  = ()=> { if(timer){ clearInterval(timer); timer = null; } };
  el.addEventListener('mouseenter', stop);
  el.addEventListener('mouseleave', start);
  start();
}

// ---------------- Shell ----------------
async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
  const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();

  // AdSense head include
  try {
    const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
    const frag = document.createElement('template'); frag.innerHTML = adsHead.trim();
    if(!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')){
      document.head.appendChild(frag.content.cloneNode(true));
    }
  } catch{}

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
  } catch{}

  // Theme toggle
  const root = document.documentElement;
  const tbtn = document.getElementById('themeToggle');
  if(tbtn){
    tbtn.addEventListener('click',()=>{
      const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
      localStorage.setItem('jp-theme', t); root.setAttribute('data-theme', t);
    });
  }

  // Hamburger nav
  const nav = document.getElementById('sideNav');
  const hamburger = document.getElementById('hamburger');
  function openNav(){ if(nav){ nav.classList.add('open'); nav.setAttribute('aria-hidden','false'); } }
  function closeNav(){ if(nav){ nav.classList.remove('open'); nav.setAttribute('aria-hidden','true'); } }
  if(hamburger && nav){
    hamburger.addEventListener('mouseenter', openNav);
    nav.addEventListener('mouseleave', closeNav);
    hamburger.addEventListener('click', ()=> { nav.classList.contains('open') ? closeNav() : openNav(); });
    document.addEventListener('click', (e)=>{ if(!nav.contains(e.target) && !hamburger.contains(e.target)) closeNav(); });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNav(); });
  }

  // Date & time in header
  const dt = document.getElementById('dateTime');
  const tick = ()=> { if(dt) dt.textContent = '🕒 ' + formatDateTimeIST(); };
  tick(); setInterval(tick, 30000);

  // Visitor Count
  const vc = document.querySelector('#visitorCount span');
  try {
    const r = await fetch('/.netlify/functions/visitors');
    const j = await r.json(); if(vc) vc.textContent = (j.value ?? 0).toLocaleString('en-IN');
  } catch {
    try{
      const r2 = await fetch('https://api.countapi.xyz/hit/jp-kolkata/site-visits');
      const j2 = await r2.json(); if(vc) vc.textContent = (j2.value ?? 0).toLocaleString('en-IN');
    } catch { if(vc) vc.textContent = '—'; }
  }
}

// ---------------- Data ----------------
async function getRSS(){
  try{
    const r = await fetch('/api/rss'); if(!r.ok) throw new Error('RSS API failed');
    const j = await r.json(); const items = j.items || [];
    if(items.length) saveCache(items);
    if(items.length) return items;
  }catch{}
  try{
    const a = await fetch('/.netlify/functions/archive?latest=100');
    if(a.ok){ const j = await a.json(); return j.items || j.latest || []; }
  }catch{}
  return readCache();
}

// ---------------- Bookmark (Save) ----------------
const SAVE_KEY = 'jp-saved';
function getSaved(){ try{ return JSON.parse(localStorage.getItem(SAVE_KEY)||'[]'); }catch{ return [] } }
function isSaved(link){ return getSaved().some(x=>x.link===link); }
function toggleSave(post){
  const all = getSaved();
  const idx = all.findIndex(x=>x.link===post.link);
  if(idx>=0){ all.splice(idx,1); showToast('Removed from ⭐ Saved'); }
  else { all.push(post); showToast('Added to ⭐ Saved'); }
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(all)); }catch{}
}
function makeSaveButton(post){
  const btn = document.createElement('button');
  btn.className = 'tab';
  btn.type='button';
  btn.textContent = isSaved(post.link) ? '⭐ Saved' : '☆ Save';
  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    toggleSave(post);
    btn.textContent = isSaved(post.link) ? '⭐ Saved' : '☆ Save';
  });
  return btn;
}

// ---------------- Cards ----------------
function cardForPost(p){
  const c = el('article','card');
  const date = p.pubDate ? new Date(p.pubDate) : null;
  const post = { title:p.title, link:p.link, description:p.description||'', pubDate:p.pubDate||'' };

  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy" /></div>
    <div class="meta"><span class="badge">${date? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(date):'New'}</span>
    <span class="badge">WB Only</span></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description)}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description, 160)}</p>
    <div class="card-actions">
      <a class="badge" href="${safeURL(p.link)}" target="_blank" rel="noopener">Source ↗</a>
    </div>
  `;
  c.dataset.title = (p.title||'').toLowerCase();
  c.dataset.desc  = (p.description||'').toLowerCase();

  // Save button
  const actions = c.querySelector('.card-actions');
  actions.appendChild(makeSaveButton(post));

  // Thumb prompt
  const prompt = `West Bengal jobs news: ${p.title}`;
  c.querySelector('.thumb').dataset.prompt = prompt;
  return c;
}

const WB_FILTER = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\b/i;
function isWestBengalItem(item) {
  const fields = [item.title, item.description, item.link].filter(Boolean).join(" ");
  return WB_FILTER.test(fields);
}

// -------------- Category filter logic --------------
const CATEGORY_RULES = {
  govt: /\b(commission|wbpsc|government|govt|notice|recruitment|ssc|upsc|wb health|wb police|panchayat)\b/i,
  private: /\b(private|walk[-\s]?in|hiring|vacancy in|startup|agency|company|it company)\b/i,
  bank: /\b(bank|sbi|rbi|ibps|psb|banking)\b/i,
  rail: /\b(railway|rrb|metro rail)\b/i,
  it: /\b(developer|engineer|software|it|tech|programmer|data|ai|ml|react|node|python|java)\b/i
};
function matchCategory(item, cat){
  if(cat==='all') return true;
  const text = [item.title, item.description].filter(Boolean).join(' ');
  const rule = CATEGORY_RULES[cat];
  return rule ? rule.test(text) : true;
}

function renderSections(items){
  const top=document.getElementById('top-scroll');
  const trending=document.getElementById('trending');
  const notices=document.getElementById('notices');
  for(const cont of [top,trending,notices]) if(cont) cont.innerHTML='';

  items.slice(0,10).forEach(p=> top.appendChild(cardForPost(p)));
  const notif=items.filter(p=>/admit|call letter|result/i.test((p.title||'')+(p.description||''))).slice(0,8);
  notif.forEach(p=> notices.appendChild(cardForPost(p)));
  const byHost={}; for(const it of items){ try{const h=new URL(it.link).host.replace('www.',''); byHost[h]=(byHost[h]||0)+1;}catch{} }
  const popularHosts=Object.entries(byHost).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).slice(0,3);
  const trend=items.filter(p=>{try{return popularHosts.includes(new URL(p.link).host.replace('www.',''))}catch{return false}}).slice(0,12);
  trend.forEach(p=> trending.appendChild(cardForPost(p)));

  // thumbs for first cards
  loadAIThumbs(top,6); loadAIThumbs(notices,4); loadAIThumbs(trending,6);

  // start auto-scroll for Top News and Trending
  startAutoScrollX('top-scroll', 1, 35);
  startAutoScrollX('trending',   1, 35);
}

function mountTabs(allItems){
  const tabs = document.getElementById('jobTabs'); if(!tabs) return;
  tabs.addEventListener('click', (e)=>{
    const btn = e.target.closest('.tab'); if(!btn || !btn.dataset.filter) return;
    for(const b of tabs.querySelectorAll('.tab')) b.classList.remove('active');
    btn.classList.add('active');
    const filtered = allItems.filter(it=> isWestBengalItem(it) && matchCategory(it, btn.dataset.filter));
    renderSections(filtered);
  });
}

// -------------- Keyword Cloud --------------
function buildKeywordCloud(items){
  const cloud = document.getElementById('keywordCloud'); if(!cloud) return;
  const text = items.map(i=>i.title||'').join(' ').toLowerCase();
  const keys = ['wbpsc','ssc','railway','bank','teacher','police','health','engineer','data','it','admit','result','exam','recruitment','walk-in','apprentice'];
  const weights = keys.map(k=>({k, w:(text.match(new RegExp(`\\b${k}\\b`,'g'))||[]).length})).filter(x=>x.w>0).sort((a,b)=>b.w-a.w).slice(0,16);

  cloud.innerHTML='';
  if(!weights.length){ cloud.innerHTML='<span class="muted">No trending keywords yet.</span>'; return; }
  for(const {k,w} of weights){
    const a = document.createElement('button'); a.type='button'; a.className='kw'; a.textContent=k;
    a.style.fontSize = (12 + Math.min(10, w*2)) + 'px';
    a.addEventListener('click', ()=>{
      const top = document.getElementById('top-scroll'); if(top) top.scrollIntoView({behavior:'smooth'});
      const q = document.getElementById('siteSearch'); if(q){ q.value = k; applySearch(k); }
    });
    cloud.appendChild(a);
  }
}

// ---------------- Ticker ----------------
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

// -------------- Thumbnails --------------
async function loadAIThumbs(container, limit=6){
  const imgs = Array.from(container.querySelectorAll('img.thumb')).slice(0, limit);
  for(const img of imgs){
    if(img.dataset.loaded) continue;
    const prompt = img.dataset.prompt || 'job,kolkata';
    const dataUrl = await getAIThumb(prompt);
    if(dataUrl){ img.src = dataUrl; img.alt = prompt; img.dataset.loaded = '1'; }
  }
}

// ---------- Widgets ----------
async function mountQuote(){
  const box = document.getElementById('quoteBox'); if(!box) return;
  try{
    const r = await fetch('https://api.quotable.io/random?tags=inspirational|success');
    const j = await r.json();
    box.querySelector('.w-body').innerHTML = `<p><strong>${j.content}</strong></p><p class="w-small">— ${j.author}</p>`;
  }catch{
    box.querySelector('.w-body').innerHTML = `<p><strong>Stay motivated today.</strong></p>`;
  }
}
function wCodeToText(c){
  const map={0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',61:'Light rain',63:'Rain',65:'Heavy rain',95:'Thunderstorm'};
  return map[c]||'Weather';
}
async function mountWeather(){
  const box = document.getElementById('weatherBox'); if(!box) return;
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=22.5726&longitude=88.3639&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Asia%2FKolkata`;
    const r = await fetch(url); const j = await r.json();
    const t = Math.round(j.current?.temperature_2m ?? NaN);
    box.querySelector('#wt').textContent = isFinite(t)?t:'—';
    box.querySelector('#wd').textContent = wCodeToText(j.current?.weather_code);
    box.querySelector('#wr').textContent = `${Math.round(j.daily?.temperature_2m_min?.[0])} / ${Math.round(j.daily?.temperature_2m_max?.[0])} °C`;
  }catch{}
  const clk = document.querySelector('#weatherBox #clock span');
  if(clk){ const tick=()=> clk.textContent=new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'}).format(new Date()); tick(); setInterval(tick,30000); }
}
async function mountHistory(){
  const box = document.getElementById('historyBox'); if(!box) return;
  try{
    const d=new Date(),m=d.getMonth()+1,day=d.getDate();
    const r=await fetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/events/${m}/${day}`); const j=await r.json();
    const e=j.events?.slice(0,2)||[];
    box.querySelector('.w-body').innerHTML = e.map(x=>`<p><strong>${x.year}:</strong> ${x.text}</p>`).join('');
  }catch{ box.querySelector('.w-body').textContent='History unavailable'; }
}
async function mountAir(){
  const box = document.getElementById('airBox'); if(!box) return;
  try{
    const r=await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=22.5726&longitude=88.3639&hourly=us_aqi,pm2_5&timezone=Asia%2FKolkata`);
    const j=await r.json(); const aqi=j.hourly?.us_aqi.pop(),pm=j.hourly?.pm2_5.pop();
    box.querySelector('#aqiVal').textContent=aqi; box.querySelector('#aqiDesc').textContent=`AQI Level`; box.querySelector('#aqiNote').textContent=`PM2.5: ${pm}`;
  }catch{ box.querySelector('#aqiDesc').textContent='AQ unavailable'; }
}

// ---------- Exam Calendar ----------
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','sept','oct','nov','dec'];
function tryParseDate(str){
  if(!str) return null;
  const s = String(str);
  let m = s.match(/\b([0-3]?\d)[\/\-]([01]?\d)[\/\-](20\d{2})\b/);
  if(m){ const [_,d,mo,yr] = m; const dt = new Date(+yr, +mo-1, +d); if(!isNaN(dt)) return dt; }
  m = s.match(/\b([0-3]?\d)\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b/i);
  if(m){ const [_,d,mon,yr] = m; const idx = MONTHS.indexOf(mon.trim().slice(0,3).toLowerCase()); if(idx>=0){ const dt = new Date(+yr, idx, +d); if(!isNaN(dt)) return dt; } }
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+([0-3]?\d),\s*(20\d{2})\b/i);
  if(m){ const [_,mon,d,yr] = m; const idx = MONTHS.indexOf(mon.trim().slice(0,3).toLowerCase()); if(idx>=0){ const dt = new Date(+yr, idx, +d); if(!isNaN(dt)) return dt; } }
  return null;
}
function buildCalendar(items){
  const ul = document.getElementById('calList'); if(!ul) return;
  ul.innerHTML = '';
  const now = new Date();
  const in60 = new Date(now.getTime()+60*24*3600*1000);

  const events = [];
  for(const it of items){
    if(!isWestBengalItem(it)) continue;
    const text = [it.title, it.description].filter(Boolean).join(' — ');
    const dt = tryParseDate(text);
    if(!dt) continue;
    if(dt >= now && dt <= in60){
      events.push({ dt, title: it.title, link: it.link });
    }
  }
  events.sort((a,b)=> a.dt - b.dt);

  if(!events.length){
    ul.innerHTML = `<li class="muted">No exam dates found in the next 60 days.</li>`;
    return;
  }
  for(const ev of events.slice(0,10)){
    const li = document.createElement('li');
    const when = new Intl.DateTimeFormat('en-IN', { dateStyle:'medium' }).format(ev.dt);
    li.innerHTML = `<strong>${when}:</strong> <a href="/pages/post.html?title=${encodeURIComponent(ev.title)}&link=${encodeURIComponent(ev.link)}" target="_self">${ev.title}</a>`;
    ul.appendChild(li);
  }
}

// ---------- categories ----------
async function loadCategories(){
  try{
    const res = await fetch('/data/feeds.json'); const cfg = await res.json();
    const feeds = Array.isArray(cfg)?cfg:(cfg.sources||[]);
    const cats=[...new Set(feeds.map(f=>f.category||'news'))];
    const wrap=document.getElementById('categories'); if(!wrap) return;
    cats.forEach(c=>{ const chip=el('a','badge',c.charAt(0).toUpperCase()+c.slice(1)); chip.href='/pages/category.html?name='+encodeURIComponent(c); wrap.appendChild(chip); });
  }catch{}
}

// ---------- SEARCH ----------
let ALL_ITEMS = [];
function applySearch(q){
  q = (q||'').trim().toLowerCase();
  const top=document.getElementById('top-scroll');
  const notices=document.getElementById('notices');
  const trending=document.getElementById('trending');
  if(!q){
    renderSections(ALL_ITEMS.filter(isWestBengalItem));
    return;
  }
  const words = q.split(/\s+/).filter(Boolean);
  const scored = ALL_ITEMS.filter(isWestBengalItem).map(p=>{
    const hay = ((p.title||'')+' '+(p.description||'')).toLowerCase();
    let score = 0;
    for(const w of words){ if(hay.includes(w)) score += 2; }
    if(hay.startsWith(words[0]||'')) score += 2;
    return {p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).map(x=>x.p);

  for(const cont of [top,trending,notices]) if(cont) cont.innerHTML='';
  scored.slice(0,12).forEach(p=> top.appendChild(cardForPost(p)));
  loadAIThumbs(top, 8);
  showToast(`Found ${scored.length} results for “${q}”`, 2500);

  // keep auto-scroll running on Top News list
  startAutoScrollX('top-scroll', 1, 35);
}

// ---------- Auto refresh (5 min) to detect NEW posts ----------
function watchForNew(){
  setInterval(async ()=>{
    try{
      const latest = await getRSS();
      const old = readCache();
      const oldLinks = new Set((old||[]).map(i=>i.link));
      const fresh = (latest||[]).filter(i=> !oldLinks.has(i.link) && isWestBengalItem(i));
      if(fresh.length){
        saveCache(latest);
        const a = document.createElement('a');
        a.href = `/pages/post.html?title=${encodeURIComponent(fresh[0].title)}&link=${encodeURIComponent(fresh[0].link)}&desc=${encodeURIComponent(fresh[0].description||'')}&date=${encodeURIComponent(fresh[0].pubDate||'')}`;
        a.textContent = fresh[0].title;
        showToast(`🔔 New WB job posted: ${a.outerHTML}`, 6000);
      }
    }catch{}
  }, 5*60*1000);
}

// ---------- Home mount ----------
async function mountHome(){
  const items = await getRSS();
  ALL_ITEMS = items;

  // Widgets
  mountQuote(); mountWeather(); mountHistory(); mountAir();

  buildTicker(items);
  buildKeywordCloud(items);
  await loadCategories();
  buildCalendar(items);

  // initial render (All)
  renderSections(items.filter(isWestBengalItem));
  mountTabs(items);

  // thumbs for first load
  const top=document.getElementById('top-scroll'); const notices=document.getElementById('notices'); const trending=document.getElementById('trending');
  loadAIThumbs(top,6); loadAIThumbs(notices,4); loadAIThumbs(trending,6);

  // Search events
  const q = document.getElementById('siteSearch');
  const clr = document.getElementById('searchClear');
  if(q){ q.addEventListener('input', (e)=> applySearch(e.target.value)); }
  if(clr){ clr.addEventListener('click', ()=> { if(q){ q.value=''; } applySearch(''); }); }

  // watch for new posts
  watchForNew();

  // ensure auto-scroll running
  startAutoScrollX('top-scroll', 1, 35);
  startAutoScrollX('trending',   1, 35);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){ try{await mountHome();}catch(e){console.error(e);} }
});
