// === JobPulse West Bengal – Home with Sidebar & Central Sections ===

let JOBS = [];
let NEWS = [];

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

// Category inference
const CATEGORY_RULES = [
  { name: 'Govt',              rx: /(wbpsc|railway|government|municipal|psc|public service|ssc|police|army|navy|air force|state govt|upsc|recruitment|notification)/i },
  { name: 'IT/Tech',           rx: /(developer|engineer|software|data|ai|ml|cloud|devops|java|python|react|angular|node|it|full[- ]stack|sdet)/i },
  { name: 'Education',         rx: /(teacher|faculty|professor|lecturer|school|college|university|ugc|net exam|education|b.ed|m.ed)/i },
  { name: 'Healthcare',        rx: /(nurse|doctor|mbbs|bds|pharma|pharmacist|medical|hospital|lab technician|healthcare)/i },
  { name: 'Banking/Finance',   rx: /(bank|nbfc|finance|fintech|accountant|accounts|cfa|cma|auditor|ipo|mutual fund|insurance|rbi)/i },
  { name: 'Manufacturing',     rx: /(plant|factory|production|manufacturing|mechanical|civil|electrical|quality control|qc|qa)/i },
  { name: 'Remote/International', rx: /(remote|work from home|wfh|visa|overseas|international)/i },
  { name: 'Walk-in',           rx: /(walk[- ]?in|walkin)/i },
];

function inferCategory(item){
  const hay = `${item.title} ${item.description} ${item.source}` || '';
  const found = CATEGORY_RULES.find(c => c.rx.test(hay));
  return found ? found.name : '';
}

// Bucketing for sidebar
function bucketSidebarItems(news){
  const items = [...news].sort((a,b)=> new Date(b.pubDate||0) - new Date(a.pubDate||0));
  const notif = [];      // Notifications (Govt / recruitment / admit cards / results)
  const announce = [];   // Latest Announcements (generic updates, exams, releases)
  const others = [];     // Everything else

  for(const n of items){
    const text = `${n.title} ${n.description}`.toLowerCase();
    if (/(notification|recruitment|admit card|result|vacancy|apply online)/.test(text)) notif.push(n);
    else if (/(announcement|update|launched|released|declared|exam date)/.test(text)) announce.push(n);
    else others.push(n);
  }
  return {
    notifications: notif.slice(0, 8),
    announcements: announce.slice(0, 8),
    others: others.slice(0, 8),
  };
}

// Helpers
function short(s='', n=160){ return s.length>n ? s.slice(0,n)+'…' : s; }
function dateStr(d){ try{ return d ? new Date(d).toLocaleDateString() : '' }catch{return ''} }
function empty(container, msg){ container.innerHTML = `<div class="empty">${msg}</div>`; }

// Render small link list in sidebar
function renderSideList(el, arr){
  if(!el) return;
  if(!arr.length){ el.innerHTML = `<li><span class="empty">No items yet</span></li>`; return; }
  el.innerHTML = arr.map(x => `
    <li><a href="${x.link}" target="_blank" rel="noopener">
      ${x.title}
    </a></li>
  `).join('');
}

// Cards
function newsCard(n){
  return `
  <article class="card">
    ${n.thumbnail ? `<img src="${n.thumbnail}" alt="News image">` : ``}
    <h3>${n.title}</h3>
    <div class="meta">${n.source || ''} ${dateStr(n.pubDate)?`• ${dateStr(n.pubDate)}`:''}</div>
    <div class="badges">
      ${n.region ? `<span class="badge accent">${n.region}</span>` : ``}
      ${n.category ? `<span class="badge">${n.category}</span>` : `<span class="badge">News</span>`}
    </div>
    <p class="desc">${short(n.description, 200)}</p>
    <div class="actions-row">
      <a class="btn btn-apply" href="${n.link}" target="_blank" rel="noopener">Read More ↗</a>
      <a class="btn btn-share" href="https://chat.whatsapp.com/I9VTTrRcrcz8wAMG8yq90N?text=${encodeURIComponent('Check this update: ' + n.title + ' - ' + n.link)}" target="_blank" rel="noopener">Share ↗</a>
    </div>
  </article>`;
}
function jobCard(j){
  return `
  <article class="card">
    <h3>${j.title}</h3>
    <div class="meta">${j.source || 'Source'} ${dateStr(j.pubDate)?`• ${dateStr(j.pubDate)}`:''}</div>
    <div class="badges">
      ${j.region ? `<span class="badge accent">${j.region}</span>` : ``}
      ${j.category ? `<span class="badge">${j.category}</span>` : `<span class="badge">Job</span>`}
    </div>
    <p class="desc">${short(j.description, 200)}</p>
    <div class="actions-row">
      <a class="btn btn-apply" href="${j.link}" target="_blank" rel="noopener">Apply ↗</a>
      <a class="btn btn-share" href="https://chat.whatsapp.com/I9VTTrRcrcz8wAMG8yq90N?text=${encodeURIComponent('Check this job: ' + j.title + ' - ' + j.link)}" target="_blank" rel="noopener">Share ↗</a>
    </div>
  </article>`;
}

// Load unified data
async function fetchData(){
  const res = await fetch('/.netlify/functions/fetchFeeds', { cache:'no-store' });
  const data = await res.json();
  JOBS = (data.jobs || []).map(j => ({...j, category: j.category || inferCategory(j)}));
  NEWS = (data.news || []).map(n => ({...n, category: n.category || inferCategory(n)}));
}

// Initialize homepage
(async function initHome(){
  if(document.body.getAttribute('data-page') !== 'home') return;

  const searchHome = document.getElementById('searchHome');
  const districtHome = document.getElementById('districtHome');
  const categoryHome = document.getElementById('categoryHome');

  const sideNotifications = document.getElementById('sideNotifications');
  const sideAnnouncements = document.getElementById('sideAnnouncements');
  const sideOthers = document.getElementById('sideOthers');

  const updatesList = document.getElementById('updatesList');     // New Updates
  const eduJobsList = document.getElementById('eduJobsList');     // Jobs
