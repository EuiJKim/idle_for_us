// **초당 얼마나 맞는가.** 한 대 값만으로는 모른다 — 들판엔 적이 50마리다.
//
//   HPAXIS_SAVE=.../now_24h.json node tests/dps_taken.mjs [관문]
import fs from 'node:fs';
import { Game, migrate } from '../js/game.js';
import * as D from '../js/data.js';

const SAVE = process.env.HPAXIS_SAVE;
if (!SAVE) throw new Error('HPAXIS_SAVE=세이브경로');
const seeded = (s = 5) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

function run(stage, tweak) {
  const s = migrate(JSON.parse(fs.readFileSync(SAVE, 'utf-8')));
  s.stage = stage; s.bestStage = Math.max(s.bestStage, stage);
  s.autoSkill = true; s.farming = true;   // 관문지기 대신 졸개만
  tweak?.(s);
  const g = new Game(s);
  g.rng = seeded();
  g.spawn();
  for (let i = 0; i < 60 * 20; i++) g.tick(1 / 60);   // 들판을 채운다
  const st = g.stats();
  // **체력을 보면 안 된다.** 재생이 초당 2%라 적 공격이 그 안에 묻힌다
  // (관문 375에서 졸개 한 대가 내 체력의 1천만분의 1이다).
  // 맞은 사건을 그대로 센다.
  let taken = 0, hits = 0;
  const hp0 = st.hp;
  const SEC = 30;
  for (let i = 0; i < 60 * SEC; i++) {
    g.tick(1 / 60);
    for (const e of g.events) if (e.type === 'heroHit') { taken += e.amount; hits++; }
    g.events.length = 0;
    g.heroHp = hp0;   // 안 죽게 되돌린다 — 받은 양은 위에서 이미 셌다
  }
  return { hp: hp0, perSec: taken / SEC, hits: hits / SEC, mons: g.mons?.filter((m) => m.alive).length || 0 };
}

console.log('관문   내 체력      초당 받는 피해   체력의 %/초   재생 2%/초 대비   초당 맞는 횟수   적');
// **관문을 손으로 적어 두면 안 된다.** 100~450으로 고정해 뒀더니, 진행이
// 빨라져 세이브가 898관문이 된 뒤로는 전 구간이 0%로 나와 아무것도 못 쟀다.
// 세이브가 서 있는 자리를 기준으로 앞뒤를 본다.
const HERE = migrate(JSON.parse(fs.readFileSync(SAVE, 'utf-8'))).bestStage || 300;
const BAND = [0.4, 0.6, 0.8, 1.0, 1.15].map((f) => Math.max(10, Math.round(HERE * f)));
console.log(`세이브 관문 ${HERE} 기준`);
for (const st of BAND) {
  const r = run(st);
  const pct = (r.perSec / r.hp) * 100;
  console.log(`${String(st).padStart(4)}  ${r.hp.toExponential(2)}   ${r.perSec.toExponential(2)}      `
    + `${(pct < 0.01 ? pct.toExponential(1) : pct.toFixed(2)).padStart(9)}%     `
    + `${(pct / 2).toExponential(1).padStart(9)}배     `
    + `${r.hits.toFixed(1).padStart(5)}회     ${r.mons}`);
}
