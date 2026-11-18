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
    // v536 처음 들어오면 출석 창 — 출석 → 도장 → 받기 완료
    await page.waitForSelector('#modal:not(.hidden) .attg', { timeout: 4000 });
    ok((await page.$$('#modal .att')).length === 28 && await page.isVisible('#modal .att.today'), 'v536 출석 창: 28칸 · 오늘 칸');
    await page.click('#modal .btn:has-text("출석")'); await page.waitForTimeout(500);
    ok(await page.isVisible('#modal .att.stamp .seal') && await page.evaluate(() => !window.__s2.g.canAttend()), 'v536 출석 → 도장 · 오늘은 끝');
    await page.click('#att-ok');
    await page.waitForTimeout(6000);
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
    const h0 = await page.evaluate(() => { const F = window.__s2.g.ensureFight(); F.hero.x = Math.max(F.hero.x, Math.round(F.def.map.w / 2)); return F.hero.x; });   // v569 왼쪽 벽 가까이서 시작하면 덜 달려 흔들렸다 → 가운데 넘어서 시작
    const pl = await page.$('#pl'); const bb = await pl.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.waitForTimeout(1000); await page.mouse.up();
    const h1 = await page.evaluate(() => window.__s2.g.ensureFight().hero.x);
    ok(h0 - h1 > 1500, '◀ 누르고 있으면 왼쪽으로 달린다', `${h0} → ${h1}`);
    await page.click('#jp'); await page.waitForTimeout(150);
    ok(await page.evaluate(() => window.__s2.g.ensureFight().hero.vy !== 0 || window.__s2.g.ensureFight().hero.plat !== 0), '점프 단추');
    ok(/Stage \d+\/10/.test(await page.textContent('#sp-txt')) && /\d+\. /.test(await page.textContent('#chap')), '위 가운데: 장 이름 · Stage n/10 진행 막대');
    await page.click('#au');
    ok(await page.evaluate(() => window.__s2.g.S.auto !== false), '다시 자동으로');
    // v528 낀 장비를 누르면 강화 창 — 오르는 스탯(지금 → 성공하면) · 필요한 것 / 가진 것 · 눌러도 창이 남는다
    await page.evaluate(() => { const g = window.__s2.g; g.S.wallet.gold += 1e8; g.S.wallet['item:stone'] = 5000; if (!g.S.gear.eq.weapon) { g.pullGear(10); } });
    await page.click('#mb .nb[data-tab="bag"]'); await page.waitForTimeout(300);
    const cell = await page.$('.eqcell:not(.empty)');
    if (cell) {
      await cell.click(); await page.waitForSelector('#modal:not(.hidden) .enh2');
      ok((await page.$$('#modal .enh2 .need-r')).length >= 2 && /가진 것/.test(await page.textContent('#modal .enh2')) && (await page.$$('#modal .enh2 .cmp-r')).length > 0, 'v528 낀 장비 누르면 강화 창: 오르는 스탯 · 필요한 것/가진 것(은자 · 강화석)');
      const e0 = await page.evaluate(() => { const g = window.__s2.g; return Object.values(g.S.gear.slots).reduce((a, s) => a + s.enh, 0); });
      await page.click('#ep-e5'); await page.waitForTimeout(200);
      const e1 = await page.evaluate(() => { const g = window.__s2.g; return Object.values(g.S.gear.slots).reduce((a, s) => a + s.enh, 0); });
      ok(e1 > e0 && await page.isVisible('#modal .enh2'), 'v528 5번 강화 → 단계가 오르고 창은 그대로', `${e0} → ${e1}`);
      ok(await page.isVisible('#modal .forge'), 'v531 강화 연출(대장간)이 뜬다');
      const skipFx = () => page.evaluate(() => document.querySelector('#modal .forge')?.click());   // 움직이는 연출이라 바로 누른다
      await skipFx(); await page.waitForTimeout(150); await skipFx(); await page.waitForTimeout(100);
      ok(!(await page.isVisible('#modal .forge')) && await page.isVisible('#modal .enh2'), 'v531 연출은 눌러 건너뛰고 강화 창으로');
      await page.click('#ep-close'); ok(await page.isHidden('#modal'), '닫기');
      await page.click('#panel-close');
    }
    // v531 실제 던전 — 수련동 「입장」 → 사냥터 대신 던전(위에 목표 · 남은 시간 · 나가기) → 나가기 → 결과 창
    await page.evaluate(() => { const g = window.__s2.g; for (let i = 0; i < 400 && g.S.hero.lv < 35; i++) g.addExp(Math.max(2e4, (window.__s2.need?.(g.S.hero.lv)) || 2e5)); if (g.bossFight) g.endChallenge(false); g.dirtyStats = true; });
    await page.click('#mb .nb[data-tab="dgn"]'); await page.waitForTimeout(200);
    await page.click('#wb .row:has-text("수련장") .btn:has-text("입장")'); await page.waitForTimeout(600);
    ok(await page.evaluate(() => !!window.__s2.g.dg) && await page.isVisible('#contest-hud.dg') && /남은 \d+초/.test(await page.textContent('#contest-sub')) && /던전/.test(await page.textContent('#sp-txt')), 'v531 던전 입장: 위에 목표 · 남은 시간', await page.textContent('#contest-sub'));
    page.once('dialog', (d) => d.accept());
    await page.click('#dg-leave'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !window.__s2.g.dg) && await page.isVisible('#res.open'), 'v531 나가기 → 결과 창');
    await page.click('#rout'); await page.waitForTimeout(200);
    // v532 장 두목 — 10칸 두목 도전: 등장 컷(그림 · 이름 · 칭호) · 위 막대 세 줄(×3) · 무력화 게이지
    await page.evaluate(() => { const g = window.__s2.g, T = g.stage(); T.idx = 10; T.top = Math.max(T.top, 10); T.kills = 20; T.auto = false; g.challenge(); });
    await page.waitForTimeout(400);
    ok(await page.isVisible('.chbin') && /장 두목/.test(await page.textContent('.chbin')), 'v532 장 두목 등장 컷');
    await page.waitForTimeout(1900);
    ok(await page.isVisible('#contest-hud.chb') && /×3/.test(await page.textContent('#contest-pct')) && await page.isVisible('#cb-ggb'), 'v532 장 두목 막대 세 줄 · 무력화 게이지', await page.textContent('#contest-pct'));
    { const vis = await page.isVisible('#ds'), d = await page.evaluate(() => { const F = window.__s2.g.bossFight, H = F.hero; F.press({ auto: false }); H.x = 6000; const x0 = H.x; window.__s2.g.dash(); for (let i = 0; i < 8; i++) F.step(); F.press({ auto: true }); return Math.abs(H.x - x0); });
      ok(vis && d >= 2500, 'v546 두목전: 회피 단추 · 누르면 3미터', `보임 ${vis} · ${d}mm`); }
    await page.evaluate(() => { const g = window.__s2.g; g.endChallenge(false); g.stage().auto = true; });
    await page.waitForTimeout(500); if (await page.isVisible('#res.open')) await page.click('#rout');
    // v541 장 두목 토벌 — 던전 → 토벌 「토벌」 → 장 두목 싸움(칸 진행 그대로) → 이기면 별 결과
    await page.evaluate(() => { const g = window.__s2.g; g.S.chb = { ...(g.S.chb || {}), 1: 1 }; g.stage().auto = false; });
    await page.click('#mb .nb[data-tab="dgn"]'); await page.waitForTimeout(200);
    await page.click('#panel-body .subtabs button:has-text("토벌")'); await page.waitForTimeout(200);
    ok(/오늘 2 \/ 2번/.test(await page.textContent('#panel-body')) && await page.isVisible('#wb .rdrow'), 'v541 토벌 목록(남은 횟수 · 깬 두목)');
    await page.click('#wb .rdrow .btn:has-text("토벌")'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => !!window.__s2.g.bossFight?.def.raid) && await page.isVisible('.chbin'), 'v541 토벌 시작 — 등장 컷');
    await page.evaluate(() => { window.__s2.g.endChallenge(true); });
    await page.waitForTimeout(1600);
    ok(await page.isVisible('#res.open .rdstars') && (await page.$$('#res .rdstars i.on')).length === 3, 'v541 토벌 결과 — 별 셋');
    await page.click('#rout'); await page.waitForTimeout(200);
    await page.evaluate(() => { window.__s2.g.stage().auto = true; });
    // v558 동료 뽑기 — 카드 뒤집기 창
    await page.evaluate(() => { window.__s2.g.S.wallet['ticket:pal'] = 20; });
    await page.click('#mb .nb[data-tab="comp"]'); await page.waitForTimeout(200);
    await page.click('#panel-body .subtabs button:has-text("동료")'); await page.waitForTimeout(200);
    await page.click('#wb .row .btn:has-text("10번")'); await page.waitForTimeout(400);
    ok(await page.isVisible('.gx') && (await page.$$('.gx .gc')).length === 10 && /동료 뽑기 10번/.test(await page.textContent('.gx .gxt')), 'v558 동료 뽑기 10번 → 카드 뒤집기 창');
    await page.click('.gx .skip'); await page.waitForTimeout(200); await page.click('.gx .skip'); await page.waitForTimeout(200);
    await page.click('#panel-close').catch(() => {});
    // v560 업데이트 소식 — 새로 시작한 무인은 볼 것 없음 · 옛 판 세이브면 들어올 때 한 번
    ok(await page.evaluate(() => window.__s2.g.S.newsV >= 560), 'v560 새로 시작하면 소식 없음(지금 판)');
    await page.evaluate(() => { window.__s2.g.S.newsV = 540; window.__s2.newsCheck(); }); await page.waitForTimeout(1500);
    ok(/새로 생긴 것/.test(await page.textContent('#modal')) && (await page.$$('#modal .news-i')).length >= 5 && await page.evaluate(() => window.__s2.g.S.newsV >= 560), 'v560 옛 판이면 새로 생긴 것 창 · 본 뒤 지금 판으로');
    await page.click('#modal .btn:has-text("확인")'); await page.waitForTimeout(200);
    // v578 절전 — 오래 손대지 않으면 어둡게 · 누르면 돌아옴(사냥은 그대로)
    await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); window.__s2.saverTest(); }); await page.waitForTimeout(600);
    const k0 = await page.evaluate(() => window.__s2.g.S.kills);
    ok(await page.isVisible('#saver'), 'v578 오래 손대지 않으면 절전 화면');
    await page.waitForTimeout(2500); const k1 = await page.evaluate(() => window.__s2.g.S.kills);
    await page.mouse.click(5, 200); await page.waitForTimeout(300);
    ok(!(await page.isVisible('#saver')) && k1 >= k0, 'v578 누르면 돌아옴 · 절전 중에도 사냥', `${k0} → ${k1}`);
    // v584 길잡이를 다 끝내면 왼쪽 칸에 오늘 할 일 다음 것 · 누르면 그 창
    { const saved = await page.evaluate(() => JSON.stringify(window.__s2.g.S.q.guide));
      await page.evaluate(() => { const G = window.__s2.g.S.q.guide; for (const k of Object.keys(G)) { G[k].done = true; G[k].got = true; } for (let i = 1; i <= 40; i++) G[`g${i}`] = { p: 99, done: true, got: true }; window.__s2.g.S.gChk = -1; });
      await page.waitForTimeout(500);
      ok(/오늘 할 일/.test(await page.textContent('#qc')) && !(await page.getAttribute('#qc', 'class') || '').includes('hidden'), 'v584 길잡이 끝 → 오늘 할 일 다음 것', await page.textContent('#qc'));
      if (await page.isVisible('#qc')) { await page.click('#qc'); await page.waitForTimeout(300); ok(await page.isVisible('#panel.open'), 'v584 누르면 그 창'); await page.click('#panel-close').catch(() => {}); }
      await page.evaluate((sv) => { window.__s2.g.S.q.guide = JSON.parse(sv); }, saved); await page.waitForTimeout(300); }
    // v544 오늘 할 일 — 임무 → 오늘: 줄 여덟 · 「가기」→ 그 창
    await page.click('#mb .nb[data-tab="town"], .ib[data-tab="town"], [data-tab="town"] >> nth=0'); await page.waitForTimeout(200);
    await page.click('#panel-body .subtabs button:has-text("오늘")'); await page.waitForTimeout(200);
    ok((await page.$$('#wb .td-row')).length === 9 && /오늘 할 일/.test(await page.textContent('#panel-body')), 'v544 오늘 할 일 — 아홉 줄(v549 문파 출석)');
    ok(await page.isVisible('#wb .td-chest') && /개 더 하면 열려요/.test(await page.textContent('#wb .td-chest')), 'v545 하루 상자(아직 잠김)');
    await page.click('#wb .td-row:has-text("대결") .btn:has-text("가기")'); await page.waitForTimeout(200);
    ok(/대결 점수/.test(await page.textContent('#panel-body')), 'v544 「가기」 → 대결 창');
    await page.click('#panel-close').catch(() => {}); await page.waitForTimeout(200);
    // v543 모두 강화 — 장비 → 강화·성혼 「모두 강화」 → 결과 창(칸마다 전 → 후)
    await page.evaluate(() => { const W = window.__s2.g.S.wallet; W.gold = 1e9; W['item:stone'] = 2000; });
    await page.click('#mb .nb[data-tab="bag"]'); await page.waitForTimeout(200);
    await page.click('#panel-body .subtabs button:has-text("강화")'); await page.waitForTimeout(200);
    const e0 = await page.evaluate(() => Object.values(window.__s2.g.S.gear.slots).reduce((a, x) => a + x.enh, 0));
    await page.click('#wb .row:has-text("모두 강화") .btn:has-text("모두 강화")'); await page.waitForTimeout(500);
    const e1 = await page.evaluate(() => Object.values(window.__s2.g.S.gear.slots).reduce((a, x) => a + x.enh, 0));
    ok(e1 > e0 && await page.isVisible('#modal .ea-list') && (await page.$$('#modal .ea-r')).length > 0, 'v543 모두 강화 → 결과 창', `${e0} → ${e1}`);
    await page.click('#modal .btn:has-text("확인")'); await page.waitForTimeout(200);
    await page.click('#panel-close').catch(() => {});
    // v535 월드보스 — 무림 → 월드보스 「도전」 → 실제 싸움(위에 피해 · 점수 · 남은 시간) → 나가기 → WORLD BOSS 결과
    await page.click('.nb[data-tab="social"]'); await page.waitForTimeout(250);
    await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); g.stage().auto = false; window.__s2.g.dirtyStats = true; });   // v558 시험이 길어져 칸 두목 자동 도전이 끼면 「다른 싸움 중」
    await page.waitForTimeout(300); if (await page.isVisible('#res.open')) await page.click('#rout');
    await page.click('#panel-body .subtabs button:has-text("월드보스")'); await page.waitForTimeout(200);   // v547 무림 첫 칸은 서열
    await page.click('#wb .row .btn:has-text("도전")'); await page.waitForTimeout(600);
    ok(await page.evaluate(() => window.__s2.g.dg?.type === 'wboss') && /점수 \d+/.test(await page.textContent('#contest-sub')) && await page.isVisible('.chbin.wb'), 'v535 월드보스 실제 싸움: 등장 컷 · 피해 · 점수', await page.textContent('#contest-sub'));
    await page.waitForTimeout(1600);
    page.once('dialog', (d) => d.accept()); await page.click('#dg-leave'); await page.waitForTimeout(400);
    ok(await page.isVisible('#res.open') && /WORLD BOSS|물러났어요/.test(await page.textContent('#res')), 'v535 나가기 → 월드보스 결과(피해 · 점수)');
    await page.click('#rout'); await page.waitForTimeout(200);
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
