// v374 월드보스 탄막 — 칠대성(七大聖)이 쏟아내는 탄을 피하며 친다.
//
// 월드보스 판(inst.kind === 'wraid') 안에서만 돈다. 칸 단위로 걷는 평소 사냥과 달리 무인이 **자유롭게** 움직인다.
//   움직임: 키보드(WASD·화살표 → g.shIn) · 조이스틱(g.joy) · 누른 자리(g.shTarget). 아무 손도 없으면 **자동 회피**(방치용 — 가끔 맞는다).
//   공격: 제 사거리에 들어야 친다 — 근거리 직업은 마왕 코앞(탄이 빽빽한 곳)까지 붙고, 원거리 직업은 멀리서 쏜다.
//         마왕은 몸이 커서 사거리에 BODY칸을 더한다. 자동 회피도 직업 사거리에 맞는 자리를 지킨다.
//   두목: 위 가운데에 버티고 서서 패턴을 돌린다. 반·1/5 아래면 분노·광폭(탄이 빠르고 빽빽해진다).
//   탄: 맞으면 최대 체력의 몇 %(레벨과 상관없이 피하는 게 중요하다) · 맞은 뒤 0.6초 무적.
// 순수 셈만 — 그리는 쪽(battle.js)이 g.bullets를 그린다.
import * as W from './wdata.js';
import * as D from './wdgn.js';

export const ARENA = { x0: 40, x1: W.COLS * W.TILE - 40, y1: W.ROWS * W.TILE - 80 };
export const BOSS_C = Math.floor(W.COLS / 2), BOSS_R = 7;          // 두목 자리(칸)
export const HERO_R = 13;                                        // 무인 맞는 크기(작게 — 탄막답게)
// v378 탄막 밀도 — 폰은 화면이 좁아 촘촘하면 못 피한다. dens 탄 수 · spd 빠르기 · hit 맞는 크기 배율(무인·탄 둘 다)
export const EASE = {
  dense: { name: '촘촘', dens: 1, spd: 1, hit: 1 },
  normal: { name: '보통', dens: 0.8, spd: 0.92, hit: 0.85 },
  roomy: { name: '여유', dens: 0.6, spd: 0.85, hit: 0.7 },
};
const ease = (g) => EASE[g.shEase] || EASE.dense;
// v378 스침(그레이즈) — 맞지 않고 이만큼 가까이 스치면 집중이 GRAZE_T초 빨리 찬다(탄 하나에 한 번)
export const GRAZE_PAD = 20;
export const GRAZE_T = 0.6;
// v378 칠십이변(대성신장 7) — WK_SEC초마다 분신 방패 한 장(최대 WK_MAX) · 탄 한 대를 대신 맞는다
export const WK_SEC = 15;
export const WK_MAX = 2;
export const IFRAME = 0.6;
export const HIT_PCT = 0.07;                                     // 탄 한 대 = 최대 체력의 7%(큰 탄은 2배)
export const SPEED = 250;
export const KEEP = 330;                                          // 원거리 자동 회피가 두목과 두는 거리
export const BODY = 120;                                          // 마왕 몸 크기(px) — 사거리에 더한다
export const MAX_BULLETS = 420;
// v377 집중(集中) — 손으로 피하는 동안 FOCUS_SEC초 안 맞을 때마다 한 겹(최대 FOCUS_MAX) · 겹마다 마왕에게 주는 피해 +FOCUS_K.
//   맞으면 모두 흩어지고, 손을 놓아(자동 회피) 두면 FOCUS_DECAY초마다 한 겹씩 빠진다 — 방치보다 손으로 피하는 게 이득.
export const FOCUS_SEC = 3;
export const FOCUS_MAX = 10;
export const FOCUS_K = 0.05;
export const FOCUS_DECAY = 2;

const rnd = (g) => g.rng();
const ang = (x0, y0, x1, y1) => Math.atan2(y1 - y0, x1 - x0);

