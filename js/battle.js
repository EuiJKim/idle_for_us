// 전투 화면 캔버스 렌더러 (수묵화 무협풍). 게임 이벤트를 받아 연출만 담당한다.
import { drawObstacle, drawLowObstacle } from './obstacles.js';
import { zoneOf, RANKS, GRADES, FIELD_SQUASH, JOB_TRAITS, QI, jobOf, critTierName } from './data.js';
import { artReady, putArt, putArtEdge, putArtTint, loadArt, FIT, ART_SHOULDER, ART_BAND, headKey, bodyKey, weaponKey } from './art.js';
import { drawCreature, saddleY, mountTilt, mountGait } from './creatures.js';
import { ZONES_W, itemZone } from './world/wdata.js';
import { setOf } from './world/wgear.js';
import { tellCovers } from './world/wdgn.js';
import { envOf } from './world/wland.js';
import { OUTFITS } from './data.js';

// 의복 열둘 중 앞 여섯은 도포(몸), 뒤 여섯은 검 장식(무기)이다.
function outfitLook(id) {
  if (!id) return {};
  const i = OUTFITS.findIndex((o) => o.id === id);
  if (i < 0) return {};
  return i < 6 ? { outfitBody: i } : { outfitWeapon: i - 6 };
}
import { fxReady, putFx, loadFx, zoneTile } from './fx.js';
import { loadJobArt } from './jobart.js';
import { PoseAnim } from './pose.js';
import { CHOREO, Director, FX, VENOM, drawPoisonField } from './skillfx.js';
import { drawBossSprite, drawTellFx, fxFor, bossImg, bossHeight } from './bossfx.js';
import { big } from './big.js';
import { fmt } from './fmt.js';

export const BRUSH = '"Yuji Syuku", "Nanum Brush Script", "Gowun Batang", serif';
const HP_BAR_RANGE = 230;   // 이 거리 안의 적만 체력바를 보여준다

// ---------- 깊이 ----------
// 위에서 내려다보는 직교 투영이라 원근이 없다. 멀리 있는 적도 가까운 적과
// 똑같이 선명해서 화면이 종이처럼 평평하게 읽혔다.
// 무인과의 거리로 흐림을 줘서 깊이를 만든다 — 배경이 어두우니 투명도만
// 낮춰도 '안개에 묻힌' 느낌이 난다. 비용은 globalAlpha 한 줄이다.
const DEPTH_NEAR = 70;     // 이 안쪽은 또렷하게
const DEPTH_FAR = 380;     // 이 바깥은 가장 흐리게
const DEPTH_MIN = 0.3;     // 가장 흐릴 때의 진하기
function depthOf(dist) {
  const k = Math.min(1, Math.max(0, (dist - DEPTH_NEAR) / (DEPTH_FAR - DEPTH_NEAR)));
  return 1 - (1 - DEPTH_MIN) * k * k;   // 가까운 쪽은 덜 깎고 먼 쪽을 많이 깎는다
}

