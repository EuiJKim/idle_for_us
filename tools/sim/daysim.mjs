// 하루(실제 24시간) 진행 시뮬 — 정책별 레벨·전투력·동료·경험치 출처
//   node daysim.mjs <cfg> [job] [hours]
//   cfg: base(방치 기본값 그대로) · gacha(+조각 뽑기·영약) · aggr(+높은 사냥터 도전) · spam(+경험치 던전 10% 무한 도전)
//        *_off: 하루를 「접속 2h → 방치 10h → 접속 2h → 방치 10h」로
const root = new URL('../..', import.meta.url).href.replace(/\/$/, '');   // 저장소 뿌리
const { WorldGame, newWorldSave } = await import(`${root}/js/world/wgame.js`);
const W = await import(`${root}/js/world/wdata.js`);
const D = await import(`${root}/js/world/wdgn.js`);
const { make } = await import(`${root}/tools/mobsim.mjs`);

const CFG = process.argv[2] || 'base';
const JOB = process.argv[3] || 'sword';
const HOURS = Number(process.argv[4]) || 24;
const SEED = Number(process.env.SEED) || 20261109;
const DT = 0.25;
const P = { gacha: /gacha|aggr|spam/.test(CFG), aggr: /aggr|spam/.test(CFG), spam: /spam/.test(CFG), off: /_off/.test(CFG) };

let T = Date.UTC(2026, 10, 9, 0, 0);
Date.now = () => T;
const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const r = seeded(SEED);

const g = new WorldGame(newWorldSave(T), T);
g.rng = seeded(SEED + 7);
g.setJob(JOB);
g.s.nickname = '시뮬';
g.s.autoMap = !P.aggr; g.s.autoStat = true;
const tally = { hunt: 0, daily: 0, tower: 0, offline: 0, other: 0 };
let offline = false;
const add0 = g.addExp.bind(g);
g.addExp = (n) => { const k = offline ? 'offline' : g.inst ? (g.inst.kind === 'daily' ? 'daily' : g.inst.kind === 'tower' ? 'tower' : 'other') : 'hunt'; tally[k] += n; add0(n); };
const PET_SCORE = { yellow: 60, tiger: 50, qilin: 45, dragon: 40 };
const petScore = (p) => p.rar * 100 + (PET_SCORE[p.kind] || 10) + p.lv;
const refCache = {};
const refPower = (L) => (refCache[L] ??= make(L).stats().power);

