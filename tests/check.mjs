import fs from 'node:fs';
// 전체 점검: 모드 전환·세이브 이주·시스템 도달·값 이상 여부를 한 번에 본다.
// node tests/check.mjs
import { Game, newSave, migrate, slimSave } from '../js/game.js';
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
  // 전직 시험은 18절에서 따로 본다. 다른 축을 재는 캐릭터까지 시험을
  // 치르게 하면 재려는 것이 시험 결과에 가린다.
  for (const j of D.JOBS) g.s.jobTests[j.id] = true;
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

  // 칸을 4에서 6으로 올리면서 '채우는 쪽' 경로를 안 고쳤다. 그래서 180관문
  // 전인데도 여섯이 장착돼 자동 시전이 여섯을 다 돌렸다 — 화면엔 네 칸만
  // 보이는데. 모든 구간에서 '열린 칸 = 장착 = 실제 쓰는 것'이어야 한다.
  for (const best of [50, 150, 179, 180, 259, 260, 400]) {
    const gx = new Game(migrate({ maxStage: best, bestStage: best, autoSkill: true }));
    gx.autoSlotSkills();
    const open = gx.skillSlotCount();
    const filled = gx.s.skillSlots.filter(Boolean).length;
    const active = gx.activeSlots().filter(Boolean).length;
    ok(filled <= open && active === filled, `${best}관문에서 장착 수가 열린 칸을 안 넘는다`,
      `열린 ${open} · 장착 ${filled} · 쓰는 것 ${active}`);
  }

  // 옛 세이브가 안 열린 칸까지 들고 있으면 비워 준다
  const oldSave = migrate({ maxStage: 150, bestStage: 150,
    skillSlots: ['slash', 'rage', 'heal', 'thunder', 'gale', 'midas'] });
  const gOld = new Game(oldSave);
  ok(oldSave.skillSlots.filter(Boolean).length === gOld.skillSlotCount(),
    '옛 세이브의 넘치는 무공이 정리된다',
    `6개 → ${oldSave.skillSlots.filter(Boolean).length}개`);
  ok(gOld.useSkill('gale') === false, '안 열린 칸에 남은 무공은 안 나간다');

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

// ---------- 14. 백업 ----------
console.log('\n=== 14. 백업 코드 ===');
{
  // 백업 코드가 4,500자였다. 카톡으로 주고받기엔 너무 길다.
  // 기본값을 빼고(slimSave) gzip으로 줄여 1/5로 만들었다.
  // 여기서는 압축 전 단계(slimSave)와 roll 자릿수만 본다 — gzip은 브라우저 것이라
  // node에서는 같은 알고리즘(zlib)으로 대신 잰다.
  const zlib = await import('node:zlib');
  const g = strong(300);
  for (const t2 of Object.keys(D.EQUIP_TYPES)) {
    g.s.options[t2] = Array.from({ length: D.OPTION_SLOTS }, () => ({ stat: 'atk', grade: 4, roll: 0.9017060756683349 }));
  }
  const full = JSON.parse(JSON.stringify(g.toJSON()));
  const slim = slimSave(full);

  const b64len = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').length;
  const gzlen = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o), 'utf8')).toString('base64').length;
  const before = b64len(full);
  const after = gzlen(slim);
  ok(after < before * 0.4, '백업 코드가 절반 아래로 줄었다',
    `${before}자 → ${after}자 (${Math.round(100 - after / before * 100)}% 감소)`);

  // 걷어낸 것이 migrate로 되돌아오는가
  const back = migrate(JSON.parse(JSON.stringify(slim)));
  const keys = ['bestStage', 'level', 'rank', 'gold', 'gems', 'stones', 'books'];
  const bad = keys.filter((k) => String(back[k]) !== String(full[k]));
  ok(bad.length === 0, '걷어낸 코드에서 되돌려도 값이 같다', bad.length ? bad.join(',') : keys.join(','));
  for (const k of ['upgrades', 'skills', 'acc', 'enhance', 'equips', 'codex']) {
    ok(JSON.stringify(back[k]) === JSON.stringify(migrate(JSON.parse(JSON.stringify(full)))[k]),
      `${k}가 그대로 돌아온다`);
  }

  // roll 자릿수 — 저장할 때 세 자리로 끊는다
  const rolls = Object.values(back.options).flat().filter(Boolean).map((o) => o.roll);
  ok(rolls.every((r) => String(r).replace(/^\d*\.?/, '').length <= 3),
    '옵션 roll이 소수점 세 자리로 끊긴다', rolls.slice(0, 3).join(', '));
  const g2 = new Game(migrate(JSON.parse(JSON.stringify(full))));
  const twice = migrate(slimSave(g2.toJSON()));
  ok(JSON.stringify(twice.options) === JSON.stringify(back.options),
    '한 번 끊은 뒤에는 왕복해도 안 변한다');

  // 새 세이브는 거의 비어야 한다 — 기본값이 전부 빠지므로
  const fresh = slimSave(newSave());
  ok(Object.keys(fresh).length < Object.keys(newSave()).length / 2,
    '새 세이브는 걷어내면 거의 빈다',
    `${Object.keys(fresh).length} / ${Object.keys(newSave()).length}개 키`);
}

