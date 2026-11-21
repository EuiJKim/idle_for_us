// 새 시즌 미리보기 그림 — 지금 게임의 실제 그림(무인 · 몹 · 동물 · 지역 두목)을 그대로 빌려 쓴다.
// 새 시즌 전용 그림(계획서 §M)이 나오기 전까지의 다리. 사냥터 레벨 → 지금 게임의 같은 레벨대 지역 모습.
import { drawFighter } from '../../battle.js';
import { loadArt, registerArt, OUTFIT_BODY, OUTFIT_WEAPON, WEAPON_FIT, HEAD_FIT, FIT } from '../../art.js';
import { HEAD_ANCHOR } from '../../headanchor.js';
import { drawCreature } from '../../creatures.js';
import { bossImg } from '../../bossfx.js';
import { ZONES_W } from '../../world/wdata.js';
import { ZONES, RANKS } from '../../data.js';
import { ROSTER, mobLook } from '../tables/mobs.js';

let ready = false;
export function loadLooks(onDone) { try { loadArt(() => { ready = true; onDone?.(); }); } catch { /* 그림 없이도 돈다 */ } }
export const looksReady = () => ready;

// 새 직업 → 지금 게임의 무기 그림
const WEAPON = { sword: 'sword', spear: 'spear', fist: 'fist', bow: 'bow', mage: 'staff' };   // v500 궁사는 활 · 술사는 지팡이(전엔 둘 다 부채)
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
// v516 낀 장비가 무인에게 보인다 — 부위마다 등급(범 0 … 천 6)에 따라
//   상의: 도포 그림(등급마다 다른 도포) + 둘레 빛 테 · 하의: 바지 빛깔 · 모자: 머리띠 빛깔(신 · 천은 금관) · 장갑: 손목 보호대 빛깔
//   신발: 장화 빛깔 · 망토: 등 뒤 망토 · 허리띠: 띠와 옥 노리개 · 목걸이: 몸 둘레 기운 낟알 · 반지: 발밑 문양 · 무기: 칼빛(진부터 빛남)
//   가장 높은 등급이 신(5)↑이면 몸 기운
// v517 장비 모양 조각(art/s2/wear) — 상의는 도포 그림, 모자는 머리(같은 얼굴 + 쓰개), 무기는 손에 쥔 그림. 받기 전에는 v516 빛깔로 그린다
const WEAR_PAD = 60, WEAR_HC = 140, WEAR_BOT = 40, WEAR_SPLIT = 22;   // v585 아래 BOT — 턱 · 목까지 그린 머리(tools/s2art/head_fit2.py)   // 머리 조각: 위 여유 · 상투 머리(잘라 낸 뒤) 높이 — tools/s2art/wear_fit.py와 같다
const wear = {};
let wearN = 0;
export const wearCount = () => wearN;
function wearImg(name, reg) {
  if (!(name in wear)) { wear[name] = null; if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { reg(im); wear[name] = im; wearN++; }; im.src = `art/s2/wear/${name}.webp`; } }
  return wear[name];
}
function wearBody(g) {
  const key = `body-s2-${g}`;
  if (!wearImg(`body-${g}`, (im) => { registerArt(key, im); if (!OUTFIT_BODY.includes(key)) OUTFIT_BODY.push(key); })) return null;
  return OUTFIT_BODY.indexOf(key);
}
function wearHead(g) {
  const key = `head-s2-${g}`;
  return wearImg(`head-${g}`, (im) => {
    // 상투 머리의 자리 값을 위 여유만큼 옮겨 그대로 — 얼굴 · 이마 · 턱이 같은 자리에 온다
    // v585 화폭 = 위 PAD + 머리 HC + 아래 BOT(턱 · 목). 자리 값(위에서)은 그만큼 옮기고, 그림은 BOT만큼 내려 그린다 —
    //   얼굴은 전 자리 그대로 · 턱은 앞에 · 목은 몸(옷깃) 뒤로(HEAD_SPLIT 아래는 몸 뒤에 그린다)
    const H = WEAR_PAD + WEAR_HC + WEAR_BOT, f = (v) => (WEAR_PAD + v * WEAR_HC) / H, fb = (v) => (WEAR_BOT + v * WEAR_HC) / H;   // fb: 아래에서 잰 값(눈 · 눈썹)
    const A = HEAD_ANCHOR['head-topknot'], T = HEAD_FIT['head-topknot'], F0 = T.fit || FIT.head;
    HEAD_ANCHOR[key] = { ...A, eyeY: f(A.eyeY), browY: f(A.browY), topY: f(A.topY), jawY: f(A.jawY) };
    registerArt(key, im, { ...T, crop: 1, brow: fb(T.brow), eye: fb(T.eye), fit: { ...F0, y: F0.y + (WEAR_BOT * F0.w) / im.width }, split: F0.y + (WEAR_SPLIT * F0.w) / im.width });   // 턱 아래 WEAR_SPLIT px부터 몸 뒤로
  }) ? key : null;
}
const WEAR_W = { sword: 'sword', spear: 'spear', fist: 'fist', mage: 'staff' };   // 궁사 활은 그려 넣는 모양 그대로(빛만)
const WEAR_FIT = { sword: { grip: 0.82, h: 48 }, spear: { grip: 0.6, h: 84, flip: true }, fist: { grip: 0.5, h: 19, bare: true }, staff: { grip: 0.6, h: 84 } };   // 지팡이는 머리(구슬)가 위 — 창처럼 뒤집지 않는다
function wearWeapon(job, g) {
  const kind = WEAR_W[job]; if (!kind) return null;
  const key = `wp-s2-${kind}-${g}`;
  if (!wearImg(`wp-${kind}-${g}`, (im) => { registerArt(key, im); WEAPON_FIT[key] = { ...WEAR_FIT[kind] }; if (!OUTFIT_WEAPON.includes(key)) OUTFIT_WEAPON.push(key); })) return null;
  return OUTFIT_WEAPON.indexOf(key);
}
// v518 나머지 부위 그림 — 그대로 쓰는 그림(장화 · 다리 · 보호대 · 망토 · 허리띠 · 목걸이 · 활) · 발밑 문양은 그림 조각으로 등록
const wearRaw = (name) => wearImg(name, () => {});
function wearRing(g) { const key = `ring-s2-${g}`; return wearImg(`ring-${g}`, (im) => registerArt(key, im)) ? `s2-${g}` : null; }
export const GEAR_COL = ['#9ca3af', '#7cc47a', '#6aa8e0', '#b27ae0', '#e8c26a', '#e06a5a', '#f8fafc'];
const TOP_BODY = [{ robe: '#6b5640' }, { robe: '#3f3a36' }, { outfitBody: 0 }, { robe: '#4c1d5f' }, { robe: '#fffbeb' }, { outfitBody: 4 }, { robe: '#f8f4ea' }];
const NECK_AURA = [null, null, 'firefly', 'spark', 'gold', 'ember', 'snow'];
const RING_FOOT = [null, null, 'frost', 'bagua', 'taiji', 'flame', 'lotus'];
const shadeHex = (h, k) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return `#${v.map((c) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k))).toString(16).padStart(2, '0')).join('')}`; };
export function gearLook(lv, eq, job) {
  const look = { ...heroLook(lv) }, o = {};
  if (!eq) return { look, o };
  const G = (s) => (eq[s] ? eq[s].g : -1);
  const top = G('top'); if (top >= 0) { const wb = wearBody(top); Object.assign(look, wb != null ? { outfitBody: wb } : TOP_BODY[top]); delete look.robeTint; if (top >= 1) { look.edge = GEAR_COL[top]; look.edgeW = [1, 1, 1.2, 1.5, 1.8, 2.1, 2.4][top]; look.edgeGlow = top >= 3; look.edgePulse = top >= 5; look.edgeTint = top >= 4 ? 0.1 : 0; } }
  const bot = G('bottom'); if (bot >= 0) look.pantsCol = shadeHex(bot === 0 ? '#6b5640' : GEAR_COL[bot], bot >= 4 ? -0.25 : -0.4);
  const hat = G('hat'); const wh = hat >= 0 ? wearHead(hat) : null;
  if (wh) { look.head = 'topknot'; look.fhead = wh; }   // 쓰개를 그린 머리(금관 · 깃털관은 그림 안에)
  else { if (hat >= 1) { look.band = GEAR_COL[hat]; look.head = look.head || 'topknot'; } if (hat >= 5) look.crown = true; }
  const glv = G('glove'); if (glv >= 0) look.cuff = glv === 0 ? '#8a7a66' : GEAR_COL[glv];
  const sh = G('shoes'); if (sh >= 0) look.boot = sh === 0 ? '#2a1f18' : shadeHex(GEAR_COL[sh], -0.45);
  const cp = G('cape'); if (cp >= 0) look.cape = { col: cp === 0 ? '#6b5a48' : GEAR_COL[cp], g: cp };
  const bl = G('belt'); if (bl >= 0) look.belt = { col: bl === 0 ? '#5a4a38' : GEAR_COL[bl], g: bl };
  const nk = G('neck'); if (NECK_AURA[nk]) look.gAura = NECK_AURA[nk];
  const rg = G('ring'); if (RING_FOOT[rg]) look.gRing = RING_FOOT[rg];
  const wp = G('weapon'); if (wp >= 0) { o.blade = wp === 0 ? '#cbd5e1' : GEAR_COL[wp]; if (wp >= 2) { o.glow = true; o.glowCol = GEAR_COL[wp]; } const ww = wearWeapon(job, wp); if (ww != null) look.outfitWeapon = ww; else if (job === 'sword') look.outfitWeapon = [0, 1, 2, 3, 4, 5, 5][wp]; }   // 검객은 등급마다 다른 검 그림
  // v518 그림이 있으면 그림으로(받기 전엔 위 빛깔 그대로)
  if (sh >= 0) look.s2boot = wearRaw(`boot-${sh}`);
  if (bot >= 0) look.s2leg = wearRaw(`leg-${bot}`);
  if (glv >= 0) look.s2arm = wearRaw(`arm-${glv}`);
  if (look.cape) look.cape.img = wearRaw(`cape-${cp}`);
  if (look.belt) look.belt.img = wearRaw(`belt-${bl}`);
  if (nk >= 0) look.s2neck = wearRaw(`neck-${nk}`);
  if (rg >= 0) { const wr = wearRing(rg); if (wr) look.gRing = wr; }
  if (wp >= 0 && job === 'bow') o.bowArt = wearRaw(`bow-${wp}`);
  const best = Math.max(...['weapon', 'hat', 'top', 'bottom', 'glove', 'shoes', 'cape', 'belt', 'neck', 'ring'].map(G));
  if (best >= 5) look.aura = GEAR_COL[best];
  return { look, o };
}
export function drawHero(cx, x, y, job, lv, o = {}) {
  const GL = gearLook(lv, o.eq, job);
  drawFighter(cx, x, y, GL.look, { ...GL.o,  t: o.t || 0, weapon: WEAPON[job] || 'sword', run: !!o.run && !o.pose, flip: !!o.flip, turn: o.turn, lunge: o.lunge || 0, scale: o.scale || 1, pose: o.pose || null, wfx: o.wfx || null });   // v628 wfx: 무기를 그린 자리에서 부르는 덧그림(전직 무기 빛)
}
// 몹 — 엔진 몹 하나 → 그 지역 몹 그림 하나(id로 고정)
// ── 몹 그리기(v501) — 장마다 몹 표(tables/mobs.js)의 그림. 한 장짜리 그림을 몸짓으로 살린다
//   o.atk: 공격 몸짓 0→1(뒤로 젖혔다가 앞으로 내지름) · o.hurt: 맞은 직후 1→0(뒤로 젖혀짐) · o.moving: 걷기 · o.t: 시각(초) · o.ch: 장
const mobArt = {};
function artImg(path) {
  if (!(path in mobArt)) { mobArt[path] = null; if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { mobArt[path] = im; }; im.src = path; } }
  return mobArt[path];
}
const artPath = (src, key) => (src === 's2' ? `art/s2/mob/${key}.webp` : src === 'chb' ? `art/s2/chb/${key}.webp` : `art/boss/${key}.png`);
export const chbImg = (ch) => artImg(`art/s2/chb/chb${ch}.webp`);   // v532 장 두목 그림(등장 컷에도)
export function preloadMobs(ch) { const R = ROSTER[ch - 1]; if (!R) return; for (const [, a] of [...R.mobs, R.elite, R.boss]) { const [src, key] = a.split(':'); if (src !== 'cr') artImg(artPath(src, key)); } }
// 짐승 그림 크기 맞춤(작은 것 · 큰 것)
const CR_SIZE = { crab: 0.8, crow: 0.75, eagle: 0.9, vbat: 0.85, bat: 0.85, scorpion: 0.85, bscorp: 0.9, pspider: 0.85, ispider: 0.9, isnake: 0.9, python: 1.1, bear: 1.15, panda: 1.1, sape: 1.1, ape: 1.0, gape: 1.0, cloud: 1.1, h3: 1.1 };
export function drawMob(cx, x, y, m, z, o = {}) {
  const t = o.t || 0, flip = !!o.flip, ch = o.ch || 1;
  const [, art] = mobLook(ch, m), [src, key] = art.split(':');
  const sc = (m.kind === 'elite' ? 1.25 : 1) * (o.scale || 1);
  const atk = o.atk || 0, hurt = o.hurt || 0, dir = flip ? -1 : 1;
  // 공격: 0~0.35 뒤로 젖힘(예비 동작) → 0.35~0.6 앞으로 내지름 → 돌아옴
  const wind = atk < 0.35 ? -Math.sin((atk / 0.35) * Math.PI / 2) * 0.5 : atk < 0.6 ? -0.5 + 1.5 * Math.sin(((atk - 0.35) / 0.25) * Math.PI / 2) : (1 - (atk - 0.6) / 0.4);
  const lunge = atk > 0 ? wind * 10 * sc : 0;
  const lean = (atk > 0 ? wind * 0.12 : 0) - hurt * 0.18;   // 앞으로 기울기(+) · 맞으면 뒤로(-)
  // v597 눌림 · 늘어남(발을 축으로) — 맞으면 납작, 칠 때는 움츠렸다가(예비) 내지르며 늘어난다
  const sqy = 1 - hurt * 0.09 + (atk > 0 ? (wind < 0 ? wind * 0.14 : wind * 0.05) : 0), sqx = 1 + hurt * 0.07 + (atk > 0 && wind < 0 ? -wind * 0.08 : 0);
  // 정예: 발밑 보랏빛 기운이 숨 쉬듯
  // v614 o.filt: 번쩍임 등 filter — 그림 몹은 filter를 구워 둔 판으로 그린다(그릴 때마다 filter를 걸지 않게). 짐승(선 그림)은 예전처럼 filter
  const filt = o.filt || '', im = src === 'cr' ? null : artImg(artPath(src, key)), fim = filt && im ? filtImg(im, filt) : null;
  if (filt && !fim && filtered(cx, filt, x, y, 170 * sc, 280 * sc, 40 * sc, (c) => drawMob(c, x, y, m, z, { ...o, filt: '' }))) return;   // 선 그림 짐승: 한 판에 그려 filter를 한 번만
  const setF = filt && !fim;
  if (setF) cx.filter = filt;
  if (m.kind === 'elite') { cx.save(); if (filt) cx.filter = filt; cx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 4); cx.fillStyle = '#a855f7'; cx.beginPath(); cx.ellipse(x, y, 34 * sc, 10 * sc, 0, 0, 7); cx.fill(); cx.restore(); }
  if (src === 'cr') {
    cx.save(); cx.translate(x + dir * lunge, y); cx.rotate(dir * lean * 0.6); cx.scale(sqx, sqy); cx.translate(-x, -y);
    drawCreature(cx, key, x, y, { t, moving: !!o.moving, flip, scale: 0.86 * (CR_SIZE[key] || 1) * sc });   // v506 사람 몹 옆에서 너무 작았다(0.62)
    cx.restore(); if (setF) cx.filter = 'none'; return;
  }
  const H0 = src === 'chb' ? (key === 'wb1' ? 230 : 165) : m.kind === 'boss' ? 118 : 100;   // v535 월드보스는 더 크게   // 화면 키(배율 1일 때) · v532 장 두목은 크게
  const h = H0 * sc;
  // 발밑 그림자
  cx.save(); if (fim && filt.includes('invert')) cx.filter = filt; cx.fillStyle = 'rgba(0,0,0,0.26)'; cx.beginPath(); cx.ellipse(x + dir * lunge * 0.5, y + 1, h * 0.2, h * 0.05, 0, 0, 7); cx.fill(); cx.restore();   // 검은 그림자는 밝히기 · 채도에도 그대로 검다(뒤집기만 다르다)
  if (!im) { drawFighter(cx, x, y, {}, { t, scale: sc, flip, run: !!o.moving }); if (setF) cx.filter = 'none'; return; }
  const w = h * im.width / im.height, pic = fim || im;
  const breathe = o.moving ? 0 : Math.sin(t * 2.3) * 0.018, bob = o.moving ? -Math.abs(Math.sin(t * 11)) * 3 * sc : 0;
  // 두목 그림은 앞을 보고 서 있어 뒤집지 않는다(옆으로 뒤집으면 칼 든 손이 바뀌어 어색) — 사람 몹 그림은 오른쪽을 본다
  const fl = src === 's2' || src === 'chb' ? flip : false;
  // v506 한 장 그림을 허리(위 46%)에서 둘로 — 아래(다리)는 걸음마다 앞뒤로 엇갈려 기울고, 위(몸통 · 무기)는 치거나 맞을 때 허리를 축으로 돈다
  const iw = im.width, ih = im.height, wy = 0.46, cut = ih * wy;
  const step = o.moving ? Math.sin(t * 11) : 0, legShear = step * 0.2, upRot = (atk > 0 ? wind * 0.32 : 0) - hurt * 0.22 + (!o.moving && !atk && !hurt ? Math.sin(t * 1.6) * 0.014 : 0);   // v597 서 있을 때 윗몸이 느리게 흔들림
  cx.save();
  cx.translate(x + dir * lunge, y + bob);
  cx.rotate(dir * lean * 0.5);
  cx.scale((fl ? -1 : 1) * sqx, (1 + breathe) * sqy);
  // 아래: 허리를 축으로 발이 앞뒤로 쓸린다(밀어 기울이기)
  cx.save(); cx.translate(0, -h * (1 - wy)); cx.transform(1, 0, legShear, 1, 0, 0);
  cx.drawImage(pic, 0, cut - 2, iw, ih - cut + 2, -w / 2, -2 * (h / ih), w, h * (1 - wy) + 2 * (h / ih));
  cx.restore();
  // 위: 허리를 축으로 돈다 · 걸을 때 반 박자씩 오르내림
  cx.save(); cx.translate(0, -h * (1 - wy) - Math.abs(step) * 1.5 * sc); cx.rotate((fl ? -1 : 1) * dir * upRot);
  cx.drawImage(pic, 0, 0, iw, cut + 3, -w / 2, -h * wy, w, h * wy + 3 * (h / ih));
  cx.restore();
  cx.restore();
  if (setF) cx.filter = 'none';
}
export const mobName = (m, z, ch = 1) => mobLook(ch, m)[0] || '';
export const mobHeight = (m, ch = 1) => { const [, a] = mobLook(ch, m); const src = a.split(':')[0]; return (src === 'cr' ? 66 * (CR_SIZE[a.split(':')[1]] || 1) : src === 'chb' ? 165 : m.kind === 'boss' ? 118 : 100) * (m.kind === 'elite' ? 1.25 : 1); };

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
// 발판 그림에서 「밟는 면」(풀 · 눈 · 돌 윗면)이 그림 위에서 몇 할 아래인지 — 열마다 처음 불투명한 줄의 65번째 백분위(대나무 · 풀포기처럼 솟은 것은 빼고)
function grassLine(im) {
  try {
    const W = 256, H = Math.max(8, Math.round((im.height / im.width) * W)), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, tops = [];
    for (let col = Math.round(W * 0.1); col < W * 0.9; col++) for (let row = 0; row < H; row++) if (d[(row * W + col) * 4 + 3] > 128) { tops.push(row / H); break; }
    tops.sort((a, b) => a - b); return tops.length ? tops[Math.floor(tops.length * 0.65)] : 0.1;
  } catch { return 0.1; }
}
// 발판 그림 아래쪽(바위 · 흙) 평균 빛깔 — 바닥 아래를 같은 흙으로 채운다
function earthColor(im) {
  try {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 32);
    const d = x.getImageData(0, 16, 64, 12).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n ? [r / n, g / n, b / n] : [70, 55, 40];
  } catch { return [70, 55, 40]; }
}
// 바닥(맨 아래 발판) 밑 흙 — 허공이 아니라 땅이 화면 아래까지 이어지게. 발판 그림을 어둡게 겹쳐 바위 결도 깐다
export function drawEarth(cx, W, y, Hb, ch, h) {
  const im = sideImg('ledge', ch), [r, g, b] = im?.earth || [70, 55, 40];
  const top = y + h * 0.25, col = (m, a = 1) => `rgba(${Math.round(r * m)},${Math.round(g * m)},${Math.round(b * m)},${a})`;
  // v614 그라디언트는 높이가 바뀔 때만 새로(카메라가 위아래로 움직이지 않으면 같은 것)
  const gk = `${top}|${Hb}|${r}|${g}|${b}`; if (earthGr.k !== gk) { const gr = cx.createLinearGradient(0, top, 0, Hb); gr.addColorStop(0, col(0.7)); gr.addColorStop(0.35, col(0.45)); gr.addColorStop(1, col(0.22)); earthGr.k = gk; earthGr.g = gr; }
  cx.fillStyle = earthGr.g; cx.fillRect(0, top, W, Hb - top);
  if (im) {   // 바위 결: 발판 그림 몸통을 어둡게 몇 줄 — v614 어둡게 한 판을 한 번만 구워 둔다(그릴 때마다 filter를 걸면 폰이 뜨거워진다)
    const dk = darkImg(im);
    cx.save(); cx.globalAlpha = 0.35; if (!dk) cx.filter = 'brightness(0.45)';
    const k = h / im.height, sy = im.height * Math.min(0.8, (im.surf ?? 0.1) + 0.25), sh = im.height * 0.35, tw = im.width * k, th = sh * k, src = dk || im;
    for (let yy = top + h * 0.35, row = 0; yy < Hb && row < 6; yy += th * 0.9, row++) for (let xx = -((row * tw) / 3) % tw; xx < W; xx += tw - 1) cx.drawImage(src, 0, sy, im.width, sh, xx, yy, tw, th);
    cx.restore();
  }
}
const earthGr = { k: '', g: null };
// 그림을 filter 한 번 걸어 구운 판(같은 그림 · 같은 filter면 다시 쓴다)
const filtCache = new WeakMap();
export function filtImg(im, f) {
  if (!im || typeof document === 'undefined') return null;
  let m = filtCache.get(im); if (!m) filtCache.set(im, (m = {}));
  if (f in m) return m[f];
  try {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d'); x.filter = f; x.drawImage(im, 0, 0);
    if (x.filter !== f) return (m[f] = null);   // filter를 모르는 브라우저 — 그때는 그리는 쪽이 filter를 건다
    return (m[f] = c);
  } catch { return (m[f] = null); }
}
const darkImg = (im) => filtImg(im, 'brightness(0.45)');
// v614 선으로 그리는 무인 · 짐승에 filter(번쩍임 · 잔상) — 선마다 filter를 거는 대신 작은 판에 그대로 그려 filter를 한 번만 건다.
//   (x, y) 둘레 좌우 rx · 위 up · 아래 down(지금 변환 기준)만큼의 판. 화면 밖이거나 판을 못 만들면 false(그리는 쪽이 예전처럼)
let scr = null, scx = null;
export function filtered(cx, filt, x, y, rx, up, down, fn) {
  if (typeof document === 'undefined' || cx.globalCompositeOperation !== 'source-over') return false;   // 겹쳐 그리기(source-over)는 결합 법칙이 서서 판에 먼저 그려도 같다 — 다른 섞기는 예전처럼
  const T = cx.getTransform(), cs = [[x - rx, y - up], [x + rx, y - up], [x - rx, y + down], [x + rx, y + down]].map(([u, v]) => [T.a * u + T.c * v + T.e, T.b * u + T.d * v + T.f]);
  const W = cx.canvas.width, H = cx.canvas.height;
  const x0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[0])))), x1 = Math.min(W, Math.ceil(Math.max(...cs.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...cs.map((p) => p[1])))), y1 = Math.min(H, Math.ceil(Math.max(...cs.map((p) => p[1]))));
  const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return true;   // 화면 밖 — 그릴 것 없음
  if (!scr) { scr = document.createElement('canvas'); scx = scr.getContext('2d'); if (!scx) return false; }
  if (scr.width < w || scr.height < h) { scr.width = Math.max(scr.width, w); scr.height = Math.max(scr.height, h); }
  scx.setTransform(1, 0, 0, 1, 0, 0); scx.globalCompositeOperation = 'source-over'; scx.filter = 'none'; scx.clearRect(0, 0, w, h);
  scx.globalAlpha = cx.globalAlpha;   // 흐림은 선마다(예전과 같게) — 판은 그대로 얹는다
  scx.setTransform(T.a, T.b, T.c, T.d, T.e - x0, T.f - y0);
  fn(scx);
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalAlpha = 1; cx.filter = filt; cx.drawImage(scr, 0, 0, w, h, x0, y0, w, h); cx.restore();
  return true;
}
function sideImg(kind, ch) {
  const key = `${kind}${ch}`;
  if (!(key in sideArt)) {
    sideArt[key] = null;
    if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { if (kind === 'ledge') { im.surf = grassLine(im); im.earth = earthColor(im); } sideArt[key] = im; }; im.src = `art/s2/${kind}/c${ch}.webp`; }
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
  const top = y - h * (im.surf ?? 0.1) - h * 0.03;   // 밟는 면이 발 높이(발이 풀에 살짝 묻히게)
  cx.drawImage(im, 0, 0, sw, im.height, x0, top, capW, h);
  cx.drawImage(im, im.width - sw, 0, sw, im.height, x1 - capW, top, capW, h);
  const midSrcX = im.width * 0.3, midSrcW = im.width * 0.4, midW = midSrcW * k;
  for (let x = x0 + capW; x < x1 - capW; x += midW - 1) {
    const w = Math.min(midW, x1 - capW - x);
    cx.drawImage(im, midSrcX, 0, midSrcW * (w / midW), im.height, x, top, w, h);
  }
}

