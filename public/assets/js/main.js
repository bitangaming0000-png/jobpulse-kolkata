// ===== Utilities =====
function formatIST(d=new Date()){
  return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(d);
}
function el(t,c='',tx=''){const e=document.createElement(t); if(c)e.className=c; if(tx!==undefined)e.textContent=tx; return e;}
function truncate(s='',n=160){ s=String(s); return s.length>n ? s.slice(0,n-1)+'…' : s; }

// ===== Header bits =====
(function(){
  const root=document.documentElement;
  const tbtn=document.getElementById('themeToggle');
  if(tbtn){ tbtn.addEventListener('click',()=>{ const t=(root.getAttribute('data-theme')==='dark')?'light':'dark'; localStorage.setItem('jp-theme',t); root.setAttribute('data-theme',t); }); }
  const dt=document.getElementById('dateTime'); if(dt){ const tick=()=> dt.textContent='🕒 '+formatIST(); tick(); setInterval(tick,30000); }
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
})();

// ===== Weather (visitor location → fallback Kolkata) =====
async function fetchWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&forecast_days=1&timezone=auto`;
  const r = await fetch(url);
  return r.json();
}
async function fetchPlaceName(lat, lon){
  try{
    const u = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const r = await fetch(u);
    const j = await r.json();
    const name = j?.results?.[0]?.name;
    const admin1 = j?.results?.[0]?.admin1;
    const country = j?.results?.[0]?.country;
    return name ? [name, admin1, country].filter(Boolean).join(', ') : '';
  }catch{ return ''; }
}
async function loadWeather(){
  const box = document.getElementById('wx');
  if(!box) return;
  const show = (label, t) => { box.textContent = (t!==undefined && t!==null) ? `${label}: ${t} °C` : `${label}: —`; };
  const KOL = { lat: 22.5726, lon: 88.3639, label: 'Kolkata' };
  if('geolocation' in navigator){
    const opts = { enableHighAccuracy:true, timeout:8000, maximumAge:60000 };
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const {latitude:lat, longitude:lon} = pos.coords || {};
        if(typeof lat!=='number' || typeof lon!=='number') throw new Error('bad coords');
        const [w, place] = await Promise.all([fetchWeather(lat,lon), fetchPlaceName(lat,lon)]);
        const t = w?.current?.temperature_2m;
        show(place || 'Your area', t);
      }catch{
        const w = await fetchWeather(KOL.lat, KOL.lon);
        show(KOL.label, w?.current?.temperature_2m);
      }
    }, async _err=>{
      const w = await fetchWeather(KOL.lat, KOL.lon);
      show(KOL.label, w?.current?.temperature_2m);
    }, opts);
  }else{
    const w = await fetchWeather(KOL.lat, KOL.lon);
    show(KOL.label, w?.current?.temperature_2m);
  }
}

// ===== Quotes =====
const QUOTES = [
  "Little progress each day adds up to big results.",
  "Stay consistent. Results will follow.",
  "Your future is created by what you do today.",
  "Discipline beats motivation.",
  "Dream big. Start small. Act now."
];
function loadQuote(){
  const i = Math.floor(Math.random()*QUOTES.length);
  const box = document.getElementById('quoteBox');
  if(box) box.textContent = QUOTES[i];
}

// ===== News via API =====
async function getRSS(){
  try{
    const r=await fetch('/api/rss',{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json();
    return Array.isArray(j.items)?j.items:[];
  }catch(e){
    const now=new Date().toUTCString();
    return [
      {title:'WBPSC Recruitment Update — New Vacancies',link:'https://wbpsc.gov.in',description:'West Bengal PSC latest updates.',pubDate:now},
      {title:'KMC Notification for Candidates',link:'https://www.kmcgov.in',description:'Latest from KMC.',pubDate:now},
      {title:'Railway Update for WB Candidates',link:'https://indianrailways.gov.in',description:'Important railway info for WB.',pubDate:now}
    ];
  }
}

// ===== Categorization & filtering =====
function inferCategory(p){
  const s = `${p.title||''} ${p.description||''}`.toLowerCase();
  if(/admit\s*card|hall\s*ticket/.test(s)) return 'admit';
  if(/\bresult(s)?\b|scorecard|merit\s*list/.test(s)) return 'result';
  if(/\bexam(s)?\b|syllabus|exam\s*date|answer\s*key/.test(s)) return 'exam';
  if(/recruitment|vacancy|apply\s*online|notification|wbpsc|kmc|wbtc|kolkata\s*police|west\s*Bengal\s*health|govt/.test(s)) return 'govt';
  if(/notice|notification|update|announcement/.test(s)) return 'notice';
  return 'govt';
}
let STATE = { raw:[], filtered:[], q:'', cat:'all' };

function filterItems(){
  const q = STATE.q.trim().toLowerCase();
  STATE.filtered = STATE.raw.filter(p=>{
    const c = inferCategory(p);
    const okCat = (STATE.cat==='all') || (c===STATE.cat);
    if(!okCat) return false;
    if(!q) return true;
    const s = `${p.title||''} ${p.description||''}`.toLowerCase();
    return s.includes(q);
  });
}

function elCard(p){
  const c=el('article','card');
  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy"></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description||'')}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description||'',180)}</p>`;
  const img=c.querySelector('img.thumb');
  const q=encodeURIComponent('kolkata jobs '+(p.title||'')); img.src=`https://source.unsplash.com/800x450/?${q}`; img.alt=p.title||'thumbnail';
  return c;
}