// ---------- 15. 겨루기 중에 쓰러지면 끝나는가 ----------
console.log('\n=== 15. 겨루기 중 사망 ===');
{
  // heroDied가 수련터·시련·결투만 처리했다. 그래서 탑·균열·탐색·그림자·심검에서는
  // 죽어도 안 끝나고 제한시간이 다 될 때까지 빈 화면을 보다가 풀렸다.
  // 게다가 farming이 켜진 채 들판으로 돌아와 관문 진행까지 멈췄다.
  const mk = () => {
    const s = newSave();
    Object.assign(s, { stage: 200, bestStage: 200, maxStage: 200, level: 500 });
    Object.assign(s.upgrades, { atk: 1, hp: 1 });
    const gg = new Game(s);
    gg.rng = seeded(5);
    gg.spawn();
    return gg;
  };
  const cases = [
    ['혈마의 탑', (gg) => gg.startTower()],
    ['그림자 무림', (gg) => { gg.s.shadow.tries = 1; gg.startShadow(); }],
    ['마기 균열', (gg) => { gg.s.seek = 3; gg.startSeek('rift'); }],
    ['수련터', (gg) => { gg.s.daily.keys.gold = 3; gg.startDungeon('gold'); }],
  ];
  for (const [name, start] of cases) {
    const gg = mk();
    start(gg);
    if (gg.mode === 'stage') { ok(true, `${name}는 조건이 안 돼 건너뜀`); continue; }
    gg.heroHp = 1;
    gg.heroDied();
    ok(gg.mode === 'stage', `${name}에서 쓰러지면 바로 들판으로 돌아온다`, `모드 ${gg.mode}`);
    ok(!gg.contest, `${name} 겨루기가 정리된다`);
    ok(gg.s.farming !== true, `${name}에서 죽어도 farming이 안 켜진다`);
  }

  // 들판에서 관문지기에게 지는 건 그대로여야 한다 (여긴 farming이 켜지는 게 맞다)
  const g2 = mk();
  g2.s.kills = D.KILLS_PER_STAGE;
  g2.spawnStage();
  const wasBoss = !!(g2.mon && g2.mon.isBoss);
  g2.heroHp = 1;
  g2.heroDied();
  ok(g2.mode === 'stage', '들판에서 죽어도 들판이다');
  ok(!wasBoss || g2.s.farming === true, '관문지기에게 지면 farming이 켜진다 (기존 동작)',
    `관문지기였나 ${wasBoss} · farming ${g2.s.farming}`);
}

// ---------- 16. 망가진 값이 들어와도 살아남는가 ----------
console.log('\n=== 16. 망가진 값 ===');
{
  // 숫자 자리에 숫자가 아닌 게 한 번 들어오면 그 자원은 영영 NaN이 되고
  // 세이브를 지우기 전까지 복구가 안 된다. 실제로 regress.points가 문자열이면
  // 공격력·체력·은자·경험치가 전부 NaN이 됐다.
  const g = new Game(newSave());
  g.s.gold = 1e18;
  g.addGold(undefined); g.addGold(NaN); g.addGold('abc'); g.addGold(Infinity);
  ok(Number.isFinite(g.s.gold) && g.s.gold === 1e18, '쓰레기를 더해도 은자가 안 깨진다',
    g.s.gold.toExponential(2));
  g.addExp(undefined); g.addExp(NaN);
  ok(Number.isFinite(g.s.exp), '경험치도 안 깨진다');
  g.grant({ gems: undefined, stones: NaN, books: 100 });
  ok(Number.isFinite(g.s.gems) && Number.isFinite(g.s.stones) && g.s.books >= 100,
    'grant가 쓰레기를 걸러낸다');
  g.claimOffline(Date.now());
  ok(Number.isFinite(g.s.gold), '방치 보상에 엉뚱한 값을 넘겨도 안 깨진다');

  // 망가진 세이브들
  const bads = ['{}', '{"gold":"abc"}', '{"upgrades":null}', '{"skillSlots":"x"}',
    '{"acc":{"ring":"x"}}', '{"equips":{"weapon":"x"}}', '{"ego":{"blade":5}}',
    '{"daily":"x"}', '{"stage":-99,"level":-5,"rank":99}', '{"regress":{"points":"x"}}',
    '{"tower":{"floor":"x"}}', '{"mine":"x"}', '{"enhance":{"weapon":"x"}}'];
  let broke = '';
  for (const b of bads) {
    try {
      const gg = new Game(migrate(JSON.parse(b)));
      const st = gg.stats({ buffs: false });
      gg.tick(1 / 60);
      if (!Number.isFinite(st.dps) || !Number.isFinite(st.hp)) broke = `${b} → 능력치 NaN`;
    } catch (e) { broke = `${b} → ${e.message}`; }
    if (broke) break;
  }
  ok(!broke, `망가진 세이브 ${bads.length}가지를 넣어도 돌아간다`, broke || '전부 통과');

  // 상한을 넘는 값이 들어오면 깎인다
  const over = migrate({
    rank: 999, regress: { points: 1e9, count: -5 },
    acc: { ring: { grade: 99, star: 99, pierce: 99 } },
    equipPierce: { weapon: 99 },
    ego: { blade: { step: 99, ench: 99 } },
  });
  ok(over.rank <= D.RANKS.length - 1, '경지가 상한으로 깎인다', `${over.rank}`);
  ok(over.acc.ring.star <= D.ACC_STAR_MAX && over.acc.ring.pierce <= D.ACC_PIERCE_MAX
    && over.acc.ring.grade <= D.GRADES.length - 1, '장신구가 상한으로 깎인다',
    `${over.acc.ring.grade}등급 ${over.acc.ring.star}성 ${over.acc.ring.pierce}초월`);
  ok(over.equipPierce.weapon <= D.EQUIP_PIERCE_MAX, '장비 초월이 상한으로 깎인다');
  ok(over.ego.blade.step <= D.EGO_STEP_MAX && over.ego.blade.ench <= D.EGO_ENCHANT_MAX,
    '심검이 상한으로 깎인다');
  ok(over.regress.count >= 0, '음수 회귀 횟수가 0으로');

  // 없는 것을 물어도 안 터진다
  const g2 = new Game(newSave());
  let threw = '';
  const calls = [
    () => g2.claimMission('없음'), () => g2.openAccPick('없음', 1),
    () => g2.useSkill('없음'), () => g2.setSkillSlot(-1, 'slash'),
    () => g2.merge('weapon', 99), () => g2.levelPet('없음', 1),
    () => g2.buyOutfit('없음'), () => g2.loadPreset(99),
    () => g2.startDungeon('없음'), () => g2.startSeek('없음'),
    () => g2.endContest('fail'), () => g2.toggleOptionLock('weapon', 99),
  ];
  for (const f of calls) { try { f(); } catch (e) { threw = e.message; break; } }
  ok(!threw, `없는 것을 물어도 ${calls.length}가지 전부 안 터진다`, threw || '통과');
}

