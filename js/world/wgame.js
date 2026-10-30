// 바람식 개편 — 게임. 마을과 사냥터, 몹 젠, 자동 사냥, 레벨·스탯·장비, 물약, 전직 스킬, 방치.
// 설계: docs/바람식_개편.md
//
// 그리는 쪽(battle.js BattleView)은 옛 Game을 읽던 그대로 이것을 읽는다 —
// heroX/heroY/heroFacing/heroAngle/walking, mons/mon, mode('stage'), s.job/s.rank/s.stage,
// stats().hp, heroHp, events(attack·dmg·kill·heroHit·heroDied·skill·levelUp …).
// 그래서 들판 그림·이펙트·초식 연출표를 손대지 않고 쓴다.
import * as W from './wdata.js';
import * as D from './wdgn.js';
import * as Q from './wquest.js';
import * as MS from './wmaster.js';
import * as LN from './wline.js';
import * as L from './wland.js';
import * as G from './wgear.js';
import * as IM from './wimprint.js';

const rand = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let uidSeq = 1;

export function newWorldSave(now = Date.now()) {
  return {
    v: 1,
    nickname: '',
    job: null,
    jobTier: 0,
    level: 1,
    exp: 0,
    statPts: 0,
    stats: { str: 0, dex: 0, vit: 0, int: 0 },   // 찍은 것 (캐릭터 기본치는 따로)
    autoStat: false,          // 레벨업 점수는 직접 찍는다(켜면 알아서 나눈다)
    skillLv: { s0: 1, s1: 1, s2: 1, s3: 1, s4: 1 },   // 스킬 레벨 (v110) · s3 보조기(v120)
    skillPts: 0,
    passLv: {},               // 심법(패시브) 레벨 (v119)
    skillV: 1,
    statV: 3,
    gold: 0,
    potions: 5,
    autoPotion: true,
    autoRefill: false,        // 물약이 10개 아래면 알아서 50개까지 산다 (v121)
    equip: { weapon: null, armor: null, hat: null, glove: null, shoe: null, acc: null, finger: null, ear: null },
    gearV: 3,                // v143 사다리 스무 칸 (레벨 5마다 · 100까지)
    pets: [],                // 키우는 애완동물 (장착 칸만큼 함께 싸운다)
    petBox: [],              // 떨군 애완동물이 기다리는 우리
    mounts: [],              // 가진 탈것
    mount: null,             // 탄 탈것 uid
    bag: [],
    bagSize: W.BAG_SIZE,
    mats: {},                // 재료 — 사냥터 번호: 개수
    map: 0,                  // 지금 있는 곳 (0 마을)
    huntMap: W.mapId(1, 1),  // 돌아갈 구역 (지역×10 + 구역)
    mapV: 2,
    autoHunt: true,
    autoSkill: true,
    kingParty: false,        // 십이지왕 두목 구역: false 혼자 · true 문파원과 함께 (v145, 들어갈 때 고른다)
    lastSeen: now,
    titles: [],
    kills: 0,
    deaths: 0,
    bestMap: W.mapId(1, 1),
    // 요일 던전 (v126): 오늘 쓴 횟수 · 종류별 깬 단계 · 자동 도전(v139)
    dgn: { day: '', used: {}, best: {}, auto: false },
    tower: { floor: 0, auto: true },         // 무한의 탑: 오른 층 · 이기면 이어 오르기
    zTickets: {},                            // 십이지 뽑기권 — 신 번호(1~12): 장수
    zPity: {},                               // 신마다 신수 없이 뽑은 횟수 (셋째에 꼭)
    mast: {},                                // 지역 숙련도 (v127) — 지역 번호: 잡은 수
    raid: { day: '', n: 0, dps: 0 },         // 문파 토벌 (v128): 오늘 친 횟수 · 마지막 초당 피해
    prot: 0,                                 // 강화 보호부 (v150)
    duel: { won: {} },                       // 고수 (v148): 처음 쓰러뜨린 고수 — 영구 능력치
    quest: 0,                                // 길잡이 (v139): 받은 단계 수 — 지금 할 일은 QUESTS[quest]
    questV: Q.QUEST_V,                       // 길잡이 판 (v146에 다시 짰다)
    questGift: -1,                           // 선물을 준 단계 (한 단계에 한 번)
    did: {},                                 // 해 본 것 (길잡이가 본다): move·craft·boss·sweep·zodiac …
    created: now,
  };
}

// 저장된 것을 읽는다. 모르는 칸·망가진 값은 기본값으로.
export function migrateWorld(raw, now = Date.now()) {
  const base = newWorldSave(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.skillLv = { ...base.skillLv, ...(raw.skillLv || {}) };
  for (const k of Object.keys(s.skillLv)) s.skillLv[k] = clamp(Math.floor(Number(s.skillLv[k]) || 1), 1, W.SKILL_LV_MAX);
  // v110: 스킬 점수 — 옛 세이브는 레벨 15부터 오른 만큼 한 번에
  if ((raw.skillV || 0) < 1) { s.skillPts = Math.max(0, (Number(raw.level) || 1) - W.SKILL_PT_FROM + 1); s.skillV = 1; }
  s.skillPts = Math.max(0, Math.floor(Number(s.skillPts) || 0));
  for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, Math.floor(Number(s.stats[k]) || 0));
  s.equip = { ...base.equip, ...(raw.equip || {}) };
  const okPet = (p) => p && W.PETS.some((x) => x.id === p.kind) && W.RARITY[p.rar];
  s.pets = Array.isArray(raw.pets) ? raw.pets.filter(okPet) : [];
  s.petBox = Array.isArray(raw.petBox) ? raw.petBox.filter(okPet).slice(0, W.PET_BOX) : [];
  s.mounts = Array.isArray(raw.mounts) ? raw.mounts.filter((m) => m && W.mountOf(m.kind)) : [];
  if (!s.mounts.some((m) => m.uid === s.mount)) s.mount = null;
  s.mats = {};
  for (const [k, v] of Object.entries(raw.mats || {})) if ((W.MATS[k] || (k[0] === 'b' && W.MATS[k.slice(1)]) || G.isStoneKey(k) || LN.isFacMat(k) || G.isLordMat(k)) && v > 0) s.mats[k] = Math.floor(Number(v) || 0);
  delete s.autoSell;
  // v105: 레벨업 점수를 직접 찍게 바꿨다 — 옛 세이브의 '자동 분배 켬'은 한 번 끈다
  if ((raw.statV || 0) < 2) { s.autoStat = false; s.statV = 2; }
  s.bag = Array.isArray(raw.bag) ? raw.bag.filter((i) => i && W.SLOTS.some((x) => x.id === i.slot)) : [];
  s.level = clamp(Math.floor(Number(s.level) || 1), 1, W.LEVEL_MAX);
  for (const k of ['exp', 'gold', 'potions', 'statPts', 'jobTier', 'kills', 'deaths', 'books', 'prot']) s[k] = Math.max(0, Number(s[k]) || 0);
  s.jobTier = Math.min(4, Math.floor(s.jobTier));
  s.passLv = {};
  for (const [k, v] of Object.entries(raw.passLv || {})) if (/^p_[a-z]+$/.test(k) && v > 0) s.passLv[k] = Math.min(10, Math.floor(Number(v) || 0));
  // v118: 내공 효율(스킬 피해 3%→0.7%)과 직업 특성을 바꿨다 — 찍은 능력치를 한 번 다 돌려준다
  if ((raw.statV || 0) < 3) {
    const st = s.stats || {};
    const back = ['str', 'dex', 'vit', 'int'].reduce((a, k) => a + Math.max(0, Math.floor(Number(st[k]) || 0)), 0);
    if (back > 0) { s.statPts += back; s.stats = { str: 0, dex: 0, vit: 0, int: 0 }; s.respecNote = back; }
    s.statV = 3;
  }
  // v107: 사냥터 1~15 → 지역마다 구역 셋 + 두목 구역 (번호 = 지역×10 + 구역)
  if ((raw.mapV || 0) < 2) {
    s.map = W.oldMapToNew(raw.map);
    s.huntMap = W.oldMapToNew(raw.huntMap);
    s.bestMap = W.oldMapToNew(raw.bestMap);
    if (s.rates) s.rates = { ...s.rates, map: W.oldMapToNew(s.rates.map) };
    s.mapV = 2;
  }
  if (!W.hasMap(s.map)) s.map = 0;
  if (!W.hasMap(s.huntMap) || W.mapOf(s.huntMap).town) s.huntMap = W.mapId(1, 1);
  if (!W.hasMap(s.bestMap)) s.bestMap = s.huntMap;
  if (s.job && !W.CLASSES[s.job]) s.job = null;
  // v126 던전
  const dg = raw.dgn && typeof raw.dgn === 'object' ? raw.dgn : {};
  s.dgn = { day: typeof dg.day === 'string' ? dg.day : '', used: {}, best: {} };
  for (const d of D.DAILY) {
    s.dgn.used[d.id] = Math.max(0, Math.floor(Number(dg.used?.[d.id]) || 0));
    s.dgn.best[d.id] = clamp(Math.floor(Number(dg.best?.[d.id]) || 0), 0, D.DAILY_STAGES);
  }
  const tw = raw.tower && typeof raw.tower === 'object' ? raw.tower : {};
  s.tower = { floor: clamp(Math.floor(Number(tw.floor) || 0), 0, D.TOWER_MAX), auto: tw.auto !== false };
  s.dgn.auto = !!s.dgn.auto;
  s.quest = clamp(Math.floor(Number(s.quest) || 0), 0, Q.QUEST_COUNT);
  s.did = raw.did && typeof raw.did === 'object' ? { ...raw.did } : {};
  s.duel = { won: { ...(raw.duel?.won || {}) } };
  s.questGift = Number.isInteger(raw.questGift) ? raw.questGift : -1;
  const rd = raw.raid && typeof raw.raid === 'object' ? raw.raid : {};
  s.raid = { day: typeof rd.day === 'string' ? rd.day : '', n: clamp(Math.floor(Number(rd.n) || 0), 0, D.RAID_PER_DAY), dps: Math.max(0, Number(rd.dps) || 0) };
  s.mast = {};
  for (const [k, v] of Object.entries(raw.mast || {})) if (W.zoneOfW(+k) && v > 0) s.mast[k] = Math.floor(Number(v) || 0);
  s.zTickets = {}; s.zPity = {};
  for (let k = 1; k <= 12; k++) {
    const n = Math.floor(Number(raw.zTickets?.[k]) || 0); if (n > 0) s.zTickets[k] = n;
    const p = Math.floor(Number(raw.zPity?.[k]) || 0); if (p > 0) s.zPity[k] = p;
  }
  for (const it of [...s.bag, ...Object.values(s.equip), ...s.pets, ...s.petBox, ...s.mounts]) {
    if (!it) continue;
    if (it.uid >= uidSeq) uidSeq = it.uid + 1;
    // v110: 등급이 없던 조합 장비는 레어로 (옵션 하나)
    if (it.step != null && it.rar == null) { it.rar = 0; it.opts = W.rollSkillOpts(0, rand); it.grade = W.RARITY_GRADE[0]; }
    // v132: 세트 조각은 그 부위를 맡은 전반 왕의 것 (강화는 후반 왕의 강화석으로)
    if (it.set && G.SLOT_KING[it.slot]) it.king = G.SLOT_KING[it.slot];
  }
  // v130: 사다리가 레벨 99(보통 지역 15곳)에서 끝난다. 십이지왕 사다리 장비는 —
  //   장신구·가락지·귀걸이: 그 왕의 레벨 100 공용 장신구로 바꾼다(등급·옵션·강화 그대로).
  //   무기·옷·모자: 사다리 끝(천외천 상급)으로 내리고, 만들 때 든 왕의 재료·증표를 돌려준다(세트를 만들 수 있게).
  if ((raw.gearV || 0) < 2) {
    let note = 0;
    // **그때의 셈을 그 자리에 박아 둔다.** 이 이주는 '옛 칸'을 읽는 일인데,
    // 지금 상수(v143에서 바뀐 것)를 쓰면 엉뚱한 장비를 왕의 장신구로 바꾼다.
    const OLD_TIERS = 15;                       // v130 당시 보통 지역 수
    const oldMap = (st) => Math.floor(st / 2) + 1;
    const oldUpper = (st) => st % 2 === 1;
    const fix = (it) => {
      if (!it || it.step == null || it.step < OLD_TIERS * 2) return it;
      const k = oldMap(it.step);
      note++;
      if (W.isDropOnly(it.slot) || it.slot === 'acc') return { ...it, step: undefined, king: k, ilv: G.KING_ILV };
      const up = oldUpper(it.step);
      const m = { weapon: 40, armor: 30, hat: 24 }[it.slot] || 24;
      s.mats[k] = (s.mats[k] || 0) + Math.round(m * (up ? 1.5 : 1));
      if (up) s.mats[W.bossKey(k)] = (s.mats[W.bossKey(k)] || 0) + ({ weapon: 4 }[it.slot] || 3);
      return { ...it, step: OLD_TIERS * 2 - 1, ilv: 99 };
    };
    for (const k of Object.keys(s.equip)) s.equip[k] = fix(s.equip[k]);
    s.bag = s.bag.map(fix);
    for (const it of [...s.bag, ...Object.values(s.equip)]) if (it && it.step === undefined) delete it.step;
    if (note) s.gearNote = note;
    s.gearV = 2;
  }
  // v143: 사다리가 서른 칸(하급·상급)에서 스무 칸(레벨 5마다)으로 바뀌었다.
  // **아이템 레벨로 옮긴다** — 옛 칸이 뭘 뜻했든 ilv는 늘 적혀 있었다.
  if ((raw.gearV || 0) < 3) {
    const toNew = (it) => {
      if (!it || it.step == null) return it;
      const st = W.stepOfLevel(it.ilv || W.stepLevel(0));
      return { ...it, step: st, ilv: W.stepLevel(st) };
    };
    for (const k of Object.keys(s.equip)) s.equip[k] = toNew(s.equip[k]);
    s.bag = s.bag.map(toNew);
    s.gearV = 3;
  }
  return s;
}

const NO_ENV = Object.freeze({});
// 자동 도전이 '들어갈 데 있나'를 보는 주기. 매 틱 보면 비싸고,
// 너무 뜸하면 날이 바뀌었는데 한참 안 들어간다.
const AUTO_DGN_SEC = 3;

export class WorldGame {
  constructor(save, now = Date.now()) {
    this.s = migrateWorld(save, now);
    this.events = [];
    this.clock = 0;
    this.mode = 'stage';           // 그리는 쪽은 'stage'일 때 들판을 그린다
    this.buffs = {};               // 무인 버프 남은 초 (rage·gale은 그리는 쪽도 본다)
    this.buffv = {};               // 버프 세기
    this.skillAt = {};             // 차수별 마지막으로 쓴 때 (삼공조화)
    this.adds = [];
    this.queue = [];
    this.fields = [];
    this.contest = null;
    this.inst = null;              // 던전 안이면 { kind, stage, map, t, kills, … } (v126)
    this.sceneKey = null;          // 그리는 쪽 배경 (던전마다)
    this.blocked = null;           // 막힌 칸 (사냥터 지형, v127) — Uint8Array(칸) 또는 null
    this.obstacles = [];           // 그리는 쪽: [{ c, r, kind, seed }]
    this.tells = [];               // 탑 수문장의 바닥 경고 — 잠깐 뒤 터진다 (v126)
    this.autoDodge = false;        // 시험·시뮬용: 경고를 알아서 피한다 (화면에는 없다 — 직접 피해야 한다)
    this.mons = [];
    this.mon = null;
    this.cd = { s0: 0, s1: 0, s2: 0, s3: 0, s4: 0 };
    this.clones = [];             // 환영분신술 분신들 (v121)
    this.shield = 0;              // 금종조 보호막 (남은 양)
    this.atkTimer = 0.4;
    this.potionT = 0;
    this.returnT = 0;
    this.bossT = 0;
    this.respawns = [];
    this.manual = null;            // 손으로 찍은 갈 곳
    this.manualHold = 0;
    this.joy = null;               // 떠다니는 조이스틱 방향 {dx, dy} (v125) — 누르고 있는 동안만
    this.walking = false;
    this.heroFacing = 1;
    this.heroAngle = 0;
    this.rng = rand;
    this.guildExp = 0;             // 문파 경험치 (서버가 넣는다)
    // 최근 벌이 (방치 보상을 재는 데 쓴다): [시각, 처치, 경험치, 은자, 물약]
    this.ledger = [];
    this._stats = null;
    this.growInit();
    this.enterMap(this.s.map, true);
    this.heroHp = this.stats().hp;
  }

