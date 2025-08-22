/* ========= Utilities ========= */
function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function formatDate(d){ return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : ""; }
function isNew(post){
  try { return (Date.now() - new Date(post.pubDate).getTime()) < 1000*60*60*48; } // < 48 hours
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

/* ========= Visitor Counter (per-device) ========= */
(function(){
  let count = parseInt(localStorage.getItem("visitCount") || "0", 10) + 1;
  localStorage.setItem("visitCount", String(count));
  const el = document.getElementById("visitCount");
  if (el) el.textContent = count.toLocaleString("en-IN");
})();

/* ========= Theme Persistence ========= */
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

/* ========= Mobile Hamburger ========= */
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

/* ========= Data Fetchers ========= */
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
async function loadType(type){ // 'jobs' | 'news' | 'exams'
  const j = await fetchJSON(`/.netlify/functions/jobful?type=${encodeURIComponent(type)}`);
  return (j.jobs || j.news || j.exams || []);
}

/* ========= Render Helpers ========= */
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

/* ========= Post Finding Helpers ========= */
function normalizeId(x){ return decodeURIComponent(String(x||"")).trim(); }
function findPostById(targetId, arrays){
  const id = normalizeId(targetId);
  const flat = arrays.flat().filter(Boolean);
  // direct id match
  let hit = flat.find(p => String(p.id) === id);
  if (hit) return hit;
  // match by link
  hit = flat.find(p => (p.link && (p.link === id || p.link.startsWith(id) || id.startsWith(p.link))));
  if (hit) return hit;
  // weak match by title (last resort)
  hit = flat.find(p => (p.title && p.title.trim() === id));
  return hit || null;
}

/* ========= Save clicked item to sessionStorage (instant post render) ========= */
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.post-link");
  if (!a) return;
  const id = a.getAttribute("data-id");
  const from = a.getAttribute("data-from") || "Post";
  try {
    const allPosts = (window.__CACHE_ALL_POSTS || []);
    const hit = findPostById(id, [allPosts]);
    if (hit) {
      sessionStorage.setItem("lastPost", JSON.stringify(hit));
      sessionStorage.setItem("lastPostFrom", from);
    }
  } catch(_) {}
});

/* ========= Main Boot ========= */
(async function init(){
  const homeJobs   = document.getElementById("home-latest-jobs");
  const homeNews   = document.getElementById("home-latest-news");
  const homeExams  = document.getElementById("home-latest-exams");
  const allJobs    = document.getElementById("all-jobs");
  const allNews    = document.getElementById("all-news");
  const allExams   = document.getElementById("all-exams");
  const trendingEl = document.getElementById("trendingList");
  const notifBar   = document.getElementById("notifications-scroll");
  const postBody   = document.getElementById("postBody");

  let all = { jobs: [], news: [], exams: [], trending: [] }, wbJobs = [];
  try {
    [all, wbJobs] = await Promise.all([ loadAll(), loadWBJobsOnly() ]);
  } catch (e) {
    console.warn("Function fetch failed. Lists will be empty until functions work.", e);
  }

  // Cache all posts globally for quick lookups (used by sessionStorage saver)
  window.__CACHE_ALL_POSTS = [
    ...(wbJobs || []),
    ...(all.jobs || []),
    ...(all.news || []),
    ...(all.exams || [])
  ];

  // Home sections (show latest 6)
  if (homeJobs)  renderList("home-latest-jobs",  wbJobs,     6);
  if (homeNews)  renderList("home-latest-news",  all.news,   6);
  if (homeExams) renderList("home-latest-exams", all.exams,  6);

  // Full pages
  if (allJobs)    renderList("all-jobs",   wbJobs);
  if (allNews)    renderList("all-news",   all.news);
  if (allExams)   renderList("all-exams",  all.exams);
  if (trendingEl) renderList("trendingList", all.trending);

  // Sidebar auto-scrollers
  mountAutoScroll("notificationsList", all.news, "news");
  mountAutoScroll("announcementsList", wbJobs,   "jobs");
  const othersMix = [...(all.news || []).slice(6,16), ...(wbJobs || []).slice(6,16)];
  mountAutoScroll("othersList", othersMix, "home");

  // Top horizontal ticker
  if (notifBar){
    const heads = [...(wbJobs || []).slice(0,10), ...(all.news || []).slice(0,10)];
    notifBar.innerHTML = heads.length
      ? heads.map(h => `<span>🔔 ${safe(h.title)}</span>`).join(" • ")
      : `<span>🔔 Welcome to JobPulse Kolkata — live WB jobs & news</span>`;
    let x = 0;
    setInterval(() => {
      x += 2;
      notifBar.scrollLeft = x;
      if (x >= notifBar.scrollWidth - notifBar.clientWidth) x = 0;
    }, 50);
  }

  // ====== Post page hydration (robust) ======
  if (postBody){
    // show a quick loading state
    const titleEl = document.getElementById("postTitle");
    if (titleEl) titleEl.textContent = "Loading…";

    const params = new URLSearchParams(location.search);
    const targetId = params.get("id") || "";
    const fromParam = (params.get("from") || "").toLowerCase(); // jobs|news|exams|post

    // 1) Try saved sessionStorage item (fastest)
    try {
      const cached = JSON.parse(sessionStorage.getItem("lastPost") || "null");
      if (cached && String(cached.id) === normalizeId(targetId)) {
        renderPost(cached);
        return;
      }
    } catch(_) {}

    // 2) Try current memory (what we already fetched on this page)
    let hit = findPostById(targetId, [
      (wbJobs || []), (all.jobs || []), (all.news || []), (all.exams || [])
    ]);
    if (hit){ renderPost(hit); return; }

    // 3) Try fetching specific list (based on ?from=)
    try {
      if (["jobs","news","exams"].includes(fromParam)) {
        const list = await loadType(fromParam);
        hit = findPostById(targetId, [list]);
        if (hit){ renderPost(hit); return; }
      }
    } catch(_) {}

    // 4) Final fallback: fetch ALL again and try fuzzy
    try {
      const all2 = await loadAll();
      hit = findPostById(targetId, [(all2.jobs||[]),(all2.news||[]),(all2.exams||[])]);
      if (hit){ renderPost(hit); return; }
    } catch(_) {}

    // If still not found
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
    // store for reloads
    try { sessionStorage.setItem("lastPost", JSON.stringify(hit)); } catch(_) {}
  }
})();
