function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function formatDate(d){ return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : ""; }
function createCard(item){
  return `<article class="card">
    <img src="${item.thumbnail}" alt="${safe(item.title)}" class="thumb"/>
    <div class="content">
      <h3><a href="post.html?id=${encodeURIComponent(item.id)}&from=${item.category==='Job'?'jobs':'news'}">${safe(item.title)}</a></h3>
      <p class="desc">${safe((item.description||"").slice(0,140))}...</p>
      <div class="meta"><span>${formatDate(item.pubDate)}</span><span class="src">${safe(item.source)}</span></div>
    </div>
  </article>`;
}
async function loadAll(){ const r=await fetch("/.netlify/functions/jobful"); if(!r.ok) throw new Error("backend"); return r.json(); }
async function loadWBJobsOnly(){ const r=await fetch("/.netlify/functions/jobful?type=jobs&onlyWB=1"); if(!r.ok) throw new Error("backend jobs"); const j=await r.json(); return j.jobs||[]; }
function renderList(id, arr, limit=0){
  const el = document.getElementById(id); if(!el) return;
  const list = (limit ? (arr||[]).slice(0,limit) : (arr||[]));
  el.innerHTML = list.length ? list.map(createCard).join("") : `<p class="muted">No posts available</p>`;
}
function mountAutoScroll(elId, items, from="home"){
  const el = document.getElementById(elId);
  if(!el) return;
  const list = (items || []).slice(0, 12);
  if (!list.length){ el.innerHTML = "<ul><li>No updates</li></ul>"; return; }
  el.innerHTML = `<ul>${[...list, ...list].map(p=>`<li><a href="post.html?id=${encodeURIComponent(p.id)}&from=${from}">${safe(p.title)}</a></li>`).join("")}</ul>`;
}
(async function init(){
  // Theme
  const htmlEl=document.documentElement,btn=document.getElementById('themeToggle');
  if (btn){
    const saved=localStorage.getItem('theme')||'light'; htmlEl.setAttribute('data-theme',saved);
    btn.textContent=saved==='dark'?'☀️ Light':'🌙 Dark';
    btn.onclick=()=>{const next=htmlEl.getAttribute('data-theme')==='dark'?'light':'dark'; htmlEl.setAttribute('data-theme',next); localStorage.setItem('theme',next); btn.textContent=next==='dark'?'☀️ Light':'🌙 Dark';};
  }

  const homeJobs  = document.getElementById("home-latest-jobs");
  const homeNews  = document.getElementById("home-latest-news");
  const homeExams = document.getElementById("home-latest-exams");
  const allJobs   = document.getElementById("all-jobs");
  const allNews   = document.getElementById("all-news");
  const allExams  = document.getElementById("all-exams");
  const trending  = document.getElementById("trendingList");
  const notifBar  = document.getElementById("notifications-scroll");
  const postBody  = document.getElementById("postBody");

  try{
    const all = await loadAll();
    const wbJobs = await loadWBJobsOnly();

    if (homeJobs) renderList("home-latest-jobs", wbJobs, 6);
    if (homeNews) renderList("home-latest-news", all.news, 6);
    if (homeExams)renderList("home-latest-exams", all.exams, 6);

    if (allJobs)  renderList("all-jobs", wbJobs);
    if (allNews)  renderList("all-news", all.news);
    if (allExams) renderList("all-exams", all.exams);

    if (trending) renderList("trendingList", all.trending);

    // Sidebar auto-scroll panels
    mountAutoScroll("notificationsList", all.news, "news");
    mountAutoScroll("announcementsList", wbJobs, "jobs");
    const othersMix = [...(all.news||[]).slice(6,12), ...(wbJobs||[]).slice(6,12)];
    mountAutoScroll("othersList", othersMix, "home");

    // Top ticker
    if (notifBar){
      const heads = [...wbJobs.slice(0,8), ...(all.news||[]).slice(0,8)];
      notifBar.innerHTML = heads.map(h=>`<span>${safe(h.title)}</span>`).join(" • ");
      let x=0; setInterval(()=>{ x+=2; notifBar.scrollLeft = x; if(x>=notifBar.scrollWidth-notifBar.clientWidth){ x=0; }}, 50);
    }

    // Post page
    if (postBody){
      const params = new URLSearchParams(location.search); const id=params.get("id");
      const allPosts=[...wbJobs, ...all.news, ...all.exams];
      const hit = allPosts.find(p=>String(p.id)===String(id));
      function fill(p){
        if(!p) return;
        const badge=document.getElementById("postBadge");
        if (badge){ badge.textContent = p.category==="Job" ? "Job" : (p.category || "Post"); }
        document.getElementById("postTitle").textContent=p.title||"Untitled";
        document.getElementById("postMeta").textContent = `${formatDate(p.pubDate)} • ${p.source||""}`;
        document.getElementById("postImage").src = p.thumbnail || "assets/dummy-photo.svg";
        document.getElementById("postBody").innerHTML = p.description || "";
        const src=document.getElementById("postSource"); if(src) src.href=p.link||"#";
        const apply=document.getElementById("applyBtn"); if(apply) apply.href=p.link||"#";
      }
      if (hit) fill(hit);
    }
  }catch(e){
    console.warn("Load error:", e);
    ["home-latest-jobs","home-latest-news","home-latest-exams","all-jobs","all-news","all-exams","trendingList"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.innerHTML = `<p class="muted">No posts available</p>`;
    });
  }

  // Mobile nav toggle
  const navToggle=document.getElementById('navToggle'), mainNav=document.getElementById('mainNav');
  if(navToggle&&mainNav){ navToggle.addEventListener('click',()=>{const open=mainNav.classList.toggle('open'); navToggle.setAttribute('aria-expanded',open?'true':'false');});
    document.addEventListener('click',(e)=>{ if(!mainNav.contains(e.target)&&!navToggle.contains(e.target)) mainNav.classList.remove('open');}); }
})();
