// 애완동물·탈것 그림 — 그림 파일 없이 붓선 느낌의 도형으로 그린다(무인·몹과 같은 먹선).
// 발밑 가운데가 (0, 0), 오른쪽을 본다. 걸을 때는 다리가 엇갈리고 몸이 출렁이며, 서 있으면 숨을 쉰다.
//
// 탈것은 두 겹으로 그린다: back(먼 다리·꼬리) → 무인 → front(몸통·가까운 다리·머리·안장).
// 몸통이 무인의 다리를 덮어서 '올라탄' 것처럼 보인다. 무인을 앉힐 높이는 saddleY.
const INK = '#1a1410';

function blob(ctx, x, y, rx, ry, fill, rot = 0, line = 2) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}
function poly(ctx, pts, fill, line = 2) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}
function stroke(ctx, pts, color, w, cap = 'round') {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------- 네 발 짐승 (말·나귀·낙타·순록·범·여우·해태·기린) ----------
// s: len 몸 길이 · bh 몸 높이 · leg 다리 · col 털빛 · belly 배 · hoof 발굽 · neck [길이, 각도] · head [길이, 높이]
//    ear long|pointy|round · horn one|antler|two · mane 갈기 빛 · tail tuft|long|brush|nine|tiger|flame
//    stripes 줄무늬 빛 · spots 점 빛 · hump 혹 · fur(둥근 갈기 다발) · clouds(발밑 구름) · saddle 안장
function quadParts(s, t, moving) {
  const p = moving ? t * (s.gait || 10) : 0;
  const bob = moving ? -Math.abs(Math.sin(p)) * 2.4 : Math.sin(t * 2.2) * 0.8;
  const top = -(s.leg + s.bh) + bob;            // 등 높이
  const cy = top + s.bh / 2;                    // 몸통 가운데
  return { p, bob, top, cy };
}
function quadLeg(ctx, s, x, swing, far, cy) {
  const hipY = cy + s.bh * 0.25;
  const a = swing * (s.stride ?? 0.5);
  const fx = x + Math.sin(a) * s.leg;
  const fy = hipY + Math.cos(a) * (s.leg + s.bh * 0.25) - 0.5;
  const col = far ? shade(s.col, -0.28) : s.col;
  stroke(ctx, [[x, hipY], [(x + fx) / 2 + (far ? -1 : 1), (hipY + fy) / 2], [fx, fy]], INK, s.legW + 3);
  stroke(ctx, [[x, hipY], [(x + fx) / 2 + (far ? -1 : 1), (hipY + fy) / 2], [fx, fy]], col, s.legW);
  // 발굽·발
  blob(ctx, fx + 1, fy - 1, s.legW * 0.62, s.legW * 0.4, s.hoof || shade(s.col, -0.55), 0, 1.5);
}
function quadTail(ctx, s, t, top, moving) {
  const x0 = -s.len * 0.48, y0 = top + s.bh * 0.25;
  const sw = Math.sin(t * (moving ? 7 : 2.6)) * 0.35;
  const L = s.tailLen || s.len * 0.42;
  const kind = s.tail || 'tuft';
  if (kind === 'nine') {
    // 구미호 — 아홉 꼬리가 부채처럼
    for (let i = 0; i < 9; i++) {
      const a = -2.2 + i * 0.22 + sw * 0.5;
      const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L;
      const mx = x0 + Math.cos(a + 0.3) * L * 0.55, my = y0 + Math.sin(a + 0.3) * L * 0.55;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 8.5; ctx.stroke();
      ctx.strokeStyle = s.col; ctx.lineWidth = 6; ctx.stroke();
      blob(ctx, ex, ey, 3.2, 3.2, '#fff7ed', 0, 1.2);
    }
    return;
  }
  const a = (kind === 'long' || kind === 'tiger' ? 2.2 : 2.0) + sw;
  const ex = x0 + Math.cos(a) * L, ey = y0 + Math.sin(a) * L;
  const mx = x0 - L * 0.45, my = y0 + L * 0.05;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, ex, ey);
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = (s.tailW || 4) + 3; ctx.stroke();
  ctx.strokeStyle = kind === 'tiger' ? s.col : s.mane || shade(s.col, -0.3); ctx.lineWidth = s.tailW || 4; ctx.stroke();
  if (kind === 'tiger') { for (let i = 1; i < 4; i++) { const k = i / 4; blob(ctx, x0 + (ex - x0) * k - L * 0.12 * Math.sin(k * 3), y0 + (ey - y0) * k, 1.2, 2.6, s.stripes || INK, 0, 0); } }
  if (kind === 'tuft' || kind === 'brush') blob(ctx, ex, ey, kind === 'brush' ? 5.5 : 3.6, kind === 'brush' ? 7.5 : 5, s.mane || shade(s.col, -0.3), a, 1.5);
  if (kind === 'flame') for (let i = 0; i < 3; i++) blob(ctx, ex + i * 2, ey - i * 3, 4 - i, 6 - i, i ? '#fde68a' : '#fb923c', a, 0);
}
function quadBody(ctx, s, t, moving, cy, top) {
  // 몸통
  if (s.hump) {
    blob(ctx, -s.len * 0.08, top - s.bh * 0.15, s.len * 0.2, s.bh * 0.5, s.col, 0, 2);
  }
  blob(ctx, 0, cy, s.len / 2, s.bh / 2, s.col);
  if (s.belly) { ctx.save(); ctx.beginPath(); ctx.ellipse(0, cy, s.len / 2 - 1, s.bh / 2 - 1, 0, 0, Math.PI * 2); ctx.clip(); blob(ctx, 0, cy + s.bh * 0.42, s.len * 0.42, s.bh * 0.32, s.belly, 0, 0); ctx.restore(); }
  if (s.stripes) for (let i = -2; i <= 2; i++) stroke(ctx, [[i * s.len * 0.16 - 2, top + 2], [i * s.len * 0.16 + 3, cy + 2], [i * s.len * 0.16 - 1, cy + s.bh * 0.3]], s.stripes, 2.2);
  if (s.spots) for (let i = 0; i < 6; i++) blob(ctx, -s.len * 0.3 + i * s.len * 0.12, cy - s.bh * 0.12 + (i % 2) * 5, 2.2, 1.6, s.spots, 0, 0);
  if (s.scales) for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-s.len * 0.3 + i * s.len * 0.14, cy, 3.4, 0, Math.PI); ctx.strokeStyle = s.scales; ctx.lineWidth = 1.2; ctx.stroke(); }
  // 안장
  if (s.saddle) {
    const sx = -s.len * 0.04;
    poly(ctx, [[sx - s.len * 0.2, top + 1], [sx + s.len * 0.2, top + 1], [sx + s.len * 0.17, top + s.bh * 0.75], [sx - s.len * 0.17, top + s.bh * 0.75]], s.saddle, 1.6);
    stroke(ctx, [[sx - s.len * 0.17, top + s.bh * 0.7], [sx + s.len * 0.17, top + s.bh * 0.7]], '#d4a64a', 1.6);
    blob(ctx, sx, top, s.len * 0.17, 3.2, shade(s.saddle, -0.35), 0, 1.5);
  }
}
function quadHead(ctx, s, t, moving, top) {
  const [nl, na] = s.neck || [s.bh * 0.9, -0.9];
  const nx0 = s.len * 0.36, ny0 = top + s.bh * 0.35;
  const nod = moving ? Math.sin(t * (s.gait || 10)) * 0.08 : Math.sin(t * 1.6) * 0.04;
  const hx = nx0 + Math.cos(na + nod) * nl, hy = ny0 + Math.sin(na + nod) * nl;
  // 목
  stroke(ctx, [[nx0, ny0], [hx, hy]], INK, (s.neckW || s.bh * 0.55) + 3);
  stroke(ctx, [[nx0, ny0], [hx, hy]], s.col, s.neckW || s.bh * 0.55);
  // 갈기
  if (s.mane && !s.fur) {
    const wave = Math.sin(t * 6) * 1.5;
    for (let i = 0; i <= 4; i++) {
      const k = i / 4;
      const mx = nx0 + (hx - nx0) * k - 4, my = ny0 + (hy - ny0) * k - 4;
      blob(ctx, mx - 2 + wave * (1 - k), my, 3.4, 5.2, s.mane, -0.6, 1.2);
    }
  }
  if (s.fur) for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.2 + i * 0.5; blob(ctx, hx - 4 + Math.cos(a) * 9, hy + 2 + Math.sin(a) * 9, 4.6, 4.6, s.fur, 0, 1.2); }
  const [hl, hh] = s.head || [s.bh * 0.7, s.bh * 0.45];
  // 귀 (머리 뒤)
  const ear = s.ear || 'pointy';
  if (ear === 'long') { poly(ctx, [[hx - 2, hy - hh * 0.3], [hx - 7, hy - hh * 1.9], [hx + 2, hy - hh * 0.5]], s.col, 1.6); poly(ctx, [[hx + 1, hy - hh * 0.35], [hx - 2, hy - hh * 1.8], [hx + 5, hy - hh * 0.45]], shade(s.col, -0.15), 1.6); }
  if (ear === 'pointy') poly(ctx, [[hx - 3, hy - hh * 0.3], [hx - 1, hy - hh * 1.25], [hx + 4, hy - hh * 0.35]], s.col, 1.6);
  if (ear === 'round') { blob(ctx, hx - 2, hy - hh * 0.75, 3.6, 3.6, s.col, 0, 1.5); blob(ctx, hx + 3, hy - hh * 0.8, 3.2, 3.2, s.col, 0, 1.5); }
  // 뿔
  if (s.horn === 'one') stroke(ctx, [[hx + 1, hy - hh * 0.5], [hx + 6, hy - hh * 1.9]], s.hornCol || '#fde68a', 3);
  if (s.horn === 'antler') {
    const c = s.hornCol || '#a16207';
    stroke(ctx, [[hx - 1, hy - hh * 0.5], [hx - 6, hy - hh * 2.2], [hx - 12, hy - hh * 2.8]], c, 2.4);
    stroke(ctx, [[hx - 4, hy - hh * 1.6], [hx + 2, hy - hh * 2.4]], c, 2);
    stroke(ctx, [[hx - 8, hy - hh * 2.4], [hx - 7, hy - hh * 3.1]], c, 2);
  }
  if (s.horn === 'two') { stroke(ctx, [[hx - 2, hy - hh * 0.5], [hx - 7, hy - hh * 1.6]], s.hornCol || '#fde68a', 2.6); stroke(ctx, [[hx + 2, hy - hh * 0.5], [hx, hy - hh * 1.7]], s.hornCol || '#fde68a', 2.6); }
  // 머리 — 주둥이가 앞으로
  blob(ctx, hx + hl * 0.25, hy + hh * 0.1, hl * 0.6, hh * 0.62, s.col, 0.25);
  blob(ctx, hx + hl * 0.62, hy + hh * 0.35, hl * 0.3, hh * 0.42, s.muzzle || shade(s.col, 0.12), 0.2, 1.6);
  // 눈
  blob(ctx, hx + hl * 0.28, hy - hh * 0.08, 1.7, 1.9, s.eye || '#111', 0, 0);
  blob(ctx, hx + hl * 0.3, hy - hh * 0.14, 0.6, 0.6, '#fff', 0, 0);
  if (s.whisker) { stroke(ctx, [[hx + hl * 0.8, hy + hh * 0.4], [hx + hl * 1.25, hy + hh * 0.2]], INK, 1); stroke(ctx, [[hx + hl * 0.8, hy + hh * 0.5], [hx + hl * 1.25, hy + hh * 0.6]], INK, 1); }
  if (s.bell) blob(ctx, hx - 2, hy + hh * 0.9, 3, 3, '#facc15', 0, 1.2);
}
function drawQuad(ctx, s, t, moving, layer) {
  const { p, top, cy } = quadParts(s, t, moving);
  const xs = { fN: s.len * 0.3, fF: s.len * 0.24, bN: -s.len * 0.3, bF: -s.len * 0.36 };
  if (layer !== 'front') {
    if (s.clouds) for (let i = 0; i < 4; i++) blob(ctx, -s.len * 0.4 + i * s.len * 0.27, -2 + Math.sin(t * 3 + i) * 1.5, 9, 4.5, 'rgba(241,245,249,0.85)', 0, 1);
    quadLeg(ctx, s, xs.fF, Math.sin(p + Math.PI), true, cy);
    quadLeg(ctx, s, xs.bF, Math.sin(p), true, cy);
    quadTail(ctx, s, t, top, moving);
  }
  if (layer !== 'back') {
    quadBody(ctx, s, t, moving, cy, top);
    quadLeg(ctx, s, xs.bN, Math.sin(p + Math.PI), false, cy);
    quadLeg(ctx, s, xs.fN, Math.sin(p), false, cy);
    quadHead(ctx, s, t, moving, top);
  }
  return { top };
}

