// Set theme BEFORE paint to avoid flash
(function(){
  try{
    const pref = localStorage.getItem('jp-theme');
    if (pref) { document.documentElement.setAttribute('data-theme', pref); return; }
    // Auto: light 6am–6pm IST, else dark
    const hrs = Number(new Intl.DateTimeFormat('en-IN', { hour:'2-digit', hour12:false, timeZone:'Asia/Kolkata' }).format(new Date()));
    document.documentElement.setAttribute('data-theme', (hrs>=6 && hrs<18)?'light':'dark');
  }catch{
    document.documentElement.setAttribute('data-theme','dark');
  }
})();
