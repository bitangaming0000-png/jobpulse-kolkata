// assets/js/main.js
import { formatDateTimeIST, el, truncate, safeURL } from './utils.js';

// Mount header & footer
async function mountShell(){
  const [header, footer] = await Promise.all([
    fetch('/components/header.html').then(r=>r.text()),
    fetch('/components/footer.html').then(r=>r.text())
  ]);
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', footer);
  document.getElementById('year').textContent = new Date().getFullYear();
  // ---- AdSense head include (once per page) ----
  try {
    const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
    const frag = document.createElement('template');
    frag.innerHTML = adsHead.trim();
    const hasAdScript = !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    if(!hasAdScript){
      document.head.appendChild(frag.content.cloneNode(true));
    }
  } catch(e){}

  // ---- Replace ad placeholders with your unit ----
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

  // ---- AdSense head include (once per page) ----
  try {
    const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
    const frag = document.createElement('template');
    frag.innerHTML = adsHead.trim();
    // insert only if not already present
    const hasAdScript = !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
    if(!hasAdScript){
      document.head.appendChild(frag.content.cloneNode(true));
    }
  } catch(e){ /* ignore if not configured */ }

  // ---- Replace ad placeholders with your unit ----
  try {
    const unit = await fetch('/components/ads-unit.html').then(r=>r.text());
    document.querySelectorAll('.ad-slot').forEach(ph => {
      ph.outerHTML = unit;
    });
  } catch(e){ /* ignore if not configured */ }


  // Theme toggle
  const themeKey = 'jp-theme';
  const root = document.documentElement;
  function applyTheme(t){ root.setAttribute('data-theme', t); }
  applyTheme(localStorage.getItem(themeKey) || 'dark');
  document.getElementById('themeToggle').addEventListener('click',()=>{
    const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
    localStorage.setItem(themeKey, t); applyTheme(t);
  });

  // Hamburger
  const nav = document.getElementById('sideNav');
  document.getElementById('hamburger').addEventListener('click',()=>{
    const open = nav.classList.toggle('open');
    nav.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  // Date & Time
  const dt = document.getElementById('dateTime');
  const tick = ()=> dt.textContent = '🕒 ' + formatDateTimeIST();
  tick(); setInterval(tick, 30_000);

  // Visitor Count (countapi.xyz)
  const vc = document.querySelector('#visitorCount span');
  try {
    const ns = 'jobpulse-kolkata';
    const key = 'site-visits';
    const r = await fetch(`https://api.countapi.xyz/hit/${ns}/${key}`);
    const j = await r.json();
    vc.textContent = j.value.toLocaleString('en-IN');
  } catch(e) {
    vc.textContent = '—';
  }
}

async function getRSS(){
  const url = '/api/rss';
  const r = await fetch(url);
  if(!r.ok) throw new Error('RSS API failed');
  const j = await r.json();
  return j.items || [];
}

function cardForPost(p){
  const c = el('article','card');
  const date = p.pubDate ? new Date(p.pubDate) : null;
  c.innerHTML = `
    <div class="meta"><span class="badge">${date? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(date):'New'}</span>
    <span class="badge">WB Only</span></div>
    <h3><a href="/pages/post.html?title=${encodeURIComponent(p.title)}&link=${encodeURIComponent(p.link)}&desc=${encodeURIComponent(p.description)}&date=${encodeURIComponent(p.pubDate||'')}" target="_self">${p.title}</a></h3>
    <p>${truncate(p.description, 160)}</p>
    <a class="badge" href="${safeURL(p.link)}" target="_blank" rel="noopener">Source ↗</a>
  `;
  return c;
}

async function mountHome(){
  const top = document.getElementById('top-scroll');
  const notices = document.getElementById('notices');
  const trending = document.getElementById('trending');

  const items = await getRSS();

  // Top horizontal scroller (latest 10)
  items.slice(0,10).forEach(p => top.appendChild(cardForPost(p)));

  // Notifications (items that contain "Admit", "Call Letter", "Result")
  const notif = items.filter(p => /admit|call letter|result/i.test(p.title + ' ' + p.description)).slice(0,8);
  notif.forEach(p => notices.appendChild(cardForPost(p)));

  // Trending (most repeated host)
  const byHost = {};
  for(const it of items){
    try{
      const h = new URL(it.link).host.replace('www.','');
      byHost[h] = (byHost[h]||0)+1;
    }catch{}
  }
  const popularHosts = Object.entries(byHost).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).slice(0,3);
  const trend = items.filter(p=> popularHosts.includes(new URL(p.link).host.replace('www.',''))).slice(0,12);
  trend.forEach(p=> trending.appendChild(cardForPost(p)));
}

document.addEventListener('DOMContentLoaded', async ()=>{
  await mountShell();
  if(document.body.classList.contains('home')){
    try{ await mountHome(); }catch(e){ console.error(e); }
  }
});