// ---------- 용 (청룡·황룡·청룡마) — 공중에 떠서 몸을 물결친다 ----------
function drawDragon(ctx, s, t, moving, layer) {
  const n = 11;
  const L = s.len;
  const lift = s.lift + Math.sin(t * 2) * 3;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);                       // 0 꼬리 … 1 머리
    const x = -L / 2 + k * L;
    const y = -lift + Math.sin(t * (moving ? 6 : 3) + k * 5.5) * s.amp * (1 - k * 0.6);
    pts.push([x, y, (s.thick * (0.35 + Math.sin(k * Math.PI * 0.85) * 0.75))]);
  }
  const drawBodyRange = (a, b) => {
    for (let i = a; i < b; i++) {
      const [x, y, r] = pts[i];
      blob(ctx, x, y, r * 1.15, r * 0.95, s.col, 0, 2);
      // 등지느러미 — 한 마디 걸러
      if (i % 2) poly(ctx, [[x - r * 0.5, y - r * 0.75], [x - r * 0.15, y - r * 1.55], [x + r * 0.35, y - r * 0.75]], s.fin, 1.2);
      blob(ctx, x, y + r * 0.35, r * 0.65, r * 0.4, s.belly, 0, 0);
    }
  };
  const mid = Math.floor(n * 0.5);
  if (layer !== 'front') {
    // 꼬리 끝 지느러미
    const [tx, ty] = pts[0];
    poly(ctx, [[tx, ty], [tx - 12, ty - 8 + Math.sin(t * 5) * 3], [tx - 9, ty + 6]], s.fin, 1.5);
    drawBodyRange(0, mid);
    // 앞뒤 발톱
    for (const i of [3, 7]) { const [x, y, r] = pts[i]; stroke(ctx, [[x, y + r * 0.6], [x + 4, y + r * 1.4 + Math.sin(t * 6 + i) * 2]], INK, 3.2); stroke(ctx, [[x, y + r * 0.6], [x + 4, y + r * 1.4 + Math.sin(t * 6 + i) * 2]], s.col, 1.8); }
  }
  if (layer !== 'back') {
    drawBodyRange(layer === 'front' ? mid : mid, n - 1);
    // 머리
    const [hx, hy] = pts[n - 1];
    const r = s.thick * 1.15;
    stroke(ctx, [[hx - 2, hy - r * 0.6], [hx - 10, hy - r * 1.8]], s.horn, 2.6);
    stroke(ctx, [[hx + 2, hy - r * 0.6], [hx - 4, hy - r * 1.9]], s.horn, 2.6);
    blob(ctx, hx, hy, r, r * 0.85, s.col, 0.1);
    blob(ctx, hx + r * 0.9, hy + r * 0.2, r * 0.7, r * 0.45, s.belly, 0.15, 1.6);
    blob(ctx, hx + r * 0.1, hy - r * 0.25, 1.9, 2.1, '#fde047', 0, 1);
    // 수염 — 물결친다
    const wv = Math.sin(t * 4) * 3;
    stroke(ctx, [[hx + r * 1.2, hy + r * 0.3], [hx + r * 2, hy + r * 0.1 + wv], [hx + r * 2.6, hy + r * 0.6 - wv]], s.whisker, 1.4);
    stroke(ctx, [[hx + r * 1.1, hy + r * 0.5], [hx + r * 1.8, hy + r * 1 - wv], [hx + r * 2.3, hy + r * 1.4 + wv]], s.whisker, 1.4);
    // 여의주
    if (s.pearl) blob(ctx, hx + r * 2.2, hy - r * 0.9 + Math.sin(t * 3) * 2, 3.2, 3.2, '#fef9c3', 0, 1.2);
  }
  return { top: pts[Math.floor(n * 0.6)][1] - s.thick };
}

