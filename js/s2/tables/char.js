// 새 시즌(S2) 무인 · 몹 기본 숫자 — 레벨별 기본 스탯 · 직업 환산 · 방어 계수 · 격차표(계획서 §D · §E · §J3).
import { LEVEL_MAX } from './progress.js';

// 다섯 직업 — 주 스탯 · 사거리(mm) · 평타 간격(ms)
export const JOBS = {
  sword: { name: '검객', main: 'str', range: 1400, baseMs: 900 },
  spear: { name: '창수', main: 'str', range: 1800, baseMs: 1000 },
  fist: { name: '권사', main: 'agi', range: 1100, baseMs: 700 },
  bow: { name: '궁사', main: 'agi', range: 5200, baseMs: 1000 },
  mage: { name: '술사', main: 'ene', range: 4800, baseMs: 1100 },
};
// 주 스탯 1점 = 공격 몇 · 체력 몇 (주 스탯이 아닌 셋은 체력만 조금)
export const MAIN_TO_ATK = 2, MAIN_TO_HP = 6, SUB_TO_HP = 3;

// 레벨별 기본(맨몸) — 장비·성장 없이
export const baseAtk = (L) => Math.round(18 + 5 * L + 0.06 * L * L);
export const baseHp = (L) => Math.round(220 + 60 * L + 0.9 * L * L);
export const baseDef = (L) => Math.round(8 + 3 * L + 0.04 * L * L);
export const statPointsAt = (L) => (L - 1) * 5;    // 레벨마다 5점(주 스탯에 몰아 찍는 게 기본)

// 방어 계수 K(레벨) — 피해 × K/(K+방어). 같은 레벨 몹 방어면 약 25%를 막는다(§E1 ⑦)
export const defK = (L) => 3 * baseDef(L);
// 레벨 차이 보정 — 몹이 높으면 1레벨당 −2%(퍼밀 −20), 최대 −60%(§E4)
export const levelGapP = (myLv, mobLv) => -Math.min(600, Math.max(0, mobLv - myLv) * 20);

// 격차표(§E3): 격차(내 − 상대) 구간 → 퍼밀
//   회피: 상대 명중보다 내 회피가 높을수록 · 상태이상: 내 걸기 − 상대 저항
export const GAP_EVADE = [[-1e9, 0], [0, 30], [50, 80], [150, 150], [400, 250], [1000, 350]];
export const GAP_CC = [[-1e9, 50], [-100, 150], [0, 300], [100, 500], [300, 700], [800, 900]];
export const gapP = (table, gap) => { let p = table[0][1]; for (const [g, v] of table) if (gap >= g) p = v; return p; };

// 기본 치명 · 피해 폭(퍼밀)
export const BASE_CRIT = 50, BASE_CRIT_DMG = 500, BASE_DMG_MIN = 900, BASE_DMG_MAX = 1100;
// 받는 피해 비율 감소 상한(§E5)
export const TAKEN_DOWN_CAP = 700, TAKEN_DOWN_MAX_EFFECTS = 3;
export const LV_MAX = LEVEL_MAX;