// ---------- 멀리서 쏘는 평타 ----------
// 환마는 부채 바람, 독마는 독 덩이, 극악소마는 지풍. 무공이 아니라 평타라
// 아주 잦다 — 그림은 가볍게(선 몇 개) 둔다.
const SHOT = {
  fan: { kind: 'gust', life: 0.2, pose: ['펼치기', '휘두르기'] },
  poison: { kind: 'glob', life: 0.24, pose: ['투척준비', '투척'] },
  ring: { kind: 'finger', life: 0.09, pose: ['지법겨눔', '손가락튕김'] },
};
// 붙어서 치는 평타의 연타. 한 대마다 다음 자세로 넘어간다 — 같은 동작만 되풀이하면
// 서서 움찔하는 걸로만 보였다. [닿는 자세, 휘두르는 궤적의 기울기(라디안), 휘두르는 방향(+1 위→아래)]
const MELEE_COMBO = {
  sword: [['일섬', -0.1, 1], ['내려베기', 0.7, 1], ['찌르기', 0, 0]],
  fist: [['정권', 0, 0], ['훅', -0.4, -1], ['올려치기', -1.1, -1]],
  ring: [['지법겨눔', 0, 0]],
};
// 치명 단계별 숫자 빛깔 (0 보통 · 1 치명 · 2 슈퍼 · 3 하이퍼 · 4+)
const CRIT_COL = ['#ffffff', '#ef4444', '#fb923c', '#c084fc', '#facc15'];
// 맞은 자국 빛깔 (없으면 흰 칼자국)
const CUT_COL = { ring: '216,180,254', fan: '186,230,253' };
const SHOT_DRAW = {
  // 독 덩이 — 포물선으로 날아가며 방울을 흘린다
  glob(ctx, p, k, tx, ty) {
    const v = VENOM[Math.min(3, p.tier || 0)];
    const x = p.x + (tx - p.x) * k;
    const y = p.y + (ty - p.y) * k - Math.sin(k * Math.PI) * 46;
    for (let i = 1; i <= 3; i++) {
      const q = Math.max(0, k - i * 0.07);
      const x2 = p.x + (tx - p.x) * q;
      const y2 = p.y + (ty - p.y) * q - Math.sin(q * Math.PI) * 46 + i * 2;
      ctx.fillStyle = `rgba(${v.glow},${0.5 - i * 0.12})`;
      circle(ctx, x2, y2, 4.5 - i);
    }
    ctx.fillStyle = `rgb(${v.dark})`;
    circle(ctx, x, y, 7);
    ctx.fillStyle = `rgb(${v.glow})`;
    circle(ctx, x - 0.5, y - 0.5, 5.5);
    ctx.fillStyle = `rgba(${v.core},0.95)`;
    circle(ctx, x - 2, y - 2, 2.2);
  },
  // 부채 바람 — 돌면서 날아가는 초승달 둘
  gust(ctx, p, k, tx, ty) {
    const x = p.x + (tx - p.x) * k;
    const y = p.y + (ty - p.y) * k;
    const a = Math.atan2(ty - p.y, tx - p.x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = `rgba(${i ? '125,211,252' : '224,242,254'},${0.85 - k * 0.4})`;
      ctx.lineWidth = i ? 5 : 2.5;
      ctx.beginPath(); ctx.arc(-10 - i * 9, 0, 16 + i * 4, -1.1, 1.1); ctx.stroke();
    }
    ctx.restore();
  },
  // 지풍 — 손끝에서 곧게 뻗는 보랏빛 한 줄. 아주 빠르다.
  finger(ctx, p, k, tx, ty) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const head = Math.min(1, k * 1.6);
    const tail = Math.max(0, k * 1.6 - 0.6);
    const hx = p.x + (tx - p.x) * head, hy = p.y + (ty - p.y) * head;
    const bx = p.x + (tx - p.x) * tail, by = p.y + (ty - p.y) * tail;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(168,85,247,0.45)';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.strokeStyle = 'rgba(243,232,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(hx, hy); ctx.stroke();
    if (head >= 1) {
      ctx.strokeStyle = `rgba(216,180,254,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(tx, ty, 8 + k * 14, (8 + k * 14) * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  },
};

// ---------- 졸개 스프라이트 캐시 ----------
// 졸개 하나를 벡터로 그리는 데 54us가 들었다. 화면에 70마리면 그것만 3.7ms다
// (375x812 / dpr 2에서 잰 값). 폰은 여기서 서너 배 더 느리다.
// 생김새는 몇 종류뿐이고 매 프레임 달라지는 건 걸음 위상뿐이라,
// 위상을 여섯 칸으로 끊어 미리 구워 두고 붙인다.
// cycle은 몸이 흔들리는 주기(sin(t*4) -> 2PI/4)에 맞춘다. 맞춰 놔야
// 한 바퀴가 이어 붙고, 돌 때마다 툭 끊기지 않는다.
// 무인 뒤에 까는 빛. 한 번만 굽는다.
let heroHaloImg = null;
function heroHalo() {
  if (heroHaloImg) return heroHaloImg;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g2 = x.createRadialGradient(S / 2, S / 2, S * 0.03, S / 2, S / 2, S / 2);
  g2.addColorStop(0, 'rgba(253,224,71,0.3)');
  g2.addColorStop(0.45, 'rgba(253,224,71,0.1)');
  g2.addColorStop(1, 'rgba(253,224,71,0)');
  x.fillStyle = g2;
  x.fillRect(0, 0, S, S);
  heroHaloImg = c;
  return c;
}

// 빛 한 덩이를 미리 구워 둔다. 색마다 한 장이면 충분하다.
const sparkCache = new Map();
function sparkImage(color) {
  let c = sparkCache.get(color);
  if (c) return c;
  const S = 64;
  c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  const g2 = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g2.addColorStop(0, hexA(color, 0.85));
  g2.addColorStop(0.5, hexA(color, 0.28));
  g2.addColorStop(1, hexA(color, 0));
  x.fillStyle = g2;
  x.fillRect(0, 0, S, S);
  sparkCache.set(color, c);
  return c;
}

// max는 **한 구역이 쓰는 칸 수보다 넉넉해야 한다.** 한 구역에 졸개 4종 + 두목 1종이고
// 한 인물이 8위상을 쓰므로 40칸이다. 전에는 상한이 48이라 구역이 바뀌는 10관문마다
// 80칸이 필요해져 통째로 비우고 48장을 다시 구웠다 — 그때마다 화면이 한 번 걸렸다.
// 두 구역이 같이 들어가고도 남게 둔다.
const LIGHT_MOBS = 26;   // 가벼운 모드에서 그리는 적의 최대 수
const PIXEL_BUDGET = 1.2e6;   // v181: 한 프레임에 칠하는 캔버스 화소 상한 (390x844 화면이면 1.9배까지)
const SPR = { w: 80, h: 160, ox: 44, oy: 146, phases: 8, cycle: Math.PI / 2, max: 192 };
const sprCache = new Map();
// 그림이 늦게 도착하면 벡터로 구워 둔 것을 버려야 한다
loadArt(() => sprCache.clear());
loadFx(() => {});
loadJobArt();
// 바닥 소품 그림 (v136, art/prop/) — 지역의 prop마다 한 장. 오면 바닥 장을 다시 굽는다(decalGen).
const PROP_KINDS = ['bamboo', 'dock', 'temple', 'lantern', 'cliff', 'vine', 'tomb', 'shore', 'void', 'grave', 'banner', 'pavilion', 'village', 'rock', 'snowpine', 'dune'];
export const PROP_FILES = PROP_KINDS.map((k) => `art/prop/${k}.png`);
const decal = {};
let decalGen = 0;
function decalImg(kind) {
  if (decal[kind] !== undefined || !PROP_KINDS.includes(kind)) return decal[kind] || null;
  decal[kind] = null;
  const im = new Image();
  im.onload = () => { decal[kind] = im; decalGen++; };
  im.src = `art/prop/${kind}.png`;
  return null;
}
const lookIds = new WeakMap();
let lookSeq = 0;
function lookId(look) {
  let id = lookIds.get(look);
  if (id === undefined) { id = ++lookSeq; lookIds.set(look, id); }
  return id;
}
// 기운·후광이 붙은 인물은 시간에 따라 계속 흔들려서 캐시가 안 맞는다.
// 그런 인물은 몇 안 되므로 그냥 매번 그린다.
const sprCacheable = (look) => !!look && !look.aura && !look.halo && !look.jiangshi;
// run: 걷는 몹은 다리를 놀리는 그림으로 (v160 — 전에는 선 자세 그대로 미끄러졌다). 달리기 한 바퀴는 2π/14초.
const RUN_CYCLE = (Math.PI * 2) / 14;
function fighterSprite(look, time, weapon, dpr, run = false) {
  if (!sprCacheable(look)) return null;
  const cyc = run ? RUN_CYCLE : SPR.cycle;
  const ph = Math.floor((((time % cyc) + cyc) % cyc) / cyc * SPR.phases);
  const key = `${lookId(look)}|${ph}|${weapon || ''}|${dpr}${run ? '|r' : ''}`;
  let c = sprCache.get(key);
  if (c) return c;
  // 통째로 비우면 아직 화면에 있는 것까지 날아가 그 프레임에 전부 다시 굽는다.
  // Map은 넣은 순서를 지키므로 오래된 쪽 절반만 버린다.
  if (sprCache.size >= SPR.max) {
    let drop = SPR.max >> 1;
    for (const k of sprCache.keys()) { if (drop-- <= 0) break; sprCache.delete(k); }
  }
  c = document.createElement('canvas');
  c.width = Math.ceil(SPR.w * dpr);
  c.height = Math.ceil(SPR.h * dpr);
  const sc = c.getContext('2d');
  sc.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFighter(sc, SPR.ox, SPR.oy, look, {
    t: (ph + 0.5) / SPR.phases * cyc, weapon, flash: 0, run,
  });
  sprCache.set(key, c);
  return c;
}

// 상태이상 표시. 빙결은 얼음 덩어리로 크게 보이지만 둔화·출혈·파쇄는
// 걸려도 표가 안 났다 — 효과가 있어도 플레이어가 모르면 없는 것이다.
// 수십 마리가 동시에 걸리므로 글자가 아니라 작은 점으로 찍는다.
const CC_DOT = [
  ['slow', '#a5b4fc'],
  ['bleed', '#fca5a5'],
  ['weak', '#fcd34d'],
];
function ccDots(ctx, m, cx, y) {
  const on = CC_DOT.filter(([k]) => m[k] > 0);
  if (!on.length) return;
  const r = 2.6;
  const w = on.length * (r * 2 + 3) - 3;
  let x = cx - w / 2 + r;
  for (const [, color] of on) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    x += r * 2 + 3;
  }
}
const AOE_FLOAT_MAX = 6;    // 광역 피해 숫자는 이만큼만 띄우고 나머지는 합친다
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const SHADOW_LOOK = { robe: '#0b0b0d', trim: '#3f0d12', sash: '#1f0a0c', band: '#7f1d1d', aura: '#4c0519', eyes: '#ef4444', hair: '#000' };
const SPECIAL_INK = {
  raid: { ink: ['#d9a48f', '#7f1d1d', '#3b0a0a', '#230606'], sun: '#450a0a', prop: 'rock' },
  trial: { ink: ['#2b2233', '#120e17', '#0a080d', '#060408'], sun: '#a855f7', moon: true, prop: 'none', night: true },
  pvp: { ink: ['#ece2cb', '#d3bf98', '#7b6a55', '#6b5844'], sun: '#c0392b', prop: 'arena' },
  gold: { ink: ['#3a2f22', '#1d1711', '#0f0b08', '#2a2016'], sun: '#fbbf24', moon: true, prop: 'lantern', night: true },
  stone: { ink: ['#5a5f66', '#2c3036', '#16181c', '#24272c'], sun: '#94a3b8', moon: true, prop: 'mine', night: true },
  pet: { ink: ['#dfe8d2', '#a9bf95', '#4a6040', '#3c5032'], sun: '#b91c1c', prop: 'bamboo' },
  relic: { ink: ['#4a4f5c', '#252832', '#121419', '#1b1e25'], sun: '#cbd5e1', moon: true, prop: 'grave', night: true },
};

// ---------- 애완동물 공격 연출 (v193) ----------
// 한 대마다 짧게(0.3~0.5초) — 여럿이 함께 싸워도 화면을 덮지 않게 작게. 등급이 높을수록 조금 크다.
// at: 맞은 자리(들판 좌표) · from: 애완동물 자리(들판 좌표, 없을 수 있다)
const CAST_COL = { sword: '229,231,235', fist: '245,158,11', fan: '56,189,248', ring: '168,85,247', poison: '132,204,22' };
// v222: 애완동물 기운 — 발밑에 등급 빛(레어 파랑 · 유니크 보라 · 전설 주황 · 신화 붉음)과
// 그 짐승의 기운 알갱이(주작 불티 · 청룡 번개 · 현무 물방울 · 선학 깃털 · 그 밖은 도는 빛). 상태 없이 시간으로.
// v236: 둥근 빛 — 빛깔·모양마다 한 번 구워 두고 drawImage로 키워 찍는다.
// 매 프레임 createRadialGradient(+shadowBlur)를 수십 번 만들던 것이 한 장 그리기를 두 배 가까이 늘렸다(p95 6 → 12ms).
const glowCache = new Map();
function glowSpr(col, ring = false) {
  const key = col + (ring ? 'r' : '');
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, ring ? 12 : 0, 32, 32, 32);
  if (ring) { rg.addColorStop(0, `rgba(${col},0)`); rg.addColorStop(0.8, `rgba(${col},1)`); rg.addColorStop(1, `rgba(${col},0)`); }
  else { rg.addColorStop(0, `rgba(${col},1)`); rg.addColorStop(1, `rgba(${col},0)`); }
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  glowCache.set(key, c);
  return c;
}
// 가운데 (x, y), 반지름 r, 진하기 a — 납작하게(sq) 찍을 수도 있다
function putGlow(ctx, col, x, y, r, a, sq = 1, ring = false) {
  if (a <= 0.003 || r <= 0) return;
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * Math.min(1, a);
  ctx.drawImage(glowSpr(col, ring), x - r, y - r * sq, r * 2, r * 2 * sq);
  ctx.globalAlpha = ga;
}
// v225: 보물 요괴 기운 — 금빛 둥근 빛과 반짝이는 별 다섯(돌면서 깜빡)
function treasureAura(ctx, x, y, sc, t, sq = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = 46 * sc;
  putGlow(ctx, '253,224,71', x, y - 30 * sc, r, 0.28 + 0.1 * Math.sin(t * 5));
  for (let i = 0; i < 5; i++) {
    const a = t * 1.5 + (i / 5) * Math.PI * 2;
    const tw = Math.max(0, Math.sin(t * 6 + i * 1.9));
    if (tw < 0.2) continue;
    const sx = x + Math.cos(a) * 30 * sc, sy = y - 34 * sc + Math.sin(a) * 30 * sc * sq;
    const L = 5 * tw + 2;
    ctx.fillStyle = `rgba(255,251,235,${tw})`;
    ctx.beginPath(); ctx.moveTo(sx - L, sy); ctx.lineTo(sx, sy - 1.2); ctx.lineTo(sx + L, sy); ctx.lineTo(sx, sy + 1.2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sx, sy - L); ctx.lineTo(sx - 1.2, sy); ctx.lineTo(sx, sy + L); ctx.lineTo(sx + 1.2, sy); ctx.fill();
  }
  ctx.restore();
}
// v224: 정예 기운 — 발밑에 주황 불꽃 고리가 숨 쉬고, 불티 넷이 엇갈려 오른다 (멀리서도 '저건 세다'가 보이게)
function eliteAura(ctx, x, y, sc, t, sq = 0.5) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const r = 30 * sc * (1 + Math.sin(t * 3) * 0.06);
  putGlow(ctx, '251,146,60', x, y, r, 0.22, sq, true);
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sq);
  ctx.strokeStyle = `rgba(253,186,116,${0.45 + 0.2 * Math.sin(t * 4)})`; ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.7 + i / 4) % 1;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
    ctx.fillStyle = 'rgb(253,186,116)';
    ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.3 + t * 1.6) * 16 * sc, y - 8 - ph * 70 * sc, 1.6 + (i % 2), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// v223: 탈것 자취 빛깔 — 6단 흑풍마부터(따로 없으면 흰 바람), 십이지 신수는 금빛
const MOUNT_TRAIL = { redhare: '248,113,113', ochu: '167,139,250', cloud: '241,245,249', azure: '125,211,252', tigerm: '253,186,116' };
function petAura(ctx, pet, x, y, t, front, sq = 0.5) {
  const rar = Math.max(0, Math.min(3, pet.rar || 0));
  const col = PET_COL[pet.kind] || '253,224,71';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (!front) {
    const rc = DROP_COL[rar];
    const r = 24 + rar * 4 + Math.sin(t * 2.4) * 2;
    putGlow(ctx, rc, x, y, r, 0.18 + rar * 0.07, sq);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, sq); ctx.translate(-x, -y);
    if (rar >= 2) { ctx.strokeStyle = `rgba(${rc},${0.35 + 0.15 * Math.sin(t * 3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    return;
  }
  const n = 2 + rar;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.6 + i / n) % 1;
    const a = Math.sin(ph * Math.PI);
    if (pet.kind === 'phoenix') {               // 불티가 오른다
      ctx.fillStyle = `rgba(${col},${0.85 * a})`;
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.1 + t * 2) * 14, y - 10 - ph * 46, 1.6 + (i % 2), 0, Math.PI * 2); ctx.fill();
    } else if (pet.kind === 'dragon') {         // 작은 번개가 튄다
      if (ph > 0.25) continue;
      const bx = x + Math.cos(i * 2.4 + Math.floor(t * 3)) * 18, by = y - 26 + Math.sin(i * 1.7) * 10;
      ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 5, by + 6); ctx.lineTo(bx - 2, by + 9); ctx.lineTo(bx + 4, by + 16); ctx.stroke();
    } else if (pet.kind === 'turtle') {         // 물방울이 천천히 떠오른다
      ctx.strokeStyle = `rgba(${col},${0.7 * a})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.7 + t) * 12, y - 6 - ph * 34, 2 + (i % 3), 0, Math.PI * 2); ctx.stroke();
    } else if (pet.kind === 'crane') {          // 깃털이 흩날려 내린다
      ctx.fillStyle = `rgba(${col},${0.7 * a})`;
      ctx.save(); ctx.translate(x + Math.sin(i * 1.9 + t * 1.5) * 20, y - 44 + ph * 40); ctx.rotate(Math.sin(t * 3 + i) * 0.8);
      ctx.beginPath(); ctx.ellipse(0, 0, 1.6, 4.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else {                                    // 몸을 도는 빛
      const ang = t * 1.8 + (i / n) * Math.PI * 2;
      ctx.fillStyle = `rgba(${col},${0.55 + 0.35 * Math.sin(ang)})`;
      ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 20, y - 18 + Math.sin(ang) * 20 * sq, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}
function skillAccent(v, cls, at, crit) {
  const k = crit ? 1.3 : 1;
  const E = (o) => v.effects.push(o);
  if (cls === 'sword') {
    const a = Math.random() * 0.6 - 0.3;
    E({ kind: 'cutline', life: 0.22, max: 0.22, wx: at.x, wy: at.y, a: 0.8 + a });
    E({ kind: 'cutline', life: 0.26, max: 0.26, wx: at.x, wy: at.y, a: -0.8 + a });
  } else if (cls === 'fist') {
    E({ kind: 'shock', life: 0.3, max: 0.3, wx: at.x, wy: at.y, r: 52 * k, col: '245,158,11', rings: 2, w: 4 });
    if (crit) E({ kind: 'crack', life: 0.5, max: 0.5, wx: at.x, wy: at.y, r: 50, col: '251,191,36', seed: Math.random() * 99, n: 4 });
  } else if (cls === 'fan') {
    E({ kind: 'petals', life: 0.4, max: 0.4, wx: at.x, wy: at.y, r: 82 * k, col: '125,211,252', seeds: seedsN(9), spin: 7 });
  } else if (cls === 'ring') {
    E({ kind: 'shock', life: 0.36, max: 0.36, wx: at.x, wy: at.y, r: 40 * k, col: '192,132,252', rings: 3, w: 2 });
  } else if (cls === 'poison') {
    E({ kind: 'petals', life: 0.45, max: 0.45, wx: at.x, wy: at.y, r: 64 * k, col: '163,230,53', seeds: seedsN(7), spin: 2 });
  }
}
const JOB_SEAL = { sword: '劍', fist: '拳', fan: '扇', ring: '指', poison: '毒' };
const DROP_COL = ['96,165,250', '192,132,252', '251,146,60', '244,63,94'];
const PET_COL = { crane: '241,245,249', fox: '96,165,250', qilin: '253,224,71', turtle: '56,189,248', haetae: '214,180,120', phoenix: '249,115,22', monkey: '250,204,21', dragon: '125,211,252', tiger: '241,245,249', yellow: '250,204,21' };
const PET_SKILL_NAME = { crane: '학익진', fox: '여우불', qilin: '기린각', turtle: '현무파', haetae: '해태충', phoenix: '주작염', monkey: '분신봉', dragon: '청룡뇌', tiger: '백호참', yellow: '황룡진' };
const seedsN = (n) => Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]);
const PET_FX = {
  // 선학: 깃털이 흩날리는 날갯짓
  crane(v, at, from, r) {
    v.effects.push({ kind: 'petals', life: 0.5, max: 0.5, wx: at.x, wy: at.y, r: 83 + r * 11, col: '248,250,252', seeds: seedsN(7), spin: 3 });
    v.effects.push({ kind: 'shock', life: 0.28, max: 0.28, wx: at.x, wy: at.y, r: 47, col: '226,232,240', w: 2 });
  },
  // 구미호: 푸른 여우불이 날아가 터진다
  fox(v, at, from, r) {
    if (from) v.effects.push({ kind: 'qiorb', life: 0.34, max: 0.34, go: 0.7, pts: [{ x: from.x, y: from.y, oy: -30 }, { x: at.x, y: at.y }], col: '96,165,250', size: 8 + r * 1.5, hop: 26 });
    v.later.push({ t: 0.22, ev: { type: '_fx', fx: [{ kind: 'flare', life: 0.3, max: 0.3, wx: at.x, wy: at.y, r: 62 + r * 8, col: '147,197,253' }] } });
  },
  // 기린: 금빛 발굽이 땅을 울린다
  qilin(v, at, from, r) {
    v.effects.push({ kind: 'shock', life: 0.4, max: 0.4, wx: at.x, wy: at.y, r: 81 + r * 11, col: '253,224,71', rings: 2, w: 3 });
    v.effects.push({ kind: 'flare', life: 0.25, max: 0.25, wx: at.x, wy: at.y, r: 55, col: '254,240,138' });
  },
  // 현무: 물결이 퍼진다
  turtle(v, at, from, r) {
    v.effects.push({ kind: 'shock', life: 0.5, max: 0.5, wx: at.x, wy: at.y, r: 73 + r * 8, col: '56,189,248', rings: 3, w: 2 });
  },
  // 해태: 돌 같은 박치기 — 바닥이 갈라진다
  haetae(v, at, from, r) {
    v.effects.push({ kind: 'crack', life: 0.6, max: 0.6, wx: at.x, wy: at.y, r: 62 + r * 8, col: '214,180,120', seed: Math.random() * 99, n: 4 });
    v.effects.push({ kind: 'shock', life: 0.3, max: 0.3, wx: at.x, wy: at.y, r: 55, col: '214,180,120', w: 3 });
  },
  // 주작: 불꽃이 터진다
  phoenix(v, at, from, r) {
    v.effects.push({ kind: 'flare', life: 0.35, max: 0.35, wx: at.x, wy: at.y, r: 81 + r * 11, col: '249,115,22' });
    v.effects.push({ kind: 'petals', life: 0.45, max: 0.45, wx: at.x, wy: at.y, r: 73, col: '251,146,60', seeds: seedsN(6), spin: 5 });
  },
  // 손오공: 여의봉 한 바퀴
  monkey(v, at, from, r) {
    v.effects.push({ kind: 'cutline', life: 0.24, max: 0.24, wx: at.x, wy: at.y + 10, a: -0.3 + Math.random() * 0.6 });
    v.effects.push({ kind: 'shock', life: 0.3, max: 0.3, wx: at.x, wy: at.y, r: 58 + r * 8, col: '250,204,21', w: 3 });
  },
  // 청룡: 푸른 번개가 내리꽂힌다
  dragon(v, at, from, r) {
    v.effects.push({ kind: 'cutline', life: 0.2, max: 0.2, wx: at.x, wy: at.y, a: Math.PI / 2 + (Math.random() - 0.5) * 0.4 });
    v.effects.push({ kind: 'flare', life: 0.28, max: 0.28, wx: at.x, wy: at.y, r: 73 + r * 11, col: '125,211,252' });
    v.effects.push({ kind: 'shock', life: 0.3, max: 0.3, wx: at.x, wy: at.y, r: 55, col: '186,230,253', w: 2 });
  },
  // 백호: 세 갈래 발톱 자국
  tiger(v, at, from, r) {
    const a = -0.9 + (Math.random() - 0.5) * 0.3;
    for (let k = -1; k <= 1; k++) v.effects.push({ kind: 'cutline', life: 0.26, max: 0.26, wx: at.x + k * 9, wy: at.y + k * 6, a });
    if (r >= 2) v.effects.push({ kind: 'shock', life: 0.28, max: 0.28, wx: at.x, wy: at.y, r: 62, col: '241,245,249', w: 2 });
  },
  // 황룡: 금빛 우레 — 가장 크다
  yellow(v, at, from, r) {
    v.effects.push({ kind: 'cutline', life: 0.22, max: 0.22, wx: at.x, wy: at.y, a: Math.PI / 2 });
    v.effects.push({ kind: 'flare', life: 0.35, max: 0.35, wx: at.x, wy: at.y, r: 101 + r * 14, col: '250,204,21' });
    v.effects.push({ kind: 'shock', life: 0.45, max: 0.45, wx: at.x, wy: at.y, r: 99 + r * 14, col: '253,224,71', rings: 2, w: 4 });
  },
};

export class BattleView {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.floats = [];
    this.particles = [];
    this.effects = [];
    this.projectiles = [];
    this.t = 0;
    this.scroll = 0;
    this.heroLunge = 0;
    this.corpses = [];   // 쓰러지는 중인 졸개
    this.monLunge = 0;
    this.monShake = 0;
    this.monFlash = 0;
    this.hitstop = 0;   // 타격 순간 연출을 잠깐 느리게
    this.monKnock = 0;  // 맞고 밀려나는 거리
    this.heroFlash = 0;
    this.monDeath = 0;
    this.shake = 0;
    this.banner = null;
    this.hanja = null;
    this.flash = 0;
    this.aoeHits = 0;
    this.aoeAmount = 0;
    this.sparks = [];   // 맞은 자리·쓰러진 자리의 짧은 빛
    this.paths = [];    // 번개가 튄 길·파고든 길 (연환벽력·발도돌격)
    // 가벼운 모드 — 느린 기기에서 알아서 켜진다(main.js가 프레임을 보고 정한다).
    // 끊김은 **쓰는 기기에서만** 보인다. 숫자를 받아 고치는 길만 두면
    // 영영 못 고치는 사람이 생긴다 — 게임이 스스로 내려가게 둔다.
    this.light = false;
    // ---- 초식 연출 (skillfx.js) ----
    this.heroAnim = new PoseAnim();   // 무인 자세 이음
    this.rangeRings = [];             // v157: 펼친 무공의 범위 고리 (설정 '스킬 범위 보기')
    this.rangePreview = null;         // v157: 무공 단추를 길게 누르는 동안 보여 주는 범위 { center, r, reach }
    this.showRange = false;
    this.later = [];       // 조금 뒤에 그릴 사건 (날아가는 평타의 맞은 숫자)
    this.shotDelay = 0;
    this.pending = null;   // 이번 프레임에 시전된 무공 — 결과를 모으는 중
    this.director = null;  // 지금 돌고 있는 연출
    this.beat = '';        // 지금 박자 (미리보기가 읽는다)
    // 카메라. 무인이 순간이동하면 화면이 잠깐 머물렀다 따라간다 — 사라진 자리와
    // 나타난 자리가 둘 다 보여야 '옮겨 갔다'가 읽힌다. 평소엔 무인에 딱 붙는다.
    this.camX = null;
    this.camY = null;
    this.camPan = false;
    this.camHold = 0;
    this.camRate = 10;
    this.camFocus = null;  // 연출이 잠깐 화면 가운데에 두고 싶은 자리 (들판 좌표)
    this.faceOverride = 0; // 연출이 정한 무인 방향 (0이면 게임이 정한 대로)
    // 화면 흑백 (0..1). 무인만 색이 남는다.
    this.desat = 0;
    this.desatTo = 0;
    this.desatRate = 4;
    this.slice = null;     // 화면 가르기
    // 연출 세기: 2 높음 · 1 보통 · 0 낮음 (설정의 '연출 간소화'). 가벼운 모드면 보통까지만.
    this.fxPref = 2;
    this.brush = BRUSH;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // CPU로 그리기 (v188) — 보이지 않는 캔버스(CPU)에 다 그리고, 끝에 화면 캔버스에 한 장 붙인다(rendermode.js)
  setSoftware(on) {
    if (!!this.soft === !!on) return false;
    if (on) {
      this.outCtx = this.outCtx || this.ctx;
      this.soft = document.createElement('canvas');
      this.ctx = this.soft.getContext('2d', { willReadFrequently: true });
    } else {
      this.ctx = this.outCtx || this.ctx;
      this.soft = null;
    }
    this._decor = null;
    this._vig = null;
    sprCache.clear();
    this.resize();
    return true;
  }
  get drawCv() { return this.soft || this.cv; }
  // 해상도 상한을 바꾼다 (v181). 구워 둔 것은 해상도를 따르므로 버린다.
  setDprCap(c) {
    if (Math.abs((this.dprCap || 2) - c) < 0.01) return false;
    this.dprCap = c;
    this._decor = null;
    this._vig = null;
    sprCache.clear();
    this.resize();
    return true;
  }
  // 가벼운 모드를 켜고 끈다. 해상도가 바뀌므로 구워 둔 것을 전부 버린다.
  setLight(on) {
    if (this.light === !!on) return false;
    this.light = !!on;
    this._decor = null;
    this._vig = null;
    sprCache.clear();
    this.resize();
    return true;
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    // **해상도가 채우는 화소를 제곱으로 바꾼다.** dpr 2에서 1로 내리면 1/4다.
    // 이 게임 그림체는 선이 굵어서 1로 내려도 거의 티가 안 난다.
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    // v181: 해상도 상한(dprCap — 설정의 화질, 자동이면 프레임을 보고 고른다)과 화소 예산.
    // 전체 화면·큰 폰에서 2배로 찍으면 한 프레임에 150만 화소를 넘게 칠한다 — 그게 버벅임의 뿌리였다.
    const budget = Math.sqrt(PIXEL_BUDGET / (this.W * this.H));
    const dpr = this.light ? 1 : Math.max(1, Math.min(this.dprCap || 2, window.devicePixelRatio || 1, budget));
    this.dpr = dpr;
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    if (this.soft) { this.soft.width = this.cv.width; this.soft.height = this.cv.height; }
    this.applyZoom();
  }

  // ---------- 물린 카메라 (바람식: 사냥터 한 장이 화면에 통째로) ----------
  // 그림은 전부 '들판 단위'로 그리고, 캔버스를 zoom만큼 줄여 찍는다. 그래서 w·h는 들판 단위로
  // 본 화면 크기(진짜 크기 W·H ÷ zoom)다. 글자(떠오르는 숫자·띠·이름표)만 진짜 크기로 쓴다.
  applyZoom() {
    const z = this.zoom || 1;
    this.w = this.W / z;
    this.h = this.H / z;
    this.ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, 0, 0);
  }
  setZoom(z) {
    if (Math.abs(z - (this.zoom || 1)) < 0.002) return;
    this.zoom = z;
    this._decor = null;
    this._vig = null;
    this.applyZoom();
  }
  // 게임이 칸 지도(mapW·mapH)를 주면 그 지도가 들판 자리(위 padTop · 아래 padBottom을 뺀 곳)에 꼭 맞게
  get overview() { return this.fieldMode && !!this.game?.mapW; }
  fitZoom(game) {
    const fieldH = this.H - (this.padTop || 0) - (this.padBottom ?? 130);
    const all = Math.min(1, (this.W - 12) / game.mapW, (fieldH - 6) / (game.mapH * this.squash + 135));
    // 카메라 단계 (v115): 0 전체(지도 한 장) · 1 보통(가로 일곱 칸 남짓) · 2 가까이(가로 다섯 칸) — 1·2는 무인을 따라간다
    const lv = this.camLevel ?? 1;
    if (lv <= 0) return all;
    const T = game.tile || 64;
    return Math.max(all, Math.min(1.3, this.W / (T * (lv === 1 ? 7.2 : 5.2))));
  }
  // 지도가 화면보다 크면(보통·가까이) 카메라가 무인을 따라가되 지도 밖은 비추지 않는다
  followCam(game) {
    const z = this.zoom || 1;
    const sq = this.squash;
    const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));
    const halfW = this.w / 2 - 6;
    const tx = clamp(game.heroX, halfW, game.mapW - halfW);
    let ty;
    if (this.sheetOpen) ty = clamp(game.heroY, 0, game.mapH);
    else {
      const half = ((this.H - (this.padTop || 0) - (this.padBottom ?? 130)) / z) / 2;
      ty = clamp(game.heroY, (half - 65) / sq, game.mapH - (half - 65) / sq);
    }
    return { tx, ty };
  }

  // ---------- 탑다운 좌표계 ----------
  // 바닥은 위에서 내려다본 평면, 인물은 그 위에 세워서 그린다.
  // (Blade Idle도 카메라 90도 하향 + 인물 빌보드. docs/BladeIdle_화면구조.md)
  // 카메라는 항상 무인을 화면 중앙에 둔다.
  // 아래쪽은 스킬 슬롯·창 버튼이 덮으므로 무인을 중앙보다 조금 위에 둔다
  // 카메라가 무인을 쫓아가는 중이면 무인은 가운데에서 그만큼 비켜 서 있다.
  // sx·sy가 이 둘을 바탕으로 하므로 적·빛도 같이 맞춰진다.
  // 창(시트)이 열려 있으면 무인을 위쪽 남은 들판에 세운다 — 시트가 화면 아래 58%를 덮는다.
  // anchor는 tick에서 부드럽게 옮긴다(툭 튀면 멀미 난다).
  get groundY() { const g = this.game; return this.h * (this.anchor ?? 0.47) + (g && this.camY != null ? (g.heroY - this.camY) * this.squash : 0); }
  get heroX() { const g = this.game; return this.w * 0.5 + (g && this.camX != null ? g.heroX - this.camX : 0); }
  get fxLevel() { return this.light ? Math.min(1, this.fxPref) : this.fxPref; }
  // 월드 Y는 화면에서 살짝 눌러 그린다 — 평면이 너무 넓어 보이지 않게
  get squash() { return FIELD_SQUASH; }
  sx(m) { const g = this.game; return this.heroX + (m.x - (g?.heroX || 0)); }
  sy(m) { const g = this.game; return this.groundY + (m.y - (g?.heroY || 0)) * this.squash; }
  get monX() { const g = this.game; return g?.mon ? this.sx(g.mon) : this.w * 0.5; }
  get monY() { const g = this.game; return g?.mon ? this.sy(g.mon) : this.groundY; }
  get fieldMode() { return this.game?.mode === 'stage'; }
  // 적이 많을수록 조금씩 작게 그린다. 100마리가 원래 크기면 화면이 메워진다.
  get crowdScale() {
    const n = this.game?.mons?.length || 0;
    if (n <= 12) return 1;
    return Math.max(0.62, 1 - (n - 12) * 0.0045);
  }
  screenXOf(m) { return this.sx(m); }

  handle(ev, game) {
    if (this.pending && !ev._released && this.hold(ev, game)) return;
    // 날아가는 평타는 닿을 때 숫자가 뜬다
    if (this.shotDelay && ev.type === 'dmg' && ev.kind === 'hit' && !ev._released) {
      this.later.push({ t: this.shotDelay, ev: { ...ev, at: ev.at ? { x: ev.at.x, y: ev.at.y } : null } });
      return;
    }
    switch (ev.type) {
      case 'attack': {
        // 멀리서 쏘는 캐릭터 — 무기마다 날아가는 게 다르다. 맞은 숫자는 닿을 때 뜬다.
        const cls = game.s.job;
        // v125: 환마·독마는 붙어 있어도 제 무기로(부채 바람·독 던지기) — 전엔 붙으면 칼처럼 베었다
        const shot = (cls === 'fan' || cls === 'poison' || (!ev.close && game.ranged?.())) ? SHOT[cls] : null;
        if (shot) {
          const face = (this.faceOverride || game.heroFacing) < 0 ? -1 : 1;
          this.projectiles.push({ kind: shot.kind, x: this.heroX + 22 * face, y: this.groundY - 64,
            life: shot.life, max: shot.life, tier: game.jobTier?.() || 0, seed: Math.random() });
          this.shotDelay = shot.life;
          if (!this.director) this.heroAnim.play([[0.05, shot.pose[0], 'out'], [0.12, shot.pose[1], 'snap']], 0.18);
        } else if (ev.close && cls === 'ring') {
          // 붙었을 때 — 손가락으로 혈을 짚는다: 짧게 찌르는 보랏빛 지력 + 짚은 자리에 물결
          this.heroLunge = 1;
          if (!this.director) this.heroAnim.play([[0.04, '지법겨눔', 'out'], [0.1, '손가락튕김', 'snap']], 0.16);
          const t = game.mon;
          if (t && this.fxLevel > 0) {
            this.effects.push({ kind: 'lance', life: 0.14, max: 0.14, wx: game.heroX, wy: game.heroY, a: Math.atan2((t.y - game.heroY) * this.squash, t.x - game.heroX), len: Math.hypot(t.x - game.heroX, (t.y - game.heroY) * this.squash), w: 3, col: '216,180,254', oy: -62 });
            this.effects.push({ kind: 'shock', life: 0.3, max: 0.3, wx: t.x, wy: t.y, r: 34, col: '192,132,252', rings: 2, w: 3 });
          }
          this.sparks.push({ x: this.monX, y: this.monY - 64, life: 0.2, max: 0.2, r: 26, color: '#c084fc' });
        } else {
          this.heroLunge = 1;
          this.meleeSwing(game, cls);
          // 검기는 검사만 — 권마의 주먹에서 초승달 검기가 날아가면 이상하다
          if (cls === 'sword' && Math.random() < 0.35) this.projectiles.push({ kind: 'qi', x: this.heroX + 30, y: this.groundY - 60, life: 0.22, max: 0.22 });
        }
        break;
      }
      case 'petAttack':
        this.projectiles.push({ kind: 'orb', x: this.heroX - 50, y: this.groundY - 30, life: 0.3, max: 0.3 });
        break;
      case 'dmg': {
        // 광역기는 맞은 적마다 제 머리 위에 숫자가 뜬다
        const atX = ev.at ? this.sx(ev.at) : this.monX;
        const atY = ev.at ? this.sy(ev.at) : this.monY;
        this.monShake = 1;
        this.monFlash = 1;
        const skill = ev.kind !== 'hit' && ev.kind !== 'pet' && ev.kind !== 'ally';
        // 치명 단계 — 1 치명(빨강) · 2 슈퍼(주황) · 3 하이퍼(보라) · 4+ 금빛. 단계가 높을수록 크게.
        const ct = typeof ev.crit === 'number' ? ev.crit : ev.crit ? 1 : 0;
        // 무공은 치명 단계를 늘 타므로(채운 단계만큼은 반드시) 단계는 글자로만 알리고,
        // 터지는 연출은 평타 치명에만 둔다 — 광역기 수십 대가 다 흔들면 화면이 멀미 난다
        const crit = skill ? false : ev.crit;
        const color = ev.kind === 'pet' ? '#f9a8d4' : ev.kind === 'ally' ? '#a5b4fc' : skill ? '#fde68a' : CRIT_COL[Math.min(ct, CRIT_COL.length - 1)];
        // 평타 치명 — 무기 등급 빛깔의 충격 고리 (v114)
        if (crit && ev.at && this.fxLevel > 0 && game?.s) {
          const gl = this.gearLook(game);
          const c = (gl.weaponCol || '#fde68a').replace('#', '');
          const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
          this.effects.push({ kind: 'shock', life: 0.32, max: 0.32, wx: ev.at.x, wy: ev.at.y, r: 34 + gl.tier * 6, col: rgb, rings: 2, w: 3 });
        }
        const size = ev.kind === 'pet' ? 14 : ev.kind === 'ally' ? 19 : skill ? 28 : ct ? 24 + Math.min(4, ct) * 3 : 17;
        if (ev.add) {
          // 맞은 졸개는 움찔한다(drawAdd가 이 시각을 보고 밀리고 찌그러진다)
          if (ev.at) ev.at._hitAt = this.t;
          // 광역기는 한 방에 수십을 때린다. 숫자를 전부 띄우면 화면이 숫자로 덮인다.
          this.aoeHits++;
          this.aoeAmount = ev.amount;
          if (this.aoeHits <= AOE_FLOAT_MAX) {
            this.float(fmt(ev.amount), atX + (Math.random() - 0.5) * 60, atY - 142, color, size * 0.7, 0.8);
          }
        } else {
          const label = ct >= 2 ? `${critTierName(ct).replace(' 치명', '')}! ` : skill && ct === 1 ? '치명! ' : '';
          this.float(label + fmt(ev.amount) + (ct === 1 && !skill ? '!' : ''), atX + (Math.random() - 0.5) * 60, atY - 142, color, size, 1, ct > 0 || skill);
        }
        // 맞은 자국은 캐릭터를 따른다 — 독마가 맞힌 자리에 칼자국이 나면 이상하다
        const cls = game.s.job;
        if (cls === 'poison') {
          const w = ev.at || game.mon;
          if (w?.x != null) this.effects.push({ kind: 'splash', life: 0.26, max: 0.26, wx: w.x, wy: w.y, r: crit ? 70 : 44, v: game.jobTier() });
        } else {
          this.effects.push({ kind: 'cut', life: 0.18, max: 0.18, a: Math.random() * 0.8 - 0.4, crit: crit, col: CUT_COL[cls] });
        }
        // 치명타는 터지는 느낌이 있어야 한다
        if (crit) this.effects.push({ kind: 'burst', life: 0.3, max: 0.3, crit: true, col: CUT_COL[cls] });
        // 맞은 자리에 섬광 하나. 수십 마리가 동시에 맞으므로 아주 작고 짧게.
        const sparkCol = cls === 'poison' ? `rgb(${VENOM[Math.min(3, game.jobTier())].glow})` : cls === 'ring' ? '#d8b4fe' : color;
        this.sparks.push({ x: atX, y: atY - 46, life: 0.17, max: 0.17, r: (crit ? 26 : skill ? 20 : 13) * (cls === 'poison' ? 0.7 : 1), color: sparkCol });
        // v221: 무공이 맞은 자리 — 직업마다 다른 자국(검사 X자 베기 · 권마 충격 고리 · 환마 바람 소용돌이 · 귀마 혈 짚은 물결 · 독마 독 꽃).
        // 광역기는 한 순간 수십을 때리므로 0.1초에 여섯 자리까지만
        if (skill && ev.at && this.fxLevel > 0 && ev.kind !== 'pet' && ev.kind !== 'ally') {
          if (this.t - (this._accT || -1) > 0.1) { this._accT = this.t; this._accN = 0; }
          if (this._accN++ < 6) skillAccent(this, cls, ev.at, ct > 0);
        }
        // 때린 순간 화면을 아주 잠깐 늦추고 상대를 밀어낸다 — 타격감
        this.hitstop = Math.max(this.hitstop, crit || skill ? 0.075 : 0.032);
        this.monKnock = Math.max(this.monKnock, crit || skill ? 16 : 7);
        if (crit) {
          this.ink(atX - 10, atY - 60, 10, '#7f1d1d', 160);
          // v233: 평타 치명은 자주 터진다 — 보통 치명은 살짝, 슈퍼·하이퍼(2단계+)만 크게 (전엔 매번 0.32 흔들림 + 하얀 번쩍)
          this.shake = Math.max(this.shake, ct >= 2 ? 0.26 : 0.12);
          this.flash = Math.max(this.flash, ct >= 2 ? 0.18 : 0.06);
        }
        break;
      }
      case 'kill': {
        const kx = ev.at ? this.sx(ev.at) : this.monX;
        const ky = ev.at ? this.sy(ev.at) : this.monY;
        if (!ev.add) this.monDeath = 1;
        // 정예·두목·왕을 쓰러뜨리면 그 빛깔로 터진다 (v116)
        const kref = ev.ref || ev.at;   // 붙든 쓰러짐은 ref가 그 몹
        if (kref?.grade > 0 && this.fxLevel > 0) {
          const g = kref.grade;
          const c = this.mobCol({ ...kref, hp: kref.maxHp }).replace('#', '');
          const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
          this.effects.push({ kind: 'shock', life: 0.5 + g * 0.15, max: 0.5 + g * 0.15, wx: ev.at.x, wy: ev.at.y, r: g === 1 ? 60 : 130 + g * 30, col: rgb, rings: g, w: 3 + g });
          if (g >= 2) { this.shake = Math.max(this.shake, 0.25 + g * 0.1); this.flash = Math.max(this.flash, 0.25 * g); }
        }
        // v197 두목 격파 — 한순간 느려지고(히트스톱) 금빛이 터지며 '擊破'가 찍힌다
        if (ev.isBoss && ev.at && this.fxLevel > 0) {
          this.hitstop = Math.max(this.hitstop || 0, 0.4);
          this.effects.push({ kind: 'flare', life: 0.7, max: 0.7, wx: ev.at.x, wy: ev.at.y, r: 160, col: '253,224,71', oy: -70 });
          this.effects.push({ kind: 'petals', life: 1.2, max: 1.2, wx: ev.at.x, wy: ev.at.y, r: 120, col: '253,230,138', seeds: seedsN(18), spin: 3, oy: -70 });
          if (!this.hanja || this.hanja.life <= 0) this.hanja = { text: '擊破', life: 1.3, max: 1.3, color: '#fde68a', scale: 0.8, y: 0.26 };
        }
        // 쓰러진 졸개는 그 자리에서 넘어지며 옅어진다. 전에는 그냥 사라져서
        // 광역기로 수십을 베어도 '벤' 느낌이 없었다. 너무 많으면 앞의 것부터 지운다.
        if (ev.add && ev.at && this.fxLevel > 0) {
          const a = ev.at;
          // 무공 연출이 붙든 쓰러짐은 at이 자리({x,y})만 남는다 — 생김새는 ref(그 몹)에서 (v125: 원숭이가 사람으로 쓰러졌다)
          const def = ev.ref?.def || a.def || {};
          this.corpses.push({ x: a.x, y: a.y, def, t0: this.t, face: a.x >= (game.heroX || 0), seed: Math.random(), grade: ev.ref?.grade ?? a.grade });
          if (this.corpses.length > 28) this.corpses.splice(0, this.corpses.length - 28);
        }
        // 졸개는 넘어지는 그림이 따로 있으니 먹물은 조금만 — 광역기로 열다섯을 베면 240방울이 튀어
        // 화면이 검은 점으로 덮였다
        this.ink(kx, ky - 50, ev.isBoss ? 34 : ev.add ? 4 : 12, ev.isBoss ? '#450a0a' : '#111');
        this.sparks.push({ x: kx, y: ky - 40, life: 0.3, max: 0.3,
          r: ev.isBoss ? 90 : 30, color: ev.isBoss ? '#fde68a' : '#e7e5e4' });
        for (let i = 0; i < (ev.isBoss ? 14 : 4); i++) {
          const a2 = Math.random() * Math.PI * 2;
          const sp = 60 + Math.random() * 140;
          this.particles.push({
            x: kx, y: ky - 30, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 90,
            life: 0.45 + Math.random() * 0.25, size: 2 + Math.random() * 2.5,
            color: 'rgba(28,25,23,0.75)', drop: true,
          });
        }
        if (ev.gold) {
          this.float('+' + fmt(ev.gold) + ' 은자', kx, ky - 165, '#e5e7eb', 13);
          for (let i = 0; i < (ev.isBoss ? 10 : 3); i++) this.ingot(kx, ky - 40);
        }
        // 떨군 재료 (바람식 조합) — 은자 아래 한 줄
        // 글자는 진짜 크기라 줄 간격도 진짜 크기(UIK)로 벌린다 — 안 그러면 은자 줄과 겹친다
        if (ev.mat) this.float(`+${ev.mat.name}${ev.mat.n > 1 ? ` ×${ev.mat.n}` : ''}`, kx, ky - 165 + 17 * UIK, ev.mat.color || '#a7f3d0', 12);
        if (ev.mat?.boss) this.float(`+${ev.mat.boss}`, kx, ky - 165 + 34 * UIK, '#fde68a', 14);
        break;
      }
      // 전직 (v201) — 직업 빛깔의 기운이 크게 모였다가 고리 셋으로 터지고, '二轉'이 찍힌다 · 한순간 느려진다
      case 'advance': {
        if (this.fxLevel <= 0 || game?.heroX == null) break;
        const col = CAST_COL[game.s?.job] || '253,224,71';
        this.effects.push({ kind: 'motes', life: 0.6, max: 0.6, n: 26, seeds: seedsN(26), r: 180, dx: 0, dy: -62, face: 1, col });
        this.later.push({ t: 0.5, ev: { type: '_fx', fx: [
          { kind: 'shock', life: 0.9, max: 0.9, wx: game.heroX, wy: game.heroY, r: 220, col, rings: 3, w: 6 },
          { kind: 'flare', life: 0.7, max: 0.7, wx: game.heroX, wy: game.heroY, r: 140, col },
          { kind: 'petals', life: 1.4, max: 1.4, hero: true, r: 110, col, seeds: seedsN(22), spin: 5, oy: -60 },
        ] } });
        this.hitstop = Math.max(this.hitstop || 0, 0.3);
        this.flash = Math.max(this.flash, 0.5);
        this.shake = Math.max(this.shake, 0.3);
        this.hanja = { text: `${['', '一', '二', '三', '四'][ev.tier] || ''}轉`, life: 1.8, max: 1.8, color: `rgb(${col})`, y: 0.36, scale: 0.85 };
        break;
      }
      // 사냥터에 들어섰다 (v201) — 먹빛에서 밝아진다(0.45초). 툭 바뀌던 화면이 넘어가는 맛.
      case 'mapEnter':
        this.fadeIn = 0.45;
        break;
      // 장비가 떨어졌다 (v196) — 떨어진 자리에 등급 빛깔의 빛이 솟고 고리가 퍼진다 · 등급 이름이 뜬다. 신화는 띠까지.
      case 'drop': {
        if (!ev.at || this.fxLevel <= 0) break;
        const r = Math.max(0, Math.min(3, ev.item?.rar || 0));
        const col = DROP_COL[r];
        this.effects.push({ kind: 'flare', life: 0.6 + r * 0.1, max: 0.6 + r * 0.1, wx: ev.at.x, wy: ev.at.y, r: 50 + r * 18, col, oy: -30 });
        this.effects.push({ kind: 'shock', life: 0.6, max: 0.6, wx: ev.at.x, wy: ev.at.y, r: 60 + r * 20, col, rings: 1 + Math.min(2, r), w: 3 });
        if (r >= 2) this.effects.push({ kind: 'petals', life: 0.9, max: 0.9, wx: ev.at.x, wy: ev.at.y, r: 60, col, seeds: seedsN(10 + r * 3), spin: 4 });
        this.float(['레어', '유니크', '전설', '신화'][r], this.sx(ev.at), this.sy(ev.at) - 110, `rgb(${col})`, 16 + r * 2, 1.4, true);
        if (r >= 3) this.showBanner('신화 장비!', `rgb(${col})`, 1.8, '획득');
        break;
      }
      // 애완동물 기술 (v206) — 그 동물의 연출을 크게(등급 +5만큼) 터뜨리고, 기술 반지름의 고리와 이름
      case 'petSkill': {
        if (!ev.at) break;
        const px = this.sx(ev.at), py = this.sy(ev.at);
        this.petAtk = this.petAtk || [];
        this.petAtk[ev.i] = { t: 0.32, x: px, y: py };
        if (this.fxLevel <= 0) break;
        if (PET_FX[ev.kind]) PET_FX[ev.kind](this, ev.at, this.petPos?.[ev.i], (ev.rar || 0) + 5);
        const col = PET_COL[ev.kind] || '253,224,71';
        this.effects.push({ kind: 'shock', life: 0.6, max: 0.6, wx: ev.at.x, wy: ev.at.y, r: ev.r || 170, col, rings: 2, w: 4 });
        this.float(PET_SKILL_NAME[ev.kind] || '', px, py - 130, `rgb(${col})`, 17, 1.1, true);
        this.shake = Math.max(this.shake, 0.1);
        break;
      }
      // 늦게 터지는 연출 한 묶음 (v193 — 날아간 여우불이 닿을 때)
      case '_fx':
        for (const f of ev.fx || []) this.effects.push({ ...f });
        break;
      case 'petHit': {
        // 애완동물의 한 대 — 과녁 쪽으로 튀어 나가고(drawHeroUnit), 맞은 자리에 짧은 빛
        if (!ev.at) break;
        const px = this.sx(ev.at), py = this.sy(ev.at);
        this.petAtk = this.petAtk || [];
        this.petAtk[ev.i] = { t: 0.32, x: px, y: py };
        // v193 애완동물마다 제 결의 공격 연출 — 전에는 모두 같은 노란 반짝임 하나였다
        const pet = game.petTeam?.()[ev.i];
        if (this.fxLevel > 0 && pet && PET_FX[pet.kind]) PET_FX[pet.kind](this, ev.at, this.petPos?.[ev.i], pet.rar || 0);
        else this.sparks.push({ x: px, y: py - 40, life: 0.22, max: 0.22, r: 24, color: '#fde68a' });
        break;
      }
      case 'heroHit': {
        this.heroFlash = 1;
        this.monLunge = 1;
        // v164: 맞으면 맞은 쪽 반대로 움찔 밀린다 — 크게 맞을수록(최대 체력의 몇 할) 세게, 바닥 경고에 맞으면 화면도 울린다
        const hp = game?.stats?.().hp || 1;
        this.heroRecoil = Math.min(1, 0.45 + (ev.amount / hp) * 3);
        if (ev.tell || ev.amount > hp * 0.15) this.shake = Math.max(this.shake, 0.18 + Math.min(0.3, ev.amount / hp));
        this.float('-' + fmt(ev.amount) + (ev.crit ? '!' : ''), this.heroX + 26, this.groundY - 158, '#fca5a5', ev.crit ? 18 : 14);
        // v217: 두목의 평타는 무인 몸에 붉은 칼자국 + 충격 고리 + 불티 — 그냥 몹과 무게가 다르다
        if (ev.boss && this.fxLevel > 0 && game?.heroX != null) {
          const f = ev.from || { x: game.heroX + 1, y: game.heroY };
          const a = Math.atan2((game.heroY - f.y) * this.squash, game.heroX - f.x) + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
          this.effects.push({ kind: 'cutline', life: 0.28, max: 0.28, wx: game.heroX, wy: game.heroY, a });
          this.effects.push({ kind: 'shock', life: 0.32, max: 0.32, wx: game.heroX, wy: game.heroY, r: 70, col: '248,113,113', rings: 2, w: 4 });
          for (let i = 0; i < 7; i++) { const b = Math.random() * Math.PI * 2, v = 90 + Math.random() * 140; this.particles.push({ x: this.heroX, y: this.groundY - 60, vx: Math.cos(b) * v, vy: Math.sin(b) * v - 40, life: 0.35 + Math.random() * 0.2, size: 2 + Math.random() * 2.5, color: 'rgb(254,202,202)' }); }
          this.shake = Math.max(this.shake, 0.14);
        }
        break;
      }
      case 'bossCast':
        // 설정집의 독문무공(십이지왕·고수)은 크고 금빛으로 외친다
        if (ev.at) this.float(ev.skill ? `「${ev.name}」` : ev.name, this.sx(ev.at), this.sy(ev.at) - 150, ev.skill ? '#fde68a' : '#fca5a5', ev.skill ? 20 : 16, 1, true);
        // v160: 초식 그림을 고르고(경고·터짐에 쓴다) 발밑에 진을 깐다
        this.castFx = fxFor(ev.name.replace(/^오의 · /, ''), ev.at?.def?.look, ev.pat);
        if (ev.at && this.fxLevel > 0) {
          this.effects.push({ kind: 'bcast', wx: ev.at.x, wy: ev.at.y, r: ev.ult ? 170 : ev.skill ? 120 : 90, fx: this.castFx, life: ev.ult ? 1.8 : 1.1, max: ev.ult ? 1.8 : 1.1 });
          // v217: 펼치기 전 기를 모은다 — 초식 빛깔 알갱이가 두목에게 빨려 든다(오의는 더 넓고 길게)
          const gn = Math.round((ev.ult ? 30 : ev.skill ? 22 : 14) * (this.budget ?? 1));
          this.effects.push({ kind: 'gather', wx: ev.at.x, wy: ev.at.y, r: ev.ult ? 260 : ev.skill ? 190 : 140, col: this.castFx?.col || '248,113,113', seeds: seedsN(gn), life: ev.ult ? 1.5 : 0.9, max: ev.ult ? 1.5 : 0.9 });
          if (ev.skill) this.flash = Math.max(this.flash, ev.ult ? 0.3 : 0.12);
        }
        // 오의는 화면 가운데에 크게 (v168)
        if (ev.ult) this.showBanner(ev.name, '#fca5a5', 1.3, '奧義');
        if (ev.lethal) this.float('치명 — 맞으면 쓰러져요! 피하세요', this.heroX, this.groundY - 200, '#fecaca', 15, 1.2, true);
        break;
      // 증표 고유 효과 (v163) — 이름을 띄우고, 둘레 폭발·쏟아짐은 그 무공 그림으로
      case 'imprint':
        this.float(`【${ev.name}】`, ev.at ? this.sx(ev.at) : this.heroX, (ev.at ? this.sy(ev.at) : this.groundY) - 175, ev.col || '#fde68a', 17, 0.9, true);
        this._impFx = fxFor(ev.name, {}, '');
        break;
      case 'impNova':
        if (this.fxLevel > 0) {
          const fx = { ...(this._impFx || fxFor('', {}, '')), col: (ev.col || '#fde68a').replace('#', '').match(/../g).map((h2) => parseInt(h2, 16)).join(',') };
          this.effects.push({ kind: 'bboom', wx: this.game?.heroX || 0, wy: this.game?.heroY || 0, fx, r: ev.r, spin: 1.2, life: 0.7, max: 0.7 });
          this.shake = Math.max(this.shake, 0.2);
        }
        break;
      case 'impRain':
        if (this.fxLevel > 0 && ev.at) {
          const fx = { ...(this._impFx || fxFor('', {}, '')), col: (ev.col || '#fde68a').replace('#', '').match(/../g).map((h2) => parseInt(h2, 16)).join(',') };
          this.effects.push({ kind: 'bboom', wx: ev.at.x, wy: ev.at.y, fx, r: 70, spin: (Math.random() - 0.5) * 2, life: 0.5, max: 0.5 });
        }
        break;
      // v237: 길 — 전광석화. 떠난 자리에서 닿은 자리까지 빛줄기가 남고, 닿은 자리에 흙먼지와 고리
      case 'dash':
        if (ev.from && ev.to && this.fxLevel > 0) {
          const col = CAST_COL[game.s?.job] || '255,255,255';
          this.effects.push({ kind: 'lance', life: 0.22, max: 0.22, wx: ev.from.x, wy: ev.from.y, a: Math.atan2((ev.to.y - ev.from.y) * this.squash, ev.to.x - ev.from.x), len: Math.hypot(ev.to.x - ev.from.x, (ev.to.y - ev.from.y) * this.squash), w: 6, col, oy: -50 });
          this.effects.push({ kind: 'shock', life: 0.3, max: 0.3, wx: ev.to.x, wy: ev.to.y, r: 60, col, rings: 2, w: 3 });
          this.heroLunge = Math.max(this.heroLunge, 1.2);
        }
        break;
      // v226: 던전·탑을 깨면 무인 발밑에서 금빛 기둥이 서고 고리 세 겹 · '破' 낙관과 함께 크게 알린다
      case 'instEnd':
        if (ev.ok && ev.kind !== 'raid' && this.fxLevel > 0 && game?.heroX != null) {
          if (!this.effects.some((e) => e.kind === 'pillar' && e.life > 0.5)) this.effects.push({ kind: 'pillar', life: 1.2, max: 1.2 });
          this.effects.push({ kind: 'shock', life: 0.8, max: 0.8, wx: game.heroX, wy: game.heroY, r: 200, col: '253,224,71', rings: 3, w: 4 });
          this.effects.push({ kind: 'petals', life: 1.4, max: 1.4, wx: game.heroX, wy: game.heroY, r: 170, col: '253,230,138', seeds: seedsN(20), spin: 3, oy: -80 });
          this.showBanner(ev.kind === 'tower' ? `${ev.stage}층 돌파` : '던전 돌파', '#fde68a', 1.3, '破');
          this.flash = Math.max(this.flash, 0.2);
        } else if (!ev.ok && !ev.left && ev.kind !== 'raid' && this.fxLevel > 0 && game?.heroX != null) {
          // 못 깼다 — 잿빛 고리가 가라앉는다
          this.effects.push({ kind: 'shock', life: 0.7, max: 0.7, wx: game.heroX, wy: game.heroY, r: 140, col: '120,113,108', rings: 2, w: 3 });
        }
        break;
      // v225: 보물 요괴 — 나타날 때 금빛 고리, 잡으면 은괴가 분수처럼 솟아 무인에게 빨려 든다
      case 'treasure':
        if (ev.at && this.fxLevel > 0) {
          this.effects.push({ kind: 'shock', life: 0.7, max: 0.7, wx: ev.at.x, wy: ev.at.y, r: 120, col: '253,224,71', rings: 3, w: 3 });
        }
        break;
      case 'treasureKill':
        if (ev.at && this.fxLevel > 0) {
          const tx = this.sx(ev.at), ty = this.sy(ev.at);
          this.effects.push({ kind: 'shock', life: 0.6, max: 0.6, wx: ev.at.x, wy: ev.at.y, r: 160, col: '253,224,71', rings: 2, w: 5 });
          this.effects.push({ kind: 'petals', life: 1.1, max: 1.1, wx: ev.at.x, wy: ev.at.y, r: 140, col: '253,230,138', seeds: seedsN(16), spin: 4, oy: -60 });
          for (let i = 0; i < Math.round(14 * (this.budget ?? 1)); i++) this.ingot(tx + (Math.random() - 0.5) * 30, ty - 40);
          this.flash = Math.max(this.flash, 0.18);
          this.shake = Math.max(this.shake, 0.2);
        }
        break;
      case 'treasureGone':
        if (ev.at && this.fxLevel > 0) this.effects.push({ kind: 'petals', life: 0.6, max: 0.6, wx: ev.at.x, wy: ev.at.y, r: 70, col: '214,211,209', seeds: seedsN(8), spin: 2 });
        break;
      case 'tellBoom': {
        const tl = ev.tell;
        const c = tl.kind === 'line' ? { x: (tl.x0 + tl.x1) / 2, y: (tl.y0 + tl.y1) / 2 } : tl.kind === 'cone' ? { x: tl.x + Math.cos(tl.a) * tl.r * 0.55, y: tl.y + Math.sin(tl.a) * tl.r * 0.55 } : tl;
        const r = tl.kind === 'line' ? Math.min(220, tl.w * 1.4) : tl.kind === 'donut' ? tl.r1 * 0.7 : tl.kind === 'cone' ? tl.r * 0.45 : tl.r;
        const fx = tl._fx;
        this.effects.push({ kind: 'shock', life: 0.35, max: 0.35, wx: c.x, wy: c.y, r, col: fx?.col || '248,113,113', rings: 2, w: 5 });
        // v160: 초식 그림이 크게 터진다 (줄은 칼날로, 둥근 것은 폭발로)
        if (fx && this.fxLevel > 0) {
          if (tl.kind === 'line') this.effects.push({ kind: 'bboom', wx: c.x, wy: c.y, fx, len: Math.hypot(tl.x1 - tl.x0, (tl.y1 - tl.y0) * this.squash), ang: Math.atan2((tl.y1 - tl.y0) * this.squash, tl.x1 - tl.x0), w: tl.w, life: 0.45, max: 0.45 });
          else this.effects.push({ kind: 'bboom', wx: c.x, wy: c.y, fx, r: tl.kind === 'donut' ? tl.r1 * 0.8 : tl.r, spin: (Math.random() - 0.5) * 1.2, life: 0.6, max: 0.6 });
          const sx = this.sx(c), sy = this.sy(c);
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
            this.particles.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * this.squash - 60, life: 0.5 + Math.random() * 0.3, size: 3 + Math.random() * 3, color: `rgb(${fx.col})` });
          }
        }
        // v217: 터진 자리에 그을린 금이 잠깐 남고, 오의는 화면이 하얗게 한 번 뜬다
        if (this.fxLevel > 0 && tl.kind !== 'line') this.effects.push({ kind: 'crack', life: 0.9, max: 0.9, wx: c.x, wy: c.y, r: Math.min(260, r * 0.8), col: fx?.col || '248,113,113', seed: Math.random() * 99, n: tl.ult ? 8 : 5 });
        if (tl.ult) { this.flash = Math.max(this.flash, 0.25); this.shake = Math.max(this.shake, 0.45); }
        if (ev.hit) this.shake = Math.max(this.shake || 0, 0.35);
        break;
      }
      case 'heroDied':
        // 무인이 넘어졌다가 일어난다 (drawHeroUnit)
        this.heroDownT = HERO_DOWN_SEC;
        this.heroDownFx = null;
        this.shake = Math.max(this.shake, 0.3);
        this.flash = Math.max(this.flash, 0.12);
        this.float(ev.boss ? '두목에게 패배…' : '쓰러졌다!', this.w / 2, this.h * 0.42, '#fca5a5', 24, 1.6, true);
        break;
      case 'stageClear':
        this.showBanner(`${ev.stage} 관문 돌파`, '#fef3c7', 1.5, '돌파');
        break;
      case 'cloneHit':
        (this.cloneAtk || (this.cloneAtk = {}))[ev.i] = { t: 0.25, at: ev.at };
        break;
      case 'levelUp':
        // 한꺼번에 여러 레벨이 올라도 빛기둥은 하나 — 겹치면 하얗게 탄다
        if (!this.effects.some((e) => e.kind === 'pillar' && e.life > 0.5)) {
          this.effects.push({ kind: 'pillar', life: 1.2, max: 1.2 });
          // v196: 금빛 고리 두 겹이 발밑에서 퍼지고, 금빛 꽃잎이 몸을 휘감아 오른다 · 화면이 살짝 울린다
          if (this.fxLevel > 0 && game?.heroX != null) {
            this.effects.push({ kind: 'shock', life: 0.7, max: 0.7, wx: game.heroX, wy: game.heroY, r: 120, col: '253,224,71', rings: 2, w: 4 });
            this.effects.push({ kind: 'petals', life: 1.1, max: 1.1, hero: true, r: 70, col: '253,230,138', seeds: seedsN(16), spin: 6, oy: -60 });
            this.heroFlash = Math.max(this.heroFlash || 0, 0.8);
            this.shake = Math.max(this.shake, 0.12);
          }
        }
        this.float(`레벨 ${ev.level}`, this.heroX, this.groundY - 155, '#fde68a', 24, 1.4, true);
        break;
      case 'rankUp':
        this.showBanner(`경지 돌파 · ${RANKS[ev.rank].name}`, '#fde68a', 2.4, '경지');
        this.effects.push({ kind: 'pillar', life: 1.6, max: 1.6 });
        this.flash = 0.8;
        break;
      case 'regress':
        this.effects.push({ kind: 'regress', life: 2.2, max: 2.2 });
        this.hanja = { text: '회귀', life: 2.2, max: 2.2, color: '#f5f5f4' };
        break;
      case 'wave':
        this.showBanner(`${ev.wave + 1}번째 물결`, '#fde68a', 1.2);
        this.shake = Math.max(this.shake, 0.25);
        break;
      case 'skillHits':
        if (ev.hits > AOE_FLOAT_MAX) {
          this.float(`${ev.hits}명 적중`, this.heroX, this.groundY - 190, '#fde68a', 20, 1.1, true);
        }
        break;
      // 연환벽력이 **누구를 거쳐 갔는지**, 발도돌격이 **어디서 어디까지 갔는지**를
      // game이 줄곧 보내고 있었는데 그리는 쪽이 없었다. 번개가 튀는 무공인데
      // 화면에는 숫자만 떴다 — 장판을 안 그리던 것과 같은 경우다.
      case 'skillPath':
        if (ev.path && ev.path.length >= 2) {
          this.paths.push({
            pts: ev.path.map((p2) => ({ x: this.sx(p2), y: this.sy(p2) })),
            kind: ev.kind, life: ev.kind === 'chain' ? 0.3 : 0.22,
            max: ev.kind === 'chain' ? 0.3 : 0.22,
          });
          if (this.paths.length > 6) this.paths.shift();
        }
        break;
      case 'skillArea':
        // 광역기는 발밑에 원형 장판이 퍼진다 (Blade Idle의 FX_Shader_SkillArea_01 문법)
        if (ev.radius) this.effects.push({ kind: 'area', life: 0.55, max: 0.55, r: ev.radius, id: ev.id, job: ev.job, at: ev.at || null });
        break;
      case 'skill':
        if (this.showRange && ev.radius > 0 && ev.at) this.rangeRings.push({ x: ev.at.x, y: ev.at.y, r: ev.radius, life: 0.8, max: 0.8 });
        // v220: 발밑 직업 인장 — 차수가 높을수록 크고 오래(4차는 한 바퀴 더 돈다)
        if (this.fxLevel > 0 && !ev._sealed && game?.heroX != null && JOB_SEAL[game.s?.job]) {
          ev._sealed = true;
          const tr = ev.tier || 1;
          this.effects.push({ kind: 'jobseal', wx: game.heroX, wy: game.heroY, ch: JOB_SEAL[game.s.job], col: CAST_COL[game.s.job], r: 80 + tr * 22, spin: tr >= 4 ? 2.6 : 1.2, life: 0.55 + tr * 0.1, max: 0.55 + tr * 0.1 });
          // v228: 4차 무공은 빛살이 사방으로 뻗고 화면이 울린다
          if (tr >= 4 && !ev.echo) {
            this.effects.push({ kind: 'ultrays', wx: game.heroX, wy: game.heroY, col: CAST_COL[game.s.job], r: 260, life: 0.6, max: 0.6 });
            this.flash = Math.max(this.flash, 0.22);
            this.shake = Math.max(this.shake, 0.3);
          }
        }
        // 연출표가 있는 무공은 결과를 모았다가 draw에서 감독에게 넘긴다
        // 각성한 무공은 ev.fx(예: 'sword:blink')로 연출표를 고른다
        if (ev.fx && CHOREO[ev.fx] && !ev._released) {
          this.pending = { id: ev.id, fx: ev.fx, name: ev.name, job: ev.job || ev.cls, cls: ev.cls, tier: ev.tier || 0,
            at: ev.at || null, radius: ev.radius || 0, dur: ev.dur || 0, motion: ev.motion, hits: [], kills: [], path: null };
        } else this.skillEffect(ev.look || ev.id, ev.job, ev.name);
        break;
      case 'combo': {
        // 연계가 터졌다. 먹은 기운의 빛깔로 글자를 띄운다 —
        // 안 보이면 연계는 없는 것과 같다.
        const q = QI[ev.qi];
        this.showBanner(`連 ${ev.streak}연계 ×${ev.mult.toFixed(1)}`, `rgb(${q?.col || '253,224,71'})`, 0.9);
        this.effects.push({ kind: 'area', life: 0.45, max: 0.45, r: 240, col: q?.col, id: ev.id });
        this.ink(this.heroX, this.groundY - 70, 8, `rgb(${q?.col || '253,224,71'})`, 190);
        this.shake = Math.max(this.shake, 0.22);
        break;
      }
      case 'gold':
        // 취마 〈주기〉 — 무공을 쓸 때마다 은자가 떨어진다. 안 보이면 없는 것과 같다.
        if (ev.fromSkill) for (let i = 0; i < 5; i++) this.ingot(this.heroX + (Math.random() - 0.5) * 70, this.groundY - 120, true);
        break;
      case 'spawn':
        this.monDeath = 0;
        if (ev.isBoss && game.mode === 'stage') this.showBanner(`두목 · ${game.mon?.def?.name || ''}`, '#fca5a5', 1.4);
        break;
      case 'contestStart':
        this.monDeath = 0;
        this.showBanner({ dungeon: '수련터 입장', trial: '심마(마음속의 적)', pvp: '겨루기 시작', raid: '문파 토벌 · 혈마' }[ev.mode] || '', '#fde68a', 1.4);
        break;
      default:
    }
  }

  // 연출 중인 무공의 결과(맞은 숫자·쓰러짐·지나간 길)를 붙든다.
  // 숫자는 연출의 '적중' 박자에 떠야 한다 — 시전 프레임에 바로 뜨면 칼이
  // 닿기도 전에 숫자부터 보인다.
  hold(ev, game) {
    const p = this.pending;
    const where = (a) => (a ? { x: a.x, y: a.y } : game.mon ? { x: game.mon.x, y: game.mon.y } : { x: game.heroX, y: game.heroY });
    if (ev.type === 'dmg' && ev.kind === p.id) {
      p.hits.push({ ...ev, ref: ev.at || game.mon, at: where(ev.at) });
      return true;
    }
    if (ev.type === 'kill') {
      // 주 대상의 쓰러짐은 그리기 상태(monDeath)가 걸려 있어 지금 바로 건다.
      // 붙드는 건 먹물·은자 같은 겉모습뿐이다.
      if (!ev.add) this.monDeath = 1;
      p.kills.push({ ...ev, add: true, ref: ev.at || game.mon, at: where(ev.at) });
      return true;
    }
    if (ev.type === 'skillPath' && ev.id === p.id) { p.path = ev; return true; }
    return false;
  }

  // 연출 하나를 시작한다. 돌던 연출이 있으면 남은 결과를 털고 물러나게 한다.
  startCast(game) {
    const p = this.pending;
    this.pending = null;
    if (this.director) this.director.flush();
    const d = new Director(this, p, game);
    this.director = d;
    // v196 기수식을 또렷하게 — 무공을 펼치기 직전 직업 빛깔의 기운이 몸으로 빨려 들고, 발밑에 고리가 조인다
    if (this.fxLevel > 0 && game?.heroX != null) {
      const col = CAST_COL[game.s?.job] || '255,255,255';
      this.effects.push({ kind: 'motes', life: 0.34, max: 0.34, n: 14, seeds: seedsN(14), r: 100, dx: 0, dy: -62, face: 1, col });
      this.effects.push({ kind: 'shock', life: 0.28, max: 0.28, wx: game.heroX, wy: game.heroY, r: 40, col, w: 2 });
    }
    CHOREO[p.fx](d);
  }

  // 함께 사냥하는 문파원 (v138) — 받은 생김새(lk)로 그리고, 탈것·이름표·체력 막대를 단다
  drawAlly(o) {
    const { ctx } = this;
    const x = this.sx(o), y = this.sy(o);
    if (x < -80 || x > this.w + 80 || y < -40 || y > this.h + 160) return;
    const L = o.lk || {};
    const look = L.look || {};
    const op = { t: this.t + (o.uid.charCodeAt(0) || 0), run: !!o.moving, hold: true, weapon: 'sword', blade: '#e5e7eb', ...(L.opts || {}),
      flip: o.f < 0, lunge: o.lunge > 0 ? Math.sin(o.lunge * Math.PI) : 0, flash: 0 };
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 2, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(165,180,252,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 27, 11, 0, 0, Math.PI * 2); ctx.stroke();
    let fy = y;
    const ride = o.mt || null;
    if (ride) { drawCreature(ctx, ride, x, y, { t: this.t, moving: !!o.moving, flip: o.f < 0, layer: 'back' }); fy = y + saddleY(ride, this.t, !!o.moving); }
    drawFighter(ctx, x, fy, look, { ...op, run: ride ? false : op.run });
    if (ride) drawCreature(ctx, ride, x, y, { t: this.t, moving: !!o.moving, flip: o.f < 0, layer: 'front' });
    // 이름표 · 체력
    const ty = fy - 104;
    ctx.font = `800 12px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = `🤝 ${o.n || '문파원'}${o.lv ? ` Lv.${o.lv}` : ''}`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,8,6,0.85)'; ctx.strokeText(label, x, ty);
    ctx.fillStyle = '#c7d2fe'; ctx.fillText(label, x, ty);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 22, ty + 8, 44, 4);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(x - 22, ty + 8, 44 * Math.max(0, Math.min(1, o.hp ?? 1)), 4);
    ctx.restore();
  }

  // 무인 하나를 아무 자리에나 그린다 (잔상). tint가 있으면 그 빛깔로 물들인다.
  drawHeroAt(ctx, x, y, pose, flip, tint) {
    const g = this.game;
    if (!g) return;
    const { look, opts } = this.heroLook(g, false);
    const o = { ...opts, pose: pose ? { ...pose, alpha: 1 } : null, flip: !!flip, lunge: 0, flash: 0, run: false };
    if (!tint) { drawFighter(ctx, x, y, look, o); return; }
    const W = 180;
    const H = 200;
    const c = this._ghostCv || (this._ghostCv = document.createElement('canvas'));
    if (c.width !== W) { c.width = W; c.height = H; }
    const gx = c.getContext('2d');
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.globalCompositeOperation = 'source-over';
    gx.clearRect(0, 0, W, H);
    drawFighter(gx, W / 2, H - 30, look, o);
    gx.globalCompositeOperation = 'source-atop';
    gx.fillStyle = `rgba(${tint},0.75)`;
    gx.fillRect(0, 0, W, H);
    ctx.drawImage(c, x - W / 2, y - (H - 30));
  }

  // 무인의 생김새와 그리기 옵션 — 본체와 잔상이 같이 쓴다
  heroLook(game, moving) {
    const look = { ...RANKS[game.s.rank].look, ...outfitLook(game.s.outfit) };
    const wg = game.bestGrade('weapon');
    // 장비가 겉모습을 바꾼다 (v114) — 옷 등급은 깃·띠 빛깔, 모자 등급은 머리띠(신화는 금관),
    // 가장 높은 등급은 몸의 기운, 무기 강화·돌파·신화는 칼빛. 십이지왕 신화는 왕마다 다른 기운.
    const gear = this.gearLook(game);
    if (gear.armorRar >= 1) { look.trim = gear.armorCol; if (gear.armorRar >= 2) look.sash = gear.armorCol; }
    // 그림 도포에는 깃 색이 안 드러나서 둘레에 테를 두른다 — 레어 얇게 … 신화 굵고 빛나며 숨 쉰다
    if (gear.armorRar >= 0) {
      look.edge = gear.armorCol;
      look.edgeW = [1, 1.4, 1.8, 2.2][gear.armorRar];
      look.edgeTint = [0, 0.08, 0.14, 0.2][gear.armorRar];
      look.edgeGlow = gear.armorRar >= 2 && this.fxLevel > 0;
      look.edgePulse = gear.armorRar >= 3;
    }
    if (gear.hatRar >= 1) look.band = gear.hatCol;
    if (gear.hatRar >= 3) look.crown = true;
    if (gear.best >= 2 && !look.aura) look.aura = gear.bestCol;
    if (gear.kps.has('formless')) { look.swords = (look.swords || 0) + 3; look.aura = look.aura || '#fde68a'; }
    // 두목 장비의 겉모습 (v116) — 옷은 그 두목의 도포 빛깔, 모자는 그 두목의 쓰개, 무기는 그 두목의 기운 빛
    const B = gear.boss;
    if (B.armor) {
      look.robe = B.armor.look.robe; look.robeTint = B.armor.look.robe;
      if (B.armor.look.trim) look.trim = B.armor.look.trim;
      delete look.outfitBody;
    }
    if (B.hat) {
      const hl = B.hat.look;
      if (['hat', 'hood', 'band', 'mask'].includes(hl.head)) look.head = hl.head;
      look.band = hl.band || hl.trim || look.band;
    }
    if (B.weapon?.look.aura) look.aura = B.weapon.look.aura;
    else if (B.armor?.look.aura) look.aura = B.armor.look.aura;

    const opts = {
      // 무기는 캐릭터를 따른다 (검사 검 · 권마 권갑 · 환마 부채 · 독마 비수)
      t: this.t, lunge: this.heroLunge, flash: this.heroFlash, run: moving, weapon: jobOf(game.s.job)?.look || 'sword', hold: true,
      blade: wg >= 0 ? GRADES[wg].color : '#e5e7eb', glow: wg >= 3, rage: game.buffs.rage > 0,
      // 강화 기운은 캐릭터 빛깔 (검사는 원래대로 붉게)
      rageCol: game.s.job && game.s.job !== 'sword' ? jobOf(game.s.job)?.color : null,
      // 왼쪽으로 갈 때는 몸을 돌린다
      flip: this.fieldMode && (this.faceOverride || game.heroFacing) < 0,
      turn: this.fieldMode ? this.turnTo('hero', (this.faceOverride || game.heroFacing) < 0 ? -1 : 1) : null,
      // 칼빛: +7 반짝임 · 돌파(+11) 불꽃 · 신화 무지개
      bladeFx: this.fxLevel > 0 ? (gear.weaponRar >= 3 ? 'rainbow' : gear.weaponPlus >= 11 ? 'flame' : gear.weaponPlus >= 7 ? 'shimmer' : null) : null,
      bladeCol: gear.weaponCol,
    };
    if (gear.weaponRar >= 2) opts.glow = true;
    if (B.weapon) {
      opts.glow = true; opts.glowCol = B.weapon.col;
      if (!opts.bladeFx && this.fxLevel > 0) opts.bladeFx = 'shimmer';
      if (opts.bladeFx !== 'rainbow') opts.bladeCol = B.weapon.col;
    }
    return { look, opts };
  }

  // 끼고 있는 장비에서 겉모습 재료를 뽑는다 (0.25초마다 한 번 — 매 프레임 훑을 필요는 없다)
  gearLook(game) {
    const e = game.s.equip || {};
    const sig = game.statSig ? game.statSig() : '';
    if (this._gearLook?.sig === sig) return this._gearLook.v;
    const RC = ['#60a5fa', '#c084fc', '#fb923c', '#f43f5e'];
    const rarOf = (it) => (it && it.rar != null ? it.rar : -1);
    let best = -1, power = 0;
    for (const it of Object.values(e)) {
      if (!it) continue;
      best = Math.max(best, rarOf(it));
      power += (rarOf(it) + 1) + (it.plus || 0) / 5;
    }
    // 두목 장비 — 두목 증표로 만든 상급이나 두목이 떨군 것. 끼면 그 두목의 겉모습이 든다.
    const bossOf = (it) => {
      if (!it || (it.king == null && (it.step == null || !(it.step % 2 === 1 || it.boss)))) return null;
      const z = (it.set && setOf(it.set)?.king) || itemZone(it);      // 세트는 그 세트 결의 왕, 왕의 장비는 그 왕의 겉모습
      const b = ZONES_W[z]?.boss;
      return b?.look ? { z, look: b.look, col: b.look.aura || b.look.trim || '#fde68a' } : null;
    };
    const bz = {};
    for (const k of ['weapon', 'armor', 'hat', 'acc', 'finger', 'ear']) bz[k] = bossOf(e[k]);
    const set = bz.weapon && bz.armor && bz.hat && bz.weapon.z === bz.armor.z && bz.armor.z === bz.hat.z ? bz.weapon : null;
    const v = {
      boss: bz, set,
      weaponRar: rarOf(e.weapon), weaponPlus: e.weapon?.plus || 0, weaponCol: RC[rarOf(e.weapon)] || '#e5e7eb',
      armorRar: rarOf(e.armor), armorCol: RC[rarOf(e.armor)],
      hatRar: rarOf(e.hat), hatCol: RC[rarOf(e.hat)],
      best, bestCol: RC[best],
      // 발밑 고리 단계 0~5 — 장비 여섯 칸의 등급·강화를 합친 세기
      tier: Math.max(set ? 3 : 0, Math.min(5, Math.floor(power / 5))),
      kps: game.passives ? game.passives() : new Set(),
    };
    if (set) { v.bestCol = set.col; v.setLook = set.col; }
    // 장신구·가락지·귀걸이는 그 두목 빛깔의 구슬이 몸을 돈다
    v.gems = ['acc', 'finger', 'ear'].map((k) => bz[k]?.col).filter(Boolean);    // 한 두목의 무기·옷·모자를 다 끼면 발밑 고리도 그 두목 빛깔
    this._gearLook = { sig, v };
    return v;
  }

  // 카메라 — 평소엔 무인에 붙고, 순간이동하면 잠깐 머물렀다 쫓아간다
  updateCamera(game, dt) {
    if (this.overview) {
      // 가로는 늘 지도 가운데. 세로는 지도 가운데 — 창이 열려 위쪽만 남으면 무인을 따라간다.
      let tx = game.mapW / 2;
      let ty = this.sheetOpen ? Math.max(game.mapH * 0.18, Math.min(game.mapH * 0.82, game.heroY)) : game.mapH / 2;
      if ((this.camLevel ?? 1) > 0) ({ tx, ty } = this.followCam(game));
      // 맵을 옮기면(무인이 멀리 뛰면) 카메라도 바로 붙는다
      const jump = this._ovx == null ? 0 : Math.hypot(game.heroX - this._ovx, game.heroY - this._ovy);
      this._ovx = game.heroX; this._ovy = game.heroY;
      if (this.camY == null || this.camX == null || jump > 300) { this.camX = tx; this.camY = ty; }
      const k = Math.min(1, dt * 6);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
      this.camFocus = null; this.camHold = 0; this.camPan = false;
      return;
    }
    const field = this.fieldMode;
    const jump = this._hx == null ? 0 : Math.hypot(game.heroX - this._hx, game.heroY - this._hy);
    // v172: 걷는 쪽을 조금 앞서 본다 — 빠르기(px/초)의 0.22초어치, 70까지. 부드럽게 바뀐다.
    if (this._hx != null && dt > 0 && jump < 40) {
      const vx = (game.heroX - this._hx) / dt, vy = (game.heroY - this._hy) / dt;
      const lk = 1 - Math.exp(-dt * 3);
      const cap = (v) => Math.max(-70, Math.min(70, v * 0.22));
      this._leadX = (this._leadX || 0) + (cap(vx) - (this._leadX || 0)) * lk;
      this._leadY = (this._leadY || 0) + (cap(vy) * 0.6 - (this._leadY || 0)) * lk;
    }
    this._hx = game.heroX;
    this._hy = game.heroY;
    if (!field || this.camX == null) {
      this.camX = game.heroX; this.camY = game.heroY; this.camPan = false; this.camHold = 0; this.camFocus = null;
      return;
    }
    // 순간이동 거리만큼만 따라간다. 관문이 바뀌어 들판이 새로 깔리는 것처럼
    // 아주 멀리 뛰면 미끄러지는 게 아니라 바로 붙는다.
    if (jump > 900) { this.camX = game.heroX; this.camY = game.heroY; this.camPan = false; this.camFocus = null; return; }
    if (jump > 40) this.camPan = true;
    if (this.camHold > 0) { this.camHold -= dt; return; }
    const f = this.camFocus;
    // 늘 붙어 다니지 않고 살짝 늦게 따라온다(0.15초쯤) — 무인이 화면 안에서 조금씩 움직여 보여 걷는 맛이 난다
    if (!this.camPan && !f) {
      const k0 = 1 - Math.exp(-dt * 7);
      this.camX += (game.heroX + (this._leadX || 0) - this.camX) * k0;
      this.camY += (game.heroY + (this._leadY || 0) - this.camY) * k0;
      return;
    }
    const tx = f ? f.x : game.heroX + (this._leadX || 0);
    const ty = f ? f.y : game.heroY + (this._leadY || 0);
    const k = 1 - Math.exp(-dt * this.camRate);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    if (!f && Math.hypot(game.heroX + (this._leadX || 0) - this.camX, game.heroY + (this._leadY || 0) - this.camY) < 2) {
      this.camPan = false;
      this.camRate = 10;
    }
  }

  // 무인만 빼고 화면을 먹빛으로 바랜다. 높음은 진짜 흑백, 보통은 어둡게만.
  applyDesat() {
    if (this.desat <= 0.01) return;
    const { ctx } = this;
    ctx.save();
    if (this.fxLevel >= 2) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = this.desat;
      ctx.fillStyle = '#808080';
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(12,10,8,${0.32 * this.desat})`;
    ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    ctx.restore();
  }

  // 화면이 한 줄을 따라 갈라졌다가 다시 붙는다 (천하제일검). 높음에서만.
  drawSlice(dt) {
    const sl = this.slice;
    if (!sl) return;
    sl.life -= dt;
    if (sl.life <= 0) { this.slice = null; return; }
    const p = 1 - sl.life / sl.max;
    // 확 벌어졌다가 천천히 붙는다
    const open = p < 0.15 ? p / 0.15 : 1 - ((p - 0.15) / 0.85) ** 0.7;
    const off = sl.gap * open;
    const { ctx } = this;
    const cv = this.drawCv;
    const snap = this._snap || (this._snap = document.createElement('canvas'));
    if (snap.width !== cv.width || snap.height !== cv.height) { snap.width = cv.width; snap.height = cv.height; }
    const sc = snap.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.globalCompositeOperation = 'copy';
    sc.drawImage(cv, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = cv.width;
    const H = cv.height;
    const cx = W / 2;
    const cy = H * 0.42;
    const ux = Math.cos(sl.a);
    const uy = Math.sin(sl.a);
    const nx = -uy;
    const ny = ux;
    const R = W + H;
    // 틈은 먹빛
    ctx.fillStyle = '#0a0806';
    ctx.fillRect(0, 0, W, H);
    for (const side of [1, -1]) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx - ux * R, cy - uy * R);
      ctx.lineTo(cx + ux * R, cy + uy * R);
      ctx.lineTo(cx + ux * R + nx * R * side, cy + uy * R + ny * R * side);
      ctx.lineTo(cx - ux * R + nx * R * side, cy - uy * R + ny * R * side);
      ctx.closePath();
      ctx.clip();
      // 갈린 두 쪽이 줄을 따라 서로 어긋나며 벌어진다
      const d = off * this.dpr;
      ctx.drawImage(snap, nx * d * side + ux * d * 0.6 * side, ny * d * side + uy * d * 0.6 * side);
      ctx.restore();
    }
    // 갈라진 줄 자체가 빛난다
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * open})`;
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath(); ctx.moveTo(cx - ux * R, cy - uy * R); ctx.lineTo(cx + ux * R, cy + uy * R); ctx.stroke();
    ctx.restore();
  }

  // id는 그림 열쇠(옛 무공 id — 각성한 무공은 옛 전용 무공의 그림을 그대로 쓴다)
  skillEffect(id, job = null, name = null) {
    const add = (kind, life, extra = {}) => this.effects.push({ kind, life, max: life, ...extra });
    // ---- 문파 기운 ----
    // 전직을 하면 **쓰는 모든 무공**에 그 문파 빛깔의 기운이 한 겹 더 실린다.
    // 전에는 전용 무공 하나만 달라 보여서, 전직을 해도 들판이 그대로였다.
    const tr = job ? JOB_TRAITS[job] : null;
    if (tr) {
      add(tr.fx === 'slash' ? 'burst' : tr.fx === 'pierce' ? 'beam' : tr.fx === 'field' ? 'area'
        : tr.fx === 'swirl' ? 'swirl' : tr.fx === 'aura' ? 'aura' : 'burst',
        0.5, { col: tr.col, job, r: 180, a: 0, big: true });
      this.ink(this.heroX, this.groundY - 60, 6, `rgb(${tr.col})`, 150);
    }
    // sk.hz는 한자를 뺄 때 사라진 필드다. 무공 이름을 쓴다.
    // 이름은 화면 왼쪽에 세로로 — 가운데에 크게 쓰면 맞은 자리와 숫자를 가린다
    if (name) this.hanja = { text: name, life: 1, max: 1, vertical: true, color: tr ? `rgb(${tr.col})` : id === 'rage' ? '#fca5a5' : id === 'frost' ? '#bae6fd' : '#fef3c7' };
    if (id === 'slash') for (let i = 0; i < 3; i++) this.projectiles.push({ kind: 'wave', x: this.heroX + 20, y: this.groundY - 50 - i * 18, life: 0.35 + i * 0.07, max: 0.35 + i * 0.07 });
    if (id === 'slash') this.shake = 0.18;
    if (id === 'thunder') { add('thunder', 0.45); this.shake = 0.4; this.flash = 0.5; }
    if (id === 'frost') add('frost', 0.7);
    if (id === 'frost' || id === 'jring' || id === 'jsword') add('burst', 0.34, { big: true });
    // 그림이 없으면 아무 일도 안 일어난다 — putFx가 false를 돌려주고 끝난다
    if (id === 'chain') { add('thunder', 0.4); this.shake = 0.3; }
    if (id === 'pierce' || id === 'jblade') add('beam', 0.3, { a: 0, col: id === 'jblade' ? '252,165,165' : '186,230,253' });
    if (id === 'blink' || id === 'dash' || id === 'jsword') add('blink', 0.3);
    if (id === 'rage') add('aura', 0.9, { col: '252,165,165' });
    if (id === 'gale') add('aura', 0.9, { col: '147,197,253' });
    if (id === 'midas') add('aura', 0.9, { col: '253,224,71' });
    if (id === 'tornado' || id === 'jdrunk') add('swirl', 0.9);
    if (id === 'meteor') add('swords', 1.1, { seeds: Array.from({ length: 22 }, () => [Math.random(), Math.random()]) });
    if (id === 'heal') add('qi', 1, { color: '134,239,172' });
    if (id === 'midas') for (let i = 0; i < 16; i++) this.ingot(this.heroX + (Math.random() - 0.5) * 60, this.groundY - 140, true);
    if (id === 'meteor') this.shake = 0.6;
    if (id === 'gale') add('gale', 0.8);
  }

  showBanner(text, color, life = 1.4, seal = null) { this.banner = { text, color, life, max: life, seal }; }

  // 평타 한 대 — 다음 연타 자세로 휘두르고, 무기 끝이 지나간 자리에 궤적을 남긴다.
  // 공격이 빨라지면 동작도 짧아진다(초당 6대면 한 동작이 0.13초). 초식 연출 중이면 몸은 안 건드린다.
  meleeSwing(game, cls) {
    const combo = MELEE_COMBO[cls] || MELEE_COMBO.sword;
    this.comboIx = ((this.comboIx || 0) + 1) % combo.length;
    const [pose, tilt, dir] = combo[this.comboIx];
    const spd = Math.max(1, game.stats?.({ buffs: true })?.speed || 1);
    const span = Math.max(0.12, Math.min(0.32, 0.8 / spd));
    if (!this.director && this.fxLevel > 0) {
      this.heroAnim.play([[span * 0.22, pose, 'snap']], span * 0.78);
    }
    // v234: 맞은 숫자·움찔·번쩍은 칼(주먹)이 닿는 순간에 — 전엔 휘두르기 시작과 동시에 떠서 반 박자 빨랐다
    if (!this.director) this.shotDelay = Math.max(this.shotDelay || 0, span * 0.22 + 0.02);
    if (this.fxLevel <= 0) return;
    const face = (this.faceOverride || game.heroFacing) < 0 ? -1 : 1;
    // v209 마무리 한 방 — 연속 평타의 마지막은 더 깊이 내딛고, 아주 짧게 멎었다(히트스톱) 화면이 살짝 울리며 과녁에 고리가 터진다.
    // 가볍게·가볍게·묵직하게 — 박자가 생긴다.
    const fin = this.comboIx === combo.length - 1;
    if (fin) {
      this.heroLunge = 1.6;
      this.hitstop = Math.max(this.hitstop || 0, 0.06);
      this.shake = Math.max(this.shake, 0.08);
      const t = game.mon;
      if (t) this.effects.push({ kind: 'shock', life: 0.28, max: 0.28, wx: t.x, wy: t.y, r: 46, col: CUT_COL[cls] || '255,255,255', rings: 1, w: 3 });
    }
    // 권마 — 베는 궤적 대신 주먹이 닿는 자리에 터지는 충격 (정권·훅·올려치기마다 방향이 다르다)
    if (cls === 'fist') {
      const t = game.mon;
      if (t) this.effects.push({ kind: 'punch', life: 0.2, max: 0.2, wx: t.x, wy: t.y, face, tilt, big: this.comboIx === 2 });
      return;
    }
    this.effects.push({ kind: 'swing', life: fin ? 0.22 : 0.16, max: fin ? 0.22 : 0.16, face, tilt, dir, cls, big: fin,
      ang: game.heroAngle || 0, col: CUT_COL[cls] || (cls === 'fist' ? '253,186,116' : '255,255,255') });
  }

  float(text, x, y, color, size = 18, life = 1, brush = false) {
    // 튀어 올랐다가 멈추며 옅어진다(처음이 빠르고 점점 느리게). 옆으로 살짝 흩어진다.
    this.floats.push({ text, x, y, color, size, life, max: life, brush, vy: -150, vx: (Math.random() - 0.5) * 40 });
    if (this.floats.length > 40) this.floats.shift();
  }

  ink(x, y, n, color, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.8, color, size: 3 + Math.random() * 6, drop: true });
    }
  }

  ingot(x, y, rain = false) {
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * (rain ? 120 : 220), vy: rain ? Math.random() * 60 : -200 - Math.random() * 160,
      life: 1, color: '#e5e7eb', size: 8, ingot: true,
    });
  }

  draw(game, dt) {
    const rawDt = dt;
    this.game = game;
    // 연출표 — 시각표는 실제 시간으로 간다 (히트스톱이 걸려도 박자가 밀리지 않게)
    if (this.pending) this.startCast(game);
    this.shotDelay = 0;
    if (this.later.length) {
      const due = [];
      for (const l of this.later) { l.t -= rawDt; if (l.t <= 0) due.push(l); }
      this.later = this.later.filter((l) => l.t > 0);
      for (const l of due) this.handle({ ...l.ev, _released: true }, game);
    }
    if (this.director) {
      this.director.tick(rawDt);
      if (this.director.done) { this.director = null; this.beat = ''; }
    }
    this.heroAnim.tick(rawDt);
    this.setZoom(this.overview ? this.fitZoom(game) : 1);
    UIK = 1 / (this.zoom || 1);
    this.updateCamera(game, rawDt);
    if (this.desat !== this.desatTo) {
      const step = rawDt * this.desatRate;
      this.desat = this.desat < this.desatTo ? Math.min(this.desatTo, this.desat + step) : Math.max(this.desatTo, this.desat - step);
    }
    // 히트스톱: 맞은 직후 아주 짧게 연출만 느려진다(게임 진행은 그대로)
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      dt *= 0.18;
    }
    this.game = game;
    this.t += dt;
    const { ctx } = this;
    const decay = (v, k) => Math.max(0, v - dt * k);
    this._lastDt = dt;
    this.monKnock = decay(this.monKnock, 55);
    this.heroLunge = decay(this.heroLunge, 6);
    // 시트가 열리면 무인을 위로(0.32), 닫히면 가운데(0.47)로 — 0.25초쯤에 걸쳐 옮긴다
    {
      // 물린 카메라: 지도(머리 몫 위로 120, 발 몫 아래로 10)의 가운데가 들판 자리 가운데에 오게
      const fit = this.overview && !this.sheetOpen
        ? (((this.padTop || 0) + this.H - (this.padBottom ?? 130)) / 2 / this.zoom + 55) / this.h : null;
      const want = fit ?? (this.sheetOpen ? 0.32 : 0.47);
      const a0 = this.anchor ?? 0.47;
      this.sheetK = (this.sheetK || 0) + ((this.sheetOpen ? 1 : 0) - (this.sheetK || 0)) * Math.min(1, dt * 8);
      this.anchor = Math.abs(want - a0) < 0.002 ? want : a0 + (want - a0) * Math.min(1, dt * 9);
    }
    this.monLunge = decay(this.monLunge, 5);
    this.monShake = decay(this.monShake, 7);
    this.monFlash = decay(this.monFlash, 12);
    this.heroFlash = decay(this.heroFlash, 6);
    this.heroRecoil = decay(this.heroRecoil || 0, 7);
    // v233: 흔들림은 짧고 굵게 — 곱으로 빨리 줄고(반감 ~0.12초) 끝은 직선으로 끊는다.
    // 전에는 1초에 1씩 직선으로만 줄어, 평범한 사냥 중에도 화면의 3분의 1이 흔들리고 있었다.
    this.shake = Math.max(0, this.shake * Math.exp(-5.5 * dt) - dt * 0.6);
    // 계속 흔들리면 무뎌진다(피로) — 1.5초 동안 흔들린 몫만큼 세기를 반까지 줄인다
    this.shakeTire = (this.shakeTire || 0) + ((this.shake > 0.05 ? 1 : 0) - (this.shakeTire || 0)) * Math.min(1, dt / 1.5);
    this.flash = decay(this.flash, 2);
    const moving = this.fieldMode ? !!game.walking : (!game.mon?.alive && game.mode === 'stage');
    // 달릴 때 발밑에서 흙먼지가 인다 — 뒤로 흩어지며 옅어진다
    if (moving && this.fieldMode && this.fxLevel > 0 && !this.director) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) {
        // v223: 탈것을 타면 흙먼지가 더 잦고 크다 · 높은 탈것은 제 빛깔의 자취를 남긴다
        const mt = game.mountNow?.();
        const tier = mt?.tier || 0;
        this.dustT = mt ? Math.max(0.05, 0.09 - tier * 0.003) : 0.11;
        const face = (this.faceOverride || game.heroFacing) < 0 ? -1 : 1;
        const big = mt ? 1.4 : 1;
        this.particles.push({ x: this.heroX - face * (6 + Math.random() * 10) * big, y: this.groundY - 2,
          vx: -face * (50 + Math.random() * 40) * big, vy: -18 - Math.random() * 20, life: 0.45 * big, size: (4 + Math.random() * 3) * big,
          color: 'rgb(214,196,160)', dust: true });
        const tc = mt && (MOUNT_TRAIL[mt.id] || (mt.zodiac ? '253,224,71' : tier >= 6 ? '226,232,240' : null));
        if (tc) {
          // 뒤로 흘러가는 빛 알갱이 — 몸 높이 여기저기서
          this.particles.push({ x: this.heroX - face * (20 + Math.random() * 16), y: this.groundY - 20 - Math.random() * 50,
            vx: -face * (140 + tier * 8 + Math.random() * 60), vy: (Math.random() - 0.5) * 20, life: 0.3 + Math.random() * 0.15, size: 1.6 + Math.random() * 1.8,
            color: `rgb(${tc})` });
        }
      }
    }
    // 들판에서는 카메라가 움직인 만큼 배경이 흐른다
    if (this.fieldMode) this.scroll = this.camX;
    else this.scroll += dt * (moving ? 220 : 12);

    ctx.save();
    // 매 프레임 마구잡이로 튀던 것을 물결로 — 같은 세기라도 덜 어지럽고 '쿵' 하는 맛이 남는다
    if (this.shake > 0) {
      const a = 12 * this.shake * (1 - 0.5 * (this.shakeTire || 0)) * (this.shakePref ?? 1);
      ctx.translate(Math.sin(this.t * 61) * a * 0.6 + Math.sin(this.t * 37) * a * 0.4, Math.cos(this.t * 53) * a * 0.6 + Math.sin(this.t * 29) * a * 0.3);
    }
    const scene = this.scene(game);
    this.drawBackground(scene);
    this.drawLowObstacles(game);  // 물·용암 (v127)
    this.drawQueue(game);
    this.drawFields(game);        // 바닥 장판은 사람보다 아래에
    this.drawTells(game);         // 탑 수문장의 바닥 경고 (v126)
    this.drawRanges(game, dt);    // 무공 범위 (v157)
    this.drawUnits(game, dt, moving);
    this.drawProjectiles(dt);
    this.drawEffects(dt, game);
    this.drawPaths(dt);
    this.drawSparks(dt);
    this.drawParticles(dt);
    this.drawWeather(scene, dt);
    if (this.fadeIn > 0) {
      this.fadeIn = Math.max(0, this.fadeIn - rawDt);
      ctx.fillStyle = `rgba(8,6,4,${(this.fadeIn / 0.45) ** 1.5 * 0.92})`;
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,251,235,${this.flash * 0.5})`;
      ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    }
    // 글자는 진짜 크기로 — 줄여 찍으면 숫자·띠가 깨알만 해진다
    const z = this.zoom || 1;
    ctx.save();
    ctx.scale(1 / z, 1 / z);
    const vw = this.w, vh = this.h;
    this.w = this.W; this.h = this.H;
    try {
      this.drawAmbient(this.game);
      this.drawFloats(dt, z);
      this.drawHanja(dt);
      this.drawBanner(dt);
      this.drawKingIntro(dt, z);
      this.drawDownVignette();
    } finally { this.w = vw; this.h = vh; }
    ctx.restore();
    ctx.restore();
    if (this.slice) this.drawSlice(rawDt);
    if (this.soft) {
      const o = this.outCtx;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.drawImage(this.soft, 0, 0);
    }
  }

  scene(game) {
    if (game.sceneKey && SPECIAL_INK[game.sceneKey]) return SPECIAL_INK[game.sceneKey];   // 던전 (v126)
    const key = game.mode === 'dungeon' ? game.contest.id : game.mode;
    return SPECIAL_INK[key] || zoneOf(game.s.stage);
  }

  // ---------- 수묵 배경 ----------
  // ---------- 바닥 (위에서 내려다본 평면) ----------
  drawBackground(z) {
    const { ctx, w, h } = this;
    const g = this.game;
    const [far, mid, edge, ground] = z.ink;
    const camX = g ? this.camX ?? g.heroX : 0;
    const camY = g ? this.camY ?? g.heroY : 0;

    // 바닥 — 바닥색이 섞여 구워진 타일 한 장으로 덮는다.
    //
    // **화면을 몇 겹 칠하느냐가 폰에서 전부다.** 390x844 dpr3이면 한 겹이
    // 300만 화소다. 전에는 바닥색 한 겹 + 타일 3.5겹 = 4.5겹이었다.
    // 바닥색을 타일에 섞고(fx.js), 밀어야 할 만큼은 **패턴 자체를 밀어서**
    // 화면 밖을 안 칠한다 — 한 겹으로 끝난다.
    // v182: 바닥 타일도 소품 장에 **같이 구워** 한 장으로 붙인다 — 화면을 덮는 칠이 세 겹에서 두 겹으로.
    // (바닥을 캔버스 뒤 DOM 층으로 빼 보았으나, 칼빛·불꽃의 '더하기' 빛이 바닥과 섞이지 않아 흐려졌다)
    const pat = zoneTile(ctx, z.idx ?? 0, ground);
    this.ensureDecor(z, camX, camY * this.squash, pat, ground);
    if (this._decor) { /* 바닥은 구운 장에 있다 */ } else if (!pat) {
      ctx.fillStyle = ground;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    } else {
      const tx = -(((camX % 512) + 512) % 512);
      const ty = -(((((camY * this.squash) % 512) + 512) % 512));
      if (pat.setTransform) {
        pat.setTransform(new DOMMatrix([1, 0, 0, 1, tx, ty]));
        ctx.fillStyle = pat;
        ctx.fillRect(-20, -20, w + 40, h + 40);
      } else {
        // 아주 옛 브라우저 — 밀고 그만큼 더 칠한다
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = pat;
        ctx.fillRect(-20, -20, w + 552, h + 552);
        ctx.restore();
      }
    }

    // 땅 얼룩·소품은 **미리 구워 둔 한 장**으로 깐다.
    // 전에는 매 프레임 타원을 300개 가까이 다시 그렸다(얼룩 3겹 + 소품).
    // 둘 다 월드 격자에 박혀 있어서 카메라와 같이 흐를 뿐 모양은 안 변한다 —
    // 한 번 구워 두고 밀어서 그리면 된다.
    this.putDecor(z, camX, camY * this.squash);

    // 관문 한가운데 문양 — 이 자리에서 싸움이 시작된다
    const cx = this.heroX - camX;
    const cy = this.groundY - camY * this.squash;
    if (this.overview) this.drawGrid(z);
    else if (cx > -260 && cx < w + 260 && cy > -200 && cy < h + 200) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, this.squash);
      ctx.strokeStyle = hexA(z.sun || '#d6c7a1', 0.17);
      ctx.lineWidth = 2;
      for (const r of [104, 80, 46]) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.lineWidth = 1;
      ctx.strokeStyle = hexA(z.sun || '#d6c7a1', 0.1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
        ctx.lineTo(Math.cos(a) * 104, Math.sin(a) * 104);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 가장자리 어둠은 가벼운 모드에서도 남긴다. 구워 둔 한 장을 붙이는
    // 것뿐이라 아껴 봐야 얼마 안 되는데, 빼면 분위기가 확 달라진다.
    this.putVignette(z);
  }

  // 칸 지도 — 옅은 칸 줄과 지도 밖 어둠. 사냥터 끝이 어디인지, 한 칸이 얼마인지 보인다.
  drawGrid(z) {
    const { ctx } = this;
    const g = this.game;
    const T = g.tile || 64;
    const x0 = this.sx({ x: 0 }), x1 = this.sx({ x: g.mapW });
    const y0 = this.sy({ y: 0 }), y1 = this.sy({ y: g.mapH });
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(20,14,8,0.16)';
    ctx.beginPath();
    for (let x = x0 + T; x < x1 - 1; x += T) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = y0 + T * this.squash; y < y1 - 1; y += T * this.squash) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,230,0.07)';
    ctx.translate(1, 1);
    ctx.stroke();
    ctx.restore();
    // 지도 밖은 먹빛으로 덮는다
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,4,0.62)';
    ctx.beginPath();
    ctx.rect(-40, -40, this.w + 80, this.h + 80);
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.fill('evenodd');
    ctx.strokeStyle = hexA(z.sun || '#d6c7a1', 0.35);
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }

  // 얼룩·소품 한 장. 카메라가 가장자리(M)를 넘어갈 때만 다시 굽는다.
  ensureDecor(z, ox, oy, pat, ground) {
    const { w, h } = this;
    const M = 220;
    const d = this._decor;
    const stale = !d || d.w !== w || d.h !== h || d.z !== z || d.gen !== decalGen || d.pat !== pat || d.zm !== (this.zoom || 1)
      || Math.abs(ox - d.ox) > M || Math.abs(oy - d.oy) > M;
    if (stale) this.bakeDecor(z, ox, oy, M, pat, ground);
  }
  putDecor(z, ox, oy) {
    const { ctx, w, h } = this;
    const M = this._decor.M;
    const k = this._decor;
    // 구워 둔 장은 (화면+440)x(화면+440)이다 — 통째로 그리면 폰에서 화면의
    // 3배가 넘는다. **보이는 조각만** 떠서 그린다.
    const dx = -M - (ox - k.ox);
    const dy = -M - (oy - k.oy);
    const lw = k.cv.width / k.q;
    const lh = k.cv.height / k.q;
    const sx = Math.max(0, -20 - dx);
    const sy = Math.max(0, -20 - dy);
    const sw = Math.min(lw, w + 20 - dx) - sx;
    const sh = Math.min(lh, h + 20 - dy) - sy;
    if (sw > 0 && sh > 0) {
      ctx.drawImage(k.cv, sx * k.q, sy * k.q, sw * k.q, sh * k.q, dx + sx, dy + sy, sw, sh);
    }
  }

  bakeDecor(z, ox, oy, M, pat, ground) {
    const { w, h } = this;
    const q = (this.dpr || 1) * (this.zoom || 1);
    // 다시 구울 때 같은 캔버스를 쓰면 층에서 한 번 깜빡일 수 있다 — 크기가 같으면 그대로 덮어 그린다
    const old = this._decor;
    const cv = old?.cv || document.createElement('canvas');
    const W2 = Math.ceil((w + M * 2) * q), H2 = Math.ceil((h + M * 2) * q);
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
    const x = cv.getContext('2d');
    x.setTransform(q, 0, 0, q, 0, 0);
    // 바닥(v182): 타일까지 같이 굽는다 — 월드에 붙은 무늬라 (ox - M, oy - M)부터 이어진다
    if (pat) {
      const tx = -((((ox - M) % 512) + 512) % 512), ty = -((((oy - M) % 512) + 512) % 512);
      if (pat.setTransform) pat.setTransform(new DOMMatrix([1, 0, 0, 1, tx, ty]));
      x.fillStyle = pat;
    } else x.fillStyle = ground || '#000';
    x.fillRect(0, 0, w + M * 2, h + M * 2);
    this.decorInto(x, z, ox, oy, M);
    this._decor = { cv, q, w, h, z, ox, oy, M, gen: decalGen, pat, zm: this.zoom || 1 };
  }

  // 구워 넣는 실제 그림. (ox, oy)를 기준으로 (M, M)만큼 밀어서 그린다.
  decorInto(ctx, z, camX, camY, M) {
    const w = this.w + M * 2;
    const h = this.h + M * 2;
    const [far, mid, edge] = z.ink;
    const heroX = this.heroX + M;
    const groundY = this.groundY + M;
    const blot = (cell, alpha, rx, ry, color) => {
      const soft = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      soft.addColorStop(0, hexA(color, alpha * 0.8));
      soft.addColorStop(0.55, hexA(color, alpha * 0.45));
      soft.addColorStop(1, hexA(color, 0));
      const ox = camX, oy = camY;
      // 보이는 칸만 돈다. 전에는 ox를 중심으로 ±w를 돌았는데, 실제로 보이는
      // 구간은 (ox - heroX) 쪽이라 **중심이 어긋난 채 두 배를 돌고** 있었다.
      const b = ox - heroX;
      const i0 = Math.floor((b - cell) / cell), i1 = Math.ceil((b + w) / cell);
      const c2 = oy - groundY;
      const j0 = Math.floor((c2 - cell) / cell), j1 = Math.ceil((c2 + h) / cell);
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const n = rnd2(i, j);
          if (n > 0.62) continue;
          const px = heroX + (i * cell + (n * 897 % cell)) - ox;
          const py = groundY + (j * cell + (n * 613 % cell)) - oy;
          if (px < -rx * 2 || px > w + rx * 2 || py < -ry * 2 || py > h + ry * 2) continue;
          // 가장자리를 번지게 — 단색 타원은 바닥 그림 위에서 흰 구멍처럼 보였다
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(n * 3);
          ctx.scale(rx * (0.6 + n), ry * (0.6 + n));
          ctx.fillStyle = soft;
          ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    };
    blot(260, 0.35, 90, 58, mid);
    blot(150, 0.22, 44, 28, far);
    blot(95, 0.3, 16, 10, edge);
    this.scatterInto(ctx, z, camX, camY, heroX, groundY, w, h);
  }

  // 가장자리 어둠. 매 프레임 radialGradient를 만들어 화면 전체를 칠하고 있었다 —
  // 화소마다 그라디언트를 계산하는 가장 비싼 연산이다. 한 번 구워서 깐다.
  putVignette(z) {
    const { ctx, w, h } = this;
    const night = !!z.night;
    let v = this._vig;
    if (!v || v.w !== w || v.h !== h || v.night !== night) {
      // 부드러운 번짐이라 1/3로 구워도 눈에 차이가 없다
      const s = 3;
      const cv = document.createElement('canvas');
      cv.width = Math.max(2, Math.ceil(w / s));
      cv.height = Math.max(2, Math.ceil(h / s));
      const x = cv.getContext('2d');
      const g2 = x.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * 0.34,
        cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.78);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(1, night ? 'rgba(0,0,0,0.62)' : 'rgba(10,8,6,0.4)');
      x.fillStyle = g2;
      x.fillRect(0, 0, cv.width, cv.height);
      v = this._vig = { cv, w, h, night };
    }
    ctx.drawImage(v.cv, -20, -20, w + 40, h + 40);
  }

  // 바닥 소품: 지역에 따라 대나무·바위·눈더미 등이 격자 위에 고정돼 있다
  // 바닥 소품. 얼룩과 같이 한 장에 구워지므로 ctx와 기준점을 받는다.
  scatterInto(ctx, z, camX, camY, heroX, groundY, w, h) {
    const cell = 170;
    const ox = camX, oy = camY;
    const b = ox - heroX, c2 = oy - groundY;
    const i0 = Math.floor((b - cell) / cell), i1 = Math.ceil((b + w) / cell);
    const j0 = Math.floor((c2 - cell) / cell), j1 = Math.ceil((c2 + h) / cell);
    const ink = z.night ? 'rgba(6,6,9,0.8)' : 'rgba(22,20,16,0.72)';
    const pic = decalImg(z.prop);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const n = rnd2(i * 3 + 11, j * 7 + 5);
        if (n > 0.42) continue;
        const px = heroX + (i * cell + (n * 1301 % cell)) - ox;
        const py = groundY + (j * cell + (n * 787 % cell)) - oy;
        if (px < -60 || px > w + 60 || py < -60 || py > h + 60) continue;
        ctx.save();
        ctx.translate(px, py);
        const sc = 0.7 + n;
        if (pic) {
          // 그린 소품 — 반은 좌우를 뒤집고 크기를 달리해 덜 되풀이돼 보이게
          const W = 38 * sc, H = (pic.height * W) / pic.width;
          ctx.globalAlpha = z.night ? 0.8 : 0.92;
          if (n * 1000 % 2 < 1) ctx.scale(-1, 1);
          ctx.drawImage(pic, -W / 2, -H * 0.6, W, H);
          ctx.globalAlpha = 1;
          ctx.restore();
          continue;
        }
        // 그림자 먼저 (위에서 보면 소품 아래로 깔린다)
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.beginPath(); ctx.ellipse(0, 2, 16 * sc, 9 * sc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ink;
        this.propShape(ctx, z, sc, n, ink);
        ctx.restore();
      }
    }
  }

  // 자리마다 다른 소품을 그린다.
  //
  // **열여섯 자리인데 대나무와 눈만 따로 그려지고 나머지 열넷은 전부 같은
  // 돌멩이였다.** 바닥 그림은 달라도 위에 깔린 건 똑같아서, 새 자리에 와도
  // 어딘가 본 데 같았다. 한 줄짜리 모양이라도 자리마다 달라야 한다.
  propShape(ctx, z, sc, n, ink) {
    const blob = (rx, ry, rot, col) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(0, 0, rx * sc, ry * sc, rot, 0, Math.PI * 2); ctx.fill();
    };
    const bar = (w2, h2, col, dx = 0, dy = 0, rot = 0) => {
      ctx.save(); ctx.translate(dx * sc, dy * sc); ctx.rotate(rot);
      ctx.fillStyle = col;
      ctx.fillRect(-w2 * sc / 2, -h2 * sc / 2, w2 * sc, h2 * sc);
      ctx.restore();
    };
    switch (z.prop) {
      case 'bamboo':   // 대나무 — 가는 줄기 셋
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = hexA('#3f6212', 0.75);
          ctx.beginPath();
          ctx.ellipse((k - 1) * 9 * sc, -2, 3 * sc, 13 * sc, (k - 1) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'dock':     // 부두 — 널빤지 두 장
        bar(26, 6, hexA('#5c4631', 0.9), 0, -3, n * 0.5);
        bar(22, 5, hexA('#43331f', 0.85), 2, 4, n * 0.5);
        break;
      case 'temple':   // 사원 — 둥근 방석
        blob(12, 7, 0, hexA('#b45309', 0.55));
        blob(6, 3.5, 0, hexA('#fcd34d', 0.35));
        break;
      case 'lantern':  // 야시장 — 등불
        blob(8, 8, 0, hexA('#f59e0b', 0.5));
        blob(4, 4, 0, hexA('#fde68a', 0.7));
        break;
      case 'cliff':    // 절벽 — 모난 돌
        ctx.fillStyle = hexA('#9ca3af', 0.7);
        ctx.beginPath();
        ctx.moveTo(-12 * sc, 5 * sc); ctx.lineTo(-3 * sc, -9 * sc);
        ctx.lineTo(9 * sc, -2 * sc); ctx.lineTo(11 * sc, 6 * sc);
        ctx.closePath(); ctx.fill();
        break;
      case 'vine':     // 독림 — 넓은 잎 셋
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = hexA(k === 1 ? '#4d7c0f' : '#3f6212', 0.8);
          ctx.beginPath();
          ctx.ellipse((k - 1) * 8 * sc, (k % 2) * 4 * sc, 9 * sc, 5 * sc, k * 1.1 + n, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'tomb':     // 고묘 — 넘어진 비석
        bar(14, 18, hexA('#4b5563', 0.85), 0, 0, n * 0.4);
        bar(8, 2, hexA('#84cc16', 0.3), 0, -4, n * 0.4);
        break;
      case 'shore':    // 해안 — 조개와 해초
        blob(9, 6, n * 2, hexA('#e2e8f0', 0.7));
        bar(2, 12, hexA('#166534', 0.5), 7, -2, 0.5);
        break;
      case 'void':     // 천외천 — 떠 있는 옥 조각
        ctx.fillStyle = hexA('#c7d2fe', 0.55);
        ctx.beginPath();
        ctx.moveTo(0, -10 * sc); ctx.lineTo(10 * sc, 0);
        ctx.lineTo(0, 10 * sc); ctx.lineTo(-10 * sc, 0);
        ctx.closePath(); ctx.fill();
        blob(3, 3, 0, hexA('#fde68a', 0.6));
        break;
      case 'grave':    // 귀곡 — 작은 봉분과 묘표
        blob(14, 8, 0, hexA('#374151', 0.8));
        bar(3, 12, hexA('#6b7280', 0.8), 0, -8);
        break;
      case 'banner':   // 마교 — 깃대
        bar(2.5, 26, hexA('#1c1917', 0.9), 0, -8);
        bar(12, 9, hexA('#991b1b', 0.75), 6, -14);
        break;
      case 'pavilion': // 운해 — 낮은 난간
        bar(26, 3, hexA('#94a3b8', 0.7), 0, -6);
        bar(3, 10, hexA('#64748b', 0.7), -9, -1);
        bar(3, 10, hexA('#64748b', 0.7), 9, -1);
        break;
      case 'village':  // 마을 — 깨진 기와
        blob(13, 7, n * 3, hexA('#7c2d12', 0.75));
        blob(7, 4, n * 3 + 1, hexA('#a16207', 0.5));
        break;
      case 'rock':     // 혈사곡 — 피 먹은 바위
        blob(14, 9, n * 3, hexA('#7f1d1d', 0.7));
        blob(6, 4, n * 3 + 1, hexA('#dc2626', 0.35));
        break;
      case 'snowpine': // 설원 — 눈 덮인 솔
        ctx.fillStyle = hexA('#1e3a2f', 0.8);
        ctx.beginPath();
        ctx.moveTo(0, -16 * sc); ctx.lineTo(9 * sc, 6 * sc); ctx.lineTo(-9 * sc, 6 * sc);
        ctx.closePath(); ctx.fill();
        blob(7, 3, 0, 'rgba(241,245,249,0.75)');
        break;
      case 'dune':     // 사막 — 마른 뼈
        bar(16, 3, hexA('#e7e5e4', 0.8), 0, 0, n * 2);
        blob(4, 4, 0, hexA('#e7e5e4', 0.8));
        break;
      default:
        if (z.snow) {
          blob(18, 10, n * 2, 'rgba(241,245,249,0.8)');
        } else {
          blob(13, 8, n * 3, ink);
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.beginPath(); ctx.ellipse(-3 * sc, -2 * sc, 6 * sc, 3 * sc, n * 3, 0, Math.PI * 2); ctx.fill();
        }
    }
  }

  drawWeather(z, dt) {
    const { ctx, w, h } = this;
    if (z.snow) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 40; i++) {
        const x = ((i * 97 + this.t * (20 + (i % 5) * 6)) % (w + 40)) - 20;
        const y = ((i * 53 + this.t * (30 + (i % 7) * 8)) % (h + 20)) - 10;
        circle(ctx, x, y, 1.2 + (i % 3) * 0.6);
      }
    }
    if (z.prop === 'bamboo') {
      ctx.fillStyle = 'rgba(40,70,40,0.6)';
      for (let i = 0; i < 8; i++) {
        const x = ((i * 131 - this.t * (30 + i * 4)) % (w + 60) + w + 60) % (w + 60) - 30;
        const y = ((i * 71 + this.t * (24 + i * 3)) % (h + 20)) - 10;
        leaf(ctx, x, y, this.t * 2 + i);
      }
    }
    if (z.prop === 'rock' || z.prop === 'banner') {
      for (let i = 0; i < 14; i++) {
        const x = (i * 83 + Math.sin(this.t + i) * 20) % w;
        const y = h - ((i * 47 + this.t * (20 + i * 3)) % h);
        ctx.fillStyle = `rgba(248,113,113,${0.3 + (i % 3) * 0.15})`;
        circle(ctx, x, y, 1.5);
      }
    }
    void dt;
  }

  // ---------- 영웅 ----------
  drawHeroUnit(game, moving) {
    const st = game.stats();
    // 입은 의복이 있으면 그 모습으로. 도포 여섯은 몸, 검 장식 여섯은 무기.
    const { look, opts } = this.heroLook(game, moving);
    // v232: 걸음(·말발굽) 박자를 실제로 움직인 거리에 맞춘다 — 늘 같은 박자로 뛰면 탈것·이속이 빠를 때 발이 미끄러졌다.
    // 서 있을 때는 시간 그대로 흐르므로(숨쉬기) 섰다 뛸 때 박자가 튀지 않는다.
    {
      const ldt = Math.min(0.1, this._lastDt || 0);
      const d = this._lpx == null ? 0 : Math.hypot(game.heroX - this._lpx, game.heroY - this._lpy);
      this._lpx = game.heroX; this._lpy = game.heroY;
      const rate = moving && ldt > 0 ? Math.max(0.75, Math.min(2.4, d / ldt / 200)) : 1;
      this.heroPh = (this.heroPh ?? this.t) + ldt * rate;
      opts.t = this.heroPh;
    }
    const gale = game.buffs.gale > 0;
    // 초식 자세가 걸려 있으면 그 자세로. 그동안은 평타의 움찔(lunge)을 끈다.
    const pose = this.heroAnim.sample();
    const lunge = pose ? 0 : this.heroLunge;
    // 벨 때 타겟 쪽으로 몸을 내민다 (평면이라 방향이 있다)
    const ha = game.heroAngle || 0;
    // 움찔(v164): 바라보는 적 반대쪽으로 — 처음이 빠르고 돌아올 때 느리게
    const rc = (this.heroRecoil || 0) ** 2 * 10;
    const x = this.heroX + Math.cos(ha) * (lunge * 24 - rc);
    const y = this.groundY + Math.sin(ha) * (lunge * 24 - rc) * this.squash;
    // v157: 걸으면서 펼치면 다리는 계속 달리고 몸만 초식 자세를 반쯤 — 멈춰 서서 미끄러지는 꼴이 안 되게
    if (pose) {
      opts.pose = moving && pose.alpha >= 0.99
        ? { ...pose, lean: pose.lean * 0.55, crouch: pose.crouch * 0.35, lift: pose.lift * 0.4, dx: pose.dx * 0.3, stretch: pose.stretch * 0.5, alpha: 1 }
        : { ...pose, alpha: 1 };
      opts.lunge = 0; opts.run = !!moving;
    }
    // 순보로 사라진 동안은 발밑 고리·이름표까지 같이 옅어진다
    const alpha = pose ? Math.max(0, Math.min(1, pose.alpha)) : 1;
    if (alpha <= 0.01) return;
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    // 쓰러졌다 일어나기 — 앞 35%에 뒤로 넘어가고, 잠깐 누웠다가, 뒤 30%에 일어난다.
    // 몸만 눕힌다(발밑 고리·이름표·체력 막대는 그대로).
    let downRot = 0;
    if (this.heroDownT > 0) {
      this.heroDownT = Math.max(0, this.heroDownT - (this._lastDt || 0));
      const k = 1 - this.heroDownT / HERO_DOWN_SEC;
      // v216: 넘어질 때 바닥에 한 번 튕기고(0.35~0.45), 일어날 땐 무릎→허리 순으로(끝을 부드럽게)
      const down = k < 0.3 ? 1 - (1 - k / 0.3) ** 2
        : k < 0.42 ? 1 - Math.sin(Math.PI * (k - 0.3) / 0.12) * 0.12
        : k < 0.68 ? 1 : 1 - (1 - (1 - (k - 0.68) / 0.32) ** 3);
      downRot = (opts.flip ? 1 : -1) * down * 1.3;
      const D = this.heroDownFx || (this.heroDownFx = {});
      if (this.fxLevel > 0) {
        // 땅에 닿는 순간 흙먼지
        if (k >= 0.3 && !D.land) {
          D.land = true;
          for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; this.particles.push({ x: x + Math.cos(a) * 26, y: y - 2, vx: Math.cos(a) * (60 + Math.random() * 70), vy: -20 - Math.random() * 40, life: 0.5 + Math.random() * 0.3, size: 4 + Math.random() * 4, color: 'rgb(196,170,130)', dust: true }); }
          this.shake = Math.max(this.shake, 0.18);
        }
        // 일어서기 시작 — 발밑에서 금빛 기가 모여 오른다
        if (k >= 0.6 && !D.rise) {
          D.rise = true;
          this.effects.push({ kind: 'motes', life: 0.7, max: 0.7, n: 18, seeds: seedsN(18), r: 120, dx: 0, dy: -70, face: 1, col: '253,224,71' });
        }
        // 다 섰다 — 금빛 고리 한 번
        if (k >= 0.97 && !D.up && game?.heroX != null) {
          D.up = true;
          this.effects.push({ kind: 'shock', life: 0.45, max: 0.45, wx: game.heroX, wy: game.heroY, r: 110, col: '253,224,71', rings: 2, w: 3 });
        }
      }
      if (this.heroDownT <= 0) this.heroDownFx = null;
    }
    // 환영분신술 (v121) — 보랏빛 분신이 무인 둘레에 서서 함께 친다(칠 때 과녁 쪽으로 튀어 나간다)
    if (game.clones?.length) {
      const OFF = [[-62, -24], [62, -24], [0, -56]];
      for (const c of game.clones) {
        const [ox, oy] = OFF[c.i % 3];
        let cx = x + ox, cy = y + oy;
        const a = this.cloneAtk?.[c.i];
        if (a && a.t > 0) {
          a.t -= this._lastDt || 0;
          const k = Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - a.t / 0.25)));
          cx += (this.sx(a.at) - cx) * 0.55 * k;
          cy += (this.sy(a.at) - cy) * 0.55 * k;
        }
        const fade = Math.max(0, Math.min(1, c.life / 0.6, (c.max - c.life) / 0.3));
        this.ctx.save();
        this.ctx.globalAlpha = alpha * 0.6 * fade * (0.85 + Math.sin(this.t * 6 + c.i) * 0.15);
        this.drawHeroAt(this.ctx, cx, cy, null, !!opts.flip, '192,132,252');
        this.ctx.restore();
      }
    }
    if (gale) { // 잔상
      for (let i = 3; i >= 1; i--) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.12 * (4 - i);
        drawFighter(this.ctx, x - i * 16 * (opts.flip ? -1 : 1), y, look, { ...opts, flash: 0 });
        this.ctx.restore();
      }
    }
    // 발밑 표식 — 적이 수십이면 똑같이 생긴 사람들 틈에서 내가 안 보인다
    this.ctx.save();
    // 무인 뒤 은은한 빛 — 적 수십 틈에서 내가 어디 있는지 한눈에 들어오게
    // 무인 뒤 빛은 매 프레임 같은 그림이다. 구워 두고 붙인다.
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    this.ctx.drawImage(heroHalo(), x - 118, y - 162, 236, 236);
    if (this.fxLevel > 0) this.drawGearAura(this.ctx, x, y, this.gearLook(game), false);
    this.ctx.restore();
    this.ctx.fillStyle = 'rgba(0,0,0,0.38)';
    this.ctx.beginPath(); this.ctx.ellipse(x, y + 2, 24, 9, 0, 0, Math.PI * 2); this.ctx.fill();
    const pulse = 0.5 + Math.sin(this.t * 3) * 0.12;
    // 고리 두 겹 — 안쪽은 또렷하고 바깥은 숨을 쉰다
    this.ctx.strokeStyle = `rgba(253,224,71,${pulse})`;
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath(); this.ctx.ellipse(x, y + 2, 30, 12, 0, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.strokeStyle = `rgba(253,224,71,${pulse * 0.3})`;
    this.ctx.lineWidth = 1.5;
    const br = 38 + Math.sin(this.t * 3) * 4;
    this.ctx.beginPath(); this.ctx.ellipse(x, y + 2, br, br * 0.4, 0, 0, Math.PI * 2); this.ctx.stroke();
    this.ctx.restore();
    // 탈것 — 두 겹으로: 먼 다리·꼬리 → 무인(안장 높이에 앉힌다) → 몸통·가까운 다리·머리.
    // 몸통이 무인의 다리를 덮어서 올라탄 것처럼 보인다.
    const mt = game.mountNow?.();
    let fy = y;
    const ride = mt && !downRot;
    const rideOpt = { t: this.heroPh ?? this.t, moving, flip: !!opts.flip };
    // v183 탄 모습: 출발하면 앞으로 기울었다가 서면 뒤로 살짝 젖힌다(관성). 무인은 탈것이 기우는 만큼 같이 기울고,
    // 탈것보다 반 박자 늦게 들썩인다(엉덩이가 안장을 받아 튀는 맛).
    let rideLean = 0, riderTilt = 0, riderBob = 0;
    if (ride) {
      const dir = opts.flip ? -1 : 1;
      const was = this._rideMoving;
      if (was !== undefined && was !== moving) this._rideKick = moving ? 0.09 : -0.07;
      this._rideMoving = moving;
      const ldt = this._lastDt || 0;
      this._rideKick = (this._rideKick || 0) * Math.max(0, 1 - ldt * 4.5);
      const want = moving ? 0.03 : 0;
      this._rideLean = (this._rideLean || 0) + (want - (this._rideLean || 0)) * Math.min(1, ldt * 6);
      rideLean = (this._rideLean + this._rideKick) * dir;
      riderTilt = mountTilt(mt.id, this.t, moving) * dir;
      riderBob = moving ? -Math.abs(Math.sin(this.t * mountGait(mt.id) - 0.7)) * 1.6 + 0.8 : 0;
      this.ctx.save();
      if (rideLean) { this.ctx.translate(x, y); this.ctx.rotate(rideLean); this.ctx.translate(-x, -y); }
      drawCreature(this.ctx, mt.id, x, y, { ...rideOpt, layer: 'back' });
      fy = y + saddleY(mt.id, this.t, moving) + riderBob;
    } else this._rideMoving = undefined;
    if (downRot) {
      this.ctx.save();
      this.ctx.translate(x, y); this.ctx.rotate(downRot); this.ctx.translate(-x, -y);
      this.ctx.globalAlpha *= 1 - Math.abs(downRot) / 1.3 * 0.35;
      drawFighter(this.ctx, x, y, look, opts);
      this.ctx.restore();
    } else if (ride) {
      this.ctx.save();
      if (riderTilt) { this.ctx.translate(x, y); this.ctx.rotate(riderTilt); this.ctx.translate(-x, -y); }
      drawFighter(this.ctx, x, fy, look, { ...opts, run: false, turn: null });
      this.ctx.restore();
    } else drawFighter(this.ctx, x, fy, look, opts);
    if (ride) { drawCreature(this.ctx, mt.id, x, y, { ...rideOpt, layer: 'front' }); this.ctx.restore(); }
    // 데려간 영수들이 뒤를 따른다 (예전엔 s.pet 한 마리만 그렸는데, 영수가 여럿이 된 뒤로
    // 그 값이 늘 비어 있어서 아무것도 안 그려졌다)
    // 애완동물 — 무인 뒤를 따라 걷고, 칠 때는 과녁 쪽으로 튀어 나갔다 돌아온다
    // v178: 무인 곁에 붙박이로 그리지 않고, 제 자리(무인 뒤)를 **따라 걷는다** — 무인이 돌아서면
    // 반대편으로 순간이동하던 것을 걸어서 돌아가게. 멀리 떨어지면 빨리 뛰고, 머문 때는 제자리에서 숨 쉰다.
    const back = opts.flip ? 1 : -1;
    const pdt = Math.min(0.1, this._lastDt || 0);
    this.petPos = this.petPos || [];
    game.petTeam().forEach((pet, i) => {
      const tx = game.heroX + back * (50 + i * 34), ty = game.heroY + (12 - (i % 2) * 16) / (this.squash || 1);
      let pp = this.petPos[i];
      if (!pp || pp.map !== game.s.map || Math.hypot(tx - pp.x, ty - pp.y) > 500) pp = this.petPos[i] = { x: tx, y: ty, vx: 0, flip: !!opts.flip, map: game.s.map };
      const dx = tx - pp.x, dy = ty - pp.y, dist = Math.hypot(dx, dy);
      // 가까우면 느긋하게, 멀면 서둘러 (뒤처지는 맛이 남게 i번째일수록 조금 늦다)
      const sp = Math.min(dist, (90 + dist * (3.2 - i * 0.4)) * pdt);
      const ox = pp.x;
      if (dist > 0.5) { pp.x += dx / dist * sp; pp.y += dy / dist * sp; }
      pp.vx = pdt > 0 ? (pp.x - ox) / pdt : 0;
      if (Math.abs(pp.vx) > 25) pp.flip = pp.vx < 0; else if (dist < 4) pp.flip = !!opts.flip;
      const pMoving = dist > 6;
      // v232: 애완동물 걸음 박자도 제 빠르기에 맞춘다(따라잡으려 내달릴 때 다리가 같이 빨라진다)
      pp.ph = (pp.ph ?? this.t + i * 0.7) + pdt * (pMoving && pdt > 0 ? Math.max(0.75, Math.min(2.6, sp / pdt / 160)) : 1);
      let px = this.sx(pp), py = this.sy(pp);
      if (!pMoving) py -= Math.abs(Math.sin(this.t * 1.6 + i)) * 1.5;
      const atk = this.petAtk?.[i];
      if (atk && atk.t > 0) {
        atk.t -= this._lastDt || 0;
        const k = Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - atk.t / 0.32)));
        px += (atk.x - px) * 0.55 * k;
        py += (atk.y - py) * 0.55 * k - k * 10;
      }
      // 덮칠 때 몸을 늘였다 줄인다(펄쩍 → 착지) — v193
      const lunge = atk && atk.t > 0 ? Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - atk.t / 0.32))) : 0;
      if (this.fxLevel > 0) petAura(this.ctx, pet, px, py, this.t + i * 1.7, false, this.squash);
      drawCreature(this.ctx, pet.kind, px, py, { t: pp.ph, moving: pMoving || lunge > 0, flip: atk && atk.t > 0 ? atk.x < px : pp.flip, scale: 1.05 * (1 + lunge * 0.14) });
      if (this.fxLevel > 0) petAura(this.ctx, pet, px, py, this.t + i * 1.7, true, this.squash);
    });
    if (this.fxLevel > 0) this.drawGearAura(this.ctx, x, fy, this.gearLook(game), true);
    const hr = ratio(game.heroHp, st.hp);
    hpBar(this.ctx, x - 32, fy - 128, 64, 6, hr, '#16a34a', this.hpTrail(this, '_heroTrail', hr));
    nameTag(this.ctx, game.heroLabel ? game.heroLabel() : `${RANKS[game.s.rank].name} ${game.s.nickname || ''}`, x, fy - 136);
    this.ctx.restore();
  }

  // ---------- 장비 기운 (v114) ----------
  // 뒤 겹(front=false): 발밑 고리(장비 세기 0~5단) · 십이지왕 기운 중 몸 뒤에 깔리는 것
  // 앞 겹(front=true): 떨어지는 꽃잎·음표·잎사귀처럼 몸 앞을 지나가는 것
  drawGearAura(ctx, x, y, gear, front) {
    const t = this.t;
    const kps = gear.kps;
    ctx.save();
    if (!front) {
      if (gear.tier > 0) {
        const col = gear.bestCol || '#fde68a';
        ctx.globalCompositeOperation = 'lighter';
        // 고리 — 단계만큼 겹, 천천히 돈다
        for (let i = 0; i < gear.tier; i++) {
          const r = 34 + i * 9 + Math.sin(t * 2 + i) * 2;
          ctx.strokeStyle = hexA(col, 0.32 - i * 0.04);
          ctx.lineWidth = 2;
          ctx.setLineDash([10 + i * 3, 6]);
          ctx.lineDashOffset = -t * (20 + i * 8) * (i % 2 ? -1 : 1);
          ctx.beginPath(); ctx.ellipse(x, y + 2, r, r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);
        // 피어오르는 빛 알갱이 — 3단부터
        if (gear.tier >= 3) {
          for (let i = 0; i < 6 + gear.tier * 2; i++) {
            const ph = (t * 0.7 + i * 0.137) % 1;
            const a = i * 2.4;
            ctx.fillStyle = hexA(col, 0.6 * (1 - ph));
            circle(ctx, x + Math.cos(a) * (20 + (i % 3) * 10), y - ph * (70 + gear.tier * 12), 2.4 - ph * 1.6);
          }
        }
        // 5단: 발밑 빛기둥
        if (gear.tier >= 5) {
          const g = ctx.createLinearGradient(0, y - 150, 0, y);
          g.addColorStop(0, hexA(col, 0));
          g.addColorStop(1, hexA(col, 0.22 + Math.sin(t * 3) * 0.06));
          ctx.fillStyle = g;
          ctx.fillRect(x - 26, y - 150, 52, 152);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      // 십이지왕 — 몸 뒤
      if (kps.has('crimson')) {                     // 도왕: 머리 뒤 붉은 그믐달
        ctx.fillStyle = hexA('#fecaca', 0.85);
        ctx.beginPath(); ctx.arc(x - 6, y - 98, 26, 0, Math.PI * 2); ctx.arc(x + 4, y - 104, 24, 0, Math.PI * 2, true); ctx.fill('evenodd');
      }
      if (kps.has('bossbane')) {                    // 투왕: 등 뒤 금빛 투기
        const g = ctx.createRadialGradient(x, y - 60, 6, x, y - 60, 70);
        g.addColorStop(0, hexA('#fbbf24', 0.45 + Math.sin(t * 8) * 0.1)); g.addColorStop(1, hexA('#fbbf24', 0));
        ctx.fillStyle = g; circle(ctx, x, y - 60, 70);
      }
      if (kps.has('drain')) {                       // 혈왕: 발밑 핏빛 소용돌이
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = hexA('#dc2626', 0.35 - i * 0.08);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(x, y + 2, 30 + i * 10, (30 + i * 10) * 0.35, 0, t * (1.5 + i * 0.4), t * (1.5 + i * 0.4) + Math.PI * 1.3); ctx.stroke();
        }
      }
      if (kps.has('execute')) {                     // 암왕: 검은 연기
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.5 + i / 6) % 1;
          ctx.fillStyle = `rgba(20,10,30,${0.35 * (1 - ph)})`;
          circle(ctx, x + Math.sin(i * 1.7 + t) * 22, y - 20 - ph * 80, 10 + ph * 12);
        }
      }
      if (kps.has('dodge')) {                       // 환왕: 보랏빛 잔상
        ctx.globalAlpha = 0.3 + Math.sin(t * 5) * 0.08;
        ctx.fillStyle = '#c4b5fd';
        ctx.beginPath(); ctx.ellipse(x - 16, y - 50, 16, 48, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + 16, y - 50, 16, 48, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (kps.has('reflect')) {                     // 철왕: 도는 육각 방패
        ctx.strokeStyle = hexA('#cbd5e1', 0.9);
        ctx.fillStyle = hexA('#93c5fd', 0.12 + Math.sin(t * 3) * 0.04);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const a = t * 0.8 + (i * Math.PI) / 3; const px = x + Math.cos(a) * 52, py = y - 55 + Math.sin(a) * 52 * 0.95; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
        ctx.fill(); ctx.stroke();
      }
      if (gear.setLook) {                           // 한 두목의 세 벌: 그 두목 빛깔의 붓 고리가 발밑에서 돈다
        ctx.save(); ctx.translate(x, y + 2); ctx.scale(1, 0.36); ctx.rotate(t * 0.5);
        ctx.strokeStyle = hexA(gear.setLook, 0.75); ctx.lineWidth = 5; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(0, 0, 66, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + 1.4); ctx.stroke(); }
        ctx.restore();
      }
    } else {
      if (gear.gems?.length) {                      // 두목 장신구 구슬 — 몸을 돈다
        ctx.globalCompositeOperation = 'lighter';
        gear.gems.forEach((c, i) => {
          const an = t * 1.6 + (i * Math.PI * 2) / gear.gems.length;
          const gx = x + Math.cos(an) * 30, gy = y - 66 + Math.sin(an) * 9;
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 9);
          g.addColorStop(0, hexA('#ffffff', 0.95)); g.addColorStop(0.35, hexA(c, 0.9)); g.addColorStop(1, hexA(c, 0));
          ctx.fillStyle = g; circle(ctx, gx, gy, 9);
        });
        ctx.globalCompositeOperation = 'source-over';
      }
      if (kps.has('petal')) {                       // 화왕: 떨어지는 꽃잎
        for (let i = 0; i < 16; i++) {
          const ph = (t * 0.35 + i / 16) % 1;
          const px = x - 70 + ((i * 37) % 140) + Math.sin(t * 2 + i) * 10;
          ctx.save(); ctx.translate(px, y - 140 + ph * 150); ctx.rotate(t * 2 + i);
          ctx.fillStyle = hexA(i % 3 ? '#f472b6' : '#fbcfe8', 0.95 * (1 - ph * 0.5));
          ctx.beginPath(); ctx.ellipse(0, 0, 8, 4.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      if (kps.has('revive')) {                      // 목왕: 도는 잎사귀
        for (let i = 0; i < 7; i++) {
          const a = t * 1.2 + (i * Math.PI * 2) / 7;
          ctx.save(); ctx.translate(x + Math.cos(a) * 42, y - 50 + Math.sin(a) * 16); ctx.rotate(a);
          ctx.fillStyle = i % 2 ? '#22c55e' : '#86efac'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
      }
      if (kps.has('stun')) {                        // 음왕: 피어오르는 음표
        ctx.font = '900 26px serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(30,27,75,0.75)';
        for (let i = 0; i < 6; i++) {
          const ph = (t * 0.45 + i / 6) % 1;
          const nx = x - 50 + i * 20 + Math.sin(t * 3 + i) * 8, ny = y - 30 - ph * 100;
          ctx.globalAlpha = 1 - ph;
          ctx.strokeText(i % 2 ? '♪' : '♫', nx, ny);
          ctx.fillStyle = '#c7d2fe'; ctx.fillText(i % 2 ? '♪' : '♫', nx, ny);
        }
        ctx.globalAlpha = 1;
      }
      if (kps.has('combo')) {                       // 권왕: 주먹 불꽃
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const ph = (t * 1.6 + i / 10) % 1;
          ctx.fillStyle = hexA(i % 2 ? '#fb923c' : '#ef4444', 0.9 * (1 - ph));
          circle(ctx, x + (i % 2 ? 16 : -12) + Math.sin(i * 2 + t * 4) * 6, y - 50 - ph * 40, 6 - ph * 4.5);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (kps.has('frenzy') && this.game?.frenzyT > 0) {   // 살왕: 광폭 — 붉은 속도선
        ctx.strokeStyle = hexA('#ef4444', 0.6); ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const yy = y - 20 - i * 18; const xx = x - 40 - ((t * 300 + i * 30) % 50); ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 26, yy); ctx.stroke(); }
      }
    }
    ctx.restore();
  }

  // ---------- 몹 등급 기운 (v116) ----------
  // 정예: 주황 테·발밑 점선 고리·불티 · 두목: 두목 빛깔의 이중 술법진·검은 웅덩이·불티 기둥 ·
  // 왕: 두목에 더해 그 왕의 신화 기운(무인이 왕 장비를 낄 때와 같은 것)과 먹빛 연기.
  // 두목·왕은 체력 35% 아래면 격노 — 빛이 붉게 바뀌고 고동친다.
  mobCol(a) {
    if (a.grade >= 2 && a.hp < a.maxHp * 0.35) return '#ef4444';
    if (a.grade === 1) return '#f97316';
    const l = a.def?.look || {};
    return l.aura || l.trim || '#ef4444';
  }
  drawMobFx(ctx, a, x, y, sc, front) {
    const t = this.t + (a.id || 0) * 0.37;
    const col = this.mobCol(a);
    const rage = a.grade >= 2 && a.hp < a.maxHp * 0.35;
    ctx.save();
    if (!front) {
      if (a.grade === 1) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexA(col, 0.45);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.ellipse(x, y + 2, 28 * sc, 10 * sc, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // 검은 웅덩이
        const pool = ctx.createRadialGradient(x, y + 2, 4, x, y + 2, 70 * sc);
        pool.addColorStop(0, 'rgba(10,6,4,0.55)'); pool.addColorStop(1, 'rgba(10,6,4,0)');
        ctx.fillStyle = pool;
        ctx.beginPath(); ctx.ellipse(x, y + 2, 70 * sc, 26 * sc, 0, 0, Math.PI * 2); ctx.fill();
        const pulse = rage ? 0.6 + Math.sin(t * 10) * 0.4 : 0.8 + Math.sin(t * 2.5) * 0.2;
        // 이중 술법진 — 바깥은 이쪽, 안쪽은 저쪽으로 돈다
        for (let k = 0; k < 2; k++) {
          const R = (k ? 40 : 58) * sc;
          ctx.save();
          ctx.translate(x, y + 2);
          ctx.scale(1, 0.36);
          ctx.rotate(t * (k ? -0.9 : 0.6) * (rage ? 2.2 : 1));
          const n = k ? 6 : 8;
          ctx.beginPath();
          ctx.moveTo(R, 0); ctx.arc(0, 0, R, 0, Math.PI * 2);
          for (let i = 0; i < n; i++) {
            const an = (i * Math.PI * 2) / n;
            ctx.moveTo(Math.cos(an) * R, Math.sin(an) * R); ctx.lineTo(Math.cos(an) * (R + (k ? -10 : 13)), Math.sin(an) * (R + (k ? -10 : 13)));
          }
          if (a.grade === 3 && !k) {
            // 왕: 술법진 안에 별 — 꼭짓점을 이어 그린다
            for (let i = 0; i <= 5; i++) { const an = (i * 4 * Math.PI) / 5 - Math.PI / 2; const px = Math.cos(an) * R * 0.92, py = Math.sin(an) * R * 0.92; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          }
          // 밝은 바닥에서도 보이게 먹선을 먼저 깔고 그 위에 빛깔
          ctx.strokeStyle = 'rgba(12,8,6,0.45)'; ctx.lineWidth = (k ? 2 : 3) + 3; ctx.stroke();
          ctx.strokeStyle = hexA(col, 0.95 * pulse); ctx.lineWidth = k ? 2 : 3; ctx.stroke();
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        {
        }
        // 몸을 감싸는 기운
        const g = ctx.createRadialGradient(x, y - 60 * sc, 8, x, y - 60 * sc, 80 * sc);
        g.addColorStop(0, hexA(col, 0.28 * pulse)); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        circle(ctx, x, y - 60 * sc, 80 * sc);
        if (a.grade === 3) {
          // 먹빛 연기
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 7; i++) {
            const ph = (t * 0.4 + i / 7) % 1;
            ctx.fillStyle = `rgba(12,8,6,${0.3 * (1 - ph)})`;
            circle(ctx, x + Math.sin(i * 2.3 + t) * 40 * sc, y - ph * 120 * sc, (12 + ph * 18) * sc);
          }
          if (a.kp) this.drawGearAura(ctx, x, y, { tier: 0, kps: new Set([a.kp]) }, false);
        }
      }
    } else {
      // 오르는 불티 — 정예는 몇 개, 두목·왕은 기둥처럼
      ctx.globalCompositeOperation = 'lighter';
      const n = a.grade === 1 ? 4 : rage ? 16 : 10;
      const H = (a.grade === 1 ? 70 : 130) * sc;
      for (let i = 0; i < n; i++) {
        const ph = (t * (rage ? 1.4 : 0.8) + i / n) % 1;
        const px = x + Math.sin(i * 2.7 + t * 1.3) * (a.grade === 1 ? 18 : 34) * sc;
        ctx.fillStyle = hexA(i % 3 ? col : '#fde68a', 0.8 * (1 - ph));
        circle(ctx, px, y - 10 - ph * H, (a.grade === 1 ? 2 : 3) * (1 - ph * 0.6));
      }
      if (a.grade === 3 && a.kp) { ctx.globalCompositeOperation = 'source-over'; this.drawGearAura(ctx, x, y, { tier: 0, kps: new Set([a.kp]) }, true); }
    }
    ctx.restore();
  }

  // ---------- 유닛 ----------
  // 위에서 내려다보는 화면이라 "월드 Y가 작을수록 멀리 있다" = 먼저 그려서 뒤로 보낸다.
  drawUnits(game, dt, moving) {
    const list = [];
    const main = game.mon;
    if (this.fieldMode) {
      for (const a of (game.mons || [])) {
        if (!a.alive || a === main) continue;
        list.push({ y: a.y, go: () => this.drawAdd(game, a) });
      }
    }
    if (main && (main.alive || this.monDeath > 0)) {
      list.push({ y: main.y ?? game.heroY, go: () => this.drawMonster(game, dt) });
    }
    // 함께 사냥하는 문파원 (v138)
    if (this.fieldMode && game.coop?.on) for (const o of game.coop.others) list.push({ y: o.y, go: () => this.drawAlly(o) });
    // 쓰러지는 졸개 — 0.5초에 걸쳐 넘어지며 옅어진다
    if (this.corpses.length) {
      this.corpses = this.corpses.filter((c) => this.t - c.t0 < CORPSE_SEC);
      for (const c of this.corpses) list.push({ y: c.y - 1, go: () => this.drawCorpse(c) });
    }
    list.sort((a, b) => a.y - b.y);
    // 가벼운 모드에서는 **가까운 것만** 그린다. 멀리 있는 건 어차피 흐리게
    // 깔려 있어서 빠져도 티가 잘 안 난다.
    if (this.light && list.length > LIGHT_MOBS) {
      const hy = game.heroY || 0;
      list.sort((a, b) => Math.abs(a.y - hy) - Math.abs(b.y - hy));
      list.length = LIGHT_MOBS;
      list.sort((a, b) => a.y - b.y);
    }
    // 나무·바위·기둥 (v127) — 사람과 앞뒤를 맞춰 그린다 (가벼운 모드에서도 빼지 않는다: 길을 막는 것이라)
    if (this.fieldMode && game.obstacles?.length) {
      const T = game.tile || 64;
      for (const o of game.obstacles) {
        if (o.low) continue;
        const wy = (o.r + 0.5) * T;
        list.push({ y: wy + 1, go: () => this.drawObstacleAt(o, (o.c + 0.5) * T, wy) });
      }
      list.sort((a, b) => a.y - b.y);
    }
    for (const e of list) e.go();
    // 무인은 깊이와 상관없이 맨 위에 그린다. 적이 수십이면 파묻혀서 누가 나인지 모른다.
    // 흑백은 무인 바로 앞에서 건다 — 무인만 색이 남는다.
    this.applyDesat();
    this.drawHeroUnit(game, moving);
  }

  drawObstacleAt(o, wx, wy) {
    const x = this.sx({ x: wx }), y = this.sy({ y: wy });
    if (x < -80 || x > this.w + 80 || y < -40 || y > this.h + 140) return;
    drawObstacle(this.ctx, o.kind, x, y, this.t, o.seed);
  }
  drawLowObstacles(game) {
    if (!this.fieldMode || !game?.obstacles?.length) return;
    const T = game.tile || 64;
    for (const o of game.obstacles) {
      if (!o.low) continue;
      const x = this.sx({ x: (o.c + 0.5) * T }), y = this.sy({ y: (o.r + 0.5) * T });
      if (x < -80 || x > this.w + 80 || y < -60 || y > this.h + 60) continue;
      drawLowObstacle(this.ctx, o.kind, x, y, this.t, o.seed, this.squash, this.sx({ x: 0 }), this.sy({ y: 0 }));
    }
  }

  // 쓰러지는 졸개. 서 있던 그림 한 장을 발끝을 축으로 눕히며 옅게 한다.
  drawCorpse(c) {
    const { ctx } = this;
    const x = this.sx(c);
    const y = this.sy(c);
    if (x < -90 || x > this.w + 90 || y < -110 || y > this.h + 90) return;
    const k = Math.min(1, (this.t - c.t0) / CORPSE_SEC);
    const fall = 1 - (1 - Math.min(1, k * 2.2)) ** 3;      // 앞 45%에 넘어지고 나머지는 옅어진다
    const away = x >= this.heroX ? 1 : -1;
    const def = c.def || {};
    // v194: 맞은 힘에 살짝 떠서 뒤로 날아가(앞 30%) 땅에 떨어지고, 한 번 튀었다가(30~45%) 눕는다.
    // 떨어지는 순간 흙먼지. 두목 그림은 무거워서 뜨지 않는다.
    const big = !!(def.art && bossImg(def.art));
    const air = big ? 0 : Math.sin(Math.PI * Math.min(1, k / 0.3)) * (k < 0.3 ? 16 : 0);
    const bounce = big || k < 0.3 || k > 0.45 ? 0 : Math.sin(Math.PI * (k - 0.3) / 0.15) * 4;
    const slide = (1 - (1 - Math.min(1, k / 0.45)) ** 2) * (big ? 14 : 26);
    if (!c._landed && k >= 0.3) {
      c._landed = true;
      if (this.fxLevel > 0) for (let i = 0; i < 5; i++) this.particles.push({ x: x + away * slide + (Math.random() - 0.5) * 28, y: y - 2, vx: away * (20 + Math.random() * 50), vy: -15 - Math.random() * 25, life: 0.45, size: 4 + Math.random() * 3, color: 'rgb(214,196,160)', dust: true });
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55) * 0.9;
    ctx.translate(x + away * slide, y - air - bounce);
    const sc = (def.look?.scale || 1) * 0.94 * this.crowdScale;
    ctx.scale(sc, sc);
    const bimg = def.art ? bossImg(def.art) : null;
    if (bimg) {
      // 두목 그림 (v160): 무릎 꿇듯 주저앉으며 뒤로 넘어간다
      ctx.scale(1 / sc, 1 / sc);
      const H = bossHeight(), W = (bimg.width / bimg.height) * H;
      if (c.face) ctx.scale(-1, 1);
      ctx.rotate(away * fall * 1.1 * (c.face ? -1 : 1));
      ctx.scale(1, 1 - fall * 0.25);
      ctx.drawImage(bimg, -W / 2, -H, W, H);
    } else if (def.emoji) {
      ctx.rotate(away * fall * 1.3);
      emoji(ctx, def.emoji, 0, 0, 44, c.face);
    } else if (def.beast) {
      // 들짐승은 옆으로 쓰러진다 — 뒤집혀 다리가 하늘로
      ctx.rotate(away * fall * 0.5);
      ctx.scale(1, 1 - fall * 0.35);
      drawCreature(ctx, def.beast, 0, 0, { t: c.seed * 7, flip: c.face, scale: (def.bscale || 1.7) / ((def.look?.scale || 1) * 0.94) });
    } else {
      const spr = fighterSprite(def.look || {}, c.seed * 7, def.look?.weapon, this.dpr || 1);
      if (spr) {
        if (c.face) ctx.scale(-1, 1);
        // 무인 반대쪽으로 넘어간다. 좌우를 뒤집은 그림에서는 도는 방향도 뒤집힌다.
        ctx.rotate(away * fall * 1.35 * (c.face ? -1 : 1));
        ctx.drawImage(spr, -SPR.ox, -SPR.oy, SPR.w, SPR.h);
      }
    }
    ctx.restore();
  }

  // 체력 막대 뒤 띠 — 깎이면 0.3초 머물렀다가 초당 70%씩 따라 내려온다. 차면 바로 붙는다.
  hpTrail(obj, key, r) {
    const now = this.t;
    let st = obj[key];
    if (!st) st = obj[key] = { v: r, at: now, hold: 0 };
    const dt = Math.min(0.1, Math.max(0, now - st.at));
    st.at = now;
    if (r >= st.v) { st.v = r; st.hold = 0; return r; }
    if (st.hold < 0.3) { st.hold += dt; return st.v; }
    st.v = Math.max(r, st.v - dt * 0.7);
    return st.v;
  }

  // 돌아서기 (v160): 바라보는 쪽이 바뀌면 곧장 뒤집지 않고 0.12초에 걸쳐 돈다 — 1 ↔ -1을 지나며 몸이 납작해졌다 펴진다.
  // who: 몹 객체 또는 'hero'. 돌려주는 값을 가로 배율로 쓴다.
  turnTo(who, want) {
    const st = who === 'hero' ? (this._heroTurn || (this._heroTurn = { v: want, at: this.t })) : (who._turn || (who._turn = { v: want, at: this.t }));
    const dt = Math.min(0.1, Math.max(0, this.t - st.at));
    st.at = this.t;
    const step = dt * 16;
    st.v = Math.abs(want - st.v) <= step ? want : st.v + Math.sign(want - st.v) * step;
    // 납작해질 때도 아예 0이 되면 사라져 보인다
    return Math.sign(st.v || want) * Math.max(0.18, Math.abs(st.v));
  }

  // ---------- 적 ----------
  // 들판에 흩어진 다른 적들 — 각자 제자리에 선다
  drawAdd(game, a) {
    const { ctx } = this;
    const x = this.sx(a);
    const y = this.sy(a);
    if (x < -90 || x > this.w + 90 || y < -110 || y > this.h + 90) return; // 화면 밖은 그리지 않는다
    const def = a.def || {};
    // v235: 서 있거나 칠 때는 무인 쪽을, **걸을 때는 가는 쪽을** 본다 — 전엔 늘 무인 쪽만 봐서 멀어질 때 뒷걸음(문워크)으로 걸었다
    const mdx = a._px == null ? 0 : a.x - a._px;
    a._px = a.x;
    if (a.move && Math.abs(mdx) > 0.15) a._face = mdx < 0;
    else if (!a.move) a._face = a.x >= game.heroX;
    const face = a._face ?? (a.x >= game.heroX);
    ctx.save();
    const sc = (def.look?.scale || 1) * 0.94 * this.crowdScale * (a.grade === 1 ? 1.1 : 1);
    // 걸음 박자 — 느려지면(둔화) 다리도 느리게 (전엔 몸만 느리고 다리는 제 박자로 헛걸음)
    a._ph = (a._ph ?? this.t + 0.7 + (Math.abs(a.x) % 7) * 0.2) + Math.min(0.1, this._lastDt || 0) * (a.slow > 0 ? 0.45 : 1);
    const time = a._ph;
    const fx = a.grade > 0 && this.fxLevel > 0 && !a.npc;
    // 깊이 — 무인에게서 멀수록 흐리다
    const dist = Math.hypot(x - this.heroX, (y - this.groundY) / this.squash);
    // 물린 카메라에서는 지도 전체가 한눈에 보여야 하니 흐리게 하지 않는다
    const depth = this.overview ? 1 : depthOf(dist);
    // 멀수록 아주 살짝 작게. 과하면 평면이 깨지니 10%까지만 줄인다.
    const persp = 0.9 + 0.1 * depth;
    ctx.globalAlpha = depth;
    // 발밑 그림자 — 위에서 보는 화면이라 이게 있어야 바닥에 붙어 보인다.
    // 가까울수록 진하고 또렷하다.
    ctx.fillStyle = `rgba(0,0,0,${0.34 * depth})`;
    ctx.beginPath(); ctx.ellipse(x, y + 2, 20 * sc, 8 * sc, 0, 0, Math.PI * 2); ctx.fill();
    if (fx) this.drawMobFx(ctx, a, x, y, sc, false);
    // 맞은 직후 0.2초 — 무인 반대쪽으로 밀리고, 위아래로 찌그러졌다 돌아온다
    const hk = a._hitAt != null ? Math.max(0, 1 - (this.t - a._hitAt) / 0.2) : 0;
    const away = x >= this.heroX ? 1 : -1;
    // v162: 무인을 칠 때 앞으로 내딛었다 돌아온다(0.32초) · 갓 난 몹은 땅에서 솟아오르듯 0.45초에 걸쳐 나타난다
    const ak = a.atkAt != null && game.clock != null ? Math.max(0, 1 - (game.clock - a.atkAt) / 0.32) : 0;
    const swing = Math.sin(ak * Math.PI) * (ak > 0.5 ? 1 : 0.6);
    const born = a.born != null && game.clock != null && !a.npc ? Math.min(1, Math.max(0, (game.clock - a.born) / 0.45)) : 1;
    if (born < 1) {
      ctx.globalAlpha *= born;
      if (born < 0.35 && this.fxLevel > 0 && !a._puffed) {
        a._puffed = true;
        for (let i = 0; i < 6; i++) this.particles.push({ x: x + (Math.random() - 0.5) * 30, y: y - 2, vx: (Math.random() - 0.5) * 80, vy: -20 - Math.random() * 30, life: 0.5, size: 4 + Math.random() * 3, color: 'rgb(214,196,160)', dust: true });
      }
    }
    // v193: 맞으면 조금 더 크게 밀렸다가(14) 돌아온다 — 손맛
    const kx = hk * hk * 14 * away - swing * 14 * away;
    const ky = (1 - born) * 10 + swing * 3;
    // v160: 두목은 제 그림으로 — 과녁이 아니어도
    if (a.isBoss && def.art && bossImg(def.art) && drawBossSprite(this, ctx, a, x + kx, y, depth, { lord: !!game.map?.lord, king: !!game.map?.king, fac: game.map?.master ? ZONES_W[game.map.zone]?.fac : null,
      casting: game.tells?.length > 0, col: fxFor('', def.look || {}).col, flash: hk, lunge: 0, heroX: game.heroX })) { /* 그렸다 */ } else
    if (def.emoji) emoji(ctx, def.emoji, x + kx, y, 44, face);
    else if (def.beast) {
      // 들짐승 (v117) — 맞으면 찌그러졌다 돌아온다
      ctx.save();
      ctx.translate(x + kx, y + ky);
      if (hk > 0) ctx.scale(1 + 0.08 * hk, 1 - 0.1 * hk);
      if (fx) { ctx.shadowColor = this.mobCol(a); ctx.shadowBlur = a.grade >= 2 ? 18 : 10; }
      drawCreature(ctx, def.beast, 0, 0, { t: time, moving: !!a.move, flip: face, scale: (def.bscale || 1.7) * this.crowdScale * persp * (a.grade === 1 ? 1.1 : 1) });
      // v193: 들짐승도 맞은 순간 하얗게 번쩍인다(사람 몹과 같게)
      if (hk > 0.5 && this.fxLevel > 0) {
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = depth * (hk - 0.5) * 0.8;
        drawCreature(ctx, def.beast, 0, 0, { t: time, moving: !!a.move, flip: face, scale: (def.bscale || 1.7) * this.crowdScale * persp * (a.grade === 1 ? 1.1 : 1) });
      }
      ctx.restore();
    } else {
      const walking = !!a.move && !a.npc;
      const spr = fighterSprite(def.look || {}, time, def.look?.weapon, this.dpr || 1, walking);
      if (spr) {
        ctx.save();
        ctx.translate(x + kx, y + ky);
        const s2 = sc * persp;
        if (s2 !== 1) ctx.scale(s2, s2);
        ctx.scale(this.turnTo(a, face ? -1 : 1), 1);
        if (hk > 0) { ctx.rotate(-0.12 * hk * (face ? -away : away)); ctx.scale(1 + 0.06 * hk, 1 - 0.08 * hk); }
        if (swing > 0) ctx.rotate(0.16 * swing);                 // 칠 때 몸을 앞으로 숙인다 (그림 기준 앞)
        if (born < 1) ctx.scale(1, 0.7 + 0.3 * born);
        // 정예·두목·왕은 몸 둘레가 등급 빛깔로 번진다
        if (fx) { ctx.shadowColor = this.mobCol(a); ctx.shadowBlur = a.grade >= 2 ? 18 : 10; }
        ctx.drawImage(spr, -SPR.ox, -SPR.oy, SPR.w, SPR.h);
        ctx.shadowBlur = 0;
        // 맞은 순간 몸이 하얗게 번쩍인다
        if (hk > 0.5) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = depth * (hk - 0.5) * 0.9;
          ctx.drawImage(spr, -SPR.ox, -SPR.oy, SPR.w, SPR.h);
        }
        ctx.restore();
      } else {
        drawFighter(ctx, x, y, def.look || {}, {
          t: time, flip: face, scale: sc, weapon: def.look?.weapon, flash: 0,
        });
      }
    }
    if (fx) this.drawMobFx(ctx, a, x, y, sc, true);
    if (a.stun > 0) dizzy(ctx, x, y - 96 * sc, this.t);
    // 들판 정예는 드물어서 표를 단다
    if (a.treasure && a.alive !== false && this.fxLevel > 0) treasureAura(ctx, x, y, sc, this.t + (a.id || 0) * 0.37, this.squash);
    if (a.elite && a.alive !== false && this.fxLevel > 0) eliteAura(ctx, x, y, sc, this.t + (a.id || 0) * 0.37, this.squash);
    if (a.elite) { ctx.globalAlpha = 1; gradeTag(ctx, '정예', x, y - 100 * sc, '#fb923c'); }
    // 마을 사람은 이름을 단다
    if (a.npc) { ctx.globalAlpha = 1; nameTag(ctx, def.name || '', x, y - 104, true); }
    // 체력바는 가까이 붙은 적만. 수십 마리가 전부 달면 주황 막대가 화면을 덮는다.
    // 그리고 **맞은 적만** — 멀쩡한 졸개 머리 위 꽉 찬 막대는 아무것도 알려 주지 않는다
    const near = (this.overview || Math.hypot(x - this.heroX, y - this.groundY) <= HP_BAR_RANGE) && big(a.hp).lt(a.maxHp);
    if (near) {
      // 가로로 긴 주황 막대가 수십 개면 화면이 막대로 덮인다. 가늘게, 짧게.
      ctx.globalAlpha = depth;
      const ar = ratio(a.hp, a.maxHp);
      hpBar(ctx, x - 17, y - 90, 34, 3, ar, '#b45309', this.hpTrail(a, '_trail', ar));
      ccDots(ctx, a, x, y - 96);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawQueue(game) {
    if ((game.adds || []).some((a) => a.alive)) return; // 졸개가 있으면 미리보기는 숨긴다
    // 들판은 사방에서 적이 들어오므로 줄 세울 자리가 없다. 던전(1:1)에서만 보여준다.
    if (this.fieldMode) return;
    if (!game.queue.length || game.mode !== 'dungeon') return;
    const { ctx } = this;
    game.queue.slice(0, 2).forEach((def, i) => {
      const x = this.monX + 72 + i * 56;
      ctx.save();
      ctx.globalAlpha = 0.55;
      if (def.emoji) emoji(ctx, def.emoji, x, this.groundY, 40, true);
      else {
        ctx.translate(x, this.groundY);
        ctx.scale(-0.75, 0.75);
        drawFighter(ctx, 0, 0, def.look, { t: this.t + i * 2, run: true, weapon: def.look.weapon });
      }
      ctx.restore();
    });
  }

  drawMonster(game, dt) {
    const { ctx } = this;
    const m = game.mon;
    if (!m) return;
    if (!m.alive) {
      this.monDeath = Math.max(0, this.monDeath - dt * 2.5);
      if (this.monDeath <= 0) return;
    }
    const alpha = m.alive ? 1 : this.monDeath;
    // 넉백은 무인에게서 멀어지는 쪽으로 — 평면이라 방향이 생겼다
    const ang = Math.atan2((m.y ?? game.heroY) - game.heroY, (m.x ?? game.heroX) - game.heroX);
    const kx = Math.cos(ang) * this.monKnock;
    const ky = Math.sin(ang) * this.monKnock * this.squash;
    const lx = Math.cos(ang) * -this.monLunge * 18;
    const ly = Math.sin(ang) * -this.monLunge * 18 * this.squash;
    const x = this.sx(m) + (Math.random() - 0.5) * this.monShake * 6 + kx + lx;
    const y = this.sy(m) + ky + ly;
    let def = m.def || {};
    let look = def.look;
    let scale = look?.scale || 1;
    let weapon = look?.weapon;
    if (m.isHero) {
      look = RANKS[m.rank || 0].look;
      // 상대 캐릭터의 무기를 든다 (캐릭터를 올리기 전 프로필이면 검)
      weapon = jobOf(m.job)?.look || 'sword';
      scale = 1;
    } else if (m.trial) {
      look = { ...SHADOW_LOOK, swords: RANKS[game.s.rank].look.swords };
      weapon = 'sword';
      scale = 1.3;
    }
    const boss = m.isBoss && !m.isRaid && !m.trial;
    if (m.grade === 1) scale *= 1.1;
    const fx = m.grade > 0 && this.fxLevel > 0 && m.alive;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    const shw = (m.isBoss ? 34 : 22) * (scale || 1);
    ctx.beginPath(); ctx.ellipse(x, y + 2, shw, shw * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    if (fx) this.drawMobFx(ctx, m, x, y, scale, false);
    // v160: 두목은 제 그림으로 (없으면 아래 종이 인형)
    const bossH = boss && m.def?.art && bossImg(m.def.art) ? bossHeight({ lord: game.map?.lord, king: game.map?.king }) : 0;
    if (bossH && drawBossSprite(this, ctx, m, x, y, alpha, { lord: !!game.map?.lord, king: !!game.map?.king, casting: game.tells?.length > 0,
      col: fxFor('', look || {}).col, flash: m === game.mon ? this.monFlash : 0, lunge: m === game.mon ? this.monLunge : 0, heroX: game.heroX })) {
      // 그렸다
    } else if (look) {
      ctx.translate(x, y + (m.alive ? 0 : (1 - alpha) * 10));
      ctx.scale(-scale, scale);
      if (look.ghost) ctx.globalAlpha = alpha * (0.55 + Math.sin(this.t * 3) * 0.1);
      // 등급 빛 번짐 — 같은 모습의 구운 그림을 빛깔 그림자와 함께 먼저 깐다
      if (fx) {
        const spr = fighterSprite(look, this.t + 1, weapon, this.dpr || 1);
        if (spr) { ctx.save(); ctx.shadowColor = this.mobCol(m); ctx.shadowBlur = m.grade >= 2 ? 18 : 10; ctx.drawImage(spr, -SPR.ox, -SPR.oy, SPR.w, SPR.h); ctx.restore(); }
      }
      drawFighter(ctx, 0, 0, look, {
        t: this.t + 1, flash: this.monFlash, lunge: this.monLunge, weapon,
        blade: m.isHero && m.weaponGrade >= 0 ? GRADES[m.weaponGrade].color : m.trial ? '#ef4444' : undefined,
        glow: m.trial || (m.isHero && m.weaponGrade >= 3),
      });
    } else if (def.beast) {
      const bs = (def.bscale || 1.7) * (m.grade === 1 ? 1.1 : 1);
      ctx.translate(x, y + (m.alive ? 0 : (1 - alpha) * 10));
      if (fx) { ctx.shadowColor = this.mobCol(m); ctx.shadowBlur = m.grade >= 2 ? 18 : 10; }
      drawCreature(ctx, def.beast, 0, 0, { t: this.t + 1, moving: !!m.move || this.monLunge > 0.2, flip: (m.x ?? 0) >= game.heroX, scale: bs });
      if (this.monFlash > 0.4) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * (this.monFlash - 0.4);
        drawCreature(ctx, def.beast, 0, 0, { t: this.t + 1, flip: (m.x ?? 0) >= game.heroX, scale: bs });
      }
    } else if (def.emoji) {
      const size = (m.isBoss ? 100 : 62);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 2, size * 0.42, 8, 0, 0, Math.PI * 2); ctx.fill();
      emoji(ctx, def.emoji, x, y + Math.sin(this.t * 3) * 3, size, true);
    }
    ctx.restore();

    if (fx) this.drawMobFx(ctx, m, x, y, scale, true);
    const top = bossH ? y - bossH - 6 : y - 118 * scale;
    if (m.elite && m.alive && this.fxLevel > 0) eliteAura(ctx, x, y, scale, this.t + (m.id || 0) * 0.37, this.squash);
    if (m.elite && m.alive) gradeTag(ctx, '정예', x, top - 26, '#fb923c');
    if (m.petEmoji) emoji(ctx, m.petEmoji, x + 58, y + 2 - Math.abs(Math.sin(this.t * 4 + 2)) * 6, 34, true);
    if (m.stun > 0 && m.alive) dizzy(ctx, x, y - 112 * scale, this.t);
    if (m.alive && !m.isRaid) {
      const bw = boss || m.trial || m.isHero ? 110 : 66;
      const mr = ratio(m.hp, m.maxHp);
      hpBar(ctx, x - bw / 2, top - 6, bw, 6, mr, boss || m.trial ? '#b91c1c' : '#ea580c', this.hpTrail(m, '_trail', mr));
      const name = m.isHero ? `${RANKS[m.rank || 0].name} ${m.name}` : m.trial ? '심마' : def.name || '';
      // 물린 카메라에서는 졸개 이름을 안 단다 — 옆 칸 무인의 이름표와 겹친다. 두목만.
      if (!this.overview || boss || m.trial) nameTag(ctx, name, x, top - 12, boss || m.trial);
      ccDots(ctx, m, x, top - 13);
    }
  }

  // ---------- 효과 ----------
  drawProjectiles(dt) {
    const { ctx } = this;
    const jcap = Math.round(80 * (this.budget ?? 1));
    if (this.projectiles.length > jcap) this.projectiles.splice(0, this.projectiles.length - jcap);
    for (const p of this.projectiles) {
      p.life -= dt;
      const k = 1 - Math.max(0, p.life / p.max);
      const tx = this.monX - 10;
      const ty = this.monY - 60;
      const x = p.x + (tx - p.x) * k;
      if (SHOT_DRAW[p.kind]) {
        SHOT_DRAW[p.kind](ctx, p, k, tx, ty);
      } else if (p.kind === 'orb') {
        const y = p.y + (ty - p.y) * k - Math.sin(k * Math.PI) * 40;
        ctx.fillStyle = 'rgba(249,168,212,0.9)'; circle(ctx, x, y, 6);
        ctx.fillStyle = 'rgba(249,168,212,0.35)'; circle(ctx, x - 9, y + 2, 5);
      } else {
        // 검기: 초승달 모양 — 타겟 쪽으로 날아간다
        const y = p.y + (ty - p.y) * k;
        const big = p.kind === 'wave';
        ctx.save();
        ctx.translate(x, y);
        ctx.strokeStyle = big ? `rgba(224,242,254,${0.9 - k * 0.4})` : `rgba(255,255,255,${0.75 - k * 0.5})`;
        ctx.lineWidth = big ? 6 : 3;
        ctx.beginPath();
        ctx.arc(-14, 0, big ? 30 : 18, -0.9, 0.9);
        ctx.stroke();
        ctx.restore();
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.life > 0);
  }

  // 바닥에 남는 장판(매화검진·환영진·만독강림·선풍장·취보난무).
  // 렌더러가 game.fields를 아예 안 읽고 있어서 **화면에 안 보였다.**
  drawFields(game) {
    const fs = game?.fields;
    if (!fs?.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of fs) {
      const k = Math.max(0, Math.min(1, f.life / f.max));
      // 독마의 장판은 독 웅덩이와 독무로 그린다 (skillfx.js)
      if (game.s.job === 'poison') {
        ctx.save();
        drawPoisonField(this, ctx, f, k, game.jobTier());
        ctx.restore();
        continue;
      }
      const col = f.id === 'jpoison' ? '134,239,172'
        : f.id === 'jfan' ? '216,180,254'
          : f.id === 'tornado' || f.id === 'jdrunk' ? '186,230,253' : '253,224,71';
      ctx.save();
      ctx.translate(this.sx(f), this.sy(f));
      ctx.scale(1, this.squash);
      // 천천히 돈다 — 멈춰 있으면 바닥 무늬로 보인다
      ctx.rotate((performance.now() / 1000) * (f.vx || f.vy ? 1.1 : 0.45));
      if (!(fxReady() && putFx(ctx, 'fx-field', col, f.r * 2.1, 0.35 + k * 0.5))) {
        ctx.strokeStyle = `rgba(${col},${0.5 * k + 0.2})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // 수문장 경고 — 붉은 바닥이 안쪽부터 차오르고, 다 차면 터진다. 빨리 벗어나야 한다.
  // 무공 범위 (v157) — 맞는 판정과 같은 타원(세로는 /0.75)으로 그린다. 금빛 점선 = 맞는 곳, 옅은 선 = 과녁까지 닿는 거리.
  drawRanges(game, dt) {
    const { ctx } = this;
    const ry = this.squash / 0.75;
    const ring = (x, y, r, a, dash, fill) => {
      ctx.setLineDash(dash || []);
      ctx.strokeStyle = `rgba(253,224,71,${a})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * ry, 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = `rgba(253,224,71,${a * 0.14})`; ctx.fill(); }
      ctx.stroke();
    };
    ctx.save();
    ctx.lineWidth = 2;
    const pv = this.rangePreview;
    if (pv && game) {
      const me = { x: game.heroX, y: game.heroY };
      const tg = game.mon?.alive ? game.mon : null;
      const c = pv.center === 'target' && tg ? tg : me;
      if (pv.reach > 0 && pv.reach < 9999) ring(this.sx(me), this.sy(me), pv.reach, 0.45, [4, 6], false);
      if (pv.r > 0) ring(this.sx(c), this.sy(c), pv.r, 0.95, [10, 6], true);
      if (pv.center === 'target' && tg) {
        ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(253,224,71,0.6)';
        ctx.beginPath(); ctx.moveTo(this.sx(me), this.sy(me)); ctx.lineTo(this.sx(tg), this.sy(tg)); ctx.stroke();
      }
    }
    for (const g of this.rangeRings) {
      g.life -= dt;
      const k = Math.max(0, g.life / g.max);
      ring(this.sx(g), this.sy(g), g.r, 0.8 * k, [10, 6], true);
    }
    this.rangeRings = this.rangeRings.filter((g) => g.life > 0);
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawTells(game) {
    const ts = game?.tells;
    if (!ts?.length) return;
    const { ctx } = this;
    const sq = this.squash;
    const blink = 0.5 + 0.5 * Math.sin(this.t * 22);
    ctx.save();
    for (const tl of ts) {
      if (tl.wait > 0) continue;
      if (!tl._fx && this.castFx) tl._fx = this.castFx;      // v160: 그 초식의 그림
      const k = 1 - Math.max(0, tl.t / tl.max);           // 0 → 1 차오른다
      const urgent = tl.t < 0.35;
      // v214: 내가 그 안에 서 있으면 테두리가 희게 빠르게 깜빡인다 — '나한테 오는 것'과 '남 일'을 가른다
      const inside = game.heroHp > 0 && tellCovers(tl, game.heroX, game.heroY);
      const fastBlink = 0.5 + 0.5 * Math.sin(this.t * 34);
      const edge = inside ? `rgba(254,226,226,${0.65 + fastBlink * 0.35})` : `rgba(248,113,113,${urgent ? 0.6 + blink * 0.4 : 0.85})`;
      // 차오르는 앞머리 — 얼마나 남았는지는 채움보다 '움직이는 금'이 더 잘 읽힌다
      const front = `rgba(255,237,213,${0.55 + k * 0.45})`;
      // 터지기 직전에는 채움 전체가 한 번 더 붉게 번쩍
      const fillA = 0.22 + k * 0.25 + (urgent ? 0.18 * blink : 0);
      ctx.lineWidth = inside || urgent ? 3.5 : 2.5;
      // 테두리는 흐르는 점선 — 터지기 직전엔 꽉 찬 선
      ctx.setLineDash(urgent ? [] : [12, 7]);
      ctx.lineDashOffset = -this.t * 40;
      if (tl.kind === 'circle' || tl.kind === 'donut') {
        const x = this.sx(tl), y = this.sy(tl);
        const r1 = tl.kind === 'donut' ? tl.r1 : tl.r, r0 = tl.kind === 'donut' ? tl.r0 : 0;
        ctx.fillStyle = 'rgba(220,38,38,0.16)';
        ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * sq, 0, 0, Math.PI * 2);
        if (r0) ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        // 차오르는 안쪽 (고리는 안에서 밖으로)
        const rf = r0 + (r1 - r0) * k;
        ctx.fillStyle = `rgba(239,68,68,${fillA})`;
        ctx.beginPath(); ctx.ellipse(x, y, rf, rf * sq, 0, 0, Math.PI * 2);
        if (r0) ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * sq, 0, 0, Math.PI * 2); ctx.stroke();
        if (rf > r0 + 2 && k < 0.98) {
          ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = front;
          ctx.beginPath(); ctx.ellipse(x, y, rf, rf * sq, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (r0) { ctx.strokeStyle = 'rgba(134,239,172,0.8)'; ctx.beginPath(); ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (tl.kind === 'cone') {
        // 부채꼴 (v168) — 평면의 각을 화면 납작함대로 그린다
        const x = this.sx(tl), y = this.sy(tl);
        const sector = (rr) => {
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let i = 0; i <= 24; i++) { const a = tl.a - tl.half + (2 * tl.half * i) / 24; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * sq); }
          ctx.closePath();
        };
        ctx.fillStyle = 'rgba(220,38,38,0.16)'; sector(tl.r); ctx.fill();
        ctx.fillStyle = `rgba(239,68,68,${fillA})`; sector(tl.r * k); ctx.fill();
        ctx.strokeStyle = edge; sector(tl.r); ctx.stroke();
        if (k > 0.04 && k < 0.98) {
          const rr = tl.r * k;
          ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 2; ctx.strokeStyle = front; ctx.beginPath();
          for (let i = 0; i <= 24; i++) { const a2 = tl.a - tl.half + (2 * tl.half * i) / 24; const px = x + Math.cos(a2) * rr, py = y + Math.sin(a2) * rr * sq; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
          ctx.stroke(); ctx.restore();
        }
      } else if (tl.kind === 'line') {
        const a = { x: tl.x0, y: tl.y0 }, b = { x: tl.x1, y: tl.y1 };
        const ax = this.sx(a), ay = this.sy(a), bx = this.sx(b), by = this.sy(b);
        const dx = tl.x1 - tl.x0, dy = tl.y1 - tl.y0, L = Math.hypot(dx, dy) || 1;
        const nx = (-dy / L) * tl.w / 2, ny = (dx / L) * tl.w / 2 * sq;
        const quad = (f) => { ctx.beginPath(); ctx.moveTo(ax + nx, ay + ny); ctx.lineTo(ax + (bx - ax) * f + nx, ay + (by - ay) * f + ny); ctx.lineTo(ax + (bx - ax) * f - nx, ay + (by - ay) * f - ny); ctx.lineTo(ax - nx, ay - ny); ctx.closePath(); };
        ctx.fillStyle = 'rgba(220,38,38,0.16)'; quad(1); ctx.fill();
        ctx.fillStyle = `rgba(239,68,68,${fillA})`; quad(k); ctx.fill();
        ctx.strokeStyle = edge; quad(1); ctx.stroke();
        if (k > 0.04 && k < 0.98) {
          const fx0 = ax + (bx - ax) * k, fy0 = ay + (by - ay) * k;
          ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.strokeStyle = front;
          ctx.beginPath(); ctx.moveTo(fx0 + nx, fy0 + ny); ctx.lineTo(fx0 - nx, fy0 - ny); ctx.stroke(); ctx.restore();
        }
      }
      ctx.setLineDash([]);
      if (tl._fx && this.fxLevel > 0) drawTellFx(this, ctx, tl, k);
      // 맞으면 쓰러질 초식(v168)은 '치명' — 고정 피해라 체력·방어가 높으면 안 뜬다
      if (tl.pred && game.heroHp > 0 && tl.pred >= game.heroHp) {
        const c = tl.kind === 'line' ? { x: (tl.x0 + tl.x1) / 2, y: (tl.y0 + tl.y1) / 2 } : tl.kind === 'cone' ? { x: tl.x + Math.cos(tl.a) * tl.r * 0.5, y: tl.y + Math.sin(tl.a) * tl.r * 0.5 } : tl;
        ctx.save();
        ctx.globalAlpha = 0.55 + blink * 0.45;
        // 글꼴에 따라 해골 그림 글자가 빈 네모로 나온다 — 글자로
        ctx.font = `900 ${tl.ult ? 26 : 20}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(69,10,10,0.9)';
        ctx.strokeText('치명', this.sx(c), this.sy(c) + 8);
        ctx.fillStyle = '#fee2e2';
        ctx.fillText('치명', this.sx(c), this.sy(c) + 8);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawEffects(dt, game) {
    const { ctx } = this;
    // 동시에 그리는 연출 상한 (v182) — 광역기가 수십 번 겹치면 한 프레임에 수백 개가 쌓였다. 오래된 것부터 뺀다.
    const ecap = Math.round(90 * (this.budget ?? 1));
    if (this.effects.length > ecap) this.effects.splice(0, this.effects.length - ecap);
    for (const e of this.effects) {
      e.life -= dt;
      const k = Math.max(0, e.life / e.max);
      // 무공 빛은 더하기로 겹친다 — 겹칠수록 밝아져야 '빛'으로 읽힌다.
      // 화면을 덮는 먹물(회귀)만 보통 합성이다.
      ctx.globalCompositeOperation = e.kind === 'regress' ? 'source-over' : 'lighter';
      // 초식 연출 그림 (skillfx.js)
      const fxDraw = FX[e.kind];
      if (fxDraw) {
        if (e.life > 0) { ctx.save(); fxDraw(this, ctx, e, k); ctx.restore(); }
        continue;
      }
      if (e.kind === 'area') {
        // 바닥에 퍼지는 원 — 탑다운이라 원이 그대로 "사거리"로 읽힌다
        const p = 1 - k;
        // 문파 기운이 실린 장판은 그 문파 빛깔이다
        const col = e.col || (e.id === 'thunder' ? '254,240,138' : e.id === 'meteor' ? '224,242,254' : '253,224,71');
        ctx.save();
        // 멀리서 쏘는 캐릭터의 광역은 겨눈 적 자리에 퍼진다
        if (e.at) ctx.translate(this.sx(e.at), this.sy(e.at)); else ctx.translate(this.heroX, this.groundY);
        ctx.scale(1, this.squash);
        const r = e.r * (0.25 + p * 0.75);
        // 그림이 있으면 흑백 고리에 색을 입혀 쓴다
        // 흑백 마스크는 벡터 고리보다 옅게 읽힌다. 밝기를 올려 준다.
        if (fxReady() && putFx(ctx, 'fx-ring', col, r * 2.2, Math.min(1, k * 1.7))) { ctx.restore(); continue; }
        const g2 = ctx.createRadialGradient(0, 0, r * 0.3, 0, 0, r);
        g2.addColorStop(0, `rgba(${col},0)`);
        g2.addColorStop(0.75, `rgba(${col},${0.16 * k})`);
        g2.addColorStop(1, `rgba(${col},${0.34 * k})`);
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(${col},${0.85 * k})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        // 안쪽으로 한 겹 더 — 링이 두 개여야 퍼지는 게 보인다
        if (p > 0.25) {
          ctx.strokeStyle = `rgba(${col},${0.4 * k})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      } else if (e.kind === 'beam') {
        ctx.save();
        ctx.translate(this.heroX, this.groundY - 56);
        ctx.rotate(e.a || 0);
        putFx(ctx, 'fx-beam', e.col || '186,230,253', 420 * (0.5 + (1 - k) * 0.6), k);
        ctx.restore();
      } else if (e.kind === 'blink') {
        ctx.save();
        ctx.translate(this.heroX, this.groundY - 58);
        putFx(ctx, 'fx-blink', e.col || '226,232,240', 200, Math.min(1, k * 1.5));
        ctx.restore();
      } else if (e.kind === 'aura') {
        ctx.save();
        ctx.translate(this.heroX, this.groundY - 26);
        putFx(ctx, 'fx-aura', e.col || '252,165,165', 120, k * 0.85);
        ctx.restore();
      } else if (e.kind === 'swirl') {
        ctx.save();
        ctx.translate(this.heroX, this.groundY - 40);
        putFx(ctx, 'fx-swirl', e.col || '186,230,253', 170, k * 0.9);
        ctx.restore();
      } else if (e.kind === 'burst') {
        ctx.save();
        ctx.translate(this.monX, this.monY - 56);
        const w = (e.big ? 150 : 86) * (0.55 + (1 - k) * 0.7);
        if (!(fxReady() && putFx(ctx, 'fx-burst', e.col || (e.crit ? '254,202,202' : '254,243,199'), w, k))) {
          ctx.fillStyle = `rgba(254,243,199,${k * 0.5})`;
          ctx.beginPath(); ctx.arc(0, 0, w * 0.22, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      } else if (e.kind === 'punch') {
        // 주먹 충격 — 닿은 자리에 별처럼 터지는 빛 + 주먹이 지나온 쪽으로 짧은 속도선
        const p = 1 - k;
        const x = this.sx({ x: e.wx }) - e.face * 14, y = this.sy({ y: e.wy }) - 58;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';
        const R = (e.big ? 30 : 20) * (0.5 + p);
        ctx.fillStyle = `rgba(253,224,71,${0.9 * k})`;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8 + e.tilt; const r = i % 2 ? R * 0.35 : R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${k})`;
        ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(253,186,116,${0.8 * k})`;
        ctx.lineWidth = 2.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-e.face * (R + 6), i * 7 + e.tilt * 8); ctx.lineTo(-e.face * (R + 26 + p * 10), i * 7 + e.tilt * 8); ctx.stroke(); }
        ctx.restore();
      } else if (e.kind === 'swing') {
        // 평타 궤적 — 무인 앞에 반달 모양으로 한 번 그어지고 사라진다.
        // 찌르기·정권(dir 0)은 반달 대신 앞으로 뻗는 한 줄기.
        const p = 1 - k;                       // 0 → 1
        ctx.save();
        ctx.translate(this.heroX + Math.cos(e.ang) * 18, this.groundY - 62 + Math.sin(e.ang) * 18 * this.squash);
        if (e.face < 0) ctx.scale(-1, 1);
        ctx.rotate(e.tilt);
        if (e.big) ctx.scale(1.4, 1.4);          // v209 마무리 한 방은 궤적도 크게
        ctx.globalCompositeOperation = 'lighter';
        if (!e.dir) {
          const len = 30 + p * 46;
          const g2 = ctx.createLinearGradient(0, 0, len, 0);
          g2.addColorStop(0, `rgba(${e.col},0)`);
          g2.addColorStop(1, `rgba(${e.col},${0.85 * k})`);
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.moveTo(4, -3); ctx.lineTo(len, 0); ctx.lineTo(4, 3); ctx.closePath(); ctx.fill();
        } else {
          // 반달: 앞 위(-1.2)에서 앞 아래(+1.0)로 쓸어 내린다. 지나간 만큼만 그린다.
          const a0 = e.dir > 0 ? -1.25 : 1.0;
          const a1 = e.dir > 0 ? 1.0 : -1.25;
          const head = a0 + (a1 - a0) * Math.min(1, p * 1.6);
          const tail = a0 + (a1 - a0) * Math.max(0, p * 1.6 - 0.75);
          const R = 44;
          ctx.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = `rgba(${e.col},${(0.55 - i * 0.17) * k})`;
            ctx.lineWidth = 7 - i * 2;
            ctx.beginPath();
            ctx.arc(0, 0, R - i * 5, Math.min(head, tail), Math.max(head, tail));
            ctx.stroke();
          }
        }
        ctx.restore();
      } else if (e.kind === 'cut') {
        // 베기 자국: 먹선
        ctx.save();
        ctx.translate(this.monX - 6, this.monY - 62);
        ctx.rotate(e.a);
        if (fxReady() && putFx(ctx, 'fx-slash', e.crit ? '248,113,113' : e.col || '255,255,255',
          (e.crit ? 78 : 56) * (0.7 + k * 0.4), Math.min(1, k * 1.6))) { ctx.restore(); continue; }
        ctx.strokeStyle = e.crit ? `rgba(185,28,28,${k})` : `rgba(255,255,255,${k * 0.9})`;
        ctx.lineWidth = (e.crit ? 7 : 4) * k + 1;
        ctx.beginPath(); ctx.moveTo(-34, -24); ctx.quadraticCurveTo(0, 6, 34, 22); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'thunder') {
        if (fxReady()) {
          ctx.save();
          ctx.translate(this.monX, this.monY - 60);
          putFx(ctx, 'fx-bolt', '254,240,138', 120, Math.min(1, k * 1.8));
          ctx.restore();
          continue;
        }
        ctx.strokeStyle = `rgba(254,240,138,${k})`;
        ctx.lineWidth = 5;
        ctx.shadowColor = '#fde047';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        let x = this.monX + (Math.random() - 0.5) * 20;
        ctx.moveTo(x, 0);
        for (let y = 0; y < this.monY - 40; y += 26) { x += (Math.random() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (e.kind === 'frost') {
        const p = 1 - k;
        const q = Math.min(1, p * 2);
        const x = this.heroX + (this.monX - this.heroX) * q;
        const fy = this.groundY + (this.monY - this.groundY) * q;
        ctx.fillStyle = `rgba(186,230,253,${0.55 * k})`;
        ctx.beginPath(); ctx.ellipse(x, fy - 60, 22 + p * 10, 34, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(224,242,254,${0.3 * k})`;
        ctx.fillRect(0, 0, this.w, this.h);
      } else if (e.kind === 'swords') {
        // 만검귀종: 하늘에서 검이 쏟아진다
        const p = 1 - k;
        for (const [a, b] of e.seeds) {
          const start = b * 0.5;
          const q = Math.max(0, Math.min(1, (p - start) / 0.35));
          if (q <= 0) continue;
          const sx = this.heroX + (a - 0.5) * 300;
          const sy = -40 + (this.groundY + (b - 0.5) * 300 * this.squash - 40) * q;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(Math.PI);
          drawJian(ctx, 0, 0, '#e0f2fe', true, 0.9);
          ctx.restore();
        }
        if (p > 0.55 && !e.boomed) { e.boomed = true; this.shake = 0.6; this.ink(this.monX, this.monY - 30, 30, '#0c4a6e', 260); }
      } else if (e.kind === 'qi') {
        for (let i = 0; i < 10; i++) {
          const a = this.t * 5 + i * 0.63;
          const r = 30 + (1 - k) * 20;
          ctx.fillStyle = `rgba(${e.color},${k * 0.8})`;
          circle(ctx, this.heroX + Math.cos(a) * r, this.groundY - 60 + Math.sin(a) * r * 0.6 - (1 - k) * 30, 3);
        }
      } else if (e.kind === 'gale') {
        ctx.strokeStyle = `rgba(255,255,255,${k * 0.7})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const yy = this.groundY - 15 - i * 18;
          const xx = this.heroX - 60 - ((this.t * 400 + i * 40) % 90);
          ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + 40, yy); ctx.stroke();
        }
      } else if (e.kind === 'pillar') {
        // 빛기둥 — 가운데가 넓어졌다 좁아지고, 고리가 위로 오르고, 불티가 흩어진다 (v114)
        const p = 1 - k;
        const wid = 30 + Math.sin(Math.min(1, p * 2) * Math.PI) * 26;
        const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
        g.addColorStop(0, 'rgba(253,224,71,0)');
        g.addColorStop(0.7, `rgba(253,224,71,${k * 0.45})`);
        g.addColorStop(1, `rgba(255,251,235,${k * 0.8})`);
        ctx.fillStyle = g;
        ctx.fillRect(this.heroX - wid, 0, wid * 2, this.groundY);
        ctx.fillStyle = `rgba(255,255,255,${k * 0.25})`;
        ctx.fillRect(this.heroX - wid * 0.2, 0, wid * 0.4, this.groundY);
        if (this.fxLevel > 0) {
          for (let i = 0; i < 3; i++) {
            const q = (p * 1.4 + i * 0.22) % 1;
            ctx.strokeStyle = `rgba(253,224,71,${k * (1 - q)})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(this.heroX, this.groundY - q * 170, 40 + q * 20, 12 + q * 5, 0, 0, Math.PI * 2); ctx.stroke();
          }
          for (let i = 0; i < 14; i++) {
            const a = i * 0.449 + 0.3;
            const r = p * (60 + (i % 4) * 22);
            ctx.fillStyle = `rgba(254,240,138,${k})`;
            circle(ctx, this.heroX + Math.cos(a * 4) * r, this.groundY - 40 - Math.abs(Math.sin(a * 4)) * r - p * 30, 2.4 * k + 0.6);
          }
        }
      } else if (e.kind === 'regress') {
        // 먹물이 화면을 덮었다가 걷힌다
        const p = 1 - k;
        const cover = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        ctx.fillStyle = `rgba(8,6,4,${Math.min(0.95, cover)})`;
        ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    this.effects = this.effects.filter((e) => e.life > 0);
    void game;
  }

  // 무공이 지나간 길. 연환벽력은 꺾이는 번개, 발도돌격은 곧은 잔상.
  drawPaths(dt) {
    if (!this.paths.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of this.paths) {
      p.life -= dt;
      const k = Math.max(0, p.life / p.max);
      if (p.kind === 'chain') {
        // 두 번 긋는다 — 굵고 흐린 것 위에 가늘고 밝은 것
        for (const [lw, col] of [[7, `rgba(253,224,71,${0.22 * k})`], [2.5, `rgba(255,251,235,${0.9 * k})`]]) {
          ctx.lineWidth = lw;
          ctx.strokeStyle = col;
          ctx.beginPath();
          ctx.moveTo(p.pts[0].x, p.pts[0].y - 46);
          for (let i = 1; i < p.pts.length; i++) {
            const a = p.pts[i - 1], b = p.pts[i];
            // 가운데를 흔들어 번개처럼 꺾는다
            const mx = (a.x + b.x) / 2 + (((i * 37) % 19) - 9) * 1.6;
            const my = (a.y + b.y) / 2 - 46 + (((i * 53) % 17) - 8) * 1.4;
            ctx.quadraticCurveTo(mx, my, b.x, b.y - 46);
          }
          ctx.stroke();
        }
      } else {
        const a = p.pts[0], b = p.pts[p.pts.length - 1];
        ctx.lineWidth = 26 * k;
        ctx.strokeStyle = `rgba(248,250,252,${0.3 * k})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y - 40); ctx.lineTo(b.x, b.y - 40); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * k})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y - 40); ctx.lineTo(b.x, b.y - 40); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this.paths = this.paths.filter((p) => p.life > 0);
  }

  // 맞은 자리에 뜨는 짧은 빛. 더하기로 겹쳐 밝아진다.
  //
  // 빛 한 덩이를 그릴 때마다 radial gradient를 새로 만들면 비싸다 —
  // 수십 개가 동시에 뜨니 그것만 1ms가 나왔다. 색마다 한 장 구워 두고 붙인다.
  drawSparks(dt) {
    if (!this.sparks.length) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      s.life -= dt;
      const k = Math.max(0, s.life / s.max);
      const r = s.r * (1.4 - k * 0.4);
      const img = sparkImage(s.color);
      ctx.globalAlpha = Math.max(0, k);
      ctx.drawImage(img, s.x - r, s.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    this.sparks = this.sparks.filter((s) => s.life > 0);
    // 한 번에 수십 마리가 맞으면 빛이 수십 개가 된다. 최근 것만 남긴다.
    if (this.sparks.length > 12) this.sparks.splice(0, this.sparks.length - 12);
  }

  drawParticles(dt) {
    const { ctx } = this;
    for (const p of this.particles) {
      p.life -= dt;
      // v210: 은자 덩이는 튀고 한 번 튕긴 뒤(0.45초) 무인에게 빨려 든다 — 닿으면 반짝하고 사라진다
      if (p.ingot && p.life < 0.55 && !p.home) { p.home = true; p.life = 0.8; }
      if (p.home) {
        const tx = this.heroX, ty = this.groundY - 56;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
        p.hv = Math.min(1400, (p.hv || 120) + 2600 * dt);
        p.vx += (dx / d * p.hv - p.vx) * Math.min(1, dt * 10);
        p.vy += (dy / d * p.hv - p.vy) * Math.min(1, dt * 10);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (d < 16) {
          p.life = 0;
          if (this.fxLevel > 0 && (this._glintT || 0) <= this.t) { this._glintT = this.t + 0.06; this.sparks.push({ x: tx + (Math.random() - 0.5) * 10, y: ty, life: 0.18, max: 0.18, r: 16, color: '#f1f5f9' }); }
        }
      } else {
        // 흙먼지는 떨어지지 않고 퍼지며 느려진다
        if (p.dust) { p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; p.size += dt * 16; } else p.vy += 520 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      if (p.ingot && !p.home && p.y > this.groundY) { p.y = this.groundY; p.vy *= -0.35; p.vx *= 0.6; }
      ctx.globalAlpha = p.home ? 1 : Math.max(0, Math.min(1, p.life / 0.4)) * (p.dust ? 0.45 : 1);
      if (p.ingot) {
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - 4); ctx.quadraticCurveTo(p.x, p.y + 6, p.x + 7, p.y - 4); ctx.lineTo(p.x + 4, p.y - 1); ctx.lineTo(p.x - 4, p.y - 1); ctx.fill();
        ctx.fillStyle = '#f9fafb'; circle(ctx, p.x, p.y - 3, 2.5);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 0.7, p.size * (p.drop ? 1 : 0.7), Math.atan2(p.vy, p.vx), 0, Math.PI * 2); ctx.fill();
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    const pcap = Math.round(240 * (this.budget ?? 1));
    if (this.particles.length > pcap) this.particles.splice(0, this.particles.length - pcap);
    ctx.globalAlpha = 1;
  }

  // 떠오르는 글자. 자리는 들판 단위로 받아서 z를 곱해 진짜 화면에 쓴다.
  drawFloats(dt, z = 1) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const f of this.floats) {
      f.life -= dt;
      f.y += (f.vy ?? -40) * dt;
      f.x += (f.vx || 0) * dt;
      if (f.vy != null) { f.vy *= Math.max(0, 1 - dt * 5.5); f.vx *= Math.max(0, 1 - dt * 5); }
      const k = Math.max(0, f.life / f.max);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      // 처음 0.12초에 크게 튀었다가 제 크기로 — 뒤로 갈수록 살짝 작아진다
      const age = f.max - f.life;
      const pop = age < 0.12 ? 1.45 - age / 0.12 * 0.45 : 1 - Math.max(0, 0.4 - k) * 0.25;
      // v182: 글자는 처음 한 번만 가장 큰 크기(튀어 오를 때 1.45배)로 구워 두고 줄여 찍는다 —
      // 매 프레임 글꼴 크기가 바뀌어 숫자마다 글꼴 해석·글자 모양 잡기를 다시 했다
      const spr = f._spr || (f._spr = textSprite(f.text, f.brush ? `${f.size * 1.45 * 1.2}px ${BRUSH}` : `900 ${f.size * 1.45}px system-ui, sans-serif`,
        f.color, 4 * 1.45, ctx.getTransform().a));
      // v212: 창이 열려 들판이 좁으면 숫자를 작게 — 남은 들판을 숫자가 다 덮었다
      const sc = pop / 1.45 * (1 - 0.3 * (this.sheetK || 0));
      ctx.drawImage(spr.cv, f.x * z - spr.ax * sc, f.y * z - spr.ay * sc, spr.w * sc, spr.h * sc);
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    ctx.globalAlpha = 1;
  }

  // 무공 이름 한자를 화면 가운데에 크게
  drawHanja(dt) {
    const hj = this.hanja;
    if (!hj || !hj.text) { this.hanja = null; return; }
    hj.life -= dt;
    if (hj.life <= 0) { this.hanja = null; return; }
    const { ctx, w } = this;
    const k = hj.life / hj.max;
    const size = Math.min(78, (w * 0.86) / Math.max(2, hj.text.length)) * (hj.scale || 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 2.5) * 0.92;
    ctx.font = `${size * (1 + (1 - k) * 0.12)}px ${BRUSH}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    // 초식 연출은 이름을 화면 왼쪽에 세로로 쓴다 — 가운데에 크게 쓰면
    // 칼이 닿는 자리와 맞은 숫자를 가린다. 족자처럼 위에서 아래로.
    if (hj.vertical) {
      const n = [...hj.text].length;
      // v212: 창이 열리면 들판은 위쪽 4할뿐 — 족자를 그 안에 들어가게 작게(위로 붙여) 쓴다
      const sk = this.sheetK || 0;
      const vs = Math.min(40 - 14 * sk, (this.h * (0.5 - 0.26 * sk)) / n);
      ctx.font = `${vs}px ${BRUSH}`;
      ctx.lineWidth = 6;
      const x0 = Math.max(26, w * 0.09);
      const y0 = this.h * (0.2 - 0.05 * sk) - (1 - Math.min(1, (1 - k) * 6)) * 14;
      [...hj.text].forEach((ch, i) => {
        ctx.strokeText(ch, x0, y0 + i * vs * 1.02);
        ctx.fillStyle = hj.color;
        ctx.fillText(ch, x0, y0 + i * vs * 1.02);
      });
      ctx.restore();
      return;
    }
    const hy = this.h * (hj.y ?? 0.42);
    ctx.strokeText(hj.text, w / 2, hy);
    ctx.fillStyle = hj.color;
    ctx.fillText(hj.text, w / 2, hy);
    ctx.restore();
  }

  // ---------- 두목 등장 ----------
  // 화면이 어두워지고 위아래에 먹띠가 내려온다. 두목이 선 자리에 빛기둥이 서고,
  // 한가운데 이름이 붓으로 크게 박힌다 — 낙관과 한두 줄이 뒤따른다.
  // 게임 쪽에서는 이 동안 들판이 멈추고 두목은 맞지도 않는다(introT · freezeT).
  // full이 아니면(같은 구역에서 다시 난 두목) 먹띠·글줄 없이 이름만 짧게 찍는다.
  // 십이지왕: 한자 이름(劍王) · '第一王' 낙관 · 본명과 독문무공 · 핏빛
  startKingIntro(king, at, full = true) {
    const HN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    this.startIntro({
      stamp: king.hanja, seal: `第${HN[king.no]}王`,
      line1: `십이지왕 제${king.no}왕 ${king.title}${king.real ? ` · ${king.real}` : ''}`,
      line2: king.skill ? `독문무공 〈${king.skill}〉` : '',
      glow: '239,68,68', pillar: '248,113,113', core: '254,202,202', ink: '127,29,29', text: '#fef2f2', sub: '#fecaca',
      dur: full ? 3.2 : 1.4, full,
    }, at);
  }
  // 보통 두목: 한글 이름 · '頭目' 낙관 · 지역과 레벨 · 쇳빛
  startBossIntro(info, at, full = true) {
    this.startIntro({
      stamp: info.name, seal: '頭目',
      line1: `${info.zoneName}의 두목 · Lv.${info.lv}`, line2: '',
      glow: '251,146,60', pillar: '253,186,116', core: '254,243,199', ink: '67,20,7', text: '#fff7ed', sub: '#fed7aa',
      dur: full ? 2.2 : 1.2, full,
    }, at);
  }
  // v229: 사냥터 기운이 화면에 보인다 — 혹한은 눈 · 열사는 오르는 열기 · 독은 떠도는 포자 · 음기·마기는 검보랏빛 연기 ·
  // 좋은 기운(대숲 바람·운무·불광·야시장)은 떠도는 잎·안개·빛. 화면 좌표, 상태 없이 시간으로(무게 없음).
  drawAmbient(game) {
    if (this.fxLevel <= 0 || !game?.map) return;
    const env = envOf(game.map);
    if (!env) return;
    const { ctx, w, h } = this;
    const t = this.t;
    const kind = env.type || (env.name.includes('바람') || env.name.includes('풍') ? 'wind' : env.name.includes('운무') ? 'mist' : 'glow');
    const N = Math.round((kind === 'mist' ? 7 : 32) * (this.budget ?? 1));
    ctx.save();
    for (let i = 0; i < N; i++) {
      const r1 = Math.sin(i * 12.9898) * 43758.5453 % 1, r2 = Math.sin(i * 78.233) * 12543.21 % 1;
      const a = Math.abs(r1), b = Math.abs(r2);
      if (kind === 'cold') {          // 눈 — 흔들리며 내린다
        const y = ((t * (28 + b * 30) + a * h) % (h + 20)) - 10;
        const x = (a * w + Math.sin(t * 1.3 + i) * 18 + w) % w;
        // 흰 설원 위에서도 보이게 옅은 잿빛 테두리
        ctx.globalAlpha = 0.7 + b * 0.3; ctx.fillStyle = '#f8fafc'; ctx.strokeStyle = 'rgba(100,116,139,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, 2 + b * 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (kind === 'heat') {   // 열기 — 주황 알갱이가 흔들리며 오른다
        const y = h - ((t * (20 + b * 25) + a * h) % (h + 20));
        const x = a * w + Math.sin(t * 2 + i) * 10;
        ctx.globalAlpha = 0.75 * Math.sin((y / h) * Math.PI); ctx.fillStyle = '#fdba74';
        putGlow(ctx, '249,115,22', x, y, 7 + b * 3, 0.6);
        ctx.beginPath(); ctx.arc(x, y, 2.2 + b * 2, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'poison') { // 포자 — 연둣빛이 느리게 떠돈다
        const x = (a * w + t * (8 + b * 10)) % w, y = (b * h + Math.sin(t * 0.7 + i) * 30 + h) % h;
        ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 2 + i); ctx.fillStyle = '#a3e635';
        ctx.beginPath(); ctx.arc(x, y, 2 + b * 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (kind === 'dark') {   // 검보랏빛 연기 — 크고 옅게 피어오른다
        const y = h - ((t * (12 + b * 10) + a * h) % (h + 60)) + 30;
        const x = a * w + Math.sin(t * 0.8 + i) * 24;
        const rr = 18 + b * 26;
        ctx.globalAlpha = 1; putGlow(ctx, '76,29,149', x, y, rr, 0.3);
      } else if (kind === 'wind') {   // 잎 — 옆으로 날려 간다
        const x = (t * (60 + b * 50) + a * w) % (w + 20) - 10, y = (b * h + Math.sin(t * 2 + i) * 14 + h) % h;
        ctx.globalAlpha = 0.75; ctx.fillStyle = '#86efac';
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (kind === 'mist') {   // 안개 — 큰 흰 덩이가 느리게 흐른다
        const x = (t * (6 + b * 6) + a * w * 1.4) % (w + 240) - 120, y = b * h;
        const rr = 110 + b * 80;
        ctx.globalAlpha = 1; putGlow(ctx, '241,245,249', x, y, rr, 0.16);
      } else {                        // 빛 — 금빛 반딧불이 깜빡인다
        const x = (a * w + Math.sin(t * 0.5 + i) * 20 + w) % w, y = (b * h + Math.cos(t * 0.4 + i) * 20 + h) % h;
        ctx.globalAlpha = Math.max(0, Math.sin(t * 1.8 + i * 1.7)) * 0.85; ctx.fillStyle = '#fde68a';
        putGlow(ctx, '250,204,21', x, y, 7, 0.7);
        ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
  // v216: 쓰러진 동안 화면 가장자리가 붉게 물들었다가, 일어서며 걷힌다
  drawDownVignette() {
    if (!(this.heroDownT > 0)) return;
    const k = 1 - this.heroDownT / HERO_DOWN_SEC;
    const a = (k < 0.15 ? k / 0.15 : k < 0.6 ? 1 : Math.max(0, 1 - (k - 0.6) / 0.4)) * 0.55;
    if (a <= 0.01) return;
    const { ctx, w, h } = this;
    const v = this._downVg || (this._downVg = (() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      const rg = g.createRadialGradient(128, 128, 60, 128, 128, 182);
      rg.addColorStop(0, 'rgba(60,0,0,0)'); rg.addColorStop(1, 'rgba(90,6,6,1)');
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
      return c;
    })());
    ctx.save(); ctx.globalAlpha = a; ctx.drawImage(v, 0, 0, w, h); ctx.restore();
  }
  startIntro(spec, at) {
    this.kingIntro = { k: spec, at: at ? { x: at.x, y: at.y } : null, t: 0, dur: spec.dur, hit: false };
    this.shake = Math.max(this.shake, spec.full ? 0.5 : 0.25);
  }
  drawKingIntro(dt, z = 1) {
    const ki = this.kingIntro;
    if (!ki) return;
    ki.t += dt;
    if (ki.t >= ki.dur) { this.kingIntro = null; return; }
    const { ctx, w, h } = this;
    const t = ki.t;
    const k = ki.k;
    const full = k.full;
    // 짧은 판은 박자를 당긴다
    const sp = full ? 1 : 1.6;
    const A = Math.min(1, t / (0.35 / sp), (ki.dur - t) / (full ? 0.5 : 0.35));
    // v215: 땅울림 — 기둥이 서는 동안 땅이 잘게 떨고(우르르), 이름이 박히는 순간 발밑이 갈라지며 흙먼지가 터진다
    if (!ki.hit && t > 0.12 / sp) this.shake = Math.max(this.shake, (full ? 0.22 : 0.12) * (0.6 + 0.4 * Math.sin(t * 60)));
    if (!ki.hit && t > 0.38 / sp) {
      ki.hit = true; this.flash = Math.max(this.flash, full ? 0.35 : 0.15); this.shake = Math.max(this.shake, full ? 0.8 : 0.35);
      if (ki.at && this.fxLevel > 0) {
        const { x: wx, y: wy } = ki.at;
        const R = full ? 1 : 0.65;
        // 금은 어둠이 걷힌 뒤에도 남아 있어야 보인다 — 연출 끝 + 0.8초
        const cl = Math.max(1.1, ki.dur - t + 0.8);
        this.effects.push({ kind: 'crack', life: cl, max: cl, wx, wy, r: 150 * R, col: k.pillar, seed: Math.random() * 99, n: full ? 7 : 5 });
        this.effects.push({ kind: 'shock', life: 0.55, max: 0.55, wx, wy, r: 220 * R, col: k.glow, rings: 2, w: 4 });
        this.effects.push({ kind: 'shock', life: 0.9, max: 0.9, wx, wy, r: 340 * R, col: '214,180,120', w: 2 });
        const bx = this.sx(ki.at), by = this.sy(ki.at);
        const n = Math.round((full ? 18 : 10) * (this.budget ?? 1));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
          const sp2 = 90 + Math.random() * 140;
          this.particles.push({ x: bx + Math.cos(a) * 30, y: by + Math.sin(a) * 30 * this.squash, vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 * this.squash - 40 - Math.random() * 50,
            life: 0.6 + Math.random() * 0.4, size: 5 + Math.random() * 5, color: 'rgb(196,170,130)', dust: true });
        }
      }
    }
    ctx.save();
    // 어둠
    ctx.fillStyle = `rgba(6,3,3,${(full ? 0.66 : 0.32) * A})`;
    ctx.fillRect(0, 0, w, h);
    // 왕이 선 자리 — 핏빛 기둥과 소용돌이
    if (ki.at && this.game) {
      const bx = this.sx(ki.at) * z;
      const by = this.sy(ki.at) * z;
      const pk = Math.max(0, Math.min(1, (t - 0.15 / sp) / 0.3)) * A;
      const col = ctx.createLinearGradient(bx - 30, 0, bx + 30, 0);
      col.addColorStop(0, `rgba(${k.ink},0)`);
      col.addColorStop(0.5, `rgba(${k.pillar},${0.55 * pk})`);
      col.addColorStop(1, `rgba(${k.ink},0)`);
      ctx.fillStyle = col;
      ctx.fillRect(bx - 30, 0, 60, by);
      const r = 70 + Math.sin(t * 9) * 6;
      const g2 = ctx.createRadialGradient(bx, by - 30, 4, bx, by - 30, r);
      g2.addColorStop(0, `rgba(${k.core},${0.7 * pk})`);
      g2.addColorStop(0.45, `rgba(${k.glow},${0.45 * pk})`);
      g2.addColorStop(1, `rgba(${k.ink},0)`);
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.arc(bx, by - 30, r, 0, Math.PI * 2); ctx.fill();
    }
    // 위아래 먹띠
    const bar = full ? h * 0.11 * Math.min(1, t / 0.3) * Math.min(1, (ki.dur - t) / 0.4) : 0;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, bar);
    ctx.fillRect(0, h - bar, w, bar);
    // 붓 한 획 — 이름 뒤를 가로지른다
    const cy = h * 0.4;
    const sk = Math.max(0, Math.min(1, (t - 0.25 / sp) / 0.22));
    if (sk > 0) {
      ctx.fillStyle = `rgba(${k.ink},${0.75 * A})`;
      ctx.beginPath();
      ctx.moveTo(w * 0.04, cy - 10);
      ctx.quadraticCurveTo(w * 0.5, cy - 30, w * (0.04 + 0.92 * sk), cy - 6);
      ctx.lineTo(w * (0.04 + 0.92 * sk) - 8, cy + 26);
      ctx.quadraticCurveTo(w * 0.5, cy + 40, w * 0.04 + 6, cy + 18);
      ctx.fill();
    }
    // 이름 — 크게 찍혔다가 제 크기로 (글자 수에 맞춰 화면 폭 안에)
    const nk = Math.max(0, Math.min(1, (t - 0.35 / sp) / 0.25));
    const n = [...k.stamp].length;
    const base = Math.min(132, (w * 0.78) / Math.max(2, n)) * (full ? 1 : 0.7);
    if (nk > 0) {
      const size = base * (1.45 - 0.45 * nk);
      ctx.globalAlpha = A * nk;
      ctx.font = `${size}px ${BRUSH}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(k.stamp, w / 2, cy + 8);
      ctx.shadowColor = `rgba(${k.glow},0.9)`;
      ctx.shadowBlur = 24;
      ctx.fillStyle = k.text;
      ctx.fillText(k.stamp, w / 2, cy + 8);
      ctx.shadowBlur = 0;
      // 낙관 — 이름 오른쪽 위
      const seal = k.seal;
      ctx.save();
      ctx.translate(Math.min(w - 22, w / 2 + base * n * 0.5 + 16), cy - 38);
      ctx.rotate(0.06);
      const sh = 16 * [...seal].length + 10;
      ctx.fillStyle = '#b91c1c';
      roundRect(ctx, -15, -10, 30, sh, 4);
      ctx.fill();
      ctx.fillStyle = '#fef2f2';
      ctx.font = `17px ${BRUSH}`;
      [...seal].forEach((ch, i) => ctx.fillText(ch, 0, 4 + i * 16));
      ctx.restore();
    }
    // 본명과 독문무공
    const tk = full ? Math.max(0, Math.min(1, (t - 0.75) / 0.3)) : 0;
    if (tk > 0) {
      ctx.globalAlpha = A * tk;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 21px system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      const line = k.line1;
      ctx.strokeText(line, w / 2, cy + 86);
      ctx.fillStyle = k.sub;
      ctx.fillText(line, w / 2, cy + 86);
    }
    const sk2 = full ? Math.max(0, Math.min(1, (t - 1.05) / 0.3)) : 0;
    if (sk2 > 0 && k.line2) {
      ctx.globalAlpha = A * sk2;
      ctx.font = `700 15px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      const line2 = k.line2;
      ctx.strokeText(line2, w / 2, cy + 116);
      ctx.fillStyle = '#e7e5e4';
      ctx.fillText(line2, w / 2, cy + 116);
    }
    ctx.restore();
  }

  drawBanner(dt) {
    const b = this.banner;
    if (!b) return;
    b.life -= dt;
    if (b.life <= 0) { this.banner = null; return; }
    const { ctx, w } = this;
    const k = b.life / b.max;
    const inK = Math.min(1, (1 - k) * 6);
    const y = this.h * 0.24;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 3);
    // 붓으로 그은 먹띠
    ctx.fillStyle = 'rgba(10,8,6,0.78)';
    ctx.beginPath();
    ctx.moveTo(w * 0.08, y - 18);
    ctx.quadraticCurveTo(w * 0.5, y - 26, w * (0.08 + 0.84 * inK), y - 16);
    ctx.lineTo(w * (0.08 + 0.84 * inK) - 6, y + 16);
    ctx.quadraticCurveTo(w * 0.5, y + 24, w * 0.08 + 8, y + 14);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // v227: 글이 길면 낙관과 겹쳤다('황금 원숭이 출현' + '보물') — 낙관 앞까지만 쓰도록 글자를 줄이고 왼쪽으로 민다
    const sealW = b.seal ? 46 : 0;
    const room = w * 0.84 - sealW / 2 - 10 - w * 0.1;
    ctx.font = `30px ${BRUSH}`;
    const tw = ctx.measureText(b.text).width;
    const fs = tw > room ? Math.max(18, 30 * room / tw) : 30;
    ctx.font = `${fs}px ${BRUSH}`;
    // 가운데에 두면 낙관에 닿을 때만 왼쪽 빈자리 가운데로
    const half = Math.min(tw, room) / 2;
    const tx = b.seal && w / 2 + half > w * 0.84 - sealW / 2 - 6 ? w * 0.1 + room / 2 + 4 : w / 2;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, tx, y + 1);
    if (b.seal) { // 붉은 낙관 — 두 글자 이상은 세로로 쌓는다
      const sx = w * 0.84;
      const chs = [...b.seal];
      const n = chs.length;
      const fz = n > 1 ? 19 : 26;
      const hh = n > 1 ? 10 + n * fz : 34;
      ctx.save();
      ctx.translate(sx, y - 2);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#b91c1c';
      roundRect(ctx, -17, -hh / 2, 34, hh, 4);
      ctx.fill();
      ctx.fillStyle = '#fef2f2';
      ctx.font = `${fz}px ${BRUSH}`;
      chs.forEach((ch, i) => ctx.fillText(ch, 0, 2 + (i - (n - 1) / 2) * fz));
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- 무인 그리기 ----------
// 발끝 가운데가 (x, y), 오른쪽을 본다. look: 무복 색·머리·무기, o: 애니메이션 옵션
const CORPSE_SEC = 0.7;   // v194: 떴다 떨어지고 튀는 몫만큼 조금 길게
const HERO_DOWN_SEC = 1.5;   // v216: 0.9 → 1.5 — 넘어짐·누움·기 모아 일어섬이 각각 읽히게

export function drawFighter(ctx, x, y, look = {}, o = {}) {
  const t = o.t || 0;
  const robe = look.robe || '#6b5640';
  const trim = look.trim || shade(robe, -0.35);
  const sash = look.sash || shade(robe, -0.5);
  const skin = look.skin || '#f1d3b3';
  const pants = shade(robe, -0.55);
  const weapon = o.weapon || look.weapon || 'sword';
  const jiang = look.jiangshi;
  const hop = jiang ? Math.abs(Math.sin(t * 5)) * -10 : 0;
  const bob = o.run ? Math.abs(Math.sin(t * 14)) * -3 : Math.sin(t * 4) * 1.5;
  const lunge = o.lunge || 0;

  ctx.save();
  ctx.translate(x, y);
  // o.scale / o.flip은 호출부가 계속 넘겨주고 있었는데 여기서 안 읽었다.
  // 그래서 '적이 많으면 작게 그린다(crowdScale)'도, '무인 쪽을 본다'도
  // 값만 계산되고 화면에는 한 번도 반영되지 않았다.
  if (o.scale && o.scale !== 1) ctx.scale(o.scale, o.scale);
  // turn(-1~1): 돌아서는 중 — 몸이 납작해졌다가 반대로 펴진다 (v160). 없으면 flip대로 곧장.
  if (o.turn != null) ctx.scale(o.turn, 1);
  else if (o.flip) ctx.scale(-1, 1);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 2, 24, 6, 0, 0, Math.PI * 2); ctx.fill();
  // 자세(pose.js). 그림자는 땅에 두고 몸만 기울이고 띄운다.
  const P = o.pose;
  if (P) {
    if (P.alpha < 1) ctx.globalAlpha *= Math.max(0, P.alpha);
    ctx.translate(P.dx, -P.lift - 4);
    // 발끝을 축으로 조금만 돈다 — 그림 한 장짜리 몸이라 허리를 못 꺾는다.
    // 많이 돌리면 사람이 아니라 넘어지는 판자로 보인다 (자세 도감에서 확인).
    ctx.rotate(P.lean * 0.32);
    ctx.scale(1 + P.stretch * 0.6, (1 - P.crouch * 0.2) * (1 - P.stretch * 0.25));
    ctx.translate(0, 4);
    // 나머지 기울기는 위쪽만 미는 비틀기로 — 발은 땅에 남고 머리만 앞으로 간다
    ctx.transform(1, 0, -Math.tan(P.lean * 0.42), 1, 0, 0);
  }
  ctx.translate(0, bob + hop);
  // 달릴 때는 몸이 앞으로 쏠린다(발은 땅에 두고 위쪽만 민다). 서 있을 때는 숨 쉬듯 아주 조금 부푼다.
  if (o.run && !P) ctx.transform(1, 0, -0.14, 1, 0, 0);
  else if (!P && !jiang) ctx.scale(1, 1 + Math.sin(t * 2.2) * 0.012);

  // 기운
  if (look.aura || o.rage) {
    const c = o.rage ? (o.rageCol || '#ef4444') : look.aura;
    const g = ctx.createRadialGradient(0, -55, 8, 0, -55, 62);
    g.addColorStop(0, hexA(c, 0.42 + Math.sin(t * 6) * 0.08));
    g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g;
    circle(ctx, 0, -55, 62);
    // 피어오르는 기
    for (let i = 0; i < 5; i++) {
      const ph = (t * 1.6 + i * 0.2) % 1;
      ctx.fillStyle = hexA(c, 0.5 * (1 - ph));
      circle(ctx, Math.sin(i * 2.3 + t) * 18, -10 - ph * 90, 3 - ph * 2);
    }
  }
  if (look.halo) {
    ctx.strokeStyle = hexA('#fde68a', 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-6, -88, 20, 0, Math.PI * 2); ctx.stroke();
  }
  // 떠도는 비검
  const n = look.swords || 0;
  const drawOrbit = (front) => {
    for (let i = 0; i < n; i++) {
      const a = t * 1.4 + (i * Math.PI * 2) / n;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      ctx.save();
      ctx.translate(Math.cos(a) * 38, -60 + Math.sin(a) * 10);
      // 도는 장식은 직업의 무기 — 권마는 금빛 주먹, 환마 부채, 독마 독침, 극악소마 지환, 검사 칼 (v121: 다 칼이라 권마가 칼을 든 것처럼 보였다)
      // v182: 장식 하나하나를 한 번만 그려 두고(빛 번짐 포함) 돌려 찍는다 — 매 프레임 칼마다 획 수십 개와 그림자 번짐이었다
      const ow = o.orbit || weapon;
      const col = look.aura || '#e0f2fe';
      if (ow === 'fist') {
        cachedDraw(ctx, `orb|fist|${col}`, [-12, -12, 12, 12], (cx) => {
          const g = cx.createRadialGradient(0, 0, 0, 0, 0, 11);
          g.addColorStop(0, 'rgba(255,251,235,0.95)'); g.addColorStop(0.5, hexA(col, 0.75)); g.addColorStop(1, hexA(col, 0));
          cx.fillStyle = g; circle(cx, 0, 0, 11);
          cx.fillStyle = '#fbbf24'; cx.strokeStyle = '#78350f'; cx.lineWidth = 1.2;
          roundRect(cx, -5, -4.5, 10, 9, 3); cx.fill(); cx.stroke();
          cx.beginPath(); for (let k = -1; k <= 1; k++) { cx.moveTo(-5, k * 2.6); cx.lineTo(-1.5, k * 2.6); } cx.stroke();
        });
      } else if (ow === 'fan') {
        ctx.rotate(Math.sin(t * 2 + i) * 0.3);
        cachedDraw(ctx, `orb|fan|${col}`, [-15, -10, 15, 9], (cx) => {
          cx.fillStyle = hexA(col, 0.85); cx.strokeStyle = '#1e1b4b'; cx.lineWidth = 1;
          cx.beginPath(); cx.moveTo(0, 6); cx.arc(0, 6, 13, -Math.PI * 0.85, -Math.PI * 0.15); cx.closePath(); cx.fill(); cx.stroke();
          for (let k = 0; k < 5; k++) { const aa = -Math.PI * 0.85 + (k + 0.5) * (Math.PI * 0.7 / 5); cx.beginPath(); cx.moveTo(0, 6); cx.lineTo(Math.cos(aa) * 13, 6 + Math.sin(aa) * 13); cx.stroke(); }
        });
      } else if (ow === 'dagger') {
        ctx.rotate(Math.PI / 2 + t * 3 + i);
        cachedDraw(ctx, 'orb|dagger', [-5, -13, 5, 10], (cx) => {
          cx.fillStyle = '#bef264'; cx.beginPath(); cx.moveTo(0, -12); cx.lineTo(2, 4); cx.lineTo(-2, 4); cx.closePath(); cx.fill();
          cx.fillStyle = hexA('#22c55e', 0.7); circle(cx, 0, 6, 3);
        });
      } else if (ow === 'claw') {
        cachedDraw(ctx, `orb|claw|${col}`, [-11, -11, 11, 11], (cx) => {
          cx.strokeStyle = hexA(col, 0.95); cx.lineWidth = 3;
          cx.beginPath(); cx.arc(0, 0, 6.5, 0, Math.PI * 2); cx.stroke();
          cx.fillStyle = '#f0abfc'; circle(cx, 0, -6.5, 2.4);
        });
      } else {
        ctx.rotate(Math.PI / 2 + Math.sin(t * 2 + i) * 0.1);
        cachedDraw(ctx, `orb|jian|${col}`, [-16, -24, 16, 50], (cx) => drawJian(cx, 0, 0, col, true, 0.7));
      }
      ctx.restore();
    }
  };
  drawOrbit(false);

  // 머리끈 끝자락 (뒤로 날림)
  // 그림 머리에는 띠가 **그려져 있는 것과 없는 것**이 있다. 삿갓·복면·민머리
  // 까지 붉은 끈이 날려서 머리 뒤 허공에 리본이 붙은 꼴이었다.
  const bandHead = artReady() && !jiang
    ? (look.head === 'band' || look.head === 'topknot')
    : (look.band || !look.head || look.head === 'band' || look.head === 'topknot');
  if (bandHead) {
    ctx.strokeStyle = look.band || '#7f1d1d';
    ctx.lineWidth = artReady() && !jiang ? 2 : 3;
    ctx.lineCap = 'round';
    // 벡터 머리는 -90이 뒤통수지만 그림 머리는 더 낮다. 한 좌표로 쓰면
    // 그림 쪽에서 끈이 정수리 위 허공에서 시작한다.
    const bd = artReady() && !jiang ? ART_BAND : { x: -8, y: -90 };
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(bd.x, bd.y);
      const wv = Math.sin(t * 6 + i) * 4;
      ctx.quadraticCurveTo(bd.x - 9, bd.y + 2 + wv + i * 3,
        bd.x - 17 - (o.run ? 5 : 0), bd.y + 8 + wv * 1.5 + i * 5);
      ctx.stroke();
    }
  }

  // 다리
  const swing = (o.run ? Math.sin(t * 14) * 8 : 0) + (P ? P.crouch * 9 : 0);
  ctx.strokeStyle = pants;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  if (!look.ghost) {
    ctx.beginPath(); ctx.moveTo(-4, -36); ctx.lineTo(-13 - swing, -3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -36); ctx.lineTo(13 + swing, -3); ctx.stroke();
    ctx.strokeStyle = '#e7e0d0'; // 각반
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-11 - swing * 0.8, -12); ctx.lineTo(-13 - swing, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11 + swing * 0.8, -12); ctx.lineTo(13 + swing, -4); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-12 - swing, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15 + swing, -1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 뒷팔 (넓은 소매) — 그림 몸통에는 소매가 이미 그려져 있다.
  // 이걸 안 끄면 화면에서 회색 판자가 가슴 앞에 하나 더 붙는다.
  if (!artReady() || jiang) {
    ctx.fillStyle = shade(robe, -0.2);
    ctx.beginPath();
    ctx.moveTo(-8, -70);
    if (jiang) { ctx.lineTo(26, -66); ctx.lineTo(28, -56); ctx.lineTo(-6, -58); } else { ctx.lineTo(-20, -48); ctx.lineTo(-12, -44); ctx.lineTo(-2, -62); }
    ctx.fill();
  }

  // 도포 아랫자락
  const flap = Math.sin(t * 5) * 2 + (o.run ? 4 : 0);
  const robeNow = o.flash > 0 ? mix(robe, '#ffffff', 0.45 * o.flash) : robe;
  ctx.fillStyle = robeNow;
  ctx.beginPath();
  ctx.moveTo(-12, -46);
  ctx.lineTo(12, -46);
  ctx.lineTo(19, look.ghost ? -6 : -14);
  ctx.quadraticCurveTo(0, look.ghost ? 0 : -10, -20 - flap, look.ghost ? -2 : -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = trim;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(19, -14); ctx.quadraticCurveTo(0, -10, -20 - flap, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, -46); ctx.lineTo(5, -12); ctx.stroke();

  // 상체 — 그림 조각이 있으면 도포·상체·허리띠를 한 장으로 갈음한다
  const artBody = artReady() && !jiang && !look.ghost;
  // 두목 옷: 흰 도포 그림에 그 빛깔을 곱해 입힌다(그림 도포 여섯 빛깔에 없는 색도 그대로 나온다)
  const bKey = look.robeTint ? 'body-white' : bodyKey(look);
  // 옷 등급 테두리 (v115) — 도포 둘레에 등급 빛깔 테, 전설부터 도포가 그 빛을 머금는다
  if (artBody && look.edge) {
    const pulse = look.edgePulse ? 0.7 + Math.sin(t * 3) * 0.3 : 1;
    if (look.edgeGlow) { ctx.save(); ctx.shadowColor = look.edge; ctx.shadowBlur = 10 * pulse; putArtEdge(ctx, bKey, FIT.body, look.edge, look.edgeW || 1.2, pulse); ctx.restore(); }
    else putArtEdge(ctx, bKey, FIT.body, look.edge, look.edgeW || 1.2, pulse);
  }
  if (artBody && putArt(ctx, bKey, FIT.body)) {
    // 그림 한 장이 도포·상체·허리띠를 한꺼번에 갈음한다
    if (look.robeTint) putArtTint(ctx, bKey, FIT.body, look.robeTint, 1, 'multiply');
    if (look.edge && look.edgeTint) putArtTint(ctx, bKey, FIT.body, look.edge, look.edgeTint * (look.edgePulse ? 0.8 + Math.sin(t * 3) * 0.2 : 1));
  } else {
  ctx.fillStyle = robeNow;
  roundRect(ctx, -12, -74, 24, 30, 7);
  ctx.fill();
  // 교령(엇갈린 깃)
  ctx.strokeStyle = trim;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-7, -73); ctx.lineTo(5, -56); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -73); ctx.lineTo(0, -64); ctx.stroke();
  // 허리띠
  ctx.fillStyle = sash;
  ctx.fillRect(-13, -50, 26, 6);
  ctx.strokeStyle = sash;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-9, -46); ctx.quadraticCurveTo(-14 - flap, -36, -12 - flap, -26); ctx.stroke();
  }

  // 머리
  if (artReady() && !jiang && look.head !== 'mask' && putArt(ctx, headKey(look), FIT.head)) {
    // 머리카락까지 한 장
  } else {
  ctx.fillStyle = skin;
  ctx.fillRect(-3, -80, 7, 6);
  circle(ctx, 1, -88, 11);
  drawHead(ctx, look, t);
  // 얼굴
  if (look.head !== 'mask' && !jiang) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(4, -93); ctx.lineTo(10, -91); ctx.stroke(); // 눈썹
    ctx.fillStyle = look.eyes || '#111';
    ctx.fillRect(6, -89, 4, 2);
  } else if (look.head === 'mask') {
    ctx.fillStyle = look.eyes || '#f8fafc';
    ctx.fillRect(6, -90, 4, 2);
  }
  }
  if (look.crown) drawCrown(ctx, t);
  if (look.beard && !artReady()) {
    ctx.fillStyle = look.hair === '#e5e7eb' || look.hair === '#f1f5f9' ? '#e5e7eb' : '#1c1917';
    ctx.beginPath(); ctx.moveTo(2, -82); ctx.lineTo(12, -82); ctx.lineTo(6, -68); ctx.fill();
  }

  // 앞팔 + 무기
  // 어깨가 벡터 뼈대와 그림 도포에서 서로 다른 자리다. 벡터는 상체가
  // -74..-44지만 그림 도포는 어깨가 -67이고 소매가 이미 그려져 있다.
  // 한 좌표로 둘 다 쓰면 한쪽에서 무기가 몸 밖에 뜬다.
  ctx.save();
  const sh0 = artReady() && !jiang ? ART_SHOULDER : { x: 7, y: -70 };
  ctx.translate(sh0.x, sh0.y);
  if (P) {
    // 자세가 손 자리와 칼끝을 따로 정한다. 그림 몸통의 소매는 늘 아래로
    // 처져 있으니, 손이 어깨를 떠나면 팔 하나를 그어 이어 준다.
    const hx = Math.cos(P.hand[0]) * P.hand[1];
    const hy = Math.sin(P.hand[0]) * P.hand[1];
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx * 0.86, hy * 0.86); ctx.stroke();
    ctx.strokeStyle = shade(robeNow, -0.08);
    ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx * 0.86, hy * 0.86); ctx.stroke();
    ctx.fillStyle = skin;
    circle(ctx, hx, hy, 3.8);
    ctx.translate(hx, hy);
    ctx.rotate(P.blade + Math.PI / 2);
    if (P.wscale && P.wscale !== 1) ctx.scale(P.wscale, P.wscale);
    const wk2 = artReady() ? weaponKey(weapon, look) : null;
    if (!(wk2 && putArt(ctx, wk2, FIT.weapon))) drawWeapon(ctx, weapon, o, t, 0);
    ctx.restore();
    drawOrbit(true);
    ctx.restore();
    return;
  }
  let ang;
  if (jiang) ang = -1.5;
  else if (weapon === 'spear') ang = -1.45 + lunge * 0.15;
  else ang = -0.2 - (lunge > 0 ? 1 - lunge : 0) * 0.9 + lunge * 1.1 - 0.4;
  // 무인의 '들고 선 자세'. 휘두르는 각(위 ang)대로 두면 쉴 때 손이 가슴
  // 앞(몸 안쪽)에 와서 13px짜리 무기가 도포에 묻혔다 — 검사·독마·극악소마가
  // 서 있을 때 뭘 들었는지 안 보였다. 쉴 때는 손을 앞으로 내리고 무기를
  // 키워 몸 밖으로 내민다. 평타가 나가면(lunge) 원래 휘두름으로 섞여 간다.
  if (o.hold && !jiang && weapon !== 'spear') {
    const th = ang + Math.PI / 2;
    const w = Math.min(1, lunge * 2.5);
    const H = HOLD[weapon] || HOLD.sword;
    const sway = Math.sin(t * 2.2) * 0.04 + (o.run ? Math.sin(t * 14) * 0.08 : 0);
    const hx = H.hand[0] * (1 - w) + (-Math.sin(th) * 22 + 1) * w;
    const hy = H.hand[1] * (1 - w) + (Math.cos(th) * 22) * w;
    const blade = (H.blade + sway) * (1 - w) + th * w;
    const sc = H.scale * (1 - w) + w;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1410';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx * 0.86, hy * 0.86); ctx.stroke();
    ctx.strokeStyle = shade(robeNow, -0.08);
    ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hx * 0.86, hy * 0.86); ctx.stroke();
    ctx.translate(hx, hy);
    ctx.rotate(blade);
    ctx.scale(sc, sc);
    if (H.off) ctx.translate(0, H.off * (1 - w));
    if (o.glow) { ctx.shadowColor = o.glowCol || o.blade || '#fde68a'; ctx.shadowBlur = o.glowCol ? 14 : 10; }
    const wk3 = artReady() ? weaponKey(weapon, look) : null;
    const art3 = !!(wk3 && putArt(ctx, wk3, FIT.weapon));
    if (!art3) drawWeapon(ctx, weapon, o, t, lunge);
    ctx.shadowBlur = 0;
    if (o.bladeFx) drawBladeFx(ctx, o, t, art3 ? -1 : 1);
    if (H.off) ctx.translate(0, -H.off * (1 - w));
    if (!H.bare || w > 0.5) { ctx.fillStyle = skin; circle(ctx, 0, 0, 3.6 / sc); }
    ctx.restore();
    drawOrbit(true);
    ctx.restore();
    return;
  }
  ctx.rotate(ang + Math.PI / 2);
  if (!artReady()) {
    ctx.fillStyle = shade(robeNow, -0.05);
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(7, -2); ctx.lineTo(9, 18); ctx.lineTo(-7, 18); ctx.fill(); // 소매
  }
  if (!(artReady() && !jiang)) {
    ctx.fillStyle = skin;
    circle(ctx, 1, 22, 4.5);
  }
  ctx.translate(1, 22);
  const wk = artReady() ? weaponKey(weapon, look) : null;
  const art = !!(wk && putArt(ctx, wk, FIT.weapon));
  if (!art) drawWeapon(ctx, weapon, o, t, lunge);
  if (o.bladeFx) drawBladeFx(ctx, o, t, art ? -1 : 1);
  ctx.restore();

  drawOrbit(true);
  ctx.restore();
}

