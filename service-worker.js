// Peace-In Practice Service Worker
// 네트워크 우선 전략 - 항상 최신 버전 사용, 오프라인 시에만 캐시 fallback

const CACHE_VERSION = 'pip-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './pip-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // 실패해도 설치는 계속 (아이콘 등이 없어도 앱은 동작)
      return Promise.all(
        CORE_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('Cache add failed:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET만 처리, API 요청은 절대 캐시하지 않음 (데이터 신선도 중요)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('railway.app') ||
      url.hostname.includes('supabase') || url.hostname.includes('anthropic')) {
    return; // 브라우저 기본 동작 (네트워크)
  }

  event.respondWith(
    fetch(req).then((response) => {
      // 성공 시 정적 자산만 캐시에 업데이트
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then(cache => {
          cache.put(req, clone).catch(() => {});
        });
      }
      return response;
    }).catch(() => {
      // 네트워크 실패 시 캐시에서 반환
      return caches.match(req).then(cached => cached || caches.match('./index.html'));
    })
  );
});
