// 수련동 한 판 걸리는 시간 — 기준 무인(레벨 고정 · 동료 없음)이 단계마다 몇 초에 깨나
//   node dailytime.mjs [K]        K: DAILY_R_K를 바꿔 본다(없으면 지금 값)
//   단계: 내 레벨의 단계(L/5) · 입장 상한(L+5) · 그 위 둘
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
const K = Number(process.argv[2]) || null;
let T = Date.UTC(2026, 10, 9, 3, 0);
Date.now = () => T;
// DAILY_R_K는 상수라 바꿀 수 없다 — 몹을 낳은 뒤 체력을 비율로 고친다
const K0 = D.DAILY_R_K;
function run(g, kind, s) {
  g.s.dgn.best[kind] = s - 1; g.s.dgn.used = {}; g.s.dgn.day = ''; g.s.dgn.routine = false; g.s.dgn.auto = false;
  g.heroHp = g.stats().hp;
  if (!g.startDaily(kind, s, T)) return { ok: null };
  g.inst.noChain = true;
  let res = null, t = 0;
  const fin = g.finishInst.bind(g);
  g.finishInst = () => { res = fin(); return res; };
  for (let i = 0; i < 3000 && g.inst; i++) {
    T += 100; g.tick(0.1); g.events.length = 0; t += 0.1;
    if (K) for (const m of g.mons) if (!m.npc && !m._k) { m._k = 1; m.maxHp *= K / K0; m.hp *= K / K0; }
  }
  if (g.inst) g.leaveInst();
  g.finishInst = fin;
  return { ok: !!res?.ok, sec: Math.round(t), kills: res?.kills ?? null };
}
const out = [];
for (const L of [20, 30, 45, 60, 75, 90, 99, 115, 130, 145]) {
  const g = make(L); g.s.autoSkill = true; g.addExp = () => {};
  const own = Math.max(1, Math.round(L / 5));
  const cap = Math.max(1, Math.floor((L + 5) / 5));
  const row = { L, own, cap };
  for (const [tag, s] of [['own', own], ['cap', Math.min(30, cap)], ['cap+2', Math.min(32, cap + 2)], ['cap+5', cap + 5]]) {
    const r = run(g, 'exp', s);
    row[tag] = r.ok === null ? '-' : `${r.ok ? '✓' : '✗'}${r.sec}s`;
  }
  out.push(row);
  console.error(JSON.stringify(row));
}
console.log(`DAILY_R_K ${K ?? K0} · 제한 ${D.DAILY_SEC / W.PACE}초(실제)`);
console.table(out);
