// 새 시즌(S3) 무인 — 레벨 · 경험치 · 스탯 찍기 · 고유 스탯 · 전직 · 무공 · 마스터리 트리(대기 시간).
// 시간은 엔진 ms(정수)만 받는다. 상태(this.s)는 세이브에 그대로 들어간다.
import { cumExp, expToNext } from '../tables/exp.js';
import { LEVEL_MAX, JOB_LV } from '../tables/progress.js';
import { JOBS, baseAtk, baseHp, baseDef, MAIN_TO_ATK, MAIN_TO_HP, SUB_TO_HP } from '../tables/char.js';
import { SKILLS, skillCap, skillCost, MASTERY, masteryCost, JOB_ADV, UNIQUE_EVERY, UNIQUE_STATS } from '../tables/skills.js';
import { sumStats, finalize } from '../core/stats.js';
import { pay } from '../core/cost.js';
import { KIT, SLOT_N, kitCap, kitCost, skillById, battleKit } from '../tables/kit.js';

const MAINS = ['str', 'agi', 'ene', 'wis'];

export function newHero(job = 'sword') {
  return {
    job, lv: 1, exp: 0, adv: 0,
    pts: { str: 0, agi: 0, ene: 0, wis: 0 }, autoPts: true,
    uniq: { crit: 0, critDmg: 0, bossDmg: 0 }, autoUniq: true,
    skills: { base: 1, main: 0, inner: 0, guard: 0 },
    mastery: { done: [], learning: null },        // learning: { id, endMs }
    cleared: [],                                   // 깬 전직 던전
    kit: { lv: {}, slots: [], off: [] },            // v493 무공 세트: 배운 레벨 · 6칸(공격·버프) · 자동 끈 칸
  };
}

export class Hero {
  constructor(s = newHero()) { this.s = s; }
  get job() { return JOBS[this.s.job]; }
  // 스탯 점수: 쓴 것 / 받은 것
  ptsTotal() { return (this.s.lv - 1) * 5; }
  ptsUsed() { return MAINS.reduce((a, k) => a + this.s.pts[k], 0); }
  uniqTotal() { return Math.floor(this.ptsTotal() / UNIQUE_EVERY); }
  uniqUsed() { return Object.values(this.s.uniq).reduce((a, b) => a + b, 0); }