function drawHead(ctx, look, t) {
  const hair = look.hair || '#111111';
  const head = look.head || 'topknot';
  switch (head) {
    case 'hat': // 삿갓
      ctx.fillStyle = '#c8a96b';
      ctx.beginPath(); ctx.moveTo(-24, -92); ctx.lineTo(1, -110); ctx.lineTo(26, -92); ctx.quadraticCurveTo(1, -88, -24, -92); ctx.fill();
      ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(1, -109); ctx.lineTo(1 + i * 10, -92); ctx.stroke(); }
      break;
    case 'hood':
      ctx.fillStyle = shade(look.robe || '#555', -0.25);
      ctx.beginPath(); ctx.arc(0, -89, 13, Math.PI * 0.55, Math.PI * 2.15); ctx.lineTo(-6, -76); ctx.fill();
      break;
    case 'mask':
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.moveTo(-10, -87); ctx.lineTo(12, -87); ctx.lineTo(12, -80); ctx.quadraticCurveTo(1, -74, -10, -82); ctx.fill();
      break;
    case 'bald':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 3; i++) circle(ctx, -3 + i * 4, -96, 1);
      break;
    case 'jiangshi':
      ctx.fillStyle = '#111';
      ctx.fillRect(-11, -101, 24, 7);
      ctx.beginPath(); ctx.arc(1, -101, 8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b91c1c'; circle(ctx, 1, -110, 2.5);
      ctx.fillStyle = '#facc15'; // 부적
      ctx.fillRect(3, -94, 9, 18);
      ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(5, -91); ctx.lineTo(10, -87); ctx.lineTo(5, -83); ctx.lineTo(10, -79); ctx.stroke();
      break;
    case 'band':
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI * 0.9, Math.PI * 2.05); ctx.fill();
      ctx.fillStyle = look.band || '#7f1d1d';
      ctx.fillRect(-10, -94, 22, 4);
      break;
    case 'topknot':
    default:
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.arc(1, -90, 11.5, Math.PI * 0.85, Math.PI * 2.05); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-2, -103, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = look.band || '#7f1d1d';
      ctx.fillRect(-6, -100, 8, 2.5);
      // 뒷머리
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.moveTo(-9, -92); ctx.quadraticCurveTo(-16 - Math.sin(t * 5) * 2, -82, -12, -74); ctx.lineTo(-7, -84); ctx.fill();
      break;
  }
}