// ---------- 17. 오래 안 켰다가 켜면 ----------
console.log('\n=== 17. 방치와 날짜 ===');
{
  // 며칠 만에 켜는 건 이 게임에서 흔한 일이다. 그때 값이 깨지거나
  // 열쇠가 상한을 넘거나 하면 안 된다.
  const DAY = 86400000;
  const T0 = Date.UTC(2026, 0, 10, 12, 0);
  const mk = () => {
    const s = newSave(T0);
    Object.assign(s, { stage: 250, bestStage: 250, maxStage: 250, level: 600, rank: 5,
      gold: 1e15, gems: 1e5, stones: 1e8, books: 1e7 });
    Object.assign(s.upgrades, { atk: 200, hp: 200 });
    const gg = new Game(s, T0);
    gg.rng = seeded(99);
    gg.spawn();
    gg.checkDaily(T0);
    return gg;
  };

  for (const days of [1, 7, 365]) {
    const g = mk();
    const r = g.offlineReward(T0 + days * DAY);
    if (r) g.claimOffline(r);
    g.checkDaily(T0 + days * DAY);
    ok(Number.isFinite(g.s.gold) && g.s.gold > 0, `${days}일 만에 켜도 은자가 멀쩡하다`,
      g.s.gold.toExponential(2));
    const keys = Object.values(g.s.daily.keys);
    ok(keys.every((k) => Number.isFinite(k) && k >= 0 && k <= D.DUNGEON_KEY_CAP),
      `${days}일: 수련터 열쇠가 범위 안`, keys.join(','));
    ok(g.s.seek >= 0 && g.s.seek <= D.SEEK_CAP, `${days}일: 탐색패가 범위 안`, `${g.s.seek}`);
    ok(Number.isFinite(g.stats({ buffs: false }).dps), `${days}일: 능력치가 유한하다`);
  }

  // 방치 보상에 상한이 있다 (오래 비워도 무한정 쌓이지 않는다)
  const g2 = mk();
  const short = g2.offlineReward(T0 + D.OFFLINE_CAP_SEC * 1000);
  const long = g2.offlineReward(T0 + 365 * DAY);
  ok(short && long && Math.abs(short.gold - long.gold) < 1e-6,
    '방치 보상이 상한에서 멈춘다', `${D.OFFLINE_CAP_SEC / 3600}시간치`);

  // 시계가 거꾸로 가도 (기기 시각을 바꾸는 경우)
  const g3 = mk();
  const back = g3.offlineReward(T0 - 5 * DAY);
  if (back) g3.claimOffline(back);
  g3.checkDaily(T0 - 5 * DAY);
  ok(Number.isFinite(g3.s.gold) && g3.s.gold > 0, '시계가 거꾸로 가도 은자가 안 깨진다');
  ok(Object.values(g3.s.daily.keys).every((k) => Number.isFinite(k) && k >= 0),
    '시계가 거꾸로 가도 열쇠가 안 깨진다');

  // 출석을 여러 날 연달아
  const g4 = mk();
  let got = 0;
  for (let d2 = 0; d2 < 12; d2++) {
    const tt = T0 + d2 * DAY;
    g4.checkDaily(tt);
    if (g4.claimAttend(tt)) got++;
  }
  ok(got === 12, '12일 연속 출석이 전부 받아진다', `${got}번`);
  ok(Number.isFinite(g4.s.gems), '출석 보상이 숫자로 쌓인다', g4.s.gems.toExponential(2));

  // 자정이 겨루기 중에 지나가도
  const g5 = mk();
  g5.s.daily.keys.gold = 2;
  g5.startDungeon('gold');
  const inContest = g5.mode !== 'stage';
  g5.checkDaily(T0 + DAY);
  ok(inContest && (g5.mode !== 'stage' || !g5.contest), '자정을 넘겨도 겨루기가 안 깨진다');
  for (let k = 0; k < 60 * 180 && g5.mode !== 'stage'; k++) g5.tick(1 / 60);
  ok(g5.mode === 'stage', '자정을 넘긴 겨루기도 끝난다');
}

