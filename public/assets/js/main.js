// ✅ Live Date/Time
function updateDateTime() {
  try {
    const el = document.getElementById("dateTime");
    if (!el) return;
    el.textContent = "🕒 " + new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch(e){ console.warn("DateTime error", e); }
}
setInterval(updateDateTime, 60000);
updateDateTime();

// ✅ Theme toggle
try {
  const themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      try {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("jp-theme", next);
      } catch(e){ console.warn("Theme toggle error", e); }
    });
  }
  const savedTheme = localStorage.getItem("jp-theme");
  if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);
} catch(e){ console.warn("Theme init error", e); }

// ✅ Saved posts badge
try {
  const saved = JSON.parse(localStorage.getItem("jp-saved") || "[]");
  const sc = document.getElementById("savedCount");
  if (sc) sc.textContent = saved.length;
} catch(e){ console.warn("Saved posts error", e); }

// ✅ Weather (user location or Kolkata fallback)
async function loadWeather() {
  const box = document.getElementById("wx");
  if (!box) return;
  try {
    let lat = 22.5726, lon = 88.3639; // Kolkata default
    if (navigator.geolocation) {
      await new Promise((res)=>navigator.geolocation.getCurrentPosition(
        pos => { lat=pos.coords.latitude; lon=pos.coords.longitude; res(); },
        () => res() // fallback silently
      ));
    }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const j = await r.json();
    const w = j.current_weather;
    box.textContent = `${w.temperature}°C`;
  } catch(e) {
    console.warn("Weather error", e);
    box.textContent = "Weather unavailable";
  }
}
loadWeather();

// ✅ Daily Motivation
async function loadQuote() {
  const el = document.getElementById("quoteBox");
  if (!el) return;
  try {
    const r = await fetch("https://api.quotable.io/random?tags=motivational|inspirational");
    if (!r.ok) throw new Error("Quote fetch failed");
    const q = await r.json();
    el.textContent = `"${q.content}" — ${q.author}`;
  } catch(e) {
    console.warn("Quote error", e);
    el.textContent = "Stay positive and keep going!";
  }
}
loadQuote();

// ✅ Poll of the Day
try {
  const pollBox = document.getElementById("pollBox");
  if (pollBox) {
    pollBox.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        try {
          localStorage.setItem("jp-poll", btn.dataset.opt);
          document.getElementById("pollThanks").style.display="block";
        } catch(e){ console.warn("Poll save error", e); }
      });
    });
    if (localStorage.getItem("jp-poll"))
      document.getElementById("pollThanks").style.display="block";
  }
} catch(e){ console.warn("Poll error", e); }

// ✅ Live ticker (Notifications auto-scroll)
try {
  const ticker = document.getElementById("notify-ticker");
  if (ticker) {
    setInterval(()=>{
      try {
        if(ticker.firstChild) ticker.appendChild(ticker.firstChild);
      } catch(e){ console.warn("Ticker error", e); }
    }, 4000);
  }
} catch(e){ console.warn("Ticker setup error", e); }

// ✅ Fetch RSS Feeds
async function loadRSS() {
  try {
    const feeds = ["/api/rss"];
    const allItems = [];
    for (let f of feeds) {
      try {
        const r = await fetch(f);
        if (!r.ok) continue;
        const j = await r.json();
        allItems.push(...(j.items||[]));
      } catch(e){ console.warn("RSS fetch error", f, e); }
    }

    if (!allItems.length) return;

    // Deduplicate
    const seen = new Set();
    const items = allItems.filter(it => {
      if (seen.has(it.link)) return false;
      seen.add(it.link); return true;
    }).slice(0,50);

    // Top scroll
    try {
      const topScroll = document.getElementById("top-scroll");
      if (topScroll) {
        topScroll.innerHTML = "";
        items.slice(0,10).forEach(it=>{
          const a = document.createElement("a");
          a.href = `/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}&desc=${encodeURIComponent(it.contentSnippet||"")}&date=${encodeURIComponent(it.isoDate||"")}`;
          a.className="card";
          a.style.minWidth="220px";
          a.textContent = it.title;
          topScroll.appendChild(a);
        });
      }
    } catch(e){ console.warn("Top scroll error", e); }

    // Notifications
    try {
      const notices = document.getElementById("notices");
      if (notices) {
        notices.innerHTML="";
        items.slice(0,15).forEach(it=>{
          const a = document.createElement("a");
          a.href = `/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}&desc=${encodeURIComponent(it.contentSnippet||"")}&date=${encodeURIComponent(it.isoDate||"")}`;
          a.textContent = it.title;
          notices.appendChild(a);
        });
      }
    } catch(e){ console.warn("Notices error", e); }

    // Trending
    try {
      const trending = document.getElementById("trending");
      if (trending) {
        trending.innerHTML="";
        items.slice(0,10).forEach(it=>{
          const a = document.createElement("a");
          a.href = `/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}&desc=${encodeURIComponent(it.contentSnippet||"")}&date=${encodeURIComponent(it.isoDate||"")}`;
          a.className="card";
          a.style.minWidth="200px";
          a.textContent = it.title;
          trending.appendChild(a);
        });
      }
    } catch(e){ console.warn("Trending error", e); }

    // Live ticker
    try {
      const ticker = document.getElementById("notify-ticker");
      if (ticker) {
        ticker.innerHTML="";
        items.slice(0,20).forEach(it=>{
          const span = document.createElement("span");
          span.style.marginRight="30px";
          span.innerHTML = `<a href="/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}">${it.title}</a>`;
          ticker.appendChild(span);
        });
      }
    } catch(e){ console.warn("Ticker fill error", e); }

  } catch(e){ console.error("RSS load error", e); }
}
loadRSS();