export function start(g) {
  g.bullets = [];
  g.emitters = [];
  g.shPatT = 2.4;
  g.shIframe = 0;
  g.shIdle = 9;
  g.shIn = null;
  g.shTarget = null;
  g.shPatIdx = 0;
  g.shHits = 0;
  g.shFocus = 0; g.shFocusT = 0; g.shHand = 99; g.shGraze = 0;
  g.shWk = g.setBonus().wukong ? 1 : 0; g.shWkT = 0;
  g.heroX = W.tileCenter(BOSS_C);
  g.heroY = W.tileCenter(BOSS_R) + 440;
  syncTile(g);
}
function syncTile(g) {
  g.hc = Math.max(0, Math.min(W.COLS - 1, Math.floor(g.heroX / W.TILE)));
  g.hr = Math.max(0, Math.min(W.ROWS - 1, Math.floor(g.heroY / W.TILE)));
  g.hmove = null;
}
// 두목 몸통 가운데(그림이 커서 발밑보다 위)
const core = (b) => ({ x: b.x, y: b.y - 90 });
// 닿는 거리(px) — 제 사거리 + 마왕 몸
export const reach = (st) => (st.range || 70) + BODY;
export const inReach = (g, b, st) => Math.hypot(g.heroX - b.x, g.heroY - (b.y - 40)) <= reach(st);

