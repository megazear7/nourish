const BUILD = "__NOURISH_BUILD__";
const CACHE = `nourish-${BUILD}`;

const PRECACHE = [
  "/index.html",
  "/bundle.js",
  "/manifest.json",
  "/favicon.ico",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/fonts/inter-latin.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map((url) => precache(cache, url)));
      const shell = await cache.match("/index.html");
      if (shell) await cache.put("/", shell.clone());
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fromShell());
    return;
  }

  event.respondWith(fromCache(request));
});

async function precache(cache, url) {
  const response = await fetch(url, { cache: "reload" });
  if (!response.ok) throw new Error(`Precache failed for ${url}`);
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") && !url.endsWith(".html") && url !== "/") {
    throw new Error(`Precache got HTML for ${url}`);
  }
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  const stored = new Response(await response.arrayBuffer(), { status: 200, headers });
  await cache.put(url, stored);
}
async function fromShell() {
  const cached = (await caches.match("/index.html")) || (await caches.match("/"));
  if (cached) return cached;
  return fetch("/index.html");
}

async function fromCache(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}
