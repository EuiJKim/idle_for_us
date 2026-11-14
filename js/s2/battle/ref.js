// 새 시즌 기준 무인 · 몹 만들기 — 「그 레벨에 보통으로 큰 무인」과, 그 무인에 맞춘 몹(계획서 §J3).
// v483(S5): 기준 무인 = 표준 무인 표(tables/std.js) — 기준 플레이어가 그 레벨에 닿은 날 실제 시스템(무인·장비·S5)으로 가진 스탯.
import { baseDef, JOBS } from '../tables/char.js';
import { STD } from '../tables/std.js';
import { KILL_SEC, SURVIVE_HITS, TIER_HP_X, HP_FIT } from '../tables/economy.js';
import { expected } from './damage.js';
import { stdKit, battleKit } from '../tables/kit.js';
import { JOB_LV } from '../tables/progress.js';


export const SKILL_BASE = { coef: 1000, base: true };
export const SKILL_MAIN = { coef: 2600, cdMs: 6000, base: false };

export const advAt = (L) => JOB_LV.filter((lv, n) => n > 0 && L >= lv).length;
export function refPlayer(L, job = 'sword') {
  const Lc = Math.max(1, Math.min(STD.length - 1, Math.round(L) || 1));
  // v493 표준 무공 세트: 그 레벨까지 열린 공격 무공 · 버프(6칸) — 몹 체력 기준이 된다
  return { lv: L, job, kind: 'hero', st: { ...STD[Lc] }, kit: battleKit(stdKit(Lc, job, advAt(Lc))) };
}
// 무공 세트로 한 대상에게 넣는 초당 기대 피해(연타 합 · 쿨마다 한 번). 세트가 없으면 옛 주력 무공 하나
// aoe: 한 번에 맞는 몹 수 가정(일반 몹 사냥터는 FARM_AOE — 여러 마리를 쓸어 담는 무공이 그만큼 몹 하나를 빨리 잡는 셈)
export const FARM_AOE = 2;
export function kitDps(p, mob, aoe = 1) {
  if (!p.kit) return expected(p, mob, SKILL_MAIN) * (1000 / SKILL_MAIN.cdMs);
  let d = 0;
  for (const k of p.kit) if (k.kind === 'active') d += expected(p, mob, { coef: k.coef * k.hits }) * (1000 / k.cdMs) * Math.min(k.maxT, aoe);
  return d;
}
// 기준 무인이 몹(방어 def)을 칠 때의 기대 DPS(초당) — 평타 + 무공 세트
export function refDps(p, mob, aoe = 1) {
  const J = JOBS[p.job];
  return expected(p, mob, SKILL_BASE) * (1000 / J.baseMs) + kitDps(p, mob, aoe);
}
// 몹: kind 'mob' | 'elite' | 'boss' · tier 0~2
export function makeMob(L, kind = 'mob', tier = 0, job = 'sword') {
  const ref = refPlayer(L, job);
  const mob = { lv: L, kind, tier, boss: kind === 'boss', st: { def: Math.round(baseDef(L) * (kind === 'mob' ? 1 : 1.5)), atk: 0, hp: 1 } };
  const dps = refDps(ref, mob, kind === 'mob' ? FARM_AOE : 1);
  mob.st.hp = Math.max(1, Math.round(dps * KILL_SEC[kind] * TIER_HP_X[tier] * HP_FIT[kind]));
  // 몹 공격: 기준 무인이 일반 40타 · 두목 8타를 버티게(받는 쪽 방어 반영해 역산)
  const hits = SURVIVE_HITS[kind];
  const want = ref.st.hp / hits;
  const probe = { ...mob, st: { ...mob.st, atk: 1000 } };
  const per1000 = expected(probe, ref, SKILL_BASE);
  mob.st.atk = Math.max(1, Math.round((1000 * want) / per1000 * (1 + (TIER_HP_X[tier] - 1) / 2)));
  mob.atkMs = kind === 'boss' ? 1600 : 1500;
  return mob;
}
