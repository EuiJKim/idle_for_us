// 캐릭터마다 있는 전직 시험이 **실제로 붙을 수 있는 시험인지** 잰다.
//
// 숫자를 손으로 고르면 반드시 둘 중 하나가 된다 — 아무나 붙거나 아무도 못 붙거나.
// 계열 보너스를 재던 실수를 여기서 반복하지 않으려고, 진짜 세이브로 진짜
// 전투를 돌려서 통과 여부와 **여유**를 같이 본다.
//
//   JOBTEST_SAVE=.../save200.json node tests/jobtestmeter.mjs [관문]
//   JOBTEST_TIER=1 을 주면 2차 시험을 잰다 (지금 차수를 그만큼으로 두고 다음 시험을 본다)
import fs from 'node:fs';
import { Game, migrate } from '../js/game.js';
import { JOB_TESTS, TIER_MAX } from '../js/data.js';

const SAVE_PATH = process.env.JOBTEST_SAVE;
if (!SAVE_PATH) throw new Error('JOBTEST_SAVE=세이브경로 가 필요하다');
const STAGE = Number(process.argv[2] || 0);
const DT = 1 / 30;
const seeded = (s = 20261021) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

const TIER = Math.max(0, Math.min(TIER_MAX - 1, Number(process.env.JOBTEST_TIER || 0)));

function make(job) {
  const s = migrate(JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8')));
  if (STAGE) { s.stage = STAGE; s.bestStage = STAGE; }
  s.autoSkill = true;
  // 세이브의 캐릭터를 비우고 재려는 캐릭터로 새로 고른다 (처음 고르는 건 공짜다)
  s.job = null; s.legacyJob = null; s.jobTier = 0;
  const g = new Game(s);
  if (job && !g.setJob(job)) throw new Error(`${job} 고르기 실패`);
  // 처음 고르면 넘은 관문만큼 차수를 받는다. 재려는 차수로 되돌린다.
  g.s.jobTier = TIER;
  // 관문 문턱은 비켜 간다. 재려는 건 "그 관문에 온 사람이 붙을 수 있나"인데,
  // bestStage를 480까지 올리면 적만 세지고 사람은 그대로라 불공평해진다.
  g.tierOpen = () => true;
  g.rng = seeded();
  g.spawn();
  return g;
}

console.log(`세이브 ${SAVE_PATH.split(/[\/]/).pop()} · 관문 ${make(null).s.bestStage} · ${TIER + 1}차 시험\n`);
console.log('계열      시험   조건                                   결과     걸린시간/여유');
let pass = 0;
for (const def of JOB_TESTS) {
  const g = make(def.job);
  if (!g.canJobTest()) { console.log(`${def.job.padEnd(8)} 시험을 열 수 없다`); continue; }
  g.startJobTest();
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
