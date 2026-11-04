// v337 컴퓨터(1920x1080·1366x768) 시험 — 마우스로 들판·마을 사람·조이스틱·휠·창·단축키·절전을 눌러 본다
//   폰에서 되는데 컴퓨터(html zoom · 마우스)에서 안 되는 것을 잡는다.
//   NO_PROXY=127.0.0.1,localhost PLAYWRIGHT=$(npm root -g)/playwright CHROMIUM=/opt/pw-browsers/chromium node tests/desktop.cjs
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8123/';
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log(c ? '  ✓' : '  ✗', m); };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [W, H] of [[1920, 1080], [1366, 768]]) {
    console.log('#', W, H);
    const page = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; page.on('pageerror', (e) => errs.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com|gstatic\.com\/firebasejs/, (r) => r.abort());
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.char-card', { timeout: 20000 });
    await page.click('.char-card.empty >> nth=0');
    await page.fill('#modal input', '마우스'); await page.click('#modal .btn.primary');
    await page.waitForSelector('.class-card'); await page.click('.class-card >> nth=0');
    await page.waitForSelector('#modal .cust-go'); await page.click('#modal .cust-go');
    await page.evaluate(() => { window.__game.attend(); window.__game.s.autoHunt = false; });
    await page.waitForTimeout(600);
    // 1) 마을 사람 누르기 — 대장장이·사부 자리를 화면 px로 바꿔 누른다
    const npc = await page.evaluate(() => { const v = window.__view, g = window.__game; const r = document.getElementById('cv').getBoundingClientRect(); return g.mons.filter((m) => m.npc).map((m) => ({ tab: m.tab, x: r.left + v.sx(m) * v.zoom, y: r.top + (v.sy(m) - 30) * v.zoom })); });
    for (const n of npc.slice(0, 2)) {
      await page.mouse.click(n.x, n.y); await page.waitForTimeout(500);
      const open = await page.evaluate(() => document.getElementById('panel').classList.contains('open') && [...document.querySelectorAll('#tabs button.active')].map((b) => b.dataset.tab).join());
      ok(open && n.tab.startsWith(open), `마을 사람(${n.tab}) 누르면 그 창 — ${open}`);
      await page.click('#panel-close'); await page.waitForTimeout(300);
    }
    // 2) 사냥터에서 들판 누르기 — 누른 칸으로 간다
    await page.evaluate(() => { window.__game.enterMap(11); window.__game.s.autoHunt = false; window.__game.mons.forEach((m) => { m.alive = false; }); });
    await page.waitForTimeout(800);
    const tgt = await page.evaluate(() => { const v = window.__view, g = window.__game, r = document.getElementById('cv').getBoundingClientRect(); const T = g.tile || 64; const wx = g.heroX + T * 2, wy = g.heroY + T; return { x: r.left + v.sx({ x: wx, y: wy }) * v.zoom, y: r.top + v.sy({ x: wx, y: wy }) * v.zoom, c: Math.floor(wx / T), rr: Math.floor(wy / T) }; });
    await page.mouse.click(tgt.x, tgt.y); await page.waitForTimeout(80);
    const hm = await page.evaluate(() => window.__game.manual);
    ok(hm && Math.abs(hm.c - tgt.c) <= 0 && Math.abs(hm.r - tgt.rr) <= 0, `들판을 누르면 그 칸으로 (${JSON.stringify(hm)} · 원한 칸 ${tgt.c},${tgt.rr})`);
    // 3) 끌면 조이스틱이 누른 자리에
    const p0 = { x: tgt.x - 200, y: tgt.y }; await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.move(p0.x + 60, p0.y, { steps: 5 });
    const joy = await page.evaluate(() => { const j = document.querySelector('.joy, #joy') || [...document.querySelectorAll('#battle > div')].find((d) => d.style.left); const r = j.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, vis: !j.classList.contains('hidden') }; });
    ok(joy.vis && Math.abs(joy.x - p0.x) < 12 && Math.abs(joy.y - p0.y) < 12, `조이스틱이 누른 자리에 (${joy.x.toFixed(0)},${joy.y.toFixed(0)} · 누른 곳 ${p0.x.toFixed(0)},${p0.y.toFixed(0)})`);
    const jg = await page.evaluate(() => window.__game.joy);
    ok(jg && jg.dx > 0, '끌면 그쪽으로 걷는다');
    await page.mouse.up();
    // 4) 휠로 카메라
    const z0 = await page.evaluate(() => window.__view.camLevel);
    const r = await page.evaluate(() => { const c = document.getElementById('cv').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });
    await page.mouse.move(r.x, r.y); await page.mouse.wheel(0, 200); await page.waitForTimeout(200);
    const z1 = await page.evaluate(() => window.__view.camLevel);
    ok(z1 !== z0 || z0 === 0, `휠로 카메라 단계 (${z0}→${z1})`);
    // 5) 창 안의 목록을 휠로 굴린다
    await page.click('#tabs button[data-tab="bag"]'); await page.waitForTimeout(500);
    const sc = await page.evaluate(() => { const els = [...document.querySelectorAll('#panel *')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); return els.map((e) => e.id || e.className).slice(0, 3); });
    console.log('    굴러가는 칸', sc);
    const body = await page.evaluate(() => { const e = [...document.querySelectorAll('#panel *')].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (body) { await page.mouse.move(body.x, body.y); const t0 = await page.evaluate(() => [...document.querySelectorAll('#panel *')].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)).scrollTop); await page.mouse.wheel(0, 400); await page.waitForTimeout(300); const t1 = await page.evaluate(() => [...document.querySelectorAll('#panel *')].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY)).scrollTop); ok(t1 > t0, `창 목록 휠로 굴리기 (${t0}→${t1})`); }
    // 6) 창 손잡이(위로 끌어 넓히기) — 누르면 넓어진다
    const f0 = await page.evaluate(() => document.getElementById('panel').classList.contains('full'));
    await page.click('#panel-grip'); await page.waitForTimeout(300);
    const f1 = await page.evaluate(() => document.getElementById('panel').classList.contains('full'));
    ok(f0 !== f1, '창 손잡이 누르면 넓히기·좁히기');
    await page.click('#panel-grip'); await page.click('#panel-close'); await page.waitForTimeout(300);
    // 7) 무공 단추 · 단축키 · 물약 길게
    const s0 = await page.evaluate(() => window.__game.mons.length);
    await page.keyboard.press('h'); await page.waitForTimeout(500);
    ok(await page.evaluate(() => !window.__game.map.town), 'H 사냥');
    await page.keyboard.press('t'); await page.waitForTimeout(500);
    ok(await page.evaluate(() => window.__game.map.town), 'T 마을');
    await page.keyboard.press('m'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => document.getElementById('panel').classList.contains('open')), 'M 지도');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    ok(await page.evaluate(() => !document.getElementById('panel').classList.contains('open')), 'Esc 닫기');
    // 8) 꾸미기·설정 창이 화면 안에(넘치지 않게)
    await page.click('#portrait'); await page.waitForTimeout(500);
    const mb = await page.evaluate(() => { const s = document.querySelector('#modal .sheet').getBoundingClientRect(); return { top: s.top, bottom: s.bottom, h: innerHeight }; });
    ok(mb.top >= 0 && mb.bottom <= mb.h + 1, `꾸미기 창이 화면 안 (${mb.top.toFixed(0)}~${mb.bottom.toFixed(0)} / ${mb.h})`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    // 9) 절전 — 아무 글쇠로 깬다(깨운 글쇠는 단축키로 새지 않는다)
    await page.evaluate(() => window.__test_saver(true)); await page.waitForTimeout(200);
    const a0 = await page.evaluate(() => window.__game.s.autoHunt);
    await page.keyboard.press('a'); await page.waitForTimeout(300);
    ok(await page.evaluate((x) => document.getElementById('saver').classList.contains('hidden') && window.__game.s.autoHunt === x, a0), '절전은 글쇠 하나로 깨고 그 글쇠는 단축키로 새지 않는다');
    ok(errs.length === 0, `콘솔 오류 없음 ${errs.join(' | ')}`);
    await page.close();
  }
  await b.close();
  console.log(fails ? `${fails}개 실패` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
