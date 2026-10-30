// 브라우저 종단 테스트 — 바람식 개편 (Playwright + 선택: Firebase 에뮬레이터)
//   1) 정적 서버:   npx http-server -p 8123 -s -c-1 .
//   2) (선택) 에뮬레이터: firebase emulators:start --only auth,firestore,database --project idle-69772
//   3) 실행: PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=/opt/pw-browsers/chromium node tests/e2e.cjs
//      온라인까지: FIREBASE_PKG=/path/to/node_modules/firebase 를 더한다
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const PKG = process.env.FIREBASE_PKG;
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('  ✓', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });
const G = (page, fn, arg) => page.evaluate(fn, arg);

async function newPlayer(browser, name, cls = '검사') {
  // 서비스 워커는 막는다 — 처음 들어오면 새로 고침이 나서 단계가 가끔 떨어졌다
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  const NOISE = /Failed to load resource|ERR_FAILED|Could not reach Cloud Firestore backend/;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    if (!PKG) return route.abort();
    const file = path.join(PKG, path.basename(new URL(route.request().url()).pathname));
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + (PKG ? '?emu=1' : ''), { waitUntil: 'domcontentloaded' });
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  await page.waitForSelector('.class-card');
  await page.click(`.class-card:has-text("${cls}")`);
  return { ctx, page, errors, name };
}
// 'map/king'처럼 창/칸 (v147 — 창마다 칸이 나뉘었다)
async function tab(page, name) {
  const [t, sub] = name.split('/');
  if (await page.isVisible('#panel-close')) { await page.click('#panel-close'); await sleep(250); }
  await page.click(`#tabs button[data-tab="${t}"]`);
  await sleep(300);
  if (sub) { await page.click(`#panel .subtabs button[data-key="${sub}"]`); await sleep(250); }
}

