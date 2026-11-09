// 수련동(경험치 던전) — 기준 무인이 깨는 최고 단계와 그 보상 (동료 없음 · 대박 동료)
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');   // 저장소 뿌리
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
let T = Date.UTC(2026, 10, 9, 3, 0);
Date.now = () => T;
const LOAD = {
  '없음': (g) => {},
  '대박(신화 황룡·백호 30 · 혼원금룡)': (g) => {
    g.petSlots = () => 2;
    g.s.pets = [{ uid: 1e9, kind: 'yellow', rar: 3, lv: 30, exp: 0, q: 0, dan: 0, star: 2 }, { uid: 1e9 + 1, kind: 'tiger', rar: 3, lv: 30, exp: 0, q: 0, dan: 0, star: 2 }];
    g.gainMount('h6'); g.s.mount = g.s.mounts.find((m) => m.kind === 'h6').uid; g._stats = null;
  },
};
// 루틴·자동 던전을 끄고 레벨을 고정한다(실패 보상·다음 던전 이어 돌기로 레벨이 올라 결과가 흐려졌다) · 깼나는 finishInst 결과로
function tryStage(g, s) {
  g.s.dgn.best.exp = s - 1; g.s.dgn.used = {}; g.s.dgn.day = ''; g.s.dgn.routine = false; g.s.dgn.auto = false;
  g.heroHp = g.stats().hp;
  if (!g.startDaily('exp', s, T)) return null;
  g.inst.noChain = true;
  g._last = null;
  for (let i = 0; i < 3000 && g.inst; i++) { T += 100; g.tick(0.1); g.events.length = 0; }
  if (g.inst) g.leaveInst();
  return !!g._last?.ok;
}
const out = [];
for (const [name, lo] of Object.entries(LOAD)) {
  let from = 1;
  for (const L of [30, 45, 60, 75, 90, 99, 110, 125, 140]) {
    const g = make(L); lo(g); g.s.autoSkill = true; g.addExp = () => {};
    const fin = g.finishInst.bind(g); g.finishInst = () => { const r = fin(); g._last = r; return r; };
    const atk = g.stats().atk, ref = make(L).stats().atk;
    let s = Math.max(1, from - 6), best = 0, fails = 0;
    while (s <= 200 && fails < 2) { const ok = tryStage(g, s); if (ok === null) break; if (ok) { best = s; fails = 0; } else fails++; s++; }
    from = best;
    const r = D.dailyReward('exp', best, 1, L);
    let climb = 0; for (let k = 1; k <= best; k++) climb += D.dailyReward('exp', k, 1, L).exp;
    out.push({ 동료: name.slice(0, 6), L, 공격배수: +(atk / ref).toFixed(2), 최고단계: best, 몹Lv: D.dailyLv(best), 세기: +D.dailyOverK(best).toFixed(1), '한판경험치(다음레벨%)': Math.round(100 * r.exp / W.expToNext(L)), '10%도전(%)': +(10 * r.exp / W.expToNext(L)).toFixed(1), '1→최고 처음오르기(레벨수)': +(climb / W.expToNext(L)).toFixed(1), 조각: r.petShard });
    console.error(name, L, best);
  }
}
console.table(out);