// ---------- 새 (선학·주작) ----------
function drawBird(ctx, s, t, moving) {
  const fly = s.fly ? s.fly + Math.sin(t * 2.5) * 3 : 0;
  const by = -(s.leg + s.bh / 2) - fly;
  const flap = Math.sin(t * (s.fly ? 9 : moving ? 6 : 1.5));
  if (!s.fly) {
    // 다리 — 걸으면 엇갈린다
    const p = moving ? t * 8 : 0;
    for (const k of [0, Math.PI]) { const a = Math.sin(p + k) * 0.4; stroke(ctx, [[0, by + s.bh * 0.35], [Math.sin(a) * s.leg, by + s.bh * 0.35 + Math.cos(a) * s.leg]], s.legCol, 2); }
  } else blob(ctx, 0, 0, 10, 3, 'rgba(0,0,0,0.18)', 0, 0);
  // 꼬리깃
  for (let i = 0; i < (s.plumes || 3); i++) {
    const a = 2.7 + i * 0.16 + Math.sin(t * 3 + i) * 0.08;
    const L = s.tailLen * (1 - i * 0.12);
    stroke(ctx, [[-s.len * 0.35, by], [-s.len * 0.35 + Math.cos(a) * L, by + Math.sin(a) * L]], INK, 5);
    stroke(ctx, [[-s.len * 0.35, by], [-s.len * 0.35 + Math.cos(a) * L, by + Math.sin(a) * L]], i % 2 ? s.tail2 : s.tail, 3.2);
  }
  // 먼 날개
  poly(ctx, [[-2, by - 2], [-s.len * 0.45, by - s.bh * (0.4 + flap * 0.9)], [-s.len * 0.2, by + 3]], shade(s.wing, -0.25), 1.6);
  blob(ctx, 0, by, s.len / 2, s.bh / 2, s.col);
  // 가까운 날개
  poly(ctx, [[2, by - 1], [-s.len * 0.4, by - s.bh * (0.2 + flap * 1.1)], [-s.len * 0.3, by + 4]], s.wing, 1.6);
  // 목·머리
  const nx = s.len * 0.36, ny = by - s.bh * 0.2;
  const hx = nx + s.neck * 0.25, hy = ny - s.neck + Math.sin(t * 2) * 1.2;
  ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx + s.neck * 0.5, ny - s.neck * 0.4, hx, hy);
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = s.neckW + 3; ctx.stroke(); ctx.strokeStyle = s.col; ctx.lineWidth = s.neckW; ctx.stroke();
  blob(ctx, hx, hy, s.headR, s.headR * 0.9, s.col);
  if (s.crown) blob(ctx, hx - 1, hy - s.headR * 0.8, s.headR * 0.5, s.headR * 0.35, s.crown, 0, 1);
  poly(ctx, [[hx + s.headR * 0.6, hy - 1.5], [hx + s.headR * 0.6 + s.beak, hy + 0.5], [hx + s.headR * 0.6, hy + 2]], s.beakCol, 1.2);
  blob(ctx, hx + 1.5, hy - 1, 1.2, 1.3, '#111', 0, 0);
  if (s.flame) for (let i = 0; i < 3; i++) blob(ctx, -s.len * 0.2 + i * 6, by - s.bh * 0.6 - Math.abs(Math.sin(t * 8 + i)) * 4, 2.4, 4, '#fde68a', 0, 0);
}

