/**
 * Service worker (ADR-0010): caches the application shell so the panel opens offline, and never
 * touches the API. Every figure the panel shows (units, holds, countdowns) comes from the server
 * and is only meaningful fresh, so a cached API answer would be a wrong answer, not a fast one.
 *
 * Bump VERSION when the shell changes shape; PwaAssetsTests checks that this list names every
 * static file and nothing that is missing.
 */

const VERSION = "v1";
const CACHE = `nainorder-shell-${VERSION}`;

const PRECACHE = [
  "./",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/css/base.css",
  "./assets/css/components.css",
  "./assets/css/layout.css",
  "./assets/css/tokens.css",
  "./assets/css/views.css",
  "./assets/i18n/en.json",
  "./assets/i18n/en.views.json",
  "./assets/i18n/es.json",
  "./assets/i18n/es.views.json",
  "./assets/js/api.js",
  "./assets/js/app.js",
  "./assets/js/charts.js",
  "./assets/js/dom.js",
  "./assets/js/format.js",
  "./assets/js/i18n.js",
  "./assets/js/mock-backend.js",
  "./assets/js/order-panel.js",
  "./assets/js/overlay.js",
  "./assets/js/qr.js",
  "./assets/js/router.js",
  "./assets/js/state.js",
  "./assets/js/toast.js",
  "./assets/js/views/architecture.js",
  "./assets/js/views/catalog.js",
  "./assets/js/views/dashboard.js",
  "./assets/js/views/drop.js",
  "./assets/js/views/orders.js",
  "./assets/js/views/race.js"
];

/** Paths owned by the server: they go to the network and fail honestly when offline. */
const NEVER = ["/api", "/health", "/swagger"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("nainorder-shell-") && key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return;

  // Navigations: network first so a new deploy is picked up, the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./", copy));
          return response;
        })
        .catch(() => caches.match("./"))
    );
    return;
  }

  // Static files: serve the cached copy at once and refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const refreshed = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? refreshed;
    })
  );
});
