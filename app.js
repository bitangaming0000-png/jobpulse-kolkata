/* ================================
   Utilities
================================== */
function safe(str) {
  return str ? String(str).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

function byDateDesc(a, b) {
  const da = new Date(a.pubDate || 0);
  const db = new Date(b.pubDate || 0);
  return db - da;
}

/* ================================
   Theme (Dark / Light) – persistent
================================== */
(function initTheme() {
  const toggle = document.getElementById("modeToggle");
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  if (toggle) toggle.textContent = saved === "dark" ? "☀️" : "🌙";

  toggle?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    if (toggle) toggle.textContent = next === "dark" ? "☀️" : "🌙";
  });
})();

/* ================================
   Global State
================================== */
let ALL_POSTS = [];
let JOBS = [];
let NEWS = [];

/* ================================
   Rendering helpers
================================== */
function cardHTML(post, fromPage) {
  const isNew =
    post.pubDate &&
    (Date.now() - new Date(post.pubDate).getTime()) / (1000 * 60 * 60) < 24;

  return `
    <div class="card">
      <a href="post.html?id=${encodeURIComponent(post.id)}&from=${fromPage}">
        <img src="${safe(post.thumbnail || "dummy-photo.svg")}" alt="${safe(
    post.title
  )}">
        <h3>${safe(post.title)} ${isNew ? '<span class="new-badge">NEW</span>' : ""}</h3>
        <p>${safe((post.description || "").slice(0, 120))}...</p>
      </a>
      ${
        fromPage === "jobs"
          ? `<button class="save-btn" onclick="toggleSave('${safe(
              post.id
            )}','${safe(post.title)}','${safe(
              post.thumbnail || "dummy-photo.svg"
            )}')">⭐ Save</button>`
          : ""
      }
    </div>
  `;
}

function renderCards(selector, items, fromPage) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = items.map((p) => cardHTML(p, fromPage)).join("");
}

function fillList(selector, items, fromTag) {
  const el = document.getElementById(selector);
  if (!el) return;
  el.innerHTML = items
    .map(
      (p) =>
        `<li><a href="post.html?id=${encodeURIComponent(
          p.id
        )}&from=${fromTag}">${safe(p.title)}</a></li>`
    )
    .join("");
}

/* ================================
   Saved Jobs (localStorage)
================================== */
function getSavedJobs() {
  return JSON.parse(localStorage.getItem("savedJobs") || "[]");
}
function toggleSave(id, title, thumbnail) {
  let saved = getSavedJobs();
  const exists = saved.find((j) => j.id === id);
  if (exists) saved = saved.filter((j) => j.id !== id);
  else saved.push({ id, title, thumbnail, savedAt: new Date().toISOString() });
  localStorage.setItem("savedJobs", JSON.stringify(saved));
  alert(exists ? "Removed from Saved Jobs" : "Saved!");
}
window.toggleSave = toggleSave; // make available to inline onclicks

/* ================================
   Sidebar (Notifications / Announcements / Others)
   – used on Home, Jobs, News pages
================================== */
function populateSidebar() {
  // Notifications → latest NEWS titles
  fillList(
    "notificationsList",
    NEWS.slice(0, 12),
    "news"
  );

  // Latest Announcements → latest JOB titles
  fillList(
    "announcementsList",
    JOBS.slice(0, 12),
    "jobs"
  );

  // Others → mixed remaining posts
  const mixed = [...JOBS.slice(12, 18), ...NEWS.slice(12, 18)].sort(byDateDesc);
  fillList("othersList", mixed, "home");
}

/* ================================
   Breaking Banner (Home + News + Breaking)
================================== */
function renderBreakingBanner() {
  const bannerContainer = document.getElementById("breakingBanner");
  if (!bannerContainer) return; // not on this page

  const breaking =
    NEWS.find((n) =>
      /urgent|breaking|important|alert|announcement/i.test(n.title || "")
    ) || NEWS[0];

  if (breaking) {
    bannerContainer.innerHTML = `🚨 <a href="post.html?id=${encodeURIComponent(
      breaking.id
    )}&from=news">${safe(breaking.title)}</a>`;
  }
}

/* ================================
   Page initializers
================================== */
function initHome() {
  // New Updates → latest mix (6)
  const latestMix = ALL_POSTS.slice(0, 6);
  renderCards("#latestPosts", latestMix, "home");

  // Jobs by Education → just show latest jobs (6) for now
  renderCards("#educationJobs", JOBS.slice(0, 6), "jobs");

  // Job Notifications → next set of jobs (6)
  renderCards("#jobNotifications", JOBS.slice(6, 12), "jobs");

  populateSidebar();
  renderBreakingBanner();
}

