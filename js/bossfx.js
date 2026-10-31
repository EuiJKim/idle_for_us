// 두목 그림과 두목 초식 연출 (v160)
//
// 두목마다 제 그림(art/boss/<key>.png — 정면 3/4, 오른쪽을 본다)이 있다. key는 wdata가 두목에 붙인다:
//   zb-<지역 그림 번호>(사냥터 두목) · king-<번호>(십이지왕) · m-<고수 id>(고수·맹주·천마)
// 그림이 없거나 아직 안 왔으면 예전처럼 종이 인형(drawFighter)으로 그린다.
//
// 초식은 이름·무기·기운 빛깔로 연출 그림(art/bfx/<name>.jpg, 검은 바탕 — 더하기로 겹친다)을 고른다.
//   펼칠 때   두목 발밑에 빛깔 진(陣)이 돌고, 두목이 기운을 모은다(빛·떠오름)
//   경고 동안 바닥 경고 안에 그 초식 그림이 차오른다
//   터질 때   그림이 크게 터지고 빛깔 불티가 튄다
import { FX } from './skillfx.js';

const imgs = {};
function load(path) {
  let e = imgs[path];
  if (e) return e.ok ? e.img : null;
  if (typeof Image === 'undefined') return null;
  e = imgs[path] = { ok: false, img: new Image() };
  e.img.onload = () => { e.ok = true; };
  e.img.onerror = () => { e.bad = true; };
  e.img.src = path;
  return null;
}
// 구워 둔 그림만 부른다 — 없는 파일을 부르면 콘솔에 404가 쌓인다. 그림을 더하면 여기와 sw.js에 함께 적는다.
export const BOSS_ART = new Set([
  'king-1', 'king-10', 'king-11', 'king-12', 'king-2', 'king-3', 'king-4', 'king-5',
  'king-6', 'king-7', 'king-8', 'king-9', 'm-baekjagang', 'm-baekmanggi', 'm-bisain', 'm-bulpae',
  'm-cheongheo', 'm-cheonma', 'm-daechwi', 'm-dokwang', 'm-georyeok', 'm-geugak', 'm-goeak', 'm-guryeong',
  'm-gwangseom', 'm-hyegong', 'm-hyeolcheon', 'm-ilhwa', 'm-imsanggon', 'm-jingwang', 'm-jinhagun', 'm-jinpaecheon',
  'm-mabul', 'm-namgung', 'm-seophon', 'm-yayulhan', 'm-yeomcheon', 'zb-0', 'zb-1', 'zb-10',
  'zb-11', 'zb-12', 'zb-13', 'zb-14', 'zb-15', 'zb-16', 'zb-17', 'zb-18',
  'zb-19', 'zb-2', 'zb-20', 'zb-21', 'zb-3', 'zb-4', 'zb-5', 'zb-6',
  'zb-7', 'zb-8', 'zb-9',
]);
export const BFX_READY = new Set([
  'blood-burst', 'dark-orb', 'fire-pillar', 'fist-quake', 'ghost-hand', 'ice-burst', 'palm-wave', 'petal-storm',
  'poison-cloud', 'slash-azure', 'slash-crimson', 'slash-gold', 'sound-ring', 'sword-rain', 'taiji', 'thunder',
]);
export const bossImg = (key) => (key && BOSS_ART.has(key) ? load(`art/boss/${key}.png`) : null);
export const bfxImg = (name) => (name && BFX_READY.has(name) ? load(`art/bfx/${name}.jpg`) : null);

export const BFX = ['slash-gold', 'slash-azure', 'slash-crimson', 'sword-rain', 'palm-wave', 'fist-quake', 'blood-burst', 'ice-burst',
  'poison-cloud', 'fire-pillar', 'thunder', 'dark-orb', 'petal-storm', 'sound-ring', 'ghost-hand', 'taiji'];
