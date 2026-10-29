// 전투 화면 캔버스 렌더러 (수묵화 무협풍). 게임 이벤트를 받아 연출만 담당한다.
import { drawObstacle, drawLowObstacle } from './obstacles.js';
import { zoneOf, RANKS, GRADES, FIELD_SQUASH, JOB_TRAITS, QI, jobOf, critTierName } from './data.js';
import { artReady, putArt, putArtEdge, putArtTint, loadArt, FIT, ART_SHOULDER, ART_BAND, headKey, bodyKey, weaponKey } from './art.js';
import { drawCreature, saddleY } from './creatures.js';
import { ZONES_W, stepMap } from './world/wdata.js';
import { setOf } from './world/wgear.js';
import { OUTFITS } from './data.js';

// 의복 열둘 중 앞 여섯은 도포(몸), 뒤 여섯은 검 장식(무기)이다.
function outfitLook(id) {
  if (!id) return {};
  const i = OUTFITS.findIndex((o) => o.id === id);
  if (i < 0) return {};
  return i < 6 ? { outfitBody: i } : { outfitWeapon: i - 6 };
}
import { fxReady, putFx, loadFx, zoneTile } from './fx.js';
import { PoseAnim } from './pose.js';
import { CHOREO, Director, FX, VENOM, drawPoisonField } from './skillfx.js';
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
const SPR = { w: 80, h: 160, ox: 44, oy: 146, phases: 8, cycle: Math.PI / 2, max: 192 };
const sprCache = new Map();
// 그림이 늦게 도착하면 벡터로 구워 둔 것을 버려야 한다
loadArt(() => sprCache.clear());
loadFx(() => {});
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
function fighterSprite(look, time, weapon, dpr) {
  if (!sprCacheable(look)) return null;
  const ph = Math.floor((((time % SPR.cycle) + SPR.cycle) % SPR.cycle) / SPR.cycle * SPR.phases);
  const key = `${lookId(look)}|${ph}|${weapon || ''}|${dpr}`;
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
    t: (ph + 0.5) / SPR.phases * SPR.cycle, weapon, flash: 0,
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
    const dpr = this.light ? 1 : Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
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
        const skill = ev.kind !== 'hit' && ev.kind !== 'pet';
        // 치명 단계 — 1 치명(빨강) · 2 슈퍼(주황) · 3 하이퍼(보라) · 4+ 금빛. 단계가 높을수록 크게.
        const ct = typeof ev.crit === 'number' ? ev.crit : ev.crit ? 1 : 0;
        // 무공은 치명 단계를 늘 타므로(채운 단계만큼은 반드시) 단계는 글자로만 알리고,
        // 터지는 연출은 평타 치명에만 둔다 — 광역기 수십 대가 다 흔들면 화면이 멀미 난다
        const crit = skill ? false : ev.crit;
        const color = ev.kind === 'pet' ? '#f9a8d4' : skill ? '#fde68a' : CRIT_COL[Math.min(ct, CRIT_COL.length - 1)];
        // 평타 치명 — 무기 등급 빛깔의 충격 고리 (v114)
        if (crit && ev.at && this.fxLevel > 0 && game?.s) {
          const gl = this.gearLook(game);
          const c = (gl.weaponCol || '#fde68a').replace('#', '');
          const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',');
          this.effects.push({ kind: 'shock', life: 0.32, max: 0.32, wx: ev.at.x, wy: ev.at.y, r: 34 + gl.tier * 6, col: rgb, rings: 2, w: 3 });
        }
        const size = ev.kind === 'pet' ? 14 : skill ? 28 : ct ? 24 + Math.min(4, ct) * 3 : 17;
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
        // 때린 순간 화면을 아주 잠깐 늦추고 상대를 밀어낸다 — 타격감
        this.hitstop = Math.max(this.hitstop, crit || skill ? 0.075 : 0.032);
        this.monKnock = Math.max(this.monKnock, crit || skill ? 16 : 7);
        if (crit) {
          this.ink(atX - 10, atY - 60, 10, '#7f1d1d', 160);
          this.shake = Math.max(this.shake, 0.32);
          this.flash = Math.max(this.flash, 0.22);
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
      case 'petHit': {
        // 애완동물의 한 대 — 과녁 쪽으로 튀어 나가고(drawHeroUnit), 맞은 자리에 짧은 빛
        if (!ev.at) break;
        const px = this.sx(ev.at), py = this.sy(ev.at);
        this.petAtk = this.petAtk || [];
        this.petAtk[ev.i] = { t: 0.32, x: px, y: py };
        this.sparks.push({ x: px, y: py - 40, life: 0.22, max: 0.22, r: 24, color: '#fde68a' });
        break;
      }
      case 'heroHit':
        this.heroFlash = 1;
        this.monLunge = 1;
        this.float('-' + fmt(ev.amount) + (ev.crit ? '!' : ''), this.heroX + 26, this.groundY - 158, '#fca5a5', ev.crit ? 18 : 14);
        break;
      case 'bossCast':
        if (ev.at) this.float(ev.name, this.sx(ev.at), this.sy(ev.at) - 150, '#fca5a5', 16, 1, true);
        break;
      case 'tellBoom': {
        const tl = ev.tell;
        const c = tl.kind === 'line' ? { x: (tl.x0 + tl.x1) / 2, y: (tl.y0 + tl.y1) / 2 } : tl;
        const r = tl.kind === 'line' ? Math.min(220, tl.w * 1.4) : tl.kind === 'donut' ? tl.r1 * 0.7 : tl.r;
        this.effects.push({ kind: 'shock', life: 0.35, max: 0.35, wx: c.x, wy: c.y, r, col: '248,113,113', rings: 2, w: 5 });
        if (ev.hit) this.shake = Math.max(this.shake || 0, 0.35);
        break;
      }
      case 'heroDied':
        // 무인이 넘어졌다가 일어난다 (drawHeroUnit)
        this.heroDownT = HERO_DOWN_SEC;
        this.shake = Math.max(this.shake, 0.3);
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
        if (!this.effects.some((e) => e.kind === 'pillar' && e.life > 0.5)) this.effects.push({ kind: 'pillar', life: 1.2, max: 1.2 });
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
    CHOREO[p.fx](d);
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
      const z = (it.set && setOf(it.set)?.king) || (it.king ?? stepMap(it.step));      // 세트는 그 세트 결의 왕, 왕의 장비는 그 왕의 겉모습
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
    if (!this.camPan && !f) { this.camX = game.heroX; this.camY = game.heroY; return; }
    const tx = f ? f.x : game.heroX;
    const ty = f ? f.y : game.heroY;
    const k = 1 - Math.exp(-dt * this.camRate);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    if (!f && Math.hypot(game.heroX - this.camX, game.heroY - this.camY) < 2) {
      this.camPan = false;
      this.camRate = 10;
      this.camX = game.heroX; this.camY = game.heroY;
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
    const { ctx, cv } = this;
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
    if (this.fxLevel <= 0) return;
    const face = (this.faceOverride || game.heroFacing) < 0 ? -1 : 1;
    // 권마 — 베는 궤적 대신 주먹이 닿는 자리에 터지는 충격 (정권·훅·올려치기마다 방향이 다르다)
    if (cls === 'fist') {
      const t = game.mon;
      if (t) this.effects.push({ kind: 'punch', life: 0.2, max: 0.2, wx: t.x, wy: t.y, face, tilt, big: this.comboIx === 2 });
      return;
    }
    this.effects.push({ kind: 'swing', life: 0.16, max: 0.16, face, tilt, dir, cls,
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
      this.anchor = Math.abs(want - a0) < 0.002 ? want : a0 + (want - a0) * Math.min(1, dt * 9);
    }
    this.monLunge = decay(this.monLunge, 5);
    this.monShake = decay(this.monShake, 7);
    this.monFlash = decay(this.monFlash, 12);
    this.heroFlash = decay(this.heroFlash, 6);
    this.shake = decay(this.shake, 1);
    this.flash = decay(this.flash, 2);
    const moving = this.fieldMode ? !!game.walking : (!game.mon?.alive && game.mode === 'stage');
    // 달릴 때 발밑에서 흙먼지가 인다 — 뒤로 흩어지며 옅어진다
    if (moving && this.fieldMode && this.fxLevel > 0 && !this.director) {
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) {
        this.dustT = 0.11;
        const face = (this.faceOverride || game.heroFacing) < 0 ? -1 : 1;
        this.particles.push({ x: this.heroX - face * (6 + Math.random() * 10), y: this.groundY - 2,
          vx: -face * (50 + Math.random() * 40), vy: -18 - Math.random() * 20, life: 0.45, size: 4 + Math.random() * 3,
          color: 'rgb(214,196,160)', dust: true });
      }
    }
    // 들판에서는 카메라가 움직인 만큼 배경이 흐른다
    if (this.fieldMode) this.scroll = this.camX;
    else this.scroll += dt * (moving ? 220 : 12);

    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 12 * this.shake, (Math.random() - 0.5) * 12 * this.shake);
    const scene = this.scene(game);
    this.drawBackground(scene);
    this.drawLowObstacles(game);  // 물·용암 (v127)
    this.drawQueue(game);
    this.drawFields(game);        // 바닥 장판은 사람보다 아래에
    this.drawTells(game);         // 탑 수문장의 바닥 경고 (v126)
    this.drawUnits(game, dt, moving);
    this.drawProjectiles(dt);
    this.drawEffects(dt, game);
    this.drawPaths(dt);
    this.drawSparks(dt);
    this.drawParticles(dt);
    this.drawWeather(scene, dt);
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
      this.drawFloats(dt, z);
      this.drawHanja(dt);
      this.drawBanner(dt);
      this.drawKingIntro(dt, z);
    } finally { this.w = vw; this.h = vh; }
    ctx.restore();
    ctx.restore();
    if (this.slice) this.drawSlice(rawDt);
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
    const pat = zoneTile(ctx, z.idx ?? 0, ground);
    if (!pat) {
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
  putDecor(z, ox, oy) {
    const { ctx, w, h } = this;
    const M = 220;
    const d = this._decor;
    const stale = !d || d.w !== w || d.h !== h || d.z !== z
      || Math.abs(ox - d.ox) > M || Math.abs(oy - d.oy) > M;
    if (stale) this.bakeDecor(z, ox, oy, M);
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

  bakeDecor(z, ox, oy, M) {
    const { w, h } = this;
    const q = (this.dpr || 1) * (this.zoom || 1);
    const cv = this._decor?.cv && this._decor.w === w && this._decor.h === h
      ? this._decor.cv : document.createElement('canvas');
    cv.width = Math.ceil((w + M * 2) * q);
    cv.height = Math.ceil((h + M * 2) * q);
    const x = cv.getContext('2d');
    x.setTransform(q, 0, 0, q, 0, 0);
    x.clearRect(0, 0, w + M * 2, h + M * 2);
    this.decorInto(x, z, ox, oy, M);
    this._decor = { cv, q, w, h, z, ox, oy, M };
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
    const gale = game.buffs.gale > 0;
    // 초식 자세가 걸려 있으면 그 자세로. 그동안은 평타의 움찔(lunge)을 끈다.
    const pose = this.heroAnim.sample();
    const lunge = pose ? 0 : this.heroLunge;
    // 벨 때 타겟 쪽으로 몸을 내민다 (평면이라 방향이 있다)
    const ha = game.heroAngle || 0;
    const x = this.heroX + Math.cos(ha) * lunge * 24;
    const y = this.groundY + Math.sin(ha) * lunge * 24 * this.squash;
    if (pose) { opts.pose = { ...pose, alpha: 1 }; opts.lunge = 0; opts.run = false; }
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
      const down = k < 0.35 ? 1 - (1 - k / 0.35) ** 2 : k < 0.7 ? 1 : 1 - ((k - 0.7) / 0.3) ** 2;
      downRot = (opts.flip ? 1 : -1) * down * 1.3;
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
    const rideOpt = { t: this.t, moving, flip: !!opts.flip };
    if (ride) {
      drawCreature(this.ctx, mt.id, x, y, { ...rideOpt, layer: 'back' });
      fy = y + saddleY(mt.id, this.t, moving);
    }
    if (downRot) {
      this.ctx.save();
      this.ctx.translate(x, y); this.ctx.rotate(downRot); this.ctx.translate(-x, -y);
      this.ctx.globalAlpha *= 1 - Math.abs(downRot) / 1.3 * 0.35;
      drawFighter(this.ctx, x, y, look, opts);
      this.ctx.restore();
    } else drawFighter(this.ctx, x, fy, look, { ...opts, run: ride ? false : opts.run });
    if (ride) drawCreature(this.ctx, mt.id, x, y, { ...rideOpt, layer: 'front' });
    // 데려간 영수들이 뒤를 따른다 (예전엔 s.pet 한 마리만 그렸는데, 영수가 여럿이 된 뒤로
    // 그 값이 늘 비어 있어서 아무것도 안 그려졌다)
    // 애완동물 — 무인 뒤를 따라 걷고, 칠 때는 과녁 쪽으로 튀어 나갔다 돌아온다
    const back = opts.flip ? 1 : -1;
    game.petTeam().forEach((pet, i) => {
      let px = x + back * (50 + i * 34);
      let py = y + 12 - (i % 2) * 16;
      const atk = this.petAtk?.[i];
      if (atk && atk.t > 0) {
        atk.t -= this._lastDt || 0;
        const k = Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - atk.t / 0.32)));
        px += (atk.x - px) * 0.55 * k;
        py += (atk.y - py) * 0.55 * k - k * 10;
      }
      drawCreature(this.ctx, pet.kind, px, py, { t: this.t + i * 0.7, moving: moving || (atk && atk.t > 0), flip: !!opts.flip, scale: 1.05 });
    });
    if (this.fxLevel > 0) this.drawGearAura(this.ctx, x, fy, this.gearLook(game), true);
    hpBar(this.ctx, x - 32, fy - 128, 64, 6, ratio(game.heroHp, st.hp), '#16a34a');
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
      drawLowObstacle(this.ctx, o.kind, x, y, this.t, o.seed, this.squash);
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
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.35) / 0.65) * 0.9;
    ctx.translate(x + away * fall * 14, y);
    const sc = (def.look?.scale || 1) * 0.94 * this.crowdScale;
    ctx.scale(sc, sc);
    if (def.emoji) {
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

  // ---------- 적 ----------
  // 들판에 흩어진 다른 적들 — 각자 제자리에 선다
  drawAdd(game, a) {
    const { ctx } = this;
    const x = this.sx(a);
    const y = this.sy(a);
    if (x < -90 || x > this.w + 90 || y < -110 || y > this.h + 90) return; // 화면 밖은 그리지 않는다
    const def = a.def || {};
    const face = a.x >= game.heroX; // 무인 쪽을 본다
    ctx.save();
    const sc = (def.look?.scale || 1) * 0.94 * this.crowdScale * (a.grade === 1 ? 1.1 : 1);
    const time = this.t + 0.7 + (Math.abs(a.x) % 7) * 0.2;
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
    const kx = hk * hk * 9 * away;
    if (def.emoji) emoji(ctx, def.emoji, x + kx, y, 44, face);
    else if (def.beast) {
      // 들짐승 (v117) — 맞으면 찌그러졌다 돌아온다
      ctx.save();
      ctx.translate(x + kx, y);
      if (hk > 0) ctx.scale(1 + 0.08 * hk, 1 - 0.1 * hk);
      if (fx) { ctx.shadowColor = this.mobCol(a); ctx.shadowBlur = a.grade >= 2 ? 18 : 10; }
      drawCreature(ctx, def.beast, 0, 0, { t: time, moving: !!a.move, flip: face, scale: (def.bscale || 1.7) * this.crowdScale * persp * (a.grade === 1 ? 1.1 : 1) });
      ctx.restore();
    } else {
      const spr = fighterSprite(def.look || {}, time, def.look?.weapon, this.dpr || 1);
      if (spr) {
        ctx.save();
        ctx.translate(x + kx, y);
        const s2 = sc * persp;
        if (s2 !== 1) ctx.scale(s2, s2);
        if (face) ctx.scale(-1, 1);
        if (hk > 0) { ctx.rotate(-0.12 * hk * (face ? -away : away)); ctx.scale(1 + 0.06 * hk, 1 - 0.08 * hk); }
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
    if (a.elite) { ctx.globalAlpha = 1; gradeTag(ctx, '정예', x, y - 100 * sc, '#fb923c'); }
    // 마을 사람은 이름을 단다
    if (a.npc) { ctx.globalAlpha = 1; nameTag(ctx, def.name || '', x, y - 104, true); }
    // 체력바는 가까이 붙은 적만. 수십 마리가 전부 달면 주황 막대가 화면을 덮는다.
    // 그리고 **맞은 적만** — 멀쩡한 졸개 머리 위 꽉 찬 막대는 아무것도 알려 주지 않는다
    const near = (this.overview || Math.hypot(x - this.heroX, y - this.groundY) <= HP_BAR_RANGE) && big(a.hp).lt(a.maxHp);
    if (near) {
      // 가로로 긴 주황 막대가 수십 개면 화면이 막대로 덮인다. 가늘게, 짧게.
      ctx.globalAlpha = depth;
      hpBar(ctx, x - 17, y - 90, 34, 3, ratio(a.hp, a.maxHp), '#b45309');
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
    if (look) {
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
    const top = y - 118 * scale;
    if (m.elite && m.alive) gradeTag(ctx, '정예', x, top - 26, '#fb923c');
    if (m.petEmoji) emoji(ctx, m.petEmoji, x + 58, y + 2 - Math.abs(Math.sin(this.t * 4 + 2)) * 6, 34, true);
    if (m.stun > 0 && m.alive) dizzy(ctx, x, y - 112 * scale, this.t);
    if (m.alive && !m.isRaid) {
      const bw = boss || m.trial || m.isHero ? 110 : 66;
      hpBar(ctx, x - bw / 2, top - 6, bw, 6, ratio(m.hp, m.maxHp), boss || m.trial ? '#b91c1c' : '#ea580c');
      const name = m.isHero ? `${RANKS[m.rank || 0].name} ${m.name}` : m.trial ? '심마' : def.name || '';
      // 물린 카메라에서는 졸개 이름을 안 단다 — 옆 칸 무인의 이름표와 겹친다. 두목만.
      if (!this.overview || boss || m.trial) nameTag(ctx, name, x, top - 12, boss || m.trial);
      ccDots(ctx, m, x, top - 13);
    }
  }

  // ---------- 효과 ----------
  drawProjectiles(dt) {
    const { ctx } = this;
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
  drawTells(game) {
    const ts = game?.tells;
    if (!ts?.length) return;
    const { ctx } = this;
    const sq = this.squash;
    const blink = 0.5 + 0.5 * Math.sin(this.t * 22);
    ctx.save();
    for (const tl of ts) {
      if (tl.wait > 0) continue;
      const k = 1 - Math.max(0, tl.t / tl.max);           // 0 → 1 차오른다
      const urgent = tl.t < 0.35;
      const edge = `rgba(248,113,113,${urgent ? 0.6 + blink * 0.4 : 0.85})`;
      ctx.lineWidth = 2.5;
      if (tl.kind === 'circle' || tl.kind === 'donut') {
        const x = this.sx(tl), y = this.sy(tl);
        const r1 = tl.kind === 'donut' ? tl.r1 : tl.r, r0 = tl.kind === 'donut' ? tl.r0 : 0;
        ctx.fillStyle = 'rgba(220,38,38,0.16)';
        ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * sq, 0, 0, Math.PI * 2);
        if (r0) ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        // 차오르는 안쪽 (고리는 안에서 밖으로)
        const rf = r0 + (r1 - r0) * k;
        ctx.fillStyle = `rgba(239,68,68,${0.22 + k * 0.25})`;
        ctx.beginPath(); ctx.ellipse(x, y, rf, rf * sq, 0, 0, Math.PI * 2);
        if (r0) ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2);
        ctx.fill('evenodd');
        ctx.strokeStyle = edge;
        ctx.beginPath(); ctx.ellipse(x, y, r1, r1 * sq, 0, 0, Math.PI * 2); ctx.stroke();
        if (r0) { ctx.strokeStyle = 'rgba(134,239,172,0.8)'; ctx.beginPath(); ctx.ellipse(x, y, r0, r0 * sq, 0, 0, Math.PI * 2); ctx.stroke(); }
      } else if (tl.kind === 'line') {
        const a = { x: tl.x0, y: tl.y0 }, b = { x: tl.x1, y: tl.y1 };
        const ax = this.sx(a), ay = this.sy(a), bx = this.sx(b), by = this.sy(b);
        const dx = tl.x1 - tl.x0, dy = tl.y1 - tl.y0, L = Math.hypot(dx, dy) || 1;
        const nx = (-dy / L) * tl.w / 2, ny = (dx / L) * tl.w / 2 * sq;
        const quad = (f) => { ctx.beginPath(); ctx.moveTo(ax + nx, ay + ny); ctx.lineTo(ax + (bx - ax) * f + nx, ay + (by - ay) * f + ny); ctx.lineTo(ax + (bx - ax) * f - nx, ay + (by - ay) * f - ny); ctx.lineTo(ax - nx, ay - ny); ctx.closePath(); };
        ctx.fillStyle = 'rgba(220,38,38,0.16)'; quad(1); ctx.fill();
        ctx.fillStyle = `rgba(239,68,68,${0.22 + k * 0.25})`; quad(k); ctx.fill();
        ctx.strokeStyle = edge; quad(1); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawEffects(dt, game) {
    const { ctx } = this;
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
      // 흙먼지는 떨어지지 않고 퍼지며 느려진다
      if (p.dust) { p.vx *= 1 - dt * 3; p.vy *= 1 - dt * 3; p.size += dt * 16; } else p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.ingot && p.y > this.groundY) { p.y = this.groundY; p.vy *= -0.35; p.vx *= 0.6; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 0.4)) * (p.dust ? 0.45 : 1);
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
    if (this.particles.length > 240) this.particles.splice(0, this.particles.length - 240);
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
      ctx.font = f.brush ? `${f.size * pop * 1.2}px ${BRUSH}` : `900 ${f.size * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(f.text, f.x * z, f.y * z);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * z, f.y * z);
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
      const vs = Math.min(40, (this.h * 0.5) / n);
      ctx.font = `${vs}px ${BRUSH}`;
      ctx.lineWidth = 6;
      const x0 = Math.max(26, w * 0.09);
      const y0 = this.h * 0.2 - (1 - Math.min(1, (1 - k) * 6)) * 14;
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
    if (!ki.hit && t > 0.38 / sp) { ki.hit = true; this.flash = Math.max(this.flash, full ? 0.35 : 0.15); this.shake = Math.max(this.shake, full ? 0.8 : 0.35); }
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
    ctx.font = `30px ${BRUSH}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, w / 2, y + 1);
    if (b.seal) { // 붉은 낙관
      const sx = w * 0.84;
      ctx.save();
      ctx.translate(sx, y - 2);
      ctx.rotate(-0.08);
      ctx.fillStyle = '#b91c1c';
      roundRect(ctx, -17, -17, 34, 34, 4);
      ctx.fill();
      ctx.fillStyle = '#fef2f2';
      ctx.font = `26px ${BRUSH}`;
      ctx.fillText(b.seal, 0, 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ---------- 무인 그리기 ----------
// 발끝 가운데가 (x, y), 오른쪽을 본다. look: 무복 색·머리·무기, o: 애니메이션 옵션
const CORPSE_SEC = 0.55;
const HERO_DOWN_SEC = 0.9;

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
  if (o.flip) ctx.scale(-1, 1);
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
      const ow = o.orbit || weapon;
      const col = look.aura || '#e0f2fe';
      if (ow === 'fist') {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
        g.addColorStop(0, 'rgba(255,251,235,0.95)'); g.addColorStop(0.5, hexA(col, 0.75)); g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g; circle(ctx, 0, 0, 11);
        ctx.fillStyle = '#fbbf24'; ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1.2;
        roundRect(ctx, -5, -4.5, 10, 9, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(-5, k * 2.6); ctx.lineTo(-1.5, k * 2.6); } ctx.stroke();
      } else if (ow === 'fan') {
        ctx.rotate(Math.sin(t * 2 + i) * 0.3);
        ctx.fillStyle = hexA(col, 0.85); ctx.strokeStyle = '#1e1b4b'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.arc(0, 6, 13, -Math.PI * 0.85, -Math.PI * 0.15); ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 5; k++) { const aa = -Math.PI * 0.85 + (k + 0.5) * (Math.PI * 0.7 / 5); ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(Math.cos(aa) * 13, 6 + Math.sin(aa) * 13); ctx.stroke(); }
      } else if (ow === 'dagger') {
        ctx.rotate(Math.PI / 2 + t * 3 + i);
        ctx.fillStyle = '#bef264'; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(2, 4); ctx.lineTo(-2, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = hexA('#22c55e', 0.7); circle(ctx, 0, 6, 3);
      } else if (ow === 'claw') {
        ctx.strokeStyle = hexA(col, 0.95); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f0abfc'; circle(ctx, 0, -6.5, 2.4);
      } else {
        ctx.rotate(Math.PI / 2 + Math.sin(t * 2 + i) * 0.1);
        drawJian(ctx, 0, 0, col, true, 0.7);
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

function hpBar(ctx, x, y, w, h, ratio, color) {
  h *= Math.min(UIK, 1.6);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
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
