// v487 새 시즌 미리보기 화면 점검 — s2.html: 무인 고르기 → 사냥 → 창·탭 전부 열기 → 뽑기 → 방치 보상 · 콘솔 오류 0 · 단추 화면 안
//   NO_PROXY=127.0.0.1,localhost node tests/s2ui.cjs   (tests/all.sh가 http 서버를 띄운다)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path'); const fs = require('fs');
const BASE = (process.env.BASE || 'http://127.0.0.1:8123/') + 's2.html';
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m, x = '') => { console.log(`  ${c ? '✓' : '✗ !!'} ${m}${x !== '' ? ` (${x})` : ''}`); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [W, H] of [[360, 740], [430, 932]]) {
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    console.log(`— ${W}×${H}`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#pop.open');
    ok((await page.$$('#pop .btn')).length === 5, '무인 고르기 — 직업 다섯');
    await page.click('#pop .btn >> nth=0');
    await page.waitForTimeout(7000);
    const g0 = await page.evaluate(() => ({ kills: window.__s2.g.S.kills, lv: window.__s2.g.S.hero.lv }));
    ok(g0.kills > 0, '저절로 사냥한다', `처치 ${g0.kills}`);
    ok(/Lv \d+/.test(await page.textContent('#tl')), '왼쪽 위: 레벨 · 전투력');
    ok(/길잡이 1/.test(await page.textContent('#bl')), '왼쪽 아래: 길잡이 1');
    const navs = await page.$$('nav button');
    ok(navs.length === 5, '아래 메뉴 다섯');
    let tabsSeen = 0; const empty = [], outside = [];
    for (let i = 0; i < navs.length; i++) {
      await page.click(`nav button >> nth=${i}`);
      const n = (await page.$$('#wtabs button')).length;
      for (let t = 0; t < n; t++) {
        await page.click(`#wtabs button >> nth=${t}`);
        tabsSeen++;
        const name = `${await page.textContent('#wt')}/${await page.textContent(`#wtabs button >> nth=${t}`)}`;
        if (!(await page.$$('#wb > *')).length) empty.push(name);
        if (/undefined|NaN|null/.test(await page.textContent('#wb'))) empty.push(`${name}:글자`);
        for (const bt of await page.$$('#wb button')) { const r = await bt.boundingBox(); if (r && (r.x < 0 || r.x + r.width > W + 1)) outside.push(name); }
      }
    }
    ok(tabsSeen >= 20, '창 탭 전부 열어 봄', tabsSeen);
    ok(empty.length === 0, '빈 창 · 이상한 글자 없음', empty.join(' '));
    ok(outside.length === 0, '단추가 화면 안', [...new Set(outside)].join(' '));
    await page.click('nav button >> nth=1'); await page.click('#wtabs button >> nth=1');
    const t0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
    await page.click('#wb .row:nth-child(4) .btn');
    const t1 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
    ok(t0 - t1 === 10, '장비 10번 뽑기 — 뽑기권 10장', `${t0} → ${t1}`);
    await page.click('#wx');
    ok(!(await page.isVisible('#win')), '창 닫기');
    await page.screenshot({ path: path.join(OUT, `s2ui-${W}.png`) });
    // 방치: 마지막 접속을 3시간 전으로 돌려 저장 → 다시 열면 방치 보상 창
    await page.evaluate(() => { const g = window.__s2.g; g.S.offline.lastSeen -= 3 * 3600e3; g.S.offline.clockMax -= 3 * 3600e3; localStorage.setItem('ifu.s2.save', g.save()); window.__s2.freeze(); });
    await page.close();
    const p2 = await ctx.newPage();
    p2.on('pageerror', (e) => errs.push(e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#pop.open');
    ok(/방치 보상/.test(await p2.textContent('#pc')), '3시간 뒤 다시 열면 방치 보상 창');
    const lv0 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    await p2.click('#pop .btn >> nth=1');
    const lv1 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    ok(lv1 > lv0, '광고 ×2로 받기 → 레벨이 오른다', `${lv0} → ${lv1}`);
    ok(errs.length === 0, '콘솔 오류 없음', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n✗ ${fails}건` : '\n✓ 새 시즌 화면 전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
