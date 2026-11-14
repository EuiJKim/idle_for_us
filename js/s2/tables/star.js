// 새 시즌 숫자 초안 — 성혼(별 강화) 0~25성(계획서 §G2 · §J4). 확률은 퍼밀.
// 실패하면: 11성부터 일부는 「하락」, 15성부터 일부는 「파괴」. 나머지는 그냥 실패(그대로).
export const STAR_MAX = 25;
export const DOWN_FROM = 11;
export const BREAK_FROM = 15;
export const PROTECT_FROM = 15, PROTECT_TO = 19;    // 파괴 방지는 15~19성만
export const PROTECT_DOWN_COST_X = 1;               // 하락 방지 = 기본 비용의 ×1 추가
export const PROTECT_BREAK_COST_X = 2;              // 파괴 방지 = 기본 비용의 ×2 추가
export const PITY_POINTS = 100;                     // 실패 누적 포인트가 차면 다음 1회 성공 확정

// 성(현재) → { ok: 성공, down: 하락, brk: 파괴 } 퍼밀. 나머지(1000 - 합)는 그대로.
export function starOdds(s) {
  let ok;
  if (s < 5) ok = 950 - s * 50;              // 95% → 75%
  else if (s < 10) ok = 700 - (s - 5) * 50;  // 70% → 50%
  else if (s < 15) ok = 450 - (s - 10) * 25; // 45% → 35%
  else if (s < 20) ok = 300;                 // 30%
  else ok = 300 - (s - 20) * 25;             // 30% → 20%
  const fail = 1000 - ok;
  const brk = s < BREAK_FROM ? 0 : s < 20 ? 20 + (s - 15) * 10 : 80 + (s - 20) * 18;   // 2%→6% · 8%→15%
  const downShare = s < DOWN_FROM ? 0 : s < 15 ? 500 : s < 20 ? 600 : 700;
  const down = Math.floor(((fail - brk) * downShare) / 1000);
  return { ok, down, brk };
}
// 실패할 때 쌓이는 포인트(높은 성일수록 많이)
export const pityGain = (s) => 4 + Math.floor(s / 2);
