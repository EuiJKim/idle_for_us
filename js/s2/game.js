// 새 시즌(S9) 게임 층 — 엔진 부품(무인 · 장비 · 뽑기 · 병기/동료/영물 · 경지 · 강호행 · 콘텐츠 · 방치 · 미션)을 한 상태로 묶는다.
// 화면(js/s2/ui)은 이 Game만 본다. 시간은 밖에서 넘겨받는 ms(now) — 엔진은 시계를 직접 읽지 않는다(결정론).
import { Rng } from './core/rng.js';
import { pack, unpack } from './core/save.js';
import { pay, gain } from './core/cost.js';
import { QuestBook } from './core/quest.js';
import { Hero, newHero } from './hero/hero.js';
import { SideFight, makeSideMap } from './battle/side.js';
import { makeMob } from './battle/ref.js';
import { mobExp, KILLS_PER_MIN, STD_ROOM } from './tables/exp.js';
import { goldPerMob } from './tables/gearstat.js';
import { LEVEL_MAX, JOB_LV } from './tables/progress.js';
import { START_PULL_TICKETS } from './tables/gear.js';
import { START_PULLS } from './tables/s5.js';
import { DAILY_DUNGEONS, DAILY_RUNS, JOB_DUNGEON } from './tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, achievements, guideCurrent } from './tables/missions.js';
import { JOB_ADV } from './tables/skills.js';
import * as GR from './gear/gear.js';
import * as GC from './gear/gacha.js';
import * as CL from './grow/collect.js';
import * as RM from './grow/realm.js';
import * as ID from './content/idle.js';
import * as OF from './content/offline.js';
import { runDungeon } from './content/dungeon.js';
import { power } from './online/power.js';
import * as WB from './online/wboss.js';
import * as PV from './online/pvp.js';
import { refPlayer } from './battle/ref.js';
import { PVP } from './tables/online.js';

export const COLLECTS = ['weapon', 'pal', 'relic'];
const DAY = 24 * 3600e3, KST = 9 * 3600e3;
export const dayKey = (ms) => Math.floor((ms + KST) / DAY);
// 주 키: 그 주 월요일의 dayKey
export const weekKey = (ms) => { const d = dayKey(ms); return d - ((d + 3) % 7); };
// 사냥터 두목: 이만큼 잡으면 하나 나온다
export const BOSS_EVERY = 300;
// 스테이지: 칸마다 잡을 수 · 칸 두목 제한 시간 · 옆보기 사냥터 몹 수
export const STAGE_KILLS = 20, STAGE_BOSS_MS = 60000;
export const SIDE_ROOM = { n: 18, coolMs: 1000 };
export const STAGE_BOSS_HP_X = 0.5;   // 칸 두목은 기준 무인으로 20초 남짓(사냥터 두목의 절반)

export function newGame(job = 'sword', nowMs = 0, seed = 1) {
  return {
    v: 1, created: nowMs, seed,
    hero: newHero(job),
    gear: GR.newGearState(), gacha: GC.newGacha(),
    wallet: { gold: 0, 'ticket:gear': START_PULL_TICKETS, ...Object.fromEntries(COLLECTS.map((s) => [`ticket:${s}`, START_PULLS[s]])), 'ticket:time': 0, 'ticket:exped': 1 },
    colls: Object.fromEntries(COLLECTS.map((s) => [s, CL.newCollect(s)])),
    realm: RM.newRealm(), journey: RM.newJourney(), cosmetics: 0,
    stamina: { daily: ID.newStamina('daily', nowMs), field: ID.newStamina('field', nowMs) },
    exped: { run: null }, sudden: { cur: null, done: 0, failed: 0 }, tower: { best: 0 },
    dungeons: { day: dayKey(nowMs), runs: {} },
    offline: OF.newOffline(),
    q: { guide: {}, daily: {}, weekly: {}, ach: {} }, qDay: dayKey(nowMs), qWeek: weekKey(nowMs),
    zone: 1, autoZone: true, killsSinceBoss: 0, kills: 0,
    rng: null,
  };
}

