// 브라우저 종단 테스트 (Playwright + Firebase 에뮬레이터)
//   1) 정적 서버:      npx http-server -p 8123 -s -c-1 .
//   2) 에뮬레이터:      firebase emulators:start --only auth,firestore --project idle-69772
//   3) 실행:           FIREBASE_PKG=/path/to/node_modules/firebase node tests/e2e.cjs
// FIREBASE_PKG가 없으면 Firebase 로딩을 막고 혼자 하기만 확인한다.
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

async function newPlayer(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    if (!PKG) return route.abort();
    const file = path.join(PKG, path.basename(new URL(route.request().url()).pathname));
    return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + (PKG ? '?emu=1' : ''));
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  return { ctx, page, errors, name };
}

const tab = (page, name) => page.click(`#tabs button[data-tab="${name}"]`);
const sub = (page, label) => page.click(`.subtabs button:has-text("${label}")`);
const G = (page, fn, arg) => page.evaluate(fn, arg);
// 진행 중인 전투(던전·시련·결투)를 빨리 끝낸다
async function finishContest(page, { win = true } = {}) {
  for (let i = 0; i < 60; i++) {
    const done = await G(page, (w) => {
      const g = window.__game;
      if (g.mode === 'stage') return true;
      if (w) { if (g.mon?.alive) g.mon.hp = 1e-9; } else g.contest.time = 0.01;
      return false;
    }, win);
    if (done) return;
    await sleep(150);
  }
  throw new Error('contest did not finish');
}

