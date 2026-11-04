// v350 극(極)의 신수 — 탈 때 둘레에 이는 기운. 상태 없이 시간(t)만으로 그린다(입자는 번호마다 정해진 자리에서 돌고 돈다).
//   layer 'back' : 탈것 뒤(땅의 문양·뒤쪽 빛·꼬리 자국) · 'front' : 탈것·무인 앞(불티·눈송이·번개·별·물방울·금빛 티끌)
//   s: 크기(두목으로 크게 나설 때 bscale) · lite: 성능을 아낄 때(입자 절반)
import { mountOf } from './world/wdata.js';

const TAU = Math.PI * 2;
const fr = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };   // 번호마다 같은 난수

function glow(ctx, x, y, rx, ry, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, col.replace('A', String(a)));
  g.addColorStop(1, col.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.restore(); ctx.fill();
}
function spark(ctx, x, y, r, col) {
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(x, y - r * 2.4); ctx.lineTo(x + r * 0.5, y - r * 0.5); ctx.lineTo(x + r * 2.4, y); ctx.lineTo(x + r * 0.5, y + r * 0.5);
  ctx.lineTo(x, y + r * 2.4); ctx.lineTo(x - r * 0.5, y + r * 0.5); ctx.lineTo(x - r * 2.4, y); ctx.lineTo(x - r * 0.5, y - r * 0.5); ctx.closePath(); ctx.fill();
}
function bolt(ctx, x0, y0, x1, y1, seed, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const n = 6;
  for (let i = 1; i < n; i++) {
    const k = i / n, j = (fr(seed, i) - 0.5) * 14;
    ctx.lineTo(x0 + (x1 - x0) * k + j * 0.4, y0 + (y1 - y0) * k + j);
  }
  ctx.lineTo(x1, y1); ctx.stroke();
}

// 몸 둘레 상자 — 짐승 모양마다(발밑 (0,0), 오른쪽을 봄)
const BODY = { h1: [-78, -88, 50], h2: [-55, -80, 55], h3: [-55, -80, 55], h4: [-65, -55, 60], h5: [-70, -40, 95], h6: [-75, -45, 105] };

export function mountFxOf(kind) { return mountOf(kind)?.fx || null; }