// ---------- 무인 ----------
function steer(g, b, dt, st) {
  let vx = 0, vy = 0, manual = false;
  if (g.shIn && (g.shIn.dx || g.shIn.dy)) { vx = g.shIn.dx; vy = g.shIn.dy; manual = true; g.shTarget = null; }
  else if (g.shPush && (g.shPush.x || g.shPush.y)) {
    // v377 손가락 따라 — 끈 만큼 그대로(한 번에 너무 멀리는 못 간다)
    const max = SPEED * 2.2 * (g.shSens || 1) * dt, d = Math.hypot(g.shPush.x, g.shPush.y), k = Math.min(1, max / d);
    g.heroX += g.shPush.x * k; g.heroY += g.shPush.y * k; g.shPush.x -= g.shPush.x * k; g.shPush.y -= g.shPush.y * k;
    if (Math.hypot(g.shPush.x, g.shPush.y) < 0.5) g.shPush = null;
    manual = true; g.shTarget = null; g.walking = true;
  } else if (g.joy) {
    // v377 아날로그 — 조금 끌면 천천히, 끝까지 끌면 제 빠르기
    const d = Math.hypot(g.joy.dx, g.joy.dy) || 1, m = Math.min(1, d / 42);
    vx = (g.joy.dx / d) * m; vy = (g.joy.dy / d) * m; manual = true; g.shTarget = null;
  }
  else if (g.shTarget) {
    const dx = g.shTarget.x - g.heroX, dy = g.shTarget.y - g.heroY, d = Math.hypot(dx, dy);
    if (d < 6) g.shTarget = null; else { vx = dx / d; vy = dy / d; manual = true; }
  }
  if (!manual && g.shHold) manual = true;   // 손가락을 대고 멈춰 있으면 그 자리(자동 회피로 넘기지 않는다)
  if (manual) g.shIdle = 0; else g.shIdle += dt;
  // 집중 — 손으로 움직인 지 1초 안이면 쌓이고, 아니면 빠진다
  g.shHand = manual ? 0 : (g.shHand || 0) + dt;
  g.shFocusT = (g.shFocusT || 0) + dt;
  if (g.shHand < 1) {
    if (g.shFocusT >= FOCUS_SEC && (g.shFocus || 0) < FOCUS_MAX) { g.shFocusT = 0; g.shFocus = (g.shFocus || 0) + 1; if (g.shFocus === 5 || g.shFocus === FOCUS_MAX) g.emit('wbFocus', { n: g.shFocus }); }
  } else if (g.shFocusT >= FOCUS_DECAY && g.shFocus > 0) { g.shFocusT = 0; g.shFocus--; }
  // 손을 놓은 지 0.8초가 지나면 자동 회피
  if (!manual && g.shIdle > 0.8) [vx, vy] = autoDir(g, b, st);
  const n = Math.hypot(vx, vy);
  if (manual && !(vx || vy)) { /* 손가락 따라 — 위에서 옮겼다 */ } else if (n > 0.05) {
    const sp = SPEED * Math.min(1.5, Math.max(1, st.moveSpeed || 1)) * (manual ? (g.shSens || 1) : 0.85);   // v377 손 조작 감도(설정)
    g.heroX += (vx / Math.max(1, n)) * sp * dt;
    g.heroY += (vy / Math.max(1, n)) * sp * dt;
    g.walking = true;
  } else g.walking = false;
  // 마당 안 · 두목 몸에는 못 들어간다
  const c = core(b);
  g.heroX = Math.max(ARENA.x0, Math.min(ARENA.x1, g.heroX));
  g.heroY = Math.max(b.y + 70, Math.min(ARENA.y1, g.heroY));
  const dx = g.heroX - c.x, dy = g.heroY - c.y, d = Math.hypot(dx, dy);
  if (d < 150) { g.heroX = c.x + (dx / (d || 1)) * 150; g.heroY = c.y + (dy / (d || 1)) * 150; }
  syncTile(g);
}
// 자동 회피 — 두목과 알맞은 거리(KEEP)의 자리로 가면서, 0.5초 안에 닿을 탄에서 비켜선다
export function autoDir(g, b, st = g.stats()) {
  const c = core(b);
  const t = g.clock || 0;
  // 근거리는 사거리 안쪽(마왕 발치) · 원거리는 KEEP — 좌우로 천천히 흔들며
  const far = g.ranged() ? Math.min(KEEP, reach(st) - 40) : Math.max(110, reach(st) - 45);
  const sw = g.ranged() ? 170 : 70;
  const ax = b.x + Math.sin(t * 0.35) * sw, ay = b.y - 40 + far;
  let vx = (ax - g.heroX) / 120, vy = (ay - g.heroY) / 120;
  const m0 = Math.hypot(vx, vy); if (m0 > 0.6) { vx *= 0.6 / m0; vy *= 0.6 / m0; }
  for (const u of g.bullets) {
    const rx = g.heroX - u.x, ry = g.heroY - u.y;
    if (Math.abs(rx) > 170 || Math.abs(ry) > 170) continue;
    // 가장 가까워지는 때(0~0.5초)와 그때 거리
    const vv = u.vx * u.vx + u.vy * u.vy || 1;
    const tc = Math.max(0, Math.min(0.5, (rx * u.vx + ry * u.vy) / vv));
    const px = rx - u.vx * tc, py = ry - u.vy * tc, pd = Math.hypot(px, py);
    const need = u.r + HERO_R + 22;
    if (pd > need) continue;
    const w = (1 - pd / need) * (1.4 - tc * 2) * 2.2;
    // 탄이 가는 쪽의 옆으로(가까운 쪽) 비켜선다
    const s = Math.hypot(u.vx, u.vy) || 1;
    let sx = -u.vy / s, sy = u.vx / s;
    if (sx * px + sy * py < 0) { sx = -sx; sy = -sy; }
    vx += sx * w + (px / (pd || 1)) * w * 0.5; vy += sy * w + (py / (pd || 1)) * w * 0.5;
  }
  // 벽에 몰리지 않게
  if (g.heroX < ARENA.x0 + 50) vx += 0.8; if (g.heroX > ARENA.x1 - 50) vx -= 0.8;
  if (g.heroY > ARENA.y1 - 40) vy -= 0.8;
  return [vx, vy];
}

