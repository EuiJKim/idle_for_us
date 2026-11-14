// 새 시즌(S4) 무작위 옵션 공용 틀(계획서 §G3) — 경지 심법 · 영물 숨은 힘 · 강호행 단계 · 칸 옵션이 같이 쓴다.
// 줄마다 등급(일반·희귀·영웅·전설)과 스탯 하나. 다시 굴리기(잠금 수만큼 비용 ↑) · 굴림 숙련 · 저장 · 자동 굴리기.
import { OPT_GRADES, optWeights, masteryNeed, masteryUpP, MASTERY_MAX, LOCK_COST_X } from '../tables/option.js';
import { pay, scale } from './cost.js';

// pool: [{ k:'스탯', v:[일반 값, 희귀, 영웅, 전설], w:가중치 }] · lines: 줄 수
export function newRoller(lines) { return { lines: Array.from({ length: lines }, () => null), lock: [], mastery: 0, rolls: 0, saved: [] }; }

function rollLine(R, pool, rng) {
  const g = rng.pick(optWeights(R.mastery));
  const p = pool[rng.pick(pool.map((x) => x.w))];
  return { g, k: p.k, v: p.v[g] };
}
// 다시 굴리기 — baseCost는 줄 잠금 0개일 때 비용
export function reroll(R, pool, rng, wallet, baseCost) {
  const lockN = R.lock.length;
  if (lockN >= R.lines.length) return false;
  if (!pay(wallet, scale(baseCost, LOCK_COST_X[Math.min(lockN, LOCK_COST_X.length - 1)]))) return false;
  R.lines = R.lines.map((l, i) => (R.lock.includes(i) && l ? l : rollLine(R, pool, rng)));
  R.rolls++;
  if (R.mastery < MASTERY_MAX && R.rolls >= masteryNeed(R.mastery) && rng.roll(masteryUpP(R.mastery))) { R.mastery++; R.rolls = 0; }
  return true;
}
export const toggleLock = (R, i) => { R.lock = R.lock.includes(i) ? R.lock.filter((x) => x !== i) : [...R.lock, i]; };
export const rollerStats = (R) => { const o = {}; for (const l of R.lines) if (l) o[l.k] = (o[l.k] || 0) + l.v; return o; };
export const saveSet = (R, n) => { R.saved[n] = R.lines.map((l) => (l ? { ...l } : null)); };
export const loadSet = (R, n) => { if (!R.saved[n]) return false; R.lines = R.saved[n].map((l) => (l ? { ...l } : null)); return true; };
// 자동 굴리기 — 목표(want(lines)가 참)까지 최대 max번. 굴린 수를 돌려준다
export function autoRoll(R, pool, rng, wallet, baseCost, want, max = 100) {
  let n = 0;
  while (n < max && !want(R.lines)) { if (!reroll(R, pool, rng, wallet, baseCost)) break; n++; }
  return n;
}
export { OPT_GRADES };
