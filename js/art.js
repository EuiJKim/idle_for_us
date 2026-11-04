// 그림 조각을 쓸 수 있으면 쓰고, 없으면 지금 그대로 벡터로 그린다.
//
// 우리 뼈대(battle.js drawFighter)는 이미 머리·몸통·팔·무기를 따로 그리고
// 각자 회전시킨다. 그래서 조각 그림만 있으면 그 자리에 그대로 얹을 수 있다.
// 뼈대 치수: 발끝 y=0, 머리 꼭대기 y=-99, 몸통 폭 24, 머리 지름 22.
//
// 파일은 art/hero/ 에 둔다. **저장소에 같이 올린다** — GitHub Pages로
// 서빙하므로 커밋해야 화면에 뜬다. (한때 .gitignore에 있었는데 2026-10-20에 뺐다)
// 없으면 조용히 벡터로 간다 — 그림이 없다고 게임이 안 돌면 안 된다.
//
// **읽는 파일은 아래 FILES 열아홉 장으로 고정이다.**
// 다른 이름으로 아무리 많이 그려 넣어도 화면은 1픽셀도 안 바뀐다.
// 조각을 늘리려면 HEADS·BODIES·WEAPONS를 먼저 늘리고 그 키로 저장해야 한다.
//
// **외형 키는 이미 있는 것을 그대로 쓴다.** look.head(머리 모양) ·
// look.robe(옷 색) · look.weapon(무기 종류). 몬스터 60종이 이 셋으로
// 서로 다르게 생겼으므로, 그림도 같은 키로 갈라야 그 다양함이 유지된다.

// 머리 — look.head 값 그대로. mask·jiangshi는 그림이 마땅치 않아 벡터로 둔다.
const HEADS = ['band', 'topknot', 'hat', 'hood', 'bald'];
// 무기 — look.weapon 값 그대로. fan은 그림이 마땅치 않아 벡터로 둔다.
const WEAPONS = ['sword', 'saber', 'spear', 'axe', 'claw', 'dagger', 'fist'];
// 몸통 — 옷 색에 가장 가까운 것을 고른다
const BODIES = {
  dark: [0x3f, 0x3a, 0x36],
  white: [0xf1, 0xe8, 0xd6],
  red: [0x8b, 0x1f, 0x22],
  blue: [0x32, 0x48, 0x6b],
  brown: [0x6b, 0x56, 0x40],
  black: [0x14, 0x12, 0x10],
};

// 경지 전용 도포. 열 단계 중 초절정·화경·천인합일이 전부 흰색이라
// 옷 색으로만 고르면 셋이 똑같이 보인다. 색이 정확히 맞으면 전용 옷을 쓴다.
// (RANKS[i].look.robe 값과 같아야 한다 — data.js를 고치면 여기도 고친다)
const RANK_ROBES = {
  '#6b5640': 'body-r0', '#344563': 'body-r1', '#1f5f8b': 'body-r2',
  '#1c1917': 'body-r3', '#f5f0e6': 'body-r4', '#f8f4ea': 'body-r5',
  '#4c1d5f': 'body-r6', '#0b0b0d': 'body-r7', '#134e4a': 'body-r8',
  '#fffbeb': 'body-r9',
};

const FILES = [
  ...HEADS.map((h) => `head-${h}`), 'head',
  ...Object.keys(BODIES).map((b) => `body-${b}`),
  ...new Set(Object.values(RANK_ROBES)),
  ...WEAPONS.map((w) => `wp-${w}`),
  // 의복 — 도포 여섯, 검 장식 여섯
  'body-o0', 'body-o1', 'body-o2', 'body-o3', 'body-o4', 'body-o5',
  'wp-s0', 'wp-s1', 'wp-s2', 'wp-s3', 'wp-s4', 'wp-s5',
];