// ---------- 패턴 ----------
// 탄 하나: x,y 자리 · vx,vy 빠르기 · r 크기 · big 큰 탄(피해 2배) · kind 생김새 · t 살아온 초
function shoot(g, o) {
  if (g.bullets.length >= MAX_BULLETS) return;
  g.bullets.push({ t: 0, r: 9, ...o });
}
function rageK(g) {
  const k0 = D.WRAID_RAGE[Math.max(0, g.inst?.rage || 0)];
  const k = g.map?.final ? { ...k0, atk: k0.atk * D.OK_K.atk, spd: k0.spd * D.OK_K.spd, dens: k0.dens * D.OK_K.dens } : k0;   // v375 옥황상제는 한 단 더
  const e = ease(g);   // v378 밀도(설정)
  return { ...k, spd: k.spd * e.spd, dens: k.dens * e.dens };
}
const PAT = {
  // 한꺼번에 둥글게
  ring(g, b, P, k) {
    const c = core(b), n = Math.round((P.big ? 14 : 22) * k.dens), off = rnd(g) * Math.PI;
    for (let w = 0; w < 2; w++) g.emitters.push({ at: w * 0.45, fn: () => { for (let i = 0; i < n; i++) { const a = off + (i + w * 0.5) / n * Math.PI * 2; shoot(g, { x: c.x, y: c.y, vx: Math.cos(a) * 165 * k.spd, vy: Math.sin(a) * 165 * k.spd, r: P.big ? 14 : 9, big: !!P.big, kind: P.shot }); } } });
    return 1.6;
  },
  // 돌며 뿜기
  spiral(g, b, P, k) {
    const c = core(b), arms = P.arms || 3, dir = rnd(g) < 0.5 ? 1 : -1;
    let a = rnd(g) * Math.PI * 2;
    const T = 2.6, gap = 0.085 / k.dens;
    for (let t = 0; t < T; t += gap) g.emitters.push({ at: t, fn: () => { a += 0.23 * dir; for (let i = 0; i < arms; i++) { const q = a + i / arms * Math.PI * 2; shoot(g, { x: c.x, y: c.y, vx: Math.cos(q) * 150 * k.spd, vy: Math.sin(q) * 150 * k.spd, kind: P.shot }); } } });
    return T + 0.6;
  },
  // 무인을 노리고 부채꼴 세 번
  fan(g, b, P, k) {
    const c = core(b), n = Math.round(7 * k.dens) | 1;
    for (let v = 0; v < 3; v++) g.emitters.push({ at: v * 0.38, fn: () => { const a0 = ang(c.x, c.y, g.heroX, g.heroY); for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.13; shoot(g, { x: c.x, y: c.y, vx: Math.cos(a) * 235 * k.spd, vy: Math.sin(a) * 235 * k.spd, r: 8, kind: P.shot }); } } });
    return 1.7;
  },
  // 위에서 쏟아짐
  rain(g, b, P, k) {
    const T = 2.8, gap = 0.075 / k.dens, top = b.y - 40;
    for (let t = 0; t < T; t += gap) g.emitters.push({ at: t, fn: () => { const x = ARENA.x0 + rnd(g) * (ARENA.x1 - ARENA.x0); shoot(g, { x, y: top, vx: (rnd(g) - 0.5) * 40, vy: (190 + rnd(g) * 70) * k.spd, kind: P.shot }); } });
    return T + 0.8;
  },
  // 출렁이는 물결 넷 줄
  wave(g, b, P, k) {
    const T = 2.6, gap = 0.12 / k.dens, top = b.y - 20, cols = 5;
    for (let t = 0; t < T; t += gap) g.emitters.push({ at: t, fn: () => { for (let i = 0; i < cols; i++) { const x = ARENA.x0 + (i + 0.5) / cols * (ARENA.x1 - ARENA.x0); shoot(g, { x, y: top, vx: 0, vy: 170 * k.spd, wav: { x0: x, amp: 70, ph: i * 1.3 + t * 2 }, kind: P.shot }); } } });
    return T + 1;
  },
  // 큰 탄 셋 — 1초 뒤 터져 고리
  burst(g, b, P, k) {
    const c = core(b);
    for (let v = 0; v < 3; v++) g.emitters.push({ at: v * 0.5, fn: () => { const a = ang(c.x, c.y, g.heroX, g.heroY) + (v - 1) * 0.5; shoot(g, { x: c.x, y: c.y, vx: Math.cos(a) * 140 * k.spd, vy: Math.sin(a) * 140 * k.spd, r: 18, big: true, split: 1.1, kind: P.shot }); } });
    return 2.6;
  },
  // 네 갈래 십자 — 빽빽한 줄이 돈다
  cross(g, b, P, k) {
    const c = core(b), dir = rnd(g) < 0.5 ? 1 : -1;
    let a = rnd(g) * Math.PI;
    const T = 2.4, gap = 0.05 / k.dens;
    for (let t = 0; t < T; t += gap) g.emitters.push({ at: t, fn: () => { a += 0.045 * dir; for (let i = 0; i < 4; i++) { const q = a + i * Math.PI / 2; shoot(g, { x: c.x, y: c.y, vx: Math.cos(q) * 210 * k.spd, vy: Math.sin(q) * 210 * k.spd, r: 7, kind: P.shot }); } } });
    return T + 0.6;
  },
  // 쫓아오는 혼 — 2초 동안 무인을 향해 휜다
  homing(g, b, P, k) {
    const c = core(b), n = Math.round(6 * k.dens);
    for (let i = 0; i < n; i++) g.emitters.push({ at: i * 0.18, fn: () => { const a = Math.PI * (0.15 + 0.7 * (i / Math.max(1, n - 1))); shoot(g, { x: c.x, y: c.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 12, home: 2.2, sp: 150 * k.spd, kind: P.shot }); } });
    return 2.8;
  },
};
// v378 석가여래 — 손바닥 안: 무인 둘레 큰 원에서 안으로 좁혀 오는 탄(빈틈 한 군데)
PAT.palm = function (g, b, P, k) {
  const n = Math.round(26 * k.dens);
  for (let w = 0; w < 3; w++) g.emitters.push({ at: w * 0.9, fn: () => {
    const R = 430, gap = rnd(g) * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.42) continue;   // 빈틈
      const x = g.heroX + Math.cos(a) * R, y = g.heroY - 26 + Math.sin(a) * R;
      shoot(g, { x, y, vx: -Math.cos(a) * 120 * k.spd, vy: -Math.sin(a) * 120 * k.spd, r: 10, kind: P.shot, life: 4.2 });
    }
  } });
  return 3.6;
};
export const PATTERNS = Object.keys(PAT);

