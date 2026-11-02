// v281 설치 안내 페이지 · 카카오톡 자동 넘기기
// PLAYWRIGHT=… CHROMIUM=… node tests/install.cjs   (http://localhost:8123 에서 정적 서버가 돌고 있어야 한다)
// SHOTS=폴더 를 주면 화면을 찍어 둔다.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path');
const BASE = process.env.URL || 'http://localhost:8123/';
const SHOTS = process.env.SHOTS || '';
const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  kakaoA: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 KAKAOTALK/10.6.2 (INAPP)',
  kakaoI: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.6.2',
  insta: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0',
  pc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};
let fails = 0;
const ok = (c, m) => { console.log(`  ${c ? '✓' : '✗ !!'} ${m}`); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  async function open(ua, url, mobile = true) {
    const ctx = await browser.newContext({ userAgent: UA[ua], viewport: mobile ? { width: 390, height: 844 } : { width: 1100, height: 900 }, isMobile: mobile && ua !== 'pc', serviceWorkers: 'block' });
    const p = await ctx.newPage();
    await p.addInitScript(() => { window.__noJump = true; });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    // 카카오톡 주소(kakaotalk://)로 가려는 것을 붙잡는다 — 실제로 열 수는 없으니 기록만
    const jumps = [];
    p.on('request', (r) => { if (/^(kakaotalk|intent):/.test(r.url())) jumps.push(r.url()); });
    await p.route(/fonts\.|gstatic\.com\/firebasejs/, (r) => r.abort());
    await p.goto(BASE + url, { waitUntil: 'load' }).catch(() => {});
    await p.waitForTimeout(600);
    return { ctx, p, errors, jumps };
  }
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };

  console.log('# 안드로이드 크롬');
  { const { ctx, p, errors } = await open('android', 'install.html');
    ok(await p.isVisible('#p-android') && !(await p.isVisible('#p-ios')), '안드로이드 방법이 먼저');
    ok(!(await p.isVisible('#s-inapp')), '앱 안 브라우저 경고 없음');
    ok(await p.getAttribute('#btn-play', 'href') === './', '바로 하기 → 게임');
    ok(errors.length === 0, `오류 없음 ${errors.join(' | ')}`);
    await shot(p, 'install-android'); await ctx.close(); }

  console.log('# 아이폰 사파리');
  { const { ctx, p, errors } = await open('ios', 'install.html');
    ok(await p.isVisible('#p-ios') && !(await p.isVisible('#p-android')), '아이폰 방법이 먼저');
    await p.click('#tab-android'); ok(await p.isVisible('#p-android'), '탭으로 안드로이드 방법도 본다');
    await p.click('#tab-ios');
    ok(errors.length === 0, '오류 없음');
    await shot(p, 'install-ios'); await ctx.close(); }

  console.log('# 카카오톡(안드로이드) — 설치 페이지');
  { const { ctx, p, errors } = await open('kakaoA', 'install.html');
    const ext = await p.evaluate(() => window.__ext);
    ok(/^kakaotalk:\/\/web\/openExternal\?url=/.test(ext || '') && decodeURIComponent(ext.split('url=')[1]).endsWith('/install.html'), '바깥 브라우저로 설치 페이지를 연다', ext);
    ok(await p.evaluate(() => sessionStorage.getItem('ifu.kakaoJump')) === '1', '한 번만 저절로 넘긴다');
    ok(await p.isVisible('#s-inapp') && (await p.textContent('#inapp-name')) === '카카오톡', '카카오톡 안내 카드');
    ok(await p.isVisible('#inapp-auto'), '"바깥 브라우저로 열었어요" 안내');
    ok(await p.getAttribute('#btn-play', 'href') === './?stay=1', '그냥 카카오톡 안에서 하기 → ?stay=1');
    ok(errors.length === 0, '오류 없음');
    await shot(p, 'install-kakao'); await ctx.close(); }

  console.log('# 카카오톡 — 게임 주소로 열면');
  { const { ctx, p } = await open('kakaoI', '');
    await p.waitForTimeout(400);
    ok(/install\.html\?to=game$/.test(p.url()), '설치 안내로 보낸다', p.url());
    const ext = await p.evaluate(() => window.__ext);
    ok(/\/$/.test(decodeURIComponent((ext || '').split('url=')[1] || '')), '바깥 브라우저에선 게임으로 바로', ext);
    await ctx.close(); }
  { const { ctx, p } = await open('kakaoA', '?stay=1');
    await p.waitForTimeout(400);
    ok(!/install\.html/.test(p.url()), '?stay=1 이면 카카오톡 안에서 그대로 한다');
    await ctx.close(); }

  console.log('# 인스타그램(아이폰)');
  { const { ctx, p, jumps } = await open('insta', 'install.html');
    ok(await p.isVisible('#s-inapp') && await p.isVisible('#inapp-ios'), '"··· → Safari로 열기" 안내');
    ok(!(await p.evaluate(() => window.__ext)) && jumps.length === 0, '저절로 넘기지 않는다(넘길 방법이 없다)');
    await ctx.close(); }

  console.log('# 일반 브라우저 · PC');
  { const { ctx, p } = await open('android', '');
    await p.waitForTimeout(400);
    ok(!/install\.html/.test(p.url()), '일반 브라우저로 게임을 열면 그대로');
    await ctx.close(); }
  { const { ctx, p, errors } = await open('pc', 'install.html', false);
    ok(/휴대폰 카메라로 찍으세요/.test(await p.textContent('#qr-text')), 'PC에선 QR을 찍으라고 안내');
    ok(await p.evaluate(() => { const i = document.querySelector('.qr img'); return i.complete && i.naturalWidth > 100; }), 'QR 그림이 뜬다');
    ok(errors.length === 0, '오류 없음');
    await shot(p, 'install-pc'); await ctx.close(); }

  await browser.close();
  console.log(fails ? `!! ${fails}개 실패` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
