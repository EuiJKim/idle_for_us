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
import { CLASS_FX, CLASS_CHOREO } from './skillfx_class.js';
import { MAJON_FX, MAJON_CHOREO } from './skillfx_majon.js';
import { putJ, putFace } from './jobart.js';

// 연출 세기 — 설정의 '연출 간소화'. 2 높음 · 1 보통 · 0 낮음.
// 높음만 화면 전체를 다시 칠하는 것(흑백·화면 가르기)을 쓴다.
export const FX_LEVELS = ['low', 'mid', 'high'];

const TAU = Math.PI * 2;

// 독은 차수가 오를수록 짙어진다 (연두 → 초록 → 청록 → 보랏빛이 도는 독)
// v250: 3·4차가 청록 속 보라 테·연보라 심이라 독 장판이 '차원문'으로 읽혔다 — 초록 바탕을 지키고 보라는 테에 살짝만
export const VENOM = [
  { core: '190,242,100', glow: '132,204,22', dark: '54,83,20' },
  { core: '134,239,172', glow: '34,197,94', dark: '20,83,45' },
  { core: '167,243,208', glow: '22,163,74', dark: '22,78,48' },
  { core: '217,249,157', glow: '34,197,94', dark: '59,30,80' },
];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------- 감독 ----------
// 무공 한 번의 연출. 시각표(at)를 들고 있다가 때가 되면 하나씩 실행한다.
export class Director {
  constructor(view, pend, game) {
    this.v = view;
    this.id = pend.id;
    this.job = pend.job;
    this.name = pend.name || '';
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
    this.tier = Math.min(3, pend.tier || 0);   // 4차 무공도 빛깔·크기 표는 3차 것으로 (VENOM은 넷뿐)
    this.venom = VENOM[Math.min(VENOM.length - 1, this.tier)];
    // 광역·장판이 떨어지는 자리 (멀리서 쏘는 캐릭터는 겨눈 적 자리)
    this.center = pend.at || now;
    this.radius = pend.radius || 0;
    this.dur = pend.dur || 0;
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
    // 연출이 다 끝났는데 안 푼 결과가 남았으면 마저 푼다 (숫자가 영영 안 뜨면 안 된다)
    if (!this.q.length && (this.hits.length || this.kills.length)) this.release();
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
  // 손에서 겨눈 자리로 무언가를 던진다 (들판 좌표 + 화면 높이 보정)
  lob(kind, life, to, extra = {}) {
    this.fx(kind, life, { wx0: this.to.x, wy0: this.to.y, ox0: 20 * this.face, oy0: -66,
      wx1: to.x, wy1: to.y, oy1: extra.oy1 ?? -30, v: this.tier, ...extra });
  }
  // 독이 터지는 자리: 방울 + 부식 고리 + 웅덩이
  burst(at, r, { puddle = 0.8, ring = true, drops = 14 } = {}) {
    const v = this.v;
    const sx = v.sx(at);
    const sy = v.sy(at);
    const n = Math.round(drops * (this.lvl >= 2 ? 1 : this.lvl >= 1 ? 0.6 : 0.3));
    const c = this.venom;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = 60 + Math.random() * 170;
      v.particles.push({ x: sx, y: sy - 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 160 - Math.random() * 90,
        life: 0.55 + Math.random() * 0.3, size: 2.5 + Math.random() * 3, color: `rgba(${i % 3 ? c.glow : c.core},0.9)`, drop: true });
    }
    this.fx('splash', 0.35, { wx: at.x, wy: at.y, r: r * 0.6, v: this.tier });
    if (ring) this.fx('corrode', 0.5, { wx: at.x, wy: at.y, r, v: this.tier, seed: Math.random() * 100 });
    if (puddle > 0) this.fx('puddle', puddle, { wx: at.x, wy: at.y, r: r * 0.65, v: this.tier, seeds: seeds(10) });
  }
  // 맞은 적 위로 해골이 떠오른다 (3차 독의 표식)
  skulls(list, max = 3) {
    list.slice(0, max).forEach((h, i) => this.fx('skull', 0.9, { wx: h.at.x, wy: h.at.y, oy: -110 - i * 4, size: 13, v: this.tier, delay: i * 0.06 }));
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
    const len = (e.len || 78) * Math.min(1, p * 6);
    ctx.translate(x, y);
    ctx.rotate(e.a || 0);
    // v251 빛깔(col) — 애완동물 발톱·여의봉처럼 흰 선만으로는 누구 것인지 몰랐다
    if (e.col) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(20,14,10,${0.35 * k})`;
      ctx.beginPath(); ctx.moveTo(-len / 2 - 3, 0); ctx.lineTo(0, -5 * k - 1.5); ctx.lineTo(len / 2 + 3, 0); ctx.lineTo(0, 5 * k + 1.5); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${e.col},${Math.min(1, k * 1.4)})`;
      ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(0, -4 * k - 1); ctx.lineTo(len / 2, 0); ctx.lineTo(0, 4 * k + 1); ctx.fill();
    }
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

// ---------- 독 그림 부품 ----------
function seeds(n) { return Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]); }
// 독무 한 덩이. 색마다 한 장 구워 두고 붙인다 — 수십 덩이를 그라디언트로 그리면 무겁다.
const puffCache = new Map();
function puff(rgb) {
  let c = puffCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},0.75)`);
  g.addColorStop(0.55, `rgba(${rgb},0.35)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  puffCache.set(rgb, c);
  return c;
}
function skullAt(ctx, x, y, s, fill, ink) {
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.arc(x, y, s + 1.6, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(x + s * 0.62, y + s * 1.05); ctx.lineTo(x - s * 0.62, y + s * 1.05); ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.arc(x, y, s, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(x + s * 0.55, y + s * 0.95); ctx.lineTo(x - s * 0.55, y + s * 0.95); ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath(); ctx.ellipse(x - s * 0.38, y + s * 0.1, s * 0.24, s * 0.3, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + s * 0.38, y + s * 0.1, s * 0.24, s * 0.3, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.42); ctx.lineTo(x - s * 0.1, y + s * 0.62); ctx.lineTo(x + s * 0.1, y + s * 0.62); ctx.fill();
  ctx.fillRect(x - s * 0.36, y + s * 0.78, s * 0.72, s * 0.08);
}

// 독마의 장판 — 게임의 field(옮겨 다니는 것 포함)를 따라 그린다. battle.js drawFields가 부른다.
export function drawPoisonField(v, ctx, f, k, tier) {
  const c = VENOM[Math.min(VENOM.length - 1, tier || 0)];
  if (!f.seeds) f.seeds = seeds(10 + (tier || 0) * 3);
  const x = v.sx(f);
  const y = v.sy(f);
  const t = performance.now() / 1000;
  const fade = Math.min(1, (1 - k) * 8) * Math.min(1, k * 4);   // 들어올 때·사라질 때
  // 바닥 웅덩이
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.55 * fade;
  ctx.fillStyle = `rgb(${c.dark})`;
  ctx.beginPath(); ctx.ellipse(x, y, f.r * 0.92, f.r * 0.92 * v.squash, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.35 * fade;
  ctx.fillStyle = `rgb(${c.glow})`;
  ctx.beginPath(); ctx.ellipse(x, y, f.r * 0.7, f.r * 0.7 * v.squash, 0, 0, TAU); ctx.fill();
  // 끓는 방울
  ctx.globalCompositeOperation = 'lighter';
  for (const [a, b, d] of f.seeds) {
    const ph = (t * (0.6 + d * 0.8) + a * 5) % 1;
    const bx = x + Math.cos(a * TAU) * f.r * 0.75 * b;
    const by = y + Math.sin(a * TAU) * f.r * 0.75 * b * v.squash;
    const r = 2 + ph * (4 + d * 4);
    ctx.globalAlpha = fade * (ph < 0.85 ? 0.8 : (1 - ph) * 5);
    ctx.strokeStyle = `rgb(${c.core})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(bx, by - ph * 6, r, 0, TAU); ctx.stroke();
  }
  // 위로 피어오르는 독무
  const img = puff(c.glow);
  const n = v.fxLevel >= 1 ? 7 : 3;
  for (let i = 0; i < n; i++) {
    const s2 = f.seeds[i % f.seeds.length];
    const ph = (t * 0.35 + s2[2] + i / n) % 1;
    const px = x + Math.cos((s2[0] + t * 0.05) * TAU) * f.r * 0.6 * s2[1];
    const py = y - 10 - ph * 70;
    const sz = f.r * (0.5 + ph * 0.6);
    ctx.globalAlpha = fade * 0.5 * Math.sin(ph * Math.PI);
    ctx.drawImage(img, px - sz / 2, py - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

// 독 연출 그림 — FX에 덧붙인다 (아래 Object.assign)
const POISON_FX = {
  // 포물선으로 날아가는 큰 독 덩이
  pglob(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const p = Math.min(1, (1 - k) / (e.fly ?? 1));
    if (p >= 1) return;
    const x0 = v.sx({ x: e.wx0 }) + (e.ox0 || 0);
    const y0 = v.sy({ y: e.wy0 }) + (e.oy0 || 0);
    const x1 = v.sx({ x: e.wx1 });
    const y1 = v.sy({ y: e.wy1 }) + (e.oy1 || 0);
    const H = e.h ?? 70;
    const at = (q) => [x0 + (x1 - x0) * q, y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * H];
    const sz = e.size || 9;
    for (let i = 5; i >= 1; i--) {
      const [tx, ty] = at(Math.max(0, p - i * 0.045));
      ctx.fillStyle = `rgba(${c.glow},${0.42 - i * 0.07})`;
      ctx.beginPath(); ctx.arc(tx, ty + i * 1.5, sz * (1 - i * 0.13), 0, TAU); ctx.fill();
    }
    const [x, y] = at(p);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgb(${c.dark})`;
    ctx.beginPath(); ctx.arc(x, y, sz + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgb(${c.glow})`;
    ctx.beginPath(); ctx.arc(x, y, sz, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${c.core},0.95)`;
    ctx.beginPath(); ctx.arc(x - sz * 0.35, y - sz * 0.35, sz * 0.35, 0, TAU); ctx.fill();
  },
  // 맞은 자리에서 사방으로 튀는 독 물보라 (선)
  splash(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) - 20;
    const p = 1 - k;
    ctx.strokeStyle = `rgba(${c.core},${k})`;
    ctx.lineWidth = 3 * k + 1;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + 0.2;
      const r0 = e.r * 0.2 + e.r * p * 0.5;
      const r1 = r0 + 10 + 14 * k;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.55);
      ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.55);
      ctx.stroke();
    }
    v.putGlow(ctx, c.core, x, y, e.r * 0.8, 0.7 * k, 0.55);   // v245: 매번 그라데이션을 만들던 것
  },
  // 부식 고리 — 들쭉날쭉한 독 고리가 바닥을 따라 번진다
  corrode(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const p = 1 - k;
    const r = e.r * (0.3 + 0.7 * (1 - (1 - p) ** 3));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, v.squash);
    for (const [w, col, a] of [[9, c.dark, 0.5], [3, c.glow, 0.9], [1.2, c.core, 1]]) {
      ctx.globalCompositeOperation = col === c.dark ? 'source-over' : 'lighter';
      ctx.strokeStyle = `rgba(${col},${a * k})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a2 = (i / 40) * TAU;
        const j = 1 + Math.sin(a2 * 7 + e.seed) * 0.05 + Math.sin(a2 * 13 + e.seed * 2) * 0.03;
        const px = Math.cos(a2) * r * j;
        const py = Math.sin(a2) * r * j;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  },
  // 바닥에 남는 독 웅덩이 — 방울이 끓다가 터진다
  puddle(v, ctx, e, k) {
    drawPoisonField(v, ctx, { x: e.wx, y: e.wy, r: e.r, seeds: e.seeds }, k, e.v);
  },
  // 독무 — 부풀며 퍼지는 연기 덩이
  cloud(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) + (e.oy ?? -30);
    const p = 1 - k;
    const grow = 1 - (1 - Math.min(1, p * 2.5)) ** 2;
    const fade = Math.min(1, k * 2.2);
    const img = puff(c.glow);
    const dark = puff(c.dark);
    const n = Math.max(4, Math.round((e.n || 14) * (v.fxLevel >= 2 ? 1 : v.fxLevel >= 1 ? 0.6 : 0.35)));
    for (let i = 0; i < n; i++) {
      const s2 = e.seeds[i % e.seeds.length];
      const a = s2[0] * TAU + p * (s2[2] - 0.5);
      const d = e.r * (0.15 + 0.85 * s2[1]) * grow;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d * 0.55 - p * 26 * s2[2];
      const sz = e.r * (0.45 + 0.4 * s2[2]) * (0.6 + grow * 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = fade * 0.55;
      ctx.drawImage(dark, px - sz / 2, py - sz / 2, sz, sz);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.5;
      // v134: 그린 독안개 그림이 있으면 그것으로 (첫 두 단계 초록 독만 — 보랏빛 독은 옛 그대로)
      if ((e.v || 0) < 2) { ctx.globalAlpha = 1; if (putJ(ctx, 'poison-cloud', px, py, sz * 1.15, fade * 0.55, a)) continue; ctx.globalAlpha = fade * 0.5; }
      ctx.drawImage(img, px - sz * 0.4, py - sz * 0.45, sz * 0.8, sz * 0.8);
    }
    ctx.globalAlpha = 1;
  },
  // 해골 — 떠올라 흐려진다
  skull(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const p = (1 - k) - (e.delay || 0) / e.max;
    if (p < 0) return;
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) + (e.oy ?? -110) - p * 34;
    const pop = Math.min(1, p * 7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, k * 2.5) * pop;
    v.putGlow(ctx, c.glow, x, y, e.size * 2.4, 0.55);
    if (!putJ(ctx, 'skull', x, y, e.size * 3.2 * (0.7 + pop * 0.3))) skullAt(ctx, x, y, e.size * (0.7 + pop * 0.3), `rgb(${c.core})`, `rgb(${c.dark})`);
    ctx.globalAlpha = 1;
  },
  // 독사 — 꺾인 길을 따라 기어가는 뱀 (연쇄)
  serpent(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const pts = e.pts.map((q) => [v.sx(q) + (q.ox || 0), v.sy(q) + (q.oy ?? -40)]);
    if (pts.length < 2) return;
    const segL = [];
    let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segL.push(l); L += l; }
    const p = 1 - k;
    const head = Math.min(1, p / (e.go || 0.7)) * L;
    const body = e.body || 120;
    const fade = p > (e.go || 0.7) ? Math.max(0, k / (1 - (e.go || 0.7))) : 1;
    const pointAt = (d) => {
      let acc = 0;
      for (let i = 0; i < segL.length; i++) {
        if (d <= acc + segL[i] || i === segL.length - 1) {
          const q = Math.max(0, Math.min(1, (d - acc) / (segL[i] || 1)));
          const [ax, ay] = pts[i]; const [bx, by] = pts[i + 1];
          return [ax + (bx - ax) * q, ay + (by - ay) * q, Math.atan2(by - ay, bx - ax)];
        }
        acc += segL[i];
      }
      return pts[pts.length - 1];
    };
    const N = 22;
    const w = e.w || 7;
    const pass = (lw, col, alpha) => {
      ctx.strokeStyle = `rgba(${col},${alpha * fade})`;
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const d0 = head - (i / N) * body;
        const d1 = head - ((i + 1) / N) * body;
        if (d1 < 0) break;
        const [x0, y0, a0] = pointAt(d0);
        const [x1, y1, a1] = pointAt(d1);
        const wig = (d) => Math.sin(d * 0.09 - p * 30) * 7;
        ctx.lineWidth = lw * (1 - i / N * 0.8);
        ctx.beginPath();
        ctx.moveTo(x0 - Math.sin(a0) * wig(d0), y0 + Math.cos(a0) * wig(d0));
        ctx.lineTo(x1 - Math.sin(a1) * wig(d1), y1 + Math.cos(a1) * wig(d1));
        ctx.stroke();
      }
    };
    ctx.globalCompositeOperation = 'source-over';
    pass(w + 4, c.dark, 0.9);
    ctx.globalCompositeOperation = 'lighter';
    pass(w, c.glow, 0.85);
    pass(w * 0.35, c.core, 0.9);
    // 머리와 눈
    const [hx, hy, ha] = pointAt(head);
    ctx.globalCompositeOperation = 'source-over';
    if (putFace(ctx, 'serpent-head', hx + Math.cos(ha) * w, hy + Math.sin(ha) * w, w * 6.5, fade, ha)) return;
    ctx.fillStyle = `rgba(${c.dark},${fade})`;
    ctx.beginPath(); ctx.ellipse(hx, hy, w * 1.3, w * 0.9, ha, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(${c.core},${fade})`;
    ctx.beginPath(); ctx.ellipse(hx, hy, w * 1.05, w * 0.7, ha, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(239,68,68,${fade})`;
    ctx.beginPath(); ctx.arc(hx + Math.cos(ha - 0.6) * w * 0.6, hy + Math.sin(ha - 0.6) * w * 0.6, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + Math.cos(ha + 0.6) * w * 0.6, hy + Math.sin(ha + 0.6) * w * 0.6, 1.6, 0, TAU); ctx.fill();
  },
  // 독침 — 손에서 대상까지 곧게 날아간다
  dart(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const p = Math.min(1, (1 - k) / (e.fly ?? 1));
    if (p >= 1) return;
    const x0 = v.sx({ x: e.wx0 }) + (e.ox0 || 0);
    const y0 = v.sy({ y: e.wy0 }) + (e.oy0 || 0);
    const x1 = v.sx({ x: e.wx1 }) + (e.ox1 || 0);
    const y1 = v.sy({ y: e.wy1 }) + (e.oy1 || 0);
    const x = x0 + (x1 - x0) * p;
    const y = y0 + (y1 - y0) * p;
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.strokeStyle = `rgba(${c.glow},0.5)`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.strokeStyle = `rgba(${c.core},1)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(6, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(2, -2); ctx.lineTo(2, 2); ctx.fill();
  },
  // 하늘에서 떨어지는 독비
  rainfall(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const p = 1 - k;
    const n = v.fxLevel >= 2 ? 40 : v.fxLevel >= 1 ? 22 : 10;
    // v247: 1.6px 연두 줄이 눈 위에서 투명했다 — 먹빛 밑줄 위에 굵은 독 줄, 바닥 물보라도 크게
    const al = 0.85 * Math.min(1, k * 3);
    for (const pass of [0, 1]) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      ctx.strokeStyle = pass ? `rgba(${c.core},${al})` : `rgba(${c.dark},${0.45 * al})`;
      ctx.lineWidth = pass ? 2.6 : 5;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = ((i * 0.618) % 1) * TAU;
        const d = ((i * 0.377) % 1) * e.r;
        const gx = x + Math.cos(a) * d;
        const gy = y + Math.sin(a) * d * v.squash;
        const fall = ((p * 2.4 + i * 0.13) % 1);
        const dy = -220 + fall * 220;
        ctx.moveTo(gx + 5, gy + dy - 24); ctx.lineTo(gx, gy + dy);
        if (fall > 0.88) { ctx.moveTo(gx + 9, gy); ctx.ellipse(gx, gy, 9, 3.5, 0, 0, TAU); }
      }
      ctx.stroke();
    }
  },
  // 관통하는 독전 — 머리가 앞으로 뻗고 꼬리에 독무가 감긴다
  vbolt(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    const p = 1 - k;
    const x = v.sx({ x: e.wx }) + (e.ox || 0);
    const y = v.sy({ y: e.wy }) + (e.oy || -56);
    const L = e.len * Math.min(1, p / (e.go || 0.35));
    ctx.translate(x, y);
    ctx.rotate(e.a);
    const fade = Math.min(1, k * 2);
    const g = ctx.createLinearGradient(0, 0, L, 0);
    g.addColorStop(0, `rgba(${c.glow},0)`);
    g.addColorStop(1, `rgba(${c.glow},${0.55 * fade})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, -10, L, 20);
    // 감기는 독무 줄 둘
    for (const ph of [0, Math.PI]) {
      ctx.strokeStyle = `rgba(${ph ? c.core : c.glow},${0.8 * fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let d = 0; d <= L; d += 8) {
        const yy = Math.sin(d * 0.06 + ph + p * 18) * 8;
        if (d) ctx.lineTo(d, yy); else ctx.moveTo(d, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,255,255,${fade})`;
    ctx.fillRect(Math.max(0, L - 60), -1.5, 60, 3);
    // 촉
    ctx.fillStyle = `rgba(${c.core},${fade})`;
    ctx.beginPath(); ctx.moveTo(L + 18, 0); ctx.lineTo(L - 4, -8); ctx.lineTo(L, 0); ctx.lineTo(L - 4, 8); ctx.fill();
  },
  // 독전이 지나간 바닥 — 타들어 간 자국
  scar(v, ctx, e, k) {
    const c = e.col ? { glow: e.col, dark: e.dark || '40,6,6' } : VENOM[Math.min(3, e.v || 0)];   // v245 핏빛 자국도
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    ctx.translate(x, y);
    ctx.rotate(e.a);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(${c.dark},${0.5 * k})`;
    ctx.fillRect(0, -7, e.len, 14);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${c.glow},${0.6 * k})`;
    for (let d = 10; d < e.len; d += 26) {
      const w = 6 + ((d * 7) % 9);
      ctx.fillRect(d, -1.5, w, 3);
    }
  },
  // 몸에서 피어오르는 독기 (강화가 걸려 있는 동안)
  miasma(v, ctx, e, k) {
    const c = VENOM[Math.min(3, e.v || 0)];
    // v245: 자리를 주면 그 자리에서(독룡출동 장판) — 전엔 늘 무인 몸에서 피어올랐다
    const x = e.wx != null ? v.sx({ x: e.wx }) : v.heroX;
    const y = e.wy != null ? v.sy({ y: e.wy }) : v.groundY;
    const t = performance.now() / 1000;
    const fade = Math.min(1, k * 6) * Math.min(1, (1 - k) * e.max * 4);
    const n = v.fxLevel >= 1 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.9 + i / n) % 1;
      const sx = x + Math.sin(i * 2.1 + t * 2) * 16;
      ctx.strokeStyle = `rgba(${i % 2 ? c.core : c.glow},${0.55 * fade * Math.sin(ph * Math.PI)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let j = 0; j <= 8; j++) {
        const q = j / 8;
        const yy = y - 8 - (ph * 60 + q * 40);
        const xx = sx + Math.sin(q * 6 + t * 5 + i) * (5 + q * 6);
        if (j) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    putJ(ctx, 'poison-cloud', x, y - 46, 100, 0.3 * fade, t * 0.3);
    const g = ctx.createRadialGradient(x, y - 50, 4, x, y - 50, 56);
    g.addColorStop(0, `rgba(${c.glow},${0.22 * fade})`);
    g.addColorStop(1, `rgba(${c.glow},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y - 50, 56, 0, TAU); ctx.fill();
  },
};

// ---------- 무공별 연출표 ----------
// 각 함수는 시전되는 순간 한 번 불리고, 시각표를 d.at(초, 할 일)로 깐다.
// 시간은 실제 초다 (히트스톱으로 화면이 느려져도 시각표는 그대로 간다).
Object.assign(FX, POISON_FX);

// 독마 연출에서 자주 쓰는 것
const HAND = { throw: [[0, '투척준비', 'out'], [0.14, '투척', 'snap']] };

export const CHOREO = {
  // ── 일화검존 1차 · 일점혈로 ─────────────────────────────
  // 몸을 낮춰 칼을 허리에 붙이고 → 사라져 → 적의 등 뒤에 일섬 자세로 선다.
  // 이마에 붉은 점이 찍히고, 한 박자 뒤 가는 흰 선이 대상을 가로지른다.
  'sword:blink'(d) {
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
      d.hanja(d.name, 1.3);
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
  'sword:pierce'(d) {
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
      d.hanja(d.name, 1);
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
  'sword:frost'(d) {
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

  // ═════════ 독마 ═════════
  // 여덟 무공 전부. 차수(d.tier)가 오를수록 독이 짙어지고(VENOM), 한 겹씩 더 붙는다:
  //   1차 — 웅덩이가 남는다 · 2차 — 독비/둘째 고리 · 3차 — 해골이 떠오른다

  // 기본기 · 독장 — 손바닥으로 독 덩이를 밀어 던지면, 겨눈 자리에서 터져 고리가 번진다
  'poison:slash'(d) {
    const v = d.v;
    const R = d.radius || 150;
    d.mark('기수식');
    d.pose([[0, '투척준비', 'out'], [0.12, '장타', 'snap'], [0.5, '장타'], [0.75, '마무리', 'inout']], 0.3);
    d.at(0.12, () => { d.mark('시전'); d.lob('pglob', 0.2, d.center, { size: 9 + d.tier * 2, h: 40 }); });
    d.at(0.32, () => {
      d.mark('적중');
      d.burst(d.center, R, { puddle: d.tier >= 1 ? 0.8 + d.tier * 0.3 : 0, drops: 12 + d.tier * 4 });
      if (d.tier >= 2) d.at(d.t + 0.12, () => d.fx('corrode', 0.5, { wx: d.center.x, wy: d.center.y, r: R * 1.25, v: d.tier, seed: 7 }));
      if (d.tier >= 3) d.skulls(d.hits, 2);
      d.release();
      v.shake = Math.max(v.shake, 0.12 + d.tier * 0.04);
    });
    d.at(0.6, () => { d.mark('여운'); });
    d.at(0.9, () => { d.end(); d.mark(''); });
  },

  // 강화 · 독기 — 몸 안의 독을 끌어올린다. 걸려 있는 동안 독기가 피어오른다.
  'poison:rage'(d) {
    const v = d.v;
    d.mark('기수식');
    d.pose([[0.08, '기모으기', 'out'], [0.5, '기모으기'], [0.62, '마무리', 'snap']], 0.3);
    const n = d.lvl >= 2 ? 22 : d.lvl >= 1 ? 14 : 6;
    d.fx('motes', 0.5, { n, face: d.face, r: 90, dx: 0, dy: -50, col: d.venom.core, seeds: seeds(n) });
    d.at(0.5, () => {
      d.mark('시전');
      d.fx('cloud', 0.7, { wx: d.to.x, wy: d.to.y, r: 70 + d.tier * 12, n: 10, v: d.tier, seeds: seeds(10), oy: -40 });
      d.fx('miasma', Math.max(1, d.dur || 8), { v: d.tier });
      d.hanja(d.name, 1);
      if (d.tier >= 2) d.fx('corrode', 0.6, { wx: d.to.x, wy: d.to.y, r: 110, v: d.tier, seed: 3 });
      if (d.tier >= 3) d.fx('skull', 1, { wx: d.to.x, wy: d.to.y, oy: -150, size: 16, v: d.tier });
    });
    d.at(0.8, () => { d.mark('여운'); });
    d.at(1.1, () => { d.end(); d.mark(''); });
  },

  // 광역 · 독무 — 독 덩이 여럿을 흩뿌려 던지면, 떨어진 자리마다 터지고 독무가 피어난다
  'poison:thunder'(d) {
    const v = d.v;
    const R = d.radius || 210;
    const n = 3 + d.tier * 2;
    d.mark('기수식');
    d.pose([[0, '투척준비', 'out'], [0.16, '흩뿌리기', 'snap'], [0.6, '흩뿌리기'], [0.9, '마무리', 'inout']], 0.3);
    d.at(0.16, () => {
      d.mark('시전');
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.5;
        const r = R * (0.25 + Math.random() * 0.5);
        const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
        const fly = 0.22 + i * 0.035;
        d.lob('pglob', fly, spot, { size: 6 + d.tier, h: 90 + Math.random() * 40 });
        d.at(0.16 + fly, () => d.burst(spot, 60, { puddle: 0, ring: false, drops: 5 }));
      }
      if (d.tier >= 1) d.fx('rainfall', 0.9, { wx: d.center.x, wy: d.center.y, r: R, v: d.tier });
    });
    d.at(0.52, () => {
      d.mark('적중');
      d.fx('cloud', 1.1 + d.tier * 0.2, { wx: d.center.x, wy: d.center.y, r: R * 0.8, n: 14 + d.tier * 3, v: d.tier, seeds: seeds(18) });
      d.fx('corrode', 0.6, { wx: d.center.x, wy: d.center.y, r: R, v: d.tier, seed: Math.random() * 9 });
      if (d.tier >= 2) d.fx('puddle', 1.4, { wx: d.center.x, wy: d.center.y, r: R * 0.6, v: d.tier, seeds: seeds(14) });
      if (d.tier >= 3) d.skulls(d.hits, 3);
      d.release();
      d.hanja(d.name, 1);
      v.shake = Math.max(v.shake, 0.25);
    });
    d.at(0.9, () => d.mark('여운'));
    d.at(1.4, () => { d.end(); d.mark(''); });
  },

  // 두목 · 독침 — 손끝에서 독침이 연달아 날아가 한 점에 박힌다 (차수마다 1·3·5·7개)
  'poison:frost'(d) {
    const v = d.v;
    const n = 1 + d.tier * 2;
    const tgt = d.hits[0]?.at || d.target;
    d.mark('기수식');
    d.pose([[0, '지법겨눔', 'out'], [0.12, '투척', 'snap'], [0.12 + n * 0.06, '투척'], [0.6 + n * 0.06, '마무리', 'inout']], 0.3);
    for (let i = 0; i < n; i++) {
      d.at(0.12 + i * 0.06, () => {
        if (i === 0) d.mark('시전');
        d.fx('dart', 0.16, { wx0: d.to.x, wy0: d.to.y, ox0: 22 * d.face, oy0: -66 + (i % 3 - 1) * 6,
          wx1: tgt.x, wy1: tgt.y, oy1: -62 + ((i * 7) % 5 - 2) * 4, v: d.tier });
      });
    }
    const H = 0.12 + (n - 1) * 0.06 + 0.16;
    d.at(H, () => {
      d.mark('적중');
      d.burst(tgt, 60, { puddle: 0, ring: d.tier >= 1, drops: 8 + d.tier * 3 });
      d.release();
      v.hitstop = Math.max(v.hitstop, 0.08);
      if (d.tier >= 3) {
        d.fx('skull', 1.2, { wx: tgt.x, wy: tgt.y, oy: -130, size: 24, v: d.tier });
        d.fx('cloud', 0.9, { wx: tgt.x, wy: tgt.y, r: 80, n: 10, v: d.tier, seeds: seeds(10), oy: -50 });
        v.flash = Math.max(v.flash, 0.2);
      }
      d.hanja(d.name, 1);
    });
    d.at(H + 0.3, () => d.mark('여운'));
    d.at(H + 0.7, () => { d.end(); d.mark(''); });
  },

  // 이동 · 사행보 — 독무로 흩어져 뱀처럼 기어가 겨눈 적 곁에서 다시 뭉친다
  'poison:blink'(d) {
    const v = d.v;
    const T = 0.34;
    d.mark('기수식');
    v.camHold = 0.08;
    d.pose([[0, '순보', 'step'], [T - 0.01, '순보'], [T, '땅짚기', 'step'], [T + 0.35, '땅짚기'], [T + 0.6, '마무리', 'inout']], 0.3);
    d.fx('cloud', 0.6, { wx: d.from.x, wy: d.from.y, r: 60, n: 9, v: d.tier, seeds: seeds(9), oy: -45 });
    d.at(0.06, () => {
      d.mark('시전');
      d.releasePath = () => {};   // 곧은 흰 길 대신 뱀이 지나간다
      d.path = null;
      d.fx('serpent', 0.5, { pts: [{ ...d.from, oy: -20 }, { ...d.to, oy: -20 }], go: 0.55, w: 6 + d.tier, body: 110, v: d.tier });
      d.focusBetween(d.to, d.target, 18);
    });
    d.at(T, () => {
      d.mark('적중');
      d.fx('cloud', 0.6, { wx: d.to.x, wy: d.to.y, r: 70, n: 10, v: d.tier, seeds: seeds(10), oy: -45 });
      d.burst(d.target, 90, { puddle: d.tier >= 2 ? 1.2 : 0, drops: 10 });
      if (d.tier >= 3) d.skulls(d.hits, 1);
      d.release();
      d.hanja(d.name, 1);
    });
    d.at(T + 0.5, () => { d.mark('여운'); d.unfocus(); });
    d.at(T + 0.9, () => { d.end(); d.mark(''); });
  },

  // 연쇄 · 독사 — 독사가 적에서 적으로 기어가며 문다. 머리가 닿는 순간 숫자가 뜬다.
  'poison:chain'(d) {
    const pts = (d.path?.path || []).map((q) => ({ x: q.x, y: q.y }));
    d.path = null;   // 번개 길은 안 그린다
    const start = { x: d.to.x, y: d.to.y, ox: 20 * d.face, oy: -64 };
    const all = [start, ...pts.map((q) => ({ ...q, oy: -40 }))];
    const segT = 0.09;
    const go = Math.max(0.2, pts.length * segT);
    const life = go + 0.35;
    d.mark('기수식');
    d.pose([[0, '투척준비', 'out'], [0.1, '흩뿌리기', 'snap'], [0.1 + go, '흩뿌리기'], [0.4 + go, '마무리', 'inout']], 0.3);
    d.at(0.1, () => {
      d.mark('시전');
      d.fx('serpent', life, { pts: all, go: go / life, w: 6 + d.tier, body: 90 + d.tier * 20, v: d.tier });
      if (d.tier >= 2) d.fx('serpent', life, { pts: all.map((q, i) => (i ? { ...q, oy: -52 } : q)), go: go / life, w: 4, body: 60, v: Math.max(0, d.tier - 1) });
    });
    // 머리가 i번째 적에 닿는 때 — 길이가 비슷하다고 보고 고르게 나눈다
    pts.forEach((q, i) => {
      d.at(0.1 + (go * (i + 1)) / pts.length, () => {
        if (i === 0) d.mark('적중');
        let best = null;
        let bd = Infinity;
        for (const h of d.hits) { const dd = Math.hypot(h.at.x - q.x, h.at.y - q.y); if (dd < bd) { bd = dd; best = h; } }
        if (best) d.releaseHit(best);
        d.burst(q, 45, { puddle: 0, ring: false, drops: 4 });
        if (d.tier >= 3 && i === pts.length - 1) d.fx('skull', 0.9, { wx: q.x, wy: q.y, oy: -110, size: 14, v: d.tier });
      });
    });
    d.at(0.12 + go, () => { d.release(); d.hanja(d.name, 1); });
    d.at(0.4 + go, () => d.mark('여운'));
    d.at(0.8 + go, () => { d.end(); d.mark(''); });
  },

  // 장판 · 독무진 — 큰 독 덩이를 던져 깨뜨리면 독 웅덩이가 남는다 (웅덩이 자체는 drawFields가 그린다)
  'poison:plum'(d) {
    const v = d.v;
    d.mark('기수식');
    d.pose([[0, '투척준비', 'out'], [0.18, '투척', 'snap'], [0.55, '투척'], [0.85, '마무리', 'inout']], 0.3);
    d.at(0.18, () => { d.mark('시전'); d.lob('pglob', 0.3, d.center, { size: 13 + d.tier * 2, h: 120, oy1: -10 }); });
    d.at(0.48, () => {
      d.mark('적중');
      d.burst(d.center, (d.radius || 190) * 0.9, { puddle: 0, drops: 18 + d.tier * 4 });
      d.fx('cloud', 0.8, { wx: d.center.x, wy: d.center.y, r: (d.radius || 190) * 0.7, n: 12, v: d.tier, seeds: seeds(12) });
      if (d.tier >= 3) d.fx('skull', 1, { wx: d.center.x, wy: d.center.y, oy: -120, size: 20, v: d.tier });
      d.release();
      d.hanja(d.name, 1);
      v.shake = Math.max(v.shake, 0.2);
    });
    d.at(0.9, () => d.mark('여운'));
    d.at(1.3, () => { d.end(); d.mark(''); });
  },

  // 관통 · 독시 — 독을 감은 화살이 일직선으로 꿰뚫고, 지나간 바닥이 타들어 간다
  'poison:pierce'(d) {
    const v = d.v;
    const L = 560;
    const go = 0.22;
    d.mark('기수식');
    v.faceOverride = d.aim;
    d.pose([[0, '투척준비', 'out'], [0.16, '투척', 'snap'], [0.6, '투척'], [0.9, '마무리', 'inout']], 0.3);
    d.at(0.16, () => {
      d.mark('시전');
      d.fx('vbolt', go / 0.4, { wx: d.to.x, wy: d.to.y, oy: -56, a: d.ang, len: L, go: 0.4, v: d.tier });
      d.fx('scar', 1.2 + d.tier * 0.4, { wx: d.to.x, wy: d.to.y, a: d.ang, len: L, v: d.tier });
      if (d.tier >= 2) d.fx('cloud', 0.9, { wx: d.to.x + Math.cos(d.ang) * L * 0.5, wy: d.to.y + Math.sin(d.ang) * L * 0.5 / v.squash, r: 120, n: 10, v: d.tier, seeds: seeds(10) });
    });
    // 화살 머리가 지나가는 차례대로 맞는다
    const victims = d.hits.slice();
    const ux = Math.cos(d.ang);
    const uy = Math.sin(d.ang);
    const along = (h) => Math.max(0, (h.at.x - d.to.x) * ux + (h.at.y - d.to.y) * v.squash * uy);
    for (const h of d.hits.slice()) {
      d.at(0.16 + go * Math.min(1, along(h) / L), () => {
        if (d.beat !== '적중') d.mark('적중');
        d.releaseHit(h);
        d.burst(h.at, 40, { puddle: 0, ring: false, drops: 4 });
      });
    }
    if (d.tier >= 3) d.at(0.2 + go, () => d.skulls(victims, 3));
    d.at(0.2 + go, () => { d.release(); d.hanja(d.name, 1); });
    d.at(0.7, () => { d.mark('여운'); v.faceOverride = 0; });
    d.at(1.1, () => { d.end(); d.mark(''); });
  },
};

// 검사(빠져 있던 다섯) · 권마 · 환마 · 극악소마 — skillfx_class.js
// 이미 있는 것(검사 축지·일자·빙결 형태)은 덮지 않는다.
Object.assign(FX, CLASS_FX, MAJON_FX);
Object.assign(CHOREO, MAJON_CHOREO);
for (const [k, fn] of Object.entries(CLASS_CHOREO)) if (!CHOREO[k]) CHOREO[k] = fn;