(async () => {
  if (PKG) {
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/idle-69772/databases/(default)/documents', { method: 'DELETE' });
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/idle-69772/accounts', { method: 'DELETE' });
  }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const a = await newPlayer(browser, '철수');
  const p = a.page;

  console.log('# 시작');
  await sleep(600);
  const s0 = await G(p, () => ({ job: window.__game.s.job, map: window.__game.s.map, npc: window.__game.mons.filter((m) => m.npc).length, pot: window.__game.s.potions }));
  assert(s0.job === 'sword' && s0.map === 0 && s0.npc === 4, '검사로 마을에서 시작 · 마을 사람 넷');
  assert(s0.pot >= 20, `시작 물약 ${s0.pot}개`);
  await shot(p, '01-town.png');

  console.log('# 사냥터');
  await tab(p, 'map/murim');
  assert(await p.locator('#panel .zone-card:has-text("죽림") .area-btn').count() === 4, '지역 카드에 구역 1·2·3·두목');
  // v146: 레벨과 상관없이 들어간다 — 센 곳은 잠그지 않고 '위험'을 붙인다
  const far = p.locator('#panel .zone-card .area-btn.danger').first();
  assert(await far.count() === 1 && !(await far.isDisabled()), '레벨이 모자란 곳도 열려 있고 위험 표시가 붙는다');
  await p.locator('#panel .zone-card:has-text("죽림") .area-btn:has-text("1")').click();
  await sleep(300);
  assert(await G(p, () => window.__game.s.map) === 11, '지도에서 죽림 1구역으로');
  await p.waitForFunction(() => window.__game.s.kills > 0, null, { timeout: 20000 });
  const s1 = await G(p, () => ({ kills: window.__game.s.kills, gold: window.__game.s.gold, mons: window.__game.mons.length }));
  assert(s1.kills > 0 && s1.gold > 0, `자동 사냥: 처치 ${s1.kills}, 은자 ${s1.gold}`);
  assert(s1.mons >= 15, `몹이 깔려 있다 (${s1.mons})`);
  await shot(p, '02-hunt.png');

  console.log('# 들판을 눌러 움직이기');
  const before = await G(p, () => ({ x: window.__game.heroX, y: window.__game.heroY }));
  // 막히지 않은 빈 칸(무인에게서 세 칸 이상)을 골라 그 자리를 누른다 — v127 지형 때문에 정해진 점은 바위일 수 있다
  const spot = await G(p, () => {
    const g = window.__game, v = window.__view, z = v.zoom || 1, rc = document.getElementById('cv').getBoundingClientRect();
    for (let d = 3; d < 8; d++) for (const [dc, dr] of [[-d, 0], [0, -d], [d, 0], [0, d], [-d, -d], [d, -d]]) {
      const c = g.hc + dc, r = g.hr + dr;
      if (!g.inMap(c, r) || g.occupied(c, r, 'hero')) continue;
      const x = rc.left + v.sx({ x: (c + 0.5) * g.tile }) * z, y = rc.top + v.sy({ y: (r + 0.5) * g.tile }) * z;
      if (x > 20 && x < rc.right - 20 && y > rc.top + 80 && y < rc.bottom - 200) return { x, y };
    }
    return { x: 60, y: 420 };
  });
  await p.mouse.click(spot.x, spot.y);
  // 지형(v127) 때문에 돌아가는 길이 길 수 있다 — 3초까지 기다린다
  await p.waitForFunction((b) => Math.hypot(window.__game.heroX - b.x, window.__game.heroY - b.y) > 30, before, { timeout: 3000 }).catch(() => {});
  const after = await G(p, () => ({ x: window.__game.heroX, y: window.__game.heroY }));
  assert(Math.hypot(after.x - before.x, after.y - before.y) > 30, '누른 쪽으로 걸어간다');

  console.log('# 스탯');
  await G(p, () => { const g = window.__game; g.s.autoStat = false; g.s.statPts = 6; });
  await p.waitForSelector('#advice:not(.hidden)');
  assert((await p.textContent('#advice')).includes('스탯 6'), '남은 레벨업 점수가 들판 위에 보인다');
  await p.click('#advice');
  await p.waitForSelector('#panel .row:has-text("힘")');
  const str0 = await G(p, () => window.__game.s.stats.str);
  await p.locator('#panel .row:has-text("힘") button.buy').click();
  assert(await G(p, () => window.__game.s.stats.str) === str0 + 1, '힘 +1');
  await shot(p, '03-char.png');

  console.log('# 성장 장비 · 등급 각인 (v158)');
  await G(p, () => { const g = window.__game; g.s.gold = 1e6; g.s.mats = { 1: 500, b1: 30 }; g.rng = () => 0; });
  assert(await G(p, () => ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc'].every((k) => window.__game.s.equip[k]?.grow)), '여섯 칸 성장 장비를 끼고 시작한다');
  await tab(p, 'bag');
  await p.click('#panel .subtabs button[data-key="smith"]');
  await p.waitForSelector('#panel .grow-row');
  assert(await p.locator('#panel .grow-row').count() === 6, '대장장이에 성장 장비 여섯 칸');
  await p.locator('#panel .grow-row button.buy').first().click();
  await p.waitForSelector('#modal .inf-box');
  await p.click('#modal .inf-box > .btn');
  await p.waitForSelector('#modal .enh-anim.inf');
  await p.waitForSelector('#modal .enh-anim.result', { timeout: 5000 });
  assert(await G(p, () => window.__game.s.equip.weapon.rar === 1), '두목 증표로 등급 각인 — 레어 → 유니크');
  await shot(p, '04a-smith.png');
  await p.click('#modal button:has-text("돌아가기")');
  await p.click('#modal button:has-text("닫기")');
  await G(p, () => { window.__game.rng = Math.random; });
  await p.click('#panel .subtabs button[data-key="gear"]');

  console.log('# 가방·강화');
  await G(p, () => { const g = window.__game; g.gainItem(g.makeCrafted('armor', 0)); });
  await p.locator('#panel .gear-tile:has-text("무기")').click();
  await p.waitForSelector('#modal h2');
  const plus0 = await G(p, () => window.__game.s.equip.weapon.plus);
  // v152: 강화는 연출(+1~3은 1초쯤) 뒤에 결과가 나온다
  await p.click('#modal .btn-row button:has-text("강화")');
  await p.waitForSelector('#modal .enh-anim');
  await p.waitForSelector('#modal .enh-anim.result', { timeout: 5000 });
  assert(await G(p, () => window.__game.s.equip.weapon.plus) > plus0, '무기 강화 +1 (연출 뒤 결과)');
  // 떨어질 수 있는 강화(+8부터)는 먼저 묻는다 (v192: +7까지는 실패해도 그대로라 묻지 않는다)
  await G(p, () => { window.__game.s.equip.weapon.plus = 8; });
  await p.click('#modal button:has-text("돌아가기")');
  await p.click('#modal .btn-row button:has-text("강화")');
  await p.waitForSelector('#modal .enh-ask');
  assert(await p.isVisible('#modal .enh-ask-rate'), '떨어질 수 있는 강화는 성공률을 보여 주고 묻는다');
  await p.click('#modal button:has-text("그만두기")');
  await G(p, () => { window.__game.s.equip.weapon.plus = 10; });
  await p.click('#modal button:has-text("닫기")');
  await p.locator('#panel .gear-tile:has-text("무기")').click();
  await p.click('#modal .btn-row button:has-text("돌파")');
  await p.waitForSelector('#modal .enh-ask.danger');
  assert(true, '-2가 될 수 있는 강화(+11부터)는 붉게 경고한다');
  await p.click('#modal button:has-text("그만두기")');
  await G(p, () => { window.__game.s.equip.weapon.plus = 1; });
  await p.click('#modal button:has-text("닫기")');
  await shot(p, '04-bag.png');

  console.log('# 마을·전직');
  await G(p, () => { const g = window.__game; g.s.level = 15; });
  await tab(p, 'town');
  // 전직·물약은 사냥터에서도
  assert(await G(p, () => !window.__game.map.town && window.__game.canAdvance()), '사냥터에서도 전직할 수 있다');
  await p.click('#panel button:has-text("쉬러 가기")');
  await sleep(300);
  assert(await G(p, () => window.__game.map.town), '마을로');
  await sleep(4500);
  assert(await G(p, () => window.__game.map.town), '스스로 간 마을에서는 머문다');
  await tab(p, 'town');
  await sleep(400);   // 시트가 다시 열리는 중이면 누름이 빗나간다
  // 마을 사람 넷 — 전직할 수 있으면 사부가 먼저 열린다
  assert(await p.isVisible('#panel .subtabs button.on[data-key="master"]'), '전직할 수 있으면 사부가 먼저');
  await p.click('#panel .subtabs button[data-key="shop"]');
  await sleep(200);
  const pot0 = await G(p, () => window.__game.s.potions);
  await p.locator('#panel .buy-grid .buy:has-text("50개")').click();
  assert(await G(p, () => window.__game.s.potions) === pot0 + 50, '물약 50개');
  await p.click('#panel button:has-text("자동 보충")');
  assert(await G(p, () => window.__game.s.autoRefill === true), '물약 자동 보충을 켠다');
  await p.click('#panel .subtabs button[data-key="master"]');
  await sleep(200);
  await p.click('#panel button:has-text("전직하기")');
  const t1 = await G(p, () => ({ tier: window.__game.s.jobTier, name: window.__game.tierName() }));
  assert(t1.tier === 1, `1차 전직 → ${t1.name}`);
  await shot(p, '05-town.png');

  console.log('# 스킬');
  await G(p, () => window.__game.enterMap(11));
  await p.click('#panel-close').catch(() => {});
  await sleep(1500);
  await G(p, () => { const g = window.__game; const m = g.mons.find((x) => x.alive && !x.npc); m.x = g.heroX + 40; m.y = g.heroY; m.hp = m.maxHp = 1e6; g.mon = m; g.cd.s0 = 0; g.s.autoSkill = false; });
  await p.locator('#skillbar .skill-btn').first().click();
  await sleep(200);
  assert(await G(p, () => window.__game.cd.s0) > 0, '스킬 단추로 일격기를 쓴다');
  await sleep(800);
  await shot(p, '06-skill.png');

  console.log('# 쓰러짐·귀환');
  await G(p, () => { const g = window.__game; g.s.autoSkill = true; g.heroDied({ isBoss: false }); });
  assert(await G(p, () => window.__game.map.town), '쓰러지면 마을로');
  await sleep(4500);
  assert(await G(p, () => window.__game.s.map) === 11, '쉬었다가 사냥터로 돌아간다');

  console.log('# 방치 보상·저장');
  await sleep(4000);
  await G(p, () => { window.__save(); const g = window.__game; g.s.rates = g.rates(); g.s.lastSeen = Date.now() - 3600 * 1000; });
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForSelector('text=다녀오셨어요');
  const k0 = await G(p, () => window.__game.s.kills);
  await shot(p, '07-offline.png');
  await p.click('#modal button:has-text("받기")');
  assert(await G(p, () => window.__game.s.kills) > k0, '방치 보상을 받는다');
  await G(p, () => window.__save());
  await p.reload({ waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const re = await G(p, () => ({ job: window.__game.s.job, tier: window.__game.s.jobTier, lv: window.__game.s.level, plus: window.__game.s.equip.weapon?.plus }));
  assert(re.job === 'sword' && re.tier === 1 && re.lv >= 15 && re.plus >= 1, '새로 고침 후 캐릭터·전직·레벨·강화 유지');
  assert(!(await p.isVisible('.class-card')), '새로 고침 후 캐릭터를 다시 묻지 않음');

  console.log('# 설정');
  if (await p.isVisible('#modal .btn.primary')) await p.click('#modal .btn.primary');
  await p.click('#btn-settings');
  await p.waitForSelector('#modal h2:has-text("설정")');
  await p.click('#modal button:has-text("닫기")');
  assert(true, '설정 창');

  if (!PKG) {
    assert((await p.textContent('#net-badge')).includes('오프라인'), 'Firebase 없이 오프라인 모드');
    console.log('errors:', a.errors);
    assert(a.errors.length === 0, '콘솔 오류 없음');
    await browser.close();
    console.log('ALL OK');
    return;
  }

  console.log('# 온라인: 서열');
  await p.waitForSelector('#net-badge.online', { timeout: 15000 });
  const b = await newPlayer(browser, '영희', '독마');
  const q = b.page;
  await q.waitForSelector('#net-badge.online', { timeout: 15000 });
  await G(q, () => window.__app?.net?.pushProfile?.(true));
  await sleep(1500);
  await tab(q, 'social');
  await q.click('#panel .subtabs button:has-text("서열")');
  await q.waitForSelector('.rank-row:has-text("철수")', { timeout: 15000 });
  const rows = await q.$$eval('.rank-row', (rs) => rs.map((r) => r.textContent));
  assert(rows.length >= 2 && rows[0].includes('철수'), `서열: 레벨 높은 철수가 맨 위 (${rows.length}명)`);
  await shot(q, '08-rank.png');

  console.log('# 온라인: 우편함 (v175)');
  {
    // 운영자만 넣을 수 있다 — 보통 무인이 넣으려 하면 규칙이 막는다
    assert(await G(q, async () => !(await window.__app.net.sendGift(window.__app.net.uid, { gold: 100 }))), '보통 무인은 우편을 넣을 수 없다 (운영자만)');
    // 운영자 자리에서 넣었다 치고(에뮬레이터 owner) 철수에게 400만 + 물약 30
    const uid = await G(p, () => window.__app.net.uid);
    const r = await fetch(`http://127.0.0.1:8080/v1/projects/idle-69772/databases/(default)/documents/gifts/${uid}/box?documentId=g1`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { gold: { integerValue: '4000000' }, potions: { integerValue: '30' }, memo: { stringValue: '시험 선물' }, at: { integerValue: String(Date.now()) } } }) });
    assert(r.ok, '우편을 넣었다');
    const g0 = await G(p, () => window.__game.s.gold);
    assert(await G(p, () => window.__test_checkGifts?.()) === 1, '우편함에 한 통');
    await sleep(300);
    assert(!(await p.$eval('#btn-mail', (b) => b.classList.contains('hidden'))), '📮 단추가 보인다');
    assert(await G(p, () => window.__game.s.gold) < g0 + 1000000, '받기를 누르기 전에는 들어오지 않는다');
    const pot0 = await G(p, () => window.__game.s.potions);
    await p.click('#btn-mail');
    await p.waitForSelector('.mail-card');
    await shot(p, '08b-mail.png');
    await p.click('.mail-card .mail-take');
    let g1 = g0;
    for (let i = 0; i < 20 && g1 < g0 + 4000000; i++) { await sleep(300); g1 = await G(p, () => window.__game.s.gold); }
    assert(g1 >= g0 + 4000000, `받기 → 은자 +${g1 - g0}`);
    assert(await G(p, () => window.__game.s.potions) >= pot0 + 30 - 5, '받기 → 물약도');
    await G(p, () => document.querySelector('#modal .btn:not(.primary)')?.click());
    assert(await G(p, () => window.__test_checkGifts?.()) === 0, '받은 우편은 우편함에서 사라진다');
    assert(await p.$eval('#btn-mail', (b) => b.classList.contains('hidden')), '빈 우편함이면 📮 단추가 숨는다');
    await G(p, () => window.__test_claimAll?.());
    assert(await G(p, () => window.__game.s.gold) < g1 + 1000000, '받은 우편은 다시 받지 않는다');
    // 애완동물·탈것 (v177)
    const r2 = await fetch(`http://127.0.0.1:8080/v1/projects/idle-69772/databases/(default)/documents/gifts/${uid}/box?documentId=g2`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { pet: { stringValue: 'tiger:3' }, mount: { stringValue: 'azure' }, at: { integerValue: String(Date.now()) } } }) });
    assert(r2.ok, '애완동물·탈것 우편을 넣었다');
    assert(await G(p, () => window.__test_checkGifts?.()) === 1, '우편함에 한 통 더');
    await G(p, () => window.__test_claimAll?.());
    const got = await G(p, () => ({ pet: [...window.__game.s.pets, ...window.__game.s.petBox].some((x) => x.kind === 'tiger' && x.rar === 3),
      mount: window.__game.s.mounts.some((x) => x.kind === 'azure') }));
    assert(got.pet, '받기 → 신화 백호가 들어온다');
    assert(got.mount, '받기 → 청룡마가 들어온다');
  }

  console.log('# 온라인: 문파');
  await G(p, () => { const g = window.__game; g.s.mats = { 1: 100 }; g.s.gold = Math.max(g.s.gold, 1e5); });
  await tab(p, 'social');
  await p.fill('#panel input[placeholder^="문파 이름"]', '우리끼리');
  await p.click('#panel button:has-text("만들기")');
  await p.waitForSelector('#panel button:has-text("출석")', { timeout: 15000 });
  const code = await G(p, () => window.__app.net.guild.code);
  assert(/^[A-Z0-9]{6}$/.test(code), `문파를 만들었다 (코드 ${code})`);
  await p.click('#panel button:has-text("출석")');
  await p.waitForFunction(() => (window.__app.net.guild?.exp || 0) >= 20, null, { timeout: 10000 });
  await p.click('#panel button:has-text("기부")');
  await p.waitForFunction(() => (window.__app.net.guild?.exp || 0) >= 30, null, { timeout: 10000 });
  assert(true, '출석·기부로 문파 경험치가 오른다');
  await p.click('#panel .guild-seg button[data-key="bank"]');
  await p.click('#panel .bank-mine .bank-row:has-text("청죽") button:has-text("반 넣기")');
  // 사냥 중이라 청죽 마디가 계속 들어온다 — 정확히 50이 아니라 반쯤
  await p.waitForFunction(() => (window.__app.net.guild?.bank?.['1'] || 0) >= 50, null, { timeout: 10000 });
  assert(await G(p, () => window.__game.s.mats[1] < 100), '재료 반을 문파 창고에 넣는다');
  await tab(q, 'social');
  await q.click('#panel .subtabs button:has-text("문파")');
  await q.fill('#panel input[placeholder^="친구에게"]', code);
  await q.click('#panel button:has-text("가입")');
  await q.waitForSelector('#panel .guild-seg', { timeout: 15000 });
  await q.click('#panel .guild-seg button[data-key="bank"]');
  await q.waitForSelector('#panel .bank-in .bank-row:has-text("청죽")', { timeout: 15000 });
  const m0 = await G(q, () => window.__game.s.mats[1] || 0);
  await q.click('#panel .bank-in .bank-row:has-text("청죽") button:has-text("전부 꺼내기")');
  await q.waitForFunction((m) => (window.__game.s.mats[1] || 0) >= m + 50, m0, { timeout: 10000 });
  assert(true, '다른 문파원이 창고에서 재료를 꺼낸다');
  await q.click('#panel .guild-seg button[data-key="chat"]');
  await p.click('#panel .guild-seg button[data-key="chat"]');
  await q.fill('#panel input[placeholder="메시지 보내기"]', '같이 해요');
  await q.click('#panel button:has-text("전송")');
  await p.waitForSelector('#panel .msg:has-text("같이 해요")', { timeout: 10000 });
  assert(true, '문파 채팅이 오간다');
  await shot(p, '09-guild.png');

  console.log('# 온라인: 문파 토벌 (v128)');
  await tab(p, 'dgn/raid');
  await p.click('#panel .dgn-raid button:has-text("이번 주 토벌 열기")');
  await p.waitForFunction(() => window.__app.net.raid?.kind === 'world' && window.__app.net.raid.maxHp > 0, null, { timeout: 15000 })
    .catch(async (e) => { console.log('DEBUG', await G(p, () => ({ toast: document.getElementById('toast').innerText, raid: window.__app.net.raid, day: window.__app.net.raidDay }))); throw e; });
  await p.waitForSelector('#panel .dgn-raid button:has-text("도전")', { timeout: 10000 });
  await p.click('#panel .dgn-raid button:has-text("도전")');
  await p.waitForFunction(() => window.__game.inst?.kind === 'raid' && window.__game.inst.boss, null, { timeout: 10000 });
  await p.waitForFunction(() => window.__game.inst.boss.hp < window.__game.inst.hpLeft, null, { timeout: 15000 });
  await G(p, () => { window.__game.inst.t = 0.05; });
  await p.waitForFunction(() => (window.__app.net.raid?.total || 0) > 0, null, { timeout: 15000 });
  assert(await G(p, () => !window.__game.inst && window.__game.s.raid.n === 1), '토벌 40초 — 친 만큼 문파 두목 체력이 깎인다');
  await q.waitForFunction(() => (window.__app.net.raid?.total || 0) > 0, null, { timeout: 15000 });
  await G(q, () => { const r = window.__app.net.raid; window.__game.startRaid({ key: r.id, hpLeft: r.maxHp - r.total, maxHp: r.maxHp }); });
  await q.waitForFunction(() => window.__game.inst?.boss, null, { timeout: 10000 });
  await G(q, () => { const g = window.__game; const b = g.inst.boss; b.introT = 0; g.freezeT = 0; g.hurt(b, b.hp + 1, 'hit', false); });
  await q.waitForFunction(() => { const r = window.__app.net.raid; return r && r.total >= r.maxHp; }, null, { timeout: 15000 });
  const gold0 = await G(q, () => window.__game.s.gold);
  const got = await G(q, async () => !!(await window.__app.net.claimWeek()));
  assert(got && (await G(q, () => window.__game.s.gold)) > gold0, '문파원이 마무리 — 친 사람은 처치 보상을 받는다');
  await p.waitForFunction(() => window.__app.net.canClaimWeek(), null, { timeout: 10000 });
  assert(true, '함께 친 다른 문파원도 받을 수 있다');
  await shot(p, '10-raid.png');

  console.log('# 온라인: 십이지왕 함께 사냥 (v138)');
  for (const pg of [p, q]) {
    await G(pg, () => { const g = window.__game; while (g.s.level < 105) g.addExp(1e12); g.s.stats.vit = 1e6; g._stats = null; g.heroHp = g.stats().hp; g.s.autoSkill = false; });
  }
  // q는 먼저 함께로 들어가 있고, p는 지도에서 왕 두목 구역을 눌러 고르는 창에서 '함께'를 고른다 (v145)
  await G(q, () => { const g = window.__game; g.s.kingParty = true; g.enterMap(164); });
  await tab(p, 'map/king');
  await p.locator('#panel .zone-card.king:has-text("권왕") .area-btn.boss').click();
  await p.waitForSelector('#modal .party-opt');
  await p.waitForSelector('#modal p:has-text("문파원 1명")', { timeout: 15000 });
  assert(true, '왕 두목 구역을 누르면 혼자/함께를 고르고, 지금 사냥 중인 문파원 수가 보인다');
  await p.click('#modal .party-opt:has-text("함께")');
  await p.waitForFunction(() => window.__coop.on && window.__coop.others.length === 1, null, { timeout: 20000 })
    .catch(async (e) => { console.log('DEBUG', await G(p, () => ({ on: window.__coop.on, j: window.__coop.joining, f: window.__coop.failed, k: window.__coop.key, o: window.__coop.others.length }))); throw e; });
  await q.waitForFunction(() => window.__coop.on && window.__coop.others.length === 1, null, { timeout: 20000 });
  assert(true, '같은 왕 구역의 문파원이 서로 보인다');
  const bossUp = () => { const g = window.__game; const m = g.mons.find((x) => x.alive && x.coopSeq != null); if (m) { m.introT = 0; g.freezeT = 0; m.atk = 0; } return !!m; };
  await p.waitForFunction(bossUp, null, { timeout: 20000 });
  await q.waitForFunction(bossUp, null, { timeout: 20000 });
  const seqP = await G(p, () => window.__game.mons.find((x) => x.coopSeq != null).coopSeq);
  const seqQ = await G(q, () => window.__game.mons.find((x) => x.coopSeq != null).coopSeq);
  assert(seqP === seqQ, `둘이 같은 왕을 본다 (seq ${seqP})`);
  // p가 3할을 깎으면 q 화면의 왕도 깎인다
  await G(p, () => { const g = window.__game; const m = g.mons.find((x) => x.coopSeq != null); g.hurt(m, m.maxHp * 0.3, 'hit', false); });
  await q.waitForFunction(() => { const m = window.__game.mons.find((x) => x.alive && x.coopSeq != null); return m && m.hp <= m.maxHp * 0.71; }, null, { timeout: 15000 });
  assert(true, '한 사람이 친 만큼 다른 사람 화면의 왕 체력도 깎인다');
  const kp0 = await G(p, () => window.__game.s.kills);
  const kq0 = await G(q, () => window.__game.s.kills);
  await G(q, () => { const g = window.__game; const m = g.mons.find((x) => x.coopSeq != null); g.hurt(m, m.maxHp, 'hit', false); });
  await q.waitForFunction((k) => window.__game.s.kills > k, kq0, { timeout: 15000 });
  await p.waitForFunction((k) => window.__game.s.kills > k, kp0, { timeout: 15000 });
  assert(await G(p, () => !window.__game.mons.some((x) => x.isBoss && x.alive)), '서버가 쓰러졌다 하면 함께 친 둘 다 처치 보상을 받는다');
  await shot(p, '11-coop.png');
  // q가 방 안에서 '혼자'로 바꾸면 방을 나가고 혼자 왕을 잡으며 계속 사냥한다
  await G(q, () => window.__app.closePanel());
  await sleep(400);
  await q.click('#btn-party');
  await q.waitForFunction(() => !window.__coop.on && !window.__game.s.kingParty, null, { timeout: 10000 });
  await p.waitForFunction(() => window.__coop.others.length === 0, null, { timeout: 15000 });
  assert(true, '방 안에서 혼자로 바꾸면 방을 나가고 다른 사람 화면에서도 사라진다');
  await q.waitForFunction(() => { const g = window.__game; const b = g.mons.find((x) => x.isBoss && x.alive); return g.map.id === 164 && b && b.coopSeq == null; }, null, { timeout: 70000 });
  assert(true, '혼자로 바꿔도 그 왕 구역에서 혼자 왕이 나서 방치 사냥이 이어진다');
  await G(q, () => window.__game.enterMap(163));

  const errs = [...a.errors, ...b.errors];
  console.log('errors:', errs);
  assert(errs.length === 0, '콘솔 오류 없음');
  await browser.close();
  console.log('ALL OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