// 그림을 어디에 얼마만큼 그릴지. 뼈대 좌표계 그대로다.
// w는 폭(높이는 그림 비율대로), (x, y)는 **그림의 가운데 아래**가 놓일 자리.
// 처음엔 몸통 46·검 11로 넣었는데 화면에서 재 보니 사람이 뚱뚱하고 검이 몸만 했다.
// 도포 열여섯 장이 전부 92x116으로 구워져 있다(높이를 맞춰 어깨선을 한 줄에
// 세운다). 그래서 아래 숫자 하나가 열여섯 장 전부에 같이 맞는다.
// 폭만 맞춰 굽던 때는 높이가 98~131이라 어깨가 제각각이었고, 머리를 고정
// 좌표(-72)에 두니 **20px 떠 있었다.** 그게 '몸이 깨졌다'의 정체다.
export const BODY_W = 50;                    // 그려지는 높이는 50 x 116/92 = 63
export const BODY_TOP = -4 - BODY_W * 116 / 92;   // 어깨선 (= -67)
export const FIT = {
  body: { w: BODY_W, x: 0, y: -4 },          // 아랫자락이 발목을 덮는다
  head: { w: 25, x: 1, y: BODY_TOP + 4 },    // 턱을 옷깃 안으로 4px 넣는다
  weapon: { w: 13, x: 0, y: 2 },             // 손 기준(앞팔 회전 안에서 그린다)
};
// 그림 몸통의 어깨 — 소매가 이미 그려져 있어 벡터 뼈대(-70)와 자리가 다르다
export const ART_SHOULDER = { x: 9, y: BODY_TOP + 9 };
// 머리끈 꼬리가 나오는 자리. 벡터 머리는 -90이었는데 그림 머리는 -63에서
// 시작해 21px이라 -90이면 **정수리 위 허공**에서 끈이 뻗어 나왔다.
export const ART_BAND = { x: -5, y: BODY_TOP + 4 - 14 };

import { ART2_HEADS, ART2_WEAPONS, ART2_SPRITES } from './art2.js';
import { HEAD_ANCHOR } from './headanchor.js';
const img = {};
let ready = false;
let tried = false;

// ---------- v323 조각 기준점 — 그림마다 '어디를 잡고 어디에 놓나'를 적어 둔다(치수는 scripts로 잰 값) ----------
// 머리: crop — 턱 아래(목·옷깃)를 잘라 낸다(그러면 모든 머리의 맨 아래가 턱) · brow — 삿갓을 얹는 눈썹 선(위에서) · eye — 안대 선(아래에서)
export const HEAD_FIT = {
  'head': { crop: 0.88, brow: 0.36, eye: 0.46, eyeX: 0.72 },
  'head-topknot': { crop: 0.93, brow: 0.44, eye: 0.44 },
  'head-band': { crop: 0.95, brow: 0.46, eye: 0.5 },
  'head-hat': { crop: 1, brow: 0.5, eye: 0.4 },
  'head-hood': { crop: 1, brow: 0.3, eye: 0.52 },
  'head-bald': { crop: 0.72, brow: 0.3, eye: 0.44 },
};
// 무기: grip — 손이 잡는 자리(위에서 몇 %) · h — 뼈대 px로 그려지는 높이 · flip — 날이 아래를 향해 그려진 그림(창·도끼)은 뒤집는다
// 전엔 모두 폭 13으로 그려 도가 검의 두 배였고(그림이 두 배로 길다) 손잡이 기준이 없어 그림 바닥을 손에 댔다
export const WEAPON_FIT = {
  'wp-sword': { grip: 0.82, h: 48 }, 'wp-saber': { grip: 0.8, h: 54 }, 'wp-dagger': { grip: 0.68, h: 30 },
  'wp-spear': { grip: 0.6, h: 84, flip: true }, 'wp-axe': { grip: 0.62, h: 46, flip: true }, 'wp-claw': { grip: 0.7, h: 36 },
  'wp-fist': { grip: 0.5, h: 19, cropTop: 0.42, bare: true },   // 위에 그려진 칼날은 잘라 낸다 — 권갑만
  'wp-s0': { grip: 0.8, h: 50 }, 'wp-s1': { grip: 0.7, h: 50 }, 'wp-s2': { grip: 0.8, h: 50 }, 'wp-s3': { grip: 0.62, h: 50 }, 'wp-s4': { grip: 0.8, h: 50 }, 'wp-s5': { grip: 0.88, h: 50 },
};
// 쓰개 덧씌우기 — 삿갓 그림의 위 절반(챙까지)을 떼어 어느 머리에나 얹는다
export const HAT_FIT = { 'hat-straw': { from: 'head-hat', rows: 0.52, w: 29 } };

