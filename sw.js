/* 白月茧响 - Service Worker（离线缓存） */
const CACHE_NAME = 'wmc-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './enemies.js',
  './story.js',
  './story-data.js',
  './battle.js',
  './main.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => {
      // 离线且未缓存：退回首页（保留存档于 localStorage）
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 408, statusText: 'offline' });
    })
  );
});
