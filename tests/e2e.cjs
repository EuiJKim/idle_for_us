// 브라우저 종단 테스트 — 바람식 개편 (Playwright + 선택: Firebase 에뮬레이터)
//   1) 정적 서버:   npx http-server -p 8123 -s -c-1 .
//   2) (선택) 에뮬레이터: firebase emulators:start --only auth,firestore --project idle-69772
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
async function tab(page, name) {
  if (await page.isVisible('#panel-close')) { await page.click('#panel-close'); await sleep(250); }
  await page.click(`#tabs button[data-tab="${name}"]`);
  await sleep(300);
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
  await tab(p, 'map');
  assert(await p.locator('#panel .zone-card:has-text("죽림") .area-btn').count() === 4, '지역 카드에 구역 1·2·3·두목');
  assert(await p.locator('#panel .zone-card:has-text("죽림") .area-btn:has-text("2")').isDisabled(), '레벨이 모자란 구역은 잠겨 있다');
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
  await p.mouse.click(60, 420);
  await sleep(1200);
  const after = await G(p, () => ({ x: window.__game.heroX, y: window.__game.heroY }));
  assert(Math.hypot(after.x - before.x, after.y - before.y) > 30, '누른 쪽으로 걸어간다');

  console.log('# 스탯');
  await G(p, () => { const g = window.__game; g.s.autoStat = false; g.s.statPts = 6; });
  await p.waitForSelector('#advice:not(.hidden)');
  assert((await p.textContent('#advice')).includes('스탯 점수 6'), '남은 레벨업 점수가 들판 위에 보인다');
  await p.click('#advice');
  await p.waitForSelector('#panel .row:has-text("힘")');
  const str0 = await G(p, () => window.__game.s.stats.str);
  await p.locator('#panel .row:has-text("힘") button.buy').click();
  assert(await G(p, () => window.__game.s.stats.str) === str0 + 1, '힘 +1');
  await shot(p, '03-char.png');

  console.log('# 대장장이 조합');
  await G(p, () => { const g = window.__game; g.s.gold = 1e6; g.s.mats = { 1: 500, b1: 10 }; g.s.equip.weapon = null; });
  await tab(p, 'bag');
  await p.waitForSelector('#panel .craft-row.ready');
  await p.locator('#panel .craft-row:has-text("무기") button:has-text("조합")').first().click();
  await sleep(200);
  assert(await G(p, () => window.__game.s.equip.weapon?.step === 0), '하급 무기를 조합해 낀다');
  await p.locator('#panel .craft-row:has-text("상급") button:has-text("조합")').first().click();
  await sleep(200);
  assert(await G(p, () => window.__game.s.equip.weapon?.step === 1), '하급 + 재료 + 증표 → 상급');
  await shot(p, '04a-smith.png');

  console.log('# 가방·강화');
  await G(p, () => { const g = window.__game; g.gainItem(g.makeCrafted('armor', 0)); });
  await p.locator('#panel .equip-slot:has-text("무기") .item-chip').click();
  await p.waitForSelector('#modal h2');
  const plus0 = await G(p, () => window.__game.s.equip.weapon.plus);
  for (let i = 0; i < 6 && await G(p, () => window.__game.s.equip.weapon.plus) === plus0; i++) {
    await p.click('#modal button:has-text("강화")');
    await sleep(120);
  }
  assert(await G(p, () => window.__game.s.equip.weapon.plus) > plus0, '무기 강화 +1');
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
  const pot0 = await G(p, () => window.__game.s.potions);
  await p.locator('#panel .buy:has-text("50개")').click();
  assert(await G(p, () => window.__game.s.potions) === pot0 + 50, '물약 50개');
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
  await p.click('#panel .mat-chip:has-text("청죽")');
  // 사냥 중이라 청죽 마디가 계속 들어온다 — 정확히 50이 아니라 반쯤
  await p.waitForFunction(() => (window.__app.net.guild?.bank?.['1'] || 0) >= 50, null, { timeout: 10000 });
  assert(await G(p, () => window.__game.s.mats[1] < 100), '재료 반을 문파 창고에 넣는다');
  await tab(q, 'social');
  await q.click('#panel .subtabs button:has-text("문파")');
  await q.fill('#panel input[placeholder^="친구에게"]', code);
  await q.click('#panel button:has-text("가입")');
  await q.waitForSelector('#panel .card:has-text("문파 창고") button.mat-chip:has-text("청죽")', { timeout: 15000 });
  const m0 = await G(q, () => window.__game.s.mats[1] || 0);
  await q.click('#panel .card:has-text("문파 창고") button.mat-chip:has-text("청죽")');
  await q.waitForFunction((m) => (window.__game.s.mats[1] || 0) >= m + 50, m0, { timeout: 10000 });
  assert(true, '다른 문파원이 창고에서 재료를 꺼낸다');
  await q.fill('#panel input[placeholder="메시지 보내기"]', '같이 해요');
  await q.click('#panel button:has-text("전송")');
  await p.waitForSelector('#panel .msg:has-text("같이 해요")', { timeout: 10000 });
  assert(true, '문파 채팅이 오간다');
  await shot(p, '09-guild.png');

  const errs = [...a.errors, ...b.errors];
  console.log('errors:', errs);
  assert(errs.length === 0, '콘솔 오류 없음');
  await browser.close();
  console.log('ALL OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
