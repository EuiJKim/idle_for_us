// 사냥터 지형 그림 (v127) — 나무·바위·물·기둥 … 칸 하나를 막는 것들. 생김새 목록은 js/world/wland.js OBSTACLES.
// (x, y): 칸 가운데 땅(화면 좌표). 칸 하나는 화면에서 가로 64 · 세로 64×납작(0.62)쯤이다.
// 물·용암(낮은 것)은 바닥에 납작하게 먼저 깔고, 나머지는 사람과 함께 앞뒤(y) 순서로 그린다.
const INK = '#1a1410';
function blob(ctx, x, y, rx, ry, fill, line = 2) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.fillStyle = fill; ctx.fill();
}
function poly(ctx, pts, fill, line = 2) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.lineJoin = 'round'; ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}
function line(ctx, pts, color, w) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
}
const shadow = (ctx, x, y, rx) => { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y + 2, rx, rx * 0.32, 0, 0, Math.PI * 2); ctx.fill(); };

// 바닥에 까는 것 (물·용암) — 이웃 칸과 이어 보이게 조금 넘쳐 칠한다
export function drawLowObstacle(ctx, kind, x, y, t, seed, sq) {
  const w = 68, h = 64 * sq + 4;
  const lava = kind === 'lava';
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, lava ? '#7c2d12' : '#1e3a5f');
  g.addColorStop(1, lava ? '#ea580c' : '#3b82a6');
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  // 물결·용암 거품
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 3; i++) {
    const ph = (t * (lava ? 0.6 : 1.1) + seed * 3 + i * 0.37) % 1;
    const yy = y - h / 2 + 6 + ((i * 0.33 + seed) % 1) * (h - 12);
    if (lava) blob(ctx, x - 22 + ((seed * 97 + i * 31) % 44), yy, 3 + ph * 4, 2 + ph * 2, i % 2 ? '#fde047' : '#fb923c', 0);
    else line(ctx, [[x - 26 + ph * 18, yy], [x - 14 + ph * 18, yy - 2], [x - 2 + ph * 18, yy]], 'rgba(224,242,254,0.9)', 1.6);
  }
  ctx.globalAlpha = 1;
}

