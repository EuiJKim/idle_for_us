// 캐릭터별 초식 연출 — 검사(빠져 있던 다섯) · 권마 · 환마 · 극악소마.
//
// 전에는 독마 여덟과 검사 셋만 연출표가 있었고, 나머지는 옛 skillEffect가 그림 한 장을
// 띄우는 것으로 끝났다 — 몸은 서 있고 빛만 났다. 여기서 네 박자(기수식 → 시전 → 적중 → 여운)를
// 캐릭터의 결에 맞춰 짠다.
//   검사     흰 칼빛 · 금빛 검기 · 매화
//   권마     호박빛 충격 — 주먹 그림자, 바닥이 갈라지고, 땅이 울린다
//   환마     하늘빛 바람 — 바람 줄기, 꽃잎, 회오리, 헛것(잔상)
//   극악소마  보랏빛 지력 — 가는 지풍, 물결 고리, 술법진
//
// 피해는 시전한 프레임에 이미 다 들어가 있다. 여기서는 숫자를 잠시 붙들었다 풀 뿐이라
// 밸런스는 1도 안 바뀐다 (skillfx.js 머리말과 같다).
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const rnd = (n) => Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]);

// 캐릭터 빛깔 — [기본, 밝은 심, 어두운 그늘]
import { putJ, jobOfView } from './jobart.js';
export const COL = {
  sword: ['229,231,235', '255,255,255', '71,85,105'],
  fist: ['245,158,11', '253,230,138', '120,53,15'],
  fan: ['56,189,248', '224,242,254', '12,74,110'],
  ring: ['168,85,247', '233,213,255', '59,7,100'],
};
export const PLUM = '251,207,232';

