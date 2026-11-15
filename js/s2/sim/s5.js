// 새 시즌(S5) 성장 시뮬 — 기준 플레이어가 날마다 받는 뽑기권·정수·심법 재료·은자로 S5 시스템을 키운 상태(계획서 §J8).
import { Rng } from '../core/rng.js';
import { DAILY, START_PULLS, REALM_MAX, COLLECT_LV_MAX } from '../tables/s5.js';
import { goldPerMob } from '../tables/gearstat.js';
import { KILLS_PER_MIN } from '../tables/exp.js';
import { GOLD_SINK_SHARE } from '../tables/economy.js';
import { levelAtDay, minutesAtDay } from './progress.js';
import { newCollect, pullCollect, autoAwaken, autoEquip, levelUp, collectSources } from '../grow/collect.js';
import { newRealm, realmStart, realmTick, heartRoll, realmSources, newJourney, journeyStart, journeyTick, journeySources, cosmeticSources } from '../grow/realm.js';

// 강호행 단계 두목은 레벨에 따라 깰 수 있다고 본다(콘텐츠 S6): 레벨 L이면 (L−40)/1.8 단계까지
export const journeyClearable = (L) => Math.max(0, Math.min(60, Math.floor((L - 40) / 1.8)));

export function simS5(days, { seed = 1, policy = 'base', onDay = null } = {}) {
  const rng = new Rng(seed);
  const C = { weapon: newCollect('weapon'), pal: newCollect('pal'), relic: newCollect('relic') };
  const R = newRealm(), J = newJourney();
  const w = { 'item:essence': 0, 'item:heart': 0, gold: 0 };
  let cos = 0, realmGold = 0;
  const DAY = 24 * 3600e3;
  for (let d = 1; d <= days; d++) {
    const L = Math.floor(levelAtDay(d, policy));
    const now = d * DAY;
    // 뽑기권
    for (const sys of Object.keys(C)) {
      const n = DAILY.pull[sys] + (d === 1 ? START_PULLS[sys] : 0);
      w[`ticket:${sys}`] = (w[`ticket:${sys}`] || 0) + n;
      pullCollect(C[sys], w[`ticket:${sys}`], rng, w);
      autoAwaken(C[sys]); autoEquip(C[sys]);
    }
    // 정수 → 장착한 것 레벨(고르게)
    w['item:essence'] += DAILY.essence;
    for (let guard = 0; guard < 500; guard++) {
      let best = null;
      for (const sys of Object.keys(C)) for (const k of C[sys].eq) if (k != null && C[sys].own[k].lv < COLLECT_LV_MAX && (!best || C[sys].own[k].lv < best[0].own[best[1]].lv)) best = [C[sys], k];
      if (!best || !levelUp(best[0], best[1], w)) break;
    }
    // 경지: 은자 10% 몫 — v505 기다림 없음, 은자가 되는 만큼 바로 오른다
    const income = (minutesAtDay(d, policy) - minutesAtDay(d - 1, policy)) * KILLS_PER_MIN * goldPerMob(L);
    realmGold += income * GOLD_SINK_SHARE.realm;
    for (let k = 0; k < 200 && R.lv < REALM_MAX; k++) {
      w.gold = Math.floor(realmGold);
      const ok = realmStart(R, now, w, goldPerMob(L));
      realmGold = w.gold;
      if (!ok) break;
    }
    // 심법: 재료만큼 굴리되 더 좋은 줄이 나오면 남긴다(간단히: 굴린 결과 중 합이 큰 쪽)
    w['item:heart'] += DAILY.heart;
    while (w['item:heart'] > 0 && heartRoll(R, rng, w)) { /* 굴림 */ }
    // 강호행
    J.cleared = journeyClearable(L);
    for (let k = 0; k < 10; k++) { w.gold = 1e15; if (!journeyStart(J, now, w, rng)) break; }   // v505 바로 열린다
    cos += DAILY.cosmetic;
    if (onDay) onDay(d, L, () => [...collectSources(C.weapon), ...collectSources(C.pal), ...collectSources(C.relic), ...realmSources(R), ...journeySources(J), ...cosmeticSources(Math.floor(cos))]);
  }
  const sources = [...collectSources(C.weapon), ...collectSources(C.pal), ...collectSources(C.relic), ...realmSources(R), ...journeySources(J), ...cosmeticSources(Math.floor(cos))];
  return { C, R, J, sources };
}
