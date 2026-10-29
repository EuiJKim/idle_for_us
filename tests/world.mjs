// 바람식 개편 점검 — 새 엔진(js/world)이 약속대로 도는가.
// node tests/world.mjs
import { WorldGame, newWorldSave, migrateWorld } from '../js/world/wgame.js';
import * as W from '../js/world/wdata.js';
import * as D from '../js/data.js';
import { fmt } from '../js/fmt.js';

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
  ok(!g.canEnter(W.mapId(1, 3)) && g.canEnter(W.mapId(1, 1)) && !g.canEnter(W.mapId(16, 1)), '레벨이 모자란 구역은 못 들어간다');
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
    maxStep = Math.max(maxStep, Math.hypot(g.heroX - px, g.heroY - py));
    px = g.heroX; py = g.heroY;
    samples++;
    if (g.map.town) { g.enterMap(11); px = g.heroX; py = g.heroY; }
  }
  ok(offGrid === 0, '멈춰 있으면 늘 칸 가운데에 선다', `${offGrid}/${samples}`);
  ok(clash === 0, '한 칸에는 하나만 선다', `${clash}`);
  ok(maxStep <= W.HERO_SPEED * g.stats().moveSpeed * (1 + (g.envNow().move || 0)) * 0.05 + 0.01, '칸 사이를 미끄러지듯 옮겨 간다(순간이동 없음)', `${maxStep.toFixed(1)}`);
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
  const p0 = strong.plus;
  let tries = 0;
  while (strong.plus === p0 && tries++ < 20) g.enhance(strong.uid);
  ok(strong.plus === p0 + 1, '강화하면 +1', `+${strong.plus}`);
  for (let i = 0; i < 200; i++) g.enhance(strong.uid);
  ok(strong.plus === g.enhanceMax(strong) && g.enhanceMax(strong) === W.ENHANCE_NORMAL, '옛 장비는 +10까지(돌파 없음)', `+${strong.plus}`);
}

