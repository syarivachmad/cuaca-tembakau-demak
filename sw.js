// ── SACAKA Service Worker ─────────────────────────────────────────────────
// Sistem Aplikasi Cuaca Tembakau Kabupaten Demak
// Versi cache — naikkan versi ini setiap kali ada update besar
const CACHE_NAME = 'sacaka-v1';

// File yang di-cache saat install (app shell)
const APP_SHELL = [
  '/',
  '/index_v3_5.html',
  '/manifest.json',
  '/img/opt/ulat_grayak.jpg',
  '/img/opt/ulat_pucuk.jpg',
  '/img/opt/tmv_cmv.jpg',
  '/img/opt/bercak_daun.jpg',
  '/img/opt/krupuk.jpg',
  '/img/opt/lanas.jpg',
];

// ── INSTALL: cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    }).then(() => {
      // Langsung aktif tanpa menunggu tab lama ditutup
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: hapus cache lama ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    }).then(() => {
      // Langsung kontrol semua tab yang terbuka
      return self.clients.claim();
    })
  );
});

// ── FETCH: strategi Cache First, Network Fallback ────────────────────────
// - File lokal (HTML, gambar OPT): dari cache dulu
// - API cuaca Open-Meteo: dari jaringan dulu, cache sebagai fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API eksternal (Open-Meteo, GoatCounter, GA4) → Network First
  const isExternal = !url.hostname.includes('sacaka.web.id') &&
                     url.hostname !== self.location.hostname;

  if (isExternal) {
    // Untuk API: coba jaringan, jika gagal tidak ada fallback (data real-time)
    event.respondWith(fetch(event.request).catch(() => {
      // Kembalikan respons kosong agar app tidak crash
      return new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }));
    return;
  }

  // Aset lokal: Cache First → Network Fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Tidak ada di cache → ambil dari jaringan dan simpan
      return fetch(event.request).then(response => {
        // Hanya cache respons yang valid
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline dan tidak ada cache → kembalikan halaman utama dari cache
        return caches.match('/index_v3_5.html');
      });
    })
  );
});
