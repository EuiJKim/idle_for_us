// 직업 전용 무공 그림 (v134) — art/jfx/. OpenAI gpt-image-2.5-sunburst로 그렸다(tools/fxgen).
// 색이 칠해진 그림이다(art/fx의 흑백 마스크와 달리 물들이지 않는다). 없으면 연출은 벡터 그대로 간다.
//
// 매화·꽃잎(검사) · 황금 주먹·금종·금빛 몸(권마) · 해골·독안개·독사 머리(독마) · 혈안·혼불(환마) · 가면·비수·핏빛 달(극악소마)
// · 직업마다 바닥 인장(seal-*) · 4차 컷인 띠 그림(cut-*, jpg)
const PNG = ['plum-flower', 'plum-petal', 'fist-gold', 'gold-bell', 'gold-aura', 'skull', 'poison-cloud', 'serpent-head',
  'blood-eye', 'soul-orb', 'mask', 'dagger', 'blood-moon', 'crack', 'seal-sword', 'seal-fist', 'seal-poison', 'seal-fan', 'seal-ring'];
const JPG = ['cut-sword', 'cut-fist', 'cut-poison', 'cut-fan', 'cut-ring'];
const img = {};
let tried = false;
export function loadJobArt() {
  if (tried) return;
  tried = true;
  const load = (n, ext) => { const im = new Image(); im.onload = () => { img[n] = im; }; im.onerror = () => {}; im.src = `art/jfx/${n}.${ext}`; };
  for (const n of PNG) load(n, 'png');
  for (const n of JPG) load(n, 'jpg');
}
export const jart = (n) => img[n] || null;
export const JOB_FILES = [...PNG.map((n) => `art/jfx/${n}.png`), ...JPG.map((n) => `art/jfx/${n}.jpg`)];
// (x, y)를 가운데로 폭 w에 맞춰 그린다. rot 라디안. 그림이 없으면 false
export function putJ(ctx, n, x, y, w, alpha = 1, rot = 0, sy = 1) {
  const im = img[n];
  if (!im || alpha <= 0.002) return !!im;
  const h = (im.height * w) / im.width;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.translate(x, y);
  if (sy !== 1) ctx.scale(1, sy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(im, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
// 지금 무인 직업 (그리는 쪽에서) — 인장·컷인을 고른다
export const jobOfView = (v) => v?.game?.s?.job || null;
// 오른쪽을 보는 그림을 각도 a로 — 왼쪽을 볼 땐 뒤집어 거꾸로 서지 않게 한다
export function putFace(ctx, n, x, y, w, alpha, a) {
  const im = img[n];
  if (!im) return false;
  const flip = Math.cos(a) < 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(flip ? a + Math.PI : a);
  if (flip) ctx.scale(-1, 1);
  const r = putJ(ctx, n, 0, 0, w, alpha);
  ctx.restore();
  return r;
}