function cropped(im, y0f, y1f) {
  if (typeof document === 'undefined') return im;
  const y0 = Math.round(im.height * y0f), y1 = Math.round(im.height * y1f);
  const c = document.createElement('canvas');
  c.width = im.width; c.height = Math.max(1, y1 - y0);
  c.getContext('2d').drawImage(im, 0, -y0);
  return c;
}
// 다 받은 뒤 한 번 — 머리는 턱까지, 권갑은 칼날 아래부터, 삿갓 덧씌우기를 만든다
function prepareArt() {
  for (const [k, f] of Object.entries(HEAD_FIT)) if (img[k] && f.crop < 1) img[k] = cropped(img[k], 0, f.crop);
  for (const [k, f] of Object.entries(WEAPON_FIT)) if (img[k] && f.cropTop) img[k] = cropped(img[k], f.cropTop, 1);
  for (const [k, f] of Object.entries(HAT_FIT)) if (img[f.from]) img[k] = cropped(img[f.from], 0, f.rows);
}
// 도포 그림의 빛깔 — 팔·다리를 같은 빛깔로 그리려고 도포 몸판에서 중간값을 잰다(그림마다 한 번)
const colCache = new Map();
export function bodyColors(key, tint) {
  const ck = `${key}|${tint || ''}`;
  if (colCache.has(ck)) return colCache.get(ck);
  let main = null;
  const im = img[key];
  if (im && typeof document === 'undefined') main = null;
  else if (im) {
    try {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0);
      // 허리띠 아래 도포 몸판(소매 가장자리·금 테두리·깃을 피해) — 중간값이라 안감 줄무늬 하나쯤은 걸러진다
      const d = x.getImageData(Math.round(im.width * 0.25), Math.round(im.height * 0.56), Math.round(im.width * 0.5), Math.round(im.height * 0.1)).data;
      const rs = [], gs = [], bs = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
      if (rs.length > 20) { const md = (a) => a.sort((p, q) => p - q)[a.length >> 1]; main = [md(rs), md(gs), md(bs)]; }
    } catch { main = null; }
  }
  if (!main) main = [107, 86, 64];
  if (tint) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(tint);
    if (m) { const t = [1, 2, 3].map((i) => parseInt(m[i], 16)); main = main.map((v, i) => Math.round(v * t[i] / 255)); }
  }
  const hex = (v) => `#${v.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`;
  const out = { main: hex(main), dark: hex(main.map((v) => v * 0.62)), light: hex(main.map((v) => v + (255 - v) * 0.22)) };
  colCache.set(ck, out);
  return out;
}

export function artReady() { return ready; }

// 옷 색에 가장 가까운 몸통. 색 차이는 그냥 제곱합으로 잰다 — 여섯 중 고르는 일이라 충분하다.
const bodyCache = new Map();
function bodyFor(robe) {
  if (!robe) return 'body-dark';
  let hit = bodyCache.get(robe);
  if (hit) return hit;
  // 경지 옷이 먼저다 — 색이 정확히 같으면 그 단계 전용 도포
  const rk = RANK_ROBES[String(robe).toLowerCase()];
  if (rk) { bodyCache.set(robe, rk); return rk; }
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(robe);
  if (!m) return 'body-dark';
  const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
  let best = 'body-dark';
  let bd = Infinity;
  for (const [k, v] of Object.entries(BODIES)) {
    const d = (c[0] - v[0]) ** 2 + (c[1] - v[1]) ** 2 + (c[2] - v[2]) ** 2;
    if (d < bd) { bd = d; best = `body-${k}`; }
  }
  hit = best;
  bodyCache.set(robe, hit);
  return hit;
}

