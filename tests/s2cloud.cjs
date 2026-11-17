// v525 새 시즌 서버 저장 — 두 기기 시험 (에뮬레이터 필요, tests/cloud.cjs와 같은 준비)
//   기기 A: 무인 고르기 → 익명 연결 → 레벨 올림 → Google 잇기(가짜 토큰) → 서버에 올림
//   기기 B: 새 기기(빈 저장) → 무인 고르기 → 같은 Google 잇기 → 겹침 → 그 계정으로 → A의 진행을 받아 다시 열림
//   + 저장 코드: A에서 복사한 코드를 C(빈 기기)에 붙여 넣으면 같은 진행
const path = require('path'); const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const PKG = process.env.FIREBASE_PKG; const BASE = (process.env.BASE || 'http://localhost:8123/') + 'index.html?emu=1';
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓', m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RUN = Date.now();
const TOKEN = JSON.stringify({ sub: 'g-s2-' + RUN, email: `s2t${RUN}@example.com`, email_verified: true });
// v536 처음 들어오면 출석 창이 뜬다 — 「나중에」로 닫는다
async function skipAttend(pg) { try { await pg.waitForSelector('#modal:not(.hidden) .attg', { timeout: 3000 }); await pg.click('#modal .btn:has-text("나중에")'); } catch { /* 안 뜸 */ } }
async function device(b) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PKG, path.basename(new URL(r.request().url()).pathname))) }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal .jobcard');
  await page.click('#modal .jobcard >> nth=0');
  await skipAttend(page);
  await page.waitForFunction(() => window.__s2?.net?.online, null, { timeout: 20000 });
  return { ctx, page, errs };
}
(async () => {
  if (!PKG) throw new Error('FIREBASE_PKG 필요');
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const A = await device(b);
  assert(await A.page.evaluate(() => !!window.__s2.net.uid), 'A: 익명 계정으로 연결');
  await A.page.evaluate(() => { const g = window.__s2.g; g.S.hero.lv = 37; g.S.wallet.gold = 123456; });
  assert(await A.page.evaluate((t) => window.__s2.linkTest(t), TOKEN) === 'linked', 'A: Google 잇기 → 서버에 올림');
  const at = await A.page.evaluate(() => window.__s2.net.cloudAt);
  assert(at > 0, 'A: 서버 저장 시각');
  // v547 서열 — 프로필 · 월드보스 주간 점수가 서버에 올라가고 위 몇 명에 보인다 · 화면
  await A.page.evaluate(() => { window.__s2.g.setNick('시험무인'); window.__s2.net.lastProfile = null; window.__s2.rankPush(); window.__s2.wbPush(12345); });
  await sleep(1500);
  const rk = await A.page.evaluate(async () => { const n = window.__s2.net, wk = window.__s2.wkStr(Date.now()); const p = await n.top('power', wk, 50), w = await n.top('wb', wk, 50); return { p: p.rows.find((r) => r.uid === n.uid), w: w.rows.find((r) => r.uid === n.uid), me: p.me }; });
  assert(rk.p && rk.p.nickname === '시험무인' && rk.p.lv === 37 && rk.me >= 1, 'A: 서열 프로필이 올라가 위 목록에 보임');
  assert(rk.w && rk.w.score === 12345 && rk.w.tries === 1, 'A: 월드보스 주간 점수 올라감');
  await A.page.click('[data-tab="social"] >> nth=0'); await A.page.click('#panel-body .subtabs button:has-text("서열")'); await sleep(1500);
  assert(await A.page.isVisible('#wb .rk-r.me') && /내 등수|시험무인/.test(await A.page.textContent('#wb')), 'A: 무림 → 서열 화면(내 줄)');
  await A.page.click('#panel-close');
  await A.page.click('#b-opt');
  assert(/Google · s2t\d+@example\.com/.test(await A.page.textContent('#wb')), 'A: 설정 「계정 · 저장」에 Google 표시');
  await A.page.click('#panel-close');
  // 저장 코드 복사
  await A.page.evaluate(() => navigator.clipboard.writeText(''));
  await A.page.click('#b-opt'); await A.page.click('#wb .row:has-text("저장 코드") .btn:has-text("복사")'); await sleep(400);
  const code = await A.page.evaluate(() => navigator.clipboard.readText());
  assert(/^IFU1\./.test(code), 'A: 저장 코드 복사');

  const B = await device(b);
  const uidB = await B.page.evaluate(() => window.__s2.net.uid);
  assert(uidB && uidB !== (await A.page.evaluate(() => window.__s2.net.uid)), 'B: 새 기기는 다른 익명 계정');
  const nav = B.page.waitForNavigation({ timeout: 20000 });
  assert(await B.page.evaluate((t) => window.__s2.linkTest(t), TOKEN) === 'switched', 'B: 같은 Google → 그 계정으로 바꿈');
  await nav; await B.page.waitForFunction(() => window.__s2?.g, null, { timeout: 20000 });
  assert(await B.page.evaluate(() => window.__s2.g.S.hero.lv) === 37 && await B.page.evaluate(() => window.__s2.g.S.wallet.gold) >= 123456, 'B: A의 진행(Lv.37 · 은자)을 받아 다시 열림');

  // C: 저장 코드로
  const ctxC = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' });
  await ctxC.route(/gstatic\.com/, (r) => r.abort());
  const C = await ctxC.newPage(); const errC = []; C.on('pageerror', (e) => errC.push(e.message));
  await C.goto(BASE.replace('?emu=1', ''), { waitUntil: 'domcontentloaded' }); await C.waitForSelector('#modal .jobcard'); await C.click('#modal .jobcard >> nth=1'); await skipAttend(C);
  await C.click('#b-opt'); await C.click('#wb .row:has-text("저장 코드") .btn:has-text("붙여넣기")');
  await C.fill('#codein', code);
  const navC = C.waitForNavigation({ timeout: 10000 });
  await C.click('#modal .btn:has-text("불러오기")'); await navC; await C.waitForFunction(() => window.__s2?.g); await skipAttend(C);
  assert(await C.evaluate(() => window.__s2.g.S.hero.lv) === 37, 'C: 저장 코드 붙여넣기 → 같은 진행');
  // 망가진 코드는 그대로
  await C.click('#b-opt'); await C.click('#wb .row:has-text("저장 코드") .btn:has-text("붙여넣기")');
  await C.fill('#codein', 'IFU1.garbage'); await C.click('#modal .btn:has-text("불러오기")'); await sleep(300);
  assert(await C.evaluate(() => window.__s2.g.S.hero.lv) === 37, 'C: 망가진 코드는 받지 않음');

  const errs = [...A.errs, ...B.errs, ...errC];
  assert(errs.length === 0, '페이지 오류 없음 ' + errs.join(' | '));
  await b.close();
  console.log('✓ 새 시즌 서버 저장');
})().catch((e) => { console.error(e); process.exit(1); });
