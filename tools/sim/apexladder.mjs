// 끝판 사다리 — 상태마다: 천마(Lv175) · 화무기(Lv190) 한 판 · 칠대성 한 판(120초)에 서버 체력 몇 %
//   node apexladder.mjs            (상태는 famecmp.mjs의 PROF와 같은 차림 + 5차)
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const fs = await import('node:fs');
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const MS = await import(`${root}/js/world/wmaster.js`);
const W_L = await import(`${root}/js/world/wland.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
let T = Date.UTC(2026, 10, 9, 3, 0); Date.now = () => T;
// famecmp의 차림(dress)과 상태(PROF)를 빌린다
const src = fs.readFileSync(new URL('./famecmp.mjs', import.meta.url), 'utf-8');
const body = src.slice(src.indexOf('const kills ='), src.indexOf('for (const [name, [L, o]] of Object.entries(PROF))'));
const { dress, PROF } = new Function('W', 'D', 'MS', 'W_L', 'make', `${body}; return { dress, PROF };`)(W, D, MS, W_L, make);
const quiet = (g) => { g.s.dgn.routine = false; g.s.dgn.auto = false; g.s.tower.auto = false; g.s.potions = 1e6; g.s.autoPotion = true; };
function boss(g, id, sec = 600) {
  const room = W.mapId(W.masterZoneOf(id), W.BOSS_AREA);
  quiet(g); g.enterMap(room); g.heroHp = g.stats().hp;
  const d0 = g.s.deaths; let b0 = null, t = 0;
  for (; t < sec; t += 0.1) {
    T += 100; g.tick(0.1); g.events.length = 0; g.freezeT = 0;
    if (g.map.town) g.enterMap(room);
    const b = g.mons.find((m) => m.isBoss && m.alive);
    if (b && !b0) b0 = b;
    if (b0 && !b0.alive) return { ok: true, sec: Math.round(t * W.PACE), deaths: g.s.deaths - d0, hp: b0.maxHp };
  }
  return { ok: false, left: b0 ? b0.hp / b0.maxHp : 1, deaths: g.s.deaths - d0, hp: b0?.maxHp };
}
function wraid(g, hwHp) {
  quiet(g);
  const max = D.wraidMaxHp(hwHp, 'umawang');
  if (!g.startWraid({ id: 'umawang', hpLeft: max, maxHp: max }, T)) return null;
  for (let t = 0; t < 200 && g.inst; t += 0.1) { T += 100; g.tick(0.1); g.events.length = 0; g.freezeT = 0; }
  const I = g.inst; const dealt = I ? I.myDealt : g._lastWraidDealt;
  if (g.inst) g.leaveInst();
  return dealt / max;
}
const STATES = { ...PROF };
delete STATES['Lv30 첫날']; delete STATES['Lv60 초반']; if (process.env.ONLY) for (const k of Object.keys(STATES)) if (!k.includes(process.env.ONLY)) delete STATES[k];
const out = [];
let hwBase = null;
for (const [name, [L, o]] of Object.entries(STATES)) {
  const mk = () => { const g = make(L); dress(g, o); if (L >= 140 && o.lords) { g.s.jobTier = 5; g.s.duel.won.cheonma = 1; g.s.duel.won.jinpaecheon = 1; g.s.duel.won.baekjagang = 1; } g._stats = null; return g; };
  const g1 = mk(); const st = g1.stats();
  const cm = boss(g1, 'cheonma');
  const g2 = mk(); const hw = boss(g2, 'hwamugi');
  if (!hwBase) hwBase = g2.hwamugiHp();   // 칠대성 서버 체력의 잣대는 기본 체력(맞춤 키우기 빼고)
  const g3 = mk(); const fin = g3.finishInst.bind(g3); g3.finishInst = () => { g3._lastWraidDealt = g3.inst?.myDealt; return fin(); };
  const wr = L >= D.WRAID_LV ? wraid(g3, hwBase || 1.42e10) : null;
  const row = { 상태: name, L, 차수: g1.s.jobTier, 전투력: Math.round(st.power), '천마 Lv175': cm.ok ? `✓ ${cm.sec}초` : `✗ ${Math.round(100 * (1 - cm.left))}%`, '화무기 Lv190': hw.ok ? `✓ ${hw.sec}초` : `✗ ${Math.round(100 * (1 - hw.left))}%`, '쓰러짐(화)': hw.deaths, '칠대성 한 판': wr == null ? '-' : `${(wr * 100).toFixed(3)}%` };
  out.push(row); console.error(JSON.stringify(row));
}
console.log(`칠대성 서버 체력 = 화무기 기본 ${(hwBase || 0).toExponential(2)} × ${D.WRAID_HP_K}`);
console.table(out);
