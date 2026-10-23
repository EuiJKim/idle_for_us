// 밸런스 시뮬레이션: 단순한 자동 플레이어로 시간대별 도달 스테이지를 본다.
// node tests/sim.mjs [hours]
import { Game, newSave } from '../js/game.js';
import { UPGRADES, SKILLS, DUNGEONS, PETS, EQUIP_TYPES, ACC_SLOTS, OUTFITS,
  EGO_PARTS, EGO_FEED_MIN_GRADE, GACHA_KINDS, MISSIONS, GRADES, JOBS } from '../js/data.js';

import * as D2 from '../js/data.js';
import { big } from '../js/big.js';
const hours = Number(process.argv[2] || 24);
// SIM_SAVE=경로 를 주면 끝났을 때 세이브를 떨군다 (계열 측정에 쓴다)
const SAVE_TO = process.env.SIM_SAVE || '';
const T0 = Date.UTC(2026, 0, 1);
const g = new Game(newSave(T0), T0);
let seed = 12345;
g.rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
// 생성자가 Math.random으로 첫 스폰을 끝낸 뒤에 rng를 갈아끼우므로,
// 그대로 두면 첫 적 위치가 매번 달라져 결과가 갈린다. 시드로 다시 깐다.
g.spawn();
g.checkDaily(T0);
const dt = 0.1;
// **끝이 있는 되풀이.** 자원이 아주 커지면 while이 영영 안 끝난다 —
// 아홉 시간 시뮬이 통째로 멎어서 한 줄도 안 찍혔다. 몇 번까지만 돈다.
function loop(n, fn) {
  for (let i = 0; i < n; i++) if (!fn()) return i;
  return n;
}
let farmT = 0;
const tried = {};
let nextTrial = 0;
let nextJobTest = 0;
let lastBest = 0;
let lastProgressT = 0;
const marks = [0.25, 0.5, 1, 2, 3, 4, 8, 12, 24, 48, 72, 168].filter((h) => h <= hours);
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
    loop(500, () => g.accStarUp(a2.id));
    if (g.canAccGrade(a2.id)) { g.accGradeUp(a2.id); loop(500, () => g.accStarUp(a2.id)); }
    loop(500, () => big(g.s.stones).gt(big(g.accPierceCost(a2.id)).mul(3)) && g.accPierce(a2.id));
  }
  // 광맥: 거두고, 은자가 남으면 깊이와 광부를 늘린다
  g.collectMine(now);
  loop(500, () => big(g.s.gold).gt(big(g.mineDepthCost()).mul(4)) && g.digDeeper(now));
  loop(500, () => big(g.s.gold).gt(big(g.mineHandCost()).mul(4)) && g.hireMiner(now));
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
  for (const sk of SKILLS) loop(200, () => big(g.s.books).gt(big(g.skillPierceCost(sk.id)).mul(2)) && g.skillPierce(sk.id));
}