function initJobs() {
  // Basic filters (search + simple tabs)
  const listEl = "#jobsList";
  const searchInput = document.getElementById("jobSearch");
  const eduSelect = document.getElementById("educationFilter");
  const tabs = document.querySelectorAll("#jobTabs .tab");

  let currentCat = "";
  function apply() {
    let arr = [...JOBS];
    if (currentCat)
      arr = arr.filter((p) =>
        (p.category || "").toLowerCase().includes(currentCat.toLowerCase())
      );
    const edu = (eduSelect?.value || "").toLowerCase();
    if (edu) {
      arr = arr.filter((p) =>
        (p.title || "").toLowerCase().includes(edu)
      );
    }
    const q = (searchInput?.value || "").toLowerCase().trim();
    if (q) {
      arr = arr.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    renderCards(listEl, arr, "jobs");
  }

  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      currentCat = t.dataset.cat || "";
      apply();
    })
  );
  searchInput?.addEventListener("input", apply);
  eduSelect?.addEventListener("change", apply);

  renderCards(listEl, JOBS, "jobs");
  populateSidebar();
  renderBreakingBanner();
}

function initNews() {
  const listEl = "#newsList";
  const searchInput = document.getElementById("newsSearch");
  const tabs = document.querySelectorAll("#newsTabs .tab");

  let currentCat = "";
  function apply() {
    let arr = [...NEWS];
    if (currentCat)
      arr = arr.filter((p) =>
        (p.title || "").toLowerCase().includes(currentCat.toLowerCase())
      );
    const q = (searchInput?.value || "").toLowerCase().trim();
    if (q) {
      arr = arr.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    renderCards(listEl, arr, "news");
  }

  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      currentCat = t.dataset.cat || "";
      apply();
    })
  );
  searchInput?.addEventListener("input", apply);

  renderCards(listEl, NEWS, "news");
  populateSidebar();
  renderBreakingBanner();
}

function initPost() {
  // Prefer cached data first for instant load
  let cached = [];
  try {
    cached = JSON.parse(sessionStorage.getItem("allPosts") || "[]");
  } catch {}
  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  const paint = (data) => {
    const post = data.find((p) => p.id === id);
    if (!post) return;

    const titleEl = document.getElementById("postTitle");
    const metaEl = document.getElementById("postMeta");
    const imgEl = document.getElementById("postImage");
    const bodyEl = document.getElementById("postBody");
    const srcEl = document.getElementById("postSource");

    titleEl.textContent = post.title || "Untitled";
    metaEl.textContent = `Published: ${
      post.pubDate ? new Date(post.pubDate).toLocaleString() : "N/A"
    }  •  Source: ${post.source || ""}`;
    imgEl.src = post.thumbnail || "dummy-photo.svg";
    bodyEl.innerHTML = post.description || "No description available.";
    srcEl.href = post.link || "#";
  };

  if (cached.length) paint(cached);

  // Also refresh once from network (silently)
  fetch("/.netlify/functions/fetchFeeds")
    .then((r) => r.json())
    .then((data) => {
      const all = [...(data.jobs || []), ...(data.news || [])].sort(byDateDesc);
      sessionStorage.setItem("allPosts", JSON.stringify(all));
      if (!cached.length) paint(all); // if nothing was painted, paint now
    })
    .catch(() => {});
}

/* ================================
   Fetch data from Netlify Function
================================== */
async function loadAndInit() {
  try {
    const res = await fetch("/.netlify/functions/fetchFeeds");
    const data = await res.json();

    // Support both shapes:
    // 1) { jobs: [], news: [] }
    // 2) [mixed array]
    if (Array.isArray(data)) {
      ALL_POSTS = data.sort(byDateDesc);
      JOBS = ALL_POSTS.filter((p) => (p.category || "").toLowerCase() === "job");
      NEWS = ALL_POSTS.filter((p) => (p.category || "").toLowerCase() === "news");
    } else {
      JOBS = (data.jobs || []).sort(byDateDesc);
      NEWS = (data.news || []).sort(byDateDesc);
      ALL_POSTS = [...JOBS, ...NEWS].sort(byDateDesc);
    }

    // Cache for post page
    sessionStorage.setItem("allPosts", JSON.stringify(ALL_POSTS));

    const page = document.body.getAttribute("data-page") || "home";
    if (page === "home") initHome();
    if (page === "jobs") initJobs();
    if (page === "news") initNews();
    if (page === "breaking") {
      renderBreakingBanner();
      const breaking = NEWS.filter((n) =>
        /urgent|breaking|important|alert|announcement/i.test(n.title || "")
      );
      renderCards("#breakingList", breaking, "news");
    }
    if (page === "saved") {
      // Saved page is static; sidebar not required
      // (Cards rendered inline in saved.html)
      renderBreakingBanner();
    }
    if (page === "post") initPost();
  } catch (e) {
    console.error("Failed to load feeds:", e);
  }
}

loadAndInit();
