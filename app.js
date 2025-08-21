// === JobPulse West Bengal – Frontend ===

let JOBS = [];
let NEWS = [];
const PAGE = document.body.getAttribute('data-page') || 'home';

// Theme toggle
(function initTheme(){
  const btn = document.getElementById('modeToggle');
  const saved = localStorage.getItem('jp-theme');
  if(saved === 'light') document.documentElement.classList.add('light');
  btn && btn.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('light');
    localStorage.setItem('jp-theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
})();

// Category rules
const CATEGORY_RULES = [
  { name: 'Govt', rx: /(govt|psc|railway|ssc|upsc|wbpsc|recruitment|admit card|result)/i },
  { name: 'IT/Tech', rx: /(developer|software|engineer|data|tech|java|python|cloud|it)/i },
  { name: 'Education', rx: /(teacher|professor|faculty|school|college|university|ugc|net exam)/i },
  { name: 'Healthcare', rx: /(doctor|nurse|medical|pharma|hospital|mbbs|lab technician)/i },
  { name: 'Banking/Finance', rx: /(bank|finance|insurance|accountant|rbi|nbfc|auditor)/i },
  { name: 'Manufacturing', rx: /(factory|plant|production|mechanical|civil|electrical)/i },
  { name: 'Remote/International', rx: /(remote|overseas|international|work from home)/i },
  { name: 'Walk-in', rx: /(walk[- ]?in)/i },
];
function inferCategory(item){
  const hay = `${item.title} ${item.description} ${item.source}` || '';
  const found = CATEGORY_RULES.find(c => c.rx.test(hay));
  return found ? found.name : '';
}

// Utils
const safe = (s='') => s.replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short = (s='', n=200) => s.length>n ? s.slice(0,n)+'…' : s;
const fmtDate = (d) => { try{ return d ? new Date(d).toLocaleDateString() : '' }catch{return ''} };
const makeId = (item) => btoa(unescape(encodeURIComponent(`${item.title}|${item.link}`)));

// Cache feeds
async function getFeeds(){
  const cached = JSON.parse(localStorage.getItem('jp-cache') || 'null');
  const now = Date.now();
  if (cached && (now - cached.ts) < 10*60*1000) return cached.data;

  const res = await fetch('/.netlify/functions/fetchFeeds', { cache:'no-store' });
  const data = await res.json();
  localStorage.setItem('jp-cache', JSON.stringify({ ts: now, data }));
  return data;
}

// Card templates
function toPostUrl(item){
  const id = makeId(item);
  const type = item.type || (item.thumbnail ? 'news' : 'job');
  return `post.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
}
function newsCard(n){
  return `
  <article class="card">
    ${n.thumbnail ? `<img src="${n.thumbnail}" alt="News image">` : `<img src="dummy-photo.svg" alt="dummy">`}
    <h3><a href="${toPostUrl(n)}">${safe(n.title)}</a></h3>
    <div class="meta">${safe(n.source || '')} ${fmtDate(n.pubDate)?`• ${fmtDate(n.pubDate)}`:''}</div>
    <div class="badges">
      ${n.category ? `<span class="badge">${safe(n.category)}</span>` : ``}
    </div>
    <p>${short(safe(n.description||''),150)}</p>
  </article>`;
}
function jobCard(j){
  return `
  <article class="card">
    ${j.thumbnail ? `<img src="${j.thumbnail}" alt="Job image">` : `<img src="dummy-photo.svg" alt="dummy">`}
    <h3><a href="${toPostUrl(j)}">${safe(j.title)}</a></h3>
    <div class="meta">${safe(j.source || '')} ${fmtDate(j.pubDate)?`• ${fmtDate(j.pubDate)}`:''}</div>
    <div class="badges">
      ${j.category ? `<span class="badge">${safe(j.category)}</span>` : ``}
    </div>
    <p>${short(safe(j.description||''),150)}</p>
  </article>`;
}
function renderCards(container, items){
  const el = document.querySelector(container);
  if(!el) return;
  if(!items.length){ el.innerHTML = `<div class="empty">No results</div>`; return; }
  el.innerHTML = items.map(it=> it.type==='news'? newsCard(it): jobCard(it)).join('');
}

// Init
(async function(){
  const { jobs, news } = await getFeeds();
  JOBS = jobs.map(j=> ({...j, category: j.category||inferCategory(j), type:'job'}));
  NEWS = news.map(n=> ({...n, category: n.category||inferCategory(n), type:'news'}));

  // Homepage → show 6 each
  if(PAGE === 'home'){
    renderCards('#updatesList', NEWS.slice(0,6));
    renderCards('#eduJobsList', JOBS.filter(j=> j.category==="Education").slice(0,6));
    renderCards('#notifJobsList', JOBS.filter(j=> j.category==="Govt").slice(0,6));
  }

  // Jobs page → all jobs
  if(PAGE === 'jobs'){
    renderCards('#jobList', JOBS);
  }

  // News page → all news
  if(PAGE === 'news'){
    renderCards('#newsList', NEWS);
  }

  // Post page → details
  if(PAGE === 'post'){
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const type = params.get('type');
    const all = type==='job'? JOBS : NEWS;
    const item = all.find(i=> makeId(i)===id);
    const container = document.getElementById('postContainer');
    if(item && container){
      container.innerHTML = `
        <div class="post-card">
          <h1>${safe(item.title)}</h1>
          <div class="post-meta">${safe(item.source || '')} ${fmtDate(item.pubDate)?`• ${fmtDate(item.pubDate)}`:''}</div>
          ${item.thumbnail? `<img src="${item.thumbnail}" alt="image" style="width:100%;border-radius:12px;margin:12px 0">` : ``}
          <div class="post-body"><p>${safe(item.description||'')}</p></div>
          <div class="post-actions"><a href="${item.link}" target="_blank" class="btn">Read Original</a></div>
        </div>`;
    }
  }
})();