// ---------- 18. 문파 (직업 8계열) ----------
console.log('\n=== 18. 문파 ===');
{
  const g = strong(500);
  g.s.jobTests = {};          // 이 절은 시험 문턱 자체를 본다
  g.s.rank = D.JOB_RANK - 1;
  ok(!g.jobOpen(), `${D.RANKS[D.JOB_RANK].name} 전에는 못 고른다`, D.RANKS[g.s.rank].name);
  g.s.rank = D.JOB_RANK;
  ok(g.jobOpen(), `${D.RANKS[D.JOB_RANK].name}부터 고를 수 있다`);

  // 해금은 관문으로 하나씩. **문이 열린 것과 들어갈 수 있는 건 다르다** —
  // 사이에 전직 시험이 있다.
  g.s.bestStage = 1;
  ok(g.jobStageOpenCount() === 1, '화경에 닿으면 첫 계열 문만 열린다', `${g.jobStageOpenCount()}개`);
  g.s.bestStage = 9999;
  ok(g.jobStageOpenCount() === D.JOBS.length, '관문을 다 올리면 문이 전부 열린다',
    `${g.jobStageOpenCount()}/${D.JOBS.length}`);
  ok(g.jobUnlockedCount() === 0, '문이 열려도 시험을 안 봤으면 못 들어간다',
    `${g.jobUnlockedCount()}개`);
  ok(D.JOB_UNLOCK.length === D.JOBS.length, '해금 지점이 계열 수만큼 있다');
  ok(D.JOB_UNLOCK.every((v, k) => k === 0 || v > D.JOB_UNLOCK[k - 1]),
    '해금 관문이 오름차순이다', D.JOB_UNLOCK.join(','));

  // 안 열린 계열은 못 고른다
  g.s.bestStage = 1;
  const locked = D.JOBS[D.JOBS.length - 1].id;
  ok(g.setJob(locked) === false, '안 열린 계열은 못 고른다');
  ok(g.s.job === null, '못 골랐으면 비어 있다');

  // 고르고 바꾸고 그만두기
  g.s.bestStage = 9999;
  ok(g.setJob(D.JOBS[0].id) === false, '시험을 안 봤으면 못 들어간다');
  for (const j of D.JOBS) g.s.jobTests[j.id] = true;
  ok(g.setJob(D.JOBS[0].id), '시험에 붙으면 들어간다');
  ok(g.setJob(D.JOBS[1].id), '언제든 바꿀 수 있다');
  ok(g.s.jobSeen.length === 2, '거쳐 본 계열이 쌓인다 (나중에 각인에 쓴다)',
    g.s.jobSeen.join(','));
  ok(g.setJob(null) && g.s.job === null, '그만둘 수 있다');

  // 여덟이 서로 다른 축을 민다 — 같은 축이면 고르는 의미가 사라진다
  const mainAxis = D.JOBS.map((j) => Object.keys({ ...(j.mult || {}), ...(j.add || {}) })[0]);
  ok(new Set(mainAxis).size >= 6, '주축이 대부분 서로 다르다',
    `${new Set(mainAxis).size}종 / ${D.JOBS.length}계열`);
  // 치명 '확률'은 안 쓴다 (상한에 막혀 죽는다)
  const usesCrit = D.JOBS.filter((j) => 'crit' in { ...(j.mult || {}), ...(j.add || {}) });
  ok(usesCrit.length === 0, '치명 확률을 보너스로 쓰지 않는다 (상한에 막힌다)',
    usesCrit.map((j) => j.name).join(',') || '없음');

  // 보너스가 실제로 체감되는 크기인가 — 장신구 특기에서 ×1.04로 죽은 적이 있다
  const base = (() => { const gg = strong(500); gg.s.job = null; return gg.stats({ buffs: false }); })();
  let weak = [];
  for (const j of D.JOBS) {
    const gg = strong(500);
    gg.s.rank = 9; gg.s.bestStage = 9999;
    gg.setJob(j.id);
    const s = gg.stats({ buffs: false });
    const best = Math.max(s.dps / base.dps, (s.dps * s.bossMul) / (base.dps * base.bossMul),
      s.hp / base.hp, s.goldMul / base.goldMul, s.bleedMult, s.ccDurMult, s.offlineMul / base.offlineMul);
    if (best < 1.2) weak.push(`${j.name} ×${best.toFixed(2)}`);
  }
  ok(weak.length === 0, '여덟 계열이 전부 체감되는 크기다', weak.join(', ') || '전부 ×1.2 이상');

  // 세이브
  ok(migrate({ job: '없는것' }).job === null, '없는 계열 id는 버린다');
  const seen = migrate({ jobSeen: ['sword', '없는것', 'sword'] }).jobSeen;
  ok(seen.length === 1 && seen[0] === 'sword', '거쳐 본 목록이 정리된다', seen.join(','));
  ok(migrate({}).job === null, '옛 세이브는 계열이 없다');
  const g2 = new Game(migrate({ job: D.JOBS[0].id }));
  ok(g2.s.jobSeen.includes(D.JOBS[0].id), '고른 계열은 거쳐 본 것에 들어간다');
}

