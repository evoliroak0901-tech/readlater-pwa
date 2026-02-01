// Service Worker for ReadLater PWA

const CACHE_NAME = 'readlater-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

// インストール時にキャッシュ
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// フェッチ時はキャッシュファースト戦略 + Share Target処理
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // /share パスへのリクエストを処理
    if (url.pathname === '/share' && event.request.method === 'GET') {
        event.respondWith(
            Response.redirect('/?url=' + url.searchParams.get('url') +
                '&title=' + url.searchParams.get('title') +
                '&text=' + url.searchParams.get('text'), 303)
        );
        return;
    }

    // 通常のキャッシュ戦略
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(response => {
                    // レスポンスをクローンしてキャッシュに保存
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            })
    );
});