console.log('\n=== 재료와 조합 (바람식) ===');
{
  // 몹은 장비가 아니라 그 사냥터 재료를 떨군다. 두목은 한 움큼 + 증표.
  const h = fresh();
  h.enterMap(11);
  let n = 0;
  for (let i = 0; i < 10000; i++) if (h.dropMats({ lv: 5, isBoss: false })) n++;
  ok(Math.abs(n / 10000 - W.MAT_RATE) < 0.02, '몹 재료 확률이 설계대로', `${(n / 100).toFixed(1)}%`);
  ok(h.s.mats[1] === n && !h.s.bag.length && h.s.equip.weapon?.starter, '졸개는 재료만 떨군다(장비는 안 떨군다)', `${W.MATS[1]} ${h.s.mats[1]}`);
  // 두목은 가끔 그 지역 하급 장비를 통째로 — 십이지왕은 더 자주
  const d = fresh();
  let drops = 0, kdrops = 0;
  for (let i = 0; i < 2000; i++) {
    d.s.map = W.mapId(1, 4); d.dropMats({ lv: 9, isBoss: true, x: 0, y: 0 });
    drops += d.events.filter((e) => e.type === 'drop' && !W.isDropOnly(e.item.slot)).length; d.events.length = 0;
    d.s.map = W.mapId(16, 4); d.dropMats({ lv: 105, isBoss: true, x: 0, y: 0 });
    kdrops += d.events.filter((e) => e.type === 'drop' && e.item.king === 16).length; d.events.length = 0;
  }
  ok(Math.abs(drops / 2000 - W.BOSS_ITEM_RATE) < 0.03 && Math.abs(kdrops / 2000 - W.KING_ITEM_RATE) < 0.04, '두목은 가끔 장비를 떨군다(십이지왕은 더 자주)', `${(drops / 20).toFixed(1)}% · 왕 ${(kdrops / 20).toFixed(1)}%`);
  h.dropMats({ lv: 6, isBoss: true });
  ok(h.s.mats[W.bossKey(1)] === 1 && h.s.mats[1] === n + W.BOSS_MATS, '두목은 재료 한 움큼과 증표를 떨군다', W.matName(W.bossKey(1)));
  // 조합 사다리: 청죽검 → 상급 청죽검 → 사철검
  const g = fresh();
  g.s.gold = 1e7;
  ok(g.craft('weapon', 0) === null, '재료가 모자라면 조합할 수 없다');
  g.s.mats = { 1: 1000, b1: 20, 2: 1000, b2: 20 };
  // v120: 아래 장비 없이도 재료만 있으면 — 대신 재료가 NO_BASE_MULT배
  {
    const f = fresh(); f.s.gold = 1e7; f.s.mats = { 2: 1000 };
    const need = f.craftCheck('weapon', 2).r.mats[2];
    const it = f.craft('weapon', 2);
    ok(it && it.step === 2 && need === Math.ceil(W.recipeOf('weapon', 2).mats[2] * W.NO_BASE_MULT) && f.s.mats[2] === 1000 - need, '아래 장비 없이도 재료만 있으면 만든다(재료 1.5배)', `${need}개`);
    ok(f.craftSteps().includes(2) && f.craftSteps().length >= 4, '대장장이 목록: 들어갈 수 있는 지역 + 다음 지역', `${f.craftSteps().length}칸`);
  }
  const w0 = g.craft('weapon', 0);
  ok(w0 && g.s.equip.weapon === w0 && W.itemName(w0, 'sword') === '청죽검', '하급은 재료와 은자로 — 바로 낀다', W.itemName(w0, 'sword'));
  const r1 = W.recipeOf('weapon', 1);
  ok(r1.mats[W.bossKey(1)] > 0 && r1.from[0] === 0, '상급은 하급 + 재료 + 두목 증표');
  w0.plus = 6;
  const atk0 = g.stats().atk;
  const m1 = g.s.mats[1];
  const w1 = g.craft('weapon', 1);
  ok(w1 && g.s.equip.weapon === w1 && !g.findItem(w0.uid), '조합하면 아래 장비는 사라지고 위 장비를 낀다', W.itemName(w1, 'sword'));
  ok(w1.plus === 3, '강화는 절반을 이어받는다', `+${w1.plus}`);
  ok(g.s.mats[1] === m1 - r1.mats[1], '재료를 쓴다');
  ok(g.stats().atk > atk0, '공격력이 오른다', `${Math.round(atk0)} → ${Math.round(g.stats().atk)}`);
  const m2 = g.s.mats[2];
  const w2 = g.craft('weapon', 2);
  ok(w2 && W.stepMap(w2.step) === 2 && w2.ilv === W.craftIlv(2) && m2 - g.s.mats[2] === W.recipeOf('weapon', 2).mats[2], '아래 장비를 넣으면 재료가 그대로(덜 든다)', W.itemName(w2, 'sword'));
  // 아래 장비는 바로 아래 칸이 아니어도 된다 (청죽검으로 혈석검)
  {
    const f = fresh(); f.s.gold = 1e7; f.s.mats = { 1: 1000, 4: 1000 };
    const a = f.craft('weapon', 0); a.plus = 8;
    const b = f.craft('weapon', 6);
    ok(b && b.plus === 4 && !f.findItem(a.uid), '몇 칸 아래 장비를 넣어도 강화 절반을 이어받는다', `+${b.plus}`);
  }
  // 사다리 끝까지 — 칸마다 강해지기만
  const z = fresh();
  z.s.gold = 1e12;
  for (let k = 1; k <= W.TIER_COUNT; k++) { z.s.mats[k] = 1e5; z.s.mats[W.bossKey(k)] = 100; }
  let mono = true;
  let prev = 0;
  for (let st = 0; st < W.TIER_COUNT * 2; st++) {
    const it = z.craft('armor', st);
    if (!it) { mono = false; break; }
    const sc = z.itemScore(it);
    if (sc <= prev) mono = false;
    prev = sc;
  }
  ok(mono && z.s.equip.armor.step === W.TIER_COUNT * 2 - 1, `조합 사다리 ${W.TIER_COUNT * 2}칸이 이어지고 갈수록 강하다`, W.itemName(z.s.equip.armor, 'sword'));
  ok(z.nextSteps('armor').length === 0, '끝에 닿으면 더 만들 것이 없다');
  // 옛 판(드랍) 장비도 그대로 읽힌다
  const legacy = { slot: 'weapon', ilv: 10, grade: 2, plus: 1, uid: 99999 };
  ok(Number.isFinite(g.itemStats(legacy).atk), '옛 드랍 장비도 수치가 나온다');
}

