// 게임 규칙과 상태. DOM을 모르는 순수 로직이라 Node에서도 돌아간다.
import {
  SAVE_VERSION, OFFLINE_CAP_SEC, KILLS_PER_STAGE, BOSS_TIME, SPAWN_DELAY, RAID_TIME, RAID_TICKETS,
  WAVE_MIN_SEC, waveMinSec,
  MERGE_COUNT, GACHA_COST, GACHA10_COST, DAILY_GEMS, START_GEMS, SPEED_CAP, CRIT_CAP,
  UPGRADES, upTotals, GRADES, GACHA_RATES, EQUIP_TYPES, ENHANCE_PER, enhanceCost,
  EQUIP_PIERCE_MAX, EQUIP_PIERCE_MULT, equipPierceCost,
  CODEX_PER_TYPE, CODEX_ALL,
  OPTION_SLOTS, OPTION_STATS, OPTION_GRADE_RATES, OPTION_ROLL_MIN, OPTION_ROLL_MAX,
  optionSlotCount, optionRerollCost, OPTION_SET_GRADE, OPTION_SET, OPTION_SET_FULL_GRADE, OPTION_SET_FULL,
  ACC_SLOTS, ACC_STAR_MAX, ACC_PIERCE_MAX, ACC_MERGE, accPierceCost, accPower,
  ACC_SET_GRADE, ACC_SET, ACC_BOX_RATES, ACC_PICK_MIN, ACC_PICK_RATES,
  ACC_SPECIAL_STAR, accSpecialStep, accSpecialPower,
  CODEX_KINDS, CODEX_GRADE_MULT, CODEX_KIND_FULL, CODEX_ALL_FULL, codexEntryPower, codexGradeOf,
  OUTFITS, OUTFIT_ALL, isOutfitGachaLv, nextOutfitGachaLv,
  GACHA_KINDS, GACHA_LV_MAX, gachaLvNeed, gachaMaxGrade, GACHA_LV_TILT, gachaLvReward,
  SKILL_PIERCE_MAX, SKILL_PIERCE_AT, SKILL_PIERCE_MULT, skillPierceCost, skillTotalBonus,
  PRESET_SLOTS, PRESET_NAMES,
  equipSetBonus, equipTotalBonus,
  EGO_PARTS, EGO_STEP_MAX, EGO_FEED_MIN_GRADE, EGO_FEED_EXP, egoNeed, egoPower,
  EGO_ENCHANT_MAX, EGO_ENCHANT_WORTH, egoEnchantNeed, EGO_ENCHANT_ABIL, egoEnchantPower,
  egoTrialStage, EGO_TRIAL_TIME,
  expPerKill, expToNext, SP_PER_LEVEL, SP_RESET_GEMS, SP_STATS,
  RANKS, RANK_MULT, RANK_SUBS, rankSubLevel, rankPower, rankName, TRIAL_TIME, trialBoss,
  PETS, PET_EGG_COST, PET_GRADE_WEIGHT, petFoodCost, PET_DUPLICATE_FOOD, PET_ATTACK_INTERVAL, petDamageMult,
  petSlotCount,
  BOND_PER_SEC, BOND_PER_LV, BOND_MAX, bondLevel, ENGRAVE_MIN_LV, engraveCost,
  ATTEND_CYCLE, attendReward, BOOST_PER_DAY, BOOST_SEC, BOOST_MULT, mobGroupSize,
  MELEE_RANGE, HERO_SPEED, MOB_SPEED, MOB_SEPARATION, FIELD_ASPECT, FIELD_SQUASH, MOB_SPAWN_NEAR, MOB_SPAWN_FAR,
  refillRate, fieldRadius, MAX_ATTACKERS, FIELD_WIDE, FIELD_TALL, isWallStage,
  WAVE_MAX, waveCount, waveKills, waveDensity, waveReward,
  CC_SLOW_MULT, CC_BLEED_PER, CC_WEAK_MULT,
  SHADOW_TIERS, SHADOW_TRIES, SHADOW_TRY_CAP, SHADOW_TIME, shadowTierOf, shadowStage, weekKey,
  MINE_OPEN_STAGE, MINE_DEPTH_MAX, MINE_HAND_MAX, mineDepthCost, mineHandCost, mineRate, mineCap,
  TOWER_OPEN_STAGE, TOWER_FLOOR_MAX, TOWER_TIME, towerStage, towerReward, TOWER_PER_FLOOR,
  SEEK_PER_DAY, SEEK_CAP, RIFT_TIME, HUNT_TIME, RIFT_OPEN_STAGE, HUNT_OPEN_STAGE,
  riftStage, huntStage, riftReward, huntReward,
  RELICS, RELIC_DIG_COST,
  SKILLS, SKILL_SLOTS, skillSlotCount, skillBookCost,
  skillCd,
  DUNGEONS, DUNGEON_KEYS, DUNGEON_TIME, DUNGEON_MOBS, dungeonStage, dungeonReward,
  DUNGEON_KEY_CAP, RAID_TICKET_CAP, PVP_TICKET_CAP,
  MISSIONS, MISSION_ALL_REWARD, stageMilestone, STAGE_MILESTONE_EVERY,
  PVP_TICKETS, PVP_TIME, PVP_WIN, PVP_LOSE, PVP_REWARD,
  zoneOf, monsterHp, monsterAtk, monsterGold, BOSS_HP_MULT, BOSS_ATK_MULT, BOSS_GOLD_MULT, RAID_BOSS,
  REGRESS_PER_POINT, regressGain, REGRESS_ADVISE_POINTS, REGRESS_STUCK_SEC,
  JOBS, JOB_RANK, JOB_UNLOCK, jobOf, JOB_SKILLS, jobSkillOf, BOON_SKILLS, TASTE_RANK,
  JOB_TESTS, jobTestOf, jobTestStage,
  PASSIVES, passivesOf, passiveId, PASSIVE_MAX, passiveCost,
  NOADS_ATK, NOADS_HP, AD_BOOST_EXTRA,
  bossGems, bossRelicShards, bossBooks, bossStones, guildAtkBonus,
} from './data.js';

export const dayKey = (t = Date.now()) => {
  const d = new Date(t + 9 * 3600 * 1000); // 한국 시간 기준 하루
  return d.toISOString().slice(0, 10);
};

const freshDaily = (date) => ({
  date,
  raidTickets: RAID_TICKETS,
  pvpTickets: PVP_TICKETS,
  keys: Object.fromEntries(DUNGEONS.map((d) => [d.id, DUNGEON_KEYS])),
  missions: {},
  claimed: {},
  allClaimed: false,
  boostUsed: 0,
  adBoostUsed: 0,   // 광고로 받은 기연 — 매일 0으로 돌아간다
});

export function newSave(now = Date.now()) {
  const zero = () => GRADES.map(() => 0);
  return {
    v: SAVE_VERSION,
    nickname: '',
    gold: 0,
    gems: START_GEMS,
    stones: 0,
    books: 0,
    food: 0,
    relicShards: 0,
    stage: 1,
    maxStage: 1,
    bestStage: 1, // 회귀해도 남는 역대 최고 관문
    regress: { count: 0, points: 0 },
    kills: 0,
    wave: 0,        // 이번 관문의 몇 번째 물결인가
    farming: false,
    level: 1,
    exp: 0,
    sp: 0,
    spAlloc: Object.fromEntries(Object.keys(SP_STATS).map((k) => [k, 0])),
    rank: 0,
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    equips: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, zero()])),
    // 병기보: 한 번이라도 손에 쥔 등급(합성해 없어져도 남는다)
    codex: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, GRADES.map(() => 0)])),
    // 장비 옵션 칸: [{ stat, grade, roll } | null] × 4, lock은 다시 굴릴 때 지킬 칸
    options: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, Array(OPTION_SLOTS).fill(null)])),
    optionLock: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, Array(OPTION_SLOTS).fill(false)])),
    // 장신구: 자리마다 끼운 것 하나 + 쌓아둔 조각(등급별 개수)
    // 소환 레벨: 뽑은 횟수가 쌓여 레벨이 오르고, 레벨이 상위 등급을 연다
    gacha: Object.fromEntries(GACHA_KINDS.map((k) => [k.id, { lv: 0, cnt: 0, taken: 0 }])),
    outfits: {},   // 가진 의복 (입지 않아도 효과가 붙는다)
    outfit: null,  // 지금 입은 것 (겉모습만)
    rankSub: 0,    // 경지 안의 소단계 (0~39). 레벨만 차면 바로 오른다.
    passives: {},  // 계열 패시브 레벨 { 'sword-nei': 12, ... }
    petTeam: [],   // 데려가는 영수들. **참말은 여기 하나뿐이다** —
                   // 예전 s.pet(한 마리)은 이 배열의 첫 자리로 옮겼다.
    // 인물도감: 종류×등급 칸을 한 번이라도 채웠는가 (회귀해도 남는다)
    lore: Object.fromEntries(CODEX_KINDS.map((k) => [k.id, GRADES.map(() => 0)])),
    acc: Object.fromEntries(ACC_SLOTS.map((a) => [a.id, null])),      // { grade, star, pierce }
    accBag: Object.fromEntries(ACC_SLOTS.map((a) => [a.id, GRADES.map(() => 0)])),
    accPick: 0,    // 손에 든 선택 상자. 열 때 자리를 고른다.
    enhance: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, 0])),
    equipPierce: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, 0])),
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, 1])),
    tower: { floor: 0 },   // 오른 층 (한 번 오르면 내려가지 않는다)
    seek: SEEK_PER_DAY,    // 균열·탐색에 같이 쓰는 패
    // 한철 광맥: 싸우지 않는 동안에도 쌓인다
    mine: { depth: 0, hands: 0, held: 0, at: now },
    // 그림자 무림: 주마다 초기화되는 티어 도전
    shadow: { week: '', wins: 0, tries: SHADOW_TRIES, taken: -1 },
    // 심검: 장비를 먹여 키우는 전용 무기. { step, exp, ready }
    ego: Object.fromEntries(EGO_PARTS.map((e) => [e.id, { step: 0, exp: 0, ench: 0, enchExp: 0 }])),
    skillPierce: {},   // 무공별 초월 단계
    // 출진 준비: 무공 넷 + 영수를 한 벌로 저장해 두고 바꿔 끼운다
    presets: Array.from({ length: PRESET_SLOTS }, (_, i) => ({ name: PRESET_NAMES[i] || `준비 ${i + 1}`, slots: null, pet: null, auto: true })),
    skillSlots: ['slash', null, null, null],
    job: null,          // 고른 계열 (화경부터)
    jobSeen: [],        // 거쳐 본 계열 — 나중에 각인에 쓴다
    jobTests: {},       // 붙은 전직 시험 { sword: true, ... }
    noAds: false,       // 광고 제거 — 서버(entitlements)가 참말이고 여기는 사본이다
    taste: null,        // 맛보기로 걸어 둔 계열 (화경 전까지)
    loop: null,         // 연속 도전 {kind, id}
    autoSkill: true,
    pets: {},
    pet: null,
    attend: { last: '', streak: 0, claimed: false },  // 연공 일지(출석)
    bond: {},      // 영수별 교감 누적(초)
    engrave: {},   // 영수별 각인된 교감 단계
    relics: {},
    dungeons: Object.fromEntries(DUNGEONS.map((d) => [d.id, 0])), // 클리어한 최고 단계
    milestone: 0,
    pvp: { score: 1000, wins: 0, losses: 0 },
    daily: freshDaily(''),
    guildId: null,
    stats: { kills: 0, bossKills: 0, gold: 0, gachas: 0 },
    lastSeen: now,
    created: now,
  };
}

