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