// ---------- 그림 ----------
const sealCache = new Map();
function sealImg(ch, col) {
  const key = ch + col;
  let c = sealCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  g.strokeStyle = `rgba(${col},0.95)`;
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 100, 0, Math.PI * 2); g.stroke();
  // 고리 사이 여덟 마디
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.save(); g.rotate(a); g.fillStyle = `rgba(${col},0.9)`;
    g.beginPath(); g.moveTo(0, -118); g.lineTo(6, -110); g.lineTo(0, -102); g.lineTo(-6, -110); g.closePath(); g.fill(); g.restore();
  }
  g.fillStyle = `rgba(${col},0.95)`;
  g.font = '900 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 6);
  sealCache.set(key, c);
  return c;
}
export const CLASS_FX = {
  // 바닥에 퍼지는 충격 고리 (눌린 타원). rings 겹이 조금씩 늦게 퍼진다.
  // v228: 4차 무공 — 무인에게서 빛살 열여섯이 사방으로 뻗고(번갈아 길고 짧게), 가운데가 하얗게 터진다
  ultrays(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) - 60;
    const p = 1 - k;
    const grow = 1 - (1 - Math.min(1, p * 4)) ** 3;
    const fade = Math.min(1, k * 2);
    ctx.translate(x, y);
    ctx.rotate(p * 0.4);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const L = (i % 2 ? 0.6 : 1) * e.r * grow;
      const wd = (i % 2 ? 5 : 9) * fade;
      ctx.save(); ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`); g.addColorStop(0.3, `rgba(${e.col},${0.7 * fade})`); g.addColorStop(1, `rgba(${e.col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(0, -wd); ctx.lineTo(L, 0); ctx.lineTo(0, wd); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const c = ctx.createRadialGradient(0, 0, 0, 0, 0, 60 * grow + 10);
    c.addColorStop(0, `rgba(255,255,255,${0.95 * fade})`); c.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 60 * grow + 10, 0, Math.PI * 2); ctx.fill();
  },
  // v220: 무공을 펼칠 때 발밑에 직업 인장 — 가운데 큰 글자(劍·拳·扇·指·毒)와 두 겹 고리.
  // 커지며 돌다가 사라진다. 직업마다 한 번 구워 두고 찍는다.
  jobseal(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const p = 1 - k;
    const R = e.r * (0.55 + 0.45 * (1 - (1 - Math.min(1, p * 3)) ** 3));
    ctx.translate(x, y);
    ctx.scale(1, 0.45);
    ctx.rotate(p * (e.spin || 1.2));
    ctx.globalAlpha = Math.min(1, k * 2.2) * Math.min(1, p * 8) * 0.85;
    ctx.drawImage(sealImg(e.ch, e.col), -R, -R, R * 2, R * 2);
  },
  // v217: 기 모으기 — 사방에서 빛 알갱이가 한 점(두목 손끝)으로 빨려 든다. 모일수록 가운데가 밝아진다
  gather(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy }) + (e.oy || -70);
    const p = 1 - k;
    for (let i = 0; i < e.seeds.length; i++) {
      const s = e.seeds[i];
      const q = clamp01((p - s[2] * 0.4) / 0.6);
      if (q <= 0 || q >= 1) continue;
      const a = s[0] * TAU + q * 0.8;
      const r = e.r * (1 - q) ** 1.4;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.6;
      const tl = 10 + 22 * (1 - q);
      ctx.strokeStyle = `rgba(${e.col},${0.9 * Math.sin(q * Math.PI)})`;
      ctx.lineWidth = 1.5 + s[1] * 2.2;
      ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * tl, py + Math.sin(a) * tl * 0.6); ctx.lineTo(px, py); ctx.stroke();
    }
    const glow = Math.min(1, p * 1.6) * Math.min(1, k * 4);
    const gr = 18 + 26 * p;
    const g = ctx.createRadialGradient(x, y, 0, x, y, gr);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * glow})`);
    g.addColorStop(0.4, `rgba(${e.col},${0.6 * glow})`);
    g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, gr, 0, TAU); ctx.fill();
  },
  shock(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const p = 1 - k;
    ctx.translate(x, y);
    ctx.scale(1, 0.42);
    for (let i = 0; i < (e.rings || 1); i++) {
      const q = clamp01(p * 1.25 - i * 0.16);
      if (q <= 0 || q >= 1) continue;
      const r = e.r * (0.15 + 0.85 * (1 - (1 - q) ** 3));
      ctx.strokeStyle = `rgba(${e.col},${0.85 * (1 - q)})`;
      ctx.lineWidth = (e.w || 8) * (1 - q) + 1;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      if (i === 0) {
        const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
        g.addColorStop(0, `rgba(${e.col},0)`);
        g.addColorStop(1, `rgba(${e.col},${0.22 * (1 - q)})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      }
    }
  },

  // 한 점에서 번쩍 터지는 빛
  flare(v, ctx, e, k) {
    const x = v.sx({ x: e.wx }) + (e.ox || 0);
    const y = v.sy({ y: e.wy }) + (e.oy ?? -46);
    const p = 1 - k;
    const r = (e.r || 60) * (0.4 + 0.6 * Math.min(1, p * 3));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.95 * k})`);
    g.addColorStop(0.35, `rgba(${e.col},${0.6 * k})`);
    g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // 열십자 빛살
    ctx.fillStyle = `rgba(255,255,255,${0.8 * k})`;
    const L = r * 1.6;
    ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x, y - 2.5); ctx.lineTo(x + L, y); ctx.lineTo(x, y + 2.5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x, y - L * 0.7); ctx.lineTo(x - 2, y); ctx.lineTo(x, y + L * 0.7); ctx.lineTo(x + 2, y); ctx.fill();
  },

  // 바닥이 갈라진다 — 들쭉날쭉한 금이 사방으로. 어두운 금 위에 빛이 새어 나온다.
  crack(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const grow = clamp01((1 - k) * 6);
    const fade = Math.min(1, k * 2.5);
    ctx.translate(x, y);
    ctx.scale(1, 0.5);
    // v134: 그린 갈라진 땅 그림을 깔고 그 위에 빛 금을 긋는다
    ctx.globalCompositeOperation = 'source-over';
    putJ(ctx, 'crack', 0, 0, e.r * 2.3 * (0.4 + 0.6 * grow), 0.85 * fade, (e.seed || 1) * 2.3);
    const n = e.n || 7;
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      ctx.strokeStyle = pass ? `rgba(${e.col},${0.7 * fade})` : `rgba(28,18,10,${0.75 * fade})`;
      ctx.lineWidth = pass ? 1.4 : 4;
      ctx.lineJoin = 'round';
      for (let i = 0; i < n; i++) {
        let s = Math.sin((e.seed || 1) * 99 + i * 12.9898) * 43758.5453;
        const r = () => { s = Math.sin(s) * 43758.5453; return s - Math.floor(s); };
        const a0 = (i / n) * TAU + r() * 0.5;
        const len = e.r * (0.55 + r() * 0.45) * grow;
        ctx.beginPath(); ctx.moveTo(0, 0);
        let px = 0, py = 0, a = a0;
        for (let j = 1; j <= 4; j++) {
          a += (r() - 0.5) * 0.7;
          px += Math.cos(a) * len / 4; py += Math.sin(a) * len / 4;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  },

  // 반투명한 큰 주먹 그림자 — 무인 손에서 겨눈 자리로 날아가 박힌다
  fistimg(v, ctx, e, k) {
    const p = clamp01((1 - k) / (e.go ?? 0.45));
    const x0 = v.sx({ x: e.wx0 }) + (e.ox0 || 0);
    const y0 = v.sy({ y: e.wy0 }) + (e.oy0 ?? -62);
    const x1 = v.sx({ x: e.wx1 });
    const y1 = v.sy({ y: e.wy1 }) + (e.oy1 ?? -56);
    const q = 1 - (1 - p) ** 2;
    const x = x0 + (x1 - x0) * q;
    const y = y0 + (y1 - y0) * q - (e.drop ? (1 - q) * 160 : 0);
    const ang = Math.atan2(y1 - (y0 - (e.drop ? 160 : 0)), x1 - x0);
    const s = (e.size || 28) * (0.6 + 0.6 * q);
    const a = p >= 1 ? k / Math.max(0.01, 1 - (e.go ?? 0.45)) * 0.6 : 0.85;
    // 지나온 자리의 속도선
    ctx.strokeStyle = `rgba(${e.col},${0.35 * a})`;
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const ox = Math.cos(ang + Math.PI / 2) * i * s * 0.25;
      const oy = Math.sin(ang + Math.PI / 2) * i * s * 0.25;
      ctx.beginPath(); ctx.moveTo(x + ox - Math.cos(ang) * s * 2.4, y + oy - Math.sin(ang) * s * 2.4); ctx.lineTo(x + ox - Math.cos(ang) * s, y + oy - Math.sin(ang) * s); ctx.stroke();
    }
    ctx.translate(x, y);
    ctx.rotate(ang);
    // v134: 금빛 주먹 그림 (아래를 보는 그림이라 -90도 돌린다)
    if (putJ(ctx, 'fist-gold', -s * 0.4, 0, s * 2.8, a, -Math.PI / 2)) return;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.2);
    g.addColorStop(0, `rgba(${e.hot || '255,255,255'},${0.9 * a})`);
    g.addColorStop(0.5, `rgba(${e.col},${0.65 * a})`);
    g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g;
    // 주먹: 손등 + 앞으로 내민 마디 넷
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, 0, s * 0.85, s * 0.72, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(s * 0.62, (i - 1.5) * s * 0.36, s * 0.24, 0, TAU); ctx.fill();
    }
  },

  // 바람 줄기 — 무인에서 겨눈 자리로 휘어 흐르는 가는 선 여럿
  wind(v, ctx, e, k) {
    const p = 1 - k;
    const x0 = v.sx({ x: e.wx0 }) + (e.ox0 || 0);
    const y0 = v.sy({ y: e.wy0 }) + (e.oy0 ?? -56);
    const x1 = v.sx({ x: e.wx1 });
    const y1 = v.sy({ y: e.wy1 }) + (e.oy1 ?? -50);
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const n = e.n || 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * (e.spread || 14);
      const bend = (e.bend ?? 40) * (i % 2 ? 1 : -1) * (0.6 + 0.4 * ((i * 0.37) % 1));
      const head = clamp01(p * 1.7 - i * 0.05);
      const tail = clamp01(head - 0.35);
      if (head <= tail) continue;
      const pt = (t) => {
        const b = Math.sin(t * Math.PI) * bend;
        return [x0 + dx * t + nx * (off + b), y0 + dy * t + ny * (off + b)];
      };
      ctx.strokeStyle = `rgba(${e.col},${0.75 * k})`;
      ctx.lineWidth = 2.2 - (i % 2) * 0.8;
      ctx.beginPath();
      for (let j = 0; j <= 10; j++) {
        const [px, py] = pt(tail + (head - tail) * (j / 10));
        if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  },

  // 꽃잎(또는 깃털) — 한 점에서 소용돌이치며 퍼진다
  petals(v, ctx, e, k) {
    const cx = e.hero ? v.heroX : v.sx({ x: e.wx });
    const cy = (e.hero ? v.groundY : v.sy({ y: e.wy })) + (e.oy ?? -46);
    const p = 1 - k;
    for (let i = 0; i < e.seeds.length; i++) {
      const s = e.seeds[i];
      const r = (e.r || 90) * (0.2 + 0.8 * Math.min(1, p * 1.5)) * (0.5 + s[1] * 0.5);
      const a = s[0] * TAU + p * (e.spin ?? 4) * (s[2] > 0.5 ? 1 : -1);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.5 - p * 30 * s[2];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a * 2 + s[2] * 6);
      if (e.col === PLUM && putJ(ctx, 'plum-petal', 0, 0, 13 + s[1] * 7, 0.95 * Math.min(1, k * 1.8))) { ctx.restore(); continue; }
      ctx.fillStyle = `rgba(${e.col},${0.85 * Math.min(1, k * 1.8)})`;
      ctx.beginPath(); ctx.ellipse(0, 0, 5 + s[1] * 3, 2.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  },

  // 회오리 — 제자리에서 도는 나선 (들판 좌표)
  cyclone(v, ctx, e, k) {
    const x = v.sx({ x: e.wx });
    const y = v.sy({ y: e.wy });
    const p = 1 - k;
    const H = e.h || 150;
    const a = Math.min(1, p * 5) * Math.min(1, k * 3);
    for (let j = 0; j < 3; j++) {
      ctx.strokeStyle = `rgba(${j ? e.col : '255,255,255'},${(0.6 - j * 0.15) * a})`;
      ctx.lineWidth = 2.5 - j * 0.6;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const r = (e.r || 60) * (0.25 + 0.75 * t);
        const ang = t * 9 + p * 14 + j * 2.1;
        const px = x + Math.cos(ang) * r;
        const py = y - t * H + Math.sin(ang) * r * 0.32;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
  },

  // 바닥 술법진 — 겹 고리와 눈금이 돈다
  sigil(v, ctx, e, k) {
    const x = e.hero ? v.heroX : v.sx({ x: e.wx });
    const y = e.hero ? v.groundY : v.sy({ y: e.wy });
    const p = 1 - k;
    const a = Math.min(1, p * 4) * Math.min(1, k * 2.5);
    const R = (e.r || 120) * (0.7 + 0.3 * Math.min(1, p * 3));
    ctx.translate(x, y);
    ctx.scale(1, 0.42);
    ctx.rotate(p * (e.spin ?? 1.5));
    // v134: 직업마다 그린 인장 — 있으면 별·눈금 대신 그것을 돌린다
    const seal = `seal-${jobOfView(v)}`;
    if (putJ(ctx, seal, 0, 0, R * 2.15, 0.8 * a)) {
      ctx.strokeStyle = `rgba(${e.col},${0.6 * a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.04, 0, TAU); ctx.stroke();
      return;
    }
    ctx.strokeStyle = `rgba(${e.col},${0.85 * a})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.45, 0, TAU); ctx.stroke();
    // 눈금과 별 꼴
    const n = e.n || 24;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      const l = i % 3 ? 0.06 : 0.12;
      ctx.beginPath(); ctx.moveTo(Math.cos(t) * R * 0.82, Math.sin(t) * R * 0.82);
      ctx.lineTo(Math.cos(t) * R * (0.82 + l), Math.sin(t) * R * (0.82 + l)); ctx.stroke();
    }
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const t = (i * 2 / 5) * TAU - Math.PI / 2;
      const px = Math.cos(t) * R * 0.8, py = Math.sin(t) * R * 0.8;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, `rgba(${e.col},${0.25 * a})`);
    g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  },

  // 기탄 — 빛 덩이가 꼬리를 끌며 점에서 점으로 옮겨 간다 (pts 들판 좌표, 고르게 나눠 지난다)
  qiorb(v, ctx, e, k) {
    const p = clamp01((1 - k) / (e.go ?? 0.7));
    const pts = e.pts.map((q) => [v.sx({ x: q.x }) + (q.ox || 0), v.sy({ y: q.y }) + (q.oy ?? -48)]);
    if (pts.length < 2) return;
    const seg = pts.length - 1;
    const at = (t) => {
      const f = Math.min(seg - 1e-6, t * seg);
      const i = Math.floor(f);
      const r = f - i;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r - Math.sin(r * Math.PI) * (e.hop || 18)];
    };
    const fade = p >= 1 ? Math.min(1, k * 4) : 1;
    // 꼬리
    for (let j = 8; j >= 0; j--) {
      const [x, y] = at(Math.max(0, p - j * 0.012));
      ctx.fillStyle = `rgba(${e.col},${(0.5 - j * 0.05) * fade})`;
      ctx.beginPath(); ctx.arc(x, y, (e.size || 8) * (1 - j * 0.08), 0, TAU); ctx.fill();
    }
    const [x, y] = at(p);
    // v134: 섭혼마존은 그린 혼불을 날린다
    if (jobOfView(v) === 'fan' && putJ(ctx, 'soul-orb', x, y, (e.size || 8) * 5, fade, p * 8)) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, (e.size || 8) * 2.4);
    g.addColorStop(0, `rgba(255,255,255,${fade})`);
    g.addColorStop(0.4, `rgba(${e.col},${0.8 * fade})`);
    g.addColorStop(1, `rgba(${e.col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, (e.size || 8) * 2.4, 0, TAU); ctx.fill();
  },

  // 무인 둘레의 속도선 (화면 좌표, 무인을 따라간다)
  speedlines(v, ctx, e, k) {
    const cx = v.heroX;
    const cy = v.groundY - 50;
    ctx.strokeStyle = `rgba(${e.col},${0.6 * k})`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < (e.n || 14); i++) {
      const a = (i / (e.n || 14)) * TAU + (e.seed || 0);
      const r0 = 60 + ((i * 37) % 30);
      const r1 = r0 + 40 + ((i * 53) % 40) * (1 - k);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7); ctx.stroke();
    }
  },
};

