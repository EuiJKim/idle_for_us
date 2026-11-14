// 새 시즌(S6) 스태미나 · 원정 · 돌발 미션 · 무한 탑 · 성혼 필드 입장(계획서 §H · §I). 시간은 엔진 ms 정수.
import { STAMINA, STAMINA_RECHARGE_PER_DAY, EXPEDITION, SUDDEN, TOWER_MAX, TOWER_STEP_X, TOWER_BONUS, STAR_FIELDS } from '../tables/content.js';
import { pay } from '../core/cost.js';

// ── 스태미나: 저장은 「그때 수 + 그때 시각」 → 지금 수 = 그때 + 흐른 시간/재생 (최대에서 멈춤) ──
export const newStamina = (kind, nowMs) => ({ kind, n: STAMINA[kind].start, at: nowMs, recharged: 0, day: 0 });
export function staminaNow(S, nowMs) {
  const D = STAMINA[S.kind];
  if (S.n >= D.max) return S.n;
  const gain = Math.floor((nowMs - S.at) / (D.regenMin * 60000));
  return Math.min(D.max, S.n + gain);
}
function settle(S, nowMs) {
  const D = STAMINA[S.kind], cur = staminaNow(S, nowMs);
  if (cur >= D.max || S.n >= D.max) S.at = nowMs;
  else S.at += Math.floor((nowMs - S.at) / (D.regenMin * 60000)) * D.regenMin * 60000;
  S.n = Math.max(S.n, cur);
}
export function useStamina(S, nowMs, k = 1) { settle(S, nowMs); if (S.n < k) return false; S.n -= k; return true; }
export function nextRegenMs(S, nowMs) { const D = STAMINA[S.kind]; if (staminaNow(S, nowMs) >= D.max) return 0; return D.regenMin * 60000 - ((nowMs - S.at) % (D.regenMin * 60000)); }
// 충전(하루 한도) — 최대를 넘어 overflow까지
export function recharge(S, nowMs, day, amount) {
  settle(S, nowMs);
  if (S.day !== day) { S.day = day; S.recharged = 0; }
  if (S.recharged >= STAMINA_RECHARGE_PER_DAY) return false;
  S.n = Math.min(STAMINA[S.kind].overflow, S.n + amount); S.recharged++;
  return true;
}

// ── 원정 ── 티켓 → N시간 뒤 받기(사냥 분 상당 = 시간 × 60 × 효율)
export function startExpedition(E, hours, nowMs, wallet) {
  if (E.run || !EXPEDITION.hours.includes(hours) || !pay(wallet, [{ k: 'ticket:exped', n: 1 }])) return false;
  E.run = { hours, endMs: nowMs + hours * 3600e3 };
  return true;
}
export function claimExpedition(E, nowMs) {
  if (!E.run || nowMs < E.run.endMs) return null;
  const min = Math.round(E.run.hours * 60 * EXPEDITION.rate);
  E.run = null;
  return { huntMin: min };
}

// ── 돌발 미션 ── 사냥 중 1분마다 확률로 하나 · 시간 제한 · 연장 한 번
export function suddenTick(M, rng, nowMs) {
  if (M.cur) { if (nowMs > M.cur.endMs) { M.cur = null; M.failed++; } return null; }
  if (!rng.roll(SUDDEN.perMinP)) return null;
  M.cur = { endMs: nowMs + SUDDEN.limitMin * 60000, need: 20 + rng.int(20), p: 0, extended: false };
  return M.cur;
}
export function suddenProgress(M, kills, nowMs) {
  if (!M.cur || nowMs > M.cur.endMs) return null;
  M.cur.p += kills;
  if (M.cur.p >= M.cur.need) { M.cur = null; M.done++; return { huntMin: SUDDEN.rewardMin }; }
  return null;
}
export function suddenExtend(M) { if (!M.cur || M.cur.extended) return false; M.cur.endMs += SUDDEN.extendMin * 60000; M.cur.extended = true; return true; }

// ── 무한 탑 ── 층 n의 몹 강함 배율 · 깬 층까지의 영구 보너스
export const towerX = (floor) => Math.pow(TOWER_STEP_X, Math.max(0, floor - 1));
export const towerSources = (best) => (best > 0 ? [{ src: '무한 탑', stats: { atkL1: Math.min(TOWER_MAX, best) * TOWER_BONUS.atkL1, hpP: Math.min(TOWER_MAX, best) * TOWER_BONUS.hpP } }] : []);
// ── 성혼 필드 ── 칸 별 합으로 들어갈 수 있는 가장 높은 필드
export const starSum = (G) => Object.values(G.slots).reduce((a, s) => a + (s.broken ? 0 : s.star), 0);
export const bestStarField = (sum, lv) => STAR_FIELDS.filter((f) => sum >= f.need && lv >= f.lv).at(-1) ?? null;
