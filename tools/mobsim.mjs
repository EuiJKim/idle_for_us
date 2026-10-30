// 레벨별 기준 무인(그 레벨 사다리 레어 +6 여섯 칸, 99부터 세트) — 체력·공격·초당 피해와 사냥터 생존
const root = '/home/user/idle_for_us';
const { WorldGame, newWorldSave } = await import(`${root}/js/world/wgame.js`);
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const G = await import(`${root}/js/world/wgear.js`);
export function make(L, seed0 = 7) {
  let seed = seed0; const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const g = new WorldGame(newWorldSave(0), 0); g.rng = rng; g.setJob('sword'); g.s.autoStat = true;
  while (g.s.level < L) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; while (g.canAdvance()) g.advance(); g.s.gold = 0;
  g.s.skillPts = Math.max(0, L - 14);
  for (let n = 0; n < 400; n++) { const k = g.skills().find((x) => g.canSkillUp(x.id)); if (!k) break; g.skillUp(k.id); }
  if (L >= 99) {
    const plus = Math.min(15, 6 + Math.floor((L - 99) / 6));
    const sets = G.setsOfJob('sword').filter((st) => W.zoneOfW(st.king).lv[0] <= L);
    const st = sets[sets.length - 1];
    if (st) for (const sl of G.SET_SLOTS) { const it = g.makeKing(sl, st.king, 1, st.id, plus); it.opts = []; g.s.equip[sl] = it; }
    const a = g.makeKing('acc', D.zoneForLv(L), 1, null, plus); a.opts = []; g.s.equip.acc = a;
  } else {
    for (const sl of ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc']) { const it = g.makeCrafted(sl, W.stepOfLevel(L), 0, 1); it.plus = 6; g.s.equip[sl] = it; }
  }
  g.s.potions = Number(process.env.POT ?? 1e6); g._stats = null; g.heroHp = g.stats().hp; g.s.autoSkill = true;
  return g;
}
export function fight(g, mapId, sec = 120) {
  g.enterMap(mapId);
  g.heroHp = g.stats().hp;
  const k0 = g.s.kills, d0 = g.s.deaths; let minHp = 1;
  for (let t = 0; t < sec / 0.05; t++) { g.tick(0.05); if (g.map.town) { g.enterMap(mapId); } minHp = Math.min(minHp, g.heroHp / g.stats().hp); }
  return { kpm: Math.round((g.s.kills - k0) / (sec / 60)), deaths: g.s.deaths - d0, minHp: +minHp.toFixed(2) };
}
const fitMap = (L) => { let best = W.mapId(1, 1); for (const m of W.MAPS) if (!m.town && !m.bossRoom && !m.master && m.lv[1] <= L + 1 && m.lv[1] >= W.mapOf(best).lv[1]) best = m.id; return best; };
if (process.argv[2] === 'table') {
  const out = [];
  for (const L of [1, 5, 15, 25, 40, 55, 70, 85, 100, 115, 130, 145]) {
    const g = make(L); const st = g.stats();
    out.push({ L, hp: Math.round(st.hp), atk: Math.round(st.atk), refDps: Math.round(D.refDps(L)), mobHp: W.mobHp(L), mobAtk: Math.round(W.mobAtk(L)), hitFrac: +(W.mobAtk(L) / st.hp).toFixed(3) });
  }
  console.table(out);
}
if (process.argv[2] === 'fight') {
  const out = [];
  for (const [L, ZL] of JSON.parse(process.argv[3])) {
    const g = make(L);
    const id = ZL === 'fit' ? fitMap(L) : fitMap(ZL);
    const r = fight(g, id, 90);
    out.push({ L, map: W.mapOf(id).name, mlv: W.mapOf(id).lv.join('-'), ...r });
  }
  console.table(out);
}
