// v259 오프라인 열기 — 서비스워커를 켠 채 한 번 열어 미리 받기가 끝나면, 페이지가 실제로 불러온 js·css가
// 서비스워커 캐시에 **전부** 있는지 본다(하나라도 빠지면 오프라인으로 열 때 빈 화면이다 — v237 wpath.js).
// (Playwright의 오프라인 흉내는 서비스워커 자신의 요청·브라우저 캐시를 다 막지 못해 '열리나'로는 못 잡는다)
// PLAYWRIGHT=… CHROMIUM=… node tests/offline.cjs   (http://localhost:8123 에서 정적 서버가 돌고 있어야 한다)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const URL0 = process.env.URL || 'http://localhost:8123/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/, (r) => r.abort());
  await p.goto(URL0, { waitUntil: 'load' });
  await p.evaluate(() => navigator.serviceWorker.ready);
  // 미리 받기(install)가 끝날 때까지 — 캐시 칸 수가 더 늘지 않으면
  let last = -1;
  for (let i = 0; i < 60; i++) {
    const n = await p.evaluate(async () => { const ks = await caches.keys(); if (!ks.length) return 0; const c = await caches.open(ks[0]); return (await c.keys()).length; });
    if (n > 50 && n === last) break;
    last = n;
    await sleep(500);
  }
  const res = await p.evaluate(async () => {
    const used = [...new Set(performance.getEntriesByType('resource').map((e) => new URL(e.name))
      .filter((u) => u.origin === location.origin && /\.(js|css)$/.test(u.pathname) && !/sw\.js$/.test(u.pathname)).map((u) => u.pathname))];
    const ks = await caches.keys();
    const c = await caches.open(ks[0]);
    const have = new Set((await c.keys()).map((r) => new URL(r.url).pathname));
    return { used: used.length, missing: used.filter((x) => !have.has(x)) };
  });
  const ok = res.used > 10 && res.missing.length === 0;
  console.log(ok ? `오프라인용 캐시에 쓰는 파일 ${res.used}개가 다 있다 — OK` : `캐시에 빠진 파일: ${res.missing.join(', ') || '(불러온 파일을 못 셌다)'}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