// ---------- 현무 — 등딱지와 뱀꼬리 ----------
function drawTurtle(ctx, s, t, moving) {
  const p = moving ? t * 5 : 0;
  const bob = moving ? -Math.abs(Math.sin(p)) * 1 : Math.sin(t * 1.8) * 0.5;
  for (const [x, k] of [[-s.len * 0.3, 0], [s.len * 0.25, Math.PI], [-s.len * 0.22, Math.PI], [s.len * 0.32, 0]]) {
    const a = Math.sin(p + k) * 0.35;
    stroke(ctx, [[x, -s.leg], [x + Math.sin(a) * s.leg, -1]], INK, 7);
    stroke(ctx, [[x, -s.leg], [x + Math.sin(a) * s.leg, -1]], s.skin, 5);
  }
  // 뱀 꼬리
  const sw = Math.sin(t * 3) * 4;
  ctx.beginPath(); ctx.moveTo(-s.len * 0.45, -s.leg - 4);
  ctx.bezierCurveTo(-s.len * 0.75, -s.leg - 2 + sw, -s.len * 0.7, -s.leg - 22 - sw, -s.len * 0.45, -s.leg - 26);
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = '#4d7c0f'; ctx.lineWidth = 3.6; ctx.stroke();
  blob(ctx, -s.len * 0.42, -s.leg - 27, 3.6, 3, '#4d7c0f', 0, 1.2);
  // 머리
  const hx = s.len * 0.55 + (moving ? Math.sin(p) * 1.5 : 0), hy = -s.leg - 6 + bob;
  blob(ctx, hx, hy, 6, 5, s.skin);
  blob(ctx, hx + 2, hy - 1.5, 1.3, 1.3, '#111', 0, 0);
  // 등딱지
  ctx.beginPath();
  ctx.ellipse(0, -s.leg - 2 + bob, s.len / 2, s.bh, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = s.shell; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.strokeStyle = shade(s.shell, -0.35); ctx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * s.len * 0.25, -s.leg - s.bh * 0.45 + bob, s.bh * 0.32, 0, Math.PI * 2); ctx.stroke(); }
  stroke(ctx, [[-s.len / 2, -s.leg - 2 + bob], [s.len / 2, -s.leg - 2 + bob]], '#d4a64a', 2);
}

