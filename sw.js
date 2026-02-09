const CACHE_NAME = 'partekartu-v1.4';
const assets = [
  './',
  './index.html', 
  './manifest.json', 
  './js/app.js', 
  './js/utils.js', 
  './js/api.js', 
  './js/ui.js', 
  './js/config.js'
];

// INSTALACIÓN: Descarga los nuevos archivos
self.addEventListener('install', e => {
    self.skipWaiting(); // <--- IMPORTANTE: Fuerza al nuevo SW a activarse ya
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Cacheando nuevos archivos');
            return cache.addAll(ASSETS);
        })
    );
});

// ACTIVACIÓN: Limpia las cachés viejas para liberar espacio
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('Borrando caché antigua:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // Toma el control de las pestañas abiertas inmediatamente
    self.clients.claim();
});

// FETCH: Estrategia híbrida
self.addEventListener('fetch', e => {
    // Si es el index.html (navegación), intentamos RED primero para ver cambios
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }

    // Para el resto (imágenes, css, js), usamos la CACHÉ para velocidad
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request))
    );
});


