// 전체 점검: 모드 전환·세이브 이주·시스템 도달·값 이상 여부를 한 번에 본다.
// node tests/check.mjs
import { Game, newSave, migrate } from '../js/game.js';
import * as D from '../js/data.js';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '  OK  ' : '  !!  '} ${label}${extra ? '  — ' + extra : ''}`);
};

const seeded = (s = 12345) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

function strong(stage = 150) {
  const s = newSave();
  Object.assign(s, {
    stage, bestStage: stage, level: 1200, rank: 5, nickname: '시험',
    skillSlots: ['slash', 'thunder', 'frost', 'meteor'], autoSkill: true,
    gold: 1e18, gems: 1e7, stones: 1e9, books: 1e8, food: 1e7, relicShards: 1e6,
  });
  Object.assign(s.upgrades, { atk: 320, hp: 230, crit: 45, critDmg: 70, speed: 34 });
  for (const k in s.skills) s.skills[k] = 35;
  for (const t of ['weapon', 'armor', 'ring']) { s.codex[t] = [1, 1, 1, 1, 1, 1]; s.equips[t] = [0, 0, 0, 40, 20, 6]; }
  s.enhance = { weapon: 40, armor: 34, ring: 30 };
  const g = new Game(s);
  g.rng = seeded();
  g.spawn();
  return g;
}

// 겨루기류가 끝까지 돌아가는가 (시작 → 결판 → 들판 복귀)
function runContest(g, start, maxSec = 70) {
  const before = g.mode;
  if (!start()) return 'start-failed';
  if (g.mode === before) return 'mode-unchanged';
  const entered = g.mode;
  for (let i = 0; i < 60 * maxSec; i++) {
    g.tick(1 / 60);
    g.events.length = 0;
    if (g.mode === 'stage') return `cleared:${entered}`;
  }
  return `stuck:${entered}`;
}

console.log('\n=== 1. 겨루기류가 전부 결판나는가 ===');
{
  const cases = [
    ['수련터', (g) => g.startDungeon('gold')],
    ['시련', (g) => g.canTrial() && g.startTrial()],
    ['심검 승급', (g) => { g.s.ego.blade = { step: 0, exp: 0 }; g.s.equips.weapon[3] = 99; g.feedEgo('blade', 3, 999); return g.startEgoTrial('blade'); }],
    ['그림자 무림', (g) => g.startShadow()],
    ['혈마의 탑', (g) => g.startTower()],
    ['마기 균열', (g) => g.startSeek('rift')],
    ['비급 탐색', (g) => g.startSeek('hunt')],
  ];
  for (const [name, fn] of cases) {
    const g = strong();
    g.checkDaily(Date.UTC(2026, 9, 19));
    const r = runContest(g, () => fn(g));
    ok(r.startsWith('cleared'), name, r);
  }
}

console.log('\n=== 2. 옛 세이브가 깨지지 않는가 ===');
{
  // 새 시스템이 하나도 없던 시절의 세이브 모양
  const old = {
    v: 1, nickname: '옛유저', gold: 5e6, gems: 3000, stage: 40, maxStage: 40, bestStage: 40,
    level: 60, rank: 1, upgrades: { atk: 20, hp: 14 }, skills: { slash: 5 },
    equips: { weapon: [2, 1, 0, 0, 0, 0], armor: [1, 0, 0, 0, 0, 0], ring: [1, 0, 0, 0, 0, 0] },
    enhance: { weapon: 3 }, pets: { fox: 2 }, pet: 'fox', relics: { sword: 4 },
    dungeons: { gold: 2 }, daily: { date: '', keys: { gold: 1 } }, stats: {},
  };
  const s = migrate(old);
  const g = new Game(s);
  ok(!!s.codex && s.codex.weapon.length === 6, '병기보가 생긴다', `검 ${s.codex.weapon.join('')}`);
  ok(!!s.options && s.options.weapon.length === D.OPTION_SLOTS, '옵션 칸이 생긴다');
  ok(!!s.acc && !!s.accBag, '장신구 자리가 생긴다');
  ok(!!s.lore && s.lore.mob.length === 6, '인물도감이 생긴다');
  ok(!!s.gacha && s.gacha.equip, '소환 레벨이 생긴다');
  ok(!!s.ego && s.ego.blade, '심검이 생긴다');
  ok(!!s.mine && Number.isFinite(s.mine.at), '광맥이 생긴다');
  ok(!!s.tower && s.tower.floor === 0, '탑이 생긴다');
  ok(Number.isFinite(s.seek), '탐색패가 생긴다');
  ok(!!s.shadow, '그림자가 생긴다');
  const st = g.stats();
  ok(Number.isFinite(st.atk) && st.atk > 0, '전투력이 숫자다', `공격력 ${st.atk.toExponential(2)}`);
  for (let i = 0; i < 600; i++) g.tick(1 / 60);
  ok(g.s.stage >= 40, '옛 세이브로도 돌아간다', `관문 ${g.s.stage}`);
}

console.log('\n=== 3. 값이 깨지지 않는가 (NaN / Infinity) ===');
{
  const g = strong(300);
  g.checkDaily(Date.UTC(2026, 9, 19));
  for (let i = 0; i < 60 * 300; i++) { g.tick(1 / 60); g.events.length = 0; }
  const st = g.stats();
  const bad = Object.entries(st).filter(([, v]) => typeof v === 'number' && !Number.isFinite(v));
  ok(bad.length === 0, '스탯에 NaN/Infinity 없음', bad.map(([k]) => k).join(',') || '전부 정상');
  const nums = ['gold', 'gems', 'stones', 'books', 'food', 'relicShards'];
  const badRes = nums.filter((k) => !Number.isFinite(g.s[k]));
  ok(badRes.length === 0, '재화에 NaN 없음', badRes.join(',') || '전부 정상');
  ok(g.mons.every((m) => Number.isFinite(m.x) && Number.isFinite(m.y)), '적 좌표가 전부 숫자');
  ok(Number.isFinite(g.heroX) && Number.isFinite(g.heroY), '무인 좌표가 숫자');
}

console.log('\n=== 4. 물결이 끝까지 도는가 ===');
{
  const g = strong(100);
  const waves = [];
  let clears = 0;
  for (let i = 0; i < 60 * 600 && clears < 3; i++) {
    g.tick(1 / 60);
    for (const e of g.events) {
      if (e.type === 'wave') waves.push(e.wave + 1);
      if (e.type === 'stageClear') clears++;
    }
    g.events.length = 0;
  }
  ok(clears >= 3, '관문을 연달아 돌파한다', `${clears}관문`);
  ok(waves.length >= 6, '물결이 넘어간다', waves.slice(0, 9).join('→'));
  ok(g.s.wave < g.waveTotal(), '물결 번호가 범위 안', `${g.s.wave + 1}/${g.waveTotal()}`);
}

console.log('\n=== 5. 해금 관문이 전부 벽인가 ===');
{
  const walls = [];
  for (const sk of D.SKILLS) if (sk.unlock > 1 && !D.isWallStage(sk.unlock)) walls.push(`무공 ${sk.name} ${sk.unlock}`);
  for (const d of D.DUNGEONS) if (!D.isWallStage(d.unlock)) walls.push(`비경 ${d.name} ${d.unlock}`);
  ok(walls.length === 0, '무공·비경 해금이 전부 벽 자리', walls.join(', ') || '전부 일치');
  const others = [
    ['광맥', D.MINE_OPEN_STAGE], ['균열', D.RIFT_OPEN_STAGE],
    ['탐색', D.HUNT_OPEN_STAGE], ['탑', D.TOWER_OPEN_STAGE],
    ['심검', D.EGO_PARTS[0].open],
  ].filter(([, v]) => !D.isWallStage(v));
  ok(others.length === 0, '새 콘텐츠 해금도 벽 자리', others.map(([n, v]) => `${n} ${v}`).join(', ') || '전부 일치');
}

console.log('\n=== 6. 한 바퀴 돌려 모든 시스템에 닿는가 (6시간) ===');
{
  const g = new Game(newSave(Date.UTC(2026, 9, 19)), Date.UTC(2026, 9, 19));
  g.rng = seeded(999);
  g.spawn();
  g.checkDaily(Date.UTC(2026, 9, 19));
  const T0 = Date.UTC(2026, 9, 19);
  for (let t = 0, step = 0; t < 6 * 3600; t += 0.1, step++) {
    g.tick(0.1);
    g.events.length = 0;
    if (step % 10) continue;
    const now = T0 + t * 1000;
    g.checkDaily(now);
    for (;;) {
      const keys = Object.keys(D.UPGRADES).filter((k) => !g.upgradeMaxed(k));
      const k = keys.reduce((a, b) => (g.upgradeCost(a) <= g.upgradeCost(b) ? a : b));
      if (!g.buyUpgrade(k)) break;
    }
    for (const sk of D.SKILLS) while (g.upgradeSkill(sk.id));
    while (g.s.sp > 0) g.allocSp('atk');
    while (g.s.gems >= 900) g.gacha(10);
    g.mergeAll();
    for (const ty of Object.keys(D.EQUIP_TYPES)) g.enhanceEquip(ty, 5);
    if (step % 600 === 0) {
      g.collectMine(now);
      while (g.s.gold > g.mineDepthCost() * 4 && g.digDeeper(now));
      // 겨루기류는 한 번에 하나만 들어갈 수 있다. 돌아가며 기회를 준다.
      for (const e of D.EGO_PARTS) {
        if (!g.egoOpen(e.id)) continue;
        for (let gr = D.EGO_FEED_MIN_GRADE; gr < 6; gr++) g.feedEgo(e.id, gr, 999);
      }
      if (g.shadowRewardReady()) g.claimShadowRewards();
      const turn = Math.floor(step / 600) % 4;
      const tryList = [
        () => g.egoReady('blade') && g.startEgoTrial('blade'),
        () => g.canShadow() && g.startShadow(),
        () => g.towerOpen() && !g.towerDone() && g.startTower(),
        () => g.canSeek() && g.startSeek(g.huntOpen() ? 'hunt' : 'rift'),
      ];
      for (let i = 0; i < 4 && g.mode === 'stage'; i++) tryList[(turn + i) % 4]();
      for (const kind of ['equip', 'pet', 'relic']) if (g.gachaRewardReady(kind)) g.claimGachaRewards(kind);
    }
  }
  ok(g.s.bestStage >= 140, '6시간에 140관문 넘음', `${g.s.bestStage}관문`);
  ok(g.gachaInfo('equip').lv >= 5, '소환 레벨이 오름', `${g.gachaInfo('equip').lv}레벨`);
  ok(g.towerFloor() > 0, '탑에 오름', `${g.towerFloor()}층`);
  ok(g.s.mine.depth > 0, '광맥을 팜', `깊이 ${g.s.mine.depth}`);
  ok(g.egoOf('blade').step > 0 || !g.egoOpen('blade'), '심검이 오르거나 아직 안 열림', `${g.egoOf('blade').step}단계`);
  ok((g.s.shadow.wins || 0) > 0, '그림자를 이김', `${g.s.shadow.wins}승`);
  ok(g.loreCount('mob') > 0, '인물도감이 적힘', `잡졸 ${g.loreCount('mob')}/6`);
  const accAny = D.ACC_SLOTS.some((a) => g.s.acc[a.id]);
  ok(accAny, '장신구를 얻음', D.ACC_SLOTS.map((a) => (g.s.acc[a.id] ? a.name : '')).filter(Boolean).join(',') || '없음');
}

// ---------- 7. 이번에 더한 다섯 ----------
console.log('\n=== 7. 무공 칸·물결 보상·상태이상·선택 상자·장비 초월 ===');
{
  // 무공 칸
  ok(D.skillSlotCount(1) === 4 && D.skillSlotCount(180) === 5 && D.skillSlotCount(260) === 6,
    '무공 칸이 관문에 따라 늘어난다',
    `1→${D.skillSlotCount(1)} / 180→${D.skillSlotCount(180)} / 260→${D.skillSlotCount(260)}`);
  ok(D.SKILL_SLOT_AT.every((v) => D.isWallStage(v)), '칸이 열리는 관문이 벽 자리', D.SKILL_SLOT_AT.join(','));
  const g0 = strong(300);
  ok(g0.skillSlotCount() === 6, '300관문이면 여섯 칸', `${g0.skillSlotCount()}칸`);
  const g1 = strong(50);
  ok(g1.setSkillSlot(5, 'thunder') === false, '안 열린 칸에는 못 넣는다');

  // 물결 보상
  const total = D.waveCount(300);
  const rs = Array.from({ length: total }, (_, w) => D.waveReward(300, w, total));
  ok(rs.every((r) => r.gold > 0 && r.stones > 0), '물결마다 보상이 있다', rs.map((r) => Math.round(r.gold)).join(' / '));
  ok(rs[total - 1].gold > rs[0].gold, '뒤쪽 물결이 더 크다', `${Math.round(rs[0].gold)} → ${Math.round(rs[total - 1].gold)}`);
  ok(rs[total - 1].books > 0 && rs[0].books === 0, '비급은 마지막 물결에만');
  // 물결은 '관문 안의 작은 성취'다. 처치 은자를 넘으면 본 보상이 뒤집힌다.
  const waveGold = rs.slice(0, total - 1).reduce((s2, r) => s2 + r.gold, 0);
  const killGold = D.monsterGold(300) * D.KILLS_PER_STAGE;
  ok(waveGold < killGold, '물결 보상이 처치 은자보다 작다',
    `물결 ${Math.round(waveGold)} vs 처치 ${Math.round(killGold)}`);

  // 상태이상 — 적이 살아남도록 일부러 약하게 만든다
  const s2 = newSave();
  Object.assign(s2, { stage: 150, bestStage: 150, level: 200,
    skillSlots: ['slash', 'thunder', 'frost', 'meteor'], autoSkill: false });
  Object.assign(s2.upgrades, { atk: 60, hp: 60 });
  for (const k in s2.skills) s2.skills[k] = 3;
  const g2 = new Game(s2); g2.rng = seeded(7); g2.spawn();
  for (let i2 = 0; i2 < 900; i2++) g2.tick(1 / 60);
  const alive = () => g2.mons.filter((z) => z.alive);
  g2.useSkill('thunder'); const nSlow = alive().filter((z) => z.slow > 0).length;
  g2.useSkill('slash'); const nBleed = alive().filter((z) => z.bleed > 0).length;
  g2.useSkill('meteor'); const nWeak = alive().filter((z) => z.weak > 0).length;
  ok(nSlow > 0, '둔화가 걸린다', `${nSlow}마리`);
  ok(nBleed > 0, '출혈이 걸린다', `${nBleed}마리`);
  ok(nWeak > 0, '파쇄가 걸린다', `${nWeak}마리`);
  const bled = alive().filter((z) => z.bleed > 0);
  const hp0 = bled.reduce((s3, z) => s3 + z.hp, 0);
  for (let i2 = 0; i2 < 60; i2++) g2.tickCC(1 / 60);
  ok(bled.reduce((s3, z) => s3 + z.hp, 0) < hp0, '출혈이 실제로 피해를 준다');
  const slowOnes = alive().filter((z) => z.slow > 0);
  for (let i2 = 0; i2 < 60 * 8; i2++) g2.tickCC(1 / 60);
  ok(slowOnes.every((z) => !(z.slow > 0)), '상태이상이 시간이 지나면 풀린다');
  ok(D.SKILLS.filter((k) => k.cc).length >= 9, '상태이상을 가진 무공 수',
    `${D.SKILLS.filter((k) => k.cc).length}종`);

  // 선택 상자
  const g3 = new Game(newSave()); g3.rng = seeded(3);
  ok(g3.openAccPick('ring', 1) === null, '없으면 못 연다');
  g3.s.accPick = 300;
  const got = g3.openAccPick('ring', 300);
  ok(got.length === 300 && g3.s.accPick === 0, '가진 만큼만 열린다');
  ok(got.every((o) => o.grade >= D.ACC_PICK_MIN), `${D.GRADES[D.ACC_PICK_MIN].name} 이상만 나온다`);
  ok(got.every((o) => o.slot === 'ring'), '고른 자리로만 나온다');
  ok(D.towerReward(20).accPick > 0 && !D.towerReward(21).accPick, '탑은 단이 바뀔 때만 선택 상자');
  const g4 = new Game(newSave()); g4.grant({ accPick: 5 });
  ok(g4.s.accPick === 5, '보상으로 받으면 쌓인다');
  ok(migrate({ accPick: 'xx' }).accPick === 0 && migrate({ accPick: 7 }).accPick === 7,
    '옛 세이브에서도 멀쩡');

  // 장비 초월
  const g5 = new Game(newSave()); const top = D.GRADES.length - 1;
  ok(!g5.canEquipPierce('weapon'), '천품이 없으면 초월 못 함');
  g5.s.equips.weapon[top] = 1;
  ok(!g5.canEquipPierce('weapon'), '끼운 하나는 남겨야 한다');
  g5.s.equips.weapon[top] = 1 + D.equipPierceCost(0);
  const before = g5.equipMult('weapon');
  ok(g5.equipPierceUp('weapon'), '천품을 먹여 초월한다');
  ok(Math.abs(g5.equipMult('weapon') / before - (1 + D.EQUIP_PIERCE_MULT)) < 1e-9,
    '초월 1단계가 배율에 그대로 반영', `×${(g5.equipMult('weapon') / before).toFixed(2)}`);
  g5.s.equips.weapon[top] = 1000;
  let st = 1; while (g5.equipPierceUp('weapon')) st++;
  ok(st === D.EQUIP_PIERCE_MAX, '초월 상한에서 멈춘다', `${st}단계`);
  const used = 1000 - g5.s.equips.weapon[top] + D.equipPierceCost(0);
  ok(used === 21, '6초월에 천품 21개', `${used}개`);
  ok(Object.keys(migrate({}).equipPierce).length === 3, '옛 세이브에 초월 칸이 생긴다');
}

// ---------- 8. 장신구 특기 ----------
console.log('\n=== 8. 장신구 특기 ===');
{
  const g = new Game(newSave());
  // 안 열리는 구간
  ok(D.accSpecialStep(0, 0) === 0 && D.accSpecialStep(D.ACC_SPECIAL_STAR - 1, 6) === 0,
    `${D.ACC_SPECIAL_STAR}성 미만이면 초월이 있어도 안 열린다`);
  ok(D.accSpecialStep(D.ACC_SPECIAL_STAR, 0) === 1, '열리는 성에서 1단');
  ok(D.accSpecialStep(D.ACC_STAR_MAX, D.ACC_PIERCE_MAX) === 10, '끝까지 올리면 10단',
    `${D.accSpecialStep(D.ACC_STAR_MAX, D.ACC_PIERCE_MAX)}단`);

  // 세 자리가 서로 다른 축을 민다 — 이게 깨지면 특기를 넣은 이유가 사라진다
  const stats = D.ACC_SLOTS.filter((a2) => a2.special).map((a2) => a2.special.stat);
  ok(new Set(stats).size === stats.length, '특기가 서로 다른 능력치에 붙는다', stats.join(','));
  ok(D.ACC_SLOTS.every((a2) => !a2.special || a2.special.stat !== a2.stat),
    '특기는 그 자리의 기본 능력과 다른 축');

  // 미달이면 mods에 안 들어간다
  for (const a2 of D.ACC_SLOTS) g.s.acc[a2.id] = { grade: 4, star: D.ACC_SPECIAL_STAR - 1, pierce: 6 };
  const low = g.mods();
  ok(Math.abs(low.boss - D.ACC_SET.boss) < 1e-9 && Math.abs(low.gold - D.ACC_SET.gold) < 1e-9,
    '미달이면 보유 효과만 남는다', `boss ${low.boss} / gold ${low.gold}`);
  ok(D.ACC_SLOTS.every((a2) => g.accSpecial(a2.id).open === false), '미달이면 열림 표시도 꺼짐');

  // 끝까지 올리면 mods에 들어간다
  for (const a2 of D.ACC_SLOTS) g.s.acc[a2.id] = { grade: 4, star: D.ACC_STAR_MAX, pierce: D.ACC_PIERCE_MAX };
  const hi = g.mods();
  for (const a2 of D.ACC_SLOTS) {
    if (!a2.special) continue;
    const want = a2.special.per * 10;
    const got = hi[a2.special.stat] - low[a2.special.stat];
    ok(Math.abs(got - want) < 1e-9, `${a2.name} 〈${a2.special.name}〉이 능력치에 들어간다`,
      `+${(got * 100).toFixed(1)}%`);
  }

  // 특기가 '이미 꽉 찬 축'에 붙으면 아무 일도 안 일어난다.
  // 처음에 연격을 치명 확률에 붙였다가 그 사고를 냈다. 다시는 안 되게 막는다.
  for (const a2 of D.ACC_SLOTS) {
    if (a2.special?.stat !== 'crit') continue;
    fail++;
    console.log('  !!   특기가 치명 확률에 붙어 있다 — 수련 90레벨이면 상한이라 0이 된다');
  }

  // 자리가 비면 0
  const g2 = new Game(newSave());
  ok(D.ACC_SLOTS.every((a2) => g2.accSpecial(a2.id).amount === 0), '장신구가 없으면 특기도 0');
  ok(migrate({}).acc && Object.keys(migrate({}).acc).length === D.ACC_SLOTS.length,
    '옛 세이브에서도 자리가 그대로');
}

// ---------- 9. 상한이 다른 시스템을 죽이고 있지 않은가 ----------
console.log('\n=== 9. 상한과 여유 ===');
{
  // 치명 수련이 혼자 CRIT_CAP을 채우면, 치명 확률을 주는 다른 시스템이 전부 0이 된다.
  // 실제로 그랬다 — 8시간 차에 39.5%p가 버려지고 있었다. 다시는 못 그러게 막는다.
  const capLv = D.UPGRADES.crit.max;
  const fromTrain = D.UPGRADES.crit.value(capLv);
  const room = D.CRIT_CAP - fromTrain;
  ok(room > 0.2, '치명은 수련을 다 해도 상한까지 여유가 남는다',
    `수련 ${(fromTrain * 100).toFixed(0)}% / 상한 ${(D.CRIT_CAP * 100).toFixed(0)}% → 여유 ${(room * 100).toFixed(0)}%p`);

  // 치명 확률을 주는 시스템이 실제로 몇 %p나 되는지 세어, 여유 안에 들어오는지 본다
  let give = 0;
  const add = (o) => { if (o && o.crit) give += o.crit; };
  add(D.CODEX_PER_TYPE); add(D.CODEX_ALL); add(D.OPTION_SET); add(D.OPTION_SET_FULL);
  add(D.ACC_SET); add(D.OUTFIT_ALL); add(D.CODEX_KIND_FULL); add(D.CODEX_ALL_FULL);
  for (const s of D.EQUIP_SET_STEPS) add(s);
  ok(give > 0, '치명 확률을 주는 시스템이 있다', `보유 효과만 합쳐 +${(give * 100).toFixed(0)}%p`);
  ok(give <= room + 0.25, '그 시스템들이 여유를 통째로 넘지는 않는다',
    `시스템 +${(give * 100).toFixed(0)}%p vs 여유 ${(room * 100).toFixed(0)}%p`);

  // 실제 진행 상태에서 버려지는 양 — 강한 세이브로 확인
  const g = strong(300);
  for (const t2 of Object.keys(D.EQUIP_TYPES)) {
    g.s.options[t2] = Array.from({ length: D.OPTION_SLOTS }, () => ({ stat: 'crit', grade: 5, roll: 1 }));
  }
  const raw = D.UPGRADES.crit.value(g.s.upgrades.crit) + g.mods().crit;
  const used = g.stats({ buffs: false }).crit;
  // 옵션 칸을 전부 천품 치명으로 채운 극단이므로 넘치는 건 당연하다.
  // 여기서 보려는 건 '넘치더라도 수련만으로는 안 넘는다'는 것.
  ok(D.UPGRADES.crit.value(g.s.upgrades.crit) < D.CRIT_CAP,
    '수련만으로는 상한에 못 닿는다',
    `수련 ${(D.UPGRADES.crit.value(g.s.upgrades.crit) * 100).toFixed(0)}% < ${(D.CRIT_CAP * 100).toFixed(0)}%`);
  ok(used <= D.CRIT_CAP + 1e-9, '상한은 지켜진다', `${(used * 100).toFixed(1)}%`);
  ok(raw > used, '극단으로 채우면 넘치기는 한다 (상한이 목표가 된다)',
    `합 ${(raw * 100).toFixed(0)}% → 적용 ${(used * 100).toFixed(0)}%`);

  // 옛 세이브의 넘치는 수련 레벨이 정리되는가
  const old = migrate({ upgrades: { crit: 90, speed: 999 } });
  ok(old.upgrades.crit === D.UPGRADES.crit.max, '옛 세이브의 치명 수련이 새 상한으로 맞춰진다',
    `90 → ${old.upgrades.crit}`);
  ok(old.upgrades.speed === D.UPGRADES.speed.max, '속도 수련도 마찬가지', `999 → ${old.upgrades.speed}`);
}

// ---------- 10. 아무도 안 읽는 스탯을 주고 있지 않은가 ----------
console.log('\n=== 10. 죽은 스탯 ===');
{
  // 전에 의복이 '비급'과 '영수밥'을 올려 줬는데 그 둘을 읽는 곳이 없었다.
  // 숫자는 오르는데 아무 일도 안 일어나는 종류의 사고라 눈으로는 안 잡힌다.
  // mods()가 세는 키 = stats()가 읽는 키. 그 바깥을 주면 그대로 버려진다.
  const READ = ['atk', 'hp', 'gold', 'exp', 'crit', 'critDmg', 'boss', 'bossTime', 'offline', 'speed'];
  const bad = [];
  const look = (o, where) => {
    if (!o) return;
    for (const k of Object.keys(o)) if (!READ.includes(k)) bad.push(`${where}.${k}`);
  };
  look(D.CODEX_PER_TYPE, '병기보 부위완성'); look(D.CODEX_ALL, '병기보 전부');
  look(D.OPTION_SET, '옵션칸 보유효과'); look(D.OPTION_SET_FULL, '옵션칸 천품');
  look(D.ACC_SET, '장신구 보유효과'); look(D.OUTFIT_ALL, '의복 전부');
  look(D.CODEX_KIND_FULL, '도감 종류완성'); look(D.CODEX_ALL_FULL, '도감 전부');
  look(D.TOWER_PER_FLOOR, '탑 층당');
  for (const o of D.OUTFITS) look(o.own, `의복 ${o.name}`);
  for (const s of D.EQUIP_SET_STEPS) look(Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'grade')), '장비 세트');
  for (const s of D.EQUIP_TOTAL_STEPS) look(Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'at')), '총 제련');
  for (const r of D.RELICS) if (!READ.includes(r.stat)) bad.push(`유물 ${r.name}.${r.stat}`);
  for (const pet of D.PETS) if (pet.own && !READ.includes(pet.own[0])) bad.push(`영수 ${pet.name}.${pet.own[0]}`);
  for (const o of D.OPTION_STATS) if (!READ.includes(o.id)) bad.push(`옵션 칸.${o.id}`);
  for (const a2 of D.ACC_SLOTS) {
    if (!READ.includes(a2.stat)) bad.push(`장신구 ${a2.name}.${a2.stat}`);
    if (a2.special && !READ.includes(a2.special.stat)) bad.push(`특기 ${a2.special.name}.${a2.special.stat}`);
  }
  for (const k of Object.keys(D.SP_STATS || {})) if (!READ.includes(k)) bad.push(`스탯 포인트.${k}`);

  ok(bad.length === 0, '주는 스탯이 전부 읽힌다', bad.length ? bad.join(', ') : READ.join(', '));

  // mods()가 실제로 그 열 개를 들고 있는지도 본다 (키 이름이 바뀌면 여기서 걸린다)
  const keys = Object.keys(new Game(newSave()).mods());
  const missing = READ.filter((k) => !keys.includes(k));
  ok(missing.length === 0, 'mods()가 그 열 개를 전부 센다', missing.join(',') || '전부 있음');
}

// ---------- 11. 의복이 손에 들어오는가 ----------
console.log('\n=== 11. 의복 ===');
{
  // 의복은 원보로만 살 수 있었고, 원보는 뽑기에도 쓴다. 뽑기 쪽이 압도적이라
  // 8시간을 해도 12종 중 1종밖에 없었다 — 끄고 재니 체감 0.7%.
  // 이제 병기 소환 레벨이 오르면 하나씩 온다. 그게 실제로 도는지 본다.
  ok(D.OUTFIT_GACHA_LVS.length >= D.OUTFITS.length,
    '해금 지점이 의복 수만큼 있다', `${D.OUTFIT_GACHA_LVS.length}곳 / ${D.OUTFITS.length}종`);
  ok(Math.max(...D.OUTFIT_GACHA_LVS) <= D.GACHA_LV_MAX,
    '마지막 해금이 소환 레벨 상한 안에 있다',
    `${Math.max(...D.OUTFIT_GACHA_LVS)} ≤ ${D.GACHA_LV_MAX}`);

  const g = new Game(newSave());
  g.s.gacha.equip.lv = D.GACHA_LV_MAX;
  g.claimGachaRewards('equip');
  ok(g.outfitAll(), '소환 레벨만 올려도 전부 모인다', `${g.outfitCount()}/${D.OUTFITS.length}`);

  // 원보로 미리 산 것과 겹치지 않는가
  const g2 = new Game(newSave());
  g2.s.gems = 1e9;
  g2.buyOutfit(D.OUTFITS[4].id);
  g2.buyOutfit(D.OUTFITS[7].id);
  const before = g2.outfitCount();
  g2.s.gacha.equip.lv = D.GACHA_LV_MAX;
  const r = g2.claimGachaRewards('equip');
  const ids = Object.keys(g2.s.outfits);
  ok(before === 2 && ids.length === new Set(ids).size, '미리 산 것과 겹치지 않는다',
    `미리 ${before}개 + 받은 ${r.outfits.length}개 = ${g2.outfitCount()}개`);
  ok(g2.outfitCount() === D.OUTFITS.length, '겹쳐도 결국 전부 모인다',
    `${g2.outfitCount()}/${D.OUTFITS.length}`);

  // 중간 단계에서 '다음은 몇 레벨'이 맞는가
  const g3 = new Game(newSave());
  g3.s.gacha.equip.lv = 5;
  g3.claimGachaRewards('equip');
  const at = g3.nextOutfitAt();
  ok(at !== null && at > 5, '다음 해금 레벨을 알려준다', `${g3.outfitCount()}개 보유 · 다음 ${at}레벨`);
  g3.s.gacha.equip.lv = D.GACHA_LV_MAX;
  g3.claimGachaRewards('equip');
  ok(g3.nextOutfitAt() === null, '다 모으면 다음이 없다');

  // 다른 소환(영수·신물)으로는 안 나온다 — 병기 소환만이다
  const g4 = new Game(newSave());
  g4.s.gacha.pet.lv = D.GACHA_LV_MAX;
  g4.s.gacha.relic.lv = D.GACHA_LV_MAX;
  g4.claimGachaRewards('pet');
  g4.claimGachaRewards('relic');
  ok(g4.outfitCount() === 0, '영수·신물 소환으로는 의복이 안 나온다', `${g4.outfitCount()}개`);

  // 전부 모았을 때의 효과가 체감할 크기인가
  const full = new Game(newSave());
  for (const o of D.OUTFITS) full.s.outfits[o.id] = 1;
  const none = new Game(newSave());
  const gain = full.mods().atk - none.mods().atk;
  ok(gain > 2, '전부 모으면 공격력 기여가 유의미하다', `+${(gain * 100).toFixed(0)}%p`);
}

// ---------- 12. 시뮬이 빠뜨린 행동이 없는가 ----------
console.log('\n=== 12. 시뮬이 전부 만지는가 ===');
{
  // tests/sim.mjs가 소환 레벨 보상을 한 번도 안 받고 있었다. 그래서 한철·원보·
  // 장신구 상자·선택 상자·의복이 전부 안 들어왔고, 밸런스 수치가 통째로
  // '보상을 안 받는 사람' 기준이었다. 선택 상자와 장비 초월도 안 쓰고 있었다.
  // 측정 도구가 틀리면 그 위의 판단이 전부 틀린다. 눈으로는 안 보이니 검사로 박는다.
  const fs = await import('node:fs');
  const url = await import('node:url');
  const simPath = url.fileURLToPath(new URL('./sim.mjs', import.meta.url));
  const sim = fs.readFileSync(simPath, 'utf8');

  // 시뮬이 반드시 불러야 하는 것들 — 빼먹으면 그 시스템이 측정에서 통째로 빠진다
  const MUST = [
    ['claimGachaRewards', '소환 레벨 보상'],
    ['claimAttend', '출석'],
    ['claimMission', '일일 의뢰'],
    ['claimMilestone', '달성 보상'],
    ['openAccPick', '선택 상자 개봉'],
    ['equipPierceUp', '장비 초월'],
    ['accStarUp', '장신구 승급'],
    ['accPierce', '장신구 초월'],
    ['buyOutfit', '의복'],
    ['feedEgo', '심검'],
    ['collectMine', '광맥'],
    ['startTower', '혈마의 탑'],
    ['startSeek', '균열·탐색'],
    ['startShadow', '그림자'],
    ['rerollOptions', '옵션 칸'],
    ['levelPet', '영수'],
    ['digRelic', '유물'],
    ['upgradeSkill', '무공 연마'],
    ['enhanceEquip', '제련'],
    ['mergeAll', '합성'],
    ['allocSp', '스탯 포인트'],
  ];
  const missing = MUST.filter(([m]) => !sim.includes(m + '(')).map(([, name]) => name);
  ok(missing.length === 0, '시뮬이 모든 성장 수단을 만진다',
    missing.length ? '빠짐: ' + missing.join(', ') : `${MUST.length}가지 전부`);
}

// ---------- 13. 장신구가 가방에서 썩지 않는가 ----------
console.log('\n=== 13. 장신구 자동 장착 ===');
{
  // autoEquipAcc가 '비어 있을 때만' 채웠다. 그래서 범품을 끼고 있으면 가방에
  // 천품이 들어와도 안 바꿨고, 승급은 같은 등급만 재료로 받으므로 그 천품은
  // 쓸 데가 없었다 — 선택 상자를 가락지에 몰아줘도 통째로 잠겼다.
  const g = new Game(newSave());
  g.s.accBag.ring[0] = 1;
  g.autoEquipAcc();
  ok(g.s.acc.ring?.grade === 0, '빈 자리는 채운다');

  g.s.acc.ring.pierce = 4;
  g.s.accBag.ring[D.GRADES.length - 1] = 1;
  g.autoEquipAcc();
  ok(g.s.acc.ring.grade === D.GRADES.length - 1, '가방에 더 센 게 있으면 갈아낀다',
    `${D.GRADES[g.s.acc.ring.grade].name}`);
  ok(g.s.acc.ring.pierce === 4, '초월은 자리에 남는다 (한철로 산 것이다)',
    `${g.s.acc.ring.pierce}초월`);
  ok(g.s.accBag.ring[0] >= 1, '빼낸 것은 가방으로 돌아온다');

  const before = g.s.acc.ring.grade;
  g.s.accBag.ring[1] = 5;
  g.autoEquipAcc();
  ok(g.s.acc.ring.grade === before, '더 약한 게 들어와도 안 바꾼다');

  // 선택 상자를 몰아줬을 때 실제로 세지는가 — 넣을 때 이걸 안 봤다
  const a2 = new Game(newSave());
  let s1 = 9;
  a2.rng = () => ((s1 = (s1 * 1103515245 + 12345) % 2147483648) / 2147483648);
  a2.openAccBox(6);
  const low = a2.mods().atk;
  a2.s.accPick = 20;
  a2.openAccPick('ring', 20);
  const high = a2.mods().atk;
  ok(high > low * 1.5, '선택 상자를 몰아주면 실제로 세진다',
    `공격력 기여 +${(low * 100).toFixed(0)}% → +${(high * 100).toFixed(0)}%`);
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
