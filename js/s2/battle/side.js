// 새 시즌 옆보기 사냥(S9 재설계) — 층층 발판 위를 좌우로 달리고, 뛰어오르고, 내려가며 싸운다.
// 결정론: 50ms 틱 · mm 정수 · 씨앗 하나. 입력(방향·점프·내려가기·무공·자동)은 기록해 그대로 재현한다.
// 좌표: x 왼→오, y 바닥에서 위로(발 높이). 발판 { x0, x1, y } — 바닥(y=0)은 맵 전체.
import { Rng } from '../core/rng.js';
import { TICK_MS } from '../core/clock.js';
import { hit } from './damage.js';
import { makeMob, SKILL_BASE, SKILL_MAIN } from './ref.js';
import { JOBS, RANGED } from '../tables/char.js';
import { BASE_REGEN_P } from '../tables/economy.js';
import { PAL_ATK, BOSS_PATS, BOSS_PAT_EVERY, skillById } from '../tables/kit.js';
import { CB_PATS, CB, WBF } from '../tables/chboss.js';
import { KILL_HEAL_CAP } from '../tables/traits.js';

export const RUN = 4200, MOB_RUN = 1600, GRAV = 22000, JUMP_V = 11000, SAME_Y = 500;   // mm/s · mm/s² · mm
export const MAIN_HITS = 4;          // 주력 무공은 앞쪽 여러 마리(장르 공통 — 한 번에 쓸어 담는 맛)
const DT = TICK_MS / 1000;
// v546 회피(대시) — 누르면 0.25초에 3미터 · 0.4초 무적 · 1.8초마다. 붉은 범위가 터지기 0.45초 안에 범위 안에서 빠져나가면 「완벽 회피」 → 4초 동안 주는 피해 ×1.3
export const DASH = { ms: 250, dist: 3000, invMs: 400, cdMs: 1800, perfectMs: 450, buffMs: 4000, buffX: 1.3 };
// v632 자동 움직임 — 표적 값 = 닿는 데 걸릴 시간 어림(ms): 달리기 + 층 오르기 · 내리기 + 뒤돌기 − 무리 · 화난 몹.
//   다시 보기 reMs마다 · 지금 표적보다 switchMs 넘게 나을 때만 바꾼다(가다 말고 바꾸지 않게) · 포기 = giveBase + 어림 × giveX(최대 giveMax)
//   같은 발판 먼 표적(dashGap 넘게)은 일반 사냥에서만 회피로 좁힌다(두목 · 던전에선 회피를 아껴 둔다)
export const AUTO = { upMs: 2800, downMs: 1450, gapMs: 900, turnMs: 900, packR: 2500, packMs: 200, packMax: 3, angryMs: 250, reMs: 500, switchMs: 1200, giveBase: 2500, giveX: 1.6, giveMax: 9000, dashGap: 7000, upKeep: 1500 };

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
    this.hero = { ...hero, x: Math.round(m.w * 0.4), y: 0,   // v504 맵 가운데쯤에서 시작(왼쪽 끝에 붙어 싸우지 않게)
      vy: 0, plat: 0, face: 1, hp: hero.st.hp, nextAtk: 0, nextSkill: 0, target: -1, drop: -1, act: '', chaseAt: 0 };
    this.mobs = []; this.uid = 0;
    this.kills = 0; this.killsBy = {}; this.dmgOut = 0; this.dmgIn = 0; this.crits = 0; this.deaths = 0;
    this.auto = opts.auto !== false;
    this.autoDodge = opts.autoDodge !== false;   // v532 자동이면 두목 패턴을 피한다(나중에 「수동만 피함」으로 바꿀 손잡이)
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
    if (a === 'skill') { this.wantSlot = -1; return; }          // 아무 준비된 무공
    if (a.slot !== undefined) { this.wantSlot = a.slot | 0; return; }   // 그 칸 무공
    if (a.dir !== undefined) this.input.dir = Math.sign(a.dir);
    if (a.jump) this.wantJump = true;
    if (a.down) this.wantDown = true;
    if (a.dash) this.wantDash = true;
    if (a.auto !== undefined) this.auto = !!a.auto;
  }
  platAt(x, yTop, yBot, skip = -1) {
    // yTop(이전 발) → yBot(지금 발) 사이를 지나간 발판 중 가장 높은 것
    let best = -1;
    this.def.map.plats.forEach((p, i) => { if (i !== skip && x >= p.x0 && x <= p.x1 && p.y <= yTop && p.y >= yBot && (best < 0 || p.y > this.def.map.plats[best].y)) best = i; });
    return best;
  }
  // 자동: 표적 고르기 — 같은 층 가까운 몹을 먼저(층이 다르면 거리 더 침)
  //   v632 거리(mm) 대신 걸리는 시간(ms) — 층 오르기 · 뒤돌기는 비싸고 · 무리 속 몹 · 다가오는 몹은 싸다(두목은 늘 먼저)
  pickTarget() {
    let best = null, bc = Infinity;
    for (const m of this.mobs) {
      if (m.skipUntil > this.t) continue;
      const c = this.autoCost(m);
      if (c < bc) { bc = c; best = m; }
    }
    return best;
  }
  // 닿는 데 걸릴 시간 어림(ms) — bare: 무리 · 화난 몹 · 뒤돌기 빼고(포기 시간 재기용)
  autoCost(m, bare = false) {
    const H = this.hero, A = AUTO, J = JOBS[H.job], dx = m.x - H.x, dy = m.y - H.y, adx = Math.abs(dx);
    const gap = this.def.map.plats[1]?.y || 2300, n = Math.round(Math.abs(dy) / gap);
    let c = (Math.max(0, adx - J.range * 0.8) * 1000) / RUN;
    if (dy > 300) c += n * A.upMs; else if (dy < -300) c += n * A.downMs;
    else if (H.plat > 0 && m.plat !== H.plat && adx > J.range) c += A.gapMs;   // 같은 높이 다른 발판(틈을 건너야)
    if (bare) return c;
    if (adx > J.range && Math.sign(dx) === -(H.face || 1)) c += A.turnMs;
    let pk = 0;
    for (const o of this.mobs) if (o !== m && o.plat === m.plat && Math.abs(o.x - m.x) <= A.packR && ++pk >= A.packMax) break;
    c -= pk * A.packMs + (m.angry ? A.angryMs : 0);
    return c + (m.kind === 'boss' ? -1e6 : 0);
  }
  // 자동 표적: 고르기 · 붙들기(hysteresis) · 포기 — 반환은 지금 표적
  autoTarget(tgt) {
    const H = this.hero, A = AUTO, J = JOBS[H.job];
    const near = (m) => Math.abs(m.y - H.y) <= SAME_Y && Math.abs(m.x - H.x) <= J.range;
    if (tgt && this.t - H.chaseAt > (H.chaseMax || 4000)) { tgt.skipUntil = this.t + 8000; tgt = null; H.target = -1; this.giveUps = (this.giveUps || 0) + 1; }
    // 쫓는 중(사거리 밖)이면 reMs마다 다시 본다 — 훨씬 나은 몹(지나치는 몹 · 가까이 솟은 몹)이 있으면 바꾼다
    if (tgt && !near(tgt) && this.t >= (H.reAt || 0)) {
      H.reAt = this.t + A.reMs;
      const b = this.pickTarget();
      if (b && b !== tgt && (near(b) || this.autoCost(b) < this.autoCost(tgt) - A.switchMs)) tgt = b, this.setTarget(b);
    }
    if (!tgt) { tgt = this.pickTarget(); if (!tgt) { for (const m of this.mobs) m.skipUntil = 0; tgt = this.pickTarget(); } this.setTarget(tgt); }
    return tgt;
  }
  // 같은 발판 먼 표적 쪽으로 이미 다 달리고 있으면 회피로 좁힌다 — 일반 사냥만(두목 · 던전 · 두목 몹이 있으면 회피를 아낀다)
  autoDash(tgt, dir) {
    const H = this.hero, d = this.def;
    if (AUTO.dashGap <= 0 || d.boss || d.dungeon || d.wb || H.plat < 0 || tgt.plat !== H.plat || this.t < (H.dashReady || 0) || this.t < (H.lockUntil || 0) || H.hopUntil > this.t) return false;
    if (Math.sign(tgt.x - H.x) !== dir || Math.abs(tgt.x - H.x) < AUTO.dashGap || (H.spd || 0) < 1000 || this.mobs.some((m) => m.kind === 'boss')) return false;
    this.wantDash = false;
    H.dashDir = dir; H.face = dir; H.dashAt = this.t; H.dashX0 = H.x; H.dashUntil = this.t + DASH.ms; H.invUntil = this.t + DASH.invMs; H.dashReady = this.t + DASH.cdMs;
    this.events.push(['dash', this.t, dir]);
    this.autoDashes = (this.autoDashes || 0) + 1;
    return true;
  }
  setTarget(m) {
    const H = this.hero, A = AUTO;
    H.target = m ? m.id : -1; H.chaseAt = this.t; H.reAt = this.t + A.reMs; H.upPlat = -1;
    H.chaseMax = m ? Math.min(A.giveMax, Math.round(A.giveBase + this.autoCost(m, true) * A.giveX)) : 4000;
  }
  step() {
    this.t += TICK_MS;
    const H = this.hero, J = JOBS[H.job], map = this.def.map, rg = J.range >= RANGED.minRange;   // v628 원거리(궁사 · 술사)
    if (this.def.wb) { const w = this.wbWeak(); if (w !== !!this.wbW) { this.wbW = w; this.events.push(['wbw', this.t, w ? 1 : 0]); } }   // v535 월드보스 자세가 바뀜
    // 화면이 틱 사이를 이어 그리도록 직전 자리를 남긴다(엔진 결과에는 영향 없음)
    H.px = H.x; H.py = H.y;
    for (const m of this.mobs) { m.px = m.x; m.py = m.y; }
    if (this.replay) while (this.replay.length && this.replay[0].t === this.t - TICK_MS) this.apply(this.replay.shift().a);
    // ── 무인 움직임 ──
    let dir = this.input.dir, jump = this.wantJump, down = this.wantDown, dodge = false;
    this.wantJump = this.wantDown = false;
    if (this.wantDash) {
      this.wantDash = false;
      if (this.t >= (H.dashReady || 0)) {
        H.dashDir = Math.sign(this.input.dir) || H.face || 1; H.face = H.dashDir;
        H.dashAt = this.t; H.dashX0 = H.x; H.dashUntil = this.t + DASH.ms; H.invUntil = this.t + DASH.invMs; H.dashReady = this.t + DASH.cdMs;
        this.events.push(['dash', this.t, H.dashDir]);
      }
    }
    let tgt = this.mobs.find((m) => m.id === H.target);
    if (this.auto && dir === 0) {
      // 닿을 만한 시간(v632 거리에 맞춰 · 예전엔 늘 4초) 안에 닿지 못하면(길 없음) 잠깐 제쳐 두고 다른 몹
      tgt = this.autoTarget(tgt);
      if (tgt) {
        const dy = tgt.y - H.y, dx = tgt.x - H.x;
        // 같은 층: 사거리 90% 밖이면 다가가기 시작해 60% 안까지 들어가서 선다(경계에서 가다 서다 떨지 않게) — v628 원거리는 RANGED.stand(72%)에서
        if (Math.abs(dy) <= SAME_Y) {
          if (Math.abs(dx) > J.range * 0.9) H.closing = true;
          if (H.closing && Math.abs(dx) <= J.range * (rg ? RANGED.stand : 0.6)) H.closing = false;
          if (H.closing) dir = Math.sign(dx);
        }
        else if (dy > 0 && H.plat >= 0) {
          // 위로: 지금 자리 위에 오를 발판이 있으면 뛰고, 없으면 표적 쪽으로 걸어간다
          // 위로: 뛰어 닿는 발판(한 층 위) 중 표적에 가장 가까운 것 아래로 가서 뛴다
          const ups = map.plats.filter((p) => p.y > H.y && p.y - H.y <= 2700);
          const upC = (p) => { const cx = Math.max(p.x0 + 400, Math.min(p.x1 - 400, tgt.x)); return { p, cx, c: Math.abs(cx - tgt.x) + Math.abs(cx - H.x) * 0.5 }; };
          let best = ups.reduce((a, p) => { const o = upC(p); return !a || o.c < a.c ? o : a; }, null);
          // v632 오를 발판은 한 번 고르면 붙든다 — 몹이 서성이며 표적 x가 흔들려도 두 발판 사이를 오가지 않게
          const keep = ups.find((p) => map.plats.indexOf(p) === H.upPlat);
          if (keep && best && keep !== best.p) { const k = upC(keep); if (k.c < best.c + AUTO.upKeep) best = k; }
          if (best) H.upPlat = map.plats.indexOf(best.p);
          if (best && H.x >= best.p.x0 + 200 && H.x <= best.p.x1 - 200) jump = true;
          else if (best) dir = Math.sign(best.cx - H.x) || 1;
          else dir = Math.sign(dx) || 1;
        } else if (dy < 0 && H.plat > 0) {
          down = true;
        } else dir = Math.sign(dx) || 1;
      }
      // v505 자동이면 두목 패턴의 붉은 범위 안에서 가까운 쪽 밖으로 비킨다(수동은 직접 피해야 한다)
      if (this.autoDodge) for (const m of this.mobs) {
        const q = m.pat; if (!q || this.t > q.end || q.shape === 'summon') continue;
        if (q.shape === 'ult') { if (H.x >= q.safe[0] + 300 && H.x <= q.safe[1] - 300) continue; dodge = true; dir = Math.sign((q.safe[0] + q.safe[1]) / 2 - H.x) || 1; H.closing = false; jump = false; down = false; break; }
        if (Math.abs(H.y - q.y) > SAME_Y + 600 || Math.abs(H.x - q.x) > q.w / 2 + 250) continue;
        dodge = true;
        const out = Math.sign(H.x - q.x) || -(H.face || 1), edge = q.x + out * (q.w / 2 + 300);
        if ((out > 0 && edge > map.w - 200) || (out < 0 && edge < 200)) dir = -out; else dir = out;
        H.closing = false; jump = false; down = false;
        break;
      }
      // v628 원거리: 화난 몹이 붙으면 뒤로 뛴다 — 두목 패턴 피하기가 먼저(피하는 틱에는 안 뛰고, 뛰던 것도 멈춘다)
      if (rg) { if (dodge) H.hopUntil = 0; else this.rgHop(map); }
      if (!dodge && tgt && dir) this.autoDash(tgt, dir);
    } else if (!this.auto && (!tgt || Math.abs(tgt.y - H.y) > SAME_Y || Math.abs(tgt.x - H.x) > J.range)) {
      // 수동: 사거리 안 같은 층 몹만 표적
      tgt = this.mobs.filter((m) => Math.abs(m.y - H.y) <= SAME_Y && Math.abs(m.x - H.x) <= J.range).sort((a, b) => Math.abs(a.x - H.x) - Math.abs(b.x - H.x))[0] || null;
      H.target = tgt ? tgt.id : -1;
    }
    H.act = '';
    // v507 치는 동안은 제자리(무공 0.26~0.51초 · 평타 0.14초) — 이펙트가 터지는데 몸이 딴 데로 달려가지 않게. 두목 패턴 피하기 · 점프는 예외
    if (this.t < (H.lockUntil || 0) && !dodge) { dir = 0; if (this.auto) jump = false; }
    // v628 뒤로 뛰는 동안(ms)은 달리기 · 점프 · 내려가기 없이 뛰는 길만 간다 — 회피를 누르면 뛰기는 멈춘다
    if (rg && H.hopUntil && H.dashAt === this.t) H.hopUntil = 0;
    const hop = rg && H.hopUntil > 0 && this.t > H.hopAt && this.t < H.hopUntil + TICK_MS;
    if (hop) { dir = 0; jump = false; down = false; }
    // v507 달리기는 0.14초에 걸쳐 빨라지고 0.1초에 걸쳐 멈춘다(뚝 떠나고 뚝 서지 않게)
    if (dir) { if (H.mdir !== dir) { H.spd = H.mdir === -dir ? 200 : (H.spd || 0); H.mdir = dir; } H.spd = Math.min(1000, (H.spd || 0) + 360); H.face = dir; }
    else H.spd = Math.max(0, (H.spd || 0) - 500);
    if (H.spd > 0 && H.mdir) { H.x = Math.max(200, Math.min(map.w - 200, H.x + Math.round((H.mdir * RUN * DT * H.spd) / 1000))); H.act = 'run'; }
    if (this.t < (H.dashUntil || 0) + TICK_MS && this.t > (H.dashAt ?? -1)) { H.x = Math.max(200, Math.min(map.w - 200, H.x + H.dashDir * Math.round((DASH.dist * TICK_MS) / DASH.ms))); H.act = 'dash'; }   // v546
    if (hop) { H.x = Math.max(200, Math.min(map.w - 200, H.hopX0 + H.hopDir * Math.round(H.hopLen * Math.max(0, Math.min(1, (this.t - H.hopAt - RANGED.hop.wind) / RANGED.hop.ms))))); H.act = 'hop'; }   // v628 웅크렸다(wind) 뛴다 · 무적 없음
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
      // v507 표적이 거의 겹쳐 있으면(0.2m 안) 돌아서지 않는다 — 1분에 40번 넘게 좌우로 뒤집히던 것
      if (Math.abs(tgt.x - H.x) > 200) H.face = Math.sign(tgt.x - H.x) || H.face;
      if (!this.castKit(tgt, J)) {
        if (this.t >= H.nextAtk) { this.strike(tgt, SKILL_BASE); this.splashHit(tgt, J); H.nextAtk = this.t + J.baseMs; H.act = 'atk'; H.lockUntil = this.t + 140; }
      }
    }
    this.kitPend();   // v632 무공 변형 — 나눠 친 연타
    // 버프가 끝나면 원래 스탯으로
    if (H.buffs?.length && H.buffs.some((b) => b.until <= this.t)) { H.buffs = H.buffs.filter((b) => b.until > this.t); this.restat(); }
    // ── 동료(v497) ── 무인이 싸우는 중이면 쿨마다 무인의 표적 쪽 가까운 몹을 친다
    if (H.pals?.length && tgt && Math.abs(tgt.y - H.y) <= SAME_Y && Math.abs(tgt.x - H.x) <= J.range * 1.5) {
      H.palCd ??= H.pals.map((_, i) => 600 + i * 500);
      H.pals.forEach((pl, i) => {
        if (this.t < H.palCd[i]) return;
        H.palCd[i] = this.t + PAL_ATK.cdMs;
        const ts = this.mobs.filter((m) => Math.abs(m.y - H.y) <= SAME_Y && Math.abs(m.x - tgt.x) <= J.range * PAL_ATK.range).sort((a, b) => Math.abs(a.x - tgt.x) - Math.abs(b.x - tgt.x)).slice(0, PAL_ATK.maxT);
        this.events.push(['pal', this.t, i, ts[0]?.id ?? -1]);
        for (const m of ts) this.strike(m, { coef: PAL_ATK.coef[pl.g] || PAL_ATK.coef[0], base: false, pal: 1 }, 0);
      });
    }
    // ── 두목 패턴(v497) ── 예고 → 잠시 뒤 범위 안이면 맞음(수동이면 피할 수 있다)
    for (const m of this.mobs) {
      if (m.kind !== 'boss' || !m.angry) continue;
      const cb = m.cb;
      if (cb && m.stunUntil > this.t) { m.pat = null; continue; }   // v532 기절 중엔 패턴 없음
      if (!m.pat && this.t >= (m.nextPat ??= this.t + 3000)) {
        let P;
        if (cb && cb.phase >= 2 && this.t >= (m.nextUlt || 0)) { P = CB_PATS.ult; m.nextUlt = this.t + CB.ultEveryMs; }
        else { const list = cb ? cb.pats.map((id) => CB_PATS[id]) : BOSS_PATS; P = list[this.rng.int(list.length)]; }
        let cx2 = P.shape === 'target' ? H.x : P.shape === 'line' ? m.x + Math.sign(H.x - m.x || 1) * P.w / 2 : m.x, w = P.w, safe = null;
        if (P.shape === 'ult') {   // 화면 전체 — 무인에게서 3~6미터 떨어진 안전 지대 하나
          const side = this.rng.int(2) ? 1 : -1, d = 3000 + this.rng.int(3000);
          let sc = H.x + side * d; if (sc < 1600 || sc > map.w - 1600) sc = H.x - side * d;
          sc = Math.max(1600, Math.min(map.w - 1600, sc));
          safe = [sc - P.safe / 2, sc + P.safe / 2]; cx2 = map.w / 2; w = map.w;
        }
        m.pat = { id: P.id, at: this.t, end: this.t + P.tellMs, x: cx2, y: m.y, w, dmgX: P.x, shape: P.shape, safe, move: P.move, n: P.n, dir: Math.sign(H.x - m.x) || 1 };
        this.events.push(['tell', this.t, m.id, P.id, cx2, m.y, w, P.tellMs, safe ? safe[0] : null, safe ? safe[1] : null]);
      }
      if (m.pat && this.t >= m.pat.end) {
        const q = m.pat; m.pat = null; m.nextPat = this.t + Math.round(BOSS_PAT_EVERY * (cb ? CB.patEveryX[cb.phase] : 1));
        if (q.shape === 'summon') {   // 졸개 — 두목 양옆에
          if (this.def.fams.a) for (let i = 0; i < q.n; i++) this.spawn('a', { p: m.plat, x: m.x + (i - 1) * 1300 });
          this.events.push(['summon', this.t, m.id, q.n]);
          continue;
        }
        if (q.move) { const p2 = map.plats[m.plat]; m.x = Math.max(p2.x0 + 300, Math.min(p2.x1 - 300, q.x + q.dir * q.w / 2 - q.dir * 600)); }   // 돌진: 범위 끝까지
        const inZ = (x) => (q.shape === 'ult' ? !(x >= q.safe[0] && x <= q.safe[1]) : Math.abs(x - q.x) <= q.w / 2 && Math.abs(H.y - q.y) <= SAME_Y + 600);
        const inside = inZ(H.x), inv = this.t < (H.invUntil || 0);
        this.events.push(['burst', this.t, m.id, q.id, q.x, q.y, q.w, inside && !inv ? 1 : 0]);
        // v546 완벽 회피 — 범위 안에서 터지기 직전(0.45초 안)에 회피를 눌러 맞지 않음
        if (H.dashAt != null && this.t - H.dashAt <= DASH.perfectMs && inZ(H.dashX0) && (!inside || inv)) { H.perfUntil = this.t + DASH.buffMs; this.perfects = (this.perfects || 0) + 1; this.events.push(['perfect', this.t, m.id]); }
        if (inside && !inv) {
          const r = hit({ ...m, st: { ...m.st, atk: Math.round(m.st.atk * q.dmgX) } }, H, SKILL_BASE, this.rng);
          H.hp -= r.dmg; this.dmgIn += r.dmg; this.events.push(['hurt', this.t, r.dmg]);
          if (H.hp <= 0) { this.deaths++; H.hp = H.st.hp; this.events.push(['die', this.t]); }
        }
      }
    }
    // ── 몹 ── 맞으면 같은 층에서 무인 쪽으로 와서 친다 · 아니면 발판 위를 서성
    for (const m of this.mobs) {
      const p = map.plats[m.plat];
      if (m.stunUntil > this.t) { m.spd = 0; m.moving = false; continue; }   // v532 기절
      // v628 궁사 화살에 밀림 — 화살이 닿는 때(kbAt)부터 발판 안에서 미끄러지고, 그때부터 stagMs 동안은 걷지도 치지도 못한다
      if (m.kbAt !== undefined && this.t >= m.kbAt) {
        if (m.kbX) { const st = Math.abs(m.kbX) <= 40 ? m.kbX : Math.round(m.kbX * 0.55); m.x += st; m.kbX -= st; if (m.x < p.x0 + 200) { m.x = p.x0 + 200; m.kbX = 0; } else if (m.x > p.x1 - 200) { m.x = p.x1 - 200; m.kbX = 0; } }
        if (this.t < m.stagUntil) { m.spd = 0; m.moving = false; continue; }
      }
      const same = Math.abs(m.y - H.y) <= SAME_Y, adx = Math.abs(H.x - m.x);
      // 화난 몹: 같은 층이면 붙어 친다 — 서는 거리는 몹마다 조금씩 달라(450~930mm) 한 자리에 겹쳐 서지 않는다(v501)
      //   (서는 거리 + 300 넘게 벌어져야 다시 쫓음 — 경계 떨림 없음)
      const reach = 450 + (m.id % 4) * 160;
      if (m.angry && same) {
        if (adx > reach + 300) m.chase = true; else if (adx <= reach) m.chase = false;
        m.dir = Math.sign(H.x - m.x) || m.dir;
      }
      let walk;
      if (m.angry && same) {
        walk = !!m.chase;
        // v506 줄 서기: 같은 쪽에서 무인에게 더 가까운 몹이 바로 앞(380mm 안)에 있으면 겹치지 않게 멈춘다
        if (walk) for (const o of this.mobs) if (o !== m && o.plat === m.plat && Math.sign(o.x - H.x) === Math.sign(m.x - H.x) && Math.abs(o.x - H.x) < adx && adx - Math.abs(o.x - H.x) < 380) { walk = false; break; }
      }
      else {
        // 서성임: 몇 초 걷고 잠깐 섰다가 방향을 고른다(매 순간 무작위로 뒤돌지 않게)
        if (this.t >= (m.nextTurn || 0)) { m.idle = !m.idle; m.nextTurn = this.t + (m.idle ? 800 + this.rng.int(1400) : 1600 + this.rng.int(2600)); if (!m.idle && this.rng.int(2)) m.dir = -m.dir; }
        walk = !m.idle;
      }
      // v506 걸음은 0.2초에 걸쳐 빨라지고 0.15초에 걸쳐 멈춘다(뚝 서고 뚝 떠나지 않게)
      m.spd = Math.max(0, Math.min(1000, (m.spd || 0) + (walk ? 250 : -340)));
      m.moving = m.spd > 0;
      if (m.spd > 0) {
        let v = m.dir * MOB_RUN * DT * (m.kind === 'boss' ? (m.cb?.phase ? 0.9 : 0.6) : 1) * m.spd;
        if (m.slowUntil > this.t && this.t >= m.slowAt) v *= RANGED.slow.x;   // v628 술사 기탄에 느려짐
        m.x += Math.round(v / 1000);
        if (m.x < p.x0 + 200) { m.x = p.x0 + 200; m.dir = 1; } else if (m.x > p.x1 - 200) { m.x = p.x1 - 200; m.dir = -1; }
      }
      if (walk) { /* 걷는 중 */ } else if (m.angry && same && adx <= reach + 100 && this.t >= m.nextAtk && H.plat >= 0) {
        const r = hit(m, H, SKILL_BASE, this.rng);
        H.hp -= r.dmg; this.dmgIn += r.dmg; m.nextAtk = this.t + Math.round(m.atkMs * (m.cb?.phase ? 0.75 : 1));
        this.events.push(['hurt', this.t, r.dmg]);
        if (H.hp <= 0) { this.deaths++; H.hp = H.st.hp; this.events.push(['die', this.t]); for (const k of this.mobs) { k.angry = false; k.pat = null; } }   // v527 쓰러지면 두목 예고도 거둔다(남은 붉은 범위를 영원히 피하며 제자리에서 흔들리던 것)
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
        // v512 열에 일곱은 무인이 서 있는 층에(옆으로 걸어가 잡게) — 층마다 흩어져 1초마다 오르내리던 것
        const hy = H.plat >= 0 ? map.plats[H.plat].y : H.y, mine = far.filter((s) => Math.abs(map.plats[s.p].y - hy) < 300);
        const pool = mine.length && this.rng.int(10) < 7 ? mine : far.length ? far : map.spots;
        this.spawn(f, pool[this.rng.int(pool.length)]);
      }
    }
  }
  // ── 무공 세트(v493) ── 자동이면 칸 순서대로(자동 켠 것만) 준비된 것 하나 · 수동이면 누른 칸 · 무공 사이 0.35초
  castKit(tgt, J) {
    const H = this.hero, kit = H.kit || [];
    if (!kit.length || this.t < (H.gcd || 0)) return false;
    H.cds ??= kit.map(() => 0);
    let i = -1;
    const want = this.wantSlot;
    if (want !== undefined) {
      i = want >= 0 ? (this.t >= H.cds[want] && kit[want] ? want : -1) : kit.findIndex((k, j) => k.kind === 'active' && this.t >= H.cds[j]);
      this.wantSlot = undefined;
    }
    if (i < 0 && this.auto) i = kit.findIndex((k, j) => k.auto && this.t >= H.cds[j] && (k.kind === 'buff' || k.kind === 'active'));
    if (i < 0) return false;
    const k = kit[i];
    H.cds[i] = this.t + k.cdMs; H.gcd = this.t + 350; H.act = 'skill';
    H.lockUntil = this.t + 260 + (skillById(k.id)?.tier || 0) * 50;   // v507 무공 쓰는 동안 제자리
    if (k.kind === 'buff') {
      (H.buffs ??= []).push({ until: this.t + k.durMs, stats: k.buff, id: k.id });
      this.restat();
      this.events.push(k.vr ? ['buff', this.t, k.id, k.fx] : ['buff', this.t, k.id]);
      return true;
    }
    const R = J.range * k.range, face = H.face, fx = k.vr ? k.fx : null;
    const ts = this.kitTargets(k, R, face, tgt);
    this.events.push(fx ? ['cast', this.t, k.id, face, H.x, H.y, k.shape, R, fx, tgt ? tgt.x : H.x] : ['cast', this.t, k.id, face, H.x, H.y, k.shape, R]);   // v632 변형이면 [8] 그 움직임 · [9] 표적 자리
    if (J.range >= RANGED.minRange) this.rgShape = k.shape;   // v628 화살로 날아가는 무공인지(밀림이 닿는 때)
    if (fx === 'pull') this.kitPull(ts, R);
    // v632 연속 회전 · 두 번 내림 — 연타를 나눠 뒤에 다시 고른 대상에게(새로 다가온 몹도)
    const waves = fx === 'spin' ? 4 : fx === 'wave' ? 2 : 1, gap = fx === 'spin' ? 300 : 700;
    const per = (w) => Math.floor(k.hits / waves) + (w < k.hits % waves ? 1 : 0);
    this.kitHit(k, ts, per(0), 0);
    for (let w = 1, h0 = per(0); w < waves; h0 += per(w), w++) if (per(w)) (this.kq ??= []).push({ at: this.t + w * gap, k, n: per(w), h0, R });
    return true;
  }
  // v632 무공이 닿는 몹 — 모양 · 변형대로(fork 위 · 아래 층까지 · twin 앞뒤 · pull 둘레 +30% · back 두목 먼저 · focus 표적 둘레)
  kitTargets(k, R, face, tgt) {
    const H = this.hero, fx = k.vr ? k.fx : null, Rs = fx === 'pull' ? R + Math.min(R * 0.3, 1500) : R;   // 끌어당김은 둘레 +30%(1.5m까지)
    const dyMax = SAME_Y + (k.shape === 'circle' ? 600 : 0) + (fx === 'fork' ? 2700 : 0);
    const inShape = (m) => {
      if (Math.abs(m.y - H.y) > dyMax) return false;
      const dx = m.x - H.x;
      if (k.shape === 'circle' || fx === 'twin') return Math.abs(dx) <= Rs;
      return dx * face >= -300 && Math.abs(dx) <= Rs;
    };
    const near = (m) => Math.abs(m.x - H.x) + (fx === 'fork' ? Math.abs(m.y - H.y) * 0.5 : 0);
    let sortBy = (a, b) => near(a) - near(b);
    if (fx === 'back') { const P = { boss: 0, elite: 1 }; sortBy = (a, b) => (P[a.kind] ?? 2) - (P[b.kind] ?? 2) || near(a) - near(b); }
    if (fx === 'focus' && tgt) { const c = tgt.x; sortBy = (a, b) => (b === tgt) - (a === tgt) || Math.abs(a.x - c) - Math.abs(b.x - c); }
    return this.mobs.filter(inShape).sort(sortBy).slice(0, k.maxT);
  }
  kitHit(k, ts, n, h0) {
    const H = this.hero, sk = { coef: k.coef, base: false };
    if (k.p0 && k.hits > k.p0.hits) sk.gg = Math.round(CB.ggPerHit * k.p0.hits / k.hits);   // 연타를 늘린 변형도 무력화 게이지는 한 번 쓸 때 그대로
    const att = k.crit ? { ...H, st: { ...H.st, crit: (H.st.crit || 0) + k.crit } } : null;   // 트리 극의: 이 무공만 치명 ↑
    for (let h = 0; h < n; h++) for (const m of ts) if (m.hp > 0) this.strike(m, sk, h0 + h, att);
  }
  // 끌어당김 — 같은 발판의 졸개 · 정예를 무인 둘레(사거리 35%)까지 밀림으로 끌어온다(두목은 버틴다)
  kitPull(ts, R) {
    const H = this.hero, keep = Math.round(R * 0.35);
    for (const m of ts) { if (m.kind === 'boss') continue; const dx = m.x - H.x, ad = Math.abs(dx); if (ad > keep) m.kbX = (m.kbX || 0) - Math.sign(dx) * (ad - keep); }
  }
  // 나눠 친 연타(spin · wave) — 때가 되면 그때 무인 자리 · 바라보는 쪽으로 다시 골라 친다
  kitPend() {
    if (!this.kq?.length) return;
    const H = this.hero;
    this.kq = this.kq.filter((q) => {
      if (this.t < q.at) return true;
      if (H.hp > 0) this.kitHit(q.k, this.kitTargets(q.k, q.R, H.face, this.mobs.find((m) => m.id === H.target)), q.n, q.h0);
      return false;
    });
  }
  // 버프를 스탯에 얹는다(기본 스탯은 H.st0에 남겨 둠)
  restat() {
    const H = this.hero;
    H.st0 ??= H.st;
    const st = { ...H.st0 };
    for (const b of H.buffs || []) for (const [key, v] of Object.entries(b.stats)) st[key] = (st[key] || 0) + v;
    H.st = st;
  }
  strike(m, skill, hitNo = 0, att = null) {
    const r = hit(att || this.hero, m, skill, this.rng);
    if (m.stunUntil > this.t) r.dmg = Math.round(r.dmg * CB.stunDmgX);   // v532 기절한 두목은 피해 ×2
    if (m.cb?.wb) r.dmg = Math.round(r.dmg * (this.wbWeak() ? WBF.weakX : WBF.guardX));
    if (!att && !skill.pal && this.t < (this.hero.perfUntil || 0)) r.dmg = Math.round(r.dmg * DASH.buffX);   // v546 완벽 회피 뒤 4초   // v535 월드보스: 방어 자세 ×0.6 · 약점 ×1.8
    m.hp -= r.dmg; m.angry = true; this.dmgOut += r.dmg; if (r.crit) this.crits++;
    const cb = m.cb;
    if (cb && m.hp > 0) {
      if (!skill.base && !skill.pal && !(m.stunUntil > this.t)) { cb.gg += this.stunAdd(skill.gg ?? CB.ggPerHit); if (cb.gg >= 1000) { cb.gg = 0; m.stunUntil = this.t + CB.stunMs; m.pat = null; this.events.push(['stun', this.t, m.id, CB.stunMs]); } }
      const ratio = m.hp / m.st.hp, ph = ratio <= CB.phase[1] ? 2 : ratio <= CB.phase[0] ? 1 : 0;
      if (ph > cb.phase) { cb.phase = ph; m.nextPat = Math.min(m.nextPat ?? this.t, this.t + 900); if (ph === 2) m.nextUlt = this.t + 1200; this.events.push(['phase', this.t, m.id, ph]); }
    }
    this.events.push(['hit', this.t, m.id, r.dmg, r.crit ? 1 : 0, skill.pal ? 2 : skill.base ? 0 : 1, hitNo]);
    if (m.hp <= 0) {
      this.kills++; this.killsBy[m.kind] = (this.killsBy[m.kind] || 0) + 1;
      this.events.push(['kill', this.t, m.id, m.kind, this.t - m.bornAt]);
      this.killHeal();   // v635 기질
      this.mobs = this.mobs.filter((x) => x !== m);
      if (this.hero.target === m.id) this.hero.target = -1;
    }
    if (m.hp > 0 && !skill.pal && JOBS[this.hero.job].range >= RANGED.minRange) this.rgPush(m, skill, hitNo);   // v628
  }
  // ── v635 고유 기질(tables/traits.js) — 평타가 옆 적 하나 더(splash 퍼밀 피해) · 무력화 게이지 + · 처치마다 체력 회복 ──
  splashHit(tgt, J) {
    const H = this.hero, sp = H.st.splash || 0;
    if (sp <= 0) return;
    const m = this.mobs.filter((x) => x !== tgt && x.hp > 0 && Math.abs(x.y - H.y) <= SAME_Y && Math.abs(x.x - tgt.x) <= J.range).sort((a, b) => Math.abs(a.x - tgt.x) - Math.abs(b.x - tgt.x))[0];
    if (m) this.strike(m, { ...SKILL_BASE, coef: Math.round(SKILL_BASE.coef * sp / 1000) }, 1);
  }
  stunAdd(n) { return Math.round(n * (1000 + (this.hero.st.stunGg || 0)) / 1000); }
  killHeal() { const H = this.hero, p = Math.min(KILL_HEAL_CAP, H.st.killHeal || 0); if (p > 0 && H.hp > 0 && H.hp < H.st.hp) H.hp = Math.min(H.st.hp, H.hp + Math.floor((H.st.hp * p) / 1000)); }
  // ── v628 원거리(궁사 · 술사) — 뒤로 뛰기 · 화살 밀어내기 · 기탄 느려짐(숫자: tables/char.js RANGED) ──
  // 뛰기(자동만): 같은 발판의 화난 몹이 near 안 · 발판 위 · 평타 · 무공 · 회피 중 아님 · 쿨 끝 → 몹 반대쪽으로 dist(무인은 몹을 본 채).
  //   내려설 자리가 발판 끝에서 margin 안쪽이고, 뛰고 나면 화난 몹과 gain 넘게 벌어질 때만(몰렸으면 안 뜀) · 두목 붉은 범위 안으로는 안 뜀
  rgHop(map) {
    const H = this.hero, R = RANGED.hop;
    if (H.plat < 0 || this.t < (H.lockUntil || 0) || this.t < (H.hopReady || 0) || this.t < (H.dashUntil || 0)) return false;
    let nd = Infinity, nx = 0;
    for (const m of this.mobs) if (m.angry && m.plat === H.plat) { const d = Math.abs(m.x - H.x); if (d < nd) { nd = d; nx = m.x; } }
    if (nd >= R.near) return false;
    const dir = Math.sign(H.x - nx) || -(H.face || 1), p = map.plats[H.plat];
    const edge = Math.min(R.edge, Math.round(map.w * R.edgeX)), lo = Math.max(p.x0 + R.margin, edge), hi = Math.min(p.x1 - R.margin, map.w - edge);
    if (lo > hi) return false;   // 맵 끝 가까이의 짧은 발판 — 내려설 자리가 없다
    const land = Math.max(lo, Math.min(hi, H.x + dir * R.dist)), len = (land - H.x) * dir;
    if (len < R.min) return false;   // 몰렸다
    let after = Infinity;
    for (const m of this.mobs) if (m.angry && m.plat === H.plat) after = Math.min(after, Math.abs(m.x - land));
    if (after < nd + R.gain || this.rgInTell(land)) return false;
    H.hopAt = this.t; H.hopX0 = H.x; H.hopDir = dir; H.hopLen = len; H.hopUntil = this.t + R.wind + R.ms; H.hopReady = this.t + R.cdMs;
    H.face = -dir; H.spd = 0; H.closing = false;
    this.hops = (this.hops || 0) + 1;
    this.events.push(['hop', this.t, dir]);
    return true;
  }
  // 그 자리가 지금 두목 패턴의 붉은 범위 안인가(필살은 안전 지대 밖이면 안)
  rgInTell(x) {
    for (const m of this.mobs) {
      const q = m.pat; if (!q || this.t > q.end || q.shape === 'summon') continue;
      if (q.shape === 'ult') { if (!(x >= q.safe[0] + 300 && x <= q.safe[1] - 300)) return true; continue; }
      if (Math.abs(this.hero.y - q.y) <= SAME_Y + 600 && Math.abs(x - q.x) <= q.w / 2 + 250) return true;
    }
    return false;
  }
  // 맞은 몹(살아 있으면): 궁사 — 평타 · 무공(한 번 쓸 때 몹마다 첫 대만)이 무인 반대쪽으로 민다(정예 반 · 두목 안 밀림) / 술사 — 평타 기탄이 걸음을 늦춘다(두목 빼고)
  rgPush(m, skill, hitNo) {
    const H = this.hero, adx = Math.abs(m.x - H.x);
    if (H.job === 'bow') {
      if (m.kind === 'boss' || (!skill.base && hitNo > 0)) return;
      const K = RANGED.kb, d = Math.round((skill.base ? K.base : K.skill) * (m.kind === 'elite' ? K.eliteX : 1));
      const at = this.t + this.rgFly(adx, skill.base || this.rgShape === 'line' || this.rgShape === 'arc' ? K.v : 0);
      if (!(m.kbX || m.stagUntil > this.t)) m.kbAt = at;   // 새로 밀림: 화살이 닿는 때부터(밀리는 중이면 이어서 더 민다)
      m.kbX = Math.max(-2 * K.skill, Math.min(2 * K.skill, (m.kbX || 0) + (Math.sign(m.x - H.x) || H.face || 1) * d));
      m.stagUntil = Math.max(m.stagUntil || 0, at + K.stagMs); m.kbHit = this.t; m.kbN = d;
      m.chase = true;   // 밀려난 뒤 다시 다가온다(치지도 쫓지도 않는 틈에 서 있지 않게)
    } else if (H.job === 'mage' && skill.base && m.kind !== 'boss') {
      const S = RANGED.slow, at = this.t + this.rgFly(adx, S.v);
      if (m.slowUntil > this.t) m.slowUntil = Math.max(m.slowUntil, at + S.ms); else { m.slowAt = at; m.slowUntil = at + S.ms; }
    }
  }
  // 화살 · 기탄이 닿기까지(ms, 50ms 단위) — 화면이 날려 보내는 빠르기(mm/ms)와 같게. v 없음: 날아가지 않는 무공(0.1초)
  rgFly(adx, v) { return v ? Math.min(250, Math.ceil(Math.max(80, (adx - 350) / v) / TICK_MS) * TICK_MS) : 100; }
  wbWeak() { return this.t % WBF.cycleMs >= WBF.guardMs; }
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
