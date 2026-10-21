// 체력 축이 살아 있는가 — **한 대에 몇 번 맞고 죽는가**로 잰다.
//
// 적 공격력은 관문당 자라는데 플레이어 체력은 그만큼 안 자란다.
// 공격력에만 붙는 배수(치명·속도·영수·심검·무공 총연마·문파)가
// 체력에는 하나도 안 붙기 때문이다. 격차가 벌어지면 체력 수련·호신의·
// 심의·운기조식·마불의 체력 x2.5가 **통째로 죽는다.**
//
//   HPAXIS_SAVE=.../now_24h.json node tests/hpaxis.mjs
import fs from 'node:fs';
import { Game, migrate } from '../js/game.js';
import * as D from '../js/data.js';

const SAVE = process.env.HPAXIS_SAVE;
if (!SAVE) throw new Error('HPAXIS_SAVE=세이브경로');
const seeded = (s = 11) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

const base = migrate(JSON.parse(fs.readFileSync(SAVE, 'utf-8')));
const mk = (tweak) => {
  const s = JSON.parse(JSON.stringify(base));
  tweak?.(s);
  const g = new Game(s);
  g.rng = seeded();
  g.spawn();
  return g;
};

const g0 = mk();
console.log(`세이브 ${SAVE.split(/[\/]/).pop()} · 관문 ${g0.s.bestStage} · 경지 ${g0.s.rank} · Lv${g0.s.level}\n`);

console.log('관문   졸개 한 대 / 내 체력   몇 대 버팀   두목 한 대 / 내 체력   몇 대');
const hp = g0.stats().hp;
for (const st of [50, 100, 150, 200, 250, 300, 350, 400, 500, 600]) {
  const a = D.monsterAtk(st);
  const b = a * D.BOSS_ATK_MULT;
  const f = (x) => (x >= 1 ? `${x.toExponential(1)}배` : `${(x * 100).toFixed(1)}%`);
  console.log(`${String(st).padStart(4)}   ${f(a / hp).padStart(10)}   ${(hp / a).toFixed(1).padStart(8)}   `
    + `${f(b / hp).padStart(10)}   ${(hp / b).toFixed(1).padStart(5)}`);
}

// 체력에 투자하면 실제로 더 버티는가 — 제 관문에서
console.log('\n제 관문에서 체력 투자가 먹히는가');
const atk = D.monsterAtk(g0.s.bestStage);
for (const [name, tw] of [
  ['지금 그대로', null],
  ['체력 수련 +50', (s) => { s.upgrades.hp += 50; }],
  ['체력 수련 +200', (s) => { s.upgrades.hp += 200; }],
  ['호신의 천품 10개', (s) => { s.equips.armor[5] += 10; }],
  ['마불 (체력 x2.5)', (s) => { s.bestStage = 9999; s.jobTests = Object.fromEntries(D.JOBS.map((j) => [j.id, true])); s.job = 'monk'; }],
]) {
  const g = mk(tw);
  const h = g.stats().hp;
  console.log(`  ${name.padEnd(18)} 체력 ${h.toExponential(2)}  (x${(h / hp).toFixed(2)})  `
    + `졸개 ${(h / atk).toFixed(1)}대 버팀`);
}
