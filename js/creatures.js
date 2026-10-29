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
  // 눈 (판다는 눈두덩이 검다)
  if (s.patch) blob(ctx, hx + hl * 0.28, hy - hh * 0.05, 3.4, 2.8, s.patch, -0.4, 0);
  blob(ctx, hx + hl * 0.28, hy - hh * 0.08, 1.7, 1.9, s.eye || '#111', 0, 0);
  // 엄니 (멧돼지)
  if (s.tusk) stroke(ctx, [[hx + hl * 0.7, hy + hh * 0.55], [hx + hl * 0.82, hy + hh * 0.05], [hx + hl * 0.72, hy - hh * 0.15]], '#fef3c7', 2.2);
  if (s.earCol) { /* 귀 빛이 다른 짐승 — 위에서 몸빛으로 그렸으니 덧칠 */ blob(ctx, hx - 2, hy - hh * 0.75, 2.6, 2.6, s.earCol, 0, 0); blob(ctx, hx + 3, hy - hh * 0.8, 2.2, 2.2, s.earCol, 0, 0); }
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
      if (i % 2 && s.fin) poly(ctx, [[x - r * 0.5, y - r * 0.75], [x - r * 0.15, y - r * 1.55], [x + r * 0.35, y - r * 0.75]], s.fin, 1.2);
      if (s.bands && i % 2 === 0) blob(ctx, x, y - r * 0.2, r * 0.35, r * 0.75, s.bands, 0, 0);
      blob(ctx, x, y + r * 0.35, r * 0.65, r * 0.4, s.belly, 0, 0);
    }
  };
  const mid = Math.floor(n * 0.5);
  if (layer !== 'front') {
    // 꼬리 끝 지느러미
    const [tx, ty] = pts[0];
    if (s.fin) poly(ctx, [[tx, ty], [tx - 12, ty - 8 + Math.sin(t * 5) * 3], [tx - 9, ty + 6]], s.fin, 1.5);
    drawBodyRange(0, mid);
    // 앞뒤 발톱
    if (!s.snake) for (const i of [3, 7]) { const [x, y, r] = pts[i]; stroke(ctx, [[x, y + r * 0.6], [x + 4, y + r * 1.4 + Math.sin(t * 6 + i) * 2]], INK, 3.2); stroke(ctx, [[x, y + r * 0.6], [x + 4, y + r * 1.4 + Math.sin(t * 6 + i) * 2]], s.col, 1.8); }
  }
  if (layer !== 'back') {
    drawBodyRange(layer === 'front' ? mid : mid, n - 1);
    // 머리
    const [hx, hy] = pts[n - 1];
    const r = s.thick * 1.15;
    if (s.horn) {
      stroke(ctx, [[hx - 2, hy - r * 0.6], [hx - 10, hy - r * 1.8]], s.horn, 2.6);
      stroke(ctx, [[hx + 2, hy - r * 0.6], [hx - 4, hy - r * 1.9]], s.horn, 2.6);
    }
    // 뱀: 날름거리는 혀
    if (s.snake && Math.sin(t * 5) > 0.2) stroke(ctx, [[hx + r * 1.4, hy + r * 0.2], [hx + r * 2.4, hy + r * 0.2], [hx + r * 2.8, hy - r * 0.1]], '#dc2626', 1.4);
    blob(ctx, hx, hy, r, r * 0.85, s.col, 0.1);
    blob(ctx, hx + r * 0.9, hy + r * 0.2, r * 0.7, r * 0.45, s.belly, 0.15, 1.6);
    blob(ctx, hx + r * 0.1, hy - r * 0.25, 1.9, 2.1, s.eye || '#fde047', 0, 1);
    // 수염 — 물결친다
    const wv = Math.sin(t * 4) * 3;
    if (s.whisker) stroke(ctx, [[hx + r * 1.2, hy + r * 0.3], [hx + r * 2, hy + r * 0.1 + wv], [hx + r * 2.6, hy + r * 0.6 - wv]], s.whisker, 1.4);
    if (s.whisker) stroke(ctx, [[hx + r * 1.1, hy + r * 0.5], [hx + r * 1.8, hy + r * 1 - wv], [hx + r * 2.3, hy + r * 1.4 + wv]], s.whisker, 1.4);
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
  // 여의봉 (손오공만)
  const sa = -0.9 + Math.sin(t * (moving ? 6 : 1.5)) * 0.15;
  if (s.staff !== false) {
    stroke(ctx, [[8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16], [8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16]], INK, 5);
    stroke(ctx, [[8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16], [8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16]], '#b91c1c', 3);
    blob(ctx, 8 + Math.cos(sa) * 16, by + Math.sin(sa) * 16, 2.4, 2.4, '#facc15', 0, 1);
    blob(ctx, 8 - Math.cos(sa) * 16, by - Math.sin(sa) * 16, 2.4, 2.4, '#facc15', 0, 1);
  } else {
    // 맨손 — 팔을 휘두른다
    const sw = Math.sin(t * (moving ? 9 : 2)) * 0.5;
    stroke(ctx, [[3, by - 2], [12 + sw * 4, by + 6]], INK, 6); stroke(ctx, [[3, by - 2], [12 + sw * 4, by + 6]], s.col, 4);
  }
  // 몸·머리
  blob(ctx, 0, by + 2, 8, 9, s.col);
  blob(ctx, 1, by + 4, 5, 6, s.belly, 0, 0);
  blob(ctx, 2, by - 11, 8, 7.5, s.col);
  blob(ctx, 4, by - 10, 5.5, 5, s.face, 0, 1.2);
  blob(ctx, -5, by - 11, 2.6, 3, s.face, 0, 1.2);
  blob(ctx, 5.5, by - 11.5, 1.2, 1.4, '#111', 0, 0);
  if (s.band !== false) stroke(ctx, [[-5, by - 15], [9, by - 15]], '#facc15', 2.4);   // 금고아
  if (s.eye) { blob(ctx, 5.5, by - 11.5, 1.4, 1.6, s.eye, 0, 0); }
}

