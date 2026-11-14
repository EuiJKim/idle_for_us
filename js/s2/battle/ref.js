// 새 시즌(S2) 기준 무인 · 몹 만들기 — 「그 레벨에 보통으로 큰 무인」과, 그 무인에 맞춘 몹(계획서 §J3).
// 기준 무인의 성장 배율(refGrowth)은 S3~S5에서 실제 시스템(장비·경지·병기…)이 생기면 시뮬로 다시 맞춘다.
import { baseAtk, baseHp, baseDef, statPointsAt, MAIN_TO_ATK, MAIN_TO_HP, JOBS } from '../tables/char.js';
import { KILL_SEC, SURVIVE_HITS, TIER_HP_X, HP_FIT } from '../tables/economy.js';
import { expected } from './damage.js';

// 성장 배율(맨몸 대비) — 장비·성장 시스템 몫의 자리표시. 레벨이 오를수록 커진다.
export const refGrowth = (L) => ({ atk: 1 + 0.02 * L + 0.00012 * L * L, hp: 1 + 0.015 * L + 0.0001 * L * L });

export const SKILL_BASE = { coef: 1000, base: true };
export const SKILL_MAIN = { coef: 2600, cdMs: 6000, base: false };

export function refPlayer(L, job = 'sword') {
  const g = refGrowth(L);
  const pts = statPointsAt(L);
  return {
    lv: L, job, kind: 'hero',
    st: {
      atk: Math.round((baseAtk(L) + pts * MAIN_TO_ATK) * g.atk),
      hp: Math.round((baseHp(L) + pts * MAIN_TO_HP) * g.hp),
      def: Math.round(baseDef(L) * g.hp),
      crit: 100, critDmg: 300,
    },
  };
}
// 기준 무인이 몹(방어 def)을 칠 때의 기대 DPS(초당) — 평타 + 주력 무공(쿨마다 한 번)
export function refDps(p, mob) {
  const J = JOBS[p.job];
  const base = expected(p, mob, SKILL_BASE) * (1000 / J.baseMs);
  const main = expected(p, mob, SKILL_MAIN) * (1000 / SKILL_MAIN.cdMs);
  return base + main;
}
// 몹: kind 'mob' | 'elite' | 'boss' · tier 0~2
export function makeMob(L, kind = 'mob', tier = 0, job = 'sword') {
  const ref = refPlayer(L, job);
  const mob = { lv: L, kind, tier, boss: kind === 'boss', st: { def: Math.round(baseDef(L) * (kind === 'mob' ? 1 : 1.5)), atk: 0, hp: 1 } };
  const dps = refDps(ref, mob);
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
