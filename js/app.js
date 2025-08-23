/* ===== Utilities ===== */
function safe(str){ return (str||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])) }
function $(sel){ return document.querySelector(sel); }

/* ===== Built-in SAMPLE so cards show even if fetch fails ===== */
const SAMPLE = {
  jobs: [
    { id:"wb-govt-kmc-2025-01", title:"KMC Health Dept Recruitment – Staff Nurse (WB Govt)",
      description:"<p>Kolkata Municipal Corporation invites applications for Staff Nurse posts. Eligibility: GNM/B.Sc Nursing. Location: Kolkata. Last date: 30 Sep 2025.</p>",
      snippet:"KMC Staff Nurse openings in Kolkata. Apply by 30 Sep 2025.", link:"https://www.kmcgov.in/",
      source:"KMC", thumbnail:"https://placehold.co/600x360/0b1220/ffffff?text=KMC+Recruitment", pubDate:"2025-08-20T09:10:00+05:30" },
    { id:"wb-private-tcs-kolkata-2025-02", title:"TCS Kolkata – Associate Software Engineer (Freshers)",
      description:"<p>TCS Kolkata hiring fresh graduates. Skills: JavaScript/React preferred. Work location: Kolkata (hybrid). Immediate joining.</p>",
      snippet:"TCS hiring freshers in Kolkata. Hybrid. Apply now.", link:"https://www.tcs.com/careers",
      source:"TCS", thumbnail:"https://placehold.co/600x360/111827/60a5fa?text=TCS+Kolkata", pubDate:"2025-08-21T12:05:00+05:30" },
    { id:"wb-wfh-edtech-2025-03", title:"Work From Home – EdTech Support (Bengali + English)",
      description:"<p>WFH role for EdTech startup. Provide chat/email support to learners in Bengali & English. Flexible hours.</p>",
      snippet:"WFH support role for EdTech; Bengali+English.", link:"https://example.com/jobs/edtech-wfh",
      source:"EdTech", thumbnail:"https://placehold.co/600x360/0ea5e9/0b1220?text=WFH+Support", pubDate:"2025-08-22T10:00:00+05:30" }
  ],
  news: [
    { id:"news-wbpsc-2025-01", title:"WBPSC announces new schedule for 2025 exams",
      description:"<p>WBPSC released an updated calendar for state-level recruitment exams for 2025. Candidates should check the official site.</p>",
      snippet:"WBPSC updated exam calendar for 2025.", link:"https://wbpsc.gov.in/", source:"WBPSC",
      thumbnail:"https://placehold.co/600x360/0b1220/ffffff?text=WBPSC", pubDate:"2025-08-21T08:00:00+05:30" },
    { id:"news-railway-2025-02", title:"Eastern Railway apprentice notification expected soon",
      description:"<p>Eastern Railway is likely to release an apprentice notification for West Bengal divisions. Keep documents ready.</p>",
      snippet:"Eastern Railway apprenticeships expected soon.", link:"https://er.indianrailways.gov.in/",
      source:"Eastern Railway", thumbnail:"https://placehold.co/600x360/111827/0ea5e9?text=Railway+News", pubDate:"2025-08-20T15:30:00+05:30" }
  ],
  exams: [
    { id:"exam-wbpolice-2025-01", title:"West Bengal Police Constable Exam – Admit Cards released",
      description:"<p>WB Police has issued admit cards for Constable exam. Download from official portal.</p>",
      snippet:"WB Police Constable admit cards available.", link:"https://wbpolice.gov.in/",
      source:"WB Police", thumbnail:"https://placehold.co/600x360/111827/7c3aed?text=WB+Police+Exam", pubDate:"2025-08-19T10:00:00+05:30" }
  ]
};

/* ===== Breaking News Ticker ===== */
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
  el.innerHTML = list.length ? makeBreakingHTML(list,from)
    : `<div class="inner"><span class="breaking-item"><span class="badge-live"></span><span>Welcome to JobPulse Kolkata</span></span></div>`;
}

