// 초식 연출표 — 무공 하나를 네 박자로 풀어 그린다.
//
//   ① 기수식  자세를 잡고 기를 모은다
//   ② 시전    몸이 움직이고 빛이 나간다
//   ③ 적중    맞는 순간 — 멈칫, 그리고 터진다
//   ④ 여운    숫자가 뜨고, 남은 빛이 가라앉고, 칼을 거둔다
//
// **피해는 시전한 그 프레임에 이미 다 들어가 있다** (game.js가 정한다).
// 여기서는 그 결과(맞은 숫자·쓰러짐)를 잠시 붙들었다가 ③에서 풀어 줄 뿐이다.
// 그래서 연출을 아무리 늘여도 밸런스는 1도 안 바뀐다.
//
// 표에 없는 무공은 battle.js의 옛 skillEffect가 그대로 그린다.
// 설계: docs/전직무공_연출설계.md
import { JOB_TRAITS } from './data.js';
import { POSES } from './pose.js';

// 연출 세기 — 설정의 '연출 간소화'. 2 높음 · 1 보통 · 0 낮음.
// 높음만 화면 전체를 다시 칠하는 것(흑백·화면 가르기)을 쓴다.
export const FX_LEVELS = ['low', 'mid', 'high'];

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- 감독 ----------
// 무공 한 번의 연출. 시각표(at)를 들고 있다가 때가 되면 하나씩 실행한다.
export class Director {
  constructor(view, pend, game) {
    this.v = view;
    this.id = pend.id;
    this.job = pend.job;
    this.t = 0;
    this.q = [];
    this.hits = pend.hits;
    this.kills = pend.kills;
    this.path = pend.path;
    this.beat = '';
    const now = { x: game.heroX, y: game.heroY };
    this.to = now;
    this.from = pend.path?.path?.[0] ? { ...pend.path.path[0] } : now;
    this.target = pend.path?.target || pend.hits[0]?.at || (game.mon ? { x: game.mon.x, y: game.mon.y } : now);
    this.ang = game.heroAngle || 0;
    this.face = game.heroFacing < 0 ? -1 : 1;
    // 지나온 방향 (순간이동한 무공만 뜻이 있다). 좌우로 거의 안 움직였으면 보던 쪽.
    const tdx = this.to.x - this.from.x;
    this.travel = Math.abs(tdx) > 8 ? Math.sign(tdx) : this.face;
    // 겨누는 방향의 좌우 — 꿰뚫는 무공은 몸도 그쪽을 봐야 빛과 칼끝이 맞는다
    const c = Math.cos(this.ang);
    this.aim = c < -0.05 ? -1 : c > 0.05 ? 1 : this.face;
    this.lvl = view.fxLevel;
    const tr = pend.job ? JOB_TRAITS[pend.job] : null;
    this.col = tr?.col || '253,230,138';
  }

  at(t, fn) {
    this.q.push({ t, fn });
    this.q.sort((a, b) => a.t - b.t);
    return this;
  }

  tick(dt) {
    this.t += dt;
    while (this.q.length && this.q[0].t <= this.t) this.q.shift().fn(this);
  }

  get done() { return !this.q.length; }

  // 다음 무공이 끼어들면 남은 것을 한꺼번에 털고 물러난다
  flush() {
    this.q.length = 0;
    this.release();
    this.end();
  }

  // 연출이 빌려 쓴 화면 상태를 돌려준다
  end() {
    const v = this.v;
    v.camHold = 0;
    if (v.camFocus) { v.camFocus = null; v.camPan = true; }
    v.faceOverride = 0;
    v.desatTo = 0;
    v.slice = null;
  }

