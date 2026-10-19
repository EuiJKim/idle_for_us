// 밸런스 시뮬레이션: 단순한 자동 플레이어로 시간대별 도달 스테이지를 본다.
// node tests/sim.mjs [hours]
import { Game, newSave } from '../js/game.js';
import { UPGRADES, SKILLS, DUNGEONS, PETS, EQUIP_TYPES, ACC_SLOTS, OUTFITS,
  EGO_PARTS, EGO_FEED_MIN_GRADE } from '../js/data.js';

const hours = Number(process.argv[2] || 24);
const T0 = Date.UTC(2026, 0, 1);
const g = new Game(newSave(T0), T0);
let seed = 12345;
g.rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
// 생성자가 Math.random으로 첫 스폰을 끝낸 뒤에 rng를 갈아끼우므로,
// 그대로 두면 첫 적 위치가 매번 달라져 결과가 갈린다. 시드로 다시 깐다.
g.spawn();
g.checkDaily(T0);
const dt = 0.1;
let farmT = 0;
const tried = {};
let nextTrial = 0;
let lastBest = 0;
let lastProgressT = 0;
const marks = [0.25, 0.5, 1, 2, 4, 8, 12, 24, 48, 72, 168].filter((h) => h <= hours);
// 매 초 돌릴 필요가 없고 비용도 큰 소비. 1분에 한 번만 한다.
function spendSlow(now, step) {
  // 옵션 칸: 신품 미만이 섞여 있으면 다시 굴린다. 좋은 칸은 잠가 둔다.
  for (const t2 of Object.keys(EQUIP_TYPES)) {
    const n = g.optionSlots(t2);
    if (!n) continue;
    for (let i = 0; i < n; i++) {
      const o = g.s.options[t2][i];
      g.s.optionLock[t2][i] = !!(o && o.grade >= 4);
    }
    if (g.optionSetGrade(t2) >= 4) continue;
    let guard = 0;
    while (g.rerollOptions(t2) && guard++ < 50) {
      for (let i = 0; i < n; i++) {
        const o = g.s.options[t2][i];
        g.s.optionLock[t2][i] = !!(o && o.grade >= 4);
      }
      if (g.optionSetGrade(t2) >= 4) break;
    }
  }
  // 장신구: 올릴 수 있으면 올리고, 남는 한철로 초월한다
  for (const a2 of ACC_SLOTS) {
    while (g.accStarUp(a2.id));
    if (g.canAccGrade(a2.id)) { g.accGradeUp(a2.id); while (g.accStarUp(a2.id)); }
    while (g.s.stones > g.accPierceCost(a2.id) * 3 && g.accPierce(a2.id));
  }
  // 광맥: 거두고, 은자가 남으면 깊이와 광부를 늘린다
  g.collectMine(now);
  while (g.s.gold > g.mineDepthCost() * 4 && g.digDeeper(now));
  while (g.s.gold > g.mineHandCost() * 4 && g.hireMiner(now));
  // 심검은 먹이기만 먼저 해둔다
  for (const e of EGO_PARTS) {
    if (!g.egoOpen(e.id)) continue;
    for (let gr = EGO_FEED_MIN_GRADE; gr < 6; gr++) g.feedEgo(e.id, gr, 999);
  }
  if (g.shadowRewardReady()) g.claimShadowRewards();
  // 겨루기류는 한 번에 하나만 들어갈 수 있다. 매번 탑부터 넣으면 나머지가
  // 영영 차례를 못 받고(심검이 0단계로 멈춰 드러났다), 1분마다 넣으면
  // 겨루기만 하느라 관문을 못 깬다(최고 354인데 현재 41로 주저앉았다).
  // 5분에 한 번만, 돌아가며 들어간다.
  if (step % 3000 === 0) {
    const turn = Math.floor(step / 3000) % 4;
    const tryList = [
      () => g.egoReady('blade') && g.startEgoTrial('blade'),
      () => g.canShadow() && g.startShadow(),
      () => g.towerOpen() && !g.towerDone() && g.startTower(),
      () => g.canSeek() && g.startSeek(g.huntOpen() ? 'hunt' : 'rift'),
    ];
    for (let i = 0; i < 4 && g.mode === 'stage'; i++) tryList[(turn + i) % 4]();
  }
  // 비급이 남으면 무공을 초월한다
  for (const sk of SKILLS) while (g.s.books > g.skillPierceCost(sk.id) * 2 && g.skillPierce(sk.id));
}

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
  // 의복은 사두면 영구히 효과가 붙으므로 뽑기보다 먼저 산다
  for (const o of OUTFITS) g.buyOutfit(o.id);
  while (g.s.gems >= 900) { g.gacha(10); if (g.s.gems >= 150) g.hatchPets(1); }
  g.mergeAll();
  for (const t2 of Object.keys(EQUIP_TYPES)) g.enhanceEquip(t2, 5);
  if (step % 600 === 0) spendSlow(now, step);   // 무거운 것은 1분마다만
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
  if (g.s.maxStage > lastBest) { lastBest = g.s.maxStage; lastProgressT = t; }
  if (g.mode === 'stage' && t - lastProgressT > 1800 && g.regressPreview() >= 6) { g.regress(); lastBest = 0; lastProgressT = t; nextTrial = 0; }
  if (g.s.farming) { farmT += 1; if (farmT > 90) { farmT = 0; g.challengeBoss(); } }
  const h = t / 3600;
  if (marks.length && h >= marks[0]) {
    const p = g.power();
    console.log(`${String(marks.shift()).padStart(5)}h  stage ${String(g.s.maxStage).padStart(4)} best ${String(g.s.bestStage).padStart(4)} 회귀 ${g.s.regress.count}회/${g.s.regress.points}pt  Lv ${String(g.s.level).padStart(4)}  rank ${g.s.rank}  power ${p.power.toExponential(2)}  dung ${JSON.stringify(g.s.dungeons)}  enh ${g.s.enhance.weapon}  relics ${Object.values(g.s.relics).reduce((a, b) => a + b, 0)}  pets ${Object.keys(g.s.pets).length}`);
  }
}
