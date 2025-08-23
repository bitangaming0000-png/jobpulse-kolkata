// assets/js/utils.js
export function formatDateTimeIST(date = new Date()){
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle:'medium', timeStyle:'short', hour12:true, timeZone:'Asia/Kolkata'
  }).format(date);
}

export function el(tag, cls, html){
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(html) e.innerHTML = html;
  return e;
}

export function truncate(text, n=120){
  if(!text) return '';
  return text.length > n ? text.slice(0,n) + '…' : text;
}

export function safeURL(u){ try{ return new URL(u).toString() }catch{ return '#' } }

export function getQuery(name){
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}
