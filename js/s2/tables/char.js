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
// v628 원거리 싸움(궁사 · 술사 — 사거리 minRange 이상) · 옆보기 사냥 엔진(battle/side.js)이 쓴다. 거리 mm · 시간 ms
//   stand: 자동으로 다가갈 때 서는 거리(사거리 배율 — 근접은 예전대로 0.6)
//   hop(뒤로 뛰기, 자동만): 같은 발판의 화난 몹이 near 안으로 오면 wind 동안 웅크렸다가 몹 반대쪽으로 dist를 ms에 걸쳐 · cdMs마다 한 번.
//     내려설 자리는 발판 끝에서 margin · 맵 끝에서 edge(좁은 맵은 너비의 edgeX) 안쪽 — 맵 끝은 카메라가 더 못 가 무인이 화면 아래 구석(HP 상자 · 무공 칸 밑)에 깔린다
//     (568×320에서 HP 상자 오른쪽 끝 = 맵 끝에서 4.5m) · 자리가 모자라면 min까지 짧게, 그보다 좁으면 몰린 것이라 안 뜀
//     · 뛰고 나서 화난 몹과 gain 넘게 벌어질 때만 · 무적 없음
//   kb(궁사 화살 밀어내기): 평타 base · 무공 skill(한 번 쓸 때 몹마다 한 번) · 정예는 eliteX배 · 두목은 안 밀림.
//     화살이 닿는 때(거리 ÷ v mm/ms, 50ms 단위 · 0.1~0.25초)에 밀리기 시작해 미끄러지고, 그때부터 stagMs 동안 걷지도 치지도 못한다
//   slow(술사 기탄): 평타 기탄이 닿으면 ms 동안 걸음 ×x(두목은 아님)
//   retreat(자동 물러나기 · game.js rgSlow): 원거리는 잘 안 쓰러지니 칸이 레벨보다 앞선 채 winMs 동안 처치가 kills마리(분당 24 — 기준 27의 90%) 아래면 쓰러짐 하나로 센다
//     (봇 7일 씨앗 8개 · 궁사/술사: 레벨 −0.1~+0.5 · 분당 처치 −3%~+10% · 사냥터 쓰러짐 −70~80% — 60초/27이면 이른 날 처치가 −9%까지 떨어졌다)
//   숫자는 기준 무인 사냥(Lv 30~120 · 씨앗 16 · 10분)으로 맞춤 — 표적과 2~4m 2배쯤 · 1.5m 안 절반쯤으로 · 같은 조건 분당 처치 −1%~+4%
export const RANGED = {
  minRange: 4000, stand: 0.72,
  hop: { near: 2000, dist: 2200, min: 900, wind: 100, ms: 280, cdMs: 1800, margin: 300, edge: 5000, edgeX: 0.2, gain: 600 },
  kb: { base: 250, skill: 400, eliteX: 0.5, stagMs: 200, v: 30 },
  slow: { x: 0.6, ms: 800, v: 20 },
  retreat: { winMs: 40000, kills: 16 },
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
