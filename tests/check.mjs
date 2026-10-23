import fs from 'node:fs';
// 전체 점검: 모드 전환·세이브 이주·시스템 도달·값 이상 여부를 한 번에 본다.
// node tests/check.mjs
import { Game, newSave, migrate, slimSave } from '../js/game.js';
import { fmt, alphaUnit } from '../js/fmt.js';
import { big, Big } from '../js/big.js';
// Big에는 valueOf가 없다 — `a > b`가 글자 비교가 되므로 여기를 거친다.
const gt = (a, b) => big(a).gt(b);
const gte = (a, b) => big(a).gte(b);
const pos = (v) => big(v).isPos();
const pctOf = (a, b) => `${Math.round(big(a).div(b).toNumber() * 100)}%`;
const fin = (v) => { const x = big(v); return Number.isFinite(x.m) && Number.isFinite(x.e); };
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import * as D from '../js/data.js';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '  OK  ' : '  !!  '} ${label}${extra ? '  — ' + extra : ''}`);
};

const srcOf = (rel) => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf-8');

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
    // 소단계를 다 채운 뒤라야 심마를 만난다 — 실제로 플레이어가 그렇게 간다
    ['시련', (g) => { g.s.rankSub = D.RANK_SUBS - 1; return g.canTrial() && g.startTrial(); }],
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
  ok(fin(st.atk) && pos(st.atk), '전투력이 숫자다', `공격력 ${st.atk.toExponential(2)}`);
  for (let i = 0; i < 600; i++) g.tick(1 / 60);
  ok(g.s.stage >= 40, '옛 세이브로도 돌아간다', `관문 ${g.s.stage}`);
}

console.log('\n=== 3. 값이 깨지지 않는가 (NaN / Infinity) ===');
{
  const g = strong(300);
  g.checkDaily(Date.UTC(2026, 9, 19));
  for (let i = 0; i < 60 * 300; i++) { g.tick(1 / 60); g.events.length = 0; }
  const st = g.stats();
  const bad = Object.entries(st).filter(([k, v]) => k !== 'petHits'
    && ((typeof v === 'number' && !Number.isFinite(v)) || (v && v.e !== undefined && !fin(v))));
  ok(bad.length === 0, '스탯에 NaN/Infinity 없음', bad.map(([k]) => k).join(',') || '전부 정상');
  const nums = ['gold', 'gems', 'stones', 'books', 'food', 'relicShards'];
  const badRes = nums.filter((k) => !fin(g.s[k]));
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
  ok(g.s.wave < g.waveTotal(), '물결 번호가 범위 안', `${g.s.wave + 1}/${g.waveTotal()}`);
  // 관문지기 직행이 켜져 있으면 첫 관문만 물결을 돌고 그 뒤로는 바로 두목이다.
  // 끄면 물결이 매 관문 돌아야 한다 — 그쪽을 따로 본다.
  {
    const g2 = strong(100);
    g2.s.bossRush = false;
    const w2 = [];
    let c2 = 0;
    for (let i = 0; i < 60 * 600 && c2 < 3; i++) {
      g2.tick(1 / 60);
      for (const e of g2.events) {
        if (e.type === 'wave') w2.push(e.wave + 1);
        if (e.type === 'stageClear') c2++;
      }
      g2.events.length = 0;
    }
    ok(w2.length >= 6, '직행을 끄면 물결이 매 관문 넘어간다', w2.slice(0, 9).join('→'));
  }
  // 직행이 켜져 있으면 관문을 깬 직후 바로 두목 차례여야 한다
  {
    const g3 = strong(100);
    let cleared = false;
    for (let i = 0; i < 60 * 600 && !cleared; i++) {
      g3.tick(1 / 60);
      cleared = g3.events.some((e) => e.type === 'stageClear');
      g3.events.length = 0;
    }
    ok(cleared, '한 관문을 깼다');
    ok(g3.s.kills >= D.KILLS_PER_STAGE, '깨자마자 다음 관문도 두목 차례다',
      `${g3.s.kills}/${D.KILLS_PER_STAGE}`);
  }
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
      const k = keys.reduce((a, b) => (gte(g.upgradeCost(b), g.upgradeCost(a)) ? a : b));
      if (!g.buyUpgrade(k)) break;
    }
    for (const sk of D.SKILLS) while (g.upgradeSkill(sk.id));
    while (g.s.sp > 0) g.allocSp('atk');
    while (g.s.gems >= 900) g.gacha(10);
    g.mergeAll();
    for (const ty of Object.keys(D.EQUIP_TYPES)) g.enhanceEquip(ty, 5);
    if (step % 600 === 0) {
      g.collectMine(now);
      while (gt(g.s.gold, big(g.mineDepthCost()).mul(4)) && g.digDeeper(now));
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
  // 비급은 전에 마지막 물결에만 나왔다. 수입이 띄엄띄엄해서 초반에 체감이 없었고,
  // 무엇보다 양이 관문에 선형이라 3시간이면 말라붙었다. 물결마다 나누어 준다.
  ok(rs.every((r) => r.books > 0), '물결마다 비급이 나온다', rs.map((r) => r.books).join(' / '));
  ok(rs[total - 1].books > rs[0].books, '뒤쪽 물결이 비급도 더 준다');
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

// ---------- 9. 상한과 여유 / 수련 차수 ----------
console.log('');
console.log('=== 9. 상한과 여유 ===');
{
  // 치명 수련이 혼자 CRIT_CAP을 채우면, 치명 확률을 주는 다른 시스템이 전부 0이 된다.
  // 실제로 그랬다 — 8시간 차에 39.5%p가 버려지고 있었다. 다시는 못 그러게 막는다.
  // 이제 혈도는 **1차(50레벨)까지만 치명 확률**이고 2차부터는 치명 피해로 간다.
  const capLv = D.upTierLv('crit');
  const fromTrain = D.upAdds('crit', capLv).crit;
  const room = D.CRIT_CAP - fromTrain;
  ok(room > 0.2, '치명은 1차를 다 해도 상한까지 여유가 남는다',
    `1차 ${(fromTrain * 100).toFixed(0)}% / 상한 ${(D.CRIT_CAP * 100).toFixed(0)}% → 여유 ${(room * 100).toFixed(0)}%p`);

  // 치명 확률을 주는 시스템이 실제로 몇 %p나 되는지 세어, 여유 안에 들어오는지 본다
  let give = 0;
  const add = (o) => { if (o && o.crit) give += o.crit; };
  add(D.CODEX_PER_TYPE); add(D.CODEX_ALL); add(D.OPTION_SET); add(D.OPTION_SET_FULL);
  add(D.ACC_SET); add(D.OUTFIT_ALL); add(D.CODEX_KIND_FULL); add(D.CODEX_ALL_FULL);
  for (const s2 of D.EQUIP_SET_STEPS) add(s2);
  ok(give > 0, '치명 확률을 주는 시스템이 있다', `보유 효과만 합쳐 +${(give * 100).toFixed(0)}%p`);
  ok(give <= room + 0.25, '그 시스템들이 여유를 통째로 넘지는 않는다',
    `시스템 +${(give * 100).toFixed(0)}%p vs 여유 ${(room * 100).toFixed(0)}%p`);

  // 실제 진행 상태에서 상한이 지켜지는가 — 강한 세이브로 확인
  const g = strong(300);
  for (const t2 of Object.keys(D.EQUIP_TYPES)) {
    g.s.options[t2] = Array.from({ length: D.OPTION_SLOTS }, () => ({ stat: 'crit', grade: 5, roll: 1 }));
  }
  const used = g.stats({ buffs: false }).crit;
  ok(used <= D.CRIT_CAP + 1e-9, '상한은 지켜진다', `${(used * 100).toFixed(1)}%`);

  // ---- 수련 차수: 끝이 없어야 한다 ----
  // 전에는 치명 50레벨, 속도 100레벨에서 축이 죽었다. 다 찍으면 그 은자가
  // 갈 곳이 없어 성장이 꺾였다(실측: 2시간을 넘기면 관문이 시간당 26밖에 안 늘었다).
  for (const k of Object.keys(D.UPGRADES)) {
    ok(D.UPGRADES[k].max === undefined, `${k}에 상한이 없다`);
    // 현실적인 윗자리에서 본다. 10000레벨을 넣으면 1.13^10000이 Infinity라
    // 'Infinity > Infinity'가 false가 되어 멀쩡한 곡선이 틀린 것처럼 잡혔다.
    // 이제 Big이라 10000레벨도 안 터진다 — 옛날에 2000으로 낮춰 뒀던 걸 되돌린다
    ok(gt(D.UPGRADES[k].cost(10000), D.UPGRADES[k].cost(9999)) && fin(D.UPGRADES[k].cost(10000)),
      `${k} 비용은 끝없이 오른다`, D.UPGRADES[k].cost(10000).toExponential(1));
  }
  const gm = strong(300);
  ok(gm.upgradeMaxed('crit') === false, '다 찍었다는 상태가 없다');

  // 상한이 있는 통계는 다음 차수에서 상한 없는 통계로 갈아탄다
  for (const [k, cap] of [['crit', 'critDmg'], ['speed', 'hitMul']]) {
    ok(D.upStatAt(k, 0) === k, `${k} 1차는 본래 통계를 준다`);
    ok(D.upStatAt(k, 1) === cap, `${k} 2차는 상한 없는 ${cap}으로 간다`);
    ok(D.upStatAt(k, 99) === cap, `${k} 99차도 그대로`, D.upStatAt(k, 99));
  }
  // 레벨을 아무리 올려도 값이 계속 는다
  for (const k of Object.keys(D.UPGRADES)) {
    const def = D.UPGRADES[k];
    // upAdds는 이제 Big을 돌려준다 — `a + b`로 더하면 글자가 붙는다.
    const val = (l) => (def.kind === 'mul' ? def.value(l)
      : Object.values(D.upAdds(k, l)).reduce((a, b) => big(a).add(b), big(0)));
    ok(gt(val(1000), val(500)) && gt(val(500), val(200)), `${k}는 올릴수록 계속 는다`);
  }
  // 차수 이름이 겹치지 않는다
  const names = Array.from({ length: 20 }, (_, i) => D.upTierName('혈도', i));
  ok(new Set(names).size === names.length, '차수 이름이 겹치지 않는다', `${names[0]} … ${names[19]}`);

  // 옛 세이브의 넘치는 수련 레벨은 **잘리지 않고** 다음 차수가 된다
  const old = migrate({ upgrades: { crit: 90, speed: 999 } });
  ok(old.upgrades.crit === 90, '옛 세이브의 치명 레벨이 안 잘린다', `90 → ${old.upgrades.crit}`);
  ok(old.upgrades.speed === 999, '속도도 마찬가지', `999 → ${old.upgrades.speed}`);
  ok(D.upTierOf('crit', 90) === 1, '90레벨이면 2차에 들어가 있다');

  // 연격이 실제로 피해에 들어가는가 (주고도 안 읽는 자리를 만들지 않는다)
  const g0 = strong(200);
  g0.s.upgrades.speed = 0; g0.s.upgrades.hitMul = 0;
  const d0 = g0.stats({ buffs: false }).dps;
  g0.s.upgrades.hitMul = 50;
  const d1 = g0.stats({ buffs: false }).dps;
  ok(d1 > d0 * 1.5, '연격을 올리면 피해가 는다', `${d0.toExponential(2)} → ${d1.toExponential(2)}`);
  // 호신강기도 마찬가지
  const g1 = strong(200);
  g1.s.upgrades.guard = 0;
  const v0 = g1.stats({ buffs: false }).guard;
  g1.s.upgrades.guard = 40;
  const v1 = g1.stats({ buffs: false }).guard;
  ok(v1 < v0, '호신강기를 올리면 받는 피해가 준다', `x${v0.toFixed(2)} → x${v1.toFixed(2)}`);
  // 역근경(체력 가산)
  // **strong()에는 이미 hpAdd가 잔뜩 쌓여 있다.** 거기에 50레벨을 더해 봐야
  // 8%밖에 안 움직여서, 멀쩡한 축이 안 붙은 것처럼 잡혔다. 다른 축을 비워 두고 본다.
  const g2 = strong(200);
  for (const k of ['hp', 'guard', 'hpAdd']) g2.s.upgrades[k] = 0;
  const h0 = g2.stats({ buffs: false }).hp;
  g2.s.upgrades.hpAdd = 50;
  const h1 = g2.stats({ buffs: false }).hp;
  ok(h1 > h0 * 1.5, '역근경을 올리면 체력이 는다', `${h0.toExponential(2)} → ${h1.toExponential(2)}`);
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
    gg.heroHp = big(1);
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
  g2.heroHp = big(1);
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
  g.s.gold = big(1e18);
  g.addGold(undefined); g.addGold(NaN); g.addGold('abc'); g.addGold(Infinity);
  ok(fin(g.s.gold) && big(g.s.gold).eq(1e18), '쓰레기를 더해도 은자가 안 깨진다',
    g.s.gold.toExponential(2));
  g.addExp(undefined); g.addExp(NaN);
  ok(fin(g.s.exp), '경험치도 안 깨진다');
  g.grant({ gems: undefined, stones: NaN, books: 100 });
  ok(Number.isFinite(g.s.gems) && fin(g.s.stones) && gte(g.s.books, 100),
    'grant가 쓰레기를 걸러낸다');
  g.claimOffline(Date.now());
  ok(fin(g.s.gold), '방치 보상에 엉뚱한 값을 넘겨도 안 깨진다');

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
      if (!fin(st.dps) || !fin(st.hp)) broke = `${b} → 능력치 NaN`;
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
    ok(fin(g.s.gold) && pos(g.s.gold), `${days}일 만에 켜도 은자가 멀쩡하다`,
      g.s.gold.toExponential(2));
    const keys = Object.values(g.s.daily.keys);
    ok(keys.every((k) => Number.isFinite(k) && k >= 0 && k <= D.DUNGEON_KEY_CAP),
      `${days}일: 수련터 열쇠가 범위 안`, keys.join(','));
    ok(g.s.seek >= 0 && g.s.seek <= D.SEEK_CAP, `${days}일: 탐색패가 범위 안`, `${g.s.seek}`);
    ok(fin(g.stats({ buffs: false }).dps), `${days}일: 능력치가 유한하다`);
  }

  // 방치 보상에 상한이 있다 (오래 비워도 무한정 쌓이지 않는다)
  const g2 = mk();
  const short = g2.offlineReward(T0 + D.OFFLINE_CAP_SEC * 1000);
  const long = g2.offlineReward(T0 + 365 * DAY);
  ok(short && long && big(short.gold).eq(long.gold),
    '방치 보상이 상한에서 멈춘다', `${D.OFFLINE_CAP_SEC / 3600}시간치`);

  // 시계가 거꾸로 가도 (기기 시각을 바꾸는 경우)
  const g3 = mk();
  const back = g3.offlineReward(T0 - 5 * DAY);
  if (back) g3.claimOffline(back);
  g3.checkDaily(T0 - 5 * DAY);
  ok(fin(g3.s.gold) && pos(g3.s.gold), '시계가 거꾸로 가도 은자가 안 깨진다');
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
  // **처음 드는 건 공짜, 바꾸는 건 공적이 든다.** 전에는 공짜로 갈아탈 수
  // 있어서 상황마다 바꾸는 게 늘 이득이었다 — 고르는 게 고르는 일이 아니었다.
  ok(g.jobSwitchCost(D.JOBS[1].id) > 0, '바꾸는 데 공적이 든다',
    `${g.jobSwitchCost(D.JOBS[1].id)}`);
  ok(g.setJob(D.JOBS[1].id) === false, '공적이 없으면 못 바꾼다');
  g.s.merit = big(1e9);
  ok(g.setJob(D.JOBS[1].id), '공적이 있으면 바꾼다');
  ok(g.s.jobSeen.length === 2, '거쳐 본 계열이 쌓인다 (나중에 각인에 쓴다)',
    g.s.jobSeen.join(','));
  // 바꿀수록 비싸지고, 거쳐 본 곳으로 돌아가는 건 절반이다
  const back = g.jobSwitchCost(D.JOBS[0].id);
  const fresh = g.jobSwitchCost(D.JOBS[2].id);
  ok(back < fresh, '거쳐 본 문파로 돌아가는 게 더 싸다', `${back} < ${fresh}`);
  const before = g.s.jobSwitches;
  g.setJob(D.JOBS[2].id);
  ok(g.s.jobSwitches === before + 1, '바꾼 횟수가 쌓인다');
  ok(g.jobSwitchCost(D.JOBS[3].id) > fresh, '바꿀수록 값이 오른다');
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
  ok(D.JOB_SKILLS.length === D.JOBS.length * D.JOB_SLOTS, '계열마다 전용 무공이 셋씩 있다',
    `${D.JOB_SKILLS.length}종 / ${D.JOBS.length}계열 x ${D.JOB_SLOTS}`);
  const miss = D.JOBS.filter((j) => D.jobSkillsOf(j.id).length !== D.JOB_SLOTS);
  ok(miss.length === 0, '셋이 안 되는 계열이 없다', miss.map((j) => j.name).join(',') || '없음');
  // 차수가 0 · 1 · 2로 빠짐없이 매겨져야 한다. 하나라도 겹치면 그 칸이 영영 빈다.
  for (const j of D.JOBS) {
    const tiers = D.jobSkillsOf(j.id).map((s) => s.jobTier);
    ok(tiers.join(',') === [...Array(D.JOB_SLOTS).keys()].join(','),
      `${j.name} 무공 차수가 0부터 차례대로`, tiers.join(','));
  }
  // 모든 계열에 특성이 있어야 한다 — 하나라도 빠지면 그 문파만 전직해도 아무 일이 없다
  for (const j of D.JOBS) {
    const tr = D.jobTraitOf(j.id);
    ok(!!tr, `${j.name}에 특성이 있다`, tr?.name || '없음');
    ok(!!tr && !!tr.text && !!tr.col, `${j.name} 특성에 설명과 빛깔이 있다`);
    // 특성이 **실제로 하는 일**이 있어야 한다. 이름만 있고 효과가 없으면 죽은 특성이다.
    const does = ['cc', 'bossBonus', 'critChance', 'cdCut', 'goldOnSkill', 'heal'].some((k) => tr && tr[k]);
    ok(does, `${j.name} 특성이 실제로 뭔가를 한다`);
  }
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
  const jn = g.jobSlotCount();
  ok(g.activeSlots().length === normal + jn, '문파 칸이 일반 칸 뒤에 더 붙는다',
    `${normal} → ${g.activeSlots().length} (문파 ${jn}칸)`);
  // 2차·3차는 관문으로 열린다. 처음부터 셋을 다 주면 열리는 맛이 없다.
  ok(jn < D.JOB_SLOTS || g.s.bestStage >= D.JOB_SKILL_OPEN[D.JOB_SLOTS - 1],
    '아직 안 열린 문파 칸은 안 나간다', `${jn}/${D.JOB_SLOTS}칸`);
  const far = new Game(migrate({ job: 'sword', bestStage: 9999, maxStage: 9999, stage: 9999 }));
  ok(far.jobSlotCount() === D.JOB_SLOTS, '멀리 가면 문파 칸이 전부 열린다', `${far.jobSlotCount()}칸`);
  ok(far.jobSkillIds().length === D.JOB_SLOTS, '열린 칸마다 무공이 들어간다',
    far.jobSkillIds().join(','));
  ok(g.activeSlots().includes('jsword'), '전용 무공이 실제로 나간다');
  ok(!g.s.skillSlots.includes('jsword'), '전용 무공이 일반 칸을 차지하지 않는다');

  // 바꾸면 무공도 바뀐다 (이제 공적이 드니 먼저 쥐여 준다)
  g.s.merit = big(1e9);
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
  g.s.books = big(1e9);
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
    // 안 죽는 허수아비. Infinity를 꽂으면 Big 셈이 안 되므로 아주 큰 수를 쓴다.
    g.mon.hp = Big.pow10(500); g.mon.maxHp = Big.pow10(500); g.mon.isBoss = false;
    g.cd.jring = 0;
    g.events.length = 0;
    g.useSkill('jring');
    const dealt = g.events.filter((e) => e.type === 'dmg').reduce((a2, e) => a2.add(e.amount), big(0));
    const sk = D.SKILLS.find((x) => x.id === 'jring');
    const want = st.atk.mul(g.skillMult(sk) * st.critDmg);
    ok(Math.abs(dealt / want - 1) < 1e-6, '단지멸이 반드시 치명으로 들어간다',
      `들어간 ${dealt.toExponential(2)} / 기대 ${want.toExponential(2)}`);
  }

  // 금강부동은 체력을 돌려준다
  {
    const g = strong(300);
    g.s.rank = 9; g.s.bestStage = 9999;
    g.setJob('monk');
    g.heroHp = g.stats().hp.mul(0.2);
    const before = g.heroHp;
    g.cd.jmonk = 0;
    g.spawn();
    g.useSkill('jmonk');
    ok(gt(g.heroHp, before), '금강부동이 체력을 돌려준다',
      `${pctOf(before, g.stats().hp)} → ${pctOf(g.heroHp, g.stats().hp)}`);
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
  // **적 공격력이 내 체력과 같은 속도로 자라야 한다.** 느리면 안 죽는 캐릭터가
  // 되고(실측: 관문 375에서 한 대가 체력의 1천만분의 1), 빠르면 한 대에 죽는다
  // (전에 그랬다 — 관문 387에서 한 대 = 체력의 1878배).
  // 실측한 내 체력 성장은 관문당 x1.146~1.161이다.
  // '내 체력 성장률'은 상수가 아니라 경제에서 나온다 — 정적 검사로는 못 본다.
  // 여기서는 **적 체력과 같은 줄에 있는가**만 본다(경제를 통째로 압축했으므로
  // 셋이 같은 속도여야 한다). 실제 비율은 tests/dps_taken.mjs가 잰다.
  // 둘 다 **완만해지는 꼴**이라 상수 하나로는 못 본다. 관문마다 재서 견준다.
  // 적 공격은 적 체력보다 조금 느려야 한다 — 같으면 관문이 안 넘어가고,
  // 더 빠르면 어느 관문부터 손도 못 쓰고 죽는다(둘 다 실측으로 겪었다).
  for (const at of [100, 300, 600, 900]) {
    const hpR = D.monsterHp(at + 1) / D.monsterHp(at);
    const atkR = D.monsterAtk(at + 1) / D.monsterAtk(at);
    // 초반에는 공격이 아주 조금 빠를 수 있다(쉬는 구간 52관문 때문이다).
    // 보는 것은 '둘이 같은 줄에 있는가'다 — 실제 %는 tests/fourcurves.mjs가 잰다.
    ok(atkR < hpR * 1.01 && atkR > Math.pow(hpR, 0.5),
      `관문 ${at}에서 적 공격이 적 체력과 같은 줄에 있다`,
      `공격 x${atkR.toFixed(4)} / 체력 x${hpR.toFixed(4)}`);
  }
  // 한 줄기로 간다 — 구간을 나누면 이음매에서 값이 튄다.
  // 완만해지는 곡선이라 관문마다 비율이 조금씩 **줄어들기만** 해야 한다.
  for (const at of [150, 400, 900]) {
    const a1 = D.monsterAtk(at + 1) / D.monsterAtk(at);
    const a2 = D.monsterAtk(at + 2) / D.monsterAtk(at + 1);
    ok(a2 <= a1 + 1e-9 && a1 / a2 < 1.01, `관문 ${at} 둘레에 이음매가 없다`,
      `x${a1.toFixed(5)} → x${a2.toFixed(5)}`);
  }
  ok(D.monsterAtk(D.ATK_FROM + 1) > D.monsterAtk(D.ATK_FROM), `초반 ${D.ATK_FROM}관문 뒤부터 오른다`);

  // '적 공격력이 적 체력보다 느리게 자라야 한다'는 검사가 여기 있었다.
  // 그건 적 공격력을 **적 체력**에 견주던 때의 이야기다. 이제는 **내 체력**에
  // 견준다 — 안 죽는 것이 문제였고 적 체력은 그 사이에서 상관이 없다.
  // 실제 세이브로 재는 일은 tests/dps_taken.mjs가 맡는다.

  // 체력을 올리면 실제로 더 버티는가 — 숫자가 아니라 전투로 확인한다
  //
  // **관문을 손으로 찾지 않는다.** 전에는 260 → 180 → 220으로 곡선을 고칠
  // 때마다 다시 찾아야 했다. 절벽이 가팔라서(10관문에 x3.6) 한 번 어긋나면
  // '안 죽음'이나 '1.1초'가 되어 차이가 안 보인다.
  // 이 캐릭터의 체력에 **맞는 관문을 스스로 구한다** — 한 대가 체력의 4%쯤
  // 되는 자리. 곡선을 어떻게 고치든 검사가 따라온다.
  // **영웅의 공격을 뺀다.** 안 그러면 적을 한 방에 다 죽여서 맞을 틈이 없고,
  // 30초 → 30초로 차이가 안 보인다(곡선을 고칠 때마다 그랬다).
  // 체력 축만 따로 보는 것이 이 검사의 목적이다.
  const TRY_AT = (() => {
    const hp0 = strong(100).stats().hp;
    for (let s2 = 30; s2 < 3000; s2++) if (D.monsterAtk(s2) >= hp0 * 0.06) return s2;   // 재생 2%/초를 확실히 넘는 자리
    return 200;
  })();
  const liveFor = (tune) => {
    // 아래에서 g.dealDamage를 비워 영웅의 공격을 끈다
    const g = strong(TRY_AT);
    if (tune) tune(g);
    g.dealDamage = () => {};   // 영웅의 공격을 끈다 — 적이 살아서 때려야 잰다
    g.dealAoe = () => {};
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

console.log('\n=== 26. 계열 패시브 / 장착 칸 ===');
{
  ok(D.SKILL_SLOTS === 8, '장착 칸이 여덟이다', `${D.SKILL_SLOTS}칸`);
  ok(D.SKILL_SLOT_AT.length === D.SKILL_SLOTS - D.SKILL_SLOT_BASE,
    '열리는 관문 수가 칸 수와 맞는다', `${D.SKILL_SLOT_BASE} + ${D.SKILL_SLOT_AT.length}`);
  ok(D.SKILL_SLOT_AT.every((v, i) => i === 0 || v > D.SKILL_SLOT_AT[i - 1]),
    '칸이 열리는 관문이 오름차순이다', D.SKILL_SLOT_AT.join(','));
  ok(D.skillSlotCount(9999) === D.SKILL_SLOTS, '끝까지 가면 여덟 칸이 전부 열린다');

  // 계열마다 세 갈래(내공·외공·무공)가 하나씩 있어야 한다
  ok(D.PASSIVES.length === D.JOBS.length * D.PASSIVE_KINDS.length,
    '계열마다 갈래가 하나씩 있다', `${D.PASSIVES.length} = ${D.JOBS.length} x ${D.PASSIVE_KINDS.length}`);
  for (const j of D.JOBS) {
    const kinds = D.passivesOf(j.id).map((p) => p.kind);
    ok(new Set(kinds).size === D.PASSIVE_KINDS.length, `${j.name}에 세 갈래가 다 있다`, kinds.join(','));
  }
  // **계열마다 값이 달라야 한다.** 같으면 고른 계열이 패시브에서 안 드러난다.
  const neiPer = D.JOBS.map((j) => D.passivesOf(j.id).find((p) => p.kind === 'nei').per);
  ok(new Set(neiPer).size >= 4, '같은 갈래라도 계열마다 세기가 다르다',
    `내공 ${new Set(neiPer).size}종`);
  // 축 이름이 전부 사람 말로 적혀 있어야 한다 — 없으면 화면에 영문이 뜬다
  const noName = D.PASSIVES.filter((p) => !D.PASSIVE_STAT_NAME[p.stat]);
  ok(noName.length === 0, '패시브가 미는 축에 전부 이름이 있다',
    noName.map((p) => p.stat).join(',') || '없음');

  // 지금 들어간 계열 것만 켜진다
  const g = strong(600);
  g.s.books = big(1e12);
  g.s.bestStage = 9999;
  g.s.merit = big(1e9);                  // 문파를 바꾸는 데 공적이 든다
  for (const j of D.JOBS) g.s.jobTests[j.id] = true;
  ok(g.setJob('monk'), '마불에 들어간다');
  ok(g.passiveUp('monk-nei', 10) === 10, '내 계열 패시브는 올라간다');
  ok(g.passiveUp('sword-nei', 1) === 0, '남의 계열 패시브는 못 올린다');
  const hpOn = g.stats().hp;
  ok(Object.keys(g.passiveSum()).length > 0, '켜져 있다', JSON.stringify(g.passiveSum()));
  g.setJob('poison');
  ok(Object.keys(g.passiveSum()).length === 0, '문파를 바꾸면 그쪽 패시브가 꺼진다');
  g.setJob('monk');
  ok(g.passiveLv('monk-nei') === 10, '돌아오면 올려 둔 게 그대로다');
  ok(Math.abs(g.stats().hp - hpOn) < 1, '돌아오면 효과도 그대로다');

  // 쿨타임은 바닥이 있어야 한다 — 0이 되면 평타·영수가 의미를 잃는다
  const g2 = strong(600);
  g2.s.books = big(1e12); g2.s.bestStage = 9999;
  for (const j of D.JOBS) g2.s.jobTests[j.id] = true;
  g2.setJob('blade');
  g2.passiveUp('blade-mu', D.PASSIVE_MAX);
  const sk = D.SKILLS.find((x) => x.id === 'slash');
  ok(g2.skillCdOf(sk) >= sk.cd * 0.3 - 1e-9, '쿨타임이 원래의 30% 아래로는 안 내려간다',
    `${g2.skillCdOf(sk).toFixed(2)}초 / 바닥 ${(sk.cd * 0.3).toFixed(2)}초`);

  // 받는 피해 감소도 바닥이 있어야 한다
  const g3 = strong(600);
  g3.s.books = big(1e12); g3.s.bestStage = 9999;
  for (const j of D.JOBS) g3.s.jobTests[j.id] = true;
  g3.setJob('fist');
  g3.passiveUp('fist-nei', D.PASSIVE_MAX);
  ok(g3.stats().guard >= 0.2 - 1e-9, '받는 피해를 80%까지만 줄인다',
    `guard ${g3.stats().guard.toFixed(3)}`);

  // 세이브에 남는다
  const g4 = strong(600);
  g4.s.books = big(1e12); g4.s.bestStage = 9999;
  for (const j of D.JOBS) g4.s.jobTests[j.id] = true;
  g4.setJob('ring');
  g4.passiveUp('ring-wai', 7);
  const back = migrate(JSON.parse(JSON.stringify(g4.toJSON())));
  ok(back.passives['ring-wai'] === 7, '패시브 레벨이 세이브에 남는다', `${back.passives['ring-wai']}`);
  ok(migrate({}).passives && Object.keys(migrate({}).passives).length === 0,
    '옛 세이브는 빈 채로 들어온다');

// ---------- 27. 문파 특성이 실제로 들어가는가 ----------
//
// **주고도 안 읽는 자리**를 만들지 않는다. 오늘만 해도 사건을 보내 놓고
// 받는 쪽을 안 만든 적이 세 번 있었다. 특성은 여덟 개나 되므로 하나씩 돌린다.
console.log('');
console.log('=== 27. 문파 특성 ===');
{
  // 특성이 붙은 채로 무공을 한 번 쓰고, 그 결과를 본다
  const cast = (job, skillId = 'slash', tune) => {
    const g = strong(200);
    g.s.job = job;
    g.rng = (() => { let s2 = 7; return () => ((s2 = (s2 * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    g.spawn();
    tune?.(g);
    g.cd = {};
    const before = {
      gold: g.s.gold, hp: g.heroHp,
      bleed: g.mon?.bleed || 0, weak: g.mon?.weak || 0,
    };
    const ok2 = g.useSkill(skillId);
    return { g, ok: ok2, before, mon: g.mon };
  };

  // 혈천도마 〈혈기〉 — 모든 무공이 출혈을 건다. 선풍검은 본래도 출혈이라
  // 출혈이 **없는** 무공으로 본다(뇌정검은 둔화만 건다).
  {
    const no = cast(null, 'thunder');
    const yes = cast('blade', 'thunder');
    ok(no.ok && yes.ok, '뇌정검이 나갔다');
    ok(!(no.mon.bleed > 0), '문파가 없으면 뇌정검은 출혈을 안 건다', `${no.mon.bleed || 0}초`);
    ok(yes.mon.bleed > 0, '혈천도마는 뇌정검에도 출혈이 붙는다', `${yes.mon.bleed.toFixed(1)}초`);
  }
  // 환마 〈환기〉 — 파쇄
  {
    const no = cast(null, 'thunder');
    const yes = cast('fan', 'thunder');
    ok(!(no.mon.weak > 0), '문파가 없으면 파쇄가 안 붙는다');
    ok(yes.mon.weak > 0, '환마는 모든 무공에 파쇄가 붙는다', `${yes.mon.weak.toFixed(1)}초`);
  }
  // 독마 〈독기〉 — 출혈이 더 아프다
  {
    const b = cast('blade', 'thunder');
    const p = cast('poison', 'thunder');
    ok(p.mon.bleedPer > b.mon.bleedPer, '독마의 중독이 혈천도마의 출혈보다 아프다',
      `${b.mon.bleedPer.toExponential(2)} → ${p.mon.bleedPer.toExponential(2)}`);
  }
  // 마불 〈불력〉 — 무공을 쓰면 체력이 찬다
  {
    const r = cast('monk', 'thunder', (g) => { g.heroHp = g.stats().hp.mul(0.5); });
    ok(gt(r.g.heroHp, r.before.hp), '마불은 무공을 쓰면 체력이 찬다',
      `${r.before.hp.toExponential(2)} → ${r.g.heroHp.toExponential(2)}`);
    const n = cast(null, 'thunder', (g) => { g.heroHp = g.stats().hp.mul(0.5); });
    ok(Math.abs(n.g.heroHp - n.before.hp) < 1e-9, '문파가 없으면 안 찬다');
  }
  // 취마 〈주기〉 — 무공을 쓰면 은자가 떨어진다
  {
    const r = cast('drunk', 'thunder');
    ok(gt(r.g.s.gold, r.before.gold), '취마는 무공을 쓰면 은자가 들어온다',
      `+${(r.g.s.gold - r.before.gold).toExponential(2)}`);
    // 보이는 쪽도 있어야 한다 — 사건을 보내 놓고 받는 쪽이 없으면 없는 것과 같다
    ok(r.g.events.some((e) => e.type === 'gold' && e.fromSkill), '은자가 떨어진 사건을 보낸다');
  }
  // 권마 〈강기〉 — 다른 무공의 쿨이 줄어든다
  {
    const g = strong(200);
    g.s.job = 'fist';
    g.spawn();
    g.cd = { frost: 10 };
    g.useSkill('thunder');
    ok(g.cd.frost < 10, '권마는 무공을 쓰면 다른 무공 쿨이 준다', `10 → ${g.cd.frost.toFixed(1)}초`);
    const g2 = strong(200);
    g2.spawn();
    g2.cd = { frost: 10 };
    g2.useSkill('thunder');
    ok(g2.cd.frost === 10, '문파가 없으면 안 준다');
  }
  // 일화검존 〈검의〉 — 두목에게 더 아프다
  {
    // **체력을 1e300으로 두고 뺄셈을 하면 안 된다.** 피해가 1e10이라
    // 자리수가 290이나 차이 나서 뺀 값이 그대로 0으로 나왔다(여기서 겪었다).
    // 보낸 피해 사건을 그대로 센다.
    const hit = (job) => {
      const g = strong(200);
      g.s.job = job;
      g.rng = () => 0.99;                 // 치명이 안 터지게 고정한다
      g.spawn();
      g.mon.isBoss = true;
      g.mon.hp = Big.pow10(500);
      g.cd = {};
      g.events.length = 0;
      g.useSkill('thunder');
      return g.events.filter((e) => e.type === 'dmg').reduce((a, e) => a.add(e.amount || 0), big(0));
    };
    const a = hit(null), b = hit('sword');
    ok(gt(b, big(a).mul(1.2)), '일화검존은 모든 무공이 두목에게 더 아프다',
      `${a.toExponential(2)} → ${b.toExponential(2)}`);
  }
  // 극악소마 〈지력〉 — 치명이 뜰 수 있다
  {
    const hit = (job, roll) => {
      const g = strong(200);
      g.s.job = job;
      g.rng = () => roll;
      g.spawn();
      g.mon.hp = Big.pow10(500);
      g.cd = {};
      g.events.length = 0;
      g.useSkill('thunder');
      return g.events.filter((e) => e.type === 'dmg').reduce((a, e) => a.add(e.amount || 0), big(0));
    };
    ok(gt(hit('ring', 0.01), big(hit(null, 0.01)).mul(1.2)), '극악소마는 무공도 치명이 터진다',
      `${hit(null, 0.01).toExponential(2)} → ${hit('ring', 0.01).toExponential(2)}`);
    ok(big(hit('ring', 0.99)).eq(hit(null, 0.99)), '안 터질 때는 그대로');
  }
  // 맛보기로는 특성이 안 붙는다 — 그러면 전직할 이유가 없다
  {
    const g = strong(200);
    g.s.taste = 'blade';
    g.s.job = null;
    ok(g.jobTrait() === null, '맛보기만으로는 특성이 안 붙는다');
    ok(g.jobSkills().length <= 1, '맛보기는 1차 무공 하나만', `${g.jobSkills().length}개`);
  }
}

// ---------- 28. 무공 차수 ----------
console.log('');
console.log('=== 28. 무공 차수 ===');
{
  const sk = D.SKILLS[0];
  ok(D.skillTierOf(0) === 0 && D.skillTierOf(49) === 0 && D.skillTierOf(50) === 1,
    '50레벨마다 차수가 오른다');
  ok(D.skillTierMult(50) > D.skillTierMult(49), '차수가 오르면 배율이 붙는다',
    `${D.skillTierMult(49)} → ${D.skillTierMult(50)}`);
  const names = [0, 50, 100, 500, 1000].map((l) => D.skillTierName(sk, l));
  ok(new Set(names).size === names.length, '차수마다 이름이 다르다', names.join(' / '));
  // 끝이 없다
  ok(D.skillTierMult(5000) > D.skillTierMult(4000) && Number.isFinite(D.skillTierMult(5000)),
    '차수에 끝이 없다');
  // 실제 피해에 들어가는가
  const g = strong(200);
  g.s.skills.slash = 49;
  const a = g.skillMult(sk);
  g.s.skills.slash = 50;
  const b = g.skillMult(sk);
  ok(b > a * 1.5, '차수가 오르면 실제 피해가 뛴다', `${a.toFixed(1)} → ${b.toFixed(1)}`);
  const ti = D.skillTierInfo(sk, 62);
  ok(ti.tier === 1 && ti.inTier === 12 && ti.left === 38, '차수 안 진행도가 맞는다',
    `${ti.name} ${ti.inTier}/${ti.step}`);
}

// ---------- 29. 무공 연계 ----------
//
// 무공이 서른여덟인데 고르는 기준이 "센 것 여덟"뿐이면 칸이 여덟일 이유가 없다.
// 연계가 **실제로 터지고, 실제로 더 아프고, 고리가 막히지 않는가**를 본다.
console.log('');
console.log('=== 29. 무공 연계 ===');
{
  // 고리가 막히면 안 된다 — 여섯 기운이 모두 남겨지고 모두 먹혀야 한다
  const leaves = new Set(Object.values(D.SKILL_QI).map((q) => q.leaves));
  const feeds = new Set(Object.values(D.SKILL_QI).map((q) => q.feeds));
  ok(D.QI_KEYS.every((k) => leaves.has(k)), '여섯 기운이 모두 남겨진다',
    D.QI_KEYS.filter((k) => !leaves.has(k)).join(',') || '빠짐없음');
  ok(D.QI_KEYS.every((k) => feeds.has(k)), '여섯 기운이 모두 먹힌다',
    D.QI_KEYS.filter((k) => !feeds.has(k)).join(',') || '빠짐없음');
  const noQi = D.SKILLS.filter((s) => !D.SKILL_QI[s.id]);
  ok(noQi.length === 0, '기운이 안 적힌 무공이 없다', noQi.map((s) => s.id).join(',') || '없음');
  // 자기 자신으로 이어지면 한 무공만 연타해도 계속 터진다
  const self = Object.entries(D.SKILL_QI).filter(([, q]) => q.leaves === q.feeds);
  ok(self.length === 0, '자기가 남긴 걸 자기가 먹는 무공은 없다',
    self.map(([k]) => k).join(',') || '없음');

  // 실제로 터지는가
  const run = (first, second) => {
    const g = strong(200);
    g.rng = () => 0.99;
    g.spawn();
    g.mon.hp = Big.pow10(500);
    g.cd = {};
    g.useSkill(first);
    g.events.length = 0;
    g.cd = {};
    g.useSkill(second);
    const dmg = g.events.filter((e) => e.type === 'dmg').reduce((a, e) => a.add(e.amount || 0), big(0));
    const combo = g.events.some((e) => e.type === 'combo');
    return { dmg, combo, g };
  };
  // 뇌정검(뇌를 남긴다) → 빙백신장(뇌를 먹는다)
  ok(D.qiOf('thunder').leaves === D.qiOf('frost').feeds, '뇌정검 다음 빙백신장이 이어진다');
  const linked = run('thunder', 'frost');
  ok(linked.combo, '이어 쓰면 연계가 터진다');
  // 안 이어지는 짝 — 빙백신장(한)은 선풍검(풍)이 안 먹는다
  ok(D.qiOf('frost').leaves !== D.qiOf('slash').feeds, '빙백신장 다음 선풍검은 안 이어진다');
  const plain = run('frost', 'slash');
  ok(!plain.combo, '안 이어지면 연계가 안 터진다');

  // 더 아픈가 — 같은 무공을 연계로 쓸 때와 아닐 때
  const alone = (() => {
    const g = strong(200);
    g.rng = () => 0.99;
    g.spawn();
    g.mon.hp = Big.pow10(500);
    g.cd = {};
    g.events.length = 0;
    g.useSkill('frost');
    return g.events.filter((e) => e.type === 'dmg').reduce((a, e) => a.add(e.amount || 0), big(0));
  })();
  ok(linked.dmg > alone * 1.5, '연계로 들어가면 훨씬 아프다',
    `${alone.toExponential(2)} → ${linked.dmg.toExponential(2)}`);

  // 기운은 식는다 — 시간이 지나면 안 이어진다
  {
    const g = strong(200);
    g.spawn();
    g.cd = {};
    g.useSkill('thunder');
    ok(g.qiLeft > 0 && g.qiNow === 'bolt', '쓴 뒤에 기운이 남는다', `${g.qiNow} ${g.qiLeft}초`);
    for (let i = 0; i < 60 * (D.COMBO_SEC + 1); i++) g.tick(1 / 60);
    ok(g.qiLeft === 0 && g.qiNow === null, '시간이 지나면 식는다');
    ok(g.comboStreak === 0, '식으면 이어 온 횟수도 끊긴다');
  }

  // 연달아 이으면 더 커진다
  ok(D.comboMult(3) > D.comboMult(1), '연달아 이으면 배수가 커진다',
    `${D.comboMult(1).toFixed(2)} → ${D.comboMult(3).toFixed(2)}`);
  ok(D.comboMult(99) === D.comboMult(D.COMBO_STREAK_MAX), '끝없이 커지지는 않는다',
    `×${D.comboMult(99).toFixed(2)}`);

  // 자동 시전이 연계를 노리는가 — 운으로만 터지면 칸을 짜는 뜻이 없다.
  // 돌려서 본다: 이어지는 무공만 넣어 두고 연계가 실제로 터지는지.
  {
    const g2 = strong(200);
    g2.s.skillSlots = ['thunder', 'frost', 'chain', 'plum'];
    g2.s.autoSkill = true;
    g2.spawn();
    let combos = 0;
    for (let i = 0; i < 60 * 30; i++) {
      g2.tick(1 / 60);
      combos += g2.events.filter((e) => e.type === 'combo').length;
      g2.events.length = 0;
      if (g2.mon) g2.mon.hp = Big.pow10(500);        // 안 죽게 두고 30초를 본다
    }
    ok(combos > 0, '자동으로 두고 봐도 연계가 터진다', `30초에 ${combos}번`);
  }
}

// ---------- 30. 특성 단련 / 문파 교체 ----------
console.log('');
console.log('=== 30. 특성 단련 · 문파 교체 ===');
{
  const g = strong(500);
  g.s.rank = 9; g.s.bestStage = 9999;
  for (const j of D.JOBS) g.s.jobTests[j.id] = true;
  g.s.merit = big(1e6);
  g.setJob('blade');

  const t0 = g.jobTrait();
  ok(t0.lv === 0, '처음엔 0단');
  ok(g.traitUp(), '공적으로 올린다');
  const t1 = g.jobTrait();
  ok(t1.lv === 1, '한 단 올랐다');
  ok(t1.ccSec > t0.ccSec, '올리면 특성이 세진다', `${t0.ccSec} → ${t1.ccSec.toFixed(2)}`);
  // 끝이 없다
  ok(gt(D.traitCost(500), D.traitCost(499)) && fin(D.traitCost(500)), '단련에 끝이 없다',
    D.traitCost(500).toExponential(1));
  ok(D.traitScale(100) > D.traitScale(50), '올릴수록 계속 세진다');
  // 치명 확률만은 1을 넘으면 버려지므로 막는다
  {
    const gr = strong(500);
    gr.s.rank = 9; gr.s.bestStage = 9999;
    for (const j of D.JOBS) gr.s.jobTests[j.id] = true;
    gr.s.merit = big(1e12);
    gr.setJob('ring');
    gr.s.traitLv.ring = 500;
    ok(gr.jobTrait().critChance <= 1, '치명 확률 특성이 1을 안 넘는다',
      `${gr.jobTrait().critChance}`);
  }

  // 특성 레벨은 문파마다 따로 쌓인다 — 갈아타는 진짜 값이 이것이다
  g.traitUp(); g.traitUp();
  const bladeLv = g.traitLvOf('blade');
  g.setJob('poison');
  ok(g.jobTrait().lv === 0, '갈아타면 그쪽은 0단부터');
  ok(g.traitLvOf('blade') === bladeLv, '두고 온 단련은 남아 있다', `${bladeLv}단`);
  g.setJob('blade');
  ok(g.jobTrait().lv === bladeLv, '돌아오면 그대로다');

  // 공적이 실제로 들어오는가 — 안 들어오면 올릴 길이 없다
  ok(D.bossMerit(300) > D.bossMerit(100), '관문이 오를수록 공적도 는다',
    `${D.bossMerit(100)} → ${D.bossMerit(300)}`);
  // 관문지기를 실제로 넘겨 보고 공적이 들어오는지 본다
  {
    const gm = strong(200);
    const m0 = gm.s.merit;
    gm.spawn();
    gm.mon.isBoss = true;
    gm.mon.hp = big(1);
    gm.dealDamage(1e30);
    ok(gm.s.merit > m0, '관문지기를 넘으면 공적이 들어온다', `+${gm.s.merit - m0}`);
  }
  // 세이브에 남는가
  const back = migrate(JSON.parse(JSON.stringify(g.toJSON())));
  ok(back.traitLv?.blade === bladeLv, '특성 단련이 세이브에 남는다', `${back.traitLv?.blade}`);
  // 공적은 이제 Big이다 — 세이브에는 "1.2e500" 글자로 들어갔다 나온다
  ok(fin(back.merit) && pos(back.merit), '공적이 세이브에 남는다', fmt(back.merit));
  ok(migrate({}).traitLv && Object.keys(migrate({}).traitLv).length === 0,
    '옛 세이브는 빈 채로 들어온다');
}

// ---------- 31. 회귀가 벽을 뚫는가 ----------
//
// 회귀는 후반 벽을 뚫는 **유일한** 장치다. 그런데 배수가 더하기(1 + 0.16 x pt)라
// 관문 600에서 x18.6, 900에서 x28.2였다 — 300관문을 더 가는 데 드는 힘은
// 1.085^300 = 2e11배인데 돌려받는 건 1.5배였다. 그래서 여덟 시간에 회귀가
// 0~1번밖에 안 터졌고 두 시간을 넘기면 관문이 꺾였다.
console.log('');
console.log('=== 31. 회귀 ===');
{
  // 곱하기여야 한다. 더하기면 뒤로 갈수록 반드시 손해가 된다.
  const m1 = D.regressMult(100);
  const m2 = D.regressMult(200);
  const m3 = D.regressMult(300);
  ok(m2 / m1 > 1.5 && Math.abs((m2 / m1) - (m3 / m2)) < 1e-6,
    '기억의 힘이 곱하기로 는다 (100개마다 같은 배수)',
    `x${m1.toExponential(1)} → x${m2.toExponential(1)} → x${m3.toExponential(1)}`);
  ok(big(D.regressMult(0)).eq(1), '기억이 없으면 배수도 1');
  ok(fin(D.regressMult(1200)) && fin(D.regressMult(100000)), '한참 쌓아도 숫자가 안 터진다',
    `x${D.regressMult(1200).toExponential(1)}`);

  // 관문을 더 갈수록 돌려받는 것도 더 커져야 한다
  const at = (s2) => D.regressMult(D.regressGain(s2));
  ok(at(900) / at(600) > at(600) / at(400), '멀리 갈수록 회귀 이득이 더 커진다',
    `400→600 x${(at(600) / at(400)).toExponential(1)} · 600→900 x${(at(900) / at(600)).toExponential(1)}`);

  // 실제로 적용되는가 — 주고도 안 읽으면 없는 것과 같다
  const g = strong(300);
  g.s.regress.points = 0;
  const a0 = g.stats({ buffs: false });
  g.s.regress.points = 60;
  const a1 = g.stats({ buffs: false });
  ok(a1.atk > a0.atk * 2, '기억이 공격력에 붙는다', `${a0.atk.toExponential(2)} → ${a1.atk.toExponential(2)}`);
  ok(a1.hp > a0.hp * 2, '체력에도 붙는다');
  ok(a1.goldMul > a0.goldMul * 2, '은자에도 붙는다');
  ok(a1.expMul > a0.expMul * 2, '경험치에도 붙는다');

  // 회귀가 실제로 돌아가는가 — 조건이 너무 빡빡하면 영영 안 터진다
  {
    const gg = strong(600);
    gg.s.maxStage = 600;
    gg.s.climbAt = 0;
    gg.clock = D.REGRESS_STUCK_SEC + 10;      // 막힌 지 한참 됐다
    ok(gg.regressWorthMult() >= D.REGRESS_WORTH_MULT,
      '관문 600이면 회귀할 값어치가 있다', `x${gg.regressWorthMult().toExponential(1)}`);
    ok(gg.regressWorth(), '막혀 있으면 회귀를 권한다');
    gg.clock = 1;                              // 방금 올라갔다
    gg.s.climbAt = 0;
    ok(!gg.regressWorth(), '잘 올라가는 중이면 안 권한다');
  }
  // 되돌아간 뒤에 실제로 세져 있는가
  {
    const gg = strong(600);
    gg.s.maxStage = 600;
    gg.s.regress.points = 0;
    const before = gg.stats({ buffs: false }).atk;
    const got = gg.regress();
    ok(got > 0, '회귀하면 기억을 받는다', `+${got}`);
    ok(gg.s.stage === 1 && gg.s.maxStage === 1, '관문이 1로 돌아간다');
    ok(gg.s.bestStage >= 600, '최고 기록은 남는다', `${gg.s.bestStage}`);
    ok(gg.regressMult() > 100, '기억의 힘이 크게 붙는다', `x${gg.regressMult().toExponential(1)}`);
    // 수련이 지워졌으니 그 자리의 공격력은 떨어지는 게 맞다. 보는 건 배수다.
    ok(gt(before, gg.stats({ buffs: false }).atk), '수련은 지워진다');
  }
}

// ---------- 32. 방치 ----------
//
// '방치형'인데 자리를 비우면 관문이 안 밀렸다. 돌아오면 은자와 경험치만
// 쥐여 주고 관문은 그대로였다 — 켜 놓고 기다린다는 말이 성립하지 않았다.
//
// 보여 준 숫자와 실제로 받는 것이 같은지가 핵심이다. 숫자만 띄우고
// 안 옮기면 거짓말이 된다.
console.log('');
console.log('=== 32. 방치 ===');
{
  const away = (tune, hours = 6, climb = true) => {
    const g = strong(300);
    g.s.pace = 30;
    g.s.maxStage = g.s.stage;
    tune?.(g);
    g.s.lastSeen = Date.now() - hours * 3600 * 1000;
    return { g, r: g.offlineReward(Date.now(), climb) };
  };

  // 잰 속도를 쓴다 — 추측하면 274배가 틀린다(평타만 세던 때 실제로 그랬다)
  {
    const g = strong(300);
    g.s.pace = 0;
    ok(g.stageSeconds(300) > 0, '잰 적이 없어도 값이 나온다', `${g.stageSeconds(300).toFixed(0)}초`);
    g.notePace(40);
    ok(Math.abs(g.s.pace - 40) < 1e-9, '한 번 재면 그 값이 들어간다', `${g.s.pace}`);
    g.notePace(20);
    ok(g.s.pace < 40 && g.s.pace > 20, '여러 번 재면 섞인다', `${g.s.pace.toFixed(1)}초`);
    g.notePace(99999);
    ok(g.s.pace < 40, '말도 안 되는 값은 안 섞는다');
  }

  // 비운 만큼 관문이 밀린다
  {
    const a = away(null, 1);
    const b = away(null, 6);
    ok(a.r.stages > 0, '한 시간을 비우면 관문이 밀린다', `${a.r.stages}관문`);
    ok(b.r.stages > a.r.stages, '오래 비울수록 더 민다', `1시간 ${a.r.stages} → 6시간 ${b.r.stages}`);
    // 끝없이 늘면 안 된다 — 서 있는 동안 적도 세진다
    const c = away(null, 24);
    ok(c.r.stages < b.r.stages * 3, '오래 비운다고 비례해서 늘지는 않는다',
      `6시간 ${b.r.stages} → 24시간 ${c.r.stages}`);
  }

  // **수련 중이면 안 민다** — 밀지 말라고 켜 둔 자리다
  {
    const f = away((g) => { g.s.farming = true; }, 6);
    ok(f.r.stages === 0, '수련 중이면 관문은 제자리', `${f.r.stages}관문`);
    ok(f.r.gold > 0, '그래도 은자는 번다');
  }

  // 앱을 껐던 경우는 은자·경험치만
  {
    const off = away(null, 6, false);
    ok(off.r.stages === 0, '앱을 껐던 경우는 관문을 안 민다');
    ok(off.r.gold > 0 && off.r.exp > 0, '은자·경험치는 준다');
  }

  // **보여 준 대로 실제로 옮겨지는가.** 미리 보기와 받기가 같은 길을 써야 한다.
  {
    const { g, r } = away(null, 6);
    const shown = r.to;
    const beforeUp = { ...g.s.upgrades };
    ok(g.s.stage === r.from, '미리 보기는 아무것도 안 바꾼다');
    ok(JSON.stringify(g.s.upgrades) === JSON.stringify(beforeUp), '수련 레벨도 안 바뀐다');
    g.claimOffline(r);
    ok(g.s.stage === shown, '받으면 보여 준 관문으로 옮겨진다', `${r.from} → ${g.s.stage}`);
    ok(g.s.maxStage >= shown, '최고 기록도 따라 오른다');
  }

  // 방치하는 동안 번 걸 수련에 붓는다 — 안 그러면 금세 벽에 걸린다
  {
    const on = away((g) => { g.s.autoTrain = true; }, 6);
    const off = away((g) => { g.s.autoTrain = false; }, 6);
    ok(on.r.stages >= off.r.stages, '수련을 켜 두면 더 멀리 간다',
      `켬 ${on.r.stages} / 끔 ${off.r.stages}`);
    const g2 = away((g) => { g.s.autoTrain = true; }, 6);
    const before = Object.values(g2.g.s.upgrades).reduce((a, b) => a + b, 0);
    g2.g.claimOffline(g2.r);
    const after = Object.values(g2.g.s.upgrades).reduce((a, b) => a + b, 0);
    ok(after > before, '받고 나면 수련 레벨이 실제로 올라 있다', `${before} → ${after}`);
  }

  // 너무 짧게 비운 건 아무것도 아니다
  {
    const g = strong(300);
    g.s.lastSeen = Date.now() - 10 * 1000;
    ok(g.offlineReward() === null, '십 초 비운 건 보상이 없다');
  }
}

// ---------- 33. 관문 이동 ----------
console.log('');
console.log('=== 33. 관문 이동 ===');
{
  const g = strong(300);
  g.s.maxStage = 300;
  ok(g.canGoStage(150), '넘어 본 관문으로는 간다');
  ok(!g.canGoStage(301), '안 넘어 본 관문으로는 못 간다');
  ok(!g.canGoStage(0), '0관문으로는 못 간다');
  ok(g.goStage(150) && g.s.stage === 150, '실제로 옮겨진다', `${g.s.stage}`);
  ok(g.s.maxStage === 300, '되돌아가도 최고 기록은 안 깎인다', `${g.s.maxStage}`);
  ok(g.s.kills === 0 && g.s.wave === 0, '옮기면 물결이 처음부터');
  ok(g.goStage(300) && g.s.stage === 300, '최고로 돌아올 수 있다');
  // 싸우는 중에는 못 옮긴다
  g.mode = 'dungeon';
  ok(!g.canGoStage(100), '싸우는 중에는 못 옮긴다');
}

// ---------- 34. 전직 시험이 사람을 따라오는가 ----------
//
// 시험을 **절대 체력**으로 맞춰 두면 사람이 세질수록 저절로 쉬워진다.
// 재 보니 여덟이 전부 0.4초에 끝나서, 적이 때려 보지도 못하고 죽는 바람에
// '맞아 가며 이겨라'(취생)와 '버텨라'(부동)는 **아무도 못 붙었다.**
console.log('');
console.log('=== 34. 전직 시험 ===');
{
  for (const d of D.JOB_TESTS) {
    ok(!!d.hpSec || !!d.immortal, `${d.name}이 절대 체력으로 안 맞춰져 있다`,
      d.hpSec ? `hpSec ${d.hpSec}` : '벨 수 없음');
    ok(!d.hpMult, `${d.name}에 옛 hpMult가 안 남아 있다`);
  }
  // '벨 수 없다'고 적은 시험은 실제로 벨 수 없어야 한다
  const endure = D.JOB_TESTS.find((d) => d.goal === 'endure');
  ok(endure && endure.immortal, '부동의 상대는 실제로 벨 수 없다');

  // 체력의 몇 %를 맞는다고 적었으면 **그만큼 맞아야 한다.**
  // 호신강기가 guard로 깎아서 62%로 적어 둔 것이 12%로 들어가고 있었다 —
  // 그래서 '맞아 가며 이겨라'(취생)에 아무도 못 붙었다.
  // 받는 피해를 많이 깎아 둔 사람도 적어 둔 만큼은 맞아야 한다
  {
    // strong()은 이것저것 쥐여 주는 도우미라 여기선 깨끗한 세이브로 본다 —
    // 재는 것은 '적어 둔 비율이 그대로 들어가는가' 하나다.
    const s2 = newSave();
    Object.assign(s2, { stage: 300, bestStage: 300, maxStage: 300, level: 1200, rank: 7 });
    Object.assign(s2.upgrades, { atk: 320, hp: 230, guard: 120 });
    const g = new Game(s2);
    g.jobStageOpen = () => true;
    g.spawn();
    const want = D.jobTestOf('drunk').atkHpFrac;
    g.startJobTest('drunk');
    const st = g.stats({ buffs: false });
    ok(st.guard < 0.9, '받는 피해가 실제로 깎여 있다', `x${st.guard.toFixed(2)}`);
    const landed = (g.mon.atk * st.guard) / st.hp;
    ok(Math.abs(landed - want) < 0.02, '적어 둔 만큼 실제로 맞는다',
      `적은 값 ${(want * 100).toFixed(0)}% / 들어가는 값 ${(landed * 100).toFixed(1)}%`);
  }

  // 시험 체력이 사람을 따라오는가 — 같은 사람이 세지면 상대도 단단해져야 한다
  {
    const g = strong(300);
    g.s.rank = Math.max(g.s.rank, D.JOB_RANK);
    g.jobStageOpen = () => true;
    g.spawn();
    g.startJobTest('sword');
    const before = g.mon.hp;
    g.endContest('fail');
    g.s.upgrades.atk += 300;        // 같은 사람이 훨씬 세졌다
    g.s.jobTests = {};
    g.spawn();
    g.startJobTest('sword');
    ok(g.mon.hp > before * 10, '세지면 상대도 그만큼 단단해진다',
      `${before.toExponential(1)} → ${g.mon.hp.toExponential(1)}`);
  }
}
}

// ---------- 35. 자리가 계속 바뀌는가 / 큰 수가 읽히는가 ----------
//
// 앞말이 다섯에서 멈춰 있어서 **관문 321부터는 끝까지 전부 '무간 OO'**였다.
// 한 시간에 1500관문을 가는 지금은 눈에 보이는 게 영영 안 바뀐다는 뜻이다.
console.log('');
console.log('=== 35. 자리와 큰 수 ===');
{
  // 멀리 가도 이름이 계속 바뀐다
  const names = [];
  for (let s = 1; s <= 4000; s += 40) names.push(D.zoneOf(s).name);
  const uniq = new Set(names);
  ok(uniq.size >= 60, '멀리 가도 자리 이름이 계속 바뀐다', `${uniq.size}가지`);
  // 어느 구간에서도 멈추지 않는다 — 1000~2000 사이에만도 여러 가지가 나와야 한다
  const late = new Set();
  for (let s = 1000; s <= 2000; s += 40) late.add(D.zoneOf(s).name);
  ok(late.size >= 10, '관문 1000~2000 사이에서도 계속 바뀐다', `${late.size}가지`);
  // 끝에서 멈추지 않고 **다시 돈다**
  ok(D.zoneTierOf(1) === D.zoneTierOf(1 + D.ZONE_CYCLE * D.ZONE_TIERS.length),
    '앞말을 다 쓰면 처음부터 다시 돈다');
  ok(D.zoneLoopOf(1) === 0 && D.zoneLoopOf(1 + D.ZONE_CYCLE * D.ZONE_TIERS.length) === 1,
    '몇 순째인지 센다');
  ok(/2순/.test(D.zoneOf(1 + D.ZONE_CYCLE * D.ZONE_TIERS.length).name),
    '두 번째 바퀴는 이름에 적힌다', D.zoneOf(1 + D.ZONE_CYCLE * D.ZONE_TIERS.length).name);

  // 자리마다 바닥 그림이 한 장씩 있어야 한다. 하나라도 없으면 그 자리만
  // 바닥이 맨땅으로 나온다 — 자리를 늘리면서 그림을 안 구우면 그렇게 된다.
  {
    const fs2 = require('node:fs');
    const miss = [];
    for (let i = 0; i < D.ZONES.length; i++) {
      if (!fs2.existsSync(`art/zone/zone-${i}.jpg`)) miss.push(i);
    }
    ok(miss.length === 0, '자리마다 바닥 그림이 있다',
      miss.length ? `없음: zone-${miss.join(', zone-')}` : `${D.ZONES.length}장`);
  }

  // 바닥 그림 번호가 범위를 벗어나면 바닥이 안 그려진다.
  let badIdx = 0;
  for (let s = 1; s <= 5000; s += 7) {
    const z = D.zoneOf(s);
    if (!(z.idx >= 0 && z.idx < D.ZONES.length)) badIdx++;
  }
  ok(badIdx === 0, '바닥 그림 번호가 늘 범위 안', `${badIdx}건`);

  // 적 생김새도 같이 바뀐다 — 이름만 바뀌면 똑같아 보인다
  const robes = new Set();
  for (let s = 1; s <= 4000; s += 40) robes.add(D.zoneOf(s).mobs[0].look.robe);
  ok(robes.size >= 20, '적 옷 빛깔도 자리마다 바뀐다', `${robes.size}가지`);
  // 빛깔이 제대로 된 색인가 (#rrggbb)
  let badHex = 0;
  for (const c of robes) if (!/^#[0-9a-f]{6}$/i.test(c)) badHex++;
  ok(badHex === 0, '빛깔이 전부 제대로 된 색', `${badHex}건`);

  // ---- 큰 수 ----
  // 한글 단위가 끝나면 알파벳이 이어받는다. 지수(1.00e60)가 뜨면 안 읽힌다.
  ok(fmt(1e52).endsWith('a'), '한글 단위가 끝나면 a부터', fmt(1e52));
  ok(fmt(1e56).endsWith('b'), '그 다음은 b', fmt(1e56));
  const seq = [0, 1, 25, 26, 27, 51, 52, 701, 702].map((i) => alphaUnit(i));
  ok(seq.join(',') === 'a,b,z,aa,ab,az,ba,zz,aaa', 'a-z 다음은 aa-az, ba …', seq.join(' '));
  // 아무리 커도 지수 표기로 안 샌다
  let bad = [];
  for (let e = 4; e <= 300; e += 4) {
    const s = fmt(Math.pow(10, e));
    if (/e[+-]?\d/.test(s)) bad.push(`1e${e}→${s}`);
  }
  ok(bad.length === 0, '아무리 커도 지수로 안 샌다', bad.slice(0, 3).join(', ') || '전부 읽힘');
  // 글자가 겹치지 않는다 — 겹치면 어느 쪽이 큰지 알 수 없다
  const units = [];
  for (let i = 0; i < 400; i++) units.push(alphaUnit(i));
  ok(new Set(units).size === units.length, '단위 글자가 겹치지 않는다', `${units.length}개`);
}

// ---------- 36. 건너뛰기와 두목 바로 ----------
//
// "관문 깨면 바로 두목이 나와야 하는데 안 나온다"와 "회귀 수치에 따라
// 관문을 건너뛰어야 한다"가 이 절의 두 가지다.
//
// 건너뛰기에서 꼭 지켜야 하는 것: **건너뛴 몫의 보상은 안 준다.** 한 번
// 공짜로 줘 봤더니 반 시간에 관문 350 → 1238로 뛰고 시뮬이 멎었다.
// 그리고 **같은 땅으로 기억을 두 번 받지 않는다.** 이것도 안 막았을 때
// 회귀 → 빨리 되밀기 → 또 회귀로 기억이 공짜로 찍혀 나왔다(2시간에 1.5e93).
console.log('');
console.log('=== 36. 건너뛰기와 두목 바로 ===');
{
  // 사용자가 든 예: 기억 100개면 다섯씩
  ok(D.stageStep(0) === 1, '기억이 없으면 하나씩', `${D.stageStep(0)}`);
  ok(D.stageStep(100) === 6, '기억 100개면 다섯 관문을 건너뛴다', `${D.stageStep(100)}관문씩`);
  ok(D.stageStep(20) === 2 && D.stageStep(40) === 3, '20개마다 한 칸 더');
  ok(D.stageStep(99999) === 1 + D.REGRESS_SKIP_MAX, '끝없이 늘지는 않는다',
    `최대 ${D.stageStep(99999)}관문씩`);

  // 되밀 때만 성큼성큼 — 그리고 기록은 안 넘는다
  {
    const g = strong(100);
    const full = D.REGRESS_SKIP_PER * D.REGRESS_SKIP_MAX;   // 이만큼 모아야 최대치
    g.s.regress.points = full;
    g.s.bestStage = 1000;
    g.s.maxStage = 100;
    const step = Math.min(D.stageStep(full), g.s.bestStage - g.s.stage);
    ok(step === 1 + D.REGRESS_SKIP_MAX, '기억을 다 모으면 최대치로 건너뛴다',
      `기억 ${full}개 → ${step}관문`);
    // 기록 바로 아래에서는 남은 만큼만
    g.s.stage = 998;
    const near = Math.min(D.stageStep(full), g.s.bestStage - g.s.stage);
    ok(near === 2, '기록 바로 아래면 남은 만큼만', `${near}관문`);
    ok(g.s.stage + near <= g.s.bestStage, '건너뛰어도 기록을 넘지 않는다');
  }

  // 건너뛰기 코드가 실제로 그 자리에 있는가 — 상수만 있고 안 쓰면 없는 것
  {
    const src = srcOf('js/game.js');
    ok(/stageStep\(this\.s\.regress\.points\)/.test(src), '관문을 깰 때 실제로 건너뛴다');
    ok(/if \(s < this\.s\.bestStage\)/.test(src), '되밀 때만 건너뛴다');
    ok(/stageSkip/.test(src) && /stageSkip/.test(srcOf('js/main.js')),
      '건너뛴 걸 화면에도 알린다');
  }

  // 두목이 바로 나온다 — 관문을 깨면 물결이 이미 다 차 있어야 한다
  {
    const g = strong(300);
    g.s.bossRush = true;
    const total = g.waveTotal();
    ok(total >= 1, '물결 수가 센다', `${total}`);
    const src = srcOf('js/game.js');
    ok(/rush \? this\.waveFloor\(\)/.test(src), '바닥 시간도 이미 차 있다');
    ok(/rush \? KILLS_PER_STAGE : 0/.test(src), '졸개도 다 잡은 것으로 둔다');
  }

  // **같은 땅으로 기억을 두 번 받지 않는다**
  {
    const g = strong(500);
    g.s.maxStage = 500;
    g.s.regress.paidTo = 0;
    const first = g.regressPreview();
    ok(first > 0, '관문 500까지 밀면 기억을 받는다', `${first}개`);
    g.regress();
    ok(g.s.regress.paidTo === 500, '받은 데까지 적어 둔다', `${g.s.regress.paidTo}`);
    g.s.maxStage = 500;                 // 같은 자리까지 되밀었다
    ok(g.regressPreview() === 0, '같은 땅으로는 또 안 준다', `${g.regressPreview()}개`);
    g.s.maxStage = 700;                 // 더 멀리 갔다
    ok(g.regressPreview() > 0, '더 멀리 가면 그만큼 더 준다', `${g.regressPreview()}개`);
    ok(g.regressPreview() < first, '처음 500보다는 적다 (500까지는 이미 받았다)');
  }

  // 옛 세이브에 paidTo가 없어도 안 터진다
  {
    const g = new Game(migrate({ maxStage: 300, bestStage: 300,
      regress: { count: 2, points: 50 } }));
    ok(g.s.regress.paidTo === 300, '옛 세이브는 지금 기록까지 받은 것으로 본다',
      `${g.s.regress.paidTo}`);
    ok(new Game(migrate({ maxStage: 300, bestStage: 300 })).s.regress.paidTo === 0,
      '회귀한 적이 없으면 0부터');
    ok(Number.isFinite(g.regressPreview()), '옛 세이브로도 미리 보기가 돈다');
  }
}


// ---------- 37. 병기 뽑기: 묶음과 자동 ----------
//
// x10을 백 번 누르는 게 일이라는 말이 나왔다. 묶음을 키우고 자동을 단다.
// 조심할 것은 **자동이 원보를 바닥까지 긁는 것**이다 — 다시 찍기(원보 200)가
// 영영 막히면 자동을 켠 사람만 손해를 본다.
console.log('');
console.log('=== 37. 병기 뽑기 ===');
{
  // 많이 뽑을수록 싸다. 안 그러면 묶음 단추가 있을 이유가 없다.
  const per = (n) => D.gachaCost(n) / n;
  ok(per(10) < per(1) && per(100) < per(10), '많이 뽑을수록 한 번 값이 싸다',
    `1회 ${per(1)} · 10회 ${per(10)} · 100회 ${per(100)}`);
  ok(D.GACHA_BULK.every((n) => Number.isFinite(D.gachaCost(n)) && D.gachaCost(n) > 0),
    '묶음마다 값이 매겨져 있다', D.GACHA_BULK.map((n) => `${n}회 ${D.gachaCost(n)}`).join(' · '));

  // 뽑은 수만큼 실제로 나온다
  {
    const g = strong(300);
    g.s.gems = D.gachaCost(100) * 3;
    const res = g.gacha(100);
    ok(res && res.length === 100, '100회를 뽑으면 100개가 나온다', `${res?.length}개`);
    ok(g.s.gems === D.gachaCost(100) * 3 - D.gachaCost(100), '값이 딱 한 번만 빠진다',
      `${g.s.gems}`);
    ok(res.every((r) => D.EQUIP_TYPES[r.type] && r.grade >= 0 && r.grade < D.GRADES.length),
      '나온 것이 전부 제대로 된 병기');
  }
  {
    const g = strong(300);
    g.s.gems = 0;
    ok(g.gacha(100) === null, '원보가 모자라면 안 뽑힌다');
  }

  // **남겨 둘 몫을 지킨다**
  {
    const g = strong(300);
    g.s.gems = D.AUTO_GACHA_KEEP + D.gachaCost(1) - 1;
    ok(g.autoGachaSize() === 0, '남겨 둘 몫을 깨면서까지 뽑지는 않는다', `원보 ${g.s.gems}`);
    g.s.gems = D.AUTO_GACHA_KEEP + D.gachaCost(1);
    ok(g.autoGachaSize() === 1, '딱 맞으면 한 번은 뽑는다');
    g.s.gems = D.AUTO_GACHA_KEEP + D.gachaCost(100);
    ok(g.autoGachaSize() === 100, '넉넉하면 가장 큰 묶음으로', `${g.autoGachaSize()}회`);
    ok(D.AUTO_GACHA_KEEP >= D.SP_RESET_GEMS, '다시 찍기 값만큼은 남는다',
      `${D.AUTO_GACHA_KEEP} ≥ ${D.SP_RESET_GEMS}`);
  }

  // 켜 두면 가만 있어도 돈다 — 그리고 합성까지 한다
  {
    const g = strong(300);
    g.s.gems = D.gachaCost(100) * 2;
    g.s.autoGacha = true;
    const before = g.s.stats.gachas;
    for (let i = 0; i < 30 * (D.AUTO_GACHA_SEC + 1); i++) g.tick(1 / 30);
    ok(g.s.stats.gachas > before, '켜 두면 알아서 뽑는다',
      `${before} → ${g.s.stats.gachas}회`);
    ok(g.s.gems >= D.AUTO_GACHA_KEEP || g.s.gems < D.gachaCost(1) + D.AUTO_GACHA_KEEP,
      '돌고 나서도 남겨 둘 몫은 남는다', `원보 ${g.s.gems}`);
    // 합성까지 해야 뜻이 있다 — 안 하면 손 가는 자리만 옮긴 것
    const src = srcOf('js/game.js');
    ok(/autoGacha\(\)\s*\{[\s\S]{0,400}?mergeAll\(\)/.test(src), '자동 뽑기는 합성까지 한다');
  }
  {
    const g = strong(300);
    g.s.gems = 1e9;
    g.s.autoGacha = false;
    const before = g.s.stats.gachas;
    for (let i = 0; i < 30 * (D.AUTO_GACHA_SEC + 2); i++) g.tick(1 / 30);
    ok(g.s.stats.gachas === before, '꺼 두면 한 번도 안 뽑는다');
  }

  // 값 셈이 두 군데로 갈라지지 않았는가 — 갈라지면 반드시 어긋난다
  {
    const files = ['js/game.js', 'js/ui/equip.js'];
    const bad = files.filter((f) => /GACHA_COST \* count|=== 10 \? GACHA10_COST/.test(srcOf(f)));
    ok(bad.length === 0, '값은 data.js의 gachaCost 하나만 본다', bad.join(', ') || '깨끗');
  }

  // 화면에도 달려 있는가
  {
    const ui = srcOf('js/ui/equip.js');
    ok(/doGacha\(100\)/.test(ui), '100회 단추가 있다');
    ok(/autoGacha = !game\.s\.autoGacha/.test(ui), '자동 켜고 끄는 단추가 있다');
    ok(/res\.length > 20/.test(ui), '많이 뽑으면 등급별로 세어 보여 준다');
    ok(/app\.save\(\)/.test(ui) && /save: \(\) => save\(\)/.test(srcOf('js/main.js')),
      '켠 설정이 바로 저장된다');
  }
}

// ---------- 38. 방치 수입은 재서 쓴다 ----------
//
// "열두 시간 비웠는데 은자 0"이 나왔다. 재 보니 0보다 나빴다 — **마이너스**였다.
//
// 원인은 어림이었다. 옛 셈은 '적 체력 ÷ 내 한 대'로 잡는 시간을 어림했는데,
// 거기에는 광역기도 무공도 영수도 안 들어 있다. 실제의 **20억분의 1**이었다.
// 식을 고치는 대신 pace 때와 같은 수법을 쓴다 — 켜 놓고 노는 동안 실제로
// 들어온 걸 재 둔다. 새 기능이 붙어도 저절로 맞는다.
console.log('');
console.log('=== 38. 방치 수입 ===');
{
  // **strong()은 제 관문을 못 깬다.** 지어낸 세이브는 진짜 세이브보다 10^5배쯤
  // 약해서, 관문 300에 세워 두면 한 마리도 못 잡고 수입이 0이 된다. 그러면
  // '수입이 0이다'가 코드 탓인지 세이브 탓인지 가릴 수 없다.
  // 적 체력에 맞는 수련 레벨을 거꾸로 풀어 쥐여 준다.
  const fit = (stage) => {
    const g = strong(stage);
    const need = Math.ceil((D.monsterHp(stage).log10() - 1) / Math.log10(D.UP_VALUE_RATE));
    g.s.upgrades.atk = need;
    g.s.upgrades.hp = need;
    return g;
  };
  const play = (g, secs) => {
    g.spawn();
    for (let i = 0; i < 30 * secs; i++) { g.tick(1 / 30); g.events.length = 0; }
  };

  // 아직 재 본 적이 없으면 식으로 간다 — 막 시작한 사람도 0이면 안 된다
  {
    const g = fit(300);
    ok(!g.s.earn.gold.isPos(), '새 판에는 잰 값이 없다');
    ok(pos(g.idleRates().gold), '잰 적이 없어도 수입이 0은 아니다', fmt(g.idleRates().gold));
  }

  // 놀고 나면 잰 값이 들어차고, 그 값이 쓰인다
  {
    const g = fit(300);
    play(g, 40);
    ok(pos(g.s.earn.gold), '놀고 나면 번 속도가 적힌다', `초당 ${fmt(g.s.earn.gold)}`);
    ok(big(g.idleRates().gold).eq(g.s.earn.gold), '방치 수입이 그 값을 쓴다');
  }

  // **잰 값이 실제와 맞는가.** 이게 이 절의 전부다.
  {
    const g = fit(300);
    play(g, 60);
    const before = g.s.gold;
    for (let i = 0; i < 30 * 30; i++) { g.tick(1 / 30); g.events.length = 0; }
    const real = g.s.gold.sub(before).div(30);
    const shown = g.idleRates().gold;
    const r = shown.div(real.max(1)).toNumber();
    ok(r > 0.2 && r < 5, '방치 수입이 실제로 버는 속도와 맞는다',
      `실제 ${fmt(real)} / 셈 ${fmt(shown)} = ${r.toFixed(2)}배`);
  }

  // **비우고 오면 세져 있다.**
  // 은자 자체는 줄 수 있다 — 자동 수련이 번 것을 바로 붓기 때문이다.
  // 그건 손해가 아니라 투자다. 봐야 할 건 힘이 늘었는가다.
  {
    const g = fit(300);
    play(g, 60);
    const p0 = g.power().power;
    g.s.lastSeen = Date.now() - 2 * 3600 * 1000;
    const rw = g.offlineReward(Date.now(), true);
    ok(pos(rw.gold), '보여 주는 보상이 0이 아니다', fmt(rw.gold));
    g.claimOffline(rw);
    ok(gt(g.power().power, p0), '두 시간 비우고 오면 세져 있다',
      `${fmt(p0)} → ${fmt(g.power().power)}`);
  }

  // **비워 두는 쪽이 더 벌면 안 된다** — 그러면 켤 이유가 없다
  {
    const a = fit(300);
    play(a, 60);
    const rate = a.idleRates().gold;
    const b = fit(300);
    play(b, 60);
    const g0 = b.s.gold;
    for (let i = 0; i < 30 * 60; i++) { b.tick(1 / 30); b.events.length = 0; }
    const real = b.s.gold.sub(g0).div(60);
    ok(!rate.gt(real.mul(5).max(1)), '비워 두는 쪽이 노는 쪽보다 많이 벌지 않는다',
      `방치 ${fmt(rate)} vs 놀기 ${fmt(real)}`);
  }

  // 방치로 받은 걸 다시 '번 것'으로 세면 안 된다 — 가만 있어도 수입이 불어난다
  {
    const g = fit(300);
    play(g, 40);
    const rate0 = g.s.earn.gold;
    g.s.lastSeen = Date.now() - 6 * 3600 * 1000;
    g.claimOffline(g.offlineReward(Date.now(), true));
    ok(big(g.s.earn.gold).eq(rate0), '방치 보상은 번 속도에 안 섞인다',
      `${fmt(rate0)} → ${fmt(g.s.earn.gold)}`);
  }

  // 따라잡기가 내놓는 합계가 글자가 아니다 (0에 += 하면 글자가 붙는다)
  {
    const g = fit(300);
    play(g, 40);
    const c = g.offlineClimb(3600, false);
    const broken = ['gold', 'exp', 'books', 'stones', 'food', 'merit'].filter((k) => !fin(c[k]));
    ok(broken.length === 0, '따라잡기 합계가 전부 수다', broken.join(',') || `${fmt(c.gold)} 은자`);
  }
}

// ---------- 39. 방치와 오프가 같은 기준인가 ----------
//
// 기준이 셋으로 갈라져 있었다:
//   방치는 관문 식으로, 오프는 잰 값으로 셌다
//   비급·한철·먹이·공적은 방치만 주고 오프는 하나도 안 줬다
//   자동 수련은 방치만 썼다
// 그래서 재 보니 **앱을 끄는 쪽이 2만 배 더 세졌다.** 켜 둘 이유가 없어진다.
//
// 그 밑에 더 나쁜 게 둘 있었다:
//   수련을 꺼 두면 따라잡기가 **한 푼도 안 줬다** — 화면에는 9628f를 보여 주고.
//   방치 배수를 보여 줄 때만 곱하고 넣을 때는 안 곱했다 — 보여 준 값이 만 배.
// 둘 다 '보여 준 숫자 ≠ 받은 숫자'다. 그게 이 절이 지키는 것이다.
console.log('');
console.log('=== 39. 방치와 오프 ===');
{
  const fit = (stage) => {
    const g = strong(stage);
    const need = Math.ceil((D.monsterHp(stage).log10() - 1) / Math.log10(D.UP_VALUE_RATE));
    g.s.upgrades.atk = need;
    g.s.upgrades.hp = need;
    g.spawn();
    for (let i = 0; i < 30 * 60; i++) { g.tick(1 / 30); g.events.length = 0; }   // 재게 한다
    return g;
  };
  const away = (g, hours, climb) => {
    g.s.lastSeen = Date.now() - hours * 3600 * 1000;
    const shown = g.offlineReward(Date.now(), climb);
    const before = {};
    for (const k of D.EARN_KEYS) before[k] = g.s[k];
    const p0 = g.power().power;
    g.claimOffline(shown);
    const got = {};
    for (const k of D.EARN_KEYS) got[k] = g.s[k].sub(before[k]);
    return { shown, got, p0, p1: g.power().power, g };
  };

  // **보여 준 만큼 실제로 준다.** 수련을 꺼 두면 한 푼도 안 들어오던 자리다.
  for (const train of [true, false]) {
    const g = fit(300);
    g.s.autoTrain = train;
    const r = away(g, 2, true);
    // 수련을 켜 두면 받자마자 쓰므로 남은 양으로는 못 잰다. 꺼 둔 쪽만 견준다.
    if (!train) {
      const ratio = r.got.gold.div(r.shown.gold.max(1)).toNumber();
      ok(ratio > 0.95 && ratio < 1.05, '수련을 꺼 둬도 보여 준 만큼 들어온다',
        `보여 줌 ${fmt(r.shown.gold)} / 받음 ${fmt(r.got.gold)} = ${ratio.toFixed(3)}`);
      const noRes = D.EARN_KEYS.filter((k) => !pos(r.got[k]));
      ok(noRes.length === 0, '수련을 꺼 둬도 여섯 가지가 다 들어온다',
        noRes.join(',') || '전부');
    } else {
      ok(gt(r.p1, r.p0), '수련을 켜 두면 세져서 돌아온다', `${fmt(r.p0)} → ${fmt(r.p1)}`);
    }
  }

  // **앱을 껐어도 받는 것은 같다.** 다른 건 관문을 미느냐 하나뿐이다.
  {
    const g = fit(300);
    g.s.autoTrain = false;
    const r = away(g, 2, false);
    const noRes = D.EARN_KEYS.filter((k) => !pos(r.got[k]));
    ok(noRes.length === 0, '앱을 껐어도 여섯 가지가 다 들어온다', noRes.join(',') || '전부');
    ok(r.shown.stages === 0, '앱을 껐으면 관문은 안 민다');
    ok(big(D.OFFLINE_KEYS.length).eq(D.EARN_KEYS.length),
      '받는 것은 양쪽이 같다 (차이는 관문뿐)');
  }

  // **켜 두는 쪽이 손해면 안 된다.** 재 보니 끄는 쪽이 2만 배 세졌었다.
  {
    const a = away(fit(300), 2, true);
    const b = away(fit(300), 2, false);
    const gA = a.p1.div(a.p0);
    const gB = b.p1.div(b.p0);
    ok(gA.gte(gB), '켜 둔 쪽이 끈 쪽보다 세진다',
      `켜 둠 x${gA.toExponential(1)} vs 끔 x${gB.toExponential(1)}`);
    ok(a.shown.stages > 0 && b.shown.stages === 0, '관문은 켜 둔 쪽만 민다',
      `${a.shown.stages} vs ${b.shown.stages}`);
  }

  // 방치 배수는 한 군데서 한 번만 곱한다 (보여 줄 때만 곱하면 만 배가 뜬다)
  {
    const g = fit(300);
    g.s.autoTrain = false;
    const r = away(g, 2, true);
    const ratio = r.got.gold.div(r.shown.gold.max(1)).toNumber();
    ok(ratio > 0.95 && ratio < 1.05, '방치 배수가 두 번 곱해지지 않는다',
      `${ratio.toFixed(3)}배`);
  }
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