  // 경험치 — 레벨업한 수를 돌려준다
  addExp(n) {
    const s = this.s;
    let ups = 0;
    s.exp += Math.max(0, Math.floor(n));
    while (s.lv < LEVEL_MAX && s.exp >= expToNext(s.lv)) { s.exp -= expToNext(s.lv); s.lv++; ups++; }
    if (s.lv >= LEVEL_MAX) s.exp = 0;
    if (ups) this.autoSpend();
    return ups;
  }
  totalExp() { return cumExp(this.s.lv) + this.s.exp; }
  // 자동 찍기: 주 스탯에 몰아서 · 고유 스탯은 치명 → 치명 피해 → 보스 피해 순으로 고르게
  autoSpend() {
    const s = this.s;
    if (s.autoPts) s.pts[this.job.main] += this.ptsTotal() - this.ptsUsed();
    if (s.autoUniq) {
      const order = ['crit', 'critDmg', 'bossDmg'];
      let left = this.uniqTotal() - this.uniqUsed(), i = 0;
      while (left-- > 0) { s.uniq[order[i % 3]]++; i++; }
    }
    for (const k of ['main', 'inner', 'guard']) if (!s.skills[k] && s.lv >= SKILLS[k].unlockLv) s.skills[k] = 1;
    this.kitUnlock();
  }
  // ── v493 무공 세트 ── 전직 차수가 되면 열리고(레벨 1), 공격·버프는 빈 칸에 저절로 들어간다(높은 차수가 앞 — 자동 사용 순서)
  kitState() { return (this.s.kit ??= { lv: {}, slots: [], off: [] }); }
  kitUnlock() {
    const K = this.kitState();
    for (const sk of KIT[this.s.job] || []) {
      if (sk.tier > this.s.adv || K.lv[sk.id]) continue;
      K.lv[sk.id] = 1;
      if (sk.kind === 'passive') continue;
      if (K.slots.length < SLOT_N) K.slots.push(sk.id);
      else { const low = K.slots.map(skillById).reduce((a, b) => (b.tier < a.tier ? b : a)); if (low.tier < sk.tier) K.slots[K.slots.indexOf(low.id)] = sk.id; }
      K.slots.sort((a, b) => skillById(b).tier - skillById(a).tier);
    }
  }
  canKitUp(id) { const K = this.kitState(); return (K.lv[id] || 0) > 0 && K.lv[id] < kitCap(this.s.lv); }
  kitUp(id, wallet) {
    if (!this.canKitUp(id)) return false;
    const K = this.kitState();
    if (!pay(wallet, kitCost(K.lv[id], skillById(id).tier))) return false;
    K.lv[id]++;
    return true;
  }
  // 칸 바꾸기: i번 칸에 id(공격·버프만) — 이미 다른 칸에 있으면 자리를 맞바꾼다
  kitSlot(i, id) {
    const K = this.kitState(), sk = skillById(id);
    if (!sk || sk.kind === 'passive' || !K.lv[id] || i < 0 || i >= SLOT_N) return false;
    const j = K.slots.indexOf(id);
    if (j >= 0) [K.slots[i], K.slots[j]] = [K.slots[j], K.slots[i]];
    else K.slots[i] = id;
    K.slots = K.slots.filter(Boolean);
    return true;
  }
  kitAuto(id, on) { const K = this.kitState(); K.off = K.off.filter((x) => x !== id); if (!on) K.off.push(id); }
  battleKit() {
    const K = this.kitState();
    return battleKit(K.slots.map((id) => ({ ...skillById(id), lv: K.lv[id] || 1, auto: !K.off.includes(id) })));
  }
  // 무공 레벨업(은자)
  canSkillUp(k) { return this.s.skills[k] > 0 && this.s.skills[k] < skillCap(this.s.lv); }
  skillUp(k, wallet) {
    if (!this.canSkillUp(k)) return false;
    if (!pay(wallet, skillCost(this.s.skills[k]))) return false;
    this.s.skills[k]++;
    return true;
  }
  // 전직 — 레벨이 닿고, 그 차수 전직 던전을 깼으면
  canAdvance() {
    const n = this.s.adv + 1;
    return n < JOB_LV.length && this.s.lv >= JOB_LV[n] && this.s.cleared.includes(JOB_ADV[n].dungeon);
  }
  advance() { if (!this.canAdvance()) return false; this.s.adv++; this.kitUnlock(); return true; }
  clearDungeon(id) { if (!this.s.cleared.includes(id)) this.s.cleared.push(id); }
  // 마스터리 — 배우기 시작(비용) → endMs가 지나면 끝
  canLearn(id) {
    const n = MASTERY.find((x) => x.id === id), m = this.s.mastery;
    return !!n && !m.learning && !m.done.includes(id) && this.s.lv >= n.lv && (!n.need || m.done.includes(n.need));
  }
  learn(id, nowMs, wallet) {
    if (!this.canLearn(id)) return false;
    const n = MASTERY.find((x) => x.id === id);
    if (!pay(wallet, masteryCost(n))) return false;
    this.s.mastery.learning = { id, endMs: nowMs + n.waitMin * 60000 };
    return true;
  }
  // 시간이 흐르면 끝난 마스터리를 거둔다(시간 티켓은 endMs를 당긴다)
  tickMastery(nowMs) {
    const L = this.s.mastery.learning;
    if (L && nowMs >= L.endMs) { this.s.mastery.done.push(L.id); this.s.mastery.learning = null; return L.id; }
    return null;
  }
  rushMastery(ms) { const L = this.s.mastery.learning; if (L) L.endMs -= Math.max(0, ms); }

  // 이 무인이 주는 스탯 출처(다른 시스템 출처는 S4~에서 더한다)
  sources() {
    const s = this.s, L = s.lv, main = this.job.main;
    const pts = s.pts;
    const subs = MAINS.filter((k) => k !== main).reduce((a, k) => a + pts[k], 0);
    const out = [
      { src: '기본', stats: { atk: baseAtk(L) + pts[main] * MAIN_TO_ATK, hp: baseHp(L) + pts[main] * MAIN_TO_HP + subs * SUB_TO_HP, def: baseDef(L) } },
      { src: '고유 스탯', stats: Object.fromEntries(Object.entries(s.uniq).map(([k, v]) => [k, v * UNIQUE_STATS[k]])) },
    ];
    for (let n = 1; n <= s.adv; n++) out.push({ src: `${n}차 전직`, stats: { atkP: JOB_ADV[n].atkP, hpP: JOB_ADV[n].hpP } });
    // v493 상시 무공(무공 세트의 passive) — 옛 내공심법 · 호신기는 여기로 옮겨 갔다
    const K = s.kit || { lv: {} };
    for (const sk of KIT[s.job] || []) if (sk.kind === 'passive' && K.lv[sk.id]) out.push({ src: sk.name, stats: sk.stats(K.lv[sk.id]) });
    const f1 = MASTERY.filter((n) => s.mastery.done.includes(n.id)).reduce((a, n) => a + n.final1, 0);
    if (f1) out.push({ src: '무공 마스터리', stats: { final1: f1 } });
    return out;
  }
  stats(extra = []) { return finalize(sumStats([...this.sources(), ...extra])); }
  // 전투에 넘길 모양
  fighter(extra = []) { return { lv: this.s.lv, job: this.s.job, kind: 'hero', st: this.stats(extra), kit: this.battleKit() }; }
  skillCoef(k) { return SKILLS[k].coef(this.s.skills[k] || 1); }
}
