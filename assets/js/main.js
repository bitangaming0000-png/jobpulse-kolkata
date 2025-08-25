// assets/js/main.js
import { formatDateTimeIST, el, truncate, safeURL } from './utils.js';

const CACHE_KEY = 'jp-cache-items';
function saveCache(items){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items})) }catch{} }
function readCache(){ try{ const j = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (j&&j.items)||[] }catch{ return [] } }

// --- Helpers for thumbnails (Unsplash via function) ---
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

// ---------------- Shell ----------------
async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
  const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();

  // AdSense script
  try {
    const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
    const frag = document.createElement('template'); frag.innerHTML = adsHead.trim();
    if(!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')){
      document.head.appendChild(frag.content.cloneNode(true));
    }
  } catch{}

  // Replace ad placeholders
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

  // Hamburger menu
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

  // Date & time (header)
  const dt = document.getElementById('dateTime');
  const tick = ()=> { if(dt) dt.textContent = '🕒 ' + formatDateTimeIST(); };
  tick(); setInterval(tick, 30000);

  // Visitor count
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

// ---------------- Cards ----------------
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
  const prompt = `West Bengal jobs news: ${p.title}`;
  c.querySelector('.thumb').dataset.prompt = prompt;
  return c;
}

const WB_FILTER = /\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\b/i;
function isWestBengalItem(item) {
  const fields = [item.title, item.description, item.link].filter(Boolean).join(" ");
  return WB_FILTER.test(fields);
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

// ---------------- Widgets ----------------
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
  // Clock
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

// Exam Calendar
function tryParseDate(str){
  const m1=str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if(m1) return new Date(m1[3],m1[2]-1,m1[1]);
  return null;
}
function buildCalendar(items){
  const ul=document.getElementById('calList'); if(!ul) return;
  ul.innerHTML='';
  const now=new Date(),future=new Date(now.getTime()+60*86400000);
  const evs=[];
  items.forEach(it=>{
    if(!isWestBengalItem(it)) return;
    const dt=tryParseDate((it.title||'')+(it.description||'')); if(dt && dt>=now && dt<=future){evs.push({dt,title:it.title,link:it.link})}
  });
  evs.sort((a,b)=>a.dt-b.dt);
  if(!evs.length){ ul.innerHTML='<li class="muted">No exam dates found.</li>'; return; }
  evs.slice(0,10).forEach(e=>{
    const li=document.createElement('li'); li.innerHTML=`<strong>${e.dt.toDateString()}:</strong> <a href="/pages/post.html?title=${encodeURIComponent(e.title)}&link=${encodeURIComponent(e.link)}">${e.title}</a>`; ul.appendChild(li);
  });
}

// ---------------- Home ----------------
async function loadCategories(){
  try{
    const res = await fetch('/data/feeds.json'); const cfg = await res.json();
    const feeds = Array.isArray(cfg)?cfg:(cfg.sources||[]);
    const cats=[...new Set(feeds.map(f=>f.category||'news'))];
    const wrap=document.getElementById('categories'); if(!wrap) return;
    cats.forEach(c=>{ const chip=el('a','badge',c[0].toUpperCase()+c.slice(1)); chip.href='/pages/category.html?name='+encodeURIComponent(c); wrap.appendChild(chip); });
  }catch{}
}

async function mountHome(){
  const top=document.getElementById('top-scroll');
  const notices=document.getElementById('notices');
  const trending=document.getElementById('trending');
  const items=await getRSS();

  mountQuote(); mountWeather(); mountHistory(); mountAir();

  buildTicker(items);

  items.slice(0,10).forEach(p=> top.appendChild(cardForPost(p)));
  const notif=items.filter(p=>/admit|result/i.test(p.title||'')).slice(0,8);
  notif.forEach(p=> notices.appendChild(cardForPost(p)));

  await loadCategories();
  buildCalendar(items);

  loadAIThumbs(top,6); loadAIThumbs(notices,4); loadAIThumbs(trending,6);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){ try{await mountHome();}catch(e){console.error(e);} }
});
