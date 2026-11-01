// v265 Google 계정 · 서버 저장 — 두 기기 시험 (에뮬레이터 필요)
//   1) 정적 서버: npx http-server -p 8123 -s -c-1 .
//   2) 에뮬레이터: firebase emulators:start --only auth,firestore,database --project idle-69772
//   3) NO_PROXY=127.0.0.1,localhost FIREBASE_PKG=/path/to/node_modules/firebase PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=... node tests/cloud.cjs
// 팝업 대신 에뮬레이터가 받아 주는 가짜 Google id 토큰(JSON 글자)으로 잇는다(window.__test_linkGoogle).
const path = require('path'); const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PKG = process.env.FIREBASE_PKG; const BASE = process.env.BASE || 'http://localhost:8123/';
const OUT = process.env.OUT || path.join(__dirname, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TOKEN = JSON.stringify({ sub: 'g-test-1', email: 'tester@example.com', email_verified: true });
async function ctxPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED|Cloud Firestore backend/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PKG, path.basename(new URL(r.request().url()).pathname))) }));
  return { ctx, page, errors };
}
async function newPlayer(browser, name) {
  const o = await ctxPage(browser);
  await o.page.goto(BASE + '?emu=1');
  await o.page.waitForSelector('#login-guest', { timeout: 20000 });
  assert(await o.page.isVisible('#login-google'), '로그인 화면(Google · 손님)');
  await o.page.click('#login-guest');
  await o.page.fill('#modal input', name); await o.page.click('#modal .btn.primary');
  await o.page.waitForSelector('.class-card'); await o.page.click('.class-card:has-text("검사")');
  await o.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 });
  await sleep(500);
  return o;
}
const C = (p) => p.evaluate(() => window.__test_cloud());
(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/idle-69772/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/idle-69772/accounts', { method: 'DELETE' });
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  console.log('# A: 익명 → Google 잇기');
  const A = await newPlayer(browser, '갑돌');
  let a0 = await C(A.page); assert(!a0.google, '처음엔 익명');
  // 설정 줄
  await A.page.click('#btn-settings'); await A.page.waitForSelector('#modal h2:has-text("설정")');
  await A.page.evaluate(() => [...document.querySelectorAll('#modal *')].find((x) => x.childElementCount < 3 && /앱·계정/.test(x.textContent))?.click());
  assert(await A.page.isVisible('#modal .row:has-text("Google 계정 연결")'), '설정에 Google 계정 연결 줄');
  await A.page.click('#modal button:has-text("닫기")');
  await A.page.evaluate((t) => window.__test_linkGoogle(t), TOKEN);
  await sleep(1500);
  let a1 = await C(A.page);
  assert(a1.google && a1.uid === a0.uid, 'Google을 이어도 uid 그대로');
  assert(a1.ok && a1.at > 0, '서버에 세이브를 올림');
  await A.page.evaluate(() => { window.__game.s.level = 30; window.__save(); });
  assert(await A.page.evaluate(() => window.__test_cloudPush()), '레벨 30으로 다시 올림');
  // 새로 고침해도 Google 그대로(새 익명 안 만듦)
  await A.page.reload(); await A.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 }); await sleep(1500);
  let a2 = await C(A.page); assert(a2.google && a2.uid === a0.uid, '새로 고침 후에도 Google 계정 그대로');
  assert(!(await A.page.isVisible('#login-google')) && !(await A.page.isVisible('#boot-login')), 'Google로 들어온 뒤엔 로그인 화면이 다시 안 뜸');
  assert(!(await A.page.isVisible('#modal h2:has-text("다른 기기의 진행")')), '내가 올린 것만 있으면 묻지 않음');

  console.log('# B: 다른 기기 — 같은 Google로');
  const B = await newPlayer(browser, '을순');
  const b0 = await C(B.page); assert(b0.uid !== a0.uid, 'B는 다른 익명 계정');
  await B.page.evaluate((t) => window.__test_linkGoogle(t), TOKEN);
  await B.page.waitForSelector('#modal h2:has-text("이미 다른 진행에 이어진 계정")', { timeout: 8000 });
  assert(true, '이미 이어진 Google — 바꿀지 묻는다');
  await Promise.all([B.page.waitForNavigation({ timeout: 15000 }), B.page.click('#modal button:has-text("그 진행으로 바꾸기")')]);
  await B.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 }); await sleep(2000);
  const b1 = await C(B.page);
  const bl = await B.page.evaluate(() => ({ lv: window.__game.s.level, nick: window.__game.s.nickname }));
  assert(b1.uid === a0.uid && b1.google, 'B가 A의 계정(uid)으로 바뀜');
  assert(bl.lv === 30 && bl.nick === '갑돌', 'B가 서버 진행(Lv30·갑돌)을 이어받음');
  assert(!(await B.page.isVisible('#modal h2:has-text("다른 기기의 진행")')), '불러온 직후엔 다시 묻지 않음');
  await B.page.evaluate(() => { window.__game.s.level = 41; window.__save(); });
  assert(await B.page.evaluate(() => window.__test_cloudPush()), 'B에서 Lv41로 올림');
  // 버려진 익명 B는 서열에서 내려감
  const old = await fetch(`http://127.0.0.1:8080/v1/projects/idle-69772/databases/(default)/documents/players/${b0.uid}`, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
  assert(old.fields?.world?.integerValue === '0', '버린 익명 계정은 서열에서 내림(world 0)');

  console.log('# A 다시 — 다른 기기가 더 최근에 올렸다');
  await A.page.reload(); await A.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 });
  await A.page.waitForSelector('#modal h2:has-text("다른 기기의 진행")', { timeout: 10000 });
  const txt = await A.page.textContent('#modal');
  assert(/서버 · Lv 41/.test(txt) && /이 기기 · Lv 30/.test(txt), '두 진행(서버 Lv41 · 이 기기 Lv30)을 보여 줌');
  assert(!(await A.page.evaluate(() => window.__test_cloud().ok)), '고르기 전엔 올리지 않음');
  await Promise.all([A.page.waitForNavigation({ timeout: 15000 }), A.page.click('#modal button:has-text("서버 진행 불러오기")')]);
  await A.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 }); await sleep(1500);
  assert((await A.page.evaluate(() => window.__game.s.level)) === 41, 'A가 Lv41을 불러옴');
  assert(await A.page.evaluate(() => !!localStorage.getItem('ifu-world-v1.beforeCloud')), '불러오기 전 진행은 백업으로 남김');
  // 설정 줄: Google 계정
  await A.page.click('#btn-settings'); await A.page.waitForSelector('#modal h2:has-text("설정")');
  await A.page.evaluate(() => [...document.querySelectorAll('#modal *')].find((x) => x.childElementCount < 3 && /앱·계정/.test(x.textContent))?.click());
  assert(await A.page.isVisible('#modal .row:has-text("tester@example.com")'), '설정에 Google 계정 이메일');
  await sleep(800); await A.page.evaluate(() => [...document.querySelectorAll('#modal .row')].find((r) => r.textContent.includes('Google'))?.scrollIntoView({ block: 'center' })); await sleep(300); await A.page.screenshot({ path: path.join(OUT, 'cloud-settings.png') });
  console.log('# C: 새 기기 — 로그인 화면에서 바로 Google');
  const Cc = await ctxPage(browser);
  await Cc.page.goto(BASE + '?emu=1');
  await Cc.page.waitForSelector('#login-google', { timeout: 20000 });
  assert((await Cc.page.textContent('#boot-msg')).length >= 0 && await Cc.page.isVisible('#boot .boot-title'), '로딩 화면 제목');
  await Promise.all([Cc.page.waitForNavigation({ timeout: 15000 }), Cc.page.evaluate((t) => window.__test_loginGoogle(t), TOKEN)]);
  await Cc.page.waitForFunction(() => document.querySelector('#net-badge')?.textContent.includes('온라인'), null, { timeout: 20000 }); await sleep(1500);
  assert(!(await Cc.page.isVisible('#login-google')), '불러온 뒤엔 로그인 화면 없음');
  assert((await Cc.page.evaluate(() => window.__game.s.level)) === 41 && (await C(Cc.page)).uid === a0.uid, '새 기기가 묻지 않고 서버 진행(Lv41)을 불러옴');
  // 로그아웃 → 다시 로그인 화면
  await Cc.page.click('#btn-settings'); await Cc.page.waitForSelector('#modal h2:has-text("설정")');
  await Cc.page.evaluate(() => [...document.querySelectorAll('#modal *')].find((x) => x.childElementCount < 3 && /앱·계정/.test(x.textContent))?.click());
  await Promise.all([Cc.page.waitForNavigation({ timeout: 15000 }), Cc.page.click('#modal .row:has-text("로그아웃") button')]);
  await Cc.page.waitForSelector('#login-google', { timeout: 20000 });
  const cs = await Cc.page.evaluate(() => ({ g: window.__test_cloud().google, save: !!localStorage.getItem('ifu-world-v1') }));
  assert(!cs.g, '로그아웃하면 익명으로 돌아가 로그인 화면이 뜸');
  // 손님으로 고르면 다음엔 안 뜬다
  await Cc.page.click('#login-guest');
  await Cc.page.waitForSelector('#modal input'); await Cc.page.fill('#modal input', '병철'); await Cc.page.click('#modal .btn.primary');
  await Cc.page.waitForSelector('.class-card'); await Cc.page.click('.class-card:has-text("검사")'); await sleep(800);
  await Cc.page.reload(); await Cc.page.waitForFunction(() => document.querySelector('#boot')?.classList.contains('out'), null, { timeout: 20000 });
  assert(!(await Cc.page.isVisible('#login-google')), '손님을 고른 뒤엔 다시 안 뜸');
  await Cc.ctx.close();

  // 규칙: 남의 세이브는 못 읽고 못 쓴다
  const anon = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' }).then((r) => r.json());
  const docUrl = `http://127.0.0.1:8080/v1/projects/idle-69772/databases/(default)/documents/saves/${a0.uid}`;
  const rd = await fetch(docUrl, { headers: { Authorization: `Bearer ${anon.idToken}` } });
  assert(rd.status === 403, '남의 세이브는 못 읽음(규칙)');
  const wr = await fetch(docUrl, { method: 'PATCH', headers: { Authorization: `Bearer ${anon.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { data: { stringValue: '{}' }, at: { integerValue: '1' }, dev: { stringValue: 'x' }, lv: { integerValue: '1' }, build: { stringValue: 'x' } } }) });
  assert(wr.status === 403, '남의 세이브는 못 씀(규칙)');
  console.log('errors A', A.errors, 'B', B.errors);
  assert(A.errors.length === 0 && B.errors.length === 0, '콘솔 오류 없음');
  await browser.close(); console.log('ALL OK');
})().catch((e) => { console.error(e); process.exit(1); });
