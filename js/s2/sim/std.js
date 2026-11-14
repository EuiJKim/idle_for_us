// 새 시즌 표준 무인 계산 — 기준 플레이어가 레벨 L에 닿은 날의 스탯(장비 + S5 + 무인). tools/s2sim/std.mjs가 표로 굳힌다.
import { kitCap } from '../tables/kit.js';
import { simGear } from './econ.js';
import { simS5 } from './s5.js';
import { gearSources } from '../gear/gear.js';
import { Hero, newHero } from '../hero/hero.js';
import { cumExp } from '../tables/exp.js';
import { JOB_LV, LEVEL_MAX } from '../tables/progress.js';
import { MASTERY } from '../tables/skills.js';
import { levelAtDay } from './progress.js';

const KEEP = ['atk', 'hp', 'def', 'skillP', 'atkL1', 'atkL2', 'mainDmg', 'final1', 'final2', 'final3', 'final4', 'final5', 'crit', 'critDmg', 'bossDmg', 'mobDmg', 'pierce', 'takenDownP'];
export const DAYS = 365;

export function heroAt(L) {
  const h = new Hero(newHero('sword'));
  h.addExp(cumExp(L));
  for (let n = 1; n < JOB_LV.length; n++) if (L >= JOB_LV[n]) { h.clearDungeon(`job${n}`); h.advance(); }
  for (const m of MASTERY) if (L >= m.lv) h.s.mastery.done.push(m.id);
  // v493 무공 세트 — 열린 무공은 그 레벨 상한까지 올렸다고 본다
  h.kitUnlock(); for (const id of Object.keys(h.s.kit.lv)) h.s.kit.lv[id] = kitCap(L);
  return h;
}
export function buildStd(seed = 3) {
  // 날마다(1~365) 장비 출처 · S5 출처를 받아 둔다
  const gearBy = [], s5By = [];
  simGear(DAYS, { seed, onDay: (d, L, G) => { gearBy[d] = { L, src: gearSources(G, L).map((x) => ({ src: x.src, stats: { ...x.stats } })) }; } });
  simS5(DAYS, { seed, onDay: (d, L, f) => { s5By[d] = f().map((x) => ({ src: x.src, stats: { ...x.stats } })); } });
  const L1 = Math.floor(levelAtDay(1));
  const rows = [null];
  for (let L = 1; L <= LEVEL_MAX; L++) {
    let d = 1;
    while (d < DAYS && Math.floor(levelAtDay(d)) < L) d++;
    // 첫날 안의 낮은 레벨: 첫날 끝 출처를 레벨 비율만큼 줄여서(퍼밀 스탯은 비례, 더하는 스탯은 비례)
    const k = L < L1 ? L / L1 : 1;
    const scale = (list) => list.map((x) => ({ src: x.src, stats: Object.fromEntries(Object.entries(x.stats).map(([s, v]) => [s, Math.round(v * k)])) }));
    const st = heroAt(L).stats([...scale(gearBy[d].src), ...scale(s5By[d])]);
    // 장비를 바꾸며 공격·체력을 맞바꾸는 작은 굴곡은 걷어낸다(기준 곡선은 레벨이 오를수록 줄지 않게)
    const prev = rows[L - 1];
    rows.push(Object.fromEntries(KEEP.map((s) => [s, Math.max(st[s] || 0, prev ? prev[s] : 0)])));
  }
  return rows;
}
