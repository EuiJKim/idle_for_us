// 새 시즌(S3) 무인 — 레벨 · 경험치 · 스탯 찍기 · 고유 스탯 · 전직 · 무공 · 마스터리 트리(대기 시간).
// 시간은 엔진 ms(정수)만 받는다. 상태(this.s)는 세이브에 그대로 들어간다.
import { cumExp, expToNext } from '../tables/exp.js';
import { LEVEL_MAX, JOB_LV } from '../tables/progress.js';
import { JOBS, baseAtk, baseHp, baseDef, MAIN_TO_ATK, MAIN_TO_HP, SUB_TO_HP } from '../tables/char.js';
import { SKILLS, skillCap, skillCost, MASTERY, masteryCost, JOB_ADV, UNIQUE_EVERY, UNIQUE_STATS } from '../tables/skills.js';
import { sumStats, finalize } from '../core/stats.js';
import { pay } from '../core/cost.js';

const MAINS = ['str', 'agi', 'ene', 'wis'];

export function newHero(job = 'sword') {
  return {
    job, lv: 1, exp: 0, adv: 0,
    pts: { str: 0, agi: 0, ene: 0, wis: 0 }, autoPts: true,
    uniq: { crit: 0, critDmg: 0, bossDmg: 0 }, autoUniq: true,
    skills: { base: 1, main: 0, inner: 0, guard: 0 },
    mastery: { done: [], learning: null },        // learning: { id, endMs }
    cleared: [],                                   // 깬 전직 던전
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
  advance() { if (!this.canAdvance()) return false; this.s.adv++; return true; }
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
    for (const k of ['inner', 'guard']) if (s.skills[k]) out.push({ src: SKILLS[k].name, stats: SKILLS[k].stats(s.skills[k]) });
    const f1 = MASTERY.filter((n) => s.mastery.done.includes(n.id)).reduce((a, n) => a + n.final1, 0);
    if (f1) out.push({ src: '무공 마스터리', stats: { final1: f1 } });
    return out;
  }
  stats(extra = []) { return finalize(sumStats([...this.sources(), ...extra])); }
  // 전투에 넘길 모양
  fighter(extra = []) { return { lv: this.s.lv, job: this.s.job, kind: 'hero', st: this.stats(extra) }; }
  skillCoef(k) { return SKILLS[k].coef(this.s.skills[k] || 1); }
}
