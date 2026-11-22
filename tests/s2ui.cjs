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
    // v624 Lv · HP 상자 — 안쪽 EXP 줄(엔진 % ±2) · 흰 줄(깎인 몫) · 레벨 업: 숫자 톡 · 상자 번쩍 · 머리 위 「Lv n!」 · 스킬 줄 · 메뉴와 안 겹침
    { await page.waitForTimeout(300);
      const hb = await page.evaluate(async () => { const { expToNext } = await import(new URL('js/s2/tables/exp.js', location.href).href), H = window.__s2.g.S.hero, f = document.getElementById('hb-xp-fill');
        const eng = Math.min(100, H.exp / expToNext(H.lv) * 100), bar = f.offsetWidth / f.parentNode.clientWidth * 100, r = (s) => document.querySelector(s).getBoundingClientRect(), me = r('#me');
        const hit = (a, c) => a.width && c.width && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        return { eng, bar, txt: document.getElementById('hb-xp-txt').textContent, trail: !!document.getElementById('hp-trail'), lap: ['#sk', '#mb', '#jp', '#au'].filter((s) => hit(me, r(s))), inView: me.bottom <= innerHeight && me.left >= 0 }; });
      ok(Math.abs(hb.eng - hb.bar) <= 2 && /^[\d.]+%$/.test(hb.txt) && hb.trail, 'v624 Lv · HP 상자 안 EXP 줄 = 엔진 %(±2) · 흰 줄 있음', `엔진 ${hb.eng.toFixed(2)} · 줄 ${hb.bar.toFixed(2)} · ${hb.txt}`);
      ok(!hb.lap.length && hb.inView, 'v624 Lv · HP 상자는 무공 줄 · 아래 메뉴와 안 겹친다', hb.lap.join(','));
      await page.evaluate(() => { window.__s2.g.S.hero.lv += 1; });
      const lu = await until(() => page.evaluate(() => ({ pop: document.getElementById('me-lv').classList.contains('hb-pop'), flash: document.getElementById('me').classList.contains('hb-flash'), fl: document.querySelector('.hb-fl')?.textContent || '', lv: window.__s2.g.S.hero.lv })), (v) => v.pop && v.fl);
      ok(lu.pop && lu.flash && lu.fl === `Lv ${lu.lv}!`, 'v624 레벨 업 → 숫자 톡 · 상자 번쩍 · 머리 위 「Lv n!」', JSON.stringify(lu));
      await page.evaluate(() => { window.__s2.g.S.hero.lv -= 1; }); }
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
    // v6xx 받을 보상 칸(#rc) — 받을 것이 없으면 숨김 · 둘이면 2 · 「모두 받기」로 받고 숨김 · 길잡이 · 기연 · 다음 칸과 안 겹침
    { const a0 = await hold();
      const rcVis = () => page.evaluate(() => { const e = document.getElementById('rc'); return !e.classList.contains('hidden') && e.offsetHeight > 0; });
      if (await rcVis()) { await page.click('#rc'); await page.click('#modal .btn:has-text("모두 받기")'); await page.waitForTimeout(150); }
      const z = await page.evaluate(() => { const g = window.__s2.g; return { n: g.books.daily.claimable().length + g.books.weekly.claimable().length + g.books.ach.claimable().length + g.bountyCan() + g.passCan() + g.towerMsCan() + (g.shopFreeCan() ? 1 : 0) + (g.todayChest().can ? 1 : 0) }; });
      ok(z.n === 0 && !(await rcVis()), 'v6xx 받을 보상 칸 — 받을 것이 없으면 숨김', `남은 ${z.n}`);
      const tw = await page.evaluate(() => { const g = window.__s2.g, T = g.towerSt(), f0 = g.towerMsState()[0].floor; g.S.shop.bought = {}; T.ms = T.ms.filter((f) => f !== f0); T.best = Math.max(T.best || 0, f0); return { tw: g.towerMsCan(), sh: g.shopFreeCan() }; });
      const c2 = await until(() => page.evaluate(() => ({ vis: !document.getElementById('rc').classList.contains('hidden'), n: document.getElementById('rc-n').textContent })), (v) => v.vis && v.n === '2', 2500);
      ok(tw.tw === 1 && tw.sh && c2.vis && c2.n === '2', 'v6xx 받을 보상 칸 — 탑 이정표 · 상점 덤 둘이면 「받을 보상 2」', JSON.stringify(c2));
      const R = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.classList.contains('hidden') || !e.offsetHeight) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { rc: r('#rc'), o: ['#qc', '#fc', '#nx', '#me', '#tr', '#sk', '#mb', '#tl', '#tc'].map(r).filter(Boolean), W: innerWidth, H: innerHeight }; });
      const hit2 = (a, c) => a[0] < c[2] - 1 && c[0] < a[2] - 1 && a[1] < c[3] - 1 && c[1] < a[3] - 1;
      ok(R.rc && !R.o.some((o) => hit2(R.rc, o)) && R.rc[0] >= 0 && R.rc[3] <= Math.max(R.W, R.H), 'v6xx 받을 보상 칸 — 길잡이 · 기연 · 다음 · 위 · 아래 HUD와 안 겹침', JSON.stringify(R.rc?.map(Math.round)));
      await page.click('#rc'); const rows = await page.$$eval('#modal .rc-r', (a) => a.map((e) => e.textContent));
      ok(rows.length === 2 && rows.some((t) => /무한 탑/.test(t)) && rows.some((t) => /상점 덤/.test(t)), 'v6xx 받을 보상 창 — 받을 곳마다 한 줄 · 가기', rows.join(' / '));
      const w0 = await page.evaluate(() => ({ gold: window.__s2.g.S.wallet.gold, tix: window.__s2.g.S.wallet['ticket:gear'] || 0 }));
      await page.click('#modal .btn:has-text("모두 받기")'); await page.waitForTimeout(150);
      const af = await page.evaluate(() => { const g = window.__s2.g; return { tw: g.towerMsCan(), sh: g.shopFreeCan(), gold: g.S.wallet.gold, tix: g.S.wallet['ticket:gear'] || 0, toast: document.getElementById('toast').textContent }; });
      ok(af.tw === 0 && !af.sh && !(await rcVis()) && af.gold >= w0.gold && /보상 \d+개 받음/.test(af.toast), 'v6xx 「모두 받기」 — 받고(은자 안 씀) 칸이 숨는다', af.toast);
      await free(a0); }
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
    // 장비 창 다듬기(gr-) — 가방에 더 좋은 모자를 넣으면 ▲ → 누르면 비교(전투력 +) → 「끼기」 → ▲ 사라짐 · 가방 NEW 점은 한 번 보고 나면 꺼진다
    { if (await page.evaluate(() => document.getElementById('panel').classList.contains('open'))) await page.click('#panel-close');
      await page.click('#mb .nb[data-tab="bag"]'); await sub('가방'); await sub('장착');   // 가방을 한 번 열어 「본 것」을 남겨 둔다
      const U = await page.evaluate(() => { const G = window.__s2.g.S.gear, u = 9e8 + Math.floor(Math.random() * 1e6);
        G.bag.push({ uid: u, slot: 'hat', g: 6, up: 1, subs: [{ k: 'crit', v: 60 }], rr: 0, lock: false }, { uid: u + 1, slot: 'ring', g: 0, up: 0, subs: [], rr: 0, lock: false }); return u; });
      await sub('장착');   // 다시 그리기(가방은 아직 안 봄)
      const HC = '#wb .eqcell:has(img[alt="모자"])';
      const a0 = await page.evaluate((s) => !!document.querySelector(s)?.querySelector('.gr-up') && document.querySelector(s).classList.contains('gr-has-up'), HC);
      await page.click(HC); await page.waitForSelector('#wb .gr-cmp');
      const c1 = await page.evaluate(() => { const p = document.querySelector('#wb .gr-cmp-pw'); return { up: p.classList.contains('up'), t: p.textContent, ups: document.querySelectorAll('#wb .gr-cmp-r em.up').length, pick: !!document.querySelector('#wb .inv-tile.gr-pick') }; });
      ok(a0 && c1.up && /▲ \+/.test(c1.t) && c1.ups > 0 && c1.pick, '장착 — 가방에 더 좋은 모자 ▲ · 누르면 비교(지금 | 바꾸면 · 전투력 ▲)', `${c1.t} · ▲ ${c1.ups}줄`);
      await page.click('#wb .gr-cmp-eq');
      const c2 = await until(() => page.evaluate(({ s, u }) => ({ on: window.__s2.g.S.gear.eq.hat?.uid === u, arrow: !!document.querySelector(s)?.classList.contains('gr-has-up'), cmp: !!document.querySelector('#wb .gr-cmp') }), { s: HC, u: U }), (v) => v.on && !v.arrow);
      ok(c2.on && !c2.arrow && !c2.cmp, '「끼기」 → 모자가 바뀌고 ▲ · 비교가 사라진다', JSON.stringify(c2));
      await sub('가방');
      await page.click('#wb .gr-so:text-is("새로 얻은 순")');
      const n1 = await page.evaluate((u) => ({ dot: !!document.querySelector(`#wb .inv-tile[data-uid="${u + 1}"] .gr-new`), first: document.querySelector('#wb .inv-tile')?.dataset.uid === String(u + 1), bar: /\d+개 · 강화석 \+\S+ · 조각 \+\S+|없어요/.test(document.querySelector('#wb .gr-dis')?.textContent || '') }), U);
      await sub('장착'); await sub('가방');
      const n2 = await page.evaluate((u) => !!document.querySelector(`#wb .inv-tile[data-uid="${u + 1}"]`) && !document.querySelector(`#wb .inv-tile[data-uid="${u + 1}"] .gr-new`), U);
      ok(n1.dot && n1.first && n1.bar && n2, '가방 — 새로 얻은 반지에 NEW · 「새로 얻은 순」 맨 앞 · 일괄 분해 띠(n개 · 강화석 · 조각) · 다시 열면 NEW 꺼짐', JSON.stringify({ ...n1, gone: n2 }));
      await page.click('#wb .gr-so:text-is("등급순")'); await page.click('#panel-close'); }
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
    { // 토벌 화면(rd-) — 남은 횟수 점 = 엔진 · 별 칩 셋 · 깬 두목 수만큼 카드 · 그림이 뜬다 · 별 셋이면 금테(색칠한 별 셋)
      const r0 = await page.evaluate(() => JSON.stringify(window.__s2.g.S.raid ?? null));
      await page.evaluate(() => { const g = window.__s2.g; g.S.raid ??= { star: {}, best: {} }; g.S.raid.star = { ...(g.S.raid.star || {}), 1: 3 }; });
      await page.click('#panel-body .subtabs button:has-text("수련동")'); await page.waitForTimeout(150);
      await page.click('#panel-body .subtabs button:has-text("토벌")'); await page.waitForTimeout(200);
      const im = await until(() => page.evaluate(() => [...document.querySelectorAll('#wb .rd-card .rdimg')].map((i) => i.complete && i.naturalWidth > 0)), (v) => v.length && v.every(Boolean));
      const rd = await page.evaluate(() => { const g = window.__s2.g, q = (s) => document.querySelectorAll(s); const g1 = document.querySelector('#wb .rd-card.rd-gold');
        return { pips: q('#wb .rd-pips i').length, on: q('#wb .rd-pips i.on').length, left: g.raidLeft(), chips: q('#wb .rd-chip').length, cards: q('#wb .rd-card').length, beat: Object.keys(g.S.chb || {}).filter((c) => +c >= 1 && +c <= 15).length,
          gold: q('#wb .rd-gold').length, goldSt: g1 ? g1.querySelectorAll('.rd-st i.on').length : 0, btns: q('#wb .rd-card .rd-btns .btn').length, empty: q('#wb .rd-empty').length, over: document.querySelector('#wb').scrollWidth - document.querySelector('#wb').clientWidth }; });
      ok(rd.pips === 2 && rd.on === rd.left && rd.chips === 3 && rd.cards === rd.beat && rd.cards >= 1 && im.every(Boolean) && rd.gold === 1 && rd.goldSt === 3 && rd.btns === rd.cards * 2 && !rd.empty && rd.over <= 0, '토벌 화면: 횟수 점 · 별 칩 셋 · 깬 두목 카드(그림) · 별 셋 금테', JSON.stringify(rd));
      await page.evaluate((s) => { const g = window.__s2.g, v = JSON.parse(s); if (v) g.S.raid = v; else delete g.S.raid; }, r0);
      await page.click('#panel-body .subtabs button:has-text("수련동")'); await page.waitForTimeout(150);
      await page.click('#panel-body .subtabs button:has-text("토벌")'); await page.waitForTimeout(200); }
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
    // v628 처치 — 약해진 무리(여섯)에 넓은 무공(이 싸움에만 칸 하나 더 · 세이브 무공은 그대로) → 여섯이 날아가고 「일망타진 ×6」 외침 · 큰 처치 멈칫
    //   전직 0 → 5차로 바꾸면(그리기만) 손잡이가 그 차수를 알림 · 한꺼번에 40마리 → 주검은 30을 넘지 않음 · 콘솔 오류 0 · 칸 처치 수 · 기연은 되돌림
    { const a0 = await hold(), e0 = errs.length;
      const sv = await page.evaluate(() => { const g = window.__s2.g, T = g.stage(); return { adv: g.S.hero.adv | 0, kills: T.kills, ksb: g.S.killsSinceBoss, fate: JSON.stringify(g.fate()), big: window.__s2.klBig() }; });
      const burst = (adv, n = 6, maxT = 6) => page.evaluate(([adv, n, maxT]) => {
        const g = window.__s2.g, F = g.ensureFight(), H = F.hero; g.S.hero.adv = adv;
        H.y = 0; H.vy = 0; H.plat = 0; H.drop = -1; H.target = -1; F.mobs.length = 0;
        for (let j = 0; j < n; j++) F.spawn('a', F.def.map.spots[j % F.def.map.spots.length]);
        F.mobs.forEach((m, i) => { m.x = H.x + (H.face || 1) * (240 + (i % 8) * 110); m.y = 0; m.plat = 0; m.hp = 1; });
        window.__klKit0 ??= H.kit; H.kit = [...(window.__klKit0 || []), { id: `${g.S.hero.job}_3`, kind: 'active', shape: 'circle', range: 1.4, maxT, hits: 1, coef: 900, cdMs: 9000, auto: true, crit: 0 }];
        H.cds = H.kit.map(() => 0); H.gcd = 0; F.press({ slot: H.kit.length - 1 }); window.__s2.klStat(true);
      }, [adv, n, maxT]);
      // 셈(klStat)으로 본다 — 바쁜 기계에서 화면이 잠깐 멈춰도(주검은 1초 남짓 산다) 놓치지 않게
      const info = () => page.evaluate(() => ({ i: window.__s2.klInfo(), call: window.__s2.klLast(), live: window.__s2.klLive(), big: window.__s2.klBig(), st: window.__s2.klStat() }));
      await burst(0);
      const k0 = await until(info, (v) => v.i?.adv === 0 && v.i?.cls === 2 && v.st.launched >= 6 && v.st.calls > 0, 4000);
      ok(k0.i?.adv === 0 && k0.i?.cls === 2 && k0.st.launched >= 6 && k0.st.calls > 0 && /^일망타진 ×([6-9]|\d\d)$/.test(k0.call) && k0.st.peak >= 6 && k0.st.peak <= 30, 'v628 처치 — 넓은 무공으로 여섯 → 날려보내기(2차 무공 몫) · 「일망타진 ×6」 외침 · 0차', JSON.stringify(k0));
      await page.waitForTimeout(1000);
      await page.evaluate(() => { window.__s2.g.S.hero.adv = 5; });   // 전직 차수를 먼저 올리고 전직 순간(느린 화면)이 끝난 뒤에 — 큰 처치 멈칫은 느린 화면과 겹치지 않는다
      await page.waitForTimeout(400); await until(() => page.evaluate(() => !document.querySelector('#au-skip, .jb-ban')), (v) => v, 6000); await page.waitForTimeout(800);
      const b5 = (await info()).big; await burst(5);
      const k5 = await until(info, (v) => v.i?.adv === 5 && v.st.launched >= 6 && v.st.calls > 0 && v.big > b5, 4000);
      ok(k5.i?.adv === 5 && k5.st.launched >= 6 && k5.st.calls > 0 && k5.big > b5 && k5.st.motes >= 6, 'v628 처치 — 5차로 바꾸면 손잡이가 5차 · 날려보내기 · 외침 · 큰 처치 멈칫 · 경험치 구슬', JSON.stringify(k5));
      await page.waitForTimeout(1000);
      await burst(5, 40, 40);   // 한 무공에 마흔
      const c1 = await until(info, (v) => v.st.launched >= 20 && /일망타진 ×\d\d/.test(v.call), 4000);
      ok(c1.st.peak <= 30 && c1.st.peak >= 25 && c1.live <= 30 && /일망타진 ×\d\d/.test(c1.call), 'v628 처치 — 한꺼번에 40마리여도 주검은 30을 넘지 않음', JSON.stringify({ peak: c1.st.peak, live: c1.live, call: c1.call }));
      await page.evaluate((sv) => { const g = window.__s2.g, T = g.stage(), H = g.ensureFight().hero; g.S.hero.adv = sv.adv; T.kills = sv.kills; g.S.killsSinceBoss = sv.ksb; Object.assign(g.fate(), JSON.parse(sv.fate)); if (window.__klKit0) { H.kit = window.__klKit0; H.cds = undefined; delete window.__klKit0; } }, sv);
      await page.waitForTimeout(1200);
      ok(errs.length === e0 && await page.evaluate(() => window.__s2.klLive() <= 30), 'v628 처치 — 콘솔 오류 없음', errs.slice(e0).join(' | '));
      await free(a0); }
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
      // v6xx 기연 카드 — 뒷면(緣)으로 깔리고 뒤집힘 · 앞면 그림이 뜬다 · 깔리는 중에 누르면 고르지 않고 바로 앞면
      { const fv = () => page.evaluate(() => { const r = document.querySelector('#modal .fate-row'); return { deal: r.classList.contains('fate-deal'), up: r.classList.contains('fate-up'), backs: r.querySelectorAll('.fate-back em').length, imgs: [...r.querySelectorAll('.fate-ic img')].map((im) => im.complete && im.naturalWidth > 0), tiers: [...r.querySelectorAll('.fate-card')].map((b) => [...b.classList].find((c) => /^fate-t[cbp]$/.test(c))), ready: window.__s2.g.fateState().ready, modal: !document.getElementById('modal').classList.contains('hidden') }; });
        const f0 = await fv();
        await page.evaluate(() => { const b = document.querySelectorAll('#modal .fate-card')[1]; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.click(); });   // 깔리는 중(0.9초 안)에 바로 — 손가락 탭과 같은 순서
        const f1 = await fv();
        ok(f0.deal && !f0.up && f0.backs === 3 && f1.up && !f1.deal && f1.ready === 1 && f1.modal, 'v6xx 기연 카드 — 뒷면으로 깔림 · 깔리는 중에 누르면 고르지 않고 앞면으로', JSON.stringify({ f0: [f0.deal, f0.up, f0.backs], f1: [f1.up, f1.ready, f1.modal] }));
        const f2 = await until(fv, (v) => v.imgs.length === 3 && v.imgs.every(Boolean));
        ok(f2.imgs.length === 3 && f2.imgs.every(Boolean) && f2.tiers.every(Boolean), 'v6xx 기연 카드 앞면 그림 셋이 뜬다 · 등급 테두리', JSON.stringify({ imgs: f2.imgs, tiers: f2.tiers })); }
      // 고르기 — 경험치가 아닌 카드(지갑으로 바로 셀 수 있는 것)
      const pick = async () => {
        const p = await page.evaluate(() => { const g = window.__s2.g, cs = g.fateState().cards, i = cs.findIndex((c) => c.k !== 'exp'); return { i, k: cs[i].k, n: cs[i].n, w: g.S.wallet[cs[i].k] || 0 }; });
        await page.waitForSelector('#modal .fate-row.fate-up'); await page.click(`#modal .fate-card >> nth=${p.i}`);
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
    // v6xx 캐릭터 화면 — 스탯(st-: 전투력 띠 · 능력치 네 칸 그림 · 최종 피해 네 칸과 출처 · 작은 모습은 창을 닫으면 멈춤) · 기록(rc-: 묶음 · 그림 칸 · 시작한 날) · 마스터리(ma-: 단마다 노드 · 선 · 「배우기」 → 익힘)
    { const a0 = await hold();
      const pics = (sel) => page.evaluate(async (s) => { const ims = [...document.querySelectorAll(s)], t = Date.now(); while (ims.some((i) => !i.complete) && Date.now() - t < 3000) await new Promise((r) => setTimeout(r, 50)); return { n: ims.length, up: ims.filter((i) => i.complete && i.naturalWidth > 0).length }; }, sel);
      const over = () => page.evaluate(() => { const pb = document.getElementById('panel-body'); return pb.scrollWidth - pb.clientWidth; });
      await page.click('#mb .nb[data-tab="char"]'); await sub('스탯'); await page.waitForSelector('#wb .st-hero canvas');
      const s0 = await page.evaluate(() => ({ heads: [...document.querySelectorAll('#wb .card h3')].map((h) => h.firstChild.textContent.trim()), pw: document.querySelector('#wb .st-pw b')?.textContent || '', split: [...document.querySelectorAll('#wb .st-split span')].map((x) => x.textContent), hunt: document.querySelector('#wb .st-split b')?.textContent || '',
        tiles: [...document.querySelectorAll('#wb .st-tiles:not(.st-fin) .st-t')].map((t) => t.dataset.k).join(), fin: [...document.querySelectorAll('#wb .st-fin .st-f')].map((t) => t.dataset.k).join(), why: [...document.querySelectorAll('#wb .st-fin .st-w')].map((x) => x.textContent) }));
      const sp = await pics('#wb .st-ic img');
      ok(['전투력', '능력치', '최종 피해', '스탯 배분'].every((h) => s0.heads.includes(h)) && !!s0.pw && s0.pw === s0.hunt && s0.split.join() === '사냥,대결', 'v6xx 스탯 — 전투력 띠(큰 수 = 사냥 · 대결) · 능력치 · 최종 피해 · 스탯 배분 카드', `${s0.pw} · ${s0.heads.join('/')}`);
      ok(s0.tiles === 'atk,hp,def,crit' && sp.n === 4 && sp.up === 4 && s0.fin === 'final1,final2,final3,final4' && s0.why.length === 4 && /마스터리/.test(s0.why[0]) && /영물/.test(s0.why[1]) && /강호행/.test(s0.why[2]) && /동료/.test(s0.why[3]) && (await over()) <= 1, 'v6xx 스탯 — 능력치 네 칸 그림이 뜬다 · 최종 피해 ①~④ 칸마다 출처 한 줄 · 넘침 없음', `${sp.up}/${sp.n} · ${s0.why.join(' | ')}`);
      const cvN = () => page.evaluate(() => +(document.querySelector('.st-cv')?.dataset.n || 0));
      const n1 = await until(cvN, (v) => v >= 2);
      await page.click('#panel-close'); await page.waitForTimeout(250);
      const n2 = await cvN(); await page.waitForTimeout(600); const n3 = await cvN();
      ok(n1 >= 2 && n2 === n3, 'v6xx 스탯 — 작은 모습이 그려지고 창을 닫으면 멈춤', `${n1} → 닫음 ${n2}/${n3}`);
      // 기록 — 묶음 넷 · 열여덟 칸(그림) · 시작한 날
      await page.click('#mb .nb[data-tab="char"]'); await sub('기록'); await page.waitForSelector('#wb .rc-t');
      const r0 = await page.evaluate(() => { const c = window.__s2.g.S.created, d = new Date(c); return { cards: [...document.querySelectorAll('#wb .rc-card h3')].map((h) => h.firstChild.textContent.trim()).join('/'), tiles: document.querySelectorAll('#wb .rc-t').length, big: [...document.querySelectorAll('#wb .rc-t b')].filter((b) => b.textContent.trim()).length, since: document.querySelector('#wb .rc-since')?.textContent || '', day: `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 시작` }; });
      const rp = await pics('#wb .rc-ic img');
      ok(r0.cards === '무인 기록/전투/뽑기 · 강화/모음' && r0.tiles === 18 && r0.big === 18 && rp.n === 18 && rp.up === 18 && (await over()) <= 1, 'v6xx 기록 — 묶음 넷 · 칸 열여덟(그림 · 큰 숫자) · 넘침 없음', `${r0.cards} · 그림 ${rp.up}/${rp.n}`);
      ok(r0.since.startsWith(r0.day) && /· \d+일째$/.test(r0.since), 'v6xx 기록 — 세이브를 시작한 날 · 며칠째', r0.since);
      // 마스터리 — 노드 = 표 · 단 머리 · 「먼저」 선 · 배울 수 있는 노드 「배우기」 → 익힘(✓) · 다음 노드로 가는 선이 금빛
      await sub('마스터리'); await page.waitForSelector('#wb .ma-node');
      const sv = await page.evaluate(() => { const g = window.__s2.g, H = g.S.hero, s = JSON.stringify({ done: H.mastery.done, lv: H.lv, gold: g.S.wallet.gold || 0 }); H.mastery.done = []; H.lv = Math.max(H.lv, 30); g.S.wallet.gold = Math.max(g.S.wallet.gold || 0, 1e7); document.querySelector('#panel-body .subtabs button.on').click(); return s; });
      const mz = () => page.evaluate(async () => { const u = (p) => new URL(p, location.href).href, { MASTERY } = await import(u('js/s2/tables/skills.js')), q = (s) => [...document.querySelectorAll(s)];
        return { nodes: q('#wb .ma-node').length, want: MASTERY.length, heads: q('#wb .ma-dh').length, deep: Math.max(...MASTERY.map((m) => m.depth)), links: q('#wb .ma-node.ma-link').length, needs: MASTERY.filter((m) => m.need).length, can: q('#wb .ma-node.ma-can').map((n) => n.dataset.id), canBtn: q('#wb .ma-node.ma-can .ma-btn').map((b) => b.textContent),
          lock: q('#wb .ma-node.ma-lock em').map((e) => e.textContent), done: q('#wb .ma-node.ma-done').map((n) => n.dataset.id), on: q('#wb .ma-node.ma-on').map((n) => n.dataset.id), eng: window.__s2.g.S.hero.mastery.done.slice(), lv: window.__s2.g.S.hero.lv }; });
      const m0 = await until(mz, (v) => v.done.length === 0 && v.can.length > 0);
      const mp = await pics('#wb .ma-ic img');
      ok(m0.nodes === m0.want && m0.heads === m0.deep && m0.links === m0.needs && m0.done.length === 0 && m0.can.length >= 1 && m0.canBtn.every((t) => t === '배우기') && m0.lock.length === m0.want - m0.can.length && m0.lock.every((t) => /^Lv \d+부터 · 지금 Lv \d+$|먼저$/.test(t)) && mp.up === mp.n && mp.n === m0.want && (await over()) <= 1,
        'v6xx 마스터리 — 노드 = 표 · 단 머리 · 「먼저」 선 · 배울 수 있는 것만 「배우기」 · 잠김은 Lv n부터 · 지금 Lv m', `노드 ${m0.nodes} · 선 ${m0.links} · 배울 ${m0.can.join()} · ${m0.lock[m0.lock.length - 1]}`);
      const id = m0.can[0];
      await page.click(`#wb .ma-node[data-id="${id}"] .ma-btn`);
      const m1 = await until(mz, (v) => v.done.includes(id));
      const kid = await page.evaluate(async (x) => { const { MASTERY } = await import(new URL('js/s2/tables/skills.js', location.href).href); return MASTERY.find((m) => m.need === x)?.id || ''; }, id);
      ok(m1.done.includes(id) && m1.eng.includes(id) && !m1.can.includes(id) && (!kid || m1.on.includes(kid)) && /✓/.test(await page.textContent(`#wb .ma-node[data-id="${id}"]`)), 'v6xx 마스터리 — 「배우기」 → 그 노드 익힘(✓) · 다음 노드로 가는 선이 켜짐', `${id} → ${kid} · ${m1.on.join()}`);
      await page.evaluate((s) => { const g = window.__s2.g, H = g.S.hero, o = JSON.parse(s); H.mastery.done = o.done; H.lv = o.lv; g.S.wallet.gold = o.gold; g.dirtyStats = true; }, sv);
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
        const tc = g.todayChest.bind(g); g.todayChest = () => ({ ...tc(), can: false }); g.books.ach.claimable = () => []; g.bountyCan = () => 0;   // 현상수배도 g.mailCan = () => 0; g.festCan = () => 0; g.mxCan = () => 0; g.books.daily.claimable = () => []; g.books.weekly.claimable = () => []; g.canAttend = () => false; g.passCan = () => 0;   // v637 우편 · 축제 · 요괴록 · 임무 점도
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
      { const ds = await page.evaluate(() => [...document.querySelectorAll('#panel-body .seg.wide button.dot-on')].map((x) => x.textContent));   // v637 점이 칸마다 — 덤을 받으면 「상점」 칸 점이 꺼지고, 임무 창 점은 다른 칸(축제 등) 때문에만 남는다
        ok(!ds.includes('상점') && (!f1.dot || ds.length > 0), 'v604 덤을 받으면 상점 칸 빨간 점이 꺼진다(임무 창 점은 다른 칸 몫만)', JSON.stringify(ds)); }
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
    // 상점 진열대(sh-) — 물건 카드 일곱(그림 · 값 · 남은 수 점) · 덤 띠 · 머리의 자정까지 시계(1초마다) · 「모두」 → 품절 도장 · 은자가 모자라면 값이 붉게 · 가로 넘침 없음
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), shop: JSON.stringify(g.S.shop || null) }; g.S.shop = null; g.S.wallet.gold = 1e12; });
      await page.click('.nb[data-tab="town"]'); await sub('상점'); await page.waitForSelector('#wb .sh-grid .row.sh-card');
      const sh = () => page.evaluate(() => { const PB = document.getElementById('panel-body'), card = (n) => [...document.querySelectorAll('#wb .sh-card')].find((r) => r.querySelector('.name')?.textContent === n);
        const st = card('강화석 꾸러미'), gr = card('장비 뽑기권'), pr = gr?.querySelector('.sh-price');
        return { cards: document.querySelectorAll('#wb .sh-grid .row.sh-card').length, pics: document.querySelectorAll('#wb .sh-card .ico.pic img').length, free: !!document.querySelector('#wb .row.sh-free .ico.pic'), clock: document.querySelector('#sh-clock')?.textContent || '',
          pips: st?.querySelectorAll('.sh-pips b.on').length ?? -1, stamp: st?.querySelector('.sh-stamp')?.textContent || '', out: !!st?.classList.contains('sh-out'), short: !!pr?.classList.contains('sh-short'), col: pr ? getComputedStyle(pr).color : '', sw: PB.scrollWidth - PB.clientWidth }; });
      const s0 = await sh();
      ok(s0.cards === 7 && s0.pics === 7 && s0.free && s0.pips === 3 && !s0.stamp && !s0.short && /^\d\d:\d\d:\d\d 남음$/.test(s0.clock) && s0.sw <= 1, `상점 진열대 — 카드 일곱 · 그림 · 점 3 · 자정까지 시계 · 넘침 없음 @${W}`, `${s0.clock} sw ${s0.sw}`);
      const s1 = await until(sh, (v) => v.clock !== s0.clock, 2500);
      ok(s1.clock !== s0.clock, '상점 시계 — 1초마다 줄어든다', `${s0.clock} → ${s1.clock}`);
      await page.click('#wb .row:has(.name:text-is("강화석 꾸러미")) .btn:text-is("모두")');
      const s2 = await until(sh, (v) => v.out);
      ok(s2.out && s2.stamp === '품절' && s2.pips === 0, '「모두」 → 카드에 품절 도장 · 점이 다 꺼진다', s2.stamp);
      await page.evaluate(() => { window.__s2.g.S.wallet.gold = 1; }); await sub('패스'); await sub('상점');
      const s3 = await until(sh, (v) => v.short);
      const [rr, gg] = (/rgba?\((\d+), (\d+)/.exec(s3.col) || []).slice(1).map(Number);
      ok(s3.short && rr > 180 && gg < 140 && s3.out, '은자가 모자라면 값이 붉게(품절은 그대로)', s3.col);
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.shop = JSON.parse(T.shop) || undefined; for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close');
      const ck = await page.evaluate(() => new Promise((r) => { const t0 = document.querySelector('#sh-clock')?.textContent ?? ''; setTimeout(() => r([t0, document.querySelector('#sh-clock')?.textContent ?? '']), 1600); }));
      ok(ck[0] === ck[1], '창을 닫으면 상점 시계도 멈춘다(더 고치지 않음)', ck.join(' → '));
      await free(a0); }
    // v635 교환소(ex-) — 임무 → 교환소: 재화 알약 셋(그림 · 가진 수) · 버는 곳 줄(가기) · 물건 카드(그림 · 재화 값 · 이번 주 점) · 바꾸면 재화가 줄고 뽑기권이 는다 · 모자라면 값이 붉게 · 문파 없으면 공적 안내 · 넘침 없음
    { const a0 = await hold();
      console.log('— v635 교환소');
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), ex: JSON.stringify(g.S.ex || null), gid: g.S.guildId || null }; g.S.ex = null; g.S.guildId = null; Object.assign(g.S.wallet, { 'coin:fame': 100, 'coin:merit': 0, 'coin:blood': 0 }); });
      await page.click('.nb[data-tab="town"]'); await sub('교환소'); await page.waitForSelector('#wb .ex-grid .row.sh-card');
      const ex = () => page.evaluate(() => { const g = window.__s2.g, W = g.S.wallet, PB = document.getElementById('panel-body'), seg = [...document.querySelectorAll('#wb .ex-seg button')], cards = [...document.querySelectorAll('#wb .ex-grid .row.sh-card')], card = (n) => cards.find((r) => r.querySelector('.name')?.textContent === n);
        const gr = card('장비 뽑기권'), earn = [...document.querySelectorAll('#wb .row')].find((r) => /버는 곳$/.test(r.querySelector('.name')?.textContent || ''));
        return { seg: seg.map((b) => b.textContent.trim()), on: document.querySelector('#wb .ex-seg button.on')?.dataset.cur || '', segImg: seg.filter((b) => { const i = b.querySelector('img'); return i && i.complete && i.naturalWidth > 0; }).length,
          n: cards.length, pics: cards.filter((r) => r.querySelector('.ico.pic img')).length, gr: gr?.querySelector('.desc')?.textContent || '', grOff: !!gr?.querySelector('.btn')?.disabled, priceImg: !!cards[0]?.querySelector('.sh-price img'),
          short: cards.filter((r) => r.querySelector('.sh-price.sh-short')).length, earn: earn?.querySelector('.desc')?.textContent || '', earnName: earn?.querySelector('.name')?.textContent || '', clock: document.querySelector('#ex-clock')?.textContent || '',
          fame: W['coin:fame'] || 0, tk: W['ticket:gear'] || 0, key: PB.dataset.key, sw: PB.scrollWidth - PB.clientWidth, txt: (/undefined|NaN|null|\[object Object\]/.exec(document.getElementById('wb').textContent) || [''])[0] }; });
      const e0 = await until(ex, (v) => v.segImg === 3);
      ok(e0.seg.length === 3 && /^명성 100$/.test(e0.seg[0]) && /^공적 0$/.test(e0.seg[1]) && /^혈전패 0$/.test(e0.seg[2]) && e0.on === 'fame' && e0.segImg === 3, `v635 교환소 — 재화 알약 셋(그림 · 가진 수) · 처음은 명성 @${W}`, e0.seg.join(' / '));
      ok(e0.n === 4 && e0.pics === 4 && e0.priceImg && /명성 40/.test(e0.gr) && /이번 주 5\/5/.test(e0.gr) && /^\d+일 \d+시간 남음$|^\d+시간 \d+분 남음$/.test(e0.clock) && e0.sw <= 1 && !e0.txt, 'v635 명성 진열대 — 카드 넷(그림 · 명성 값 · 이번 주 점) · 월요일까지 시계 · 넘침 없음', `${e0.gr} · ${e0.clock} · sw ${e0.sw}`);
      ok(e0.earnName === '명성 버는 곳' && /대결 이기면 12 · 지면 5/.test(e0.earn), 'v635 버는 곳 줄 — 대결 이기면 12 · 지면 5', e0.earn);
      await page.click('#wb .ex-grid .row:has(.name:text-is("장비 뽑기권")) .btn:text-is("바꾸기")');
      const e1 = await until(ex, (v) => v.fame === 60);
      ok(e1.fame === 60 && e1.tk - e0.tk === 1 && /이번 주 4\/5/.test(e1.gr) && /^명성 60$/.test(e1.seg[0]), 'v635 바꾸기 — 명성 −40 · 장비 뽑기권 +1 · 이번 주 4/5 · 알약 수도 줄어든다', `${e0.fame} → ${e1.fame} · ${e1.gr}`);
      await page.click('#wb .ex-seg button[data-cur="blood"]');
      const e2 = await until(ex, (v) => v.on === 'blood');
      ok(e2.on === 'blood' && e2.n === 5 && e2.short === 5 && e2.grOff && /월드보스 한 번 8/.test(e2.earn), 'v635 혈전패 — 카드 다섯 · 없으면 값이 붉고 단추 잠김 · 버는 곳(월드보스 한 번 8)', e2.earn);
      await page.click('#wb .ex-seg button[data-cur="merit"]');
      const e3 = await until(ex, (v) => v.on === 'merit');
      ok(e3.on === 'merit' && e3.n === 5 && /문파에 들면/.test(e3.earn), 'v635 공적 — 문파가 없으면 「문파에 들면 모여요」', e3.earn);
      await page.click('#wb .row:has(.name:text-is("공적 버는 곳")) .btn:text-is("가기")');
      const e4 = await until(ex, (v) => v.key === 'social:3');
      ok(e4.key === 'social:3', 'v635 「가기」 → 무림 · 문파', e4.key);
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.ex = JSON.parse(T.ex) || undefined; g.S.guildId = T.gid; for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close');
      ok(await page.evaluate(() => !document.querySelector('#ex-clock')), 'v635 창을 닫으면 교환소 시계도 없다');
      await free(a0); }
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
    // v635 우편 — 임무 → 우편: 환영 선물 · 놓친 보상(곧 사라짐 붉게) · 받기 → 지갑 · 모두 받기 → 빈 함 · 빨간 점 · 받을 보상 칸
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), mail: JSON.stringify(g.S.mail || null) }; g.S.mail = undefined;
        const m = g.mailPush('missed', '어제 일일 임무 — 못 받은 보상 2개', { exp: 1234, gold: 5678, 'ticket:time': 4 }); m.at = g.now - 12.5 * 86400000; m.exp = g.now + 1.5 * 86400000; });
      await page.click('.nb[data-tab="town"]');
      const tabs = await page.evaluate(() => [...document.querySelectorAll('#panel-body .subtabs button')].slice(0, 3).map((b) => b.textContent).join(','));
      ok(tabs === '오늘,우편,출석', 'v635 우편 — 임무 칸: 오늘 다음 우편', tabs);
      await sub('우편'); await page.waitForSelector('#wb .row.ml-row');
      const ml = () => page.evaluate(() => { const g = window.__s2.g, rs = [...document.querySelectorAll('#wb .row.ml-row')], W = g.S.wallet;
        return { n: rs.length, head: document.querySelector('#wb .card h3')?.textContent || '', all: !!document.querySelector('#wb .row.ml-all'), names: rs.map((r) => r.querySelector('.name').textContent), when: rs.map((r) => r.querySelector('.ml-when')?.textContent || ''),
          soon: rs.map((r) => !!r.querySelector('.ml-soon')), chips: rs.map((r) => r.querySelectorAll('.ms-chip').length), gold: rs.map((r) => r.querySelector('.ms-chip[data-k="gold"] b')?.textContent || ''),
          icons: rs.filter((r) => r.querySelector('.ico img')).length, empty: document.querySelector('#wb .ml-empty')?.textContent || '', emptyImg: !!document.querySelector('#wb .ml-empty img'),
          tk: W['ticket:gear'] || 0, st: W['item:stone'] || 0, can: g.mailCan(), dot: !!document.querySelector('.nb[data-tab="town"]')?.classList.contains('dot-on'), rc: !document.getElementById('rc').classList.contains('hidden'),
          toast: document.getElementById('toast')?.textContent || '', bad: (/undefined|NaN|null|\[object Object\]/.exec(document.getElementById('wb').textContent) || [''])[0] }; });
      const v0 = await until(ml, (v) => v.n === 2 && v.icons === 2);
      ok(v0.n === 2 && v0.all && /받을 우편 2/.test(v0.head) && /14일/.test(v0.head) && v0.names[0] === '어제 일일 임무 — 못 받은 보상 2개' && v0.names[1] === '우편함이 생겼어요' && v0.icons === 2 && !v0.bad, '우편 — 두 통(나중 것부터) · 모두 받기 줄 · 편지 그림', JSON.stringify(v0));
      ok(/^오늘 · 14일 남음$/.test(v0.when[1]) && /^12일 전 · 2일 남음$/.test(v0.when[0]) && !v0.soon[1] && v0.soon[0] && v0.chips[1] === 2 && v0.chips[0] === 3 && v0.gold[0] === '5678', '우편 — 언제 · 남은 날(이틀 이하 붉게) · 보상 칩(은자 그대로)', JSON.stringify([v0.when, v0.soon, v0.chips, v0.gold]));
      ok(v0.dot && v0.rc, '우편이 있으면 임무에 빨간 점 · 받을 보상 칸', `${v0.dot} ${v0.rc}`);
      await page.screenshot({ path: path.join(OUT, `s2-mail-${W}.png`) });
      await page.click('#wb .row.ml-row:has(.name:text-is("우편함이 생겼어요")) .btn');
      const v1 = await until(ml, (v) => v.n === 1);
      ok(v1.n === 1 && v1.tk === v0.tk + 5 && v1.st === v0.st + 30 && /우편 받음/.test(v1.toast) && /장비 뽑기권 \+5/.test(v1.toast), '받기 → 장비 뽑기권 5 · 강화석 30 · 알림', `${v0.tk}→${v1.tk} · ${v1.toast}`);
      await page.click('#wb .row.ml-all .btn');
      const v2 = await until(ml, (v) => v.n === 0 && !!v.empty);
      ok(v2.n === 0 && !v2.all && /우편이 없어요/.test(v2.empty) && v2.emptyImg && v2.can === 0 && /받을 우편 0/.test(v2.head) && /우편 1통 받음 — 은자 \+5678 · 시간 티켓 \+4 · 경험치 \+1234/.test(v2.toast), '모두 받기 → 빈 함(흐린 편지) · 알림에 경험치', `${v2.empty} · ${v2.toast}`);
      await page.screenshot({ path: path.join(OUT, `s2-mail-empty-${W}.png`) });
      // 받을 보상 → 모두 받기도 우편을 받는다
      await page.evaluate(() => { window.__s2.g.mailPush('gift', '시험 선물', { 'item:stone': 7 }); });
      await page.click('#panel-close'); await page.waitForTimeout(1100);
      await page.click('#rc'); await page.waitForSelector('#modal:not(.hidden) .rc-r');
      const rc = await page.evaluate(() => [...document.querySelectorAll('#modal .rc-r span')].map((x) => x.textContent));
      const s0 = await page.evaluate(() => window.__s2.g.S.wallet['item:stone'] || 0);
      await page.click('#modal .btn:text-is("모두 받기")'); await page.waitForTimeout(200);
      const s1 = await page.evaluate(() => ({ st: window.__s2.g.S.wallet['item:stone'] || 0, can: window.__s2.g.mailCan() }));
      ok(rc.includes('우편') && s1.can === 0 && s1.st >= s0 + 7, '받을 보상 칸에 「우편」 · 모두 받기가 우편도 받는다', `${rc.join(',')} · 돌 ${s0}→${s1.st}`);
      if (await page.isVisible('#modal:not(.hidden)')) await page.click('#modal .btn:text-is("닫기")').catch(() => {});
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, Wl = g.S.wallet; g.S.mail = JSON.parse(T.mail) || undefined; for (const k of Object.keys(Wl)) delete Wl[k]; Object.assign(Wl, JSON.parse(T.wallet)); delete window.__t; });
      await free(a0); }
    // v616 무한 탑 — 던전 → 무한 탑: 탑 그림(지금 층 금빛 · 깬 층 · 위 다섯 층 · 10층마다 상자) · 지금 층 · 단추 둘 · 이정표 상자 받기
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), tower: JSON.stringify(g.S.tower) }; g.S.tower = { best: 18 }; });
      await page.click('#mb .nb[data-tab="dgn"]'); await sub('무한 탑'); await page.waitForSelector('#wb .tw-tower .tw-fl');
      const tw = () => page.evaluate(() => { const g = window.__s2.g, fl = [...document.querySelectorAll('#wb .tw-fl')], cur = document.querySelector('#wb .tw-fl.tw-cur'), tower = { width: document.querySelector('#wb .tw-tower').offsetWidth };   // 돌린 화면(세로 폰)에서도 놓인 너비로
        return { n: fl.length, top: fl[0]?.dataset.f, cur: cur?.dataset.f, curGlow: cur ? getComputedStyle(cur.querySelector('.tw-body')).boxShadow !== 'none' : false, curW: cur ? cur.querySelector('.tw-body').offsetWidth : 0, towerW: Math.round(tower.width),
          done: fl.filter((e) => e.classList.contains('tw-done')).length, next: document.querySelector('#wb .tw-fl.tw-next')?.dataset.f, chest: fl.filter((e) => e.querySelector('img')).map((e) => e.dataset.f).join(),
          big: document.querySelector('#wb .tw-now b')?.textContent, btns: [...document.querySelectorAll('#wb .tw-side .btn')].map((b) => b.textContent).join(','),
          ms: [...document.querySelectorAll('#wb .row.tw-ms')].map((r) => `${r.dataset.f}:${r.querySelector('.btn').textContent}${r.querySelector('.btn').disabled ? '(잠김)' : ''}`).join(' '),
          tix: g.S.wallet['ticket:gear'] || 0, got: (g.S.tower.ms || []).join(), dot: document.querySelector('.nb[data-tab="dgn"]').dataset.dot === 'red' }; });   // v636 빨강 = 받을 것(금빛 · 파랑은 다른 점)
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
    // 임무 창 보상 보기(ms-) — 일일 줄마다 진행 막대 · 보상 칩(그림) · 받을 수 있는 줄은 ms-can · 「모두 받기」 → 다 받고 알림(종류마다 합) · 하루 상자 그림 닫힘 → 빛남 → 열림
    { const a2 = await hold();
      await page.evaluate(() => { const g = window.__s2.g, D = g.books.daily; window.__t = { wallet: JSON.stringify(g.S.wallet), daily: JSON.stringify(D.st), tg: g.S.todayGot ?? null };
        for (const id of Object.keys(D.st)) delete D.st[id];
        for (const id of ['d_kill', 'd_dungeon']) Object.assign(D.get(id), { p: D.defs.get(id).need, done: true, got: false });
        Object.assign(D.get('d_gacha'), { p: 12, done: false, got: false }); });
      await page.click('.nb[data-tab="town"]'); await sub('일일'); await page.waitForSelector('#wb .ms-row .ms-chip');
      for (const c of await page.$$('#wb .ms-chip img')) await c.scrollIntoViewIfNeeded();
      const ms = () => page.evaluate(() => { const rows = [...document.querySelectorAll('#wb .ms-row')], imgs = [...document.querySelectorAll('#wb .ms-row .ms-chip img')];
        const r = (t) => rows.find((x) => x.querySelector('.name')?.textContent === t);
        return { n: rows.length, chips: rows.filter((x) => x.querySelector('.ms-chip')).length, bars: rows.filter((x) => x.querySelector('.ms-bar') || x.querySelector('.ms-ok')).length, imgs: imgs.length, up: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
          kill: r('몹 500마리 잡기')?.className || '', killBtn: r('몹 500마리 잡기')?.querySelector('.btn')?.disabled, gacha: r('장비 뽑기 30번')?.className || '', all: !!document.querySelector('#wb .ms-all .btn:not(:disabled)'), allTxt: document.querySelector('#wb .ms-all .btn')?.textContent || '',
          toast: [...document.querySelectorAll('#toast .toast')].map((x) => x.textContent).join(' | '), can: window.__s2.g.books.daily.claimable().length, sw: document.getElementById('panel-body').scrollWidth - document.getElementById('panel-body').clientWidth }; });
      const m0 = await until(ms, (v) => v.up === v.imgs && v.imgs > 0);
      ok(m0.n === 7 && m0.chips === 7 && m0.bars === 7 && m0.up === m0.imgs && m0.up >= 7 && m0.sw <= 1, '임무 창 — 일일 일곱 줄 · 진행 막대 · 보상 칩 그림이 뜬다', JSON.stringify(m0));
      ok(/ms-can/.test(m0.kill) && m0.killBtn === false && /ms-on/.test(m0.gacha) && !/ms-can/.test(m0.gacha), '받을 수 있는 줄은 ms-can(받기 열림) · 하는 중은 ms-on', `${m0.kill} / ${m0.gacha}`);
      ok(m0.all && m0.allTxt === '모두 받기', '받을 임무 둘 이상 → 「모두 받기」', m0.allTxt);
      await page.screenshot({ path: path.join(OUT, `s2-mission-${W}.png`) });
      await page.click('#wb .ms-all .btn');
      const m1 = await until(ms, (v) => v.can === 0 && /일일 임무 2개 받음/.test(v.toast));
      ok(m1.can === 0 && /일일 임무 2개 받음 — 은자 \+/.test(m1.toast) && /시간 티켓 \+4/.test(m1.toast) && /ms-done/.test(m1.kill) && !m1.all, '「모두 받기」 → 둘 다 받음 · 알림(은자 · 시간 티켓 합) · 줄은 끝(ms-done)', m1.toast);
      // 하루 상자 — 닫힘 → (오늘 할 일을 다 한 셈) 빛남 → 누르면 열림
      await page.evaluate(() => { window.__s2.g.S.todayGot = null; }); await sub('오늘'); await page.waitForSelector('#wb .td-chest .ms-chest img');
      const ch = () => page.evaluate(() => { const b = document.querySelector('#wb .td-chest'), im = b?.querySelector('.ms-chest img'); return { st: b?.dataset.st || '', cls: b?.className || '', bar: b?.querySelector('.ms-bar span')?.textContent || '', pic: !!(im && im.complete && im.naturalWidth > 0), modal: !document.getElementById('modal').classList.contains('hidden') }; });
      const c0 = await until(ch, (v) => v.pic);
      ok(c0.st === 'closed' && /^\d+ \/ \d+$/.test(c0.bar) && c0.pic, '하루 상자 — 닫힌 상자 그림 · n / m', JSON.stringify(c0));
      await page.evaluate(() => { const g = window.__s2.g, t = g.today.bind(g); g.today = () => t().map((x) => ({ ...x, done: x.open })); }); await sub('일일'); await sub('오늘');
      const c1 = await until(ch, (v) => v.st === 'ready');
      ok(c1.st === 'ready' && /can/.test(c1.cls), '다 하면 상자가 빛난다(열 수 있음)', JSON.stringify(c1));
      await page.click('#wb .td-chest');
      const c2 = await until(ch, (v) => v.st === 'opened' && /got/.test(v.cls));
      ok(c2.st === 'opened' && /got/.test(c2.cls) && c2.modal, '상자를 열면 열린 상자 · 받은 것 창', JSON.stringify(c2));
      await page.click('#modal .btn >> nth=0').catch(() => {});
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet, D = g.books.daily; delete g.today; g.S.todayGot = T.tg ?? undefined;
        for (const k of Object.keys(D.st)) delete D.st[k]; Object.assign(D.st, JSON.parse(T.daily)); for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await page.click('#panel-close'); await free(a2); }
    // v6xx 수련동 · 원정 그림 카드 — 카드 넷(장 배경 그림이 뜬다) · Lv 1이면 넷 다 잠김 덮개 · 입장권 큰 숫자 · 원정 출발 → 남은 시간이 1초마다 줄어듦 · 시간이 지나면 받기 · 창을 닫으면 시계 멈춤
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { lv: g.S.hero.lv, exp: g.S.hero.exp, exped: JSON.stringify(g.S.exped), wallet: JSON.stringify(g.S.wallet) }; });
      await page.click('#mb .nb[data-tab="dgn"]'); await sub('수련동'); await page.waitForSelector('#wb .row.dg-card');
      await page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 1; g.S.hero.exp = 0; document.querySelector('#panel-body .subtabs button.on').click(); window.__t.lock = [...document.querySelectorAll('#wb .row.dg-card .dg-lockov')].map((e) => e.textContent); });   // Lv 1로 두고 같은 자리에서 다시 그려 읽음(사냥으로 레벨이 오르기 전에)
      const d0 = await until(() => page.evaluate(() => { const cs = [...document.querySelectorAll('#wb .row.dg-card')]; cs.forEach((c) => c.querySelector('.dg-bg').loading = 'eager');
        return { n: cs.length, imgs: cs.filter((c) => { const i = c.querySelector('.dg-bg'); return i.complete && i.naturalWidth > 0; }).length, lock: window.__t.lock, ov: cs.filter((c) => c.classList.contains('dg-lock') && getComputedStyle(c.querySelector('.dg-lockov')).position === 'absolute').length,
          ent: cs.map((c) => `${c.querySelector('.btn').textContent}${c.querySelector('.btn').disabled ? '(잠김)' : ''}`).join(), tix: document.querySelector('#wb .dg-tix > div > b')?.textContent, rg: document.querySelector('#wb .dg-rg')?.textContent || '', sweep: document.querySelector('#wb .row.dg-sweep .btn')?.textContent, iv: window.__s2.dgIv() }; }), (v) => v.imgs === 5);
      ok(d0.n === 5 && d0.imgs === 5 && d0.lock.length === 5 && d0.lock[0] === 'Lv 20부터 · 지금 Lv 1' && d0.ov >= 1 && d0.ent === '입장(잠김),입장(잠김),입장(잠김),입장(잠김),입장(잠김)', 'v6xx 수련동 카드 다섯(v636 기세동) — 그림이 뜬다 · Lv 1이면 잠김 덮개 「Lv 20부터 · 지금 Lv 1」', JSON.stringify(d0));
      ok(/^\d+\/12$/.test(d0.tix) && /2시간마다 1/.test(d0.rg) && d0.sweep === '모두 소탕' && d0.iv, 'v6xx 위에 입장권 큰 숫자 · 2시간마다 1 · 「모두 소탕」 · 창이 열린 동안 시계', `${d0.tix} · ${d0.rg}`);
      await page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = window.__t.lv; g.S.hero.exp = window.__t.exp; g.dirtyStats = true; g.S.exped.run = null; g.S.wallet['ticket:exped'] = 1; });
      await sub('원정'); await page.waitForSelector('#wb .row.dg-tile');
      const tl = await page.evaluate(() => [...document.querySelectorAll('#wb .row.dg-tile')].map((t) => `${t.dataset.h}:${t.querySelector('.btn').textContent}:${/^\S+$/.test(t.querySelector('.dg-chips span').textContent) ? 'ok' : 'x'}`).join(' '));
      ok(tl === '4:출발:ok 8:출발:ok 12:출발:ok' && await page.isVisible('#wb .dg-ttcard .btn:text-is("1장")'), 'v6xx 원정 — 4 · 8 · 12시간 칸(받을 은자 · 「출발」) · 시간 티켓 「1장」', tl);
      await page.click('#wb .row.dg-tile[data-h="8"] .btn');
      const cd = () => page.evaluate(() => { const t = document.querySelector('#wb .dg-cd')?.textContent || ''; const m = /^(\d+):(\d\d):(\d\d)$/.exec(t); return { t, s: m ? m[1] * 3600 + m[2] * 60 + +m[3] : -1, p: parseFloat(document.querySelector('#wb .dg-scene')?.style.getPropertyValue('--p') || '-1'), claim: [...document.querySelectorAll('#wb .row .btn')].find((b) => b.textContent === '받기')?.disabled ?? null }; });
      const e0 = await until(cd, (v) => v.s > 0);
      await page.waitForTimeout(2300);
      const e1 = await cd();
      ok(e0.s > 8 * 3600 - 30 && e0.s <= 8 * 3600 && e1.s < e0.s && e1.s >= e0.s - 4 && e0.claim === true, 'v6xx 원정 출발 → 남은 시간(1초마다 줄어듦) · 「받기」는 잠김', `${e0.t} → ${e1.t}`);
      const g0 = await page.evaluate(() => { const g = window.__s2.g; g.S.exped.run.endMs -= 8 * 3600e3; return g.S.wallet.gold; });   // 8시간이 지난 것처럼
      const e2 = await until(cd, (v) => v.claim === false);
      ok(e2.claim === false && /도착/.test(e2.t) && e2.p === 100, 'v6xx 시간이 지나면 저절로 「도착!」 · 막대 끝 · 「받기」 열림', JSON.stringify(e2));
      await page.click('#wb .btn:text-is("받기")');
      const g1 = await until(() => page.evaluate(() => ({ run: window.__s2.g.S.exped.run, gold: window.__s2.g.S.wallet.gold, tiles: document.querySelectorAll('#wb .row.dg-tile').length })), (v) => !v.run);
      ok(!g1.run && g1.gold > g0 && g1.tiles === 3, 'v6xx 「받기」 → 은자 · 다시 고르기 칸', `${g0} → ${g1.gold}`);
      await page.screenshot({ path: path.join(OUT, `s2-exped-${W}.png`) });
      await page.click('#panel-close');
      ok(await page.evaluate(() => window.__s2.dgIv() === 0), 'v6xx 창을 닫으면 시계 멈춤');
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.exped = JSON.parse(T.exped); for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); delete window.__t; });
      await free(a0); }
    // 경지 · 강호행 그림 — 둥근 눈금(가운데 경지) · 10레벨 표 열 개(심법 셋) · 다음 값 · 올리면 금빛 물결 / 굽은 길 일곱 칸 · 지금 두목 칸 빛남 · 두목 그림 · Lv(엔진 셈) · 열기 값
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { realm: JSON.stringify(g.S.realm), journey: JSON.stringify(g.S.journey), wallet: JSON.stringify(g.S.wallet) }; g.S.realm.lv = 23; g.S.wallet.gold = 1e12; g.S.journey.step = 4; g.S.journey.cleared = 6; });
      await page.click('.nb[data-tab="town"]'); await sub('경지'); await page.waitForSelector('#wb .rl-gauge');
      const rl = () => page.evaluate(() => ({ lv: document.querySelector('#wb .rl-lv')?.textContent, mk: document.querySelectorAll('#wb .rl-mk').length, on: document.querySelectorAll('#wb .rl-mk.on').length, heart: document.querySelectorAll('#wb .rl-mk.rl-heart').length, p: document.querySelector('#wb .rl-gauge')?.style.getPropertyValue('--p'), cost: document.querySelector('#wb .rl-cost b')?.textContent || '', gain: [...document.querySelectorAll('#wb .rl-gain b')].map((x) => x.textContent).join(' '), rip: document.querySelectorAll('#wb .rl-ripple').length, eng: window.__s2.g.S.realm.lv, low: window.__s2.lowGfx() }));
      const r0 = await rl();
      ok(r0.lv === '23' && r0.mk === 10 && r0.on === 2 && r0.heart === 3 && r0.p === '100.0%' && /^\S+$/.test(r0.cost) && r0.gain === '공격 +0.7% 체력 +0.8%' && r0.rip === 0, '경지 — 둥근 눈금(가운데 23) · 10레벨 표 열 개(둘 켜짐 · 심법 셋) · 다음 값 · 한 단계마다 공격 +0.7% 체력 +0.8%', JSON.stringify(r0));
      await page.click('#wb .row:has(.name:text-is("경지 올리기")) .btn:text-is("올리기")');
      const r1 = await until(rl, (v) => v.lv === '24');
      ok(r1.lv === '24' && r1.eng === 24 && (r1.low ? r1.rip === 0 : r1.rip === 2), '경지 올리기 → 24 · 금빛 물결(낮은 그래픽이면 없음)', JSON.stringify({ lv: r1.lv, rip: r1.rip }));
      await sub('강호행'); await page.waitForSelector('#wb .rl-path .rl-node');
      const j0 = await until(() => page.evaluate(() => { const im = document.querySelector('#wb .rl-boss img'); if (im) im.loading = 'eager'; return { n: document.querySelectorAll('#wb .rl-node').length, cur: [...document.querySelectorAll('#wb .rl-node.rl-cur')].map((x) => x.dataset.n), won: document.querySelectorAll('#wb .rl-node.rl-won').length, img: !!im && im.complete && im.naturalWidth > 0, blv: document.querySelector('#wb .rl-blv')?.textContent, open: document.querySelector('#wb .rl-open b')?.textContent, btn: ['도전', '열기'].map((t) => [...document.querySelectorAll('#wb .row .btn')].some((b) => b.textContent === t)) }; }), (v) => v.img);
      ok(j0.n === 7 && j0.cur.join() === '7' && j0.won === 2 && j0.img && j0.blv === `Lv ${Math.round(40 + 6 * 1.8)}` && j0.open === '5만' && j0.btn.every(Boolean), '강호행 — 굽은 길 일곱 칸 · 7단계 두목 칸 빛남 · 두목 그림 · Lv 51 · 열기 5만 · 「도전」「열기」', JSON.stringify(j0));
      await page.click('#wb .row:has(.name:text-is("다음 단계 열기")) .btn');
      const j1 = await until(() => page.evaluate(() => ({ step: window.__s2.g.S.journey.step, done: document.querySelectorAll('#wb .rl-node.rl-done').length })), (v) => v.step === 5);
      ok(j1.step === 5 && j1.done === 1, '다음 단계 열기 → 5단계 · 길 칸이 열림으로', JSON.stringify(j1));
      await page.click('#panel-close');
      await page.evaluate(() => { const g = window.__s2.g, T = window.__t, W = g.S.wallet; g.S.realm = JSON.parse(T.realm); g.S.journey = JSON.parse(T.journey); for (const k of Object.keys(W)) delete W[k]; Object.assign(W, JSON.parse(T.wallet)); g.dirtyStats = true; delete window.__t; });
      await free(a0); }
    // v605 동행 — 던전 → 동행: 오프라인이면 연습 동행 셋(「연습」) · 둘 고르고 「출발」 → 결과 창(셋 · 몫 막대) · 오늘 횟수 하나 줄어듦
    { const a0 = await hold();
      await page.evaluate(() => { const g = window.__s2.g; window.__t = { wallet: JSON.stringify(g.S.wallet), party: JSON.stringify(g.S.party || null) }; g.partyRec().runs = 0; });
      await page.click('#mb .nb[data-tab="dgn"]'); await sub('동행'); await page.waitForSelector('#wb .row .pill');
      const pt = () => page.evaluate(() => { const g = window.__s2.g, rows = [...document.querySelectorAll('#wb .row')], bots = rows.filter((r) => r.querySelector('.pill:not(.pv-real)')?.textContent === '연습');
        return { bots: bots.length, names: bots.map((r) => r.querySelector('.name').firstChild.textContent.trim()), pw: bots.every((r) => /^전투력 \S+/.test(r.querySelector('.desc')?.textContent || '')), on: document.querySelectorAll('#wb .row.pty-on').length, btn: bots.map((r) => `${r.querySelector('.btn').textContent}${r.querySelector('.btn').disabled ? '(잠김)' : ''}`), head: [...document.querySelectorAll('#wb .card h3')].map((h) => h.textContent), note: [...document.querySelectorAll('#wb .note')].map((n) => n.textContent).join(' / '), left: g.partyState().left, tier: g.partyState().tier, runs: g.partyRec().runs, goOff: !![...document.querySelectorAll('#wb .btn')].find((x) => x.textContent === '출발')?.disabled, modal: !document.getElementById('modal').classList.contains('hidden') }; });
      const y0 = await until(pt, (v) => v.bots === 3);
      ok(y0.bots === 3 && y0.pw && /오프라인 — 연습 동행과 함께 가요/.test(y0.note) && y0.btn.join() === '고르기,고르기,고르기' && y0.on === 0, 'v605 동행 — 오프라인이면 연습 동행 셋(「연습」 딱지 · 전투력)', y0.names.join(' · '));
      ok(/오늘 2 \/ 2번 남음/.test(y0.head[0]) && /0 \/ 2명/.test(y0.head[1]) && !y0.goOff, 'v605 동행 — 오늘 남은 횟수 · 고른 수', y0.head.join(' | '));
      const slot = () => page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)], img = document.querySelector('#wb .pt-boss img');
        return { n: q('#wb .pt-slots > .pt-slot').length, empty: q('#wb .pt-slot.pt-empty').map((x) => x.textContent.replace('+', '').trim()), cv: q('#wb .pt-slot canvas').map((c) => +c.dataset.n || 0), names: q('#wb .pt-slot:not(.pt-empty) b').map((b) => b.textContent), pips: q('#wb .pt-pips i.on').length, boss: !!img && /art\/s2\/chb\/chb\d+\.webp$/.test(img.src), tier: document.querySelector('#wb .pt-tier b')?.textContent, raf: window.__s2.ptRaf() }; });
      const s0 = await slot();
      ok(s0.n === 3 && s0.empty.join() === '동료 자리,동료 자리' && s0.cv.length === 1 && s0.cv[0] > 0 && s0.names[0] === '나' && s0.pips === 2 && s0.boss && s0.tier === String(y0.tier), 'v6xx 동행 — 두목 그림 · 단계 숫자 · 횟수 점 둘 · 자리 셋(나 + 빈 「동료 자리」 둘)', JSON.stringify(s0));
      const BOT = '#wb .row:has(.pill:text-is("연습"))';
      await page.click(`${BOT} .btn:text-is("고르기") >> nth=0`); await until(pt, (v) => v.on === 1);
      await page.click(`${BOT} .btn:text-is("고르기") >> nth=0`);
      const y1 = await until(pt, (v) => v.on === 2);
      ok(y1.on === 2 && /2 \/ 2명/.test(y1.head[1]) && y1.btn.join() === '빼기,빼기,고르기(잠김)', 'v605 둘을 고르면 표시되고 셋째는 잠긴다', y1.btn.join(' · '));
      const s1 = await until(slot, (v) => v.cv.length === 3 && v.cv.every((n) => n > 1));
      ok(s1.empty.length === 0 && s1.names.join() === ['나', ...y0.names.slice(0, 2)].join() && s1.cv.every((n) => n > 1) && s1.raf > 0, 'v6xx 동행 — 고른 둘이 자리에 무인 그림으로(움직임)', s1.names.join(' · '));
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
      await page.click('#panel-close');
      ok(await page.evaluate(() => window.__s2.ptRaf() === 0), 'v6xx 동행 창을 닫으면 자리 그림 멈춤');
      await free(a0); }
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
    // v620 모음 칸 자세히 — 가진 칸을 누르면 이름 · 큰 그림 · Lv · 각성 점 · 효과 · 바깥을 누르면 닫힘 / 없는 칸은 그림자 창(「뽑기로 얻어요」)
    { const a0 = await hold();
      await page.evaluate(() => { const P = window.__s2.g.S.colls.pal; window.__t = JSON.stringify({ eq: P.eq, own: P.own }); P.own = { 3: { n: 2, awk: 1, lv: 4 } }; P.eq = [3, null, null, null, null]; });
      await page.click('#mb .nb[data-tab="comp"]'); await page.click('#panel-body .subtabs button >> nth=1');
      await until(() => page.evaluate(() => document.querySelectorAll('#wb .coll-tile').length), (v) => v === 25);
      await page.click('#wb .coll-tile >> nth=3');
      const cs = () => page.evaluate(() => { const m = document.getElementById('modal'), sh = m.querySelector('.sheet'), im = sh.querySelector('.cl-art img');
        return { vis: !m.classList.contains('hidden'), w: sh.classList.contains('cl-w'), sm: sh.classList.contains('cl-sm'), t: sh.querySelector('h2')?.textContent || '', src: im?.getAttribute('src') || '', img: !!im && im.complete && im.naturalWidth > 0, dots: sh.querySelectorAll('.cl-awk i.on').length, ef: sh.querySelectorAll('.cl-ef > div:not(.cl-h)').length, lv: sh.querySelector('.cl-lv')?.textContent || '', no: !!sh.querySelector('.cl-no'), get: sh.querySelector('.cl-get')?.textContent || '', up: !!sh.querySelector('.btn.cl-up'), sc: sh.scrollHeight - sh.clientHeight }; });
      const nm = await page.evaluate(async () => (await import(new URL('js/s2/tables/collnames.js', location.href).href)).collName('pal', 3));
      const s1 = await until(cs, (v) => v.vis && v.img);
      ok(s1.vis && s1.w && s1.t === nm && s1.img && s1.src === 'art/s2/coll/pal-3.webp' && s1.dots === 1 && s1.ef === 2 && /Lv 4\/30/.test(s1.lv) && !s1.no, 'v620 가진 모음 칸 — 이름 · 큰 그림 · Lv · 각성 점 · 효과 둘 · 레벨 업', JSON.stringify(s1));
      ok(s1.sc <= 1, 'v620 모음 자세히 창 — 넘치지 않음(스크롤 없음)', `넘침 ${s1.sc}px`);
      await page.waitForTimeout(350); await page.mouse.click(4, 4);
      const s2 = await until(cs, (v) => !v.vis);
      ok(!s2.vis, 'v620 바깥을 누르면 닫힘');
      await page.click('#wb .coll-tile >> nth=0');
      const s3 = await until(cs, (v) => v.vis && v.no);
      ok(s3.vis && s3.sm && s3.no && s3.get === '뽑기로 얻어요' && s3.src === 'art/s2/coll/pal-0.webp' && !s3.up, 'v620 없는 모음 칸 — 그림자 · 등급 · 「뽑기로 얻어요」', JSON.stringify({ t: s3.t, get: s3.get }));
      await page.click('#modal .btn:has-text("닫기")'); await until(cs, (v) => !v.vis);
      await page.evaluate(() => { const P = window.__s2.g.S.colls.pal, T = JSON.parse(window.__t); P.eq = T.eq; P.own = T.own; delete window.__t; });
      await page.click('#panel-close'); await free(a0); }
    // v6xx 병기 · 동료 · 영물 뽑기 깃발(cg-) — 맨 위 등급 그림 셋이 뜬다 · 천장 글 = 엔진(지금 / PULL_PITY · 맨 위 등급 확정) · 확률 칩 = PULL_P · 모음 효과 합 · 「10번」 칸은 10장으로 10번
    { const a0 = await hold();
      const tb = await page.evaluate(async () => { const u = (p) => new URL(p, location.href).href, O = await import(u('js/s2/tables/option.js')), { COLLECTS } = await import(u('js/s2/game.js')), { GRADES } = await import(u('js/s2/tables/gear.js'));
        return { sys: COLLECTS, nm: COLLECTS.map((s) => ({ weapon: '병기', pal: '동료', relic: '영물' })[s] || s), pity: O.PULL_PITY, odds: O.PULL_P.map((x, i) => `${GRADES[i]}${+(x / 10).toFixed(1)}%`), top: GRADES[O.PULL_P.length - 1] }; });
      await page.evaluate(() => { const g = window.__s2.g, W = g.S.wallet, R = g.S.colls.relic; window.__t = JSON.stringify({ w: W['ticket:relic'] || 0, pity: R.pity, own: R.own, eq: R.eq }); W['ticket:relic'] = 12; R.pity = 57; R.own = { 0: { n: 1, awk: 2, lv: 1 }, 20: { n: 1, awk: 0, lv: 1 } }; });
      const want = await page.evaluate(async () => { const u = (p) => new URL(p, location.href).href, T = await import(u('js/s2/tables/s5.js')), { kindGrade, totalAwake } = await import(u('js/s2/grow/collect.js')), R = window.__s2.g.S.colls.relic, D = T.COLLECT.relic;   // 자세히 창과 같은 셈
        const v = Object.entries(R.own).reduce((a, [k, o]) => a + D.own[kindGrade('relic', +k)] * (1 + (o.awk * T.AWAKE_STEP_P) / 1000), 0) * (1 + Math.min(T.TOTAL_AWAKE_CAP, totalAwake(R) * T.TOTAL_AWAKE_P) / 1000); return `+${(v / 10).toFixed(1)}%`; });
      const cgs = (sys) => page.evaluate((sys) => { const c = document.querySelector('#wb > .card.cg'), C = window.__s2.g.S.colls[sys], ims = [...(c?.querySelectorAll('.cg-show img') || [])], pb = document.querySelector('#panel-body');
        return { first: document.querySelector('#wb > .card') === c, imgs: ims.map((m) => m.complete && m.naturalWidth > 0), src: ims.map((m) => m.getAttribute('src')).sort().join(), t: c?.querySelector('h3')?.textContent || '', pl: (c?.querySelector('.cg-pl')?.textContent || '').replace(/\s+/g, ''), bar: parseFloat(c?.querySelector('.cg-pity .achbar i')?.style.width), pity: C.pity,
          odds: [...(c?.querySelectorAll('.cg-odds span') || [])].map((s) => s.textContent).join(), tix: (c?.querySelector('.cg-tix')?.textContent || '').replace(/\s+/g, ''), w: window.__s2.g.S.wallet[`ticket:${sys}`] || 0, sum: c?.querySelector('.cg-sum')?.textContent || '', btns: [...(c?.querySelectorAll('.row.cg-tile .btn') || [])].map((b) => b.textContent).join(), main: c?.querySelector('.row.cg-tile.main .btn.primary')?.textContent || '', ov: pb.scrollWidth - pb.clientWidth }; }, sys);
      await page.click('#mb .nb[data-tab="comp"]');
      for (const [i, sys] of tb.sys.entries()) {
        await page.click(`#panel-body .subtabs button >> nth=${i}`);
        const cg = await until(() => cgs(sys), (v) => v.imgs.length === 3 && v.imgs.every(Boolean));
        ok(cg.first && cg.imgs.length === 3 && cg.imgs.every(Boolean) && cg.src === [0, 1, 2].map((k) => `art/s2/coll/${sys}-${k}.webp`).join() && cg.ov <= 0, `v6xx ${tb.nm[i]} 뽑기 깃발 — 맨 위 등급 그림 셋이 뜬다 · 옆으로 넘치지 않음`, `${cg.src} · 넘침 ${cg.ov}`);
        ok(cg.pl === `천장${cg.pity}/${tb.pity}${tb.top}품확정` && Math.abs(cg.bar - Math.min(100, (cg.pity / tb.pity) * 100)) < 0.01 && cg.odds === tb.odds.join() && cg.tix === `뽑기권${cg.w}장` && cg.btns === '1번,10번' && cg.main === '10번' && /뽑기$/.test(cg.t), `v6xx ${tb.nm[i]} 뽑기 깃발 — 천장 글 = 엔진 · 확률 칩 · 뽑기권 · 1번 / 10번(10번이 주 단추)`, `${cg.t} · ${cg.pl} · ${cg.odds} · ${cg.tix}`);
        if (sys === 'relic') ok(cg.sum === `모음 효과 합 체력 ${want}` && cg.pl === `천장57/${tb.pity}${tb.top}품확정`, 'v6xx 영물 — 모음 효과 합 = 자세히 창과 같은 셈 · 천장 57', `${cg.sum} · 기대 ${want}`);
      }
      await page.click('#wb .row .btn:has-text("10번")');
      await until(() => page.evaluate(() => document.querySelectorAll('.gx .gc').length), (v) => v === 10);
      const p1 = await page.evaluate(() => ({ w: window.__s2.g.S.wallet['ticket:relic'], n: document.querySelectorAll('.gx .gc').length, t: document.querySelector('.gx .gxt')?.textContent || '' }));
      ok(p1.w === 2 && p1.n === 10 && /영물 뽑기 10번/.test(p1.t), 'v6xx 영물 깃발 「10번」 → 뽑기권 10장 · 카드 열 장', JSON.stringify(p1));
      await page.click('.gx .skip'); await page.waitForTimeout(200); await page.click('.gx .skip').catch(() => {}); await page.waitForTimeout(200);
      const p2 = await until(() => cgs('relic'), (v) => v.tix === '뽑기권2장');
      ok(p2.tix === '뽑기권2장' && p2.pl === `천장${p2.pity}/${tb.pity}${tb.top}품확정` && p2.pity !== 57, 'v6xx 뽑은 뒤 깃발 — 뽑기권 · 천장이 엔진대로 바뀜', `${p2.tix} · ${p2.pl}`);
      await page.evaluate(() => { const g = window.__s2.g, R = g.S.colls.relic, T = JSON.parse(window.__t); g.S.wallet['ticket:relic'] = T.w; R.pity = T.pity; R.own = T.own; R.eq = T.eq; delete window.__t; });
      if (await page.isVisible('.gx')) await page.click('.gx .skip').catch(() => {});
      await page.click('#panel-close').catch(() => {}); await free(a0); }
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
    // 문파(오프라인) — 안내 띠(문파 그림 · 오프라인 표시) · 주는 것 다섯 · 큰 타일 셋(만들기 · 들어가기 · 찾기 — 잠김) · 찾기 목록 없음 · 옆으로 넘치지 않음
    { const a0 = await hold();
      await page.click('.nb[data-tab="social"]'); await sub('문파'); await page.waitForSelector('#wb.gd-wb .gd-hero');
      await page.waitForFunction(() => { const i = document.querySelector('.gd-hero-ic img'); return i && i.complete; }, null, { timeout: 4000 }).catch(() => {});
      const gd = await page.evaluate(() => { const pb = document.getElementById('panel-body'), btns = [...document.querySelectorAll('#wb .gd-tile .btn')], im = document.querySelector('.gd-hero-ic img');
        return { pic: !!im && im.naturalWidth > 0, st: document.querySelector('.gd-st')?.textContent || '', note: document.querySelector('.gd-hero .note')?.textContent || '', perks: [...document.querySelectorAll('.gd-perk b')].map((b) => b.textContent), perkTix: [...document.querySelectorAll('.gd-perk small')].filter((x) => /뽑기권/.test(x.textContent)).length,
          tiles: [...document.querySelectorAll('.gd-tile b')].map((b) => b.textContent), labels: btns.map((b) => b.textContent), shut: btns.every((b) => b.disabled), find: !!document.querySelector('#gd-find'), wide: pb.scrollWidth > pb.clientWidth + 1 }; });
      const sc = await scan();
      ok(gd.pic && /오프라인/.test(gd.st) && /서버에 있어요/.test(gd.note), '문파(오프라인) — 안내 띠 · 문파 그림 · 오프라인 표시', `${gd.pic} ${gd.st}`);
      ok(gd.perks.join() === '출석,토벌,수련,대화,문파 Lv,연공실,품앗이,겨루기' && gd.perkTix >= 5, '문파(오프라인) — 주는 것 여덟(실제 숫자 · v635 연공실 · 품앗이 · 겨루기)', gd.perks.join('/'));
      ok(gd.tiles.join() === '문파 만들기,코드로 들어가기,문파 찾기' && gd.labels.join() === '만들기,들어가기,찾기' && gd.shut && !gd.find, '문파(오프라인) — 큰 타일 셋 · 잠김 · 찾기 목록 없음', gd.labels.join('/'));
      ok(!gd.wide && sc.txt === '' && sc.bad.length === 0, '문파(오프라인) — 옆으로 넘치지 않음 · 이상한 글자 · 깨진 그림 없음', `${sc.txt} ${sc.bad.join(' ')}`);
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
    // 설정 정리(op-) — 묶음 다섯이 차례대로 · 맨 아래 판 번호 = BUILD · 스위치를 누르면 설정과 모습(금빛 · aria-checked)이 함께 바뀜 · 새로 시작은 붉은 줄
    { await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      await page.click('#b-opt'); await page.waitForSelector('#wb .op-sec');
      const SR = '#wb .row:has(.name:text-is("피해 측정기"))';
      const os = () => page.evaluate(() => { const b = [...document.querySelectorAll('#wb .row')].find((r) => r.querySelector('.name')?.textContent === '피해 측정기')?.querySelector('.btn'); let o = {}; try { o = JSON.parse(localStorage.getItem('ifu.s2.opt') || '{}'); } catch { /* 없음 */ }
        return { dps: !!o.dps, on: !!b?.classList.contains('on'), aria: b?.getAttribute('role') === 'switch' ? b.getAttribute('aria-checked') : 'x', txt: b?.textContent || '', bg: b ? getComputedStyle(b).backgroundImage : '' }; });
      const o0 = await page.evaluate(async () => ({ heads: [...document.querySelectorAll('#wb .op-sec > h3')].map((h) => h.firstChild.textContent.trim()), foot: document.querySelector('#wb .op-foot .op-ver')?.textContent || '', build: (await import(new URL('js/data.js', location.href).href)).BUILD, last: document.querySelector('#wb').lastElementChild?.className || '', danger: !!document.querySelector('#wb .row.op-danger .name')?.textContent.includes('새로 시작'), sws: document.querySelectorAll('#wb .btn.op-sw').length, sw: document.getElementById('panel-body').scrollWidth - document.getElementById('panel-body').clientWidth }));
      ok(o0.heads.join('|') === '방치 · 절전|화면|진동|계정 · 저장|알림 · 소식' && o0.last === 'op-foot' && o0.danger && o0.sws >= 6 && o0.sw <= 1, '설정 — 묶음 다섯 차례대로 · 스위치 · 새로 시작 붉은 줄 · 맨 아래 꼬리', JSON.stringify(o0));
      ok(/^ifu-v\d+$/.test(o0.foot) && o0.foot === o0.build, '설정 꼬리 판 번호 = BUILD', `${o0.foot} / ${o0.build}`);
      const s0 = await os(); await page.click(`${SR} .btn`); const s1 = await until(os, (v) => v.dps !== s0.dps, 2000); await page.click(`${SR} .btn`); const s2 = await until(os, (v) => v.dps === s0.dps, 2000);
      const fit = (s) => s.on === s.dps && s.aria === String(s.dps) && s.txt === (s.dps ? '켜짐' : '꺼짐') && (s.dps ? s.bg.includes('gradient') : !s.bg.includes('gradient'));
      ok(s1.dps !== s0.dps && fit(s0) && fit(s1) && fit(s2) && s2.dps === s0.dps, '설정 스위치 — 누르면 설정 · 금빛 · 켜짐/꺼짐이 함께 바뀌고 다시 누르면 돌아옴', JSON.stringify([s0, s1, s2].map((s) => `${s.txt}/${s.aria}/${s.on ? '금' : '회'}`)));
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
      ok(t1.p >= t0 + 12 && t1.w < 10, 'v588 자동 성장 켜면 뽑기권을 쓴다(받은 보상 몫까지 · v635 같은 차례에 받은 봇짐 · 우편 몫 몇 장은 다음 차례에)', JSON.stringify({ t0, t1 }));
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
    // 대결 칸(duel-) — 상대 카드마다 작은 모습(그려진 캔버스) · 쉬움/비슷/어려움 · 이기면/지면 점수 · 「도전」 → 3·2·1 → 결과 카드 · 횟수 줄어듦 · 「다시」 · 누르면 건너뛰기
    { await page.waitForTimeout(300);
      const L = await page.evaluate(() => { const cs = [...document.querySelectorAll('#wb .duel-opp')]; return { n: cs.length, cv: cs.filter((c) => { const v = c.querySelector('canvas.duel-cv'); if (!v) return false; const d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data; for (let i = 3; i < d.length; i += 16) if (d[i]) return true; return false; }).length, chip: cs.every((c) => /^(쉬움|비슷|어려움)$/.test(c.querySelector('.duel-chip')?.textContent || '')), sd: cs.every((c) => /승 \+\d+.*패 -\d+/.test(c.querySelector('.duel-sd')?.textContent || '')), btn: cs.every((c) => c.querySelector('.btn.primary')?.textContent === '도전'), tier: document.querySelector('#wb .duel-tier')?.textContent || '', tries: document.querySelectorAll('#wb .duel-tries i').length }; });
      ok(L.n === 3 && L.cv === 3 && L.chip && L.sd && L.btn && !!L.tier && L.tries === 5, '대결 칸 — 상대 카드 셋(그려진 모습 · 난이도 칩 · 승/패 점수 · 도전) · 등급 · 남은 횟수 점', JSON.stringify(L));
      const used = () => page.evaluate(() => { const P = window.__s2.g.S.pvp || {}; return P.day === String(window.__s2.dayKey(Date.now())) ? P.used : 0; });
      const u0 = await used();
      await page.click('#wb .duel-opp .btn:has-text("도전") >> nth=0'); await page.waitForTimeout(100);
      const ph0 = await page.evaluate(() => document.querySelector('.duel')?.dataset.phase);
      ok(await page.isVisible('.duel') && ph0 === 'intro' && /^[321]$|비무 시작/.test(await page.textContent('.duel .dl-mid')) && (await page.$$('.duel .dl-side .dl-bar i')).length === 2, '「도전」 → 대결 화면: 3·2·1 비무 시작 · 이름판 체력 막대 둘', ph0);
      const ph1 = await until(() => page.evaluate(() => document.querySelector('.duel')?.dataset.phase), (p) => p === 'result', 20000);
      ok(ph1 === 'result' && await page.isVisible('.duel .duel-res.on') && /^(승|패)/.test(await page.textContent('.duel .duel-wl')) && /점수 \d+ → \d+/.test(await page.textContent('.duel .duel-dd')) && await page.isVisible('.duel .duel-tp') && await used() === u0 + 1, '끝까지 보면 결과 카드(승/패 · 점수 · 등급 막대) · 오늘 횟수 +1', `${u0} → ${await used()}`);
      await page.click('.duel .duel-again'); await page.waitForTimeout(150);
      await page.waitForSelector('.duel[data-phase="intro"], .duel[data-phase="fight"]'); await page.mouse.click(30, Math.round(H / 2)); await page.waitForTimeout(150);
      ok(await page.evaluate(() => document.querySelector('.duel')?.dataset.phase) === 'result' && await page.isVisible('.duel .duel-res.on') && await used() === u0 + 2, '「다시」 → 한 판 더(횟수 +1) · 누르면 건너뛰기 → 바로 결과 카드');
      await page.click('.duel .duel-close'); await page.waitForTimeout(150);
      ok(!(await page.$('.duel')), '「닫기」 → 대결 화면 닫힘'); }
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
    // v626 강화·성혼(en-) — 칸 카드 수 = 칸 수 · 그림이 뜬다 · 열면 성공 고리(%) · 강화하면 보이는 단계가 오른다 · 파괴된 칸은 「복구」 · 옆 넘침 없음
    { const sl = await page.evaluate(() => { const g = window.__s2.g, G = g.S.gear, W = g.S.wallet; W.gold = 1e9; W['item:stone'] = 2000; if (!Object.keys(G.slots).some((s) => G.eq[s])) g.pullGear(10);
        const s = Object.keys(G.slots).find((k) => G.eq[k]); Object.assign(G.slots[s], { enh: 0, broken: 0 }); return s; });
      await page.click('#mb .nb[data-tab="bag"]'); await page.waitForTimeout(200);
      await sub('강화·성혼'); await page.waitForTimeout(300);
      const en = await page.evaluate(async () => { const g = window.__s2.g, W = document.querySelector('#wb'), imgs = [...W.querySelectorAll('.en-card .en-ic img, .en-mat img')];
        await Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 3000); }))));
        return { cards: W.querySelectorAll('.en-card').length, slots: Object.keys(g.S.gear.slots).length, mats: W.querySelectorAll('.en-mat').length, imgs: imgs.length, bad: imgs.filter((i) => !i.naturalWidth).map((i) => i.src.split('/').pop()),
          all: !!W.querySelector('.row.en-all .btn'), open: [...W.querySelectorAll('.en-card > .btn')].filter((b) => b.textContent === '열기').length, over: Math.max(W.scrollWidth - W.clientWidth, document.documentElement.scrollWidth - innerWidth) }; });
      ok(en.cards === en.slots && en.mats === 4 && en.imgs === en.slots + 4 && !en.bad.length && en.all && en.open === en.slots && en.over <= 1, 'v626 강화·성혼 칸 카드: 칸 수만큼 · 장비 · 재료 그림이 뜬다 · 「모두 강화」 · 칸마다 「열기」 · 넘침 없음', JSON.stringify(en));
      await page.click(`#wb .en-card[data-slot="${sl}"] > .btn`); await page.waitForSelector('#modal:not(.hidden) .en-ring');
      const m0 = await page.evaluate(() => { const M = document.querySelector('#modal .sheet'), im = M.querySelector('.en-big img'); return { ring: M.querySelector('.en-ring b')?.textContent || '', lv: M.querySelector('.en-nums .en-cur')?.textContent || '', img: !!im && im.complete && im.naturalWidth > 0, over: M.scrollWidth - M.clientWidth }; });
      ok(/^\d+(\.\d)?%$/.test(m0.ring) && m0.lv === '+0' && m0.img && m0.over <= 1, 'v626 칸 「열기」 → 강화 창: 큰 그림 · 성공 고리 % · 지금 +0', JSON.stringify(m0));
      await page.click('#ep-e1'); await page.waitForTimeout(150);
      const skipEn = () => page.evaluate(() => document.querySelector('#modal .forge')?.click());
      await skipEn(); await page.waitForTimeout(120); await skipEn(); await page.waitForTimeout(60);
      const m1 = await page.evaluate(() => ({ lv: document.querySelector('#modal .en-nums .en-cur')?.textContent || '', fl: !!document.querySelector('#modal .en-big.en-fl') }));
      ok(m1.lv === '+1' && m1.fl, 'v626 강화(성공 100%) → 창의 단계가 +1로 · 큰 그림 금빛 번쩍', JSON.stringify(m1));
      await page.click('#ep-close'); await page.waitForTimeout(150);
      ok(await page.evaluate((s) => document.querySelector(`#wb .en-card[data-slot="${s}"] .en-lv`)?.textContent, sl) === '+1', 'v626 칸 카드도 +1로');
      await page.evaluate((s) => { const g = window.__s2.g; Object.assign(g.S.gear.slots[s], { broken: 16, star: 0 }); g.S.wallet['item:restore'] = 1; }, sl);
      await sub('장착'); await sub('강화·성혼');
      ok(await page.isVisible(`#wb .en-card.en-brk[data-slot="${sl}"] .en-bk`), 'v626 파괴된 칸 카드에 「파괴」 덮개');
      await page.click(`#wb .en-card[data-slot="${sl}"] > .btn`); await page.waitForSelector('#modal:not(.hidden) #ep-rs');
      await page.click('#ep-rs'); await page.waitForTimeout(150);
      const rs = await page.evaluate((s) => { const g = window.__s2.g, S = g.S.gear.slots[s]; return { broken: S.broken, star: S.star, left: g.S.wallet['item:restore'] || 0, txt: document.querySelector('#modal .en-nums .en-scur')?.textContent || '', btn: !!document.querySelector('#modal #ep-rs') }; }, sl);
      ok(!rs.broken && rs.star === 13 && rs.left === 0 && rs.txt === '★13' && !rs.btn, 'v626 「복구」 → 복구 주문서 1장 · ★13으로 되살아남', JSON.stringify(rs));
      await page.click('#ep-close'); await page.waitForTimeout(150);
      await page.click('#panel-close').catch(() => {}); }
    // v631 장비 — 재료 창(얻는 곳 · 가기 · 부족) · 끼면 전투력 차이 배지 · 좋은 순 · 저절로 낀 것 알림 · 장착 창 NEW · 뽑기 결과 장착 표시
    { await page.click('#panel-close').catch(() => {});
      await page.evaluate(() => { const g = window.__s2.g, W = g.S.wallet; W.gold = 1e9; W['item:stone'] = 5; if (g.bossFight) g.endChallenge(false); g.stage().auto = false; if (!Object.values(g.S.gear.eq).some(Boolean)) g.pullGear(10); g.feed.length = 0; });
      await page.click('#mb .nb[data-tab="bag"]'); await page.waitForTimeout(200); await sub('강화·성혼');
      const m0 = await page.evaluate(() => [...document.querySelectorAll('#wb .gq-mat')].map((b) => b.dataset.gqmat).join(','));
      await page.click('#wb .gq-mat[data-gqmat="item:stone"]'); await page.waitForSelector('#modal:not(.hidden) .gq-src');
      const mp = await page.evaluate(() => { const M = document.querySelector('#modal .sheet'); return { head: M.querySelector('.gq-mh b')?.textContent || '', have: M.querySelector('.gq-mh small')?.textContent || '', n: M.querySelectorAll('.gq-sr').length, go: M.querySelectorAll('.gq-sr .gq-go').length, t: [...M.querySelectorAll('.gq-sr > span b')].map((b) => b.textContent).join('/'), over: M.scrollWidth - M.clientWidth }; });
      ok(m0 === 'gold,item:stone,item:restore,item:shard' && /^강화석 — 장비 강화/.test(mp.head) && mp.have === '가진 5개' && mp.n >= 8 && mp.go === mp.n && /분해/.test(mp.t) && /단련동/.test(mp.t) && mp.over <= 1, 'v631 재료 칩 넷 → 강화석 창: 무엇에 쓰나 · 가진 수 · 얻는 곳마다 「가기」', `${m0} · ${mp.head} · ${mp.have} · ${mp.t}`);
      await page.click('#modal .gq-sr:has-text("장비 분해") .gq-go');
      const k1 = await until(() => page.evaluate(() => ({ key: document.getElementById('panel-body').dataset.key, modal: !document.getElementById('modal').classList.contains('hidden') })), (v) => v.key === 'bag:3' && !v.modal);
      ok(k1.key === 'bag:3' && !k1.modal, 'v631 「가기」 → 그 창(장비 분해 → 가방)', JSON.stringify(k1));
      await sub('강화·성혼'); await page.click('#wb .en-card > .btn >> nth=0'); await page.waitForSelector('#modal:not(.hidden) .en-ring');
      const nr = await page.evaluate(() => { const r = document.querySelector('#modal .need-r.no[data-gqmat="item:stone"]'); return r ? r.textContent : ''; });
      await page.click('#modal .need-r[data-gqmat="item:stone"]'); await page.waitForSelector('#modal:not(.hidden) .gq-mh');
      const sh = await page.evaluate(() => ({ s: document.querySelector('#modal .gq-short')?.textContent || '', back: [...document.querySelectorAll('#modal .btn-row .btn')].some((b) => b.textContent === '돌아가기') }));
      ok(/부족 \d+/.test(nr) && /^부족 — \d+개 더 필요$/.test(sh.s) && sh.back, 'v631 강화 창 재료 줄 — 모자라면 「부족 n」 · 누르면 재료 창(부족 — n개 더) · 「돌아가기」', `${nr} · ${sh.s}`);
      await page.evaluate(() => [...document.querySelectorAll('#modal .btn-row .btn')].find((b) => b.textContent === '돌아가기').click());
      ok(await page.isVisible('#modal:not(.hidden) .en-ring'), 'v631 「돌아가기」 → 강화 창으로');
      await page.click('#ep-close'); await page.waitForTimeout(150);
      // 가방 — 끼면 전투력 차이(▲ 초록 · ▼ 빨강) · 좋은 순 맨 앞 = 가장 센 것 · 부위를 고르면 낀 것은 「장착 중」
      const U = await page.evaluate(() => { const G = window.__s2.g.S.gear, u = 9.5e8 + Math.floor(Math.random() * 1e6); G.bag.splice(40);   // v634 가방이 60칸을 넘으면 맨 뒤(범품)가 안 보여 — 줄여 두고 본다
        G.bag.push({ uid: u, slot: 'shoes', g: 6, up: 1, subs: [{ k: 'atkL1', v: 80 }, { k: 'crit', v: 40 }], rr: 0, lock: false }, { uid: u + 1, slot: 'shoes', g: 0, up: 0, subs: [], rr: 0, lock: false }); return u; });
      await sub('가방'); await page.click('#wb .gr-so:text-is("좋은 순")'); await page.waitForTimeout(150);
      const bg = await page.evaluate((u) => { const t = (x) => document.querySelector(`#wb .inv-tile[data-uid="${x}"]`); return { up: t(u)?.querySelector('.gq-dp.up')?.textContent || '', dn: t(u + 1)?.querySelector('.gq-dp')?.className || '', first: document.querySelector('#wb .inv-tile')?.dataset.uid === String(u), all: document.querySelectorAll('#wb .inv-tile').length, badge: document.querySelectorAll('#wb .inv-tile .gq-dp, #wb .inv-tile .gq-on').length, gp: window.__s2.g.gearPw(window.__s2.g.S.gear.bag.find((x) => x.uid === u)) - window.__s2.g.gearVal() }; }, U);
      ok(/^▲ \+\S+$/.test(bg.up) && /gq-dp (dn|eq)/.test(bg.dn) && bg.first && bg.badge === bg.all && bg.gp > 0, 'v631 가방 — 칸마다 종합 차이 배지(▲ 초록 · ▼ 빨강) · 「좋은 순」 맨 앞이 가장 센 것', `${bg.up} · ${bg.dn} · 배지 ${bg.badge}/${bg.all}`);
      await page.click('#wb .chip:has-text("신발")'); await page.waitForTimeout(150);
      const on = await page.evaluate(() => { const t = document.querySelector('#wb .inv-tile'); return { on: t?.querySelector('.gq-on')?.textContent || '', eq: window.__s2.g.S.gear.eq.shoes?.uid, uid: t?.dataset.uid }; });
      ok(!on.eq || (on.on === '장착 중' && String(on.eq) === on.uid), 'v631 부위를 고르면 낀 것이 맨 앞 「장착 중」', JSON.stringify(on));
      await page.click('#wb .chip:has-text("전부")'); await page.click('#wb .gr-so:text-is("등급순")');
      // ▲ 칸(가방에 더 좋은 것) — 비교 창 맨 위에 전투력 차이
      await sub('장착');
      const cs = '#wb .eqcell:has(img[alt="신발"])';
      ok(await page.evaluate((s) => document.querySelector(s)?.classList.contains('gr-has-up'), cs), 'v631 ▲ 표시는 같은 잣대(실제 전투력)');
      await page.click(cs); await page.waitForSelector('#wb .gr-cmp .gq-top');
      const tp = await page.evaluate(() => { const t = document.querySelector('#wb .gr-cmp > .gq-top'); return { first: document.querySelector('#wb .gr-cmp').firstElementChild === t, up: t.classList.contains('up'), t: t.textContent }; });
      ok(tp.first && tp.up && /바꾸면 더 세져요종합 = 전투력 × 보스 피해종합 ▲ \+\S+/.test(tp.t), 'v631 비교 창 맨 위 — 「바꾸면 더 세져요 · 종합 ▲ +n」(종합 = 전투력 × 보스 피해)', tp.t);
      await page.click('#panel-close'); await page.waitForTimeout(200);
      // 저절로 장착 — 들판 오른쪽 알림 · 장착 창 칸 NEW · 「새로 낀 장비」(전 → 새) · 떠나면 꺼짐
      const nt = await page.evaluate(async () => { const g = window.__s2.g, GR = await import(new URL('js/s2/gear/gear.js', location.href).href), G = g.S.gear;
        G.bag.push(...['ring'].filter((s) => G.eq[s]).map((s) => G.eq[s])); G.eq.ring = null; delete g.S.gearNew; g.dirtyStats = true;
        const it = GR.makeGear(g.rng, 'ring', 2); g.obtain([it], 'drop'); return { on: G.eq.ring === it, nw: !!g.gearNews().ring }; });
      const nc = await until(() => page.evaluate(() => [...document.querySelectorAll('#lootbox .gq-eqn')].map((c) => c.textContent).find((t) => /반지/.test(t)) || ''), (v) => !!v, 3000);   // 같은 때 다른 칸도 바뀌면 한 장에 묶인다
      ok(nt.on && nt.nw && (/새 장비 장착반지 · \S+품.*▲종합 \+\S+/.test(nc) || /새 장비 \d칸 장착.*반지.*▲종합 \+\S+/.test(nc)), 'v631 저절로 장착 → 들판 오른쪽 알림 「새 장비 장착 — 반지 · ○품 ▲종합 +n」', nc);
      const lb = await page.evaluate(() => { const r = document.querySelector('#lootbox').getBoundingClientRect(), s = document.querySelector('#stage-bar, #sp, #contest-hud')?.getBoundingClientRect(); return { right: innerWidth - r.right, top: r.top }; });
      if (W > H) ok(lb.right < 60 && lb.top > 40, 'v631 알림은 오른쪽 알림 칸(위 메뉴 아래)', JSON.stringify(lb));
      await page.click('#mb .nb[data-tab="bag"]'); await page.waitForTimeout(250);
      const nw = await page.evaluate(() => ({ cell: !!document.querySelector('#wb .eqcell:has(img[alt="반지"]) .gq-new'), list: document.querySelector('#wb .gq-news')?.textContent || '', left: Object.keys(window.__s2.g.S.gearNew || {}).length }));
      ok(nw.cell && /새로 낀 장비/.test(nw.list) && /반지빈 칸 → \S+품/.test(nw.list) && nw.left === 0, 'v631 장비 창 — 반지 칸 NEW · 「새로 낀 장비」 전 → 새 · 엔진 표시는 본 것으로', nw.list);
      await sub('가방'); await sub('장착');
      ok(await page.evaluate(() => !document.querySelector('#wb .gq-new') && !document.querySelector('#wb .gq-news')), 'v631 다른 칸에 갔다 오면 NEW · 바뀐 것 꺼짐');
      // 뽑기 결과 — 낀 것은 「장착」 · 모두 전투력 차이 배지
      await page.evaluate(() => { const g = window.__s2.g, G = g.S.gear; for (const s of Object.keys(G.eq)) { if (G.eq[s]) G.bag.push(G.eq[s]); G.eq[s] = null; } g.S.wallet['ticket:gear'] = (g.S.wallet['ticket:gear'] || 0) + 10; g.dirtyStats = true; });   // 뒤 시험이 쓸 뽑기권은 그대로 남긴다
      await sub('뽑기'); await page.click('#wb .gch-tile.main .btn'); await page.waitForSelector('.gx'); await page.click('.gx .skip'); await page.waitForTimeout(250);
      const gx = await page.evaluate(() => ({ eq: [...document.querySelectorAll('.gx .gc .face i')].filter((i) => i.textContent === '장착').length, dp: document.querySelectorAll('.gx .gc .gq-dp').length, up: document.querySelectorAll('.gx .gc .gq-dp.up').length, n: document.querySelectorAll('.gx .gc').length }));
      ok(gx.eq > 0 && gx.dp === gx.n && gx.up >= gx.eq, 'v631 뽑기 결과 — 낀 것 「장착」 · 카드마다 전투력 차이', JSON.stringify(gx));
      await page.click('.gx .skip'); await page.click('#panel-close').catch(() => {}); }
    // 서열(rk-) — 오프라인: 빈 단상(그림자 셋) + 「인터넷에 연결되면 보여요」 · 주간 보상 두 줄(그림 · 뽑기권 칩 · 받기) · 갈래 넷 · 창을 닫으면 작은 무인 그리기 멈춤
    { await page.evaluate(() => { const g = window.__s2.g; g.pvpMark(); Object.assign(g.S.pvp, { lastWk: 'rk-test', lastBest: 1420, lastGot: null }); });
      await page.click('.nb[data-tab="social"]'); await sub('서열'); await page.waitForTimeout(400);
      const rk = await page.evaluate(() => { const W = document.querySelector('#wb'), off = W.querySelector('.rk-list.rk-off'), rows = [...W.querySelectorAll('.row.rk-wk')];
        return { off: !!off && off.offsetHeight > 0, txt: off?.textContent || '', sil: off ? off.querySelectorAll('.rk-pod .rk-p canvas[data-sil]').length : 0, seg: [...W.querySelectorAll('.rk-seg button')].map((b) => b.textContent).join('/'),
          names: rows.map((r) => r.querySelector('.name').textContent).join('/'), pics: rows.filter((r) => r.querySelector('.ico.pic img')).length, chips: rows.filter((r) => r.querySelector('.rk-chip img')).length, chip0: rows[0]?.querySelector('.rk-chip')?.textContent || '',
          btn: rows.map((r) => (r.querySelector('.btn')?.disabled ? 'off' : 'on')).join('/'), wide: W.scrollWidth > W.clientWidth + 1 }; });
      ok(rk.off && /인터넷에 연결되면 보여요/.test(rk.txt) && rk.sil === 3 && rk.seg === '전투력/레벨/이번 주 월드보스/문파', '서열 오프라인 — 빈 단상(그림자 셋) · 「인터넷에 연결되면 보여요」 · 갈래 넷', `${rk.sil} · ${rk.seg}`);
      ok(rk.names === '지난주 대결/지난주 월드보스' && rk.pics === 2 && rk.chips === 2 && /× \d+/.test(rk.chip0) && rk.btn === 'on/off' && !rk.wide, '서열 주간 보상 — 그림 · 뽑기권 칩 두 줄 · 대결 받기 켜짐 · 월드보스(오프라인) 꺼짐 · 옆 넘침 없음', `${rk.names} · ${rk.chip0} · ${rk.btn}`);
      const t0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'] || 0), tix = Number(/\d+/.exec(rk.chip0)?.[0] || 0);
      await page.click('#wb .row.rk-wk:has-text("지난주 대결") .btn:has-text("받기")'); await page.waitForTimeout(300);
      const t1 = await page.evaluate(() => ({ t: window.__s2.g.S.wallet['ticket:gear'] || 0, dis: document.querySelector('#wb .row.rk-wk .btn')?.disabled, chip: document.querySelector('#wb .row.rk-wk .rk-chip')?.textContent }));
      ok(t1.t === t0 + tix && t1.dis && t1.chip === '—', '서열 주간 보상 「받기」 → 뽑기권 +칩 수 · 단추 꺼짐', `${t0} → ${t1.t} (+${tix})`);
      await page.waitForTimeout(1300);
      const fr = () => page.evaluate(() => [...document.querySelectorAll('#wb .rk-pod canvas')].map((c) => +c.dataset.n || 0).reduce((a, b) => a + b, 0));
      const f0 = await fr(); await page.click('#panel-close'); await page.waitForTimeout(150); const f1 = await fr(); await page.waitForTimeout(1500); const f2 = await fr();
      ok(f0 > 0 && f2 === f1, '서열 단상 그림 — 창이 열려 있으면 그리고 · 닫으면 멈춤', `${f0} → ${f1} → ${f2}`); }
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
    // 월드보스 무대(wb-) — 큰 그림이 뜬다 · 남은 도전 = 엔진 · 공동 토벌 길(단계 셋) · 주간 보상 표(여섯 칸) · 옆 넘침 없음 → 도전 → 위 띠(시계 고리 · 피해 큰 수) → 끝까지 → 결과 카드(넣은 피해 = 엔진)
    { await page.click('.nb[data-tab="social"]'); await page.waitForTimeout(200);
      await page.click('#panel-body .subtabs button:has-text("월드보스")'); await page.waitForSelector('#wb .wb-hero');
      const wh = await until(() => page.evaluate(() => { const g = window.__s2.g, W = g.S.wb || {}, used = W.day === String(window.__s2.dayKey(g.now)) ? W.used : 0, im = document.querySelector('#wb .wb-hero .wb-art'), wb = document.getElementById('wb'), h = document.querySelector('#wb .wb-hero').getBoundingClientRect(), pb = document.getElementById('panel-body').getBoundingClientRect();
        return { art: !!im && im.complete && im.naturalWidth > 0, left: +document.querySelector('#wb .wb-tries').dataset.left, on: document.querySelectorAll('#wb .wb-tries i.on').length, want: 3 - used, stg: document.querySelectorAll('#wb .wb-stg').length, tiers: document.querySelectorAll('#wb .wb-tiers > div:not(.wb-th)').length, nums: [...document.querySelectorAll('#wb .wb-nums b')].map((b) => b.textContent), over: wb.scrollWidth - wb.clientWidth, inX: h.left >= pb.left - 1 && h.right <= pb.right + 1, go: !!document.querySelector('#wb .row.wb-go .btn:not(:disabled)') }; }), (v) => v.art);
      ok(wh.art && wh.left === wh.want && wh.on === wh.want && wh.stg === 3 && wh.tiers === 6 && wh.nums.length === 2 && wh.over <= 0 && wh.inX && wh.go, '월드보스 무대: 그림 · 남은 도전 = 엔진 · 공동 토벌 단계 셋 · 주간 보상 여섯 칸 · 넘침 없음', JSON.stringify(wh));
      await page.click('#wb .row .btn:has-text("도전")'); await page.waitForTimeout(700);
      const fh = await page.evaluate(() => ({ dg: window.__s2.g.dg?.type, wbf: document.getElementById('contest-hud').classList.contains('wbf'), sec: +(document.querySelector('#wb-ring b')?.textContent || -1), ring: !!document.querySelector('#wb-ring')?.offsetWidth, dmg: !!document.querySelector('#wb-dmg')?.offsetWidth }));
      ok(fh.dg === 'wboss' && fh.wbf && fh.ring && fh.dmg && fh.sec > 80 && fh.sec <= 90, '월드보스 위 띠: 90초 시계 고리 · 넣은 피해', JSON.stringify(fh));
      await page.evaluate(() => { const g = window.__s2.g, d = g.dg; g.huntDungeon(d.limitMs); });   // 남은 시간을 한 번에 — 끝나면 결과
      await page.waitForSelector('#res.open.wbr', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1600);
      const rr = await page.evaluate(() => { const L = window.__s2.g.lastDg, R = document.querySelector('#res .wb-res'), r = R?.getBoundingClientRect();
        return { card: !!R, ms: L?.ms, dmg: L?.dmg, shown: document.querySelector('#res .wb-rdmg b')?.textContent, n: +document.querySelector('#res .wb-rdmg b')?.dataset.n, art: !!document.querySelector('#res .wb-rart')?.naturalWidth, rew: document.querySelectorAll('#res .wb-rrew span').length, blood: [...document.querySelectorAll('#res .wb-rrew span')].some((x) => /^혈전패 \+8$/.test(x.textContent)), fit: !!r && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, hud: document.getElementById('contest-hud').classList.contains('wbf') }; });
      ok(rr.card && rr.ms >= 90000 && rr.dmg > 0 && rr.n === rr.dmg && /^[1-9]/.test(rr.shown || '') && rr.art && rr.rew === 4 && rr.blood && rr.fit && !rr.hud, '월드보스 끝까지 → 결과 카드(넣은 피해 = 엔진 · 받는 것 넷(v635 혈전패 +8) · 화면 안)', JSON.stringify(rr));
      if (await page.isVisible('#res.open')) await page.click('#rout'); await page.waitForTimeout(200); }
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
      // 전직 사다리(jb-) — 차수 카드 다섯 · 마친 차수 = 금빛 도장 수 = 엔진 · 다음 차수에 「도전」 또는 「Lv n부터」 · 왼쪽 무인이 그려진다 · 넘침 없음
      await sub('전직');
      const jb = await until(() => page.evaluate(() => { const H = window.__s2.g.S.hero, v = document.querySelector('#wb canvas.jb-cv'), wb = document.getElementById('wb'); let drawn = false; if (v) { const d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data; for (let i = 3; i < d.length; i += 16) if (d[i] > 200) { drawn = true; break; } }
        const nx = document.querySelector('#wb .jb-next');
        return { n: document.querySelectorAll('#wb .jb-t').length, seals: document.querySelectorAll('#wb .jb-t .jb-seal').length, adv: H.adv, nm: [...document.querySelectorAll('#wb .jb-nm')].map((e) => e.textContent).join(','), nextN: nx ? +nx.dataset.n : 0, go: nx ? (nx.querySelector('.btn')?.textContent || nx.querySelector('.jb-hint')?.textContent || '') : '', lv: H.lv, drawn, over: wb.scrollWidth - wb.clientWidth }; }), (v) => v.drawn);
      ok(jb.n === 5 && jb.seals === jb.adv && /^1차 전직,2차 전직/.test(jb.nm) && jb.nextN === jb.adv + 1 && (jb.go === '도전' || jb.go === `Lv ${[1, 20, 50, 80, 100, 120][jb.nextN]}부터 · 지금 Lv ${jb.lv}`) && jb.drawn && jb.over <= 1, '전직 창: 차수 카드 다섯 · 도장 수 = 엔진 차수 · 다음 차수에 도전/레벨 안내 · 무인 그림 · 넘침 없음', JSON.stringify(jb));
      await page.click('#panel-close');
      await page.evaluate(() => window.__s2.g.feed.push({ k: 'advance', n: 1 }));
      const bn = await until(() => page.evaluate(() => document.querySelector('.jb-ban b')?.textContent || ''), (v) => !!v);
      ok(/^1차 전직 — \S+$/.test(bn), '전직 순간 — 화면 가득 「1차 전직 — 이름」', bn);
      await page.click('.jb-ban'); await page.waitForTimeout(50);
      ok(!(await page.$('.jb-ban')), '전직 띠는 누르면 바로 닫힌다'); }
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
        for (const bt of await page.$$('#wb button:not(#pass-track button):not(.mp-ch):not(.mx-ch)')) {   /* v611 패스 줄 · v6xx 지도 장 카드 띠 · v636 요괴록 장 띠는 옆으로 넘기는 줄이라 화면 밖 칸이 있다 */  const r = await bt.boundingBox(); if (r && (W < H ? r.y < 0 || r.y + r.height > H + 1 : r.x < 0 || r.x + r.width > W + 1)) outside.push(name); /* 돌린 화면이면 게임의 가로 = 기기의 세로 */ }
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
    // v6xx 지도 → 스테이지 — 칸 길 10칸(두목 칸 · 지금 칸 · 깬 칸) · 장 카드 15장(배경 · 두목 · 진행 줄 · 잠김) · 지금 장이 띠 안에 보임 · 연 장을 누르면 그 장으로 · 「다음 칸 ▶」
    { const a0 = await hold(), s0 = await page.evaluate(() => { const T = window.__s2.g.stage(), r = { top: T.top, idx: T.idx }; T.top = 57; T.idx = 54; T.kills = 0; return r; });
      await page.click('#ptabs button[data-tab="map"]'); await sub('스테이지'); await page.waitForSelector('#wb .mp-strip .mp-ch.cur'); await page.waitForTimeout(250);
      const m = await page.evaluate(() => { const s = document.querySelector('#wb .mp-strip'), c = s.querySelector('.mp-ch.cur'), sr = s.getBoundingClientRect(), cr = c.getBoundingClientRect();
        return { ch: s.querySelectorAll('.mp-ch').length, lock: s.querySelectorAll('.mp-ch.lock').length, cur: c.dataset.ch, inView: cr.left >= sr.left - 1 && cr.right <= sr.right + 1, prog: c.querySelector('.mp-p small')?.textContent,
          n: document.querySelectorAll('#wb .mp-n').length, now: document.querySelectorAll('#wb .mp-n.now').length, clr: document.querySelectorAll('#wb .mp-n.clr').length, boss: !!document.querySelector('#wb .mp-n.boss:last-child img'),
          btns: [...document.querySelectorAll('#wb .mp-track .btn')].map((b) => b.textContent), auto: /두목 자동 도전/.test(document.getElementById('wb').textContent), sw: document.getElementById('panel-body').scrollWidth - document.getElementById('panel-body').clientWidth }; });
      ok(m.ch === 15 && m.lock === 9 && m.cur === '6' && m.inView && m.prog === '10칸 중 6' && m.n === 10 && m.now === 1 && m.clr === 6 && m.boss && m.btns.join() === '◀ 앞 칸,다음 칸 ▶' && m.auto && m.sw <= 1, 'v6xx 지도: 칸 길 10칸 · 장 카드 15장(잠김 9) · 지금 장이 보임', JSON.stringify(m));
      for (const c of await page.$$('#wb .mp-ch')) await c.scrollIntoViewIfNeeded();
      const im = await until(() => page.evaluate(() => [...document.querySelectorAll('#wb .mp-strip img, #wb .mp-n img')].map((i) => i.complete && i.naturalWidth > 0)), (v) => v.every(Boolean));
      ok(im.length === 31 && im.every(Boolean), 'v6xx 지도: 장 배경 · 두목 그림이 뜬다', `${im.filter(Boolean).length}/${im.length}`);
      await page.click('#wb .mp-ch[data-ch="5"]'); await page.waitForTimeout(150);
      const i1 = await page.evaluate(() => window.__s2.g.stage().idx);
      await page.click('#wb .mp-track .btn:has-text("다음 칸")'); await page.waitForTimeout(150);
      const i2 = await page.evaluate(() => ({ idx: window.__s2.g.stage().idx, cur: document.querySelector('#wb .mp-ch.cur')?.dataset.ch, lockOff: document.querySelector('#wb .mp-ch[data-ch="9"]').disabled }));
      ok(i1 === 50 && i2.idx === 51 && i2.cur === '6' && i2.lockOff, 'v6xx 지도: 5장 카드 → 5장 끝 칸 · 「다음 칸 ▶」 → 6장 1칸 · 잠긴 장은 못 누름', `${i1} → ${JSON.stringify(i2)}`);
      await page.evaluate((r) => { const T = window.__s2.g.stage(); T.top = r.top; T.idx = r.idx; T.kills = 0; }, s0); await free(a0); }
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
    // v624 뽑기 결과 — 뒤집는 중 아무 데나 누르면 한꺼번에 · 등급 칩 합 = 뽑은 수 · 진↑가 있으면 「최고」 띠 · 빛살 · 「한 번 더」 → 같은 뽑기 다시(뽑기권 또 10장)
    { await page.evaluate(() => { window.__s2.g.S.wallet['ticket:gear'] = Math.max(20, window.__s2.g.S.wallet['ticket:gear'] || 0); });
      const k0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear']);
      await page.click('#wb .row:has-text("10번 뽑기") .btn'); await page.waitForSelector('.gx');
      await page.mouse.click(8, 8); await page.waitForTimeout(150);
      const gs = () => page.evaluate(() => { const q = (s) => [...document.querySelectorAll(s)], gOf = (c) => +c.className.match(/\bg(\d)\b/)[1], gr = q('.gx .gc').map(gOf), best = Math.max(...gr), lowGfx = !!window.__s2.lowGfx?.();
        const b = document.querySelector('.gx .gxb').getBoundingClientRect(), t = document.querySelector('.gx .gxt').getBoundingClientRect();
        return { n: gr.length, open: q('.gx .gc.open').length, sum: q('.gx .gxs-c').reduce((a, c) => a + +c.dataset.n, 0), chips: q('.gx .gxs span').map((x) => x.textContent).join(' · '), best, top: q('.gx .gc.top').map(gOf), rays: q('.gx .gc.rays').length, rib: q('.gx .gc .gx-rib').length, lowGfx, again: !!document.querySelector('.gx .again:not(.hidden):not(:disabled)'), skip: document.querySelector('.gx .skip')?.textContent, tk: window.__s2.g.S.wallet['ticket:gear'], fit: t.top >= 0 && b.bottom <= innerHeight }; });
      const a = await gs();
      const topOk = (v) => (v.best >= 3 ? v.top.length >= 1 && v.top.every((x) => x === v.best) && v.rib === v.top.length && (v.lowGfx ? v.rays === 0 : v.rays === v.top.length) : v.top.length === 0 && v.rays === 0 && v.rib === 0);
      ok(a.open === 10 && a.skip === '닫기' && a.sum === 10 && a.again && a.fit, `v624 뽑기 결과 — 아무 데나 누르면 한꺼번에 · 등급 칩 합 10 · 「한 번 더」 · 화면 안(${W})`, a.chips);
      ok(topOk(a), 'v624 뽑기 결과 — 진↑가 있으면 가장 좋은 것에만 「최고」 띠 · 빛살(없으면 없음)', JSON.stringify({ best: a.best, top: a.top, rays: a.rays }));
      await page.click('.gx .again'); await page.waitForTimeout(100);
      ok(k0 - a.tk === 10 && (await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'])) === a.tk - 10 && (await page.$$('.gx .gc')).length === 10 && (await page.$$('.gx .gc.open')).length < 10, 'v624 「한 번 더」 → 같은 10번 뽑기 다시(뽑기권 또 10장 · 새 카드)', `${k0} → ${a.tk} → ${a.tk - 10}`);
      await page.click('.gx .skip'); await page.waitForTimeout(150); const b = await gs(); ok(b.sum === 10 && topOk(b), 'v624 다시 뽑은 결과도 칩 합 10 · 최고 표시 맞음', b.chips);
      await page.screenshot({ path: path.join(OUT, `gx-sum-${W}.png`) });
      await page.click('.gx .skip'); ok(!(await page.$('.gx')), 'v624 닫기 → 연출 사라짐'); }
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
    // v628 무공 동작(r13-pose) — 직업마다 새 판: 0차에 0차 무공 · 5차로 올려 다른 무공 둘(5차 궁극기 포함). poLast()가 그 무공 · 차수를 알리고 단계가 pre → rel → post → idle,
    //   끝나면 몸을 옮긴 몫 0(엔진 자리) · 5차는 컷인 · 그래픽 낮음이면 잔상 없이 끝까지 · 콘솔 오류 0. 몹은 질기게(체력 ×300) 무인 앞에 모으고,
    //   수동(자동 사냥 끔 — 무인이 저절로 걷거나 돌아서지 않게)에서 무공 칸을 눌러 쓴다(자동 사냥이면 큰 동작 뒤 다음 몹으로 걸어가며 끝동작을 놓는 게 맞는 동작이라 시험이 흔들린다)
    if (W === 844) {
      const PICK = { sword: [2, 5], spear: [3, 5], fist: [4, 5], bow: [3, 5], mage: [2, 5] };
      for (const job of Object.keys(PICK).concat('sword-low')) {
        const low = job === 'sword-low', jb = low ? 'sword' : job;
        const c2 = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
        await c2.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
        if (low) await c2.addInitScript(() => { try { localStorage.setItem('ifu.s2.opt', JSON.stringify({ gfx: 'low' })); } catch {} });
        const p2 = await c2.newPage(); p2.setDefaultTimeout(8000);
        const e2 = []; p2.on('pageerror', (e) => e2.push(e.message)); p2.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) e2.push(m.text()); });
        await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
        await p2.waitForSelector('#modal:not(.hidden) .jobcard'); await p2.click(`#modal .jobcard[data-job="${jb}"]`);
        await p2.waitForSelector('#modal', { state: 'hidden' });
        // 몹은 늘 무인 앞쪽에(새로 나온 몹이 뒤에 있으면 수동에서도 그쪽으로 돌아선다) · 수동으로 바꾼 뒤 무인이 멈출 때까지 조금 기다린다
        await p2.evaluate(() => { const g = window.__s2.g, h0 = g.hunt.bind(g); g.S.hero.lv = 150; g.dirtyStats = true; window.__s2.freeze(); g.setAuto(false);
          g.hunt = (ms) => { const F = g.ensureFight(), H = F?.hero, f = (window.__pf ??= H?.face || 1); for (const m of F?.mobs || []) { if (!m.__tk) { m.__tk = 1; m.st = { ...m.st, hp: m.st.hp * 300 }; m.hp = m.st.hp; } if (H && m.kind !== 'boss' && ((m.x - H.x) * f < 400 || Math.abs(m.y - H.y) > 300)) { m.x = H.x + f * (900 + (m.id % 5) * 220); m.y = H.y; m.plat = H.plat; m.px = m.x; m.py = m.y; } } return h0(ms); }; });
        await p2.waitForTimeout(1200);
        const cast = (adv, tier) => p2.evaluate(async ([adv, tier, job]) => {
          const g = window.__s2.g; g.S.hero.adv = adv; g.hero.kitUnlock?.();
          const { KIT } = await import(new URL('js/s2/tables/kit.js', location.href).href), sk = KIT[job].find((k) => k.tier === tier && k.kind === 'active');
          const K = g.hero.kitState(); K.lv[sk.id] = Math.max(1, K.lv[sk.id] || 1); K.slots = [sk.id]; K.off = []; g.dirtyStats = true; g.stage().kills = 0;
          const F = g.ensureFight(), H = F.hero, f = window.__pf || H.face || 1, d0 = job === 'bow' || job === 'mage' ? 2600 : 700; let i = 0;
          for (const m of F.mobs) { if (m.kind === 'boss') continue; m.x = H.x + f * (d0 + (i % 5) * 260); m.y = H.y; m.plat = H.plat; m.px = m.x; m.py = m.y; i++; }
          H.cds = undefined; H.kit = g.hero.battleKit(); F.press({ slot: 0 });
          return sk.id;
        }, [adv, tier, jb]);
        const watch = async (id, n0) => { const t0 = Date.now(); let r = null, cut = false, gh = 0; while (Date.now() - t0 < 9000) { const p = await p2.evaluate(() => window.__s2.poLast()); if (p.id === id && p.n > n0) { r = p; cut = cut || p.cut; gh = Math.max(gh, p.ghosts); if (p.phase === 'idle' && p.seen.length > 1) break; } await p2.waitForTimeout(25); } return r && { ...r, cut, gh }; };
        const steps = low ? [[5, 5]] : [[0, 0], [5, PICK[job][0]], [5, PICK[job][1]]];
        for (const [adv, tier] of steps) {
          const n0 = await p2.evaluate(() => window.__s2.poLast().n), id = await cast(adv, tier), r = await watch(id, n0), s = r ? r.seen : [];   // 새로 쓴 것만(새 판은 첫 무공을 이미 저절로 썼다)
          ok(!!r && r.tier === tier && s[0] === 'pre' && s.includes('rel') && s.includes('post') && s[s.length - 1] === 'idle' && r.off[0] === 0 && r.off[1] === 0 && (tier < 5 || r.cut) && (!low || r.gh === 0),
            `v628 무공 동작 ${job} ${adv}차 · ${id}(${tier}차) — 단계 pre → rel → post → idle · 끝나면 엔진 자리${tier === 5 ? ' · 컷인' : ''}${low ? ' · 그래픽 낮음 잔상 없음' : ''}`, r ? JSON.stringify({ seen: s, why: r.why, off: r.off, cut: r.cut, gh: r.gh }) : '안 씀');
        }
        ok(e2.length === 0, `v628 무공 동작 ${job} — 콘솔 오류 없음`, e2.slice(0, 2).join(' | '));
        await p2.evaluate(() => window.__s2.freeze?.());
        await c2.close();
      }
    }
  }
  // v628 평타 — 직업마다 새 판 · 0차 → 5차: 평타가 나가고 baTier()가 그 차수 · 10초 동안 살아 있는 이펙트가 상한(baCap) 아래 · 근접 5차는 기(氣)가 날아감 · 궁 · 술 5차는 차수 화살 · 기탄 · 그래픽 낮음이면 0차 모양 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('ba')) {
    console.log('— v628 평타');
    const baPage = async (job, low) => {
      const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      if (low) await ctx.addInitScript(() => { try { localStorage.setItem('ifu.s2.opt', JSON.stringify({ gfx: 'low' })); } catch { /* 없음 */ } });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click(`#modal .jobcard[data-job="${job}"]`);
      await page.waitForSelector('#modal', { state: 'hidden' });   // 첫 판은 출석 창이 안 뜬다
      await page.evaluate(() => { window.__s2.freeze(); const g = window.__s2.g, T = g.stage(); T.auto = false; });
      return { ctx, page, errs };
    };
    // 차수를 바꾸고 → 새 평타가 나갈 때까지 → secs초 동안 살아 있는 수 · 날아가는 기 · 차수 화살 수의 가장 큰 값을 잰다(무공은 잠시 막아 평타만)
    const baRun = (page, adv, secs) => page.evaluate(([adv, secs]) => new Promise((res) => {
      const s2 = window.__s2, g = s2.g, a0 = s2.baAt(), t0 = performance.now(); g.S.hero.adv = adv;
      let hits = 0, tiers = new Set(), live = 0, waves = 0, shots = 0, last = null;
      const f = () => {
        const F = g.ensureFight(); if (F && F.hero) F.hero.gcd = Math.max(F.hero.gcd || 0, F.t + 2000);
        const ev = g.lastEvents; if (ev !== last) { last = ev; for (const e of ev || []) if (e[0] === 'hit' && e[5] === 0) hits++; }
        if (s2.baAt() !== a0) tiers.add(s2.baTier());
        live = Math.max(live, s2.baLive()); waves = Math.max(waves, s2.baWaves()); shots = Math.max(shots, s2.baShots());
        if (performance.now() - t0 < secs * 1000) requestAnimationFrame(f); else res({ hits, tiers: [...tiers], live, waves, shots, cap: s2.baCap(), end: s2.baLive() });
      };
      requestAnimationFrame(f);
    }), [adv, secs]);
    for (const job of ['sword', 'spear', 'fist', 'bow', 'mage']) {
      const { ctx, page, errs } = await baPage(job, false);
      const r0 = await baRun(page, 0, 4), r5 = await baRun(page, 5, 10);
      const melee = job !== 'bow' && job !== 'mage';
      ok(r0.hits >= 2 && r0.tiers.length === 1 && r0.tiers[0] === 0 && r0.live === 0, `v628 평타 ${job} 0차 — 평타가 나가고 baTier 0 · 새 이펙트 없음(예전 그대로)`, JSON.stringify(r0));
      ok(r5.hits >= 5 && r5.tiers.length === 1 && r5.tiers[0] === 5 && r5.live > 0 && r5.live <= r5.cap && (melee ? r5.waves > 0 : r5.shots > 0), `v628 평타 ${job} 5차 — baTier 5 · 10초 내내 살아 있는 이펙트 ≤ ${r5.cap} · ${melee ? '기가 날아감' : '차수 화살 · 기탄'}`, JSON.stringify(r5));
      ok(errs.length === 0, `v628 평타 ${job} — 콘솔 오류 없음`, errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
    { const { ctx, page, errs } = await baPage('sword', true);   // 그래픽 낮음 — 5차여도 0차 모양(새 이펙트 0)
      const rl = await baRun(page, 5, 4);
      ok(rl.hits >= 2 && rl.tiers.length === 1 && rl.tiers[0] === 0 && rl.live === 0 && errs.length === 0 && await page.evaluate(() => window.__s2.lowGfx()), 'v628 평타 — 그래픽 낮음이면 5차여도 0차 모양', JSON.stringify(rl));
      await ctx.close(); }
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
  // v628 원거리 — 궁사(844×390): 화난 몹이 붙으면 몇 초 안에 뒤로 뛴다 · 표적과 화면 거리 · 화살 밀림 · 전직 0→5를 바꾸면 손잡이가 그 단계로 그린다고 알림 · 4차+ 공중제비 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('range')) {
    console.log('— v628 원거리');
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('ifu.s2.opt', JSON.stringify({ sfx: false, bgm: false, saver: false, vib: false })); } catch { /* 저장 못 함 */ } });
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(100); } };
    const rs = () => page.evaluate(() => window.__s2.rgState());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="bow"]');
    await page.waitForSelector('#modal', { state: 'hidden' });
    await page.evaluate(async () => { const g = window.__s2.g, { expToNext } = await import(new URL('js/s2/tables/exp.js', location.href).href); for (let i = 0; i < 400 && g.S.hero.lv < 60; i++) g.addExp(expToNext(g.S.hero.lv) - g.S.hero.exp + 1); const T = g.stage(); T.idx = T.top = 62; T.kills = 0; T.auto = false; g.dirtyStats = true; if (g.bossFight) g.endChallenge(false); window.__s2.freeze(); });
    const h = await until(rs, (v) => v.hops >= 2 && v.thunks > 0, 20000);
    ok(h.ranged && h.hops >= 2 && h.last && Math.abs(h.last.dir) === 1 && h.last.len >= 900 && h.last.job === 'bow', 'v628 원거리 — 궁사: 화난 몹이 붙으면 20초 안에 뒤로 뛴다(엔진 hop → 화면)', JSON.stringify({ hops: h.hops, last: h.last }));
    ok(h.thunks > 0, 'v628 원거리 — 화살이 몹을 민다(닿을 때 탁 불꽃)', h.thunks);
    const ds = []; for (let i = 0; i < 14; i++) { await page.waitForTimeout(350); const v = (await rs()).dpx; if (v != null) ds.push(v); }
    ds.sort((a, b2) => a - b2); const med = ds[ds.length >> 1];
    ok(ds.length >= 6 && med > 120, 'v628 원거리 — 표적과 화면 거리(가운데 값) 120px 넘게', ds.map(Math.round).join(','));
    const tiers = [];
    for (let a = 0; a <= 5; a++) { await page.evaluate((n) => { window.__s2.g.S.hero.adv = n; }, a); const v = await until(rs, (x) => x.tier === a, 3000); tiers.push({ a, tier: v.tier, adv: v.adv, gh: v.cfg.ghosts }); }
    ok(tiers.every((x) => x.tier === x.a && x.adv === x.a) && tiers[5].gh > tiers[0].gh, 'v628 원거리 — 전직 0→5로 바꾸면 손잡이가 그 단계로 그린다고 알림(잔상 수가 는다)', tiers.map((x) => `${x.a}:${x.tier}/${x.gh}`).join(' '));
    // 5차에서 뛰는 순간을 확실히 — 무인을 바닥 가운데에, 화난 몹 하나를 1m 앞에(맵 끝 · 짧은 발판에 몰려 있으면 안 뛰니까)
    let f = await rs(); const g0 = f.ghosts;
    for (let i = 0; i < 4 && !(f.flips > 0); i++) {
      await page.evaluate(() => { const g = window.__s2.g, F = g.ensureFight(), H = F.hero, m = F.mobs.find((x) => x.kind === 'mob'); if (!m) return; H.x = Math.round(F.def.map.w / 2); H.y = 0; H.vy = 0; H.plat = 0; H.hopReady = 0; H.lockUntil = 0; m.plat = 0; m.y = 0; m.x = H.x + 1000; m.angry = true; });
      f = await until(rs, (x) => x.flips > 0, 3000);
    }
    ok(f.flips > 0 && f.ghosts > g0, 'v628 원거리 — 4차+ 궁사는 뒤로 공중제비 · 잔상', `공중제비 ${f.flips} · 잔상 ${g0} → ${f.ghosts}`);
    ok(errs.length === 0, 'v628 원거리 — 콘솔 오류 없음', errs.slice(0, 2).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v632 자동 움직임 — 검객 · 궁사(844×390 · 667×375): 20초 홀로 사냥 · 처치가 오르고 · 돌아섬이 적고(20초에 12번 아래) · 먼 표적 꺾쇠가 뜨고 · 그래픽 낮음이면 안 뜸 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('auto')) {
    console.log('— v632 자동 움직임');
    for (const [job, W, H, low] of [['sword', 844, 390, false], ['bow', 667, 375, false], ['sword', 844, 390, true]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      await ctx.addInitScript((lo) => { try { localStorage.setItem('ifu.s2.opt', JSON.stringify({ sfx: false, bgm: false, saver: false, vib: false, ...(lo ? { gfx: 'low' } : {}) })); } catch { /* 저장 못 함 */ } }, low);
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click(`#modal .jobcard[data-job="${job}"]`);
      await page.waitForSelector('#modal', { state: 'hidden' });
      const st0 = await page.evaluate(() => { const g = window.__s2.g, T = g.stage(); T.auto = false; if (g.bossFight) g.endChallenge(false); window.__s2.freeze(); const F = g.ensureFight(); return { ...window.__s2.amState(), kills: F.kills }; });   // 첫 칸 그대로(두목 도전은 끔)
      await page.waitForTimeout(low ? 8000 : 20000);
      const st = await page.evaluate(() => ({ ...window.__s2.amState(), kills: window.__s2.g.ensureFight().kills, low: window.__s2.lowGfx() }));
      const turns = st.turns - st0.turns, kills = st.kills - st0.kills, tag = `${job} ${W}×${H}${low ? ' 그래픽 낮음' : ''}`;
      if (!low) {
        await page.screenshot({ path: path.join(OUT, `am-${job}-${W}.png`) });
        ok(st.auto && kills >= 4 && st.picks - st0.picks >= 4, `v632 자동 움직임 ${tag} — 20초 홀로 사냥 · 처치 오름`, `처치 ${kills} · 표적 ${st.picks - st0.picks}`);
        ok(turns <= 12, `v632 자동 움직임 ${tag} — 20초에 돌아섬 12번 아래`, turns);
        for (let w = 0; w < 15 && st.marks <= st0.marks; w++) { await page.waitForTimeout(1000); Object.assign(st, await page.evaluate(() => window.__s2.amState())); }   // 먼 표적은 몹 자리에 따라 늦게 온다 — 15초 더 기다려 본다
        ok(st.marks > st0.marks, `v632 자동 움직임 ${tag} — 먼 표적을 고르면 발밑 꺾쇠`, `${st.marks - st0.marks} · 회피로 좁힘 ${st.dashes - st0.dashes}`);
      } else ok(st.low && st.picks > st0.picks && st.marks === st0.marks, `v632 자동 움직임 ${tag} — 꺾쇠 안 그림(사냥은 그대로)`, `표적 ${st.picks - st0.picks} · 꺾쇠 ${st.marks - st0.marks}`);
      ok(errs.length === 0, `v632 자동 움직임 ${tag} — 콘솔 오류 없음`, errs.slice(0, 2).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
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
  // v630 들판 HUD 겹침 — 알림 줄 ↔ Lv · HP 상자 · 업적 알림 ↔ 사냥터 이름 · Stage 줄 · 두목 도전 ↔ 기연 · 받을 보상 · 전투력 알림 ↔ 사냥터 이름 · 결과 창 단추 ↔ 알림
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('hud')) {
    const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.display !== 'none' && cs.visibility !== 'hidden' ? [r.left, r.top, r.right, r.bottom] : null; };
    for (const [W, H] of [[844, 390], [740, 360], [667, 375], [568, 320]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); page.setDefaultTimeout(15000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard >> nth=0');
      await page.waitForTimeout(700);
      for (let i = 0; i < 3; i++) { if (await page.isVisible('#modal:not(.hidden)')) { const att = await page.$('#modal .btn:has-text("출석")'); if (att) { await att.click(); await page.waitForTimeout(400); const okb = await page.$('#att-ok'); if (okb) await okb.click(); } else { const x = await page.$('#modal .btn'); if (x) await x.click(); } await page.waitForTimeout(300); } }
      await page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 60; g.S.hero.adv = 2; g.dirtyStats = true; g.S.auto = { ...(g.S.auto || {}) }; g.canChallenge = () => true; g.autoReady = () => false; });
      await page.waitForTimeout(800);
      await page.evaluate(() => { const g = window.__s2.g; g.emit('kill', { n: 5000 }); g.S.hero.lv += 1; g.dirtyStats = true; });
      await page.waitForTimeout(700);
      const R = await page.evaluate((bx) => { const box = eval(bx); const L = document.getElementById('loglines'); return { me: box('#me'), log: L && L.textContent.trim() ? box('#loglines') : null, tc: box('#tc'), tr: box('#tr'), ach: box('.achpop'), boss: box('#btn-boss'), fc: box('#fc'), rc: box('#rc'), pw: box('.pwpop') }; }, `(${box})`);
      const hit = (a, c) => !!(a && c && Math.min(a[2], c[2]) - Math.max(a[0], c[0]) > 2 && Math.min(a[3], c[3]) - Math.max(a[1], c[1]) > 2);
      ok(!R.log || R.log[3] <= R.me[1] + 1, `v630 ${W}×${H} 알림 줄이 Lv · HP 상자 위에(겹치지 않음)`, R.log ? `줄 아래 ${Math.round(R.log[3])} · 상자 위 ${Math.round(R.me[1])}` : '줄 없음');
      ok(!hit(R.ach, R.tc) && !hit(R.ach, R.tr), `v630 ${W}×${H} 업적 알림이 사냥터 이름 · Stage 줄 · 오른쪽 위 단추를 가리지 않음`, R.ach ? R.ach.map(Math.round).join(',') : '알림 없음');
      ok(!hit(R.boss, R.fc) && !hit(R.boss, R.rc) && !hit(R.boss, R.tc), `v630 ${W}×${H} 두목 도전 단추가 기연 · 받을 보상 · Stage 줄과 겹치지 않음`, R.boss ? R.boss.map(Math.round).join(',') : '단추 없음');
      ok(!hit(R.pw, R.tc), `v630 ${W}×${H} 전투력 알림이 사냥터 이름 · Stage 줄을 가리지 않음`, R.pw ? R.pw.map(Math.round).join(',') : '알림 없음');
      if (W === 844 || W === 667) {
        // 결과 창 — 알림이 「다음 스테이지」 단추를 가리지 않는다
        await page.evaluate(() => { const g = window.__s2.g; delete g.autoReady; g.challenge(); });
        await page.waitForSelector('#res.open', { timeout: 30000 }).catch(() => {});
        if (await page.isVisible('#res.open')) {
          await page.evaluate(() => window.__s2.toast('현상수배 완료! 알림 시험'));
          await page.waitForTimeout(350);
          const T = await page.evaluate(() => { const t = document.querySelector('#toast .toast')?.getBoundingClientRect(); const bs = [...document.querySelectorAll('#res .rp button, #res .rp label')].map((b) => b.getBoundingClientRect()).filter((r) => r.width > 2); return { t: t && [t.left, t.top, t.right, t.bottom], bs: bs.map((r) => [r.left, r.top, r.right, r.bottom]) }; });
          ok(T.t && T.bs.length && !T.bs.some((r) => hit(T.t, r)), `v630 ${W}×${H} 결과 창이 떠 있을 때 알림이 단추를 가리지 않음`, T.t ? T.t.map(Math.round).join(',') : '알림 없음');
        } else ok(false, `v630 ${W}×${H} 결과 창이 떠야 한다(두목 도전)`);
      }
      ok(errs.length === 0, `v630 ${W}×${H} HUD — 오류 없음`, errs.slice(0, 2).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v629 컴퓨터 화면 고정 — 마우스 기기는 pc.html 틀(가로 · 높이 720 · 폭 16:9~2.17)에 넣어 창 크기에 맞춰 키운다. 자동 시험은 ?pcfix=1 일 때만 틀로 간다
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('pc')) {
    for (const [W, H, LW, LH] of [[1920, 950, 1455, 720], [1000, 1150, 1280, 720], [2560, 1000, 1562, 720], [1366, 657, 1366, 657]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); page.setDefaultTimeout(15000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(BASE + '?pcfix=1', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/pc\.html\?pcfix=1/).catch(() => {});
      const fr = page.frameLocator('#pcf');
      await fr.locator('#modal:not(.hidden) .jobcard').first().waitFor();
      await fr.locator('#modal .jobcard').first().click();
      const inner = page.frames().find((f) => f !== page.mainFrame());
      await inner.waitForFunction(() => window.__s2?.g);
      await page.waitForTimeout(1200);
      const o = await page.evaluate(() => { const r = document.getElementById('pcf').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, s: window.__pcScale }; });
      const i = await inner.evaluate(() => { const c = document.getElementById('cv'); return { iw: innerWidth, ih: innerHeight, land: document.body.classList.contains('land') && !document.body.classList.contains('rot'), cw: c.width, ccw: c.clientWidth, s: window.__pcScale }; });
      const fits = o.l >= -1 && o.t >= -1 && o.l + o.w <= W + 1 && o.t + o.h <= H + 1 && Math.abs(o.l - (W - o.w) / 2) <= 1 && Math.abs(o.t - (H - o.h) / 2) <= 1 && (Math.abs(o.w - W) <= 1 || Math.abs(o.h - H) <= 1);
      ok(page.url().includes('pc.html') && fits && Math.abs(i.iw - LW) <= 1 && Math.abs(i.ih - LH) <= 1 && i.land, `v629 컴퓨터 ${W}×${H} → 가로 틀 ${LW}×${LH} · 창에 맞춰 ×${o.s.toFixed(2)} · 가운데`, `틀 ${Math.round(o.w)}×${Math.round(o.h)} @${Math.round(o.l)},${Math.round(o.t)} · 안 ${i.iw}×${i.ih}`);
      ok(Math.abs(i.cw - Math.round(i.ccw * Math.min(2, i.s))) <= 2, `v629 ${W}×${H} 들판 캔버스는 키운 만큼 촘촘히(흐리지 않게)`, `${i.cw} = ${i.ccw} × ${Math.min(2, i.s).toFixed(2)}`);
      if (W === 1920) {
        await inner.evaluate(() => window.__s2.g.setAuto(false));
        const x0 = await inner.evaluate(() => window.__s2.g.ensureFight().hero.x);
        await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
        const x1 = await inner.evaluate(() => window.__s2.g.ensureFight().hero.x);
        ok(x1 !== x0, 'v629 틀 안에서도 키보드로 움직인다', `${x0} → ${x1}`);
        await inner.evaluate(() => window.__s2.g.setAuto(true));
        await fr.locator('#b-opt').click(); await page.waitForTimeout(400);
        ok(/컴퓨터 화면 고정/.test(await fr.locator('#panel').textContent()), 'v629 설정에 「컴퓨터 화면 고정」');
      }
      ok(errs.length === 0, `v629 ${W}×${H} 틀 — 오류 없음`, errs.slice(0, 2).join(' | '));
      await inner.evaluate(() => window.__s2.freeze?.()).catch(() => {});
      await ctx.close();
    }
    // 손가락 기기는 틀로 가지 않는다 · 끈 사람(ifu-s2-pcfix=0)도 그대로
    { const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); await page.goto(BASE + '?pcfix=1', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
      ok(/index\.html/.test(page.url()) && !(await page.$('#pcf')), 'v629 손가락 기기는 틀 없이 그대로');
      await page.goto(BASE.replace('index.html', 'pc.html'), { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
      ok(/index\.html/.test(page.url()) && !(await page.$('#pcf')), 'v629 손가락 기기로 pc.html 주소를 열어도 틀 없이 게임으로');
      await ctx.close(); }
    { const ctx = await b.newContext({ viewport: { width: 1920, height: 950 }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      await ctx.addInitScript(() => { try { localStorage.setItem('ifu-s2-pcfix', '0'); } catch (e) { /* 없음 */ } });
      const page = await ctx.newPage(); await page.goto(BASE + '?pcfix=1', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200);
      ok(/index\.html/.test(page.url()) && !(await page.$('#pcf')), 'v629 「컴퓨터 화면 고정」을 끈 사람은 창 전체 그대로');
      await ctx.close(); }
  }
  // v628 무공 · 오라 — 전직 0 → 5차: 오라 차수가 따라온다 · 차수가 오르면 전직 순간(덮개 → 띠 + 한 줄 · 누르면 넘김) · 전직 던전 결과 창은 붙잡았다가 넘기면 바로
  //   · 무공(차수마다 PRE · REL · POST — 수명이 차수만큼 길다) · 맞는 때는 PRE 뒤 · 전직 창 빛깔 동그라미 여섯 · 줄을 누르면 미리 보기 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'sk2')) {
    console.log('— v628 무공 · 오라');
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(80); } };
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
    await page.waitForSelector('#modal', { state: 'hidden' });
    await page.waitForTimeout(800);
    const live = () => page.evaluate(() => ({ tier: window.__s2.auTier(), ...window.__s2.auLive(), adv: window.__s2.g.S.hero.adv, ban: document.querySelector('.jb-ban')?.textContent || '' }));
    ok((await live()).tier === 0, 'v628 0차 — 오라 없음', JSON.stringify(await live()));
    const seen = [];
    for (let n = 1; n <= 5; n++) {
      await page.evaluate((x) => { window.__s2.g.S.hero.adv = x; }, n);
      const a = await until(live, (v) => !!v.trans);
      if (n === 3) {   // 한 번은 띠까지 본다 — 「3차 전직 — 이름」 + 「평타 · 무공 빛깔이 바뀌었어요」
        const bn = await until(live, (v) => !!v.ban, 3000);
        ok(a.trans?.n === 3 && a.skip && /^JOB ADVANCE3차 전직 — \S+/.test(bn.ban) && /평타 · 무공 빛깔이 바뀌었어요/.test(bn.ban), 'v628 전직 순간 — 덮개 → 띠(새 차수 · 빛깔이 바뀌었다는 한 줄)', bn.ban);
      }
      await page.mouse.click(422, 200);   // 누르면 넘김(덮개든 띠든)
      const b2 = await until(live, (v) => !v.trans && !v.skip && !v.ban && v.tier === n);
      seen.push(`${n}:${b2.tier}/${b2.parts}`);
      ok(a.trans?.n === n && !b2.trans && !b2.skip && !b2.ban && b2.tier === n && b2.parts >= n, `v628 ${n}차 — 전직 순간이 돌고 누르면 넘어감 · 오라 ${n}차`, JSON.stringify({ a: a.trans, tier: b2.tier, parts: b2.parts }));
    }
    // 전직 던전 결과 창 — 전직 순간 동안은 붙잡았다가, 넘기면 바로 열린다
    await page.evaluate(() => window.__s2.g.feed.push({ k: 'advance', n: 5 }, { k: 'dungeon-end', type: 'job', cleared: true, n: 5, title: '5차 전직', ms: 30000, kills: 12, deaths: 0, gold: 100, exp: 0, tix: 0, stones: 0 }));
    const hd = await until(() => page.evaluate(() => ({ held: window.__s2.auLive().held, res: document.getElementById('res').classList.contains('open') })), (v) => v.held);
    ok(hd.held && !hd.res, 'v628 전직 던전 결과 창은 전직 순간 동안 붙잡힌다', JSON.stringify(hd));
    await page.mouse.click(422, 200);
    const rs = await until(() => page.evaluate(() => ({ res: document.getElementById('res').classList.contains('open'), t: document.querySelector('#res .rnew')?.textContent || '', skip: !!document.querySelector('#au-skip') })), (v) => v.res);
    ok(rs.res && /5차 전직/.test(rs.t) && !rs.skip, 'v628 넘기면 결과 창이 바로(덮개 없이 누를 수 있다)', JSON.stringify(rs));
    if (rs.res) { await page.click('#rout'); await page.waitForTimeout(150); }
    // 무공 — 5차 무공 세트로 사냥: 쓴 무공 · 맞는 때(PRE 뒤) · 수명(PRE + REL + POST)
    await page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 120; g.hero.kitUnlock(); g.dirtyStats = true; });
    const sk = await until(() => page.evaluate(() => window.__s2.skTier()), (v) => v.casts >= 3 && v.hits.length >= 3, 15000);
    const L = sk.last, lifeOk = !!L && L.life === sk.pre[L.tier] + sk.rel[L.tier] + sk.post[L.tier];
    const late = sk.hits.filter((h) => h.ms < sk.pre[h.tier]);
    ok(sk.casts >= 3 && !!L && L.adv === 5 && L.sparks === 12 && L.size > 1 && lifeOk, 'v628 5차 무공 — 차수 빛깔 · 전직만큼 크게 · 불티 12 · 수명 = PRE + REL + POST', JSON.stringify({ casts: sk.casts, last: L }));
    ok(sk.hits.length >= 3 && !late.length, 'v628 무공 숫자 · 번쩍은 기 모음(PRE) 뒤 — 그림이 닿는 때', JSON.stringify(sk.hits.slice(-5)));
    // 전직 창 — 지금 빛깔 + 차수 다섯 = 동그라미 여섯 · 빛깔은 advPal · 줄을 누르면 왼쪽 무인이 그 차수 오라(미리 보기)
    await page.click('#mb .nb[data-key]'); await page.waitForSelector('#wb .sk-slot');
    await page.click('#panel-body .subtabs button:text-is("전직")'); await page.waitForSelector('#wb .jb-t .au-sw');
    const sw = await page.evaluate(async () => { const { advPal } = await import(new URL('js/s2/ui/advfx.js', location.href).href), H = window.__s2.g.S.hero, all = [...document.querySelectorAll('#wb .au-sw')];
      const rung = [...document.querySelectorAll('#wb .jb-t .au-sw')].map((e) => e.style.getPropertyValue('--c').trim());
      return { n: all.length, rung, want: [1, 2, 3, 4, 5].map((i) => advPal(H.job, i).c), now: document.querySelector('#wb .au-now .au-sw')?.style.getPropertyValue('--c').trim(), nowWant: advPal(H.job, H.adv).c, over: document.getElementById('wb').scrollWidth - document.getElementById('wb').clientWidth }; });
    ok(sw.n === 6 && sw.rung.join() === sw.want.join() && sw.now === sw.nowWant && sw.over <= 1, 'v628 전직 창 — 빛깔 동그라미 여섯(지금 + 차수 다섯) · advPal 빛깔 · 넘침 없음', JSON.stringify(sw));
    await page.click('#wb .jb-t[data-n="2"] .jb-tx');
    const pv = await page.evaluate(() => ({ cap: document.querySelector('#wb .au-cap')?.textContent, pv: [...document.querySelectorAll('#wb .jb-t.au-pv')].map((e) => e.dataset.n).join() }));
    ok(pv.cap === '2차 빛깔 미리 보기' && pv.pv === '2', 'v628 전직 창 — 줄을 누르면 그 차수 빛깔 미리 보기', JSON.stringify(pv));
    await page.click('#panel-close');
    // 그래픽 낮음 — 오라 끔(0) · 전직 순간은 띠만(바로) · 누르면 넘김 · 무공은 선 하나씩(오류 없이)
    const gfx = async () => { await page.click('#b-opt'); await page.click('#wb .row:has(.name:text-is("그래픽")) .btn'); const low = await page.evaluate(() => window.__s2.lowGfx()); await page.click('#panel-close'); return low; };
    const lowOn = await gfx();
    await page.evaluate(() => { window.__s2.g.S.hero.adv = 4; }); await page.waitForTimeout(200);
    await page.evaluate(() => window.__s2.g.feed.push({ k: 'advance', n: 5 }));
    const lw = await until(live, (v) => !!v.trans && !!v.ban);
    ok(lowOn && lw.trans?.low && /5차 전직/.test(lw.ban) && lw.tier === 0, 'v628 그래픽 낮음 — 오라 끔 · 전직 순간은 띠만', JSON.stringify({ low: lowOn, trans: lw.trans, tier: lw.tier }));
    await page.mouse.click(422, 200);
    const lw2 = await until(live, (v) => !v.trans && !v.skip && !v.ban);
    const c0 = (await page.evaluate(() => window.__s2.skTier())).casts;
    const lc = await until(() => page.evaluate(() => window.__s2.skTier()), (v) => v.casts >= c0 + 2, 12000);
    ok(!lw2.trans && !lw2.ban && lc.casts >= c0 + 2 && lc.last?.sparks === 0, 'v628 그래픽 낮음 — 넘김 · 무공은 덧그림 없이(불티 0)', JSON.stringify({ casts: lc.casts - c0, last: lc.last }));
    if (lowOn) await gfx();
    ok(errs.length === 0, 'v628 무공 · 오라 — 콘솔 오류 없음', errs.slice(0, 3).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v632 무공 변형 — 무공 강화 4단: 15점 쓰면 카드 둘(움직이는 그림 · 무리/두목 쪽) · 고르기 → 빛남 · 저장(다시 열어도) · 사냥터에서 그 변형 그림(skVar) · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'tv')) {
    console.log('— v632 무공 변형');
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(80); } };
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
    await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(600);
    // Lv140 · 5차 · 천지일검(sword_7)에만 점수 16
    await page.evaluate(async () => { const { treeOf, skillById } = await import(new URL('js/s2/tables/kit.js', location.href).href), g = window.__s2.g; g.S.hero.lv = 140; g.S.hero.adv = 5; g.hero.kitUnlock(); g.dirtyStats = true; for (const nd of treeOf(skillById('sword_7'))) while (g.hero.treeSpent('sword_7') < 16 && g.treeUp('sword_7', nd.n)); });
    const openTree = async () => { await page.click('#mb .nb[data-key]'); await page.waitForSelector('#wb .sk-slot'); await page.click('#panel-body .subtabs button:text-is("무공 강화")'); await page.waitForSelector('#wb .sk-tree'); await page.click('#wb .sk-pick .chip[data-id="sword_7"]'); await page.waitForSelector('#wb .tv-row[data-id="sword_7"]'); };
    await openTree();
    const cv = () => page.evaluate(() => [...document.querySelectorAll('#wb .tv-cv')].map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 3; i < d.length; i += 4 * 7) h = (h * 31 + d[i]) >>> 0; return h; }));
    const c1 = await cv(); await page.waitForTimeout(350); const c2 = await cv();
    const t0 = await page.evaluate(() => { const row = document.querySelector('#wb .tv-row'), cards = [...row.querySelectorAll('.tv-card')], wb = document.getElementById('wb'); return { on: row.classList.contains('on'), n: cards.length, vs: cards.map((c) => c.dataset.v).join(), tags: cards.map((c) => c.querySelector('.tv-tag').textContent).join(), btn: cards.map((c) => !c.querySelector('.btn').disabled).join(), over: wb.scrollWidth - wb.clientWidth }; });
    ok(t0.on && t0.n === 2 && t0.vs === 'fork,back' && t0.tags === '무리 쪽,두목 쪽' && t0.btn === 'true,true' && c1.length === 2 && c1.some((h, i) => h !== c2[i]) && t0.over <= 1, 'v632 무공 강화 4단 — 카드 둘(세 갈래 · 되돌아옴) · 움직이는 그림 · 고르기 · 넘침 없음', JSON.stringify({ ...t0, anim: c1.map((h, i) => h !== c2[i]) }));
    await page.click('#wb .tv-card[data-v="fork"] .btn'); await page.waitForTimeout(300);
    const t1 = await page.evaluate(() => { const K = window.__s2.g.hero.kitState(), on = document.querySelector('#wb .tv-card.on'); return { v: K.var?.sword_7, on: on?.dataset.v, glow: on ? getComputedStyle(on).boxShadow !== 'none' : false, other: document.querySelector('#wb .tv-card[data-v="back"] .btn').disabled, txt: document.querySelector('#wb .tv-card.on .btn').textContent, kit: window.__s2.g.hero.battleKit().find((k) => k.id === 'sword_7').vr }; });
    ok(t1.v === 'fork' && t1.on === 'fork' && t1.glow && t1.other && t1.txt === '고름' && t1.kit === 'fork', 'v632 고르면 그 카드가 빛나고(고름) · 다른 쪽은 막힘 · 전투 무공에 실림', JSON.stringify(t1));
    const sv = await page.evaluate(async () => { window.__s2.save(); const { Game } = await import(new URL('js/s2/game.js', location.href).href), g2 = Game.load(window.__s2.g.save(), Date.now()); return { v: g2.hero.kitState().var?.sword_7 || null, kit: g2.hero.battleKit().find((k) => k.id === 'sword_7').vr }; });
    ok(sv.v === 'fork' && sv.kit === 'fork', 'v632 고른 변형은 세이브에 남는다(불러와도 세 갈래)', JSON.stringify(sv));
    // 사냥터 — 천지일검만 자동으로: 쓸 때 세 갈래 그림(skVar) · cast 사건 [8]
    await page.evaluate(() => { document.querySelector('#panel-close')?.click(); const g = window.__s2.g, K = g.hero.kitState(); K.off = K.slots.filter((x) => x !== 'sword_7'); g.dirtyStats = true; });
    const fv = await until(() => page.evaluate(() => window.__s2.skVar()), (v) => v.some((q) => q.vr === 'fork' && q.id === 'sword_7'), 15000);
    ok(fv.some((q) => q.vr === 'fork' && q.id === 'sword_7'), 'v632 사냥터 — 고른 변형이 무공 그림에 보인다(세 갈래)', JSON.stringify(fv.slice(-3)));
    ok(errs.length === 0, 'v632 무공 변형 — 콘솔 오류 없음', errs.slice(0, 3).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v634 강함 진맥 · 기능 열림 띠 — 자동 시험에선 window.__s2feat 을 켜야 띠가 뜬다. 띠 · 구멍(그 창 단추) · 가 보기 → 그 칸 · 한 번만 · 두목전 중엔 기다림 /
  //   캐릭터 → 스탯 「강함 진맥」 층 막대 · 가장 뒤처진 줄 「여기부터」 · 가기 / 두목에게 지면 결과 창에 「가장 뒤처진 것」 · 가기
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'dg2')) {
    for (const [W, H] of [[844, 390], [667, 375]]) {
      console.log(`— v634 강함 진맥 · 기능 열림 ${W}×${H}`);
      const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      await ctx.addInitScript(() => { window.__s2feat = true; });
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(400);
      const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(100); } };
      const lvTo = (L) => page.evaluate(async (L) => { const { cumExp } = await import(new URL('js/s2/tables/exp.js', location.href).href), g = window.__s2.g; g.addExp(cumExp(L) - cumExp(g.S.hero.lv) - g.S.hero.exp + 1); }, L);
      // 처음 켤 때 이미 지난 것(Lv 9 — 원정)은 조용히 본 것으로 → Lv 12 무한 탑만 뜬다
      await lvTo(9);   // 레벨을 먼저 올리고 · 지운 뒤 바로 같은 자리에서 한 번 돈다(1초 타이머가 사이에 끼지 않게)
      const f0 = await page.evaluate(() => { window.__s2pz.featReset(); localStorage.removeItem('ifu.s2.feat'); return window.__s2pz.featTick(); });
      await lvTo(12);
      const f1 = await until(() => page.evaluate(() => (window.__s2pz.featTick(), document.querySelector('#feat')?.dataset.id || null)), (v) => !!v);
      await page.waitForTimeout(200);
      const r1 = await page.evaluate(() => { const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { hole: R(document.querySelector('#feat .co-hole')), tg: R(document.querySelector('.nb[data-tab="dgn"]')), bub: R(document.querySelector('#feat .co-bub')), ban: document.querySelector('#feat .ft-ban').textContent, W: innerWidth, H: innerHeight, seen: JSON.parse(localStorage.getItem('ifu.s2.feat') || '[]') }; });
      const ov = (a, c) => Math.max(0, Math.min(a[2], c[2]) - Math.max(a[0], c[0])) * Math.max(0, Math.min(a[3], c[3]) - Math.max(a[1], c[1])), area = (a) => (a[2] - a[0]) * (a[3] - a[1]), inV = (a) => a[0] >= -1 && a[1] >= -1 && a[2] <= r1.W + 1 && a[3] <= r1.H + 1;
      ok(f0 === false && f1 === 'tower' && /무한 탑/.test(r1.ban) && ov(r1.hole, r1.tg) >= area(r1.tg) * 0.95 && inV(r1.bub) && ov(r1.hole, r1.bub) === 0 && r1.seen.includes('exped') && r1.seen.includes('tower'), 'v634 기능 열림 — 지난 것은 조용히 · Lv 12 「무한 탑」 띠 · 구멍이 던전 단추 · 말풍선 화면 안', JSON.stringify({ f0, f1, ban: r1.ban, hole: r1.hole.map(Math.round), tg: r1.tg.map(Math.round) }));
      await page.click('#feat .co-next'); await page.waitForTimeout(400);
      const r2 = await page.evaluate(() => ({ feat: !!document.querySelector('#feat'), sub: document.querySelector('#panel-body .subtabs button.on')?.textContent, again: window.__s2pz.featTick() }));
      ok(!r2.feat && r2.sub === '무한 탑' && r2.again === false, 'v634 가 보기 → 무한 탑 칸 · 띠 사라짐 · 다시 안 뜸', JSON.stringify(r2));
      await page.click('#panel-close');
      // 두목전 중에는 기다렸다가 끝나면
      await page.evaluate(() => { const g = window.__s2.g; g.stage().kills = 20; g.stage().auto = false; g.challenge(); });
      await lvTo(20);
      const r3 = await page.evaluate(() => ({ boss: !!window.__s2.g.bossFight, t: window.__s2pz.featTick(), feat: !!document.querySelector('#feat') }));
      await page.evaluate(() => { const g = window.__s2.g; if (g.bossFight) g.endChallenge(false); });
      await page.waitForSelector('#res.open');
      const r4 = await page.evaluate(() => ({ t: window.__s2pz.featTick(), tip: document.querySelector('#res .rtip')?.textContent || '', btn: !!document.querySelector('#res #rpz'), low: window.__s2pz.pulseLow() }));
      ok(r3.boss && r3.t === false && !r3.feat && r4.t === false, 'v634 두목전 · 결과 창 동안엔 띠를 띄우지 않는다', JSON.stringify({ r3, t4: r4.t }));
      ok(r4.btn && /가장 뒤처진 것/.test(r4.tip) && r4.low && r4.tip.includes(r4.low.name), 'v634 두목에게 지면 결과 창 — 가장 뒤처진 것 한 줄 · 가기', r4.tip);
      await page.waitForTimeout(600);   // 결과 창 커지는 움직임이 끝난 뒤 잰다
      const rb = await page.evaluate(() => { const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }; return { rp: R(document.querySelector('#res .rp')), go: R(document.querySelector('#rpz')), W: innerWidth, H: innerHeight }; });
      ok(rb.rp[1] >= 0 && rb.rp[3] <= rb.H && rb.go[3] <= rb.rp[3] && rb.go[3] - rb.go[1] >= 36, 'v634 결과 창이 화면 안 · 가기 단추 크기', JSON.stringify(rb));
      await page.click('#rpz'); await page.waitForTimeout(400);
      const want = { 'hero:0': '스탯', 'hero:1': '무공', 'hero:2': '마스터리', 'hero:3': '전직', 'gear:0': '장착', 'gear:2': '강화·성혼', 'grow:0': '병기', 'grow:1': '동료', 'grow:2': '영물', 'grow:3': '경지', 'grow:4': '강호행', 'content:0': '수련동' };
      const r5 = await page.evaluate(() => ({ res: document.getElementById('res').classList.contains('open'), sub: document.querySelector('#panel-body .subtabs button.on')?.textContent }));
      ok(!r5.res && r5.sub === want[r4.low.go], 'v634 결과 창 「가기」 → 그 칸', `${r4.low.go} → ${r5.sub}`);
      await page.click('#panel-close').catch(() => {});
      // 강함 진맥 카드 — 자동 성장 몇 번 뒤(Lv 45 · 스테이지 45)
      await page.evaluate(async () => { const { cumExp } = await import(new URL('js/s2/tables/exp.js', location.href).href), g = window.__s2.g; g.addExp(cumExp(45) - cumExp(g.S.hero.lv) - g.S.hero.exp + 1); for (let i = 0; i < 10; i++) g.autoGrow({}); const T = g.stage(); T.idx = T.top = 45; T.kills = 0; T.auto = false; localStorage.setItem('ifu.s2.feat', JSON.stringify(['exped', 'tower', 'dg', 'adv1', 'adv2', 'adv3', 'adv4', 'adv5', 'mastery', 'realm', 'party', 'pvp'])); window.__s2pz.featReset(); });
      await page.click('#mb .nb[data-tab="char"]'); await page.waitForSelector('#wb .pz');
      const r6 = await page.evaluate(() => { const rows = [...document.querySelectorAll('#wb .pz-row')], low = document.querySelector('#wb .pz-row.low'), wb = document.getElementById('wb'), P = window.__s2pz.pulse(); return { n: rows.length, ks: rows.map((r) => r.dataset.k).join(), low: low?.dataset.k, tag: low?.querySelector('.pz-tag')?.textContent, go: !!low?.querySelector('.pz-go'), plow: P.low?.k, pgo: P.low?.go, bars: rows.every((r) => r.querySelector('.pz-bar i')), over: wb.scrollWidth - wb.clientWidth, top: document.querySelector('#wb .pz-top')?.textContent }; });
      ok(r6.n >= 9 && r6.bars && r6.low === r6.plow && r6.tag === '여기부터' && r6.go && r6.over <= 1, 'v634 강함 진맥 카드 — 층 막대 · 가장 뒤처진 줄 「여기부터」 · 가기 · 넘침 없음', JSON.stringify(r6));
      await page.locator('#wb .pz-go').scrollIntoViewIfNeeded(); await page.click('#wb .pz-go'); await page.waitForTimeout(300);
      const r7 = await page.evaluate(() => document.querySelector('#panel-body .subtabs button.on')?.textContent);
      ok(r7 === want[r6.pgo], 'v634 강함 진맥 「가기」 → 그 칸', `${r6.pgo} → ${r7}`);
      ok(errs.length === 0, 'v634 강함 진맥 · 기능 열림 — 콘솔 오류 없음', errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v634 단약 · 성장 봇짐 — 들판 단약 칩(링 셋 · 다른 칩과 안 겹침) · 먹기 · 모두 먹기 · EXP 줄 끝 봇짐(수 · 받기 · 모두 받기) · 받을 보상 칸 · 설정 「단약 자동」 · 콘솔 오류 0
  for (const [W, H] of [[844, 390], [667, 375]]) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(String(W))) continue;
    console.log(`— v634 단약 · 성장 봇짐 ${W}×${H}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
    await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(1500);
    const lay = () => page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.classList.contains('hidden') || !e.offsetParent) return null; return e.getBoundingClientRect(); };
      const hit = (a, c) => a && c && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
      const bf = r('#bf'), lv = r('#lvb'), others = ['#qc', '#fc', '#rc', '#nx', '#tc', '#me', '#mb', '#tr', '#sk', '#tl', '#btn-boss'];
      return { bf: !!bf, lv: !!lv, rings: document.querySelectorAll('#bf .bf-r').length, hitBf: others.filter((s) => hit(bf, r(s))), hitLv: others.filter((s) => s !== '#me' && hit(lv, r(s))), inBf: bf ? bf.right <= innerWidth && bf.bottom <= innerHeight : false, inLv: lv ? lv.right <= innerWidth && lv.bottom <= innerHeight : false, lvN: document.querySelector('#lvb-n')?.textContent, lvCan: document.querySelector('#lvb')?.classList.contains('can') }; });
    const l0 = await lay();
    ok(l0.bf && l0.rings === 3 && !l0.hitBf.length && l0.inBf && l0.lv && !l0.hitLv.length && l0.inLv && l0.lvN === 'Lv5' && !l0.lvCan, `v634 ${W} 들판 — 단약 칩(링 셋) · EXP 줄 끝 봇짐(다음 Lv5) · 다른 칸과 안 겹침`, JSON.stringify(l0));
    // 받을 보상 칩이 숨으면 단약 칩이 그 자리로 · 그래도 안 겹침
    await page.evaluate(() => { document.querySelector('#rc').classList.add('hidden'); }); const l0b = await lay();
    ok(!l0b.hitBf.length && l0b.inBf, `v634 ${W} 받을 보상 칩이 없을 때도 안 겹침`, JSON.stringify(l0b.hitBf));
    await page.click('#bf'); await page.waitForSelector('#modal:not(.hidden) .bf-row');
    const p0 = await page.evaluate(() => ({ n: document.querySelectorAll('#modal .bf-row').length, names: [...document.querySelectorAll('#modal .bf-row b')].map((x) => x.textContent).join('/'), btn: [...document.querySelectorAll('#modal .bf-row .btn')].map((x) => x.textContent).join() }));
    ok(p0.n === 3 && /청심단/.test(p0.names) && /재물부/.test(p0.names) && /혈기단/.test(p0.names) && p0.btn === '먹기,먹기,먹기', `v634 ${W} 단약 창 — 셋 · 먹기`, JSON.stringify(p0));
    await page.click('#modal .bf-row[data-id="exp"] .btn'); await page.waitForTimeout(250);
    const p1 = await page.evaluate(() => ({ on: window.__s2.g.bfState()[0].on, btn: document.querySelector('#modal .bf-row[data-id="exp"] .btn')?.textContent, sm: document.querySelector('#modal .bf-row[data-id="exp"] small')?.textContent, ring: document.querySelector('#bf .bf-r[data-id="exp"]').classList.contains('on'), u: document.querySelector('#bf .bf-r[data-id="exp"] u').textContent }));
    ok(p1.on && p1.btn === '+30분' && /30분 남음 · 오늘 2\/3번/.test(p1.sm) && p1.ring && p1.u === '30', `v634 ${W} 청심단 먹기 → 링 켜짐(30분) · 창은 +30분`, JSON.stringify(p1));
    await page.click('#modal .btn-row .btn:has-text("모두 먹기")'); await page.waitForTimeout(250);
    const p2 = await page.evaluate(() => ({ st: window.__s2.g.bfState().map((s) => `${s.on ? 1 : 0}${s.uses}`).join(), on: document.querySelectorAll('#bf .bf-r.on').length, pw: window.__s2.g.power() }));
    ok(p2.st === '12,12,12' && p2.on === 3, `v634 ${W} 모두 먹기 — 꺼진 둘만 먹음 · 링 셋 다 켜짐`, JSON.stringify(p2));
    // 성장 봇짐 — Lv23으로 → 받을 4 · 창 · 하나 받기 · 받을 보상 칸에도 · 모두 받기
    await page.evaluate(async () => { const { cumExp } = await import(new URL('js/s2/tables/exp.js', location.href).href), g = window.__s2.g; g.addExp(cumExp(23) - cumExp(g.S.hero.lv) - g.S.hero.exp + 1); window.__s2.paintLvb(true); });
    const l1 = await lay();
    ok(l1.lvCan && l1.lvN === '4' && !l1.hitLv.length, `v634 ${W} Lv23 — 봇짐 4 · 반짝`, JSON.stringify(l1));
    await page.click('#lvb'); await page.waitForSelector('#modal:not(.hidden) .lvbx');
    const q0 = await page.evaluate(() => ({ can: document.querySelectorAll('#modal .lvbx.can').length, btn: document.querySelectorAll('#modal .lvbx.can .btn').length, big: [...document.querySelectorAll('#modal .lvbx.big b')].map((x) => x.textContent).slice(0, 2).join('/'), txt: (/undefined|NaN|null/.exec(document.querySelector('#modal').textContent) || [''])[0], over: (() => { const m = document.querySelector('#modal .sheet').getBoundingClientRect(); return m.bottom <= innerHeight + 1 && m.right <= innerWidth + 1; })() }));
    ok(q0.can === 4 && q0.btn === 4 && /Lv 10 큰 봇짐/.test(q0.big) && !q0.txt && q0.over, `v634 ${W} 봇짐 창 — 받기 4 · 큰 봇짐 · 화면 안`, JSON.stringify(q0));
    const t0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'] || 0);
    await page.click('#modal .lvbx.can .btn >> nth=0'); await page.waitForTimeout(250);
    const q1 = await page.evaluate(() => ({ can: window.__s2.g.lvBoxCan(), got: window.__s2.g.S.lvBox.got.join(), t: window.__s2.g.S.wallet['ticket:gear'] || 0, rc: document.querySelector('#modal .lvbx.can') ? document.querySelectorAll('#modal .lvbx.can').length : 0 }));
    ok(q1.can === 3 && q1.got === '5' && q1.t === t0 + 1 && q1.rc === 3, `v634 ${W} 하나 받기 — Lv5 봇짐(뽑기권 +1) · 창이 다시 그려짐`, JSON.stringify(q1));
    await page.click('#modal .btn-row .btn:has-text("닫기")');
    const rc = await page.evaluate(() => { document.querySelector('#rc').click(); return [...document.querySelectorAll('#modal .rc-r span')].map((x) => x.textContent); });
    ok(rc.includes('성장 봇짐'), `v634 ${W} 받을 보상 칸에 「성장 봇짐」`, rc.join(','));
    await page.click('#modal .btn-row .btn:has-text("모두 받기")'); await page.waitForTimeout(300);
    const q2 = await page.evaluate(() => { window.__s2.paintLvb(true); return { can: window.__s2.g.lvBoxCan(), n: document.querySelector('#lvb-n').textContent, c: document.querySelector('#lvb').classList.contains('can') }; });
    ok(q2.can === 0 && q2.n === 'Lv25' && !q2.c, `v634 ${W} 모두 받기(받을 보상) — 봇짐도 받음 · 다음 Lv25`, JSON.stringify(q2));
    // 설정 — 자동 성장을 켜면 「단약 자동」 줄
    await page.evaluate(() => { window.__s2.opt.autoGrow = true; }); await page.click('#b-opt'); await page.waitForSelector('#wb .row');
    const sw = await page.evaluate(() => [...document.querySelectorAll('#wb .row')].some((r) => /단약 자동/.test(r.textContent) && /꺼짐/.test(r.textContent)));
    ok(sw, `v634 ${W} 설정 — 「단약 자동」(기본 꺼짐)`);
    await page.evaluate(() => { window.__s2.opt.autoGrow = false; });
    await page.screenshot({ path: path.join(OUT, `s2-v634-${W}.png`) });
    ok(errs.length === 0, `v634 ${W} 단약 · 성장 봇짐 — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v634 차림 — 장비 · 캐릭터 창에 칸 셋(입기 · 적기) · 벗기 · 고치기(이름 · 사냥/두목) · 넘침 없음 · 단추 높이 33px+(창 배율) · 칸 두목 들어가면 두목 차림 · 콘솔 오류 0
  for (const [W, H] of [[844, 390], [667, 375]]) {
    if (process.env.ONLY && !process.env.ONLY.split(',').some((x) => x === String(W) || x === 'of')) continue;
    console.log(`— v634 차림 ${W}`);
    const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
    await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
    const page = await ctx.newPage(); page.setDefaultTimeout(8000);
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
    await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(600);
    await page.evaluate(() => { const g = window.__s2.g; g.addExp(1e7); g.S.wallet['ticket:gear'] = 200; for (let i = 0; i < 20; i++) g.pullGear(10); g.feed = []; });
    const look = () => page.evaluate(() => { const c = document.querySelector('#of-card'), pb = document.querySelector('#panel-body'); if (!c) return null; const segs = [...c.querySelectorAll('.of-seg')];
      const btns = [...c.querySelectorAll('button')].map((x) => x.getBoundingClientRect()), r = c.getBoundingClientRect();
      return { n: segs.length, names: segs.map((s) => s.querySelector('b').textContent).join('|'), on: segs.findIndex((s) => s.classList.contains('on')), dis: segs.map((s) => s.querySelector('button').disabled).join(), sub: c.querySelector('.of-sub').textContent,
        over: pb.scrollWidth - pb.clientWidth, out: btns.filter((q) => q.left < r.left - 1 || q.right > r.right + 1).length, minH: Math.min(...btns.map((q) => q.height)) }; });
    await page.click('#ptabs button[data-tab="bag"]').catch(() => page.evaluate(() => document.querySelector('.nb[data-tab="bag"]')?.click()));
    await page.waitForSelector('#of-card');
    const a0 = await look();
    ok(a0 && a0.n === 3 && a0.names === '차림 1|차림 2|차림 3' && a0.on === -1 && a0.dis === 'true,true,true' && a0.over <= 1 && a0.out === 0 && a0.minH >= 32.9, `v634 차림 ${W} — 장비 창: 빈 칸 셋(입기 막힘) · 넘침 없음 · 단추 높이 33px+(창 배율)`, JSON.stringify(a0));
    await page.click('#of-card .of-seg[data-i="0"] button:text-is("적기")'); await page.waitForTimeout(200);
    const a1 = await look(); const s1 = await page.evaluate(() => { const O = window.__s2.g.S.outfit; return { cur: O.cur, has: !!O.sets[0], hold: window.__s2.g.outfitHold() }; });
    ok(s1.cur === 0 && s1.has && s1.hold && a1.on === 0 && /입는 중/.test(a1.sub), `v634 차림 ${W} — 적기 → 그 칸을 입은 차림(빛남 · 입는 중)`, JSON.stringify({ ...s1, sub: a1.sub }));
    // 둘째 칸: 무기를 가방 것으로 바꾸고 적기 → 첫째 입기로 돌아옴
    const w0 = await page.evaluate(() => { const g = window.__s2.g, G = g.S.gear, it = G.bag.find((x) => x.slot === 'weapon'); const w = G.eq.weapon.uid; if (it) { G.bag.splice(G.bag.indexOf(it), 1); G.bag.push(G.eq.weapon); G.eq.weapon = it; g.dirtyStats = true; } return w; });
    await page.click('#of-card .of-seg[data-i="1"] button:text-is("적기")'); await page.waitForTimeout(200);
    await page.click('#of-card .of-seg[data-i="0"] button:text-is("입기")'); await page.waitForTimeout(250);
    const s2 = await page.evaluate(() => ({ w: window.__s2.g.S.gear.eq.weapon.uid, cur: window.__s2.g.S.outfit.cur, toast: [...document.querySelectorAll('#toast .toast')].map((t) => t.textContent).join('|') }));
    ok(s2.w === w0 && s2.cur === 0 && /입음 · 전투력/.test(s2.toast), `v634 차림 ${W} — 입기 → 그 장비로 · 전투력 알림`, JSON.stringify(s2));
    // 고치기 — 이름 · 사냥/두목
    await page.click('#of-card button:text-is("고치기")'); await page.waitForSelector('#modal:not(.hidden) .of-pop');
    const pp = await page.evaluate(() => { const sh = document.querySelector('#modal .sheet'), r = sh.getBoundingClientRect(); return { in: r.top >= 0 && r.bottom <= innerHeight + 1, nm: sh.querySelectorAll('.of-nm').length, hunt: sh.querySelectorAll('#of-hunt option').length }; });
    ok(pp.in && pp.nm === 3 && pp.hunt === 3, `v634 차림 ${W} — 고치기 창(이름 셋 · 걸기 고르기 · 화면 안)`, JSON.stringify(pp));
    await page.fill('#modal .of-nm[data-i="1"]', '두목'); await page.selectOption('#of-boss', '1'); await page.click('#modal .btn:text-is("고치기")'); await page.waitForTimeout(250);
    const a2 = await look(), s3 = await page.evaluate(() => { const O = window.__s2.g.S.outfit; return { boss: O.boss, hunt: O.hunt, n: O.names[1] }; });
    ok(s3.boss === 1 && s3.hunt === -1 && s3.n === '두목' && a2.names === '차림 1|두목|차림 3' && /두목/.test(await page.evaluate(() => document.querySelector('#of-card .of-seg[data-i="1"] em')?.textContent || '')), `v634 차림 ${W} — 이름 · 두목 차림 걸기`, JSON.stringify({ ...s3, names: a2.names }));
    // 칸 두목 — 들어가면 두목 차림(무기 바뀜) · 끝나면 되돌아옴
    const bf = await page.evaluate(() => { const g = window.__s2.g, T = g.stage(); T.kills = 999; const ok1 = g.challenge(); const w = g.S.gear.eq.weapon.uid, cur = g.S.outfit.cur; g.endChallenge(false); return { ok1, w, cur, back: g.S.gear.eq.weapon.uid, cur2: g.S.outfit.cur }; });
    ok(bf.ok1 && bf.cur === 1 && bf.w !== w0 && bf.back === w0 && bf.cur2 === 0, `v634 차림 ${W} — 칸 두목: 두목 차림 → 끝나면 전 차림`, JSON.stringify(bf));
    await page.evaluate(() => { const m = document.querySelector('#modal'); if (m && !m.classList.contains('hidden')) m.classList.add('hidden'); });
    // 벗기 · 캐릭터 창에도
    await page.click('#ptabs button[data-tab="char"]'); await page.waitForSelector('#of-card');
    await page.click('#of-card button:text-is("벗기")'); await page.waitForTimeout(200);
    const a3 = await look();
    ok(a3 && a3.on === -1 && !/입는 중/.test(a3.sub) && a3.over <= 1 && a3.out === 0 && !(await page.evaluate(() => window.__s2.g.outfitHold())), `v634 차림 ${W} — 캐릭터 창에도 · 벗기 → 저절로 끼기 다시`, JSON.stringify(a3));
    ok(errs.length === 0, `v634 차림 ${W} — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
    await page.evaluate(() => window.__s2.freeze?.());
    await ctx.close();
  }
  // v634 뜻대로 굴리기 · 전투력 미리보기 — 844×390 · 667×375: 경지 심법 카드 → 뜻대로 창(줄 잠금 · 스탯 칩 · 등급 · 한도) → 멈출 때까지 → 이전 | 지금 · 전투력 · 되돌리기
  //   강호행 단계 줄 · 낀 장비 강화 창의 「부옵션」 단추 · 스탯 · 마스터리 · 무공 · 동료 자세히에 전투력 ▲▼ · 창이 화면 안 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'rl2')) {
    console.log('— v634 뜻대로 굴리기 · 전투력 미리보기');
    for (const [VW, VH] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(500);
      await page.evaluate(async () => { const g = window.__s2.g, GR = await import(new URL('js/s2/gear/gear.js', location.href).href); g.addExp(5e7); g.S.realm.lv = 30; Object.assign(g.S.wallet, { 'item:heart': 40, 'item:stone': 3000, gold: 1e9 });
        g.S.journey.opts.push([{ g: 1, k: 'hpP', v: 11 }, { g: 0, k: 'final3', v: 2 }]); g.S.journey.step = 1; g.S.journey.cleared = 1;
        const it = GR.makeGear(g.rng, 'ring', 4); while (it.subs.length < 3) it.subs.push({ k: 'crit', v: 9 }); g.S.gear.bag.push(it); GR.equip(g.S.gear, it.uid); g.dirtyStats = true; document.querySelector('#modal:not(.hidden) .btn')?.click(); });
      await page.evaluate(() => window.__s2.openKey('grow:3')); await page.waitForTimeout(300);
      const h0 = await page.evaluate(() => ({ n: document.querySelectorAll('#wb .rl2-card .rl2-ln').length, row: [...document.querySelectorAll('#wb .row .name')].some((n) => n.textContent === '뜻대로 굴리기') }));
      ok(h0.n === 3 && h0.row, `v634 ${VW} 경지 창 — 심법 3줄 · 「뜻대로 굴리기」 줄`, JSON.stringify(h0));
      await page.click('#wb .row:has-text("뜻대로 굴리기") .btn'); await page.waitForSelector('#modal:not(.hidden) .rl2');
      ok(await page.evaluate(() => document.querySelector('#modal .rl2-lb').disabled), `v634 ${VW} 빈 줄은 잠글 수 없다`);
      await page.click('#modal .btn:has-text("한 번")'); await page.waitForSelector('#modal:not(.hidden) .rl2-res'); await page.click('#modal .btn:has-text("또 굴리기")'); await page.waitForSelector('#modal:not(.hidden) .rl2-lb:not([disabled])');
      await page.click('#modal .rl2-lb >> nth=0'); await page.click('#modal .rl2-ch[data-k="bossDmg"]'); await page.click('#modal .rl2-seg[data-s="b"] button >> nth=2');
      const p1 = await page.evaluate(() => { const sh = document.querySelector('#modal .sheet'), r = sh.getBoundingClientRect(), g = window.__s2.g; return { lk: g.S.realm.heart.lock.join(), on: document.querySelector('#modal .rl2-ch.on')?.dataset.k, inV: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1, wide: sh.scrollWidth > sh.clientWidth + 1, btn: [...sh.querySelectorAll('.btn-row .btn')].map((x) => x.textContent).join('/') }; });
      ok(p1.lk === '0' && p1.on === 'bossDmg' && p1.inV && !p1.wide && p1.btn === '닫기/한 번/멈출 때까지 굴리기', `v634 ${VW} 뜻대로 창 — 줄 잠금 · 스탯 칩 · 창이 화면 안 · 옆으로 안 넘침`, JSON.stringify(p1));
      const l0 = await page.evaluate(() => JSON.stringify(window.__s2.g.S.realm.heart.lines[0]));
      await page.click('#modal .btn:has-text("멈출 때까지")'); await page.waitForSelector('#modal:not(.hidden) .rl2-res');
      const r1 = await page.evaluate(() => { const g = window.__s2.g, cols = [...document.querySelectorAll('#modal .rl2-col')]; return { head: document.querySelector('#modal .rl2-hd b')?.textContent, cols: cols.map((c) => c.querySelectorAll('.rl2-ln').length).join(), pw: document.querySelector('#modal .rl2-pw .rl2-pv')?.textContent, orb: g.S.wallet['item:heart'], l0: JSON.stringify(g.S.realm.heart.lines[0]), lines: JSON.stringify(g.S.realm.heart.lines) }; });
      ok(/찾았다|한도까지/.test(r1.head) && r1.cols === '3,3' && /[▲▼±]/.test(r1.pw) && r1.orb < 39 && r1.orb >= 9 && r1.l0 === l0, `v634 ${VW} 멈출 때까지 — 결과(이전 | 지금 · 전투력) · 구슬 한도 30 안 · 잠근 줄 그대로`, `${r1.head} · ${r1.pw} · 구슬 ${r1.orb}`);
      await page.click('#modal .btn:has-text("되돌리기")'); await page.waitForTimeout(200);
      const u1 = await page.evaluate(() => JSON.stringify(window.__s2.g.S.realm.heart.lines));
      ok(u1 !== r1.lines && JSON.parse(u1)[0] && JSON.stringify(JSON.parse(u1)[0]) === l0, `v634 ${VW} 되돌리기 — 이전 줄로`);
      await page.evaluate(() => window.__s2.openKey('grow:4')); await page.waitForTimeout(300);
      ok(await page.evaluate(() => document.querySelectorAll('#wb .rl2-jb').length === 1), `v634 ${VW} 강호행 — 연 단계의 옵션 줄 칸`);
      await page.evaluate(() => window.__s2.openKey('gear:0')); await page.waitForTimeout(300);
      await page.evaluate(() => [...document.querySelectorAll('#wb .eqcell')].find((c) => c.querySelector('.nm')?.textContent === '반지')?.click()); await page.waitForTimeout(300);
      const e1 = await page.evaluate(() => { const b2 = document.querySelector('#modal:not(.hidden) .rl2-eb'), r = b2?.getBoundingClientRect(), s = document.querySelector('#ep-s1')?.getBoundingClientRect(); return { has: !!b2, h: b2 ? b2.offsetHeight : 0, same: !!(b2 && b2.offsetTop === document.querySelector("#ep-s1")?.offsetTop) }; });
      ok(e1.has && e1.same && e1.h >= 40 && e1.h <= 70, `v634 ${VW} 낀 장비 강화 창 — 성혼 옆 「부옵션」 단추(한 줄)`, JSON.stringify(e1));
      if (e1.has) { await page.click('#modal .rl2-eb'); await page.waitForTimeout(200); ok(await page.evaluate(() => document.querySelectorAll('#modal .rl2-lb').length === 3), `v634 ${VW} 부옵션 뜻대로 창 — 3줄`); await page.click('#modal .btn:has-text("닫기")'); }
      const pv = {};
      for (const k of ['hero:0', 'hero:1', 'hero:2', 'hero:4']) { await page.evaluate((k2) => window.__s2.openKey(k2), k); await page.waitForTimeout(250); pv[k] = await page.evaluate(() => [...document.querySelectorAll('#wb .rl2-pvt')].filter((x) => /전투력|점|올리면|칸에/.test(x.textContent) && /[▲▼±]/.test(x.textContent)).length); }
      ok(pv['hero:0'] >= 4 && pv['hero:1'] >= 1 && pv['hero:2'] >= 1 && pv['hero:4'] >= 1, `v634 ${VW} 전투력 미리보기 — 스탯 · 무공 · 마스터리 · 무공 강화`, JSON.stringify(pv));
      await page.evaluate(() => { const g = window.__s2.g; g.S.wallet['ticket:pal'] = 30; g.pullCollect('pal', 30); window.__s2.openKey('grow:1'); });
      await page.waitForTimeout(250); await page.click('#wb .coll-tile:not(.no) >> nth=0'); await page.waitForTimeout(200);
      ok(await page.evaluate(() => /(빼면|끼면) [▲▼±]/.test(document.querySelector('#modal .rl2-cl')?.textContent || '')), `v634 ${VW} 동료 자세히 — 빼면 · 끼면 전투력`);
      ok(errs.length === 0, `v634 ${VW} 뜻대로 굴리기 — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v635 기질 — 병기 · 동료 · 영물 고유 기질(칸 · 자세히 · 장착 칸 줄) · 추천 자동 / 직접 고름 · 칸 고르기(끼면 전투력)
  if (!process.env.ONLY || process.env.ONLY.split(',').includes('trait')) {
    for (const [W, H] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); page.setDefaultTimeout(10000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(80); } };
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden)'); await page.click('#modal .btn >> nth=0');
      await page.waitForTimeout(700);
      if (await page.isVisible('#modal .btn:has-text("출석")')) { await page.click('#modal .btn:has-text("출석")'); await page.click('#att-ok'); }
      await page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 60; for (const s of ['weapon', 'pal', 'relic']) { g.S.wallet[`ticket:${s}`] = 300; g.pullCollect(s, 300); } g.dirtyStats = true; document.getElementById('modal').classList.add('hidden'); });
      await page.click('#mb .nb[data-tab="comp"]'); await page.click('#panel-body .subtabs button >> nth=1');
      const st = () => page.evaluate(() => { const P = window.__s2.g.S.colls.pal, wb = document.getElementById('wb'), tiles = [...wb.querySelectorAll('.coll-tile')];
        return { slots: wb.querySelectorAll('.tr-sl').length, on: wb.querySelector('.tr-mode button.on')?.textContent || '', man: !!P.man, eq: P.eq.slice(), tt: tiles.filter((t) => /[+−]\d+\.\d%$/.test(t.querySelector('.tr-t')?.textContent || '')).length, n: tiles.length,
          sl: [...wb.querySelectorAll('.tr-sl small')].map((x) => x.textContent), over: wb.scrollWidth - wb.clientWidth, txt: (/undefined|NaN|null|\[object Object\]/.exec(wb.textContent) || [''])[0] }; });
      const s0 = await until(st, (v) => v.slots === 5);
      ok(s0.slots === 5 && s0.on === '추천 자동' && !s0.man && s0.tt === s0.n && s0.n === 25 && s0.sl.every((x) => /[+−]\d+\.\d%$/.test(x)) && s0.over <= 1 && !s0.txt, `v635 기질 ${W} — 동료 칸 25개마다 기질 · 장착 칸 줄 5 · 추천 자동`, JSON.stringify({ ...s0, eq: undefined, sl: s0.sl.slice(0, 2) }));
      // 안 낀 것 자세히 → 기질 줄 · 끼기 → 칸 고르기(5칸 · 전투력) → 2번 칸
      const k = await page.evaluate(() => { const P = window.__s2.g.S.colls.pal; return Object.keys(P.own).map(Number).find((x) => !P.eq.includes(x)); });
      await page.click(`#wb .coll-tile >> nth=${k}`);
      const pp = await until(() => page.evaluate(() => { const sh = document.querySelector('#modal .sheet'); return { vis: !document.getElementById('modal').classList.contains('hidden'), tr: sh.querySelector('.cl-tr')?.textContent || '', nt: sh.querySelector('.cl-info .note')?.textContent || '', ef: sh.querySelectorAll('.cl-ef > div:not(.cl-h)').length, btns: [...sh.querySelectorAll('.btn-row .btn')].map((x) => x.textContent), sc: sh.scrollHeight - sh.clientHeight }; }), (v) => v.vis);
      ok(pp.vis && /^기질 · /.test(pp.tr) && /기질은 낄 때만/.test(pp.nt) && pp.ef === 2 && pp.btns.join() === '끼기,닫기' && pp.sc <= 1, `v635 기질 ${W} — 자세히: 기질 줄(지금 · Lv+1 · 각성+1) · 끼기 · 넘침 없음`, JSON.stringify(pp));
      await page.click('#modal .btn:has-text("끼기")');
      const pk = await until(() => page.evaluate(() => { const sh = document.querySelector('#modal .sheet'); return { n: sh.querySelectorAll('.tr-pk').length, pw: [...sh.querySelectorAll('.tr-pk b')].filter((b) => /^전투력 (그대로|[+−]\S+)$/.test(b.textContent)).length, sc: sh.scrollHeight - sh.clientHeight, h: sh.querySelector('h2')?.textContent || '' }; }), (v) => v.n === 5);
      ok(pk.n === 5 && pk.pw === 5 && pk.sc <= 1 && /어느 칸에\?$/.test(pk.h), `v635 기질 ${W} — 칸 고르기: 5칸 · 칸마다 바꾸면 전투력 · 넘침 없음`, JSON.stringify(pk));
      await page.click('#modal .tr-pk >> nth=1');
      const s1 = await until(st, (v) => v.man);
      ok(s1.man && s1.eq[1] === k && s1.on === '직접 고름' && !errs.length, `v635 기질 ${W} — 2번 칸에 낌 → 직접 고름`, JSON.stringify({ eq: s1.eq, k, on: s1.on }));
      await page.evaluate(() => { const g = window.__s2.g; g.S.wallet['ticket:pal'] = 30; g.pullCollect('pal', 30); });
      const s2 = await st(); ok(s2.eq[1] === k, `v635 기질 ${W} — 직접 고름이면 뽑아도 그대로`);
      await page.click('#wb .tr-mode button:text-is("추천 자동")');
      const s3 = await until(st, (v) => !v.man);
      ok(!s3.man && s3.on === '추천 자동' && s3.eq.every((x) => x != null), `v635 기질 ${W} — 추천 자동으로 되돌림`, JSON.stringify(s3.eq));
      if (W === 844) await page.screenshot({ path: path.join(OUT, 'v635-trait-844.png') });
      await page.click('#panel-body .subtabs button >> nth=0');
      const w0 = await until(() => page.evaluate(() => document.querySelectorAll('#wb .tr-sl').length), (v) => v === 1);
      ok(w0 === 1 && !errs.length, `v635 기질 ${W} — 병기 장착 칸 하나 · 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  }
  // v636 기세동 — 844×390 · 667×375: 수련동 카드 다섯(기세동 · 최고 기록 칩) · 입장 → 들판 기세 막대(단 · 피해 %) · 30초 → 두목 등장 · 막대에 별까지 남은 초 · 잡으면 결과 창 별 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'sg')) {
    console.log('— v636 기세동');
    for (const [VW, VH] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(500);
      await page.evaluate(() => { const g = window.__s2.g; g.addExp(5e7); g.S.surge = { best: 6400, star: 2 }; g.dirtyStats = true; document.querySelector('#modal:not(.hidden) .btn')?.click(); });
      await page.evaluate(() => window.__s2.openKey('content:0')); await page.waitForSelector('#wb .row.dg-card[data-k="surge"]');
      const c0 = await page.evaluate(() => { const cs = [...document.querySelectorAll('#wb .row.dg-card')], sc = document.querySelector('#wb .row.dg-card[data-k="surge"]'), gr = document.querySelector('#wb .dg-grid').getBoundingClientRect();
        const rs = cs.map((c) => c.getBoundingClientRect()); return { n: cs.length, name: sc.querySelector('.name').textContent, desc: sc.querySelector('.desc').textContent, chip: sc.querySelector('.dg-chips').textContent, best: sc.querySelector('.sg-best')?.textContent || '',
          row1: new Set(rs.map((r) => Math.round(r.top))).size === 1, inGrid: rs.every((r) => r.left >= gr.left - 1 && r.right <= gr.right + 1), chipFit: [...sc.querySelectorAll('.dg-chips span')].every((x) => x.getBoundingClientRect().right <= sc.getBoundingClientRect().right + 1), lock: sc.classList.contains('dg-lock') }; });
      ok(c0.n === 5 && c0.name === '기세동' && /기세 쌓고 두목 · 60초/.test(c0.desc) && /은자 ~.+구슬 ~2/.test(c0.chip) && c0.best === '★★☆ 6.4초' && c0.row1 && c0.inGrid && c0.chipFit && !c0.lock, `v636 ${VW} 수련동 카드 다섯 · 기세동(보상 · 최고 기록 칩) · 한 줄 · 칸 안`, JSON.stringify(c0));
      await page.screenshot({ path: path.join(OUT, `s2-sg-list-${VW}.png`) });
      await page.evaluate(() => { const g = window.__s2.g, f0 = g.fighter.bind(g); g.fighter = (bf) => { const f = f0(bf); return { ...f, st: { ...f.st, atk: f.st.atk * 30 } }; }; });   // 화면용 — 몹이 빨리 쓰러지게(기세가 쌓이는 모습)
      await page.click('#wb .row.dg-card[data-k="surge"] .btn:text-is("입장")');
      await page.waitForFunction(() => window.__s2.g.dg?.sg && document.querySelector('#contest-hud.sg'));
      await page.waitForFunction(() => window.__s2.g.dg?.sg.stack >= 8, null, { timeout: 20000 }).catch(() => {});
      const m0 = await page.evaluate(() => { const g = window.__s2.g, H = document.querySelector('#contest-hud').getBoundingClientRect(), row = document.querySelector('#sg-row'), r = row.getBoundingClientRect(), me = document.querySelector('#me').getBoundingClientRect();
        return { st: g.dg.sg.stack, n: document.querySelector('#sg-n').textContent, p: document.querySelector('#sg-p').textContent, w: parseFloat(document.querySelector('#sg-fill').style.width), vis: getComputedStyle(row).display === 'flex' && r.height > 4, inHud: r.top >= H.top && r.bottom <= H.bottom + 1, inV: H.left >= 0 && H.right <= innerWidth && H.bottom < innerHeight / 2, noMe: H.bottom <= me.top || H.left >= me.right || H.right <= me.left, sub: document.querySelector('#contest-sub').textContent }; });
      ok(m0.st >= 1 && m0.vis && m0.inHud && m0.inV && m0.noMe && /^기세 \d+\/50$/.test(m0.n) && /^피해 \+\d+(\.\d+)?% · 두목까지 \d+초$/.test(m0.p) && Math.abs(m0.w - (m0.st / 50) * 100) < 8 && /기세 쌓기 · \d+단/.test(m0.sub), `v636 ${VW} 들판 기세 막대 — 단 · 피해 % · 두목까지 · 화면 위 · 무인 칸과 안 겹침`, JSON.stringify(m0));
      await page.screenshot({ path: path.join(OUT, `s2-sg-run-${VW}.png`) });
      await page.evaluate(() => { const F = window.__s2.g.dg.F; F.t = Math.max(F.t, 29900); });   // 30초 가까이로 건너뜀
      await page.waitForFunction(() => window.__s2.g.dg?.sg.phase === 1, null, { timeout: 8000 });
      await page.waitForTimeout(250);
      const m1 = await page.evaluate(() => { const g = window.__s2.g, F = g.dg.F; return { mobs: F.mobs.map((m) => m.kind).join(), ban: document.querySelector('.cbban')?.textContent || '', p: document.querySelector('#sg-p').textContent, n: document.querySelector('#sg-n').textContent, sub: document.querySelector('#contest-sub').textContent }; });
      ok(m1.mobs === 'boss' && /두목 등장/.test(m1.ban) && /^기세 \d+단$/.test(m1.n) && /[★☆]{3}까지 \d+\.\d초|☆☆☆/.test(m1.p) && /두목 \d+% · \d+\.\d초/.test(m1.sub), `v636 ${VW} 30초 — 몹이 물러나고 두목 등장 · 막대에 별까지 남은 초`, JSON.stringify(m1));
      await page.screenshot({ path: path.join(OUT, `s2-sg-boss-${VW}.png`) });
      await page.evaluate(() => { const F = window.__s2.g.dg.F; for (const m of F.mobs) m.hp = 1; });
      await page.waitForSelector('#res.open', { timeout: 15000 });
      await page.waitForTimeout(900);
      const r1 = await page.evaluate(() => { const g = window.__s2.g, R = document.querySelector('#res'); return { win: R.classList.contains('win'), sg: R.querySelector('.sg-res')?.textContent || '', tiles: [...R.querySelectorAll('.rt small')].map((x) => x.textContent).join(), best: g.S.surge.best, star: g.lastDg.star, ms: g.lastDg.bossMs }; });
      ok(r1.win && /^[★☆]{3} 두목 \d+\.\d초 · 기세 \d+단/.test(r1.sg) && /은자/.test(r1.tiles) && /심법 구슬/.test(r1.tiles) && r1.star >= 1, `v636 ${VW} 결과 창 — 별 · 두목 시간 · 기세 · 은자 · 심법 구슬`, JSON.stringify(r1));
      await page.screenshot({ path: path.join(OUT, `s2-sg-res-${VW}.png`) });
      ok(errs.length === 0, `v636 ${VW} 기세동 — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v636 요괴록 — 844×390 · 667×375: 지도 창 셋째 칸 · 장 고르기(받을 별 점) · 여섯 칸(그림 · 처치 수 · 별) · 새기기 → 효과 · 모두 새기기 · 지도 단추 점 · 받을 보상 칸 · 옆으로 안 넘침 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'mx')) {
    console.log('— v636 요괴록');
    for (const [VW, VH] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(500);
      await page.evaluate(() => { const g = window.__s2.g, X = g.mxSt(); g.stage().top = 25; Object.assign(X.k, { 10: 1200, 11: 150, 14: 12, 20: 40 }); document.querySelector('#modal:not(.hidden) .btn')?.click(); });
      await page.waitForTimeout(1300);
      const d0 = await page.evaluate(() => ({ dot: !!document.querySelector('.nb[data-tab="map"].dot-on, #ptabs button[data-tab="map"].dot-on'), can: window.__s2.g.mxCan() }));
      ok(d0.dot && d0.can === 4, `v636 ${VW} 받을 별 — 지도 단추 점`, JSON.stringify(d0));
      await page.evaluate(() => window.__s2.openKey('mx:0')); await page.waitForTimeout(400);
      const s0 = await page.evaluate(() => { const pb = document.querySelector('#panel-body'), chs = [...document.querySelectorAll('.mx-ch')]; return { tab: document.querySelector('.subtabs button.on')?.textContent, chs: chs.length, open: chs.filter((c) => !c.disabled).length, dot: chs.filter((c) => c.classList.contains('dot-on')).map((c) => c.dataset.ch).join(), cells: document.querySelectorAll('.mx-c').length, pics: document.querySelectorAll('.mx-c .mx-art img, .mx-c .mx-art canvas').length, wide: pb.scrollWidth > pb.clientWidth + 1, all: !document.querySelector('.mx-all .btn').disabled }; });
      ok(s0.tab === '요괴록' && s0.chs === 15 && s0.open === 3 && s0.dot === '1' && s0.cells === 6 && s0.pics === 6 && !s0.wide && s0.all, `v636 ${VW} 요괴록 창 — 장 15(간 장 3 · 받을 별 점) · 여섯 칸 그림 · 옆으로 안 넘침`, JSON.stringify(s0));
      await page.click('.mx-ch[data-ch="1"]'); await page.waitForTimeout(250);
      const c1 = await page.evaluate(() => [...document.querySelectorAll('.mx-c')].map((c) => `${c.dataset.id}:${c.classList.contains('can') ? 'c' : '-'}:${c.querySelectorAll('.dex-st i.on').length}`).join());
      ok(c1 === '10:c:0,11:c:0,12:-:0,13:-:0,14:c:0,15:-:0', `v636 ${VW} 1장 — 닿은 칸만 새기기`, c1);
      const m0 = await page.evaluate(() => window.__s2.g.fighter().st.mobDmg || 0);
      await page.click('.mx-b[data-id="10"]'); await page.waitForTimeout(250);
      const r1 = await page.evaluate(() => ({ got: window.__s2.g.mxGotStars(), dm: window.__s2.g.fighter().st.mobDmg || 0, on: [...document.querySelectorAll('.mx-c[data-id="10"] .dex-st i.on')].length, btn: !!document.querySelector('.mx-b[data-id="10"]') }));
      ok(r1.got === 2 && r1.dm - m0 === 2 && r1.on === 2 && !r1.btn, `v636 ${VW} 새기기 — 별 2 · 일반 몹 피해 +0.2%`, JSON.stringify(r1));
      await page.click('.mx-all .btn'); await page.waitForTimeout(300);
      const r2 = await page.evaluate(() => ({ can: window.__s2.g.mxCan(), got: window.__s2.g.mxGotStars(), dis: document.querySelector('.mx-all .btn').disabled, dot: !!document.querySelector('.nb[data-tab="map"].dot-on, #ptabs button[data-tab="map"].dot-on') }));
      ok(r2.can === 0 && r2.got === 4 && r2.dis, `v636 ${VW} 모두 새기기 → 받을 별 0`, JSON.stringify(r2));
      ok(errs.length === 0, `v636 요괴록 ${VW} — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v635 guild — 문파 안 갈래(본당 · 연공실 · 품앗이 · 겨루기): 서버는 기억 속 문서로(net의 s2tx만 바꿈 — 바치기 · 요청 · 돕기 · 겨루기 셈은 진짜 net 코드) · 844×390 · 667×375
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'gd')) {
    console.log('— v635 guild');
    for (const [W, H] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); page.setDefaultTimeout(8000);
      const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(600);
      await page.evaluate(() => {
        const S = window.__s2, net = S.net, g = S.g, P = Object.getPrototypeOf(net), keep = ['gresGet', 'gresDonate', 'ghelpAsk', 'ghelpGive', 'gwarSet'];
        g.S.hero.lv = 47; g.S.wallet.gold = 5e7; g.S.nick = '나';
        for (const k of Object.getOwnPropertyNames(P)) { const d = Object.getOwnPropertyDescriptor(P, k); if (k !== 'constructor' && typeof d.value === 'function' && !keep.includes(k)) net[k] = async () => null; }
        net.status = 'online'; net.uid = 'me';
        const nowMs = Date.now(), wk = S.wkStr(nowMs), prevWk = S.wkStr(nowMs - 7 * 86400e3);
        const G = { id: 'K7Q2MX', name: '청운검문', owner: 'own1', memberIds: ['own1', 'me', 'u3'], members: { own1: '청운', me: '나', u3: '매화검' }, exp: 2340, checkins: {} };
        const store = window.__gdStore = {
          research: JSON.stringify({ lv: { gold: 2, exp: 1, idle: 1 }, pts: { gold: 3 }, run: { k: 'exp', endMs: nowMs + 7200e3 }, by: { own1: 14 }, names: { own1: '청운' } }),
          help: JSON.stringify({ helps: { realmq1: { owner: 'u3', timer: { endMs: nowMs + 5 * 3600e3, end0: nowMs + 5 * 3600e3 }, by: ['own1'], k: 'realm', name: '경지 대기', nick: '매화검', names: { own1: '청운' }, at: nowMs - 3600e3 } }, giveCount: {} }),
          war: JSON.stringify({ week: wk, n: 3, pts: { own1: 820 }, names: { own1: '청운' }, last: { week: prevWk, us: 3120, them: 2480, name: '흑풍채', res: 'win', pts: { own1: 1200, me: 640 }, names: {} }, rec: { w: 3, d: 1, l: 2, pts: 10 } }),
        };
        net.s2tx = async (gid, k, fn) => { const D0 = store[k] ? JSON.parse(store[k]) : null, r = fn(D0); if (r.write) store[k] = JSON.stringify(r.doc); return r; };
        net.ghelpGet = async () => JSON.parse(store.help);
        net.fs = { updateDoc: async () => {}, doc: () => ({}), increment: (n) => n };
        net.top = async () => ({ rows: [], me: 0 }); net.guildTop = async () => ({ rows: [], me: 0 }); net.wbTotal = async () => ({}); net.worldChatWatch = () => () => {};
        net.guildGet = async () => G; net.guildInfoGet = async () => ({}); net.guildList = async () => [];
        net.graidGet = async () => ({ week: wk, lv: 40, dmg: {}, names: {} }); net.gtrainGet = net.gtrainSet = async () => ({ week: wk, pts: {}, names: {} });
        net.guildProfiles = async (L) => L.map((id) => ({ uid: id })); net.guildChatGet = async () => []; net.guildChatWatch = () => () => {};
        g.S.wallet['ticket:exped'] = 2; g.startExped(12);
        g.setGuild(G.id); S.guildState.at = 0; S.guildLoad(true);
      });
      await page.waitForFunction(() => !!window.__s2.guildState.war && !window.__s2.guildState.busy);
      await page.click('.nb[data-tab="social"]'); await page.click('#panel-body .subtabs button:text-is("문파")'); await page.waitForSelector('#wb .gd-seg');
      const view = () => page.evaluate(() => { const pb = document.getElementById('panel-body'); return { wide: pb.scrollWidth > pb.clientWidth + 1, txt: (/undefined|NaN|null|\[object Object\]/.exec(document.getElementById('wb').textContent) || [''])[0] }; });
      const h0 = await page.evaluate(() => ({ seg: [...document.querySelectorAll('#wb .gd-seg button')].map((x) => x.textContent).join(), on: document.querySelector('#wb .gd-seg button.on')?.dataset.gd, raid: !!document.querySelector('#wb .gd-raid'), chat: !!document.querySelector('#gchat'), dots: [...document.querySelectorAll('#wb .gd-seg button.dot-on')].map((x) => x.dataset.gd).join(), lv: window.__s2.g.gresOn(), seg44: Math.min(...[...document.querySelectorAll('#wb .gd-seg button')].map((x) => x.getBoundingClientRect().height)) }));
      const v0 = await view();
      ok(h0.seg === '본당,연공실,품앗이,겨루기' && h0.on === 'home' && h0.raid && h0.chat && h0.dots === 'help,war' && h0.seg44 >= 34 && !v0.wide && !v0.txt, `v635 guild ${W} — 갈래 넷 · 본당은 전 화면 그대로 · 품앗이 · 겨루기에 빨간 점`, JSON.stringify(h0));
      ok(h0.lv.gold === 2 && h0.lv.exp === 1 && h0.lv.idle === 1, `v635 guild ${W} — 서버 연구 레벨이 내 몸에 붙음`, JSON.stringify(h0.lv));
      // 연공실 — 넷 · 지금 붙는 것 · 바치기(은자 · 서버 막대 +1 · 오늘 2번 남음)
      await page.click('#wb .gd-seg button[data-gd="res"]'); await page.waitForSelector('#wb .gd-rs');
      const r0 = await page.evaluate(() => ({ n: document.querySelectorAll('#wb .gd-rs').length, on: [...document.querySelectorAll('#wb .gd-rs-on span')].map((x) => x.textContent).join('|'), run: document.querySelector('#wb .gd-rs-run b')?.textContent, gold: window.__s2.g.S.wallet.gold, cost: window.__s2.g.gresCost() }));
      await page.click('#wb .gd-rs >> nth=0 >> .btn'); await page.waitForFunction(() => !window.__s2.guildState.gdBusy);
      const r1 = await page.evaluate(() => ({ gold: window.__s2.g.S.wallet.gold, pts: JSON.parse(window.__gdStore.research).pts.gold, by: JSON.parse(window.__gdStore.research).by.me, left: window.__s2.g.gresLeft(), bar: document.querySelector('#wb .gd-rs .gd-rs-bar span')?.textContent }));
      const v1 = await view();
      ok(r0.n === 4 && r0.on === '은자+2%|경험치+1%|공격+0%|방치 보상+1%' && /깨달음 비결 Lv 2 연구 중/.test(r0.run) && !v1.wide && !v1.txt, `v635 guild ${W} — 연공실 넷 · 지금 붙는 것 · 연구 중`, `${r0.on} · ${r0.run}`);
      ok(r0.gold - r1.gold <= r0.cost && r0.gold - r1.gold > r0.cost * 0.8 && r1.pts === 4 && r1.by === 1 && r1.left === 2 && /막대 4 \/ 11/.test(r1.bar), `v635 guild ${W} — 바치기: 은자 · 서버 막대 +1 · 오늘 2번 남음`, JSON.stringify(r1));
      // 품앗이 — 문파원 돕기(서버 횟수 · 은자) · 내 원정 도움 요청
      await page.click('#wb .gd-seg button[data-gd="help"]'); await page.waitForSelector('#wb .gd-hp-oth');
      const p0 = await page.evaluate(() => ({ oth: document.querySelectorAll('#wb .gd-hp-oth .row').length, mine: [...document.querySelectorAll('#wb .gd-hp-mine .row .name')].map((x) => x.textContent).join(), gold: window.__s2.g.S.wallet.gold }));
      await page.click('#wb .gd-hp-oth .row >> nth=0 >> .btn'); await page.waitForFunction(() => !window.__s2.guildState.gdBusy);
      await page.click('#wb .gd-hp-mine .row >> nth=0 >> .btn'); await page.waitForFunction(() => !window.__s2.guildState.gdBusy);
      const p1 = await page.evaluate(() => { const Hd = JSON.parse(window.__gdStore.help), mine = Object.values(Hd.helps).find((h) => h.owner === 'me'); return { helped: Hd.helps.realmq1.by.includes('me'), cnt: Object.values(Hd.giveCount).join(), give: window.__s2.g.helpGiveLeft(), gold: window.__s2.g.S.wallet.gold, mine: mine?.k, req: window.__s2.g.helpReq()?.k, on: !!document.querySelector('#wb .row.gd-hp-on'), btn: document.querySelector('#wb .gd-hp-oth .row .btn')?.disabled }; });
      const v2 = await view();
      ok(p0.oth === 1 && /원정/.test(p0.mine) && p1.helped && p1.cnt === '1' && p1.give === 9 && p1.gold > p0.gold && p1.btn && !v2.wide && !v2.txt, `v635 guild ${W} — 품앗이 돕기: 서버에 한 번 · 하루 9번 남음 · 은자 · 다시는 못 누름`, JSON.stringify(p1));
      ok(p1.mine === 'exped' && p1.req === 'exped' && p1.on, `v635 guild ${W} — 품앗이 요청: 내 원정이 서버에 올라가고 「요청 중」`, JSON.stringify({ mine: p1.mine, req: p1.req }));
      // 문파원이 도와줬다 → 다시 불러오면 내 원정이 당겨진다
      const c0 = await page.evaluate(async () => { const S = window.__s2, Hd = JSON.parse(window.__gdStore.help), q = S.g.helpReq(), h = Hd.helps[q.id]; h.by.push('own1'); h.timer.endMs -= 432000; window.__gdStore.help = JSON.stringify(Hd); const e0 = S.g.S.exped.run.endMs; S.guildState.at = 0; S.guildLoad(true); return e0; });
      await page.waitForFunction(() => !window.__s2.guildState.busy && window.__s2.g.helpReq()?.cut > 0);
      const c1 = await page.evaluate(() => ({ end: window.__s2.g.S.exped.run.endMs, cut: window.__s2.g.helpReq().cut }));
      ok(c1.cut === 432000 && c1.end === c0 - 432000, `v635 guild ${W} — 문파원 도움이 내 원정에 들어감(7분 12초)`, JSON.stringify({ cut: c1.cut, d: c0 - c1.end }));
      // 겨루기 — 맞섬 · 점수 얻는 법 · 지난주 이김 받기(뽑기권 4 · 한 번)
      await page.click('#wb .gd-seg button[data-gd="war"]'); await page.waitForSelector('#wb .gd-vs');
      const w0 = await page.evaluate(() => ({ us: document.querySelector('#wb .gd-vs-s.us em')?.textContent, them: document.querySelector('#wb .gd-vs-s.them b')?.textContent, ways: document.querySelectorAll('#wb .gd-war-ways > div').length, last: document.querySelector('#wb .gd-war-last .row .name')?.textContent, tix: window.__s2.g.S.wallet['ticket:gear'] || 0 }));
      await page.click('#wb .gd-war-last .row .btn'); await page.waitForTimeout(250);
      const w1 = await page.evaluate(() => ({ tix: window.__s2.g.S.wallet['ticket:gear'] || 0, dis: document.querySelector('#wb .gd-war-last .row .btn')?.disabled, dot: !!document.querySelector('#wb .gd-seg button[data-gd="war"].dot-on') }));
      const v3 = await view();
      ok(Number(w0.us) >= 820 && w0.them && w0.ways === 4 && /이김/.test(w0.last) && w1.tix === w0.tix + 4 && w1.dis && !w1.dot && !v3.wide && !v3.txt, `v635 guild ${W} — 겨루기: 맞섬 · 얻는 법 넷 · 지난주 이김 → 뽑기권 4 한 번`, JSON.stringify({ ...w0, tix: w1.tix - w0.tix }));
      ok(errs.length === 0, `v635 guild ${W} — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  // v636 강호 축제 — 844×390 · 667×375: 들판 축제 칩(오른쪽 위 메뉴 아래 · 안 겹침 · 받을 것 빨간 점) → 임무 창 「축제」 칸(두목 · 임무 · 교환소 · 달력)
  //   임무 받기 · 교환 · 축제 두목(하루 한 번 · 결과 창) · 업적 알림이 칩과 겹치지 않음 · 콘솔 오류 0
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'ev')) {
    console.log('— v636 강호 축제');
    for (const [VW, VH] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(400);
      await page.evaluate(() => { document.querySelector('#modal:not(.hidden) .btn')?.click(); });
      await page.waitForSelector('#ev:not(.hidden)');
      const until = async (fn, pred, ms = 5000) => { const t = Date.now(); for (;;) { const v = await fn(); if (pred(v) || Date.now() - t > ms) return v; await page.waitForTimeout(100); } };
      const rect = (s) => page.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => e.offsetParent && !e.classList.contains('hidden')).map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }), s);
      const ov = (a, b2) => Math.max(0, Math.min(a[2], b2[2]) - Math.max(a[0], b2[0])) * Math.max(0, Math.min(a[3], b2[3]) - Math.max(a[1], b2[1]));
      const I0 = await page.evaluate(() => { const I = window.__s2.g.festInfo(); return { on: I.on, name: I.fest.name, short: I.fest.short, nshort: I.next.short }; });
      const ev = (await rect('#ev'))[0], others = [];
      for (const s of ['#tr', '#tc', '#tl', '#qc', '#nx', '#fc', '#rc', '#bf', '#btn-boss', '#sk']) for (const r of await rect(s)) others.push([s, r]);
      const hit = others.filter(([, r]) => ov(ev, r) > 0).map(([s]) => s), txt = await page.textContent('#ev');
      ok(ev && ev[0] >= 0 && ev[1] >= 0 && ev[2] <= VW && ev[3] <= VH && !hit.length && ev[1] >= (await rect('#tr'))[0][3] && ev[2] >= VW - 20, `v636 ${VW} 들판 축제 칩 — 오른쪽 위 메뉴 바로 아래 · 아무것과도 안 겹침`, JSON.stringify({ ev: ev.map(Math.round), hit }));
      ok(new RegExp(`${I0.on ? I0.short : I0.nshort} \\d+(일|시간|분)${I0.on ? '' : ' 뒤'}`).test(txt), `v636 ${VW} 칩 — 축제 이름 · 남은 때`, txt);
      // 받을 것 → 빨간 점 · 업적 알림은 칩 아래
      await page.evaluate(() => { const g = window.__s2.g; g.festBk().fd.on('kill', { n: 300 }); g.festSt().fc = 400; g.feed.push({ k: 'ach', id: [...g.books.ach.defs.keys()][0] }); });
      const dot = await until(() => page.evaluate(() => document.querySelector('#ev').classList.contains('dot')), (v) => v, 2500);
      const ap = await until(() => rect('.achpop'), (v) => v.length > 0, 2500);
      ok(!I0.on || dot, `v636 ${VW} 받을 축제 임무 → 칩에 빨간 점`);
      ok(!ap.length || ov(ap[0], (await rect('#ev'))[0]) === 0, `v636 ${VW} 업적 알림이 축제 칩과 안 겹침`, JSON.stringify(ap[0]?.map(Math.round)));
      // 칩 → 임무 창 「축제」 칸
      await page.waitForTimeout(2600);
      await page.click('#ev'); await page.waitForSelector('#panel.open');
      const P = await page.evaluate(() => { const wb = document.querySelector('#wb'), hs = [...wb.querySelectorAll('.card h3')].map((h) => h.firstChild.textContent.trim());
        return { sub: document.querySelector('#panel-body .subtabs button.on')?.textContent, hs, rows: wb.querySelectorAll('.ms-row').length, cal: wb.querySelectorAll('.ev-cal > div').length, bad: (/undefined|NaN|null|\[object Object\]/.exec(wb.textContent) || [''])[0], over: wb.scrollWidth - wb.clientWidth }; });
      ok(P.sub === '축제' && P.hs.includes('축제 두목') && P.hs.includes('축제 임무') && P.hs.includes('축제 교환소') && P.hs.includes('축제 달력') && P.rows === 10 && P.cal === 4 && !P.bad && P.over <= 1, `v636 ${VW} 축제 칸 — 두목 · 임무 10줄 · 교환소 · 달력 넷 · 이상한 글자 · 넘침 없음`, JSON.stringify(P));
      if (I0.on) {
        const f0 = await page.evaluate(() => window.__s2.g.festSt().fc);
        await page.click('#wb .ms-row.can .btn'); await page.waitForTimeout(200);
        const f1 = await page.evaluate(() => ({ fc: window.__s2.g.festSt().fc, can: window.__s2.g.festCan() }));
        ok(f1.fc > f0 && f1.can === 0, `v636 ${VW} 축제 임무 받기 → 축제 물건`, `${f0} → ${f1.fc}`);
        const t0 = await page.evaluate(() => window.__s2.g.S.wallet['ticket:gear'] || 0);
        await page.click('#wb .row:has-text("장비 뽑기권") .btn:text-is("바꾸기")'); await page.waitForTimeout(200);
        const t1 = await page.evaluate(() => ({ t: window.__s2.g.S.wallet['ticket:gear'] || 0, fc: window.__s2.g.festSt().fc }));
        ok(t1.t === t0 + 1 && t1.fc < f1.fc, `v636 ${VW} 교환소 — 장비 뽑기권 1장`, `${t0} → ${t1.t} · ${f1.fc} → ${t1.fc}`);
        await page.click('#wb .row:has-text("오늘 도전할 수 있어요") .btn:text-is("도전")');
        const d1 = await until(() => page.evaluate(() => ({ dg: window.__s2.g.dg?.type || '', ch: !document.querySelector('#contest-hud').classList.contains('hidden'), chip: getComputedStyle(document.querySelector('#ev')).display })), (v) => v.ch, 3000);
        ok(d1.dg === 'fest' && d1.ch && d1.chip === 'none', `v636 ${VW} 축제 두목 — 들어감 · 두목 막대 · 칩은 숨김`, JSON.stringify(d1));
        await page.evaluate(() => { const g = window.__s2.g; for (let i = 0; i < 200 && g.dg; i++) g.hunt(1000); });
        await page.waitForSelector('#res.open', { timeout: 5000 });
        const r1 = await page.evaluate(() => { const R = document.querySelector('#res .rp').getBoundingClientRect(), b2 = document.querySelector('#rout').getBoundingClientRect(); return { t: document.querySelector('#res .rtitle')?.textContent, gr: document.querySelector('#res .ev-grade')?.textContent, inV: R.top >= 0 && R.bottom <= innerHeight + 1 && b2.bottom <= innerHeight, why: window.__s2.g.canDungeon('fest') }; });
        ok(r1.t === 'FESTIVAL BOSS' && /^(C|B|A|S|SS)$/.test(r1.gr) && r1.inV && r1.why === '오늘은 다 했어요', `v636 ${VW} 축제 두목 결과 창 — 등급 · 화면 안 · 오늘은 끝`, JSON.stringify(r1));
        await page.click('#rout'); await page.waitForTimeout(300);
      }
      ok(errs.length === 0, `v636 ${VW} 강호 축제 — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  if (!process.env.ONLY || process.env.ONLY.split(',').some((x) => x === '844' || x === 'rd2')) {
    console.log('— v636 점 셋 · 방치 쌓임');
    for (const [VW, VH] of [[844, 390], [667, 375]]) {
      const ctx = await b.newContext({ viewport: { width: VW, height: VH }, serviceWorkers: 'block' });
      await ctx.route(/gstatic\.com\/firebasejs/, (r) => r.abort());
      const page = await ctx.newPage(); const errs = [];
      page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#modal:not(.hidden) .jobcard'); await page.click('#modal .jobcard[data-job="sword"]');
      await page.waitForSelector('#modal', { state: 'hidden' }); await page.waitForTimeout(500);
      const dot = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? (e.classList.contains('dot-on') ? e.dataset.dot || 'red?' : '') : 'none'; }, sel);
      // 점 셋 — 출석(받을 것) 빨강 · 뽑기권 10장(할 수 있는 것) 금빛 · 새로 낀 장비(새 것) 파랑
      await page.evaluate(() => { const g = window.__s2.g; g.S.wallet['ticket:gear'] = 30; g.S.gearNew = { ring: { g: 2, up: 0, fg: -1, fup: 0, dp: 5 } }; g.S.wallet['ticket:exped'] = 0; window.__s2.navDots(); });
      const d0 = { town: await dot('.nb[data-tab="town"]'), bag: await dot('.nb[data-tab="bag"]'), comp: await dot('.nb[data-tab="comp"]') };
      ok(d0.town === 'red' && d0.bag === 'gold' && d0.comp === '', `v636 ${VW} 창 단추 점 — 임무 빨강(출석) · 장비 금빛(금빛 > 파랑) · 동료 없음`, JSON.stringify(d0));
      await page.evaluate(() => { window.__s2.g.S.wallet['ticket:gear'] = 3; window.__s2.navDots(); });
      ok(await dot('.nb[data-tab="bag"]') === 'new', `v636 ${VW} 뽑기권이 적으면 → 장비는 파랑(새로 낀 장비)`);
      await page.evaluate(() => { window.__s2.g.S.wallet['ticket:gear'] = 30; window.__s2.navDots(); });
      await page.evaluate(() => { window.__s2.g.S.gearNew = { ring: { g: 2, up: 0, fg: -1, fup: 0, dp: 5 } }; window.__s2.openKey('gear:1'); }); await page.waitForTimeout(250);
      const s1 = await page.evaluate(() => [...document.querySelectorAll('#panel-body .subtabs button')].map((x) => `${x.textContent}:${x.classList.contains('dot-on') ? x.dataset.dot : ''}`).join(','));
      ok(/장착:new/.test(s1) && /뽑기:,/.test(s1), `v636 ${VW} 칸 점 — 장착 파랑(새로 낀 장비) · 지금 보는 뽑기 칸 금빛은 꺼짐`, s1);
      ok(await page.evaluate(() => document.querySelector('#ptabs button[data-tab="bag"]').dataset.dot) === 'new', `v636 ${VW} 창 왼쪽 줄 — 장비는 남은 파랑`);
      await page.evaluate(() => window.__s2.openKey('gear:0')); await page.waitForTimeout(300);
      ok(await dot('#ptabs button[data-tab="bag"]') === '' && await dot('.nb[data-tab="bag"]') === '', `v636 ${VW} 장착 칸을 보면 파랑도 꺼짐 → 장비 점 없음`);
      await page.evaluate(() => window.__s2.openKey('attend:0')); await page.waitForTimeout(250);
      const s2 = await page.evaluate(() => { const b2 = [...document.querySelectorAll('#panel-body .subtabs button')].find((x) => x.textContent === '출석'), r = b2.getBoundingClientRect(), a = getComputedStyle(b2, '::after'); return { dot: b2.dataset.dot, on: b2.classList.contains('dot-on'), bg: a.backgroundColor, w: a.width, tip: b2.title }; });
      ok(s2.on && s2.dot === 'red' && s2.bg === 'rgb(239, 68, 68)' && s2.w === '7px' && /받을/.test(s2.tip), `v636 ${VW} 출석 칸 빨강(보고 있어도 받을 때까지)`, JSON.stringify(s2));
      const gc = await page.evaluate(() => { const nb = document.querySelector('.nb[data-tab="char"]'); nb.dataset.dot = 'gold'; nb.classList.add('dot-on'); const c = getComputedStyle(nb, '::after').backgroundColor; nb.dataset.dot = 'new'; const n = getComputedStyle(nb, '::after'); const r = [c, n.backgroundColor, n.width]; window.__s2.navDots(); return r; });
      ok(gc[0] === 'rgb(245, 197, 66)' && gc[1] === 'rgb(96, 165, 250)' && gc[2] === '6px', `v636 ${VW} 빛깔 — 금빛 · 파랑(작게)`, gc.join(' / '));
      await page.click('#panel-close'); await page.waitForTimeout(300);
      // 방치 쌓임 칩 — 원정권 없음: 자리 비움 최대 12시간 / 보낼 수 있음: 금빛 / 가는 중: 남은 시간 / 도착: 빨강 · 누르면 받기
      const hud = () => page.evaluate(() => { const e = document.querySelector('#idl'), r = e.getBoundingClientRect(), R = (s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect());
        const hit = (a, c) => a.width && c.width && a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
        const others = ['#tr .ib', '#sp', '#chap-row', '#fc', '#rc', '#bf', '#qc', '#nx', '#tl', '#me', '#lvb', '#btn-boss'].flatMap((s) => R(s).map((x) => [s, x]));
        const bb = document.getElementById('btn-boss'), bh = bb.classList.contains('hidden'); bb.classList.remove('hidden');   // 두목 도전 단추가 떠 있을 때도(넓은 화면은 진행 줄 바로 아래)
        const r2 = e.getBoundingClientRect(), b2 = bb.getBoundingClientRect(), bossHit = hit(r2, b2); bb.classList.toggle('hidden', bh);
        return { vis: !!e.offsetParent, t: e.textContent, cls: e.className, over: [...others.filter(([, x]) => hit(r, x)).map(([s]) => s), ...(bossHit ? ['#btn-boss(보임)'] : [])], inV: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r2.bottom <= innerHeight, h: r.height }; });
      await page.evaluate(() => window.__s2.paintIdl(true));
      const h0 = await hud();
      ok(h0.vis && /^休방치 최대 12시간$/.test(h0.t) && !h0.over.length && h0.inV, `v636 ${VW} 방치 칩 — 진행 줄 아래 · 겹침 없음 · 자리 비움 최대 12시간`, JSON.stringify(h0));
      await page.evaluate(() => { window.__s2.g.S.wallet['ticket:exped'] = 1; window.__s2.paintIdl(true); });
      const h1 = await hud(); ok(/can/.test(h1.cls) && /원정 보내기/.test(h1.t) && !h1.over.length, `v636 ${VW} 원정권 있음 → 금빛 「원정 보내기」`, JSON.stringify(h1));
      await page.click('#idl'); await page.waitForSelector('#modal:not(.hidden) .idl-l');
      const p0 = await page.evaluate(() => ({ rows: document.querySelectorAll('#modal .idl-r').length, txt: document.querySelector('#modal .idl-l').textContent, btn: [...document.querySelectorAll('#modal .btn-row .btn')].map((x) => x.textContent).join('/') }));
      ok(p0.rows === 2 && /최대 12시간/.test(p0.txt) && /이번 주 남은 84시간/.test(p0.txt) && p0.btn === '닫기/원정 창/12시간 보내기', `v636 ${VW} 누르면 설명 창 — 원정 · 자리 비움 · 보내기`, JSON.stringify(p0));
      await page.click('#modal .btn:has-text("12시간 보내기")'); await page.waitForTimeout(300);
      const h2 = await hud(); const run = await page.evaluate(() => window.__s2.g.S.exped.run?.hours);
      ok(run === 12 && /^征원정 1[12]:\d\d$/.test(h2.t) && !/can|red/.test(h2.cls) && !h2.over.length, `v636 ${VW} 보내면 「원정 남은 시간」`, `${run} ${JSON.stringify(h2)}`);
      await page.evaluate(() => { const g = window.__s2.g; g.S.exped.run.endMs = g.now - 1000; window.__s2.paintIdl(true); window.__s2.navDots(); });
      const h3 = await hud(); ok(/red/.test(h3.cls) && /원정 도착/.test(h3.t) && await dot('.nb[data-tab="dgn"]') === 'red' && !h3.over.length, `v636 ${VW} 도착 → 칩 빨강 · 던전 단추 빨강`, JSON.stringify(h3));
      await page.screenshot({ path: path.join(OUT, `s2-rd2-${VW}.png`) });
      const g0 = await page.evaluate(() => window.__s2.g.S.wallet.gold);
      await page.click('#idl'); await page.waitForTimeout(300);
      const c1 = await page.evaluate(() => ({ run: window.__s2.g.S.exped.run, gold: window.__s2.g.S.wallet.gold, toast: document.getElementById('toast')?.textContent || '', modal: !document.getElementById('modal').classList.contains('hidden') }));
      ok(c1.run === null && c1.gold > g0 && /원정 도착/.test(c1.toast) && !c1.modal, `v636 ${VW} 빨강 칩을 누르면 바로 받기`, JSON.stringify(c1));
      await page.evaluate(() => { window.__s2.g.bossFight = window.__s2.g.bossFight; });
      ok(errs.length === 0, `v636 ${VW} 점 셋 · 방치 쌓임 — 콘솔 오류 없음`, errs.slice(0, 3).join(' | '));
      await page.evaluate(() => window.__s2.freeze?.());
      await ctx.close();
    }
  }
  await b.close();
  console.log(fails ? `\n✗ ${fails}건` : '\n✓ 새 시즌 화면 전부 통과');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
