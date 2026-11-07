// v436 장시간 몽키 봇 (게임 엔진만, 브라우저 없이) — 다섯 직업을 오래 돌리며 아무 단추나 누르고, 틈틈이 불변식을 본다
//   node tests/soak.mjs                 (기본: 직업마다 놀이 시간 3시간)
//   HOURS=24 SEED=7 node tests/soak.mjs (길게 · 다른 씨앗)
//   깨지면 그 순간 세이브를 tests/shots/soak-fail-<직업>.json 으로 남긴다 — tests/replay.cjs 로 그대로 열어 볼 수 있다.
import fs from 'node:fs';
import { WorldGame, newWorldSave } from '../js/world/wgame.js';
import * as W from '../js/world/wdata.js';
import { broken } from './inv.mjs';

const HOURS = Number(process.env.HOURS) || 3;
const SEED = Number(process.env.SEED) || 20261107;
const DT = 0.25;
const OUT = new URL('./shots/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// 시계를 놀이 시간에 묶는다(일일·주간 초기화 · 쿨타임이 실제처럼 돈다)
let T = Date.UTC(2026, 10, 4, 0, 0);
Date.now = () => T;
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

// 사람이 누를 만한 것들 — 막히면(한국어 안내 오류) 괜찮고, 엔진 오류(TypeError 같은)는 버그
const pick = (r, a) => a[Math.floor(r() * a.length)];
const ACTIONS = [
  ['사냥터 옮기기', (g, r) => { const id = pick(r, W.MAPS.filter((m) => !m.town && g.canEnter(m.id) && (g.danger?.(m.id) ?? 0) <= 1)).id; g.lastPick = id; g.enterMap(id); }, 6],
  ['알맞은 사냥터', (g) => { g.s.autoMap = true; }, 1],
  ['물약', (g) => g.drinkPotion(), 2],
  ['물약 사기', (g) => g.buyPotions(10), 1],
  ['능력치 자동', (g) => g.autoStats(), 2],
  ['장비 자동', (g) => g.autoGear(), 2],
  ['가방 늘리기', (g) => g.buyBagSpace(), 1],
  ['길잡이 받기', (g) => g.claimAllQuests(), 3],
  ['전직', (g) => { if (g.canAdvance()) g.advance(); }, 2],
  ['영약', (g) => g.buyElixir(), 1],
  ['비급', (g) => g.buyStatBook(), 1],
  ['자동 별', (g) => g.autoStarAll(), 1],
  ['한꺼번에 강화', (g) => g.enhAll(), 1],
  ['약한 것 팔기', (g, r) => g.sellBagBelow(pick(r, ['common', 'rare', 'unique'])), 1],
  ['장비 끼기', (g, r) => { const it = pick(r, g.s.bag); if (it) g.equipFromBag(it.uid); }, 1],
  ['강화 하나', (g, r) => { const it = pick(r, Object.values(g.s.equip).filter(Boolean)); if (it) g.enhance(it.uid); }, 1],
  ['동료 뽑기', (g, r) => g.gacha(pick(r, ['pet', 'mount']), 1), 1],
  ['무한의 탑', (g) => { if (!g.inst && g.canTower()) g.startTower(); }, 1],
  ['회랑', (g) => { if (!g.inst && g.canCorridor()) g.startCorridor(); }, 1],
  ['하드', (g) => { if (!g.inst && g.canHard()) g.startHard(); }, 1],
  ['던전 나가기', (g) => { if (g.inst) g.leaveInst(); }, 1],
  ['무공 초기화', (g) => { if (g.canResetSkills()) g.resetSkills(); }, 0.2],
  ['능력치 초기화', (g) => g.resetStats(), 0.2],
];
const WSUM = ACTIONS.reduce((a, x) => a + x[2], 0);
const pickAction = (r) => { let x = r() * WSUM; for (const a of ACTIONS) { x -= a[2]; if (x <= 0) return a; } return ACTIONS[0]; };
const isBug = (err) => err instanceof TypeError || err instanceof RangeError || err instanceof ReferenceError || err instanceof SyntaxError;

let fails = 0;
const t0wall = performance.now();
// 처음부터(Lv 1) 한 판 · 늦은 판(Lv 150 · 3차 · 돈 넉넉 — 던전·강화·뽑기를 많이 누르게) 한 판
const RUNS = W.CLASS_LIST.flatMap((c) => [[c.id, 'new'], [c.id, 'late']]);
for (const [job, prof] of RUNS) {
  const r = seeded(SEED + job.length * 977 + (prof === 'late' ? 31 : 0));
  let g = new WorldGame(newWorldSave(T), T);
  g.rng = seeded(SEED);
  g.setJob(job);
  g.s.nickname = '몽키' + job;
  g.s.autoMap = true;
  if (prof === 'late') {
    g.s.level = 150; g.s.skillPts = 200; g.s.gold = 1e12; g.s.potions = 50; g.s.statPts = (g.s.statPts || 0) + 600;
    while (g.canAdvance()) g.advance();
    g._stats = null; g.heroHp = g.stats().hp;
  }
  const watch = new Map();
  const counts = { tried: 0, refused: 0, saves: 0 };
  const steps = Math.round(HOURS * 3600 / DT);
  let failed = null;
  const recent = [];   // 깨지기 직전에 누른 것들
  for (let i = 0; i < steps && !failed; i++) {
    T += DT * 1000;
    try { g.tick(DT); } catch (err) { failed = `tick: ${err.stack || err}`; break; }
    g.events.length = 0;
    // 10초마다 불변식(한 걸음 돈 뒤 — 사람이 보는 화면) · 10분마다 저장했다 다시 열기
    if (i % Math.round(10 / DT) === 0) { const b = broken(g, watch); if (b.length) { failed = `불변식: ${b.join(' · ')}`; break; } }
    // 사람이 5초에 한 번쯤 뭔가 누른다
    if (r() < DT / 5) {
      const [name, fn] = pickAction(r);
      counts.tried++;
      recent.push(`${Math.round(g.clock)}s ${name}`); if (recent.length > 6) recent.shift();
      try { fn(g, r); } catch (err) { if (isBug(err)) failed = `${name}: ${err.stack || err}`; else counts.refused++; }
    }
    if (i % Math.round(600 / DT) === 0 && i) {
      try {
        const json = JSON.stringify(g.toJSON());
        const h = new WorldGame(JSON.parse(json), T);
        if (h.s.level !== g.s.level || h.s.gold !== g.s.gold || h.s.bag.length !== g.s.bag.length) failed = `저장·열기 달라짐 lv ${g.s.level}/${h.s.level} gold ${g.s.gold}/${h.s.gold} bag ${g.s.bag.length}/${h.s.bag.length}`;
        else { h.rng = g.rng; g = h; watch.clear(); counts.saves++; }
      } catch (err) { failed = `저장·열기: ${err.stack || err}`; }
    }
  }
  if (failed && g.lastPick != null) failed += ` (고른 사냥터 ${g.lastPick} ${W.mapOf?.(g.lastPick)?.name || ''})`;
  const line = `${(job + '·' + prof).padEnd(12)} Lv ${String(g.s.level).padStart(3)} · 은자 ${Math.round(g.s.gold).toLocaleString()} · 누름 ${counts.tried}(막힘 ${counts.refused}) · 다시 열기 ${counts.saves}`;
  if (failed) {
    fails++;
    const f = new URL(`soak-fail-${job}-${prof}.json`, OUT);
    try { fs.writeFileSync(f, JSON.stringify(g.toJSON())); } catch { /* */ }
    console.log(`  !!  ${line}\n      ${failed.split('\n').slice(0, 4).join('\n      ')}\n      직전: ${recent.join(' → ')} (지금 ${Math.round(g.clock)}s · 사냥터 ${g.s.map} ${g.map?.name || ''}${g.inst ? ' · 던전 ' + g.inst.kind : ''})\n      세이브 → ${f.pathname}`);
  } else console.log(`  OK  ${line}`);
}
console.log(`\n${fails ? `!! 몽키 봇 ${fails}개 직업에서 깨짐` : '몽키 봇 — 전부 통과'} (놀이 ${HOURS}시간 × ${RUNS.length}판 · ${((performance.now() - t0wall) / 1000).toFixed(1)}초)`);
process.exit(fails ? 1 : 0);
