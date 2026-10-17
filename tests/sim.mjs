// 밸런스 시뮬레이션: 단순한 자동 플레이어로 시간대별 도달 스테이지를 본다.
// node tests/sim.mjs [hours]
import { Game, newSave } from '../js/game.js';
import { UPGRADES, SKILLS } from '../js/data.js';

const hours = Number(process.argv[2] || 24);
const g = new Game(newSave(0), 0);
let seed = 12345;
g.rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const dt = 0.1;
let farmT = 0;
const marks = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 72].filter((h) => h <= hours);
for (let t = 0, step = 0; t < hours * 3600; t += dt, step++) {
  g.tick(dt);
  g.events.length = 0;
  if (step % 10 === 0) {
    for (;;) {
      const keys = Object.keys(UPGRADES).filter((k) => !g.upgradeMaxed(k));
      const k = keys.reduce((a, b) => (g.upgradeCost(a) <= g.upgradeCost(b) ? a : b));
      const sk = SKILLS.filter((s) => g.skillUnlocked(s)).map((s) => s.id)
        .reduce((a, b) => (g.skillUpgradeCost(a) <= g.skillUpgradeCost(b) ? a : b));
      if (g.skillUpgradeCost(sk) < g.upgradeCost(k) * 3 && g.upgradeSkill(sk)) continue;
      if (!g.buyUpgrade(k)) break;
    }
    while (g.s.gems >= 900) g.gacha(10);
    g.mergeAll();
    if (g.s.farming) { farmT += 1; if (farmT > 90) { farmT = 0; g.challengeBoss(); } }
  }
  const h = t / 3600;
  if (marks.length && h >= marks[0]) {
    const p = g.power();
    console.log(`${String(marks.shift()).padStart(5)}h  stage ${String(g.s.maxStage).padStart(4)}  power ${p.power.toExponential(2)}  gems ${g.s.gems}  up ${JSON.stringify(g.s.upgrades)}`);
  }
}
