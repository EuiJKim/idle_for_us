// 앱 껍데기를 캐시해 오프라인에서도 열리게 한다. 온라인이면 항상 새 파일을 먼저 받는다.
const CACHE = 'ifu-v112';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/big.js', 'js/data.js', 'js/battle.js', 'js/net.js', 'js/fmt.js', 'js/firebase-config.js',
  'js/ui/common.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/art.js', 'js/fx.js', 'js/icons.js', 'js/ads.js', 'js/pose.js', 'js/skillfx.js', 'js/skillfx_class.js', 'js/world/wdata.js', 'js/world/wgame.js', 'js/wui.js', 'js/wnet.js', 'js/wmain.js', 'js/sfx.js',
  'art/ui/frame.png',
  // 창 안 아이콘. 한 장씩 따로 보므로 빠져도 그 자리만 글자로 남는다.
  'art/icon/acc-0.png', 'art/icon/acc-1.png', 'art/icon/acc-2.png', 'art/icon/codex-0.png',
  'art/icon/codex-1.png', 'art/icon/codex-2.png', 'art/icon/dg-0.png', 'art/icon/dg-1.png',
  'art/icon/dg-2.png', 'art/icon/dg-3.png', 'art/icon/ego-0.png', 'art/icon/ego-1.png',
  'art/icon/eqarmor-0.png', 'art/icon/eqarmor-1.png', 'art/icon/eqarmor-2.png', 'art/icon/eqarmor-3.png',
  'art/icon/eqarmor-4.png', 'art/icon/eqarmor-5.png', 'art/icon/eqring-0.png', 'art/icon/eqring-1.png',
  'art/icon/eqring-2.png', 'art/icon/eqring-3.png', 'art/icon/eqring-4.png', 'art/icon/eqring-5.png',
  'art/icon/eqweapon-0.png', 'art/icon/eqweapon-1.png', 'art/icon/eqweapon-2.png', 'art/icon/eqweapon-3.png',
  'art/icon/eqweapon-4.png', 'art/icon/eqweapon-5.png', 'art/icon/pet-0.png', 'art/icon/pet-1.png',
  'art/icon/pet-2.png', 'art/icon/pet-3.png', 'art/icon/pet-4.png', 'art/icon/pet-5.png',
  'art/icon/pet-6.png', 'art/icon/pet-7.png', 'art/icon/relic-0.png', 'art/icon/relic-1.png',
  'art/icon/relic-2.png', 'art/icon/relic-3.png', 'art/icon/relic-4.png', 'art/icon/relic-5.png',
  'art/icon/relic-6.png', 'art/icon/relic-7.png', 'art/icon/sp-0.png', 'art/icon/sp-1.png',
  'art/icon/sp-2.png', 'art/icon/sp-3.png', 'art/icon/sp-4.png', 'art/icon/sp-5.png',
  'art/icon/up-0.png', 'art/icon/up-1.png', 'art/icon/up-2.png', 'art/icon/up-3.png',
  'art/icon/up-4.png', 'art/icon/up-5.png',
  'art/icon/up-8.png',
  'art/icon/up-9.png',
  'art/icon/up-10.png',
  'art/icon/up-11.png',
  'art/icon/up-12.png',
  'art/icon/up-13.png',
  'art/icon/up-14.png',
  'art/icon/up-15.png',
  'art/icon/jskill-0.png',
  'art/icon/jskill-1.png',
  'art/icon/jskill-2.png',
  'art/icon/jskill-3.png',
  'art/icon/jskill-4.png',
  'art/icon/jskill-5.png',
  'art/icon/jskill-6.png',
  'art/icon/jskill-7.png',
  'art/icon/jskill-8.png',
  'art/icon/jskill-9.png',
  'art/icon/jskill-10.png',
  'art/icon/jskill-11.png',
  'art/icon/jskill-12.png',
  'art/icon/jskill-13.png',
  'art/icon/jskill-14.png',
  'art/icon/jskill-15.png',
  'art/icon/jskill-16.png',
  'art/icon/jskill-17.png',
  'art/icon/jskill-18.png',
  'art/icon/jskill-19.png',
  'art/icon/jskill-20.png',
  'art/icon/jskill-21.png',
  'art/icon/jskill-22.png',
  'art/icon/jskill-23.png',
  'art/icon/skill-0.png',
  'art/icon/skill-1.png',
  'art/icon/skill-2.png',
  'art/icon/skill-3.png',
  'art/icon/skill-4.png',
  'art/icon/skill-5.png',
  'art/icon/skill-6.png',
  'art/icon/skill-7.png',
  'art/icon/skill-8.png',
  'art/icon/skill-9.png',
  'art/icon/skill-10.png',
  'art/icon/skill-11.png',
  'art/icon/skill-12.png',
  'art/icon/skill-13.png',
  'art/icon/up-7.png',
  'art/icon/up-6.png',
  // 지역 바닥. 카메라를 따라 흐르는 타일이라 투명이 필요 없어 JPEG다.
  'art/zone/zone-0.jpg', 'art/zone/zone-1.jpg', 'art/zone/zone-2.jpg', 'art/zone/zone-3.jpg',
  'art/zone/zone-4.jpg', 'art/zone/zone-5.jpg', 'art/zone/zone-6.jpg', 'art/zone/zone-7.jpg',
  'art/zone/zone-8.jpg',
  'art/zone/zone-9.jpg',
  'art/zone/zone-10.jpg',
  'art/zone/zone-11.jpg',
  'art/zone/zone-12.jpg',
  'art/zone/zone-13.jpg',
  'art/zone/zone-14.jpg',
  'art/zone/zone-15.jpg',

  // 무공 빛. 흑백 마스크를 코드에서 물들여 쓴다.
  'art/fx/fx-aura.png', 'art/fx/fx-beam.png', 'art/fx/fx-blink.png',
  'art/fx/fx-bolt.png', 'art/fx/fx-burst.png', 'art/fx/fx-field.png',
  'art/fx/fx-ring.png', 'art/fx/fx-slash.png', 'art/fx/fx-swirl.png',
  // 사람 그림 조각. 한 장이라도 빠지면 전부 벡터로 떨어지므로 같이 받아 둔다.
  'art/hero/body-black.png', 'art/hero/body-blue.png', 'art/hero/body-brown.png', 'art/hero/body-dark.png',
  'art/hero/body-o0.png', 'art/hero/body-o1.png', 'art/hero/body-o2.png', 'art/hero/body-o3.png',
  'art/hero/body-o4.png', 'art/hero/body-o5.png', 'art/hero/body-r0.png', 'art/hero/body-r1.png',
  'art/hero/body-r2.png', 'art/hero/body-r3.png', 'art/hero/body-r4.png', 'art/hero/body-r5.png',
  'art/hero/body-r6.png', 'art/hero/body-r7.png', 'art/hero/body-r8.png', 'art/hero/body-r9.png',
  'art/hero/body-red.png', 'art/hero/body-white.png', 'art/hero/head-bald.png', 'art/hero/head-band.png',
  'art/hero/head-hat.png', 'art/hero/head-hood.png', 'art/hero/head-topknot.png', 'art/hero/head.png',
  'art/hero/wp-axe.png', 'art/hero/wp-claw.png', 'art/hero/wp-dagger.png', 'art/hero/wp-fist.png',
  'art/hero/wp-s0.png', 'art/hero/wp-s1.png', 'art/hero/wp-s2.png', 'art/hero/wp-s3.png',
  'art/hero/wp-s4.png', 'art/hero/wp-s5.png', 'art/hero/wp-saber.png', 'art/hero/wp-spear.png',
  'art/hero/wp-sword.png',
];

// **addAll은 하나라도 실패하면 통째로 실패한다.**
// 그러면 새 워커가 영영 설치되지 않고, 기기는 옛 워커에 붙들린 채로 남는다.
// 배포는 멀쩡한데 기기에만 반영이 안 되는 일이 실제로 그래서 났다.
// 한 장씩 따로 담는다 — 한 장이 빠져도 나머지는 담기고 판은 올라간다.
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
    .then(() => self.skipWaiting())
    .catch(() => self.skipWaiting()));   // 캐시를 못 열어도 판은 올린다
});

// 화면에서 '지금 받기'를 누르면 기다리던 워커를 바로 올린다
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
