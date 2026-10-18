// 게임 규칙과 상태. DOM을 모르는 순수 로직이라 Node에서도 돌아간다.
import {
  SAVE_VERSION, OFFLINE_CAP_SEC, KILLS_PER_STAGE, BOSS_TIME, SPAWN_DELAY, RAID_TIME, RAID_TICKETS,
  MERGE_COUNT, GACHA_COST, GACHA10_COST, DAILY_GEMS, START_GEMS, SPEED_CAP, CRIT_CAP,
  UPGRADES, GRADES, GACHA_RATES, EQUIP_TYPES, ENHANCE_PER, enhanceCost,
  CODEX_PER_TYPE, CODEX_ALL,
  OPTION_SLOTS, OPTION_STATS, OPTION_GRADE_RATES, OPTION_ROLL_MIN, OPTION_ROLL_MAX,
  optionSlotCount, optionRerollCost, OPTION_SET_GRADE, OPTION_SET, OPTION_SET_FULL_GRADE, OPTION_SET_FULL,
  ACC_SLOTS, ACC_STAR_MAX, ACC_PIERCE_MAX, ACC_MERGE, accPierceCost, accPower,
  ACC_SET_GRADE, ACC_SET, ACC_BOX_RATES,
  CODEX_KINDS, CODEX_GRADE_MULT, CODEX_KIND_FULL, CODEX_ALL_FULL, codexEntryPower, codexGradeOf,
  expPerKill, expToNext, SP_PER_LEVEL, SP_RESET_GEMS, SP_STATS,
  RANKS, RANK_MULT, TRIAL_TIME, trialBoss,
  PETS, PET_EGG_COST, PET_GRADE_WEIGHT, petFoodCost, PET_DUPLICATE_FOOD, PET_ATTACK_INTERVAL, petDamageMult,
  BOND_PER_SEC, BOND_PER_LV, BOND_MAX, bondLevel, ENGRAVE_MIN_LV, engraveCost,
  ATTEND_CYCLE, attendReward, BOOST_PER_DAY, BOOST_SEC, BOOST_MULT, mobGroupSize,
  MELEE_RANGE, HERO_SPEED, MOB_SPEED, MOB_SEPARATION, FIELD_ASPECT, FIELD_SQUASH, MOB_SPAWN_NEAR, MOB_SPAWN_FAR,
  refillRate, fieldRadius, MAX_ATTACKERS, FIELD_WIDE, FIELD_TALL, isWallStage,
  RELICS, RELIC_DIG_COST,
  SKILLS, SKILL_SLOTS, skillBookCost,
  DUNGEONS, DUNGEON_KEYS, DUNGEON_TIME, DUNGEON_MOBS, dungeonStage, dungeonReward,
  DUNGEON_KEY_CAP, RAID_TICKET_CAP, PVP_TICKET_CAP,
  MISSIONS, MISSION_ALL_REWARD, stageMilestone, STAGE_MILESTONE_EVERY,
  PVP_TICKETS, PVP_TIME, PVP_WIN, PVP_LOSE, PVP_REWARD,
  zoneOf, monsterHp, monsterAtk, monsterGold, BOSS_HP_MULT, BOSS_ATK_MULT, BOSS_GOLD_MULT, RAID_BOSS,
  REGRESS_PER_POINT, regressGain,
  bossGems, bossRelicShards, guildAtkBonus,
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
    // 인물도감: 종류×등급 칸을 한 번이라도 채웠는가 (회귀해도 남는다)
    lore: Object.fromEntries(CODEX_KINDS.map((k) => [k.id, GRADES.map(() => 0)])),
    acc: Object.fromEntries(ACC_SLOTS.map((a) => [a.id, null])),      // { grade, star, pierce }
    accBag: Object.fromEntries(ACC_SLOTS.map((a) => [a.id, GRADES.map(() => 0)])),
    enhance: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, 0])),
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, 1])),
    skillSlots: ['slash', null, null, null],
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