for (let t = 0, step = 0; t < hours * 3600; t += dt, step++) {
  g.tick(dt);
  g.events.length = 0;
  if (step % 10 !== 0) continue;
  const now = T0 + t * 1000;
  g.checkDaily(now);
  loop(3000, () => {
    const keys = Object.keys(UPGRADES).filter((k) => !g.upgradeMaxed(k));
    const k = keys.reduce((a, b) => (big(g.upgradeCost(b)).gte(g.upgradeCost(a)) ? a : b));
    return !!g.buyUpgrade(k);
  });
  for (const sk of SKILLS) loop(500, () => g.upgradeSkill(sk.id));
  loop(2000, () => g.s.sp > 0 && (g.allocSp(g.s.spAlloc.atk <= g.s.spAlloc.hp ? 'atk' : 'hp') || true));
  // 의복은 사두면 영구히 효과가 붙으므로 뽑기보다 먼저 산다
  for (const o of OUTFITS) g.buyOutfit(o.id);
  loop(500, () => { if (g.s.gems < 900) return false; g.gacha(10); if (g.s.gems >= 150) g.hatchPets(1); return true; });
  // 소환 레벨 달성 보상. 이걸 안 받고 있었다 — 한철·원보·장신구 상자·선택 상자·
  // 의복이 전부 안 들어와서, 지금까지의 측정이 '보상을 안 받는 사람' 기준이었다.
  for (const k of GACHA_KINDS) if (g.gachaRewardReady(k.id)) g.claimGachaRewards(k.id);
  // 출석·의뢰도 안 받고 있었다
  g.claimAttend(now);
  for (const ms of MISSIONS) g.claimMission(ms.id);
  g.claimAllBonus();
  // 선택 상자: 공략의 수를 따라 가락지에 몰아 연다
  while ((g.s.accPick || 0) > 0) if (!g.openAccPick('ring', 1)) break;
  // 장비 초월: 천품이 남으면 쓴다 (안 쓰면 영영 쌓이기만 한다)
  for (const type of Object.keys(EQUIP_TYPES)) loop(200, () => g.equipPierceUp(type));
  // 심검 강화: 승급에 못 쓰고 썩는 장신구를 바친다
  for (const e of EGO_PARTS) g.offerAcc(e.id, true);
  // 캐릭터: 처음 시작할 때 고른다(공짜). 두목 피해가 진행에 가장 직결되므로
  // 검사를 기본으로 삼는다 (캐릭터별 비교는 SIM_JOB 변종으로 따로 잰다).
  const WANT = process.env.SIM_JOB || JOBS[0].id;
  if (g.needsClass()) g.setJob(WANT);
  // 전직 시험은 **실제로 치른다.** "붙을 수 있는 시험인가"가 밸런스의 전부다 —
  // 붙은 셈 치고 넘기면 영영 모른다. 못 붙으면 그 차수로 계속 간다.
  // 떨어지면 10분 뒤에 다시 본다. 매번 다시 보면 시험만 보다가 관문이 멈춘다
  // (재 보니 관문 151에서 한 시간 넘게 그대로였다).
  if (g.canJobTest() && t >= nextJobTest) {
    g.jobTryN = (g.jobTryN || 0) + 1;
    g.startJobTest();
    nextJobTest = t + 600;
  }
  g.mergeAll();
  for (const t2 of Object.keys(EQUIP_TYPES)) g.enhanceEquip(t2, 5);
  if (step % 600 === 0) spendSlow(now, step);   // 무거운 것은 1분마다만
  for (const p of PETS) g.levelPet(p.id, 5);
  g.digRelic(5);
  loop(500, () => g.claimMilestone());
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
  // 회귀 조건. 전에는 '30분 정체 + 6pt'였는데 그러면 8시간에 한 번도 안 터졌다.
  // 측정해 보니 적극적으로 회귀하는 쪽이 12시간 도달 관문 452 -> 540으로 훨씬 빠르다.
  // 게임 안 안내(regressWorth)와 같은 기준을 쓴다.
  if (g.regressWorth()) { g.regress(); lastBest = 0; lastProgressT = t; nextTrial = 0; }
  if (g.s.farming) { farmT += 1; if (farmT > 90) { farmT = 0; g.challengeBoss(); } }
  const h = t / 3600;
  if (marks.length && h >= marks[0]) {
    const p = g.power();
    const _st = g.stats({ buffs: false });
    const _mh = D2.monsterHp(g.s.stage), _ma = D2.monsterAtk(g.s.stage);
    // 자원이 말라붙었는지 본다. 관문은 오르는데 무공 레벨·제련이 안 따라오면
    // 그 자원의 수입 곡선이 지출 곡선보다 완만하다는 뜻이다.
    const _sk = Object.values(g.s.skills).reduce((a, b) => a + b, 0);
    const _enh = Object.values(g.s.enhance).reduce((a, b) => a + b, 0);
    const _pet = Object.values(g.s.pets).reduce((a, b) => a + b, 0);
    const _up = Object.keys(UPGRADES).map((k) => g.s.upgrades[k]).reduce((a, b) => a + b, 0);
    console.log(`      무공합 ${String(_sk).padStart(4)}  제련합 ${String(_enh).padStart(4)}  수련합 ${String(_up).padStart(4)}  영수합 ${String(_pet).padStart(4)}`
      + `  비급 ${g.s.books.toExponential(1)}  한철 ${g.s.stones.toExponential(1)}  먹이 ${g.s.food.toExponential(1)}  조각 ${g.s.relicShards.toExponential(1)}`);
    // 네 곡선이 같은 속도로 가는지 보는 줄. Big끼리 `/`를 쓰면 NaN이 되어
    // 정작 봐야 할 때 아무것도 안 보인다 — 실제로 8시간째에 전부 NaN이었다.
    const rt = (x, y) => big(x).div(y).toExponential(2);
    console.log(`      체력/졸개체력 ${rt(_st.hp, _mh)}  한대/체력 ${rt(_ma, _st.hp)}  공격/졸개체력 ${rt(_st.atk, _mh)}`);
    console.log(`${String(marks.shift()).padStart(5)}h  stage ${String(g.s.maxStage).padStart(4)} best ${String(g.s.bestStage).padStart(4)} 회귀 ${g.s.regress.count}회/${g.s.regress.points}pt  Lv ${String(g.s.level).padStart(4)}  rank ${g.s.rank}  ${g.s.job || '-'} ${g.jobTier()}차  power ${p.power.toExponential(2)}  dung ${JSON.stringify(g.s.dungeons)}  enh ${g.s.enhance.weapon}  relics ${Object.values(g.s.relics).reduce((a, b) => a + b, 0)}  pets ${Object.keys(g.s.pets).length}`);
  }
}

if (SAVE_TO) {
  const fs = await import('node:fs');
  fs.writeFileSync(SAVE_TO, JSON.stringify(g.toJSON()));
  console.log(`세이브를 ${SAVE_TO}에 떨궜다 (관문 ${g.s.bestStage})`);
}
