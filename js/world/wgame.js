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
    statV: 2,
    gold: 0,
    potions: 5,
    autoPotion: true,
    equip: { weapon: null, armor: null, hat: null, acc: null },
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
  for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, Math.floor(Number(s.stats[k]) || 0));
  s.equip = { ...base.equip, ...(raw.equip || {}) };
  s.mats = {};
  for (const [k, v] of Object.entries(raw.mats || {})) if ((W.MATS[k] || (k[0] === 'b' && W.MATS[k.slice(1)])) && v > 0) s.mats[k] = Math.floor(Number(v) || 0);
  delete s.autoSell;
  // v105: 레벨업 점수를 직접 찍게 바꿨다 — 옛 세이브의 '자동 분배 켬'은 한 번 끈다
  if ((raw.statV || 0) < 2) { s.autoStat = false; s.statV = 2; }
  s.bag = Array.isArray(raw.bag) ? raw.bag.filter((i) => i && W.SLOTS.some((x) => x.id === i.slot)) : [];
  s.level = clamp(Math.floor(Number(s.level) || 1), 1, W.LEVEL_MAX);
  for (const k of ['exp', 'gold', 'potions', 'statPts', 'jobTier', 'kills', 'deaths', 'books']) s[k] = Math.max(0, Number(s[k]) || 0);
  s.jobTier = Math.min(3, Math.floor(s.jobTier));
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
  for (const it of [...s.bag, ...Object.values(s.equip)]) if (it && it.uid >= uidSeq) uidSeq = it.uid + 1;
  return s;
}