  // ---------- 그리는 쪽과의 약속 ----------
  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
  }
  jobTier() { return this.s.jobTier; }
  heroLabel() { return `Lv.${this.s.level} ${this.s.nickname || ''}`; }
  ranged() { return !!W.classOf(this.s.job)?.range; }
  // 그리는 쪽: 무인 뒤를 따르는 애완동물 · 탄 탈것
  petTeam() { return this.activePets().map((p) => ({ kind: p.kind, emoji: W.petOf(p.kind).emoji, rar: p.rar })); }
  mountNow() { const m = this.s.mounts.find((x) => x.uid === this.s.mount); return m ? W.mountOf(m.kind) : null; }
  bestGrade(slot) { const it = this.s.equip[slot]; return it ? it.grade : -1; }
  aoeCenter() { return this.ranged() && this.mon?.alive ? { x: this.mon.x, y: this.mon.y } : { x: this.heroX, y: this.heroY }; }
  // 그리는 쪽은 s.stage로 지역 그림을 고른다 — 사냥터 k = 옛 지역 k의 첫 관문
  get map() { return this.inst ? this.inst.map : W.mapOf(this.s.map); }
  // 칸 지도 크기 — 그리는 쪽이 이걸 보고 사냥터 한 장이 화면에 들어오게 카메라를 물린다
  get mapW() { return W.MAP_W; }
  get mapH() { return W.MAP_H; }
  get tile() { return W.TILE; }

  // ---------- 수치 ----------
  totalStat(k) { return (W.CLASSES[this.s.job]?.base[k] || 0) + (this.s.stats[k] || 0); }
  itemStats(it) {
    if (!it) return {};
    const b = W.itemBase(it.slot, it.ilv);
    // 조합 장비: 사다리 칸 × 등급(레어·유니크·전설·신화) · 왕의 장비(레벨 100): KING_MULT × 등급 · 옛 드랍 장비: 옛 등급
    const q = it.king != null ? G.KING_MULT * W.RARITY[it.rar || 0].mult * (it.set ? G.setOf(it.set)?.mult || 1 : 1)
      : it.step != null ? (it.grow ? W.growMult(it.ilv) : W.stepMult(it.step)) * W.RARITY[it.rar || 0].mult : W.GRADES[it.grade].mult;
    const ln = it.line ? LN.lineOf(it.line) : null;
    const m = q * W.enhanceMult(it.plus || 0) * (ln ? ln.mult : 1);
    const out = {};
    for (const [k, v] of Object.entries(b)) out[k] = v * m;
    // 계열(v151)의 덤 능력 — 칸·등급만큼 (강화와는 따로)
    if (ln && it.step != null) for (const [k, v] of Object.entries(LN.lineBonus(it.line, it.step, W.RARITY[it.rar || 0].mult))) out[k] = (out[k] || 0) + v;
    // 증표 각인 (v163) — 칸마다 그 두목의 성질
    for (const im of IM.imprintsOf(it)) for (const [k, v] of Object.entries(im.fx)) out[k] = (out[k] || 0) + v;
    // 가락지·귀걸이: 그 두목의 덤 능력 (등급만큼 커진다, 강화와는 따로)
    if (W.isDropOnly(it.slot) && (it.step != null || it.king != null)) {
      for (const [k, v] of Object.entries(W.acc2Trait(W.itemZone(it), it.slot))) out[k] = (out[k] || 0) + v * W.RARITY[it.rar || 0].mult;
    }
    return out;
  }
  // 사다리 장비의 고유 옵션 { k, v } (v130)
  itemUnique(it) {
    if (!it || it.step == null || it.starter) return null;
    // 하급·상급이 없어졌다. 같은 지역 안에서 칸이 둘이면 뒤 칸을 조금 세게 둔다 —
    // 그래야 '다음 칸이 확실히 낫다'가 선다.
    // **앞 칸인지 뒤 칸인지를 거꾸로 봤다.** 다음 칸이 같은 지역이면 그건
    // '앞 칸'이다. 뒤 칸은 **앞 칸과 지역이 같은** 쪽이다.
    const upper = it.step > 0 && W.stepMap(it.step) === W.stepMap(it.step - 1);
    return G.uniqueOf(it.slot, W.itemZone(it), upper, W.RARITY[it.rar || 0].mult);
  }
  // 끼고 있는 세트 — { 세트 id: 조각 수 } (자기 직업 세트만 효과가 난다)
  setCounts() {
    const out = {};
    for (const sl of G.SET_SLOTS) { const it = this.s.equip[sl]; if (it?.set) out[it.set] = (out[it.set] || 0) + 1; }
    return out;
  }
  // 켜진 세트 효과를 한데 모은다 — 능력치 키와 무공 키가 섞여 있다
  setBonus() {
    const sig = `${this.s.job}|${G.SET_SLOTS.map((k) => this.s.equip[k]?.set || '-').join(',')}`;
    if (this._setb?.sig === sig) return this._setb.v;
    const v = {};
    for (const [id, n] of Object.entries(this.setCounts())) {
      const st = G.setOf(id);
      if (!st || (st.job && st.job !== this.s.job)) continue;     // 맹주·천마 세트(v153)는 모든 직업
      for (const [need, b] of Object.entries(st.bonus)) if (n >= +need) for (const [k, x] of Object.entries(b)) v[k] = (v[k] || 0) + x;
    }
    this._setb = { sig, v };
    return v;
  }
  stats() {
    if (this._stats && this._stats.sig === this.statSig()) return this._stats;
    const s = this.s;
    const L = s.level;
    const cls = W.CLASSES[s.job] || {};
    const gear = { atk: 0, hp: 0, def: 0, crit: 0, atkPct: 0, speed: 0, hpPct: 0, regenPct: 0, skill: 0, critDmg: 0, exp: 0,
      dodge: 0, move: 0, bossDmg: 0, drain: 0, dmgRed: 0, cdr: 0, range: 0, thorns: 0, stunHit: 0, gold: 0, venom: 0, burn: 0, chill: 0, shock: 0 };
    for (const it of Object.values(s.equip)) {
      const st = this.itemStats(it);
      for (const k of Object.keys(st)) gear[k] = (gear[k] || 0) + st[k];
      const u = this.itemUnique(it);                       // v130 고유 옵션
      if (u) gear[u.k] = (gear[u.k] || 0) + u.v;
    }
    // 세트 효과 중 능력치 (무공 쪽은 setBonus()를 그 자리에서 읽는다)
    for (const [k, v] of Object.entries(this.setBonus())) if (k in gear) gear[k] += v;
    // 애완동물 버프 · 탈것(공격력·체력 %) · 십이지왕 신화
    gear.mat = 0;
    for (const p of this.activePets()) {
      const d = W.petOf(p.kind);
      gear[d.buff] = (gear[d.buff] || 0) + W.petBuff(p);
      for (const [k, v] of Object.entries(d.also || {})) gear[k] = (gear[k] || 0) + v * W.petScale(p);   // 황룡: 둘 다
    }
    const mt = this.mountNow();
    if (mt) { gear.atkPct += mt.stat; gear.hpPct += mt.stat; }
    // 무한의 탑: 오른 층마다 영구히
    const tb = D.towerBonus(s.tower?.floor);
    gear.atkPct += tb; gear.hpPct += tb;
    // 고수 비무: 처음 이긴 고수마다 영구히 (v148)
    const mb = this.masterBonus();
    gear.atkPct += mb; gear.hpPct += mb;
    // 심법
    const pm = this.pmods();
    gear.atkPct += pm.atkPct || 0;
    gear.hpPct += pm.hpPct || 0;
    gear.critDmg += pm.critDmg || 0;
    const ps = this.passives();
    if (ps.has('crimson')) gear.critDmg += 0.8;
    if (ps.has('formless')) gear.skill += 0.3;
    const str = this.totalStat('str');
    const dex = this.totalStat('dex');
    const vit = this.totalStat('vit');
    const int = this.totalStat('int');
    // 문파 버프 — 문파 레벨마다 공격력 +2% (서버가 guildExp를 넣어 준다)
    // 레벨·스탯 몫은 작게, 장비 몫은 크게 (v108) — 강해지는 건 대부분 장비 덕
    // v110: 레벨·스탯 몫을 키웠다(장비보다는 작게).
    // 장비가 2/3 남짓, 레벨·스탯이 1/3 남짓(시뮬로 맞춤). 힘·체력은 1점에 0.3%씩도 올린다.
    const atk = (5 + L * 3 + str * 3 + gear.atk) * (1 + gear.atkPct + str * 0.003 + (s.guildId ? W.guildAtk(this.guildExp) : 0));
    const hp = (60 + L * 25 + vit * 20 + gear.hp) * (1 + gear.hpPct + vit * 0.003);
    const st = {
      atk, hp,
      def: vit * 0.2 + gear.def,
      crit: Math.min(0.75, 0.05 + dex * 0.004 + gear.crit + (cls.crit || 0)),
      critDmg: W.CRIT_DMG + gear.critDmg + (cls.critDmg || 0),
      atkSec: W.BASE_ATK_SEC / ((1 + dex * 0.01 + gear.speed) * (cls.speed || 1)),
      speed: (1 + dex * 0.01 + gear.speed) * (cls.speed || 1),
      skillMult: 1 + int * 0.007 + gear.skill,
      // 자연 회복: 최대 체력의 0.6%/초 + 내공·레벨 몫 (물약만 바라보지 않게)
      regen: (1 + int * 0.12 + L * 0.08 + hp * (0.006 + gear.regenPct)) * (1 + (pm.regen || 0)),
      expMult: 1 + gear.exp,
      matMult: 1 + gear.mat,
      moveSpeed: 1 + (mt ? mt.speed : 0) + (cls.move || 0) + (pm.move || 0) + gear.move,
      boss: (cls.boss || 1) * (1 + gear.bossDmg),
      gold: gear.gold, dodge: Math.min(0.5, gear.dodge), drain: gear.drain, dmgRed: Math.min(0.5, gear.dmgRed),
      cdr: Math.min(0.4, gear.cdr), skillRange: gear.range, thorns: gear.thorns, stunHit: Math.min(0.3, gear.stunHit),
      venom: Math.min(IM.IMP_CAP.venom, gear.venom), burn: Math.min(IM.IMP_CAP.burn, gear.burn), chill: Math.min(IM.IMP_CAP.chill, gear.chill), shock: Math.min(IM.IMP_CAP.shock, gear.shock),
      range: W.classOf(s.job)?.range || W.MELEE_RANGE,
    };
    // 전투력(서열·비교용): 초당 피해 × 버티는 힘의 기하평균 — 보이는 숫자라 작게 둔다
    st.power = Math.round(Math.sqrt(st.atk / st.atkSec * (1 + st.crit * (st.critDmg - 1)) * st.hp));
    st.sig = this.statSig();
    this._stats = st;
    return st;
  }
  statSig() {
    const s = this.s;
    const e = s.equip;
    const g = (it) => (it ? `${it.uid}.${it.plus || 0}.${it.rar || 0}` : '-');
    const pets = this.activePets().map((p) => `${p.uid}.${p.lv}`).join(',');
    return `${s.level}|${JSON.stringify(s.passLv || {})}|${s.guildId ? W.guildLevel(this.guildExp) : 0}|${s.job}|${s.stats.str},${s.stats.dex},${s.stats.vit},${s.stats.int}|${W.SLOTS.map((x) => g(e[x.id])).join(',')}|${pets}|${s.mount || '-'}|${s.tower?.floor || 0}`;
  }
  power() { return this.stats().power; }

  // ---------- 지도 ----------
  // v146: 레벨과 상관없이 어디든 들어간다 — 센 곳에서 빨리 크고 싶은 사람을 막지 않는다.
  // 대신 화면에 '위험'을 띄우고(danger), 방치 중 거기서 쓰러지면 알맞은 사냥터로 물러난다(heroDied).
  canEnter(id) {
    return W.hasMap(id);
  }
  // 몹 레벨이 내 레벨보다 이만큼 위면 위험 (0 이하면 안전)
  danger(id) {
    const m = W.mapOf(id);
    return m.town ? 0 : m.lv[0] - this.s.level;
  }
  // 내 레벨에 알맞은 가장 높은 일반 구역 (물러날 곳)
  safeMap() {
    let best = W.mapId(1, 1);
    for (const m of W.MAPS) if (!m.town && !m.bossRoom && !m.king && m.lv[0] <= this.s.level && m.lv[0] >= W.mapOf(best).lv[0]) best = m.id;
    return best;
  }
  enterMap(id, quiet = false) {
    if (!this.canEnter(id)) return false;
    this.clones = [];
    if (this.inst) this.inst = null;     // 던전에서 다른 데로 가면 그 판은 버린다
    this.sceneKey = null;
    this.tells = [];
    const terr = L.terrainOf(id);
    this.blocked = terr?.grid || null;
    this.obstacles = terr?.list || [];
    const m = W.mapOf(id);
    this.s.map = id;
    if (!m.town) { this.s.huntMap = id; this.s.bestMap = Math.max(this.s.bestMap || 1, id); }
    // 그리는 쪽이 지역 그림을 고르는 값 (십이지왕은 옛 지역 그림을 빌린다)
    this.s.stage = m.art * 10 + 1;
    this.s.rank = W.lookTierOf(this.s.level);
    // 사냥터는 아래쪽 가운데에서 들어선다. 마을은 한가운데(둘레에 사부·상인·대장장이·주모)
    this.placeHero(Math.floor(W.COLS / 2), m.town ? Math.floor(W.ROWS * 0.55) : W.ROWS - 3);
    this.mons = [];
    this.mon = null;
    this.respawns = [];
    this.manual = null;
    this.returnT = 0;
    this.bossT = 1.5;                // 두목 구역: 들어서고 잠깐 뒤 두목이 나선다
    this.bossSeen = false;
    this.freezeT = 0;
    if (!m.town) for (let i = 0; i < (m.bossRoom ? W.BOSS_ROOM_MOBS : W.MOBS_ALIVE); i++) this.spawnMob(false);
    else this.placeNpcs();
    if (!quiet) this.emit('mapEnter', { id, name: m.name, town: m.town });
    return true;
  }
  // 마을로. 쓰러져서 온 것(auto)이면 쉬었다가 사냥터로 돌아가고, 스스로 온 것이면 머문다.
  // (전에는 스스로 와도 3초 뒤 사냥터로 끌려갔다)
  goTown(auto = false) {
    const ok = this.enterMap(0);
    if (ok) this.townReturn = auto;
    return ok;
  }
  // 마을 사람 — 싸우지 않는다. 그리기만 한다(누르면 마을 창). 무인 둘레 칸에 선다.
  placeNpcs() {
    for (const n of W.NPCS) {
      const c = clamp(this.hc + Math.round(n.dx / W.TILE), 0, W.COLS - 1);
      const r = clamp(this.hr + Math.round(n.dy / W.TILE), 0, W.ROWS - 1);
      this.mons.push({ id: uidSeq++, npc: true, c, r, x: W.tileCenter(c), y: W.tileCenter(r), hp: 1, maxHp: 1, alive: true,
        isBoss: false, stun: 0, tab: n.tab || 'town', def: { name: n.name, look: n.look } });
    }
  }

  // ---------- 칸 ----------
  // 누구든 (c, r) 칸에 서 있거나, 그 칸으로 옮겨 가는 중이다(mc, mr). 한 칸에는 하나만.
  placeHero(c, r) {
    this.hc = c; this.hr = r; this.hmove = null;
    this.heroX = W.tileCenter(c); this.heroY = W.tileCenter(r);
  }
  // 무인이 차지한 칸 (옮겨 가는 중이면 가는 칸)
  heroTile() { return this.hmove || { c: this.hc, r: this.hr }; }
  mobTile(m) { return m.move || { c: m.c, r: m.r }; }
  inMap(c, r) { return c >= 0 && r >= 0 && c < W.COLS && r < W.ROWS; }
  occupied(c, r, self = null) {
    if (this.blocked?.[r * W.COLS + c]) return true;     // 나무·바위·물 (v127)
    if (self !== 'hero') {
      if (this.hc === c && this.hr === r) return true;
      if (this.hmove && this.hmove.c === c && this.hmove.r === r) return true;
    }
    for (const m of this.mons) {
      if (!m.alive || m === self) continue;
      if ((m.c === c && m.r === r) || (m.move && m.move.c === c && m.move.r === r)) return true;
    }
    return false;
  }
  // 칸 사이 거리(칸 가운데끼리, 들판 단위)
  tileDist(a, b) { return Math.hypot(a.c - b.c, a.r - b.r) * W.TILE; }
  // (c, r)에서 목표 쪽으로 한 칸 — 앞뒤좌우만. 멀어지는 칸은 안 고르고, 막혔으면 옆으로 비킨다.
  nextStep(c, r, tc, tr, self) {
    const dc = tc - c, dr = tr - r;
    const opts = [];
    if (dc) opts.push({ c: c + Math.sign(dc), r, w: Math.abs(dc) });
    if (dr) opts.push({ c, r: r + Math.sign(dr), w: Math.abs(dr) });
    opts.sort((a, b) => b.w - a.w);
    for (const o of opts) if (this.inMap(o.c, o.r) && !this.occupied(o.c, o.r, self)) return o;
    // 앞이 막혔다 — 같은 거리로 옆으로 비켜 돌아간다
    if (opts.length === 1) {
      const side = dc ? [{ c, r: r + 1 }, { c, r: r - 1 }] : [{ c: c + 1, r }, { c: c - 1, r }];
      if (this.rng() < 0.5) side.reverse();
      for (const o of side) if (this.inMap(o.c, o.r) && !this.occupied(o.c, o.r, self)) return o;
    }
    return null;
  }
  // 길 찾기(넓이 우선): (c, r)에서 goal(c, r)이 참인 빈 칸까지 가장 짧은 길의 첫 걸음.
  // 이미 goal이면 'here', 길이 없으면 null. 지도가 9×19칸이라 매번 다 훑어도 싸다.
  // (전에는 목표 쪽으로 한 칸씩만 봤다 — 몹이 벽처럼 서 있으면 앞에서 멈춰 버렸다)
  findStep(c, r, goal, self) {
    if (goal(c, r)) return 'here';
    const C = W.COLS, R = W.ROWS;
    const prev = new Int16Array(C * R).fill(-1);
    const start = r * C + c;
    prev[start] = start;
    const q = [start];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      const cc = cur % C, cr = (cur - cc) / C;
      for (const [dc, dr] of dirs) {
        const nc = cc + dc, nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= C || nr >= R) continue;
        const ni = nr * C + nc;
        if (prev[ni] !== -1 || this.occupied(nc, nr, self)) continue;
        prev[ni] = cur;
        if (goal(nc, nr)) {
          // 첫 걸음까지 거슬러 올라간다
          let k = ni;
          while (prev[k] !== start) k = prev[k];
          return { c: k % C, r: (k - (k % C)) / C };
        }
        q.push(ni);
      }
    }
    return null;
  }
  // 옮겨 가는 칸 쪽으로 미끄러진다. 닿으면 true.
  slide(obj, xKey, yKey, to, speed, dt) {
    const tx = W.tileCenter(to.c), ty = W.tileCenter(to.r);
    const dx = tx - obj[xKey], dy = ty - obj[yKey];
    const d = Math.hypot(dx, dy);
    const go = speed * dt;
    if (d <= go) { obj[xKey] = tx; obj[yKey] = ty; return true; }
    obj[xKey] += (dx / d) * go;
    obj[yKey] += (dy / d) * go;
    return false;
  }

  // ---------- 몹 ----------
  spawnMob(boss) {
    const m = this.map;
    if (m.town) return null;
    const [lo, hi] = m.lv;
    // 두목 구역의 졸개는 정예(그 지역 위끝 레벨)
    const lv = boss ? hi + 2 : m.bossRoom ? hi : lo + Math.floor(this.rng() * (hi - lo + 1));
    const kind = boss ? m.boss : m.mobs[Math.floor(this.rng() * m.mobs.length)];
    // 빈 칸에 난다. 무인 바로 둘레(네 칸 안)는 피한다 — 코앞에서 툭 생기면 어색하다
    let c = -1, r = -1;
    const h = this.heroTile();
    for (let t = 0; t < 40; t++) {
      const cc = boss ? Math.floor(W.COLS / 2) + Math.floor((this.rng() - 0.5) * 4) : Math.floor(this.rng() * W.COLS);
      const rr = boss ? Math.floor(W.ROWS * 0.3) + Math.floor((this.rng() - 0.5) * 4) : Math.floor(this.rng() * W.ROWS);
      if (!this.inMap(cc, rr) || this.occupied(cc, rr)) continue;
      c = cc; r = rr;
      if (Math.abs(cc - h.c) + Math.abs(rr - h.r) > 4) break;
    }
    if (c < 0) return null;
    const x = W.tileCenter(c), y = W.tileCenter(r);
    const king = boss ? m.king : null;
    const elite = !boss && !m.bossRoom && this.rng() < W.ELITE_RATE;
    const hp = D.fieldMobHp(lv) * (boss ? W.BOSS.hp : elite ? W.ELITE.hp : 1);
    const mob = {
      id: uidSeq++, lv, c, r, hc: c, hr: r, move: null, x, y, hp, maxHp: hp, alive: true, isBoss: !!boss, born: this.clock,
      atk: D.fieldMobAtk(lv) * (boss ? W.BOSS.atk : elite ? W.ELITE.atk : 1), armor: W.mobDef(lv),
      grade: king ? 3 : boss ? 2 : elite || m.bossRoom ? 1 : 0, elite,
      kp: king ? W.KING_MYTHIC[king.no]?.id : null,
      atkTimer: 1 + this.rng(), stun: 0, slow: 0, poison: 0, poisonPer: 0,
      aggro: false, wanderT: this.rng() * 3,
      def: { name: kind.name, look: kind.look, beast: kind.beast, bscale: kind.bscale, art: boss ? kind.art : undefined },
    };
    mob.name = kind.name;
    // 맹주·천마 (v148): 두목 방의 우두머리는 더 단단하고 아프다
    if (boss && m.lord) { mob.maxHp = mob.hp = mob.hp * W.LORD_HP; mob.atk *= W.LORD_ATK; }
    // 요일 던전 몹은 같은 레벨 무인에 맞춰 단단하다 (v126)
    if (this.inst?.kind === 'daily') { mob.maxHp = mob.hp = D.dailyMobHp(lv) * (elite ? W.ELITE.hp : 1); mob.atk = D.dailyMobAtk(lv) * (elite ? W.ELITE.atk : 1); }
    // 두목 등장 연출: 구역에 들어와 처음 나설 때는 길게(들판이 멈추고 두목은 맞지도 않는다),
    // 같은 구역에서 다시 날 때는 짧게(멈추지 않는다) — 45초마다 길게 멈추면 사냥이 끊긴다.
    const full = boss && !this.bossSeen;
    if (boss) this.bossSeen = true;
    if (full) { mob.introT = king ? W.KING_INTRO_SEC : W.BOSS_INTRO_SEC; this.freezeT = mob.introT; }
    this.mons.push(mob);
    if (boss) {
      this.emit('bossAppear', { name: kind.name, lv, full, zoneName: m.zoneName,
        king: king ? { no: king.no, title: king.title, real: king.real, hanja: king.hanja, skill: king.skill } : null, at: mob });
    }
    return mob;
  }

  // ---------- 한 틱 ----------
  tick(dt) {
    this.clock += dt;
    if (this.inst?.done) this.finishInst();
    // 자동 도전 — 들판에 있는 동안 열린 요일 던전이 있으면 알아서 들어간다.
    // 매 틱 보면 비싸므로 몇 초에 한 번만 본다.
    if (this.s.dgn.auto && !this.inst) {
      this.autoDgnT = (this.autoDgnT || 0) - dt;
      if (this.autoDgnT <= 0) { this.autoDgnT = AUTO_DGN_SEC; this.startAutoDaily(); }
    }
    const st = this.stats();
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.potionT = Math.max(0, this.potionT - dt);
    if (this.frenzyT > 0) this.frenzyT -= dt;
    if (this.reviveCd > 0) this.reviveCd -= dt;
    for (const k in this.buffs) if (this.buffs[k] > 0) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) { delete this.buffs[k]; delete this.buffv[k]; if (k === 'shield') this.shield = 0; } }
    // 회복
    const ev = this.envNow();
    const regen = this.map.town ? st.hp * W.REST_HEAL : st.regen * Math.max(0, 1 + (ev.regen || 0));
    if (this.heroHp > 0) this.heroHp = Math.min(st.hp, this.heroHp + regen * dt);
    // 독 기운: 조금씩 체력이 빠진다 (그것만으로 쓰러지지는 않는다 — 10% 아래로는 안 깎는다)
    if (ev.drain && this.heroHp > st.hp * 0.1 && !this.map.town) this.heroHp = Math.max(st.hp * 0.1, this.heroHp - st.hp * ev.drain * dt);
    if (this.map.town) { this.tickTown(dt); return; }
    // 죽은 몹 치우고 다시 낸다
    this.mons = this.mons.filter((m) => m.alive);
    for (const r of this.respawns) r.t -= dt;
    const due = this.respawns.filter((r) => r.t <= 0).length;
    this.respawns = this.respawns.filter((r) => r.t > 0);
    for (let i = 0; i < due; i++) this.spawnMob(false);
    // 두목 구역: 두목이 없으면 BOSS_RESPAWN초 뒤에 다시 난다
    if (this.map.bossRoom && !this.mons.some((m) => m.isBoss && m.alive)) {
      this.bossT -= dt;
      // 함께 사냥(v138): 십이지왕 구역에서 문파원과 같은 방이면 두목은 서버의 것을 따른다(wcoop.js)
      if (this.coop?.hold) this.coop.bossTick();
      else if (this.bossT <= 0) { this.bossT = W.BOSS_RESPAWN; this.spawnMob(true); }
    }
    // 십이지왕·고수의 초식 (v148) — 두목 방에서 설정집의 독문무공을 쓴다. 바닥 경고를 피한다.
    if (!this.inst && this.map.bossRoom) this.tickBossSkill(dt);
    if (!this.inst && this.tells.length) this.tickTells(dt, st);
    // 두목 등장 연출 동안은 들판 전체가 멈춘다(무인도 몹도)
    if (this.freezeT > 0) { this.freezeT -= dt; this.walking = false; for (const m of this.mons) if (m.introT > 0) m.introT -= dt; return; }
    if (this.inst) { this.tickInst(dt); this.tickTells(dt, st); if (this.inst?.done) return; }
    this.tickMobs(dt, st);
    if (this.heroHp <= 0) return;
    this.tickFields(dt, st);
    this.tickClones(dt, st);
    this.tickPotion(st);
    this.tickImprint(dt, st);
    this.tickHero(dt, st);
    this.tickPets(dt, st);
  }

  // 장판(독마 화골산) — tick마다 둘레를 친다
  tickFields(dt, st) {
    if (!this.fields.length) return;
    for (const f of this.fields) {
      f.life -= dt;
      f.t -= dt;
      while (f.t <= 0 && f.life > -1e-9) {
        f.t += f.tick;
        for (const m of this.mons.slice()) if (m.alive && !m.npc && Math.hypot(m.x - f.x, (m.y - f.y) * 0.75) <= f.r) this.strike(m, st, f.mult, f.id, 0, true);
      }
    }
    this.fields = this.fields.filter((f) => f.life > 0);
  }

  tickTown(dt) {
    this.walking = false;
    this.mon = null;
    // 쓰러져서 왔고 자동 사냥이면 잠깐 쉬었다가 돌아간다 (체력이 다 찰 때까지는 기다린다)
    if (this.townReturn && this.s.autoHunt && this.s.huntMap && this.canEnter(this.s.huntMap)) {
      this.returnT += dt;
      if (this.returnT >= W.RETURN_SEC && this.heroHp >= this.stats().hp * 0.98) this.enterMap(this.s.huntMap);
    }
  }

  tickMobs(dt, st) {
    for (const m of this.mons) {
      if (!m.alive) continue;
      // 독·출혈은 쌓이는 웅덩이(dot) — 남은 양의 1/tau씩 매초 들어간다(넣은 만큼이 결국 다 들어간다)
      if (m.dot > 0) {
        const d = m.dot < 1 ? m.dot : (m.dot * dt) / (m.dotTau || 3);
        m.dot -= d;
        m.poison = m.dot >= 1 ? (m.dotTau || 3) : 0;
        this.hurt(m, d, 'poison', false, true);
        if (!m.alive) continue;
      } else m.poison = 0;
      if (m.introT > 0) { m.introT -= dt; continue; }
      if (m.treasure) { this.tickTreasure(m, dt); continue; }
      if (m.stun > 0) { m.stun -= dt; continue; }
      if (m.slow > 0) m.slow -= dt;
      const spd = W.MOB_SPEED * (m.slow > 0 ? 0.45 : 1) * (m.isBoss ? 0.8 : 1);
      // 칸 사이를 옮겨 가는 중이면 마저 간다
      if (m.move) {
        if (this.slide(m, 'x', 'y', m.move, spd * (m.aggro ? 1 : 0.6), dt)) { m.c = m.move.c; m.r = m.move.r; m.move = null; }
        continue;
      }
      const ht = this.heroTile();
      const dist = this.tileDist(m, ht);
      if (dist < W.MOB_AGGRO || m.aggro) m.aggro = dist < W.MOB_AGGRO * 2;
      if (m.aggro) {
        const reach = m.isBoss ? W.MOB_REACH * 1.5 : W.MOB_REACH;
        if (dist > reach) {
          // 곧장 다가가고, 막혔으면 돌아서 (가끔만 길을 찾는다 — 몹이 많아서)
          let st2 = this.nextStep(m.c, m.r, ht.c, ht.r, m);
          if (!st2 && !(m.pathT > 0)) {
            m.pathT = 0.6;
            const f = this.findStep(m.c, m.r, (c, r) => this.tileDist({ c, r }, ht) <= reach, m);
            if (f && f !== 'here') st2 = f;
          }
          if (m.pathT > 0) m.pathT -= dt;
          if (st2) m.move = st2;
        } else {
          m.atkTimer -= dt;
          if (m.atkTimer <= 0) {
            m.atkTimer = W.MOB_ATK_SEC * (m.slow > 0 ? 1.5 : 1);
            m.atkAt = this.clock;                 // 그리는 쪽: 휘두르는 몸짓 (v162)
            const ps = this.passives();
            if (ps.has('dodge') && this.rng() < 0.25) { this.emit('passive', { id: 'dodge' }); continue; }   // 환왕
            const cls = W.CLASSES[this.s.job] || {};
            const pm = this.pmods();
            if (this.buffv.dodge && this.rng() < this.buffv.dodge) { this.emit('passive', { id: 'dodge' }); continue; }   // 유운보
            const env = this.envNow();
            if (env.dodge && this.rng() < env.dodge) { this.emit('passive', { id: 'dodge' }); continue; }                // 운무
            if (st.dodge && this.rng() < st.dodge) { this.emit('passive', { id: 'dodge' }); continue; }                  // 장비 회피 (v130)
            if (cls.fear && this.rng() < cls.fear + (pm.fearUp || 0) + (this.buffv.fear || 0)) {                                     // 극악소마: 공포
              this.emit('passive', { id: 'fear', at: m });
              const sbf = this.setBonus();
              if (sbf.fearVuln && !(m.vulnT > this.clock && m.vulnV > sbf.fearVuln)) { m.vulnT = this.clock + 3; m.vulnV = sbf.fearVuln; }   // 귀혼소음 3
              if (sbf.maskAlways && this.s.job === 'ring') this.strike(m, st, sbf.maskAlways, 'mask');              // 귀혼소음 5
              else if (pm.own5 && this.s.job === 'ring') this.strike(m, st, 1.5, 'mask');                       // 무면귀 5: 가면의 일격
              continue;
            }
            const red = (1 - (cls.dmgRed || 0)) * (1 - (this.buffv.guard || 0)) * (1 - Math.min(0.6, pm.dmgRed || 0)) * (1 - (st.dmgRed || 0));
            const dmg = Math.max(1, m.atk * (1 + (env.mobAtk || 0)) * (0.9 + this.rng() * 0.2) * red * this.gapIn(m) - st.def);
            let left = dmg;
            if (this.shield > 0 && this.buffs.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; }   // 금종조
            this.heroHp -= left;
            this.emit('heroHit', { amount: left, shielded: dmg - left });
            if (ps.has('reflect')) this.hurt(m, dmg * 0.4, 'reflect', false);                                 // 철왕
            { const isp = this.impSpecials();                                                                  // 증표 고유 (v163)
              if (isp.mirror && m.alive) this.hurt(m, dmg * Math.min(0.8, 0.15 * isp.mirror.p), 'reflect', false);
              if (isp.frenzy && this.rng() < Math.min(0.5, 0.08 * isp.frenzy.p)) { this.buffs.gale = Math.max(this.buffs.gale || 0, 4); this.buffv.haste = Math.max(this.buffv.haste || 0, 0.3); this.impShow(isp.frenzy, null); } }
            if (st.thorns && m.alive) this.hurt(m, dmg * st.thorns, 'reflect', false);                       // 되돌림 (v130)
            if (ps.has('revive') && this.heroHp > 0 && this.heroHp < st.hp * 0.3 && !(this.reviveCd > 0)) {   // 목왕
              this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.5);
              this.reviveCd = 60;
              this.emit('passive', { id: 'revive' });
            }
            if (this.heroHp <= 0) { this.heroDied(m); return; }
          }
        }
      } else {
        // 난 자리 둘레(두 칸 안)를 한 칸씩 어슬렁거린다
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = 1.5 + this.rng() * 3;
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const [dc, dr] = dirs[Math.floor(this.rng() * 4)];
          const c = m.c + dc, r = m.r + dr;
          if (this.inMap(c, r) && Math.abs(c - m.hc) + Math.abs(r - m.hr) <= 2 && !this.occupied(c, r, m)) m.move = { c, r };
        }
      }
    }
  }

  tickPotion(st) {
    // 자동 보충 — 사냥터에서도 상인이 따라다니는 셈 (방치 사냥이 물약 때문에 멈추지 않게)
    if (this.s.autoRefill && this.s.potions < 10) {
      const n = Math.min(50 - this.s.potions, Math.floor(this.s.gold / this.potionPrice()));
      if (n > 0) this.buyPotions(n);
    }
    if (!this.s.autoPotion || this.potionT > 0 || this.s.potions <= 0) return;
    if (D.TOWER_NO_POTION && this.inst?.kind === 'tower') return;
    if (this.heroHp < st.hp * W.POTION_AT) this.drinkPotion();
  }
  drinkPotion() {
    if (D.TOWER_NO_POTION && this.inst?.kind === 'tower') return false;
    const st = this.stats();
    if (this.s.potions <= 0 || this.heroHp >= st.hp) return false;
    this.s.potions--;
    this.potionT = W.POTION_GAP;
    this.heroHp = Math.min(st.hp, this.heroHp + st.hp * W.POTION_HEAL);
    this.note(0, 0, 0, 1);
    this.emit('potion', { left: this.s.potions });
    return true;
  }

  tickHero(dt, st) {
    // 칸 사이를 옮겨 가는 중이면 마저 간다 — 칸 가운데에 서야 다음 일을 정한다
    if (this.hmove) {
      this.walking = true;
      if (this.slide(this, 'heroX', 'heroY', this.hmove, W.HERO_SPEED * (st.moveSpeed || 1) * (1 + (this.buffv.move || 0)) * Math.max(0.3, 1 + (this.envNow().move || 0)), dt)) { this.hc = this.hmove.c; this.hr = this.hmove.r; this.hmove = null; }
      else { this.moveSkills(st); return; }
    }
    this.holdApproach = false;
    if (this.autoDodge && this.inst) { const d = this.dodgeStep(); if (d === 'moved') return; this.holdApproach = d === 'hold'; }
    // 사냥터 두목 방(v148): 방치 중에도 바닥 경고를 피한다 — 단, 경고가 깔리고 조금 뒤에야(반응이 늦어 가끔 맞는다). 직접 끌면 다 피한다.
    else if (!this.inst && this.tells.length && this.huntOn()) { const d = this.dodgeStep(W.FIELD_REACT); if (d === 'moved') return; this.holdApproach = d === 'hold'; }
    // 조이스틱 — 누르고 있는 동안 그 방향으로 한 칸씩 (막히면 다른 축으로). 그동안은 치지 않는다.
    if (this.joy) {
      this.manual = null;
      const { dx, dy } = this.joy;
      const sx = Math.sign(dx), sy = Math.sign(dy);
      const tries = Math.abs(dx) >= Math.abs(dy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
      let moved = false;
      for (const [a, b] of tries) { if ((a || b) && this.stepTo({ c: this.hc + a, r: this.hr + b })) { moved = true; break; } }
      if (moved && !this.s.did?.move) this.mark('move');
      if (!moved) this.walking = false;
      this.manualHold = 0.8;
      this.moveSkills(st);
      return;
    }
    // 손으로 찍은 칸이 있으면 거기로 먼저 간다
    if (this.manual) {
      if (this.hc === this.manual.c && this.hr === this.manual.r) { this.manual = null; this.manualHold = 1.2; } else {
        if (!this.stepHero(this.manual.c, this.manual.r)) { this.manual = null; this.manualHold = 0.6; }
        this.moveSkills(st);
        return;
      }
    }
    if (this.manualHold > 0) { this.manualHold -= dt; this.walking = false; return; }
    // 과녁: 나를 치고 있는 몹 → 가장 가까운 몹. 자동 사냥이 꺼져 있으면 붙어 있는 것만 친다.
    if (!this.mon?.alive) this.mon = this.pickTarget(st);
    // 두목 구역: 졸개를 치던 중에도 두목이 나서면 바로 두목에게 (손으로 찍어 움직이는 중은 빼고)
    else if (!this.mon.treasure && !this.manual && this.mons.some((o) => o.alive && o.treasure && !(o.unreachUntil > this.clock)) && this.huntOn()) this.mon = this.pickTarget(st);
    else if ((this.map.bossRoom || this.map.bossFirst) && !this.mon.isBoss && !this.manual) {
      const b = this.pickTarget(st);
      if (b?.isBoss) this.mon = b;
    }
    const m = this.mon;
    if (!m) { this.walking = false; return; }
    const mt = this.mobTile(m);
    const dist = this.tileDist({ c: this.hc, r: this.hr }, mt);
    this.heroAngle = Math.atan2((m.y - this.heroY) * 0.6, m.x - this.heroX);
    if (Math.abs(m.x - this.heroX) > 6) this.heroFacing = m.x >= this.heroX ? 1 : -1;
    if (this.s.autoSkill) this.autoSkills(st);
    if (!this.mon?.alive) return;
    if (dist > st.range) {
      if ((!this.huntOn() && !m.aggro) || this.holdApproach) { this.walking = false; return; }
      // 칠 수 있는 빈 칸(사거리 안)까지 길을 찾는다. 길이 없으면 이 과녁은 잠깐 두고 다른 몹을 잡는다.
      const f = this.findStep(this.hc, this.hr, (c, r) => this.tileDist({ c, r }, this.mobTile(m)) <= st.range, 'hero');
      if (!f || f === 'here' || !this.stepTo(f)) { this.walking = false; this.giveUp(m); }
      return;
    }
    this.walking = false;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = st.atkSec / (this.frenzyT > 0 ? 1.5 : 1) / (1 + (this.buffv.haste || 0)) / Math.max(0.3, 1 + (this.envNow().speed || 0));
      this.basicAttack(m, st, dist);
    }
  }

  // v157: 걸으면서도 무공을 펼친다 — 자동 무공이면 움직이는 동안에도 닿는 적에게 (평타는 서야 친다).
  // 과녁이 없으면(조이스틱으로 끌고 다닐 때) 가장 가까운 적을 잡는다.
  moveSkills(st) {
    if (!this.s.autoSkill || this.map.town || !this.mons.length) return;
    if (!this.mon?.alive || this.mon.npc) {
      let best = null, bd = W.MOVE_CAST_R;
      for (const m of this.mons) {
        if (!m.alive || m.npc || m.introT > 0) continue;
        const d = Math.hypot(m.x - this.heroX, m.y - this.heroY);
        if (d < bd) { bd = d; best = m; }
      }
      if (!best) return;
      this.mon = best;
    }
    this.autoSkills(st);
  }
  // 무공이 닿는 곳 (v157 · 범위 보기) — center: 'me' 내 둘레 | 'target' 과녁 둘레, r: 반지름(px), reach: 과녁까지 닿는 거리(px)
  skillReach(sk) {
    if (sk.kind === 'support' || sk.kind === 'awaken' || sk.kind === 'clone') return null;
    if (sk.kind === 'triple') return { center: 'me', r: 300, reach: 0 };
    if (sk.kind === 'single') return { center: 'target', r: this.skillMods(sk.id).splash > 0 ? 140 : 0, reach: sk.far ? 420 : Math.max(this.stats().range, 160) * 1.6 };
    return { center: this.ranged() ? 'target' : 'me', r: this.skillRadius(sk), reach: this.ranged() ? 9999 : 0 };
  }

  // 닿을 수 없는 과녁 — 4초 동안 고르지 않는다
  giveUp(m) {
    if (m) m.unreachUntil = this.clock + 4;
    this.mon = null;
  }
  // 목표 칸까지 길을 찾아 한 칸 떠난다. 못 가면 false. (손으로 찍은 칸이 막혀 있으면 그 옆까지)
  stepHero(tc, tr) {
    const f = this.findStep(this.hc, this.hr, (c, r) => (c === tc && r === tr) || (this.occupied(tc, tr, 'hero') && Math.abs(c - tc) + Math.abs(r - tr) === 1), 'hero');
    if (!f || f === 'here') return false;
    return this.stepTo(f);
  }
  stepTo(o) {
    if (!this.inMap(o.c, o.r) || this.occupied(o.c, o.r, 'hero')) return false;
    this.hmove = { c: o.c, r: o.r };
    if (o.c !== this.hc) this.heroFacing = o.c > this.hc ? 1 : -1;
    this.heroAngle = Math.atan2((o.r - this.hr) * 0.6, o.c - this.hc);
    this.walking = true;
    return true;
  }

  pickTarget(st) {
    // 보물 원숭이가 나오면 그것부터 (v127)
    const tr = this.mons.find((m) => m.alive && m.treasure && !(m.unreachUntil > this.clock));
    if (tr && this.huntOn()) return tr;
    // 두목 구역에서는 두목부터 (v125) — 등장 연출 중이거나 길이 막혀 포기한 동안만 졸개를 친다
    if (this.map.bossRoom || this.map.bossFirst) {
      const b = this.mons.find((m) => m.alive && m.isBoss && !(m.introT > 0) && !(m.unreachUntil > this.clock));
      if (b) return b;
    }
    let best = null;
    let bd = Infinity;
    const h = { c: this.hc, r: this.hr };
    for (const m of this.mons) {
      if (!m.alive || m.npc || m.introT > 0 || m.unreachUntil > this.clock) continue;
      let d = this.tileDist(h, this.mobTile(m));
      if (m.aggro) d *= 0.5;                          // 나를 치러 오는 놈 먼저
      if (!this.huntOn() && d > st.range * 1.2 && !m.aggro) continue;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 손으로 들판을 찍으면 그 칸으로 간다 (들판 좌표)
  moveTo(x, y) {
    if (this.map.town) return;
    this.manual = { c: clamp(Math.floor(x / W.TILE), 0, W.COLS - 1), r: clamp(Math.floor(y / W.TILE), 0, W.ROWS - 1) };
    this.mon = null;
  }

  // ---------- 싸움 ----------
  basicAttack(m, st, dist) {
    const close = dist <= W.MELEE_RANGE * 1.3;
    this.emit('attack', { close });
    let mult = 1;
    if (this.s.job === 'ring' && close) mult *= 1.2;
    const cls0 = W.CLASSES[this.s.job] || {};
    const pm = this.pmods();
    // 권마: 평타가 곧 무공 — 레벨만큼 + 투신심법
    if (cls0.basicPerLv) mult *= (cls0.basicBase ?? 1) + cls0.basicPerLv * this.s.level + (pm.basicUp || 0);
    const ps = this.passives();
    // 권왕: 세 번째마다 ×3
    if (ps.has('combo') && (this.comboN = (this.comboN || 0) + 1) % 3 === 0) { mult *= 3; this.emit('passive', { id: 'combo', at: m }); }
    const tx = m.x, ty = m.y;
    this.strike(m, st, mult, 'hit');
    // 투신강림: 한 번에 세 대
    const sb = this.setBonus();
    for (let k = 0; k < (this.buffv.triple ? this.buffv.triple + (sb.tripleUp || 0) : 0) && m.alive; k++) this.strike(m, st, mult * 0.5, 'hit');   // 덧 두 대는 절반
    const cls = W.CLASSES[this.s.job] || {};
    // 검사 일화: 네 번째마다 꽃잎 검기가 과녁 둘레를 벤다
    if (cls.flower && (this.flowerN = (this.flowerN || 0) + 1) % Math.min(pm.own5 ? 3 : cls.flower.every, sb.flowerEvery || 99) === 0) {
      this.emit('passive', { id: 'flower', at: { x: tx, y: ty } });
      const fr = cls.flower.r * (1 + (sb.flowerR || 0));
      for (const o of this.mons.slice()) {
        if (!o.alive || o.npc || Math.hypot(o.x - tx, (o.y - ty) * 0.75) > fr) continue;
        const d = this.strike(o, st, mult * cls.flower.mult * (1 + (pm.flowerUp || 0)), 'flower');
        if (sb.flowerBleed && o.alive) this.addDot(o, d * sb.flowerBleed, 3);     // 매화검진 5
      }
    }
    // 투신심법 5: 다섯 번째 평타마다 투신일격
    if (this.s.job === 'fist' && pm.own5 && (this.fistN = (this.fistN || 0) + 1) % 5 === 0) {
      this.emit('passive', { id: 'tusin', at: { x: tx, y: ty } });
      if (m.alive) this.strike(m, st, mult * 2, 'tusin');
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= 160) this.strike(o, st, mult * 0.5, 'tusin');
    }
    // 권마 불패금신: 평타가 둘레를 친다
    const cleave = Math.max(this.buffv.cleave || 0, sb.cleaveAlways || 0);    // 철권투혼 5: 늘
    if (cleave) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - this.heroX, (o.y - this.heroY) * 0.75) <= 150) this.strike(o, st, mult * cleave, 'cleave');
    }
    // 검왕: 평타가 둘레 모든 적을 벤다
    if (ps.has('formless')) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= 120) this.strike(o, st, mult * 0.7, 'cleave');
    }
  }

  strike(m, st, mult, kind, extraCrit = 0, quiet = false) {
    const crit = this.rng() < st.crit + extraCrit + (this.envNow().crit || 0);
    let dmg = st.atk * mult * (crit ? st.critDmg : 1) * (0.92 + this.rng() * 0.16);
    if (m.isBoss) dmg *= st.boss;
    if (m.vulnT > this.clock) dmg *= 1 + m.vulnV;              // 섭혼: 받는 피해 +
    if (this.buffv.might) dmg *= 1 + this.buffv.might;          // 삼공조화
    if (crit && this.buffv.critUp) dmg *= 1 + this.buffv.critUp / st.critDmg;   // 무면개방
    const ps = this.passives();
    if (ps.size) {
      if (ps.has('bossbane') && m.isBoss) dmg *= 1.5;                       // 투왕
      if (ps.has('execute') && m.hp < m.maxHp * 0.4) dmg *= 1.6;           // 암왕
    }
    const isp = this.impSpecials();
    if (isp.execute && m.hp < m.maxHp * 0.3) dmg *= 1 + Math.min(1.5, 0.25 * isp.execute.p);
    if (isp.bane && m.isBoss) dmg *= 1 + Math.min(0.8, 0.12 * isp.bane.p);
    dmg = Math.max(1, (dmg - m.armor) * this.gapOut(m));
    const mx = m.x, my = m.y;
    const wasAlive = m.alive;
    this.hurt(m, dmg, kind, crit, quiet);
    this.impOnHit(m, st, dmg, kind, crit, wasAlive, isp);
    if (ps.size) {
      if (ps.has('drain')) this.heroHp = Math.min(st.hp, this.heroHp + dmg * 0.04);     // 혈왕
      if (ps.has('stun') && /^s\d$/.test(kind) && m.alive) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.75 : 1.5);   // 음왕
      if (ps.has('petal') && crit && kind !== 'petal') {                     // 화왕
        for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - mx, (o.y - my) * 0.75) <= 130) this.hurt(o, dmg * 0.6, 'petal', false);
      }
    }
    const cls = W.CLASSES[this.s.job] || {};
    if (m.alive && cls.slow) m.slow = 2.5;
    const pm = this.pmods();
    if (m.alive && cls.vuln) {
      const vv = cls.vuln + (pm.vulnUp || 0);
      if (pm.own5 && m.vulnT > this.clock && this.rng() < 0.1) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.4 : 1);   // 섭혼대법 5
      if (!(m.vulnT > this.clock && m.vulnV > vv)) { m.vulnT = this.clock + 3; m.vulnV = vv; }
    }
    if (cls.drain) this.heroHp = Math.min(st.hp, this.heroHp + dmg * (cls.drain + (pm.drainUp || 0)));
    if (st.drain) this.heroHp = Math.min(st.hp, this.heroHp + dmg * st.drain);                     // v130 피해 흡수
    if (st.stunHit && m.alive && this.rng() < st.stunHit) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.3 : 0.8);
    if (m.alive && cls.poison && kind !== 'poison') this.addDot(m, dmg * (cls.poison + (pm.poisonUp || 0)), cls.poisonSec || 3);
    return dmg;
  }
  // ---------- 증표 각인 (v163) ----------
  // 끼고 있는 장비의 고유 효과 — { kind: { p, id, name, kind, col } } (p = 새겨진 칸들의 무게 합)
  impSpecials() {
    const sig = this.statSig();
    if (this._isp?.sig === sig) return this._isp.v;
    const v = {};
    for (const it of Object.values(this.s.equip)) for (const im of IM.imprintsOf(it)) {
      const sp = im.special;
      if (!sp) continue;
      const cur = v[sp.kind];
      if (!cur || cur.id === sp.id) v[sp.kind] = { ...sp, p: (cur?.p || 0) + im.w, col: IM.THEMES[im.theme].col };
      else cur.p += im.w * 0.5;                    // 다른 두목의 같은 꼴은 반만 더한다
    }
    this._isp = { sig, v };
    return v;
  }
  // 고유 효과 이름을 띄운다 (잦은 것은 0.5초에 한 번만)
  impShow(sp, at) {
    if ((this._impT || 0) > this.clock) return;
    this._impT = this.clock + 0.5;
    this.emit('imprint', { name: sp.name, kind: sp.kind, col: sp.col, at: at || { x: this.heroX, y: this.heroY } });
  }
  impOnHit(m, st, dmg, kind, crit, wasAlive, isp) {
    if (kind === 'imp' || kind === 'poison' || kind === 'reflect') return;
    // 테마: 독·화상은 웅덩이로, 빙결은 둔화, 뇌전은 옆 적으로
    if (m.alive && st.venom) this.addDot(m, dmg * st.venom, 3);
    if (m.alive && st.burn) this.addDot(m, dmg * st.burn, 2);
    if (m.alive && st.chill && this.rng() < st.chill) m.slow = Math.max(m.slow || 0, 2);
    if (st.shock && this.rng() < st.shock) {
      const o = this.nearOther(m, 220);
      if (o) { this.hurt(o, dmg * 0.5, 'imp', false, true); this.emit('tfHit', { tf: 'thunder', at: { x: m.x, y: m.y }, to: { x: o.x, y: o.y } }); }
    }
    // 고유
    if (isp.echo && m.alive && this.rng() < Math.min(0.5, 0.06 * isp.echo.p)) { this.hurt(m, dmg * 1.5, 'imp', crit); this.impShow(isp.echo, m); }
    if (isp.chain && crit) {
      let n = 0;
      for (const o of this.mons) {
        if (n >= 2) break;
        if (!o.alive || o.npc || o === m || Math.hypot(o.x - m.x, o.y - m.y) > 240) continue;
        this.hurt(o, dmg * Math.min(2, 0.6 * isp.chain.p), 'imp', false, true);
        this.emit('tfHit', { tf: 'thunder', at: { x: m.x, y: m.y }, to: { x: o.x, y: o.y } });
        n++;
      }
      if (n) this.impShow(isp.chain, m);
    }
    if (isp.reap && wasAlive && !m.alive) this.heroHp = Math.min(st.hp, this.heroHp + st.hp * Math.min(0.1, 0.02 * isp.reap.p));
  }
  nearOther(m, r) {
    let best = null, bd = r;
    for (const o of this.mons) { if (!o.alive || o.npc || o === m) continue; const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  // 때를 두고 터지는 고유 효과 — 둘레 폭발 · 쏟아짐 · 보호막
  tickImprint(dt, st) {
    const isp = this.impSpecials();
    if (!isp.nova && !isp.rain && !isp.guard) return;
    if (this.map.town || !this.mons.some((m) => m.alive && !m.npc)) return;
    const T = this._impTimers || (this._impTimers = { nova: 2, rain: 3, guard: 0 });
    if (isp.nova && (T.nova -= dt) <= 0) {
      T.nova = Math.max(4, 10 - Math.round(2 * isp.nova.p));
      const hit = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) <= 230);
      if (hit.length) { for (const m of hit) this.hurt(m, st.atk * 2 * isp.nova.p * (m.isBoss ? st.boss : 1), 'imp', false, true); this._impT = 0; this.impShow(isp.nova, null); this.emit('impNova', { r: 230, col: isp.nova.col }); }
      else T.nova = 0.5;
    }
    if (isp.rain && (T.rain -= dt) <= 0) {
      T.rain = Math.max(5, 11 - Math.round(2 * isp.rain.p));
      const near = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, m.y - this.heroY) <= 420).slice(0, 5);
      if (near.length) { for (const m of near) { this.hurt(m, st.atk * 1.2 * isp.rain.p * (m.isBoss ? st.boss : 1), 'imp', false, true); this.emit('impRain', { at: { x: m.x, y: m.y }, col: isp.rain.col }); } this._impT = 0; this.impShow(isp.rain, null); }
      else T.rain = 0.5;
    }
    if (isp.guard && (T.guard -= dt) <= 0) {
      T.guard = 12;
      this.shield = Math.max(this.shield || 0, st.hp * Math.min(0.3, 0.06 * isp.guard.p));
      this.buffs.shield = Math.max(this.buffs.shield || 0, 12);
      this._impT = 0; this.impShow(isp.guard, null);
    }
  }

  // 독·출혈: total만큼을 웅덩이에 붓는다 — 쌓인다(빠르기는 마지막에 부은 sec쯤)
  addDot(m, total, sec) {
    const sb = this.setBonus();
    total *= (1 + (sb.dotUp || 0)) * (sb.bossDot && m.isBoss ? 2 : 1);     // 암천독야
    m.dot = (m.dot || 0) + total;
    m.dotTau = sec / 2;
    m.poison = sec;
  }

  hurt(m, dmg, kind, crit, quiet = false) {
    if (!m.alive || m.introT > 0) return;
    // 함께 잡는 왕: 친 만큼 모아 서버에 올리고, 쓰러뜨리는 건 서버가 정한다(내 화면에서 먼저 죽지 않는다)
    if (m.coopSeq != null && this.coop?.on) {
      const d = Math.min(dmg, Math.max(0, m.hp - 1));
      this.coop.dealt(m, Math.min(dmg, m.hp));
      m.hp -= d;
      m.aggro = true;
      if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
      return;
    }
    m.hp -= dmg;
    m.aggro = true;
    if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m) {
    m.alive = false;
    m.hp = 0;
    this.s.kills++;
    // 독마: 중독된 채 쓰러지면 독이 둘레로 번진다
    if (W.CLASSES[this.s.job]?.spread && m.dot > 0) {
      const left = m.dot;
      m.dot = 0;
      const sb0 = this.setBonus();
      const k = (this.pmods().own5 ? 1.2 : 0.6) * (sb0.spreadUp ? 2 : 1);   // 만독불침 5 · 만목독림 5: 두 배로
      for (const o of this.mons) if (o.alive && !o.npc && o !== m && Math.hypot(o.x - m.x, (o.y - m.y) * 0.75) <= 140) { this.addDot(o, left * k, 4); if (sb0.spreadUp) o.slow = 2.5; }
    }
    if (this.passives().has('frenzy')) this.frenzyT = 4;
    const sbk = this.setBonus();
    if (sbk.killHeal) { const hp = this.stats().hp; this.heroHp = Math.min(hp, this.heroHp + hp * sbk.killHeal); }     // 혈해마공 5
    if (sbk.killCdr) for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - sbk.killCdr);          // 명부살겁 5
    if (m === this.mon) this.mon = null;
    // 던전 안: 보상은 끝날 때 한꺼번에 (들판 벌이·드랍은 없다)
    if (this.inst) {
      this.emit('kill', { gold: 0, isBoss: m.isBoss, add: true, at: m, mat: null });
      this.instKill(m);
      return;
    }
    const st = this.stats();
    const env = this.envNow();
    const mlv = this.masteryLevel(this.map.zone);
    if (m.treasure) return this.killTreasure(m, st, env);
    const exp = W.mobExp(m.lv) * (m.isBoss ? W.BOSS.exp : m.elite ? W.ELITE.exp : 1) * this.levelGapMult(m.lv) * (st.expMult || 1) * (1 + (env.exp || 0) + mlv * L.MASTERY.exp);
    const gold = Math.round(W.mobGold(m.lv) * (m.isBoss ? W.BOSS.gold : m.elite ? W.ELITE.gold : 1) * (1 + (env.gold || 0) + (st.gold || 0)));
    this.s.gold += gold;
    const mat = this.dropMats(m);
    if (m.elite) this.dropMats(m);
    this.addMastery(this.map.zone, 1);
    // 보물 원숭이 — 들판에서 가끔 (하나만)
    if (!this.map.bossRoom && this.rng() < L.TREASURE_RATE && !this.mons.some((o) => o.alive && o.treasure)) this.spawnTreasure();
    this.emit('kill', { gold, isBoss: m.isBoss, add: true, at: m, mat });
    this.addExp(exp);
    this.note(1, exp, gold, 0);
    this.petExp(exp * 0.5);
    // 탈것 — **두목만** 떨군다. 졸개 드랍(0.005%)은 없앴다: 2만 마리에 하나라
    // 사실상 없는 것인데 '어디서나 나온다'는 착각만 줬다.
    if (m.isBoss && this.rng() < W.mountBossRate(this.map.mz)) {
      this.gainMount(W.rollMount(this.rng, this.map.mz, true), m);
    }
    if (!m.isBoss) this.respawns.push({ t: W.RESPAWN_SEC });
  }

  // 레벨 차이 (v149) — 나보다 높은 몹에게는 내 피해가 줄고 그 몹의 공격은 더 아프다(사냥터만, 던전·탑은 따로 맞춰 둠).
  // 레벨 제한을 없앤 뒤 레벨 60이 십이지왕(99~)을 잡고 다녔다 — 갈 수는 있되 힘들게.
  gapOf(m) { return this.inst ? 0 : Math.max(0, (m.lv || 0) - this.s.level); }
  gapOut(m) { const g = this.gapOf(m); return g ? Math.max(W.GAP_OUT_MIN, 1 - W.GAP_OUT * g) : 1; }
  gapIn(m) { return 1 + W.GAP_IN * this.gapOf(m); }
  // 나보다 많이 약한 몹은 경험치가 깎인다 — 낮은 사냥터에 눌러앉는 것보다 올라가는 게 낫게
  levelGapMult(mlv) {
    const gap = this.s.level - mlv;
    return gap <= 5 ? 1 : Math.max(0.1, 1 - (gap - 5) * 0.08);
  }

  heroDied(by) {
    // 던전에서 쓰러지면 잃는 것 없이 그 판만 끝난다
    if (this.inst) {
      this.heroHp = this.stats().hp;
      if (!this.inst.done) this.inst.done = { ok: false, died: true };
      this.emit('heroDied', { boss: !!by?.isBoss, loss: 0, inst: true });
      return;
    }
    this.heroHp = 0;
    this.s.deaths++;
    const loss = Math.floor(this.s.exp * W.DEATH_EXP_LOSS);
    this.s.exp -= loss;
    // 레벨보다 한참 센 곳에서 쓰러지면 돌아갈 곳을 알맞은 사냥터로 바꾼다 — 방치하다 같은 자리에서 계속 쓰러지지 않게
    let retreat = null;
    if (this.danger(this.map.id) > W.DANGER_LV && this.s.autoHunt) {
      this.s.huntMap = this.safeMap();
      retreat = W.mapOf(this.s.huntMap).name;
    }
    this.emit('heroDied', { boss: !!by?.isBoss, loss, retreat });
    this.heroHp = 1;
    this.goTown(true);
  }

  // ---------- 스킬 ----------
  skills() { return this.s.job ? W.skillsOf(this.s.job).filter((k) => this.knows(k)) : []; }
  // 배웠나 — 공격 무공은 전직 차수, 보조기는 레벨(v120)
  knows(sk) { return !!sk && (sk.kind === 'support' ? this.s.level >= sk.from : sk.tier <= this.s.jobTier); }
  skillDef(id) { return this.s.job ? W.skillsOf(this.s.job).find((k) => k.id === id) : null; }
  hpCostOf(sk) { return Math.round(this.stats().hp * (sk.hpCost || 0) * (1 - this.skillMods(sk.id).cost)); }
  skillRadius(sk) { return (sk.radius || 0) * Math.max(0.3, 1 + this.skillMods(sk.id).range + (this.stats().skillRange || 0)); }
  skillCd(sk) {
    const sb = this.setBonus();
    return sk.cd * (1 - this.skillMods(sk.id).cd) * Math.max(0.5, 1 + (this.envNow().cd || 0)) * (1 - (this.stats().cdr || 0)) * (sk.slot === 4 ? 1 - (sb.cd4 || 0) : 1);
  }
  canUseSkill(id) {
    const sk = this.skillDef(id);
    if (!this.knows(sk) || this.cd[id] > 0 || this.map.town) return false;
    if (this.heroHp <= this.hpCostOf(sk) + 1) return false;      // 대가로 죽지는 않는다
    return true;
  }
  // o.free: 삼공합일이 대신 펼칠 때 — 숨·체력을 따지지 않고, 연출·삼공조화 셈도 건너뛴다. o.boost: 배수
  useSkill(id, o = {}) {
    if (!o.free && !this.canUseSkill(id)) return false;
    const sk = this.skillDef(id);
    const st = this.stats();
    if (sk.kind === 'support') return this.useSupport(sk, st);
    if (sk.kind === 'awaken') { const c = this.hpCostOf(sk); this.heroHp -= c; if (c) this.emit('hpCost', { amount: c }); return this.useSupport(sk, st); }
    if (sk.kind === 'clone') return this.useClone(sk, st);
    if (sk.kind === 'triple') return this.useTriple(sk, st);
    const tgt = this.mon?.alive ? this.mon : this.pickTarget({ ...st, range: 9999 });
    if (sk.kind === 'single' && !tgt) return false;
    if (sk.kind === 'single' && !sk.far && Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > Math.max(st.range, 160) * 1.6) return false;
    if (sk.kind === 'single' && sk.far && Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > 420) return false;
    const md = this.skillMods(id);
    const cost = o.free ? 0 : this.hpCostOf(sk);
    this.heroHp -= cost;
    if (!o.free) this.cd[id] = this.skillCd(sk);
    const aimed = (sk.kind === 'aoe' || sk.kind === 'field') && this.ranged() && tgt;
    const center = aimed ? { x: tgt.x, y: tgt.y } : { x: this.heroX, y: this.heroY };
    const r = this.skillRadius(sk);
    if (!o.free) this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: sk.tier,
      at: center, radius: r, motion: sk.kind === 'single' ? 'single' : 'aoe', dur: 0 });
    if (cost) this.emit('hpCost', { amount: cost });
    // 스킬 레벨·장비 옵션: 피해 · 범위 · 치명 · (1차) 주변 적 · (신화) 한 번 더 · 숨 되돌리기
    const mult = sk.mult * st.skillMult * (1 + md.dmg) * (o.boost || 1);
    const crit = md.crit + (sk.sure ? 1 : 0) + (sk.crit || 0);
    const kills0 = this.s.kills;
    let dealt = 0;
    // 한 대 — 무공의 덧(기절·취약·독·두목 배수)을 함께 건다
    const sb = this.setBonus();
    const tf = md.tf || null;
    let tfShown = 0;
    const hit = (m, k = 1) => {
      if (!m.alive) return;
      const mx = m.x, my = m.y;
      const d = this.strike(m, st, mult * k * (m.isBoss && sk.bossMult ? sk.bossMult : 1), id, crit);
      dealt += d;
      // 무형검결 5: 1~3차가 맞을 때 가끔 무형검이 한 번 더
      if (sb.formlessProc && sk.slot <= 2 && m.alive && this.rng() < sb.formlessProc) { this.strike(m, st, mult * k * 1.5, 'formless', crit); this.emit('passive', { id: 'formless', at: { x: mx, y: my } }); }
      // 스킬 변화 (v130) — 화염·빙결·뇌전 (연출 알림은 한 번에 넷까지)
      if (tf) {
        const show = tfShown++ < 4;
        if (tf.fire && m.alive) { this.addDot(m, d * 0.3, 3); if (show) this.emit('tfHit', { tf: 'fire', at: { x: mx, y: my } }); }
        if (tf.ice && m.alive && this.rng() < 0.2) { m.stun = Math.max(m.stun || 0, m.isBoss ? 0.4 : 1); if (show) this.emit('tfHit', { tf: 'ice', at: { x: mx, y: my } }); }
        if (tf.thunder) {
          let o2 = null, bd = 220;
          for (const o of this.mons) { if (!o.alive || o.npc || o === m) continue; const dd = Math.hypot(o.x - mx, o.y - my); if (dd < bd) { bd = dd; o2 = o; } }
          if (o2) { if (show) this.emit('tfHit', { tf: 'thunder', at: { x: mx, y: my }, to: { x: o2.x, y: o2.y } }); this.strike(o2, st, mult * k * 0.4, 'thunder', crit); }
        }
        if ((tf.giant || tf.focus) && show && tfShown === 1) this.emit('tfHit', { tf: tf.giant ? 'giant' : 'focus', at: { x: mx, y: my } });
      }
      if (!m.alive) return;
      if (sk.stun) m.stun = Math.max(m.stun || 0, m.isBoss ? sk.stun * 0.4 : sk.stun);
      if (sk.vuln && !(m.vulnT > this.clock && m.vulnV > sk.vuln.v)) { m.vulnT = this.clock + sk.vuln.sec; m.vulnV = sk.vuln.v; }
      if (sk.dot) this.addDot(m, d * sk.dot.mult, sk.dot.sec);
    };
    const inR = (c, rr) => this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - c.x, (m.y - c.y) * 0.75) <= rr);
    const hitOnce = () => {
      for (let n = 0; n < (sk.hits || 1); n++) {
        if (sk.kind === 'single') {
          if (!tgt.alive) return;
          this.mon = tgt;
          const tx = tgt.x, ty = tgt.y;
          hit(tgt);
          if (md.splash > 0) for (const m of inR({ x: tx, y: ty }, 140)) if (m !== tgt) hit(m, md.splash);
        } else if (sk.kind === 'daggers') {
          // 가까운 적부터 targets명에게 비수 n자루를 돌려 가며
          const near = inR(center, r).sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)).slice(0, sk.targets);
          for (let i = 0; i < sk.n + (sb.daggersUp || 0) && near.length; i++) {
            const m = near[i % near.length];
            if (m.alive) hit(m);
          }
        } else {
          for (const m of inR(center, r)) hit(m);
        }
      }
    };
    hitOnce();
    if (sb.echo0 && sk.slot === 0) { hitOnce(); this.emit('echo', { id, at: center }); }     // 혈해마공 5
    if (sk.kind === 'field') {
      const fu = sb.fieldUp || 0;                                                          // 만목독림 3
      this.fields.push({ id, x: center.x, y: center.y, r: r * (1 + fu), life: sk.field.sec + (fu ? 3 : 0), max: sk.field.sec + (fu ? 3 : 0), tick: sk.field.tick, t: sk.field.tick, mult: sk.field.mult * st.skillMult * (1 + md.dmg) });
    }
    if (md.echo && this.rng() < 0.3) { hitOnce(); this.emit('echo', { id, at: center }); }
    // 증표 각인: 한 번 더 — 그림도 한 번 더 펼친다 (v163)
    else if (md.echoP && !o.free && this.rng() < md.echoP) {
      hitOnce();
      this.emit('echo', { id, at: center });
      this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: sk.tier, at: center, radius: r, motion: sk.kind === 'single' ? 'single' : 'aoe', dur: 0, echo: true });
    }
    if (md.reset && this.s.kills > kills0) this.cd[id] = 0;
    if (sk.lifesteal) this.heroHp = Math.min(st.hp, this.heroHp + dealt * sk.lifesteal);
    if (sk.buff) {
      const b = sk.buff;
      if (b.speed) { this.buffs.gale = b.sec; this.buffv.haste = b.speed; }
      if (b.dmgRed) { this.buffs.guard = b.sec; this.buffv.guard = b.dmgRed; }
      if (b.cleave) { this.buffs.cleave = b.sec; this.buffv.cleave = b.cleave; }
      this.buffs.rage = b.sec;
    }
    if (o.free) return true;
    // 극악소마 삼공조화: 세 무공이 HARMONY.sec 안에 이어지면
    this.skillAt[sk.slot] = this.clock;
    if (this.s.job === 'ring' && [0, 1, 2].every((k) => this.skillAt[k] != null && this.clock - this.skillAt[k] <= W.HARMONY.sec)) {
      this.buffs.might = W.HARMONY.buffSec; this.buffv.might = W.HARMONY.dmgUp + (this.setBonus().harmonyUp || 0); this.buffs.rage = W.HARMONY.buffSec;
      this.skillAt = {};
      this.emit('passive', { id: 'harmony' });
    }
    return true;
  }
  // 보조기 (v120) — 스킬 레벨이 오를수록 세진다(피해 몫 7%/레벨을 세기로)
  useSupport(sk, st) {
    const id = sk.id;
    const md = this.skillMods(id);
    const pow = 1 + md.dmg;
    this.cd[id] = this.skillCd(sk);
    const at = { x: this.heroX, y: this.heroY };
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: 3, at, radius: sk.radius || 0, motion: 'buff', dur: sk.buff?.sec || 0 });
    const b = sk.buff || {};
    const set = (k, v) => { this.buffs[k] = b.sec; this.buffv[k] = v; };
    if (b.move) set('move', b.move * pow);
    if (b.speed) { set('haste', Math.max(this.buffv.haste || 0, b.speed * pow)); this.buffs.gale = b.sec; }
    if (b.dodge) set('dodge', Math.min(0.6, b.dodge * pow));
    if (b.dmgRed) set('guard', Math.min(0.8, Math.max(this.buffv.guard || 0, b.dmgRed * pow)));
    if (b.fear) set('fear', b.fear * pow);
    if (b.critDmg) set('critUp', b.critDmg * pow);
    if (b.triple) set('triple', b.triple);
    if (sk.shield) { this.shield = st.hp * sk.shield * pow; this.buffs.shield = b.sec; this.buffv.shield = 1; }
    if (sk.heal) {
      const add = (st.hp - this.heroHp) * Math.min(1, sk.heal * pow);
      this.heroHp = Math.min(st.hp, this.heroHp + add);
      this.emit('heal', { amount: add });
    }
    if (sk.burst) {
      // 만독귀원: 둘레 적에게 쌓인 독을 한꺼번에 터뜨린다
      for (const m of this.mons.slice()) {
        if (!m.alive || m.npc || !(m.dot > 0) || Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) > sk.radius) continue;
        const d = m.dot * sk.burst * pow;
        m.dot = 0;
        this.hurt(m, d, id, false);
      }
    }
    if (sk.healMax) {
      const add = Math.min(st.hp - this.heroHp, st.hp * sk.healMax * pow);
      this.heroHp += add;
      this.emit('heal', { amount: add });
    }
    if (b.sec) this.buffs.rage = Math.max(this.buffs.rage || 0, Math.min(b.sec, 3));
    return true;
  }
  // 삼공합일 — 혈앙지·마극광폭장·소향비술을 한꺼번에(boost배) 펼치고 삼공조화를 바로 켠다
  useTriple(sk, st) {
    const id = sk.id;
    const cost = this.hpCostOf(sk);
    this.heroHp -= cost;
    this.cd[id] = this.skillCd(sk);
    const at = this.mon?.alive ? { x: this.mon.x, y: this.mon.y } : { x: this.heroX, y: this.heroY };
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: 4, at, radius: 340, motion: 'aoe', dur: 0 });
    if (cost) this.emit('hpCost', { amount: cost });
    for (const k of ['s0', 's1', 's2']) this.useSkill(k, { free: true, boost: sk.boost });
    this.buffs.might = W.HARMONY.buffSec; this.buffv.might = W.HARMONY.dmgUp + (this.setBonus().harmonyUp || 0); this.buffs.rage = W.HARMONY.buffSec;
    this.skillAt = {};
    this.emit('passive', { id: 'harmony' });
    return true;
  }
  // 환영분신술 — 분신 n이 나와 둘레를 한 번씩 치고, sec초 동안 무인 곁에서 함께 싸운다
  useClone(sk, st) {
    const id = sk.id;
    const cost = this.hpCostOf(sk);
    const md = this.skillMods(id);
    this.heroHp -= cost;
    this.cd[id] = this.skillCd(sk);
    const at = { x: this.heroX, y: this.heroY };
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: 4, at, radius: sk.radius, motion: 'aoe', dur: sk.sec });
    if (cost) this.emit('hpCost', { amount: cost });
    const mult = st.skillMult * (1 + md.dmg);
    const sb = this.setBonus();
    const cn = sk.n + (sb.cloneUp || 0), csec = sk.sec + (sb.cloneSec || 0);      // 환영미혼 5
    this.clones = Array.from({ length: cn }, (_, i) => ({ i, life: csec, max: csec, atkT: 0.3 + i * 0.15, mult: sk.mult * mult, crit: md.crit }));
    // 나오면서 한 번씩 — 분신마다 둘레를 친다
    for (let k = 0; k < cn; k++) {
      for (const m of this.mons.slice()) if (m.alive && !m.npc && Math.hypot(m.x - at.x, (m.y - at.y) * 0.75) <= sk.radius) this.strike(m, st, sk.burst * mult, id, md.crit);
    }
    return true;
  }
  tickClones(dt, st) {
    if (!this.clones.length) return;
    for (const c of this.clones) {
      c.life -= dt;
      c.atkT -= dt;
      if (c.atkT > 0 || c.life <= 0) continue;
      c.atkT = st.atkSec * 1.1;
      // 분신은 무인의 과녁을, 없으면 가까운 적을 친다
      let m = this.mon?.alive ? this.mon : null;
      if (!m) {
        let bd = 300;
        for (const o of this.mons) { if (!o.alive || o.npc) continue; const d = Math.hypot(o.x - this.heroX, o.y - this.heroY); if (d < bd) { bd = d; m = o; } }
      }
      if (!m) continue;
      this.emit('cloneHit', { i: c.i, at: { x: m.x, y: m.y } });
      this.strike(m, st, c.mult, 'clone', c.crit);
    }
    this.clones = this.clones.filter((c) => c.life > 0);
  }
  // 보조기를 지금 쓸까
  wantSupport(sk, st) {
    if (sk.auto === 'hurt') return this.heroHp < st.hp * (sk.hurtAt || 0.5);
    const near = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) <= 320);
    if (sk.auto === 'poisoned') return near.filter((m) => m.dot > 0).length >= 3 || near.some((m) => m.isBoss && m.dot > m.maxHp * 0.02);
    return near.length >= 4 || near.some((m) => m.isBoss);
  }
  autoSkills(st) {
    for (const sk of this.skills()) {
      if (this.cd[sk.id] > 0) continue;
      if (sk.kind === 'support' || sk.kind === 'awaken') { if (this.wantSupport(sk, st) && !(sk.autoAbove && this.heroHp < st.hp * sk.autoAbove)) this.useSkill(sk.id); continue; }
      if (sk.kind === 'triple') { if (this.mon?.alive && (this.mon.isBoss || this.mons.filter((m) => m.alive && Math.hypot(m.x - this.heroX, m.y - this.heroY) <= 300).length >= 3)) this.useSkill(sk.id); continue; }
      if (sk.autoAbove && this.heroHp < st.hp * sk.autoAbove && !sk.buff?.dmgRed) continue;
      if (sk.kind === 'single') {
        if (!this.mon?.alive) continue;
        // 한 대에 죽을 놈에게는 아끼고, 두목·센 놈에게 쓴다
        if (!this.mon.isBoss && this.mon.hp < st.atk * 1.5) continue;
        if (Math.hypot(this.mon.x - this.heroX, this.mon.y - this.heroY) > (sk.far ? 400 : Math.max(st.range, 160))) continue;
      } else {
        const c = this.ranged() && this.mon?.alive ? this.mon : { x: this.heroX, y: this.heroY };
        const rr = this.skillRadius(sk);
        const n = this.mons.filter((m) => m.alive && Math.hypot(m.x - c.x, (m.y - c.y) * 0.75) <= rr).length;
        const boss = this.mons.some((m) => m.alive && m.isBoss && Math.hypot(m.x - c.x, m.y - c.y) <= rr);
        if (n < 3 && !boss) continue;
      }
      if (this.useSkill(sk.id)) return;
    }
  }

  // ---------- 레벨 ----------
  expNeed() { return W.expToNext(this.s.level); }
  addExp(n) {
    const s = this.s;
    if (s.level >= W.LEVEL_MAX) return;
    s.exp += n;
    while (s.level < W.LEVEL_MAX && s.exp >= W.expToNext(s.level)) {
      s.exp -= W.expToNext(s.level);
      s.level++;
      s.statPts += W.STAT_PER_LEVEL;
      if (s.level >= W.SKILL_PT_FROM) s.skillPts = (s.skillPts || 0) + 1;
      this.emit('levelUp', { level: s.level });
      const look = W.lookTierOf(s.level);
      if (look !== s.rank) s.rank = look;
    }
    if (s.autoStat) this.autoStats();
    this.syncGrow();
    this.heroHp = Math.min(this.heroHp, this.stats().hp);
  }
  addStat(k, n = 1) {
    if (!(k in this.s.stats)) return false;
    const m = Math.min(n, this.s.statPts);
    if (m <= 0) return false;
    this.s.stats[k] += m;
    this.s.statPts -= m;
    return true;
  }
  // 자동 분배 — 캐릭터 기본치 비율대로 (힘·민첩·체력·내공)
  autoStats() {
    const base = W.CLASSES[this.s.job]?.base || { str: 1, dex: 1, vit: 1, int: 1 };
    const sum = Object.values(base).reduce((a, b) => a + b, 0);
    while (this.s.statPts > 0) {
      // 비율에서 가장 많이 모자란 칸에 하나
      const tot = Object.values(this.s.stats).reduce((a, b) => a + b, 0) + 1;
      let pick = 'str';
      let gap = -Infinity;
      for (const [k, w] of Object.entries(base)) {
        const g = (w / sum) * tot - this.s.stats[k];
        if (g > gap) { gap = g; pick = k; }
      }
      this.s.stats[pick]++;
      this.s.statPts--;
    }
  }
  resetStats() {
    const spent = Object.values(this.s.stats).reduce((a, b) => a + b, 0);
    const cost = this.statResetCost();
    if (this.s.gold < cost) return false;
    this.s.gold -= cost;
    for (const k of Object.keys(this.s.stats)) this.s.stats[k] = 0;
    this.s.statPts += spent;
    return true;
  }
  statResetCost() { return 50 * this.s.level; }

  // ---------- 캐릭터·전직 ----------
  setJob(id) {
    if (!W.CLASSES[id] || this.s.job) return false;
    this.s.job = id;
    // v158: 여섯 칸 성장 장비를 받는다 (레벨을 따라 자란다)
    this.growInit();
    this._stats = null;
    this.heroHp = this.stats().hp;
    return true;
  }
  // 다음 전직 — 3차까지는 누구나, 4차는 4차 무공이 있는 직업만(v121: 환마 환영분신술)
  nextTier() {
    const n = this.s.jobTier + 1;
    if (n <= 3) return W.TIERS[n];
    return n === 4 && W.skillsOf(this.s.job).some((k) => k.tier === 4) ? W.TIERS[4] : null;
  }
  canAdvance() {
    const t = this.nextTier();
    return !!t && this.s.level >= t.level && this.s.gold >= t.cost;   // 사냥터에서도 (마을까지 안 가도 된다)
  }
  advance() {
    if (!this.canAdvance()) return false;
    const t = this.nextTier();
    this.s.gold -= t.cost;
    this.s.jobTier++;
    const sk = W.skillsOf(this.s.job).find((k) => k.tier === this.s.jobTier);
    this.emit('advance', { tier: this.s.jobTier, skill: sk?.name });
    return true;
  }
  tierName(t = this.s.jobTier) { return W.classOf(this.s.job)?.tiers?.[t] || ''; }

  // ---------- 장비 ----------
  makeItem(slot, ilv, grade) { return { uid: uidSeq++, slot, ilv, grade, plus: 0 }; }
  itemScore(it) {
    if (!it) return 0;
    const st = this.itemStats(it);
    return (st.atk || 0) * 3 + (st.hp || 0) * 0.25 + (st.def || 0) * 2 + (st.crit || 0) * 900 + (st.atkPct || 0) * 600;
  }
  // ---------- 재료와 조합 ----------
  // 몹은 그 사냥터 재료를, 두목은 재료 한 움큼과 증표를 떨군다. 장비는 떨구지 않는다.
  // 세력 재료 (v151) — 그 세력의 사냥터·고수 두목 방에서. 몹은 가끔, 정예는 둘, 두목은 한 움큼(고수는 세 배, 맹주·천마 열 배)
  dropFacMats(m) {
    const f = this.map.master ? MS.masterOf(this.map.master)?.fac : MS.factionOfZone(this.map.zone);
    if (!f || this.inst) return;
    const key = LN.FAC_MATS[f];
    let n = 0;
    if (m.isBoss) {
      n = LN.FAC_BOSS_MATS * (this.map.master ? (this.map.lord ? 10 : 3) : 1);
      // 맹주의 패 (v153): 맹주·천마는 6개, 그 세력의 다른 고수는 30%로 하나
      if (this.map.master) { const lk = G.LORD_KEY[f]; if (this.map.lord) this.addMats(lk, 6); else if (this.rng() < 0.3) this.addMats(lk, 1); }
    }
    else if (this.rng() < LN.FAC_MAT_RATE * (1 + this.masteryLevel(this.map.zone) * L.MASTERY.mat)) n = LN.facMatDrop(m.lv) * (m.elite || this.map.bossRoom ? 2 : 1);
    if (n > 0) this.addMats(key, n);
  }
  dropMats(m) {
    this.dropFacMats(m);
    const id = this.map.mz;              // 재료는 지역 번호 (구역 셋·두목 구역이 같다 · 새 지역은 짝 지역)
    if (!W.MATS[id]) return null;
    if (m.isBoss) {
      this.addMats(id, W.BOSS_MATS);
      this.addMats(W.bossKey(id), 1);
      // 십이지왕 (v132): 전반 다섯은 맡은 부위의 내 직업 세트 조각(두 세트 가운데 하나), 후반 일곱은 강화석(늘) + 가끔 공용 장신구
      if (W.kingOf(id)) {
        const stone = G.STONES[id];
        if (stone) { this.addMats(G.stoneKey(id), G.STONE_PER_BOSS); this.emit('stone', { key: G.stoneKey(id), n: G.STONE_PER_BOSS, at: { x: m.x, y: m.y } }); }
        if (this.rng() < W.KING_ITEM_RATE) {
          const rar = W.rollRarity(W.KING_RAR_W, this.rng);
          const slot = G.KING_SLOT[id];
          const sets = G.setsOfJob(this.s.job);
          const it = slot && sets.length ? this.makeKing(slot, id, rar, sets[Math.floor(this.rng() * sets.length)].id)
            : this.makeKing(G.KACC_SLOTS[Math.floor(this.rng() * G.KACC_SLOTS.length)], id, rar);
          it.boss = true;
          this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
          this.gainItem(it);
        }
        if (this.rng() < W.petDropRate(id)) this.gainPet(W.rollRarity(W.KING_RAR_W, this.rng), m, W.rollPetKind(id, this.rng));
        return { id, n: W.BOSS_MATS, name: W.MATS[id], color: W.MAT_COLORS[id], boss: W.matName(W.bossKey(id)) };
      }
      // v158: 사다리 장비는 이제 떨구지 않는다(장비는 레벨을 따라 자란다) — 대신 가끔 증표 한 움큼(등급 각인 재료)
      if (this.rng() < W.BOSS_ITEM_RATE) this.addMats(W.bossKey(id), W.INFUSE_MARKS[1]);
      // 가락지·귀걸이 — 두목만 떨군다
      if (this.rng() < W.acc2DropRate(id)) {
        const rar = W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng);
        const st = W.stepOfLevel(W.zoneOfW(id)?.lv[1] || 5);
        const it = this.makeCrafted(this.rng() < 0.5 ? 'finger' : 'ear', st, 0, rar, id);
        it.boss = true;
        this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
        this.gainItem(it);
      }
      // 애완동물 — 두목만, 낮은 확률
      // 초반 두목은 아주 낮게·아래 순위만, 높은 두목일수록 자주·위 순위까지
      if (this.rng() < W.petDropRate(id)) this.gainPet(W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng), m, W.rollPetKind(id, this.rng));
      return { id, n: W.BOSS_MATS, name: W.MATS[id], color: W.MAT_COLORS[id], boss: W.matName(W.bossKey(id)) };
    }
    if (this.rng() >= W.MAT_RATE * (this.stats().matMult || 1) * (1 + this.masteryLevel(this.map.zone) * L.MASTERY.mat)) return null;
    this.addMats(id, 1);
    return { id, n: 1, name: W.MATS[id], color: W.MAT_COLORS[id] };
  }
  addMats(key, n) { this.s.mats[key] = (this.s.mats[key] || 0) + n; }
  // z를 주면 그 지역 것이다(두목이 떨군 가락지·귀걸이처럼). 안 주면 칸에서 읽는다.
  makeCrafted(slot, step, plus = 0, rar = 0, z = null) {
    // 신화의 왕 고유 효과는 **지역**이 정한다 — z를 줬으면 그걸 본다
    const it = { uid: uidSeq++, slot, step, ilv: W.craftIlv(step), rar, grade: W.RARITY_GRADE[rar], opts: this.rollOpts(slot, step, rar, z), plus };
    if (z != null) it.z = z;
    return it;
  }
  // ---------- 성장 장비 (v158) ----------
  growItems() { return [...Object.values(this.s.equip), ...this.s.bag].filter((x) => x?.grow); }
  growOf(slot) { return this.growItems().find((x) => x.slot === slot) || null; }
  // 아이템 레벨 = 내 레벨(100까지). 칸(step)도 따라가서 강화 재료·고유 옵션·계열 덤이 그 레벨 지역 것이 된다.
  syncGrow() {
    const ilv = W.growIlv(this.s.level), step = W.stepOfLevel(ilv);
    for (const it of this.growItems()) if (it.ilv !== ilv || it.step !== step) { it.ilv = ilv; it.step = step; this._stats = null; }
  }
  // 칸마다 성장 장비 하나. 옛 세이브: 그 칸 사다리 장비 중 가장 좋은 것(등급·강화)을 성장 장비로 삼고 나머지는 판다.
  growInit() {
    const s = this.s;
    if (!s.job) return;
    const ladder = (x) => x && x.step != null && x.king == null && !W.isDropOnly(x.slot) && !x.grow;
    for (const sl of W.GROW_SLOTS) {
      if (this.growOf(sl)) continue;
      const pool = [s.equip[sl], ...s.bag.filter((x) => x.slot === sl)].filter(ladder);
      pool.sort((a, b) => (b.rar || 0) - (a.rar || 0) || (b.plus || 0) - (a.plus || 0));
      let it = pool[0];
      if (it) { it.grow = true; delete it.cost; delete it.z; delete it.boss; } else {
        it = { uid: uidSeq++, slot: sl, step: 0, ilv: 1, rar: 0, grade: W.RARITY_GRADE[0], opts: this.rollOpts(sl, 0, 0), plus: 0, grow: true };
      }
      for (const x of pool.slice(1)) {
        if (s.equip[sl] === x) s.equip[sl] = null;
        s.bag = s.bag.filter((y) => y !== x);
        this.sell(x, true);
      }
      const cur = s.equip[sl];
      if (cur === it) continue;
      s.bag = s.bag.filter((y) => y !== it);
      // 세트·왕의 장비를 끼고 있으면 그대로 두고 성장 장비는 가방에
      if (cur && (cur.king != null || cur.set)) { s.bag.push(it); continue; }
      if (cur && !cur.starter) s.bag.push(cur);
      s.equip[sl] = it;
    }
    s.gearV = 4;
    this.syncGrow();
    this._stats = null;
  }
  // 등급 각인 — key: 넣을 두목 증표
  infuseInfo(it, key) {
    const r = (it?.rar || 0) + 1;
    if (!it?.grow || r >= W.RARITY.length || !W.isMarkKey(key)) return null;
    const chance = Math.min(1, W.INFUSE_BASE[r] * W.infuseFactor(key, it.ilv) + (it.pity || 0));
    return { to: r, n: W.INFUSE_MARKS[r], gold: W.infuseGold(it.ilv, r), chance, have: this.s.mats[key] || 0 };
  }
  canInfuse(it, key) {
    const f = this.infuseInfo(it, key);
    return !!f && f.have >= f.n && this.s.gold >= f.gold;
  }
  infuse(uid, key) {
    const it = this.findItem(uid);
    if (!this.canInfuse(it, key)) return null;
    const f = this.infuseInfo(it, key);
    this.s.mats[key] -= f.n;
    this.s.gold -= f.gold;
    this.mark('infuse');
    const ok = this.rng() < f.chance;
    if (ok) {
      it.rar = f.to;
      it.grade = W.RARITY_GRADE[it.rar];
      it.opts = this.rollOpts(it.slot, it.step, it.rar);
      it.pity = 0;
      // 증표 각인 (v163): 오른 칸에 그 두목을 새긴다 (유니크=첫째 · 전설=둘째 · 신화=셋째)
      it.imps = (it.imps || []).slice(0, f.to - 1);
      while (it.imps.length < f.to - 1) it.imps.push(null);
      it.imps[f.to - 1] = key;
      this._stats = null; this._mods = null; this._pass = null;
    } else it.pity = (it.pity || 0) + W.INFUSE_BASE[f.to] * W.INFUSE_PITY_K;
    this.lastInfuse = { ok, to: f.to, chance: f.chance };
    this.emit('infuse', { item: it, ok });
    return ok;
  }
  // 계열 각인 — 세력 재료 × LINE_SET_K
  lineCost(it, line) {
    const mats = {};
    for (const [k, n] of Object.entries(LN.lineMats(line, it.slot, it.step))) mats[k] = n * W.LINE_SET_K;
    return { mats, gold: Math.round((30 + it.ilv * 10) * 3) };
  }
  canSetLine(it, line) {
    if (!it?.grow || (it.line || 'base') === line || !LN.LINES.some((l) => l.id === line)) return false;
    const c = this.lineCost(it, line);
    return this.s.gold >= c.gold && Object.entries(c.mats).every(([k, n]) => (this.s.mats[k] || 0) >= n);
  }
  setLine(uid, line) {
    const it = this.findItem(uid);
    if (!this.canSetLine(it, line)) return false;
    const c = this.lineCost(it, line);
    for (const [k, n] of Object.entries(c.mats)) this.s.mats[k] -= n;
    this.s.gold -= c.gold;
    if (line === 'base') delete it.line; else it.line = line;
    this._stats = null;
    this.emit('line', { item: it });
    return true;
  }

  // ---------- 왕의 장비 (레벨 100, v130) ----------
  makeKing(slot, king, rar = 0, set = null, plus = 0) {
    return { uid: uidSeq++, slot, king, set: set || undefined, ilv: G.KING_ILV, rar, grade: W.RARITY_GRADE[rar], opts: this.rollOpts(slot, null, rar, king), plus };
  }
  // 세트 조각 만들기 — 그 세트 왕의 재료·증표 + 은자. 자기 직업 세트만, 레벨 99부터.
  setCheck(setId, slot) {
    const st = G.setOf(setId);
    if (!st || !G.SET_SLOTS.includes(slot)) return { ok: false, lack: ['set'] };
    const r = G.setRecipe(setId, slot);
    const lack = [];
    for (const [k, n] of Object.entries(r.mats)) if ((this.s.mats[k] || 0) < n) lack.push(k);
    if (this.s.gold < r.gold) lack.push('gold');
    if (this.s.level < G.KING_LV) lack.push('level');
    if (st.job && st.job !== this.s.job) lack.push('job');
    return { r, ok: !lack.length, lack };
  }
  craftSet(setId, slot) {
    const { r, ok } = this.setCheck(setId, slot);
    if (!ok) return null;
    for (const [k, n] of Object.entries(r.mats)) this.s.mats[k] -= n;
    this.s.gold -= r.gold;
    const it = this.makeKing(slot, G.SLOT_KING[slot], W.rollRarity(W.CRAFT_RAR_W, this.rng), setId);
    this.emit('craft', { item: it });
    this.gainItem(it, true);
    return it;
  }
  // 강화석 만들기 — 후반 왕의 재료 40개로 그 왕의 강화석 하나 (v132)
  canMakeStone(z, n = 1) { return !!G.STONES[z] && (this.s.mats[z] || 0) >= G.STONE_FROM_MATS * n; }
  makeStone(z, n = 1) {
    n = Math.min(n, Math.floor((this.s.mats[z] || 0) / G.STONE_FROM_MATS));
    if (!G.STONES[z] || n <= 0) return 0;
    this.s.mats[z] -= G.STONE_FROM_MATS * n;
    this.addMats(G.stoneKey(z), n);
    return n;
  }
  // 공용 장신구 — 아무 왕의 재료로
  kaccCheck(z, slot) {
    if (!W.kingOf(z) || !G.KACC_SLOTS.includes(slot)) return { ok: false, lack: ['king'] };
    const r = G.kaccRecipe(z, slot);
    const lack = [];
    for (const [k, n] of Object.entries(r.mats)) if ((this.s.mats[k] || 0) < n) lack.push(k);
    if (this.s.gold < r.gold) lack.push('gold');
    if (this.s.level < G.KING_LV) lack.push('level');
    return { r, ok: !lack.length, lack };
  }
  craftKacc(z, slot) {
    const { r, ok } = this.kaccCheck(z, slot);
    if (!ok) return null;
    for (const [k, n] of Object.entries(r.mats)) this.s.mats[k] -= n;
    this.s.gold -= r.gold;
    const it = this.makeKing(slot, z, W.rollRarity(W.CRAFT_RAR_W, this.rng));
    this.emit('craft', { item: it });
    this.gainItem(it, true);
    return it;
  }
  // 옵션: 스킬 옵션 + (가락지·귀걸이) 애완동물 +N + (십이지왕 지역 신화) 왕의 고유 효과
  rollOpts(slot, step, rar, kingZone = null) {
    // 장신구·가락지·귀걸이는 모든 직업 공용 — 스킬 옵션이 하나 더 (다섯 스킬 어디에든)
    const opts = W.rollSkillOpts(rar, this.rng, ['acc', 'finger', 'ear'].includes(slot) ? 1 : 0);
    const king = W.kingOf(kingZone ?? (step != null ? W.stepMap(step) : 0));
    if (rar === 3 && king) {
      const i = opts.findIndex((o) => o.sp);
      if (i >= 0) opts[i] = { kp: king.no };
    }
    if (W.isDropOnly(slot) && W.PET_SLOT_OPT[rar] && this.rng() < W.PET_SLOT_CHANCE) opts.push({ pet: W.PET_SLOT_OPT[rar] });
    // 스킬 변화 (v130) — 어느 장비에서나
    if (this.rng() < G.TF_CHANCE[rar]) {
      const tfs = Object.keys(G.TRANSFORMS);
      opts.push({ tf: tfs[Math.floor(this.rng() * tfs.length)], s: G.TF_SLOTS[Math.floor(this.rng() * G.TF_SLOTS.length)] });
    }
    // 갑옷·모자: 기운 저항 (v127)
    if ((slot === 'armor' || slot === 'hat') && this.rng() < L.RES_OPT_CHANCE) {
      const types = Object.keys(L.RES_TYPES);
      opts.push({ res: types[Math.floor(this.rng() * types.length)], v: L.RES_OPT_VALS[rar] });
    }
    return opts;
  }
  // v158: 사다리 조합(recipeFor·craft·craftSteps·nextSteps)은 없앴다 — 장비는 레벨을 따라 자란다(성장 장비)
  // 새 장비: 끼고 있는 것보다 좋으면 끼고, 아니면 가방에.
  gainItem(it) {
    const cur = this.s.equip[it.slot];
    // 세트 조각을 끼고 있으면 다른 것으로 저절로 바꾸지 않는다 (세트 효과가 깨진다)
    if (cur?.set && !(it.set === cur.set)) return this.stash(it);
    if (this.itemScore(it) > this.itemScore(cur)) {
      this.s.equip[it.slot] = it;
      this.emit('equip', { item: it, auto: true });
      if (cur) this.stash(cur);
      this._stats = null;
      return 'equip';
    }
    return this.stash(it);
  }
  stash(it) {
    this.s.bag.push(it);
    // 가방이 넘치면 가장 나쁜 것부터 판다
    while (this.s.bag.length > this.s.bagSize) {
      let worst = -1;
      for (let i = 0; i < this.s.bag.length; i++) if (!this.s.bag[i].grow && (worst < 0 || this.itemScore(this.s.bag[i]) < this.itemScore(this.s.bag[worst]))) worst = i;
      if (worst < 0) break;
      this.sell(this.s.bag.splice(worst, 1)[0], true);
    }
    return 'bag';
  }
  sell(it, auto = false) {
    if (it?.grow) return 0;                 // 성장 장비는 칸마다 하나 — 팔지 않는다 (v158)
    // 조합 장비: 만들 때 든 것의 1/4 (재료도 돌아온다) · 그 밖: 은자
    const back = W.sellBack(it);
    const p = back ? back.gold : W.sellPrice(it);
    if (back) for (const [k, n] of Object.entries(back.mats)) this.addMats(k, n);
    this.s.gold += p;
    if (!auto) this.s.bag = this.s.bag.filter((x) => x.uid !== it.uid);
    this.note(0, 0, p, 0);
    return p;
  }
  sellBagBelow(grade) {
    let sum = 0;
    for (const it of this.s.bag.slice()) if (it.grade <= grade && !it.plus) sum += this.sell(it);
    return sum;
  }
  equipFromBag(uid) {
    const i = this.s.bag.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = this.s.bag.splice(i, 1)[0];
    const cur = this.s.equip[it.slot];
    this.s.equip[it.slot] = it;
    if (cur) this.s.bag.push(cur);
    this._stats = null;
    this.heroHp = Math.min(this.heroHp, this.stats().hp);
    return true;
  }
  findItem(uid) {
    return Object.values(this.s.equip).find((x) => x?.uid === uid) || this.s.bag.find((x) => x.uid === uid) || null;
  }
  enhanceCost(it) { return W.enhanceCost(it.ilv, it.plus || 0) * (W.isDropOnly(it.slot) ? W.ACC2_COST : 1); }
  // 강화 재료: 조합 장비는 그 지역 재료 (옛 장비·수련용은 은자만)
  enhanceMats(it) {
    if (it.king != null) return { key: G.stoneFor(it), n: G.stoneN(it.plus || 0) };     // 왕의 장비: 후반 왕의 부위별 강화석 (v132)
    if (it.step == null) return null;
    return { key: W.itemZone(it), n: W.enhanceMatsN(it.plus || 0) };
  }
  // 조합·왕의 장비는 +10 위로 돌파(+15까지) — 두목 증표가 더 든다. 옛 장비·가락지·귀걸이는 +10까지.
  enhanceMax(it) { return (it?.step != null || it?.king != null) && !W.isDropOnly(it.slot) ? W.ENHANCE_MAX : W.ENHANCE_NORMAL; }
  breakMarksOf(it) { return it?.step != null && !W.isDropOnly(it.slot) ? W.breakMarks(it.plus || 0) : 0; }   // 왕의 장비는 강화석 수에 들어 있다
  enhanceRateOf(it) { return W.enhanceRate(it.plus || 0) * (W.isDropOnly(it.slot) ? W.ACC2_RATE : 1); }
  canEnhance(it) {
    if (!it || (it.plus || 0) >= this.enhanceMax(it) || this.s.gold < this.enhanceCost(it)) return false;
    const m = this.enhanceMats(it);
    if (m && (this.s.mats[m.key] || 0) < m.n) return false;
    const bm = this.breakMarksOf(it);
    return !bm || (this.s.mats[W.bossKey(m.key)] || 0) >= bm;
  }
  // 던파식 (v150): 실패하면 -1 · -3 · 부서짐. useProt면 부서질 때 보호부 하나로 대신 -1. 결과는 this.lastEnhance에도 남긴다.
  enhance(uid, useProt = true) {
    const it = this.findItem(uid);
    if (!this.canEnhance(it)) return null;
    const cost = this.enhanceCost(it);
    const mats = this.enhanceMats(it);
    this.s.gold -= cost;
    if (mats) this.s.mats[mats.key] -= mats.n;
    const bm = this.breakMarksOf(it);
    if (bm) this.s.mats[W.bossKey(mats.key)] -= bm;
    const lv = it.plus || 0;
    const ok = this.rng() < this.enhanceRateOf(it);
    const r = { ok, from: lv, drop: 0, broke: false, prot: false };
    if (ok) it.plus = lv + 1;
    else {
      const f = W.enhanceFail(lv);
      if (f === 'break') {
        if (useProt && (this.s.prot || 0) > 0) { this.s.prot--; r.prot = true; r.drop = -1; it.plus = Math.max(0, lv - 1); }
        else if (it.grow) { r.broke = true; r.reset = true; it.plus = 0; }      // v158: 성장 장비는 부서지지 않고 +0으로
        else { r.broke = true; this.destroyItem(it); }
      } else if (f) { r.drop = f; it.plus = Math.max(0, lv + f); }
    }
    this._stats = null;
    this.lastEnhance = r;
    this.emit('enhance', { item: it, ...r });
    return ok;
  }
  // 강화에 실패해 부서진 장비를 없앤다 (낀 것이면 칸이 빈다)
  destroyItem(it) {
    for (const [k, v] of Object.entries(this.s.equip)) if (v === it) this.s.equip[k] = null;
    this.s.bag = this.s.bag.filter((x) => x !== it);
    this._stats = null;
  }
  buyProt(n = 1) {
    const c = W.protPrice(this.s.level) * n;
    if (n <= 0 || this.s.gold < c) return false;
    this.s.gold -= c;
    this.s.prot = (this.s.prot || 0) + n;
    return true;
  }

  // ---------- 십이지왕 신화 고유 효과 (v111) ----------
  passives() {
    const sig = W.SLOTS.map((x) => { const it = this.s.equip[x.id]; return it ? `${it.uid}.${it.rar}` : '-'; }).join(',');
    if (this._pass?.sig === sig) return this._pass.set;
    const set = new Set();
    for (const it of Object.values(this.s.equip)) for (const o of it?.opts || []) if (o.kp && W.KING_MYTHIC[o.kp]) set.add(W.KING_MYTHIC[o.kp].id);
    this._pass = { sig, set };
    return set;
  }

  // ---------- 애완동물 (v111) ----------
  petSlots() {
    let n = 1;
    for (const it of Object.values(this.s.equip)) for (const o of it?.opts || []) if (o.pet) n += o.pet;
    return n;
  }
  activePets() { return (this.s.pets || []).slice(0, this.petSlots()); }
  gainPet(rar, at, kind) {
    const pet = { uid: uidSeq++, kind: kind || W.PETS[Math.floor(this.rng() * W.PETS.length)].id, rar, lv: 1, exp: 0 };
    // 키우는 칸이 비었으면 바로 데려가고, 아니면 우리에서 기다린다(바꾸려면 키우던 것을 놓아줘야 한다)
    if (this.s.pets.length < this.petSlots()) this.s.pets.push(pet);
    else if (this.s.petBox.length < W.PET_BOX) this.s.petBox.push(pet);
    else return null;
    this._stats = null;
    this.emit('petDrop', { pet, at: at ? { x: at.x, y: at.y } : null, joined: this.s.pets.includes(pet) });
    return pet;
  }
  adoptPet(uid) {
    if (this.s.pets.length >= this.petSlots()) return false;
    const i = this.s.petBox.findIndex((p) => p.uid === uid);
    if (i < 0) return false;
    this.s.pets.push(this.s.petBox.splice(i, 1)[0]);
    this._stats = null;
    return true;
  }
  // 놓아주기 — 키우던 것은 사라진다(되돌릴 수 없다)
  releasePet(uid) {
    const n0 = this.s.pets.length + this.s.petBox.length;
    this.s.pets = this.s.pets.filter((p) => p.uid !== uid);
    this.s.petBox = this.s.petBox.filter((p) => p.uid !== uid);
    this._stats = null;
    return this.s.pets.length + this.s.petBox.length < n0;
  }
  petExp(n) {
    for (const p of this.activePets()) {
      if (p.lv >= W.PET_LV_MAX) continue;
      p.exp += n;
      while (p.lv < W.PET_LV_MAX && p.exp >= W.petExpToNext(p.lv)) {
        p.exp -= W.petExpToNext(p.lv);
        p.lv++;
        this._stats = null;
        this.emit('petLevel', { pet: p });
      }
    }
  }
  // 애완동물이 싸운다 — 무인 곁의 적(무인의 과녁이 먼저)을 무인 공격력에 비례해 때린다
  tickPets(dt, st) {
    const pets = this.activePets();
    if (!pets.length) return;
    this.petT = this.petT || [];
    pets.forEach((p, i) => {
      this.petT[i] = (this.petT[i] ?? W.PET_ATK_SEC * (0.3 + i * 0.25)) - dt;
      if (this.petT[i] > 0) return;
      this.petT[i] = W.PET_ATK_SEC;
      let t = this.mon?.alive && !this.mon.introT ? this.mon : null;
      if (!t) {
        let bd = 260;
        for (const m of this.mons) {
          if (!m.alive || m.npc || m.introT > 0) continue;
          const d = Math.hypot(m.x - this.heroX, m.y - this.heroY);
          if (d < bd) { bd = d; t = m; }
        }
      }
      if (!t) return;
      const crit = this.rng() < st.crit;
      const dmg = Math.max(1, st.atk * W.petAtkRatio(p) * (crit ? st.critDmg : 1) - t.armor * 0.5);
      this.emit('petHit', { i, at: { x: t.x, y: t.y } });
      this.hurt(t, dmg, 'pet', crit);
    });
  }

  // ---------- 탈것 (v111) ----------
  gainMount(kind, at) {
    const mt = { uid: uidSeq++, kind };
    this.s.mounts.push(mt);
    // 처음 얻었거나 지금 것보다 좋으면 바로 탄다
    const cur = this.mountNow();
    if (!cur || W.mountOf(kind).speed > cur.speed) this.s.mount = mt.uid;
    this._stats = null;
    this.emit('mountDrop', { mount: mt, at: at ? { x: at.x, y: at.y } : null });
    return mt;
  }
  ride(uid) {
    if (uid != null && !this.s.mounts.some((m) => m.uid === uid)) return false;
    this.s.mount = uid;
    this._stats = null;
    return true;
  }
  releaseMount(uid) {
    this.s.mounts = this.s.mounts.filter((m) => m.uid !== uid);
    if (this.s.mount === uid) this.s.mount = null;
    this._stats = null;
  }

  // ---------- 승급 (v110) ----------
  // 대장장이: 같은 장비를 한 등급 위로(레어→유니크→전설→신화). 확정. 스킬 옵션은 새 등급으로 다시 붙는다.
  canPromote(it) {
    if (!it || it.grow || (it.step == null && it.king == null) || (it.rar || 0) >= W.RARITY.length - 1) return false;
    const c = W.promoteCost(it);
    return (this.s.mats[c.key] || 0) >= c.mats && (!c.marks || (this.s.mats[W.bossKey(c.key)] || 0) >= c.marks) && this.s.gold >= c.gold
      && Object.entries(c.fac || {}).every(([k, n]) => (this.s.mats[k] || 0) >= n);
  }
  promote(uid) {
    const it = this.findItem(uid);
    if (!this.canPromote(it)) return null;
    const c = W.promoteCost(it);
    this.s.mats[c.key] -= c.mats;
    if (c.marks) this.s.mats[W.bossKey(c.key)] -= c.marks;
    for (const [k, n] of Object.entries(c.fac || {})) this.s.mats[k] -= n;
    this.s.gold -= c.gold;
    it.rar = (it.rar || 0) + 1;
    it.grade = W.RARITY_GRADE[it.rar];
    it.opts = this.rollOpts(it.slot, it.step, it.rar, it.king);
    this._stats = null;
    this._mods = null;
    this._pass = null;
    this.emit('promote', { item: it });
    return it;
  }

  // ---------- 스킬 레벨 · 스킬 옵션 (v110) ----------
  skillLevel(id) { return this.s.skillLv?.[id] || 1; }
  canSkillUp(id) {
    const sk = this.skillDef(id);
    const lv = this.skillLevel(id);
    return this.knows(sk) && lv < W.SKILL_LV_MAX && this.s.skillPts >= W.skillLvCost(lv);
  }
  skillUp(id) {
    if (!this.canSkillUp(id)) return false;
    this.s.skillPts -= W.skillLvCost(this.skillLevel(id));
    this.s.skillLv[id] = this.skillLevel(id) + 1;
    this._mods = null;
    return true;
  }
  // ---------- 심법 (패시브) ----------
  passiveList() { return this.s.job ? W.passivesOf(this.s.job) : []; }
  passLevel(id) { return this.s.passLv?.[id] || 0; }
  canPassUp(id) {
    const p = this.passiveList().find((x) => x.id === id);
    const lv = this.passLevel(id);
    return !!p && this.s.level >= p.from && lv < p.max && this.s.skillPts >= W.passiveCost(p, lv);
  }
  passUp(id) {
    if (!this.canPassUp(id)) return false;
    const p = this.passiveList().find((x) => x.id === id);
    this.s.skillPts -= W.passiveCost(p, this.passLevel(id));
    this.s.passLv[id] = this.passLevel(id) + 1;
    this._pm = null;
    this._stats = null;
    return true;
  }
  // 심법이 주는 것을 한데 모은다 (own5: 독문 심법 5레벨 덧)
  pmods() {
    const sb = this.setBonus();
    const key = `${this.s.job}|${JSON.stringify(this.s.passLv || {})}|${JSON.stringify(sb)}`;
    if (this._pm?.key === key) return this._pm.v;
    const v = {};
    for (const p of this.passiveList()) {
      const lv = this.passLevel(p.id);
      if (!lv) continue;
      for (const [k, x] of Object.entries(p.eff)) v[k] = (v[k] || 0) + x * lv;
      if (p.id === 'p_own' && lv >= 5) v.own5 = true;
    }
    // 세트 효과 중 심법과 같은 갈래(평타·꽃잎·취약·독·공포) — v130
    for (const k of ['basicUp', 'flowerUp', 'vulnUp', 'poisonUp', 'fearUp']) if (sb[k]) v[k] = (v[k] || 0) + sb[k];
    this._pm = { key, v };
    return v;
  }

  // 스킬 하나에 걸린 것: 스킬 레벨 + 끼고 있는 장비의 옵션
  skillMods(id) {
    const key = `${this.statSig()}|${JSON.stringify(this.s.skillLv)}`;
    if (!this._mods || this._mods.key !== key) this._mods = { key };
    if (this._mods[id]) return this._mods[id];
    const slot = +id.slice(1);
    const m = { dmg: 0, range: 0, splash: 0, cd: 0, cost: 0, crit: 0, echo: false, free: false, reset: false, ...W.skillLvMods(slot, this.skillLevel(id)) };
    for (const it of Object.values(this.s.equip)) {
      for (const o of it?.opts || []) {
        if (o.s !== slot) continue;
        if (o.sp) m[o.sp] = true;
        else if (o.tf) {
          m.tf = m.tf || {};
          m.tf[o.tf] = true;
          if (o.tf === 'giant') m.range += 0.5;
          if (o.tf === 'focus') { m.range -= 0.35; m.dmg += 0.4; }
        } else if (o.k) m[o.k] = (m[o.k] || 0) + o.v;
      }
    }
    // 증표 각인의 스킬 변화 (v163) — 겹치면 더한다
    m.echoP = 0;
    for (const it of Object.values(this.s.equip)) for (const im of IM.imprintsOf(it)) {
      if (im.skill.s !== slot) continue;
      if (im.skill.k === 'echo') m.echoP += im.skill.v; else m[im.skill.k] = (m[im.skill.k] || 0) + im.skill.v;
    }
    m.echoP = Math.min(IM.SKILL_CAP.echo, m.echoP);
    m.cd = Math.min(0.7, m.cd);
    m.cost = Math.min(1, m.cost);
    if (m.free) m.cost = 1;
    this._mods[id] = m;
    return m;
  }

  // ---------- 상점 ----------
  potionPrice() { return W.potionPrice(this.s.level); }
  buyPotions(n) {
    const cost = this.potionPrice() * n;
    if (n <= 0 || this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.potions += n;
    return true;
  }
  statBookCost() { return W.statBookCost(this.s.books || 0); }
  buyStatBook() {
    const c = this.statBookCost();
    if (this.s.gold < c) return false;
    this.s.gold -= c;
    this.s.books = (this.s.books || 0) + 1;
    this.s.statPts++;
    if (this.s.autoStat) this.autoStats();
    return true;
  }
  bagUpgradeCost() { return 1000 * 2 ** Math.round((this.s.bagSize - W.BAG_SIZE) / 10); }
  buyBagSpace() {
    const c = this.bagUpgradeCost();
    if (this.s.gold < c || this.s.bagSize >= 80) return false;
    this.s.gold -= c;
    this.s.bagSize += 10;
    return true;
  }

  // ---------- 땅 (v127): 기운 · 숙련도 · 보물 원숭이 ----------
  // 지금 사냥터의 기운 (저항을 셈한 것). 던전·마을은 없다.
  envNow() {
    const m = this.map;
    const env = L.envOf(m);
    if (!env) return NO_ENV;
    const res = env.good ? 0 : this.resistTo(env.type, m.zone);
    const key = `${m.id}|${res}`;
    if (this._env?.key === key) return this._env.v;
    const v = L.envEffect(env, res);
    this._env = { key, v };
    return v;
  }
  // 저항 = 그 지역 숙련도 × 8% + 갑옷·모자의 그 기운 저항 (90%까지)
  resistTo(type, zone) {
    let r = this.masteryLevel(zone) * L.MASTERY.res;
    for (const it of Object.values(this.s.equip)) for (const o of it?.opts || []) if (o.res === type) r += o.v;
    return Math.min(0.9, r);
  }
  masteryLevel(zone) { return L.masteryLv(this.s.mast?.[zone] || 0); }
  addMastery(zone, n) {
    if (!zone || !W.zoneOfW(zone) || !(n > 0)) return;
    const before = this.masteryLevel(zone);
    this.s.mast[zone] = (this.s.mast[zone] || 0) + n;
    const after = this.masteryLevel(zone);
    if (after > before) { this._env = null; this.emit('mastery', { zone, level: after, name: W.zoneOfW(zone).name }); }
  }
  spawnTreasure() {
    const m = this.map;
    const lv = m.lv[1];
    const h = this.heroTile();
    let c = -1, r = -1;
    for (let t = 0; t < 60; t++) {
      const cc = Math.floor(this.rng() * W.COLS), rr = Math.floor(this.rng() * W.ROWS);
      if (this.occupied(cc, rr) || Math.abs(cc - h.c) + Math.abs(rr - h.r) < 5) continue;
      c = cc; r = rr; break;
    }
    if (c < 0) return null;
    const hp = W.mobHp(lv) * L.TREASURE_HP;
    const mob = { id: uidSeq++, lv, c, r, hc: c, hr: r, move: null, x: W.tileCenter(c), y: W.tileCenter(r), hp, maxHp: hp, alive: true, isBoss: false,
      born: this.clock, atk: 0, armor: W.mobDef(lv), grade: 1, treasure: true, life: L.TREASURE_LIFE, atkTimer: 9, stun: 0, slow: 0, poison: 0, aggro: true, wanderT: 0,
      def: { ...L.TREASURE_DEF }, name: L.TREASURE_DEF.name };
    this.mons.push(mob);
    this.emit('treasure', { at: mob, name: mob.name });
    return mob;
  }
  // 달아난다 — 무인에게서 먼 칸으로. 기절·둔화는 듣는다. 시간이 다 되면 사라진다.
  tickTreasure(m, dt) {
    if (!m.alive) return;
    m.life -= dt;
    if (m.life <= 0) { m.alive = false; if (this.mon === m) this.mon = null; this.emit('treasureGone', { at: { x: m.x, y: m.y } }); return; }
    if (m.stun > 0) { m.stun -= dt; return; }
    if (m.slow > 0) m.slow -= dt;
    const spd = W.MOB_SPEED * 1.25 * (m.slow > 0 ? 0.45 : 1);
    if (m.move) { if (this.slide(m, 'x', 'y', m.move, spd, dt)) { m.c = m.move.c; m.r = m.move.r; m.move = null; } return; }
    const h = this.heroTile();
    let best = null, bd = -1;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = m.c + dc, r = m.r + dr;
      if (!this.inMap(c, r) || this.occupied(c, r, m)) continue;
      const d = Math.abs(c - h.c) + Math.abs(r - h.r) + this.rng() * 0.8;
      if (d > bd) { bd = d; best = { c, r }; }
    }
    // 붙잡혔으면(가까우면) 움찔거리기만
    if (best && Math.abs(m.c - h.c) + Math.abs(m.r - h.r) < 9) m.move = best;
  }
  killTreasure(m, st, env) {
    const z = this.map.mz;
    const gold = Math.round(W.mobGold(m.lv) * L.TREASURE_GOLD * (1 + (env.gold || 0)));
    this.s.gold += gold;
    const mats = {};
    if (W.MATS[z]) { mats[z] = L.TREASURE_MATS; if (this.rng() < L.TREASURE_MARK) mats[W.bossKey(z)] = 1; }
    for (const [k, n] of Object.entries(mats)) this.addMats(k, n);
    this.note(0, 0, gold, 0);
    this.emit('kill', { gold, isBoss: false, add: true, at: m, mat: null });
    this.emit('treasureKill', { gold, mats, at: { x: m.x, y: m.y } });
  }

  // ---------- 던전 (v126) ----------
  huntOn() { return this.s.autoHunt || !!this.inst; }
  // 오늘 쓴 횟수 — 날이 바뀌면(한국 시간) 비운다
  dgnToday(now = Date.now()) {
    const d = this.s.dgn;
    const day = D.kstDay(now);
    if (d.day !== day) { d.day = day; d.used = {}; }
    return d;
  }
  dailyLeft(kind, now = Date.now()) { return Math.max(0, D.DAILY_ENTRIES - (this.dgnToday(now).used[kind] || 0)); }
  dailyBest(kind) { return this.s.dgn.best[kind] || 0; }
  // 고를 수 있는 가장 높은 단계: 깬 단계 + 1 (레벨이 닿는 데까지)
  // 깬 단계 다음까지 — 레벨은 안 본다(v146). 단계는 하나씩 깨며 오른다.
  dailyMaxStage(kind) {
    return Math.min(D.DAILY_STAGES, this.dailyBest(kind) + 1);
  }
  canDaily(kind, stage, now = Date.now()) {
    const d = D.dailyOf(kind);
    return !!d && !!this.s.job && !this.inst && D.dailyOpen(d, now) && this.dailyLeft(kind, now) > 0
      && stage >= 1 && stage <= this.dailyMaxStage(kind);
  }
  startDaily(kind, stage, now = Date.now()) {
    if (!this.canDaily(kind, stage, now)) return false;
    const used = this.dgnToday(now).used;
    used[kind] = (used[kind] || 0) + 1;
    this.startInst({ kind: 'daily', id: kind, stage, map: D.dailyMap(kind, stage), t: D.DAILY_SEC, max: D.DAILY_SEC, target: D.DAILY_KILLS, kills: 0 });
    for (let i = 0; i < D.DAILY_ALIVE; i++) this.spawnMob(false);
    return true;
  }
  // ---------- 길잡이 (v139) ----------
  // **띄우는 건 늘 하나다.** 열 몇 가지가 한꺼번에 열려 있어서, 목록을 더
  // 보여 주면 더 헷갈린다. 끝내면 다음 하나가 나온다.
  questNow() {
    // v146: 길잡이를 다시 짰다 — 옛 세이브는 이미 해 둔 단계를 보상 없이 건너 지금 할 일부터
    if ((this.s.questV || 1) < Q.QUEST_V) {
      this.s.questV = Q.QUEST_V;
      this.s.quest = 0;
      this.s.questGift = -1;
      // 이미 넘은 레벨·전직 단계 앞의 것은 다 지나간 것으로 본다(움직여 보기처럼 옛 판에 없던 '해 봤나'는 안 남아 있다)
      let last = -1;
      Q.QUESTS.forEach((q, i) => { if (q.mile) { const g0 = q.goal(this); if ((g0.now || 0) >= (g0.need || 1)) last = i; } });
      this.s.quest = last + 1;
      while (this.s.quest < Q.QUEST_COUNT) {
        const g0 = Q.questAt(this.s.quest).goal(this);
        if ((g0.now || 0) < (g0.need || 1)) break;
        this.s.quest++;
      }
    }
    const q = Q.questAt(this.s.quest);
    if (!q) return null;
    // 해 봐야 하는 것은 그 단계가 뜰 때 준다 (첫 무기 재료 · 가장 아래 애완동물·탈것)
    if (q.gift && this.s.questGift !== this.s.quest && this.s.job) {
      this.s.questGift = this.s.quest;
      const what = q.gift(this);
      if (what) this.emit('questGift', { title: q.title, what });
    }
    const g = q.goal(this);
    const need = g.need || 1;
    const now = Math.min(need, Math.max(0, g.now || 0));
    return { q, now, need, done: now >= need, reward: Q.questReward(q, this.s.level) };
  }
  canClaimQuest() { return !!this.questNow()?.done; }
  // 서버가 있어야 하는 단계(문파·토벌·함께 사냥)는 건너뛸 수 있다 — 보상은 없다
  skipQuest() {
    const cur = this.questNow();
    if (!cur || !cur.q.skip || cur.done) return false;
    this.s.quest++;
    return true;
  }
  // 해 본 것 하나 (길잡이용)
  mark(k) { const d = this.s.did || (this.s.did = {}); d[k] = (d[k] || 0) + 1; }
  // 길잡이 선물 — 우리에 넣어 둔다(데려가기는 손으로)
  giftPet(kind) {
    if (this.s.petBox.length >= W.PET_BOX) return null;
    this.s.petBox.push({ uid: uidSeq++, kind, rar: 0, lv: 1, exp: 0 });
    return `애완동물 ${W.petOf(kind).name}(${W.RARITY[0].name})`;
  }
  // 길잡이 선물 — 탈것은 가지기만(타기는 손으로)
  giftMount(kind) {
    this.s.mounts.push({ uid: uidSeq++, kind });
    return `탈것 ${W.mountOf(kind).name}`;
  }
  // 받으면 다음 하나로 넘어간다. 보상은 **받을 때의 레벨로** 센다 —
  // 고정값으로 두면 뒤로 갈수록 먼지가 된다.
  claimQuest() {
    const cur = this.questNow();
    if (!cur || !cur.done) return null;
    const reward = this.grant(cur.reward);
    this.s.quest++;
    this.emit('quest', { id: cur.q.id, title: cur.q.title, reward, left: Q.QUEST_COUNT - this.s.quest });
    return reward;
  }

  // 다 받기 — 조건이 이미 찬 단계를 한꺼번에. 레벨 80에서 시작한 사람이
  // 열여섯 번을 눌러야 하는 건 길잡이가 아니라 일거리다.
  claimAllQuests() {
    const out = [];
    // 한 번에 하나씩 — 받으면 다음 단계의 조건을 다시 봐야 한다
    for (let i = 0; i < Q.QUEST_COUNT; i++) {
      const cur = this.questNow();
      if (!cur || !cur.done) break;
      out.push({ id: cur.q.id, title: cur.q.title, reward: this.claimQuest() });
    }
    return out;
  }

  // ---------- 자동 도전 (v139) ----------
  // 켜 두면 열려 있는 요일 던전을 알아서 돈다. 한 판이 끝나면 남은 횟수만큼
  // 이어서 — 탑의 '이어 오르기'와 같은 결이다.
  //
  // **갈 수 있는 가장 높은 단계로 간다.** 낮은 단계를 돌면 횟수만 쓰고
  // 깬 단계가 안 오른다 — 자동이 사람보다 못하면 켤 이유가 없다.
  autoDailyNext(now = Date.now()) {
    if (!this.s.dgn.auto || this.inst || !this.s.job) return null;
    for (const d of D.DAILY) {
      const stage = this.dailyMaxStage(d.id);
      if (this.canDaily(d.id, stage, now)) return { kind: d.id, stage };
    }
    return null;
  }
  startAutoDaily(now = Date.now()) {
    const nx = this.autoDailyNext(now);
    if (!nx) return false;
    return this.startDaily(nx.kind, nx.stage, now);
  }

  // 소탕 — 깬 가장 높은 단계의 보상을 들어가지 않고 받는다 (한 번 쓴다)
  canSweep(kind, now = Date.now()) {
    const d = D.dailyOf(kind);
    return !!d && D.dailyOpen(d, now) && this.dailyLeft(kind, now) > 0 && this.dailyBest(kind) > 0;
  }
  sweepDaily(kind, now = Date.now()) {
    if (!this.canSweep(kind, now)) return null;
    const used = this.dgnToday(now).used;
    used[kind] = (used[kind] || 0) + 1;
    const stage = this.dailyBest(kind);
    const reward = this.grant(D.dailyReward(kind, stage, this.levelGapMult(D.dailyLv(stage))));
    this.emit('sweep', { kind, stage, reward });
    return reward;
  }
  sweepAll(now = Date.now()) {
    const out = [];
    for (const d of D.DAILY) while (this.canSweep(d.id, now)) out.push({ kind: d.id, stage: this.dailyBest(d.id), reward: this.sweepDaily(d.id, now) });
    return out;
  }
  // ---------- 고수 (v148) ----------
  // 처음 쓰러뜨린 고수마다 영구히 공격력·체력 (고수 +1% · 맹주·천마 +3%)
  // 이 두목 방의 두목이 쓰는 초식 (보통 지역 두목은 없다)
  bossSkills() {
    const m = this.map;
    if (m.master) return MS.masterOf(m.master)?.skills || null;
    if (m.king) return MS.KING_SKILLS[m.king.title] || null;
    return null;
  }
  tickBossSkill(dt) {
    const sk = this.bossSkills();
    if (!sk) return;
    const b = this.mons.find((x) => x.isBoss && x.alive && !(x.introT > 0));
    if (!b || b.stun > 0) return;
    b.castT = (b.castT ?? 3) - dt;
    if (b.castT > 0) return;
    const lord = this.map.lord;
    b.castT = (lord ? W.FIELD_CAST_LORD : W.FIELD_CAST) * (0.85 + this.rng() * 0.3);
    const s1 = sk[Math.floor(this.rng() * sk.length)];
    this.bossCast(b, MS.floorOf(b.lv), lord ? W.FIELD_TELL_LORD : W.FIELD_TELL, [s1.pat], s1.name);
  }
  masterBonus() {
    let b = 0;
    for (const id of Object.keys(this.s.duel?.won || {})) { const m = MS.masterOf(id); if (m) b += MS.masterBonusOf(m); }
    return b;
  }
  // 무한의 탑 — 다음 층에 오른다. chain: 이긴 뒤 이어 오르는 것(등장 연출을 짧게)
  canTower() { return !this.inst && !!this.s.job && this.s.tower.floor < D.TOWER_MAX; }
  startTower(chain = false) {
    if (!this.canTower()) return false;
    const f = this.s.tower.floor + 1;
    this.startInst({ kind: 'tower', stage: f, map: D.towerMap(f), t: D.towerSec(f), max: D.towerSec(f), wait: chain ? 1.2 : 0.6, castT: 2.5 });
    this.bossSeen = chain;
    return true;
  }
  startInst(o) {
    this.inst = { ...o, done: null };
    this.tells = [];
    this.blocked = null;
    this.obstacles = [];
    this.clones = [];
    this.fields = [];
    this.sceneKey = o.map.scene || null;
    this.s.stage = o.map.art * 10 + 1;
    this.placeHero(Math.floor(W.COLS / 2), Math.floor(W.ROWS * 0.62));
    this.mons = [];
    this.mon = null;
    this.respawns = [];
    this.manual = null;
    this.freezeT = 0;
    this.bossT = 0;
    this.heroHp = this.stats().hp;          // 던전은 가득 찬 체력으로 들어간다
    this.emit('mapEnter', { id: -1, name: o.map.name, inst: o.kind });
  }
  tickInst(dt) {
    const I = this.inst;
    if (I.done) return;
    // 탑: 잠깐 뒤 수문장이 나선다 (그동안은 시간이 안 간다)
    if (I.wait > 0) {
      I.wait -= dt;
      if (I.wait <= 0) {
        const b = this.spawnMob(true);
        I.boss = b;
        if (b && I.kind === 'raid') { b.lv = this.s.level + 5; b.maxHp = I.sharedMax; b.hp = I.hpLeft; b.atk = W.mobAtk(b.lv) * W.BOSS.atk; b.armor = 0; b.grade = 3; }
        else if (b) { b.lv = D.towerLv(I.stage); b.maxHp = b.hp = D.towerHp(I.stage); b.atk = D.towerAtk(I.stage); b.armor = W.mobDef(b.lv); if (D.isZodiacFloor(I.stage)) b.grade = 3; }
      }
      return;
    }
    // 수문장 초식 — 바닥 경고
    if (I.kind === 'tower' || I.kind === 'raid') {
      const b = this.mons.find((m) => m.isBoss && m.alive && !(m.introT > 0));
      if (b && !(b.stun > 0)) {
        I.castT -= dt;
        // 토벌 두목은 35층 수문장만큼의 초식을 약하게 (함께 오래 치는 판이라)
        if (I.castT <= 0) { const f = I.kind === 'raid' ? 35 : I.stage; I.castT = D.castGap(f) * (I.kind === 'raid' ? 1.3 : 1); this.bossCast(b, f, I.kind === 'raid' ? 0.6 : 1); }
      }
    }
    I.t -= dt;
    if (I.t <= 0) I.done = { ok: false, timeout: true };
  }
  instKill(m) {
    const I = this.inst;
    if (I.done) return;
    if (I.kind === 'daily') {
      I.kills++;
      this.respawns.push({ t: D.DAILY_RESPAWN });
      if (I.kills >= I.target) I.done = { ok: true };
    } else if ((I.kind === 'tower' || I.kind === 'raid') && m.isBoss) I.done = { ok: true };
  }
  // 수문장 초식: 그 층의 초식 가운데 하나를 골라 바닥에 경고를 깐다 (D.tellDelay초 뒤 터진다)
  bossCast(b, f, dmgMul = 1, pats = D.towerPatterns(f), skillName = null) {
    const p = pats[Math.floor(this.rng() * pats.length)];
    const T = D.tellDelay(f);
    const dmg = D.tellDmg(f) * dmgMul;
    const hx = this.heroX, hy = this.heroY;
    const ang = Math.atan2(hy - b.y, hx - b.x);
    const add = (o) => this.tells.push({ t: T, max: T, dmg, wait: 0, ...o });
    const line = (a, len, w, ox = b.x, oy = b.y, o = {}) => add({ kind: 'line', x0: ox, y0: oy, x1: ox + Math.cos(a) * len, y1: oy + Math.sin(a) * len, w, ...o });
    const thru = (a, w) => line(a, 1700, w, b.x - Math.cos(a) * 850, b.y - Math.sin(a) * 850);
    switch (p) {
      case 'aim': add({ kind: 'circle', x: hx, y: hy, r: 100 }); break;
      case 'nova': add({ kind: 'circle', x: b.x, y: b.y, r: 215 }); break;
      case 'donut': add({ kind: 'donut', x: b.x, y: b.y, r0: 125, r1: 560 }); break;
      case 'line': line(ang, 950, 100); break;
      case 'charge': line(ang, 1100, 150); break;
      case 'twin': line(ang, 1000, 100); line(ang, 1000, 100, b.x, b.y, { aimLine: true, wait: 0.7 }); break;
      case 'cross': thru(0, 96); thru(Math.PI / 2, 96); break;
      case 'xcross': for (let i = 0; i < 4; i++) thru(i * Math.PI / 4, 86); break;
      case 'star': for (const d of [-0.6, 0, 0.6]) line(ang + d, 950, 90); break;
      case 'chase': for (let i = 0; i < 3; i++) add({ kind: 'circle', r: 95, aim: true, wait: i * 0.55 }); break;
      case 'rain':
        for (let i = 0; i < 6; i++) {
          const rr = i === 0 ? 0 : 110 + this.rng() * 220, a = this.rng() * Math.PI * 2;
          add({ kind: 'circle', x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr, r: 80, wait: i * 0.12 });
        }
        break;
      default:
    }
    this.emit('bossCast', { name: skillName || D.TELL_NAMES[p] || p, pat: p, at: b, skill: !!skillName });
  }
  tickTells(dt, st) {
    if (!this.tells.length) return;
    const boss = this.mons.find((m) => m.isBoss && m.alive);
    for (const tl of this.tells) {
      if (tl.wait > 0) {
        tl.wait -= dt;
        // 늦게 깔리는 경고는 깔릴 때의 무인 자리를 노린다
        if (tl.wait <= 0 && tl.aim) { tl.x = this.heroX; tl.y = this.heroY; }
        if (tl.wait <= 0 && tl.aimLine && boss) {
          const a = Math.atan2(this.heroY - boss.y, this.heroX - boss.x);
          tl.x0 = boss.x; tl.y0 = boss.y; tl.x1 = boss.x + Math.cos(a) * 1000; tl.y1 = boss.y + Math.sin(a) * 1000;
        }
        continue;
      }
      tl.t -= dt;
      if (tl.t > 0) continue;
      tl.done = true;
      const hit = D.tellCovers(tl, this.heroX, this.heroY);
      this.emit('tellBoom', { tell: tl, hit });
      if (!hit || this.heroHp <= 0) continue;
      const red = (1 - (W.CLASSES[this.s.job]?.dmgRed || 0)) * (1 - (this.buffv.guard || 0));
      const dmg = st.hp * tl.dmg * red;
      let left = dmg;
      if (this.shield > 0 && this.buffs.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; }
      this.heroHp -= left;
      this.emit('heroHit', { amount: left, shielded: dmg - left, tell: true });
      if (this.heroHp <= 0) { this.heroDied(boss); break; }
    }
    this.tells = this.tells.filter((t) => !t.done);
  }
  // 시험용 자동 피하기: 지금 칸이 경고 안이면 가장 가까운 안전한 칸으로
  dodgeStep(react = 0) {
    const live = this.tells.filter((t) => !(t.wait > 0) && t.t <= t.max * (1 - react));
    if (!live.length) return null;
    const safe = (c, r) => !live.some((t) => D.tellCovers(t, W.tileCenter(c), W.tileCenter(r)));
    if (safe(this.hc, this.hr)) return 'hold';      // 안전하면 경고가 걷힐 때까지 다가가지 않는다
    const f = this.findStep(this.hc, this.hr, safe, 'hero');
    return f && f !== 'here' && this.stepTo(f) ? 'moved' : null;
  }
  // ---------- 십이지 뽑기 (v126) ----------
  zodiacOwned(no) { return this.s.mounts.some((m) => W.mountOf(m.kind)?.zodiac === no); }
  drawZodiac(no) {
    const n = this.s.zTickets[no] || 0;
    if (n <= 0) return null;
    this.s.zTickets[no] = n - 1;
    if (!this.s.zTickets[no]) delete this.s.zTickets[no];
    const z = D.ZODIAC[no - 1];
    let kind;
    const pity = (this.s.zPity[no] || 0) + 1;
    if (!this.zodiacOwned(no) && (pity >= D.ZODIAC_TICKETS || this.rng() < D.ZODIAC_RATE)) {
      kind = z.mount;
      delete this.s.zPity[no];
    } else {
      if (!this.zodiacOwned(no)) this.s.zPity[no] = pity;
      const top = D.zodiacTopTier(no);
      const pool = W.MOUNTS.filter((m) => m.tier <= top && !m.zodiac);
      const w = pool.map((m) => 0.55 ** (top - m.tier));
      let r = this.rng() * w.reduce((a, b) => a + b, 0);
      kind = pool[0].id;
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { kind = pool[i].id; break; } }
    }
    const mt = this.gainMount(kind, null);
    this.emit('zodiacDraw', { no, kind, zodiac: kind === z.mount });
    return mt;
  }
  // ---------- 문파 토벌 (v128) ----------
  raidLeft(now = Date.now()) {
    const r = this.s.raid;
    return r.day === D.kstDay(now) ? Math.max(0, D.RAID_PER_DAY - r.n) : D.RAID_PER_DAY;
  }
  canRaid(hpLeft, now = Date.now()) { return !this.inst && !!this.s.job && !!this.s.guildId && this.raidLeft(now) > 0 && hpLeft > 0; }
  // o: { key 주 이름, hpLeft 남은 체력, maxHp } — 문파 문서에서
  startRaid(o, now = Date.now()) {
    if (!this.canRaid(o.hpLeft, now)) return false;
    const r = this.s.raid;
    if (r.day !== D.kstDay(now)) { r.day = D.kstDay(now); r.n = 0; }
    r.n++;
    const z = W.mapOf(this.s.huntMap).mz || 1;
    const boss = D.raidBossOf(o.key);
    this.startInst({ kind: 'raid', key: o.key, map: D.raidMap(boss, this.s.level, z), t: D.RAID_SEC, max: D.RAID_SEC, wait: 0.8, castT: 3.5,
      hpLeft: o.hpLeft, sharedMax: o.maxHp, z });
    return true;
  }
  // 서열·토벌 체력 셈에 올리는 초당 피해 (토벌을 쳐 봤으면 그 값, 아니면 어림)
  raidDpsEst() {
    if (this.s.raid?.dps > 0) return this.s.raid.dps;
    const st = this.stats();
    return (st.atk / st.atkSec) * (1 + st.crit * (st.critDmg - 1)) * 2;
  }
  // 그만두기 (깬 것으로 치지 않는다 — 요일 던전은 잡은 만큼 절반)
  leaveInst() {
    if (!this.inst) return null;
    if (!this.inst.done) this.inst.done = { ok: false, left: true };
    return this.finishInst();
  }
  finishInst() {
    const I = this.inst;
    const ok = !!I.done?.ok;
    let reward = null;
    if (I.kind === 'daily') {
      const full = D.dailyReward(I.id, I.stage, this.levelGapMult(D.dailyLv(I.stage)));
      const k = ok ? 1 : D.DAILY_FAIL * Math.min(1, I.kills / I.target);
      reward = this.grant(full, k);
      // 새 단계를 깨면 열쇠 하나 — 들어간 횟수가 돌아온다 (v156)
      if (ok && I.stage > this.dailyBest(I.id)) {
        const used = this.dgnToday().used;
        used[I.id] = Math.max(0, (used[I.id] || 0) - 1);
        I.gotKey = true;
      }
      if (ok) this.s.dgn.best[I.id] = Math.max(this.dailyBest(I.id), I.stage);
    } else if (I.kind === 'tower' && ok) {
      this.s.tower.floor = Math.max(this.s.tower.floor, I.stage);
      this._stats = null;
      reward = this.grant(D.towerReward(I.stage));
    } else if (I.kind === 'raid') {
      // 친 만큼 — 서버에 올리는 건 그리는 쪽(wmain → WNet)이 한다
      I.dealt = I.boss ? Math.max(0, Math.round(I.hpLeft - Math.max(0, I.boss.hp))) : 0;
      const spent = Math.max(1, I.max - Math.max(0, I.t));
      if (I.dealt > 0) {
        this.s.raid.dps = Math.round(I.dealt / spent);
        reward = this.grant(D.raidJoinReward(this.s.level, I.z));
      }
    }
    const res = { kind: I.kind, id: I.id, stage: I.stage, ok, gotKey: !!I.gotKey, died: !!I.done?.died, timeout: !!I.done?.timeout, left: !!I.done?.left, key: I.key, dealt: I.dealt || 0,
      kills: I.kills || 0, target: I.target || 0, reward, chain: false };
    this.inst = null;
    // 탑: 이기고 '이어 오르기'면 다음 층으로
    if (I.kind === 'tower' && ok && this.s.tower.auto && !I.done.left && this.canTower()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startTower(true);
      return res;
    }
    // 요일 던전: 자동이면 남은 횟수만큼 이어서. **그만두기로 나온 건 안 잇는다** —
    // 그만두려고 눌렀는데 바로 다시 들어가면 나올 길이 없다.
    if (I.kind === 'daily' && !I.done?.left && this.autoDailyNext()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startAutoDaily();
      return res;
    }
    this.emit('instEnd', res);
    this.enterMap(this.canEnter(this.s.huntMap) ? this.s.huntMap : 0, true);
    return res;
  }
  // 보상 주기 { exp, gold, mats } × k — 실제로 준 것을 돌려준다
  grant(r, k = 1) {
    const out = {};
    if (r.exp) { out.exp = Math.floor(r.exp * k); this.addExp(out.exp); this.petExp(out.exp * 0.5); }
    if (r.gold) { out.gold = Math.floor(r.gold * k); this.s.gold += out.gold; }
    if (r.tickets) {
      out.tickets = {};
      for (const [k, n] of Object.entries(r.tickets)) { out.tickets[k] = n; this.s.zTickets[k] = (this.s.zTickets[k] || 0) + n; }
    }
    if (r.mats) {
      out.mats = {};
      for (const [key, n] of Object.entries(r.mats)) { const v = Math.floor(n * k); if (v > 0) { out.mats[key] = v; this.addMats(key, v); } }
    }
    return out;
  }

  // ---------- 방치 ----------
  // 최근 벌이를 적어 둔다 — 방치 보상은 '최근 5분처럼 계속 사냥했다면'으로 셈한다
  note(kills, exp, gold, potions) {
    const t = Math.floor(this.clock);
    const last = this.ledger[this.ledger.length - 1];
    if (last && last[0] === t) { last[1] += kills; last[2] += exp; last[3] += gold; last[4] += potions; } else this.ledger.push([t, kills, exp, gold, potions]);
    while (this.ledger.length && this.ledger[0][0] < t - W.RATE_WINDOW_SEC) this.ledger.shift();
  }
  rates() {
    if (!this.ledger.length) return null;
    const span = Math.max(30, Math.min(W.RATE_WINDOW_SEC, this.clock - this.ledger[0][0]));
    const sum = [0, 0, 0, 0];
    for (const r of this.ledger) for (let i = 0; i < 4; i++) sum[i] += r[i + 1];
    return { kills: sum[0] / span, exp: sum[1] / span, gold: sum[2] / span, potions: sum[3] / span, map: this.s.huntMap };
  }
  // 저장할 때 같이 적어 둔다 (다음에 켰을 때 쓴다)
  toJSON() { return { ...this.s, rates: this.rates() || this.s.rates || null }; }

  offlineReward(now = Date.now()) {
    const sec = Math.min(W.OFFLINE_CAP_SEC, Math.max(0, (now - (this.s.lastSeen ?? now)) / 1000));
    const r = this.s.rates;
    if (sec < 60 || !r || !(r.kills > 0)) return null;
    // 물약이 바닥나면 거기서 멈춘다
    const potionSec = r.potions > 0 ? this.s.potions / r.potions : Infinity;
    const t = Math.min(sec, potionSec);
    const kills = Math.floor(r.kills * t);
    // 재료: 처치 수만큼 굴린 기댓값 (장비는 마을 대장장이에게서)
    const m = W.mapOf(r.map);
    const mats = W.MATS[m.mz] ? Math.floor(kills * W.MAT_RATE) : 0;
    // 두목 구역에 있었다면 두목을 잡은 셈으로 증표 (다시 나기 + 잡는 데 한 70초)
    const marks = m.bossRoom ? Math.floor(t / (W.BOSS_RESPAWN + 25)) : 0;
    return { sec, t, kills, exp: Math.floor(r.exp * t), gold: Math.floor(r.gold * t + marks * W.mobGold(m.lv[1]) * W.BOSS.gold),
      potions: Math.ceil(r.potions * t), mats, marks, stoppedByPotion: potionSec < sec, map: r.map };
  }
  claimOffline(rw) {
    if (!rw) return;
    this.s.gold += rw.gold;
    this.s.potions = Math.max(0, this.s.potions - rw.potions);
    this.addExp(rw.exp);
    this.petExp(rw.exp * 0.5);
    this.s.kills += rw.kills;
    const z = W.mapOf(rw.map).mz;
    this.addMastery(W.mapOf(rw.map).zone, rw.kills);
    if (rw.mats) this.addMats(z, rw.mats + (rw.marks || 0) * W.BOSS_MATS);
    if (rw.marks) this.addMats(W.bossKey(z), rw.marks);
    if (rw.marks && G.STONES[z]) this.addMats(G.stoneKey(z), rw.marks * G.STONE_PER_BOSS);   // 후반 왕 두목 구역이었다면 강화석도
  }
}

