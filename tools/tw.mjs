const root = '/home/user/idle_for_us';
const D = await import(`${root}/js/world/wdgn.js`);
const { make } = await import('./gearlib.mjs');
const JOBS = (process.env.JOBS || 'sword,fist,fan,poison,ring').split(',');
for (const L of JSON.parse(process.env.LS || '[20,45,75,110,140,150]')) {
  const z = D.zoneForLv(L);
  const row = [];
  for (const dodge of [true, false]) {
    for (const job of JOBS) {
      const g = make(job, L, z); g.autoDodge = dodge; g.s.tower.floor = Math.max(0, Math.round((L - 2) / 1.24) - 12);
      g.startTower();
      let last = null;
      for (let t = 0; t < 3000 && g.inst; t += 0.1) { g.tick(0.1); for (const e of g.events) if (e.type === 'instEnd') last = e; g.events.length = 0; }
      row.push(`${job}${dodge ? '' : '(안피함)'} ${g.s.tower.floor}${last?.died ? '†' : '⏱'}`);
    }
  }
  console.log(`L${L} 목표층≈${Math.round((L - 2) / 1.24)} | ${row.join(' · ')}`);
}
