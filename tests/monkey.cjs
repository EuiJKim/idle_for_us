// v437 브라우저 몽키 봇 — 진짜 화면에서 아무 단추나 누른다 (오프라인)
//   1) 정적 서버:  npx http-server -p 8123 -s -c-1 .
//   2) node tests/monkey.cjs                 (기본: 새 무인 · 늦은 무인 각 90초)
//      SECS=600 SEED=3 node tests/monkey.cjs (길게 · 다른 씨앗)
//   본다: 화면 오류(pageerror · console.error) · 화면 글에 「undefined」「NaN」「[object Object]」 · 불변식(tests/inv.mjs) · 앱이 사라짐
//   깨지면: tests/shots/monkey/<판>-<n>.png · .json(세이브 · 직전에 누른 것 20개) — 세이브는 tests/replay.cjs 로 다시 연다
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const SECS = Number(process.env.SECS) || 90;
const SEED = Number(process.env.SEED) || 20261107;
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'monkey');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

// 누르지 않는 것 — 계정·기기·되돌릴 수 없는 것 · 밖으로 나가는 것
const SKIP = /로그아웃|나가기\b.*로그|지우기|삭제|처음부터|새로 시작|전체 화면|전체화면|설치|Google|구글|저장 코드|코드로|불러오|내려받|받기 \(|신고|무인 바꾸기|캐릭터 바꾸기|무인 고르기|체험|다른 기기|복사|공유|서버에서 받|서버 세이브|되돌리기 \(|직업 바꾸기|운영자/;
const NOISE = /Failed to load resource|ERR_FAILED|ERR_ABORTED|Could not reach Cloud Firestore backend|firebase|net::/i;
const BADTXT = /\bundefined\b|\bNaN\b|\[object Object\]|Infinity/;

async function boot(browser, name, prof) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => {   // 확인 창은 반반 · 몇 개 묻는 창은 작은 수
    const t = d.type();
    if (t === 'prompt') return d.accept(String(1 + Math.floor(Math.random() * 3))).catch(() => {});
    return (Math.random() < 0.5 ? d.accept() : d.dismiss()).catch(() => {});
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#modal input, #login-guest, .char-card', { timeout: 20000 });
  if (await page.isVisible('#login-guest')) await page.click('#login-guest');
  await page.waitForSelector('#modal input, .char-card', { timeout: 10000 });
  if (await page.isVisible('.char-card.empty')) await page.click('.char-card.empty >> nth=0');
  await page.fill('#modal input', name);
  await page.click('#modal .btn.primary');
  await page.waitForSelector('.class-card');
  const cls = await page.$$eval('.class-card', (bs) => bs.length);
  await page.click(`.class-card >> nth=${Math.floor(Math.random() * cls)}`);
  await page.waitForSelector('#modal .cust-go', { timeout: 5000 });
  await page.click('#modal .cust-go');
  await page.evaluate(() => window.__game.attend());
  if (prof === 'late') {
    // 늦은 무인 — 레벨 150 · 3차 · 돈·재료 넉넉(던전·강화·각인·뽑기 단추가 다 살아 있게)
    await page.evaluate(() => {
      const g = window.__game, s = g.s;
      s.level = 150; s.skillPts = 200; s.statPts = 400; s.gold = 1e12; s.potions = 50; s.prot = 50;
      for (const k of Object.keys(s.mats || {})) s.mats[k] = Math.max(s.mats[k] || 0, 5000);
      s.mats.ore = 1e6;
      while (g.canAdvance()) g.advance();
      g._stats = null; g.heroHp = g.stats().hp;
      g.events.length = 0;
    });
  }
  await page.evaluate(() => { try { window.__app.closeModal?.(); } catch { /* */ } });
  return { ctx, page, errs };
}

// 지금 누를 수 있는 것들(맨 위에 보이는 것만)
const CANDS = () => {
  const sel = '#tabs button, #panel button, #panel .chip, #panel [role=button], #panel input[type=checkbox], #panel .item-cell, #panel .slot, #modal button, #modal input[type=checkbox], #modal .chip, #hud button, #topbar button, #skillbar button, #quest, #advice, #gather .g-go, #btn-boss, #go-hunt, #panel-close, #stagebar';
  const out = [];
  const els = [...document.querySelectorAll(sel)];
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.disabled || el.closest('.hidden') || el.closest('[hidden]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
    const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2)), y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
    const top = document.elementFromPoint(x, y);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) continue;
    const t = (el.getAttribute('aria-label') || el.textContent || el.id || el.className || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const where = el.closest('#modal') ? 'modal' : el.closest('#panel') ? 'panel' : el.closest('#tabs') ? 'tabs' : 'hud';
    out.push({ i, x, y, t, where });
  }
  return out;
};

// 화면 글에서 깨진 값 찾기 — 어느 칸인지 같이
const BADSCAN = (re) => {
  const rx = new RegExp(re);
  const hits = [];
  for (const root of ['#panel-body', '#modal', '#hud', '#topbar', '#toast', '#stagebar', '#quest', '#advice', '#skillbar', '#gather']) {
    const el = document.querySelector(root);
    if (!el || el.classList.contains('hidden')) continue;
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest('.hidden') || p.closest('textarea') || p.closest('script')) continue;
      if (rx.test(n.textContent)) hits.push(`${root}: …${n.textContent.trim().slice(0, 90)}…`);
    }
    for (const a of el.querySelectorAll('[title],[aria-label]')) { const v = (a.getAttribute('title') || '') + ' ' + (a.getAttribute('aria-label') || ''); if (rx.test(v)) hits.push(`${root} 속성: ${v.trim().slice(0, 90)}`); }
  }
  return [...new Set(hits)].slice(0, 5);
};