// ---------- 19. 계열 전용 무공 ----------
console.log('\n=== 19. 계열 전용 무공 ===');
{
  ok(D.JOB_SKILLS.length === D.JOBS.length, '계열마다 전용 무공이 하나씩 있다',
    `${D.JOB_SKILLS.length}종 / ${D.JOBS.length}계열`);
  const miss = D.JOBS.filter((j) => !D.jobSkillOf(j.id));
  ok(miss.length === 0, '빠진 계열이 없다', miss.map((j) => j.name).join(',') || '없음');
  // 번호로 집는 자리가 밀리면 안 된다 — stats()가 SKILLS[1]·[4]·[5]를 쓴다
  ok(D.SKILLS[1].id === 'rage' && D.SKILLS[4].id === 'gale' && D.SKILLS[5].id === 'midas',
    '일반 무공 자리가 안 밀렸다', `${D.SKILLS[1].id}/${D.SKILLS[4].id}/${D.SKILLS[5].id}`);
  // 설명이 안 터지는가 (레벨 1과 높은 레벨)
  let bad = [];
  for (const sk of D.JOB_SKILLS) {
    for (const l of [1, 40]) {
      try {
        const s = sk.desc(sk.mult(l), l);
        if (!s || /NaN|undefined/.test(s)) bad.push(`${sk.name} Lv.${l}`);
      } catch (e) { bad.push(`${sk.name} Lv.${l} 터짐`); }
    }
  }
  ok(bad.length === 0, '전용 무공 설명이 멀쩡하다', bad.join(',') || '여덟 다 멀쩡');

  const g = strong(500);
  g.s.rank = 9; g.s.bestStage = 9999;
  const normal = g.skillSlotCount();

  // 문파가 없으면 전용 칸도 없다
  g.setJob(null);
  ok(g.jobSkillId() === null, '문파가 없으면 전용 무공도 없다');
  ok(g.activeSlots().length === normal, '문파가 없으면 칸이 그대로다',
    `${g.activeSlots().length}칸`);

  // 문파 칸은 일반 칸을 먹지 않는다 — 이게 2차의 핵심 약속이다
  g.setJob('sword');
  ok(g.activeSlots().length === normal + 1, '문파 칸이 일반 칸 뒤에 하나 더 붙는다',
    `${normal} → ${g.activeSlots().length}`);
  ok(g.activeSlots().includes('jsword'), '전용 무공이 실제로 나간다');
  ok(!g.s.skillSlots.includes('jsword'), '전용 무공이 일반 칸을 차지하지 않는다');

  // 바꾸면 무공도 바뀐다
  g.setJob('poison');
  ok(g.jobSkillId() === 'jpoison', '문파를 바꾸면 전용 무공도 바뀐다', g.jobSkillId());
  ok(!g.skillUnlocked(D.SKILLS.find((x) => x.id === 'jsword')),
    '안 고른 계열의 무공은 못 쓴다');

  // 일반 칸에 억지로 넣으려 해도 안 들어간다
  ok(g.setSkillSlot(0, 'jpoison') === false, '전용 무공은 일반 칸에 못 넣는다');
  g.autoSlotSkills();
  ok(!g.s.skillSlots.some((id) => D.JOB_SKILLS.some((sk) => sk.id === id)),
    '자동 장착도 전용 무공을 일반 칸에 안 넣는다', g.s.skillSlots.join(','));

  // 실제로 나가는가 — 적이 피를 흘려야 한다
  for (const j of D.JOBS) {
    const gg = strong(300);
    gg.s.rank = 9; gg.s.bestStage = 9999;
    gg.setJob(j.id);
    const id = gg.jobSkillId();
    gg.cd[id] = 0;
    gg.spawn();
    const hp0 = gg.mon.hp;
    const fired = gg.useSkill(id);
    // 장판류는 시간이 지나야 들어간다
    for (let k = 0; k < 60 * 3; k++) { gg.tick(1 / 60); gg.events.length = 0; if (!gg.mon?.alive) break; }
    const hurt = !gg.mon?.alive || gg.mon.hp < hp0;
    ok(fired && hurt, `${j.name}의 ${D.jobSkillOf(j.id).name}이 실제로 들어간다`);
  }
}

// ---------- 20. 맛보기 ----------
console.log('\n=== 20. 맛보기 ===');
{
  const g = strong(500);
  g.s.rank = D.TASTE_RANK - 1;
  ok(!g.tasteOpen(), `${D.RANKS[D.TASTE_RANK].name} 전에는 맛볼 수 없다`);
  g.s.rank = D.TASTE_RANK;
  ok(g.tasteOpen(), `${D.RANKS[D.TASTE_RANK].name}부터 맛볼 수 있다`);
  ok(D.TASTE_RANK < D.JOB_RANK, '맛보기가 문파보다 먼저 온다');

  // 공짜로 몇 번이든 바꾼다
  ok(g.setTaste('drunk') && g.jobSkillId() === 'jdrunk', '맛보기로 전용 무공이 들어온다');
  ok(g.setTaste('monk') && g.jobSkillId() === 'jmonk', '몇 번이든 바꿀 수 있다');
  ok(g.setTaste('없는것') === false, '없는 계열은 못 맛본다');
  ok(g.activeSlots().length === g.skillSlotCount() + 1, '맛보기도 문파 칸에 들어간다');
  // 맛보기 중에는 능력치 보너스가 없다 — 그건 입문해야 붙는다
  ok(g.s.job === null, '맛보기는 입문이 아니다');

  // 올린 레벨은 남는다
  g.setTaste('monk');
  g.s.books = 1e9;
  const before = g.s.skills.jmonk;
  g.upgradeSkill('jmonk');
  ok(g.s.skills.jmonk === before + 1, '맛보는 무공을 올릴 수 있다');
  g.s.rank = D.JOB_RANK;
  ok(!g.tasteOpen(), `${D.RANKS[D.JOB_RANK].name}에 오르면 맛보기가 끝난다`);
  g.setJob('monk');
  ok(g.s.taste === null, '입문하면 맛보기가 내려간다');
  ok(g.s.skills.jmonk === before + 1, '맛보기에서 올린 레벨이 그대로 남는다',
    `Lv.${g.s.skills.jmonk}`);

  // 맛보기가 끝났는데 남아 있으면 안 된다
  const g2 = strong(500);
  g2.s.rank = D.JOB_RANK; g2.s.taste = 'drunk'; g2.s.job = null;
  ok(g2.jobSkillId() === null, '화경에 오르면 맛보기 무공이 사라진다 (문파를 고르라는 뜻)');

  // 회귀로 경지가 내려가도 문파는 남는다 — 그때 맛보기까지 열리면 화면이 엉킨다
  const g3 = strong(500);
  g3.s.rank = 9; g3.s.bestStage = 9999;
  g3.setJob('sword');
  g3.s.rank = D.TASTE_RANK;
  ok(g3.s.job === 'sword', '회귀로 경지가 내려가도 문파는 남는다');
  ok(!g3.tasteOpen(), '문파가 있으면 맛보기는 안 열린다');
  ok(g3.jobSkillId() === 'jsword', '그래도 전용 무공은 그대로 쓴다');
}

