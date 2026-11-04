// v359 모습 자동 점검 — 무인이 나올 수 있는 모든 겉모습(경지 옷 · 의복 · 꾸미기 머리/옷/성별/머리 빛깔/쓰개 · 두목 옷 · 두목 쓰개)을
//   실제 heroLook으로 만들어 그려 보고, 머리+옷 한 장 그림이 아닌 옛 조각으로 그린 것이 하나라도 있으면 실패한다.
//   (v358: 두목 옷만 옛 조각이라 머리·몸 테두리가 깨져 보였다 — 이런 빈칸을 배포 전에 잡는다)
//   NO_PROXY=127.0.0.1,localhost PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=/opt/pw-browsers/chromium node tests/looks.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route(/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/, (r) => r.abort());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.char-card', { timeout: 20000 });
  await page.click('.char-card.empty >> nth=0');
  await page.fill('#modal input', '모습점검'); await page.click('#modal .btn.primary');
  await page.waitForSelector('.class-card'); await page.click('.class-card >> nth=0');
  await page.waitForSelector('#modal .cust-go'); await page.click('#modal .cust-go');
  await page.waitForTimeout(2500);
  const res = await page.evaluate(async () => {
    const W = await import('/js/world/wdata.js');
    const { RANKS } = await import('/js/data.js');
    const B = await import('/js/battle.js');
    const A = await import('/js/art.js');
    const g = window.__game, v = window.__view;
    const looks = [];
    const add = (name, fn) => { const s0 = JSON.stringify({ rank: g.s.rank, outfit: g.s.outfit, custom: g.s.custom }); try { fn(); const { look } = v.heroLook(g, false); looks.push([name, look]); } finally { const o = JSON.parse(s0); g.s.rank = o.rank; g.s.outfit = o.outfit; g.s.custom = o.custom; } };
    // 경지 옷 × (남 · 여)
    for (let r = 0; r < RANKS.length; r++) for (const gender of [null, 'f']) add(`경지${r}/${gender || 'm'}`, () => { g.s.rank = r; g.s.custom = { gender }; });
    // 의복
    for (let o = 0; o < 6; o++) add(`의복${o}`, () => { g.s.outfit = o; g.s.custom = {}; });
    // 꾸미기 — 남자 머리 × 옷 빛깔 · 여자 머리 × 빛깔 × 옷 · 쓰개 · 차림
    const robes = [null, ...W.CUSTOM_ROBES];
    for (const hd of [null, ...W.CUSTOM_HEADS.map((x) => x[0])]) for (const rb of robes) add(`남 ${hd}/${rb}`, () => { g.s.custom = { head: hd, robe: rb }; });
    for (const fh of [null, ...W.CUSTOM_FHEADS.map((x) => x[0])]) for (const hc of W.CUSTOM_HAIRS.map((x) => x[0])) for (const rb of [null, '#8b1f22', '#5b3a7a']) add(`여 ${fh}/${hc}/${rb}`, () => { g.s.custom = { gender: 'f', fhead: fh, hair: hc, robe: rb }; });
    for (const ht of W.CUSTOM_HATS.map((x) => x[0])) for (const gender of [null, 'f']) add(`쓰개 ${ht}/${gender || 'm'}`, () => { g.s.custom = { hat: ht, gender }; });
    for (const p of W.CUSTOM_PRESETS) add(`차림 ${p.name}`, () => { g.s.custom = { head: p.head, hat: p.hat, robe: p.robe, band: p.band, gender: p.gender || null, fhead: p.fhead || null, hair: p.hair || null }; });
    // 두목 옷(흰 도포에 빛깔) · 두목 쓰개 — heroLook이 만드는 것과 같게 덧씌운다
    const extra = [];
    for (const [name, look] of looks.slice(0, 40)) {
      extra.push([`${name}+두목옷`, { ...look, robe: '#3f5f4f', robeTint: '#3f5f4f', outfitBody: undefined }]);
      if (!look.female) for (const hd of ['hat', 'hood', 'band', 'mask']) extra.push([`${name}+두목쓰개${hd}`, { ...look, head: hd === 'band' ? 'topknot' : hd }]);
    }
    looks.push(...extra);
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const c = cv.getContext('2d');
    const drawAll = () => { for (const [, l] of looks) { c.clearRect(0, 0, 200, 200); B.drawFighter(c, 100, 180, l, { t: 0.3, weapon: 'sword', hold: true }); } };
    drawAll();
    // 한 장 그림이 다 올 때까지
    let last = -1;
    for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); drawAll(); const gen = A.mergeGen(); if (gen === last) break; last = gen; }
    const bad = new Map();
    for (const [name, l] of looks) {
      const p0 = B.DRAW_STAT.parts;
      c.clearRect(0, 0, 200, 200); B.drawFighter(c, 100, 180, l, { t: 0.3, weapon: 'sword', hold: true });
      // 탄 모습도
      B.drawFighter(c, 100, 180, l, { t: 0.3, weapon: 'sword', hold: true, ride: true });
      if (B.DRAW_STAT.parts > p0) { const k = B.DRAW_STAT.last; if (!bad.has(k)) bad.set(k, name); }
    }
    return { n: looks.length, bad: [...bad.entries()] };
  });
  console.log(`모습 ${res.n}가지 점검`);
  for (const [k, name] of res.bad) console.log(`  ✗ 옛 조각: ${k}  (예: ${name})`);
  if (errs.length) console.log('오류:', errs.slice(0, 3));
  const ok = !res.bad.length && !errs.length;
  console.log(ok ? 'ALL OK' : `${res.bad.length}가지 한 장 그림 없음`);
  await b.close();
  process.exit(ok ? 0 : 1);
})();
