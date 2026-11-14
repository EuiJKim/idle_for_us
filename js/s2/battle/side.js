// 새 시즌 옆보기 사냥(S9 재설계) — 층층 발판 위를 좌우로 달리고, 뛰어오르고, 내려가며 싸운다.
// 결정론: 50ms 틱 · mm 정수 · 씨앗 하나. 입력(방향·점프·내려가기·무공·자동)은 기록해 그대로 재현한다.
// 좌표: x 왼→오, y 바닥에서 위로(발 높이). 발판 { x0, x1, y } — 바닥(y=0)은 맵 전체.
import { Rng } from '../core/rng.js';
import { TICK_MS } from '../core/clock.js';
import { hit } from './damage.js';
import { makeMob, SKILL_BASE, SKILL_MAIN } from './ref.js';
import { JOBS } from '../tables/char.js';
import { BASE_REGEN_P } from '../tables/economy.js';

export const RUN = 4200, MOB_RUN = 1600, GRAV = 22000, JUMP_V = 11000, SAME_Y = 500;   // mm/s · mm/s² · mm
export const MAIN_HITS = 4;          // 주력 무공은 앞쪽 여러 마리(장르 공통 — 한 번에 쓸어 담는 맛)
const DT = TICK_MS / 1000;

// 맵 하나: 너비 w · 발판 줄(바닥 + 위층 2~3단) · 몹 자리(발판마다)
export function makeSideMap(seed, { w = 26000, tiers = 3, gap = 2300 } = {}) {
  const r = new Rng(seed);
  const plats = [{ x0: 0, x1: w, y: 0 }];
  // 위층 발판은 늘 바로 아래층 발판과 1.5미터 넘게 겹친다 — 어디서든 뛰어서 오를 수 있게
  let below = [plats[0]];
  for (let t = 1; t <= tiers; t++) {
    const row = [];
    let x = 600 + r.int(2000);
    while (x < w - 3000) {
      const len = 4000 + r.int(5000);
      let x0 = x, x1 = Math.min(w - 400, x + len);
      const ok = below.some((b) => Math.min(b.x1, x1) - Math.max(b.x0, x0) >= 1500);
      if (!ok) { const b = below.reduce((a, c) => (Math.abs((c.x0 + c.x1) / 2 - x) < Math.abs((a.x0 + a.x1) / 2 - x) ? c : a)); x0 = Math.max(b.x0 + 200, Math.min(x0, b.x1 - 1700)); x1 = Math.max(x1, x0 + 3500); }
      const p = { x0, x1: Math.min(w - 400, x1), y: t * gap };
      if (!row.length || p.x0 > row[row.length - 1].x1 + 1200) row.push(p);
      x = p.x1 + 1800 + r.int(2600);
    }
    plats.push(...row); below = row;
  }
  const spots = [];
  plats.forEach((p, i) => { for (let x = p.x0 + 1200; x < p.x1 - 800; x += 2600) spots.push({ p: i, x }); });
  return { w, h: (tiers + 1) * gap + 2000, plats, spots };
}