// ---------- 21. 전용 무공이 자기 축을 미는가 ----------
console.log('\n=== 21. 전용 무공의 축 ===');
{
  // 취마의 은자, 독마의 경험치가 실제로 붙는가
  for (const [job, id, key] of [['drunk', 'jdrunk', 'goldMul'], ['poison', 'jpoison', 'expMul']]) {
    const g = strong(300);
    g.s.rank = 9; g.s.bestStage = 9999;
    g.setJob(job);
    const before = g.stats()[key];
    g.cd[id] = 0;
    g.useSkill(id);
    const after = g.stats()[key];
    ok(after > before * 1.5, `${D.jobOf(job).name}의 ${D.jobSkillOf(job).name}이 ${key}를 올린다`,
      `x${(after / before).toFixed(2)}`);
    // 보너스가 끝나면 돌아와야 한다.
    // 자동 시전을 꺼야 한다 — 쿨이 줄면서 20초 안에 다시 나가 버린다.
    g.s.autoSkill = false;
    for (let k = 0; k < 60 * 14; k++) { g.tick(1 / 60); g.events.length = 0; }
    ok(Math.abs(g.stats()[key] / g.stats({ buffs: false })[key] - 1) < 1e-9,
      `${D.jobSkillOf(job).name}의 보너스가 시간이 지나면 끝난다`);
  }

  // 단지멸은 반드시 치명 — 치명 확률과 무관하게 치명 피해만큼 들어가야 한다
  {
    const g = strong(300);
    g.s.rank = 9; g.s.bestStage = 9999;
    g.setJob('ring');
    const st = g.stats();
    g.spawn();
    g.mon.hp = Infinity; g.mon.maxHp = Infinity; g.mon.isBoss = false;
    g.cd.jring = 0;
    g.events.length = 0;
    g.useSkill('jring');
    const dealt = g.events.filter((e) => e.type === 'dmg').reduce((a2, e) => a2 + e.amount, 0);
    const sk = D.SKILLS.find((x) => x.id === 'jring');
    const want = st.atk * g.skillMult(sk) * st.critDmg;
    ok(Math.abs(dealt / want - 1) < 1e-6, '단지멸이 반드시 치명으로 들어간다',
      `들어간 ${dealt.toExponential(2)} / 기대 ${want.toExponential(2)}`);
  }

  // 금강부동은 체력을 돌려준다
  {
    const g = strong(300);
    g.s.rank = 9; g.s.bestStage = 9999;
    g.setJob('monk');
    g.heroHp = g.stats().hp * 0.2;
    const before = g.heroHp;
    g.cd.jmonk = 0;
    g.spawn();
    g.useSkill('jmonk');
    ok(g.heroHp > before, '금강부동이 체력을 돌려준다',
      `${Math.round(before / g.stats().hp * 100)}% → ${Math.round(g.heroHp / g.stats().hp * 100)}%`);
  }
}

// ---------- 22. 세이브 (2차) ----------
console.log('\n=== 22. 세이브 (전용 무공) ===');
{
  ok(migrate({ taste: '없는것' }).taste === null, '없는 계열 맛보기는 버린다');
  ok(migrate({}).taste === null, '옛 세이브는 맛보기가 없다');
  // 전용 무공이 일반 칸에 섞여 들어오면 빼낸다
  const m = migrate({ bestStage: 500, skillSlots: ['slash', 'jsword', 'thunder', 'jpoison'] });
  ok(!m.skillSlots.some((id) => D.JOB_SKILLS.some((sk) => sk.id === id)),
    '일반 칸에 섞인 전용 무공을 빼낸다', m.skillSlots.slice(0, 4).join(','));
  // 아주 옛날 세이브(skillSlots 없음)를 채울 때도 안 섞여야 한다
  const m2 = migrate({ maxStage: 500 });
  ok(!m2.skillSlots.some((id) => D.JOB_SKILLS.some((sk) => sk.id === id)),
    '옛 세이브를 채울 때도 안 섞인다', m2.skillSlots.filter(Boolean).join(','));
  ok(m2.skillSlots.filter(Boolean).length > 0, '옛 세이브에 일반 무공은 채워진다');
}

