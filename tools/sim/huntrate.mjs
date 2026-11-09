// 사냥 벌이 — 기준 무인(레벨 고정)이 방마다 한 시간에 버는 것: 경험치(다음 레벨의 몇 배)·은자·조각·두목 수
//   node huntrate.mjs [분=20] [레벨들 JSON]
//   방: fit(알맞은 졸개 방) · boss(같은 지역 두목 방) · +10 · +20 (몹이 그만큼 높은 졸개 방)
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');
const W = await import(`${root}/js/world/wdata.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);
const MIN = Number(process.argv[2]) || 20;
const LS = JSON.parse(process.argv[3] || '[30,60,99,130]');
let T = Date.UTC(2026, 10, 9, 3, 0);
Date.now = () => T;
const normal = (m) => !m.town && !m.train && !m.bossRoom && !m.master && !m.king;
const fitFor = (lv) => { let best = null; for (const m of W.MAPS) if (normal(m) && m.lv[1] <= lv + 1 && (!best || m.lv[1] > best.lv[1])) best = m; return best; };
const bossOf = (m) => W.MAPS.find((x) => x.bossRoom && !x.king && !x.master && x.zone === m.zone) || null;
function measure(L, map) {
  const g = make(L); g.s.autoSkill = true; g.s.autoMap = false; g.s.dgn.routine = false;
  let exp = 0; const add0 = g.addExp.bind(g); g.addExp = (n) => { exp += n; };
  g.enterMap(map.id); g.s.huntMap = map.id; g._home = map.id;
  const p0 = g.s.petShard || 0, m0 = g.s.mountShard || 0, gold0 = g.s.gold, k0 = g.s.kills, d0 = g.s.deaths;
  const b0 = Object.values(g.s.bossKills || {}).reduce((a, b) => a + b, 0);
  const sec = MIN * 60;
  for (let t = 0; t < sec / 0.1; t++) { T += 100; g.tick(0.1); g.events.length = 0; if (g.map.town && g.heroHp > g.stats().hp * 0.9) g.enterMap(map.id); }
  const h = 3600 / sec;
  const b1 = Object.values(g.s.bossKills || {}).reduce((a, b) => a + b, 0);
  return { map: `${map.name}(${map.lv.join('-')})`, 'exp/h(레벨)': +(exp * h / W.expToNext(L)).toFixed(2), 'kills/h': Math.round((g.s.kills - k0) * h), 'boss/h': Math.round((b1 - b0) * h),
    'pet/h': Math.round(((g.s.petShard || 0) - p0) * h), 'mount/h': Math.round(((g.s.mountShard || 0) - m0) * h), 'gold/h': ((g.s.gold - gold0) * h).toExponential(1), deaths: g.s.deaths - d0 };
}
const out = [];
for (const L of LS) {
  const fit = fitFor(L);
  const rooms = [['fit', fit], ['boss', bossOf(fit)], ['+10', fitFor(L + 10)], ['+20', fitFor(L + 20)]];
  for (const [tag, m] of rooms) { if (!m) continue; const r = measure(L, m); out.push({ L, tag, ...r }); console.error(L, tag, JSON.stringify(r)); }
}
console.log(`기준 무인 · ${MIN}분씩 · 한 시간으로 환산`);
console.table(out);
