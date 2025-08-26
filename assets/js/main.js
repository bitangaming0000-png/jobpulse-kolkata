// assets/js/main.js
// IMPORTANT: index.html must include: <script type="module" src="/assets/js/main.js"></script>

function formatDateTimeIST(d=new Date()){
  return new Intl.DateTimeFormat('en-IN',{dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Kolkata'}).format(d);
}
function el(tag, cls='', txt=''){ const e=document.createElement(tag); if(cls) e.className=cls; if(txt!==undefined) e.textContent=txt; return e; }
function truncate(s='', n=160){ s=String(s); return s.length>n ? s.slice(0,n-1)+'…' : s; }

(function bootTheme(){
  try{
    const pref = localStorage.getItem('jp-theme');
    if(pref){ document.documentElement.setAttribute('data-theme', pref); return; }
    const hrs = Number(new Intl.DateTimeFormat('en-IN',{hour:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}).format(new Date()));
    document.documentElement.setAttribute('data-theme', (hrs>=6 && hrs<18)?'light':'dark');
  }catch{}
})();

async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
  const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();

  const root = document.documentElement;
  const tbtn = document.getElementById('themeToggle');
  if(tbtn) tbtn.addEventListener('click',()=>{
    const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
    localStorage.setItem('jp-theme', t); root.setAttribute('data-theme', t);
  });

  const dt = document.getElementById('dateTime');
  const tick = ()=> { if(dt) dt.textContent = '🕒 ' + formatDateTimeIST(); };
  tick(); setInterval(tick, 30000);
}

async function getRSS(){
  try{
    const r = await fetch('/api/rss'); // Vercel
    if(!r.ok) throw new Error('RSS API failed');
    const j = await r.json();
    return j.items || [];
  }catch(e){
    console.error('RSS error', e);
    return [];
  }
}

function enableAutoScrollX(el, speed=0.35){
  if(!el) return;
  let paused=false;
  const step = ()=>{
    if(!paused && el.scrollWidth > el.clientWidth){
      el.scrollLeft += speed;
      if(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1){ el.scrollLeft = 0; }
    }
    requestAnimationFrame(step);
  };
  el.addEventListener('mouseenter', ()=> paused = true);
  el.addEventListener('mouseleave', ()=> paused = false);
  step();
}

function cardForPost(p){
  const c = el('article','card');
  c.innerHTML = `
    <div class="thumb-wrap"><img class="thumb" alt="" loading="lazy" /></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description||'')}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description||'',180)}</p>
  `;
  const prompt = `West Bengal jobs: ${p.title}`;
  c.querySelector('.thumb').dataset.prompt = prompt;
  return c;
}

async function loadAIThumbs(container, limit=10){
  const imgs = Array.from(container.querySelectorAll('img.thumb')).slice(0, limit);
  for(const img of imgs){
    if(img.dataset.loaded) continue;
    const q = img.dataset.prompt || 'kolkata jobs';
    try{
      const r = await fetch('/api/ai-image?prompt='+encodeURIComponent(q));
      const j = await r.json();
      if(j && j.dataUrl){ img.src=j.dataUrl; img.alt=q; img.dataset.loaded='1'; }
    }catch{}
  }
}

function buildTicker(items){
  const wrap = document.getElementById('notify-ticker');
  if(!wrap) return;
  const subset = items.slice(0,18);
  const track = document.createElement('div'); track.className = 'ticker-track';
  const run = () => {
    const span = document.createElement('span'); span.className = 'ticker';
    subset.forEach(p=>{
      const a=document.createElement('a');
      a.href=`/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}`;
      a.textContent=p.title;
      span.appendChild(a);
    });
    return span;
  };
  track.appendChild(run()); track.appendChild(run());
  wrap.innerHTML=''; wrap.appendChild(track);
}

function renderSections(all){
  const top=document.getElementById('top-scroll');
  const trending=document.getElementById('trending');
  const notices=document.getElementById('notices');
  for(const cont of [top,trending,notices]) if(cont) cont.innerHTML='';

  all.slice(0,12).forEach(p=> top.appendChild(cardForPost(p)));
  all.slice(12,24).forEach(p=> trending.appendChild(cardForPost(p)));
  all.slice(0,12).forEach(p=> notices.appendChild(cardForPost(p)));

  loadAIThumbs(top,8); loadAIThumbs(trending,8); loadAIThumbs(notices,6);
  enableAutoScrollX(top,0.35); enableAutoScrollX(trending,0.35);
}

async function mountHome(){
  const items = await getRSS();
  buildTicker(items);
  renderSections(items);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){ await mountHome(); }
});
