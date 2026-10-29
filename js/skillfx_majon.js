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

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const BLOOD = '220,38,38';
const SOUL = '192,132,252';
const GOLD = '253,224,71';
const GREEN = ['134,239,172', '220,252,231', '20,83,45'];
const MASK = ['168,85,247', '254,226,226', '59,7,100'];

// ---------- 그림 ----------
export const MAJON_FX = {
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
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.7);
    g.addColorStop(0, `rgba(${e.col},${0.35 * a})`); g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, v.w + 40, v.h + 40);
    const n = e.n || 14;
    ctx.translate(x, y);
    ctx.rotate(p * (e.spin || 0.6));
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      const w = 0.05 + ((i * 37) % 5) * 0.012;
      ctx.fillStyle = `rgba(${i % 3 ? e.col : '255,255,255'},${0.18 * a})`;
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
    ctx.strokeStyle = `rgba(${e.col},${0.9 * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2); ctx.stroke();
    // 팔괘처럼 나뉜 살
    for (let i = 0; i < 8; i++) { const an = (i * Math.PI) / 4; ctx.beginPath(); ctx.moveTo(Math.cos(an) * R * 0.42, Math.sin(an) * R * 0.42); ctx.lineTo(Math.cos(an) * R * 0.82, Math.sin(an) * R * 0.82); ctx.stroke(); }
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
    const g = ctx.createRadialGradient(x, y - 55, 10, x, y - 55, 90);
    g.addColorStop(0, `rgba(${GOLD},${0.5 * k * pulse})`);
    g.addColorStop(1, `rgba(${GOLD},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y - 55, 60, 90, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(254,240,138,${0.8 * k})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y - 55, 34 + p * 8, 62 + p * 8, 0, 0, TAU); ctx.stroke();
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
    const p = 1 - k;
    const open = Math.sin(Math.min(1, p * 1.3) * Math.PI);
    const R = e.r || 26;
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2);
    g.addColorStop(0, `rgba(${SOUL},${0.45 * open})`); g.addColorStop(1, `rgba(${SOUL},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2, 0, TAU); ctx.fill();
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
    ctx.fillStyle = 'rgba(241,245,249,0.95)';
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.8, s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(15,10,20,0.95)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * s * 0.32, -s * 0.18, s * 0.2, s * 0.07, sx * 0.35, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = `rgba(${BLOOD},0.95)`;
    ctx.lineWidth = s * 0.08;
    ctx.beginPath(); ctx.arc(0, s * 0.18, s * 0.42, 0.2, Math.PI - 0.2); ctx.stroke();
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
function ultimate(d, col, text, dur) {
  const v = d.v;
  if (d.lvl <= 0) { d.hanja(d.name, 1); return; }
  d.fx('letterbox', dur, { col });
  d.fx('rays', dur * 0.9, { col, n: d.lvl >= 2 ? 18 : 10, spin: 0.8 });
  d.fx('bigseal', dur, { wx: d.to.x, wy: d.to.y, r: 230, col, text });
  d.at(0.18, () => d.fx('bigname', Math.min(1.4, dur * 0.8), { text, col }));
  v.desatTo = 0.55;
  v.camHold = Math.max(v.camHold || 0, 0.25);
  d.at(dur * 0.85, () => { v.desatTo = 0; });
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
    ultimate(d, PLUM, '一花千閃', end + 0.6);
    d.mark('기수식');
    d.pose([[0, '발도준비', 'out'], [0.3, '발도준비'], [0.35, '순보', 'step'], [0.37 + list.length * gap, '순보'], [end, '일섬', 'snap'], [end + 0.45, '납도', 'inout']], 0.3);
    d.at(0.1, () => d.fx('petalstorm', end + 0.6, {}));
    d.at(0.33, () => { d.mark('시전'); d.fx('speedlines', 0.3 + list.length * gap, { col: c[1], seed: Math.random() * 6 }); });
    let prev = d.to;
    list.forEach((h, i) => d.at(0.37 + i * gap, () => {
      d.fx('skyline', 0.5, { wx: prev.x, wy: prev.y, a: Math.atan2((h.at.y - prev.y) * v.squash, h.at.x - prev.x), len: Math.hypot(h.at.x - prev.x, (h.at.y - prev.y) * v.squash), oy: -50 });
      prev = h.at;
      d.ghost(h.at.x - 26 * (i % 2 ? 1 : -1), h.at.y + 6, '일섬', 0.35, { a0: 0.8, tint: PLUM, flip: i % 2 === 0 });
      d.fx('cutline', 0.35, { wx: h.at.x, wy: h.at.y, a: 0.4 + i * 0.9 });
      d.fx('bloom', 0.7, { wx: h.at.x, wy: h.at.y, r: 34, col: PLUM, oy: -55 });
      d.releaseHit(h);
      v.shake = Math.max(v.shake, 0.1);
    }));
    d.at(end, () => {
      d.mark('적중'); d.release();
      d.fx('bloom', 1.1, { wx: d.to.x, wy: d.to.y, r: 130, n: 8, col: '244,114,182', oy: -80, spin: 2 });
      impact(d, d.to, 260, c, { rings: 3, flare: true, sparks: 18, col: PLUM });
      v.flash = Math.max(v.flash, 0.5); v.shake = Math.max(v.shake, 0.45);
    });
    d.at(end + 0.5, () => d.mark('여운'));
    d.at(end + 0.85, () => { d.end(); d.mark(''); });
  },
  // 불패권마 투신강림 — 금빛 빛살 속에 권갑 투신이 깨어난다: 하늘에서 거대한 주먹 여섯이 꽂히고 땅이 갈라진다
  'fist:m4'(d) {
    const v = d.v;
    const c = [GOLD, '255,251,235', '120,53,15'];
    ultimate(d, GOLD, '鬪神降臨', 1.9);
    d.mark('기수식');
    d.pose([[0, '마보', 'out'], [0.45, '마보'], [0.55, '진각', 'snap'], [0.9, '정권', 'snap'], [1.3, '마무리', 'inout']], 0.3);
    d.fx('motes', 0.6, { n: 24, face: d.face, r: 120, dx: 0, dy: -52, col: GOLD, seeds: rnd(24) });
    d.at(0.5, () => {
      d.mark('시전');
      d.fx('goldbody', 3.4, {});
      d.fx('skybeam', 1.0, { wx: d.to.x, wy: d.to.y, oy: -40, col: GOLD });
      v.flash = Math.max(v.flash, 0.45);
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const at = { x: d.to.x + Math.cos(a) * 150, y: d.to.y + Math.sin(a) * 80 };
      d.at(0.6 + i * 0.08, () => {
        d.fx('fistimg', 0.32, { wx0: at.x, wy0: at.y - 300, oy0: -60, wx1: at.x, wy1: at.y, oy1: -30, size: 86, col: GOLD, hot: c[1], go: 0.22, drop: true });
        d.at(0.82 + i * 0.08, () => { d.fx('shock', 0.5, { wx: at.x, wy: at.y, r: 90, col: GOLD, rings: 2, w: 6 }); d.fx('crack', 1.0, { wx: at.x, wy: at.y, r: 80, col: c[1], seed: Math.random() * 99, n: 6 }); v.shake = Math.max(v.shake, 0.22); });
      });
    }
    d.at(1.2, () => {
      d.mark('적중'); d.release();
      d.fx('fistimg', 0.4, { wx0: d.to.x, wy0: d.to.y - 320, oy0: -60, wx1: d.to.x, wy1: d.to.y, oy1: -40, size: 150, col: GOLD, hot: c[1], go: 0.25, drop: true });
      d.at(1.45, () => { impact(d, d.to, 300, c, { rings: 3, crack: true, sparks: 22 }); v.flash = Math.max(v.flash, 0.6); v.shake = Math.max(v.shake, 0.55); });
    });
    d.at(1.6, () => d.mark('여운'));
    d.at(1.95, () => { d.end(); d.mark(''); });
  },
  // 독왕 만독지옥 — 하늘이 독빛으로 물들고 독비가 사냥터를 덮는다. 독사가 적들을 꿰고, 해골이 줄지어 떠오른다.
  'poison:m4'(d) {
    const v = d.v;
    ultimate(d, GREEN[0], '萬毒地獄', 2.0);
    beats(d, [[0, '흩뿌리기', 'out'], [0.5, '흩뿌리기'], [0.6, '땅짚기', 'snap'], [1.5, '마무리', 'inout']], {
      cast: 0.15, hit: 1.05, end: 2.0, shake: 0.4, name: false,
      onCast: () => {
        d.fx('miasma', 2.0, { now: 0, v: 3 });
        d.fx('sigil', 1.9, { wx: d.to.x, wy: d.to.y, r: 420, col: GREEN[0], n: 36, spin: 1 });
        const spots = hitsOr(d, 18);
        for (const [i, at] of spots.entries()) d.at(0.2 + i * 0.035, () => d.fx('rainfall', 1.1, { wx: at.x, wy: at.y, r: 140, v: 3 }));
        const pts = hitsOr(d, 8).map((at) => ({ x: at.x, y: at.y }));
        if (pts.length > 1) d.at(0.5, () => d.fx('serpent', 1.1, { pts: [{ x: d.to.x, y: d.to.y }, ...pts], go: 0.85, v: 3, body: 12 }));
        d.at(0.45, () => d.lob('pglob', 0.4, d.target, { fly: 0.38, size: 16, h: 160 }));
      },
      onHit: () => {
        for (const at of hitsOr(d, 14)) d.burst(at, 90, { puddle: 1.2, drops: 8 });
        d.skulls(d.hits, 8);
        d.fx('skull', 1.2, { wx: d.to.x, wy: d.to.y, oy: -200, size: 40, v: 3 });
        v.flash = Math.max(v.flash, 0.4);
      },
    });
  },
  // 극악소마 삼공합일 — 핏빛 빛살 속 거대한 웃는 가면. 지풍이 꿰고, 장력이 휩쓸고, 비수 스물넷이 쏟아진다.
  'ring:m4'(d) {
    const v = d.v;
    const c = [BLOOD, '254,226,226', '69,10,10'];
    ultimate(d, BLOOD, '三功合一', 1.8);
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
      onHit: () => { impact(d, d.target, 240, c, { rings: 3, crack: true, sparks: 20 }); v.flash = Math.max(v.flash, 0.5); },
    });
  },
  // 섭혼마존 환영분신술 — 보랏빛 빛살, 거꾸로 도는 시공의 인장, 분신 둘이 솟아 사방을 휩쓴다
  'fan:m4'(d) {
    const v = d.v;
    const c = [SOUL, '254,226,226', '59,7,100'];
    const R = d.radius || 280;
    ultimate(d, SOUL, '幻影分身', 1.6);
    beats(d, [[0, '기모으기', 'out'], [0.45, '기모으기'], [0.55, '펼치기', 'snap'], [1.1, '마무리', 'inout']], {
      cast: 0.1, hit: 0.75, end: 1.6, shake: 0.3, name: false,
      onCast: () => {
        d.fx('sigil', 1.5, { wx: d.to.x, wy: d.to.y, r: R * 1.2, col: SOUL, n: 22, spin: -2 });
        const off = [[-1, -0.4], [1, -0.4], [-0.6, 0.6], [0.6, 0.6]];
        off.forEach(([ox, oy], i) => d.at(0.2 + i * 0.1, () => {
          d.ghost(d.to.x + ox * 70, d.to.y + oy * 60, i % 2 ? '휘두르기' : '펼치기', 0.9, { a0: 0.75, tint: i % 2 ? BLOOD : SOUL });
          d.fx('flare', 0.35, { wx: d.to.x + ox * 70, wy: d.to.y + oy * 60, r: 60, col: SOUL });
          d.fx('qiorb', 0.5, { pts: [{ x: d.to.x, y: d.to.y, oy: -55 }, { x: d.to.x + ox * 70, y: d.to.y + oy * 60, oy: -50 }], go: 0.9, col: SOUL, size: 7, hop: 16 });
        }));
      },
      onHit: () => {
        impact(d, d.to, R * 1.1, c, { rings: 3, sparks: 18 });
        for (const at of hitsOr(d, 10)) d.fx('eye', 0.8, { wx: at.x, wy: at.y, r: 14, oy: -105 });
        v.flash = Math.max(v.flash, 0.4);
      },
    });
  },
  // ===== 보조기 (v120) =====
  // 일화검존 유운보 — 구름 같은 걸음: 바람 줄과 꽃잎이 몸을 감싸 돈다
  'sword:m3'(d) {
    const c = [PLUM, '255,255,255', '71,85,105'];
    buffBeats(d, c, [[0.05, '순보', 'out'], [0.4, '순보'], [0.5, '착지', 'snap'], [0.8, '마무리', 'inout']], () => {
      d.fx('speedlines', 0.6, { col: c[1], seed: Math.random() * 6 });
      d.fx('petals', 1.6, { wx: d.to.x, wy: d.to.y, r: 70, col: PLUM, seeds: rnd(16), spin: 5, hero: true });
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
      d.fx('sigil', 1.0, { wx: d.to.x, wy: d.to.y, r: 110, col: SOUL, n: 16, spin: -3 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        d.ghost(d.to.x + Math.cos(a) * 70, d.to.y + Math.sin(a) * 40, '기모으기', 0.5, { a0: 0.45, tint: SOUL });
        d.fx('qiorb', 0.5, { pts: [{ x: d.to.x + Math.cos(a) * 70, y: d.to.y + Math.sin(a) * 40, oy: -50 }, { x: d.to.x, y: d.to.y, oy: -55 }], go: 0.9, col: SOUL, size: 6, hop: 10 });
      }
    });
  },
  // 독왕 만독귀원 — 적들 몸의 독이 한꺼번에 터지고 초록 기운이 무인에게 모인다
  'poison:m3'(d) {
    beats(d, [[0, '땅짚기', 'out'], [0.25, '땅짚기'], [0.35, '펼치기', 'snap'], [0.8, '마무리', 'inout']], {
      cast: 0.1, hit: 0.35, end: 1.0, shake: 0.2,
      onCast: () => d.fx('sigil', 0.9, { wx: d.to.x, wy: d.to.y, r: d.radius || 320, col: GREEN[0], n: 20, spin: 2 }),
      onHit: () => {
        const list = hitsOr(d, 8);
        for (const at of list) { d.burst(at, 70, { puddle: 0.4, drops: 6 }); }
        d.skulls(d.hits, 3);
        for (const at of list.slice(0, 5)) d.fx('qiorb', 0.55, { pts: [{ x: at.x, y: at.y, oy: -40 }, { x: d.to.x, y: d.to.y, oy: -55 }], go: 0.9, col: GREEN[0], size: 6, hop: 18 });
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
      d.fx('arc', 0.3, { face: d.face, r: 80, a0: -2.2, a1: 1.6, col: c[1] });
      d.fx('cutline', 0.4, { wx: d.target.x, wy: d.target.y, a: 0.5 });
      d.fx('bloom', 0.9, { wx: d.target.x, wy: d.target.y, r: 46, col: PLUM, oy: -60 });
      impact(d, d.target, 90, c, { flare: true, sparks: 8, col: PLUM });
    });
  },
  // 낙화유수 — 두 번 휘두르면 꽃잎이 물 흐르듯 둘레에 진다
  'sword:m1'(d) {
    const c = COL.sword;
    const R = d.radius || 240;
    beats(d, [[0, '발도준비', 'out'], [0.12, '일섬', 'snap'], [0.3, '납도', 'snap'], [0.42, '일섬', 'snap'], [0.8, '납도', 'inout']], {
      cast: 0.1, hit: 0.44, end: 1.0,
      onCast: () => {
        d.fx('arc', 0.3, { face: d.face, r: 86, a0: -2.4, a1: 2.2, col: c[1] });
        d.at(0.4, () => d.fx('arc', 0.3, { face: -d.face, r: 92, a0: -2.2, a1: 2.0, col: PLUM }));
        d.fx('petals', 1.2, { wx: d.to.x, wy: d.to.y, r: R * 0.85, col: PLUM, seeds: rnd(26), spin: 2 });
      },
      onHit: () => {
        for (const [i, at] of hitsOr(d, 10).entries()) d.fx('cutline', 0.3, { wx: at.x, wy: at.y, a: 0.3 + i * 0.41 });
        impact(d, d.to, R, c, { flare: false, sparks: 6, col: PLUM });
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
        d.fx('sigil', 1.3, { wx: d.center.x, wy: d.center.y, r: R, col: PLUM, n: 24, spin: -1 });
        d.fx('petals', 1.3, { wx: d.center.x, wy: d.center.y, r: R, col: PLUM, seeds: rnd(36), spin: -4 });
        d.at(0.4, () => d.fx('bloom', 1.0, { wx: d.center.x, wy: d.center.y, r: 95, n: 8, col: '244,114,182', oy: -90, spin: 2 }));
        const n = d.lvl >= 2 ? 14 : 8;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const r = R * Math.sqrt(Math.random()) * 0.9;
          const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
          d.at(0.55 + i * 0.025, () => {
            d.fx('needle', 0.3, { wx: spot.x, wy: spot.y, a: Math.PI / 2, len: 130, w: 5, h: 80, col: c[1] });
            d.fx('shock', 0.3, { wx: spot.x, wy: spot.y, r: 30, col: PLUM, w: 3 });
          });
        }
      },
      onHit: () => { impact(d, d.center, R, c, { rings: 3, sparks: 14, col: PLUM }); d.fx('flare', 0.4, { wx: d.center.x, wy: d.center.y, r: 120, col: PLUM, oy: -90 }); },
    });
  },

  // ===== 불패권마 =====
  // 붕산철권 — 마보로 버티다 한 주먹. 산만 한 주먹 그림자가 꽂히고 땅이 갈라진다.
  'fist:m0'(d) {
    const c = COL.fist;
    beats(d, [[0, '마보', 'out'], [0.16, '정권', 'snap'], [0.5, '정권'], [0.7, '마무리', 'inout']], {
      cast: 0.12, hit: 0.26, end: 0.85, shake: 0.32,
      onCast: () => d.fx('fistimg', 0.3, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, oy0: -64, wx1: d.target.x, wy1: d.target.y, oy1: -50, size: 70, col: c[0], hot: c[1], go: 0.14 }),
      onHit: () => impact(d, d.target, 120, c, { rings: 2, crack: true, sparks: 14 }),
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
            d.fx('fistimg', 0.22, { wx0: d.to.x, wy0: d.to.y, oy0: -60, wx1: to.x, wy1: to.y, oy1: -40, size: 48, col: c[0], go: 0.1 });
            d.fx('shock', 0.35, { wx: to.x, wy: to.y, r: 60, col: c[1], w: 5 });
            d.v.shake = Math.max(d.v.shake, 0.12);
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

  // ===== 섭혼마존 =====
  // 섭혼술 — 대상 머리 위에 핏빛 눈이 뜨이고, 보랏빛 실이 혼을 끌어당긴다
  'fan:m0'(d) {
    const c = [SOUL, '254,226,226', '59,7,100'];
    beats(d, [[0, '펼치기', 'out'], [0.2, '휘두르기', 'snap'], [0.6, '휘두르기'], [0.8, '마무리', 'inout']], {
      cast: 0.1, hit: 0.42, end: 1.0,
      onCast: () => {
        d.fx('eye', 1.0, { wx: d.target.x, wy: d.target.y, r: 26 });
        d.fx('lance', 0.4, { wx: d.to.x, wy: d.to.y, a: Math.atan2((d.target.y - d.to.y) * d.v.squash, d.target.x - d.to.x), len: Math.hypot(d.target.x - d.to.x, (d.target.y - d.to.y) * d.v.squash), w: 4, col: SOUL, oy: -60 });
      },
      onHit: () => { impact(d, d.target, 80, c, { flare: true, sparks: 6 }); d.fx('sigil', 0.8, { wx: d.target.x, wy: d.target.y, r: 70, col: SOUL, n: 12, spin: 2 }); },
    });
  },
  // 혈루미혼 — 핏빛 눈물이 둘레에 쏟아지고 혼이 홀린다
  'fan:m1'(d) {
    const c = [BLOOD, '254,202,202', '69,10,10'];
    const R = d.radius || 200;
    beats(d, [[0, '펼치기', 'out'], [0.15, '휘두르기', 'snap'], [0.7, '마무리', 'inout']], {
      cast: 0.08, hit: 0.5, end: 1.1,
      onCast: () => {
        d.fx('tears', 1.1, { wx: d.center.x, wy: d.center.y, r: R * 0.9, seeds: rnd(d.lvl >= 2 ? 30 : 16) });
        d.fx('sigil', 1.1, { wx: d.center.x, wy: d.center.y, r: R, col: BLOOD, n: 16, spin: 1 });
      },
      onHit: () => {
        for (const at of hitsOr(d, 6)) d.fx('eye', 0.7, { wx: at.x, wy: at.y, r: 14, oy: -105 });
        impact(d, d.center, R, c, { flare: false, sparks: 6 });
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
        for (const [i, at] of hitsOr(d, 8).entries()) d.at(0.6 + i * 0.03, () => d.fx('vbolt', 0.35, { wx: at.x, wy: at.y, a: Math.PI / 2, len: 160, v: 3, go: 0.1 }));
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
        for (let i = 0; i < 7; i++) d.at(0.12 + i * 0.025, () => d.lob('dart', 0.22, { x: d.target.x + (i - 3) * 6, y: d.target.y }, { fly: 0.2, oy1: -40 - (i % 3) * 8 }));
      },
      onHit: () => { d.burst(d.target, 80, { puddle: 0.6, drops: 10 }); d.fx('skull', 0.9, { wx: d.target.x, wy: d.target.y, oy: -115, size: 15, v: d.tier }); },
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
        d.fx('sigil', 1.4, { wx: d.center.x, wy: d.center.y, r: R, col: GREEN[0], n: 28, spin: 1 });
        d.fx('rainfall', 1.2, { wx: d.center.x, wy: d.center.y, r: R, v: d.tier });
        const pts = hitsOr(d, 6).map((at) => ({ x: at.x, y: at.y }));
        if (pts.length > 1) d.fx('serpent', 1.0, { pts: [{ x: d.to.x, y: d.to.y }, ...pts], go: 0.8, v: d.tier, body: 9 });
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
      onCast: () => d.fx('lance', 0.25, { wx: d.to.x, wy: d.to.y, a: Math.atan2((d.target.y - d.to.y) * d.v.squash, d.target.x - d.to.x), len: Math.hypot(d.target.x - d.to.x, (d.target.y - d.to.y) * d.v.squash), w: 3, col: BLOOD, oy: -62 }),
      onHit: () => {
        d.fx('scar', 0.8, { wx: d.target.x, wy: d.target.y, a: -0.6, len: 40, v: 3 });
        d.fx('tears', 0.7, { wx: d.target.x, wy: d.target.y, r: 26, seeds: rnd(8) });
        impact(d, d.target, 70, c, { flare: true, sparks: 10 });
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
        d.fx('mask', 0.9, { oy: -160, size: 26 });
        d.fx('fistimg', 0.25, { wx0: d.to.x, wy0: d.to.y, oy0: -60, wx1: d.to.x + 60 * d.face, wy1: d.to.y, oy1: -50, size: 80, col: c[0], hot: c[1], go: 0.12 });
      },
      onHit: () => {
        impact(d, d.to, R, c, { rings: 2, crack: true, sparks: 14 });
        for (const at of hitsOr(d, 6)) d.fx('mask', 0.6, { wx: at.x, wy: at.y, oy: -110, size: 12 });
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
            d.fx('flare', 0.18, { wx: h.at.x, wy: h.at.y, r: 34, col: MASK[1] });
            if (h.kind) d.releaseHit(h);
            v.shake = Math.max(v.shake, 0.06);
          });
        }
      },
    });
  },
};
