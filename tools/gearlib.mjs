const root = process.env.ROOT || '/home/user/idle_for_us';
export const { WorldGame, newWorldSave } = await import(`${root}/js/world/wgame.js`);
export const W = await import(`${root}/js/world/wdata.js`);
export const D = await import(`${root}/js/world/wdgn.js`);
export const G = await import(`${root}/js/world/wgear.js`);
function spend(g) {
  for (let n = 0; n < 500; n++) {
    const o = [];
    for (const k of g.skills()) if (g.canSkillUp(k.id)) o.push([W.skillLvCost(g.skillLevel(k.id)), () => g.skillUp(k.id)]);
    for (const p of g.passiveList()) if (g.canPassUp(p.id)) o.push([W.passiveCost(p, g.passLevel(p.id)) + 0.5, () => g.passUp(p.id)]);
    if (!o.length) return; o.sort((a, b) => a[0] - b[0]); o[0][1]();
  }
}
// 기준 장비: 99 아래는 그 지역 상급 +6 유니크(고유 옵션 포함, 스킬 옵션 없음) 여섯 칸
//          99부터는 갈 수 있는 자기 직업 세트(뒤 세트 우선) 다섯 + 그 레벨 왕의 장신구, 강화 6 + (L-99)/6
export function make(job, L, z, seed0 = 11, o = {}) {
  let seed = seed0; const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const g = new WorldGame(newWorldSave(0), 0); g.rng = rng; g.setJob(job); g.s.autoStat = true;
  while (g.s.level < L) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e12; while (g.canAdvance()) g.advance(); g.s.gold = 0;
  g.s.skillPts = Math.max(0, L - 14); spend(g);
  if (L >= 99 && !o.ladder) {
    const plus = Math.min(10, 6 + Math.floor((L - 99) / 12));   // v150: 던파식 강화 — 145에 +9
    const sets = G.setsOfJob(job).filter((st) => W.zoneOfW(st.king).lv[0] <= L);
    const st = o.set ? G.setOf(o.set) : sets[sets.length - 1];
    const kz = D.zoneForLv(L);
    if (st) for (const sl of G.SET_SLOTS) { const it = g.makeKing(sl, st.king, 1, st.id, plus); it.opts = []; g.s.equip[sl] = it; }
    else for (const sl of G.SET_SLOTS) { const it = g.makeCrafted(sl, W.STEP_COUNT - 1, 0, 1); it.plus = 6; it.opts = []; g.s.equip[sl] = it; }
    const a = g.makeKing('acc', kz, 1, null, plus); a.opts = []; g.s.equip.acc = a;
  } else {
    const zz = Math.min(z, W.TIER_COUNT);
    for (const sl of ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc']) { const it = g.makeCrafted(sl, W.stepOfLevel(L), 0, 1); it.plus = 6; it.opts = []; g.s.equip[sl] = it; }
  }
  g.s.potions = 1000; g._stats = null; g.heroHp = g.stats().hp;
  g.enterMap(W.mapId(Math.min(z, W.ZONE_COUNT), 1));
  return g;
}