// ---------- 손오공 — 두 발로 깡충, 여의봉 ----------
function drawMonkey(ctx, s, t, moving) {
  const hop = moving ? Math.abs(Math.sin(t * 9)) * 6 : Math.abs(Math.sin(t * 2)) * 1;
  const by = -18 - hop;
  // 꼬리
  ctx.beginPath(); ctx.moveTo(-6, by + 6); ctx.bezierCurveTo(-18, by + 8, -20, by - 12 + Math.sin(t * 4) * 3, -12, by - 14);
  ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = s.col; ctx.lineWidth = 3; ctx.stroke();
  // 다리
  const a = moving ? Math.sin(t * 9) * 0.4 : 0;
  stroke(ctx, [[-3, by + 8], [-4 - a * 8, -1]], INK, 6); stroke(ctx, [[-3, by + 8], [-4 - a * 8, -1]], s.col, 4);
  stroke(ctx, [[3, by + 8], [4 + a * 8, -1]], INK, 6); stroke(ctx, [[3, by + 8], [4 + a * 8, -1]], s.col, 4);
  // 여의봉
  const sa = -0.9 + Math.sin(t * (moving ? 6 : 1.5)) * 0.15;
  stroke(ctx, [[8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16], [8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16]], INK, 5);
  stroke(ctx, [[8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16], [8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16]], '#b91c1c', 3);
  blob(ctx, 8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16, 2.4, 2.4, '#facc15', 0, 1);
  blob(ctx, 8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16, 2.4, 2.4, '#facc15', 0, 1);
  // 몸·머리
  blob(ctx, 0, by + 2, 8, 9, s.col);
  blob(ctx, 1, by + 4, 5, 6, s.belly, 0, 0);
  blob(ctx, 2, by - 11, 8, 7.5, s.col);
  blob(ctx, 4, by - 10, 5.5, 5, s.face, 0, 1.2);
  blob(ctx, -5, by - 11, 2.6, 3, s.face, 0, 1.2);
  blob(ctx, 5.5, by - 11.5, 1.2, 1.4, '#111', 0, 0);
  stroke(ctx, [[-5, by - 15], [9, by - 15]], '#facc15', 2.4);   // 금고아
}

