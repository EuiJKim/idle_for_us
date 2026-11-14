// 새 시즌 미리보기 그림 — 지금 게임의 실제 그림(무인 · 몹 · 동물 · 지역 두목)을 그대로 빌려 쓴다.
// 새 시즌 전용 그림(계획서 §M)이 나오기 전까지의 다리. 사냥터 레벨 → 지금 게임의 같은 레벨대 지역 모습.
import { drawFighter } from '../../battle.js';
import { loadArt } from '../../art.js';
import { drawCreature } from '../../creatures.js';
import { bossImg } from '../../bossfx.js';
import { ZONES_W } from '../../world/wdata.js';
import { ZONES, RANKS } from '../../data.js';

let ready = false;
export function loadLooks(onDone) { try { loadArt(() => { ready = true; onDone?.(); }); } catch { /* 그림 없이도 돈다 */ } }
export const looksReady = () => ready;

// 새 직업 → 지금 게임의 무기 그림
const WEAPON = { sword: 'sword', spear: 'spear', fist: 'fist', bow: 'fan', mage: 'fan' };
const ZLIST = ZONES_W.filter((z) => z && Array.isArray(z.lv) && z.mobs?.length).sort((a, b) => a.lv[0] - b.lv[0]);
export function zoneFor(L) {
  let z = ZLIST[0];
  for (const x of ZLIST) if (x.lv[0] <= L) z = x;
  return z;
}
export const zoneInk = (z) => ZONES[z.art]?.ink || ZONES[1].ink;
export function heroLook(lv) {
  let r = RANKS[0];
  for (const x of RANKS) if (lv >= (x.level || 0)) r = x;
  return r.look;
}

// 사냥터 바닥 — 지역 수묵 빛깔(하늘 → 땅)
export function drawGround(cx, W, H, z, dpr) {
  const ink = zoneInk(z);
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, ink[1]); g.addColorStop(0.18, ink[2]); g.addColorStop(0.32, ink[3]); g.addColorStop(1, shade(ink[3], -0.25));
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.globalAlpha = 0.18; cx.fillStyle = '#000';
  for (let i = 0; i < 60; i++) { const x = (i * 7919) % W, y = H * 0.32 + ((i * 104729) % Math.round(H * 0.68)); cx.fillRect(x, y, 8 * dpr, 2 * dpr); }
  cx.globalAlpha = 1;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// 무인 — 발끝 가운데 (x, y) · 화면 px
export function drawHero(cx, x, y, job, lv, o = {}) {
  drawFighter(cx, x, y, heroLook(lv), { t: o.t || 0, weapon: WEAPON[job] || 'sword', run: !!o.run, flip: !!o.flip, lunge: o.lunge || 0, scale: o.scale || 1 });
}
// 몹 — 엔진 몹 하나 → 그 지역 몹 그림 하나(id로 고정)
export function drawMob(cx, x, y, m, z, o = {}) {
  const t = o.t || 0, flip = !!o.flip;
  if (m.kind === 'boss') {
    const im = z.boss?.art && bossImg(z.boss.art);
    if (im && im.complete && im.naturalWidth) {
      const h = 120 * (o.scale || 1), w = h * im.naturalWidth / im.naturalHeight;
      cx.save(); cx.translate(x, y); if (flip) cx.scale(-1, 1); cx.drawImage(im, -w / 2, -h, w, h); cx.restore();
      return;
    }
    drawFighter(cx, x, y, z.boss.look, { t, weapon: z.boss.look?.weapon, scale: (z.boss.look?.scale || 1.4) * (o.scale || 1), flip });
    return;
  }
  const def = z.mobs[m.id % z.mobs.length];
  const sc = (m.kind === 'elite' ? 1.3 : 1) * (o.scale || 1);
  if (m.kind === 'elite') { cx.save(); cx.globalAlpha = 0.35; cx.fillStyle = '#a855f7'; cx.beginPath(); cx.ellipse(x, y, 30 * sc, 10 * sc, 0, 0, 7); cx.fill(); cx.restore(); }
  if (def.beast) drawCreature(cx, def.beast, x, y, { t, moving: !!o.moving, flip, scale: (def.bscale || 1) * 0.6 * sc });
  else drawFighter(cx, x, y, def.look, { t, weapon: def.look?.weapon, scale: (def.look?.scale || 1) * sc, flip, run: !!o.moving });
}
export const mobName = (m, z) => (m.kind === 'boss' ? z.boss?.name : z.mobs[m.id % z.mobs.length]?.name) || '';