console.log('\n=== 지역·구역·두목 구역 ===');
{
  ok(W.ZONES_W.filter(Boolean).length === 33 && W.MAPS.length === 1 + 33 * 4, '지역 33(보통 15 + 새 지역 6 + 십이지왕 12) × 구역 넷(1·2·3·두목)', `${W.MAPS.length - 1}구역`);
  const g = fresh();
  g.enterMap(W.mapId(1, 1));
  for (let i = 0; i < 20 * 300; i++) { g.tick(0.05); g.events.length = 0; if (g.map.town) g.enterMap(W.mapId(1, 1)); }
  ok(!g.mons.some((m) => m.isBoss) && !g.s.mats[W.bossKey(1)], '들판 구역에는 두목이 없고 증표도 안 나온다');
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
  k.s.level = 98;
  ok(!k.canEnter(W.mapId(16, 1)), '레벨 98에는 십이지왕에 못 들어간다');
  k.s.level = 99;
  ok(k.canEnter(W.mapId(16, 1)) && W.mapOf(W.mapId(16, 1)).name.includes('권왕'), '레벨 99부터 제12왕 권왕', W.mapOf(W.mapId(16, 1)).name);
  ok(W.ZONES_W[27].name.includes('검왕') && W.zoneLv(27)[1] === 150, '마지막은 제1왕 검왕(가장 강하다)', W.ZONES_W[27].boss.name);
  ok(new Set(W.KINGS.map((x) => x.mat)).size === 12 && W.KINGS.every((x) => !W.MATS.slice(1, 16).includes(x.mat)), '왕마다 재료가 다르다');
  ok(W.TIER_COUNT === W.NORMAL_ZONES && W.craftIlv(W.TIER_COUNT * 2 - 1) === 99, '조합 사다리는 레벨 99에서 끝난다 (v130)');
  const kk = fresh();
  kk.s.gold = 1e12; kk.s.equip.weapon = null;
  for (let z = 1; z <= W.TIER_COUNT; z++) { kk.s.mats[z] = 1e5; kk.s.mats[W.bossKey(z)] = 100; }
  let okLadder = true;
  for (let st = 0; st < W.TIER_COUNT * 2; st++) if (!kk.craft('weapon', st)) okLadder = false;
  ok(okLadder && W.itemName(kk.s.equip.weapon, 'sword') === '상급 천외검', '조합 사다리 끝은 상급 천외검(천외천)', W.itemName(kk.s.equip.weapon, 'sword'));
  // 옛 세이브: 사냥터 3 → 지역 3의 1구역
  const old = migrateWorld({ map: 3, huntMap: 3, bestMap: 5, mats: { 3: 10 } });
  ok(old.map === W.mapId(3, 1) && old.huntMap === W.mapId(3, 1) && old.mats[3] === 10, '옛 세이브의 사냥터 번호를 새 구역으로 옮긴다', `${old.map}`);
}

