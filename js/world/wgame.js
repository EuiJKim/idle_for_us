// 바람식 개편 — 게임. 마을과 사냥터, 몹 젠, 자동 사냥, 레벨·스탯·장비, 물약, 전직 스킬, 방치.
// 설계: docs/바람식_개편.md
//
// 그리는 쪽(battle.js BattleView)은 옛 Game을 읽던 그대로 이것을 읽는다 —
// heroX/heroY/heroFacing/heroAngle/walking, mons/mon, mode('stage'), s.job/s.rank/s.stage,
// stats().hp, heroHp, events(attack·dmg·kill·heroHit·heroDied·skill·levelUp …).
// 그래서 들판 그림·이펙트·초식 연출표를 손대지 않고 쓴다.
import * as W from './wdata.js';

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
    equip: { weapon: null, armor: null, hat: null, acc: null, finger: null, ear: null },
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
    lastSeen: now,
    titles: [],
    kills: 0,
    deaths: 0,
    bestMap: W.mapId(1, 1),
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
  for (const [k, v] of Object.entries(raw.mats || {})) if ((W.MATS[k] || (k[0] === 'b' && W.MATS[k.slice(1)])) && v > 0) s.mats[k] = Math.floor(Number(v) || 0);
  delete s.autoSell;
  // v105: 레벨업 점수를 직접 찍게 바꿨다 — 옛 세이브의 '자동 분배 켬'은 한 번 끈다
  if ((raw.statV || 0) < 2) { s.autoStat = false; s.statV = 2; }
  s.bag = Array.isArray(raw.bag) ? raw.bag.filter((i) => i && W.SLOTS.some((x) => x.id === i.slot)) : [];
  s.level = clamp(Math.floor(Number(s.level) || 1), 1, W.LEVEL_MAX);
  for (const k of ['exp', 'gold', 'potions', 'statPts', 'jobTier', 'kills', 'deaths', 'books']) s[k] = Math.max(0, Number(s[k]) || 0);
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
  for (const it of [...s.bag, ...Object.values(s.equip), ...s.pets, ...s.petBox, ...s.mounts]) {
    if (!it) continue;
    if (it.uid >= uidSeq) uidSeq = it.uid + 1;
    // v110: 등급이 없던 조합 장비는 레어로 (옵션 하나)
    if (it.step != null && it.rar == null) { it.rar = 0; it.opts = W.rollSkillOpts(0, rand); it.grade = W.RARITY_GRADE[0]; }
  }
  return s;
}

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
    this.walking = false;
    this.heroFacing = 1;
    this.heroAngle = 0;
    this.rng = rand;
    this.guildExp = 0;             // 문파 경험치 (서버가 넣는다)
    // 최근 벌이 (방치 보상을 재는 데 쓴다): [시각, 처치, 경험치, 은자, 물약]
    this.ledger = [];
    this._stats = null;
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
  get map() { return W.mapOf(this.s.map); }
  // 칸 지도 크기 — 그리는 쪽이 이걸 보고 사냥터 한 장이 화면에 들어오게 카메라를 물린다
  get mapW() { return W.MAP_W; }
  get mapH() { return W.MAP_H; }
  get tile() { return W.TILE; }

  // ---------- 수치 ----------
  totalStat(k) { return (W.CLASSES[this.s.job]?.base[k] || 0) + (this.s.stats[k] || 0); }
  itemStats(it) {
    if (!it) return {};
    const b = W.itemBase(it.slot, it.ilv);
    // 조합 장비는 사다리 칸으로, 옛 판의 떨군 장비는 등급으로
    // 조합 장비: 사다리 칸 × 등급(레어·유니크·전설·신화), 옛 드랍 장비: 옛 등급
    const q = it.step != null ? W.stepMult(it.step) * W.RARITY[it.rar || 0].mult : W.GRADES[it.grade].mult;
    const m = q * W.enhanceMult(it.plus || 0);
    const out = {};
    for (const [k, v] of Object.entries(b)) out[k] = v * m;
    // 가락지·귀걸이: 그 두목의 덤 능력 (등급만큼 커진다, 강화와는 따로)
    if (W.isDropOnly(it.slot) && it.step != null) {
      for (const [k, v] of Object.entries(W.acc2Trait(W.stepMap(it.step), it.slot))) out[k] = (out[k] || 0) + v * W.RARITY[it.rar || 0].mult;
    }
    return out;
  }
  stats() {
    if (this._stats && this._stats.sig === this.statSig()) return this._stats;
    const s = this.s;
    const L = s.level;
    const cls = W.CLASSES[s.job] || {};
    const gear = { atk: 0, hp: 0, def: 0, crit: 0, atkPct: 0, speed: 0, hpPct: 0, regenPct: 0, skill: 0, critDmg: 0, exp: 0 };
    for (const it of Object.values(s.equip)) {
      const st = this.itemStats(it);
      for (const k of Object.keys(st)) gear[k] = (gear[k] || 0) + st[k];
    }
    // 애완동물 버프 · 탈것(공격력·체력 %) · 십이지왕 신화
    gear.mat = 0;
    for (const p of this.activePets()) {
      const d = W.petOf(p.kind);
      gear[d.buff] = (gear[d.buff] || 0) + W.petBuff(p);
      for (const [k, v] of Object.entries(d.also || {})) gear[k] = (gear[k] || 0) + v * W.petScale(p);   // 황룡: 둘 다
    }
    const mt = this.mountNow();
    if (mt) { gear.atkPct += mt.stat; gear.hpPct += mt.stat; }
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
      moveSpeed: 1 + (mt ? mt.speed : 0) + (cls.move || 0) + (pm.move || 0),
      boss: cls.boss || 1,
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
    return `${s.level}|${JSON.stringify(s.passLv || {})}|${s.guildId ? W.guildLevel(this.guildExp) : 0}|${s.job}|${s.stats.str},${s.stats.dex},${s.stats.vit},${s.stats.int}|${W.SLOTS.map((x) => g(e[x.id])).join(',')}|${pets}|${s.mount || '-'}`;
  }
  power() { return this.stats().power; }

  // ---------- 지도 ----------
  canEnter(id) {
    if (!W.hasMap(id)) return false;
    const m = W.mapOf(id);
    return m.town || this.s.level >= m.lv[0];
  }
  enterMap(id, quiet = false) {
    this.clones = [];
    if (!this.canEnter(id)) return false;
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
    const hp = W.mobHp(lv) * (boss ? W.BOSS.hp : elite ? W.ELITE.hp : 1);
    const mob = {
      id: uidSeq++, lv, c, r, hc: c, hr: r, move: null, x, y, hp, maxHp: hp, alive: true, isBoss: !!boss, born: this.clock,
      atk: W.mobAtk(lv) * (boss ? W.BOSS.atk : elite ? W.ELITE.atk : 1), armor: W.mobDef(lv),
      grade: king ? 3 : boss ? 2 : elite || m.bossRoom ? 1 : 0, elite,
      kp: king ? W.KING_MYTHIC[king.no]?.id : null,
      atkTimer: 1 + this.rng(), stun: 0, slow: 0, poison: 0, poisonPer: 0,
      aggro: false, wanderT: this.rng() * 3,
      def: { name: kind.name, look: kind.look, beast: kind.beast, bscale: kind.bscale },
    };
    mob.name = kind.name;
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
    const st = this.stats();
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.potionT = Math.max(0, this.potionT - dt);
    if (this.frenzyT > 0) this.frenzyT -= dt;
    if (this.reviveCd > 0) this.reviveCd -= dt;
    for (const k in this.buffs) if (this.buffs[k] > 0) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) { delete this.buffs[k]; delete this.buffv[k]; if (k === 'shield') this.shield = 0; } }
    // 회복
    const regen = this.map.town ? st.hp * W.REST_HEAL : st.regen;
    if (this.heroHp > 0) this.heroHp = Math.min(st.hp, this.heroHp + regen * dt);
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
      if (this.bossT <= 0) { this.bossT = W.BOSS_RESPAWN; this.spawnMob(true); }
    }
    // 두목 등장 연출 동안은 들판 전체가 멈춘다(무인도 몹도)
    if (this.freezeT > 0) { this.freezeT -= dt; this.walking = false; for (const m of this.mons) if (m.introT > 0) m.introT -= dt; return; }
    this.tickMobs(dt, st);
    if (this.heroHp <= 0) return;
    this.tickFields(dt, st);
    this.tickClones(dt, st);
    this.tickPotion(st);
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
            const ps = this.passives();
            if (ps.has('dodge') && this.rng() < 0.25) { this.emit('passive', { id: 'dodge' }); continue; }   // 환왕
            const cls = W.CLASSES[this.s.job] || {};
            const pm = this.pmods();
            if (this.buffv.dodge && this.rng() < this.buffv.dodge) { this.emit('passive', { id: 'dodge' }); continue; }   // 유운보
            if (cls.fear && this.rng() < cls.fear + (pm.fearUp || 0) + (this.buffv.fear || 0)) {                                     // 극악소마: 공포
              this.emit('passive', { id: 'fear', at: m });
              if (pm.own5 && this.s.job === 'ring') this.strike(m, st, 1.5, 'mask');                        // 무면귀 5: 가면의 일격
              continue;
            }
            const red = (1 - (cls.dmgRed || 0)) * (1 - (this.buffv.guard || 0)) * (1 - Math.min(0.6, pm.dmgRed || 0));
            const dmg = Math.max(1, m.atk * (0.9 + this.rng() * 0.2) * red - st.def);
            let left = dmg;
            if (this.shield > 0 && this.buffs.shield > 0) { const a = Math.min(this.shield, left); this.shield -= a; left -= a; }   // 금종조
            this.heroHp -= left;
            this.emit('heroHit', { amount: left, shielded: dmg - left });
            if (ps.has('reflect')) this.hurt(m, dmg * 0.4, 'reflect', false);                                 // 철왕
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
    if (this.heroHp < st.hp * W.POTION_AT) this.drinkPotion();
  }
  drinkPotion() {
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
      if (this.slide(this, 'heroX', 'heroY', this.hmove, W.HERO_SPEED * (st.moveSpeed || 1) * (1 + (this.buffv.move || 0)), dt)) { this.hc = this.hmove.c; this.hr = this.hmove.r; this.hmove = null; }
      else return;
    }
    // 손으로 찍은 칸이 있으면 거기로 먼저 간다
    if (this.manual) {
      if (this.hc === this.manual.c && this.hr === this.manual.r) { this.manual = null; this.manualHold = 1.2; } else {
        if (!this.stepHero(this.manual.c, this.manual.r)) { this.manual = null; this.manualHold = 0.6; }
        return;
      }
    }
    if (this.manualHold > 0) { this.manualHold -= dt; this.walking = false; return; }
    // 과녁: 나를 치고 있는 몹 → 가장 가까운 몹. 자동 사냥이 꺼져 있으면 붙어 있는 것만 친다.
    if (!this.mon?.alive) this.mon = this.pickTarget(st);
    const m = this.mon;
    if (!m) { this.walking = false; return; }
    const mt = this.mobTile(m);
    const dist = this.tileDist({ c: this.hc, r: this.hr }, mt);
    this.heroAngle = Math.atan2((m.y - this.heroY) * 0.6, m.x - this.heroX);
    if (Math.abs(m.x - this.heroX) > 6) this.heroFacing = m.x >= this.heroX ? 1 : -1;
    if (this.s.autoSkill) this.autoSkills(st);
    if (!this.mon?.alive) return;
    if (dist > st.range) {
      if (!this.s.autoHunt && !m.aggro) { this.walking = false; return; }
      // 칠 수 있는 빈 칸(사거리 안)까지 길을 찾는다. 길이 없으면 이 과녁은 잠깐 두고 다른 몹을 잡는다.
      const f = this.findStep(this.hc, this.hr, (c, r) => this.tileDist({ c, r }, this.mobTile(m)) <= st.range, 'hero');
      if (!f || f === 'here' || !this.stepTo(f)) { this.walking = false; this.giveUp(m); }
      return;
    }
    this.walking = false;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = st.atkSec / (this.frenzyT > 0 ? 1.5 : 1) / (1 + (this.buffv.haste || 0));
      this.basicAttack(m, st, dist);
    }
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
    let best = null;
    let bd = Infinity;
    const h = { c: this.hc, r: this.hr };
    for (const m of this.mons) {
      if (!m.alive || m.npc || m.introT > 0 || m.unreachUntil > this.clock) continue;
      let d = this.tileDist(h, this.mobTile(m));
      if (m.aggro) d *= 0.5;                          // 나를 치러 오는 놈 먼저
      if (!this.s.autoHunt && d > st.range * 1.2 && !m.aggro) continue;
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
    const cls = W.CLASSES[this.s.job] || {};
    // 검사 일화: 네 번째마다 꽃잎 검기가 과녁 둘레를 벤다
    if (cls.flower && (this.flowerN = (this.flowerN || 0) + 1) % (pm.own5 ? 3 : cls.flower.every) === 0) {
      this.emit('passive', { id: 'flower', at: { x: tx, y: ty } });
      for (const o of this.mons.slice()) if (o.alive && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= cls.flower.r) this.strike(o, st, mult * cls.flower.mult * (1 + (pm.flowerUp || 0)), 'flower');
    }
    // 투신심법 5: 다섯 번째 평타마다 투신일격
    if (this.s.job === 'fist' && pm.own5 && (this.fistN = (this.fistN || 0) + 1) % 5 === 0) {
      this.emit('passive', { id: 'tusin', at: { x: tx, y: ty } });
      if (m.alive) this.strike(m, st, mult * 2, 'tusin');
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= 160) this.strike(o, st, mult * 0.5, 'tusin');
    }
    // 권마 불패금신: 평타가 둘레를 친다
    if (this.buffv.cleave) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - this.heroX, (o.y - this.heroY) * 0.75) <= 150) this.strike(o, st, mult * this.buffv.cleave, 'cleave');
    }
    // 검왕: 평타가 둘레 모든 적을 벤다
    if (ps.has('formless')) {
      for (const o of this.mons.slice()) if (o.alive && o !== m && !o.npc && Math.hypot(o.x - tx, (o.y - ty) * 0.75) <= 120) this.strike(o, st, mult * 0.7, 'cleave');
    }
  }

  strike(m, st, mult, kind, extraCrit = 0, quiet = false) {
    const crit = this.rng() < st.crit + extraCrit;
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
    dmg = Math.max(1, dmg - m.armor);
    const mx = m.x, my = m.y;
    this.hurt(m, dmg, kind, crit, quiet);
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
    if (m.alive && cls.poison && kind !== 'poison') this.addDot(m, dmg * (cls.poison + (pm.poisonUp || 0)), cls.poisonSec || 3);
    return dmg;
  }
  // 독·출혈: total만큼을 웅덩이에 붓는다 — 쌓인다(빠르기는 마지막에 부은 sec쯤)
  addDot(m, total, sec) {
    m.dot = (m.dot || 0) + total;
    m.dotTau = sec / 2;
    m.poison = sec;
  }

  hurt(m, dmg, kind, crit, quiet = false) {
    if (!m.alive || m.introT > 0) return;
    m.hp -= dmg;
    m.aggro = true;
    if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m) {
    m.alive = false;
    m.hp = 0;
    const st = this.stats();
    const exp = W.mobExp(m.lv) * (m.isBoss ? W.BOSS.exp : m.elite ? W.ELITE.exp : 1) * this.levelGapMult(m.lv) * (st.expMult || 1);
    const gold = Math.round(W.mobGold(m.lv) * (m.isBoss ? W.BOSS.gold : m.elite ? W.ELITE.gold : 1));
    this.s.gold += gold;
    this.s.kills++;
    const mat = this.dropMats(m);
    if (m.elite) this.dropMats(m);
    // 독마: 중독된 채 쓰러지면 독이 둘레로 번진다
    if (W.CLASSES[this.s.job]?.spread && m.dot > 0) {
      const left = m.dot;
      m.dot = 0;
      const k = this.pmods().own5 ? 1.2 : 0.6;   // 만독불침 5: 두 배로
      for (const o of this.mons) if (o.alive && !o.npc && o !== m && Math.hypot(o.x - m.x, (o.y - m.y) * 0.75) <= 140) this.addDot(o, left * k, 4);
    }
    this.emit('kill', { gold, isBoss: m.isBoss, add: true, at: m, mat });
    this.addExp(exp);
    this.note(1, exp, gold, 0);
    this.petExp(exp * 0.5);
    // 탈것 — 아주 드물게 (두목은 조금 더)
    const mr = m.isBoss ? W.mountBossRate(this.map.zone) : W.MOUNT_DROP_MOB;
    if (this.rng() < mr) this.gainMount(W.rollMount(this.rng, this.map.zone, m.isBoss), m);
    if (this.passives().has('frenzy')) this.frenzyT = 4;
    if (m === this.mon) this.mon = null;
    if (!m.isBoss) this.respawns.push({ t: W.RESPAWN_SEC });
    void st;
  }

  // 나보다 많이 약한 몹은 경험치가 깎인다 — 낮은 사냥터에 눌러앉는 것보다 올라가는 게 낫게
  levelGapMult(mlv) {
    const gap = this.s.level - mlv;
    return gap <= 5 ? 1 : Math.max(0.1, 1 - (gap - 5) * 0.08);
  }

  heroDied(by) {
    this.heroHp = 0;
    this.s.deaths++;
    const loss = Math.floor(this.s.exp * W.DEATH_EXP_LOSS);
    this.s.exp -= loss;
    this.emit('heroDied', { boss: !!by?.isBoss, loss });
    this.heroHp = 1;
    this.goTown(true);
  }

  // ---------- 스킬 ----------
  skills() { return this.s.job ? W.skillsOf(this.s.job).filter((k) => this.knows(k)) : []; }
  // 배웠나 — 공격 무공은 전직 차수, 보조기는 레벨(v120)
  knows(sk) { return !!sk && (sk.kind === 'support' ? this.s.level >= sk.from : sk.tier <= this.s.jobTier); }
  skillDef(id) { return this.s.job ? W.skillsOf(this.s.job).find((k) => k.id === id) : null; }
  hpCostOf(sk) { return Math.round(this.stats().hp * (sk.hpCost || 0) * (1 - this.skillMods(sk.id).cost)); }
  skillRadius(sk) { return (sk.radius || 0) * (1 + this.skillMods(sk.id).range); }
  skillCd(sk) { return sk.cd * (1 - this.skillMods(sk.id).cd); }
  canUseSkill(id) {
    const sk = this.skillDef(id);
    if (!this.knows(sk) || this.cd[id] > 0 || this.map.town) return false;
    if (this.heroHp <= this.hpCostOf(sk) + 1) return false;      // 대가로 죽지는 않는다
    return true;
  }
  useSkill(id) {
    if (!this.canUseSkill(id)) return false;
    const sk = this.skillDef(id);
    const st = this.stats();
    if (sk.kind === 'support') return this.useSupport(sk, st);
    if (sk.kind === 'clone') return this.useClone(sk, st);
    const tgt = this.mon?.alive ? this.mon : this.pickTarget({ ...st, range: 9999 });
    if (sk.kind === 'single' && !tgt) return false;
    if (sk.kind === 'single' && !sk.far && Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > Math.max(st.range, 160) * 1.6) return false;
    if (sk.kind === 'single' && sk.far && Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > 420) return false;
    const md = this.skillMods(id);
    const cost = this.hpCostOf(sk);
    this.heroHp -= cost;
    this.cd[id] = this.skillCd(sk);
    const aimed = (sk.kind === 'aoe' || sk.kind === 'field') && this.ranged() && tgt;
    const center = aimed ? { x: tgt.x, y: tgt.y } : { x: this.heroX, y: this.heroY };
    const r = this.skillRadius(sk);
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: sk.tier,
      at: center, radius: r, motion: sk.kind === 'single' ? 'single' : 'aoe', dur: 0 });
    if (cost) this.emit('hpCost', { amount: cost });
    // 스킬 레벨·장비 옵션: 피해 · 범위 · 치명 · (1차) 주변 적 · (신화) 한 번 더 · 숨 되돌리기
    const mult = sk.mult * st.skillMult * (1 + md.dmg);
    const crit = md.crit + (sk.sure ? 1 : 0) + (sk.crit || 0);
    const kills0 = this.s.kills;
    let dealt = 0;
    // 한 대 — 무공의 덧(기절·취약·독·두목 배수)을 함께 건다
    const hit = (m, k = 1) => {
      if (!m.alive) return;
      const d = this.strike(m, st, mult * k * (m.isBoss && sk.bossMult ? sk.bossMult : 1), id, crit);
      dealt += d;
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
          for (let i = 0; i < sk.n && near.length; i++) {
            const m = near[i % near.length];
            if (m.alive) hit(m);
          }
        } else {
          for (const m of inR(center, r)) hit(m);
        }
      }
    };
    hitOnce();
    if (sk.kind === 'field') this.fields.push({ id, x: center.x, y: center.y, r, life: sk.field.sec, max: sk.field.sec, tick: sk.field.tick, t: sk.field.tick, mult: sk.field.mult * st.skillMult * (1 + md.dmg) });
    if (md.echo && this.rng() < 0.3) { hitOnce(); this.emit('echo', { id, at: center }); }
    if (md.reset && this.s.kills > kills0) this.cd[id] = 0;
    if (sk.lifesteal) this.heroHp = Math.min(st.hp, this.heroHp + dealt * sk.lifesteal);
    if (sk.buff) {
      const b = sk.buff;
      if (b.speed) { this.buffs.gale = b.sec; this.buffv.haste = b.speed; }
      if (b.dmgRed) { this.buffs.guard = b.sec; this.buffv.guard = b.dmgRed; }
      if (b.cleave) { this.buffs.cleave = b.sec; this.buffv.cleave = b.cleave; }
      this.buffs.rage = b.sec;
    }
    // 극악소마 삼공조화: 세 무공이 HARMONY.sec 안에 이어지면
    this.skillAt[sk.slot] = this.clock;
    if (this.s.job === 'ring' && [0, 1, 2].every((k) => this.skillAt[k] != null && this.clock - this.skillAt[k] <= W.HARMONY.sec)) {
      this.buffs.might = W.HARMONY.buffSec; this.buffv.might = W.HARMONY.dmgUp; this.buffs.rage = W.HARMONY.buffSec;
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
    this.clones = Array.from({ length: sk.n }, (_, i) => ({ i, life: sk.sec, max: sk.sec, atkT: 0.3 + i * 0.15, mult: sk.mult * mult, crit: md.crit }));
    // 나오면서 한 번씩 — 분신마다 둘레를 친다
    for (let k = 0; k < sk.n; k++) {
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
      if (sk.kind === 'support') { if (this.wantSupport(sk, st)) this.useSkill(sk.id); continue; }
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
    // 맨손으로 시작하면 첫 몹도 버겁다 — 수련용 무기 하나
    if (!this.s.equip.weapon) this.s.equip.weapon = { ...this.makeItem('weapon', 1, 0), starter: true };
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
  dropMats(m) {
    const id = this.map.zone;            // 재료는 지역 번호 (구역 셋·두목 구역이 같다)
    if (!W.MATS[id]) return null;
    if (m.isBoss) {
      this.addMats(id, W.BOSS_MATS);
      this.addMats(W.bossKey(id), 1);
      // 가끔 그 지역 하급 장비를 통째로 떨군다 (십이지왕은 더 자주)
      if (this.rng() < (W.kingOf(id) ? W.KING_ITEM_RATE : W.BOSS_ITEM_RATE)) {
        const rar = W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng);
        const it = this.makeCrafted(W.CRAFT_SLOTS[Math.floor(this.rng() * W.CRAFT_SLOTS.length)].id, (id - 1) * 2, 0, rar);
        it.boss = true;   // 두목이 떨군 것 — 끼면 그 두목의 겉모습이 든다
        this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
        this.gainItem(it);
      }
      // 가락지·귀걸이 — 두목만 떨군다
      if (this.rng() < W.acc2DropRate(id)) {
        const rar = W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng);
        const it = this.makeCrafted(this.rng() < 0.5 ? 'finger' : 'ear', (id - 1) * 2, 0, rar);
        it.boss = true;
        this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
        this.gainItem(it);
      }
      // 애완동물 — 두목만, 낮은 확률
      // 초반 두목은 아주 낮게·아래 순위만, 높은 두목일수록 자주·위 순위까지
      if (this.rng() < W.petDropRate(id)) this.gainPet(W.rollRarity(W.kingOf(id) ? W.KING_RAR_W : W.BOSS_RAR_W, this.rng), m, W.rollPetKind(id, this.rng));
      return { id, n: W.BOSS_MATS, name: W.MATS[id], color: W.MAT_COLORS[id], boss: W.matName(W.bossKey(id)) };
    }
    if (this.rng() >= W.MAT_RATE * (this.stats().matMult || 1)) return null;
    this.addMats(id, 1);
    return { id, n: 1, name: W.MATS[id], color: W.MAT_COLORS[id] };
  }
  addMats(key, n) { this.s.mats[key] = (this.s.mats[key] || 0) + n; }
  makeCrafted(slot, step, plus = 0, rar = 0) {
    return { uid: uidSeq++, slot, step, ilv: W.craftIlv(step), rar, grade: W.RARITY_GRADE[rar], opts: this.rollOpts(slot, step, rar), plus };
  }
  // 옵션: 스킬 옵션 + (가락지·귀걸이) 애완동물 +N + (십이지왕 지역 신화) 왕의 고유 효과
  rollOpts(slot, step, rar) {
    const opts = W.rollSkillOpts(rar, this.rng);
    const king = W.kingOf(W.stepMap(step));
    if (rar === 3 && king) {
      const i = opts.findIndex((o) => o.sp);
      if (i >= 0) opts[i] = { kp: king.no };
    }
    if (W.isDropOnly(slot) && W.PET_SLOT_OPT[rar] && this.rng() < W.PET_SLOT_CHANCE) opts.push({ pet: W.PET_SLOT_OPT[rar] });
    return opts;
  }
  // 조합에 넣을 장비 — 같은 칸에서 만들 것보다 낮은 조합 장비 가운데 가장 좋은 것 (v120: 바로 아래 칸이 아니어도 된다)
  recipeSource(r) {
    let best = null;
    for (const it of [this.s.equip[r.slot], ...this.s.bag]) {
      if (!it || it.slot !== r.slot || it.step == null || it.step >= r.step) continue;
      if (!best || it.step > best.step || (it.step === best.step && this.itemScore(it) > this.itemScore(best))) best = it;
    }
    return best;
  }
  // 조합법 — 넣을 장비가 없거나 안 넣으면 재료가 NO_BASE_MULT배
  recipeFor(slot, step, useBase = true) {
    const r = W.recipeOf(slot, step);
    const src = useBase ? this.recipeSource(r) : null;
    if (src) return { r, src };
    const mats = {};
    for (const [k, n] of Object.entries(r.mats)) mats[k] = Math.ceil(n * (k[0] === 'b' ? 1 : W.NO_BASE_MULT));
    return { r: { ...r, mats }, src: null };
  }
  // 조합할 수 있나 — 모자란 것을 함께 돌려준다(화면에 '청죽 마디 12/40'처럼)
  craftCheck(slot, step, useBase = true) {
    const { r, src } = this.recipeFor(slot, step, useBase);
    const lack = [];
    for (const [k, n] of Object.entries(r.mats)) if ((this.s.mats[k] || 0) < n) lack.push(k);
    if (this.s.gold < r.gold) lack.push('gold');
    return { r, src, ok: !lack.length, lack };
  }
  craft(slot, step, useBase = true) {
    if (step < 0 || step >= W.TIER_COUNT * 2 || W.isDropOnly(slot)) return null;
    const { r, src, ok } = this.craftCheck(slot, step, useBase);
    if (!ok) return null;
    for (const [k, n] of Object.entries(r.mats)) this.s.mats[k] -= n;
    this.s.gold -= r.gold;
    // 받은 장비는 사라지고, 강화는 절반을 이어받는다
    // 등급: 조합은 대부분 레어지만 **받은 장비의 등급과 옵션은 이어받는다**(올려 놓은 등급이 사다리를
    // 오를 때마다 날아가면 승급할 맛이 없다). 더 높게 뜨면 그 등급으로 옵션을 새로.
    const roll = W.rollRarity(W.CRAFT_RAR_W, this.rng);
    const keep = src?.rar != null && src.rar >= roll;
    const it = this.makeCrafted(slot, step, src ? Math.floor(Math.min(src.plus || 0, W.ENHANCE_NORMAL) / 2) : 0, keep ? src.rar : roll);
    if (keep && src.opts) it.opts = src.opts.map((o) => ({ ...o }));
    const wore = src && this.s.equip[slot] === src;
    if (src) {
      if (wore) this.s.equip[slot] = null;
      else this.s.bag = this.s.bag.filter((x) => x !== src);
    }
    this.emit('craft', { item: it });
    if (wore) { this.s.equip[slot] = it; this._stats = null; this.emit('equip', { item: it }); } else this.gainItem(it);
    return it;
  }
  // 대장장이 목록에 올릴 칸들 — 들어갈 수 있는 지역 + 다음 지역 하나 (그 안에서 하급·상급 모두)
  craftSteps() {
    let top = 1;
    for (let z = 1; z <= W.ZONE_COUNT; z++) if (this.canEnter(W.mapId(z, 1))) top = z;
    // 재료를 가진 지역은 (문파 창고에서 받았어도) 보인다
    for (const k of Object.keys(this.s.mats)) { const z = parseInt(k.replace('b', ''), 10); if (z > top && this.s.mats[k] > 0) top = z; }
    top = Math.min(W.ZONE_COUNT, top + 1);
    const out = [];
    for (let st = 0; st < top * 2; st++) out.push(st);
    return out;
  }
  // 다음에 만들 수 있는 것: 가진 가장 높은 칸에서 한 걸음(상급) · 두 걸음(다음 사냥터 하급)
  nextSteps(slot) {
    if (W.isDropOnly(slot)) return [];
    let top = -1;
    for (const it of [this.s.equip[slot], ...this.s.bag]) if (it && it.slot === slot && it.step != null) top = Math.max(top, it.step);
    const out = top < 0 ? [0] : top % 2 === 0 ? [top + 1, top + 2] : [top + 1];
    return out.filter((x) => x < W.TIER_COUNT * 2);
  }
  // 새 장비: 끼고 있는 것보다 좋으면 끼고, 아니면 가방에.
  gainItem(it) {
    const cur = this.s.equip[it.slot];
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
      let worst = 0;
      for (let i = 1; i < this.s.bag.length; i++) if (this.itemScore(this.s.bag[i]) < this.itemScore(this.s.bag[worst])) worst = i;
      this.sell(this.s.bag.splice(worst, 1)[0], true);
    }
    return 'bag';
  }
  sell(it, auto = false) {
    const p = W.sellPrice(it);
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
    if (it.step == null) return null;
    return { key: W.stepMap(it.step), n: W.enhanceMatsN(it.plus || 0) };
  }
  // 조합 장비는 +10 위로 돌파(+15까지) — 두목 증표가 더 든다. 옛 장비는 +10까지.
  enhanceMax(it) { return it?.step != null && !W.isDropOnly(it.slot) ? W.ENHANCE_MAX : W.ENHANCE_NORMAL; }
  breakMarksOf(it) { return it?.step != null && !W.isDropOnly(it.slot) ? W.breakMarks(it.plus || 0) : 0; }
  enhanceRateOf(it) { return W.enhanceRate(it.plus || 0) * (W.isDropOnly(it.slot) ? W.ACC2_RATE : 1); }
  canEnhance(it) {
    if (!it || (it.plus || 0) >= this.enhanceMax(it) || this.s.gold < this.enhanceCost(it)) return false;
    const m = this.enhanceMats(it);
    if (m && (this.s.mats[m.key] || 0) < m.n) return false;
    const bm = this.breakMarksOf(it);
    return !bm || (this.s.mats[W.bossKey(m.key)] || 0) >= bm;
  }
  enhance(uid) {
    const it = this.findItem(uid);
    if (!this.canEnhance(it)) return null;
    const cost = this.enhanceCost(it);
    const mats = this.enhanceMats(it);
    this.s.gold -= cost;
    if (mats) this.s.mats[mats.key] -= mats.n;
    const bm = this.breakMarksOf(it);
    if (bm) this.s.mats[W.bossKey(mats.key)] -= bm;
    const ok = this.rng() < this.enhanceRateOf(it);
    if (ok) it.plus = (it.plus || 0) + 1;
    this._stats = null;
    this.emit('enhance', { item: it, ok });
    return ok;
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
    if (!it || it.step == null || (it.rar || 0) >= W.RARITY.length - 1) return false;
    const c = W.promoteCost(it);
    return (this.s.mats[c.key] || 0) >= c.mats && (this.s.mats[W.bossKey(c.key)] || 0) >= c.marks && this.s.gold >= c.gold;
  }
  promote(uid) {
    const it = this.findItem(uid);
    if (!this.canPromote(it)) return null;
    const c = W.promoteCost(it);
    this.s.mats[c.key] -= c.mats;
    this.s.mats[W.bossKey(c.key)] -= c.marks;
    this.s.gold -= c.gold;
    it.rar = (it.rar || 0) + 1;
    it.grade = W.RARITY_GRADE[it.rar];
    it.opts = this.rollOpts(it.slot, it.step, it.rar);
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
    const key = `${this.s.job}|${JSON.stringify(this.s.passLv || {})}`;
    if (this._pm?.key === key) return this._pm.v;
    const v = {};
    for (const p of this.passiveList()) {
      const lv = this.passLevel(p.id);
      if (!lv) continue;
      for (const [k, x] of Object.entries(p.eff)) v[k] = (v[k] || 0) + x * lv;
      if (p.id === 'p_own' && lv >= 5) v.own5 = true;
    }
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
        else m[o.k] = (m[o.k] || 0) + o.v;
      }
    }
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
    const mats = W.MATS[m.zone] ? Math.floor(kills * W.MAT_RATE) : 0;
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
    const z = W.mapOf(rw.map).zone;
    if (rw.mats) this.addMats(z, rw.mats + (rw.marks || 0) * W.BOSS_MATS);
    if (rw.marks) this.addMats(W.bossKey(z), rw.marks);
  }
}
