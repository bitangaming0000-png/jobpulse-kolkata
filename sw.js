const VERSION = 'jp-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/assets/js/main.js',
  '/assets/js/utils.js',
  '/components/header.html',
  '/components/footer.html'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(VERSION).then(c=>c.addAll(APP_SHELL)));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==VERSION?caches.delete(k):null))));
});
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  // cache-first for same-origin GETs
  if (e.request.method==='GET' && url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(res=> res || fetch(e.request).then(r=>{
      const copy = r.clone(); caches.open(VERSION).then(c=>c.put(e.request, copy)); return r;
    }).catch(()=> caches.match('/index.html'))));
  }
});
