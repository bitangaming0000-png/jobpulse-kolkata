// assets/js/cookie-consent.js
(function(){
  const LS_KEY = 'jp-consent'; // 'accepted' | 'rejected'
  function setConsent(val){
    try{ localStorage.setItem(LS_KEY, val); }catch{}
    window.dispatchEvent(new CustomEvent('jp:consent-changed', { detail:{ value: val }}));
  }
  function getConsent(){
    try{ return localStorage.getItem(LS_KEY) || ''; }catch{ return ''; }
  }
  window.jpConsent = getConsent;

  function $(id){ return document.getElementById(id); }
  function showBanner(show){ const b=$('jp-cookie-banner'); if(b) b.style.display = show ? 'block' : 'none'; }
  function showModal(show){ const m=$('jp-cookie-modal'); if(m) m.style.display = show ? 'block' : 'none'; }

  document.addEventListener('DOMContentLoaded', function(){
    (async () => {
      // inject banner markup
      if(!$('jp-cookie-banner')){
        try {
          const html = await fetch('/components/cookie-banner.html').then(r=>r.text());
          const tmp = document.createElement('template'); tmp.innerHTML = html.trim();
          document.body.appendChild(tmp.content.cloneNode(true));
        } catch(e){}
      }

      // show banner if no stored choice
      const existing = getConsent();
      showBanner(!existing);

      // wire buttons (after injection)
      setTimeout(() => {
        const btnAccept = $('jp-cookie-accept');
        const btnReject = $('jp-cookie-reject');
        const btnSettings = $('jp-cookie-settings');
        const btnSave = $('jp-cookie-save');
        const btnCancel = $('jp-cookie-cancel');
        const adsChk = $('jp-ads-consent');

        if(btnAccept) btnAccept.onclick = () => { setConsent('accepted'); showBanner(false); };
        if(btnReject) btnReject.onclick = () => { setConsent('rejected'); showBanner(false); };
        if(btnSettings) btnSettings.onclick = () => { if(adsChk) adsChk.checked = (getConsent() !== 'rejected'); showModal(true); };
        if(btnCancel) btnCancel.onclick = () => showModal(false);
        if(btnSave) btnSave.onclick = () => {
          const val = adsChk && adsChk.checked ? 'accepted' : 'rejected';
          setConsent(val); showModal(false); showBanner(false);
        };
      }, 0);
    })();
  });
})();
