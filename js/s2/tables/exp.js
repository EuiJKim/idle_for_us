// 새 시즌 숫자 초안 — 경험치 곡선(계획서 §J2). 기초값(EXP_BASE)은 시뮬로 §J1에 맞춰 확정한다.
import { LEVEL_MAX } from './progress.js';

export let EXP_BASE = 12;   // 시뮬로 확정(S3)

// 구간 배율 — 100부터 급격히 느려진다. 100~104는 ×3 → ×6으로 다섯 레벨에 걸쳐 올린다(승급 직후 벽 완화)
export function band(L) {
  if (L < 31) return 0.6;
  if (L < 100) return 1;
  if (L < 105) return 3 + (L - 100) * 0.75;   // 100:3 · 101:3.75 · … · 104:6
  if (L < 120) return 6;
  if (L < 140) return 14;
  return 30;
}
export const expToNext = (L) => Math.round(EXP_BASE * L * L * Math.pow(1.045, L) * band(L));
const CUM = [0, 0];
for (let L = 1; L < LEVEL_MAX; L++) CUM[L + 1] = CUM[L] + expToNext(L);
export const cumExp = (L) => CUM[Math.max(1, Math.min(LEVEL_MAX, L | 0))];
// 몹 한 마리 경험치 — 몹 레벨^1.6
export const mobExp = (mobLv) => Math.max(1, Math.round(Math.pow(mobLv, 1.6)));
// 기준 처치 속도(적정 사냥터, 분당) — §J2 맞춤 기준
export const KILLS_PER_MIN = 40;
