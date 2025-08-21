/* === Utility === */
function safe(str){ return str ? str.replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
function getSavedJobs(){ return JSON.parse(localStorage.getItem("savedJobs") || "[]"); }
function toggleSave(id, title, thumb){
  let saved = getSavedJobs();
  const exists = saved.find(j => j.id === id);
  if(exists){ saved = saved.filter(j => j.id !== id); }
  else { saved.push({id, title, thumbnail: thumb, savedAt: new Date()}); }
  localStorage.setItem("savedJobs", JSON.stringify(saved));
  alert(exists ? "Removed from Saved Jobs" : "Saved!");
}

/* === Global Data === */
let JOBS = [];
let NEWS = [];
let ALL_POSTS = [];

/* === Fetch RSS via Netlify Function === */
async function loadFeeds(){
  try {
    const res = await fetch("/.netlify/functions/fetchFeeds");
    const data = await res.json();
    JOBS = data.jobs || [];
    NEWS = data.news || [];
    ALL_POSTS = [...JOBS, ...NEWS];
    sessionStorage.setItem("allPosts", JSON.stringify(ALL_POSTS));
    initPage();
  } catch(e){
    console.error("Feed load error", e);
  }
}

/* === Page Init === */
function initPage(){
  const PAGE = document.body.dataset.page;

  /* Breaking Banner */
  if(PAGE === "home" || PAGE === "news" || PAGE === "breaking"){
    const breaking = NEWS.find(n =>
      /urgent|breaking|important|alert|announcement/i.test(n.title)
    ) || NEWS[0];
    if(breaking){
      const banner = document.getElementById("breakingText");
      if(banner){
        banner.innerHTML = `🚨 <a href="post.html?id=${breaking.id}">${safe(breaking.title)}</a>`;
      }
    }
  }

  /* Homepage */
  if(PAGE === "home"){
    renderLatest("#latestJobs", JOBS, 6);
    renderLatest("#latestNews", NEWS, 6);
    renderSidebar();
  }

  /* Jobs Page */
  if(PAGE === "jobs"){
    setupFilters(JOBS, "#jobList", "#loadMoreJobs");
  }

  /* News Page */
  if(PAGE === "news"){
    setupFilters(NEWS, "#newsList", "#loadMoreNews");
  }

  /* Breaking Page */
  if(PAGE === "breaking"){
    const list = NEWS.filter(n => /urgent|breaking|important|alert|announcement/i.test(n.title));
    renderCards("#breakingList", list);
  }
}

/* === Rendering Helpers === */
function renderLatest(container, arr, count){
  const slice = arr.slice(0,count);
  renderCards(container, slice);
}
function renderCards(container, items){
  const now = new Date();
  document.querySelector(container).innerHTML = items.map(i=>{
    let isNew = false;
    if(i.pubDate){
      let ageHrs = (now - new Date(i.pubDate)) / (1000*60*60);
      isNew = ageHrs < 24;
    }
    return `
      <div class="card">
        <a href="post.html?id=${i.id}">
          <img src="${i.thumbnail || 'dummy-photo.svg'}" alt="${safe(i.title)}">
          <h3>${safe(i.title)} ${isNew ? '<span class="new-badge">NEW</span>' : ''}</h3>
          <p>${safe(i.description || '').slice(0,80)}...</p>
        </a>
        ${document.body.dataset.page==="jobs" ? 
          `<button class="save-btn" onclick="toggleSave('${i.id}', '${safe(i.title)}', '${i.thumbnail || 'dummy-photo.svg'}')">⭐ Save</button>` : ""}
      </div>
    `;
  }).join('');
}

/* === Sidebar (Homepage) === */
function renderSidebar(){
  const notify = NEWS.slice(0,5).map(n=>`<li>${safe(n.title)}</li>`).join('');
  const announce = JOBS.slice(0,5).map(j=>`<li>${safe(j.title)}</li>`).join('');
  const other = ALL_POSTS.slice(5,10).map(p=>`<li>${safe(p.title)}</li>`).join('');
  document.getElementById("notificationsList").innerHTML = notify;
  document.getElementById("announcementsList").innerHTML = announce;
  document.getElementById("othersList").innerHTML = other;

  const trending = ALL_POSTS.slice(0,5).map(p=>`<li>${safe(p.title)}</li>`).join('');
  document.getElementById("trendingList").innerHTML = trending;
}

/* === Filters (Jobs/News) === */
function setupFilters(items, listSel, loadBtnSel){
  let page = 1;
  const perPage = 8;
  let filtered = [...items];
  let currentCat = "";
  let currentEdu = "";
  let currentQuery = "";
  let sortOrder = "newest";

  function applyFilters(){
    filtered = [...items];
    const now = new Date();

    if(currentCat){
      if(currentCat==="recent"){
        filtered = filtered.filter(i=>{
          if(i.pubDate){
            let ageHrs = (now - new Date(i.pubDate)) / (1000*60*60);
            return ageHrs < 48;
          }
          return false;
        });
      } else {
        filtered = filtered.filter(i => i.category === currentCat);
      }
    }
    if(currentEdu){
      filtered = filtered.filter(i => i.education === currentEdu);
    }
    if(currentQuery){
      const q = currentQuery.toLowerCase();
      filtered = filtered.filter(i =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.description && i.description.toLowerCase().includes(q))
      );
    }
    if(sortOrder==="newest"){
      filtered.sort((a,b)=> new Date(b.pubDate) - new Date(a.pubDate));
    } else {
      filtered.sort((a,b)=> new Date(a.pubDate) - new Date(b.pubDate));
    }
    page=1;
    renderList();
  }

  function renderList(){
    const slice = filtered.slice(0, page*perPage);
    renderCards(listSel, slice);
    const btn = document.querySelector(loadBtnSel);
    if(btn){
      btn.style.display = (filtered.length > slice.length) ? "block" : "none";
    }
  }

  document.querySelectorAll(".categories .tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll(".categories .tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      currentCat = tab.dataset.cat;
      applyFilters();
    });
  });
  document.querySelectorAll(".education .tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
      document.querySelectorAll(".education .tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      currentEdu = tab.dataset.edu;
      applyFilters();
    });
  });
  const sb = document.getElementById("searchBox");
  if(sb) sb.addEventListener("input", e=>{
    currentQuery = e.target.value;
    applyFilters();
  });
  const sortSel = document.getElementById("sortSelect");
  if(sortSel) sortSel.addEventListener("change", e=>{
    sortOrder = e.target.value;
    applyFilters();
  });

  const btn = document.querySelector(loadBtnSel);
  if(btn) btn.addEventListener("click", ()=>{
    page++;
    renderList();
  });

  applyFilters();
}

/* === Theme Toggle === */
document.getElementById("modeToggle")?.addEventListener("click", ()=>{
  const current = document.body.getAttribute("data-theme");
  if(current==="dark"){ document.body.removeAttribute("data-theme"); }
  else { document.body.setAttribute("data-theme","dark"); }
});

/* === Start === */
loadFeeds();