// ---------- 종류별 모양 ----------
const MOUNT_BASE = { len: 74, bh: 28, leg: 34, legW: 6, gait: 10, saddle: '#991b1b', ear: 'pointy', tail: 'long', tailW: 5 };
export const CREATURES = {
  // 애완동물
  crane: { type: 'bird', len: 24, bh: 14, leg: 18, col: '#f8fafc', wing: '#e5e7eb', tail: '#111827', tail2: '#1f2937', tailLen: 12, neck: 16, neckW: 3.6, headR: 4.6, crown: '#dc2626', beak: 9, beakCol: '#a16207', legCol: '#334155' },
  fox: { type: 'quad', len: 30, bh: 12, leg: 11, legW: 3.4, col: '#f97316', belly: '#fff7ed', ear: 'pointy', tail: 'nine', tailLen: 20, neck: [8, -1.0], head: [12, 8], muzzle: '#fff7ed', gait: 12, eye: '#7c2d12' },
  qilin: { type: 'quad', len: 34, bh: 14, leg: 15, legW: 3.6, col: '#a3e635', belly: '#fef9c3', ear: 'pointy', horn: 'one', hornCol: '#fde047', mane: '#f97316', tail: 'flame', scales: '#4d7c0f', neck: [12, -1.1], head: [12, 8], gait: 11, hoof: '#78350f' },
  turtle: { type: 'turtle', len: 32, bh: 15, leg: 6, shell: '#3f6212', skin: '#84cc16' },
  haetae: { type: 'quad', len: 34, bh: 15, leg: 12, legW: 4.4, col: '#5eead4', belly: '#ccfbf1', ear: 'round', horn: 'one', hornCol: '#fde047', fur: '#0f766e', tail: 'brush', mane: '#0f766e', neck: [6, -0.9], head: [13, 10], bell: true, gait: 10 },
  phoenix: { type: 'bird', fly: 22, len: 24, bh: 14, leg: 0, col: '#dc2626', wing: '#f97316', tail: '#facc15', tail2: '#ef4444', tailLen: 26, plumes: 5, neck: 9, neckW: 4, headR: 5, crown: '#facc15', beak: 6, beakCol: '#fbbf24', flame: true },
  monkey: { type: 'monkey', col: '#92400e', belly: '#fcd34d', face: '#fde68a' },
  dragon: { type: 'dragon', len: 52, thick: 6.5, lift: 30, amp: 6, col: '#0ea5e9', belly: '#fde68a', fin: '#0369a1', horn: '#e0f2fe', whisker: '#e0f2fe', pearl: true },
  tiger: { type: 'quad', len: 36, bh: 14, leg: 13, legW: 4.4, col: '#f8fafc', belly: '#ffffff', stripes: '#111827', ear: 'round', tail: 'tiger', tailLen: 20, tailW: 3.6, neck: [6, -0.8], head: [13, 10], whisker: true, gait: 11, eye: '#0ea5e9' },
  yellow: { type: 'dragon', len: 60, thick: 7.5, lift: 34, amp: 7, col: '#facc15', belly: '#fff7ed', fin: '#b45309', horn: '#fef3c7', whisker: '#fff7ed', pearl: true },
  // 탈것
  donkey: { ...MOUNT_BASE, len: 62, bh: 24, leg: 28, col: '#9ca3af', belly: '#e5e7eb', ear: 'long', mane: '#4b5563', tail: 'tuft', neck: [20, -0.75], head: [24, 13], muzzle: '#e5e7eb', saddle: '#7c2d12' },
  mule: { ...MOUNT_BASE, len: 66, bh: 25, leg: 30, col: '#92400e', belly: '#d6a46b', ear: 'long', mane: '#451a03', tail: 'tuft', neck: [21, -0.8], head: [24, 13], muzzle: '#d6a46b', saddle: '#1e3a8a' },
  horse: { ...MOUNT_BASE, len: 64, bh: 25, leg: 30, col: '#b45309', belly: '#fcd34d', mane: '#fef3c7', neck: [22, -0.95], head: [22, 12], saddle: '#166534' },
  camel: { ...MOUNT_BASE, len: 76, bh: 26, leg: 40, col: '#d6a46b', belly: '#f5deb3', hump: true, ear: 'round', tail: 'tuft', neck: [34, -0.55], neckW: 10, head: [22, 12], saddle: '#991b1b', gait: 7 },
  deer: { ...MOUNT_BASE, len: 68, bh: 25, leg: 36, col: '#a16207', belly: '#fef3c7', spots: '#fef3c7', horn: 'antler', tail: 'tuft', mane: null, neck: [24, -1.0], head: [22, 12], saddle: '#1e40af' },
  warhorse: { ...MOUNT_BASE, len: 76, bh: 29, leg: 36, col: '#1f2937', belly: '#374151', mane: '#b91c1c', neck: [26, -1.0], head: [26, 14], saddle: '#7f1d1d', hoof: '#000', eye: '#ef4444' },
  white: { ...MOUNT_BASE, len: 76, bh: 29, leg: 36, col: '#f8fafc', belly: '#e2e8f0', mane: '#94a3b8', neck: [26, -1.0], head: [26, 14], saddle: '#1d4ed8', hoof: '#64748b' },
  tigerm: { ...MOUNT_BASE, len: 82, bh: 30, leg: 30, legW: 7, col: '#f59e0b', belly: '#fef3c7', stripes: '#111827', ear: 'round', tail: 'tiger', tailLen: 40, neck: [12, -0.7], neckW: 22, head: [28, 22], whisker: true, gait: 9, saddle: '#7f1d1d', hoof: '#78350f' },
  redhare: { ...MOUNT_BASE, len: 80, bh: 30, leg: 38, col: '#b91c1c', belly: '#ef4444', mane: '#1c1917', neck: [28, -1.05], head: [27, 14], saddle: '#111827', hoof: '#1c1917', gait: 12 },
  ochu: { ...MOUNT_BASE, len: 80, bh: 30, leg: 38, col: '#111827', belly: '#1f2937', mane: '#111827', spots: '#e5e7eb', neck: [28, -1.05], head: [27, 14], saddle: '#b45309', hoof: '#f8fafc', gait: 12 },
  cloud: { ...MOUNT_BASE, len: 80, bh: 30, leg: 38, col: '#f8fafc', belly: '#e0f2fe', mane: '#7dd3fc', horn: 'one', hornCol: '#fde047', clouds: true, tail: 'flame', neck: [28, -1.05], head: [27, 14], saddle: '#0369a1', hoof: '#bae6fd', gait: 13 },
  azure: { type: 'dragon', len: 120, thick: 13, lift: 30, amp: 8, col: '#0ea5e9', belly: '#fde68a', fin: '#0369a1', horn: '#e0f2fe', whisker: '#e0f2fe', pearl: true, mount: true },
};
for (const k of ['donkey', 'mule', 'horse', 'camel', 'deer', 'warhorse', 'white', 'tigerm', 'redhare', 'ochu', 'cloud']) CREATURES[k].type = 'quad';

