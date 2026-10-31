// 다섯 마존의 무공 연출 (v119) — wdata.js JOB_SKILLS의 열다섯 무공 하나하나를 설정에 맞춰 짠다.
//   일화검존(검사)  흰 칼빛과 분홍 꽃 — 한 송이 꽃이 피고, 꽃잎이 지고, 만 송이가 하나로 모인다
//   불패권마(권마)  호박빛·금빛 — 산을 무너뜨리는 주먹 그림자, 네 번 두들기는 투신, 금빛 몸
//   섭혼마존(환마)  핏빛·보랏빛 — 혼을 거두는 눈, 핏빛 눈물, 하늘 밖 혈마의 술법진
//   독왕(독마)      초록 독 — 일곱 개 독침, 뼈를 녹이는 독무, 하늘을 덮는 독 그물
//   극악소마        가면과 핏빛 지력 — 재앙을 짚는 손가락, 광폭한 장력, 웃는 향기를 실은 비수 열두 자루
//
// 숫자는 skillfx.js 감독이 붙들었다 '적중' 박자에 푼다 — 여기서 정하는 건 언제·무엇을 그리느냐뿐.
// 피해·밸런스는 1도 안 바뀐다.
import { impact, beats, blinkBeats, buffBeats, COL, PLUM, rnd } from './skillfx_class.js';
import { POSES } from './pose.js';
import { jart, putJ, jobOfView } from './jobart.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const BLOOD = '220,38,38';
const SOUL = '192,132,252';
const GOLD = '253,224,71';
const GREEN = ['134,239,172', '220,252,231', '20,83,45'];
const MASK = ['168,85,247', '254,226,226', '59,7,100'];

