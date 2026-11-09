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
import * as PT from './wpath.js';
import * as TD from './wtoday.js';
import * as SH from './wshmup.js';
import * as PV from './wpvp.js';

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
    autoStat: true,           // v449 새 무인은 레벨업 점수를 알아서 나눈다(능력치 창에서 끌 수 있다)
    skillLv: { s0: 1, s1: 1, s2: 1, s3: 1, s4: 1 },   // 스킬 레벨 (v110) · s3 보조기(v120)
    skillPts: 0,
    passLv: {},               // 심법(패시브) 레벨 (v119)
    skillV: 3,
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
    autoMap: true,           // v260: 알맞은 사냥터 따라가기 (새 세이브는 켬 · 옛 세이브는 끔)
    mapV: 2,
    autoHunt: true,
    autoSkill: true,
    autoSkillPts: true,       // v449 무공 점수도 알아서(주력 → 보조기 → 필살기·자세 → 심법)
    autoEnh: true, autoInf: true,   // v449 새 무인은 강화·등급 각인도 자동(옛 세이브는 그대로 — 장비 창에서 켜고 끈다)
    kingParty: false,        // 십이지왕 두목 구역: false 혼자 · true 문파원과 함께 (v145, 들어갈 때 고른다)
    lastSeen: now,
    titles: [],
    title: null,          // v305 끼고 있는 칭호(열쇠)
    chatMute: [],         // v315 전체 채팅에서 가린 무인 [{ uid, name }]
    kills: 0,
    deaths: 0,
    bestMap: W.mapId(1, 1),
    // 요일 던전 (v126): 오늘 쓴 횟수 · 종류별 깬 단계 · 자동 도전(v139)
    dgn: { day: '', used: {}, best: {}, auto: false, routine: false, climb: true },   // climb(v283): 자동은 새 단계만 오르고, 막히면 멈춘다(소탕 안 함)   // routine(v230): 요일 던전 → 탑 → 사냥터
    tower: { floor: 0, auto: true },         // 무한의 탑: 오른 층 · 이기면 이어 오르기
    path: null,                              // 직업의 길 (v237) — 'a' 무공 · 'b' 평타, 2차 전직에 고른다
    zTickets: {},                            // 십이지 뽑기권 — 신 번호(1~12): 장수
    zPity: {},                               // 신마다 신수 없이 뽑은 횟수 (셋째에 꼭)
    mast: {},                                // 지역 숙련도 (v127) — 지역 번호: 잡은 수
    raid: { day: '', n: 0, dps: 0 },         // 문파 토벌 (v128): 오늘 친 횟수 · 마지막 초당 피해
    wraid: { day: '', n: 0, dps: 0, kills: 0, top1: 0 },
    pvp: { score: PV.START, best: PV.START, day: '', used: 0, win: 0, lose: 0, log: [] },   // v451 비동기 대결   // v373 월드보스: 오늘 친 횟수 · 초당 피해 · 잡힌 것을 받은 수 · 1위 수
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
// v415 최고 등급(합성할 데 없는) 탈것이 같은 종 · 길들이지 않은 것으로 MOUNT_KEEP_TOP마리를 넘으면 넘친 만큼 탈것 조각으로(타고 있는 것은 남긴다)
export function trimTopMounts(s) {
  const by = {};
  for (const m of s.mounts) { const d = W.mountOf(m.kind); if (d && d.tier >= W.MOUNT_TOP && !d.zodiac && !(m.lv > 0)) (by[m.kind] || (by[m.kind] = [])).push(m); }
  let n = 0;
  for (const list of Object.values(by)) {
    if (list.length <= W.MOUNT_KEEP_TOP) continue;
    const drop = new Set(list.filter((m) => m.uid !== s.mount).slice(W.MOUNT_KEEP_TOP - (list.some((m) => m.uid === s.mount) ? 1 : 0)).map((m) => m.uid));
    s.mounts = s.mounts.filter((m) => !drop.has(m.uid));
    n += drop.size;
  }
  if (n) s.mountShard = (s.mountShard || 0) + n * W.MOUNT_SPARE_SHARD;
  return n;
}
export function migrateWorld(raw, now = Date.now()) {
  const base = newWorldSave(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  s.autoMap = typeof raw.autoMap === 'boolean' ? raw.autoMap : false;
  s.elixir = Math.max(0, Math.min(W.ELIXIR_MAX, Number(raw.elixir) || 0));
  s.temper = Math.max(0, Math.floor(Number(raw.temper) || 0));   // v274 현철 단련 단계
  s.frag = Math.max(0, Math.floor(Number(raw.frag) || 0));        // v275 무공 비급 조각
  { const c = raw.custom && typeof raw.custom === 'object' ? raw.custom : {}; const hex = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : null);
    // v323 쓰개·신발 — 옛 세이브의 머리 '삿갓/두건'은 쓰개로 옮긴다
    const hat = W.CUSTOM_HATS.some(([k]) => k === c.hat) ? c.hat : c.head === 'hat' ? 'straw' : c.head === 'hood' ? 'hood' : null;
    const one = (list, v) => (list.some(([k]) => k === v) ? v : null);
    s.custom = { head: W.CUSTOM_HEADS.some(([k]) => k === c.head) ? c.head : null, hat, robe: hex(c.robe), band: hex(c.band), face: W.CUSTOM_FACES.some(([k]) => k === c.face) ? c.face : null, boot: hex(c.boot),
      // v325 성별·여협 머리·머리 빛깔 · 무기 모양(직업마다) · 기믹
      gender: c.gender === 'f' ? 'f' : null, fhead: one(W.CUSTOM_FHEADS, c.fhead), hair: one(W.CUSTOM_HAIRS, c.hair),
      wpn: c.wpn && typeof c.wpn === 'object' ? Object.fromEntries(Object.entries(c.wpn).filter(([k, v]) => W.weaponSkinOf(k, v))) : {},
      aura: one(W.CUSTOM_AURAS, c.aura), ring: one([...W.CUSTOM_RINGS, ...W.AWAKEN_RINGS], c.ring), glow: hex(c.glow) }; }   // v280 꾸미기 · v306 눈 · v323 쓰개·신발
  s.fragPts = Math.max(0, Math.floor(Number(raw.fragPts) || 0));  // 조각으로 얻은 무공 점수(보이기용)
  s.autoEnh = !!raw.autoEnh; s.autoInf = !!raw.autoInf;   // v262
  s.autoSkillPts = raw.autoSkillPts !== false;   // v449 무공 점수 자동(옛 세이브도 켬 — 끄면 그대로)
  s.autoJunk = !!raw.autoJunk;   // v321 약한 장비 자동 정리
  { const j = raw.junkLog && typeof raw.junkLog === 'object' ? raw.junkLog : {}; s.junkLog = { n: Math.max(0, Math.floor(Number(j.n) || 0)), gold: Math.max(0, Number(j.gold) || 0) }; }
  // v305 칭호 — 아는 것만 · 끼는 것은 가진 것 가운데
  s.titles = [...new Set((Array.isArray(raw.titles) ? raw.titles : []).filter((k) => typeof k === 'string' && W.titleOf(k)))];
  s.title = typeof raw.title === 'string' && s.titles.includes(raw.title) && W.titleOf(raw.title) ? raw.title : null;
  // v316 주간 두목 — 이번 주 것만 쓴다(키가 다르면 wbossState가 새로 연다)
  { const w = raw.wboss && typeof raw.wboss === 'object' ? raw.wboss : null; const b = w?.best && typeof w.best === 'object' ? w.best : {};
    s.wboss = w && typeof w.key === 'string' ? { key: w.key.slice(0, 10), kills: Math.max(0, Math.min(1e6, Math.floor(Number(w.kills) || 0))), best: Object.fromEntries(W.WBOSS_RACE.filter((k) => Number(b[k]) >= W.WBOSS_MIN_SEC).map((k) => [k, Math.min(36000, Number(b[k]))])) } : null; }
  // v318 기한 있는 칭호(주간 패왕) · 받은 지난주 순위 보상
  { const tu = raw.titleUntil && typeof raw.titleUntil === 'object' ? raw.titleUntil : {}; s.titleUntil = {}; for (const [k, v] of Object.entries(tu)) if (W.titleOf(k)?.timed && Number(v) > 0) s.titleUntil[k] = Number(v); }
  for (const t of Object.values(W.TITLES)) if (t.timed && s.titles.includes(t.id) && !s.titleUntil[t.id]) s.titles = s.titles.filter((k) => k !== t.id);   // 기한 없이 남은 것은 버린다
  if (s.title && !s.titles.includes(s.title)) s.title = null;
  s.wbClaimed = typeof raw.wbClaimed === 'string' ? raw.wbClaimed.slice(0, 10) : null;
  // v320 출석부
  { const a = raw.att && typeof raw.att === 'object' ? raw.att : {}; s.att = { day: typeof a.day === 'string' ? a.day.slice(0, 10) : null, n: Math.max(0, Math.min(TD.ATT_DAYS, Math.floor(Number(a.n) || 0))), total: Math.max(0, Math.floor(Number(a.total) || 0)) }; }
  // v315 가린 무인 — uid·이름만, 200명까지
  s.chatMute = (Array.isArray(raw.chatMute) ? raw.chatMute : []).filter((x) => x && typeof x.uid === 'string' && x.uid.length <= 128)
    .map((x) => ({ uid: x.uid, name: String(x.name || '무명').slice(0, 12) })).filter((x, i, a) => a.findIndex((y) => y.uid === x.uid) === i).slice(0, 200);
  // v371 자동 강화 설정 — max: 몇 강까지(1~AUTO_ENH_MAX) · slots: {칸: false면 건너뜀} · keep: 남길 은자 몫(0·10·30·50%)
  { const c = raw.autoEnhCfg && typeof raw.autoEnhCfg === 'object' ? raw.autoEnhCfg : {}; const sl = {}; for (const k of W.GROW_SLOTS) if (c.slots?.[k] === false) sl[k] = false;
    s.autoEnhCfg = { max: Math.max(1, Math.min(W.AUTO_ENH_MAX, Math.floor(Number(c.max) || W.AUTO_ENH_MAX))), slots: sl, keep: [0, 10, 30, 50].includes(c.keep) ? c.keep : 0 }; }
  // v292 자동 등급 각인 고르기 — only: 고른 증표만 · marks: {증표: 고유 효과 번호} · slots: {칸: false면 건너뜀}
  { const c = raw.autoInfCfg && typeof raw.autoInfCfg === 'object' ? raw.autoInfCfg : {}; const mk = {}; for (const [k, v] of Object.entries(c.marks || {})) if (W.isMarkKey(k)) mk[k] = Math.max(0, Math.min(2, Math.floor(Number(v) || 0)));
    const sl = {}; for (const k of W.GROW_SLOTS) if (c.slots?.[k] === false) sl[k] = false;
    // v293 mode: all(센 것부터) · pick(고른 증표) · pref(좋아하는 효과 — 맞는 증표를 찾아서). only는 옛 저장(pick)
    const FXK = new Set(Object.values(IM.THEMES).flatMap((t) => t.fx.map(([k]) => k)));
    const mode = ['all', 'pick', 'pref', 'theme'].includes(c.mode) ? c.mode : c.only ? 'pick' : raw.autoInfCfg ? 'all' : 'theme';   // v386 새 무인은 '고른 기운대로'
    const prefFx = Array.isArray(c.prefFx) ? [...new Set(c.prefFx.filter((k) => FXK.has(k)))].slice(0, 8) : [];
    const prefSp = Array.isArray(c.prefSp) ? [...new Set(c.prefSp.filter((k) => k in IM.SPECIAL_KIND))].slice(0, 8) : [];
    // v294 좋아하는 스킬 변화(꼴 · 몇 차 무공) — 다시 굴릴 때 경고 · ♥
    const prefSk = Array.isArray(c.prefSk) ? [...new Set(c.prefSk.filter((k) => IM.SK_KINDS.includes(k)))] : [];
    const prefSkSlot = Array.isArray(c.prefSkSlot) ? [...new Set(c.prefSkSlot.filter((k) => [0, 1, 2].includes(k)))] : [];
    s.autoInfCfg = { mode, only: mode === 'pick', marks: mk, slots: sl, prefFx, prefSp, prefSk, prefSkSlot, dan: c.danV === 2 && c.dan === true, danV: 2 }; }   // v297 dan: 남는 증표로 칸 단 올리기 · v370 기본 꺼짐(옛 저장도 끔) — 켜야만 한다
  // v384 간단 각인 — 장비 칸마다 고른 기운(테마)
  s.impTheme = {};
  for (const [k, v] of Object.entries(raw.impTheme || {})) if (W.SLOTS.some((x) => x.id === k) && v in IM.THEMES) s.impTheme[k] = v;
  s.loadout = raw.loadout === 1 ? 1 : 0;
  { const dx = raw.dex && typeof raw.dex === 'object' ? raw.dex : {}; s.dex = {}; for (const [k, v] of Object.entries(dx)) { const n = Math.min(9999, Math.floor(Number(v) || 0)); if (n > 0) s.dex[k] = n; } }
  // v311 각성은 무공마다 — { s0: 'wide', s2: 'twin', … }. 옛 저장의 하나({ slot, kind })는 그 무공 자리로 옮긴다
  { const ok = (sl, k) => /^s[0-3]$/.test(sl) && W.AWAKEN_KINDS.some((x) => x.id === k);
    s.awakens = {};
    if (raw.awakens && typeof raw.awakens === 'object') for (const [sl, k] of Object.entries(raw.awakens)) if (ok(sl, k)) s.awakens[sl] = k;
    if (raw.awaken && typeof raw.awaken === 'object' && ok(raw.awaken.slot, raw.awaken.kind) && !s.awakens[raw.awaken.slot]) s.awakens[raw.awaken.slot] = raw.awaken.kind;
    delete s.awaken; }
  { const e = raw.enl && typeof raw.enl === 'object' ? raw.enl : {}; s.enl = { pts: Math.max(0, Math.floor(Number(e.pts) || 0)), exp: Math.max(0, Number(e.exp) || 0), nodes: {} }; for (const [k, v] of Object.entries(e.nodes || {})) { const n = Math.min(W.ENL_MAX, Math.floor(Number(v) || 0)); if (n > 0) s.enl.nodes[k] = n; } }
  s.loadouts = Array.isArray(raw.loadouts) ? [0, 1].map((i) => { const lo = raw.loadouts[i]; return lo && typeof lo === 'object' ? { stats: { ...(lo.stats || {}) }, skillLv: { ...(lo.skillLv || {}) }, passLv: { ...(lo.passLv || {}) } } : null; }) : [null, null];
  s.petShard = Math.max(0, Math.floor(Number(raw.petShard) || 0)); s.petSoul = Math.max(0, Math.floor(Number(raw.petSoul) || 0)); s.petSoulExp = Math.max(0, Number(raw.petSoulExp) || 0);
  if (raw.today && typeof raw.today === 'object' && typeof raw.today.day === 'string') s.today = { day: raw.today.day, cnt: { ...(raw.today.cnt || {}) }, claimed: { ...(raw.today.claimed || {}) } }; else s.today = null;
  if (raw.week && typeof raw.week === 'object' && typeof raw.week.key === 'string') s.week = { key: raw.week.key, pts: Math.max(0, Math.floor(Number(raw.week.pts) || 0)), opened: !!raw.week.opened }; else s.week = null;
  { const bk = raw.bossKills && typeof raw.bossKills === 'object' ? raw.bossKills : {}; s.bossKills = {}; for (const [k, v] of Object.entries(bk)) { const n = Math.floor(Number(v) || 0); if (n > 0) s.bossKills[k] = n; } }
  { const hl = raw.hall && typeof raw.hall === 'object' ? raw.hall : {}; s.hall = {}; for (const k of Object.keys(W.HALL)) { const v = Math.floor(Number(hl[k]) || 0); if (v > 0) s.hall[k] = Math.min(W.HALL[k].max, v); } }
  s.stats = { ...base.stats, ...(raw.stats || {}) };
  s.skillLv = { ...base.skillLv, ...(raw.skillLv || {}) };
  for (const k of Object.keys(s.skillLv)) s.skillLv[k] = clamp(Math.floor(Number(s.skillLv[k]) || 1), 1, W.SKILL_LV_MAX);
  // v110: 스킬 점수 — 옛 세이브는 레벨 15부터 오른 만큼 한 번에
  if ((raw.skillV || 0) < 1) { s.skillPts = Math.max(0, (Number(raw.level) || 1) - W.SKILL_PT_FROM_OLD + 1); s.skillV = 1; }
  // v205: 무공 값이 싸졌다 — 옛 값으로 올린 만큼과 새 값의 차이를 점수로 돌려준다(레벨은 그대로)
  if ((s.skillV || 0) < 2) {
    let back = 0;
    for (const lv of Object.values(s.skillLv || {})) back += W.skillSpent(Math.min(lv, 10), W.skillLvCostOld) - W.skillSpent(Math.min(lv, 10));
    s.skillPts = (Number(s.skillPts) || 0) + Math.max(0, back);
    s.skillRefund = Math.max(0, back);
    s.skillV = 2;
  }
  // v270: 스킬 점수가 레벨 15 → 5부터 — 이미 지나온 레벨 몫(최대 10점)을 한 번에 준다
  if ((s.skillV || 0) < 3) {
    const L = Number(s.level) || Number(raw.level) || 1;
    const add = Math.max(0, L - W.SKILL_PT_FROM + 1) - Math.max(0, L - W.SKILL_PT_FROM_OLD + 1);
    if (add > 0) { s.skillPts = (Number(s.skillPts) || 0) + add; s.skillGift = add; }
    s.skillV = 3;
  }
  s.skillPts = Math.max(0, Math.floor(Number(s.skillPts) || 0));
  for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, Math.floor(Number(s.stats[k]) || 0));
  s.equip = { ...base.equip, ...(raw.equip || {}) };
  const okPet = (p) => p && W.PETS.some((x) => x.id === p.kind) && W.RARITY[p.rar];
  const fixPet = (p) => { p.star = Math.max(0, Math.min(W.PET_STAR_MAX, Math.floor(Number(p.star) || 0))); p.q = Math.max(0, Math.min(2, Math.floor(Number(p.q) || 0))); p.dan = Math.max(0, Math.min(W.PET_DAN_MAX, Math.floor(Number(p.dan) || 0))); p.danFail = Math.max(0, Math.min(20, Math.floor(Number(p.danFail) || 0))); p.lock = !!p.lock || undefined; return p; };   // v292 별 · v316 품·단
  s.pets = Array.isArray(raw.pets) ? raw.pets.filter(okPet).map(fixPet) : [];
  s.petBox = Array.isArray(raw.petBox) ? raw.petBox.filter(okPet).map(fixPet).slice(0, W.PET_BOX) : [];
  s.mounts = Array.isArray(raw.mounts) ? raw.mounts.filter((m) => m && W.mountOf(m.kind)).map((m) => ({ ...m, lv: Math.max(0, Math.min(W.mountLvMax(W.mountOf(m.kind)), Math.floor(Number(m.lv) || 0))) })) : [];   // v292 길들이기
  // v292 도감 — 한 번이라도 가진 종(애완은 가장 높은 등급) · 이정표 받은 것
  { const pd = raw.petDex && typeof raw.petDex === 'object' ? raw.petDex : {}; s.petDex = {}; for (const pp of W.PETS) if (pd[pp.id] != null && W.RARITY[pd[pp.id]]) s.petDex[pp.id] = Math.floor(pd[pp.id]); }
  { const md = raw.mountDex && typeof raw.mountDex === 'object' ? raw.mountDex : {}; s.mountDex = {}; for (const mm of W.MOUNTS) if (md[mm.id]) s.mountDex[mm.id] = 1; }
  { const g = raw.dexGoals && typeof raw.dexGoals === 'object' ? raw.dexGoals : {}; const arr = (v) => (Array.isArray(v) ? v.filter((x) => Number.isInteger(x) && x >= 0 && x < 20) : []); s.dexGoals = { pet: arr(g.pet), myth: arr(g.myth), mount: arr(g.mount) }; }
  for (const pp of [...s.pets, ...s.petBox]) s.petDex[pp.kind] = Math.max(s.petDex[pp.kind] ?? -1, pp.rar || 0);
  for (const mm of s.mounts) s.mountDex[mm.kind] = 1;
  s.mountShard = Math.max(0, Math.floor(Number(raw.mountShard) || 0));
  const gc = raw.gacha && typeof raw.gacha === 'object' ? raw.gacha : {};   // v362 뽑기 천장
  s.gachaLog = Array.isArray(raw.gachaLog) ? raw.gachaLog.filter((e) => e && typeof e.id === 'string' && (W.PETS.some((p) => p.id === e.id) || W.mountOf(e.id))).slice(-100).map((e) => ({ t: Number(e.t) || 0, k: e.k === 'mount' ? 'mount' : 'pet', id: e.id, r: Math.max(0, Math.min(4, Math.floor(Number(e.r) || 0))), g: Math.max(0, Math.min(4, Math.floor(Number(e.g) || 0))) })) : [];   // v366 뽑기 기록(최근 100)
  s.gacha = Object.fromEntries(['pet', 'mount'].map((k) => [k, { n: Math.max(0, Math.floor(Number(gc[k]?.n) || 0)), pity: Math.max(0, Math.floor(Number(gc[k]?.pity) || 0)), free: typeof gc[k]?.free === 'string' ? gc[k].free.slice(0, 10) : null }]));
  if (!s.mounts.some((m) => m.uid === s.mount)) s.mount = null;
  trimTopMounts(s);   // v415 넘치는 최고 등급 탈것은 조각으로
  s.mats = {};
  // v273 옛 지역 재료는 그 지역 가중치대로 현철로 (한 번만 — 들어온 뒤로는 지역 재료 열쇠가 남지 않는다)
  for (const [k, v] of Object.entries(raw.mats || {})) if (W.isZoneMatKey(k) && v > 0) { const o = W.oreOf(k, Math.floor(Number(v) || 0)); s.mats[W.ORE] = (s.mats[W.ORE] || 0) + o.n; }
  if (raw.mats?.[W.ORE] > 0) s.mats[W.ORE] = (s.mats[W.ORE] || 0) + Math.floor(Number(raw.mats[W.ORE]) || 0);
  for (const [k, v] of Object.entries(raw.mats || {})) if (!W.isZoneMatKey(k) && ( (k[0] === 'b' && W.MATS[k.slice(1)]) || G.isStoneKey(k) || LN.isFacMat(k) || G.isLordMat(k)) && v > 0) s.mats[k] = Math.floor(Number(v) || 0);
  delete s.autoSell;
  // v399 만든 강화석(되돌릴 수 있는 몫) — 옛 세이브는 개수를 몰라 두목이 떨군 몫(300)을 뺀 나머지를 만든 것으로 본다
  { const sm = raw.stoneMade && typeof raw.stoneMade === 'object' ? raw.stoneMade : null; s.stoneMade = {};
    for (const z of Object.keys(G.STONES)) { const k = G.stoneKey(z); const v = sm ? Math.floor(Number(sm[k]) || 0) : Math.max(0, (s.mats[k] || 0) - 300); if (v > 0) s.stoneMade[k] = v; } }
  // v105: 레벨업 점수를 직접 찍게 바꿨다 — 옛 세이브의 '자동 분배 켬'은 한 번 끈다
  if ((raw.statV || 0) < 2) { s.autoStat = false; s.statV = 2; }
  s.bag = Array.isArray(raw.bag) ? raw.bag.filter((i) => i && W.SLOTS.some((x) => x.id === i.slot)) : [];
  s.level = clamp(Math.floor(Number(s.level) || 1), 1, W.LEVEL_MAX);
  for (const k of ['exp', 'gold', 'potions', 'statPts', 'jobTier', 'kills', 'deaths', 'books', 'prot']) s[k] = Math.max(0, Number(s[k]) || 0);
  s.jobTier = Math.min(W.CHEONMA_JOBS.includes(s.job) ? 5 : 4, Math.floor(s.jobTier));   // v391 검사는 5차까지
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
  s.dgn = { day: typeof dg.day === 'string' ? dg.day : '', used: {}, best: {}, fail: {}, keys: {}, extra: {} };
  for (const d of D.DAILY) {
    s.dgn.used[d.id] = Math.max(0, Math.floor(Number(dg.used?.[d.id]) || 0));
    if (dg.fail?.[d.id]) s.dgn.fail[d.id] = Math.max(0, Math.floor(Number(dg.fail[d.id]) || 0));
    if (dg.left?.[d.id]) (s.dgn.left || (s.dgn.left = {}))[d.id] = 1;   // v417 오늘 손으로 나온 던전
    if (dg.keys?.[d.id]) s.dgn.keys[d.id] = Math.max(0, Math.floor(Number(dg.keys[d.id]) || 0));
    if (dg.extra?.[d.id]) s.dgn.extra[d.id] = Math.max(0, Math.min(D.DAILY_ENTRIES, Math.floor(Number(dg.extra[d.id]) || 0)));
    s.dgn.best[d.id] = clamp(Math.floor(Number(dg.best?.[d.id]) || 0), 0, D.DAILY_STAGES);
  }
  const tw = raw.tower && typeof raw.tower === 'object' ? raw.tower : {};
  s.tower = { floor: clamp(Math.floor(Number(tw.floor) || 0), 0, D.TOWER_MAX), auto: tw.auto !== false };
  s.tower.hard = clamp(Math.floor(Number(tw.hard) || 0), 0, D.HARD_MAX);   // v350 극(하드) 오른 층
  if (tw.cor && typeof tw.cor.key === 'string') s.tower.cor = { key: tw.cor.key, best: Math.max(0, Math.floor(Number(tw.cor.best) || 0)), all: Math.max(0, Math.floor(Number(tw.cor.all) || 0)) };   // v263
  // v230: 전에는 s.dgn을 새로 짜며 auto를 빼먹어 다시 들어오면 늘 꺼져 있었다
  s.path = raw.path === 'a' || raw.path === 'b' ? raw.path : null;   // v237
  s.dgn.auto = !!dg.auto;
  s.dgn.routine = !!dg.routine;
  if (dg.pauseUntil > 0) s.dgn.pauseUntil = Math.min(Number(dg.pauseUntil), Date.now() + 3600e3);   // v417
  s.dgn.climb = dg.climb !== false;   // v283 등반 모드 — 처음엔 켜 둔다
  s.tower.failPow = Math.max(0, Number(tw.failPow) || 0);
  s.quest = clamp(Math.floor(Number(s.quest) || 0), 0, Q.QUEST_COUNT);
  s.did = raw.did && typeof raw.did === 'object' ? { ...raw.did } : {};
  s.duel = { won: { ...(raw.duel?.won || {}) }, stars: {} };
  for (const [k, v] of Object.entries(raw.duel?.stars || {})) { const n = Math.floor(Number(v) || 0) & 3; if (n) s.duel.stars[k] = n; }   // v262
  // v407 각성 고수 — 켠 것(on)과 쓰러뜨린 수(kills)
  s.awk = { on: {}, kills: {} };
  s.awk.best = {};   // v409 가장 빨리 잡은 초
  s.awk.rings = {}; s.awk.rpity = {};   // v413 전용 발밑 문양 · 천장
  for (const id of W.AWAKEN_IDS) { if (raw.awk?.rings?.[id]) s.awk.rings[id] = 1; const p = Math.floor(Number(raw.awk?.rpity?.[id]) || 0); if (p > 0) s.awk.rpity[id] = Math.min(W.AWAKEN_RING_PITY, p); }
  for (const id of W.AWAKEN_IDS) { if (raw.awk?.on?.[id] === true) s.awk.on[id] = true; const n = Math.floor(Number(raw.awk?.kills?.[id]) || 0); if (n > 0) s.awk.kills[id] = n; const b = Number(raw.awk?.best?.[id]); if (b >= 1 && b < 36000) s.awk.best[id] = Math.round(b * 10) / 10; }
  s.questGift = Number.isInteger(raw.questGift) ? raw.questGift : -1;
  const rd = raw.raid && typeof raw.raid === 'object' ? raw.raid : {};
  s.raid = { day: typeof rd.day === 'string' ? rd.day : '', n: clamp(Math.floor(Number(rd.n) || 0), 0, D.RAID_PER_DAY + 1), dps: Math.max(0, Number(rd.dps) || 0) };   // v428 길잡이 덤 한 번까지
  { const p = raw.pvp && typeof raw.pvp === 'object' ? raw.pvp : {};   // v451 비동기 대결
    const n0 = (v, hi) => clamp(Math.floor(Number(v) || 0), 0, hi);
    s.pvp = { score: n0(p.score ?? PV.START, 99999), best: n0(p.best ?? PV.START, 99999), day: typeof p.day === 'string' ? p.day.slice(0, 10) : '', used: n0(p.used, 99), win: n0(p.win, 1e7), lose: n0(p.lose, 1e7),
      log: (Array.isArray(p.log) ? p.log : []).slice(0, PV.LOG_MAX).filter((x) => x && typeof x === 'object').map((x) => ({ n: String(x.n || '').slice(0, 12), j: PV.JOB_PATS[x.j] ? x.j : null, w: !!x.w, d: clamp(Math.round(Number(x.d) || 0), -99, 99), at: Math.max(0, Number(x.at) || 0), npc: !!x.npc, why: String(x.why || '').slice(0, 8) })) };
    if (p.score == null) s.pvp.score = PV.START; if (p.best == null) s.pvp.best = Math.max(PV.START, s.pvp.score); }
  { const w = raw.wraid && typeof raw.wraid === 'object' ? raw.wraid : {};   // v373 월드보스
    s.wraid = { day: typeof w.day === 'string' ? w.day.slice(0, 10) : '', n: clamp(Math.floor(Number(w.n) || 0), 0, 999), dps: Math.max(0, Number(w.dps) || 0),
      kills: Math.max(0, Math.floor(Number(w.kills) || 0)), top1: Math.max(0, Math.floor(Number(w.top1) || 0)), ok: Math.max(0, Math.floor(Number(w.ok) || 0)), sk: Math.max(0, Math.floor(Number(w.sk) || 0)),
      gates: Object.fromEntries(Object.keys(w.gates || {}).filter((k) => D.isGate(k)).map((k) => [k, 1])),
      read: Object.fromEntries(Object.keys(w.read || {}).filter((k) => /^\d{1,2}$/.test(k) && +k < D.HEAVEN_STORY.length).map((k) => [k, 1])),
      pity: Object.fromEntries(Object.entries(w.pity || {}).filter(([k, v]) => D.WRAID_BOSS[k] && v > 0).map(([k, v]) => [k, clamp(Math.floor(Number(v) || 0), 0, D.PALMA_PITY)])),   // v409 대성신장 천장
      auto: w.auto === true,
      owe: Object.fromEntries(Object.entries(w.owe || {}).filter(([k, v]) => D.WRAID_BOSS[String(k).split('_')[0]] && v && D.WRAID_BOSS[v.boss] && v.rank >= 1).slice(-20).map(([k, v]) => [k, { rank: Math.floor(v.rank), boss: v.boss }])),   // v432 받음은 적었는데 못 준 보상
      pend: Object.fromEntries(Object.entries(w.pend || {}).filter(([k, v]) => D.WRAID_BOSS[String(k).split('_')[0]] && v && v.amt > 0 && v.at > 0).slice(-10).map(([k, v]) => [k, { amt: Math.floor(v.amt), at: Number(v.at) }])),   // v432 끊겨 못 올린 피해
      part: Object.fromEntries(Object.entries(w.part || {}).filter(([k, v]) => D.WRAID_BOSS[String(k).split('_')[0]] && v > 0).slice(-40).map(([k, v]) => [k, Number(v)])) }; }   // v413 칠대성 자동 반복 · v420 이 캐릭터가 친 판
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
      { const o = W.oreOf(k, Math.round(m * (up ? 1.5 : 1))); s.mats[o.key] = (s.mats[o.key] || 0) + o.n; }   // v273 현철로
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
  // v307 각인은 장비마다 한 칸 — 옛 세 칸은 가장 깊은(단) 칸 하나만 남기고, 나머지에 든 증표(새긴 값 + 단 올린 값)를 돌려준다
  { const one = (it) => {
      if (!it || !Array.isArray(it.imps)) return;
      const es = it.imps.map((e, i) => [IM.normEntry(e), i]).filter(([e]) => e && W.isMarkKey(e.k));
      if (es.length <= 1) { it.imps = es.length ? [es[0][0]] : []; return; }
      es.sort((a, b) => (IM.danOf(b[0]) - IM.danOf(a[0])) || (b[1] - a[1]));
      for (const [e, i] of es.slice(1)) s.mats[e.k] = (s.mats[e.k] || 0) + W.INFUSE_MARKS[Math.min(3, i + 1)] + IM.danSpent(0, IM.danOf(e));
      it.imps = [es[0][0]];
    };
    for (const it of Object.values(s.equip || {})) one(it);
    for (const it of s.bag || []) one(it); }
  // v432 세이브 값 다듬기 — 망가졌거나 다른 기기에서 넘어온 값 하나로 캐릭터가 안 열리거나(등급 9 → RARITY 없음)
  //   애완동물 레벨이 비어 피해가 NaN(몹이 안 죽는다)이던 것. 범위 밖이면 가까운 값으로
  { const num = (v, lo, hi, d = lo) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
    const fixItem = (it) => {
      if (!it || typeof it !== 'object') return null;
      if (it.rar != null) it.rar = Math.floor(num(it.rar, 0, W.RARITY.length - 1));
      if (it.grade != null) it.grade = Math.floor(num(it.grade, 0, W.GRADES.length - 1));
      if (it.plus != null) it.plus = Math.floor(num(it.plus, 0, W.ENHANCE_MAX));
      if (it.tr != null) it.tr = Math.floor(num(it.tr, 0, W.TRANS_MAX));
      if (it.ilv != null) it.ilv = Math.floor(num(it.ilv, 1, 300, 1));
      for (const k of ['epity', 'tpity']) if (it[k] != null) it[k] = num(it[k], 0, 1, 0);
      return it;
    };
    for (const k of Object.keys(s.equip || {})) s.equip[k] = s.equip[k] ? fixItem(s.equip[k]) : null;
    s.bag = (s.bag || []).map(fixItem).filter(Boolean);
    for (const p of [...(s.pets || []), ...(s.petBox || [])]) { p.lv = Math.floor(num(p.lv, 1, W.PET_LV_MAX, 1)); p.exp = num(p.exp, 0, 1e18, 0); }
    // 시계 — 한 번 미래로 맞춰졌던 기기는 clockMax가 줄지 않아 방치 보상이 영영 0이었다(지금 + 하루까지만)
    for (const k of ['clockMax', 'lastSeen']) if (s[k] != null) { const v = Number(s[k]); s[k] = Number.isFinite(v) ? Math.min(v, now + 86400e3) : now; }
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
    if ((this.s.mainV || 0) < 1) { try { this.consolidateSkills(); } catch { /* 직업 전 */ } this.s.mainV = 1; }   // v444 옛 세이브 — 무공 레벨을 주력으로 모은다
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
    // v260: 자동 시전으로 펼친 무공은 auto — 그리는 쪽이 필살 컷인을 짧은 판으로 바꾼다
    if (type === 'skill' && this._autoCast) data.auto = true;
    this.events.push({ type, ...data });
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
  }
  jobTier() { return this.s.jobTier; }
  heroLabel() { const t = this.titleNow(); return `${t ? `〈${t.name}〉 ` : ''}${W.lvShort(this.s.level)} ${this.s.nickname || ''}`; }   // v446 99 뒤는 수련
  // ---------- v305 칭호 ----------
  titleNow() { return this.s.title ? W.titleOf(this.s.title) : null; }
  hasTitle(k) { return this.s.titles.includes(k); }
  grantTitle(k) {
    const t = W.titleOf(k);
    if (!t || this.hasTitle(k)) return false;
    this.s.titles.push(k);
    this._stats = null;
    if (!this.s.title) this.wearTitle(k);
    this.emit('title', { id: k, name: t.name, auto: !!t.how });
    return true;
  }
  // v307 자동 칭호 — 조건을 이룬 칭호를 저절로 준다 (5초마다 · 던전 끝·전직 때)
  titleDone(id) {
    const s = this.s;
    switch (id) {
      case 'tower50': return (s.tower?.floor || 0) >= 50;
      case 'awk1': return Object.values(s.awk?.kills || {}).some((n) => n > 0);
      case 'awkMagwi': return (s.awk?.kills?.magwi || 0) > 0;
      case 'awkAll': return W.AWAKEN_IDS.every((k) => (s.awk?.kills?.[k] || 0) > 0);
      case 'daily50': return Math.max(0, ...Object.values(s.dgn?.best || {})) >= 50;
      case 'daily75': return Math.max(0, ...Object.values(s.dgn?.best || {})) >= 75;
      case 'daily100': return Math.max(0, ...Object.values(s.dgn?.best || {})) >= 100;
      case 'tower120': return (s.tower?.floor || 0) >= 120;
      case 'hard30': return (s.tower?.hard || 0) >= 30;
      case 'hard60': return (s.tower?.hard || 0) >= 60;
      case 'kings': return Object.keys(W.ZONES_W).filter((z) => W.ZONES_W[z]?.king).every((z) => (s.bossKills?.[W.mapId(+z, W.BOSS_AREA)] || 0) > 0);
      case 'cheonma': return !!s.duel?.won?.cheonma;
      case 'hwamugi': return !!s.duel?.won?.hwamugi;
      case 'magwi': return !!s.duel?.won?.magwi;
      case 'lv100': return s.level >= 100;
      case 'lv150': return s.level >= 150;
      case 'quest': return (s.quest || 0) >= Q.QUEST_COUNT;
      case 'dan10': return W.SLOTS.some((x) => IM.imprintsOf(s.equip[x.id]).some((im) => im.d >= IM.DAN_MAX));
      case 'res4': return (this.resonance().top?.tier ?? -1) >= 3;
      case 'okq': return W.SLOTS.some((x) => IM.imprintsOf(s.equip[x.id]).some((im) => im.q.id === 2));
      case 'petdan': return [...s.pets, ...s.petBox].some((p) => (p.dan || 0) >= W.PET_DAN_MAX);
      case 'petq': return [...s.pets, ...s.petBox].some((p) => (p.q || 0) >= 2);
      case 'wb100': return (s.wboss?.kills || 0) >= 100;
      case 'wbfast': return s.wboss?.best?.hwamugi > 0 && s.wboss.best.hwamugi <= 60;
      case 'pet5q': return [...s.pets, ...s.petBox].filter((p) => (p.q || 0) >= 1).length >= 5;
      case 'titles15': return this.titleSet().n >= 15;
      case 'k100k': return (s.kills || 0) >= 100000;
      case 'k1m': return (s.kills || 0) >= 1000000;
      case 'pvp10': return (s.pvp?.win || 0) >= 10;   // v452
      case 'pvp50': return (s.pvp?.win || 0) >= 50;
      case 'pvp1300': return (s.pvp?.best || 0) >= 1300;
      case 'wraid10': return (s.wraid?.kills || 0) >= 10;
      case 'wraid1': return (s.wraid?.top1 || 0) >= 1;
      case 'palma8': return this.palmaReady().ok;
      case 'okhwang': return (s.wraid?.ok || 0) >= 1;
      case 'seokga': return (s.wraid?.sk || 0) >= 1;
      default: return false;
    }
  }
  checkTitles(now = Date.now()) {
    let n = 0;
    // v318 기한이 지난 칭호는 거둔다(끼고 있었으면 벗긴다)
    for (const [k, until] of Object.entries(this.s.titleUntil || {})) {
      if (until > now) continue;
      delete this.s.titleUntil[k];
      this.s.titles = this.s.titles.filter((x) => x !== k);
      if (this.s.title === k) this.s.title = null;
      this._stats = null;
      this.emit('titleExpire', { id: k, name: W.titleOf(k)?.name });
    }
    for (const t of Object.values(W.TITLES)) if (t.how && !this.hasTitle(t.id) && this.titleDone(t.id)) { this.grantTitle(t.id); n++; }
    return n;
  }
  // v318 기한 있는 칭호 — 이미 있으면 기한만 늘린다
  grantTimedTitle(k, until) {
    const t = W.titleOf(k);
    if (!t?.timed) return false;
    const tu = this.s.titleUntil || (this.s.titleUntil = {});
    tu[k] = Math.max(tu[k] || 0, until);
    if (!this.hasTitle(k)) this.grantTitle(k);
    return true;
  }
  // v318 지난주 두목 순위 보상 — ranks: { kills, hwamugi, magwi } (1~3 또는 null). 가장 좋은 자리 하나로 한 번
  weekRewardFor(ranks) {
    const best = Math.min(...['kills', 'hwamugi', 'magwi'].map((k) => (ranks?.[k] >= 1 && ranks[k] <= 3 ? ranks[k] : 99)));
    if (best > 3) return null;
    const r = W.WB_REWARD[best - 1];
    return { best, soul: r.soul, shard: r.shard, gold: Math.round(TD.weekChest(this.s.level).gold * r.goldK), title: best === 1 ? 'wking' : null };
  }
  claimWeekReward(key, ranks, now = Date.now()) {
    if (!key || this.s.wbClaimed === key) return null;
    const rw = this.weekRewardFor(ranks);
    this.s.wbClaimed = key;
    if (!rw) return null;
    this.s.petSoul = (this.s.petSoul || 0) + rw.soul;
    this.addShards(rw.shard, rw.shard);
    this.s.gold += rw.gold;
    if (rw.title) this.grantTimedTitle(rw.title, now + W.WB_TITLE_DAYS * 86400e3);
    this.emit('weekReward', { key, ranks, ...rw });
    return rw;
  }
  // v315 칭호 모음 — 가진 칭호(겹친 옛 이름은 하나로) 하나마다 공격력·체력 +1%. 끼지 않아도 붙는다
  titleSet() {
    const ids = new Set();
    for (const k of this.s.titles || []) { const t = W.titleOf(k); if (t) ids.add(t.id); }
    const n = ids.size;
    return { n, atk: n * W.TITLE_SET_BONUS, hp: n * W.TITLE_SET_BONUS };
  }
  // v315 전체 채팅 가리기 — 이 기기·이 계정에서만 안 보인다(그 사람은 모른다)
  isMuted(uid) { return !!uid && this.s.chatMute.some((x) => x.uid === uid); }
  muteChat(uid, name) {
    if (!uid || this.isMuted(uid)) return false;
    this.s.chatMute.push({ uid, name: String(name || '무명').slice(0, 12) });
    if (this.s.chatMute.length > 200) this.s.chatMute.shift();
    return true;
  }
  unmuteChat(uid) { const n = this.s.chatMute.length; this.s.chatMute = this.s.chatMute.filter((x) => x.uid !== uid); return this.s.chatMute.length < n; }
  wearTitle(k) {
    if (k != null && !this.hasTitle(k)) return false;
    this.s.title = k || null;
    this._stats = null;
    return true;
  }
  ranged() { return !!W.classOf(this.s.job)?.range; }
  // 그리는 쪽: 무인 뒤를 따르는 애완동물 · 탄 탈것
  petTeam() { return this.activePets().map((p) => ({ kind: p.kind, emoji: W.petOf(p.kind).emoji, rar: p.rar })); }
  mountNow() { const m = this.s.mounts.find((x) => x.uid === this.s.mount); return m ? W.mountOf(m.kind) : null; }
  mountInst() { return this.s.mounts.find((x) => x.uid === this.s.mount) || null; }
  mountK(m) { return 1 + ((m?.lv) || 0) * W.mountLvK(m && W.mountOf(m.kind)); }   // v292 길들이기 · v361 신수는 레벨마다 4%
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
  // v243: 강화 공유 — 세트·왕의 장비는 그 칸 성장 장비의 강화(+N)를 함께 쓴다(둘 중 높은 쪽).
  // 성장 장비에 쏟은 강화가 레벨 100 세트로 갈아탈 때 버려지지 않게.
  sharedPlus(it) {
    if (!it || it.grow || it.king == null || !W.GROW_SLOTS.includes(it.slot)) return 0;
    const g = this.growOf?.(it.slot);
    return g ? g.plus || 0 : 0;
  }
  effPlus(it) { return Math.max(it?.plus || 0, this.sharedPlus(it)); }
  // v253: 세트·왕의 장비가 공유 강화를 '제 강화'로 이어받는다. 전엔 성장 무기가 +5면 세트 무기를 +1~+5로
  //   강화해도 수치가 그대로였다(공유 +5가 이미 더 높아서) — 재료만 날아가 '강화가 안 먹는다'로 보였다.
  //   이제 세트 장비는 공유 수치에서부터 이어서 강화된다(비용·확률도 그 단계 것).
  // v258: 낀 것(과 지금 강화하는 것)만 — 가방 속 것까지 올리면 판매가가 공유 강화만큼 부풀고 '강화 안 된 것만 팔기'에서도 빠졌다
  adoptShared(extra = null) {
    let n = 0;
    for (const it of [...Object.values(this.s.equip), ...(extra ? [extra] : [])]) {
      const sp = this.sharedPlus(it);
      if (it && sp > (it.plus || 0)) { it.plus = sp; n++; }   // v254: 천장(epity)은 그대로 둔다
    }
    return n;
  }
  itemStats(it) {
    if (!it) return {};
    const b = W.itemBase(it.slot, it.ilv);
    // 조합 장비: 사다리 칸 × 등급(레어·유니크·전설·신화) · 왕의 장비(레벨 100): KING_MULT × 등급 · 옛 드랍 장비: 옛 등급
    const q = it.king != null ? G.KING_MULT * W.RARITY[it.rar || 0].mult * (it.set ? G.setOf(it.set)?.mult || 1 : 1)
      : it.step != null ? (it.grow ? W.growMult(it.ilv) : W.stepMult(it.step)) * W.RARITY[it.rar || 0].mult : W.GRADES[it.grade].mult;
    const ln = it.line ? LN.lineOf(it.line) : null;
    const m = q * W.enhanceMult(this.effPlus(it)) * (ln ? ln.mult : 1);
    // v393 초월 · v410 초월은 기본 수치(공격력·체력·방어)만 키운다 — % 능력치(치명 피해·공격력%…)까지 키우면 공격력 × 치명 피해가 제곱처럼 불었다(끝까지 올리면 중반의 30배)
    const tk = 1 + (it.tr || 0) * W.TRANS_STEP;
    const out = {};
    for (const [k, v] of Object.entries(b)) out[k] = v * m * (W.TRANS_FLAT.includes(k) ? tk : 1);
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
    for (const x of W.SLOTS) { const it = this.s.equip[x.id]; if (it?.set) out[it.set] = (out[it.set] || 0) + 1; }   // v375 대성신장은 여덟 부위
    return out;
  }
  // 켜진 세트 효과를 한데 모은다 — 능력치 키와 무공 키가 섞여 있다
  setBonus() {
    const sig = `${this.s.job}|${W.SLOTS.map((x) => this.s.equip[x.id]?.set || '-').join(',')}`;
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
    this.adoptShared();
    const s = this.s;
    const L = s.level;
    const cls = W.CLASSES[s.job] || {};
    const gear = { atk: 0, hp: 0, def: 0, crit: 0, atkPct: 0, speed: 0, hpPct: 0, regenPct: 0, skill: 0, critDmg: 0, exp: 0,
      dodge: 0, move: 0, bossDmg: 0, drain: 0, dmgRed: 0, cdr: 0, range: 0, thorns: 0, stunHit: 0, gold: 0, venom: 0, burn: 0, chill: 0, shock: 0 };
    const off = this._off || null;   // v449 힘의 내역 — 갈래 하나를 빼고 셈할 때만
    for (const it of off?.gear ? [] : Object.values(s.equip)) {
      const st = this.itemStats(it);
      for (const k of Object.keys(st)) gear[k] = (gear[k] || 0) + st[k];
      const u = this.itemUnique(it);                       // v130 고유 옵션
      if (u) gear[u.k] = (gear[u.k] || 0) + u.v;
    }
    // v270 증표 각인 능력치는 종류마다 끝이 있다 — 넘친 몫만 뺀다
    // v297 공명: 같은 기운 칸을 모으면 그 기운 능력치가 커진다(이 몫도 각인 끝 안에서) · 공격력·체력 덤은 끝과 따로
    if (!off?.gear) { const tot = IM.impFxTotals(s.equip); const rs = this.resonance();
      for (const [k, v] of Object.entries(rs.extra)) if (k !== 'resAtk' && k !== 'resHp') { gear[k] = (gear[k] || 0) + v; tot[k] = (tot[k] || 0) + v; }
      for (const [k, cap] of Object.entries(IM.IMP_STAT_CAP)) if ((tot[k] || 0) > cap) gear[k] -= tot[k] - cap;
      // 각인 배율 — 각인력(칸마다) + 공명 덤. 다른 % 몫(탑·고수·펫…)과 섞지 않고 따로 곱한다(넣은 만큼 그대로 보이게)
      gear.impMul = IM.impCoreTotal(s.equip) + (rs.extra.resAtk || 0); }
    // 세트 효과 중 능력치 (무공 쪽은 setBonus()를 그 자리에서 읽는다)
    if (!off?.gear) for (const [k, v] of Object.entries(this.setBonus())) if (k in gear) gear[k] += v;
    // 애완동물 버프 · 탈것(공격력·체력 %) · 십이지왕 신화
    gear.mat = 0;
    for (const p of off?.comp ? [] : this.activePets()) {
      const d = W.petOf(p.kind);
      gear[d.buff] = (gear[d.buff] || 0) + W.petBuff(p);
      for (const [k, v] of Object.entries(d.also || {})) gear[k] = (gear[k] || 0) + v * W.petBuffScale(p);   // 황룡: 둘 다 · v390 완만하게
    }
    const mt = off?.comp ? null : this.mountNow();
    const mk = this.mountK(this.mountInst());
    if (mt) { gear.atkPct += mt.stat * mk; gear.hpPct += mt.stat * mk; }
    // v359 극의 신수 전용 — 야천흑표 회피 · 혼원금룡 두목 피해·은자 (불길·서리·벼락·물결은 tickMountFx)
    if (mt?.fx === 'void') gear.dodge += 0.08;
    if (mt?.fx === 'gold') { gear.gold += 0.15; gear.bossDmg += 0.1; }
    // v292 도감 — 모은 종만큼 영구히
    const db = off?.comp ? 0 : this.compDexBonus();
    gear.atkPct += db; gear.hpPct += db;
    // 무한의 탑: 오른 층마다 영구히
    const tb = off?.murim ? 0 : D.towerBonus(s.tower?.floor) + D.hardBonus(s.tower?.hard) + D.corridorBonus(s.tower?.cor?.all);   // v350 극의 층도 · v403 회랑 기록도
    gear.atkPct += tb; gear.hpPct += tb;
    // v391 천마혼 — 5차 천마신공
    if (this.cheonmaOn()) for (const [k, v] of Object.entries(this.fifth().mods)) gear[k] = (gear[k] || 0) + v;
    // 고수 비무: 처음 이긴 고수마다 영구히 (v148)
    const mb = off?.murim ? 0 : this.masterBonus();
    gear.atkPct += mb; gear.hpPct += mb;
    // v377 천계의 가호 — 넘은 남천문 관문마다
    const gb = off?.murim ? 0 : this.gateBonus();
    gear.atkPct += gb; gear.hpPct += gb;
    // 현철 단련 (v274) · 숙련도·견문록 (v275)
    const tp = (off?.gear ? 0 : (s.temper || 0) * W.TEMPER_STEP) + (off?.murim ? 0 : this.huntBonus().total);   // 단련 = 장비 · 숙련·견문록 = 무림
    gear.atkPct += tp; gear.hpPct += tp;
    // 심법
    const pm = this.pmods();
    gear.atkPct += pm.atkPct || 0;
    gear.hpPct += pm.hpPct || 0;
    gear.critDmg += pm.critDmg || 0;
    // 직업의 길 (v237)
    const pa = PT.pathMods(s);
    for (const k of ['skill', 'cdr', 'speed', 'move', 'crit', 'critDmg', 'drain', 'dmgRed']) gear[k] += pa[k] || 0;
    gear.range += pa.range || 0;
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
    const tset = off?.comp ? { atk: 0, hp: 0 } : this.titleSet();   // v315 칭호 모음
    const tnow = off?.comp ? null : this.titleNow();
    const LB = W.baseLv(L);   // v447 수련은 레벨의 TRAIN_K만큼만
    const atk = (5 + LB * 3 + str * 3 + gear.atk) * (1 + gear.atkPct + str * 0.003 + (s.guildId && !off?.murim ? W.guildAtk(this.guildExp) : 0)) * (cls.atkK || 1) * (1 + (gear.impMul || 0)) * (tnow?.atkMul || 1) * (1 + tset.atk) * (this.cheonmaOn() ? this.fifth().atkMul : 1) * (1 + W.tierAtk(s.jobTier || 0));   // v391 천마혼 · v447 승급 공격력 · atkK: 직업 맞춤(v239) · v297 각인 배율 · v305 칭호
    const hp = (60 + LB * 25 + vit * 20 + gear.hp) * (1 + gear.hpPct + vit * 0.003) * (1 + (gear.impMul || 0)) * (1 + tset.hp) * (this.cheonmaOn() ? this.fifth().hpMul : 1) * (1 + W.tierHp(s.jobTier || 0));   // v442 전직·승급 체력   // v315 칭호 모음
    const st = {
      atk, hp,
      def: vit * 0.2 + gear.def,
      crit: Math.min(0.75, 0.05 + dex * 0.004 + gear.crit + (cls.crit || 0)),
      critDmg: W.CRIT_DMG + gear.critDmg + (cls.critDmg || 0),
      atkSec: W.BASE_ATK_SEC / ((1 + dex * 0.01 + gear.speed) * (cls.speed || 1) * (this.titleNow()?.spdMul || 1)),   // v322 칭호 공격 속도
      speed: (1 + dex * 0.01 + gear.speed) * (cls.speed || 1) * (this.titleNow()?.spdMul || 1),
      skillMult: 1 + int * 0.007 + gear.skill,
      // 자연 회복: 최대 체력의 0.6%/초 + 내공·레벨 몫 (물약만 바라보지 않게)
      regen: (1 + int * 0.12 + L * 0.08 + hp * (0.006 + gear.regenPct)) * (1 + (pm.regen || 0)),
      expMult: (1 + gear.exp + this.dexBonus()) * (this.titleNow()?.expMul || 1),   // v263 견문록 · v322 칭호 경험치
      goldMul: this.titleNow()?.goldMul || 1,   // v322 칭호 은자
      matMult: 1 + gear.mat,
      // v262: 스탯마다 다른 축 — 힘=두목 피해 · 민첩=걸음 · 체력=받는 피해 감소 · 내공=무공 숨(어디에 찍든 사냥만 같던 것)
      moveSpeed: 1 + (mt ? W.mountSpeed(mt, mk, this.mountInst()?.lv || 0) : 0) + (cls.move || 0) + (pm.move || 0) + gear.move + Math.min(W.STAT_ROLE.dexMoveMax, dex * W.STAT_ROLE.dexMove),
      boss: (cls.boss || 1) * (1 + gear.bossDmg) * (1 + Math.min(W.STAT_ROLE.strBossMax, str * W.STAT_ROLE.strBoss)),
      gold: gear.gold + (cls.goldUp || 0), dodge: Math.min(0.5, gear.dodge), drain: gear.drain, dmgRed: Math.min(0.5, gear.dmgRed + Math.min(W.STAT_ROLE.vitRedMax, vit * W.STAT_ROLE.vitRed)),
      cdr: Math.min(0.4, gear.cdr + Math.min(W.STAT_ROLE.intCdrMax, int * W.STAT_ROLE.intCdr)), skillRange: gear.range, thorns: gear.thorns, stunHit: Math.min(0.3, gear.stunHit),
      venom: Math.min(IM.IMP_CAP.venom, gear.venom), burn: Math.min(IM.IMP_CAP.burn, gear.burn), chill: Math.min(IM.IMP_CAP.chill, gear.chill), shock: Math.min(IM.IMP_CAP.shock, gear.shock),
      range: W.classOf(s.job)?.range || W.MELEE_RANGE,
      // 길(v237): 평타 피해 · 덧치기 · 둘레 · 달라붙기 · 독 · 무공 체력 소모
      basic: pa.basic || 0, extra: Math.min(0.75, pa.extra || 0), pcleave: pa.cleave || 0, dash: pa.dash > 0 ? Math.max(2, pa.dash) : 0,
      dotUp: pa.dot || 0, hpCostDown: Math.min(0.7, pa.hpCost || 0),
    };
    // 전투력(서열·비교용): 초당 피해 × 버티는 힘의 기하평균 — 보이는 숫자라 작게 둔다
    st.swingSec = W.swingSec(st.atkSec);   // v438 실제로 휘두르는 간격(느리게) — 한 대 피해는 swingSec/atkSec배라 초당 피해는 atkSec 그대로
    st.power = Math.round(Math.sqrt(st.atk / st.atkSec * (1 + st.crit * (st.critDmg - 1)) * st.hp));
    st.sig = this.statSig();
    this._stats = st;
    return st;
  }
  statSig() {
    const s = this.s;
    const e = s.equip;
    const g = (it) => (it ? `${it.uid}.${it.plus || 0}.${it.rar || 0}` : '-');
    const pets = this.activePets().map((p) => `${p.uid}.${p.lv}.${p.rar || 0}.${p.star || 0}.${p.q || 0}.${p.dan || 0}`).join(',') + `|d${Object.values(s.petDex || {}).reduce((a, v) => a + v + 1, 0)}.${Object.keys(s.mountDex || {}).length}|m${this.mountInst()?.lv || 0}`;
    return `${s.level}|${JSON.stringify(s.passLv || {})}|${s.guildId ? W.guildLevel(this.guildExp) : 0}|${s.job}|${s.stats.str},${s.stats.dex},${s.stats.vit},${s.stats.int}|${W.SLOTS.map((x) => g(e[x.id])).join(',')}|${pets}|${s.mount || '-'}|${s.tower?.floor || 0}.${s.tower?.hard || 0}|${s.path || '-'}|${s.jobTier || 0}|${this.growItems().map((x) => x.plus || 0).join('.')}|t${s.temper || 0}|i${this.impSig()}|T${s.title || ''}.${s.titles.length}|G${this.gatesCleared()}`;   // v243 · v274 단련: 가방 속 성장 장비 강화도(공유)
  }
  power() { return this.stats().power; }
  // v297 각인 서명 — 칸(증표·단·고유)이 바뀌면 능력치를 다시 센다
  impSig() {
    let o = '';
    for (const x of W.SLOTS) { const it = this.s.equip[x.id]; if (it?.imps) for (const e of it.imps) o += e ? (typeof e === 'string' ? e : `${e.k}${e.d || 1}${e.sp | 0}${e.sk}${e.g | 0}${e.s | 0}q${e.q | 0}${(e.gs || []).join('')}`) : '_'; o += ','; }
    return o;
  }
  resonance() {
    const sig = this.impSig();
    if (this._res?.sig === sig) return this._res.v;
    const v = IM.resonance(this.s.equip);
    this._res = { sig, v };
    return v;
  }

  // ---------- 지도 ----------
  // v146: 레벨과 상관없이 어디든 들어간다 — 센 곳에서 빨리 크고 싶은 사람을 막지 않는다.
  // 대신 화면에 '위험'을 띄우고(danger), 방치 중 거기서 쓰러지면 알맞은 사냥터로 물러난다(heroDied).
  canEnter(id) {
    if (!W.hasMap(id)) return false;
    // v238: 히든 두목(마귀)은 화무기를 쓰러뜨려야 길이 열린다
    const mm = W.mapOf(id).master ? MS.masterOf(W.mapOf(id).master) : null;
    if (mm?.hidden && !this.s.duel?.won?.hwamugi) return false;
    return true;
  }
  // 몹 레벨이 내 레벨보다 이만큼 위면 위험 (0 이하면 안전)
  danger(id) {
    const m = W.mapOf(id);
    return m.town ? 0 : m.lv[0] - this.s.level;
  }
  // v260: 알맞은 사냥터 따라가기 — 일반 구역에서 사냥 중이고 레벨이 구역보다 FOLLOW_GAP 넘게 높으면 safeMap으로.
  // 쓰러져 물러난 지 10분 안에는 다시 올리지 않는다(물러남과 따라가기가 서로 핑퐁하지 않게).
  followMap(force = false) {
    const s = this.s;
    if (!s.autoMap || !s.autoHunt || this.inst || !s.job) return false;
    const cur = W.mapOf(s.huntMap);
    if (!cur || cur.town || cur.bossRoom || cur.king || cur.master) return false;
    if (!force && this._retreatAt != null && this.clock - this._retreatAt < 600) return false;
    if (s.level - cur.lv[1] <= W.FOLLOW_GAP) return false;
    // 몹이 내 레벨을 넘지 않는 가장 높은 일반 구역 — safeMap(시작 레벨 기준)은 몹이 나보다 두셋 높은 곳까지 골랐다
    const to = this.fitMap(cur.id);
    if (to === s.huntMap || W.mapOf(to).lv[0] <= cur.lv[0]) return false;
    s.huntMap = to;
    if (this.map.id === cur.id) this.enterMap(to, true);
    this.emit('followMap', { name: W.mapOf(to).name });
    return true;
  }
  // v314 몹이 내 레벨을 넘지 않는 가장 높은 일반 구역 (from보다 낮은 곳은 고르지 않는다)
  fitMap(from = W.mapId(1, 1)) {
    let to = from;
    for (const m of W.MAPS) if (!m.town && !m.bossRoom && !m.king && !m.master && !m.inst && m.lv[1] <= this.s.level && m.lv[0] > W.mapOf(to).lv[0]) to = m.id;
    return to;
  }
  // v314 지금 사냥터가 낮아 경험치가 깎이고 있나 — { k: 배율(1 미만), to: 옮길 곳 } · 안 깎이면 null
  // 두목·고수·왕 구역·마을·던전은 보지 않는다(거기는 일부러 가는 곳)
  huntGap() {
    const m = this.map;
    if (!m || m.town || this.inst || m.bossRoom || m.king || m.master) return null;
    const k = this.levelGapMult(m.lv[1]);
    if (k >= 1) return null;
    const to = this.fitMap(m.id);
    return { k, to: to !== m.id ? to : null };
  }
  // v314 분당 경험치 — 이번 레벨의 몇 %를 1분에 버나(이 사냥터의 최근 5분 실제 벌이). 셀 수 없으면 null
  expPerMin() {
    if (this.map.town || this.inst) return null;
    // 이 사냥터에 온 뒤의 벌이만 — 옮긴 직후엔 앞 사냥터 벌이가 섞이거나 0에 가깝게 나왔다. 20초는 지나야 센다
    const now = this.wall || 0;   // v438 실제 시간
    const from = Math.max(this._mapAt ?? -Infinity, now - W.RATE_WINDOW_SEC);
    const span = now - from;
    if (!(span >= 20)) return null;
    let exp = 0;
    for (const r of this.ledger) if (r[0] >= Math.floor(from)) exp += r[2];
    if (!(exp > 0)) return null;
    return (exp / span) * 60 / this.expNeed() * 100;
  }
  // v314 두목 방에서 두목이 다시 나서기까지 — { left, total } 초 · 두목이 있거나 두목 방이 아니면 null
  bossWait() {
    const m = this.map;
    if (!m || m.town || this.inst || !m.bossRoom) return null;
    if (this.mons.some((x) => x.isBoss && x.alive)) return null;
    const total = this.coop?.hold ? W.BOSS_RESPAWN : this.bossRespawn();
    return { left: Math.max(0, Math.min(total, this.bossT)), total };
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
    this.fields = [];                    // v255: 장판(화골산·독룡출동)을 두고 가면 다음 사냥터 같은 자리에서 계속 터졌다
    this.dmgLog = []; this.dmgAcc = 0;   // v255: 던전·다른 사냥터의 피해 기록이 두목 체력 셈에 섞이지 않게
    // v432 던전에서 다른 데로 가면 그 판은 「나가기」로 끝낸다 — 전엔 조용히 버려 들어갈 때 체력이 안 돌아오고(탑 들락날락 = 공짜 회복),
    //   요일 던전 몫만 쓰이고, 칠대성 판의 아직 안 올린 피해가 사라졌다(instEnd가 없어서)
    //   v436 이긴 판이 「이어 오르기」로 다음 판을 열면 안 된다 — 탑을 깬 결과 창이 뜬 틈에 지도를 누르면 다음 층이 열린 채 사냥터로 넘어가 몹을 못 깔고 멈췄다(몽키 봇)
    if (this.inst) { this.inst.noChain = true; this.leaveInst(); }
    this.sceneKey = null;
    this._mapAt = this.wall || 0;        // v314 · v438 실제 시간 분당 경험치는 이 사냥터에 온 뒤의 벌이만
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
  // 과녁 곁 빈 칸으로 번쩍 (v237) — 무인 쪽에 가까운 칸부터
  dashTo(m) {
    const mt = this.mobTile(m);
    let best = null, bd = Infinity;
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      if (!dc && !dr) continue;
      const c = mt.c + dc, r = mt.r + dr;
      if (!this.inMap(c, r) || this.occupied(c, r, 'hero')) continue;
      const d = Math.hypot(c - this.hc, r - this.hr);
      if (d < bd) { bd = d; best = { c, r }; }
    }
    if (!best) return false;
    const from = { x: this.heroX, y: this.heroY };
    this.placeHero(best.c, best.r);
    this.walking = false;
    this.emit('dash', { from, to: { x: this.heroX, y: this.heroY } });
    return true;
  }
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
    const elite = !boss && !m.bossRoom && this.rng() < W.ELITE_RATE * (!this.inst && TD.bloodOn() ? TD.BLOOD_ELITE : 1);   // v262 혈겁
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
    // v271 두목 한 대는 같은 레벨 무인 체력(bossRefHp)의 BOSS_HIT_FRAC 이상 — 레벨 100 뒤로 무인 체력이 4~5배 커졌는데 두목은 그대로였다
    if (boss && !this.inst && lv >= W.BOSS_HARD_FROM) mob.atk = Math.max(mob.atk, D.bossRefHp(lv) * W.BOSS_HIT_FRAC_K(m));
    // 맹주·천마 (v148): 두목 방의 우두머리는 더 단단하고 아프다
    if (boss && m.lord) { mob.maxHp = mob.hp = mob.hp * W.LORD_HP; mob.atk *= W.LORD_ATK; }
    if (boss && MS.patternHpMult(m) !== 1) mob.maxHp = mob.hp = mob.hp * MS.patternHpMult(m);     // 초식 두목 (v170)
    // v241: 오버파워 — 무인이 그 레벨 기준보다 세면 두목이 그만큼 단단해진다(^0.6 · 최대 3배). 함께 사냥 왕·던전은 그대로
    const awkKey = boss && !this.inst ? W.awakenKeyOf(m) : null;
    const awk = awkKey && this.awakenActive(awkKey) ? W.AWAKEN[awkKey] : null;   // v407 각성 고수 · v409 검왕도
    if (awk) {
      mob.maxHp = mob.hp = mob.hp * awk.hp; mob.atk *= awk.atk; mob.awk = awkKey; mob.grade = 3;
      mob.name = awk.name; mob.def = { ...mob.def, name: awk.name };
    } else if (boss && !this.inst && !(this.s.kingParty && this.coop?.hold)) {   // v339 함께 잡는 두목은 서버 체력(내 전투력 보정 없음)
      const base = mob.hp;
      const k = this.overPower(mob.hp, m); if (k > 1) mob.maxHp = mob.hp = mob.hp * k; mob.op = k;
      if (lv >= W.BOSS_HARD_FROM) mob.calib = { base, sec: this.bossMinSec(m) * this.bossGapK(m) };   // v271 첫 몇 초 실제 피해로 다시 맞춘다(v272 레벨 30 두목부터)
    }
    // 요일 던전 몹은 같은 레벨 무인에 맞춰 단단하다 (v126)
    if (this.inst?.kind === 'daily') { const ok = D.dailyOverK(this.inst.stage || 1); mob.maxHp = mob.hp = D.dailyMobHp(lv) * (elite ? W.ELITE.hp : 1) * ok; mob.atk = D.dailyMobAtk(lv) * (elite ? W.ELITE.atk : 1) * ok; }   // v401 30단계 위로 단계마다 더 세게
    // 두목 등장 연출: 구역에 들어와 처음 나설 때는 길게(들판이 멈추고 두목은 맞지도 않는다),
    // 같은 구역에서 다시 날 때는 짧게(멈추지 않는다) — 30초마다 길게 멈추면 사냥이 끊긴다.
    const full = boss && !this.bossSeen;
    if (boss) this.bossSeen = true;
    if (full) { mob.introT = king ? W.KING_INTRO_SEC : W.BOSS_INTRO_SEC; this.freezeT = mob.introT; }
    if (boss) { mob.bornAt = this.clock + (mob.introT || 0); mob.tellHits = 0; }   // v262 비무 별(빠르게 · 안 맞고)
    this.mons.push(mob);
    if (boss) {
      this.emit('bossAppear', { name: kind.name, lv, full, zoneName: m.zoneName,
        king: king ? { no: king.no, title: king.title, real: king.real, hanja: king.hanja, skill: king.skill } : null, at: mob });
    }
    return mob;
  }

  // ---------- 한 틱 ----------
  // v438 게임 안 시간의 빠르기
  pace() { return W.PACE; }   // v443 칠대성도 같은 빠르기(탄막이 없어졌다)
  // 게임 안 초 → 실제 초(남은 시간·제한 시간 보이기)
  realSec(sec) { return sec / this.pace(); }
  tick(dt) {
    this.wall = (this.wall || 0) + dt;   // v438 실제 시간 — 벌이 장부(방치 보상)·분당 경험치는 이것으로
    dt *= this.pace();
    this.clock += dt;
    // v241: 지난 30초 실제 초당 피해 — 1초마다 한 칸
    this.dmgT = (this.dmgT || 0) + dt;
    if (this.dmgT >= 1) { this.dmgT -= 1; (this.dmgLog = this.dmgLog || []).push(this.dmgAcc || 0); this.dmgAcc = 0; if (this.dmgLog.length > 30) this.dmgLog.shift(); }
    if (this.inst?.done) this.finishInst();
    // 자동 도전 — 들판에 있는 동안 열린 요일 던전이 있으면 알아서 들어간다.
    // 매 틱 보면 비싸므로 몇 초에 한 번만 본다.
    if (this._followDue && !this.inst) { this._followDue = false; this.followMap(); }
    if ((this.s.autoEnh || this.s.autoInf) && !this.inst && (this._autoGearT = (this._autoGearT ?? 5) - dt) <= 0) { this._autoGearT = 5; this.autoGear(); }
    if ((this._titleT = (this._titleT ?? 3) - dt) <= 0) { this._titleT = 5; this.checkTitles(); }   // v307 자동 칭호
    if ((this.s.dgn.auto || this.s.dgn.routine) && !this.inst && !(this.s.dgn.pauseUntil > Date.now())) {   // v417 나가기를 누른 뒤 30분은 쉰다
      this.autoDgnT = (this.autoDgnT || 0) - dt;
      if (this.autoDgnT <= 0) { this.autoDgnT = AUTO_DGN_SEC; this.startRoutine(); }
    }
    const st = this.stats();
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.potionT = Math.max(0, this.potionT - dt);
    if (this.frenzyT > 0) this.frenzyT -= dt;
    if (this.reviveCd > 0) this.reviveCd -= dt;
    for (const k in this.buffs) if (this.buffs[k] > 0) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) { delete this.buffs[k]; delete this.buffv[k]; if (k === 'shield') this.shield = 0; } }
    // 회복
    const ev = this.envNow();
    // v271 두목과 싸우는 동안은 자연 회복을 줄인다 — 회복%가 쌓이면 초당 최대 체력의 3% 가까이 돌아와 두목이 깎지를 못했다(물약·흡혈은 그대로)
    const inBoss = (!this.inst && this.map.bossRoom && this.mons.some((m) => m.isBoss && m.alive && !(m.introT > 0) && m.lv >= W.BOSS_HARD_FROM)) || this.inst?.kind === 'wraid';   // v387 월드보스도 — 흡혈이 끝없이 들어 맞아도 안 쓰러졌다
    this._inBoss = inBoss;
    // 흡혈 몫 — 두목과 싸우는 동안은 초당 최대 체력의 BOSS_DRAIN_CAP까지만 (1초치까지 모아 둔다)
    this._drainLeft = inBoss ? Math.min(st.hp * W.BOSS_DRAIN_CAP, (this._drainLeft ?? 0) + st.hp * W.BOSS_DRAIN_CAP * dt) : Infinity;
    const regen = this.map.town ? st.hp * W.REST_HEAL : st.regen * Math.max(0, 1 + (ev.regen || 0)) * (inBoss ? W.BOSS_REGEN_K : 1);
    if (this.heroHp > 0) this.heroHp = Math.min(st.hp, this.heroHp + regen * dt);
    // 독 기운: 조금씩 체력이 빠진다 (그것만으로 쓰러지지는 않는다 — 10% 아래로는 안 깎는다)
    if (ev.drain && this.heroHp > st.hp * 0.1 && !this.map.town) this.heroHp = Math.max(st.hp * 0.1, this.heroHp - st.hp * ev.drain * dt);
    if (this.map.town) { this.tickTown(dt); return; }
    // 죽은 몹 치우고 다시 낸다
    this.mons = this.mons.filter((m) => m.alive);
    const thin = !this.inst && !this.map.bossRoom && this.mons.length < W.MOBS_ALIVE / 2 ? 2 : 1;
    for (const r of this.respawns) r.t -= dt * thin;
    const due = this.respawns.filter((r) => r.t <= 0).length;
    this.respawns = this.respawns.filter((r) => r.t > 0);
    for (let i = 0; i < due; i++) this.spawnMob(false);
    // 두목 구역: 두목이 없으면 BOSS_RESPAWN초 뒤에 다시 난다
    if (this.map.bossRoom && !this.mons.some((m) => m.isBoss && m.alive)) {
      this.bossT -= dt;
      // 함께 사냥(v138): 십이지왕 구역에서 문파원과 같은 방이면 두목은 서버의 것을 따른다(wcoop.js)
      if (this.coop?.hold) this.coop.bossTick();
      else if (this.bossT <= 0) { this.bossT = this.bossRespawn(); this.spawnMob(true); }
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
    // v254: 쓰러져 마을로 막 돌아온 틱엔(체력 1) 물약을 먹지 않는다 — 마을은 곧 다 채워 주는데 쓰러질 때마다 물약이 하나씩 줄었다
    this.tickPotion(st, this.map.town);
    if (this.s.elixir > 0 && !this.map.town) this.s.elixir = Math.max(0, this.s.elixir - dt);   // v262 영약은 사냥 중에만 닳는다
    this.tickImprint(dt, st);
    this.tickHero(dt, st);
    this.tickPets(dt, st);
    this.tickMountFx(dt, st);
  }
  // v359 극의 신수 전용 효과 — 탄 동안(마을 빼고)
  tickMountFx(dt, st) {
    const mt = this.mountNow();
    if (!mt?.hard || this.map?.town) return;
    const hx = this.heroX, hy = this.heroY;
    const near = (r) => this.mons.filter((m) => m.alive && !m.npc && !(m.introT > 0) && Math.hypot(m.x - hx, (m.y - hy) * 0.75) <= r);
    if (mt.fx === 'frost') for (const m of near(170)) m.slow = Math.max(m.slow || 0, 0.6);
    this._mfxT = (this._mfxT || 0) - dt;
    if (this._mfxT > 0) return;
    if (mt.fx === 'flame') { this._mfxT = 1; const ms = near(110); for (const m of ms) this.hurt(m, st.atk * 0.35, 'mount', false, ms.length > 3); if (ms.length) this.emit('mountFx', { fx: 'flame', at: { x: hx, y: hy } }); }
    else if (mt.fx === 'thunder') { this._mfxT = 2.2; const m = near(380).sort((a, b) => b.hp - a.hp)[0]; if (m) { this.emit('mountFx', { fx: 'thunder', at: { x: m.x, y: m.y } }); this.hurt(m, st.atk * 2.2, 'mount', false); } }
    else if (mt.fx === 'frost') { this._mfxT = 1.5; if (near(170).length) this.emit('mountFx', { fx: 'frost', at: { x: hx, y: hy } }); }
    else if (mt.fx === 'tide') { this._mfxT = 1; if (this.heroHp > 0 && this.heroHp < st.hp) { this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.015); this.emit('mountFx', { fx: 'tide', at: { x: hx, y: hy } }); } }
    else this._mfxT = 5;
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
        // v261: 독 피해를 1초에 한 번 모아 보여 준다 — 과녁과 두목만(졸개 수십에 다 띄우면 숫자로 덮인다)
        m.dotAcc = (m.dotAcc || 0) + d;
        if ((m.dotShowT = (m.dotShowT ?? 1) - dt) <= 0) {
          m.dotShowT = 1;
          if ((m.isBoss || m === this.mon) && m.dotAcc >= 1) this.emit('dotTick', { amount: m.dotAcc, at: m });
          m.dotAcc = 0;
        }
        if (!m.alive) continue;
      } else m.poison = 0;
      if (m.introT > 0) { m.introT -= dt; continue; }
      if (m.wb) continue;   // v374 마왕은 움직이지도 때리지도 않는다 — v443 강타(tickInst)로만
      if (m.treasure) { this.tickTreasure(m, dt); continue; }
      if (m.pvp) {   // v451 대결 상대 — 기절은 빨리 풀리고, 풀린 뒤 잠깐은 다시 안 걸린다
        if (m.stun > 0 && m.stunImm > this.clock) m.stun = 0;
        else if (m.stun > 0) m._stunned = true;
        else if (m._stunned) { m._stunned = false; m.stunImm = this.clock + PV.PVP_STUN_IMM; }
      }
      if (m.stun > 0) { m.stun -= dt * (m.pvp ? PV.PVP_STUN : 1); continue; }
      if (m.slow > 0) m.slow -= dt;
      const spd = W.MOB_SPEED * (m.slow > 0 ? 0.45 : 1) * (m.pvp ? 1.1 : m.isBoss ? 0.8 : 1);   // v451 대결 상대는 무인처럼 빠르게
      // 칸 사이를 옮겨 가는 중이면 마저 간다
      if (m.move) {
        if (this.slide(m, 'x', 'y', m.move, spd * (m.aggro ? 1 : 0.6), dt)) { m.c = m.move.c; m.r = m.move.r; m.move = null; }
        continue;
      }
      const ht = this.heroTile();
      const dist = this.tileDist(m, ht);
      // v439 바람식: 사냥터 졸개는 맞기 전엔 덤비지 않는다(정예·두목·던전 몹은 다가온다)
      const fierce = !W.PASSIVE_MOBS || this.inst || m.isBoss || m.elite || this.map.bossRoom;
      if ((fierce && dist < W.MOB_AGGRO) || m.aggro) m.aggro = dist < W.MOB_AGGRO * 2;
      if (m.pvp) m.aggro = true;   // v451 대결 상대는 어디서든 쫓아온다
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
            if (this._invulnUntil > this.clock) continue;      // 증표 고유 · 불사 뒤 무적 (v167)
            const ps = this.passives();
            if (ps.has('dodge') && this.rng() < 0.25) { this.emit('passive', { id: 'dodge' }); continue; }   // 환왕
            const cls = W.CLASSES[this.s.job] || {};
            const pm = this.pmods();
            if (this.buffv.dodge && this.rng() < this.buffv.dodge) { this.emit('passive', { id: 'dodge' }); continue; }   // 유운보
            const env = this.envNow();
            if (env.dodge && this.rng() < env.dodge) { this.emit('passive', { id: 'dodge' }); continue; }                // 운무
            if (st.dodge && this.rng() < st.dodge) { this.emit('passive', { id: 'dodge' }); continue; }                  // 장비 회피 (v130)
            if (cls.fear && this.rng() < Math.min(m.pvp ? PV.PVP_FEAR_MAX : 9, cls.fear + (pm.fearUp || 0) + (this.buffv.fear || 0))) {   // v451 대결은 공포 상한                                     // 극악소마: 공포
              this.emit('passive', { id: 'fear', at: m });
              const sbf = this.setBonus();
              if (sbf.fearVuln && !(m.vulnT > this.clock && m.vulnV > sbf.fearVuln)) { m.vulnT = this.clock + 3; m.vulnV = sbf.fearVuln; }   // 귀혼소음 3
              if (sbf.maskAlways && this.s.job === 'ring') this.strike(m, st, sbf.maskAlways, 'mask');              // 귀혼소음 5
              else if (pm.own5 && this.s.job === 'ring') this.strike(m, st, 1.5, 'mask');                       // 무면귀 5: 가면의 일격
              continue;
            }
            const red = (1 - (cls.dmgRed || 0)) * (1 - (this.buffv.guard || 0)) * (1 - Math.min(0.6, pm.dmgRed || 0)) * (1 - (st.dmgRed || 0));
            const weak = cls.venomWeak && m.poison > 0 ? 1 - cls.venomWeak : 1;   // v448 독마: 중독된 적은 힘이 빠진다
            const dmg = m.pvp ? st.hp * PV.PVP_BASIC * this.inst.rDmg * PV.takeK(this.s.job) * (0.9 + this.rng() * 0.2) * Math.max(PV.PVP_RED_MIN, red) * weak   // v451 대결 — 내 체력의 몫(방어 대신 받는 피해 감소, 50%까지)
              : Math.max(1, m.atk * (1 + (env.mobAtk || 0)) * (0.9 + this.rng() * 0.2) * red * this.gapIn(m) * weak - st.def);
            let left = dmg;
            if (this.shield > 0 && this.buffs.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; }   // 금종조
            this.heroHp -= left;
            this.emit('heroHit', { amount: left, shielded: dmg - left, boss: !!m.isBoss, from: { x: m.x, y: m.y } });   // v217: 두목이 친 것은 그림이 다르다
            if (ps.has('reflect')) this.hurt(m, dmg * 0.4, 'reflect', false);                                 // 철왕
            { const isp = this.impSpecials();                                                                  // 증표 고유 (v163)
              if (isp.mirror && m.alive) { this.hurt(m, st.atk * Math.min(5, 1.5 * isp.mirror.p) * (m.isBoss ? st.boss : 1), 'reflect', false); this.impShow(isp.mirror, m); }
              if (isp.frenzy && this.rng() < Math.min(0.6, 0.12 * isp.frenzy.p)) { this.buffs.gale = Math.max(this.buffs.gale || 0, 4); this.buffs.haste = Math.max(this.buffs.haste || 0, 4); this.buffv.haste = Math.max(this.buffv.haste || 0, 0.4);   /* v254: 값(haste)의 타이머도 — 전엔 gale만 걸어 +40%가 영원히 남았다 */ this._frenzyUntil = this.clock + 4; this.impShow(isp.frenzy, null); } }
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

  tickPotion(st, noDrink = false) {
    // 자동 보충 — 사냥터에서도 상인이 따라다니는 셈 (방치 사냥이 물약 때문에 멈추지 않게)
    if (this.s.autoRefill && this.s.potions < 10) {
      const n = Math.min(50 - this.s.potions, Math.floor(this.s.gold / this.potionPrice()));
      if (n > 0) this.buyPotions(n);
    }
    if (noDrink || !this.s.autoPotion || this.potionT > 0 || this.s.potions <= 0) return;
    if (D.TOWER_NO_POTION && this.inst?.kind === 'tower') return;
    if (this.inst?.kind === 'pvp') return;   // v451 대결은 물약 없이
    if (this.heroHp < st.hp * this.potionAt()) this.drinkPotion();
  }
  drinkPotion() {
    if (D.TOWER_NO_POTION && this.inst?.kind === 'tower') return false;
    if (this.inst?.kind === 'pvp') return false;   // v451
    const st = this.stats();
    if (this.s.potions <= 0 || this.heroHp >= st.hp) return false;
    this.s.potions--;
    this.potionT = W.POTION_GAP * (this.inst?.kind === 'wraid' ? D.WB_TIER[D.wbTierOf(this.map?.wb)].pot : 1);   // v387 월드보스는 물약 숨이 길다
    this.heroHp = Math.min(st.hp, this.heroHp + st.hp * W.POTION_HEAL);
    this.note(0, 0, 0, 1);
    this.emit('potion', { left: this.s.potions });
    return true;
  }

  tickHero(dt, st) {
    // v296: 평타 쿨은 걷는 동안에도 흐른다 — 다 걸어와서 다시 한 박자 쉬고 치던 후딜레이를 없앤다(쌓이지는 않는다)
    this.atkTimer = Math.max(0, this.atkTimer - dt);
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
      this.manualHold = W.MANUAL_HOLD;   // v305: 0.8 → 0.3
      this.moveSkills(st);
      return;
    }
    // 손으로 찍은 칸이 있으면 거기로 먼저 간다
    if (this.manual) {
      if (this.hc === this.manual.c && this.hr === this.manual.r) { this.manual = null; this.manualHold = W.MANUAL_HOLD; } else {   // v305: 1.2 → 0.3
        if (!this.stepHero(this.manual.c, this.manual.r)) { this.manual = null; this.manualHold = W.MANUAL_HOLD; }
        this.moveSkills(st);
        return;
      }
    }
    // v303: 손으로 움직인 직후(manualHold)에는 과녁을 쫓아가지만 않을 뿐, 닿는 적은 바로 친다 — 전엔 0.6~1.2초를 그냥 서 있었다(후딜)
    if (this.manualHold > 0) { this.manualHold -= dt; this.holdApproach = true; }
    if (this.inst?.kind === 'pvp' && !this.autoDodge) this.holdApproach = true;   // v451 대결은 직접 — 다가가지 않고 닿으면 평타만(무공은 단추로)
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
    // v426 사거리 안에 서 있을 때만 과녁 쪽으로 돈다 — 걷는 중엔 걷는 방향 그대로(전엔 칸마다 과녁 쪽으로 홱 돌아 무공을 쓰고 다시 걷는 쪽으로 돌았다)
    if (dist <= st.range && Math.abs(m.x - this.heroX) > 6) this.heroFacing = m.x >= this.heroX ? 1 : -1;
    if (this.s.autoSkill && (this.inst?.kind !== 'pvp' || this.autoDodge)) this.autoSkills(st);   // v451 대결은 무공도 손으로(시뮬 봇만 자동)
    if (!this.mon?.alive) return;
    if (dist > st.range) {
      if ((!this.huntOn() && !m.aggro) || this.holdApproach) { this.walking = false; return; }
      // 길(v237) 전광석화 — 멀리 있는 과녁 곁으로 번쩍 달라붙는다
      if (st.dash && dist > st.range + W.TILE && dist < W.TILE * 9 && !(this.dashAt > this.clock) && this.dashTo(m)) { this.dashAt = this.clock + st.dash; return; }
      // 칠 수 있는 빈 칸(사거리 안)까지 길을 찾는다. 길이 없으면 이 과녁은 잠깐 두고 다른 몹을 잡는다.
      const f = this.findStep(this.hc, this.hr, (c, r) => this.tileDist({ c, r }, this.mobTile(m)) <= st.range, 'hero');
      if (!f || f === 'here' || !this.stepTo(f)) { this.walking = false; this.giveUp(m); }
      return;
    }
    this.walking = false;
    if (this.atkTimer <= 0) {
      const iv = st.swingSec / (this.frenzyT > 0 ? 1.5 : 1) / (1 + (this.buffv.haste || 0)) / Math.max(0.3, 1 + (this.envNow().speed || 0));
      this.atkTimer = iv;
      this._swingK = st.swingSec / st.atkSec;   // v438 느리게 휘두른 만큼 한 대를 세게
      // v304: 잡은 직후(KILL_RECOVER)라 제 박자보다 빨리 나간 평타는 초당 피해 기록(dmgAcc)에 넣지 않는다 —
      //   잔챙이를 초에 셋씩 잡는 속도로 두목 최소 싸움 시간을 재면 두목·고수 체력이 서너 배로 부풀어 비무가 막혔다
      this._quickAtk = this.clock - (this._atkAt ?? -99) < iv * 0.95;
      this._atkAt = this.clock;
      this.basicAttack(m, st, dist);
      this._quickAtk = false;
      this._swingK = 1;
    }
  }

  // v157: 걸으면서도 무공을 펼친다 — 자동 무공이면 움직이는 동안에도 닿는 적에게 (평타는 서야 친다).
  // 과녁이 없으면(조이스틱으로 끌고 다닐 때) 가장 가까운 적을 잡는다.
  moveSkills(st) {
    if (!this.s.autoSkill || this.map.town || !this.mons.length || (this.inst?.kind === 'pvp' && !this.autoDodge)) return;
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
    this.emit('attack', { close, to: { x: m.x, y: m.y } });   // v244: 과녁 자리 — 한 방에 죽어 mon이 지워져도 연출이 과녁을 안다
    // v378 칠십이변(대성신장 7) — 평타 여섯 번마다 손오공의 분신이 함께 친다(×300%)
    if (this.setBonus().wukong && m.alive && (this._wkN = (this._wkN || 0) + 1) % 6 === 0) { this.emit('wukongClone', { at: { x: m.x, y: m.y }, from: { x: this.heroX, y: this.heroY } }); this.strike(m, st, 3, 'clone'); if (!m.alive) return; }
    let mult = (this._swingK || 1) * W.BASIC_K;   // v438 느린 평타는 한 대를 세게 · v439 평타 몫은 줄이고 무공을 키운다
    if (this.s.job === 'ring' && close) mult *= 1.2;
    const cls0 = W.CLASSES[this.s.job] || {};
    const pm = this.pmods();
    // 권마: 평타가 곧 무공 — 레벨만큼 + 투신심법
    if (cls0.basicPerLv) mult *= (cls0.basicBase ?? 1) + cls0.basicPerLv * this.s.level + (pm.basicUp || 0);
    const ps = this.passives();
    // 권왕: 세 번째마다 ×3
    if (ps.has('combo') && (this.comboN = (this.comboN || 0) + 1) % 3 === 0) { mult *= 3; this.emit('passive', { id: 'combo', at: m }); }
    const tx = m.x, ty = m.y;
    if (st.basic) mult *= Math.max(0.2, 1 + st.basic);      // 길(v237): 평타의 길 + · 무공의 길 -
    this.strike(m, st, mult, 'hit');
    if (st.extra && m.alive && this.rng() < st.extra) { this.strike(m, st, mult * 0.85, 'hit'); this.emit('passive', { id: 'extra', at: m }); }   // 덧치기 (85%)
    // 투신강림: 한 번에 세 대
    const sb = this.setBonus();
    for (let k = 0; k < (this.buffv.triple ? this.buffv.triple + (sb.tripleUp || 0) : 0) && m.alive; k++) this.strike(m, st, mult * 0.5, 'hit');   // 덧 두 대는 절반
    const cls = this.cheonmaOn() && this.fifth().flower ? { ...W.CLASSES[this.s.job], flower: this.fifth().flower } : W.CLASSES[this.s.job] || {};   // v391 천마검강
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
    const cleave = Math.max(this.buffv.cleave || 0, sb.cleaveAlways || 0, st.pcleave || 0);    // 철권투혼 5: 늘 · 길(v237)
    if (cleave) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - this.heroX, (o.y - this.heroY) * 0.75) <= 150) this.strike(o, st, mult * cleave, 'cleave');
    }
    // 검왕: 평타가 둘레 모든 적을 벤다
    if (ps.has('formless')) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= 120) this.strike(o, st, mult * 0.7, 'cleave');
    }
    // v303 과녁이 쓰러졌으면 쿨을 짧게 — 다음 몹으로 걸어가서 또 기다리지 않게(붙어 있는 몹을 연달아 베는 속도는 KILL_RECOVER가 막는다)
    if (!m.alive) this.atkTimer = Math.min(this.atkTimer, W.KILL_RECOVER);
  }

  strike(m, st, mult, kind, extraCrit = 0, quiet = false) {
    const crit = this.rng() < st.crit + extraCrit + (this.envNow().crit || 0);
    let dmg = st.atk * mult * (crit ? st.critDmg : 1) * (0.92 + this.rng() * 0.16);
    if (m.isBoss) dmg *= st.boss;
    if (m.vulnT > this.clock) dmg *= 1 + m.vulnV;              // 섭혼: 받는 피해 +
    if (this.buffv.might) dmg *= 1 + this.buffv.might;          // 삼공조화
    if (this.buffv.petMight) dmg *= 1 + this.buffv.petMight;    // v365 황룡진
    if (this.buffv.cmSoul && this.buffs.cmSoul > 0) dmg *= 1 + this.buffv.cmSoul;   // v391 천마혼 발현
    if (crit && this.buffv.critUp) dmg *= 1 + this.buffv.critUp / st.critDmg;   // 무면개방
    const ps = this.passives();
    if (ps.size) {
      if (ps.has('bossbane') && m.isBoss) dmg *= 1.5;                       // 투왕
      if (ps.has('execute') && m.hp < m.maxHp * 0.4) dmg *= 1.6;           // 암왕
    }
    const isp = this.impSpecials();
    if (isp.execute && m.hp < m.maxHp * 0.3) dmg *= 1 + Math.min(1.5, 0.25 * isp.execute.p);
    if (isp.bane && m.isBoss) dmg *= 1 + Math.min(0.8, 0.12 * isp.bane.p);
    if (isp.berserk && this.heroHp < st.hp * 0.5) dmg *= 1 + Math.min(1, 0.2 * isp.berserk.p);
    if (isp.surge && this._surgeUntil > this.clock) dmg *= 1 + Math.min(0.6, 0.15 * isp.surge.p);
    if (isp.frenzy && this._frenzyUntil > this.clock) dmg *= 1.15;
    dmg = Math.max(1, (dmg - m.armor) * this.gapOut(m));
    const mx = m.x, my = m.y;
    const wasAlive = m.alive;
    this.hurt(m, dmg, kind, crit, quiet);
    this.impOnHit(m, st, dmg, kind, crit, wasAlive, isp);
    if (ps.size) {
      if (ps.has('drain')) this.drainHeal(st, dmg * 0.04);     // 혈왕
      if (ps.has('stun') && /^s\d$/.test(kind) && m.alive) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.75 : 1.5);   // 음왕
      if (ps.has('petal') && crit && kind !== 'petal') {                     // 화왕
        for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - mx, (o.y - my) * 0.75) <= 130) this.hurt(o, dmg * 0.6, 'petal', false);
      }
    }
    const cls = W.CLASSES[this.s.job] || {};
    if (m.alive && (cls.slow || (this.cheonmaOn() && this.fifth().slow))) m.slow = 2.5;   // v398 독존 — 중독된 적은 굼떠진다
    const pm = this.pmods();
    if (m.alive && cls.vuln) {
      const vv = cls.vuln + (pm.vulnUp || 0);
      if (pm.own5 && m.vulnT > this.clock && this.rng() < 0.1) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.4 : 1);   // 섭혼대법 5
      if (!(m.vulnT > this.clock && m.vulnV > vv)) { m.vulnT = this.clock + 3; m.vulnV = vv; }
    }
    if (cls.drain) this.drainHeal(st, dmg * (cls.drain + (pm.drainUp || 0)));
    if (st.drain) this.drainHeal(st, dmg * st.drain);                     // v130 피해 흡수
    if (st.stunHit && m.alive && this.rng() < st.stunHit) m.stun = Math.max(m.stun || 0, m.isBoss ? 0.3 : 0.8);
    if (m.alive && cls.poison && kind !== 'poison') this.addDot(m, dmg * (cls.poison + (pm.poisonUp || 0)), cls.poisonSec || 3);
    return dmg;
  }
  // ---------- 증표 각인 (v163) ----------
  // 끼고 있는 장비의 고유 효과 — { kind: { p, id, name, kind, col } } (p = 새겨진 칸들의 무게 합)
  impSpecials() {
    const sig = this.statSig();
    if (this._isp?.sig === sig) return this._isp.v;
    // v270: 위력은 가장 무거운 칸 + 하나 더할 때마다 0.3 (끝 SPECIAL_P_MAX) — 전엔 칸 무게를 다 더해 끝이 없었다
    const v = {}, ws = {};
    for (const it of Object.values(this.s.equip)) for (const im of IM.imprintsOf(it)) {
      const sp = im.special;
      if (!sp) continue;
      (ws[sp.kind] || (ws[sp.kind] = [])).push(im.wp);          // v297 단이 깊을수록 무겁다
      const cur = v[sp.kind];
      if (!cur || im.wp > cur.w0) v[sp.kind] = { ...sp, w0: im.wp, col: IM.THEMES[im.theme].col };
    }
    for (const [k, o] of Object.entries(v)) o.p = IM.specialP(ws[k]);
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
    if (isp.echo && m.alive && this.rng() < Math.min(0.6, 0.1 * isp.echo.p)) { this.hurt(m, dmg * 2, 'imp', crit); this.impShow(isp.echo, m); }
    if (isp.chain && crit) {
      let n = 0;
      for (const o of this.mons) {
        if (n >= 2) break;
        if (!o.alive || o.npc || o === m || Math.hypot(o.x - m.x, o.y - m.y) > 240) continue;
        this.hurt(o, dmg * Math.min(1, 0.25 * isp.chain.p), 'imp', false, true);
        this.emit('tfHit', { tf: 'thunder', at: { x: m.x, y: m.y }, to: { x: o.x, y: o.y } });
        n++;
      }
      if (n) this.impShow(isp.chain, m);
    }
    if (isp.reap && wasAlive && !m.alive) this.heroHp = Math.min(st.hp, this.heroHp + st.hp * Math.min(0.2, 0.045 * isp.reap.p));   // v444 3 → 4.5% (끝 15 → 20%) — 체력이 탄약(v441)이라 처치 회복이 더 값지다
    if (isp.bleed && m.alive) this.addDot(m, dmg * Math.min(0.8, 0.12 * isp.bleed.p), 4);
  }
  // v271 피해 흡수 — 무인 피해가 커질수록 끝없이 늘어 두목이 체력을 못 깎았다(Lv100 왕이 80초 싸움에 7%). 두목 싸움 중엔 몫만큼만
  drainHeal(st, amt) {
    if (!(amt > 0)) return;
    const left = this._drainLeft ?? Infinity;
    const a = Math.min(amt, left);
    if (left !== Infinity) this._drainLeft = left - a;
    this.heroHp = Math.min(st.hp, this.heroHp + a);
  }
  nearOther(m, r) {
    let best = null, bd = r;
    for (const o of this.mons) { if (!o.alive || o.npc || o === m) continue; const d = Math.hypot(o.x - m.x, o.y - m.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  // 때를 두고 터지는 고유 효과 — 둘레 폭발 · 쏟아짐 · 보호막
  tickImprint(dt, st) {
    const isp = this.impSpecials();
    if (!isp.nova && !isp.rain && !isp.guard && !isp.stunwave && !isp.vigor) return;
    if (this.map.town || !this.mons.some((m) => m.alive && !m.npc)) return;
    const T = this._impTimers || (this._impTimers = { nova: 2, rain: 3, guard: 0, stun: 3 });
    if (T.stun == null) T.stun = 3;
    if (isp.vigor && this.mon?.alive) this.heroHp = Math.min(st.hp, this.heroHp + st.hp * Math.min(0.05, 0.012 * isp.vigor.p) * dt);
    if (isp.stunwave && (T.stun -= dt) <= 0) {
      T.stun = Math.max(4, Math.round(8 - 1.5 * isp.stunwave.p));
      const hit = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) <= 230);
      if (hit.length) {
        for (const m of hit) { m.stun = Math.max(m.stun || 0, m.isBoss ? 0.6 : 2); this.hurt(m, st.atk * 1.5 * isp.stunwave.p * (m.isBoss ? st.boss : 1), 'imp', false, true); }
        this._impT = 0; this.impShow(isp.stunwave, null); this.emit('impNova', { r: 230, col: isp.stunwave.col });
      } else T.stun = 0.5;
    }
    if (isp.nova && (T.nova -= dt) <= 0) {
      T.nova = Math.max(4, 10 - Math.round(2 * isp.nova.p));
      const hit = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) <= 230);
      if (hit.length) { for (const m of hit) this.hurt(m, st.atk * 2.6 * isp.nova.p * (m.isBoss ? st.boss : 1), 'imp', false, true); this._impT = 0; this.impShow(isp.nova, null); this.emit('impNova', { r: 230, col: isp.nova.col }); }
      else T.nova = 0.5;
    }
    if (isp.rain && (T.rain -= dt) <= 0) {
      T.rain = Math.max(5, 11 - Math.round(2 * isp.rain.p));
      const near = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, m.y - this.heroY) <= 420).slice(0, 5);
      if (near.length) { for (const m of near) { this.hurt(m, st.atk * 2.2 * isp.rain.p * (m.isBoss ? st.boss : 1), 'imp', false, true); this.emit('impRain', { at: { x: m.x, y: m.y }, col: isp.rain.col }); } this._impT = 0; this.impShow(isp.rain, null); }
      else T.rain = 0.5;
    }
    if (isp.guard && (T.guard -= dt) <= 0) {
      T.guard = 8;
      this.shield = Math.max(this.shield || 0, st.hp * Math.min(0.4, 0.1 * isp.guard.p));
      this.buffs.shield = Math.max(this.buffs.shield || 0, 8);
      this._impT = 0; this.impShow(isp.guard, null);
    }
  }

  // 독·출혈: total만큼을 웅덩이에 붓는다 — 쌓인다(빠르기는 마지막에 부은 sec쯤)
  addDot(m, total, sec) {
    const sb = this.setBonus();
    total *= (1 + (sb.dotUp || 0) + (this.stats().dotUp || 0)) * (sb.bossDot && m.isBoss ? 2 : 1);     // 암천독야 · 길(v237)
    if (m.isBoss && (m.lv || 0) >= W.BOSS_HARD_FROM) total *= (this.cheonmaOn() && this.fifth().bossDot) || W.BOSS_DOT_K;   // v398 독존은 두목에게도 독이 깊이   // v278 두목은 지속 피해를 덜 받는다(레벨 30 두목부터 — 초반 독마는 독으로 두목을 잡는다)
    m.dot = (m.dot || 0) + total;
    m.dotTau = sec / 2;
    m.poison = sec;
  }

  hurt(m, dmg, kind, crit, quiet = false) {
    if (!m.alive || m.introT > 0) return;
    // 함께 잡는 왕: 친 만큼 모아 서버에 올리고, 쓰러뜨리는 건 서버가 정한다(내 화면에서 먼저 죽지 않는다)
    if (m.coopSeq != null && this.coop?.on && this.coop.stale?.() && m.hp <= 1) { this.coop.gaveUp?.(m.coopSeq); m.coopSeq = null; }   // v415 서버가 끊겼다 — 내 화면에서 마저 잡는다 · v420 같은 왕을 다시 세우지 않게
    if (m.coopSeq != null && this.coop?.on) {
      const d = Math.min(dmg, Math.max(0, m.hp - 1));
      this.coop.dealt(m, Math.min(dmg, this.coop.serverLeft ? this.coop.serverLeft(m) : m.hp));   // v415 서버에 남은 만큼(전엔 내 화면 체력까지만 — 1에 멈추면 한 대에 1씩만 보내 안 죽었다)
      m.hp -= d;
      m.aggro = true;
      if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
      return;
    }
    if (m.calib) this.bossCalib(m, dmg);
    if (m.wb && this.inst?.kind === 'wraid') this.inst.myDealt = (this.inst.myDealt || 0) + Math.min(dmg, Math.max(0, m.hp));   // v374 내가 준 몫(서버에 올린다) · v443 집중·근접 배수 없음(탄막이 없어졌다)
    m.hp -= dmg;
    m.aggro = true;
    // v241: 실제 준 피해(넘친 몫은 빼고) — 두목 최소 싸움 길이 잣대
    // v255: 과녁(this.mon)에 준 것만 — 광역 합을 세면 독마·검사는 한 몸에 주는 피해의 5~7배로 잡혀 두목이 몇 분짜리가 됐다
    if (m === this.mon && !this._quickAtk) this.dmgAcc = (this.dmgAcc || 0) + Math.min(dmg, Math.max(0, m.hp + dmg));
    if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
    if (m.hp <= 0) { m.over = Math.max(0, -m.hp) / (m.maxHp || 1); this.killMob(m); }   // v261 넘친 피해(그리는 쪽이 날아가는 거리에 쓴다)
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
    const ek = this.s.elixir > 0 ? 1 + W.ELIXIR_BONUS : 1;   // v262 영약
    // v261 처치 포화 — 최근 30초 처치로 분당 처치를 잰다(사냥터만)
    let sat = 1;
    if (!this.inst) {
      const kt = this._killT || (this._killT = []);
      kt.push(this.clock);
      while (kt.length && kt[0] < this.clock - 30) kt.shift();
      sat = W.expSat(kt.length * 2);
    }
    const ck = m.isBoss && this.coopK ? this.coopK : 1;   // v343 함께 잡은 두목 — 인원만큼 더
    const pk = W.PACE_REWARD * (W.PASSIVE_MOBS ? W.PASSIVE_REWARD : 1);   // v438 · v439 먼저 안 덤비는 졸개 몫 느려진 만큼 한 마리 벌이를 더(실제 한 시간 벌이는 그대로)
    const exp = W.mobExp(m.lv) * (m.isBoss ? W.BOSS.exp * (W.CLASSES[this.s.job]?.bossExp || 1) : m.elite ? W.ELITE.exp : 1) * this.levelGapMult(m.lv) * this.challengeMult(m.lv) * (st.expMult || 1) * (1 + (env.exp || 0) + mlv * L.MASTERY.exp) * ek * sat * ck * pk;   // v425 도전 경험치
    const blood = !this.inst && TD.bloodOn() ? 1 + TD.BLOOD_BONUS : 1;   // v262 혈겁
    const gold = Math.round(pk * W.mobGold(m.lv) * (m.isBoss ? W.BOSS.gold : m.elite ? W.ELITE.gold : 1) * (1 + (env.gold || 0) + (st.gold || 0)) * ek * blood * (st.goldMul || 1) * ck);   // v322 칭호
    if (!this.inst) {
      // v263 견문록 — 졸개 종마다 센다(낙관이 찍히는 순간 지역이 다 찼는지 본다)
      if (!m.isBoss && m.name) {
        const dx = this.s.dex || (this.s.dex = {});
        const n = (dx[m.name] || 0) + 1;
        if (n <= 9999) dx[m.name] = n;
        if (n === W.DEX_NEED) { this._dexZ = null; this._huntB = null; this._stats = null; this.emit('dexStamp', { name: m.name, zoneDone: this.dexZoneDone(this.map.zone) }); }
      }
      this.tday('kill'); if (m.elite) this.tday('elite'); if (m.isBoss) this.tday('boss');
      if (!m.isBoss && this.rng() < W.PET_SHARD_RATE * (m.elite ? 3 : 1) * this.lootK() * pk) this.s.petShard = (this.s.petShard || 0) + 1;   // v262 포획 조각
      if (!m.isBoss && this.rng() < W.MOUNT_SHARD_RATE * (m.elite ? 3 : 1) * this.lootK() * pk) this.s.mountShard = (this.s.mountShard || 0) + 1;   // v292 탈것 조각
      if (m.isBoss) this.bossShards(m);   // v292 두목은 조각 한 움큼
      if (this.rng() < W.FRAG_RATE * (m.isBoss ? 20 : m.elite ? 5 : 1) * pk) this.gainFrag(1, { x: m.x, y: m.y });   // v275 무공 비급 조각
    }
    this.s.gold += gold;
    const mat = this.dropMats(m);
    if (m.elite) this.dropMats(m);
    if (this.rng() < pk - 1) this.dropMats(m);   // v438 재료·증표·두목 떨굼도 한 번 더 굴릴 때가 있다(기대값 ×1/PACE)
    this.addMastery(this.map.zone, 1 + (this.rng() < pk - 1 ? 1 : 0));
    // 보물 원숭이 — 들판에서 가끔 (하나만)
    if (!this.map.bossRoom && this.rng() < L.TREASURE_RATE * (W.CLASSES[this.s.job]?.treasureK || 1) * pk && !this.mons.some((o) => o.alive && o.treasure)) this.spawnTreasure();
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

  // v343 함께 잡은 두목을 못 친 문파원 몫 — 경험치·은자·현철만 k배(장비·탈것·조각·증표는 없음)
  coopShare(m, k) {
    const st = this.stats();
    const exp = W.mobExp(m.lv) * W.BOSS.exp * (W.CLASSES[this.s.job]?.bossExp || 1) * this.levelGapMult(m.lv) * this.challengeMult(m.lv) * (st.expMult || 1) * k * W.PACE_REWARD;   // v425 · v438
    const gold = Math.round(W.mobGold(m.lv) * W.BOSS.gold * (1 + (st.gold || 0)) * (st.goldMul || 1) * k * W.PACE_REWARD);
    const id = this.map.mz;
    let mat = null;
    if (W.MATS[id]) { const n = Math.max(1, Math.round(W.BOSS_MATS * k)); this.addMats(id, n); mat = { id: W.ORE, n: n * W.matWeight(id), name: W.ORE_NAME, color: W.ORE_COL }; }
    this.s.gold += gold;
    m.alive = false; m.hp = 0; if (this.mon === m) this.mon = null;
    this.emit('kill', { gold, isBoss: true, add: true, at: m, mat, share: true });
    this.addExp(exp);
    this.note(1, exp, gold, 0);
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
  // v425 도전 경험치 — 나보다 높은 몹을 잡으면 레벨 차 1마다 +5%, 네 배까지(사냥터·두목만 · 던전·방치는 그대로).
  //   레벨 72가 150 사냥터에서 잡아도 몹 경험치가 3배뿐(lv^1.5)이라 「레벨업을 안 한다」고 느꼈다 — 체력은 3.4배라 더 느렸다
  challengeMult(mlv) { const d = mlv - this.s.level; return d <= 0 ? 1 : Math.min(W.CHALLENGE_MAX, 1 + d * W.CHALLENGE_K); }
  challengeNow() { const m = this.map; if (!m || m.town || this.inst || !m.lv) return 1; return this.challengeMult(m.lv[1]); }

  heroDied(by) {
    // 증표 고유 · 불사(v167): 60초에 한 번, 쓰러질 피해를 버틴다
    const php = this.impSpecials().phoenix;
    if (php && !(this._phoenixAt > this.clock - 40)) {
      this._phoenixAt = this.clock;
      this.heroHp = this.stats().hp * Math.min(0.8, 0.3 * php.p);
      this._invulnUntil = this.clock + 2;
      this._impT = 0; this.impShow(php, null);
      return;
    }
    // 던전에서 쓰러지면 잃는 것 없이 그 판만 끝난다
    if (this.inst) {
      this.heroHp = this.stats().hp;
      if (!this.inst.done) this.inst.done = { ok: false, died: true };
      this.emit('heroDied', { boss: !!by?.isBoss, loss: 0, inst: true });
      return;
    }
    this.heroHp = 0;
    this.s.deaths++;
    // v354 쓰러져도 레벨은 절대 안 내려간다 — 잃는 건 지금 레벨에서 쌓은 경험치의 5%뿐(0 아래로는 안 간다)
    const lv0 = this.s.level;
    const loss = Math.max(0, Math.min(this.s.exp, Math.floor(this.s.exp * W.DEATH_EXP_LOSS)));
    this.s.exp = Math.max(0, this.s.exp - loss);
    this.s.level = Math.max(this.s.level, lv0);
    // 레벨보다 한참 센 곳에서 쓰러지면 돌아갈 곳을 알맞은 사냥터로 바꾼다 — 방치하다 같은 자리에서 계속 쓰러지지 않게
    let retreat = null;
    // v258: 위험 레벨이 아니어도 5분 안에 같은 사냥터에서 세 번 쓰러지면 물러난다(경험치 5%·물약이 되풀이로 새던 것)
    const nowC = this.clock;
    this._deaths = (this._deaths || []).filter((d) => nowC - d.t < 300 && d.map === this.map.id);
    this._deaths.push({ t: nowC, map: this.map.id });
    const streak = this._deaths.length >= 3 && this.safeMap() !== this.map.id && W.mapOf(this.safeMap()).lv[0] < this.map.lv[0];
    if ((this.danger(this.map.id) > W.DANGER_LV || streak) && this.s.autoHunt) {
      this._deaths = [];
      this._retreatAt = this.clock;
      this.s.huntMap = this.safeMap();
      retreat = W.mapOf(this.s.huntMap).name;
    }
    this.emit('heroDied', { boss: !!by?.isBoss, loss, retreat });
    this.heroHp = 1;
    this.goTown(true);
  }

  // ---------- 스킬 ----------
  // v391 5차 천마신공 — 천마를 쓰러뜨린 검사가 5차 전직을 마쳤나
  cheonmaOn() { return !!W.fifthOf(this.s.job) && (this.s.jobTier || 0) >= 5; }
  fifth() { return W.fifthOf(this.s.job); }   // v393 직업마다 5차(검사 천마신공 · 권마 투신 · 환마 혈마 · 독마 독존 · 극악소마 악존)
  skillList() { return this.s.job ? W.skillsOf(this.s.job, this.cheonmaOn()) : []; }
  skills() { return this.skillList().filter((k) => this.knows(k) && !this.retired(k)); }
  // v444 주력 무공 — 배운 공격 무공(1·2·3차 · 승급의 공격 무공) 가운데 가장 높은 차수 하나. 길 무공은 주력이 되지 않고 힘만 물려준다
  mainSkill() {
    const key = `${this.s.job}|${this.s.jobTier}|${this.s.path}|${PT.merged(this.s) ? 1 : 0}|${this.cheonmaOn() ? 1 : 0}`;
    if (this._main?.key === key) return this._main.sk;
    let best = null;
    // 1·2·3차의 사다리(s0 → s1 → s2). 승급(4차) 무공은 따로 남는 필살기라 사다리에 넣지 않는다
    for (const k of this.skillList()) if (!k.path && k.slot <= 2 && W.ATTACK_KINDS.has(k.kind) && this.knows(k) && (!best || k.tier > best.tier)) best = k;
    const ret = best ? this.skillList().filter((k) => k.id !== best.id && (k.path || k.slot <= 2) && W.ATTACK_KINDS.has(k.kind) && this.knows(k)) : [];
    // 초당 몫 — 한 적만 치던 무공이 둘레를 치는 주력에 들어가면 여럿을 치게 되니 W.INHERIT_SINGLE만큼만
    const base = best ? W.skillPower(best) / Math.max(0.5, best.cd || 1) : 1;
    const sum = (wSingle) => ret.reduce((a, k) => a + (W.skillPower(k) / Math.max(0.5, k.cd || 1)) * (k.kind === 'single' && best.kind !== 'single' ? wSingle : 1), 0);
    const inherit = best ? 1 + W.INHERIT_K * sum(W.INHERIT_SINGLE) / Math.max(1e-6, base) : 1;   // 졸개 떼(한 적 무공은 몫만)
    const inheritBoss = best ? 1 + W.INHERIT_K * sum(1) / Math.max(1e-6, base) : 1;              // 두목 한 마리(한 적 무공도 온전히)
    // 받은 힘은 반은 숨(더 자주)으로, 반은 한 방으로 — 한 방만 키우면 졸개에게 넘친 피해가 버려지고 펼치는 맛이 없다
    // 물러난 무공의 덧(기절·받는 피해 +)도 주력이 걸어 준다 — 환마 섭혼술의 취약 같은 것이 사라지지 않게
    const vuln = ret.reduce((a, k) => (k.vuln && (!a || k.vuln.v > a.v) ? k.vuln : a), null);
    const stun = ret.reduce((a, k) => Math.max(a, k.stun || 0), 0);
    this._main = { key, sk: best, ret, inherit, inheritBoss, cdK: 1 / Math.sqrt(inherit), dmgK: Math.sqrt(inherit), vuln, stun };
    return best;
  }
  retiredSkills() { this.mainSkill(); return this._main?.ret || []; }
  retired(sk) { return !!sk && (sk.path || sk.slot <= 2) && W.ATTACK_KINDS.has(sk.kind) && this.knows(sk) && this.mainSkill()?.id !== sk.id; }
  inheritK(id) { const m = this.mainSkill(); return m && m.id === id ? this._main.inherit : 1; }
  inheritDmg(id, boss = false) { const m = this.mainSkill(); return m && m.id === id ? this._main.dmgK * (boss ? this._main.inheritBoss / this._main.inherit : 1) : 1; }
  inheritCd(id) { const m = this.mainSkill(); return m && m.id === id ? this._main.cdK : 1; }
  // v444 무공 레벨을 주력으로 모은다 — 가장 높은 레벨을 주력이 갖고, 물러난 무공에 쓴 나머지 점수는 돌려준다(전직·옛 세이브)
  consolidateSkills() {
    const main = this.mainSkill();
    if (!main) return 0;
    const ids = [main.id, ...this.retiredSkills().map((k) => k.id)];
    const lv = this.s.skillLv || (this.s.skillLv = {});
    let spent = 0, top = 1;
    for (const id of ids) { const l = lv[id] || 1; spent += W.skillSpent(l); top = Math.max(top, l); }
    for (const id of ids) delete lv[id];
    if (top > 1) lv[main.id] = top;
    const back = spent - W.skillSpent(top);
    if (back > 0) this.s.skillPts = (this.s.skillPts || 0) + back;
    this._mods = null;
    return back;
  }
  // 배웠나 — 공격 무공은 전직 차수, 보조기는 레벨(v120)
  // 길 무공(v240)은 그 길을 걷거나 합일했을 때만
  knows(sk) {
    if (!sk) return false;
    if (sk.path) return (this.s.path === sk.path || PT.merged(this.s)) && sk.tier <= (this.s.jobTier || 0);
    return sk.kind === 'support' ? this.s.level >= sk.from : sk.tier <= this.s.jobTier;
  }
  skillDef(id) { return this.skillList().find((k) => k.id === id) || null; }
  hpCostOf(sk) { const st = this.stats(); return Math.round(st.hp * (sk.hpCost || 0) * (1 - this.skillMods(sk.id).cost) * (1 - (st.hpCostDown || 0)) * (this.inst?.kind === 'wraid' ? D.WB_TIER[D.wbTierOf(this.map?.wb)].heal : 1)); }   // v397 월드보스는 회복이 줄어드는 만큼 무공 체력 값도(극악소마가 제 무공에 쓰러졌다)
  skillRadius(sk) { return (sk.radius || 0) * Math.max(0.3, 1 + this.skillMods(sk.id).range + (this.stats().skillRange || 0)); }
  skillCd(sk) {
    const sb = this.setBonus();
    return sk.cd * this.inheritCd(sk.id) * (1 - this.skillMods(sk.id).cd) * Math.max(0.5, 1 + (this.envNow().cd || 0)) * (1 - (this.stats().cdr || 0)) * (sk.slot === 4 ? 1 - (sb.cd4 || 0) : 1);
  }
  // 못 펼친 까닭 (v199) — 'town' | 'cd' | 'hp' | 'none'(과녁 없음) | 'far'(닿는 적 없음). 단추를 눌렀을 때 바르게 알린다
  canUseSkill(id) {
    const sk = this.skillDef(id);
    this.skillFail = null;
    if (!this.knows(sk) || this.retired(sk)) return false;   // v444 물러난 무공은 주력이 대신 쓴다
    if (this.map.town) { this.skillFail = 'town'; return false; }
    if (this.cd[id] > 0) { this.skillFail = 'cd'; return false; }
    if (this.heroHp <= this.hpCostOf(sk) + 1) { this.skillFail = 'hp'; return false; }      // 대가로 죽지는 않는다
    return true;
  }
  // o.free: 삼공합일이 대신 펼칠 때 — 숨·체력을 따지지 않고, 연출·삼공조화 셈도 건너뛴다. o.boost: 배수
  useSkill(id, o = {}) {
    if (!o.free && !this.canUseSkill(id)) return false;
    const sk = this.skillDef(id);
    const st = this.stats();
    // v391 칠초식 심마도 — 천마혼 발현(무인 뒤 천마의 형상 · 모든 피해 +)
    // v397 혼 발현은 따로 숨(SOUL_CD)이 있다 — 검사는 심마도 숨(15초)이 발현 시간과 같아 늘 켜져 있었다(남은 60~75%)
    if (sk.soul && this.cheonmaOn() && !(this.buffs.cmSoulCd > 0)) { this.buffs.cmSoul = this.fifth().soulSec; this.buffv.cmSoul = this.fifth().soulDmg; this.buffs.cmSoulCd = W.SOUL_CD; this.emit('cmSoul', { sec: this.fifth().soulSec }); }
    if (sk.kind === 'support') return this.useSupport(sk, st);
    if (sk.kind === 'awaken') { const c = this.hpCostOf(sk); this.heroHp -= c; if (c) this.emit('hpCost', { amount: c }); return this.useSupport(sk, st); }
    if (sk.kind === 'clone') return this.useClone(sk, st);
    if (sk.kind === 'triple') return this.useTriple(sk, st);
    let tgt = this.mon?.alive ? this.mon : this.pickTarget({ ...st, range: 9999 });
    if (sk.kind === 'single') {
      // v199: 과녁이 사거리 밖이면 닿는 적 가운데 가장 가까운 것으로 바꿔 펼친다 — 전에는 숨이 다 찼는데도 그냥 안 나갔다
      const reach = sk.far ? 420 : Math.max(st.range, 160) * 1.6;
      if (!tgt || Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > reach) {
        let best = null, bd = reach;
        for (const m of this.mons) {
          if (!m.alive || m.npc || m.introT > 0) continue;
          const d = Math.hypot(m.x - this.heroX, m.y - this.heroY);
          if (d <= bd) { bd = d; best = m; }
        }
        if (!best) { this.skillFail = tgt ? 'far' : 'none'; return false; }
        tgt = best;
        this.mon = best;
      }
    }
    const md = this.skillMods(id);
    const cost = o.free ? 0 : this.hpCostOf(sk);
    this.heroHp -= cost;
    if (!o.free) this.cd[id] = this.skillCd(sk);
    const aimed = (sk.kind === 'aoe' || sk.kind === 'field') && this.ranged() && tgt;
    const center = aimed ? { x: tgt.x, y: tgt.y } : { x: this.heroX, y: this.heroY };
    const r = this.skillRadius(sk);
    if (!o.free && this.impSpecials().surge) { this._surgeUntil = this.clock + 3; this.impShow(this.impSpecials().surge, null); }
    if (!o.free) this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: sk.tier,
      at: center, radius: r, motion: sk.kind === 'single' ? 'single' : 'aoe', dur: 0 });
    if (cost) this.emit('hpCost', { amount: cost });
    // 스킬 레벨·장비 옵션: 피해 · 범위 · 치명 · (1차) 주변 적 · (신화) 한 번 더 · 숨 되돌리기
    // v441 체력이 곧 힘 — 소모한 체력 × HP_DMG_K 만큼 더(한 번 맞을 때, 여러 번·여러 자루면 나눠서). 공짜로 펼친(삼공합일) 것도 제 소모분으로 센다
    const hpSpent = this.hpCostOf(sk);
    const hpMult = hpSpent > 0 && st.atk > 0 ? (hpSpent * W.HP_DMG_K) / st.atk / (sk.hits || 1) / (sk.kind === 'daggers' ? sk.n : 1) : 0;
    const mult = (sk.mult + hpMult) * st.skillMult * (1 + md.dmg) * (o.boost || 1) * W.SKILL_K * this.inheritDmg(id);   // v439 무공이 중요하게 · v444 주력은 물러난 무공의 힘을 이어받는다(한 방 몫)
    const bossInh = this.inheritDmg(id, true) / this.inheritDmg(id);   // 두목에겐 한 적 무공의 힘까지 온전히
    const isMain = this.mainSkill()?.id === id;
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
      const d = this.strike(m, st, mult * k * (m.isBoss && sk.bossMult ? sk.bossMult : 1) * (m.isBoss ? bossInh : 1), id, crit);
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
      const stunS = Math.max(sk.stun || 0, isMain ? this._main.stun : 0);
      if (stunS) m.stun = Math.max(m.stun || 0, m.isBoss ? stunS * 0.4 : stunS);
      const vu = isMain && this._main.vuln && (!sk.vuln || this._main.vuln.v > sk.vuln.v) ? this._main.vuln : sk.vuln;   // v444 물러난 무공의 취약도
      if (vu && !(m.vulnT > this.clock && m.vulnV > vu.v)) { m.vulnT = this.clock + vu.sec; m.vulnV = vu.v; }
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
      // v254: 공속 값(haste)에 제 타이머를 — 전엔 gale(그림용)만 걸어 만료돼도 +40%가 영원히 남았다
      if (b.speed) { this.buffs.gale = b.sec; this.buffs.haste = Math.max(this.buffs.haste || 0, b.sec); this.buffv.haste = Math.max(this.buffv.haste || 0, b.speed); }
      if (b.dmgRed) { this.buffs.guard = b.sec; this.buffv.guard = b.dmgRed; }
      if (b.cleave) { this.buffs.cleave = b.sec; this.buffv.cleave = b.cleave; }
      this.buffs.rage = b.sec;
    }
    if (o.free) return true;
    // 극악소마 삼공조화: 세 무공이 HARMONY.sec 안에 이어지면
    this.skillAt[sk.slot] = this.clock;
    if (this.mainSkill()?.id === id) for (const r of this.retiredSkills()) if (!r.path) this.skillAt[r.slot] = this.clock;   // v444 주력은 물러난 무공을 품었다 — 극악소마 3차 주력 한 번이 곧 세 무공
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
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: 3, at, radius: sk.radius ? this.skillRadius(sk) : 0, motion: 'buff', dur: sk.buff?.sec || 0 });
    const b = sk.buff || {};
    const set = (k, v) => { this.buffs[k] = b.sec; this.buffv[k] = v; };
    if (b.move) set('move', b.move * pow);
    if (b.speed) { set('haste', Math.max(this.buffv.haste || 0, b.speed * pow)); this.buffs.gale = b.sec; }
    if (b.dodge) set('dodge', Math.min(0.6, b.dodge * pow));
    if (b.dmgRed) set('guard', Math.min(0.8, Math.max(this.buffv.guard || 0, b.dmgRed * pow)));
    if (b.fear) set('fear', b.fear * pow);
    if (b.critDmg) set('critUp', b.critDmg * pow);
    if (b.triple) set('triple', b.triple);
    if (sk.shield) { this.shield = st.hp * sk.shield * pow * (this.inst?.kind === 'pvp' ? PV.PVP_HEAL * 1.6 : 1); this.buffs.shield = b.sec; this.buffv.shield = 1; }   // v451 대결은 보호막도 작게
    if (sk.heal) {
      const add = (st.hp - this.heroHp) * Math.min(1, sk.heal * pow);
      this.heroHp = Math.min(st.hp, this.heroHp + add);
      this.emit('heal', { amount: add });
    }
    if (sk.burst) {
      // 만독귀원: 둘레 적에게 쌓인 독을 한꺼번에 터뜨린다
      for (const m of this.mons.slice()) {
        if (!m.alive || m.npc || !(m.dot > 0) || Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) > this.skillRadius(sk)) continue;   // v288 범위 보너스도 받는다(전엔 늘 320)
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
    const mult = st.skillMult * (1 + md.dmg) * W.SKILL_K;   // v439
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
    const near = this.mons.filter((m) => m.alive && !m.npc && Math.hypot(m.x - this.heroX, (m.y - this.heroY) * 0.75) <= (sk.auto === 'poisoned' && sk.radius ? this.skillRadius(sk) : 320));
    // v289 만독귀원: 중독 셋 → 둘 · 다쳤으면(체력 60% 아래) 하나만 있어도(회복 12%가 붙어 있다) — 전엔 셋을 기다리느라 숨이 다 차도 대부분 놀았다
    if (sk.auto === 'poisoned') {
      const pois = near.filter((m) => m.dot > 0);
      return pois.length >= 2 || near.some((m) => m.isBoss && m.dot > m.maxHp * 0.02) || (pois.length >= 1 && this.heroHp < st.hp * 0.6);
    }
    return near.length >= 4 || near.some((m) => m.isBoss);
  }
  autoSkills(st) {
    this._autoCast = true;
    try { this.autoSkills0(st); } finally { this._autoCast = false; }
  }
  autoSkills0(st) {
    const mainId = this.mainSkill()?.id;
    for (const sk0 of this.skills()) {
      // v444 주력은 하나뿐이라 체력이 W.MAIN_AUTO_ABOVE 넘으면 쓴다(전엔 0.6 — 반쯤 다치면 평타만 쳤다)
      const sk = sk0.id === mainId && sk0.autoAbove > W.MAIN_AUTO_ABOVE ? { ...sk0, autoAbove: W.MAIN_AUTO_ABOVE } : sk0;
      if (this.cd[sk.id] > 0) continue;
      if (sk.kind === 'support' || sk.kind === 'awaken') { if (this.wantSupport(sk, st) && !(sk.autoAbove && this.heroHp < st.hp * sk.autoAbove)) this.useSkill(sk.id); continue; }
      if (sk.kind === 'triple') { if (this.mon?.alive && (this.mon.isBoss || this.mons.filter((m) => m.alive && Math.hypot(m.x - this.heroX, m.y - this.heroY) <= 300).length >= 3)) this.useSkill(sk.id); continue; }
      if (sk.autoAbove && this.heroHp < st.hp * sk.autoAbove && !sk.buff?.dmgRed) continue;
      if (sk.kind === 'single') {
        if (!this.mon?.alive) continue;
        // 한 대에 죽을 놈에게는 아끼고, 두목·센 놈에게 쓴다
        if (!this.mon.isBoss && this.mon.hp < st.atk * 1.5) continue;
        if (!this._shReach && Math.hypot(this.mon.x - this.heroX, this.mon.y - this.heroY) > (sk.far ? 400 : Math.max(st.range, 160))) continue;
      } else {
        const c = this.ranged() && this.mon?.alive ? this.mon : { x: this.heroX, y: this.heroY };
        const rr = this.skillRadius(sk);
        const n = this.mons.filter((m) => m.alive && Math.hypot(m.x - c.x, (m.y - c.y) * 0.75) <= rr).length;
        const boss = this.mons.some((m) => m.alive && m.isBoss && (this._shReach || Math.hypot(m.x - c.x, m.y - c.y) <= rr));
        if (n < 3 && !boss) continue;
      }
      if (this.useSkill(sk.id)) return;
    }
  }

  // ---------- 레벨 ----------
  expNeed() { return W.expToNext(this.s.level); }
  // v317 경험치 n을 받으면 몇 레벨이 되나(바꾸지 않고 셈만) — 방치 보상 창의 'Lv.40 → Lv.43'
  projectLevel(n) {
    let lv = this.s.level, exp = this.s.exp + Math.max(0, n || 0);
    while (lv < W.LEVEL_MAX && exp >= W.expToNext(lv)) { exp -= W.expToNext(lv); lv++; }
    return { lv, exp, gained: lv - this.s.level, pct: lv < W.LEVEL_MAX ? exp / W.expToNext(lv) : 1 };
  }
  addExp(n) {
    const s = this.s;
    if (s.level >= W.LEVEL_MAX) {
      // v263 깨달음 — 만렙 뒤 경험치는 버리지 않고 깨달음 점수로
      const e = s.enl || (s.enl = { pts: 0, exp: 0, nodes: {} });
      e.exp += n;
      const per = W.enlExp();
      if (e.exp >= per) { const k = Math.floor(e.exp / per); e.pts += k; e.exp -= k * per; this.emit('enlight', { pts: e.pts, got: k }); }
      return;
    }
    s.exp += n;
    while (s.level < W.LEVEL_MAX && s.exp >= W.expToNext(s.level)) {
      s.exp -= W.expToNext(s.level);
      s.level++;
      s.statPts += s.level > W.LEVEL_SHOW ? W.STAT_PER_TRAIN : W.STAT_PER_LEVEL;   // v447 수련은 1점
      if (s.level >= W.SKILL_PT_FROM) s.skillPts = (s.skillPts || 0) + 1;
      this.emit('levelUp', { level: s.level });
      const look = W.lookTierOf(s.level);
      if (look !== s.rank) s.rank = look;
      this._followDue = true;
    }
    if (s.autoStat) this.autoStats();
    this.autoSkillPoints();   // v449
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
  // v449 힘의 내역 — 장비 · 동료 · 무림 갈래를 하나씩 빼고 셈해 「그 갈래가 전투력을 몇 % 올리나」. 무인(레벨·전직·능력치·무공)은 셋을 다 뺀 바탕
  powerBreakdown() {
    const sig = this.statSig();
    if (this._pb?.sig === sig) return this._pb;
    const full = this.stats();
    const res = { sig, full: full.power };
    const calc = (off) => { this._off = off; this._stats = null; const p = this.stats().power; this._off = null; return p; };
    try {
      for (const g of ['gear', 'comp', 'murim']) res[g] = full.power / Math.max(1, calc({ [g]: true })) - 1;
      res.base = calc({ gear: true, comp: true, murim: true });
    } finally { this._off = null; this._stats = full; }
    this._pb = res;
    return res;
  }
  // v449 무공 점수 자동 — 주력 무공 → 보조기 → 승급 필살기·길 자세 → 심법(싼 것부터). 하나도 못 찍으면 멈춘다
  autoSkillPoints() {
    if (!this.s.autoSkillPts || !(this.s.skillPts > 0) || !this.s.job || !(this.s.jobTier >= 1)) return 0;
    let n = 0;
    const main = this.mainSkill();
    const order = [main, ...this.skills().filter((k) => k !== main && k.id !== main?.id).sort((a, b) => (a.kind === 'support' ? 0 : 1) - (b.kind === 'support' ? 0 : 1))].filter(Boolean);
    for (let guard = 0; guard < 400 && this.s.skillPts > 0; guard++) {
      const sk = order.find((k) => this.canSkillUp(k.id));
      if (sk) { this.skillUp(sk.id); n++; continue; }
      const p = this.passiveList().filter((x) => this.canPassUp(x.id)).sort((a, b) => W.passiveCost(a, this.passLevel(a.id)) - W.passiveCost(b, this.passLevel(b.id)))[0];
      if (p) { this.passUp(p.id); n++; continue; }
      break;
    }
    return n;
  }
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
    this.heroHp = Math.min(this.heroHp, this.stats().hp);   // v436 체력에 찍은 점을 빼면 막대가 넘쳐 보였다(몽키 봇)
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
  // v325 1차 전직 전에는 직업을 공짜로 바꾼다 — 무공 점수는 다 돌려받고, 성장 장비·레벨·은자는 그대로
  canChangeJob(id) { return !!this.s.job && (this.s.jobTier || 0) === 0 && !!W.CLASSES[id] && id !== this.s.job; }
  changeJob(id) {
    if (!this.canChangeJob(id)) return false;
    const back = this.skillSpentAll();
    this.s.skillLv = {}; this.s.passLv = {}; this.s.skillPts += back;
    this.s.path = null;
    this.s.job = id;
    this._mods = null; this._pm = null; this._pass = null; this._stats = null;
    this.heroHp = Math.min(this.heroHp, this.stats().hp);
    this.emit('jobChange', { job: id, back });
    return true;
  }
  // 다음 전직 — 3차까지는 누구나, 4차는 4차 무공이 있는 직업만(v121: 환마 환영분신술)
  nextTier() {
    const n = this.s.jobTier + 1;
    if (n <= 3) return W.TIERS[n];
    if (n === 5) return this.fifth() ? { ...W.TIERS[5], need: this.fifth().need } : null;   // v391 천마신공 · v393 직업마다 꺾을 두목
    return n === 4 && W.skillsOf(this.s.job).some((k) => k.tier === 4) ? W.TIERS[4] : null;
  }
  canAdvance() {
    const t = this.nextTier();
    return !!t && this.s.level >= t.level && this.s.gold >= t.cost && (!t.need || !!this.s.duel?.won?.[t.need]);   // 사냥터에서도 (마을까지 안 가도 된다) · v391 5차는 천마를 쓰러뜨려야
  }
  advance() {
    if (!this.canAdvance()) return false;
    const t = this.nextTier();
    this.s.gold -= t.cost;
    this.s.jobTier++;
    const sk = W.skillsOf(this.s.job).find((k) => k.tier === this.s.jobTier);
    this._stats = null;
    this.consolidateSkills();   // v444 새 주력이 옛 무공의 레벨을 이어받는다
    this.autoSkillPoints();     // v449
    if (this.s.jobTier >= 5) { this.emit('advance', { tier: 5, skill: this.fifth().name, cheonma: true, job: this.s.job }); return true; }   // v391
    this.emit('advance', { tier: this.s.jobTier, skill: sk?.name });
    return true;
  }
  tierName(t = this.s.jobTier) { return t >= 5 && this.fifth() ? this.fifth().tierName : W.classOf(this.s.job)?.tiers?.[t] || ''; }

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
    if (!key) return;                                  // 천외(v238)는 세력 재료가 없다
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
      const bossN = Math.round(W.BOSS_MATS * (this.coopK || 1));   // v343 함께 잡으면 현철도 인원만큼
      this.addMats(id, bossN);
      const markN = 1 + (this.rng() < this.braveBonus() ? 1 : 0);
      this.addMats(W.bossKey(id), markN);   // v262 패기: 센 곳 두목은 증표를 하나 더 줄 때가 있다
      // 십이지왕 (v132): 전반 다섯은 맡은 부위의 내 직업 세트 조각(두 세트 가운데 하나), 후반 일곱은 강화석(늘) + 가끔 공용 장신구
      if (W.kingOf(id)) {
        const stone = G.STONES[id];
        if (stone) { this.addMats(G.stoneKey(id), G.STONE_PER_BOSS); this.emit('stone', { key: G.stoneKey(id), n: G.STONE_PER_BOSS, at: { x: m.x, y: m.y } }); }
        else { const ez = G.earlyStoneZone(id); if (ez) { this.addMats(G.stoneKey(ez), G.EARLY_STONE_PER_BOSS); this.emit('stone', { key: G.stoneKey(ez), n: G.EARLY_STONE_PER_BOSS, at: { x: m.x, y: m.y } }); } }   // v435 전반 왕
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
        if (this.rng() < W.petDropRate(id) * this.lootK()) this.gainPet(W.rollRarity(W.KING_RAR_W, this.rng), m, W.rollPetKind(id, this.rng));
        return { id: W.ORE, n: bossN * W.matWeight(id), name: W.ORE_NAME, color: W.ORE_COL, boss: W.matName(W.bossKey(id)), markN };
      }
      // v158: 사다리 장비는 이제 떨구지 않는다(장비는 레벨을 따라 자란다) — 대신 가끔 증표 한 움큼(등급 각인 재료)
      if (this.rng() < W.BOSS_ITEM_RATE) this.addMats(W.bossKey(id), W.INFUSE_MARKS[1]);
      // 가락지·귀걸이 — 두목만 떨군다
      if (this.rng() < W.acc2DropRate(id) * this.lootK()) {
        const rar = W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng);
        const st = W.stepOfLevel(W.zoneOfW(id)?.lv[1] || 5);
        const it = this.makeCrafted(this.rng() < 0.5 ? 'finger' : 'ear', st, 0, rar, id);
        it.boss = true;
        this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
        this.gainItem(it);
      }
      // 애완동물 — 두목만, 낮은 확률
      // 초반 두목은 아주 낮게·아래 순위만, 높은 두목일수록 자주·위 순위까지
      if (this.rng() < W.petDropRate(id) * this.lootK()) this.gainPet(W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng), m, W.rollPetKind(id, this.rng));
      return { id: W.ORE, n: bossN * W.matWeight(id), name: W.ORE_NAME, color: W.ORE_COL, boss: W.matName(W.bossKey(id)), markN };
    }
    if (this.rng() >= W.MAT_RATE * (this.stats().matMult || 1) * (1 + this.masteryLevel(this.map.zone) * L.MASTERY.mat) * (1 + this.braveBonus()) * (!this.inst && TD.bloodOn() ? 1 + TD.BLOOD_BONUS : 1)) return null;
    this.addMats(id, 1);
    return { id: W.ORE, n: W.matWeight(id), name: W.ORE_NAME, color: W.ORE_COL };
  }
  // v273 들어오는 지역 재료는 현철 × 그 지역 가중치로
  addMats(key, n) { const o = W.oreOf(key, n); this.s.mats[o.key] = (this.s.mats[o.key] || 0) + o.n; }
  // 지역 재료가 섞인 값표({열쇠: 개수}) — 현철로 바꿔 모자란 것 · 내기
  matsLack(mats) { const need = {}; for (const [k, n] of Object.entries(mats || {})) { const o = W.oreOf(k, n); need[o.key] = (need[o.key] || 0) + o.n; } return Object.keys(need).filter((k) => (this.s.mats[k] || 0) < need[k]); }
  matsPay(mats) { for (const [k, n] of Object.entries(mats || {})) { const o = W.oreOf(k, n); this.s.mats[o.key] = (this.s.mats[o.key] || 0) - o.n; } }
  // v262 패기 — 내 레벨보다 센 사냥터는 레벨 차 1마다 재료·증표 +4%(최대 +40%). 높은 데로 갈 까닭.
  braveBonus() {
    if (this.inst || !this.map?.lv) return 0;
    return Math.min(W.BRAVE_MAX, Math.max(0, (this.map.lv[0] + this.map.lv[1]) / 2 - this.s.level) * W.BRAVE_PER);
  }
  // 재료 올리기 (v174): 지역 k 재료 MAT_CONVERT개 → 다음 지역 하나. n을 안 주면 되는 만큼 전부. 만든 개수를 돌려준다.
  // v273 현철 하나라 올릴 것이 없다(옛 부르는 자리를 위해 남긴다)
  convertMats(k, n = Infinity) {
    if (!W.isZoneMatKey(k) || !this.s.mats[k]) return 0;
    const to = W.matUpTarget(k);
    if (!to) return 0;
    const m = Math.min(n, Math.floor((this.s.mats[k] || 0) / W.MAT_CONVERT));
    if (m <= 0) return 0;
    this.s.mats[k] -= m * W.MAT_CONVERT;
    this.addMats(to, m);
    return m;
  }
  // 낮은 재료를 지금 강화에 드는 지역 재료까지 차례로 올린다 — { 지역: 얻은 개수 }
  convertAllUp() {
    const top = W.stepMap(W.stepOfLevel(Math.min(this.s.level, W.ILV_CAP)));
    const got = {};
    for (let k = 1; k < top; k++) { const m = this.convertMats(k); if (m) got[k + 1] = (got[k + 1] || 0) + m; }
    return got;
  }
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
  // v173: 세트·왕의 장비·두목이 떨군 가락지·귀걸이도 증표 각인으로 등급을 올리고 세 칸을 새긴다 (검혼석 승급은 없앴다)
  canImprintItem(it) { return !!it && (it.grow || it.king != null || (W.isDropOnly(it.slot) && it.step != null)); }
  infuseInfo(it, key) {
    const r = (it?.rar || 0) + 1;
    if (!this.canImprintItem(it) || r >= W.RARITY.length || !W.isMarkKey(key)) return null;
    const chance = Math.min(1, W.INFUSE_BASE[r] * W.infuseFactor(key, it.ilv) + (it.pity || 0));
    return { to: r, n: W.INFUSE_MARKS[r], gold: W.infuseGold(it.ilv, r), chance, have: this.s.mats[key] || 0 };
  }
  canInfuse(it, key) {
    const f = this.infuseInfo(it, key);
    return !!f && f.have >= f.n && this.s.gold >= f.gold;
  }
  infuse(uid, key, spIdx = 0) {
    const it = this.findItem(uid);
    if (!this.canInfuse(it, key)) return null;
    const f = this.infuseInfo(it, key);
    const res0 = this.resonance();
    this.s.mats[key] -= f.n;
    this.s.gold -= f.gold;
    this.mark('infuse');
    const ok = this.rng() < f.chance;
    let kept = false;
    if (ok) {
      it.rar = f.to;
      it.grade = W.RARITY_GRADE[it.rar];
      // v258: 옵션은 새로 굴리되, 있던 '애완동물 +칸'·'스킬 변화'는 잃지 않는다(전엔 각인에 성공하면 펫 칸이 사라져 키우던 펫이 조용히 쉬었다)
      const oldOpts = it.opts || [];
      it.opts = this.rollOpts(it.slot, it.step ?? null, it.rar, it.king ?? it.z ?? null);
      const oldPet = oldOpts.find((o) => o.pet), newPet = it.opts.find((o) => o.pet);
      if (oldPet && (!newPet || newPet.pet < oldPet.pet)) { if (newPet) newPet.pet = oldPet.pet; else it.opts.push({ pet: oldPet.pet }); }
      const oldTf = oldOpts.find((o) => o.tf);
      if (oldTf && !it.opts.some((o) => o.tf)) it.opts.push({ ...oldTf });
      it.pity = 0;
      // v307 각인은 한 칸 — 비어 있으면 그 두목을 새기고, 이미 있으면 그대로(등급이 올라 칸이 세진다)
      // v167: 스킬 변화는 굴리고(몇 차 · 무엇 · 효과 등급), 고유 효과는 고른 것 · v298 극품·천품
      it.imps = (it.imps || []).slice(0, 1);
      if (!IM.normEntry(it.imps[0])) it.imps[0] = { k: key, ...IM.rollSkillChange(this.rng), sp: Math.max(0, Math.min(2, spIdx | 0)), q: IM.rollQual(this.rng) };
      else kept = true;
      this._stats = null; this._mods = null; this._pass = null;
    } else it.pity = (it.pity || 0) + W.INFUSE_BASE[f.to] * W.INFUSE_PITY_K;
    this.lastInfuse = { ok, to: f.to, chance: f.chance, kept };
    this.emit('infuse', { item: it, ok, kept });
    if (ok) this.resNote(res0);
    return ok;
  }
  // v307 각인 한 칸에 드는 증표 수 — 그 장비 등급 값(유니크 3 · 전설 6 · 신화 12)
  impMarksN(it) { return W.INFUSE_MARKS[Math.max(1, Math.min(3, it?.rar || 0))]; }
  // v251 빈 칸 새기기 — 이미 그 등급으로 얻은 장비(두목 드랍·제작·왕의 장비)는 '오를 때' 새기는 칸이 비어 있었고
  //   채울 길이 없었다(무기 첫째·둘째 각인이 안 박힌다). 그 칸 등급 값의 증표 + 은자로, 확률 없이 새긴다.
  fillImpInfo(it, slot, key) {
    if (!this.canImprintItem(it) || slot !== 0 || (it.rar || 0) < 1 || IM.normEntry(it.imps?.[0]) || !W.isMarkKey(key)) return null;   // v307 한 칸
    return { n: this.impMarksN(it), gold: W.infuseGold(it.ilv, it.rar), have: this.s.mats[key] || 0 };
  }
  canFillImp(it, slot, key) {
    const f = this.fillImpInfo(it, slot, key);
    return !!f && f.have >= f.n && this.s.gold >= f.gold;
  }
  fillImp(uid, slot, key, spIdx = 0) {
    const it = this.findItem(uid);
    if (!this.canFillImp(it, slot, key)) return null;
    const f = this.fillImpInfo(it, slot, key);
    const res0 = this.resonance();
    this.s.mats[key] -= f.n;
    this.s.gold -= f.gold;
    it.imps = (it.imps || []).slice();
    while (it.imps.length <= slot) it.imps.push(null);
    it.imps[slot] = { k: key, ...IM.rollSkillChange(this.rng), sp: Math.max(0, Math.min(2, spIdx | 0)), q: IM.rollQual(this.rng) };   // v298 극품·천품
    this._stats = null; this._mods = null; this._pass = null; this._isp = null;
    this.mark('infuse');
    this.emit('infuse', { item: it, ok: true, fill: true });
    this.resNote(res0);
    return it.imps[slot];
  }
  // 각인 다시 새기기 (v167) — 그 칸을 새긴 두목의 증표(그 칸 등급 값) + 은자.
  //   스킬 변화만 다시 굴리기(고유는 그대로) · 고유 효과만 바꾸기(스킬 변화는 잠근 채)
  reimpCost(it, slot) {
    const e = IM.normEntry(it?.imps?.[slot]);
    if (!this.canImprintItem(it) || !e) return null;
    return { key: e.k, n: this.impMarksN(it), gold: W.infuseGold(it.ilv, it.rar) };
  }
  canReimp(it, slot) {
    const c = this.reimpCost(it, slot);
    return !!c && (this.s.mats[c.key] || 0) >= c.n && this.s.gold >= c.gold;
  }
  payReimp(it, slot) {
    const c = this.reimpCost(it, slot);
    this.s.mats[c.key] -= c.n;
    this.s.gold -= c.gold;
    it.imps[slot] = { ...IM.normEntry(it.imps[slot]) };
    this._stats = null; this._mods = null; this._isp = null;
  }
  // v347 다시 굴리기 — 새로 뽑힌 스킬 변화는 '후보'로만 둔다(it.imps[slot].cand). 지금 것과 견주어 고른다:
  //   keepReroll(새 것으로) / dropReroll(지금 것 지키기). 전엔 굴리자마자 덮어써 좋은 효과가 강제로 날아갔다(길잡이 퀘스트라 안 할 수도 없었다).
  //   후보가 있는 채로 또 굴리면 그 후보를 버리고 새 후보를 뽑는다(지금 것은 그대로).
  rerollImpSkill(uid, slot) {
    const it = this.findItem(uid);
    if (!this.canReimp(it, slot)) return null;
    this.payReimp(it, slot);
    if (typeof it.imps[slot] === 'string') it.imps[slot] = IM.normEntry(it.imps[slot]);
    it.imps[slot].cand = IM.rollSkillChange(this.rng);
    this.emit('infuse', { item: it, ok: true, reimp: true });
    return { ...it.imps[slot], ...it.imps[slot].cand, cand: undefined };
  }
  keepReroll(uid, slot) {
    const it = this.findItem(uid); const e = it?.imps?.[slot];
    if (!e?.cand) return null;
    const c = e.cand; delete e.cand; Object.assign(e, c);
    this._stats = null; this._imp = null;
    return e;
  }
  dropReroll(uid, slot) {
    const it = this.findItem(uid); const e = it?.imps?.[slot];
    if (!e?.cand) return false;
    delete e.cand;
    return true;
  }
  changeImpSpecial(uid, slot, idx) {
    const it = this.findItem(uid);
    const e = IM.normEntry(it?.imps?.[slot]);
    if (!e || !IM.specialsOfZone(+e.k.slice(1)) || (e.sp | 0) === idx || idx < 0 || idx > 2 || !this.canReimp(it, slot)) return false;
    this.payReimp(it, slot);
    it.imps[slot].sp = idx;
    this.emit('infuse', { item: it, ok: true, reimp: true });
    return true;
  }
  // ---------- v297 칸 단(段) 올리기 — 그 칸 두목의 증표 + 은자, 확률 없이 한 단 ----------
  danInfo(it, slot) {
    const e = IM.normEntry(it?.imps?.[slot]);
    if (!this.canImprintItem(it) || !e) return null;
    const d = IM.danOf(e);
    if (d >= IM.DAN_MAX) return { key: e.k, d, max: true };
    return { key: e.k, d, to: d + 1, n: IM.danMarks(0, d), gold: Math.round(W.infuseGold(it.ilv, it.rar) * (0.3 + 0.15 * d)), have: this.s.mats[e.k] || 0 };
  }
  canDanUp(it, slot) {
    const f = this.danInfo(it, slot);
    return !!f && !f.max && f.have >= f.n && this.s.gold >= f.gold;
  }
  danUp(uid, slot) {
    const it = this.findItem(uid);
    if (!this.canDanUp(it, slot)) return null;
    const f = this.danInfo(it, slot);
    const res0 = this.resonance();
    this.s.mats[f.key] -= f.n;
    this.s.gold -= f.gold;
    it.imps = it.imps.slice();
    const e = { ...IM.normEntry(it.imps[slot]), d: f.to };
    // v298 대성 — 3·6·10단에서 효과 하나가 랜덤으로 ×2
    let gs = null;
    if (IM.GS_DAN.includes(f.to)) { gs = IM.rollGs(this.rng, !!IM.specialsOfZone(+e.k.slice(1))); e.gs = [...IM.gsOf(e), gs]; }
    it.imps[slot] = e;
    this._stats = null; this._mods = null; this._isp = null;
    this.mark('infuse');
    this.emit('infuse', { item: it, ok: true, dan: f.to, slot, gs });
    this.resNote(res0);
    return it.imps[slot];
  }
  // v298 다시 닦기 — 1단으로 되돌리고 대성을 지운다. 올리는 데 든 증표의 절반을 돌려받는다(극품·천품·스킬 변화·고유는 그대로)
  danResetInfo(it, slot) {
    const e = IM.normEntry(it?.imps?.[slot]);
    if (!this.canImprintItem(it) || !e) return null;
    const d = IM.danOf(e);
    if (d <= 1) return null;
    return { key: e.k, d, back: Math.floor(IM.danSpent(0, d) / 2), gs: IM.gsOf(e) };
  }
  danReset(uid, slot) {
    const it = this.findItem(uid);
    const f = this.danResetInfo(it, slot);
    if (!f) return null;
    this.s.mats[f.key] = (this.s.mats[f.key] || 0) + f.back;
    it.imps = it.imps.slice();
    const e = { ...IM.normEntry(it.imps[slot]), d: 1 };
    delete e.gs;
    it.imps[slot] = e;
    this._stats = null; this._mods = null; this._isp = null;
    this.emit('infuse', { item: it, ok: true, dan: 1, slot, reset: true });
    return it.imps[slot];
  }
  // ---------- v297 다시 새기기 — 이미 새겨진 칸을 다른 두목으로 (스킬 변화는 그대로 · 단은 절반 이어받는다) ----------
  rewriteInfo(it, slot, key) {
    const e = IM.normEntry(it?.imps?.[slot]);
    if (!this.canImprintItem(it) || !e || !W.isMarkKey(key) || key === e.k) return null;
    const d = IM.danOf(e);
    return { n: this.impMarksN(it), gold: W.infuseGold(it.ilv, it.rar), have: this.s.mats[key] || 0, d, keep: Math.max(1, Math.floor(d / 2)) };
  }
  canRewrite(it, slot, key) {
    const f = this.rewriteInfo(it, slot, key);
    return !!f && f.have >= f.n && this.s.gold >= f.gold;
  }
  rewriteImp(uid, slot, key, spIdx = 0) {
    const it = this.findItem(uid);
    if (!this.canRewrite(it, slot, key)) return null;
    const f = this.rewriteInfo(it, slot, key);
    const e = IM.normEntry(it.imps[slot]);
    const res0 = this.resonance();
    this.s.mats[key] -= f.n;
    this.s.gold -= f.gold;
    it.imps = it.imps.slice();
    it.imps[slot] = { k: key, s: e.s | 0, sk: e.sk, g: e.g | 0, sp: Math.max(0, Math.min(2, spIdx | 0)), d: f.keep, q: IM.rollQual(this.rng) };   // v298 품질은 새로 굴린다 · 대성은 사라진다
    this._stats = null; this._mods = null; this._isp = null;
    this.mark('infuse');
    this.emit('infuse', { item: it, ok: true, rewrite: true, slot });
    this.resNote(res0);
    return it.imps[slot];
  }
  // ---------- v384 간단 각인 — 기운 하나 · 각인 Lv 하나 · 「올리기」가 다음 할 일을 고른다 ----------
  // 각인 Lv = 등급(유니크 1 · 전설 2 · 신화 3) + (단 - 1) → 0~12 (신화 10단이 12). 수치 셈(imprintOf)은 그대로다.
  impLv(it) { const e = IM.normEntry(it?.imps?.[0]); return e ? Math.min(3, it.rar || 0) + IM.danOf(e) - 1 : 0; }
  // 이 칸이 노리는 기운 — 고른 것 · 없으면 지금 새겨진 것
  // v407 각성 고수 — 5차를 마치고 그 고수를 한 번 쓰러뜨렸으면 열린다 · 두목 방에서 켜고 끈다
  awakenRoom(id) { const a = W.AWAKEN[id]; if (!a) return null; if (a.king) { const z = Object.keys(W.ZONES_W).find((k) => W.ZONES_W[k]?.king?.no === a.king); return z ? W.mapId(+z, W.BOSS_AREA) : null; } return W.mapId(W.masterZoneOf(id), W.BOSS_AREA); }
  awakenBeaten(id) { const a = W.AWAKEN[id]; return a?.king ? (this.s.bossKills?.[this.awakenRoom(id)] || 0) > 0 : !!this.s.duel.won[id]; }
  awakenOpen(id) { return !!W.AWAKEN[id] && this.cheonmaOn() && this.awakenBeaten(id); }
  awakenActive(id) { return this.awakenOpen(id) && !!this.s.awk?.on?.[id]; }
  setAwaken(id, on) {
    if (!this.awakenOpen(id)) return false;
    this.s.awk.on = { ...this.s.awk.on };
    if (on) this.s.awk.on[id] = true; else delete this.s.awk.on[id];
    // v432 서 있는 두목은 그대로 두고 다음에 서는 두목부터 바뀐다 — 전엔 두목을 지우고 바로 새로 세워(대기 시간 0)
    //   켜기·끄기를 거듭하면 두목이 0.1초마다 새로 섰고, 지운 두목은 과녁으로 남아 맞기만 하다 보상까지 줬다
    return true;
  }
  awakenReward(id, first = false) {
    const a = W.AWAKEN[id], room = W.mapOf(this.awakenRoom(id)), k = first ? W.AWAKEN_FIRST_K : 1;
    return { gold: Math.round(W.mobGold(Math.min(room?.lv?.[1] || 150, 150)) * a.gold * k), mats: { [G.stoneKey(G.PALMA_ZONE)]: a.stone * k, [W.bossKey(room?.zone ?? W.masterZoneOf(id))]: a.mark * k }, petShard: a.shard * k, mountShard: a.shard * k };
  }
  // v403 「지금 뭘 올리면 제일 세지나」 — 낀 장비의 강화·각인·초월을 한 번씩 해 본 판(복제)에서 전투력이 은자 값 대비 가장 많이 오르는 것.
  //   성공 확률은 1로 보고(기대값이 아니라 '올리면'), 은자가 모자란 것은 빼며, 10초마다 한 번만 센다
  upgradeTip(now = Date.now()) {
    const sig = `${this.statSig?.() || ''}|${Math.floor(Math.log10(this.s.gold + 1) * 20)}|${Object.keys(this.s.mats).length}`;
    if (this._tip && this._tip.sig === sig && now - this._tip.at < 10e3) return this._tip.v;
    const base = this.power();
    let best = null;
    const raw = JSON.stringify(this.s);
    const tries = [];
    // v411 성공 확률(p)을 함께 — 기대값 = 오를 몫 × p, 한 번 시도 값은 그대로(실패해도 낸다)
    for (const x of W.SLOTS) {
      const it = this.s.equip[x.id];
      if (!it) continue;
      if (this.canEnhance(it) && this.s.gold > this.enhanceCost(it)) tries.push({ kind: 'enh', slot: x.id, uid: it.uid, name: `${x.name} 강화`, p: this.enhanceRateOf(it) });
      if (this.canImprintItem(it)) { const nx = this.impNext(it); if (nx.can) tries.push({ kind: 'imp', slot: x.id, uid: it.uid, name: `${x.name} 각인`, p: nx.chance != null ? Math.min(1, nx.chance) : 1 }); }
      if (this.canTransItem(it) && this.canTranscend(it)) tries.push({ kind: 'trans', slot: x.id, uid: it.uid, name: `${x.name} 초월`, p: this.transInfo(it)?.rate ?? 1 });
    }

    for (const t of tries) {
      try {
        const c = new WorldGame(JSON.parse(raw), now);
        c.rng = () => 0; c.emit = () => {};
        const g0 = c.s.gold;
        const r = t.kind === 'enh' ? c.enhance(t.uid, true) : t.kind === 'imp' ? c.impUp(t.uid) : c.transcend(t.uid);   // v421 무공은 따로(wui 한 줄) — 죽은 가지 정리
        if (!r) continue;
        c._stats = null; c._mods = null;
        const gain = c.power() / base - 1, cost = Math.max(1, g0 - c.s.gold);
        if (!(gain > 0.0005)) continue;
        const ev = gain * (t.p ?? 1);
        const score = ev / Math.max(cost, this.s.gold * 0.01);
        if (!best || score > best.score) best = { ...t, gain, ev, cost, score };
      } catch { /* 해 볼 수 없는 것은 건너뛴다 */ }
    }
    this._tip = { sig, at: now, v: best };
    return best;
  }
  // v403 고른 기운의 증표가 바닥나 막힌 칸 — 가진 증표가 가장 많은 기운(30개 이상)과 함께. 각인 칸 짚기(v402)·자동 각인 알림이 같이 쓴다
  impStuck() {
    const tot = {};
    for (const [k, v] of Object.entries(this.s.mats)) if (W.isMarkKey(k) && v > 0) { const t = IM.themeOfZone(+k.slice(1)); tot[t] = (tot[t] || 0) + v; }
    const best = Object.entries(tot).sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] < 30) return null;
    const slots = W.SLOTS.map((x) => this.s.equip[x.id]).filter((it) => it && this.canImprintItem(it)).filter((it) => { const nx = this.impNext(it); return !nx.can && nx.kind !== 'max' && this.impThemeOf(it) !== best[0]; });
    return slots.length ? { theme: best[0], have: best[1], slots } : null;
  }
  impThemeOf(it) { const e = IM.normEntry(it?.imps?.[0]); return this.s.impTheme?.[it?.slot] || (e ? IM.themeOfZone(+e.k.slice(1)) : null); }
  setImpTheme(slot, theme) {
    if (!W.SLOTS.some((x) => x.id === slot)) return false;
    if (theme && !(theme in IM.THEMES)) return false;
    this.s.impTheme = { ...(this.s.impTheme || {}) };
    if (theme) this.s.impTheme[slot] = theme; else delete this.s.impTheme[slot];
    return true;
  }
  // 그 기운의 증표 가운데 n개 넘게 가진 가장 센 두목 증표(없으면 null)
  themeMark(theme, n = 1) {
    let best = null;
    for (const [k, v] of Object.entries(this.s.mats)) if (W.isMarkKey(k) && v >= n && IM.themeOfZone(+k.slice(1)) === theme && (!best || W.markLv(k) > W.markLv(best))) best = k;
    return best;
  }
  // 다음에 할 일 — { kind: fill · rare · theme · dan · max · none, key, n, gold, chance, label, can }
  impNext(it) {
    if (!this.canImprintItem(it)) return { kind: 'none', label: '각인할 수 없는 장비', can: false };
    const theme = this.impThemeOf(it);
    const e = IM.normEntry(it.imps?.[0]);
    const rar = it.rar || 0;
    const top = W.RARITY.length - 1;
    const pick = (n) => (theme ? this.themeMark(theme, n) : null) || (e && (this.s.mats[e.k] || 0) >= n ? e.k : null);
    const tn = (k) => (k ? W.ZONES_W[+k.slice(1)]?.boss?.name || k : '');
    if (!theme && !e) return { kind: 'none', label: '기운을 먼저 골라요', can: false, need: 'theme' };
    // 레어 — 유니크로 올리며 새긴다
    if (rar === 0) { const n = W.INFUSE_MARKS[1]; const key = pick(n); const f = key ? this.infuseInfo(it, key) : null;
      return { kind: 'rare', key, n, gold: f?.gold ?? W.infuseGold(it.ilv, 1), chance: f?.chance, label: `유니크로 새기기${key ? ` (${tn(key)})` : ''}`, can: !!key && this.canInfuse(it, key) }; }
    // 칸이 비었다 — 새기기
    if (!e) { const n = this.impMarksN(it); const key = pick(n); return { kind: 'fill', key, n, gold: W.infuseGold(it.ilv, rar), label: `새기기${key ? ` (${tn(key)})` : ''}`, can: !!key && this.canFillImp(it, 0, key) }; }
    // 고른 기운과 다르다 — 바꾸기(단은 절반 이어받는다)
    if (theme && IM.themeOfZone(+e.k.slice(1)) !== theme) { const n = this.impMarksN(it); const key = this.themeMark(theme, n); return { kind: 'theme', key, n, gold: W.infuseGold(it.ilv, rar), label: `${IM.THEMES[theme].name} 기운으로 바꾸기`, can: !!key && this.canRewrite(it, 0, key) }; }
    // 단 — 유니크 3단 · 전설 6단 · 신화 10단까지
    const cap = [0, 3, 6, IM.DAN_MAX][Math.min(3, rar)];
    const d = IM.danOf(e);
    if (d < cap) { const f = this.danInfo(it, 0); return { kind: 'dan', key: e.k, n: f.n, gold: f.gold, label: `${d + 1}단으로`, can: this.canDanUp(it, 0) }; }
    if (rar < top) { const n = W.INFUSE_MARKS[rar + 1]; const key = (this.s.mats[e.k] || 0) >= n ? e.k : pick(n); const f = key ? this.infuseInfo(it, key) : null;
      return { kind: 'rare', key, n, gold: f?.gold ?? W.infuseGold(it.ilv, rar + 1), chance: f?.chance, label: `${W.RARITY[rar + 1].name}(으)로`, can: !!key && this.canInfuse(it, key) }; }
    return { kind: 'max', label: '각인 끝(Lv 12)', can: false };
  }
  // 올리기 한 번 — 다음 할 일을 한다. { ok, kind } (등급 올리기는 실패할 수 있다 — 천장이 쌓인다)
  impUp(uid) {
    const it = this.findItem(uid);
    const nx = this.impNext(it);
    if (!nx.can) return null;
    let ok = false;
    if (nx.kind === 'rare') ok = !!this.infuse(uid, nx.key, 0);
    else if (nx.kind === 'fill') ok = !!this.fillImp(uid, 0, nx.key, 0);
    else if (nx.kind === 'theme') ok = !!this.rewriteImp(uid, 0, nx.key, 0);
    else if (nx.kind === 'dan') ok = !!this.danUp(uid, 0);
    return { ok, kind: nx.kind };
  }
  // 할 수 있는 만큼 — 증표·은자가 떨어지거나 끝에 닿을 때까지(최대 40번)
  impMax(uid) {
    const out = { n: 0, ok: 0, fail: 0 };
    for (let i = 0; i < 40; i++) { const r = this.impUp(uid); if (!r) break; out.n++; if (r.ok) out.ok++; else out.fail++; }
    return out;
  }
  // 낀 장비 모두 한 번씩 돌며 할 수 있는 만큼
  impAll() {
    const out = { n: 0, ok: 0, fail: 0 };
    for (let round = 0; round < 40; round++) {
      let any = false;
      for (const x of W.SLOTS) { const it = this.s.equip[x.id]; if (!it) continue; const r = this.impUp(it.uid); if (r) { any = true; out.n++; if (r.ok) out.ok++; else out.fail++; } }
      if (!any) break;
    }
    return out;
  }

  // 공명 단계가 바뀌었으면 알린다
  resNote(before) {
    const after = this.resonance();
    for (const [t, r] of Object.entries(after.by)) {
      const was = before.by[t]?.tier ?? -1;
      if (r.tier > was) this.emit('resonance', { theme: t, tier: r.tier, n: r.n, up: true });
    }
    for (const [t, r] of Object.entries(before.by)) if (r.tier >= 0 && (after.by[t]?.tier ?? -1) < r.tier) this.emit('resonance', { theme: t, tier: after.by[t]?.tier ?? -1, n: after.by[t]?.n || 0, up: false });
  }
  // v213: 계열 각인(setLine)을 없앴다 — 이미 붙인 계열(it.line)의 수치·덤은 그대로 남는다

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
    lack.push(...this.matsLack(r.mats));
    if (this.s.gold < r.gold) lack.push('gold');
    if (this.s.level < G.KING_LV) lack.push('level');
    if (st.job && st.job !== this.s.job) lack.push('job');
    return { r, ok: !lack.length, lack };
  }
  craftSet(setId, slot) {
    const { r, ok } = this.setCheck(setId, slot);
    if (!ok) return null;
    this.matsPay(r.mats);
    this.s.gold -= r.gold;
    const it = this.makeKing(slot, G.SLOT_KING[slot], W.rollRarity(W.CRAFT_RAR_W, this.rng), setId);
    this.emit('craft', { item: it });
    this.gainItem(it, true);
    return it;
  }
  // 강화석 만들기 — 후반 왕의 재료 40개로 그 왕의 강화석 하나 (v132)
  // v273 그 왕 재료 40개어치 현철(그 왕 지역 가중치)
  stoneOre(z) { return W.oreOf(z, G.STONE_FROM_MATS).n; }
  canMakeStone(z, n = 1) { return !!G.STONES[z] && (this.s.mats[W.ORE] || 0) >= this.stoneOre(z) * n; }
  makeStone(z, n = 1) {
    n = Math.min(n, Math.floor((this.s.mats[W.ORE] || 0) / this.stoneOre(z)));
    if (!G.STONES[z] || n <= 0) return 0;
    this.s.mats[W.ORE] -= this.stoneOre(z) * n;
    this.addMats(G.stoneKey(z), n);
    this.s.stoneMade = { ...(this.s.stoneMade || {}), [G.stoneKey(z)]: (this.s.stoneMade?.[G.stoneKey(z)] || 0) + n };   // v399 되돌릴 수 있는 몫(만든 것만)
    return n;
  }
  // v399 만든 강화석을 현철로 되돌린다 — 두목이 떨군 것은 안 된다(현철 공장이 되지 않게). 고르지 못하고 한꺼번에 만들어진 것을 무를 수 있게.
  stoneRefundable(z) { const k = G.stoneKey(z); return Math.min(this.s.stoneMade?.[k] || 0, this.s.mats[k] || 0); }
  unmakeStone(z, n = 1) {
    const k = G.stoneKey(z);
    n = Math.min(n, this.stoneRefundable(z));
    if (!G.STONES[z] || n <= 0) return 0;
    this.s.mats[k] -= n;
    this.s.stoneMade = { ...this.s.stoneMade, [k]: this.s.stoneMade[k] - n };
    this.addMats(W.ORE, this.stoneOre(z) * n);
    return n;
  }
  // 공용 장신구 — 아무 왕의 재료로
  kaccCheck(z, slot) {
    if (!W.kingOf(z) || !G.KACC_SLOTS.includes(slot)) return { ok: false, lack: ['king'] };
    const r = G.kaccRecipe(z, slot);
    const lack = [];
    lack.push(...this.matsLack(r.mats));
    if (this.s.gold < r.gold) lack.push('gold');
    if (this.s.level < G.KING_LV) lack.push('level');
    return { r, ok: !lack.length, lack };
  }
  craftKacc(z, slot) {
    const { r, ok } = this.kaccCheck(z, slot);
    if (!ok) return null;
    this.matsPay(r.mats);
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
  gainItem(it, made = false) {   // made: 대장장이에서 만든 것(자동 정리하지 않는다)
    const cur = this.s.equip[it.slot];
    // 세트 조각을 끼고 있으면 다른 것으로 저절로 바꾸지 않는다 (세트 효과가 깨진다)
    if (cur?.set && !(it.set === cur.set)) return this.stash(it, made);
    if (this.itemScore(it) > this.itemScore(cur)) {
      this.s.equip[it.slot] = it;
      this.emit('equip', { item: it, auto: true });
      if (cur) this.stash(cur, true);   // 벗은 것은 남긴다(직접 팔기)
      this._stats = null;
      return 'equip';
    }
    return this.stash(it, made);
  }
  // v321 자동 정리 — '약한 것 팔기'와 같은 잣대: 낀 것보다 못하고 · 강화 안 했고 · 전설 아래 · 세트·성장 장비가 아니면
  isJunk(it) {
    const cur = this.s.equip[it?.slot];
    return !!it && !!cur && !it.grow && !it.set && !(it.plus > 0) && !((it.rar || 0) >= 2) && this.itemScore(it) < this.itemScore(cur);
  }
  stash(it, keep = false) {
    // v321 켜 두면 떨어지는 대로 판다(가방에 넣지 않는다) — 방치 중 가방이 차지 않게. 만든 것·벗은 것은 남긴다
    if (!keep && this.s.autoJunk && this.isJunk(it)) {
      const p = this.sell(it, true);
      const j = this.s.junkLog || (this.s.junkLog = { n: 0, gold: 0 });
      j.n++; j.gold += p;
      this.emit('autoJunk', { item: it, gold: p });
      return 'sold';
    }
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
  // v349 계정 창고 — 내 무인 넷이 함께 쓴다(창고 자체는 vault.js가 기기·서버에 둔다).
  //   넣기: 가방의 장비(낀 것·성장 장비 빼고)를 빼서 그대로 준다 · 꺼내기: 새 번호를 붙여 가방에(무인마다 번호가 따로 매겨져 겹친다)
  vaultTakeOut(uid) {
    const i = this.s.bag.findIndex((x) => x.uid === uid);
    if (i < 0 || this.s.bag[i].grow) return null;
    const it = this.s.bag.splice(i, 1)[0];
    return JSON.parse(JSON.stringify(it));
  }
  vaultPutIn(it) {
    if (!it || this.s.bag.length >= this.s.bagSize) return false;
    const x = JSON.parse(JSON.stringify(it));
    x.uid = uidSeq++;
    this.s.bag.push(x);
    return x;
  }
  sell(it, auto = false) {
    if (it?.grow) return 0;                 // 성장 장비는 칸마다 하나 — 팔지 않는다 (v158)
    // 조합 장비: 만들 때 든 것의 1/4 (재료도 돌아온다) · 그 밖: 은자
    const back = W.sellBack(it);
    // v258: 공유로 이어받은 강화는 값에 넣지 않는다(성장 장비 몫)
    const own = Math.max(0, (it.plus || 0) - this.sharedPlus(it));
    const p = back ? back.gold : W.sellPrice({ ...it, plus: own });
    if (back) for (const [k, n] of Object.entries(back.mats)) this.addMats(k, n);
    this.s.gold += p;
    if (!auto) this.s.bag = this.s.bag.filter((x) => x.uid !== it.uid);
    if (auto) this.note(0, 0, p, 0);   // v432 사냥 중 저절로 판 것만 벌이에 — 손으로 판 돈까지 넣어 끄기 전에 가방을 팔면 방치 은자가 몇 배로 불었다
    return p;
  }
  // v385 팔면 얼마 — 팔기 전에 보여 주려고(바꾸지 않는다)
  sellValue(it) {
    if (!it || it.grow) return 0;
    const back = W.sellBack(it);
    return back ? back.gold : W.sellPrice({ ...it, plus: Math.max(0, (it.plus || 0) - this.sharedPlus(it)) });
  }
  // v385 골라 팔기 — 가방에서 고른 것만(성장 장비는 빼고)
  sellMany(uids) {
    const want = new Set(uids);
    let gold = 0, n = 0;
    for (const it of this.s.bag.slice()) if (want.has(it.uid) && !it.grow) { gold += this.sell(it); n++; }
    if (n) this.mark('pickSell');   // v394 길잡이
    return { n, gold };
  }
  sellBagBelow(grade) {
    let sum = 0;
    for (const it of this.s.bag.slice()) if (it.grade <= grade && !((it.plus || 0) > this.sharedPlus(it))) sum += this.sell(it);
    return sum;
  }
  equipFromBag(uid) {
    const i = this.s.bag.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    const it = this.s.bag.splice(i, 1)[0];
    const cur = this.s.equip[it.slot];
    // v386 대성신장끼리 바꿔 끼면 강화를 맞바꾼다(더 높은 강화가 새 조각으로) — 같은 부위를 더 좋은 등급으로 받아도 강화가 날아가지 않게
    if (G.isPalma(it) && G.isPalma(cur) && (cur.plus || 0) > (it.plus || 0)) { const t = it.plus || 0; it.plus = cur.plus; cur.plus = t; const te = it.epity || 0; it.epity = cur.epity || 0; cur.epity = te; this.emit('palmaCarry', { item: it, plus: it.plus }); }
    this.s.equip[it.slot] = it;
    if (cur) this.s.bag.push(cur);
    this._stats = null;
    this.heroHp = Math.min(this.heroHp, this.stats().hp);
    return true;
  }
  // v317 끼면 어떻게 되나 — 그 칸에 잠깐 넣어 본 온 능력치(세트·공명·각인 모두 든다)와 지금을 견준다. 아무것도 바꾸지 않는다
  previewEquip(it) {
    const pick = (st) => ({ atk: st.atk, hp: st.hp, def: st.def, crit: st.crit, speed: st.speed, power: st.power });
    const st0 = this.stats();
    const now = pick(st0);
    const sets0 = this.setCounts();
    if (!it || !W.SLOTS.some((x) => x.id === it.slot) || this.s.equip[it.slot] === it) return { now, then: now, same: true, sets0, sets1: sets0 };
    const cur = this.s.equip[it.slot];
    this.s.equip[it.slot] = it; this._stats = null; this._setb = null;
    let then, sets1;
    // v318 되돌린 뒤 지금 능력치를 그대로 둔다(서명이 같다) — 가방 칸마다 부를 때 다시 세지 않게 · v378 세트 조각 수도
    try { then = pick(this.stats()); sets1 = this.setCounts(); } finally { this.s.equip[it.slot] = cur; this._stats = st0; this._setb = null; }
    return { now, then, same: false, sets0, sets1 };
  }
  findItem(uid) {
    return Object.values(this.s.equip).find((x) => x?.uid === uid) || this.s.bag.find((x) => x.uid === uid) || null;
  }
  // v375 대성신장의 가락지·귀걸이는 다른 부위처럼(반 확률·세 배 값·+10 끝이 아니다)
  hardAcc(it) { return W.isDropOnly(it?.slot) && !G.isPalma(it); }
  enhanceCost(it) { return W.enhanceCost(it.ilv, it.plus || 0) * (this.hardAcc(it) ? W.ACC2_COST : 1); }
  // 강화 재료: 조합 장비는 그 지역 재료 (옛 장비·수련용은 은자만)
  enhanceMats(it) {
    if (it.king != null) {                                                                // 왕의 장비: 후반 왕의 부위별 강화석 (v132)
      const key = G.stoneFor(it), n = G.stoneN(it.plus || 0);
      // v173: 검왕의 검혼석은 만능 — 그 부위 강화석이 모자라면 대신 든다 (승급이 없어져 쓸 데가 없어진 돌)
      if ((this.s.mats[key] || 0) < n && (this.s.mats.st27 || 0) >= n) return { key: 'st27', n };
      return { key, n };
    }
    if (it.step == null) return null;
    return { key: W.ORE, n: W.enhanceMatsN(it.plus || 0) * W.matWeight(W.itemZone(it)) };   // v273 현철 — 장비 지역 가중치만큼
  }
  // 조합·왕의 장비는 +10 위로 돌파(+15까지) — 두목 증표가 더 든다. 옛 장비·가락지·귀걸이는 +10까지.
  enhanceMaxItem(it) { return (it?.step != null || it?.king != null) && !this.hardAcc(it) ? W.ENHANCE_MAX : W.ENHANCE_NORMAL; }
  // v261: 장비가 갈 수 있는 끝과 레벨 상한 중 낮은 쪽
  enhanceMax(it) { return Math.min(this.enhanceMaxItem(it), W.enhanceLvCap(this.s.level)); }
  breakMarksOf(it) { return it?.step != null && !W.isDropOnly(it.slot) ? W.breakMarks(it.plus || 0) : 0; }   // 왕의 장비는 강화석 수에 들어 있다
  enhanceBaseRate(it) { return W.enhanceRate(it.plus || 0) * (this.hardAcc(it) ? W.ACC2_RATE : 1); }
  // v192 천장: 실패가 쌓인 만큼 더한다
  enhanceRateOf(it) { return Math.min(1, this.enhanceBaseRate(it) + (it.epity || 0)); }
  // v272 강화 재료는 지역을 가리지 않는다 — 레벨이 오르면 성장 장비가 다음 지역 재료를 받아서, 모아 둔 재료가 2:1 변환으로 반 토막 났다.
  //   일반 지역 재료(숫자 열쇠)는 모두 1:1로 같이 센다(낮은 지역부터 쓴다). 왕 강화석·증표·세력 재료는 그대로 따로.
  isZoneMat(key) { return W.isZoneMatKey(key); }
  enhanceMatHave(m) { return m ? this.s.mats[m.key] || 0 : 0; }
  payEnhanceMats(m) { if (m) this.s.mats[m.key] -= m.n; }
  canEnhance(it) {
    if (!it || (it.plus || 0) >= this.enhanceMax(it) || this.s.gold < this.enhanceCost(it)) return false;
    const m = this.enhanceMats(it);
    if (m && this.enhanceMatHave(m) < m.n) return false;
    const bm = this.breakMarksOf(it);
    return !bm || !!this.breakMarkKey(it, bm);
  }
  // v262: 돌파에 드는 두목 증표 — 그 지역 증표가 모자라면 십이지왕 증표(가진 것이 가장 많은 것)로 대신한다.
  //   99 뒤 성장 장비는 천외천 증표(b15)만 받는데, 왕 구역에서 사냥하면 b15가 안 나와 +12에서 막혔다.
  breakMarkKey(it, bm = this.breakMarksOf(it)) {
    const m = this.enhanceMats(it);
    if (!m || !bm) return null;
    const iz = W.itemZone(it);
    const own = W.bossKey(iz);
    if ((this.s.mats[own] || 0) >= bm) return own;
    if (it.step == null) return null;
    // v273: v272의 '앞 지역 증표로 돌파'는 뺐다 — 등급 각인에 쓸 증표를 돌파가 먹어 성장이 늦었다(시뮬 Lv150 12일 → 15일+).
    //   지난 지역 증표는 등급 각인에 쓴다(버려지지 않는다).
    let best = null, n = 0;
    if ((this.s.level || 0) < 99) return null;
    for (let z = W.NORMAL_ZONES + 1; z <= W.ZONE_COUNT; z++) { const k = W.bossKey(z); const v = this.s.mats[k] || 0; if (v >= bm && v > n) { best = k; n = v; } }
    return best;
  }
  // v192: 실패하면 +7까지 그대로 · +8~10 -1 · +11부터 -2(useProt면 보호부 하나로 그대로). 실패마다 천장(it.epity)이 쌓인다. 결과는 this.lastEnhance에도 남긴다.
  enhance(uid, useProt = true) {
    const it = this.findItem(uid);
    this.adoptShared(it);
    if (!this.canEnhance(it)) return null;
    this.tday('enhance');
    const cost = this.enhanceCost(it);
    const mats = this.enhanceMats(it);
    this.s.gold -= cost;
    if (mats) this.payEnhanceMats(mats);
    const bm = this.breakMarksOf(it);
    if (bm) { const bk = this.breakMarkKey(it, bm); if (bk) this.s.mats[bk] -= bm; }
    const lv = it.plus || 0;
    const ok = this.rng() < this.enhanceRateOf(it);
    const r = { ok, from: lv, drop: 0, broke: false, prot: false };
    if (ok) { it.plus = lv + 1; it.epity = 0; }
    else {
      it.epity = Math.min(1, (it.epity || 0) + this.enhanceBaseRate(it) * W.ENH_PITY_K);
      r.pity = it.epity;
      const f = W.enhanceFail(lv);
      // v254: 세트·왕의 장비는 공유 강화 아래로는 안 떨어진다(어차피 다시 이어받는다) — 그만큼만 떨어지고,
      //   실제로 떨어질 게 없으면 보호부도 안 쓴다(전엔 되돌려질 하락을 막느라 보호부가 탔다)
      const to = f ? Math.max(this.sharedPlus(it), Math.max(0, lv + f)) : lv;
      if (to < lv && W.enhanceRisky(lv) && useProt && (this.s.prot || 0) > 0) { this.s.prot--; r.prot = true; }
      else if (to < lv) { r.drop = to - lv; it.plus = to; }
    }
    this._stats = null;
    this.lastEnhance = r;
    this.emit('enhance', { item: it, ...r });
    return ok;
  }
  // v386 간단 강화 — 낀 장비 모두를 target까지(낮은 칸부터 · 돌파 +10 위는 직접). 물약 값은 남긴다.
  enhAll(target = W.AUTO_ENH_MAX) {
    const t = Math.max(1, Math.min(W.AUTO_ENH_MAX, target | 0));
    const reserve = this.potionPrice() * 60;
    const out = { n: 0, ok: 0, fail: 0 };
    for (let i = 0; i < 300; i++) {
      const it = W.SLOTS.map((x) => this.s.equip[x.id]).filter((x) => x && this.effPlus(x) < t && this.canEnhance(x) && this.s.gold - this.enhanceCost(x) > reserve)
        .sort((a, b) => this.effPlus(a) - this.effPlus(b))[0];
      if (!it) break;
      const r = this.enhance(it.uid, true);
      if (r == null) break;
      out.n++; if (r) out.ok++; else out.fail++;
    }
    this.mark('enhAll');   // v394 길잡이 — 눌러 보면 된다(이미 다 올라 있어도 막히지 않게)
    return out;
  }
  // ---------- v393 초월 — +15(그 장비의 끝)까지 다 한 신화 장비 ----------
  canTransItem(it) { return !!it && (it.rar || 0) >= 3 && (it.plus || 0) >= this.enhanceMaxItem(it) && this.enhanceMaxItem(it) >= W.ENHANCE_MAX && (it.tr || 0) < W.TRANS_MAX; }
  transMarkKey(n) { let best = null; for (const [k, v] of Object.entries(this.s.mats)) if (W.isMarkKey(k) && v >= n && (!best || W.markLv(k) > W.markLv(best))) best = k; return best; }
  transInfo(it) {
    if (!this.canTransItem(it)) return null;
    const tr = it.tr || 0;
    const markN = W.transMarks(tr);
    return { tr, gold: W.transGold(it.ilv, tr), ore: W.transOre(tr), markN, mark: this.transMarkKey(markN), rate: Math.min(1, W.TRANS_RATE[tr] + (it.tpity || 0)) };
  }
  canTranscend(it) { const f = this.transInfo(it); return !!f && this.s.gold >= f.gold && (this.s.mats[W.ORE] || 0) >= f.ore && !!f.mark; }
  transcend(uid) {
    const it = this.findItem(uid);
    if (!this.canTranscend(it)) return null;
    const f = this.transInfo(it);
    this.s.gold -= f.gold; this.s.mats[W.ORE] -= f.ore; this.s.mats[f.mark] -= f.markN;
    const ok = this.rng() < f.rate;
    if (ok) { it.tr = f.tr + 1; it.tpity = 0; } else it.tpity = Math.min(1, (it.tpity || 0) + W.TRANS_RATE[f.tr] * W.TRANS_PITY_K);
    this._stats = null;
    this.emit('transcend', { item: it, ok, tr: it.tr || 0 });
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
    let n = 1 + W.PET_SLOT_LV.filter((lv) => (this.s.level || 1) >= lv).length;   // v390 레벨 50 · 100에 하나씩
    for (const it of Object.values(this.s.equip)) for (const o of it?.opts || []) if (o.pet) n += o.pet;
    return Math.min(W.PET_SLOT_MAX, n);
  }
  activePets() { return (this.s.pets || []).slice(0, this.petSlots()); }
  gainPet(rar, at, kind) {
    const pet = { uid: uidSeq++, kind: kind || W.PETS[Math.floor(this.rng() * W.PETS.length)].id, rar, lv: 1, exp: 0, q: W.rollPetQual(this.rng), dan: 0 };   // v316 품
    // 키우는 칸이 비었으면 바로 데려가고, 아니면 우리에서 기다린다(바꾸려면 키우던 것을 놓아줘야 한다)
    if (this.s.pets.length < this.petSlots()) this.s.pets.push(pet);
    else if (this.s.petBox.length < W.PET_BOX) this.s.petBox.push(pet);
    else {
      // v258: 우리가 가득 — 전엔 조용히 사라졌다. 우리에서 가장 못한 것보다 나으면 바꾸고, 아니면 놓쳤다고 알린다
      const score = (p) => (p.rar || 0) * 100 + W.petOf(p.kind).tier;
      let wi = 0;
      this.s.petBox.forEach((p, i) => { if (score(p) < score(this.s.petBox[wi])) wi = i; });
      if (score(pet) <= score(this.s.petBox[wi])) { this.emit('petLost', { pet }); return null; }
      const out = this.s.petBox.splice(wi, 1, pet)[0];
      this.emit('petLost', { pet: out, swapped: true });
    }
    this._stats = null;
    this.noteDex();
    if (!this._gachaQuiet) this.emit('petDrop', { pet, at: at ? { x: at.x, y: at.y } : null, joined: this.s.pets.includes(pet) });
    return pet;
  }
  // v262 포획 조각 · 혼
  // v292 두목이 떨구는 조각 — 왕·고수는 두 배
  bossShards(m) {
    const big = this.map.king || this.map.master ? 2 : 1;
    const roll = ([a, b]) => Math.round((a + this.rng() * (b - a)) * big * this.lootK());
    const ps = roll(W.BOSS_SHARDS.pet), ms = roll(W.BOSS_SHARDS.mount);
    this.s.petShard = (this.s.petShard || 0) + ps;
    this.s.mountShard = (this.s.mountShard || 0) + ms;
    this.emit('shards', { pet: ps, mount: ms, at: { x: m.x, y: m.y } });
  }
  addShards(pet, mount) { if (pet) this.s.petShard = (this.s.petShard || 0) + pet; if (mount) this.s.mountShard = (this.s.mountShard || 0) + mount; }
  // ---------- v362 뽑기 ----------
  gachaRoom(kind) { return kind === 'pet' ? Math.max(0, this.petSlots() - this.s.pets.length) + Math.max(0, W.PET_BOX - this.s.petBox.length) : 999; }
  freeGacha(kind, now = Date.now()) { return this.s.gacha[kind].free !== W.gachaDay(now); }   // v368 오늘 무료 한 번
  canGacha(kind, n = 1, free = false) {
    if (free) return this.freeGacha(kind) && this.gachaRoom(kind) >= 1;
    const have = kind === 'pet' ? this.s.petShard || 0 : this.s.mountShard || 0;
    return have >= W.GACHA_COST * n && this.gachaRoom(kind) >= n;
  }
  gacha(kind, n = 1, free = false) {
    if (!this.canGacha(kind, n, free)) return null;
    if (free) { n = 1; this.s.gacha[kind].free = W.gachaDay(); }
    else if (kind === 'pet') this.s.petShard -= W.GACHA_COST * n; else this.s.mountShard -= W.GACHA_COST * n;
    const pick = W.gachaPickup();
    const PK = W.withPickup(W.GACHA_PET_KIND, pick.pet), MT = W.withPickup(W.GACHA_MOUNT, pick.mount);
    const st = this.s.gacha[kind];
    const out = [];
    this._gachaQuiet = true;   // 알림 대신 뽑기 연출이 보여 준다
    for (let i = 0; i < n; i++) {
      st.n++; st.pity++;
      const lastOfTen = n === 10 && i === 9;
      if (kind === 'pet') {
        let rar = W.pickW(W.GACHA_PET_RAR, this.rng);
        if (st.pity >= W.GACHA_PET_PITY) rar = 3;
        if (lastOfTen && !out.some((r) => r.rar >= W.GACHA_PET_TEN) && rar < W.GACHA_PET_TEN) rar = W.pickW(W.GACHA_PET_RAR, this.rng, ([r]) => r >= W.GACHA_PET_TEN);
        const pk = W.pickW(PK, this.rng);
        if (rar === 3) st.pity = 0;
        const pet = this.gainPet(rar, null, pk);
        out.push({ kind: 'pet', id: pk, rar, grade: W.petGachaGrade(pk, rar), pity: rar === 3 && st.pity === 0, pet });
        this.s.gachaLog.push({ t: Date.now(), k: 'pet', id: pk, r: rar, g: W.petGachaGrade(pk, rar) });
      } else {
        const sacred = (k) => { const d = W.mountOf(k); return d.zodiac || d.hard; };
        let id = st.pity >= W.GACHA_MOUNT_PITY ? W.pickW(MT, this.rng, ([k]) => sacred(k)) : W.pickW(MT, this.rng);
        if (lastOfTen && !out.some((r) => W.mountOf(r.id).tier >= W.GACHA_MOUNT_TEN) && W.mountOf(id).tier < W.GACHA_MOUNT_TEN) id = W.pickW(MT, this.rng, ([k]) => W.mountOf(k).tier >= W.GACHA_MOUNT_TEN);
        const d = W.mountOf(id);
        if (sacred(id)) st.pity = 0;
        let dup = null;
        const owned = (d.zodiac || d.hard) && this.s.mounts.find((m) => m.kind === id);
        if (owned) {
          if ((owned.lv || 0) < W.mountLvMax(d)) { owned.lv = (owned.lv || 0) + 1; dup = 'tame'; } else { this.s.mountShard += W.GACHA_DUP_SHARD; dup = 'shard'; }
          this._stats = null;
        } else this.gainMount(id);
        out.push({ kind: 'mount', id, grade: W.mountGachaGrade(d), dup });
        this.s.gachaLog.push({ t: Date.now(), k: 'mount', id, r: 0, g: W.mountGachaGrade(d) });
      }
    }
    this._gachaQuiet = false;
    if (this.s.gachaLog.length > 100) this.s.gachaLog = this.s.gachaLog.slice(-100);
    this.mark('gacha');
    this.noteDex();
    return out;
  }
  canShardPet() { return (this.s.petShard || 0) >= W.PET_SHARD_NEED && !this.map.town; }
  shardPet() {
    if (!this.canShardPet()) return null;
    this.s.petShard -= W.PET_SHARD_NEED;
    return this.gainPet(0, null, W.rollPetKind(this.map.mz || 1, this.rng));
  }
  petSoulCost(p) { return p && p.rar < W.RARITY.length - 1 ? W.PET_SOUL_COST[p.rar] : null; }
  canSoulUp(uid) { const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid); const c = this.petSoulCost(p); return c != null && (this.s.petSoul || 0) >= c; }
  soulUp(uid) {
    const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid);
    if (!this.canSoulUp(uid)) return null;
    this.s.petSoul -= this.petSoulCost(p);
    p.rar++;
    this._stats = null;
    this.noteDex();
    return p;
  }
  // v316 단(段) 수련 — 다 큰(Lv.30) 애완동물을 혼으로. 확률이 있고, 실패하면 혼은 들고 다음 확률이 오른다. 성공하면 가끔 大成(두 단)
  petDanCost(p) { return p && p.lv >= W.PET_LV_MAX && (p.dan || 0) < W.PET_DAN_MAX ? W.petDanSoul(p.dan || 0) : null; }
  canPetDan(uid) { const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid); const c = this.petDanCost(p); return c != null && (this.s.petSoul || 0) >= c; }
  petDan(uid) {
    if (!this.canPetDan(uid)) return null;
    const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid);
    this.s.petSoul -= this.petDanCost(p);
    const chance = W.petDanChance(p.dan || 0, p.danFail || 0);
    if (this.rng() >= chance) {
      p.danFail = (p.danFail || 0) + 1;
      this.emit('petDan', { pet: p, ok: false, chance });
      return { ok: false, pet: p, next: W.petDanChance(p.dan || 0, p.danFail) };
    }
    const great = (p.dan || 0) + 2 <= W.PET_DAN_MAX && this.rng() < W.PET_DAN_GREAT;
    p.dan = (p.dan || 0) + (great ? 2 : 1);
    p.danFail = 0;
    this._stats = null;
    this.mark('petDan');
    this.emit('petDan', { pet: p, ok: true, great });
    return { ok: true, great, pet: p };
  }
  adoptPet(uid) {
    if (this.s.pets.length >= this.petSlots()) return false;
    const i = this.s.petBox.findIndex((p) => p.uid === uid);
    if (i < 0) return false;
    this.s.pets.push(this.s.petBox.splice(i, 1)[0]);
    this._stats = null;
    return true;
  }
  // v312 장착 해제 — 키우던 것을 우리로 돌려보낸다(사라지지 않는다). 우리가 가득이면 못 한다
  canUnequipPet(uid) { return this.s.pets.some((p) => p.uid === uid) && this.s.petBox.length < W.PET_BOX; }
  unequipPet(uid) {
    if (!this.canUnequipPet(uid)) return false;
    const i = this.s.pets.findIndex((p) => p.uid === uid);
    this.s.petBox.push(this.s.pets.splice(i, 1)[0]);
    this._stats = null;
    return true;
  }
  // v312 바꿔 데려가기 — 우리의 것과 키우던 것을 자리 바꿈(칸이 꽉 차도 된다)
  swapPet(boxUid, petUid) {
    const bi = this.s.petBox.findIndex((p) => p.uid === boxUid);
    const pi = this.s.pets.findIndex((p) => p.uid === petUid);
    if (bi < 0 || pi < 0) return false;
    const a = this.s.petBox[bi], b = this.s.pets[pi];
    this.s.petBox[bi] = b; this.s.pets[pi] = a;
    this._stats = null;
    return true;
  }
  // 놓아주기 — 키우던 것은 사라진다(되돌릴 수 없다)
  // v292 놓아주면 혼이 남는다(등급별 + 레벨 10마다 1) — 돌려주는 값: 받은 혼(못 찾으면 0)
  releasePet(uid) {
    const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid);
    if (!p) return 0;
    this.s.pets = this.s.pets.filter((x) => x.uid !== uid);
    this.s.petBox = this.s.petBox.filter((x) => x.uid !== uid);
    const soul = W.petReleaseSoul(p);
    this.s.petSoul = (this.s.petSoul || 0) + soul;
    this._stats = null;
    return soul;
  }
  // v292 별 — 우리에 있는 같은 종을 먹이로 주면 별 하나(최대 다섯). 먹이는 사라진다(혼은 안 남는다)
  starFodder(uid) {
    const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid);
    if (!p) return [];
    // v366 잠근 것은 먹이로 쓰지 않는다 · 모두 별 올리기(_safeFeed)에선 이것보다 등급이 높은 것도
    return this.s.petBox.filter((x) => x.uid !== uid && x.kind === p.kind && !x.lock && (!this._safeFeed || (x.rar || 0) <= (p.rar || 0))).sort((a, b) => (a.rar || 0) - (b.rar || 0) || (a.star || 0) - (b.star || 0) || a.lv - b.lv);
  }
  canStar(uid) { const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid); return !!p && (p.star || 0) < W.PET_STAR_MAX && this.starFodder(uid).length > 0; }
  starUp(uid) {
    if (!this.canStar(uid)) return null;
    const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid);
    const f = this.starFodder(uid)[0];
    this.s.petBox = this.s.petBox.filter((x) => x.uid !== f.uid);
    p.star = (p.star || 0) + 1;
    if ((f.q || 0) > (p.q || 0)) { p.q = f.q; this.emit('petQualUp', { pet: p }); }   // v316 먹이의 품이 더 높으면 물려받는다
    this._stats = null;
    this.mark('petStar');
    this.emit('petStar', { pet: p });
    return p;
  }
  // v319 모두 먹이기 — 우리의 같은 종을 못한 것부터, 별이 다 찰 때까지
  starUpAll(uid) {
    let n = 0;
    while (this.canStar(uid) && n < W.PET_STAR_MAX) { if (!this.starUp(uid)) break; n++; }
    return n;
  }
  // ---------- v366 우리 정리 ----------
  togglePetLock(uid) { const p = [...this.s.pets, ...this.s.petBox].find((x) => x.uid === uid); if (!p) return null; p.lock = !p.lock || undefined; return !!p.lock; }
  // 모두 별 올리기 — 종마다 가장 좋은 것(키우는 것 먼저)에게 우리의 같은 종을 못한 것부터 먹인다
  autoStarAll() {
    const all = [...this.s.pets, ...this.s.petBox];
    const score = (p) => (this.s.pets.includes(p) ? 1e6 : 0) + (p.rar || 0) * 1e4 + (p.star || 0) * 1e3 + (p.dan || 0) * 100 + p.lv;
    let n = 0;
    for (const kind of new Set(all.map((p) => p.kind))) {
      const host = all.filter((p) => p.kind === kind).sort((a, b) => score(b) - score(a))[0];
      if (host) { this._safeFeed = true; try { n += this.starUpAll(host.uid); } finally { this._safeFeed = false; } }
    }
    return n;
  }
  // 일괄 놓아주기 — 우리에서 그 등급 이하(잠근 것 · 종마다 가장 좋은 하나는 남긴다)
  bulkReleasePreview(maxRar) {
    const keep = new Set();
    for (const kind of new Set([...this.s.pets, ...this.s.petBox].map((p) => p.kind))) {
      if (this.s.pets.some((p) => p.kind === kind)) continue;
      const best = this.s.petBox.filter((p) => p.kind === kind).sort((a, b) => (b.rar || 0) - (a.rar || 0) || (b.star || 0) - (a.star || 0) || b.lv - a.lv)[0];
      if (best) keep.add(best.uid);
    }
    return this.s.petBox.filter((p) => !p.lock && (p.rar || 0) <= maxRar && !keep.has(p.uid));
  }
  bulkRelease(maxRar) {
    const list = this.bulkReleasePreview(maxRar);
    let soul = 0;
    for (const p of list) soul += this.releasePet(p.uid);
    return { n: list.length, soul };
  }
  // ---------- v292 도감 ----------
  noteDex() {
    const pd = this.s.petDex || (this.s.petDex = {});
    for (const p of [...this.s.pets, ...this.s.petBox]) pd[p.kind] = Math.max(pd[p.kind] ?? -1, p.rar || 0);
    const md = this.s.mountDex || (this.s.mountDex = {});
    for (const m of this.s.mounts) md[m.kind] = 1;
  }
  compDexBonus() {   // (dexBonus는 견문록 경험치 — 이름이 겹치지 않게)
    const pd = this.s.petDex || {};
    let b = 0;
    for (const v of Object.values(pd)) b += (v + 1) * W.PET_DEX_K;
    return b + Object.keys(this.s.mountDex || {}).length * W.MOUNT_DEX_K;
  }
  dexCounts() {
    const pd = this.s.petDex || {};
    return { pet: Object.keys(pd).length, myth: Object.values(pd).filter((v) => v >= W.RARITY.length - 1).length, mount: Object.keys(this.s.mountDex || {}).length };
  }
  dexGoalList(kind) { return kind === 'pet' ? W.PET_DEX_GOALS : kind === 'myth' ? W.PET_DEX_MYTH_GOALS : W.MOUNT_DEX_GOALS; }
  canDexGoal(kind, i) { const g = this.dexGoalList(kind)[i]; return !!g && this.dexCounts()[kind] >= g.n && !(this.s.dexGoals?.[kind] || []).includes(i); }
  claimDexGoal(kind, i) {
    if (!this.canDexGoal(kind, i)) return null;
    const g = this.dexGoalList(kind)[i];
    (this.s.dexGoals[kind] || (this.s.dexGoals[kind] = [])).push(i);
    if (g.soul) this.s.petSoul = (this.s.petSoul || 0) + g.soul;
    this.addShards(g.petShard || 0, g.mountShard || 0);
    this.emit('dexGoal', { kind, goal: g });
    return g;
  }
  dexGoalsReady() { return ['pet', 'myth', 'mount'].reduce((a, k) => a + this.dexGoalList(k).filter((_, i) => this.canDexGoal(k, i)).length, 0); }
  // ---------- v292 탈것 조각 · 길들이기 ----------
  canShardMount() { return (this.s.mountShard || 0) >= W.MOUNT_SHARD_NEED && !this.map.town; }
  shardMount() {
    if (!this.canShardMount()) return null;
    this.s.mountShard -= W.MOUNT_SHARD_NEED;
    return this.gainMount(W.rollMount(this.rng, this.map.mz || 1, false), null);
  }
  tameCost(uid) { const m = this.s.mounts.find((x) => x.uid === uid); const d = m && W.mountOf(m.kind); return d && (m.lv || 0) < W.mountLvMax(d) ? W.mountTameCost(d.tier, m.lv || 0, !!d.hard) : null; }
  canTame(uid) { const c = this.tameCost(uid); return !!c && (this.s.mountShard || 0) >= c.shard && this.s.gold >= c.gold; }
  tame(uid) {
    if (!this.canTame(uid)) return null;
    const c = this.tameCost(uid);
    const m = this.s.mounts.find((x) => x.uid === uid);
    this.s.mountShard -= c.shard; this.s.gold -= c.gold;
    m.lv = (m.lv || 0) + 1;
    this._stats = null;
    this.mark('tame');
    return m;
  }
  petExp(n) {
    for (const p of this.activePets()) {
      if (p.lv >= W.PET_LV_MAX) {
        // v262: 다 큰 애완동물이 받던 경험치는 버려졌다 — 혼으로 모은다
        this.s.petSoulExp = (this.s.petSoulExp || 0) + n;
        const per = W.petExpToNext(W.PET_LV_MAX);
        if (this.s.petSoulExp >= per) { const k = Math.floor(this.s.petSoulExp / per); this.s.petSoul = (this.s.petSoul || 0) + k; this.s.petSoulExp -= k * per; }
        continue;
      }
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
      // 애완동물 기술 (v206): 몇 초마다 과녁 둘레를 한꺼번에 — 등급이 높을수록 자주(레어 8초 → 신화 5.6초)
      this.petSkT = this.petSkT || [];
      this.petSkT[i] = (this.petSkT[i] ?? W.PET_SKILL_SEC * (0.5 + i * 0.3)) - W.PET_ATK_SEC;
      if (this.petSkT[i] <= 0) {
        this.petSkT[i] = W.petSkillSec(p);
        const R = W.petSkillR(p);
        const at = p.kind === 'yellow' ? { x: this.heroX, y: this.heroY } : { x: t.x, y: t.y };
        this.emit('petSkill', { i, kind: p.kind, rar: p.rar || 0, at, r: R });
        if (!this.s.did?.petSkill) this.mark('petSkill');
        const base = st.atk * W.petAtkRatio(p) * W.PET_SKILL_MULT;
        const hit = [];
        for (const m of this.mons) {
          if (!m.alive || m.npc || m.introT > 0 || Math.hypot(m.x - at.x, (m.y - at.y) * 0.75) > R) continue;
          hit.push(m);
          const c2 = p.kind === 'tiger' || this.rng() < st.crit;
          const k = p.kind === 'tiger' ? 1.3 : 1;
          const one = Math.max(1, base * k * (c2 ? st.critDmg : 1) - m.armor * 0.5);
          if (p.kind === 'monkey') { for (let n = 0; n < 3 && m.alive; n++) this.hurt(m, one * 0.5, 'pet', c2, n > 0); }
          else this.hurt(m, one, 'pet', c2);
          // v365 종마다 고유 효과
          if (!m.alive) continue;
          if (p.kind === 'fox') this.addDot(m, base * 0.8, 3);
          else if (p.kind === 'phoenix') this.addDot(m, base * 1.2, 4);
          else if (p.kind === 'qilin') m.stun = Math.max(m.stun || 0, m.isBoss ? 0.4 : 1.2);
          else if (p.kind === 'haetae') m.slow = Math.max(m.slow || 0, 3);
        }
        if (p.kind === 'crane' && this.heroHp > 0) { this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.08); this.emit('petBuff', { kind: 'heal', at: { x: this.heroX, y: this.heroY } }); }   // v441 4 → 8%
        if (p.kind === 'turtle') { this.shield = Math.max(this.shield || 0, st.hp * 0.1); this.buffs.shield = Math.max(this.buffs.shield || 0, 6); this.emit('petBuff', { kind: 'shield', at: { x: this.heroX, y: this.heroY } }); }
        if (p.kind === 'yellow') { this.buffs.petMight = 6; this.buffv.petMight = 0.2; this.emit('petBuff', { kind: 'might', at: { x: this.heroX, y: this.heroY } }); }
        if (p.kind === 'dragon') {
          const far = this.mons.filter((m) => m.alive && !m.npc && !(m.introT > 0) && !hit.includes(m) && Math.hypot(m.x - at.x, (m.y - at.y) * 0.75) < 560).slice(0, 5);
          for (const m of far) this.hurt(m, Math.max(1, base * 0.6 - m.armor * 0.5), 'pet', false);
          if (far.length) this.emit('petChain', { from: at, pts: far.map((m) => ({ x: m.x, y: m.y })) });
        }
        return;
      }
      const crit = this.rng() < st.crit;
      const dmg = Math.max(1, st.atk * W.petAtkRatio(p) * (crit ? st.critDmg : 1) - t.armor * 0.5);
      this.emit('petHit', { i, at: { x: t.x, y: t.y } });
      this.hurt(t, dmg, 'pet', crit);
    });
  }

  // ---------- 탈것 (v111) ----------
  gainMount(kind, at) {
    // v415 최고 등급이 같은 종으로 넘치면 조각으로(타고 있는 것·길들인 것은 세지 않는다)
    const md = W.mountOf(kind);
    if (md && md.tier >= W.MOUNT_TOP && !md.zodiac && this.s.mounts.filter((m) => m.kind === kind && !(m.lv > 0)).length >= W.MOUNT_KEEP_TOP) {
      this.s.mountShard = (this.s.mountShard || 0) + W.MOUNT_SPARE_SHARD;
      if (!this._gachaQuiet) this.emit('mountSpare', { kind, shard: W.MOUNT_SPARE_SHARD });
      return { uid: -1, kind, lv: 0, spare: true };
    }
    const mt = { uid: uidSeq++, kind, lv: 0 };
    this.s.mounts.push(mt);
    this.noteDex();
    // 처음 얻었거나 지금 것보다 좋으면 바로 탄다
    const cur = this.mountNow();
    if (!cur || W.mountRank(W.mountOf(kind)) > W.mountRank(cur)) this.s.mount = mt.uid;
    this._stats = null;
    if (!this._gachaQuiet) this.emit('mountDrop', { mount: mt, at: at ? { x: at.x, y: at.y } : null });
    return mt;
  }
  ride(uid) {
    if (uid != null && !this.s.mounts.some((m) => m.uid === uid)) return false;
    this.s.mount = uid;
    this._stats = null;
    return true;
  }
  // 탈것 합성 (v204): 같은 순위 셋(타는 것은 되도록 빼고) + 은자 → 다음 순위 하나. 더 빠르면 바로 탄다.
  fuseCandidates(tier) { return this.s.mounts.filter((m) => W.mountOf(m.kind)?.tier === tier && !W.mountOf(m.kind)?.zodiac); }
  canFuseMounts(tier) {
    return tier < W.MOUNT_TOP && !!W.mountOfTier(tier + 1) && this.fuseCandidates(tier).length >= W.MOUNT_FUSE_N && this.s.gold >= W.mountFuseCost(tier);
  }
  fuseMounts(tier) {
    if (!this.canFuseMounts(tier)) return null;
    const pool = this.fuseCandidates(tier).sort((a, b) => (a.uid === this.s.mount) - (b.uid === this.s.mount));
    const used = pool.slice(0, W.MOUNT_FUSE_N).map((m) => m.uid);
    const carry = Math.floor(Math.max(0, ...pool.slice(0, W.MOUNT_FUSE_N).map((m) => m.lv || 0)) / 2);   // v292 길들인 것의 절반은 이어 간다
    this.s.gold -= W.mountFuseCost(tier);
    this.s.mounts = this.s.mounts.filter((m) => !used.includes(m.uid));
    if (used.includes(this.s.mount)) this.s.mount = null;
    const kind = W.mountOfTier(tier + 1).id;
    const mt = { uid: uidSeq++, kind, lv: carry };
    this.s.mounts.push(mt);
    if (trimTopMounts(this.s)) this.emit('mountSpare', { kind, shard: W.MOUNT_SPARE_SHARD });   // v415
    this.noteDex();
    const cur = this.mountNow();
    if (!cur || W.mountRank(W.mountOf(kind)) > W.mountRank(cur)) this.s.mount = mt.uid;
    this._stats = null;
    this.mark('fuse');
    return mt;
  }
  releaseMount(uid) {
    this.s.mounts = this.s.mounts.filter((m) => m.uid !== uid);
    if (this.s.mount === uid) this.s.mount = null;
    this._stats = null;
  }

  // v435 승급(v110~v172)은 v173에 없앴다 — 남아 있던 canPromote·promote·promoteCost를 지웠다(모든 장비는 증표 각인으로 오른다)

  // ---------- 스킬 레벨 · 스킬 옵션 (v110) ----------
  skillLevel(id) { const m = this.mainSkill?.(); if (m && m.id !== id && this.retiredSkills().some((k) => k.id === id)) return this.s.skillLv?.[m.id] || 1; return this.s.skillLv?.[id] || 1; }   // v444 물러난 무공(삼공합일이 부를 때)은 주력의 레벨로
  canSkillUp(id) {
    const sk = this.skillDef(id);
    const lv = this.skillLevel(id);
    return this.knows(sk) && !this.retired(sk) && lv < W.SKILL_LV_MAX && this.s.skillPts >= W.skillLvCost(lv);
  }
  // 무공 초기화 (v205) — 무공 레벨·심법을 모두 처음으로, 쓴 점수는 다 돌려받는다
  skillResetCost() { return W.skillResetCost(this.s.level, this.s.skillResets || 0); }
  skillSpentAll() {
    let n = 0;
    for (const lv of Object.values(this.s.skillLv || {})) n += W.skillSpent(lv);
    for (const p of this.passiveList()) for (let l = 0; l < this.passLevel(p.id); l++) n += W.passiveCost(p, l);
    return n;
  }
  // ---------- v263 강호 견문록 ----------
  dexZoneDone(zoneId) {
    const z = W.dexZones().find((x) => x.id === zoneId);
    return !!z && z.names.every((n) => (this.s.dex?.[n] || 0) >= W.DEX_NEED);
  }
  // v275 사냥으로 쌓은 영구 공격력·체력 — 숙련도 단계 합 · 견문록 낙관 수 · 다 채운 견문록 지역 수
  huntBonus() {
    if (this._huntB) return this._huntB;
    const mast = Object.entries(this.s.mast || {}).reduce((a, [z, k]) => a + (W.zoneOfW(+z) ? L.masteryLv(k) : 0), 0);
    const stamps = Object.values(this.s.dex || {}).filter((v) => v >= W.DEX_NEED).length;
    const zones = W.dexZones().filter((z) => z.names.every((n) => (this.s.dex?.[n] || 0) >= W.DEX_NEED)).length;
    const m = mast * W.MAST_STAT, d = stamps * W.DEX_STAMP_STAT + zones * W.DEX_ZONE_STAT;
    this._huntB = { mast, stamps, zones, m, d, total: m + d };
    return this._huntB;
  }
  // v275 무공 비급 조각 — n개 얻는다. FRAG_NEED개가 차면 무공 점수로
  gainFrag(n = 1, at = null) {
    if (!(n > 0)) return;
    this.s.frag = (this.s.frag || 0) + n;
    let pts = 0;
    while (this.s.frag >= W.fragNeed(this.s.fragPts)) { this.s.frag -= W.fragNeed(this.s.fragPts); this.s.skillPts = (this.s.skillPts || 0) + 1; this.s.fragPts = (this.s.fragPts || 0) + 1; pts++; }
    this.emit('frag', { n, have: this.s.frag, pts, at });
  }
  dexBonus() {
    if (this._dexZ == null) this._dexZ = W.dexZones().filter((z) => z.names.every((n) => (this.s.dex?.[n] || 0) >= W.DEX_NEED)).length;
    return this._dexZ * W.DEX_ZONE_EXP;
  }
  // ---------- v263 각성 · 깨달음 ----------
  awakenSlots() { const m = this.mainSkill(); return this.skills().filter((k) => /^s[0-3]$/.test(k.id) || k.id === m?.id).map((k) => k.id); }   // v444 주력(승급 무공이어도) · 보조기
  // v311 무공마다 하나 — 아직 아무 무공도 각성하지 않았으면 공짜, 그 뒤로는(새로 붙이기·바꾸기 모두) 은자
  awakenOf(slot) { return this.s.awakens?.[slot] || null; }
  awakenCost() { return Object.keys(this.s.awakens || {}).length ? W.awakenSwapCost(this.s.level) : 0; }
  canAwaken(slot, kind) {
    return this.s.level >= W.AWAKEN_LV && this.awakenSlots().includes(slot) && W.AWAKEN_KINDS.some((k) => k.id === kind)
      && this.awakenOf(slot) !== kind && this.s.gold >= this.awakenCost();
  }
  awaken(slot, kind) {
    if (!this.canAwaken(slot, kind)) return false;
    this.s.gold -= this.awakenCost();
    this.s.awakens = { ...(this.s.awakens || {}), [slot]: kind };
    this._mods = null;
    return true;
  }
  enlLevel(id) { return this.s.enl?.nodes?.[id] || 0; }
  canEnlUp(id) { const lv = this.enlLevel(id); return lv < W.ENL_MAX && (this.s.enl?.pts || 0) >= W.enlCost(lv) && this.skills().some((k) => k.id === id); }
  enlUp(id) {
    if (!this.canEnlUp(id)) return false;
    const lv = this.enlLevel(id);
    this.s.enl.pts -= W.enlCost(lv);
    this.s.enl.nodes[id] = lv + 1;
    this._mods = null;
    return true;
  }
  // v262 차림 두 벌 — 능력치 분배·무공·심법 레벨을 두 벌 적어 두고 갈아 낀다(사냥용·두목용). 바꾸는 값은 없다.
  //   벌을 바꿀 때 지금 것을 지금 벌에 적고, 다른 벌을 낀다. 그 벌이 쓴 점수보다 지금 가진 점수가 많으면 남는 것은 찍을 점수로.
  loadoutSpent(lo) {
    let st = 0; for (const v of Object.values(lo.stats || {})) st += v;
    let sk = 0; for (const lv of Object.values(lo.skillLv || {})) sk += W.skillSpent(lv);
    for (const p of this.passiveList()) for (let l = 0; l < (lo.passLv?.[p.id] || 0); l++) sk += W.passiveCost(p, l);
    return { st, sk };
  }
  snapLoadout() { return { stats: { ...this.s.stats }, skillLv: { ...this.s.skillLv }, passLv: { ...(this.s.passLv || {}) } }; }
  canSwitchLoadout(i) {
    const lo = this.s.loadouts?.[i];
    if (!lo || i === (this.s.loadout || 0)) return false;
    const need = this.loadoutSpent(lo);
    const have = { st: this.s.statPts + Object.values(this.s.stats).reduce((a, b) => a + b, 0), sk: (this.s.skillPts || 0) + this.skillSpentAll() };
    return need.st <= have.st && need.sk <= have.sk;
  }
  switchLoadout(i) {
    const los = this.s.loadouts || (this.s.loadouts = [null, null]);
    const cur = this.s.loadout || 0;
    if (i === cur || i < 0 || i > 1) return false;
    if (!los[i]) { los[cur] = this.snapLoadout(); los[i] = this.snapLoadout(); this.s.loadout = i; return true; }   // 처음엔 지금 것을 그대로 복사
    if (!this.canSwitchLoadout(i)) return false;
    const haveSt = this.s.statPts + Object.values(this.s.stats).reduce((a, b) => a + b, 0);
    const haveSk = (this.s.skillPts || 0) + this.skillSpentAll();
    los[cur] = this.snapLoadout();
    const lo = los[i];
    const need = this.loadoutSpent(lo);
    this.s.stats = { ...this.s.stats, ...lo.stats };
    this.s.skillLv = { ...lo.skillLv };
    this.s.passLv = { ...lo.passLv };
    this.s.statPts = haveSt - need.st;
    this.s.skillPts = haveSk - need.sk;
    this.s.loadout = i;
    this._stats = null; this._mods = null;
    return true;
  }
  canResetSkills() { return this.skillSpentAll() > 0 && this.s.gold >= this.skillResetCost(); }
  resetSkills() {
    if (!this.canResetSkills()) return 0;
    const back = this.skillSpentAll();
    this.s.gold -= this.skillResetCost();
    this.s.skillLv = {};
    this.s.passLv = {};
    this.s.skillPts += back;
    this.s.skillResets = (this.s.skillResets || 0) + 1;
    this._mods = null; this._pm = null; this._stats = null;
    return back;
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
    const key = `${this.statSig()}|${JSON.stringify(this.s.skillLv)}|${JSON.stringify(this.s.enl?.nodes || {})}|${JSON.stringify(this.s.awakens || {})}|${this.s.jobTier}|${this.s.path}`;
    if (!this._mods || this._mods.key !== key) this._mods = { key };
    if (this._mods[id]) return this._mods[id];
    // v256: 길 무공(pa·pb)은 칸 5 — 전엔 +'a'가 NaN이라 장비 스킬 옵션·각인 스킬 변화가 길 무공에 붙지 못했다
    const slot = /^p[ab]$/.test(id) ? 5 : +id.slice(1);
    // v444 주력은 물러난 무공 칸에 붙은 장비 옵션·각인 변화·변초·깨달음도 함께 받는다(장비를 다시 맞추지 않아도 된다)
    const isMain = this.mainSkill()?.id === id;
    const oIds = isMain ? this.retiredSkills().map((k) => k.id) : [];
    const slots = [slot, ...oIds.map((x) => (/^p[ab]$/.test(x) ? 5 : +x.slice(1)))];
    const m = { dmg: 0, range: 0, splash: 0, cd: 0, cost: 0, crit: 0, echo: false, free: false, reset: false, ...W.skillLvMods(slot, this.skillLevel(id)) };
    for (const it of Object.values(this.s.equip)) {
      for (const o of it?.opts || []) {
        if (!slots.includes(o.s)) continue;
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
    { const ip = { range: 0, dmg: 0, cd: 0, echo: 0 };
      for (const it of Object.values(this.s.equip)) for (const im of IM.imprintsOf(it)) if (slots.includes(im.skill.s)) ip[im.skill.k] = (ip[im.skill.k] || 0) + im.skill.v;
      // v270 각인 몫마다 끝(SKILL_CAP) — 전엔 '한 번 더'만 잘려 피해·범위가 끝없이 쌓였다
      for (const k of ['range', 'dmg', 'cd']) m[k] = (m[k] || 0) + Math.min(IM.SKILL_CAP[k], ip[k]);
      m.echoP = Math.min(IM.SKILL_CAP.echo, ip.echo); }
    // v263 각성 — 고른 무공 하나에 변형 하나
    const awk = this.awakenOf(id) || oIds.map((x) => this.awakenOf(x)).find(Boolean) || null;   // v311 무공마다 · v444 주력은 물러난 무공의 변초도
    if (awk && this.s.level >= W.AWAKEN_LV) { const k = W.AWAKEN_KINDS.find((x) => x.id === awk); if (k) for (const [kk, v] of Object.entries(k.mods)) m[kk] = (m[kk] || 0) + v; }
    // v263 깨달음 — 무공 칸마다 단계
    const en = [id, ...oIds].reduce((t, x) => t + (this.s.enl?.nodes?.[x] || 0), 0);   // v444 물러난 무공의 깨달음도
    if (en) { m.dmg += en * W.ENL_STEP.dmg; m.cd += en * W.ENL_STEP.cd; }
    m.echoP = Math.min(IM.SKILL_CAP.echo + (awk === 'twin' ? 0.3 : 0), m.echoP);
    m.cd = Math.min(0.7, m.cd);
    m.cost = Math.min(1, m.cost);
    if (m.free) m.cost = 1;
    this._mods[id] = m;
    return m;
  }

  // ---------- 상점 ----------
  potionPrice() { return W.potionPrice(this.s.level); }
  potionAt() { return W.POTION_ATS.includes(this.s.potionAt) ? this.s.potionAt : W.POTION_AT; }
  buyPotions(n) {
    const cost = this.potionPrice() * n;
    if (n <= 0 || this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.potions += n;
    return true;
  }
  // ---------- v316 주간 두목 순위 ----------
  // 이번 주(월요일 0시, 한국 시간) 실제로 잡은 두목 수(던전·방치 빼고) · 화무기·마귀를 가장 빨리 잡은 초(나선 때부터 쓰러질 때까지)
  wbossState(now = Date.now()) {
    const key = TD.weekKey(now);
    if (!this.s.wboss || this.s.wboss.key !== key) this.s.wboss = { key, kills: 0, best: {} };
    return this.s.wboss;
  }
  noteWeekBoss(m, now = Date.now()) {
    const w = this.wbossState(now);
    w.kills++;
    const id = m.awk ? (m.awk === 'magwi' ? 'awk' : null) : this.map.master;   // v409 각성 고수는 보통 기록과 섞지 않는다(각성 마귀만 따로)
    if (id && W.WBOSS_RACE.includes(id)) {
      const sec = Math.max(W.WBOSS_MIN_SEC, Math.round((this.clock - (m.bornAt ?? this.clock)) * 10) / 10);
      if (!(w.best[id] > 0) || sec < w.best[id]) { const prev = w.best[id] || null; w.best[id] = sec; this._wbBest = true; this.emit('wbossBest', { id, sec, prev }); }
    }
    this._wbDirty = true;
  }
  // ---------- v320 출석부 ----------
  attNext() { return ((this.s.att?.n || 0) % TD.ATT_DAYS) + 1; }
  canAttend(now = Date.now()) { return this.s.att?.day !== D.kstDay(now); }
  attend(now = Date.now()) {
    if (!this.canAttend(now)) return null;
    const day = this.attNext();
    const r = TD.attReward(day, this.s.level);
    if (r.gold) this.s.gold += r.gold;
    if (r.potions) this.s.potions += r.potions;
    if (r.prot) this.s.prot = (this.s.prot || 0) + r.prot;
    if (r.petShard || r.mountShard) this.addShards(r.petShard || 0, r.mountShard || 0);
    if (r.elixirSec) this.s.elixir = Math.min(W.ELIXIR_MAX, (this.s.elixir || 0) + r.elixirSec);
    if (r.soul) this.s.petSoul = (this.s.petSoul || 0) + r.soul;
    this.s.att = { day: D.kstDay(now), n: day, total: (this.s.att?.total || 0) + 1 };
    this.emit('attend', { day, reward: r });
    return { day, ...r };
  }
  // ---------- v262 오늘의 강호 · 주간 상자 ----------
  todayState(now = Date.now()) {
    const day = D.kstDay(now);
    if (!this.s.today || this.s.today.day !== day) this.s.today = { day, cnt: {}, claimed: {} };
    const wk = TD.weekKey(now);
    if (!this.s.week || this.s.week.key !== wk) this.s.week = { key: wk, pts: 0, opened: false };
    return this.s.today;
  }
  tday(counter, n = 1) { const t = this.todayState(); t.cnt[counter] = (t.cnt[counter] || 0) + n; }
  todayTasks(now = Date.now()) {
    const t = this.todayState(now);
    return TD.tasksOf(t.day).map((x) => { const need = x.need(this.s.level); const cur = Math.min(need, t.cnt[x.counter] || 0); return { ...x, need, now: cur, done: cur >= need, claimed: !!t.claimed[x.id] }; });
  }
  claimToday(id, now = Date.now()) {
    const x = this.todayTasks(now).find((k) => k.id === id);
    if (!x || !x.done || x.claimed) return null;
    this.s.today.claimed[id] = 1;
    const gold = TD.taskGold(this.s.level);
    this.s.gold += gold;
    this.s.week.pts += TD.TASK_POINT;
    this.emit('todayDone', { id, name: x.name, gold });
    return { gold };
  }
  canOpenWeek(now = Date.now()) { this.todayState(now); return this.s.week.pts >= TD.WEEK_NEED && !this.s.week.opened; }
  openWeek(now = Date.now()) {
    if (!this.canOpenWeek(now)) return null;
    this.s.week.opened = true;
    const c = TD.weekChest(this.s.level);
    this.s.gold += c.gold;
    this.s.prot = (this.s.prot || 0) + c.prot;
    this.s.elixir = Math.min(W.ELIXIR_MAX, (this.s.elixir || 0) + c.elixirSec);
    this.addShards(W.WEEK_SHARDS, W.WEEK_SHARDS);   // v292
    return { ...c, petShard: W.WEEK_SHARDS, mountShard: W.WEEK_SHARDS };
  }
  // ---------- v262 자동 강화 · 자동 등급 각인 ----------
  // 강화: 낀 성장 장비 여섯 칸을 가장 낮은 것부터 +10까지(은자는 물약 60개 값을 남긴다 · v324 돌파부터는 직접)
  // 등급 각인: 가진 증표 중 센 것부터, 등급 낮은 칸부터. 돌파에 쓸 그 지역 증표는 세 번어치를 남긴다.
  autoGear() {
    // v415 전직 레벨이 됐으면 전직 값은 남긴다 — 강화 레벨 제한이 없어져(v408) 자동 강화가 은자를 다 써서 4차 전직(레벨 100)을 못 했다
    const nt = this.nextTier?.();
    const reserve = this.potionPrice() * 60 + (nt && this.s.level >= nt.level ? nt.cost : 0);
    const out = { enh: 0, inf: 0 };
    const worn = () => W.GROW_SLOTS.map((k) => this.s.equip[k]).filter(Boolean);
    if (this.s.autoEnh) {
      // v371 설정 — 몇 강까지 · 어느 칸 · 은자 얼마 남기기
      const ec = this.s.autoEnhCfg || {};
      const emax = Math.max(1, Math.min(W.AUTO_ENH_MAX, ec.max || W.AUTO_ENH_MAX));
      const ekeep = Math.max(reserve, Math.floor(this.s.gold * (ec.keep || 0) / 100));
      for (let n = 0; n < 30; n++) {
        // v324 자동 강화는 +10(돌파 전)까지만 — 돌파(증표·보호부·부서짐)는 직접
        const it = worn().filter((x) => ec.slots?.[x.slot] !== false).sort((a, b) => (a.plus || 0) - (b.plus || 0)).find((x) => (x.plus || 0) < emax && this.canEnhance(x) && this.s.gold - this.enhanceCost(x) > ekeep);
        if (!it) break;
        this.enhance(it.uid, true); out.enh++;
      }
    }
    if (this.s.autoInf) {
      const keep = {};
      for (const it of worn()) { const m = this.enhanceMats(it); if (m && it.step != null) { const bk = W.bossKey(W.itemZone(it)); keep[bk] = (keep[bk] || 0) + W.breakMarks(W.ENHANCE_MAX - 1) * 3; } }
      // v292 고른 증표만(고른 고유 효과로) · 고른 칸만 · v293 좋아하는 효과에 맞는 증표부터
      const cfg = this.s.autoInfCfg || { mode: 'theme', marks: {}, slots: {} };
      const mode = cfg.mode || (cfg.only ? 'pick' : 'all');
      // v386 고른 기운대로 — 각인 칸에서 고른 기운을 「올리기」와 똑같이(낮은 Lv 칸부터). 돌파 몫 증표·물약 값은 남긴다.
      if (mode === 'theme') {
        for (let n = 0; n < 12; n++) {
          const cand = W.SLOTS.map((x) => this.s.equip[x.id]).filter((it) => it && cfg.slots?.[it.slot] !== false && this.canImprintItem(it))
            .map((it) => ({ it, nx: this.impNext(it) }))
            .filter(({ nx }) => nx.can && this.s.gold - (nx.gold || 0) > reserve && (!nx.key || (this.s.mats[nx.key] || 0) - nx.n >= (keep[nx.key] || 0)))
            .sort((a, b) => this.impLv(a.it) - this.impLv(b.it));
          if (!cand.length) {
            // v403 하나도 못 올렸는데 막힌 칸이 있으면 — 한 번 알린다(같은 막힘은 30분에 한 번)
            if (n === 0 && !out.enh) {
              const st = this.impStuck(), mine = st?.slots.filter((it) => cfg.slots?.[it.slot] !== false) || [], key = st ? `${st.theme}:${mine.map((it) => it.slot).join(',')}` : '';
              const now = Date.now();
              if (mine.length && (key !== this._stuckKey || now - (this._stuckAt || 0) > 30 * 60e3)) { this._stuckKey = key; this._stuckAt = now; this.emit('impStuck', { theme: st.theme, have: st.have, n: mine.length }); }
            }
            break;
          }
          const r = this.impUp(cand[0].it.uid);
          if (!r) break;
          if (r.kind === 'dan') { out.dan = (out.dan || 0) + 1; if (r.ok && IM.GS_DAN.includes(IM.danOf(cand[0].it.imps?.[0]))) out.gs = (out.gs || 0) + 1; } else out.inf++;
        }
        if (out.enh || out.inf || out.dan) this.emit('autoGear', out);
        return out;
      }
      const sc = {};
      let marks = Object.keys(this.s.mats).filter((k) => W.isMarkKey(k) && this.s.mats[k] > 0 && (mode !== 'pick' || k in cfg.marks));
      if (mode === 'pref') { for (const k of marks) sc[k] = this.markPref(k, cfg); marks = marks.filter((k) => sc[k].score > 0); }
      marks.sort((a, b) => (mode === 'pref' ? sc[b].score - sc[a].score : 0) || W.markLv(b) - W.markLv(a));
      const spOf = (k) => (mode === 'pref' ? sc[k].sp : cfg.marks?.[k] || 0);
      for (let n = 0; n < 6; n++) {
        let done = false;
        for (const it of worn().filter((x) => cfg.slots?.[x.slot] !== false).sort((a, b) => (a.rar || 0) - (b.rar || 0))) {
          const k = marks.find((m) => { const f = this.infuseInfo(it, m); return f && this.canInfuse(it, m) && this.s.gold - f.gold > reserve && (this.s.mats[m] - f.n) >= (keep[m] || 0); });
          if (k) { this.infuse(it.uid, k, spOf(k)); out.inf++; done = true; break; }
        }
        if (!done) break;
      }
      // v297 남는 증표로 칸 단(段) 올리기 — 그 칸 두목의 증표만 쓴다(고르는 방식이 허락한 증표만). 다음 등급 각인 몫(12개)과 돌파 몫은 남긴다. 낮은 단부터.
      if (cfg.dan === true) {   // v370 켠 사람만 · 한 번에 한 단만
        const top = W.RARITY.length - 1;
        const gradeHold = worn().some((x) => cfg.slots?.[x.slot] !== false && this.canImprintItem(x) && (x.rar || 0) < top) ? W.INFUSE_MARKS[top] : 0;
        for (let n = 0; n < 1; n++) {
          let best = null;
          for (const it of worn().filter((x) => cfg.slots?.[x.slot] !== false)) for (let i = 0; i < (it.imps || []).length; i++) {
            const f = this.danInfo(it, i);
            if (!f || f.max || !marks.includes(f.key) || !this.canDanUp(it, i) || this.s.gold - f.gold <= reserve) continue;   // 고른 증표만(직접 고르기 · 좋아하는 효과)
            if (f.have - f.n < (keep[f.key] || 0) + gradeHold) continue;
            if (!best || f.d < best.f.d) best = { it, i, f };
          }
          if (!best) break;
          const r = this.danUp(best.it.uid, best.i); out.dan = (out.dan || 0) + 1;
          if (IM.GS_DAN.includes(IM.danOf(r))) out.gs = (out.gs || 0) + 1;
        }
      }
    }
    if (out.enh || out.inf || out.dan) this.emit('autoGear', out);
    return out;
  }
  // v372 방치 보상을 받은 뒤 밀린 자동 강화·각인을 한 번에 — 합친 횟수만 돌려주고, 하나하나의 연출·알림은 지운다(쏟아지지 않게)
  catchUpAutoGear() {
    const tot = { enh: 0, inf: 0, dan: 0, gs: 0 };
    if (!this.s.autoEnh && !this.s.autoInf) return tot;
    const n0 = this.events.length;
    for (let i = 0; i < 40; i++) {
      const o = this.autoGear();
      tot.enh += o.enh || 0; tot.inf += o.inf || 0; tot.dan += o.dan || 0; tot.gs += o.gs || 0;
      if (!o.enh && !o.inf && !o.dan) break;
    }
    const quiet = new Set(['autoGear', 'infuse', 'enhance']);
    const added = this.events.splice(n0).filter((ev) => !quiet.has(ev.type));
    this.events.push(...added);
    this._autoGearT = 5;
    return tot;
  }
  // v293 좋아하는 효과와 증표가 얼마나 맞나 — 앞에 고른 것일수록 무겁다. 고유 효과는 맞는 것 가운데 가장 앞 것을 고른다.
  markPref(k, cfg = this.s.autoInfCfg) {
    const z = +String(k).slice(1);
    const fx = IM.THEMES[IM.themeOfZone(z)]?.fx.map(([f]) => f) || [];
    const pf = cfg?.prefFx || [], ps = cfg?.prefSp || [];
    let score = 0;
    pf.forEach((f, i) => { if (fx.includes(f)) score += pf.length - i; });
    const sps = IM.specialsOfZone(z) || [];
    let sp = 0, best = 0;
    sps.forEach((x, j) => { const i = ps.indexOf(x.kind); const w = i < 0 ? 0 : (ps.length - i) * 1.5; if (w > best) { best = w; sp = j; } });
    return { score: score + best, sp, fx: pf.filter((f) => fx.includes(f)), spKind: best ? sps[sp].kind : null };
  }
  // v294 새겨진 각인 하나가 좋아하는 것인가 — 무엇이 맞는지 돌려준다(스킬 변화 · 고유 효과 · 테마 능력치)
  favOf(entry) {
    const cfg = this.s.autoInfCfg || {};
    const e = IM.normEntry(entry);
    if (!e) return null;
    const z = +String(e.k).slice(1);
    const skill = (cfg.prefSk || []).includes(e.sk) && (!(cfg.prefSkSlot || []).length || cfg.prefSkSlot.includes(e.s));
    const sp = IM.specialsOfZone(z)?.[e.sp | 0];
    const special = !!sp && (cfg.prefSp || []).includes(sp.kind);
    const fx = (IM.THEMES[IM.themeOfZone(z)]?.fx || []).map(([f]) => f).filter((f) => (cfg.prefFx || []).includes(f));
    return skill || special || fx.length ? { skill, special, fx } : null;
  }
  hasPrefs() { const c = this.s.autoInfCfg || {}; return !!((c.prefFx || []).length || (c.prefSp || []).length || (c.prefSk || []).length); }
  // ---------- v262 영약 · 무관 증축 · 세력 상점 ----------
  elixirPrice() { return W.elixirPrice(this.s.level); }
  buyElixir() {
    const c = this.elixirPrice();
    if (this.s.gold < c || (this.s.elixir || 0) + W.ELIXIR_SEC > W.ELIXIR_MAX) return false;
    this.s.gold -= c;
    this.s.elixir = (this.s.elixir || 0) + W.ELIXIR_SEC;
    this.tday('elixir');
    return true;
  }
  hallLv(kind) { return this.s.hall?.[kind] || 0; }
  hallCost(kind) { const n = this.hallLv(kind); return n >= W.HALL[kind].max ? null : W.hallCost(kind, n, this.s.level); }
  buyHall(kind) {
    const c = this.hallCost(kind);
    if (c == null || this.s.gold < c) return false;
    this.s.gold -= c;
    this.s.hall = { ...(this.s.hall || {}), [kind]: this.hallLv(kind) + 1 };
    return true;
  }
  canFacBuy(id) { const o = W.FAC_SHOP.find((x) => x.id === id); return !!o && (this.s.mats[o.mat] || 0) >= o.n && (id !== 'petfood' || this.activePets().some((p) => p.lv < W.PET_LV_MAX)); }
  buyFac(id) {
    const o = W.FAC_SHOP.find((x) => x.id === id);
    if (!o || !this.canFacBuy(id)) return null;
    this.s.mats[o.mat] -= o.n;
    if (id === 'prot') { this.s.prot = (this.s.prot || 0) + 1; return '강화 보호부 1장'; }
    if (id === 'petfood') {
      // 가장 낮은 애완동물 레벨의 다음 레벨 경험치 세 번어치
      const lo = Math.min(...this.activePets().map((p) => p.lv));
      this.petExp(W.petExpToNext(lo) * 3);
      return '애완동물 영단 — 경험치를 크게 얻었어요';
    }
    const no = 1 + Math.floor(this.rng() * 12);
    this.s.zTickets[no] = (this.s.zTickets[no] || 0) + 1;
    return `십이지 뽑기권(${no}번째 신) 1장`;
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
    if (after > before) { this._env = null; this._huntB = null; this._stats = null; this.emit('mastery', { zone, level: after, name: W.zoneOfW(zone).name }); }
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
    this.tday('treasure');
    const z = this.map.mz;
    const gold = Math.round(W.mobGold(m.lv) * L.TREASURE_GOLD * (1 + (env.gold || 0) + (st.gold || 0)) * (st.goldMul || 1));
    this.s.gold += gold;
    const mats = {};
    if (W.MATS[z]) { mats[z] = L.TREASURE_MATS; if (this.rng() < L.TREASURE_MARK) mats[W.bossKey(z)] = 1; }
    for (const [k, n] of Object.entries(mats)) this.addMats(k, n);
    this.addShards(W.TREASURE_SHARDS, W.TREASURE_SHARDS);   // v292
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
    // v432 지난 날로는 되돌아가지 않는다 — 자정 전에 들어간 판이 자정 뒤에 끝나면(I.now가 어제) 오늘 칸을 어제로 되돌렸다가
    //   다음 읽기에서 다시 넘어오며 하루치를 통째로 더 줬다(3번 → 6번). 지난 날 몫은 버리는 칸에 적는다
    if (d.day && day < d.day) return { used: {}, fail: {}, left: {}, keys: {}, extra: {} };
    if (d.day !== day) {
      // v262: 어제 남긴 횟수는 하루만 넘어온다(최대 하루치) — 못 들어온 날의 횟수가 그냥 사라졌다
      const yest = D.kstDay(now - 86400e3);
      const carry = {};
      if (d.day === yest) for (const x of D.DAILY) { const left = D.DAILY_ENTRIES + (d.extra?.[x.id] || 0) - (d.used[x.id] || 0); if (left > 0) carry[x.id] = Math.min(D.DAILY_ENTRIES, left); }
      d.day = day; d.used = {}; d.fail = {}; d.left = {}; d.keys = {}; d.extra = carry;
    }
    if (!d.fail) d.fail = {};
    if (!d.keys) d.keys = {};
    if (!d.extra) d.extra = {};
    return d;
  }
  dailyLeft(kind, now = Date.now()) { const d = this.dgnToday(now); return Math.max(0, D.DAILY_ENTRIES + (d.extra[kind] || 0) - (d.used[kind] || 0)); }
  dailyBest(kind) { return this.s.dgn.best[kind] || 0; }
  // 고를 수 있는 가장 높은 단계: 깬 단계 + 1 (레벨이 닿는 데까지)
  // 깬 단계 다음까지 — 레벨은 안 본다(v146). 단계는 하나씩 깨며 오른다.
  dailyMaxStage(kind) {
    return Math.min(D.DAILY_STAGES, this.dailyBest(kind) + 1);
  }
  canDaily(kind, stage, now = Date.now()) {
    const d = D.dailyOf(kind);
    // v302 횟수 제한 없음 — 몫(dailyLeft)은 보상 크기만 정한다
    return !!d && !!this.s.job && !this.inst && D.dailyOpen(d, now)
      && stage >= 1 && stage <= this.dailyMaxStage(kind);
  }
  // v302 이 판이 온전한 보상인가 — 몫이 남았거나(한 번 쓴다) 아직 못 깬 단계(몫을 안 쓴다)
  dailyFull(kind, stage, now = Date.now()) { return this.dailyLeft(kind, now) > 0 || stage > this.dailyBest(kind); }
  startDaily(kind, stage, now = Date.now()) {
    if (!this.canDaily(kind, stage, now)) return false;
    const full = this.dailyLeft(kind, now) > 0;
    if (full) { const used = this.dgnToday(now).used; used[kind] = (used[kind] || 0) + 1; }
    this.startInst({ kind: 'daily', id: kind, stage, map: D.dailyMap(kind, stage), t: D.DAILY_SEC, max: D.DAILY_SEC, target: D.DAILY_KILLS, kills: 0, now, full });
    for (let i = 0; i < D.DAILY_ALIVE; i++) this.spawnMob(false);
    return true;
  }
  // ---------- 길잡이 (v139) ----------
  // **띄우는 건 늘 하나다.** 열 몇 가지가 한꺼번에 열려 있어서, 목록을 더
  // 보여 주면 더 헷갈린다. 끝내면 다음 하나가 나온다.
  questNow() {
    // v180: 판 2 → 3 — 단계를 끼워 넣었다. 하던 단계와 **새로 끼운 단계 중 가장 앞**부터 —
    // 이미 해 본 것은 '다 받기'로 한꺼번에 받는다(끼운 단계도 모두 겪어 보게)
    // v208: 판 2·3 → 지금 판 — 옛 판의 차례(QUEST_IDS_BY_V)로 하던 단계를 찾는다
    // v213: 판 4 → 5는 '계열 각인' 하나를 뺐을 뿐 — 끼운 단계가 없으니 번호만 옮긴다(옮겨 오던 중인 것도 그대로)
    //   (v269: 판 5의 차례로 옮긴다 — 아래 5 → 6이 이어서 지금 판으로 옮긴다)
    if (this.s.questV === 4 && Q.QUEST_V >= 5) {
      const ids4 = Q.QUEST_IDS_BY_V[4];
      const ids5x = Q.QUEST_IDS_BY_V[5];
      const remap = (i) => { for (; i < ids4.length; i++) { const j = ids5x.indexOf(ids4[i]); if (j >= 0) return j; } return ids5x.length; };
      if (this.s.questGift >= 0) this.s.questGift = ids4[this.s.questGift] === 'line' ? -1 : remap(this.s.questGift);
      this.s.quest = remap(this.s.quest || 0);
      if (this.s.questTo != null) this.s.questTo = remap(this.s.questTo);
      this.s.questV = 5;
    }
    // v269: 판 5 → 6 — 1차 전직 단계(tier1)를 레벨 5 뒤로 당겼다. 단계 이름으로 자리를 다시 찾는다.
    //   아직 전직 단계를 안 받은 사람은 새 자리의 전직 단계부터 하고, 받으면 하던 단계로 돌아간다(questBack).
    if (this.s.questV === 5 && Q.QUEST_V >= 6) {
      const ids5 = Q.QUEST_IDS_BY_V[5];
      const remap = (i) => { for (; i < ids5.length; i++) { const j = Q.QUEST_V6_IDS.indexOf(ids5[i]); if (j >= 0) return j; } return Q.QUEST_V6_IDS.length; };   // v369 판 6의 차례로(아래 일반 옮기기가 지금 판으로)
      const t1Old = ids5.indexOf('tier1');
      const t1New = Q.QUEST_V6_IDS.indexOf('tier1');
      const q0 = this.s.quest || 0;
      const at = remap(q0 === t1Old ? q0 + 1 : q0);
      if (q0 <= t1Old && at > t1New) {
        this.s.quest = t1New;
        if (at > t1New + 1) this.s.questBack = at;
      } else this.s.quest = remap(q0);
      if (this.s.questTo != null) this.s.questTo = remap(this.s.questTo);
      if (this.s.questGift >= 0) this.s.questGift = remap(this.s.questGift);
      this.s.questV = 6;
    }
    const oldIds = Q.QUEST_IDS_BY_V[this.s.questV];
    if (oldIds && this.s.questV < Q.QUEST_V) {
      // 판 3으로 옮겨 오다 아직 끼운 단계를 짚는 중이었다면, 그 '하던 단계'를 기준으로
      // v213: 하던 단계가 빠졌으면(계열 각인) 그 뒤로 남아 있는 첫 단계로
      let i0 = this.s.questTo > this.s.quest ? this.s.questTo : this.s.quest;
      let at = -1;
      for (; i0 < oldIds.length && at < 0; i0++) at = Q.QUESTS.findIndex((q) => q.id === oldIds[i0]);
      if (at < 0) at = Q.QUEST_COUNT;
      const fresh = Q.QUESTS.findIndex((q) => !oldIds.includes(q.id));
      this.s.quest = fresh >= 0 ? Math.min(at, fresh) : at;
      this.s.questOldV = this.s.questV;
      this.s.questV = Q.QUEST_V;
      this.s.questGift = -1;
      this.s.questTo = at;
    }
    // 하던 단계(questTo)까지는 옛 단계(이미 받은 것)를 다시 받지 않게 건너뛰고 끼운 것만 짚는다
    const skipIds = Q.QUEST_IDS_BY_V[this.s.questOldV || 2] || [];
    while (this.s.questTo > this.s.quest && skipIds.includes(Q.questAt(this.s.quest)?.id)) this.s.quest++;
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
    // v260: 이 단계를 언제부터 붙잡고 있었나 — 오래 막히면 절반 보상으로 건너뛴다
    if (this.s.questAt !== this.s.quest) { this.s.questAt = this.s.quest; this.s.questSince = Date.now(); }
    // 해 봐야 하는 것은 그 단계가 뜰 때 준다 (첫 무기 재료 · 가장 아래 애완동물·탈것)
    if (q.gift && this.s.questGift !== this.s.quest && this.s.job) {
      this.s.questGift = this.s.quest;
      const what = q.gift(this);
      if (what) this.emit('questGift', { title: q.title, what });
    }
    const g = q.goal(this);
    const need = g.need || 1;
    const now = Math.min(need, Math.max(0, g.now || 0));
    const stuck = !q.skip && !q.mile && now < need && Date.now() - (this.s.questSince || Date.now()) >= Q.QUEST_STUCK_MS;
    return { q, now, need, done: now >= need, stuck, reward: Q.questReward(q, this.s.level) };
  }
  canClaimQuest() { return !!this.questNow()?.done; }
  // 서버가 있어야 하는 단계(문파·토벌·함께 사냥)는 건너뛸 수 있다 — 보상은 없다
  // v260: 그 밖의 단계도 두 시간 넘게 막혀 있으면 건너뛸 수 있다 — 보상 절반(레벨 단계는 빼고)
  skipQuest() {
    const cur = this.questNow();
    if (!cur || cur.done || !(cur.q.skip || cur.stuck)) return false;
    let reward = null;
    if (cur.stuck) {
      const half = {};
      for (const [k, v] of Object.entries(cur.reward || {})) half[k] = Math.round(v / 2);
      reward = this.grant(half);
    }
    this.s.quest++;
    this.questReturn();
    if (reward) this.emit('quest', { id: cur.q.id, title: cur.q.title, reward, left: Q.QUEST_COUNT - this.s.quest, skipped: true });
    return reward || true;
  }
  // v269 옮겨 온 전직 단계를 끝내면 하던 단계로 돌아간다
  questReturn() {
    if (this.s.questBack == null) return;
    if (this.s.quest <= this.s.questBack) this.s.quest = this.s.questBack;
    delete this.s.questBack;
  }
  // ---------- 현철 단련 (v274) ----------
  temperCost() { return W.temperCost(this.s.temper || 0, this.s.level); }
  canTemper() { return this.s.level >= W.TEMPER_FROM && (this.s.mats[W.ORE] || 0) >= this.temperCost(); }
  // n번까지(현철이 되는 만큼) — 올린 단계 수를 돌려준다
  temper(n = 1) {
    let k = 0;
    while (k < n && this.canTemper()) { this.s.mats[W.ORE] -= this.temperCost(); this.s.temper = (this.s.temper || 0) + 1; k++; }
    if (k) { this._stats = null; this.mark('temper'); this.emit('temper', { lv: this.s.temper, n: k }); }
    return k;
  }
  // 해 본 것 하나 (길잡이용)
  mark(k) { const d = this.s.did || (this.s.did = {}); d[k] = (d[k] || 0) + 1; }
  // 길잡이 선물 — 우리에 넣어 둔다(데려가기는 손으로)
  giftPet(kind) {
    if (this.s.petBox.length >= W.PET_BOX) return null;
    this.s.petBox.push({ uid: uidSeq++, kind, rar: 0, lv: 1, exp: 0 });
    return `애완동물 ${W.petOf(kind).name}(${W.RARITY[0].name})`;
  }
  // 우편함 (v177) — 운영자가 보낸 애완동물('종류:등급')·탈것. 받을 자리가 없으면 false(우편은 남겨 둔다)
  mailPetOk() { return this.s.pets.length < this.petSlots() || this.s.petBox.length < W.PET_BOX; }
  // force: 이미 우편을 지운 뒤라 잃지 않게 — 우리가 차 있어도 우리에 넣는다(v254)
  takeMailPet(code, force = false) {
    const [kind, r] = String(code).split(':');
    const rar = Math.max(0, Math.min(W.RARITY.length - 1, Math.floor(Number(r) || 0)));
    if (!W.PETS.some((p) => p.id === kind) || (!force && !this.mailPetOk())) return null;
    const pet = { uid: uidSeq++, kind, rar, lv: 1, exp: 0 };
    if (this.s.pets.length < this.petSlots()) this.s.pets.push(pet); else this.s.petBox.push(pet);
    this._stats = null;
    return pet;
  }
  takeMailMount(kind) {
    if (!W.mountOf(kind)) return null;
    const mt = { uid: uidSeq++, kind };
    this.s.mounts.push(mt);
    const cur = this.mountNow();
    if (!cur || W.mountRank(W.mountOf(kind)) > W.mountRank(cur)) this.s.mount = mt.uid;
    this._stats = null;
    return mt;
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
    this.questReturn();
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
    if (!(this.s.dgn.auto || this.s.dgn.routine) || this.inst || !this.s.job) return null;
    for (const d of D.DAILY) {
      if (this.dgnToday(now).left?.[d.id]) continue;   // v417 오늘 손으로 나온 던전
      const stage = this.dailyMaxStage(d.id);
      const fresh = stage > this.dailyBest(d.id) && (this.dgnToday(now).fail[d.id] || 0) < stage;   // 아직 못 깬 단계 · 오늘 안 진 곳
      // v283 등반 모드: 아직 못 깬 단계만 · 오늘 그 단계에서 졌으면(막혔으면) 그 던전은 멈춘다 — 남은 몫은 그대로 둔다
      // v398 길잡이가 '소탕을 한 번' 시키면 등반 모드라도 한 번은 소탕하러 간다(자동만 켠 무인이 그 단계에 영영 멈췄다). 그 밖에는 v283 그대로 — 남은 몫은 무인이 쓴다
      if (this.s.dgn.climb && !fresh && !(Q.questAt(this.s.quest)?.id === 'sweep' && this.canSweep(d.id, now))) continue;
      // v302 자동은 온전한 보상일 때만 — 몫이 없고 새 단계도 아니면(10% 보상 추가 도전) 돌지 않는다
      if (!fresh && this.dailyLeft(d.id, now) <= 0) continue;
      if (this.canDaily(d.id, stage, now)) return { kind: d.id, stage };
    }
    return null;
  }
  // ---------- 직업의 길 (v237) ----------
  canChoosePath() { return !!this.s.job && (this.s.jobTier || 0) >= 2; }
  pathSwitchCost() { return this.s.path ? PT.PATH_SWITCH_COST(this.s.level) : 0; }
  choosePath(id) {
    if (!this.canChoosePath() || !['a', 'b'].includes(id) || this.s.path === id) return false;
    const cost = this.pathSwitchCost();
    if (this.s.gold < cost) return false;
    this.s.gold -= cost;
    // v258: 떠나는 길의 길 무공(합일 전엔 못 쓰게 된다)에 쓴 점수를 돌려준다
    const old = this.s.path ? `p${this.s.path}` : null;
    if (old && !PT.merged({ ...this.s, path: id }) && this.s.skillLv?.[old] > 1) {
      this.s.skillPts += W.skillSpent(this.s.skillLv[old]);
      delete this.s.skillLv[old];
      this._mods = null;
    }
    this.s.path = id;
    this._stats = null;
    this.emit('path', { id });
    return true;
  }
  // ---------- 던전 루틴 (v230) ----------
  // 켜 두면: 열린 요일 던전을 모두(가장 높은 단계로) → 무한의 탑을 못 오를 때까지 → 사냥터로.
  // 탑에서 막히면 그때 전투력을 적어 두고, 전투력이 5% 넘게 오를 때까지는 다시 안 간다(같은 층에서 헛돌지 않게).
  towerRetryOk() { return this.stats().power >= (this.s.tower.failPow || 0) * 1.05; }
  routineNext(now = Date.now()) {
    if (!this.s.dgn.routine || this.inst || !this.s.job) return null;
    const d = this.autoDailyNext(now);
    if (d) return { step: 'daily', ...d };
    if (this.canTower() && this.towerRetryOk()) return { step: 'tower' };
    return null;
  }
  startRoutine(now = Date.now()) {
    const nx = this.routineNext(now);
    if (nx?.step === 'tower') return this.startTower(false);
    if (nx) return this.autoDailyGo(nx, now);
    return this.startAutoDaily(now);
  }
  startAutoDaily(now = Date.now()) {
    const nx = this.autoDailyNext(now);
    if (!nx) return false;
    return this.autoDailyGo(nx, now);
  }
  // v260: 자동 도전 — 가장 높은 단계가 이미 깬 단계면(새로 오를 데가 없으면) 들어가지 않고 소탕한다.
  // 길잡이 '소탕을 한 번'이 자동 도전에 횟수를 다 뺏겨 하루 넘게 막히던 것도 이것으로 풀린다.
  autoDailyGo(nx, now = Date.now()) {
    const today = this.dgnToday(now);
    const lost = (today.fail[nx.kind] || 0) >= nx.stage;
    const learnSweep = Q.questAt(this.s.quest)?.id === 'sweep';
    // v283 등반 모드는 소탕하지 않는다 — 막히면 그대로 멈추고 남은 횟수는 무인이 쓴다(다음 날로 넘어가기도 한다)
    // v398 등반 모드라도 길잡이가 소탕을 시키면 소탕한다 — 자동만 켜 둔 무인이 '소탕' 단계에 영영 멈췄다
    if (this.s.dgn.climb) {
      if (learnSweep && this.canSweep(nx.kind, now)) return !!this.sweepDaily(nx.kind, now);
      return nx.stage > this.dailyBest(nx.kind) && !lost ? this.startDaily(nx.kind, nx.stage, now) : false;
    }
    if ((nx.stage <= this.dailyBest(nx.kind) || lost || learnSweep) && this.canSweep(nx.kind, now)) {
      return !!this.sweepDaily(nx.kind, now);
    }
    if ((nx.stage <= this.dailyBest(nx.kind) || lost) && this.dailyLeft(nx.kind, now) <= 0) return false;   // v302 추가 도전(10%)은 자동이 안 한다
    return this.startDaily(nx.kind, nx.stage, now);
  }

  // 소탕 — 깬 가장 높은 단계의 보상을 들어가지 않고 받는다 (한 번 쓴다)
  canSweep(kind, now = Date.now()) {
    const d = D.dailyOf(kind);
    return !!d && D.dailyOpen(d, now) && this.dailyLeft(kind, now) > 0 && this.dailyBest(kind) > 0;
  }
  sweepDaily(kind, now = Date.now()) {
    if (!this.canSweep(kind, now)) return null;
    this.tday('daily');
    const used = this.dgnToday(now).used;
    used[kind] = (used[kind] || 0) + 1;
    const stage = this.dailyBest(kind);
    const reward = this.grant(D.dailyReward(kind, stage, this.levelGapMult(D.dailyLv(stage)), this.s.level));
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
  // v241: 두목 최소 싸움 길이 — 무인의 초당 피해로 셈해 기본 체력이 그보다 모자라면 올린다(최대 3배)
  heroDpsEst() {
    // 지난 30초 실제 초당 피해(싸운 적이 있을 때) — 없으면 평타로 어림(무공 몫 ×2.5)
    const log = (this.dmgLog || []).filter((x) => x > 0);
    if (log.length >= 8) return log.reduce((a, b) => a + b, 0) / log.length;
    const st = this.stats(); return (st.atk / st.atkSec) * (1 + st.crit * (st.critDmg - 1)) * (2.5 + (this.s.jobTier || 0) * 0.8) * st.skillMult;   // v242: 차수·무공 배수만큼 무공 몫
  }
  // v262: 처음 잡는 두목만 최소 싸움 시간을 다 지킨다 — 한 번 잡은 두목은 그 몫(BOSS_REPEAT_K)만. 강해질수록 반복 사냥이 빨라진다.
  bossMinSec(m) {
    const seen = (this.s.bossKills?.[m.id] || 0) > 0;
    return (m.lord ? W.BOSS_MIN_SEC.lord : m.king || m.master ? W.BOSS_MIN_SEC.king : W.BOSS_MIN_SEC.zone) * (seen ? W.BOSS_REPEAT_K : 1) * this.bossTimeK();
  }
  // 두목이 무인보다 높으면 그만큼 덜 버텨도 된다(이미 아프다)
  // v277 두목 사냥꾼(권마·극악소마) — 두목 싸움 시간 배수
  // v279 탐보(환마) — 두목 장신구·애완동물·포획 조각 배수
  lootK() { return W.CLASSES[this.s.job]?.lootK || 1; }
  // v313 두목이 다시 나서는 데 걸리는 초 — 화무기만 길다
  bossRespawn(map = this.map) { return W.BOSS_RESPAWN_SLOW[map?.master] || W.BOSS_RESPAWN; }
  bossTimeK() { return W.CLASSES[this.s.job]?.bossTime || 1; }
  // v390 맹주·천마·화무기·마귀는 만렙(150)보다 늘 높아 '높으니 덜 버텨도 된다'가 거꾸로 먹었다(천마 94초 · 화무기 60초 · 마귀 37초).
  //   우두머리는 깎지 않고 고수마다 배수(minK) — 맹주·천마 1 · 화무기 1.6 · 마귀 2.4
  bossGapK(m) { if (m.lord) return MS.masterOf(m.master)?.minK || 1; return Math.max(W.GAP_OUT_MIN, 1 - W.GAP_OUT * Math.max(0, m.lv[1] + 2 - this.s.level)); }
  overPower(baseHp, m) {
    const need = this.heroDpsEst() * this.bossMinSec(m) * this.bossGapK(m);
    return Math.max(1, Math.min(W.OVERPOWER_MAX, need / baseHp));
  }
  // v271 두목 맞춤 — 첫 피해부터 BOSS_CALIB_SEC초(그 전에 쓰러질 피해면 그때) 실제로 들어간 피해로 초당 피해를 재고,
  //   최소 싸움 시간에 모자라면 체력을 그만큼 올린다(이미 깎은 만큼은 깎인 채로). 한 번만.
  bossCalib(m, dmg) {
    const c = m.calib;
    if (c.t0 == null) c.t0 = this.clock;
    const prev = c.dealt || 0;
    c.dealt = prev + Math.min(dmg, Math.max(0, m.hp));
    const el = this.clock - c.t0;
    if (el < W.BOSS_CALIB_SEC && m.hp - dmg > 0) return;
    m.calib = null;
    const need = Math.min(c.base * W.BOSS_CALIB_MAX, (c.dealt / Math.max(1, el)) * c.sec);
    if (need <= m.maxHp) return;
    m.hp = Math.max(1, need - prev);
    m.maxHp = need;
    m.op = need / c.base;
  }
  bossSkills() {
    const m = this.map;
    if (m.master) return MS.masterOf(m.master)?.skills || null;
    if (m.king) return MS.KING_SKILLS[m.king.title] || null;
    return null;
  }
  tickBossSkill(dt) {
    const sk = this.bossSkills();
    const b = this.mons.find((x) => x.isBoss && x.alive && !(x.introT > 0));
    if (!b || b.stun > 0) return;
    // v241: 지역 두목(레벨 30부터)도 단순한 바닥 경고를 쓴다 — 서서 맞기만 하면 안 된다
    if (!sk) {
      if (this.inst || !this.map.bossRoom || b.lv < W.ZONE_BOSS_FROM) return;
      b.castT = (b.castT ?? 4) - dt;
      if (b.castT > 0) return;
      b.castT = W.FIELD_CAST * 1.25 * (0.85 + this.rng() * 0.3);
      this.bossStrike(b, { pct: W.FIELD_TELL * 0.9 * D.tellDmg(MS.floorOf(b.lv)) * W.STRIKE_K, name: '강타' });   // v439 바닥 경고 → 한 방
      return;
    }
    b.castT = (b.castT ?? 3) - dt;
    if (b.castT > 0) return;
    const lord = this.map.lord;
    // v238: 고수마다 박자 — 화무기·마귀는 더 잦고(castK) 경고가 짧고(tellK) 아프다(absK)
    const mm = this.map.master ? MS.masterOf(this.map.master) : null;
    b.castT = (lord ? W.FIELD_CAST_LORD : W.FIELD_CAST) * (0.85 + this.rng() * 0.3) * (mm?.castK || 1);
    // v168: 십이지왕·레벨 100 넘는 고수 — 테마 초식 셋(넷) + 세 번째마다 오의. 피해는 고정값(체력·방어가 버틴다)
    const pb = MS.bossPatterns(this.map);
    if (pb) {
      b.castN = (b.castN || 0) + 1;
      const ult = b.castN % (mm?.ultEvery || 3) === 0;
      const s1 = ult ? pb.ult : pb.list[Math.floor(this.rng() * pb.list.length)];
      const abs = D.bossRefHp(b.lv) * MS.PAT_K * (ult ? MS.PAT_ULT : 1) * (lord ? MS.PAT_LORD : 1) * (mm?.absK || 1);
      const delay = (ult ? 1.9 : 1.3) * (mm?.tellK || 1);
      // v439 테마 초식(여러 갈래 바닥 경고) → 이름을 외치고 한 방. 오의는 조금 더 길게 모았다가 세게
      const n = (s1.pats || [s1.pat]).length;
      this.bossStrike(b, { abs: abs * (ult ? W.STRIKE_ULT_K : W.STRIKE_K) * Math.sqrt(n), name: s1.name, ult, wind: delay * 0.8 });
      if (ult) b.castT += 1.5;
      return;
    }
    const s1 = sk[Math.floor(this.rng() * sk.length)];
    this.bossStrike(b, { pct: (lord ? W.FIELD_TELL_LORD : W.FIELD_TELL) * D.tellDmg(MS.floorOf(b.lv)) * W.STRIKE_K, name: s1.name });   // v439
  }
  masterBonus() {
    let b = 0;
    for (const id of Object.keys(this.s.duel?.won || {})) { const m = MS.masterOf(id); if (m) b += MS.masterBonusOf(m) * (1 + MS.STAR_BONUS * this.duelStars(id).extra); }
    return b;
  }
  // v262 비무 별 셋 — ★ 쓰러뜨림 · ★ 빨리(DUEL_STAR_SEC 안에) · ★ 초식에 한 번도 안 맞고. 별마다 영구 덤이 그 고수 몫의 25%씩 늘어난다.
  duelStars(id) {
    const f = this.s.duel?.stars?.[id] || 0;
    const won = !!this.s.duel?.won?.[id];
    const fast = !!(f & 1), clean = !!(f & 2);
    return { won, fast, clean, n: (won ? 1 : 0) + (fast ? 1 : 0) + (clean ? 1 : 0), extra: (fast ? 1 : 0) + (clean ? 1 : 0) };
  }
  // ---------- v451 비동기 대결 ----------
  // 내 대결 기록 — 서열 문서에 올린다(생김새 lk는 그리는 쪽이 붙인다). 상대는 이 숫자로 나를 잰다
  pvpSnap() {
    const s = this.s, st = this.stats();
    return { n: s.nickname || '무명', j: s.job, t: s.jobTier || 0, lv: s.level, tn: this.tierName(), sk: this.mainSkill()?.name || '', hp: Math.round(st.hp), dps: Math.round(PV.dpsEst(st, s.jobTier, s.job, s.level)), pw: Math.round(st.power) };
  }
  pvpToday(now = Date.now()) {
    const P = this.s.pvp, d = D.kstDay(now);
    if (P.day !== d) { P.day = d; P.used = 0; }
    return P;
  }
  pvpLeft(now = Date.now()) { return Math.max(0, PV.PVP_PER_DAY - this.pvpToday(now).used); }
  canPvp(now = Date.now()) { return !this.inst && !!this.s.job && this.s.level >= PV.PVP_LV && this.pvpLeft(now) > 0; }
  // 겨룰 상대 하나와 대결을 시작한다 (opp: wpvp.oppOf 모양)
  startPvp(opp, now = Date.now()) {
    if (!opp || !this.canPvp(now)) return false;
    const me = this.pvpSnap();
    const rHp = PV.clampR(opp.hp / me.hp), rDmg = PV.clampR(opp.dps / me.dps);
    this.pvpToday(now).used++;
    const z = Math.max(1, Math.min(W.ZONES_W.length - 1, D.zoneForLv(this.s.level) || 1));
    this.startInst({ kind: 'pvp', opp, rHp, rDmg, map: PV.pvpMap(z, W.ZONES_W[z].art, opp), t: PV.PVP_SEC, max: PV.PVP_SEC, wait: 1.6, castT: PV.PVP_CAST * 0.7, now });
    this.bossSeen = true;   // 두목 등장처럼 화면을 멈추지 않는다 — 나서자마자 겨룬다
    return true;
  }
  // 무한의 탑 — 다음 층에 오른다. chain: 이긴 뒤 이어 오르는 것(등장 연출을 짧게)
  canTower() { return !this.inst && !!this.s.job && this.s.tower.floor < D.TOWER_MAX; }
  // v263 주간 회랑 — 120층을 넘으면. 이번 주 기록에서 한 층 위로.
  corridorState(now = Date.now()) {
    const wk = D.corridorWeek(now);
    const c = this.s.tower.cor;
    if (!c || c.key !== wk) this.s.tower.cor = { key: wk, best: 0, all: Math.max(c?.all || 0, c?.best || 0) };
    return this.s.tower.cor;
  }
  canCorridor() { return !this.inst && !!this.s.job && this.s.tower.floor >= D.TOWER_MAX; }
  startCorridor(chain = false) {
    if (!this.canCorridor()) return false;
    const f = D.TOWER_MAX + this.corridorState().best + 1;
    this.startInst({ kind: 'tower', corridor: true, corWk: D.corridorWeek(), stage: f, map: D.towerMap(f), t: D.towerSec(f), max: D.towerSec(f), wait: chain ? 1.2 : 0.6, castT: 2.5 });
    this.bossSeen = chain;
    return true;
  }
  // v350 극(하드) — 보통 탑 60층부터. 다음 극 층으로
  canHard() { return !this.inst && !!this.s.job && this.s.tower.floor >= D.HARD_OPEN && (this.s.tower.hard || 0) < D.HARD_MAX; }
  startHard(chain = false) {
    if (!this.canHard()) return false;
    const h = (this.s.tower.hard || 0) + 1;
    this.startInst({ kind: 'tower', hard: true, stage: h, map: D.hardMap(h), t: D.hardSec(h), max: D.hardSec(h), wait: chain ? 1.2 : 0.9, castT: 2.2 });
    this.bossSeen = chain;
    return true;
  }
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
    // v258: 들어갈 때의 체력을 적어 둔다(이어 도는 판은 처음 것을 그대로) — 나오면 돌려놓는다
    if (this._hpBeforeInst == null) this._hpBeforeInst = this.heroHp;
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
        if (b && I.kind === 'wraid') { b.lv = this.s.level + 8; b.maxHp = I.sharedMax; b.hp = I.hpLeft; b.baseAtk = b.atk = W.mobAtk(b.lv) * W.BOSS.atk; b.armor = 0; b.grade = 3; b.wb = I.boss0; I.rage = -1;
          // v374 거대한 마왕은 위 가운데에 버티고 선다 — 무인은 아래에서 탄을 피하며 친다
          b.c = b.hc = SH.BOSS_C; b.r = b.hr = SH.BOSS_R; b.x = W.tileCenter(SH.BOSS_C); b.y = W.tileCenter(SH.BOSS_R); b.move = null; b.aggro = true; }   // v443 무인이 걸어가 친다
        else if (b && I.kind === 'pvp') {   // v451 상대 무인 — 나를 기준으로 잰 체력·평타(wpvp.js)
          const st = this.stats(), o = I.opp;
          b.def = { ...b.def, opts: o.lk?.opts || null, job: o.j };
          { const c = Math.max(0, Math.min(W.COLS - 1, this.hc + (this.rng() < 0.5 ? -2 : 2))), r = Math.max(0, this.hr - 5);   // 화면 안 — 내 앞 다섯 칸
            if (!this.occupied(c, r, b)) { b.c = b.hc = c; b.r = b.hr = r; b.x = W.tileCenter(c); b.y = W.tileCenter(r); b.move = null; } }
          b.lv = o.lv; b.maxHp = b.hp = PV.dpsEst(st, this.s.jobTier, this.s.job, this.s.level) * PV.PVP_HP_SEC * I.rHp; b.armor = 0; b.grade = 3; b.pvp = o.j; b.aggro = true;
          b.atk = st.hp * PV.PVP_BASIC * I.rDmg + st.def; I.boss = b; I.oppMax = b.maxHp; }
        else if (b && I.kind === 'raid') { b.lv = this.s.level + 5; b.maxHp = I.sharedMax; b.hp = I.hpLeft; b.atk = W.mobAtk(b.lv) * W.BOSS.atk; b.armor = 0; b.grade = 3; }
        else if (b && I.hard) { b.lv = D.hardLv(I.stage); b.maxHp = b.hp = D.hardHp(I.stage); b.atk = D.hardAtk(I.stage); b.armor = W.mobDef(b.lv); b.grade = 3; b.hardFx = D.hardMountOf(I.stage)?.fx || 'hard'; }
        else if (b) { b.lv = D.towerLv(I.stage); b.maxHp = b.hp = D.towerHp(I.stage); b.atk = D.towerAtk(I.stage); b.armor = W.mobDef(b.lv); if (D.isZodiacFloor(I.stage)) b.grade = 3; }
      }
      return;
    }
    // 수문장 초식 — 바닥 경고
    // v373 월드보스 — 함께 깎은 체력이 반·1/5 아래면 분노·광폭(v374 탄이 빠르고 빽빽해진다 · wshmup)
    if (I.kind === 'wraid') {
      const b = this.mons.find((m) => m.isBoss && m.alive);
      const tier = D.WB_TIER[D.wbTierOf(this.map?.wb)];
      // v387 천계의 기운 — 싸우는 동안 회복(흡혈·재생·물약·동료)이 일부만 든다. 지난 틱 뒤 오른 몫만 줄인다 (v443 wshmup에서 옮겨 옴)
      if (this._shHp != null && this.heroHp > this._shHp && this.heroHp > 0) this.heroHp = this._shHp + (this.heroHp - this._shHp) * tier.heal;
      this._shHp = this.heroHp;
      if (b) {
        const rg = D.wraidRage(Math.max(0, b.hp) / b.maxHp);
        if (rg !== I.rage) { const up = I.rage >= 0 && rg > I.rage; I.rage = rg; if (up) this.emit('wraidRage', { rage: rg, name: D.WRAID_RAGE[rg].name, x: b.x, y: b.y }); }
        // v443 강타 — 탄막 대신 초식 이름을 외치고 한 방. 분노·광폭이면 더 잦고 아프다. 세 번째마다 오의
        if (!(b.introT > 0)) {   // 기절해도 강타는 온다 — 권마·환마·극악소마의 기절이 이어지면 마왕이 한 번도 못 치던 것(시뮬)
          I.castT = (I.castT ?? 3) - dt;
          if (I.castT <= 0) {
            const rk = D.WRAID_RAGE[I.rage > 0 ? I.rage : 0];
            I.castN = (I.castN || 0) + 1;
            const ult = I.castN % 3 === 0;
            const pats = D.WRAID_BOSS[I.boss0]?.pats || [];
            const p = pats.length ? pats[Math.floor(this.rng() * pats.length)] : null;
            I.castT = D.WRAID_STRIKE_GAP * rk.gap * (ult ? 1.3 : 1);
            this.bossStrike(b, { pct: tier.hit * D.WRAID_STRIKE_K * rk.atk * (ult ? 1.6 : 1), name: p?.name || '강타', ult, wind: D.WRAID_STRIKE_WIND * (ult ? 1.4 : 1) });
          }
        }
        // v378 칠십이변(대성신장 7) — 분신 방패가 때마다 하나씩 다시 찬다 (v443 wshmup에서 옮겨 옴)
        if (this.setBonus().wukong && (this.shWk || 0) < SH.WK_MAX && (this.shWkT = (this.shWkT || 0) + dt) >= SH.WK_SEC) { this.shWkT = 0; this.shWk = (this.shWk || 0) + 1; this.emit('wukongReady', { n: this.shWk }); }
      }
    }
    if (I.kind === 'pvp') {   // v451 회복은 일부만(지난 틱 뒤 오른 몫을 줄인다)
      if (this._pvHp != null && this.heroHp > this._pvHp && this.heroHp > 0) this.heroHp = this._pvHp + (this.heroHp - this._pvHp) * PV.PVP_HEAL;
      this._pvHp = this.heroHp;
    } else this._pvHp = null;
    if (I.kind === 'pvp') {   // v451 상대 초식 — 직업마다 다른 바닥 경고(비켜 서면 안 맞는다) · 세 번째마다 오의
      const b = this.mons.find((m) => m.isBoss && m.alive && !(m.introT > 0));
      if (b && !(b.stun > 0)) {
        I.castT -= dt;
        if (I.castT <= 0) {
          const jp = PV.JOB_PATS[I.opp.j] || PV.JOB_PATS.sword;
          I.castN = (I.castN || 0) + 1;
          const ult = I.castN % 3 === 0;
          const pat = ult ? jp.ult : jp.list[Math.floor(this.rng() * jp.list.length)];
          I.castT = PV.PVP_CAST * (0.85 + this.rng() * 0.3) * (ult ? 1.2 : 1);
          const pct = PV.PVP_SKILL * I.rDmg * PV.takeK(this.s.job) * (ult ? PV.PVP_ULT : 1);
          this.bossCast(b, 1, pct / D.tellDmg(1), [pat], I.opp.sk || null, { delay: PV.PVP_TELL * (ult ? 1.3 : 1), ult });
        }
      }
    }
    if (I.kind === 'tower' || I.kind === 'raid') {
      const b = this.mons.find((m) => m.isBoss && m.alive && !(m.introT > 0));
      if (b && !(b.stun > 0)) {
        I.castT -= dt;
        // 토벌 두목은 35층 수문장만큼의 초식을 약하게 (함께 오래 치는 판이라)
        // v440 바닥 경고 초식 → 이름을 외치고 한 방(강타) — 이름은 그 층 초식에서 하나
        const nameOf = (pats) => { const p = pats[Math.floor(this.rng() * pats.length)]; return D.TELL_NAMES[p] || '강타'; };
        if (I.castT <= 0 && I.hard) { I.castT = D.hardGap(I.stage); this.bossStrike(b, { pct: D.tellDmg(D.hardF(I.stage)) * D.HARD_DMG * W.STRIKE_INST_K, name: nameOf(D.hardPatterns(I.stage)), wind: Math.max(W.STRIKE_WIND, D.hardDelay(I.stage)) }); }
        else if (I.castT <= 0) { const f = I.kind === 'raid' ? 35 : I.stage; I.castT = D.castGap(f) * (I.kind === 'raid' ? 1.3 : 1); this.bossStrike(b, { pct: D.tellDmg(f) * (I.kind === 'raid' ? 0.6 : 1) * W.STRIKE_INST_K, name: nameOf(D.towerPatterns(f)), wind: Math.max(W.STRIKE_WIND, D.tellDelay(f)) }); }
      }
    }
    I.t -= dt;
    // v451 대결은 시간이 끝나면 남은 체력(몫)으로 가른다 — 판정
    if (I.t <= 0 && I.kind === 'pvp') { const b = I.boss, mine = this.heroHp / Math.max(1, this.stats().hp), his = b ? Math.max(0, b.hp) / Math.max(1, b.maxHp) : 1; I.done = { ok: mine > his, timeout: true }; }
    else if (I.t <= 0) I.done = { ok: false, timeout: true };
  }
  instKill(m) {
    const I = this.inst;
    if (I.done) return;
    if (I.kind === 'daily') {
      I.kills++;
      this.respawns.push({ t: D.DAILY_RESPAWN });
      if (I.kills >= I.target) I.done = { ok: true };
    } else if ((I.kind === 'tower' || I.kind === 'raid' || I.kind === 'wraid' || I.kind === 'pvp') && m.isBoss) I.done = { ok: true };
  }
  // 수문장 초식: 그 층의 초식 가운데 하나를 골라 바닥에 경고를 깐다 (D.tellDelay초 뒤 터진다)
  // v439 바람식 두목 「강타」 — 이름을 외치고 STRIKE_WIND초 뒤 무인에게 그대로 내리꽂는다(피하는 바닥 경고 없이).
  //   o.pct: 최대 체력의 몫(받는 피해 감소가 깎는다) · o.abs: 고정 피해(patternHit — 방어·감소가 깎는다)
  bossStrike(b, o) {
    const T = o.wind ?? W.STRIKE_WIND * (o.ult ? 1.5 : 1);
    const pred = o.abs ? this.patternHit(o.abs, b) : 0;
    const cast = this._castSeq = (this._castSeq || 0) + 1;
    this.tells.push({ kind: 'circle', strike: true, x: this.heroX, y: this.heroY, r: o.ult ? 120 : 90, t: T, max: T, dmg: o.pct || 0, abs: o.abs || 0, pred, ult: !!o.ult, wait: 0, cast });
    this.emit('bossCast', { name: o.ult ? `오의 · ${o.name}` : o.name, pat: 'strike', at: b, skill: true, ult: !!o.ult, lethal: pred >= this.heroHp, strike: true });
  }
  bossCast(b, f, dmgMul = 1, pats = D.towerPatterns(f), skillName = null, opt = {}) {
    const p = pats[Math.floor(this.rng() * pats.length)];
    const T = opt.delay ?? D.tellDelay(f);
    const dmg = D.tellDmg(f) * dmgMul;
    const hx = this.heroX, hy = this.heroY;
    const ang = Math.atan2(hy - b.y, hx - b.x);
    // 고정 피해 초식(v168)은 맞으면 얼마나 깎이는지 미리 셈해 둔다 — 쓰러질 만하면 경고에 ☠
    const pred = opt.abs ? this.patternHit(opt.abs, b) : 0;
    // v259: 경고마다 어느 펼침(cast)의 것인지 — 그리는 쪽이 그 초식의 그림을 붙인다(다른 두목·조용한 경고에 옛 그림이 붙지 않게)
    const cast = this._castSeq = (this._castSeq || 0) + 1;
    const add = (o) => this.tells.push({ t: T, max: T, dmg, abs: opt.abs || 0, pred, ult: !!opt.ult, wait: 0, cast, ...o });
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
      case 'cone': add({ kind: 'cone', x: b.x, y: b.y, a: ang, r: 600, half: 0.55 }); break;
      // 파동 (v170): 고리 셋이 한꺼번에 깔리고 안에서부터 차례로 터진다 — 고리 사이 틈(150~260 · 410~520)이 안전한 자리
      case 'ring3': for (let i = 0; i < 3; i++) add({ kind: 'donut', x: b.x, y: b.y, r0: i * 260, r1: i * 260 + 150, t: T + i * 0.35, max: T + i * 0.35 }); break;
      case 'grid': {
        // 검기 그물 — 무인을 지나는 평행선 셋, 조금 뒤 엇갈리는 셋
        const px = -Math.sin(ang), py = Math.cos(ang);
        for (const o of [-210, 0, 210]) { const cx = hx + px * o, cy = hy + py * o; line(ang, 1600, 80, cx - Math.cos(ang) * 800, cy - Math.sin(ang) * 800); }
        const a2 = ang + Math.PI / 2, qx = -Math.sin(a2), qy = Math.cos(a2);
        for (const o of [-210, 0, 210]) { const cx = hx + qx * o, cy = hy + qy * o; line(a2, 1600, 80, cx - Math.cos(a2) * 800, cy - Math.sin(a2) * 800, { wait: 0.55 }); }
        break;
      }
      // ---- v238 화무기 · 마귀 ----
      // 천하일통: 몸을 지나는 칼날 여덟이 차례로 돌며 깔린다 — 도는 쪽을 따라 비켜 서야 한다
      case 'spiral': { const dir = this.rng() < 0.5 ? 1 : -1; for (let i = 0; i < 8; i++) { const a = ang + dir * i * Math.PI / 8; line(a, 1700, 72, b.x - Math.cos(a) * 850, b.y - Math.sin(a) * 850, { wait: i * 0.16 }); } break; }
      // 천라지망: 무인을 둘러싼 원 열 개 — 한 군데만 비었다. 조금 뒤 무인 자리에 하나 더(제자리에 서면 맞는다)
      case 'cage': {
        const gap = Math.floor(this.rng() * 10);
        for (let i = 0; i < 10; i++) { if (i === gap) continue; const a = (i / 10) * Math.PI * 2; add({ kind: 'circle', x: hx + Math.cos(a) * 210, y: hy + Math.sin(a) * 210, r: 80 }); }
        add({ kind: 'circle', r: 120, aim: true, wait: 0.35 });
        break;
      }
      // 붕천 · 나락: 피할 자리 하나만 남기고 온 땅이 무너진다 — 무인에게서 떨어진 곳에 작은 안전 원
      case 'collapse': { const a = this.rng() * Math.PI * 2, d = 230 + this.rng() * 120; add({ kind: 'donut', x: hx + Math.cos(a) * d, y: hy + Math.sin(a) * d, r0: 100, r1: 2600 }); break; }
      // 일점: 무인이 가던 쪽을 앞질러 노린다(멈춰 서면 제자리) + 곧바로 한 줄
      case 'lead': {
        const vx = this.hmove ? W.tileCenter(this.hmove.c) - this.heroX : 0, vy = this.hmove ? W.tileCenter(this.hmove.r) - this.heroY : 0;
        add({ kind: 'circle', x: hx + vx * 2.2, y: hy + vy * 2.2, r: 120 });
        line(Math.atan2(hy + vy * 2.2 - b.y, hx + vx * 2.2 - b.x), 1200, 110, b.x, b.y, { wait: 0.25 });
        break;
      }
      // 자책하기: 스스로를 탓하듯 무인 발밑이 여섯 번 연달아 터진다(쉬지 않고 움직여야) — 마귀도 제 피를 조금 깎는다
      case 'blame': for (let i = 0; i < 6; i++) add({ kind: 'circle', r: 105, aim: true, wait: i * 0.3 }); if (b.hp > b.maxHp * 0.05) b.hp -= b.maxHp * 0.01; break;
      // 도박하기: 네 쪽 가운데 셋이 터진다 — 살 쪽은 하나, 운에 건다(경고가 다 깔려서 보고 피할 수는 있다)
      case 'quad': { const safe = Math.floor(this.rng() * 4); for (let i = 0; i < 4; i++) if (i !== safe) add({ kind: 'cone', x: b.x, y: b.y, a: i * Math.PI / 2 + Math.PI / 4, r: 1500, half: Math.PI / 4 }); break; }
      // 마약하기: 환각 — 넓게 쏟아지는 낙뢰 열넷, 화면이 일렁인다
      case 'haze':
        for (let i = 0; i < 14; i++) { const rr = i === 0 ? 0 : 90 + this.rng() * 340, a = this.rng() * Math.PI * 2; add({ kind: 'circle', x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr, r: 85, wait: i * 0.09 }); }
        this.emit('haze', { sec: 5 });
        break;
      case 'rain':
        for (let i = 0; i < 6; i++) {
          const rr = i === 0 ? 0 : 110 + this.rng() * 220, a = this.rng() * Math.PI * 2;
          add({ kind: 'circle', x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr, r: 80, wait: i * 0.12 });
        }
        break;
      default:
    }
    if (!opt.quiet) this.emit('bossCast', { name: opt.ult ? `오의 · ${skillName}` : skillName || D.TELL_NAMES[p] || p, pat: p, at: b, skill: !!skillName, ult: !!opt.ult, lethal: pred >= this.heroHp, cast });
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
      if (tl.strike) { tl.x = this.heroX; tl.y = this.heroY; }   // v439 강타는 무인을 따라간다(피할 수 없다)
      tl.t -= dt;
      if (tl.t > 0) continue;
      tl.done = true;
      if (boss && !tl.released) { boss.atkAt = this.clock; tl.released = true; }      // 그 자리에서 초식을 펼친다(내딛는 몸짓, v168)
      // v443 칠십이변 — 칠대성 강타는 분신이 대신 맞는다
      if (tl.strike && this.inst?.kind === 'wraid' && this.shWk > 0) { this.shWk--; this.emit('wukongBlock', { x: this.heroX, y: this.heroY, left: this.shWk }); this.emit('tellBoom', { tell: tl, hit: false }); continue; }
      const hit = tl.strike || D.tellCovers(tl, this.heroX, this.heroY);
      if (hit && boss) boss.tellHits = (boss.tellHits || 0) + 1;
      this.emit('tellBoom', { tell: tl, hit });
      if (!hit || this.heroHp <= 0 || this._invulnUntil > this.clock) continue;
      // v255: % 경고 피해에도 호신강기·장비 '받는 피해 감소'를 — 전엔 직업·금신만 곱해 고정 피해(patternHit)와 달랐다
      const pmr = this.pmods();
      const red = (1 - (W.CLASSES[this.s.job]?.dmgRed || 0)) * (1 - (this.buffv.guard || 0)) * (1 - Math.min(0.6, pmr.dmgRed || 0)) * (1 - (st.dmgRed || 0));
      const dmg = tl.abs ? this.patternHit(tl.abs, boss) : st.hp * tl.dmg * (this.inst?.kind === 'pvp' ? Math.max(PV.PVP_RED_MIN, red) : red);
      let left = dmg;
      if (this.shield > 0 && this.buffs.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; }
      this.heroHp -= left;
      this.emit('heroHit', { amount: left, shielded: dmg - left, tell: true });
      if (this.heroHp <= 0) { this.heroDied(boss); break; }
    }
    this.tells = this.tells.filter((t) => !t.done);
  }
  // 고정 피해 초식 한 대가 무인에게 실제로 얼마 — 직업·버프·장비 피해 감소를 곱하고 방어를 뺀다(몹 평타와 같은 셈)
  patternHit(abs, b) {
    const st = this.stats();
    const pm = this.pmods();
    const red = (1 - (W.CLASSES[this.s.job]?.dmgRed || 0)) * (1 - (this.buffv.guard || 0)) * (1 - Math.min(0.6, pm.dmgRed || 0)) * (1 - (st.dmgRed || 0));
    return Math.max(1, abs * red * (b ? this.gapIn(b) : 1) - st.def * 4);
  }
  // 시험용 자동 피하기: 지금 칸이 경고 안이면 가장 가까운 안전한 칸으로
  dodgeStep(react = 0) {
    const live = this.tells.filter((t) => !t.strike && !(t.wait > 0) && t.t <= t.max * (1 - react));   // v439 강타는 피하지 않는다
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
  // v428 길잡이 「문파 토벌에 한 번 참여하자」 단계인데 오늘 몫을 다 썼으면 한 번 더 — 단계를 못 끝내고 다음 날까지 막혔다
  raidBonus() { const c = this.questNow?.(); return c && !c.done && c.q?.id === 'raid' && !this.s.did?.raid ? 1 : 0; }
  raidLeft(now = Date.now()) {
    const r = this.s.raid;
    const cap = D.RAID_PER_DAY + this.raidBonus();
    return r.day === D.kstDay(now) ? Math.max(0, cap - r.n) : cap;
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
  // ---------- v373 월드보스 ----------
  wraidLeft(now = Date.now()) {
    const r = this.s.wraid;
    return r.day === D.kstDay(now) ? Math.max(0, D.WRAID_PER_DAY - r.n) : D.WRAID_PER_DAY;
  }
  // v374 언제든 들어간다 — 참여 보상만 하루 WRAID_PAID판 · v375 옥황상제는 대성신장 일곱을 모두 끼면
  canWraid(hpLeft, now = Date.now(), boss = null) {
    if (this.inst || !this.s.job || this.s.level < D.WRAID_LV || !(hpLeft > 0)) return false;
    if (boss === D.SEOKGA.id) return this.seokgaOpen();
    if (boss === D.OKHWANG.id) return this.okhwangOpen();
    if (D.isGate(boss)) return this.gateOpen(boss);
    return true;
  }
  // v377 남천문 관문 — 대성신장 일곱을 끼고, 앞 관문을 넘었으면
  gateOpen(id) {
    const g = D.WRAID_BOSS[id];
    if (!g?.gate || !this.palmaReady().ok) return false;
    return D.HEAVEN_GATES.filter((x) => x.gate < g.gate).every((x) => this.s.wraid.gates?.[x.id]);
  }
  // v378 천계 이야기 — 이 장이 열렸나 · 읽어서 보상(한 번)
  storyOpen(i) {
    const x = D.HEAVEN_STORY[i];
    if (!x) return false;
    const w = this.s.wraid;
    return x.need === 'palma' ? this.palmaReady().ok : x.need === 'okhwang' ? (w.ok || 0) >= 1 : x.need === 'seokga' ? (w.sk || 0) >= 1 : x.need === 'sk3' ? (w.sk || 0) >= 3 : x.need === 'sk10' ? (w.sk || 0) >= 10
      : x.need === 'awk1' ? Object.values(this.s.awk?.kills || {}).some((n) => n > 0) : x.need === 'awkAll' ? W.AWAKEN_IDS.every((k) => (this.s.awk?.kills?.[k] || 0) > 0) : !!w.gates?.[x.need];   // v413
  }
  storyUnread() { return D.HEAVEN_STORY.filter((_, i) => this.storyOpen(i) && !this.s.wraid.read?.[i]).length; }
  readStory(i) {
    if (!this.storyOpen(i) || this.s.wraid.read?.[i]) return null;
    this.s.wraid.read = { ...(this.s.wraid.read || {}), [i]: 1 };
    const out = this.grant(D.storyReward(this.s.level, i));
    this.emit('storyRead', { i, who: D.HEAVEN_STORY[i].who });
    return out;
  }
  gatesCleared() { return D.HEAVEN_GATES.filter((x) => this.s.wraid.gates?.[x.id]).length; }
  gateBonus() { return this.gatesCleared() * D.GATE_BONUS; }
  // 대성신장 일곱을 모두 끼었나 — { n: 낀 부위 수, ok }
  palmaReady() {
    const n = G.PALMA_SLOTS.filter((sl) => { const it = this.s.equip[sl]; return G.isPalma(it) && (it.plus || 0) >= D.OK_PLUS; }).length;
    return { n, ok: n >= G.PALMA_SLOTS.length };
  }
  // v424 한 번 연 길은 닫히지 않는다 — 옥황상제·석가여래를 한 번 쓰러뜨렸으면 대성신장을 바꿔 껴도(자동 장비가 바꿔도) 그대로 열려 있다
  seokgaOpen() { const w = this.s.wraid; return (w.ok || 0) >= 1 && (this.palmaReady().ok || (w.sk || 0) >= 1); }   // v378 옥황상제를 쓰러뜨리는 데 함께한 자
  okhwangOpen() { return this.gatesCleared() >= D.HEAVEN_GATES.length && (this.palmaReady().ok || (this.s.wraid.ok || 0) >= 1); }   // v377 관문 넷을 넘어야
  // v424 왜 닫혀 있나 — 창에 보여 줄 까닭(null이면 열림)
  heavenLock(which) {
    const w = this.s.wraid, pr = this.palmaReady();
    if (which === 'seokga') {
      if (!(w.ok >= 1)) return '🔒 이 캐릭터로 옥황상제를 쓰러뜨리고 보상을 받은 기록이 없어요(다른 캐릭터로 받았다면 그 캐릭터로 · 기록은 캐릭터마다)';
      if (!pr.ok && !(w.sk >= 1)) return `🔒 대성신장 일곱 부위를 모두 끼고 있어야 해요 — 지금 ${pr.n}/7(가방 › 착용에서 다시 끼면 열려요)`;
      return null;
    }
    if (this.gatesCleared() < D.HEAVEN_GATES.length) return `🔒 남천문 관문 넷을 먼저 — 지금 ${this.gatesCleared()}/4`;
    if (!pr.ok && !(w.ok >= 1)) return `🔒 대성신장 일곱 부위를 모두 끼고 있어야 해요 — 지금 ${pr.n}/7`;
    return null;
  }
  // 화무기 두목의 기본 체력 — 마왕 체력의 잣대(spawnMob과 같은 셈, 맞춤 키우기 빼고)
  hwamugiHp() {
    const m = W.MAPS.find((x) => x.master === 'hwamugi');
    if (!m) return 5e9;
    return D.fieldMobHp(m.lv[1] + 2) * W.BOSS.hp * (m.lord ? W.LORD_HP : 1) * MS.patternHpMult(m);
  }
  // o: { id: 'umawang_3', hpLeft, maxHp } — 서버 문서에서
  startWraid(o, now = Date.now()) {
    const boss = D.wraidBossOfId(o.id || o.day);
    this._shHp = null;   // v387 회복 줄이기 기준을 새 판마다
    if (!this.canWraid(o.hpLeft, now, boss.id)) return false;
    const r = this.s.wraid;
    if (r.day !== D.kstDay(now)) { r.day = D.kstDay(now); r.n = 0; }
    r.n = Math.min(999, r.n + 1);
    // v420 이 캐릭터가 친 판 — 보상은 계정(uid) 단위라 다른 캐릭터가 받아 가던 것(저절로 받기 v418)
    r.part = { ...(r.part || {}), [o.id || o.day]: now };
    { const ks = Object.keys(r.part); if (ks.length > 40) for (const k of ks.sort((a, b) => r.part[a] - r.part[b]).slice(0, ks.length - 40)) delete r.part[k]; }
    const z = W.mapOf(this.s.huntMap).mz || 1;
    this.startInst({ kind: 'wraid', key: o.id || o.day, boss0: boss.id, map: D.wraidMap(boss, this.s.level, z), t: D.WRAID_SEC, max: D.WRAID_SEC, wait: 1.2, castT: 3,
      hpLeft: o.hpLeft, sharedMax: o.maxHp, z, myDealt: 0, sent: 0, paid: r.n <= D.WRAID_PAID });
    // v443 탄막 없이 — 무인은 아래에서 걸어 올라가 친다. 칠십이변 분신 방패는 그대로
    this.bullets = []; this.emitters = []; this.shWk = this.setBonus().wukong ? 1 : 0; this.shWkT = 0; this.shFocus = 0;
    return true;
  }
  // 잡혔을 때 받기 — rank: 피해 순위(1부터). 서버에서 받음 표시를 한 뒤에 부른다.
  //   마왕이면 그 마왕이 맡은 대성신장 한 부위(등급은 순위로 굴린다) · 옥황상제면 순위 보상 ×3
  wraidPart(id) { return !!this.s.wraid.part?.[id]; }   // v420 이 캐릭터가 친 판인가
  wraidClaim(rank, bossId = null) {
    const r = this.s.wraid;
    r.kills++;
    if (rank === 1) r.top1++;
    const b = D.WRAID_BOSS[bossId];
    if (bossId === D.OKHWANG.id) r.ok = (r.ok || 0) + 1;
    if (bossId === D.SEOKGA.id) { r.sk = (r.sk || 0) + 1; this.emit('palmReveal', { n: r.sk }); }   // v383 손바닥 안이었다
    if (D.isGate(bossId) && !r.gates?.[bossId]) { r.gates = { ...(r.gates || {}), [bossId]: 1 }; this._stats = null; this.emit('gateClear', { boss: b.name, n: this.gatesCleared(), bonus: D.GATE_BONUS }); }
    const out = this.grant(D.wraidKillReward(this.s.level, rank, bossId));
    // v409 대성신장 부위는 확률로 — 못 받은 만큼 천장이 쌓인다(그 마왕마다)
    const pity = r.pity || (r.pity = {});
    const drop = b?.slot && ((pity[b.id] || 0) >= D.PALMA_PITY || this.rng() < D.PALMA_DROP(rank));
    if (b?.slot && !drop) { pity[b.id] = (pity[b.id] || 0) + 1; out.miss = { left: D.PALMA_PITY - pity[b.id] + 1 }; }
    if (drop) {
      pity[b.id] = 0;
      const rar = W.rollRarity(D.palmaRarW(rank), this.rng);
      const it = this.makeKing(b.slot, G.PALMA_ZONE, rar, 'palma');
      it.mw = b.id;
      this.gainItem(it);
      out.item = it;
      // v386 낀 대성신장보다 등급이 높으면 바로 바꿔 낀다 — 강화는 이어받는다
      const cur = this.s.equip[b.slot];
      if (this.s.bag.includes(it) && (!cur || (G.isPalma(cur) && (it.rar || 0) > (cur.rar || 0)))) { this.equipFromBag(it.uid); out.equipped = true; this._stats = null; }
      this.emit('palmaPiece', { item: it, boss: b.name });
    }
    this.checkTitles?.();
    return out;
  }
  // v374 함께 — 서버(무림 전체)의 남은 체력으로 내 화면의 마왕을 맞춘다. 아직 안 올린 내 몫은 빼고. 다른 사람이 쓰러뜨렸으면 끝
  wraidSync(serverLeft) {
    const I = this.inst;
    if (I?.kind !== 'wraid' || I.done) return;
    const unsent = (I.myDealt || 0) - (I.sent || 0);
    const b = I.boss;
    if (serverLeft <= 0) { I.done = { ok: true, byOther: true }; return; }
    if (b?.alive) {
      const want = Math.max(1, serverLeft - unsent);
      if (want < b.hp - 1) { const d = b.hp - want; b.hp = want; this.emit('dmg', { amount: d, kind: 'ally', crit: 0, at: b, add: true }); }
    } else if (!b) I.hpLeft = Math.min(I.hpLeft, Math.max(1, serverLeft - unsent));
  }
  wraidUnsent() { const I = this.inst; return I?.kind === 'wraid' ? Math.max(0, (I.myDealt || 0) - (I.sent || 0)) : 0;
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
    let reward = null, fresh0 = false;
    if (I.kind === 'daily') {
      const base = D.dailyReward(I.id, I.stage, this.levelGapMult(D.dailyLv(I.stage)), this.s.level);
      // v302: 새 단계를 깨면 늘 온전히(몫을 썼으면 돌려준다 · 끝없이 오른다). 몫을 쓴 판도 온전히. 둘 다 아니면(추가 도전) 10%.
      // v260: 들어간 날로 센다(끝나는 순간의 시계가 아니라) — 자정을 넘긴 판도 그날 몫
      const today = this.dgnToday(I.now);
      const fresh = ok && I.stage > this.dailyBest(I.id);
      fresh0 = fresh;
      if (fresh && I.full) { today.used[I.id] = Math.max(0, (today.used[I.id] || 0) - 1); I.gotKey = true; }
      const mult = fresh || I.full ? 1 : D.DAILY_EXTRA;
      I.extra = !fresh && !I.full;
      const k = (ok ? 1 : D.DAILY_FAIL * Math.min(1, I.kills / I.target)) * mult;
      reward = k > 0 ? this.grant(base, k) : {};   // v432 하나도 못 잡고 나오면 보상 없음
      if (ok || I.kills > 0) this.tday('daily');   // v432 오늘의 강호 과제는 들어갈 때가 아니라 잡고 나올 때 센다
      if (ok) this.s.dgn.best[I.id] = Math.max(this.dailyBest(I.id), I.stage);
      // v260: 오늘 이 단계에서 졌다(그만두기 빼고) — 자동은 남은 횟수를 같은 단계에 또 쓰지 않고 소탕한다
      else if (!I.done?.left) this.dgnToday(I.now).fail[I.id] = I.stage;
      if (I.done?.left) { const td = this.dgnToday(I.now); (td.left || (td.left = {}))[I.id] = 1; this.s.dgn.pauseUntil = Date.now() + 30 * 60e3; }   // v417 나가기를 누르면 그날 그 던전은 자동(등반 모드도)이 다시 안 들어가고, 자동 던전은 30분 쉰다
    } else if (I.kind === 'tower' && !ok && !I.hard) {
      this.s.tower.failPow = this.stats().power;      // v230: 루틴이 같은 층에서 헛돌지 않게(그만둬도 — 다시 끌려 들어가지 않게)
    } else if (I.kind === 'tower' && ok && I.hard) {
      this.tday('tower');
      if (I.stage > (this.s.tower.hard || 0)) {
        this.s.tower.hard = I.stage;
        this._stats = null;
        reward = this.grant(D.hardReward(I.stage));
        const md = D.hardMountOf(I.stage);
        if (md && !this.s.mounts.some((m) => m.kind === md.id)) { this.gainMount(md.id); I.newMount = md.id; }
      }
    } else if (I.kind === 'tower' && ok && I.corridor) {
      this.tday('tower');
      const c = this.corridorState();
      // v432 판 도중 주가 바뀌었으면(월요일 0시) 그 판은 지난주 몫 — 새 주를 옛 층에서 시작하고 1층~그 층 보상을 건너뛰던 것
      if (I.corWk && I.corWk !== c.key) { /* 새 주는 1층부터 */ }
      else if (I.stage - D.TOWER_MAX > c.best) {
        c.best = I.stage - D.TOWER_MAX;
        const rec = c.best > (c.all || 0);
        c.all = Math.max(c.all || 0, c.best);
        if (rec) { this._stats = null; I.record = true; }
        reward = this.grant(rec ? D.corridorRecordReward(I.stage) : { gold: D.corridorGold(I.stage) });   // v403 새 기록이면 영구 덤 + 보상 크게
      }
    } else if (I.kind === 'tower' && ok && !I.hard) {
      this.tday('tower');
      this.s.tower.floor = Math.max(this.s.tower.floor, I.stage);
      this._stats = null;
      reward = this.grant(D.towerReward(I.stage));
    } else if (I.kind === 'wraid') {
      // v374 내가 준 몫 — 서버에는 그리는 쪽(wmain → WNet)이 아직 안 올린 만큼(unsent) 올린다
      I.dealt = Math.round(I.myDealt || 0);
      I.unsent = Math.max(0, Math.round((I.myDealt || 0) - (I.sent || 0)));
      const spent = Math.max(1, I.max - Math.max(0, I.t));
      if (I.dealt > 0) {
        this.s.wraid.dps = Math.round(I.dealt / spent);
        // v413 판 보상은 싸운 시간만큼(쓰러지면 그때까지 · 마왕이 쓰러지면 다 친 셈) — 참여 보상에 제한이 없어 들어가 한 대 치고 나가기를 되풀이하면 사냥의 몇 배였다
        const tk = I.done?.ok ? 1 : Math.min(1, spent / D.WRAID_SEC);
        if (I.paid) { const jr = D.wraidJoinReward(this.s.level, I.dealt / Math.max(1, I.sharedMax)); reward = this.grant({ gold: Math.round(jr.gold * tk), petShard: Math.round(jr.petShard * tk), mountShard: Math.round(jr.mountShard * tk) }); }
      }
      this.bullets = []; this.emitters = [];
    } else if (I.kind === 'pvp') {
      const P = this.s.pvp, o = I.opp;
      const win = ok;
      I.delta = I.done?.left ? -Math.abs(PV.eloDelta(P.score, o.sc, false)) : PV.eloDelta(P.score, o.sc, win);
      P.score = Math.max(0, P.score + I.delta);
      P.best = Math.max(P.best || 0, P.score);
      if (win) P.win++; else P.lose++;
      P.log.unshift({ n: o.n, j: o.j, w: win, d: I.delta, at: Date.now(), npc: !!o.npc, why: I.done?.timeout ? '판정' : I.done?.left ? '기권' : '' });
      P.log.length = Math.min(P.log.length, PV.LOG_MAX);
      reward = I.done?.left ? null : this.grant(win ? PV.winReward(this.s.level) : PV.loseReward(this.s.level));
      if (win) this.tday?.('pvp');
      I.pvpRes = { win, delta: I.delta, score: P.score, opp: o.n, oppJob: o.j, npc: !!o.npc, oppHp: I.boss ? Math.max(0, I.boss.hp) / Math.max(1, I.boss.maxHp) : 1, uid: o.uid };
    } else if (I.kind === 'raid') {
      // 친 만큼 — 서버에 올리는 건 그리는 쪽(wmain → WNet)이 한다
      I.dealt = I.boss ? Math.max(0, Math.round(I.hpLeft - Math.max(0, I.boss.hp))) : 0;
      const spent = Math.max(1, I.max - Math.max(0, I.t));
      if (I.dealt > 0) {
        this.s.raid.dps = Math.round(I.dealt / spent);
        reward = this.grant(D.raidJoinReward(this.s.level, I.z));
      }
    }
    const res = { kind: I.kind, id: I.id, stage: I.stage, ok, gotKey: !!I.gotKey, extra: !!I.extra, died: !!I.done?.died, timeout: !!I.done?.timeout, left: !!I.done?.left, key: I.key, dealt: I.dealt || 0,
      kills: I.kills || 0, target: I.target || 0, reward, chain: false, unsent: I.unsent || 0, byOther: !!I.done?.byOther, paid: I.paid !== false, hard: !!I.hard, newMount: I.newMount || null, record: !!I.record, pvp: I.pvpRes || null };
    this.inst = null;
    // 탑: 이기고 '이어 오르기'면 다음 층으로
    if (I.kind === 'tower' && ok && I.hard && this.s.tower.auto && !I.done.left && !I.noChain && !I.newMount && this.canHard()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startHard(true);
      return res;
    }
    if (I.kind === 'tower' && ok && I.corridor && this.s.tower.auto && !I.done.left && !I.noChain && this.canCorridor()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startCorridor(true);
      return res;
    }
    if (I.kind === 'tower' && ok && !I.corridor && !I.hard && (this.s.tower.auto || this.s.dgn.routine) && !I.done.left && !I.noChain && this.canTower()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startTower(true);
      return res;
    }
    // v166: 새 단계를 깼으면 자동 도전을 안 켰어도 바로 윗단계로 — 못 깰 때까지 오른다 (v302: 끝없이)
    if (I.kind === 'daily' && fresh0 && !I.done?.left && !I.noChain && this.canDaily(I.id, I.stage + 1, I.now)) {
      res.chain = true; res.next = I.stage + 1;
      this.emit('instEnd', res);
      this.startDaily(I.id, I.stage + 1, I.now);
      return res;
    }
    // 요일 던전: 자동이면 남은 횟수만큼 이어서. **그만두기로 나온 건 안 잇는다** —
    // 그만두려고 눌렀는데 바로 다시 들어가면 나올 길이 없다.
    if (I.kind === 'daily' && !I.done?.left && !I.noChain && this.autoDailyNext()) {
      res.chain = true;
      this.emit('instEnd', res);
      this.startAutoDaily();
      return res;
    }
    // v230: 루틴 — 요일 던전을 다 돌았으면 탑으로 (끝나면 아래에서 사냥터로)
    if (this.s.dgn.routine && I.kind === 'daily' && !I.done?.left && !I.noChain && this.routineNext()?.step === 'tower') {
      res.chain = true;
      this.emit('instEnd', res);
      this.startTower(true);
      return res;
    }
    this.emit('instEnd', res);
    this.enterMap(this.canEnter(this.s.huntMap) ? this.s.huntMap : 0, true);
    // v258: 던전 출입이 공짜 회복이 되지 않게 — 나오면 들어갈 때의 체력으로(던전 안에서 쓴 물약·회복은 던전 몫)
    if (this._hpBeforeInst != null) { this.heroHp = Math.max(1, Math.min(this.stats().hp, this._hpBeforeInst)); this._hpBeforeInst = null; }
    return res;
  }
  // 보상 주기 { exp, gold, mats } × k — 실제로 준 것을 돌려준다
  grant(r, k = 1) {
    const out = {};
    if (r.exp) { out.exp = Math.floor(r.exp * k); this.addExp(out.exp); this.petExp(out.exp * 0.5); }
    if (r.gold) { out.gold = Math.floor(r.gold * k); this.s.gold += out.gold; }
    if (r.tickets) {
      out.tickets = {};
      for (const [tk, n] of Object.entries(r.tickets)) { out.tickets[tk] = n; this.s.zTickets[tk] = (this.s.zTickets[tk] || 0) + n; }   // v435 이름이 배율 k를 가렸다
    }
    if (r.mats) {
      out.mats = {};
      for (const [key, n] of Object.entries(r.mats)) { const v = Math.floor(n * k); if (v > 0) { out.mats[key] = v; this.addMats(key, v); } }
    }
    // v292 조각
    // v432 조각은 곱한 만큼만(내림) — 전엔 최소 1개라 일일 던전에 들어갔다 바로 나가도(k=0) 조각 1·1, 횟수 제한이 없어 무한이었다
    if (r.petShard) { const v = Math.floor(r.petShard * k); if (v > 0) { out.petShard = v; this.addShards(v, 0); } }
    if (r.mountShard) { const v = Math.floor(r.mountShard * k); if (v > 0) { out.mountShard = v; this.addShards(0, v); } }
    return out;
  }

  // ---------- 방치 ----------
  // 최근 벌이를 적어 둔다 — 방치 보상은 '최근 5분처럼 계속 사냥했다면'으로 셈한다
  note(kills, exp, gold, potions) {
    const t = Math.floor(this.wall || 0);   // v438 실제 시간으로 적는다(게임 안 시간은 느리게 흐른다)
    const last = this.ledger[this.ledger.length - 1];
    if (last && last[0] === t) { last[1] += kills; last[2] += exp; last[3] += gold; last[4] += potions; } else this.ledger.push([t, kills, exp, gold, potions]);
    while (this.ledger.length && this.ledger[0][0] < t - W.RATE_WINDOW_SEC) this.ledger.shift();
  }
  rates() {
    if (!this.ledger.length) return null;
    const span = Math.max(30, Math.min(W.RATE_WINDOW_SEC, (this.wall || 0) - this.ledger[0][0]));
    const sum = [0, 0, 0, 0];
    for (const r of this.ledger) for (let i = 0; i < 4; i++) sum[i] += r[i + 1];
    // v260: 두목을 실제로 잡은 빠르기 — 방치 증표는 이것으로(전엔 두목 구역이면 못 잡아도 90초에 하나)
    const bl = this.bossLog || [];
    while (bl.length && bl[0] < (this.wall || 0) - W.RATE_WINDOW_SEC) bl.shift();
    // 창이 짧으면(두목 한 판보다 짧게 봤으면) 최근 처치 하나로 다시 나기 주기를 짐작한다
    const bspan = Math.max(span, (this.bossRespawn() + W.BOSS_MIN_SEC.zone * W.BOSS_REPEAT_K * this.bossTimeK()) / W.PACE);   // v438 실제 초
    return { kills: sum[0] / span, exp: sum[1] / span, gold: sum[2] / span, potions: sum[3] / span, bosses: bl.length / bspan,
      lv: this.s.level, map: this.s.huntMap };
  }
  // 저장할 때 같이 적어 둔다 (다음에 켰을 때 쓴다)
  toJSON() { return { ...this.s, rates: this.rates() || this.s.rates || null }; }

  offlineReward(now = Date.now()) {
    // v254: 시계를 앞으로 돌려 받고 되돌린 뒤 또 앞으로 돌리면 몇 번이고 받았다 — 지금까지 본 가장 늦은 시각(clockMax)부터만 센다
    const from = Math.max(this.s.lastSeen ?? now, this.s.clockMax || 0);
    const sec = Math.min(this.offlineCapSec(), Math.max(0, (now - from) / 1000));
    const r = this.s.rates;
    if (sec < 60 || !r || !(r.kills > 0)) return null;
    // 물약이 바닥나면 거기서 멈춘다
    const potionSec = r.potions > 0 ? this.s.potions / r.potions : Infinity;
    const t = Math.min(sec, potionSec);
    // v260: 오래 비울수록 효율이 준다(OFFLINE_TIERS) — 벌이는 '효율 시간'으로 센다. 물약은 실제 시간만큼 먹는다.
    // v262 무관 증축 '방치 효율'(+5%씩) — 실제 시간을 넘지는 않는다
    const te = Math.min(t, W.offlineEffSec(t) * (1 + 0.05 * (this.s.hall?.eff || 0)));
    // v262 영약 — 남은 시간만큼 벌이 +25% (방치 중에도 닳는다)
    const elix = Math.min(this.s.elixir || 0, t);
    const ek = 1 + W.ELIXIR_BONUS * (t > 0 ? elix / t : 0);
    const kills = Math.floor(r.kills * te);
    // 재료: 처치 수만큼 굴린 기댓값 (장비는 마을 대장장이에게서)
    const m = W.mapOf(r.map);
    const mats = W.MATS[m.mz] ? Math.floor(kills * W.MAT_RATE) : 0;
    // 두목 증표 — v260: 최근 실제로 잡은 빠르기(rates.bosses)로. 그 값이 없는 옛 세이브만 '다시 나기 + 45초에 하나'
    // 은자는 실측(rates)에 두목 은자가 이미 들어 있어 따로 더하지 않는다(전엔 두 번 셌다)
    const bossCap = 1 / (this.bossRespawn(m) + W.BOSS_MIN_SEC.zone * W.BOSS_REPEAT_K * this.bossTimeK());
    const bossRate = r.bosses != null ? Math.min(r.bosses, bossCap) : 1 / (this.bossRespawn(m) + W.BOSS_MIN_SEC.zone);
    const marks = m.bossRoom ? Math.floor(te * bossRate) : 0;
    // v260: 경험치 — 방치 중 레벨이 오르면 접속 때처럼 레벨 차 감쇠가 붙는다(전엔 처음 레벨의 벌이를 끝까지)
    const exp = Math.floor(this.offlineExp(r, te, m) * ek);
    const frag = Math.floor(kills * W.FRAG_RATE + this.rng());   // v275 비급 조각(기댓값 · 남는 몫은 굴린다)
    // v292 포획·탈것 조각 — 졸개 몫 + 두목(잡은 만큼 · 평균)
    const big = m.king || m.master ? 2 : 1;
    const petShard = Math.floor(kills * W.PET_SHARD_RATE + marks * (W.BOSS_SHARDS.pet[0] + W.BOSS_SHARDS.pet[1]) / 2 * big);
    const mountShard = Math.floor(kills * W.MOUNT_SHARD_RATE + marks * (W.BOSS_SHARDS.mount[0] + W.BOSS_SHARDS.mount[1]) / 2 * big);
    return { sec, t, te, eff: t > 0 ? te / t : 1, kills, exp, gold: Math.floor(r.gold * te * ek), elix, frag, petShard, mountShard,
      potions: Math.ceil(r.potions * t), mats, marks, stoppedByPotion: potionSec < sec, map: r.map };
  }
  // 효율 시간 te 동안의 경험치 — 스무 토막으로 나눠 토막마다 그때 레벨의 레벨 차 감쇠를 곱한다
  offlineExp(r, te, m) {
    const mlv = m?.lv ? (m.lv[0] + m.lv[1]) / 2 : null;
    if (!mlv || this.s.level >= W.LEVEL_MAX) return Math.floor(r.exp * te);
    const g0 = this.levelGapMult(mlv) || 1;
    let lv = this.s.level, cur = this.s.exp, out = 0;
    const N = 20, dt = te / N;
    for (let i = 0; i < N; i++) {
      const gap = lv - mlv;
      const g = gap <= 5 ? 1 : Math.max(0.1, 1 - (gap - 5) * 0.08);
      const add = r.exp * dt * (g / g0);
      out += add; cur += add;
      while (lv < W.LEVEL_MAX && cur >= W.expToNext(lv)) { cur -= W.expToNext(lv); lv++; }
    }
    return Math.floor(out);
  }
  offlineCapSec() { return W.OFFLINE_CAP_SEC + 3600 * (this.s.hall?.cap || 0); }
  claimOffline(rw) {
    if (!rw) return;
    if (rw.elix) this.s.elixir = Math.max(0, (this.s.elixir || 0) - rw.elix);
    if (rw.frag > 0) this.gainFrag(rw.frag);
    this.addShards(rw.petShard || 0, rw.mountShard || 0);   // v292
    this.s.gold += rw.gold;
    this.s.potions = Math.max(0, this.s.potions - rw.potions);
    this.addExp(rw.exp);
    this.petExp(rw.exp * 0.5);
    this.s.kills += rw.kills;
    const z = W.mapOf(rw.map).mz;
    this.addMastery(W.mapOf(rw.map).zone, rw.kills);
    // v254: 재료가 0이어도(짧은 방치) 두목 재료는 들어온다
    if (rw.mats || rw.marks) this.addMats(z, (rw.mats || 0) + (rw.marks || 0) * W.BOSS_MATS);
    if (rw.marks) this.addMats(W.bossKey(z), rw.marks);
    if (rw.marks && G.STONES[z]) this.addMats(G.stoneKey(z), rw.marks * G.STONE_PER_BOSS);   // 후반 왕 두목 구역이었다면 강화석도
  }
}

// 길잡이가 보는 '해 봤나' (v146) — 이룬 때만 센다(돌려준 값이 참일 때). always는 부르기만 하면.
for (const [fn, key, always] of [
  ['craftSet', 'set'], ['craftKacc', 'kacc'], ['makeStone', 'stone'], ['enhance', 'enhance'],
  ['sweepDaily', 'sweep'], ['drawZodiac', 'zodiac'], ['buyStatBook', 'book'], ['buyBagSpace', 'bag'], ['startRaid', 'raid'], ['startWraid', 'wraid'],
  ['killTreasure', 'treasure', true], ['moveTo', 'move', true],
  ['convertMats', 'convert'], ['buyProt', 'prot'], ['rerollImpSkill', 'reimp'], ['changeImpSpecial', 'reimp'],
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
    if (m.isBoss && !this.inst) {
      this.mark(this.map.king ? 'king' : 'boss'); (this.bossLog || (this.bossLog = [])).push(this.wall || 0);
      const bk = this.s.bossKills || (this.s.bossKills = {}); bk[this.map.id] = (bk[this.map.id] || 0) + 1;   // v262
      this.noteWeekBoss(m);   // v316 주간 두목 순위
    }
    // v262 비무 별 — 이번 판이 빨랐나 · 안 맞았나
    if (m.isBoss && !this.inst && this.map.master && !m.awk) {   // v421 각성 고수는 비무 별에 안 섞는다(보통 고수의 기록)
      const mm = MS.masterOf(this.map.master);
      const st = this.s.duel.stars || (this.s.duel.stars = {});
      const before = st[mm.id] || 0;
      let f = before;
      if (this.clock - (m.bornAt ?? this.clock) <= MS.starSec(mm)) f |= 1;
      if (!(m.tellHits > 0)) f |= 2;
      if (f !== before) { st[mm.id] = f; this._stats = null; this.emit('duelStar', { id: mm.id, title: mm.title, name: mm.name, fast: !!(f & 1) && !(before & 1), clean: !!(f & 2) && !(before & 2) }); }
    }
    // v407 각성 고수 — 쓰러뜨릴 때마다 보상
    if (m.isBoss && !this.inst && m.awk) {
      const k = this.s.awk.kills; k[m.awk] = (k[m.awk] || 0) + 1;
      const first = k[m.awk] === 1;
      const reward = this.grant(this.awakenReward(m.awk, first));   // v409 처음이면 다섯 배
      const sec = Math.max(1, Math.round((this.clock - (m.bornAt ?? this.clock)) * 10) / 10), bt = this.s.awk.best;
      const best = !(bt[m.awk] > 0) || sec < bt[m.awk]; const prev = bt[m.awk] || null; if (best) bt[m.awk] = sec;   // v409 가장 빨리
      if (best && m.awk === 'magwi') this._wbBest = true;   // 주간 순위(각성 마귀)
      // v413 전용 발밑 문양 — 확률 · 천장(이미 가졌으면 굴리지 않는다)
      let ring = null;
      if (!this.s.awk.rings[m.awk]) {
        const rp = this.s.awk.rpity;
        if ((rp[m.awk] || 0) >= W.AWAKEN_RING_PITY || this.rng() < W.AWAKEN_RING_P) { this.s.awk.rings[m.awk] = 1; delete rp[m.awk]; ring = `awk-${m.awk}`; }
        else rp[m.awk] = (rp[m.awk] || 0) + 1;
      }
      this.emit('awakenDown', { id: m.awk, name: W.AWAKEN[m.awk].name, n: k[m.awk], first, reward, sec, best, prev, ring });
      this.checkTitles?.();
    }
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
  // v255: quiet을 넘긴다 — 전엔 빠져서 불러오자마자·던전이 끝날 때마다 지도 진입 배너가 떴다
  WorldGame.prototype.enterMap = function (id, quiet = false) {
    const r = enter.call(this, id, quiet);
    if (r && !this.map.town) {
      if (this.map.king) this.mark('kingRoom');
      if (W.ZONES_W[this.map.zone]?.pair) this.mark('alt');
    }
    return r;
  };
}
