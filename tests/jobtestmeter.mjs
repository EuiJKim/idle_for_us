// 전직 시험 여덟이 **실제로 붙을 수 있는 시험인지** 잰다.
//
// 숫자를 손으로 고르면 반드시 둘 중 하나가 된다 — 아무나 붙거나 아무도 못 붙거나.
// 계열 보너스를 재던 실수를 여기서 반복하지 않으려고, 진짜 세이브로 진짜
// 전투를 돌려서 통과 여부와 **여유**를 같이 본다.
//
//   JOBTEST_SAVE=.../save200.json node tests/jobtestmeter.mjs [관문]
import fs from 'node:fs';
import { Game, migrate } from '../js/game.js';
import { JOB_TESTS, JOB_RANK } from '../js/data.js';

const SAVE_PATH = process.env.JOBTEST_SAVE;
if (!SAVE_PATH) throw new Error('JOBTEST_SAVE=세이브경로 가 필요하다');
const STAGE = Number(process.argv[2] || 0);
const DT = 1 / 30;
const seeded = (s = 20261021) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

function make() {
  const s = migrate(JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8')));
  if (STAGE) { s.stage = STAGE; s.bestStage = STAGE; }
  s.rank = Math.max(s.rank, JOB_RANK);
  s.autoSkill = true;
  // migrate가 jobSeen을 보고 시험을 붙여 준다(옛 세이브 구제). 재려면 비워야 한다.
  s.job = null; s.taste = null; s.jobTests = {}; s.jobSeen = [];
  const g = new Game(s);
  // 관문 문턱은 비켜 간다. 재려는 건 "그 관문에 온 사람이 붙을 수 있나"인데,
  // bestStage를 480까지 올리면 적만 세지고 사람은 그대로라 불공평해진다.
  g.jobStageOpen = () => true;
  g.rng = seeded();
  g.spawn();
  return g;
}

console.log(`세이브 ${SAVE_PATH.split(/[\/]/).pop()} · 관문 ${make().s.bestStage}\n`);
console.log('계열      시험   조건                                   결과     걸린시간/여유');
let pass = 0;
for (const def of JOB_TESTS) {
  const g = make();
  if (!g.canJobTest(def.job)) { console.log(`${def.job.padEnd(8)} 시험을 열 수 없다`); continue; }
  g.startJobTest(def.job);
  let out = null;
  g.on?.('contestEnd', (o) => { out = o; });
  const hook = g.endContest.bind(g);
  g.endContest = (r) => { const o = hook(r); if (!out) out = o; return o; };
  let t = 0;
  while (g.mode === 'jobtest' && t < def.time + 5) { g.tick(DT); t += DT; }
  const win = !!out?.win;
  if (win) pass++;
  // 여유: 이긴 경우 남은 시간, 진 경우 왜 떨어졌는지
  const margin = win
    ? `${t.toFixed(1)}초 / ${def.time}초`
    : (out?.miss || '시간초과');
  console.log(`${def.job.padEnd(8)} ${def.name}   ${def.ask.padEnd(36)} ${win ? '통과' : '떨어짐'}   ${margin}`);
}
console.log(`\n${pass}/${JOB_TESTS.length} 통과`);
console.log(pass === JOB_TESTS.length ? '!! 전부 붙었다 — 시험이 너무 쉬운 것일 수 있다' : '');