export class WorldGame {
  constructor(save, now = Date.now()) {
    this.s = migrateWorld(save, now);
    this.events = [];
    this.clock = 0;
    this.mode = 'stage';           // 그리는 쪽은 'stage'일 때 들판을 그린다
    this.buffs = {};
    this.adds = [];
    this.queue = [];
    this.fields = [];
    this.contest = null;
    this.mons = [];
    this.mon = null;
    this.cd = { s0: 0, s1: 0, s2: 0 };
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
  petTeam() { return []; }
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
    const q = it.step != null ? W.stepMult(it.step) : W.GRADES[it.grade].mult;
    const m = q * (1 + (it.plus || 0) * W.ENHANCE_STEP);
    const out = {};
    for (const [k, v] of Object.entries(b)) out[k] = v * m;
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
    const str = this.totalStat('str');
    const dex = this.totalStat('dex');
    const vit = this.totalStat('vit');
    const int = this.totalStat('int');
    // 문파 버프 — 문파 레벨마다 공격력 +2% (서버가 guildExp를 넣어 준다)
    // 레벨·스탯 몫은 작게, 장비 몫은 크게 (v108) — 강해지는 건 대부분 장비 덕
    const atk = (5 + L * 0.5 + str * 0.8 + gear.atk) * (1 + gear.atkPct + (s.guildId ? W.guildAtk(this.guildExp) : 0));
    const hp = (60 + L * 5 + vit * 5 + gear.hp) * (1 + gear.hpPct);
    const st = {
      atk, hp,
      def: vit * 0.2 + gear.def,
      crit: Math.min(0.75, 0.05 + dex * 0.004 + gear.crit + (cls.crit || 0)),
      critDmg: W.CRIT_DMG + gear.critDmg,
      atkSec: W.BASE_ATK_SEC / ((1 + dex * 0.01 + gear.speed) * (cls.speed || 1)),
      speed: (1 + dex * 0.01 + gear.speed) * (cls.speed || 1),
      skillMult: 1 + int * 0.02 + gear.skill,
      // 자연 회복: 최대 체력의 0.6%/초 + 내공·레벨 몫 (물약만 바라보지 않게)
      regen: 1 + int * 0.12 + L * 0.08 + hp * (0.006 + gear.regenPct),
      expMult: 1 + gear.exp,
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
    const g = (it) => (it ? `${it.uid}.${it.plus || 0}` : '-');
    return `${s.level}|${s.guildId ? W.guildLevel(this.guildExp) : 0}|${s.job}|${s.stats.str},${s.stats.dex},${s.stats.vit},${s.stats.int}|${g(e.weapon)},${g(e.armor)},${g(e.hat)},${g(e.acc)}`;
  }
  power() { return this.stats().power; }

  // ---------- 지도 ----------
  canEnter(id) {
    if (!W.hasMap(id)) return false;
    const m = W.mapOf(id);
    return m.town || this.s.level >= m.lv[0];
  }
  enterMap(id, quiet = false) {
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
    const hp = W.mobHp(lv) * (boss ? W.BOSS.hp : 1);
    const mob = {
      id: uidSeq++, lv, c, r, hc: c, hr: r, move: null, x, y, hp, maxHp: hp, alive: true, isBoss: !!boss, born: this.clock,
      atk: W.mobAtk(lv) * (boss ? W.BOSS.atk : 1), armor: W.mobDef(lv),
      atkTimer: 1 + this.rng(), stun: 0, slow: 0, poison: 0, poisonPer: 0,
      aggro: false, wanderT: this.rng() * 3,
      def: { name: kind.name, look: kind.look },
    };
    mob.name = kind.name;
    // 십이지왕: 등장 연출 동안은 움직이지도, 맞지도 않는다
    const king = boss ? m.king : null;
    if (king) { mob.introT = W.KING_INTRO_SEC; this.freezeT = W.KING_INTRO_SEC; }
    this.mons.push(mob);
    if (boss) this.emit('bossAppear', { name: kind.name, lv, king: king ? { no: king.no, title: king.title, real: king.real, hanja: king.hanja, skill: king.skill } : null, at: mob });
    return mob;
  }

  // ---------- 한 틱 ----------
  tick(dt) {
    this.clock += dt;
    const st = this.stats();
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.potionT = Math.max(0, this.potionT - dt);
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
    // 십이지왕 등장 연출 동안은 들판 전체가 멈춘다(무인도 몹도)
    if (this.freezeT > 0) { this.freezeT -= dt; this.walking = false; for (const m of this.mons) if (m.introT > 0) m.introT -= dt; return; }
    this.tickMobs(dt, st);
    if (this.heroHp <= 0) return;
    this.tickPotion(st);
    this.tickHero(dt, st);
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
      if (m.poison > 0) {
        const d = Math.min(m.poison, dt);
        m.poison -= d;
        this.hurt(m, m.poisonPer * d, 'poison', false, true);
        if (!m.alive) continue;
      }
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
          const st2 = this.nextStep(m.c, m.r, ht.c, ht.r, m);
          if (st2) m.move = st2;
        } else {
          m.atkTimer -= dt;
          if (m.atkTimer <= 0) {
            m.atkTimer = W.MOB_ATK_SEC * (m.slow > 0 ? 1.5 : 1);
            const dmg = Math.max(1, m.atk * (0.9 + this.rng() * 0.2) - st.def);
            this.heroHp -= dmg;
            this.emit('heroHit', { amount: dmg });
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
      if (this.slide(this, 'heroX', 'heroY', this.hmove, W.HERO_SPEED, dt)) { this.hc = this.hmove.c; this.hr = this.hmove.r; this.hmove = null; }
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
      // 길이 막혔으면(사방이 몹) 다른 과녁을 찾는다
      if (!this.stepHero(mt.c, mt.r)) { this.walking = false; this.mon = null; }
      return;
    }
    this.walking = false;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = st.atkSec;
      this.basicAttack(m, st, dist);
    }
  }

  // 목표 칸 쪽으로 한 칸 떠난다. 못 가면 false.
  stepHero(tc, tr) {
    const o = this.nextStep(this.hc, this.hr, tc, tr, 'hero');
    if (!o) return false;
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
      if (!m.alive || m.npc || m.introT > 0) continue;
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
    if (this.s.job === 'ring' && close) mult *= 1.25;
    this.strike(m, st, mult, 'hit');
  }