// ---------- 23. 체력 축이 살아 있는가 ----------
console.log('\n=== 23. 체력 축 ===');
{
  // 적 공격력이 플레이어 체력보다 빠르게 자라면 체력 수련·호신의·심의·
  // 운기조식·마불의 체력이 통째로 죽는다. 실제로 그랬다(관문 387에서 한 대 = 체력의 1878배).
  ok(D.ATK_RATE_LATE <= 1.15, `${D.ATK_FLAT_AT}관문 뒤 적 공격력이 플레이어 체력 성장(x1.14)을 안 넘는다`,
    `x${D.ATK_RATE_LATE}`);
  ok(D.ATK_RATE_LATE < D.ATK_RATE_EARLY, '평탄화 뒤 증가율이 더 완만하다');

  // 이음매가 없어야 한다 — 150관문에서 값이 튀면 벽이 하나 더 생긴다
  const jump = D.monsterAtk(D.ATK_FLAT_AT + 1) / D.monsterAtk(D.ATK_FLAT_AT);
  ok(jump < 1.5, '평탄화 지점에서 값이 안 튄다', `x${jump.toFixed(3)}`);
  ok(D.monsterAtk(D.ATK_FLAT_AT) > D.monsterAtk(D.ATK_FLAT_AT - 1), '그래도 계속 오르기는 한다');

  // 오래 가면 적 공격력이 적 체력보다 **느리게** 자라야 한다.
  // 플레이어 공격력에는 치명·속도·영수·심검이 붙지만 체력에는 아무것도 안 붙는다.
  const far = 800;
  const slower = (D.monsterAtk(far) / D.monsterAtk(400)) < (D.monsterHp(far) / D.monsterHp(400));
  ok(slower, '멀리 가면 적 공격력이 적 체력보다 느리게 자란다',
    `400→${far}관문 공격 x${(D.monsterAtk(far) / D.monsterAtk(400)).toExponential(1)}`
    + ` / 체력 x${(D.monsterHp(far) / D.monsterHp(400)).toExponential(1)}`);

  // 체력을 올리면 실제로 더 버티는가 — 숫자가 아니라 전투로 확인한다
  // 이 시험 캐릭터가 '밀어붙이는' 자리. 더 낮으면 안 죽어서, 더 높으면
  // 뭘 해도 즉사해서 차이가 안 보인다. 곡선을 손보면 여기도 다시 잡아야 한다.
  const TRY_AT = 260;
  const liveFor = (tune) => {
    const g = strong(TRY_AT);
    if (tune) tune(g);
    g.heroHp = g.stats({ buffs: false }).hp;   // 수치를 바꿨으면 체력도 다시 채운다
    g.s.farming = true;
    g.spawn();
    for (let i = 0; i < 60 * 30; i++) {
      g.s.stage = TRY_AT;
      g.tick(1 / 60);
      for (const e of g.events) if (e.type === 'heroDied') { g.events.length = 0; return i / 60; }
      g.events.length = 0;
    }
    return 30;
  };
  const plain = liveFor(null);
  const tough = liveFor((g) => { g.s.upgrades.hp += 40; });
  ok(tough > plain * 1.3, '체력을 올리면 더 오래 버틴다',
    `${plain.toFixed(1)}초 → ${tough.toFixed(1)}초 (x${(tough / plain).toFixed(2)})`);
  const monk = liveFor((g) => { g.s.bestStage = 9999; g.setJob('monk'); });
  ok(monk > plain * 1.3, '마불의 체력 x2.5가 실제로 버티게 해 준다',
    `${plain.toFixed(1)}초 → ${monk.toFixed(1)}초 (x${(monk / plain).toFixed(2)})`);
}


console.log('\n=== 24. 전직 시험 ===');
{
  ok(D.JOB_TESTS.length === D.JOBS.length, '계열마다 시험이 하나씩 있다',
    `${D.JOB_TESTS.length}/${D.JOBS.length}`);
  ok(D.JOBS.every((j) => D.jobTestOf(j.id)), '빠진 계열이 없다');

  // 여덟이 **서로 다른 것을 묻는다.** 같은 걸 물으면 시험이 계열을 설명하지 못한다.
  const goals = new Set(D.JOB_TESTS.map((x) => x.goal));
  ok(goals.size === D.JOB_TESTS.length, '여덟이 서로 다른 것을 묻는다',
    `${goals.size}종 / ${D.JOB_TESTS.length}`);

  // 시험은 **이미 넘은 관문**에서 본다. 지금 벽에서 보면 아무도 못 붙는다 —
  // 관문 200 세이브로 재 보니 0/8이었다.
  ok(D.jobTestStage(200) < 200, '시험은 지금 벽보다 아래에서 본다',
    `200관문 → ${D.jobTestStage(200)}관문`);
  ok(D.jobTestStage(1) >= 1, '1관문에서도 아래로 안 내려간다', `${D.jobTestStage(1)}`);

  const g = strong(500);
  g.s.jobTests = {};
  ok(g.jobStageOpen('sword') && !g.jobUnlocked('sword'),
    '문이 열려도 시험 전에는 못 들어간다');
  ok(g.canJobTest('sword'), '문이 열렸으면 시험을 볼 수 있다');
  ok(g.startJobTest('sword') && g.mode === 'jobtest', '시험이 시작된다', g.mode);
  ok(!g.canJobTest('blade'), '시험 중에는 다른 시험을 못 연다');

  // 육합은 무공이 **안 나가야** 한다. 세고 나서 떨구면 모르는 사이에 떨어진다.
  const g2 = strong(500);
  g2.s.jobTests = {};
  g2.startJobTest('fist');
  const anySkill = g2.activeSlots().find((id) => id && g2.s.skills[id]);
  g2.cd = {};
  ok(anySkill ? g2.useSkill(anySkill) === false : true,
    '육합에서는 무공이 아예 안 나간다', anySkill || '무공 없음');

  // 떨어져도 잃는 게 없어야 한다
  const g3 = strong(500);
  g3.s.jobTests = {};
  const gold0 = g3.s.gold, lv0 = g3.s.level, stage0 = g3.s.stage;
  g3.startJobTest('sword');
  g3.endContest('fail');
  ok(g3.s.gold === gold0 && g3.s.level === lv0 && g3.s.stage === stage0,
    '떨어져도 잃는 게 없다');
  ok(!g3.jobTestPassed('sword'), '떨어지면 안 붙은 채로 남는다');
  ok(g3.mode === 'stage', '끝나면 들판으로 돌아온다', g3.mode);

  g3.startJobTest('sword');
  g3.endContest('clear');
  ok(g3.jobTestPassed('sword'), '붙으면 기록된다');
  ok(g3.setJob('sword'), '붙은 뒤에는 들어간다');

  // 부동은 **시간이 다 되면** 붙는다 (이기는 시험이 아니다)
  const g4 = strong(500);
  g4.s.jobTests = {};
  g4.startJobTest('monk');
  g4.endContest('timeout');
  ok(g4.jobTestPassed('monk'), '부동은 버티면(시간초과) 붙는다');

  // 옛 세이브 구제 — 이미 들어간 문파를 시험 때문에 잃으면 안 된다
  const oldSv = migrate({ job: 'ring', jobSeen: ['ring', 'fan'], rank: 9, bestStage: 9999 });
  ok(oldSv.jobTests.ring && oldSv.jobTests.fan,
    '시험 전 세이브는 거쳐 본 계열이 붙은 걸로 들어온다',
    Object.keys(oldSv.jobTests).join(','));
  ok(new Game(oldSv).s.job === 'ring', '들어가 있던 문파를 그대로 들고 온다');

  // 체력 비율로 못박은 시험은 사람이 달라도 같은 세기여야 한다 —
  // monsterAtk로 두니 관문 200에서는 한 대에 죽고 390에서는 안 아팠다.
  const frac = D.JOB_TESTS.filter((x) => x.atkHpFrac);
  ok(frac.length >= 3, '적의 공격을 체력 비율로 못박은 시험이 있다',
    frac.map((x) => x.name).join(','));
  for (const d of frac) {
    const gg = strong(500);
    gg.s.jobTests = {};
    gg.startJobTest(d.job);
    const want = gg.stats().hp * d.atkHpFrac;
    ok(Math.abs(gg.mon.atk - want) < want * 0.01,
      `${d.name}의 적 공격이 내 체력의 ${Math.round(d.atkHpFrac * 100)}%다`,
      `${gg.mon.atk.toExponential(2)} / ${want.toExponential(2)}`);
  }
}

