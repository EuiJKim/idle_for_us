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
    autoStat: true,
    gold: 0,
    potions: 5,
    autoPotion: true,
    equip: { weapon: null, armor: null, hat: null, acc: null },
    bag: [],
    bagSize: W.BAG_SIZE,
    autoSell: 1,             // 이 등급 이하는 주우면 바로 판다 (-1 끔, 0 일반, 1 고급까지)
    map: 0,                  // 지금 있는 곳 (0 마을)
    huntMap: 1,              // 돌아갈 사냥터
    autoHunt: true,
    autoSkill: true,
    lastSeen: now,
    titles: [],
    kills: 0,
    deaths: 0,
    bestMap: 1,
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
  s.bag = Array.isArray(raw.bag) ? raw.bag.filter((i) => i && W.SLOTS.some((x) => x.id === i.slot)) : [];
  s.level = clamp(Math.floor(Number(s.level) || 1), 1, W.LEVEL_MAX);
  for (const k of ['exp', 'gold', 'potions', 'statPts', 'jobTier', 'kills', 'deaths']) s[k] = Math.max(0, Number(s[k]) || 0);
  s.jobTier = Math.min(3, Math.floor(s.jobTier));
  if (!W.MAPS[s.map]) s.map = 0;
  if (!W.MAPS[s.huntMap] || W.MAPS[s.huntMap].town) s.huntMap = 1;
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
    this.bossT = W.BOSS_EVERY * 0.5;
    this.respawns = [];
    this.manual = null;            // 손으로 찍은 갈 곳
    this.manualHold = 0;
    this.walking = false;
    this.heroFacing = 1;
    this.heroAngle = 0;
    this.rng = rand;
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

  // ---------- 수치 ----------
  totalStat(k) { return (W.CLASSES[this.s.job]?.base[k] || 0) + (this.s.stats[k] || 0); }
  itemStats(it) {
    if (!it) return {};
    const b = W.itemBase(it.slot, it.ilv);
    const m = W.GRADES[it.grade].mult * (1 + (it.plus || 0) * W.ENHANCE_STEP);
    const out = {};
    for (const [k, v] of Object.entries(b)) out[k] = v * m;
    return out;
  }
  stats() {
    if (this._stats && this._stats.sig === this.statSig()) return this._stats;
    const s = this.s;
    const L = s.level;
    const cls = W.CLASSES[s.job] || {};
    const gear = { atk: 0, hp: 0, def: 0, crit: 0, atkPct: 0 };
    for (const it of Object.values(s.equip)) {
      const st = this.itemStats(it);
      for (const k of Object.keys(st)) gear[k] = (gear[k] || 0) + st[k];
    }
    const str = this.totalStat('str');
    const dex = this.totalStat('dex');
    const vit = this.totalStat('vit');
    const int = this.totalStat('int');
    const atk = (8 + L * 2 + str * 2 + gear.atk) * (1 + gear.atkPct);
    const hp = 80 + L * 14 + vit * 12 + gear.hp;
    const st = {
      atk, hp,
      def: vit * 0.2 + gear.def,
      crit: Math.min(0.75, 0.05 + dex * 0.004 + gear.crit + (cls.crit || 0)),
      critDmg: W.CRIT_DMG,
      atkSec: W.BASE_ATK_SEC / ((1 + dex * 0.01) * (cls.speed || 1)),
      speed: (1 + dex * 0.01) * (cls.speed || 1),
      skillMult: 1 + int * 0.02,
      // 자연 회복: 최대 체력의 0.6%/초 + 내공·레벨 몫 (물약만 바라보지 않게)
      regen: 1 + int * 0.12 + L * 0.08 + hp * 0.006,
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
    return `${s.level}|${s.job}|${s.stats.str},${s.stats.dex},${s.stats.vit},${s.stats.int}|${g(e.weapon)},${g(e.armor)},${g(e.hat)},${g(e.acc)}`;
  }
  power() { return this.stats().power; }

  // ---------- 지도 ----------
  canEnter(id) {
    const m = W.MAPS[id];
    if (!m) return false;
    return m.town || this.s.level >= m.lv[0];
  }
  enterMap(id, quiet = false) {
    if (!this.canEnter(id)) return false;
    const m = W.mapOf(id);
    this.s.map = id;
    if (!m.town) { this.s.huntMap = id; this.s.bestMap = Math.max(this.s.bestMap || 1, id); }
    // 그리는 쪽이 지역 그림을 고르는 값
    this.s.stage = m.zone * 10 + 1;
    this.s.rank = W.lookTierOf(this.s.level);
    this.heroX = W.MAP_W / 2;
    this.heroY = W.MAP_H - 260;
    this.mons = [];
    this.mon = null;
    this.respawns = [];
    this.manual = null;
    this.returnT = 0;
    this.bossT = W.BOSS_EVERY * 0.5;
    if (!m.town) for (let i = 0; i < W.MOBS_ALIVE; i++) this.spawnMob(false);
    else this.placeNpcs();
    if (!quiet) this.emit('mapEnter', { id, name: m.name, town: m.town });
    return true;
  }
  goTown() { return this.enterMap(0); }
  // 마을 사람 — 싸우지 않는다. 그리기만 한다(누르면 마을 창).
  placeNpcs() {
    for (const n of W.NPCS) {
      this.mons.push({ id: uidSeq++, npc: true, x: this.heroX + n.dx, y: this.heroY + n.dy, hp: 1, maxHp: 1, alive: true,
        isBoss: false, stun: 0, def: { name: n.name, look: n.look } });
    }
  }

  // ---------- 몹 ----------
  spawnMob(boss) {
    const m = this.map;
    if (m.town) return null;
    const [lo, hi] = m.lv;
    const lv = boss ? hi + 2 : lo + Math.floor(this.rng() * (hi - lo + 1));
    const kind = boss ? m.boss : m.mobs[Math.floor(this.rng() * m.mobs.length)];
    // 무인 둘레(화면 안)에는 안 난다 — 눈앞에서 툭 생기면 어색하다
    let x, y;
    for (let t = 0; t < 12; t++) {
      x = 120 + this.rng() * (W.MAP_W - 240);
      y = 120 + this.rng() * (W.MAP_H - 240);
      if (Math.hypot(x - this.heroX, y - this.heroY) > 380) break;
    }
    if (boss) { x = W.MAP_W / 2 + (this.rng() - 0.5) * 300; y = W.MAP_H * 0.35; }
    const hp = W.mobHp(lv) * (boss ? W.BOSS.hp : 1);
    const mob = {
      id: uidSeq++, lv, x, y, hx: x, hy: y, hp, maxHp: hp, alive: true, isBoss: !!boss,
      atk: W.mobAtk(lv) * (boss ? W.BOSS.atk : 1), armor: W.mobDef(lv),
      atkTimer: 1 + this.rng(), stun: 0, slow: 0, poison: 0, poisonPer: 0,
      aggro: false, wanderT: this.rng() * 3,
      def: { name: kind.name, look: kind.look },
    };
    mob.name = kind.name;
    this.mons.push(mob);
    if (boss) this.emit('bossAppear', { name: kind.name, lv });
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
    this.bossT -= dt;
    if (this.bossT <= 0) {
      this.bossT = W.BOSS_EVERY;
      if (!this.mons.some((m) => m.isBoss)) this.spawnMob(true);
    }
    this.tickMobs(dt, st);
    if (this.heroHp <= 0) return;
    this.tickPotion(st);
    this.tickHero(dt, st);
  }

  tickTown(dt) {
    this.walking = false;
    this.mon = null;
    // 자동 사냥이면 잠깐 쉬었다가 돌아간다 (체력이 다 찰 때까지는 기다린다)
    if (this.s.autoHunt && this.s.huntMap && this.canEnter(this.s.huntMap)) {
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
      if (m.stun > 0) { m.stun -= dt; continue; }
      if (m.slow > 0) m.slow -= dt;
      const dist = Math.hypot(m.x - this.heroX, m.y - this.heroY);
      if (dist < W.MOB_AGGRO || m.aggro) m.aggro = dist < W.MOB_AGGRO * 2;
      const spd = W.MOB_SPEED * (m.slow > 0 ? 0.45 : 1) * (m.isBoss ? 0.8 : 1);
      if (m.aggro) {
        const reach = m.isBoss ? 90 : 56;
        if (dist > reach) {
          m.x += ((this.heroX - m.x) / dist) * spd * dt;
          m.y += ((this.heroY - m.y) / dist) * spd * dt;
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
        // 제자리 둘레를 어슬렁거린다
        m.wanderT -= dt;
        if (m.wanderT <= 0) { m.wanderT = 2 + this.rng() * 3; m.tx = m.hx + (this.rng() - 0.5) * 160; m.ty = m.hy + (this.rng() - 0.5) * 160; }
        if (m.tx != null) {
          const d2 = Math.hypot(m.tx - m.x, m.ty - m.y);
          if (d2 > 4) { m.x += ((m.tx - m.x) / d2) * spd * 0.35 * dt; m.y += ((m.ty - m.y) / d2) * spd * 0.35 * dt; }
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
    // 손으로 찍은 곳이 있으면 거기로 먼저 간다
    if (this.manual) {
      const d = Math.hypot(this.manual.x - this.heroX, this.manual.y - this.heroY);
      if (d < 8) { this.manual = null; this.manualHold = 1.2; } else { this.step(this.manual.x, this.manual.y, dt); return; }
    }
    if (this.manualHold > 0) { this.manualHold -= dt; this.walking = false; return; }
    // 과녁: 나를 치고 있는 몹 → 가장 가까운 몹. 자동 사냥이 꺼져 있으면 붙어 있는 것만 친다.
    if (!this.mon?.alive) this.mon = this.pickTarget(st);
    const m = this.mon;
    if (!m) { this.walking = false; return; }
    const dist = Math.hypot(m.x - this.heroX, m.y - this.heroY);
    this.heroAngle = Math.atan2((m.y - this.heroY) * 0.6, m.x - this.heroX);
    if (Math.abs(m.x - this.heroX) > 6) this.heroFacing = m.x >= this.heroX ? 1 : -1;
    if (this.s.autoSkill) this.autoSkills(st);
    if (!this.mon?.alive) return;
    if (dist > st.range) {
      if (!this.s.autoHunt && !m.aggro) { this.walking = false; return; }
      this.step(m.x, m.y, dt, st.range * 0.9);
      return;
    }
    this.walking = false;
    this.atkTimer -= dt;
    if (this.atkTimer <= 0) {
      this.atkTimer = st.atkSec;
      this.basicAttack(m, st, dist);
    }
  }

  step(tx, ty, dt, stopAt = 0) {
    const d = Math.hypot(tx - this.heroX, ty - this.heroY);
    if (d <= stopAt + 0.5) { this.walking = false; return; }
    const go = Math.min(d - stopAt, W.HERO_SPEED * dt);
    this.heroX = clamp(this.heroX + ((tx - this.heroX) / d) * go, 40, W.MAP_W - 40);
    this.heroY = clamp(this.heroY + ((ty - this.heroY) / d) * go, 40, W.MAP_H - 40);
    if (Math.abs(tx - this.heroX) > 4) this.heroFacing = tx >= this.heroX ? 1 : -1;
    this.heroAngle = Math.atan2((ty - this.heroY) * 0.6, tx - this.heroX);
    this.walking = true;
  }

  pickTarget(st) {
    let best = null;
    let bd = Infinity;
    for (const m of this.mons) {
      if (!m.alive || m.npc) continue;
      let d = Math.hypot(m.x - this.heroX, m.y - this.heroY);
      if (m.aggro) d *= 0.5;                          // 나를 치러 오는 놈 먼저
      if (!this.s.autoHunt && d > st.range * 1.2 && !m.aggro) continue;
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // 손으로 들판을 찍으면 그리로 간다 (들판 좌표)
  moveTo(x, y) {
    if (this.map.town) return;
    this.manual = { x: clamp(x, 40, W.MAP_W - 40), y: clamp(y, 40, W.MAP_H - 40) };
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
    if (!m.alive) return;
    m.hp -= dmg;
    m.aggro = true;
    if (!quiet) this.emit('dmg', { amount: dmg, kind, crit: crit ? 1 : 0, at: m, add: m !== this.mon });
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m) {
    m.alive = false;
    m.hp = 0;
    const st = this.stats();
    const exp = W.mobExp(m.lv) * (m.isBoss ? W.BOSS.exp : 1) * this.levelGapMult(m.lv);
    const gold = Math.round(W.mobGold(m.lv) * (m.isBoss ? W.BOSS.gold : 1));
    this.s.gold += gold;
    this.s.kills++;
    this.emit('kill', { gold, isBoss: m.isBoss, add: true, at: m });
    this.addExp(exp);
    this.note(1, exp, gold, 0);
    this.rollDrop(m);
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
    this.goTown();
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
    this._stats = null;
    this.heroHp = this.stats().hp;
    return true;
  }
  nextTier() { return this.s.jobTier < 3 ? W.TIERS[this.s.jobTier + 1] : null; }
  canAdvance() {
    const t = this.nextTier();
    return !!t && this.s.level >= t.level && this.s.gold >= t.cost && this.map.town;
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
  rollGrade(minGrade = 0) {
    const pool = W.GRADES.filter((g) => g.id >= minGrade);
    const sum = pool.reduce((a, g) => a + g.w, 0);
    let r = this.rng() * sum;
    for (const g of pool) { r -= g.w; if (r <= 0) return g.id; }
    return pool[pool.length - 1].id;
  }
  rollDrop(m) {
    if (!m.isBoss && this.rng() >= W.DROP_RATE) return null;
    const slot = W.SLOTS[Math.floor(this.rng() * W.SLOTS.length)].id;
    const it = this.makeItem(slot, m.lv, this.rollGrade(m.isBoss ? 2 : 0));
    this.emit('drop', { item: it, at: { x: m.x, y: m.y } });
    this.gainItem(it);
    return it;
  }
  // 주운 것: 끼고 있는 것보다 좋으면 끼고, 자동 판매 등급이면 팔고, 아니면 가방에.
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
    if (it.grade <= this.s.autoSell && !it.plus) { this.sell(it, true); return 'sold'; }
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
  enhance(uid) {
    const it = this.findItem(uid);
    if (!it || (it.plus || 0) >= W.ENHANCE_MAX) return null;
    const cost = this.enhanceCost(it);
    if (this.s.gold < cost) return null;
    this.s.gold -= cost;
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
    const m = W.mapOf(r.map);
    const lv = (m.lv[0] + m.lv[1]) / 2;
    // 장비: 처치 수만큼 굴리되 영웅 이상만 남기고 나머지는 판 값으로
    const drops = [0, 0, 0, 0, 0];
    const n = Math.round(kills * W.DROP_RATE);
    for (let i = 0; i < Math.min(n, 4000); i++) drops[this.rollGrade(0)]++;
    const keep = [];
    let soldGold = 0;
    for (let g = 0; g < 5; g++) {
      if (g >= 3) for (let i = 0; i < drops[g]; i++) keep.push(this.makeItem(W.SLOTS[Math.floor(this.rng() * 4)].id, Math.round(lv), g));
      else soldGold += drops[g] * W.sellPrice({ ilv: lv, grade: g, plus: 0 });
    }
    return { sec, t, kills, exp: Math.floor(r.exp * t), gold: Math.floor(r.gold * t) + soldGold, potions: Math.ceil(r.potions * t),
      drops, keep, stoppedByPotion: potionSec < sec, map: r.map };
  }
  claimOffline(rw) {
    if (!rw) return;
    this.s.gold += rw.gold;
    this.s.potions = Math.max(0, this.s.potions - rw.potions);
    this.addExp(rw.exp);
    this.s.kills += rw.kills;
    for (const it of rw.keep) this.gainItem(it);
  }
}