// 기본값과 같은 것은 백업 코드에서 뺀다. migrate가 어차피 다시 채워 준다.
// 한 겹 안쪽(객체 속 키)까지 본다 — skills·upgrades처럼 대부분이 기본값인 것이 많다.
export function slimSave(save, now = Date.now()) {
  const base = newSave(now);
  // 시각은 기본값과 우연히 같아도 빼면 안 된다 — 방치 보상 계산에 쓴다
  const KEEP = ['lastSeen', 'created', 'climbAt'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const out = {};
  for (const [k, v] of Object.entries(save)) {
    if (KEEP.includes(k)) { out[k] = v; continue; }
    if (k in base && same(v, base[k])) continue;
    const bothPlain = v && typeof v === 'object' && !Array.isArray(v)
      && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
    if (bothPlain) {
      const sub = {};
      for (const [k2, v2] of Object.entries(v)) if (!same(v2, base[k][k2])) sub[k2] = v2;
      if (Object.keys(sub).length) out[k] = sub;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export function migrate(raw, now = Date.now()) {
  const base = newSave(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  for (const key of ['upgrades', 'skills', 'stats', 'spAlloc', 'enhance', 'equipPierce', 'dungeons', 'pvp', 'regress']) {
    s[key] = { ...base[key], ...(raw[key] || {}) };
  }
  // 수련에는 더 이상 상한이 없다. 전에 치명 90 -> 50으로 깎으며 넘치는 레벨을
  // 잘라 냈는데, 이제 그 레벨은 **다음 차수**로 넘어간다 — 잘라내면 안 된다.
  for (const k of Object.keys(UPGRADES)) s.upgrades[k] = Math.max(0, s.upgrades[k] | 0);
  s.daily = { ...freshDaily(raw.daily?.date || ''), ...(raw.daily || {}) };
  s.daily.keys = { ...freshDaily('').keys, ...(raw.daily?.keys || {}) };
  s.equips = { ...base.equips };
  for (const k of Object.keys(EQUIP_TYPES)) {
    const src = raw.equips?.[k];
    if (Array.isArray(src)) s.equips[k] = GRADES.map((_, i) => Math.max(0, src[i] | 0));
  }
  // 병기보가 없던 세이브: 지금 가진 최고 등급까지는 전부 거쳐왔다고 본다.
  // 합성으로 올라간 것이므로 실제로 손에 쥐었던 게 맞다.
  s.codex = { ...base.codex };
  for (const k of Object.keys(EQUIP_TYPES)) {
    const seen = GRADES.map(() => 0);
    const src = raw.codex?.[k];
    if (Array.isArray(src)) {
      GRADES.forEach((_, i) => { if (src[i]) seen[i] = 1; });
    } else {
      let best = -1;
      s.equips[k].forEach((c, g) => { if (c > 0) best = g; });
      for (let g = 0; g <= best; g++) seen[g] = 1;
    }
    s.codex[k] = seen;
  }
  s.tower = { ...base.tower, ...(raw.tower || {}) };
  s.seek = Number.isFinite(raw.seek) ? raw.seek : SEEK_PER_DAY;
  s.mine = { ...base.mine, ...(raw.mine || {}) };
  if (!s.mine.at) s.mine.at = now;
  s.shadow = { ...base.shadow, ...(raw.shadow || {}) };
  s.ego = { ...base.ego };
  for (const e of EGO_PARTS) {
    const src = raw.ego?.[e.id];
    s.ego[e.id] = src && typeof src === 'object'
      ? { step: src.step | 0, exp: src.exp | 0, ench: src.ench | 0, enchExp: src.enchExp | 0 }
      : { step: 0, exp: 0, ench: 0, enchExp: 0 };
  }
  s.presets = Array.from({ length: PRESET_SLOTS }, (_, i) => {
    const src = Array.isArray(raw.presets) ? raw.presets[i] : null;
    const base2 = { name: PRESET_NAMES[i] || `준비 ${i + 1}`, slots: null, pet: null, auto: true };
    if (!src || typeof src !== 'object') return base2;
    return {
      name: String(src.name || base2.name).slice(0, 8),
      slots: Array.isArray(src.slots) ? src.slots.slice(0, SKILL_SLOTS) : null,
      pet: src.pet || null,
      auto: src.auto !== false,
    };
  });
  s.skillPierce = { ...(raw.skillPierce || {}) };
  s.gacha = { ...base.gacha };
  for (const k of GACHA_KINDS) {
    const g2 = raw.gacha?.[k.id];
    s.gacha[k.id] = g2 && typeof g2 === 'object'
      ? { lv: g2.lv | 0, cnt: g2.cnt | 0, taken: g2.taken | 0 } : { lv: 0, cnt: 0, taken: 0 };
  }
  s.outfits = { ...(raw.outfits || {}) };
  // 옛 세이브는 영수를 한 마리만 들고 있었다. 첫 자리로 옮긴다.
  s.petTeam = (Array.isArray(raw.petTeam) ? raw.petTeam : (raw.pet ? [raw.pet] : []))
    .filter((id) => PETS.some((p) => p.id === id));
  s.petTeam = [...new Set(s.petTeam)].slice(0, PETS.length);
  s.outfit = raw.outfit || null;
  s.lore = { ...base.lore };
  for (const k of CODEX_KINDS) {
    const src = raw.lore?.[k.id];
    s.lore[k.id] = GRADES.map((_, i) => (Array.isArray(src) && src[i] ? 1 : 0));
  }
  s.acc = { ...base.acc };
  s.accBag = { ...base.accBag };
  for (const a of ACC_SLOTS) {
    const cur = raw.acc?.[a.id];
    s.acc[a.id] = cur && typeof cur === 'object'
      ? { grade: cur.grade | 0, star: cur.star | 0, pierce: cur.pierce | 0 } : null;
    const bag = raw.accBag?.[a.id];
    s.accBag[a.id] = GRADES.map((_, i) => Math.max(0, (Array.isArray(bag) ? bag[i] : 0) | 0));
  }
  s.accPick = Math.max(0, raw.accPick | 0);
  // 직업: 없는 계열 id가 들어오면 버린다
  s.job = JOBS.some((j) => j.id === raw.job) ? raw.job : null;
  // 전직 시험이 생기기 전 세이브는 시험을 본 적이 없다. 이미 들어간 문파를
  // 시험 때문에 잃으면 안 된다 — 거쳐 본 계열은 전부 붙은 것으로 본다.
  s.noAds = !!raw.noAds;
  s.rankSub = Math.max(0, Math.min(RANK_SUBS - 1, Math.floor(raw.rankSub || 0)));
  s.passives = {};
  for (const pv of PASSIVES) {
    const v = Math.floor(raw.passives?.[passiveId(pv)] || 0);
    if (v > 0) s.passives[passiveId(pv)] = Math.min(PASSIVE_MAX, v);
  }
  s.jobTests = {};
  for (const j of JOBS) if (raw.jobTests?.[j.id]) s.jobTests[j.id] = true;
  for (const id of [raw.job, ...(Array.isArray(raw.jobSeen) ? raw.jobSeen : [])]) {
    if (JOBS.some((j) => j.id === id)) s.jobTests[id] = true;
  }
  s.jobSeen = Array.isArray(raw.jobSeen)
    ? [...new Set(raw.jobSeen.filter((x) => JOBS.some((j) => j.id === x)))] : [];
  if (s.job && !s.jobSeen.includes(s.job)) s.jobSeen.push(s.job);
  s.taste = JOBS.some((j) => j.id === raw.taste) ? raw.taste : null;
  // 연속 도전. 모르는 종류가 들어오면 그냥 끈다.
  const LOOPS = ['dungeon', 'tower', 'rift', 'hunt', 'shadow', 'ego'];
  s.loop = raw.loop && LOOPS.includes(raw.loop.kind)
    ? { kind: raw.loop.kind, id: raw.loop.id ? String(raw.loop.id).slice(0, 16) : null } : null;

  // ---------- 숫자 자리를 숫자로 ----------
  // 백업 코드가 손상되거나 보상 계산 어딘가에서 undefined가 새면 숫자 자리에
  // 숫자가 아닌 게 들어온다. 그 한 자리가 능력치 전체를 NaN으로 만든다 —
  // regress.points가 문자열이면 공격력·체력·은자·경험치가 전부 NaN이 됐다.
  // 한 번 그렇게 되면 세이브를 지우기 전까지 복구가 안 되므로 여기서 막는다.
  const num = (v, def = 0, min = -Infinity) => {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? Math.max(min, n) : def;
  };
  for (const k of ['gold', 'gems', 'stones', 'books', 'food', 'relicShards', 'exp', 'sp', 'seek', 'accPick']) {
    s[k] = num(s[k], 0, 0);
  }
  s.level = Math.max(1, Math.floor(num(s.level, 1, 1)));
  s.rank = Math.min(RANKS.length - 1, Math.max(0, Math.floor(num(s.rank, 0, 0))));
  s.stage = Math.max(1, Math.floor(num(s.stage, 1, 1)));
  s.maxStage = Math.max(1, Math.floor(num(s.maxStage, 1, 1)));
  s.bestStage = Math.max(s.maxStage, Math.floor(num(s.bestStage, 1, 1)));
  s.kills = Math.max(0, Math.floor(num(s.kills, 0, 0)));
  s.wave = Math.max(0, Math.floor(num(s.wave, 0, 0)));
  s.regress = {
    count: Math.max(0, Math.floor(num(s.regress?.count, 0, 0))),
    points: Math.max(0, Math.floor(num(s.regress?.points, 0, 0))),
  };
  s.tower = { ...s.tower, floor: Math.max(0, Math.floor(num(s.tower?.floor, 0, 0))) };
  s.mine = {
    ...s.mine,
    depth: Math.max(0, Math.floor(num(s.mine?.depth, 0, 0))),
    miners: Math.max(0, Math.floor(num(s.mine?.miners, 0, 0))),
    held: num(s.mine?.held, 0, 0),
    at: num(s.mine?.at, now),
  };
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = Math.max(0, Math.floor(num(s.upgrades[k], 0, 0)));
  for (const k of Object.keys(s.spAlloc)) s.spAlloc[k] = Math.max(0, Math.floor(num(s.spAlloc[k], 0, 0)));
  for (const k of Object.keys(s.skills)) s.skills[k] = Math.max(1, Math.floor(num(s.skills[k], 1, 1)));
  for (const k of Object.keys(s.enhance)) s.enhance[k] = Math.max(0, Math.floor(num(s.enhance[k], 0, 0)));
  for (const k of Object.keys(s.equipPierce)) {
    s.equipPierce[k] = Math.min(EQUIP_PIERCE_MAX, Math.max(0, Math.floor(num(s.equipPierce[k], 0, 0))));
  }
  for (const k of Object.keys(s.pets)) s.pets[k] = Math.max(0, Math.floor(num(s.pets[k], 0, 0)));
  for (const k of Object.keys(s.relics)) s.relics[k] = Math.max(0, Math.floor(num(s.relics[k], 0, 0)));
  for (const a of ACC_SLOTS) {
    const c = s.acc[a.id];
    if (!c) continue;
    s.acc[a.id] = {
      grade: Math.min(GRADES.length - 1, Math.max(0, Math.floor(num(c.grade, 0, 0)))),
      star: Math.min(ACC_STAR_MAX, Math.max(0, Math.floor(num(c.star, 0, 0)))),
      pierce: Math.min(ACC_PIERCE_MAX, Math.max(0, Math.floor(num(c.pierce, 0, 0)))),
    };
  }
  for (const e of EGO_PARTS) {
    const x = s.ego[e.id];
    s.ego[e.id] = {
      step: Math.min(EGO_STEP_MAX, Math.max(0, Math.floor(num(x?.step, 0, 0)))),
      exp: Math.max(0, num(x?.exp, 0, 0)),
      ench: Math.min(EGO_ENCHANT_MAX, Math.max(0, Math.floor(num(x?.ench, 0, 0)))),
      enchExp: Math.max(0, num(x?.enchExp, 0, 0)),
    };
  }
  s.options = { ...base.options };
  s.optionLock = { ...base.optionLock };
  for (const k of Object.keys(EQUIP_TYPES)) {
    const src = raw.options?.[k];
    if (Array.isArray(src)) {
      s.options[k] = Array.from({ length: OPTION_SLOTS }, (_, i) => {
        const o = src[i];
        return o && typeof o === 'object'
          ? { stat: o.stat, grade: o.grade | 0, roll: Math.round((o.roll || 1) * 1000) / 1000 }
          : null;
      });
    }
    const lk = raw.optionLock?.[k];
    s.optionLock[k] = Array.from({ length: OPTION_SLOTS }, (_, i) => !!(Array.isArray(lk) && lk[i]));
  }
  s.bestStage = Math.max(raw.bestStage || 1, s.maxStage || 1);
  // 무공 칸은 관문에 따라 열린다(4 → 6). 배열은 늘 최대 길이로 들고 있되,
  // **아직 안 열린 칸은 비워 둔다.**
  //
  // 전에는 SKILL_SLOTS(최대 6)까지 채웠다. 그래서 180관문 전인데도 여섯이
  // 장착돼 자동 시전이 여섯을 다 돌렸다 — 화면에는 네 칸만 보이는데.
  // 칸 수를 4에서 6으로 올리면서 이 경로를 안 고친 탓이다.
  const openSlots = skillSlotCount(s.bestStage);
  if (!Array.isArray(raw.skillSlots)) {
    // v1 → v2: 해금된 무공을 순서대로 장착 (열린 칸만큼만)
    s.skillSlots = SKILLS.filter((sk) => !sk.job && (raw.maxStage || 1) >= sk.unlock)
      .slice(0, openSlots).map((sk) => sk.id);
  }
  while (s.skillSlots.length < SKILL_SLOTS) s.skillSlots.push(null);
  s.skillSlots.length = SKILL_SLOTS;
  for (let i = openSlots; i < SKILL_SLOTS; i++) s.skillSlots[i] = null;
  // 계열 무공은 문파 칸에만 산다. 일반 칸에 섞여 있으면 빼낸다.
  for (let i = 0; i < s.skillSlots.length; i++) {
    if (JOB_SKILLS.some((sk) => sk.id === s.skillSlots[i])) s.skillSlots[i] = null;
  }
  s.pets = { ...(raw.pets || {}) };
  s.attend = { ...base.attend, ...(raw.attend || {}) };
  s.bond = { ...(raw.bond || {}) };
  s.engrave = { ...(raw.engrave || {}) };
  s.relics = { ...(raw.relics || {}) };
  s.v = SAVE_VERSION;
  return s;
}

export class Game {
  constructor(save, now = Date.now()) {
    this.s = migrate(save, now);
    this.guildExp = 0;
    this.events = [];
    this.mode = 'stage';
    this.contest = null;
    this.raid = null; // 하위 호환: 레이드 진행 정보
    this.buffs = { rage: 0, gale: 0, midas: 0 };
    this.cd = Object.fromEntries(SKILLS.map((s) => [s.id, 1.5]));
    this.rng = Math.random;
    this.queue = [];
    this.adds = [];   // (호환) 지금은 mons를 쓴다
    this.mons = [];   // 들판에 흩어진 적들
    this.heroX = 0;   // 무인의 위치(월드 좌표 X)
    this.heroY = 0;   // 무인의 위치(월드 좌표 Y) — 평면이라 위아래로도 움직인다
    this.heroFacing = 1;    // 좌우 반전용(그림)
    this.heroAngle = 0;     // 바라보는 방향(라디안)
    this.walking = false;
    this.respawn = 0; // 다음 적이 나타나기까지
    this.fields = []; // 바닥에 남아 계속 베는 검진·회오리
    this.petTimer = PET_ATTACK_INTERVAL;
    this.atkTimer = 0.3;
    this.heroHp = this.stats().hp;
    this.spawn();
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (this.events.length > 300) this.events.splice(0, this.events.length - 300);
  }

  // ---------- 능력치 ----------
  bestGrade(type) {
    const arr = this.s.equips[type];
    for (let g = arr.length - 1; g >= 0; g--) if (arr[g] > 0) return g;
    return -1;
  }

  // 지금 열려 있는 무공 칸 수
  skillSlotCount() { return skillSlotCount(this.s.bestStage); }

  // ---------- 직업 ----------
  // 화경에 닿으면 고를 수 있다. 언제든 바꿀 수 있고, 바꿔도 잃는 것은 없다.
  jobOpen() { return this.s.rank >= JOB_RANK; }

  // 계열의 문이 열렸는가 (첫 계열은 화경 즉시, 나머지는 관문으로).
  // 문이 열린 것과 들어갈 수 있는 것은 다르다 — 사이에 시험이 있다.
  jobStageOpen(id) {
    const i = JOBS.findIndex((j) => j.id === id);
    if (i < 0) return false;
    return this.jobOpen() && this.s.bestStage >= (JOB_UNLOCK[i] || 0);
  }

  // 들어갈 수 있는가 — 문이 열렸고 시험에 붙었을 때
  jobUnlocked(id) { return this.jobStageOpen(id) && this.jobTestPassed(id); }

  // ---------- 전직 시험 ----------
  jobTestPassed(id) { return !!this.s.jobTests?.[id]; }
  jobTestsPassed() { return JOBS.filter((j) => this.jobTestPassed(j.id)).length; }
  canJobTest(id) {
    return this.jobStageOpen(id) && !this.jobTestPassed(id) && this.mode === 'stage';
  }

  startJobTest(id) {
    if (!this.canJobTest(id)) return false;
    const def = jobTestOf(id);
    if (!def) return false;
    const eq = jobTestStage(this.s.bestStage);
    this.beginContest('jobtest', def.time, {
      job: id, eq, goal: def.goal, need: def.need || 0,
      // 판정에 쓰는 것들. 하나도 새 축이 아니다 — 전부 여기서만 센다.
      kills: 0, hit: 0, bigHit: 0, lowest: 1, casts: 0,
    });
    this.spawnJobTest();
    return true;
  }

  spawnJobTest() {
    const c = this.contest;
    const def = jobTestOf(c.job);
    const wave = c.goal === 'kills';
    const hp = monsterHp(c.eq) * (wave ? def.hpMult : BOSS_HP_MULT * def.hpMult);
    this.mon = {
      hp, maxHp: hp, isBoss: !wave, def: { name: def.boss },
      // 공격을 내 최대 체력의 몇 %로 못박으면 사람이 달라도 같은 시험이 된다
      atk: def.atkHpFrac
        ? this.stats().hp * def.atkHpFrac
        : monsterAtk(c.eq) * (wave ? 1 : BOSS_ATK_MULT) * (def.atkMult || 1),
      atkTimer: def.atkFirst ?? 1.2, alive: true, stun: 0, ...this.duelSpot(),
    };
    this.spawnTimer = 0;
  }

  // 벤 순간 조건을 따진다. 시간이 남아도 조건이 안 맞으면 떨어진다.
  jobTestOk(c) {
    switch (c.goal) {
      case 'noskill': return c.casts === 0;
      case 'lowhp': return c.lowest <= c.need;
      case 'keephp': return c.lowest >= c.need;
      case 'nohit': return c.hit === 0;
      default: return true;      // quick·grind는 시간 안에 벴으면 끝
    }
  }

  // 왜 떨어졌는지 한 줄로. "실패"만 띄우면 뭘 고쳐야 할지 모른다.
  jobTestMiss(c) {
    switch (c.goal) {
      case 'noskill': return '무공을 썼어요';
      case 'lowhp': return '멀쩡한 채로 이겼어요 — 체력이 40% 아래로 내려가야 해요';
      case 'keephp': return '너무 오래 끌어서 체력이 80% 아래로 내려갔어요';
      case 'nohit': return '한 대 맞았어요';
      default: return '시간이 모자랐어요';
    }
  }

  // 겨루기 중 맞은 것을 센다 (환영·취생 판정)
  noteHeroHit() {
    if (this.mode !== 'jobtest' || !this.contest) return;
    this.contest.hit++;
  }

  jobUnlockedCount() { return JOBS.filter((j) => this.jobUnlocked(j.id)).length; }
  jobStageOpenCount() { return JOBS.filter((j) => this.jobStageOpen(j.id)).length; }

  // 맛보기 — 일류부터 화경 전까지. 여덟 계열 무공을 공짜로 바꿔 가며 써 본다.
  // 회귀로 경지가 화경 아래로 내려가도 고른 문파는 그대로 둔다(잃는 게 없어야 한다).
  // 그때 맛보기까지 같이 열리면 화면이 엉킨다 — 문파가 있으면 맛보기는 없다.
  tasteOpen() { return !this.s.job && this.s.rank >= TASTE_RANK && !this.jobOpen(); }

  setTaste(id) {
    if (!this.tasteOpen()) return false;
    if (id !== null && !JOBS.some((j) => j.id === id)) return false;
    this.s.taste = id;
    return true;
  }

  // 지금 문파 칸에 들어가는 무공. 문파를 골랐으면 그 계열, 아니면 맛보기.
  jobSkill() {
    if (this.s.job) return jobSkillOf(this.s.job);
    if (this.tasteOpen() && this.s.taste) return jobSkillOf(this.s.taste);
    return null;
  }

  jobSkillId() { return this.jobSkill()?.id || null; }

  // 다음 계열이 열리는 관문 (없으면 null)
  nextJobAt() {
    if (!this.jobOpen()) return null;
    for (let i = 0; i < JOBS.length; i++) {
      const need = JOB_UNLOCK[i] || 0;
      if (this.s.bestStage < need) return need;
    }
    return null;
  }

  setJob(id) {
    if (id === null) { this.s.job = null; return true; }
    if (!this.jobUnlocked(id)) return false;
    this.s.job = id;
    this.s.taste = null;   // 고른 뒤에는 맛보기가 없다
    if (!this.s.jobSeen.includes(id)) this.s.jobSeen.push(id);
    this.heroHp = Math.min(this.heroHp, this.stats().hp);
    return true;
  }

  job() { return jobOf(this.s.job); }

  // ---------- 출진 준비 ----------
  // 지금 세팅을 그 칸에 담는다
  savePreset(i) {
    const p2 = this.s.presets?.[i];
    if (!p2) return false;
    p2.slots = this.s.skillSlots.slice();
    p2.pet = this.s.pet || null;
    p2.auto = !!this.s.autoSkill;
    return true;
  }

  presetReady(i) { return !!this.s.presets?.[i]?.slots; }

  // 그 칸의 세팅을 꺼내 쓴다. 잠긴 무공은 건너뛴다.
  loadPreset(i) {
    const p2 = this.s.presets?.[i];
    if (!p2?.slots) return false;
    const next = p2.slots.map((id) => {
      if (!id) return null;
      const sk = SKILLS.find((x) => x.id === id);
      return sk && this.skillUnlocked(sk) ? id : null;
    });
    for (let k = 0; k < this.skillSlotCount(); k++) this.s.skillSlots[k] = next[k] ?? null;
    if (p2.pet && this.s.pets?.[p2.pet]) this.s.pet = p2.pet;
    this.s.autoSkill = p2.auto !== false;
    return true;
  }

  renamePreset(i, name) {
    const p2 = this.s.presets?.[i];
    if (!p2) return false;
    p2.name = String(name || '').trim().slice(0, 8) || (PRESET_NAMES[i] || `준비 ${i + 1}`);
    return true;
  }

  // ---------- 성장 안내 ----------
  // 성장 축이 83개다. 공략 한 편이 통째로 "무엇부터 하라"였던 이유가 이것이다.
  // 지금 상태를 보고 다음 할 일 하나를 고른다. 위에서부터 보고 첫 번째로
  // 걸리는 것을 돌려준다 — 순서 자체가 추천이다.
  nextAdvice(now = Date.now()) {
    const s = this.s;
    // 1) 공짜로 받을 수 있는 것부터
    if (this.shadowRewardReady()) return { tab: 'social', sub: 'shadow', text: '그림자 무림 티어 보상을 받으세요' };
    for (const k of GACHA_KINDS) {
      if (this.gachaRewardReady(k.id)) {
        return { tab: k.id === 'equip' ? 'equip' : 'companion', sub: k.id === 'relic' ? 'relic' : k.id === 'pet' ? 'pet' : null,
          text: `${k.name} 레벨 보상이 쌓여 있어요` };
      }
    }
    if (this.mineOpen() && this.mineCap() > 0 && this.mineHeld(now) >= this.mineCap() * 0.9) {
      return { tab: 'dungeon', sub: 'mine', text: '광맥이 가득 찼어요. 거두지 않으면 더 안 쌓여요' };
    }
    if (s.daily && !s.daily.allClaimed && this.missionsReady?.()) {
      return { tab: null, sub: null, text: '일일 의뢰 보상이 남아 있어요' };
    }
    // 2) 쓰지 않으면 사라지거나 상한에 닿는 것
    const keyFull = DUNGEONS.find((d) => this.dungeonUnlocked(d) && (s.daily?.keys?.[d.id] || 0) >= DUNGEON_KEY_CAP);
    if (keyFull) return { tab: 'dungeon', sub: 'dungeon', text: `${keyFull.name} 열쇠가 가득 찼어요. 더 들어와도 버려져요` };
    if ((s.seek || 0) >= SEEK_CAP) return { tab: 'dungeon', sub: 'seek', text: '탐색패가 가득 찼어요' };
    if ((s.shadow?.tries || 0) >= SHADOW_TRY_CAP) return { tab: 'social', sub: 'shadow', text: '그림자 도전이 가득 찼어요' };
    // 3) 켜면 바로 커지는 보유 효과
    for (const type of Object.keys(EQUIP_TYPES)) {
      if (this.optionSlots(type) >= OPTION_SLOTS && this.optionSetGrade(type) < OPTION_SET_GRADE) {
        return { tab: 'equip', sub: null, text: `${EQUIP_TYPES[type].name} 옵션 네 칸을 신품 이상으로 채우면 보유 효과가 켜져요` };
      }
    }
    const outLeft = OUTFITS.filter((o) => !this.hasOutfit(o.id) && s.gems >= o.cost);
    if (outLeft.length) return { tab: 'companion', sub: 'outfit', text: `지금 살 수 있는 의복이 ${outLeft.length}벌 있어요. 갖고만 있어도 효과가 붙어요` };
    // 4) 열렸는데 손도 안 댄 것
    if (this.towerOpen() && this.towerFloor() === 0) return { tab: 'dungeon', sub: 'tower', text: '혈마의 탑이 열렸어요. 오른 층은 영구히 남아요' };
    if (this.egoOpen('blade') && this.egoOf('blade').step === 0) return { tab: 'equip', sub: null, text: '심검이 열렸어요. 장비를 먹여 키우세요' };
    if (this.mineOpen() && (s.mine?.depth || 0) === 0) return { tab: 'dungeon', sub: 'mine', text: '광맥이 열렸어요. 갱도를 파면 싸우지 않아도 한철이 쌓여요' };
    // 5) 올릴 수 있는 것
    for (const e of EGO_PARTS) if (this.egoReady(e.id)) return { tab: 'equip', sub: null, text: `${e.name} 승급에 도전할 수 있어요` };
    if ((this.s.accPick || 0) > 0) return { tab: 'equip', sub: null, text: `선택 상자 ${this.s.accPick}개 — 자리를 골라 열어요` };
    for (const k of Object.keys(EQUIP_TYPES)) if (this.canEquipPierce(k)) return { tab: 'equip', sub: null, text: `${EQUIP_TYPES[k].name}을 초월할 수 있어요` };
    for (const a of ACC_SLOTS) if (this.canAccStar(a.id) || this.canAccGrade(a.id)) return { tab: 'equip', sub: null, text: `${a.name}를 올릴 수 있어요` };
    for (const e of EGO_PARTS) {
      if (!this.egoOpen(e.id)) continue;
      const en = this.egoEnch(e.id);
      if (!en.max && en.exp + this.egoOfferWorth() >= en.need) {
        return { tab: 'equip', sub: null, text: `${e.name}에 남는 장신구를 바칠 수 있어요` };
      }
    }
    if (this.jobOpen() && !this.s.job) {
      return { tab: 'growth', sub: 'job', text: '문파를 고를 수 있어요 — 언제든 바꿀 수 있어요' };
    }
    if (this.canTrial()) return { tab: 'growth', sub: 'rank', text: '경지 돌파에 도전할 수 있어요' };
    // 막혀 있는데 회귀로 받을 게 많으면 그게 답이다.
    // 회귀는 '손해처럼 보이는 이득'이라 안 띄우면 아무도 안 한다.
    if (this.regressWorth()) {
      const gp = this.regressPreview();
      return { tab: 'growth', sub: 'regress', text: `회귀할 때예요 — 전생의 기억 +${gp} (모든 능력 +${Math.round(gp * REGRESS_PER_POINT * 100)}%)` };
    }
    // 6) 평소에 할 것
    if (this.towerOpen() && !this.towerDone()) return { tab: 'dungeon', sub: 'tower', text: `혈마의 탑 ${this.towerNext()}층에 오르세요` };
    return { tab: null, sub: null, text: '관문을 올리세요' };
  }

  // ---------- 혈마의 탑 ----------
  towerOpen() { return this.s.bestStage >= TOWER_OPEN_STAGE; }
  towerFloor() { return this.s.tower?.floor || 0; }
  towerNext() { return this.towerFloor() + 1; }
  towerDone() { return this.towerFloor() >= TOWER_FLOOR_MAX; }

  startTower() {
    if (!this.towerOpen() || this.towerDone() || this.mode !== 'stage') return false;
    const f = this.towerNext();
    const eq = towerStage(f);
    const hp = monsterHp(eq) * BOSS_HP_MULT * 2;
    this.beginContest('tower', TOWER_TIME, { floor: f, eq });
    this.mon = {
      hp, maxHp: hp, isBoss: true, def: { name: `혈마의 탑 ${f}층 수문장` },
      atk: monsterAtk(eq) * BOSS_ATK_MULT, atkTimer: 1.1, alive: true, stun: 0, ...this.duelSpot(),
    };
    return true;
  }

  // ---------- 마기 균열 / 비급 탐색 ----------
  riftOpen() { return this.s.bestStage >= RIFT_OPEN_STAGE; }
  huntOpen() { return this.s.bestStage >= HUNT_OPEN_STAGE; }
  canSeek() { return this.mode === 'stage' && (this.s.seek || 0) > 0; }

  startSeek(kind) {
    const open = kind === 'rift' ? this.riftOpen() : this.huntOpen();
    if (!open || !this.canSeek()) return false;
    this.s.seek--;
    const eq = kind === 'rift' ? riftStage(this.s.bestStage) : huntStage(this.s.bestStage);
    const hp = monsterHp(eq) * BOSS_HP_MULT * (kind === 'rift' ? 1.1 : 0.9);
    this.beginContest(kind, kind === 'rift' ? RIFT_TIME : HUNT_TIME, { eq });
    this.mon = {
      hp, maxHp: hp, isBoss: true,
      def: { name: kind === 'rift' ? '균열의 마기' : '보물을 지키는 자' },
      atk: monsterAtk(eq) * BOSS_ATK_MULT * 0.8, atkTimer: 1.3, alive: true, stun: 0, ...this.duelSpot(),
    };
    return true;
  }

  // ---------- 한철 광맥 ----------
  mineOpen() { return this.s.bestStage >= MINE_OPEN_STAGE; }
  mineRate() { return mineRate(this.s.mine?.depth || 0, this.s.mine?.hands || 0); }
  mineCap() { return mineCap(this.s.mine?.depth || 0, this.s.mine?.hands || 0); }

  // 마지막으로 본 때부터 지금까지 쌓인 양 (상한까지)
  mineHeld(now = Date.now()) {
    const mn = this.s.mine;
    if (!mn || !this.mineOpen()) return 0;
    const sec = Math.max(0, (now - (mn.at || now)) / 1000);
    return Math.min(this.mineCap(), (mn.held || 0) + this.mineRate() * sec);
  }

  collectMine(now = Date.now()) {
    const got = Math.floor(this.mineHeld(now));
    const mn = this.s.mine;
    mn.held = 0;
    mn.at = now;
    if (got > 0) { this.s.stones += got; }
    return got;
  }

  // 깊이·광부를 올리기 전에 지금까지 쌓인 건 확정해 둔다
  mineSettle(now = Date.now()) {
    const mn = this.s.mine;
    mn.held = this.mineHeld(now);
    mn.at = now;
  }

  mineDepthCost() { return mineDepthCost(this.s.mine?.depth || 0); }
  mineHandCost() { return mineHandCost(this.s.mine?.hands || 0); }

  digDeeper(now = Date.now()) {
    const mn = this.s.mine;
    if (!this.mineOpen() || mn.depth >= MINE_DEPTH_MAX) return false;
    const cost = this.mineDepthCost();
    if (this.s.gold < cost) return false;
    this.mineSettle(now);
    this.s.gold -= cost;
    mn.depth++;
    return true;
  }

  hireMiner(now = Date.now()) {
    const mn = this.s.mine;
    if (!this.mineOpen() || mn.depth <= 0 || mn.hands >= MINE_HAND_MAX) return false;
    const cost = this.mineHandCost();
    if (this.s.gold < cost) return false;
    this.mineSettle(now);
    this.s.gold -= cost;
    mn.hands++;
    return true;
  }

  // ---------- 그림자 무림 ----------
  // 주가 바뀌면 티어가 초기화된다. 공략: "매주 티어가 초기화되어 월요일에는
  // 처음부터 다시 보상을 획득하실 수 있으니 꼭 잊지 마세요"
  checkShadowWeek(now = Date.now()) {
    const wk = weekKey(now);
    const s = this.s.shadow;
    if (s.week === wk) return false;
    s.week = wk;
    s.wins = 0;
    s.taken = -1;
    return true;
  }

  shadowTier() { return shadowTierOf(this.s.shadow?.wins || 0); }

  // 아직 안 받은 티어 보상이 있는가
  shadowRewardReady() {
    const s = this.s.shadow;
    return !!s && this.shadowTier() > (s.taken ?? -1);
  }

  claimShadowRewards() {
    const s = this.s.shadow;
    if (!this.shadowRewardReady()) return null;
    const total = {};
    let boxes = 0;
    while ((s.taken ?? -1) < this.shadowTier()) {
      s.taken = (s.taken ?? -1) + 1;
      const r = SHADOW_TIERS[s.taken].reward;
      for (const [k, v] of Object.entries(r)) {
        if (k === 'accBox') { boxes += v; continue; }
        total[k] = (total[k] || 0) + v;
      }
    }
    this.grant(total);
    if (boxes) this.openAccBox(boxes);
    return { ...total, accBox: boxes };
  }

  canShadow() {
    return this.mode === 'stage' && (this.s.shadow?.tries || 0) > 0;
  }

  startShadow() {
    if (!this.canShadow()) return false;
    this.s.shadow.tries--;
    const wins = this.s.shadow.wins || 0;
    const eq = shadowStage(this.s.bestStage, wins);
    const hp = monsterHp(eq) * BOSS_HP_MULT * 1.6;
    this.beginContest('shadow', SHADOW_TIME, { eq });
    this.mon = {
      hp, maxHp: hp, isBoss: true, isHero: true, rank: this.s.rank,
      name: `그림자 ${this.s.nickname || '무인'}`,
      weaponGrade: this.bestGrade('weapon'),
      atk: monsterAtk(eq) * BOSS_ATK_MULT * 0.9, atkTimer: 1.1,
      crit: 0.15, critDmg: 1.8, alive: true, stun: 0, ...this.duelSpot(),
    };
    return true;
  }

  // ---------- 심검 ----------
  egoOf(id) { return this.s.ego?.[id] || { step: 0, exp: 0 }; }

  // 그 부위가 열렸는가. 심의는 심검을 끝내야 열린다.
  egoOpen(id) {
    const def = EGO_PARTS.find((e) => e.id === id);
    if (!def) return false;
    if (def.open) return this.s.bestStage >= def.open;
    const first = EGO_PARTS[0];
    return this.egoOf(first.id).step >= EGO_STEP_MAX;
  }

  egoNeed(id) { return egoNeed(this.egoOf(id).step); }

  // 장비를 먹인다. 남은 양보다 많이 주는 건 그대로 버려지므로,
  // 몇 개가 필요한지 보고 먹이는 판단이 생긴다. (공략: "엄청난 낭비")
  egoFeedCount(id, grade) {
    const e = this.egoOf(id);
    const per = EGO_FEED_EXP[grade] || 0;
    if (!per) return 0;
    return Math.max(0, Math.ceil((this.egoNeed(id) - e.exp) / per));
  }

  feedEgo(id, grade, count = 1) {
    if (!this.egoOpen(id) || grade < EGO_FEED_MIN_GRADE) return 0;
    const e = this.s.ego[id];
    if (e.step >= EGO_STEP_MAX) return 0;
    const need = this.egoNeed(id);
    if (e.exp >= need) return 0;
    const bag = this.s.equips;
    let fed = 0;
    for (let i = 0; i < count; i++) {
      // 어느 부위든 그 등급이 있으면 하나 쓴다
      const type = Object.keys(EQUIP_TYPES).find((k) => bag[k][grade] > 0);
      if (!type) break;
      bag[type][grade]--;
      e.exp = Math.min(need, e.exp + (EGO_FEED_EXP[grade] || 0));
      fed++;
      if (e.exp >= need) break;
    }
    return fed;
  }

  egoReady(id) { return this.egoOf(id).exp >= this.egoNeed(id) && this.egoOf(id).step < EGO_STEP_MAX; }

  // 승급 도전. 이기면 다음 단계가 열리고 경험치는 0부터 다시 시작한다.
  startEgoTrial(id) {
    if (!this.egoReady(id) || this.mode !== 'stage') return false;
    const e = this.egoOf(id);
    const eq = egoTrialStage(this.s.bestStage, e.step);
    const hp = monsterHp(eq) * BOSS_HP_MULT * 2.2;
    this.beginContest('ego', EGO_TRIAL_TIME, { egoId: id, eq });
    this.mon = {
      hp, maxHp: hp, isBoss: true, def: { name: `${EGO_PARTS.find((x) => x.id === id).name}의 그림자` },
      atk: monsterAtk(eq) * BOSS_ATK_MULT, atkTimer: 1.2, alive: true, stun: 0, ...this.duelSpot(),
    };
    return true;
  }

  // ---------- 무공 초월 / 총 레벨 ----------
  skillTotalLevel() {
    return SKILLS.reduce((a, sk) => a + (this.s.skills[sk.id] || 0), 0);
  }

  skillPierceOf(id) { return this.s.skillPierce?.[id] || 0; }

  canSkillPierce(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk)) return false;
    if ((this.s.skills[id] || 0) < SKILL_PIERCE_AT) return false;
    return this.skillPierceOf(id) < SKILL_PIERCE_MAX;
  }

  skillPierceCost(id) { return skillPierceCost(this.skillPierceOf(id)); }

  skillPierce(id) {
    if (!this.canSkillPierce(id)) return false;
    const cost = this.skillPierceCost(id);
    if (this.s.books < cost) return false;
    this.s.books -= cost;
    this.s.skillPierce[id] = this.skillPierceOf(id) + 1;
    return true;
  }

  // 레벨·초월이 붙은 최종 쿨타임
  skillCdOf(sk) {
    const base = skillCd(sk.cd, this.s.skills[sk.id] || 1, this.skillPierceOf(sk.id));
    // 패시브로 더 줄인다. 아무리 쌓아도 원래의 30% 아래로는 안 내려간다 —
    // 0에 닿으면 무공이 끊임없이 나가서 평타·영수가 전부 의미를 잃는다.
    const cut = this.passiveSum().skillCd || 0;
    return Math.max(sk.cd * 0.3, base * (1 - cut));
  }

  // 초월이 붙은 최종 배율
  skillMult(sk) {
    const lv = this.s.skills[sk.id] || 1;
    return sk.mult(lv) * (1 + SKILL_PIERCE_MULT * this.skillPierceOf(sk.id));
  }

  // ---------- 소환 레벨 ----------
  gachaInfo(kind) { return this.s.gacha?.[kind] || { lv: 0, cnt: 0, taken: 0 }; }

  // 뽑은 만큼 쌓고, 넘치면 레벨이 오른다
  addGachaCount(kind, n) {
    const g = this.s.gacha?.[kind];
    if (!g) return 0;
    g.cnt += n;
    let up = 0;
    while (g.lv < GACHA_LV_MAX && g.cnt >= gachaLvNeed(g.lv)) {
      g.cnt -= gachaLvNeed(g.lv);
      g.lv++;
      up++;
    }
    if (up) this.emit('gachaLv', { kind, lv: g.lv });
    return up;
  }

  // 아직 안 받은 레벨 보상이 있는가
  gachaRewardReady(kind) { return this.gachaInfo(kind).lv > this.gachaInfo(kind).taken; }

  // 받지 않은 레벨 보상을 전부 받는다
  claimGachaRewards(kind) {
    const g = this.s.gacha?.[kind];
    if (!g || g.lv <= g.taken) return null;
    const total = {};
    let boxes = 0;
    const outfits = [];
    while (g.taken < g.lv) {
      g.taken++;
      const r = gachaLvReward(kind, g.taken);
      for (const [k, v] of Object.entries(r)) {
        if (k === 'accBox') { boxes += v; continue; }
        total[k] = (total[k] || 0) + v;
      }
      // 병기 소환 레벨이 오르면 의복이 하나씩 온다.
      // 특정 의복을 지정하지 않고 '아직 없는 것 중 첫 번째'를 준다 —
      // 원보로 미리 사 둔 것이 있어도 버려지지 않게.
      if (kind === 'equip' && isOutfitGachaLv(g.taken)) {
        const next = OUTFITS.find((o) => !this.hasOutfit(o.id));
        if (next) { this.s.outfits[next.id] = 1; outfits.push(next); }
      }
    }
    this.grant(total);
    if (boxes) this.openAccBox(boxes);
    return { ...total, accBox: boxes, outfits };
  }

  // ---------- 심검 강화 ----------
  // 가방에서 썩는 장신구를 바쳐 영구 능력을 얻는다.
  egoEnch(id) {
    const e = this.s.ego?.[id] || {};
    const step = e.ench || 0;
    const ab = EGO_ENCHANT_ABIL[id];
    return {
      step,
      exp: e.enchExp || 0,
      need: egoEnchantNeed(step),
      max: step >= EGO_ENCHANT_MAX,
      stat: ab?.stat,
      label: ab?.label,
      amount: egoEnchantPower(id, step),
      nextGain: ab?.per || 0,
    };
  }

  // 가방에 남는 장신구를 전부 합치면 값이 얼마인가
  egoOfferWorth() {
    let w = 0;
    for (const a of ACC_SLOTS) {
      const bag = this.s.accBag?.[a.id] || [];
      bag.forEach((n, gr) => { w += (n || 0) * (EGO_ENCHANT_WORTH[gr] || 0); });
    }
    return w;
  }

  // 자리 id의 심검을 강화한다. 가방의 장신구를 낮은 등급부터 가져간다.
  // 낮은 것부터 쓰는 이유: 높은 등급은 승급에 쓸 수 있으니 남겨 둔다.
  offerAcc(id, all = false) {
    const info = this.egoEnch(id);
    if (!this.egoOpen(id) || info.max) return 0;
    let steps = 0;
    for (;;) {
      const cur = this.egoEnch(id);
      if (cur.max) break;
      let exp = cur.exp;
      const taken = [];
      // 필요한 만큼만 가져간다. **등급이 바깥 루프**라 세 자리의 범품을 전부 쓴 뒤에야
      // 양품으로 넘어간다 — 승급에 쓸 윗등급을 먼저 태우면 손해다.
      outer: for (let gr = 0; gr < EGO_ENCHANT_WORTH.length; gr++) {
        for (const a of ACC_SLOTS) {
          const bag = this.s.accBag?.[a.id];
          if (!bag) continue;
          while (bag[gr] > 0 && exp < cur.need) {
            bag[gr]--;
            exp += EGO_ENCHANT_WORTH[gr] || 0;
            taken.push([a.id, gr]);
            if (exp >= cur.need) break outer;
          }
        }
      }
      if (exp < cur.need) {
        // 모자라면 가져간 것을 돌려놓는다
        for (const [slot, gr] of taken) this.s.accBag[slot][gr]++;
        break;
      }
      this.s.ego[id].ench = cur.step + 1;
      this.s.ego[id].enchExp = exp - cur.need;
      steps++;
      if (!all) break;
    }
    return steps;
  }

  // 아직 못 받은 의복이 몇 레벨에 오는가 (없으면 null)
  nextOutfitAt() {
    if (this.outfitAll()) return null;
    return nextOutfitGachaLv(this.s.gacha?.equip?.taken ?? 0);
  }

  // ---------- 의복 ----------
  hasOutfit(id) { return !!this.s.outfits?.[id]; }
  outfitCount() { return OUTFITS.filter((o) => this.hasOutfit(o.id)).length; }
  outfitAll() { return this.outfitCount() === OUTFITS.length; }

  buyOutfit(id) {
    const o = OUTFITS.find((x) => x.id === id);
    if (!o || this.hasOutfit(id) || this.s.gems < o.cost) return false;
    this.s.gems -= o.cost;
    this.s.outfits[id] = 1;
    if (!this.s.outfit) this.s.outfit = id;
    return true;
  }

  wearOutfit(id) {
    if (id && !this.hasOutfit(id)) return false;
    this.s.outfit = id || null;
    return true;
  }

  // ---------- 인물도감 ----------
  // 쓰러뜨린 상대를 기록한다. 한 번 적히면 지워지지 않는다.
  noteLore(kindId, grade) {
    const row = this.s.lore?.[kindId];
    if (!row || grade < 0 || grade >= row.length || row[grade]) return false;
    row[grade] = 1;
    this.emit('lore', { kind: kindId, grade });
    return true;
  }

  loreCount(kindId) { return (this.s.lore?.[kindId] || []).filter(Boolean).length; }
  loreFull(kindId) { return (this.s.lore?.[kindId] || []).every((v) => v); }

  // ---------- 장신구 ----------
  // 장신구 상자 하나를 연다. 자리는 무작위.
  openAccBox(n = 1) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const slot = ACC_SLOTS[Math.floor(this.rng() * ACC_SLOTS.length)];
      let r = this.rng();
      let grade = 0;
      for (let g = ACC_BOX_RATES.length - 1; g >= 0; g--) {
        if (r < ACC_BOX_RATES[g]) { grade = g; break; }
        r -= ACC_BOX_RATES[g];
      }
      this.s.accBag[slot.id][grade]++;
      out.push({ slot: slot.id, grade });
    }
    this.autoEquipAcc();
    return out;
  }

  // 선택 상자를 연다. 자리를 고르고, 등급은 보품 이상에서 뽑는다.
  openAccPick(slotId, n = 1) {
    const def = ACC_SLOTS.find((a) => a.id === slotId);
    if (!def) return null;
    const have = Math.min(n, this.s.accPick || 0);
    if (have <= 0) return null;
    this.s.accPick -= have;
    const out = [];
    for (let i = 0; i < have; i++) {
      let r = this.rng();
      let g = ACC_PICK_MIN;
      for (let k = 0; k < ACC_PICK_RATES.length; k++) {
        if (r < ACC_PICK_RATES[k]) { g = ACC_PICK_MIN + k; break; }
        r -= ACC_PICK_RATES[k];
        g = ACC_PICK_MIN + k;
      }
      this.s.accBag[slotId][Math.min(g, GRADES.length - 1)]++;
      out.push({ slot: slotId, grade: Math.min(g, GRADES.length - 1) });
    }
    this.autoEquipAcc();
    return out;
  }

  // 한 자리의 특기가 지금 어떤 상태인가
  accSpecial(id) {
    const def = ACC_SLOTS.find((a) => a.id === id);
    if (!def?.special) return null;
    const cur = this.s.acc?.[id];
    const star = cur?.star || 0;
    const pierce = cur?.pierce || 0;
    const step = cur ? accSpecialStep(star, pierce) : 0;
    return {
      ...def.special,
      open: step > 0,
      step,
      need: ACC_SPECIAL_STAR,
      amount: cur ? accSpecialPower(def, star, pierce) : 0,
      // 한 단 더 올리면 얼마나 느는가 (성이든 초월이든 1단이 같은 값이다)
      nextGain: def.special.per,
    };
  }

  // 자리마다 쌓인 것 중 가장 좋은 등급을 끼운다 (비어 있을 때만)
  // 자리마다 가장 센 것을 낀다.
  //
  // 전에는 '비어 있을 때만' 채웠다. 그래서 범품을 끼고 있으면 가방에 천품이
  // 들어와도 영영 안 바꿨고, 승급은 장착한 것과 같은 등급만 재료로 받으므로
  // 그 천품은 쓸 데가 없었다 — 선택 상자로 보품 15·신품 4·천품 1을 받아도
  // 전부 잠겨 있었다. '가락지만 집중해서 올린다'가 성립하지 않던 이유다.
  //
  // 초월은 자리에 붙어 남는다. 한철을 들여 산 것이라 갈아낀다고 날리면 안 된다.
  // (공략에서도 승급과 초월은 별개 축이다)
  autoEquipAcc() {
    for (const a of ACC_SLOTS) {
      const bag = this.s.accBag[a.id];
      let best = -1;
      for (let g = bag.length - 1; g >= 0; g--) if (bag[g] > 0) { best = g; break; }
      if (best < 0) continue;
      const cur = this.s.acc[a.id];
      const pierce = cur?.pierce || 0;
      // 가방 것은 0성이다. 그래도 지금 낀 것보다 세면 바꾼다.
      const now = cur ? accPower(a, cur.grade, cur.star, pierce) : -1;
      const next = accPower(a, best, 0, pierce);
      if (next <= now) continue;
      bag[best]--;
      // 빼낸 것은 가방으로 돌려 둔다 (등급만 남고 성은 사라진다)
      if (cur) bag[cur.grade] = (bag[cur.grade] || 0) + 1;
      this.s.acc[a.id] = { grade: best, star: 0, pierce };
    }
  }

  // 같은 등급 ACC_MERGE개로 한 성 올린다
  canAccStar(id) {
    const cur = this.s.acc?.[id];
    if (!cur || cur.star >= ACC_STAR_MAX) return false;
    return (this.s.accBag?.[id]?.[cur.grade] || 0) >= ACC_MERGE;
  }

  accStarUp(id) {
    if (!this.canAccStar(id)) return false;
    const cur = this.s.acc[id];
    this.s.accBag[id][cur.grade] -= ACC_MERGE;
    cur.star++;
    return true;
  }

  // 6성이 되면 다음 등급으로 올릴 수 있다 (같은 등급 하나를 더 쓴다)
  canAccGrade(id) {
    const cur = this.s.acc?.[id];
    if (!cur || cur.star < ACC_STAR_MAX || cur.grade >= GRADES.length - 1) return false;
    return (this.s.accBag?.[id]?.[cur.grade] || 0) >= 1;
  }

  accGradeUp(id) {
    if (!this.canAccGrade(id)) return false;
    const cur = this.s.acc[id];
    this.s.accBag[id][cur.grade] -= 1;
    cur.grade++;
    cur.star = 0;      // 등급이 오르면 성은 다시 0부터
    return true;       // 초월은 그대로 남는다
  }

  accPierceCost(id) {
    const cur = this.s.acc?.[id];
    if (!cur) return Infinity;
    return accPierceCost(cur.pierce);
  }

  // 초월. 공략이 "하느냐 마느냐 차이가 어마어마"라고 한 것.
  accPierce(id) {
    const cur = this.s.acc?.[id];
    if (!cur || cur.pierce >= ACC_PIERCE_MAX) return false;
    const cost = this.accPierceCost(id);
    if (this.s.stones < cost) return false;
    this.s.stones -= cost;
    cur.pierce++;
    return true;
  }

  // 세 자리를 전부 채우고 전부 이 등급 이상인가
  accSetGrade() {
    let low = 99;
    for (const a of ACC_SLOTS) {
      const cur = this.s.acc?.[a.id];
      if (!cur) return -1;
      low = Math.min(low, cur.grade);
    }
    return low;
  }

  // ---------- 장비 세트 / 총 제련 ----------
  // 세 부위 중 가장 낮은 '최고 등급'. 한 부위만 좋아선 세트가 안 붙는다.
  equipSetGrade() {
    let low = 99;
    for (const type of Object.keys(EQUIP_TYPES)) {
      const b = this.bestGrade(type);
      if (b < 0) return -1;
      low = Math.min(low, b);
    }
    return low;
  }

  equipTotalEnhance() {
    return Object.keys(EQUIP_TYPES).reduce((a, k) => a + (this.s.enhance?.[k] || 0), 0);
  }

  // ---------- 장비 옵션 칸 ----------
  // 제련 단계만큼 칸이 열린다
  optionSlots(type) { return optionSlotCount(this.s.enhance?.[type] || 0); }

  // 지금 켜져 있는 칸만 (열렸고 비지 않은 것)
  activeOptions(type) {
    const n = this.optionSlots(type);
    return (this.s.options?.[type] || []).slice(0, n).filter(Boolean);
  }

  // 네 칸을 전부 이 등급 이상으로 채웠는가
  optionSetGrade(type) {
    if (this.optionSlots(type) < OPTION_SLOTS) return -1;
    const arr = this.s.options?.[type] || [];
    let low = 99;
    for (let i = 0; i < OPTION_SLOTS; i++) {
      if (!arr[i]) return -1;
      low = Math.min(low, arr[i].grade);
    }
    return low;
  }

  optionRerollCost(type) {
    const n = this.optionSlots(type);
    const locked = (this.s.optionLock?.[type] || []).slice(0, n).filter(Boolean).length;
    return optionRerollCost(this.s.enhance?.[type] || 0, locked);
  }

  rollOptionGrade() {
    let r = this.rng();
    for (let g = OPTION_GRADE_RATES.length - 1; g >= 0; g--) {
      if (r < OPTION_GRADE_RATES[g]) return g;
      r -= OPTION_GRADE_RATES[g];
    }
    return 0;
  }

  // 잠그지 않은 칸을 전부 다시 굴린다. 한철을 쓴다.
  rerollOptions(type) {
    const n = this.optionSlots(type);
    if (!n) return null;
    const cost = this.optionRerollCost(type);
    if (this.s.stones < cost) return null;
    this.s.stones -= cost;
    const arr = this.s.options[type];
    const lock = this.s.optionLock[type];
    const out = [];
    for (let i = 0; i < n; i++) {
      if (lock[i] && arr[i]) { out.push(null); continue; }
      const def = OPTION_STATS[Math.floor(this.rng() * OPTION_STATS.length)];
      const grade = this.rollOptionGrade();
      // 소수점을 세 자리로 끊는다. 그냥 두면 0.9017060756683349처럼 18자가 되고,
      // 칸이 12개(3부위 x 4칸)라 백업 코드의 20%를 이 숫자들이 먹었다.
      // 셋째 자리까지면 능력치 차이가 0.1%도 안 된다.
      const roll = Math.round((OPTION_ROLL_MIN + this.rng() * (OPTION_ROLL_MAX - OPTION_ROLL_MIN)) * 1000) / 1000;
      arr[i] = { stat: def.id, grade, roll };
      out.push(arr[i]);
    }
    return { cost, rolled: out };
  }

  toggleOptionLock(type, i) {
    const lock = this.s.optionLock?.[type];
    // 아직 안 열린 칸은 잠글 수 없다 (열린 칸 수는 제련으로 늘어난다)
    if (!lock || i < 0 || i >= this.optionSlots(type)) return false;
    lock[i] = !lock[i];
    return lock[i];
  }

  // 병기보에 적는다. 한 번 적히면 지워지지 않는다.
  noteCodex(type, grade) {
    const seen = this.s.codex?.[type];
    if (!seen || seen[grade]) return false;
    seen[grade] = 1;
    return true;
  }

  codexComplete(type) { return (this.s.codex?.[type] || []).every((v) => v); }
  codexCount(type) { return (this.s.codex?.[type] || []).filter((v) => v).length; }

  equipMult(type) {
    const def = EQUIP_TYPES[type];
    let m = 1;
    const best = this.bestGrade(type);
    if (best >= 0) m += def.equip[best];
    // 보유 효과는 '지금 갖고 있는 것'이 아니라 '병기보에 적힌 것' 기준이다.
    // 개수 기준이면 합성할 때마다 효과가 날아가서 합성이 손해가 된다.
    (this.s.codex?.[type] || []).forEach((v, g) => { if (v) m += def.own[g]; });
    const pierce = this.s.equipPierce?.[type] || 0;
    return m * (1 + ENHANCE_PER * (this.s.enhance[type] || 0)) * (1 + EQUIP_PIERCE_MULT * pierce);
  }

  // 스탯 포인트·펫 보유 효과·유물에서 오는 덧셈 보너스
  mods() {
    const m = { atk: 0, hp: 0, gold: 0, exp: 0, crit: 0, critDmg: 0, boss: 0, bossTime: 0, offline: 0, speed: 0 };
    for (const [k, def] of Object.entries(SP_STATS)) m[k] += (this.s.spAlloc[k] || 0) * def.per;
    for (const pet of PETS) {
      const lv = this.s.pets[pet.id];
      if (!lv) continue;
      // 데리고 다니는 중이면 지금 교감 단계, 아니면 각인해 둔 단계만큼 고유 효과가 오른다
      const bondLv = this.s.pet === pet.id
        ? Math.max(bondLevel(this.s.bond?.[pet.id] || 0), this.s.engrave?.[pet.id] || 0)
        : (this.s.engrave?.[pet.id] || 0);
      m[pet.own[0]] += pet.own[1] * lv * (1 + BOND_PER_LV * bondLv);
    }
    for (const r of RELICS) {
      const lv = this.s.relics[r.id];
      if (lv) m[r.stat] += r.per * lv;
    }
    // 장비 옵션 칸
    for (const type of Object.keys(EQUIP_TYPES)) {
      for (const o of this.activeOptions(type)) {
        const def = OPTION_STATS.find((x) => x.id === o.stat);
        if (!def) continue;
        m[o.stat] += def.per[o.grade] * (o.roll || 1);
      }
      // 네 칸을 신품 이상으로 채우면 보유 효과, 천품이면 한 번 더
      const low = this.optionSetGrade(type);
      if (low >= OPTION_SET_GRADE) for (const [k, v] of Object.entries(OPTION_SET)) m[k] += v;
      if (low >= OPTION_SET_FULL_GRADE) for (const [k, v] of Object.entries(OPTION_SET_FULL)) m[k] += v;
    }

    // 혈마의 탑 — 오른 층은 영구히 남는다
    const tf = this.towerFloor();
    if (tf) for (const [k, v] of Object.entries(TOWER_PER_FLOOR)) m[k] += v * tf;

    // 심검
    for (const e of EGO_PARTS) {
      const cur = this.egoOf(e.id);
      if (cur.step) m[e.stat] += egoPower(cur.step);
    }

    // 장비 세트 — 세 부위를 고르게 맞춰야 붙는다
    const setLow = this.equipSetGrade();
    if (setLow >= 0) {
      const sb = equipSetBonus(setLow);
      for (const [k, v] of Object.entries(sb)) m[k] += v;
    }
    // 총 제련 — 한 부위에 몰아 쓰는 것과 고르게 쓰는 것을 구분한다
    const eb = equipTotalBonus(this.equipTotalEnhance());
    for (const [k, v] of Object.entries(eb)) m[k] += v;

    // 무공 총 레벨 — 슬롯이 넷뿐이라 이게 없으면 안 쓰는 무공은 영영 1레벨이다
    const tb = skillTotalBonus(this.skillTotalLevel());
    for (const [k, v] of Object.entries(tb)) m[k] += v;

    // 의복 — 입은 것과 상관없이 가진 것 전부가 더해진다
    for (const o of OUTFITS) {
      if (!this.hasOutfit(o.id)) continue;
      for (const [k, v] of Object.entries(o.own)) {
        if (m[k] === undefined) m[k] = 0;
        m[k] += v;
      }
    }
    if (this.outfitAll()) for (const [k, v] of Object.entries(OUTFIT_ALL)) m[k] += v;

    // 인물도감
    let loreDone = 0;
    for (const k of CODEX_KINDS) {
      const row = this.s.lore?.[k.id] || [];
      row.forEach((v, g) => {
        if (!v) return;
        const add = codexEntryPower(k, g);
        for (const [kk, vv] of Object.entries(add)) m[kk] += vv;
      });
      if (this.loreFull(k.id)) {
        loreDone++;
        for (const [kk, vv] of Object.entries(CODEX_KIND_FULL)) m[kk] += vv;
      }
    }
    if (loreDone === CODEX_KINDS.length) {
      for (const [kk, vv] of Object.entries(CODEX_ALL_FULL)) m[kk] += vv;
    }

    // 심검 강화 — 바친 장신구가 영구 능력이 된다
    for (const e of EGO_PARTS) {
      const st = this.s.ego?.[e.id]?.ench || 0;
      const ab = EGO_ENCHANT_ABIL[e.id];
      if (st > 0 && ab) m[ab.stat] += egoEnchantPower(e.id, st);
    }

    // 장신구
    for (const a of ACC_SLOTS) {
      const cur = this.s.acc?.[a.id];
      if (!cur) continue;
      m[a.stat] += accPower(a, cur.grade, cur.star, cur.pierce);
      // 특기 — 성이 조건이고, 기본 능력과 다른 축에 붙는다
      if (a.special) m[a.special.stat] += accSpecialPower(a, cur.star, cur.pierce);
    }
    if (this.accSetGrade() >= ACC_SET_GRADE) {
      for (const [k, v] of Object.entries(ACC_SET)) m[k] += v;
    }

    // 병기보 완성 효과
    let done = 0;
    for (const type of Object.keys(EQUIP_TYPES)) if (this.codexComplete(type)) done++;
    if (done) for (const [k, v] of Object.entries(CODEX_PER_TYPE)) m[k] += v * done;
    if (done === Object.keys(EQUIP_TYPES).length) {
      for (const [k, v] of Object.entries(CODEX_ALL)) m[k] += v;
    }
    return m;
  }

  // 경지 + 소단계. 소단계 마흔을 다 채우면 다음 경지와 같은 배율이 된다 —
  // 그래서 돌파 순간에 숫자가 안 튄다.
  rankMult() { return rankPower(this.s.rank, this.s.rankSub); }
  rankLabel() { return rankName(this.s.rank, this.s.rankSub); }

  // 소단계는 레벨만 차면 바로 오른다. 심마는 큰 경지에서만 만난다.
  // 한 번에 여럿 오를 수 있다 — 초반에는 한 레벨에 두세 단씩 오른다.
  tickRankSub() {
    if (this.s.rank >= RANKS.length - 1 && this.s.rankSub >= RANK_SUBS - 1) return 0;
    let up = 0;
    while (this.s.rankSub < RANK_SUBS - 1
      && this.s.level >= rankSubLevel(this.s.rank, this.s.rankSub + 1)) {
      this.s.rankSub++;
      up++;
    }
    if (up) this.emit('rankSubUp', { rank: this.s.rank, sub: this.s.rankSub, up });
    return up;
  }

  // 전생의 기억: 회귀로 쌓은 포인트만큼 공격력·체력·은자·경험치 증가
  regressMult() { return 1 + REGRESS_PER_POINT * (this.s.regress.points || 0); }

  // 고른 계열이 주는 배수. 없으면 전부 1이다.
  //
  // mods()에 더하지 않고 **따로 곱한다.** 지금 m.atk가 27쯤이라 거기에 0.3을
  // 더하면 1%밖에 안 된다 — 장신구 특기에서 그 실수를 한 번 했다.
  // 곱으로 두면 적힌 숫자가 곧 체감이다.
  // ---------- 계열 패시브 ----------
  // 지금 들어간 계열의 것만 켜진다. 문파를 바꾸면 그쪽 패시브로 갈아탄다 —
  // 올려 둔 레벨은 안 없어지므로 돌아오면 그대로다.
  passiveLv(id) { return this.s.passives?.[id] || 0; }
  passiveCostOf(id) { return passiveCost(this.passiveLv(id)); }
  passiveUp(id, times = 1) {
    const pv = PASSIVES.find((x) => passiveId(x) === id);
    if (!pv || pv.job !== this.s.job) return 0;
    let n = 0;
    for (let i = 0; i < times; i++) {
      if (this.passiveLv(id) >= PASSIVE_MAX) break;
      const cost = this.passiveCostOf(id);
      if (this.s.books < cost) break;
      this.s.books -= cost;
      this.s.passives[id] = this.passiveLv(id) + 1;
      n++;
    }
    return n;
  }

  // 켜져 있는 패시브를 축별로 합친다
  passiveSum() {
    const out = {};
    if (!this.s.job) return out;
    for (const pv of passivesOf(this.s.job)) {
      const lv = this.passiveLv(passiveId(pv));
      if (lv > 0) out[pv.stat] = (out[pv.stat] || 0) + pv.per * lv;
    }
    return out;
  }

  jobMult() {
    const j = jobOf(this.s.job);
    const out = { atk: 1, hp: 1, speed: 1, gold: 1, boss: 1, offline: 1, bleed: 1, ccDur: 1, critDmg: 1, exp: 1 };
    const add = { crit: 0, critDmg: 0 };
    if (!j) return { ...out, add };
    for (const [k, v] of Object.entries(j.mult || {})) if (k in out) out[k] = v;
    for (const [k, v] of Object.entries(j.add || {})) if (k in add) add[k] = v;
    return { ...out, add };
  }

  stats({ buffs = true } = {}) {
    const u = this.s.upgrades;
    const m = this.mods();
    const jb = this.jobMult();
    const b = buffs ? this.buffs : {};
    const rage = b.rage > 0 ? SKILLS[1].mult(this.s.skills.rage) : 1;
    const gale = b.gale > 0 ? SKILLS[4].mult(this.s.skills.gale) : 1;
    const midas = b.midas > 0 ? SKILLS[5].mult(this.s.skills.midas) : 1;
    // 계열 무공이 거는 보너스 (취마의 은자, 독마의 경험치)
    let boonGold = 1, boonExp = 1;
    for (const sk of BOON_SKILLS) {
      if (!((b[sk.id] || 0) > 0)) continue;
      const v = sk.boon.mult(this.s.skills[sk.id] || 1);
      if (sk.boon.stat === 'gold') boonGold *= v; else if (sk.boon.stat === 'exp') boonExp *= v;
    }
    const guild = 1 + guildAtkBonus(this.guildExp);
    const rank = this.rankMult();
    const past = this.regressMult();
    // 계열 패시브. 전부 **따로 곱한다** — 다른 배수에 더하면 묻혀서
    // 올려도 체감이 없다(장신구 특기에서 그 실수를 했다).
    const pv = this.passiveSum();
    const pvm = (k) => 1 + (pv[k] || 0);

    const boost = (b.boost || 0) > 0 ? BOOST_MULT : 1;
    // 광고를 지운 사람에게 붙는 영구 보너스. **따로 곱한다** — 더하기로 두면
    // 다른 배수에 묻혀서 산 값을 못 느낀다(장신구 특기에서 겪은 실수다).
    const ad = this.s.noAds ? NOADS_ATK : 1;
    const adHp = this.s.noAds ? NOADS_HP : 1;
    // 수련 아홉 축이 쌓아 준 가산 통계를 한 번에 받는다. 차수가 올라가면
    // 같은 축이 다른 통계를 주므로(혈도 2차는 치명 피해) 축별로 못 읽는다.
    const ua = upTotals(u);
    const atk = UPGRADES.atk.value(u.atk) * this.equipMult('weapon') * (1 + m.atk) * rank * guild * rage * past * boost * jb.atk * ad * pvm('atk');
    const hp = UPGRADES.hp.value(u.hp) * this.equipMult('armor') * (1 + m.hp + (ua.hpAdd || 0)) * rank * past * jb.hp * adHp * pvm('hp');
    const crit = Math.min(CRIT_CAP, (ua.crit || 0) + m.crit + jb.add.crit);
    const critDmg = ((ua.critDmg || 0) + m.critDmg + jb.add.critDmg + (pv.critDmgAdd || 0)) * jb.critDmg;
    const speed = Math.min(SPEED_CAP, ua.speed || 1) * (1 + m.speed) * gale * jb.speed * pvm('speed');
    // 연격 — 쾌검 2차부터 붙는다. 평타 한 대가 그만큼 더 아프다.
    const hitMul = 1 + (ua.hitMul || 0);
    const goldMul = (ua.gold || 1) * this.equipMult('ring') * (1 + m.gold) * midas * past * jb.gold * boonGold * pvm('gold');
    const expMul = (1 + m.exp) * past * jb.exp * boonExp * pvm('exp');
    const bossMul = (1 + m.boss) * jb.boss * pvm('boss');
    // 데려간 영수 전부가 각자 때린다. 하나만 세던 자리다.
    const team = this.petTeam();
    const hits = team.map((p) => ({ pet: p, hit: atk * petDamageMult(p, this.s.pets[p.id] || 1) }));
    const petHit = hits.reduce((a, x) => a + x.hit, 0);
    // 식철수는 때리는 대신 받는 피해를 줄인다
    const guard = team.reduce((a, p) => (p.act === 'shield' ? a * (1 - p.actVal) : a), 1)
      * Math.max(0.2, 1 - (pv.guard || 0) - (ua.guard || 0));   // 아무리 쌓아도 80%까지만
    const dps = atk * speed * hitMul * (1 + crit * (critDmg - 1)) + petHit / PET_ATTACK_INTERVAL;
    return {
      atk, hp, crit, critDmg, speed, hitMul, goldMul, expMul, bossMul, petHit, petHits: hits, guard, dps,
      bossTime: BOSS_TIME + m.bossTime, offlineMul: (1 + m.offline) * jb.offline,
      bleedMult: jb.bleed * pvm('bleed'), ccDurMult: jb.ccDur * pvm('ccDur'),
      skillDmgMult: pvm('skillDmg'), skillCdCut: pv.skillCd || 0,
    };
  }

  // 버프를 뺀 기본 능력치로 계산한 전투력 (랭킹·결투용)
  power() {
    const st = this.stats({ buffs: false });
    return { ...st, power: Math.round(st.dps * 10 + st.hp) };
  }

  // ---------- 몬스터 ----------
  pickMob() {
    const zone = zoneOf(this.s.stage);
    return zone.mobs[Math.floor(this.rng() * zone.mobs.length)];
  }

  fillQueue(make) {
    while (this.queue.length < 3) this.queue.push(make());
  }

  spawn() {
    if (this.mode === 'stage') return this.spawnStage();
    if (this.mode === 'dungeon') return this.spawnDungeon();
    if (this.mode === 'jobtest') return this.spawnJobTest();
    return undefined;
  }

  // ---------- 물결 ----------
  waveTotal() { return waveCount(this.s.stage); }

  // 이번 물결에서 잡아야 하는 수
  waveNeed() { return waveKills(this.s.stage, this.s.wave || 0); }

  // 이번 물결에서 지금까지 잡은 수
  waveDone() {
    let before = 0;
    for (let w = 0; w < (this.s.wave || 0); w++) before += waveKills(this.s.stage, w);
    return Math.max(0, (this.s.kills || 0) - before);
  }

  // 이번 물결 몫을 다 채웠으면 처치를 더 세지 않는다.
  //
  // 이게 없으면 물결 바닥 시간이 아무 소용이 없다 — 광역기 한 방에 80마리가
  // 지워지면서 20처치가 한꺼번에 차고, 물결을 건너뛰고 관문지기가 바로 나왔다.
  // 재 보니 한 관문이 10초였다(설계 목표 45초).
  //
  // 세지 않을 뿐 잡는 건 그대로다. 은자도 경험치도 들어온다.
  // 한 물결이 최소 몇 초 걸리는가. 이미 깬 길은 빨리 지나간다.
  // maxStage는 회귀할 때 1로 돌아간다 — 그걸 쓰면 되돌아가는 길을 못 알아본다.
  // 전생까지 쳐서 가장 멀리 간 bestStage로 봐야 한다.
  waveFloor() { return waveMinSec(this.s.stage, this.s.bestStage); }

  // 관문지기가 길을 막을 때가 됐는가. 마지막 물결에는 advanceWave가 안 걸리므로
  // 여기서도 바닥 시간을 본다.
  bossReady() {
    return (this.s.kills || 0) >= KILLS_PER_STAGE && (this.waveT || 0) >= this.waveFloor();
  }

  countKill() {
    if (this.s.farming) return;
    if ((this.s.kills || 0) >= KILLS_PER_STAGE) return;
    if (this.waveDone() >= this.waveNeed()) return;
    this.s.kills++;
  }

  // 물결이 넘어갈 때가 됐는지 본다. 넘어가면 들판을 비우고 다시 몰려오게 한다.
  advanceWave() {
    const total = this.waveTotal();
    if ((this.s.wave || 0) >= total - 1) return false;
    if (this.waveDone() < this.waveNeed()) return false;
    // 처치 수를 다 채웠어도 바닥 시간은 채워야 넘어간다.
    // 이게 없으면 광역기 한 방에 관문이 끝난다 — 재 보니 10초였다.
    if ((this.waveT || 0) < this.waveFloor()) return false;
    // 넘긴 물결의 보상을 준다
    const got = waveReward(this.s.stage, this.s.wave || 0, total);
    this.grant(got);
    this.s.wave = (this.s.wave || 0) + 1;
    this.waveT = 0;
    // 남아 있던 적은 물러난다
    for (const m of this.mons) m.alive = false;
    this.mons = [];
    this.mon = null;
    this.respawn = 0;
    this.emit('wave', { wave: this.s.wave, total, reward: got });
    return true;
  }

  // 무인과 대상 사이의 거리 — 화면에 보이는 대로 잰다(Y는 눌려 보이므로 함께 누른다)
  distTo(m) { return Math.hypot(m.x - this.heroX, (m.y - this.heroY) * FIELD_SQUASH); }
  // 어떤 방향으로 D만큼 가면 화면에서 얼마나 멀어지는지
  static viewScale(ux, uy) { return Math.hypot(ux, uy * FIELD_SQUASH) || 1; }

  // 들판에 적 하나를 세운다 — 무인 둘레 사방 아무 데나
  makeFieldMob() {
    const s = this.s.stage;
    this.fillQueue(() => this.pickMob());
    const hp = monsterHp(s);
    const ang = this.rng() * Math.PI * 2;
    // 자리는 화면 기준으로 정한다. 가로는 좁고 세로는 긴 타원이라
    // 세로로 긴 화면 안에 최대한 많이 들어온다. 넓게 잡으면 100마리를
    // 만들어놔도 화면엔 몇 마리 안 보인다.
    const far = fieldRadius(mobGroupSize(s));
    // 타원 안에 고르게 흩뿌리려면 sqrt를 써야 한다(그냥 곱하면 가운데로 몰린다)
    const near = Math.min(0.9, MOB_SPAWN_NEAR / Math.max(far, 1));
    const k = near + Math.sqrt(this.rng()) * (1 - near);
    const sy = Math.sin(ang);
    const screenX = Math.cos(ang) * far * FIELD_WIDE * k;
    // 화면 아래쪽은 스킬 슬롯·창 버튼이 덮으므로 아래로는 조금 덜 내보낸다
    const screenY = sy * far * FIELD_TALL * k * (sy > 0 ? 0.78 : 1);
    return {
      hp, maxHp: hp, isBoss: false, def: this.queue.shift(),
      atk: monsterAtk(s), atkTimer: 1 + this.rng(), alive: true, stun: 0,
      x: this.heroX + screenX,
      y: this.heroY + screenY / FIELD_SQUASH,   // 화면 좌표 → 월드 좌표
      face: 1,
    };
  }

  // 적들이 무인 쪽으로 다가오고, 서로 겹치지 않게 밀어낸다
  moveMobs(dt) {
    const live = this.mons;
    for (const m of live) {
      if (!m.alive || m.stun > 0) continue;
      const dx = this.heroX - m.x;
      const dy = this.heroY - m.y;
      const d = Math.hypot(dx, dy) || 1;
      m.face = dx >= 0 ? 1 : -1;
      const k = Game.viewScale(dx / d, dy / d);
      const seen = d * k;                                   // 화면에서 보이는 거리
      const stop = (m.isBoss ? MELEE_RANGE * 0.8 : MELEE_RANGE * 0.85);
      if (seen > stop) {
        const sp = MOB_SPEED * (m.slow > 0 ? CC_SLOW_MULT : 1);   // 둔화
        const step = Math.min(sp * dt, (seen - stop) / k);
        m.x += (dx / d) * step;
        m.y += (dy / d) * step;
      }
    }
    // 서로 밀어내기 — 한 점에 뭉치지 않게.
    // 100마리면 전부 비교할 때 4,950쌍이라, 격자를 만들어 이웃 칸만 본다.
    const cell = MOB_SEPARATION;
    const grid = new Map();
    for (const m of live) {
      if (!m.alive) continue;
      const k = `${Math.floor(m.x / cell)},${Math.floor((m.y * FIELD_SQUASH) / cell)}`;
      const bucket = grid.get(k);
      if (bucket) bucket.push(m); else grid.set(k, [m]);
    }
    for (const [k, bucket] of grid) {
      const ci = k.indexOf(',');
      const cx = +k.slice(0, ci);
      const cy = +k.slice(ci + 1);
      // 자기 칸과 오른쪽·아래 이웃만 보면 모든 쌍을 한 번씩 본다
      for (const [dx0, dy0] of [[0, 0], [1, 0], [0, 1], [1, 1], [1, -1]]) {
        const other = dx0 === 0 && dy0 === 0 ? bucket : grid.get(`${cx + dx0},${cy + dy0}`);
        if (!other) continue;
        for (let i = 0; i < bucket.length; i++) {
          const a = bucket[i];
          if (!a.alive) continue;
          for (let j = other === bucket ? i + 1 : 0; j < other.length; j++) {
            const b = other[j];
            if (!b.alive) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.001) { dx = (this.rng() - 0.5); dy = (this.rng() - 0.5); d = Math.hypot(dx, dy) || 1; }
        const k = Game.viewScale(dx / d, dy / d);
        const seen = d * k;
        if (seen >= MOB_SEPARATION) continue;
        const push = (MOB_SEPARATION - seen) / k / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
          }
        }
      }
    }
  }

  // 들판 유지: 쓰러진 자리는 잠시 뒤 다시 채워진다
  refillField(dt) {
    const live = this.mons.filter((m) => m.alive);
    if (live.length !== this.mons.length) this.mons = live;
    // 물결이 끝났으면 다음 물결로
    if (!this.s.farming && this.advanceWave()) return;
    // 마지막 물결까지 끝내면 관문지기가 길을 막는다
    if (!this.s.farming && this.bossReady() && !live.some((m) => m.isBoss)) {
      this.spawnStage();
      return;
    }
    if (live.some((m) => m.isBoss)) return; // 두목전에는 잡졸이 끼어들지 않는다
    // 뒤쪽 물결일수록 더 몰려온다
    const want = Math.max(1, Math.round(
      mobGroupSize(this.s.stage) * waveDensity(this.s.wave || 0, this.waveTotal()),
    ));
    const missing = want - live.length;
    if (missing <= 0) return;
    // 빈 자리에 비례해 채운다. 광역기로 수십이 한꺼번에 사라져도 2~3초면 다시 찬다.
    this.respawn += refillRate(missing, want) * dt;
    let n = Math.floor(this.respawn);
    if (n <= 0) return;
    this.respawn -= n;
    n = Math.min(n, missing);
    for (let i = 0; i < n; i++) this.mons.push(this.makeFieldMob());
  }

  // 가장 가까운 적을 노린다
  retarget() {
    const live = this.mons.filter((m) => m.alive);
    if (!live.length) { this.mon = null; return null; }
    let best = live[0];
    let bd = this.distTo(best);
    for (const m of live) {
      const d = this.distTo(m);
      if (d < bd) { best = m; bd = d; }
    }
    this.mon = best;
    return best;
  }

  spawnStage() {
    const s = this.s.stage;
    const isBoss = !this.s.farming && this.bossReady();
    this.fillQueue(() => this.pickMob());
    if (isBoss) {
      // 두목은 혼자, 무인 앞쪽에서 기다린다
      const def = zoneOf(s).boss;
      const hp = monsterHp(s) * BOSS_HP_MULT;
      this.mons = [{
        hp, maxHp: hp, isBoss: true, def,
        atk: monsterAtk(s) * BOSS_ATK_MULT,
        atkTimer: 1.2, alive: true, stun: 0,
        x: this.heroX + 150, y: this.heroY - 230, face: 1,
      }];
      this.mon = this.mons[0];
    } else {
      const want = mobGroupSize(s);
      this.mons = [];
      for (let i = 0; i < want; i++) this.mons.push(this.makeFieldMob());
      this.retarget();
    }
    this.adds = [];
    this.bossTimer = isBoss ? this.stats().bossTime : 0;
    this.bossTimeMax = this.bossTimer;
    this.spawnTimer = 0;
    this.waveT = 0;
    this.atkTimer = Math.min(this.atkTimer, 0.3);
    this.fillQueue(() => this.pickMob());
    this.emit('spawn', { isBoss });
  }

  // 살아 있는 적 전부(주 타겟 + 졸개)
  liveMons() {
    const out = [];
    if (this.mon?.alive) out.push(this.mon);
    for (const a of this.adds) if (a.alive) out.push(a);
    return out;
  }

  // ---------- 무공 동작 ----------
  // 살아 있는 적 중 조건에 맞는 것들
  aliveMons() { return (this.mons || []).filter((m) => m.alive); }

  // (x, y)에서 반경 r 안의 적 전부에게 피해
  hitCircle(x, y, r, amount, kind) {
    const rr = r * r;
    let hits = 0;
    for (const m of this.aliveMons()) {
      const dx = m.x - x;
      const dy = (m.y - y) * FIELD_SQUASH;   // 거리는 화면에 보이는 대로 잰다
      if (dx * dx + dy * dy > rr) continue;
      hits++;
      this.damageMob(m, amount, kind);
      if (this.ccNow) this.applyCC(m, this.ccNow.cc, this.ccNow.sec, amount);
    }
    return hits;
  }

  // 무인에서 각도 ang 쪽으로 길이 len, 폭 width인 띠 안의 적 전부
  hitBeam(ang, len, width, amount, kind) {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const half = width / 2;
    let hits = 0;
    for (const m of this.aliveMons()) {
      const dx = m.x - this.heroX;
      const dy = (m.y - this.heroY) * FIELD_SQUASH;
      const along = dx * ux + dy * uy;          // 진행 방향으로 얼마나 갔나
      if (along < -20 || along > len) continue;
      const side = Math.abs(dx * -uy + dy * ux); // 축에서 얼마나 벗어났나
      if (side > half) continue;
      hits++;
      this.damageMob(m, amount, kind);
      if (this.ccNow) this.applyCC(m, this.ccNow.cc, this.ccNow.sec, amount);
    }
    return hits;
  }

  // 상태이상을 건다. 같은 것이 겹치면 더 긴 쪽이 남는다.
  applyCC(m, kind, sec0, amount) {
    if (!m || !kind || !sec0) return;
    // 환마·독마는 상태이상이 더 오래간다
    const sec = sec0 * (this.stats({ buffs: false }).ccDurMult || 1);
    if (kind === 'freeze') { m.stun = Math.max(m.stun || 0, sec); return; }
    if (kind === 'slow') { m.slow = Math.max(m.slow || 0, sec); return; }
    if (kind === 'weak') { m.weak = Math.max(m.weak || 0, sec); return; }
    if (kind === 'bleed') {
      // 독마는 출혈이 더 아프다
      const per = (amount || 0) * CC_BLEED_PER * (this.stats({ buffs: false }).bleedMult || 1);
      // 더 아픈 출혈이 들어오면 갈아끼운다
      if (!m.bleed || per >= (m.bleedPer || 0)) { m.bleed = sec; m.bleedPer = per; }
      else m.bleed = Math.max(m.bleed, sec);
    }
  }

  // 상태이상이 시간에 따라 풀리고, 출혈은 계속 피해를 준다
  tickCC(dt) {
    const one = (m, isMain) => {
      if (!m || !m.alive) return;
      if (m.slow > 0) m.slow = Math.max(0, m.slow - dt);
      if (m.weak > 0) m.weak = Math.max(0, m.weak - dt);
      if (m.bleed > 0) {
        m.bleed = Math.max(0, m.bleed - dt);
        m.hp -= (m.bleedPer || 0) * dt;
        if (m.hp <= 0) { if (isMain) this.killMonster(); else this.killAdd(m); }
      }
    };
    for (const m of this.mons.slice()) one(m, m === this.mon);
    if (this.mon && !this.mons.includes(this.mon)) one(this.mon, true);
  }

  // 적 하나에게 피해. 주 타겟이면 기존 처리를, 아니면 졸개 처리를 탄다.
  damageMob(m, amount, kind) {
    // 파쇄가 걸린 적은 더 아프게 맞는다
    const amt = amount * (m?.weak > 0 ? CC_WEAK_MULT : 1);
    if (m === this.mon) { this.dealDamage(amt, kind, false); return; }
    m.hp -= amt;
    this.emit('dmg', { amount: amt, kind, crit: false, add: true, at: m });
    if (m.hp <= 0) this.killAdd(m);
  }

  // 가까운 적부터 옮겨타며 때린다 (연환벽력)
  castChain(sk, dmg, id) {
    const hit = new Set();
    let from = { x: this.heroX, y: this.heroY };
    let amount = dmg;
    const jumps = sk.chain(this.s.skills[id] || 1);
    const path = [];
    for (let i = 0; i < jumps; i++) {
      let best = null;
      let bd = Infinity;
      for (const m of this.aliveMons()) {
        if (hit.has(m)) continue;
        const dx = m.x - from.x;
        const dy = (m.y - from.y) * FIELD_SQUASH;
        const d = Math.hypot(dx, dy);
        if (d > sk.chainRange || d >= bd) continue;
        best = m; bd = d;
      }
      if (!best) break;
      hit.add(best);
      path.push({ x: best.x, y: best.y });
      this.damageMob(best, amount, id);
      if (this.ccNow) this.applyCC(best, this.ccNow.cc, this.ccNow.sec, amount);
      amount *= sk.chainFalloff;
      from = best;
    }
    this.emit('skillPath', { id, path, kind: 'chain' });
    return hit.size;
  }

  // 앞으로 파고들며 지나간 길의 적을 벤다 (발도돌격)
  castDash(sk, dmg, id) {
    const ang = this.heroAngle || 0;
    const hits = this.hitBeam(ang, sk.dashDist, sk.dashWidth, dmg, id);
    const fromX = this.heroX;
    const fromY = this.heroY;
    // 베는 길이는 그대로 두되, **몸은 목표 앞에서 멈춘다.**
    // 지나쳐 버리면 돌아오느라 때릴 시간을 잃는다 — 재 보니 두목에게 넣는
    // 피해가 오히려 줄었다(x0.96). 발도돌격도 같은 문제를 갖고 있었다.
    const away = this.mon?.alive ? this.distTo(this.mon) - 70 : sk.dashDist;
    const go = Math.max(60, Math.min(sk.dashDist, away));
    this.heroX += Math.cos(ang) * go;
    this.heroY += (Math.sin(ang) * go) / FIELD_SQUASH;
    this.emit('skillPath', { id, kind: 'dash', path: [{ x: fromX, y: fromY }, { x: this.heroX, y: this.heroY }] });
    return hits;
  }

  // 가장 먼 적(두목 우선)에게 순간이동해 일격 (축지참)
  castBlink(sk, dmg, id) {
    const live = this.aliveMons();
    if (!live.length) return 0;
    const boss = live.find((m) => m.isBoss);
    let target = boss;
    if (!target) {
      let bd = -1;
      for (const m of live) {
        const d = Math.hypot(m.x - this.heroX, (m.y - this.heroY) * FIELD_SQUASH);
        if (d > bd) { target = m; bd = d; }
      }
    }
    if (!target) return 0;
    const fromX = this.heroX;
    const fromY = this.heroY;
    // 대상 옆에 선다
    const ang = Math.atan2((target.y - this.heroY) * FIELD_SQUASH, target.x - this.heroX);
    this.heroX = target.x - Math.cos(ang) * MELEE_RANGE * 0.8;
    this.heroY = target.y - (Math.sin(ang) * MELEE_RANGE * 0.8) / FIELD_SQUASH;
    this.heroAngle = ang;
    const amount = dmg * (target.isBoss && sk.bossMult ? sk.bossMult : 1);
    this.damageMob(target, amount, id);
    if (this.ccNow) this.applyCC(target, this.ccNow.cc, this.ccNow.sec, amount);
    this.emit('skillPath', { id, kind: 'blink', path: [{ x: fromX, y: fromY }, { x: this.heroX, y: this.heroY }] });
    return 1;
  }

  // 바닥에 남아 계속 베는 것 (매화검진·선풍장)
  castField(sk, dmg, id, moving) {
    const ang = this.rng() * Math.PI * 2;
    this.fields.push({
      id,
      x: this.heroX,
      y: this.heroY,
      r: sk.radius,
      life: sk.fieldSec,
      max: sk.fieldSec,
      every: sk.tickSec,
      tick: 0,
      amount: dmg,
      cc: sk.cc || null,
      ccSec: sk.ccSec || 0,
      vx: moving ? Math.cos(ang) * sk.moveSpeed : 0,
      vy: moving ? (Math.sin(ang) * sk.moveSpeed) / FIELD_SQUASH : 0,
    });
    return 0;
  }

  updateFields(dt) {
    if (!this.fields.length) return;
    for (const f of this.fields) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.tick -= dt;
      if (f.tick > 0) continue;
      f.tick += f.every;
      this.ccNow = f.cc ? { cc: f.cc, sec: f.ccSec } : null;
      const n = this.hitCircle(f.x, f.y, f.r, f.amount, f.id);
      this.ccNow = null;
    }
    this.fields = this.fields.filter((f) => f.life > 0);
  }

  // 광역 피해: 무인 발밑을 중심으로 한 원 안의 적 전부 (탑다운 — 바닥 장판)
  dealAoe(amount, kind = 'skill', crit = false, radius = 220) {
    const main = this.mon;
    const others = this.mons.filter((m) => m.alive && m !== main && this.distTo(m) <= radius);
    this.emit('skillHits', { hits: others.length + (main?.alive ? 1 : 0) });
    this.dealDamage(amount, kind, crit);
    for (const a of others) {
      if (!a.alive) continue;
      a.hp -= amount;
      this.emit('dmg', { amount, kind, crit, add: true, at: a });
      if (this.ccNow) this.applyCC(a, this.ccNow.cc, this.ccNow.sec, amount);
      if (a.hp <= 0) this.killAdd(a);
    }
  }

  // 졸개 처치: 보상과 관문 진행만 처리한다
  killAdd(a) {
    a.alive = false;
    a.hp = 0;
    const s = this.s.stage;
    const st = this.stats();
    const gold = monsterGold(s) * st.goldMul;
    this.addGold(gold);
    this.addExp(expPerKill(s) * st.expMul);
    this.s.stats.kills++;
    this.progress('kill');
    this.noteLore('mob', codexGradeOf(s));
    this.emit('kill', { gold, isBoss: false, add: true, at: a });
    // 관문지기가 나온 뒤에도 졸개를 잡으면 계속 올랐다(20 기준인데 30까지).
    // 화면은 Math.min으로 가려 뒀지만 값 자체를 막는 게 맞다.
    this.countKill();
  }

  dealDamage(amount, kind = 'hit', crit = false) {
    // 일격(극악소마 시험)은 '한 번에 얼마나'가 전부다. 누적 피해로는 못 잰다.
    if (this.mode === 'jobtest' && this.contest?.goal === 'burst' && this.mon?.maxHp) {
      const c = this.contest;
      c.bigHit = Math.max(c.bigHit, amount / this.mon.maxHp);
      if (c.bigHit >= c.need) return this.endContest('clear');
    }
    const m = this.mon;
    if (!m?.alive) return;
    if (m.isBoss) amount *= this.stats().bossMul;
    if (this.mode === 'raid') {
      this.contest.damage += amount;
      m.hp = Math.max(0, m.hp - amount);
      this.emit('dmg', { amount, kind, crit });
      return;
    }
    m.hp -= amount;
    this.emit('dmg', { amount, kind, crit });
    if (m.hp <= 0) this.killMonster();
  }

  killMonster() {
    const m = this.mon;
    m.alive = false;
    m.hp = 0;
    if (this.mode === 'dungeon') {
      this.contest.kills++;
      this.emit('kill', { gold: 0, isBoss: m.isBoss });
      if (m.isBoss) return this.endContest('clear');
      this.spawnTimer = 0.25;
      return undefined;
    }
    if (this.mode === 'jobtest') {
      const c = this.contest;
      if (c.goal === 'kills') {
        c.kills++;
        this.emit('kill', { gold: 0, isBoss: false });
        if (c.kills >= c.need) return this.endContest('clear');
        this.spawnTimer = 0.15;
        return undefined;
      }
      // 일격은 벨 필요가 없다. 여기까지 왔다면 한 방이 모자랐다는 뜻이다.
      return this.endContest(this.jobTestOk(c) ? 'clear' : 'fail');
    }
    if (this.mode === 'trial') return this.endContest('clear');
    if (this.mode === 'ego') return this.endContest('clear');
    if (this.mode === 'shadow') return this.endContest('clear');
    if (this.mode === 'tower') return this.endContest('clear');
    if (this.mode === 'rift' || this.mode === 'hunt') return this.endContest('clear');
    if (this.mode === 'pvp') return this.endContest('win');

    const s = this.s.stage;
    const st = this.stats();
    const gold = monsterGold(s) * (m.isBoss ? BOSS_GOLD_MULT : 1) * st.goldMul;
    this.addGold(gold);
    this.addExp(expPerKill(s) * (m.isBoss ? 10 : 1) * st.expMul);
    this.s.stats.kills++;
    this.progress('kill');
    this.emit('kill', { gold, isBoss: m.isBoss });
    // 인물도감에 적는다
    this.noteLore(m.isBoss ? 'boss' : 'mob', codexGradeOf(s));
    if (m.isBoss) {
      this.s.stats.bossKills++;
      this.progress('boss');
      this.s.books += 1;
      this.s.stones += 2;
      // 장신구 상자는 벽(관문지기)에서만 나온다. 근거: Blade Idle도 장신구 상자는
      // 특정 스테이지(11-25, 13-50 …)에서부터 떨어지고, 그 자리가 전부 벽이다.
      if (isWallStage(s)) {
        const boxes = this.openAccBox(1 + Math.floor(s / 100));
        this.emit('accBox', { boxes });
        // 백 단위 벽은 선택 상자까지. 여기가 공략이 말한 '집중할 자리를 고르는' 지점이다.
        if (s % 100 === 0) { this.s.accPick++; this.emit('accPick', { n: 1 }); }
      }
      // 관문지기는 **넘을 때마다** 비급과 한철을 준다. 물결 보상과 합쳐
      // 한 관문에서 두 관문치쯤이 들어온다. 옛 관문을 다시 깨도 그 관문의
      // 양이라 지수로 작아지므로 되돌아가 버는 짓은 이득이 안 된다.
      this.s.books += bossBooks(s);
      this.s.stones += bossStones(s);
      if (s >= this.s.maxStage) { // 이번 생에서 처음 넘는 관문
        this.s.climbAt = this.clock || 0;
        const gems = bossGems(s);
        this.s.gems += gems;
        this.s.relicShards += bossRelicShards(s);
        this.emit('gems', { amount: gems });
      }
      this.s.stage = s + 1;
      this.s.maxStage = Math.max(this.s.maxStage, this.s.stage);
      this.s.bestStage = Math.max(this.s.bestStage, this.s.maxStage);
      this.s.kills = 0;
      this.s.wave = 0;
      this.autoSlotSkills();
      this.emit('stageClear', { stage: s });
    } else {
      this.countKill();
    }
    // 들판에서는 다음 적을 알아서 찾아간다
    if (this.mode === 'stage') {
      this.mons = this.mons.filter((x) => x.alive);
      this.retarget();
      return undefined;
    }
    this.spawnTimer = SPAWN_DELAY;
    return undefined;
  }

  clearAdds() { this.adds = []; }

  heroDied() {
    this.s.wave = 0;
    // 겨루기 중에 쓰러지면 그 자리에서 끝난다.
    //
    // 전에는 수련터·시련·결투만 처리했다. 그래서 탑·균열·탐색·그림자·심검에서는
    // 죽어도 안 끝나고, 제한시간이 다 될 때까지 **빈 화면을 35초쯤 보다가** 풀렸다.
    // 게다가 아래 farming 처리까지 타고 내려가서, 들판으로 돌아왔을 때
    // farming이 켜진 채였다 — 관문지기를 다시 부르기 전까지 관문이 안 올라간다.
    // 탑에서 한 번 지면 진행이 멈춘 것처럼 보이던 이유다.
    if (this.contest) {
      if (this.mode === 'pvp') return this.endContest('lose');
      if (this.mode === 'raid') return this.endContest('done');   // 토벌은 넣은 피해를 기록한다
      return this.endContest('fail');
    }
    const wasBoss = this.mon?.isBoss;
    this.emit('heroDied', { boss: wasBoss });
    if (wasBoss) {
      this.s.farming = true;
      this.s.kills = 0;
    }
    this.heroHp = this.stats().hp;
    this.mon.alive = false;
    this.spawnTimer = 1.2;
    return undefined;
  }

  challengeBoss() {
    if (this.mode !== 'stage') return;
    this.s.farming = false;
    this.s.kills = KILLS_PER_STAGE;
    this.heroHp = this.stats().hp;
    this.spawnStage();
  }

  tick(dt) {
    // 게임 안의 시간. 실제 시계(Date.now)를 쓰면 시뮬레이션처럼 가상 시간으로
    // 도는 쪽에서 어긋난다 — 회귀 권유가 영영 안 뜨는 버그가 그래서 났다.
    this.clock = (this.clock || 0) + dt;
    for (const p of this.petTeam()) {
      if (!this.mon?.alive) break;
      const b = this.s.bond || (this.s.bond = {});
      b[p.id] = (b[p.id] || 0) + BOND_PER_SEC * dt;
    }
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    const st = this.stats();

    if (this.contest) {
      if (this.mode === 'jobtest' && (this.contest.goal === 'lowhp' || this.contest.goal === 'keephp')) {
        this.contest.lowest = Math.min(this.contest.lowest, this.heroHp / Math.max(1, st.hp));
      }
      this.contest.time -= dt;
      if (this.contest.time <= 0) return this.endContest('timeout');
      if (this.mode === 'raid' && this.mon.hp <= 0) return this.endContest('done');
    }

    // 들판 사냥: 적을 찾아 걸어가서 벤다
    this.tickCC(dt);
    this.waveT = (this.waveT || 0) + dt;
    this.updateFields(dt);

    if (this.mode === 'stage') {
      this.refillField(dt);
      this.moveMobs(dt);
      const target = this.retarget();
      if (!target) {
        this.walking = false;
        this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.25 * dt);
        return undefined;
      }
      const dx = target.x - this.heroX;
      const dy = target.y - this.heroY;
      const dist = Math.hypot(dx, dy) || 1;
      // 싸울 때도 상대 쪽을 본다
      this.heroAngle = Math.atan2(dy, dx);
      this.heroFacing = dx >= 0 ? 1 : -1;
      const k = Game.viewScale(dx / dist, dy / dist);
      const seen = dist * k; // 화면에서 보이는 거리로 사거리를 잰다
      if (seen > MELEE_RANGE) {
        const step = Math.min(HERO_SPEED * dt, (seen - MELEE_RANGE) / k);
        this.heroX += (dx / dist) * step;
        this.heroY += (dy / dist) * step;
        this.walking = true;
        this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.08 * dt);
        this.atkTimer = Math.min(this.atkTimer, 0.25);
        return undefined; // 걷는 동안에는 베지 않는다
      }
      this.walking = false;
    } else if (!this.mon?.alive) {
      this.spawnTimer -= dt;
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.25 * dt);
      if (this.spawnTimer <= 0) this.spawn();
      return undefined;
    }
    if (!this.mon?.alive) return undefined;
    if (this.mon.stun > 0) this.mon.stun = Math.max(0, this.mon.stun - dt);

    if (this.mon.isBoss && this.mode === 'stage') {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.emit('bossTimeout');
        return this.heroDied();
      }
    }

    if (this.s.autoSkill && this.mode !== 'pvp') {
      for (const id of this.activeSlots()) {
        if (!id) continue;
        if (id === 'heal' && this.heroHp > st.hp * 0.6) continue;
        if (this.buffs[id] > 0) continue;
        this.useSkill(id);
        if (!this.mon?.alive) return undefined;
      }
    }

    // 영웅 공격
    this.atkTimer -= dt;
    while (this.atkTimer <= 0 && this.mon?.alive) {
      this.atkTimer += 1 / st.speed;
      const crit = this.rng() < st.crit;
      this.emit('attack');
      this.dealDamage(st.atk * st.hitMul * (crit ? st.critDmg : 1), 'hit', crit);
    }

    // 영수 — **저마다 다른 짓을 한다.** 전에는 여덟이 전부 같은 한 대였다.
    if (st.petHits?.length && this.mon?.alive) {
      this.petTimer -= dt;
      if (this.petTimer <= 0) {
        this.petTimer += PET_ATTACK_INTERVAL;
        this.emit('petAttack');
        for (const { pet, hit } of st.petHits) {
          if (!this.mon?.alive && pet.act !== 'heal') break;
          switch (pet.act) {
            case 'heal':   // 백학 — 때리는 대신 숨을 돌려 준다
              this.heroHp = Math.min(st.hp, this.heroHp + st.hp * pet.actVal);
              break;
            case 'gold':   // 영묘 — 때리면서 은자를 떨군다
              this.dealDamage(hit, 'pet');
              this.addGold(monsterGold(this.s.stage) * st.goldMul * pet.actVal);
              break;
            case 'aoe':    // 구미호 — 주변 전부
              this.dealAoe(hit, 'pet', false, pet.actVal);
              break;
            case 'triple': // 영원 — 세 대씩
              for (let k = 0; k < pet.actVal && this.mon?.alive; k++) this.dealDamage(hit / pet.actVal, 'pet');
              break;
            case 'boss':   // 기린 — 관문지기에게 크게
              this.dealDamage(hit * (this.mon.isBoss ? pet.actVal : 1), 'pet');
              break;
            case 'crit':   // 백호 — 반드시 치명
              this.dealDamage(hit * st.critDmg, 'pet', true);
              break;
            case 'storm':  // 청룡 — 주변 전부를 치명으로
              this.dealAoe(hit * st.critDmg, 'pet', true, pet.actVal);
              break;
            case 'shield': // 식철수 — 때리지 않는다. 받는 피해를 줄인다(stats의 guard).
              break;
            default:
              this.dealDamage(hit, 'pet');
          }
        }
      }
    }

    // 상대 공격 (레이드 보스는 공격하지 않는다)
    if (this.mode !== 'raid' && this.mon?.alive && this.mon.stun <= 0) {
      const m = this.mon;
      m.atkTimer -= dt;
      while (m.atkTimer <= 0 && this.heroHp > 0) {
        m.atkTimer += m.atkInterval || 1.5;
        let dmg = m.atk;
        let crit = false;
        if (m.crit && this.rng() < m.crit) { dmg *= m.critDmg; crit = true; }
        this.heroHp -= dmg * st.guard;
        this.noteHeroHit();
        this.emit('heroHit', { amount: dmg, crit });
      }
      if (m.petHit) {
        m.petTimer -= dt;
        if (m.petTimer <= 0) {
          m.petTimer += PET_ATTACK_INTERVAL;
          this.heroHp -= m.petHit * st.guard;
          this.noteHeroHit();
          this.emit('heroHit', { amount: m.petHit, pet: true });
        }
      }
      if (this.heroHp <= 0) return this.heroDied();
    }

    // 가까이 붙은 다른 적들도 함께 때린다
    if (this.mode === 'stage') {
      // 사거리 안에 몇십이 몰려도 때릴 수 있는 건 가장 가까운 몇 명뿐이다.
      // 제한이 없으면 100마리가 동시에 때려서 즉사한다.
      const near = this.mons
        .filter((m) => m.alive && m !== this.mon && this.distTo(m) <= MELEE_RANGE + 40)
        .sort((x, y) => this.distTo(x) - this.distTo(y))
        .slice(0, MAX_ATTACKERS - 1);
      for (const a of near) {
        if (!a.alive || a.stun > 0) { if (a.stun > 0) a.stun = Math.max(0, a.stun - dt); continue; }
        a.atkTimer -= dt;
        while (a.atkTimer <= 0 && this.heroHp > 0) {
          a.atkTimer += 1.6;
          this.heroHp -= a.atk * 0.6 * st.guard;
          this.noteHeroHit();
          this.emit('heroHit', { amount: a.atk * 0.6 });
        }
      }
      if (this.heroHp <= 0) return this.heroDied();
    }
    if (this.mode !== 'pvp') this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.02 * dt);
    return undefined;
  }

  // ---------- 레벨 / 스탯 포인트 ----------
  addExp(x) {
    if (!Number.isFinite(x)) return;
    this.s.exp += x;
    let ups = 0;
    while (this.s.exp >= expToNext(this.s.level)) {
      this.s.exp -= expToNext(this.s.level);
      this.s.level++;
      this.s.sp += SP_PER_LEVEL;
      ups++;
    }
    if (ups) {
      this.emit('levelUp', { level: this.s.level, ups });
      this.tickRankSub();   // 레벨이 오르면 소단계가 따라 오른다
    }
  }

  allocSp(key, n = 1) {
    if (!SP_STATS[key]) return 0;
    const k = Math.min(n, this.s.sp);
    this.s.spAlloc[key] += k;
    this.s.sp -= k;
    return k;
  }

  resetSp() {
    if (this.s.gems < SP_RESET_GEMS) return false;
    const total = Object.values(this.s.spAlloc).reduce((a, b) => a + b, 0);
    if (!total) return false;
    this.s.gems -= SP_RESET_GEMS;
    for (const k of Object.keys(this.s.spAlloc)) this.s.spAlloc[k] = 0;
    this.s.sp += total;
    return true;
  }

  // ---------- 승급 ----------
  nextRank() { return RANKS[this.s.rank + 1] || null; }
  // 소단계를 다 채운 뒤라야 심마를 만난다 — 마흔 단을 건너뛰고 갈 수는 없다.
  canTrial() {
    const r = this.nextRank();
    return !!r && this.s.rankSub >= RANK_SUBS - 1 && this.s.level >= r.level && this.mode === 'stage';
  }

  startTrial() {
    if (!this.canTrial()) return false;
    const r = this.s.rank + 1;
    const boss = trialBoss(r);
    this.beginContest('trial', TRIAL_TIME, { rank: r });
    this.mon = { hp: boss.hp, maxHp: boss.hp, isBoss: true, def: { name: '심마' }, trial: true, atk: boss.atk, atkTimer: 1.5, alive: true, stun: 0, ...this.duelSpot() };
    return true;
  }

  // 겨루기류(던전·시련·결투·토벌)는 적이 처음부터 사거리 안에 서 있다.
  // 걸어가는 시간이 생기면 제한시간 밸런스가 바뀌므로 거리를 두지 않는다.
  duelSpot() {
    return { x: this.heroX + MELEE_RANGE * 0.75, y: this.heroY - MELEE_RANGE * 0.5, face: 1 };
  }

  // ---------- 공통: 던전·시련·결투·레이드 ----------
  beginContest(mode, time, extra = {}) {
    this.mode = mode;
    this.contest = { mode, time, maxTime: time, kills: 0, damage: 0, ...extra };
    this.raid = mode === 'raid' ? this.contest : null;
    this.heroHp = this.stats().hp;
    this.atkTimer = 0.4;
    this.petTimer = PET_ATTACK_INTERVAL;
    this.queue = [];
    this.adds = [];
    this.emit('contestStart', { mode });
  }

  endContest(result) {
    const c = this.contest;
    if (!c) return null;
    const out = { mode: c.mode, result };
    if (c.mode === 'dungeon') {
      out.id = c.id;
      out.level = c.level;
      out.win = result === 'clear';
      this.progress('dungeon');
      if (out.win) {
        this.s.daily.keys[c.id]--;
        this.s.dungeons[c.id] = Math.max(this.s.dungeons[c.id] || 0, c.level);
        out.reward = this.grant(dungeonReward(c.id, c.level));
      }
      if (result === 'clear' || result === 'win' || result === 'done') {
        this.noteLore('lord', codexGradeOf(this.s.bestStage));
      }
    } else if (c.mode === 'tower') {
      out.win = result === 'clear';
      out.floor = c.floor;
      if (out.win) {
        this.s.tower.floor = c.floor;
        const r = towerReward(c.floor);
        const boxes = r.accBox || 0;
        delete r.accBox;
        this.grant(r);
        if (boxes) this.openAccBox(boxes);
        out.reward = { ...r, accBox: boxes };
      }
    } else if (c.mode === 'rift' || c.mode === 'hunt') {
      out.win = result === 'clear';
      if (out.win) {
        const r = c.mode === 'rift' ? riftReward(this.s.bestStage) : huntReward(this.s.bestStage);
        const boxes = r.accBox || 0;
        delete r.accBox;
        this.grant(r);
        if (boxes) this.openAccBox(boxes);
        out.reward = { ...r, accBox: boxes };
      }
    } else if (c.mode === 'shadow') {
      out.win = result === 'clear';
      if (out.win) {
        this.s.shadow.wins = (this.s.shadow.wins || 0) + 1;
        out.wins = this.s.shadow.wins;
        out.tier = this.shadowTier();
      }
    } else if (c.mode === 'ego') {
      out.win = result === 'clear';
      out.egoId = c.egoId;
      if (out.win) {
        const e = this.s.ego[c.egoId];
        e.step++;
        e.exp = 0;   // 초과분은 넘어가지 않는다
        out.step = e.step;
      }
    } else if (c.mode === 'jobtest') {
      // 부동은 시간이 다 되면 붙는다 — 버티는 게 시험이라 이길 일이 없다.
      out.win = c.goal === 'endure' ? result === 'timeout' : result === 'clear';
      out.job = c.job;
      out.miss = out.win ? null : this.jobTestMiss(c);
      if (out.win) this.s.jobTests[c.job] = true;
    } else if (c.mode === 'trial') {
      out.win = result === 'clear';
      if (out.win) {
        this.s.rank = c.rank;
        this.s.rankSub = 0;   // 새 경지의 1단부터 다시
        out.rank = c.rank;
      }
    } else if (c.mode === 'pvp') {
      let win = result === 'win';
      if (result === 'timeout') win = this.heroHp / this.stats().hp >= this.mon.hp / this.mon.maxHp;
      out.win = win;
      out.opponent = c.opponent;
      out.delta = win ? PVP_WIN : PVP_LOSE;
      this.s.pvp.score = Math.max(0, this.s.pvp.score + out.delta);
      this.s.pvp[win ? 'wins' : 'losses']++;
      out.reward = this.grant(win ? PVP_REWARD.win : PVP_REWARD.lose);
      this.progress('pvp');
    } else if (c.mode === 'raid') {
      out.damage = c.damage;
      if (c.damage > 0) this.progress('raid');
    }
    this.mode = 'stage';
    this.contest = null;
    this.raid = null;
    this.queue = [];
    this.adds = [];
    this.heroHp = this.stats().hp;
    this.emit('contestEnd', out);
    if (out.mode === 'raid') this.emit('raidEnd', { damage: out.damage });
    if (out.mode === 'trial' && out.win) this.emit('rankUp', { rank: out.rank });
    this.spawnStage();
    // 연속 도전이 켜져 있으면 바로 다시 들어간다
    if (this.s.loop) {
      const again = this.retryLoop(result === 'win' ? 'clear' : result);
      this.emit('loopAgain', { kind: this.s.loop?.kind || null, on: again });
    }
    return out;
  }

  // ---------- 연속 도전 ----------
  //
  // 이 게임의 축은 '회귀해서 강해지기'다. 한 판 끝날 때마다 창을 열어
  // 다시 누르게 하면 그 축이 느려진다. 켜 두면 알아서 다시 들어간다.
  //
  // **지면 끊긴다.** 안 그러면 못 깨는 층에서 영원히 헛돈다
  // (던전은 이겨야 열쇠를 쓰므로 지는 쪽은 아무것도 소모하지 않는다).
  loopOn(kind, id = null) {
    const l = this.s.loop;
    return !!l && l.kind === kind && (l.id || null) === (id || null);
  }

  setLoop(kind, id = null) {
    this.s.loop = this.loopOn(kind, id) ? null : { kind, id: id || null };
    return !!this.s.loop;
  }

  // 겨루기가 끝난 뒤 다시 들어갈 수 있으면 들어간다
  retryLoop(result) {
    const l = this.s.loop;
    if (!l || this.mode !== 'stage') return false;
    if (result !== 'clear') { this.s.loop = null; return false; }
    let ok = false;
    if (l.kind === 'dungeon') ok = this.startDungeon(l.id);
    else if (l.kind === 'tower') ok = this.startTower();
    else if (l.kind === 'rift') ok = this.startSeek('rift');
    else if (l.kind === 'hunt') ok = this.startSeek('hunt');
    else if (l.kind === 'shadow') ok = this.startShadow();
    else if (l.kind === 'ego') ok = this.startEgoTrial(l.id);
    if (!ok) this.s.loop = null;   // 열쇠가 떨어졌거나 끝까지 올랐다
    return ok;
  }

  // ---------- 던전 ----------
  dungeonUnlocked(d) { return this.s.bestStage >= d.unlock; }

  startDungeon(id) {
    const d = DUNGEONS.find((x) => x.id === id);
    if (!d || !this.dungeonUnlocked(d) || this.mode !== 'stage' || this.s.daily.keys[id] <= 0) return false;
    const level = (this.s.dungeons[id] || 0) + 1;
    this.beginContest('dungeon', DUNGEON_TIME, { id, level, eq: dungeonStage(d, level), def: d });
    this.spawnDungeon();
    return true;
  }

  spawnDungeon() {
    const c = this.contest;
    const isBoss = c.kills >= DUNGEON_MOBS;
    const hp = monsterHp(c.eq) * (isBoss ? BOSS_HP_MULT * 1.5 : 1.2);
    this.fillQueue(() => c.def.mob);
    this.mon = {
      hp, maxHp: hp, isBoss, def: isBoss ? c.def.boss : this.queue.shift(),
      atk: monsterAtk(c.eq) * (isBoss ? BOSS_ATK_MULT : 1), atkTimer: 1.2, alive: true, stun: 0,
      ...this.duelSpot(),
    };
    if (c.kills + 1 + this.queue.length > DUNGEON_MOBS) this.queue.length = Math.max(0, DUNGEON_MOBS - c.kills - 1);
    this.spawnTimer = 0;
    this.emit('spawn', { isBoss });
  }

  sweepDungeon(id) {
    const best = this.s.dungeons[id] || 0;
    if (!best || this.s.daily.keys[id] <= 0 || this.mode !== 'stage') return null;
    this.s.daily.keys[id]--;
    this.progress('dungeon');
    return this.grant(dungeonReward(id, best));
  }

  // ---------- 결투 ----------
  // opp: 상대 프로필 스냅샷 {nickname, atk, hp, crit, critDmg, speed, petHit, rank, pet}
  startPvp(opp) {
    if (this.mode !== 'stage' || this.s.daily.pvpTickets <= 0) return false;
    this.s.daily.pvpTickets--;
    this.beginContest('pvp', PVP_TIME, { opponent: { uid: opp.uid, nickname: opp.nickname } });
    const hp = Math.max(1, opp.hp || 1);
    this.mon = {
      hp, maxHp: hp, isBoss: false, isHero: true, name: opp.nickname, rank: opp.rank || 0, petEmoji: opp.petEmoji || null,
      weaponGrade: opp.weaponGrade ?? -1,
      atk: opp.atk || 1, crit: Math.min(CRIT_CAP, opp.crit || 0), critDmg: opp.critDmg || 1.5,
      atkInterval: 1 / Math.max(0.2, opp.speed || 1), atkTimer: 0.6,
      petHit: opp.petHit || 0, petTimer: PET_ATTACK_INTERVAL, alive: true, stun: 0,
      ...this.duelSpot(),
    };
    return true;
  }

  // ---------- 스킬 ----------
  // 계열 무공은 관문이 아니라 **문파(또는 맛보기)**가 연다
  skillUnlocked(sk) {
    if (sk.job) return this.jobSkillId() === sk.id;
    return this.s.bestStage >= sk.unlock;
  }

  autoSlotSkills() {
    const open = this.skillSlotCount();
    for (const sk of SKILLS) {
      if (sk.job) continue;   // 계열 무공은 문파 칸 전용
      if (!this.skillUnlocked(sk) || this.s.skillSlots.includes(sk.id)) continue;
      // 빈 칸을 찾되 **열린 칸 안에서만** 찾는다
      let free = -1;
      for (let i = 0; i < open; i++) if (!this.s.skillSlots[i]) { free = i; break; }
      if (free < 0) return;
      this.s.skillSlots[free] = sk.id;
    }
  }

  // 지금 실제로 쓰는 무공 (열린 칸 안의 것만)
  // 일반 칸 + 문파 칸. 문파 칸은 일반 칸을 먹지 않고 하나 더 붙는다.
  activeSlots() {
    const out = this.s.skillSlots.slice(0, this.skillSlotCount());
    const j = this.jobSkillId();
    if (j) out.push(j);
    return out;
  }

  setSkillSlot(slot, id) {
    if (slot < 0 || slot >= this.skillSlotCount()) return false;
    const sk = SKILLS.find((x) => x.id === id);
    if (sk?.job) return false;   // 계열 무공은 일반 칸에 못 넣는다
    if (id && (!sk || !this.skillUnlocked(sk))) return false;
    const cur = this.s.skillSlots.indexOf(id);
    if (id && cur >= 0) this.s.skillSlots[cur] = this.s.skillSlots[slot];
    this.s.skillSlots[slot] = id;
    return true;
  }

  useSkill(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk) || this.cd[id] > 0 || !this.mon?.alive || this.mode === 'pvp') return false;
    // 육합(권마 시험)은 맨몸이 시험이다. 자동 무공이 켜진 채로 들어와서
    // 모르는 사이에 떨어지는 일이 없도록 **막는다** — 세고 나서 떨구지 않는다.
    if (this.mode === 'jobtest' && this.contest?.goal === 'noskill') return false;
    // 자리를 옮기거나 들판에 남는 무공은 1:1 겨루기에서 쓸 자리가 없다
    const roams = sk.motion === 'dash' || sk.motion === 'blink' || sk.motion === 'tornado';
    if (roams && this.mode !== 'stage') return false;
    // 안 열린 칸에 남아 있는 무공은 안 나간다 (옛 세이브 보호)
    if (!this.activeSlots().includes(id)) return false;
    const lv = this.s.skills[id];
    const st = this.stats();
    if (sk.kind === 'dmg') {
      this.emit('skillArea', { id, radius: sk.radius || 0, target: sk.target || 'single' });
      if (sk.stun) this.mon.stun = sk.stun;
      this.emit('skill', { id, target: sk.target || 'single' });
      let dmg = st.atk * this.skillMult(sk);
      // 단지멸은 반드시 치명으로 들어간다 (극악소마의 축이 치명 피해다)
      if (sk.sure) dmg *= st.critDmg;
      // 금강부동은 체력이 곧 주먹이다. 마불만 체력 x2.5라 마불에게만 크게 들어온다.
      if (sk.hpScale) dmg += st.hp * sk.hpScale(lv);
      // 한 명만 노리는 무공은 두목에게 더 아프게 들어간다
      if (sk.bossMult && this.mon.isBoss) dmg *= sk.bossMult;
      // 이번 무공이 거는 상태이상. 맞은 적마다 applyCC가 집어간다.
      this.ccNow = sk.cc ? { cc: sk.cc, sec: sk.ccSec || 3 } : null;
      switch (sk.motion) {
        case 'chain': this.castChain(sk, dmg, id); break;
        case 'dash': this.castDash(sk, dmg, id); break;
        case 'blink': this.castBlink(sk, dmg, id); break;
        case 'field': this.castField(sk, dmg, id, false); break;
        case 'tornado': this.castField(sk, dmg, id, true); break;
        case 'pierce': this.hitBeam(this.heroAngle || 0, sk.pierceLen, sk.pierceWidth, dmg, id); break;
        default:
          if (sk.target === 'all') this.dealAoe(dmg, id, false, sk.radius || 220);
          else this.dealDamage(dmg, id);
      }
      this.ccNow = null;
      // 금강부동은 베면서 숨을 돌린다
      if (sk.selfHeal) this.heroHp = Math.min(st.hp, this.heroHp + st.hp * sk.selfHeal);
      // 취보난무·만독강림은 도는 동안 은자·경험치가 붙는다
      if (sk.boon) this.buffs[id] = sk.boon.dur;
    } else if (sk.kind === 'buff') {
      this.buffs[id] = sk.dur * (1 + SKILL_PIERCE_MULT * this.skillPierceOf(id) * 0.5);
      this.emit('skill', { id });
    } else if (sk.kind === 'heal') {
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * Math.min(1, this.skillMult(sk)));
      this.emit('skill', { id });
    }
    this.cd[id] = this.skillCdOf(sk);
    return true;
  }

  skillUpgradeCost(id) { return skillBookCost(this.s.skills[id]); }

  upgradeSkill(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk)) return false;
    const cost = this.skillUpgradeCost(id);
    if (this.s.books < cost) return false;
    this.s.books -= cost;
    this.s.skills[id]++;
    return true;
  }

  // ---------- 골드 강화 ----------
  upgradeCost(key) { return UPGRADES[key].cost(this.s.upgrades[key]); }
  // 수련에 상한은 없다. 차수가 올라갈 뿐이다 — 이 함수는 화면이 쓰던 자리라 남긴다.
  upgradeMaxed() { return false; }

  buyUpgrade(key, times = 1) {
    let bought = 0;
    for (let i = 0; i < times; i++) {
      if (this.upgradeMaxed(key)) break;
      const cost = this.upgradeCost(key);
      if (this.s.gold < cost) break;
      this.s.gold -= cost;
      this.s.upgrades[key]++;
      bought++;
    }
    if (bought) this.progress('upgrade', bought);
    return bought;
  }

  // 자원에 들어오는 값은 전부 여기를 지난다.
  //
  // 숫자가 아닌 값이 한 번 더해지면 그 자원은 영영 NaN이 되고,
  // 세이브를 지우기 전까지 복구가 안 된다. 보상 계산 어딘가에서 undefined가
  // 하나만 새어 나와도 그렇게 된다 — 실제로 claimOffline에 엉뚱한 값을 넘겨
  // 은자가 1.0e+18에서 NaN이 되는 걸 확인했다.
  // 막는 비용은 한 줄이고, 안 막으면 되돌릴 수 없다.
  addGold(g) {
    if (!Number.isFinite(g)) return;
    this.s.gold += g;
    this.s.stats.gold += g;
  }

  // 보상 묶음 지급: {gold, gems, books, stones, food, relicShards}
  grant(r = {}) {
    if (r.gold) this.addGold(r.gold);
    for (const k of ['gems', 'books', 'stones', 'food', 'relicShards', 'accPick']) {
      if (Number.isFinite(r[k]) && r[k]) this.s[k] += r[k];
    }
    return r;
  }

  // ---------- 장비 ----------
  // 소환 레벨이 '열어준' 등급까지만 나온다. 레벨이 오를수록 윗등급 쪽으로 쏠린다.
  // 근거: 공략 "갓4,3등급은 소환 5레벨 이후, 갓1등급은 12레벨 이후 나온다"
  rollGrade(kind = 'equip') {
    const lv = this.gachaInfo(kind).lv;
    const cap = gachaMaxGrade(lv);
    const w = [];
    for (let g = 0; g <= cap; g++) w.push(GACHA_RATES[g] * Math.pow(1 + GACHA_LV_TILT, g * lv));
    const sum = w.reduce((a, b) => a + b, 0);
    let r = this.rng() * sum;
    for (let g = 0; g < w.length; g++) {
      if (r < w[g]) return g;
      r -= w[g];
    }
    return 0;
  }

  gacha(count) {
    const cost = count === 10 ? GACHA10_COST : GACHA_COST * count;
    if (this.s.gems < cost) return null;
    this.s.gems -= cost;
    const types = Object.keys(EQUIP_TYPES);
    const out = [];
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(this.rng() * types.length)];
      const grade = this.rollGrade();
      this.s.equips[type][grade]++;
      const first = this.noteCodex(type, grade);
      out.push({ type, grade, first });
    }
    this.s.stats.gachas += count;
    this.addGachaCount('equip', count);
    this.progress('gacha', count);
    return out;
  }

  merge(type, grade) {
    const arr = this.s.equips[type];
    if (grade >= GRADES.length - 1 || arr[grade] < MERGE_COUNT) return 0;
    const n = Math.floor(arr[grade] / MERGE_COUNT);
    arr[grade] -= n * MERGE_COUNT;
    arr[grade + 1] += n;
    this.noteCodex(type, grade + 1);
    return n;
  }

  mergeAll() {
    let total = 0;
    for (const type of Object.keys(EQUIP_TYPES)) {
      for (let g = 0; g < GRADES.length - 1; g++) total += this.merge(type, g);
    }
    return total;
  }

  enhanceCost(type) { return enhanceCost(this.s.enhance[type] || 0); }

  // ---------- 장비 초월 ----------
  equipPierceCost(type) { return equipPierceCost(this.s.equipPierce?.[type] || 0); }

  canEquipPierce(type) {
    const step = this.s.equipPierce?.[type] || 0;
    if (step >= EQUIP_PIERCE_MAX) return false;
    const top = GRADES.length - 1;
    // 끼울 하나는 남겨둬야 한다
    return (this.s.equips[type]?.[top] || 0) >= equipPierceCost(step) + 1;
  }

  equipPierceUp(type) {
    if (!this.canEquipPierce(type)) return false;
    const top = GRADES.length - 1;
    this.s.equips[type][top] -= this.equipPierceCost(type);
    this.s.equipPierce[type] = (this.s.equipPierce[type] || 0) + 1;
    return true;
  }

  equipPierceTotal() {
    return Object.keys(EQUIP_TYPES).reduce((a, k) => a + (this.s.equipPierce?.[k] || 0), 0);
  }

  enhanceEquip(type, times = 1) {
    let n = 0;
    for (let i = 0; i < times; i++) {
      const cost = this.enhanceCost(type);
      if (this.s.stones < cost) break;
      this.s.stones -= cost;
      this.s.enhance[type]++;
      n++;
    }
    if (n) this.progress('upgrade', n);
    return n;
  }

  // ---------- 펫 ----------
  hatchPets(count) {
    const cost = PET_EGG_COST * count;
    if (this.s.gems < cost) return null;
    this.s.gems -= cost;
    const total = PETS.reduce((a, p) => a + PET_GRADE_WEIGHT[p.grade], 0);
    const out = [];
    for (let i = 0; i < count; i++) {
      let r = this.rng() * total;
      let pet = PETS[0];
      for (const p of PETS) {
        r -= PET_GRADE_WEIGHT[p.grade];
        if (r <= 0) { pet = p; break; }
      }
      if (this.s.pets[pet.id]) {
        const food = PET_DUPLICATE_FOOD(pet.grade);
        this.s.food += food;
        out.push({ id: pet.id, dup: true, food });
      } else {
        this.s.pets[pet.id] = 1;
        out.push({ id: pet.id, dup: false });
        if ((this.s.petTeam || []).length < this.petSlots()) this.togglePet(pet.id);
      }
    }
    this.addGachaCount('pet', count);
    this.progress('gacha', count);
    return out;
  }

  // ---------- 영수 팀 ----------
  petSlots() { return petSlotCount(this.s.bestStage); }
  petTeam() {
    return (this.s.petTeam || [])
      .slice(0, this.petSlots())
      .map((id) => PETS.find((p) => p.id === id))
      .filter((p) => p && this.s.pets[p.id]);
  }
  petLead() { return this.petTeam()[0]?.id || null; }
  petOn(id) { return (this.s.petTeam || []).includes(id); }

  // 데려가기/내려놓기. 칸이 차 있으면 가장 먼저 넣은 것을 밀어낸다 —
  // '칸이 찼어요'라고 막으면 뭘 빼야 하는지 또 찾아야 한다.
  togglePet(id) {
    if (!this.s.pets[id]) return false;
    const team = this.s.petTeam || (this.s.petTeam = []);
    const at = team.indexOf(id);
    if (at >= 0) { team.splice(at, 1); return true; }
    team.push(id);
    while (team.length > this.petSlots()) team.shift();
    return true;
  }

  petLevelCost(id) { return petFoodCost(this.s.pets[id] || 1); }

  levelPet(id, times = 1) {
    if (!this.s.pets[id]) return 0;
    let n = 0;
    for (let i = 0; i < times; i++) {
      const cost = this.petLevelCost(id);
      if (this.s.food < cost) break;
      this.s.food -= cost;
      this.s.pets[id]++;
      n++;
    }
    return n;
  }

  equipPet(id) { return this.togglePet(id); }

  // 교감 단계 (데리고 싸운 시간으로 오른다)
  bondLv(id) { return bondLevel(this.s.bond?.[id] || 0); }

  // 각인하면 지금 교감 단계가 영구히 새겨져, 데리고 다니지 않아도 그만큼 효과가 남는다
  canEngrave(id) {
    if (!this.s.pets[id]) return false;
    const lv = this.bondLv(id);
    if (lv < ENGRAVE_MIN_LV) return false;
    if ((this.s.engrave?.[id] || 0) >= lv) return false;
    return this.s.food >= engraveCost(lv);
  }

  engravePet(id) {
    if (!this.canEngrave(id)) return false;
    const lv = this.bondLv(id);
    this.s.food -= engraveCost(lv);
    if (!this.s.engrave) this.s.engrave = {};
    this.s.engrave[id] = lv;
    return true;
  }

  // ---------- 유물 ----------
  digRelic(times = 1) {
    const out = [];
    for (let i = 0; i < times; i++) {
      const open = RELICS.filter((r) => (this.s.relics[r.id] || 0) < r.max);
      if (!open.length || this.s.relicShards < RELIC_DIG_COST) break;
      this.s.relicShards -= RELIC_DIG_COST;
      const r = open[Math.floor(this.rng() * open.length)];
      this.s.relics[r.id] = (this.s.relics[r.id] || 0) + 1;
      out.push(r.id);
    }
    if (out.length) this.addGachaCount('relic', out.length);
    return out;
  }

  // ---------- 미션 / 업적 ----------
  progress(id, n = 1) {
    const m = MISSIONS.find((x) => x.id === id);
    if (!m) return;
    const cur = this.s.daily.missions[id] || 0;
    if (cur >= m.goal) return;
    this.s.daily.missions[id] = Math.min(m.goal, cur + n);
    if (this.s.daily.missions[id] >= m.goal) this.emit('missionDone', { id });
  }

  missionState(id) {
    const m = MISSIONS.find((x) => x.id === id);
    const cur = this.s.daily.missions[id] || 0;
    return { cur, goal: m.goal, done: cur >= m.goal, claimed: !!this.s.daily.claimed[id] };
  }

  claimMission(id) {
    if (!MISSIONS.some((x) => x.id === id)) return null;   // 없는 의뢰를 물으면 조용히 넘긴다
    const st = this.missionState(id);
    if (!st.done || st.claimed) return null;
    this.s.daily.claimed[id] = true;
    return this.grant(MISSIONS.find((x) => x.id === id).reward);
  }

  allMissionsClaimed() { return MISSIONS.every((m) => this.s.daily.claimed[m.id]); }

  claimAllBonus() {
    if (this.s.daily.allClaimed || !this.allMissionsClaimed()) return null;
    this.s.daily.allClaimed = true;
    return this.grant(MISSION_ALL_REWARD);
  }

  milestonesReady() {
    return Math.max(0, Math.floor((this.s.bestStage - 1) / STAGE_MILESTONE_EVERY) - this.s.milestone);
  }

  claimMilestone() {
    if (!this.milestonesReady()) return null;
    this.s.milestone++;
    return this.grant(stageMilestone(this.s.milestone));
  }

  claimableCount() {
    const missions = MISSIONS.filter((m) => { const st = this.missionState(m.id); return st.done && !st.claimed; }).length;
    const all = !this.s.daily.allClaimed && this.allMissionsClaimed() ? 1 : 0;
    return missions + all + this.milestonesReady();
  }

  // ---------- 방치 / 일일 ----------
  idleRates() {
    const s = Math.max(1, this.s.stage);
    const st = this.stats({ buffs: false });
    const perHit = st.atk * st.hitMul * (1 + st.crit * (st.critDmg - 1));
    const hits = Math.max(1, Math.ceil(monsterHp(s) / perHit));
    const killTime = hits / st.speed + SPAWN_DELAY;
    return {
      gold: (monsterGold(s) * st.goldMul) / killTime,
      exp: (expPerKill(s) * st.expMul) / killTime,
      offlineMul: st.offlineMul,
    };
  }

  idleGoldRate() { return this.idleRates().gold; }

  offlineReward(now = Date.now()) {
    const sec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (now - (this.s.lastSeen || now)) / 1000));
    if (sec < 60) return null;
    const r = this.idleRates();
    return { sec, gold: r.gold * sec * r.offlineMul, exp: r.exp * sec * r.offlineMul };
  }

  claimOffline(reward) {
    if (!reward || typeof reward !== 'object') return;
    this.addGold(reward.gold);
    if (reward.exp) this.addExp(reward.exp);
  }

  checkDaily(now = Date.now()) {
    const today = dayKey(now);
    if (this.s.daily.date === today) return null;
    const prev = this.s.daily.date;
    // 못 들른 날만큼 한꺼번에 받는다(최대 닷새치). 자정에 사라지는 게 아니라 쌓인다.
    let days = 1;
    if (prev) {
      const gap = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${prev}T00:00:00`)) / 86400000);
      if (Number.isFinite(gap) && gap > 1) days = Math.min(5, gap);
    }
    const kept = this.s.daily;
    this.s.daily = freshDaily(today);
    // 안 쓴 열쇠·패는 그대로 두고 오늘 몫을 더한다. 상한을 넘으면 버려진다.
    const add = (cur, per, cap) => Math.min(cap, (cur || 0) + per * days);
    for (const d of DUNGEONS) {
      this.s.daily.keys[d.id] = add(kept.keys?.[d.id], DUNGEON_KEYS, DUNGEON_KEY_CAP);
    }
    this.s.daily.raidTickets = add(kept.raidTickets, RAID_TICKETS, RAID_TICKET_CAP);
    this.s.daily.pvpTickets = add(kept.pvpTickets, PVP_TICKETS, PVP_TICKET_CAP);
    this.s.seek = Math.min(SEEK_CAP, (this.s.seek || 0) + SEEK_PER_DAY * days);
    if (this.s.shadow) {
      this.s.shadow.tries = add(this.s.shadow.tries, SHADOW_TRIES, SHADOW_TRY_CAP);
      this.checkShadowWeek(now);
    }
    this.s.gems += DAILY_GEMS * days;
    // 연공 일지: 어제 받았으면 이어지고, 하루라도 건너뛰면 처음부터
    const a = this.s.attend;
    const yesterday = dayKey(now - 86400000);
    if (a.last !== today) {
      a.streak = a.last === yesterday ? a.streak : 0;
      a.claimed = false;
    }
    void prev;
    return { gems: DAILY_GEMS };
  }

  // 연공 일지: 오늘 몇 번째 날인지(1~7)
  attendDay() { return (this.s.attend.streak % ATTEND_CYCLE) + 1; }
  canAttend() { return !this.s.attend.claimed; }

  claimAttend(now = Date.now()) {
    if (!this.canAttend()) return null;
    const day = this.attendDay();
    const r = attendReward(day);
    this.grant(r);
    this.s.attend.claimed = true;
    this.s.attend.streak += 1;
    this.s.attend.last = dayKey(now);
    return { day, reward: r };
  }

  // 기연: 하루 몇 번, 일정 시간 공격력이 오른다
  boostLeft() { return Math.max(0, BOOST_PER_DAY - (this.s.daily.boostUsed || 0)); }

  // 광고로 더 받는 기연. **공짜 횟수를 뺏지 않는다** — 덤으로 더 주는 것이다.
  // 광고를 지운 사람은 광고 없이 바로 받는다.
  adBoostLeft() { return Math.max(0, AD_BOOST_EXTRA - (this.s.daily.adBoostUsed || 0)); }
  takeAdBoost() {
    if (this.adBoostLeft() <= 0) return false;
    this.s.daily.adBoostUsed = (this.s.daily.adBoostUsed || 0) + 1;
    this.buffs.boost = Math.max(this.buffs.boost || 0, BOOST_SEC);
    return true;
  }
  takeBoost() {
    if (this.boostLeft() <= 0) return false;
    this.s.daily.boostUsed = (this.s.daily.boostUsed || 0) + 1;
    this.buffs.boost = Math.max(this.buffs.boost || 0, BOOST_SEC);
    return true;
  }

  // ---------- 레이드 ----------
  startRaid(remainingHp, maxHp) {
    if (this.mode !== 'stage' || this.s.daily.raidTickets <= 0 || remainingHp <= 0) return false;
    this.s.daily.raidTickets--;
    this.beginContest('raid', RAID_TIME);
    this.mon = { hp: remainingHp, maxHp, isBoss: true, isRaid: true, def: RAID_BOSS, alive: true, atk: 0, atkTimer: 99, stun: 0, ...this.duelSpot() };
    return true;
  }

  endRaid() {
    if (this.mode !== 'raid') return 0;
    return this.endContest('quit')?.damage || 0;
  }

  // ---------- 회귀 ----------
  regressPreview() { return regressGain(this.s.maxStage); }

  // 회귀가 지금 이득인가 — 받을 게 충분하고, 한동안 최고 관문이 안 올랐을 때
  regressWorth() {
    if (this.mode !== 'stage') return false;
    if (this.regressPreview() < REGRESS_ADVISE_POINTS) return false;
    return this.stuckFor() > REGRESS_STUCK_SEC;
  }

  // 최고 관문이 안 오른 지 몇 초 됐나 (게임 안 시간 기준)
  stuckFor() {
    return Math.max(0, (this.clock || 0) - (this.s.climbAt || 0));
  }

  // 관문·은자·수련·레벨·스탯 포인트를 처음으로 되돌리고 전생의 기억을 얻는다.
  // 경지·병기·제련·무공·영수·신물·수련터 기록·원보는 그대로 남는다.
  regress() {
    const gain = this.regressPreview();
    if (!gain || this.mode !== 'stage') return 0;
    const s = this.s;
    s.bestStage = Math.max(s.bestStage, s.maxStage);
    s.regress.points += gain;
    s.regress.count++;
    s.stage = 1;
    s.maxStage = 1;
    this.s.climbAt = this.clock || 0;
    s.kills = 0;
    s.farming = false;
    s.gold = 0;
    for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 0;
    s.level = 1;
    s.exp = 0;
    s.sp = 0;
    for (const k of Object.keys(s.spAlloc)) s.spAlloc[k] = 0;
    this.buffs = { rage: 0, gale: 0, midas: 0 };
    this.queue = [];
    this.adds = [];
    this.heroHp = this.stats().hp;
    this.emit('regress', { gain, count: s.regress.count });
    this.spawnStage();
    return gain;
  }

  toJSON(now = Date.now()) {
    this.s.lastSeen = now;
    return this.s;
  }
}
