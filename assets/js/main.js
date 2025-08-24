// assets/js/main.js (FINAL — consent-aware, self-contained, no imports)
(function(){
  // --- utils ---
  function pad(n){return n<10?'0'+n:''+n}
  function formatDateTimeIST(){
    try{
      const now = new Date();
      return new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Kolkata' }).format(now);
    }catch(e){
      const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes());
    }
  }
  function el(tag, cls, txt){ const n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; }
  function truncate(s, n){ s=String(s||''); return s.length>n? s.slice(0,n-1)+'…' : s; }
  function safeURL(u){ try{ const x=new URL(u); return x.href; } catch(e){ return '#'; } }

  const CACHE_KEY = 'jp-cache-items';
  function saveCache(items){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts: Date.now(), items})) }catch{} }
  function readCache(){ try{ const j = JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return (j&&j.items)||[] }catch{ return [] } }

  function hash(s){ let h=0; for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return 'h'+Math.abs(h); }
  async function getSourceThumb(link){
    const key = 'jp-src-thumb:'+hash(link);
    try{ const c = localStorage.getItem(key); if(c) return c; }catch{}
    try{
      const r = await fetch('/.netlify/functions/read-post?link='+encodeURIComponent(link));
      const j = await r.json();
      const url = (Array.isArray(j.images) && j.images[0]) ? j.images[0] : null;
      if(url){ try{ localStorage.setItem(key, url); }catch{}; return url; }
    }catch(e){}
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
    try{
      const [header, footer] = await Promise.all([
        fetch('/components/header.html').then(r=>r.text()),
        fetch('/components/footer.html').then(r=>r.text())
      ]);
      document.body.insertAdjacentHTML('afterbegin', header);
      document.body.insertAdjacentHTML('beforeend', footer);
      const y=document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();
    }catch(e){ console.error('shell mount failed', e); }

    // AdSense head include (consent-aware)
    try {
      const consent = (window.jpConsent && window.jpConsent()) || '';
      if (consent === 'accepted' || consent === '') {
        const has = !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
        if(!has){
          const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
          const tmp=document.createElement('template'); tmp.innerHTML = adsHead.trim();
          document.head.appendChild(tmp.content.cloneNode(true));
        }
      } else {
        console.info('AdSense blocked until user accepts cookies.');
      }
      // if user accepts later, load ads script
      window.addEventListener('jp:consent-changed', async (ev) => {
        if (ev.detail?.value === 'accepted') {
          const has = !!document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]');
          if(!has){
            const adsHead = await fetch('/components/ads-head.html').then(r=>r.text());
            const tmp=document.createElement('template'); tmp.innerHTML = adsHead.trim();
            document.head.appendChild(tmp.content.cloneNode(true));
          }
        }
      });
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
    const toggle = document.getElementById('themeToggle');
    if(toggle){
      toggle.addEventListener('click',()=>{
        const t = (root.getAttribute('data-theme')==='dark')?'light':'dark';
        try{ localStorage.setItem('jp-theme', t);}catch{} root.setAttribute('data-theme', t);
      });
    }

    // Hamburger nav
    const nav = document.getElementById('sideNav');
    const hamburger = document.getElementById('hamburger');
    function openNav(){ if(nav){ nav.classList.add('open'); nav.setAttribute('aria-hidden','false'); } }
    function closeNav(){ if(nav){ nav.classList.remove('open'); nav.setAttribute('aria-hidden','true'); } }
    if(hamburger){
      hamburger.addEventListener('mouseenter', openNav);
      hamburger.addEventListener('click', ()=> { (nav && nav.classList.contains('open')) ? closeNav() : openNav(); });
    }
    if(nav){
      nav.addEventListener('mouseleave', closeNav);
      document.addEventListener('click', (e)=>{ if(!nav.contains(e.target) && !hamburger.contains(e.target)) closeNav(); });
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeNav(); });
    }

    // Date & Time
    const dt = document.getElementById('dateTime');
    function tick(){ if(dt) dt.textContent = '🕒 ' + formatDateTimeIST(); }
    tick(); setInterval(tick, 30000);

    // Visitor Count
    const vc = document.querySelector('#visitorCount span');
    try {
      const r = await fetch('/.netlify/functions/visitors');
      const j = await r.json(); if(vc) vc.textContent = (j.value ?? 0).toLocaleString('en-IN');
    } catch(e) { if(vc) vc.textContent = '—'; }
  }

  async function getRSS(){
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
    const img = c.querySelector('.thumb'); if(img) img.dataset.link = p.link;
    return c;
  }

  const WB_FILTER = new RegExp("\\b(West Bengal|WB|Kolkata|Howrah|Hooghly|Nadia|Siliguri|Durgapur|Kharagpur|Haldia|Medinipur|Bardhaman|Burdwan)\\b","i");
  function isWestBengalItem(item) {
    const fields = [item.title, item.description, item.link].filter(Boolean).join(" ");
    return WB_FILTER.test(fields);
  }

  function buildTicker(items){
    const wrap = document.getElementById('notify-ticker');
    if(!wrap) return;
    const filtered = (items||[]).filter(isWestBengalItem);
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

  async function loadSourceThumbs(container, limit=8){
    const imgs = Array.from(container.querySelectorAll('img.thumb')).slice(0, limit);
    for(const img of imgs){
      if(img.dataset.loaded) continue;
      const link = img.dataset.link; if(!link) continue;
      const url = await getSourceThumb(link);
      if(url){ img.src = url; img.alt = 'thumbnail'; img.dataset.loaded = '1'; }
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

    buildTicker(items);

    (items.slice(0,10)).forEach(p=> top && top.appendChild(cardForPost(p)));
    if(top && !top.children.length) showEmpty('top-scroll','No West Bengal posts found yet.');

    const notif=(items||[]).filter(p=>/admit|call letter|result/i.test((p.title||'')+(p.description||''))).slice(0,8);
    notif.forEach(p=> notices && notices.appendChild(cardForPost(p)));
    if(notices && !notif.length) showEmpty('notices','No notifications right now.');

    const byHost={}; for(const it of (items||[])){ try{const h=new URL(it.link).host.replace('www.',''); byHost[h]=(byHost[h]||0)+1;}catch{} }
    const popularHosts=Object.entries(byHost).sort((a,b)=>b[1]-a[1]).map(e=>e[0]).slice(0,3);
    const trend=(items||[]).filter(p=>{try{return popularHosts.includes(new URL(p.link).host.replace('www.',''))}catch{return false}}).slice(0,12);
    trend.forEach(p=> trending && trending.appendChild(cardForPost(p)));
    if(trending && !trend.length) showEmpty('trending','No trending sources yet.');

    await loadCategories();

    loadSourceThumbs(top, 8);
    loadSourceThumbs(notices, 6);
    loadSourceThumbs(trending, 8);
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await mountShell();
    if(document.body.classList.contains('home')){ try{await mountHome();}catch(e){console.error(e);} }
  });
})();
