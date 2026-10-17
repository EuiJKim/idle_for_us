// 브라우저 종단 테스트 (Playwright + Firebase 에뮬레이터)
//   1) 정적 서버:      npx http-server -p 8123 -s .
//   2) 에뮬레이터:      firebase emulators:start --only auth,firestore --project idle-69772
//   3) 실행:           FIREBASE_PKG=/path/to/node_modules/firebase node tests/e2e.cjs
// FIREBASE_PKG가 없으면 Firebase 로딩을 막고 오프라인 모드만 확인한다.
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const PKG = process.env.FIREBASE_PKG;
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); console.log('  ✓', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPlayer(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route('https://www.gstatic.com/firebasejs/**', (route) => {
    if (!PKG) return route.abort();
    const file = path.join(PKG, path.basename(new URL(route.request().url()).pathname));
    route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file) });
  });
  await page.goto(BASE + (PKG ? '?emu=1' : ''));
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  return { ctx, page, errors, name };
}

const tab = (page, name) => page.click(`#tabs button[data-tab="${name}"]`);
const game = (page, fn) => page.evaluate(fn);

(async () => {
  if (PKG) { // 에뮬레이터 데이터 초기화
    await fetch('http://127.0.0.1:8080/emulator/v1/projects/idle-69772/databases/(default)/documents', { method: 'DELETE' });
    await fetch('http://127.0.0.1:9099/emulator/v1/projects/idle-69772/accounts', { method: 'DELETE' });
  }
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const a = await newPlayer(browser, '철수');

  console.log('# 혼자 하기');
  await sleep(6000);
  const s1 = await game(a.page, () => ({ gold: window.__game.s.gold, kills: window.__game.s.stats.kills }));
  assert(s1.kills > 0 && s1.gold > 0, `자동 사냥으로 골드 획득 (처치 ${s1.kills}, 골드 ${Math.floor(s1.gold)})`);
  await a.page.screenshot({ path: path.join(OUT, '01-battle.png') });

  await game(a.page, () => { window.__game.s.gold = 1e6; });
  await a.page.click('.seg button:nth-child(2)');
  const before = await game(a.page, () => window.__game.s.upgrades.atk);
  await a.page.locator('#panel .row .buy').first().click();
  const after = await game(a.page, () => window.__game.s.upgrades.atk);
  assert(after === before + 10, `공격력 x10 강화 (${before} → ${after})`);

  await tab(a.page, 'equip');
  await a.page.click('text=10회');
  await a.page.waitForSelector('.gacha-item');
  assert((await a.page.$$('.gacha-item')).length === 10, '장비 10회 뽑기 결과 10개');
  await a.page.screenshot({ path: path.join(OUT, '02-gacha.png') });
  await a.page.click('#modal >> text=닫기');
  await game(a.page, () => { window.__game.s.equips.weapon[0] = 9; });
  await a.page.click('text=모두 합성');
  const eq = await game(a.page, () => window.__game.s.equips.weapon.slice(0, 2));
  assert(eq[0] === 1 && eq[1] >= 2, `무기 일반 9개 → 합성 후 일반 ${eq[0]}, 고급 ${eq[1]}`);
  await a.page.screenshot({ path: path.join(OUT, '03-equip.png') });

  await tab(a.page, 'skill');
  await a.page.screenshot({ path: path.join(OUT, '04-skill.png') });

  console.log('# 방치 보상');
  await game(a.page, () => { window.__game.s.lastSeen = Date.now() - 2 * 3600 * 1000; });
  await a.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await a.page.waitForSelector('text=다녀오셨어요');
  await a.page.screenshot({ path: path.join(OUT, '05-offline.png') });
  const g0 = await game(a.page, () => window.__game.s.gold);
  await a.page.click('#modal >> text=받기');
  const g1 = await game(a.page, () => window.__game.s.gold);
  assert(g1 > g0, `방치 보상 수령 (+${Math.floor(g1 - g0)})`);

  console.log('# 저장/불러오기');
  await a.page.reload();
  await sleep(1500);
  const reloaded = await game(a.page, () => ({ nick: window.__game.s.nickname, atk: window.__game.s.upgrades.atk }));
  assert(reloaded.nick === '철수' && reloaded.atk === after, '새로고침 후 진행 상황 유지');

  if (!PKG) {
    assert((await a.page.textContent('#net-badge')).includes('오프라인'), 'Firebase 없이 오프라인 모드로 동작');
    console.log('errors:', a.errors);
    await browser.close();
    return;
  }

  console.log('# 온라인: 길드');
  await a.page.waitForSelector('#net-badge.online', { timeout: 15000 });
  assert(true, '익명 로그인 성공');
  await tab(a.page, 'guild');
  await a.page.fill('input[placeholder^="길드 이름"]', '우리끼리');
  await a.page.click('button:has-text("길드 만들기")');
  await a.page.waitForSelector('text=🏰 우리끼리');
  const code = (await a.page.textContent('.card b[style*="letter-spacing"]')).trim();
  assert(/^[A-Z0-9]{6}$/.test(code), `길드 생성, 코드 ${code}`);

  const b = await newPlayer(browser, '영희');
  await b.page.waitForSelector('#net-badge.online', { timeout: 15000 });
  await tab(b.page, 'guild');
  await b.page.fill('input[placeholder^="친구에게"]', code.toLowerCase());
  await b.page.click('button:has-text("가입하기")');
  await b.page.waitForSelector('text=🏰 우리끼리');
  await a.page.waitForSelector('.chip:has-text("영희")', { timeout: 10000 });
  assert(true, '영희가 코드로 가입, 철수 화면에도 표시');

  await a.page.click('text=📅 출석');
  await a.page.waitForSelector('text=✅ 오늘 출석함');
  assert(true, '길드 출석');

  console.log('# 채팅');
  await a.page.fill('input[placeholder="메시지 보내기"]', '안녕 영희!');
  await a.page.press('input[placeholder="메시지 보내기"]', 'Enter');
  await b.page.waitForSelector('.msg:has-text("안녕 영희!")', { timeout: 10000 });
  await b.page.fill('input[placeholder="메시지 보내기"]', '<b>반가워</b>');
  await b.page.click('.chat-input >> text=전송');
  await a.page.waitForSelector('.msg:has-text("<b>반가워</b>")', { timeout: 10000 });
  assert(true, '양방향 채팅 (HTML은 글자 그대로 표시)');

  console.log('# 레이드');
  await a.page.click('text=⚔️ 공격하기');
  await a.page.waitForFunction(() => window.__game.mode === 'raid');
  await sleep(2500);
  await a.page.screenshot({ path: path.join(OUT, '06-raid.png') });
  await game(a.page, () => { window.__game.raid.time = 0.01; });
  await a.page.waitForFunction(() => window.__game.mode === 'stage');
  await b.page.waitForSelector('.contrib:has-text("철수")', { timeout: 10000 });
  assert(true, '철수 레이드 피해가 영희 화면 기여도에 표시');
  // 영희가 마무리: 남은 체력보다 큰 피해를 넣는다
  await b.page.click('text=⚔️ 공격하기');
  await b.page.waitForFunction(() => window.__game.mode === 'raid');
  await game(b.page, () => { window.__game.raid.damage = window.__game.mon.hp * 2; window.__game.raid.time = 0.01; });
  await a.page.waitForSelector('text=보상 받기', { timeout: 10000 });
  const gemsBefore = await game(a.page, () => window.__game.s.gems);
  await a.page.click('text=보상 받기');
  await a.page.waitForSelector('text=보상을 받았어요', { timeout: 10000 });
  const gemsAfter = await game(a.page, () => window.__game.s.gems);
  assert(gemsAfter === gemsBefore + 300, `레이드 처치 후 보상 수령 (💎 ${gemsBefore} → ${gemsAfter})`);
  await a.page.waitForSelector('.msg.system', { timeout: 10000 });
  assert(true, '처치 시스템 메시지');
  await a.page.screenshot({ path: path.join(OUT, '07-guild.png'), fullPage: false });
  await a.page.evaluate(() => document.querySelector('#panel').scrollTo(0, 99999));
  await a.page.screenshot({ path: path.join(OUT, '08-chat.png') });

  console.log('# 랭킹');
  await tab(b.page, 'rank');
  await b.page.waitForSelector('.rank-row:has-text("철수")', { timeout: 10000 });
  assert((await b.page.$$('.rank-row')).length === 2, '랭킹에 2명');
  await b.page.click('.rank-row:has-text("철수")');
  await b.page.waitForSelector('#modal h2:has-text("철수")');
  await b.page.screenshot({ path: path.join(OUT, '09-rank-profile.png') });
  assert(true, '친구 캐릭터 구경');

  const errs = [...a.errors, ...b.errors].filter((e) => !/favicon/.test(e));
  console.log('errors:', errs);
  assert(errs.length === 0, '콘솔 오류 없음');
  await browser.close();
  console.log('ALL OK');
})().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
