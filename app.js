/* ================================
   Utilities
================================== */
function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function byDateDesc(a,b){ return new Date(b.pubDate||0) - new Date(a.pubDate||0); }

/* ================================
   Theme (Dark/Light) – persistent
================================== */
(function initTheme(){
  const toggle = document.getElementById("modeToggle");
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  if (toggle) toggle.textContent = saved === "dark" ? "☀️" : "🌙";
  toggle?.addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (toggle) toggle.textContent = next === "dark" ? "☀️" : "🌙";
  });
})();

/* ================================
   Header: Date/Time • Menu • Visitors
================================== */
(function initHeader(){
  // Live date/time
  const dt = document.getElementById("dateTime");
  function tick(){ const now = new Date(); dt && (dt.textContent = now.toLocaleString()); }
  tick(); setInterval(tick, 1000);

  // Hamburger menu
  document.getElementById("menuToggle")?.addEventListener("click", ()=>{
    document.getElementById("mainNav")?.classList.toggle("hidden");
  });

  // Visitor counter (lifetime on this browser)
  const key="jp_visitors_total";
  let v = Number(localStorage.getItem(key)||"0"); v += 1;
  localStorage.setItem(key, String(v));
  const vc = document.getElementById("visitorCount");
  if (vc) vc.textContent = `👥 ${v} Visitors`;
})();

/* ================================
   Global State
================================== */
let ALL_POSTS = [];
let JOBS = [];
let NEWS = [];

/* ================================
   Client-side Cache (localStorage)
================================== */
function saveCache(data){
  localStorage.setItem("cachedPosts", JSON.stringify({ data, savedAt: Date.now() }));
}
function loadCache(){
  try{
    const c = JSON.parse(localStorage.getItem("cachedPosts"));
    if (!c) return null;
    if (Date.now() - c.savedAt > 15*60*1000) return null;
    return c.data;
  }catch{ return null; }
}

/* ================================
   Fetch with Fallback (robust)
================================== */
async function getPosts(){
  const local = loadCache();
  if (local) return local;

  try{
    const res = await fetch("/.netlify/functions/fetchFeeds");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    saveCache(data);
    return data;
  }catch(err){
    console.error("Fetch failed:", err);
    document.getElementById("breakingBanner")?.insertAdjacentHTML(
      "beforeend",
      ` <span style="font-weight:400">• Live feeds unavailable, showing cached if any.</span>`
    );
    try{
      const stale = JSON.parse(localStorage.getItem("cachedPosts"));
      if (stale?.data) return stale.data;
    }catch{}
    return { jobs: [], news: [] };
  }
}

/* ================================
   Classification / Enrichment
================================== */
const GOVT_KEYS = /govt|government|wbpsc|railway|ssc|upsc|police|bank|municipal|psu|wbpdcl|kolkata police|sarkari/i;
const EXAM_KEYS = /exam|admit card|hall ticket|result|answer key|syllabus|cut ?off|merit list|notification/i;
const LOCATIONS = ["Kolkata","Howrah","Siliguri","Asansol","Durgapur","Haldia","Kharagpur","Burdwan","Jalpaiguri","Malda","Bankura","Purulia"];

function detectType(title, source, category){
  const t=(title||"")+" "+(source||"")+" "+(category||"");
  return GOVT_KEYS.test(t) ? "govt" : "private";
}
function detectLoc(title, desc){
  const hay=(title||"")+" "+(desc||"");
  for(const L of LOCATIONS){ if(new RegExp(`\\b${L}\\b`,"i").test(hay)) return L; }
  return "";
}
function enrich(p){
  const kind=detectType(p.title,p.source,p.category);
  const location=detectLoc(p.title,p.description);
  return {...p, kind, location};
}

