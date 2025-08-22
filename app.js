/* Helpers */
function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function byDateDesc(a,b){ return new Date(b.pubDate||0) - new Date(a.pubDate||0); }

/* Theme + header init + visitor counter */
(function initFrame(){
  // Theme
  const tgl = ()=>{ const cur=document.documentElement.getAttribute("data-theme")||"light"; const next=cur==="light"?"dark":"light"; document.documentElement.setAttribute("data-theme",next); localStorage.setItem("theme",next); document.getElementById("modeToggle")&&(document.getElementById("modeToggle").textContent=next==="dark"?"☀️":"🌙"); };
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const mt=document.getElementById("modeToggle"); if(mt){ mt.textContent=saved==="dark"?"☀️":"🌙"; mt.onclick=tgl; }

  // Date/time
  const dt = document.getElementById("dateTime");
  function tick(){ const now=new Date(); dt && (dt.textContent = now.toLocaleString()); }
  tick(); setInterval(tick,1000);

  // Menu
  document.getElementById("menuToggle")?.addEventListener("click", ()=>{
    document.getElementById("mainNav")?.classList.toggle("hidden");
  });

  // Visitor (local)
  const key="jp_visitors_total"; let v=Number(localStorage.getItem(key)||"0"); v+=1; localStorage.setItem(key,String(v));
  const vc=document.getElementById("visitorCount"); if(vc) vc.textContent=`👥 ${v} Visitors`;
})();

/* Back to top */
(function(){
  const btn=document.createElement("button");
  btn.style.cssText="position:fixed;right:16px;bottom:16px;width:44px;height:44px;border-radius:50%;background:#0077ff;color:#fff;border:none;display:none;z-index:1200;cursor:pointer";
  btn.textContent="↑"; document.body.appendChild(btn);
  window.addEventListener("scroll",()=>{ btn.style.display = window.scrollY>300?"block":"none"; },{passive:true});
  btn.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});
})();