(async () => {
  if (PKG) { // 에뮬레이터 데이터 초기화
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/idle-69772/databases/(default)/documents', { method: 'DELETE' });
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/idle-69772/accounts', { method: 'DELETE' });
  }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const a = await newPlayer(browser, '철수');
  const p = a.page;

  console.log('# 전투·강화');
  await sleep(5000);
  const s1 = await G(p, () => ({ gold: window.__game.s.gold, kills: window.__game.s.stats.kills, exp: window.__game.s.exp }));
  assert(s1.kills > 0 && s1.gold > 0 && s1.exp > 0, `자동 사냥: 처치 ${s1.kills}, 골드 ${Math.floor(s1.gold)}, 경험치 ${Math.floor(s1.exp)}`);
  await shot(p, '01-battle.png');
  await G(p, () => { window.__game.s.gold = 1e7; });
  await p.click('#panel .section-title .seg button:nth-child(2)');
  await p.locator('#panel .row .buy').first().click();
  assert(await G(p, () => window.__game.s.upgrades.atk) === 10, '공격력 x10 강화');

  console.log('# 레벨·승급');
  await G(p, () => { window.__game.s.sp = 12; window.__game.s.level = 15; window.__game.s.upgrades.hp = 300; });
  await sub(p, '레벨');
  await p.locator('#panel .row button:has-text("+10")').first().click();
  assert(await G(p, () => window.__game.s.spAlloc.atk) === 10, '스탯 포인트 공격력 +10');
  await shot(p, '02-level.png');
  await sub(p, '경지');
  await p.click('button:has-text("경지 돌파")');
  assert(await G(p, () => window.__game.mode) === 'trial', '경지 돌파(심마) 시작');
  await sleep(1200);
  await shot(p, '03-trial.png');
  await finishContest(p);
  await p.waitForSelector('.result-title:has-text("경지 돌파")');
  assert(await G(p, () => window.__game.s.rank) === 1, '경지 돌파 → 이류');
  await shot(p, '04-rankup.png');
  await p.click('#modal >> text=확인');

  console.log('# 장비');
  await tab(p, 'equip');
  await p.click('button:has-text("10회")');
  await p.waitForSelector('.gacha-item');
  assert((await p.$$('.gacha-item')).length === 10, '장비 10회 뽑기');
  await p.click('#modal >> text=닫기');
  await G(p, () => { window.__game.s.equips.weapon[0] = 9; window.__game.s.stones = 100; });
  await p.click('text=모두 합성');
  assert(await G(p, () => window.__game.s.equips.weapon[0]) === 1, '합성');
  await p.locator('#panel .card .buy').first().click();
  assert(await G(p, () => window.__game.s.enhance.weapon) === 1, '무기 강화 +1');
  await shot(p, '05-equip.png');

  console.log('# 스킬');
  await G(p, () => { window.__game.s.maxStage = 50; window.__game.s.bestStage = 50; window.__game.s.books = 100; });
  await tab(p, 'skill');
  await p.locator('#panel .row:has-text("질풍보") button:has-text("장착")').click();
  assert(await G(p, () => window.__game.s.skillSlots.includes('gale')), '질풍보 장착');
  await p.locator('#panel .row:has-text("선풍검") .buy').click();
  assert(await G(p, () => window.__game.s.skills.slash) === 2, '비급으로 선풍검 Lv.2');
  await shot(p, '06-skill.png');

  console.log('# 펫·유물');
  await G(p, () => { window.__game.s.gems = 5000; });
  await tab(p, 'companion');
  await p.click('button:has-text("알 10개")');
  await p.waitForSelector('.gacha-item');
  await p.click('#modal >> text=확인');
  const pets = await G(p, () => ({ n: Object.keys(window.__game.s.pets).length, pet: window.__game.s.pet }));
  assert(pets.n >= 1 && pets.pet, `펫 부화 ${pets.n}종, 장착 ${pets.pet}`);
  await G(p, () => { window.__game.s.food = 1000; });
  const petId = pets.pet;
  await p.locator('#panel .row .buy').nth(['dog', 'cat', 'fox', 'owl', 'panda', 'unicorn', 'tiger', 'dragon'].indexOf(petId)).click();
  assert(await G(p, (id) => window.__game.s.pets[id], petId) === 2, '펫 레벨업');
  await sleep(1500);
  await shot(p, '07-pet.png');
  await G(p, () => { window.__game.s.relicShards = 100; });
  await sub(p, '신물');
  await p.click('button:has-text("발굴 10회")');
  assert(await G(p, () => Object.values(window.__game.s.relics).reduce((x, y) => x + y, 0)) === 10, '신물 발굴 10회');
  await shot(p, '08-relic.png');

  console.log('# 던전');
  await tab(p, 'dungeon');
  await p.locator('.dungeon-card:has-text("흑도 전장") button:has-text("도전")').click();
  assert(await G(p, () => window.__game.mode) === 'dungeon', '흑도 전장 입장');
  await sleep(1500);
  await shot(p, '09-dungeon.png');
  await finishContest(p);
  await p.waitForSelector('.result-title:has-text("비경 돌파")');
  const dg = await G(p, () => ({ lv: window.__game.s.dungeons.gold, keys: window.__game.s.daily.keys.gold }));
  assert(dg.lv === 1 && dg.keys === 1, '1단계 클리어, 열쇠 1개 남음');
  await p.click('#modal >> text=확인');
  await p.locator('.dungeon-card:has-text("흑도 전장") button:has-text("소탕")').click();
  assert(await G(p, () => window.__game.s.daily.keys.gold) === 0, '소탕으로 열쇠 사용');
  await shot(p, '10-dungeon-tab.png');

  console.log('# 미션');
  await p.click('#btn-missions');
  await p.waitForSelector('#modal h2:has-text("일일 의뢰")');
  const gemsBefore = await G(p, () => window.__game.s.gems);
  await p.locator('#modal .row:has-text("뽑기") button:has-text("받기")').click();
  assert(await G(p, () => window.__game.s.gems) === gemsBefore + 50, '뽑기 의뢰 보상');
  await shot(p, '11-missions.png');
  await p.click('#modal >> text=닫기');

  console.log('# 회귀');
  await G(p, () => { window.__game.s.maxStage = 100; window.__game.s.stage = 100; window.__game.s.gold = 1e9; });
  await tab(p, 'growth');
  await sub(p, '회귀');
  await p.click('button:has-text("회귀한다 (+10)")');
  await p.waitForSelector('#modal .regress-hz');
  await shot(p, '12-regress-modal.png');
  await p.click('#modal button:has-text("회귀한다")');
  const rg = await G(p, () => ({ ...window.__game.s.regress, stage: window.__game.s.stage, gold: window.__game.s.gold, best: window.__game.s.bestStage, rank: window.__game.s.rank }));
  assert(rg.count === 1 && rg.points === 10 && rg.stage === 1 && rg.gold === 0 && rg.best === 100 && rg.rank === 1, '회귀: 1관문으로, 기억 +10, 경지·역대 관문 유지');
  await sleep(1500);
  await shot(p, '13-after-regress.png');

  console.log('# 방치 보상·저장');
  await G(p, () => { window.__game.s.lastSeen = Date.now() - 2 * 3600 * 1000; });
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForSelector('text=다녀오셨어요');
  const lv0 = await G(p, () => window.__game.s.exp + window.__game.s.level * 1e12);
  await p.click('#modal >> text=받기');
  assert(await G(p, () => window.__game.s.exp + window.__game.s.level * 1e12) > lv0, '방치 보상 (골드+경험치)');
  await p.reload();
  await sleep(1500);
  const re = await G(p, () => ({ rank: window.__game.s.rank, pet: window.__game.s.pet, gold: window.__game.s.dungeons.gold }));
  assert(re.rank === 1 && re.pet === petId && re.gold === 1, '새로고침 후 경지·영수·비경 유지');

  if (!PKG) {
    assert((await p.textContent('#net-badge')).includes('오프라인'), 'Firebase 없이 오프라인 모드');
    console.log('errors:', a.errors);
    assert(a.errors.length === 0, '콘솔 오류 없음');
    await browser.close();
    console.log('ALL OK');
    return;
  }

  console.log('# 온라인: 길드');
  await p.waitForSelector('#net-badge.online', { timeout: 15000 });
  await tab(p, 'social');
  await sub(p, '문파');
  await p.fill('input[placeholder^="문파 이름"]', '우리끼리');
  await p.click('button:has-text("문파 만들기")');
  await p.waitForSelector('text=🏰 우리끼리');
  const code = (await p.textContent('.card b[style*="letter-spacing"]')).trim();
  assert(/^[A-Z0-9]{6}$/.test(code), `문파 생성, 코드 ${code}`);

  const b = await newPlayer(browser, '영희');
  const q = b.page;
  await q.waitForSelector('#net-badge.online', { timeout: 15000 });
  await tab(q, 'social');
  await sub(q, '문파');
  await q.fill('input[placeholder^="친구에게"]', code.toLowerCase());
  await q.click('button:has-text("가입하기")');
  await q.waitForSelector('text=🏰 우리끼리');
  await p.waitForSelector('.chip:has-text("영희")', { timeout: 10000 });
  assert(true, '영희 가입');

  await p.fill('input[placeholder="메시지 보내기"]', '안녕 영희!');
  await p.press('input[placeholder="메시지 보내기"]', 'Enter');
  await q.waitForSelector('.msg:has-text("안녕 영희!")', { timeout: 10000 });
  assert(true, '채팅');

  console.log('# 레이드');
  await p.click('text=⚔️ 공격하기');
  await p.waitForFunction(() => window.__game.mode === 'raid');
  await sleep(2000);
  await shot(p, '12-raid.png');
  await G(p, () => { window.__game.contest.time = 0.01; });
  await p.waitForFunction(() => window.__game.mode === 'stage');
  await q.waitForSelector('.contrib:has-text("철수")', { timeout: 10000 });
  await q.click('text=⚔️ 공격하기');
  await q.waitForFunction(() => window.__game.mode === 'raid');
  await G(q, () => { window.__game.contest.damage = window.__game.mon.hp * 2; window.__game.contest.time = 0.01; });
  await p.waitForSelector('text=보상 받기', { timeout: 10000 });
  const shards0 = await G(p, () => window.__game.s.relicShards);
  await p.click('text=보상 받기');
  await p.waitForSelector('text=보상을 받았어요', { timeout: 10000 });
  assert(await G(p, () => window.__game.s.relicShards) === shards0 + 20, '토벌 성공 보상 (신물 조각 포함)');

  console.log('# 결투');
  await sub(q, '비무대');
  await q.waitForSelector('.rank-row:has-text("철수") button:has-text("비무")', { timeout: 10000 });
  await shot(q, '13-pvp-list.png');
  await q.click('.rank-row:has-text("철수") button:has-text("비무")');
  await q.waitForFunction(() => window.__game.mode === 'pvp');
  await sleep(2000);
  await shot(q, '14-pvp.png');
  await finishContest(q, { win: false });
  await q.waitForSelector('.result-title');
  const pvp = await G(q, () => ({ ...window.__game.s.pvp, t: window.__game.s.daily.pvpTickets }));
  assert(pvp.wins + pvp.losses === 1 && pvp.t === 4 && pvp.score !== 1000, `비무 결과 반영 (${pvp.wins}승 ${pvp.losses}패, ${pvp.score}점)`);
  await shot(q, '15-pvp-result.png');
  await q.click('#modal >> text=확인');

  console.log('# 랭킹');
  await sub(q, '서열');
  await q.waitForSelector('.rank-row:has-text("철수")', { timeout: 10000 });
  assert((await q.$$('.rank-row')).length === 2, '서열 2명');
  await q.click('.rank-row:has-text("철수")');
  await q.waitForSelector('#modal h2:has-text("철수")');
  await shot(q, '16-profile.png');
  assert((await q.textContent('#modal')).includes('이류'), '프로필에 경지 표시');

  const errs = [...a.errors, ...b.errors];
  console.log('errors:', errs);
  assert(errs.length === 0, '콘솔 오류 없음');
  await browser.close();
  console.log('ALL OK');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
