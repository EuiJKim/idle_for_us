// **네 곡선이 같은 속도로 자라는가, 그리고 실제로 죽을 수 있는가.**
//
// 적 체력 · 적 공격 · 내 DPS · 내 체력. 넷 중 하나만 어긋나도 게임이 깨진다:
//   내 DPS가 적 체력보다 빠르면 → 적이 때리기도 전에 죽어 체력 축이 통째로 죽는다
//   적 공격이 내 체력보다 빠르면 → 어느 관문부터 손도 못 쓰고 즉사한다
// 둘 다 실제로 겪었다. 기울기뿐 아니라 **지금 몇 %를 맞는지**까지 같이 본다.
//
//   node tests/fourcurves.mjs [시간]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Game, migrate } from '../js/game.js';
import * as D from '../js/data.js';

const H = Number(process.argv[2] || 3);
const DIR = process.env.TMPDIR || '.';
const seeded = (s = 5) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

function sim(hours, out) {
  execFileSync(process.execPath, ['tests/sim.mjs', String(hours)],
    { env: { ...process.env, SIM_SAVE: out }, stdio: 'ignore' });
  return migrate(JSON.parse(fs.readFileSync(out, 'utf-8')));
}

// 자기 관문에서 30초를 싸워 본다
function fight(sv) {
  const s = { ...sv, autoSkill: true, farming: true };
  const g = new Game(s);
  g.rng = seeded();
  g.spawn();
  for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60);
  const hp0 = g.stats().hp;
  let taken = 0, hits = 0, kills = 0;
  for (let i = 0; i < 60 * 30; i++) {
    g.tick(1 / 60);
    for (const e of g.events) {
      if (e.type === 'heroHit') { taken += e.amount; hits++; }
      if (e.type === 'kill') kills++;
    }
    g.events.length = 0;
    g.heroHp = hp0;                 // 안 죽게 되돌린다 — 받은 양은 이미 셌다
  }
  return { hp: hp0, pct: (taken / 30) / hp0 * 100, hits: hits / 30, kills: kills / 30 };
}

const a = sim(H / 2, `${DIR}/_fc_a.json`);
const b = sim(H, `${DIR}/_fc_b.json`);
const ds = b.stage - a.stage;
const st = (sv) => new Game({ ...sv }).stats({ buffs: false });
const sa = st(a), sb = st(b);
const r = (x, y) => Math.exp(Math.log(y / x) / ds);
console.log(`\n관문 ${a.stage} → ${b.stage} (${H / 2}시간 → ${H}시간)`);
console.log('  내 체력 x' + r(sa.hp, sb.hp).toFixed(4)
  + '   내 DPS x' + r(sa.dps, sb.dps).toFixed(4)
  + '   적 체력 x' + r(D.monsterHp(a.stage), D.monsterHp(b.stage)).toFixed(4)
  + '   적 공격 x' + r(D.monsterAtk(a.stage), D.monsterAtk(b.stage)).toFixed(4));
for (const [nm, sv] of [[`${H / 2}시간`, a], [`${H}시간`, b]]) {
  const f = fight(sv);
  console.log(`  ${nm.padStart(5)}  관문 ${String(sv.stage).padStart(4)}`
    + `  초당 받는 피해 ${(f.pct < 0.01 ? f.pct.toExponential(1) : f.pct.toFixed(2)).padStart(8)}%`
    + `  초당 맞는 횟수 ${f.hits.toFixed(1).padStart(5)}`
    + `  초당 처치 ${f.kills.toFixed(1).padStart(5)}`);
}
console.log('\n목표: 네 비율이 서로 1% 안, 초당 받는 피해 1~10%, 초당 맞는 횟수 > 1\n');
