// 앱 껍데기를 캐시해 오프라인에서도 열리게 한다. 온라인이면 항상 새 파일을 먼저 받는다.
const CACHE = 'ifu-v28';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/data.js', 'js/battle.js', 'js/net.js', 'js/fmt.js', 'js/firebase-config.js',
  'js/ui/index.js', 'js/ui/common.js', 'js/ui/growth.js', 'js/ui/equip.js', 'js/ui/skill.js',
  'js/ui/companion.js', 'js/ui/dungeon.js', 'js/ui/social.js', 'js/ui/missions.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // cache: 'no-cache'를 붙여야 브라우저 HTTP 캐시를 건너뛰고 서버에 물어본다.
  // 안 붙이면 "온라인이면 새 파일"이라고 해놓고도 브라우저가 캐시한 옛 파일을
  // 그대로 돌려줘서, 배포해도 반영이 안 된 것처럼 보인다.
  // 다만 navigate 요청은 init을 덧붙이면 예외가 나므로 그대로 둔다.
  const req = e.request.mode === 'navigate' ? e.request : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