// 탈것 위에 앉은 무인의 '발' 높이(발밑 기준, 위로 음수). 무인 그림은 발에서 엉덩이까지 20쯤이라
// 발을 등보다 그만큼 아래(몸통 안)에 두면 엉덩이가 안장에 얹히고 다리는 몸통에 가려진다.
export function saddleY(kind, t = 0, moving = false) {
  const s = CREATURES[kind];
  if (!s) return 0;
  if (s.type === 'dragon') return -(s.lift + Math.sin(t * 2) * 3) + s.thick * 0.9;
  const { top } = quadParts(s, t, moving);
  return top + 20;
}

// 그린다. layer: 'all' | 'back' | 'front' (탈것을 무인 앞뒤로 나눠 그릴 때)
export function drawCreature(ctx, kind, x, y, { t = 0, moving = false, flip = false, scale = 1, layer = 'all', alpha = 1 } = {}) {
  const s = CREATURES[kind];
  if (!s) return;
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  if (flip) ctx.scale(-1, 1);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  // 발밑 그림자 (뒤 겹에서만)
  if (layer !== 'front' && s.type !== 'dragon' && !s.fly) blob(ctx, 0, 0, (s.len || 24) * 0.5, 4, 'rgba(0,0,0,0.22)', 0, 0);
  if (layer !== 'front' && s.type === 'dragon') blob(ctx, 0, 0, s.len * 0.35, 4, 'rgba(0,0,0,0.18)', 0, 0);
  switch (s.type) {
    case 'quad': drawQuad(ctx, s, t, moving, layer); break;
    case 'dragon': drawDragon(ctx, s, t, moving, layer); break;
    case 'bird': if (layer !== 'front') drawBird(ctx, s, t, moving); break;
    case 'turtle': if (layer !== 'front') drawTurtle(ctx, s, t, moving); break;
    case 'monkey': if (layer !== 'front') drawMonkey(ctx, s, t, moving); break;
    default:
  }
  ctx.restore();
}
