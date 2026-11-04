// v348 전체 화면 점검 — 폰(360·390·430)·컴퓨터(1366·1920)에서 창·칸을 모두 열어 본다.
//   잡는 것: 화면 밖으로 나간 단추 · 서로 겹친 단추 · 글자가 단추 밖으로 넘친 것 · 빈 창 · null/undefined/NaN 글자 · 콘솔 오류
//   NO_PROXY=127.0.0.1,localhost PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=/opt/pw-browsers/chromium node tests/sweep.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
const OUT = path.join(__dirname, 'shots', 'sweep'); fs.mkdirSync(OUT, { recursive: true });
const SIZES = process.env.SIZE ? [process.env.SIZE.split('x').map(Number)] : [[360, 740], [390, 844], [430, 932], [1366, 768], [1920, 1080]];
let fails = 0;
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [W, H] of SIZES) {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_FAILED|Cloud Firestore/.test(m.text())) errs.push(m.text()); });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route(/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/, (r) => r.abort());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.char-card', { timeout: 20000 });
    await page.click('.char-card.empty >> nth=0');
    await page.fill('#modal input', '점검'); await page.click('#modal .btn.primary');
    await page.waitForSelector('.class-card'); await page.click('.class-card >> nth=0');
    await page.waitForSelector('#modal .cust-go'); await page.click('#modal .cust-go');
    await page.evaluate(() => { const g = window.__game; g.attend(); g.s.level = 90; g.s.jobTier = 3; g.s.gold = 50001224; g.s.quest = 999; g.s.potions = 200; g._stats = null; g.enterMap(31); window.__app.refresh(); });
    await page.waitForTimeout(1500);
    const probs = [];
    const check = async (where) => {
      if (process.env.DEBUG) console.log('  …', where);
      const r = await page.evaluate(() => {
        const vw = innerWidth, vh = innerHeight, out = [];
        const vis = (e) => { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
        const panel = document.getElementById('panel');
        const scopes = [...document.querySelectorAll('#panel.open #panel-body, #modal:not(.hidden) .sheet, #tabs, #skillbar, #topbar')];
        for (const sc of scopes) {
          const box = sc.getBoundingClientRect();
          const btns = [...sc.querySelectorAll('button, .btn, .chip')].filter(vis);
          for (const e of btns) {
            const r = e.getBoundingClientRect();
            const name = (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 16) || e.className;
            if (r.left < -1 || r.right > vw + 1) out.push(`화면 밖(가로): ${name}`);
            if (sc.id !== 'panel-body' && sc.className !== 'sheet' && (r.top < -1 || r.bottom > vh + 1)) out.push(`화면 밖(세로): ${name}`);
            // 글자가 단추 밖으로(줄임 없이) 넘침
            if (e.scrollWidth > e.clientWidth + 4 && getComputedStyle(e).overflow === 'visible' && e.clientWidth > 0) out.push(`글자 넘침: ${name} (${e.scrollWidth}>${e.clientWidth})`);
          }
          // 같은 줄(같은 부모)의 단추끼리 겹침 — 부모별로 묶어 그 안에서만 견준다(전부 견주면 창마다 수백만 번이라 너무 느렸다)
          const groups = new Map();
          for (const e of btns.slice(0, 400)) { const k = e.parentElement; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
          for (const g of groups.values()) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
            const a = g[i], c = g[j];
            if (a.contains(c) || c.contains(a)) continue;
            const A = a.getBoundingClientRect(), C = c.getBoundingClientRect();
            const ox = Math.min(A.right, C.right) - Math.max(A.left, C.left), oy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
            if (ox > 6 && oy > 6) out.push(`겹침: ${(a.textContent || a.className).trim().slice(0, 12)} / ${(c.textContent || c.className).trim().slice(0, 12)}`);
          }
        }
        // 위 정보칸 — 은자 그림이 숫자를 덮지 않는다 · 경험치 줄 글자가 잘리지 않는다
        { const c = document.querySelector('.res-silver .cur')?.getBoundingClientRect(), gd = document.getElementById('gold')?.getBoundingClientRect(); if (c && gd && c.right > gd.left + 2) out.push('은자 그림이 숫자를 덮음'); }
        { const hs = document.querySelector('.hero-sub'); if (hs) for (const e of hs.children) { const r = e.getBoundingClientRect(), p = hs.getBoundingClientRect(); if (getComputedStyle(e).display !== 'none' && r.width > 0 && r.right > p.right + 1) out.push(`위 정보칸 잘림: ${e.id}`); } }
        const txt = (panel?.classList.contains('open') ? document.getElementById('panel-body').innerText : '') + (document.querySelector('#modal:not(.hidden) .sheet')?.innerText || '');
        const raw = txt.match(/(^|[^a-zA-Z])(null|undefined|NaN|\[object Object\])(?![a-zA-Z])/g);
        if (raw) out.push(`날 값: ${raw.join(',')}`);
        if (panel?.classList.contains('open') && document.getElementById('panel-body').innerText.trim().length < 8) out.push('빈 창');
        return [...new Set(out)];
      });
      if (r.length) { probs.push(`${where}: ${r.join(' · ')}`); console.log(`  ✗ ${W} ${where}: ${r.join(' · ')}`); }
    };
    await check('들판');
    const tabs = await page.$$eval('#tabs button[data-tab]', (bs) => bs.map((x) => x.dataset.tab));
    for (const t of tabs) {
      if (t === 'town') continue;
      await page.evaluate((x) => window.__app.showTab(x), t); await page.waitForTimeout(450);
      const subs = await page.$$eval('#panel .subtabs button[data-key]', (bs) => bs.map((x) => x.dataset.key));
      for (const s of (subs.length ? subs : [null])) {
        if (s) { await page.click(`#panel .subtabs button[data-key="${s}"]`).catch(() => {}); await page.waitForTimeout(350); }
        await check(`${t}/${s || '-'}`);
        if (W === 390 || W === 1366) await page.screenshot({ path: path.join(OUT, `${W}-${t}-${s || 'main'}.png`) });
      }
    }
    await page.evaluate(() => { window.__app.closePanel(); window.__game.goTown(false); window.__app.showTab('town'); }); await page.waitForTimeout(500);
    for (const s of await page.$$eval('#panel .subtabs button[data-key]', (bs) => bs.map((x) => x.dataset.key))) {
      await page.click(`#panel .subtabs button[data-key="${s}"]`).catch(() => {}); await page.waitForTimeout(300); await check(`town/${s}`);
    }
    await page.evaluate(() => window.__app.closePanel());
    // 창 몇 개 — 설정 · 꾸미기 · 무인 고르기 · 장비 자세히
    await page.click('#btn-settings').catch(() => {}); await page.waitForTimeout(400); await check('설정');
    await page.evaluate(async () => (await import('/js/ui/common.js')).closeModal()); await page.waitForTimeout(250);
    await page.click('#portrait').catch(() => {}); await page.waitForTimeout(500); await check('꾸미기');
    await page.evaluate(async () => (await import('/js/ui/common.js')).closeModal()); await page.waitForTimeout(250);
    await page.evaluate(() => { window.__test_charSelect(); }); await page.waitForTimeout(500); await check('무인 고르기');
    await page.evaluate(async () => (await import('/js/ui/common.js')).closeModal()); await page.waitForTimeout(250);
    await page.evaluate(() => window.__app.showTab('bag', 'gear')); await page.waitForTimeout(400);
    await page.locator('#panel .eq-card, #panel .gear-card, #panel [class*="eq"]').first().click().catch(() => {});
    await page.waitForTimeout(500); await check('장비 자세히');
    if (errs.length) probs.push(`콘솔 오류: ${errs.slice(0, 3).join(' | ')}`);
    console.log(`# ${W}x${H} — ${probs.length ? `${probs.length}곳` : '깨끗'}`);
    fails += probs.length;
    await page.close();
  }
  await b.close();
  console.log(fails ? `${fails}곳 문제` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
