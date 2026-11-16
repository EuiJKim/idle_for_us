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
async function device(b) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block', permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route('https://www.gstatic.com/firebasejs/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PKG, path.basename(new URL(r.request().url()).pathname))) }));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal .jobcard');
  await page.click('#modal .jobcard >> nth=0');
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
  await C.goto(BASE.replace('?emu=1', ''), { waitUntil: 'domcontentloaded' }); await C.waitForSelector('#modal .jobcard'); await C.click('#modal .jobcard >> nth=1');
  await C.click('#b-opt'); await C.click('#wb .row:has-text("저장 코드") .btn:has-text("붙여넣기")');
  await C.fill('#codein', code);
  const navC = C.waitForNavigation({ timeout: 10000 });
  await C.click('#modal .btn:has-text("불러오기")'); await navC; await C.waitForFunction(() => window.__s2?.g);
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
