// 새 시즌(S4) 장비 숫자 — 주옵션 · 부옵션 · 레벨 따라감 · 강화 · 성혼 배율 · 세트 · 은자(계획서 §G2 · §J5).
// 등급 단 t = 등급×2 + 上(0~13). 강화·성혼은 장비가 아니라 「칸」에 붙는다(장비를 바꿔도 남음).
import { baseAtk, baseHp, baseDef } from './char.js';

export const tierOf = (g, up) => g * 2 + (up ? 1 : 0);
export const TIER_X = (t) => Math.pow(1.12, t);           // 단마다 12% ↑
// 장비 레벨 상한 — 등급마다(이보다 높은 레벨은 따라가지 않음)
export const LV_CAP = [30, 55, 80, 105, 130, 150, 150];
export const itemLv = (g, heroLv) => Math.min(heroLv, LV_CAP[g]);

// 주옵션(부위마다) — 무인 레벨 기본값의 몇 배
export const MAIN = {
  weapon: { atk: 0.26 },
  hat: { hp: 0.05, def: 0.10 }, top: { hp: 0.07, def: 0.14 }, bottom: { hp: 0.06, def: 0.12 }, glove: { hp: 0.03, def: 0.05, atk: 0.03 },
  shoes: { hp: 0.04, def: 0.06 }, cape: { hp: 0.04, def: 0.08 }, belt: { hp: 0.04, def: 0.06 },
  neck: { atk: 0.06, hp: 0.02 }, ring: { atk: 0.06 },
};
export function mainStats(slot, t, L) {
  const m = MAIN[slot], x = TIER_X(t), o = {};
  if (m.atk) o.atk = Math.round(baseAtk(L) * m.atk * x);
  if (m.hp) o.hp = Math.round(baseHp(L) * m.hp * x);
  if (m.def) o.def = Math.round(baseDef(L) * m.def * x);
  return o;
}
// 부옵션 — 한 줄에 스탯 하나 · 값은 [최소, 최대] × 단 배율(퍼밀 스탯)
export const SUB_POOL = [
  { k: 'atkL1', v: [8, 20], w: 20 }, { k: 'hpP', v: [10, 25], w: 15 }, { k: 'defP', v: [10, 25], w: 10 },
  { k: 'crit', v: [5, 12], w: 12 }, { k: 'critDmg', v: [15, 35], w: 12 }, { k: 'bossDmg', v: [10, 25], w: 10 },
  { k: 'mobDmg', v: [10, 25], w: 8 }, { k: 'pierce', v: [5, 12], w: 5 }, { k: 'goldP', v: [10, 30], w: 4 }, { k: 'expP', v: [5, 15], w: 4 },
];
export const SUB_TIER_X = (t) => 1 + 0.07 * t;
// 강화(칸): +0~+20 · 한 단계마다 주옵션 +6% · 성공 확률(퍼밀) · 실패해도 안 깨짐
export const ENH_MAIN_P = 60;
export const enhOk = (e) => Math.max(300, 1000 - e * 35);
// 성혼(칸): 별 하나마다 주옵션 +4% · 부옵션 +3%
export const STAR_MAIN_P = 28, STAR_SUB_P = 20;
// 세트: 같은 등급(본·上 무관) N부위 이상 → 공격%①·체력%
export const SET = [{ n: 4, atkL1: 15, hpP: 15 }, { n: 7, atkL1: 30, hpP: 30 }, { n: 10, atkL1: 50, hpP: 50 }];

// ── 은자 ──
// 몹 한 마리 은자(레벨) · 비용은 모두 이걸 기준으로
export const goldPerMob = (L) => Math.round(4 * Math.pow(L, 1.25) + 6);
// 장비 뽑기 1회 비용 — 몹 몇 마리 몫
// 뽑기 레벨이 오를수록 비싸진다(초반은 싸게 많이)
export const gachaCostMobs = (glv) => 50 + 12 * glv;
export const gachaCost = (L, glv = 1) => [{ k: 'gold', n: goldPerMob(L) * gachaCostMobs(glv) }];
// 강화 비용(칸 강화 단계 e) · 성혼 비용(별 s)
export const enhCost = (e, L) => [{ k: 'gold', n: Math.round(goldPerMob(L) * 20 * Math.pow(1.25, e)) }];
export const starCost = (s, L) => [{ k: 'gold', n: Math.round(goldPerMob(L) * 25 * Math.pow(1.22, s)) }];
// 분해: 등급마다 강화석
export const dismantle = (g) => [{ k: 'item:stone', n: [1, 2, 4, 8, 16, 32, 64][g] }];
// 부옵션 바꾸기 비용(바꾼 횟수 n) — 강화석
export const subRerollCost = (n) => [{ k: 'item:stone', n: 5 + 3 * Math.min(n, 30) }];
