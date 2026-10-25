// Offline-friendly shell. Game data (/api) and private pages are never cached.
const C='haggle-v5',A=['/','/styles.css','/i18n.js','/musiclinks.js','/stations.js','/common.js','/music.js','/app.js','/manifest.webmanifest','/icon-192.png','/icon-512.png'];
const SKIP=['/api','/healthz','/report.html','/owner.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(A.map(u=>c.add(u).catch(()=>{})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin||SKIP.some(p=>u.pathname===p||u.pathname.startsWith(p+'/')))return;
 // Network first (so updates show up straight away), cache when the network is slow or gone.
 e.respondWith(new Promise(res=>{
  let done=false;const fall=()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||(e.request.mode==='navigate'?caches.match('/'):undefined));
  const t=setTimeout(()=>fall().then(m=>{if(m&&!done){done=true;res(m)}}),8000);
  fetch(e.request).then(r=>{clearTimeout(t);if(r.ok&&r.type==='basic'){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}if(!done){done=true;res(r)}})
   .catch(()=>{clearTimeout(t);fall().then(m=>{if(!done){done=true;res(m||Response.error())}})});
 }));
});