// v325 꾸미기 그림(sunburst) — art/hero2/. 기본 조각이 다 온 뒤 천천히 받는다. 없으면 그 칸만 옛 모양(벡터)으로 간다.
//   머리는 HEAD_FIT에 fit(놓을 자리 w·x·y)까지 · 무기는 WEAPON_FIT에 손잡이·길이
let tried2 = false;
export function loadArt2(onEach) {
  if (tried2 || typeof Image === 'undefined') return;
  tried2 = true;
  const one = (n, then) => { const im = new Image(); im.onload = () => { img[n] = n.startsWith('fh-') ? fadeBottom(im, 0.86) : im; then?.(); onEach?.(n); }; im.src = `art/hero2/${n}.png`; };
  for (const [n, f] of Object.entries(ART2_HEADS)) one(n, () => { HEAD_FIT[n] = { crop: 1, brow: f.brow, eye: f.eye, eyeX: f.eyeX, fit: { w: f.w, x: f.x, y: f.y } }; });
  for (const [n, f] of Object.entries(ART2_WEAPONS)) one(n, () => { WEAPON_FIT[n] = { ...f }; });
  for (const n of ART2_SPRITES) one(n);
}
// v327 여협 머리 그림 맨 아래(목·늘어진 머리카락)는 네모로 잘려 있었다 — 아래 14%를 투명하게 흐려 끝을 부드럽게
function fadeBottom(im, from) {
  if (typeof document === 'undefined') return im;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  const gr = g.createLinearGradient(0, im.height * from, 0, im.height);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = gr; g.fillRect(0, im.height * from - 1, im.width, im.height * (1 - from) + 2);
  return c;
}
// v327 머리 그림에서 잰 자리(눈·눈썹·정수리·턱·얼굴 좌우·뒤통수)를 그려지는 좌표로 — 덧그림을 '그 얼굴'에 맞춘다
export function headGeom(hk, HF) {
  const im = img[hk], a = HEAD_ANCHOR[hk];
  if (!im || !a) return null;
  const w = HF.w, h = (im.height * w) / im.width, x0 = HF.x - w / 2, y0 = HF.y - h;
  const X = (f) => x0 + w * f, Y = (f) => y0 + h * f;
  return { x0, y0, w, h, a, eyeX: X(a.eyeX), eyeY: Y(a.eyeY), browY: Y(a.browY), topY: Y(a.topY), jawY: Y(a.jawY),
    faceL: X(a.faceL), faceR: X(a.faceR), backX: X(a.backX), browL: X(a.browL), browR: X(a.browR), faceW: w * (a.faceR - a.faceL) };
}
// 머리 그림 모양대로 오린 덧그림(안대 띠·외눈 끈·칼자국) — 그림 크기 캔버스에 그리고 머리 밖은 지운다. 한 번 만들어 둔다
const maskCache = new Map();
export function headMasked(hk, tag, draw) {
  const id = hk + '|' + tag;
  if (maskCache.has(id)) return maskCache.get(id);
  const im = img[hk], a = HEAD_ANCHOR[hk];
  if (!im || !a || typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
  const c = cv.getContext('2d');
  draw(c, im.width, im.height, a);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(im, 0, 0);
  maskCache.set(id, cv);
  return cv;
}
// v327 삿갓 자리 — 챙이 눈썹 선에, 폭은 그 머리(머리카락 포함) 눈썹 줄 폭보다 넉넉히
export function hatRect(hatKey, headKey, headFit) {
  const im = img[hatKey], hf = HAT_FIT[hatKey], hd = HEAD_FIT[headKey] || HEAD_FIT.head;
  if (!im || !hf) return null;
  headFit = hd.fit || headFit;
  const g = headGeom(headKey, headFit);
  if (g) {
    const w = Math.max(hf.w, (g.browR - g.browL) * 1.16), h = (im.height * w) / im.width;
    const brim = g.browY + g.faceW * 0.04;
    return { x: (g.browL + g.browR) / 2 + g.faceW * 0.04 - w / 2, y: brim - h * 0.92, w, h, brim };
  }
  const hh = artHeight(headKey, headFit);
  const browY = headFit.y - hh + hh * hd.brow;
  const w = hf.w, h = (im.height * w) / im.width;
  return { x: headFit.x - w / 2 - 1, y: browY - h * 0.92, w, h, brim: browY };
}
export function artImg(key) { return img[key] || null; }
// v325 캔버스로 그린 조각(여협 머리)을 그림 조각처럼 쓴다 — putArt·artHeight·HEAD_FIT이 그대로 통한다
export function registerArt(key, canvas, fit) { img[key] = canvas; if (fit) HEAD_FIT[key] = fit; }
export function headKey(look) {
  if (look?.fhead && img[look.fhead]) return look.fhead;   // v325 여협 머리
  const h = look?.head;
  if (h === 'mask') return 'head-hood';   // v323 복면 — 전엔 벡터 머리가 그림 몸 위에 떠 있었다. 두건 그림(입을 가린 복면)으로
  return HEADS.includes(h) ? `head-${h}` : 'head';
}
// 의복을 입으면 경지 도포 대신 그 옷을 입는다.
// s.outfit 주석에 '지금 입은 것 (겉모습만)'이라고 적혀 있었는데 **읽는 쪽이 없었다** —
// 옷을 사도 모습이 안 바뀌었다. 장판·번개와 같은 경우다.
export const OUTFIT_BODY = ['body-o0', 'body-o1', 'body-o2', 'body-o3', 'body-o4', 'body-o5'];
export const OUTFIT_WEAPON = ['wp-s0', 'wp-s1', 'wp-s2', 'wp-s3', 'wp-s4', 'wp-s5'];

export function bodyKey(look) {
  if (look?.outfitBody != null && OUTFIT_BODY[look.outfitBody]) return OUTFIT_BODY[look.outfitBody];
  return bodyFor(look?.robe);
}
export function weaponKey(w, look) {
  // v325 무기 모양(꾸미기) — 그림이면 그 조각, 그려 넣는 모양이면 null(drawWeapon이 o.wskin을 본다)
  if (look?.wskin) return look.wskin.art && img[look.wskin.art] ? look.wskin.art : null;
  if (look?.outfitWeapon != null && OUTFIT_WEAPON[look.outfitWeapon]) return OUTFIT_WEAPON[look.outfitWeapon];
  // v121 권갑 그림은 주먹 위로 붉은 칼날이 솟아 칼을 든 것처럼 보였다 → v323 칼날을 잘라 낸 권갑 그림을 쓴다(WEAPON_FIT.cropTop)
  return WEAPONS.includes(w) ? `wp-${w}` : null;
}

// 한 장이라도 없으면 전부 벡터로 간다 — 머리만 그림이고 몸은 벡터면 더 이상해 보인다.
export function loadArt(onDone) {
  if (tried) return;
  tried = true;
  let left = FILES.length;
  let bad = false;
  for (const n of FILES) {
    const im = new Image();
    im.onload = () => { img[n] = im; if (--left === 0 && !bad) { prepareArt(); ready = true; loadArt2(); onDone?.(); } };
    im.onerror = () => { bad = true; left--; };
    im.src = `art/hero/${n}.png`;
  }
}

// 그림의 실루엣을 한 빛깔로 칠한 판 — 옷 등급 테두리(v115)에 쓴다. 그림·빛깔마다 한 번만 만든다.
const sil = {};
function silhouette(key, color) {
  const im = img[key];
  if (!im || typeof document === 'undefined') return null;
  const ck = `${key}|${color}`;
  if (!sil[ck]) {
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    sil[ck] = c;
  }
  return sil[ck];
}
// 테두리: 실루엣을 여덟 쪽으로 w만큼 밀어 깔면 그림 둘레에 빛깔 테가 남는다(그림은 그 위에 그린다)
export function putArtEdge(ctx, key, fit, color, w, alpha = 1) {
  const c = silhouette(key, color);
  if (!c) return false;
  const h = (c.height * fit.w) / c.width;
  const x0 = fit.x - fit.w / 2, y0 = fit.y - h;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.drawImage(c, x0 + Math.cos(a) * w, y0 + Math.sin(a) * w, fit.w, h);
  }
  ctx.restore();
  return true;
}
// 물들이기: 그림 위에 같은 실루엣을 옅게 한 번 더 — 도포 전체가 등급 빛깔을 머금는다
// mode 'multiply'면 빛깔을 곱한다 — 흰 도포가 그 빛깔 도포가 되고 주름·그늘은 그대로 남는다
export function putArtTint(ctx, key, fit, color, alpha, mode) {
  const c = silhouette(key, color);
  if (!c) return false;
  const h = (c.height * fit.w) / c.width;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (mode) ctx.globalCompositeOperation = mode;
  ctx.drawImage(c, fit.x - fit.w / 2, fit.y - h, fit.w, h);
  ctx.restore();
  return true;
}