console.log('\n=== 장비가 강함의 대부분 ===');
{
  const g = fresh();
  ok(g.s.equip.weapon?.starter && W.itemName(g.s.equip.weapon, 'sword') === '수련용 검', '수련용 무기를 들고 시작한다');
  g.s.level = 60; g.s.stats.str = 120; g.s.stats.vit = 60; g._stats = null;
  g.s.gold = 1e12;
  for (let z = 1; z <= 10; z++) { g.s.mats[z] = 1e5; g.s.mats[W.bossKey(z)] = 100; }
  for (const sl of W.CRAFT_SLOTS) { g.s.equip[sl.id] = null; for (let st = 0; st < 20; st++) g.craft(sl.id, st); }
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
  const m0 = g.s.mats[W.stepMap(w.step)];
  const a0 = g.stats().atk;
  let n = 0;
  while (w.plus === 6 && n++ < 40) g.enhance(w.uid);
  ok(w.plus === 7 && g.s.mats[W.stepMap(w.step)] < m0 && g.stats().atk > a0, '강화는 재료를 넣어 장비를 키운다(한 단계에 기본 수치 +12%)', `${W.matName(W.stepMap(w.step))} ${m0} → ${g.s.mats[W.stepMap(w.step)]}`);
  g.s.mats[W.stepMap(w.step)] = 0;
  ok(!g.canEnhance(w), '재료가 없으면 강화할 수 없다');
}

console.log('\n=== 등급 · 스킬 옵션 · 승급 · 돌파 · 스킬 레벨 (v110) ===');
{
  // 조합은 대부분 레어, 두목은 더 잘, 십이지왕은 더더 잘
  const cnt = (w) => { const c = [0, 0, 0, 0]; const r = seeded(); for (let i = 0; i < 20000; i++) c[W.rollRarity(w, r)]++; return c.map((x) => x / 200); };
  const cr = cnt(W.CRAFT_RAR_W), kr = cnt(W.KING_RAR_W);
  ok(cr[0] > 75 && cr[3] === 0 && kr[3] > 7, '등급: 조합은 대부분 레어(신화 없음), 십이지왕 드랍은 신화도', `조합 ${cr.map((x) => x.toFixed(0)).join('/')} · 왕 ${kr.map((x) => x.toFixed(0)).join('/')}`);
  const g = fresh();
  const items = [0, 1, 2, 3].map((r) => g.makeCrafted('weapon', 10, 0, r));
  const atks = items.map((it) => g.itemStats(it).atk);
  ok(atks.every((v, i) => !i || v > atks[i - 1]) && items.map((it) => it.opts.length).join() === '1,1,2,3', '같은 장비도 레어<유니크<전설<신화, 옵션 1·1·2·(2+특수)', atks.map((v) => v.toFixed(0)).join(' < '));
  ok(items[3].opts.some((o) => o.sp), '신화에는 특수 효과', items[3].opts.map(W.optText).join(' / '));
  // 승급
  g.s.gold = 1e9; g.s.mats = { 6: 1000, b6: 100 };
  const w = g.makeCrafted('weapon', 10, 0, 0);
  g.s.equip.weapon = w; g._stats = null;
  const a0 = g.stats().atk;
  ok(g.promote(w.uid) && w.rar === 1 && g.stats().atk > a0, '대장장이 승급: 레어 → 유니크(확정), 공격력이 오른다', `${a0.toFixed(0)} → ${g.stats().atk.toFixed(0)}`);
  g.promote(w.uid); g.promote(w.uid);
  ok(w.rar === 3 && !g.canPromote(w), '신화까지 오르면 더 못 올린다');
  // 조합은 등급·옵션을 이어받는다
  g.s.mats = { 6: 1000, b6: 100, 7: 1000 };
  const before = JSON.stringify(w.opts);
  const nx = g.craft('weapon', 12);
  ok(nx && nx.rar === 3 && JSON.stringify(nx.opts) === before, '위 장비로 조합해도 신화 등급과 옵션을 이어받는다', W.itemName(nx, 'sword'));
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
  ok(L.s.skillPts === Math.max(0, L.s.level - W.SKILL_PT_FROM + 1), '레벨 15부터 레벨마다 스킬 점수 1', `Lv.${L.s.level} 점수 ${L.s.skillPts}`);
  L.s.jobTier = 1;
  const d0 = L.skillMods('s0').dmg;
  let ups = 0; while (L.skillUp('s0')) ups++;
  ok(L.skillLevel('s0') === Math.min(W.SKILL_LV_MAX, 1 + ups) && L.skillMods('s0').dmg > d0 + 0.3, '스킬 레벨을 올리면 피해·숨·범위가 좋아진다', `Lv.${L.skillLevel('s0')} 피해 +${(L.skillMods('s0').dmg * 100).toFixed(0)}%`);
  ok(migrateWorld({ level: 40 }).skillPts === 26 && migrateWorld({ level: 40, skillV: 1, skillPts: 3 }).skillPts === 3, '옛 세이브는 레벨 15부터 오른 만큼 스킬 점수를 한 번에');
  // 돌파
  const B = fresh();
  B.s.gold = 1e12; B.s.mats = { 6: 1e5, b6: 0 };
  const bw = B.makeCrafted('weapon', 10, 10, 0);
  B.s.equip.weapon = bw;
  ok(!B.canEnhance(bw), '+10 위 돌파에는 두목 증표가 든다');
  B.s.mats.b6 = 1000;
  let tries = 0; while (bw.plus < W.ENHANCE_MAX && tries++ < 400) B.enhance(bw.uid);
  ok(bw.plus === W.ENHANCE_MAX && W.enhanceMult(15) > 3.1, `돌파로 +${W.ENHANCE_MAX}까지 — 기본 수치 ×${W.enhanceMult(15).toFixed(1)}`, `${tries}번 · 증표 ${1000 - B.s.mats.b6}개`);
}