// ---------- 그림 ----------
export const MAJON_FX = {
  // ---- 4차 필살 v129: 컷인 · 기 모으기 · 법상 · 화면 충격파 · 여운 · 직업 고유 ----
  // 컷인 — 비스듬한 띠가 왼쪽에서 쓸고 들어와 무인의 큰 모습과 무공 이름을 보여 주고 오른쪽으로 빠진다 (화면 좌표)
  cutin(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';
    const p = 1 - k;
    const T = e.max;
    const t = p * T;
    const inT = 0.16, outT = 0.18;
    const slide = t < inT ? 1 - (1 - t / inT) ** 3 : t > T - outT ? 1 + ((t - (T - outT)) / outT) ** 2 : 1;
    const w = v.w, H = Math.min(190, v.h * 0.24);
    const cy = v.h * 0.4;
    const off = (slide - 1) * w * 1.3;            // 1이면 제자리, 0이면 왼쪽 밖, 2면 오른쪽 밖
    ctx.save();
    ctx.translate(off, cy);
    ctx.transform(1, -0.14, 0, 1, 0, 0);          // 비스듬히
    // 띠
    const g = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
    g.addColorStop(0, `rgba(${e.col},0.95)`); g.addColorStop(0.5, 'rgba(12,8,6,0.94)'); g.addColorStop(1, `rgba(${e.col},0.95)`);
    ctx.fillStyle = g;
    ctx.fillRect(-40, -H / 2, w + 80, H);
    // v134: 직업마다 그린 컷인 배경을 띠에 깐다
    const bg = jart(`cut-${jobOfView(v)}`);
    if (bg) {
      ctx.save(); ctx.beginPath(); ctx.rect(-40, -H / 2, w + 80, H); ctx.clip();
      const bw = w + 80, bh = (bg.height * bw) / bg.width;
      ctx.globalAlpha *= 0.85;
      ctx.drawImage(bg, -40 - p * 60, -bh / 2 + H * 0.1, bw + 60, bh * (bw + 60) / bw);
      const sh = ctx.createLinearGradient(0, 0, w, 0);
      sh.addColorStop(0, 'rgba(8,5,3,0.15)'); sh.addColorStop(0.5, 'rgba(8,5,3,0.35)'); sh.addColorStop(1, 'rgba(8,5,3,0.65)');
      ctx.globalAlpha = 1; ctx.fillStyle = sh; ctx.fillRect(-40, -H / 2, w + 80, H);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-40, -H / 2 - 3, w + 80, 3); ctx.fillRect(-40, H / 2, w + 80, 3);
    // 속도선
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const yy = -H / 2 + ((i * 37) % 100) / 100 * H;
      const xx = ((((i * 61) % 100) / 100 + p * 3) % 1.2 - 0.1) * w;
      ctx.fillStyle = `rgba(${i % 3 ? e.col : '255,255,255'},0.35)`;
      ctx.fillRect(w - xx, yy, 40 + (i % 4) * 30, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 무인의 큰 모습 (띠 안에만)
    ctx.beginPath(); ctx.rect(-40, -H / 2, w + 80, H); ctx.clip();
    const sc = (H / 150) * 2.5;
    ctx.save();
    ctx.translate(w * 0.24 + Math.sin(p * 3) * 6, H / 2 + 34 * sc);
    ctx.scale(sc, sc);
    const glow = ctx.createRadialGradient(0, -70, 0, 0, -70, 90);
    glow.addColorStop(0, `rgba(${e.col},0.55)`); glow.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -70, 90, 0, TAU); ctx.fill();
    v.drawHeroAt(ctx, 0, 0, e.pose ? POSES[e.pose] : null, false, null);
    ctx.restore();
    // 이름
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.round(Math.min(H * 0.42, (w * 0.55) / Math.max(2, e.text.length)));
    ctx.font = `900 ${fs}px "Yuji Syuku", "Nanum Brush Script", serif`;
    const tx = w * 0.66, ty = -H * 0.06;
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(8,5,3,0.9)'; ctx.strokeText(e.text, tx, ty);
    ctx.fillStyle = `rgb(${e.col})`; ctx.fillText(e.text, tx, ty);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(e.text, tx - 2, ty - 2);
    if (e.sub) { ctx.font = `800 ${Math.round(fs * 0.3)}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,248,235,0.95)'; ctx.fillText(e.sub, tx, ty + fs * 0.66); }
    ctx.restore();
  },
  // 기 모으기 — 사방에서 빛 알갱이가 소용돌이치며 무인에게 빨려 든다, 발밑 고리가 조여든다
  converge(v, ctx, e, k) {
    const x = v.heroX, y = v.groundY - 50;
    const p = 1 - k;
    const n = e.n || 40;
    for (let i = 0; i < n; i++) {
      const ph = (p * 1.6 + (i * 0.618) % 1) % 1;
      const r = (1 - ph) * (e.r || 260) + 8;
      const a = i * 2.39996 + ph * 4;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.7;
      ctx.fillStyle = `rgba(${i % 4 ? e.col : '255,255,255'},${0.9 * ph * Math.min(1, k * 3)})`;
      ctx.beginPath(); ctx.arc(px, py, 1.4 + ph * 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(${e.col},${0.35 * ph})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x + Math.cos(a - 0.25) * (r + 26), y + Math.sin(a - 0.25) * (r + 26) * 0.7); ctx.stroke();
    }
    const rr = 140 * (1 - p) + 30;
    ctx.strokeStyle = `rgba(${e.col},${0.8 * Math.min(1, p * 3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, v.groundY, rr, rr * v.squash, 0, 0, TAU); ctx.stroke();
    const g = ctx.createRadialGradient(x, y, 0, x, y, 70 + p * 40);
    g.addColorStop(0, `rgba(255,255,255,${0.5 * p})`); g.addColorStop(0.4, `rgba(${e.col},${0.4 * p})`); g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 110, 0, TAU); ctx.fill();
  },
  // 법상 — 무인 뒤로 거대한 빛의 모습이 솟아올랐다 스러진다
  avatar(v, ctx, e, k) {
    const p = 1 - k;
    const rise = 1 - (1 - Math.min(1, p * 2.5)) ** 3;
    const a = Math.min(1, p * 3) * Math.min(1, k * 2.2);
    const sc = (e.scale || 3.2) * (0.85 + rise * 0.15);
    ctx.save();
    // v248: 더하기로 그리면 3.4배 금빛 화신이 밝은 바닥에서 흰 덩어리가 됐다 — 보통 합성으로 물든 그림자처럼
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha *= 0.38 * a;
    ctx.translate(v.heroX - 6 * (e.face || 1), v.groundY + 40 - rise * 30);
    ctx.scale(sc, sc);
    v.drawHeroAt(ctx, 0, 0, e.pose ? POSES[e.pose] : null, (e.face || 1) < 0, e.col);
    ctx.restore();
    // 테두리 빛
    const ga = v.lumTake ? v.lumTake(0.28 * a) : 0.28 * a;
    v.putGlow(ctx, e.col, v.heroX, v.groundY - 200 * rise, 260, ga);   // v248 밝기 예산 안에서 · 구운 빛
  },
  // 화면 충격파 — 무인(또는 정한 자리)에서 화면 끝까지 퍼지는 고리 셋과 흰 번쩍임
  screenwave(v, ctx, e, k) {
    const x = e.wx != null ? v.sx({ x: e.wx }) : v.heroX;
    const y = e.wy != null ? v.sy({ y: e.wy }) : v.groundY;
    const p = 1 - k;
    const R = Math.hypot(v.w, v.h);
    for (let i = 0; i < 3; i++) {
      const q = clamp01(p * 1.4 - i * 0.12);
      if (q <= 0) continue;
      const r = q * R;
      ctx.strokeStyle = `rgba(${i === 1 ? '255,255,255' : e.col},${0.85 * (1 - q)})`;
      ctx.lineWidth = 26 * (1 - q) + 3;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU); ctx.stroke();
    }
    const fl = Math.max(0, 1 - p * 4);
    if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${v.lumTake ? v.lumTake(0.28 * fl) : 0.28 * fl})`; ctx.fillRect(-20, -20, v.w + 40, v.h + 40); }
  },
  // 여운 — 화면 가득 빛 부스러기가 천천히 내려앉는다
  afterglow(v, ctx, e, k) {
    const p = 1 - k;
    const n = e.n || 50;
    for (let i = 0; i < n; i++) {
      const sx = ((i * 0.618034) % 1) * v.w;
      const sy = (((i * 0.3819) % 1) * 0.6 - 0.15 + p * (0.5 + (i % 5) * 0.12)) * v.h;
      const sz = 1.5 + (i % 4);
      ctx.fillStyle = `rgba(${i % 3 ? e.col : '255,255,255'},${0.8 * Math.min(1, k * 2)})`;
      ctx.save(); ctx.translate(sx + Math.sin(p * 6 + i) * 18, sy); ctx.rotate(p * 4 + i);
      if (e.shape === 'petal' && putJ(ctx, 'plum-petal', 0, 0, sz * 6, Math.min(1, k * 2))) { ctx.restore(); continue; }
      if (e.shape === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, sz * 2, sz, 0, 0, TAU); ctx.fill(); } else ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
  },
  // 일화천섬 고유 — 화면을 가르는 천 개의 칼빛, 마지막에 화면을 대각으로 베는 한 줄
  slashstorm(v, ctx, e, k) {
    const p = 1 - k;
    const n = e.n || 28;
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * 0.7;
      const q = clamp01((p - t0) / 0.18);
      if (q <= 0 || q >= 1) continue;
      const cx = ((i * 0.618034) % 1) * v.w, cy = (0.15 + ((i * 0.381966) % 1) * 0.7) * v.h;
      const a = ((i * 2.4) % Math.PI) - Math.PI / 2;
      const L = 120 + (i % 5) * 50;
      const dx = Math.cos(a) * L, dy = Math.sin(a) * L;
      const w = Math.sin(q * Math.PI) * 5 + 0.5;
      ctx.strokeStyle = `rgba(${i % 3 ? '255,255,255' : e.col},${0.95 * (1 - q * 0.6)})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(cx - dx * q, cy - dy * q); ctx.lineTo(cx + dx * q, cy + dy * q); ctx.stroke();
      ctx.strokeStyle = `rgba(${e.col},${0.25 * (1 - q)})`; ctx.lineWidth = w * 5;
      ctx.beginPath(); ctx.moveTo(cx - dx * q, cy - dy * q); ctx.lineTo(cx + dx * q, cy + dy * q); ctx.stroke();
    }
    // 마지막 한 줄 — 화면을 대각으로
    const q = clamp01((p - 0.78) / 0.14);
    if (q > 0) {
      const a = Math.min(1, (1 - p) * 6);
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 6 + Math.sin(q * Math.PI) * 10;
      ctx.beginPath(); ctx.moveTo(-40, v.h * 0.85); ctx.lineTo(-40 + (v.w + 80) * q, v.h * 0.85 - v.h * 0.7 * q); ctx.stroke();
      ctx.strokeStyle = `rgba(${e.col},${0.4 * a})`; ctx.lineWidth = 40;
      ctx.beginPath(); ctx.moveTo(-40, v.h * 0.85); ctx.lineTo(-40 + (v.w + 80) * q, v.h * 0.85 - v.h * 0.7 * q); ctx.stroke();
    }
  },
  // 투신강림 고유 — 땅이 물결처럼 들썩이는 띠가 화면 아래로 퍼진다
  quake(v, ctx, e, k) {
    const p = 1 - k;
    const x = v.heroX, y = v.groundY;
    for (let i = 0; i < 6; i++) {
      const q = clamp01(p * 1.5 - i * 0.1);
      if (q <= 0 || q >= 1) continue;
      const r = q * v.w * 1.2;
      ctx.strokeStyle = `rgba(${i % 2 ? e.col : '120,53,15'},${0.7 * (1 - q)})`;
      ctx.lineWidth = 10 * (1 - q) + 2;
      ctx.beginPath();
      for (let j = 0; j <= 40; j++) {
        const an = (j / 40) * TAU;
        const wob = 1 + Math.sin(an * 7 + i) * 0.05;
        const px = x + Math.cos(an) * r * wob, py = y + Math.sin(an) * r * wob * v.squash;
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  },
  // 극악소마 고유 — 하늘에 뜨는 핏빛 달과 붉은 번개
  bloodmoon(v, ctx, e, k) {
    const p = 1 - k;
    const a = Math.min(1, p * 4, k * 2.5);
    const mx = v.w * 0.72, my = v.h * 0.16, R = Math.min(v.w, v.h) * 0.12;
    const g = ctx.createRadialGradient(mx, my, R * 0.4, mx, my, R * 3);
    g.addColorStop(0, `rgba(220,38,38,${0.55 * a})`); g.addColorStop(1, 'rgba(220,38,38,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, R * 3, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    if (!putJ(ctx, 'blood-moon', mx, my, R * 2.6, a)) {
    ctx.fillStyle = `rgba(153,27,27,${0.92 * a})`; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(69,10,10,${0.6 * a})`; ctx.beginPath(); ctx.arc(mx + R * 0.3, my - R * 0.1, R * 0.28, 0, TAU); ctx.arc(mx - R * 0.35, my + R * 0.3, R * 0.18, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const b of e.bolts || []) {
      const q = clamp01((p - b.t) / 0.12);
      if (q <= 0 || q >= 1) continue;
      const x1 = v.sx({ x: b.wx }), y1 = v.sy({ y: b.wy }) - 40;
      ctx.strokeStyle = `rgba(254,202,202,${1 - q})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my);
      for (let j = 1; j <= 7; j++) { const f = j / 7; ctx.lineTo(mx + (x1 - mx) * f + (j < 7 ? ((b.s * (j * 97)) % 1 - 0.5) * 40 : 0), my + (y1 - my) * f); }
      ctx.stroke();
      ctx.strokeStyle = `rgba(220,38,38,${0.5 * (1 - q)})`; ctx.lineWidth = 10; ctx.stroke();
    }
  },
  // 환영분신술 고유 — 화면이 거울처럼 금 가고 보랏빛 나비 떼가 날아오른다
  shatter(v, ctx, e, k) {
    const p = 1 - k;
    const x = v.heroX, y = v.groundY - 60;
    const grow = Math.min(1, p * 3);
    const a = Math.min(1, k * 2);
    ctx.strokeStyle = `rgba(233,213,255,${0.85 * a})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const an = i * 0.4488 + 0.2;
      const L = Math.hypot(v.w, v.h) * grow * (0.5 + ((i * 37) % 10) / 20);
      ctx.beginPath(); ctx.moveTo(x, y);
      let px = x, py = y;
      for (let j = 1; j <= 5; j++) { px = x + Math.cos(an + (((i + j) * 13) % 7 - 3) * 0.03) * L * j / 5; py = y + Math.sin(an) * L * j / 5; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    for (let i = 0; i < 24; i++) {
      const ph = (p * 0.9 + i / 24) % 1;
      const bx = x + Math.sin(i * 1.7 + p * 3) * (60 + ph * 220), by = y - ph * 320 + Math.cos(i) * 30;
      const flap = Math.abs(Math.sin(p * 30 + i));
      ctx.fillStyle = `rgba(${i % 3 ? '192,132,252' : '254,226,226'},${0.85 * (1 - ph) * a})`;
      ctx.beginPath(); ctx.ellipse(bx - 5 * flap, by, 6 * flap + 1, 4, -0.5, 0, TAU); ctx.ellipse(bx + 5 * flap, by, 6 * flap + 1, 4, 0.5, 0, TAU); ctx.fill();
    }
  },
  // 만독지옥 고유 — 독기 물결이 화면 아래에서 차오르고, 큰 해골이 무인 뒤 하늘에 뜬다
  toxicwave(v, ctx, e, k) {
    const p = 1 - k;
    const a = Math.min(1, p * 3, k * 2);
    const top = v.h * (1 - 0.55 * Math.min(1, p * 1.5));
    const g = ctx.createLinearGradient(0, top, 0, v.h);
    g.addColorStop(0, 'rgba(134,239,172,0)'); g.addColorStop(0.3, `rgba(74,222,128,${0.28 * a})`); g.addColorStop(1, `rgba(20,83,45,${0.5 * a})`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-20, v.h + 20);
    for (let j = 0; j <= 30; j++) { const xx = (j / 30) * (v.w + 40) - 20; ctx.lineTo(xx, top + Math.sin(j * 0.9 + p * 10) * 14); }
    ctx.lineTo(v.w + 20, v.h + 20); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 18; i++) {
      const ph = (p * 1.3 + i / 18) % 1;
      ctx.strokeStyle = `rgba(187,247,208,${0.7 * (1 - ph) * a})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(((i * 0.618) % 1) * v.w, top + 30 + (1 - ph) * (v.h - top), 3 + ph * 7, 0, TAU); ctx.stroke();
    }
  },

  // ---- 4차 필살 공통 (v124) ----
  // 먹띠 — 화면 위아래로 검은 띠가 들어왔다 나간다(영화처럼). 화면 좌표.
  letterbox(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';
    const p = 1 - k;
    const open = Math.min(1, p * 6, k * 5);
    const hh = v.h * 0.11 * open;
    ctx.fillStyle = 'rgba(6,4,3,0.92)';
    ctx.fillRect(-20, -20, v.w + 40, hh + 20);
    ctx.fillRect(-20, v.h - hh, v.w + 40, hh + 20);
    ctx.fillStyle = `rgba(${e.col},${0.9 * open})`;
    ctx.fillRect(-20, hh, v.w + 40, 2);
    ctx.fillRect(-20, v.h - hh - 2, v.w + 40, 2);
  },
  // 빛살 — 무인에게서 화면 끝까지 뻗는 빛줄기가 천천히 돌고, 화면이 그 빛깔로 물든다
  rays(v, ctx, e, k) {
    const x = v.heroX, y = v.groundY - 60;
    const p = 1 - k;
    const a = Math.min(1, p * 4, k * 2.5);
    const R = Math.hypot(v.w, v.h);
    const ta = v.lumTake ? v.lumTake(0.24 * a) : 0.24 * a;
    if (ta > 0) v.putGlow(ctx, e.col, x, y, R * 0.7, ta);   // v245 밝기 예산 안에서 · 구운 빛
    const n = e.n || 14;
    ctx.translate(x, y);
    ctx.rotate(p * (e.spin || 0.6));
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      const w = 0.05 + ((i * 37) % 5) * 0.012;
      ctx.fillStyle = `rgba(${i % 3 ? e.col : '255,255,255'},${0.13 * a})`;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * Math.cos(-w), R * Math.sin(-w)); ctx.lineTo(R * Math.cos(w), R * Math.sin(w)); ctx.closePath(); ctx.fill();
    }
  },
  // 큰 인장 — 발밑에 두 겹 원과 도는 글자(이름 글자를 둘레에 새긴다)
  bigseal(v, ctx, e, k) {
    const x = v.sx({ x: e.wx }), y = v.sy({ y: e.wy });
    const p = 1 - k;
    const a = Math.min(1, p * 5, k * 3);
    const R = (e.r || 200) * (0.6 + 0.4 * Math.min(1, p * 3));
    ctx.translate(x, y);
    ctx.scale(1, v.squash);
    ctx.rotate(p * 1.2);
    // v134: 직업 인장 그림을 크게 깐다 (글자 고리는 그 위에)
    // v248: 먹빛 테를 먼저 깔고 그림 빛은 0.9 → 0.5 — 밝은 바닥에서 지름 500짜리 흰 원판이 되던 것
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(20,14,10,${0.4 * a})`; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    const sealed = putJ(ctx, `seal-${jobOfView(v)}`, 0, 0, R * 2.05, 0.5 * a);
    ctx.strokeStyle = `rgba(${e.col},${0.9 * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    if (!sealed) {
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2); ctx.stroke();
    }
    // 팔괘처럼 나뉜 살
    if (!sealed) for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.42, Math.sin(an) * R * 0.42); ctx.lineTo(Math.cos(an) * R * 0.82, Math.sin(an) * R * 0.82); ctx.stroke(); }
    const txt = e.text || '';
    ctx.fillStyle = `rgba(${e.col},${a})`;
    ctx.font = `900 ${Math.round(R * 0.13)}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const an = (i * Math.PI * 2) / 12;
      ctx.save(); ctx.rotate(an); ctx.translate(0, -R * 0.91); ctx.fillText(txt[i % Math.max(1, txt.length)] || '', 0, 0); ctx.restore();
    }
  },
  // 한복판 큰 글자 — 무공 이름이 붓으로 쾅 찍힌다
  bigname(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';
    const p = 1 - k;
    const pop = p < 0.12 ? 1.6 - (p / 0.12) * 0.6 : 1;
    const a = Math.min(1, k * 3);
    const x = v.w / 2, y = v.h * 0.3;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.font = `900 ${Math.round(Math.min(v.w / (e.text.length + 0.6), 90))}px "Yuji Syuku", "Nanum Brush Script", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = `rgba(10,6,4,${0.85 * a})`; ctx.strokeText(e.text, 0, 0);
    ctx.fillStyle = `rgba(${e.col},${a})`; ctx.fillText(e.text, 0, 0);
    ctx.fillStyle = `rgba(255,255,255,${0.6 * a})`; ctx.fillText(e.text, -2, -2);
    // 낙관
    ctx.fillStyle = `rgba(185,28,28,${a})`;
    ctx.fillRect(e.text.length * 26, 10, 26, 26);
    ctx.fillStyle = `rgba(255,240,230,${a})`; ctx.font = '900 16px serif'; ctx.fillText('極', e.text.length * 26 + 13, 24);
  },
  // 꽃잎 폭풍 — 화면을 가로지르는 꽃잎 떼 (일화천섬)
  petalstorm(v, ctx, e, k) {
    const p = 1 - k;
    for (let i = 0; i < 60; i++) {
      const sd = (i * 97.13) % 1;
      const yy = ((i * 53) % 100) / 100 * v.h;
      const xx = ((sd + p * (1.2 + (i % 5) * 0.15)) % 1.2 - 0.1) * v.w;
      ctx.save(); ctx.translate(xx, yy + Math.sin(p * 9 + i) * 14); ctx.rotate(p * 8 + i);
      if (i % 4 && putJ(ctx, 'plum-petal', 0, 0, 16 + (i % 3) * 5, 0.95 * Math.min(1, k * 3))) { ctx.restore(); continue; }
      ctx.fillStyle = `rgba(${i % 4 ? '251,207,232' : '255,255,255'},${0.85 * Math.min(1, k * 3)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  },
  // 꽃 한 송이가 피어난다 — 다섯 잎이 돌며 벌어지고 가운데가 번쩍인다 (세워서 그린다)
  bloom(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) + (e.oy ?? -50);
    const p = 1 - k;
    const open = 1 - (1 - Math.min(1, p * 2.4)) ** 3;
    const R = (e.r || 40) * (0.3 + 0.7 * open);
    const n = e.n || 5;
    ctx.translate(x, y);
    ctx.rotate((e.spin || 1) * p * 1.6);
    // v134: 그린 매화 한 송이 — 매화빛일 때만 (다른 빛 꽃은 옛 그대로)
    if ((!e.col || e.col === PLUM) && jart('plum-flower')) {
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
      gl.addColorStop(0, `rgba(255,255,255,${0.5 * k})`); gl.addColorStop(1, `rgba(${PLUM},0)`);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, R * 1.3, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      putJ(ctx, 'plum-flower', 0, 0, R * 2.3, Math.min(1, k * 1.6));
      return;
    }
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / n);
      const g = ctx.createRadialGradient(0, -R * 0.55, 0, 0, -R * 0.55, R * 0.65);
      g.addColorStop(0, `rgba(255,255,255,${0.55 * k})`);
      g.addColorStop(0.5, `rgba(${e.col || PLUM},${0.6 * k})`);
      g.addColorStop(1, `rgba(${e.col || PLUM},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.55, R * 0.32, R * 0.6, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = `rgba(253,224,71,${k})`;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(1, R * 0.16), 0, TAU); ctx.fill();
  },

  // 비수 — (wx0,wy0)에서 (wx1,wy1)로 호를 그리며 돌아 날아가 꽂힌다
  dagger(v, ctx, e, k) {
    const p = clamp01((1 - k) * (e.max / (e.go || e.max)));
    const x0 = v.sx({ x: e.wx0 }) + (e.ox0 || 0), y0 = v.sy({ y: e.wy0 }) + (e.oy0 ?? -60);
    const x1 = v.sx({ x: e.wx1 }), y1 = v.sy({ y: e.wy1 }) + (e.oy1 ?? -48);
    const q = 1 - (1 - p) ** 2;
    const x = x0 + (x1 - x0) * q;
    const y = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * (e.h || 60);
    // 꼬리
    ctx.strokeStyle = `rgba(${e.col || MASK[0]},${0.5 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const t = Math.max(0, q - i * 0.04);
      const xx = x0 + (x1 - x0) * t, yy = y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * (e.h || 60);
      if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
    }
    ctx.stroke();
    ctx.translate(x, y);
    ctx.rotate(p >= 1 ? Math.atan2(y1 - y0, x1 - x0) : (e.spin ?? 1) * p * 18);
    ctx.globalCompositeOperation = 'source-over';
    if (putJ(ctx, 'dagger', 2, 0, 34, k)) return;
    ctx.fillStyle = `rgba(241,245,249,${k})`;
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(0, -2.6); ctx.lineTo(-6, 0); ctx.lineTo(0, 2.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(${e.col || MASK[0]},${k})`;
    ctx.fillRect(-10, -1.6, 4.5, 3.2);
  },

  // 핏빛 눈물 — 자리 둘레 하늘에서 붉은 방울이 떨어져 번진다
  tears(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';   // 어두운 빛(눈구멍·핏자국)이 살아야 한다
    const p = 1 - k;
    const cx = v.sx({ x: e.wx }), cy = v.sy({ y: e.wy });
    for (const [a, b, c] of e.seeds) {
      const t = clamp01((p - c * 0.5) * 2.2);
      if (t <= 0) continue;
      const x = cx + (a - 0.5) * 2 * e.r;
      const gy = cy + (b - 0.5) * 2 * e.r * v.squash * 0.6;
      if (t < 0.7) {
        const y = gy - 160 + (t / 0.7) * 160;
        ctx.fillStyle = `rgba(${BLOOD},${0.9 * k})`;
        ctx.beginPath(); ctx.ellipse(x, y, 2.6, 5.5, 0, 0, TAU); ctx.fill();
      } else {
        const s = (t - 0.7) / 0.3;
        ctx.fillStyle = `rgba(127,29,29,${0.55 * (1 - s) * k + 0.1})`;
        ctx.beginPath(); ctx.ellipse(x, gy, 4 + s * 10, (4 + s * 10) * 0.4, 0, 0, TAU); ctx.fill();
      }
    }
  },

  // 금빛 몸 — 무인을 감싸는 금빛 테와 위로 오르는 금가루 (무인에 붙어 따라간다)
  goldbody(v, ctx, e, k) {
    const x = v.heroX, y = v.groundY;
    const p = 1 - k;
    const pulse = 0.75 + Math.sin(p * 30) * 0.25;
    v.putGlow(ctx, GOLD, x, y - 55, 90, 0.5 * k * pulse, 1.3);   // v245 구운 빛
    if (!putJ(ctx, 'gold-aura', x, y - 62, 112 + p * 10, 0.75 * k * pulse)) {
    ctx.strokeStyle = `rgba(254,240,138,${0.8 * k})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y - 55, 34 + p * 8, 62 + p * 8, 0, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const ph = (p * 2.5 + i / 14) % 1;
      ctx.fillStyle = `rgba(254,240,138,${(1 - ph) * k})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.1) * 36, y - ph * 130, 2.4 * (1 - ph) + 0.6, 0, TAU); ctx.fill();
    }
  },

  // 섭혼의 눈 — 대상 머리 위에 핏빛 눈이 떠서 뜨였다 감긴다
  eye(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';   // 어두운 빛(눈구멍·핏자국)이 살아야 한다
    const x = v.sx({ x: e.wx }), y = v.sy({ y: e.wy }) + (e.oy ?? -120);
    // v246: 0.15초에 번쩍 뜨고 멎음이 끝날 때까지 떠 있다가 0.25초에 감긴다(전엔 사는 동안 천천히 떴다 감겨 멎음 표식 구실을 못 했다)
    const el = e.max * (1 - k), rem = e.max * k;
    const o0 = Math.max(0, Math.min(1, el / 0.15, rem / 0.25));
    const open = o0 * (2 - o0) * (0.92 + 0.08 * Math.sin(el * 7));
    const R = e.r || 26;
    ctx.translate(x, y);
    v.putGlow(ctx, SOUL, 0, 0, R * 2, 0.45 * open);
    if (putJ(ctx, 'blood-eye', 0, 0, R * 3.4, Math.min(1, open * 1.5), 0, Math.max(0.05, open))) return;
    ctx.fillStyle = `rgba(254,226,226,${0.9 * open})`;
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.quadraticCurveTo(0, -R * open, R, 0); ctx.quadraticCurveTo(0, R * open, -R, 0); ctx.fill();
    ctx.fillStyle = `rgba(${BLOOD},${open})`;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.42 * open, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(20,0,0,${open})`;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.12, R * 0.36 * open, 0, 0, TAU); ctx.fill();
  },

  // 금종 — 무인 위에서 금빛 종이 내려와 덮는다 (금종조)
  bell(v, ctx, e, k) {
    const p = 1 - k;
    const x = v.heroX, y = v.groundY;
    const drop = Math.min(1, p * 3);
    const top = y - 150 + drop * 40;
    const a = Math.min(1, k * 2.5);
    ctx.globalCompositeOperation = 'source-over';
    if (putJ(ctx, 'gold-bell', x, top + 52, 118, 0.85 * a)) {
      ctx.globalCompositeOperation = 'lighter';
      putJ(ctx, 'gold-bell', x, top + 52, 124, 0.25 * a * (0.6 + 0.4 * Math.sin(p * 40)));
      return;
    }
    ctx.fillStyle = `rgba(${GOLD},${0.22 * a})`;
    ctx.strokeStyle = `rgba(254,240,138,${0.9 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 14, top);
    ctx.quadraticCurveTo(x - 30, top + 20, x - 34, top + 60);
    ctx.quadraticCurveTo(x - 38, top + 100, x - 52, top + 112);
    ctx.lineTo(x + 52, top + 112);
    ctx.quadraticCurveTo(x + 38, top + 100, x + 34, top + 60);
    ctx.quadraticCurveTo(x + 30, top + 20, x + 14, top);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 44, top + 96); ctx.lineTo(x + 44, top + 96); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, top - 6, 7, 0, TAU); ctx.stroke();
  },

  // 가면 — 웃는 흰 탈이 잠깐 떠올랐다 사라진다 (극악소마)
  mask(v, ctx, e, k) {
    ctx.globalCompositeOperation = 'source-over';   // 어두운 빛(눈구멍·핏자국)이 살아야 한다
    const x = e.wx != null ? v.sx({ x: e.wx }) : v.heroX;
    const y = (e.wy != null ? v.sy({ y: e.wy }) : v.groundY) + (e.oy ?? -150);
    const p = 1 - k;
    const a = Math.sin(Math.min(1, p * 1.2) * Math.PI);
    const s = (e.size || 30) * (0.8 + p * 0.4);
    ctx.translate(x, y);
    ctx.globalAlpha *= a;
    const drew = putJ(ctx, 'mask', 0, 0, s * 2.2);
    if (drew && !e.crack) return;
    if (!drew) {
    ctx.fillStyle = 'rgba(241,245,249,0.95)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(15,10,20,0.95)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.32, -s * 0.18, s * 0.2, s * 0.07, sx * 0.35, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = `rgba(${BLOOD},0.95)`;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.arc(0, s * 0.18, s * 0.42, 0.2, Math.PI - 0.2); ctx.stroke();
    }
    if (e.crack) {
      // 무면개방: 가면이 가운데로 갈라진다
      ctx.strokeStyle = 'rgba(15,10,20,0.95)';
      ctx.lineWidth = 2;
      const o = p * 10;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(-3 - o * 0.2, -s * 0.4); ctx.lineTo(3, 0); ctx.lineTo(-2, s * 0.5); ctx.lineTo(0, s); ctx.stroke();
    }
  },
};

