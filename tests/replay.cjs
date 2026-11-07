// v436 세이브 재현 장치 — 무인이 보낸 🐞 신고의 세이브(또는 몽키 봇이 남긴 세이브)를 브라우저에 그대로 넣고 연다.
//   창을 하나씩 열어 사진을 찍고, 잠깐 돌린 뒤 불변식(tests/inv.mjs)과 화면 오류를 본다.
//   1) 정적 서버:  npx http-server -p 8123 -s -c-1 .
//   2) node tests/replay.cjs <세이브.json | 신고.json>       (오프라인으로 연다 — 서버와 맞추지 않는다)
//      SECS=60 node tests/replay.cjs save.json               (더 오래 돌려 본다)
//   세이브 파일: 운영자 🐞 신고함의 「세이브 받기」로 받은 글 · 신고 문서 JSON({ save: "…" }) · 에뮬레이터 REST 문서 · tests/shots/soak-fail-*.json
//   사진·보고서: tests/shots/replay/
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:8123/';
const SECS = Number(process.env.SECS) || 20;
const OUT = process.env.OUT || path.join(__dirname, 'shots', 'replay');
const file = process.argv[2];
if (!file) { console.log('쓰는 법: node tests/replay.cjs <세이브.json>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

// v437 화면 글에서 깨진 값(undefined · NaN · [object Object]) — 속성(title)까지
const BADSCAN = () => {
  const rx = /\bundefined\b|\bNaN\b|\[object Object\]|Infinity/, hits = [];
  for (const root of ['#panel-body', '#modal', '#hud', '#topbar', '#stagebar', '#quest']) {
    const el = document.querySelector(root); if (!el) continue;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) if (rx.test(n.textContent) && !n.parentElement?.closest('textarea')) hits.push(`${root}: ${n.textContent.trim().slice(0, 90)}`);
    for (const a of el.querySelectorAll('[title]')) if (rx.test(a.title)) hits.push(`${root} title: ${a.title.slice(0, 90)}`);
  }
  return [...new Set(hits)].slice(0, 8);
};
// 어떤 꼴로 받았든 세이브 글로
function saveText(raw) {
  let j; try { j = JSON.parse(raw); } catch { throw new Error('JSON이 아니에요'); }
  if (typeof j === 'string') j = JSON.parse(j);
  if (j?.fields?.save) j = JSON.parse(j.fields.save.stringValue);        // 에뮬레이터 REST 문서
  else if (typeof j?.save === 'string') j = JSON.parse(j.save);          // 신고 문서
  if (!j || typeof j !== 'object' || !('level' in j)) throw new Error('세이브가 아니에요(level 없음)');
  if (!j.nickname) j.nickname = '재현무인';   // 이름 없는 세이브(몽키 봇)면 이름 묻는 창이 화면을 가린다
  return JSON.stringify(j);
}

(async () => {
  const save = saveText(fs.readFileSync(file, 'utf-8'));
  const meta = JSON.parse(save);
  console.log(`— 세이브: ${meta.nickname || '무명'} · ${meta.job || '?'} Lv ${meta.level} · 사냥터 ${meta.map} · ${(save.length / 1024).toFixed(1)}KB`);
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  const NOISE = /Failed to load resource|ERR_FAILED|Could not reach Cloud Firestore backend|firebase/i;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept().catch(() => {}));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.route('https://www.gstatic.com/firebasejs/**', (r) => r.abort());   // 오프라인 — 남의 세이브로 서버를 건드리지 않는다
  // 처음 한 번만 넣는다(새로 고침에 다시 덮지 않게)
  await page.addInitScript((s) => {
    try {
      if (sessionStorage.getItem('ifu.replayed')) return;
      localStorage.clear();
      localStorage.setItem('ifu-world-v1', s);
      sessionStorage.setItem('ifu.replayed', '1');
    } catch { /* */ }
  }, save);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  // 켜질 때까지 — 손님 들어가기 · 캐릭터 고르기 · 방치 보상 같은 첫 창은 넘긴다
  let up = false;
  for (let i = 0; i < 80 && !up; i++) {
    if (await page.isVisible('#login-guest').catch(() => false)) await page.click('#login-guest').catch(() => {});
    if (await page.isVisible('.char-card:not(.empty)').catch(() => false)) await page.click('.char-card:not(.empty) >> nth=0').catch(() => {});
    up = await page.evaluate(() => !!(window.__game?.s?.job && window.__app && document.querySelector('#tabs'))).catch(() => false);
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) { await page.screenshot({ path: path.join(OUT, 'boot.png') }); console.log('  ✗ 켜지지 않음 — boot.png'); console.log(errors.join('\n')); await browser.close(); process.exit(1); }
  const closeModals = () => page.evaluate(() => { for (let i = 0; i < 5; i++) { const m = document.querySelector('#modal:not(.hidden)'); if (!m) break; const b = [...m.querySelectorAll('button')].find((x) => /받기|확인|닫기|좋아요|넘기기/.test(x.textContent)) || m.querySelector('button'); b?.click(); } }).catch(() => {});
  for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 400)); await closeModals(); }   // 방치 보상 같은 창은 조금 늦게 뜬다
  const inv = () => page.evaluate(async () => { const { broken } = await import('/tests/inv.mjs'); const g = window.__game; window.__invWatch = window.__invWatch || new Map(); return { bad: broken(g, window.__invWatch), lv: g.s.level, gold: g.s.gold, map: g.s.map, inst: g.inst?.kind || null }; });
  const r0 = await inv();
  console.log(`  열림: Lv ${r0.lv} · 사냥터 ${r0.map}${r0.inst ? ' · 던전 ' + r0.inst : ''}`);
  const report = { file, at: new Date().toISOString(), steps: [] };
  const step = async (name, bad) => { report.steps.push({ name, bad }); console.log(`  ${bad.length ? '✗' : '✓'} ${name}${bad.length ? ' — ' + bad.join(' · ') : ''}`); };
  await step('불러온 직후 불변식', r0.bad);
  await page.screenshot({ path: path.join(OUT, '0-field.png') });
  // 창을 하나씩
  const tabs = await page.$$eval('#tabs button[data-tab]', (bs) => bs.map((b) => b.dataset.tab));
  for (const t of tabs) {
    const before = errors.length;
    await page.evaluate((x) => window.__app.showTab(x), t).catch((e) => errors.push(`showTab ${t}: ${e.message}`));
    await new Promise((r) => setTimeout(r, 400));
    // 칸(서브 탭)도 한 바퀴
    const subs = await page.$$eval('#panel .subtabs button[data-key]', (bs) => bs.length).catch(() => 0);
    const badTxt = new Set(await page.evaluate(BADSCAN).catch(() => []));
    for (let k = 0; k < Math.min(subs, 8); k++) {
      await page.evaluate((i) => document.querySelectorAll('#panel .subtabs button[data-key]')[i]?.click(), k).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
      for (const b of await page.evaluate(BADSCAN).catch(() => [])) badTxt.add(b);   // v437 칸마다 깨진 글(undefined · NaN)
    }
    await closeModals();
    await page.screenshot({ path: path.join(OUT, `tab-${t}.png`) });
    await step(`창 ${t}${subs ? ` (칸 ${subs})` : ''} 열기`, [...errors.slice(before), ...[...badTxt].map((b) => '깨진 글 ' + b)]);
    if (await page.isVisible('#panel-close').catch(() => false)) await page.click('#panel-close').catch(() => {});
    await closeModals();
  }
  // 그대로 돌려 본다
  const t1 = Date.now();
  while (Date.now() - t1 < SECS * 1000) {
    await new Promise((r) => setTimeout(r, 2000));
    await closeModals();
    const r = await inv();
    if (r.bad.length) { await step(`돌리는 중 불변식 (${Math.round((Date.now() - t1) / 1000)}초)`, r.bad); break; }
  }
  const r1 = await inv();
  await step(`${SECS}초 돌린 뒤 불변식 (Lv ${r1.lv} · 사냥터 ${r1.map}${r1.inst ? ' · ' + r1.inst : ''})`, r1.bad);
  await step('화면 오류 없음', errors);
  await page.screenshot({ path: path.join(OUT, '9-after.png') });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ...report, errors }, null, 1));
  await browser.close();
  const bad = report.steps.filter((s) => s.bad.length).length;
  console.log(bad ? `\n✗ 재현: ${bad}곳에서 문제 — ${OUT}` : `\n✓ 재현: 문제 없음 — 사진 ${OUT}`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('✗', e.stack || e); process.exit(1); });