// ---------- 벌레 (거미·전갈) — 다리 여덟이 번갈아 움직인다 ----------
function drawBug(ctx, s, t, moving) {
  const p = moving ? t * 14 : t * 2;
  const by = -s.leg * 0.8 + (moving ? Math.sin(p * 2) * 0.8 : 0);
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const ph = Math.sin(p + i * 1.3 + (side > 0 ? Math.PI : 0)) * (moving ? 0.35 : 0.08);
      const bx = -s.len * 0.15 + i * s.len * 0.12;
      const kx = bx + (i - 1.5) * s.len * 0.18 + ph * 6, ky = by - s.leg * 0.9 * (side > 0 ? 1 : 0.85);
      const fx = bx + (i - 1.5) * s.len * 0.32 + ph * 9, fy = -1;
      stroke(ctx, [[bx, by], [kx, ky], [fx, fy]], INK, 3.4);
      stroke(ctx, [[bx, by], [kx, ky], [fx, fy]], side > 0 ? s.col : shade(s.col, -0.3), 1.8);
    }
  }
  if (s.tail) {
    // 전갈 꼬리 — 등 위로 말려 올라가 독침이 앞을 향한다
    const sw = Math.sin(t * 3) * 3;
    ctx.beginPath(); ctx.moveTo(-s.len * 0.4, by);
    ctx.bezierCurveTo(-s.len * 0.9, by - 6, -s.len * 0.7, by - s.len * 0.75 + sw, -s.len * 0.15, by - s.len * 0.7 + sw);
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = s.col; ctx.lineWidth = 4.6; ctx.stroke();
    poly(ctx, [[-s.len * 0.15, by - s.len * 0.75 + sw], [-s.len * 0.02, by - s.len * 0.62 + sw], [-s.len * 0.18, by - s.len * 0.62 + sw]], s.sting || '#fde047', 1.2);
  }
  // 집게 (전갈·게)
  if (s.tail || s.claws) for (const k of [-1, 1]) { const cx = s.len * 0.55, cy = by + k * 2; stroke(ctx, [[s.len * 0.3, by], [cx, cy - 3]], INK, 4.4); stroke(ctx, [[s.len * 0.3, by], [cx, cy - 3]], s.col, 2.6); blob(ctx, cx + 3, cy - 4, 4, 2.6, s.col, 0.3 * k, 1.4); }
  blob(ctx, -s.len * 0.18, by - 1, s.len * 0.32, s.bh * 0.55, s.col);           // 배
  if (s.mark) blob(ctx, -s.len * 0.2, by - 2, s.len * 0.12, s.bh * 0.22, s.mark, 0, 0);
  blob(ctx, s.len * 0.2, by, s.len * 0.18, s.bh * 0.4, shade(s.col, -0.15));   // 머리가슴
  for (const k of [-1, 1]) blob(ctx, s.len * 0.3, by - 2 + k * 1.5, 1.2, 1.2, s.eye || '#ef4444', 0, 0);
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
// 십이지 신수 탈것 (v126) — 무한의 탑 십이지 뽑기. 탑의 10층 수문장(십이지신)도 이 모습으로 크게 나선다.
const Q = (o) => ({ ...MOUNT_BASE, type: 'quad', ...o });
Object.assign(CREATURES, {
  z1: Q({ len: 70, bh: 26, leg: 22, col: '#eab308', belly: '#fef3c7', ear: 'round', tail: 'long', tailLen: 46, tailW: 3, mane: null, neck: [14, -0.6], neckW: 16, head: [26, 14], muzzle: '#fde68a', whisker: true, eye: '#7f1d1d', saddle: '#7f1d1d', gait: 13 }),
  z2: Q({ len: 86, bh: 34, leg: 30, legW: 9, col: '#292524', belly: '#57534e', horn: 'two', hornCol: '#e7e5e4', ear: 'round', tail: 'tuft', mane: null, neck: [10, -0.5], neckW: 24, head: [26, 18], muzzle: '#a8a29e', eye: '#ef4444', saddle: '#b45309', hoof: '#111', gait: 7 }),
  z3: { ...CREATURES.tigerm, col: '#f8fafc', belly: '#ffffff', stripes: '#1e293b', eye: '#38bdf8', saddle: '#0369a1' },
  z4: Q({ len: 66, bh: 30, leg: 26, col: '#f8fafc', belly: '#ffffff', ear: 'long', earCol: '#fda4af', tail: 'tuft', mane: null, clouds: true, neck: [12, -0.9], neckW: 16, head: [22, 14], muzzle: '#fce7f3', eye: '#e11d48', saddle: '#7c3aed', gait: 13 }),
  z5: { type: 'dragon', len: 130, thick: 14, lift: 32, amp: 8, col: '#facc15', belly: '#fff7ed', fin: '#b45309', horn: '#fef3c7', whisker: '#fff7ed', pearl: true, mount: true },
  z6: { type: 'dragon', snake: true, len: 120, thick: 11, lift: 18, amp: 7, col: '#0d9488', belly: '#ccfbf1', bands: '#134e4a', mount: true },
  z7: Q({ len: 82, bh: 30, leg: 40, col: '#fef9c3', belly: '#fffbeb', mane: '#fb923c', tail: 'flame', clouds: true, horn: 'one', hornCol: '#fde047', neck: [28, -1.05], head: [27, 14], saddle: '#b91c1c', hoof: '#fbbf24', gait: 12 }),
  z8: Q({ len: 74, bh: 32, leg: 28, col: '#f5f5f4', belly: '#ffffff', fur: '#e7e5e4', horn: 'two', hornCol: '#a16207', ear: 'round', tail: 'tuft', clouds: true, neck: [12, -0.7], neckW: 18, head: [22, 14], muzzle: '#d6d3d1', saddle: '#0e7490', gait: 8 }),
  z9: Q({ len: 76, bh: 32, leg: 30, legW: 9, col: '#b45309', belly: '#fcd34d', fur: '#f59e0b', ear: 'round', tail: 'long', tailLen: 40, mane: null, neck: [10, -0.6], neckW: 22, head: [22, 18], muzzle: '#fde68a', eye: '#facc15', saddle: '#b91c1c', gait: 9 }),
  z10: { type: 'bird', len: 64, bh: 34, leg: 30, col: '#f97316', wing: '#facc15', tail: '#16a34a', tail2: '#dc2626', tailLen: 38, plumes: 5, neck: 22, neckW: 11, headR: 9, crown: '#dc2626', beak: 9, beakCol: '#fbbf24', legCol: '#a16207' },
  z11: Q({ len: 76, bh: 28, leg: 32, col: '#e0e7ff', belly: '#ffffff', ear: 'pointy', tail: 'brush', tailLen: 30, mane: '#a5b4fc', neck: [16, -0.8], neckW: 16, head: [24, 14], muzzle: '#eef2ff', eye: '#4338ca', clouds: true, saddle: '#4338ca', gait: 12 }),
  z12: Q({ len: 88, bh: 36, leg: 26, legW: 9, col: '#1c1917', belly: '#44403c', mane: '#7f1d1d', ear: 'pointy', tusk: true, tail: 'tuft', neck: [8, -0.4], neckW: 26, head: [26, 18], muzzle: '#57534e', eye: '#ef4444', saddle: '#7f1d1d', hoof: '#000', gait: 8 }),
});

