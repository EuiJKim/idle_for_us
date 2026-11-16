// 새 시즌 진행 시뮬(계획서 §J8) — 「사냥 분 상당」으로 레벨이 언제 오르는지 센다.
// 정책(v527): base(접속 20시간 + 방치 4시간) · full(꽉 채움: base + 방치 광고 ×2) · idle(방치만: 접속 10분 + 방치 12시간)
import { expToNext, mobExp, KILLS_PER_MIN, DAY1_MIN, DAY_MIN, ACTIVE_MIN, ACTIVE_EFF, OFFLINE_H } from '../tables/exp.js';
import { LEVEL_MAX } from '../tables/progress.js';
import { EXP_CORR } from '../tables/exp_next.js';
import { OFFLINE_CAP_H, OFFLINE_AD_X } from '../tables/economy.js';

import { OFF_RATE } from '../content/offline.js';   // 방치 몫 비율 — 실제 방치 계산과 한 곳
export const POLICIES = {
  base: { day1: DAY1_MIN, day: DAY_MIN },
  full: { day1: ACTIVE_MIN * ACTIVE_EFF + OFFLINE_H * 60 * OFF_RATE * OFFLINE_AD_X, day: ACTIVE_MIN * ACTIVE_EFF + OFFLINE_H * 60 * OFF_RATE * OFFLINE_AD_X + 138 },
  idle: { day1: 10 + OFFLINE_CAP_H * 60 * OFF_RATE, day: 10 + OFFLINE_CAP_H * 60 * OFF_RATE + 60 },
};
// 사냥 분 → 레벨(실수: 소수는 다음 레벨까지 진행)
export function levelAfterMinutes(min) {
  let L = 1, left = min;
  while (L < LEVEL_MAX) {
    const need = expToNext(L) / (KILLS_PER_MIN * mobExp(L) * EXP_CORR[L]);   // v527 실제 엔진 보정(그 레벨에서 엔진이 버는 빠르기)
    if (left < need) return L + left / need;
    left -= need; L++;
  }
  return LEVEL_MAX;
}
// 날짜 → 그 정책의 누적 사냥 분
export function minutesAtDay(day, policy = 'base') {
  const p = POLICIES[policy];
  if (day <= 1) return p.day1 * day;
  return p.day1 + (day - 1) * p.day;
}
export const levelAtDay = (day, policy = 'base') => levelAfterMinutes(minutesAtDay(day, policy));
export const levelAt30min = () => levelAtDay(30 / 1440);   // v527 첫날 사냥 분을 하루에 고르게(접속 20시간)