/* Data fetchers (Netlify function) */
async function fetchCombined(){ const r=await fetch("/.netlify/functions/jobful"); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
async function fetchNewsOnly(){ const r=await fetch("/.netlify/functions/jobful?type=news"); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }
async function fetchExamsOnly(){ const r=await fetch("/.netlify/functions/jobful?type=exams"); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }

/* Cache */
function saveCache(data){ localStorage.setItem("cachedPosts", JSON.stringify({ data, savedAt: Date.now() })); }
function loadCache(){ try{ const c=JSON.parse(localStorage.getItem("cachedPosts")); if(!c) return null; if(Date.now()-c.savedAt>15*60*1000) return null; return c.data; }catch{return null;} }
async function getCombinedWithCache(){ const local=loadCache(); if(local) return local; try{ const data=await fetchCombined(); saveCache(data); return data; } catch{ const stale=JSON.parse(localStorage.getItem("cachedPosts")||"null"); return stale?.data || {jobs:[],news:[],exams:[]}; } }

/* Classification */
const GOVT_KEYS=/govt|government|wbpsc|railway|ssc|upsc|police|bank|municipal|psu|wbpdcl|kolkata police|sarkari/i;
const LOCATIONS=["Kolkata","Howrah","Siliguri","Asansol","Durgapur","Haldia","Kharagpur","Burdwan","Jalpaiguri","Malda","Bankura","Purulia"];
const WFH_KEYS=/\b(remote|work\s*from\s*home|wfh|telecommute|anywhere|work\s*from\s*anywhere)\b/i;
function detectType(title,src,cat){ const t=(title||"")+" "+(src||"")+" "+(cat||""); return GOVT_KEYS.test(t)?"govt":"private"; }
function detectLoc(title,desc){ const hay=(title||"")+" "+(desc||""); for(const L of LOCATIONS){ if(new RegExp(`\\b${L}\\b`,"i").test(hay)) return L; } return ""; }
function enrich(p){ const kind=detectType(p.title,p.source,p.category); const location=detectLoc(p.title,p.description); const wfh=WFH_KEYS.test(((p.title||"")+" "+(p.description||"")+" "+(p.source||"")).toLowerCase()); return {...p,kind,location,wfh}; }

/* Render helpers */
function cardHTML(post, fromPage){
  const isNew = post.pubDate && (Date.now()-new Date(post.pubDate).getTime())/36e5 < 24;
  const badge = post.kind==="govt" ? '<span class="badge govt">Govt</span>' : '<span class="badge private">Private</span>';
  const catName = post.source || post.category || "General";
  return `<div class="card"><a href="post.html?id=${encodeURIComponent(post.id)}&from=${fromPage}">
    <img src="${safe(post.thumbnail||'dummy-photo.svg')}" alt="${safe(post.title)}">
    <h3>${badge}${safe(post.title)} ${isNew?'<span class="new-badge">NEW</span>':''}</h3>
    <p>${safe((post.description||"").slice(0,140))}...</p></a>
    <div class="meta-line">
      <span class="cat-pill"><span class="cat-dot ${post.kind==='govt'?'cat-govt':'cat-private'}"></span>${safe(catName)}</span>
      ${post.location ? `<span class="cat-pill">${safe(post.location)}</span>` : ``}
      ${post.wfh ? `<span class="cat-pill">🏠 Work From Home</span>` : ``}
    </div></div>`;
}
function renderCards(sel, items, fromPage){ const el=document.querySelector(sel); if(!el) return; el.innerHTML=items.map(p=>cardHTML(p,fromPage)).join(""); }
function fillScrollableList(id, arr, from){ const el=document.getElementById(id); if(!el) return; el.innerHTML=`<ul>${arr.map(p=>`<li><a href="post.html?id=${encodeURIComponent(p.id)}&from=${from}">${safe(p.title)}</a></li>`).join("")}</ul>`; }

/* Categories & Interests */
function collectCategories(posts){
  const map = new Map(); let wfhCount=0;
  posts.forEach(p=>{
    const key=(p.source||p.category||"General").trim();
    if(key){ const kind=p.kind||"private"; if(!map.has(key)) map.set(key,{key,kind,count:0}); map.get(key).count+=1; }
    if(p.wfh) wfhCount++;
  });
  if(wfhCount>0) map.set("Work From Home",{key:"Work From Home",kind:"private",count:wfhCount});
  return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,24);
}
function renderCategoryPills(sel,cats,onClick){
  const el=document.querySelector(sel); if(!el) return;
  el.innerHTML=cats.map(c=>`<button class="cat-pill" data-cat="${safe(c.key)}"><span class="cat-dot ${c.kind==='govt'?'cat-govt':'cat-private'}"></span>${safe(c.key)} <span style="opacity:.7">(${c.count})</span></button>`).join("");
  el.querySelectorAll(".cat-pill").forEach(btn=>btn.addEventListener("click",()=>{ const cat=btn.getAttribute("data-cat"); addInterest(cat); renderInterestBar(); renderInterestFeed(); onClick?.(cat); }));
}
const INTEREST_KEY="jp_interests";
function getInterests(){ try{ const arr=JSON.parse(localStorage.getItem(INTEREST_KEY)||"[]"); return Array.isArray(arr)?arr.slice(0,24):[]; }catch{return[];} }
function addInterest(cat){ if(!cat) return; const cur=new Set(getInterests()); cur.add(cat); localStorage.setItem(INTEREST_KEY, JSON.stringify([...cur])); }
function removeInterest(cat){ const cur=new Set(getInterests()); cur.delete(cat); localStorage.setItem(INTEREST_KEY, JSON.stringify([...cur])); }
function renderInterestBar(){
  const cats=getInterests(); const bar=document.getElementById("interestBar"); const hint=document.getElementById("interestHint"); if(!bar) return;
  if(!cats.length){ bar.innerHTML='<span class="cat-pill"><span class="cat-dot cat-private"></span>No interests yet</span>'; hint&&(hint.style.display="block"); const btn=document.querySelector('.load-more[data-more="interestFeed"]'); if(btn) btn.style.display="none"; document.getElementById("interestFeed").innerHTML=""; return; }
  hint&&(hint.style.display="none");
  bar.innerHTML=cats.map(c=>`<button class="cat-pill" data-cat="${safe(c)}" title="Remove"><span class="cat-dot cat-private"></span>${safe(c)} ✕</button>`).join("");
  bar.querySelectorAll(".cat-pill").forEach(btn=>btn.addEventListener("click",()=>{ removeInterest(btn.getAttribute("data-cat")); renderInterestBar(); renderInterestFeed(); }));
}

