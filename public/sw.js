// Service worker minimo — serve solo a soddisfare i criteri di
// installabilità PWA richiesti dai browser (Chrome/Edge). Non fa
// caching offline di proposito: la Dashboard deve sempre mostrare
// dati aggiornati in tempo reale da Firestore, mai una copia vecchia.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