  // 카메라를 a와 b 사이(조금 위)에 둔다 — 무인과 대상이 한 화면에 들어오게
  focusBetween(a, b, rate = 14) {
    this.v.camFocus = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 24 };
    this.v.camRate = rate;
    this.v.camPan = true;
  }

  unfocus(rate = 6) {
    if (!this.v.camFocus) return;
    this.v.camFocus = null;
    this.v.camRate = rate;
    this.v.camPan = true;
  }

  // ---- 붙들어 둔 결과를 푼다 ----
  releaseHit(h) {
    const i = this.hits.indexOf(h);
    if (i < 0) return;
    this.hits.splice(i, 1);
    this.v.handle({ ...h, _released: true }, this.v.game);
    // 그 적이 쓰러졌으면 쓰러짐도 같이
    for (const k of this.kills.slice()) {
      if (k.ref && k.ref === h.ref) {
        this.kills.splice(this.kills.indexOf(k), 1);
        this.v.handle({ ...k, _released: true }, this.v.game);
      }
    }
  }

  release() {
    for (const h of this.hits.slice()) this.releaseHit(h);
    for (const k of this.kills) this.v.handle({ ...k, _released: true }, this.v.game);
    this.kills.length = 0;
    this.releasePath();
  }

  releasePath() {
    if (!this.path) return;
    this.v.handle({ ...this.path, _released: true }, this.v.game);
    this.path = null;
  }

  // 여러 명이 맞았으면 앞에서부터 차례로 — 다 합쳐 spread초 안에
  releaseSeq(t0, spread = 0.4, gap = 0.05) {
    const ux = Math.cos(this.ang);
    const uy = Math.sin(this.ang);
    const sq = this.v.squash;
    const along = (h) => (h.at.x - this.to.x) * ux + (h.at.y - this.to.y) * sq * uy;
    const list = this.hits.slice().sort((a, b) => along(a) - along(b));
    const g = list.length > 1 ? Math.min(gap, spread / (list.length - 1)) : 0;
    list.forEach((h, i) => this.at(t0 + i * g, (d) => {
      d.releaseHit(h);
      d.fx('cutline', 0.32, { wx: h.at.x, wy: h.at.y, a: d.ang + Math.PI / 2 + (((i * 37) % 9) - 4) * 0.08 });
    }));
    this.at(t0 + list.length * g + 0.01, (d) => d.release());
  }

  // ---- 연출 도구 ----
  fx(kind, life, extra = {}) { this.v.effects.push({ kind, life, max: life, ...extra }); }
  pose(keys, out) { this.v.heroAnim.play(keys, out); }
  mark(beat) { this.beat = beat; this.v.beat = beat; }
  hanja(text, life = 1) { this.v.hanja = { text, life, max: life, color: `rgb(${this.col})`, vertical: true }; }
  ghost(wx, wy, pose, life, extra = {}) {
    this.fx('ghost', life, { wx, wy, pose: typeof pose === 'string' ? POSES[pose] : pose, flip: this.face < 0, ...extra });
  }
  // 무인 화면 자리에서 칼끝(앞·위)까지의 대략. 자세마다 조금씩 다르지만 빛을 모으는 자리로 충분하다.
  tip(dx = 36, dy = -50) {
    const v = this.v;
    return { x: v.heroX + dx * this.face, y: v.groundY + dy };
  }
}

