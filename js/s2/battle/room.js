// 새 시즌(S2) 방 사냥 — 캠프(나오는 자리) + 무리(섞을 몹·재등장 규칙) + 몹 티어(계획서 §H1).
// 결정론: 시간은 50ms 틱 정수, 위치는 mm 정수, 난수는 씨앗 하나. 입력 기록(씨앗 + 수동 조작)만 있으면 그대로 재현된다(§L3).
import { Rng } from '../core/rng.js';
import { TICK_MS } from '../core/clock.js';
import { hit } from './damage.js';
import { makeMob, SKILL_BASE, SKILL_MAIN } from './ref.js';
import { JOBS } from '../tables/char.js';
import { BASE_REGEN_P } from '../tables/economy.js';
import { PAL_ATK } from '../tables/kit.js';

const MOVE_HERO = 4000, MOVE_MOB = 2200, MOB_RANGE = 1200;   // mm/초 · mm
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 방 정의: { w, h(mm), camps:[{x,y,fam}], fams:{ fam: { mobs:[{lv, kind, tier, w}], keep: 유지 수, coolMs } } }
export class RoomFight {
  constructor(def, hero, seed = 1, opts = {}) {
    this.def = def;
    this.rng = new Rng(seed);
    this.seed = seed;
    this.t = 0;
    this.hero = { ...hero, x: def.w >> 1, y: def.h >> 1, hp: hero.st.hp, nextAtk: 0, nextSkill: 0, target: -1 };
    this.mobs = [];
    this.uid = 0;
    this.kills = 0; this.killsBy = {}; this.dmgOut = 0; this.dmgIn = 0; this.crits = 0; this.deaths = 0;
    this.auto = opts.auto !== false;
    this.log = { seed, actions: [] };          // 입력 기록 — 수동 조작만 시각과 함께
    this.events = [];                          // 화면이 그릴 사건(재현 비교용 해시에도 씀)
    this.famState = {};
    for (const [f, d] of Object.entries(def.fams)) this.famState[f] = { cool: 0, keep: d.keep };
    for (const c of def.camps) this.spawn(c);
  }
  spawn(c) {
    const fam = this.def.fams[c.fam];
    const i = this.rng.pick(fam.mobs.map((m) => m.w || 1));
    const m = fam.mobs[i];
    const mob = makeMob(m.lv, m.kind || 'mob', m.tier || 0, this.hero.job);
    const jx = this.rng.range(-400, 400), jy = this.rng.range(-400, 400);
    this.mobs.push({ id: ++this.uid, ...mob, fam: c.fam, camp: c, x: c.x + jx, y: c.y + jy, hp: mob.st.hp, angry: false, nextAtk: 0, bornAt: this.t });
  }
  // 수동 조작(화면 단추) — 기록해 두면 재현할 때 같은 시각에 다시 넣는다
  press(action) { this.log.actions.push({ t: this.t, a: action }); this.queued = action; }
  step() {
    this.t += TICK_MS;
    const H = this.hero, J = JOBS[H.job];
    // 재현 중이면 기록된 조작을 넣는다
    if (this.replay) while (this.replay.length && this.replay[0].t === this.t - TICK_MS) this.queued = this.replay.shift().a;
    // 수동 조작: { move:[x,y] } 그 자리로 걷기 · { auto:true|false } 자동 사냥 켜고 끄기 · 'skill' 무공
    const q = this.queued;
    if (q && typeof q === 'object') {
      if (q.move) { this.moveTo = { x: Math.max(0, Math.min(this.def.w, q.move[0] | 0)), y: Math.max(0, Math.min(this.def.h, q.move[1] | 0)) }; H.target = -1; }
      if (q.auto !== undefined) this.auto = !!q.auto;
      this.queued = null;
    }
    if (this.moveTo) {
      const d = dist(H, this.moveTo), st = Math.min(d, (MOVE_HERO * TICK_MS) / 1000);
      if (d > 0) { H.x += Math.round(((this.moveTo.x - H.x) / d) * st); H.y += Math.round(((this.moveTo.y - H.y) / d) * st); }
      if (dist(H, this.moveTo) < 40) this.moveTo = null;
    } else {
      // 표적: 자동이면 가까운 몹을 쫓아가고, 수동이면 사거리 안의 몹만 친다
      let tgt = this.mobs.find((m) => m.id === H.target);
      if (!tgt || (!this.auto && dist(H, tgt) > J.range)) {
        let best = null, bd = Infinity;
        for (const m of this.mobs) { const d = dist(H, m); if (d < bd && (this.auto || d <= J.range)) { bd = d; best = m; } }
        tgt = best; H.target = best ? best.id : -1;
      }
      if (tgt) {
        const d = dist(H, tgt);
        if (d > J.range) { const s = Math.min(d - J.range + 1, (MOVE_HERO * TICK_MS) / 1000); H.x += Math.round(((tgt.x - H.x) / d) * s); H.y += Math.round(((tgt.y - H.y) / d) * s); }
        else {
          if (!this.castKit(tgt, J) && this.t >= H.nextAtk) { this.strike(tgt, SKILL_BASE); H.nextAtk = this.t + J.baseMs; }
          // 동료(v497) — 표적 둘레 가까운 몹을 친다
          if (H.pals?.length) {
            H.palCd ??= H.pals.map((_, i) => 600 + i * 500);
            H.pals.forEach((pl, i) => {
              if (this.t < H.palCd[i]) return;
              H.palCd[i] = this.t + PAL_ATK.cdMs;
              const ts = this.mobs.filter((m) => dist(m, tgt) <= J.range * PAL_ATK.range).sort((a, b) => dist(a, tgt) - dist(b, tgt)).slice(0, PAL_ATK.maxT);
              for (const m of ts) if (this.mobs.includes(m)) this.strike(m, { coef: PAL_ATK.coef[pl.g] || PAL_ATK.coef[0], base: false });
            });
          }
        }
      }
    }
    // 몹: 맞으면 쫓아와 친다(비선공)
    for (const m of this.mobs) {
      if (!m.angry) continue;
      const d = dist(m, H);
      if (d > MOB_RANGE) { const s = Math.min(d - MOB_RANGE + 1, (MOVE_MOB * TICK_MS) / 1000); m.x += Math.round(((H.x - m.x) / d) * s); m.y += Math.round(((H.y - m.y) / d) * s); }
      else if (this.t >= m.nextAtk) {
        const r = hit(m, H, SKILL_BASE, this.rng);
        H.hp -= r.dmg; this.dmgIn += r.dmg; m.nextAtk = this.t + m.atkMs;
        if (H.hp <= 0) { this.deaths++; H.hp = H.st.hp; this.events.push(['die', this.t]); for (const k of this.mobs) k.angry = false; }
      }
    }
    // 체력 회복(1초마다) — 기본 + 회복 스탯
    if (this.t % 1000 === 0 && H.hp < H.st.hp) H.hp = Math.min(H.st.hp, H.hp + Math.floor((H.st.hp * BASE_REGEN_P) / 1000) + (H.st.regen || 0));
    // 재등장: 무리마다 살아 있는 수가 keep보다 적으면 쿨 뒤 캠프 하나에서
    for (const [f, d] of Object.entries(this.def.fams)) {
      const alive = this.mobs.filter((m) => m.fam === f).length;
      const fs = this.famState[f];
      if (alive >= fs.keep) { fs.cool = 0; continue; }
      fs.cool += TICK_MS;
      if (fs.cool >= d.coolMs) {
        fs.cool = 0;
        const camps = this.def.camps.filter((c) => c.fam === f);
        this.spawn(camps[this.rng.int(camps.length)]);
      }
    }
  }
  // v493 무공 세트 — 무공이 없는 옛 무인(시험)은 주력 무공 하나(쿨 6초)
  castKit(tgt, J) {
    const H = this.hero;
    const kit = H.kit || [{ kind: 'active', shape: 'line', range: 1, maxT: 1, hits: 1, coef: SKILL_MAIN.coef, cdMs: SKILL_MAIN.cdMs, auto: true }];
    if (this.t < (H.gcd || 0)) return false;
    H.cds ??= kit.map(() => 0);
    let i = -1;
    if (this.queued === 'skill') { i = kit.findIndex((k, j) => k.kind === 'active' && this.t >= H.cds[j]); this.queued = null; }
    if (i < 0 && this.auto) i = kit.findIndex((k, j) => k.auto && k.kind === 'active' && this.t >= H.cds[j]);
    if (i < 0) return false;
    const k = kit[i];
    H.cds[i] = this.t + k.cdMs; H.gcd = this.t + 350;
    const R = J.range * k.range;
    const ts = this.mobs.filter((m) => dist(H, m) <= R).sort((a, b) => dist(H, a) - dist(H, b)).slice(0, k.maxT);
    if (!ts.includes(tgt)) { ts.pop(); ts.unshift(tgt); }
    const sk = { coef: k.coef, base: false };
    for (let h = 0; h < k.hits; h++) for (const m of ts.filter(Boolean)) if (m.hp > 0 && this.mobs.includes(m)) this.strike(m, sk);
    return true;
  }
  strike(m, skill) {
    const r = hit(this.hero, m, skill, this.rng);
    m.hp -= r.dmg; m.angry = true; this.dmgOut += r.dmg; if (r.crit) this.crits++;
    this.events.push(['hit', this.t, m.id, r.dmg, r.crit ? 1 : 0]);
    if (m.hp <= 0) {
      this.kills++; this.killsBy[m.kind] = (this.killsBy[m.kind] || 0) + 1;
      this.events.push(['kill', this.t, m.id, m.kind, this.t - m.bornAt]);
      this.mobs = this.mobs.filter((x) => x !== m);
      this.hero.target = -1;
    }
  }
  run(ms) { const end = this.t + ms; while (this.t < end) this.step(); return this; }
  // 사건 흐름의 짧은 지문 — 재현이 같은지 비교
  digest() {
    let h = 0x811c9dc5;
    const s = JSON.stringify(this.events);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return `${h.toString(16)}:${this.kills}:${this.dmgOut}`;
  }
}
// 입력 기록으로 다시 돌리기(재현 검증)
export function replay(def, hero, log, ms, opts = {}) {
  const f = new RoomFight(def, hero, log.seed, opts);
  f.replay = log.actions.map((x) => ({ ...x }));
  return f.run(ms);
}
// 시험·시뮬용 방 하나: 캠프 n개, 같은 레벨 몹 한 무리
export function simpleRoom(L, { n = 8, kind = 'mob', tier = 0, coolMs = 6000 } = {}) {
  const camps = Array.from({ length: n }, (_, i) => ({ x: 2000 + (i % 4) * 4000, y: 2500 + Math.floor(i / 4) * 6000, fam: 'a' }));
  return { w: 18000, h: 14000, camps, fams: { a: { mobs: [{ lv: L, kind, tier, w: 1 }], keep: n, coolMs } } };
}