console.log('\n=== 십이지왕 신화 · 가락지·귀걸이 · 애완동물 · 탈것 (v111) ===');
{
  // 십이지왕 지역 장비가 신화면 그 왕의 고유 효과
  const g = fresh();
  const kw = g.makeCrafted('weapon', (W.ZONE_COUNT - 1) * 2, 0, 3);        // 검왕 지역
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
  ok(r1 < r15 && Math.abs(r1 - W.acc2DropRate(1)) < 0.015 && a.craft('finger', 4) === null, '가락지·귀걸이는 두목만 떨군다 — 높은 두목일수록 자주(만들 수 없다)', `죽림 ${(r1 * 100).toFixed(1)}% · 천외천 ${(r15 * 100).toFixed(1)}%`);
  // 두목마다 이름·덤 능력이 다르고, 높은 두목 것이 더 좋다
  const lo = a.makeCrafted('finger', 0, 0, 1), hi = a.makeCrafted('finger', 28, 0, 1);
  const sl = a.itemStats(lo), sh = a.itemStats(hi);
  ok(W.itemName(lo) === '청죽환' && W.itemName(hi) === '천외 지환' && sh.atkPct > sl.atkPct * 2, '가락지: 죽림 청죽환 … 천외천 천외 지환 — 높은 두목 것이 훨씬 좋다', `${JSON.stringify(Object.fromEntries(Object.entries(sh).map(([k, v]) => [k, +v.toFixed(3)])))}`);
  const names = new Set(); for (let z = 1; z <= W.ZONE_COUNT; z++) names.add(W.itemName(a.makeCrafted('ear', (z - 1) * 2, 0, 0)));
  ok(names.size === W.ZONE_COUNT, `귀걸이도 두목마다 이름이 다르다(${names.size}가지)`);
  const ring = a.makeCrafted('finger', 4, 0, 1);
  const wpn = a.makeCrafted('weapon', 4, 0, 1);
  ok(a.enhanceRateOf(ring) === W.enhanceRate(0) * W.ACC2_RATE && a.enhanceCost(ring) === a.enhanceCost(wpn) * W.ACC2_COST && a.enhanceMax(ring) === 10, '가락지·귀걸이 강화는 어렵다(성공률 절반·은자 ×3·돌파 없음)');
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
  ok(m.stats().moveSpeed - sp0 >= 0.8 && m.stats().atk > fresh().stats().atk, '탈것: 이동 속도(적토마 +85%)와 공격력·체력 %', `이동 ×${m.stats().moveSpeed.toFixed(2)}`);
  m.gainMount('donkey');
  ok(m.mountNow().name === '적토마', '더 느린 탈것을 얻으면 갈아타지 않는다');
  // 순위: 아래 것보다 위 것이 세다 · 초반 두목은 아주 낮게·아래 순위만
  const top = W.PETS.find((x) => x.tier === 10), low = W.PETS.find((x) => x.tier === 1);
  ok(W.petAtkRatio({ kind: top.id, rar: 0, lv: 1 }) > W.petAtkRatio({ kind: low.id, rar: 0, lv: 1 }) * 2, `애완동물 순위: ${W.PETS.slice().sort((x, y) => y.tier - x.tier).map((x) => x.name).join(' > ')}`);
  const rr = seeded();
  const tiersOf = (z) => { const set = new Set(); for (let i = 0; i < 3000; i++) set.add(W.petOf(W.rollPetKind(z, rr)).tier); return Math.max(...set); };
  ok(W.petDropRate(1) < 0.001 && tiersOf(1) <= 1 && tiersOf(15) === 7 && tiersOf(27) === 10 && W.petDropRate(27) > W.petDropRate(15) * 3,
    '애완동물 드랍: 죽림 0.08%(선학만) … 천외천 0.9%(손오공까지) … 검왕 3.8%(황룡까지)', `${(W.petDropRate(1) * 100).toFixed(2)}% · ${(W.petDropRate(15) * 100).toFixed(2)}% · ${(W.petDropRate(27) * 100).toFixed(2)}%`);
  const mtTop = (z, boss) => { let t = 0; for (let i = 0; i < 3000; i++) t = Math.max(t, W.mountOf(W.rollMount(rr, z, boss)).tier); return t; };
  ok(W.MOUNTS.filter((x) => !x.zodiac).length === 12 && W.MOUNTS.filter((x) => x.zodiac).length === 12 && mtTop(1, true) === 2 && mtTop(27, true) === 12,
    `탈것 열둘(+십이지 신수 열둘은 떨구지 않는다) — 죽림 두목은 노새까지 … 검왕은 청룡마까지`, W.MOUNTS.filter((x) => !x.zodiac).map((x) => x.name).join(' < '));
  let md = 0;
  const mm = fresh();
  for (let i = 0; i < 200000; i++) if (mm.rng() < W.MOUNT_DROP_MOB) md++;
  ok(md < 40, '졸개 탈것 드랍은 아주 드물다', `20만 마리에 ${md}`);
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
  const a = g.makeCrafted('weapon', 0, 0, 0), b = g.makeCrafted('weapon', 1, 0, 0), c = g.makeCrafted('glove', 20, 0, 0);
  const ua = g.itemUnique(a), ub = g.itemUnique(b);
  ok(ua && ub && ua.k === ub.k && ub.v > ua.v && g.itemUnique(c).k !== ua.k, '사다리 장비마다 고유 옵션 — 지역·칸으로 정해지고 상급이 더 크다', `${G.gearKeyText(ua.k, ua.v)} / ${G.gearKeyText(ub.k, ub.v)}`);
  const sp0 = g.stats().speed;
  g.s.equip.weapon = b; g._stats = null;
  ok(g.stats().speed > sp0, '고유 옵션이 능력치에 들어간다 (죽림 무기 → 공격 속도)');
  ok(!g.itemUnique(g.makeCrafted('acc', 4, 0, 0)), '장신구는 고유 옵션 대신 스킬 옵션이 하나 더');
  // 세트
  ok(G.SETS.length === 10 && ['sword', 'fist', 'fan', 'poison', 'ring'].every((j) => G.setsOfJob(j).length === 2) && new Set(G.SETS.map((x) => x.king)).size === 10, '직업마다 세트 둘 — 세트마다 다른 왕');
  ok(Object.values(G.SLOT_KING).sort().join() === '16,17,18,19,20' && Object.keys(G.STONES).sort().join() === '21,22,23,24,25,26,27',
    '전반 다섯 왕은 세트 부위(무기·옷·모자·장갑·신발), 후반 일곱 왕은 강화석 (v132)');
  ok(migrateWorld({ job: 'sword', equip: { armor: { uid: 9, slot: 'armor', king: 27, set: 'formless', ilv: 100, rar: 0, opts: [], plus: 3 } } }).equip.armor.king === 17, '옛 세트 조각은 그 부위 왕(옷 → 철왕) 것이 된다');
  const sw = fresh('sword'); while (sw.s.level < 99) sw.addExp(W.expToNext(sw.s.level)); sw.s.gold = 1e12;
  const plum = G.setOf('plum');
  ok(!sw.craftSet('plum', 'weapon'), '왕의 재료·증표가 없으면 못 만든다');
  for (const z of Object.values(G.SLOT_KING)) { sw.s.mats[z] = 1e5; sw.s.mats[W.bossKey(z)] = 1e3; }
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
  ok(sw.enhanceMats(sw2).key === 'st26' && sw.enhanceMats(sw.s.equip.armor).key === 'st24' && sw.enhanceMax(sw2) === W.ENHANCE_MAX, '세트 무기는 도왕의 강화석, 옷은 살왕의 강화석으로만');
  ok(W.matName('st26').includes('도왕') && W.matName('st24').includes('명부'), '강화석 이름 — ○왕의 ○○석', `${W.matName('st26')} / ${W.matName('st24')}`);
  const p0 = sw2.plus || 0; sw.s.mats.st26 = 500; sw.rng = () => 0;
  ok(sw.enhance(sw2.uid) && sw2.plus === p0 + 1 && sw.s.mats.st26 === 500 - G.stoneN(p0), '강화석으로 강화');
  ok(!sw.canPromote(sw2) || sw2.rar >= 3, '승급은 검왕의 검혼석이 있어야');
  sw.s.mats.st27 = 100; const rr0 = sw2.rar;
  ok(rr0 >= 3 || (sw.promote(sw2.uid) && sw2.rar === rr0 + 1 && sw.s.mats.st27 === 100 - G.promoteStones(rr0)), '검혼석으로 승급');
  sw.s.mats[21] = 100;
  ok(sw.makeStone(21, 5) === 2 && sw.s.mats.st21 === 2 && sw.s.mats[21] === 20, '후반 왕 재료 40개 → 강화석 하나');
  // 공용 장신구
  const ac = fresh('ring'); while (ac.s.level < 99) ac.addExp(W.expToNext(ac.s.level)); ac.s.gold = 1e12; ac.s.mats[17] = 1e4; ac.s.mats.b17 = 100;
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
  ok(old.equip.weapon.step === W.TIER_COUNT * 2 - 1 && old.equip.weapon.plus === 7 && old.equip.weapon.rar === 2 && old.mats[27] > 0 && old.mats.b27 > 0, '옛 왕 사다리 무기 → 사다리 끝으로 + 왕의 재료·증표를 돌려준다', JSON.stringify(old.mats));
  ok(old.equip.ear.king === 21 && old.equip.ear.ilv === 100 && old.equip.ear.step == null && old.gearNote === 2, '옛 왕 귀걸이 → 레벨 100 공용 장신구로');
  ok(migrateWorld(JSON.parse(JSON.stringify(old))).equip.weapon.step === W.TIER_COUNT * 2 - 1, '한 번만 바꾼다');
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
  ok(tg.s.gold - gold0 >= W.mobGold(tm.lv) * 100 && (tg.s.mats[1] || 0) >= L.TREASURE_MATS, '잡으면 은자·재료가 쏟아진다', `은자 +${tg.s.gold - gold0}`);
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
  ok((az.s.mats[3] || 0) > 0 && !az.s.mats[31], '새 지역 몹은 짝 지역 재료를 떨군다', `설원 재료 ${az.s.mats[3]}`);
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
  ok(D.dailyOpen(D.dailyOf('exp'), mon) && !D.dailyOpen(D.dailyOf('gold'), mon) && D.DAILY.every((d) => D.dailyOpen(d, sun)), '요일 던전: 월요일은 수련동 · 일요일은 셋 다');
  ok(!g.canDaily('gold', 1, mon) && g.canDaily('exp', 1, mon) && !g.canDaily('exp', 2, mon), '처음엔 1단계만, 닫힌 요일은 못 들어간다');
  const huntBefore = g.s.huntMap;
  ok(g.startDaily('exp', 1, mon) && g.inst?.kind === 'daily' && g.map.inst && g.mons.length === D.DAILY_ALIVE, '들어가면 던전 구역(몹 열넷)');
  for (const m of g.mons) m.atk = 0;
  let res = null;
  for (let i = 0; i < 2000 && !res; i++) { g.tick(0.05); for (const e of g.events) if (e.type === 'instEnd') res = e; g.events.length = 0; }
  ok(res?.ok && g.dailyBest('exp') === 1 && !g.inst && g.s.map === huntBefore && res.reward.exp > 0, '40마리 잡으면 깨고 사냥터로 돌아온다 (보상 경험치)', JSON.stringify(res?.reward));
  ok(g.dailyLeft('exp', mon) === 2 && g.canSweep('exp', mon), '하루 세 번 — 깬 단계는 소탕');
  const lv0 = g.s.level, e0 = g.s.exp;
  const sw = g.sweepAll(mon);
  ok(sw.length === 2 && g.dailyLeft('exp', mon) === 0 && (g.s.level > lv0 || g.s.exp > e0), '모두 소탕: 남은 둘을 한꺼번에');
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
  g.tick(0.05);
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
      // 30초마다 대장장이 — 만들 수 있는 가장 높은 것
      if (t % 30 < 0.1) for (const sl of W.CRAFT_SLOTS) for (const st of g.nextSteps(sl.id).reverse()) if (g.craft(sl.id, st)) break;
      // 사냥터: 들어갈 수 있는 가장 높은 들판 구역. 상급 조합에 증표가 모자라면 두목 구역에 들른다.
      let best = 11;
      for (const m of W.MAPS) if (!m.town && !m.bossRoom && g.canEnter(m.id) && g.s.level >= m.lv[0] + 1) best = m.id;
      const z = W.mapOf(best).zone;
      const bossRoom = W.mapId(z, W.BOSS_AREA);
      if (g.canEnter(bossRoom) && (g.s.mats[W.bossKey(z)] || 0) < 13 && (g.s.mats[z] || 0) > 100) best = bossRoom;
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

console.log('\n=== 숫자 표기 ===');
{
  const table = [[999, '999'], [1000, '1,000'], [120000, '120,000'], [99999999, '99,999,999'], [1e9, '1.00d']];
  const wrong = table.filter(([n, w]) => fmt(n) !== w).map(([n, w]) => `${n}→${fmt(n)}(${w})`);
  ok(wrong.length === 0, '1억 아래는 쉼표, 그 위는 알파벳', wrong.join(', ') || table.map(([n]) => fmt(n)).join(' '));
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