export function drawObstacle(ctx, kind, x, y, t, seed) {
  const sway = Math.sin(t * 1.3 + seed * 6) * 1.5;
  switch (kind) {
    case 'tree':
    case 'peach': {
      shadow(ctx, x, y, 26);
      poly(ctx, [[x - 5, y], [x - 4, y - 34], [x + 4, y - 34], [x + 5, y]], '#5b3a1a');
      const leaf = kind === 'peach' ? ['#f9a8d4', '#f472b6', '#fbcfe8'] : ['#3f6212', '#4d7c0f', '#65a30d'];
      blob(ctx, x - 14 + sway, y - 44, 18, 15, leaf[0]);
      blob(ctx, x + 14 + sway, y - 46, 17, 14, leaf[1]);
      blob(ctx, x + sway, y - 60, 20, 16, leaf[2]);
      if (kind === 'peach') for (let i = 0; i < 3; i++) {
        const ph = (t * 0.35 + seed + i / 3) % 1;
        blob(ctx, x - 20 + i * 18 + Math.sin(ph * 6) * 6, y - 50 + ph * 52, 2.4, 1.6, '#fce7f3', 0);
      }
      break;
    }
    case 'pine': {
      shadow(ctx, x, y, 22);
      poly(ctx, [[x - 4, y], [x - 4, y - 18], [x + 4, y - 18], [x + 4, y]], '#4a2f1a');
      for (let i = 0; i < 3; i++) {
        const yy = y - 16 - i * 22, w = 26 - i * 6;
        poly(ctx, [[x - w + sway * 0.3, yy], [x + sway * 0.5, yy - 30], [x + w + sway * 0.3, yy]], '#14532d');
        poly(ctx, [[x - w * 0.55 + sway * 0.4, yy - 13], [x + sway * 0.5, yy - 30], [x + w * 0.55 + sway * 0.4, yy - 13]], '#f1f5f9', 1.2);
      }
      break;
    }
    case 'bamboo': {
      shadow(ctx, x, y, 22);
      for (let i = -1; i <= 1; i++) {
        const bx = x + i * 10 + (seed - 0.5) * 6, top = y - 92 - Math.abs(i) * -14;
        const tip = bx + sway * (1 + i * 0.3);
        line(ctx, [[bx, y], [tip, top]], INK, 7);
        line(ctx, [[bx, y], [tip, top]], i ? '#65a30d' : '#4d7c0f', 4.5);
        for (let k = 1; k < 4; k++) { const yy = y - k * 24; line(ctx, [[bx - 3, yy], [bx + 3 + sway * k * 0.2, yy]], '#365314', 1.6); }
        poly(ctx, [[tip, top + 10], [tip + 16, top + 2], [tip + 4, top + 16]], '#84cc16', 1.2);
        poly(ctx, [[tip, top + 22], [tip - 16, top + 16], [tip - 3, top + 28]], '#65a30d', 1.2);
      }
      break;
    }
    case 'rock': {
      shadow(ctx, x, y, 28);
      const k = 0.85 + seed * 0.3;
      poly(ctx, [[x - 26 * k, y], [x - 22 * k, y - 22 * k], [x - 6 * k, y - 34 * k], [x + 16 * k, y - 28 * k], [x + 27 * k, y - 8 * k], [x + 22 * k, y]], '#78716c', 2.4);
      poly(ctx, [[x - 18 * k, y - 20 * k], [x - 6 * k, y - 30 * k], [x + 8 * k, y - 26 * k], [x - 4 * k, y - 18 * k]], '#a8a29e', 0);
      line(ctx, [[x + 2 * k, y - 16 * k], [x + 10 * k, y - 6 * k]], 'rgba(26,20,16,0.5)', 1.4);
      break;
    }
    case 'ice': {
      shadow(ctx, x, y, 24);
      poly(ctx, [[x - 20, y], [x - 14, y - 34], [x - 6, y - 4]], '#bae6fd', 2);
      poly(ctx, [[x - 8, y], [x + 2, y - 54], [x + 12, y]], '#e0f2fe', 2);
      poly(ctx, [[x + 6, y], [x + 18, y - 30], [x + 24, y]], '#7dd3fc', 2);
      line(ctx, [[x + 1, y - 46], [x + 3, y - 12]], 'rgba(255,255,255,0.8)', 1.6);
      break;
    }
    case 'tomb': {
      shadow(ctx, x, y, 24);
      blob(ctx, x, y - 2, 22, 8, '#3f3a33', 1.6);
      ctx.beginPath(); ctx.moveTo(x - 13, y - 4); ctx.lineTo(x - 13, y - 34); ctx.arc(x, y - 34, 13, Math.PI, 0); ctx.lineTo(x + 13, y - 4); ctx.closePath();
      ctx.fillStyle = '#9ca3af'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
      line(ctx, [[x, y - 38], [x, y - 14]], 'rgba(26,20,16,0.55)', 1.6);
      line(ctx, [[x - 5, y - 30], [x + 5, y - 30]], 'rgba(26,20,16,0.55)', 1.6);
      break;
    }
    case 'pillar': {
      shadow(ctx, x, y, 20);
      poly(ctx, [[x - 15, y], [x - 15, y - 8], [x + 15, y - 8], [x + 15, y]], '#a8a29e');
      poly(ctx, [[x - 9, y - 8], [x - 9, y - 96], [x + 9, y - 96], [x + 9, y - 8]], '#b91c1c');
      line(ctx, [[x - 4, y - 14], [x - 4, y - 90]], 'rgba(255,255,255,0.22)', 3);
      for (const yy of [y - 30, y - 80]) line(ctx, [[x - 9, yy], [x + 9, yy]], '#fbbf24', 3);
      poly(ctx, [[x - 15, y - 96], [x - 15, y - 104], [x + 15, y - 104], [x + 15, y - 96]], '#57534e');
      break;
    }
    case 'brazier': {
      shadow(ctx, x, y, 18);
      line(ctx, [[x - 12, y], [x - 6, y - 26]], INK, 3); line(ctx, [[x + 12, y], [x + 6, y - 26]], INK, 3); line(ctx, [[x, y], [x, y - 26]], INK, 3);
      poly(ctx, [[x - 16, y - 26], [x + 16, y - 26], [x + 10, y - 38], [x - 10, y - 38]], '#44403c');
      const f = Math.sin(t * 12 + seed * 9);
      ctx.globalCompositeOperation = 'lighter';
      blob(ctx, x, y - 48 - f * 2, 9, 13 + f * 2, 'rgba(249,115,22,0.85)', 0);
      blob(ctx, x, y - 44, 5, 8, 'rgba(253,224,71,0.9)', 0);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'stall': {
      shadow(ctx, x, y, 30);
      line(ctx, [[x - 24, y], [x - 24, y - 56]], INK, 3); line(ctx, [[x + 24, y], [x + 24, y - 56]], INK, 3);
      poly(ctx, [[x - 28, y - 12], [x + 28, y - 12], [x + 28, y - 26], [x - 28, y - 26]], '#92400e');
      for (let i = 0; i < 3; i++) blob(ctx, x - 14 + i * 14, y - 30, 5, 4, ['#f97316', '#facc15', '#ef4444'][i], 1);
      for (let i = 0; i < 4; i++) poly(ctx, [[x - 32 + i * 16, y - 54], [x - 16 + i * 16, y - 54], [x - 18 + i * 16, y - 66], [x - 30 + i * 16, y - 66]], i % 2 ? '#fef3c7' : '#b91c1c', 1.4);
      break;
    }
    case 'cliff': {
      shadow(ctx, x, y, 32);
      poly(ctx, [[x - 33, y], [x - 30, y - 44], [x - 18, y - 70], [x - 2, y - 58], [x + 12, y - 78], [x + 28, y - 50], [x + 33, y]], '#57534e', 2.4);
      poly(ctx, [[x - 22, y - 48], [x - 16, y - 66], [x - 4, y - 54]], '#a8a29e', 0);
      line(ctx, [[x - 8, y - 40], [x + 4, y - 22], [x - 2, y - 8]], 'rgba(26,20,16,0.5)', 1.6);
      line(ctx, [[x + 14, y - 60], [x + 20, y - 30]], 'rgba(26,20,16,0.45)', 1.6);
      break;
    }
    case 'crystal': {
      const fy = y - 34 + Math.sin(t * 2 + seed * 6) * 4;
      shadow(ctx, x, y, 16);
      ctx.globalCompositeOperation = 'lighter';
      blob(ctx, x, fy, 26, 26, 'rgba(129,140,248,0.18)', 0);
      ctx.globalCompositeOperation = 'source-over';
      poly(ctx, [[x, fy - 30], [x + 13, fy], [x, fy + 22], [x - 13, fy]], '#818cf8', 2);
      poly(ctx, [[x, fy - 30], [x + 5, fy], [x, fy + 22], [x - 4, fy]], '#c7d2fe', 0);
      break;
    }
    case 'cactus': {
      shadow(ctx, x, y, 16);
      const c = '#4d7c0f';
      line(ctx, [[x, y], [x, y - 58]], INK, 13); line(ctx, [[x, y], [x, y - 58]], c, 10);
      line(ctx, [[x, y - 26], [x - 14, y - 30], [x - 14, y - 44]], INK, 9); line(ctx, [[x, y - 26], [x - 14, y - 30], [x - 14, y - 44]], c, 6);
      line(ctx, [[x, y - 36], [x + 13, y - 38], [x + 13, y - 50]], INK, 9); line(ctx, [[x, y - 36], [x + 13, y - 38], [x + 13, y - 50]], c, 6);
      blob(ctx, x, y - 60, 3, 3, '#f472b6', 1);
      break;
    }
    case 'coral': {
      shadow(ctx, x, y, 22);
      for (const [dx, h, col] of [[-12, 34, '#fb7185'], [0, 46, '#f472b6'], [12, 30, '#fda4af']]) {
        line(ctx, [[x + dx, y], [x + dx + sway, y - h]], INK, 7);
        line(ctx, [[x + dx, y], [x + dx + sway, y - h]], col, 4.5);
        line(ctx, [[x + dx + sway * 0.5, y - h * 0.55], [x + dx + 8 + sway, y - h * 0.8]], col, 3);
      }
      break;
    }
    default:
  }
}
