// v628 전직 단계 이펙트 표 — 0차(전직 전) ~ 5차. 평타 · 무공 · 오라 · 전직 연출이 같은 빛깔과 크기를 쓴다.
//   차수가 오르면 빛깔이 눈에 띄게 바뀐다: 0차 흰 쇠빛 → 1~3차 직업 빛깔(차수마다 다른 빛) → 4차 금빛 → 5차 직업마다 다른 신(神) 빛깔.
//   c: 주 빛깔 · c2: 밝은 속 빛깔 · glow: 둘레 빛 / ADV_S: 크기 배율 · ADV_N: 불티 수
export const ADV_MAX = 5;
export const advOf = (S) => Math.max(0, Math.min(ADV_MAX, S?.hero?.adv | 0));
const P = (c, c2, glow) => ({ c, c2, glow });
const BASE = P('#f3efe4', '#ffffff', '#ffffff'), GOLD = P('#ffd54a', '#fff4c2', '#ff9f1a');
export const ADV_PAL = {
  sword: [BASE, P('#ffe9a8', '#fffbe6', '#ffd98a'), P('#8fd3ff', '#effaff', '#4fb6ff'), P('#7cf3ff', '#ffffff', '#22b8ff'), GOLD, P('#ff4d3d', '#ffe58a', '#ff1f5a')],
  spear: [BASE, P('#ffb27a', '#fff0e4', '#ff9a5a'), P('#ff8a3d', '#ffe2c8', '#ff6a1a'), P('#ff5a36', '#ffd7a8', '#ff3d1a'), GOLD, P('#ff3d8b', '#ffe58a', '#c026d3')],
  fist: [BASE, P('#ffd56a', '#fff8e1', '#ffc23a'), P('#ffb020', '#fff0c2', '#ff9500'), P('#fff1a8', '#ffffff', '#ffd000'), GOLD, P('#ff7a1a', '#fff6c4', '#ff3d00')],
  bow: [BASE, P('#b6f0ff', '#f0fdff', '#7ae0ff'), P('#7ae0ff', '#e8fbff', '#38bdf8'), P('#4ade80', '#eafff1', '#22c55e'), GOLD, P('#ff6a3d', '#ffe58a', '#ff2d55')],
  mage: [BASE, P('#d4b8ff', '#f6f0ff', '#b794ff'), P('#a78bfa', '#ede9fe', '#7c3aed'), P('#7dd3fc', '#f0f9ff', '#38bdf8'), GOLD, P('#f0abfc', '#ffffff', '#a855f7')],
};
export const ADV_S = [1, 1.08, 1.18, 1.3, 1.45, 1.62];
export const ADV_N = [0, 2, 4, 6, 9, 12];
export const advPal = (job, adv) => (ADV_PAL[job] || ADV_PAL.sword)[Math.max(0, Math.min(ADV_MAX, adv | 0))];
