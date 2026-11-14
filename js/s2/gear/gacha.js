// 새 시즌(S4) 장비 뽑기 레벨 — 은자로 뽑기 → 뽑기 경험치 → 레벨업(대기 시간) → 높은 등급 확률 ↑.
// 뽑기 10회마다 사냥터에 정예 하나(행운이면 셋) — 정예를 잡으면 장비가 더 떨어진다(계획서 §G2).
import { SLOTS, GACHA_LV_MAX, gachaWeights, gachaExpNeed, gachaWaitMin, ELITE_EVERY, LUCKY_P, LUCKY_COUNT } from '../tables/gear.js';
import { gachaCost } from '../tables/gearstat.js';
import { makeGear } from './gear.js';
import { pay, scale } from '../core/cost.js';

export const newGacha = () => ({ lv: 1, exp: 0, wait: null, pulls: 0, eliteQ: 0 });

// n회 뽑기 → 장비 목록 · 정예 대기열 늘림
export function pull(GA, n, rng, wallet, heroLv, { ticket = false } = {}) {
  if (!pay(wallet, ticket ? [{ k: 'ticket:gear', n }] : scale(gachaCost(heroLv, GA.lv), n))) return null;
  const w = gachaWeights(GA.lv);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(makeGear(rng, SLOTS[rng.int(SLOTS.length)], rng.pick(w)));
    GA.pulls++;
    if (GA.lv < GACHA_LV_MAX && !GA.wait) GA.exp++;
    if (GA.pulls % ELITE_EVERY === 0) GA.eliteQ += rng.roll(LUCKY_P) ? LUCKY_COUNT : 1;
  }
  return out;
}
// 레벨업 시작(경험치가 차면) — 대기 시간이 지나야 오른다
export function canLevelUp(GA) { return GA.lv < GACHA_LV_MAX && !GA.wait && GA.exp >= gachaExpNeed(GA.lv); }
export function startLevelUp(GA, nowMs) {
  if (!canLevelUp(GA)) return false;
  GA.wait = { endMs: nowMs + gachaWaitMin(GA.lv) * 60000 };
  return true;
}
export function tickGacha(GA, nowMs) {
  if (GA.wait && nowMs >= GA.wait.endMs) { GA.exp -= gachaExpNeed(GA.lv); GA.lv++; GA.wait = null; return true; }
  return false;
}
// 정예 처치 → 장비 셋(뽑기 레벨 확률, 한 단계 위 쪽으로 기울임)
export function eliteDrop(GA, rng) {
  const w = gachaWeights(Math.min(GACHA_LV_MAX, GA.lv + 2));
  return Array.from({ length: 3 }, () => makeGear(rng, SLOTS[rng.int(SLOTS.length)], rng.pick(w)));
}
