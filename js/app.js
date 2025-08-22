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
        <a href="post.html?id=${encodeURIComponent(item.id)}&from=${encodeURIComponent(from)}">${safe(item.title)}</a>
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
    `<li><a href="post.html?id=${encodeURIComponent(p.id)}&from=${encodeURIComponent(from)}">${safe(p.title)}</a></li>`
  ).join("")}</ul>`;
}

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
    // Load everything in parallel for speed
    [all, wbJobs] = await Promise.all([ loadAll(), loadWBJobsOnly() ]);
  } catch (e) {
    console.warn("Function fetch failed. Lists will be empty until functions work.", e);
  }

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

  // Top horizontal ticker (always shows something)
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

  // Post page hydrate
  if (postBody){
    const params = new URLSearchParams(location.search);
    const rawId  = params.get("id") || "";
    const id     = decodeURIComponent(rawId); // ensure proper match even if ID has special chars
    const allPosts = [ ...(wbJobs || []), ...(all.news || []), ...(all.exams || []) ];
    const hit = allPosts.find(p => String(p.id) === String(id));

    if (hit){
      const badge = document.getElementById("postBadge");
      if (badge) badge.textContent = hit.category || "Post";
      const titleEl = document.getElementById("postTitle");
      if (titleEl) titleEl.innerHTML = `${isNew(hit) ? '<span class="badge-new">NEW 🔥</span> ' : ''}${safe(hit.title || "Untitled")}`;
      const metaEl = document.getElementById("postMeta");
      if (metaEl) metaEl.textContent = `${formatDate(hit.pubDate)} • ${hit.source || ""}`;
      const imgEl = document.getElementById("postImage");
      if (imgEl) imgEl.src = hit.thumbnail || "assets/dummy-photo.svg";
      postBody.innerHTML = safe(hit.description || "");
      const src = document.getElementById("postSource"); if (src)   src.href   = hit.link || "#";
      const apply = document.getElementById("applyBtn"); if (apply) apply.href = hit.link || "#";
    } else {
      postBody.innerHTML = `<p class="muted">Sorry, this post could not be found.</p>`;
    }
  }
})();
// Trending Page Loader
async function loadTrending() {
  const container = document.getElementById("trending-list");
  if (!container) return;

  try {
    const res = await fetch("/.netlify/functions/fetchFeeds");
    const posts = await res.json();

    // Count keywords
    let keywordCount = {};
    posts.forEach(p => {
      let words = (p.title + " " + (p.contentSnippet || "")).toLowerCase().split(/\W+/);
      words.forEach(w => {
        if (w.length > 3) keywordCount[w] = (keywordCount[w] || 0) + 1;
      });
    });

    // Pick top keywords
    let trendingKeywords = Object.entries(keywordCount)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 10)
      .map(k => k[0]);

    container.innerHTML = posts
      .filter(p => trendingKeywords.some(k => p.title.toLowerCase().includes(k)))
      .slice(0, 12)
      .map(p => `
        <div class="card">
          <h3>🔥 ${p.title}</h3>
          <p>${p.contentSnippet || ""}</p>
          <a href="${p.link}" target="_blank">Read more →</a>
        </div>
      `).join("");
  } catch (err) {
    container.innerHTML = `<p>⚠️ Failed to load trending news</p>`;
  }
}
loadTrending();
