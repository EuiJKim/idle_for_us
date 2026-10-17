// 밸런스 시뮬레이션: 단순한 자동 플레이어로 시간대별 도달 스테이지를 본다.
// node tests/sim.mjs [hours]
import { Game, newSave } from '../js/game.js';
import { UPGRADES, SKILLS, DUNGEONS, PETS, EQUIP_TYPES } from '../js/data.js';

const hours = Number(process.argv[2] || 24);
const T0 = Date.UTC(2026, 0, 1);
const g = new Game(newSave(T0), T0);
let seed = 12345;
g.rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
g.checkDaily(T0);
const dt = 0.1;
let farmT = 0;
const tried = {};
let nextTrial = 0;
const marks = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 72, 168].filter((h) => h <= hours);
for (let t = 0, step = 0; t < hours * 3600; t += dt, step++) {
  g.tick(dt);
  g.events.length = 0;
  if (step % 10 !== 0) continue;
  const now = T0 + t * 1000;
  g.checkDaily(now);
  for (;;) {
    const keys = Object.keys(UPGRADES).filter((k) => !g.upgradeMaxed(k));
    const k = keys.reduce((a, b) => (g.upgradeCost(a) <= g.upgradeCost(b) ? a : b));
    if (!g.buyUpgrade(k)) break;
  }
  for (const sk of SKILLS) while (g.upgradeSkill(sk.id));
  while (g.s.sp > 0) g.allocSp(g.s.spAlloc.atk <= g.s.spAlloc.hp ? 'atk' : 'hp');
  while (g.s.gems >= 900) { g.gacha(10); if (g.s.gems >= 150) g.hatchPets(1); }
  g.mergeAll();
  for (const t2 of Object.keys(EQUIP_TYPES)) g.enhanceEquip(t2, 5);
  for (const p of PETS) g.levelPet(p.id, 5);
  g.digRelic(5);
  while (g.claimMilestone());
  if (g.mode === 'stage') {
    if (g.canTrial() && t >= nextTrial) { g.startTrial(); nextTrial = t + 600; }
    else for (const d of DUNGEONS) {
      const key = `${g.s.daily.date}:${d.id}:${g.s.dungeons[d.id]}`;
      if (g.mode !== 'stage' || g.s.daily.keys[d.id] <= 0 || !g.dungeonUnlocked(d)) continue;
      if (tried[key]) { g.sweepDungeon(d.id); continue; }
      tried[key] = true;
      g.startDungeon(d.id);
    }
  }
  if (g.s.farming) { farmT += 1; if (farmT > 90) { farmT = 0; g.challengeBoss(); } }
  const h = t / 3600;
  if (marks.length && h >= marks[0]) {
    const p = g.power();
    console.log(`${String(marks.shift()).padStart(5)}h  stage ${String(g.s.maxStage).padStart(4)}  Lv ${String(g.s.level).padStart(4)}  rank ${g.s.rank}  power ${p.power.toExponential(2)}  dung ${JSON.stringify(g.s.dungeons)}  enh ${g.s.enhance.weapon}  relics ${Object.values(g.s.relics).reduce((a, b) => a + b, 0)}  pets ${Object.keys(g.s.pets).length}`);
  }
}
