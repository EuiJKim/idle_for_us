// 새 시즌(S0) 퍼밀 계산 — 비율 스탯은 1000 = 100%(계획서 §D1). 계산은 정수로, 내림은 마지막에.
export const P = 1000;

// 값 × (1 + p/1000) — 곱하는 스탯 하나
export const mulP = (v, p) => Math.floor((v * (P + p)) / P);
// 값 × p/1000 — 계수
export const ofP = (v, p) => Math.floor((v * p) / P);
// 여러 층을 곱한다: 층 안은 더하고(합 퍼밀), 층끼리는 곱한다(§D3)
export function layers(v, list) {
  let x = v;
  for (const p of list) x = (x * (P + p)) / P;
  return Math.floor(x);
}
// 최종 스탯 = (기본 + 더하는 합) × (1 + 곱하는 합/1000)  (§D4)
export const finalStat = (base, plus, mult) => Math.floor(((base + plus) * (P + mult)) / P);
// 퍼밀 → 화면 % 글자 (예: 125 → "12.5%")
export const pct = (p) => `${(p / 10).toFixed(p % 10 ? 1 : 0)}%`;
// 두 점 사이 직선 보간(정수). 표의 레벨 사이 값을 채울 때.
export function lerpTable(rows, x, key) {
  if (x <= rows[0].at) return rows[0][key];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (x <= b.at) {
      const t = (x - a.at) / (b.at - a.at);
      return Math.round(a[key] + (b[key] - a[key]) * t);
    }
  }
  return rows[rows.length - 1][key];
}