export class SideFight {
  constructor(def, hero, seed = 1, opts = {}) {
    this.def = def;              // { lv, map, fams:{ fam:{ mobs:[{lv,kind,w}], keep, coolMs } } }
    this.rng = new Rng(seed);
    this.seed = seed;
    this.t = 0;
    const m = def.map;
    this.hero = { ...hero, x: 1500, y: 0, vy: 0, plat: 0, face: 1, hp: hero.st.hp, nextAtk: 0, nextSkill: 0, target: -1, drop: -1, act: '', chaseAt: 0 };
    this.mobs = []; this.uid = 0;
    this.kills = 0; this.killsBy = {}; this.dmgOut = 0; this.dmgIn = 0; this.crits = 0; this.deaths = 0;
    this.auto = opts.auto !== false;
    this.input = { dir: 0 };
    this.log = { seed, actions: [] };
    this.events = [];
    this.famState = {};
    for (const [f, d] of Object.entries(def.fams)) this.famState[f] = { cool: 0, keep: d.keep };
    // 처음엔 일반 몹만 자리마다
    const fa = def.fams.a;
    if (fa) for (let i = 0; i < Math.min(fa.keep, m.spots.length); i++) this.spawn('a', m.spots[(i * 7) % m.spots.length]);
  }
  spawn(fam, spot) {
    const d = this.def.fams[fam], i = this.rng.pick(d.mobs.map((x) => x.w || 1)), md = d.mobs[i];
    const mob = makeMob(md.lv, md.kind || 'mob', md.tier || 0, this.hero.job);
    const p = this.def.map.plats[spot.p];
    this.mobs.push({ id: ++this.uid, ...mob, fam, plat: spot.p, x: Math.max(p.x0 + 300, Math.min(p.x1 - 300, spot.x + this.rng.range(-500, 500))), y: p.y, hp: mob.st.hp, angry: false, nextAtk: 0, dir: this.rng.int(2) ? 1 : -1, bornAt: this.t });
  }
  // 조작: { dir:-1|0|1 } 누르고 있는 방향 · { jump:1 } · { down:1 } · 'skill' · { auto:bool }
  press(a) { this.log.actions.push({ t: this.t, a }); this.apply(a); }
  apply(a) {
    if (a === 'skill') { this.wantSkill = true; return; }
    if (a.dir !== undefined) this.input.dir = Math.sign(a.dir);
    if (a.jump) this.wantJump = true;
    if (a.down) this.wantDown = true;
    if (a.auto !== undefined) this.auto = !!a.auto;
  }
  platAt(x, yTop, yBot, skip = -1) {
    // yTop(이전 발) → yBot(지금 발) 사이를 지나간 발판 중 가장 높은 것
    let best = -1;
    this.def.map.plats.forEach((p, i) => { if (i !== skip && x >= p.x0 && x <= p.x1 && p.y <= yTop && p.y >= yBot && (best < 0 || p.y > this.def.map.plats[best].y)) best = i; });
    return best;
  }
  // 자동: 표적 고르기 — 같은 층 가까운 몹을 먼저(층이 다르면 거리 더 침)
  pickTarget() {
    const H = this.hero;
    let best = null, bc = Infinity;
    for (const m of this.mobs) {
      if (m.skipUntil > this.t) continue;
      const c = Math.abs(m.x - H.x) + Math.abs(m.y - H.y) * 3 + (m.kind === 'boss' ? -100000 : 0);
      if (c < bc) { bc = c; best = m; }
    }
    return best;
  }
  step() {
    this.t += TICK_MS;
    const H = this.hero, J = JOBS[H.job], map = this.def.map;
    // 화면이 틱 사이를 이어 그리도록 직전 자리를 남긴다(엔진 결과에는 영향 없음)
    H.px = H.x; H.py = H.y;
    for (const m of this.mobs) { m.px = m.x; m.py = m.y; }
    if (this.replay) while (this.replay.length && this.replay[0].t === this.t - TICK_MS) this.apply(this.replay.shift().a);
    // ── 무인 움직임 ──
    let dir = this.input.dir, jump = this.wantJump, down = this.wantDown;
    this.wantJump = this.wantDown = false;
    let tgt = this.mobs.find((m) => m.id === H.target);
    if (this.auto && dir === 0) {
      // 4초 안에 닿지 못하면(다른 층 · 길 없음) 잠깐 제쳐 두고 다른 몹
      if (tgt && this.t - H.chaseAt > 4000) { tgt.skipUntil = this.t + 8000; tgt = null; H.target = -1; }
      if (!tgt) { tgt = this.pickTarget(); if (!tgt) { for (const m of this.mobs) m.skipUntil = 0; tgt = this.pickTarget(); } H.target = tgt ? tgt.id : -1; H.chaseAt = this.t; }
      if (tgt) {
        const dy = tgt.y - H.y, dx = tgt.x - H.x;
        // 같은 층: 사거리 90% 밖이면 다가가기 시작해 60% 안까지 들어가서 선다(경계에서 가다 서다 떨지 않게)
        if (Math.abs(dy) <= SAME_Y) {
          if (Math.abs(dx) > J.range * 0.9) H.closing = true;
          if (H.closing && Math.abs(dx) <= J.range * 0.6) H.closing = false;
          if (H.closing) dir = Math.sign(dx);
        }
        else if (dy > 0 && H.plat >= 0) {
          // 위로: 지금 자리 위에 오를 발판이 있으면 뛰고, 없으면 표적 쪽으로 걸어간다
          // 위로: 뛰어 닿는 발판(한 층 위) 중 표적에 가장 가까운 것 아래로 가서 뛴다
          const ups = map.plats.filter((p) => p.y > H.y && p.y - H.y <= 2700);
          const best = ups.reduce((a, p) => { const cx = Math.max(p.x0 + 400, Math.min(p.x1 - 400, tgt.x)); const c = Math.abs(cx - tgt.x) + Math.abs(cx - H.x) * 0.5; return !a || c < a.c ? { p, cx, c } : a; }, null);
          if (best && H.x >= best.p.x0 + 200 && H.x <= best.p.x1 - 200) jump = true;
          else if (best) dir = Math.sign(best.cx - H.x) || 1;
          else dir = Math.sign(dx) || 1;
        } else if (dy < 0 && H.plat > 0) {
          down = true;
        } else dir = Math.sign(dx) || 1;
      }
    } else if (!this.auto && (!tgt || Math.abs(tgt.y - H.y) > SAME_Y || Math.abs(tgt.x - H.x) > J.range)) {
      // 수동: 사거리 안 같은 층 몹만 표적
      tgt = this.mobs.filter((m) => Math.abs(m.y - H.y) <= SAME_Y && Math.abs(m.x - H.x) <= J.range).sort((a, b) => Math.abs(a.x - H.x) - Math.abs(b.x - H.x))[0] || null;
      H.target = tgt ? tgt.id : -1;
    }
    H.act = '';
    if (dir) { H.x = Math.max(200, Math.min(map.w - 200, H.x + Math.round(dir * RUN * DT))); H.face = dir; H.act = 'run'; }
    if (H.plat >= 0) {
      const p = map.plats[H.plat];
      if (jump) { H.vy = JUMP_V; H.drop = H.plat; H.plat = -1; H.act = 'jump'; }
      else if (down && H.plat > 0) { H.drop = H.plat; H.plat = -1; H.vy = 0; }
      else if (H.x < p.x0 || H.x > p.x1) { H.drop = -1; H.plat = -1; H.vy = 0; }   // 발판 끝에서 떨어짐
    }
    if (H.plat < 0) {
      const y0 = H.y;
      H.vy -= GRAV * DT; H.y = Math.round(H.y + H.vy * DT);
      if (H.vy <= 0) {
        const land = this.platAt(H.x, y0, H.y, H.drop);
        if (land >= 0) { H.plat = land; H.y = map.plats[land].y; H.vy = 0; H.drop = -1; }
      }
      if (H.y <= 0) { H.y = 0; H.plat = 0; H.vy = 0; H.drop = -1; }
    }
    // ── 공격 ── 같은 층 · 바라보는 쪽 · 사거리 안
    if (tgt && Math.abs(tgt.y - H.y) <= SAME_Y && Math.abs(tgt.x - H.x) <= J.range && H.plat >= 0) {
      H.chaseAt = this.t;
      H.face = Math.sign(tgt.x - H.x) || H.face;
      const useSkill = (this.auto || this.wantSkill) && this.t >= H.nextSkill;
      if (useSkill) {
        // 앞쪽 같은 층 여러 마리
        const front = this.mobs.filter((m) => Math.abs(m.y - H.y) <= SAME_Y && (m.x - H.x) * H.face >= -300 && Math.abs(m.x - H.x) <= J.range * 1.6)
          .sort((a, b) => Math.abs(a.x - H.x) - Math.abs(b.x - H.x)).slice(0, MAIN_HITS);
        this.events.push(['skill', this.t, H.face]);
        for (const m of front) this.strike(m, SKILL_MAIN);
        H.nextSkill = this.t + SKILL_MAIN.cdMs; this.wantSkill = false; H.act = 'skill';
      } else if (this.t >= H.nextAtk) { this.strike(tgt, SKILL_BASE); H.nextAtk = this.t + J.baseMs; H.act = 'atk'; }
    }
    // ── 몹 ── 맞으면 같은 층에서 무인 쪽으로 와서 친다 · 아니면 발판 위를 서성
    for (const m of this.mobs) {
      const p = map.plats[m.plat];
      const same = Math.abs(m.y - H.y) <= SAME_Y, adx = Math.abs(H.x - m.x);
      // 화난 몹: 같은 층이면 700mm까지 붙어 친다(1000mm 넘게 벌어져야 다시 쫓음 — 경계 떨림 없음)
      if (m.angry && same) {
        if (adx > 1000) m.chase = true; else if (adx <= 700) m.chase = false;
        m.dir = Math.sign(H.x - m.x) || m.dir;
      }
      let walk;
      if (m.angry && same) walk = !!m.chase;
      else {
        // 서성임: 몇 초 걷고 잠깐 섰다가 방향을 고른다(매 순간 무작위로 뒤돌지 않게)
        if (this.t >= (m.nextTurn || 0)) { m.idle = !m.idle; m.nextTurn = this.t + (m.idle ? 800 + this.rng.int(1400) : 1600 + this.rng.int(2600)); if (!m.idle && this.rng.int(2)) m.dir = -m.dir; }
        walk = !m.idle;
      }
      m.moving = walk;
      if (walk) {
        m.x += Math.round(m.dir * MOB_RUN * DT * (m.kind === 'boss' ? 0.6 : 1));
        if (m.x < p.x0 + 200) { m.x = p.x0 + 200; m.dir = 1; } else if (m.x > p.x1 - 200) { m.x = p.x1 - 200; m.dir = -1; }
      } else if (m.angry && same && adx <= 700 && this.t >= m.nextAtk && H.plat >= 0) {
        const r = hit(m, H, SKILL_BASE, this.rng);
        H.hp -= r.dmg; this.dmgIn += r.dmg; m.nextAtk = this.t + m.atkMs;
        this.events.push(['hurt', this.t, r.dmg]);
        if (H.hp <= 0) { this.deaths++; H.hp = H.st.hp; this.events.push(['die', this.t]); for (const k of this.mobs) k.angry = false; }
      }
    }
    if (this.t % 1000 === 0 && H.hp < H.st.hp) H.hp = Math.min(H.st.hp, H.hp + Math.floor((H.st.hp * BASE_REGEN_P) / 1000) + (H.st.regen || 0));
    // ── 재등장 ──
    for (const [f, d] of Object.entries(this.def.fams)) {
      const alive = this.mobs.filter((m) => m.fam === f).length, fs = this.famState[f];
      if (alive >= fs.keep) { fs.cool = 0; continue; }
      fs.cool += TICK_MS;
      if (fs.cool >= d.coolMs) {
        fs.cool = 0;
        // 무인 화면에서 조금 떨어진 자리(바로 옆에서 솟지 않게)
        const far = map.spots.filter((s) => Math.abs(s.x - H.x) > 3000);
        const pool = far.length ? far : map.spots;
        this.spawn(f, pool[this.rng.int(pool.length)]);
      }
    }
  }
  strike(m, skill) {
    const r = hit(this.hero, m, skill, this.rng);
    m.hp -= r.dmg; m.angry = true; this.dmgOut += r.dmg; if (r.crit) this.crits++;
    this.events.push(['hit', this.t, m.id, r.dmg, r.crit ? 1 : 0, skill === SKILL_MAIN ? 1 : 0]);
    if (m.hp <= 0) {
      this.kills++; this.killsBy[m.kind] = (this.killsBy[m.kind] || 0) + 1;
      this.events.push(['kill', this.t, m.id, m.kind, this.t - m.bornAt]);
      this.mobs = this.mobs.filter((x) => x !== m);
      if (this.hero.target === m.id) this.hero.target = -1;
    }
  }
  run(ms) { const end = this.t + ms; while (this.t < end) this.step(); return this; }
  digest() {
    let h = 0x811c9dc5;
    const s = JSON.stringify(this.events);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return `${h.toString(16)}:${this.kills}:${this.dmgOut}`;
  }
}
export function replaySide(def, hero, log, ms, opts = {}) {
  const f = new SideFight(def, hero, log.seed, opts);
  f.replay = log.actions.map((x) => ({ ...x }));
  return f.run(ms);
}
// 표준 옆보기 사냥터(시험 · 시뮬)
export function sideRoom(L, seed = 1, { n = 14, coolMs = 1500 } = {}) {
  return { lv: L, map: makeSideMap(seed), fams: { a: { mobs: [{ lv: L, kind: 'mob', w: 1 }], keep: n, coolMs }, e: { mobs: [{ lv: L, kind: 'elite', w: 1 }], keep: 0, coolMs: 500 }, b: { mobs: [{ lv: L, kind: 'boss', w: 1 }], keep: 0, coolMs: 500 } } };
}
