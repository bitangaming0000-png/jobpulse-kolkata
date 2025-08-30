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

// ===== Card builder (with Last Updated + Read More) =====
function card(p){
  const c = el('article','card');
  const d = new Date(p.pubDate || Date.now());
  const formattedDate = d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'});

  const url = `/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description||'')}&date=${encodeURIComponent(p.pubDate||'')}`;

  c.innerHTML = `
    <div class="thumb-wrap">
      <img class="thumb" alt="" loading="lazy">
    </div>
    <h3><a href="${url}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description||'',160)}</p>
    <p class="muted">🕒 Last updated: ${formattedDate}</p>
    <a href="${url}" class="readmore-btn">Read More →</a>
  `;

  const img=c.querySelector('img.thumb');
  const q=encodeURIComponent('kolkata jobs '+(p.title||''));
  img.src=`https://source.unsplash.com/800x450/?${q}`;
  img.alt=p.title||'thumbnail';
  img.onerror = () => { img.src = "https://via.placeholder.com/800x450.png?text=JobPulse+Kolkata"; };

  return c;
}

// ===== Render sections =====
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

// ===== Main =====
async function main(){
  if(!document.body.classList.contains('home')) return;
  const items=await getRSS();
  buildTicker(items);
  render(items);
}
document.addEventListener('DOMContentLoaded', main);
