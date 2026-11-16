// 새 시즌 경험치 곡선(계획서 §J2 · v527) — 레벨마다 다음까지 경험치를 표(exp_next.js)로 둔다.
// 표는 tools/s2sim/fit_exp.mjs가 만든다: 진행 목표 점(progress.js CURVE_PTS)을 매끈하게 이어 「그 레벨에 닿는 사냥 분」을 정하고,
// 한 레벨 사이 사냥 분 × 분당 처치(27) × 몹 경험치(그 레벨) × 실제 엔진 보정으로 역산. 몹 한 마리 = 몹 레벨^1.6.
import { LEVEL_MAX } from './progress.js';
import { EXP_NEXT } from './exp_next.js';

// 레벨이 오를수록 필요 경험치가 줄지 않게
const NEXT = [0];
for (let L = 1; L <= LEVEL_MAX; L++) NEXT[L] = Math.max(EXP_NEXT[L] || 1, (NEXT[L - 1] || 0) + 1);
export const expToNext = (L) => NEXT[Math.max(1, Math.min(LEVEL_MAX, L | 0))];
const CUM = [0, 0];
for (let L = 1; L < LEVEL_MAX; L++) CUM[L + 1] = CUM[L] + expToNext(L);
export const cumExp = (L) => CUM[Math.max(1, Math.min(LEVEL_MAX, L | 0))];
// 몹 한 마리 경험치 — 몹 레벨^1.6 (정예 ×8 · 두목 ×40)
// v527 무인 Lv100(4차 전직 레벨)부터 사냥 경험치 ×HI_X. 1일 30 · 7일 70 · 30일 100 · 60일 150 곡선에서 100 뒤 50레벨을 30일에
//   오르려면 한 레벨 시간이 100 앞(70~100: 23일에 30레벨)보다 짧아야 하는데, 다음까지 경험치는 줄면 안 되므로 버는 쪽을 올린다.
//   몹 레벨(칸)이 아니라 무인 레벨로 — 칸이 레벨보다 앞서도 100 전에 미리 받지 않게.
export const HI_FROM = 100, HI_X = 3;
export const mobExp = (mobLv, kind = 'mob', heroLv = mobLv) => Math.max(1, Math.round(Math.pow(mobLv, 1.6) * (heroLv >= HI_FROM ? HI_X : 1) * (kind === 'elite' ? 3 : kind === 'boss' ? 10 : 1)));
// 표준 방(캠프 12 · 재등장 2초)에서 기준 무인의 분당 처치 — 시험이 실제 방 사냥으로 다시 잰다
export const KILLS_PER_MIN = 27;
export const STD_ROOM = { n: 12, coolMs: 2000 };
// v527 하루 사냥 분 상당(기준 플레이어): 접속 20시간 × 실제 엔진 효율 + 방치 4시간 × 70% · 둘째 날부터 수련동·미션·원정 몫 +138
//   실제 엔진 효율 = 접속 1분 경험치 ÷ (27 × 그 레벨 몹) — tools/s2sim/play.mjs로 잰 값(칸 두목전 · 칸이 레벨보다 앞섬 · 이동을 다 넣은 것)
export const ACTIVE_MIN = 1200, OFFLINE_H = 4, ACTIVE_EFF = 0.75;
export const DAY1_MIN = Math.round(ACTIVE_MIN * ACTIVE_EFF + OFFLINE_H * 60 * 0.7), DAY_MIN = DAY1_MIN + 138;
