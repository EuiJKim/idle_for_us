// v362 뽑기 연출 — 제단(art/ui/gacha-altar) 위로 봉인(부적·영수 구슬)이 떠오르고, 북소리가 빨라지며 흔들리다 금이 가고,
//   새어 나오는 빛 빛깔로 등급을 알린다(좋은 것은 가끔 낮은 빛에서 '승급'). 터지면 짐승이 나타난다.
//   10연차는 봉인 열을 차례로 깨고, 가장 좋은 것을 크게. 건너뛰기는 언제나 — 결과 칸만.
import * as W from './world/wdata.js';
import { drawCreature } from './creatures.js';
import { drawMountAura } from './mountfx.js';
import { sfx } from './sfx.js';
import { CR_BOX } from './crbox.js';

const GCOL = ['#60a5fa', '#c084fc', '#fb923c', 'rainbow', '#fde047'];
const GNAME = ['', '', '', '최상', '극'];
const RB = ['#f43f5e', '#fb923c', '#fde047', '#4ade80', '#38bdf8', '#a78bfa'];
const colAt = (g, t) => (GCOL[g] === 'rainbow' ? RB[Math.floor(t * 8) % RB.length] : GCOL[g]);
const imgs = {};
function img(src) { if (!imgs[src]) { const i = new Image(); i.src = src; imgs[src] = i; } return imgs[src]; }

function label(r) {
  if (r.kind === 'pet') {
    const d = W.petOf(r.id);
    return { name: d.name, sub: `${W.RARITY[r.rar].name} 애완동물 · 순위 ${d.tier}`, col: W.RARITY[r.rar].color, emoji: d.emoji };
  }
  const d = W.mountOf(r.id);
  const sub = d.hard ? '극의 신수' : d.zodiac ? '십이지 신수' : `탈것 · 순위 ${d.tier}`;
  const dup = r.dup === 'tame' ? ' · 가진 신수 — 길들이기 +1' : r.dup === 'shard' ? ` · 가진 신수 — 조각 +${W.GACHA_DUP_SHARD}` : '';
  return { name: d.name, sub: sub + dup, col: d.col || GCOL[Math.min(2, r.grade)], emoji: d.emoji };
}