export class Game {
  constructor(S, nowMs = S.created) {
    this.S = S;
    this.now = nowMs;
    this.rng = new Rng(S.rng || S.seed);
    this.hero = new Hero(S.hero);
    this.hero.kitUnlock();   // v493 옛 세이브도 무공 세트를 받는다
    this.books = {
      daily: new QuestBook(DAILY_MISSIONS, S.q.daily),
      weekly: new QuestBook(WEEKLY_MISSIONS, S.q.weekly),
      ach: new QuestBook(achievements(), S.q.ach),
    };
    this.feed = [];          // 화면이 꺼내 갈 알림(레벨업 · 획득 · 길잡이 …)
    this.fight = null;
    this.dirtyStats = true;
  }
  // ── 스탯 ──
  sources() {
    const S = this.S, L = S.hero.lv;
    return [
      ...GR.gearSources(S.gear, L),
      ...COLLECTS.flatMap((s) => CL.collectSources(S.colls[s])),
      ...RM.realmSources(S.realm), ...RM.journeySources(S.journey), ...RM.cosmeticSources(S.cosmetics),
      ...ID.towerSources(S.tower.best),
    ];
  }
  fighter() { return this.hero.fighter(this.sources()); }
  power(mode = 'pve') { return power(this.fighter(), mode); }
  // ── 사건 → 미션 · 길잡이 · 업적 ──
  emit(ev, v = {}) {
    const S = this.S;
    for (const b of Object.values(this.books)) b.on(ev, v);
    const cur = guideCurrent(S.q.guide);
    if (cur) { const fin = new QuestBook([cur], S.q.guide).on(ev, { lv: S.hero.lv, job: S.hero.adv, ...v }); if (fin.length) this.feed.push({ k: 'guide', id: cur.id }); }
  }
  claimGuide() {
    const cur = guideCurrent(this.S.q.guide);
    if (!cur || !this.S.q.guide[cur.id]?.done) return null;
    this.S.q.guide[cur.id].got = true;
    // 길잡이는 은자 · 물건만(경험치는 사냥이 정한다 — 첫 30분 Lv15, 곡선 J1)
    this.S.wallet.gold += Math.round(cur.huntMin * KILLS_PER_MIN * goldPerMob(this.S.hero.lv));
    if (cur.items) gain(this.S.wallet, Object.entries(cur.items).map(([k, n]) => ({ k, n })));
    // 다음 단계가 지금 상태로 이미 끝나 있으면(레벨 등) 바로 끝남 표시
    this.emit('level', { lv: this.S.hero.lv });
    return cur;
  }
  claimMission(book, id) {
    const B = this.books[book], d = B.defs.get(id);
    if (!d || !B.st[id]?.done || B.st[id]?.got) return false;
    B.claim(id);
    this.giveHuntMin(d.huntMin);
    if (d.items) gain(this.S.wallet, Object.entries(d.items).map(([k, n]) => ({ k, n })));
    return true;
  }
  // 「사냥 n분 상당」 보상 → 그 레벨 사냥 벌이(경험치 + 은자)
  giveHuntMin(min) {
    const L = this.S.hero.lv, kills = min * KILLS_PER_MIN;
    this.addExp(Math.round(kills * mobExp(L)));
    this.S.wallet.gold += Math.round(kills * goldPerMob(L));
  }
  addExp(n) {
    const before = this.S.hero.lv;
    const st = this.fighter().st;
    this.hero.addExp(Math.round(n * (1000 + (st.expP || 0)) / 1000));
    if (this.S.hero.autoPts) this.hero.autoSpend();
    if (this.S.hero.lv > before) {
      this.feed.push({ k: 'level', lv: this.S.hero.lv });
      this.emit('level', { lv: this.S.hero.lv });
      this.dirtyStats = true;
    }
  }
  // ── 사냥(옆보기 · 스테이지) ──
  // 지역(장) 15 × 스테이지 10 = 150칸. 칸 번호 = 몹 레벨. 칸마다 STAGE_KILLS마리 잡으면 「도전」 → 칸 두목을 시간 안에 잡으면 다음 칸
  stage() { return (this.S.stage ??= { idx: 1, kills: 0, top: 1, auto: true, failIdx: 0 }); }
  zoneLv() { return Math.max(1, Math.min(LEVEL_MAX, this.stage().idx)); }
  room() {
    const L = this.zoneLv();
    return { lv: L, map: makeSideMap(1000 + L), fams: {
      a: { mobs: [{ lv: L, kind: 'mob', w: 1 }], keep: SIDE_ROOM.n, coolMs: SIDE_ROOM.coolMs },
      e: { mobs: [{ lv: L, kind: 'elite', w: 1 }], keep: 0, coolMs: 500 },
      b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 0, coolMs: 500 },
    } };
  }
  ensureFight() {
    if (this.bossFight) return this.bossFight;
    const L = this.zoneLv();
    if (!this.fight || this.fight.def.lv !== L) {
      this.fight = new SideFight(this.room(), this.fighter(), this.rng.u32(), { auto: this.S.auto !== false });
      this.dirtyStats = false;
    } else if (this.dirtyStats) {
      const st = this.fighter().st, H = this.fight.hero;
      H.hp = Math.min(st.hp, Math.round(H.hp * st.hp / Math.max(1, (H.st0 || H.st).hp))); H.st0 = st; H.st = st; H.lv = this.S.hero.lv;
      const kit = this.hero.battleKit(); if (!H.kit || kit.length !== H.kit.length || kit.some((k, i) => k.id !== H.kit[i].id)) H.cds = undefined; H.kit = kit;
      this.fight.restat?.();
      this.dirtyStats = false;
    }
    return this.fight;
  }
  canChallenge() { const T = this.stage(); return !this.bossFight && T.kills >= STAGE_KILLS && T.idx < LEVEL_MAX; }
  // 칸 두목 도전 — 두목 하나 · 제한 시간 · 이기면 다음 칸
  challenge() {
    if (!this.canChallenge()) return false;
    const L = this.zoneLv();
    const def = { lv: L, boss: true, map: makeSideMap(5000 + L, { w: 14000, tiers: 1 }), fams: { b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 0, coolMs: 1e12 } } };
    const F = new SideFight(def, this.fighter(), this.rng.u32(), { auto: this.S.auto !== false });
    F.spawn('b', { p: 0, x: 9000 });
    for (const m of F.mobs) { m.hp = Math.round(m.hp * STAGE_BOSS_HP_X); m.st = { ...m.st, hp: m.hp }; }
    F.limitMs = STAGE_BOSS_MS;
    this.bossFight = F;
    this.feed.push({ k: 'challenge', idx: L });
    return true;
  }
  endChallenge(win) {
    const T = this.stage(), L = T.idx;
    this.bossFight = null;
    if (win) { T.idx = Math.min(LEVEL_MAX, L + 1); T.top = Math.max(T.top, T.idx); T.kills = 0; T.failIdx = 0; this.emit('dungeon', { stage: L }); }
    else T.kills = 0;   // 지면 그 칸 몹을 다시 채운 뒤 재도전(자동이면 저절로)
    this.feed.push({ k: win ? 'stage-clear' : 'stage-fail', idx: L, rewardMin: win ? 2 : 0 });
    // 칸 보상: 은자 · 뽑기권(경험치는 사냥이 정한다 — 곡선 J1)
    if (win) { this.S.wallet.gold += Math.round(2 * KILLS_PER_MIN * goldPerMob(L)); this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + (L % 10 === 0 ? 10 : 1); }
  }
  // 손 조작 — 방향(누르는 동안) · 점프 · 내려가기 · 무공 · 자동 켜고 끄기(세이브에 남음)
  hold(dir) { this.ensureFight().press({ dir }); }
  jump() { this.ensureFight().press({ jump: 1 }); }
  down() { this.ensureFight().press({ down: 1 }); }
  setAuto(on) { this.S.auto = !!on; this.ensureFight().press({ auto: !!on }); if (this.fight && this.bossFight) this.fight.press({ auto: !!on }); }
  // ms만큼 사냥(50ms 틱) — 처치마다 경험치 · 은자 · 사건
  hunt(ms) {
    const S = this.S, T = this.stage();
    if (!this.bossFight && T.auto && this.canChallenge()) this.challenge();
    const F = this.ensureFight();
    if (!F.def.boss) {
      const fs = F.famState;
      fs.e.keep = S.gacha.eliteQ > 0 ? 1 : 0;
      fs.b.keep = S.killsSinceBoss >= BOSS_EVERY ? 1 : 0;
    }
    const end = F.t + ms;
    while (F.t < end) {
      F.step();
      if (F.def.boss && (F.killsBy.boss || F.t >= F.limitMs)) break;
    }
    let n = 0;
    for (const e of F.events) {
      if (e[0] !== 'kill') continue;
      const kind = e[3], L = F.def.lv;
      n++; S.kills++;
      this.addExp(mobExp(L, kind));
      const gp = this.fighter().st.goldP || 0;
      S.wallet.gold += Math.round(goldPerMob(L) * (kind === 'boss' ? 20 : kind === 'elite' ? 5 : 1) * (1000 + gp) / 1000);
      if (kind === 'elite') { S.gacha.eliteQ = Math.max(0, S.gacha.eliteQ - 1); this.obtain(GC.eliteDrop(S.gacha, this.rng)); this.emit('kill', { n: 1, elite: 1 }); }
      else if (kind === 'boss') { if (!F.def.boss) S.killsSinceBoss = 0; this.emit('kill', { n: 1, boss: 1 }); if (!F.def.boss) this.feed.push({ k: 'boss' }); }
      else { S.killsSinceBoss++; T.kills = Math.min(STAGE_KILLS, T.kills + 1); this.emit('kill', { n: 1 }); }
      const r = ID.suddenProgress(S.sudden, 1, this.now);
      if (r) { this.giveHuntMin(r.huntMin); this.feed.push({ k: 'sudden-done' }); }
    }
    this.lastEvents = F.events;
    this.lastFight = F;
    F.events = [];
    if (F.def.boss && (F.killsBy.boss || F.t >= F.limitMs)) this.endChallenge(!!F.killsBy.boss);
    return n;
  }
  // ── 시간이 흐름(타이머 · 날 바뀜) ──
  tick(nowMs) {
    const S = this.S;
    this.now = nowMs;
    if (this.hero.tickMastery(nowMs)) { this.dirtyStats = true; this.feed.push({ k: 'mastery' }); }
    const tl = this.hero.treeTick(nowMs); if (tl) { this.dirtyStats = true; this.feed.push({ k: 'tree', id: tl.id, n: tl.n }); }
    if (GC.tickGacha(S.gacha, nowMs)) this.feed.push({ k: 'gacha-lv', lv: S.gacha.lv });
    if (RM.realmTick(S.realm, nowMs)) { this.dirtyStats = true; this.emit('realm', { lv: S.realm.lv }); this.feed.push({ k: 'realm', lv: S.realm.lv }); }
    if (RM.journeyTick(S.journey, nowMs, this.rng)) { this.dirtyStats = true; this.feed.push({ k: 'journey', step: S.journey.step }); }
    const d = dayKey(nowMs), w = weekKey(nowMs);
    if (S.qDay !== d) { S.qDay = d; this.books.daily.reset(DAILY_MISSIONS.map((m) => m.id)); S.dungeons = { day: d, runs: {} }; S.wallet['ticket:exped'] = (S.wallet['ticket:exped'] || 0) + 1; this.emit('login'); }
    if (S.qWeek !== w) { S.qWeek = w; this.books.weekly.reset(WEEKLY_MISSIONS.map((m) => m.id)); }
    OF.touch(S.offline, nowMs);
  }
  // 1분마다 돌발 미션 판정(화면이 부른다)
  minute() { const s = ID.suddenTick(this.S.sudden, this.rng, this.now); if (s) this.feed.push({ k: 'sudden', need: s.need }); return s; }

  // ── 장비 ──
  obtain(items) {
    const got = GR.obtain(this.S.gear, items, this.S.hero.lv, this.S.wallet);
    if (got.some((g) => g.equipped)) { this.dirtyStats = true; this.emit('equip'); }
    return got;
  }
  pullGear(n, ticket = (this.S.wallet['ticket:gear'] || 0) >= n) {
    const items = GC.pull(this.S.gacha, n, this.rng, this.S.wallet, this.S.hero.lv, { ticket });
    if (!items) return null;
    this.emit('gacha', { n });
    if (GC.canLevelUp(this.S.gacha)) GC.startLevelUp(this.S.gacha, this.now);
    return { items, got: this.obtain(items) };
  }
  enhance(slot) { const r = GR.enhance(this.S.gear, slot, this.rng, this.S.wallet, this.S.hero.lv); if (r !== null) this.emit("enhance"); if (r) this.dirtyStats = true; return r; }
  star(slot, opts) { const r = GR.starForce(this.S.gear, slot, this.rng, this.S.wallet, this.S.hero.lv, opts); if (r) { this.dirtyStats = true; this.emit('star', { s: this.S.gear.slots[slot].star }); } return r; }
  // ── 병기 · 동료 · 영물 ──
  pullCollect(sys, n) {
    const C = this.S.colls[sys], got = CL.pullCollect(C, n, this.rng, this.S.wallet);
    if (!got) return null;
    CL.autoAwaken(C); CL.autoEquip(C); this.dirtyStats = true;
    this.emit('pull', { sys: COLLECTS.indexOf(sys) + 1, n });
    return got;
  }
  // ── 무공 강화 트리 ── 점수는 레벨 · 가장 멀리 간 칸에서
  treeUp(id, n) { const r = this.hero.treeUp(id, n, this.now, this.stage().top); if (r) { this.dirtyStats = true; this.emit('skill'); } return r; }
  treeReset() { const r = this.hero.treeReset(this.S.wallet, this.stage().top); if (r) this.dirtyStats = true; return r; }
  treePts() { return this.hero.treePts(this.stage().top); }
  // ── 경지 · 강호행 ──
  realmUp() { return RM.realmStart(this.S.realm, this.now, this.S.wallet, goldPerMob(this.S.hero.lv)); }
  journeyFight() {
    const J = this.S.journey, step = J.cleared;
    const r = runDungeon({ clear: 'boss', timeMs: 60000, mobLv: Math.max(1, Math.round(40 + step * 1.8)), kind: 'boss', n: 1 }, this.fighter(), this.rng.u32());
    if (r.cleared) J.cleared++;
    return r;
  }
  journeyOpen() { const ok = RM.journeyStart(this.S.journey, this.now, this.S.wallet, this.rng); return ok; }
  // ── 무인 ──
  learn(id) { const ok = this.hero.learn(id, this.now, this.S.wallet); if (ok) this.emit('skill'); return ok; }
  skillUp(k) { const ok = this.hero.skillUp(k, this.S.wallet); if (ok) { this.dirtyStats = true; this.emit('skill'); } return ok; }
  jobDungeon() {
    const n = this.S.hero.adv + 1;
    if (n >= JOB_LV.length || this.S.hero.lv < JOB_LV[n]) return null;
    const r = runDungeon({ clear: 'boss', timeMs: 90000, mobLv: JOB_LV[n], kind: 'boss', n: 1, hpX: JOB_DUNGEON[n].hpX }, this.fighter(), this.rng.u32());
    if (r.cleared) { this.hero.clearDungeon(JOB_ADV[n].dungeon); this.hero.advance(); this.dirtyStats = true; this.emit('dungeon', { job: n }); this.feed.push({ k: 'advance', n }); }
    return r;
  }
  // ── 콘텐츠 ──
  dailyDungeon(kind) {
    const D = DAILY_DUNGEONS[kind], S = this.S;
    if (!D || S.hero.lv < D.unlockLv || (S.dungeons.runs[kind] || 0) >= DAILY_RUNS) return null;
    if (!ID.useStamina(S.stamina.daily, this.now)) return null;
    const r = runDungeon({ clear: D.clear, need: D.need, timeMs: D.timeMs, mobLv: S.hero.lv, kind: D.clear === 'boss' ? 'boss' : 'mob' }, this.fighter(), this.rng.u32());
    S.dungeons.runs[kind] = (S.dungeons.runs[kind] || 0) + 1;
    if (r.cleared) {
      const R = D.reward;
      if (R.expMin) this.addExp(Math.round(R.expMin * KILLS_PER_MIN * mobExp(S.hero.lv)));
      if (R.goldMin) S.wallet.gold += Math.round(R.goldMin * KILLS_PER_MIN * goldPerMob(S.hero.lv));
      if (R.gearTickets) S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + R.gearTickets;
      if (R.stones) S.wallet['item:stone'] = (S.wallet['item:stone'] || 0) + R.stones;
      this.emit('dungeon', { kind: 1 });
    }
    return r;
  }
  towerFight() {
    const f = this.S.tower.best + 1;
    const r = runDungeon({ clear: 'wipe', timeMs: 60000, mobLv: this.S.hero.lv, n: 4, hpX: ID.towerX(f) }, this.fighter(), this.rng.u32());
    if (r.cleared) { this.S.tower.best = f; this.dirtyStats = true; }
    return r;
  }
  startExped(h) { return ID.startExpedition(this.S.exped, h, this.now, this.S.wallet); }
  claimExped() { const r = ID.claimExpedition(this.S.exped, this.now); if (r) this.giveHuntMin(r.huntMin); return r; }
  // ── 경쟁(미리보기: 서버 없이 같은 엔진으로) ──
  // 월드보스 한 번(90초) — 넣은 피해 → 보스 점수 · 하루 3번 · 주간 합계
  wbossFight() {
    const S = this.S, W = (S.wb ??= { day: '', used: 0, best: 0, week: 0, total: 0 });
    if (W.week !== S.qWeek) { W.week = S.qWeek; W.total = 0; W.best = 0; }
    if (!WB.useTry(W, String(dayKey(this.now)))) return null;
    const L = S.hero.lv;
    const r = runDungeon({ clear: 'timeoutWin', timeMs: 90000, mobLv: L, kind: 'boss', n: 1, hpX: 1e6, flags: ['bossMeter'] }, this.fighter(), this.rng.u32());
    const score = WB.bossScore(r.meter, L);
    W.total += score; W.best = Math.max(W.best, score);
    this.emit('wboss');
    return { dmg: r.meter, score, deaths: r.deaths };
  }
  // 대결 상대 셋(미리보기: 내 레벨 근처 기준 무인 — 서버가 붙으면 다른 무인의 방어 덱)
  pvpOpponents() {
    const S = this.S, P = (S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] });
    const L = S.hero.lv, seed = dayKey(this.now) * 7 + P.used;
    return [0.85, 1, 1.2].map((x, i) => {
      const f = refPlayer(Math.max(1, Math.min(150, Math.round(L * (0.95 + 0.05 * i)))), ['sword', 'spear', 'fist', 'bow', 'mage'][(seed + i) % 5] || 'sword');
      f.st = { ...f.st, atk: Math.round(f.st.atk * x), hp: Math.round(f.st.hp * x) };
      return { name: ['낭인', '협객', '고수'][i], f, pw: power(f, 'pvp'), score: P.score + (i - 1) * 40 };
    });
  }
  pvpFight(i) {
    const S = this.S, P = (S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] });
    const opp = this.pvpOpponents()[i];
    if (!opp || !PV.useTry(P, String(dayKey(this.now)))) return null;
    const me = this.fighter(), r = PV.duel(me, opp.f, this.rng.u32());
    const d = PV.scoreDelta(r.win, power(me, 'pvp'), opp.pw).atk;
    P.score = Math.max(0, P.score + d);
    P.log = [{ name: opp.name, win: r.win, d }, ...P.log].slice(0, 10);
    this.emit('pvp');
    return { ...r, d, score: P.score, tier: PV.tierOf(P.score).name };
  }
  // ── 방치 ──
  returnCheck(nowMs) {
    const p = OF.checkReturn(this.S.offline, nowMs, String(weekKey(nowMs)), this.S.hero.lv);
    this.now = nowMs;
    return p;
  }
  claimOffline(withAd = false) {
    const r = OF.claimOffline(this.S.offline, String(dayKey(this.now)), withAd);
    if (!r) return null;
    this.addExp(r.exp); this.S.wallet.gold += r.gold;
    this.emit('offline');
    return r;
  }
  timeTicket(which, minutes) {
    const S = this.S;
    const T = { realm: S.realm.wait, mastery: S.hero.mastery.learning, tree: S.hero.kit?.learning, gacha: S.gacha.wait, journey: S.journey.wait, exped: S.exped.run }[which];
    return OF.useTimeTicket(T, S.wallet, minutes);
  }
  // ── 저장 ──
  save() { this.S.rng = this.rng.state(); return pack(this.S, this.now); }
  static load(text, nowMs) {
    const u = unpack(text);
    if (!u.body) return null;
    const g = new Game(u.body, nowMs);
    g.signed = u.ok; g.tableOk = u.tableOk;
    return g;
  }
}
// 편의: 지갑에서 내기(화면 단추 → 비용 검사)
export { pay };
