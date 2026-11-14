// 새 시즌 진행 시뮬(계획서 §J8) — 「사냥 분 상당」으로 레벨이 언제 오르는지 센다.
// 정책: base(접속 2시간 + 방치) · full(꽉 채움: 접속 6시간 + 방치 · 광고 오프라인 ×2) · idle(방치만: 접속 10분)
import { expToNext, mobExp, KILLS_PER_MIN, DAY1_MIN, DAY_MIN } from '../tables/exp.js';
import { LEVEL_MAX } from '../tables/progress.js';
import { OFFLINE_CAP_H, OFFLINE_AD_X } from '../tables/economy.js';

import { OFF_RATE } from '../content/offline.js';   // 방치 몫 비율 — 실제 방치 계산과 한 곳
export const POLICIES = {
  base: { day1: DAY1_MIN, day: DAY_MIN },
  full: { day1: 360 + OFFLINE_CAP_H * 60 * OFF_RATE * OFFLINE_AD_X, day: 360 + OFFLINE_CAP_H * 60 * OFF_RATE * OFFLINE_AD_X + 138 },
  idle: { day1: 10 + OFFLINE_CAP_H * 60 * OFF_RATE, day: 10 + OFFLINE_CAP_H * 60 * OFF_RATE + 60 },
};
// 사냥 분 → 레벨(실수: 소수는 다음 레벨까지 진행)
export function levelAfterMinutes(min) {
  let L = 1, left = min;
  while (L < LEVEL_MAX) {
    const need = expToNext(L) / (KILLS_PER_MIN * mobExp(L));
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
// 30분 목표는 접속 시간만(처음 30분은 모두 직접 사냥)
export const levelAt30min = () => levelAfterMinutes(30);
