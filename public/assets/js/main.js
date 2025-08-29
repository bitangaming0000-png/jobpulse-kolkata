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

// ===== Weather (Open-Meteo; no API key) =====
async function loadWeather(){
  try{
    // Kolkata: 22.5726, 88.3639
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=22.5726&longitude=88.3639&current=temperature_2m&forecast_days=1&timezone=Asia%2FKolkata';
    const r = await fetch(url);
    const j = await r.json();
    const t = j?.current?.temperature_2m;
    document.getElementById('wx').textContent = (t!==undefined) ? `${t} °C` : '—';
  }catch(e){ document.getElementById('wx').textContent='—'; }
}

// ===== Quotes (local rotation) =====
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

function card(p){
  const c=el('article','card');
  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy"></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description||'')}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description||'',180)}</p>
  `;
  const img=c.querySelector('img.thumb');
  const q=encodeURIComponent('kolkata jobs '+(p.title||''));
  img.src=`https://source.unsplash.com/800x450/?${q}`; img.alt=p.title||'thumbnail';
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

function render(items){
  const top=document.getElementById('top-scroll');
  const noti=document.getElementById('notices');
  const trend=document.getElementById('trending');
  [top,noti,trend].forEach(n=>n&&(n.innerHTML=''));

  items.slice(0,12).forEach(p=> top.appendChild(card(p)));
  items.slice(0,12).forEach(p=> noti.appendChild(card(p)));
  items.slice(12,24).forEach(p=> trend.appendChild(card(p)));

  autoScroll(top,0.35); autoScroll(trend,0.35);
}

async function main(){
  if(!document.body.classList.contains('home')) return;
  loadQuote();
  loadWeather();
  const items=await getRSS();
  buildTicker(items);
  render(items);
}
document.addEventListener('DOMContentLoaded', main);
