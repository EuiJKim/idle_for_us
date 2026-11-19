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
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(W))) continue;   // 시험을 고칠 때 화면 하나만: ONLY=844
    // v514 가로 전용 — 세로(390×664)는 손전화(터치)로 열어 화면이 90° 돌아가는지 본다
    const ctx = await b.newContext({ viewport: { width: W, height: H }, ...(W < H ? { isMobile: true, hasTouch: true } : {}) });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());   // v525 계정 연결은 오프라인으로(실제 서버에 손대지 않는다)
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    const badArt = [];   // v610 못 불러온 그림(창 줄 아이콘 · 모음 그림 · 장비 그림)
    page.on('response', (r) => { if (r.status() >= 400 && /\/art\/s2\//.test(r.url())) badArt.push(r.url().replace(/^.*\/art\//, '')); });
    // 새 기능 시험 도우미 — until: 조건이 될 때까지 다시 읽기(정해 둔 시간 쉬기 대신) · hold: 두목전을 끝내고 저절로 도전하지 않게(돌려줄 값 = 전 설정) · free: 되돌림
    const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(100); } };
    const hold = async () => { const r = await page.evaluate(() => { const g = window.__s2.g, was = !!g.bossFight; if (was) g.endChallenge(false); const T = g.stage(), a = T.auto; T.auto = false; return { was, a }; }); if (r.was) await page.waitForTimeout(500); if (await page.isVisible('#res.open')) await page.click('#rout').catch(() => {}); return r.a; };
    const free = (a) => page.evaluate((x) => { window.__s2.g.stage().auto = x; }, a);
    const sub = async (name) => { await page.click(`#panel-body .subtabs button:text-is("${name}")`); await page.waitForFunction((n) => document.querySelector('#panel-body .subtabs button.on')?.textContent === n, name); };
    // 지금 열린 창 훑기 — 이상한 글자 · 줄 그림 아이콘(뜬 것 · 깨진 것)
    const scan = () => page.evaluate(async () => {
      const first = document.querySelector('#wb .ico.pic img'), t = Date.now();
      while (first && first.isConnected && !first.complete && Date.now() - t < 2000) await new Promise((r) => setTimeout(r, 40));
      const pics = [...document.querySelectorAll('#wb .ico.pic img')], all = [...document.querySelectorAll('#wb img')];
      return { txt: (/undefined|NaN|null|\[object Object\]/.exec(document.getElementById('wb').textContent) || [''])[0], n: pics.length, up: pics.filter((i) => i.complete && i.naturalWidth > 0).length, bad: all.filter((i) => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')) };
    });
    console.log(`— ${W}×${H}`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden)');
    ok((await page.$$('#modal .btn')).length === 5, '무인 고르기 — 직업 다섯');
    { const jp = await page.evaluate(() => ({ h: document.querySelector('#modal h2')?.textContent, title: document.title, tags: [...document.querySelectorAll('#modal .jobcard .jtag')].map((x) => x.textContent), rec: [...document.querySelectorAll('#modal .jobcard .jrec')].map((x) => x.closest('.jobcard').dataset.job), note: document.querySelector('#modal .jp-note')?.textContent || '' }));
      ok(jp.h === jp.title && jp.tags.length === 5 && jp.tags.every((t) => /^(근접|원거리) · \S/.test(t)) && jp.rec.length === 1 && /바꿀 수 없어요/.test(jp.note), 'v614 첫 화면 — 게임 이름 · 역할 꼬리표 다섯 · 추천 하나 · 직업 못 바꿈 안내', `${jp.h} · ${jp.rec} · ${jp.tags.join('/')}`); }
    await page.click('#modal .btn >> nth=0');
    // v614 무인을 막 고른 판은 출석 창을 띄우지 않는다(임무 빨간 점 · 출석 칸으로) · 길 안내는 자동 시험에선 안 뜸(아래 따로)
    await page.waitForTimeout(1500);
    ok(await page.evaluate(() => document.getElementById('modal').classList.contains('hidden') && !document.querySelector('#coach') && window.__s2.g.canAttend() && document.querySelector('.nb[data-tab="town"]').classList.contains('dot-on')), 'v614 첫 판 — 출석 창 없이 바로 들판 · 임무에 빨간 점');
    // v536 출석 창 — 출석 → 도장 → 받기 완료(v614 첫 판은 저절로 안 뜨니 직접 연다)
    await page.evaluate(() => window.__s2.attendPop());
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
    // v604 「다음에 열리는 것」 칩(#nx) — 낮은 레벨이면 보이고 「다음 ○○ · Lv n (지금 Lv m)」 · 누르면 그 창
    { const a0 = await hold();
      const nx = await until(() => page.evaluate(() => { const e = document.getElementById('nx'), lv = window.__s2.g.S.hero.lv; return { vis: !e.classList.contains('hidden') && e.offsetHeight > 0, t: e.textContent, go: e.dataset.go || '', lv, now: e.textContent.includes(`지금 Lv ${lv})`), bar: parseFloat(e.querySelector('.nxb i')?.style.width || '-1') }; }), (v) => v.vis && !!v.go && v.now);
      const need = +(/· Lv (\d+)/.exec(nx.t) || [])[1] || 0;
      ok(nx.vis && /^다음/.test(nx.t) && need > nx.lv && nx.now && nx.bar >= 0 && nx.bar <= 100, 'v604 다음에 열리는 것 칩 — 보임 · 「다음 ○○ · Lv n (지금 Lv m)」 · 진행 막대', `${nx.t} · 막대 ${nx.bar}%`);
      await page.click('#nx');
      const want = { 'content:0': 'dgn:0', 'hero:3': 'char:4', 'hero:2': 'char:3' }[nx.go];
      const at = await until(() => page.evaluate(() => ({ open: document.getElementById('panel').classList.contains('open'), key: document.getElementById('panel-body').dataset.key, title: document.getElementById('panel-title').textContent, on: document.querySelector('#panel-body .subtabs button.on')?.textContent })), (v) => v.open);
      ok(at.open && !!want && at.key === want, 'v604 칩을 누르면 그것이 열리는 창', `${nx.go} → ${at.title}/${at.on}`);
      await page.click('#panel-close'); await free(a0); }
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
    { const h = await page.evaluate(() => ({ boss: document.body.classList.contains('bossing'), nx: getComputedStyle(document.getElementById('nx')).display, fc: getComputedStyle(document.getElementById('fc')).display }));
      ok(h.boss && h.nx === 'none' && h.fc === 'none', 'v604 두목전에서는 다음 칩 · 기연 칩이 숨는다', JSON.stringify(h)); }
    { const vis = await page.isVisible('#ds'), d = await page.evaluate(() => { const F = window.__s2.g.bossFight, H = F.hero; F.press({ auto: false }); H.x = 6000; const x0 = H.x; window.__s2.g.dash(); for (let i = 0; i < 8; i++) F.step(); F.press({ auto: true }); return Math.abs(H.x - x0); });
      ok(vis && d >= 2500, 'v546 두목전: 회피 단추 · 누르면 3미터', `보임 ${vis} · ${d}mm`); }
    await page.evaluate(() => { const g = window.__s2.g; g.endChallenge(false); g.stage().auto = true; });
    await page.waitForTimeout(500); if (await page.isVisible('#res.open')) await page.click('#rout');
    { const h = await until(() => page.evaluate(() => { const nx = document.getElementById('nx'); return { boss: document.body.classList.contains('bossing'), fc: getComputedStyle(document.getElementById('fc')).display, nx: getComputedStyle(nx).display, nxOff: nx.classList.contains('hidden') }; }), (v) => !v.boss && v.fc !== 'none' && (v.nxOff || v.nx !== 'none'));
      ok(!h.boss && h.fc !== 'none' && (h.nxOff || h.nx !== 'none'), 'v604 두목전이 끝나면 두 칩이 돌아온다', JSON.stringify(h)); }
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
    // v586 화면 켜 두기 — 지원하는 브라우저면 화면 꺼짐 막기를 잡는다(설정에서 끄면 놓음)
    { const w = await page.evaluate(async () => {   // 헤드리스는 진짜 잠금을 거절 — 가짜로 바꿔 잡고 놓는지만 본다
        let rel = 0; Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => ({ release: async () => { rel++; }, addEventListener() {} }) } });
        await window.__s2.wakeSync(); const a = window.__s2.wake(); await window.__s2.wakeOpt(false); const b = window.__s2.wake(); await window.__s2.wakeOpt(true);
        return { a, b, rel, c: window.__s2.wake() }; });
      ok(w.a.lock && w.a.want && !w.b.lock && w.rel === 1 && w.c.lock, 'v586 화면 켜 두기 — 잡고 · 설정에서 끄면 놓고 · 켜면 다시', JSON.stringify(w)); }
    // v587 위 「절전」 단추 → 바로 절전 · 절전 중에도 처치 · 은자 · 경험치가 오른다(초당 4번 · 안 그림)
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      const b0 = await page.evaluate(() => { const g = window.__s2.g; return { k: g.S.kills, gold: g.S.wallet.gold, x: g.S.hero.exp + g.S.hero.lv * 1e15 }; });
      await page.click('#b-saver'); await page.waitForTimeout(500);
      ok(await page.isVisible('#saver') && await page.evaluate(() => window.__s2.saverOn()), 'v587 위 절전 단추 → 바로 절전');
      await page.waitForTimeout(6000);
      const b1 = await page.evaluate(() => { const g = window.__s2.g; return { k: g.S.kills, gold: g.S.wallet.gold, x: g.S.hero.exp + g.S.hero.lv * 1e15, txt: document.querySelector('#saver span')?.textContent }; });
      ok(b1.k > b0.k && b1.gold > b0.gold && b1.x > b0.x && /처치 \+/.test(b1.txt || ''), 'v587 절전 중에도 처치 · 은자 · 경험치', JSON.stringify({ b0, b1 }));
      await page.evaluate(() => window.__s2.saverAutoTest(true));   // 진짜 손전화처럼(저절로 켜지기 살림) — 깨운 뒤 바로 다시 절전되던 고장(v586)
      await page.mouse.click(5, 200); await page.waitForTimeout(1800);
      ok(!(await page.isVisible('#saver')) && !(await page.evaluate(() => window.__s2.saverOn())), 'v587 누르면 돌아옴 · 다시 바로 절전되지 않음');
      await page.evaluate(() => window.__s2.saverAutoTest(false)); }
    // v602 창 빈 자리 채우기 — 가로 화면이면 카드 둘이 좌우로 나뉜다(전엔 왼쪽에만 쌓임)
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      await page.click('.nb[data-tab="comp"]'); await page.waitForTimeout(500);
      const lay = await page.evaluate(() => ({ wide: document.documentElement.classList.contains('w640up') && document.body.classList.contains('land'), xs: [...document.querySelectorAll('#wb > .card')].map((k) => k.offsetLeft) }));   // 돌린 화면(세로 폰)에서도 맞게 배치 좌표로
      ok(!lay.wide || (lay.xs.length >= 2 && lay.xs[1] > lay.xs[0] + 50), 'v602 가로 화면 — 카드 둘이 좌우로', JSON.stringify(lay));
      const cg = await page.evaluate(() => ({ n: document.querySelectorAll('#wb .coll-tile').length, no: document.querySelectorAll('#wb .coll-tile.no').length, t: document.querySelector('#wb .coll-tile b')?.textContent, own: Object.keys(window.__s2.g.S.colls.weapon.own).length }));
      ok(cg.n === 20 && cg.no === 20 - cg.own && cg.t === '천뢰신검', 'v603 병기 모음 격자 — 스무 칸 · 없는 것은 흐리게 · 이름', JSON.stringify(cg));
      await page.click('#panel-close'); await page.waitForTimeout(200); }
    // ── v604~v610 새 기능 화면 시험 — 칸마다 손댄 것(지갑 · 기연 · 스탯 점수 · 상점 · 동행)은 되돌리고 창을 닫는다 ──
    // v604 기연 — 칩(#fc)은 찬 만큼 % · 차면 「고르기」 → 카드 셋 · 닫았다 열어도 같은 카드 · 고르면 받고 닫힘 · 남은 것이 있으면 다음 카드
    { const a0 = await hold(); const got = [];
      const sv = await page.evaluate(() => { const g = window.__s2.g, s = JSON.stringify(g.fate()); Object.assign(g.fate(), { g: Math.floor(g.fateState().need / 2), ready: 0, cards: null }); return s; });
      const chip = () => page.evaluate(() => { const g = window.__s2.g, f = g.fateState(), fc = document.getElementById('fc'); return { t: document.getElementById('fc-n').textContent, w: parseFloat(document.getElementById('fc-fill').style.width), pct: Math.floor((f.g / f.need) * 100), ready: f.ready, on: fc.classList.contains('ready'), vis: fc.offsetHeight > 0 && getComputedStyle(fc).display !== 'none', modal: !document.getElementById('modal').classList.contains('hidden'), cards: [...document.querySelectorAll('#modal .fate-card')].map((b) => b.textContent), left: document.querySelector('#modal .fate-left')?.textContent || '', st: (f.cards || []).map((c) => c.k), n: g.fate().n }; });
      const c0 = await until(chip, (v) => v.vis && !v.on && v.t === `${v.pct}%`);
      ok(c0.vis && !c0.on && c0.t === `${c0.pct}%` && c0.pct >= 50 && c0.pct < 100 && Math.abs(c0.w - c0.pct) <= 1, 'v604 기연 칩 — 찬 만큼 %(막대도)', JSON.stringify({ t: c0.t, w: c0.w }));
      await page.evaluate(() => { const g = window.__s2.g; g.fateKill(g.fateState().need); });
      const c1 = await until(chip, (v) => v.on && v.t === '고르기');
      ok(c1.on && c1.t === '고르기' && c1.ready === 1 && c1.w === 100, 'v604 기연이 차면 칩이 「고르기」', JSON.stringify({ t: c1.t, ready: c1.ready }));
      await page.click('#fc'); await page.waitForSelector('#modal:not(.hidden) .fate-card');
      const c2 = await chip();
      ok(c2.cards.length === 3 && c2.st.length === 3 && new Set(c2.st).size === 3 && c2.left === '' && c2.cards.every((t) => /[+×]/.test(t)), 'v604 칩을 누르면 카드 셋(서로 다른 것 · 양이 적힘)', c2.cards.join(' | '));
      await page.waitForTimeout(400); await page.mouse.click(4, 4);   // 고르지 않고 바깥을 눌러 닫기
      const c3 = await until(chip, (v) => !v.modal);
      await page.click('#fc'); await page.waitForSelector('#modal:not(.hidden) .fate-card');
      const c4 = await chip();
      ok(!c3.modal && c3.ready === 1 && c3.on && c4.cards.join('|') === c2.cards.join('|'), 'v604 닫았다 다시 열어도 같은 카드(다시 굴리지 않음)', c4.cards.join(' | '));
      // 고르기 — 경험치가 아닌 카드(지갑으로 바로 셀 수 있는 것)
      const pick = async () => {
        const p = await page.evaluate(() => { const g = window.__s2.g, cs = g.fateState().cards, i = cs.findIndex((c) => c.k !== 'exp'); return { i, k: cs[i].k, n: cs[i].n, w: g.S.wallet[cs[i].k] || 0 }; });
        await page.click(`#modal .fate-card >> nth=${p.i}`);
        return { ...p, toast: await until(() => page.evaluate(() => [...document.querySelectorAll('#toast .toast')].map((x) => x.textContent).filter((x) => x.startsWith('기연 — ')).pop() || ''), (v) => !!v, 2000), w1: await page.evaluate((k) => window.__s2.g.S.wallet[k] || 0, p.k) };
      };
      const p1 = await pick(); got.push(p1);
      const c5 = await until(chip, (v) => !v.modal && !v.on);
      ok(p1.w1 - p1.w >= p1.n && (p1.k === 'gold' || p1.w1 - p1.w === p1.n) && !c5.modal && c5.ready === 0 && !c5.on && /^\d+%$/.test(c5.t) && c5.n === c4.n + 1 && !!p1.toast, 'v604 카드를 고르면 그만큼 받고 창이 닫힌다 · 칩은 다시 %', `${p1.k} +${p1.n} · ${p1.toast}`);
      // 둘이 쌓였으면 — 「고르기 2」 · 창에 「남은 기연 1번」 · 하나 고르면 다음 카드가 바로
      await page.evaluate(() => { Object.assign(window.__s2.g.fate(), { ready: 2, cards: null }); });
      const c6 = await until(chip, (v) => v.t === '고르기 2');
      await page.click('#fc'); await page.waitForSelector('#modal:not(.hidden) .fate-left');
      const c7 = await chip();
      const p2 = await pick(); got.push(p2);
      const c8 = await until(chip, (v) => v.modal && v.ready === 1 && v.cards.length === 3 && v.left === '' && v.st.length === 3);
      ok(c6.t === '고르기 2' && /남은 기연 1번/.test(c7.left) && c8.modal && c8.ready === 1 && c8.cards.length === 3 && c8.left === '' && p2.w1 - p2.w >= p2.n, 'v604 둘이 쌓이면 「고르기 2」 · 하나 고르면 다음 카드 창', `${c6.t} · ${c7.left} → ${c8.cards.join(' | ')}`);
      const p3 = await pick(); got.push(p3);
      const c9 = await until(chip, (v) => !v.modal && v.ready === 0);
      ok(!c9.modal && c9.ready === 0 && !c9.on && p3.w1 - p3.w >= p3.n, 'v604 마지막 것을 고르면 닫히고 칩은 %로', c9.t);
      await page.evaluate(([s, G]) => { const g = window.__s2.g, W = g.S.wallet; g.S.fate = JSON.parse(s); for (const x of G) W[x.k] = Math.max(0, (W[x.k] || 0) - x.n); }, [sv, got.map((x) => ({ k: x.k, n: x.n }))]);
      await free(a0); }
    // v604 스탯 배분 — 캐릭터 → 스탯: 남은 점수 = 레벨 − 1 · 「+1」 한 점 · 「고르게 찍기」 전부 · 「되돌리기」 처음으로
    { const a0 = await hold();
      const sv = await page.evaluate(() => { const g = window.__s2.g, s = JSON.stringify(g.hero.spState()); g.statReset(); g.dirtyStats = true; return s; });
      await page.click('#mb .nb[data-tab="char"]'); await page.waitForSelector('#wb .card:has-text("스탯 배분")');
      const SC = '#wb .card:has-text("스탯 배분")', rowOf = (n) => `${SC} .row:has(.name:text-is("${n}"))`;
      const st = () => page.evaluate(() => { const g = window.__s2.g, c = [...document.querySelectorAll('#wb .card')].find((x) => /스탯 배분/.test(x.querySelector('h3')?.textContent || '')), rows = [...(c?.querySelectorAll('.row') || [])], row = (n) => rows.find((r) => r.querySelector('.name')?.textContent === n), btn = (n, i = 0) => row(n)?.querySelectorAll('.btn')[i];
        return { free: +(/남은 점수 (\d+)/.exec(c?.querySelector('h3')?.textContent || '') || [])[1], lv: g.S.hero.lv, pts: g.statPts(), used: g.hero.spUsed(), atk: row('공격')?.querySelector('.desc')?.textContent || '', sum: ['공격', '체력', '방어', '치명 확률'].reduce((a, n) => a + (+(/^(\d+)\//.exec(row(n)?.querySelector('.desc')?.textContent || '') || [])[1] || 0), 0), rows: rows.length, plusOff: !!btn('공격')?.disabled, autoOff: !!btn('고르게 찍기')?.disabled, backOff: !!btn('되돌리기')?.disabled }; });
      const sync = (v) => v.free === v.pts && v.pts + v.used === Math.min(160, v.lv - 1);   // 화면 = 엔진(시험 중에 레벨이 올라도)
      const s0 = await until(st, (v) => sync(v) && v.used === 0);
      ok(sync(s0) && s0.used === 0 && s0.free === s0.lv - 1 && s0.free >= 30 && s0.rows === 6 && /^0\/40점 · \+0\.00%/.test(s0.atk) && !s0.plusOff && !s0.autoOff && s0.backOff, 'v604 스탯 배분 — 남은 점수 = 레벨 − 1 · 찍은 것이 없으면 되돌리기 잠김', `Lv ${s0.lv} · 남은 ${s0.free}`);
      await page.click(`${rowOf('공격')} .btn:text-is("+1")`);
      const s1 = await until(st, (v) => sync(v) && v.used === 1);
      ok(sync(s1) && s1.used === 1 && s1.free === s1.lv - 2 && /^1\/40점 · \+0\.10%/.test(s1.atk) && !s1.backOff, 'v604 「+1」 → 한 점 쓰고 공격 +0.10%', s1.atk);
      await page.click(`${rowOf('고르게 찍기')} .btn`);
      const s2 = await until(st, (v) => sync(v) && v.free === 0);
      ok(sync(s2) && s2.free === 0 && s2.used === s2.lv - 1 && s2.sum === s2.used && s2.autoOff && !s2.backOff, 'v604 「고르게 찍기」 → 남은 점수 0 · 네 스탯 합 = 레벨 − 1', `합 ${s2.sum} · ${s2.atk}`);
      await page.click(`${rowOf('되돌리기')} .btn`);
      const s3 = await until(st, (v) => sync(v) && v.used === 0);
      ok(sync(s3) && s3.used === 0 && s3.free === s3.lv - 1 && s3.sum === 0 && /^0\/40점 · \+0\.00%/.test(s3.atk) && s3.backOff && !s3.autoOff, 'v604 「되돌리기」 → 모두 돌려받음', `남은 ${s3.free}`);
      await page.evaluate((s) => { const g = window.__s2.g; Object.assign(g.hero.spState(), JSON.parse(s)); g.dirtyStats = true; }, sv);
      await page.click('#panel-close'); await free(a0); }
    // v604 장비 뽑기 화면 — 등급 확률 칩(합 100%) · 천장 막대 · 뽑기 칸 셋 / 가방 → 뽑기 조각 45개 「바꾸기」 → 뽑기권 2장 · 5개 남음
    { const a0 = await hold();
      await page.click('#mb .nb[data-tab="bag"]'); await sub('뽑기'); await page.waitForSelector('#wb .gch-tile');
      const gc = await until(() => page.evaluate(() => { const g = window.__s2.g, q = (s) => [...document.querySelectorAll(s)];
        return { odds: q('#wb .gch-odds span').map((x) => x.textContent), sum: q('#wb .gch-odds span').reduce((a, x) => a + parseFloat((/([\d.]+)%/.exec(x.textContent) || [])[1] || 0), 0), pity: document.querySelector('#wb .gch-pl b')?.textContent || '', want: g.S.gacha.pity || 0, bar: parseFloat(document.querySelector('#wb .gch-pity .achbar i')?.style.width || '-1'), sure: document.querySelector('#wb .gch-pl small')?.textContent || '',
          tiles: q('#wb .gch-tile .name').map((x) => x.textContent), main: q('#wb .gch-tile.main .name').map((x) => x.textContent).join(), btns: q('#wb .gch-tile .btn').filter((x) => !x.disabled && x.textContent === '뽑기').length, head: document.querySelector('#wb .gch-hero h3')?.textContent || '', lv: g.S.gacha.lv, imgs: q('#wb .gch-show img').map((i) => i.complete && i.naturalWidth > 0) }; }), (v) => v.imgs.length === 5 && v.imgs.every(Boolean));
      const pm = /^(\d+) \/ (\d+)$/.exec(gc.pity) || [];
      ok(gc.odds.length >= 2 && gc.odds.every((t) => /^\S+[\d.]+%$/.test(t)) && Math.abs(gc.sum - 100) < 0.3, 'v604 장비 뽑기 — 등급 확률 칩(합 100%)', `${gc.odds.join(' ')} = ${gc.sum.toFixed(1)}`);
      ok(+pm[1] === gc.want && +pm[2] > 0 && Math.abs(gc.bar - Math.min(100, (gc.want / +pm[2]) * 100)) < 0.01 && /품 이상 확정/.test(gc.sure), 'v604 장비 뽑기 — 천장 막대(지금 / 끝 · 확정 등급)', `${gc.pity} · ${gc.bar}% · ${gc.sure}`);
      ok(gc.tiles.join() === '1번 뽑기,10번 뽑기,30번 뽑기' && gc.main === '10번 뽑기' && gc.btns === 3 && gc.head.includes(`장비 뽑기 Lv ${gc.lv}`) && gc.imgs.length === 5 && gc.imgs.every(Boolean), 'v604 장비 뽑기 — 뽑기 칸 셋(가운데 10번) · 위 장비 그림 다섯', gc.head);
      const w0 = await page.evaluate(() => { const W = window.__s2.g.S.wallet, o = { sh: W['item:shard'] || 0, tk: W['ticket:gear'] || 0 }; W['item:shard'] = 45; return o; });
      await sub('가방'); const SR = '#wb .row:has(.name:has-text("뽑기 조각"))';
      const sh = () => page.evaluate(() => { const W = window.__s2.g.S.wallet, r = [...document.querySelectorAll('#wb .row')].find((x) => /^뽑기 조각/.test(x.querySelector('.name')?.textContent || '')); return { name: r?.querySelector('.name')?.textContent || '', off: !!r?.querySelector('.btn')?.disabled, sh: W['item:shard'] || 0, tk: W['ticket:gear'] || 0 }; });
      const h0 = await until(sh, (v) => v.name === '뽑기 조각 45개');
      await page.click(`${SR} .btn:text-is("바꾸기")`);
      const h1 = await until(sh, (v) => v.name === '뽑기 조각 5개');
      ok(h0.name === '뽑기 조각 45개' && !h0.off && h1.name === '뽑기 조각 5개' && h1.sh === 5 && h1.tk - w0.tk === 2 && h1.off, 'v604 뽑기 조각 45개 「바꾸기」 → 뽑기권 +2 · 5개 남음(단추 잠김)', `${h0.name} → ${h1.name} · 뽑기권 ${w0.tk} → ${h1.tk}`);
      await page.evaluate((w) => { const W = window.__s2.g.S.wallet; W['item:shard'] = w.sh; W['ticket:gear'] = w.tk; }, w0);
      await page.click('#panel-close'); await free(a0); }
    // v604 상점 — 임무 → 상점: 덤은 하루 한 번 · 사면 은자가 줄고 남은 수가 줄어든다 · 덤을 받으면 임무 빨간 점이 꺼진다
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), shop: JSON.stringify(g.S.shop || null), guide: JSON.stringify(g.S.q.guide) };
        g.S.shop = null; g.S.wallet.gold = 1e12;
        // 임무 빨간 점의 다른 까닭(하루 상자 · 길잡이 받기 · 업적 받기)은 잠깐 꺼 둔다 — 덤 하나만 남게
        const tc = g.todayChest.bind(g); g.todayChest = () => ({ ...tc(), can: false }); g.books.ach.claimable = () => []; g.bountyCan = () => 0;   // 현상수배도
        const G = g.S.q.guide; for (const k of Object.keys(G)) { G[k].done = true; G[k].got = true; } for (let i = 1; i <= 40; i++) G[`g${i}`] = { p: 99, done: true, got: true }; });
      await page.click('.nb[data-tab="town"]'); await sub('상점'); await page.waitForSelector('#wb .row:has(.name:text-is("오늘의 덤"))');
      const shop = () => page.evaluate(() => { const g = window.__s2.g, W = g.S.wallet, rows = [...document.querySelectorAll('#wb .row')], row = (n) => rows.find((r) => r.querySelector('.name')?.textContent === n), d = (n) => row(n)?.querySelector('.desc')?.textContent || '', b = (n, i = 0) => row(n)?.querySelectorAll('.btn')[i];
        return { rows: rows.length, list: g.shopState().length, free: d('오늘의 덤'), freeOff: !!b('오늘의 덤')?.disabled, can: g.shopFreeCan(), dot: document.querySelector('.nb[data-tab="town"]').classList.contains('dot-on'), dot2: !!document.querySelector('#ptabs button[data-tab="town"]')?.classList.contains('dot-on'), tk: W['ticket:gear'] || 0, gold: W.gold, stone: W['item:stone'] || 0, st: d('강화석 꾸러미'), stOff: !!b('강화석 꾸러미')?.disabled, allOff: !!b('강화석 꾸러미', 1)?.disabled, cost: g.shopState().find((x) => x.id === 'stone').cost, bought: g.shopSt().bought.stone || 0, head: document.querySelector('#wb .card h3')?.textContent || '' }; });
      const f0 = await until(shop, (v) => v.dot && !v.freeOff);
      ok(f0.rows === f0.list && f0.rows === 8 && /하루 한 번/.test(f0.free) && !f0.freeOff && f0.can && /오늘의 상점/.test(f0.head), 'v604 상점 — 물건 여덟 줄 · 맨 위는 덤(받기)', f0.free);
      ok(f0.dot && f0.dot2, 'v604 덤을 받을 수 있으면 임무에 빨간 점(아래 단추 · 창 머리)');
      await page.click('#wb .row:has(.name:text-is("오늘의 덤")) .btn');
      const f1 = await until(shop, (v) => v.freeOff && !v.dot);
      ok(f1.freeOff && !f1.can && /오늘은 받았어요/.test(f1.free) && f1.tk - f0.tk === 1 && await page.evaluate(() => window.__s2.g.shopBuy('free') === null), 'v604 덤 받기 — 뽑기권 1장 · 하루 한 번(다시는 못 받음)', f1.free);
      ok(!f1.dot && !f1.dot2, 'v604 덤을 받으면 임무 빨간 점이 꺼진다');
      const lim = +(/남은 (\d+)\/(\d+)/.exec(f1.st) || [])[2];
      await page.click('#wb .row:has(.name:text-is("강화석 꾸러미")) .btn:text-is("사기")');
      const b1 = await until(shop, (v) => v.bought === 1 && v.st.includes(`남은 ${lim - 1}/${lim}`));
      ok(lim === 3 && f1.st.includes(`남은 ${lim}/${lim}`) && b1.bought === 1 && b1.st.includes(`남은 ${lim - 1}/${lim}`) && b1.stone - f1.stone === 20 && f1.gold - b1.gold > b1.cost * 0.8 && f1.gold - b1.gold <= b1.cost && b1.cost > 0, 'v604 사기 — 은자가 값만큼 줄고 남은 수가 하나 줄어든다', `${f1.st} → ${b1.st} · 은자 −${Math.round(f1.gold - b1.gold)}(값 ${b1.cost})`);
      await page.click('#wb .row:has(.name:text-is("강화석 꾸러미")) .btn:text-is("모두")');
      const b2 = await until(shop, (v) => v.bought === lim);
      ok(b2.bought === lim && /오늘은 다 샀어요 · 남은 0\/3/.test(b2.st) && b2.stOff && b2.allOff && b2.stone - f1.stone === 20 * lim, 'v604 「모두」 — 남은 것을 다 사면 단추가 잠긴다', b2.st);
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; delete g.todayChest; delete g.books.ach.claimable; delete g.bountyCan; g.S.q.guide = JSON.parse(T.guide); g.S.shop = JSON.parse(T.shop) || undefined;
        for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close'); await free(a0); }
    // 현상수배 — 임무 → 현상수배: 카드 셋(그림 · 막대 · 받기) · 하나 끝내면 받기 → 은자가 늘고 「받음」 · 셋 다면 상자 · 빨간 점 · 들판 알림
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), bounty: JSON.stringify(g.S.bounty || null) }; g.S.bounty = null; });
      await page.click('.nb[data-tab="town"]'); await sub('현상수배'); await page.waitForSelector('#wb .bty-card');
      const bt = () => page.evaluate(() => { const g = window.__s2.g, cs = [...document.querySelectorAll('#wb .bty-card')];
        return { n: cs.length, imgs: cs.filter((c) => { const i = c.querySelector('.bty-pic img'); return i && i.complete && i.naturalWidth > 0; }).length, bars: cs.map((c) => c.querySelector('.bty-bar span')?.textContent), btn: cs.map((c) => `${c.querySelector('.btn').textContent}${c.querySelector('.btn').disabled ? '(잠김)' : ''}`), chest: document.querySelector('#wb .bty-chest')?.className || '', chestTxt: document.querySelector('#wb .bty-chest')?.textContent || '', note: [...document.querySelectorAll('#wb .note')].map((x) => x.textContent).join(' '), gold: g.S.wallet.gold, dot: document.querySelector('.nb[data-tab="town"]').classList.contains('dot-on'), can: g.bountyCan(), toast: document.getElementById('toast')?.textContent || '' }; });
      const v0 = await until(bt, (v) => v.imgs === 3);
      ok(v0.n === 3 && v0.imgs === 3 && v0.bars.every((x) => /^\d+ \/ \d+$/.test(x)) && v0.btn.every((x) => x === '받기(잠김)') && /3개 더 끝내면/.test(v0.chestTxt) && /자정/.test(v0.note), '현상수배 — 카드 셋(그림 · 막대) · 받기 잠김 · 상자 · 자정에 새로', JSON.stringify(v0.bars));
      await page.evaluate(() => { const g = window.__s2.g, x = g.bountySt().list[1]; x.n = x.need - 1; });
      await page.click('#panel-close'); await free(a0);
      await page.evaluate(() => { const g = window.__s2.g; for (let i = 0; i < 120 && !g.bountySt().list[1].done; i++) g.hunt(500); });   // 사냥을 몇 초 당겨서(알림은 들판이 feed에서 꺼내 띄운다)
      const tz = await until(() => page.evaluate(() => ({ done: window.__s2.g.bountySt().list[1].done, n: window.__s2.g.bountySt().list[1].n, k: window.__s2.g.S.kills, open: !!document.querySelector('#panel.open'), t: document.getElementById('toast')?.textContent || '' })), (v) => v.done && /현상수배 완료/.test(v.t), 8000);
      ok(tz.done && /현상수배 완료/.test(tz.t), '사냥으로 하나 끝나면 들판에 「현상수배 완료!」', JSON.stringify(tz));
      const a1 = await hold();
      await page.click('.nb[data-tab="town"]'); await sub('현상수배');
      const v1 = await until(bt, (v) => v.btn[1] === '받기');
      ok(v1.btn[1] === '받기' && v1.can >= 1 && await page.evaluate(() => document.querySelector('#ptabs button[data-tab="town"]')?.classList.contains('dot-on')), '끝난 목표는 받기가 열리고 임무에 빨간 점', JSON.stringify(v1.btn));
      await page.click('#wb .bty-card[data-i="1"] .btn');
      const v2 = await until(bt, (v) => v.btn[1] === '받음(잠김)');
      ok(v2.btn[1] === '받음(잠김)' && v2.gold > v1.gold, '받기 → 은자가 늘고 「받음」', `${Math.round(v1.gold)} → ${Math.round(v2.gold)}`);
      await page.evaluate(() => { const g = window.__s2.g; for (const x of g.bountySt().list) { x.n = x.need; x.done = true; } }); await sub('현상수배');
      const v3 = await until(bt, (v) => /can/.test(v.chest));
      ok(/can/.test(v3.chest) && /눌러서 열기/.test(v3.chestTxt), '셋 다 끝내면 상자가 열린다', v3.chestTxt);
      await page.screenshot({ path: path.join(OUT, `s2-bounty-${W}.png`) });
      const tk0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'] || 0);
      await page.click('#wb .bty-chest');
      const v4 = await until(bt, (v) => /got/.test(v.chest));
      ok(/got/.test(v4.chest) && await page.evaluate((t) => (window.__s2.g.S.wallet['ticket:gear'] || 0) - t === 3, tk0), '상자 열기 → 장비 뽑기권 3 · 오늘은 받음', v4.chestTxt);
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.bounty = JSON.parse(T.bounty) || undefined; for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close'); await free(a1); }
    // v616 무한 탑 — 던전 → 무한 탑: 탑 그림(지금 층 금빛 · 깬 층 · 위 다섯 층 · 10층마다 상자) · 지금 층 · 단추 둘 · 이정표 상자 받기
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), tower: JSON.stringify(g.S.tower) }; g.S.tower = { best: 18 }; });
      await page.click('#mb .nb[data-tab="dgn"]'); await sub('무한 탑'); await page.waitForSelector('#wb .tw-tower .tw-fl');
      const tw = () => page.evaluate(() => { const g = window.__s2.g, fl = [...document.querySelectorAll('#wb .tw-fl')], cur = document.querySelector('#wb .tw-fl.tw-cur'), tower = { width: document.querySelector('#wb .tw-tower').offsetWidth };   // 돌린 화면(세로 폰)에서도 놓인 너비로
        return { n: fl.length, top: fl[0]?.dataset.f, cur: cur?.dataset.f, curGlow: cur ? getComputedStyle(cur.querySelector('.tw-body')).boxShadow !== 'none' : false, curW: cur ? cur.querySelector('.tw-body').offsetWidth : 0, towerW: Math.round(tower.width),
          done: fl.filter((e) => e.classList.contains('tw-done')).length, next: document.querySelector('#wb .tw-fl.tw-next')?.dataset.f, chest: fl.filter((e) => e.querySelector('img')).map((e) => e.dataset.f).join(),
          big: document.querySelector('#wb .tw-now b')?.textContent, btns: [...document.querySelectorAll('#wb .tw-side .btn')].map((b) => b.textContent).join(','),
          ms: [...document.querySelectorAll('#wb .row.tw-ms')].map((r) => `${r.dataset.f}:${r.querySelector('.btn').textContent}${r.querySelector('.btn').disabled ? '(잠김)' : ''}`).join(' '),
          tix: g.S.wallet['ticket:gear'] || 0, got: (g.S.tower.ms || []).join(), dot: document.querySelector('.nb[data-tab="dgn"]').classList.contains('dot-on') }; });
      const v0 = await until(tw, (v) => v.n === 8);
      ok(v0.n === 8 && v0.top === '23' && v0.cur === '18' && v0.next === '19' && v0.done === 2 && v0.chest === '20', 'v616 탑 그림 — 위 다섯 층(23층까지) · 지금 18층 · 깬 층 둘 · 20층에 상자', JSON.stringify(v0));
      ok(v0.curGlow && v0.curW > v0.towerW * 0.6 && /^18층$/.test(v0.big) && v0.btns === '오르기,도전', '지금 층은 금빛(넓게) · 큰 숫자 · 「오르기」 「도전」', `${v0.curW}/${v0.towerW} ${v0.big} ${v0.btns}`);
      ok(v0.ms === '10:받기 20:20층부터(잠김) 30:30층부터(잠김)' && v0.dot, '이정표 — 10층 받기 · 다음 둘 잠김 · 던전에 빨간 점', `${v0.ms} dot ${v0.dot}`);
      await page.screenshot({ path: path.join(OUT, `s2-tower-${W}.png`) });
      await page.click('#wb .row.tw-ms[data-f="10"] .btn');
      const v1 = await until(tw, (v) => v.got === '10');
      ok(v1.got === '10' && v1.tix - v0.tix === 3 && /^20:20층부터\(잠김\)/.test(v1.ms) && !v1.dot, '받기 → 뽑기권 +3 · 받은 층 기록 · 빨간 점 꺼짐', `${v1.ms} · ${v0.tix}→${v1.tix}`);
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.tower = JSON.parse(T.tower); for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close'); await free(a0); }
    // v605 동행 — 던전 → 동행: 오프라인이면 연습 동행 셋(「연습」) · 둘 고르고 「출발」 → 결과 창(셋 · 몫 막대) · 오늘 횟수 하나 줄어듦
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), party: JSON.stringify(g.S.party || null) }; g.partyRec().runs = 0; });
      await page.click('#mb .nb[data-tab="dgn"]'); await sub('동행'); await page.waitForSelector('#wb .row .pill');
      const pt = () => page.evaluate(() => { const g = window.__s2.g, rows = [...document.querySelectorAll('#wb .row')], bots = rows.filter((r) => r.querySelector('.pill:not(.pv-real)')?.textContent === '연습');
        return { bots: bots.length, names: bots.map((r) => r.querySelector('.name').firstChild.textContent.trim()), pw: bots.every((r) => /^전투력 \S+/.test(r.querySelector('.desc')?.textContent || '')), on: document.querySelectorAll('#wb .row.pty-on').length, btn: bots.map((r) => `${r.querySelector('.btn').textContent}${r.querySelector('.btn').disabled ? '(잠김)' : ''}`), head: [...document.querySelectorAll('#wb .card h3')].map((h) => h.textContent), note: [...document.querySelectorAll('#wb .note')].map((n) => n.textContent).join(' / '), left: g.partyState().left, runs: g.partyRec().runs, goOff: !![...document.querySelectorAll('#wb .btn')].find((x) => x.textContent === '출발')?.disabled, modal: !document.getElementById('modal').classList.contains('hidden') }; });
      const y0 = await until(pt, (v) => v.bots === 3);
      ok(y0.bots === 3 && y0.pw && /오프라인 — 연습 동행과 함께 가요/.test(y0.note) && y0.btn.join() === '고르기,고르기,고르기' && y0.on === 0, 'v605 동행 — 오프라인이면 연습 동행 셋(「연습」 딱지 · 전투력)', y0.names.join(' · '));
      ok(/오늘 2 \/ 2번 남음/.test(y0.head[0]) && /0 \/ 2명/.test(y0.head[1]) && !y0.goOff, 'v605 동행 — 오늘 남은 횟수 · 고른 수', y0.head.join(' | '));
      const BOT = '#wb .row:has(.pill:text-is("연습"))';
      await page.click(`${BOT} .btn:text-is("고르기") >> nth=0`); await until(pt, (v) => v.on === 1);
      await page.click(`${BOT} .btn:text-is("고르기") >> nth=0`);
      const y1 = await until(pt, (v) => v.on === 2);
      ok(y1.on === 2 && /2 \/ 2명/.test(y1.head[1]) && y1.btn.join() === '빼기,빼기,고르기(잠김)', 'v605 둘을 고르면 표시되고 셋째는 잠긴다', y1.btn.join(' · '));
      await page.click('#wb .btn:text-is("출발")'); await page.waitForSelector('#modal:not(.hidden) .pty-res');
      const res = await page.evaluate(() => { const m = document.getElementById('modal'), q = (s) => [...m.querySelectorAll(s)]; const cv = m.querySelector('.pty-cv');
        return { title: m.querySelector('h2')?.textContent || '', who: q('.pty-b > span').map((x) => x.firstChild.textContent.trim()), pct: q('.pty-b > b').map((x) => parseFloat(x.textContent)), bars: q('.pty-bar i').map((x) => parseFloat(x.style.width)), t: m.querySelector('.pty-t')?.textContent || '', win: !!m.querySelector('.pty-t.win'), rew: !!m.querySelector('.pty-got'), tip: m.querySelector('.pty-side .note')?.textContent || '', cv: cv ? cv.width : 0 }; });
      const sum = res.pct.reduce((a, b) => a + b, 0);
      ok(/^동행 토벌 · \d+단계$/.test(res.title) && res.who.length === 3 && res.who[0] === '나' && res.who.slice(1).join() === y0.names.slice(0, 2).join() && res.cv === 450 && /토벌 (성공|실패)/.test(res.t) && (res.win ? res.rew : /오늘 1번 남음/.test(res.tip)), 'v605 「출발」 → 결과 창: 나 + 동행 둘 · 성공이면 보상 / 실패면 남은 횟수', `${res.t} · ${res.who.join(' · ')}`);
      ok(res.bars.length === 3 && res.pct.length === 3 && Math.abs(sum - 100) <= 0.3 && res.pct.every((p, i) => p >= 0 && Math.abs(res.bars[i] - Math.max(1, p)) < 0.01) && res.pct[0] > 0, 'v605 결과 창 — 몫 막대 셋(합 100%)', res.pct.join(' + '));
      await page.click('#modal .btn:has-text("확인")');
      const y2 = await until(pt, (v) => !v.modal && v.left === 1);
      ok(!y2.modal && y2.left === 1 && y2.runs === 1 && /오늘 1 \/ 2번 남음/.test(y2.head[0]), 'v605 싸우면 오늘 횟수가 하나 줄어든다', y2.head[0]);
      for (let i = 0; i < 2; i++) { await page.click(`${BOT} .btn:text-is("빼기") >> nth=0`); await until(pt, (v) => v.on === 1 - i); }   // 고른 것도 풀어 둔다
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.party = JSON.parse(T.party) || undefined; for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close'); await free(a0); }
    // v603 · v607 모음 격자 — 병기 · 동료 · 영물: 칸 수 = 표의 가짓수 · 가진 것만 또렷 · 그림이 뜬다
    { const a0 = await hold();
      const tb = await page.evaluate(async () => { const u = (p) => new URL(p, location.href).href, { COLLECT } = await import(u('js/s2/tables/s5.js')), { COLLECTS } = await import(u('js/s2/game.js')); return COLLECTS.map((s) => ({ sys: s, name: COLLECT[s].name, kinds: COLLECT[s].kinds })); });
      await page.click('#mb .nb[data-tab="comp"]');
      const seen = [];
      for (const [i, T] of tb.entries()) {
        await page.click(`#panel-body .subtabs button >> nth=${i}`);
        const cg = await until(() => page.evaluate((sys) => { const C = window.__s2.g.S.colls[sys], tiles = [...document.querySelectorAll('#wb .coll-tile')], im = tiles[0]?.querySelector('img');
          return { n: tiles.length, own: Object.keys(C.own).length, wrong: tiles.map((t, k) => (t.classList.contains('no') === !C.own[k] ? -1 : k)).filter((k) => k >= 0), names: tiles.filter((t) => t.querySelector('b')?.textContent).length, src: tiles.map((t) => t.querySelector('img')?.getAttribute('src') || ''), first: !!im && im.complete && im.naturalWidth > 0, fall: tiles.filter((t) => t.querySelector('em')).length, head: [...document.querySelectorAll('#wb .card h3')].map((h) => h.textContent).join(' | '), eq: tiles.filter((t) => t.classList.contains('on')).every((t) => !t.classList.contains('no')) }; }, T.sys), (v) => v.n === T.kinds && v.first && v.src[0] === `art/s2/coll/${T.sys}-0.webp`);
        ok(cg.n === T.kinds && T.kinds > 0 && cg.names === cg.n && cg.head.includes(`${T.name} 모음 ${cg.own}/${T.kinds}`), `v603 ${T.name} 모음 격자 — 칸 수 = 표(${T.kinds}) · 이름 · 「모음 n/전체」`, cg.head);
        ok(cg.wrong.length === 0 && cg.eq, `v603 ${T.name} 모음 — 가진 것만 또렷 · 없는 것은 흐리게`, `가진 ${cg.own} · 어긋난 칸 ${cg.wrong.join()}`);
        ok(cg.first && cg.fall === 0 && cg.src.every((s, k) => s === `art/s2/coll/${T.sys}-${k}.webp`), `v607 ${T.name} 모음 — 첫 칸 그림이 뜬다 · 글자로 바뀐 칸 없음`, `글자 ${cg.fall}칸`);
        seen.push({ ...T, own: cg.own, src: cg.src });
      }
      ok(seen.some((x) => x.own > 0), 'v603 모은 것이 있는 모음이 하나는 있다(빈 모음만 본 것이 아님)', seen.map((x) => `${x.name} ${x.own}`).join(' · '));
      if (W === 844) {   // 그림이 모두 있는지는 한 번만(화면 밖 칸은 늦게 불러오므로 직접 받아 본다)
        const miss = await page.evaluate(async (L) => { const out = []; await Promise.all(L.map(async (s) => { try { const r = await fetch(s, { cache: 'no-store' }); if (!r.ok || !/image/.test(r.headers.get('content-type') || '')) out.push(s); } catch { out.push(s); } })); return out; }, seen.flatMap((x) => x.src));
        ok(miss.length === 0 && seen.reduce((a, x) => a + x.src.length, 0) === tb.reduce((a, x) => a + x.kinds, 0), 'v607 모음 그림이 표의 가짓수만큼 다 있다', miss.slice(0, 5).join(' ')); }
      await page.click('#panel-close'); await free(a0); }
    // v6xx 사냥터 따르는 무리 — 동료 다섯은 작은 무인으로 · 영물 셋은 짐승으로 무인 뒤를 따른다(오류 없음 · 그린 수)
    { const a0 = await hold(), e0 = errs.length;
      await page.evaluate(() => { const g = window.__s2.g, P = g.S.colls.pal, R = g.S.colls.relic; window.__t = JSON.stringify({ pe: P.eq, po: P.own, re: R.eq, ro: R.own });
        for (const k of [0, 3, 6, 14, 24]) P.own[k] ??= { n: 0, awk: 0, lv: 1 }; for (const k of [1, 7, 29]) R.own[k] ??= { n: 0, awk: 0, lv: 1 };
        P.eq = [0, 3, 6, 14, 24]; R.eq = [1, 7, 29]; });
      await page.waitForTimeout(1000);
      const fw = await until(() => page.evaluate(() => window.__s2.followers()), (v) => v.pals === 5 && v.relics === 3, 3000);
      ok(errs.length === e0 && fw.pals === 5 && fw.relics === 3, 'v6xx 사냥터 — 동료 5 · 영물 3이 무인 뒤를 따른다(오류 없음)', `${fw.pals} · ${fw.relics}${errs.length > e0 ? ` · ${errs.slice(e0).join(' ')}` : ''}`);
      await page.evaluate(() => { const g = window.__s2.g, T = JSON.parse(window.__t), P = g.S.colls.pal, R = g.S.colls.relic; P.eq = T.pe; P.own = T.po; R.eq = T.re; R.own = T.ro; delete window.__t; });
      await page.waitForTimeout(200);
      const f2 = await page.evaluate(() => { const g = window.__s2.g, n = (a) => a.filter((x) => x !== null && x !== undefined).length; return { ...window.__s2.followers(), p: Math.min(5, n(g.S.colls.pal.eq)), r: Math.min(3, n(g.S.colls.relic.eq)) }; });
      ok(f2.pals <= f2.p && f2.relics <= f2.r, 'v6xx 사냥터 — 되돌리면 장착한 수만큼만', JSON.stringify(f2));
      await free(a0); }
    // 외형 창 — 크게 움직이는 미리 보기 · 칸을 누르면 미리 보기만 바뀜 · 「이 외형으로」 → lookEq · 「장비대로」 / 칭호 창 — 카드 · 작은 오라 미리 보기 · 「달기」 · 「떼기」
    { const a0 = await hold();
      const keep = await page.evaluate(() => { const g = window.__s2.g, k = JSON.stringify({ sn: g.S.lookSeen || {}, lk: g.S.look || {}, t: g.S.titles || [], on: g.S.titleOn || null }); g.S.lookSeen = { ...g.lookSeen(), hat: Math.max(4, g.lookSeen().hat ?? -1) }; g.S.look = {}; return k; });
      await page.click('#mb .nb[data-tab="bag"]'); await sub('외형'); await page.waitForSelector('#wb .lk-cv');
      await until(() => page.evaluate(() => +document.querySelector('#wb .lk-cv')?.dataset.n || 0), (v) => v >= 3);
      const fr = () => page.evaluate(() => document.querySelector('#wb .lk-cv').toDataURL());
      const fa = await fr(); await page.waitForTimeout(350); const fb = await fr();
      const lk0 = await page.evaluate(() => ({ rows: document.querySelectorAll('#wb .lk-row').length, dim: document.querySelectorAll('#wb .lk-t.no').length, base: document.querySelectorAll('#wb .lk-seg button').length, go: document.querySelector('#wb .lk-go')?.disabled }));
      ok(fa !== fb && lk0.rows === 10 && lk0.base === 10 && lk0.dim > 0 && lk0.go === true, '외형 — 움직이는 큰 미리 보기(두 장면이 다름) · 부위 열 줄 · 「장비대로」 · 못 얻은 등급은 흐린 칸', JSON.stringify(lk0));
      const gr = await page.evaluate(() => ((window.__s2.g.lookEq().hat?.g ?? -1) === 4 ? 3 : 4));
      const e0 = await page.evaluate(() => document.querySelector('#wb .lk-cv').dataset.eq);
      await page.click(`#wb .lk-row[data-sl="hat"] .lk-t[data-gr="${gr}"]`);
      const e1 = await until(() => page.evaluate(() => ({ eq: document.querySelector('#wb .lk-cv').dataset.eq, real: window.__s2.g.lookEq().hat?.g ?? -1, pv: !!document.querySelector('#wb .lk-t.pv'), go: document.querySelector('#wb .lk-go').disabled })), (v) => v.eq !== e0);
      ok(e1.eq !== e0 && e1.real !== gr && e1.pv && !e1.go, '외형 — 칸을 누르면 미리 보기가 바로 바뀐다(아직 정하지 않음)', `${e0} → ${e1.eq}`);
      await page.click('#wb .lk-go');
      const e2 = await until(() => page.evaluate(() => ({ g: window.__s2.g.lookEq().hat?.g, s: window.__s2.g.S.look?.hat })), (v) => v.g === gr);
      ok(e2.g === gr && e2.s === gr, '외형 — 「이 외형으로」 → g.lookEq()가 바뀐다', JSON.stringify(e2));
      await page.click('#wb .lk-row[data-sl="hat"] .lk-seg button:text-is("장비대로")');
      ok(await until(() => page.evaluate(() => window.__s2.g.S.look?.hat === undefined), (v) => v), '외형 — 「장비대로」로 그 부위를 되돌린다');
      await page.click('#panel-close');
      const TN = await page.evaluate(async () => { const { TITLES } = await import(new URL('js/s2/tables/titles.js', location.href).href); const g = window.__s2.g; g.S.titles = [TITLES[0].name, '28일 개근']; g.S.titleOn = null; return TITLES.length; });
      await page.click('#mb .nb[data-tab="char"]'); await sub('칭호'); await page.waitForSelector('#wb .ttl-c');
      await until(() => page.evaluate(() => +document.querySelector('#wb .ttl-cv')?.dataset.n || 0), (v) => v >= 3);
      const ta = await page.evaluate(() => document.querySelector('#wb .ttl-cv').toDataURL()); await page.waitForTimeout(350);
      const t0 = await page.evaluate(() => ({ n: document.querySelectorAll('#wb .ttl-c').length, no: document.querySelectorAll('#wb .ttl-c.no').length, sw: document.querySelectorAll('#wb .ttl-sw').length, head: [...document.querySelectorAll('#wb .card h3')].map((h) => h.textContent).join(' | '), go: [...document.querySelectorAll('#wb .ttl-go')].map((b) => b.textContent), img: document.querySelector('#wb .ttl-cv').toDataURL() }));
      ok(t0.n === TN && t0.no === TN - 2 && t0.sw === TN && /칭호 수집 효과/.test(t0.head) && t0.go.length === 2 && t0.go.every((x) => x === '달기') && t0.img !== ta, '칭호 — 카드마다 빛깔 · 움직이는 오라 미리 보기 · 얻은 것만 「달기」', `${t0.n}장 · 잠김 ${t0.no}`);
      await page.click('#wb .ttl-c[data-name="28일 개근"] .ttl-go');
      const t1 = await until(() => page.evaluate(() => ({ on: window.__s2.g.S.titleOn, b: document.querySelector('#wb .ttl-c.on .ttl-go')?.textContent, d: document.querySelector('#wb .ttl-c.on .ttl-go')?.disabled })), (v) => v.on === '28일 개근' && v.b === '달고 있음');
      ok(t1.on === '28일 개근' && t1.b === '달고 있음' && t1.d, '칭호 — 「달기」 → g.S.titleOn · 카드가 「달고 있음」', JSON.stringify(t1));
      await page.click('#wb .row:has-text("다는 칭호") .btn:text-is("떼기")');
      ok(await until(() => page.evaluate(() => window.__s2.g.S.titleOn === null), (v) => v), '칭호 — 「떼기」');
      await page.click('#panel-close'); await page.waitForTimeout(150);
      const st0 = await page.evaluate(() => [...document.querySelectorAll('.ttl-cv')].map((c) => c.dataset.n).join()); await page.waitForTimeout(400);
      ok(await page.evaluate((x) => [...document.querySelectorAll('.ttl-cv')].map((c) => c.dataset.n).join() === x, st0), '외형 · 칭호 — 창을 닫으면 미리 보기 그리기가 멈춘다');
      await page.evaluate((k) => { const g = window.__s2.g, o = JSON.parse(k); g.S.lookSeen = o.sn; g.S.look = o.lk; g.S.titles = o.t; g.S.titleOn = o.on; }, keep);
      await free(a0); }
    // v605 대화 — 무림 → 대화: 오프라인이면 안내 글 · 입력 칸과 「보내기」 잠김 · 듣는 것 없음
    { const a0 = await hold();
      await page.click('.nb[data-tab="social"]'); await sub('대화'); await page.waitForSelector('#wchat');
      const ch = await page.evaluate(() => { const i = document.getElementById('wchat-in'), b = document.getElementById('wchat-go'); return { note: document.querySelector('#wchat .note')?.textContent || '', msgs: document.querySelectorAll('#wchat .wc-m').length, off: i.disabled, ph: i.placeholder, go: b.disabled, on: window.__s2.worldOn(), n: window.__s2.worldMsgs().length, head: document.querySelector('#wb .card h3')?.textContent || '' }; });
      ok(/오프라인이에요/.test(ch.note) && ch.msgs === 0 && /전체 대화/.test(ch.head), 'v605 대화(오프라인) — 안내 글', ch.note);
      ok(ch.off && ch.go && ch.ph === '오프라인' && ch.on === false && ch.n === 0, 'v605 대화(오프라인) — 입력 · 보내기 잠김 · 듣는 것 없음', JSON.stringify({ ph: ch.ph, on: ch.on }));
      await page.click('#panel-close'); await free(a0); }
    // v594 알림 창 바깥 — 단추가 둘이면 고르지 않고 닫기만 / v605 설정 「진동 세기」는 진동이 되는 기기에서만 · v610 줄 그림 아이콘
    { const a0 = await hold();
      await page.click('#b-opt'); await page.waitForSelector('#wb .row:has(.name:text-is("진동"))');
      await page.waitForFunction(() => [...document.querySelectorAll('#wb .ico.pic img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 8, null, { timeout: 8000 }).catch(() => {});   // 그림은 늦게(lazy) 뜬다 — 기다린 뒤 센다
      const sc = await scan();
      ok(sc.txt === '' && sc.bad.length === 0 && sc.up >= 8, 'v610 설정 창 — 이상한 글자 없음 · 줄 그림 아이콘이 뜬다', `그림 ${sc.up}/${sc.n} ${sc.txt} ${sc.bad.join(' ')}`);
      const VR = '#wb .row:has(.name:text-is("진동 세기"))', vib = await page.evaluate(() => typeof navigator.vibrate === 'function');
      const vd = () => page.evaluate(() => [...document.querySelectorAll('#wb .row')].find((r) => r.querySelector('.name')?.textContent === '진동 세기')?.querySelector('.desc')?.textContent || '');
      const v0 = await vd(); const vs = [v0];
      if (vib) for (let i = 0; i < 3; i++) { const prev = vs[vs.length - 1]; await page.click(`${VR} .btn:text-is("바꾸기")`); vs.push(await until(vd, (v) => v !== prev && v !== '', 2000)); }
      ok(vib ? (!!v0 && /울리는 길이 ×[\d.]+/.test(v0) && new Set(vs.slice(0, 3)).size === 3 && vs[3] === v0) : v0 === '', 'v605 「진동 세기」 — 진동이 되는 기기에서만 · 세 단계 한 바퀴', `${vib ? '진동 됨' : '진동 없음'} · ${vs.join(' → ')}`);
      const k0 = await page.evaluate(() => { window.__keep = 1; return { lv: window.__s2.g.S.hero.lv, kills: window.__s2.g.S.kills }; });
      await page.click('#wb .row:has(.name:text-is("새로 시작")) .btn'); await page.waitForSelector('#modal:not(.hidden) .btn-row .btn >> nth=1');
      const m0 = await page.evaluate(() => ({ t: document.querySelector('#modal h2')?.textContent || '', b: [...document.querySelectorAll('#modal .btn-row .btn')].map((x) => x.textContent) }));
      await page.waitForTimeout(400); await page.mouse.click(4, 4);
      await until(() => page.evaluate(() => document.getElementById('modal').classList.contains('hidden')), (v) => v);
      await page.waitForTimeout(300);   // 「예」였다면 여기서 새로 읽힌다
      const m1 = await page.evaluate(() => ({ hid: document.getElementById('modal').classList.contains('hidden'), keep: window.__keep === 1, lv: window.__s2.g.S.hero.lv, kills: window.__s2.g.S.kills, panel: document.getElementById('panel').classList.contains('open') }));
      ok(m0.b.join() === '아니요,예' && m1.hid && m1.keep && m1.lv >= k0.lv && m1.kills >= k0.kills && m1.panel, 'v594 단추가 둘인 알림 창 — 바깥을 누르면 고르지 않고 닫힌다(새로 시작되지 않음)', `${m0.t} [${m0.b.join(' · ')}]`);
      await page.click('#panel-close'); await free(a0); }
    // v595 친구에게 알리기 — 설정에서 누르면 게임 주소(폴더까지)를 공유 · 복사
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      await page.click('#b-opt'); await page.waitForTimeout(300);
      const row = await page.$('#wb .row:has-text("친구에게 알리기") .btn');
      if (row) { await row.click(); await page.waitForTimeout(400); }
      const u = await page.evaluate(() => window.__s2.shareLast());
      ok(!!row && /^https?:\/\/[^?#]+\/$/.test(u), 'v595 친구에게 알리기 → 게임 주소', u);
      if (await page.isVisible('#modal .sheet')) { await page.click('#modal .btn'); await page.waitForTimeout(200); }
      await page.click('#panel-close'); await page.waitForTimeout(200); }
    // v594 알림 창 바깥을 누르면 닫힌다
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      await page.evaluate(() => { window.__s2.g.S.newsV = 540; window.__s2.newsCheck(); }); await page.waitForSelector('#modal:not(.hidden) .news-i', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(500);   // 결과 창이 떠 있으면 닫힌 뒤에 뜬다
      ok(await page.isVisible('#modal .sheet'), 'v594 알림 창이 뜸');
      await page.mouse.click(4, 4); await page.waitForTimeout(300);
      ok(!(await page.isVisible('#modal .sheet')) && await page.evaluate(() => window.__s2.g.S.newsV >= 594), 'v594 바깥을 누르면 닫힘(확인과 같게)'); }
    // v593 자동 성장 — 은자 쓰기를 끄면 강화를 건너뛴다
    { const enhSum = () => page.evaluate(() => Object.values(window.__s2.g.S.gear.slots).reduce((a, x) => a + (x.enh || 0), 0));
      await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      const w0 = await page.evaluate(() => { const W = window.__s2.g.S.wallet, o = { gold: W.gold, stone: W['item:stone'], tk: {} }; for (const k of Object.keys(W)) if (k.startsWith('ticket:')) { o.tk[k] = W[k]; W[k] = 0; } W.gold = 1e12; W['item:stone'] = 5000; return o; });
      await page.click('#b-opt'); await page.waitForTimeout(200);
      ok(!(await page.$('#wb .row:has-text("은자 쓰기")')), 'v593 자동 성장이 꺼져 있으면 은자 쓰기 줄이 없다');
      await page.click('#wb .row:has-text("자동 성장(방치)") .btn'); await page.waitForTimeout(200);
      await page.click('#wb .row:has-text("은자 쓰기") .btn'); await page.waitForTimeout(200); await page.click('#panel-close');
      const e0 = await enhSum();
      await page.evaluate(() => window.__s2.agTest()); await page.waitForTimeout(800);
      ok((await enhSum()) === e0, 'v593 은자 쓰기를 끄면 강화하지 않는다');
      await page.evaluate((w) => { const W = window.__s2.g.S.wallet; W.gold = w.gold; W['item:stone'] = w.stone; Object.assign(W, w.tk); }, w0);
      await page.click('#b-opt'); await page.waitForTimeout(200);
      if ((await page.textContent('#wb .row:has-text("은자 쓰기") .btn')).includes('꺼짐')) { await page.click('#wb .row:has-text("은자 쓰기") .btn'); await page.waitForTimeout(300); }
      if ((await page.textContent('#wb .row:has-text("자동 성장(방치)") .btn')).includes('켜짐')) { await page.click('#wb .row:has-text("자동 성장(방치)") .btn'); await page.waitForTimeout(300); }
      ok((await page.textContent('#wb .row:has-text("자동 성장(방치)") .btn')).includes('꺼짐'), 'v593 시험 뒤 자동 성장 끔');
      await page.click('#panel-close'); await page.waitForTimeout(200); }
    // v590 절전에서 돌아오면 그동안 얻은 것을 한 줄로
    { await page.evaluate(() => { window.__s2.saverStart(); window.__s2.saverAge(3 * 60000); }); await page.waitForTimeout(300);
      await page.mouse.click(5, 200); await page.waitForTimeout(400);
      const sm = await page.evaluate(() => window.__s2.saverSum());
      ok(/^절전 3분 — /.test(sm) && /처치 \+/.test(sm) && /은자 \+/.test(sm), 'v590 절전 결과 한 줄', sm);
      await page.evaluate(() => { window.__s2.saverStart(); }); await page.mouse.click(5, 200); await page.waitForTimeout(300);
      ok((await page.evaluate(() => window.__s2.saverSum())) === sm, 'v590 1분 안 되면 결과 안 띄움'); }
    // v588 자동 성장 — 설정에서 켜면 1분마다(시험은 바로) 뽑기권을 쓰고 기록에 남긴다
    { const keep = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'] || 0);
      const t0 = await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); g.S.wallet['ticket:gear'] = 12; return g.S.gacha.pulls; });
      await page.click('#b-opt'); await page.waitForTimeout(200);
      await page.click('#wb .row:has-text("자동 성장") .btn'); await page.waitForTimeout(200); await page.click('#panel-close');
      for (let k = 0; k < 6; k++) { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); window.__s2.agTest(); }); await page.waitForTimeout(800); if ((await page.evaluate(() => window.__s2.g.S.gacha.pulls)) > t0) break; }   // 두목전과 겹치면 다시
      const t1 = await page.evaluate(() => ({ p: window.__s2.g.S.gacha.pulls, w: window.__s2.g.S.wallet['ticket:gear'], b: !!window.__s2.g.bossFight, d: !!window.__s2.g.dg, m: !document.querySelector('#modal').classList.contains('hidden'), o: JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /opt/i.test(k))) || '{}').autoGrow }));
      ok(t1.p >= t0 + 12 && t1.w === 0, 'v588 자동 성장 켜면 뽑기권을 쓴다(받은 보상 몫까지)', JSON.stringify({ t0, t1 }));
      await page.click('#b-opt'); await page.waitForTimeout(200); await page.click('#wb .row:has-text("자동 성장") .btn'); await page.waitForTimeout(200); await page.click('#panel-close');
      await page.evaluate((k) => { window.__s2.g.S.wallet['ticket:gear'] = k; }, keep); }   // 뒤 시험(뽑기권 10장)이 쓰게 되돌림
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
    // 무공 화면(sk-) — 낀 칸 타일 수 = 칸 수 · 무공 아이콘 그림이 뜬다 · 카드 「올리기」 → 카드와 칸 타일의 Lv가 오른다 · 강화 트리(단마다 세로 칸) · 옆 넘침 없음
    { const id = await page.evaluate(() => { const g = window.__s2.g, K = g.hero.kitState(); g.S.wallet.gold = Math.max(g.S.wallet.gold || 0, 1e8); const s = K.slots[0]; if (s) K.lv[s] = 1; return s; });
      await page.click('#mb .nb[data-key]'); await page.waitForSelector('#wb .sk-slot');
      const s = await page.evaluate(async () => {
        const K = window.__s2.g.hero.kitState(), ims = [...document.querySelectorAll('#wb .sk-slot[data-id] .sk-ic img, #wb .sk-card .sk-ic img')], t = Date.now();
        while (ims.some((i) => i.isConnected && !i.complete) && Date.now() - t < 3000) await new Promise((r) => setTimeout(r, 50));
        const wb = document.getElementById('wb');
        return { tiles: document.querySelectorAll('#wb .sk-slot[data-id]').length, slots: K.slots.length, all: document.querySelectorAll('#wb .sk-slot').length, n: ims.length, up: ims.filter((i) => i.isConnected && i.naturalWidth > 0).length, over: wb.scrollWidth - wb.clientWidth, pre: document.querySelectorAll('#wb .sk-seg button').length, upAll: !!document.querySelector('#wb .row.sk-all .btn') };
      });
      ok(s.tiles === s.slots && s.slots > 0 && s.all === 6 && s.pre === 4 && s.upAll, '무공 창: 낀 칸 타일 = 낀 칸 수(여섯 칸 · 묶음 가/나 · 모두 올리기)', JSON.stringify(s));
      ok(s.n >= s.tiles && s.up === s.n, '무공 창: 무공 아이콘 그림이 뜬다', `${s.up}/${s.n}`);
      ok(s.over <= 1, '무공 창: 옆으로 넘치지 않는다', s.over);
      const lvOf = () => page.evaluate((x) => ({ card: document.querySelector(`#wb .sk-card[data-id="${x}"] .sk-lv`)?.textContent, tile: document.querySelector(`#wb .sk-slot[data-id="${x}"] .sk-lv`)?.textContent, eng: window.__s2.g.hero.kitState().lv[x] }), id);
      const a = await lvOf(); await page.click(`#wb .sk-card[data-id="${id}"] .sk-up`);
      const c = await until(lvOf, (v) => v.card !== a.card);
      ok(a.card === 'Lv 1' && c.card === 'Lv 2' && c.tile === 'Lv 2' && c.eng === 2, '무공 창: 카드 「올리기」 → 보이는 Lv가 오른다(카드 · 칸 타일)', `${a.card} → ${c.card} · 칸 ${c.tile}`);
      await sub('무공 강화');
      const t = await page.evaluate(() => { const wb = document.getElementById('wb'); return { cols: document.querySelectorAll('#wb .sk-tree .sk-col').length, nodes: document.querySelectorAll('#wb .sk-tree .sk-node .btn').length, pts: /^\d+$/.test(document.querySelector('#wb .sk-pts b')?.textContent || ''), reset: /트리 초기화/.test(document.querySelector('#wb .sk-reset')?.textContent || ''), over: wb.scrollWidth - wb.clientWidth }; });
      ok(t.cols === 3 && t.nodes >= 4 && t.pts && t.reset && t.over <= 1, '무공 강화 창: 단 셋 · 칸마다 올리기 · 남은 점수 · 트리 초기화 · 넘침 없음', JSON.stringify(t));
      await page.click('#panel-close'); }
    let tabsSeen = 0; const empty = [], outside = [], picTabs = [], picBad = []; let picN = 0, picUp = 0;
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
        const sc = await scan();   // v610 이상한 글자([object Object]도) · 줄 그림 아이콘
        if (sc.txt) empty.push(`${name}:글자(${sc.txt})`);
        picN += sc.n; picUp += sc.up; if (sc.up) picTabs.push(name); for (const x of sc.bad) picBad.push(`${name}:${x}`);
        for (const bt of await page.$$('#wb button:not(#pass-track button)')) {   /* v611 패스 줄은 옆으로 넘기는 줄이라 화면 밖 칸이 있다 */  const r = await bt.boundingBox(); if (r && (W < H ? r.y < 0 || r.y + r.height > H + 1 : r.x < 0 || r.x + r.width > W + 1)) outside.push(name); /* 돌린 화면이면 게임의 가로 = 기기의 세로 */ }
      }
    }
    ok(tabsSeen >= 24, '창 탭 전부 열어 봄', tabsSeen);
    ok(empty.length === 0, '빈 창 · 이상한 글자 없음', empty.join(' '));
    ok(outside.length === 0, '단추가 화면 안', [...new Set(outside)].join(' '));
    ok(picTabs.length >= 20 && picUp >= 80, 'v610 창 줄 그림 아이콘 — 여러 창에서 그림으로 뜬다', `${picTabs.length}칸 · 그림 ${picUp}/${picN}`);
    ok(picBad.length === 0, 'v610 창을 다 훑어도 깨진 그림 없음', picBad.slice(0, 5).join(' '));
    // v613 두목 도감 — 카드 15장(못 만난 두목은 그림자) · 드러난 수 = 엔진 · 그림이 뜬다 · 누르면 자세히 · 바깥을 누르면 닫힘 · 「도감 보상」 줄은 맨 위
    { const top0 = await page.evaluate(() => { const g = window.__s2.g, T = g.stage(), t = T.top; T.top = Math.max(t, 52); g.S.chb = { ...(g.S.chb || {}), 1: 1, 2: 1, 3: 1 }; return t; });
      await page.click('#ptabs button[data-tab="map"]'); await page.click('#panel-body .subtabs button:text-is("두목 도감")'); await page.waitForSelector('#wb .dex-grid');
      const d = await page.evaluate(() => ({ n: document.querySelectorAll('#wb .dex-c').length, known: document.querySelectorAll('#wb .dex-c:not(.unk)').length, unk: document.querySelectorAll('#wb .dex-c.unk').length, found: window.__s2.g.dex().found,
        first: document.querySelector('#wb .card .row .name')?.textContent || '', btn: !!document.querySelector('#wb .card .row .btn')?.textContent.includes('받기'), sw: document.getElementById('panel-body').scrollWidth - document.getElementById('panel-body').clientWidth }));
      ok(d.n === 15 && d.known === d.found && d.found >= 5 && d.unk === 15 - d.found, 'v613 두목 도감: 카드 15장 · 드러난 수 = 엔진', JSON.stringify(d));
      ok(/도감 보상/.test(d.first) && d.btn && d.sw <= 1, 'v613 「도감 보상」 줄이 맨 위 · 옆으로 넘치지 않음', JSON.stringify(d));
      for (const c of await page.$$('#wb .dex-c')) await c.scrollIntoViewIfNeeded();
      const art = await until(() => page.evaluate(() => [...document.querySelectorAll('#wb .dex-c img')].map((im) => im.complete && im.naturalWidth > 0)), (v) => v.every(Boolean));
      ok(art.length === 15 && art.every(Boolean), 'v613 두목 그림 15장이 뜬다(그림자 포함)', `${art.filter(Boolean).length}/15`);
      await page.click('#wb .dex-c.beat >> nth=0'); await page.waitForSelector('#modal:not(.hidden) .dex-d');
      const m = await page.evaluate(() => ({ t: document.querySelector('#modal h2').textContent, lore: document.querySelector('#modal .dex-lore')?.textContent.length || 0, st: document.querySelectorAll('#modal .dex-st i').length, raid: [...document.querySelectorAll('#modal .btn')].some((b) => b.textContent === '토벌') }));
      ok(/1장 · 녹림대왕/.test(m.t) && m.lore > 5 && m.st === 3 && m.raid, 'v613 깬 두목 카드 → 자세히(이야기 · 별 · 토벌 바로 가기)', JSON.stringify(m));
      await page.waitForTimeout(400); await page.mouse.click(4, 4); await page.waitForTimeout(200);
      ok(await page.isHidden('#modal'), 'v613 자세히 창 — 바깥을 누르면 닫힘');
      await page.evaluate((t) => { window.__s2.g.stage().top = t; }, top0); }
    await page.click('#ptabs button[data-tab="bag"]'); await page.click('#panel-body .subtabs button >> nth=1');
    const t0 =await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
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
    await page.click('#b-opt'); ok(/설정/.test(await page.textContent('#panel-title')) && /진동/.test(await page.textContent('#wb')) && !/효과음|배경 가락/.test(await page.textContent('#wb')) && !(await page.$('#btn-sound')), '⚙ → 설정 창(v601 소리 없음)'); await page.click('#panel-close');
    await page.screenshot({ path: path.join(OUT, `s2ui-${W}.png`) });
    // 돌아왔을 때 카드(ret-) — 비운 시간 · 은자 세어 올림(누르면 바로) · 받기는 한 번만 · 창이 넘치지 않음 · 10분 넘은 절전은 작은 카드
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      const retFit = () => page.evaluate(() => { const sh = document.querySelector('#modal .sheet'), bs = [...sh.querySelectorAll('.btn-row .btn')].map((x) => x.getBoundingClientRect()); return sh.scrollHeight <= sh.clientHeight + 1 && bs.length > 0 && bs.every((r) => r.top >= 0 && r.bottom <= innerHeight && r.height > 0); });
      await page.evaluate(() => window.__s2.retTest(2 * 3600e3 + 5 * 60000)); await page.waitForSelector('#modal:not(.hidden) .ret'); await page.waitForTimeout(1100);
      const r = await page.evaluate(() => { const n = document.querySelector('.ret-i .ret-n'); return { t: document.querySelector('#modal .sheet h2').textContent, hm: document.querySelector('.ret-t b').textContent, n: +n.dataset.n, txt: n.textContent, done: !!document.querySelector('.ret.ret-done'), pend: window.__s2.g.S.offline.pending?.gold || 0, btns: [...document.querySelectorAll('#modal .btn-row .btn')].map((b) => b.textContent), hero: !!document.querySelector('canvas.ret-hero'), pics: [...document.querySelectorAll('.ret-i img')].map((i) => i.getAttribute('src').split('/').pop()) }; });
      ok(r.t === '돌아오셨군요' && r.hm === '2:05' && r.n > 0 && r.n === r.pend && r.done && r.txt !== '+0' && r.hero, '돌아옴 카드 — 비운 시간 2:05 · 은자 세어 올림', `${r.hm} ${r.txt}`);
      ok(r.btns.join('|') === '받기|광고 보고 ×2' && r.pics[0] === 'silver.webp', '돌아옴 카드 — 받기 단추 그대로 · 은자 그림', r.btns.join('|'));
      ok(await retFit(), `돌아옴 카드 — 넘치지 않고 단추가 화면 안(${W})`);
      const g0 = await page.evaluate(() => window.__s2.g.S.wallet.gold);
      await page.click('#modal .btn-row .btn >> nth=0'); await page.waitForTimeout(200);
      const g1 = await page.evaluate(() => ({ gold: window.__s2.g.S.wallet.gold, pend: window.__s2.g.S.offline.pending, again: window.__s2.g.claimOffline(false), hidden: document.querySelector('#modal').classList.contains('hidden') || !document.querySelector('#modal .ret') }));
      ok(g1.gold - g0 >= r.pend && g1.pend === null && g1.again === null && g1.hidden, '돌아옴 카드 — 받기는 딱 한 번', `+${g1.gold - g0} / ${r.pend}`);
      if (!(await page.$('#modal.hidden'))) { await page.evaluate(() => { const b = document.querySelector('#modal .btn:has-text("나중에")') || [...document.querySelectorAll('#modal .btn')].find((x) => /나중에|확인/.test(x.textContent)); b?.click(); }); await page.waitForTimeout(200); }
      await page.evaluate(() => window.__s2.retTest(30 * 60000)); await page.waitForSelector('#modal:not(.hidden) .ret');
      await page.click('.ret-t'); const sk = await page.evaluate(() => { const n = document.querySelector('.ret-i .ret-n'); return { done: !!document.querySelector('.ret.ret-done'), txt: n.textContent, hm: document.querySelector('.ret-t b').textContent }; });
      ok(sk.done && sk.txt !== '+0' && sk.hm === '0:30', '돌아옴 카드 — 누르면 세기를 건너뜀', sk.txt);
      await page.click('#modal .btn-row .btn >> nth=0'); await page.waitForTimeout(200);
      if (!(await page.$('#modal.hidden'))) { await page.evaluate(() => [...document.querySelectorAll('#modal .btn')].find((x) => /나중에|확인/.test(x.textContent))?.click()); await page.waitForTimeout(200); }
      await page.evaluate(() => { window.__s2.saverStart(); window.__s2.saverAge(12 * 60000); }); await page.waitForTimeout(300);
      await page.mouse.click(5, 200); await page.waitForTimeout(800);
      const sv = await page.evaluate(() => ({ card: !!document.querySelector('#modal:not(.hidden) .ret.ret-s'), t: document.querySelector('#modal .sheet h2')?.textContent, hm: document.querySelector('.ret-s .ret-t b')?.textContent, sum: window.__s2.saverSum() }));
      ok(sv.card && sv.t === '절전 끝' && sv.hm === '0:12' && /^절전 12분 — /.test(sv.sum), '절전 10분 넘으면 작은 돌아옴 카드', `${sv.t} ${sv.hm}`);
      ok(await retFit(), `절전 카드 — 넘치지 않고 단추가 화면 안(${W})`);
      await page.click('#modal .btn-row .btn >> nth=0'); await page.waitForTimeout(200);
      ok(!!(await page.$('#modal.hidden')), '절전 카드 — 확인으로 닫힘'); }
    // 방치: 마지막 접속을 3시간 전으로 돌려 저장 → 다시 열면 방치 보상 창
    await page.evaluate(() => { const g = window.__s2.g; g.S.offline.lastSeen -= 3 * 3600e3; g.S.offline.clockMax -= 3 * 3600e3; localStorage.setItem('ifu.s2.save', g.save()); window.__s2.freeze(); });
    await page.close();
    const p2 = await ctx.newPage();
    p2.on('pageerror', (e) => errs.push(e.message));
    await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
    await p2.waitForSelector('#modal:not(.hidden)');
    ok(/돌아오셨군요/.test(await p2.textContent('#modal .sheet')) && /3:00/.test(await p2.textContent('#modal .ret-t')), '3시간 뒤 다시 열면 방치 보상 창(돌아오셨군요 · 3:00)');
    const lv0 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    await p2.click('#modal .btn >> nth=1');
    const lv1 = await p2.evaluate(() => window.__s2.g.S.hero.lv);
    ok(lv1 > lv0, '광고 ×2로 받기 → 레벨이 오른다', `${lv0} → ${lv1}`);
    ok(errs.length === 0, '콘솔 오류 없음', errs.slice(0, 3).join(' | '));
    ok(badArt.length === 0, 'v610 못 불러온 그림 없음(줄 아이콘 · 모음 · 장비)', [...new Set(badArt)].slice(0, 5).join(' '));
    await ctx.close();
  }
  // v605 진동이 없는 기기 — 설정에 「진동」 줄은 있어도 「진동 세기」 줄은 없다
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('novib')) {
    console.log('— 진동 없는 기기');
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined }); });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden)'); await page.click('#modal .btn >> nth=0');
    await page.waitForSelector('#modal', { state: 'hidden' });   // v614 첫 판은 출석 창이 안 뜬다
    await page.click('#b-opt'); await page.waitForSelector('#wb .row:has(.name:text-is("진동"))');
    const v = await page.evaluate(() => ({ has: typeof navigator.vibrate, rows: [...document.querySelectorAll('#wb .row .name')].map((x) => x.textContent) }));
    ok(v.has === 'undefined' && v.rows.includes('진동') && !v.rows.includes('진동 세기') && v.rows.length >= 8, 'v605 진동이 없는 기기 — 「진동 세기」 줄이 없다', `줄 ${v.rows.length}`);
    await page.click('#wb .row:has(.name:text-is("진동")) .btn'); await page.waitForTimeout(300);   // 진동이 없어도 눌러서 오류가 나지 않는다
    ok(errs.length === 0 && await page.isVisible('#wb .row:has(.name:text-is("진동"))'), 'v605 진동이 없는 기기 — 진동 줄을 눌러도 오류 없음', errs.slice(0, 2).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v614 첫 판 길 안내 — 자동 시험에선 window.__s2coach 를 켜야 뜬다. 세 걸음을 「다음」으로 · 구멍이 그 대상과 겹치는지 · 다시 열어도 안 뜸 · 하던 세이브엔 안 뜸 · 길잡이 살짝 빛남
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('coach')) {
    for (const [W, H] of [[844, 390], [667, 375]]) {
      console.log(`— 길 안내 ${W}×${H}`);
      const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      await ctx.addInitScript(() => { window.__s2coach = true; });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard >> nth=0');
      await page.waitForSelector('#coach .co-hole', { timeout: 4000 });
      const TGT = ['#cv', '#qc', '#mb .nb[data-tab="bag"]'], seen = [];
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction((n) => document.querySelector('#coach')?.dataset.step === String(n), i + 1);
        await page.waitForTimeout(350);   // 구멍이 미끄러져 자리 잡기(0.25초)
        const r = await page.evaluate((sel) => {
          const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; };
          const hole = R(document.querySelector('#coach .co-hole')), tg = R(document.querySelector(sel)), bub = R(document.querySelector('#coach .co-bub'));
          const shadow = getComputedStyle(document.querySelector('#coach .co-hole')).boxShadow;
          return { hole, tg, bub, shadow, t: document.querySelector('#coach .co-t').textContent, modal: document.getElementById('modal').classList.contains('hidden'), W: innerWidth, H: innerHeight };
        }, TGT[i]);
        const ov = (a, c) => Math.max(0, Math.min(a[2], c[2]) - Math.max(a[0], c[0])) * Math.max(0, Math.min(a[3], c[3]) - Math.max(a[1], c[1]));
        const area = (a) => (a[2] - a[0]) * (a[3] - a[1]);
        const inV = (a) => a[0] >= -1 && a[1] >= -1 && a[2] <= r.W + 1 && a[3] <= r.H + 1;
        // 들판은 #cv 안의 일부 · 나머지 둘은 대상 전체를 감싼다
        const good = i === 0 ? ov(r.hole, r.tg) >= area(r.hole) * 0.95 && area(r.hole) > 0.12 * r.W * r.H : ov(r.hole, r.tg) >= area(r.tg) * 0.95;
        ok(good && inV(r.hole) && inV(r.bub) && /rgba?\(0, 0, 0/.test(r.shadow) && r.modal, `v614 길 안내 ${i + 1}/3 — 구멍이 대상과 겹침 · 말풍선 화면 안 · 어둡게`, `${r.t} · 구멍 ${r.hole.map(Math.round)} · 대상 ${r.tg.map(Math.round)}`);
        if (i > 0) ok(ov(r.hole, r.bub) === 0, `v614 길 안내 ${i + 1}/3 — 말풍선이 구멍을 가리지 않음`);
        seen.push(r.t);
        await page.click('#coach .co-next');
      }
      ok(seen[0].startsWith('싸움은 저절로') && seen[1].startsWith('길잡이') && seen[2].startsWith('장비 뽑기'), 'v614 길 안내 — 들판 · 길잡이 · 장비 순서', seen.join(' / '));
      await page.waitForTimeout(300);
      ok(await page.evaluate(() => !document.querySelector('#coach') && localStorage.getItem('ifu.s2.coach') === 'done' && window.__s2.coachStep() === -1), 'v614 길 안내 끝 — 사라지고 이 기기에 적힘');
      // 길잡이 1~5 — 20초 손대지 않으면 살짝 빛남(시험 손잡이로 시간을 건너뜀)
      ok(await page.evaluate(() => window.__s2.nudgeTest() && document.getElementById('qc').classList.contains('nudge')), 'v614 길잡이 1~5 — 가만히 있으면 길잡이 칸이 빛남');
      // 다시 열면 안 뜸(같은 세이브 · 첫 판 아님 — 이때는 출석 창이 뜬다)
      await page.evaluate(() => { window.__s2.save(); window.__s2.freeze(); });
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000);
      ok(await page.evaluate(() => !document.querySelector('#coach') && !!window.__s2.g), 'v614 다시 열어도 길 안내는 다시 안 뜸');
      ok(await page.isVisible('#modal .attg'), 'v614 둘째 판부터는 출석 창이 다시 뜬다');
      // 하던 세이브(처치 1 이상)에 길 안내 기록이 없어도 안 띄우고 끝낸 것으로 적는다
      await page.evaluate(() => { localStorage.removeItem('ifu.s2.coach'); window.__s2.save(); window.__s2.freeze(); });
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1800);
      ok(await page.evaluate(() => !document.querySelector('#coach') && localStorage.getItem('ifu.s2.coach') === 'done'), 'v614 이미 하던 세이브 — 길 안내 없이 끝낸 것으로');
      ok(errs.length === 0, 'v614 길 안내 — 콘솔 오류 없음', errs.slice(0, 2).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
    // 밝힌 곳(장비 단추)을 눌러도 다음 · 「건너뛰기」는 바로 끝
    { const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      await ctx.addInitScript(() => { window.__s2coach = true; });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard >> nth=3');
      await page.waitForSelector('#coach .co-hole', { timeout: 4000 }); await page.waitForTimeout(350);
      const hc = async () => { const b2 = await page.$eval('#coach .co-hole', (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.click(b2[0], b2[1]); await page.waitForTimeout(350); };
      await hc();
      ok(await page.evaluate(() => document.querySelector('#coach')?.dataset.step === '2'), 'v614 밝힌 곳을 누르면 다음 걸음');
      await page.click('#coach .co-skip');
      ok(await page.evaluate(() => !document.querySelector('#coach') && localStorage.getItem('ifu.s2.coach') === 'done' && !document.getElementById('panel').classList.contains('open')), 'v614 건너뛰기 — 바로 끝 · 적힘');
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close(); }
  }
  await b.close();
  console.log(fails ? `\n✗ ${fails}건` : '\n✓ 새 시즌 화면 전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