console.log('\n=== 25. 광고 / 광고 제거 ===');
{
  const g = strong(200);
  g.s.noAds = false;
  const a = g.stats();
  g.s.noAds = true;
  const b = g.stats();
  ok(Math.abs(b.atk / a.atk - D.NOADS_ATK) < 1e-9, `광고를 지우면 공격력 x${D.NOADS_ATK}`,
    `x${(b.atk / a.atk).toFixed(3)}`);
  ok(Math.abs(b.hp / a.hp - D.NOADS_HP) < 1e-9, `광고를 지우면 체력 x${D.NOADS_HP}`,
    `x${(b.hp / a.hp).toFixed(3)}`);
  // x4는 어떤 문파 보너스보다도 크다(최대 x1.5). **알고 둔 값이다** —
  // 운영자가 정했다. 검사는 '작아야 한다'가 아니라 '공격력과 체력이 같은
  // 값인가'를 본다. 한쪽만 바꾸면 체력 쪽이 조용히 죽는다.
  const topJob = Math.max(...D.JOBS.map((j) => j.mult?.atk || 1));
  ok(D.NOADS_ATK === D.NOADS_HP, '광고 제거는 공격력과 체력을 같이 올린다',
    `공격 x${D.NOADS_ATK} · 체력 x${D.NOADS_HP} (문파 최대 x${topJob})`);

  // **공짜로 주던 것을 광고 뒤로 옮기지 않는다.** 있던 걸 빼앗으면 개악이다.
  const g2 = strong(200);
  ok(g2.boostLeft() === D.BOOST_PER_DAY, '공짜 기연 횟수는 그대로다',
    `${g2.boostLeft()}/${D.BOOST_PER_DAY}`);
  ok(g2.adBoostLeft() === D.AD_BOOST_EXTRA, '광고 기연은 덤으로 더 있다',
    `+${g2.adBoostLeft()}`);

  // 광고 기연도 실제로 버프가 걸려야 한다
  const g3 = strong(200);
  const before = g3.stats().atk;
  ok(g3.takeAdBoost(), '광고 기연을 받는다');
  ok(g3.stats().atk > before * 1.5, '광고 기연이 실제로 공격력을 올린다',
    `x${(g3.stats().atk / before).toFixed(2)}`);
  ok(g3.adBoostLeft() === 0, '하루 한 번만 받는다');
  ok(!g3.takeAdBoost(), '두 번은 안 된다');

  // 날이 바뀌면 광고 기연도 돌아온다
  const g4 = strong(200);
  g4.takeAdBoost();
  g4.s.daily.date = '2000-01-01';
  g4.checkDaily(Date.now());
  ok(g4.adBoostLeft() === D.AD_BOOST_EXTRA, '날이 바뀌면 광고 기연이 돌아온다',
    `${g4.adBoostLeft()}`);

  // 세이브에 남고 돌아온다
  const g5 = strong(200);
  g5.s.noAds = true;
  ok(migrate(JSON.parse(JSON.stringify(g5.toJSON()))).noAds === true, '광고 제거가 세이브에 남는다');
  ok(migrate({}).noAds === false, '옛 세이브는 꺼진 채로 들어온다');

  // 규칙에서 플레이어가 **못 쓰는** 자리에 둬야 한다.
  // players/{uid}는 본인이 자유롭게 쓰므로 거기 두면 누구나 스스로 켠다.
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf-8');
  // 다음 match가 나오기 전까지가 entitlements 블록이다.
  // 중괄호를 세려 하면 {uid}의 }에 걸린다.
  const entBlock = (rules.split('match /entitlements')[1] || '').split('match /')[0];
  ok(entBlock.includes('allow read'), '권한 문서를 본인이 읽을 수 있다');
  // **쓰는 길은 전부 운영자를 거쳐야 한다.** 하나라도 isAdmin() 없이 열리면
  // 누구나 스스로 광고를 지운다 — 돈 받고 파는 것이 공짜가 된다.
  const allowLines = entBlock.split(/\r?\n/)
    .filter((l) => /allow\s+(write|create|update|delete)/.test(l));
  ok(allowLines.length > 0, '운영자가 켜고 끌 수 있다', `${allowLines.length}줄`);
  ok(allowLines.every((l) => l.includes('isAdmin()')),
    '권한 문서를 쓰는 길은 전부 운영자만 통과한다',
    allowLines.map((l) => l.trim()).join(' / '));
  ok(entBlock.includes('noAds is bool'), '켤 때 noAds가 참거짓인지 본다');
}
console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
