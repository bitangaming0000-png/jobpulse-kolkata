(function(){
  try{
    const pref = localStorage.getItem('jp-theme');
    if (pref) { document.documentElement.setAttribute('data-theme', pref); return; }
    const hrs = Number(new Intl.DateTimeFormat('en-IN',{hour:'2-digit',hour12:false,timeZone:'Asia/Kolkata'}).format(new Date()));
    document.documentElement.setAttribute('data-theme', (hrs>=6 && hrs<18)?'light':'dark');
  }catch{}
})();
