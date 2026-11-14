// 새 시즌(S5) 경지(계정 공용 성장) · 강호행(두목 도장 깨기 판) · 꾸미기 합계 보너스(계획서 §G 7·10·11).
import { REALM_MAX, REALM_ATK_P, REALM_HP_P, realmCost, HEART_POOL, heartLines, heartCost, JOURNEY_MAX, JOURNEY_STEP_P, journeyCost, JOURNEY_POOL, BLESS_P, BLESS_X, COSMETIC_STEP, COSMETIC_HP_P, COSMETIC_EXP_P, COSMETIC_MAX_STEPS } from '../tables/s5.js';
import { realmWaitMin, JOURNEY_STEP_WAIT_MIN } from '../tables/economy.js';
import { newRoller, reroll, rollerStats } from '../core/roller.js';
import { pay } from '../core/cost.js';

// ── 경지 ──
export const newRealm = () => ({ lv: 0, wait: null, heart: newRoller(3) });
export function realmStart(R, nowMs, wallet, goldPerMob) {
  if (R.wait || R.lv >= REALM_MAX || !pay(wallet, realmCost(R.lv, goldPerMob))) return false;
  R.wait = { endMs: nowMs + realmWaitMin(R.lv + 1) * 60000 };
  return true;
}
export function realmTick(R, nowMs) { if (R.wait && nowMs >= R.wait.endMs) { R.wait = null; R.lv++; return true; } return false; }
export const realmRush = (R, ms) => { if (R.wait) R.wait.endMs -= Math.max(0, ms); };
// 심법 굴리기 — 열린 줄만(경지 10레벨마다 하나). 잠금은 열린 줄 안에서만 센다
export function heartRoll(R, rng, wallet) {
  const open = heartLines(R.lv);
  if (!open) return false;
  const H = R.heart;
  const view = { lines: H.lines.slice(0, open), lock: H.lock.filter((i) => i < open), mastery: H.mastery, rolls: H.rolls };
  if (!reroll(view, HEART_POOL, rng, wallet, heartCost)) return false;
  for (let i = 0; i < open; i++) H.lines[i] = view.lines[i];
  H.mastery = view.mastery; H.rolls = view.rolls;
  return true;
}
export function realmSources(R) {
  const st = { atkL2: R.lv * REALM_ATK_P, hpP: R.lv * REALM_HP_P };
  for (const [k, v] of Object.entries(rollerStats({ lines: R.heart.lines.slice(0, heartLines(R.lv)) }))) st[k] = (st[k] || 0) + v;
  return [{ src: '경지', stats: st }];
}

// ── 강호행 ── 단계마다: 두목을 이기면(cleared) → 열기(은자 + 대기 시간) → 최종 피해③ + 축복 등급 + 옵션 2줄
export const newJourney = () => ({ step: 0, cleared: 0, wait: null, opts: [], bless: [] });
export function journeyStart(J, nowMs, wallet, rng) {
  if (J.wait || J.step >= JOURNEY_MAX || J.cleared <= J.step || !pay(wallet, journeyCost(J.step))) return false;
  const [a, b] = JOURNEY_STEP_WAIT_MIN;
  J.wait = { endMs: nowMs + Math.round(a + ((b - a) * J.step) / JOURNEY_MAX) * 60000 };
  J.bless.push(rng.pick(BLESS_P));
  return true;
}
export function journeyTick(J, nowMs, rng) {
  if (!(J.wait && nowMs >= J.wait.endMs)) return false;
  J.wait = null; J.step++;
  const R = newRoller(2);
  reroll(R, JOURNEY_POOL, rng, { 'item:free': 1 }, [{ k: 'item:free', n: 0 }]);
  J.opts.push(R.lines);
  return true;
}
export const blessX = (J, step) => BLESS_X[J.bless[step] ?? 0];
export function journeySources(J) {
  const st = { final3: J.step * JOURNEY_STEP_P };
  for (const lines of J.opts) for (const l of lines) if (l) st[l.k] = (st[l.k] || 0) + l.v;
  return [{ src: '강호행', stats: st }];
}

// ── 꾸미기 ── 보유 수 합계 보너스
export function cosmeticSources(owned) {
  const n = Math.min(COSMETIC_MAX_STEPS, Math.floor(owned / COSMETIC_STEP));
  return n ? [{ src: '꾸미기', stats: { hpP: n * COSMETIC_HP_P, expP: n * COSMETIC_EXP_P } }] : [];
}
