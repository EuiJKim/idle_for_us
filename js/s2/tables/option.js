// 새 시즌 숫자 초안 — 무작위 옵션 공용 틀(계획서 §G3 · §J4).
// 쓰는 곳: 경지 심법 · 영물 숨은 힘 · 강호행 단계 · 칸 옵션 · 부옵션
export const OPT_GRADES = ['일반', '희귀', '영웅', '전설'];
// 굴림 숙련 0단계(처음)와 10단계(최대)의 등급 확률(퍼밀) — 사이는 직선
export const OPT_P0 = [750, 200, 45, 5];
export const OPT_P10 = [600, 280, 100, 20];
export const MASTERY_MAX = 10;
export function optWeights(mastery) {
  const t = Math.max(0, Math.min(MASTERY_MAX, mastery)) / MASTERY_MAX;
  const w = OPT_P0.map((a, i) => Math.round(a + (OPT_P10[i] - a) * t));
  w[0] += 1000 - w.reduce((a, b) => a + b, 0);
  return w;
}
// 숙련 올리기: 숙련 m에서 굴린 횟수가 need(m)에 닿으면, 그 뒤 굴릴 때마다 up(m) 확률로 오른다
export const masteryNeed = (m) => 20 * (m + 1) * (m + 1);
export const masteryUpP = (m) => Math.max(50, 300 - m * 25);
// 다시 굴리기 비용 배율: 잠근 줄 수 0·1·2 → ×1 · ×2 · ×4
export const LOCK_COST_X = [1, 2, 4];

// 동료 · 병기 · 영물 뽑기 (등급 5: 범·양·정·진·보)
export const PULL_P = [600, 280, 90, 25, 5];
export const PULL_PITY = 200;        // 200회 안에 최고 등급 하나
export const PULL_TEN_FLOOR = 2;     // 10연이면 정품(2) 이상 하나 보장
