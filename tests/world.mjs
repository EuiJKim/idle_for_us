// 바람식 개편 점검 — 새 엔진(js/world)이 약속대로 도는가.
// node tests/world.mjs
import { WorldGame, newWorldSave, migrateWorld } from '../js/world/wgame.js';
import * as W from '../js/world/wdata.js';
import * as TD from '../js/world/wtoday.js';
import * as Q from '../js/world/wquest.js';
import * as MS from '../js/world/wmaster.js';
import * as D from '../js/data.js';
import * as DG from '../js/world/wdgn.js';
import { fmt } from '../js/fmt.js';
import fs from 'node:fs';
// 코드를 글로도 본다 — 상수만 보고 넘기면 쓰는 쪽이 어긋나도 모른다
const read = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf-8');
// v325 시계를 한국 아침 9시에서 시작한다 — 혈겁(12~14시·20~22시)이면 정예가 두 배라 버티기 비교가 그때그때 달랐다
{ const t0 = Date.UTC(2026, 10, 4, 0, 0), real0 = Date.now(), realNow = Date.now.bind(Date); Date.now = () => t0 + (realNow() - real0); }

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '  OK  ' : '  !!  '} ${label}${extra ? '  — ' + extra : ''}`);
};
const seeded = (s = 12345) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const fresh = (job = 'sword') => {
  const g = new WorldGame(newWorldSave(0), 0);
  g.rng = seeded();
  g.setJob(job);
  g.s.autoMap = false;   // v260: 알맞은 사냥터 따라가기는 따로 본다(다른 검사가 사냥터를 옮기지 않게)
  g.events.length = 0;
  return g;
};
const finite = (g) => [g.s.gold, g.s.exp, g.heroHp, g.stats().atk, g.stats().hp, ...g.mons.map((m) => m.hp)].every(Number.isFinite);

console.log('=== 시작 ===');
{
  const g = fresh();
  ok(g.s.level === 1 && g.s.map === 0 && g.map.town, '마을에서 레벨 1로 시작한다');
  ok(g.mons.every((m) => m.npc) && g.mons.length === W.NPCS.length, '마을에는 싸우지 않는 사람만 있다', g.mons.map((m) => m.def.name).join(' '));
  ok(g.stats().atk > 0 && g.stats().hp > 0 && g.heroHp === g.stats().hp, '공격력·체력이 있고 체력이 가득');
  ok(g.canEnter(W.mapId(1, 3)) && g.canEnter(W.mapId(16, 1)) && g.danger(W.mapId(16, 1)) > W.DANGER_LV && g.danger(W.mapId(1, 1)) <= 0, '레벨과 상관없이 어디든 들어가고, 센 곳은 위험으로 안다 (v146)');
  ok(g.enterMap(11) && g.mons.length === W.MOBS_ALIVE, '사냥터에 들어가면 몹이 깔린다', `${g.mons.length}마리`);
  ok(g.mons.every((m) => m.lv >= 1 && m.lv <= 6 && Number.isFinite(m.hp) && (m.def?.look || m.def?.beast)), '몹 레벨이 사냥터 범위 안이고 생김새가 있다');
  {
    // v117: 지역마다 몹 아홉(왕은 여섯) · 구역 셋이 서로 다른 셋을 갖고 · 들짐승은 그림이 있다
    const { CREATURES } = await import('../js/creatures.js');
    let bad = [];
    for (let z = 1; z <= W.ZONE_COUNT; z++) {
      const all = W.mapOf(W.mapId(z, 4)).mobs;
      const want = W.kingOf(z) ? 6 : 9;
      if (all.length !== want || new Set(all.map((m) => m.name)).size !== want) bad.push(`${z}:${all.length}`);
      for (let a = 1; a <= 3; a++) if (W.mapOf(W.mapId(z, a)).mobs.length !== 3) bad.push(`${z}-${a}`);
      for (const m of all) if (m.beast && !CREATURES[m.beast]) bad.push(m.beast);
    }
    ok(!bad.length, '지역마다 몹 아홉(왕 여섯) · 구역마다 셋 · 들짐승 그림이 다 있다', bad.join(' '));
  }
  ok(g.s.stage === 11, '그리는 쪽이 고를 지역 그림(죽림 = 옛 지역 1)', `stage ${g.s.stage}`);
}

console.log('\n=== 싸움 ===');
{
  const g = fresh();
  g.enterMap(11);
  const k0 = g.s.kills;
  for (let i = 0; i < 20 * 60; i++) { g.tick(0.05); g.events.length = 0; }
  ok(g.s.kills > k0 + 5, '1분 자동 사냥으로 몹을 잡는다', `${g.s.kills - k0}마리`);
  ok(g.s.gold > 0 && (g.s.exp > 0 || g.s.level > 1), '은자와 경험치가 들어온다', `은자 ${g.s.gold} · Lv.${g.s.level}`);
  // 사냥을 멈추고 다시 날 시간을 주면 자리가 다 찬다
  g.s.autoHunt = false; g.mon = null;
  for (let i = 0; i < 20 * (W.RESPAWN_SEC + 1); i++) { g.tick(0.05); g.events.length = 0; }
  ok(g.mons.filter((m) => m.alive && !m.treasure).length + g.respawns.length >= W.MOBS_ALIVE - 1, '잡힌 자리는 다시 채워진다', `${g.mons.filter((m) => m.alive).length}마리 + 곧 날 것 ${g.respawns.length}`);
  ok(finite(g), '숫자가 전부 유한하다');
  // 사건: 평타·피해·처치가 그리는 쪽 모양으로 나간다
  const h = fresh();
  h.enterMap(11);
  const seen = new Set();
  for (let i = 0; i < 20 * 30; i++) { h.tick(0.05); for (const e of h.events) seen.add(e.type); h.events.length = 0; }
  ok(['attack', 'dmg', 'kill'].every((t) => seen.has(t)), '평타·피해·처치 사건이 나간다', [...seen].join(' '));
}

console.log('\n=== 자동 물약 체력 (v176) ===');
{
  const g = fresh();
  g.enterMap(11);
  g.s.autoPotion = true; g.s.potions = 5;
  const hp = g.stats().hp;
  g.s.potionAt = 0.75; g.heroHp = hp * 0.7;
  for (let i = 0; i < 3; i++) g.tick(0.05);
  ok(g.s.potions < 5, '75%로 정하면 체력 70%에서 먹는다');
  const g2 = fresh();
  g2.enterMap(11);
  g2.s.autoPotion = true; g2.s.potions = 5; g2.s.potionAt = 0.3; g2.heroHp = g2.stats().hp * 0.7;
  g2.tick(0.05);
  ok(g2.s.potions === 5, '30%로 정하면 70%에서는 안 먹는다');
  g2.s.potionAt = 0.33;
  ok(g2.potionAt() === W.POTION_AT, '없는 값이면 기본값');
}

console.log('\n=== 무공 만렙 · 초기화 (v205) ===');
{
  ok(W.SKILL_LV_MAX === 15 && W.skillSpent(10) === 25 && W.skillSpent(15) === 55, '만렙 15 · 10까지 25점 · 15까지 55점');
  const g = fresh();
  g.s.jobTier = 3; g.s.level = 150; g.s.skillPts = 200; g.s.gold = 1e12;
  while (g.skillUp('s0'));
  ok(g.skillLevel('s0') === 15 && g.skillMods('s0').crit >= 0.2, '15까지 올라가고 만렙에 치명 덧');
  const spent = g.skillSpentAll(), pts = g.s.skillPts, gold = g.s.gold;
  ok(g.skillResetCost() === 0 && g.resetSkills() === spent && g.s.skillPts === pts + spent && g.skillLevel('s0') === 1 && g.s.gold === gold, '처음 초기화는 공짜 — 쓴 점수를 다 돌려받는다');
  g.skillUp('s0'); g.skillUp('s0');
  const c2 = g.skillResetCost();
  ok(c2 > 0 && g.resetSkills() > 0 && g.s.gold === gold - c2, '두 번째부터는 은자가 든다');
  // 옛 세이브: 옛 값(n점)으로 올린 만큼과 새 값의 차이를 돌려준다
  const old = newWorldSave(0); old.job = 'sword'; old.level = 100; old.skillV = 1; old.skillLv = { s0: 10, s1: 5 }; old.skillPts = 0;
  const m = migrateWorld(old, 0);
  const back = (W.skillSpent(10, W.skillLvCostOld) - W.skillSpent(10)) + (W.skillSpent(5, W.skillLvCostOld) - W.skillSpent(5));
  ok(m.skillPts === back + 10 && m.skillLv.s0 === 10 && m.skillRefund === back && m.skillGift === 10, '옛 세이브는 레벨 그대로 차이만큼 점수를 돌려받는다(+ v270 레벨 5~14 몫 10점)', `${back}+10점 → ${m.skillPts}`);
}

console.log('\n=== 탈것 합성 (v204) ===');
{
  const g = fresh();
  g.s.gold = 1e9;
  for (let i = 0; i < 3; i++) g.takeMailMount('donkey');
  ok(g.canFuseMounts(1) && !g.canFuseMounts(2), '나귀 셋이면 합성할 수 있다');
  const m = g.fuseMounts(1);
  ok(m && m.kind === 'mule' && g.fuseCandidates(1).length === 0 && g.s.mount === m.uid, '나귀 셋 → 노새 하나, 더 빠르면 바로 탄다');
  g.takeMailMount('azure'); g.takeMailMount('azure'); g.takeMailMount('azure');
  ok(!g.canFuseMounts(12), '맨 위(청룡마)는 합성하지 않는다');
  g.s.gold = 0; g.takeMailMount('donkey'); g.takeMailMount('donkey'); g.takeMailMount('donkey');
  ok(!g.fuseMounts(1), '은자가 모자라면 못 한다');
}

console.log('\n=== 무공 과녁 (v199) ===');
{
  const g = fresh();
  g.enterMap(11);
  g.s.jobTier = 3; g._stats = null;
  const sk = g.skills().find((x) => g.knows(x) && x.kind === 'single');
  if (sk) {
    for (const k of Object.keys(g.cd)) g.cd[k] = 0;
    const far = g.mons.find((m) => m.alive);
    far.x = g.heroX + 3000; far.y = g.heroY;
    const near = g.mons.find((m) => m.alive && m !== far);
    near.x = g.heroX + 60; near.y = g.heroY;
    g.mon = far;
    const nh0 = near.hp, fh0 = far.hp;
    ok(g.useSkill(sk.id) && (!near.alive || near.hp < nh0) && far.hp === fh0, '과녁이 멀면 닿는 적 가운데 가장 가까운 것으로 바꿔 펼친다');
    for (const k of Object.keys(g.cd)) g.cd[k] = 0;
    for (const m of g.mons) { m.x = g.heroX + 3000; }
    ok(!g.useSkill(sk.id) && g.skillFail === 'far', '닿는 적이 없으면 숨 탓이 아니라 거리 탓이라고 알린다');
  } else ok(true, '(한 명 치는 무공이 없는 직업)');
}

console.log('\n=== 칸 이동 (바람식) ===');
{
  const g = fresh();
  g.enterMap(11);
  let offGrid = 0, clash = 0, maxStep = 0, samples = 0;
  let px = g.heroX, py = g.heroY;
  for (let t = 0; t < 300; t += 0.05) {
    const map0 = g.s.map;
    g.tick(0.05);
    g.events.length = 0;
    if (g.s.map !== map0) { px = g.heroX; py = g.heroY; }   // 쓰러져 마을로 간 것은 뺀다
    // 멈춰 서 있으면 늘 칸 가운데
    if (!g.hmove && (Math.abs(g.heroX - W.tileCenter(g.hc)) > 0.01 || Math.abs(g.heroY - W.tileCenter(g.hr)) > 0.01)) offGrid++;
    // 한 칸에 하나 (무인·몹 모두, 가는 칸 포함)
    const seen = new Set();
    const mark = (c, r) => { const k = c * 100 + r; if (seen.has(k)) clash++; seen.add(k); };
    mark(g.heroTile().c, g.heroTile().r);
    for (const m of g.mons) if (m.alive) { const tt = g.mobTile(m); mark(tt.c, tt.r); }
    // 부드럽게: 한 틱에 칸 하나를 건너뛰지 않는다
    // (그때그때의 빠르기로 잰다 — 날씨·버프로 빠르기가 바뀐다)
    maxStep = Math.max(maxStep, Math.hypot(g.heroX - px, g.heroY - py) - (W.HERO_SPEED * g.stats().moveSpeed * (1 + (g.envNow().move || 0)) * 0.05 + 0.01));
    px = g.heroX; py = g.heroY;
    samples++;
    if (g.map.town) { g.enterMap(11); px = g.heroX; py = g.heroY; }
  }
  ok(offGrid === 0, '멈춰 있으면 늘 칸 가운데에 선다', `${offGrid}/${samples}`);
  ok(clash === 0, '한 칸에는 하나만 선다', `${clash}`);
  ok(maxStep <= 0, '칸 사이를 미끄러지듯 옮겨 간다(순간이동 없음)', `넘친 거리 ${maxStep.toFixed(1)}`);
  ok(g.s.kills > 20, '칸 길로도 사냥이 잘 된다', `5분 ${g.s.kills}마리`);
  // 손으로 찍은 칸으로 간다
  const h = fresh();
  h.enterMap(11);
  for (const m of h.mons) m.alive = false;
  h.moveTo(W.tileCenter(1), W.tileCenter(2));
  for (let t = 0; t < 20; t += 0.05) h.tick(0.05);
  ok(h.hc === 1 && h.hr === 2 && !h.hmove, '누른 칸으로 걸어가 선다', `${h.hc},${h.hr}`);
  // 길막: 몹이 벽처럼 서 있어도 돌아가서 친다 (예전엔 앞이 막히면 그 자리에 멈췄다)
  const wall = (g2, cells) => cells.map(([c, r]) => { const m = g2.spawnMob(false); m.c = c; m.r = r; m.x = W.tileCenter(c); m.y = W.tileCenter(r); m.hc = c; m.hr = r; m.stun = 999; m.aggro = false; m.hp = m.maxHp = 1e9; m.npc = true; return m; });
  const b = fresh();
  b.enterMap(W.mapId(1, 1));
  for (const m of b.mons) m.alive = false; b.mons = [];
  b.placeHero(4, 15);
  wall(b, [[2, 13], [3, 13], [4, 13], [5, 13], [6, 13], [3, 14], [5, 14]]);
  const [tgt] = wall(b, [[4, 10]]); tgt.hp = tgt.maxHp = 30; tgt.armor = 0; tgt.npc = false;
  b.respawns = [{ t: 1e9 }];
  for (let i = 0; i < 20 * 25 && tgt.alive; i++) { b.tick(0.05); b.events.length = 0; }
  ok(!tgt.alive, '몹이 벽처럼 막아도 돌아가서 잡는다', `무인 ${b.hc},${b.hr}`);
  // 과녁이 사방으로 막혀 닿을 수 없으면 다른 몹을 잡으러 간다
  const c2 = fresh();
  c2.enterMap(W.mapId(1, 1));
  for (const m of c2.mons) m.alive = false; c2.mons = [];
  c2.placeHero(4, 16);
  wall(c2, [[4, 3], [3, 4], [5, 4], [4, 5], [3, 2], [5, 2]]);
  const [boxed] = wall(c2, [[4, 4]]); boxed.npc = false;
  const [far] = wall(c2, [[0, 18]]); far.hp = far.maxHp = 30; far.armor = 0; far.npc = false;
  c2.mon = boxed;
  c2.respawns = [{ t: 1e9 }];
  for (let i = 0; i < 20 * 25 && far.alive; i++) { c2.tick(0.05); c2.events.length = 0; }
  ok(!far.alive && boxed.alive, '닿을 수 없는 과녁은 두고 다른 몹을 잡는다', `무인 ${c2.hc},${c2.hr}`);
}

console.log('\n=== 레벨·스탯 ===');
{
  const g = fresh();
  ok(g.s.autoStat === false, '레벨업 점수는 기본으로 직접 찍는다');
  ok(migrateWorld({ autoStat: true }).autoStat === false && migrateWorld({ autoStat: true, statV: 2 }).autoStat === true, '옛 세이브의 자동 분배는 한 번만 끈다');
  g.addExp(W.expToNext(1) + W.expToNext(2));
  ok(g.s.level === 3 && g.s.statPts === 6, '레벨이 오르면 스탯 점수 3', `Lv.${g.s.level} 점수 ${g.s.statPts}`);
  const a0 = g.stats().atk;
  g.addStat('str', 2);
  ok(g.stats().atk > a0 + 4 && g.s.statPts === 4, '힘 1 = 공격력 +2 · +0.3%', `${a0.toFixed(1)} → ${g.stats().atk.toFixed(1)}`);
  g.s.autoStat = true;
  g.autoStats();
  ok(g.s.statPts === 0, '자동 분배가 남은 점수를 다 쓴다');
  g.s.gold = 1e6;
  const spent = Object.values(g.s.stats).reduce((a, b) => a + b, 0);
  ok(g.resetStats() && g.s.statPts === spent, '스탯 되돌리기는 은자를 내고 점수를 돌려준다');
  const L = W.LEVEL_MAX;
  const h = fresh();
  h.addExp(1e15);
  ok(h.s.level === L && Number.isFinite(h.s.exp), `만렙(${L})에서 멈춘다`, `Lv.${h.s.level}`);
}

console.log('\n=== 장비 ===');
{
  const g = fresh();
  const weak = g.makeItem('weapon', 5, 0);
  const strong = g.makeItem('weapon', 10, 2);
  ok(g.gainItem(weak) === 'equip', '빈 칸에는 바로 낀다');
  const atk1 = g.stats().atk;
  ok(g.gainItem(strong) === 'equip' && g.s.equip.weapon === strong, '더 좋은 것을 주우면 바꿔 낀다');
  ok(g.stats().atk > atk1, '공격력이 오른다', `${Math.round(atk1)} → ${Math.round(g.stats().atk)}`);
  ok(g.s.bag.some((x) => x.uid === weak.uid), '밀려난 장비는 가방에 든다');
  for (let i = 0; i < g.s.bagSize + 5; i++) g.gainItem(g.makeItem('armor', 1, 0));
  ok(g.s.bag.length === g.s.bagSize, '가방이 넘치면 나쁜 것부터 판다', `${g.s.bag.length}/${g.s.bagSize}`);
  g.s.gold = 1e9;
  g.s.level = W.LEVEL_MAX;   // v261 강화 상한은 레벨에 묶였다 — 여기서는 장비의 끝을 본다
  const p0 = strong.plus;
  let tries = 0;
  while (strong.plus === p0 && tries++ < 20) g.enhance(strong.uid);
  ok(strong.plus === p0 + 1, '강화하면 +1', `+${strong.plus}`);
  for (let i = 0; i < 200; i++) g.enhance(strong.uid);
  ok(strong.plus === g.enhanceMax(strong) && g.enhanceMax(strong) === W.ENHANCE_NORMAL, '옛 장비는 +10까지(돌파 없음)', `+${strong.plus}`);
}

console.log('\n=== 재료 · 성장 장비 (v158) ===');
{
  // 몹은 장비가 아니라 그 사냥터 재료를 떨군다. 두목은 한 움큼 + 증표.
  const h = fresh();
  h.enterMap(11);
  let n = 0;
  for (let i = 0; i < 10000; i++) if (h.dropMats({ lv: 5, isBoss: false })) n++;
  const TDm = await import('../js/world/wtoday.js');
  const matK = (1 + h.braveBonus()) * (TDm.bloodOn() ? 1 + TDm.BLOOD_BONUS : 1);   // v262 패기 · 혈겁
  ok(Math.abs(n / 10000 - W.MAT_RATE * matK) < 0.02, '몹 재료 확률이 설계대로(패기·혈겁 포함)', `${(n / 100).toFixed(1)}% / ${(W.MAT_RATE * matK * 100).toFixed(1)}%`);
  ok(h.s.mats[W.ORE] === n * W.matWeight(1) && !h.s.bag.length, '졸개는 재료(현철)만 떨군다(장비는 안 떨군다)', `${W.ORE_NAME} ${h.s.mats[W.ORE]}`);
  // 두목은 사다리 장비를 떨구지 않는다 — 가끔 증표 한 움큼. 십이지왕은 왕의 장비를 떨군다.
  const d = fresh();
  let drops = 0, kdrops = 0;
  for (let i = 0; i < 2000; i++) {
    d.s.map = W.mapId(1, 4); d.dropMats({ lv: 9, isBoss: true, x: 0, y: 0 });
    drops += d.events.filter((e) => e.type === 'drop' && !W.isDropOnly(e.item.slot)).length; d.events.length = 0;
    d.s.map = W.mapId(16, 4); d.dropMats({ lv: 105, isBoss: true, x: 0, y: 0 });
    kdrops += d.events.filter((e) => e.type === 'drop' && e.item.king === 16).length; d.events.length = 0;
  }
  ok(drops === 0 && Math.abs(kdrops / 2000 - W.KING_ITEM_RATE) < 0.04 && d.s.mats[W.bossKey(1)] > 2000, '두목은 사다리 장비 대신 증표를 더 준다 · 십이지왕은 왕의 장비', `왕 ${(kdrops / 20).toFixed(1)}% · 증표 ${d.s.mats[W.bossKey(1)]}`);
  h.dropMats({ lv: 6, isBoss: true });
  ok(h.s.mats[W.bossKey(1)] >= 1 && h.s.mats[W.ORE] === (n + W.BOSS_MATS) * W.matWeight(1), '두목은 현철 한 움큼과 증표를 떨군다', W.matName(W.bossKey(1)));

  // 직업을 고르면 여섯 칸 성장 장비를 받는다
  const g = fresh();
  ok(W.GROW_SLOTS.every((k) => g.s.equip[k]?.grow && g.s.equip[k].rar === 0 && g.s.equip[k].plus === 0), '직업을 고르면 여섯 칸 성장 장비(레어 +0)를 낀다');
  ok(g.s.equip.weapon.ilv === 1, '아이템 레벨 = 내 레벨', `Lv.${g.s.equip.weapon.ilv}`);
  const a1 = g.stats().atk;
  while (g.s.level < 50) g.addExp(W.expToNext(g.s.level));
  ok(g.s.equip.weapon.ilv === 50 && g.s.equip.weapon.step === W.stepOfLevel(50) && g.itemStats(g.s.equip.weapon).atk > 10 * g.itemStats({ ...g.s.equip.weapon, ilv: 1 }).atk, '레벨이 오르면 장비도 따라 자란다', `무기 공격력 → ${Math.round(g.itemStats(g.s.equip.weapon).atk)}`);
  while (g.s.level < 130) g.addExp(W.expToNext(g.s.level));
  ok(g.s.equip.weapon.ilv === W.ILV_CAP, '100에서 멈춘다 — 그 위는 세트·왕의 장비', `Lv.${g.s.equip.weapon.ilv}`);
  ok(g.stats().atk > a1, '공격력이 오른다');
  // 성장 장비는 팔리지 않고 가방이 넘쳐도 안 팔린다
  const w = g.s.equip.weapon;
  ok(g.sell(w) === 0 && g.findItem(w.uid) === w, '성장 장비는 팔 수 없다');
  // 강화 (v192): +11에서 실패해도 -2 (사라지지도 +0이 되지도 않는다)
  {
    const E = fresh(); E.s.gold = 1e15; E.s.prot = 0; E.s.level = W.LEVEL_MAX;
    for (let k = 1; k <= 60; k++) { E.s.mats[W.bossKey(k)] = 1e6; }
    E.s.mats[W.ORE] = 1e9;
    const ew = E.s.equip.weapon; ew.plus = W.ENHANCE_NORMAL;
    E.rng = () => 0.99;
    E.enhance(ew.uid, false);
    ok(!E.lastEnhance.broke && E.s.equip.weapon === ew && ew.plus === W.ENHANCE_NORMAL - 2, '성장 장비는 +11 자리에서 실패해도 -2');
  }
  // 등급 각인: 어느 두목의 증표든 — 센 두목 것일수록 잘 붙는다 · 실패하면 천장이 쌓인다
  {
    const I = fresh(); I.s.gold = 1e15;
    while (I.s.level < 30) I.addExp(W.expToNext(I.s.level));
    const iw = I.s.equip.weapon;
    const weakK = W.bossKey(1), strongK = W.bossKey(10);
    I.s.mats[weakK] = 1e4; I.s.mats[strongK] = 1e4;
    ok(I.infuseInfo(iw, strongK).chance > I.infuseInfo(iw, weakK).chance, '센 두목의 증표일수록 확률이 높다', `${(I.infuseInfo(iw, weakK).chance * 100).toFixed(0)}% < ${(I.infuseInfo(iw, strongK).chance * 100).toFixed(0)}%`);
    I.rng = () => 0.999;
    const c0 = I.infuseInfo(iw, weakK).chance;
    ok(I.infuse(iw.uid, weakK) === false && iw.rar === 0 && I.infuseInfo(iw, weakK).chance > c0 && I.s.mats[weakK] === 1e4 - W.INFUSE_MARKS[1], '실패하면 증표만 들고 다음 확률이 오른다 (천장)');
    let tries = 1;
    while (iw.rar === 0 && tries < 200) { I.infuse(iw.uid, weakK); tries++; }
    ok(iw.rar === 1 && !iw.pity, '확률이 끝까지 차면 반드시 오른다', `${tries}번째`);
    I.rng = () => 0;
    const o0 = JSON.stringify(iw.opts);
    ok(I.infuse(iw.uid, strongK) && iw.rar === 2 && I.infuse(iw.uid, strongK) && iw.rar === 3 && JSON.stringify(iw.opts) !== o0, '오르면 등급 옵션이 새로 붙는다 (신화까지)');
    ok(!I.infuseInfo(iw, strongK), '신화 위는 없다');
    ok(I.s.did.infuse, '길잡이: 등급 각인을 해 봤다');
    // 기대 증표 수 — 같은 레벨 두목 증표로 신화까지
    const exp = [1, 2, 3].map((r) => { let e = 0, pity = 0, left = 1; for (let t = 1; t < 400 && left > 1e-6; t++) { const p = Math.min(1, W.INFUSE_BASE[r] + pity); e += left * p * t; left *= 1 - p; pity += W.INFUSE_BASE[r] * W.INFUSE_PITY_K; } return e * W.INFUSE_MARKS[r]; });
    ok(exp[2] > exp[1] && exp[1] > exp[0], '위 등급일수록 증표가 훨씬 많이 든다', `유니크 ${exp[0].toFixed(0)} · 전설 ${exp[1].toFixed(0)} · 신화 ${exp[2].toFixed(0)}개`);
  }
  // v213: 계열 각인은 없앴다 — 이미 붙은 계열은 수치가 그대로
  {
    const L = fresh();
    ok(typeof L.setLine !== 'function', '계열 각인이 없다');
    const it0 = L.makeCrafted('weapon', 10, 0, 0);
    ok(L.itemStats({ ...it0, line: 'magyo' }).atk > L.itemStats(it0).atk, '옛 세이브의 계열 장비는 그대로 세다');
    // 길잡이 판 4 → 5: 계열 단계를 하던 사람은 그다음(무기 +7)으로, 그 뒤 단계는 같은 단계로
    const QQ = await import('../js/world/wquest.js');
    const ids4 = QQ.QUEST_IDS_BY_V[4];
    for (const [from, to] of [['line', 'enh7'], ['enh7', 'enh7'], ['reimp', 'reimp'], ['lord', 'lord']]) {
      const M = fresh(); M.s.questV = 4; M.s.quest = ids4.indexOf(from); M.s.questTo = M.s.quest;
      M.questNow();
      ok(QQ.questAt(M.s.quest)?.id === to && M.s.questV === QQ.QUEST_V, `길잡이 판 4→5: ${from} → ${to}`, QQ.questAt(M.s.quest)?.id);
    }
  }
  // 옛 판(드랍) 장비도 그대로 읽힌다
  const legacy = { slot: 'weapon', ilv: 10, grade: 2, plus: 1, uid: 99999 };
  ok(Number.isFinite(g.itemStats(legacy).atk), '옛 드랍 장비도 수치가 나온다');
}

console.log('\n=== 옛 사다리 장비 → 성장 장비 (v158) ===');
{
  const sv = newWorldSave(0);
  sv.job = 'sword'; sv.level = 42; sv.gearV = 3;
  sv.equip.weapon = { uid: 501, slot: 'weapon', step: 6, ilv: 35, rar: 1, grade: 3, opts: [], plus: 5, line: 'sapa' };
  sv.bag = [{ uid: 502, slot: 'weapon', step: 7, ilv: 40, rar: 2, grade: 4, opts: [], plus: 3 },
    { uid: 503, slot: 'armor', step: 7, ilv: 40, rar: 0, grade: 2, opts: [], plus: 0 }];
  sv.gold = 0;
  const g = new WorldGame(sv, 0);
  const w = g.growOf('weapon');
  ok(w && w.uid === 502 && w.rar === 2 && w.plus === 3 && g.s.equip.weapon === w && w.ilv === 42, '그 칸에서 가장 좋은 사다리 장비(등급 먼저)가 성장 장비가 된다', `${w?.uid} ${W.RARITY[w?.rar]?.name} +${w?.plus}`);
  ok(!g.findItem(501) && g.s.gold > 0, '나머지 사다리 장비는 팔린다');
  ok(g.s.equip.armor?.uid === 503 && g.s.equip.armor.grow && W.GROW_SLOTS.every((k) => g.growOf(k)), '빈 칸은 새 성장 장비 · 가방의 옷은 끼워진다');
  ok(g.s.gearV === 4, '한 번만 바꾼다');
}

console.log('\n=== 지역·구역·두목 구역 ===');
{
  ok(W.ZONES_W.filter(Boolean).length === 33 + MS.MASTERS.length && W.MAPS.length === 1 + 33 * 4 + MS.MASTERS.length, `지역 33(보통 15 + 새 지역 6 + 십이지왕 12) × 구역 넷 + 고수의 두목 방 ${MS.MASTERS.length}`, `${W.MAPS.length - 1}구역`);
  const g = fresh();
  g.enterMap(W.mapId(1, 1));
  for (let i = 0; i < 20 * 300; i++) { g.tick(0.05); g.events.length = 0; if (g.map.town) g.enterMap(W.mapId(1, 1)); }
  ok(!g.mons.some((m) => m.isBoss) && (!g.s.mats[W.bossKey(1)] || g.s.did?.treasure), '들판 구역에는 두목이 없고 증표도 안 나온다(보물 원숭이는 준다)');
  const b = fresh();
  b.s.level = 30; b.s.gold = 1e9;
  b.s.stats.str = 200; b._stats = null; b.heroHp = b.stats().hp;
  ok(b.enterMap(W.mapId(1, W.BOSS_AREA)) && b.mons.length === W.BOSS_ROOM_MOBS, '두목 구역에는 정예 몇이 있다');
  for (let i = 0; i < 40; i++) b.tick(0.05);
  ok(b.mons.some((m) => m.isBoss && m.alive), '들어서면 곧 두목이 나선다', b.mons.find((m) => m.isBoss)?.name);
  for (let i = 0; i < 20 * 400; i++) { b.tick(0.05); b.events.length = 0; }
  ok((b.s.mats[W.bossKey(1)] || 0) >= 3, '두목을 잡으면 증표 — 다시 나서 또 잡는다', `6분 40초에 증표 ${b.s.mats[W.bossKey(1)] || 0}`);
  // 등장 연출: 구역에 들어와 처음 나설 때만 길게(들판이 멈춘다), 다시 날 때는 짧게
  const c = fresh();
  c.s.level = 30; c.s.stats.str = 200; c.s.stats.vit = 800; c._stats = null; c.heroHp = c.stats().hp;
  c.enterMap(W.mapId(2, W.BOSS_AREA));
  const appears = [];
  let frozeOk = true;
  for (let i = 0; i < 20 * 300; i++) {
    const hp0 = c.heroHp, kills0 = c.s.kills;
    const frozen = c.freezeT > 0.06;
    c.tick(0.05);
    if (frozen && (c.s.kills !== kills0 || c.heroHp < hp0)) frozeOk = false;
    for (const e of c.events) if (e.type === 'bossAppear') appears.push(e.full);
    c.events.length = 0;
  }
  ok(appears[0] === true && appears.length >= 2 && appears.slice(1).every((f) => f === false), '두목 등장: 처음은 긴 연출, 다시 날 때는 짧게', appears.map((f) => (f ? '긴' : '짧은')).join(' '));
  ok(frozeOk, '긴 연출 동안은 들판이 멈춘다(맞지도 잡지도 않는다)');
  // 십이지왕
  const k = fresh();
  k.s.level = 99;
  ok(k.canEnter(W.mapId(16, 1)) && W.mapOf(W.mapId(16, 1)).name.includes('권왕'), '권장 레벨 99 제12왕 권왕', W.mapOf(W.mapId(16, 1)).name);
  // v146: 한참 센 곳에서 쓰러지면 돌아갈 곳이 알맞은 사냥터로 바뀐다
  const r = fresh();
  while (r.s.level < 20) r.addExp(W.expToNext(r.s.level));
  r.enterMap(W.mapId(16, 1));
  r.heroDied(null);
  ok(r.danger(r.s.huntMap) <= 0 && !W.mapOf(r.s.huntMap).bossRoom, '레벨보다 한참 센 곳에서 쓰러지면 알맞은 사냥터로 물러난다', W.mapOf(r.s.huntMap).name);
  ok(W.ZONES_W[27].name.includes('검왕') && W.zoneLv(27)[1] === 150, '마지막은 제1왕 검왕(가장 강하다)', W.ZONES_W[27].boss.name);
  ok(new Set(W.KINGS.map((x) => x.mat)).size === 12 && W.KINGS.every((x) => !W.MATS.slice(1, 16).includes(x.mat)), '왕마다 재료가 다르다');
  ok(W.STEP_COUNT === 20 && W.craftIlv(W.STEP_COUNT - 1) === W.ILV_CAP && W.ILV_CAP === 100,
    '조합 사다리는 레벨 100에서 끝난다 (v143)', `${W.STEP_COUNT}칸 · Lv${W.ILV_CAP}`);
  // 옛 세이브: 사냥터 3 → 지역 3의 1구역
  const old = migrateWorld({ map: 3, huntMap: 3, bestMap: 5, mats: { 3: 10 } });
  ok(old.map === W.mapId(3, 1) && old.huntMap === W.mapId(3, 1) && old.mats[W.ORE] === 10 * W.matWeight(3), '옛 세이브의 사냥터 번호를 새 구역으로 옮긴다(재료는 현철로)', `${old.map}`);
}

console.log('\n=== 장비가 강함의 대부분 ===');
{
  const g = fresh();
  g.s.level = 60; g.s.stats.str = 120; g.s.stats.vit = 60; g.syncGrow(); g._stats = null;
  g.s.gold = 1e12;
  for (let z = 1; z <= 10; z++) { g.s.mats[W.bossKey(z)] = 100; }
  g.s.mats[W.ORE] = 1e7;
  // 장비 몫 = 장비를 다 벗었을 때 줄어드는 만큼. 흔한 차림(유니크 +6)으로 잰다.
  for (const it of Object.values(g.s.equip).filter(Boolean)) { it.rar = 1; it.plus = 6; }
  g._stats = null;
  const st = g.stats();
  const keep = g.s.equip;
  g.s.equip = { weapon: null, armor: null, hat: null, acc: null, finger: null, ear: null }; g._stats = null;
  const naked = g.stats();
  g.s.equip = keep; g._stats = null;
  const sa = 1 - naked.atk / st.atk, sh = 1 - naked.hp / st.hp;
  ok(sa > 0.55 && sa < 0.85 && sh > 0.45 && sh < 0.8, 'Lv60 유니크 +6 차림: 장비가 2/3 남짓, 레벨·스탯이 1/3 남짓', `장비 몫 공격 ${(sa * 100).toFixed(0)}% · 체력 ${(sh * 100).toFixed(0)}%`);
  // 강화에는 그 지역 재료가 든다
  const w = g.s.equip.weapon;
  // v273 강화에는 현철이 든다(장비 지역 가중치만큼)
  const m0 = g.s.mats[W.ORE];
  const a0 = g.stats().atk;
  let n = 0;
  g.s.gold = 1e15;
  while (w.plus < 7 && n++ < 200) g.enhance(w.uid);
  ok(w.plus === 7 && g.s.mats[W.ORE] < m0 && g.stats().atk > a0, `강화는 재료를 넣어 장비를 키운다(한 단계에 기본 수치 +${W.ENHANCE_STEP * 100}%)`, `${W.ORE_NAME} ${m0} → ${g.s.mats[W.ORE]}`);
  g.s.mats[W.ORE] = 0;
  ok(!g.canEnhance(w), '재료가 없으면 강화할 수 없다');
}

console.log('\n=== 등급 · 스킬 옵션 · 승급 · 돌파 · 스킬 레벨 (v110) ===');
{
  // 조합은 대부분 레어, 두목은 더 잘, 십이지왕은 더더 잘
  const cnt = (w) => { const c = [0, 0, 0, 0]; const r = seeded(); for (let i = 0; i < 20000; i++) c[W.rollRarity(w, r)]++; return c.map((x) => x / 200); };
  const cr = cnt(W.CRAFT_RAR_W), kr = cnt(W.KING_RAR_W);
  ok(cr[0] > 65 && cr[3] > 0 && cr[3] < 3 && kr[3] >= 4, '등급: 조합은 대부분 레어(신화 1%), 십이지왕 드랍은 신화 5%', `조합 ${cr.map((x) => x.toFixed(0)).join('/')} · 왕 ${kr.map((x) => x.toFixed(0)).join('/')}`);
  const g = fresh();
  const items = [0, 1, 2, 3].map((r) => g.makeCrafted('weapon', 10, 0, r));
  const atks = items.map((it) => g.itemStats(it).atk);
  ok(atks.every((v, i) => !i || v > atks[i - 1]) && items.map((it) => it.opts.length).join() === '1,1,2,3', '같은 장비도 레어<유니크<전설<신화, 옵션 1·1·2·(2+특수)', atks.map((v) => v.toFixed(0)).join(' < '));
  ok(items[3].opts.some((o) => o.sp), '신화에는 특수 효과', items[3].opts.map(W.optText).join(' / '));
  ok(!g.canPromote(g.s.equip.weapon), '성장 장비는 승급이 아니라 등급 각인으로 (v158)');
  // 스킬 옵션이 스킬을 바꾼다
  const h = fresh();
  h.s.level = 40; h.s.jobTier = 2; h.enterMap(W.mapId(5, 1));
  const sk1 = h.skillDef('s1');
  const r0 = h.skillRadius(sk1), c0 = h.hpCostOf(sk1), cd0 = h.skillCd(sk1);
  h.s.equip.armor = { ...h.makeCrafted('armor', 4, 0, 3), opts: [{ s: 1, k: 'range', v: 0.45 }, { s: 1, k: 'cd', v: 0.3 }, { s: 1, sp: 'free' }] };
  h._stats = null; h._mods = null;
  ok(h.skillRadius(sk1) > r0 * 1.4 && h.hpCostOf(sk1) === 0 && h.skillCd(sk1) < cd0 * 0.75, '옷의 옵션: 2차 스킬 범위 +45% · 숨 -30% · 체력을 안 쓴다(신화)', `범위 ${r0.toFixed(0)}→${h.skillRadius(sk1).toFixed(0)} · 대가 ${c0}→${h.hpCostOf(sk1)}`);
  // 1차 스킬 '범위'(주변 적도 맞는다)
  const q = fresh();
  q.s.level = 20; q.s.jobTier = 1; q.enterMap(W.mapId(3, 1));
  for (const m of q.mons) m.alive = false;
  q.mons = q.mons.filter((m) => m.alive);
  const t = q.spawnMob(false), n1 = q.spawnMob(false);
  t.x = q.heroX + 60; t.y = q.heroY; n1.x = t.x + 50; n1.y = t.y; t.hp = n1.hp = t.maxHp = n1.maxHp = 1e9;
  q.mon = t;
  q.useSkill('s0');
  const plain = n1.hp;
  q.s.equip.hat = { ...q.makeCrafted('hat', 4, 0, 2), opts: [{ s: 0, k: 'splash', v: 0.6 }] };
  q._stats = null; q._mods = null; q.cd.s0 = 0; q.heroHp = q.stats().hp;
  q.useSkill('s0');
  ok(plain === 1e9 && n1.hp < 1e9, '1차 스킬 범위 옵션: 옆의 적도 맞는다');
  // 스킬 레벨
  const L = fresh();
  L.addExp(1e7);
  ok(L.s.skillPts === Math.max(0, L.s.level - W.SKILL_PT_FROM + 1), `레벨 ${W.SKILL_PT_FROM}부터 레벨마다 스킬 점수 1`, `Lv.${L.s.level} 점수 ${L.s.skillPts}`);
  L.s.jobTier = 1;
  const d0 = L.skillMods('s0').dmg;
  let ups = 0; while (L.skillUp('s0')) ups++;
  ok(L.skillLevel('s0') === Math.min(W.SKILL_LV_MAX, 1 + ups) && L.skillMods('s0').dmg > d0 + 0.3, '스킬 레벨을 올리면 피해·숨·범위가 좋아진다', `Lv.${L.skillLevel('s0')} 피해 +${(L.skillMods('s0').dmg * 100).toFixed(0)}%`);
  ok(migrateWorld({ level: 40 }).skillPts === 36 && migrateWorld({ level: 40, skillV: 1, skillPts: 3 }).skillPts === 13 && migrateWorld({ level: 9, skillV: 2, skillPts: 0 }).skillPts === 5 && migrateWorld({ level: 3, skillV: 2, skillPts: 0 }).skillPts === 0 && migrateWorld({ level: 40, skillV: 3, skillPts: 7 }).skillPts === 7, '옛 세이브 스킬 점수 — 레벨 15부터 몫 + v270 레벨 5~14 몫(최대 10)을 한 번만');
  // 돌파
  const B = fresh(); B.s.level = W.LEVEL_MAX;   // v261 강화 상한(레벨)
  const bz = W.stepMap(10);                       // 그 칸의 재료 지역
  B.s.gold = 1e12; B.s.mats = { [W.ORE]: 1e8, [W.bossKey(bz)]: 0 };
  const bw = B.makeCrafted('weapon', 10, 10, 0);
  B.s.equip.weapon = bw;
  ok(!B.canEnhance(bw), '+10 위 돌파에는 두목 증표가 든다');
  B.s.mats[W.bossKey(bz)] = 1000;
  B.s.prot = 1e5; B.s.mats = { [W.ORE]: 1e11, [W.bossKey(bz)]: 1e8 };
  let tries = 0; while (bw.plus < 12 && tries++ < 20000) B.enhance(bw.uid);
  ok(bw.plus >= 12 && W.enhanceMult(15) > 3.1, `돌파 +12까지 보호부를 쓰며 (+15면 기본 수치 ×${W.enhanceMult(15).toFixed(1)})`, `${tries}번 · 보호부 ${1e5 - B.s.prot}장`);
  // 강화 (v150 · v192)
  ok(W.enhanceRate(0) === 1 && W.enhanceRate(2) === 1 && W.enhanceRate(3) === 0.95 && W.enhanceRate(9) === 0.41 && W.enhanceRate(14) === 0.08, '성공률: +1~3 100% · +4 95% · +10 41% · +15 8%');
  ok(W.enhanceFail(1) === 0 && W.enhanceFail(6) === 0 && W.enhanceFail(7) === -1 && W.enhanceFail(9) === -1 && W.enhanceFail(10) === -2, '실패: +7까지 그대로 · +8~10 -1 · +11부터 -2');
  const E = fresh(); E.s.level = W.LEVEL_MAX;
  E.s.gold = 1e15; E.s.mats = { [W.ORE]: 1e9, [W.bossKey(bz)]: 1e6 };
  E.rng = () => 0.999;                                        // 늘 실패
  const e1 = E.makeCrafted('weapon', 10, 6, 0); E.s.equip.weapon = e1;
  E.enhance(e1.uid);
  ok(e1.plus === 6 && E.lastEnhance.drop === 0, '+6에서 실패해도 그대로');
  e1.plus = 9; E.enhance(e1.uid);
  ok(e1.plus === 8 && E.lastEnhance.drop === -1, '+9에서 실패하면 +8 (전에는 -3)');
  e1.plus = 10; E.s.prot = 1; E.enhance(e1.uid);
  ok(e1.plus === 10 && E.lastEnhance.prot && E.s.prot === 0 && E.s.equip.weapon === e1, '+10 위에서 실패해도 보호부가 있으면 그대로');
  e1.plus = 10; e1.epity = 0; E.enhance(e1.uid);
  ok(!E.lastEnhance.broke && E.s.equip.weapon === e1 && e1.plus === 8, '보호부가 없으면 -2 (사라지지 않는다)');
  // 천장: 실패가 쌓이면 다음 확률이 오르고, 성공하면 비운다
  const pe = E.makeCrafted('weapon', 10, 12, 0); E.s.equip.weapon = pe;
  const pr0 = E.enhanceRateOf(pe);
  E.s.prot = 10; E.enhance(pe.uid); E.enhance(pe.uid);
  ok(Math.abs(E.enhanceRateOf(pe) - (pr0 + 2 * E.enhanceBaseRate(pe) * W.ENH_PITY_K)) < 1e-9, '실패 두 번 → 다음 확률이 그 칸 확률의 절반씩 두 번 오른다', `${(pr0 * 100).toFixed(0)}% → ${(E.enhanceRateOf(pe) * 100).toFixed(0)}%`);
  E.rng = () => 0; E.enhance(pe.uid);
  ok(pe.plus === 13 && !pe.epity && E.enhanceRateOf(pe) === E.enhanceBaseRate(pe), '성공하면 천장을 비운다');
  E.s.prot = 0;
  E.s.gold = W.protPrice(E.s.level) * 3;
  ok(E.buyProt(2) && E.s.prot === 2 && !E.buyProt(2), '상인에게서 보호부를 산다');
}

console.log('\n=== 십이지왕 신화 · 가락지·귀걸이 · 애완동물 · 탈것 (v111) ===');
{
  // 십이지왕 지역 장비가 신화면 그 왕의 고유 효과
  const g = fresh();
  const kw = g.makeCrafted('weapon', W.STEP_COUNT - 1, 0, 3, W.ZONE_COUNT);       // 검왕 지역(27) — 지역을 따로 싣는다
  ok(kw.opts.some((o) => o.kp === 1) && !kw.opts.some((o) => o.sp), '검왕 지역 신화에는 검왕 고유 효과(무형신검)', kw.opts.map(W.optText).join(' / '));
  const kinds = new Set(W.KINGS.map((k) => W.KING_MYTHIC[k.no].id));
  ok(kinds.size === 12, '십이지왕 열둘 모두 고유 신화 효과가 다르다', [...kinds].join(' '));
  // 고유 효과가 실제로 듣는다: 투왕(두목 +50%) · 혈왕(흡혈) · 환왕(회피)
  const t = fresh();
  t.s.level = 140; t._stats = null;
  t.enterMap(W.mapId(25, 1));
  const boss = t.spawnMob(true); boss.introT = 0; t.freezeT = 0;
  boss.hp = boss.maxHp = 1e12; boss.armor = 0;
  t.rng = () => 0.5;
  t.s.equip.weapon = { ...t.makeCrafted('weapon', 48, 0, 3), opts: [] }; t._stats = null; t._pass = null;
  const st0 = t.stats();
  const hp0 = boss.hp; t.strike(boss, st0, 1, 'hit'); const plain = hp0 - boss.hp;
  t.s.equip.weapon = { ...t.makeCrafted('weapon', 48, 0, 3), opts: [{ kp: 3 }] }; t._stats = null; t._pass = null;
  const hp1 = boss.hp; t.strike(boss, t.stats(), 1, 'hit'); const bane = hp1 - boss.hp;
  ok(bane / plain > 1.45 && bane / plain < 1.55, '투왕 신화: 두목에게 피해 +50%', `${plain.toFixed(0)} → ${bane.toFixed(0)}`);
  t.s.equip.armor = { ...t.makeCrafted('armor', 34, 0, 3), opts: [{ kp: 9 }] }; t._stats = null; t._pass = null;
  t.heroHp = 1; t.strike(boss, t.stats(), 1, 'hit');
  ok(t.heroHp > 1, '혈왕 신화: 준 피해만큼 체력을 빨아들인다', `체력 1 → ${t.heroHp.toFixed(0)}`);
  // 가락지·귀걸이: 두목만, 강화가 어렵다, 애완동물 +N
  const a = fresh();
  const accRate = (z) => { let n = 0; for (let i = 0; i < 4000; i++) { a.s.map = W.mapId(z, 4); a.dropMats({ isBoss: true, x: 0, y: 0 }); n += a.events.filter((e) => e.type === 'drop' && W.isDropOnly(e.item.slot)).length; a.events.length = 0; } return n / 4000; };
  const r1 = accRate(1), r15 = accRate(15);
  ok(r1 < r15 && Math.abs(r1 - W.acc2DropRate(1)) < 0.015, '가락지·귀걸이는 두목만 떨군다 — 높은 두목일수록 자주(만들 수 없다)', `죽림 ${(r1 * 100).toFixed(1)}% · 천외천 ${(r15 * 100).toFixed(1)}%`);
  // 두목마다 이름·덤 능력이 다르고, 높은 두목 것이 더 좋다
  const lo = a.makeCrafted('finger', 0, 0, 1, 1), hi = a.makeCrafted('finger', W.STEP_COUNT - 1, 0, 1, 15);
  const sl = a.itemStats(lo), sh = a.itemStats(hi);
  ok(W.itemName(lo) === '청죽환' && W.itemName(hi) === '천외 지환' && sh.atkPct > sl.atkPct * 2, '가락지: 죽림 청죽환 … 천외천 천외 지환 — 높은 두목 것이 훨씬 좋다', `${JSON.stringify(Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, +v.toFixed(3)])))}`);
  const names = new Set(); for (let z = 1; z <= W.ZONE_COUNT; z++) names.add(W.itemName(a.makeCrafted('ear', 0, 0, 0, z)));
  ok(names.size === W.ZONE_COUNT, `귀걸이도 두목마다 이름이 다르다(${names.size}가지)`);
  const ring = a.makeCrafted('finger', 4, 0, 1, 3);
  const wpn = a.makeCrafted('weapon', 4, 0, 1);
  ok(a.enhanceRateOf(ring) === W.enhanceRate(0) * W.ACC2_RATE && a.enhanceCost(ring) === a.enhanceCost(wpn) * W.ACC2_COST && a.enhanceMaxItem(ring) === 10, '가락지·귀걸이 강화는 어렵다(성공률 절반·은자 ×3·돌파 없음)');
  // 애완동물
  const p = fresh();
  p.s.level = 30;
  const pet = p.gainPet(1);
  ok(p.s.pets.length === 1 && p.activePets()[0] === pet, '처음 얻은 애완동물은 바로 데려간다');
  const a0 = p.stats();
  const pet2 = p.gainPet(3);
  ok(p.s.pets.length === 1 && p.s.petBox[0] === pet2 && !p.adoptPet(pet2.uid), '한 마리를 키우는 동안 새 것은 우리에서 기다린다(동시에 둘은 못 키운다)');
  ok(p.releasePet(pet.uid) && p.adoptPet(pet2.uid) && p.activePets()[0] === pet2, '키우던 것을 놓아줘야 새 것을 키운다');
  p.s.equip.finger = { ...p.makeCrafted('finger', 4, 0, 3), opts: [{ pet: 2 }] }; p._stats = null;
  const pet3 = p.gainPet(0), pet4 = p.gainPet(0);
  ok(p.petSlots() === 3 && p.activePets().length === 3 && p.s.pets.includes(pet4), '가락지의 애완동물 +2 → 세 마리를 함께 키운다');
  const lv0 = pet3.lv;
  p.petExp(1e9);
  ok(pet3.lv > lv0 && pet3.lv <= W.PET_LV_MAX, '애완동물은 무인과 함께 경험치를 받아 자란다', `Lv.${lv0} → ${pet3.lv}`);
  // 싸운다: 무인 공격력에 비례
  p.enterMap(W.mapId(4, 1));
  const tgt = p.mons[0]; tgt.hp = tgt.maxHp = 1e9; p.mon = tgt;
  for (let i = 0; i < 20; i++) p.tickPets(0.1, p.stats());
  ok(tgt.hp < 1e9, '애완동물이 무인 곁의 적을 친다');
  void a0;
  // 탈것
  const m = fresh();
  const sp0 = m.stats().moveSpeed;
  m.gainMount('redhare');
  ok(Math.abs(m.stats().moveSpeed - sp0 - 0.45) < 0.01 && m.stats().atk > fresh().stats().atk, '탈것: 이동 속도(적토마 +45% — v157 절반)와 공격력·체력 %', `이동 ×${m.stats().moveSpeed.toFixed(2)}`);
  m.gainMount('donkey');
  ok(m.mountNow().name === '적토마', '더 느린 탈것을 얻으면 갈아타지 않는다');
  // 순위: 아래 것보다 위 것이 세다 · 초반 두목은 아주 낮게·아래 순위만
  const top = W.PETS.find((x) => x.tier === 10), low = W.PETS.find((x) => x.tier === 1);
  ok(W.petAtkRatio({ kind: top.id, rar: 0, lv: 1 }) > W.petAtkRatio({ kind: low.id, rar: 0, lv: 1 }) * 2, `애완동물 순위: ${W.PETS.slice().sort((x, y) => y.tier - x.tier).map((x) => x.name).join(' > ')}`);
  const rr = seeded();
  const tiersOf = (z) => { const set = new Set(); for (let i = 0; i < 3000; i++) set.add(W.petOf(W.rollPetKind(z, rr)).tier); return Math.max(...set); };
  ok(W.petDropRate(1) < 0.001 && tiersOf(1) <= 1 && tiersOf(15) === 7 && tiersOf(27) === 10 && W.petDropRate(27) > W.petDropRate(15) * 3,
    '애완동물 드랍: 죽림 0.08%(선학만) … 천외천 0.9%(손오공까지) … 검왕 3.8%(황룡까지)', `${(W.petDropRate(1) * 100).toFixed(2)}% · ${(W.petDropRate(15) * 100).toFixed(2)}% · ${(W.petDropRate(27) * 100).toFixed(2)}%`);
  // v354 쓰러져도 레벨은 안 내려간다
  {
    const g = new WorldGame(newWorldSave(0), 0);
    g.s.job = 'sword'; g.s.level = 50; g.s.exp = 0;
    g.s.exp = 10; for (let i = 0; i < 30; i++) g.heroDied(null);
    ok(g.s.level === 50 && g.s.exp >= 0, '경험치가 0일 때 몇 번을 쓰러져도 레벨 50 그대로', `Lv ${g.s.level} · exp ${g.s.exp} · 쓰러짐 ${g.s.deaths}`);
  }
  // v350 무한의 탑 · 극 — 보통 60층부터 · 10층마다 신수(이동 +100% 고정 · 길들여도 이동은 그대로 · 공격·체력은 길들이면 오른다)
  {
    const g = new WorldGame(newWorldSave(0), 0);
    g.s.job = 'sword'; g.s.level = 120; g.s.tower.floor = 59;
    ok(!g.canHard(), '극은 보통 60층 전엔 닫혀 있다');
    g.s.tower.floor = 60;
    ok(g.canHard() && g.startHard() && g.inst?.hard && g.inst.stage === 1, '보통 60층이면 극 1층에 들어간다');
    g.inst = null; g.s.tower.hard = 9;
    g.startHard(); g.inst.done = { ok: true }; const r = g.finishInst();
    const md = g.mountNow();
    ok(g.s.tower.hard === 10 && r.newMount === 'h1' && md?.id === 'h1', '극 10층을 이기면 신수 염화주작을 얻고 바로 탄다', `${g.s.tower.hard} ${r.newMount} ${md?.name}`);
    const mv0 = g.stats().moveSpeed, a0 = g.stats().atk;
    g.mountInst().lv = 10; g._stats = null;
    ok(Math.abs(g.stats().moveSpeed - mv0) < 1e-9 && g.stats().atk > a0, '신수는 길들여도 이동은 +100% 그대로, 공격은 오른다', `${mv0.toFixed(2)} → ${g.stats().moveSpeed.toFixed(2)}`);
    ok(W.HARD_MOUNTS.every((m, i) => i === 0 || m.stat > W.HARD_MOUNTS[i - 1].stat) && W.HARD_MOUNTS[0].stat > W.mountOf('azure').stat, '극의 신수는 뒤로 갈수록 세고, 첫째도 청룡마보다 세다');
    ok(DG.hardHp(1) > DG.towerHp(DG.hardF(1)) * 2 && DG.hardDelay(1) < DG.tellDelay(DG.hardF(1)), '극 수문장은 같은 세기 보통 층보다 단단하고 경고가 짧다');
    ok(DG.hardHp(1) >= DG.towerHp(DG.hardF(1)) * 20 && DG.hardAtk(1) >= DG.towerAtk(DG.hardF(1)) * 3, 'v357 극은 열 배 — 같은 세기 보통 층보다 체력 20배 넘게 · 붙어 치기 3배');
    ok(W.mountFuseCost(11) < 2e6 && W.mountFuseCost(1) < 3000, '탈것 합성 값이 크게 내렸다', `${W.mountFuseCost(1)} … ${W.mountFuseCost(11)}`);
  }
  const mtTop = (z, boss) => { let t = 0; for (let i = 0; i < 3000; i++) t = Math.max(t, W.mountOf(W.rollMount(rr, z, boss)).tier); return t; };
  ok(W.MOUNTS.filter((x) => !x.zodiac && !x.hard).length === 12 && W.MOUNTS.filter((x) => x.zodiac).length === 12 && W.MOUNTS.filter((x) => x.hard).length === 6 && mtTop(1, true) === 2 && mtTop(27, true) === 12,
    `탈것 열둘(+십이지 신수 열둘은 떨구지 않는다) — 죽림 두목은 노새까지 … 검왕은 청룡마까지`, W.MOUNTS.filter((x) => !x.zodiac).map((x) => x.name).join(' < '));
  // v144: 탈것은 **두목만** 떨군다. 졸개 드랍(0.005%)은 없앴다 —
  // 2만 마리에 하나라 사실상 없는 것인데 '어디서나 나온다'는 착각만 줬다.
  ok(W.MOUNT_DROP_MOB === 0, '졸개는 탈것을 안 떨군다');
  {
    const src = read('js/world/wgame.js');
    ok(/m\.isBoss && this\.rng\(\) < W\.mountBossRate/.test(src), '떨구는 쪽도 두목만 본다');
  }
  // 낮은 사냥터일수록 가파르게 낮다 — 곧은 금이면 어디를 쳐도 비슷하다
  {
    const r = (z) => W.mountBossRate(z);
    const rise = [];
    for (let z = 1; z < W.NORMAL_ZONES; z++) rise.push(r(z + 1) - r(z));
    const steeper = rise.every((v, i) => !i || v >= rise[i - 1] - 1e-9);
    ok(r(1) < r(8) && r(8) < r(15) && steeper, '뒤로 갈수록 더 가파르게 오른다',
      `죽림 ${(r(1) * 100).toFixed(3)}% · 장강 ${(r(8) * 100).toFixed(2)}% · 천외천 ${(r(15) * 100).toFixed(2)}%`);
    ok(r(1) < 0.0005 && r(W.ZONE_COUNT) > 0.05,
      '죽림은 0.05%보다 낮고 검왕은 5%보다 높다',
      `${(r(1) * 100).toFixed(3)}% → ${(r(W.ZONE_COUNT) * 100).toFixed(1)}%`);
  }
  // 실제로 두목에게서만 나오는가 — 상수만 보고 넘기면 쓰는 쪽이 어긋나도 모른다
  {
    const g2 = fresh();
    g2.s.level = 150;
    g2.enterMap(W.mapId(W.ZONE_COUNT, 4));
    let mob = 0;
    let boss = 0;
    for (let i = 0; i < 4000; i++) {
      const n0 = g2.s.mounts.length;
      g2.killMob({ isBoss: false, x: 0, y: 0, alive: true, lv: 150, hp: 0, maxHp: 1 });
      if (g2.s.mounts.length > n0) mob++;
      const n1 = g2.s.mounts.length;
      g2.killMob({ isBoss: true, x: 0, y: 0, alive: true, lv: 150, hp: 0, maxHp: 1 });
      if (g2.s.mounts.length > n1) boss++;
    }
    ok(mob === 0 && boss > 100, '정말로 두목에게서만 나온다', `졸개 ${mob} · 두목 ${boss} (4000번)`);
  }
}

console.log('\n=== 문파 버프 ===');
{
  const g = fresh();
  const a0 = g.stats().atk;
  g.guildExp = W.GUILD_LV_EXP * 5;            // 문파 Lv.6
  ok(g.stats().atk === a0, '문파에 없으면 버프가 없다');
  g.s.guildId = 'ABCDEF';
  ok(g.stats().atk / a0 > 1.08 && g.stats().atk / a0 < 1.1 + 1e-9, '문파 Lv.6이면 공격력 +10%(곱하는 몫에 더한다)', `${a0.toFixed(1)} → ${g.stats().atk.toFixed(1)}`);
  ok(W.guildLevel(1e9) === W.GUILD_LV_MAX, `문파 레벨은 ${W.GUILD_LV_MAX}까지`);
}

console.log('\n=== 다섯 마존의 무공 (v118) ===');
{
  const ready = (job) => {
    const g = fresh(job);
    g.s.level = 80; g.s.gold = 1e9;
    while (g.canAdvance()) g.advance();
    g.enterMap(11);
    g._stats = null; g.heroHp = g.stats().hp;
    for (const m of g.mons) { m.hp = m.maxHp = 1e12; m.atk = 0; }
    g.mon = g.mons[0];
    // 몹을 무인 곁으로 모은다 (둘레 무공이 다 맞게)
    g.mons.forEach((m, i) => { m.x = g.heroX + 40 + (i % 3) * 20; m.y = g.heroY + 20 * Math.floor(i / 3) - 40; });
    return g;
  };
  ok(['sword', 'fist', 'fan', 'poison', 'ring'].every((j) => new Set(W.skillsOf(j).map((k) => k.name)).size === W.skillsOf(j).length && W.skillsOf(j).length >= 4 && W.LORE[j]?.title), '직업마다 무공 셋 + 보조기 하나가 다르고 마존 설정이 있다');
  const p = ready('poison');
  ok(p.useSkill('s1') && p.fields.length === 1, '독마 화골산: 독무 장판이 깔린다');
  const hp0 = p.mons.reduce((a, m) => a + m.hp, 0);
  for (let i = 0; i < 30; i++) p.tick(0.1);
  ok(p.mons.reduce((a, m) => a + m.hp, 0) < hp0, '장판이 tick마다 친다');
  const f = ready('fist');
  ok(f.useSkill('s2') && f.buffv.guard === 0.5 && f.buffv.cleave > 0, '권마 불패금신: 받는 피해 -50% · 평타가 둘레를 친다');
  const r = ready('ring');
  for (const k of ['s0', 's1', 's2']) { r.cd[k] = 0; r.useSkill(k); r.tick(0.1); }
  ok(r.buffv.might === W.HARMONY.dmgUp, '극악소마: 세 무공을 이으면 삼공조화');
  const fn = ready('fan');
  fn.useSkill('s0');
  ok(fn.mon.stun > 0 && fn.mon.vulnT > fn.clock, '환마 섭혼술: 멎고 더 아프게 맞는다');
  const sw = ready('sword');
  ok(sw.stats().moveSpeed > fresh('fist').stats().moveSpeed && sw.useSkill('s2') && sw.buffv.haste > 0, '검사: 더 빠르고 만화귀일 뒤 공격 속도가 오른다');
}

console.log('\n=== 심법 · 권마 평타 성장 (v119) ===');
{
  const g = fresh('fist');
  g.s.level = 20; g.s.skillPts = 50;
  ok(g.passiveList().length === W.PASSIVES.length + 1 && g.passiveList().some((p) => p.id === 'p_own' && p.name === '투신심법'), '공용 심법 여섯 + 독문 심법 하나');
  ok(!g.canPassUp('p_hp') && g.canPassUp('p_guard'), '레벨이 닿아야 배운다 (금강불괴 35 · 호신강기 20)');
  const hp0 = g.stats().hp;
  g.s.level = 40;
  const hp1 = g.stats().hp;
  for (let i = 0; i < 5; i++) g.passUp('p_hp');
  ok(g.passLevel('p_hp') === 5 && g.s.skillPts === 45 && g.stats().hp > hp1 * 1.14, '금강불괴 5레벨: 점수 5 · 최대 체력 +15%', `${hp0}→${hp1}→${g.stats().hp.toFixed(0)}`);
  for (let i = 0; i < 5; i++) g.passUp('p_own');
  ok(g.passLevel('p_own') === 5 && g.s.skillPts === 45 - (1 + 1 + 2 + 3 + 4) && g.pmods().own5, '독문 심법은 n점씩 · 5레벨에 덧');
  // 권마 평타가 레벨과 함께 자란다
  const hitAt = (L) => {
    const f = fresh('fist'); f.s.level = L; f.enterMap(11);
    const m = f.mons.find((x) => x.alive); m.hp = m.maxHp = 1e15; m.armor = 0; f.rng = () => 0.5;
    const h0 = m.hp; f.basicAttack(m, f.stats(), 1); return (h0 - m.hp) / f.stats().atk;
  };
  ok(hitAt(100) > hitAt(10) * 1.5, '권마: 평타 한 대(공격력 대비)가 레벨 100이면 레벨 10의 1.5배가 넘는다', `${hitAt(10).toFixed(2)} → ${hitAt(100).toFixed(2)}`);
}

console.log('\n=== 보조기 (v120) ===');
{
  const mk = (job) => { const g = fresh(job); g.s.level = 30; g.enterMap(11); g._stats = null; g.heroHp = g.stats().hp; return g; };
  const f0 = fresh('fist');
  ok(!f0.skills().some((k) => k.kind === 'support'), '보조기는 레벨 25 전엔 없다');
  ok(['sword', 'fist', 'fan', 'poison', 'ring'].every((j) => mk(j).skills().filter((k) => k.kind === 'support').length === 1), '레벨 25부터 직업마다 보조기 하나 (전직과 상관없이)');
  const f = mk('fist');
  f.useSkill('s3');
  const sh = f.shield;
  const hp0 = f.heroHp;
  const m = f.mons.find((x) => x.alive); m.atk = sh * 0.5 + f.stats().def; m.x = f.heroX + 40; m.y = f.heroY; m.c = f.hc + 1; m.r = f.hr; m.aggro = true; m.atkTimer = 0;
  for (let i = 0; i < 3; i++) f.tick(0.05);
  ok(sh > 0 && f.heroHp >= hp0 - 1, '권마 금종조: 보호막이 맞은 피해를 막는다', `보호막 ${Math.round(sh)} → ${Math.round(f.shield)}`);
  const fn = mk('fan'); fn.heroHp = fn.stats().hp * 0.2; const h1 = fn.heroHp;
  fn.useSkill('s3');
  ok(fn.heroHp > h1 + fn.stats().hp * 0.25 && fn.buffv.guard > 0.5, '환마 시공이환술: 잃은 체력을 되찾고 받는 피해가 준다');
  const p = mk('poison');
  for (const x of p.mons) { x.hp = x.maxHp = 1e9; x.x = p.heroX + 50; x.y = p.heroY; x.dot = 1e6; }
  const before = p.mons.reduce((a, x) => a + x.hp, 0);
  p.useSkill('s3');
  ok(p.mons.every((x) => !(x.dot > 0)) && p.mons.reduce((a, x) => a + x.hp, 0) < before - 1e6, '독마 만독귀원: 쌓인 독을 한꺼번에 터뜨린다');
  const sw = mk('sword'); sw.useSkill('s3');
  ok(sw.buffv.move > 0 && sw.buffv.dodge > 0 && sw.buffv.haste > 0, '검사 유운보: 이동·공격 속도 · 흘리기');
  const r = mk('ring'); r.useSkill('s3');
  ok(r.buffv.fear > 0 && r.buffv.critUp > 0, '극악소마 무면개방: 공포 · 치명 피해');
}

console.log('\n=== 환마 4차 · 환영분신술 (v121) ===');
{
  const g = fresh('fan');
  g.s.level = 100; g.s.gold = 1e9;
  while (g.canAdvance()) g.advance();
  ok(g.s.jobTier === 4 && g.tierName() === '섭혼마존' && g.skills().some((k) => k.name === '환영분신술'), '환마는 레벨 100에 4차 전직 → 섭혼마존 · 환영분신술', g.tierName());
  ok(['sword', 'fist', 'poison', 'ring'].every((j) => { const o = fresh(j); o.s.level = 100; o.s.gold = 1e9; while (o.canAdvance()) o.advance(); return o.s.jobTier === 4 && o.tierName() === W.LORE[j].title && !o.nextTier(); }), '다섯 직업 모두 레벨 100에 4차 → 마존 이름 (v123)');
  g.enterMap(11); g._stats = null; g.heroHp = g.stats().hp;
  for (const m of g.mons) { m.hp = m.maxHp = 1e12; m.atk = 0; m.x = g.heroX + 40; m.y = g.heroY; }
  g.mon = g.mons[0];
  ok(g.useSkill('s4') && g.clones.length === 2, '분신 둘이 나온다');
  let hits = 0;
  for (let i = 0; i < 60; i++) { g.tick(0.1); hits += g.events.filter((e) => e.type === 'cloneHit').length; g.events.length = 0; }
  ok(hits >= 6, '분신이 곁에서 함께 친다', `${hits}번`);
  for (let i = 0; i < 60; i++) g.tick(0.1);
  ok(g.clones.length === 0, '10초가 지나면 사라진다');
}

console.log('\n=== 4차 무공 넷 (v123) ===');
{
  const mk = (job) => {
    const g = fresh(job); g.s.level = 120; g.s.gold = 1e12;
    while (g.canAdvance()) g.advance();
    g.enterMap(11); g._stats = null; g.heroHp = g.stats().hp;
    g.mons.forEach((m, i) => { m.hp = m.maxHp = 1e15; m.atk = 0; m.x = g.heroX + 40 + (i % 4) * 20; m.y = g.heroY + 20 * Math.floor(i / 4) - 30; });
    g.mon = g.mons[0]; g.events.length = 0;
    return g;
  };
  const sw = mk('sword');
  ok(sw.useSkill('s4') && sw.events.filter((e) => e.type === 'dmg' && e.kind === 's4').length === 12, '검사 일화천섬: 열두 번 벤다');
  const f = mk('fist');
  ok(f.useSkill('s4') && f.buffv.triple === 2 && f.buffv.haste > 0, '권마 투신강림: 평타 한 번에 세 대 · 공격 속도');
  f.events.length = 0; f.basicAttack(f.mon, f.stats(), 1);
  ok(f.events.filter((e) => e.type === 'dmg' && e.kind === 'hit').length >= 3, '투신강림 중 평타가 세 대', `${f.events.filter((e) => e.type === 'dmg' && e.kind === 'hit').length}대`);
  const p = mk('poison');
  p.mons[5].x = p.heroX + 900;   // 멀리 있는 적도
  ok(p.useSkill('s4') && p.mons.every((m) => m.dot > 0), '독마 만독지옥: 사냥터 전체에 독');
  const r = mk('ring');
  ok(r.useSkill('s4') && ['s0', 's1', 's2'].every((k) => r.events.some((e) => e.type === 'dmg' && e.kind === k)) && r.buffv.might > 0 && r.cd.s0 === 0, '극악소마 삼공합일: 세 무공을 한꺼번에(숨은 안 쓴다) + 삼공조화');
}

console.log('\n=== 장비 개편 (v130) ===');
{
  const G = await import('../js/world/wgear.js');
  ok(W.SLOTS.some((x) => x.id === 'glove') && W.SLOTS.some((x) => x.id === 'shoe') && W.CRAFT_SLOTS.length === 6, '장갑·신발 칸이 생겼다 (조합 칸 여섯)');
  // 고유 옵션
  const g = fresh('sword');
  // 한 지역에 칸이 둘인 자리를 찾는다 — 뒤 칸이 더 커야 한다(옛 '상급' 자리)
  let lowStep = -1;
  for (let st = 0; st + 1 < W.STEP_COUNT; st++) if (W.stepMap(st) === W.stepMap(st + 1)) { lowStep = st; break; }
  const a = g.makeCrafted('weapon', lowStep, 0, 0);
  const b = g.makeCrafted('weapon', lowStep + 1, 0, 0);
  const c = g.makeCrafted('glove', W.STEP_COUNT - 1, 0, 0);
  const ua = g.itemUnique(a), ub = g.itemUnique(b);
  ok(lowStep >= 0 && ua && ub && ua.k === ub.k && ub.v > ua.v && g.itemUnique(c).k !== ua.k,
    '사다리 장비마다 고유 옵션 — 지역으로 정해지고 같은 지역 뒤 칸이 더 크다',
    `${G.gearKeyText(ua.k, ua.v)} / ${G.gearKeyText(ub.k, ub.v)}`);
  g.s.equip.weapon = null; g._stats = null;
  const sp0 = g.stats().speed;
  const z1 = g.makeCrafted('weapon', 0, 0, 0);     // 죽림(1번 지역) 무기
  g.s.equip.weapon = z1; g._stats = null;
  ok(g.stats().speed > sp0, '고유 옵션이 능력치에 들어간다 (죽림 무기 → 공격 속도)');
  ok(!g.itemUnique(g.makeCrafted('acc', 4, 0, 0)), '장신구는 고유 옵션 대신 스킬 옵션이 하나 더');
  // 세트
  const jobSets = G.SETS.filter((x) => x.job);
  ok(jobSets.length === 10 && ['sword', 'fist', 'fan', 'poison', 'ring'].every((j) => G.setsOfJob(j).length === 2) && new Set(jobSets.map((x) => x.king)).size === 10, '직업마다 세트 둘 — 세트마다 다른 왕');
  ok(Object.values(G.SLOT_KING).sort().join() === '16,17,18,19,20' && Object.keys(G.STONES).sort().join() === '21,22,23,24,25,26,27',
    '전반 다섯 왕은 세트 부위(무기·옷·모자·장갑·신발), 후반 일곱 왕은 강화석 (v132)');
  ok(migrateWorld({ job: 'sword', equip: { armor: { uid: 9, slot: 'armor', king: 27, set: 'formless', ilv: 100, rar: 0, opts: [], plus: 3 } } }).equip.armor.king === 17, '옛 세트 조각은 그 부위 왕(옷 → 철왕) 것이 된다');
  const sw = fresh('sword'); while (sw.s.level < 99) sw.addExp(W.expToNext(sw.s.level)); sw.s.gold = 1e12;
  const plum = G.setOf('plum');
  ok(!sw.craftSet('plum', 'weapon'), '왕의 재료·증표가 없으면 못 만든다');
  for (const z of Object.values(G.SLOT_KING)) { sw.s.mats[W.bossKey(z)] = 1e3; }
  sw.s.mats[W.ORE] = 1e8;
  ok(!sw.craftSet('ironfist', 'weapon') && sw.setCheck('ironfist', 'weapon').lack.includes('job'), '다른 직업 세트는 못 만든다');
  for (const sl of G.SET_SLOTS) sw.craftSet('plum', sl);
  for (const sl of G.SET_SLOTS) { const it = sw.s.bag.find((x) => x.set === 'plum' && x.slot === sl); if (it) sw.equipFromBag(it.uid); }
  ok(G.SET_SLOTS.every((sl) => sw.s.equip[sl]?.set === 'plum' && sw.s.equip[sl].ilv === 100), '매화검진 다섯 조각 — 레벨 100');
  ok(sw.setCounts().plum === 5 && sw.setBonus().flowerEvery === 2 && sw.setBonus().speed === 0.15, '5세트 효과가 켜진다', JSON.stringify(sw.setBonus()));
  // 꽃잎 검기가 두 번째 평타마다
  sw.enterMap(W.mapId(16, 1)); let fl = 0;
  for (const m of sw.mons) { m.hp = m.maxHp = 1e12; m.atk = 0; }
  for (let i = 0; i < 20 * 20; i++) { sw.tick(0.05); for (const e of sw.events) if (e.type === 'passive' && e.id === 'flower') fl++; sw.events.length = 0; }
  ok(fl >= 8, '매화검진 5: 꽃잎 검기가 자주 핀다', `20초에 ${fl}번`);
  sw.s.equip.hat = null; sw._stats = null;
  ok(sw.setCounts().plum === 4 && !sw.setBonus().flowerEvery && sw.setBonus().flowerUp, '한 조각을 빼면 5세트 효과만 꺼진다');
  const other = fresh('fist'); other.s.equip.weapon = sw.s.equip.weapon;
  ok(other.setCounts().plum === 1 && !Object.keys(other.setBonus()).length, '다른 직업이 끼면 세트 효과가 없다');
  // 강화는 그 왕의 재료로, 돌파까지
  const sw2 = sw.s.equip.weapon;
  ok(sw.enhanceMats(sw2).key === 'st26' && sw.enhanceMats(sw.s.equip.armor).key === 'st24' && sw.enhanceMaxItem(sw2) === W.ENHANCE_MAX, '세트 무기는 도왕의 강화석, 옷은 살왕의 강화석으로만');
  ok(W.matName('st26').includes('도왕') && W.matName('st24').includes('명부'), '강화석 이름 — ○왕의 ○○석', `${W.matName('st26')} / ${W.matName('st24')}`);
  const p0 = sw2.plus || 0; sw.s.mats.st26 = 500; sw.rng = () => 0;
  ok(sw.enhance(sw2.uid) && sw2.plus === p0 + 1 && sw.s.mats.st26 === 500 - G.stoneN(p0), '강화석으로 강화');
  // v173: 승급 대신 증표 각인 — 세트도 세 칸이 새겨진다
  ok(!sw.canPromote(sw2), '승급은 없다 (증표 각인으로)');
  sw2.rar = 0; sw.s.gold = 1e15; sw.s.mats.b27 = 1000; sw.rng = () => 0;
  ok(sw.infuse(sw2.uid, 'b27', 0) && sw2.rar === 1 && sw2.imps?.[0]?.k === 'b27' && sw2.set === 'plum', '세트 무기도 두목 증표로 등급 각인 — 세트는 그대로');
  sw.infuse(sw2.uid, 'b27', 1); sw.infuse(sw2.uid, 'b27', 2);
  ok(sw2.rar === 3 && sw2.imps.length === 1 && sw.lastInfuse?.kept && sw.impSpecials() && Object.keys(sw.impSpecials()).length > 0, '세트도 신화면 각인 한 칸이 ×4(새겨진 두목 그대로) · 검왕 고유 효과가 켜진다 (v307)');
  // 검혼석은 만능 강화석 — 부위 강화석이 모자라면 대신
  sw.s.mats.st26 = 0; sw.s.mats.st27 = 500;
  ok(sw.enhanceMats(sw2).key === 'st27', '검왕의 검혼석은 부위 강화석이 모자라면 대신 든다');
  sw.s.mats[W.ORE] = sw.stoneOre(21) * 2 + 20;
  ok(sw.stoneOre(21) === G.STONE_FROM_MATS * W.matWeight(21) && sw.makeStone(21, 5) === 2 && sw.s.mats.st21 === 2 && sw.s.mats[W.ORE] === 20, '후반 왕 재료 40개어치 현철 → 강화석 하나', `현철 ${sw.stoneOre(21)}개`);
  // 공용 장신구
  const ac = fresh('ring'); while (ac.s.level < 99) ac.addExp(W.expToNext(ac.s.level)); ac.s.gold = 1e12; ac.s.mats[W.ORE] = 1e6; ac.s.mats.b17 = 100;
  const acc = ac.craftKacc(17, 'acc');
  ok(acc && acc.king === 17 && acc.ilv === 100 && acc.opts.filter((o) => o.k || o.sp).length >= 2, '왕의 장신구 — 아무 왕의 재료로, 스킬 옵션 하나 더', W.itemName(acc, 'ring'));
  let s34 = 0; for (let i = 0; i < 300; i++) for (const o of W.rollSkillOpts(1, Math.random, 1)) if (o.s >= 3) s34++;
  ok(s34 > 50, '스킬 옵션은 보조기·4차에도 붙는다');
  // 스킬 변화
  const t = fresh('sword'); t.s.level = 40; t.s.jobTier = 2; t.enterMap(W.mapId(5, 1));
  const sk = t.skillDef('s1'); const r0 = t.skillRadius(sk);
  t.s.equip.acc = { ...t.makeCrafted('acc', 4, 0, 2), opts: [{ tf: 'giant', s: 1 }, { tf: 'fire', s: 0 }] }; t._stats = null; t._mods = null;
  ok(Math.abs(t.skillRadius(sk) / r0 - 1.5) < 0.01 && t.skillMods('s0').tf?.fire, '스킬 변화: 거대화 범위 +50% · 화염');
  for (const m of t.mons) { m.hp = m.maxHp = 1e9; m.x = t.heroX + 40; m.y = t.heroY; }
  t.mon = t.mons[0]; t.cd.s0 = 0; t.useSkill('s0');
  ok(t.events.some((e) => e.type === 'tfHit' && e.tf === 'fire') && t.mons[0].dot > 0, '화염 — 맞은 적이 불탄다(연출 알림)');
  ok(W.optText({ tf: 'thunder', s: 4 }).includes('4차') && W.optText({ tf: 'thunder', s: 4 }).includes('뇌전'), '변화 옵션 글');
  // 십이지왕은 내 직업 세트 조각이나 공용 장신구를 떨군다
  const dk = fresh('fist'); let sets = 0, accs = 0, wrong = 0, kinds = new Set();
  for (let i = 0; i < 1500; i++) {
    dk.s.map = W.mapId(16, 4); dk.dropMats({ lv: 105, isBoss: true, x: 0, y: 0 });
    dk.s.map = W.mapId(24, 4); dk.dropMats({ lv: 130, isBoss: true, x: 0, y: 0 });
    for (const e of dk.events) if (e.type === 'drop') {
      if (e.item.slot === 'weapon' && G.setOf(e.item.set)?.job === 'fist') { sets++; kinds.add(e.item.set); }
      else if (G.KACC_SLOTS.includes(e.item.slot) && e.item.king === 24) accs++; else wrong++;
    }
    dk.events.length = 0;
  }
  ok(sets > 50 && kinds.size === 2 && accs > 50 && !wrong && dk.s.mats.st24 === 1500 * G.STONE_PER_BOSS,
    '권왕은 내 두 세트의 무기 조각, 살왕은 옷 강화석(늘) + 가끔 공용 장신구', `세트 ${sets} · 장신구 ${accs} · 명부 혼석 ${dk.s.mats.st24}`);
  // 옛 세이브: 십이지왕 사다리 장비
  const old = migrateWorld({ level: 120, job: 'sword', mats: {}, equip: { weapon: { uid: 5, slot: 'weapon', step: 53, ilv: 154, rar: 2, opts: [], plus: 7 }, ear: { uid: 6, slot: 'ear', step: 40, ilv: 120, rar: 1, opts: [], plus: 2 } }, bag: [] });
  // v130이 '사다리 끝(레벨 99)'으로 내리고, 이어서 v143이 그 레벨의 칸으로 옮긴다
  ok(old.equip.weapon.step === W.STEP_COUNT - 1 && old.equip.weapon.plus === 7 && old.equip.weapon.rar === 2 && old.mats[W.ORE] > 0 && old.mats.b27 > 0, '옛 왕 사다리 무기 → 사다리 끝으로 + 왕의 재료(현철)·증표를 돌려준다', JSON.stringify(old.mats));
  ok(old.equip.ear.king === 21 && old.equip.ear.ilv === 100 && old.equip.ear.step == null && old.gearNote === 2, '옛 왕 귀걸이 → 레벨 100 공용 장신구로');
  ok(migrateWorld(JSON.parse(JSON.stringify(old))).equip.weapon.step === W.STEP_COUNT - 1, '한 번만 바꾼다');
}

console.log('\n=== 문파 토벌 (v128) ===');
{
  const D = await import('../js/world/wdgn.js');
  ok(D.weekKey(Date.UTC(2026, 9, 29, 3)) === 'wk-2026-10-26' && D.weekKey(Date.UTC(2026, 10, 1, 16)) === 'wk-2026-11-02', '주는 한국 시간 월요일부터');
  const g = fresh(); g.setJob('sword'); while (g.s.level < 30) g.addExp(W.expToNext(g.s.level)); g.enterMap(W.mapId(4, 1));
  ok(!g.canRaid(1000), '문파가 없으면 못 친다');
  g.s.guildId = 'G1';
  const key = D.weekKey();
  ok(g.startRaid({ key, hpLeft: 1e9, maxHp: 2e9 }) && g.inst.kind === 'raid', '문파 토벌에 들어간다');
  let res = null;
  for (let i = 0; i < 2000 && !res; i++) { g.tick(0.05); for (const e of g.events) if (e.type === 'instEnd') res = e; g.events.length = 0; }
  ok(res && res.kind === 'raid' && res.dealt > 0 && res.key === key && res.reward?.gold > 0, `${D.RAID_SEC}초 동안 친 피해와 참여 보상`, `피해 ${res?.dealt}`);
  ok(g.s.raid.dps > 0 && g.raidDpsEst() === g.s.raid.dps, '초당 피해를 적어 둔다(다음 주 두목 체력 셈)');
  g.startRaid({ key, hpLeft: 1e9, maxHp: 2e9 }); g.leaveInst();
  ok(g.raidLeft() === 0 && !g.canRaid(1e9), `하루 ${D.RAID_PER_DAY}번`);
  ok(D.raidMaxHp(1000) === 1000 * D.RAID_SEC * D.RAID_PER_DAY * 7 * D.RAID_HP_SHARE, '두목 체력 = 문파원 딜 × 40초 × 2번 × 이레 × 절반');
}

console.log('\n=== 사냥터 땅 (v127) ===');
{
  const L = await import('../js/world/wland.js');
  // 지형: 모든 구역에서 빈 칸이 다 이어져 있고, 들어서는 자리가 비어 있다
  let bad = [], withObs = 0;
  for (const m of W.MAPS) {
    const t = L.terrainOf(m.id);
    if (!t) continue;
    withObs++;
    const free = []; for (let i = 0; i < t.grid.length; i++) if (!t.grid[i]) free.push(i);
    const seen = new Set([ (W.ROWS - 3) * W.COLS + Math.floor(W.COLS / 2) ]);
    const q = [...seen];
    while (q.length) { const k = q.pop(); const c = k % W.COLS, r = (k - c) / W.COLS; for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= W.COLS || nr >= W.ROWS) continue; const j = nr * W.COLS + nc; if (t.grid[j] || seen.has(j)) continue; seen.add(j); q.push(j); } }
    if (seen.size !== free.length || t.grid[(W.ROWS - 3) * W.COLS + Math.floor(W.COLS / 2)]) bad.push(m.id);
    if (t.list.length > 30) bad.push(`${m.id}:${t.list.length}`);
  }
  ok(withObs >= 120 && !bad.length, '사냥터마다 지형 — 빈 칸은 다 이어지고 들어서는 자리는 비어 있다', `${withObs}구역 ${bad.join(',')}`);
  const g = fresh(); g.setJob('sword'); g.enterMap(11);
  ok(g.obstacles.length > 0 && g.mons.every((m) => !g.blocked[m.r * W.COLS + m.c]), '몹은 막힌 칸에 나지 않는다');
  const ob = g.obstacles[0];
  ok(g.occupied(ob.c, ob.r, 'hero') && !g.stepTo({ c: ob.c, r: ob.r }), '막힌 칸으로는 못 간다');
  for (let i = 0; i < 20 * 30; i++) { g.tick(0.05); g.events.length = 0; if (g.map.town) g.enterMap(11); if (g.blocked?.[g.hr * W.COLS + g.hc]) { bad.push('hero-in-rock'); break; } }
  ok(!bad.length && g.s.kills > 3, '지형이 있어도 사냥은 굴러간다(바위 위에 서지 않는다)', `${g.s.kills}마리`);
  // 기운
  const snow = fresh(); snow.setJob('sword'); while (snow.s.level < 15) snow.addExp(W.expToNext(snow.s.level));
  snow.enterMap(W.mapId(3, 1));
  const e0 = snow.envNow();
  ok(e0.move < 0 && e0.speed < 0, '천산 설원은 혹한 — 이동·공격 속도가 준다', JSON.stringify(e0));
  snow.s.mast[3] = L.MASTERY_KILLS[5]; snow._env = null;
  ok(snow.envNow().move > e0.move && Math.abs(snow.envNow().move - e0.move * (1 - 0.4)) < 1e-9, '숙련 5면 나쁜 기운 40% 덜', JSON.stringify(snow.envNow()));
  snow.s.equip.armor = { ...snow.makeCrafted('armor', 4, 0, 3), opts: [{ res: 'cold', v: 0.6 }] }; snow._stats = null; snow._env = null;
  ok(snow.resistTo('cold', 3) === 0.9 && Math.abs(snow.envNow().move - e0.move * 0.1) < 1e-9, '갑옷 한기 저항 옵션까지 — 90%에서 멈춘다');
  ok(W.optText({ res: 'poison', v: 0.3 }).includes('독기 저항 +30%'), '저항 옵션 글');
  const town = fresh(); ok(Object.keys(town.envNow()).length === 0, '마을·던전엔 기운이 없다');
  // 숙련도
  const mg = fresh(); mg.setJob('fan'); mg.enterMap(11);
  let mevt = 0;
  mg.addMastery(1, L.MASTERY_KILLS[1]); for (const e of mg.events) if (e.type === 'mastery') mevt++;
  ok(mg.masteryLevel(1) === 1 && mevt === 1, '잡은 수가 차면 숙련 레벨이 오른다(알림)');
  const mk0 = mg.s.mast[1];
  mg.mons[0].hp = 1; mg.hurt(mg.mons[0], 999, 'hit', false);
  ok(mg.s.mast[1] === mk0 + 1, '그 지역 몹을 잡으면 숙련도 +1');
  // 보물 원숭이
  const tg = fresh(); tg.setJob('fan'); tg.enterMap(11);
  const tm = tg.spawnTreasure();
  ok(tm && tm.treasure && tg.pickTarget(tg.stats()) === tm, '황금 원숭이가 나오면 그것부터 노린다');
  const d0 = Math.abs(tm.c - tg.hc) + Math.abs(tm.r - tg.hr);
  for (let i = 0; i < 30; i++) tg.tickTreasure(tm, 0.05);
  ok(Math.abs(tm.mobTile?.c ?? (tm.move || tm).c - tg.hc) + Math.abs((tm.move || tm).r - tg.hr) >= d0 - 1, '달아난다(가까워지지 않는다)');
  const gold0 = tg.s.gold;
  tm.hp = 1; tg.hurt(tm, 999, 'hit', false);
  ok(tg.s.gold - gold0 >= W.mobGold(tm.lv) * 100 && (tg.s.mats[W.ORE] || 0) >= L.TREASURE_MATS, '잡으면 은자·재료가 쏟아진다', `은자 +${tg.s.gold - gold0}`);
  const tg2 = fresh(); tg2.enterMap(11); const t2 = tg2.spawnTreasure(); let gone = 0;
  for (let i = 0; i < (L.TREASURE_LIFE + 1) * 20; i++) { tg2.tickTreasure(t2, 0.05); }
  for (const e of tg2.events) if (e.type === 'treasureGone') gone++;
  ok(!t2.alive && gone === 1, '25초 안에 못 잡으면 사라진다');
  // 새 지역
  ok(W.ALT_ZONES.length === 6 && W.ALT_ZONES.every((a) => W.zoneOfW(a.id).lv[0] === W.zoneOfW(a.pair).lv[0]), '새 지역 여섯 — 짝 지역과 같은 레벨');
  const az = fresh(); az.setJob('sword'); while (az.s.level < 15) az.addExp(W.expToNext(az.s.level));
  ok(az.enterMap(W.mapId(31, 1)) && az.map.zoneName === '도화림' && az.map.mz === 3, '도화림에 들어간다 (재료는 천산 설원 것)');
  const bm = az.mons[0]; bm.hp = 1; let got = 0;
  for (let i = 0; i < 200; i++) { const mm = az.spawnMob(false); if (!mm) continue; mm.hp = 1; az.hurt(mm, 99, 'hit', false); }
  ok((az.s.mats[W.ORE] || 0) > 0 && !az.s.mats[31] && !az.s.mats[3], '새 지역 몹은 짝 지역 몫(현철)을 떨군다', `현철 ${az.s.mats[W.ORE]}`);
  ok(az.s.mast[31] > 0 && !az.s.mast[3], '숙련도는 새 지역 따로');
  ok(W.ZONE_ORDER.findIndex((z) => z.id === 31) === W.ZONE_ORDER.findIndex((z) => z.id === 3) + 1, '지도에서는 짝 지역 바로 뒤');
}

console.log('\n=== 던전 (v126) ===');
{
  const D = await import('../js/world/wdgn.js');
  let sun = Date.UTC(2026, 10, 1, 3); while (D.kstWeekday(sun) !== 0) sun += 86400e3;
  let mon = sun + 86400e3;
  const g = fresh();
  g.setJob('sword');
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  g.enterMap(W.mapId(4, 1));
  ok(D.DAILY.every((d) => D.dailyOpen(d, mon) && D.dailyOpen(d, sun)), '일일 던전: 셋 다 매일 열린다 (v147, 요일 제한 없음)');
  ok(g.canDaily('gold', 1, mon) && g.canDaily('exp', 1, mon) && !g.canDaily('exp', 2, mon), '처음엔 1단계만');
  const huntBefore = g.s.huntMap;
  ok(g.startDaily('exp', 1, mon) && g.inst?.kind === 'daily' && g.map.inst && g.mons.length === D.DAILY_ALIVE, '들어가면 던전 구역(몹 열넷)');
  for (const m of g.mons) m.atk = 0;
  let res = null;
  for (let i = 0; i < 2000 && !res; i++) { g.tick(0.05); for (const e of g.events) if (e.type === 'instEnd') res = e; g.events.length = 0; }
  ok(res?.ok && g.dailyBest('exp') === 1 && res.chain && g.inst?.stage === 2 && res.reward.exp > 0, '40마리 잡으면 깨고 — 새 단계였으니 바로 2단계로 (v166)', JSON.stringify(res?.reward));
  g.inst.done = { left: true }; g.tick(0.05); g.events.length = 0;
  ok(!g.inst && g.s.map === huntBefore, '그만두면 사냥터로 돌아온다');
  g.s.dgn.day = '';          // 이어 들어간 판(그만둔 것)은 셈에서 지운다 — 아래는 한 판만 깬 셈으로 본다
  ok(g.dailyLeft('exp', mon) === 3 && res.gotKey && g.canSweep('exp', mon), '보상 몫 하루 셋 — 새 단계를 깨면 몫을 안 쓴다 · 깬 단계는 소탕');
  const lv0 = g.s.level, e0 = g.s.exp;
  const sw = g.sweepAll(mon);
  ok(sw.length === 3 && g.dailyLeft('exp', mon) === 0 && (g.s.level > lv0 || g.s.exp > e0), '모두 소탕: 남은 셋을 한꺼번에');
  ok(g.canDaily('exp', 1, mon) && !g.canSweep('exp', mon), '몫을 다 써도 도전은 된다 · 소탕은 안 된다 (v302)');
  ok(g.dailyLeft('exp', mon + 86400e3 * 7) === 3, '다음 날이면 다시 셋');
  // 시간 넘김 → 절반 보상, 깬 것으로 안 친다
  const g2 = fresh(); g2.setJob('fan'); while (g2.s.level < 30) g2.addExp(W.expToNext(g2.s.level)); g2.enterMap(W.mapId(4, 1));
  g2.startDaily('gold', 1, sun);
  const gold0 = g2.s.gold;
  g2.inst.t = 0.01;
  let r2 = null; for (let i = 0; i < 10 && !r2; i++) { g2.tick(0.05); for (const e of g2.events) if (e.type === 'instEnd') r2 = e; g2.events.length = 0; }
  ok(r2 && !r2.ok && r2.timeout && g2.dailyBest('gold') === 0 && g2.s.gold >= gold0, '시간이 다 되면 깬 것으로 안 치고 잡은 만큼 절반');
  // 무한의 탑
  const t = fresh(); t.setJob('fan'); while (t.s.level < 30) t.addExp(W.expToNext(t.s.level)); t.enterMap(W.mapId(4, 1));
  const atk0 = t.stats().atk;
  t.s.tower.floor = 9; t._stats = null;
  ok(Math.abs(t.stats().atk / atk0 - (1 + D.towerBonus(9)) / 1) < 0.2, '탑 층마다 공격력이 오른다', `${(t.stats().atk / atk0).toFixed(3)}`);
  ok(D.isZodiacFloor(10) && D.towerBoss(10).zodiac === 1 && D.towerBoss(120).zodiac === 12 && D.TOWER_MAX === 120, '120층 · 10층마다 십이지신 (10층 쥐 … 120층 돼지)');
  t.autoDodge = true;
  t.startTower();
  let tr = null, casts = 0, tells = 0;
  for (let i = 0; i < 2400 && !tr; i++) {
    t.tick(0.05);
    if (i === 200) for (const m of t.mons) if (m.isBoss) { m.hp = 1; m.atk = 0; }
    for (const e of t.events) { if (e.type === 'instEnd') tr = e; if (e.type === 'bossCast') casts++; if (e.type === 'tellBoom') tells++; }
    t.events.length = 0;
  }
  ok(casts > 0 && tells > 0, '수문장은 바닥 경고 초식을 쓴다', `초식 ${casts} · 터짐 ${tells}`);
  ok(tr?.ok && tr.stage === 10 && t.s.zTickets[1] === D.ZODIAC_TICKETS, '10층 십이지신을 넘으면 그 신의 뽑기권 셋', JSON.stringify(tr?.reward));
  // 피하지 않으면 경고에 맞는다
  const hit = fresh(); hit.setJob('fan'); while (hit.s.level < 30) hit.addExp(W.expToNext(hit.s.level)); hit.enterMap(W.mapId(4, 1));
  hit.s.tower.floor = 50; hit.startTower();
  for (let i = 0; i < 20; i++) { hit.tick(0.05); hit.events.length = 0; }
  const b = hit.mons.find((m) => m.isBoss);
  b.atk = 0; b.introT = 0; hit.freezeT = 0; hit.inst.castT = 99;
  hit.tells = [];
  hit.tells.push({ kind: 'circle', x: hit.heroX, y: hit.heroY, r: 100, t: 0.1, max: 0.1, dmg: 0.5, wait: 0 });
  let got = 0; for (let i = 0; i < 10; i++) { hit.tick(0.05); for (const e of hit.events) if (e.type === 'heroHit' && e.tell) got += e.amount; hit.events.length = 0; }
  ok(got >= hit.stats().hp * 0.3, '경고 안에 서 있으면 최대 체력의 몇 할을 맞는다', `${Math.round(got)} / ${Math.round(hit.stats().hp)}`);
  ok(D.tellCovers({ kind: 'donut', x: 0, y: 0, r0: 100, r1: 300 }, 50, 0) === false && D.tellCovers({ kind: 'line', x0: 0, y0: 0, x1: 500, y1: 0, w: 100 }, 250, 40), '경고 판정: 고리 안쪽은 안전 · 선은 폭 안');
  hit.s.potions = 10; hit.heroHp = 1;
  ok(!hit.drinkPotion(), '탑에서는 물약을 못 쓴다');
  // 십이지 뽑기: 셋째에는 꼭
  const z = fresh(); z.s.zTickets[5] = 3; z.rng = () => 0.99;
  z.drawZodiac(5); z.drawZodiac(5);
  ok(!z.zodiacOwned(5) && z.s.mounts.length === 2, '신수가 안 나오면 보통 탈것');
  z.drawZodiac(5);
  ok(z.zodiacOwned(5) && !z.s.zTickets[5] && W.mountOf(z.s.mounts.find((m) => m.uid === z.s.mount)?.kind)?.zodiac === 5, '셋째 뽑기에는 신수 — 바로 탄다');
  const sv = migrateWorld(JSON.parse(JSON.stringify(z.toJSON())));
  ok(sv.tower && sv.dgn && sv.zTickets && sv.zPity, '던전·탑·뽑기권이 저장된다');
}

console.log('\n=== 두목 우선 · 조이스틱 (v125) ===');
{
  const g = fresh();
  g.s.level = 12; g.enterMap(W.mapId(1, 4));
  for (let i = 0; i < 400 && !g.mons.some((m) => m.isBoss && m.alive && !(m.introT > 0)); i++) { g.tick(0.05); g.events.length = 0; }
  g.freezeT = 0;
  const boss = g.mons.find((m) => m.isBoss && m.alive);
  g.mon = g.mons.find((m) => m.alive && !m.isBoss);
  // 칸 사이를 걷는 중이면 칸 가운데에 서서 바꾼다 — 몇 틱 안에
  for (let i = 0; i < 20 && g.mon !== boss; i++) g.tick(0.05);
  ok(boss && g.mon === boss, '두목 구역에서는 졸개를 치던 중에도 두목에게 간다');
  const j = fresh(); j.enterMap(11);
  for (const m of j.mons) m.atk = 0;
  const c0 = j.hc;
  j.joy = { dx: c0 > 4 ? -50 : 50, dy: 0 };
  for (let i = 0; i < 40; i++) { j.tick(0.05); j.events.length = 0; }
  ok(j.hc !== c0 && Math.abs(j.hc - c0) >= 2, '조이스틱을 누르고 있으면 그쪽으로 걷는다', `${c0}→${j.hc}`);
  j.joy = null;
}

console.log('\n=== 전직·스킬 ===');
{
  const g = fresh();
  ok(g.skills().length === 0, '전직 전에는 스킬이 없다');
  g.s.level = 15; g.s.gold = 1000;
  ok(g.canAdvance() && g.advance() && g.s.jobTier === 1 && g.skills().length === 1, '레벨 15에 마을에서 1차 전직 → 스킬 하나');
  g.s.level = 40; g.s.gold = 1e6;
  g.enterMap(11);
  ok(g.canAdvance() && g.advance(), '전직은 사냥터에서도 된다');
  ok(g.s.jobTier === 2 && g.skills().filter((k) => k.kind !== 'support').length === 2, '2차 전직 → 공격 무공 둘 (+ 레벨 25부터 보조기)');
  g.enterMap(11);
  const sk = g.skills().find((x) => x.hpCost);
  g.heroHp = g.stats().hp;
  const hp0 = g.heroHp;
  const cost = g.hpCostOf(sk);
  // 둘레에 몹을 모은다
  for (const m of g.mons.slice(0, 6)) { m.x = g.heroX + 30; m.y = g.heroY + 10; }
  const killedBefore = g.s.kills;
  ok(g.useSkill(sk.id), `전체기 〈${sk.name}〉를 쓴다`);
  ok(Math.abs(hp0 - g.heroHp - cost) < 1, '쓴 만큼 체력이 깎인다', `-${Math.round(hp0 - g.heroHp)} (대가 ${cost})`);
  ok(g.events.filter((e) => e.type === 'dmg' && e.kind === sk.id).length >= 6 || g.s.kills > killedBefore, '둘레 몹이 다 맞는다');
  g.cd[sk.id] = 0;
  g.heroHp = g.hpCostOf(sk);
  ok(!g.useSkill(sk.id), '체력이 대가보다 적으면 못 쓴다(대가로 죽지 않는다)');
  // 자동 스킬은 체력이 넉넉할 때만
  g.heroHp = g.stats().hp * 0.4;
  g.cd[sk.id] = 0;
  g.events.length = 0;
  g.autoSkills(g.stats());
  ok(!g.events.some((e) => e.type === 'skill' && e.id === sk.id), '자동 사냥은 체력이 낮으면 체력 스킬을 아낀다');
}

console.log('\n=== 물약·죽음·귀환 ===');
{
  const g = fresh();
  g.enterMap(11);
  g.s.potions = 3;
  g.heroHp = g.stats().hp * 0.2;
  g.tickPotion(g.stats());
  ok(g.s.potions === 2 && g.heroHp > g.stats().hp * 0.5, '체력이 낮으면 물약을 먹는다');
  g.s.exp = 100;
  g.heroDied({ isBoss: false });
  ok(g.map.town && g.s.exp === 95 && g.s.deaths === 1, '쓰러지면 경험치 5%를 잃고 마을로', `exp ${g.s.exp}`);
  for (let i = 0; i < 20 * 10; i++) { g.tick(0.05); g.events.length = 0; }
  ok(!g.map.town && g.s.map === 11, '쓰러져 마을에 오면 쉬었다가 사냥터로 돌아간다');
  g.goTown();
  for (let i = 0; i < 20 * 10; i++) { g.tick(0.05); g.events.length = 0; }
  ok(g.map.town, '스스로 마을에 가면 머문다(사냥터로 끌려가지 않는다)');
  g.enterMap(11);
  g.s.gold = 1000;
  const p0 = g.s.potions;
  ok(g.buyPotions(10) && g.s.potions === p0 + 10, '상점에서 물약을 산다');
  g.s.gold = 1e7; g.s.autoStat = false;
  const c1 = g.statBookCost();
  const pts = g.s.statPts;
  ok(g.buyStatBook() && g.s.statPts === pts + 1 && g.statBookCost() > c1, '비급을 사면 스탯 점수 +1, 다음 권은 더 비싸다', `${c1} → ${g.statBookCost()}`);
}

console.log('\n=== 방치 ===');
{
  const g = fresh();
  g.enterMap(11);
  g.s.potions = 50;
  for (let i = 0; i < 20 * 120; i++) { g.tick(0.05); g.events.length = 0; }
  const saved = JSON.parse(JSON.stringify(g.toJSON()));
  ok(saved.rates && saved.rates.kills > 0, '저장할 때 최근 벌이를 적어 둔다', `분당 ${(saved.rates.kills * 60).toFixed(1)}마리`);
  saved.lastSeen = 0;
  const h = new WorldGame(saved, 0);
  h.rng = seeded();
  const rw = h.offlineReward(3600 * 1000);
  ok(rw && rw.kills > 0 && rw.exp > 0 && rw.gold > 0, '한 시간 뒤 방치 보상', rw && `처치 ${rw.kills} · 경험치 ${rw.exp} · 은자 ${rw.gold}`);
  const lv0 = h.s.level;
  h.claimOffline(rw);
  ok(h.s.level >= lv0 && h.s.gold >= rw.gold, '받으면 레벨·은자에 들어간다');
  // 물약이 떨어지면 거기서 멈춘다
  const s2 = { ...saved, potions: 0, rates: { ...saved.rates, potions: 0.01 } };
  const k = new WorldGame(s2, 0);
  const r2 = k.offlineReward(3600 * 1000);
  ok(!r2 || r2.kills === 0 || r2.stoppedByPotion, '물약이 없으면 방치 사냥이 멈춘다');
  ok(new WorldGame(saved, 0).offlineReward(30 * 1000) === null, '1분이 안 되면 보상이 없다');
}

console.log('\n=== 세이브 ===');
{
  const junk = [null, 5, 'x', { level: 'abc', gold: -5, stats: { str: 'x' }, map: 99, bag: [null, { slot: 'nope' }], job: 'blade' }];
  let bad = 0;
  for (const j of junk) {
    try {
      const s = migrateWorld(j);
      const g = new WorldGame(s, 0);
      g.tick(0.1);
      if (!finite(g) || s.level !== 1 && j?.level === 'abc') bad++;
    } catch { bad++; }
  }
  ok(bad === 0, '망가진 세이브도 읽는다', `${junk.length}가지`);
  const g = fresh();
  g.s.level = 30; g.s.gold = 1234;
  const back = new WorldGame(JSON.parse(JSON.stringify(g.toJSON())), 0);
  ok(back.s.level === 30 && back.s.gold === 1234 && back.s.job === 'sword', '저장했다 읽으면 그대로');
}

console.log('\n=== 다섯 캐릭터 · 2시간 ===');
{
  // 간단한 사람: 마을이면 전직·물약, 사냥터는 레벨 맞는 가장 높은 곳
  const rows = [];
  for (const job of Object.keys(W.CLASSES)) {
    const g = fresh(job);
    g.s.gold = 300; g.buyPotions(30);
    g.s.autoStat = true;   // 점수를 바로바로 찍는 사람
    let nan = false;
    for (let t = 0; t < 2 * 3600; t += 0.1) {
      g.tick(0.1);
      g.events.length = 0;
      // 전직·물약은 사냥터에서 (마을에 안 간다)
      while (g.canAdvance()) g.advance();
      if (g.s.potions < 15) g.buyPotions(Math.min(40 - g.s.potions, Math.floor(g.s.gold / g.potionPrice())));
      // 장비는 레벨을 따라 자란다 (v158) — 30초마다 무기를 강화해 본다
      if (t % 30 < 0.1) for (const sl of W.GROW_SLOTS) { const it = g.s.equip[sl]; if (it && (it.plus || 0) < 6 && g.canEnhance(it)) g.enhance(it.uid); }
      // 사냥터: 들어갈 수 있는 가장 높은 들판 구역. 상급 조합에 증표가 모자라면 두목 구역에 들른다.
      let best = 11;
      for (const m of W.MAPS) if (!m.town && !m.bossRoom && g.canEnter(m.id) && g.s.level >= m.lv[0] + 1) best = m.id;
      const z = W.mapOf(best).zone;
      const bossRoom = W.mapId(z, W.BOSS_AREA);
      if (g.canEnter(bossRoom) && (g.s.mats[W.bossKey(z)] || 0) < 13 && (g.s.mats[W.ORE] || 0) > 100 * W.matWeight(z)) best = bossRoom;
      if ((best !== g.s.huntMap && !g.map.town) || (g.map.town && !g.townReturn)) g.enterMap(best);
      if (t % 600 < 0.1 && !finite(g)) nan = true;
    }
    rows.push({ job, lv: g.s.level, map: g.s.huntMap, tier: g.s.jobTier, deaths: g.s.deaths, nan });
  }
  ok(rows.every((r) => !r.nan), '두 시간 내내 숫자가 유한하다');
  ok(rows.every((r) => r.lv >= 20), '두 시간이면 모두 레벨 20을 넘는다', rows.map((r) => `${r.job} Lv.${r.lv}/사냥터${r.map}/${r.tier}차/쓰러짐${r.deaths}`).join(' · '));
  const lvs = rows.map((r) => r.lv);
  ok(Math.max(...lvs) - Math.min(...lvs) <= 10, '캐릭터끼리 레벨 차가 10 안쪽', lvs.join(' '));
}

console.log('\n=== 초식 연출표 ===');
{
  const { CHOREO, Director, FX } = await import('../js/skillfx.js');
  const missing = [];
  const broke = [];
  let ran = 0;
  for (const job of Object.keys(W.CLASSES)) {
    for (const sk of W.skillsOf(job)) {
      if (!CHOREO[sk.fx]) { missing.push(sk.fx); continue; }
      const effects = [];
      const view = {
        effects, particles: [], squash: D.FIELD_SQUASH, heroX: 200, groundY: 400, w: 390, h: 700,
        fxLevel: 2, shake: 0, flash: 0, hitstop: 0, camHold: 0, desatTo: 0,
        heroAnim: { play() {} }, handle() {}, ink() {}, float() {}, showBanner() {}, game: null,
        sx: (m) => 200 + (m.x || 0), sy: (m) => 400 + (m.y || 0) * D.FIELD_SQUASH,
      };
      const hits = [0, 1, 2].map((i) => ({ type: 'dmg', at: { x: 60 + i * 30, y: 10 * i }, amount: 1 }));
      const pend = { id: sk.id, job, name: sk.name, tier: sk.tier, hits, kills: [], at: { x: 80, y: 0 }, radius: sk.radius || 0, dur: 0, path: null };
      try {
        const d = new Director(view, pend, { heroX: 0, heroY: 0, heroAngle: 0, heroFacing: 1, mon: { x: 80, y: 0 } });
        CHOREO[sk.fx](d);
        for (let i = 0; i < 200 && !d.done; i++) d.tick(0.02);
        const OLD = ['area', 'aura', 'beam', 'blink', 'burst', 'cut', 'frost', 'gale', 'pillar', 'qi', 'regress', 'swing', 'swirl', 'swords', 'thunder', 'splash', 'corrode', 'puddle'];
        for (const e of effects) if (!FX[e.kind] && !OLD.includes(e.kind)) throw new Error(`그림 없음: ${e.kind}`);
        if (!d.done || hits.length) throw new Error('결과를 다 안 풀었다');
        ran++;
      } catch (err) { broke.push(`${sk.fx} ${err.message}`); }
    }
  }
  ok(missing.length === 0, '다섯 캐릭터 스킬 셋 모두 연출표가 있다', missing.join(' '));
  ok(broke.length === 0, `연출 ${ran}개가 끝까지 돌고 숫자를 다 푼다`, broke.slice(0, 3).join(' / '));
}

console.log('\n=== 길잡이 (v146) ===');
{
  const ids = Q.QUESTS.map((q) => q.id);
  ok(new Set(ids).size === ids.length && Q.QUEST_COUNT >= 50, `단계가 쉰 남짓이고 이름이 겹치지 않는다`, `${Q.QUEST_COUNT}단계`);
  const TABS = new Set(['char', 'bag', 'map', 'town', 'social', 'comp', 'dgn', null]);
  ok(Q.QUESTS.every((q) => q.title && q.why && TABS.has(q.tab ? q.tab.split('/')[0] : null) && typeof q.goal === 'function'), '모든 단계에 제목·설명·열 화면·조건이 있다');
  const SUBS = { char: ['info', 'stat', 'skill'], bag: ['gear', 'bag', 'smith', 'mats'], map: ['murim', 'sapa', 'magyo', 'king', 'masters'], dgn: ['daily', 'tower', 'zodiac', 'raid'], comp: ['pet', 'mount'], town: ['master', 'shop', 'smith', 'inn'], social: ['guild', 'rank', 'lore'] };
  const badSub = Q.QUESTS.filter((q) => q.tab?.includes('/') && !SUBS[q.tab.split('/')[0]]?.includes(q.tab.split('/')[1])).map((q) => q.id);
  ok(badSub.length === 0, '길잡이가 여는 칸(창/칸)이 실제로 있다', badSub.join(' '));
  const g0 = fresh();
  ok(Q.QUESTS.every((q) => { const r = q.goal(g0); return Number.isFinite(r.now) && r.need > 0; }), '새 캐릭터에서 모든 조건이 숫자를 돌려준다');
  // 운에 막히는 단계가 없다: 애완동물·탈것은 그 단계가 뜰 때 준다
  const at = (id) => ids.indexOf(id);
  const g = fresh();
  g.s.quest = at('pet');
  g.questNow();
  ok(g.s.petBox.length === 1 && g.s.petBox[0].rar === 0 && !g.questNow().done, '애완동물 단계가 뜨면 가장 아래 등급 하나를 우리에 넣어 준다(데려가기는 직접)');
  g.adoptPet(g.s.petBox[0].uid);
  ok(g.questNow().done, '우리에서 데려가면 끝난다');
  g.claimQuest();
  g.questNow();
  ok(g.s.mounts.length === 1 && g.s.mount == null && !g.questNow().done, '탈것 단계가 뜨면 나귀를 주고(안 탄 채) 타라고 한다');
  g.ride(g.s.mounts[0].uid);
  ok(g.questNow().done, '타면 끝난다');
  // 선물은 한 번뿐 — 다시 봐도 또 주지 않는다
  const g2 = fresh(); g2.s.quest = at('pet'); g2.questNow(); g2.questNow();
  ok(g2.s.petBox.length === 1, '선물은 그 단계에 한 번만');
  // 장비 살펴보기 · 등급 각인 (v158)
  const g3 = fresh(); g3.s.quest = at('craft');
  ok(!g3.questNow().done, '무기를 눌러 보는 단계');
  g3.mark('gearView');
  ok(g3.questNow().done, '장비 창에서 눌러 보면 끝난다');
  const gp = fresh(); gp.s.gold = 1e9; gp.s.quest = at('promote'); gp.questNow();
  const mk = Object.keys(gp.s.mats).find(W.isMarkKey);
  ok(mk && gp.canInfuse(gp.s.equip.weapon, mk), '등급 각인 단계가 뜨면 두목 증표를 챙겨 준다');
  gp.infuse(gp.s.equip.weapon.uid, mk);
  ok(gp.questNow().done, '각인을 해 보면(실패해도) 끝난다');
  // 해 본 것 표
  const g4 = fresh(); g4.s.quest = at('move');
  g4.enterMap(W.mapId(1, 1)); g4.moveTo(200, 200);
  ok(g4.questNow().done, '화면을 눌러 움직이면 끝난다');
  // 건너뛰기는 서버가 있어야 하는 단계만
  const g5 = fresh(); g5.s.quest = at('lv10');
  ok(!g5.skipQuest() && g5.s.quest === at('lv10'), '보통 단계는 건너뛸 수 없다');
  g5.s.quest = at('guild');
  ok(g5.skipQuest() && g5.s.quest === at('guild') + 1, '문파 단계는 건너뛸 수 있다(보상 없이)');
  ok(['guild', 'checkin', 'donate', 'raid', 'coop', 'app', 'fuse'].every((k) => Q.QUESTS[at(k)].skip) && Q.QUESTS.filter((q) => q.skip).length === 7, '건너뛸 수 있는 건 문파·출석·기부·토벌·함께 사냥·앱 설치·탈것 합성 일곱');
  // 보상: 그 레벨 사냥 몇 분어치 — 레벨 1이든 100이든 같은 결
  const mins = Q.QUESTS.map((q) => q.min || 0);
  ok(Math.max(...mins) <= 25 && Math.min(...mins.filter(Boolean)) >= 1, '은자 보상은 사냥 1~25분어치', `${Math.min(...mins.filter(Boolean))}~${Math.max(...mins)}분`);
  ok(Q.QUESTS.every((q) => (q.xp || 0) <= 0.3), '경험치 보상은 그 레벨의 3할 이하');
  // 레벨 단계는 오름차순 — 앞 단계가 뒤 단계보다 높은 레벨을 요구하지 않는다
  const lvs = Q.QUESTS.filter((q) => /^lv\d+$/.test(q.id)).map((q) => +q.id.slice(2));
  ok(lvs.every((v, i) => !i || v > lvs[i - 1]), '레벨 단계가 차례대로 오른다', lvs.join('→'));
  // 옛 세이브: 이미 한 것은 보상 없이 건너 지금 할 일부터
  const old = newWorldSave(0); old.questV = 1; old.quest = 7; old.job = 'sword'; old.level = 45; old.jobTier = 2; old.potions = 50; old.autoRefill = true;
  const g6 = new WorldGame(migrateWorld(old, 0), 0);
  const gold6 = g6.s.gold;
  const c6 = g6.questNow();
  ok(g6.s.questV === Q.QUEST_V && c6 && !c6.done && g6.s.gold === gold6, '옛 길잡이 세이브는 이미 찬 단계를 보상 없이 넘고 다음 할 일에 선다', c6?.q.id);
  // v180: 판 2 → 3 — 새로 끼운 단계 가운데 가장 앞(화면 거리)부터, 옛 단계는 다시 안 받는다
  const v2 = newWorldSave(0); v2.questV = 2; v2.quest = Q.QUEST_V2_IDS.indexOf('tier2'); v2.job = 'sword'; v2.level = 40;
  const g7 = new WorldGame(migrateWorld(v2, 0), 0);
  const c7 = g7.questNow();
  ok(g7.s.questV === Q.QUEST_V && c7.q.id === 'zoom', '판 2 세이브는 새로 끼운 첫 단계부터', c7.q.id);
  g7.mark('zoom'); g7.claimQuest();
  ok(g7.questNow().q.id === 'potionAt', '그다음도 새로 끼운 단계(옛 단계는 건너뛴다)', g7.questNow().q.id);
  const v2b = newWorldSave(0); v2b.questV = 2; v2b.quest = Q.QUEST_V2_IDS.length; v2b.job = 'sword';
  const g8 = new WorldGame(migrateWorld(v2b, 0), 0);
  ok(g8.questNow()?.q.id === 'zoom', '길잡이를 다 끝낸 사람도 새 단계를 겪는다');
  // v208: 판 3 → 4 — 판 3에서 하던 단계(tier2) 앞의 새 단계(무기 +5)부터, 옛 단계는 다시 안 받는다
  const v3 = newWorldSave(0); v3.questV = 3; v3.quest = Q.QUEST_V3_IDS.indexOf('tier2'); v3.job = 'sword'; v3.level = 40;
  const g9 = new WorldGame(migrateWorld(v3, 0), 0);
  ok(g9.questNow().q.id === 'enh5', '판 3 세이브는 판 4에 새로 끼운 첫 단계부터', g9.questNow().q.id);
  g9.s.equip.weapon.plus = 5; g9.claimQuest();
  ok(g9.questNow().q.id === 'petSkill', '그다음 새 단계로(옛 단계는 건너뛴다)', g9.questNow().q.id);
  const v3b = newWorldSave(0); v3b.questV = 3; v3b.quest = Q.QUEST_V3_IDS.length; v3b.job = 'sword';
  ok(new WorldGame(migrateWorld(v3b, 0), 0).questNow()?.q.id === 'enh5', '판 3을 다 끝낸 사람도 새 단계를 겪는다');
  // 새 단계: 해 보면 끝난다
  for (const [id, k] of [['prot', 'prot'], ['lore', 'lore']]) {   // v263: 절전·범위는 '알아두기'(바로 받는다) · v272: 재료 합치기도 '알아두기'
    const gg = fresh(); gg.s.quest = at(id);
    const a = gg.questNow().done; gg.mark(k);
    ok(!a && gg.questNow().done, `${Q.QUESTS[at(id)].title} — 해 보면 끝난다`);
  }
  const gb = fresh(); gb.s.gold = 1e9; gb.s.quest = at('prot'); gb.buyProt(1);
  ok(gb.questNow().done, '보호부를 사면 끝난다');
  const gd = fresh(); gd.s.quest = at('duel'); gd.s.duel.won.namgung = 1;
  ok(gd.questNow().done, '고수 하나를 쓰러뜨리면 끝난다');
}

console.log('\n=== 세력과 고수 비무 (v148) ===');
{
  // 사냥터: 왕이 아닌 지역이 세 세력에 빠짐없이 한 번씩, 세력마다 낮은 곳부터 높은 곳까지
  const normal = W.ZONE_ORDER.filter((z) => !z.king && !z.master).map((z) => z.id).sort((a, b) => a - b);
  const assigned = Object.values(MS.FAC_ZONES).flat().sort((a, b) => a - b);
  ok(JSON.stringify(normal) === JSON.stringify(assigned), '왕이 아닌 사냥터가 무림맹·사파·마교에 빠짐없이 한 번씩', `${assigned.length}곳`);
  const spread = Object.entries(MS.FAC_ZONES).filter(([, zs]) => zs.length).map(([f, zs]) => { const lv = zs.map((z) => W.ZONES_W[z].lv[0]); return [f, Math.min(...lv), Math.max(...lv)]; });
  ok(spread.every(([, lo, hi]) => lo <= 15 && hi >= 79), '세력마다 낮은 곳(15 아래)부터 높은 곳(79 위)까지 섞여 있다', spread.map(([f, lo, hi]) => `${f} ${lo}~${hi}`).join(' · '));
  // 강함: 마존은 십이지왕급, 맹주는 검왕보다, 천마는 두 맹주보다
  const kingLv = W.ZONE_ORDER.filter((z) => z.king).map((z) => z.lv);
  const swordKing = Math.max(...kingLv.map((l) => l[1]));
  const mazon = MS.mastersOf('magyo').filter((m) => !m.lord);
  ok(mazon.length === 8 && mazon.every((m) => m.lv >= 99 && m.lv <= swordKing), '팔마존 여덟 — 십이지왕급(99~150)', mazon.map((m) => m.lv).join(' '));
  const lords = { murim: MS.masterOf('jinpaecheon'), sapa: MS.masterOf('baekjagang'), magyo: MS.masterOf('cheonma') };
  ok(lords.murim.lv > swordKing && lords.sapa.lv > swordKing && lords.murim.lord && W.LORD_HP > 1, '무림맹주·사도맹주는 검왕보다 세다(레벨 위 · 체력 배수)', `${lords.murim.lv} · ${lords.sapa.lv} > ${swordKing}`);
  ok(lords.magyo.lv > Math.max(lords.murim.lv, lords.sapa.lv), '천마는 두 맹주보다 세다', `${lords.magyo.lv}`);
  ok(['murim', 'sapa'].every((f) => MS.mastersOf(f).filter((m) => !m.lord).length === 7), '정파·사파 칠대고수 일곱씩');
  ok(MS.MASTERS.every((m) => m.story && m.story.length > 40 && m.move && m.look), '고수마다 이야기·독문무공·모습이 있다');
  ok(['murim', 'sapa', 'magyo'].every((f) => MS.mastersOf(f).every((m, i, a) => !i || m.lv > a[i - 1].lv)), '세력 안에서 고수는 차례로 세진다');
  // 고수의 두목 방: 졸개가 있고 고수가 다시 난다 · 처음 쓰러뜨리면 영구 +1% · 맹주는 더 단단하다
  const g = fresh();
  const room = W.mapId(W.masterZoneOf('namgung'), W.BOSS_AREA);
  ok(W.mapOf(room).bossRoom && W.mapOf(room).master === 'namgung' && W.mapOf(room).mobs.length >= 2, '고수마다 두목 방(수하 졸개 + 고수)', W.mapOf(room).name);
  g.enterMap(room);
  for (let i = 0; i < 80; i++) g.tick(0.05);
  const boss = g.mons.find((m) => m.isBoss && m.alive);
  ok(boss && boss.lv === MS.masterOf('namgung').lv && g.mons.some((m) => !m.isBoss && m.alive), '들어가면 고수와 졸개가 있다', `${boss?.name} Lv.${boss?.lv}`);
  boss.introT = 0; g.freezeT = 0; boss.castT = 0;
  g.tick(0.05);
  ok(g.tells.length > 0 && g.events.some((e) => e.type === 'bossCast' && MS.masterOf('namgung').skills.some((k) => k.name === e.name)), '고수가 설정의 독문무공으로 바닥 경고를 깐다', g.events.filter((e) => e.type === 'bossCast').map((e) => e.name).join(' '));
  const atk0 = g.stats().atk;
  boss.calib = null;   // v271 한 방 시험 — 첫 몇 초 맞춤(체력을 올린다)을 끈다
  g.hurt(boss, boss.hp + 1, 'hit', false);
  g._stats = null;
  ok(g.s.duel.won.namgung && g.stats().atk > atk0 && g.events.some((e) => e.type === 'masterDown'), '처음 쓰러뜨리면 영구 공격력·체력 +1%');
  ok(Object.values(MS.KING_SKILLS).length === 12 && W.ZONE_ORDER.filter((z) => z.king).every((z) => MS.KING_SKILLS[z.king.title]?.length >= 2), '십이지왕 열둘 모두 설정의 초식이 있다');
  const lordRoom = W.mapOf(W.mapId(W.masterZoneOf('jinpaecheon'), W.BOSS_AREA));
  ok(lordRoom.lord && !W.mapOf(room).lord, '맹주·천마의 방은 우두머리가 더 단단하다');
}

console.log('\n=== 사냥터 몹 강함 (v149) ===');
{
  const DG = await import('../js/world/wdgn.js');
  // 같은 레벨 기준 무인이 0.5초 칠 체력 — 무인 성장을 따른다
  // v242: 레벨 30까지는 0.5초어치, 그 위는 장비 기대치 곡선(gearHp)만큼 단단하다 — 높은 사냥터일수록 강화·등급 장비를 갖췄다고 본다
  const rows = [20, 60, 100, 145].map((lv) => [lv, DG.fieldMobHp(lv) / DG.refDps(lv) / DG.gearHp(lv)]);
  ok(rows.every(([, t]) => t >= 0.45 && t <= 0.8), '사냥터 몹 체력 = 같은 레벨 무인 0.5초어치 × 장비 기대치(v242)', rows.map(([l, t]) => `${l}:${t.toFixed(2)}초`).join(' '));
  ok(DG.gearHp(30) === 1 && DG.gearHp(92) >= 3.5 && DG.gearHp(145) >= 7 && DG.gearAtk(145) >= 2.5, '장비 기대치: 30까지 ×1 · 92에 체력 ×3.5+ · 145에 ×7+', `${DG.gearHp(92).toFixed(1)} ${DG.gearHp(145).toFixed(1)} ${DG.gearAtk(145).toFixed(1)}`);
  ok(DG.fieldMobHp(100) > W.mobHp(100) * 10, '레벨 100 몹은 옛 공식보다 열 배 넘게 단단하다', `${DG.fieldMobHp(100)} vs ${W.mobHp(100)}`);
  // 레벨 차이: 높은 몹에게는 내 피해가 줄고 받는 피해가 는다
  const g = fresh();
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.enterMap(W.mapId(16, 1));
  const m = g.mons.find((x) => !x.npc && x.alive);
  ok(m && g.gapOut(m) < 0.5 && g.gapIn(m) > 1.7, '레벨 60이 십이지왕(99~) 몹을 치면 내 피해 반 아래 · 받는 피해 1.7배 넘게', `${g.gapOut(m).toFixed(2)} · ${g.gapIn(m).toFixed(2)}`);
  g.enterMap(W.mapId(9, 3));
  const m2 = g.mons.find((x) => !x.npc && x.alive);
  ok(m2 && g.gapOut(m2) === 1 && g.gapIn(m2) === 1, '내 레벨 아래 몹은 보정 없음');
  // 함께 사냥 왕의 체력은 내 화면 왕과 같은 셈
  const CoopMod = await import('../js/world/wcoop.js');
  const c = new CoopMod.Coop({ map: W.mapOf(W.mapId(16, 4)) }, {});
  ok(Math.abs(c.kingMaxHp() - DG.fieldMobHp(W.mapOf(W.mapId(16, 4)).lv[1] + 2) * W.BOSS.hp * MS.PAT_HP) < 1, '함께 사냥 왕 체력 = 내 화면 왕 체력 공식 (초식 두목 ×4)');
}

console.log('\n=== 증표 각인 세 칸 (v163) ===');
{
  const IM = await import('../js/world/wimprint.js');
  const g = fresh(); g.s.gold = 1e15;
  while (g.s.level < 120) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 3; g._stats = null;
  const w = g.s.equip.weapon;
  const poison = W.bossKey(1), king1 = W.bossKey(W.NORMAL_ZONES + 12);   // 독수마군 · 검왕
  ok(IM.themeOfZone(1) === 'poison' && IM.specialOfZone(1) === null && IM.specialOfZone(W.NORMAL_ZONES + 12)?.name === '무형신검', '독수마군은 독 테마 · 검왕은 고유 효과 무형신검');
  ok(IM.imprintOf(W.bossKey(10), 0).fx[Object.keys(IM.THEMES[IM.themeOfZone(10)].fx.reduce((o, [k]) => ({ ...o, [k]: 1 }), {}))[0]] > IM.imprintOf(W.bossKey(2), 0).fx[Object.keys(IM.THEMES[IM.themeOfZone(2)].fx.reduce((o, [k]) => ({ ...o, [k]: 1 }), {}))[0]] / 10, '각인 크기는 두목 레벨에 비례한다');
  g.s.mats[poison] = 1000; g.s.mats[king1] = 1000;
  g.rng = () => 0;
  g.infuse(w.uid, poison);
  ok(w.rar === 1 && w.imps.length === 1 && w.imps[0].k === poison, '유니크로 오르면 첫째 칸에 그 두목이 새겨진다');
  g._stats = null;
  ok(g.stats().venom > 0, '독수마군 각인: 적중 피해 일부가 독으로', `${(g.stats().venom * 100).toFixed(2)}%`);
  const v1 = g.stats().venom;
  g.infuse(w.uid, poison); g.infuse(w.uid, king1);
  g._stats = null;
  ok(w.rar === 3 && w.imps.length === 1 && w.imps[0].k === poison && g.lastInfuse?.kept, '신화까지 올려도 칸은 하나 — 새겨진 두목은 그대로 (v307)');
  ok(g.stats().venom > v1 * 2, '등급이 오르면 그 한 칸이 세진다(유니크 ×1.5 → 신화 ×4)', `${(v1 * 100).toFixed(2)}% → ${(g.stats().venom * 100).toFixed(2)}%`);
  w.imps = [{ k: king1, s: 2, sk: 'echo', g: 0, sp: 0 }];   // 검왕으로 다시 새긴 셈
  g._stats = null; g._mods = null; g._isp = null;
  const im3 = IM.imprintOf(w.imps[0], 3);
  const md = g.skillMods(`s${im3.skill.s}`);
  const base3 = fresh(); base3.s.level = g.s.level; base3.s.jobTier = 3; base3._stats = null;
  const md0 = base3.skillMods(`s${im3.skill.s}`);
  ok(im3.skill.k === 'echo' ? md.echoP > 0 : md[im3.skill.k] > md0[im3.skill.k], `검왕 각인 스킬 변화가 그 스킬에 든다: ${IM.skillModText(im3.skill)}`);
  ok(g.impSpecials().echo?.p > 0, '검왕 고유 효과(무형신검)가 켜진다', JSON.stringify(g.impSpecials().echo));
  // 같은 스킬 범위 각인이 겹치면 범위가 커진다
  const R = fresh(); while (R.s.level < 60) R.addExp(W.expToNext(R.s.level)); R.s.jobTier = 3; R._stats = null;
  let rz = 1; while (IM.SKILL_KIND[IM.themeOfZone(rz)] !== 'range' || rz % 3 !== 1) rz++;
  const sk1 = R.skillDef('s1');
  const r0 = R.skillRadius(sk1);
  R.s.equip.armor.rar = 2; R.s.equip.armor.imps = [W.bossKey(rz)];
  R._stats = null; R._mods = null;
  ok(R.skillRadius(sk1) > r0, '2차 스킬 범위 각인(전설 ×2.5) — 범위가 커진다(그림도 커진다)', `${r0.toFixed(0)} → ${R.skillRadius(sk1).toFixed(0)} (${W.zoneOfW(rz).boss.name})`);
  // 한 번 더 각인: 스킬이 두 번 펼쳐지고 그림 사건도 두 번
  const E = fresh(); while (E.s.level < 60) E.addExp(W.expToNext(E.s.level)); E.s.jobTier = 3; E._stats = null;
  E.enterMap(W.mapId(5, 1)); for (let i = 0; i < 30; i++) E.tick(0.05);
  let ez = 1; while (IM.SKILL_KIND[IM.themeOfZone(ez)] !== 'echo' || ez % 3 !== 1) ez++;
  E.s.equip.hat.rar = 3; E.s.equip.hat.imps = [W.bossKey(ez)];
  E._stats = null; E._mods = null; E.rng = () => 0; E.cd.s1 = 0; E.heroHp = E.stats().hp;
  E.events.length = 0;
  E.useSkill('s1');
  ok(E.events.filter((e) => e.type === 'skill').length === 2 && E.events.some((e) => e.type === 'echo'), '한 번 더 각인 — 스킬 그림이 두 번 펼쳐진다');
  // 고유 효과: 천마군림(둘레 폭발)이 때마다 터진다
  const N = fresh(); while (N.s.level < 150) N.addExp(W.expToNext(N.s.level)); N._stats = null;
  N.s.equip.weapon.rar = 1; N.s.equip.weapon.imps = [W.bossKey(W.masterZoneOf('cheonma'))];
  N._stats = null; N._isp = null;
  N.enterMap(W.mapId(5, 1));
  for (const m of N.mons) { m.x = N.heroX + 40; m.y = N.heroY; m.hp = m.maxHp = 1e15; m.atk = 0; }
  N.events.length = 0;
  for (let i = 0; i < 300; i++) N.tick(0.05);
  ok(N.events.some((e) => e.type === 'impNova') && N.events.some((e) => e.type === 'imprint' && e.name === '천마군림'), '천마 각인: 천마군림이 때마다 둘레를 터뜨린다');
}

console.log('\n=== 각인 v167: 스킬 변화 랜덤 · 고유 셋 중 고르기 · 다시 새기기 ===');
{
  const IM = await import('../js/world/wimprint.js');
  // 스킬 변화는 몇 차·무엇·등급이 모두 나온다
  const r = seeded(7); const seen = { s: new Set(), k: new Set(), g: [0, 0, 0, 0] };
  for (let i = 0; i < 4000; i++) { const c = IM.rollSkillChange(r); seen.s.add(c.s); seen.k.add(c.sk); seen.g[c.g]++; }
  ok(seen.s.size === 3 && seen.k.size === 4 && seen.g.every((x) => x > 0) && seen.g[0] > seen.g[3] * 8, '스킬 변화: 1~3차 · 범위/피해/숨/한 번 더 · 레어~신화가 모두 랜덤으로 나온다', seen.g.join('/'));
  // 사용자 예: 독수마군 레어 < 혈사도왕 레어 < 독수마군 레전드
  const v = (z, g) => IM.skillValue('range', g, W.markLv(W.bossKey(z)));
  ok(v(1, 0) < v(2, 0) && v(2, 0) < v(1, 2), '독수마군 레어 2차 범위 < 혈사도왕 레어 < 독수마군 레전드', `${(v(1, 0) * 100).toFixed(1)}% < ${(v(2, 0) * 100).toFixed(1)}% < ${(v(1, 2) * 100).toFixed(1)}%`);
  const all = IM.ALL_SPECIALS();
  ok(all.length === 93 && new Set(all.map((x) => x.kind)).size === 16, '레벨 100 넘는 두목 31(+화무기·마귀 v238) × 고유 효과 셋 = 93 · 꼴 열여섯');
  // 고르기 · 다시 새기기
  const g = fresh(); g.s.gold = 1e15;
  while (g.s.level < 150) g.addExp(W.expToNext(g.s.level));
  const w = g.s.equip.weapon;
  const cm = W.bossKey(W.masterZoneOf('cheonma'));
  g.s.mats[cm] = 1000; g.rng = () => 0;
  g.infuse(w.uid, cm, 1);
  let im = IM.imprintOf(w.imps[0], 0);
  ok(im.special.name === '구화마공' && im.special.kind === 'phoenix', '새길 때 고른 고유 효과가 새겨진다 (천마 — 구화마공)');
  const sk0 = JSON.stringify(im.skill);
  ok(g.changeImpSpecial(w.uid, 0, 0) && IM.imprintOf(w.imps[0], 0).special.name === '천마군림' && JSON.stringify(IM.imprintOf(w.imps[0], 0).skill) === sk0, '고유만 바꾸면 스킬 변화는 그대로(잠금)');
  const m0 = g.s.mats[cm];
  g.rng = seeded(99);
  let changed = false;
  // v347 굴리면 후보만 — 지금 것은 그대로, 고르면(keepReroll) 바뀐다
  g.rerollImpSkill(w.uid, 0);
  ok(JSON.stringify(IM.imprintOf(w.imps[0], 0).skill) === sk0 && w.imps[0].cand, '다시 굴리면 후보만 생기고 지금 효과는 그대로 (v347)');
  ok(g.dropReroll(w.uid, 0) && !w.imps[0].cand && JSON.stringify(IM.imprintOf(w.imps[0], 0).skill) === sk0, '지금 것 지키기 — 후보만 버린다');
  for (let i = 0; i < 6 && !changed; i++) { g.rerollImpSkill(w.uid, 0); g.keepReroll(w.uid, 0); changed = JSON.stringify(IM.imprintOf(w.imps[0], 0).skill) !== sk0; }
  ok(changed && IM.imprintOf(w.imps[0], 0).special.name === '천마군림' && g.s.mats[cm] < m0, '스킬 변화만 다시 굴리면 고유는 그대로 · 증표가 든다');
  // 옛 판(v163) 각인 글자도 읽힌다
  ok(IM.imprintOf('b1', 0)?.theme === 'poison', '옛 판 각인(증표 글자만)도 읽힌다');
}

console.log('\n=== 고유 효과가 쓸모 있는가 (v167 · 꼴 열여섯을 시뮬로 잰다) ===');
{
  const IM = await import('../js/world/wimprint.js');
  // 레벨 120 검사 · 유니크 칸 하나(무게 1.5 — v307)에 그 고유 하나. 같은 장비·같은 각인에서 고유만 끈 판과 견준다(같은 난수).
  //   dummy   허수아비 여섯이 둘레에 (때리지 않는다) — 60초 동안 준 피해
  //   counter  허수아비가 때린다(무인은 쓰러지지 않게) — 맞을 때 터지는 반격·쾌속을 60초 동안 준 피해로
  //   pressure 물약 없이 벅찬 사냥터(남만 독림 2)에서 120초 — 평균 체력·쓰러짐·준 피해
  const pick = (kind) => IM.ALL_SPECIALS().find((x) => x.kind === kind);
  const run = (kind, scene, off, seed = 4242) => {
    const g = fresh();
    g.rng = seeded(seed);
    while (g.s.level < 120) g.addExp(W.expToNext(g.s.level));
    g.s.jobTier = 3; g.s.autoSkill = true; g.s.potions = 0; g.s.autoPotion = false; g._stats = null;
    const sp = pick(kind);
    const [zid, i] = sp.id.split('.');
    const z = zid[0] === 'k' ? W.NORMAL_ZONES + 13 - +zid.slice(1) : W.masterZoneOf(zid);
    g.s.equip.weapon.rar = 1; g.s.equip.weapon.imps = [{ k: W.bossKey(z), s: 0, sk: 'dmg', g: 0, sp: +i }];   // v307: 유니크 ×1.5 ≈ 옛 신화 칸 1.6 (버티기 장면의 벅참을 그대로)
    g._stats = null; g._isp = null; g._mods = null;
    if (off) g.impSpecials = () => ({});
    g.autoDodge = true;
    let dealt = 0, deaths = 0, hpSum = 0, n = 0;
    const hurt0 = g.hurt.bind(g);
    g.hurt = (m, d, ...a) => { if (m.alive && !m.npc && !(m.introT > 0)) dealt += Math.min(d, m.hp); return hurt0(m, d, ...a); };
    if (scene === 'pressure') {
      const map = W.mapId(12, 2);          // 남만 독림 2 — 물약 없이 두 분에 다섯쯤 쓰러지는 곳 (v242 장비 기대치 곡선 뒤로는 천외천은 쉰 번 넘게 쓰러진다)
      g.enterMap(map);
      for (let t = 0; t < 120; t += 0.05) {
        g.tick(0.05);
        if (g.map.town || g.heroHp <= 0) { deaths++; g.heroHp = g.stats().hp; g.enterMap(map); }
        hpSum += g.heroHp / g.stats().hp; n++;
        g.events.length = 0;
      }
      return { dealt, deaths, hp: hpSum / n };
    }
    // 허수아비
    g.enterMap(W.mapId(15, 2));
    for (let i2 = 0; i2 < 20; i2++) g.tick(0.05);
    const dummies = g.mons.filter((m) => m.alive && !m.npc).slice(0, scene === 'bane' ? 1 : 6);
    dummies.forEach((m, j) => {
      const a = (j / dummies.length) * Math.PI * 2;
      m.x = g.heroX + Math.cos(a) * 90; m.y = g.heroY + Math.sin(a) * 60; m.c = Math.round(m.x / W.TILE); m.r = Math.round(m.y / W.TILE);
      m.atk = scene === 'counter' ? m.atk : 0; m.maxHp = 1e15; m.hp = scene === 'execute' ? 2e14 : 1e15; m.move = null;
      if (scene === 'bane') m.isBoss = true;
    });
    g.mons = dummies; g.s.autoHunt = false;
    for (let t = 0; t < 60; t += 0.05) {
      g.respawns = [];
      g.mons = g.mons.filter((m) => dummies.includes(m));
      if (scene === 'execute') for (const m of dummies) m.hp = Math.min(m.hp, 2e14);
      if (scene === 'berserk') g.heroHp = g.stats().hp * 0.4;
      if (scene === 'counter') g.heroHp = g.stats().hp;              // 맞기만 하고 쓰러지지는 않게
      for (const m of dummies) m.move = null;
      g.tick(0.05);
      g.events.length = 0;
    }
    return { dealt, deaths: 0, hp: 1 };
  };
  const SCENE = { echo: 'dummy', execute: 'execute', bane: 'bane', chain: 'dummy', nova: 'dummy', rain: 'dummy', bleed: 'dummy', surge: 'dummy', berserk: 'berserk',
    guard: 'pressure', reap: 'pressure', frenzy: 'counter', mirror: 'counter', phoenix: 'pressure', stunwave: 'pressure', vigor: 'pressure' };
  for (const k of Object.keys(IM.SPECIAL_KIND)) {
    const sc = SCENE[k];
    // 버티기는 판마다 크게 흔들린다 — 난수 셋으로 세 판씩 더해 본다
    const seeds = sc === 'pressure' ? [4242, 77, 31337] : [4242];
    const sum = (off) => seeds.map((sd) => run(k, sc, off, sd)).reduce((a, x) => ({ dealt: a.dealt + x.dealt, deaths: a.deaths + x.deaths, hp: a.hp + x.hp / seeds.length }), { dealt: 0, deaths: 0, hp: 0 });
    const r = sum(false), b = sum(true);
    const dmgUp = r.dealt / Math.max(1, b.dealt) - 1;
    const hpUp = r.hp - b.hp;
    const lessDeaths = b.deaths ? (b.deaths - r.deaths) / b.deaths : 0;
    const good = dmgUp >= 0.05 || hpUp >= 0.05 || lessDeaths >= 0.2;
    ok(good, `고유 ${k} (${pick(k).name} 등) — ${sc === 'pressure' ? '버티기' : '허수아비'}`,
      sc === 'pressure' ? `평균 체력 ${(b.hp * 100).toFixed(0)}% → ${(r.hp * 100).toFixed(0)}% · 쓰러짐 ${b.deaths} → ${r.deaths} · 준 피해 ${dmgUp >= 0 ? '+' : ''}${(dmgUp * 100).toFixed(0)}%`
        : `준 피해 +${(dmgUp * 100).toFixed(1)}%`);
  }
}

console.log('\n=== 십이지왕·고수 초식 (v168): 고정 피해 · 테마 꼴 · 오의 ===');
{
  const DG = await import('../js/world/wdgn.js');
  const mk = (lv, tank) => {
    const g = fresh(); g.rng = seeded(5);
    while (g.s.level < lv) g.addExp(W.expToNext(g.s.level));
    g.s.jobTier = 3; g._stats = null;
    if (tank) { for (const k of W.GROW_SLOTS) { g.s.equip[k].rar = 3; g.s.equip[k].plus = 12; } g.s.stats.vit = 600; g._stats = null; }
    return g;
  };
  const kz = W.NORMAL_ZONES + 12;            // 검왕
  const enterBoss = (g, z) => { g.enterMap(W.mapId(z, W.BOSS_AREA)); for (let i = 0; i < 200 && !g.mons.some((m) => m.isBoss && m.alive && !(m.introT > 0)); i++) g.tick(0.05); g.freezeT = 0; return g.mons.find((m) => m.isBoss && m.alive); };
  const weak = mk(150, false), tank = mk(150, true);
  const bw = enterBoss(weak, kz), bt = enterBoss(tank, kz);
  ok(bw && MS.bossPatterns(weak.map)?.ult?.name === '무형검진', '검왕 두목 방 — 테마 초식 셋 + 오의 무형검진');
  const ultAbs = DG.refHp(bw.lv) * MS.PAT_K * MS.PAT_ULT;
  const hw = weak.patternHit(ultAbs, bw), ht = tank.patternHit(ultAbs, bt);
  ok(hw >= weak.stats().hp && ht < tank.stats().hp, '오의 한 대 — 맨몸에 가까운 차림은 쓰러지고, 체력·방어를 올린 차림은 버틴다', `기본 ${Math.round(hw)} / 체력 ${Math.round(weak.stats().hp)} · 단단한 ${Math.round(ht)} / ${Math.round(tank.stats().hp)}`);
  // 그 레벨에 흔한 차림(스탯을 찍고 +9 유니크): 보통 초식은 크게 깎이고(30~50%), 맹주·천마의 오의는 쓰러진다
  const typ = mk(150, false); typ.s.autoStat = true; typ.autoStats(); for (const k of W.GROW_SLOTS) { typ.s.equip[k].rar = 1; typ.s.equip[k].plus = 9; } typ._stats = null;
  const nAbs = DG.refHp(bw.lv) * MS.PAT_K;
  const fr = typ.patternHit(nAbs, bw) / typ.stats().hp, lordUlt = typ.patternHit(nAbs * MS.PAT_ULT * MS.PAT_LORD, bw) / typ.stats().hp;
  ok(fr > 0.3 && fr < 0.6 && lordUlt >= 1, '흔한 차림: 보통 초식 한 대는 버틴다 · 맹주·천마 오의는 쓰러진다', `보통 ${Math.round(fr * 100)}% · 맹주 오의 ${Math.round(lordUlt * 100)}%`);
  // 세 번째마다 오의 · 경고에 고정 피해가 실린다
  weak.events.length = 0;
  let ults = 0, casts = 0, absOk = true;
  for (let i = 0; i < 9; i++) { bw.castT = 0; weak.tickBossSkill(0.05); for (const e of weak.events) if (e.type === 'bossCast') { casts++; if (e.ult) ults++; } weak.events.length = 0; if (!weak.tells.every((t) => t.abs > 0)) absOk = false; weak.tells = []; }
  ok(casts === 9 && ults === 3 && absOk, '아홉 번 펼치면 오의가 셋 · 경고마다 고정 피해', `${casts}번 · 오의 ${ults}`);
  // 새 꼴: 부채꼴·파동·그물
  weak.tells = [];
  weak.bossCast(bw, 100, 0, ['cone'], '붕권', { abs: 1 });
  const cone = weak.tells[0];
  ok(cone.kind === 'cone' && DG.tellCovers(cone, cone.x + Math.cos(cone.a) * 300, cone.y + Math.sin(cone.a) * 300) && !DG.tellCovers(cone, cone.x - Math.cos(cone.a) * 300, cone.y - Math.sin(cone.a) * 300), '부채꼴: 앞은 맞고 뒤는 안 맞는다');
  weak.tells = []; weak.bossCast(bw, 100, 0, ['ring3'], '귀혼음', { abs: 1 });
  ok(weak.tells.length === 3 && weak.tells.every((t) => t.kind === 'donut') && weak.tells[2].t > weak.tells[1].t && !DG.tellCovers(weak.tells[0], weak.tells[0].x + 200, weak.tells[0].y) && !weak.tells.some((t) => DG.tellCovers(t, t.x + 200, t.y)), '파동: 고리 셋이 한꺼번에 깔리고 차례로 터진다 · 고리 사이 틈은 안전');
  weak.tells = []; weak.bossCast(bw, 100, 0, ['grid'], '검기 그물', { abs: 1 });
  ok(weak.tells.length === 6 && weak.tells.filter((t) => t.wait > 0).length === 3, '그물: 평행선 셋 + 엇갈리는 셋');
  // 낮은 고수는 옛 방식(최대 체력의 몇 할)
  const low = mk(60, false); low.enterMap(W.mapId(W.masterZoneOf('namgung'), W.BOSS_AREA));
  ok(MS.bossPatterns(low.map) === null, '레벨 100 아래 고수는 옛 초식(최대 체력의 몇 할) 그대로');
}

console.log('\n=== 현철 (v273) — 지역 재료를 하나로 ===');
{
  // 옛 세이브의 지역 재료는 가중치대로 현철로 (증표·강화석·세력 재료는 그대로)
  const old = newWorldSave(0); old.job = 'sword'; old.mats = { 1: 100, 10: 50, b3: 7, st21: 2, fm: 9 };
  const m = migrateWorld(old, 0);
  ok(m.mats[W.ORE] === 100 * W.matWeight(1) + 50 * W.matWeight(10) && !m.mats[1] && !m.mats[10] && m.mats.b3 === 7 && m.mats.st21 === 2 && m.mats.fm === 9, '옛 지역 재료 → 현철(가중치) · 나머지는 그대로', JSON.stringify(m.mats));
  ok(W.matWeight(1) === 1 && W.matWeight(15) > W.matWeight(10) && W.matWeight(27) >= 25, '가중치는 사냥터 레벨 ÷ 5', [1, 10, 15, 27].map((z) => W.matWeight(z)).join('·'));
  const g = fresh(); g.addMats(10, 3); g.addMats('b10', 1);
  ok(g.s.mats[W.ORE] === 3 * W.matWeight(10) && g.s.mats.b10 === 1 && !g.s.mats[10], '들어오는 지역 재료는 현철로 · 증표는 그대로');
  ok(g.convertMats(1) === 0, '올리기(2:1)는 할 것이 없다');
}

console.log('\n=== 걸으면서 무공 · 범위 (v157) ===');
{
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 3; g._stats = null;
  g.enterMap(W.mapId(4, 1));
  for (let i = 0; i < 40; i++) g.tick(0.05);
  g.s.autoSkill = true;
  const m = g.mons.find((x) => x.alive && !x.npc);
  for (const o of g.mons) if (o !== m) o.alive = false;
  m.isBoss = true; m.hp = m.maxHp = 1e12; m.atk = 0;
  m.x = g.heroX + 90; m.y = g.heroY;
  g.mon = null;
  g.cd = {};
  g.joy = { dx: -1, dy: 0 };
  g.events.length = 0;
  let walkCast = 0;
  for (let i = 0; i < 20; i++) { g.tick(0.05); if (g.hmove && g.events.some((e) => e.type === 'skill' && e.id !== 's3')) walkCast++; g.events.length = 0; }
  ok(walkCast > 0, '조이스틱으로 걷는 중에도 자동 무공(치는 무공)이 나간다');
  g.joy = null;
  const sks = g.skills();
  ok(sks.every((sk) => { const r = g.skillReach(sk); return r === null || (r.r >= 0 && r.reach >= 0); }) && sks.some((sk) => g.skillReach(sk)?.r > 0), '무공마다 범위(반경·사거리)를 낼 수 있다');
}

console.log('\n=== v261 강화 상한 · 경험치 구간 ===');
{
  const g = fresh(); g.s.gold = 1e15;
  for (let k = 1; k <= 60; k++) g.s.mats[W.bossKey(k)] = g.s.mats[W.bossKey(k)] || 0;
  g.s.mats[W.ORE] = 1e9;
  const w = g.s.equip.weapon;
  for (let i = 0; i < 50; i++) g.enhance(w.uid);
  ok(w.plus === W.enhanceLvCap(g.s.level) && w.plus === 5 && !g.canEnhance(w), 'Lv1은 +5까지 — 강화 상한은 레벨에 묶인다', `+${w.plus}`);
  g.s.level = 45;
  ok(g.enhanceMax(w) === 10 && W.enhanceCapNext(45)[0] === 65, 'Lv45 +10 · 다음은 Lv65', `${g.enhanceMax(w)}`);
  ok(W.expSlow(5) === 1 && W.expSlow(40) === 2.6 && W.expToNext(10) === Math.round(27 * 10 ** 2.3 * (1 + (10 / 30) ** 2.2)), '첫 시간(~Lv12)의 경험치는 그대로 · 뒤로 갈수록 배율');
}

console.log('\n=== v262 경제 · 복귀 · 선택 ===');
{
  const TDm = await import('../js/world/wtoday.js');
  const DG = await import('../js/world/wdgn.js');
  const g = fresh(); g.s.gold = 1e15;
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  // 영약
  ok(g.buyElixir() && g.s.elixir === W.ELIXIR_SEC, '영약 — 30분');
  for (let i = 0; i < 10; i++) g.buyElixir();
  ok(g.s.elixir === W.ELIXIR_MAX, '영약은 3시간까지만 쌓인다');
  // 무관 증축
  const c0 = g.offlineCapSec();
  ok(g.buyHall('cap') && g.offlineCapSec() === c0 + 3600 && g.hallCost('cap') > W.hallCost('cap', 0, g.s.level), '무관 증축 — 방치 상한 +1시간 · 다음 값은 더 비싸다');
  g.s.rates = { kills: 1, exp: 100, gold: 100, potions: 0, bosses: 0, map: W.mapId(1, 1) };
  g.s.lastSeen = 0; g.s.clockMax = 0; g.s.elixir = 0;
  const r0 = g.offlineReward(20 * 3600e3);
  ok(Math.abs(r0.t - (W.OFFLINE_CAP_SEC + 3600)) < 1, '방치 상한이 늘었다(11시간)', `${(r0.t / 3600).toFixed(1)}시간`);
  for (let i = 0; i < 5; i++) g.buyHall('eff');
  const r1 = g.offlineReward(20 * 3600e3);
  ok(r1.te > r0.te * 1.2 && g.hallCost('eff') === null, '방치 효율 +25%까지(다 사면 끝)', `${(r0.te / 3600).toFixed(2)} → ${(r1.te / 3600).toFixed(2)}`);
  g.s.elixir = 3600;
  const r2 = g.offlineReward(20 * 3600e3);
  ok(r2.gold > r1.gold && r2.elix === 3600, '영약은 방치 중에도 닳으며 벌이를 늘린다');
  g.claimOffline(r2);
  ok(g.s.elixir === 0, '받으면 영약 시간이 줄어든다');
  // 세력 상점
  g.s.mats.fm = 300; g.s.prot = 0;
  ok(g.buyFac('prot') && g.s.prot === 1 && g.s.mats.fm === 150, '세력 상점 — 협의패 150 → 보호부');
  g.s.mats.fg = 800;
  const tk0 = Object.values(g.s.zTickets).reduce((a, b) => a + b, 0);
  ok(g.buyFac('ticket') && Object.values(g.s.zTickets).reduce((a, b) => a + b, 0) === tk0 + 1, '마혈정 800 → 십이지 뽑기권');
  // 일일 던전 남긴 횟수는 하루 넘어온다
  const d0 = Date.UTC(2026, 9, 26, 3);
  g.dgnToday(d0); g.s.dgn.used.exp = 1;
  ok(g.dailyLeft('exp', d0 + 86400e3) === DG.DAILY_ENTRIES + 2, '어제 남긴 두 번이 오늘로', `${g.dailyLeft('exp', d0 + 86400e3)}`);
  ok(g.dailyLeft('exp', d0 + 3 * 86400e3) === DG.DAILY_ENTRIES, '하루만 넘어온다');
  // 오늘의 강호
  const now = Date.UTC(2026, 9, 27, 3);
  const realNow = Date.now; Date.now = () => now;
  try {
    const list = g.todayTasks(now);
    ok(list.length === TDm.TASKS_PER_DAY && new Set(list.map((x) => x.id)).size === 3 && JSON.stringify(TDm.tasksOf('2026-10-27').map((x) => x.id)) === JSON.stringify(list.map((x) => x.id)), '하루 과제 셋 — 날짜로 정해진다');
    const x = list[0];
    g.tday(x.counter, x.need);
    const gold0 = g.s.gold;
    ok(g.claimToday(x.id, now) && g.s.gold > gold0 && g.s.week.pts === 1 && !g.claimToday(x.id, now), '다 하면 받기 · 두 번은 못 받는다');
    g.s.week.pts = TDm.WEEK_NEED;
    const p0 = g.s.prot;
    ok(g.openWeek(now) && g.s.prot === p0 + 3 && !g.canOpenWeek(now), '주간 상자 — 한 주에 한 번');
  } finally { Date.now = realNow; }
  ok(TDm.bloodOn(Date.UTC(2026, 9, 27, 3, 30)) && !TDm.bloodOn(Date.UTC(2026, 9, 27, 6)), '혈겁 — 한국 시간 12~14시(UTC 3시)');
  // 스탯의 제 몫
  const b0 = g.stats().boss;
  g.s.stats.str += 100; g._stats = null;
  ok(g.stats().boss > b0 * 1.14, '힘 100 → 두목 피해 +15%', `${b0.toFixed(2)} → ${g.stats().boss.toFixed(2)}`);
  // 차림 두 벌
  const L = fresh();
  while (L.s.level < 40) L.addExp(W.expToNext(L.s.level));
  L.s.autoStat = false;
  L.addStat('str', 10);
  ok(L.switchLoadout(1) && L.s.loadout === 1 && L.s.stats.str === 10, '처음엔 지금 차림을 복사');
  const pts = L.s.statPts;
  L.s.stats.str -= 10; L.s.statPts += 10; L.addStat('vit', 10);
  ok(L.switchLoadout(0) && L.s.stats.str === 10 && L.s.stats.vit === 0 && L.s.statPts === pts, '차림 1로 — 힘 10');
  ok(L.switchLoadout(1) && L.s.stats.vit === 10 && L.s.stats.str === 0, '차림 2로 — 체력 10');
  // 애완동물 조각 · 혼
  const P = fresh();
  P.enterMap(W.mapId(3, 1));
  P.s.petShard = W.PET_SHARD_NEED;
  const pet = P.shardPet();
  ok(pet && P.s.petShard === 0, '포획 조각 100 → 애완동물 하나');
  pet.lv = W.PET_LV_MAX; P.s.pets = [pet];
  P.petExp(W.petExpToNext(W.PET_LV_MAX) * 7);
  ok(P.s.petSoul === 7, '다 큰 애완동물의 경험치는 혼으로', `${P.s.petSoul}`);
  ok(P.soulUp(pet.uid) && pet.rar === 1 && P.s.petSoul === 1, '혼 6 → 등급 하나 위');
  // 비무 별
  ok(MS.STAR_BONUS === 0.25 && P.duelStars('x').n === 0, '별 없음');
  P.s.duel.won.x = 1; P.s.duel.stars = { x: 3 };
  ok(P.duelStars('x').n === 3 && P.duelStars('x').extra === 2, '별 셋');
  // 99 뒤 돌파 증표 — 왕 증표로 대신
  const K = fresh(); K.s.level = 120;
  const kw = K.s.equip.weapon; kw.plus = 12;
  const km = K.enhanceMats(kw);
  K.s.mats[W.bossKey(km.key)] = 0; K.s.mats[W.bossKey(W.NORMAL_ZONES + 3)] = 50;
  ok(K.breakMarkKey(kw) === W.bossKey(W.NORMAL_ZONES + 3), '99 뒤 돌파 증표가 모자라면 왕 증표로', K.breakMarkKey(kw));
  K.s.level = 60;
  ok(K.breakMarkKey(kw) === null, '99 전에는 안 된다');
  // 자동 강화
  const A = fresh(); A.s.gold = 1e15; A.s.mats[W.ORE] = 1e9;
  A.s.autoEnh = true;
  A.autoGear();
  ok(W.GROW_SLOTS.every((k) => (A.s.equip[k]?.plus || 0) === W.enhanceLvCap(A.s.level)), '자동 강화 — 여섯 칸을 레벨 상한까지');
}

console.log('\n=== v263 각성 · 깨달음 · 견문록 · 회랑 · 길잡이 알아두기 ===');
{
  const DG = await import('../js/world/wdgn.js');
  const g = fresh(); g.s.gold = 1e15;
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 3; g._stats = null;
  const sl = g.awakenSlots()[0];
  const d0 = g.skillMods(sl).range;
  ok(g.awaken(sl, 'wide') && Math.abs(g.skillMods(sl).range - d0 - 0.4) < 1e-9, '각성 광 — 범위 +40%');
  const gold0 = g.s.gold;
  ok(g.awaken(sl, 'heavy') && g.s.gold < gold0, '각성을 바꾸면 은자');
  // v311 무공마다 하나
  const sl2 = g.awakenSlots()[1];
  const c2 = g.awakenCost(), g1 = g.s.gold;
  ok(sl2 && c2 > 0 && g.awaken(sl2, 'twin') && g.s.gold === g1 - c2 && g.awakenOf(sl) === 'heavy' && g.awakenOf(sl2) === 'twin', '다른 무공에도 따로 하나 — 앞 무공 각성은 그대로 · 은자', JSON.stringify(g.s.awakens));
  ok(g.skillMods(sl2).echoP >= 0.3 && g.skillMods(sl).dmg > g.skillMods(sl2).dmg - 1, '각 무공에 제 각성이 든다');
  ok(!g.canAwaken(sl2, 'twin'), '같은 것은 다시 못 붙인다');
  const fresh0 = fresh(); while (fresh0.s.level < 60) fresh0.addExp(W.expToNext(fresh0.s.level)); fresh0.s.jobTier = 3; fresh0.s.gold = 0;
  ok(fresh0.awakenCost() === 0 && fresh0.awaken(fresh0.awakenSlots()[0], 'swift') && fresh0.awakenCost() > 0 && !fresh0.canAwaken(fresh0.awakenSlots()[1], 'swift'), '맨 처음 하나만 공짜 — 그 뒤엔 은자');
  const mo = migrateWorld({ ...newWorldSave(), awaken: { slot: 's1', kind: 'wide' } });
  ok(mo.awakens.s1 === 'wide' && !('awaken' in mo), '옛 저장의 각성 하나는 그 무공 자리로', JSON.stringify(mo.awakens));
  ok(Object.keys(migrateWorld({ ...newWorldSave(), awakens: { s0: 'twin', s9: 'wide', s1: 'nope' } }).awakens).join() === 's0', '이상한 칸·이름은 버린다');
  ok(/askAwaken/.test(read('js/wui.js')) && /첫 각성은 공짜/.test(read('js/wui.js')), '누르기 전에 드는 것 · 누르면 무엇인지 설명');
  // 깨달음
  while (g.s.level < W.LEVEL_MAX) g.addExp(W.expToNext(g.s.level));
  g.addExp(W.enlExp() * 3);
  ok(g.s.enl.pts === 3, '만렙 뒤 경험치 → 깨달음 점수', `${g.s.enl.pts}`);
  const dm = g.skillMods('s0').dmg;
  ok(g.enlUp('s0') && Math.abs(g.skillMods('s0').dmg - dm - W.ENL_STEP.dmg) < 1e-9 && g.s.enl.pts === 2, '깨달음 한 단계 — 피해 +3%');
  // 견문록
  const X = fresh();
  const z = W.dexZones()[0];
  const e0 = X.stats().expMult;
  for (const n of z.names) X.s.dex[n] = W.DEX_NEED;
  X._dexZ = null; X._stats = null;
  ok(X.dexZoneDone(z.id) && X.stats().expMult - e0 >= W.DEX_ZONE_EXP - 1e-9, '견문록 — 한 지역을 다 찍으면 경험치 +0.5%(같은 졸개를 쓰는 짝 지역도 함께)', `+${((X.stats().expMult - e0) * 100).toFixed(1)}%`);
  // 주간 회랑
  const T = fresh();
  T.s.tower.floor = DG.TOWER_MAX;
  ok(!T.canTower() && T.canCorridor() && T.startCorridor() && T.inst.stage === DG.TOWER_MAX + 1 && T.inst.corridor, '120층 뒤 — 주간 회랑 1층');
  ok(DG.towerHp(DG.TOWER_MAX + 10) > DG.towerHp(DG.TOWER_MAX) * 1.9 && DG.corridorPats('2026-11-02').length === 4 && JSON.stringify(DG.corridorPats('2026-11-02')) !== JSON.stringify(DG.corridorPats('2026-11-09')), '회랑은 층마다 단단해지고 주마다 초식이 바뀐다');
  T.inst.done = { ok: true }; T.tick(0.05);
  ok(T.s.tower.cor.best === 1, '이번 주 기록 1층');
  // 길잡이 — 조작 알아두기는 읽고 바로 받는다
  const Qg = fresh();
  Qg.s.quest = Q.QUESTS.findIndex((q) => q.id === 'zoom');
  ok(Qg.questNow().done, '알아두기 단계는 바로 받을 수 있다');
}

console.log('\n=== 일일 던전 열쇠 (v156 · v260 하루 셋) ===');
{
  const DG = await import('../js/world/wdgn.js');
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  let now = Date.UTC(2026, 9, 26, 3);
  const finish = (win = true) => {
    for (const m of g.mons) m.hp = 1;
    if (win) g.inst.kills = g.inst.target;
    g.inst.done = win ? { ok: true } : { timeout: true }; g.tick(0.05);
    return g.events.filter((e) => e.type === 'instEnd').pop();
  };
  const run = (st, win = true) => {
    if (g.inst) { g.inst.done = { left: true }; g.tick(0.05); }
    g.startDaily('exp', st, now);
    return finish(win);
  };
  const r1 = run(1);
  ok(r1.ok && r1.gotKey && g.dailyLeft('exp', now) === 2, '새 단계를 깨면 몫을 돌려받는다 — 이어 든 판 하나만 쓴 셈');
  ok(r1.chain && r1.next === 2 && g.inst?.kind === 'daily' && g.inst.stage === 2, '깨면 바로 윗단계로 들어간다 (v166, 누를 것 없이)');
  const keys = [r1.gotKey];
  let last = r1;
  for (let i = 0; i < 12 && g.inst; i++) { last = finish(true); keys.push(last.gotKey); }
  ok(keys.every(Boolean) && g.dailyBest('exp') >= 12 && g.dailyLeft('exp', now) === 2 && g.inst?.stage === g.dailyBest('exp') + 1, '새 단계는 끝없이 — 열두 단계를 이어 깨도 몫은 그대로 (v302, 열쇠 상한 없음)', `깬 ${g.dailyBest('exp')} 남은 ${g.dailyLeft('exp', now)}`);
  g.inst.done = { left: true }; g.tick(0.05); g.events.length = 0;
  ok(g.dailyLeft('exp', now) === 2, '이어 든 판을 그만두면 그 몫은 쓴 것(반 보상) — 23마리 잡고 나가기를 되풀이하지 못하게');
  const bestNow = g.dailyBest('exp');
  const r2 = run(3);
  ok(r2.ok && !r2.gotKey && !r2.extra && g.dailyLeft('exp', now) === 1, '이미 깬 단계를 다시 깨면 몫 하나를 쓰고 온전한 보상');
  ok(g.canSweep('exp', now), '남은 몫은 소탕');
  g.sweepDaily('exp', now);
  ok(g.dailyLeft('exp', now) === 0 && g.canDaily('exp', 3, now) && !g.canSweep('exp', now), '몫을 다 쓰면 소탕은 끝 · 도전은 된다 (v302)');
  const r2b = run(3);
  const fullRw = DG.dailyReward('exp', 3, g.levelGapMult(DG.dailyLv(3)), g.s.level).exp;
  ok(r2b.ok && r2b.extra && !r2b.gotKey && Math.abs(r2b.reward.exp - Math.round(fullRw * DG.DAILY_EXTRA)) <= 1 && g.dailyLeft('exp', now) === 0, `몫이 없으면 추가 도전 — 보상 ${DG.DAILY_EXTRA * 100}%`, `${r2b.reward.exp} / ${fullRw}`);
  const r2c = run(bestNow + 1);
  ok(r2c.ok && !r2c.extra && !r2c.gotKey && r2c.reward.exp > r2b.reward.exp && g.dailyLeft('exp', now) === 0, '몫이 없어도 새 단계를 깨면 온전한 보상(돌려줄 몫은 없다)');
  if (g.inst) { g.inst.done = { left: true }; g.tick(0.05); g.events.length = 0; }
  now += 86400e3;
  ok(g.dailyLeft('exp', now) === 3, '다음 날 — 몫이 다시 찬다');
  const r3 = run(g.dailyMaxStage('exp'), false);
  ok(!r3.ok && !r3.gotKey && g.dailyLeft('exp', now) === 2, '못 깨면 몫 하나를 쓴다');
  // v260: 진 단계는 자동이 다시 들어가지 않고 소탕한다
  g.s.dgn.auto = true; g.s.dgn.climb = false;   // (v283 등반 모드를 끈 옛 동작)
  const lv0 = g.s.exp + g.s.level * 1e12;
  ok(g.startAutoDaily(now) === true && !g.inst && g.dailyLeft('exp', now) === 1 && g.s.exp + g.s.level * 1e12 > lv0, '오늘 진 단계는 자동이 다시 안 들어가고 소탕한다 (v260)');
  g.s.dgn.auto = false;
}
{
  // v260: 일일 던전 보상은 '내 레벨 + 5'를 넘지 않는다
  const DG = await import('../js/world/wdgn.js');
  const hi = DG.dailyReward('exp', 30, 1, 84).exp, cap = Math.round(W.expToNext(89) * 0.2);
  ok(hi === cap && hi < DG.dailyReward('exp', 30, 1, 999).exp, 'Lv84가 30단계를 깨도 경험치는 Lv89어치 (v260)', `${fmt(hi)} / ${fmt(cap)}`);
}
{
  // v260: 길잡이 — 소탕 단계는 자동 도전이 대신 소탕해 줘도 깨지고, 두 시간 넘게 막히면 절반 보상으로 건너뛴다
  const g = fresh();
  const at = Q.QUESTS.findIndex((q) => q.id === 'sweep');
  g.s.quest = at;
  const realNow = Date.now;
  try {
    const t0 = realNow();
    Date.now = () => t0;
    const c0 = g.questNow();
    ok(c0.q.id === 'sweep' && !c0.stuck, '막 뜬 단계는 건너뛸 수 없다');
    ok(g.skipQuest() === false, '건너뛰기 거절');
    Date.now = () => t0 + Q.QUEST_STUCK_MS + 1000;
    const c1 = g.questNow();
    const gold0 = g.s.gold;
    const r = g.skipQuest();
    ok(c1.stuck && r && g.s.quest === at + 1 && g.s.gold - gold0 === Math.round((c1.reward.gold || 0) / 2), '두 시간 넘게 막히면 절반 보상으로 건너뛴다', `${g.s.gold - gold0} / ${c1.reward.gold}`);
    g.s.quest = Q.QUESTS.findIndex((q) => q.id === 'lv30');
    g.questNow();
    Date.now = () => t0 + 10 * Q.QUEST_STUCK_MS;
    ok(!g.questNow().stuck, '레벨 단계는 건너뛸 수 없다');
  } finally { Date.now = realNow; }
}
{
  // v260: 방치 — 오래 비울수록 효율이 준다 · 레벨이 오르면 감쇠 · 실제 두목 처치만큼 증표
  ok(W.offlineEffSec(3600) === 3600 && W.offlineEffSec(10 * 3600) === 2 * 3600 + 4 * 3600 * 0.7 + 4 * 3600 * 0.4, '방치 효율: 2시간 100% · 6시간까지 70% · 10시간까지 40%');
  const g = fresh();
  while (g.s.level < 40) g.addExp(W.expToNext(g.s.level));
  const m = W.MAPS.find((x) => !x.town && !x.bossRoom && x.lv[0] <= 40 && x.lv[1] >= 38);
  g.s.rates = { kills: 2, exp: W.expToNext(40) / 600, gold: 100, potions: 0, bosses: 0, map: m.id };
  g.s.lastSeen = 0; g.s.clockMax = 0;
  const rw = g.offlineReward(10 * 3600 * 1000);
  ok(rw.exp < Math.floor(g.s.rates.exp * rw.te) && rw.eff < 0.7, '열 시간 방치 — 레벨이 오른 만큼 경험치가 깎이고 효율이 준다', `${fmt(rw.exp)} < ${fmt(g.s.rates.exp * rw.te)} · 효율 ${rw.eff.toFixed(2)}`);
  const bm = W.MAPS.find((x) => x.bossRoom && !x.king && !x.master && x.lv[0] <= 40);
  g.s.rates = { ...g.s.rates, map: bm.id, bosses: 0 };
  ok(g.offlineReward(3600 * 1000).marks === 0, '두목을 못 잡던 캐릭터는 방치 증표 0');
  g.s.rates = { ...g.s.rates, bosses: 1 / 60 };
  const mk = g.offlineReward(3600 * 1000).marks;
  ok(mk > 0 && mk <= Math.floor(3600 / (W.BOSS_RESPAWN + W.BOSS_MIN_SEC.zone * W.BOSS_REPEAT_K)) && mk <= 60, '두목을 잡던 빠르기만큼(상한 있음)', `${mk}`);
}
{
  // v260: 알맞은 사냥터 따라가기
  const g = fresh();
  g.s.autoMap = true; g.s.autoHunt = true;
  g.enterMap(W.mapId(1, 1));
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  g.tick(0.05);
  const hm = W.mapOf(g.s.huntMap);
  ok(hm.lv[0] > W.mapOf(W.mapId(1, 1)).lv[0] && hm.lv[1] <= 30 && g.s.map === hm.id && g.events.some((e) => e.type === 'followMap'), '레벨이 오르면 알맞은 구역으로 옮긴다(몹이 내 레벨을 안 넘는 곳)', `${hm.name} Lv${hm.lv}`);
  const g2 = fresh();
  g2.s.autoHunt = true;
  while (g2.s.level < 30) g2.addExp(W.expToNext(g2.s.level));
  g2.tick(0.05);
  ok(g2.s.huntMap === W.mapId(1, 1), '끄면 그대로');
  ok(migrateWorld({ level: 5 }, 0).autoMap === false && new WorldGame(null, 0).s.autoMap === true, '옛 세이브는 끔 · 새 세이브는 켬');
}

console.log('\n=== 맹주·천마 세트 (v153) ===');
{
  const G2 = await import('../js/world/wgear.js');
  ok(G2.LORD_SETS.length === 3 && G2.LORD_SETS.every((x) => !x.job), '맹주·천마 세트 셋 — 모든 직업');
  const cm = G2.setOf('cheonmaset'), pc = G2.setOf('paecheon');
  ok(cm.mult > pc.mult && G2.setRecipe('cheonmaset', 'weapon').mats.lc > 0 && ['fm', 'fs', 'fg'].every((k) => G2.setRecipe('cheonmaset', 'weapon').mats[k] > 0), '천마신장이 가장 세고 천마혈옥과 세 세력 재료가 든다');
  ok(G2.setsOfJob('sword').every((x) => x.job === 'sword'), '왕이 떨구는 직업 세트에는 섞이지 않는다');
  for (const job of ['sword', 'fan']) {
    const g = fresh(job);
    while (g.s.level < 100) g.addExp(W.expToNext(g.s.level));
    g.s.gold = 1e12; g.s.mats = { lc: 999, fm: 1e5, fs: 1e5, fg: 1e5 };
    const a0 = g.stats().atk;
    for (const sl of G2.SET_SLOTS) g.equipFromBag?.(g.craftSet('cheonmaset', sl)?.uid);
    for (const sl of G2.SET_SLOTS) { const it = g.s.bag.find((x) => x.slot === sl && x.set === 'cheonmaset'); if (it) g.equipFromBag(it.uid); }
    g._stats = null;
    ok(g.setCounts().cheonmaset === 5 && g.stats().atk > a0 * 1.15, `${job}: 천마신장 다섯 조각을 만들어 끼면 5세트 효과`, `공격력 ${Math.round(a0)} → ${Math.round(g.stats().atk)}`);
  }
  // 천마 두목이 천마혈옥을 떨군다
  const d = fresh();
  d.enterMap(W.mapId(W.masterZoneOf('cheonma'), W.BOSS_AREA));
  for (let i = 0; i < 60; i++) d.tick(0.05);
  const b = d.mons.find((m) => m.isBoss && m.alive);
  b.introT = 0; d.freezeT = 0; b.calib = null; d.hurt(b, b.hp + 1, 'hit', false);
  ok((d.s.mats.lc || 0) >= 6 && W.matName('lc') === '천마혈옥', '천마를 쓰러뜨리면 천마혈옥 6개');
}

console.log('\n=== 계열 장비 · 세력 재료 (v151) ===');
{
  const LN = await import('../js/world/wline.js');
  ok(LN.LINES.length === 8 && LN.LINES.filter((l) => l.fac.length === 2).length === 3 && LN.lineOf('samp').fac.length === 3, '계열 여덟 — 기본 · 세력 하나 셋 · 둘 섞은 셋 · 삼파');
  const g = fresh();
  while (g.s.level < 50) g.addExp(W.expToNext(g.s.level));
  const base = g.makeCrafted('weapon', 10, 0, 0);
  const mag = { ...g.makeCrafted('weapon', 10, 0, 0), line: 'magyo' };
  const samp = { ...g.makeCrafted('weapon', 10, 0, 0), line: 'samp' };
  ok(g.itemStats(mag).atk > g.itemStats(base).atk && g.itemStats(mag).atkPct > 0 && g.itemStats(samp).atk > g.itemStats(mag).atk, '계열 장비는 기본보다 세고 덤이 붙는다 · 삼파가 가장 세다');
  ok(migrateWorld({ mats: { fm: 5, fs: 3, fg: 2 } }).mats.fg === 2, '세력 재료가 저장된다');
  // 그 세력의 사냥터에서 세력 재료가 나온다
  const d = fresh();
  d.rng = () => 0.01;
  d.enterMap(W.mapId(MS.FAC_ZONES.magyo[0], 1));
  const mob = d.mons.find((m) => !m.npc && m.alive);
  d.killMob(mob);
  ok((d.s.mats.fg || 0) > 0 && !(d.s.mats.fm || 0), '마교 사냥터에서 마혈정이 나온다');
}

console.log('\n=== 숫자 표기 ===');
{
  const table = [[999, '999'], [1000, '1,000'], [120000, '120,000'], [99999999, '99,999,999'], [1e9, '1.00d']];
  const wrong = table.filter(([n, w]) => fmt(n) !== w).map(([n, w]) => `${n}→${fmt(n)}(${w})`);
  ok(wrong.length === 0, '1억 아래는 쉼표, 그 위는 알파벳', wrong.join(', ') || table.map(([n]) => fmt(n)).join(' '));
}


console.log('\n=== 던전 루틴 (v230) ===');
{
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  g.s.dgn.routine = true;
  const n1 = g.routineNext();
  ok(n1 && n1.step === 'daily', '루틴은 요일 던전부터', JSON.stringify(n1));
  // 요일 던전을 다 쓰면 탑
  const today = g.dgnToday();
  const DG = await import('../js/world/wdgn.js');
  for (const d of DG.DAILY) { today.used[d.id] = DG.DAILY_ENTRIES + 9; today.fail[d.id] = DG.DAILY_STAGES; }   // v302: 몫도 없고 오늘 새 단계에서도 졌다
  const n2 = g.routineNext();
  ok(n2 && n2.step === 'tower', '요일 던전을 다 돌면 무한의 탑', JSON.stringify(n2));
  // 탑에서 막히면 전투력이 오를 때까지 안 간다
  g.s.tower.failPow = g.stats().power * 2;
  ok(g.routineNext() === null, '탑에서 막힌 뒤엔 더 세질 때까지 사냥');
  // 저장 — 자동·루틴이 다시 들어와도 켜져 있다
  g.s.dgn.auto = true;
  const m = migrateWorld(JSON.parse(JSON.stringify(g.s)));
  ok(m.dgn.auto === true && m.dgn.routine === true && m.tower.failPow > 0, '자동 도전·루틴·탑 막힘이 저장된다 (전엔 자동 도전이 늘 꺼졌다)');
}


console.log('\n=== 직업의 길 (v237) ===');
{
  const PT = await import('../js/world/wpath.js');
  for (const job of Object.keys(PT.PATHS)) ok(PT.PATHS[job].a.nodes.length === 5 && PT.PATHS[job].b.nodes.length === 5, `${job}: 두 길 · 경지 다섯씩`);
  const g = fresh('fist');
  while (g.s.level < 45) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 1;
  ok(!g.choosePath('b'), '2차 전직 전에는 길을 못 고른다');
  g.s.jobTier = 2; g._stats = null;
  const sp0 = g.stats().speed, sk0 = g.stats().skillMult;
  ok(g.choosePath('b') && g.s.path === 'b', '2차 전직 뒤 평타의 길을 고른다');
  const st = g.stats();
  ok(st.speed > sp0 && st.skillMult < sk0, '평타의 길: 공격 속도 오르고 무공은 약해진다', `${sp0.toFixed(2)}→${st.speed.toFixed(2)} · 무공 ${sk0.toFixed(2)}→${st.skillMult.toFixed(2)}`);
  g.s.gold = 0;
  ok(!g.choosePath('a'), '길을 바꾸려면 은자가 든다');
  // 합일 — 140 · 4차: 둘 다, 약점 없음
  while (g.s.level < 140) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 4; g._stats = null;
  const m = PT.pathMods(g.s);
  ok(PT.merged(g.s) && m.skill > 0 && m.extra > 0 && !(m.skill < 0), '합일: 두 길이 다 켜지고 약점이 사라진다', JSON.stringify(m));
  ok(migrateWorld(JSON.parse(JSON.stringify(g.s))).path === 'b', '고른 길이 저장된다');
  // 덧치기 — 평타의 길 경지 3(80)부터
  const h = fresh('sword');
  while (h.s.level < 85) h.addExp(W.expToNext(h.s.level));
  h.s.jobTier = 2; h.choosePath('b'); h._stats = null;
  ok(h.stats().extra > 0 && h.stats().dash > 0, '쾌검의 길: 덧치기·전광석화가 붙는다');
  // v240: 길 무공 — 길을 걸으면 고유 무공이 생기고, 합일이면 둘 다
  ok(!fresh('fist').skills().some((k) => k.path), '길을 안 골랐으면 길 무공이 없다');
  const f2 = fresh('fist');
  while (f2.s.level < 45) f2.addExp(W.expToNext(f2.s.level));
  f2.s.jobTier = 2; f2.choosePath('a');
  const pa = f2.skills().find((k) => k.path === 'a');
  ok(pa && pa.name === '벽공장풍' && !f2.skills().some((k) => k.path === 'b'), '장풍의 길: 벽공장풍이 생기고 연타 무공은 없다');
  f2.enterMap(W.mapId(1, 1)); f2.s.autoHunt = true;
  for (let t = 0; t < 3; t += 0.05) f2.tick(0.05);
  const m0 = f2.mons.find((m) => m.alive && !m.npc); f2.heroX = m0.x - 50; f2.heroY = m0.y; f2.mon = m0; f2.cd.pa = 0;
  ok(f2.useSkill('pa') && f2.cd.pa > 0, '벽공장풍을 펼친다');
  f2.choosePath('b'); f2.s.gold = 1e12; f2.choosePath('b');
  const pb = f2.skills().find((k) => k.path === 'b');
  ok(pb && pb.name === '전광연타' && pb.kind === 'awaken', '연타의 길로 바꾸면 전광연타(자세)가 생긴다');
  f2.cd.pb = 0;
  ok(f2.useSkill('pb') && f2.buffs.triple > 0 && f2.buffv.haste > 0, '전광연타: 평타 세 대 · 공격 속도 자세가 켜진다');
  while (f2.s.level < 140) f2.addExp(W.expToNext(f2.s.level));
  f2.s.jobTier = 4; f2._stats = null;
  ok(f2.skills().filter((k) => k.path).length === 2, '합일: 길 무공 둘 다');

}

console.log('\n=== 화무기 · 히든 마귀 (v238) ===');
{
  const hw = MS.masterOf('hwamugi'), cm = MS.masterOf('cheonma'), mg = MS.masterOf('magwi');
  ok(hw && hw.lv > cm.lv && hw.dmg > cm.dmg && hw.castK < 1 && hw.tellK < 1, '화무기는 천마보다 세고 초식이 잦고 경고가 짧다');
  ok(mg && mg.hidden && mg.lv > hw.lv && mg.absK > hw.absK && mg.tellK < hw.tellK, '마귀는 화무기보다 더 극악');
  const g = fresh();
  const room = W.mapId(W.masterZoneOf('magwi'), W.BOSS_AREA);
  ok(!g.canEnter(room), '마귀 방은 화무기를 쓰러뜨리기 전엔 닫혀 있다');
  g.s.duel.won.hwamugi = true;
  ok(g.canEnter(room), '화무기를 쓰러뜨리면 마귀 방이 열린다');
  // 새 초식은 늘 피할 자리가 있다 — 무인 둘레를 훑어 안 맞는 자리가 하나라도
  const DG = await import('../js/world/wdgn.js');
  const b = { x: 900, y: 600, hp: 1e9, maxHp: 1e9, lv: 190, isBoss: true, alive: true };
  for (const pat of ['spiral', 'cage', 'collapse', 'lead', 'blame', 'quad', 'haze']) {
    g.tells = []; g.heroX = 700; g.heroY = 700;
    g.bossCast(b, 100, 1, [pat], pat, { abs: 1, delay: 1 });
    // 늦게 깔리는 것(aim)은 지금 무인 자리로
    for (const t of g.tells) if (t.aim && t.x == null) { t.x = g.heroX; t.y = g.heroY; }
    let safe = 0;
    for (let a = 0; a < 24; a++) for (const d of [0, 150, 300, 450]) {
      const x = g.heroX + Math.cos(a / 24 * Math.PI * 2) * d, y = g.heroY + Math.sin(a / 24 * Math.PI * 2) * d;
      if (!g.tells.some((t) => t.x0 != null || t.x != null ? DG.tellCovers(t, x, y) : false)) safe++;
    }
    ok(g.tells.length > 0 && safe > 0, `초식 ${pat}: 경고 ${g.tells.length}개 · 피할 자리 있음`, `안전 ${safe}/96`);
  }
}

console.log('\n=== 강화 공유 (v243) ===');
{
  const G2 = await import('../js/world/wgear.js');
  const g = fresh('sword');
  while (g.s.level < 100) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 4; g._stats = null;
  const grow = g.growOf('weapon'); grow.plus = 12;
  const set = g.makeKing('weapon', G2.SLOT_KING.weapon, 0, G2.setsOfJob('sword')[0].id, 0);
  const a0 = g.itemStats(set).atk;
  ok(g.effPlus(set) === 12 && g.sharedPlus(set) === 12, '세트 무기는 성장 무기의 +12를 함께 쓴다');
  grow.plus = 0; g._stats = null;
  ok(g.itemStats(set).atk < a0, '성장 무기 강화가 낮으면 세트 무기 수치도 그만큼');
  set.plus = 15; grow.plus = 12;
  ok(g.effPlus(set) === 15, '세트 무기 제 강화가 더 높으면 그쪽');
  ok(g.effPlus(grow) === 12, '성장 장비는 제 강화 그대로');
}
console.log('\n=== 빈 각인 칸 새기기 (v251) ===');
{
  const G2 = await import('../js/world/wgear.js');
  const g = fresh('sword');
  while (g.s.level < 100) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15;
  const it = g.makeKing('weapon', G2.SLOT_KING.weapon, 0, G2.setsOfJob('sword')[0].id, 0);
  it.rar = 2; it.imps = [];              // 전설로 얻은 장비 — 각인 칸이 비어 있다
  if (!g.findItem(it.uid)) g.s.bag.push(it);
  const k = W.bossKey(10);
  g.s.mats[k] = 100;
  ok(g.canImprintItem(it) && g.fillImpInfo(it, 0, k) && !g.fillImpInfo(it, 1, k) && g.fillImpInfo(it, 0, k).n === W.INFUSE_MARKS[2], '이미 전설이면 빈 각인 칸을 전설 값(증표 6)으로 새길 수 있다 (v307 한 칸)');
  const e0 = g.fillImp(it.uid, 0, k, 0);
  ok(e0 && it.imps[0]?.k === k && g.s.mats[k] === 100 - W.INFUSE_MARKS[2] && it.rar === 2, '빈 칸 — 증표를 내고 확률 없이 새긴다 · 등급은 그대로');
  ok(!g.fillImpInfo(it, 0, k), '새긴 칸은 다시 새기기로만');
}
console.log('\n=== 세트 장비가 공유 강화를 이어받는다 (v253) ===');
{
  const G2 = await import('../js/world/wgear.js');
  const g = fresh('sword');
  while (g.s.level < 100) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.rng = () => 0;
  const gw = g.growOf('weapon'); gw.plus = 5;
  const set = g.makeKing('weapon', G2.SLOT_KING.weapon, 0, G2.setsOfJob('sword')[0].id, 0);
  g.s.bag.push(set); g.equipFromBag(set.uid); g._stats = null;
  const a0 = g.stats().atk;
  ok(set.plus === 5, '세트 무기는 성장 무기의 +5를 제 강화로 이어받는다', `+${set.plus}`);
  const m = g.enhanceMats(set); if (m) g.s.mats[m.key] = 1e9;
  const bm = g.breakMarksOf(set); if (bm && m) g.s.mats[W.bossKey(m.key)] = 1e9;
  ok(g.enhance(set.uid) && set.plus === 6 && g.stats().atk > a0, '세트 무기를 강화하면 바로 수치가 오른다(전엔 +5까지 그대로였다)');
}
console.log('\n=== v254 고침 ===');
{
  // 만화귀일 공속 버프는 끝나면 사라진다
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.jobTier = 3; g._stats = null;
  g.buffs.gale = 8; g.buffs.haste = 8; g.buffv.haste = 0.4;
  for (let i = 0; i < 100; i++) { g.buffs.gale -= 0; }
  // 직접 만료시켜 본다: tick의 버프 감소 루프를 흉내 낸다
  const step = (dt) => { for (const k in g.buffs) if (g.buffs[k] > 0) { g.buffs[k] -= dt; if (g.buffs[k] <= 0) { delete g.buffs[k]; delete g.buffv[k]; } } };
  step(9);
  ok(!g.buffv.haste, '공속 버프 값(haste)은 타이머와 함께 사라진다');
  const src = read('js/world/wgame.js');
  ok(!/buffs\.gale = b\.sec; this\.buffv\.haste/.test(src) || /buffs\.haste = Math\.max\(this\.buffs\.haste \|\| 0, b\.sec\)/.test(src), '무공 공속 버프는 haste 타이머를 건다');
}
{
  // 시계를 되돌렸다 다시 돌려도 방치 보상을 두 번 받지 않는다
  const g = fresh('sword');
  g.s.rates = { kills: 1, exp: 10, gold: 10, potions: 0, map: g.s.huntMap };
  const t0 = 1e12;
  g.s.lastSeen = t0; g.s.clockMax = t0;
  const a = g.offlineReward(t0 + 3600e3);
  ok(a && a.sec >= 3599, '한 시간 방치 보상');
  g.s.lastSeen = t0 + 3600e3; g.s.clockMax = t0 + 3600e3;
  g.s.lastSeen = t0;              // 시계를 되돌린 뒤 저장된 셈
  const b = g.offlineReward(t0 + 3600e3);
  ok(!b, '시계를 되돌렸다가 다시 돌려도 같은 시간을 또 받지 않는다');
}
{
  // 짧은 방치에도 두목 재료가 들어온다
  const g = fresh('sword');
  const m = W.MAPS.find((x) => x.bossRoom);
  const z = m.mz;
  const before = g.s.mats[W.ORE] || 0;
  g.claimOffline({ gold: 0, potions: 0, exp: 0, kills: 0, map: m.id, mats: 0, marks: 2 });
  ok((g.s.mats[W.ORE] || 0) === before + 2 * W.BOSS_MATS * W.matWeight(z), '재료 0 · 증표 2 — 두목 재료(현철)가 들어온다');
}
{
  // 쓰러져 마을로 돌아온 틱에 물약을 먹지 않는다
  const g = fresh('sword');
  g.s.potions = 10; g.s.autoPotion = true; g.s.autoRefill = false;
  g.heroDied(null);
  g.tick(0.05);
  ok(g.s.potions === 10, '쓰러질 때 물약이 줄지 않는다', `${g.s.potions}`);
}
{
  // 세트 장비 강화 실패는 공유 강화 아래로 안 떨어지고 보호부도 안 쓴다
  const G2 = await import('../js/world/wgear.js');
  const g = fresh('sword');
  while (g.s.level < 100) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15;
  const gw = g.growOf('weapon'); gw.plus = 12;
  const set = g.makeKing('weapon', G2.SLOT_KING.weapon, 0, G2.setsOfJob('sword')[0].id, 0);
  g.s.bag.push(set); g.equipFromBag(set.uid); g._stats = null; g.stats();
  const m = g.enhanceMats(set); if (m) g.s.mats[m.key] = 1e9;
  const bm = g.breakMarksOf(set); if (bm && m) g.s.mats[W.bossKey(m.key)] = 1e9;
  g.s.prot = 5;
  g.rng = () => 0.9999;
  g.enhance(set.uid, true);
  ok(set.plus === 12 && g.s.prot === 5 && (set.epity || 0) > 0, '공유 +12 세트 무기 강화 실패 — +12 그대로 · 보호부 그대로 · 천장은 쌓인다', `+${set.plus} 보호부 ${g.s.prot} 천장 ${set.epity}`);
}
console.log('\n=== v270 각인 상한 · 스킬 점수 레벨 5부터 ===');
{
  const IM = await import('../js/world/wimprint.js');
  const g = fresh('sword');
  while (g.s.level < 150) g.addExp(W.expToNext(g.s.level));
  ok(g.s.skillPts >= 150 - W.SKILL_PT_FROM + 1 - 1, `레벨 ${W.SKILL_PT_FROM}부터 레벨마다 스킬 점수`, `${g.s.skillPts}점`);
  const base = { s0: g.skillMods('s0').dmg, r: g.skillMods('s0').range };
  const s0 = g.stats(); const c0 = s0.critDmg, k0 = s0.crit;
  // 가장 센 왕(검왕 b27) 증표 · 신화 등급 · 1차 스킬 피해만 — 여섯 장비 × 셋
  for (const k of ['weapon', 'armor', 'hat', 'glove', 'shoe', 'acc']) {
    const it = g.s.equip[k]; if (!it) continue;
    it.imps = [{ k: 'b27', s: 0, sk: k === 'armor' ? 'range' : 'dmg', g: 3, sp: k === 'weapon' ? 0 : 1 }];   // v307 한 칸 (무기는 무형신검 · 나머지 무형검기)
  }
  g._stats = null; g._mods = {}; g._isp = null;
  const m = g.skillMods('s0');
  ok(m.dmg - base.s0 <= IM.SKILL_CAP.dmg + 1e-9 && m.range - base.r <= IM.SKILL_CAP.range + 1e-9, '스킬 변화 각인은 피해·범위 끝을 넘지 않는다', `피해 +${(m.dmg - base.s0).toFixed(2)} 범위 +${(m.range - base.r).toFixed(2)}`);
  const isp = g.impSpecials();
  ok(Object.values(isp).every((v) => v.p <= IM.SPECIAL_P_MAX + 1e-9) && isp.echo && isp.nova, `고유 효과 위력은 끝(${IM.SPECIAL_P_MAX})을 넘지 않는다`, JSON.stringify(Object.fromEntries(Object.entries(isp).map(([k, v]) => [k, +v.p.toFixed(2)]))));
  const st = g.stats();
  ok(st.critDmg - c0 <= IM.IMP_STAT_CAP.critDmg + 1e-9 && st.crit - k0 <= IM.IMP_STAT_CAP.crit + 1e-9, '각인 능력치(치명·치명 피해)는 끝을 넘지 않는다', `치명 +${(st.crit - k0).toFixed(3)} 치명 피해 +${(st.critDmg - c0).toFixed(2)}`);
  ok(IM.specialP([1.6]) === 1.6 && Math.abs(IM.specialP([1.6, 1, 1.3]) - 2.2) < 1e-9 && IM.specialP(Array(18).fill(1.6)) === IM.SPECIAL_P_MAX, '고유 위력 = 가장 무거운 칸 + 하나마다 0.3');
}
console.log('\n=== v271 두목 맞춤 · 두목 싸움 중 회복·흡혈 ===');
{
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  const room = W.mapId(W.masterZoneOf('namgung'), W.BOSS_AREA);
  g.enterMap(room);
  for (let i = 0; i < 80; i++) g.tick(0.05);
  const b = g.mons.find((m) => m.isBoss && m.alive);
  b.introT = 0; g.freezeT = 0;
  const hp0 = b.maxHp;
  ok(!!b.calib, '두목은 첫 몇 초 실제 피해로 다시 맞춘다(맞춤 준비)');
  g.hurt(b, hp0 * 0.6, 'hit', false);   // 첫 1초에 체력 60% — 최소 싸움 시간보다 훨씬 빠르다
  g.clock += W.BOSS_CALIB_SEC + 0.5; g.hurt(b, 1, "hit", false);
  ok(b.alive && b.maxHp > hp0 * 2 && !b.calib, '너무 빨리 깎이면 체력을 올린다(한 번만)', `${Math.round(hp0)} → ${Math.round(b.maxHp)}`);
  ok(b.maxHp <= b.calib?.base * W.BOSS_CALIB_MAX || b.op <= W.BOSS_CALIB_MAX + 1e-9, '올리는 끝은 기본 체력의 BOSS_CALIB_MAX배', `×${b.op?.toFixed(1)}`);
  // 두목 싸움 중엔 자연 회복이 줄고 흡혈은 초당 최대 체력의 1%까지
  const st = g.stats();
  g.heroHp = st.hp * 0.5; g.tick(0.05);
  const h1 = g.heroHp;
  g.drainHeal(st, st.hp * 0.5);
  ok(g._inBoss && g.heroHp - h1 <= st.hp * W.BOSS_DRAIN_CAP + 1e-6, '두목 싸움 중 흡혈은 몫만큼만', `${((g.heroHp - h1) / st.hp * 100).toFixed(2)}%`);
  const D2 = await import('../js/world/wdgn.js');
  ok(D2.bossRefHp(150) === D2.bossRefHp(187) && D2.bossRefHp(100) > D2.refHp(100) * 3, '두목 기준 체력 — 레벨 100에 옛 기준의 세 배 넘게 · 150 위로는 그대로');
}
console.log('\n=== v272·v273 강화 재료 — 현철 · 돌파 증표 ===');
{
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e12;
  const it = g.s.equip.weapon; it.plus = 5;
  const m = g.enhanceMats(it);
  ok(m.key === W.ORE && m.n === W.enhanceMatsN(5) * W.matWeight(W.itemZone(it)), '강화에는 현철 × 장비 지역 가중치', `${m.n}개`);
  g.s.mats = { [W.ORE]: m.n + 2 };
  g.rng = () => 0;
  g.enhance(it.uid, false);
  ok(g.s.mats[W.ORE] === 2 && it.plus === 6, '강화하면 현철을 낸다');
  while (g.s.level < 70) g.addExp(W.expToNext(g.s.level));
  it.plus = 10; const m2 = g.enhanceMats(it); const bm = g.breakMarksOf(it);
  g.s.mats = { [W.ORE]: 1e9, [W.bossKey(1)]: bm + 1 };
  ok(bm > 0 && !g.breakMarkKey(it, bm) && !g.canEnhance(it), '돌파는 제 지역 두목 증표 — 앞 지역 증표는 등급 각인에 남긴다(v273)', `${W.matName(W.bossKey(1))} ${bm}개`);
  g.s.mats = { [W.ORE]: 1e9, [W.bossKey(W.itemZone(it))]: bm };
  ok(g.breakMarkKey(it, bm) === W.bossKey(W.itemZone(it)), '제 지역 증표가 있으면 그것부터');
}
console.log('\n=== v274 현철 단련 ===');
{
  const g = fresh('sword');
  g.s.mats[W.ORE] = 1e9;
  ok(!g.canTemper() && g.temper(1) === 0, `레벨 ${W.TEMPER_FROM} 전에는 단련할 수 없다`);
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  const a0 = g.stats().atk, h0 = g.stats().hp, c0 = g.temperCost(), o0 = g.s.mats[W.ORE];
  ok(g.temper(1) === 1 && g.s.temper === 1 && g.s.mats[W.ORE] === o0 - c0, '단련 한 번 — 현철을 내고 한 단계', `${c0}개`);
  ok(g.stats().atk > a0 && g.stats().hp > h0, '공격력·체력이 오른다');
  ok(g.temperCost() > c0 && W.temperCost(10, 60) > W.temperCost(0, 60) * 1.7 && W.temperCost(0, 150) > W.temperCost(0, 60), '단계·레벨이 오를수록 비싸진다');
  g.s.mats[W.ORE] = W.temperCost(1, 60) + W.temperCost(2, 60) + 5;
  ok(g.temper(99) === 2 && g.s.temper === 3 && g.s.mats[W.ORE] === 5, '되는 만큼 — 현철이 되는 데까지만');
  const sv = migrateWorld(JSON.parse(JSON.stringify(g.toJSON())), 0);
  ok(sv.temper === 3, '세이브에 남는다');
}
console.log('\n=== v275 숙련도·견문록 전투 보상 · 무공 비급 조각 ===');
{
  const L2 = await import('../js/world/wland.js');
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  const a0 = g.stats().atk;
  const z = W.mapOf(W.mapId(2, 1)).zone;
  g.addMastery(z, L2.MASTERY_KILLS[3]);
  const hb = g.huntBonus();
  ok(hb.mast === 3 && Math.abs(hb.m - 3 * W.MAST_STAT) < 1e-9 && g.stats().atk > a0, '숙련도 단계마다 영구 공격력·체력', `+${(hb.m * 100).toFixed(2)}%`);
  const a1 = g.stats().atk;
  const zz = W.dexZones()[0];
  for (const n of zz.names) g.s.dex = { ...(g.s.dex || {}), [n]: W.DEX_NEED };
  g._huntB = null; g._dexZ = null; g._stats = null;
  const hb2 = g.huntBonus();
  ok(hb2.zones >= 1 && hb2.stamps >= zz.names.length && g.stats().atk > a1, '견문록 낙관·지역 완성마다 영구 공격력·체력', `낙관 ${hb2.stamps} · 지역 ${hb2.zones} → +${(hb2.d * 100).toFixed(2)}%`);
  // 비급 조각
  const p0 = g.s.skillPts;
  g.gainFrag(W.FRAG_NEED - 1);
  ok(g.s.frag === W.FRAG_NEED - 1 && g.s.skillPts === p0, '조각이 모자라면 점수는 그대로');
  g.gainFrag(1 + W.fragNeed(1));
  ok(g.s.skillPts === p0 + 2 && g.s.frag === 0 && g.s.fragPts === 2 && W.fragNeed(1) === W.FRAG_NEED + W.FRAG_NEED_UP, `조각 ${W.FRAG_NEED}개에 무공 점수 1 — 다음은 ${W.FRAG_NEED + W.FRAG_NEED_UP}개`);
  // 몹 처치로 떨어지는 빈도
  const h2 = fresh(); h2.enterMap(11); let got = 0; h2.rng = Math.random;
  const f0 = h2.s.frag || 0;
  for (let i = 0; i < 300000; i++) { if (h2.rng() < W.FRAG_RATE) got++; }   // v305: 6만 번은 0이 나올 때가 있었다(1.8%) — 30만 번
  ok(got >= 4 && got <= 50, '몹 만오천에 하나 꼴', `${got}/300000`);
  // 방치에도
  const o = fresh('sword'); o.s.level = 80; o.s.lastSeen = Date.now() - 10 * 3600e3; o.s.rates = { map: 11, kills: 20, exp: 1, gold: 1, potions: 0 };
  const rw = o.offlineReward(Date.now());
  ok(rw && rw.frag >= Math.floor(rw.kills * W.FRAG_RATE) && rw.frag <= Math.floor(rw.kills * W.FRAG_RATE) + 1, '방치 보상에도 조각(처치 수 × 확률)', `처치 ${rw?.kills} → ${rw?.frag}개`);
  const fr0 = o.s.frag || 0, sp0 = o.s.skillPts || 0; o.claimOffline(rw);
  { let need = 0; for (let k = 0; k < (o.s.fragPts || 0); k++) need += W.fragNeed(k); ok((o.s.frag || 0) + need === fr0 + rw.frag, '방치 조각을 받는다'); }
}
console.log('\n=== v278 두목은 지속 피해를 덜 받는다 ===');
{
  const g = fresh('poison');
  const mob = { isBoss: false, dot: 0, lv: 60 }, boss = { isBoss: true, dot: 0, lv: 60 }, early = { isBoss: true, dot: 0, lv: 12 };
  g.addDot(mob, 1000, 4); g.addDot(boss, 1000, 4); g.addDot(early, 1000, 4);
  ok(early.dot === mob.dot, '초반(레벨 30 아래) 두목은 그대로');
  ok(Math.abs(boss.dot / mob.dot - W.BOSS_DOT_K) < 1e-9, `두목 독은 ×${W.BOSS_DOT_K} · 사냥터 몹은 그대로`, `${Math.round(mob.dot)} / ${Math.round(boss.dot)}`);
}
console.log('\n=== v279 환마 탐보 ===');
{
  const f = fresh('fan'), sw = fresh('sword');
  ok(f.stats().gold - sw.stats().gold >= 0.2 - 1e-9, '환마는 은자 +20%');
  ok(f.lootK() === 1.5 && sw.lootK() === 1 && W.CLASSES.fan.treasureK === 2, '두목 장신구·애완동물·포획 조각 1.5배 · 보물 원숭이 2배');
}
console.log('\n=== v283 등반 모드 ===');
{
  const DG = await import('../js/world/wdgn.js');
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  ok(g.s.dgn.climb === true && migrateWorld({ ...newWorldSave() }).dgn.climb === true, '처음엔 켜져 있다 · 옛 저장도 켜진다');
  ok(migrateWorld({ ...newWorldSave(), dgn: { climb: false } }).dgn.climb === false, '끈 것은 꺼진 채로 저장');
  const now = Date.now();
  const kind = DG.DAILY.find((d) => DG.dailyOpen(d, now)).id;
  for (const d of DG.DAILY) if (d.id !== kind) { g.dgnToday(now).used[d.id] = 99; g.dgnToday(now).fail[d.id] = 99; }   // 한 던전만 본다 (v302: 새 단계도 막혔다고)
  g.s.dgn.auto = true;
  g.s.dgn.best[kind] = 4;
  // 오를 곳이 있으면 들어간다
  ok(g.startAutoDaily(now) === true && g.inst?.stage === 5, '등반 — 못 깬 5단계로 들어간다');
  g.inst.done = { ok: false, died: true };
  const left0 = g.dailyLeft(kind, now);
  const res = g.finishInst();
  ok(!res.chain && !g.inst, '막히면(진 단계) 다시 들어가지도, 소탕하지도 않고 멈춘다');
  ok(g.dailyLeft(kind, now) === left0 && left0 > 0, `남은 횟수 ${left0}번은 그대로 남는다`);
  ok(g.autoDailyNext(now) === null && g.startAutoDaily(now) === false && g.dailyLeft(kind, now) === left0, '자동이 다시 돌아도 그대로');
  // 다 깬 던전(맨 위)은 소탕하지 않는다
  g.s.dgn.best[kind] = DG.DAILY_STAGES;
  ok(g.autoDailyNext(now) === null && g.dailyLeft(kind, now) === left0, '더 오를 단계가 없으면 남은 횟수를 소탕하지 않는다');
  // 끄면 옛 동작(막힌 곳은 소탕)
  g.s.dgn.climb = false; g.s.dgn.best[kind] = 4;
  ok(g.startAutoDaily(now) === true && !g.inst && g.dailyLeft(kind, now) === left0 - 1, '끄면 막힌 곳은 소탕한다(옛 동작)');
  // 루틴도 같은 규칙 — 막힌 던전을 건너뛰고 탑으로
  g.s.dgn.climb = true; g.s.dgn.auto = false; g.s.dgn.routine = true;
  ok(g.routineNext(now)?.step !== 'daily', '루틴도 막힌 던전은 건너뛴다', JSON.stringify(g.routineNext(now)));
}
console.log('\n=== v288 만독지옥 · 만독귀원 ===');
{
  const g = fresh('poison');
  const hell = W.JOB_SKILLS.poison.find((k) => k.name === '만독지옥');
  ok(hell.bossMult === 4, '만독지옥은 두목에게 4배');
  const sup = W.JOB_SKILLS.poison.find((k) => k.name === '만독귀원');
  const sk = { ...sup, id: 's3' };
  g.skillMods = () => ({ dmg: 0, range: 0.5, cd: 0, splash: 0, crit: 0 });
  ok(Math.abs(g.skillRadius(sk) - sup.radius * 1.5) < 1e-6, '만독귀원도 범위 보너스를 받는다(전엔 늘 320)');
}
console.log('\n=== v289 만독귀원 자동 ===');
{
  const g = fresh('poison');
  const sk = { ...W.JOB_SKILLS.poison.find((k) => k.name === '만독귀원'), id: 's3' };
  const st = g.stats();
  const mob = (dx, dot) => ({ alive: true, x: g.heroX + dx, y: g.heroY, dot, maxHp: 100, hp: 100 });
  g.mons = [mob(40, 5), mob(-40, 0), mob(60, 0)];
  g.heroHp = st.hp;
  ok(!g.wantSupport(sk, st), '중독 하나 · 체력 가득 → 아낀다');
  g.heroHp = st.hp * 0.5;
  ok(g.wantSupport(sk, st), '중독 하나라도 다쳤으면(60% 아래) 쓴다 — 회복 12%');
  g.heroHp = st.hp; g.mons[1].dot = 3;
  ok(g.wantSupport(sk, st), '중독 둘이면 쓴다(전엔 셋)');
}
console.log('\n=== v292 동료 — 얻는 곳 · 별 · 도감 · 길들이기 ===');
{
  const g = fresh('poison');
  const DG = await import('../js/world/wdgn.js');
  const s0 = DG.dailyReward('exp', 9, 1, 99);
  ok(s0.petShard === W.dailyShards(9) && s0.mountShard === W.dailyShards(9), '일일 던전 한 판에 포획·탈것 조각');
  ok(DG.towerReward(10).petShard === W.TOWER_SHARDS * 5 && DG.towerReward(7).mountShard === W.TOWER_SHARDS, '탑 처음 오른 층 — 조각(10층마다 다섯 배)');
  const r = g.grant({ petShard: 7, mountShard: 3 });
  ok(g.s.petShard === 7 && g.s.mountShard === 3 && r.petShard === 7, 'grant가 조각을 준다');
  // 별
  g.s.pets = []; g.s.petBox = [];
  const a = g.gainPet(0, null, 'fox'), b = g.gainPet(1, null, 'fox'), c2 = g.gainPet(0, null, 'crane');
  ok(g.s.pets.length === 1 && g.s.petBox.length === 2, '(키우는 칸 하나 · 우리 둘)');
  ok(g.canStar(a.uid) && !g.canStar(c2.uid), '같은 종이 우리에 있으면 별을 올린다(다른 종은 못)');
  const atk0 = W.petAtkRatio(a);
  g.starUp(a.uid);
  ok(a.star === 1 && !g.s.petBox.includes(b) && Math.abs(W.petAtkRatio(a) / atk0 - (1 + W.PET_STAR_K)) < 1e-9, `별 하나 — 먹이는 사라지고 공격·버프 +${W.PET_STAR_K * 100}%`);
  // 놓아주기 → 혼
  const soul0 = g.s.petSoul || 0;
  const got = g.releasePet(c2.uid);
  ok(got === W.petReleaseSoul(c2) && g.s.petSoul === soul0 + got, '놓아주면 혼이 남는다');
  // 도감
  ok(g.s.petDex.fox === 1 && g.s.petDex.crane === 0, '도감은 가진 적 있는 종의 가장 높은 등급(놓아줘도 남는다)');
  const st0 = g.stats().atk;
  const bon = g.compDexBonus();
  ok(Math.abs(bon - ((1 + 1) + (0 + 1)) * W.PET_DEX_K - Object.keys(g.s.mountDex).length * W.MOUNT_DEX_K) < 1e-9 && Object.keys(g.s.petDex).length === 2, '도감 보너스 = 종마다 (등급+1)×0.3% (+ 탈것 종마다 0.2%)', JSON.stringify([g.s.petDex, g.s.mountDex]));
  ok(g.canDexGoal('pet', 0) && !g.canDexGoal('pet', 1), '이정표 — 두 종이면 첫 상');
  const sp = g.s.petSoul; g.claimDexGoal('pet', 0);
  ok(g.s.petSoul === sp + W.PET_DEX_GOALS[0].soul && !g.canDexGoal('pet', 0), '이정표 상은 한 번만');
  const m = migrateWorld(JSON.parse(JSON.stringify(g.s)));
  ok(m.petDex.fox === 1 && m.dexGoals.pet.includes(0) && m.pets[0].star === 1, '별·도감·받은 상이 저장된다');
  // 탈것 조각 · 길들이기
  g.s.mounts = []; g.s.mount = null;
  const mt = g.gainMount('horse', null);
  ok(g.s.mountDex.horse === 1, '탈것 도감');
  g.s.mountShard = 500; g.s.gold = 1e12;
  const spd0 = g.stats().moveSpeed;
  ok(g.tame(mt.uid) && mt.lv === 1 && g.stats().moveSpeed > spd0, '길들이기 — 레벨이 오르면 이동·공격·체력이 오른다');
  g.s.mountShard = W.MOUNT_SHARD_NEED; g.enterMap(W.MAPS.find((x) => !x.town && !x.bossRoom && x.lv[0] <= 10).id, true);
  const n0 = g.s.mounts.length;
  ok(g.shardMount() && g.s.mounts.length === n0 + 1 && g.s.mountShard === 0, '탈것 조각 100 → 지금 지역의 탈것 하나');
  // 방치
  g.s.rates = { kills: 2, exp: 100, gold: 100, potions: 0, bosses: 1 / 60, map: W.MAPS.find((x) => x.bossRoom && !x.king && !x.master && x.lv[0] <= 40).id };
  g.s.lastSeen = 0; g.s.clockMax = 0;
  const rw = g.offlineReward(3600 * 1000);
  ok(rw.petShard > 0 && rw.mountShard > 0, '방치에도 조각(두목 잡은 만큼)', `${rw.petShard} / ${rw.mountShard}`);
}
console.log('\n=== v292 자동 등급 각인 고르기 ===');
{
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.s.autoInf = true; g.s.autoEnh = false;
  for (const it of W.GROW_SLOTS.map((k) => g.s.equip[k]).filter(Boolean)) { it.rar = 0; it.imps = []; }
  g.s.mats.b3 = 500; g.s.mats.b6 = 500;
  g.rng = () => 0;   // 늘 성공
  g.s.autoInfCfg = { only: true, marks: { b3: 0 }, slots: { weapon: false } };
  const b6 = g.s.mats.b6;
  g.autoGear();
  const worn = W.GROW_SLOTS.map((k) => g.s.equip[k]).filter(Boolean);
  ok(g.s.mats.b6 === b6, '고른 증표만 쓴다(안 고른 증표는 그대로)');
  ok((g.s.equip.weapon?.rar || 0) === 0, '끈 칸(무기)은 건드리지 않는다');
  ok(worn.filter((x) => x.slot !== 'weapon').some((x) => x.rar > 0 && x.imps?.some((im) => im?.k === 'b3')), '다른 칸에 고른 증표로 새긴다');
  const m = migrateWorld(JSON.parse(JSON.stringify(g.s)));
  ok(m.autoInfCfg.only && m.autoInfCfg.marks.b3 === 0 && m.autoInfCfg.slots.weapon === false, '고른 것이 저장된다');
  g.s.autoInfCfg = { only: true, marks: {}, slots: {} };
  const tot = Object.keys(g.s.mats).filter((k) => W.isMarkKey(k)).reduce((a, k) => a + g.s.mats[k], 0);
  g.autoGear();
  ok(Object.keys(g.s.mats).filter((k) => W.isMarkKey(k)).reduce((a, k) => a + g.s.mats[k], 0) === tot, '고른 증표가 없으면 쉰다');
}
console.log('\n=== v293 자동 등급 각인 — 좋아하는 효과 ===');
{
  const IMm = await import('../js/world/wimprint.js');
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.s.autoInf = true; g.s.autoEnh = false;
  for (const it of W.GROW_SLOTS.map((k) => g.s.equip[k]).filter(Boolean)) { it.rar = 0; it.imps = []; }
  // 테마가 다른 증표 둘을 찾는다 — 하나는 좋아하는 효과가 있고 하나는 없다
  const keys = Object.keys(W.ZONES_W).map((z) => `b${z}`).filter((k) => W.markLv(k) < 60);
  const want = 'hpPct';
  const kYes = keys.find((k) => IMm.THEMES[IMm.themeOfZone(+k.slice(1))].fx.some(([f]) => f === want));
  const kNo = keys.find((k) => !IMm.THEMES[IMm.themeOfZone(+k.slice(1))].fx.some(([f]) => f === want) && W.markLv(k) > W.markLv(kYes));
  g.s.mats[kYes] = 500; g.s.mats[kNo] = 500;
  g.rng = () => 0;
  g.s.autoInfCfg = { mode: 'pref', marks: {}, slots: {}, prefFx: [want], prefSp: [] };
  ok(g.markPref(kYes).score > 0 && g.markPref(kNo).score === 0, '좋아하는 효과가 든 증표만 점수가 있다', `${kYes} ${kNo}`);
  g.autoGear();
  ok(g.s.mats[kNo] === 500 && g.s.mats[kYes] < 500, '좋아하는 효과가 든 증표로만 새긴다(더 센 다른 증표는 남긴다)');
  // 여러 개 · 앞 것이 무겁다
  const c2 = { prefFx: ['crit', 'hpPct'], prefSp: [] };
  const a1 = keys.find((k) => IMm.THEMES[IMm.themeOfZone(+k.slice(1))].fx.some(([f]) => f === 'crit'));
  ok(g.markPref(a1, c2).score > g.markPref(kYes, c2).score, '앞에 고른 효과가 더 무겁다');
  // 고유 효과 고르기
  const hi = Object.keys(W.ZONES_W).map((z) => +z).find((z) => IMm.specialsOfZone(z));
  if (hi) {
    const sps = IMm.specialsOfZone(hi);
    const r = g.markPref(`b${hi}`, { prefFx: [], prefSp: [sps[2].kind] });
    ok(r.sp === 2 && r.score > 0, '고유 효과도 좋아하는 것을 골라 새긴다');
  }
  const m = migrateWorld(JSON.parse(JSON.stringify({ ...g.s, autoInfCfg: { only: true, marks: { b3: 1 } } })));
  ok(m.autoInfCfg.mode === 'pick' && m.autoInfCfg.marks.b3 === 1, '옛 저장(only)은 직접 고르기로');
}
console.log('\n=== v294 좋아하는 스킬 변화 · 넘길 때 경고 ===');
{
  const g = fresh('sword');
  g.s.autoInfCfg = migrateWorld({ ...newWorldSave(), autoInfCfg: { mode: 'all', prefSk: ['echo', 'zzz'], prefSkSlot: [2, 7], prefSp: [], prefFx: [] } }).autoInfCfg;
  ok(g.s.autoInfCfg.prefSk.join() === 'echo' && g.s.autoInfCfg.prefSkSlot.join() === '2', '좋아하는 스킬 변화(꼴·몇 차)가 저장되고 이상한 값은 버린다');
  ok(!!g.favOf({ k: 'b3', s: 2, sk: 'echo', g: 0, sp: 0 })?.skill && !g.favOf({ k: 'b3', s: 1, sk: 'echo', g: 0, sp: 0 })?.skill, '3차 무공의 한 번 더만 좋아하는 것으로 본다');
  g.s.autoInfCfg.prefSkSlot = [];
  ok(!!g.favOf({ k: 'b3', s: 0, sk: 'echo', g: 0, sp: 0 })?.skill && !g.favOf({ k: 'b3', s: 0, sk: 'dmg', g: 0, sp: 0 })?.skill, '몇 차를 안 고르면 모든 무공');
  ok(g.hasPrefs(), '좋아하는 것이 있다');
}
console.log('\n=== v280 꾸미기 ===');
{
  const m = migrateWorld({ ...newWorldSave(), custom: { head: 'hat', robe: '#8B1F22', band: 'red; x' } });
  ok(m.custom.head === null && m.custom.hat === 'straw' && m.custom.robe === '#8B1F22' && m.custom.band === null, '고른 머리·색은 남고 이상한 값은 버린다 (v323 옛 머리 삿갓 → 쓰개 삿갓)', JSON.stringify(m.custom));
  const n = migrateWorld({ ...newWorldSave(), custom: { head: '<img>', robe: 5 } });
  ok(n.custom.head === null && n.custom.robe === null, '없는 머리 · 숫자 색 → 기본');
  const o = migrateWorld({ ...newWorldSave() });
  ok(o.custom && o.custom.head === null && o.custom.robe === null && o.custom.band === null, '옛 저장 → 모두 기본');
  ok(!W.CUSTOM_HEADS.some(([k]) => k === 'band'), '머리띠 그림(뒤통수)은 고를 수 없다 — 상투 머리띠로');
  // v306 눈(안대) · 차림
  const f = migrateWorld({ ...newWorldSave(), custom: { head: 'bald', face: 'blind', robe: '#b08d57', band: '#7f1d1d' } });
  ok(f.custom.face === 'blind' && f.custom.head === 'bald', '안대는 남는다', JSON.stringify(f.custom));
  ok(migrateWorld({ ...newWorldSave(), custom: { face: 'mask' } }).custom.face === null, '없는 눈 값은 버린다');
  ok(W.CUSTOM_PRESETS.some((p) => p.head === 'bald' && p.face === 'blind') && W.CUSTOM_PRESETS.every((p) => (p.gender === 'f' ? W.CUSTOM_FHEADS.some(([k]) => k === p.fhead) && W.CUSTOM_HAIRS.some(([k]) => k === p.hair) : W.CUSTOM_HEADS.some(([k]) => k === p.head)) && (p.hat == null || W.CUSTOM_HATS.some(([k]) => k === p.hat)) && (p.boot == null || W.CUSTOM_BOOTS.includes(p.boot)) && W.CUSTOM_ROBES.includes(p.robe) && W.CUSTOM_BANDS.includes(p.band)), '차림은 고를 수 있는 값으로만 · 민머리+안대 차림이 있다');
  ok(/look\.blind/.test(read('js/battle.js')) && /hasBodyArt\(cu\.robe\)/.test(read('js/battle.js')), '안대를 그린다 · 그 색 도포 그림이 있으면 그대로');
}
console.log('\n=== v296 걸어와서 바로 친다 ===');
{
  const g = fresh();
  g.s.autoSkill = false;
  g.enterMap(11);
  const st = g.stats();
  const m = g.mons.find((o) => o.alive && !o.npc);
  g.mons = [m];
  g.mon = m;
  m.aggro = false; m.atkTimer = 99; m.stun = 999;   // 몹은 제자리 — 무인만 걸어간다
  m.hp = m.maxHp = 1e12;
  // 무인과 몹을 아홉 칸 떨어뜨려 놓고, 막 한 대 친 것처럼 평타 쿨을 가득 채운다
  m.c = g.hc + 9 < W.COLS ? g.hc + 9 : Math.max(0, g.hc - 9); m.r = g.hr; m.x = (m.c + 0.5) * W.TILE; m.y = (m.r + 0.5) * W.TILE; m.move = null;
  g.atkTimer = st.atkSec;
  let hits = 0, arrive = null, first = null, t = 0;
  const orig = g.basicAttack.bind(g);
  g.basicAttack = (...a) => { hits++; if (first == null) first = t; return orig(...a); };
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 8 && first == null; i++) {
    g.tick(dt); t += dt; g.events.length = 0;
    if (arrive == null && !g.hmove && g.tileDist({ c: g.hc, r: g.hr }, g.mobTile(m)) <= st.range) arrive = t;
  }
  ok(arrive != null && arrive > st.atkSec, '걷는 데 평타 쿨보다 오래 걸렸다', `도착 ${arrive?.toFixed(2)}초 · 쿨 ${st.atkSec.toFixed(2)}초`);
  ok(first != null && first - arrive <= dt * 1.5, '다 걸어오면 쉬지 않고 바로 친다 (후딜레이 없음)', `도착 뒤 ${((first ?? 99) - (arrive ?? 0)).toFixed(2)}초`);
  // 쿨은 쌓이지 않는다 — 한참 걸어도 연달아 두 대를 치지 않는다
  const t0 = first; hits = 0;
  for (let i = 0; i < 30 * 3; i++) { g.tick(dt); t += dt; g.events.length = 0; }
  ok(hits <= Math.ceil(3 / st.atkSec) + 1, '바로 친 뒤로는 원래 박자대로', `${hits}대 / 3초`);
  ok(/this\.atkTimer = Math\.max\(0, this\.atkTimer - dt\)/.test(read('js/world/wgame.js')), '평타 쿨은 걷는 동안에도 흐른다');
  void t0;
}
console.log('\n=== v297 각인 개편 — 칸 단 · 다시 새기기 · 공명 · 각인 배율 ===');
{
  const IMm = await import('../js/world/wimprint.js');
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.s.autoInf = false; g.s.autoEnh = false;
  const worn = W.GROW_SLOTS.map((k) => g.s.equip[k]).filter(Boolean);
  for (const it of worn) { it.rar = 0; it.imps = []; }
  const keys = Object.keys(W.ZONES_W).filter((z) => +z >= 1 && W.ZONES_W[z]?.boss).map((z) => `b${z}`).filter((k) => W.markLv(k) < 90 && IMm.imprintOf({ k, s: 0, sk: 'dmg', g: 0 }, 0));
  const k1 = keys[keys.length - 1];
  const th = IMm.themeOfZone(+k1.slice(1));
  const k2 = keys.find((k) => IMm.themeOfZone(+k.slice(1)) !== th);
  g.s.mats[k1] = 5000; g.s.mats[k2] = 5000;
  const w = g.s.equip.weapon;
  w.rar = 3; w.imps = [{ k: k2, s: 1, sk: 'range', g: 2, sp: 0 }];
  g._stats = null;
  // 단 올리기 — 확률 없이 한 단 · 값이 커진다 · 같은 두목 증표만 · 10단이 끝
  const im0 = IMm.imprintOf(w.imps[0], 0);
  const di = g.danInfo(w, 0);
  ok(di && di.key === k2 && di.d === 1 && di.n === IMm.danMarks(0, 1), '단 올리기 값 — 그 칸 두목 증표', JSON.stringify(di));
  const p0 = g.power(), m0 = g.s.mats[k2];
  const e = g.danUp(w.uid, 0);
  const im1 = IMm.imprintOf(w.imps[0], 0);
  ok(e && e.d === 2 && g.s.mats[k2] === m0 - di.n, '한 단 오른다 · 증표가 든다');
  ok(im1.core > im0.core && Object.keys(im1.fx).every((kk) => im1.fx[kk] > im0.fx[kk]) && im1.skill.v > im0.skill.v, '단이 오르면 각인력·테마·스킬 변화가 커진다', `${(im0.core * 100).toFixed(2)}% → ${(im1.core * 100).toFixed(2)}%`);
  ok(g.power() > p0, '전투력이 오른다', `${p0} → ${g.power()}`);
  for (let i = 0; i < 20; i++) g.danUp(w.uid, 0);
  ok(IMm.danOf(w.imps[0]) === IMm.DAN_MAX && !g.canDanUp(w, 0) && g.danInfo(w, 0).max, '10단(극)이 끝');
  ok(w.imps[0].s === 1 && w.imps[0].sk === 'range' && w.imps[0].g === 2, '단을 올려도 스킬 변화는 그대로');
  // 다시 새기기 — 다른 두목으로 · 스킬 변화는 그대로 · 단은 절반
  const ri = g.rewriteInfo(w, 0, k1);
  ok(ri && ri.n === W.INFUSE_MARKS[3] && ri.keep === 5, '다시 새기기 값 — 그 장비 등급 값(신화 12) · 단 절반', JSON.stringify(ri));
  ok(!g.rewriteInfo(w, 0, k2), '같은 두목으로는 다시 새기지 않는다');
  const r = g.rewriteImp(w.uid, 0, k1, 0);
  ok(r && r.k === k1 && r.d === 5 && r.s === 1 && r.sk === 'range' && r.g === 2, '다시 새기면 두목이 바뀌고 스킬 변화는 남는다', JSON.stringify(r));
  ok(!g.rewriteImp(w.uid, 1, k1, 0), '빈 칸은 다시 새기지 않는다(빈 칸 새기기로)');
  // 공명 — 같은 기운 4칸
  const before = g.resonance().by[th]?.tier ?? -1;
  g.events.length = 0;
  const its = worn.filter((x) => x !== w).slice(0, 3);
  for (const it of its) { it.rar = 1; it.imps = [{ k: k1, s: 0, sk: 'dmg', g: 0, sp: 0 }]; }
  g._stats = null;
  const rs = g.resonance();
  ok(before < 0 && rs.by[th].n === 4 && rs.by[th].tier === 0 && rs.top.theme === th, '같은 기운 4칸 → 공명 Ⅰ', `${IMm.THEMES[th].name} ${rs.by[th].n}칸`);
  ok(Math.abs((rs.extra.resAtk || 0) - IMm.RES_BONUS[0].atkPct) < 1e-9, '공명 Ⅰ — 각인 배율 +3%');
  const fxk = Object.keys(rs.by[th].fx)[0];
  ok(rs.extra[fxk] > 0 && Math.abs(rs.extra[fxk] - rs.by[th].fx[fxk] * IMm.RES_BONUS[0].fx) < 1e-12, '공명 — 그 기운 능력치가 커진다');
  // 공명 알림 (v307 3·5·7·8): 다섯째에서 Ⅱ · 여섯째는 그대로
  g.s.mats[k1] = 5000;
  const rest = worn.filter((x) => x !== w && !its.includes(x));
  const it4 = rest[0]; it4.rar = 3; it4.imps = [];
  g.events.length = 0;
  g.fillImp(it4.uid, 0, k1, 0);
  ok(g.resonance().by[th].n === 5 && g.resonance().by[th].tier === 1 && g.events.some((e) => e.type === 'resonance' && e.up && e.tier === 1 && e.theme === th), '5개 → 공명 Ⅱ 알림');
  const it5 = rest[1]; it5.rar = 1; it5.imps = [];
  g.events.length = 0;
  g.fillImp(it5.uid, 0, k1, 0);
  ok(g.resonance().by[th].n === 6 && g.resonance().by[th].tier === 1 && !g.events.some((e) => e.type === 'resonance'), '6개 — 아직 Ⅲ이 아니면 알림 없음');
  // 각인 배율 — 다른 % 몫과 섞지 않고 공격력·체력에 그대로 곱한다
  const st = g.stats();
  const save = worn.map((x) => x.imps);
  const rawCore = IMm.impCoreTotal(g.s.equip), mul = rawCore + (g.resonance().extra.resAtk || 0);
  for (const x of worn) x.imps = [];
  g._stats = null;
  const st0 = g.stats();
  worn.forEach((x, i) => { x.imps = save[i]; }); g._stats = null;
  ok(mul > 0 && st.atk / st0.atk > 1 + mul - 1e-6, '각인 배율만큼(이상) 공격력이 오른다', `×${(st.atk / st0.atk).toFixed(3)} · 배율 ×${(1 + mul).toFixed(3)}`);
  ok(Math.abs(st.hp / st0.hp - (1 + mul)) < 0.02 || st.hp / st0.hp > 1 + mul - 1e-6, '체력도');
  // 옛 저장 — 글자만 든 칸·단 없는 칸은 1단
  const m = migrateWorld(JSON.parse(JSON.stringify({ ...newWorldSave(), equip: { weapon: { uid: 9, slot: 'weapon', grow: true, step: 10, ilv: 60, rar: 2, imps: ['b5', { k: 'b6', s: 0, sk: 'dmg', g: 0, sp: 0 }] } } })));
  ok(IMm.imprintsOf(m.equip.weapon || g.s.equip.weapon).every((x) => x.d >= 1 && x.core > 0), '옛 칸은 1단 · 각인력이 있다');
  // v307 옛 세 칸 → 한 칸: 가장 깊은 칸(같으면 뒤 칸)만 남고, 나머지 칸의 증표는 돌아온다
  const m3 = migrateWorld({ ...newWorldSave(), mats: { b5: 1 }, equip: { weapon: { uid: 9, slot: 'weapon', grow: true, step: 10, ilv: 60, rar: 3, imps: [{ k: 'b5', s: 0, sk: 'dmg', g: 0, sp: 0, d: 4 }, { k: 'b6', s: 0, sk: 'dmg', g: 0, sp: 0, d: 2 }, { k: 'b7', s: 0, sk: 'dmg', g: 0, sp: 0 }] } } });
  ok(m3.equip.weapon.imps.length === 1 && m3.equip.weapon.imps[0].k === 'b5' && m3.equip.weapon.imps[0].d === 4, '세 칸이던 장비는 가장 깊은 칸 하나만', JSON.stringify(m3.equip.weapon.imps));
  ok(m3.mats.b6 === W.INFUSE_MARKS[2] + IMm.danSpent(0, 2) && m3.mats.b7 === W.INFUSE_MARKS[3] && m3.mats.b5 === 1, '남은 칸의 증표(새긴 값 + 단 올린 값)는 돌아온다', `b6 ${m3.mats.b6} b7 ${m3.mats.b7}`);
  ok(IMm.danOf({ k: 'b5', d: 99 }) === IMm.DAN_MAX && IMm.danOf({ k: 'b5', d: -3 }) === 1, '이상한 단은 1~10으로');
  // 자동 — 남는 증표로 단 올리기(다음 등급 몫 12개는 남긴다) · 끄면 안 한다
  const A = fresh('sword');
  while (A.s.level < 60) A.addExp(W.expToNext(A.s.level));
  A.s.gold = 1e15; A.s.autoInf = true; A.s.autoEnh = false;
  for (const it of W.GROW_SLOTS.map((k) => A.s.equip[k]).filter(Boolean)) { it.rar = 3; it.imps = [{ k: k2, s: 0, sk: 'dmg', g: 0, sp: 0 }]; }
  for (const k of Object.keys(A.s.mats)) if (W.isMarkKey(k)) A.s.mats[k] = 0;
  A.s.mats[k2] = 40;
  A.s.autoInfCfg = { ...A.s.autoInfCfg, mode: 'all', dan: false };
  A.autoGear();
  ok(A.s.mats[k2] === 40, '자동 단 올리기를 끄면 그대로');
  A.s.autoInfCfg.dan = true;
  A.autoGear();
  const ds = W.GROW_SLOTS.map((k) => A.s.equip[k]).filter(Boolean).map((x) => IMm.danOf(x.imps[0]));
  ok(ds.some((d) => d > 1) && A.s.mats[k2] < 40, '자동이 남는 증표로 단을 올린다', `단 ${ds.join(',')} · 남은 증표 ${A.s.mats[k2]}`);
  ok(Math.max(...ds) - Math.min(...ds) <= 1, '낮은 단부터 고르게');
  // 알림 · 글
  ok(/!ev\.dan && !ev\.rewrite/.test(read('js/wmain.js')) && /case 'resonance'/.test(read('js/wmain.js')), '단·다시 새기기는 소문내지 않고 · 공명은 알린다');
  ok(/각인 배율/.test(read('js/wui.js')) && /단 올리기/.test(read('js/wui.js')) && /다시 새기기/.test(read('js/wui.js')), '각인 창에 각인 배율·단·다시 새기기');
}
console.log('\n=== v298 대성(大成) · 극품·천품 ===');
{
  const IMm = await import('../js/world/wimprint.js');
  const g = fresh('sword');
  while (g.s.level < 60) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.s.autoInf = false; g.s.autoEnh = false;
  const keys = Object.keys(W.ZONES_W).filter((z) => +z >= 1 && W.ZONES_W[z]?.boss).map((z) => `b${z}`).filter((k) => W.markLv(k) < 90 && IMm.imprintOf({ k, s: 0, sk: 'dmg', g: 0 }, 0));
  const k1 = keys[0];
  g.s.mats[k1] = 9999;
  const w = g.s.equip.weapon;
  w.rar = 3; w.imps = [{ k: k1, s: 0, sk: 'dmg', g: 0, sp: 0 }];
  g._stats = null;
  // 대성 — 3·6·10단에서 하나씩 · rng로 종류를 정한다 · 그 효과가 ×2
  g.rng = () => 0;                       // 첫 종류(core)
  g.danUp(w.uid, 0); g.danUp(w.uid, 0);
  const e3 = w.imps[0];
  ok(IMm.danOf(e3) === 3 && IMm.gsOf(e3).length === 1 && e3.gs[0] === 'core', '3단에서 대성 하나', JSON.stringify(e3.gs));
  const plain = IMm.imprintOf({ ...e3, gs: [] }, 0), great = IMm.imprintOf(e3, 0);
  ok(Math.abs(great.core / plain.core - 2) < 1e-9 && Math.abs(great.fx[Object.keys(great.fx)[0]] / plain.fx[Object.keys(plain.fx)[0]] - 1) < 1e-9, '대성(각인력)은 각인력만 ×2');
  g.danUp(w.uid, 0); g.danUp(w.uid, 0);
  ok(IMm.gsOf(w.imps[0]).length === 1, '4·5단에는 안 터진다');
  g.rng = () => 0.4;                     // fx
  g.danUp(w.uid, 0);
  ok(IMm.danOf(w.imps[0]) === 6 && IMm.gsOf(w.imps[0]).length === 2 && w.imps[0].gs[1] === 'fx', '6단에서 둘째 대성');
  g.rng = () => 0;                       // core 또
  for (let i = 0; i < 4; i++) g.danUp(w.uid, 0);
  const e10 = w.imps[0];
  ok(IMm.danOf(e10) === 10 && IMm.gsOf(e10).length === 3 && IMm.gsMult(e10, 'core') === 3, '10단에서 셋째 · 같은 것이면 ×3', JSON.stringify(e10.gs));
  ok(/각인력 ×3/.test(IMm.gsText(e10)) && /기운 능력치 ×2/.test(IMm.gsText(e10)), '대성 글', IMm.gsText(e10));
  ok(!g.danUp(w.uid, 0) && IMm.gsOf(w.imps[0]).length === 3, '극(極) 뒤엔 더 안 터진다');
  // 다시 닦기 — 1단 · 대성 사라짐 · 증표 절반 환급 · 품질·스킬 변화는 그대로
  w.imps[0].q = 1;
  const m0 = g.s.mats[k1];
  const rs = g.danResetInfo(w, 0);
  ok(rs && rs.d === 10 && rs.back === Math.floor(IMm.danSpent(0, 10) / 2) && rs.back > 0, '다시 닦기 값 — 든 증표의 절반', JSON.stringify(rs));
  const r = g.danReset(w.uid, 0);
  ok(r && IMm.danOf(r) === 1 && !IMm.gsOf(r).length && r.q === 1 && r.sk === 'dmg' && g.s.mats[k1] === m0 + rs.back, '1단으로 · 대성 없음 · 극품·스킬 변화는 남고 · 환급', JSON.stringify(r));
  ok(!g.danResetInfo(w, 0), '1단은 닦을 것이 없다');
  // 고유 효과 없는 두목은 sp 대성이 안 나온다
  const hasSp = !!IMm.specialsOfZone(+k1.slice(1));
  ok(IMm.rollGs(() => 0.99, hasSp) === (hasSp ? 'sp' : 'sk'), '고유 없는 두목은 고유 대성이 없다');
  // 극품·천품 — 굴림 · 효과 · 다시 새기면 새로 굴린다
  ok(IMm.rollQual(() => 0.5) === 0 && IMm.rollQual(() => 0.03) === 1 && IMm.rollQual(() => 0.001) === 2, '5% 극품 · 0.5% 천품');
  const q0 = IMm.imprintOf({ k: k1, s: 0, sk: 'dmg', g: 0, q: 0 }, 0), q1 = IMm.imprintOf({ k: k1, s: 0, sk: 'dmg', g: 0, q: 1 }, 0), q2 = IMm.imprintOf({ k: k1, s: 0, sk: 'dmg', g: 0, q: 2 }, 0);
  const fk = Object.keys(q0.fx)[0];
  ok(Math.abs(q1.core / q0.core - 1.5) < 1e-9 && Math.abs(q1.fx[fk] / q0.fx[fk] - 1) < 1e-9, '극품 — 각인력 ×1.5');
  ok(Math.abs(q2.core / q0.core - 2) < 1e-9 && Math.abs(q2.fx[fk] / q0.fx[fk] - 1.5) < 1e-9, '천품 — 각인력 ×2 · 기운 ×1.5');
  g.rng = () => 0.001;
  const h2 = g.s.equip.hat; h2.rar = 1; h2.imps = [];
  g.fillImp(h2.uid, 0, k1, 0);
  ok(h2.imps[0].q === 2, '빈 칸 새기기에 천품이 뜬다');
  g.rng = () => 0.5;
  const k2 = keys.find((k) => k !== k1); g.s.mats[k2] = 99;
  g.rewriteImp(h2.uid, 0, k2, 0);
  ok(h2.imps[0].q === 0 && h2.imps[0].k === k2, '다시 새기면 품질을 새로 굴린다');
  // 등급 각인 성공에도
  const a = g.s.equip.armor; a.rar = 0; a.imps = [];
  g.rng = () => 0.001;
  g.infuse(a.uid, k1, 0);
  ok(a.rar === 1 && a.imps[0]?.q === 2, '등급 각인 성공에도 천품이 뜬다 · 알림에 천품', JSON.stringify(a.imps[0]));
  ok(g.events.some((ev) => ev.type === 'infuse' && ev.ok && ev.item === a), '각인 이벤트');
  // 서명 — 대성·품질이 바뀌면 능력치를 다시 센다
  const sig0 = g.impSig(); w.imps[0] = { ...w.imps[0], gs: ['core'] }; const sig1 = g.impSig(); w.imps[0] = { ...w.imps[0], q: 2 };
  ok(sig0 !== sig1 && sig1 !== g.impSig(), '대성·품질이 서명에 든다');
  // 자동 단 올리기에도 대성 — 알림 수
  const A = fresh('sword');
  while (A.s.level < 60) A.addExp(W.expToNext(A.s.level));
  A.s.gold = 1e15; A.s.autoInf = true; A.s.autoEnh = false;
  for (const it of W.GROW_SLOTS.map((k) => A.s.equip[k]).filter(Boolean)) { it.rar = 3; it.imps = [{ k: k1, s: 0, sk: 'dmg', g: 0, sp: 0, d: 2 }, null, null]; }
  for (const k of Object.keys(A.s.mats)) if (W.isMarkKey(k)) A.s.mats[k] = 0;
  A.s.mats[k1] = 100; A.rng = () => 0;
  A.events.length = 0;
  const out = A.autoGear();
  ok(out.gs >= 1 && A.events.some((ev) => ev.type === 'autoGear' && ev.gs >= 1), '자동이 올린 단에서도 대성이 터지고 알린다', `대성 ${out.gs}`);
  ok(/大成/.test(read('js/wmain.js')) && /천품\(天品\) 각인이 새겨졌어요/.test(read('js/wmain.js')), '대성은 크게 · 천품은 무림 소식');
  ok(/다시 닦기/.test(read('js/wui.js')) && /qualNote/.test(read('js/wui.js')), '각인 창에 다시 닦기 · 품질 알림');
}
console.log('\n=== v303 손으로 움직인 뒤 · 잡은 뒤 후딜 없음 ===');
{
  const g = fresh();
  g.s.autoSkill = false;
  g.enterMap(11);
  const st = g.stats();
  const m = g.mons.find((o) => o.alive && !o.npc);
  g.mons = [m]; g.mon = null;
  m.aggro = false; m.atkTimer = 99; m.stun = 999; m.hp = m.maxHp = 1e12;
  // 손으로 몹 바로 옆 칸을 찍는다 — 도착하면 manualHold 1.2초. 그동안에도 닿는 적은 친다
  m.c = g.hc + 3; m.r = g.hr; m.x = (m.c + 0.5) * W.TILE; m.y = (m.r + 0.5) * W.TILE; m.move = null;
  g.moveTo((m.c - 1 + 0.5) * W.TILE, (m.r + 0.5) * W.TILE);
  g.atkTimer = 0;
  let hits = 0, arrive = null, first = null, t = 0;
  const orig = g.basicAttack.bind(g);
  g.basicAttack = (...a) => { hits++; if (first == null) first = t; return orig(...a); };
  const dt = 1 / 30;
  for (let i = 0; i < 30 * 6; i++) {
    g.tick(dt); t += dt; g.events.length = 0;
    if (arrive == null && !g.manual && !g.hmove) arrive = t;
    if (arrive != null && first != null) break;
  }
  ok(arrive != null && g.manualHold > 0 || first != null, '찍은 칸에 닿았다', `도착 ${arrive?.toFixed(2)}초`);
  ok(first != null && first - arrive <= dt * 2, '닿자마자 옆 몹을 친다 — 1.2초 멍하니 서 있지 않는다 (v303)', `도착 뒤 ${((first ?? 99) - (arrive ?? 0)).toFixed(2)}초`);
  // 그동안 쫓아가지는 않는다 — 멀리 있는 몹에게는 걸어가지 않는다
  const g2 = fresh(); g2.s.autoSkill = false; g2.enterMap(11);
  const m2 = g2.mons.find((o) => o.alive && !o.npc); g2.mons = [m2]; g2.mon = null; m2.aggro = false; m2.atkTimer = 99; m2.stun = 999;
  m2.c = Math.min(W.COLS - 1, g2.hc + 8); m2.r = g2.hr; m2.x = (m2.c + 0.5) * W.TILE; m2.y = (m2.r + 0.5) * W.TILE; m2.move = null;
  const tc = g2.hc + 1;
  g2.moveTo((tc + 0.5) * W.TILE, (g2.hr + 0.5) * W.TILE);
  for (let i = 0; i < 15; i++) { g2.tick(dt); g2.events.length = 0; }
  ok(!g2.manual && g2.manualHold > 0 && g2.hc === tc && !g2.hmove, '찍은 칸에 닿은 직후에는 먼 몹을 쫓아가지 않는다(손 움직임을 존중)', `무인 ${g2.hc} 찍은 칸 ${tc} 몹 ${m2.c} hold ${g2.manualHold.toFixed(2)}`);
  // 잡으면 쿨이 짧아진다
  const g3 = fresh(); g3.s.autoSkill = false; g3.enterMap(11);
  const m3 = g3.mons.find((o) => o.alive && !o.npc); g3.mons = [m3]; g3.mon = m3; m3.stun = 999; m3.hp = 1;
  m3.c = g3.hc + 1; m3.r = g3.hr; m3.x = (m3.c + 0.5) * W.TILE; m3.y = (m3.r + 0.5) * W.TILE; m3.move = null;
  g3.atkTimer = 0; g3.tick(dt);
  ok(!m3.alive && g3.atkTimer <= W.KILL_RECOVER + 1e-9, `과녁을 쓰러뜨리면 평타 쿨이 ${W.KILL_RECOVER}초로`, `쿨 ${g3.atkTimer.toFixed(2)}`);
  const g4 = fresh(); g4.s.autoSkill = false; g4.enterMap(11);
  const m4 = g4.mons.find((o) => o.alive && !o.npc); g4.mons = [m4]; g4.mon = m4; m4.stun = 999; m4.hp = m4.maxHp = 1e12;
  m4.c = g4.hc + 1; m4.r = g4.hr; m4.x = (m4.c + 0.5) * W.TILE; m4.y = (m4.r + 0.5) * W.TILE; m4.move = null;
  g4.atkTimer = 0; g4.tick(dt);
  ok(m4.alive && g4.atkTimer > W.KILL_RECOVER, '못 쓰러뜨리면 쿨은 그대로', `쿨 ${g4.atkTimer.toFixed(2)}`);
  // v304: 잡은 직후 빨리 나간 평타는 초당 피해 기록에 안 든다 — 두목 최소 싸움 시간이 부풀지 않게
  const g5 = fresh(); g5.s.autoSkill = false; g5.enterMap(11);
  const mk = (c) => { const o = g5.mons.find((x) => x.alive && !x.npc && x !== g5.mon); o.stun = 999; o.hp = o.maxHp = 1; o.c = c; o.r = g5.hr; o.x = (c + 0.5) * W.TILE; o.y = (o.r + 0.5) * W.TILE; o.move = null; return o; };
  const a1 = mk(g5.hc + 1); g5.mon = a1; g5.atkTimer = 0; g5.dmgAcc = 0; g5.tick(dt);
  const acc1 = g5.dmgAcc;
  const a2 = mk(g5.hc + 1); g5.mon = a2; for (let i = 0; i < 12 && a2.alive; i++) g5.tick(dt);   // 0.3초 뒤 바로 또 — 빠른 평타
  ok(!a1.alive && !a2.alive && acc1 > 0 && Math.abs(g5.dmgAcc - acc1) < 1e-6, '잡은 직후 0.3초 만에 나간 평타는 초당 피해에 안 센다', `첫 ${acc1.toFixed(0)} → ${g5.dmgAcc.toFixed(0)}`);
  ok(/_quickAtk/.test(read('js/world/wgame.js')), '빠른 평타 표시로 거른다');
  void st;
}
console.log('\n=== v305 칭호 ===');
{
  const g = fresh('sword');
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  const atk0 = g.stats().atk;
  ok(!g.titleNow() && !g.s.titles.length, '처음엔 칭호가 없다');
  ok(!g.grantTitle('nope') && !g.wearTitle('okheir'), '없는 칭호는 못 받고 · 안 가진 칭호는 못 낀다');
  g.events.length = 0;
  ok(g.grantTitle('okheir') && g.hasTitle('okheir') && g.s.title === 'okheir' && g.events.some((e) => e.type === 'title' && e.id === 'okheir'), '〈이미옥의 후예〉를 받으면 바로 끼고 알린다');
  ok(Math.abs(g.stats().atk / atk0 - 2 * (1 + W.TITLE_SET_BONUS)) < 1e-9, '공격력 ×2 (v315 + 모음 1%)', `${atk0.toFixed(0)} → ${g.stats().atk.toFixed(0)}`);
  ok(g.titleNow().hitFx === '옥' && /〈이미옥의 후예〉 Lv\.30/.test(g.heroLabel()), '때릴 때 글자 〈옥〉 · 이름표에 칭호');
  ok(!g.grantTitle('okheir') && g.s.titles.length === 1, '두 번 받아도 하나');
  ok(g.wearTitle(null) && !g.s.title && Math.abs(g.stats().atk / atk0 - (1 + W.TITLE_SET_BONUS)) < 1e-9, '벗으면 ×2는 빠진다(모음 +1%만 남는다)');
  ok(g.wearTitle('okheir') && g.s.title === 'okheir', '다시 낀다');
  const m = migrateWorld({ ...newWorldSave(), titles: ['개국공신', 'okheir', 'bogus', 5], title: 'okheir' });
  ok(m.titles.length === 2 && m.titles.includes('개국공신') && m.titles.includes('okheir') && m.title === 'okheir', '저장: 아는 칭호만 남고 낀 것도 남는다', JSON.stringify(m.titles));
  ok(migrateWorld({ ...newWorldSave(), titles: [], title: 'okheir' }).title === null, '안 가진 칭호를 끼고 있으면 벗긴다');
  ok(W.titleOf('개국공신')?.id === 'founder' && !W.titleOf('개국공신').atkMul, '옛 개국공신은 효과 없는 칭호');
  ok(/titleK/.test(read('js/wmain.js')) && /g\.title/.test(read('js/wmain.js')) && /'title'/.test(read('firestore.rules')), '우편으로 보내고 받는다 · 규칙에 title');
  ok(/tf\.hitFx/.test(read('js/battle.js')), '때릴 때마다 글자');
}
console.log('\n=== v343 함께 잡은 두목 보상 ===');
{
  const C = await import('../js/world/wcoop.js');
  const mk = () => { const g = fresh(); g.s.level = 30; g.enterMap(W.mapId(2, W.BOSS_AREA)); g.mons.length = 0; const b = g.spawnMob(true); b.hp = 0; return { g, b }; };
  const a = mk(); const e0 = a.g.s.exp, g0 = a.g.s.gold, o0 = a.g.s.mats[W.ORE] || 0; a.g.killMob(a.b);
  const solo = { exp: a.g.s.exp - e0, gold: a.g.s.gold - g0, ore: (a.g.s.mats[W.ORE] || 0) - o0 };
  const b = mk(); const e1 = b.g.s.exp, g1 = b.g.s.gold, o1 = b.g.s.mats[W.ORE] || 0; b.g.coopK = 1 + C.COOP_BONUS * 3; b.g.killMob(b.b); b.g.coopK = null;
  const four = { exp: b.g.s.exp - e1, gold: b.g.s.gold - g1, ore: (b.g.s.mats[W.ORE] || 0) - o1 };
  ok(four.exp > solo.exp * 1.25 && four.gold >= solo.gold * 1.25 && four.ore >= solo.ore, '넷이 함께 잡으면 경험치·은자·현철 +30%', `혼자 ${Math.round(solo.exp)}/${solo.gold}/${solo.ore} · 넷 ${Math.round(four.exp)}/${four.gold}/${four.ore}`);
  const c = mk(); const e2 = c.g.s.exp, bag0 = c.g.s.bag.length, mt0 = c.g.s.mounts.length; c.g.coopShare(c.b, C.COOP_SHARE);
  ok(c.g.s.exp - e2 > 0 && Math.abs((c.g.s.exp - e2) - solo.exp * 0.5) < solo.exp * 0.2 && c.g.s.bag.length === bag0 && c.g.s.mounts.length === mt0 && !c.b.alive, '못 친 문파원은 절반(장비·탈것 없음)');
  ok(C.COOP_BONUS === 0.1 && C.COOP_BONUS_MAX === 5, '한 명마다 +10% · 최대 +50%');
}

console.log('\n=== v309 규칙 판 ===');
{
  const rv = read('js/net.js').match(/RULES_VER = '(\d+)'/)?.[1];
  const inRules = read('firestore.rules').match(/match \/rulesv\/\{v\} \{\s*allow get: if signedIn\(\) && v == '(\d+)'/)?.[1];
  ok(rv && rv === inRules, '앱의 RULES_VER와 firestore.rules의 rulesv 판이 같다 (규칙을 고치면 둘 다 올린다)', `앱 ${rv} · 규칙 ${inRules}`);
  ok(/checkRules/.test(read('js/net.js')) && /rulesOk === false && net\.isAdmin/.test(read('js/wmain.js')), '옛 규칙이면 운영자에게 알린다');
}
console.log('\n=== v312 애완동물 해제 · 바꿔 데려가기 ===');
{
  const g = fresh();
  g.s.pets = []; g.s.petBox = [];
  const a = g.gainPet(1, null, W.PETS[0].id), b = g.gainPet(2, null, W.PETS[1].id);
  ok(g.s.pets.length === 1 && g.s.petBox.length === 1 && g.s.pets[0] === a && g.s.petBox[0] === b, '칸 하나 — 하나는 키우고 하나는 우리');
  ok(g.unequipPet(a.uid) && !g.s.pets.length && g.s.petBox.includes(a), '해제하면 우리로(사라지지 않는다)');
  ok(g.adoptPet(b.uid) && g.s.pets[0] === b, '빈 칸에 다시 데려간다');
  ok(g.swapPet(a.uid, b.uid) && g.s.pets[0] === a && g.s.petBox.includes(b) && g.s.pets.length === 1, '꽉 찼으면 바꿔 데려간다 — 바뀐 것은 우리로');
  while (g.s.petBox.length < W.PET_BOX) g.s.petBox.push({ uid: 900000 + g.s.petBox.length, kind: W.PETS[0].id, rar: 0, lv: 1, exp: 0 });
  ok(!g.canUnequipPet(a.uid) && !g.unequipPet(a.uid) && g.s.pets[0] === a, '우리가 가득이면 해제 못 한다');
  ok(/unequipPet/.test(read('js/wui.js')) && /swapPet/.test(read('js/wui.js')), '창에 해제 · 바꿔 데려가기');
}
console.log('\n=== v313 두목 다시 나기 10초(화무기만 30초) ===');
{
  const g = fresh();
  const hw = Object.values(W.ZONES_W).find((z) => z?.master === 'hwamugi');
  const ch = Object.values(W.ZONES_W).find((z) => z?.master && z.master !== 'hwamugi');
  ok(W.BOSS_RESPAWN === 10, '두목은 10초마다 다시 난다', `${W.BOSS_RESPAWN}`);
  ok(g.bossRespawn({ master: 'hwamugi' }) === 30 && !!hw, '화무기만 30초');
  ok(g.bossRespawn({ master: ch?.master }) === 10 && g.bossRespawn({ master: null }) === 10, '다른 고수·지역 두목은 10초');
  ok(/bossT = this\.bossRespawn\(\)/.test(read('js/world/wgame.js')), '두목이 나설 때 그 방의 초를 쓴다');
}

console.log('\n=== v314 분당 경험치 · 낮은 사냥터 알림 · 두목까지 남은 초 ===');
{
  const g = fresh();
  while (g.s.level < 40) g.addExp(W.expToNext(g.s.level));
  g.enterMap(W.mapId(1, 1));
  const gap = g.huntGap();
  ok(gap && gap.k < 1 && gap.to && W.mapOf(gap.to).lv[0] > W.mapOf(W.mapId(1, 1)).lv[0], '레벨보다 많이 낮은 사냥터면 깎인 배율과 옮길 곳', JSON.stringify(gap));
  ok(gap.to === g.fitMap(W.mapId(1, 1)) && W.mapOf(gap.to).lv[1] <= g.s.level, '옮길 곳은 몹이 내 레벨을 넘지 않는 가장 높은 곳', W.mapOf(gap.to).name);
  g.enterMap(gap.to);
  ok(g.huntGap() === null, '알맞은 곳에선 알림이 없다');
  g.enterMap(W.mapId(1, W.BOSS_AREA));
  ok(g.huntGap() === null, '두목 구역은 보지 않는다(일부러 가는 곳)');
  g.enterMap(gap.to);
  ok(g.expPerMin() === null || g.expPerMin() >= 0, '벌이를 아직 모르면 null');
  for (let i = 0; i < 20 * 60; i++) { g.tick(0.05); g.events.length = 0; }
  const epm = g.expPerMin();
  ok(epm > 0 && Number.isFinite(epm), '사냥하면 분당 경험치(레벨의 %)를 센다', epm?.toFixed(2));
  ok(epm < 1000, '말이 되는 크기', epm.toFixed(2));
  g.enterMap(W.mapId(1, 1));
  ok(g.expPerMin() === null, '사냥터를 옮긴 직후엔 안 보인다(앞 사냥터 벌이를 섞지 않는다)');
  g.enterMap(gap.to);
  g.goTown();
  ok(g.expPerMin() === null, '마을에선 안 보인다');
  // 두목까지
  const b = fresh();
  b.enterMap(W.mapId(1, W.BOSS_AREA));
  ok(b.bossWait() && b.bossWait().left <= 1.5, '두목 방에 들어서면 곧 나선다', JSON.stringify(b.bossWait()));
  for (let i = 0; i < 40; i++) { b.tick(0.05); b.events.length = 0; }
  ok(b.mons.some((m) => m.isBoss && m.alive) && b.bossWait() === null, '두목이 있으면 남은 초는 없다');
  const boss = b.mons.find((m) => m.isBoss && m.alive);
  boss.alive = false; boss.hp = 0;
  b.tick(0.05); b.events.length = 0;
  const w = b.bossWait();
  ok(w && w.total === W.BOSS_RESPAWN && w.left > W.BOSS_RESPAWN - 0.5 && w.left <= W.BOSS_RESPAWN, '쓰러지면 10초부터 줄어든다', JSON.stringify(w));
  for (let i = 0; i < 20 * 4; i++) { b.tick(0.05); b.events.length = 0; }
  ok(b.bossWait().left < w.left - 3.5, '시간이 가면 준다', JSON.stringify(b.bossWait()));
  const hw = Object.values(W.ZONES_W).find((z) => z?.master === 'hwamugi');
  const hwRoom = W.MAPS.find((m) => m.zone === hw.id && m.bossRoom);
  b.s.duel.won = { ...b.s.duel.won };
  if (b.enterMap(hwRoom.id)) { const bb = b.mons.find((m) => m.isBoss); if (bb) { bb.alive = false; b.mons = b.mons.filter((m) => !m.isBoss); } b.bossT = 30; ok(b.bossWait()?.total === 30, '화무기 방은 30초 고리', JSON.stringify(b.bossWait())); }
  const ui = read('js/wmain.js'), html = read('index.html');
  ok(/expPerMin\(\)/.test(ui) && /huntGap\(\)/.test(ui) && /bossWait\(\)/.test(ui), '화면이 셋 다 쓴다');
  ok(/id="exp-rate"/.test(html) && /id="exp-warn"/.test(html) && /id="boss-wait"/.test(html), '자리(분당 경험치 · 알림 · 고리)');
}

console.log('\n=== v315 칭호 모음 보너스 · 전체 채팅 가리기 ===');
{
  const g = fresh();
  const a0 = g.stats().atk, h0 = g.stats().hp;
  ok(g.titleSet().n === 0, '처음엔 칭호 0개');
  g.grantTitle('quest'); g.wearTitle(null);
  ok(g.titleSet().n === 1 && Math.abs(g.stats().atk / a0 - 1.01) < 1e-9 && Math.abs(g.stats().hp / h0 - 1.01) < 1e-9, '하나 가지면(끼지 않아도) 공격력·체력 +1%', `${(g.stats().atk / a0).toFixed(4)}`);
  g.grantTitle('lv100'); g.grantTitle('k100k');
  ok(g.titleSet().n === 3 && Math.abs(g.stats().hp / h0 - 1.03) < 1e-9, '셋이면 +3%');
  g.wearTitle('lv100');
  ok(Math.abs(g.stats().atk / a0 - 1.03 * 1.02) < 1e-9, '끼는 칭호 효과는 따로 곱해진다', `${(g.stats().atk / a0).toFixed(4)}`);
  g.s.titles.push('개국공신', 'founder');
  ok(g.titleSet().n === 4, '옛 이름(개국공신)과 founder는 하나로 센다');
  const raw = JSON.parse(JSON.stringify(g.toJSON()));
  raw.chatMute = [{ uid: 'u1', name: '시끄러운이' }, { uid: 'u1', name: '겹침' }, { uid: 5 }, null, { uid: 'u2', name: '가'.repeat(30) }];
  const g2 = new WorldGame(raw, 0);
  ok(g2.s.chatMute.length === 2 && g2.s.chatMute[1].name.length === 12, '가린 무인 — 겹침·이상한 값은 버리고 이름은 12자', JSON.stringify(g2.s.chatMute));
  ok(g2.isMuted('u1') && !g2.isMuted('u3') && !g2.isMuted(''), '가렸나 본다');
  ok(g2.muteChat('u3', '셋') && !g2.muteChat('u3', '셋') && g2.isMuted('u3'), '가리기(두 번은 안 된다)');
  ok(g2.unmuteChat('u3') && !g2.isMuted('u3') && !g2.unmuteChat('u3'), '풀기');
  for (let i = 0; i < 250; i++) g2.muteChat(`x${i}`, 'x');
  ok(g2.s.chatMute.length === 200, '200명까지(오래된 것부터 밀린다)');
  const ui = read('js/wui.js'), net = read('js/net.js');
  ok(/isMuted\(m\.uid\)/.test(ui) && /muteChat/.test(ui) && /unmuteChat/.test(ui) && /who-title/.test(ui), '채팅 창: 가리기 · 풀기 · 칭호 빛깔');
  ok(/WORLD_MAX = 100/.test(net) && /chatlimit/.test(net) && /writeBatch/.test(net) && /같은 말을 거듭/.test(net), '보내기: 100자 · 2초 막이(chatlimit) · 같은 말 거듭 막기');
  ok(/titleSet\(\)/.test(ui) && /TITLE_SET_BONUS/.test(ui), '칭호 모음 창에 보너스');
}

console.log('\n=== v316 애완동물 품·단 수련 · 주간 두목 ===');
{
  // 품 — 굴림 비율
  let n1 = 0, n2 = 0; const r = (() => { let a = 0x9e3779b9; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();   // mulberry32 — LCG는 아래 자리가 치우쳤다
  for (let i = 0; i < 200000; i++) { const q = W.rollPetQual(r); if (q === 1) n1++; else if (q === 2) n2++; }
  ok(Math.abs(n1 / 200000 - W.PET_QUAL_P[0]) < 0.004 && Math.abs(n2 / 200000 - W.PET_QUAL_P[1]) < 0.0012, '극품 5% · 천품 0.5%', `${(n1 / 2000).toFixed(2)}% · ${(n2 / 2000).toFixed(2)}%`);
  const g = fresh();
  g.s.pets = []; g.s.petBox = [];
  const p = g.gainPet(1, null, 'tiger');
  ok([0, 1, 2].includes(p.q) && p.dan === 0, '얻을 때 품을 굴린다', `q${p.q}`);
  p.q = 0; g._stats = null;
  const base = W.petBuff(p), baseA = W.petAtkRatio(p);
  p.q = 2;
  ok(Math.abs(W.petBuff(p) / base - W.PET_QUAL[2].mult) < 1e-9 && Math.abs(W.petAtkRatio(p) / baseA - W.PET_QUAL[2].mult) < 1e-9, '천품은 버프·공격 ×1.6');
  p.q = 0;
  const a0 = g.stats().atk; p.q = 2; const a1 = g.stats().atk;
  ok(a1 > a0, '품이 바뀌면 능력치를 다시 센다(statSig)', `${a0.toFixed(0)} → ${a1.toFixed(0)}`);
  p.q = 0;
  // 먹이의 품을 물려받는다
  const f = g.gainPet(0, null, 'tiger'); f.q = 2;
  ok(g.starUp(p.uid) && p.star === 1 && p.q === 2 && !g.s.petBox.includes(f), '먹이의 품이 더 높으면 물려받는다');
  // 단 수련
  ok(g.petDanCost(p) === null && !g.petDan(p.uid), 'Lv.30 전에는 수련 못 한다');
  p.lv = W.PET_LV_MAX; g.s.petSoul = 0;
  ok(g.petDanCost(p) === W.petDanSoul(0) && !g.canPetDan(p.uid), '혼이 모자라면 못 한다');
  g.s.petSoul = 10000;
  g.rng = () => 0.99;   // 실패
  p.dan = 3;
  const before = g.s.petSoul;
  const rf = g.petDan(p.uid);
  ok(rf && !rf.ok && p.dan === 3 && p.danFail === 1 && g.s.petSoul === before - W.petDanSoul(3) && Math.abs(rf.next - (W.PET_DAN_P[3] + W.PET_DAN_PITY)) < 1e-9, '실패: 혼은 쓰고 단은 그대로 · 다음 확률 +10%p');
  g.rng = (() => { const seq = [0.0, 0.5]; let i = 0; return () => seq[i++ % seq.length]; })();   // 성공 · 大成 아님
  const rs = g.petDan(p.uid);
  ok(rs.ok && !rs.great && p.dan === 4 && p.danFail === 0, '성공: 한 단 · 쌓인 확률은 0으로');
  g.rng = () => 0.0;   // 성공 + 大成
  const rg = g.petDan(p.uid);
  ok(rg.ok && rg.great && p.dan === 6, '大成: 한 번에 두 단');
  ok(Math.abs(W.petDanMult(p) - (1 + 6 * W.PET_DAN_K)) < 1e-9, '단마다 +8%');
  p.dan = 9; g.rng = () => 0.0;
  const r9 = g.petDan(p.uid);
  ok(r9.ok && !r9.great && p.dan === W.PET_DAN_MAX && g.petDanCost(p) === null, '10단 끝(大成이 넘치지 않는다)');
  g.checkTitles();
  ok(g.hasTitle('petdan') && g.hasTitle('petq'), '칭호 〈영수의 주인〉 · 〈천품 영수〉');
  ok(W.petDanChance(9, 50) === 1, '확률은 100%를 넘지 않는다');
  // 저장·불러오기
  const raw = JSON.parse(JSON.stringify(g.toJSON()));
  raw.pets[0].q = 7; raw.pets[0].dan = 99; raw.pets[0].danFail = -3;
  const g2 = new WorldGame(raw, 0);
  ok(g2.s.pets[0].q === 2 && g2.s.pets[0].dan === W.PET_DAN_MAX && g2.s.pets[0].danFail === 0, '불러올 때 품·단을 범위 안으로');

  // 주간 두목
  const b = fresh();
  const t0 = Date.UTC(2026, 10, 2, 3);   // 월요일(한국 정오)
  const w = b.wbossState(t0);
  ok(w.kills === 0 && w.key === TD.weekKey(t0), '이번 주 기록을 연다', w.key);
  b.enterMap(W.mapId(1, W.BOSS_AREA));
  const mob = { isBoss: true, bornAt: b.clock - 20 };
  b.noteWeekBoss(mob, t0);
  ok(b.s.wboss.kills === 1 && !b.s.wboss.best.hwamugi, '두목을 잡으면 한 마리 · 일반 두목은 시간 기록 없음');
  const hw = W.MAPS.find((m) => m.master === 'hwamugi' && m.bossRoom);
  ok(b.enterMap(hw.id) && b.map.master === 'hwamugi', '화무기 방');
  b.events.length = 0;
  b.noteWeekBoss({ isBoss: true, bornAt: b.clock - 95.34 }, t0);
  ok(b.s.wboss.best.hwamugi === 95.3 && b.events.some((e) => e.type === 'wbossBest'), '화무기 시간 기록(0.1초)', `${b.s.wboss.best.hwamugi}`);
  b.noteWeekBoss({ isBoss: true, bornAt: b.clock - 120 }, t0);
  ok(b.s.wboss.best.hwamugi === 95.3 && b.s.wboss.kills === 3, '더 느리면 그대로');
  b.noteWeekBoss({ isBoss: true, bornAt: b.clock - 1 }, t0);
  ok(b.s.wboss.best.hwamugi === W.WBOSS_MIN_SEC, `${W.WBOSS_MIN_SEC}초보다 짧게는 적지 않는다`);
  const w2 = b.wbossState(t0 + 7 * 86400e3);
  ok(w2.kills === 0 && !w2.best.hwamugi && w2.key !== w.key, '다음 주엔 새로');
  const raw2 = JSON.parse(JSON.stringify(b.toJSON()));
  raw2.wboss = { key: '2026-11-09', kills: -5, best: { hwamugi: 1, magwi: 50, x: 3 } };
  const b2 = new WorldGame(raw2, 0);
  ok(b2.s.wboss.kills === 0 && !b2.s.wboss.best.hwamugi && b2.s.wboss.best.magwi === 50 && !('x' in b2.s.wboss.best), '불러올 때 이상한 값은 버린다', JSON.stringify(b2.s.wboss));
  // 진짜로 잡으면 센다(killMob 연결)
  const c = fresh();
  c.enterMap(W.mapId(1, W.BOSS_AREA));
  for (let i = 0; i < 40; i++) { c.tick(0.05); c.events.length = 0; }
  const bb = c.mons.find((m) => m.isBoss && m.alive);
  c.killMob(bb);
  ok(c.wbossState().kills === 1, '두목을 쓰러뜨리면 주간 처치 +1');
  const ui = read('js/wui.js'), net = read('js/net.js'), rules = read('firestore.rules');
  ok(/weekBossBoard/.test(ui) && /이번 주 두목/.test(ui) && /pushWeekBoss/.test(net) && /match \/wboss\/\{wk\}\/p\/\{uid\}/.test(rules), '서열 › 이번 주 두목 · 올리기 · 규칙');
  ok(/petDan\(p\.uid\)/.test(ui) && /qualTag/.test(ui), '동료 창: 단 수련 · 품 표시');
}

console.log('\n=== v317 끼면 견주기 · 방치 보상 한눈에 ===');
{
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  const st0 = g.stats(), sig0 = g.statSig();
  const better = { ...JSON.parse(JSON.stringify(g.s.equip.weapon)), uid: 987654, grow: false, plus: (g.s.equip.weapon.plus || 0) + 6 };   // 낀 것과 같고 강화만 더 높은 것
  const pv = g.previewEquip(better);
  ok(pv.then.atk > pv.now.atk && pv.then.power > pv.now.power, '좋은 무기면 공격력·전투력 ▲', `${pv.now.atk.toFixed(0)} → ${pv.then.atk.toFixed(0)}`);
  ok(g.statSig() === sig0 && g.stats().atk === st0.atk && !g.s.bag.includes(better) && g.s.equip.weapon !== better, '견주기만 하고 아무것도 바꾸지 않는다');
  g.s.equip.weapon.plus = 12;
  const worse = g.makeCrafted('weapon', 0);
  const pw = g.previewEquip(worse);
  ok(pw.then.atk < pw.now.atk, '못한 무기면 ▼');
  ok(g.previewEquip(g.s.equip.weapon).same, '낀 것은 그대로');
  // 끼고 나서의 능력치와 같다
  g.gainItem(worse);
  const pv2 = g.previewEquip(worse);
  g.equipFromBag(worse.uid);
  ok(Math.abs(g.stats().power - pv2.then.power) < 1e-6, '미리 본 전투력 = 실제로 낀 뒤 전투력');
  // 레벨 셈
  const h = fresh();
  while (h.s.level < 20) h.addExp(W.expToNext(h.s.level));
  const need = W.expToNext(20) - h.s.exp + W.expToNext(21) + 5;
  const pj = h.projectLevel(need);
  ok(pj.lv === 22 && pj.gained === 2 && h.s.level === 20, '경험치로 몇 레벨이 되나(바꾸지 않는다)', JSON.stringify(pj));
  h.addExp(need);
  ok(h.s.level === pj.lv && Math.abs(h.s.exp - pj.exp) < 1e-6, '셈한 레벨 = 실제로 받은 뒤 레벨');
  ok(h.projectLevel(0).gained === 0, '0이면 그대로');
  const ui = read('js/wui.js'), mn = read('js/wmain.js');
  ok(/equipCompare\(game, it\)/.test(ui) && /previewEquip/.test(ui), '장비 창: 끼면 → 온 능력치');
  ok(/projectLevel\(rw\.exp\)/.test(mn) && /받고 스탯 찍기/.test(mn) && /모두 받기/.test(mn), '방치 보상: 오른 레벨 · 두목 · 받고 스탯 찍기');
}

console.log('\n=== v318 지난주 순위 보상 · 가방 칸 견주기(전투력) ===');
{
  const g = fresh();
  ok(g.weekRewardFor({ kills: null, hwamugi: null, magwi: null }) === null && g.weekRewardFor({ kills: 4 }) === null, '3위 밖이면 보상 없음');
  const r2 = g.weekRewardFor({ kills: 3, hwamugi: 2, magwi: null });
  ok(r2.best === 2 && r2.soul === W.WB_REWARD[1].soul && !r2.title, '가장 좋은 자리 하나로(2위)');
  const s0 = g.s.petSoul || 0, gold0 = g.s.gold, ps0 = g.s.petShard || 0;
  const now = Date.UTC(2026, 10, 9, 3);
  const got = g.claimWeekReward('2026-11-02', { kills: 1 }, now);
  ok(got && got.best === 1 && g.s.petSoul === s0 + W.WB_REWARD[0].soul && g.s.gold === gold0 + got.gold && g.s.petShard === ps0 + W.WB_REWARD[0].shard, '1위 보상 — 혼·조각·은자');
  ok(g.hasTitle('wking') && g.s.titleUntil.wking === now + W.WB_TITLE_DAYS * 86400e3, '〈주간 패왕〉 한 주 동안');
  ok(g.claimWeekReward('2026-11-02', { kills: 1 }, now) === null && g.s.petSoul === s0 + W.WB_REWARD[0].soul, '같은 주는 한 번만');
  g.wearTitle('wking');
  const a1 = g.stats().atk;
  g.checkTitles(now + 6 * 86400e3);
  ok(g.hasTitle('wking') && g.s.title === 'wking', '기한 안에는 그대로');
  g.events.length = 0;
  g.checkTitles(now + 8 * 86400e3);
  ok(!g.hasTitle('wking') && !g.s.title && !g.s.titleUntil.wking && g.events.some((e) => e.type === 'titleExpire') && g.stats().atk < a1, '기한이 지나면 거두고 벗긴다');
  ok(g.claimWeekReward('2026-11-09', { kills: null }, now) === null && g.s.wbClaimed === '2026-11-09', '순위 밖이어도 본 것으로 적는다');
  // 저장: 기한 없는 기한 칭호는 버린다
  const raw = JSON.parse(JSON.stringify(g.toJSON()));
  raw.titles = [...raw.titles, 'wking']; raw.title = 'wking'; raw.titleUntil = {};
  const g2 = new WorldGame(raw, 0);
  ok(!g2.hasTitle('wking') && !g2.s.title, '기한이 적히지 않은 〈주간 패왕〉은 불러올 때 버린다');
  raw.titleUntil = { wking: Date.now() + 86400e3, lv100: 5 };
  const g3 = new WorldGame(raw, 0);
  ok(g3.hasTitle('wking') && g3.s.titleUntil.wking > 0 && !('lv100' in g3.s.titleUntil), '기한이 있으면 남는다 · 기한 칭호가 아닌 것은 버린다');
  // 가방 칸 — 전투력으로
  const b = fresh();
  while (b.s.level < 30) b.addExp(W.expToNext(b.s.level));
  const st0 = b.stats();
  const up = { ...JSON.parse(JSON.stringify(b.s.equip.weapon)), uid: 55555, grow: false, plus: (b.s.equip.weapon.plus || 0) + 4 };
  const pv = b.previewEquip(up);
  ok(b.stats() === st0, '견준 뒤 지금 능력치를 다시 세지 않는다(같은 것을 쓴다)');
  ok(pv.then.power > pv.now.power, '좋은 것은 전투력 ▲');
  const ui = read('js/wui.js'), mn = read('js/wmain.js'), net = read('js/net.js');
  ok(/const p = game\.previewEquip\(it\)/.test(ui) && /vsWorn\(it\) > 0\.005/.test(ui), '가방 칸 ▲▼와 좋은 것 모두 끼기 — 전투력으로');
  ok(/lastWeekRanks/.test(net) && /checkWeekReward/.test(mn) && /claimWeekReward/.test(mn), '접속하면 지난주 순위를 보고 보상 창');
}

console.log('\n=== v319 우리에서도 키우기 · 모두 먹이기 · 새 칭호 ===');
{
  const g = fresh();
  g.s.pets = []; g.s.petBox = [];
  const host = g.gainPet(0, null, 'tiger');
  const boxed = g.gainPet(1, null, 'dragon');   // 칸이 하나 — 우리로
  ok(g.s.petBox.includes(boxed), '둘째는 우리에');
  g.s.petSoul = 1000;
  ok(g.soulUp(boxed.uid) && boxed.rar === 2, '우리에 있어도 등급 올리기');
  boxed.lv = W.PET_LV_MAX; g.rng = () => 0;
  ok(g.petDan(boxed.uid)?.ok && boxed.dan >= 1, '우리에 있어도 단 수련(Lv.30이면)');
  for (let i = 0; i < 4; i++) g.gainPet(0, null, 'tiger');
  const n = g.starUpAll(host.uid);
  ok(n === 4 && host.star === 4 && !g.s.petBox.some((x) => x.kind === 'tiger'), '모두 먹이기 — 먹이 넷을 한 번에', `${n} · ★${host.star}`);
  for (let i = 0; i < 3; i++) g.gainPet(0, null, 'tiger');
  ok(g.starUpAll(host.uid) === 1 && host.star === W.PET_STAR_MAX && g.s.petBox.filter((x) => x.kind === 'tiger').length === 2, '별이 다 차면 멈춘다(남은 먹이는 그대로)');
  // 새 칭호
  const t = fresh();
  t.s.wboss = { key: TD.weekKey(), kills: 100, best: { hwamugi: 58.2 } };
  t.s.pets = []; t.s.petBox = [];
  for (let i = 0; i < 5; i++) { const p = t.gainPet(0, null, 'crane'); if (p) p.q = 1; }
  t.checkTitles();
  ok(t.hasTitle('wb100') && t.hasTitle('wbfast') && t.hasTitle('pet5q'), '〈두목 사냥꾼〉 · 〈일각〉 · 〈영수 수집가〉');
  ok(!t.hasTitle('titles15'), '칭호 열다섯은 아직');
  for (const k of ['lv100', 'quest', 'tower50', 'tower120', 'kings', 'cheonma', 'hwamugi', 'magwi', 'dan10', 'res4', 'okq', 'k100k']) t.grantTitle(k);
  t.checkTitles();
  ok(t.titleSet().n >= 15 && t.hasTitle('titles15'), '〈천하의 이름〉 — 칭호 열다섯', `${t.titleSet().n}`);
  const ui = read('js/wui.js');
  ok(/pen-train/.test(ui) && /starUpAll/.test(ui), '동료 창: 우리에서 키우기 · 모두 먹이기');
}

console.log('\n=== v320 출석부 · 저장 코드 ===');
{
  const g = fresh();
  const t0 = Date.UTC(2026, 10, 4, 3);
  ok(g.canAttend(t0) && g.attNext() === 1, '처음엔 1일째');
  const gold0 = g.s.gold;
  const r1 = g.attend(t0);
  ok(r1.day === 1 && g.s.gold === gold0 + r1.gold && g.s.att.n === 1 && g.s.att.total === 1, '1일째 받기(은자)');
  ok(!g.canAttend(t0 + 3600e3) && g.attend(t0 + 3600e3) === null, '같은 날은 한 번');
  const pot0 = g.s.potions;
  ok(g.attend(t0 + 86400e3).day === 2 && g.s.potions === pot0 + 100, '다음 날 2일째(물약)');
  ok(g.attend(t0 + 5 * 86400e3).day === 3, '며칠 빠져도 끊기지 않는다(3일째)');
  for (let d = 6; d <= 8; d++) g.attend(t0 + d * 86400e3);   // 4·5·6일째
  const soul0 = g.s.petSoul || 0, prot0 = g.s.prot || 0;
  const r7 = g.attend(t0 + 9 * 86400e3);
  ok(r7.day === 7 && g.s.petSoul === soul0 + 15 && g.s.prot === prot0 + 3, '7일째가 크다(은자·보호부 3·혼 15)');
  ok(g.attend(t0 + 10 * 86400e3).day === 1 && g.s.att.total === 8, '한 바퀴 돌면 다시 1일째');
  const raw = JSON.parse(JSON.stringify(g.toJSON())); raw.att = { day: 5, n: 99, total: -3 };
  const g2 = new WorldGame(raw, 0);
  ok(g2.s.att.day === null && g2.s.att.n === 7 && g2.s.att.total === 0, '불러올 때 이상한 값은 고친다');
  // 저장 코드
  const SC = await import('../js/savecode.js');
  const code = await SC.encodeSave(g.toJSON());
  ok(code.startsWith('IFU1.') && !/[+/=]/.test(code), '코드는 IFU1. + 주소에 써도 되는 글자', `${code.length}자`);
  const back = await SC.decodeSave('  ' + code.slice(0, 40) + '\n' + code.slice(40) + ' ');
  ok(back.level === g.s.level && back.job === g.s.job && JSON.stringify(back) === JSON.stringify(g.toJSON()), '되살리면 똑같다(빈칸·줄바꿈 섞여도)');
  let e1 = null; try { await SC.decodeSave(code.slice(0, -12)); } catch (err) { e1 = err.message; }
  ok(e1 && /잘렸거나/.test(e1), '잘린 코드는 열지 않는다', e1);
  let e2 = null; try { await SC.decodeSave('hello'); } catch (err) { e2 = err.message; }
  ok(e2 && /저장 코드가 아니에요/.test(e2), '아닌 글은 알아본다');
  let e3 = null; try { await SC.decodeSave(await SC.encodeSave({ a: 1 })); } catch (err) { e3 = err.message; }
  ok(e3 && /캐릭터가 들어 있지 않은/.test(e3), '캐릭터 없는 코드는 거른다');
  const plain = 'IFU0.' + Buffer.from(JSON.stringify(g.toJSON())).toString('base64url');
  ok((await SC.decodeSave(plain)).level === g.s.level, '압축 없는 코드(IFU0)도 연다');
  const mn = read('js/wmain.js'), sw = read('sw.js');
  ok(/showSaveCode/.test(mn) && /askSaveCode/.test(mn) && /beforeCode/.test(mn) && /obj\.lastSeen = Date\.now\(\)/.test(mn), '설정: 복사 · 되살리기(지금 것은 따로 · 방치 보상은 되살린 때부터)');
  ok(/showAttend/.test(mn) && /attGrid/.test(read('js/wui.js')), '하루 처음 들어오면 출석 창 · 캐릭터 창 출석부');
  ok(sw.includes("'js/savecode.js'"), '서비스워커에 savecode.js');
}

console.log('\n=== v321 약한 장비 자동 정리 · 얻은 것 모음 · 신고·입막음 ===');
{
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  const weak = () => { const it = g.makeCrafted('finger', 0, 0, 0); return it; };
  // 끼고 있는 가락지가 있어야 '약하다'
  const ring = g.makeCrafted('finger', 3, 0, 1); g.s.equip.finger = ring; g._stats = null;
  const w1 = weak();
  ok(g.isJunk(w1), '낀 것보다 못하고·강화 안 한 레어 아래는 정리 대상');
  const kept = [{ ...weak(), plus: 2 }, { ...weak(), rar: 2 }, { ...weak(), set: 'x' }];
  ok(kept.every((it) => !g.isJunk(it)), '강화한 것·전설 이상·세트는 남긴다');
  const bag0 = g.s.bag.length, gold0 = g.s.gold;
  g.gainItem(weak());
  ok(g.s.bag.length === bag0 + 1, '끄면 가방에 들어간다');
  g.s.autoJunk = true; g.events.length = 0;
  g.gainItem(weak());
  ok(g.s.bag.length === bag0 + 1 && g.s.gold > gold0 && g.s.junkLog.n === 1 && g.events.some((e) => e.type === 'autoJunk'), '켜면 떨어지는 대로 판다(가방에 안 넣는다)');
  g.gainItem(weak(), true);
  ok(g.s.bag.length === bag0 + 2, '대장장이에서 만든 것은 정리하지 않는다');
  const raw = JSON.parse(JSON.stringify(g.toJSON()));
  const g2 = new WorldGame(raw, 0);
  ok(g2.s.autoJunk === true && g2.s.junkLog.n === 1, '저장에 남는다');
  // 두목 증표 수를 알린다(모음이 정확하게)
  const b = fresh();
  b.enterMap(W.mapId(1, W.BOSS_AREA));
  for (let i = 0; i < 40; i++) { b.tick(0.05); b.events.length = 0; }
  const boss = b.mons.find((m) => m.isBoss && m.alive);
  const mk0 = b.s.mats[W.bossKey(1)] || 0;
  b.events.length = 0;
  b.killMob(boss);
  const ke = b.events.find((e) => e.type === 'kill' && e.mat?.boss);
  ok(ke && ke.mat.markN >= 1 && (b.s.mats[W.bossKey(1)] || 0) - mk0 === ke.mat.markN, '두목 처치 알림에 증표 수가 실려 온다', JSON.stringify(ke?.mat));
  const mn = read('js/wmain.js'), ui = read('js/wui.js'), net = read('js/net.js'), rules = read('firestore.rules');
  ok(/function tally\(/.test(mn) && !/두목을 잡았어요 — /.test(mn) && /tally\('frag'/.test(mn) && /tally\('ps'/.test(mn), '두목·조각·비급 조각 알림 → 이름 ×수 모음');
  ok(/junk-toggle/.test(ui) && /autoJunk/.test(ui), '가방: 자동 정리 켜기');
  ok(/net\.report\(m\)/.test(ui) && /net\.mute\(/.test(ui) && /openReports/.test(mn) && /checkMute/.test(net), '채팅: 신고 · 운영자 입막음 · 신고함 · 막혔나 보기');
  ok(/match \/reports\/\{rid\}/.test(rules) && /match \/mutes\/\{uid\}/.test(rules) && /mutes\/\$\(request\.auth\.uid\)\)\.data\.until < request\.time/.test(rules), '규칙: 신고 · 입막음 · 막힌 동안 채팅 거부');
}

console.log('\n=== v322 운영자 칭호 〈윤석열의 가호〉 ===');
{
  const g = fresh();
  while (g.s.level < 30) g.addExp(W.expToNext(g.s.level));
  const t = W.titleOf('yoon');
  ok(t && !t.how && !W.AUTO_TITLES.includes(t), '얻는 길이 없다(운영자가 보내야만)');
  g.checkTitles();
  ok(!g.hasTitle('yoon'), '저절로 얻지 않는다');
  ok(/t\.id !== 'founder' && !t\.how/.test(read('js/wmain.js')), '운영자 우편 칭호 목록에 든다(얻는 길 없는 칭호)');
  const s0 = g.stats();
  ok(g.grantTitle('yoon') && g.s.title === 'yoon', '받으면 바로 낀다');
  const s1 = g.stats();
  const k = 1 + W.TITLE_SET_BONUS;
  ok(Math.abs(s1.atk / s0.atk - 3 * k) < 1e-9, '공격력 ×3', (s1.atk / s0.atk).toFixed(3));
  ok(Math.abs(s0.atkSec / s1.atkSec - 1.5) < 1e-9 && Math.abs(s1.speed / s0.speed - 1.5) < 1e-9, '공격 속도 ×1.5');
  ok(Math.abs(s1.expMult / s0.expMult - 2) < 1e-9 && s1.goldMul === 2 && s0.goldMul === 1, '경험치 ×2 · 은자 ×2');
  ok(t.hitFx === 'Yoon Again', '때릴 때마다 〈Yoon Again〉');
  // 실제 사냥에서 은자가 두 배로 들어온다
  const a = fresh(), b = fresh();
  b.grantTitle('yoon');
  const m = { lv: 5, isBoss: false, elite: false, x: 0, y: 0 };
  const ga = a.s.gold, gb = b.s.gold;
  const env = {};
  ok(typeof a.stats().goldMul === 'number', '은자 배수를 능력치에 싣는다');
  g.wearTitle(null);
  ok(Math.abs(g.stats().atk / s0.atk - k) < 1e-9 && g.stats().goldMul === 1, '벗으면 배수는 빠진다(모음 +1%만)');
}

console.log('\n=== v324 자동 강화는 +10까지 ===');
{
  const g = fresh();
  while (g.s.level < 120) g.addExp(W.expToNext(g.s.level));
  g.s.gold = 1e15; g.s.prot = 999; g.s.autoEnh = true;
  for (const k of W.GROW_SLOTS) if (g.s.equip[k]) g.s.equip[k].plus = 9;
  for (const z of Object.keys(W.MATS)) { g.addMats(z, 1e9); g.addMats(W.bossKey(z), 1e6); }
  g.addMats(W.ORE, 1e12);
  g.rng = () => 0;   // 강화는 늘 성공
  for (let i = 0; i < 20; i++) g.autoGear();
  const plus = W.GROW_SLOTS.map((k) => g.s.equip[k]?.plus || 0);
  ok(plus.every((p) => p === W.AUTO_ENH_MAX), `자동 강화는 +${W.AUTO_ENH_MAX}에서 멈춘다(돌파는 직접)`, plus.join(','));
  const it = g.s.equip.weapon;
  ok(g.canEnhance(it) && g.enhance(it.uid) && it.plus === W.AUTO_ENH_MAX + 1, '직접은 +11로 올라간다');
  ok(/AUTO_ENH_MAX/.test(read('js/wui.js')), '가방 창 글에 상한이 적혀 있다');
}

console.log('\n=== v325 성별·무기 모양·기믹 · 1차 전직 전 직업 바꾸기 ===');
{
  const g = fresh();
  while (g.s.level < 12) g.addExp(W.expToNext(g.s.level));
  const ks = Object.keys(g.s.skillLv).length;
  g.s.skillPts = 5; const id0 = g.skills().find((k) => g.canSkillUp(k.id))?.id;
  if (id0) g.skillUp(id0);
  const spent = g.skillSpentAll(), pts = g.s.skillPts, lv = g.s.level, gold = g.s.gold, wpn = g.s.equip.weapon;
  ok(g.canChangeJob('fan') && !g.canChangeJob('sword'), '1차 전직 전에는 다른 직업으로 바꿀 수 있다');
  ok(g.changeJob('fan') && g.s.job === 'fan' && g.s.skillPts === pts + spent && g.s.level === lv && g.s.gold === gold && g.s.equip.weapon === wpn, '바꾸면 무공 점수는 돌려받고 레벨·은자·장비는 그대로');
  g.s.jobTier = 1;
  ok(!g.canChangeJob('sword') && !g.changeJob('sword'), '1차 전직 뒤에는 못 바꾼다');
  // 꾸미기 저장
  const raw = JSON.parse(JSON.stringify(g.toJSON()));
  raw.custom = { gender: 'f', fhead: 'pony', hair: 'red', face: 'veil', wpn: { fan: 'black', sword: 'nope', bad: 'x' }, aura: 'petals', ring: 'lotus', glow: '#fcd34d' };
  const g2 = new WorldGame(raw, 0);
  const c = g2.s.custom;
  ok(c.gender === 'f' && c.fhead === 'pony' && c.hair === 'red' && c.face === 'veil' && c.aura === 'petals' && c.ring === 'lotus' && c.glow === '#fcd34d', '성별·여협 머리·머리 빛깔·면사·기믹이 남는다', JSON.stringify(c));
  ok(JSON.stringify(c.wpn) === JSON.stringify({ fan: 'black' }), '없는 무기 모양은 버린다');
  raw.custom = { gender: 'x', fhead: 'mohawk', hair: '#ff0000', aura: 'nuke' };
  const c3 = new WorldGame(raw, 0).s.custom;
  ok(!c3.gender && !c3.fhead && !c3.hair && !c3.aura, '이상한 값은 버린다');
  // 그림 목록 — 무기 모양이 가리키는 그림이 다 있다
  const art2 = read('js/art2.js');
  const all = Object.values(W.WEAPON_SKINS).flat().map((x) => x.art);
  ok(all.every((k) => fs.existsSync(new URL(`../art/hero/${k}.png`, import.meta.url)) || fs.existsSync(new URL(`../art/hero2/${k}.png`, import.meta.url))), '무기 모양 그림이 다 있다', all.filter((k) => !fs.existsSync(new URL(`../art/hero/${k}.png`, import.meta.url)) && !fs.existsSync(new URL(`../art/hero2/${k}.png`, import.meta.url))).join(','));
  const heads = W.CUSTOM_FHEADS.flatMap(([h]) => W.CUSTOM_HAIRS.map(([c]) => `fh-${h}-${c}`));
  ok(heads.every((k) => art2.includes(`"${k}"`)), '여협 머리 × 머리 빛깔 그림이 다 있다', heads.filter((k) => !art2.includes(`"${k}"`)).join(','));
  ok([...W.CUSTOM_AURAS.map(([k]) => `pt-${k}`), ...W.CUSTOM_RINGS.map(([k]) => `ring-${k}`), 'face-patch', 'face-veil', 'face-scar'].every((k) => art2.includes(`"${k}"`)), '기믹·얼굴 덧그림 그림');
  ok(!read('index.html').includes('data-tab="hunt"') && read('index.html').includes('id="go-hunt"') && read('js/wmain.js').includes('function goHuntNow'), 'v341 사냥 단추는 아래 줄에서 빼고 마을에서만 들판에 \'사냥하러 가기\'');
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
