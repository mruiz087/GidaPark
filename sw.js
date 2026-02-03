const CACHE_NAME = 'partekartu-v2';
const assets = ['index.html', 'manifest.json', 'js/app.js', 'js/utils.js', 'js/api.js', 'js/ui.js', 'js/config.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