/* ================================
   Render Helpers
================================== */
function cardHTML(post, fromPage){
  const isNew = post.pubDate && (Date.now()-new Date(post.pubDate).getTime())/36e5 < 24;
  const badge = post.kind==="govt" ? '<span class="badge govt">Govt</span>' :
                post.kind==="private" ? '<span class="badge private">Private</span>' : '';
  return `
    <div class="card">
      <a href="post.html?id=${encodeURIComponent(post.id)}&from=${fromPage}">
        <img src="${safe(post.thumbnail||'dummy-photo.svg')}" alt="${safe(post.title)}">
        <h3>${badge}${safe(post.title)} ${isNew?'<span class="new-badge">NEW</span>':''}</h3>
        <p>${safe((post.description||"").slice(0,130))}...</p>
      </a>
    </div>`;
}
function renderCards(selector, items, fromPage){
  const el=document.querySelector(selector); if(!el) return;
  el.innerHTML = items.map(p=>cardHTML(p,fromPage)).join("");
}
function showEmpty(selector, msg){
  const el = document.querySelector(selector);
  if (el && (!el.innerHTML || !el.innerHTML.trim())){
    el.innerHTML = `<div style="opacity:.75;padding:12px">${msg}</div>`;
  }
}
function fillScrollableList(containerId, arr, fromTag){
  const el=document.getElementById(containerId); if(!el) return;
  el.innerHTML = `<ul>${arr.map(p=>`<li><a href="post.html?id=${encodeURIComponent(p.id)}&from=${fromTag}">${safe(p.title)}</a></li>`).join("")}</ul>`;
}
function buildKeywords(){
  const box=document.getElementById("trendingKeywords");
  if(!box) return;
  const stop=new Set(["the","a","an","for","to","of","and","in","on","with","by","is","at","from","job","jobs","hiring","apply","new"]);
  const freq={};
  ALL_POSTS.slice(0,150).forEach(p=>{
    const words=(p.title||"").toLowerCase().match(/[a-z0-9]+/g)||[];
    words.forEach(w=>{ if(!stop.has(w)&&w.length>2) freq[w]=(freq[w]||0)+1; });
  });
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([w])=>w);
  box.innerHTML=top.map(w=>`<span class="tag">#${safe(w)}</span>`).join("");
}
function renderBreakingBanner(){
  const el=document.getElementById("breakingBanner"); if(!el) return;
  const b=NEWS[0];
  if(b){ el.innerHTML=`🚨 <a href="post.html?id=${encodeURIComponent(b.id)}&from=news">${safe(b.title)}</a>`; }
  else { el.textContent="No breaking news available right now."; }
}