const LINE_PATS = new Set(['line', 'charge', 'twin', 'star', 'cross', 'xcross']);
// 이름에 든 글자로 고른다 — 앞에 있을수록 먼저
const BY_NAME = [
  [/태극|양의/, 'taiji'], [/뇌|벽력|번개|뢰/, 'thunder'], [/빙|설|한빙|북해|서리/, 'ice-burst'], [/독|오독|만독|화골/, 'poison-cloud'],
  [/화염|염|불|열양|작열/, 'fire-pillar'], [/혈|피/, 'blood-burst'], [/음|소리|금|곡조|귀혼음/, 'sound-ring'], [/귀|혼|유령|명부/, 'ghost-hand'],
  [/매화|도화|야우|꽃|화우|낙화/, 'petal-storm'], [/검우|만검|비검|검진/, 'sword-rain'], [/장|여래|금강|나한|반야/, 'palm-wave'],
  [/권|주먹|붕산|투신|광/, 'fist-quake'], [/마|암|흑|천마|사도/, 'dark-orb'],
];
const BY_WEAPON = { sword: 'slash-azure', saber: 'slash-crimson', fist: 'fist-quake', fan: 'petal-storm', claw: 'ghost-hand', dagger: 'dark-orb', axe: 'fist-quake', spear: 'slash-gold' };
const hexRgb = (hx) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hx || '');
  if (!m) return '253,224,71';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
// { name, col, line } — line이면 칼날 그림(줄 경고에 길게 깐다)
export function fxFor(skillName, look = {}, pat = '') {
  const isLine = LINE_PATS.has(pat);
  let name = null;
  for (const [re, n] of BY_NAME) if (re.test(skillName || '')) { name = n; break; }
  if (!name) name = BY_WEAPON[look.weapon] || 'dark-orb';
  // 줄 경고에는 칼날·장력 그림이 어울린다 — 둥근 그림이 걸리면 칼날로
  if (isLine && !/^slash|palm|thunder|fire/.test(name)) name = look.weapon === 'saber' || name === 'blood-burst' ? 'slash-crimson' : look.aura && /#f[0-9a-f]{5}|#fde|#fbb/i.test(look.aura) ? 'slash-gold' : 'slash-azure';
  return { name, col: hexRgb(look.aura || look.trim), line: isLine };
}

