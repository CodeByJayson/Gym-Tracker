/* =========================================================================
   sw.js – Service Worker für GymTracker PWA
   Cached alle Assets beim ersten Install und liefert sie offline aus.
   ========================================================================= */

const CACHE_VERSION = 'v1';
const CACHE_NAME    = `gymtracker-${CACHE_VERSION}`;

/* Alle Dateien, die offline verfügbar sein müssen */
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  /* Externe CDNs: beim ersten Install mitspeichern */
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  /* Icons (falls vorhanden – sonst werden sie ignoriert) */
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* -------------------------------------------------------------------------
   INSTALL: Assets vorcachen
   ------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      /* Einzeln hinzufügen, damit ein fehlendes Icon nicht alles killt */
      await Promise.all(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            console.warn('[SW] Konnte nicht cachen:', url, err);
          }
        })
      );

      /* Sofort aktivieren, ohne auf alte Tabs zu warten */
      await self.skipWaiting();
    })()
  );
});

/* -------------------------------------------------------------------------
   ACTIVATE: Alte Caches aufräumen
   ------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('gymtracker-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/* -------------------------------------------------------------------------
   FETCH: Cache-First für statische Assets, Network-Fallback
   ------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  /* Nur GET-Requests cachen */
  if (request.method !== 'GET') return;

  /* Nur http(s) – keine chrome-extension etc. */
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  /* Navigationen (Aufruf der App selbst) → immer index.html liefern */
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (_) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  /* Alles andere: Cache-First, dann Netzwerk */
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const fresh = await fetch(request);
        /* Nur erfolgreiche Antworten cachen */
        if (fresh && fresh.status === 200 && fresh.type !== 'opaque') {
          cache.put(request, fresh.clone());
        } else if (fresh && fresh.type === 'opaque') {
          /* Für CDN-Requests mit no-cors (opaque Response) trotzdem cachen */
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (err) {
        /* Offline-Fallback für Navigation haben wir oben schon abgedeckt */
        return cached || Response.error();
      }
    })()
  );
});

/* -------------------------------------------------------------------------
   MESSAGE: Manuelles Cache-Update per postMessage möglich
   ------------------------------------------------------------------------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});