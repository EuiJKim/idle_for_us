// 새 시즌(S5) 숫자 — 병기 · 동료 · 영물 · 경지 · 강호행 · 꾸미기(계획서 §G 6~11 · §D3 층 배정).
// 층: 경지 → 공격%②(atkL2) · 병기 → 주 피해(mainDmg) · 영물 → 최종 피해②(final2) · 강호행 → 최종 피해③(final3) · 동료 → 최종 피해④(final4)
// 목표: 무인 + 장비(기준의 약 0.75배)에 S5 층을 곱하면 기준 무인과 맞도록(tests/s2.mjs가 1·7·30·90·180·365일을 본다).
export const PULL_GRADES = ['범', '양', '정', '진', '보'];

// 수집형 셋(병기·동료·영물) — 종류 수 · 장착 칸 · 등급별 값(퍼밀)
export const COLLECT = {
  weapon: { name: '병기', kinds: 20, slots: 1, layer: 'mainDmg', equip: [20, 40, 70, 120, 200], own: [2, 4, 7, 12, 20], ownStat: 'mainDmg' },
  pal: { name: '동료', kinds: 25, slots: 5, layer: 'final4', equip: [7, 14, 25, 42, 70], own: [2, 4, 7, 12, 20], ownStat: 'hpP', subShare: 0.35 },
  relic: { name: '영물', kinds: 30, slots: 3, layer: 'final2', equip: [7, 14, 25, 42, 70], own: [2, 4, 7, 12, 20], ownStat: 'hpP' },
};
// 겹친 수로 각성(최대 5) — 각성 하나마다 그 물건 값 +20%
export const AWAKE_NEED = [1, 2, 3, 4, 5];
export const AWAKE_MAX = 5, AWAKE_STEP_P = 200;
// 전체 각성 합 → 그 수집형 전부에 배율(합 하나마다 +0.4%, 최대 +40%)
export const TOTAL_AWAKE_P = 4, TOTAL_AWAKE_CAP = 400;
// 레벨(재료 「정수」) — 장착 값 × (1 + 레벨×3%) · 최대 30
export const COLLECT_LV_MAX = 30, COLLECT_LV_P = 30;
export const collectLvCost = (lv) => [{ k: 'item:essence', n: 5 + lv * 3 }];

// 경지 — 레벨마다 공격%②·체력% · 레벨업은 은자 + 대기 시간 · 10레벨마다 심법 줄 하나 열림(최대 3)
export const REALM_MAX = 100;
export const REALM_ATK_P = 7, REALM_HP_P = 8;
export const realmCost = (n, goldPerMob) => [{ k: 'gold', n: Math.round(goldPerMob * 400 * Math.pow(1.06, n)) }];
export const HEART_POOL = [
  { k: 'atkL2', v: [10, 22, 40, 70], w: 3 }, { k: 'hpP', v: [12, 26, 48, 84], w: 3 },
  { k: 'bossDmg', v: [12, 26, 48, 84], w: 2 }, { k: 'critDmg', v: [20, 44, 80, 140], w: 2 }, { k: 'crit', v: [5, 10, 18, 30], w: 1 },
];
export const heartLines = (realmLv) => Math.min(3, Math.floor(realmLv / 10));
export const heartCost = [{ k: 'item:heart', n: 1 }];

// 강호행 — 단계마다 두목을 이기면 열림(대기 시간) · 단계마다 최종 피해③ · 축복 상자 · 단계 옵션 2줄
export const JOURNEY_MAX = 60;
export const JOURNEY_STEP_P = 4;
export const journeyCost = (n) => [{ k: 'gold', n: 2000 * (n + 1) * (n + 1) }];
export const JOURNEY_POOL = [
  { k: 'final3', v: [2, 5, 9, 16], w: 3 }, { k: 'hpP', v: [5, 11, 20, 35], w: 3 }, { k: 'mobDmg', v: [6, 13, 24, 42], w: 2 }, { k: 'bossDmg', v: [6, 13, 24, 42], w: 2 },
];
// 축복(단계를 열 때마다 등급 굴림) → 그 단계 상자 보상 배율(퍼밀)
export const BLESS_P = [600, 280, 100, 20];
export const BLESS_X = [1000, 1300, 1700, 2500];

// 꾸미기 — 보유 수 합계 보너스(작게): 10개마다 체력% +5 · 경험치 +3 (최대 20단계)
export const COSMETIC_STEP = 10, COSMETIC_HP_P = 5, COSMETIC_EXP_P = 3, COSMETIC_MAX_STEPS = 20;

// 하루 얻는 것(기준 플레이어 — 미션·수련동·상점) — S5 시뮬과 S7 보상표가 같이 쓴다
export const DAILY = { pull: { weapon: 6, pal: 8, relic: 4 }, essence: 40, heart: 6, cosmetic: 0.4 };
// 시즌 시작 선물(길잡이) — 첫날 뽑기권
export const START_PULLS = { weapon: 20, pal: 30, relic: 10 };
