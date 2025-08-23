// assets/js/theme-boot.js
(function(){
  try{
    var key = 'jp-theme';
    var saved = localStorage.getItem(key);
    var theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }catch(e){
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
