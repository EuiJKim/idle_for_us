// 새 시즌 실제 엔진 성장 곡선 — 봇이 진짜 Game을 몬다(표 시뮬이 아니라 사냥 · 칸 두목 · 장비 · 강화 · 미션 · 방치 전부).
//   기준 플레이어: 하루 접속 ACTIVE분(기본 120) 자동 사냥 + 나머지 방치(다음 날 돌아와 방치 보상), 광고 안 봄.
//   node tools/s2sim/play.mjs [days=7] [job=sword] [seed=1]   → 시각마다 레벨 · 칸 · 전투력 · 분당 처치 · 경험치 출처, 진행 목표와 비교
//   ACTIVE=360 AD=1 이면 꽉 채움 쪽. 「N일」은 N일째 아침에 돌아와 방치 보상까지 받은 때.
const root = new URL('../../js/s2/', import.meta.url).href;
const { Game, newGame, COLLECTS } = await import(root + 'game.js');
const GR = await import(root + 'gear/gear.js');
const { PROGRESS } = await import(root + 'tables/progress.js');
const { SLOTS } = await import(root + 'tables/gear.js');
const { treeOf, skillById, varsOf } = await import(root + 'tables/kit.js');
// v632 무공 변형 — 봇은 기본으로 고르지 않는다(자동 성장도 안 고름 · 곡선 그대로). TVAR=pack(무리 쪽) / boss(두목 쪽)면 열리는 대로 그쪽을 고른다
const TVAR = { pack: '무리', boss: '두목' }[process.env.TVAR] || null;
const { MASTERY } = await import(root + 'tables/skills.js');
const { DAILY_DUNGEONS } = await import(root + 'tables/content.js');
const { KILLS_PER_MIN: KPM } = await import(root + 'tables/exp.js');
const { goldPerMob: GPM } = await import(root + 'tables/gearstat.js');
const STAR_CAP = Number(process.env.STAR_CAP || 25);
const OLD = !!process.env.OLD;
// v556 봇이 못 하는 보상(하루 상자 · 문파 출석 · 문파 토벌 · 수련 · 주간 보상)을 하루에 한 번 더해 본다 — EXTRA_TIX=9 EXTRA_GOLDMIN=65
const EXTRA_TIX = Number(process.env.EXTRA_TIX || 0), EXTRA_GOLDMIN = Number(process.env.EXTRA_GOLDMIN || 0);
// 강화석 비용 맞추기(봇만) — ENHX=1.5 면 ENH_STONE base · add를 1.5배로 해 보고 곡선을 본다
if (process.env.ENHX) { const GS = await import(root + 'tables/gearstat.js'); const x = Number(process.env.ENHX); GS.ENH_STONE.base = Math.round(GS.ENH_STONE.base * x); GS.ENH_STONE.add = Math.round(GS.ENH_STONE.add * x); }   // v529 성혼은 끝(25)까지 · 15성부터 파괴 방지

