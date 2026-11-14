// 새 시즌(S5) 수집형 공용 틀 — 병기 · 동료 · 영물(계획서 §G 6·8·9).
// 뽑기(천장 · 10연 보장) → 겹치면 각성 → 정수로 레벨 → 장착 칸 · 보유만 해도 수집 옵션 · 전체 각성 합이 모두에 배율.
import { PULL_P, PULL_PITY, PULL_TEN_FLOOR } from '../tables/option.js';
import { COLLECT, AWAKE_NEED, AWAKE_MAX, AWAKE_STEP_P, TOTAL_AWAKE_P, TOTAL_AWAKE_CAP, COLLECT_LV_MAX, COLLECT_LV_P, collectLvCost } from '../tables/s5.js';
import { pay } from '../core/cost.js';

// 종류 번호 → 등급(고정): 종류를 등급별로 나눠 둔다(보 1/10 · 진 2/10 · 정 2/10 · 양 2/10 · 범 3/10)
export function kindGrade(sys, i) {
  const n = COLLECT[sys].kinds, f = i / n;
  return f < 0.1 ? 4 : f < 0.3 ? 3 : f < 0.5 ? 2 : f < 0.7 ? 1 : 0;
}
export const kindsOfGrade = (sys, g) => Array.from({ length: COLLECT[sys].kinds }, (_, i) => i).filter((i) => kindGrade(sys, i) === g);
export const newCollect = (sys) => ({ sys, own: {}, eq: Array.from({ length: COLLECT[sys].slots }, () => null), pity: 0 });

// n번 뽑기(뽑기권 'ticket:<sys>') — 10연이면 정품 이상 하나 보장 · 천장: PULL_PITY번 안에 보 하나
export function pullCollect(C, n, rng, wallet) {
  if (!pay(wallet, [{ k: `ticket:${C.sys}`, n }])) return null;
  const got = [];
  for (let i = 0; i < n; i++) {
    let g = rng.pick(PULL_P);
    C.pity++;
    if (C.pity >= PULL_PITY) g = 4;
    if (n >= 10 && i === n - 1 && !got.some((x) => x.g >= PULL_TEN_FLOOR) && g < PULL_TEN_FLOOR) g = PULL_TEN_FLOOR;
    if (g === 4) C.pity = 0;
    const ks = kindsOfGrade(C.sys, g);
    const k = ks[rng.int(ks.length)];
    const o = (C.own[k] ??= { n: 0, awk: 0, lv: 1 });
    o.n++;
    got.push({ k, g });
  }
  return got;
}
// 각성 — 겹친 수(첫 하나 빼고)로
export function awaken(C, k) {
  const o = C.own[k];
  if (!o || o.awk >= AWAKE_MAX) return false;
  const need = AWAKE_NEED[o.awk];
  if (o.n - 1 < need) return false;
  o.n -= need; o.awk++;
  return true;
}
export function autoAwaken(C) { let c = 0; for (const k of Object.keys(C.own)) while (awaken(C, +k)) c++; return c; }
export function levelUp(C, k, wallet) {
  const o = C.own[k];
  if (!o || o.lv >= COLLECT_LV_MAX || !pay(wallet, collectLvCost(o.lv))) return false;
  o.lv++;
  return true;
}
// 장착: 좋은 것부터 자동(등급 → 각성 → 레벨)
export function autoEquip(C) {
  const order = Object.keys(C.own).map(Number).sort((a, b) => kindGrade(C.sys, b) - kindGrade(C.sys, a) || C.own[b].awk - C.own[a].awk || C.own[b].lv - C.own[a].lv);
  C.eq = C.eq.map((_, i) => order[i] ?? null);
}
export const totalAwake = (C) => Object.values(C.own).reduce((a, o) => a + o.awk, 0);
// 스탯 출처: 장착(그 층) + 보유(수집 옵션) · 전체 각성 배율
export function collectSources(C) {
  const D = COLLECT[C.sys];
  const mul = 1 + Math.min(TOTAL_AWAKE_CAP, totalAwake(C) * TOTAL_AWAKE_P) / 1000;
  let eq = 0, own = 0;
  C.eq.forEach((k, i) => {
    if (k == null) return;
    const o = C.own[k], g = kindGrade(C.sys, k);
    const v = D.equip[g] * (1 + (o.awk * AWAKE_STEP_P) / 1000) * (1 + (o.lv * COLLECT_LV_P) / 1000);
    eq += i === 0 || !D.subShare ? v : v * D.subShare;
  });
  for (const [k, o] of Object.entries(C.own)) own += D.own[kindGrade(C.sys, +k)] * (1 + (o.awk * AWAKE_STEP_P) / 1000);
  const st = {};
  st[D.layer] = Math.round(eq * mul);
  st[D.ownStat] = (st[D.ownStat] || 0) + Math.round(own * mul);
  return [{ src: D.name, stats: st }];
}
