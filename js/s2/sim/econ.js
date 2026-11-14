// 새 시즌(S4) 경제 시뮬 — 날마다 은자를 벌어(사냥 분 × 분당 처치 × 몹 은자) 뽑기·강화·성혼에 쓰고,
// 진행 목표(progress.js)의 장비 등급·성혼에 닿는지 본다(계획서 §J5 · §J8). 결정론(씨앗 하나).
import { Rng } from '../core/rng.js';
import { SLOTS, GACHA_LV_MAX, START_PULL_TICKETS } from '../tables/gear.js';
import { goldPerMob, gachaCost } from '../tables/gearstat.js';
import { KILLS_PER_MIN } from '../tables/exp.js';
import { GOLD_SINK_SHARE } from '../tables/economy.js';
import { levelAtDay, minutesAtDay } from './progress.js';
import { newGearState, obtain, enhance, starForce, restoreSlot } from '../gear/gear.js';
import { newGacha, pull, canLevelUp, startLevelUp, tickGacha, eliteDrop } from '../gear/gacha.js';

// 하루치를 돌린다. 정책: 은자의 50%는 뽑기, 30%는 성혼·강화(가장 낮은 칸부터), 나머지는 다른 성장(무공·경지 — 여기선 버림)
export function simGear(days, { seed = 1, policy = 'base', protect = true } = {}) {
  const rng = new Rng(seed);
  const G = newGearState(); G.autoDis = 1;
  const GA = newGacha();
  const w = { gold: 0, 'item:stone': 0, 'item:restore': 0 };
  const log = [];
  let gacha = 0, star = 0;
  for (let d = 1; d <= days; d++) {
    const L = Math.floor(levelAtDay(d, policy));
    const min = minutesAtDay(d, policy) - minutesAtDay(d - 1, policy);
    const income = Math.round(min * KILLS_PER_MIN * goldPerMob(L));
    gacha += income * GOLD_SINK_SHARE.gearGacha;
    star += income * GOLD_SINK_SHARE.starEnhance;
    // 첫날 길잡이 선물 뽑기권
    if (d === 1) { w['ticket:gear'] = START_PULL_TICKETS; obtain(G, pull(GA, START_PULL_TICKETS, rng, w, L, { ticket: true }) || [], L, w); }
    // 뽑기(하루 동안 대기 시간은 지나간 것으로 본다 — 하루에 레벨 하나까지)
    const c = gachaCost(L, GA.lv)[0].n;
    const n = Math.floor(gacha / c);
    if (n > 0) {
      w.gold += n * c; gacha -= n * c;
      const items = pull(GA, n, rng, w, L) || [];
      obtain(G, items, L, w);
      while (GA.eliteQ > 0) { GA.eliteQ--; obtain(G, eliteDrop(GA, rng), L, w); }
    }
    if (canLevelUp(GA)) { startLevelUp(GA, 0); tickGacha(GA, 24 * 3600e3); }
    // 성혼·강화: 가장 낮은 칸부터(강화 먼저 별 수만큼, 그다음 성혼)
    w.gold += Math.floor(star); star -= Math.floor(star);
    for (let guard = 0; guard < 2000; guard++) {
      const s = SLOTS.reduce((a, b) => (G.slots[a].star + G.slots[a].enh / 2 <= G.slots[b].star + G.slots[b].enh / 2 ? a : b));
      const S = G.slots[s];
      if (S.broken) { w['item:restore']++; restoreSlot(G, s, w); continue; }   // 복구 주문서는 미션·상점에서 얻는다고 보고
      const r = S.enh < Math.min(20, S.star + 2) ? enhance(G, s, rng, w, L) : starForce(G, s, rng, w, L, { noBreak: protect });
      if (r === null) break;
    }
    star += w.gold; w.gold = 0;   // 남은 은자는 다음 날 성혼 몫으로
    const grades = SLOTS.map((s) => (G.eq[s] ? G.eq[s].g * 2 + G.eq[s].up : -1)).sort((a, b) => a - b);
    log.push({ day: d, lv: L, gachaLv: GA.lv, tierMedian: grades[5], tierMin: grades[0], starAvg: SLOTS.reduce((a, s) => a + G.slots[s].star, 0) / SLOTS.length, enhAvg: SLOTS.reduce((a, s) => a + G.slots[s].enh, 0) / SLOTS.length, pulls: GA.pulls });
  }
  return { log, G, GA };
}
export { GACHA_LV_MAX };
