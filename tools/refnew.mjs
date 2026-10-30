const { make, D, W } = await import('./gearlib.mjs');
const JOBS = ['sword', 'fist', 'fan', 'poison', 'ring'];
const LS = [1, 5, 15, 25, 40, 55, 70, 85, 100, 115, 130, 145];
const out = [];
for (const L of LS) {
  const z = D.zoneForLv(L);
  let dsum = 0, hsum = 0;
  for (const job of JOBS) {
    const g = make(job, L, z);
    hsum += g.stats().hp;
    g.s.tower.floor = 0; g.startTower();
    for (let i = 0; i < 12; i++) g.tick(0.1);
    const b = g.mons.find((m) => m.isBoss);
    b.maxHp = b.hp = 1e15; b.atk = 0; g.inst.t = 1e9; g.inst.castT = 1e9; b.introT = 0; g.freezeT = 0; b.armor = 0;
    for (let t = 0; t < 30; t += 0.1) { g.tick(0.1); g.events.length = 0; }
    dsum += (1e15 - b.hp) / 30;
  }
  out.push({ L, dps: Math.round(dsum / JOBS.length), oldDps: Math.round(D.refDps(L)), hp: Math.round(hsum / JOBS.length), oldHp: Math.round(D.refHp(L)) });
}
console.table(out.map((r) => ({ ...r, dpsRatio: (r.dps / r.oldDps).toFixed(2), hpRatio: (r.hp / r.oldHp).toFixed(2) })));
console.log(JSON.stringify(out.map((r) => [r.L, r.dps])), JSON.stringify(out.map((r) => [r.L, r.hp])));
