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

// ✅ Initialize all ads
function initAds() {
  document.querySelectorAll(".adsbygoogle").forEach(ad => {
    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
    } catch(e) { console.warn("Ad init error", e); }
  });
}

// ✅ Hide empty ad slots (if not filled by Google)
function watchAds() {
  document.querySelectorAll(".adsbygoogle").forEach(ad => {
    const check = setInterval(()=>{
      if (ad && ad.offsetHeight === 0) {
        ad.parentElement.style.display="none";
        clearInterval(check);
      }
    }, 4000);
  });
}

// ✅ Sticky Anchor Ad
const anchorAd = document.getElementById("anchor-ad");
if (anchorAd) {
  const closeBtn = anchorAd.querySelector(".anchor-close");
  if (closeBtn) closeBtn.addEventListener("click", ()=> anchorAd.remove());

  // Show anchor after delay
  setTimeout(()=>{
    anchorAd.hidden=false;
    initAds();
  }, 5000);
}

// ✅ Run on load
window.addEventListener("load", ()=>{
  initAds();
  watchAds();
});

// In case of SPA navigation
document.addEventListener("DOMContentLoaded", ()=>{
  initAds();
  watchAds();
});