function pickPattern(g, b) {
  const boss = D.WRAID_BOSS[b.wb] || D.WRAID_BOSSES[0];
  const list = boss.pats;
  const p = list[g.shPatIdx % list.length];
  g.shPatIdx++;
  const k = rageK(g);
  const P = { ...p, shot: p.shot || boss.shot };
  const dur = PAT[P.p](g, b, P, { spd: k.spd, dens: k.dens });
  g.emit('wbPattern', { name: P.name, rage: g.inst?.rage || 0, col: boss.col });
  return dur;
}

// ---------- 매 틱 ----------
// 집중이 주는 피해 배율
export const focusMult = (g) => 1 + FOCUS_K * (g.shFocus || 0);
export function tick(g, dt, st) {
  const I = g.inst;
  const b = I.boss && I.boss.alive ? I.boss : null;
  if (!b) { g.walking = false; return; }
  steer(g, b, dt, st);
  g.heroAngle = Math.atan2((b.y - 90 - g.heroY) * 0.6, b.x - g.heroX);
  if (Math.abs(b.x - g.heroX) > 6) g.heroFacing = b.x >= g.heroX ? 1 : -1;
  g.mon = b;
  if (b.introT > 0) return;
  // 패턴
  g.shPatT -= dt;
  if (g.shPatT <= 0 && !g.emitters.length) g.shPatT = pickPattern(g, b) + 0.5 / rageK(g).dens;
  for (const e of g.emitters) { e.at -= dt; if (e.at <= 0) { e.fn(); e.done = true; } }
  if (g.emitters.length) g.emitters = g.emitters.filter((e) => !e.done);
  tickBullets(g, dt, st);
  if (g.setBonus().wukong && g.shWk < WK_MAX && (g.shWkT = (g.shWkT || 0) + dt) >= WK_SEC) { g.shWkT = 0; g.shWk++; g.emit('wukongReady', { n: g.shWk }); }
  // 친다 — 제 사거리(+마왕 몸) 안에 들었을 때만. 근거리는 붙어야, 원거리는 멀리서
  g.atkTimer = Math.max(0, g.atkTimer - dt);
  const near = inReach(g, b, st);
  g.shNear = near;
  if (!near) return;
  if (g.s.autoSkill) { g._shReach = true; try { g.autoSkills(st); } finally { g._shReach = false; } }
  if (g.atkTimer <= 0 && b.alive) {
    const iv = st.atkSec / (g.frenzyT > 0 ? 1.5 : 1) / (1 + (g.buffv.haste || 0));
    g.atkTimer = iv;
    g._atkAt = g.clock;
    if (g.ranged()) g.emit('wbShot', { x0: g.heroX, y0: g.heroY - 40, x1: b.x + (rnd(g) - 0.5) * 60, y1: b.y - 90 - rnd(g) * 80 });
    g.basicAttack(b, st, g.ranged() ? 99 : 1);
  }
}

