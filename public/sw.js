/* Service worker — cachea solo assets estáticos (íconos, manifest) para
   que la app instale rápido. La página principal y todo lo que viene de
   la API SIEMPRE se pide en red primero, para que nadie quede viendo
   una versión vieja cacheada. Si no hay conexión, recién ahí usa la
   última copia guardada. */

const CACHE = "g2app-shell-v2";
const SHELL = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // Nunca cachear la API: siempre en vivo.
  if (req.url.includes("/api/")) return;

  // Página principal (navegación) y el propio index.html: red primero,
  // caché solo como respaldo si no hay conexión.
  if (req.mode === "navigate" || req.url.endsWith("/index.html") || req.url.endsWith("/")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Assets estáticos (íconos, manifest): caché primero, más rápido.
  if (SHELL.some((s) => req.url.endsWith(s.replace("./", "")))) {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
  }
});
