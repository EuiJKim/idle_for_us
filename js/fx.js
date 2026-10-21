// 무공 빛을 그림으로 그린다. 없으면 지금 그대로 벡터로 간다.
//
// 근거: Blade Idle의 이펙트 259장이 전부 **흑백 원형 마스크를 파티클 색으로
// 물들이는** 방식이다(docs/BladeIdle_화면구조.md 6절). 그래서 우리도 흰색·회색
// 으로만 뽑고 코드에서 색을 입힌다 — 한 장으로 여러 무공에 돌려 쓴다.
//
// **읽는 파일은 아래 FILES로 고정이다.** 다른 이름으로 그려 넣어도 안 뜬다.
const FILES = ['fx-ring', 'fx-slash', 'fx-field', 'fx-burst'];

const img = {};
let ready = false;
let tried = false;

export function fxReady() { return ready; }

export function loadFx(onDone) {
  if (tried) return;
  tried = true;
  let left = FILES.length;
  let bad = false;
  for (const n of FILES) {
    const im = new Image();
    im.onload = () => { img[n] = im; if (--left === 0 && !bad) { ready = true; onDone?.(); } };
    im.onerror = () => { bad = true; left--; };
    im.src = `art/fx/${n}.png`;
  }
}

// 흑백 그림에 색을 입혀 둔다. 같은 (그림, 색)은 한 번만 굽는다 —
// 매 프레임 굽면 80마리가 때릴 때 화면이 멎는다.
const tintCache = new Map();
export function tinted(name, rgb) {
  const im = img[name];
  if (!im) return null;
  const key = `${name}|${rgb}`;
  let c = tintCache.get(key);
  if (c) return c;
  if (tintCache.size > 40) tintCache.clear();
  c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'multiply';   // 흰 곳은 그 색, 검은 곳은 검정
  x.fillStyle = `rgb(${rgb})`;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';  // 원래 알파를 되돌린다
  x.drawImage(im, 0, 0);
  tintCache.set(key, c);
  return c;
}

// 가운데를 기준으로 폭 w에 맞춰 그린다
export function putFx(ctx, name, rgb, w, alpha = 1) {
  const c = tinted(name, rgb);
  if (!c) return false;
  const h = (c.height * w) / c.width;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * alpha;
  ctx.drawImage(c, -w / 2, -h / 2, w, h);
  ctx.globalAlpha = a;
  return true;
}
