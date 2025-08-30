// ✅ Load AdSense script if not already loaded
(function() {
  if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5732778753912461";
    s.crossOrigin = "anonymous";
    document.head.appendChild(s);
  }
})();

// ✅ Helper: initialize all ads
function initAds() {
  document.querySelectorAll(".adsbygoogle").forEach(ad => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch(e) { console.warn("Ad init error", e); }
  });
}

// ✅ Auto-hide empty ad slots
function watchAds() {
  document.querySelectorAll(".adsbygoogle").forEach(ad => {
    const check = setInterval(()=>{
      if (ad && ad.offsetHeight === 0) {
        ad.parentElement.style.display="none";
        clearInterval(check);
      }
    }, 3000);
  });
}

// ✅ Sticky Anchor Ad
const anchorAd = document.getElementById("anchor-ad");
if (anchorAd) {
  const closeBtn = anchorAd.querySelector(".anchor-close");
  if (closeBtn) closeBtn.addEventListener("click", ()=> anchorAd.remove());

  // Show anchor after few seconds
  setTimeout(()=>{
    anchorAd.hidden=false;
    initAds();
  }, 5000);
}

// ✅ Refresh ads after navigation / async load
window.addEventListener("load", ()=>{
  initAds();
  watchAds();
});

// In case of SPA-style navigation
document.addEventListener("DOMContentLoaded", ()=>{
  initAds();
  watchAds();
});
