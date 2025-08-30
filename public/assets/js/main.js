// ✅ Live Date/Time
function updateDateTime() {
  const el = document.getElementById("dateTime");
  if (!el) return;
  el.textContent = "🕒 " + new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
setInterval(updateDateTime, 60000);
updateDateTime();

// ✅ Theme toggle
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("jp-theme", next);
  });
}
const savedTheme = localStorage.getItem("jp-theme");
if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

// ✅ Saved posts badge
try {
  const saved = JSON.parse(localStorage.getItem("jp-saved") || "[]");
  document.getElementById("savedCount").textContent = saved.length;
} catch {}

// ✅ Weather (user location or Kolkata fallback)
async function loadWeather() {
  const box = document.getElementById("wx");
  if (!box) return;
  try {
    let lat = 22.5726, lon = 88.3639; // Kolkata default
    if (navigator.geolocation) {
      await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(
        pos => { lat=pos.coords.latitude; lon=pos.coords.longitude; res(); },
        () => res()  // fallback silently
      ));
    }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const j = await r.json();
    const w = j.current_weather;
    box.textContent = `${w.temperature}°C, ${w.weathercode}`;
  } catch { box.textContent = "Unable to fetch weather"; }
}
loadWeather();

// ✅ Daily Motivation
async function loadQuote() {
  const el = document.getElementById("quoteBox");
  if (!el) return;
  try {
    const r = await fetch("https://api.quotable.io/random?tags=motivational|inspirational");
    const q = await r.json();
    el.textContent = `"${q.content}" — ${q.author}`;
  } catch { el.textContent = "Stay positive and keep going!"; }
}
loadQuote();

// ✅ Poll of the Day
const pollBox = document.getElementById("pollBox");
if (pollBox) {
  pollBox.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      localStorage.setItem("jp-poll", btn.dataset.opt);
      document.getElementById("pollThanks").style.display="block";
    });
  });
  if (localStorage.getItem("jp-poll"))
    document.getElementById("pollThanks").style.display="block";
}

// ✅ Live ticker (Notifications auto-scroll)
const ticker = document.getElementById("notify-ticker");
if (ticker) {
  setInterval(()=>{
    if(ticker.firstChild) ticker.appendChild(ticker.firstChild); // move first to end
  }, 4000);
}

// ✅ Fetch RSS Feeds
async function loadRSS() {
  const feeds = [
    "/api/rss" // your Netlify/Vercel function proxying multiple feeds
  ];
  const allItems = [];
  for (let f of feeds) {
    try {
      const r = await fetch(f);
      if (!r.ok) continue;
      const j = await r.json();
      allItems.push(...(j.items||[]));
    } catch(e){ console.error("RSS error",e); }
  }

  if (!allItems.length) return;

  // Deduplicate by link
  const seen = new Set();
  const items = allItems.filter(it => {
    if (seen.has(it.link)) return false;
    seen.add(it.link); return true;
  }).slice(0,50);

  // Top scroll
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

  // Notifications (list)
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

  // Trending
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

  // Live ticker
  if (ticker) {
    ticker.innerHTML="";
    items.slice(0,20).forEach(it=>{
      const span = document.createElement("span");
      span.style.marginRight="30px";
      span.innerHTML = `<a href="/pages/post.html?title=${encodeURIComponent(it.title)}&link=${encodeURIComponent(it.link)}">${it.title}</a>`;
      ticker.appendChild(span);
    });
  }
}
loadRSS();
