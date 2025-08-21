// === JobPulse West Bengal – Fancy UI Frontend ===

let jobs = [];
let news = [];

// DOM
const jobList        = document.getElementById('jobList');
const newsList       = document.getElementById('newsList');
const searchJobs     = document.getElementById('searchJobs');
const searchNews     = document.getElementById('searchNews');
const districtFilter = document.getElementById('districtFilter');
const modeToggle     = document.getElementById('modeToggle');

// THEME: persist light/dark
(function initTheme(){
  const saved = localStorage.getItem('jp-theme');
  if(saved === 'light'){ document.documentElement.classList.add('light'); }
  modeToggle?.addEventListener('click', ()=>{
    document.documentElement.classList.toggle('light');
    localStorage.setItem('jp-theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
})();

// Fetch from Netlify Function
async function loadUnified() {
  try {
    const res = await fetch('/.netlify/functions/fetchFeeds', { cache: 'no-store' });
    const data = await res.json();
    jobs = data.jobs || [];
    news = data.news || [];
    renderJobs();
    renderNews();
  } catch (e) {
    console.error('Failed to load feeds:', e);
    showEmpty(jobList, 'Could not load jobs right now.');
    showEmpty(newsList, 'Could not load news right now.');
  }
}

// Helpers
function showEmpty(container, msg){
  container.innerHTML = `<div class="empty">${msg}</div>`;
}
function safeShort(text='', n=220){
  return text.length > n ? text.slice(0,n) + '…' : text;
}

// Renderers
function renderJobs() {
  const q = (searchJobs.value || '').toLowerCase();
  const sel = (districtFilter && districtFilter.value) || '';
  const filtered = jobs.filter(j => {
    const blob = `${j.title} ${j.source} ${j.description} ${j.region||''}`.toLowerCase();
    const textMatch = blob.includes(q);
    const regionMatch = sel ? blob.includes(sel.toLowerCase()) : true;
    return textMatch && regionMatch;
  });

  if(!filtered.length){ showEmpty(jobList, 'No jobs found. Try another search or district.'); return; }

  jobList.innerHTML = filtered.map(j => `
    <article class="card">
      <h3>${j.title}</h3>
      <div class="meta">${j.source || 'Source'} ${j.pubDate ? `• ${new Date(j.pubDate).toLocaleDateString()}`:''}</div>
      <div class="badges">
        ${j.region ? `<span class="badge accent">${j.region}</span>` : ``}
        <span class="badge">Job</span>
      </div>
      <p class="desc">${safeShort(j.description)}</p>
      <div class="actions-row">
        <a class="btn btn-apply" href="${j.link}" target="_blank" rel="noopener">Apply ↗</a>
        <a class="btn btn-share" href="https://chat.whatsapp.com/I9VTTrRcrcz8wAMG8yq90N?text=${encodeURIComponent('Check this job: ' + j.title + ' - ' + j.link)}" target="_blank" rel="noopener">Share ↗</a>
      </div>
    </article>
  `).join('');
}

function renderNews() {
  const q = (searchNews.value || '').toLowerCase();
  const sel = (districtFilter && districtFilter.value) || '';
  const filtered = news.filter(n => {
    const blob = `${n.title} ${n.source} ${n.description} ${n.region||''}`.toLowerCase();
    const textMatch = blob.includes(q);
    const regionMatch = sel ? blob.includes(sel.toLowerCase()) : true;
    return textMatch && regionMatch;
  });

  if(!filtered.length){ showEmpty(newsList, 'No news found. Try another search or district.'); return; }

  newsList.innerHTML = filtered.map(n => `
    <article class="card">
      ${n.thumbnail ? `<img src="${n.thumbnail}" alt="News image">` : ``}
      <h3>${n.title}</h3>
      <div class="meta">${n.source || ''} ${n.pubDate ? `• ${new Date(n.pubDate).toLocaleDateString()}`:''}</div>
      <div class="badges">
        ${n.region ? `<span class="badge accent">${n.region}</span>` : ``}
        <span class="badge">News</span>
      </div>
      <p class="desc">${safeShort(n.description)}</p>
      <div class="actions-row">
        <a class="btn btn-apply" href="${n.link}" target="_blank" rel="noopener">Read More ↗</a>
        <a class="btn btn-share" href="https://chat.whatsapp.com/I9VTTrRcrcz8wAMG8yq90N?text=${encodeURIComponent('Check this news: ' + n.title + ' - ' + n.link)}" target="_blank" rel="noopener">Share ↗</a>
      </div>
    </article>
  `).join('');
}

// Live filters
searchJobs?.addEventListener('input', renderJobs);
searchNews?.addEventListener('input', renderNews);
districtFilter?.addEventListener('change', ()=>{ renderJobs(); renderNews(); });

// Boot + refresh
loadUnified();
setInterval(loadUnified, 10 * 60 * 1000);