// ---------- 연출을 짜는 도구 ----------
// 맞은 자리 한 곳의 '쾅' — 충격 고리 + 빛 + (원하면) 갈라짐 + 불티
export function impact(d, at, r, c, { rings = 1, crack = false, sparks = 10, flare = true, col = null } = {}) {
  const v = d.v;
  const cc = col || c[0];
  d.fx('shock', 0.42 + rings * 0.06, { wx: at.x, wy: at.y, r, col: cc, rings, w: 7 });
  if (flare) d.fx('flare', 0.24, { wx: at.x, wy: at.y, r: Math.min(90, r * 0.5), col: cc });
  if (crack && d.lvl >= 1) d.fx('crack', 0.9, { wx: at.x, wy: at.y, r: r * 0.9, col: c[1], seed: Math.random() * 100, n: 6 + d.tier });
  const n = Math.round(sparks * (d.lvl >= 2 ? 1 : d.lvl >= 1 ? 0.6 : 0.3));
  const sx = v.sx(at);
  const sy = v.sy(at) - 30;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const sp = 80 + Math.random() * 200;
    v.particles.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 140 - Math.random() * 80,
      life: 0.4 + Math.random() * 0.3, size: 2 + Math.random() * 2.5, color: `rgba(${i % 2 ? c[1] : cc},0.95)` });
  }
}

