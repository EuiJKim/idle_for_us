// 새 시즌 경험치 곡선(계획서 §J2) — 진행 목표(progress.js)에 맞춰 시뮬로 구한 구간 배율(S3 확정).
// 다음까지 경험치(L) = L² × 1.045^L × 구간 배율(L). 몹 한 마리 = 몹 레벨^1.6. 표준 방에서 분당 27마리.
// 구간 배율은 tools/s2sim/fit_exp.mjs가 「그 레벨에 닿는 사냥 분」에서 역산한 값.
import { LEVEL_MAX } from './progress.js';

// [시작 레벨, 끝 레벨(미포함), 배율]
export const EXP_BANDS = [
  [1, 15, 18.34], [15, 60, 13.28], [60, 100, 13.93],
  [100, 113, 52.22], [113, 127, 66.41], [127, 139, 63.23], [139, 151, 82.85],
];
// 99 승급 직후 벽이 갑자기 서지 않게 100~104는 60~100 배율에서 100~113 배율로 다섯 레벨에 걸쳐 올린다
export const RAMP_FROM = 100, RAMP_LEN = 5;
export function band(L) {
  const seg = (l) => EXP_BANDS.find(([a, b]) => l >= a && l < b)?.[2] ?? EXP_BANDS.at(-1)[2];
  if (L >= RAMP_FROM && L < RAMP_FROM + RAMP_LEN) {
    const a = seg(RAMP_FROM - 1), b = seg(RAMP_FROM);
    return a + ((b - a) * (L - RAMP_FROM + 1)) / RAMP_LEN;
  }
  return seg(L);
}
// 레벨이 오를수록 필요 경험치가 줄지 않게(구간 경계에서 배율이 내려가도 앞 레벨보다 1은 크게)
const NEXT = [0];
for (let L = 1; L <= LEVEL_MAX; L++) NEXT[L] = Math.max(Math.round(L * L * Math.pow(1.045, L) * band(L)), (NEXT[L - 1] || 0) + 1);
export const expToNext = (L) => NEXT[Math.max(1, Math.min(LEVEL_MAX, L | 0))];
const CUM = [0, 0];
for (let L = 1; L < LEVEL_MAX; L++) CUM[L + 1] = CUM[L] + expToNext(L);
export const cumExp = (L) => CUM[Math.max(1, Math.min(LEVEL_MAX, L | 0))];
// 몹 한 마리 경험치 — 몹 레벨^1.6 (정예 ×8 · 두목 ×40)
export const mobExp = (mobLv, kind = 'mob') => Math.max(1, Math.round(Math.pow(mobLv, 1.6) * (kind === 'elite' ? 3 : kind === 'boss' ? 10 : 1)));
// 표준 방(캠프 12 · 재등장 2초)에서 기준 무인의 분당 처치 — 시험이 실제 방 사냥으로 다시 잰다
export const KILLS_PER_MIN = 27;
export const STD_ROOM = { n: 12, coolMs: 2000 };
// 하루 사냥 분 상당: 접속 120분 + 방치 12시간 × 70% = 624 · 둘째 날부터 수련동·미션·원정 몫 +138
export const DAY1_MIN = 624, DAY_MIN = 762;
