// v634 뜻대로 굴리기 — 옵션 줄을 「원하는 스탯 · 최소 등급 · 줄 수」가 나올 때까지(쓸 한도 안에서) 굴린다.
// 쓰는 곳 셋: 경지 심법(S.realm.heart) · 강호행 단계 옵션 2줄(S.journey.opts[i]) · 장비 부옵션(가방 · 낀 장비 uid).
// 잠근 줄은 그대로 두고, 멈춘 뒤에는 굴리기 전 줄을 돌려주어 화면이 「그대로 / 되돌리기」를 고르게 한다.
import { reroll, toggleLock } from './roller.js';
import { heartRoll } from '../grow/realm.js';
import { rerollSubs, gearTier } from '../gear/gear.js';
import { HEART_POOL, heartLines, heartCost, JOURNEY_POOL } from '../tables/s5.js';
import { SUB_POOL, SUB_TIER_X, subRerollCost } from '../tables/gearstat.js';
import { LOCK_COST_X } from '../tables/option.js';
import { scale, canPay } from './cost.js';

export const WISH_MAX_ROLLS = 300;                       // 한 번에 굴리는 상한(한도가 커도)
export const JOUR_WISH_COST = [{ k: 'item:heart', n: 1 }];   // 강호행 단계 줄 다시 굴리기 — 심법 구슬 1(잠근 줄 수만큼 ×2 · ×4)
// 부옵션은 등급이 없어서 값이 범위의 어디쯤인지로 등급을 매긴다: 40% · 70% · 90% 이상 → 희귀 · 영웅 · 전설
export const SUB_GRADE_AT = [400, 700, 900];
export function subGrade(it, s) {
  const p = SUB_POOL.find((x) => x.k === s.k); if (!p) return 0;
  const x = SUB_TIER_X(gearTier(it)), lo = p.v[0] * x, hi = p.v[1] * x;
  const f = hi > lo ? ((s.v - lo) * 1000) / (hi - lo) : 1000;
  return SUB_GRADE_AT.filter((a) => f >= a - 1e-6).length;
}
const lockX = (n) => LOCK_COST_X[Math.min(n, LOCK_COST_X.length - 1)];
function findGear(S, uid) {
  const G = S.gear;
  return G.bag.find((x) => x.uid === uid) || Object.values(G.eq).find((x) => x && x.uid === uid) || null;
}
// 대상 하나 — id: 'heart' | 'jour:<단계 칸>' | 'sub:<uid>'. 없거나 아직 안 열렸으면 null
//   lines: [{k, v, g}] (지금 줄) · lock: 잠근 줄 번호 · cost(): 다음 한 번 값 · roll(rng, wallet): 한 번 굴림 · pool: 고를 수 있는 스탯
export function wishTarget(S, id) {
  if (id === 'heart') {
    const R = S.realm, open = heartLines(R.lv); if (!open) return null;
    const H = R.heart, lock = H.lock.filter((i) => i < open);
    return { id, name: '경지 심법', lines: H.lines.slice(0, open), lock, pool: HEART_POOL.map((p) => p.k),
      cost: () => scale(heartCost, lockX(lock.length)), roll: (rng, w) => heartRoll(R, rng, w),
      set: (L) => { for (let i = 0; i < open; i++) H.lines[i] = L[i] ? { ...L[i] } : null; }, toggle: (i) => i < open && toggleLock(H, i) };
  }
  if (id.startsWith('jour:')) {
    const J = S.journey, i = +id.slice(5), L = J.opts[i]; if (!L) return null;
    const LK = (J.wlk ??= {}), lock = LK[i] || [];
    return { id, name: `강호행 ${i + 1}단계`, lines: L, lock, pool: JOURNEY_POOL.map((p) => p.k),
      cost: () => scale(JOUR_WISH_COST, lockX(lock.length)),
      roll: (rng, w) => { const v = { lines: J.opts[i], lock, mastery: 0, rolls: 0 }; if (!reroll(v, JOURNEY_POOL, rng, w, JOUR_WISH_COST)) return false; J.opts[i] = v.lines; return true; },
      set: (L2) => { J.opts[i] = L2.map((l) => (l ? { ...l } : null)); }, toggle: (k) => { if (k < L.length) { const R = { lock }; toggleLock(R, k); LK[i] = R.lock; } } };
  }
  if (id.startsWith('sub:')) {
    const it = findGear(S, +id.slice(4)); if (!it || !it.subs.length) return null;
    const lock = (it.sl || []).filter((i) => i < it.subs.length);
    return { id, name: '장비 부옵션', lines: it.subs.map((s) => ({ ...s, g: subGrade(it, s) })), lock, pool: SUB_POOL.map((p) => p.k),
      cost: () => subRerollCost(it.rr), roll: (rng, w) => lock.length < it.subs.length && rerollSubs(it, rng, w, lock),
      set: (L) => { it.subs = L.map((s) => ({ k: s.k, v: s.v })); }, toggle: (i) => { if (i < it.subs.length) { const R = { lock }; toggleLock(R, i); it.sl = R.lock; } } };
  }
  return null;
}
// 바람: { keys: [스탯…](비면 아무거나), g: 최소 등급 0~3, n: 맞아야 할 줄 수 } — 잠근 줄도 센다
export function wishHits(lines, want) {
  const ks = want.keys && want.keys.length ? new Set(want.keys) : null;
  return lines.filter((l) => l && (!ks || ks.has(l.k)) && (l.g ?? 0) >= (want.g || 0)).length;
}
export const wishMet = (lines, want) => wishHits(lines, want) >= Math.max(1, Math.min(want.n || 1, lines.length));
const costOf = (c, k) => c.filter((x) => x.k === k).reduce((a, x) => a + x.n, 0);
// 굴리기 — budget: 쓸 재료 상한(그 재료 수). 결과 { id, n 굴린 수, spent, k 재료, why: 'hit'|'already'|'budget'|'short'|'cap'|'locked', old, now }
export function wishRun(S, rng, id, want, budget) {
  const T0 = wishTarget(S, id); if (!T0) return null;
  const old = T0.lines.map((l) => (l ? { ...l } : null)), mat = T0.cost()[0]?.k;
  let n = 0, spent = 0, why = 'cap';
  if (wishMet(T0.lines, want)) why = 'already';
  else if (T0.lock.length >= T0.lines.length) why = 'locked';
  else while (n < WISH_MAX_ROLLS) {
    const T = wishTarget(S, id), c = T.cost(), cn = costOf(c, mat);
    if (spent + cn > budget) { why = 'budget'; break; }
    if (!canPay(S.wallet, c) || !T.roll(rng, S.wallet)) { why = 'short'; break; }
    n++; spent += cn;
    if (wishMet(wishTarget(S, id).lines, want)) { why = 'hit'; break; }
  }
  return { id, n, spent, k: mat, why, old, now: wishTarget(S, id).lines.map((l) => (l ? { ...l } : null)) };
}
// 되돌리기 — 굴린 뒤 줄이 그대로일 때만(다른 데서 또 굴렸으면 안 됨). 쓴 재료는 돌아오지 않는다
export function wishUndo(S, r) {
  const T = r && wishTarget(S, r.id); if (!T || !r.n) return false;
  const same = JSON.stringify(T.lines.map((l) => l && [l.k, l.v])) === JSON.stringify(r.now.map((l) => l && [l.k, l.v]));
  if (!same) return false;
  T.set(r.old);
  return true;
}
export function wishLock(S, id, i) { const T = wishTarget(S, id); if (!T) return false; T.toggle(i); return true; }
// 고를 수 있는 대상 목록(화면 위 칸)
export function wishList(S) {
  const out = [];
  if (heartLines(S.realm.lv)) out.push('heart');
  S.journey.opts.forEach((L, i) => { if (L && L.length) out.push(`jour:${i}`); });
  return out;
}
