const CACHE_NAME = 'gidapark-v1';
const assets = [
  'index.html',
  'manifest.json',
  'js/shared/config.js',
  'js/shared/i18n.js',
  'js/shared/utils.js',
  'js/shared/router.js',
  'js/shared/app.js',
  'js/flexible/api.js',
  'js/flexible/ui.js',
  'js/fixed/config.js',
  'js/fixed/groups.js',
  'js/fixed/calendar.js',
  'js/fixed/trips.js',
  'js/fixed/debts.js',
  'js/fixed/modals.js',
  'js/fixed/profile.js',
  'js/fixed/utils.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
