// 게임 규칙과 상태. DOM을 모르는 순수 로직이라 Node에서도 돌아간다.
import {
  SAVE_VERSION, OFFLINE_CAP_SEC, KILLS_PER_STAGE, BOSS_TIME, SPAWN_DELAY, RAID_TIME, RAID_TICKETS,
  MERGE_COUNT, GACHA_COST, GACHA10_COST, DAILY_GEMS, START_GEMS,
  UPGRADES, GRADES, GACHA_RATES, EQUIP_TYPES, SKILLS, skillCost,
  zoneOf, monsterHp, monsterAtk, monsterGold, BOSS_HP_MULT, BOSS_ATK_MULT, BOSS_GOLD_MULT, BOSS_MOBS, bossGems,
  guildAtkBonus,
} from './data.js';

export const dayKey = (t = Date.now()) => {
  const d = new Date(t + 9 * 3600 * 1000); // 한국 시간 기준 하루
  return d.toISOString().slice(0, 10);
};

export function newSave(now = Date.now()) {
  const zero = () => GRADES.map(() => 0);
  return {
    v: SAVE_VERSION,
    nickname: '',
    gold: 0,
    gems: START_GEMS,
    stage: 1,
    maxStage: 1,
    kills: 0,
    farming: false,
    upgrades: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
    equips: Object.fromEntries(Object.keys(EQUIP_TYPES).map((k) => [k, zero()])),
    skills: Object.fromEntries(SKILLS.map((s) => [s.id, 1])),
    autoSkill: true,
    daily: { date: '', raidTickets: RAID_TICKETS, checkin: false },
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
  s.upgrades = { ...base.upgrades, ...raw.upgrades };
  s.skills = { ...base.skills, ...raw.skills };
  s.daily = { ...base.daily, ...raw.daily };
  s.stats = { ...base.stats, ...raw.stats };
  s.equips = { ...base.equips };
  for (const k of Object.keys(EQUIP_TYPES)) {
    const src = raw.equips?.[k];
    if (Array.isArray(src)) s.equips[k] = GRADES.map((_, i) => Math.max(0, src[i] | 0));
  }
  s.v = SAVE_VERSION;
  return s;
}

export class Game {
  constructor(save, now = Date.now()) {
    this.s = migrate(save, now);
    this.guildExp = 0;
    this.events = [];
    this.mode = 'stage';
    this.raid = null;
    this.buffs = { rage: 0 };
    this.cd = Object.fromEntries(SKILLS.map((s) => [s.id, 1.5]));
    this.rng = Math.random;
    this.heroHp = this.stats().hp;
    this.spawn();
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
  }

  // ---------- 능력치 ----------
  bestGrade(type) {
    const arr = this.s.equips[type];
    for (let g = arr.length - 1; g >= 0; g--) if (arr[g] > 0) return g;
    return -1;
  }

  equipMult(type) {
    const def = EQUIP_TYPES[type];
    const arr = this.s.equips[type];
    let m = 1;
    const best = this.bestGrade(type);
    if (best >= 0) m += def.equip[best];
    arr.forEach((c, g) => { if (c > 0) m += def.own[g]; });
    return m;
  }

  stats() {
    const u = this.s.upgrades;
    const rage = this.buffs.rage > 0 ? SKILLS[1].mult(this.s.skills.rage) : 1;
    const guild = 1 + guildAtkBonus(this.guildExp);
    const atk = UPGRADES.atk.value(u.atk) * this.equipMult('weapon') * guild * rage;
    const hp = UPGRADES.hp.value(u.hp) * this.equipMult('armor');
    const crit = Math.min(0.5, UPGRADES.crit.value(u.crit));
    const critDmg = UPGRADES.critDmg.value(u.critDmg);
    const speed = Math.min(3, UPGRADES.speed.value(u.speed)) * (this.buffs.rage > 0 ? 1.5 : 1);
    const goldMul = UPGRADES.gold.value(u.gold) * this.equipMult('ring');
    const dps = atk * speed * (1 + crit * (critDmg - 1));
    return { atk, hp, crit, critDmg, speed, goldMul, dps };
  }

  // 버프를 뺀 기본 능력치로 계산한 전투력 (랭킹용)
  power() {
    const saved = this.buffs.rage;
    this.buffs.rage = 0;
    const st = this.stats();
    this.buffs.rage = saved;
    return { power: Math.round(st.dps * 10 + st.hp), dps: st.dps, atk: st.atk, hp: st.hp };
  }

  // ---------- 전투 ----------
  spawn() {
    const s = this.s.stage;
    if (this.mode === 'raid') return;
    const isBoss = !this.s.farming && this.s.kills >= KILLS_PER_STAGE;
    const zone = zoneOf(s);
    const emoji = isBoss
      ? BOSS_MOBS[Math.floor((s - 1) / 10) % BOSS_MOBS.length]
      : zone.mobs[Math.floor(this.rng() * zone.mobs.length)];
    const hp = monsterHp(s) * (isBoss ? BOSS_HP_MULT : 1);
    this.mon = {
      hp, maxHp: hp, isBoss, emoji,
      atk: monsterAtk(s) * (isBoss ? BOSS_ATK_MULT : 1),
      atkTimer: 1.2, alive: true,
    };
    this.bossTimer = isBoss ? BOSS_TIME : 0;
    this.spawnTimer = 0;
    this.atkTimer = Math.min(this.atkTimer ?? 0.3, 0.3);
    this.emit('spawn', { isBoss });
  }

  dealDamage(amount, kind = 'hit', crit = false) {
    if (!this.mon?.alive) return;
    if (this.mode === 'raid') {
      this.raid.damage += amount;
      this.mon.hp = Math.max(0, this.mon.hp - amount);
      this.emit('dmg', { amount, kind, crit });
      return;
    }
    this.mon.hp -= amount;
    this.emit('dmg', { amount, kind, crit });
    if (this.mon.hp <= 0) this.killMonster();
  }

  killMonster() {
    const m = this.mon;
    m.alive = false;
    m.hp = 0;
    const s = this.s.stage;
    const st = this.stats();
    const gold = monsterGold(s) * (m.isBoss ? BOSS_GOLD_MULT : 1) * st.goldMul;
    this.addGold(gold);
    this.s.stats.kills++;
    this.emit('kill', { gold, isBoss: m.isBoss });
    if (m.isBoss) {
      this.s.stats.bossKills++;
      if (s >= this.s.maxStage) {
        const gems = bossGems(s);
        this.s.gems += gems;
        this.emit('gems', { amount: gems });
      }
      this.s.stage = s + 1;
      this.s.maxStage = Math.max(this.s.maxStage, this.s.stage);
      this.s.kills = 0;
      this.emit('stageClear', { stage: s });
    } else if (!this.s.farming) {
      this.s.kills++;
    }
    this.spawnTimer = SPAWN_DELAY;
  }

  heroDied() {
    const wasBoss = this.mon?.isBoss;
    this.emit('heroDied', { boss: wasBoss });
    if (wasBoss) {
      this.s.farming = true;
      this.s.kills = 0;
    }
    this.heroHp = this.stats().hp;
    this.mon.alive = false;
    this.spawnTimer = 1.2;
  }

  challengeBoss() {
    if (this.mode !== 'stage') return;
    this.s.farming = false;
    this.s.kills = KILLS_PER_STAGE;
    this.heroHp = this.stats().hp;
    this.spawn();
  }

  tick(dt) {
    const st = this.stats();
    if (this.buffs.rage > 0) this.buffs.rage = Math.max(0, this.buffs.rage - dt);
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);

    if (this.mode === 'raid') {
      this.raid.time -= dt;
      if (this.raid.time <= 0 || this.mon.hp <= 0) return this.endRaid();
    }

    if (!this.mon?.alive) {
      this.spawnTimer -= dt;
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.25 * dt);
      if (this.spawnTimer <= 0) this.spawn();
      return;
    }

    if (this.mon.isBoss && this.mode === 'stage') {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) {
        this.emit('bossTimeout');
        return this.heroDied();
      }
    }

    // 자동 스킬
    if (this.s.autoSkill) {
      for (const sk of SKILLS) {
        if (sk.id === 'heal' && this.heroHp > st.hp * 0.6) continue;
        if (sk.id === 'rage' && this.buffs.rage > 0) continue;
        this.useSkill(sk.id);
      }
    }

    // 영웅 공격
    this.atkTimer -= dt;
    while (this.atkTimer <= 0 && this.mon.alive) {
      this.atkTimer += 1 / st.speed;
      const crit = this.rng() < st.crit;
      this.dealDamage(st.atk * (crit ? st.critDmg : 1), 'hit', crit);
      this.emit('attack');
    }

    // 몬스터 공격 (레이드 보스는 공격하지 않는다)
    if (this.mode === 'stage' && this.mon.alive) {
      this.mon.atkTimer -= dt;
      if (this.mon.atkTimer <= 0) {
        this.mon.atkTimer += 1.5;
        this.heroHp -= this.mon.atk;
        this.emit('heroHit', { amount: this.mon.atk });
        if (this.heroHp <= 0) return this.heroDied();
      }
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * 0.02 * dt);
    }
  }

  // ---------- 스킬 ----------
  skillUnlocked(sk) { return this.s.maxStage >= sk.unlock; }

  useSkill(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk) || this.cd[id] > 0 || !this.mon?.alive) return false;
    const lv = this.s.skills[id];
    const st = this.stats();
    if (id === 'slash' || id === 'thunder') {
      this.dealDamage(st.atk * sk.mult(lv), id);
    } else if (id === 'rage') {
      this.buffs.rage = sk.dur;
    } else if (id === 'heal') {
      this.heroHp = Math.min(st.hp, this.heroHp + st.hp * sk.mult(lv));
    }
    this.cd[id] = sk.cd;
    this.emit('skill', { id });
    return true;
  }

  skillUpgradeCost(id) {
    const idx = SKILLS.findIndex((x) => x.id === id);
    return skillCost(idx, this.s.skills[id]);
  }

  upgradeSkill(id) {
    const sk = SKILLS.find((x) => x.id === id);
    if (!sk || !this.skillUnlocked(sk)) return false;
    const cost = this.skillUpgradeCost(id);
    if (this.s.gold < cost) return false;
    this.s.gold -= cost;
    this.s.skills[id]++;
    return true;
  }

  // ---------- 강화 ----------
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
    if (bought && key === 'hp') this.heroHp = Math.min(this.stats().hp, this.heroHp + 1);
    return bought;
  }

  addGold(g) {
    this.s.gold += g;
    this.s.stats.gold += g;
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
      out.push({ type, grade });
    }
    this.s.stats.gachas += count;
    return out;
  }

  merge(type, grade) {
    const arr = this.s.equips[type];
    if (grade >= GRADES.length - 1 || arr[grade] < MERGE_COUNT) return 0;
    const n = Math.floor(arr[grade] / MERGE_COUNT);
    arr[grade] -= n * MERGE_COUNT;
    arr[grade + 1] += n;
    return n;
  }

  mergeAll() {
    let total = 0;
    for (const type of Object.keys(EQUIP_TYPES)) {
      for (let g = 0; g < GRADES.length - 1; g++) total += this.merge(type, g);
    }
    return total;
  }

  // ---------- 방치 / 일일 ----------
  idleGoldRate() {
    const s = this.s.farming ? this.s.stage : Math.max(1, this.s.stage);
    const st = this.power();
    const full = this.stats();
    const hits = Math.max(1, Math.ceil(monsterHp(s) / (st.atk * (1 + full.crit * (full.critDmg - 1)))));
    const killTime = hits / full.speed + SPAWN_DELAY;
    return (monsterGold(s) * full.goldMul) / killTime;
  }

  offlineReward(now = Date.now()) {
    const sec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (now - (this.s.lastSeen || now)) / 1000));
    if (sec < 60) return null;
    return { sec, gold: this.idleGoldRate() * sec };
  }

  claimOffline(reward) {
    if (reward) this.addGold(reward.gold);
  }

  checkDaily(now = Date.now()) {
    const today = dayKey(now);
    if (this.s.daily.date === today) return null;
    this.s.daily = { date: today, raidTickets: RAID_TICKETS, checkin: false };
    this.s.gems += DAILY_GEMS;
    return { gems: DAILY_GEMS };
  }

  // ---------- 레이드 ----------
  startRaid(remainingHp, maxHp) {
    if (this.mode === 'raid' || this.s.daily.raidTickets <= 0 || remainingHp <= 0) return false;
    this.s.daily.raidTickets--;
    this.mode = 'raid';
    this.raid = { time: RAID_TIME, damage: 0 };
    this.mon = { hp: remainingHp, maxHp, isBoss: true, isRaid: true, emoji: '🐲', alive: true, atk: 0, atkTimer: 99 };
    this.heroHp = this.stats().hp;
    this.atkTimer = 0.3;
    this.emit('raidStart');
    return true;
  }

  endRaid() {
    const damage = this.raid?.damage || 0;
    this.mode = 'stage';
    this.raid = null;
    this.emit('raidEnd', { damage });
    this.heroHp = this.stats().hp;
    this.spawn();
    return damage;
  }

  toJSON(now = Date.now()) {
    this.s.lastSeen = now;
    return this.s;
  }
}
