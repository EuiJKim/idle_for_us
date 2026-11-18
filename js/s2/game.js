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
import { START_PULL_TICKETS, SLOTS } from './tables/gear.js';
import { START_PULLS } from './tables/s5.js';
import { DAILY_DUNGEONS, DAILY_RUNS, JOB_DUNGEON } from './tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, achievements, guideCurrent } from './tables/missions.js';
import { JOB_ADV } from './tables/skills.js';
import { CHBOSS, CB, cbGearGrade, CB_REPEAT, WBF, CB_RAID, raidStars, DEX_REW } from './tables/chboss.js';
const CB_MANUAL_STONES = 50;   // v546
const GUILD_CHECKIN = { tix: 2, goldMin: 15 };   // v549 문파 출석
// v550 문파 토벌 — 주마다 장 두목 하나(15명 차례로) · 90초 · 쓰러지지 않음 · 문파원 피해 합으로 단계(체력 ×1.4씩)
//   1단계 체력 = 그 주 토벌 레벨 기준 무인이 한 번 넣는 피해 × hpX · 단계마다 문파원 각자 보상 한 번(뽑기권 · 은자)
export const GRAID = { weekTries: 7, fightMs: 90000, hpX: 3, rew: { tix: 2, goldMin: 10 } };
// v552 문파 수련 — 오늘 할 일을 끝낸 개수(문파 출석 빼고 · 하루 최대 8)가 내 수련 점수 · 문파원 합이 목표(문파원 수 × perMember)를 채우면 각자 한 번 보상
export const GTRAIN = { perMember: 25, rew: { tix: 5, goldMin: 30 } };
// v553 주간 보상 — 지난주 대결 최고 등급 · 지난주 월드보스 순위(서버). 월요일부터 한 번씩
export const WEEK_REW = {
  pvp: [2, 4, 6, 9, 12, 16, 20],                       // 등급(하수 → 현경)마다 장비 뽑기권
  wb: [[1, 30], [3, 20], [10, 15], [50, 10], [100, 6], [Infinity, 3]],   // 순위 이하 → 뽑기권(친 사람은 적어도 3)
};
// v576 무림 공동 토벌 — 이번 주 모든 무인의 월드보스 점수 합이 단계를 넘으면 각자 한 번씩(장비 뽑기권)
export const WB_COMMUNITY = [{ at: 50000, tix: 3 }, { at: 250000, tix: 5 }, { at: 1000000, tix: 10 }];
export const graidHp0 = (lv) => Math.round(WB.refTryDmg(Math.max(10, lv)) * GRAID.hpX);
const TODAY_CHEST = { tix: 3, goldMin: 30, dungeonRuns: 3 };   // v545 하루 상자
import { ATTEND, ATTEND_DAYS } from './tables/attend.js';
import { TITLE_EACH, titleByName } from './tables/titles.js';
import * as GR from './gear/gear.js';
import * as GC from './gear/gacha.js';
import * as CL from './grow/collect.js';
import * as RM from './grow/realm.js';
import * as ID from './content/idle.js';
import * as OF from './content/offline.js';
import { runDungeon } from './content/dungeon.js';
import { power, stdPower } from './online/power.js';
import { TABLE_VER } from './tables/version.js';
import * as WB from './online/wboss.js';
import * as GD from './online/guild.js';
import * as PV from './online/pvp.js';
import { refPlayer } from './battle/ref.js';
import { PVP, WBOSS, POWER_SLACK, PVP_TIERS } from './tables/online.js';
import { JOBS } from './tables/char.js';

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
export const STAGE_BOSS_HP_X = 0.5;
// v531 수련동을 옆보기로 — 던전마다 몹 수 · 다시 나오는 빠르기 · 목표(tools/s2sim/play.mjs 봇이 그 레벨에 대부분 깨게)
export const DG_SIDE = {
  gold: { need: 50, keep: 22, coolMs: 400 },           // 은자굴: 90초에 50마리
  gear: { hpX: 1, adds: 4 },                            // 병장고: 두목 하나(+ 졸개) · 120초
  stone: { keep: 12, coolMs: 900, lvUp: -5, eliteW: 1, mobW: 8 },   // 단련동: 몹 몰려옴 · 가끔 정예 · 60초 쓰러지지 않기
  growth: { n: 16 },                                    // 수련장: 16마리 다 잡기 · 90초
};
export const AUTO_RETRY_PW = 50;
export const RETREAT_DEATHS = 3;   // v527 자동 사냥 중 한 칸에서 이만큼 쓰러지면 앞 칸으로 물러난다(다시 나아가기는 더 강해진 뒤)   // 자동 재도전: 진 때보다 전투력 +5%(또는 레벨업)   // 칸 두목은 기준 무인으로 20초 남짓(사냥터 두목의 절반)

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
      ...this.titleSources(),
    ];
  }
  // v537 칭호 수집 효과 — 얻은 칭호 수만큼
  titleSources() { const n = (this.S.titles || []).filter((t) => titleByName(t)).length; return n ? [{ src: 'title', stats: Object.fromEntries(Object.entries(TITLE_EACH).map(([k, v]) => [k, v * n])) }] : []; }
  setTitle(nm) { if (nm && !(this.S.titles || []).includes(nm)) return false; this.S.titleOn = nm || null; return true; }
  // 장착한 동료(등급) — 전투에서 따로 친다(v497)
  palList() { const C = this.S.colls.pal; return C.eq.filter((k) => k !== null && k !== undefined).map((k) => ({ g: CL.kindGrade('pal', k), k })); }
  fighter() { return this.hero.fighter(this.sources(), this.palList()); }
  power(mode = 'pve') { return power(this.fighter(), mode); }
  // v547 서열에 올리는 한 줄(규칙 s2_players 칸과 같다 — rank.js PROFILE_KEYS) · 이름은 1~12자
  // v549 문파 — 들어간 문파(코드) · 문파 출석 보상(하루 한 번 · 뽑기권 · 은자). 문파 문서는 서버(옛 게임과 같은 문파 — 계정에 하나)
  setGuild(id) { this.S.guildId = id ? String(id).slice(0, 8) : null; return true; }
  // v575 문파 Lv(경험치 500마다) — 출석 뽑기권 +1(2 Lv마다 · 최대 +3)
  static guildLvOf(exp) { return 1 + Math.floor(Math.max(0, exp || 0) / 500); }
  static guildBonus(glv) { return Math.min(3, Math.floor((Math.max(1, glv) - 1) / 2)); }
  guildCheckin(glv = 1) {
    const S = this.S, dk = dayKey(this.now);
    if (!S.guildId || S.gChk === dk) return null;
    S.gChk = dk;
    const gold = Math.round(GUILD_CHECKIN.goldMin * KILLS_PER_MIN * goldPerMob(S.hero.lv)), tix = GUILD_CHECKIN.tix + Game.guildBonus(glv);
    S.wallet.gold += gold; S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + tix;
    this.emit('guild');
    return { gold, tix };
  }
  // v550 문파 토벌 — 이번 주 내 도전 수 · 받은 단계 · 이번 주 두목(장 두목 15명 차례)
  graidState() { const S = this.S, wk = weekKey(this.now), R = (S.graid ??= { week: wk, used: 0, claimed: 0 }); if (R.week !== wk) Object.assign(R, { week: wk, used: 0, claimed: 0 }); return R; }
  graidBoss() { return 1 + (weekKey(this.now) % 15); }
  // v555 두목 도감 — 두목마다 깸 · 토벌 별 · 최고 기록 · 손으로 깸 / ★3 수 단계 보상
  dex() {
    const S = this.S, R = S.raid || { star: {}, best: {} };
    const list = CHBOSS.slice(1).map((D, i) => { const ch = i + 1; return { ch, name: D.name, title: D.title, pats: D.pats, seen: this.stage().top >= ch * 10, beat: !!S.chb?.[ch], star: R.star?.[ch] || 0, best: R.best?.[ch] || 0, manual: !!S.chbMan?.[ch] }; });
    const three = list.filter((x) => x.star >= 3).length, got = S.dexGot || 0;
    return { list, three, got, next: DEX_REW[got] || null, can: !!DEX_REW[got] && three >= DEX_REW[got].n };
  }
  claimDex() {
    const d = this.dex(); if (!d.can) return null;
    const r = d.next; this.S.dexGot = d.got + 1;
    this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + r.tix;
    if (r.title) (this.S.titles ??= []).includes(r.title) || this.S.titles.push(r.title);
    return r;
  }
  // v553 대결 주간 최고 — 점수가 바뀔 때마다 이번 주 최고를 적어 두고, 주가 바뀌면 지난주 것으로 넘긴다
  pvpMark() {
    const P = (this.S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] }), wk = weekKey(this.now);
    if (P.wk !== wk) { if (P.wk != null && P.wkBest != null) { P.lastWk = P.wk; P.lastBest = P.wkBest; } P.wk = wk; P.wkBest = P.score; }
    P.wkBest = Math.max(P.wkBest, P.score);
  }
  pvpWeekReward() {
    const P = this.S.pvp; this.pvpMark();
    if (!P || P.lastWk == null || P.lastGot === P.lastWk) return null;
    const ti = PVP_TIERS.filter((t) => P.lastBest >= t.min).length - 1, tix = WEEK_REW.pvp[Math.max(0, ti)];
    return { wk: P.lastWk, tier: PVP_TIERS[Math.max(0, ti)].name, best: P.lastBest, tix };
  }
  claimPvpWeek() {
    const r = this.pvpWeekReward(); if (!r) return null;
    this.S.pvp.lastGot = r.wk; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + r.tix;
    return r;
  }
  // v576 공동 토벌 보상 — 이번 주 합(서버) · 단계마다 한 번
  wbCommunityClaim(total) {
    const S = this.S, wk = weekKey(this.now), C = (S.wbCom ??= { wk, got: 0 }); if (C.wk !== wk) Object.assign(C, { wk, got: 0 });
    const reach = WB_COMMUNITY.filter((x) => total >= x.at).length; if (reach <= C.got) return null;
    const tix = WB_COMMUNITY.slice(C.got, reach).reduce((a, x) => a + x.tix, 0); C.got = reach;
    S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + tix;
    return { n: reach, tix };
  }
  wbCommunityGot() { const C = this.S.wbCom; return C && C.wk === weekKey(this.now) ? C.got : 0; }
  // 지난주 월드보스 순위(서버가 센 것) → 뽑기권 · 그 주에 한 번
  wbRankReward(rank) { return rank > 0 ? WEEK_REW.wb.find(([n]) => rank <= n)[1] : 0; }
  claimWbWeek(wk, rank) {
    const S = this.S, got = (S.wbGot ??= {});
    if (!(rank > 0) || got[wk]) return null;
    const tix = this.wbRankReward(rank); got[wk] = rank;
    for (const k of Object.keys(got)) if (Object.keys(got).length > 8 && k !== String(wk)) delete got[k];   // 오래된 것 정리
    S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + tix;
    return { wk, rank, tix };
  }
  // v552 문파 수련 — 이번 주 내 점수(날마다 끝낸 오늘 할 일 개수의 합) · 목표를 채운 주에 보상 한 번
  gtrainState() { const S = this.S, wk = weekKey(this.now), T = (S.gtrain ??= { week: wk, days: {}, got: false }); if (T.week !== wk) Object.assign(T, { week: wk, days: {}, got: false }); return T; }
  gtrainPts() {
    const T = this.gtrainState(), dk = dayKey(this.now), n = this.today().filter((x) => x.id !== 'guild' && x.open && x.done).length;
    T.days[dk] = Math.max(T.days[dk] || 0, n);
    return Object.values(T.days).reduce((a, b) => a + b, 0);
  }
  gtrainClaim(total, members) {
    const T = this.gtrainState();
    if (!this.S.guildId || T.got || total < GTRAIN.perMember * Math.max(1, members)) return null;
    T.got = true;
    const gold = Math.round(GTRAIN.rew.goldMin * KILLS_PER_MIN * goldPerMob(this.S.hero.lv)), tix = GTRAIN.rew.tix;
    this.S.wallet.gold += gold; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + tix;
    return { gold, tix };
  }
  // 문파 피해 합(서버) → 단계 · 받은 것보다 높은 단계마다 보상
  graidClaim(total, lv) {
    if (!this.S.guildId) return null;
    const R = this.graidState(), ph = GD.raidPhase(Math.max(0, total || 0), graidHp0(lv)).phase, n = ph - R.claimed;
    if (n <= 0) return null;
    R.claimed = ph;
    const gold = Math.round(n * GRAID.rew.goldMin * KILLS_PER_MIN * goldPerMob(this.S.hero.lv)), tix = n * GRAID.rew.tix;
    this.S.wallet.gold += gold; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + tix;
    return { n, phase: ph, gold, tix };
  }
  setNick(name) { const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12); if (!n) return false; this.S.nick = n; return true; }
  rankProfile() {
    const S = this.S, f = this.fighter();
    return { season: 's2', nickname: S.nick || '무인', lv: S.hero.lv, job: String(S.hero.job).slice(0, 16), power: Math.round(power(f, 'pve')), pvpPower: Math.round(power(f, 'pvp')),
      ...(S.guildId ? { guildId: S.guildId } : {}), pvpScore: Math.max(0, Math.min(99999, Math.round(S.pvp?.score ?? 1000))), wbScore: Math.max(0, Math.round(S.wb?.week === S.qWeek ? S.wb.total || 0 : 0)), tv: String(TABLE_VER).slice(0, 16), signed: true };
  }
  // ── 사건 → 미션 · 길잡이 · 업적 ──
  emit(ev, v = {}) {
    const S = this.S;
    for (const [k, b] of Object.entries(this.books)) { const fin = b.on(ev, v); if (k === 'ach') for (const id of fin) this.feed.push({ k: 'ach', id }); }   // v538 업적 달성 알림
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
    if (this.dg) return this.dg.F;   // v531 실제 던전 안
    if (this.bossFight) return this.bossFight;
    const L = this.zoneLv();
    if (!this.fight || this.fight.def.lv !== L) {
      this.fight = new SideFight(this.room(), this.fighter(), this.rng.u32(), { auto: this.S.auto !== false, autoDodge: this.S.dodge !== false });
      this.dirtyStats = false;
    } else if (this.dirtyStats) {
      const st = this.fighter().st, H = this.fight.hero;
      H.hp = Math.min(st.hp, Math.round(H.hp * st.hp / Math.max(1, (H.st0 || H.st).hp))); H.st0 = st; H.st = st; H.lv = this.S.hero.lv;
      H.pals = this.palList(); H.palCd = undefined;
      const kit = this.hero.battleKit(); if (!H.kit || kit.length !== H.kit.length || kit.some((k, i) => k.id !== H.kit[i].id)) H.cds = undefined; H.kit = kit;
      this.fight.restat?.();
      this.dirtyStats = false;
    }
    return this.fight;
  }
  canChallenge() { const T = this.stage(); return !this.bossFight && !this.dg && T.kills >= STAGE_KILLS && T.idx < LEVEL_MAX; }
  // v526 칸 두목에 지면 자동 재도전은 더 강해진 뒤(레벨업 · 전투력 +AUTO_RETRY_PW‰) — 같은 두목에 계속 지며 접속 시간을 버리지 않게.
  //   그 사이는 그 칸 사냥(반복 사냥). 손으로 누르는 「도전」은 언제든.
  autoReady() {
    const T = this.stage();
    if (T.failIdx !== T.idx) return true;
    return this.S.hero.lv > (T.failLv || 0) || this.power() * 1000 >= (T.failPw || 0) * (1000 + AUTO_RETRY_PW);
  }
  // 칸 두목 도전 — 두목 하나 · 제한 시간 · 이기면 다음 칸
  isChapterBoss(idx = this.stage().idx) { return idx % 10 === 0; }
  challenge() {
    if (!this.canChallenge()) return false;
    const L = this.zoneLv(), chb = this.isChapterBoss(L), ch = Math.ceil(L / 10);
    this.bossFight = this.makeBoss(L, chb, ch);
    this.feed.push({ k: 'challenge', idx: L, chb: chb ? ch : 0 });
    return true;
  }
  // v541 장 두목 토벌 — 깬 장 두목을 지금 칸 강함으로(그 장보다 낮아지진 않음) 다시 · 하루 CB_RAID.perDay번(모든 두목이 함께 씀)
  raidState() {
    const S = this.S, dk = dayKey(this.now), R = (S.raid ??= { day: dk, n: 0, star: {}, best: {} });
    if (R.day !== dk) { R.day = dk; R.n = 0; }
    return R;
  }
  raidLeft() { return Math.max(0, CB_RAID.perDay - this.raidState().n); }
  raidLv(ch) { return Math.min(LEVEL_MAX, Math.max(ch * 10, this.zoneLv())); }
  canRaid(ch) { return !!this.S.chb?.[ch] && this.raidLeft() > 0 && !this.bossFight && !this.dg; }
  raid(ch) {
    if (!this.canRaid(ch)) return false;
    this.raidState().n++;
    const L = this.raidLv(ch);
    this.bossFight = this.makeBoss(L, true, ch, { raid: 1 });
    this.feed.push({ k: 'challenge', idx: L, chb: ch, raid: 1 });
    return true;
  }
  // v583 두목 연습 — 깬 장 두목을 횟수 · 보상 없이(손으로 피하기 연습). 그 장 레벨로
  practice(ch) {
    if (!this.S.chb?.[ch] || this.bossFight || this.dg) return false;
    const L = ch * 10;
    this.bossFight = this.makeBoss(L, true, ch, { raid: 1, practice: 1 });
    this.feed.push({ k: 'challenge', idx: L, chb: ch, raid: 1, practice: 1 });
    return true;
  }
  makeBoss(L, chb, ch, extra = {}) {
    // v532 장 두목(10칸마다): 전용 무대(좁고 한 층) · 체력 ×1.5(막대 세 줄) · 150초 · 국면 · 무력화 · 졸개
    const def = chb
      ? { lv: L, boss: true, chb: ch, map: makeSideMap(9000 + ch, CB.arena), fams: { b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 0, coolMs: 1e12 }, a: { mobs: [{ lv: L, kind: 'mob', w: 1 }], keep: 0, coolMs: 1e12 } } }
      : { lv: L, boss: true, map: makeSideMap(5000 + L, { w: 14000, tiers: 1 }), fams: { b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 0, coolMs: 1e12 } } };
    Object.assign(def, extra);
    const F = new SideFight(def, this.fighter(), this.rng.u32(), { auto: this.S.auto !== false, autoDodge: this.S.dodge !== false });
    F.spawn('b', { p: 0, x: chb ? Math.round(CB.arena.w * 0.72) : 9000 });
    for (const m of F.mobs) {
      m.hp = Math.round(m.hp * (chb ? CB.hpX : STAGE_BOSS_HP_X)); m.st = { ...m.st, hp: m.hp };
      if (chb) { const D = CHBOSS[ch]; m.cb = { ch, pats: D.pats, phase: 0, gg: 0 }; m.name = D.name; }
    }
    F.limitMs = chb ? CB.limitMs : STAGE_BOSS_MS;
    return F;
  }
  endRaid(win) {
    if (this.bossFight?.def.practice) {   // v583 연습 — 결과만(보상 · 기록 없음)
      const BF = this.bossFight; this.bossFight = null;
      const bm = BF.mobs.find((m) => m.kind === 'boss');
      this.feed.push({ k: 'raid-end', practice: 1, win, ch: BF.def.chb, lv: BF.def.lv, name: CHBOSS[BF.def.chb].name, ms: BF.t, deaths: BF.deaths, bossLeft: !win && bm ? Math.ceil((bm.hp / bm.st.hp) * 100) : 0, stars: raidStars(win, BF.t, BF.deaths), newStars: 0, best: 0, rew: {}, left: this.raidLeft(), perfects: BF.perfects || 0 });
      return;
    }
    const BF = this.bossFight, ch = BF.def.chb, ms = BF.t, deaths = BF.deaths, R = this.raidState(), W = this.S.wallet;
    this.bossFight = null;
    const bm = BF.mobs.find((m) => m.kind === 'boss'), bossLeft = !win && bm ? Math.ceil((bm.hp / bm.st.hp) * 100) : 0;
    const stars = raidStars(win, ms, deaths), had = R.star[ch] || 0, rew = {};
    const add = (o) => { for (const [k, n] of Object.entries(o)) { W[k] = (W[k] || 0) + n; rew[k] = (rew[k] || 0) + n; } };
    if (win) {
      add({ 'ticket:gear': CB_RAID.tix, 'item:stone': CB_RAID.stones });
      for (let s = had; s < stars; s++) add(CB_RAID.starRew[s]);
      R.star[ch] = Math.max(had, stars);
      if (!R.best[ch] || ms < R.best[ch]) R.best[ch] = ms;
      this.emit('raid');
    }
    this.feed.push({ k: 'raid-end', win, ch, lv: BF.def.lv, name: CHBOSS[ch].name, ms, deaths, bossLeft, stars, newStars: Math.max(0, stars - had), best: R.best[ch] || 0, rew, left: this.raidLeft() });
  }
  endChallenge(win) {
    if (this.bossFight?.def.raid) return this.endRaid(win);
    const T = this.stage(), L = T.idx, BF = this.bossFight, ms = BF ? BF.t : 0, deaths = BF ? BF.deaths : 0, bm = BF?.mobs.find((m) => m.kind === 'boss'), bossLeft = !win && bm ? Math.ceil((bm.hp / bm.st.hp) * 100) : 0;
    this.bossFight = null;
    if (win) { T.idx = Math.min(LEVEL_MAX, L + 1); T.top = Math.max(T.top, T.idx); T.kills = 0; T.failIdx = 0; this.emit('dungeon', { stage: L }); }
    else { T.kills = 0; T.failIdx = L; T.failLv = this.S.hero.lv; T.failPw = this.power(); }   // 지면 그 칸 몹을 다시 채운 뒤 재도전(자동이면 더 강해진 뒤)
    // 칸 보상: 은자 · 뽑기권(경험치는 사냥이 정한다 — 곡선 J1). 결과 창이 실제 숫자 · 걸린 시간 · 진 까닭을 보여 준다(v513)
    const gold = win ? Math.round(2 * KILLS_PER_MIN * goldPerMob(L)) : 0, tix = win ? (L % 10 === 0 ? 10 : 1) : 0;
    if (win) { this.S.wallet.gold += gold; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + tix; }
    // v532 장 두목 — 첫 처치: 그 장 확정 장비 + 칭호 · 다시: 강화석 · 뽑기권
    let chb = null;
    if (BF?.def.chb) {
      const ch = BF.def.chb, rec = (this.S.chb ??= {}), first = win && !rec[ch];
      chb = { ch, name: CHBOSS[ch].name, title: CHBOSS[ch].title, first, gear: null, stones: 0, tix2: 0 };
      if (win) {
        rec[ch] = (rec[ch] || 0) + 1;
        // v546 「두목 패턴 자동 피하기」를 끄고 처음 깨면(장마다 한 번) 강화석 더
        if (BF.autoDodge === false && !(this.S.chbMan ??= {})[ch]) { this.S.chbMan[ch] = 1; chb.manual = CB_MANUAL_STONES; this.S.wallet['item:stone'] = (this.S.wallet['item:stone'] || 0) + CB_MANUAL_STONES; }
        if (first) { this.emit('chboss'); const it = GR.makeGear(this.rng, SLOTS[this.rng.int(SLOTS.length)], cbGearGrade(ch)); chb.gear = { g: it.g, slot: it.slot, up: it.up }; this.obtain([it]); (this.S.titles ??= []).push(`${CHBOSS[ch].name} 격파`); }
        else { const dd = (this.S.chbDay ??= {}), dk = dayKey(this.now); if (dd[ch] !== dk) { dd[ch] = dk; chb.stones = CB_REPEAT.stones; chb.tix2 = CB_REPEAT.tix; this.S.wallet['item:stone'] = (this.S.wallet['item:stone'] || 0) + chb.stones; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + chb.tix2; } }   // 다시 깬 보상은 장마다 하루 한 번
      }
    }
    this.feed.push({ k: win ? 'stage-clear' : 'stage-fail', idx: L, rewardMin: win ? 2 : 0, gold, tix, ms, deaths, bossLeft, next: T.idx, limitMs: BF?.limitMs || 0, chb });
  }
  // 손 조작 — 방향(누르는 동안) · 점프 · 내려가기 · 무공 · 자동 켜고 끄기(세이브에 남음)
  hold(dir) { this.ensureFight().press({ dir }); }
  jump() { this.ensureFight().press({ jump: 1 }); }
  down() { this.ensureFight().press({ down: 1 }); }
  dash() { this.ensureFight().press({ dash: 1 }); }   // v546 회피
  // v540 자동 전투 때 두목 패턴 피하기(켜 두면 붉은 범위 밖으로 비킨다 · 끄면 직접 피해야 한다) — 지금 싸움에도 바로
  setDodge(on) { this.S.dodge = !!on; for (const F of [this.fight, this.bossFight, this.dg?.F]) if (F) F.autoDodge = !!on; }
  setAuto(on) { this.S.auto = !!on; this.ensureFight().press({ auto: !!on }); if (this.fight && this.bossFight) this.fight.press({ auto: !!on }); }
  // ms만큼 사냥(50ms 틱) — 처치마다 경험치 · 은자 · 사건
  hunt(ms) {
    if (this.dg) return this.huntDungeon(ms);
    const S = this.S, T = this.stage();
    if (!this.bossFight && T.auto && this.canChallenge() && this.autoReady()) this.challenge();
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
      this.addExp(mobExp(L, kind, S.hero.lv));
      const gp = this.fighter().st.goldP || 0;
      S.wallet.gold += Math.round(goldPerMob(L) * (kind === 'boss' ? 20 : kind === 'elite' ? 5 : 1) * (1000 + gp) / 1000);
      if (kind === 'elite') { S.gacha.eliteQ = Math.max(0, S.gacha.eliteQ - 1); this.obtain(GC.eliteDrop(S.gacha, this.rng)); this.emit('kill', { n: 1, elite: 1 }); }
      else if (kind === 'boss') { if (!F.def.boss) S.killsSinceBoss = 0; this.emit('kill', { n: 1, boss: 1 }); if (!F.def.boss) this.feed.push({ k: 'boss' }); }
      else { S.killsSinceBoss++; if (!F.def.raid) T.kills = Math.min(STAGE_KILLS, T.kills + 1); this.emit('kill', { n: 1 }); }
      const r = ID.suddenProgress(S.sudden, 1, this.now);
      if (r) { this.giveHuntMin(r.huntMin); this.feed.push({ k: 'sudden-done' }); }
    }
    // v527 물러나기 — 칸이 레벨보다 앞서 몹에게 계속 쓰러지면 앞 칸에서 사냥. 다시 그 칸으로(앞 칸 두목 도전)는 더 강해진 뒤
    if (!F.def.boss) {
      if (T.dnIdx !== T.idx) { T.dnIdx = T.idx; T.dn = 0; }
      const d = F.deaths - (F.dSeen ?? 0); F.dSeen = F.deaths;
      if (d > 0 && S.auto !== false && T.auto) {
        T.dn = (T.dn || 0) + d;
        if (T.dn >= RETREAT_DEATHS && T.idx > 1) {
          const from = T.idx; T.idx--; T.kills = 0; T.dn = 0; T.dnIdx = T.idx;
          T.failIdx = T.idx; T.failLv = S.hero.lv; T.failPw = this.power();
          this.feed.push({ k: 'retreat', from, idx: T.idx });
        }
      }
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
    if (S.qDay !== d) { S.qDay = d; this.books.daily.reset(DAILY_MISSIONS.map((m) => m.id)); S.dungeons = { day: d, runs: {}, best: S.dungeons?.best || {} }; /* v581 소탕 열림(best)은 날이 바뀌어도 남긴다 */ S.wallet['ticket:exped'] = (S.wallet['ticket:exped'] || 0) + 1; this.emit('login'); }
    if (S.qWeek !== w) { S.qWeek = w; this.books.weekly.reset(WEEKLY_MISSIONS.map((m) => m.id)); }
    OF.touch(S.offline, nowMs);
  }
  // 1분마다 돌발 미션 판정(화면이 부른다)
  minute() { const s = ID.suddenTick(this.S.sudden, this.rng, this.now); if (s) this.feed.push({ k: 'sudden', need: s.need }); return s; }

  // ── 장비 ──
  // v565 외형 — 부위마다 보일 등급(얻어 본 등급까지) · 비워 두면 낀 장비대로. 능력치와 상관없음
  lookSeen() {
    const S = this.S, sn = (S.lookSeen ??= {}), up = (sl, gr) => { if (gr > (sn[sl] ?? -1)) sn[sl] = gr; };
    for (const sl of SLOTS) if (S.gear.eq[sl]) up(sl, S.gear.eq[sl].g);
    for (const it of S.gear.bag) up(it.slot, it.g);
    return sn;
  }
  setLook(slot, gr) {
    const L = (this.S.look ??= {});
    if (gr == null) { delete L[slot]; return true; }
    if (!SLOTS.includes(slot) || !Number.isInteger(gr) || gr < 0 || gr > (this.lookSeen()[slot] ?? -1)) return false;
    L[slot] = gr; return true;
  }
  lookEq() {
    const E = this.S.gear.eq, L = this.S.look; if (!L || !Object.keys(L).length) return E;
    const o = { ...E }; for (const [sl, gr] of Object.entries(L)) o[sl] = { ...(E[sl] || { slot: sl, up: 0, subs: [] }), g: gr };
    return o;
  }
  obtain(items, src = 'drop') {
    { const sn = (this.S.lookSeen ??= {}); for (const it of items) if (it && it.slot && it.g > (sn[it.slot] ?? -1)) sn[it.slot] = it.g; }   // v565
    const got = GR.obtain(this.S.gear, items, this.S.hero.lv, this.S.wallet);
    if (got.some((g) => g.equipped)) { this.dirtyStats = true; this.emit('equip'); }
    // v534 좋은 장비를 주우면 알림(뽑기는 제 연출이 있다) — 진품(3) 이상 · 낀 것인지
    if (src !== 'gacha') for (const it of items) if (it.g >= 3) this.feed.push({ k: 'loot', g: it.g, up: it.up, slot: it.slot, equipped: got.some((x) => x.it === it && x.equipped) });
    return got;
  }
  pullGear(n, ticket = (this.S.wallet['ticket:gear'] || 0) >= n) {
    const items = GC.pull(this.S.gacha, n, this.rng, this.S.wallet, this.S.hero.lv, { ticket });
    if (!items) return null;
    this.emit('gacha', { n });
    if (GC.canLevelUp(this.S.gacha) && GC.startLevelUp(this.S.gacha, this.now)) this.feed.push({ k: 'gacha-lv', lv: this.S.gacha.lv });   // v505 바로 오른다
    return { items, got: this.obtain(items, 'gacha') };
  }
  enhance(slot) { const r = GR.enhance(this.S.gear, slot, this.rng, this.S.wallet, this.S.hero.lv); if (r !== null) this.emit("enhance"); if (r) this.dirtyStats = true; return r; }
  // v579 무공 칸 묶음(둘) — 지금 칸 순서 · 자동/수동을 적어 두고 불러온다(배운 무공만)
  kitPresetSave(i) { if (i !== 0 && i !== 1) return false; const K = this.hero.kitState(); (this.S.kitPre ??= [null, null])[i] = { slots: [...K.slots], off: [...K.off] }; return true; }
  kitPresetLoad(i) {
    const P = this.S.kitPre?.[i]; if (!P) return false;
    const K = this.hero.kitState(), ok = P.slots.filter((id) => K.lv[id]);
    K.slots = ok.slice(0, K.slots.length || ok.length); K.off = (P.off || []).filter((id) => K.lv[id]);
    this.dirtyStats = true; if (this.fight) this.fight.hero.kit = this.hero.battleKit?.() ?? this.fight.hero.kit;
    return true;
  }
  // v588 자동 성장(방치) — 받을 보상 받기 · 장비 뽑기권 쓰기 · 최고 장비 끼기 · 무공 모두 올리기 · 모두 강화. 은자로 뽑지는 않는다(뽑기권만)
  autoGrow(o = {}) {
    const S = this.S, out = { claim: 0, pull: 0, equip: 0, kit: 0, enh: 0, daily: [] };
    // v589 하루 일도 — 출석 · 수련동 모두 소탕 · 원정 받고 다시 보내기(12시간) · 하루 상자(다 했으면)
    if (o.daily !== false) {
      if (this.canAttend() && this.attend()) out.daily.push('출석');
      const sw = this.sweepAll(); if (sw) out.daily.push(`소탕 ${sw.n}`);
      const E = S.exped; if (E.run && this.now >= E.run.endMs && this.claimExped()) out.daily.push('원정 받음');
      if (!E.run && this.startExped(12)) out.daily.push('원정 보냄');
    }
    if (o.claim !== false) {
      for (let i = 0; i < 30 && this.claimGuide(); i++) out.claim++;
      for (const [b, B] of Object.entries(this.books)) for (const id of B.claimable()) if (this.claimMission(b, id)) out.claim++;
    }
    if (o.pull !== false) {
      for (let i = 0; i < 100 && (S.wallet['ticket:gear'] || 0) >= 10; i++) if (this.pullGear(10, true)) out.pull += 10; else break;
      for (let i = 0; i < 10 && (S.wallet['ticket:gear'] || 0) >= 1; i++) if (this.pullGear(1, true)) out.pull++; else break;
    }
    if (GR.equipBest(S.gear, S.hero.lv)) { this.dirtyStats = true; this.emit('equip'); out.equip = 1; }
    if (o.kit !== false) { const k = this.kitUpAll(); if (k) out.kit = k.n; }
    if (o.enh !== false) { const e = this.enhanceAll(); if (e) out.enh = e.ok; }
    if (o.daily !== false && this.todayChest().can && this.claimToday()) out.daily.push('하루 상자');   // 받을 것을 다 받은 뒤
    return out;
  }
  // v559 무공 모두 올리기 — 배운 무공 중 가장 낮은 것부터 고르게, 은자가 되는 만큼(상한까지). 무공마다 전 → 후 · 쓴 은자 · 전투력
  kitUpAll(max = 600) {
    const H = this.hero, K = H.kitState(), W = this.S.wallet, ids = Object.keys(K.lv).filter((id) => K.lv[id] > 0);
    const before = Object.fromEntries(ids.map((id) => [id, K.lv[id]])), g0 = W.gold || 0, pw0 = this.power(), stuck = new Set();
    let n = 0;
    for (let i = 0; i < max; i++) {
      const open = ids.filter((id) => !stuck.has(id) && H.canKitUp(id));
      if (!open.length) break;
      const id = open.reduce((a, b) => (K.lv[b] < K.lv[a] ? b : a));
      if (H.kitUp(id, W)) n++; else stuck.add(id);
    }
    if (!n) return null;
    this.dirtyStats = true; this.emit('skill');
    const per = ids.filter((id) => K.lv[id] !== before[id]).map((id) => ({ id, from: before[id], to: K.lv[id] }));
    return { n, per, gold: g0 - (W.gold || 0), pw0, pw1: this.power() };
  }
  // v543 모두 강화 — 가장 낮은 칸부터 고르게, 재료(은자 · 강화석)가 되는 만큼. 칸마다 전/후 · 성공/실패 · 쓴 재료 · 전투력
  enhanceAll(max = 300) {
    const G = this.S.gear, W = this.S.wallet, before = Object.fromEntries(SLOTS.map((s) => [s, G.slots[s].enh]));
    const g0 = W.gold || 0, s0 = W['item:stone'] || 0, pw0 = this.power(), stuck = new Set();
    let ok = 0, fail = 0;
    for (let i = 0; i < max; i++) {
      const open = SLOTS.filter((s) => !stuck.has(s));
      if (!open.length) break;
      const sl = open.reduce((a, b) => (G.slots[b].enh < G.slots[a].enh ? b : a));
      const r = this.enhance(sl);
      if (r === null) { stuck.add(sl); continue; }
      if (r) ok++; else fail++;
    }
    if (!ok && !fail) return null;
    const per = SLOTS.filter((s) => G.slots[s].enh !== before[s]).map((s) => ({ slot: s, from: before[s], to: G.slots[s].enh }));
    return { ok, fail, per, gold: g0 - (W.gold || 0), stones: s0 - (W['item:stone'] || 0), pw0, pw1: this.power() };
  }
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
  realmUp() { const ok = RM.realmStart(this.S.realm, this.now, this.S.wallet, goldPerMob(this.S.hero.lv)); if (ok) { this.dirtyStats = true; this.emit('realm', { lv: this.S.realm.lv }); this.feed.push({ k: 'realm', lv: this.S.realm.lv }); } return ok; }
  journeyFight() {
    const J = this.S.journey, step = J.cleared;
    const r = runDungeon({ clear: 'boss', timeMs: 60000, mobLv: Math.max(1, Math.round(40 + step * 1.8)), kind: 'boss', n: 1 }, this.fighter(), this.rng.u32());
    if (r.cleared) J.cleared++;
    return r;
  }
  journeyOpen() { const ok = RM.journeyStart(this.S.journey, this.now, this.S.wallet, this.rng); if (ok) { this.dirtyStats = true; this.feed.push({ k: 'journey', step: this.S.journey.step }); } return ok; }
  // ── 무인 ──
  learn(id) { const ok = this.hero.learn(id, this.now, this.S.wallet); if (ok) { this.dirtyStats = true; this.emit('skill'); this.feed.push({ k: 'mastery' }); } return ok; }
  skillUp(k) { const ok = this.hero.skillUp(k, this.S.wallet); if (ok) { this.dirtyStats = true; this.emit('skill'); } return ok; }
  jobDungeon() { return this.runNow('job'); }
  // ── 콘텐츠 ──
  dailyDungeon(kind) { return this.runNow('daily', kind); }
  // v581 모두 소탕 — 한 번 깬(소탕 열린) 수련동을 입장권이 되는 만큼 차례로 · 보상 합
  sweepAll() {
    const sum = { n: 0, gold: 0, exp: 0, tix: 0, stones: 0, fail: 0 };
    for (let guard = 0; guard < 40; guard++) {
      const k = Object.keys(DAILY_DUNGEONS).find((kk) => this.S.dungeons.best?.[kk] && !this.canDungeon('daily', kk));
      if (!k) break;
      const r = this.dailyDungeon(k); if (!r) break;
      sum.n++; if (!r.cleared) sum.fail++;
      for (const x of ['gold', 'exp', 'tix', 'stones']) sum[x] += r[x] || 0;
    }
    return sum.n ? sum : null;
  }
  towerFight() { return this.runNow('tower'); }
  // v582 탑 연속 오르기 — 질 때까지(최대 max층) 다음 층을 바로 · 오른 층 수
  towerClimb(max = 30) {
    const from = this.S.tower.best; let tries = 0, lastWin = false;
    for (; tries < max; tries++) { const r = this.towerFight(); if (!r) break; lastWin = !!r.cleared; if (!lastWin) { tries++; break; } }
    return tries ? { from, to: this.S.tower.best, up: this.S.tower.best - from, tries, stopped: !lastWin } : null;
  }
  // ── v531 실제 던전 ── 옆보기 사냥 엔진(SideFight) 위에서 직접 싸운다. 입장 → 목표(처치 · 두목 · 다 잡기 · 버티기) · 제한 시간 → 결과
  //   enterDungeon: 화면에서 직접(사냥터 대신 던전이 그려진다) · runNow: 같은 던전을 바로 끝까지(소탕 · 봇)
  // v544 오늘 할 일 — 하루마다 도는 것들의 오늘 진행(n / of) · 열렸는지 · 어디로 갈지(go: 창 키)
  //   출석 · 일일 임무 · 수련동 · 장 두목 토벌 · 월드보스 · 대결 · 원정 · 받을 업적(of 0이면 받을 것 n개)
  today() {
    const S = this.S, dk = String(dayKey(this.now)), out = [];
    const add = (id, name, n, of, go, open = true, why = '') => out.push({ id, name, n: Math.min(n, of || n), of, go, open, why, done: open && (of ? n >= of : n === 0) });
    add('attend', '출석', this.canAttend() ? 0 : 1, 1, 'attend:0');
    const dm = this.books.daily, ids = [...dm.defs.keys()];
    add('daily', '일일 임무 받기', ids.filter((id) => dm.get(id).got).length, ids.length, 'mission:1');
    const dks = Object.entries(DAILY_DUNGEONS).filter(([, D]) => S.hero.lv >= D.unlockLv).map(([k]) => k);
    const lockLv = Math.min(...Object.values(DAILY_DUNGEONS).map((D) => D.unlockLv));
    // v545 수련동은 아무 던전이나 3번(입장권이 2시간마다 1이라 던전마다 3번은 하루에 다 못 한다)
    add('dungeon', '수련동 3번', Object.values(S.dungeons.runs).reduce((a, n) => a + (n || 0), 0), TODAY_CHEST.dungeonRuns, 'content:0', dks.length > 0, `Lv ${lockLv}부터`);
    const anyChb = Object.keys(S.chb || {}).length > 0;
    add('raid', '장 두목 토벌', anyChb ? CB_RAID.perDay - this.raidLeft() : 0, CB_RAID.perDay, 'raid:0', anyChb, '장 두목을 깨면');
    const Wb = S.wb || {}; add('wboss', '월드보스', Wb.day === dk ? Wb.used || 0 : 0, 3, 'rival:0');
    const P = S.pvp || {}; add('pvp', '대결', P.day === dk ? P.used || 0 : 0, 5, 'rival:1');
    const E = S.exped; add('exped', '원정 보내기', E.run && this.now < E.run.endMs ? 1 : 0, 1, 'content:2');
    const ach = this.books.ach.claimable().length; add('ach', '업적 보상 받기', ach, 0, 'ach:0', true);
    add('guild', '문파 출석', S.gChk === dayKey(this.now) ? 1 : 0, 1, 'rival:2', !!S.guildId, '문파에 들면');   // v549
    return out;
  }
  // v545 하루 상자 — 열린 오늘 할 일을 다 하면 하루 한 번: 장비 뽑기권 · 은자(사냥 TODAY_CHEST.goldMin분 몫). 경험치는 주지 않는다(레벨 곡선 그대로)
  todayChest() {
    const S = this.S, dk = dayKey(this.now), T = this.today();
    const can = S.todayGot !== dk && T.every((x) => !x.open || x.done);
    return { can, got: S.todayGot === dk, left: T.filter((x) => x.open && !x.done).length };
  }
  claimToday() {
    if (!this.todayChest().can) return null;
    const S = this.S, L = S.hero.lv, gold = Math.round(TODAY_CHEST.goldMin * KILLS_PER_MIN * goldPerMob(L));
    S.todayGot = dayKey(this.now);
    S.wallet.gold += gold; S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + TODAY_CHEST.tix;
    this.emit('today');
    return { gold, tix: TODAY_CHEST.tix };
  }
  canDungeon(type, kind) {
    const S = this.S;
    if (this.dg || this.bossFight) return '다른 싸움 중이에요';
    if (type === 'daily') {
      const D = DAILY_DUNGEONS[kind];
      if (!D) return '없는 던전이에요';
      if (S.hero.lv < D.unlockLv) return `Lv ${D.unlockLv}부터`;
      if ((S.dungeons.runs[kind] || 0) >= DAILY_RUNS) return '오늘은 다 했어요';
      if (ID.staminaNow(S.stamina.daily, this.now) < 1) return '입장권이 없어요';
    } else if (type === 'job') {
      const n = S.hero.adv + 1;
      if (n >= JOB_LV.length) return '전직을 다 했어요';
      if (S.hero.lv < JOB_LV[n]) return `Lv ${JOB_LV[n]}부터`;
    } else if (type === 'wboss') {
      const W = S.wb; if (W && W.day === String(dayKey(this.now)) && W.used >= WBOSS.tries) return '오늘은 다 했어요';
    } else if (type === 'graid') {
      if (!S.guildId) return '문파에 들면';
      if (this.graidState().used >= GRAID.weekTries) return '이번 주는 다 했어요';
    } else if (type !== 'tower') return '없는 던전이에요';
    return '';
  }
  enterDungeon(type, kind) {
    if (this.canDungeon(type, kind)) return false;
    const S = this.S, L = S.hero.lv, D = type === 'daily' ? DAILY_DUNGEONS[kind] : null;
    if (type === 'daily') { ID.useStamina(S.stamina.daily, this.now); S.dungeons.runs[kind] = (S.dungeons.runs[kind] || 0) + 1; }
    if (type === 'graid') this.graidState().used++;
    if (type === 'wboss') { const W = (S.wb ??= { day: '', used: 0, best: 0, week: 0, total: 0 }); if (W.week !== S.qWeek) { W.week = S.qWeek; W.total = 0; W.best = 0; } WB.useTry(W, String(dayKey(this.now))); }
    const mob = (lv, kind2 = 'mob', w = 1) => ({ lv, kind: kind2, w });
    let title, clear, need = 0, limitMs, map, fams, hpX = 1, wipeN = 0, boss = false, extra = {};
    if (type === 'daily') {
      title = D.name; clear = D.clear; limitMs = D.timeMs;
      const X = DG_SIDE[kind];
      if (clear === 'kills') { need = X.need; map = makeSideMap(7000 + L, { w: 16000, tiers: 2 }); fams = { a: { mobs: [mob(L)], keep: X.keep, coolMs: X.coolMs } }; }
      else if (clear === 'boss') { need = 1; boss = true; hpX = X.hpX; map = makeSideMap(7100 + L, { w: 14000, tiers: 1 }); fams = { a: { mobs: [mob(L)], keep: X.adds, coolMs: 4000 }, b: { mobs: [mob(L, 'boss')], keep: 0, coolMs: 1e12 } }; }
      else if (clear === 'survive') { map = makeSideMap(7200 + L, { w: 12000, tiers: 2 }); fams = { a: { mobs: [mob(L + X.lvUp, 'mob', X.mobW), mob(L, 'elite', X.eliteW)], keep: X.keep, coolMs: X.coolMs } }; }
      else { wipeN = need = X.n; map = makeSideMap(7300 + L, { w: 18000, tiers: 2 }); fams = { a: { mobs: [mob(L)], keep: X.n, coolMs: 1e12 } }; }
    } else if (type === 'wboss') {   // v535 월드보스 — 쓰러지지 않는 거대 두목 · 90초 동안 넣은 피해 = 점수
      title = `월드보스 · ${WBF.name}`; clear = 'timeoutWin'; limitMs = WBOSS.fightMs; boss = true;
      map = makeSideMap(9100, CB.arena); fams = { b: { mobs: [mob(L, 'boss')], keep: 0, coolMs: 1e12 }, a: { mobs: [mob(L)], keep: 0, coolMs: 1e12 } };
    } else if (type === 'graid') {   // v550 문파 토벌
      const ch = this.graidBoss(); title = `문파 토벌 · ${CHBOSS[ch].name}`; clear = 'timeoutWin'; limitMs = GRAID.fightMs; boss = true; extra.ch = ch;
      map = makeSideMap(9200 + ch, CB.arena); fams = { b: { mobs: [mob(L, 'boss')], keep: 0, coolMs: 1e12 }, a: { mobs: [mob(L)], keep: 0, coolMs: 1e12 } };
    } else if (type === 'tower') {
      const f = S.tower.best + 1;
      title = `무한의 탑 ${f}층`; clear = 'wipe'; limitMs = 60000; wipeN = need = 4; hpX = ID.towerX(f); extra.floor = f;
      map = makeSideMap(7400 + f, { w: 10000, tiers: 1 }); fams = { a: { mobs: [mob(L)], keep: 4, coolMs: 1e12 } };
    } else {
      const n = S.hero.adv + 1;
      title = `${n}차 전직 던전`; clear = 'boss'; need = 1; boss = true; limitMs = 90000; hpX = JOB_DUNGEON[n].hpX; extra.n = n;
      map = makeSideMap(7500 + n, { w: 14000, tiers: 1 }); fams = { b: { mobs: [mob(JOB_LV[n], 'boss')], keep: 0, coolMs: 1e12 } };
    }
    const F = new SideFight({ lv: L, dungeon: type, map, fams, wb: type === 'wboss' }, this.fighter(), this.rng.u32(), { auto: S.auto !== false, autoDodge: S.dodge !== false });
    if (boss) F.spawn('b', { p: 0, x: Math.round(map.w * 0.75) });
    if (wipeN) F.famState.a.keep = 0;   // 다 잡기: 처음 자리 몹만 · 다시 나오지 않음
    if (hpX !== 1) for (const m of F.mobs) { m.hp = Math.round(m.hp * hpX); m.st = { ...m.st, hp: m.hp }; }
    if (type === 'graid') for (const m of F.mobs) { m.hp = 1e15; m.st = { ...m.st, hp: 1e15 }; const D = CHBOSS[extra.ch]; m.cb = { ch: extra.ch, pats: D.pats, phase: 1, gg: 0 }; m.name = D.name; }
    if (type === 'wboss') for (const m of F.mobs) { m.hp = 1e15; m.st = { ...m.st, hp: 1e15 }; m.cb = { ch: 0, wb: true, pats: WBF.pats, phase: 1, gg: 0 }; m.name = WBF.name; }
    F.limitMs = limitMs;
    this.dg = { type, kind, title, clear, need, limitMs, F, ...extra };
    this.feed.push({ k: 'dungeon-start', type, kind, title });
    return true;
  }
  dgStatus() {
    const d = this.dg; if (!d) return null;
    const F = d.F, left = Math.max(0, d.limitMs - F.t);
    let p = 0, label = '';
    if (d.clear === 'kills') { p = F.kills / d.need; label = `처치 ${Math.min(F.kills, d.need)} / ${d.need}`; }
    else if (d.clear === 'boss') { const b = F.mobs.find((m) => m.kind === 'boss'); const r = b ? b.hp / b.st.hp : 0; p = 1 - r; label = `두목 체력 ${Math.ceil(r * 100)}%`; }
    else if (d.clear === 'wipe') { p = 1 - F.mobs.length / d.need; label = `남은 적 ${F.mobs.length} / ${d.need}`; }
    else if (d.clear === 'timeoutWin') { p = F.t / d.limitMs; const dmg = Math.round(F.dmgOut * WBF.sideX); label = d.type === 'graid' ? `피해 ${dmg}` : `피해 ${dmg} · 점수 ${WB.bossScore(dmg, this.S.hero.lv)}`; }
    else { p = F.t / d.limitMs; label = F.deaths ? '쓰러짐 — 실패' : `쓰러지지 말고 버티기 · ${Math.ceil(left / 1000)}초`; }
    return { title: d.title, type: d.type, kind: d.kind, clear: d.clear, p: Math.max(0, Math.min(1, p)), label, leftMs: left };
  }
  dgCheck() {
    const d = this.dg, F = d.F;
    if (d.clear === 'kills' && F.kills >= d.need) return true;
    if (d.clear === 'boss' && F.killsBy.boss) return true;
    if (d.clear === 'wipe' && F.mobs.length === 0) return true;
    if (d.clear === 'survive' && F.deaths > 0) return false;
    if (F.t >= d.limitMs) return d.clear === 'survive' || d.clear === 'timeoutWin';
    return null;
  }
  huntDungeon(ms) {
    const F = this.dg.F, end = F.t + ms;
    let r = null;
    while (F.t < end) { F.step(); r = this.dgCheck(); if (r !== null) break; }
    this.lastEvents = F.events; this.lastFight = F; F.events = [];
    if (r !== null) this.endDungeon(r);
    return 0;
  }
  // 포기(나가기) — 실패로 끝(입장권은 이미 씀)
  leaveDungeon() { if (!this.dg) return false; this.endDungeon(false, true); return true; }
  endDungeon(cleared, gaveUp = false) {
    const d = this.dg, S = this.S, F = d.F, L = S.hero.lv, out = { gold: 0, exp: 0, tix: 0, stones: 0 };
    this.dg = null; this.dirtyStats = true;
    if (cleared && d.type === 'daily') {
      const R = DAILY_DUNGEONS[d.kind].reward;
      if (R.expMin) { out.exp = Math.round(R.expMin * KILLS_PER_MIN * mobExp(L, 'mob', L)); this.addExp(out.exp); }
      if (R.goldMin) { out.gold = Math.round(R.goldMin * KILLS_PER_MIN * goldPerMob(L)); S.wallet.gold += out.gold; }
      if (R.gearTickets) { out.tix = R.gearTickets; S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + out.tix; }
      if (R.stones) { out.stones = R.stones; S.wallet['item:stone'] = (S.wallet['item:stone'] || 0) + out.stones; }
      (S.dungeons.best ??= {})[d.kind] = true;
      this.emit('dungeon', { kind: 1 });
    } else if (cleared && d.type === 'tower') { S.tower.best = d.floor; }
    else if (d.type === 'wboss') {   // 나가도 넣은 만큼은 점수
      const W = S.wb, dmg = Math.round(F.dmgOut * WBF.sideX), score = WB.bossScore(dmg, L);
      W.total += score; W.best = Math.max(W.best, score); out.dmg = dmg; out.score = score; out.best = W.best; out.total = W.total;
      this.emit('wboss');
    }
    else if (d.type === 'graid') { out.dmg = Math.round(F.dmgOut * WBF.sideX); out.ch = d.ch; this.emit('graid'); }   // v550 나가도 넣은 만큼
    else if (cleared && d.type === 'job') { this.hero.clearDungeon(JOB_ADV[d.n].dungeon); this.hero.advance(); this.emit('dungeon', { job: d.n }); this.feed.push({ k: 'advance', n: d.n }); }
    const res = { k: 'dungeon-end', type: d.type, kind: d.kind, title: d.title, cleared, gaveUp, ms: F.t, kills: F.kills, deaths: F.deaths, floor: d.floor, n: d.n, ...out };
    this.feed.push(res); this.lastDg = res;
    return res;
  }
  // 같은 던전을 화면 없이 끝까지(소탕 · 봇)
  runNow(type, kind) {
    if (!this.enterDungeon(type, kind)) return null;
    for (let i = 0; i < 4000 && this.dg; i++) this.huntDungeon(1000);
    if (this.dg) this.endDungeon(false);
    const r = this.lastDg;
    this.feed = this.feed.filter((f) => f.k !== 'dungeon-start' && f !== r);
    return { cleared: r.cleared, ...r };
  }
  startExped(h) { return ID.startExpedition(this.S.exped, h, this.now, this.S.wallet); }
  claimExped() { const r = ID.claimExpedition(this.S.exped, this.now); if (r) this.giveHuntMin(r.huntMin); return r; }
  // ── 경쟁(미리보기: 서버 없이 같은 엔진으로) ──
  // 월드보스 한 번(90초) — 넣은 피해 → 보스 점수 · 하루 3번 · 주간 합계
  wbossFight() { const r = this.runNow('wboss'); return r ? { dmg: r.dmg, score: r.score, deaths: r.deaths } : null; }
  // 대결 상대 셋(미리보기: 내 레벨 근처 기준 무인 — 서버가 붙으면 다른 무인의 방어 덱)
  // v548 진짜 상대 — 서버에서 받은 방어 덱(점수가 가까운 무인) · 있을 수 없는 덱(레벨 · 직업 · 전투력이 표준의 6배 넘음)은 뺀다
  setPvpReal(list) {
    this.pvpReal = (list || []).filter((x) => {
      const f = x && x.f, st = f && f.st;
      if (!f || !JOBS[f.job] || !Number.isInteger(f.lv) || f.lv < 1 || f.lv > LEVEL_MAX || !st || !(st.atk > 0) || !(st.hp > 0) || !Object.values(st).every((v) => typeof v === 'number' && Number.isFinite(v))) return false;
      return power(f, 'pvp') <= stdPower(f.lv, 'pvp', f.job) * POWER_SLACK * 2;
    }).slice(0, 3).map((x) => ({ uid: String(x.uid), name: String(x.name || '무인').slice(0, 12), f: { lv: x.f.lv, job: x.f.job, kind: 'hero', st: x.f.st }, score: x.score | 0,
      lk: Object.fromEntries(Object.entries(x.f.lk || {}).filter(([sl, gr]) => SLOTS.includes(sl) && Number.isInteger(gr) && gr >= 0 && gr <= 6)) }));   // v566 외형(있는 칸 · 0~6만)
    return this.pvpReal.length;
  }
  // v569 즐겨찾기 무인(최대 20) · 친선 대결(점수 · 횟수와 상관없이 그 덱과 겨뤄 보기 — 기록 남지 않음)
  toggleFav(uid, name) {
    const F = (this.S.favs ??= []), i = F.findIndex((x) => x.uid === uid);
    if (i >= 0) { F.splice(i, 1); return false; }
    if (F.length >= 20) return null;
    F.push({ uid: String(uid).slice(0, 64), name: String(name || '무인').slice(0, 12) }); return true;
  }
  // v571 연속 처치 최고(화면이 센다) — 최고 기록 · 업적
  comboMark(n) { const S = this.S; if (n > (S.comboBest || 0)) S.comboBest = n; this.emit('combo', { n }); }
  isFav(uid) { return (this.S.favs || []).some((x) => x.uid === uid); }
  pvpFriendly(opp) {
    const save = this.pvpReal; if (!this.setPvpReal([opp])) { this.pvpReal = save; return null; }
    const o = this.pvpReal[0]; this.pvpReal = save; this.emit('friendly');   // v571
    const me = this.fighter(), log = [], r = PV.duel(me, o.f, this.rng.u32(), log);
    return { ...r, d: 0, friendly: true, score: this.S.pvp?.score ?? PVP.start, tier: PV.tierOf(this.S.pvp?.score ?? PVP.start).name, log, opp: { name: o.name, job: o.f.job, lv: o.f.lv, hp: o.f.st.hp, real: true, lk: o.lk || null }, myHp: me.st.hp };
  }
  // v563 복수 — 방어에서 진 상대(그 덱)와 바로 겨룬다(오늘 횟수 하나). 이기면 그 기록에 「복수함」
  pvpRevenge(logIdx, opp) {
    const P = this.S.pvp, L = P?.log?.[logIdx];
    if (!L || !L.def || L.win || L.rev || !L.by || !opp || opp.uid !== L.by) return null;
    if (!this.setPvpReal([opp])) return null;
    const r = this.pvpFight(0);
    if (r) { const L2 = P.log.find((x) => x === L) || L; L2.rev = r.win ? 1 : 2; r.revenge = true; if (r.win) this.emit('revenge'); }   // v571
    return r;
  }
  // 내 방어 덱 — 대결이 쓰는 것만(레벨 · 직업 · 능력치)
  pvpDeck() {   // v566 외형(부위마다 보이는 등급)도 — 상대 화면에 내 모습으로
    const f = this.fighter(), E = this.lookEq(), lk = {}; for (const sl of SLOTS) if (E[sl]) lk[sl] = E[sl].g;
    return JSON.stringify({ lv: f.lv, job: f.job, st: f.st, lk });
  }
  // 받은 공격 기록 — 내 점수에 더하고 「지난 대결」에 방어로
  pvpDefend(list) {
    const P = (this.S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] });
    let sum = 0;
    for (const x of list || []) { const d = Math.max(-20, Math.min(3, x.d | 0)); sum += d; P.log = [{ name: String(x.name || '무인').slice(0, 12), win: !x.win, d, def: 1, by: x.by ? String(x.by).slice(0, 64) : undefined }, ...P.log].slice(0, 10); }
    P.score = Math.max(0, P.score + sum); this.pvpMark();
    return sum;
  }
  pvpOpponents() {
    const S = this.S, P = (S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] });
    const L = S.hero.lv, seed = dayKey(this.now) * 7 + P.used;
    const real = (this.pvpReal || []).map((o) => ({ ...o, pw: power(o.f, 'pvp'), real: true }));
    return [...real, ...[0.85, 1, 1.2].map((x, i) => {
      const f = refPlayer(Math.max(1, Math.min(150, Math.round(L * (0.95 + 0.05 * i)))), ['sword', 'spear', 'fist', 'bow', 'mage'][(seed + i) % 5] || 'sword');
      f.st = { ...f.st, atk: Math.round(f.st.atk * x), hp: Math.round(f.st.hp * x) };
      return { name: ['낭인', '협객', '고수'][i], f, pw: power(f, 'pvp'), score: P.score + (i - 1) * 40 };
    })].slice(0, 3);
  }
  pvpFight(i) {
    const S = this.S, P = (S.pvp ??= { score: PVP.start, day: '', used: 0, log: [] });
    const opp = this.pvpOpponents()[i];
    if (!opp || !PV.useTry(P, String(dayKey(this.now)))) return null;
    const me = this.fighter(), log = [], r = PV.duel(me, opp.f, this.rng.u32(), log);   // v539 화면이 다시 보여 줄 기록
    const sd = PV.scoreDelta(r.win, power(me, 'pvp'), opp.pw), d = sd.atk;
    P.score = Math.max(0, P.score + d); this.pvpMark();
    P.log = [{ name: opp.name, win: r.win, d }, ...P.log].slice(0, 10);
    this.emit('pvp');
    return { ...r, d, score: P.score, tier: PV.tierOf(P.score).name, log, opp: { name: opp.name, job: opp.f.job, lv: opp.f.lv, hp: opp.f.st.hp, real: !!opp.real, lk: opp.lk || null }, myHp: me.st.hp, oppUid: opp.uid || null, defD: sd.def };
  }
  // ── v536 출석 ── 하루 한 번(한국 시각 자정에 바뀜) · 28칸 · 다 채우면 처음부터
  attendState() { return (this.S.att ??= { n: 0, last: -1, cycle: 0 }); }
  canAttend() { return this.attendState().last !== dayKey(this.now); }
  attendNext() { return (this.attendState().n % ATTEND_DAYS) + 1; }
  attend() {
    if (!this.canAttend()) return null;
    const A = this.attendState(), day = this.attendNext(), R = ATTEND[day], S = this.S, got = { day, gold: 0, items: {}, gear: null, title: null };
    A.last = dayKey(this.now); A.n++; if (day === ATTEND_DAYS) A.cycle++;
    if (R.goldMin) { got.gold = Math.round(R.goldMin * KILLS_PER_MIN * goldPerMob(S.hero.lv)); S.wallet.gold += got.gold; }
    for (const [k, n] of Object.entries(R)) if (k.includes(':')) { S.wallet[k] = (S.wallet[k] || 0) + n; got.items[k] = n; }
    if (R.gear) { const it = GR.makeGear(this.rng, SLOTS[this.rng.int(SLOTS.length)], R.gear.g); if (R.gear.up) it.up = 1; got.gear = { g: it.g, up: it.up, slot: it.slot }; this.obtain([it], 'attend'); }
    if (R.title && !(S.titles ??= []).includes(R.title)) { S.titles.push(R.title); got.title = R.title; }
    this.emit('login');
    this.feed.push({ k: 'attend', ...got });
    return got;
  }
  // ── 방치 ──
  returnCheck(nowMs) {
    const p = OF.checkReturn(this.S.offline, nowMs, String(weekKey(nowMs)), this.S.hero.lv, this.S.hero.exp);
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
  // v580 시간 티켓 바로 쓰기 — 1장 = 사냥 15분 몫(경험치 · 은자) · 쓸 곳(원정 · 배우기)이 없어 쌓이던 것
  timeHunt(n = 1) {
    const W = this.S.wallet, k = Math.max(0, Math.min(n | 0, W['ticket:time'] || 0)); if (!k) return null;
    W['ticket:time'] -= k; const lv0 = this.S.hero.lv, g0 = W.gold || 0, x0 = this.S.hero.exp;
    this.giveHuntMin(15 * k);
    return { n: k, min: 15 * k, gold: (W.gold || 0) - g0, lv: this.S.hero.lv - lv0 };
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