  strike(m, st, mult, kind) {
    const crit = this.rng() < st.crit;
    let dmg = st.atk * mult * (crit ? st.critDmg : 1) * (0.92 + this.rng() * 0.16);
    if (m.isBoss) dmg *= st.boss;
    dmg = Math.max(1, dmg - m.armor);
    this.hurt(m, dmg, kind, crit);
    const cls = W.CLASSES[this.s.job] || {};
    if (m.alive && cls.slow) m.slow = 2.5;
    if (m.alive && cls.poison) { m.poison = 3; m.poisonPer = Math.max(m.poisonPer || 0, (dmg * cls.poison) / 3); }
    return dmg;
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
    const exp = W.mobExp(m.lv) * (m.isBoss ? W.BOSS.exp : 1) * this.levelGapMult(m.lv) * (st.expMult || 1);
    const gold = Math.round(W.mobGold(m.lv) * (m.isBoss ? W.BOSS.gold : 1));
    this.s.gold += gold;
    this.s.kills++;
    const mat = this.dropMats(m);
    this.emit('kill', { gold, isBoss: m.isBoss, add: true, at: m, mat });
    this.addExp(exp);
    this.note(1, exp, gold, 0);
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
  skills() { return this.s.job ? W.skillsOf(this.s.job).filter((k) => k.tier <= this.s.jobTier) : []; }
  skillDef(id) { return this.s.job ? W.skillsOf(this.s.job).find((k) => k.id === id) : null; }
  hpCostOf(sk) { return Math.round(this.stats().hp * (sk.hpCost || 0)); }
  canUseSkill(id) {
    const sk = this.skillDef(id);
    if (!sk || sk.tier > this.s.jobTier || this.cd[id] > 0 || this.map.town) return false;
    if (this.heroHp <= this.hpCostOf(sk) + 1) return false;      // 대가로 죽지는 않는다
    return true;
  }
  useSkill(id) {
    if (!this.canUseSkill(id)) return false;
    const sk = this.skillDef(id);
    const st = this.stats();
    const tgt = this.mon?.alive ? this.mon : this.pickTarget({ ...st, range: 9999 });
    if (sk.kind === 'single' && !tgt) return false;
    if (sk.kind === 'single' && Math.hypot(tgt.x - this.heroX, tgt.y - this.heroY) > Math.max(st.range, 160) * 1.6) return false;
    const cost = this.hpCostOf(sk);
    this.heroHp -= cost;
    this.cd[id] = sk.cd;
    const center = sk.kind === 'aoe' && this.ranged() && tgt ? { x: tgt.x, y: tgt.y } : { x: this.heroX, y: this.heroY };
    this.emit('skill', { id, name: sk.name, fx: sk.fx, look: sk.role, job: this.s.job, cls: this.s.job, tier: sk.tier,
      at: center, radius: sk.radius || 0, motion: sk.kind, dur: 0 });
    if (cost) this.emit('hpCost', { amount: cost });
    const mult = sk.mult * st.skillMult;
    if (sk.kind === 'single') {
      this.mon = tgt;
      this.strike(tgt, st, mult, id);
    } else {
      const r = sk.radius;
      for (const m of this.mons.slice()) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - center.x, (m.y - center.y) * 0.75) <= r) this.strike(m, st, mult, id);
      }
    }
    return true;
  }
  autoSkills(st) {
    for (const sk of this.skills()) {
      if (this.cd[sk.id] > 0) continue;
      if (sk.autoAbove && this.heroHp < st.hp * sk.autoAbove) continue;
      if (sk.kind === 'single') {
        if (!this.mon?.alive) continue;
        // 한 대에 죽을 놈에게는 아끼고, 두목·센 놈에게 쓴다
        if (!this.mon.isBoss && this.mon.hp < st.atk * 1.5) continue;
        if (Math.hypot(this.mon.x - this.heroX, this.mon.y - this.heroY) > Math.max(st.range, 160)) continue;
      } else {
        const c = this.ranged() && this.mon?.alive ? this.mon : { x: this.heroX, y: this.heroY };
        const n = this.mons.filter((m) => m.alive && Math.hypot(m.x - c.x, (m.y - c.y) * 0.75) <= sk.radius).length;
        const boss = this.mons.some((m) => m.alive && m.isBoss && Math.hypot(m.x - c.x, m.y - c.y) <= sk.radius);
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
  nextTier() { return this.s.jobTier < 3 ? W.TIERS[this.s.jobTier + 1] : null; }
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
        const it = this.makeCrafted(W.SLOTS[Math.floor(this.rng() * W.SLOTS.length)].id, (id - 1) * 2);
        this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
        this.gainItem(it);
      }
      return { id, n: W.BOSS_MATS, name: W.MATS[id], color: W.MAT_COLORS[id], boss: W.matName(W.bossKey(id)) };
    }
    if (this.rng() >= W.MAT_RATE) return null;
    this.addMats(id, 1);
    return { id, n: 1, name: W.MATS[id], color: W.MAT_COLORS[id] };
  }
  addMats(key, n) { this.s.mats[key] = (this.s.mats[key] || 0) + n; }
  makeCrafted(slot, step, plus = 0) {
    return { uid: uidSeq++, slot, step, ilv: W.craftIlv(step), grade: W.stepGrade(step), plus };
  }
  // 그 칸에서 가진 것(낀 것 + 가방) 가운데 조합에 넣을 것 — 높은 칸, 같으면 낀 것
  recipeSource(r) {
    if (!r.from.length) return null;
    const worn = this.s.equip[r.slot];
    let best = null;
    for (const it of [worn, ...this.s.bag]) {
      if (!it || it.slot !== r.slot || it.step == null || !r.from.includes(it.step)) continue;
      if (!best || it.step > best.step) best = it;
    }
    return best;
  }
  // 조합할 수 있나 — 모자란 것을 함께 돌려준다(화면에 '청죽 마디 12/40'처럼)
  craftCheck(slot, step) {
    const r = W.recipeOf(slot, step);
    const src = this.recipeSource(r);
    const lack = [];
    if (r.from.length && !src) lack.push('item');
    for (const [k, n] of Object.entries(r.mats)) if ((this.s.mats[k] || 0) < n) lack.push(k);
    if (this.s.gold < r.gold) lack.push('gold');
    return { r, src, ok: !lack.length, lack };
  }
  craft(slot, step) {
    if (step < 0 || step >= W.TIER_COUNT * 2) return null;
    const { r, src, ok } = this.craftCheck(slot, step);
    if (!ok) return null;
    for (const [k, n] of Object.entries(r.mats)) this.s.mats[k] -= n;
    this.s.gold -= r.gold;
    // 받은 장비는 사라지고, 강화는 절반을 이어받는다
    const it = this.makeCrafted(slot, step, src ? Math.floor((src.plus || 0) / 2) : 0);
    const wore = src && this.s.equip[slot] === src;
    if (src) {
      if (wore) this.s.equip[slot] = null;
      else this.s.bag = this.s.bag.filter((x) => x !== src);
    }
    this.emit('craft', { item: it });
    if (wore) { this.s.equip[slot] = it; this._stats = null; this.emit('equip', { item: it }); } else this.gainItem(it);
    return it;
  }
  // 다음에 만들 수 있는 것: 가진 가장 높은 칸에서 한 걸음(상급) · 두 걸음(다음 사냥터 하급)
  nextSteps(slot) {
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
  enhanceCost(it) { return W.enhanceCost(it.ilv, it.plus || 0); }
  // 강화 재료: 조합 장비는 그 지역 재료 (옛 장비·수련용은 은자만)
  enhanceMats(it) {
    if (it.step == null) return null;
    return { key: W.stepMap(it.step), n: W.enhanceMatsN(it.plus || 0) };
  }
  canEnhance(it) {
    if (!it || (it.plus || 0) >= W.ENHANCE_MAX || this.s.gold < this.enhanceCost(it)) return false;
    const m = this.enhanceMats(it);
    return !m || (this.s.mats[m.key] || 0) >= m.n;
  }
  enhance(uid) {
    const it = this.findItem(uid);
    if (!this.canEnhance(it)) return null;
    const cost = this.enhanceCost(it);
    const mats = this.enhanceMats(it);
    this.s.gold -= cost;
    if (mats) this.s.mats[mats.key] -= mats.n;
    const ok = this.rng() < W.enhanceRate(it.plus || 0);
    if (ok) it.plus = (it.plus || 0) + 1;
    this._stats = null;
    this.emit('enhance', { item: it, ok });
    return ok;
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
    this.s.kills += rw.kills;
    const z = W.mapOf(rw.map).zone;
    if (rw.mats) this.addMats(z, rw.mats + (rw.marks || 0) * W.BOSS_MATS);
    if (rw.marks) this.addMats(W.bossKey(z), rw.marks);
  }
}