/* Paginator */
const PAGER={};
function mountPager(gridId, data, size, from){ PAGER[gridId]={data:[...data],page:0,size,from}; paintPage(gridId); }
function paintPage(gridId){ const st=PAGER[gridId]; if(!st) return; const end=Math.min((st.page+1)*st.size, st.data.length); const slice=st.data.slice(0,end); renderCards(`#${gridId}`, slice, st.from); const btn=document.querySelector(`.load-more[data-more="${gridId}"]`); if(btn) btn.style.display = end>=st.data.length ? "none" : "block"; }
function hookLoadMoreButtons(){ document.querySelectorAll(".load-more").forEach(btn=>btn.addEventListener("click",()=>{ const id=btn.getAttribute("data-more"); if(PAGER[id]){ PAGER[id].page+=1; paintPage(id); } })); }

/* ScrollSpy */
function setupScrollSpy(ids){
  const pills=[...document.querySelectorAll(".subtabs .pill")];
  if(!pills.length) return; const map=new Map(); pills.forEach(a=>{const id=(a.getAttribute("href")||"").replace(/^#/,""); if(id) map.set(id,a);});
  const targets=ids.map(id=>document.getElementById(id)).filter(Boolean); if(!targets.length) return;
  const headerH=56+12;
  function setActive(id,fromScroll=false){ pills.forEach(p=>p.classList.remove("active")); const el=map.get(id); if(el) el.classList.add("active"); const hash=`#${id}`; if(fromScroll){ if(location.hash!==hash) history.replaceState(null,"",hash);} else { if(location.hash!==hash) history.pushState(null,"",hash);} }
  let ticking=false;
  function onScroll(){ if(ticking) return; ticking=true; requestAnimationFrame(()=>{ let currentId=targets[0].id, bestDist=Infinity; for(const t of targets){ const rect=t.getBoundingClientRect(); const dist=Math.abs(rect.top-headerH); if((rect.top-headerH)<=80 && dist<bestDist){ bestDist=dist; currentId=t.id; } } setActive(currentId,true); ticking=false; }); }
  function scrollToId(id){ const el=document.getElementById(id); if(!el) return; const y=el.getBoundingClientRect().top + window.scrollY - headerH; window.scrollTo({top:y,behavior:"smooth"}); }
  pills.forEach(p=>p.addEventListener("click",(e)=>{ const id=(p.getAttribute("href")||"").replace(/^#/,""); if(!id) return; e.preventDefault(); setActive(id,false); scrollToId(id); }));
  onScroll(); window.addEventListener("scroll",onScroll,{passive:true});
  if(location.hash){ const id=location.hash.replace(/^#/,""); if(map.has(id)) setTimeout(()=>{ const y=document.getElementById(id).getBoundingClientRect().top + window.scrollY - headerH; window.scrollTo({top:y,behavior:"auto"}); },50); }
}

/* State */
let ALL_POSTS=[], JOBS=[], NEWS=[], EXAMS=[];

/* Pages */
function initHome(){
  fillScrollableList("notificationsList", NEWS.slice(0,12), "news");
  fillScrollableList("announcementsList", JOBS.slice(0,12), "jobs");
  const others=[...NEWS.slice(12,18), ...JOBS.slice(12,18)].sort(byDateDesc);
  fillScrollableList("othersList", others, "home");

  const cats=collectCategories(ALL_POSTS);
  renderCategoryPills("#homeCategories", cats, (cat)=>{
    const f=ALL_POSTS.filter(p=>(p.source||p.category||"").includes(cat));
    renderCards("#latestPosts", f.filter(p=>p.category==="Job").slice(0,6), "jobs");
    renderCards("#latestNews", f.filter(p=>p.category==="News").slice(0,6), "news");
  });

  mountPager("latestPosts", JOBS, 6, "jobs");
  mountPager("latestNews", NEWS, 6, "news");
  mountPager("govtJobs", JOBS.filter(j=>j.kind==="govt"), 6, "jobs");
  mountPager("privateJobs", JOBS.filter(j=>j.kind==="private"), 6, "jobs");
  mountPager("homeWFH", JOBS.filter(p=>p.wfh).length?JOBS.filter(p=>p.wfh):JOBS, 6, "jobs");
  mountPager("homeLocKolkata", JOBS.filter(p=>p.location==="Kolkata"), 6, "jobs");
  mountPager("homeLocHowrah", JOBS.filter(p=>p.location==="Howrah"), 6, "jobs");
  hookLoadMoreButtons();

  renderInterestBar(); renderInterestFeed();

  setupScrollSpy(["home-latest-jobs","home-latest-news","home-govt","home-private","home-wfh","home-location","home-interests"]);

  document.getElementById("homeSearch")?.addEventListener("input",(e)=>{
    const q=e.target.value.toLowerCase();
    const filtered=ALL_POSTS.filter(p=>(p.title||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q));
    renderCards("#latestPosts", filtered.filter(p=>p.category==="Job").slice(0,6), "home");
  });
}

function initJobs(){
  const qEl=document.getElementById("jobSearch"), typeEl=document.getElementById("jobTypeFilter"), locEl=document.getElementById("locationFilter"), eduEl=document.getElementById("educationFilter"), wfhEl=document.getElementById("wfhOnly");
  const tabs=document.getElementById("jobTabs");
  function apply(){
    let arr=[...JOBS];
    const q=(qEl?.value||"").toLowerCase().trim(); const typ=(typeEl?.value||"").toLowerCase(); const loc=(locEl?.value||""); const edu=(eduEl?.value||"").toLowerCase();
    const curTab=document.querySelector(".tab.active")?.getAttribute("data-tab")||"all";
    if(curTab==="govt") arr=arr.filter(p=>p.kind==="govt");
    if(curTab==="private") arr=arr.filter(p=>p.kind==="private");
    if(curTab==="wfh") arr=arr.filter(p=>p.wfh);
    if(typ) arr=arr.filter(p=>p.kind===typ);
    if(loc) arr=arr.filter(p=>p.location===loc);
    if(edu) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(edu)||(p.description||"").toLowerCase().includes(edu));
    if(q) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q));
    if(wfhEl?.checked) arr=arr.filter(p=>p.wfh);
    PAGER["jobsList"]={data:arr,page:0,size:12,from:"jobs"}; paintPage("jobsList");
  }
  document.getElementById("jobTabs")?.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{ document.getElementById("jobTabs").querySelectorAll(".tab").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); apply(); }));
  mountPager("jobsList", JOBS, 12, "jobs"); hookLoadMoreButtons(); apply();
}

async function initNews(){
  NEWS=(await fetchNewsOnly())||[]; NEWS=NEWS.map(enrich).sort(byDateDesc);
  mountPager("newsList", NEWS, 12, "news"); hookLoadMoreButtons();
  const qEl=document.getElementById("newsSearch");
  function apply(){ let arr=[...NEWS]; const q=(qEl?.value||"").toLowerCase().trim(); if(q) arr=arr.filter(p=>(p.title||"").toLowerCase().includes(q)||(p.description||"").toLowerCase().includes(q)); PAGER["newsList"]={data:arr,page:0,size:12,from:"news"}; paintPage("newsList"); }
  qEl?.addEventListener("input",apply); apply();
}

async function initBreaking(){
  NEWS=(await fetchNewsOnly())||[]; NEWS=NEWS.map(enrich).sort(byDateDesc);
  mountPager("breakingList", NEWS, 12, "news"); hookLoadMoreButtons();
}

async function initExams(){
  EXAMS=(await fetchExamsOnly())||[]; EXAMS=EXAMS.map(enrich).sort(byDateDesc);
  mountPager("examsList", EXAMS, 12, "news"); hookLoadMoreButtons();
}

function initPost(){
  const params=new URLSearchParams(location.search); const id=params.get("id"); const from=params.get("from")||"home";
  function paint(post){
    if(!post) return;
    const badge=document.getElementById("postBadge");
    badge.classList.remove("govt","private"); badge.classList.add(post.kind==="govt"?"govt":"private"); badge.textContent=post.kind==="govt"?"Govt":"Private";
    document.getElementById("postTitle").textContent=post.title||"Untitled";
    document.getElementById("postMeta").textContent=`Published: ${post.pubDate?new Date(post.pubDate).toLocaleString():"N/A"} • Source: ${post.source||""}${post.location?` • ${post.location}`:""}`;
    document.getElementById("postImage").src=post.thumbnail||"dummy-photo.svg";
    document.getElementById("postBody").innerHTML=post.description||"No description available.";
    document.getElementById("postSource").href=post.link||"#";
    document.getElementById("applyBtn").href=post.link||"#";
    const back=document.getElementById("backBtn");
    back.href = from==="jobs"?"jobs.html" : from==="news"?"news.html" : from==="breaking"?"breaking.html" : from==="exams"?"exams.html" : "index.html";
    back.textContent = back.href.includes("index") ? "⬅ Back to Home" : "⬅ Back";
  }
  let cached=[]; try{cached=JSON.parse(sessionStorage.getItem("allPosts")||"[]");}catch{}
  if(cached.length) paint(cached.find(p=>p.id===id));
  fetch("/.netlify/functions/jobful").then(r=>r.json()).then(data=>{
    const all=[...(data.jobs||[]),...(data.news||[]),...(data.exams||[])].map(enrich).sort(byDateDesc);
    sessionStorage.setItem("allPosts", JSON.stringify(all));
    paint(all.find(p=>p.id===id));
  }).catch(()=>{});
}

/* Interests feed */
function renderInterestFeed(){
  const cats=getInterests(); const el=document.getElementById("interestFeed"); if(!el) return;
  if(!cats.length){ el.innerHTML=""; const btn=document.querySelector('.load-more[data-more="interestFeed"]'); if(btn) btn.style.display="none"; return; }
  const matches=ALL_POSTS.filter(p=>cats.some(c=>(p.source||p.category||"").includes(c)));
  mountPager("interestFeed", matches, 6, "home"); hookLoadMoreButtons();
}

/* Boot */
(async function boot(){
  const isHome = document.getElementById("latestPosts") || document.getElementById("homeCategories");
  const isJobs = document.getElementById("jobsList");
  const isNews = document.getElementById("newsList");
  const isBreaking = document.getElementById("breakingList");
  const isExams = document.getElementById("examsList");
  const isPost = document.getElementById("postBody");

  if (isHome || isJobs){
    const data = await getCombinedWithCache();
    JOBS=(data.jobs||[]).map(enrich).sort(byDateDesc);
    NEWS=(data.news||[]).map(enrich).sort(byDateDesc);
    EXAMS=(data.exams||[]).map(enrich).sort(byDateDesc);
    ALL_POSTS=[...JOBS,...NEWS,...EXAMS].sort(byDateDesc);
    sessionStorage.setItem("allPosts", JSON.stringify(ALL_POSTS));
  }

  if(isHome) initHome();
  if(isJobs) initJobs();
  if(isNews) await initNews();
  if(isBreaking) await initBreaking();
  if(isExams) await initExams();
  if(isPost) initPost();
})();
