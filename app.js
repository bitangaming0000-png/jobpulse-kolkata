// === JobPulse West Bengal – COMPLETE Frontend ===

// Globals & page
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

// Category inference
const CATEGORY_RULES = [
  { name: 'Govt',              rx: /(wbpsc|railway|government|municipal|psc|public service|ssc|police|army|navy|air force|state govt|upsc|recruitment|notification|admit card|result)/i },
  { name: 'IT/Tech',           rx: /(developer|engineer|software|data|ai|ml|cloud|devops|java|python|react|angular|node|it|full[- ]stack|sdet)/i },
  { name: 'Education',         rx: /(teacher|faculty|professor|lecturer|school|college|university|ugc|net exam|education|b\.?ed|m\.?ed)/i },
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

// Utility
const safe = (s='') => s.replace(/</g,'&lt;').replace(/>/g,'&gt;');
const short = (s='', n=200) => s.length>n ? s.slice(0,n)+'…' : s;
const fmtDate = (d) => { try{ return d ? new Date(d).toLocaleDateString() : '' }catch{return ''} };
const makeId = (item) => btoa(unescape(encodeURIComponent(`${item.title}|${item.link}`)));

// Cache feeds (10 min)
async function getFeeds(){
  const cached = JSON.parse(localStorage.getItem('jp-cache') || 'null');
  const now = Date.now();
  if (cached && (now - cached.ts) < 10*60*1000) return cached.data;

  const res = await fetch('/.netlify/functions/fetchFeeds', { cache:'no-store' });
  const data = await res.json();
  localStorage.setItem('jp-cache', JSON.stringify({ ts: now, data }));
  return data;
}

// Sidebar bucketing
function bucketSidebarItems(news){
  const items = [...news].sort((a,b)=> new Date(b.pubDate||0) - new Date(a.pubDate||0));
  const notif = [];
  const announce = [];
  const others = [];
  for(const n of items){
    const t = `${n.title} ${n.description}`.toLowerCase();
    if (/(notification|recruitment|admit card|result|vacancy|apply online)/.test(t)) notif.push(n);
    else if (/(announcement|update|launched|released|declared|exam date)/.test(t)) announce.push(n);
    else others.push(n);
  }
  return {
    notifications: notif.slice(0, 8),
    announcements: announce.slice(0, 8),
    others: others.slice(0, 8),
  };
}

// Cards (link to internal post page)
function toPostUrl(item){
  const id = makeId(item);
  const type = item.type || (item.thumbnail ? 'news' : 'job');
  return `post.html?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
}
function newsCard(n){
  return `
  <article class="card">
    ${n.thumbnail ? `<img src="${n.thumbnail}" alt="News image">` : ``}
    <h3><a href="${toPostUrl(n)}" style="text-decoration:none;color:inherit">${safe(n.title)}</a></h3>
    <div class="meta">${safe(n.source || '')} ${fmtDate(n.pubDate)?`• ${fmtDate(n.pubDate)}`:''}</div>
    <div class="badges">
      ${n.region ? `<span class="badge accent">${safe(n.region)}</span>` : ``}
      ${n.category ? `<span class="badge">${safe(n.category)}</span