// 들고 선 자세 — 어깨 기준 손 자리, 무기 각(0이면 날이 위, +면 앞으로 눕는다), 크기
const HOLD = {
  sword: { hand: [7, 19], blade: 0.95, scale: 1.6 },   // 검사: 칼끝을 앞으로 겨눈다
  fist: { hand: [11, 14], blade: 0.3, scale: 1.5, off: 8, bare: true }, // 권마: 권갑 낀 주먹을 앞에 쥔다(주먹이 손 자리)
  fan: { hand: [9, 14], blade: 0.55, scale: 1.25 },    // 환마: 부채를 펴 든다
  dagger: { hand: [8, 20], blade: 1.7, scale: 1.35 },  // 독마: 비수를 앞으로 낮게
  claw: { hand: [10, 14], blade: 0.6, scale: 1.5 },    // 극악소마: 지환 낀 손을 세운다
};

function drawWeapon(ctx, weapon, o, t, lunge) {
  const blade = o.blade || '#e5e7eb';
  switch (weapon) {
    case 'saber': // 도
      ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -2, 4, 12);
      ctx.fillStyle = '#a16207'; ctx.fillRect(-6, -4, 12, 3);
      ctx.fillStyle = blade;
      ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-5, -38); ctx.quadraticCurveTo(4, -50, 7, -42); ctx.lineTo(4, -4); ctx.fill();
      break;
    case 'spear':
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, -64); ctx.stroke();
      ctx.fillStyle = blade; ctx.beginPath(); ctx.moveTo(-4, -64); ctx.lineTo(0, -82); ctx.lineTo(4, -64); ctx.fill();
      ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.moveTo(-4, -62); ctx.quadraticCurveTo(-10 - Math.sin(t * 8) * 3, -56, -6, -50); ctx.lineTo(4, -60); ctx.fill();
      break;
    case 'axe':
      ctx.strokeStyle = '#5b3a1e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -38); ctx.stroke();
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath(); ctx.moveTo(0, -38); ctx.quadraticCurveTo(18, -44, 16, -24); ctx.lineTo(0, -28); ctx.fill();
      break;
    case 'fan':
      ctx.fillStyle = '#f5f0e6';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 22, -Math.PI * 0.85, -Math.PI * 0.15); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.85 + i * (Math.PI * 0.7 / 5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); ctx.stroke(); }
      ctx.fillStyle = '#111'; ctx.font = `9px ${BRUSH}`; ctx.textAlign = 'center'; ctx.fillText('바람', 0, -10);
      break;
    case 'claw':
      ctx.strokeStyle = blade === '#e5e7eb' ? '#d1d5db' : blade; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 3, 0); ctx.lineTo(i * 5, -12); ctx.stroke(); }
      break;
    case 'dagger':
      ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -2, 4, 8);
      ctx.fillStyle = blade; ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(0, -20); ctx.lineTo(3, -2); ctx.fill();
      break;
    case 'fist': {
      // 권갑 — 주먹을 감싼 쇠 장갑. 마디 위에 쇠 징 넷, 손목에 가죽 띠. 칼날은 없다(v121).
      ctx.save();
      ctx.scale(0.55, 0.55);
      ctx.fillStyle = '#5b3a1e'; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 1.4;
      roundRect(ctx, -5, 1, 10, 7, 2); ctx.fill(); ctx.stroke();                 // 손목 띠
      ctx.fillStyle = '#8b5a2b';
      roundRect(ctx, -6.5, -9, 13, 11, 4); ctx.fill(); ctx.stroke();             // 주먹
      ctx.fillStyle = blade;
      roundRect(ctx, -6.5, -10.5, 13, 4.5, 2); ctx.fill(); ctx.stroke();         // 쇠 덧판
      ctx.fillStyle = '#fde68a';
      for (let k = 0; k < 4; k++) circle(ctx, -4.8 + k * 3.2, -8.3, 1.1);       // 징
      if (o.glow) { ctx.fillStyle = hexA(blade.startsWith('#') ? blade : '#fde68a', 0.35); circle(ctx, 0, -6, 9); }
      ctx.restore();
      if (lunge > 0.3) { ctx.strokeStyle = `rgba(255,255,255,${lunge * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -6, 9, -2.5, -0.6); ctx.stroke(); }
      break;
    }
    case 'sword':
    default:
      ctx.save();
      ctx.rotate(Math.PI);
      drawJian(ctx, 0, -2, blade, o.glow, 1, t, o.rage);
      ctx.restore();
      break;
  }
}

// 직검: 손잡이가 (x, y), 칼날이 +y 방향 (호출 측에서 회전)
// 테두리 글자 한 장 (v182) — 떠오르는 숫자용. ax·ay는 글자 기준점(가운데·글자 바닥줄)이 그림 안에서 있는 자리.
function textSprite(text, font, color, lw, q) {
  q = Math.max(1, Math.min(4, q || 1));
  const m = textSprite.mx || (textSprite.mx = document.createElement('canvas').getContext('2d'));
  m.font = font;
  const tm = m.measureText(text);
  const asc = Math.ceil(tm.actualBoundingBoxAscent || parseFloat(font) * 0.8) + lw;
  const desc = Math.ceil(tm.actualBoundingBoxDescent || parseFloat(font) * 0.2) + lw;
  const w = Math.ceil(tm.width) + lw * 2 + 2, h = asc + desc;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * q); cv.height = Math.ceil(h * q);
  const x = cv.getContext('2d');
  x.setTransform(q, 0, 0, q, 0, 0);
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.lineWidth = lw; x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineJoin = 'round';
  x.strokeText(text, w / 2, asc);
  x.fillStyle = color;
  x.fillText(text, w / 2, asc);
  return { cv, w, h, ax: w / 2, ay: asc };
}

// 한 번 그려 두고 찍는 작은 그림 (v182). box는 그 그림이 차지하는 자리(지금 좌표계 단위).
// 지금 변환의 배율에 맞춰 굽고(반 단위로 맞춰 개수를 줄인다), 돌리고 줄이는 것은 drawImage가 한다.
const drawCache = new Map();
function cachedDraw(ctx, key, box, draw) {
  const m = ctx.getTransform();
  const q = Math.max(1, Math.min(6, Math.ceil(Math.hypot(m.a, m.b) * 2) / 2));
  const k = `${key}|${q}`;
  let c = drawCache.get(k);
  const [x0, y0, x1, y1] = box;
  if (!c) {
    if (drawCache.size > 160) drawCache.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * q);
    c.height = Math.ceil((y1 - y0) * q);
    const cx = c.getContext('2d');
    cx.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
    draw(cx);
    drawCache.set(k, c);
  }
  ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
}

function drawJian(ctx, x, y, blade, glow, s = 1, t = 0, rage = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#3f2a1a'; ctx.fillRect(-2, -12, 4, 12); // 손잡이
  ctx.fillStyle = '#d4a64a'; ctx.fillRect(-6, -1, 12, 3); // 코등이
  // 검수(술)
  ctx.strokeStyle = '#b91c1c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(-4 + Math.sin(t * 8) * 3, -18, -2, -24); ctx.stroke();
  if (glow) { ctx.shadowColor = blade; ctx.shadowBlur = 14; }
  ctx.fillStyle = rage ? '#fca5a5' : blade;
  ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.lineTo(-2, 46); ctx.lineTo(0, 52); ctx.lineTo(2, 46); ctx.lineTo(2.5, 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-0.5, 4, 1, 40);
  ctx.restore();
}

function leaf(ctx, x, y, a) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function emoji(ctx, ch, x, y, size, flip) {
  ctx.save();
  ctx.fillStyle = '#000'; // 컬러 이모지도 fillStyle의 투명도를 따라가므로 불투명하게
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

// 카메라를 물리면(zoom<1) 이름표·막대가 같이 작아진다 — 그만큼 키워 진짜 크기를 지킨다
let UIK = 1;
function nameTag(ctx, text, x, y, big = false) {
  ctx.save();
  ctx.font = big ? `${19 * UIK}px ${BRUSH}` : `800 ${11 * UIK}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3 * UIK;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = big ? '#fde68a' : '#fff';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// 기절·멎음 — 머리 위를 도는 별 셋 (v119: 얼음 덩어리는 옛 빙결 것이라 무공의 기절과 안 맞았다)
function dizzy(ctx, x, y, t) {
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const a = t * 5 + (i * Math.PI * 2) / 3;
    const sx = x + Math.cos(a) * 16, sy = y + Math.sin(a) * 5;
    const r = 4.5 + Math.sin(a) * 1.2;
    ctx.fillStyle = Math.sin(a) > 0 ? '#fde047' : 'rgba(253,224,71,0.6)';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r; const aa = (k * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function iceBlock(ctx, x, y, hw, hh) {
  ctx.fillStyle = 'rgba(186,230,253,0.35)';
  ctx.strokeStyle = 'rgba(224,242,254,0.9)';
  ctx.lineWidth = 2;
  roundRect(ctx, x - hw, y - hh, hw * 2, hh, 8);
  ctx.fill();
  ctx.stroke();
}

// 격자 좌표를 0~1 값으로 — 같은 칸은 항상 같은 값이라 바닥 소품이 제자리에 붙어 있다
function rnd2(i, j) {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fill(); }

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 체력은 Big이다. `a / b`는 NaN이 되고, 막대 너비가 NaN이면 **아무것도 안 그려진다**
// — 체력 막대가 통째로 사라진 것처럼 보인다.
const ratio = (a, b) => Math.max(0, Math.min(1, big(a).div(b).toNumber() || 0));

// trail(v164 다듬기 4): 깎인 만큼이 밝은 띠로 잠깐 남았다가 따라 내려온다 — 한 방에 얼마나 깎였는지 눈에 들어온다
function hpBar(ctx, x, y, w, h, ratio, color, trail = null) {
  h *= Math.min(UIK, 1.6);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  if (trail != null && trail > ratio) {
    ctx.fillStyle = 'rgba(254,243,199,0.85)';
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, trail)), h);
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

function mix(a, b, k) {
  const p = parseInt(a.slice(1), 16);
  const q = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((p >> sh) & 255) * (1 - k) + ((q >> sh) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

// 칼빛 (v114) — 칼날을 따라 빛 알갱이. dir은 칼끝 방향(그림 무기는 위 -1, 벡터 칼은 아래 +1).
// shimmer: 반짝임 · flame: 돌파 불꽃이 칼끝으로 타오른다 · rainbow: 신화 무지개가 흐른다
function drawBladeFx(ctx, o, t, dir) {
  const L = 30;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const col = o.bladeCol || o.blade || '#fde68a';
  if (o.bladeFx === 'rainbow' || o.bladeFx === 'flame') {
    // 칼을 감싸는 빛 띠
    const g = ctx.createLinearGradient(0, 0, 0, dir * L);
    if (o.bladeFx === 'rainbow') {
      for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsla(${(t * 160 + i * 60) % 360},95%,65%,0.55)`);
    } else {
      g.addColorStop(0, hexA('#f97316', 0.15)); g.addColorStop(0.6, hexA('#fb923c', 0.5)); g.addColorStop(1, hexA('#fde047', 0.75));
    }
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, dir * L * 0.6, 3.2, L * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  const n = o.bladeFx === 'shimmer' ? 3 : 6;
  for (let i = 0; i < n; i++) {
    const ph = (t * (o.bladeFx === 'flame' ? 1.8 : 0.9) + i / n) % 1;
    const yy = dir * (8 + ph * (L - 6));
    const xx = Math.sin(t * 7 + i * 2.1) * (o.bladeFx === 'flame' ? 5 : 3);
    const a = Math.sin(ph * Math.PI);
    ctx.fillStyle = o.bladeFx === 'rainbow' ? `hsla(${(t * 200 + i * 50) % 360},100%,72%,${a})`
      : o.bladeFx === 'flame' ? (i % 2 ? hexA('#fde047', a) : hexA('#f97316', a)) : hexA('#ffffff', a);
    if (o.bladeFx === 'shimmer') {
      // 십자 반짝임
      const r = 3.5 * a;
      ctx.fillRect(xx - r, yy - 0.6, r * 2, 1.2); ctx.fillRect(xx - 0.6, yy - r, 1.2, r * 2);
      ctx.fillStyle = hexA(col, a * 0.6); circle(ctx, xx, yy, 1.6);
    } else circle(ctx, xx, yy, (o.bladeFx === 'flame' ? 2.6 : 2) * (0.5 + a * 0.6));
  }
  ctx.restore();
}

// 신화 모자 — 머리 위 금관
function drawCrown(ctx, t) {
  ctx.save();
  ctx.translate(1, artReady() ? -90 : -97);
  ctx.shadowColor = '#fde047'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.moveTo(-9, 2); ctx.lineTo(-10, -6); ctx.lineTo(-5, -2); ctx.lineTo(0, -10); ctx.lineTo(5, -2); ctx.lineTo(10, -6); ctx.lineTo(9, 2);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#a16207'; ctx.fillRect(-9, 0, 18, 2.5);
  ctx.fillStyle = '#f43f5e'; circle(ctx, 0, -3, 1.8);
  ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.4})`; circle(ctx, 0, -10, 1.3);
  ctx.restore();
}

// 등급 표 — 이름표 위 작은 알약
function gradeTag(ctx, text, x, y, col) {
  ctx.save();
  ctx.font = `800 ${10 * UIK}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10 * UIK, h = 14 * UIK;
  ctx.fillStyle = 'rgba(20,10,4,0.75)';
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2 * UIK; ctx.stroke();
  ctx.fillStyle = col; ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + k))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