export function play({ days = 7, job = 'sword', seed = 1, active = 120, ad = false, marks = [], onMark } = {}) {
  const T0 = Date.UTC(2026, 0, 5, 1, 0, 0);   // 월요일 오전(한국 10시)
  const g = new Game(newGame(job, T0, seed), T0);
  g.emit('login');
  let now = T0, src = 'etc';
  const exp = { hunt: 0, offline: 0, etc: 0 }, stats = { bossWin: 0, bossFail: 0, kills: 0, huntMs: 0 };
  const add0 = g.addExp.bind(g);
  g.addExp = (n) => { exp[src] = (exp[src] || 0) + n; return add0(n); };
  const upkeep = () => {
    const S = g.S;
    for (let i = 0; i < 20 && g.claimGuide(); i++);
    for (const [b, B] of Object.entries(g.books)) for (const id of B.defs.keys()) g.claimMission(b, id);
    g.shardExchange();
    while ((S.wallet['ticket:gear'] || 0) >= 10) g.pullGear(10);
    while ((S.wallet['ticket:gear'] || 0) >= 1) g.pullGear(1);
    g.equipBest();   // v631 게임과 같은 잣대(실제 전투력)
    const junk = g.gearJunk(); if (junk.length) GR.dismantleMany(S.gear, junk.map((x) => x.uid), S.wallet);
    for (const sys of COLLECTS) while ((S.wallet[`ticket:${sys}`] || 0) >= 1) g.pullCollect(sys, 1);
    // 강화 · 성혼: 가장 낮은 칸부터, 돈이 되는 만큼
    for (let k = 0; k < 200; k++) { const s = SLOTS.reduce((a, b) => (S.gear.slots[b].enh < S.gear.slots[a].enh ? b : a)); if (g.enhance(s) === null) break; }
    for (let k = 0; k < 60; k++) { const s = SLOTS.filter((x) => !S.gear.slots[x].broken).reduce((a, b) => (S.gear.slots[b].star < S.gear.slots[a].star ? b : a), SLOTS[0]); if (S.gear.slots[s].star >= STAR_CAP || g.star(s, { noBreak: S.gear.slots[s].star >= 15 }) === null) break; }
    // 무공 · 마스터리 · 트리 · 경지 · 강호행 · 전직 · 던전 · 원정 · 경쟁
    for (const k of Object.keys(S.hero.skills || {})) for (let i = 0; i < 30 && g.skillUp(k); i++);
    const K = g.hero.kitState();
    for (const id of Object.keys(K.lv)) for (let i = 0; i < 30 && g.hero.kitUp(id, S.wallet); i++) g.dirtyStats = true;
    for (const m of MASTERY) g.learn(m.id);
    for (const id of K.slots) for (const nd of treeOf(skillById(id))) while (g.treeUp(id, nd.n));
    if (TVAR) for (const id of K.slots) { const v = varsOf(skillById(id)).find((x) => x.tag === TVAR); if (v) g.treeVar(id, v.v); }
    for (let i = 0; i < 10 && g.realmUp(); i++);
    if (S.journey.cleared <= S.journey.step) g.journeyFight();
    g.journeyOpen();
    g.jobDungeon();
    for (const k of Object.keys(DAILY_DUNGEONS)) for (let i = 0; i < 3; i++) g.dailyDungeon(k);
    g.towerFight();   // v531 한 번씩(실제 던전 엔진이라 오래 걸린다)
    if (!OLD) g.towerMsClaimAll();   // v616 탑 이정표 상자
    if (S.exped.run && now >= S.exped.run.endMs) g.claimExped();
    if (!S.exped.run) g.startExped(12);
    g.wbossFight(); for (let i = 0; i < 5; i++) g.pvpFight(0);
    // v542 v536~v541 보상 — 출석 · 장 두목 토벌(가장 높은 깬 장부터 하루 2번 · 실제 싸움). OLD=1 이면 예전 봇(비교용)
    if (!OLD) {
      if (g.canAttend()) g.attend();
      const chs = Object.keys(S.chb || {}).map(Number).sort((a, b) => b - a);
      for (const ch of chs) {
        if (!g.canRaid(ch)) continue;
        g.raid(ch); let n = 0; while (g.bossFight && n++ < 400) g.hunt(1000);
        for (const f of g.feed) if (f.k === 'raid-end') { stats.raid = (stats.raid || 0) + 1; stats.raidStar = (stats.raidStar || 0) + f.stars; }
        if (!g.raidLeft()) break;
      }
      for (const [b, B] of Object.entries(g.books)) for (const id of B.defs.keys()) g.claimMission(b, id);
    }
  };
  const out = [];
  let mi = 0;
  const row = (min) => ({
    min, lv: g.S.hero.lv, idx: g.stage().idx, adv: g.S.hero.adv, pw: g.power(),
    enh: Math.round(SLOTS.reduce((a, s) => a + g.S.gear.slots[s].enh, 0) / SLOTS.length),
    star: Math.round(SLOTS.reduce((a, s) => a + g.S.gear.slots[s].star, 0) / SLOTS.length),
    kpm: stats.huntMs ? (stats.kills / (stats.huntMs / 60000)) : 0, exp: { ...exp }, ...stats, deaths: g.fight?.deaths || 0,
  });
  const mark = (t) => { while (mi < marks.length && t >= marks[mi] * 60000) { const r = row(marks[mi]); out.push(r); onMark?.(r); stats.kills = 0; stats.huntMs = 0; mi++; } };
  for (let d = 0; d <= days; d++) {
    if (d > 0 && (EXTRA_TIX || EXTRA_GOLDMIN)) { const W = g.S.wallet; W['ticket:gear'] = (W['ticket:gear'] || 0) + EXTRA_TIX; W.gold += Math.round(EXTRA_GOLDMIN * KPM * GPM(g.S.hero.lv)); }
    if (d > 0) { now = T0 + d * 86400e3; src = 'offline'; const p = g.returnCheck(now); g.tick(now); if (p) g.claimOffline(ad); src = 'etc'; upkeep(); mark(now - T0); }
    if (d === days) break;
    for (let m = 0; m < active; m++) {
      for (let s = 0; s < 60; s++) {
        now += 1000; g.tick(now);
        src = 'hunt'; const boss = !!g.bossFight; const n = g.hunt(1000); src = 'etc';
        if (!boss) { stats.kills += n; stats.huntMs += 1000; }
        for (const f of g.feed.splice(0)) { if (f.k === 'stage-clear') stats.bossWin++; if (f.k === 'stage-fail') stats.bossFail++; }
      }
      g.minute();
      if (m % 5 === 0) upkeep();
      mark(now - T0);
    }
    upkeep(); g.save();
  }
  return { out, g };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const days = Number(process.argv[2] || 7), job = process.argv[3] || 'sword', seed = Number(process.argv[4] || 1);
  const active = Number(process.env.ACTIVE || 120);
  const marks = [10, 30, 60, 120, ...Array.from({ length: days }, (_, i) => (i + 1) * 1440)];
  const t = Date.now();
  const u = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(Math.round(n)));
  console.log(`직업 ${job} · 씨앗 ${seed} · 하루 접속 ${active}분 · ${days}일`);
  console.log('시각     Lv  칸 전직  전투력   강화 별  분당처치  칸두목 이김/짐   경험치 사냥/방치/그밖     목표');
  play({ days, job, seed, active, ad: !!process.env.AD, marks, onMark: (r) => {
    const tgt = PROGRESS.find((p) => Math.abs(p.day * 1440 - r.min) < 1);
    const when = r.min < 1440 ? `${r.min}분` : `${r.min / 1440}일`;
    console.log(`${when.padEnd(7)} ${String(r.lv).padStart(3)} ${String(r.idx).padStart(3)}  ${r.adv}  ${u(r.pw).padStart(7)}  +${String(r.enh).padStart(2)} ${String(r.star).padStart(2)}   ${r.kpm.toFixed(1).padStart(5)}    ${String(r.bossWin).padStart(3)}/${String(r.bossFail).padEnd(4)}   ${u(r.exp.hunt)}/${u(r.exp.offline)}/${u(r.exp.etc)}`.padEnd(98) + (tgt ? `Lv${tgt.lv[0]}~${tgt.lv[1]} · ${tgt.job}차` : ''));
  } });
  console.log(`(${((Date.now() - t) / 1000).toFixed(1)}초)`);
}
