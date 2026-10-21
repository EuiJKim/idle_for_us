// 계열을 공정하게 잰다 — 능력치만이 아니라 **전용 무공까지 돌려서**.
//
// 도달 관문으로 비교하면 두목 DPS 쪽으로 편향된다(1차에서 겪었다).
// 그래서 같은 세이브에 계열만 바꿔 끼우고 실제 전투를 돌려 넷을 센다:
// 두목에게 넣은 피해 · 졸개 처치 수 · 번 은자 · 번 경험치.
//
//   SIM_SAVE=save.json node tests/sim.mjs 4
//   JOBMETER_SAVE=save.json node tests/jobmeter.mjs [관문] [초]
import fs from 'node:fs';
import { Game, migrate } from '../js/game.js';
import { JOBS, jobSkillOf, KILLS_PER_STAGE } from '../js/data.js';

const SAVE_PATH = process.env.JOBMETER_SAVE;
if (!SAVE_PATH) throw new Error('JOBMETER_SAVE=세이브경로 가 필요하다 (sim.mjs가 SIM_SAVE로 떨군다)');

const STAGE = Number(process.argv[2] || 387);
const SEC = Number(process.argv[3] || 90);
const DT = 1 / 30;
// 버티기는 제 관문보다 조금 위에서 잰다 — 제 관문에서는 아무도 안 죽어 차이가 안 보인다
const TOUGH_UP = Number(process.env.JOBMETER_PUSH || 25);

const seeded = (s = 20261020) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

function make(job, withSkill) {
  // 진짜로 그 관문에 와 있는 세이브로 잰다.
  // 합성 캐릭터로는 안 된다 — 관문 390의 졸개 체력이 6.9e+27인데
  // 손으로 만든 캐릭터는 한 마리도 못 눕히고 죽기만 했다.
  const s = migrate(JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8')));
  s.stage = STAGE;
  s.bestStage = 9999;     // 해금용. 적의 세기는 stage가 정하므로 비교는 안 깨진다
  s.autoSkill = true;
  s.job = null; s.taste = null;
  const g = new Game(s);
  g.rng = seeded();
  // 여기서 재는 건 계열 보너스의 크기다. 전직 시험은 통과한 셈 치고 넣는다.
  for (const id of Object.keys(g.s.jobTests)) g.s.jobTests[id] = true;
  if (job) g.s.jobTests[job] = true;
  if (job && !g.setJob(job)) throw new Error(`${job} 입문 실패`);
  // 전용 무공을 뺀 채로도 잰다 — 보너스의 몫과 무공의 몫을 가르기 위해서다
  if (!withSkill) g.jobSkillId = () => null;
  // 번 것을 센다 (s.stats에는 경험치 항목이 없다)
  g.earned = { gold: 0, exp: 0 };
  const ag = g.addGold.bind(g);
  g.addGold = (v) => { if (Number.isFinite(v)) g.earned.gold += v; return ag(v); };
  const ae = g.addExp.bind(g);
  g.addExp = (v) => { if (Number.isFinite(v)) g.earned.exp += v; return ae(v); };
  return g;
}

// 두목에게 넣은 피해. 두목이 안 죽게 붙잡아 두고 센다.
function bossDps(g) {
  g.s.kills = KILLS_PER_STAGE;
  g.s.farming = false;
  g.spawn();
  if (!g.mon?.isBoss) throw new Error('두목이 안 나왔다');
  let sum = 0;
  for (let i = 0; i < SEC / DT; i++) {
    if (g.mon) { g.mon.hp = 1e60; g.mon.maxHp = 1e60; }
    g.bossTimer = 1e9;
    g.heroHp = g.stats().hp;          // 죽어서 흐름이 끊기지 않게
    g.tick(DT);
    for (const e of g.events) if (e.type === 'dmg' && Number.isFinite(e.amount)) sum += e.amount;
    g.events.length = 0;
  }
  return sum / SEC;
}

// 졸개를 몇이나 눕히는가 + 그동안 번 은자·경험치.
// 관문은 안 올린다 — 적 세기가 바뀌면 계열끼리 비교가 깨진다.
function fieldRun(g) {
  g.s.farming = true;               // 두목이 안 나온다
  g.spawn();
  let kills = 0;
  for (let i = 0; i < SEC / DT; i++) {
    g.s.stage = STAGE;
    g.heroHp = g.stats().hp;
    g.tick(DT);
    for (const e of g.events) if (e.type === 'kill' && !e.isBoss) kills++;
    g.events.length = 0;
  }
  return { kills, gold: g.earned.gold, exp: g.earned.exp };
}

// 얼마나 버티는가. 체력을 안 채워 주고 쓰러진 횟수를 센다.
// 1차에서 "마불의 체력은 시뮬이 못 잰다"고 적어 뒀던 축이다. 이제 잰다.
// 쓰러질 때까지 몇 초나 버티는가. 쓰러진 횟수로 재면 금세 바닥을 쳐서
// (관문 387 들판에서는 90초에 214번 쓰러진다) 차이가 안 보인다.
function toughRun(g) {
  g.s.farming = true;
  g.spawn();
  const push = STAGE + TOUGH_UP;
  for (let i = 0; i < SEC / DT; i++) {
    g.s.stage = push;
    g.tick(DT);
    for (const e of g.events) if (e.type === 'heroDied') { g.events.length = 0; return i * DT; }
    g.events.length = 0;
  }
  return SEC;
}

function measure(job, withSkill) {
  const boss = bossDps(make(job, withSkill));
  const f = fieldRun(make(job, withSkill));
  const alive = toughRun(make(job, withSkill));
  return { boss, alive, ...f };
}

const base = measure(null, false);
const r = (a, b) => (b > 0 ? a / b : a > 0 ? Infinity : 1);

console.log(`\n관문 ${STAGE} · ${SEC}초 전투 · 직업없음 = 1.00`);
console.log('계열      전용무공       두목   졸개   은자  경험치  버티기   무공의 몫(두목)');
for (const j of JOBS) {
  const only = measure(j.id, false);
  const all = measure(j.id, true);
  const f = (x) => x.toFixed(2).padStart(6);
  console.log(
    `${j.name.padEnd(6)} ${(jobSkillOf(j.id)?.name || '').padEnd(9)}`
    + ` ${f(r(all.boss, base.boss))} ${f(r(all.kills, base.kills))}`
    + ` ${f(r(all.gold, base.gold))} ${f(r(all.exp, base.exp))}`
    + ` ${f(r(all.alive, base.alive))}`
    + `   x${r(all.boss, only.boss).toFixed(2)}`,
  );
}
console.log(`\n바탕: 두목 ${base.boss.toExponential(2)}/초 · 졸개 ${base.kills}마리`
  + ` · 은자 ${base.gold.toExponential(2)} · 경험치 ${base.exp.toExponential(2)}`
  + ` · 들판에서 ${base.alive.toFixed(1)}초 만에 쓰러짐`);