function spendSkills() {
  const m = g.mainSkill();
  for (let n = 0; n < 50; n++) {
    const ids = [m?.id, ...g.skills().map((k) => k.id)].filter(Boolean);
    const id = ids.find((x) => g.canSkillUp(x));
    if (!id) break;
    g.skillUp(id);
  }
}
function companions() {
  for (const kind of ['pet', 'mount']) { while (g.canGacha(kind, 10)) g.gacha(kind, 10); while (g.canGacha(kind, 1)) g.gacha(kind, 1); if (g.canGacha(kind, 1, true)) g.gacha(kind, 1, true); }
  g.autoStarAll?.();
  const all = [...g.s.pets, ...g.s.petBox].sort((a, b) => petScore(b) - petScore(a));
  const n = g.petSlots();
  g.s.pets = all.slice(0, n); g.s.petBox = all.slice(n, n + 40);
  for (const p of all.slice(n + 40)) { g.s.petBox.push(p); g.releasePet(p.uid); }
  let best = null;
  for (const m of g.s.mounts) { const d = W.mountOf(m.kind); if (d && (!best || d.stat > W.mountOf(best.kind).stat)) best = m; }
  if (best && g.s.mount !== best.uid) g.ride(best.uid);
  g._stats = null;
}
function elixirs() {
  if (g.canDanGacha(1, true)) g.danGacha(1, true);
  while (g.canDanGacha(10)) g.danGacha(10);
  while (g.canDanGacha(1)) g.danGacha(1);
  g.useNewDan();
}
let dmax = 20, lastDeaths = 0, calmT = 0;
function pickMap() {
  const d = g.s.deaths - lastDeaths; lastDeaths = g.s.deaths;
  if (d > 0) { dmax = Math.max(0, dmax - 8); calmT = 0; } else { calmT += 60; if (calmT >= 600) { dmax = Math.min(70, dmax + 5); calmT = 0; } }
  let best = null;
  for (const m of W.MAPS) {
    if (m.town || m.train || m.bossRoom || m.master || m.king || !g.canEnter(m.id)) continue;
    if (g.danger(m.id) > dmax) continue;
    if (!best || m.lv[0] > W.mapOf(best).lv[0]) best = m.id;
  }
  if (best != null && best !== g.s.huntMap) { g.s.huntMap = best; if (!g.inst && !g.map.town) g.enterMap(best, true); }
}
const rows = [];
let hour = 0, playSec = 0, lastKills = 0;
function row(tag = '') {
  const st = g.stats(); const L = g.s.level;
  const pets = g.activePets().map((p) => `${p.kind}${['R', 'U', 'L', 'M'][p.rar]}${p.lv}`).join(',');
  const mt = g.mountNow();
  const dgn = g.s.dgn.best;
  rows.push({ h: hour, tag, L, exp: `${Math.round(100 * g.s.exp / W.expToNext(L))}%`, map: g.inst ? `[${g.inst.kind}${g.inst.stage || ''}]` : `${g.map.name}(${g.map.lv?.join('-')})`,
    power: Math.round(st.power), xRef: +(st.power / refPower(L)).toFixed(2), atkPct: +(g.stats().atk / (make(L).stats().atk)).toFixed(2),
    pets, mount: mt ? mt.id : '-', pulls: `${g.s.gacha?.pet?.n || 0}/${g.s.gacha?.mount?.n || 0}`, shards: `${g.s.petShard || 0}/${g.s.mountShard || 0}`,
    daily: `${dgn.exp || 0}/${dgn.gold || 0}/${dgn.mat || 0}`, tower: g.s.tower.floor, realm: g.s.realm, gold: g.s.gold.toExponential(1), kills: g.s.kills, deaths: g.s.deaths,
    xp_h: Math.round(tally.hunt / 1e3) + 'k', xp_d: Math.round(tally.daily / 1e3) + 'k', xp_t: Math.round(tally.tower / 1e3) + 'k', xp_o: Math.round(tally.offline / 1e3) + 'k' });
}
function play(hours) {
  const steps = Math.round(hours * 3600 / DT);
  for (let i = 0; i < steps; i++) {
    T += DT * 1000; playSec += DT;
    g.tick(DT);
    g.events.length = 0;
    const sec = Math.round(playSec / DT) % Math.round(1 / DT) === 0;
    if (!sec) continue;
    const s = Math.round(playSec);
    if (s % 10 === 0 && g.map.town && !g.inst && g.heroHp >= g.stats().hp * 0.9 && g.canEnter(g.s.huntMap)) g.enterMap(g.s.huntMap);   // 마을에 서 있지 않게(사냥하러 가기)
    if (s % 5 === 0) { spendSkills(); if (g.canAdvance()) g.advance(); g.claimAllQuests(); if (g.s.potions < 20) g.buyPotions(50); }
    if (P.gacha && s % 30 === 0) { companions(); elixirs(); }
    if (P.aggr && s % 60 === 0) pickMap();
    if (P.spam && !g.inst && g.s.level >= W.DGN_LV && !g.autoDailyNext(T)) { const st = Math.max(1, g.dailyBest('exp')); if (g.canDaily('exp', st, T)) g.startDaily('exp', st, T); }
    if (s % 3600 === 0) { hour++; row(); }
  }
}
function away(hours) {
  g.s.rates = g.rates();
  g.s.lastSeen = T;
  T += hours * 3600 * 1000;
  hour += hours;
  const rw = g.offlineReward(T);
  offline = true; if (rw) g.claimOffline(rw); offline = false;
  g.s.lastSeen = T;
  row(`방치 ${hours}h(${rw ? Math.round(rw.eff * 100) + '% · 처치 ' + rw.kills : '없음'})`);
}
g.enterMap(g.s.huntMap);
const t0 = performance.now();
if (P.off) { for (let d = 0; d < Math.max(1, Math.round(HOURS / 24)); d++) { play(2); away(10); play(2); away(10); } }
else play(HOURS);
console.log(`# ${CFG} · ${JOB} · ${HOURS}h · ${((performance.now() - t0) / 1000).toFixed(0)}s`);
console.table(rows);
const tot = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
console.log('경험치 출처', Object.fromEntries(Object.entries(tally).map(([k, v]) => [k, Math.round(100 * v / tot) + '%'])));
console.log('동료', { pets: [...g.s.pets, ...g.s.petBox].map((p) => `${p.kind}${['R', 'U', 'L', 'M'][p.rar]}`).join(' '), mounts: g.s.mounts.map((m) => m.kind + (m.lv ? '+' + m.lv : '')).join(' ') });
try { const pb = g.powerBreakdown?.(); if (pb) console.log('힘의 내역(갈래마다 빼 본 몫)', JSON.stringify(pb)); } catch (e) { console.log('powerBreakdown 실패', e.message); }
console.log('장비', Object.values(g.s.equip).filter(Boolean).map((it) => `${it.slot}:ilv${it.ilv ?? it.lv ?? '?'}+${it.plus || 0}${it.set ? '·' + it.set : ''}${it.rar != null ? '·r' + it.rar : ''}`).join(' '));
console.log('영약 먹음', g.s.danEat, '내공', Math.round(g.s.qi), '기준', Math.round(W.qiFloor(g.s.level)), '최종 공격 배수 vs 기준 무인', +(g.stats().atk / make(g.s.level).stats().atk).toFixed(2));
