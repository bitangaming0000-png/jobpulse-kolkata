(function(){
  function safe(s){ return s ? String(s).replace(/</g,"&lt;").replace(/>/g,"&gt;") : ""; }
  function formatDate(d){ return d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : ""; }
  function createCard(i){
    return `<article class="card">
      <img src="${i.thumbnail}" alt="${safe(i.title)}" class="thumb"/>
      <div class="content">
        <h3><a href="post.html?id=${encodeURIComponent(i.id)}&from=jobs">${safe(i.title)}</a></h3>
        <p class="desc">${safe((i.description||"").slice(0,140))}...</p>
        <div class="meta"><span>${formatDate(i.pubDate)}</span><span class="src">${safe(i.source)}</span></div>
      </div>
    </article>`;
  }
  async function loadWBJobs(){ const r=await fetch("/.netlify/functions/jobful?type=jobs&onlyWB=1"); if(!r.ok) throw new Error("jobs"); const j=await r.json(); return j.jobs||[]; }

  function enrich(p){
    const GOVT_KEYS=/govt|government|wbpsc|railway|ssc|upsc|police|bank|municipal|psu|wbpdcl|kolkata police|sarkari/i;
    const WFH_KEYS=/\b(remote|work\s*from\s*home|wfh|telecommute|anywhere|work\s*from\s*anywhere)\b/i;
    const LOC=["Kolkata","Howrah","Siliguri","Asansol","Durgapur","Haldia","Kharagpur","Bardhaman","Jalpaiguri","Malda","Bankura","Purulia","Hooghly","Nadia","Birbhum","Murshidabad","Darjeeling","Cooch Behar","Alipurduar","North 24 Parganas","South 24 Parganas","Paschim Medinipur","Purba Medinipur","Kalimpong","Salt Lake","New Town","Bidhannagar","Dumdum","Barasat","Barrackpore","Serampore","Kalyani","Chandannagar"];
    const kind = GOVT_KEYS.test((p.title||"")+" "+(p.source||"")+" "+(p.category||"")) ? "govt" : "private";
    const wfh  = WFH_KEYS.test(((p.title||"")+" "+(p.description||"")+" "+(p.source||"")).toLowerCase());
    const hay=(p.title||"")+" "+(p.description||""); let location=""; for(const L of LOC){ if(new RegExp(`\\b${L}\\b`,"i").test(hay)){ location=L; break; } }
    return {...p, kind, wfh, location};
  }

  (async function run(){
    const grid=document.getElementById("category-grid"); const titleEl=document.getElementById("catTitle");
    const qs=new URLSearchParams(location.search);
    const city = qs.get("city") || "";
    const kind = (qs.get("kind")||"").toLowerCase();
    const wfh  = qs.get("wfh")==="1" || qs.get("wfh")==="true";
    const onlyWB = qs.get("onlyWB")==="1" || qs.get("onlywb")==="1";

    let title="Jobs";
    if(city) title=`${city} Jobs`;
    if(kind==="govt") title= (city? `${city} Govt Jobs` : "Government Jobs");
    if(kind==="private") title= (city? `${city} Private Jobs` : "Private Jobs");
    if(wfh) title = "Work From Home Jobs";
    if(onlyWB && !city && !wfh) title += " (West Bengal)";
    if (titleEl) titleEl.textContent=title;

    try{
      let jobs = await loadWBJobs(); jobs = jobs.map(enrich);
      if (city) jobs = jobs.filter(j=>j.location===city);
      if (kind) jobs = jobs.filter(j=>j.kind===kind);
      if (wfh)  jobs = jobs.filter(j=>j.wfh);
      grid.innerHTML = jobs.length ? jobs.map(createCard).join("") : `<p class="muted">No posts available</p>`;
    }catch(e){
      console.warn(e); grid.innerHTML = `<p class="muted">Unable to load posts right now.</p>`;
    }
  })();
})();
