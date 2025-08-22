/* ========= Utilities ========= */
function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function formatDate(d){ return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : ""; }
function isNew(post){
  try { return (Date.now() - new Date(post.pubDate).getTime()) < 1000*60*60*48; }
  catch(e){ return false; }
}
function createCard(item){
  const from = item.category || "Post";
  return `<article class="card">
    <img src="${item.thumbnail}" alt="${safe(item.title)}" class="thumb"/>
    <div class="content">
      <h3>
        <a class="post-link"
           data-id="${safe(item.id)}"
           data-from="${safe(from)}"
           href="post.html?id=${encodeURIComponent(item.id)}&from=${encodeURIComponent(from)}">
          ${safe(item.title)}
        </a>
        ${isNew(item) ? '<span class="badge-new">NEW 🔥</span>' : ''}
      </h3>
      <p class="desc">${safe((item.description || "").slice(0, 160))}...</p>
      <div class="meta"><span>${formatDate(item.pubDate)}</span><span>${safe(item.source || "")}</span></div>
    </div>
  </article>`;
}

/* ========= Visitor Counter ========= */
(function(){
  let count = parseInt(localStorage.getItem("visitCount") || "0", 10) + 1;
  localStorage.setItem("visitCount", String(count));
  const el = document.getElementById("visitCount");
  if (el) el.textContent = count.toLocaleString("en-IN");
})();

/* ========= Theme ========= */
(function(){
  const htmlEl = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", saved);
  if (btn) {
    btn.textContent = saved === "dark" ? "☀️ Light" : "🌙 Dark";
    btn.addEventListener("click", () => {
      const next = htmlEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
      htmlEl.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      btn.textContent = next === "dark" ? "☀️ Light" : "🌙 Dark";
    });
  }
})();

/* ========= Mobile Nav ========= */
(function(){
  const navToggle = document.getElementById("navToggle");
  const mainNav = document.getElementById("mainNav");
  if (!navToggle || !mainNav) return;
  navToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", (e) => {
    if (!mainNav.contains(e.target) && !navToggle.contains(e.target)) mainNav.classList.remove("open");
  });
})();

/* ========= Data ========= */
async function fetchJSON(url){
  const res = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function loadAll(){ return fetchJSON("/.netlify/functions/jobful"); }
async function loadWBJobsOnly(){
  const j = await fetchJSON("/.netlify/functions/jobful?type=jobs&onlyWB=1");
  return j.jobs || [];
}
async function loadType(type){
  const j = await fetchJSON(`/.netlify/functions/jobful?type=${encodeURIComponent(type)}`);
  return (j.jobs || j.news || j.exams || []);
}

/* ========= Render helpers ========= */
function renderList(id, arr, limit = 0){
  const el = document.getElementById(id); if (!el) return;
  const list = limit ? (arr || []).slice(0, limit) : (arr || []);
  el.innerHTML = list.length ? list.map(createCard).join("") : `<p class="muted">No posts available</p>`;
}
function mountAutoScroll(elId, items, from = "home"){
  const el = document.getElementById(elId); if (!el) return;
  const list = (items || []).slice(0, 16);
  if (!list.length){ el.innerHTML = `<ul><li>No updates</li></ul>`; return; }
  el.innerHTML = `<ul>${[...list, ...list].map(p =>
    `<li><a class="post-link" data-id="${safe(p.id)}" data-from="${safe(from)}" href="post.html?id=${encodeURIComponent(p.id)}&from=${encodeURIComponent(from)}">${safe(p.title)}</a></li>`
  ).join("")}</ul>`;
}

/* ========= Category logic (Govt / Private / WFH / Freshers) ========= */
const JOB_CATS = {
  govt:     { label: "Govt",     slug: "govt"     },
  private:  { label: "Private",  slug: "private"  },
  wfh:      { label: "Work From Home", slug: "wfh" },
  freshers: { label: "Freshers", slug: "freshers" }
};

function jobMatches(job, cat){
  const hay = (`${job.title||""} ${job.description||""} ${job.source||""}`).toLowerCase();

  const KW = {
    govt:     ["govt","government","wbpsc","state govt","public service","ssc","railway","psu","municipal","wb police","kolkata police","bank of india","wbpdcl","kmda","kmc","high court","judicial","wbhrb","wbset","food inspector","panchayat","wbsub"],
    wfh:      ["remote","work from home","wfh","home-based","telecommute","anywhere","hybrid"],
    freshers: ["fresher","freshers","entry level","0-1 year","0-2 year","no experience","graduate trainee","trainee","intern"]
  };

  if (cat === "govt")     return KW.govt.some(k => hay.includes(k));
  if (cat === "wfh")      return KW.wfh.some(k => hay.includes(k));
  if (cat === "freshers") return KW.freshers.some(k => hay.includes(k));
  if (cat === "private")  return !KW.govt.some(k => hay.includes(k)); // everything not detected as govt
  return true;
}

function filterJobsByCategory(jobs, cat){
  if (!cat || !JOB_CATS[cat]) return jobs;
  return (jobs || []).filter(j => jobMatches(j, cat));
}

function highlightActiveChip(cat){
  document.querySelectorAll(".chipbar .chip").forEach(a => {
    const isActive = a.getAttribute("href").includes(`cat=${cat}`);
    a.classList.toggle("active", !!cat && isActive);
  });
  const title = document.getElementById("jobs-title");
  if (title && JOB_CATS[cat]) title.textContent = `💼 ${JOB_CATS[cat].label} Jobs`;
}

/* ========= Save clicked post for instant detail render ========= */
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.post-link");
  if (!a) return;
  const id = a.getAttribute("data-id");
  const from = a.getAttribute("data-from") || "Post";
  try {
    const flat = (window.__CACHE_ALL_POSTS || []);
    const hit = flat.find(p => String(p.id) === String(id));
    if (hit) {
      sessionStorage.setItem("lastPost", JSON.stringify(hit));
      sessionStorage.setItem("lastPostFrom", from);
    }
  } catch(_) {}
});

