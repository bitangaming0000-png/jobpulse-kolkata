// theme-boot.js (final)
(function(){
  try {
    const pref = localStorage.getItem('jp-theme');
    if (pref) {
      // Use saved theme if exists
      document.documentElement.setAttribute('data-theme', pref);
      return;
    }
    // Auto theme: light 6 AM – 6 PM IST, otherwise dark
    const hrs = Number(new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata'
    }).format(new Date()));

    const mode = (hrs >= 6 && hrs < 18) ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
  } catch (e) {
    // Fallback: dark
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
