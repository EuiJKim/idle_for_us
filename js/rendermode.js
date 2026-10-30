// 그리기 방식 (v188) — GPU로 그릴까, CPU로 그려 한 장만 GPU에 넘길까.
//
// 어떤 폰(삼성 인터넷 · dpr 3.75에서 잰 것)은 GPU 캔버스가 이 게임의 그리기(작은 그림 수백 장 · 더하기 빛 ·
// 반투명 겹치기)를 아주 느리게 했다 — 그리기 명령을 만드는 데 3ms인데 GPU가 실행하는 데 100ms.
// 그런 폰은 CPU로 그리고 다 된 한 장만 화면 캔버스에 붙이면 빨라진다(GPU 일은 한 장 붙이기뿐).
//
// 캔버스가 CPU냐 GPU냐는 처음 getContext 때 정해지므로, **다른 모듈보다 먼저** 읽혀서
// 화면 캔버스(#cv) 말고 모든 2d 캔버스(들판 · 구운 바닥 · 몹 그림 · 글자 …)를 CPU 쪽으로 만들게 한다.
// 정하기: 설정(자동/GPU/CPU). 자동이면 느릴 때 한 번 CPU로 바꿔 보고(다시 읽기), 더 느리면 되돌린다(wmain).
export const RENDER_MODES = ['auto', 'gpu', 'cpu'];
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
export const renderPref = () => (RENDER_MODES.includes(read('ifu.render')) ? read('ifu.render') : 'auto');
export const renderAuto = () => read('ifu.renderAuto') || '';          // '' 아직 · 'cpu' 해 보는 중/고름 · 'gpu' 되돌림
// v191: 삼성 인터넷은 처음부터 CPU — 잰 폰에서 GPU 8fps · CPU 60fps였다. 자동 판정이 'gpu'로 되돌렸으면 그걸 따른다.
const samsung = typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent || '');
export const useCpu = renderPref() === 'cpu' || (renderPref() === 'auto' && (renderAuto() === 'cpu' || (samsung && renderAuto() !== 'gpu')));
if (useCpu && typeof HTMLCanvasElement !== 'undefined') {
  const og = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    if (type === '2d' && this.id !== 'cv') return og.call(this, type, { ...(opts || {}), willReadFrequently: true });
    return og.call(this, type, opts);
  };
}
