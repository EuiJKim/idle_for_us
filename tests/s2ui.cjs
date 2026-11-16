// v487 새 시즌 미리보기 화면 점검 — s2.html: 무인 고르기 → 사냥 → 창·탭 전부 열기 → 뽑기 → 방치 보상 · 콘솔 오류 0 · 단추 화면 안
//   NO_PROXY=127.0.0.1,localhost node tests/s2ui.cjs   (tests/all.sh가 http 서버를 띄운다)
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path'); const fs = require('fs');
const BASE = (process.env.BASE || 'http://127.0.0.1:8123/') + 'index.html';   // v524 새 시즌이 첫 화면
const OUT = path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m, x = '') => { console.log(`  ${c ? '✓' : '✗ !!'} ${m}${x !== '' ? ` (${x})` : ''}`); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [W, H] of [[844, 390], [740, 360], [1280, 720], [390, 664]]) {
    // v514 가로 전용 — 세로(390×664)는 손전화(터치)로 열어 화면이 90° 돌아가는지 본다
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(W < H ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());   // v525 계정 연결은 오프라인으로(실제 서버에 손대지 않는다)
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    console.log(`— ${W}×${H}`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden)');
    ok((await page.$$('#modal .btn')).length === 5, '무인 고르기 — 직업 다섯');
    await page.click('#modal .btn >> nth=0');
    await page.waitForTimeout(7000);
    const g0 = await page.evaluate(() => ({ kills: window.__s2.g.S.kills, lv: window.__s2.g.S.hero.lv }));
    ok(g0.kills > 0, '저절로 사냥한다', `처치 ${g0.kills}`);
    ok(/Lv.\d+/.test(await page.textContent('#me-lv')) && /^[\d.,]+[만억]?$/.test(await page.textContent('#pw')) && /HP \S+ \/ \S+/.test(await page.textContent('#hp-txt')) && /EXP [\d.]+%/.test(await page.textContent('#xp-txt')), 'v510 HUD: 위 왼쪽 전투력 · 왼쪽 아래 Lv · HP · 맨 아래 EXP');
    ok(/길잡이 1/.test(await page.textContent('#qc')) && /진행|완료/.test(await page.textContent('#qc .qh')), '왼쪽 길잡이 카드(상태 · 할 일)');
    ok(!(await page.$$eval('.nb i, .ib i', (a) => a.length)) && (await page.$$('.nb .ic')).length === 5 + 3, '메뉴는 그림 아이콘 + 글(한 글자 한자 없음)');
    if (W < H) ok(await page.evaluate(() => document.body.classList.contains('rot') && document.body.classList.contains('land') && document.getElementById('cv').clientWidth > document.getElementById('cv').clientHeight && !document.getElementById('rot')), '세로로 든 손전화 — 화면 전체가 90° 돌아 가로로(세로 배치 없음)');
    if (W > H) {
      // v509 가로 화면: 위 세 덩어리(무인 · 진행 줄 · 창 단추)와 아래 무공 덩어리가 서로 겹치지 않고 화면 안
      const L = await page.evaluate(() => {
        const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
        return { land: document.body.classList.contains('land'), top: r('#tl'), bar: r('#tc'), tabs: r('#tr'), skill: r('#sk'), quest: r('#qc'), me: r('#me'), mb: r('#mb'), W: innerWidth, H: innerHeight };
      });
      const hit = (a, c) => a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1;
      const inside = (a) => a[0] >= 0 && a[1] >= 0 && a[2] <= L.W && a[3] <= L.H;
      ok(L.land && !hit(L.top, L.bar) && !hit(L.bar, L.tabs) && !hit(L.top, L.tabs) && !hit(L.quest, L.top) && !hit(L.me, L.mb) && !hit(L.mb, L.skill) && [L.top, L.bar, L.tabs, L.skill, L.me, L.mb].every(inside), '가로 화면 — 위: 나 · 사냥터 · 아이콘 / 아래: Lv·HP · 메뉴 · 무공 (겹침 없음)', JSON.stringify([L.me, L.mb, L.skill].map((a) => a.map(Math.round))));
    }
    // 손 조작: 수동으로 바꾸고 ◀ 를 누르고 있으면 왼쪽으로 달린다 · 점프 단추
    await page.click('#au');
    ok(await page.evaluate(() => window.__s2.g.S.auto === false), '자동/수동 단추 — 수동으로');
    const h0 = await page.evaluate(() => window.__s2.g.ensureFight().hero.x);
    const pl = await page.$('#pl'); const bb = await pl.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(1000); await page.mouse.up();
    const h1 = await page.evaluate(() => window.__s2.g.ensureFight().hero.x);
    ok(h0 - h1 > 1500, '◀ 누르고 있으면 왼쪽으로 달린다', `${h0} → ${h1}`);
    await page.click('#jp'); await page.waitForTimeout(150);
    ok(await page.evaluate(() => window.__s2.g.ensureFight().hero.vy !== 0 || window.__s2.g.ensureFight().hero.plat !== 0), '점프 단추');
    ok(/Stage \d+\/10/.test(await page.textContent('#sp-txt')) && /\d+\. /.test(await page.textContent('#chap')), '위 가운데: 장 이름 · Stage n/10 진행 막대');
    await page.click('#au');
    ok(await page.evaluate(() => window.__s2.g.S.auto !== false), '다시 자동으로');
    const navs = await page.$$('.nb[data-tab]');
    ok(navs.length === 7 && (await page.$$('#mb .nb')).length === 5, '아래 메뉴 다섯(캐릭터 · 장비 · 무공 · 동료 · 던전) + 위 아이콘(지도 · 임무 · 무림)');
    await page.click('#mb .nb[data-key]'); ok(/캐릭터/.test(await page.textContent('#panel-title')) && /on/.test(await page.getAttribute('#panel-body .subtabs button >> nth=1', 'class')), '「무공」 → 캐릭터 창 무공 칸'); await page.click('#panel-close');
    let tabsSeen = 0; const empty = [], outside = [];
    await page.click('.nb[data-tab] >> nth=0');
    ok((await page.$$('#ptabs button')).length === 7 && await page.evaluate(() => document.getElementById('panel').classList.contains('open')), '아래에서 창이 올라오고 창 머리에 창 줄 일곱');
    for (let i = 0; i < 7; i++) {
      await page.click(`#ptabs button >> nth=${i}`);
      const n = Math.max(1, (await page.$$('#panel-body .subtabs button')).length);
      for (let t = 0; t < n; t++) {
        if (n > 1) await page.click(`#panel-body .subtabs button >> nth=${t}`);
        tabsSeen++;
        const name = `${await page.textContent('#panel-title')}/${n > 1 ? await page.textContent(`#panel-body .subtabs button >> nth=${t}`) : '-'}`;
        if (!(await page.$$('#wb > *')).length) empty.push(name);
        if (/undefined|NaN|null/.test(await page.textContent('#wb'))) empty.push(`${name}:글자`);
        for (const bt of await page.$$('#wb button')) { const r = await bt.boundingBox(); if (r && (W < H ? r.y < 0 || r.y + r.height > H + 1 : r.x < 0 || r.x + r.width > W + 1)) outside.push(name); /* 돌린 화면이면 게임의 가로 = 기기의 세로 */ }
      }
    }
    ok(tabsSeen >= 24, '창 탭 전부 열어 봄', tabsSeen);
    ok(empty.length === 0, '빈 창 · 이상한 글자 없음', empty.join(' '));
    ok(outside.length === 0, '단추가 화면 안', [...new Set(outside)].join(' '));
    await page.click('#ptabs button[data-tab="bag"]'); await page.click('#panel-body .subtabs button >> nth=1');
    const t0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
    await page.click('#wb .row:has-text("10번 뽑기") .btn');
    const t1 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
    ok(t0 - t1 === 10, '장비 10번 뽑기 — 뽑기권 10장', `${t0} → ${t1}`);
    await page.waitForSelector('.gx');
    ok((await page.$$('.gx .gc')).length === 10, '뽑기 연출: 카드 10장');
    await page.click('.gx .skip');
    ok((await page.$$('.gx .gc.open')).length === 10, '건너뛰기 → 전부 뒤집힘');
    await page.click('.gx .skip');
    ok(!(await page.$('.gx')), '닫기 → 연출 사라짐');
    await page.click('#panel-close');
    ok(!(await page.evaluate(() => document.getElementById('panel').classList.contains('open'))), '창 닫기');
    await page.click('#b-opt'); ok(/설정/.test(await page.textContent('#panel-title')) && /효과음/.test(await page.textContent('#wb')), '⚙ → 설정 창'); await page.click('#panel-close');
    await page.screenshot({ path: path.join(OUT, `s2ui-${W}.png`) });
    // 방치: 마지막 접속을 3시간 전으로 돌려 저장 → 다시 열면 방치 보상 창
    await page.evaluate(() => { const g = window.__s2.g; g.S.offline.lastSeen -= 3 * 3600e3; g.S.offline.clockMax -= 3 * 3600e3; localStorage.setItem('ifu.s2.save', g.save()); window.__s2.freeze(); });
    await page.close();
    const p2 = await ctx.newPage();
    p2.on('pageerror', (e) => errs.push(e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#modal:not(.hidden)');
    ok(/방치 보상/.test(await p2.textContent('#modal .sheet')), '3시간 뒤 다시 열면 방치 보상 창');
    const lv0 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    await p2.click('#modal .btn >> nth=1');
    const lv1 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    ok(lv1 > lv0, '광고 ×2로 받기 → 레벨이 오른다', `${lv0} → ${lv1}`);
    ok(errs.length === 0, '콘솔 오류 없음', errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `\n✗ ${fails}건` : '\n✓ 새 시즌 화면 전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