// ---------- 연출표 ----------
// d.to = 무인 자리 · d.target = 첫 과녁 · d.center = 광역이 떨어지는 자리 · d.hits = 붙든 숫자들
const hitsOr = (d, n = 8) => (d.hits.length ? d.hits.slice(0, n).map((h) => h.at) : [d.target]);

// 4차 필살 공통 (v124): 먹띠 · 빛살 · 발밑 큰 인장 · 화면 한복판 큰 이름 · 화면이 잠깐 어두워진다(무인과 빛만 산다)
// v129: + 컷인(무인의 큰 모습과 이름 띠) · 기 모으기 · 무인 뒤 거대한 법상 · 마지막에 climax()
// v245 잔상 — 무인 뒤(또는 at 둘레)에 물든 그림자 무인 여럿이 서로 다른 자세로 섰다 옅어진다.
// d.fx('ghost', …)에 자리·자세 없이 부르던 세 곳(전광석화·미혼환무·귀영난무)이 아무것도 안 그렸다.
function shadows(d, col, n, poses, at = null, R = 60) {
  for (let i = 0; i < n; i++) {
    const a = at ? (i / n) * Math.PI * 2 : 0;
    const wx = at ? at.x + Math.cos(a) * R : d.to.x - d.face * (26 + i * 24);
    const wy = at ? at.y + Math.sin(a) * R / (d.v.squash || 0.6) * 0.6 : d.to.y + (i % 2 ? 12 : -12);
    d.ghost(wx, wy, poses[i % poses.length], 0.55 + i * 0.12, { a0: 0.62 - i * 0.07, fade: 1, tint: col, flip: at ? Math.cos(a) > 0 : d.face < 0 });
  }
}
function ultimate(d, col, text, dur, o = {}) {
  const v = d.v;
  if (d.lvl <= 0) { d.hanja(d.name, 1); return; }
  d.fx('letterbox', dur + 0.4, { col });
  d.fx('converge', 0.55, { col, n: d.lvl >= 2 ? 48 : 24, r: 300 });
  d.fx('rays', dur * 0.9, { col, n: d.lvl >= 2 ? 22 : 12, spin: 0.8 });
  d.fx('bigseal', dur, { wx: d.to.x, wy: d.to.y, r: 250, col, text });
  d.fx('avatar', dur + 0.2, { col, pose: o.avatarPose || '기모으기', face: d.face, scale: 3.4 });
  d.at(0.05, () => d.fx('cutin', 0.95, { col, text, sub: o.sub || d.name, pose: o.cutPose || '기모으기' }));
  d.at(1.0, () => d.fx('bigname', Math.min(1.2, dur * 0.6), { text, col }));
  v.desatTo = 0.6;
  v.camHold = Math.max(v.camHold || 0, 0.25);
  d.at(dur * 0.9, () => { v.desatTo = 0; });
}
// 필살의 마지막 한 방 — 화면 끝까지 퍼지는 충격파 · 흰 번쩍임 · 멈칫 · 여운
function climax(d, col, at, o = {}) {
  const v = d.v;
  if (d.lvl <= 0) return;
  d.fx('screenwave', 0.9, { col, wx: at?.x, wy: at?.y });
  d.fx('afterglow', 1.6, { col, n: d.lvl >= 2 ? 60 : 30, shape: o.shape });
  v.hitstop = Math.max(v.hitstop || 0, 0.16);
  v.flash = Math.max(v.flash, 0.4);
  v.shake = Math.max(v.shake, 0.6);
}

