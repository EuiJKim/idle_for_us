// 새 시즌(S4) 장비 — 한 벌 만들기 · 칸(강화·성혼·칸 옵션) · 장착 · 프리셋 · 분해 · 스탯 출처.
import { SLOTS, GRADES, UPPER_P, SUBOPT_COUNT_P } from '../tables/gear.js';
import { tierOf, itemLv, mainStats, SUB_POOL, SUB_TIER_X, ENH_MAIN_P, STAR_MAIN_P, STAR_SUB_P, SET, enhOk, enhCost, starCost, dismantle, subRerollCost } from '../tables/gearstat.js';
import { starOdds, STAR_MAX, PITY_POINTS, pityGain, DOWN_FROM, BREAK_FROM, PROTECT_FROM, PROTECT_TO, PROTECT_DOWN_COST_X, PROTECT_BREAK_COST_X } from '../tables/star.js';
import { ENH_MAX } from '../tables/gear.js';
import { pay, scale, merge } from '../core/cost.js';

let UID = 0;
export const setUidBase = (n) => { UID = n; };

function rollSub(rng, t) {
  const s = SUB_POOL[rng.pick(SUB_POOL.map((x) => x.w))];
  return { k: s.k, v: Math.round(rng.range(s.v[0], s.v[1]) * SUB_TIER_X(t)) };
}
// 장비 한 벌(등급 g는 뽑기에서 정한다)
export function makeGear(rng, slot, g) {
  const up = rng.roll(UPPER_P) ? 1 : 0, t = tierOf(g, up);
  const n = rng.pick(SUBOPT_COUNT_P);
  const subs = Array.from({ length: n }, () => rollSub(rng, t));
  return { uid: ++UID, slot, g, up, subs, rr: 0, lock: false };
}
export const gearName = (it) => `${GRADES[it.g]}품${it.up ? '上' : ''}`;
export const gearTier = (it) => tierOf(it.g, it.up);

// 칸 하나: { enh, star, broken, pity }
export const newSlot = () => ({ enh: 0, star: 0, broken: 0, pity: 0 });
export const newGearState = () => ({ eq: Object.fromEntries(SLOTS.map((s) => [s, null])), slots: Object.fromEntries(SLOTS.map((s) => [s, newSlot()])), bag: [], presets: [null, null, null], autoDis: -1 });

// 장비 한 벌 + 칸 → 스탯
export function itemStats(it, slot, heroLv) {
  const t = gearTier(it), L = itemLv(it.g, heroLv);
  const st = slot.broken ? 0 : slot.star;
  const mainX = (1000 + slot.enh * ENH_MAIN_P + st * STAR_MAIN_P) / 1000;
  const subX = (1000 + st * STAR_SUB_P) / 1000;
  const o = {};
  for (const [k, v] of Object.entries(mainStats(it.slot, t, L))) o[k] = Math.round(v * mainX);
  for (const s of it.subs) o[s.k] = (o[s.k] || 0) + Math.round(s.v * subX);
  return o;
}
// 장착한 것 전부 → 스탯 출처 목록(세트 포함)
export function gearSources(G, heroLv) {
  const out = [];
  const cnt = {};
  for (const s of SLOTS) {
    const it = G.eq[s];
    if (!it) continue;
    out.push({ src: `장비:${s}`, stats: itemStats(it, G.slots[s], heroLv) });
    cnt[it.g] = (cnt[it.g] || 0) + 1;
  }
  // 세트: 「그 등급 이상」 부위 수로(높은 등급이 낮은 세트도 채움)
  for (let g = 6; g >= 0; g--) {
    const n = Object.entries(cnt).filter(([k]) => +k >= g).reduce((a, [, v]) => a + v, 0);
    const best = SET.filter((x) => n >= x.n).at(-1);
    if (best) { out.push({ src: `세트:${GRADES[g]}`, stats: { atkL1: best.atkL1 * (g + 1) / 4, hpP: best.hpP * (g + 1) / 4 } }); break; }
  }
  return out;
}
// 장비 점수(같은 칸 기준 비교용) — 공격 쪽 가중
export function gearScore(it, heroLv) {
  const st = itemStats(it, newSlot(), heroLv);
  return (st.atk || 0) * 4 + (st.hp || 0) * 0.5 + (st.def || 0) * 1.5 + ((st.atkL1 || 0) + (st.critDmg || 0) / 2 + (st.bossDmg || 0) / 2 + (st.crit || 0) * 2) * 30;
}
// 가방에 넣고, 더 좋으면 장착(자동) · 자동 분해(등급 autoDis 이하)
export function obtain(G, items, heroLv, wallet) {
  const got = [];
  for (const it of items) {
    const cur = G.eq[it.slot];
    if (!cur || gearScore(it, heroLv) > gearScore(cur, heroLv)) {
      if (cur) G.bag.push(cur);
      G.eq[it.slot] = it;
      got.push({ it, equipped: true });
    } else G.bag.push(it);
  }
  // 자동 분해
  if (G.autoDis >= 0) {
    const keep = [], mats = [];
    for (const it of G.bag) { if (!it.lock && it.g <= G.autoDis) mats.push(...dismantle(it.g)); else keep.push(it); }
    G.bag = keep;
    if (wallet && mats.length) for (const c of merge(mats)) wallet[c.k] = (wallet[c.k] || 0) + c.n;
  }
  return got;
}
export function dismantleItem(G, uid, wallet) {
  const i = G.bag.findIndex((x) => x.uid === uid && !x.lock);
  if (i < 0) return false;
  const [it] = G.bag.splice(i, 1);
  for (const c of dismantle(it.g)) wallet[c.k] = (wallet[c.k] || 0) + c.n;
  return true;
}
// 장착 해제 — 가방으로
export function unequip(G, slot) { const it = G.eq[slot]; if (!it) return false; G.bag.push(it); G.eq[slot] = null; return true; }
// 손으로 장착 — 가방에서 꺼내고, 끼고 있던 건 가방으로
export function equip(G, uid) {
  const i = G.bag.findIndex((x) => x.uid === uid);
  if (i < 0) return false;
  const [it] = G.bag.splice(i, 1);
  if (G.eq[it.slot]) G.bag.push(G.eq[it.slot]);
  G.eq[it.slot] = it;
  return true;
}
// 프리셋: 장착한 장비 uid 묶음 저장·불러오기
export function savePreset(G, n) { G.presets[n] = Object.fromEntries(Object.entries(G.eq).map(([s, it]) => [s, it?.uid ?? null])); }
export function loadPreset(G, n) {
  const p = G.presets[n];
  if (!p) return false;
  const all = [...G.bag, ...Object.values(G.eq).filter(Boolean)];
  const eq = {};
  for (const [s, uid] of Object.entries(p)) eq[s] = all.find((x) => x.uid === uid) || null;
  G.bag = all.filter((x) => !Object.values(eq).includes(x));
  G.eq = eq;
  return true;
}