// 흔한 꼴: 자세 → (시전) → (적중: 결과를 풀고 이름을 쓴다) → 여운 → 끝
export function beats(d, pose, { cast = 0.14, hit = 0.3, end = 0.9, onCast, onHit, shake = 0.14, name = true } = {}) {
  d.mark('기수식');
  d.pose(pose, 0.3);
  d.at(cast, () => { d.mark('시전'); onCast?.(); });
  d.at(hit, () => {
    d.mark('적중');
    onHit?.();
    d.release();
    if (name) d.hanja(d.name, 1);
    d.v.shake = Math.max(d.v.shake, shake);
  });
  d.at(Math.min(end - 0.05, hit + 0.3), () => d.mark('여운'));
  d.at(end, () => { d.end(); d.mark(''); });
}

// 순간이동 꼴 (축지·사행보와 같은 뼈대): 사라지고 → 지나간 길에 잔상 → 대상 곁에 나타난다
export function blinkBeats(d, c, arrivePose, onArrive) {
  const v = d.v;
  const T = 0.3;
  d.mark('기수식');
  v.camHold = 0.12;
  d.ghost(d.from.x, d.from.y, '기모으기', 0.32, { fade: 0.28, tint: c[0], flip: d.travel < 0 });
  d.pose([[0, '순보', 'step'], [T - 0.01, '순보'], [T, arrivePose, 'step'], [T + 0.35, arrivePose], [T + 0.6, '마무리', 'inout']], 0.3);
  d.at(0.08, () => {
    d.mark('시전');
    const n = d.lvl >= 1 ? 3 : 1;
    for (let i = 1; i <= n; i++) {
      const q = i / (n + 1);
      d.ghost(d.from.x + (d.to.x - d.from.x) * q, d.from.y + (d.to.y - d.from.y) * q, '순보', 0.26,
        { a0: 0.5, tint: c[0], flip: d.travel < 0 });
    }
    d.fx('speedlines', 0.3, { col: c[1], seed: Math.random() * 6 });
    d.releasePath();
    d.focusBetween(d.to, d.target, 20);
  });
  d.at(T, () => {
    d.mark('적중');
    onArrive();
    d.release();
    d.hanja(d.name, 1);
  });
  d.at(T + 0.5, () => { d.mark('여운'); d.unfocus(); });
  d.at(T + 0.85, () => { d.end(); d.mark(''); });
}

// 연쇄 꼴: 무언가가 path의 적을 차례로 거쳐 간다. 닿을 때마다 그 적의 숫자를 푼다.
function chainBeats(d, c, pose, draw) {
  const pts = (d.path?.path || []).map((q) => ({ x: q.x, y: q.y }));
  d.path = null;
  const segT = 0.08;
  const go = Math.max(0.2, pts.length * segT);
  d.mark('기수식');
  d.pose(pose(go), 0.3);
  d.at(0.1, () => { d.mark('시전'); draw(pts, go); });
  pts.forEach((q, i) => {
    d.at(0.1 + (go * (i + 1)) / pts.length, () => {
      if (i === 0) d.mark('적중');
      let best = null;
      let bd = Infinity;
      for (const h of d.hits) { const dd = Math.hypot(h.at.x - q.x, h.at.y - q.y); if (dd < bd) { bd = dd; best = h; } }
      if (best) d.releaseHit(best);
      impact(d, q, 46, c, { flare: true, sparks: 4 });
    });
  });
  d.at(0.12 + go, () => { d.release(); d.hanja(d.name, 1); });
  d.at(0.4 + go, () => d.mark('여운'));
  d.at(0.8 + go, () => { d.end(); d.mark(''); });
}

// 관통 꼴: 빛 한 줄기가 겨눈 쪽으로 뻗고, 머리가 지나가는 차례대로 맞는다
function pierceBeats(d, c, pose, { len = 560, w = 40, wind = 4, extra } = {}) {
  const v = d.v;
  const go = 0.18;
  d.mark('기수식');
  v.faceOverride = d.aim;
  d.pose(pose, 0.3);
  d.at(0.15, () => {
    d.mark('시전');
    d.fx('lance', 0.5, { wx: d.to.x, wy: d.to.y, oy: -54, a: d.ang, len, w: w + d.tier * 8, col: c[0], wind });
    extra?.();
  });
  const ux = Math.cos(d.ang);
  const uy = Math.sin(d.ang);
  const along = (h) => Math.max(0, (h.at.x - d.to.x) * ux + (h.at.y - d.to.y) * v.squash * uy);
  for (const h of d.hits.slice()) {
    d.at(0.15 + go * Math.min(1, along(h) / len), () => {
      if (d.beat !== '적중') d.mark('적중');
      d.releaseHit(h);
      d.fx('cutline', 0.3, { wx: h.at.x, wy: h.at.y, a: d.ang + Math.PI / 2 });
    });
  }
  d.at(0.2 + go, () => { d.release(); d.hanja(d.name, 1); v.shake = Math.max(v.shake, 0.12); });
  d.at(0.7, () => { d.mark('여운'); v.faceOverride = 0; });
  d.at(1.05, () => { d.end(); d.mark(''); });
}