/* ===== Theme, Nav, Visits ===== */
function incrementVisits(){
  let c=+localStorage.getItem("visits")||0;
  c++; localStorage.setItem("visits",c);
  document.querySelectorAll("#visitCount").forEach(x=>x.textContent=c);
}
function initTheme(){
  const root=document.documentElement;
  const btn=$("#themeToggle");
  let mode=localStorage.getItem("theme");
  if(!mode){ mode=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"; }
  applyTheme(mode);
  if(btn){
    btn.onclick=()=>{ mode = (root.dataset.theme==="light")?"dark":"light"; applyTheme(mode); };
  }
  function applyTheme(m){
    root.dataset.theme=m;
    localStorage.setItem("theme",m);
    if(btn) btn.textContent = m==="light"?"🌙 Dark":"☀️ Light";
  }
}
function initNav(){
  const btn=$("#navToggle"), nav=$("#mainNav");
  if(!btn||!nav) return;
  btn.onclick=()=>{
    const expanded=btn.getAttribute("aria-expanded")==="true";
    btn.setAttribute("aria-expanded", String(!expanded));
    nav.style.display = expanded ? "none" : "block";
  };
}

/* ===== Data Loader: function → local /data → built-in SAMPLE ===== */
async function fetchJSON(url){
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}
async function fetchFeeds(){
  // 1) Netlify function (if present)
  try{ return await fetchJSON("/.netlify/functions/jobful"); }
  catch(e){ console.warn("Function failed:", e.message); }
  // 2) Local file (/data/sample.json)
  try{ return await fetchJSON("data/sample.json"); }
  catch(e){ console.warn("Local sample missing:", e.message); }
  // 3) Built-in SAMPLE constant
  console.warn("Using built-in SAMPLE data.");
  return JSON.parse(JSON.stringify(SAMPLE));
}

/* ===== Cards & Page Renderers ===== */
function createCard(item, from="jobs"){
  const img=item.thumbnail||item.image||"assets/dummy-photo.svg";
  const desc=item.snippet||item.description||"";
  return `<div class="card">
    <a href="post.html?id=${encodeURIComponent(item.id)}&from=${encodeURIComponent(from)}" class="post-link" data-id="${safe(item.id)}" data-from="${safe(from)}">
      <img src="${img}" alt="${safe(item.title)}" class="thumb" loading="lazy"/>
      <div class="card-body"><h3>${safe(item.title)}</h3><p>${desc}</p></div>
    </a>
  </div>`;
}

function renderList(containerId, items, from){
  const el=document.getElementById(containerId);
  if(!el) return;
  el.innerHTML = (items||[]).map(x=>createCard(x,from)).join("") || `<p style="color:var(--muted)">No items yet.</p>`;
}

/* ===== Init ===== */
(async function init(){
  try{
    initTheme(); initNav(); incrementVisits();

    const all = await fetchFeeds(); // {jobs,news,exams}

    // Breaking News (under header, present on every page we added #breaking)
    mountBreakingTicker("breaking", (all.news||[]).slice(0,20), "news");

    // Home sections
    renderList("home-latest-jobs", (all.jobs||[]).slice(0,6), "jobs");
    renderList("home-latest-news", (all.news||[]).slice(0,6), "news");
    renderList("home-latest-exams", (all.exams||[]).slice(0,6), "exams");

    // Listing pages
    renderList("all-jobs", all.jobs, "jobs");
    renderList("all-news", all.news, "news");
    renderList("all-exams", all.exams, "exams");
    renderList("trendingList", [ ...(all.jobs||[]).slice(0,5), ...(all.news||[]).slice(0,5) ], "jobs");

    // Post page
    const params=new URLSearchParams(location.search);
    const pid=params.get("id");
    if(pid && $("#postTitle")){
      const item=[...(all.jobs||[]),...(all.news||[]),...(all.exams||[])].find(x=>String(x.id)===String(pid));
      if(item){
        $("#postTitle").textContent=item.title;
        $("#postImage").src=item.thumbnail||item.image||"assets/dummy-photo.svg";
        $("#postBody").innerHTML=item.content||item.description||item.snippet||"";
        const src=$("#postSource"); if(src) src.href=item.link||"#";
        const apply=$("#applyBtn"); if(apply) apply.href=item.link||"#";
      }else{
        $("#postBody").innerHTML="<p>Post not found.</p>";
      }
    }
  }catch(err){
    console.error("Init error:", err);
  }
})();