export const MAJON_CHOREO = {
  // ===== 4차 필살 (v124: 더 화려하게) =====
  // 일화검존 일화천섬 — 먹띠가 내려앉고 꽃잎 폭풍이 화면을 쓸면, 사라진 무인이 적 사이를 번개처럼 오가며 벤다.
  //   벤 자리를 잇는 빛줄이 남고, 마지막에 큰 꽃이 터진다.
  'sword:m4'(d) {
    const v = d.v;
    const c = COL.sword;
    const list = d.hits.slice();
    const gap = 0.06;
    const end = 0.45 + list.length * gap;
    ultimate(d, PLUM, '一花千閃', end + 0.6, { cutPose: '발도준비', avatarPose: '일섬', sub: '일화검존 · 일화천섬' });
    if (d.lvl >= 1) d.at(0.33, () => d.fx('slashstorm', end - 0.2, { col: PLUM, n: d.lvl >= 2 ? 34 : 18 }));
    d.mark('기수식');
    d.pose([[0, '발도준비', 'out'], [0.3, '발도준비'], [0.35, '순보', 'step'], [0.37 + list.length * gap, '순보'], [end, '일섬', 'snap'], [end + 0.45, '납도', 'inout']], 0.3);
    d.at(0.1, () => d.fx('petalstorm', end + 0.6, {}));
    d.at(0.33, () => { d.mark('시전'); d.fx('speedlines', 0.3 + list.length * gap, { col: c[1], seed: Math.random() * 6 }); });
    let prev = d.to;
    list.forEach((h, i) => d.at(0.37 + i * gap, () => {
      d.fx('skyline', 0.5, { wx: prev.x, wy: prev.y, a: Math.atan2((h.at.y - prev.y) * v.squash, h.at.x - prev.x), len: Math.hypot(h.at.x - prev.x, (h.at.y - prev.y) * v.squash), oy: -50 });
      prev = h.at;
      // v248: 잔상은 세 번에 하나 — 열두 연타면 한 프레임에 잔상 열 개를 새로 그려 저사양에서 끊겼다
      if (i % 3 === 0) d.ghost(h.at.x - 26 * (i % 2 ? 1 : -1), h.at.y + 6, '일섬', 0.4, { a0: 0.8, tint: PLUM, flip: i % 2 === 0 });
      d.fx('cutline', 0.35, { wx: h.at.x, wy: h.at.y, a: 0.4 + i * 0.9 });
      d.fx('bloom', 0.7, { wx: h.at.x, wy: h.at.y, r: 34, col: PLUM, oy: -55 });
      d.releaseHit(h);
      v.shake = Math.max(v.shake, 0.1);
    }));
    d.at(end, () => {
      d.mark('적중'); d.release();
      d.fx('bloom', 1.1, { wx: d.to.x, wy: d.to.y, r: 130, n: 8, col: '244,114,182', oy: -80, spin: 2 });
      impact(d, d.to, 260, c, { rings: 3, flare: true, sparks: 18, col: PLUM });
      climax(d, PLUM, d.to, { shape: 'petal' });
    });
    d.at(end + 0.5, () => d.mark('여운'));
    d.at(end + 0.85, () => { d.end(); d.mark(''); });
  },
  // 불패권마 투신강림 — 금빛 빛살 속에 권갑 투신이 깨어난다: 하늘에서 거대한 주먹 여섯이 꽂히고 땅이 갈라진다
  'fist:m4'(d) {
    const v = d.v;
    const c = [GOLD, '255,251,235', '120,53,15'];
    ultimate(d, GOLD, '鬪神降臨', 1.9, { cutPose: '정권', avatarPose: '진각', sub: '불패권마 · 투신강림' });
    d.mark('기수식');
    d.pose([[0, '마보', 'out'], [0.45, '마보'], [0.55, '진각', 'snap'], [0.9, '정권', 'snap'], [1.3, '마무리', 'inout']], 0.3);
    d.fx('motes', 0.6, { n: 24, face: d.face, r: 120, dx: 0, dy: -52, col: GOLD, seeds: rnd(24) });
    d.at(0.5, () => {
      d.mark('시전');
      d.fx('goldbody', 3.4, {});
      d.fx('skybeam', 1.0, { wx: d.to.x, wy: d.to.y, oy: -40, col: GOLD });
      v.flash = Math.max(v.flash, 0.25);   // v248: 0.45 흰 번쩍이 떨어지는 주먹을 덮었다
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const at = { x: d.to.x + Math.cos(a) * 150, y: d.to.y + Math.sin(a) * 80 };
      d.at(0.6 + i * 0.08, () => {
        // v248: 0.07초에 떨어져 안 보이던 하늘 주먹 — 0.25초 동안 크게 떨어진다
        d.fx('fistimg', 0.45, { wx0: at.x, wy0: at.y - 300, oy0: -60, wx1: at.x, wy1: at.y, oy1: -30, size: 84, col: GOLD, hot: c[1], go: 0.55, drop: true, solid: true });
        d.at(0.85 + i * 0.08, () => { d.fx('shock', 0.5, { wx: at.x, wy: at.y, r: 90, col: GOLD, rings: 2, w: 6 }); d.fx('crack', 1.0, { wx: at.x, wy: at.y, r: 80, col: c[1], seed: Math.random() * 99, n: 6 }); v.shake = Math.max(v.shake, 0.22); });
      });
    }
    d.at(1.2, () => {
      d.mark('적중'); d.release();
      d.fx('fistimg', 0.5, { wx0: d.to.x, wy0: d.to.y - 320, oy0: -60, wx1: d.to.x, wy1: d.to.y, oy1: -40, size: 130, col: GOLD, hot: c[1], go: 0.5, drop: true, solid: true });
      d.at(1.45, () => {
        impact(d, d.to, 300, c, { rings: 3, crack: true, sparks: 22 });
        climax(d, GOLD, d.to);
        if (d.lvl >= 1) {
          d.fx('quake', 1.0, { col: GOLD });
          // 튀어 오르는 돌 부스러기
          for (let i = 0; i < (d.lvl >= 2 ? 26 : 12); i++) {
            const a = Math.random() * TAU, sp = 120 + Math.random() * 260;
            v.particles.push({ x: v.heroX, y: v.groundY - 10, vx: Math.cos(a) * sp, vy: -220 - Math.random() * 260, life: 0.9 + Math.random() * 0.4, size: 3 + Math.random() * 4, color: i % 3 ? 'rgb(120,53,15)' : 'rgb(253,224,71)', drop: true });
          }
        }
      });
    });
    d.at(1.6, () => d.mark('여운'));
    d.at(1.95, () => { d.end(); d.mark(''); });
  },
  // 독왕 만독지옥 — 하늘이 독빛으로 물들고 독비가 사냥터를 덮는다. 독사가 적들을 꿰고, 해골이 줄지어 떠오른다.
  'poison:m4'(d) {
    const v = d.v;
    ultimate(d, GREEN[0], '萬毒地獄', 2.0, { cutPose: '흩뿌리기', avatarPose: '땅짚기', sub: '독왕 · 만독지옥' });
    if (d.lvl >= 1) d.at(0.4, () => d.fx('toxicwave', 1.8, {}));
    beats(d, [[0, '흩뿌리기', 'out'], [0.5, '흩뿌리기'], [0.6, '땅짚기', 'snap'], [1.5, '마무리', 'inout']], {
      cast: 0.15, hit: 1.05, end: 2.0, shake: 0.4, name: false,
      onCast: () => {
        d.fx('miasma', 2.0, { now: 0, v: 3 });
        d.fx('sigil', 1.9, { wx: d.to.x, wy: d.to.y, r: 420, col: '34,197,94', n: 36, spin: 1, dark: '20,83,45' });
        const spots = hitsOr(d, 18);
        for (const [i, at] of spots.entries()) d.at(0.2 + i * 0.035, () => d.fx('rainfall', 1.1, { wx: at.x, wy: at.y, r: 140, v: 3 }));
        const pts = hitsOr(d, 8).map((at) => ({ x: at.x, y: at.y }));
        if (pts.length > 1) d.at(0.5, () => d.fx('serpent', 1.1, { pts: [{ x: d.to.x, y: d.to.y }, ...pts], go: 0.85, v: 3, w: 10, body: 160 }));
        d.at(0.45, () => d.lob('pglob', 0.4, d.target, { fly: 0.38, size: 16, h: 160 }));
      },
      onHit: () => {
        for (const at of hitsOr(d, 14)) d.burst(at, 90, { puddle: 1.2, drops: 8 });
        d.skulls(d.hits, 8);
        // v248: 무인 머리 위 -260이라 무인이 화면 끝이면 반이 잘렸다 — 독이 퍼진 한가운데 위에
        d.fx('skull', 1.4, { wx: d.center.x, wy: d.center.y, oy: -190, size: 90, v: 3 });
        climax(d, GREEN[0], d.to);
      },
    });
  },
  // 극악소마 삼공합일 — 핏빛 빛살 속 거대한 웃는 가면. 지풍이 꿰고, 장력이 휩쓸고, 비수 스물넷이 쏟아진다.
  'ring:m4'(d) {
    const v = d.v;
    const c = [BLOOD, '254,226,226', '69,10,10'];
    ultimate(d, BLOOD, '三功合一', 1.8, { cutPose: '지법겨눔', avatarPose: '쌍장', sub: '극악소마 · 삼공합일' });
    if (d.lvl >= 1) d.fx('bloodmoon', 2.0, { bolts: hitsOr(d, 8).map((at, i) => ({ wx: at.x, wy: at.y, t: 0.35 + i * 0.07, s: Math.random() })) });
    beats(d, [[0, '지법겨눔', 'out'], [0.3, '손가락튕김', 'snap'], [0.55, '쌍장', 'snap'], [0.8, '흩뿌리기', 'snap'], [1.3, '마무리', 'inout']], {
      cast: 0.05, hit: 0.95, end: 1.8, shake: 0.45, name: false,
      onCast: () => {
        d.fx('mask', 1.7, { oy: -200, size: 60 });
        d.fx('tears', 1.6, { wx: d.to.x, wy: d.to.y, r: 260, seeds: rnd(30) });
        d.at(0.3, () => {
          for (const at of hitsOr(d, 5)) d.fx('lance', 0.35, { wx: d.to.x, wy: d.to.y, a: Math.atan2((at.y - d.to.y) * v.squash, at.x - d.to.x), len: Math.hypot(at.x - d.to.x, (at.y - d.to.y) * v.squash) + 30, w: 5, col: BLOOD, oy: -62 });
          v.flash = Math.max(v.flash, 0.3);
        });
        d.at(0.55, () => { d.fx('shock', 0.7, { wx: d.to.x, wy: d.to.y, r: 320, col: MASK[0], rings: 3, w: 8 }); d.fx('crack', 1.2, { wx: d.to.x, wy: d.to.y, r: 240, col: c[1], seed: Math.random() * 99, n: 10 }); v.shake = Math.max(v.shake, 0.35); });
        const tg = hitsOr(d, 10);
        for (let i = 0; i < 24; i++) {
          const at = tg[i % tg.length];
          d.at(0.75 + i * 0.022, () => d.fx('dagger', 0.3, { wx0: d.to.x, wy0: d.to.y, ox0: 14 * d.face, oy0: -66, wx1: at.x + ((i * 13) % 30) - 15, wy1: at.y, h: 30 + (i % 5) * 22, go: 0.22, spin: i % 2 ? 1 : -1, col: i % 3 ? MASK[0] : BLOOD }));
        }
        for (const at of tg.slice(0, 6)) d.at(1.0, () => d.fx('mask', 0.7, { wx: at.x, wy: at.y, oy: -110, size: 14 }));
      },
      onHit: () => { impact(d, d.target, 240, c, { rings: 3, crack: true, sparks: 20 }); climax(d, BLOOD, d.target); },
    });
  },
  // 섭혼마존 환영분신술 — 보랏빛 빛살, 거꾸로 도는 시공의 인장, 분신 둘이 솟아 사방을 휩쓴다
  'fan:m4'(d) {
    const v = d.v;
    const c = [SOUL, '254,226,226', '59,7,100'];
    const R = d.radius || 280;
    ultimate(d, SOUL, '幻影分身', 1.6, { cutPose: '펼치기', avatarPose: '휘두르기', sub: '섭혼마존 · 환영분신술' });
    if (d.lvl >= 1) d.at(0.5, () => d.fx('shatter', 1.4, {}));
    beats(d, [[0, '기모으기', 'out'], [0.45, '기모으기'], [0.55, '펼치기', 'snap'], [1.1, '마무리', 'inout']], {
      cast: 0.1, hit: 0.75, end: 1.6, shake: 0.3, name: false,
      onCast: () => {
        // v249: 발밑 원이 세 겹(인장·큰 인장·직업 인장) — 이 인장은 먹빛 테로, 대신 분신이 둘레를 휩쓰는 부채 회오리
        d.fx('sigil', 1.5, { wx: d.to.x, wy: d.to.y, r: R * 1.2, col: SOUL, n: 22, spin: -2, dark: '59,7,100' });
        d.at(0.55, () => d.fx('cyclone', 1.0, { wx: d.to.x, wy: d.to.y, r: R, h: 120, col: SOUL, w: 6, dark: '59,7,100' }));
        const off = [[-1, -0.4], [1, -0.4], [-0.6, 0.6], [0.6, 0.6]];
        off.forEach(([ox, oy], i) => d.at(0.2 + i * 0.1, () => {
          d.ghost(d.to.x + ox * 70, d.to.y + oy * 60, i % 2 ? '휘두르기' : '펼치기', 0.9, { a0: 0.75, tint: i % 2 ? BLOOD : SOUL });
          d.fx('flare', 0.35, { wx: d.to.x + ox * 70, wy: d.to.y + oy * 60, r: 60, col: SOUL });
          d.fx('qiorb', 0.5, { pts: [{ x: d.to.x, y: d.to.y, oy: -55 }, { x: d.to.x + ox * 70, y: d.to.y + oy * 60, oy: -50 }], go: 0.9, col: SOUL, size: 7, hop: 16 });
        }));
      },
      onHit: () => {
        impact(d, d.to, R * 1.1, c, { rings: 3, sparks: 18 });
        for (const at of hitsOr(d, 10)) d.fx('eye', 1.6, { wx: at.x, wy: at.y, r: 22, oy: -105 });
        climax(d, SOUL, d.to);
      },
    });
  },
  // ===== 보조기 (v120) =====
  // 일화검존 유운보 — 구름 같은 걸음: 바람 줄과 꽃잎이 몸을 감싸 돈다
  'sword:m3'(d) {
    const c = [PLUM, '255,255,255', '71,85,105'];
    // v249: 전광석화(금빛 번개)와 같은 뼈대라 색만 달랐다 — 유운보는 '구름 같은 걸음': 꽃빛 잔상이 둘레를 흘러 돌고 꽃잎이 크게 감긴다
    buffBeats(d, c, [[0.05, '순보', 'out'], [0.4, '순보'], [0.5, '착지', 'snap'], [0.8, '마무리', 'inout']], () => {
      d.fx('speedlines', 0.6, { col: c[1], seed: Math.random() * 6 });
      d.fx('petals', 1.8, { wx: d.to.x, wy: d.to.y, r: 130, col: PLUM, seeds: rnd(28), spin: 5, hero: true });
      shadows(d, PLUM, 4, ['순보', '착지', '순보', '착지'], d.to, 90);
      d.fx('cyclone', 1.0, { wx: d.to.x, wy: d.to.y, r: 110, h: 90, col: PLUM, w: 3, dark: '80,7,36' });
    });
  },
  // 불패권마 금종조 — 금종이 내려앉아 몸을 덮는다
  'fist:m3'(d) {
    const c = [GOLD, '255,251,235', '120,53,15'];
    buffBeats(d, c, [[0.08, '마보', 'out'], [0.5, '마보'], [0.85, '마무리', 'inout']], () => {
      d.fx('bell', 1.2, {});
      d.fx('goldbody', 1.2, {});
    });
  },
  // 섭혼마존 시공이환술 — 술법진이 거꾸로 돌고, 흩어진 잔상이 몸으로 되돌아온다
  'fan:m3'(d) {
    const c = [SOUL, '254,226,226', '59,7,100'];
    buffBeats(d, c, [[0.05, '기모으기', 'out'], [0.45, '기모으기'], [0.6, '펼치기', 'snap'], [0.9, '마무리', 'inout']], () => {
      // v249: 잔상이 0.45 진하기·반지름 70이라 거의 안 보였다 — 멀리(150) 또렷이 서서 혼불로 되돌아오고, 돌아오면 몸이 밝아진다
      d.fx('sigil', 1.1, { wx: d.to.x, wy: d.to.y, r: 200, col: SOUL, n: 16, spin: -3, dark: '59,7,100' });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const gx = d.to.x + Math.cos(a) * 150, gy = d.to.y + Math.sin(a) * 85;
        d.ghost(gx, gy, '기모으기', 0.6, { a0: 0.7, fade: 0.6, tint: SOUL, flip: Math.cos(a) > 0 });
        d.fx('qiorb', 0.6, { pts: [{ x: gx, y: gy, oy: -50 }, { x: d.to.x, y: d.to.y, oy: -55 }], go: 0.85, col: SOUL, size: 12, hop: 22 });
      }
      d.at(d.t + 0.5, () => { d.fx('flare', 0.5, { wx: d.to.x, wy: d.to.y, r: 90, col: SOUL, oy: -60 }); d.fx('shock', 0.45, { wx: d.to.x, wy: d.to.y, r: 100, col: SOUL, rings: 2, w: 4 }); });
    });
  },
  // 독왕 만독귀원 — 적들 몸의 독이 한꺼번에 터지고 초록 기운이 무인에게 모인다
  'poison:m3'(d) {
    beats(d, [[0, '땅짚기', 'out'], [0.25, '땅짚기'], [0.35, '펼치기', 'snap'], [0.8, '마무리', 'inout']], {
      cast: 0.1, hit: 0.35, end: 1.0, shake: 0.2,
      onCast: () => d.fx('sigil', 0.9, { wx: d.to.x, wy: d.to.y, r: d.radius || 320, col: '34,197,94', n: 20, spin: 2, dark: '20,83,45' }),
      // v247: '독을 거둬 몸으로' — 큰 독 혼불 여덟이 무인에게 빨려 들고, 닿으면 초록 빛으로 몸이 찬다(회복기로 읽히게)
      onHit: () => {
        const list = hitsOr(d, 8);
        for (const at of list) { d.burst(at, 70, { puddle: 0.4, drops: 6 }); }
        d.skulls(d.hits, 3);
        for (const at of list) d.fx('qiorb', 0.6, { pts: [{ x: at.x, y: at.y, oy: -40 }, { x: d.to.x, y: d.to.y, oy: -55 }], go: 0.85, col: '34,197,94', size: 13, hop: 30 });
        d.at(d.t + 0.5, () => { d.fx('flare', 0.5, { wx: d.to.x, wy: d.to.y, r: 90, col: GREEN[0], oy: -60 }); d.fx('shock', 0.5, { wx: d.to.x, wy: d.to.y, r: 110, col: '34,197,94', rings: 2, w: 4 }); });
      },
    });
  },
  // 극악소마 무면개방 — 가면을 벗는다: 가면이 갈라지고 핏빛 기운이 둘레로 번진다
  'ring:m3'(d) {
    const c = [BLOOD, '254,226,226', '69,10,10'];
    buffBeats(d, c, [[0.05, '지법겨눔', 'out'], [0.45, '지법겨눔'], [0.55, '쌍장', 'snap'], [0.85, '마무리', 'inout']], () => {
      d.fx('mask', 1.1, { oy: -170, size: 38, crack: true });
      d.fx('shock', 0.8, { wx: d.to.x, wy: d.to.y, r: 260, col: BLOOD, rings: 3, w: 6 });
    });
  },

  // ===== 일화검존 =====
  // 일화참 — 가장 빠른 걸음으로 다가가 한 칼. 벤 자리에 꽃 한 송이가 핀다.
  'sword:m0'(d) {
    const c = COL.sword;
    blinkBeats(d, c, '일섬', () => {
      // v246: 한 칼이 읽히게 — 지나온 길에 빛줄 · 반달 크게 · X자로 두 줄 · 아주 짧게 멎음
      if (d.from) d.fx('lance', 0.3, { wx: d.from.x, wy: d.from.y, a: Math.atan2((d.target.y - d.from.y) * d.v.squash, d.target.x - d.from.x), len: Math.hypot(d.target.x - d.from.x, (d.target.y - d.from.y) * d.v.squash), w: 6, col: PLUM, oy: -62 });
      d.fx('arc', 0.34, { face: d.face, r: 118, a0: -2.2, a1: 1.6, col: c[1] });
      d.fx('cutline', 0.45, { wx: d.target.x, wy: d.target.y, a: 0.5 });
      d.fx('cutline', 0.45, { wx: d.target.x, wy: d.target.y, a: 2.1 });
      d.v.hitstop = Math.max(d.v.hitstop || 0, 0.06);
      d.fx('bloom', 0.9, { wx: d.target.x, wy: d.target.y, r: 46, col: PLUM, oy: -60 });
      impact(d, d.target, 90, c, { flare: true, sparks: 8, col: PLUM });
    });
  },
  // 낙화유수 — 두 번 휘두르면 꽃잎이 물 흐르듯 둘레에 진다
  'sword:m1'(d) {
    const c = COL.sword;
    const R = d.radius || 240;
    beats(d, [[0, '발도준비', 'out'], [0.12, '일섬', 'snap'], [0.3, '검거양', 'out'], [0.42, '내려베기', 'snap'], [0.8, '납도', 'inout']], {
      cast: 0.1, hit: 0.44, end: 1.0, shake: 0.2,
      onCast: () => {
        d.fx('arc', 0.3, { face: d.face, r: 86, a0: -2.4, a1: 2.2, col: c[1] });
        d.at(0.4, () => d.fx('arc', 0.3, { face: -d.face, r: 92, a0: -2.2, a1: 2.0, col: PLUM }));
        d.fx('petals', 1.2, { wx: d.to.x, wy: d.to.y, r: R * 0.85, col: PLUM, seeds: rnd(26), spin: 2 });
      },
      onHit: () => {
        for (const [i, at] of hitsOr(d, 10).entries()) d.fx('cutline', 0.3, { wx: at.x, wy: at.y, a: 0.3 + i * 0.41 });
        impact(d, d.to, R, c, { flare: true, rings: 2, sparks: 10, col: PLUM });
      },
    });
  },
  // 만화귀일 — 하늘 가득 꽃잎이 한 점으로 모여 큰 꽃이 피고, 검기가 비처럼 꽂힌다
  'sword:m2'(d) {
    const v = d.v;
    const c = COL.sword;
    const R = d.radius || 300;
    beats(d, [[0, '검거양', 'out'], [0.45, '검거양'], [0.55, '내려베기', 'snap'], [1.0, '내려베기'], [1.2, '납도', 'inout']], {
      cast: 0.05, hit: 0.62, end: 1.45, shake: 0.3,
      onCast: () => {
        // v247: 빛이 겹쳐 흰 덩어리 — 인장에 먹빛 테, 검기는 꽃빛으로 굵게, 가운데 번쩍은 작게
        d.fx('sigil', 1.3, { wx: d.center.x, wy: d.center.y, r: R, col: PLUM, n: 24, spin: -1, dark: '80,7,36' });
        d.fx('petals', 1.3, { wx: d.center.x, wy: d.center.y, r: R, col: PLUM, seeds: rnd(36), spin: -4 });
        d.at(0.4, () => d.fx('bloom', 1.0, { wx: d.center.x, wy: d.center.y, r: 95, n: 8, col: '244,114,182', oy: -90, spin: 2 }));
        const n = d.lvl >= 2 ? 14 : 8;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const r = R * Math.sqrt(Math.random()) * 0.9;
          const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
          d.at(0.55 + i * 0.025, () => {
            d.fx('needle', 0.3, { wx: spot.x, wy: spot.y, a: Math.PI / 2, len: 140, w: 8, h: 80, col: '244,114,182' });
            d.fx('shock', 0.3, { wx: spot.x, wy: spot.y, r: 30, col: PLUM, w: 3 });
          });
        }
      },
      onHit: () => { impact(d, d.center, R, c, { rings: 2, sparks: 14, col: PLUM }); d.fx('flare', 0.4, { wx: d.center.x, wy: d.center.y, r: 80, col: PLUM, oy: -90 }); },
    });
  },

  // ===== 불패권마 =====
  // 붕산철권 — 마보로 버티다 한 주먹. 산만 한 주먹 그림자가 꽂히고 땅이 갈라진다.
  'fist:m0'(d) {
    const c = COL.fist;
    beats(d, [[0, '마보', 'out'], [0.16, '정권', 'snap'], [0.5, '정권'], [0.7, '마무리', 'inout']], {
      cast: 0.12, hit: 0.26, end: 0.85, shake: 0.32,
      // v246: '산만 한 주먹'이 0.14초에 닿고 사라져 안 보였다 — 크게·오래 날아가 박히고, 박힐 때 멎는다
      onCast: () => d.fx('fistimg', 0.42, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, oy0: -64, wx1: d.target.x, wy1: d.target.y, oy1: -50, size: 110, col: c[0], hot: c[1], go: 0.3 }),
      onHit: () => { d.v.hitstop = Math.max(d.v.hitstop || 0, 0.08); impact(d, d.target, 160, c, { rings: 3, crack: true, sparks: 18, flare: true }); },
    });
  },
  // 투신난무 — 권갑 투신으로 네 방향을 네 번 두들긴다
  'fist:m1'(d) {
    const c = COL.fist;
    const R = d.radius || 230;
    const poses = ['정권', '훅', '올려치기', '쌍장'];
    const seq = [[0, '마보', 'out']];
    poses.forEach((p, i) => seq.push([0.08 + i * 0.12, p, 'snap']));
    seq.push([0.7, '마무리', 'inout']);
    beats(d, seq, {
      cast: 0.06, hit: 0.48, end: 0.9, shake: 0.28,
      onCast: () => {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          const to = { x: d.to.x + Math.cos(a) * R * 0.55, y: d.to.y + Math.sin(a) * R * 0.32 };
          d.at(0.08 + i * 0.12, () => {
            d.fx('fistimg', 0.3, { wx0: d.to.x, wy0: d.to.y, oy0: -60, wx1: to.x, wy1: to.y, oy1: -40, size: 66, col: c[0], hot: c[1], go: 0.3 });
            d.fx('shock', 0.4, { wx: to.x, wy: to.y, r: 72, col: c[0], rings: 2, w: 6 });
            d.v.shake = Math.max(d.v.shake, 0.12);
            d.v.hitstop = Math.max(d.v.hitstop || 0, 0.03);   // v246 네 번의 박자
          });
        }
      },
      onHit: () => impact(d, d.to, R, c, { rings: 2, crack: true, sparks: 12 }),
    });
  },
  // 불패금신 — 금빛 몸이 되어 충격파를 내뿜는다
  'fist:m2'(d) {
    const c = [GOLD, '255,251,235', '120,53,15'];
    buffBeats(d, c, [[0.08, '마보', 'out'], [0.45, '마보'], [0.55, '진각', 'snap'], [0.85, '마무리', 'inout']], () => {
      d.fx('goldbody', 2.2, {});
      impact(d, d.to, d.radius || 260, c, { rings: 3, crack: true, sparks: 16 });
      d.v.shake = Math.max(d.v.shake, 0.35);
    });
    d.at(0.5, () => d.release());
  },

  // ===== 길 무공 (v240) — 길마다 하나 =====
  // 검기종횡 — 검기를 가로세로로 뿌려 두 번 벤다
  'sword:pa'(d) {
    const c = COL.sword;
    const R = d.radius || 320;
    beats(d, [[0, '검거양', 'out'], [0.14, '내려베기', 'snap'], [0.34, '일섬', 'snap'], [0.8, '납도', 'inout']], {
      cast: 0.1, hit: 0.46, end: 1.0, shake: 0.22,
      onCast: () => {
        d.fx('arc', 0.34, { face: d.face, r: R * 0.5, a0: -2.5, a1: 2.3, col: c[1] });
        d.at(0.28, () => d.fx('arc', 0.34, { face: -d.face, r: R * 0.5, a0: -0.9, a1: 3.9, col: c[1] }));
        d.fx('slashstorm', 0.9, { wx: d.to.x, wy: d.to.y, r: R, col: c[1], n: 10 });
      },
      onHit: () => { for (const [i, at] of hitsOr(d, 8).entries()) d.fx('cutline', 0.3, { wx: at.x, wy: at.y, a: i % 2 ? 0.1 : 1.65 }); impact(d, d.to, R, c, { rings: 2, sparks: 10 }); },
    });
  },
  // 전광석화 — 몸이 번개처럼 빨라진다
  'sword:pb'(d) {
    const c = ['253,224,71', '255,255,255', '113,63,18'];
    buffBeats(d, c, [[0.06, '발도준비', 'out'], [0.3, '일섬', 'snap'], [0.6, '납도', 'inout']], () => {
      d.fx('speedlines', 1.2, { col: c[0] });
      shadows(d, c[0], 4, ['일섬', '발도준비', '찌르기', '내려베기']);
      // 번개 각성 — 하늘에서 금빛 번개 한 줄 + 칼끝 별빛
      d.fx('skybeam', 0.5, { wx: d.to.x, wy: d.to.y, oy: -40, col: c[0] });
      d.fx('glint', 0.4, { wx: d.to.x, wy: d.to.y, ox: 30 * d.face, oy: -96, r: 34, col: c[1] });
      impact(d, d.to, 120, c, { rings: 2, sparks: 10, flare: true });
    });
    d.at(0.4, () => d.release());
  },
  // 벽공장풍 — 허공을 가르는 장풍이 둘레를 밀어낸다
  'fist:pa'(d) {
    const c = COL.fist;
    const R = d.radius || 300;
    beats(d, [[0, '마보', 'out'], [0.18, '쌍장', 'snap'], [0.5, '쌍장'], [0.75, '마무리', 'inout']], {
      cast: 0.12, hit: 0.4, end: 0.95, shake: 0.3,
      // v245: wind에 출발·도착을 줘야 그려진다(전엔 안 맞는 값이라 장풍이 아예 없었다) · 흰 화면 충격파는 4차 전용이라 뺐다
      onCast: () => {
        for (const s of [-1, 1]) d.fx('wind', 0.55, { wx0: d.to.x, wy0: d.to.y, ox0: 22 * d.face, wx1: d.to.x + R * d.face, wy1: d.to.y + s * R * 0.35, col: c[0], n: 7, spread: 16, bend: 30, w: 5 });
        d.fx('wind', 0.5, { wx0: d.to.x, wy0: d.to.y, ox0: 22 * d.face, wx1: d.to.x + R * d.face, wy1: d.to.y, col: '255,247,220', n: 3, spread: 10, bend: 10, w: 3 });
        d.fx('shock', 0.5, { wx: d.to.x + R * 0.5 * d.face, wy: d.to.y, r: R * 0.55, col: c[0], rings: 2, w: 6 });
      },
      onHit: () => impact(d, d.to, R, c, { rings: 3, crack: true, sparks: 16 }),
    });
  },
  // 전광연타 — 주먹이 보이지 않을 만큼 빨라진다
  'fist:pb'(d) {
    const c = COL.fist;
    buffBeats(d, c, [[0.06, '마보', 'out'], [0.25, '정권', 'snap'], [0.35, '훅', 'snap'], [0.45, '올려치기', 'snap'], [0.7, '마무리', 'inout']], () => {
      d.fx('speedlines', 1.2, { col: c[0] });
      // v247: d.at은 절대 시각 — 이 콜백(0.48초) 안에서 0.25를 주면 셋이 한꺼번에 나갔다. 지금부터 0.1초 간격으로, 크게
      for (let i = 0; i < 3; i++) d.at(d.t + 0.02 + i * 0.1, () => d.fx('fistimg', 0.28, { wx0: d.to.x, wy0: d.to.y, oy0: -60, wx1: d.to.x + 70 * d.face, wy1: d.to.y, oy1: -50 - i * 12, size: 56, col: c[0], hot: c[1], go: 0.3 }));
      impact(d, d.to, 110, c, { rings: 2, sparks: 10 });
    });
    d.at(0.45, () => d.release());
  },
  // 미혼환무 — 환영이 춤추며 둘레를 두 번 휩쓴다
  'fan:pa'(d) {
    const c = COL.fan;
    const R = d.radius || 330;
    beats(d, [[0, '펼치기', 'out'], [0.16, '휘두르기', 'snap'], [0.38, '휘두르기', 'snap'], [0.85, '마무리', 'inout']], {
      cast: 0.1, hit: 0.5, end: 1.05, shake: 0.2,
      onCast: () => { d.fx('cyclone', 1.0, { wx: d.center.x, wy: d.center.y, r: R, col: c[0] }); shadows(d, SOUL, 5, ['휘두르기', '펼치기', '휘두르기', '펼치기', '휘두르기'], d.center, R * 0.45); },
      onHit: () => { impact(d, d.center, R, c, { rings: 2, sparks: 12, col: SOUL }); for (const at of hitsOr(d, 6)) d.fx('eye', 0.6, { wx: at.x, wy: at.y, r: 16 }); },
    });
  },
  // 선풍난무 — 부채가 회오리친다
  'fan:pb'(d) {
    const c = COL.fan;
    buffBeats(d, c, [[0.06, '펼치기', 'out'], [0.3, '휘두르기', 'snap'], [0.6, '마무리', 'inout']], () => {
      d.fx('cyclone', 1.4, { wx: d.to.x, wy: d.to.y, r: 190, h: 170, col: c[0], w: 6 });   // v249 굵고 크게
      d.fx('speedlines', 1.0, { col: c[0] });
      impact(d, d.to, 120, c, { rings: 2, sparks: 10 });
    });
    d.at(0.4, () => d.release());
  },
  // 육맥신검 — 여섯 손가락에서 검기 여섯이 날아간다
  'ring:pa'(d) {
    const v = d.v;
    const c = COL.ring;
    beats(d, [[0, '지법겨눔', 'out'], [0.1, '손가락튕김', 'snap'], [0.5, '손가락튕김'], [0.8, '마무리', 'inout']], {
      cast: 0.06, hit: 0.7, end: 1.0,
      onCast: () => {
        const list = d.hits.length ? d.hits.slice() : [{ at: d.target }];
        for (let i = 0; i < 6; i++) {
          const h = list[i % list.length];
          const t0 = 0.1 + i * 0.07;
          // v247: 거의 흰 가는 줄이라 눈밭에서 사라졌다 — 보랏빛 굵은 검기 + 맞으면 고리
          d.at(t0, () => d.fx('lance', 0.26, { wx: d.to.x, wy: d.to.y, a: Math.atan2((h.at.y - d.to.y) * v.squash, h.at.x - d.to.x), len: Math.hypot(h.at.x - d.to.x, (h.at.y - d.to.y) * v.squash), w: 7, col: c[0], oy: -62 }));
          d.at(t0 + 0.18, () => { d.fx('flare', 0.22, { wx: h.at.x, wy: h.at.y, r: 52, col: c[1] }); d.fx('shock', 0.3, { wx: h.at.x, wy: h.at.y, r: 44, col: c[0], rings: 2, w: 3 }); if (h.kind) d.releaseHit(h); v.shake = Math.max(v.shake, 0.06); });
        }
      },
    });
  },
  // 귀영난무 — 그림자가 셋으로 갈라진다
  'ring:pb'(d) {
    const c = COL.ring;
    buffBeats(d, c, [[0.06, '지법겨눔', 'out'], [0.3, '손가락튕김', 'snap'], [0.6, '마무리', 'inout']], () => {
      d.fx('mask', 1.0, { oy: -170, size: 30 });
      shadows(d, c[0], 3, ['지법겨눔', '손가락튕김', '지법겨눔']);
      d.fx('speedlines', 1.0, { col: c[0] });
      impact(d, d.to, 110, c, { rings: 2, sparks: 8 });
    });
    d.at(0.4, () => d.release());
  },
  // 독룡출동 — 독룡이 땅을 기어 독무를 넓게 깐다
  'poison:pa'(d) {
    const R = d.radius || 260;
    beats(d, [[0, '땅짚기', 'out'], [0.2, '흩뿌리기', 'snap'], [0.6, '흩뿌리기'], [0.95, '마무리', 'inout']], {
      cast: 0.1, hit: 0.5, end: 1.2, shake: 0.2,
      onCast: () => {
        const pts = hitsOr(d, 5).map((at) => ({ x: at.x, y: at.y }));
        d.fx('serpent', 1.0, { pts: [{ x: d.to.x, y: d.to.y }, ...pts, { x: d.center.x, y: d.center.y }], go: 0.7, v: d.tier, w: 12, body: 180 });
      },
      onHit: () => { d.burst(d.center, R, { puddle: 1.4, drops: 20 }); d.fx('miasma', 1.4, { wx: d.center.x, wy: d.center.y, r: R, v: d.tier }); },
    });
  },
  // 만천화우 — 독침이 비처럼 쏟아질 준비
  'poison:pb'(d) {
    const c = GREEN;
    buffBeats(d, c, [[0.06, '투척준비', 'out'], [0.3, '투척', 'snap'], [0.6, '마무리', 'inout']], () => {
      d.fx('speedlines', 1.0, { col: c[0] });
      // v247: 침이 몸에 겹쳐 흰 별처럼 깜빡이던 것 — 열여섯 독침이 사방으로 날아간다
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; d.lob('dart', 0.4, { x: d.to.x + Math.cos(a) * 260, y: d.to.y + Math.sin(a) * 160 }, { fly: 0.8, oy1: -50 }); }
      impact(d, d.to, 110, c, { rings: 2, sparks: 10 });
    });
    d.at(0.4, () => d.release());
  },

  // ===== 섭혼마존 =====
  // 섭혼술 — 대상 머리 위에 핏빛 눈이 뜨이고, 보랏빛 실이 혼을 끌어당긴다
  'fan:m0'(d) {
    const c = [SOUL, '254,226,226', '59,7,100'];
    beats(d, [[0, '펼치기', 'out'], [0.2, '휘두르기', 'snap'], [0.6, '휘두르기'], [0.8, '마무리', 'inout']], {
      cast: 0.1, hit: 0.42, end: 1.0,
      onCast: () => {
        // v246: 눈이 멎음(2.5초) 동안 떠 있다 · 실 굵게
        d.fx('eye', 2.5, { wx: d.target.x, wy: d.target.y, r: 40 });
        d.fx('lance', 0.45, { wx: d.to.x, wy: d.to.y, a: Math.atan2((d.target.y - d.to.y) * d.v.squash, d.target.x - d.to.x), len: Math.hypot(d.target.x - d.to.x, (d.target.y - d.to.y) * d.v.squash), w: 8, col: SOUL, oy: -60 });
      },
      onHit: () => { d.v.hitstop = Math.max(d.v.hitstop || 0, 0.06); impact(d, d.target, 110, c, { flare: true, rings: 2, sparks: 10 }); d.fx('sigil', 0.9, { wx: d.target.x, wy: d.target.y, r: 100, col: SOUL, n: 12, spin: 2 }); },
    });
  },
  // 혈루미혼 — 핏빛 눈물이 둘레에 쏟아지고 혼이 홀린다
  'fan:m1'(d) {
    const c = [BLOOD, '254,202,202', '69,10,10'];
    const R = d.radius || 200;
    beats(d, [[0, '펼치기', 'out'], [0.15, '휘두르기', 'snap'], [0.7, '마무리', 'inout']], {
      cast: 0.08, hit: 0.5, end: 1.1,
      onCast: () => {
        d.fx('tears', 1.1, { wx: d.center.x, wy: d.center.y, r: R * 0.9, seeds: rnd(d.lvl >= 2 ? 40 : 28) });
        d.fx('sigil', 1.1, { wx: d.center.x, wy: d.center.y, r: R, col: BLOOD, n: 16, spin: 1 });
      },
      onHit: () => {
        for (const at of hitsOr(d, 6)) d.fx('eye', 2.0, { wx: at.x, wy: at.y, r: 22, oy: -105 });
        impact(d, d.center, R, c, { flare: true, rings: 2, sparks: 10 });
      },
    });
  },
  // 천외혈마공 — 하늘 밖에서 핏빛 술법진이 내려와 벼락을 치고, 피가 무인에게 빨려 든다
  'fan:m2'(d) {
    const c = [BLOOD, '254,226,226', '69,10,10'];
    const R = d.radius || 300;
    beats(d, [[0, '기모으기', 'out'], [0.5, '기모으기'], [0.6, '펼치기', 'snap'], [1.1, '마무리', 'inout']], {
      cast: 0.08, hit: 0.7, end: 1.5, shake: 0.3,
      onCast: () => {
        d.fx('sigil', 1.5, { wx: d.center.x, wy: d.center.y, r: R, col: BLOOD, n: 24, spin: -1 });
        d.fx('skybeam', 0.8, { wx: d.center.x, wy: d.center.y, oy: -40, col: BLOOD });
        // v245: 독마 전용 초록 독전(vbolt)이 떨어지던 것 → 하늘 밖에서 꽂히는 핏빛 기둥
        for (const [i, at] of hitsOr(d, 8).entries()) d.at(0.6 + i * 0.03, () => {
          d.fx('lance', 0.3, { wx: at.x, wy: at.y, a: Math.PI / 2, len: 240, w: 9, col: BLOOD, oy: -300 });
          d.fx('flare', 0.25, { wx: at.x, wy: at.y, r: 44, col: BLOOD });
        });
      },
      onHit: () => {
        impact(d, d.center, R, c, { rings: 3, sparks: 14 });
        // 피가 무인에게 모인다
        const pts = hitsOr(d, 6).map((at) => ({ x: at.x, y: at.y, oy: -50 }));
        for (const q of pts) d.fx('qiorb', 0.6, { pts: [q, { x: d.to.x, y: d.to.y, oy: -60 }], go: 0.9, col: BLOOD, size: 5, hop: 20 });
      },
    });
  },

  // ===== 독왕 =====
  // 칠보단혼침 — 일곱 개 독침이 날아가 꽂히고 해골이 떠오른다
  'poison:m0'(d) {
    beats(d, [[0, '투척준비', 'out'], [0.14, '투척', 'snap'], [0.6, '마무리', 'inout']], {
      cast: 0.12, hit: 0.34, end: 0.9,
      onCast: () => {
        // v246: 일곱 침이 0.04초에 날아가 한 장면에도 안 잡혔다 — 0.25초 동안 부채꼴로 날아가 꽂힌다
        for (let i = 0; i < 7; i++) d.at(0.12 + i * 0.03, () => d.lob('dart', 0.32, { x: d.target.x + (i - 3) * 9, y: d.target.y }, { fly: 0.8, oy1: -40 - (i % 3) * 10 }));
      },
      onHit: () => {
        d.v.hitstop = Math.max(d.v.hitstop || 0, 0.05);
        d.burst(d.target, 100, { puddle: 0.7, drops: 14 });
        d.fx('shock', 0.4, { wx: d.target.x, wy: d.target.y, r: 80, col: GREEN[0], rings: 2, w: 4 });
        d.fx('skull', 1.0, { wx: d.target.x, wy: d.target.y, oy: -115, size: 22, v: d.tier });
      },
    });
  },
  // 화골산 — 독 주머니를 던지면 터져서 뼈를 녹이는 독무가 깔린다 (장판은 battle.js가 따로 그린다)
  'poison:m1'(d) {
    const R = d.radius || 200;
    beats(d, [[0, '투척준비', 'out'], [0.14, '투척', 'snap'], [0.6, '마무리', 'inout']], {
      cast: 0.12, hit: 0.42, end: 1.0, shake: 0.18,
      onCast: () => d.lob('pglob', 0.3, d.center, { fly: 0.28, size: 10, h: 90 }),
      onHit: () => {
        d.burst(d.center, R, { puddle: 1.2, drops: 18 });
        d.fx('cloud', 1.6, { wx: d.center.x, wy: d.center.y, r: R * 0.8, n: 10, v: d.tier, seeds: rnd(10), oy: -20 });
      },
    });
  },
  // 만독천라 — 하늘에 독 그물이 펼쳐지고 독비가 쏟아지며 독사가 휘감는다
  'poison:m2'(d) {
    const R = d.radius || 340;
    beats(d, [[0, '흩뿌리기', 'out'], [0.3, '흩뿌리기'], [0.4, '땅짚기', 'snap'], [1.1, '마무리', 'inout']], {
      cast: 0.1, hit: 0.75, end: 1.5, shake: 0.28,
      onCast: () => {
        d.fx('sigil', 1.4, { wx: d.center.x, wy: d.center.y, r: R, col: '34,197,94', n: 28, spin: 1, dark: '20,83,45' });   // v247 눈 위에서 흰 '빙결진'으로 보이던 것
        d.fx('rainfall', 1.2, { wx: d.center.x, wy: d.center.y, r: R, v: d.tier });
        const pts = hitsOr(d, 6).map((at) => ({ x: at.x, y: at.y }));
        if (pts.length > 1) d.fx('serpent', 1.0, { pts: [{ x: d.to.x, y: d.to.y }, ...pts], go: 0.8, v: d.tier, w: 9, body: 140 });
      },
      onHit: () => { d.burst(d.center, R, { puddle: 1.4, drops: 22 }); d.skulls(d.hits, 4); },
    });
  },

  // ===== 극악소마 =====
  // 혈앙지 — 손가락 하나로 재앙을 짚는다. 가는 핏빛 지풍, 꽂힌 자리에서 피가 튄다.
  'ring:m0'(d) {
    const c = [BLOOD, '254,226,226', '69,10,10'];
    beats(d, [[0, '지법겨눔', 'out'], [0.18, '손가락튕김', 'snap'], [0.6, '마무리', 'inout']], {
      cast: 0.16, hit: 0.26, end: 0.85, shake: 0.2,
      // v245: 평타 혈 짚기와 같아 보이던 것 — 굵은 핏빛 지풍 + 혈맥 고리 셋 + 멈칫, 자국도 핏빛(초록 독 자국이었다)
      onCast: () => d.fx('lance', 0.3, { wx: d.to.x, wy: d.to.y, a: Math.atan2((d.target.y - d.to.y) * d.v.squash, d.target.x - d.to.x), len: Math.hypot(d.target.x - d.to.x, (d.target.y - d.to.y) * d.v.squash), w: 9, col: BLOOD, oy: -62 }),
      onHit: () => {
        d.fx('scar', 0.9, { wx: d.target.x, wy: d.target.y, a: -0.6, len: 60, col: BLOOD });
        d.fx('tears', 0.8, { wx: d.target.x, wy: d.target.y, r: 42, seeds: rnd(14) });
        d.fx('shock', 0.5, { wx: d.target.x, wy: d.target.y, r: 90, col: BLOOD, rings: 3, w: 4 });
        d.v.hitstop = Math.max(d.v.hitstop || 0, 0.07);
        impact(d, d.target, 90, c, { flare: true, sparks: 12 });
      },
    });
  },
  // 마극광폭장 — 광폭한 장력이 둘레를 휩쓸고, 웃는 가면이 떠올라 적이 공포에 굳는다
  'ring:m1'(d) {
    const c = MASK;
    const R = d.radius || 250;
    beats(d, [[0, '마보', 'out'], [0.14, '쌍장', 'snap'], [0.55, '쌍장'], [0.75, '마무리', 'inout']], {
      cast: 0.1, hit: 0.24, end: 0.95, shake: 0.3,
      onCast: () => {
        d.fx('mask', 1.1, { oy: -160, size: 34 });
        // v245: 권마의 금빛 주먹 그림 대신 쌍장에서 둘레로 밀려 나가는 보랏빛 장력 파동
        for (const s of [-1, 1]) d.fx('wind', 0.5, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, wx1: d.to.x + R * d.face, wy1: d.to.y + s * R * 0.4, col: c[0], n: 6, spread: 16, bend: 36, w: 4.5 });
        d.fx('shock', 0.55, { wx: d.to.x, wy: d.to.y, r: R, col: c[0], rings: 3, w: 6 });
      },
      onHit: () => {
        impact(d, d.to, R, c, { rings: 2, crack: true, sparks: 14 });
        for (const at of hitsOr(d, 6)) d.fx('mask', 1.0, { wx: at.x, wy: at.y, oy: -110, size: 18 });
      },
    });
  },
  // 소향비술 — 웃는 향기를 실은 비수 열두 자루가 가까운 적들에게 날아든다
  'ring:m2'(d) {
    const v = d.v;
    beats(d, [[0, '투척준비', 'out'], [0.12, '흩뿌리기', 'snap'], [0.6, '흩뿌리기'], [0.85, '마무리', 'inout']], {
      cast: 0.06, hit: 0.9, end: 1.15, name: true,
      onCast: () => {
        d.fx('mask', 1.0, { oy: -170, size: 30 });
        const list = d.hits.length ? d.hits.slice() : [{ at: d.target }];
        const n = 12;
        for (let i = 0; i < n; i++) {
          const h = list[i % list.length];
          const t0 = 0.08 + i * 0.045;
          d.at(t0, () => d.fx('dagger', 0.32, { wx0: d.to.x, wy0: d.to.y, ox0: 14 * d.face, oy0: -66, wx1: h.at.x, wy1: h.at.y, h: 30 + (i % 4) * 22, go: 0.24, spin: i % 2 ? 1 : -1, col: i % 3 ? MASK[0] : BLOOD }));
          d.at(t0 + 0.24, () => {
            d.fx('flare', 0.22, { wx: h.at.x, wy: h.at.y, r: 48, col: MASK[1] });
            d.fx('shock', 0.26, { wx: h.at.x, wy: h.at.y, r: 34, col: MASK[0], w: 3 });
            if (h.kind) d.releaseHit(h);
            v.shake = Math.max(v.shake, 0.06);
          });
        }
      },
    });
  },
};