function tickBullets(g, dt, st) {
  if (g.shIframe > 0) g.shIframe -= dt;
  const out = [];
  for (const u of g.bullets) {
    u.t += dt;
    if (u.home > 0) {
      u.home -= dt;
      const a = ang(u.x, u.y, g.heroX, g.heroY), cur = Math.atan2(u.vy, u.vx);
      let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const na = cur + Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
      u.vx = Math.cos(na) * u.sp; u.vy = Math.sin(na) * u.sp;
    }
    if (u.wav) { u.y += u.vy * dt; u.x = u.wav.x0 + Math.sin(u.t * 2.4 + u.wav.ph) * u.wav.amp; }
    else { u.x += u.vx * dt; u.y += u.vy * dt; }
    if (u.split && u.t >= u.split) {
      const n = 12;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + u.t; out.push({ t: 0, x: u.x, y: u.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 8, kind: u.kind }); }
      g.emit('wbSplit', { x: u.x, y: u.y, kind: u.kind });
      continue;
    }
    if (u.x < -60 || u.x > W.COLS * W.TILE + 60 || u.y < -60 || u.y > W.ROWS * W.TILE + 60 || u.t > (u.life || 9)) continue;
    // 맞음
    const hd = Math.hypot(u.x - g.heroX, u.y - (g.heroY - 26)), hr = (u.r + HERO_R) * ease(g).hit;
    // v378 스침 — 손으로 피하는 중에 아슬아슬하게 비껴가면 집중이 빨리 찬다
    if (!u.gz && hd < hr + GRAZE_PAD && hd >= hr && g.shHand < 1) { u.gz = true; g.shFocusT = (g.shFocusT || 0) + GRAZE_T; g.shGraze = (g.shGraze || 0) + 1; g.emit('wbGraze', { x: u.x, y: u.y }); }
    if (g.shIframe <= 0 && g.heroHp > 0 && hd < hr) {
      g.shIframe = IFRAME;
      hitHero(g, st, u);
      continue;
    }
    out.push(u);
  }
  g.bullets = out.length > MAX_BULLETS ? out.slice(-MAX_BULLETS) : out;
}

function hitHero(g, st, u) {
  if (g._invulnUntil > g.clock) return;
  // v378 칠십이변 — 분신이 대신 맞는다
  if (g.shWk > 0) { g.shWk--; g.emit('wukongBlock', { x: g.heroX, y: g.heroY, left: g.shWk }); return; }
  const pm = g.pmods();
  const red = (1 - (W.CLASSES[g.s.job]?.dmgRed || 0)) * (1 - (g.buffv.guard || 0)) * (1 - Math.min(0.6, pm.dmgRed || 0)) * (1 - (st.dmgRed || 0));
  const k = rageK(g).atk;
  const dmg = st.hp * HIT_PCT * (u.big ? 2 : 1) * k * red;
  let left = dmg;
  if (g.shield > 0 && g.buffs.shield > 0) { const a = Math.min(g.shield, left); g.shield -= a; left -= a; }
  g.heroHp -= left;
  g.shHits++;
  if (g.shFocus >= 3) g.emit('wbFocus', { n: 0, lost: g.shFocus });
  g.shFocus = 0; g.shFocusT = 0;
  g.emit('heroHit', { amount: left, shielded: dmg - left, boss: true, from: { x: u.x, y: u.y } });
  if (g.heroHp <= 0) g.heroDied(g.inst?.boss);
}

// 누른 자리로 (moveTo가 부른다) — 마당 안으로
export function target(g, x, y) {
  g.shTarget = { x: Math.max(ARENA.x0, Math.min(ARENA.x1, x)), y: Math.max(0, Math.min(ARENA.y1, y)) };
  g.shIdle = 0;
}
