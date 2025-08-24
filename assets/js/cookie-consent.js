(function(){
  const LS_KEY='jp-consent';
  function setConsent(v){ try{localStorage.setItem(LS_KEY,v);}catch{} window.dispatchEvent(new CustomEvent('jp:consent-changed',{detail:{value:v}}));}
  function getConsent(){ try{return localStorage.getItem(LS_KEY)||'';}catch{return '';} }
  window.jpConsent=getConsent;
  function $(id){return document.getElementById(id)}
  function showBanner(b){const e=$('jp-cookie-banner'); if(e) e.style.display=b?'block':'none'}
  function showModal(b){const e=$('jp-cookie-modal'); if(e) e.style.display=b?'block':'none'}

  document.addEventListener('DOMContentLoaded',async()=>{
    if(!$('jp-cookie-banner')){
      try{const html=await fetch('/components/cookie-banner.html').then(r=>r.text()); const t=document.createElement('template'); t.innerHTML=html.trim(); document.body.appendChild(t.content.cloneNode(true));}catch{}
    }
    showBanner(!getConsent());
    setTimeout(()=>{
      const a=$('jp-cookie-accept'), r=$('jp-cookie-reject'), s=$('jp-cookie-settings'), sv=$('jp-cookie-save'), c=$('jp-cookie-cancel'), chk=$('jp-ads-consent');
      if(a) a.onclick=()=>{setConsent('accepted'); showBanner(false);}
      if(r) r.onclick=()=>{setConsent('rejected'); showBanner(false);}
      if(s) s.onclick=()=>{ if(chk) chk.checked = (getConsent()!=='rejected'); showModal(true); }
      if(c) c.onclick=()=>showModal(false);
      if(sv) sv.onclick=()=>{ const v=(chk && chk.checked)?'accepted':'rejected'; setConsent(v); showModal(false); showBanner(false); }
    },0);
  });
})();