// 들짐승 몹 (v117) — 몹 자리에서 크게(몹 정의의 bscale) 그린다
const WOLF = { type: 'quad', len: 34, bh: 12, leg: 13, legW: 3.4, ear: 'pointy', tail: 'brush', tailLen: 15, neck: [7, -0.7], head: [13, 8], gait: 12 };
const BEAR = { type: 'quad', len: 40, bh: 20, leg: 11, legW: 6, ear: 'round', tail: 'tuft', tailLen: 6, neck: [4, -0.5], neckW: 14, head: [14, 12], gait: 7 };
const CAT = { type: 'quad', len: 36, bh: 13, leg: 13, legW: 4.2, ear: 'round', tail: 'tiger', tailLen: 20, tailW: 3.4, neck: [6, -0.8], head: [13, 10], whisker: true, gait: 11 };
const SNAKE = { type: 'dragon', snake: true, len: 54, thick: 5.4, lift: 4, amp: 5 };
const BIRD = { type: 'bird', len: 22, bh: 12, leg: 12, plumes: 3, tailLen: 12, neck: 7, neckW: 4, headR: 4.4, beak: 5, legCol: '#44403c' };
const BUG = { type: 'bug', len: 30, bh: 14, leg: 12 };
Object.assign(CREATURES, {
  wolf: { ...WOLF, col: '#6b7280', belly: '#d1d5db', mane: '#4b5563', muzzle: '#d1d5db', eye: '#facc15' },
  swolf: { ...WOLF, col: '#e5e7eb', belly: '#ffffff', mane: '#94a3b8', muzzle: '#f8fafc', eye: '#0ea5e9' },
  rwolf: { ...WOLF, col: '#7f1d1d', belly: '#fca5a5', mane: '#450a0a', muzzle: '#fecaca', eye: '#fde047' },
  bwolf: { ...WOLF, col: '#18181b', belly: '#3f3f46', mane: '#000000', muzzle: '#27272a', eye: '#a855f7' },
  fwolf: { ...WOLF, col: '#1e3a8a', belly: '#93c5fd', mane: '#0c4a6e', muzzle: '#bfdbfe', eye: '#67e8f9', tail: 'flame' },
  jackal: { ...WOLF, len: 30, col: '#d6a46b', belly: '#fef3c7', mane: '#a16207', muzzle: '#fef3c7', ear: 'long', tail: 'tuft' },
  boar: { type: 'quad', len: 34, bh: 16, leg: 9, legW: 4.4, col: '#57534e', belly: '#78716c', ear: 'pointy', tail: 'tuft', tailLen: 7, mane: '#292524', neck: [3, -0.3], neckW: 12, head: [13, 10], muzzle: '#a8a29e', tusk: true, gait: 13, eye: '#dc2626' },
  bear: { ...BEAR, col: '#3f2a1a', belly: '#6b4f3a', muzzle: '#a16207' },
  panda: { ...BEAR, col: '#f8fafc', belly: '#ffffff', muzzle: '#ffffff', patch: '#111111', earCol: '#111111', hoof: '#111111' },
  ibear: { ...BEAR, col: '#475569', belly: '#94a3b8', muzzle: '#cbd5e1', eye: '#f97316', scales: '#1e293b' },
  sbear: { ...BEAR, col: '#f1f5f9', belly: '#ffffff', muzzle: '#e2e8f0', eye: '#0ea5e9' },
  mtiger: { ...CAT, col: '#f59e0b', belly: '#fef3c7', stripes: '#111827', eye: '#16a34a' },
  btiger: { ...CAT, col: '#1f2937', belly: '#374151', stripes: '#6b21a8', eye: '#c084fc' },
  leopard: { ...CAT, col: '#facc15', belly: '#fef9c3', spots: '#78350f', eye: '#16a34a' },
  sdeer: { type: 'quad', len: 34, bh: 13, leg: 17, legW: 3.2, col: '#a16207', belly: '#fef3c7', spots: '#fef3c7', horn: 'antler', ear: 'pointy', tail: 'tuft', tailLen: 5, neck: [12, -1.1], head: [12, 7], gait: 11 },
  ldeer: { type: 'quad', len: 34, bh: 13, leg: 17, legW: 3.2, col: '#fbcfe8', belly: '#fff1f2', spots: '#f472b6', horn: 'antler', hornCol: '#fde68a', ear: 'pointy', tail: 'tuft', tailLen: 5, neck: [12, -1.1], head: [12, 7], gait: 11 },
  snake: { ...SNAKE, col: '#65a30d', belly: '#ecfccb', bands: '#3f6212', eye: '#fde047' },
  rsnake: { ...SNAKE, col: '#b91c1c', belly: '#fecaca', bands: '#450a0a', eye: '#fde047' },
  python: { ...SNAKE, len: 76, thick: 7, col: '#a16207', belly: '#fef3c7', bands: '#422006', eye: '#facc15' },
  isnake: { ...SNAKE, col: '#e0f2fe', belly: '#ffffff', bands: '#7dd3fc', eye: '#0284c7' },
  eel: { ...SNAKE, len: 60, col: '#0e7490', belly: '#a5f3fc', fin: '#155e75', bands: null, eye: '#facc15', lift: 8 },
  crow: { ...BIRD, col: '#18181b', wing: '#27272a', tail: '#09090b', tail2: '#27272a', beakCol: '#3f3f46', eye: '#ef4444' },
  eagle: { ...BIRD, fly: 26, len: 28, bh: 13, col: '#78350f', wing: '#92400e', tail: '#f5f5f4', tail2: '#d6d3d1', headR: 5, beak: 6, beakCol: '#facc15', neckW: 5 },
  bat: { ...BIRD, fly: 30, len: 16, bh: 10, col: '#3b0764', wing: '#581c87', tail: '#3b0764', tail2: '#3b0764', plumes: 1, tailLen: 4, neck: 3, headR: 4, beak: 2, beakCol: '#fca5a5' },
  vbat: { ...BIRD, fly: 30, len: 18, bh: 10, col: '#450a0a', wing: '#7f1d1d', tail: '#450a0a', tail2: '#450a0a', plumes: 1, tailLen: 4, neck: 3, headR: 4, beak: 2, beakCol: '#fde047' },
  wcrane: { ...BIRD, len: 24, bh: 14, leg: 18, col: '#f8fafc', wing: '#e5e7eb', tail: '#111827', tail2: '#1f2937', neck: 16, neckW: 3.6, headR: 4.6, crown: '#dc2626', beak: 9, beakCol: '#a16207', legCol: '#334155' },
  gull: { ...BIRD, fly: 24, col: '#f1f5f9', wing: '#cbd5e1', tail: '#94a3b8', tail2: '#e2e8f0', beakCol: '#f59e0b' },
  ape: { type: 'monkey', col: '#44403c', belly: '#78716c', face: '#a8a29e', staff: false, band: false, eye: '#dc2626' },
  sape: { type: 'monkey', col: '#e5e7eb', belly: '#f8fafc', face: '#fecaca', staff: false, band: false, eye: '#0ea5e9' },
  gape: { type: 'monkey', col: '#facc15', belly: '#fef9c3', face: '#fde68a', staff: false, band: false, eye: '#b45309' },   // 보물 원숭이 (v127)
  spider: { ...BUG, col: '#27272a', mark: '#dc2626', eye: '#ef4444' },
  pspider: { ...BUG, col: '#4d7c0f', mark: '#fde047', eye: '#fde047' },
  ispider: { ...BUG, len: 34, col: '#64748b', mark: '#f97316', eye: '#f97316' },
  scorpion: { ...BUG, tail: true, col: '#a16207', sting: '#fde047', eye: '#111' },
  bscorp: { ...BUG, tail: true, col: '#18181b', sting: '#a855f7', eye: '#a855f7' },
  crab: { ...BUG, len: 30, col: '#ea580c', eye: '#111', tail: false, claws: true },
});

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
    case 'bug': if (layer !== 'front') drawBug(ctx, s, t, moving); break;
    default:
  }
  ctx.restore();
}
