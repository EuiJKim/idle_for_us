// 새 시즌 소리(v504) — 파일 없이 WebAudio로 합성(지금 게임 js/sfx.js와 같은 방식 · 저작권 · 캐시 걱정 없음)
// 효과음: 지금 게임 소리(타격 · 처치 · 무공 · 레벨업 · 두목 …) + 새 시즌 것(화살 · 기탄 · 경고 · 터짐 · 은자 · 뽑기 · 단추)
// 배경 가락: 오음계(궁상각치우)로 가야금 뜯듯이 — 장마다 음높이 · 빠르기가 조금 다르다. 화면이 안 보이면 멈춘다.
import { sfx as oldSfx, unlockAudio as oldUnlock, setSound as oldSet } from '../../sfx.js';

let ctx = null, master = null, bgmGain = null, noiseBuf = null;
const opt = { sfx: true, bgm: true };
const last = {};
function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.3; master.connect(ctx.destination);
  bgmGain = ctx.createGain(); bgmGain.gain.value = 0.0; bgmGain.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
export function unlock() { oldUnlock(); const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
export function setOpt(o) {
  Object.assign(opt, o); oldSet(opt.sfx);
  if (ctx) bgmGain.gain.setTargetAtTime(opt.bgm ? 0.11 : 0, ctx.currentTime, 0.3);
}
const gap = (n, ms) => { const t = performance.now(); if (last[n] && t - last[n] < ms) return false; last[n] = t; return true; };
function env(g, t0, a, peak, d) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function tone(t0, { f0, f1 = f0, peak = 0.3, a = 0.004, d = 0.15, type = 'sine', out = master }) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + a + d);
  env(g, t0, a, peak, d); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + a + d + 0.03);
}
function noise(t0, { freq = 2000, q = 0.8, peak = 0.3, a = 0.003, d = 0.08, type = 'bandpass' }) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t0, a, peak, d); s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random() * 0.5); s.stop(t0 + a + d + 0.03);
}
const NEW = {
  arrow() { const t = ctx.currentTime; tone(t, { f0: 520, f1: 180, peak: 0.16, d: 0.07, type: 'triangle' }); noise(t + 0.01, { freq: 4200, peak: 0.08, d: 0.12, type: 'highpass' }); },   // 시위 퉁 + 바람
  orb() { const t = ctx.currentTime; tone(t, { f0: 880, f1: 440, peak: 0.12, a: 0.01, d: 0.18, type: 'sine' }); tone(t, { f0: 1320, f1: 660, peak: 0.05, a: 0.01, d: 0.16, type: 'triangle' }); },
  tell() { const t = ctx.currentTime; [0, 0.16].forEach((dt) => tone(t + dt, { f0: 740, f1: 700, peak: 0.13, a: 0.005, d: 0.12, type: 'square' })); },   // 두목 예고: 삐삐
  burst() { const t = ctx.currentTime; tone(t, { f0: 80, f1: 30, peak: 0.7, d: 0.5 }); noise(t, { freq: 300, peak: 0.45, d: 0.45, type: 'lowpass' }); },
  coin() { const t = ctx.currentTime; tone(t, { f0: 1975, f1: 1975, peak: 0.06, a: 0.002, d: 0.08 }); tone(t + 0.05, { f0: 2637, f1: 2637, peak: 0.05, a: 0.002, d: 0.1 }); },
  flip() { const t = ctx.currentTime; noise(t, { freq: 2500, peak: 0.1, d: 0.05, type: 'highpass' }); tone(t, { f0: 600, f1: 900, peak: 0.06, d: 0.05, type: 'triangle' }); },
  rare(g = 4) { const t = ctx.currentTime; const ns = g >= 5 ? [784, 988, 1175, 1568, 1976] : [659, 880, 1109, 1319]; ns.forEach((f, i) => tone(t + i * 0.07, { f0: f, peak: 0.16, a: 0.005, d: 0.5, type: 'triangle' })); },
  tense() { const t = ctx.currentTime; tone(t, { f0: 55, f1: 55, peak: 0.35, a: 0.01, d: 0.18 }); },   // 두근
  click() { const t = ctx.currentTime; tone(t, { f0: 1200, f1: 900, peak: 0.05, a: 0.002, d: 0.03, type: 'triangle' }); },
  clear() { const t = ctx.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(t + i * 0.09, { f0: f, peak: 0.18, a: 0.01, d: 0.35, type: 'triangle' })); },
  fail() { const t = ctx.currentTime; [392, 330, 262].forEach((f, i) => tone(t + i * 0.16, { f0: f, f1: f * 0.97, peak: 0.16, a: 0.01, d: 0.3, type: 'triangle' })); },
};
const GAP = { arrow: 60, orb: 80, tell: 600, burst: 300, coin: 40, flip: 40, rare: 300, tense: 300, click: 40, clear: 1000, fail: 1000 };
export function play(name, arg) {
  if (!opt.sfx) return;
  if (NEW[name]) { if (!ensure() || ctx.state !== 'running' || !gap(name, GAP[name] || 50)) return; try { NEW[name](arg); } catch { /* 소리 없이도 간다 */ } return; }
  oldSfx(name, arg);
}
// ── 배경 가락 ── 장(1~15)마다 으뜸음 · 빠르기. 뜯는 소리(빨리 사라지는 삼각파 + 옥타브 위 배음) · 가끔 낮은 울림
const PENTA = [0, 2, 4, 7, 9];
const ROOT = [220, 233, 247, 196, 262, 220, 247, 208, 294, 233, 185, 196, 262, 175, 294];
let bgmTimer = null, bgmCh = 1, step = 0, seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function pluck(t, f, v) { tone(t, { f0: f, peak: v, a: 0.004, d: 0.9, type: 'triangle', out: bgmGain }); tone(t, { f0: f * 2, peak: v * 0.25, a: 0.003, d: 0.4, type: 'sine', out: bgmGain }); }
function bgmTick() {
  if (!ctx || ctx.state !== 'running' || !opt.bgm || (typeof document !== 'undefined' && document.hidden)) return;
  const t = ctx.currentTime + 0.05, root = ROOT[(bgmCh - 1) % ROOT.length];
  const deg = PENTA[Math.floor(rnd() * 5)] + (rnd() < 0.3 ? 12 : 0), f = root * Math.pow(2, deg / 12);
  if (rnd() < 0.72) pluck(t, f, 0.22);
  if (step % 8 === 0) tone(t, { f0: root / 2, peak: 0.16, a: 0.05, d: 2.2, type: 'sine', out: bgmGain });   // 낮은 울림
  step++;
}
export function bgm(ch) {
  bgmCh = ch || 1;
  if (!ensure()) return;
  bgmGain.gain.setTargetAtTime(opt.bgm ? 0.11 : 0, ctx.currentTime, 0.5);
  const ms = 420 + ((bgmCh * 37) % 5) * 40;
  if (bgmTimer && bgmTimer.ms === ms) return;
  if (bgmTimer) clearInterval(bgmTimer.id);
  bgmTimer = { ms, id: setInterval(bgmTick, ms) };
}