// 그림 한 장을 '가운데 아래' 기준으로 놓는다
// v280 머리띠 색 — 상투 그림의 붉은 띠만 골라 다른 색으로 칠한 사본(색마다 한 번 굽는다)
const bandCache = new Map();
function bandTinted(key, col) {
  const id = `${key}|${col}`;
  if (bandCache.has(id)) return bandCache.get(id);
  const im = img[key];
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col || '');
  if (!im || !m || typeof document === 'undefined') return null;
  const tc = [1, 2, 3].map((i) => parseInt(m[i], 16));
  let out = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = im.width; cv.height = im.height;
    const c = cv.getContext('2d');
    c.drawImage(im, 0, 0);
    const d = c.getImageData(0, 0, cv.width, cv.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], g = p[i + 1], b = p[i + 2];
      if (p[i + 3] < 8 || r < 70 || r < g * 1.7 || r < b * 1.7) continue;
      const k = Math.min(1.25, r / 190);   // 띠의 밝고 어두움은 그대로
      p[i] = Math.min(255, tc[0] * k); p[i + 1] = Math.min(255, tc[1] * k); p[i + 2] = Math.min(255, tc[2] * k);
    }
    c.putImageData(d, 0, 0);
    out = cv;
  } catch { out = null; }
  bandCache.set(id, out);
  return out;
}
export function putArtBand(ctx, key, fit, col) {
  const im = bandTinted(key, col);
  if (!im) return putArt(ctx, key, fit);
  const h = (im.height * fit.w) / im.width;
  ctx.drawImage(im, fit.x - fit.w / 2, fit.y - h, fit.w, h);
  return true;
}
// v306 그림의 그려지는 높이(fit 너비 기준) — 안대처럼 그림 위에 덧그릴 때 자리를 잡는다
export function artHeight(key, fit) { const im = img[key]; return im ? (im.height * fit.w) / im.width : 0; }
// v306 그 색 그대로 그린 도포 그림이 있나(여섯 빛깔 · 경지 도포) — 있으면 흰 도포에 색을 곱하지 않고 그 그림을 쓴다(명암·띠가 산다)
export function hasBodyArt(color) {
  const c = String(color || '').toLowerCase();
  if (RANK_ROBES[c]) return true;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(c);
  if (!m) return false;
  const v = [1, 2, 3].map((i) => parseInt(m[i], 16));
  return Object.values(BODIES).some((b) => b[0] === v[0] && b[1] === v[1] && b[2] === v[2]);
}
// v323 무기를 손에 쥔다 — 손이 (0,0), 날은 -y. 그림마다 손잡이 자리(grip)와 길이(h)로
export function putWeapon(ctx, key) {
  const im = img[key], f = WEAPON_FIT[key];
  if (!im || !f) return false;
  const w = (im.width * f.h) / im.height;
  ctx.save();
  if (f.flip) ctx.rotate(Math.PI);
  // 손잡이가 (0,0)에 오게 — 그림의 grip 지점(위에서 h*grip)을 원점에
  ctx.drawImage(im, -w / 2, -f.h * (f.flip ? 1 - f.grip : f.grip), w, f.h);
  ctx.restore();
  return true;
}
export function hasArt(key) { return !!img[key]; }
export function weaponBare(key) { return !!WEAPON_FIT[key]?.bare; }
// v323 쓰개 덧씌우기 — 머리 그림의 눈썹 선에 챙이 오게
export function putHat(ctx, hatKey, headKey, headFit) {
  const r = hatRect(hatKey, headKey, headFit);
  if (!r) return false;
  ctx.drawImage(img[hatKey], r.x, r.y, r.w, r.h);
  return true;
}
export function putArt(ctx, key, fit) {
  const im = img[key];
  if (!im) return false;
  const h = (im.height * fit.w) / im.width;
  ctx.drawImage(im, fit.x - fit.w / 2, fit.y - h, fit.w, h);
  return true;
}
