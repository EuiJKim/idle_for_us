// 큰 수를 Big으로 바꾸는 공사에서 **가장 무서운 건 조용한 NaN**이다.
// Big에 `*`를 쓰면 에러가 안 나고 NaN이 된다. 그러면 체력이 NaN이 되고,
// NaN은 어떤 비교에도 false라서 적이 안 죽고 화면만 멎는다.
//
// 그래서 실제로 돌려 보고 세이브·적·능력치를 전부 훑는다.
// node tests/nan.mjs
import { Game, newSave, slimSave } from '../js/game.js';
import * as D from '../js/data.js';
import { Big } from '../js/big.js';

let fail = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) fail++;
  console.log(`${cond ? '  OK  ' : '  !!  '} ${label}${extra ? '  — ' + extra : ''}`);
};

const isBig = (v) => v instanceof Big;

// 값 하나가 성한가
function badValue(v) {
  if (v === null || v === undefined) return null;      // 없는 건 여기서 안 본다
  if (isBig(v)) {
    if (!Number.isFinite(v.m) || !Number.isFinite(v.e)) return `Big(${v.m}e${v.e})`;
    return null;
  }
  if (typeof v === 'number') {
    if (Number.isNaN(v)) return 'NaN';
    if (!Number.isFinite(v)) return String(v);
    return null;
  }
  return null;
}

// 나무 전체를 훑는다
function scan(root, label, out, depth = 0, path = label) {
  if (depth > 6 || root === null || root === undefined) return;
  const bad = badValue(root);
  if (bad) { out.push(`${path} = ${bad}`); return; }
  if (isBig(root)) return;
  if (Array.isArray(root)) {
    for (let i = 0; i < Math.min(root.length, 200); i++) scan(root[i], label, out, depth + 1, `${path}[${i}]`);
    return;
  }
  if (typeof root === 'object') {
    for (const k of Object.keys(root)) {
      if (k === 'def' || k === 'events' || k === 'queue') continue;   // 설명문·그림 정보
      scan(root[k], label, out, depth + 1, `${path}.${k}`);
    }
  }
}

function strong(stage) {
  const s = newSave();
  Object.assign(s, {
    stage, bestStage: stage, maxStage: stage, level: 1200, rank: 5, nickname: '시험',
    skillSlots: ['slash', 'thunder', 'frost', 'plum'], autoSkill: true,
    gold: 1e18, gems: 1e7, stones: 1e9, books: 1e8, food: 1e7, relicShards: 1e6,
  });
  Object.assign(s.upgrades, { atk: 320, hp: 230, crit: 45, critDmg: 70, speed: 34 });
  return new Game(s);
}

console.log('=== 돌려 보고 샌 곳을 찾는다 ===');
// 관문 1만은 옛 판이 터지던 자리(8467)보다 한참 뒤다
for (const stage of [1, 50, 300, 2000, 8467, 20000]) {
  const g = strong(stage);
  const out = [];
  for (let i = 0; i < 30 * 20; i++) {
    g.tick(1 / 30);
    g.events.length = 0;
  }
  scan(g.s, '세이브', out);
  scan(g.mons, '적', out);
  scan(g.heroHp, '내 체력', out, 0, '내 체력');
  const st = g.stats();
  for (const k of Object.keys(st)) {
    if (k === 'petHits') continue;
    scan(st[k], '능력치', out, 0, `능력치.${k}`);
  }
  ok(out.length === 0, `관문 ${stage}에서 20초 돌려도 샌 값이 없다`,
    out.slice(0, 4).join(' · ') || `관문 ${g.s.stage}까지 감`);
}

