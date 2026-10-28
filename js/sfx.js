// 효과음 — 파일 없이 WebAudio로 합성한다(타격감). 소리 파일을 받으면 오프라인 캐시가 커지고
// 저작권도 걸린다. 짧은 잡음 + 낮은 '쿵' + 높은 '챙'을 섞어 칼·주먹·지풍 소리를 흉내 낸다.
//
// 휴대폰은 화면을 한 번 눌러야 소리가 난다(브라우저 규칙). 처음 누를 때 깨운다.
// 같은 소리가 한꺼번에 수십 번 겹치면(광역기) 귀가 아프다 — 소리마다 최소 간격을 둔다.
let ctx = null;
let master = null;
let noiseBuf = null;
let on = true;
const last = {};

function ensure() {
  if (ctx || !on) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.32;
  master.connect(ctx.destination);
  // 1초짜리 흰 잡음 — 타격의 '파삭'
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
export function setSound(v) { on = !!v; if (!on && ctx) ctx.suspend().catch(() => {}); else if (on) unlockAudio(); }
export const soundOn = () => on;

function gap(name, ms) {
  const t = performance.now();
  if (last[name] && t - last[name] < ms) return false;
  last[name] = t;
  return true;
}
function env(g, t0, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
}
function noise(t0, { freq = 2200, q = 0.8, peak = 0.5, a = 0.002, d = 0.08, type = 'bandpass' } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t0, a, peak, d);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + a + d + 0.02);
}
function tone(t0, { f0 = 160, f1 = 60, peak = 0.5, a = 0.002, d = 0.12, type = 'sine' } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
  const g = ctx.createGain();
  env(g, t0, a, peak, d);
  o.connect(g); g.connect(master);
  o.start(t0);
  o.stop(t0 + a + d + 0.02);
}

// 소리 이름 → 만드는 법
const BANK = {
  // 휘두름: 높게 쓸고 지나가는 바람
  swish() { const t = ctx.currentTime; noise(t, { freq: 3000, q: 0.6, peak: 0.12, a: 0.01, d: 0.09, type: 'highpass' }); },
  // 타격: 파삭 + 낮은 쿵. 치명은 더 밝고 크다.
  hit(crit) {
    const t = ctx.currentTime;
    noise(t, { freq: crit ? 3200 : 1800, q: 0.9, peak: crit ? 0.55 : 0.32, d: crit ? 0.1 : 0.06 });
    tone(t, { f0: crit ? 220 : 150, f1: 50, peak: crit ? 0.6 : 0.4, d: crit ? 0.16 : 0.1 });
    if (crit) tone(t, { f0: 1400, f1: 900, peak: 0.12, d: 0.12, type: 'triangle' });
  },
  // 쓰러뜨림: 짧게 '퍽' 하고 낮아지는 소리
  kill() { const t = ctx.currentTime; tone(t, { f0: 420, f1: 120, peak: 0.25, d: 0.14, type: 'triangle' }); noise(t, { freq: 900, peak: 0.18, d: 0.12, type: 'lowpass' }); },
  // 무공: 바람이 모였다가 터진다
  skill() {
    const t = ctx.currentTime;
    noise(t, { freq: 1200, q: 0.5, peak: 0.25, a: 0.08, d: 0.18, type: 'bandpass' });
    tone(t + 0.08, { f0: 120, f1: 40, peak: 0.7, d: 0.35 });
    noise(t + 0.08, { freq: 500, peak: 0.35, d: 0.3, type: 'lowpass' });
  },
  // 레벨업: 올라가는 세 음
  level() { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.08, { f0: f, f1: f, peak: 0.22, a: 0.01, d: 0.25, type: 'triangle' })); },
  // 좋은 장비: 맑은 종소리
  loot() { const t = ctx.currentTime; tone(t, { f0: 1568, f1: 1568, peak: 0.2, a: 0.005, d: 0.5, type: 'sine' }); tone(t + 0.07, { f0: 2093, f1: 2093, peak: 0.14, a: 0.005, d: 0.6, type: 'sine' }); },
  // 물약: 꿀꺽
  potion() { const t = ctx.currentTime; tone(t, { f0: 300, f1: 520, peak: 0.25, d: 0.12, type: 'sine' }); tone(t + 0.1, { f0: 260, f1: 480, peak: 0.2, d: 0.12, type: 'sine' }); },
  // 맞음: 둔한 퍽
  hurt() { const t = ctx.currentTime; tone(t, { f0: 110, f1: 55, peak: 0.25, d: 0.1 }); noise(t, { freq: 600, peak: 0.12, d: 0.06, type: 'lowpass' }); },
  // 쓰러짐: 낮게 깔리는 소리
  down() { const t = ctx.currentTime; tone(t, { f0: 200, f1: 45, peak: 0.5, d: 0.7, type: 'sawtooth' }); },
  // 두목 등장: 북 두 번
  boss() { const t = ctx.currentTime; tone(t, { f0: 90, f1: 40, peak: 0.8, d: 0.4 }); tone(t + 0.28, { f0: 90, f1: 40, peak: 0.8, d: 0.5 }); },
  // 십이지왕 등장: 북 세 번이 빨라지다가 낮게 울리는 징
  king() {
    const t = ctx.currentTime;
    [0, 0.32, 0.52].forEach((d, i) => tone(t + d, { f0: 80 - i * 6, f1: 34, peak: 0.85, d: 0.45 }));
    noise(t + 0.38, { freq: 400, q: 0.6, peak: 0.4, a: 0.05, d: 0.9, type: 'lowpass' });
    tone(t + 0.4, { f0: 62, f1: 48, peak: 0.6, a: 0.02, d: 1.8, type: 'triangle' });
    tone(t + 0.4, { f0: 124, f1: 96, peak: 0.18, a: 0.05, d: 1.6, type: 'sine' });
  },
};
const MIN_GAP = { swish: 70, hit: 45, kill: 60, skill: 120, hurt: 120, potion: 200, loot: 300, level: 300, down: 500, boss: 800, king: 2500 };

export function sfx(name, arg) {
  if (!on || !BANK[name]) return;
  if (!ensure() || ctx.state !== 'running') return;
  if (!gap(name, MIN_GAP[name] || 50)) return;
  try { BANK[name](arg); } catch { /* 소리 하나 못 내도 게임은 간다 */ }
}
