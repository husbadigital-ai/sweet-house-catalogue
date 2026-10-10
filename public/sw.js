const CACHE = "sweethouse-shell-v8";
const CORE = ["/", "/manifest.webmanifest", "/admin-manifest.webmanifest", "/icon.svg", "/offline.html"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return; // API data must always be fresh.
  if (url.origin !== location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => { if (response.ok) caches.open(CACHE).then(cache => Promise.all([cache.put("/", response.clone()), cache.put(request, response.clone())])); return response; }).catch(() => caches.match(request).then(cached => cached || caches.match("/offline.html"))));
    return;
  }
  event.respondWith(caches.match(request).then(cached => {
    const network = fetch(request).then(response => { if (response.ok && url.pathname !== "/") caches.open(CACHE).then(cache => cache.put(request, response.clone())); return response; }).catch(() => cached);
    return cached || network;
  }));
});
