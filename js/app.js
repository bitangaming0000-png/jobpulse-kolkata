/* Utility */
function safe(str){ return (str||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])) }

/* === Breaking News Ticker === */
function makeBreakingHTML(list, from="news"){
  const items = list.map(p =>
    `<span class="breaking-item">
       <span class="badge-live" aria-hidden="true"></span>
       <a class="post-link" data-id="${safe(p.id)}" data-from="${safe(from)}"
          href="post.html?id=${encodeURIComponent(p.id)}&from=${encodeURIComponent(from)}">
          ${safe(p.title)}
       </a>
     </span>`
  ).join("");
  return `<div class="inner">${items}${items}</div>`;
}
function mountBreakingTicker(elId, items, from="news"){
  const el=document.getElementById(elId); if(!el) return;
  const list=(items||[]).slice(0,20);
  if(!list.length){
    el.innerHTML=`<div class="inner"><span class="breaking-item"><span class="badge-live"></span><span>Welcome to JobPulse Kolkata</span></span></div>`;
    return;
  }
  el.innerHTML=makeBreakingHTML(list,from);
}

/* Visitor count */
function incrementVisits(){
  let c=+localStorage.getItem("visits")||0;
  c++; localStorage.setItem("visits",c);
  document.querySelectorAll("#visitCount").forEach(x=>x.textContent=c);
}

/* Theme toggle */
function initTheme(){
  const btn=document.getElementById("themeToggle");
  const root=document.documentElement;
  let mode=localStorage.getItem("theme")||"light";
  root.dataset.theme=mode;
  btn.textContent=mode==="light"?"🌙 Dark":"☀️ Light";
  btn.onclick=()=>{
    mode=mode==="light"?"dark":"light";
    root.dataset.theme=mode;
    localStorage.setItem("theme",mode);
    btn.textContent=mode==="light"?"🌙 Dark":"☀️ Light";
  };
}

/* Mobile nav */
function initNav(){
  const btn=document.getElementById("navToggle");
  const nav=document.getElementById("mainNav");
  if(!btn||!nav) return;
  btn.onclick=()=>{
    const expanded=btn.getAttribute("aria-expanded")==="true";
    btn.setAttribute("aria-expanded",String(!expanded));
    nav.style.display=expanded?"none":"block";
  };
}

/* Placeholder fetch function (replace with real Netlify function) */
async function fetchFeeds(){ return {jobs:[],news:[],exams:[]} }

/* Render cards */
function createCard(item, from="jobs"){
  const img=item.image||"assets/dummy-photo.svg";
  return `<div class="card">
    <a href="post.html?id=${encodeURIComponent(item.id)}&from=${encodeURIComponent(from)}" class="post-link" data-id="${safe(item.id)}" data-from="${safe(from)}">
      <img src="${img}" alt="${safe(item.title)}" class="thumb" loading="lazy"/>
      <div class="card-body"><h3>${safe(item.title)}</h3><p>${safe(item.snippet||"")}</p></div>
    </a>
  </div>`;
}

/* Init */
(async function init(){
  initTheme(); initNav(); incrementVisits();

  const all=await fetchFeeds(); // {jobs, news, exams}

  // Breaking News
  mountBreakingTicker("breaking",(all.news||[]).slice(0,20),"news");

  // Render home
  if(document.getElementById("home-latest-jobs"))
    document.getElementById("home-latest-jobs").innerHTML=(all.jobs||[]).slice(0,6).map(x=>createCard(x,"jobs")).join("");
  if(document.getElementById("home-latest-news"))
    document.getElementById("home-latest-news").innerHTML=(all.news||[]).slice(0,6).map(x=>createCard(x,"news")).join("");
  if(document.getElementById("home-latest-exams"))
    document.getElementById("home-latest-exams").innerHTML=(all.exams||[]).slice(0,6).map(x=>createCard(x,"exams")).join("");

  // Jobs/News/Exams/Trending pages
  if(document.getElementById("all-jobs"))
    document.getElementById("all-jobs").innerHTML=(all.jobs||[]).map(x=>createCard(x,"jobs")).join("");
  if(document.getElementById("all-news"))
    document.getElementById("all-news").innerHTML=(all.news||[]).map(x=>createCard(x,"news")).join("");
  if(document.getElementById("all-exams"))
    document.getElementById("all-exams").innerHTML=(all.exams||[]).map(x=>createCard(x,"exams")).join("");
  if(document.getElementById("trendingList"))
    document.getElementById("trendingList").innerHTML=[...(all.jobs||[]).slice(0,5),...(all.news||[]).slice(0,5)]
      .map(x=>createCard(x,"jobs")).join("");

  // Post page handling
  const params=new URLSearchParams(location.search);
  const pid=params.get("id"); const from=params.get("from");
  if(pid&&document.getElementById("postTitle")){
    const item=[...(all.jobs||[]),...(all.news||[]),...(all.exams||[])].find(x=>x.id==pid);
    if(item){
      document.getElementById("postTitle").textContent=item.title;
      document.getElementById("postImage").src=item.image||"assets/dummy-photo.svg";
      document.getElementById("postBody").innerHTML=item.content||item.snippet||"";
      document.getElementById("postSource").href=item.link||"#";
      document.getElementById("applyBtn").href=item.link||"#";
    }
  }
})();
