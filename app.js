/* ========= Helpers ========= */
function safe(s) {
  return s ? String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function createCard(item) {
  return `
    <article class="card">
      <img src="${item.thumbnail}" alt="Image for ${safe(item.title)}" class="thumb"/>
      <div class="content">
        <h3><a href="${item.link}" target="_blank" rel="noopener noreferrer">${safe(item.title)}</a></h3>
        <p class="desc">${safe(item.description?.slice(0, 140))}...</p>
        <div class="meta">
          <span>${formatDate(item.pubDate)}</span>
          <span class="src">${safe(item.source)}</span>
        </div>
      </div>
    </article>
  `;
}

/* ========= Fetch from backend ========= */
async function loadData() {
  try {
    const res = await fetch("/.netlify/functions/jobful");
    if (!res.ok) throw new Error("Backend error");
    return await res.json();
  } catch (err) {
    console.error("Failed to load data", err);
    return { jobs: [], news: [], exams: [] };
  }
}

/* ========= Render ========= */
function renderSection(containerId, items, limit = 0) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<p class="muted">No posts available</p>`;
    return;
  }
  const sliced = limit ? items.slice(0, limit) : items;
  el.innerHTML = sliced.map(createCard).join("");
}

/* ========= Init ========= */
(async function init() {
  const data = await loadData();

  // Homepage → latest 6 from each
  renderSection("home-latest-jobs", data.jobs, 6);
  renderSection("home-latest-news", data.news, 6);
  renderSection("home-latest-exams", data.exams, 6);

  // Dedicated pages → show all
  renderSection("all-jobs", data.jobs);
  renderSection("all-news", data.news);
  renderSection("all-exams", data.exams);

  // Notifications auto-scroll → top bar
  const notifBar = document.getElementById("notifications-scroll");
  if (notifBar) {
    let headlines = [...data.jobs, ...data.news, ...data.exams].slice(0, 15);
    notifBar.innerHTML = headlines.map(i => `<span>${safe(i.title)}</span>`).join(" • ");

    // Auto-scroll effect
    let scrollPos = 0;
    setInterval(() => {
      scrollPos += 2;
      notifBar.scrollLeft = scrollPos;
      if (scrollPos >= notifBar.scrollWidth - notifBar.clientWidth) {
        scrollPos = 0;
      }
    }, 50);
  }
})();