function buildTicker(items){
  const wrap=document.getElementById('notify-ticker'); if(!wrap) return;
  const subset=(items||[]).slice(0,18);
  const track=document.createElement('div'); track.className='ticker-track';
  const run=()=>{ const span=document.createElement('span'); span.className='ticker';
    subset.forEach(p=>{ const a=document.createElement('a'); a.href='/pages/post.html?title='+encodeURIComponent(p.title)+'&link='+encodeURIComponent(p.link); a.textContent=p.title; span.appendChild(a); });
    return span; };
  track.appendChild(run()); track.appendChild(run());
  wrap.innerHTML=''; wrap.appendChild(track);
}

function autoScroll(el,speed=0.35){
  if(!el) return; let paused=false;
  const step=()=>{ if(!paused && el.scrollWidth>el.clientWidth){ el.scrollLeft+=speed; if(el.scrollLeft>=el.scrollWidth-el.clientWidth-1) el.scrollLeft=0; } requestAnimationFrame(step); };
  el.addEventListener('mouseenter',()=>paused=true); el.addEventListener('mouseleave',()=>paused=false); step();
}

function render(){
  const top=document.getElementById('top-scroll');
  const noti=document.getElementById('notices');
  const trend=document.getElementById('trending');
  [top,noti,trend].forEach(n=>n&&(n.innerHTML=''));

  const items = STATE.filtered;
  items.slice(0,12).forEach(p=> top.appendChild(elCard(p)));
  items.slice(0,12).forEach(p=> noti.appendChild(elCard(p)));
  items.slice(12,24).forEach(p=> trend.appendChild(elCard(p)));

  autoScroll(top,0.35); autoScroll(trend,0.35);
}

function bindSearchAndChips(){
  const input = document.getElementById('searchInput');
  const chips = document.getElementById('chips');
  if(input){
    input.addEventListener('input', e=>{
      STATE.q = e.target.value || '';
      filterItems(); render();
    });
  }
  if(chips){
    chips.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-cat]');
      if(!btn) return;
      chips.querySelectorAll('.chip').forEach(b=>b.classList.remove('chip-active'));
      btn.classList.add('chip-active');
      STATE.cat = btn.dataset.cat || 'all';
      filterItems(); render();
    });
  }
}

// ---- Main ----
async function main(){
  if(!document.body.classList.contains('home')) return;
  loadQuote();
  loadWeather();

  const items = await getRSS();
  STATE.raw = items;
  STATE.cat = 'all';
  STATE.q = '';
  filterItems();

  buildTicker(items);
  bindSearchAndChips();
  render();
}
document.addEventListener('DOMContentLoaded', main);