// ---------- 연출 그림 ----------
// battle.js drawEffects가 kind를 보고 여기로 넘긴다. e.wx/e.wy는 들판 좌표 —
// 카메라가 움직이는 중에도 제자리에 붙어 있게 그릴 때마다 화면 좌표로 바꾼다.
// k는 남은 수명 비율(1 → 0).
export const FX = {
  // 무인의 잔상. 순보로 사라진 자리, 지나간 길에 남는다.
  ghost(v, ctx, e, k) {
    const f = e.fade ?? 1;
    const a = (e.a0 ?? 1) * (k < f ? k / f : 1);
    if (a <= 0.01) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    v.drawHeroAt(ctx, v.sx({ x: e.wx }), v.sy({ y: e.wy }), e.pose, e.flip, e.tint);
  },

  // 칼날에 한 번 번쩍이는 별빛
  glint(v, ctx, e, k) {
    const x = e.wx != null ? v.sx({ x: e.wx }) + (e.ox || 0) : e.x;
    const y = e.wy != null ? v.sy({ y: e.wy }) + (e.oy || 0) : e.y;
    const p = 1 - k;
    const r = (e.r || 18) * Math.sin(Math.min(1, p * 1.2) * Math.PI);
    ctx.translate(x, y);
    ctx.rotate(p * 0.8);
    ctx.fillStyle = `rgba(${e.col || '255,255,255'},${0.95 * k + 0.05})`;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.12, 0); ctx.lineTo(0, r * 0.12); ctx.lineTo(-r * 0.12, 0); ctx.fill();
    }
  },

  // 이마의 붉은 점 — 일점혈로. 풀릴 때까지 한 점에 머문다.
  mark(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) - 80;
    const p = 1 - k;
    const grow = clamp01(p * 6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(220,20,40,${0.95 * grow})`;
    ctx.beginPath(); ctx.arc(x, y, 3.2 * grow, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(248,113,113,${0.6 * grow * k})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 4 + p * 26, 0, TAU); ctx.stroke();
  },

  // 대상을 가로지르는 가는 흰 선 — 처음엔 바늘처럼 가늘다가 한 번 부풀고 사라진다
  needle(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) - (e.h ?? 62);
    const p = 1 - k;
    const len = (e.len || 280) * Math.min(1, p * 5);
    const wid = p < 0.2 ? 1.5 : (e.w || 7) * Math.sin(((p - 0.2) / 0.8) * Math.PI) + 1;
    ctx.translate(x, y);
    ctx.rotate(e.a || 0);
    ctx.fillStyle = `rgba(${e.col || '255,255,255'},${0.18 * k})`;
    ctx.fillRect(-len / 2, -wid * 2.4, len, wid * 4.8);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k * 1.5)})`;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0); ctx.lineTo(0, -wid / 2); ctx.lineTo(len / 2, 0); ctx.lineTo(0, wid / 2);
    ctx.fill();
  },

  // 칼끝으로 빨려 드는 빛 알갱이
  motes(v, ctx, e, k) {
    const face = e.face || 1;
    const cx = v.heroX + (e.dx || 36) * face;
    const cy = v.groundY + (e.dy || -50);
    const p = 1 - k;
    for (let i = 0; i < e.n; i++) {
      const s = e.seeds[i];
      const q = clamp01((p - s[2] * 0.5) / 0.5);   // 알갱이마다 늦게 출발한다
      if (q <= 0 || q >= 1) continue;
      const r = (e.r || 110) * (1 - q) ** 1.6;
      const a = s[0] * TAU + q * 1.2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.75;
      const tx = cx + Math.cos(a) * (r + 10 + 14 * (1 - q));
      const ty = cy + Math.sin(a) * (r + 10 + 14 * (1 - q)) * 0.75;
      ctx.strokeStyle = `rgba(${e.col || '255,255,255'},${0.85 * Math.sin(q * Math.PI)})`;
      ctx.lineWidth = 1.2 + s[1] * 1.6;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    }
    // 모이는 만큼 칼끝이 밝아진다
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16 + p * 10);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * p})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 16 + p * 10, 0, TAU); ctx.fill();
  },

  // 꿰뚫는 흰 빛기둥 + 그 안을 흐르는 바람 줄 — 만류귀종
  lance(v, ctx, e, k) {
    const p = 1 - k;
    const x = v.sx({ x: e.wx }) + (e.ox || 0);
    const y = v.sy({ y: e.wy }) + (e.oy || -52);
    const L = e.len * Math.min(1, p * 7);
    const W = e.w * (p < 0.12 ? 0.4 + p * 5 : 1) * (0.35 + 0.65 * k);
    ctx.translate(x, y);
    ctx.rotate(e.a);
    const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.35, `rgba(${e.col},${0.28 * k})`);
    g.addColorStop(0.5, `rgba(255,255,255,${0.75 * k})`);
    g.addColorStop(0.65, `rgba(${e.col},${0.28 * k})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, -W / 2, L, W);
    // 가운데 심 — 가장 밝은 한 줄
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k * 1.6)})`;
    ctx.fillRect(0, -1.5, L, 3);
    // 바람 줄 — 빛 안에서 앞으로 흐른다
    if (e.wind) {
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < e.wind; i++) {
        const off = ((i * 0.618) % 1 - 0.5) * W * 0.9;
        const sx = ((p * 2.2 + i * 0.137) % 1) * L;
        ctx.beginPath(); ctx.moveTo(sx, off); ctx.lineTo(Math.min(L, sx + 40 + (i % 3) * 18), off); ctx.stroke();
      }
    }
    // 끝머리 — 뾰족하게
    ctx.fillStyle = `rgba(255,255,255,${0.6 * k})`;
    ctx.beginPath(); ctx.moveTo(L, -W * 0.22); ctx.lineTo(L + 26, 0); ctx.lineTo(L, W * 0.22); ctx.fill();
  },

  // 맞은 자리에 그어지는 흰 칼금 (빛기둥과 엇갈리게)
  cutline(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) - 50;
    const p = 1 - k;
    const len = 78 * Math.min(1, p * 6);
    ctx.translate(x, y);
    ctx.rotate(e.a || 0);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k * 1.4)})`;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0); ctx.lineTo(0, -2.6 * k - 0.6); ctx.lineTo(len / 2, 0); ctx.lineTo(0, 2.6 * k + 0.6);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(185,28,28,${0.7 * k})`;
    ctx.fillRect(-len * 0.3, 2, len * 0.6, 1.2);
  },

  // 하늘에 남는 가는 금빛 줄 — 지나간 검기의 흔적
  skyline(v, ctx, e, k) {
    const ax = v.sx({ x: e.wx });
    const ay = v.sy({ y: e.wy }) + (e.oy || -52);
    const bx = ax + Math.cos(e.a) * e.len;
    const by = ay + Math.sin(e.a) * e.len;
    const p = 1 - k;
    ctx.strokeStyle = `rgba(253,224,71,${0.18 * k})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.strokeStyle = `rgba(254,240,138,${0.85 * k})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    // 줄을 따라 흐르는 반짝임
    const s = (p * 1.6) % 1;
    const gx = ax + (bx - ax) * s;
    const gy = ay + (by - ay) * s;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 14);
    g.addColorStop(0, `rgba(255,251,235,${0.9 * k})`);
    g.addColorStop(1, 'rgba(255,251,235,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(gx, gy, 14, 0, TAU); ctx.fill();
  },

  // 무인 손에서 앞으로 그어지는 반달 칼바람 (휘두른 궤적)
  arc(v, ctx, e, k) {
    const x = e.wx != null ? v.sx({ x: e.wx }) : v.heroX;
    const y = (e.wy != null ? v.sy({ y: e.wy }) : v.groundY) + (e.oy ?? -54);
    const p = 1 - k;
    const face = e.face || 1;
    const r = e.r || 54;
    const a0 = e.a0 ?? -1.6;
    const a1 = e.a1 ?? 0.9;
    const sweep = a0 + (a1 - a0) * Math.min(1, p * 4);
    ctx.translate(x, y);
    ctx.scale(face, 1);
    ctx.fillStyle = `rgba(${e.col || '255,255,255'},${0.8 * k})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, sweep);
    ctx.arc(-6, 2, r * 0.8, sweep, a0, true);
    ctx.fill();
  },

  // 화면을 비스듬히 가로지르는 한 줄 — 천하제일검. 화면 좌표.
  skyslash(v, ctx, e, k) {
    const p = 1 - k;
    const cx = v.w / 2;
    const cy = v.h * 0.42;
    const L = Math.hypot(v.w, v.h) * 0.62;
    const grow = Math.min(1, p * 7);
    ctx.translate(cx, cy);
    ctx.rotate(e.a);
    const wid = (p < 0.15 ? 2 : 9 * k + 1.5);
    // 번진 빛은 양끝으로 갈수록 가늘어진다 — 띠처럼 보이지 않게
    const span = 2 * L * grow;
    const g = ctx.createLinearGradient(0, -wid * 3, 0, wid * 3);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(${e.col || '255,255,255'},${0.3 * k})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-L, 0); ctx.lineTo(-L + span / 2, -wid * 3); ctx.lineTo(-L + span, 0); ctx.lineTo(-L + span / 2, wid * 3);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, k * 1.5)})`;
    ctx.beginPath();
    ctx.moveTo(-L, 0); ctx.lineTo(-L + L * grow, -wid / 2); ctx.lineTo(-L + 2 * L * grow, 0); ctx.lineTo(-L + L * grow, wid / 2);
    ctx.fill();
  },

  // 칼끝에서 하늘로 곧게 솟는 가는 빛 — 검거양의 기세
  skybeam(v, ctx, e, k) {
    const x = v.sx({ x: e.wx }) + (e.ox || 0);
    const y = v.sy({ y: e.wy }) + (e.oy || -130);
    const p = 1 - k;
    const grow = Math.min(1, p * 2.2);
    const top = y - (y + 40) * grow;
    const a = Math.min(1, k * 3) * grow;
    const g = ctx.createLinearGradient(0, top, 0, y);
    g.addColorStop(0, `rgba(${e.col || '255,255,255'},0)`);
    g.addColorStop(1, `rgba(${e.col || '255,255,255'},${0.35 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 9, top, 18, y - top);
    ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
    ctx.fillRect(x - 1, top, 2, y - top);
  },

  // 붉은 낙관 — 넷이면 두 줄로 찍는다. 화면 좌표.
  seal(v, ctx, e, k) {
    const p = 1 - k;
    const land = clamp01(p / 0.12);
    const sc = 1 + (1 - land) ** 2 * 1.4;
    const a = Math.min(1, k * 3) * land;
    const S = Math.min(112, v.w * 0.27);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    // 가운데는 칼이 닿은 자리와 숫자 몫이다. 낙관은 오른쪽 위에 비켜 찍는다
    // (오른쪽 아래는 게임 화면에서 창 버튼 줄이 덮는다).
    const px = v.w * 0.76;
    const py = v.h * 0.22;
    ctx.translate(px, py);
    ctx.rotate(-0.06);
    ctx.scale(sc, sc);
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    const r = 8;
    ctx.moveTo(-S / 2 + r, -S / 2);
    ctx.arcTo(S / 2, -S / 2, S / 2, S / 2, r);
    ctx.arcTo(S / 2, S / 2, -S / 2, S / 2, r);
    ctx.arcTo(-S / 2, S / 2, -S / 2, -S / 2, r);
    ctx.arcTo(-S / 2, -S / 2, S / 2, -S / 2, r);
    ctx.fill();
    ctx.strokeStyle = '#fef2f2';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-S / 2 + 7, -S / 2 + 7, S - 14, S - 14);
    ctx.fillStyle = '#fef2f2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const t = [...e.text];
    const cell = (S - 22) / 2;
    ctx.font = `${cell * 0.92}px ${v.brush}`;
    // 옛 낙관은 오른쪽 세로줄부터 읽지만, 우리 화면을 보는 사람은 가로로 읽는다.
    // 세로로 찍었더니 '第天 一下'로 읽혔다 — 가로 두 줄로 찍는다 (天下 / 第一).
    const pos = [[0, 0], [1, 0], [0, 1], [1, 1]];
    t.slice(0, 4).forEach((ch, i) => {
      const [c, rr] = pos[i];
      ctx.fillText(ch, -cell / 2 + c * cell, -cell / 2 + rr * cell + 2);
    });
    // 찍힌 순간 둘레로 먹이 튄다
    if (land >= 1 && !e.splat) { e.splat = true; v.ink(px, py, 12, '#7f1d1d', 160); }
  },
};

// ---------- 무공별 연출표 ----------
// 각 함수는 시전되는 순간 한 번 불리고, 시각표를 d.at(초, 할 일)로 깐다.
// 시간은 실제 초다 (히트스톱으로 화면이 느려져도 시각표는 그대로 간다).
export const CHOREO = {
  // ── 일화검존 1차 · 일점혈로 ─────────────────────────────
  // 몸을 낮춰 칼을 허리에 붙이고 → 사라져 → 적의 등 뒤에 일섬 자세로 선다.
  // 이마에 붉은 점이 찍히고, 한 박자 뒤 가는 흰 선이 대상을 가로지른다.
  jsword(d) {
    const v = d.v;
    const T = 0.3;   // 나타나는 시각
    const H = 0.55;  // 터지는 시각
    d.mark('기수식');
    v.camHold = 0.18;
    if (d.lvl >= 1) v.desatTo = 0.5;
    // 사라지는 자리의 무인 — 지나갈 쪽을 본다
    d.ghost(d.from.x, d.from.y, '발도준비', 0.34, { fade: 0.3, flip: d.travel < 0 });
    d.pose([[0, '순보', 'step'], [T - 0.01, '순보'], [T, '일섬', 'step'], [H + 0.3, '일섬'], [H + 0.55, '납도', 'inout']], 0.35);
    d.at(0.1, () => d.fx('glint', 0.22, { wx: d.from.x, wy: d.from.y, ox: -18 * d.travel, oy: -44, r: 16 }));
    d.at(0.17, () => {
      d.mark('시전');
      // 지나간 길에 잔상
      const n = d.lvl >= 1 ? 3 : 1;
      for (let i = 1; i <= n; i++) {
        const q = i / (n + 1);
        d.ghost(d.from.x + (d.to.x - d.from.x) * q, d.from.y + (d.to.y - d.from.y) * q, '순보',
          0.28, { a0: 0.55, pose: { ...POSES.순보, alpha: 1 }, tint: d.col, flip: d.travel < 0 });
      }
      d.releasePath();
      // 무인과 대상이 한 화면에 들어오게 그 사이로 간다
      d.focusBetween(d.to, d.target, 22);
      // 베고 지나간 무인은 돌아보지 않는다 — 대상에게 등을 보인 채 선다
      v.faceOverride = d.travel;
    });
    d.at(T, () => {
      d.mark('적중');
      d.fx('mark', H - T + 0.12, { wx: d.target.x, wy: d.target.y });
      v.hitstop = Math.max(v.hitstop, 0.12);
    });
    d.at(H, () => {
      d.fx('needle', 0.45, { wx: d.target.x, wy: d.target.y, a: -0.18 * d.travel, len: 420, w: 11, h: 80, col: '254,202,202' });
      d.release();
      v.shake = Math.max(v.shake, 0.32);
      v.ink(v.sx(d.target), v.sy(d.target) - 76, 6, '#7f1d1d', 140);
      d.hanja('일점혈로', 1.3);
      v.desatTo = 0;
    });
    d.at(H + 0.25, () => d.mark('여운'));
    d.at(H + 0.6, () => d.unfocus());
    d.at(H + 0.85, () => {
      d.fx('glint', 0.18, { wx: d.to.x, wy: d.to.y, ox: -6 * d.travel, oy: -40, r: 10, col: '253,224,71' });
      d.end();
      d.mark('');
    });
  },

  // ── 일화검존 2차 · 만류귀종 ─────────────────────────────
  // 칼을 당겨 빛을 칼끝에 모으고 → 한 번 찌르면 흰 빛기둥이 앞을 꿰뚫는다.
  // 꿰인 적마다 차례로 칼금이 그어지고, 하늘에 가는 금빛 줄이 남는다.
  jsword2(d) {
    const v = d.v;
    const S = 0.42;   // 찌르는 시각
    const sk = { len: 620, w: 120 };
    d.mark('기수식');
    v.faceOverride = d.aim;
    d.pose([[0.1, '찌르기준비', 'out'], [S - 0.02, '찌르기준비'], [S + 0.06, '찌르기', 'snap'], [S + 0.6, '찌르기'], [S + 0.9, '납도', 'inout']], 0.35);
    const n = d.lvl >= 2 ? 26 : d.lvl >= 1 ? 16 : 7;
    d.fx('motes', S + 0.02, {
      n, face: d.aim, r: 120, dx: 34, dy: -50, col: d.col,
      seeds: Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]),
    });
    d.at(S, () => {
      d.mark('시전');
      d.fx('lance', 0.55, { wx: d.to.x, wy: d.to.y, oy: -50, a: d.ang, len: sk.len, w: sk.w, col: d.col, wind: d.lvl >= 1 ? 9 : 0 });
      v.shake = Math.max(v.shake, 0.28);
      v.flash = Math.max(v.flash, 0.16);
      d.hanja('만류귀종', 1);
    });
    d.at(S + 0.07, () => d.mark('적중'));
    d.releaseSeq(S + 0.07, 0.4, 0.05);
    d.at(S + 0.5, () => {
      d.mark('여운');
      d.fx('skyline', 1.5, { wx: d.to.x, wy: d.to.y, oy: -96, a: d.ang, len: sk.len * 0.9 });
    });
    d.at(S + 1.0, () => { v.faceOverride = 0; });
    d.at(S + 1.3, () => { d.end(); d.mark(''); });
  },

  // ── 일화검존 3차 · 천하제일검 ───────────────────────────
  // 칼을 하늘로 들면 세상이 먹빛으로 바래고(무인만 색이 남는다) →
  // 화면을 비스듬히 가르는 한 줄 → 멈췄다가 화면이 그 줄을 따라 갈라졌다 붙는다.
  // 붉은 낙관 「天下第一」.
  jsword3(d) {
    const v = d.v;
    const C = 0.62;   // 긋는 시각
    const H = 0.95;   // 갈라지는 시각
    const slashA = (-0.42 + Math.random() * 0.1) * d.face;
    d.mark('기수식');
    v.camHold = C;
    v.desatTo = d.lvl >= 1 ? 1 : 0;
    v.desatRate = 3.2;
    d.ghost(d.from.x, d.from.y, '검거양', C + 0.04, { fade: 0.1, flip: d.travel < 0 });
    d.pose([[0, '순보', 'step'], [C, '순보'], [C + 0.01, '내려베기', 'step'], [H + 0.45, '내려베기'], [H + 0.75, '납도', 'inout']], 0.4);
    // 들어 올린 칼날을 타고 빛이 오르고, 칼끝에서 하늘로 한 줄기 솟는다
    d.at(0.12, () => d.fx('skybeam', C - 0.1, { wx: d.from.x, wy: d.from.y, ox: 5 * d.travel, oy: -136 }));
    d.at(0.18, () => d.fx('glint', 0.3, { wx: d.from.x, wy: d.from.y, ox: 6 * d.face, oy: -112, r: 22 }));
    d.at(0.4, () => d.fx('glint', 0.26, { wx: d.from.x, wy: d.from.y, ox: 6 * d.face, oy: -128, r: 30 }));
    d.at(C, () => {
      d.mark('시전');
      d.fx('skyslash', 0.9, { a: slashA });
      d.releasePath();
      d.focusBetween(d.to, d.target, 26);
      v.faceOverride = d.travel;
      v.flash = Math.max(v.flash, 0.25);
    });
    d.at(C + 0.06, () => {
      d.mark('적중');
      d.fx('mark', H - C, { wx: d.target.x, wy: d.target.y });
    });
    d.at(H, () => {
      if (d.lvl >= 2) v.slice = { a: slashA, life: 0.42, max: 0.42, gap: 16 };
      d.fx('needle', 0.5, { wx: d.target.x, wy: d.target.y, a: slashA, len: 360, w: 12, h: 66, col: '254,202,202' });
      d.release();
      v.hitstop = Math.max(v.hitstop, 0.16);
      v.shake = Math.max(v.shake, 0.7);
      v.flash = Math.max(v.flash, 0.55);
      v.ink(v.sx(d.target), v.sy(d.target) - 60, d.lvl >= 1 ? 26 : 10, '#7f1d1d', 280);
      d.fx('seal', 1.7, { text: '天下第一' });
    });
    d.at(H + 0.35, () => {
      d.mark('여운');
      v.desatTo = 0;
      v.desatRate = 1.6;
    });
    d.at(H + 0.7, () => d.unfocus());
    d.at(H + 1.2, () => { d.end(); d.mark(''); });
  },
};
