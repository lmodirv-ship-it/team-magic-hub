// NAWAT service worker — network-first, enables "update available" prompt.
const CACHE = "nawat-v1";
self.addEventListener("install", () => {});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  e.respondWith(fetch(req).catch(() => caches.match("/offline.html").then((r) => r || caches.open(CACHE).then(() => Response.error()))));
});
