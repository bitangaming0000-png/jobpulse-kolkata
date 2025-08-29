/* ads.js — auto-consent (no popup), AdSense loader, auto-hide empty ad blocks, sticky anchor ad */

const ADS_CLIENT = "ca-pub-5732778753912461";
const CONSENT_KEY = "jp-consent"; // "granted"
const HIDE_THRESHOLD = 40; // px height below which we consider "no fill"

/** Inject AdSense script exactly once */
function loadAdSense() {
  if (document.getElementById("adsbygoogle-js")) return;
  const s = document.createElement("script");
  s.id = "adsbygoogle-js";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
  document.head.appendChild(s);
}

/** Attempt to render all current ad slots */
function pushAllAds() {
  if (!window.adsbygoogle) window.adsbygoogle = [];
  document.querySelectorAll("ins.adsbygoogle:not(.jp-pushed)").forEach(ins => {
    try { (adsbygoogle = window.adsbygoogle || []).push({}); ins.classList.add("jp-pushed"); } catch {}
  });
}

/** Hide ad containers that didn't fill (saves layout space) */
function collapseEmptyAds() {
  const tryHide = () => {
    document.querySelectorAll(".ads").forEach(box => {
      const ins = box.querySelector("ins.adsbygoogle");
      if (!ins) return;
      const h = ins.offsetHeight || ins.clientHeight || 0;
      if (h < HIDE_THRESHOLD) box.classList.add("hidden");
      else box.classList.remove("hidden");
    });
  };
  // give Google time to render
  setTimeout(tryHide, 3000);
  setTimeout(tryHide, 7000);
}

/** Sticky anchor ad (dismissible, auto-hide if no fill) */
function setupAnchorAd() {
  const anchor = document.getElementById("anchor-ad");
  if (!anchor) return;

  const close = anchor.querySelector(".anchor-close");
  if (close) close.addEventListener("click", () => { anchor.hidden = true; });

  // Show attempt; hide if no fill
  const showAttempt = () => {
    anchor.hidden = false;
    pushAllAds();
    setTimeout(() => {
      const ins = anchor.querySelector("ins.adsbygoogle");
      const h = ins ? (ins.offsetHeight || 0) : 0;
      if (h < HIDE_THRESHOLD) anchor.hidden = true;
    }, 4000);
  };
  showAttempt();
}

/** Remove any leftover consent banner markup (if present) */
function nukeConsentBannerIfAny() {
  const b = document.getElementById("consent-banner");
  if (b && b.parentNode) b.parentNode.removeChild(b);
}

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Always auto-grant consent (no popup)
  try { localStorage.setItem(CONSENT_KEY, "granted"); } catch {}

  // If any old banner HTML exists in the page, remove it
  nukeConsentBannerIfAny();

  // Load ads and manage layout
  loadAdSense();
  pushAllAds();
  collapseEmptyAds();
  setupAnchorAd();

  // In case new ad slots are injected later (e.g., client-side nav)
  const mo = new MutationObserver(() => {
    pushAllAds();
    collapseEmptyAds();
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