console.log('');
console.log('=== 옛 판이 터지던 자리를 넘어간다 ===');
{
  // 이게 이번 공사의 전부다
  ok(Number.isFinite(D.monsterHp(8467).log10()), '관문 8467 적 체력이 수로 남는다',
    D.monsterHp(8467).toString());
  ok(Number.isFinite(D.monsterHp(100000).log10()), '관문 100000도 남는다',
    `10^${D.monsterHp(100000).log10().toFixed(0)}`);
  // 같은 수를 보통 숫자로 되돌리면 터진다 — 그게 옛 판이었다
  ok(!Number.isFinite(Math.pow(10, D.monsterHp(20000).log10())),
    '같은 수를 보통 숫자로 되돌리면 터진다');

  // **수만 안 터지고 적이 안 죽으면 아무 소용이 없다.**
  // 앞서는 적이 교체된 것만 보고 통과하던 허술한 검사였다. 관문 2만에
  // 걸맞은 힘을 쥐여 주고 관문이 실제로 밀리는지 본다.
  const g = strong(20000);
  // 적 체력에 맞는 수련 레벨을 거꾸로 푼다: 10 * 1.0408^l 이 적 체력쯤 되게
  const need = (D.monsterHp(20000).log10() - 1) / Math.log10(D.UP_VALUE_RATE);
  g.s.upgrades.atk = Math.ceil(need);
  g.s.upgrades.hp = Math.ceil(need);
  const before = g.s.stage;
  for (let i = 0; i < 30 * 120; i++) { g.tick(1 / 30); g.events.length = 0; }
  ok(g.s.stage > before, '힘이 받쳐 주면 관문 2만에서도 관문이 밀린다',
    `${before} → ${g.s.stage}`);
  ok(g.heroHp instanceof Big ? g.heroHp.isPos() : g.heroHp > 0, '살아 있다');

  // 약한 사람이 센 관문에 가면 **죽어야 한다**. 안 죽으면 균형이 깨진 것이다.
  const weak = strong(1);
  weak.s.stage = 20000;
  weak.s.upgrades.atk = 1;
  weak.spawnStage();
  let died = false;
  for (let i = 0; i < 30 * 30 && !died; i++) {
    weak.tick(1 / 30);
    died = weak.events.some((e) => e.type === 'heroDied');
    weak.events.length = 0;
  }
  ok(died, '약한 채로 관문 2만에 가면 죽는다 (무적이 안 된다)');
}

console.log('');
console.log('=== 저장했다 다시 읽어도 재화가 그대로인가 ===');
{
  // **이 공사에서 가장 무서운 사고다.** slimSave가 Big을 꾸러미로 보고
  // {m, e}로 쪼개는 바람에 되읽을 때 은자·비급·경험치가 전부 0이 됐다.
  // 사람이 알아차렸을 때는 이미 되돌릴 수 없다.
  const g = strong(300);
  const RES = ['gold', 'books', 'stones', 'food', 'relicShards', 'merit', 'exp'];
  g.s.gold = Big.pow10(900);
  g.s.books = Big.pow10(800);
  g.s.stones = Big.pow10(700);
  g.s.food = Big.pow10(600);
  g.s.relicShards = Big.pow10(400);
  g.s.merit = Big.pow10(300);
  g.s.exp = Big.pow10(200);

  const json = JSON.stringify(slimSave(g.s));
  const back = new Game(JSON.parse(json));
  const lost = RES.filter((k) => !back.s[k].eq(g.s[k]));
  ok(lost.length === 0, '줄여 저장해도 재화가 그대로', lost.join(',') || `${RES.length}가지 모두`);

  // 통째로 저장하는 길도 본다
  const back2 = new Game(JSON.parse(JSON.stringify(g.s)));
  const lost2 = RES.filter((k) => !back2.s[k].eq(g.s[k]));
  ok(lost2.length === 0, '통째로 저장해도 재화가 그대로', lost2.join(',') || '전부');

  // 글자로 들어갔는가 — {m,e}로 쪼개져 있으면 그게 사고의 모습이다
  const raw = JSON.parse(json).gold;
  ok(typeof raw === 'string', '세이브에는 글자로 들어간다', JSON.stringify(raw));

  // 이미 쪼개져 저장된 세이브도 살려 읽는다
  const rescued = new Game({ gold: { m: 1.5, e: 777 } });
  ok(Math.abs(rescued.s.gold.log10() - Big.pow10(777).mul(1.5).log10()) < 1e-9,
    '쪼개져 저장된 옛 세이브도 살려 읽는다', rescued.s.gold.toString());

  // 옛 세이브(보통 숫자)는 그대로
  const old = new Game({ stage: 500, gold: 1.5e18, books: 300, exp: 900, merit: 12 });
  ok(old.s.gold.eq(1.5e18) && old.s.books.eq(300), '옛 세이브의 보통 숫자도 그대로',
    old.s.gold.toString());
}

console.log(`\n${fail === 0 ? '전부 통과' : `문제 ${fail}건`}\n`);
process.exit(fail === 0 ? 0 : 1);