// 기를 모으는 강화(버프) 꼴
export function buffBeats(d, c, pose, onCast) {
  const n = d.lvl >= 2 ? 20 : d.lvl >= 1 ? 12 : 6;
  d.mark('기수식');
  d.pose(pose, 0.3);
  d.fx('motes', 0.5, { n, face: d.face, r: 95, dx: 0, dy: -52, col: c[0], seeds: rnd(n) });
  d.at(0.48, () => {
    d.mark('시전');
    d.fx('skybeam', 0.7, { wx: d.to.x, wy: d.to.y, oy: -40, col: c[0] });
    d.fx('shock', 0.6, { wx: d.to.x, wy: d.to.y, r: 110 + d.tier * 20, col: c[0], rings: 2, w: 6 });
    onCast?.();
    d.hanja(d.name, 1);
  });
  d.at(0.8, () => d.mark('여운'));
  d.at(1.05, () => { d.end(); d.mark(''); });
}

// ---------- 연출표 ----------
export const CLASS_CHOREO = {
  // ===== 검사 =====
  // 기본기 · 삼재검 — 크게 한 바퀴 베어 발밑 둘레를 쓸어 낸다
  'sword:slash'(d) {
    const c = COL.sword;
    beats(d, [[0, '발도준비', 'out'], [0.14, '일섬', 'snap'], [0.45, '일섬'], [0.7, '납도', 'inout']], {
      onCast: () => {
        d.fx('arc', 0.3, { face: d.face, r: 70 + d.tier * 10, a0: -2.4, a1: 2.2, col: c[1] });
        if (d.tier >= 1) d.fx('arc', 0.34, { face: -d.face, r: 58 + d.tier * 8, a0: -2.2, a1: 2.0, col: c[0] });
      },
      onHit: () => {
        for (const [i, h] of d.hits.slice(0, 10).entries()) d.fx('cutline', 0.3, { wx: h.at.x, wy: h.at.y, a: 0.4 + i * 0.37 });
        impact(d, d.to, (d.radius || 150) * 1.1, c, { flare: false, sparks: 6 });
      },
      hit: 0.22, end: 0.75,
    });
  },
  // 강화 · 칼끝에 기를 세운다
  'sword:rage'(d) {
    const c = COL.sword;
    buffBeats(d, c, [[0.08, '검거양', 'out'], [0.5, '검거양'], [0.62, '마무리', 'snap']], () => {
      if (d.tier >= 2) d.fx('glint', 0.4, { wx: d.to.x, wy: d.to.y, oy: -150, r: 30, col: '253,224,71' });
    });
  },
  // 광역 · 검우 — 칼을 하늘로 들면 검기가 비처럼 꽂힌다
  'sword:thunder'(d) {
    const v = d.v;
    const c = COL.sword;
    const R = d.radius || 210;
    const n = 4 + d.tier * 3;
    beats(d, [[0, '검거양', 'out'], [0.3, '검거양'], [0.38, '내려베기', 'snap'], [0.8, '내려베기'], [1.0, '납도', 'inout']], {
      cast: 0.1, hit: 0.5, end: 1.25, shake: 0.22,
      onCast: () => {
        d.fx('skybeam', 0.5, { wx: d.to.x, wy: d.to.y, oy: -120, col: c[0] });
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const r = R * Math.sqrt(Math.random()) * 0.9;
          const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
          d.at(0.28 + i * 0.03, () => {
            d.fx('needle', 0.3, { wx: spot.x, wy: spot.y, a: Math.PI / 2, len: 120, w: 5, h: 70, col: c[0] });
            d.fx('shock', 0.3, { wx: spot.x, wy: spot.y, r: 34, col: c[1], w: 4 });
          });
        }
      },
      onHit: () => impact(d, d.center, R, c, { rings: 2, sparks: 8 }),
    });
  },
  // 연쇄 · 연환검 — 검기가 적에서 적으로 금빛 줄을 긋는다
  'sword:chain'(d) {
    const c = COL.sword;
    chainBeats(d, c, (go) => [[0, '찌르기준비', 'out'], [0.1, '찌르기', 'snap'], [0.1 + go, '찌르기'], [0.4 + go, '납도', 'inout']], (pts, go) => {
      const all = [{ x: d.to.x, y: d.to.y, ox: 22 * d.face, oy: -60 }, ...pts.map((q) => ({ ...q, oy: -50 }))];
      d.fx('qiorb', go + 0.3, { pts: all, go: go / (go + 0.3), col: '253,224,71', size: 6, hop: 6 });
      all.forEach((q, i) => { if (i) d.at(0.1 + (go * i) / pts.length, () => d.fx('skyline', 0.5, { wx: all[i - 1].x, wy: all[i - 1].y, a: Math.atan2((q.y - all[i - 1].y) * d.v.squash, q.x - all[i - 1].x), len: Math.hypot(q.x - all[i - 1].x, (q.y - all[i - 1].y) * d.v.squash), oy: -50 })); });
    });
  },
  // 장판 · 매화검진 — 칼끝으로 원을 그리면 매화가 흩날리는 진이 선다
  'sword:plum'(d) {
    const c = COL.sword;
    const R = d.radius || 190;
    beats(d, [[0, '검거양', 'out'], [0.2, '내려베기', 'snap'], [0.6, '내려베기'], [0.9, '납도', 'inout']], {
      cast: 0.12, hit: 0.32, end: 1.1,
      onCast: () => d.fx('sigil', 1.0, { wx: d.center.x, wy: d.center.y, r: R, col: PLUM, n: 20, spin: 1 }),
      onHit: () => {
        d.fx('petals', 1.0, { wx: d.center.x, wy: d.center.y, r: R * 0.8, col: PLUM, seeds: rnd(18 + d.tier * 6), spin: 3 });
        impact(d, d.center, R * 0.8, c, { flare: false, sparks: 4, col: PLUM });
      },
    });
  },

  // ===== 권마 =====
  // 기본기 · 진각 — 발을 굴러 땅을 울린다. 발밑에서 충격이 퍼지고 바닥이 갈라진다.
  'fist:slash'(d) {
    const c = COL.fist;
    beats(d, [[0, '마보', 'out'], [0.08, '진각', 'snap'], [0.4, '진각'], [0.65, '마무리', 'inout']], {
      cast: 0.06, hit: 0.1, end: 0.75, shake: 0.22,
      onHit: () => impact(d, d.to, (d.radius || 150) * 1.1, c, { rings: 1 + Math.min(2, d.tier), crack: true, sparks: 12 }),
    });
  },
  // 강화 · 기를 끌어올린다 — 마보로 버티면 호박빛 기둥이 솟는다
  'fist:rage'(d) {
    const c = COL.fist;
    buffBeats(d, c, [[0.08, '마보', 'out'], [0.45, '마보'], [0.55, '쌍장', 'snap'], [0.8, '마무리', 'inout']], () => {
      if (d.lvl >= 1) d.fx('crack', 0.9, { wx: d.to.x, wy: d.to.y, r: 90, col: c[1], seed: Math.random() * 99, n: 8 });
    });
  },
  // 광역 · 권우 — 위로 쳐 올리면 하늘에서 주먹 그림자가 쏟아진다
  'fist:thunder'(d) {
    const v = d.v;
    const c = COL.fist;
    const R = d.radius || 210;
    const n = 3 + d.tier * 2;
    beats(d, [[0, '마보', 'out'], [0.12, '올려치기', 'snap'], [0.7, '올려치기'], [0.95, '마무리', 'inout']], {
      cast: 0.12, hit: 0.58, end: 1.2, shake: 0.28,
      onCast: () => {
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.random() * 0.6;
          const r = R * (0.2 + Math.random() * 0.6);
          const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
          const t = 0.12 + i * 0.06;
          d.at(t, () => d.fx('fistimg', 0.42, { wx0: spot.x, wy0: spot.y, oy0: -260, wx1: spot.x, wy1: spot.y, oy1: -20, go: 0.6, size: 24 + d.tier * 4, col: c[0], hot: c[1], drop: false }));
          d.at(t + 0.25, () => impact(d, spot, 60, c, { crack: i % 2 === 0, sparks: 5, flare: true }));
        }
      },
      onHit: () => impact(d, d.center, R, c, { rings: 2, flare: false, sparks: 6 }),
    });
  },
  // 두목 · 붕권 — 온몸을 실은 정권 한 방. 커다란 주먹 그림자가 꽂히고 땅이 꺼진다.
  'fist:frost'(d) {
    const v = d.v;
    const c = COL.fist;
    const tgt = d.hits[0]?.at || d.target;
    beats(d, [[0, '마보', 'out'], [0.18, '정권', 'snap'], [0.6, '정권'], [0.85, '마무리', 'inout']], {
      cast: 0.12, hit: 0.3, end: 1.0, shake: 0.32,
      onCast: () => d.fx('fistimg', 0.4, { wx0: d.to.x, wy0: d.to.y, ox0: 24 * d.face, wx1: tgt.x, wy1: tgt.y, go: 0.45, size: 34 + d.tier * 6, col: c[0], hot: c[1] }),
      onHit: () => {
        impact(d, tgt, 120 + d.tier * 20, c, { rings: 3, crack: true, sparks: 16 });
        v.hitstop = Math.max(v.hitstop, 0.12);
        v.flash = Math.max(v.flash, 0.15);
      },
    });
  },
  // 이동 · 질풍각 — 바람처럼 붙어 진각으로 내려앉는다
  'fist:blink'(d) {
    const c = COL.fist;
    blinkBeats(d, c, '진각', () => impact(d, d.target, 90, c, { rings: 2, crack: true, sparks: 10 }));
  },
  // 연쇄 · 연환권 — 주먹 그림자가 적에서 적으로 튄다
  'fist:chain'(d) {
    const c = COL.fist;
    chainBeats(d, c, (go) => [[0, '정권', 'snap'], [0.1 + go * 0.33, '훅', 'snap'], [0.1 + go * 0.66, '정권', 'snap'], [0.1 + go, '올려치기', 'snap'], [0.4 + go, '마무리', 'inout']], (pts, go) => {
      const all = [{ x: d.to.x, y: d.to.y, ox: 22 * d.face, oy: -60 }, ...pts.map((q) => ({ ...q, oy: -48 }))];
      d.fx('qiorb', go + 0.3, { pts: all, go: go / (go + 0.3), col: c[0], size: 10, hop: 26 });
    });
  },
  // 장판 · 지진 — 땅을 짚으면 둘레가 계속 울린다 (울림 자체는 drawFields가 그린다)
  'fist:plum'(d) {
    const c = COL.fist;
    const R = d.radius || 190;
    beats(d, [[0, '마보', 'out'], [0.18, '땅짚기', 'snap'], [0.6, '땅짚기'], [0.9, '마무리', 'inout']], {
      cast: 0.16, hit: 0.22, end: 1.05, shake: 0.24,
      onCast: () => d.fx('sigil', 0.9, { wx: d.center.x, wy: d.center.y, r: R, col: c[0], n: 12, spin: 0.6 }),
      onHit: () => impact(d, d.center, R, c, { rings: 3, crack: true, sparks: 10 }),
    });
  },
  // 관통 · 장풍 — 두 손바닥을 밀면 호박빛 장풍이 일직선으로 꿰뚫는다
  'fist:pierce'(d) {
    const c = COL.fist;
    pierceBeats(d, c, [[0, '마보', 'out'], [0.15, '쌍장', 'snap'], [0.6, '쌍장'], [0.9, '마무리', 'inout']], {
      w: 56, wind: 6,
      extra: () => d.fx('fistimg', 0.35, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, wx1: d.to.x + Math.cos(d.ang) * 300, wy1: d.to.y + Math.sin(d.ang) * 300 / d.v.squash, go: 0.6, size: 30, col: c[0], hot: c[1] }),
    });
  },

  // ===== 환마 =====
  // 기본기 · 부채를 한 바퀴 휘둘러 둘레에 바람을 일으킨다
  'fan:slash'(d) {
    const c = COL.fan;
    beats(d, [[0, '펼치기', 'out'], [0.14, '휘두르기', 'snap'], [0.5, '휘두르기'], [0.75, '마무리', 'inout']], {
      cast: 0.12, hit: 0.26, end: 0.85,
      onCast: () => {
        d.fx('petals', 0.7, { wx: d.center.x, wy: d.center.y, r: (d.radius || 150) * 0.8, col: c[1], seeds: rnd(14 + d.tier * 4), spin: 5 });
        d.fx('wind', 0.45, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, wx1: d.center.x, wy1: d.center.y, col: c[0], n: 5 });
      },
      onHit: () => impact(d, d.center, (d.radius || 150), c, { flare: false, sparks: 5 }),
    });
  },
  // 강화 · 환영 — 부채를 펼치면 둘레에 헛것이 어른거린다
  'fan:rage'(d) {
    const c = COL.fan;
    buffBeats(d, c, [[0.06, '펼치기', 'out'], [0.5, '펼치기'], [0.6, '휘두르기', 'snap'], [0.85, '마무리', 'inout']], () => {
      d.fx('petals', 1.0, { hero: true, r: 80, col: c[1], seeds: rnd(16), spin: 3 });
      const n = d.lvl >= 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? -1 : 1;
        d.ghost(d.to.x + side * 46, d.to.y + 6, '펼치기', 0.7, { a0: 0.45, tint: c[0], flip: side < 0 });
      }
    });
  },
  // 광역 · 선풍 — 겨눈 자리에 회오리가 서고 바람 줄기가 휘몰아친다
  'fan:thunder'(d) {
    const c = COL.fan;
    const R = d.radius || 210;
    beats(d, [[0, '펼치기', 'out'], [0.15, '휘두르기', 'snap'], [0.7, '휘두르기'], [0.95, '마무리', 'inout']], {
      cast: 0.12, hit: 0.45, end: 1.25, shake: 0.18,
      onCast: () => {
        d.fx('wind', 0.5, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, wx1: d.center.x, wy1: d.center.y, col: c[0], n: 7, spread: 18, bend: 60 });
        d.at(0.3, () => {
          d.fx('cyclone', 0.9, { wx: d.center.x, wy: d.center.y, r: R * 0.45, h: 160 + d.tier * 20, col: c[0] });
          d.fx('petals', 0.9, { wx: d.center.x, wy: d.center.y, r: R * 0.7, col: c[1], seeds: rnd(16 + d.tier * 5), spin: 7 });
        });
      },
      onHit: () => impact(d, d.center, R, c, { rings: 2, flare: false, sparks: 5 }),
    });
  },
  // 두목 · 환살 — 대상 둘레에 헛것 셋이 서서 한꺼번에 부채를 긋는다
  'fan:frost'(d) {
    const v = d.v;
    const c = COL.fan;
    const tgt = d.hits[0]?.at || d.target;
    beats(d, [[0, '펼치기', 'out'], [0.2, '휘두르기', 'snap'], [0.6, '휘두르기'], [0.9, '마무리', 'inout']], {
      cast: 0.1, hit: 0.4, end: 1.05, shake: 0.2,
      onCast: () => {
        const n = 2 + Math.min(2, d.tier);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + 0.4;
          const gx = tgt.x + Math.cos(a) * 70;
          const gy = tgt.y + Math.sin(a) * 40;
          d.ghost(gx, gy, '휘두르기', 0.5, { a0: 0.6, tint: c[0], flip: gx > tgt.x });
          d.at(0.3, () => d.fx('wind', 0.25, { wx0: gx, wy0: gy, wx1: tgt.x, wy1: tgt.y, col: c[1], n: 3, bend: 20 }));
        }
      },
      onHit: () => {
        impact(d, tgt, 90, c, { rings: 2, sparks: 10 });
        d.fx('petals', 0.8, { wx: tgt.x, wy: tgt.y, r: 70, col: c[1], seeds: rnd(14), spin: 6 });
        v.hitstop = Math.max(v.hitstop, 0.08);
      },
    });
  },
  // 이동 · 환영보 — 꽃잎으로 흩어졌다 대상 곁에서 다시 모인다
  'fan:blink'(d) {
    const c = COL.fan;
    d.fx('petals', 0.5, { wx: d.from.x, wy: d.from.y, r: 60, col: c[1], seeds: rnd(14), spin: 6 });
    blinkBeats(d, c, '휘두르기', () => {
      d.fx('petals', 0.6, { wx: d.target.x, wy: d.target.y, r: 70, col: c[1], seeds: rnd(14), spin: -6 });
      impact(d, d.target, 70, c, { sparks: 6 });
    });
  },
  // 연쇄 · 연풍 — 바람 덩이가 적에서 적으로 날아간다
  'fan:chain'(d) {
    const c = COL.fan;
    chainBeats(d, c, (go) => [[0, '펼치기', 'out'], [0.1, '휘두르기', 'snap'], [0.1 + go, '휘두르기'], [0.4 + go, '마무리', 'inout']], (pts, go) => {
      const all = [{ x: d.to.x, y: d.to.y, ox: 22 * d.face, oy: -60 }, ...pts.map((q) => ({ ...q, oy: -50 }))];
      d.fx('qiorb', go + 0.3, { pts: all, go: go / (go + 0.3), col: c[0], size: 8, hop: 30 });
    });
  },
  // 장판 · 환진 — 바닥에 진이 서고 꽃잎이 그 안을 맴돈다
  'fan:plum'(d) {
    const c = COL.fan;
    const R = d.radius || 190;
    beats(d, [[0, '펼치기', 'out'], [0.18, '휘두르기', 'snap'], [0.6, '휘두르기'], [0.9, '마무리', 'inout']], {
      cast: 0.12, hit: 0.3, end: 1.1,
      onCast: () => d.fx('sigil', 1.0, { wx: d.center.x, wy: d.center.y, r: R, col: c[0], n: 24, spin: 2 }),
      onHit: () => d.fx('petals', 1.0, { wx: d.center.x, wy: d.center.y, r: R * 0.85, col: c[1], seeds: rnd(16 + d.tier * 4), spin: 4, oy: -20 }),
    });
  },
  // 관통 · 풍인 — 접은 부채로 찌르면 바람 칼날이 일직선으로 뻗는다
  'fan:pierce'(d) {
    const c = COL.fan;
    pierceBeats(d, c, [[0, '펼치기', 'out'], [0.15, '찌르기', 'snap'], [0.6, '찌르기'], [0.9, '마무리', 'inout']], {
      w: 36, wind: 8,
      extra: () => d.fx('wind', 0.4, { wx0: d.to.x, wy0: d.to.y, ox0: 20 * d.face, wx1: d.to.x + Math.cos(d.ang) * 420, wy1: d.to.y + Math.sin(d.ang) * 420 / d.v.squash, col: c[1], n: 4, bend: 12 }),
    });
  },

  // ===== 극악소마 =====
  // 기본기 · 탄지 — 손가락을 튕기면 둘레로 보랏빛 물결이 번진다
  'ring:slash'(d) {
    const c = COL.ring;
    beats(d, [[0, '지법겨눔', 'out'], [0.1, '손가락튕김', 'snap'], [0.45, '손가락튕김'], [0.7, '마무리', 'inout']], {
      cast: 0.08, hit: 0.16, end: 0.75,
      onCast: () => d.fx('flare', 0.2, { wx: d.to.x, wy: d.to.y, ox: 30 * d.face, oy: -64, r: 26, col: c[0] }),
      onHit: () => {
        impact(d, d.center, (d.radius || 150) * 1.05, c, { rings: 2 + Math.min(2, d.tier), flare: false, sparks: 6 });
        for (const h of d.hits.slice(0, 8)) d.fx('glint', 0.25, { wx: h.at.x, wy: h.at.y, oy: -60, r: 14, col: c[1] });
      },
    });
  },
  // 강화 · 지력 — 손끝에 기를 모으면 발밑에 술법진이 선다
  'ring:rage'(d) {
    const c = COL.ring;
    buffBeats(d, c, [[0.08, '지법겨눔', 'out'], [0.5, '지법겨눔'], [0.6, '손가락튕김', 'snap'], [0.85, '마무리', 'inout']], () => {
      d.fx('sigil', 1.1, { hero: true, r: 90, col: c[0], n: 30, spin: 3 });
    });
  },
  // 광역 · 지우 — 하늘을 가리키면 지풍이 비처럼 내리꽂힌다
  'ring:thunder'(d) {
    const v = d.v;
    const c = COL.ring;
    const R = d.radius || 210;
    const n = 5 + d.tier * 3;
    beats(d, [[0, '지법겨눔', 'out'], [0.12, { hand: [-1.5, 30], blade: -1.5, wscale: 1.7, lean: -0.05 }, 'snap'], [0.6, { hand: [-1.5, 30], blade: -1.5, wscale: 1.7 }], [0.9, '마무리', 'inout']], {
      cast: 0.1, hit: 0.5, end: 1.2, shake: 0.18,
      onCast: () => {
        d.fx('skybeam', 0.4, { wx: d.to.x, wy: d.to.y, oy: -110, col: c[0] });
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU;
          const r = R * Math.sqrt(Math.random()) * 0.9;
          const spot = { x: d.center.x + Math.cos(a) * r, y: d.center.y + Math.sin(a) * r / v.squash * 0.6 };
          d.at(0.22 + i * 0.035, () => {
            d.fx('needle', 0.25, { wx: spot.x, wy: spot.y, a: Math.PI / 2, len: 140, w: 3, h: 70, col: c[0] });
            d.fx('shock', 0.3, { wx: spot.x, wy: spot.y, r: 30, col: c[0], w: 3, rings: 2 });
          });
        }
      },
      onHit: () => impact(d, d.center, R, c, { rings: 2, flare: false, sparks: 4 }),
    });
  },
  // 두목 · 일지 — 한 손가락이 혈을 짚는다. 점 하나가 찍히고, 한 박자 뒤 터진다.
  'ring:frost'(d) {
    const v = d.v;
    const c = COL.ring;
    const tgt = d.hits[0]?.at || d.target;
    beats(d, [[0, '지법겨눔', 'out'], [0.4, '지법겨눔'], [0.48, '손가락튕김', 'snap'], [0.85, '마무리', 'inout']], {
      cast: 0.1, hit: 0.55, end: 1.15, shake: 0.24,
      onCast: () => {
        d.fx('motes', 0.38, { n: 10, face: d.face, r: 60, dx: 34, dy: -64, col: c[0], seeds: rnd(10) });
        d.at(0.48, () => d.fx('needle', 0.3, { wx: (d.to.x + tgt.x) / 2, wy: (d.to.y + tgt.y) / 2, a: Math.atan2((tgt.y - d.to.y) * v.squash, tgt.x - d.to.x), len: Math.hypot(tgt.x - d.to.x, (tgt.y - d.to.y) * v.squash) + 40, w: 4, h: 60, col: c[0] }));
      },
      onHit: () => {
        impact(d, tgt, 100, c, { rings: 3, sparks: 14 });
        d.fx('glint', 0.4, { wx: tgt.x, wy: tgt.y, oy: -70, r: 34, col: c[1] });
        v.hitstop = Math.max(v.hitstop, 0.12);
        v.flash = Math.max(v.flash, 0.12);
      },
    });
  },
  // 이동 · 귀영 — 보랏빛 잔상을 남기고 붙어 혈을 짚는다
  'ring:blink'(d) {
    const c = COL.ring;
    blinkBeats(d, c, '지법겨눔', () => impact(d, d.target, 70, c, { rings: 2, sparks: 8 }));
  },
  // 연쇄 · 연지 — 지풍 한 알이 적에서 적으로 튄다
  'ring:chain'(d) {
    const c = COL.ring;
    chainBeats(d, c, (go) => [[0, '지법겨눔', 'out'], [0.1, '손가락튕김', 'snap'], [0.1 + go, '손가락튕김'], [0.4 + go, '마무리', 'inout']], (pts, go) => {
      const all = [{ x: d.to.x, y: d.to.y, ox: 26 * d.face, oy: -64 }, ...pts.map((q) => ({ ...q, oy: -52 }))];
      d.fx('qiorb', go + 0.3, { pts: all, go: go / (go + 0.3), col: c[0], size: 5, hop: 4 });
    });
  },
  // 장판 · 혈진 — 바닥에 보랏빛 진이 돈다
  'ring:plum'(d) {
    const c = COL.ring;
    const R = d.radius || 190;
    beats(d, [[0, '지법겨눔', 'out'], [0.18, '땅짚기', 'snap'], [0.6, '땅짚기'], [0.9, '마무리', 'inout']], {
      cast: 0.14, hit: 0.3, end: 1.1,
      onCast: () => d.fx('sigil', 1.1, { wx: d.center.x, wy: d.center.y, r: R, col: c[0], n: 36, spin: -2 }),
      onHit: () => impact(d, d.center, R * 0.9, c, { rings: 3, flare: false, sparks: 5 }),
    });
  },
  // 관통 · 지강 — 가는 지풍 한 줄기가 일직선으로 꿰뚫는다
  'ring:pierce'(d) {
    const c = COL.ring;
    pierceBeats(d, c, [[0, '지법겨눔', 'out'], [0.15, '손가락튕김', 'snap'], [0.6, '손가락튕김'], [0.9, '마무리', 'inout']], { w: 18, wind: 0 });
  },
};
