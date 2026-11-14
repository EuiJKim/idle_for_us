// 새 시즌(S2) 데미지 계산 — 계획서 §E1의 13단계를 그대로. 정수(퍼밀) · 결정론(난수는 넘겨받은 rng만).
// 공격자·방어자: { lv, st: 최종 스탯 묶음(stats.js finalize 결과) , elem?: '오행' , boss?: bool }
// 무공: { coef: 계수 퍼밀(평타 1000), base: 평타인가 }
import { defK, levelGapP, BASE_CRIT, BASE_CRIT_DMG, BASE_DMG_MIN, BASE_DMG_MAX, TAKEN_DOWN_CAP, TAKEN_DOWN_MAX_EFFECTS } from '../tables/char.js';

const v = (st, k) => st[k] || 0;
const P = 1000;

// 방어 적용 배율(실수 0~1)
export function defMul(att, def) {
  const k = defK(def.lv);
  const eff = Math.max(0, v(def.st, 'def') * (P - Math.min(P, v(att.st, 'pierce'))) / P);
  return k / (k + eff);
}
// 오행: 내 약점(주는 쪽) − 상대 강인(받는 쪽), 하한 −50%
export function elemP(att, def) {
  if (!def.elem) return 0;
  return Math.max(-500, v(att.st, `weak_${def.elem}`) - v(def.st, `tough_${def.elem}`));
}
// 받는 쪽 비율 감소 — 앞의 3개까지, 합 70% 상한(§E5)
export function takenDownP(list = []) {
  const s = [...list].sort((a, b) => b - a).slice(0, TAKEN_DOWN_MAX_EFFECTS).reduce((a, b) => a + b, 0);
  return Math.min(TAKEN_DOWN_CAP, s);
}

// ①~⑩까지(받는 쪽 감소 전) 배율을 만든다. mode: 'roll'(실제 한 대) · 'avg'(기대값)
function core(att, def, skill, rng, mode, ctx = {}) {
  const A = att.st, D = def.st;
  let x = v(A, 'atk') * (skill.coef ?? P) / P;                                                // ①
  x *= (P + v(A, 'atkL1')) / P * ((P + v(A, 'atkL2')) / P);                                 // ②
  x *= (P + v(A, skill.base ? 'baseP' : 'skillP')) / P;                                        // ③
  x *= (P + v(A, 'mainDmg')) / P;                                                              // ④
  x *= (P + v(A, def.boss ? 'bossDmg' : 'mobDmg')) / P;                                        // ⑤
  x *= (P + elemP(att, def)) / P;                                                              // ⑥
  x *= defMul(att, def);                                                                       // ⑦
  x *= (P + levelGapP(att.lv, def.lv)) / P;                                                    //    레벨 차(§E4)
  const lo = BASE_DMG_MIN + v(A, 'dmgMin'), hi = Math.max(lo, BASE_DMG_MAX + v(A, 'dmgMax'));
  let crit = false;
  if (mode === 'avg') {
    x *= (lo + hi) / 2 / P;                                                                   // ⑧
    const cp = Math.max(0, Math.min(P, BASE_CRIT + v(A, 'crit') - v(D, 'critRes')));
    x *= 1 + (cp * (BASE_CRIT_DMG + v(A, 'critDmg'))) / P / P;                                  // ⑨
  } else {
    x *= rng.range(lo, hi) / P;                                                               // ⑧
    crit = rng.roll(BASE_CRIT + v(A, 'crit') - v(D, 'critRes'));
    if (crit) x *= (P + BASE_CRIT_DMG + v(A, 'critDmg')) / P;                                  // ⑨
  }
  for (const n of ['final1', 'final2', 'final3', 'final4', 'final5']) x *= (P + v(A, n)) / P;  // ⑩
  x *= (P + (ctx.giveP || 0)) / P;                                                             // ⑪ 던전 보정
  return { x, crit };
}

// 실제 한 대: { dmg, crit, absorbed } — ⑫ 받는 쪽 감소·보호막 · ⑬ 최소 1
export function hit(att, def, skill, rng, ctx = {}) {
  const { x, crit } = core(att, def, skill, rng, 'roll', ctx);
  let d = x * (P - takenDownP(def.takenDown || (v(def.st, 'takenDownP') ? [v(def.st, 'takenDownP')] : []))) / P - v(def.st, 'takenDownF');
  d = Math.max(1, Math.floor(d));
  let absorbed = 0;
  if (def.shield > 0) { absorbed = Math.min(def.shield, d); def.shield -= absorbed; d -= absorbed; }
  return { dmg: d, crit, absorbed };
}
// 기대 데미지(§E2) — 추천·비교·전투력에 쓴다(난수 없음)
export function expected(att, def, skill, ctx = {}) {
  const { x } = core(att, def, skill, null, 'avg', ctx);
  return Math.max(1, x * (P - takenDownP(def.takenDown || [])) / P);
}
