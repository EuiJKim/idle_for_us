// v325 여협 머리 — 그림 조각(art/hero)에 여자 머리가 없어 캔버스로 그린다.
// 남자 머리 그림과 같은 규칙: 168px 폭, 오른쪽을 보는 3/4 얼굴, 맨 아래가 턱(옷깃 안으로 든다).
// 굵은 먹선 + 살·머리 명암 + 머리결 빛 — 화면에서는 폭 25px로 줄어 그림 조각들과 나란히 선다.
// 뒷머리(긴 생머리·말총·양갈래)는 몸 뒤로 늘어져야 해서 머리 판이 아니라 drawBackHair로 몸보다 먼저 그린다.

export const FHEAD_STYLES = [
  ['long', '긴 생머리'],
  ['bun', '쪽머리 비녀'],
  ['pony', '높은 말총'],
  ['twin', '양갈래'],
  ['short', '단발'],
];
export const FHEAD_W = 168, FHEAD_H = 152;
// art.js HEAD_FIT과 같은 꼴 — 눈썹 선(위에서) · 눈 선(아래에서) · 눈 가로 자리
export const FHEAD_FIT = { crop: 1, brow: 0.42, eye: 0.44, eyeX: 0.71 };

const LINE = 'rgba(22,15,10,0.92)';
function shade(hex, k) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return hex;
  const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
  const v = c.map((x) => Math.max(0, Math.min(255, Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k)))));
  return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
function hairFill(c, hair, x0, y0, x1, y1) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shade(hair, 0.22)); g.addColorStop(0.45, hair); g.addColorStop(1, shade(hair, -0.45));
  return g;
}
// 머리결 빛 — 정수리에서 흘러내리는 밝은 결 몇 줄
function strands(c, hair, pts) {
  c.save();
  c.strokeStyle = shade(hair, 0.45); c.globalAlpha = 0.55; c.lineWidth = 2.2; c.lineCap = 'round';
  for (const [a, b, d] of pts) { c.beginPath(); c.moveTo(...a); c.quadraticCurveTo(...b, ...d); c.stroke(); }
  c.restore();
}