// ── 옆보기 사냥터(S9 재설계) ── 하늘 · 먼 산(수묵) · 나무 그림자 · 층층 발판(이끼 돌 · 나무 난간)
export function drawSideBack(cx, W, H, z, camX, t) {
  const ink = zoneInk(z);
  const g = cx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, ink[0]); g.addColorStop(0.55, ink[1]); g.addColorStop(1, shade(ink[3], 0.1));
  cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  // 먼 산 두 겹(천천히 흐름)
  for (const [k, col, base, amp] of [[0.08, ink[2], 0.58, 0.16], [0.18, shade(ink[2], -0.25), 0.7, 0.12]]) {
    cx.fillStyle = col; cx.globalAlpha = 0.55; cx.beginPath(); cx.moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) { const u = (x + camX * k) / 180; cx.lineTo(x, H * (base - amp * (0.55 * Math.sin(u) + 0.3 * Math.sin(u * 2.3 + 1) + 0.15 * Math.sin(u * 5.1)))); }
    cx.lineTo(W, H); cx.fill(); cx.globalAlpha = 1;
  }
  // 해·달
  cx.fillStyle = ZONES[z.art]?.sun || '#c0392b'; cx.globalAlpha = 0.5; cx.beginPath(); cx.arc(W * 0.82, H * 0.2, Math.min(W, H) * 0.06, 0, 7); cx.fill(); cx.globalAlpha = 1;
}
// 발판 하나 — 화면 좌표(x0~x1, 윗면 y) · 두께 th
export function drawLedge(cx, x0, x1, y, th, z, ground = false) {
  const ink = zoneInk(z), top = shade(ink[3], 0.35), body = shade(ink[3], -0.05), dark = shade(ink[3], -0.45);
  cx.save();
  if (ground) {
    cx.fillStyle = body; cx.fillRect(x0, y, x1 - x0, th);
    cx.fillStyle = dark; for (let x = x0 - (x0 % 46); x < x1; x += 46) { cx.fillRect(x, y + th * 0.45, 28, 3); cx.fillRect(x + 20, y + th * 0.75, 24, 3); }
  } else {
    // 바위 몸통(아래로 둥글게) + 나무 받침
    cx.fillStyle = body; cx.beginPath(); cx.moveTo(x0, y);
    cx.lineTo(x1, y); cx.lineTo(x1 - 8, y + th * 0.7); cx.quadraticCurveTo((x0 + x1) / 2, y + th * 1.35, x0 + 8, y + th * 0.7); cx.closePath(); cx.fill();
    cx.fillStyle = dark; for (let x = x0 + 14; x < x1 - 14; x += 34) { cx.beginPath(); cx.arc(x, y + th * 0.55, 4, 0, 7); cx.fill(); }
    cx.strokeStyle = shade(ink[3], -0.6); cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x0 + 10, y + th * 0.25); cx.lineTo(x1 - 10, y + th * 0.25); cx.stroke();
  }
  // 이끼 윗면(물결)
  cx.fillStyle = top; cx.beginPath(); cx.moveTo(x0 - 3, y + 6);
  for (let x = x0; x <= x1; x += 10) cx.lineTo(x, y - 3 + ((x * 7) % 5));
  cx.lineTo(x1 + 3, y + 6); cx.closePath(); cx.fill();
  cx.restore();
}

// ── 그린 배경 · 발판(장마다 한 벌) ── 없거나 아직 안 왔으면 위의 그린 도형으로
const sideArt = {};
function sideImg(kind, ch) {
  const key = `${kind}${ch}`;
  if (!(key in sideArt)) {
    sideArt[key] = null;
    if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { sideArt[key] = im; }; im.src = `art/s2/${kind}/c${ch}.webp`; }
  }
  return sideArt[key];
}
export function preloadChapter(ch) { sideImg('bg', ch); sideImg('ledge', ch); if (ch < 15) { sideImg('bg', ch + 1); sideImg('ledge', ch + 1); } }
// 배경: 화면 높이에 맞추고 천천히 흐른다(넘어가면 좌우를 뒤집어 이어 붙여 이음매가 없다)
export function drawPaintedBack(cx, W, H, ch, camPx, z, camPy = 0) {
  const im = sideImg('bg', ch);
  if (!im) { drawSideBack(cx, W, H, z, camPx, 0); return; }
  // 화면보다 조금 크게 깔고 위아래로도 아주 조금 흐른다(층을 오르면 배경이 살짝 내려감)
  const h = H * 1.12, w = h * im.width / im.height, oy = -H * 0.12 + Math.min(H * 0.12, camPy * 0.08);
  let x = -((camPx * 0.25) % (w * 2));
  for (let i = 0; x + i * w < W; i++) {
    const dx = x + i * w;
    if (dx + w < 0) continue;
    cx.save();
    if (i % 2) { cx.translate(dx + w, oy); cx.scale(-1, 1); cx.drawImage(im, 0, 0, w, h); }
    else cx.drawImage(im, dx, oy, w, h);
    cx.restore();
  }
}
// 발판: 그림의 왼쪽 끝 · 가운데(되풀이) · 오른쪽 끝 세 조각으로 길이를 맞춘다. 그림 위 가장자리 = 발 딛는 면
export function drawPaintedLedge(cx, x0, x1, y, ch, z, h = 34, ground = false) {
  const im = sideImg('ledge', ch);
  if (!im) { drawLedge(cx, x0, x1, y, ground ? 200 : 26, z, ground); return; }
  const k = h / im.height, capW = Math.min((x1 - x0) / 2, im.width * 0.22 * k), sw = im.width * 0.22;
  const top = y - h * 0.12;   // 이끼 · 눈이 발보다 조금 위로
  cx.drawImage(im, 0, 0, sw, im.height, x0, top, capW, h);
  cx.drawImage(im, im.width - sw, 0, sw, im.height, x1 - capW, top, capW, h);
  const midSrcX = im.width * 0.3, midSrcW = im.width * 0.4, midW = midSrcW * k;
  for (let x = x0 + capW; x < x1 - capW; x += midW - 1) {
    const w = Math.min(midW, x1 - capW - x);
    cx.drawImage(im, midSrcX, 0, midSrcW * (w / midW), im.height, x, top, w, h);
  }
}
