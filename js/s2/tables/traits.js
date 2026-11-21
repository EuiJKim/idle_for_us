// v635 병기 · 동료 · 영물 고유 기질 — 종류마다 하나. 낄 때만 켜진다(보유 효과는 그대로 s5.js COLLECT.own).
//   값(퍼밀) = 기질 기본값 × 등급 배율 × (1 + 각성×10%) × (1 + (Lv−1)×1%) × 칸 몫(동료 부 칸 35% · 영물 60%)
//   등급 배율은 장착 값보다 완만하다(범 50% → 보 100%) — 낮은 등급도 기질이 맞으면 쓸 데가 있게.
//   w: 「추천 자동」이 장착 값과 섞어 볼 때의 무게(기질 1퍼밀 ≈ 그 층 w퍼밀)
export const TRAIT = {
  boss: { stat: 'bossDmg', v: 50, w: 0.5, name: '두목 사냥', txt: '두목 피해' },
  mob: { stat: 'mobDmg', v: 50, w: 0.6, name: '쓸어 베기', txt: '일반 몹 피해' },
  crit: { stat: 'crit', v: 25, w: 1.2, name: '급소 보기', txt: '치명 확률' },
  critDmg: { stat: 'critDmg', v: 90, w: 0.35, name: '깊은 상처', txt: '치명 피해' },
  skill: { stat: 'skillP', v: 50, w: 0.6, name: '초식 다듬기', txt: '무공 피해' },
  basic: { stat: 'baseP', v: 70, w: 0.4, name: '손놀림', txt: '평타 피해' },
  cdr: { stat: 'cdr', v: 40, w: 0.8, name: '숨 고르기', txt: '무공 쿨', neg: true },
  heal: { stat: 'killHeal', v: 15, w: 0.6, name: '기 거두기', txt: '처치마다 체력 회복' },
  gold: { stat: 'goldP', v: 70, w: 0.3, name: '재물 운', txt: '은자 획득' },
  exp: { stat: 'expP', v: 40, w: 0.5, name: '깨달음', txt: '경험치' },
  guard: { stat: 'takenDownP', v: 35, w: 0.5, name: '철벽', txt: '받는 피해 감소' },
  pierce: { stat: 'pierce', v: 60, w: 0.35, name: '꿰뚫기', txt: '방어 관통' },
  stun: { stat: 'stunGg', v: 150, w: 0.12, name: '무너뜨리기', txt: '두목 무력화 게이지' },
  splash: { stat: 'splash', v: 250, w: 0.15, name: '한 명 더', txt: '평타가 옆 적 하나 더(피해)' },
};
export const TRAIT_GX = [500, 625, 750, 875, 1000];   // 등급(범 → 보)
export const TRAIT_AWK_P = 100, TRAIT_LV_P = 10;
export const TRAIT_SYS_P = { weapon: 1000, pal: 1000, relic: 600 };   // 동료 부 칸은 여기에 COLLECT.pal.subShare를 더 곱한다
export const CDR_CAP = 300, KILL_HEAL_CAP = 100;
// 종류 번호 차례(collnames.js와 같다)
export const TRAIT_OF = {
  weapon: ['stun', 'boss', 'splash', 'cdr', 'heal', 'pierce', 'crit', 'basic', 'critDmg', 'skill',
    'mob', 'pierce', 'stun', 'crit', 'basic', 'exp', 'splash', 'boss', 'guard', 'gold'],
  pal: ['critDmg', 'boss', 'cdr', 'crit', 'guard', 'splash', 'basic', 'stun', 'gold', 'heal',
    'mob', 'pierce', 'heal', 'guard', 'mob', 'boss', 'gold', 'exp', 'exp', 'gold',
    'cdr', 'skill', 'guard', 'splash', 'skill'],
  relic: ['boss', 'heal', 'cdr', 'critDmg', 'guard', 'skill', 'crit', 'exp', 'basic', 'crit',
    'gold', 'heal', 'splash', 'cdr', 'guard', 'stun', 'pierce', 'gold', 'exp', 'mob',
    'crit', 'basic', 'gold', 'cdr', 'skill', 'guard', 'critDmg', 'mob', 'exp', 'stun'],
};
export const traitOf = (sys, k) => TRAIT_OF[sys]?.[k] || null;