// ---------- 그리기 ----------
// 경고 안에 차오르는 그림 (k: 0 → 1 차오름)
export function drawTellFx(view, ctx, tl, k) {
  const fx = tl._fx;
  if (!fx) return;
  const img = bfxImg(fx.name);
  const sq = view.squash;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const a = 0.12 + 0.5 * k * k;
  if (tl.kind === 'line') {
    const x0 = view.sx({ x: tl.x0, y: tl.y0 }), y0 = view.sy({ x: tl.x0, y: tl.y0 });
    const x1 = view.sx({ x: tl.x1, y: tl.y1 }), y1 = view.sy({ x: tl.x1, y: tl.y1 });
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.translate(x0, y0);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.globalAlpha = a;
    if (img) {
      // 칼날이 시작점에서 끝으로 밀려 나간다
      const w = tl.w * 2.2;
      ctx.drawImage(img, len * 0.5 * k - w * 0.2, -w / 2, len * (0.5 + 0.5 * k), w);
    } else {
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(${fx.col},0)`); g.addColorStop(k, `rgba(${fx.col},0.8)`); g.addColorStop(Math.min(1, k + 0.05), `rgba(${fx.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, -tl.w / 2, len, tl.w);
    }
  } else if (tl.kind === 'cone') {
    // 부채꼴 — 그 모양으로 오려서 그림을 차오르게
    const x = view.sx(tl), y = view.sy(tl);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i <= 16; i++) { const a = tl.a - tl.half + (2 * tl.half * i) / 16; ctx.lineTo(x + Math.cos(a) * tl.r, y + Math.sin(a) * tl.r * sq); }
    ctx.closePath(); ctx.clip();
    ctx.globalAlpha = a;
    const r = tl.r * (0.4 + 0.6 * k);
    if (img) ctx.drawImage(img, x - r, y - r * sq, r * 2, r * 2 * sq);
    else { ctx.fillStyle = `rgba(${fx.col},${0.5 * k})`; ctx.fillRect(x - tl.r, y - tl.r, tl.r * 2, tl.r * 2); }
  } else {
    const x = view.sx(tl), y = view.sy(tl);
    const r = tl.kind === 'donut' ? tl.r1 : tl.r;
    ctx.translate(x, y);
    ctx.scale(1, sq / 0.75);
    ctx.rotate(view.t * 0.6);
    ctx.globalAlpha = a;
    if (img) ctx.drawImage(img, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
    else {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${fx.col},${0.6 * k})`); g.addColorStop(1, `rgba(${fx.col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// 터짐 — effects에 { kind: 'bboom', wx, wy, r, fx, life, max, ang?, len? }
FX.bboom = (view, ctx, e, k) => {
  const p = 1 - k;
  const img = bfxImg(e.fx.name);
  const x = view.sx({ x: e.wx, y: e.wy }), y = view.sy({ x: e.wx, y: e.wy });
  ctx.translate(x, y);
  if (e.len) {
    ctx.rotate(e.ang);
    ctx.globalAlpha = Math.min(1, k * 1.6);
    const w = e.w * (2.6 + p * 1.2);
    if (img) ctx.drawImage(img, -e.len / 2, -w / 2, e.len, w);
    else { ctx.fillStyle = `rgba(${e.fx.col},${0.7 * k})`; ctx.fillRect(-e.len / 2, -w / 4, e.len, w / 2); }
    return;
  }
  const s = e.r * (1 + p * 0.7) * 2.4;
  ctx.scale(1, view.squash / 0.75 * (0.85 + p * 0.15));
  ctx.rotate(e.spin * p);
  ctx.globalAlpha = Math.min(1, k * 1.5);
  if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
  // v252: 매 프레임 그라데이션을 만들던 것 — 구운 빛 두 장(빛깔 + 흰 심)
  if (view.putGlow) { ctx.globalAlpha = 1; view.putGlow(ctx, e.fx.col, 0, 0, s * 0.45, 0.45 * k); view.putGlow(ctx, '255,255,255', 0, 0, s * 0.18, 0.55 * k); }
};
// 펼칠 때 발밑의 진 — { kind: 'bcast', wx, wy, r, fx, life, max }
FX.bcast = (view, ctx, e, k) => {
  const p = 1 - k;
  const x = view.sx({ x: e.wx, y: e.wy }), y = view.sy({ x: e.wx, y: e.wy });
  ctx.translate(x, y);
  ctx.scale(1, view.squash);
  const r = e.r * (0.55 + 0.45 * Math.min(1, p * 3));
  const a = Math.min(1, p * 4) * Math.min(1, k * 2.5);
  const seal = bfxImg('taiji');
  ctx.rotate(view.t * 1.4);
  ctx.globalAlpha = a * 0.75;
  if (seal) ctx.drawImage(seal, -r, -r, r * 2, r * 2);
  ctx.globalAlpha = a;
  ctx.strokeStyle = `rgba(${e.fx.col},0.9)`;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
  // 진 둘레의 여덟 점 — 돈다
  ctx.fillStyle = `rgba(${e.fx.col},0.95)`;
  for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(Math.cos(an) * r * 0.89, Math.sin(an) * r * 0.89, 4, 0, Math.PI * 2); ctx.fill(); }
};

// 두목 그림 — 숨 쉬고, 걸을 때 들썩이고, 기운을 모을 때(경고가 깔렸을 때) 떠오르며 빛난다. 맞으면 하얗게.
// 그렸으면 true (호출부는 종이 인형을 건너뛴다)
// 키(그림 높이) — 졸개(약 75)의 두 배 남짓. 맹주·천마와 십이지왕은 조금 더 크다.
export const bossHeight = (o = {}) => (o.lord ? 172 : o.king ? 162 : 150);
// v218: 십이지왕의 발밑 진 — 열두 지지(子丑寅…)가 둘러 새겨진 고리. 빛깔마다 한 번 구워 두고 돌려 찍는다
const BRANCH = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ringCache = new Map();
function kingRing(col) {
  let c = ringCache.get(col);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 320;
  const g = c.getContext('2d');
  g.translate(160, 160);
  g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(0, 0, 112, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke();
  // 안쪽 열두 살 · 바깥 눈금
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); g.lineTo(Math.cos(a) * 112, Math.sin(a) * 112); g.stroke();
    g.save(); g.rotate(a + Math.PI / 12); g.fillStyle = `rgba(${col},1)`;
    g.font = '900 24px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(BRANCH[i], 0, -131); g.restore();
  }
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 146, Math.sin(a) * 146); g.lineTo(Math.cos(a) * (i % 4 ? 141 : 136), Math.sin(a) * (i % 4 ? 141 : 136)); g.stroke();
  }
  ringCache.set(col, c);
  return c;
}
function drawKingAura(view, ctx, x, y, H, col, t, casting, alpha) {
  if (view.fxLevel <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 발밑 진 — 천천히 돌고, 초식을 모을 때는 빨리 돌며 밝아진다
  const R = H * 0.62 * (casting ? 1.08 : 1);
  ctx.globalAlpha = alpha * (casting ? 0.8 + Math.sin(t * 10) * 0.15 : 0.5);
  ctx.translate(x, y);
  ctx.scale(1, view.squash || 0.5);
  ctx.rotate(t * (casting ? 1.6 : 0.25));
  ctx.drawImage(kingRing(col), -R, -R, R * 2, R * 2);
  ctx.restore();
  // 몸에서 피어오르는 불티 — 상태 없이 시간으로 (여덟 갈래가 엇갈려 오른다)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    const ph = (t * 0.45 + i / 8) % 1;
    const sx = x + Math.sin(i * 2.4 + t * 1.3) * H * 0.28;
    const sy = y - H * 0.15 - ph * H * 0.95;
    ctx.globalAlpha = alpha * Math.sin(ph * Math.PI) * 0.8;
    ctx.fillStyle = `rgb(${col})`;
    ctx.beginPath(); ctx.arc(sx, sy, 2.2 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// v219: 고수·맹주·천마의 세력 기운 — 정파는 금빛 검 셋이 돌고, 사파는 독안개와 비수, 마교는 핏빛 불길.
// 맹주·천마(lord)는 더 크고, 머리 뒤에 해무리가 선다. 모두 상태 없이 시간으로 그린다.
const FAC_COL = { murim: '253,224,71', sapa: '74,222,128', magyo: '239,68,68', apex: '250,250,249' };
function blade(ctx, len, w) {
  ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.lineTo(w, len * 0.3); ctx.lineTo(0, len / 2); ctx.lineTo(-w, len * 0.3); ctx.closePath(); ctx.fill();
}
function drawMasterAura(view, ctx, x, y, H, fac, lord, t, casting, alpha) {
  if (view.fxLevel <= 0 || !FAC_COL[fac]) return;
  const col = FAC_COL[fac];
  const S = lord ? 1.25 : 1;
  const sq = view.squash || 0.5;
  const sp = casting ? 2.6 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (lord) {
    // 해무리 — 머리 뒤 둥근 빛과 바깥 고리
    const hy = y - H * 0.86;
    const g = ctx.createRadialGradient(x, hy, 4, x, hy, H * 0.34);
    g.addColorStop(0, `rgba(${col},${0.35 * alpha})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, hy, H * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${(0.45 + 0.2 * Math.sin(t * 3)) * alpha})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, hy, H * 0.25, 0, Math.PI * 2); ctx.stroke();
  }
  if (fac === 'murim' || fac === 'apex') {
    // 금빛 검 셋이 몸을 돈다 — 뒤로 갈 땐 옅게 · 천외(v238)는 흰 검 여섯
    const nb = fac === 'apex' ? 6 : 3;
    for (let i = 0; i < nb; i++) {
      const a = t * 1.4 * sp + (i / nb) * Math.PI * 2;
      const bx = x + Math.cos(a) * H * 0.55 * S, by = y - H * 0.5 + Math.sin(a) * H * 0.55 * S * sq;
      ctx.globalAlpha = alpha * (0.45 + 0.4 * (Math.sin(a) * 0.5 + 0.5));
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2);
      ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(${col},0.95)`; blade(ctx, 62 * S, 7);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; blade(ctx, 40 * S, 2.5);
      ctx.restore();
    }
  } else if (fac === 'sapa') {
    // 발밑 독안개 다섯 덩이가 감돌고, 비수 둘이 엇갈려 돈다 — 밝은 땅(사막)에서도 보이게 더하기가 아니라 덮어 칠한다
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 5; i++) {
      const a = t * 0.7 * sp + i * 1.26;
      const mx = x + Math.cos(a) * H * 0.38 * S, my = y - 6 + Math.sin(a) * H * 0.38 * S * sq;
      const r = H * (0.2 + 0.04 * Math.sin(t * 2 + i));
      const g = ctx.createRadialGradient(mx, my, 2, mx, my, r);
      g.addColorStop(0, `rgba(21,128,61,${0.5 * alpha})`); g.addColorStop(0.6, `rgba(20,83,45,${0.3 * alpha})`); g.addColorStop(1, 'rgba(20,83,45,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 2; i++) {
      const a = -t * 2.2 * sp + i * Math.PI;
      const bx = x + Math.cos(a) * H * 0.36 * S, by = y - H * 0.42 + Math.sin(a) * H * 0.2 * S;
      ctx.globalAlpha = alpha * 0.85;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(a);
      ctx.shadowColor = `rgb(${col})`; ctx.shadowBlur = 10; ctx.fillStyle = 'rgba(20,83,45,0.95)'; blade(ctx, 46 * S, 6); ctx.shadowBlur = 0; ctx.fillStyle = `rgba(${col},0.95)`; blade(ctx, 30 * S, 2.5); ctx.restore();
    }
  } else if (fac === 'magyo') {
    // 핏빛 불길 — 발밑에서 혀처럼 날름 오른다
    const n = lord ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const fx = x + ((i / (n - 1)) - 0.5) * H * 0.7 * S;
      const ph = (t * 1.2 * sp + i * 0.37) % 1;
      const fh = H * (0.4 + 0.22 * Math.sin(i * 1.7 + t * 4)) * S * (1 - ph * 0.4);
      ctx.globalAlpha = alpha * (0.85 - ph * 0.45);
      const g = ctx.createLinearGradient(fx, y, fx, y - fh);
      g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(1, 'rgba(127,29,29,0)');
      ctx.fillStyle = g;
      const sway = Math.sin(t * 5 + i) * 6;
      ctx.beginPath(); ctx.moveTo(fx - 14 * S, y - 2);
      ctx.quadraticCurveTo(fx - 6 + sway, y - fh * 0.6, fx + sway * 1.6, y - fh);
      ctx.quadraticCurveTo(fx + 6 + sway, y - fh * 0.6, fx + 14 * S, y - 2); ctx.fill();
    }
  }
  ctx.restore();
}
export function drawBossSprite(view, ctx, m, x, y, alpha, o) {
  const img = bossImg(m.def?.art);
  if (!img) return false;
  const t = view.t + (m.id % 7);
  const H = bossHeight(o) * (o.scale || 1);
  const W = (img.width / img.height) * H;
  const casting = o.casting;
  if (o.king && m.alive) drawKingAura(view, ctx, x, y, H, o.col, t, casting, alpha);
  const flip = (m.x ?? 0) > o.heroX;            // 그림은 오른쪽을 본다 — 무인이 왼쪽이면 뒤집는다
  const walk = m.move ? Math.abs(Math.sin(t * 9)) * 5 : 0;
  const lift = casting ? 6 + Math.sin(t * 6) * 2 : 0;
  const breathe = Math.sin(t * 2.3);
  ctx.save();
  ctx.globalAlpha = alpha;
  // 기운 — 뒤에서 은은히, 기운을 모을 때는 세게
  const col = o.col;
  const glow = ctx.createRadialGradient(x, y - H * 0.5, 4, x, y - H * 0.5, H * 0.62);
  glow.addColorStop(0, `rgba(${col},${casting ? 0.5 + Math.sin(t * 10) * 0.12 : 0.18})`);
  glow.addColorStop(1, `rgba(${col},0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(x - H * 0.65, y - H * 1.15, H * 1.3, H * 1.3);
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(x + (o.lunge || 0) * (flip ? -18 : 18), y - walk - lift + (m.alive ? 0 : (1 - alpha) * 14));
  ctx.rotate((m.move ? Math.sin(t * 9) * 0.03 : Math.sin(t * 1.2) * 0.012) * (flip ? -1 : 1));
  ctx.scale((flip ? -1 : 1) * (1 - breathe * 0.006), 1 + breathe * 0.014);
  ctx.drawImage(img, -W / 2, -H, W, H);
  // 맞았을 때 · 기운을 모을 때 빛 덧칠
  const flash = Math.max(o.flash || 0, casting ? 0.18 + Math.sin(t * 12) * 0.08 : 0);
  if (flash > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * Math.min(0.85, flash);
    ctx.filter = 'brightness(2.2)';
    ctx.drawImage(img, -W / 2, -H, W, H);
    ctx.filter = 'none';
  }
  ctx.restore();
  // 세력 기운은 그림 위에 — 뒤에 깔면 큰 그림에 가려 안 보였다
  if (o.fac && m.alive) drawMasterAura(view, ctx, x, y, H, o.fac, !!o.lord, t, casting, alpha);
  return true;
}