// ── 칸 강화 ──
export function enhance(G, slot, rng, wallet, heroLv) {
  const S = G.slots[slot];
  if (S.enh >= ENH_MAX) return null;
  if (!pay(wallet, enhCost(S.enh, heroLv))) return null;
  const ok = rng.roll(enhOk(S.enh));
  if (ok) S.enh++;
  return ok;
}
// ── 칸 성혼 ── opts: { noDown, noBreak } 방지 · 결과 'ok' | 'fail' | 'down' | 'break'
export function starForce(G, slot, rng, wallet, heroLv, opts = {}) {
  const S = G.slots[slot];
  if (S.broken || S.star >= STAR_MAX) return null;
  const s = S.star;
  let cost = starCost(s, heroLv);
  const noDown = opts.noDown && s >= DOWN_FROM, noBreak = opts.noBreak && s >= PROTECT_FROM && s <= PROTECT_TO;
  if (noDown) cost = merge(cost, scale(starCost(s, heroLv), PROTECT_DOWN_COST_X));
  if (noBreak) cost = merge(cost, scale(starCost(s, heroLv), PROTECT_BREAK_COST_X));
  if (!pay(wallet, cost)) return null;
  if (S.pity >= PITY_POINTS) { S.pity = 0; S.star++; return 'ok'; }   // 실패 누적이 차면 확정
  const o = starOdds(s);
  const r = rng.int(1000);
  if (r < o.ok) { S.star++; S.pity = 0; return 'ok'; }
  S.pity += pityGain(s);
  if (r < o.ok + o.brk && s >= BREAK_FROM) { if (noBreak) return 'fail'; S.broken = S.star; S.star = 0; return 'break'; }
  if (r < o.ok + o.brk + o.down && s >= DOWN_FROM) { if (noDown) return 'fail'; S.star--; return 'down'; }
  return 'fail';
}
// 파괴된 칸 복구(복구 주문서 1장) — 파괴 직전 별의 절반 아래로 돌아감(최소 12)
export function restoreSlot(G, slot, wallet) {
  const S = G.slots[slot];
  if (!S.broken || !pay(wallet, [{ k: 'item:restore', n: 1 }])) return false;
  S.star = Math.max(12, S.broken - 3);
  S.broken = 0;
  return true;
}
// 부옵션 다시 굴리기(장비 하나 · 잠근 줄 제외) — 바꾼 횟수만큼 비용 ↑
export function rerollSubs(it, rng, wallet, lockIdx = []) {
  if (!pay(wallet, subRerollCost(it.rr))) return false;
  const t = gearTier(it);
  it.subs = it.subs.map((s, i) => (lockIdx.includes(i) ? s : rollSub(rng, t)));
  it.rr++;
  return true;
}
