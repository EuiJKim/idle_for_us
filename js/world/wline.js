// 장비 계열 (v151) — 사다리(레벨 5~100) 칸마다 같은 장비를 여덟 계열로 만든다.
//
// 지역 재료만 드는 '기본'에 더해, 세력 재료를 넣으면 계열이 붙는다:
//   정파(무림맹 재료) 체력·방어 · 사파(사파 재료) 치명·속도 · 마교(마교 재료) 공격·흡혈
//   두 세력을 섞은 정사·사마·정마는 두 성향을 반씩, 세 세력을 다 넣은 삼파는 기본 수치가 가장 크다.
// 세력 재료는 그 세력의 사냥터(지도 무림맹·사파·마교 칸)와 고수의 두목 방에서 나온다 — 어디서 사냥하느냐가 무엇을 만드느냐다.
// 레벨 100부터는 세트(wgear.js)로 만든다.
export const FAC_MATS = { murim: 'fm', sapa: 'fs', magyo: 'fg' };
export const FAC_MAT_INFO = {
  fm: { name: '협의패', col: '#60a5fa', fac: 'murim', from: '무림맹 사냥터·고수' },
  fs: { name: '흑도령', col: '#f87171', fac: 'sapa', from: '사파 사냥터·고수' },
  fg: { name: '마혈정', col: '#c084fc', fac: 'magyo', from: '마교 사냥터·고수' },
};
export const isFacMat = (k) => Object.prototype.hasOwnProperty.call(FAC_MAT_INFO, k);

// mult: 기본 수치 배수 · bonus: 덤 능력(칸이 오를수록·등급이 높을수록 커진다)
export const LINES = [
  { id: 'base', name: '기본', fac: [], mult: 1, bonus: {}, desc: '지역 재료만' },
  { id: 'murim', name: '정파', fac: ['murim'], mult: 1.08, bonus: { hpPct: 0.025, def: 1.5, dmgRed: 0.01 }, desc: '체력·방어' },
  { id: 'sapa', name: '사파', fac: ['sapa'], mult: 1.08, bonus: { crit: 0.012, speed: 0.02 }, desc: '치명·속도' },
  { id: 'magyo', name: '마교', fac: ['magyo'], mult: 1.08, bonus: { atkPct: 0.025, drain: 0.004 }, desc: '공격·흡혈' },
  { id: 'jeongsa', name: '정사', fac: ['murim', 'sapa'], mult: 1.14, bonus: { hpPct: 0.018, crit: 0.009, speed: 0.012 }, desc: '체력·치명' },
  { id: 'sama', name: '사마', fac: ['sapa', 'magyo'], mult: 1.14, bonus: { crit: 0.009, atkPct: 0.018, critDmg: 0.03 }, desc: '치명·공격' },
  { id: 'jeongma', name: '정마', fac: ['murim', 'magyo'], mult: 1.14, bonus: { hpPct: 0.018, atkPct: 0.018, drain: 0.003 }, desc: '체력·공격' },
  { id: 'samp', name: '삼파', fac: ['murim', 'sapa', 'magyo'], mult: 1.22, bonus: { hpPct: 0.014, atkPct: 0.014, crit: 0.007, speed: 0.01 }, desc: '셋 다 — 가장 세다' },
];
export const lineOf = (id) => LINES.find((l) => l.id === id) || LINES[0];
// 계열마다 만들 때 나오는 등급 확률 (v157) — 레어 · 유니크 · 전설 · 신화.
// 세력 재료를 많이 섞을수록 운이 좋다. 전에는 모두 같은 확률(70/22/7/1)이라
// 재료가 싼 계열(기본·정파 하나)을 여러 번 돌려 신화를 뽑는 게 정사마 셋을 모아 한 번 만드는 것보다 나았다.
// 같은 시간 사냥한 재료로 뽑을 수 있는 신화 수: 세력 하나 1 → 둘 ≈1.4 → 셋 ≈2.4 (재료가 1 · 1.4 · 1.65배 들어서). 기본은 신화가 안 나온다(승급으로만).
export const LINE_RAR_W = [[78, 19, 3, 0], [72, 21, 6, 1], [64, 25, 9, 2], [54, 28, 14, 4]];
export const lineRarW = (id) => LINE_RAR_W[lineOf(id).fac.length];
// 칸이 오를수록 덤 능력이 커진다 (첫 칸 0.5배 → 스무째 칸 1.5배)
export const lineScale = (step) => 0.5 + Math.min(19, step) / 19;
export function lineBonus(id, step, rarMult = 1) {
  const L = lineOf(id);
  const out = {};
  for (const [k, v] of Object.entries(L.bonus)) out[k] = v * lineScale(step) * rarMult;
  return out;
}
// 세력 재료 — 세력이 많을수록 하나하나는 덜 든다. 등급 배수(RAR_MATS)는 부르는 쪽이 곱한다.
const SLOT_W = { weapon: 1.3, armor: 1.1, hat: 0.9, glove: 0.9, shoe: 0.9, acc: 1.1 };
const SHARE = [0, 1, 0.7, 0.55];
export function lineMats(id, slot, step) {
  const L = lineOf(id);
  const out = {};
  for (const f of L.fac) out[FAC_MATS[f]] = Math.round((5 + step * 2.5) * (SLOT_W[slot] || 1) * SHARE[L.fac.length]);
  return out;
}
// 세력 재료가 떨어지는 양 — 몹 하나(확률 FAC_MAT_RATE)에 1 + 레벨/25, 정예는 둘, 두목은 FAC_BOSS_MATS, 고수 두목은 그 세 배(맹주·천마는 열 배)
export const FAC_MAT_RATE = 0.25;
export const FAC_BOSS_MATS = 12;
export const facMatDrop = (lv) => 1 + Math.floor(lv / 25);
