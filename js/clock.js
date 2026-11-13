// v475 시각의 기준은 서버 — 게임 전체가 쓰는 Date.now()를 서버 시각으로 맞춘다.
//
// 까닭: 방치 보상 · 하루 단위 초기화(출석·일일 던전·무료 뽑기…)가 기기 시계를 그대로 썼다.
//   기기 시계를 10시간씩 여러 번 앞으로 돌리면 그때마다 10시간치 방치 보상을 받았고, 날짜를 넘기면 일일 보상을 또 받았다.
// 방법: Firebase 실시간 DB가 알려 주는 「서버 시각 − 기기 시각」(.info/serverTimeOffset)을 받아
//   Date.now()에 더한다(js/net.js가 연결되면 setServerOffset을 부른다). 받은 값은 기기에 기억해 두고,
//   다음에 켤 때 연결 전에도 그 값으로 센다. 인터넷이 없는 동안 시계를 돌려 미리 받은 몫은
//   연결된 뒤 clockMax(지금까지 본 가장 늦은 시각)가 그대로 남아 그만큼 다음 방치가 쌓이지 않는다(wgame.offlineReward).
// 게임 안의 흐름(쿨다운·전투)은 프레임 시간(performance.now)으로 가므로 이 값과 상관없다.
// 이 파일은 wmain.js가 맨 먼저 불러온다 — 세이브를 읽고 방치 보상을 세기 전에 시계가 맞아 있어야 한다.

const KEY = 'ifu.clockOff';
const MAX_OFF = 30 * 86400e3;   // 이보다 큰 차이는 믿지 않는다(이상한 값)
const real = Date.now.bind(Date);
let off = 0;
let source = 'device';          // device · saved · server
const listeners = [];

try {
  const v = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (v && Number.isFinite(v.off) && Math.abs(v.off) < MAX_OFF) { off = v.off; source = 'saved'; }
} catch { /* 사생활 모드 · 저장 막힘 — 기기 시각으로 */ }

Date.now = () => real() + off;

export const deviceNow = () => real();
export const clockOffset = () => off;
export const clockSource = () => source;
export function onClock(fn) { listeners.push(fn); }

// 서버가 알려 준 차이(ms, 서버 − 기기). 처음 받았을 때와 크게 바뀌었을 때 알린다.
export function setServerOffset(o) {
  if (!Number.isFinite(o) || Math.abs(o) >= MAX_OFF) return;
  const prev = off, first = source !== 'server';
  off = o; source = 'server';
  try { localStorage.setItem(KEY, JSON.stringify({ off: o, at: real() })); } catch { /* 이번만 */ }
  if (first || Math.abs(o - prev) > 60e3) for (const fn of listeners) { try { fn(o, prev, first); } catch (err) { console.warn('[clock]', err); } }
}
