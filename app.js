function setupFilters(containerSelector, listSelector, items, type="job"){
  let currentCat = '';
  let currentEdu = '';
  let currentQuery = '';

  const catTabs = document.querySelectorAll(containerSelector + ' .categories .tab');
  const eduTabs = document.querySelectorAll(containerSelector + ' .education .tab');
  const searchBox = document.querySelector(containerSelector + ' #searchBox');

  function applyFilters(){
    let filtered = [...items];
    if(currentCat){
      filtered = filtered.filter(i => i.category === currentCat);
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
    renderCards(listSelector, filtered);
  }

  catTabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      catTabs.forEach(t=> t.classList.remove('active'));
      tab.classList.add('active');
      currentCat = tab.getAttribute('data-cat');
      applyFilters();
    });
  });

  eduTabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      eduTabs.forEach(t=> t.classList.remove('active'));
      tab.classList.add('active');
      currentEdu = tab.getAttribute('data-edu');
      applyFilters();
    });
  });

  searchBox && searchBox.addEventListener('input', ()=>{
    currentQuery = searchBox.value;
    applyFilters();
  });

  applyFilters();
}

// === Jobs Page ===
if(PAGE === 'jobs'){
  setupFilters('.filters', '#jobList', JOBS, 'job');

  // Sidebar content
  document.getElementById('notifications').innerHTML =
    NEWS.slice(0,10).map(n=>`<div>${safe(n.title)}</div>`).join('');
  document.getElementById('announcements').innerHTML =
    NEWS.slice(0,6).map(n=>`<li>${safe(n.title.split(" ").slice(0,3).join(" "))}</li>`).join('');
  document.getElementById('others').innerHTML =
    [...NEWS.slice(6,9)].map(o=>`<li>${safe(o.title)}</li>`).join('');
}

// === News Page ===
if(PAGE === 'news'){
  setupFilters('.filters', '#newsList', NEWS, 'news');
}
