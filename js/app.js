function safe(s){ return s?String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;"):""; }
function formatDate(d){ return d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):""; }
function isNew(post){ return (Date.now()-new Date(post.pubDate).getTime()) < 1000*60*60*48; }
function createCard(item){
  return `<article class="card">
    <img src="${item.thumbnail}" alt="${safe(item.title)}" class="thumb"/>
    <div class="content">
      <h3><a href="post.html?id=${encodeURIComponent(item.id)}&from=${item.category}">${safe(item.title)}</a>
        ${isNew(item)?'<span class="badge-new">NEW 🔥</span>':''}</h3>
      <p>${safe((item.description||"").slice(0,120))}...</p>
      <div class="meta"><span>${formatDate(item.pubDate)}</span><span>${safe(item.source)}</span></div>
    </div>
  </article>`;
}
// Visitor Counter
(function(){
  let count = localStorage.getItem("visitCount") || 0;
  count = parseInt(count) + 1;
  localStorage.setItem("visitCount", count);
  const el=document.getElementById("visitCount"); if(el) el.textContent = count;
})();
// Fetch data
async function loadAll(){
  try{ const r=await fetch("/.netlify/functions/jobful"); return await r.json(); }
  catch(e){ console.error(e); return {jobs:[],news:[],exams:[],trending:[]}; }
}
function renderList(id,arr,limit=0){
  const el=document.getElementById(id); if(!el) return;
  const list=(limit?arr.slice(0,limit):arr);
  el.innerHTML=list.map(createCard).join("")||"<p>No data</p>";
}
(async function init(){
  const all=await loadAll();
  renderList("home-latest-jobs",all.jobs,6);
  renderList("home-latest-news",all.news,6);
  renderList("home-latest-exams",all.exams,6);
  // auto scroll
  const notif=document.getElementById("notifications-scroll");
  if(notif){ notif.innerHTML=(all.news.slice(0,10).map(n=>`<span>🔔 ${safe(n.title)}</span>`)).join(" • "); }
})();