// results: game.gacha()가 준 배열 · kind 'pet' | 'mount' · onDone()
export function playGacha(results, kind, onDone) {
  const ov = document.createElement('div');
  ov.id = 'gacha-ov';
  ov.innerHTML = '<canvas></canvas><div class="g-top"></div><div class="g-card hidden"><b></b><small></small></div><div class="g-grid hidden"></div><div class="g-hint">눌러서 빨리</div><button class="g-skip">건너뛰기 ▶▶</button><button class="g-ok hidden">확인</button>';
  document.body.append(ov);
  const cv = ov.querySelector('canvas'), c = cv.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W0 = 0, H0 = 0;
  const fit = () => { W0 = ov.clientWidth; H0 = ov.clientHeight; cv.width = W0 * dpr; cv.height = H0 * dpr; };
  fit();
  addEventListener('resize', fit);
  const altar = img('art/ui/gacha-altar.webp');
  const seal = img(kind === 'pet' ? 'art/ui/gacha-orb.webp' : 'art/ui/gacha-seal.webp');
  const ten = results.length > 1;
  const best = results.reduce((a, r) => (r.grade > a.grade ? r : a), results[0]);
  ov.querySelector('.g-top').textContent = ten ? `${kind === 'pet' ? '영수' : '탈것'} 소환 × ${results.length}` : `${kind === 'pet' ? '영수' : '탈것'} 소환`;
  // 단계: 각 봉인마다 { at: 시작 시각 } — 하나짜리는 길게(3.6초), 열은 빠르게 깨고 마지막에 가장 좋은 것을 길게
  let t0 = performance.now(), speed = 1, T = 0, last = performance.now(), done = false, beat = 0;
  const parts = [];
  const shake = { v: 0 };
  const fake = (r) => r.grade >= 2 && Math.random() < 0.45;   // 승급 반전(좋은 것만)
  const SEAL = 3.4;   // 하나짜리: 봉인이 깨지기까지
  const seq = ten ? results.map((r, i) => ({ r, at: i * 0.55, dur: 0.55, fake: false })) : [{ r: results[0], at: 0, dur: SEAL, fake: fake(results[0]) }];
  const finalAt = ten ? results.length * 0.55 + 0.3 : 0;
  const bigR = ten ? best : results[0];
  const bigFake = ten ? fake(best) : seq[0].fake;
  const BIG = ten ? 3.2 : 0;   // 열 다음 가장 좋은 것 크게
  const total = ten ? finalAt + BIG : SEAL + 1.2;
  const showOk = () => { ov.querySelector('.g-hint').classList.add('hidden'); ov.querySelector('.g-skip').classList.add('hidden'); ov.querySelector('.g-ok').classList.remove('hidden'); };
  const finish = () => {
    if (done) return; done = true;
    if (!ten) { showOk(); return; }   // 하나짜리는 나타난 짐승을 그대로 두고 확인만
    ov.querySelector('.g-hint').classList.add('hidden');
    ov.querySelector('.g-skip').classList.add('hidden');
    ov.querySelector('.g-card').classList.add('hidden');
    const grid = ov.querySelector('.g-grid');
    grid.classList.remove('hidden');
    grid.innerHTML = '';
    for (const r of results) {
      const L = label(r);
      const el = document.createElement('div');
      el.className = `g-res g${r.grade}`;
      el.style.setProperty('--gc', r.grade === 3 ? '#f472b6' : GCOL[r.grade]);
      const cc = document.createElement('canvas'); cc.width = 120; cc.height = 100;
      const x = cc.getContext('2d'); drawCreature(x, r.id, 60, 92, { t: 0.4, scale: r.kind === 'mount' ? 0.62 : 1.6 });
      el.append(cc);
      const b = document.createElement('b'); b.textContent = L.name; el.append(b);
      const s = document.createElement('small'); s.textContent = L.sub; el.append(s);
      grid.append(el);
    }
    ov.querySelector('.g-ok').classList.remove('hidden');
  };
  ov.querySelector('.g-skip').onclick = (e) => { e.stopPropagation(); if (ten) { T = total + 99; finish(); } else T = Math.max(T, SEAL - 0.01); };
  ov.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; if (!done) speed = 3; });
  ov.addEventListener('pointerup', () => { speed = 1; });
  ov.querySelector('.g-ok').onclick = () => { done = true; stop = true; removeEventListener('resize', fit); ov.remove(); onDone?.(); };
  let stop = false;

  const burst = (x, y, col, n, sp = 1) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (120 + Math.random() * 380) * sp; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.8 + Math.random() * 0.8, max: 1.6, col: col === 'rainbow' ? RB[i % RB.length] : col, r: 1.5 + Math.random() * 3 }); } };

  // 봉인 하나 그리기 — p: 0..1 진행, g: 등급, fk: 반전, x,y,s: 자리·크기
  function drawSeal(p, g, fk, x, y, s, t) {
    const show = fk && p < 0.72 ? Math.max(0, g - 2) : g;   // 반전: 처음엔 낮은 빛
    const rise = Math.min(1, p / 0.18);
    const shk = p > 0.25 && p < 1 ? (p - 0.25) * 22 * s / 260 : 0;
    const ox = (Math.random() - 0.5) * shk, oy = (Math.random() - 0.5) * shk;
    const glowA = p < 0.3 ? 0 : Math.min(1, (p - 0.3) / 0.35);
    const col = colAt(show, t);
    c.save();
    c.translate(x + ox, y + oy + (1 - rise) * 120);
    c.globalAlpha = rise;
    // 뒤 빛
    if (glowA > 0) {
      c.globalCompositeOperation = 'lighter';
      const R = s * (0.7 + 0.25 * Math.sin(t * 14) * glowA);
      const gr = c.createRadialGradient(0, 0, 0, 0, 0, R);
      gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00');
      c.fillStyle = gr; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
      // 빛줄기
      c.globalAlpha = glowA * 0.5;
      c.rotate(t * 0.8);
      for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.fillStyle = colAt(show, t + i * 0.05); c.beginPath(); c.moveTo(0, 0); c.lineTo(s * 1.4, -s * 0.06); c.lineTo(s * 1.4, s * 0.06); c.closePath(); c.fill(); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0); c.translate(x + ox, y + oy + (1 - rise) * 120);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = rise;
    }
    // 봉인 그림
    const im = seal.complete && seal.naturalWidth ? seal : null;
    const sw = s * 0.95, sh = im ? sw * im.naturalHeight / im.naturalWidth : sw;
    if (im) c.drawImage(im, -sw / 2, -sh / 2, sw, sh);
    else { c.fillStyle = '#b45309'; c.fillRect(-sw / 4, -sh / 2, sw / 2, sh); }
    // 금(빛이 새는 틈)
    if (p > 0.45) {
      const k = Math.min(1, (p - 0.45) / 0.35);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = col; c.lineWidth = 2 + 3 * k; c.shadowColor = col === 'rainbow' ? '#fff' : col; c.shadowBlur = 18;
      const seed = (g * 7 + 3);
      for (let j = 0; j < 4; j++) {
        c.beginPath(); let px = 0, py = 0; c.moveTo(px, py);
        for (let q = 1; q <= 5 * k; q++) { const a = (j / 4) * Math.PI * 2 + Math.sin(seed + j * 3 + q) * 0.7; px += Math.cos(a) * sw * 0.09; py += Math.sin(a) * sh * 0.09; c.lineTo(px, py); }
        c.stroke();
      }
      c.shadowBlur = 0; c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    return show;
  }
  // 짐승 등장
  function drawReveal(r, p, x, y, s, t) {
    const L = label(r);
    const e = 1 - (1 - Math.min(1, p / 0.35)) ** 3;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const col = colAt(r.grade, t);
    const gr = c.createRadialGradient(x, y, 0, x, y, s * 1.6);
    gr.addColorStop(0, col + '99'); gr.addColorStop(1, col + '00');
    c.fillStyle = gr; c.fillRect(0, 0, W0, H0);
    c.globalCompositeOperation = 'source-over';
    // 짐승 폭에 맞춰(긴 용도 화면 안에) — 그림 상자(CR_BOX)가 있으면 그 폭, 없으면 짐작
    const bw = (CR_BOX[r.id] ? CR_BOX[r.id][2] - CR_BOX[r.id][0] : r.kind === 'mount' ? 150 : 50);
    const sc = Math.min(W0 * 0.86 / bw, s * (r.kind === 'mount' ? 1.25 : 0.95) / Math.min(bw, 90)) * (0.5 + 0.5 * e);
    c.translate(x, y + s * 0.45); c.scale(sc, sc);
    if (r.kind === 'mount') drawMountAura(c, r.id, 0, 0, t, { layer: 'back' });
    c.globalAlpha = e; drawCreature(c, r.id, 0, 0, { t }); c.globalAlpha = 1;
    if (r.kind === 'mount') drawMountAura(c, r.id, 0, 0, t, { layer: 'front' });
    c.restore();
    const card = ov.querySelector('.g-card');
    card.classList.remove('hidden');
    card.style.setProperty('--gc', r.grade === 3 ? '#f472b6' : GCOL[r.grade]);
    card.querySelector('b').textContent = L.name;
    card.querySelector('small').textContent = (GNAME[r.grade] ? `★ ${GNAME[r.grade]} ★ ` : '') + L.sub;
    card.className = `g-card g${r.grade}`;
  }

  let fired = new Set();
  const frame = (now) => {
    if (stop) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!done) T += dt * speed;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W0, H0);
    // 흔들림
    shake.v *= 0.9;
    c.save();
    if (shake.v > 0.5) c.translate((Math.random() - 0.5) * shake.v, (Math.random() - 0.5) * shake.v);
    if (altar.complete && altar.naturalWidth) { const s = Math.max(W0 / altar.naturalWidth, H0 / altar.naturalHeight); const iw = altar.naturalWidth * s, ih = altar.naturalHeight * s; c.drawImage(altar, (W0 - iw) / 2, (H0 - ih) / 2, iw, ih); }
    else { c.fillStyle = '#0b0806'; c.fillRect(0, 0, W0, H0); }
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, W0, H0);
    const cx = W0 / 2, cy = H0 * 0.46, S = Math.min(W0, H0) * 0.42;
    if (!ten || !done) {
      if (!ten) {
        if (done) T += dt;   // 다 나온 뒤에도 짐승은 숨 쉰다
        const s0 = seq[0], p = Math.min(1, T / s0.dur);
        // 북소리 — 점점 빨리
        const gap = 0.5 - 0.38 * p;
        beat -= dt * speed; if (p < 0.97 && beat <= 0) { beat = gap; sfx('hit'); shake.v = Math.max(shake.v, 3 + p * 8); }
        if (p < 1) { const show = drawSeal(p, s0.r.grade, s0.fake, cx, cy, S, T); if (s0.fake && p > 0.72 && !fired.has('up')) { fired.add('up'); shake.v = 22; burst(cx, cy, GCOL[s0.r.grade], 60); sfx('level'); } void show; }
        else if (T >= s0.dur) {
          if (!fired.has('pop')) { fired.add('pop'); shake.v = s0.r.grade >= 3 ? 34 : 14; burst(cx, cy, GCOL[s0.r.grade], 40 + s0.r.grade * 40, 1 + s0.r.grade * 0.3); sfx(s0.r.grade >= 3 ? 'king' : s0.r.grade >= 2 ? 'boss' : 'loot'); }
        }
        if (T >= s0.dur) drawReveal(s0.r, (T - s0.dur) / 0.6 + 0.01, cx, cy, S, T);
        if (T >= total) finish();
      } else {
        // 열 — 다섯씩 두 줄, 차례로 깨진다
        if (T < finalAt) {
          seq.forEach((q, i) => {
            const gx = W0 * (0.14 + (i % 5) * 0.18), gy = H0 * (0.36 + Math.floor(i / 5) * 0.2), gs = Math.min(W0 * 0.16, 90);
            const p = Math.max(0, Math.min(1, (T - q.at) / q.dur));
            if (p <= 0) { drawSeal(0.05, q.r.grade, false, gx, gy, gs, T); return; }
            if (p < 0.85) drawSeal(0.3 + p * 0.6, q.r.grade, false, gx, gy, gs, T);
            else {
              if (!fired.has(i)) { fired.add(i); burst(gx, gy, GCOL[q.r.grade], 14 + q.r.grade * 16, 0.5); sfx(q.r.grade >= 2 ? 'level' : 'hit'); if (q.r.grade >= 3) shake.v = 16; }
              const L = label(q.r);
              c.save(); c.translate(gx, gy);
              const col = colAt(q.r.grade, T);
              c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(0, 0, 0, 0, 0, gs * 0.7); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, gs * 0.7, 0, Math.PI * 2); c.fill();
              c.globalCompositeOperation = 'source-over';
              c.save(); c.translate(0, gs * 0.35); const sc = q.r.kind === 'mount' ? gs / 180 : gs / 50; c.scale(sc, sc); drawCreature(c, q.r.id, 0, 0, { t: T }); c.restore();
              c.fillStyle = '#fff'; c.font = `700 ${Math.round(gs * 0.16)}px sans-serif`; c.textAlign = 'center'; c.fillText(L.name, 0, gs * 0.62);
              c.restore();
            }
          });
        } else {
          const p = Math.min(1, (T - finalAt) / BIG);
          if (p < 0.55) { drawSeal(0.25 + p * 1.1, bigR.grade, bigFake, cx, cy, S, T); const gap = 0.4 - 0.3 * p; beat -= dt * speed; if (beat <= 0) { beat = gap; sfx('hit'); shake.v = Math.max(shake.v, 5); } if (bigFake && p > 0.42 && !fired.has('up')) { fired.add('up'); shake.v = 22; burst(cx, cy, GCOL[bigR.grade], 60); sfx('level'); } }
          else { if (!fired.has('pop')) { fired.add('pop'); shake.v = bigR.grade >= 3 ? 34 : 14; burst(cx, cy, GCOL[bigR.grade], 60 + bigR.grade * 40, 1.2); sfx(bigR.grade >= 3 ? 'king' : 'boss'); } drawReveal(bigR, (p - 0.55) / 0.45, cx, cy, S, T); }
          if (T >= total + 0.6) finish();
        }
      }
    }
    // 불티
    c.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 260 * dt; q.vx *= 0.985;
      c.globalAlpha = Math.min(1, q.life / 0.6); c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return ov;
}
