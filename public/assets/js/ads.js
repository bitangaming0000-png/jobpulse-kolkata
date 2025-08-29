/* ads.js — consent + AdSense loader + auto-hide empty ad blocks + sticky anchor ad */

const ADS_CLIENT = "ca-pub-5732778753912461";
const CONSENT_KEY = "jp-consent"; // "granted" | "denied"
const HIDE_THRESHOLD = 40; // px height below which we consider "no fill"

/** Inject AdSense script only after consent */
function loadAdSense() {
  if (document.getElementById("adsbygoogle-js")) return;
  const s = document.createElement("script");
  s.id = "adsbygoogle-js";
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT}`;
  document.head.appendChild(s);
}

/** Try to fill all existing ins.adsbygoogle blocks */
function pushAllAds() {
  if (!window.adsbygoogle) window.adsbygoogle = [];
  document.querySelectorAll("ins.adsbygoogle:not(.jp-pushed)").forEach(ins => {
    try { (adsbygoogle = window.adsbygoogle || []).push({}); ins.classList.add("jp-pushed"); } catch {}
  });
}

/** Hide ad containers that didn't fill (after a delay) */
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
  // try a couple of times to give ads time to render
  setTimeout(tryHide, 3000);
  setTimeout(tryHide, 7000);
}

/** Sticky anchor ad (optional, dismissible) */
function setupAnchorAd() {
  const anchor = document.getElementById("anchor-ad");
  if (!anchor) return;
  const close = anchor.querySelector(".anchor-close");
  if (close) close.addEventListener("click", () => anchor.hidden = true);

  // Try to show; if no fill, hide
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

/** Consent banner UI */
function showConsentBanner() {
  const banner = document.getElementById("consent-banner");
  if (!banner) return;
  banner.hidden = false;
  const accept = document.getElementById("consent-accept");
  const decline = document.getElementById("consent-decline");
  accept?.addEventListener("click", () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    banner.hidden = true;
    loadAdSense();
    pushAllAds();
    collapseEmptyAds();
    setupAnchorAd();
  });
  decline?.addEventListener("click", () => {
    localStorage.setItem(CONSENT_KEY, "denied");
    banner.hidden = true;
    // Hide all ad boxes immediately if declined
    document.querySelectorAll(".ads, #anchor-ad").forEach(el => el.classList?.add("hidden"));
  });
}

/** Init on load */
document.addEventListener("DOMContentLoaded", () => {
  const consent = localStorage.getItem(CONSENT_KEY);
  if (consent === "granted") {
    loadAdSense();
    pushAllAds();
    collapseEmptyAds();
    setupAnchorAd();
  } else if (consent === "denied") {
    document.querySelectorAll(".ads, #anchor-ad").forEach(el => el.classList?.add("hidden"));
  } else {
    showConsentBanner();
  }
});
