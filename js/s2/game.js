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
import { goldPerMob, SHARD_PER_TICKET } from './tables/gearstat.js';
import { LEVEL_MAX, JOB_LV } from './tables/progress.js';
import { START_PULL_TICKETS, SLOTS } from './tables/gear.js';
import { START_PULLS } from './tables/s5.js';
import { CDR_CAP } from './tables/traits.js';
import { DAILY_DUNGEONS, DAILY_RUNS, JOB_DUNGEON, towerMsFloors, towerMsReward } from './tables/content.js';
import { GUIDE, DAILY_MISSIONS, WEEKLY_MISSIONS, achievements, guideCurrent } from './tables/missions.js';
import { JOB_ADV, MASTERY } from './tables/skills.js';
import { SHOP, SHOP_FREE, shopById } from './tables/shop.js';
import { EXCHANGE, EX_CUR, EX_EARN, exItem } from './tables/exchange.js';   // v635 교환소
import { PASS, PASS_PTS, PASS_REWARDS } from './tables/pass.js';
import { BOUNTY_T, BOUNTY_SLOTS, BOUNTY_REW, BOUNTY_CHEST, bountySeed } from './tables/bounty.js';
import { ROSTER } from './tables/mobs.js';
import { CHBOSS, CB, cbGearGrade, CB_REPEAT, WBF, CB_RAID, raidStars, DEX_REW } from './tables/chboss.js';
const CB_MANUAL_STONES = 50;   // v546
// v632 장비 비교 「종합」의 보스 피해 무게(Game.gearVal) — 봇의 장 두목 패배가 예전(점수 비교) 수준이 되게 맞춘 값
export const GEAR_BOSS = { w: 1 };
export const OUTFIT_N = 3;   // v634 차림 칸 수
// 기연 — 사냥으로 FATE_NEED마리를 잡을 때마다 한 번, 카드 셋 중 하나를 고른다(안 고른 것은 FATE_CAP번까지 쌓이고 그동안 칸은 멈춘다)
//   은자 · 경험치는 그 레벨 사냥 FATE_MIN분 몫 · 강화석은 5 + 레벨/10 · w는 나올 무게(셋은 서로 다르게)
export const FATE_NEED = 300, FATE_CAP = 3, FATE_MIN = 10;
export const FATE_CARDS = [
  { k: 'gold', w: 25 }, { k: 'exp', w: 25 },
  { k: 'ticket:gear', w: 20, n: 2 }, { k: 'item:stone', w: 14 },
  { k: 'ticket:weapon', w: 4, n: 1 }, { k: 'ticket:pal', w: 4, n: 1 }, { k: 'ticket:relic', w: 4, n: 1 },
  { k: 'ticket:time', w: 4, n: 1 },
];
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
// 동행 토벌 — 다른 무인의 덱(최대 둘)과 함께 두목 하나 · 하루 runsPerDay번(싸우면 이기든 지든 한 번 — 문파 토벌과 같다) · 60초
//   단계 n: 두목 Lv 10 + 5n(만렙 뒤로는 체력만 ×1.15씩) · 체력 = 그 레벨 두목 × hpX(기준 무인 혼자서는 시간 안에 못 깨고 셋이면 깬다)
//   동행 한 명의 피해는 내 무인이 넣은 피해를 넘지 못한다(content/dungeon.js runParty)
//   보상: 단계를 처음 깨면 first · 깬 단계를 다시 깨면 again · 지면 없음. 경험치 · 은자는 주지 않는다(레벨 곡선 그대로)
export const PARTY = { runsPerDay: 2, allies: 2, timeMs: 60000, hpX: 3, overX: 1.15,
  rew: { first: { tix: 4, stones: 30, pal: 1 }, again: { tix: 2, stones: 15, pal: 0 } } };
export const partyLv = (tier) => Math.min(LEVEL_MAX, 10 + 5 * Math.max(1, tier));
export const partyHpX = (tier) => PARTY.hpX * Math.pow(PARTY.overX, Math.max(0, 10 + 5 * tier - LEVEL_MAX) / 5);
const TODAY_CHEST = { tix: 3, goldMin: 30, dungeonRuns: 3 };   // v545 하루 상자
// v634 단약 — 하루 uses번씩 무료 · 하나에 ms(30분) · 같은 단약을 또 먹으면 남은 시간에 더한다(다른 단약끼리는 따로 돈다)
//   효과는 전투 · 경험치 · 은자 계산에 그대로(fighter) · 전투력(power)과 방어 덱에는 넣지 않는다 · 방치 보상(claimOffline)에도 안 붙는다
export const DANYAK = { uses: 3, ms: 30 * 60e3, list: [
  { id: 'exp', name: '청심단', what: '경험치 +50%', stats: { expP: 500 } },
  { id: 'gold', name: '재물부', what: '은자 +50%', stats: { goldP: 500 } },
  { id: 'atk', name: '혈기단', what: '공격 +10%', stats: { final5: 100 } },
] };
// v634 성장 봇짐 — 5레벨마다 작은 상자(뽑기권 · 강화석) · 10레벨마다 큰 상자(더 많이 + 확정 장비 한 점) · 50레벨마다 병기 · 동료 · 영물 뽑기권 1씩
//   받은 레벨은 S.lvBox.got · 옛 세이브는 이미 지난 레벨의 봇짐도 받을 수 있다
export const LVBOX = { every: 5, big: 10, coll: 50, small: { tix: 1, stoneAdd: 5 }, large: { tix: 3, stoneAdd: 10 } };
export const lvBoxLevels = () => Array.from({ length: Math.floor(LEVEL_MAX / LVBOX.every) }, (_, i) => (i + 1) * LVBOX.every);
export const lvBoxGearGrade = (lv) => Math.min(4, Math.floor(lv / 30));
export function lvBoxReward(lv) {
  if (!Number.isInteger(lv) || lv < LVBOX.every || lv > LEVEL_MAX || lv % LVBOX.every) return null;
  const big = lv % LVBOX.big === 0, R = big ? LVBOX.large : LVBOX.small;
  const r = { 'ticket:gear': R.tix, 'item:stone': Math.round(lv / 2) + R.stoneAdd };
  if (lv % LVBOX.coll === 0) for (const k of ['ticket:weapon', 'ticket:pal', 'ticket:relic']) r[k] = 1;
  return { give: r, gear: big ? lvBoxGearGrade(lv) : -1 };
}
import { ATTEND, ATTEND_DAYS } from './tables/attend.js';
import { MAIL_KEEP, MAIL_MAX, MAIL_GIFTS, MAIL_TXT } from './tables/mail.js';
import { TITLE_EACH, titleByName } from './tables/titles.js';
import * as GR from './gear/gear.js';
import * as GC from './gear/gacha.js';
import * as CL from './grow/collect.js';
import * as RM from './grow/realm.js';
import * as WI from './core/wish.js';   // v634 뜻대로 굴리기
import * as ID from './content/idle.js';
import * as OF from './content/offline.js';
import { runDungeon, runParty } from './content/dungeon.js';
import { power, stdPower } from './online/power.js';
import { TABLE_VER } from './tables/version.js';
import * as WB from './online/wboss.js';
import * as GD from './online/guild.js';
import * as PV from './online/pvp.js';
import { refPlayer } from './battle/ref.js';
import { PVP, WBOSS, POWER_SLACK, PVP_TIERS } from './tables/online.js';
import { JOBS, RANGED } from './tables/char.js';

