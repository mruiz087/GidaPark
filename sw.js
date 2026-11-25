const CACHE_NAME = 'gidapark-v3.1';
const assets = [
    'index.html',
    'manifest.json',
    'icon_gidapark.png'
];

self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(assets).catch(() => {}))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// Network-First for same-origin assets so HTML/JS updates apply immediately without stale cache
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    e.respondWith(
        fetch(e.request)
            .then(networkRes => {
                if (networkRes && networkRes.status === 200) {
                    const copy = networkRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
                }
                return networkRes;
            })
            .catch(() => caches.match(e.request))
    );
});
