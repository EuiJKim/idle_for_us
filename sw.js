// 앱 껍데기를 캐시해 오프라인에서도 열리게 한다. 온라인이면 항상 새 파일을 먼저 받는다.
const CACHE = 'ifu-v45';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/data.js', 'js/battle.js', 'js/net.js', 'js/fmt.js', 'js/firebase-config.js',
  'js/ui/index.js', 'js/ui/common.js', 'js/ui/growth.js', 'js/ui/equip.js', 'js/ui/skill.js',
  'js/ui/companion.js', 'js/ui/dungeon.js', 'js/ui/social.js', 'js/ui/missions.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/art.js', 'js/fx.js',
  'art/ui/frame.png',
  // 창 안 아이콘. 한 장씩 따로 보므로 빠져도 그 자리만 글자로 남는다.
  'art/icon/pet-0.png', 'art/icon/pet-1.png', 'art/icon/pet-2.png', 'art/icon/pet-3.png',
  'art/icon/pet-4.png', 'art/icon/pet-5.png', 'art/icon/pet-6.png', 'art/icon/pet-7.png',
  'art/icon/relic-0.png', 'art/icon/relic-1.png', 'art/icon/relic-2.png', 'art/icon/relic-3.png',
  'art/icon/relic-4.png', 'art/icon/relic-5.png', 'art/icon/relic-6.png', 'art/icon/relic-7.png',
  'art/icon/up-0.png', 'art/icon/up-1.png', 'art/icon/up-2.png', 'art/icon/up-3.png',
  'art/icon/up-4.png', 'art/icon/up-5.png',
  // 지역 바닥. 카메라를 따라 흐르는 타일이라 투명이 필요 없어 JPEG다.
  'art/zone/zone-0.jpg', 'art/zone/zone-1.jpg', 'art/zone/zone-2.jpg', 'art/zone/zone-3.jpg',
  'art/zone/zone-4.jpg', 'art/zone/zone-5.jpg', 'art/zone/zone-6.jpg', 'art/zone/zone-7.jpg',

  // 무공 빛. 흑백 마스크를 코드에서 물들여 쓴다.
  'art/fx/fx-aura.png', 'art/fx/fx-beam.png', 'art/fx/fx-blink.png',
  'art/fx/fx-bolt.png', 'art/fx/fx-burst.png', 'art/fx/fx-field.png',
  'art/fx/fx-ring.png', 'art/fx/fx-slash.png', 'art/fx/fx-swirl.png',
  // 사람 그림 조각. 한 장이라도 빠지면 전부 벡터로 떨어지므로 같이 받아 둔다.
  'art/hero/body-black.png', 'art/hero/body-blue.png', 'art/hero/body-brown.png', 'art/hero/body-dark.png',
  'art/hero/body-r0.png', 'art/hero/body-r1.png', 'art/hero/body-r2.png', 'art/hero/body-r3.png',
  'art/hero/body-r4.png', 'art/hero/body-r5.png', 'art/hero/body-r6.png', 'art/hero/body-r7.png',
  'art/hero/body-r8.png', 'art/hero/body-r9.png', 'art/hero/body-red.png', 'art/hero/body-white.png',
  'art/hero/head-bald.png', 'art/hero/head-band.png', 'art/hero/head-hat.png', 'art/hero/head-hood.png',
  'art/hero/head-topknot.png', 'art/hero/head.png', 'art/hero/wp-axe.png', 'art/hero/wp-claw.png',
  'art/hero/wp-dagger.png', 'art/hero/wp-fist.png', 'art/hero/wp-saber.png', 'art/hero/wp-spear.png',
  'art/hero/wp-sword.png',
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
  // navigate 요청은 new Request(e.request, init)이 예외를 내므로 **주소로 새로 만든다**.
  // 전에는 그냥 흘려보냈는데, 그러면 브라우저 HTTP 캐시가 옛 index.html을
  // 돌려줘서 배포해도 기기에는 반영이 안 됐다. 그림도 창 머리의 은자도
  // 배포본에는 있는데 기기에서는 안 보이던 이유다.
  const req = e.request.mode === 'navigate'
    ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(e.request, { cache: 'no-cache' });
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