// 머리 한 장 — 168×152 캔버스에 그린다
export function drawFemaleHead(c, style, hair = '#1c1612', band = '#7f1d1d', skin = '#f3d6bb') {
  c.lineJoin = 'round'; c.lineCap = 'round';
  // ---- 뒤통수 머리 덩어리(얼굴 뒤) ----
  c.fillStyle = hairFill(c, hair, 40, 20, 90, 140); c.strokeStyle = LINE; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(118, 30);
  c.bezierCurveTo(90, 6, 36, 14, 26, 58);
  if (style === 'short') { c.bezierCurveTo(20, 92, 30, 120, 56, 134); c.lineTo(84, 128); }
  else { c.bezierCurveTo(18, 100, 26, 140, 44, 152); c.lineTo(92, 152); }
  c.lineTo(96, 60);
  c.closePath(); c.fill(); c.stroke();
  // ---- 쪽머리 · 말총 매듭 · 양갈래 매듭 (뒤통수 위) ----
  if (style === 'bun') {
    c.fillStyle = hairFill(c, hair, 0, 30, 50, 90);
    c.beginPath(); c.ellipse(24, 56, 22, 20, -0.3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = shade(hair, 0.4); c.lineWidth = 1.6; c.globalAlpha = 0.6;
    c.beginPath(); c.arc(24, 56, 12, -2.4, 0.6); c.stroke(); c.globalAlpha = 1;
    // 비녀 — 금빛 막대와 띠 빛깔 구슬
    c.strokeStyle = LINE; c.lineWidth = 6; c.beginPath(); c.moveTo(-2, 38); c.lineTo(52, 70); c.stroke();
    c.strokeStyle = '#e8c87a'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-2, 38); c.lineTo(52, 70); c.stroke();
    c.fillStyle = band; c.strokeStyle = LINE; c.lineWidth = 2;
    c.beginPath(); c.arc(2, 40, 6, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(0, 38, 2, 0, Math.PI * 2); c.fill();
  } else if (style === 'pony') {
    c.fillStyle = hairFill(c, hair, 20, 0, 60, 40);
    c.beginPath(); c.ellipse(46, 18, 16, 13, -0.4, 0, Math.PI * 2); c.fill(); c.strokeStyle = LINE; c.lineWidth = 3; c.stroke();
    c.fillStyle = band; c.lineWidth = 2;
    c.beginPath(); c.ellipse(38, 26, 7, 10, -0.6, 0, Math.PI * 2); c.fill(); c.stroke();
  } else if (style === 'twin') {
    c.fillStyle = band; c.strokeStyle = LINE; c.lineWidth = 2;
    for (const [x, y] of [[30, 74], [48, 100]]) {
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 14, y - 8); c.lineTo(x - 12, y + 8); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 6, y - 12); c.lineTo(x + 10, y + 2); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
  // ---- 얼굴 ----
  const sg = c.createLinearGradient(70, 40, 140, 150);
  sg.addColorStop(0, shade(skin, 0.12)); sg.addColorStop(0.6, skin); sg.addColorStop(1, shade(skin, -0.12));
  c.fillStyle = sg; c.strokeStyle = LINE; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(78, 44);
  c.bezierCurveTo(104, 34, 134, 46, 138, 74);     // 이마
  c.quadraticCurveTo(140, 84, 147, 97);            // 콧등
  c.quadraticCurveTo(144, 102, 138, 101);           // 코끝
  c.quadraticCurveTo(140, 108, 136, 112);           // 인중
  c.quadraticCurveTo(140, 116, 135, 121);           // 입술
  c.quadraticCurveTo(133, 138, 112, 149);           // 턱
  c.quadraticCurveTo(90, 150, 76, 128);             // 턱선
  c.lineTo(72, 70);
  c.closePath(); c.fill(); c.stroke();
  // 볼 붉은 기
  c.fillStyle = 'rgba(232,120,120,0.22)'; c.beginPath(); c.ellipse(116, 110, 13, 8, 0, 0, Math.PI * 2); c.fill();
  // 귀
  c.fillStyle = skin; c.strokeStyle = LINE; c.lineWidth = 2.4;
  c.beginPath(); c.ellipse(80, 100, 8, 12, 0.15, 0, Math.PI * 2); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(120,70,40,0.5)'; c.lineWidth = 1.4; c.beginPath(); c.arc(81, 100, 4.5, -1.2, 1.4); c.stroke();
  // 귀걸이(띠 빛깔)
  c.fillStyle = band; c.strokeStyle = LINE; c.lineWidth = 1.5;
  c.beginPath(); c.arc(80, 116, 3.4, 0, Math.PI * 2); c.fill(); c.stroke();
  // 눈 — 아몬드 꼴, 굵은 윗눈썹(속눈썹), 검은 눈동자에 빛
  c.fillStyle = '#fbf7f2'; c.strokeStyle = LINE; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(108, 86); c.quadraticCurveTo(120, 77, 132, 84); c.quadraticCurveTo(121, 92, 108, 86); c.fill();
  c.fillStyle = '#1b1210'; c.beginPath(); c.arc(124, 85, 5.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(125.6, 83.4, 1.7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = LINE; c.lineWidth = 3.2;
  c.beginPath(); c.moveTo(105, 85); c.quadraticCurveTo(119, 74, 134, 82); c.stroke();
  c.lineWidth = 2; c.beginPath(); c.moveTo(131, 81); c.lineTo(137, 78); c.stroke();     // 눈꼬리 속눈썹
  c.strokeStyle = 'rgba(80,40,30,0.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(110, 90); c.quadraticCurveTo(121, 95, 130, 89); c.stroke();
  // 눈썹 — 가늘고 길게
  c.strokeStyle = shade(hair, -0.2); c.lineWidth = 2.6; c.beginPath(); c.moveTo(104, 70); c.quadraticCurveTo(120, 63, 135, 69); c.stroke();
  // 입술
  c.fillStyle = '#c24152'; c.strokeStyle = 'rgba(90,20,30,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(127, 116); c.quadraticCurveTo(133, 113, 137, 116); c.quadraticCurveTo(133, 121, 127, 116); c.fill(); c.stroke();
  // ---- 앞머리 · 옆머리(얼굴 위) ----
  c.fillStyle = hairFill(c, hair, 70, 10, 140, 80); c.strokeStyle = LINE; c.lineWidth = 3;
  c.beginPath();
  c.moveTo(60, 70);
  c.bezierCurveTo(56, 26, 104, 8, 132, 30);
  c.quadraticCurveTo(144, 42, 141, 62);
  c.lineTo(131, 54); c.lineTo(126, 68); c.lineTo(117, 52); c.lineTo(109, 66); c.lineTo(101, 50); c.lineTo(92, 62);
  c.quadraticCurveTo(86, 70, 90, 84);
  // 귀 앞 옆머리 한 가닥이 볼을 따라 내려온다
  c.quadraticCurveTo(96, 110, 92, 138);
  c.quadraticCurveTo(84, 124, 80, 96);
  c.quadraticCurveTo(70, 82, 60, 70);
  c.closePath(); c.fill(); c.stroke();
  strands(c, hair, [[[78, 30], [96, 18], [122, 26]], [[70, 44], [80, 30], [100, 24]], [[88, 70], [90, 96], [92, 126]]]);
  // 머리띠(단발·긴 생머리) — 띠 빛깔
  if (style === 'long' || style === 'short') {
    c.strokeStyle = LINE; c.lineWidth = 7.5; c.beginPath(); c.moveTo(62, 46); c.quadraticCurveTo(96, 20, 134, 34); c.stroke();
    c.strokeStyle = band; c.lineWidth = 5; c.beginPath(); c.moveTo(62, 46); c.quadraticCurveTo(96, 20, 134, 34); c.stroke();
  }
}

// 몸 뒤로 늘어지는 머리 — 뼈대 좌표(발끝 y=0, 머리 둘레 y≈-63~-90). 몸보다 먼저 그린다.
export function drawBackHair(ctx, style, hair, band, t = 0, run = false) {
  if (style === 'bun' || style === 'short') return;
  const sw = Math.sin(t * 3.2) * 1.6 + (run ? -3 : 0);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LINE; ctx.lineWidth = 1.2;
  const fill = (x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, shade(hair, 0.15)); g.addColorStop(1, shade(hair, -0.4)); return g; };
  if (style === 'long') {
    ctx.fillStyle = fill(-6, -84, -12, -34);
    ctx.beginPath();
    ctx.moveTo(-3, -86); ctx.quadraticCurveTo(-15, -78, -14 + sw, -58);
    ctx.quadraticCurveTo(-15 + sw * 1.4, -42, -10 + sw * 1.8, -34);
    ctx.quadraticCurveTo(-4 + sw, -40, -1, -50); ctx.quadraticCurveTo(2, -66, 4, -82); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (style === 'pony') {
    ctx.fillStyle = fill(-6, -92, -14, -52);
    ctx.beginPath();
    ctx.moveTo(-5, -92); ctx.quadraticCurveTo(-18 + sw, -86, -17 + sw * 1.5, -70);
    ctx.quadraticCurveTo(-16 + sw * 2, -58, -12 + sw * 2.2, -50);
    ctx.quadraticCurveTo(-10 + sw, -62, -7, -74); ctx.quadraticCurveTo(-5, -84, -1, -90); ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else if (style === 'twin') {
    for (const [x, k] of [[-6, 1], [-1, 0.7]]) {
      ctx.fillStyle = fill(x, -80, x - 6, -46);
      ctx.beginPath();
      ctx.moveTo(x, -80); ctx.quadraticCurveTo(x - 7 + sw * k, -66, x - 6 + sw * 1.6 * k, -48);
      ctx.quadraticCurveTo(x - 2 + sw * k, -56, x + 2, -78); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}