export const COLLECTS = ['weapon', 'pal', 'relic'];
const DAY = 24 * 3600e3, KST = 9 * 3600e3;
export const dayKey = (ms) => Math.floor((ms + KST) / DAY);
// 주 키: 그 주 월요일의 dayKey
export const weekKey = (ms) => { const d = dayKey(ms); return d - ((d + 3) % 7); };
// 패스 시즌: 몇째 주((weekKey + 3) / 7)를 4주씩 묶은 번호 · 그 시즌이 끝나는 때(다음 시즌 첫 월요일 한국 시각 자정)
export const passSeason = (ms) => Math.floor((weekKey(ms) + 3) / 7 / PASS.weeks);
export const passEndMs = (season) => ((season + 1) * PASS.weeks * 7 - 3) * DAY - KST;
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
    this.hero.spState();     // 옛 세이브도 스탯 배분 칸을 받는다(0점부터)
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
      ...COLLECTS.flatMap((s) => CL.traitSources(S.colls[s])),   // v635 고유 기질(낄 때만)
      ...RM.realmSources(S.realm), ...RM.journeySources(S.journey), ...RM.cosmeticSources(S.cosmetics),
      ...ID.towerSources(S.tower.best),
      ...this.titleSources(),
    ];
  }
  // 스탯 배분 — 레벨마다 1점. 남은 점수 · 찍기 · 고르게 찍기 · 되돌리기(공짜)
  statPts() { return this.hero.spFree(); }
  statUp(key, n = 1) { const r = this.hero.spUp(key, n); if (r) { this.dirtyStats = true; this.emit('stat', { n: this.hero.spUsed() }); } return r; }
  statAuto() { const r = this.hero.spAuto(); if (r) { this.dirtyStats = true; this.emit('stat', { n: this.hero.spUsed() }); } return r; }
  statReset() { const r = this.hero.spReset(); if (r) this.dirtyStats = true; return r; }
  // v537 칭호 수집 효과 — 얻은 칭호 수만큼
  titleSources() { const n = (this.S.titles || []).filter((t) => titleByName(t)).length; return n ? [{ src: 'title', stats: Object.fromEntries(Object.entries(TITLE_EACH).map(([k, v]) => [k, v * n])) }] : []; }
  setTitle(nm) { if (nm && !(this.S.titles || []).includes(nm)) return false; this.S.titleOn = nm || null; return true; }
  // 장착한 동료(등급) — 전투에서 따로 친다(v497)
  palList() { const C = this.S.colls.pal; return C.eq.filter((k) => k !== null && k !== undefined).map((k) => ({ g: CL.kindGrade('pal', k), k })); }
  fighter(bf = true) { return this.traitKit(this.hero.fighter(bf ? [...this.sources(), ...this.bfSources()] : this.sources(), this.palList())); }   // v634 bf: 단약 효과까지(전투 · 벌이) · v635 기질(쿨)
  power(mode = 'pve') { return power(this.fighter(false), mode); }
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
    return { gold, tix, merit: this.exEarn('merit', EX_EARN.merit.checkin) };
  }
  // v550 문파 토벌 — 이번 주 내 도전 수 · 받은 단계 · 이번 주 두목(장 두목 15명 차례)
  graidState() { const S = this.S, wk = weekKey(this.now), R = (S.graid ??= { week: wk, used: 0, claimed: 0 }); if (R.week !== wk) Object.assign(R, { week: wk, used: 0, claimed: 0 }); return R; }
  graidBoss() { return 1 + (weekKey(this.now) % 15); }
  // v555 두목 도감 — 두목마다 깸 · 토벌 별 · 최고 기록 · 손으로 깸 / ★3 수 단계 보상
  //   at: 첫 처치 때(ms · 이 기능 전에 깬 두목은 0) · found: 만났거나 깬 두목 수(도감에 얼굴이 드러난 수)
  dex() {
    const S = this.S, R = S.raid || { star: {}, best: {} };
    const list = CHBOSS.slice(1).map((D, i) => { const ch = i + 1; return { ch, name: D.name, title: D.title, pats: D.pats, seen: this.stage().top >= ch * 10, beat: !!S.chb?.[ch], star: R.star?.[ch] || 0, best: R.best?.[ch] || 0, manual: !!S.chbMan?.[ch], at: S.chbAt?.[ch] || 0 }; });
    const three = list.filter((x) => x.star >= 3).length, got = S.dexGot || 0;
    return { list, three, found: list.filter((x) => x.seen || x.beat).length, got, next: DEX_REW[got] || null, can: !!DEX_REW[got] && three >= DEX_REW[got].n };
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
    if (P.wk !== wk) { if (P.wk != null && P.wkBest != null) { this.mailPvp(P); P.lastWk = P.wk; P.lastBest = P.wkBest; } P.wk = wk; P.wkBest = P.score; }
    P.wkBest = Math.max(P.wkBest, P.score);
  }
  pvpWeekReward() {
    const P = this.S.pvp; this.pvpMark();
    if (!P || P.lastWk == null || P.lastGot === P.lastWk) return null;
    return { ...this.pvpTierRew(P.lastBest), wk: P.lastWk, best: P.lastBest, fame: EX_EARN.fame.week[Math.max(0, PVP_TIERS.filter((t) => P.lastBest >= t.min).length - 1)] || 0 };
  }
  pvpTierRew(best) { const ti = Math.max(0, PVP_TIERS.filter((t) => best >= t.min).length - 1); return { tier: PVP_TIERS[ti].name, tix: WEEK_REW.pvp[ti] }; }
  claimPvpWeek() {
    const r = this.pvpWeekReward(); if (!r) return null;
    this.S.pvp.lastGot = r.wk; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + r.tix; this.exEarn('fame', r.fame);
    return r;
  }
  // v576 공동 토벌 보상 — 이번 주 합(서버) · 단계마다 한 번
  wbCommunityClaim(total) {
    const S = this.S, wk = weekKey(this.now), C = (S.wbCom ??= { wk, got: 0 }); if (C.wk !== wk) Object.assign(C, { wk, got: 0 });
    const reach = WB_COMMUNITY.filter((x) => total >= x.at).length; if (reach <= C.got) return null;
    const tix = WB_COMMUNITY.slice(C.got, reach).reduce((a, x) => a + x.tix, 0), got0 = C.got; C.got = reach;
    S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + tix;
    return { n: reach, tix, blood: this.exEarn('blood', (reach - got0) * EX_EARN.blood.community) };
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
    return { wk, rank, tix, blood: this.exEarn('blood', this.exWbRank(rank)) };
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
    return { gold, tix, merit: this.exEarn('merit', EX_EARN.merit.gtrain) };
  }
  // 문파 피해 합(서버) → 단계 · 받은 것보다 높은 단계마다 보상
  graidClaim(total, lv) {
    if (!this.S.guildId) return null;
    const R = this.graidState(), ph = GD.raidPhase(Math.max(0, total || 0), graidHp0(lv)).phase, n = ph - R.claimed;
    if (n <= 0) return null;
    R.claimed = ph;
    const gold = Math.round(n * GRAID.rew.goldMin * KILLS_PER_MIN * goldPerMob(this.S.hero.lv)), tix = n * GRAID.rew.tix;
    this.S.wallet.gold += gold; this.S.wallet['ticket:gear'] = (this.S.wallet['ticket:gear'] || 0) + tix;
    return { n, phase: ph, gold, tix, merit: this.exEarn('merit', n * EX_EARN.merit.graidPhase) };
  }
  setNick(name) { const n = String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12); if (!n) return false; this.S.nick = n; return true; }
  rankProfile() {
    const S = this.S, f = this.fighter(false);
    return { season: 's2', nickname: S.nick || '무인', lv: S.hero.lv, job: String(S.hero.job).slice(0, 16), power: Math.round(power(f, 'pve')), pvpPower: Math.round(power(f, 'pvp')),
      ...(S.guildId ? { guildId: S.guildId } : {}), pvpScore: Math.max(0, Math.min(99999, Math.round(S.pvp?.score ?? 1000))), wbScore: Math.max(0, Math.round(S.wb?.week === S.qWeek ? S.wb.total || 0 : 0)), tv: String(TABLE_VER).slice(0, 16), signed: true };
  }
  // ── 사건 → 미션 · 길잡이 · 업적 ──
  emit(ev, v = {}) {
    const S = this.S;
    for (const [k, b] of Object.entries(this.books)) { const fin = b.on(ev, v); if (k === 'ach') for (const id of fin) this.feed.push({ k: 'ach', id }); }   // v538 업적 달성 알림
    const cur = guideCurrent(S.q.guide);
    if (cur) { const fin = new QuestBook([cur], S.q.guide).on(ev, { lv: S.hero.lv, job: S.hero.adv, ...v }); if (fin.length) this.feed.push({ k: 'guide', id: cur.id }); }
    // 강호 패스 점수 — 수련동 깨기 · 스테이지 두목 · 월드보스 · 대결(임무 받기 · 출석 · 동행 토벌은 그 자리에서 바로 — login은 날이 바뀔 때도 와서 출석과 겹친다)
    const pp = ev === 'dungeon' ? (v.kind ? PASS_PTS.dungeon : v.stage ? PASS_PTS.stage : 0) : ev === 'wboss' ? PASS_PTS.wboss : ev === 'pvp' ? PASS_PTS.duel : 0;
    if (pp) this.passAdd(pp);
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
    this.achSync();
    return cur;
  }
  // v612 상태로 정해지는 업적 · 길잡이(스탯 · 기연 · 모음 · 동행 · 패스 · 오늘 덤) — 지금 값을 사건으로 실어 보낸다(분마다 · 길잡이 받을 때). 옛 세이브도 이미 한 만큼 바로 오른다
  collKinds() { return COLLECTS.reduce((a, s) => a + Object.keys(this.S.colls[s]?.own || {}).length, 0); }
  passTier() { return Math.min(PASS.tiers, Math.floor(this.passSt().pts / PASS.need)); }
  achSync() {
    this.emit('stat', { n: this.hero.spUsed() });
    this.emit('fate', { n: this.fate().n });
    this.emit('coll', { n: this.collKinds() });
    this.emit('party', { n: this.partyRec().best });
    this.emit('pass', { n: this.passTier(), got: this.passSt().got.length });
    this.emit('shop', { n: 0, free: this.shopFreeCan() ? 0 : 1 });
  }
  // 최고형 업적의 지금 값(업적 창 진행 막대)
  achBest(ev) {
    return ev === 'combo' ? this.S.comboBest || 0 : ev === 'stat' ? this.hero.spUsed() : ev === 'fate' ? this.fate().n : ev === 'coll' ? this.collKinds()
      : ev === 'party' ? this.partyRec().best : ev === 'pass' ? this.passTier() : 0;
  }
  claimMission(book, id) {
    const B = this.books[book], d = B.defs.get(id);
    if (!d || !B.st[id]?.done || B.st[id]?.got) return false;
    const r = this.missionRew(book, id);   // v635 우편(놓친 임무)도 같은 셈
    B.claim(id);
    this.addExp(r.exp); this.S.wallet.gold += r.gold;
    if (d.items) gain(this.S.wallet, Object.entries(d.items).map(([k, n]) => ({ k, n })));
    if (book === 'daily' || book === 'weekly') this.passAdd(PASS_PTS[book]);   // 강호 패스 점수
    return true;
  }
  // 「사냥 n분 상당」 보상 → 그 레벨 사냥 벌이(경험치 + 은자)
  giveHuntMin(min) { const r = this.huntRew(min); this.addExp(r.exp); this.S.wallet.gold += r.gold; }
  huntRew(min) { const L = this.S.hero.lv, kills = min * KILLS_PER_MIN; return { exp: Math.round(kills * mobExp(L)), gold: Math.round(kills * goldPerMob(L)) }; }
  // v635 임무 하나의 보상(지금 레벨 · 주지 않고 셈만) → { exp, gold, ...items } · 경험치는 addExp 앞 값(받을 때 경험치 %가 붙는다)
  missionRew(book, id) { const d = this.books[book]?.defs.get(id); return d ? { ...this.huntRew(d.huntMin), ...(d.items || {}) } : {}; }
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
    this.outfitBack();   // v634 두목 싸움 뒤 차림 되돌리기(옛 세이브 · 싸움 도중 저장도)
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
    this.outfitGo();   // v634 두목 차림
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
    this.outfitBack();   // v634 진 뒤 전투력(failPw)도 사냥 차림으로
    if (this.bossFight?.def.raid) return this.endRaid(win);
    const T = this.stage(), L = T.idx, BF = this.bossFight, ms = BF ? BF.t : 0, deaths = BF ? BF.deaths : 0, bm = BF?.mobs.find((m) => m.kind === 'boss'), bossLeft = !win && bm ? Math.ceil((bm.hp / bm.st.hp) * 100) : 0;
    this.bossFight = null;
    if (win) { T.idx = Math.min(LEVEL_MAX, L + 1); T.top = Math.max(T.top, T.idx); T.kills = 0; T.failIdx = 0; this.emit('dungeon', { stage: L }); this.bountyHit('boss', L, true); }
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
        if (first) { (this.S.chbAt ??= {})[ch] = this.now; this.emit('chboss'); const it = GR.makeGear(this.rng, SLOTS[this.rng.int(SLOTS.length)], cbGearGrade(ch)); chb.gear = { g: it.g, slot: it.slot, up: it.up }; this.obtain([it]); (this.S.titles ??= []).push(`${CHBOSS[ch].name} 격파`); }
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
      n++; S.kills++; this.fateKill(1);
      if (!F.def.boss) this.bountyHit(kind, L);   // 현상수배 — 사냥터에서만(두목전 · 토벌 안은 빼고)
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
      let d = F.deaths - (F.dSeen ?? 0); F.dSeen = F.deaths;
      if (JOBS[S.hero.job].range >= RANGED.minRange && S.auto !== false && T.auto) d += this.rgSlow(T, ms, n);   // v628 원거리는 「처치가 느림」도 센다
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
  // v628 원거리(궁사 · 술사)는 거리를 벌려 싸워 잘 쓰러지지 않는다 — 그러면 자동 물러나기(한 칸에서 쓰러짐 RETREAT_DEATHS번)가 거의 안 일어나
  //   너무 앞선 칸에 눌러앉아 처치가 느려진다(봇: 분당 처치 −30%). 그래서 「칸이 레벨보다 앞서고 처치가 느림」도 쓰러짐 하나로 센다:
  //   그 칸 사냥 RANGED.retreat.winMs마다 그동안 처치가 kills마리 아래면 1. 근접은 부르지 않는다(예전 그대로) · 세이브 칸 T.rg*는 여기서 생긴다
  rgSlow(T, ms, n) {
    if (T.rgIdx !== T.idx) { T.rgIdx = T.idx; T.rgMs = 0; T.rgK = 0; }
    T.rgMs = (T.rgMs || 0) + ms; T.rgK = (T.rgK || 0) + n;
    if (T.rgMs < RANGED.retreat.winMs) return 0;
    const slow = T.rgK < RANGED.retreat.kills && T.idx > this.S.hero.lv ? 1 : 0;
    T.rgMs = 0; T.rgK = 0;
    return slow;
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
    if (S.qDay !== d) { this.mailMissed('daily'); S.qDay = d; this.books.daily.reset(DAILY_MISSIONS.map((m) => m.id)); S.dungeons = { day: d, runs: {}, best: S.dungeons?.best || {} }; /* v581 소탕 열림(best)은 날이 바뀌어도 남긴다 */ S.wallet['ticket:exped'] = (S.wallet['ticket:exped'] || 0) + 1; this.emit('login'); }
    if (S.qWeek !== w) { this.mailMissed('weekly'); S.qWeek = w; this.books.weekly.reset(WEEKLY_MISSIONS.map((m) => m.id)); }
    OF.touch(S.offline, nowMs);
    this.bfTick();   // v634 단약이 끝나면 싸움 스탯을 다시
  }
  // 1분마다 돌발 미션 판정(화면이 부른다)
  minute() { const s = ID.suddenTick(this.S.sudden, this.rng, this.now); if (s) this.feed.push({ k: 'sudden', need: s.need }); this.achSync(); return s; }

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
  // v631 장비 비교는 실제 전투력으로 — 그 칸에 it를 끼면(null이면 빈 칸) 전투력(셈만 하고 바로 되돌림 · 칸 강화 · 성혼 · 세트까지 그대로)
  //   v632 「종합」 = 사냥 전투력 × (1 + w × 보스 피해‰/1000) — 전투력은 보스 피해를 안 세서, 그것만 보면 장 두목에 약한 장비를 골랐다
  gearVal() { const f = this.fighter(false); return Math.round(power(f, 'pve') * (1 + (GEAR_BOSS.w * (f.st.bossDmg || 0)) / 1000)); }
  gearPw(it, sl = it?.slot) { const G = this.S.gear, prev = G.eq[sl]; G.eq[sl] = it || null; try { return this.gearVal(); } finally { G.eq[sl] = prev; } }
  // it가 cur보다 나을 수 없음(등급이 높지 않고 스탯이 모두 같거나 낮음) — 전투력을 셀 필요 없이 거른다
  gearDom(it, cur) {
    if (!cur || it.g > cur.g) return false;
    const S2 = this.S.gear.slots[it.slot], L = this.S.hero.lv, a = GR.itemStats(it, S2, L), b = GR.itemStats(cur, S2, L);
    for (const k of Object.keys(a)) if ((a[k] || 0) > (b[k] || 0)) return false;
    return true;
  }
  // it를 끼면 지금 그 칸보다 전투력이 얼마나 바뀌나(낀 것이면 0)
  gearDelta(it) { const cur = this.S.gear.eq[it.slot]; if (cur === it) return 0; return this.gearPw(it, it.slot) - this.gearPw(cur, it.slot); }
  gearBetter(it, cur) { return !this.gearDom(it, cur) && this.gearPw(it, it.slot) > this.gearPw(cur, it.slot); }
  // v631 새로 낀 장비(저절로 · 모두 끼기) — 칸마다 { g, up, fg, fup(전 것 · 없으면 -1), dp } · 장비 창에서 보면 화면이 지운다
  gearNews() { return (this.S.gearNew ??= {}); }
  gearNewMark(slot, to, from, dp, src) {
    const N = this.gearNews(), o = N[slot];
    N[slot] = { g: to.g, up: to.up ? 1 : 0, fg: o ? o.fg : from ? from.g : -1, fup: o ? o.fup : from?.up ? 1 : 0, dp: Math.round((o ? o.dp : 0) + dp) };
    this.feed.push({ k: 'gear-eq', slot, g: to.g, up: to.up ? 1 : 0, fg: from ? from.g : -1, dp: Math.round(dp), src });
  }
  // v631 최고 장비 모두 끼기 — 칸마다 가방에서 실제 전투력이 가장 높은 것(바뀐 칸 수)
  equipBest(src = 'best') {
    const G = this.S.gear, log = [];
    const o = { log, score: (it, sl) => (it && G.eq[sl] && it !== G.eq[sl] && this.gearDom(it, G.eq[sl]) ? -Infinity : this.gearPw(it, sl)) };
    let n = 0;
    for (let i = 0; i < 3; i++) { const k = GR.equipBest(G, this.S.hero.lv, o); n += k; if (!k) break; }   // 세트가 바뀌면 다른 칸 답도 바뀐다 — 한두 번 더
    if (!n) return 0;
    this.dirtyStats = true; this.emit('equip');
    for (const x of log) this.gearNewMark(x.slot, x.to, x.from, x.dv, src);
    return n;
  }
  // v631 일괄 분해 대상 — 낀 것보다 세지 않은 것(실제 전투력)
  gearJunk(maxG = 6) { const keep = this.outfitUids(); return GR.junkOf(this.S.gear, this.S.hero.lv, maxG, (it, cur) => this.gearBetter(it, cur)).filter((it) => !keep.has(it.uid)); }   // v634 차림에 적힌 것은 빼고
  obtain(items, src = 'drop') {
    { const sn = (this.S.lookSeen ??= {}); for (const it of items) if (it && it.slot && it.g > (sn[it.slot] ?? -1)) sn[it.slot] = it.g; }   // v565
    const dps = new Map();
    const got = GR.obtain(this.S.gear, items, this.S.hero.lv, this.S.wallet, (it, cur) => {
      if (this.gearDom(it, cur) || this.outfitHold()) return false;   // v634 차림을 입고 있으면 빈 칸만
      const d = this.gearPw(it, it.slot) - this.gearPw(cur, it.slot);
      if (d > 0) dps.set(it, d);
      return d > 0;
    });
    if (got.some((g) => g.equipped)) { this.dirtyStats = true; this.emit('equip'); }
    for (const x of got) if (x.equipped) { x.dp = Math.round(dps.get(x.it) ?? (this.gearPw(x.it) - this.gearPw(null, x.it.slot))); this.gearNewMark(x.it.slot, x.it, x.from, x.dp, src); }
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
  // 뽑기 조각(분해하면 나옴) → 장비 뽑기권. 모자라면 null
  shardExchange() {
    const W = this.S.wallet, n = Math.floor((W['item:shard'] || 0) / SHARD_PER_TICKET);
    if (n < 1) return null;
    W['item:shard'] -= n * SHARD_PER_TICKET; W['ticket:gear'] = (W['ticket:gear'] || 0) + n;
    this.emit('shard', { n });
    return { tickets: n, left: W['item:shard'] };
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
  // ── v634 차림(셋) ── 장비(uid · gear.js 프리셋 칸과 같이 적음) · 무공 칸 · 자동/수동 · 병기 · 동료 · 영물을 한 벌로 적고 갈아입는다
  //   hunt/boss: 사냥 · 두목 싸움(칸 두목 · 토벌 · 탑 · 월드보스 · 문파 토벌 · 전직)에 걸어 둔 차림(-1 = 없음) — 두목 싸움이 끝나면 되돌린다(ret)
  //   cur: 입은 차림(-1 = 없음) — 입고 있으면 장비 저절로 끼기(주운 것 · 자동 성장)를 쉰다(빈 칸만 채움). 「벗기」로 다시
  outfitSt() {
    const O = (this.S.outfit ??= {});
    if (!Array.isArray(O.sets) || O.sets.length !== OUTFIT_N) O.sets = Array.from({ length: OUTFIT_N }, (_, i) => O.sets?.[i] ?? null);
    if (!Array.isArray(O.names) || O.names.length !== OUTFIT_N) O.names = Array.from({ length: OUTFIT_N }, (_, i) => O.names?.[i] || `차림 ${i + 1}`);
    for (const k of ['hunt', 'boss', 'cur']) if (!Number.isInteger(O[k]) || O[k] < -1 || O[k] >= OUTFIT_N || (O[k] >= 0 && !O.sets[O[k]])) O[k] = -1;
    O.ret ??= null;
    return O;
  }
  outfitSnap() {
    const K = this.hero.kitState();
    return { gear: Object.fromEntries(SLOTS.map((s) => [s, this.S.gear.eq[s]?.uid ?? null])), kit: { slots: [...K.slots], off: [...K.off] }, coll: Object.fromEntries(COLLECTS.map((s) => [s, [...this.S.colls[s].eq]])) };
  }
  // 한 벌 입기 — 없어진 장비(분해 등) · 안 배운 무공 · 없는 동료는 건너뛰고 지금 것을 둔다 · 건너뛴 장비 수
  outfitApply(P) {
    const G = this.S.gear, K = this.hero.kitState(); let miss = 0;
    for (const s of SLOTS) {
      const uid = P.gear?.[s]; if (uid == null || G.eq[s]?.uid === uid) continue;
      const it = G.bag.find((x) => x.uid === uid);
      if (it && it.slot === s) GR.equip(G, uid); else miss++;
    }
    if (P.kit) { const sl = (P.kit.slots || []).filter((id) => K.lv[id]); if (sl.length) { K.slots = sl; K.off = (P.kit.off || []).filter((id) => K.lv[id]); } }
    for (const sys of COLLECTS) {
      const C = this.S.colls[sys], want = P.coll?.[sys]; if (!Array.isArray(want)) continue;
      const used = new Set(), eq = C.eq.map((_, i) => { const k = want[i]; if (k == null || !C.own[k] || used.has(k)) return null; used.add(k); return k; });
      const rest = Object.keys(C.own).map(Number).filter((k) => !used.has(k)).sort((a, b) => CL.kindGrade(sys, b) - CL.kindGrade(sys, a) || C.own[b].awk - C.own[a].awk || C.own[b].lv - C.own[a].lv);
      C.eq = eq.map((k) => k ?? rest.shift() ?? null);   // 빈 칸은 좋은 것부터
      C.man = true;   // v635 차림으로 입은 동료 · 영물 · 병기는 「직접 고름」 — 다음 뽑기의 추천 자동이 덮어쓰지 않게
    }
    this.dirtyStats = true;
    return miss;
  }
  outfitSave(i) {
    const O = this.outfitSt(); if (!(i >= 0 && i < OUTFIT_N)) return false;
    GR.savePreset(this.S.gear, i); const p = this.outfitSnap(); p.gear = { ...this.S.gear.presets[i] };
    O.sets[i] = p; O.cur = i; return true;
  }
  outfitLoad(i) {
    const O = this.outfitSt(); if (!(i >= 0 && i < OUTFIT_N) || !O.sets[i] || this.bossFight || this.dg) return null;
    const miss = this.outfitApply(O.sets[i]); O.cur = i; O.ret = null;
    return { miss };
  }
  outfitOff() { const O = this.outfitSt(); if (O.cur < 0) return false; O.cur = -1; return true; }
  outfitName(i, s) { const O = this.outfitSt(), t = String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 8); if (!(i >= 0 && i < OUTFIT_N) || !t) return false; O.names[i] = t; return true; }
  // 걸기 — k 'hunt' | 'boss' · i -1이면 풀기. 사냥 차림을 걸면 (싸움 밖이면) 바로 입는다
  outfitUse(k, i) {
    const O = this.outfitSt(); if ((k !== 'hunt' && k !== 'boss') || !Number.isInteger(i) || i < -1 || i >= OUTFIT_N || (i >= 0 && !O.sets[i])) return false;
    O[k] = i; if (k === 'hunt' && i >= 0 && !this.bossFight && !this.dg) this.outfitLoad(i);
    return true;
  }
  outfitHold() { const O = this.S.outfit; return !!O && Number.isInteger(O.cur) && O.cur >= 0 && !!O.sets?.[O.cur]; }
  outfitUids() { const u = new Set(); for (const p of this.S.outfit?.sets || []) for (const v of Object.values(p?.gear || {})) if (v != null) u.add(v); return u; }
  // 두목 싸움 들어갈 때(makeBoss · enterDungeon) — 두목 차림이 걸려 있으면 지금 것을 적어 두고 갈아입는다
  outfitGo() {
    const O = this.S.outfit; if (!O || !(O.boss >= 0) || !O.sets?.[O.boss]) return;
    if (!O.ret) O.ret = { snap: this.outfitSnap(), cur: O.cur };
    this.outfitApply(O.sets[O.boss]); O.cur = O.boss;
  }
  // 두목 싸움이 끝나면 — 사냥 차림이 걸려 있으면 그것, 아니면 들어가기 전 그대로
  outfitBack() {
    const O = this.S.outfit; if (!O?.ret) return;
    const R = O.ret; O.ret = null;
    if (O.hunt >= 0 && O.sets[O.hunt]) { this.outfitApply(O.sets[O.hunt]); O.cur = O.hunt; } else { this.outfitApply(R.snap); O.cur = R.cur ?? -1; }
  }
  // ── 기연 ── 사냥 처치가 칸을 채운다 · 차면 카드 셋 중 하나
  fate() { const f = (this.S.fate ??= { g: 0, ready: 0, n: 0, cards: null }); f.g ??= 0; f.ready ??= 0; f.n ??= 0; f.cards ??= null; return f; }
  fateKill(n) {
    const f = this.fate();
    if (f.ready >= FATE_CAP) return;
    f.g += n;
    while (f.g >= FATE_NEED && f.ready < FATE_CAP) { f.g -= FATE_NEED; f.ready++; this.feed.push({ k: 'fate' }); }
    if (f.ready >= FATE_CAP) f.g = 0;
  }
  fateState() { const f = this.fate(); return { g: f.g, need: FATE_NEED, ready: f.ready, cards: f.cards }; }
  fateAmount(k) {
    const L = this.S.hero.lv;
    if (k === 'gold') return Math.round(FATE_MIN * KILLS_PER_MIN * goldPerMob(L));
    if (k === 'exp') return Math.round(FATE_MIN * KILLS_PER_MIN * mobExp(L));
    if (k === 'item:stone') return 5 + Math.floor(L / 10);
    return FATE_CARDS.find((c) => c.k === k)?.n || 1;
  }
  fateOpen() {
    const f = this.fate();
    if (f.cards) return f.cards;
    if (f.ready <= 0) return null;
    const pool = FATE_CARDS.filter((c) => c.k !== 'exp' || this.S.hero.lv < LEVEL_MAX), cards = [];   // 만렙이면 경험치 카드는 빼고(받아도 0)
    for (let i = 0; i < 3; i++) { const c = pool.splice(this.rng.pick(pool.map((x) => x.w)), 1)[0]; cards.push({ k: c.k, n: this.fateAmount(c.k) }); }
    return (f.cards = cards);
  }
  fatePick(i) {
    const f = this.fate(), c = Number.isInteger(i) && Array.isArray(f.cards) ? f.cards[i] : null;   // 번호(0~2)만 — 'length' 같은 이름으로는 못 고른다
    if (!c || f.ready <= 0) return null;
    if (c.k === 'exp') this.addExp(c.n);
    else this.S.wallet[c.k] = (this.S.wallet[c.k] || 0) + c.n;
    f.cards = null; f.ready--; f.n++;
    this.emit('fate', { n: f.n });
    return c;
  }
  // v588 자동 성장(방치) — 받을 보상 받기 · 장비 뽑기권 쓰기 · 최고 장비 끼기 · 무공 모두 올리기 · 모두 강화. 은자로 뽑지는 않는다(뽑기권만)
  autoGrow(o = {}) {
    const S = this.S, out = { claim: 0, pull: 0, coll: 0, equip: 0, kit: 0, enh: 0, train: 0, daily: [] };
    // v589 하루 일도 — 출석 · 수련동 모두 소탕 · 원정 받고 다시 보내기(12시간) · 하루 상자(다 했으면)
    if (o.daily !== false) {
      if (this.canAttend() && this.attend()) out.daily.push('출석');
      const sw = this.sweepAll(); if (sw) out.daily.push(`소탕 ${sw.n}`);
      const E = S.exped; if (E.run && this.now >= E.run.endMs && this.claimExped()) out.daily.push('원정 받음');
      if (!E.run && this.startExped(12)) out.daily.push('원정 보냄');
      if (this.shopFreeCan() && this.shopBuy(SHOP_FREE)) out.daily.push('상점 덤');   // 덤만 — 은자로는 사지 않는다
    }
    if (o.claim !== false) {
      for (let i = 0; i < 30 && this.claimGuide(); i++) out.claim++;
      for (const [b, B] of Object.entries(this.books)) for (const id of B.claimable()) if (this.claimMission(b, id)) out.claim++;
      for (let i = 0; i < FATE_CAP && this.fateOpen(); i++) if (this.fatePick(0)) out.claim++; else break;   // 기연 — 첫 카드
      out.claim += this.passClaimAll().length;   // 강호 패스 — 받을 수 있는 단 모두
      for (let i = 0; i < BOUNTY_SLOTS.length; i++) if (this.bountyClaim(i)) out.claim++;   // 현상수배 — 끝낸 것 · 상자
      if (this.bountyChest()) out.claim++;
      out.claim += this.towerMsClaimAll().length;   // v616 탑 이정표 상자
      out.claim += this.lvBoxClaimAll().length;   // v634 성장 봇짐
    }
    if (o.pull !== false) {
      this.shardExchange();   // 분해로 모인 뽑기 조각부터 뽑기권으로
      for (let i = 0; i < 100 && (S.wallet['ticket:gear'] || 0) >= 10; i++) if (this.pullGear(10, true)) out.pull += 10; else break;
      for (let i = 0; i < 10 && (S.wallet['ticket:gear'] || 0) >= 1; i++) if (this.pullGear(1, true)) out.pull++; else break;
    }
    // v591 병기 · 동료 · 영물 뽑기권도(뽑기권만 — 각성 · 끼기는 뽑기가 알아서)
    if (o.coll !== false) for (const sys of COLLECTS) {
      for (let i = 0; i < 100 && (S.wallet[`ticket:${sys}`] || 0) >= 10; i++) if (this.pullCollect(sys, 10)) out.coll += 10; else break;
      for (let i = 0; i < 10 && (S.wallet[`ticket:${sys}`] || 0) >= 1; i++) if (this.pullCollect(sys, 1)) out.coll++; else break;
    }
    if (o.buff === true) out.buff = this.bfEatAll().length;   // v634 단약 자동(설정에서 켤 때만 · 기본은 먹지 않는다)
    if (!this.outfitHold() && this.equipBest('auto')) out.equip = 1;   // v634 차림을 입고 있으면 쉰다   // v631 실제 전투력으로
    if (o.kit !== false) { const k = this.kitUpAll(); if (k) out.kit = k.n; }
    if (o.enh !== false) { const e = this.enhanceAll(); if (e) out.enh = e.ok; }
    // v592 수련 — 배울 수 있는 마스터리 · 경지 돌파(은자가 되는 만큼, 강화 뒤에)
    if (o.stat !== false) out.train += this.statAuto();   // 남은 스탯 점수는 고르게(공짜 — v609 은자 아끼기(train 끔)여도 찍는다)
    if (o.train !== false) {
      for (const m of MASTERY) if (this.learn(m.id)) out.train++;
      for (let i = 0; i < 10 && this.realmUp(); i++) out.train++;
    }
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
    CL.autoAwaken(C); if (!CL.isManual(C)) CL.autoEquipBest(C); this.dirtyStats = true;   // v635 직접 고름이면 낀 것 그대로
    this.emit('pull', { sys: COLLECTS.indexOf(sys) + 1, n });
    this.emit('coll', { n: this.collKinds() });
    return got;
  }
  // v635 고유 기질 — 무공 쿨(cdr)은 무공 쿨에 바로 · 손으로 끼기/빼기 · 추천 자동 · 끼면 전투력 미리 보기
  traitKit(f) { const c = Math.min(CDR_CAP, f.st.cdr || 0); if (c > 0) f.kit = f.kit.map((k) => (k.cdMs ? { ...k, cdMs: Math.round(k.cdMs * (1000 - c) / 1000) } : k)); return f; }
  collEquip(sys, slot, k) { const C = this.S.colls[sys]; if (!C || !CL.equipAt(C, slot, k)) return false; this.dirtyStats = true; return true; }
  collAuto(sys, on) { const C = this.S.colls[sys]; if (!C) return false; CL.setAutoEquip(C, on); this.dirtyStats = true; return true; }
  collPreview(sys, slot, k) {
    const C = this.S.colls[sys], eq0 = [...C.eq], man0 = C.man, pw0 = this.power();
    if (!CL.equipAt(C, slot, k)) return { pw0, pw1: pw0, same: true };
    const pw1 = this.power(); C.eq = eq0; if (man0) C.man = man0; else delete C.man;
    return { pw0, pw1 };
  }
  // ── 무공 강화 트리 ── 점수는 레벨 · 가장 멀리 간 칸에서
  treeUp(id, n) { const r = this.hero.treeUp(id, n, this.now, this.stage().top); if (r) { this.dirtyStats = true; this.emit('skill'); } return r; }
  treeReset() { const r = this.hero.treeReset(this.S.wallet, this.stage().top); if (r) this.dirtyStats = true; return r; }
  treePts() { return this.hero.treePts(this.stage().top); }
  treeVar(id, v) { const r = this.hero.treeVar(id, v); if (r) { this.dirtyStats = true; this.emit('skill'); } return r; }   // v632 무공 변형 고르기
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
  // v616 탑 이정표 상자 — 10층마다 처음 깨면 한 번(옛 세이브: 이미 깬 층의 상자도 받을 수 있다). 받은 층은 S.tower.ms
  towerSt() { const T = (this.S.tower ??= { best: 0 }); if (!Array.isArray(T.ms)) T.ms = []; return T; }
  towerMsState() { const T = this.towerSt(); return towerMsFloors().map((floor) => ({ floor, reward: towerMsReward(floor), state: T.ms.includes(floor) ? 'got' : floor <= T.best ? 'can' : 'lock' })); }
  towerMsCan() { const T = this.towerSt(); return towerMsFloors().filter((f) => f <= T.best && !T.ms.includes(f)).length; }
  towerMsClaim(floor) {
    const T = this.towerSt(), R = towerMsReward(floor), W = this.S.wallet;
    if (!R || floor > T.best || T.ms.includes(floor)) return null;
    T.ms.push(floor);
    for (const [k, n] of Object.entries(R)) W[k] = (W[k] || 0) + n;
    return { floor, give: { ...R } };
  }
  towerMsClaimAll() { const out = []; const T = this.towerSt(); for (const f of towerMsFloors()) { if (f > T.best) break; const r = this.towerMsClaim(f); if (r) out.push(r); } return out; }
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
  // ── 상점 ── 날마다 은자로 사는 물건(tables/shop.js) · 하루 살 수 있는 수 · 날이 바뀌면 새로. 덤은 값 없이 하루 한 번
  shopSt() { const S = this.S, dk = dayKey(this.now); if (!S.shop || S.shop.day !== dk) S.shop = { day: dk, bought: {} }; S.shop.bought ??= {}; return S.shop; }   // 옛 세이브도 여기서 생긴다
  shopState() {
    const B = this.shopSt().bought, lv = this.S.hero.lv, gold = this.S.wallet.gold || 0;
    return SHOP.map((s) => { const cost = s.cost(lv), left = Math.max(0, s.limit - (B[s.id] || 0)); return { id: s.id, name: s.name, give: s.give, cost, limit: s.limit, left, can: left > 0 && gold >= cost }; });
  }
  shopFreeCan() { return !(this.shopSt().bought[SHOP_FREE] > 0); }
  // n개 산다(남은 수 · 은자가 모자라면 하나도 사지 않는다) → 받은 것 { give: { 종류: 양 }, gold: 쓴 은자, n }
  shopBuy(id, n = 1) {
    const s = shopById(id), T = this.shopSt(); n = Math.floor(n);
    if (!s || !(n >= 1) || (T.bought[id] || 0) + n > s.limit) return null;
    const gold = s.cost(this.S.hero.lv) * n;
    if (gold > 0 && !pay(this.S.wallet, [{ k: 'gold', n: gold }])) return null;
    const give = Object.fromEntries(Object.entries(s.give).map(([k, v]) => [k, v * n]));
    gain(this.S.wallet, Object.entries(give).map(([k, v]) => ({ k, n: v })));
    T.bought[id] = (T.bought[id] || 0) + n;
    this.emit('shop', { n, free: T.bought[SHOP_FREE] > 0 ? 1 : 0 });
    return { give, gold, n };
  }
  // ── v635 교환소 ── 명성(대결) · 공적(문파) · 혈전패(월드보스)로 바꾸기(tables/exchange.js) · 물건마다 주간 한도 · 재화는 넘어간다
  exSt() { const S = this.S, wk = weekKey(this.now); if (!S.ex || S.ex.wk !== wk) S.ex = { wk, bought: {} }; S.ex.bought ??= {}; return S.ex; }   // 옛 세이브도 여기서 생긴다
  exCoin(cur) { const c = EX_CUR[cur]; return c ? Math.max(0, this.S.wallet[c.key] || 0) : 0; }
  exEarn(cur, n) { const c = EX_CUR[cur]; n = Math.max(0, Math.floor(n || 0)); if (!c || !n) return 0; this.S.wallet[c.key] = (this.S.wallet[c.key] || 0) + n; return n; }
  exWbRank(rank) { return rank > 0 ? EX_EARN.blood.week.find(([n]) => rank <= n)[1] : 0; }
  exState(cur) {
    const B = this.exSt().bought, have = this.exCoin(cur);
    return (EXCHANGE[cur] || []).map((x) => { const left = Math.max(0, x.limit - (B[`${cur}:${x.id}`] || 0)); return { id: x.id, name: x.name, give: x.give, price: x.price, limit: x.limit, left, can: left > 0 && have >= x.price }; });
  }
  // n개 바꾼다(한도 · 재화가 모자라면 하나도 안 바꾼다) → { give, paid, n }
  exBuy(cur, id, n = 1) {
    const x = exItem(cur, id), c = EX_CUR[cur], T = this.exSt(), k = `${cur}:${id}`; n = Math.floor(n);
    if (!x || !c || !(n >= 1) || (T.bought[k] || 0) + n > x.limit) return null;
    const paid = x.price * n;
    if (!pay(this.S.wallet, [{ k: c.key, n: paid }])) return null;
    const give = Object.fromEntries(Object.entries(x.give).map(([g, v]) => [g, v * n]));
    gain(this.S.wallet, Object.entries(give).map(([g, v]) => ({ k: g, n: v })));
    T.bought[k] = (T.bought[k] || 0) + n;
    return { give, paid, n };
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
    if (type !== 'daily') this.outfitGo();   // v634 탑 · 월드보스 · 문파 토벌 · 전직은 두목 차림
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
    this.dg = null; this.dirtyStats = true; this.outfitBack();   // v634
    if (cleared && d.type === 'daily') {
      const R = DAILY_DUNGEONS[d.kind].reward;
      if (R.expMin) { out.exp = Math.round(R.expMin * KILLS_PER_MIN * mobExp(L, 'mob', L)); this.addExp(out.exp); }
      if (R.goldMin) { out.gold = Math.round(R.goldMin * KILLS_PER_MIN * goldPerMob(L)); S.wallet.gold += out.gold; }
      if (R.gearTickets) { out.tix = R.gearTickets; S.wallet['ticket:gear'] = (S.wallet['ticket:gear'] || 0) + out.tix; }
      if (R.stones) { out.stones = R.stones; S.wallet['item:stone'] = (S.wallet['item:stone'] || 0) + out.stones; }
      (S.dungeons.best ??= {})[d.kind] = true;
      this.emit('dungeon', { kind: 1 });
    } else if (cleared && d.type === 'tower') { const T = this.towerSt(); T.best = Math.max(T.best, d.floor); if (towerMsReward(d.floor) && !T.ms.includes(d.floor)) out.chest = d.floor; }
    else if (d.type === 'wboss') {   // 나가도 넣은 만큼은 점수
      const W = S.wb, dmg = Math.round(F.dmgOut * WBF.sideX), score = WB.bossScore(dmg, L);
      W.total += score; W.best = Math.max(W.best, score); out.dmg = dmg; out.score = score; out.best = W.best; out.total = W.total;
      out.blood = this.exEarn('blood', EX_EARN.blood.try);   // v635 혈전패
      this.emit('wboss');
    }
    else if (d.type === 'graid') { out.dmg = Math.round(F.dmgOut * WBF.sideX); out.ch = d.ch; out.merit = this.exEarn('merit', EX_EARN.merit.graidTry); this.emit('graid'); }   // v550 나가도 넣은 만큼
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
  // 덱 하나 고르기 — 있을 수 없는 덱이면 null · 쓸 것만 남긴 모양({ uid, name, f, score, lk })으로
  deckClean(x) {
    const f = x && x.f, st = f && f.st;
    if (!f || !JOBS[f.job] || !Number.isInteger(f.lv) || f.lv < 1 || f.lv > LEVEL_MAX || !st || !(st.atk > 0) || !(st.hp > 0) || !Object.values(st).every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
    if (!(power(f, 'pvp') <= stdPower(f.lv, 'pvp', f.job) * POWER_SLACK * 2)) return null;
    return { uid: String(x.uid), name: String(x.name || '무인').slice(0, 12), f: { lv: f.lv, job: f.job, kind: 'hero', st: f.st }, score: x.score | 0,
      lk: Object.fromEntries(Object.entries(f.lk || {}).filter(([sl, gr]) => SLOTS.includes(sl) && Number.isInteger(gr) && gr >= 0 && gr <= 6)) };   // v566 외형(있는 칸 · 0~6만)
  }
  setPvpReal(list) {
    this.pvpReal = (list || []).map((x) => this.deckClean(x)).filter(Boolean).slice(0, 3);
    return this.pvpReal.length;
  }
  // ── 동행 토벌 ── 오늘 남은 횟수 · 깬 최고 단계 · 다음 단계
  partyRec() { const S = this.S, dk = dayKey(this.now), P = (S.party ??= { day: dk, runs: 0, best: 0 }); if (P.day !== dk) { P.day = dk; P.runs = 0; } return P; }
  partyState() { const P = this.partyRec(); return { left: Math.max(0, PARTY.runsPerDay - P.runs), best: P.best, tier: P.best + 1 }; }
  deckPower(d) { return d && d.f ? power(d.f, 'pve') : 0; }   // 덱의 사냥 전투력(화면에 보이는 값)
  // 연습 동행 셋(서버 없이 · 내 레벨 근처 기준 무인) — 날마다 직업이 돈다
  partyBots() {
    const L = this.S.hero.lv, seed = dayKey(this.now);
    return ['낭인', '협객', '고수'].map((name, i) => {
      const f = refPlayer(Math.max(1, Math.min(LEVEL_MAX, Math.round(L * (0.95 + 0.05 * i)))), ['sword', 'spear', 'fist', 'bow', 'mage'][(seed + i * 2) % 5] || 'sword');
      return { uid: `bot${i}`, name, f: { lv: f.lv, job: f.job, kind: 'hero', st: f.st }, pw: power(f, 'pve'), bot: true };
    });
  }
  // 한 번 싸우기 — tier: 1 ~ 최고 + 1 · allies: 덱 0~2개(대결 덱과 같은 모양 { uid, name, f: { lv, job, st, lk } })
  //   싸우면 이기든 지든 오늘 횟수 하나(문파 토벌처럼 — 져도 얼마나 모자랐는지 보이므로 공짜로 되풀이하지 못하게)
  //   → { cleared, timeMs, share: [나 %, 동행1 %, 동행2 %], rewards: { tix, stones, pal, first } | null, ... }
  partyFight(tier, allies = []) {
    const P = this.partyRec(); tier = tier | 0;
    if (P.runs >= PARTY.runsPerDay || tier < 1 || tier > P.best + 1 || this.dg || this.bossFight) return null;
    const team = (Array.isArray(allies) ? allies : []).slice(0, PARTY.allies).map((x) => this.deckClean(x)).filter(Boolean)
      .filter((a, i, T) => T.findIndex((b) => b.uid === a.uid) === i);   // 같은 무인을 두 번 데려갈 수는 없다
    // 동행은 그 레벨 표준 무공 세트로 친다(덱에는 능력치만 있다)
    const fs = team.map((a) => ({ ...refPlayer(a.f.lv, a.f.job), st: a.f.st }));
    const lv = partyLv(tier), r = runParty({ mobLv: lv, hpX: partyHpX(tier), timeMs: PARTY.timeMs }, this.fighter(), fs, this.rng.u32());
    P.runs++; this.passAdd(PASS_PTS.party);   // 강호 패스 점수(이기든 지든 한 번)
    const sum = r.dmg.reduce((a, b) => a + b, 0) || 1, share = r.dmg.map((d) => Math.round((d * 1000) / sum) / 10);
    let rewards = null;
    if (r.cleared) {
      const first = tier > P.best, RW = first ? PARTY.rew.first : PARTY.rew.again, W = this.S.wallet;
      if (first) P.best = tier;
      W['ticket:gear'] = (W['ticket:gear'] || 0) + RW.tix; W['item:stone'] = (W['item:stone'] || 0) + RW.stones;
      if (RW.pal) W['ticket:pal'] = (W['ticket:pal'] || 0) + RW.pal;
      rewards = { tix: RW.tix, stones: RW.stones, pal: RW.pal, first };
      this.emit('party', { n: P.best });   // v612 업적 · 길잡이
    }
    return { cleared: r.cleared, timeMs: r.timeMs, share, rewards, tier, lv, dmg: r.dmg, hp0: r.hp0, deaths: r.deaths, left: PARTY.runsPerDay - P.runs,
      allies: team.map((a) => ({ name: a.name, job: a.f.job, lv: a.f.lv, lk: a.lk || null })) };
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
    const f = this.fighter(false), E = this.lookEq(), lk = {}; for (const sl of SLOTS) if (E[sl]) lk[sl] = E[sl].g;
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
    const fame = this.exEarn('fame', r.win ? EX_EARN.fame.win : EX_EARN.fame.lose);   // v635 명성
    return { ...r, d, fame, score: P.score, tier: PV.tierOf(P.score).name, log, opp: { name: opp.name, job: opp.f.job, lv: opp.f.lv, hp: opp.f.st.hp, real: !!opp.real, lk: opp.lk || null }, myHp: me.st.hp, oppUid: opp.uid || null, defD: sd.def };
  }
  // ── 강호 패스 ── 4주 시즌 · 놀면 점수(하루 150점까지) · 100점마다 한 단 · 서른 단(tables/pass.js). 값 없이 누구나
  //   시즌이 바뀌면 처음부터(안 받은 보상은 사라진다) · 옛 세이브도 여기서 생긴다
  passSt() {
    const S = this.S, se = passSeason(this.now), dk = dayKey(this.now), P = (S.pass ??= { season: se, pts: 0, day: dk, dayPts: 0, got: [] });
    if (P.season !== se) Object.assign(P, { season: se, pts: 0, day: dk, dayPts: 0, got: [] });
    if (P.day !== dk) { P.day = dk; P.dayPts = 0; }
    if (!Array.isArray(P.got)) P.got = [];
    return P;
  }
  // 점수 더하기(안에서만 부른다) — 하루 상한 · 시즌 끝(서른 단)까지만 → 실제로 오른 점수
  passAdd(n) {
    const P = this.passSt(), add = Math.max(0, Math.min(Math.floor(n) || 0, PASS.dayCap - P.dayPts, PASS.tiers * PASS.need - P.pts));
    const t0 = Math.floor(P.pts / PASS.need);
    P.pts += add; P.dayPts += add;
    if (Math.floor(P.pts / PASS.need) > t0) this.emit('pass', { n: this.passTier(), got: P.got.length });   // v612 단이 오르면 업적
    return add;
  }
  passState() {
    const P = this.passSt(), tier = Math.min(PASS.tiers, Math.floor(P.pts / PASS.need));
    return { season: P.season, no: Math.max(1, P.season - PASS.first + 1), endsInMs: Math.max(0, passEndMs(P.season) - this.now), pts: P.pts, tier, need: PASS.need, into: tier >= PASS.tiers ? PASS.need : P.pts % PASS.need,
      dayPts: P.dayPts, dayCap: PASS.dayCap, rewards: PASS_REWARDS.map((reward, i) => ({ tier: i + 1, reward, state: P.got.includes(i + 1) ? 'got' : i + 1 <= tier ? 'can' : 'lock' })) };
  }
  passCan() { return this.passState().rewards.filter((r) => r.state === 'can').length; }
  // 한 단 받기 → { tier, give: { 종류: 양 }, gold } (아직 못 닿았거나 이미 받았으면 null)
  passClaim(tier) {
    const P = this.passSt(), R = PASS_REWARDS[tier - 1], W = this.S.wallet;
    if (!Number.isInteger(tier) || !R || tier > Math.floor(P.pts / PASS.need) || P.got.includes(tier)) return null;
    P.got.push(tier);
    this.emit('pass', { n: this.passTier(), got: P.got.length });
    const out = { tier, give: {}, gold: 0 };
    for (const [k, n] of Object.entries(R)) {
      if (k === 'goldMin') { out.gold = Math.round(n * KILLS_PER_MIN * goldPerMob(this.S.hero.lv)); W.gold = (W.gold || 0) + out.gold; }
      else { W[k] = (W[k] || 0) + n; out.give[k] = n; }
    }
    return out;
  }
  passClaimAll() { const out = []; for (let t = 1; t <= PASS.tiers; t++) { const r = this.passClaim(t); if (r) out.push(r); } return out; }
  // ── 현상수배(날마다 사냥 목표 셋 · tables/bounty.js) ── 그날 처음 볼 때 만든다(옛 세이브도). 난수는 그날 씨앗으로 따로(this.rng는 그대로)
  bountySt() {
    const S = this.S, dk = dayKey(this.now);
    if (S.bounty && S.bounty.day === dk && Array.isArray(S.bounty.list)) return S.bounty;
    if (S.bounty && Array.isArray(S.bounty.list)) this.mailBounty(S.bounty);   // v635 어제 끝내고 안 받은 것 → 우편
    const r = new Rng(bountySeed(dk, S.seed)), top = Math.max(1, Math.min(LEVEL_MAX, this.stage().top || 1)), pick = (a) => a[r.int(a.length)];
    const list = BOUNTY_SLOTS.map((kind) => {
      const T = BOUNTY_T[kind];
      let target = 0, need;
      if (kind === 'boss') need = pick(T.n);
      else { need = Math.max(T.unit, Math.round(pick(T.min) * KILLS_PER_MIN / T.unit) * T.unit); if (kind === 'stage') target = Math.max(1, top - r.int(T.back + 1)); }
      const ex = pick(BOUNTY_REW.extra);
      return { kind, target, need, n: 0, done: false, got: false, rew: { k: ex.k, n: pick(ex.n) } };
    });
    S.bounty = { day: dk, list, chest: false, coll: pick(BOUNTY_CHEST.coll) };
    return S.bounty;
  }
  // 사냥이 부른다 — 몹 하나(종류 · 칸) 또는 칸 두목 깸(stageWin). 끝나는 순간 화면 알림(feed)
  bountyHit(kind, L, stageWin = false) {
    const B = this.bountySt();
    B.list.forEach((x, i) => {
      if (x.done) return;
      const hit = x.kind === 'boss' ? (stageWin || kind === 'boss') : !stageWin && (x.kind === 'kill' || L >= x.target);
      if (!hit) return;
      x.n = Math.min(x.need, x.n + 1);
      if (x.n >= x.need) { x.done = true; this.feed.push({ k: 'bounty', i, all: B.list.every((y) => y.done) }); }
    });
  }
  bountyGold() { return Math.round(BOUNTY_REW.goldMin * KILLS_PER_MIN * goldPerMob(this.S.hero.lv)); }
  bountyState() {
    const B = this.bountySt(), gold = this.bountyGold(), all = B.list.every((x) => x.done);
    const list = B.list.map((x, i) => {
      const o = { i, kind: x.kind, target: x.target, need: x.need, n: x.n, done: x.done, got: x.got, gold, rew: { ...x.rew }, can: x.done && !x.got };
      if (x.kind === 'stage') { const ch = Math.ceil(x.target / 10), R = ROSTER[ch - 1] || ROSTER[0], m = R.mobs.find((a) => a[1].startsWith('s2:')) || R.mobs[0]; Object.assign(o, { ch, k: ((x.target - 1) % 10) + 1, mob: m[0], art: m[1] }); }
      else if (x.kind === 'boss') { const ch = Math.max(1, Math.min(ROSTER.length, Math.ceil((this.stage().top || 1) / 10))); Object.assign(o, { ch, mob: ROSTER[ch - 1].boss[0], art: ROSTER[ch - 1].boss[1] }); }
      return o;
    });
    return { day: B.day, list, chest: { got: !!B.chest, can: all && !B.chest, give: { 'ticket:gear': BOUNTY_CHEST['ticket:gear'], [B.coll]: 1 } }, left: B.list.filter((x) => !x.done).length };
  }
  bountyCan() { const s = this.bountyState(); return s.list.filter((x) => x.can).length + (s.chest.can ? 1 : 0); }
  // 하나 받기 → { i, gold, give } (안 끝났거나 받았으면 null)
  bountyClaim(i) {
    const B = this.bountySt(), x = Number.isInteger(i) ? B.list[i] : null, W = this.S.wallet;
    if (!x || !x.done || x.got) return null;
    x.got = true;
    const gold = this.bountyGold(), k = x.rew?.k, n = Math.max(0, Math.floor(x.rew?.n) || 0);
    W.gold = (W.gold || 0) + gold;
    if (k && n) W[k] = (W[k] || 0) + n;
    return { i, gold, give: k && n ? { [k]: n } : {} };
  }
  // 상자 — 셋 다 끝내면 한 번
  bountyChest() {
    const B = this.bountySt(), W = this.S.wallet;
    if (B.chest || !B.list.every((x) => x.done)) return null;
    B.chest = true;
    const give = this.bountyChestGive(B);
    for (const [k, n] of Object.entries(give)) W[k] = (W[k] || 0) + n;
    return { give };
  }
  bountyChestGive(B) { return { 'ticket:gear': BOUNTY_CHEST['ticket:gear'], [BOUNTY_CHEST.coll.includes(B.coll) ? B.coll : 'ticket:weapon']: 1 }; }
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
    this.emit('login'); this.passAdd(PASS_PTS.attend);   // 강호 패스 점수
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
    this.bfOff = true; try { this.addExp(r.exp); } finally { this.bfOff = false; } this.S.wallet.gold += r.gold;   // v634 방치 보상엔 단약 없음
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
  // ── v634 단약(무료 시간 버프) ── S.bf = { day, used: { id: 오늘 먹은 수 }, end: { id: 끝나는 ms } } — 날이 바뀌면 먹은 수만 0으로(돌던 시간은 그대로)
  bfSt() {
    const B = (this.S.bf ??= { day: -1, used: {}, end: {} }), dk = dayKey(this.now);
    B.used ??= {}; B.end ??= {};
    if (B.day !== dk) { B.day = dk; B.used = {}; }
    return B;
  }
  bfLeftMs(id) { return Math.max(0, (this.bfSt().end[id] || 0) - this.now); }
  bfState() {
    const B = this.bfSt();
    return DANYAK.list.map((d) => { const leftMs = this.bfLeftMs(d.id); return { id: d.id, name: d.name, what: d.what, leftMs, on: leftMs > 0, uses: Math.max(0, DANYAK.uses - (B.used[d.id] || 0)), of: DANYAK.uses }; });
  }
  // 먹기 — 오늘 남은 수가 있으면 30분(켜져 있으면 끝나는 때에 30분 더) → { id, endMs, uses }
  bfEat(id) {
    const d = DANYAK.list.find((x) => x.id === id), B = this.bfSt();
    if (!d || (B.used[id] || 0) >= DANYAK.uses) return null;
    B.used[id] = (B.used[id] || 0) + 1;
    B.end[id] = Math.max(this.now, B.end[id] || 0) + DANYAK.ms;
    this.dirtyStats = true; this.bfKey = null;
    return { id, endMs: B.end[id], uses: DANYAK.uses - B.used[id] };
  }
  // 모두 먹기 — 꺼져 있고 오늘 남은 것만 하나씩(켜진 것은 늘이지 않는다)
  bfEatAll() { const out = []; for (const s of this.bfState()) if (!s.on && s.uses > 0) { const r = this.bfEat(s.id); if (r) out.push(r); } return out; }
  bfSources() {
    if (this.bfOff || !this.S.bf) return [];
    const E = this.S.bf.end || {}, st = {};
    for (const d of DANYAK.list) if ((E[d.id] || 0) > this.now) for (const [k, v] of Object.entries(d.stats)) st[k] = (st[k] || 0) + v;
    return Object.keys(st).length ? [{ src: 'danyak', stats: st }] : [];
  }
  // 켜지고 꺼짐이 바뀌면 싸움 스탯을 다시(tick에서)
  bfTick() { if (!this.S.bf) return; const k = DANYAK.list.map((d) => ((this.S.bf.end?.[d.id] || 0) > this.now ? 1 : 0)).join(''); if (k !== this.bfKey) { if (this.bfKey != null) this.dirtyStats = true; this.bfKey = k; } }
  // ── v634 성장 봇짐(레벨 상자) ──
  lvBoxSt() { const B = (this.S.lvBox ??= { got: [] }); if (!Array.isArray(B.got)) B.got = []; return B; }
  lvBoxState() { const B = this.lvBoxSt(), L = this.S.hero.lv; return lvBoxLevels().map((lv) => ({ lv, ...lvBoxReward(lv), state: B.got.includes(lv) ? 'got' : lv <= L ? 'can' : 'lock' })); }
  lvBoxCan() { const B = this.lvBoxSt(), L = this.S.hero.lv; return lvBoxLevels().filter((lv) => lv <= L && !B.got.includes(lv)).length; }
  lvBoxNext() { const L = this.S.hero.lv; return lvBoxLevels().find((lv) => lv > L) || 0; }
  lvBoxClaim(lv) {
    const B = this.lvBoxSt(), R = lvBoxReward(lv), W = this.S.wallet;
    if (!R || lv > this.S.hero.lv || B.got.includes(lv)) return null;
    B.got.push(lv);
    for (const [k, n] of Object.entries(R.give)) W[k] = (W[k] || 0) + n;
    let gear = null;
    if (R.gear >= 0) { const it = GR.makeGear(this.rng, SLOTS[this.rng.int(SLOTS.length)], R.gear); gear = { g: it.g, up: it.up, slot: it.slot }; this.obtain([it], 'lvbox'); }
    return { lv, give: { ...R.give }, gear };
  }
  lvBoxClaimAll() { const out = [], L = this.S.hero.lv; for (const lv of lvBoxLevels()) { if (lv > L) break; const r = this.lvBoxClaim(lv); if (r) out.push(r); } return out; }
  // v634 뜻대로 굴리기(core/wish.js) · 전투력 미리보기 — 복사한 게임에 fn을 해 보고 전투력만 잰다(이 게임은 그대로)
  wishList() { return WI.wishList(this.S); }
  wishTarget(id) { return WI.wishTarget(this.S, id); }
  wishRoll(id, want, budget) { const r = WI.wishRun(this.S, this.rng, id, want, budget); if (r?.n) this.dirtyStats = true; return r; }
  wishUndo(r) { const ok = WI.wishUndo(this.S, r); if (ok) this.dirtyStats = true; return ok; }
  wishLock(id, i) { return WI.wishLock(this.S, id, i); }
  powerIf(fn, mode = 'pve') { const G2 = new Game(structuredClone(this.S), this.now); G2.emit = () => {}; G2.rng = new Rng(this.rng.state()); let ok; try { ok = fn(G2); } catch { return null; } if (ok === false) return null; const p0 = Math.round(this.power(mode)), p1 = Math.round(G2.power(mode)); return { p0, p1, d: p1 - p0 }; }
  // ── v635 전서구 함(우편 · tables/mail.js) ── { id, at, kind, title, rew: { 지갑 키 | exp: n }, exp: 사라지는 때 }
  //   옛 세이브도 여기서 생긴다 · 선물은 id마다 한 번 · 기한 지난 것은 볼 때 지운다(보상도 사라진다)
  mailSt() {
    const M = (this.S.mail ??= { list: [], n: 0, gifts: {} }); M.list ??= []; M.gifts ??= {}; M.n ||= 0;
    for (const G of MAIL_GIFTS) if (!M.gifts[G.id]) { M.gifts[G.id] = 1; this.mailAdd(M, 'gift', G.title, G.rew); }
    if (M.list.some((m) => this.now > m.exp)) M.list = M.list.filter((m) => this.now <= m.exp);
    return M;
  }
  mailAdd(M, kind, title, rew) {
    const r = {}; for (const [k, n] of Object.entries(rew || {})) { const v = Math.floor(n) || 0; if (v > 0) r[k] = v; }
    if (!Object.keys(r).length) return null;
    const m = { id: ++M.n, at: this.now, kind, title, rew: r, exp: this.now + MAIL_KEEP };
    M.list.push(m); if (M.list.length > MAIL_MAX) M.list.splice(0, M.list.length - MAIL_MAX);   // 오래된 것부터
    return m;
  }
  mailPush(kind, title, rew) { return this.mailAdd(this.mailSt(), kind, title, rew); }
  mailList() { return this.mailSt().list.slice().reverse(); }   // 새것부터
  mailCan() { return this.mailSt().list.length; }
  mailClaim(id) {
    const M = this.mailSt(), i = M.list.findIndex((m) => m.id === id); if (i < 0) return null;
    const [m] = M.list.splice(i, 1), W = this.S.wallet;
    for (const [k, n] of Object.entries(m.rew)) if (k === 'exp') this.addExp(n); else W[k] = (W[k] || 0) + n;
    return { rew: { ...m.rew } };
  }
  mailClaimAll() {
    const ids = this.mailSt().list.map((m) => m.id); if (!ids.length) return null;
    const rew = {}; let n = 0;
    for (const id of ids) { const r = this.mailClaim(id); if (!r) continue; n++; for (const [k, v] of Object.entries(r.rew)) rew[k] = (rew[k] || 0) + v; }
    return n ? { n, rew } : null;
  }
  // 날 · 주가 바뀌기 바로 전(tick) — 끝내고 안 받은 임무를 claimMission과 같은 셈으로 한 통에(강호 패스 점수는 빼고)
  mailMissed(book) {
    const ids = this.books[book].claimable(); if (!ids.length) return null;
    const sum = {}; for (const id of ids) for (const [k, n] of Object.entries(this.missionRew(book, id))) sum[k] = (sum[k] || 0) + n;
    return this.mailPush('missed', MAIL_TXT[book](ids.length), sum);
  }
  // 현상수배 — 날이 바뀌어 새 목표를 만들기 바로 전(bountySt) · bountyClaim · bountyChest와 같은 셈
  mailBounty(B) {
    const sum = {}, add = (k, n) => { if (k && n > 0) sum[k] = (sum[k] || 0) + n; }; let n = 0;
    for (const x of B.list) if (x.done && !x.got) { n++; add('gold', this.bountyGold()); add(x.rew?.k, Math.max(0, Math.floor(x.rew?.n) || 0)); }
    if (!B.chest && B.list.length && B.list.every((x) => x.done)) { n++; for (const [k, v] of Object.entries(this.bountyChestGive(B))) add(k, v); }
    return n ? this.mailPush('missed', MAIL_TXT.bounty(n), sum) : null;
  }
  // 대결 주간 — 지난주 보상을 안 받은 채 한 주가 더 지나 덮어쓰기 바로 전(pvpMark)
  mailPvp(P) {
    if (P.lastWk == null || P.lastGot === P.lastWk) return null;
    const r = this.pvpTierRew(P.lastBest); P.lastGot = P.lastWk;
    return this.mailPush('week', MAIL_TXT.pvp(r.tier), { 'ticket:gear': r.tix });
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
