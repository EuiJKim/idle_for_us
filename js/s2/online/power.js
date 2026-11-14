// 새 시즌(S8) 전투력(§F1) — 버프는 빼고, 같은 레벨 기준 상대에게 기대 DPS × 유효 체력의 가중 곱.
import { expected } from '../battle/damage.js';
import { makeMob, refPlayer, SKILL_BASE, SKILL_MAIN } from '../battle/ref.js';
import { JOBS } from '../tables/char.js';
import { POWER_W, POWER_K } from '../tables/online.js';

// f가 상대 d를 칠 때 초당 기대 피해(평타 + 주력 무공)
export function dpsVs(f, d) {
  const J = JOBS[f.job] || JOBS.sword;
  return expected(f, d, SKILL_BASE) * (1000 / J.baseMs) + expected(f, d, SKILL_MAIN) * (1000 / SKILL_MAIN.cdMs);
}
// 유효 체력: 같은 공격을 받을 때 기준 무인보다 몇 배 버티나 × 기준 체력
export function ehpVs(f, attacker) {
  const per = expected(attacker, f, SKILL_BASE);
  return (f.st.hp || 1) / Math.max(1e-9, per);
}
export function power(f, mode = 'pve') {
  const W = POWER_W[mode];
  const L = f.lv || 1;
  const foe = mode === 'pve' ? makeMob(L, 'mob') : refPlayer(L, f.job);
  const probe = mode === 'pve' ? { ...foe, st: { ...foe.st, atk: 1000 } } : foe;
  return Math.round(POWER_K * Math.pow(dpsVs(f, foe), W.dps) * Math.pow(ehpVs(f, probe), W.ehp));
}
export const stdPower = (L, mode = 'pve', job = 'sword') => power(refPlayer(L, job), mode);