export function drawMountAura(ctx, kind, x, y, t, o = {}) {
  const fx = mountFxOf(kind);
  if (!fx) return;
  const s = o.s || 1, layer = o.layer || 'back', dir = o.flip ? -1 : 1, mv = o.moving ? 1 : 0;
  const N = o.lite ? 0.5 : 1;
  const [bx0, by, bx1] = BODY[kind] || [-55, -60, 55];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter';
  const cx = (bx0 + bx1) / 2 * dir, w = (bx1 - bx0);
  if (fx === 'flame') {
    if (layer === 'back') {
      glow(ctx, cx, by * 0.55, w * 0.85, w * 0.55, 'rgba(249,115,22,A)', 0.32 + Math.sin(t * 5) * 0.06);
      glow(ctx, 0, 0, w * 0.6, 10, 'rgba(251,191,36,A)', 0.45);
      // 지나간 자리에 불길(달릴 때)
      if (mv) for (let i = 0; i < 10 * N; i++) {
        const p = (t * 1.6 + i / 10) % 1, xx = -dir * (bx1 * 0.2 + p * 90), yy = -6 - p * 26 - fr(i, 2) * 10;
        ctx.globalAlpha = (1 - p) * 0.7; glow(ctx, xx, yy, 14 * (1 - p * 0.5), 10, 'rgba(239,68,68,A)', 0.9);
      }
    } else {
      for (let i = 0; i < 26 * N; i++) {
        const p = (t * (0.45 + fr(i, 1) * 0.5) + fr(i, 3)) % 1;
        const xx = (bx0 + fr(i, 4) * w) * dir + Math.sin(t * 3 + i) * 6, yy = by * 0.2 - p * 95;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.95;
        spark(ctx, xx, yy, 1.4 + fr(i, 5) * 1.6, i % 3 ? '#fdba74' : '#fde047');
      }
    }
  } else if (fx === 'frost') {
    if (layer === 'back') {
      glow(ctx, cx, by * 0.5, w * 0.85, w * 0.6, 'rgba(125,211,252,A)', 0.28);
      // 발밑 서리꽃 — 여섯 갈래가 천천히 돈다
      ctx.save(); ctx.scale(1, 0.32); ctx.rotate(t * 0.4);
      ctx.strokeStyle = 'rgba(186,230,253,0.7)'; ctx.lineWidth = 2.2;
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * w * 0.7, Math.sin(a) * w * 0.7);
        for (const f of [0.35, 0.55]) { const px = Math.cos(a) * w * 0.7 * f, py = Math.sin(a) * w * 0.7 * f; ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a + 0.6) * 12, py + Math.sin(a + 0.6) * 12); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a - 0.6) * 12, py + Math.sin(a - 0.6) * 12); }
        ctx.stroke(); }
      ctx.restore();
      if (mv) for (let i = 0; i < 8 * N; i++) { const p = (t * 1.3 + i / 8) % 1; ctx.globalAlpha = (1 - p) * 0.6; glow(ctx, -dir * (20 + p * 80), -4 - fr(i, 7) * 18, 16, 8, 'rgba(224,242,254,A)', 0.8); }
    } else {
      for (let i = 0; i < 22 * N; i++) {
        const p = (t * (0.18 + fr(i, 1) * 0.2) + fr(i, 3)) % 1;
        const xx = (bx0 - 20 + fr(i, 4) * (w + 40)) * dir + Math.sin(t * 1.5 + i * 2) * 10, yy = by * 1.4 + p * (-by * 1.4 + 4);
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.95;
        if (i % 4 === 0) spark(ctx, xx, yy, 1.8, '#e0f2fe');
        else { ctx.fillStyle = i % 2 ? '#bae6fd' : '#ffffff'; ctx.beginPath(); ctx.arc(xx, yy, 1.3 + fr(i, 6) * 1.2, 0, TAU); ctx.fill(); }
      }
    }
  } else if (fx === 'thunder') {
    if (layer === 'back') {
      const pulse = 0.25 + Math.max(0, Math.sin(t * 9)) * 0.18;
      glow(ctx, cx, by * 0.5, w * 0.9, w * 0.6, 'rgba(168,85,247,A)', pulse);
      glow(ctx, 0, 0, w * 0.55, 9, 'rgba(250,204,21,A)', 0.5);
      if (mv) for (let i = 0; i < 4 * N; i++) { const p = (t * 2.2 + i / 4) % 1; ctx.globalAlpha = 1 - p; bolt(ctx, -dir * (10 + p * 70), -4, -dir * (40 + p * 70), -18, Math.floor(t * 12) + i, 2, '#fde047'); }
    } else {
      // 번개가 몸을 타고 튄다 — 0.12초마다 모양이 바뀐다
      const fr12 = Math.floor(t * 8);
      for (let i = 0; i < 3 * N + 1; i++) {
        if (fr(fr12, i + 9) > 0.62) continue;
        const a0 = fr(fr12, i) * TAU, a1 = a0 + 0.8 + fr(fr12, i + 3);
        const rx = w * 0.6, ry = -by * 0.45;
        const X = (a) => cx + Math.cos(a) * rx, Y = (a) => by * 0.5 + Math.sin(a) * ry;
        ctx.globalAlpha = 0.95;
        bolt(ctx, X(a0), Y(a0), X(a1), Y(a1), fr12 * 7 + i, 3.2, 'rgba(192,132,252,0.55)');
        bolt(ctx, X(a0), Y(a0), X(a1), Y(a1), fr12 * 7 + i, 1.4, '#fef9c3');
      }
      for (let i = 0; i < 14 * N; i++) {
        const p = (t * 1.2 + fr(i, 3)) % 1; ctx.globalAlpha = (1 - p) * 0.9;
        spark(ctx, (bx0 + fr(i, 4) * w) * dir, by * 0.2 - p * 60, 1.2 + fr(i, 5), '#fde047');
      }
    }
  } else if (fx === 'void') {
    if (layer === 'back') {
      ctx.globalCompositeOperation = 'source-over';
      glow(ctx, cx, by * 0.5, w * 0.9, w * 0.55, 'rgba(46,16,101,A)', 0.45);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, by * 0.5, w * 0.7, w * 0.45, 'rgba(168,85,247,A)', 0.22 + Math.sin(t * 2) * 0.06);
      // 그림자 불꽃 — 발밑에서 위로 너울거린다
      for (let i = 0; i < 9 * N; i++) {
        const p = (t * 0.7 + i / 9) % 1, xx = (bx0 + (i / 9) * w) * dir + (mv ? -dir * p * 40 : 0);
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.75; glow(ctx, xx, -p * 50, 16 - p * 8, 22, 'rgba(192,38,211,A)', 0.7);
      }
    } else {
      for (let i = 0; i < 24 * N; i++) {
        const tw = Math.max(0, Math.sin(t * (1.5 + fr(i, 2) * 3) + i * 1.7));
        const xx = (bx0 - 30 + fr(i, 4) * (w + 60)) * dir, yy = by * 1.6 * fr(i, 5) + 6;
        ctx.globalAlpha = tw;
        spark(ctx, xx, yy, 0.9 + fr(i, 6) * 1.5, i % 3 ? '#f5d0fe' : '#ffffff');
      }
    }
  } else if (fx === 'tide') {
    if (layer === 'back') {
      glow(ctx, cx, by * 0.6, w * 0.85, w * 0.5, 'rgba(34,211,238,A)', 0.26);
      // 물결 띠 둘이 몸을 감고 돈다(뒤쪽 반)
      for (let r = 0; r < 2; r++) {
        ctx.strokeStyle = r ? 'rgba(165,243,252,0.55)' : 'rgba(6,182,212,0.6)'; ctx.lineWidth = r ? 2 : 4;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) { const a = Math.PI + (k / 40) * Math.PI; const xx = cx + Math.cos(a + t * 1.6 + r * 2) * w * 0.62, yy = by * 0.55 + Math.sin(a * 3 + t * 3 + r) * 8 + Math.sin(a + t * 1.6 + r * 2) * 12; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      }
    } else {
      for (let r = 0; r < 2; r++) {
        ctx.strokeStyle = r ? 'rgba(236,254,255,0.75)' : 'rgba(34,211,238,0.7)'; ctx.lineWidth = r ? 1.6 : 3.2;
        ctx.beginPath();
        for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI; const xx = cx + Math.cos(a + t * 1.6 + r * 2) * w * 0.62, yy = by * 0.55 + Math.sin(a * 3 + t * 3 + r) * 8 + Math.sin(a + t * 1.6 + r * 2) * 12; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      }
      for (let i = 0; i < 16 * N; i++) {
        const p = (t * (0.35 + fr(i, 1) * 0.3) + fr(i, 3)) % 1;
        const xx = (bx0 + fr(i, 4) * w) * dir + Math.sin(t * 2 + i) * 5, yy = by * 0.3 - p * 70;
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
        ctx.strokeStyle = '#cffafe'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(xx, yy, 1.5 + fr(i, 6) * 2.5, 0, TAU); ctx.stroke();
      }
    }
  } else if (fx === 'gold') {
    if (layer === 'back') {
      // 등 뒤 금빛 햇살 + 땅의 법륜
      ctx.save(); ctx.translate(cx, by * 0.9); ctx.rotate(t * 0.25);
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16, L = w * (k % 2 ? 0.5 : 0.68); ctx.globalAlpha = 0.1 + 0.07 * Math.sin(t * 2 + k); ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 0.06) * L, Math.sin(a - 0.06) * L); ctx.lineTo(Math.cos(a + 0.06) * L, Math.sin(a + 0.06) * L); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.globalAlpha = 1;
      glow(ctx, cx, by * 0.6, w * 0.9, w * 0.55, 'rgba(251,191,36,A)', 0.3);
      ctx.save(); ctx.scale(1, 0.3); ctx.rotate(-t * 0.6);
      ctx.strokeStyle = 'rgba(253,224,71,0.8)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, w * 0.62, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, w * 0.48, 0, TAU); ctx.stroke();
      for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.2, Math.sin(a) * w * 0.2); ctx.lineTo(Math.cos(a) * w * 0.62, Math.sin(a) * w * 0.62); ctx.stroke();
        spark(ctx, Math.cos(a + 0.4) * w * 0.55, Math.sin(a + 0.4) * w * 0.55, 3, '#fef3c7'); }
      ctx.restore();
      if (mv) for (let i = 0; i < 10 * N; i++) { const p = (t * 1.4 + i / 10) % 1; ctx.globalAlpha = (1 - p) * 0.8; spark(ctx, -dir * (20 + p * 90), -10 - fr(i, 8) * 30, 2.2 * (1 - p) + 0.6, '#fde047'); }
    } else {
      for (let i = 0; i < 24 * N; i++) {
        const p = (t * (0.3 + fr(i, 1) * 0.3) + fr(i, 3)) % 1;
        const a = fr(i, 4) * TAU + t * 0.5, rr = w * (0.45 + fr(i, 5) * 0.3);
        ctx.globalAlpha = Math.sin(p * Math.PI);
        spark(ctx, cx + Math.cos(a) * rr, by * 0.55 + Math.sin(a) * rr * 0.45 - p * 30, 1.2 + fr(i, 6) * 1.8, i % 2 ? '#fde047' : '#fffbeb');
      }
    }
  }
  ctx.restore();
}