// ── 무공 효과 그림(직업 × 모양) — art/s2/fx/{직업}_{모양}.webp · 검은 바탕이라 'lighter'로 빛만 더한다 ──
const fxArt = {};
export function fxImg(job, shape) {
  const key = `${job}_${shape}`;
  if (!(key in fxArt)) { fxArt[key] = null; if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { fxArt[key] = im; }; im.src = `art/s2/fx/${key}.webp`; } }
  return fxArt[key];
}

// ── 지금 게임 이펙트 다시 쓰기(v495) ── 궁극기(bfx · 검은 바탕) · 발밑 진(jfx 인장) · 컷인 배경(jfx cut) · 흰 이펙트(fx — 빛깔로 물들임)
const oldArt = {};
export function oldImg(path) {
  if (!(path in oldArt)) { oldArt[path] = null; if (typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { oldArt[path] = im; }; im.src = path; } }
  return oldArt[path];
}
export const ULT_ART = { sword: 'art/bfx/sword-rain.jpg', spear: 'art/bfx/fire-pillar.jpg', fist: 'art/bfx/palm-wave.jpg', bow: 'art/bfx/ice-burst.jpg', mage: 'art/bfx/thunder.jpg' };
export const SEAL_ART = { sword: 'art/jfx/seal-sword.png', spear: 'art/jfx/seal-ring.png', fist: 'art/jfx/seal-fist.png', bow: 'art/jfx/seal-fan.png', mage: 'art/fx/fx-field.png' };
export const CUT_ART = { sword: 'art/jfx/cut-sword.jpg', spear: 'art/jfx/cut-ring.jpg', fist: 'art/jfx/cut-fist.jpg', bow: 'art/jfx/cut-fan.jpg', mage: 'art/jfx/cut-poison.jpg' };
export const BUFF_ART = { fist: 'art/jfx/gold-bell.png' };
// 두목 패턴(v497) — 예고 땅 위 그림 · 터질 때 큰 그림(검은 바탕 → lighter)
export const BOSS_ART = {
  taiji: { tell: 'art/bfx/taiji.jpg', burst: 'art/bfx/taiji.jpg', col: '#a5b4fc' },
  petal: { tell: 'art/jfx/plum-petal.png', burst: 'art/bfx/petal-storm.jpg', col: '#f9a8d4' },
  eye: { tell: 'art/jfx/blood-eye.png', burst: 'art/bfx/blood-burst.jpg', col: '#f87171' },
  orb: { tell: 'art/jfx/soul-orb.png', burst: 'art/bfx/dark-orb.jpg', col: '#c084fc' },
};
// 흰 이펙트를 빛깔로 물들인 판(빛깔마다 한 번만 굽는다)
const tinted = {};
export function tintImg(path, col) {
  const key = `${path}|${col}`;
  if (tinted[key]) return tinted[key];
  const im = oldImg(path);
  if (!im || typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(im, 0, 0);
  return (tinted[key] = c);
}
