/* 白月茧响 - Service Worker（离线缓存） */
const CACHE_NAME = 'wmc-v4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './enemies.js',
  './story.js',
  './story-data.js',
  './core/world-data.js',
  './core/world.js',
  './core/daycycle.js',
  './core/game.js',
  './core/data.js',
  './core/events.js',
  './core/quests.js',
  './config/game-config.js',
  './config/quest-config.js',
  './battle.js',
  './ui/dialogue.js',
  './ui/map.js',
  './ui/battle.js',
  './ui/menu.js',
  './ui/quest.js',
  './main.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
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

  // 静态资源（脚本/数据/样式/页面）网络优先：保证刷新拿到最新版
  // 其余（图标等）缓存优先
  const isStatic = /\.(js|css|html|webmanifest|json)$/.test(url.pathname) || e.request.mode === 'navigate';

  if (isStatic) {
    e.respondWith(
      Promise.race([
        fetch(e.request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        return caches.match(e.request).then((hit) => hit ||
          (e.request.mode === 'navigate' ? caches.match('./index.html') : new Response('', { status: 408, statusText: 'offline' }))
        );
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone)).catch(() => {});
        }
        return res;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 408, statusText: 'offline' });
    })
  );
});