export function migrate(raw, now = Date.now()) {
  const base = newSave(now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...raw };
  for (const key of ['upgrades', 'skills', 'stats', 'spAlloc', 'enhance', 'dungeons', 'pvp', 'regress']) {
    s[key] = { ...base[key], ...(raw[key] || {}) };
  }
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
  s.options = { ...base.options };
  s.optionLock = { ...base.optionLock };
  for (const k of Object.keys(EQUIP_TYPES)) {
    const src = raw.options?.[k];
    if (Array.isArray(src)) {
      s.options[k] = Array.from({ length: OPTION_SLOTS }, (_, i) => {
        const o = src[i];
        return o && typeof o === 'object' ? { stat: o.stat, grade: o.grade | 0, roll: o.roll || 1 } : null;
      });
    }
    const lk = raw.optionLock?.[k];
    s.optionLock[k] = Array.from({ length: OPTION_SLOTS }, (_, i) => !!(Array.isArray(lk) && lk[i]));
  }
  if (!Array.isArray(raw.skillSlots)) {
    // v1 → v2: 해금된 스킬을 순서대로 장착
    s.skillSlots = SKILLS.filter((sk) => (raw.maxStage || 1) >= sk.unlock).slice(0, SKILL_SLOTS).map((sk) => sk.id);
  }
  while (s.skillSlots.length < SKILL_SLOTS) s.skillSlots.push(null);
  s.bestStage = Math.max(raw.bestStage || 1, s.maxStage || 1);
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

  // 자리마다 쌓인 것 중 가장 좋은 등급을 끼운다 (비어 있을 때만)
  autoEquipAcc() {
    for (const a of ACC_SLOTS) {
      if (this.s.acc[a.id]) continue;
      const bag = this.s.accBag[a.id];
      for (let g = bag.length - 1; g >= 0; g--) {
        if (!bag[g]) continue;
        bag[g]--;
        this.s.acc[a.id] = { grade: g, star: 0, pierce: 0 };
        break;
      }
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
      const roll = OPTION_ROLL_MIN + this.rng() * (OPTION_ROLL_MAX - OPTION_ROLL_MIN);
      arr[i] = { stat: def.id, grade, roll };
      out.push(arr[i]);
    }
    return { cost, rolled: out };
  }

  toggleOptionLock(type, i) {
    const lock = this.s.optionLock?.[type];
    if (!lock || i < 0 || i >= OPTION_SLOTS) return false;
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
    return m * (1 + ENHANCE_PER * (this.s.enhance[type] || 0));
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

    // 장신구
    for (const a of ACC_SLOTS) {
      const cur = this.s.acc?.[a.id];
      if (!cur) continue;
      m[a.stat] += accPower(a, cur.grade, cur.star, cur.pierce);
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

  rankMult() { return Math.pow(RANK_MULT, this.s.rank); }

  // 전생의 기억: 회귀로 쌓은 포인트만큼 공격력·체력·은자·경험치 증가
  regressMult() { return 1 + REGRESS_PER_POINT * (this.s.regress.points || 0); }

  stats({ buffs = true } = {}) {
    const u = this.s.upgrades;
    const m = this.mods();
    const b = buffs ? this.buffs : {};
    const rage = b.rage > 0 ? SKILLS[1].mult(this.s.skills.rage) : 1;
    const gale = b.gale > 0 ? SKILLS[4].mult(this.s.skills.gale) : 1;
    const midas = b.midas > 0 ? SKILLS[5].mult(this.s.skills.midas) : 1;
    const guild = 1 + guildAtkBonus(this.guildExp);
    const rank = this.rankMult();
    const past = this.regressMult();
    const boost = (b.boost || 0) > 0 ? BOOST_MULT : 1;
    const atk = UPGRADES.atk.value(u.atk) * this.equipMult('weapon') * (1 + m.atk) * rank * guild * rage * past * boost;
    const hp = UPGRADES.hp.value(u.hp) * this.equipMult('armor') * (1 + m.hp) * rank * past;
    const crit = Math.min(CRIT_CAP, UPGRADES.crit.value(u.crit) + m.crit);
    const critDmg = UPGRADES.critDmg.value(u.critDmg) + m.critDmg;
    const speed = Math.min(SPEED_CAP, UPGRADES.speed.value(u.speed)) * (1 + m.speed) * gale;
    const goldMul = UPGRADES.gold.value(u.gold) * this.equipMult('ring') * (1 + m.gold) * midas * past;
    const expMul = (1 + m.exp) * past;
    const bossMul = 1 + m.boss;
    const pet = this.s.pet ? PETS.find((p) => p.id === this.s.pet) : null;
    const petHit = pet ? atk * petDamageMult(pet, this.s.pets[pet.id] || 1) : 0;
    const dps = atk * speed * (1 + crit * (critDmg - 1)) + petHit / PET_ATTACK_INTERVAL;
    return {
      atk, hp, crit, critDmg, speed, goldMul, expMul, bossMul, petHit, dps,
      bossTime: BOSS_TIME + m.bossTime, offlineMul: 1 + m.offline,
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
    return undefined;
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
        const step = Math.min(MOB_SPEED * dt, (seen - stop) / k);
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
    // 열 명을 베면 두목이 길을 막는다
    if (!this.s.farming && this.s.kills >= KILLS_PER_STAGE && !live.some((m) => m.isBoss)) {
      this.spawnStage();
      return;
    }
    if (live.some((m) => m.isBoss)) return; // 두목전에는 잡졸이 끼어들지 않는다
    const want = mobGroupSize(this.s.stage);
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
    const isBoss = !this.s.farming && this.s.kills >= KILLS_PER_STAGE;
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
    }
    return hits;
  }

  // 적 하나에게 피해. 주 타겟이면 기존 처리를, 아니면 졸개 처리를 탄다.
  damageMob(m, amount, kind) {
    if (m === this.mon) { this.dealDamage(amount, kind, false); return; }
    m.hp -= amount;
    this.emit('dmg', { amount, kind, crit: false, add: true, at: m });
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
    this.heroX += Math.cos(ang) * sk.dashDist;
    this.heroY += (Math.sin(ang) * sk.dashDist) / FIELD_SQUASH;
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
      const n = this.hitCircle(f.x, f.y, f.r, f.amount, f.id);
      if (n) this.emit('fieldTick', { id: f.id, x: f.x, y: f.y, r: f.r, hits: n });
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
    if (!this.s.farming) this.s.kills++;
  }

  dealDamage(amount, kind = 'hit', crit = false) {
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
    if (this.mode === 'trial') return this.endContest('clear');
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
      }
      if (s >= this.s.maxStage) { // 이번 생에서 처음 넘는 관문
        const gems = bossGems(s);
        this.s.gems += gems;
        this.s.relicShards += bossRelicShards(s);
        this.emit('gems', { amount: gems });
      }
      this.s.stage = s + 1;
      this.s.maxStage = Math.max(this.s.maxStage, this.s.stage);
      this.s.bestStage = Math.max(this.s.bestStage, this.s.maxStage);
      this.s.kills = 0;
      this.autoSlotSkills();
      this.emit('stageClear', { stage: s });
    } else if (!this.s.farming) {
      this.s.kills++;
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
    if (this.mode === 'dungeon' || this.mode === 'trial') return this.endContest('fail');
    if (this.mode === 'pvp') return this.endContest('lose');
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
    if (this.s.pet && this.mon?.alive) {
      const b = this.s.bond || (this.s.bond = {});
      b[this.s.pet] = (b[this.s.pet] || 0) + BOND_PER_SEC * dt;
    }
    for (const k in this.buffs) if (this.buffs[k] > 0) this.buffs[k] = Math.max(0, this.buffs[k] - dt);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    const st = this.stats();

    if (this.contest) {
      this.contest.time -= dt;
      if (this.contest.time <= 0) return this.endContest('timeout');
      if (this.mode === 'raid' && this.mon.hp <= 0) return this.endContest('done');
    }

    // 들판 사냥: 적을 찾아 걸어가서 벤다
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
      for (const id of this.s.skillSlots) {
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
      this.dealDamage(st.atk * (crit ? st.critDmg : 1), 'hit', crit);
    }

    // 펫 공격
    if (st.petHit > 0 && this.mon?.alive) {
      this.petTimer -= dt;
      if (this.petTimer <= 0) {
        this.petTimer += PET_ATTACK_INTERVAL;
        this.emit('petAttack');
        if (this.mon?.alive) this.dealDamage(st.petHit, 'pet');
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
        this.heroHp -= dmg;
        this.emit('heroHit', { amount: dmg, crit });
      }
      if (m.petHit) {
        m.petTimer -= dt;
        if (m.petTimer <= 0) {
          m.petTimer += PET_ATTACK_INTERVAL;
          this.heroHp -= m.petHit;
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
          this.heroHp -= a.atk * 0.6;
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
    this.s.exp += x;
    let ups = 0;
    while (this.s.exp >= expToNext(this.s.level)) {
      this.s.exp -= expToNext(this.s.level);
      this.s.level++;
      this.s.sp += SP_PER_LEVEL;
      ups++;
    }
    if (ups) this.emit('levelUp', { level: this.s.level, ups });
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
  canTrial() { const r = this.nextRank(); return !!r && this.s.level >= r.level && this.mode === 'stage'; }

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
    } else if (c.mode === 'trial') {
      out.win = result === 'clear';
      if (out.win) {
        this.s.rank = c.rank;
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
    return out;
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
  skillUnlocked(sk) { return this.s.bestStage >= sk.unlock; }

  autoSlotSkills() {
    for (const sk of SKILLS) {
      if (!this.skillUnlocked(sk) || this.s.skillSlots.includes(sk.id)) continue;
      const free = this.s.skillSlots.indexOf(null);
      if (free < 0) return;
      this.s.skillSlots[free] = sk.id;
    }
  }

  setSkillSlot(slot, id) {
    if (slot < 0 || slot >= SKILL_SLOTS) return false;
    const sk = SKILLS.find((x) => x.id === id);
    if (id && (!sk || !this.skillUnlocked(sk))) return false;
    const cur = this.s.skillSlots.indexOf(id);
    if (id && cur >= 0) this.s.skillSlots[cur] = this.s.skillSlots[slot];
    this.s.skillSlots[slot] = id;
    return true;
  }

  useSkill(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk) || this.cd[id] > 0 || !this.mon?.alive || this.mode === 'pvp') return false;
    // 자리를 옮기거나 들판에 남는 무공은 1:1 겨루기에서 쓸 자리가 없다
    const roams = sk.motion === 'dash' || sk.motion === 'blink' || sk.motion === 'tornado';
    if (roams && this.mode !== 'stage') return false;
    if (!this.s.skillSlots.includes(id)) return false;
    const lv = this.s.skills[id];
    const st = this.stats();
    if (sk.kind === 'dmg') {
      this.emit('skillArea', { id, radius: sk.radius || 0, target: sk.target || 'single' });
      if (sk.stun) this.mon.stun = sk.stun;
      this.emit('skill', { id, target: sk.target || 'single' });
      let dmg = st.atk * sk.mult(lv);
      // 한 명만 노리는 무공은 두목에게 더 아프게 들어간다
      if (sk.bossMult && this.mon.isBoss) dmg *= sk.bossMult;
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
    } else if (sk.kind === 'buff') {
      this.buffs[id] = sk.dur;
      this.emit('skill', { id });
    } else if (sk.kind === 'heal') {
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * sk.mult(lv));
      this.emit('skill', { id });
    }
    this.cd[id] = sk.cd;
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
  upgradeMaxed(key) { const m = UPGRADES[key].max; return m !== undefined && this.s.upgrades[key] >= m; }

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

  addGold(g) {
    this.s.gold += g;
    this.s.stats.gold += g;
  }

  // 보상 묶음 지급: {gold, gems, books, stones, food, relicShards}
  grant(r = {}) {
    if (r.gold) this.addGold(r.gold);
    for (const k of ['gems', 'books', 'stones', 'food', 'relicShards']) if (r[k]) this.s[k] += r[k];
    return r;
  }

  // ---------- 장비 ----------
  rollGrade() {
    let r = this.rng();
    for (let g = 0; g < GACHA_RATES.length; g++) {
      if (r < GACHA_RATES[g]) return g;
      r -= GACHA_RATES[g];
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
        if (!this.s.pet || PETS.find((p) => p.id === this.s.pet).grade < pet.grade) this.s.pet = pet.id;
      }
    }
    this.progress('gacha', count);
    return out;
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

  equipPet(id) {
    if (!this.s.pets[id]) return false;
    this.s.pet = id;
    return true;
  }

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
    this.emit('engrave', { id, lv });
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
    const perHit = st.atk * (1 + st.crit * (st.critDmg - 1));
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
    if (!reward) return;
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
    this.emit('attend', { day, reward: r });
    return { day, reward: r };
  }

  // 기연: 하루 몇 번, 일정 시간 공격력이 오른다
  boostLeft() { return Math.max(0, BOOST_PER_DAY - (this.s.daily.boostUsed || 0)); }
  takeBoost() {
    if (this.boostLeft() <= 0) return false;
    this.s.daily.boostUsed = (this.s.daily.boostUsed || 0) + 1;
    this.buffs.boost = Math.max(this.buffs.boost || 0, BOOST_SEC);
    this.emit('boost', { sec: BOOST_SEC });
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