async function run(browser, prof, r) {
  const { ctx, page, errs } = await boot(browser, prof === 'late' ? '늦은원숭이' : '새원숭이', prof);
  const trail = [];
  const found = new Map();   // 같은 문제는 한 번만
  let clicks = 0, n = 0;
  const report = async (kind, detail) => {
    const key = `${kind}|${String(detail).slice(0, 120)}`;
    if (found.has(key)) return;
    n++;
    const base = path.join(OUT, `${prof}-${n}`);
    let save = null; try { save = await page.evaluate(() => JSON.stringify(window.__game.toJSON())); } catch { /* */ }
    await page.screenshot({ path: base + '.png' }).catch(() => {});
    fs.writeFileSync(base + '.json', JSON.stringify({ kind, detail, trail: trail.slice(-20), save }, null, 1));
    found.set(key, { kind, detail, trail: trail.slice(-6), file: base });
    console.log(`  ✗ [${prof}] ${kind}: ${String(detail).split('\n').slice(0, 3).join(' / ')}\n      직전: ${trail.slice(-5).join(' → ')}\n      → ${base}.png/.json`);
  };
  const t0 = Date.now();
  let lastInv = 0;
  const watch = 'window.__monkeyWatch = window.__monkeyWatch || new Map()';
  while (Date.now() - t0 < SECS * 1000) {
    const roll = r();
    let did = '';
    try {
      if (roll < 0.06) {   // 단축키
        const k = ['1', '2', '3', '4', '5', 'q', 'f', 'h', 'm', 'b', 'c', 'r', 'Escape'][Math.floor(r() * 13)];
        await page.keyboard.press(k); did = `키 ${k}`;
      } else if (roll < 0.12) {   // 들판 누르기
        const x = 20 + r() * 350, y = 150 + r() * 350;
        await page.mouse.click(x, y); did = `들판 ${Math.round(x)},${Math.round(y)}`;
      } else if (roll < 0.15) {   // 창 머리 쓸기
        const y = 300 + r() * 50, dir = r() < 0.5 ? -1 : 1;
        await page.evaluate(([y0, d]) => { const el = document.querySelector('#panel-head') || document.body; const mk = (t, x) => new TouchEvent(t, { bubbles: true, cancelable: true, touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: y0 })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y0 })] }); el.dispatchEvent(mk('touchstart', 195)); el.dispatchEvent(mk('touchmove', 195 + d * 120)); el.dispatchEvent(mk('touchend', 195 + d * 120)); }, [y, dir]).catch(() => {});
        did = `쓸기 ${dir > 0 ? '→' : '←'}`;
      } else {
        const cands = (await page.evaluate(CANDS)).filter((c) => !SKIP.test(c.t));
        if (cands.length) {
          // 창(panel·modal) 안을 더 자주 — 아래 창 단추만 누르면 깊이 못 들어간다
          const w = cands.map((c) => (c.where === 'modal' ? 4 : c.where === 'panel' ? 3 : c.where === 'tabs' ? 1 : 0.6));
          let x = r() * w.reduce((a, b) => a + b, 0), pick = cands[0];
          for (let i = 0; i < cands.length; i++) { x -= w[i]; if (x <= 0) { pick = cands[i]; break; } }
          await page.mouse.click(pick.x, pick.y);
          did = `${pick.where}「${pick.t}」`;
        } else did = '누를 것 없음';
      }
    } catch (e) { did += ` (실패 ${String(e.message).slice(0, 40)})`; }
    clicks++;
    trail.push(did);
    await sleep(120 + r() * 260);
    // 오류
    while (errs.length) await report('화면 오류', errs.shift());
    // 2초마다 깨진 글 · 불변식 · 앱 살아 있나
    if (Date.now() - lastInv > 2000) {
      lastInv = Date.now();
      const bad = await page.evaluate(BADSCAN, BADTXT.source).catch(() => []);
      for (const b of bad) await report('깨진 글', b);
      const inv = await page.evaluate(async (w) => { eval(w); const { broken } = await import('/tests/inv.mjs'); return broken(window.__game, window.__monkeyWatch); }, watch).catch((e) => [`불변식 못 봄: ${e.message}`]);
      for (const b of inv) await report('불변식', b);
      const alive = await page.evaluate(() => !!document.querySelector('#tabs') && !!window.__game?.s?.job).catch(() => false);
      if (!alive) { await report('앱이 사라짐', '#tabs 또는 game 없음'); break; }
      // 돈이 바닥나면 다시 채워 계속 누를 거리를 만든다(늦은 무인만)
      if (prof === 'late') await page.evaluate(() => { const s = window.__game.s; if (s.gold < 1e9) s.gold = 1e12; if ((s.mats.ore || 0) < 1e4) s.mats.ore = 1e6; }).catch(() => {});
    }
  }
  const lv = await page.evaluate(() => window.__game.s.level).catch(() => '?');
  await page.screenshot({ path: path.join(OUT, `${prof}-end.png`) }).catch(() => {});
  await ctx.close();
  console.log(`  ${found.size ? '!!' : 'OK'} [${prof}] ${SECS}초 · 누름 ${clicks} · Lv ${lv} · 문제 ${found.size}`);
  return [...found.values()];
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const all = [];
  try {
    for (const [i, prof] of ['new', 'late'].entries()) all.push(...await run(browser, prof, seeded(SEED + i * 101)));
  } catch (e) { console.log('  ✗ 멈춤:', e.stack || e); all.push({ kind: '멈춤', detail: String(e) }); }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(all, null, 1));
  console.log(all.length ? `\n✗ 몽키(화면) 문제 ${all.length}건 — ${OUT}` : '\n✓ 몽키(화면) 문제 없음');
  process.exit(all.length ? 1 : 0);
})();
