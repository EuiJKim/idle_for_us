// 새 시즌(S8) 월드보스 — 서버 공동 두목 · 보스 점수(구간표) · 단계(체력 ×1.5씩) · 하루 3번.
import { refPlayer, makeMob } from '../battle/ref.js';
import { dpsVs } from './power.js';
import { WBOSS, WB_SEG, WB_SCORE_UNIT } from '../tables/online.js';

// 기준 피해: 그 레벨 기준 무인이 두목에게 한 번(90초) 넣는 기대 피해
export function refTryDmg(L) {
  const boss = makeMob(L, 'boss');
  return dpsVs(refPlayer(L), boss) * (WBOSS.fightMs / 1000);
}
// 보스 점수: r = 피해 / 기준 피해 → 구간표대로(큰 피해일수록 제곱근·네제곱근으로 덜 오름)
export function bossScore(dmg, L) {
  const r = Math.max(0, dmg) / refTryDmg(L);
  let s = 0, lo = 0, k = 1;   // k: 지금 기울기
  for (const [hi, e] of WB_SEG) {
    if (r <= lo) break;
    const top = Math.min(r, hi);
    if (e === 1 || lo === 0) s += k * (top - lo);
    else s += (k * Math.pow(lo, 1 - e) / e) * (Math.pow(top, e) - Math.pow(lo, e));
    if (lo > 0 && e !== 1) k *= Math.pow(hi / lo, e - 1);
    lo = hi;
  }
  return Math.round(s * WB_SCORE_UNIT);
}
// 단계 체력: 기준 무인(서버 기준 레벨)이 phaseSec초 × phaseX^k
export function phaseHp(L, k) {
  const boss = makeMob(L, 'boss');
  return Math.round(dpsVs(refPlayer(L), boss) * WBOSS.phaseSec * Math.pow(WBOSS.phaseX, k));
}
// 서버 전체 누적 피해 → 지금 단계 · 단계 안 남은 체력
export function phaseOf(total, L) {
  let k = 0, left = total;
  while (k < WBOSS.phases - 1 && left >= phaseHp(L, k)) { left -= phaseHp(L, k); k++; }
  return { phase: k, hp: phaseHp(L, k), done: Math.min(left, phaseHp(L, k)) };
}
// 한 번 넣을 수 있는 피해 상한(검사용) — 전투력에서 나올 수 있는 DPS × 시간 × 여유
export const maxTryDmg = (f, L, slack = 1.5) => dpsVs(f, makeMob(L, 'boss')) * (WBOSS.fightMs / 1000) * slack;
// 하루 횟수
export function useTry(W, dayKey) {
  if (W.day !== dayKey) { W.day = dayKey; W.used = 0; }
  if (W.used >= WBOSS.tries) return false;
  W.used++; return true;
}
