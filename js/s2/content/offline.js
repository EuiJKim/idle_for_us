// 새 시즌(S7) 방치 · 돌아왔을 때 대기열 · 시간 티켓(계획서 §I).
// 오프라인: 흐른 시간(최대 12시간) × 70% = 사냥 분 상당 → 그 레벨 사냥 벌이로. 일주일 84시간까지 · 광고 보면 ×2(하루 3번).
// 시계: 「지금까지 본 가장 늦은 시각」(clockMax)부터만 센다(v475 — 시계를 돌려도 미래 몫을 두 번 못 받음).
import { OFFLINE_CAP_H, OFFLINE_WEEK_CAP_H, OFFLINE_AD_X, OFFLINE_AD_PER_DAY } from '../tables/economy.js';
import { KILLS_PER_MIN, mobExp } from '../tables/exp.js';
import { goldPerMob } from '../tables/gearstat.js';

export const OFF_RATE = 0.7;
export const MIN_OFFLINE_MS = 60000;   // 1분 안 된 자리 비움은 보상 없음
export const newOffline = () => ({ lastSeen: 0, clockMax: 0, week: '', weekUsedMs: 0, adDay: '', adUsed: 0, pending: null });

// 돌아왔을 때 — 받을 몫을 계산해 pending에 둔다(받기 단추로 확정)
export function checkReturn(O, nowMs, weekKey, heroLv) {
  const from = Math.max(O.lastSeen, O.clockMax);
  O.clockMax = Math.max(O.clockMax, nowMs);
  O.lastSeen = nowMs;
  if (!from || nowMs - from < MIN_OFFLINE_MS) return null;
  if (O.week !== weekKey) { O.week = weekKey; O.weekUsedMs = 0; }
  const left = Math.max(0, OFFLINE_WEEK_CAP_H * 3600e3 - O.weekUsedMs);
  const ms = Math.min(nowMs - from, OFFLINE_CAP_H * 3600e3, left);
  if (ms <= 0) return null;
  O.weekUsedMs += ms;
  const huntMin = (ms / 60000) * OFF_RATE;
  const kills = Math.floor(huntMin * KILLS_PER_MIN);
  O.pending = { ms, huntMin, kills, exp: kills * mobExp(heroLv), gold: kills * goldPerMob(heroLv), capped: nowMs - from > ms };
  return O.pending;
}
// 받기 — 광고 보면 ×2(하루 3번)
export function claimOffline(O, dayKey, withAd = false) {
  const p = O.pending;
  if (!p) return null;
  let x = 1;
  if (withAd) {
    if (O.adDay !== dayKey) { O.adDay = dayKey; O.adUsed = 0; }
    if (O.adUsed < OFFLINE_AD_PER_DAY) { O.adUsed++; x = OFFLINE_AD_X; }
  }
  O.pending = null;
  return { exp: p.exp * x, gold: p.gold * x, kills: p.kills * x, x };
}
// 앱이 떠 있는 동안에도 lastSeen을 갱신(1분마다)
export const touch = (O, nowMs) => { O.lastSeen = nowMs; O.clockMax = Math.max(O.clockMax, nowMs); };

// ── 돌아왔을 때 대기열 — 한 번에 하나씩, 이 순서로 ──
export const QUEUE_ORDER = ['offline', 'attendance', 'timer', 'event', 'sudden'];
export function buildQueue(items) {
  return [...items].sort((a, b) => QUEUE_ORDER.indexOf(a.kind) - QUEUE_ORDER.indexOf(b.kind) || (a.at ?? 0) - (b.at ?? 0));
}

// ── 시간 티켓 — 대기 시간을 N분 당긴다(어느 것에 쓸지 고름) ──
// 타이머 모양: { endMs } — 경지(R.wait) · 마스터리(hero.s.mastery.learning) · 뽑기(GA.wait) · 강호행(J.wait) · 원정(E.run)
export function useTimeTicket(timer, wallet, minutes) {
  if (!timer || !(timer.endMs > 0)) return false;
  const need = Math.ceil(minutes / 15);   // 티켓 1장 = 15분
  if ((wallet['ticket:time'] || 0) < need) return false;
  wallet['ticket:time'] -= need;
  timer.endMs -= need * 15 * 60000;
  return true;
}
