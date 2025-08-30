// ✅ Load AdSense script safely
(function() {
  try {
    if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
      const s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5732778753912461";
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    }
  } catch(e) { console.warn("AdSense script load error", e); }
})();

// ✅ Initialize ads safely
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
    try {
      const check = setInterval(()=>{
        if (ad && ad.offsetHeight === 0) {
          ad.parentElement.style.display="none";
          clearInterval(check);
        }
      }, 4000);
    } catch(e) { console.warn("Ad hide error", e); }
  });
}

// ✅ Sticky Anchor Ad
try {
  const anchorAd = document.getElementById("anchor-ad");
  if (anchorAd) {
    const closeBtn = anchorAd.querySelector(".anchor-close");
    if (closeBtn) closeBtn.addEventListener("click", ()=> anchorAd.remove());

    setTimeout(()=>{
      try {
        anchorAd.hidden=false;
        initAds();
      } catch(e){ console.warn("Anchor ad error", e); }
    }, 5000);
  }
} catch(e) { console.warn("AnchorAd setup error", e); }

// ✅ Run
window.addEventListener("load", ()=>{
  try { initAds(); watchAds(); } catch(e){ console.warn("Ad load error", e); }
});
document.addEventListener("DOMContentLoaded", ()=>{
  try { initAds(); watchAds(); } catch(e){ console.warn("Ad DOM error", e); }
});