/* ================================
   Page Inits
================================== */
function initHome(){
  fillScrollableList("notificationsList", NEWS.slice(0,12), "news");
  fillScrollableList("announcementsList", JOBS.slice(0,12), "jobs");
  const others=[...NEWS.slice(12,18), ...JOBS.slice(12,18)].sort(byDateDesc);
  fillScrollableList("othersList", others, "home");
  buildKeywords();

  fillScrollableList("notificationsListMobile", NEWS.slice(0,12), "news");
  fillScrollableList("announcementsListMobile", JOBS.slice(0,12), "jobs");
  fillScrollableList("othersListMobile", others, "home");

  document.querySelectorAll(".accordion-header").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btn.parentElement.classList.toggle("open");
    });
  });

  renderCards("#latestPosts", JOBS.slice(0,6), "jobs");
  showEmpty("#latestPosts", "No jobs yet. Please check back shortly.");

  renderCards("#govtJobs", JOBS.filter(j=>j.kind==="govt").slice(0,6), "jobs");
  showEmpty("#govtJobs", "No government jobs found.");

  renderCards("#privateJobs", JOBS.filter(j=>j.kind==="private").slice(0,6), "jobs");
  showEmpty("#privateJobs", "No private jobs found.");

  renderCards("#latestNews", NEWS.slice(0,6), "news");
  showEmpty("#latestNews", "No news yet. Pulling feeds...");

  renderBreakingBanner();
}
function initJobs(){
  const listSel="#jobsList";
  const qEl=document.getElementById("jobSearch");
  const typeEl=document.getElementById("jobTypeFilter");
  const locEl=document.getElementById("locationFilter");
  const eduEl=document.getElementById("educationFilter");

  function apply(){
    let arr=[...JOBS];
    const q=(qEl?.value||"").toLowerCase().trim();
    const typ=(typeEl?.value||"").toLowerCase();
    const loc=(locEl?.value||"");
    const edu=(eduEl?.value||"").toLowerCase();

    if(typ) arr=arr.filter(p=>p.kind===typ);
    if(loc) arr=arr.filter(p=>p.location===loc);
    if(edu) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(edu)||(p.description||"").toLowerCase().includes(edu));
    if(q) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q));

    renderCards(listSel, arr, "jobs");
    showEmpty(listSel, "No jobs match your filters.");
  }

  qEl?.addEventListener("input",apply);
  typeEl?.addEventListener("change",apply);
  locEl?.addEventListener("change",apply);
  eduEl?.addEventListener("change",apply);

  renderCards(listSel, JOBS, "jobs");
  showEmpty(listSel, "No jobs available right now.");
  renderBreakingBanner();
}
function initNews(){
  const listSel="#newsList";
  const qEl=document.getElementById("newsSearch");
  function apply(){
    let arr=[...NEWS];
    const q=(qEl?.value||"").toLowerCase().trim();
    if(q) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q));
    renderCards(listSel, arr, "news");
    showEmpty(listSel, "No news available right now.");
  }
  qEl?.addEventListener("input",apply);

  renderCards(listSel, NEWS, "news");
  showEmpty(listSel, "No news available right now.");
  renderBreakingBanner();
}
function initBreaking(){
  renderCards("#breakingList", NEWS, "news");
  showEmpty("#breakingList", "No trending news at the moment.");
}
function initExams(){
  const exams = NEWS.filter(n=>EXAM_KEYS.test(((n.title||"")+" "+(n.description||""))));
  renderCards("#examsList", exams, "news");
  showEmpty("#examsList", "No current exam alerts.");
}
function initPost(){
  const params=new URLSearchParams(location.search);
  const id=params.get("id"); const from=params.get("from")||"home";

  function paint(post){
    if(!post) return;
    const badge=document.getElementById("postBadge");
    badge.classList.remove("govt","private");
    badge.classList.add(post.kind==="govt"?"govt":"private");
    badge.textContent = post.kind==="govt"?"Govt":"Private";

    document.getElementById("postTitle").textContent = post.title||"Untitled";
    document.getElementById("postMeta").textContent =
      `Published: ${post.pubDate?new Date(post.pubDate).toLocaleString():"N/A"} • Source: ${post.source||""}${post.location?` • ${post.location}`:""}`;
    document.getElementById("postImage").src = post.thumbnail||"dummy-photo.svg";
    document.getElementById("postBody").innerHTML = post.description||"No description available.";

    const src=document.getElementById("postSource");
    const apply=document.getElementById("applyBtn");
    src.href = post.link||"#"; apply.href = post.link||"#";

    const back=document.getElementById("backBtn");
    if(from==="jobs"){back.href="jobs.html"; back.textContent="⬅ Back to Jobs";}
    else if(from==="news"){back.href="news.html"; back.textContent="⬅ Back to News";}
    else if(from==="breaking"){back.href="breaking.html"; back.textContent="⬅ Back to Trending";}
    else if(from==="exams"){back.href="exams.html"; back.textContent="⬅ Back to Exams";}
    else {back.href="index.html"; back.textContent="⬅ Back to Home";}
  }

  let cached=[]; try{cached=JSON.parse(sessionStorage.getItem("allPosts")||"[]");}catch{}
  if(cached.length) paint(cached.find(p=>p.id===id));

  fetch("/.netlify/functions/fetchFeeds")
    .then(r=>r.json())
    .then(data=>{
      const all=[...(data.jobs||[]),...(data.news||[])].map(enrich).sort(byDateDesc);
      sessionStorage.setItem("allPosts", JSON.stringify(all));
      if(!cached.length) paint(all.find(p=>p.id===id));
    }).catch(()=>{});
}

/* ================================
   Boot
================================== */
async function loadAndInit(){
  const data = await getPosts();

  JOBS = (data.jobs||[]).map(enrich).sort(byDateDesc);
  NEWS = (data.news||[]).map(enrich).sort(byDateDesc);
  ALL_POSTS = [...JOBS, ...NEWS].sort(byDateDesc);

  sessionStorage.setItem("allPosts", JSON.stringify(ALL_POSTS));

  const page = document.body.getAttribute("data-page") || "home";
  if (page === "home")      initHome();
  if (page === "jobs")      initJobs();
  if (page === "news")      initNews();
  if (page === "breaking")  initBreaking();
  if (page === "exams")     initExams();
  if (page === "post")      initPost();
}
loadAndInit();