// 길잡이가 보는 '해 봤나' (v146) — 이룬 때만 센다(돌려준 값이 참일 때). always는 부르기만 하면.
for (const [fn, key, always] of [
  ['setLine', 'line'], ['craftSet', 'set'], ['craftKacc', 'kacc'], ['makeStone', 'stone'], ['promote', 'promote'], ['enhance', 'enhance'],
  ['sweepDaily', 'sweep'], ['drawZodiac', 'zodiac'], ['buyStatBook', 'book'], ['buyBagSpace', 'bag'], ['startRaid', 'raid'],
  ['killTreasure', 'treasure', true], ['moveTo', 'move', true],
]) {
  const orig = WorldGame.prototype[fn];
  WorldGame.prototype[fn] = function (...a) {
    const r = orig.apply(this, a);
    if (always || r) this.mark(key);
    return r;
  };
}
{
  const kill = WorldGame.prototype.killMob;
  WorldGame.prototype.killMob = function (m) {
    const r = kill.call(this, m);
    if (m.isBoss && !this.inst) this.mark(this.map.king ? 'king' : 'boss');
    // 고수를 처음 쓰러뜨리면 (v148): 큰 보상과 영구 공격력·체력
    if (m.isBoss && !this.inst && this.map.master && !this.s.duel.won[this.map.master]) {
      const mm = MS.masterOf(this.map.master);
      this.s.duel.won[mm.id] = 1;
      this._stats = null;
      const reward = this.grant(MS.masterReward(mm));
      this.emit('masterDown', { id: mm.id, title: mm.title, name: mm.name, bonus: MS.masterBonusOf(mm), reward });
    }
    return r;
  };
  const enter = WorldGame.prototype.enterMap;
  WorldGame.prototype.enterMap = function (id) {
    const r = enter.call(this, id);
    if (r && !this.map.town) {
      if (this.map.king) this.mark('kingRoom');
      if (W.ZONES_W[this.map.zone]?.pair) this.mark('alt');
    }
    return r;
  };
}
