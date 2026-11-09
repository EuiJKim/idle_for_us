// 조각이 어디서 오나 — 기본 정책 3시간, 1초마다 조각 변화를 출처별로
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');   // 저장소 뿌리
const { WorldGame, newWorldSave } = await import(`${root}/js/world/wgame.js`);
const W = await import(`${root}/js/world/wdata.js`);
let T = Date.UTC(2026, 10, 9, 0, 0);
Date.now = () => T;
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const g = new WorldGame(newWorldSave(T), T); g.rng = seeded(11); g.setJob('sword'); g.s.autoMap = true; g.s.autoStat = true;
g.enterMap(g.s.huntMap);
const src = {}; const add = (k, p, m) => { const o = src[k] || (src[k] = { pet: 0, mount: 0, n: 0 }); o.pet += p; o.mount += m; o.n++; };
const HOURS = Number(process.argv[2]) || 3; const DT = 0.25;
let kills = 0, bossKills = 0, elite = 0;
for (let i = 0; i < HOURS * 3600 / DT; i++) {
  T += DT * 1000;
  const p0 = g.s.petShard || 0, m0 = g.s.mountShard || 0, inst0 = g.inst?.kind, map0 = g.map;
  g.tick(DT);
  const ev = g.events.slice(); g.events.length = 0;
  const kl = ev.filter((e) => (e.type || e[0]) === 'kill');
  kills += kl.length; bossKills += kl.filter((e) => (e.isBoss ?? e[1]?.isBoss)).length;
  const dp = (g.s.petShard || 0) - p0, dm = (g.s.mountShard || 0) - m0;
  if (dp > 0 || dm > 0) {
    const names = ev.map((e) => e.type || e[0]);
    const k = inst0 ? `던전:${inst0}` : names.includes('instEnd') ? '던전끝' : kl.some((e) => e.isBoss ?? e[1]?.isBoss) ? '두목' : kl.length ? (map0?.bossRoom ? '두목방졸개' : '졸개') : names.join('/') || '?';
    add(k, dp, dm);
  }
  if (i % Math.round(5 / DT) === 0) {
    const p1 = g.s.petShard || 0, m1 = g.s.mountShard || 0;
    const m = g.mainSkill(); for (let n = 0; n < 20; n++) { const id = [m?.id, ...g.skills().map((k) => k.id)].filter(Boolean).find((x) => g.canSkillUp(x)); if (!id) break; g.skillUp(id); }
    if (g.canAdvance()) g.advance(); g.claimAllQuests(); if (g.s.potions < 20) g.buyPotions(50);
    if (g.map.town && !g.inst && g.heroHp >= g.stats().hp * 0.9) g.enterMap(g.s.huntMap);
    const dp = (g.s.petShard || 0) - p1, dm = (g.s.mountShard || 0) - m1; if (dp > 0 || dm > 0) add('길잡이/기타', dp, dm);
    g.events.length = 0;
  }
}
console.log(`${HOURS}h · Lv${g.s.level} · 처치 ${kills} (두목 ${bossKills}) · 조각 ${g.s.petShard}/${g.s.mountShard}`);
console.table(src);
