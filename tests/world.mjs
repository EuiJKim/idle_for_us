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
  ok(g.mons.every((m) => m.lv >= 1 && m.lv <= 6 && Number.isFinite(m.hp) && m.def?.look), '몹 레벨이 사냥터 범위 안이고 생김새가 있다');
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
  ok(g.mons.filter((m) => m.alive).length >= W.MOBS_ALIVE - 6, '잡힌 자리는 다시 채워진다', `${g.mons.length}마리`);
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
  ok(maxStep <= W.HERO_SPEED * 0.05 + 0.01, '칸 사이를 미끄러지듯 옮겨 간다(순간이동 없음)', `${maxStep.toFixed(1)}`);
  ok(g.s.kills > 20, '칸 길로도 사냥이 잘 된다', `5분 ${g.s.kills}마리`);
  // 손으로 찍은 칸으로 간다
  const h = fresh();
  h.enterMap(11);
  for (const m of h.mons) m.alive = false;
  h.moveTo(W.tileCenter(1), W.tileCenter(2));
  for (let t = 0; t < 20; t += 0.05) h.tick(0.05);
  ok(h.hc === 1 && h.hr === 2 && !h.hmove, '누른 칸으로 걸어가 선다', `${h.hc},${h.hr}`);
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
    drops += d.events.filter((e) => e.type === 'drop').length; d.events.length = 0;
    d.s.map = W.mapId(16, 4); d.dropMats({ lv: 105, isBoss: true, x: 0, y: 0 });
    kdrops += d.events.filter((e) => e.type === 'drop' && W.stepMap(e.item.step) === 16).length; d.events.length = 0;
  }
  ok(Math.abs(drops / 2000 - W.BOSS_ITEM_RATE) < 0.03 && Math.abs(kdrops / 2000 - W.KING_ITEM_RATE) < 0.04, '두목은 가끔 장비를 떨군다(십이지왕은 더 자주)', `${(drops / 20).toFixed(1)}% · 왕 ${(kdrops / 20).toFixed(1)}%`);
  h.dropMats({ lv: 6, isBoss: true });
  ok(h.s.mats[W.bossKey(1)] === 1 && h.s.mats[1] === n + W.BOSS_MATS, '두목은 재료 한 움큼과 증표를 떨군다', W.matName(W.bossKey(1)));
  // 조합 사다리: 청죽검 → 상급 청죽검 → 사철검
  const g = fresh();
  g.s.gold = 1e7;
  ok(g.craft('weapon', 0) === null, '재료가 모자라면 조합할 수 없다');
  g.s.mats = { 1: 1000, b1: 20, 2: 1000, b2: 20 };
  ok(JSON.stringify(g.nextSteps('weapon')) === '[0]', '처음엔 사냥터 1 하급만 만들 수 있다');
  ok(g.craft('weapon', 2) === null, '아래 장비 없이 위 장비는 못 만든다');
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
  const w2 = g.craft('weapon', 2);
  ok(w2 && W.stepMap(w2.step) === 2 && w2.ilv === W.craftIlv(2), '다음 사냥터 하급은 앞 사냥터 장비를 받는다', W.itemName(w2, 'sword'));
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
  ok(W.ZONES_W.length - 1 === 27 && W.MAPS.length === 1 + 27 * 4, '지역 27(보통 15 + 십이지왕 12) × 구역 넷(1·2·3·두목)', `${W.MAPS.length - 1}구역`);
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
  const it = k.makeCrafted('weapon', W.NORMAL_ZONES * 2);
  ok(Object.keys(k.itemStats(it)).join() === 'atk' && W.itemName(it, 'sword').startsWith('유혼'), '권왕 하급 무기 — 유혼검(왕의 덤 힘은 없다)', W.itemName(it, 'sword'));
  const kk = fresh();
  kk.s.gold = 1e12; kk.s.equip.weapon = null;
  for (let z = 1; z <= W.TIER_COUNT; z++) { kk.s.mats[z] = 1e5; kk.s.mats[W.bossKey(z)] = 100; }
  let okLadder = true;
  for (let st = 0; st < W.TIER_COUNT * 2; st++) if (!kk.craft('weapon', st)) okLadder = false;
  ok(okLadder && W.itemName(kk.s.equip.weapon, 'sword') === '상급 무형검', '조합 사다리 끝은 상급 무형검(검왕)', W.itemName(kk.s.equip.weapon, 'sword'));
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
  for (const sl of W.SLOTS) { g.s.equip[sl.id] = null; for (let st = 0; st < 20; st++) g.craft(sl.id, st); }
  // 장비 몫 = 장비를 다 벗었을 때 줄어드는 만큼. 흔한 차림(유니크 +6)으로 잰다.
  for (const it of Object.values(g.s.equip)) { it.rar = 1; it.plus = 6; }
  g._stats = null;
  const st = g.stats();
  const keep = g.s.equip;
  g.s.equip = { weapon: null, armor: null, hat: null, acc: null }; g._stats = null;
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

console.log('\n=== 전직·스킬 ===');
{
  const g = fresh();
  ok(g.skills().length === 0, '전직 전에는 스킬이 없다');
  g.s.level = 15; g.s.gold = 1000;
  ok(g.canAdvance() && g.advance() && g.s.jobTier === 1 && g.skills().length === 1, '레벨 15에 마을에서 1차 전직 → 스킬 하나');
  g.s.level = 40; g.s.gold = 1e6;
  g.enterMap(11);
  ok(g.canAdvance() && g.advance(), '전직은 사냥터에서도 된다');
  ok(g.s.jobTier === 2 && g.skills().length === 2, '2차 전직 → 스킬 둘');
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
      if (t % 30 < 0.1) for (const sl of W.SLOTS) for (const st of g.nextSteps(sl.id).reverse()) if (g.craft(sl.id, st)) break;
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
