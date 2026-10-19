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

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