/* ========= Boot ========= */
(async function init(){
  const homeJobs   = document.getElementById("home-latest-jobs");
  const homeNews   = document.getElementById("home-latest-news");
  const homeExams  = document.getElementById("home-latest-exams");
  const allJobsEl  = document.getElementById("all-jobs");
  const allNews    = document.getElementById("all-news");
  const allExams   = document.getElementById("all-exams");
  const trendingEl = document.getElementById("trendingList");
  const notifBar   = document.getElementById("notifications-scroll");
  const postBody   = document.getElementById("postBody");

  let all = { jobs: [], news: [], exams: [], trending: [] }, wbJobs=[];
  try { [all, wbJobs] = await Promise.all([loadAll(), loadWBJobsOnly()]); }
  catch(e){ console.warn("Function fetch failed:", e); }

  // Cache for quick lookups
  window.__CACHE_ALL_POSTS = [ ...(wbJobs||[]), ...(all.jobs||[]), ...(all.news||[]), ...(all.exams||[]) ];

  // Home sections
  if (homeJobs)  renderList("home-latest-jobs",  wbJobs,    6);
  if (homeNews)  renderList("home-latest-news",  all.news,  6);
  if (homeExams) renderList("home-latest-exams", all.exams, 6);

  // Jobs page w/ category
  if (allJobsEl){
    const params = new URLSearchParams(location.search);
    const cat = params.get("cat") || ""; // govt|private|wfh|freshers
    highlightActiveChip(cat);
    const list = filterJobsByCategory(wbJobs, cat);
    renderList("all-jobs", list);
  }

  // Other list pages
  if (allNews)    renderList("all-news",  all.news);
  if (allExams)   renderList("all-exams", all.exams);
  if (trendingEl) renderList("trendingList", all.trending);

  // Side auto-scrollers
  mountAutoScroll("notificationsList", all.news, "news");
  mountAutoScroll("announcementsList", wbJobs,   "jobs");
  const othersMix = [...(all.news||[]).slice(6,16), ...(wbJobs||[]).slice(6,16)];
  mountAutoScroll("othersList", othersMix, "home");

  // Top ticker
  if (notifBar){
    const heads = [...(wbJobs||[]).slice(0,10), ...(all.news||[]).slice(0,10)];
    notifBar.innerHTML = heads.length
      ? heads.map(h => `<span>🔔 ${safe(h.title)}</span>`).join(" • ")
      : `<span>🔔 Welcome to JobPulse Kolkata — live WB jobs & news</span>`;
    let x=0; setInterval(()=>{ x+=2; notifBar.scrollLeft=x; if(x>=notifBar.scrollWidth-notifBar.clientWidth){ x=0; }}, 50);
  }

  // Post page hydrate (robust)
  if (postBody){
    const params = new URLSearchParams(location.search);
    const rawId  = params.get("id") || "";
    const id     = decodeURIComponent(rawId);

    // 1) sessionStorage
    try {
      const cached = JSON.parse(sessionStorage.getItem("lastPost") || "null");
      if (cached && String(cached.id) === String(id)) { return renderPost(cached); }
    } catch(_) {}

    // 2) current memory
    let hit = window.__CACHE_ALL_POSTS.find(p => String(p.id)===String(id));
    if (hit) return renderPost(hit);

    // 3) fallback: fetch all
    try {
      const all2 = await loadAll();
      hit = [ ...(all2.jobs||[]), ...(all2.news||[]), ...(all2.exams||[]) ].find(p => String(p.id)===String(id));
      if (hit) return renderPost(hit);
    } catch(_) {}

    postBody.innerHTML = `<p class="muted">Sorry, this article could not be loaded. Please go back and try again.</p>`;
  }

  function renderPost(hit){
    const badge = document.getElementById("postBadge");
    if (badge) badge.textContent = hit.category || "Post";
    const titleEl = document.getElementById("postTitle");
    if (titleEl) titleEl.innerHTML = `${isNew(hit) ? '<span class="badge-new">NEW 🔥</span> ' : ''}${safe(hit.title || "Untitled")}`;
    const metaEl = document.getElementById("postMeta");
    if (metaEl) metaEl.textContent = `${formatDate(hit.pubDate)} • ${hit.source || ""}`;
    const imgEl = document.getElementById("postImage");
    if (imgEl) imgEl.src = hit.thumbnail || "assets/dummy-photo.svg";
    const body = document.getElementById("postBody");
    if (body) body.innerHTML = safe(hit.description || "");
    const src = document.getElementById("postSource"); if (src)   src.href   = hit.link || "#";
    const apply = document.getElementById("applyBtn"); if (apply) apply.href = hit.link || "#";
    try { sessionStorage.setItem("lastPost", JSON.stringify(hit)); } catch(_) {}
  }
})();
