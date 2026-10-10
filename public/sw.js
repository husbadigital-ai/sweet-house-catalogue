const CACHE = "sweet-house-v5";
const CORE = ["/", "/manifest.webmanifest", "/icon.svg", "/offline.html"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch", event => {
 const request=event.request, url=new URL(request.url);
 if(request.method!=="GET"||url.pathname.startsWith("/api/")) return;
 if(url.origin!==location.origin) return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request).then(cached=>cached||caches.match("/offline.html"))));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>{const network=fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;}).catch(()=>cached);return cached||network;}));
});
