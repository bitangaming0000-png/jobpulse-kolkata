// === HOMEPAGE ===
if(PAGE === 'home'){
  // Show 6 latest jobs & news with images
  renderCards('#latestJobs', JOBS.slice(0,6));
  renderCards('#latestNews', NEWS.slice(0,6));

  // Sidebar Notifications (auto-scroll short titles)
  const notifEl = document.getElementById('notifications');
  notifEl.innerHTML = NEWS.slice(0,10).map(n=>`<div>${safe(n.title)}</div>`).join('');
  
  // Latest Announcements (keywords from news titles)
  const annEl = document.getElementById('announcements');
  const keywords = NEWS.slice(0,6).map(n => n.title.split(" ").slice(0,3).join(" "));
  annEl.innerHTML = keywords.map(k=>`<li>${safe(k)}</li>`).join('');
  
  // Others (mix of jobs/news not in top)
  const othersEl = document.getElementById('others');
  const others = [...JOBS.slice(6,10), ...NEWS.slice(6,10)];
  othersEl.innerHTML = others.map(o=>`<li>${safe(o.title)}</li>`).join('');
}
